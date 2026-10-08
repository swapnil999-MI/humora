//! Pulse end-to-end encryption core.
//!
//! MLS (RFC 9420, via OpenMLS) does the group key agreement: who is in a
//! conversation, and a fresh shared secret ("epoch") every time membership
//! changes. Message content is then sealed with a key exported from the
//! current epoch and signed by the sending device.
//!
//! Content is deliberately not sent as MLS application messages: those use
//! per-message ratchet keys that are deleted after use, so ciphertext stored
//! on the server could never be read by a user's newly linked device. With one
//! exportable key per epoch, a device can back its epoch keys up under the
//! user's recovery key and any of that user's devices can read the history.
//! The trade-off is forward secrecy per epoch instead of per message.

use openmls::prelude::{tls_codec::*, *};
use openmls_basic_credential::SignatureKeyPair;
use openmls_rust_crypto::{MemoryStorage, RustCrypto};
use openmls_traits::{signatures::Signer, types::AeadType};

#[cfg(target_arch = "wasm32")]
mod wasm;
#[cfg(target_os = "android")]
mod android;

const CIPHERSUITE: Ciphersuite = Ciphersuite::MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519;
const EXPORT_LABEL: &str = "pulse message key v1";
const FRAME_VERSION: u8 = 1;
const KEY_LEN: usize = 32;
const NONCE_LEN: usize = 12;
const EPOCH_KEY_PREFIX: &[u8] = b"pulse/epoch-key/";

fn err<E: core::fmt::Debug>(e: E) -> String {
    format!("{e:?}")
}

#[derive(Default)]
struct Provider {
    crypto: RustCrypto,
    storage: MemoryStorage,
}

impl OpenMlsProvider for Provider {
    type CryptoProvider = RustCrypto;
    type RandProvider = RustCrypto;
    type StorageProvider = MemoryStorage;

    fn storage(&self) -> &MemoryStorage {
        &self.storage
    }
    fn crypto(&self) -> &RustCrypto {
        &self.crypto
    }
    fn rand(&self) -> &RustCrypto {
        &self.crypto
    }
}

/// One installed client. All of its secrets live in `provider.storage`, which
/// `export_state` / `restore` move in and out of the platform's local database.
pub struct Device {
    provider: Provider,
    signer: SignatureKeyPair,
    identity: Vec<u8>,
}

/// A proposed membership change. It is only staged: send `commit` to the
/// conversation log claiming `epoch`, then call `merge_pending` once the
/// server accepts it (and only then deliver `welcome` to the added devices),
/// or `discard_pending` if another member's commit took that epoch first.
pub struct Commit {
    pub commit: Vec<u8>,
    pub welcome: Option<Vec<u8>>,
    /// The epoch the group moves to when this commit is merged.
    pub epoch: u64,
}

/// A decrypted message and the device that signed it.
pub struct Opened {
    pub sender: Vec<u8>,
    pub epoch: u64,
    pub plaintext: Vec<u8>,
}

fn put(out: &mut Vec<u8>, bytes: &[u8]) {
    out.extend_from_slice(&(bytes.len() as u32).to_be_bytes());
    out.extend_from_slice(bytes);
}

fn take<'a>(input: &mut &'a [u8]) -> Result<&'a [u8], String> {
    if input.len() < 4 {
        return Err("truncated".into());
    }
    let len = u32::from_be_bytes(input[..4].try_into().unwrap()) as usize;
    let rest = &input[4..];
    if rest.len() < len {
        return Err("truncated".into());
    }
    *input = &rest[len..];
    Ok(&rest[..len])
}

impl Device {
    /// Creates a device with a fresh signature key. `identity` is the device id.
    pub fn new(identity: &[u8]) -> Result<Self, String> {
        let provider = Provider::default();
        let signer = SignatureKeyPair::new(CIPHERSUITE.signature_algorithm()).map_err(err)?;
        signer.store(provider.storage()).map_err(err)?;
        Ok(Self { provider, signer, identity: identity.to_vec() })
    }

    /// Serializes every secret this device holds. The caller must store the
    /// result encrypted at rest.
    pub fn export_state(&self) -> Vec<u8> {
        let mut out = Vec::new();
        put(&mut out, &self.identity);
        put(&mut out, self.signer.public());
        let values = self.provider.storage.values.read().unwrap();
        for (k, v) in values.iter() {
            put(&mut out, k);
            put(&mut out, v);
        }
        out
    }

    pub fn restore(state: &[u8]) -> Result<Self, String> {
        let mut input = state;
        let identity = take(&mut input)?.to_vec();
        let public = take(&mut input)?.to_vec();
        let provider = Provider::default();
        {
            let mut values = provider.storage.values.write().unwrap();
            while !input.is_empty() {
                let k = take(&mut input)?.to_vec();
                let v = take(&mut input)?.to_vec();
                values.insert(k, v);
            }
        }
        let signer = SignatureKeyPair::read(provider.storage(), &public, CIPHERSUITE.signature_algorithm())
            .ok_or("signature key missing from state")?;
        Ok(Self { provider, signer, identity })
    }

    pub fn identity(&self) -> &[u8] {
        &self.identity
    }

    /// Public signature key, published to the server's device directory.
    pub fn identity_key(&self) -> Vec<u8> {
        self.signer.to_public_vec()
    }

    fn credential(&self) -> CredentialWithKey {
        CredentialWithKey {
            credential: BasicCredential::new(self.identity.clone()).into(),
            signature_key: self.signer.to_public_vec().into(),
        }
    }

    /// A one-time key package that lets another device add this one to a
    /// group while it is offline.
    pub fn key_package(&self) -> Result<Vec<u8>, String> {
        let bundle = KeyPackage::builder()
            .build(CIPHERSUITE, &self.provider, &self.signer, self.credential())
            .map_err(err)?;
        bundle.key_package().tls_serialize_detached().map_err(err)
    }

    /// The identity a key package claims, after checking its signature. The
    /// caller compares it with the device it asked the server for.
    pub fn key_package_identity(&self, key_package: &[u8]) -> Result<Vec<u8>, String> {
        let package = KeyPackageIn::tls_deserialize_exact(key_package)
            .map_err(err)?
            .validate(self.provider.crypto(), ProtocolVersion::Mls10)
            .map_err(err)?;
        Ok(package.leaf_node().credential().serialized_content().to_vec())
    }

    /// Forgets a group entirely, e.g. after losing the race to initialize it.
    pub fn drop_group(&self, group_id: &[u8]) -> Result<(), String> {
        let mut group = self.group(group_id)?;
        group.delete(self.provider.storage()).map_err(err)
    }

    fn group(&self, group_id: &[u8]) -> Result<MlsGroup, String> {
        MlsGroup::load(self.provider.storage(), &GroupId::from_slice(group_id))
            .map_err(err)?
            .ok_or_else(|| "unknown group".to_string())
    }

    fn epoch_key_slot(group_id: &[u8], epoch: u64) -> Vec<u8> {
        let mut k = EPOCH_KEY_PREFIX.to_vec();
        put(&mut k, group_id);
        k.extend_from_slice(&epoch.to_be_bytes());
        k
    }

    /// Derives and keeps the message key for the group's current epoch.
    fn remember_epoch(&self, group: &MlsGroup) -> Result<u64, String> {
        let epoch = group.epoch().as_u64();
        let key = group.export_secret(self.provider.crypto(), EXPORT_LABEL, &[], KEY_LEN).map_err(err)?;
        self.import_epoch_key(group.group_id().as_slice(), epoch, &key)?;
        Ok(epoch)
    }

    /// The message key for one epoch, for backup under the recovery key or
    /// for sharing history with a newly added member.
    pub fn epoch_key(&self, group_id: &[u8], epoch: u64) -> Option<Vec<u8>> {
        self.provider.storage.values.read().unwrap().get(&Self::epoch_key_slot(group_id, epoch)).cloned()
    }

    /// Installs a message key obtained from a backup or a history share.
    pub fn import_epoch_key(&self, group_id: &[u8], epoch: u64, key: &[u8]) -> Result<(), String> {
        if key.len() != KEY_LEN {
            return Err("bad epoch key length".into());
        }
        self.provider.storage.values.write().unwrap().insert(Self::epoch_key_slot(group_id, epoch), key.to_vec());
        Ok(())
    }

    pub fn current_epoch(&self, group_id: &[u8]) -> Result<u64, String> {
        Ok(self.group(group_id)?.epoch().as_u64())
    }

    /// Starts a conversation with this device as its only member.
    pub fn create_group(&self, group_id: &[u8]) -> Result<u64, String> {
        let config = MlsGroupCreateConfig::builder()
            .ciphersuite(CIPHERSUITE)
            .use_ratchet_tree_extension(true)
            .build();
        let group = MlsGroup::new_with_group_id(
            &self.provider,
            &self.signer,
            &config,
            GroupId::from_slice(group_id),
            self.credential(),
        )
        .map_err(err)?;
        self.remember_epoch(&group)
    }

    /// Applies this device's staged commit after the server accepted it.
    pub fn merge_pending(&self, group_id: &[u8]) -> Result<u64, String> {
        let mut group = self.group(group_id)?;
        group.merge_pending_commit(&self.provider).map_err(err)?;
        self.remember_epoch(&group)
    }

    /// Drops this device's staged commit after it lost the race for its epoch.
    pub fn discard_pending(&self, group_id: &[u8]) -> Result<(), String> {
        let mut group = self.group(group_id)?;
        group.clear_pending_commit(self.provider.storage()).map_err(err)
    }

    /// Stages a commit that only refreshes this device's keys. Used to claim
    /// the first epoch of a conversation nobody else can be added to yet.
    pub fn self_update(&self, group_id: &[u8]) -> Result<Commit, String> {
        let mut group = self.group(group_id)?;
        let bundle = group
            .self_update(&self.provider, &self.signer, LeafNodeParameters::default())
            .map_err(err)?;
        Ok(Commit {
            commit: bundle.into_commit().tls_serialize_detached().map_err(err)?,
            welcome: None,
            epoch: group.epoch().as_u64() + 1,
        })
    }

    /// Stages a commit that adds devices by their key packages.
    pub fn add_members(&self, group_id: &[u8], key_packages: &[Vec<u8>]) -> Result<Commit, String> {
        let mut group = self.group(group_id)?;
        let mut packages = Vec::with_capacity(key_packages.len());
        for raw in key_packages {
            let package = KeyPackageIn::tls_deserialize_exact(raw.as_slice())
                .map_err(err)?
                .validate(self.provider.crypto(), ProtocolVersion::Mls10)
                .map_err(err)?;
            packages.push(package);
        }
        let (commit, welcome, _) = group.add_members(&self.provider, &self.signer, &packages).map_err(err)?;
        Ok(Commit {
            commit: commit.tls_serialize_detached().map_err(err)?,
            welcome: Some(welcome.tls_serialize_detached().map_err(err)?),
            epoch: group.epoch().as_u64() + 1,
        })
    }

    /// Stages a commit that removes devices by identity. The new epoch's key
    /// is unknown to them.
    pub fn remove_members(&self, group_id: &[u8], identities: &[Vec<u8>]) -> Result<Commit, String> {
        let mut group = self.group(group_id)?;
        let leaves: Vec<LeafNodeIndex> = group
            .members()
            .filter(|m| identities.iter().any(|id| id.as_slice() == m.credential.serialized_content()))
            .map(|m| m.index)
            .collect();
        if leaves.is_empty() {
            return Err("no matching members".into());
        }
        let (commit, welcome, _) = group.remove_members(&self.provider, &self.signer, &leaves).map_err(err)?;
        Ok(Commit {
            commit: commit.tls_serialize_detached().map_err(err)?,
            welcome: welcome.map(|w| w.tls_serialize_detached()).transpose().map_err(err)?,
            epoch: group.epoch().as_u64() + 1,
        })
    }

    /// Joins a group from a welcome. Returns the group id.
    pub fn join(&self, welcome: &[u8]) -> Result<Vec<u8>, String> {
        let welcome = match MlsMessageIn::tls_deserialize_exact(welcome).map_err(err)?.extract() {
            MlsMessageBodyIn::Welcome(welcome) => welcome,
            _ => return Err("not a welcome message".into()),
        };
        let config = MlsGroupJoinConfig::builder().use_ratchet_tree_extension(true).build();
        let group = StagedWelcome::new_from_welcome(&self.provider, &config, welcome, None)
            .map_err(err)?
            .into_group(&self.provider)
            .map_err(err)?;
        self.remember_epoch(&group)?;
        Ok(group.group_id().as_slice().to_vec())
    }

    /// Applies another member's commit from the conversation log. Returns the new epoch.
    pub fn process_commit(&self, group_id: &[u8], commit: &[u8]) -> Result<u64, String> {
        let mut group = self.group(group_id)?;
        let message = MlsMessageIn::tls_deserialize_exact(commit)
            .map_err(err)?
            .try_into_protocol_message()
            .map_err(err)?;
        let processed = group.process_message(&self.provider, message).map_err(err)?;
        match processed.into_content() {
            ProcessedMessageContent::StagedCommitMessage(staged) => {
                group.merge_staged_commit(&self.provider, *staged).map_err(err)?;
            }
            _ => return Err("not a commit".into()),
        }
        if !group.is_active() {
            // This device was removed: it gets no key for the new epoch.
            return Ok(group.epoch().as_u64());
        }
        self.remember_epoch(&group)
    }

    /// Identities and signature keys of the devices currently in the group.
    pub fn members(&self, group_id: &[u8]) -> Result<Vec<(Vec<u8>, Vec<u8>)>, String> {
        Ok(self
            .group(group_id)?
            .members()
            .map(|m| (m.credential.serialized_content().to_vec(), m.signature_key))
            .collect())
    }

    fn aad(group_id: &[u8], epoch: u64, sender: &[u8]) -> Vec<u8> {
        let mut aad = vec![FRAME_VERSION];
        put(&mut aad, group_id);
        aad.extend_from_slice(&epoch.to_be_bytes());
        put(&mut aad, sender);
        aad
    }

    /// Seals content for the group's current epoch.
    ///
    /// Frame: version | epoch | sender | nonce | ciphertext | signature.
    pub fn encrypt(&self, group_id: &[u8], plaintext: &[u8]) -> Result<Vec<u8>, String> {
        let epoch = self.current_epoch(group_id)?;
        let key = self.epoch_key(group_id, epoch).ok_or("no key for current epoch")?;
        let nonce = self.provider.rand().random_vec(NONCE_LEN).map_err(err)?;
        let aad = Self::aad(group_id, epoch, &self.identity);
        let ciphertext = self
            .provider
            .crypto()
            .aead_encrypt(AeadType::Aes256Gcm, &key, plaintext, &nonce, &aad)
            .map_err(err)?;

        let mut signed = aad.clone();
        put(&mut signed, &nonce);
        put(&mut signed, &ciphertext);
        let signature = self.signer.sign(&signed).map_err(err)?;

        let mut frame = vec![FRAME_VERSION];
        frame.extend_from_slice(&epoch.to_be_bytes());
        put(&mut frame, &self.identity);
        put(&mut frame, &nonce);
        put(&mut frame, &ciphertext);
        put(&mut frame, &signature);
        Ok(frame)
    }

    /// Reads the sender identity out of a frame without decrypting, so the
    /// caller can look up that device's signature key.
    pub fn frame_sender(frame: &[u8]) -> Result<Vec<u8>, String> {
        if frame.len() < 9 || frame[0] != FRAME_VERSION {
            return Err("unsupported frame".into());
        }
        let mut input = &frame[9..];
        Ok(take(&mut input)?.to_vec())
    }

    /// Verifies the sender's signature and opens the frame. Works for any
    /// epoch whose key this device holds, including imported ones.
    pub fn decrypt(&self, group_id: &[u8], frame: &[u8], sender_key: &[u8]) -> Result<Opened, String> {
        if frame.len() < 9 || frame[0] != FRAME_VERSION {
            return Err("unsupported frame".into());
        }
        let epoch = u64::from_be_bytes(frame[1..9].try_into().unwrap());
        let mut input = &frame[9..];
        let sender = take(&mut input)?;
        let nonce = take(&mut input)?;
        let ciphertext = take(&mut input)?;
        let signature = take(&mut input)?;
        if !input.is_empty() {
            return Err("trailing bytes".into());
        }

        let aad = Self::aad(group_id, epoch, sender);
        let mut signed = aad.clone();
        put(&mut signed, nonce);
        put(&mut signed, ciphertext);
        self.provider
            .crypto()
            .verify_signature(CIPHERSUITE.signature_algorithm(), &signed, sender_key, signature)
            .map_err(|_| "bad signature".to_string())?;

        let key = self.epoch_key(group_id, epoch).ok_or("no key for this epoch")?;
        let plaintext = self
            .provider
            .crypto()
            .aead_decrypt(AeadType::Aes256Gcm, &key, ciphertext, nonce, &aad)
            .map_err(|_| "decryption failed".to_string())?;
        Ok(Opened { sender: sender.to_vec(), epoch, plaintext })
    }
}
