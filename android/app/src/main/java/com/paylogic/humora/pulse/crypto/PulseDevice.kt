package com.paylogic.humora.pulse.crypto

import java.io.Closeable
import java.nio.ByteBuffer

/**
 * One installed Pulse client: its MLS signing identity and every group it belongs to.
 * All key material lives inside the native object; [exportState] snapshots it for the
 * encrypted local store and [restore] brings it back. Calls are serialised on this object.
 */
class PulseDevice private constructor(private var handle: Long) : Closeable {

    /** A staged membership change; see PulseClient for the send / merge / welcome protocol. */
    class Commit(val commit: ByteArray, val welcome: ByteArray?, val epoch: Long)

    /** A verified, decrypted frame. */
    class Opened(val sender: ByteArray, val epoch: Long, val plaintext: ByteArray)

    @Synchronized private fun h(): Long = handle.also { if (it == 0L) throw PulseCryptoException("device is closed") }

    @Synchronized fun exportState(): ByteArray = PulseNative.exportState(h())
    @Synchronized fun identityKey(): ByteArray = PulseNative.identityKey(h())
    @Synchronized fun keyPackage(): ByteArray = PulseNative.keyPackage(h())
    @Synchronized fun keyPackageIdentity(keyPackage: ByteArray): ByteArray = PulseNative.keyPackageIdentity(h(), keyPackage)
    @Synchronized fun hasGroup(group: ByteArray): Boolean = PulseNative.hasGroup(h(), group)
    @Synchronized fun currentEpoch(group: ByteArray): Long = PulseNative.currentEpoch(h(), group)
    @Synchronized fun createGroup(group: ByteArray): Long = PulseNative.createGroup(h(), group)
    @Synchronized fun dropGroup(group: ByteArray) = PulseNative.dropGroup(h(), group)
    @Synchronized fun addMembers(group: ByteArray, keyPackages: List<ByteArray>): Commit =
        decodeCommit(PulseNative.addMembers(h(), group, keyPackages.toTypedArray()))
    @Synchronized fun removeMembers(group: ByteArray, identities: List<ByteArray>): Commit =
        decodeCommit(PulseNative.removeMembers(h(), group, identities.toTypedArray()))
    @Synchronized fun selfUpdate(group: ByteArray): Commit = decodeCommit(PulseNative.selfUpdate(h(), group))
    @Synchronized fun mergePending(group: ByteArray): Long = PulseNative.mergePending(h(), group)
    @Synchronized fun discardPending(group: ByteArray) = PulseNative.discardPending(h(), group)
    /** Joins the group a Welcome is for; returns that group's id. */
    @Synchronized fun join(welcome: ByteArray): ByteArray = PulseNative.join(h(), welcome)
    /** Applies another device's commit; [sender] is the identity the server says sent it. */
    @Synchronized fun processCommit(group: ByteArray, commit: ByteArray, sender: ByteArray): Long =
        PulseNative.processCommit(h(), group, commit, sender)
    /** Signed public snapshot of the group, published so other devices can join on their own. */
    @Synchronized fun groupInfo(group: ByteArray): ByteArray = PulseNative.groupInfo(h(), group)
    /**
     * Joins from a published snapshot (MLS external commit). The group is in place on return
     * but must not be used until the server accepts the commit; [dropGroup] it if rejected.
     */
    @Synchronized fun joinExternal(group: ByteArray, info: ByteArray, epoch: Long): Commit =
        decodeCommit(PulseNative.joinExternal(h(), group, info, epoch))
    @Synchronized fun epochKey(group: ByteArray, epoch: Long): ByteArray? = PulseNative.epochKey(h(), group, epoch)
    @Synchronized fun importEpochKey(group: ByteArray, epoch: Long, key: ByteArray) = PulseNative.importEpochKey(h(), group, epoch, key)
    @Synchronized fun memberIdentities(group: ByteArray): List<ByteArray> = PulseNative.memberIdentities(h(), group).toList()
    /** Signature key of a current member, or null if that identity is not in the group. */
    @Synchronized fun memberKey(group: ByteArray, identity: ByteArray): ByteArray? = PulseNative.memberKey(h(), group, identity)
    @Synchronized fun encrypt(group: ByteArray, plaintext: ByteArray): ByteArray = PulseNative.encrypt(h(), group, plaintext)
    @Synchronized fun decrypt(group: ByteArray, frame: ByteArray, senderKey: ByteArray): Opened {
        val buf = ByteBuffer.wrap(PulseNative.decrypt(h(), group, frame, senderKey))
        val epoch = buf.long
        val sender = ByteArray(buf.int).also { buf.get(it) }
        val plaintext = ByteArray(buf.remaining()).also { buf.get(it) }
        return Opened(sender, epoch, plaintext)
    }

    @Synchronized override fun close() {
        val h = handle
        handle = 0
        if (h != 0L) PulseNative.free(h)
    }

    companion object {
        fun create(identity: ByteArray) = PulseDevice(PulseNative.create(identity))
        fun restore(state: ByteArray) = PulseDevice(PulseNative.restore(state))
        /** The identity (user id ‖ device id) that signed a frame, read without decrypting it. */
        fun frameSender(frame: ByteArray): ByteArray = PulseNative.frameSender(frame)

        private fun decodeCommit(bytes: ByteArray): Commit {
            val buf = ByteBuffer.wrap(bytes)
            val epoch = buf.long
            val commit = ByteArray(buf.int).also { buf.get(it) }
            val welcome = if (buf.get().toInt() == 1) ByteArray(buf.remaining()).also { buf.get(it) } else null
            return Commit(commit, welcome, epoch)
        }
    }
}
