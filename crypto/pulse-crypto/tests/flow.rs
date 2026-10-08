use pulse_crypto::Device;

const GROUP: &[u8] = b"conversation-0001";

/// Alice creates a group and adds Bob; both hold the same epoch.
fn pair() -> (Device, Device) {
    let alice = Device::new(b"alice-laptop").unwrap();
    let bob = Device::new(b"bob-phone").unwrap();
    alice.create_group(GROUP).unwrap();
    let added = alice.add_members(GROUP, &[bob.key_package().unwrap()]).unwrap();
    assert_eq!(alice.merge_pending(GROUP).unwrap(), added.epoch);
    assert_eq!(bob.join(&added.welcome.unwrap()).unwrap(), GROUP);
    assert_eq!(alice.current_epoch(GROUP).unwrap(), bob.current_epoch(GROUP).unwrap());
    (alice, bob)
}

#[test]
fn two_devices_exchange_messages() {
    let (alice, bob) = pair();

    let frame = alice.encrypt(GROUP, b"hello bob").unwrap();
    assert!(!frame.windows(9).any(|w| w == b"hello bob"), "plaintext leaked into the frame");
    assert_eq!(Device::frame_sender(&frame).unwrap(), b"alice-laptop");
    let opened = bob.decrypt(GROUP, &frame, &alice.identity_key()).unwrap();
    assert_eq!(opened.plaintext, b"hello bob");
    assert_eq!(opened.sender, b"alice-laptop");

    let reply = bob.encrypt(GROUP, b"hi alice").unwrap();
    assert_eq!(alice.decrypt(GROUP, &reply, &bob.identity_key()).unwrap().plaintext, b"hi alice");

    // The sender's own other-device copy decrypts the same stored frame.
    assert_eq!(alice.decrypt(GROUP, &frame, &alice.identity_key()).unwrap().plaintext, b"hello bob");
}

#[test]
fn tampering_and_forgery_are_rejected() {
    let (alice, bob) = pair();
    let frame = alice.encrypt(GROUP, b"pay 100").unwrap();

    let mut flipped = frame.clone();
    let mid = flipped.len() / 2;
    flipped[mid] ^= 1;
    assert!(bob.decrypt(GROUP, &flipped, &alice.identity_key()).is_err());

    // A frame replayed into a different conversation does not open.
    assert!(bob.decrypt(b"another-conversation", &frame, &alice.identity_key()).is_err());

    // Bob knows the group key but cannot produce a frame that verifies as Alice's.
    let forged = bob.encrypt(GROUP, b"pay 9999").unwrap();
    assert_eq!(
        alice.decrypt(GROUP, &forged, &alice.identity_key()).err().as_deref(),
        Some("bad signature")
    );
}

#[test]
fn third_member_joins_and_removed_member_is_locked_out() {
    let (alice, bob) = pair();
    let old = alice.encrypt(GROUP, b"before carol").unwrap();

    let carol = Device::new(b"carol-web").unwrap();
    let added = alice.add_members(GROUP, &[carol.key_package().unwrap()]).unwrap();
    alice.merge_pending(GROUP).unwrap();
    bob.process_commit(GROUP, &added.commit).unwrap();
    carol.join(&added.welcome.unwrap()).unwrap();

    let msg = carol.encrypt(GROUP, b"hello all").unwrap();
    for reader in [&alice, &bob] {
        assert_eq!(reader.decrypt(GROUP, &msg, &carol.identity_key()).unwrap().plaintext, b"hello all");
    }

    // Carol has no key for the epoch before she joined...
    assert_eq!(carol.decrypt(GROUP, &old, &alice.identity_key()).err().as_deref(), Some("no key for this epoch"));
    // ...until an existing member shares it with her.
    let epoch = alice.current_epoch(GROUP).unwrap() - 1;
    carol.import_epoch_key(GROUP, epoch, &alice.epoch_key(GROUP, epoch).unwrap()).unwrap();
    assert_eq!(carol.decrypt(GROUP, &old, &alice.identity_key()).unwrap().plaintext, b"before carol");

    // Remove Bob: he can apply the commit but cannot read the new epoch.
    let removed = alice.remove_members(GROUP, &[b"bob-phone".to_vec()]).unwrap();
    alice.merge_pending(GROUP).unwrap();
    carol.process_commit(GROUP, &removed.commit).unwrap();
    bob.process_commit(GROUP, &removed.commit).unwrap();
    let after = alice.encrypt(GROUP, b"bob is gone").unwrap();
    assert_eq!(carol.decrypt(GROUP, &after, &alice.identity_key()).unwrap().plaintext, b"bob is gone");
    assert_eq!(bob.decrypt(GROUP, &after, &alice.identity_key()).err().as_deref(), Some("no key for this epoch"));
    assert_eq!(alice.members(GROUP).unwrap().len(), 2);
}

#[test]
fn state_survives_restart_and_backup_restores_history() {
    let (alice, bob) = pair();
    let frame = alice.encrypt(GROUP, b"stored on the server").unwrap();

    // Restart: the device reloads from its exported state and keeps working.
    let bob = Device::restore(&bob.export_state()).unwrap();
    assert_eq!(bob.decrypt(GROUP, &frame, &alice.identity_key()).unwrap().plaintext, b"stored on the server");
    let reply = bob.encrypt(GROUP, b"still here").unwrap();
    assert_eq!(alice.decrypt(GROUP, &reply, &bob.identity_key()).unwrap().plaintext, b"still here");

    // A brand-new device of Bob's, holding only a backed-up epoch key, reads history.
    let epoch = bob.current_epoch(GROUP).unwrap();
    let backup = bob.epoch_key(GROUP, epoch).unwrap();
    let new_phone = Device::new(b"bob-new-phone").unwrap();
    assert!(new_phone.decrypt(GROUP, &frame, &alice.identity_key()).is_err());
    new_phone.import_epoch_key(GROUP, epoch, &backup).unwrap();
    assert_eq!(new_phone.decrypt(GROUP, &frame, &alice.identity_key()).unwrap().plaintext, b"stored on the server");
}

#[test]
fn losing_a_commit_race_is_recoverable() {
    let (alice, bob) = pair();
    let carol = Device::new(b"carol-web").unwrap();
    let dave = Device::new(b"dave-web").unwrap();

    // Alice and Bob both stage a commit for the same epoch; the server picks Bob's.
    let alices = alice.add_members(GROUP, &[carol.key_package().unwrap()]).unwrap();
    let bobs = bob.add_members(GROUP, &[dave.key_package().unwrap()]).unwrap();
    assert_eq!(alices.epoch, bobs.epoch);
    bob.merge_pending(GROUP).unwrap();
    dave.join(&bobs.welcome.unwrap()).unwrap();

    // Alice discards hers, applies the winner, and retries on top of it.
    alice.discard_pending(GROUP).unwrap();
    assert_eq!(alice.process_commit(GROUP, &bobs.commit).unwrap(), bobs.epoch);
    let retry = alice.add_members(GROUP, &[carol.key_package().unwrap()]).unwrap();
    assert_eq!(retry.epoch, bobs.epoch + 1);
    alice.merge_pending(GROUP).unwrap();
    bob.process_commit(GROUP, &retry.commit).unwrap();
    dave.process_commit(GROUP, &retry.commit).unwrap();
    carol.join(&retry.welcome.unwrap()).unwrap();

    let msg = carol.encrypt(GROUP, b"all four").unwrap();
    for reader in [&alice, &bob, &dave] {
        assert_eq!(reader.decrypt(GROUP, &msg, &carol.identity_key()).unwrap().plaintext, b"all four");
    }
}

#[test]
fn solo_group_claims_an_epoch_then_adds_a_member() {
    let alice = Device::new(b"alice-laptop").unwrap();
    alice.create_group(GROUP).unwrap();
    let claim = alice.self_update(GROUP).unwrap();
    assert_eq!(claim.epoch, 1);
    assert!(claim.welcome.is_none());
    assert_eq!(alice.merge_pending(GROUP).unwrap(), 1);
    let early = alice.encrypt(GROUP, b"sent before bob had a device").unwrap();

    let bob = Device::new(b"bob-phone").unwrap();
    let added = alice.add_members(GROUP, &[bob.key_package().unwrap()]).unwrap();
    alice.merge_pending(GROUP).unwrap();
    bob.join(&added.welcome.unwrap()).unwrap();
    bob.import_epoch_key(GROUP, 1, &alice.epoch_key(GROUP, 1).unwrap()).unwrap();
    assert_eq!(bob.decrypt(GROUP, &early, &alice.identity_key()).unwrap().plaintext, b"sent before bob had a device");
}
