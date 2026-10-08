//! JavaScript bindings for the browser client.

use js_sys::Uint8Array;
use wasm_bindgen::prelude::*;

use crate::Device;

fn js<T>(r: Result<T, String>) -> Result<T, JsError> {
    r.map_err(|e| JsError::new(&e))
}

fn bytes(list: Vec<Uint8Array>) -> Vec<Vec<u8>> {
    list.iter().map(|a| a.to_vec()).collect()
}

#[wasm_bindgen(getter_with_clone)]
pub struct Commit {
    pub commit: Vec<u8>,
    pub welcome: Option<Vec<u8>>,
    pub epoch: u64,
}

impl From<crate::Commit> for Commit {
    fn from(c: crate::Commit) -> Self {
        Self { commit: c.commit, welcome: c.welcome, epoch: c.epoch }
    }
}

#[wasm_bindgen(getter_with_clone)]
pub struct Opened {
    pub sender: Vec<u8>,
    pub epoch: u64,
    pub plaintext: Vec<u8>,
}

#[wasm_bindgen]
pub struct PulseDevice(Device);

#[wasm_bindgen]
impl PulseDevice {
    #[wasm_bindgen(constructor)]
    pub fn new(identity: &[u8]) -> Result<PulseDevice, JsError> {
        js(Device::new(identity)).map(PulseDevice)
    }

    pub fn restore(state: &[u8]) -> Result<PulseDevice, JsError> {
        js(Device::restore(state)).map(PulseDevice)
    }

    #[wasm_bindgen(js_name = exportState)]
    pub fn export_state(&self) -> Vec<u8> {
        self.0.export_state()
    }

    #[wasm_bindgen(js_name = identityKey)]
    pub fn identity_key(&self) -> Vec<u8> {
        self.0.identity_key()
    }

    #[wasm_bindgen(js_name = keyPackage)]
    pub fn key_package(&self) -> Result<Vec<u8>, JsError> {
        js(self.0.key_package())
    }

    #[wasm_bindgen(js_name = createGroup)]
    pub fn create_group(&self, group_id: &[u8]) -> Result<u64, JsError> {
        js(self.0.create_group(group_id))
    }

    #[wasm_bindgen(js_name = addMembers)]
    pub fn add_members(&self, group_id: &[u8], key_packages: Vec<Uint8Array>) -> Result<Commit, JsError> {
        js(self.0.add_members(group_id, &bytes(key_packages))).map(Into::into)
    }

    #[wasm_bindgen(js_name = mergePending)]
    pub fn merge_pending(&self, group_id: &[u8]) -> Result<u64, JsError> {
        js(self.0.merge_pending(group_id))
    }

    #[wasm_bindgen(js_name = discardPending)]
    pub fn discard_pending(&self, group_id: &[u8]) -> Result<(), JsError> {
        js(self.0.discard_pending(group_id))
    }

    #[wasm_bindgen(js_name = selfUpdate)]
    pub fn self_update(&self, group_id: &[u8]) -> Result<Commit, JsError> {
        js(self.0.self_update(group_id)).map(Into::into)
    }

    #[wasm_bindgen(js_name = removeMembers)]
    pub fn remove_members(&self, group_id: &[u8], identities: Vec<Uint8Array>) -> Result<Commit, JsError> {
        js(self.0.remove_members(group_id, &bytes(identities))).map(Into::into)
    }

    pub fn join(&self, welcome: &[u8]) -> Result<Vec<u8>, JsError> {
        js(self.0.join(welcome))
    }

    #[wasm_bindgen(js_name = processCommit)]
    pub fn process_commit(&self, group_id: &[u8], commit: &[u8]) -> Result<u64, JsError> {
        js(self.0.process_commit(group_id, commit))
    }

    #[wasm_bindgen(js_name = currentEpoch)]
    pub fn current_epoch(&self, group_id: &[u8]) -> Result<u64, JsError> {
        js(self.0.current_epoch(group_id))
    }

    #[wasm_bindgen(js_name = epochKey)]
    pub fn epoch_key(&self, group_id: &[u8], epoch: u64) -> Option<Vec<u8>> {
        self.0.epoch_key(group_id, epoch)
    }

    #[wasm_bindgen(js_name = importEpochKey)]
    pub fn import_epoch_key(&self, group_id: &[u8], epoch: u64, key: &[u8]) -> Result<(), JsError> {
        js(self.0.import_epoch_key(group_id, epoch, key))
    }

    /// Signature key of a current member, or undefined if not in the group.
    #[wasm_bindgen(js_name = keyPackageIdentity)]
    pub fn key_package_identity(&self, key_package: &[u8]) -> Result<Vec<u8>, JsError> {
        js(self.0.key_package_identity(key_package))
    }

    #[wasm_bindgen(js_name = dropGroup)]
    pub fn drop_group(&self, group_id: &[u8]) -> Result<(), JsError> {
        js(self.0.drop_group(group_id))
    }

    /// Identities of the devices currently in the group.
    #[wasm_bindgen(js_name = memberIdentities)]
    pub fn member_identities(&self, group_id: &[u8]) -> Result<Vec<Uint8Array>, JsError> {
        Ok(js(self.0.members(group_id))?.iter().map(|(id, _)| Uint8Array::from(id.as_slice())).collect())
    }

    #[wasm_bindgen(js_name = hasGroup)]
    pub fn has_group(&self, group_id: &[u8]) -> bool {
        self.0.current_epoch(group_id).is_ok()
    }

    #[wasm_bindgen(js_name = memberKey)]
    pub fn member_key(&self, group_id: &[u8], identity: &[u8]) -> Result<Option<Vec<u8>>, JsError> {
        Ok(js(self.0.members(group_id))?.into_iter().find(|(id, _)| id == identity).map(|(_, key)| key))
    }

    pub fn encrypt(&self, group_id: &[u8], plaintext: &[u8]) -> Result<Vec<u8>, JsError> {
        js(self.0.encrypt(group_id, plaintext))
    }

    #[wasm_bindgen(js_name = frameSender)]
    pub fn frame_sender(frame: &[u8]) -> Result<Vec<u8>, JsError> {
        js(Device::frame_sender(frame))
    }

    pub fn decrypt(&self, group_id: &[u8], frame: &[u8], sender_key: &[u8]) -> Result<Opened, JsError> {
        let o = js(self.0.decrypt(group_id, frame, sender_key))?;
        Ok(Opened { sender: o.sender, epoch: o.epoch, plaintext: o.plaintext })
    }
}
