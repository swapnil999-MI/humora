package com.paylogic.humora.pulse

import android.util.Base64
import java.nio.ByteBuffer
import java.security.SecureRandom
import java.util.UUID

/** Byte and identifier helpers shared by the Pulse client (mirrors web/src/pulse/ids.ts). */
internal object Ids {
    private val random = SecureRandom()

    fun uuidToBytes(id: String): ByteArray {
        val u = UUID.fromString(id)
        return ByteBuffer.allocate(16).putLong(u.mostSignificantBits).putLong(u.leastSignificantBits).array()
    }

    fun bytesToUuid(bytes: ByteArray): String {
        require(bytes.size == 16) { "invalid uuid bytes (${bytes.size})" }
        val b = ByteBuffer.wrap(bytes)
        return UUID(b.long, b.long).toString()
    }

    /** Time-ordered UUID (RFC 9562 v7): message ids sort by creation time. */
    fun uuidv7(now: Long = System.currentTimeMillis()): String {
        val b = ByteArray(16).also { random.nextBytes(it) }
        var ts = now
        for (i in 5 downTo 0) {
            b[i] = (ts and 0xff).toByte()
            ts = ts shr 8
        }
        b[6] = ((b[6].toInt() and 0x0f) or 0x70).toByte()
        b[8] = ((b[8].toInt() and 0x3f) or 0x80).toByte()
        return bytesToUuid(b)
    }

    fun randomBytes(n: Int): ByteArray = ByteArray(n).also { random.nextBytes(it) }

    fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it) }

    fun fromHex(hex: String): ByteArray = ByteArray(hex.length / 2) { hex.substring(it * 2, it * 2 + 2).toInt(16).toByte() }

    fun b64(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)

    fun unb64(text: String): ByteArray = Base64.decode(text, Base64.DEFAULT)

    fun concat(vararg parts: ByteArray): ByteArray {
        val out = ByteArray(parts.sumOf { it.size })
        var off = 0
        for (p in parts) {
            p.copyInto(out, off)
            off += p.size
        }
        return out
    }
}
