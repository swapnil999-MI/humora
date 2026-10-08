package com.paylogic.humora.pulse.crypto

/** Thrown by the native encryption core for any failure (bad frame, unknown group, closed handle...). */
class PulseCryptoException(message: String) : RuntimeException(message)

/**
 * JNI entry points into crypto/pulse-crypto (Rust). Use [PulseDevice], which owns the handle
 * and decodes the structured results; these signatures must match src/android.rs exactly.
 */
internal object PulseNative {
    init {
        System.loadLibrary("pulse_crypto")
    }

    @JvmStatic external fun create(identity: ByteArray): Long
    @JvmStatic external fun restore(state: ByteArray): Long
    @JvmStatic external fun free(handle: Long)
    @JvmStatic external fun exportState(handle: Long): ByteArray
    @JvmStatic external fun identityKey(handle: Long): ByteArray
    @JvmStatic external fun keyPackage(handle: Long): ByteArray
    @JvmStatic external fun keyPackageIdentity(handle: Long, keyPackage: ByteArray): ByteArray
    @JvmStatic external fun hasGroup(handle: Long, group: ByteArray): Boolean
    @JvmStatic external fun currentEpoch(handle: Long, group: ByteArray): Long
    @JvmStatic external fun createGroup(handle: Long, group: ByteArray): Long
    @JvmStatic external fun dropGroup(handle: Long, group: ByteArray)
    @JvmStatic external fun addMembers(handle: Long, group: ByteArray, keyPackages: Array<ByteArray>): ByteArray
    @JvmStatic external fun removeMembers(handle: Long, group: ByteArray, identities: Array<ByteArray>): ByteArray
    @JvmStatic external fun selfUpdate(handle: Long, group: ByteArray): ByteArray
    @JvmStatic external fun mergePending(handle: Long, group: ByteArray): Long
    @JvmStatic external fun discardPending(handle: Long, group: ByteArray)
    @JvmStatic external fun join(handle: Long, welcome: ByteArray): ByteArray
    @JvmStatic external fun processCommit(handle: Long, group: ByteArray, commit: ByteArray): Long
    @JvmStatic external fun epochKey(handle: Long, group: ByteArray, epoch: Long): ByteArray?
    @JvmStatic external fun importEpochKey(handle: Long, group: ByteArray, epoch: Long, key: ByteArray)
    @JvmStatic external fun memberIdentities(handle: Long, group: ByteArray): Array<ByteArray>
    @JvmStatic external fun memberKey(handle: Long, group: ByteArray, identity: ByteArray): ByteArray?
    @JvmStatic external fun encrypt(handle: Long, group: ByteArray, plaintext: ByteArray): ByteArray
    @JvmStatic external fun frameSender(frame: ByteArray): ByteArray
    @JvmStatic external fun decrypt(handle: Long, group: ByteArray, frame: ByteArray, senderKey: ByteArray): ByteArray
}
