package com.paylogic.humora.pulse

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import com.google.protobuf.ByteString
import com.paylogic.humora.pulse.v1.Media
import com.paylogic.humora.pulse.v1.MediaKind
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.security.DigestInputStream
import java.security.DigestOutputStream
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.CipherInputStream
import javax.crypto.CipherOutputStream
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Encrypted attachments (mirrors sendMedia/loadMedia in web/src/pulse/client.ts). A file is sealed on
 * this device with a one-off AES-256-GCM key, uploaded as an opaque blob, and the key travels inside
 * the end-to-end encrypted message, so the storage server never sees the content.
 */
class PulseMedia internal constructor(
    private val context: Context,
    private val api: PulseApi,
    private val http: OkHttpClient,
) {
    private val cacheDir = File(context.cacheDir, "pulse-media").apply { mkdirs() }

    /** What the picker gave us, read before encrypting. */
    data class Picked(val name: String, val mime: String, val size: Long)

    fun describe(uri: Uri): Picked {
        var name = "file"
        var size = -1L
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
            if (c.moveToFirst()) {
                name = c.getString(0) ?: name
                if (!c.isNull(1)) size = c.getLong(1)
            }
        }
        val mime = context.contentResolver.getType(uri) ?: "application/octet-stream"
        return Picked(name, mime, size)
    }

    /**
     * Encrypts and uploads [uri], returning the Media description to send in a message.
     * [waveform] and [durationMs] are for voice notes.
     */
    internal suspend fun upload(
        conversationId: String,
        uri: Uri,
        kind: MediaKind,
        caption: String = "",
        durationMs: Int = 0,
        waveform: ByteArray? = null,
        fileName: String? = null,
        mimeType: String? = null,
    ): Media = withContext(Dispatchers.IO) {
        val described = describe(uri)
        val picked = described.copy(name = fileName ?: described.name, mime = mimeType ?: described.mime)
        val key = Ids.randomBytes(32)
        val nonce = Ids.randomBytes(12)
        val sealed = File.createTempFile("up-", ".bin", cacheDir)
        try {
            // Encrypt to a temp file while hashing the ciphertext.
            val digest = MessageDigest.getInstance("SHA-256")
            var plainSize = 0L
            val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
                init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(128, nonce))
            }
            context.contentResolver.openInputStream(uri).use { input ->
                input ?: throw IOException("cannot read the selected file")
                CipherOutputStream(DigestOutputStream(sealed.outputStream().buffered(), digest), cipher).use { out ->
                    val buf = ByteArray(64 * 1024)
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        plainSize += n
                        out.write(buf, 0, n)
                    }
                }
            }
            if (sealed.length() > MAX_MEDIA_BYTES) throw IOException("File is larger than 100 MB")

            val slot = api.mediaUploadSlot(conversationId, sealed.length())
            val form = MultipartBody.Builder().setType(MultipartBody.FORM).apply {
                for ((k, v) in slot.fields) addFormDataPart(k, v)
                // The file part must come last.
                addFormDataPart("file", "blob", sealed.asRequestBody("application/octet-stream".toMediaType()))
            }.build()
            http.newCall(Request.Builder().url(slot.url).post(form).build()).execute().use {
                if (!it.isSuccessful) throw IOException("Upload failed (${it.code})")
            }

            var width = 0
            var height = 0
            var thumbnail: ByteArray? = null
            if (kind == MediaKind.MEDIA_KIND_IMAGE) {
                imagePreview(uri)?.let { (t, w, h) ->
                    thumbnail = t
                    width = w
                    height = h
                }
            }

            val media = Media.newBuilder()
                .setKind(kind)
                .setObjectKey(slot.objectKey)
                .setKey(ByteString.copyFrom(key))
                .setNonce(ByteString.copyFrom(nonce))
                .setSha256(ByteString.copyFrom(digest.digest()))
                .setSizeBytes(plainSize)
                .setMimeType(picked.mime)
                .setFileName(picked.name)
                .setWidth(width)
                .setHeight(height)
                .setDurationMs(durationMs)
                .setCaption(caption)
            thumbnail?.let { media.setThumbnail(ByteString.copyFrom(it)) }
            waveform?.let { media.setWaveform(ByteString.copyFrom(it)) }
            media.build()
        } finally {
            sealed.delete()
        }
    }

    /** The decrypted file for a message's attachment, downloading and verifying it on first use. */
    internal suspend fun open(conversationId: String, messageId: String, media: Media): File = withContext(Dispatchers.IO) {
        val target = File(cacheDir, "$messageId-${safeName(media.fileName)}")
        if (target.exists() && target.length() > 0) return@withContext target

        val url = api.mediaDownloadUrl(conversationId, media.objectKey)
        val sealed = File.createTempFile("down-", ".bin", cacheDir)
        try {
            val digest = MessageDigest.getInstance("SHA-256")
            http.newCall(Request.Builder().url(url).build()).execute().use { res ->
                if (!res.isSuccessful) throw IOException("Download failed (${res.code})")
                DigestInputStream(res.body!!.byteStream(), digest).use { input ->
                    sealed.outputStream().buffered().use { input.copyTo(it) }
                }
            }
            // The hash came inside the signed message, so a swapped or corrupted blob is caught here.
            if (!MessageDigest.isEqual(digest.digest(), media.sha256.toByteArray())) {
                throw IOException("Attachment failed its integrity check")
            }
            val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
                init(Cipher.DECRYPT_MODE, SecretKeySpec(media.key.toByteArray(), "AES"), GCMParameterSpec(128, media.nonce.toByteArray()))
            }
            val partial = File(cacheDir, target.name + ".part")
            CipherInputStream(sealed.inputStream().buffered(), cipher).use { input ->
                partial.outputStream().buffered().use { input.copyTo(it) }
            }
            if (!partial.renameTo(target)) throw IOException("could not store the attachment")
            target
        } finally {
            sealed.delete()
        }
    }

    /** Removes every decrypted attachment (sign-out). */
    fun clearCache() {
        cacheDir.deleteRecursively()
    }

    private fun safeName(name: String) = name.replace(Regex("[^A-Za-z0-9._-]"), "_").takeLast(60).ifBlank { "file" }

    /** A small JPEG preview (it travels inside the message) and the original dimensions. */
    private fun imagePreview(uri: Uri): Triple<ByteArray, Int, Int>? = runCatching {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        val w = bounds.outWidth
        val h = bounds.outHeight
        if (w <= 0 || h <= 0) return@runCatching null
        var sample = 1
        while (maxOf(w, h) / (sample * 2) >= PREVIEW_PX) sample *= 2
        val bitmap = context.contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
        } ?: return@runCatching null
        val scale = PREVIEW_PX.toFloat() / maxOf(bitmap.width, bitmap.height)
        val small = if (scale < 1f) Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt().coerceAtLeast(1), (bitmap.height * scale).toInt().coerceAtLeast(1), true) else bitmap
        var quality = 70
        var bytes: ByteArray
        do {
            bytes = ByteArrayOutputStream().also { small.compress(Bitmap.CompressFormat.JPEG, quality, it) }.toByteArray()
            quality -= 15
        } while (bytes.size > MAX_INLINE_PREVIEW_BYTES && quality > 10)
        if (bytes.size > MAX_INLINE_PREVIEW_BYTES) null else Triple(bytes, w, h)
    }.getOrNull()

    companion object {
        /** Largest attachment the server accepts, after encryption. */
        const val MAX_MEDIA_BYTES = 100L * 1024 * 1024
        private const val MAX_INLINE_PREVIEW_BYTES = 24 * 1024
        private const val PREVIEW_PX = 160
    }
}
