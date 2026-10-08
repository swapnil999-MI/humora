package com.paylogic.humora.pulse.store

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import androidx.room.Upsert
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import net.zetetic.database.sqlcipher.SupportOpenHelperFactory
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// Local persistence for the Pulse client (mirrors web/src/pulse/storage.ts). Messages are kept
// decrypted on the device so chats open instantly and work offline; the server only holds
// ciphertext. The whole database is encrypted with SQLCipher under a key sealed by the
// Android Keystore, and it also holds this device's MLS key material.

@Serializable
data class LocalTag(val type: Int, val id: String, val offset: Int, val length: Int, val title: String, val status: String)

@Entity(
    tableName = "messages",
    primaryKeys = ["conversationId", "id"],
    indices = [Index(value = ["conversationId", "sortOrder"])],
)
data class LocalMessage(
    val conversationId: String,
    val id: String,
    /** Server sequence number; null until the server has stored the message. */
    val seq: Long?,
    /** Sort key: seq once stored, otherwise [pendingOrder] so unsent messages stay last. */
    val sortOrder: Long,
    val senderId: String,
    val senderDeviceId: String,
    /** Unix ms: server time once stored, local time before that. */
    val ts: Long,
    /** pending | sent | failed */
    val status: String,
    val text: String,
    /** Serialized pulse.v1.Media, or null for text messages. */
    val media: ByteArray? = null,
    val replyToId: String? = null,
    val threadRootId: String? = null,
    val tags: List<LocalTag> = emptyList(),
    /** userId -> emoji. */
    val reactions: Map<String, String> = emptyMap(),
    val edited: Boolean = false,
    val deleted: Boolean = false,
    /** Stored on the server but this device has no key for it (yet). */
    val unavailable: Boolean = false,
) {
    // ByteArray fields make the generated equals reference-based; compare what the UI depends on.
    override fun equals(other: Any?): Boolean =
        other is LocalMessage && other.conversationId == conversationId && other.id == id && other.seq == seq &&
            other.status == status && other.text == text && other.reactions == reactions && other.edited == edited &&
            other.deleted == deleted && other.unavailable == unavailable && other.ts == ts &&
            (other.media?.contentEquals(media) ?: (media == null))

    override fun hashCode(): Int = id.hashCode()
}

fun pendingOrder(createdAt: Long): Long = 1_000_000_000_000_000L + createdAt

@Entity(tableName = "outbox")
class OutboxItem(
    @PrimaryKey val id: String,
    val conversationId: String,
    /** Serialized, not yet encrypted Content: sealed at send time with the then-current key. */
    val content: ByteArray,
    val createdAt: Long,
)

@Entity(tableName = "kv")
class KvEntry(@PrimaryKey val key: String, val value: ByteArray)

class PulseConverters {
    private val json = Json { ignoreUnknownKeys = true }

    @TypeConverter fun tagsToText(v: List<LocalTag>): String = json.encodeToString(v)
    @TypeConverter fun textToTags(v: String): List<LocalTag> = json.decodeFromString(v)
    @TypeConverter fun reactionsToText(v: Map<String, String>): String = json.encodeToString(v)
    @TypeConverter fun textToReactions(v: String): Map<String, String> = json.decodeFromString(v)
}

@Dao
interface PulseDao {
    @Upsert suspend fun putMessage(message: LocalMessage)

    @Query("SELECT * FROM messages WHERE conversationId = :conversationId AND id = :id")
    suspend fun getMessage(conversationId: String, id: String): LocalMessage?

    @Query("DELETE FROM messages WHERE conversationId = :conversationId AND id = :id")
    suspend fun deleteMessage(conversationId: String, id: String)

    /** Newest [limit] messages below [beforeOrder], newest first (callers reverse). */
    @Query("SELECT * FROM messages WHERE conversationId = :conversationId AND sortOrder < :beforeOrder ORDER BY sortOrder DESC LIMIT :limit")
    suspend fun listMessagesDesc(conversationId: String, beforeOrder: Long, limit: Int): List<LocalMessage>

    @Query("SELECT * FROM messages WHERE conversationId = :conversationId AND unavailable = 0 ORDER BY sortOrder DESC LIMIT 1")
    suspend fun lastMessage(conversationId: String): LocalMessage?

    @Query("SELECT COUNT(*) FROM messages WHERE conversationId = :conversationId AND seq > :readSeq AND senderId != :me AND deleted = 0")
    suspend fun unreadCount(conversationId: String, readSeq: Long, me: String): Int

    @Query("SELECT * FROM messages WHERE deleted = 0 AND text LIKE '%' || :query || '%' ESCAPE '\\' ORDER BY ts DESC LIMIT :limit")
    suspend fun search(query: String, limit: Int): List<LocalMessage>

    @Upsert suspend fun putOutbox(item: OutboxItem)

    @Query("DELETE FROM outbox WHERE id = :id")
    suspend fun deleteOutbox(id: String)

    @Query("SELECT * FROM outbox ORDER BY createdAt ASC")
    suspend fun listOutbox(): List<OutboxItem>

    @Query("SELECT value FROM kv WHERE `key` = :key")
    suspend fun kvGet(key: String): ByteArray?

    @Upsert suspend fun kvPut(entry: KvEntry)

    @Query("DELETE FROM kv WHERE `key` = :key")
    suspend fun kvDelete(key: String)
}

@Database(entities = [LocalMessage::class, OutboxItem::class, KvEntry::class], version = 1, exportSchema = false)
@TypeConverters(PulseConverters::class)
abstract class PulseDatabase : RoomDatabase() {
    abstract fun dao(): PulseDao
}

/** Typed access to the encrypted store. One instance per signed-in user. */
class PulseStore private constructor(private val db: PulseDatabase) {
    private val dao = db.dao()

    suspend fun get(key: String): ByteArray? = dao.kvGet(key)
    suspend fun set(key: String, value: ByteArray?) {
        if (value == null) dao.kvDelete(key) else dao.kvPut(KvEntry(key, value))
    }
    suspend fun getString(key: String): String? = get(key)?.decodeToString()
    suspend fun setString(key: String, value: String?) = set(key, value?.encodeToByteArray())
    suspend fun getLong(key: String): Long? = getString(key)?.toLongOrNull()
    suspend fun setLong(key: String, value: Long) = setString(key, value.toString())

    /**
     * Like [set], but on disk before it returns. Commits normally skip the flush (they survive the
     * app being killed, and anything lost to a power cut is fetched again from the server); key
     * material cannot be fetched again, so it is flushed before the server is told it was applied.
     */
    suspend fun setDurable(key: String, value: ByteArray?) {
        set(key, value)
        withContext(Dispatchers.IO) {
            db.openHelper.writableDatabase.query("PRAGMA wal_checkpoint(FULL)").use { it.moveToFirst() }
        }
    }

    suspend fun putMessage(m: LocalMessage) = dao.putMessage(m)
    suspend fun getMessage(conversationId: String, id: String) = dao.getMessage(conversationId, id)
    suspend fun deleteMessage(conversationId: String, id: String) = dao.deleteMessage(conversationId, id)
    /** Newest [limit] messages below [beforeOrder], returned oldest first. */
    suspend fun listMessages(conversationId: String, beforeOrder: Long = Long.MAX_VALUE, limit: Int = 100) =
        dao.listMessagesDesc(conversationId, beforeOrder, limit).asReversed()
    suspend fun lastMessage(conversationId: String) = dao.lastMessage(conversationId)
    suspend fun unreadCount(conversationId: String, readSeq: Long, me: String) = dao.unreadCount(conversationId, readSeq, me)
    suspend fun search(query: String, limit: Int = 50): List<LocalMessage> {
        val escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        return dao.search(escaped, limit)
    }

    suspend fun putOutbox(item: OutboxItem) = dao.putOutbox(item)
    suspend fun deleteOutbox(id: String) = dao.deleteOutbox(id)
    suspend fun listOutbox() = dao.listOutbox()

    fun close() = db.close()

    companion object {
        private const val TAG = "PulseStore"

        fun fileName(userId: String) = "pulse-$userId.db"

        fun open(context: Context, userId: String): PulseStore {
            System.loadLibrary("sqlcipher")
            val passphrase = try {
                StoreKey.passphrase(context, userId)
            } catch (e: Exception) {
                // The Keystore key is gone (e.g. the OS cleared it), so the database can never be
                // opened again. Start over: the server still has every message as ciphertext, and
                // this install registers as a new device.
                Log.w(TAG, "store key unavailable; resetting local Pulse store", e)
                destroy(context, userId)
                StoreKey.passphrase(context, userId)
            }
            val db = Room.databaseBuilder(context.applicationContext, PulseDatabase::class.java, fileName(userId))
                .openHelperFactory(SupportOpenHelperFactory(passphrase))
                .setJournalMode(RoomDatabase.JournalMode.WRITE_AHEAD_LOGGING)
                // No flush per commit: a received or sent message costs microseconds, not a flash write.
                .addCallback(object : RoomDatabase.Callback() {
                    override fun onOpen(db: SupportSQLiteDatabase) {
                        db.query("PRAGMA synchronous = NORMAL").use { it.moveToFirst() }
                    }
                })
                // Deliberately no destructive migration: this database holds the device's keys.
                .build()
            return PulseStore(db)
        }

        /** Deletes the user's local Pulse data and its key (sign-out). */
        fun destroy(context: Context, userId: String) {
            context.deleteDatabase(fileName(userId))
            StoreKey.forget(context, userId)
        }
    }
}

/** A random database passphrase per user, sealed with an AES key that never leaves the Android Keystore. */
private object StoreKey {
    private const val ALIAS = "humora_pulse_store_v1"
    private const val PREFS = "humora_pulse_keys"

    fun passphrase(context: Context, userId: String): ByteArray {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val stored = prefs.getString("db_$userId", null)
        if (stored != null) {
            val blob = Base64.decode(stored, Base64.NO_WRAP)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, blob, 0, 12))
            return cipher.doFinal(blob, 12, blob.size - 12)
        }
        val passphrase = ByteArray(32).also { java.security.SecureRandom().nextBytes(it) }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val sealed = cipher.iv + cipher.doFinal(passphrase)
        prefs.edit().putString("db_$userId", Base64.encodeToString(sealed, Base64.NO_WRAP)).commit()
        return passphrase
    }

    fun forget(context: Context, userId: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("db_$userId").commit()
    }

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return gen.generateKey()
    }
}
