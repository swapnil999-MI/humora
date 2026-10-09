//! JNI bindings for the Android client (`com.paylogic.humora.pulse.crypto.PulseNative`).
//!
//! A `Device` lives on the Rust heap and Kotlin holds it as an opaque `long`
//! handle; `free` releases it. Every entry point catches errors and panics and
//! rethrows them as `com.paylogic.humora.pulse.crypto.PulseCryptoException`,
//! so a bad frame can never abort the app.
//!
//! Structured results use small big-endian byte layouts decoded in Kotlin:
//!   commit: epoch u64 | commit_len u32 | commit | has_welcome u8 | welcome
//!   opened: epoch u64 | sender_len u32 | sender | plaintext

use std::panic::{catch_unwind, AssertUnwindSafe};

use jni::objects::{JByteArray, JClass, JObject, JObjectArray};
use jni::sys::{jboolean, jbyteArray, jlong, jobjectArray, JNI_FALSE, JNI_TRUE};
use jni::JNIEnv;

use crate::{Commit, Device};

const EXCEPTION: &str = "com/paylogic/humora/pulse/crypto/PulseCryptoException";

/// Runs `f`, turning an `Err` or a panic into a Java exception and returning `default`.
fn guard<'l, T>(env: &mut JNIEnv<'l>, default: T, f: impl FnOnce(&mut JNIEnv<'l>) -> Result<T, String>) -> T {
    let result = catch_unwind(AssertUnwindSafe(|| f(env)));
    let message = match result {
        Ok(Ok(v)) => return v,
        Ok(Err(e)) => e,
        Err(panic) => panic
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| panic.downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "panic in pulse-crypto".into()),
    };
    if !env.exception_check().unwrap_or(false) {
        let _ = env.throw_new(EXCEPTION, message);
    }
    default
}

fn device<'a>(handle: jlong) -> Result<&'a Device, String> {
    if handle == 0 {
        return Err("device handle is closed".into());
    }
    // SAFETY: handles come from `Box::into_raw` in `new`/`restore` and stay valid until `free`;
    // the Kotlin wrapper never calls into a freed handle and serialises access.
    Ok(unsafe { &*(handle as *const Device) })
}

fn input(env: &mut JNIEnv, arr: &JByteArray) -> Result<Vec<u8>, String> {
    env.convert_byte_array(arr).map_err(|e| e.to_string())
}

fn output(env: &mut JNIEnv, bytes: &[u8]) -> Result<jbyteArray, String> {
    env.byte_array_from_slice(bytes).map(|a| a.into_raw()).map_err(|e| e.to_string())
}

fn input_list(env: &mut JNIEnv, arr: &JObjectArray) -> Result<Vec<Vec<u8>>, String> {
    let len = env.get_array_length(arr).map_err(|e| e.to_string())?;
    let mut out = Vec::with_capacity(len as usize);
    for i in 0..len {
        let item = env.get_object_array_element(arr, i).map_err(|e| e.to_string())?;
        let item = JByteArray::from(item);
        out.push(input(env, &item)?);
        env.delete_local_ref(item).map_err(|e| e.to_string())?;
    }
    Ok(out)
}

fn encode_commit(c: Commit) -> Vec<u8> {
    let mut out = Vec::with_capacity(17 + c.commit.len() + c.welcome.as_ref().map_or(0, Vec::len));
    out.extend_from_slice(&c.epoch.to_be_bytes());
    out.extend_from_slice(&(c.commit.len() as u32).to_be_bytes());
    out.extend_from_slice(&c.commit);
    match c.welcome {
        Some(w) => {
            out.push(1);
            out.extend_from_slice(&w);
        }
        None => out.push(0),
    }
    out
}

const NULL_ARRAY: jbyteArray = std::ptr::null_mut();

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_create<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, identity: JByteArray<'l>,
) -> jlong {
    guard(&mut env, 0, |env| {
        let identity = input(env, &identity)?;
        Ok(Box::into_raw(Box::new(Device::new(&identity)?)) as jlong)
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_restore<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, state: JByteArray<'l>,
) -> jlong {
    guard(&mut env, 0, |env| {
        let state = input(env, &state)?;
        Ok(Box::into_raw(Box::new(Device::restore(&state)?)) as jlong)
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_free<'l>(
    _env: JNIEnv<'l>, _: JClass<'l>, handle: jlong,
) {
    if handle != 0 {
        // SAFETY: see `device`; Kotlin zeroes its handle before calling free, so this runs once.
        drop(unsafe { Box::from_raw(handle as *mut Device) });
    }
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_exportState<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong,
) -> jbyteArray {
    guard(&mut env, NULL_ARRAY, |env| {
        let state = device(handle)?.export_state();
        output(env, &state)
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_identityKey<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong,
) -> jbyteArray {
    guard(&mut env, NULL_ARRAY, |env| {
        let key = device(handle)?.identity_key();
        output(env, &key)
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_keyPackage<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong,
) -> jbyteArray {
    guard(&mut env, NULL_ARRAY, |env| {
        let kp = device(handle)?.key_package()?;
        output(env, &kp)
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_keyPackageIdentity<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong, key_package: JByteArray<'l>,
) -> jbyteArray {
    guard(&mut env, NULL_ARRAY, |env| {
        let kp = input(env, &key_package)?;
        let id = device(handle)?.key_package_identity(&kp)?;
        output(env, &id)
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_hasGroup<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong, group: JByteArray<'l>,
) -> jboolean {
    guard(&mut env, JNI_FALSE, |env| {
        let gid = input(env, &group)?;
        Ok(if device(handle)?.current_epoch(&gid).is_ok() { JNI_TRUE } else { JNI_FALSE })
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_currentEpoch<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong, group: JByteArray<'l>,
) -> jlong {
    guard(&mut env, -1, |env| {
        let gid = input(env, &group)?;
        Ok(device(handle)?.current_epoch(&gid)? as jlong)
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_createGroup<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong, group: JByteArray<'l>,
) -> jlong {
    guard(&mut env, -1, |env| {
        let gid = input(env, &group)?;
        Ok(device(handle)?.create_group(&gid)? as jlong)
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_dropGroup<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong, group: JByteArray<'l>,
) {
    guard(&mut env, (), |env| {
        let gid = input(env, &group)?;
        device(handle)?.drop_group(&gid)
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_addMembers<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong, group: JByteArray<'l>, key_packages: JObjectArray<'l>,
) -> jbyteArray {
    guard(&mut env, NULL_ARRAY, |env| {
        let gid = input(env, &group)?;
        let kps = input_list(env, &key_packages)?;
        let commit = device(handle)?.add_members(&gid, &kps)?;
        output(env, &encode_commit(commit))
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_removeMembers<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong, group: JByteArray<'l>, identities: JObjectArray<'l>,
) -> jbyteArray {
    guard(&mut env, NULL_ARRAY, |env| {
        let gid = input(env, &group)?;
        let ids = input_list(env, &identities)?;
        let commit = device(handle)?.remove_members(&gid, &ids)?;
        output(env, &encode_commit(commit))
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_selfUpdate<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong, group: JByteArray<'l>,
) -> jbyteArray {
    guard(&mut env, NULL_ARRAY, |env| {
        let gid = input(env, &group)?;
        let commit = device(handle)?.self_update(&gid)?;
        output(env, &encode_commit(commit))
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_mergePending<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong, group: JByteArray<'l>,
) -> jlong {
    guard(&mut env, -1, |env| {
        let gid = input(env, &group)?;
        Ok(device(handle)?.merge_pending(&gid)? as jlong)
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_discardPending<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong, group: JByteArray<'l>,
) {
    guard(&mut env, (), |env| {
        let gid = input(env, &group)?;
        device(handle)?.discard_pending(&gid)
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_join<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong, welcome: JByteArray<'l>,
) -> jbyteArray {
    guard(&mut env, NULL_ARRAY, |env| {
        let w = input(env, &welcome)?;
        let gid = device(handle)?.join(&w)?;
        output(env, &gid)
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_processCommit<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong, group: JByteArray<'l>, commit: JByteArray<'l>, sender: JByteArray<'l>,
) -> jlong {
    guard(&mut env, -1, |env| {
        let gid = input(env, &group)?;
        let c = input(env, &commit)?;
        let from = input(env, &sender)?;
        Ok(device(handle)?.process_commit(&gid, &c, &from)? as jlong)
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_groupInfo<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong, group: JByteArray<'l>,
) -> jbyteArray {
    guard(&mut env, NULL_ARRAY, |env| {
        let gid = input(env, &group)?;
        let info = device(handle)?.group_info(&gid)?;
        output(env, &info)
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_joinExternal<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong, group: JByteArray<'l>, info: JByteArray<'l>, epoch: jlong,
) -> jbyteArray {
    guard(&mut env, NULL_ARRAY, |env| {
        let gid = input(env, &group)?;
        let gi = input(env, &info)?;
        let commit = device(handle)?.join_external(&gid, &gi, epoch as u64)?;
        output(env, &encode_commit(commit))
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_epochKey<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong, group: JByteArray<'l>, epoch: jlong,
) -> jbyteArray {
    guard(&mut env, NULL_ARRAY, |env| {
        let gid = input(env, &group)?;
        match device(handle)?.epoch_key(&gid, epoch as u64) {
            Some(k) => output(env, &k),
            None => Ok(NULL_ARRAY),
        }
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_importEpochKey<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong, group: JByteArray<'l>, epoch: jlong, key: JByteArray<'l>,
) {
    guard(&mut env, (), |env| {
        let gid = input(env, &group)?;
        let k = input(env, &key)?;
        device(handle)?.import_epoch_key(&gid, epoch as u64, &k)
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_memberIdentities<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong, group: JByteArray<'l>,
) -> jobjectArray {
    guard(&mut env, std::ptr::null_mut(), |env| {
        let gid = input(env, &group)?;
        let members = device(handle)?.members(&gid)?;
        let arr = env.new_object_array(members.len() as i32, "[B", JObject::null()).map_err(|e| e.to_string())?;
        for (i, (id, _)) in members.iter().enumerate() {
            let item = env.byte_array_from_slice(id).map_err(|e| e.to_string())?;
            env.set_object_array_element(&arr, i as i32, &item).map_err(|e| e.to_string())?;
            env.delete_local_ref(item).map_err(|e| e.to_string())?;
        }
        Ok(arr.into_raw())
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_memberKey<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong, group: JByteArray<'l>, identity: JByteArray<'l>,
) -> jbyteArray {
    guard(&mut env, NULL_ARRAY, |env| {
        let gid = input(env, &group)?;
        let id = input(env, &identity)?;
        match device(handle)?.members(&gid)?.into_iter().find(|(m, _)| *m == id) {
            Some((_, key)) => output(env, &key),
            None => Ok(NULL_ARRAY),
        }
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_encrypt<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong, group: JByteArray<'l>, plaintext: JByteArray<'l>,
) -> jbyteArray {
    guard(&mut env, NULL_ARRAY, |env| {
        let gid = input(env, &group)?;
        let p = input(env, &plaintext)?;
        let frame = device(handle)?.encrypt(&gid, &p)?;
        output(env, &frame)
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_frameSender<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, frame: JByteArray<'l>,
) -> jbyteArray {
    guard(&mut env, NULL_ARRAY, |env| {
        let f = input(env, &frame)?;
        let sender = Device::frame_sender(&f)?;
        output(env, &sender)
    })
}

#[no_mangle]
pub extern "system" fn Java_com_paylogic_humora_pulse_crypto_PulseNative_decrypt<'l>(
    mut env: JNIEnv<'l>, _: JClass<'l>, handle: jlong, group: JByteArray<'l>, frame: JByteArray<'l>, sender_key: JByteArray<'l>,
) -> jbyteArray {
    guard(&mut env, NULL_ARRAY, |env| {
        let gid = input(env, &group)?;
        let f = input(env, &frame)?;
        let key = input(env, &sender_key)?;
        let o = device(handle)?.decrypt(&gid, &f, &key)?;
        let mut out = Vec::with_capacity(12 + o.sender.len() + o.plaintext.len());
        out.extend_from_slice(&o.epoch.to_be_bytes());
        out.extend_from_slice(&(o.sender.len() as u32).to_be_bytes());
        out.extend_from_slice(&o.sender);
        out.extend_from_slice(&o.plaintext);
        output(env, &out)
    })
}
