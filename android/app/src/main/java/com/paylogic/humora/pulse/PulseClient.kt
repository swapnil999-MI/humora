package com.paylogic.humora.pulse

import android.util.Log
import com.google.protobuf.ByteString
import com.paylogic.humora.pulse.crypto.PulseDevice
import com.paylogic.humora.pulse.store.LocalMessage
import com.paylogic.humora.pulse.store.LocalTag
import com.paylogic.humora.pulse.store.OutboxItem
import com.paylogic.humora.pulse.store.PulseStore
import com.paylogic.humora.pulse.store.pendingOrder
import com.paylogic.humora.pulse.v1.Content
import com.paylogic.humora.pulse.v1.Delete
import com.paylogic.humora.pulse.v1.Direct
import com.paylogic.humora.pulse.v1.DirectAck
import com.paylogic.humora.pulse.v1.DirectSend
import com.paylogic.humora.pulse.v1.Edit
import com.paylogic.humora.pulse.v1.Envelope
import com.paylogic.humora.pulse.v1.Media
import com.paylogic.humora.pulse.v1.MessageKind
import com.paylogic.humora.pulse.v1.Reaction
import com.paylogic.humora.pulse.v1.Send
import com.paylogic.humora.pulse.v1.ServerFrame
import com.paylogic.humora.pulse.v1.Sync
import com.paylogic.humora.pulse.v1.Tag
import com.paylogic.humora.pulse.v1.Text
import com.paylogic.humora.pulse.v1.Typing
import com.paylogic.humora.pulse.v1.Watermark
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import java.nio.ByteBuffer
import java.time.Instant
import java.util.UUID
import kotlin.random.Random

sealed interface PulseEvent {
    data class Connection(val connected: Boolean) : PulseEvent
    data object Conversations : PulseEvent
    data class Messages(val conversationId: String) : PulseEvent
    data class Typing(val conversationId: String, val userId: String, val active: Boolean) : PulseEvent
}

/** pending: not on the server yet. sent: one tick. delivered: two ticks. read: blue ticks. */
enum class Tick { PENDING, FAILED, SENT, DELIVERED, READ }

/** Optional extras for an outgoing message. */
data class SendOptions(val replyToId: String? = null, val threadRootId: String? = null, val tags: List<LocalTag> = emptyList())

/**
 * The end-to-end encrypted messaging engine for one signed-in user on this device (a port of
 * web/src/pulse/client.ts, which is the reference for the protocol). It owns the device keys, the
 * gateway socket, the local message store and the outbox, and exposes decrypted messages.
 *
 * Every state change runs on one serial queue ([run] / [enqueue]), so frames from the server, user
 * actions and background maintenance never interleave. Tasks on the queue must not call [onQueue].
 */
class PulseClient internal constructor(
    val userId: String,
    private val store: PulseStore,
    private val api: PulseApi,
    private val http: OkHttpClient,
    private val deviceName: String,
    internal val media: PulseMedia,
) {
    var deviceId: String = ""
        private set

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val queue = Channel<suspend () -> Unit>(Channel.UNLIMITED)
    private lateinit var device: PulseDevice
    private lateinit var identity: ByteArray
    private var socket: PulseSocket? = null

    private val convs = LinkedHashMap<String, PulseConversation>()
    private val cursors = HashMap<String, Long>()
    private val senderKeys = HashMap<String, ByteArray>()
    private val refreshJobs = HashMap<String, Job>()
    @Volatile private var stopped = false

    private val _events = MutableSharedFlow<PulseEvent>(extraBufferCapacity = 256, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    val events: SharedFlow<PulseEvent> = _events.asSharedFlow()

    private val _conversations = MutableStateFlow<List<PulseConversation>>(emptyList())
    /** Snapshot of the conversations, most recently active first. */
    val conversations: StateFlow<List<PulseConversation>> = _conversations.asStateFlow()

    private val _connected = MutableStateFlow(false)
    val connected: StateFlow<Boolean> = _connected.asStateFlow()

    private val json = Json { ignoreUnknownKeys = true }
    @Volatile private var lastCaughtUpAt = 0L

    init {
        scope.launch {
            for (task in queue) {
                try {
                    task()
                } catch (e: Throwable) {
                    if (!stopped && !isTransient(e)) Log.e(TAG, "task failed", e)
                    else if (com.paylogic.humora.BuildConfig.DEBUG) Log.d(TAG, "task failed (transient): $e")
                }
            }
        }
    }

    // ───────────────────────────── Lifecycle ─────────────────────────────

    /** Loads (or creates and registers) this device, then connects. Retries quietly while offline. */
    fun start() {
        scope.launch {
            var attempt = 0
            while (!stopped) {
                try {
                    onQueue { loadDevice() }
                    break
                } catch (e: Throwable) {
                    if (!isTransient(e)) Log.e(TAG, "could not set up this device", e)
                    delay(minOf(30_000L, 1_000L shl minOf(attempt++, 5)))
                }
            }
            if (stopped) return@launch
            socket = PulseSocket(
                http, scope,
                getUrl = { api.gatewayUrl(api.wsTicket(deviceId)) },
                onOpen = {
                    // Queue the resync before announcing the connection, so anyone waiting for
                    // "connected" and then for the queue sees a fully synced state.
                    enqueue { resync() }
                    _connected.value = true
                    emit(PulseEvent.Connection(true))
                },
                onClose = {
                    _connected.value = false
                    emit(PulseEvent.Connection(false))
                },
                onFrame = { frame -> enqueue { handleFrame(frame) } },
            ).also { if (foreground) it.start() }
        }
    }

    fun stop() {
        stopped = true
        socket?.stop()
        scope.cancel()
        queue.close()
        if (::device.isInitialized) device.close()
    }

    /** The network came back: reconnect now instead of waiting out the backoff. */
    fun onNetworkAvailable() {
        socket?.reconnectNow()
    }

    /**
     * Connects (even in the background), waits until every conversation is caught up, and returns
     * whether that happened within [timeoutMs]. Used when a push wakes the app. The connection is
     * dropped again afterwards if the app is not in the foreground.
     */
    suspend fun syncNow(timeoutMs: Long = 20_000): Boolean {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (socket == null && System.currentTimeMillis() < deadline) delay(100) // device still loading
        val s = socket ?: return false
        val startedAt = System.nanoTime()
        val wasForeground = foreground
        if (!s.connected) s.start()
        val ok = kotlinx.coroutines.withTimeoutOrNull(maxOf(0, deadline - System.currentTimeMillis())) {
            connected.first { it }
            onQueue { } // everything queued before this point, including the resync, has run
            lastCaughtUpAt >= startedAt || run {
                // The resync failed (e.g. the connection dropped); give it one more chance.
                connected.first { it }
                onQueue { }
                lastCaughtUpAt >= startedAt
            }
        } ?: false
        if (!wasForeground && !foreground) s.stop()
        return ok
    }

    /** New messages from other people in [conversationId] that the user has neither read nor been notified about. */
    suspend fun unnotifiedMessages(conversationId: String): List<LocalMessage> {
        val me = conversation(conversationId)?.members?.firstOrNull { it.userId == userId } ?: return emptyList()
        val after = maxOf(me.readSeq, store.getLong("notified:$conversationId") ?: 0L)
        return store.listMessages(conversationId, limit = 50)
            .filter { (it.seq ?: 0) > after && it.senderId != userId && !it.deleted }
    }

    suspend fun markNotified(conversationId: String, seq: Long) = store.setLong("notified:$conversationId", seq)

    /** Registers (or with "" removes) this device's push token, so the server can wake it. */
    suspend fun setPushToken(token: String) {
        if (deviceId.isNotBlank()) api.setPushToken(deviceId, token)
    }

    /** Holds the gateway connection only while the app is in use; the store keeps working either way. */
    @Volatile private var foreground = true

    fun setForeground(active: Boolean) {
        foreground = active
        val s = socket ?: return
        if (active) s.start() else s.stop()
    }

    private fun emit(e: PulseEvent) {
        _events.tryEmit(e)
    }

    /**
     * Runs [task] on the serial queue and returns its result. Deliberately not called `run`: that name
     * silently resolves to Kotlin's own scope function, which would bypass the queue.
     */
    private suspend fun <T> onQueue(task: suspend () -> T): T {
        val result = CompletableDeferred<T>()
        queue.send {
            try {
                result.complete(task())
            } catch (e: Throwable) {
                result.completeExceptionally(e)
            }
        }
        return result.await()
    }

    private fun enqueue(task: suspend () -> Unit) {
        queue.trySend(task)
    }

    private suspend fun loadDevice() {
        if (::device.isInitialized) return
        val state = store.get(K_DEVICE)
        val id = store.getString(K_DEVICE_ID)
        for (c in store.get(K_CONVERSATIONS)?.let { json.decodeFromString(ListSerializer(PulseConversation.serializer()), it.decodeToString()) }.orEmpty()) {
            convs[c.id] = c
        }
        publishConversations()

        if (state != null && id != null) {
            deviceId = id
            identity = Ids.concat(Ids.uuidToBytes(userId), Ids.uuidToBytes(id))
            device = PulseDevice.restore(state)
        } else {
            // The device id is part of the encryption credential, so it is chosen here.
            deviceId = UUID.randomUUID().toString()
            identity = Ids.concat(Ids.uuidToBytes(userId), Ids.uuidToBytes(deviceId))
            device = PulseDevice.create(identity)
            persist()
            store.setString(K_DEVICE_ID, deviceId)
        }

        if (store.getString(K_REGISTERED) != "1") {
            val keyPackages = newKeyPackages(KEY_PACKAGE_BATCH)
            persist()
            try {
                api.registerDevice(deviceId, deviceName, device.identityKey(), keyPackages)
            } catch (e: PulseHttpException) {
                // A previous attempt got through but was interrupted before we recorded it.
                if (!(e.message ?: "").contains("already registered")) throw e
            }
            store.setString(K_REGISTERED, "1")
        }
    }

    private fun newKeyPackages(n: Int): List<String> = List(n) { Ids.b64(device.keyPackage()) }

    /** Writes the device's key material to the encrypted store. Called after every change to it. */
    private suspend fun persist() = store.setDurable(K_DEVICE, device.exportState())

    /** Unregisters this device on the server (sign-out). Best effort. */
    suspend fun revokeDevice() {
        if (deviceId.isNotBlank()) runCatching { api.revokeDevice(deviceId) }
    }

    // ───────────────────────────── Read API ─────────────────────────────

    fun conversation(id: String): PulseConversation? = _conversations.value.firstOrNull { it.id == id }

    suspend fun messages(conversationId: String, beforeOrder: Long = Long.MAX_VALUE, limit: Int = 100): List<LocalMessage> =
        store.listMessages(conversationId, beforeOrder, limit)

    suspend fun message(conversationId: String, id: String): LocalMessage? = store.getMessage(conversationId, id)

    suspend fun lastMessage(conversationId: String): LocalMessage? = store.lastMessage(conversationId)

    suspend fun searchMessages(query: String): List<LocalMessage> = store.search(query)

    /** Messages from other people after this user's read position. */
    suspend fun unreadCount(conversationId: String): Int {
        val me = conversation(conversationId)?.members?.firstOrNull { it.userId == userId } ?: return 0
        return store.unreadCount(conversationId, me.readSeq, userId)
    }

    /** Tick state of one of the user's own messages. */
    fun tick(message: LocalMessage): Tick {
        when (message.status) {
            "pending" -> return Tick.PENDING
            "failed" -> return Tick.FAILED
        }
        val seq = message.seq ?: return Tick.SENT
        val others = conversation(message.conversationId)?.members?.filter { it.userId != userId }.orEmpty()
        if (others.isEmpty()) return Tick.SENT
        if (others.all { it.readSeq >= seq }) return Tick.READ
        if (others.all { it.deliveredSeq >= seq }) return Tick.DELIVERED
        return Tick.SENT
    }

    // ───────────────────────────── Write API ─────────────────────────────

    /** Creates a conversation (or returns the existing DM) and sets up its encryption. */
    suspend fun createConversation(kind: String, memberIds: List<String>, name: String = "", topic: String = "", isPrivate: Boolean = true): PulseConversation {
        val conv = api.createConversation(kind, memberIds, name, topic, isPrivate)
        onQueue {
            convs[conv.id] = conv
            saveConversations()
            try {
                setUp(listOf(conv))
            } catch (e: Throwable) {
                if (!isTransient(e)) throw e
                // Offline: the next resync finishes the setup.
            }
        }
        return conversation(conv.id) ?: conv
    }

    suspend fun sendText(conversationId: String, text: String, opts: SendOptions = SendOptions()): String =
        submit(conversationId, Content.newBuilder().setText(Text.newBuilder().setBody(text)), opts)

    /** Sends an already-encrypted, uploaded attachment (see [PulseMedia.upload]). */
    internal suspend fun sendMedia(conversationId: String, media: Media, opts: SendOptions = SendOptions()): String =
        submit(conversationId, Content.newBuilder().setMedia(media), opts)

    /** Sets this user's reaction on a message; an empty emoji removes it. */
    suspend fun react(conversationId: String, targetId: String, emoji: String): String =
        submit(conversationId, Content.newBuilder().setReaction(Reaction.newBuilder().setTargetId(bs(Ids.uuidToBytes(targetId))).setEmoji(emoji)))

    suspend fun editMessage(conversationId: String, targetId: String, text: String): String =
        submit(conversationId, Content.newBuilder().setEdit(Edit.newBuilder().setTargetId(bs(Ids.uuidToBytes(targetId))).setText(Text.newBuilder().setBody(text))))

    suspend fun deleteMessage(conversationId: String, targetId: String): String =
        submit(conversationId, Content.newBuilder().setDelete(Delete.newBuilder().setTargetId(bs(Ids.uuidToBytes(targetId)))))

    /** Marks everything received so far as read (blue ticks for the senders). */
    fun markRead(conversationId: String) = enqueue {
        val conv = convs[conversationId] ?: return@enqueue
        val me = conv.members.firstOrNull { it.userId == userId } ?: return@enqueue
        val cursor = cursor(conversationId)
        if (me.readSeq >= cursor) return@enqueue
        me.readSeq = cursor
        me.deliveredSeq = maxOf(me.deliveredSeq, cursor)
        socket?.notify { setRead(Watermark.newBuilder().setConversationId(bs(Ids.uuidToBytes(conversationId))).setSeq(cursor)) }
        publishConversations()
    }

    fun setTyping(conversationId: String, active: Boolean) {
        socket?.notify { setTyping(Typing.newBuilder().setConversationId(bs(Ids.uuidToBytes(conversationId))).setActive(active)) }
    }

    private suspend fun submit(conversationId: String, body: Content.Builder, opts: SendOptions = SendOptions()): String {
        val id = Ids.uuidv7()
        val now = System.currentTimeMillis()
        opts.replyToId?.let { body.setReplyToId(bs(Ids.uuidToBytes(it))) }
        opts.threadRootId?.let { body.setThreadRootId(bs(Ids.uuidToBytes(it))) }
        for (t in opts.tags) {
            body.addTags(
                Tag.newBuilder().setTypeValue(t.type).setId(bs(Ids.uuidToBytes(t.id))).setOffset(t.offset).setLength(t.length)
                    .setSnapshotTitle(t.title).setSnapshotStatus(t.status),
            )
        }
        val content = body.build()
        // Shown immediately; the outbox delivers it as soon as there is a connection and a key.
        onQueue {
            store.putOutbox(OutboxItem(id, conversationId, content.toByteArray(), now))
            applyContent(Meta(id, conversationId, null, userId, deviceId, now, "pending"), content)
            emit(PulseEvent.Messages(conversationId))
        }
        enqueue { flushOutbox() }
        return id
    }

    /** Re-queues a message that failed to send. */
    suspend fun retry(conversationId: String, id: String) = onQueue {
        val m = store.getMessage(conversationId, id) ?: return@onQueue
        if (m.status != "failed") return@onQueue
        val body = Content.newBuilder()
        if (m.media != null) body.setMedia(Media.parseFrom(m.media)) else body.setText(Text.newBuilder().setBody(m.text))
        store.putOutbox(OutboxItem(id, conversationId, body.build().toByteArray(), System.currentTimeMillis()))
        store.putMessage(m.copy(status = "pending"))
        emit(PulseEvent.Messages(conversationId))
        flushOutbox()
    }

    // ───────────────────────────── Sync ─────────────────────────────

    private suspend fun cursor(conversationId: String): Long =
        cursors[conversationId] ?: (store.getLong("cursor:$conversationId") ?: 0L).also { cursors[conversationId] = it }

    private suspend fun setCursor(conversationId: String, seq: Long) {
        cursors[conversationId] = seq
        store.setLong("cursor:$conversationId", seq)
    }

    private suspend fun saveConversations() {
        store.set(K_CONVERSATIONS, json.encodeToString(ListSerializer(PulseConversation.serializer()), convs.values.toList()).encodeToByteArray())
        publishConversations()
    }

    private fun publishConversations() {
        // Deep copies: members are mutated on the queue while the UI reads the snapshot.
        _conversations.value = convs.values
            .map { c -> c.copy(members = c.members.map { it.copy() }) }
            .sortedByDescending { parseTime(it.lastMessageAt ?: it.createdAt) }
        emit(PulseEvent.Conversations)
    }

    /** Runs after every (re)connect: refetch conversations, fill gaps, fix up membership, drain the outbox. */
    private suspend fun resync() {
        val list = api.conversations()
        convs.clear()
        for (c in list) convs[c.id] = c
        saveConversations()
        setUp(list)
        lastCaughtUpAt = System.nanoTime()
        flushOutbox()
        replenishKeyPackages()
    }

    /** Brings the given conversations' encryption groups and message logs up to date. */
    private suspend fun setUp(list: List<PulseConversation>) {
        val directory = lookupDevices(list)
        for (conv in list) {
            ensureGroup(conv)
            catchUp(conv.id)
            reconcile(conv, directory)
        }
        persist()
        saveConversations()
    }

    private suspend fun lookupDevices(list: List<PulseConversation>): Map<String, List<DeviceInfo>> {
        val userIds = list.flatMap { c -> c.members.map { it.userId } }.distinct()
        val directory = HashMap<String, MutableList<DeviceInfo>>()
        for (chunk in userIds.chunked(1000)) {
            for (d in api.lookupDevices(chunk)) directory.getOrPut(d.userId) { mutableListOf() }.add(d)
        }
        return directory
    }

    /** Only the creator starts a group, and only while the server still shows epoch 0. */
    private fun ensureGroup(conv: PulseConversation) {
        val gid = Ids.uuidToBytes(conv.id)
        if (device.hasGroup(gid)) return
        if (conv.createdBy != userId || conv.epoch != 0L) return
        device.createGroup(gid)
    }

    /** Pulls the conversation log forward from this device's cursor. */
    private suspend fun catchUp(conversationId: String) {
        val gid = Ids.uuidToBytes(conversationId)
        if (!device.hasGroup(gid)) return
        val s = socket ?: return
        var applied = false
        while (true) {
            val after = cursor(conversationId)
            val reply = s.request { setSync(Sync.newBuilder().setConversationId(bs(gid)).setAfterSeq(after).setLimit(SYNC_PAGE)) }
            if (reply.bodyCase != ServerFrame.BodyCase.SYNC_BATCH) break
            for (env in reply.syncBatch.messagesList) {
                if (applyEnvelope(env)) applied = true
            }
            if (!reply.syncBatch.hasMore) break
        }
        // Always: the log may have been read before this device knew the conversation's members.
        ackDelivered(conversationId)
        if (applied) {
            emit(PulseEvent.Messages(conversationId))
            publishConversations()
        }
    }

    /** Tells the senders that this device now holds everything up to its cursor (double tick). */
    private suspend fun ackDelivered(conversationId: String) {
        val me = convs[conversationId]?.members?.firstOrNull { it.userId == userId } ?: return
        val cursor = cursor(conversationId)
        if (me.deliveredSeq >= cursor) return
        me.deliveredSeq = cursor
        socket?.notify { setDelivered(Watermark.newBuilder().setConversationId(bs(Ids.uuidToBytes(conversationId))).setSeq(cursor)) }
    }

    // ───────────────────────────── Incoming ─────────────────────────────

    private suspend fun handleFrame(frame: ServerFrame) {
        when (frame.bodyCase) {
            ServerFrame.BodyCase.MESSAGE -> {
                val env = frame.message
                val conversationId = Ids.bytesToUuid(env.conversationId.toByteArray())
                if (!device.hasGroup(env.conversationId.toByteArray())) return // not welcomed yet; synced after joining
                if (env.seq > cursor(conversationId) + 1) {
                    catchUp(conversationId) // missed something: fill the gap in order
                    return
                }
                if (applyEnvelope(env)) {
                    ackDelivered(conversationId)
                    emit(PulseEvent.Messages(conversationId))
                    publishConversations()
                }
            }
            ServerFrame.BodyCase.RECEIPT -> {
                val r = frame.receipt
                val conv = convs[Ids.bytesToUuid(r.conversationId.toByteArray())] ?: return
                val member = conv.members.firstOrNull { it.userId == Ids.bytesToUuid(r.userId.toByteArray()) } ?: return
                member.deliveredSeq = maxOf(member.deliveredSeq, r.deliveredSeq)
                member.readSeq = maxOf(member.readSeq, r.readSeq)
                publishConversations()
                emit(PulseEvent.Messages(conv.id))
            }
            ServerFrame.BodyCase.TYPING -> {
                val t = frame.typing
                emit(PulseEvent.Typing(Ids.bytesToUuid(t.conversationId.toByteArray()), Ids.bytesToUuid(t.userId.toByteArray()), t.active))
            }
            ServerFrame.BodyCase.DIRECT -> handleDirect(frame.direct)
            ServerFrame.BodyCase.CONVERSATION_CHANGED ->
                scheduleRefresh(Ids.bytesToUuid(frame.conversationChanged.conversationId.toByteArray()), Random.nextLong(400))
            else -> Unit
        }
    }

    /** Applies one log entry if it is the next in order. Returns whether it was applied. */
    private suspend fun applyEnvelope(env: Envelope): Boolean {
        val conversationId = Ids.bytesToUuid(env.conversationId.toByteArray())
        val seq = env.seq
        if (seq != cursor(conversationId) + 1) return false

        val senderId = Ids.bytesToUuid(env.senderId.toByteArray())
        if (env.kind == MessageKind.MESSAGE_KIND_HANDSHAKE) applyHandshake(conversationId, env)
        else applyApplication(conversationId, seq, senderId, env)
        setCursor(conversationId, seq)

        convs[conversationId]?.let { conv ->
            conv.lastSeq = maxOf(conv.lastSeq, seq)
            conv.lastMessageAt = Instant.ofEpochMilli(env.serverTs).toString()
            // Sending implies the sender has everything up to their own message.
            conv.members.firstOrNull { it.userId == senderId }?.let {
                it.deliveredSeq = maxOf(it.deliveredSeq, seq)
                it.readSeq = maxOf(it.readSeq, seq)
            }
        }
        return true
    }

    private suspend fun applyHandshake(conversationId: String, env: Envelope) {
        val gid = env.conversationId.toByteArray()
        val current = device.currentEpoch(gid)
        val epoch = env.epoch
        if (epoch <= current) return // from before this device joined, or already applied
        if (epoch != current + 1) {
            Log.e(TAG, "$conversationId: commit for epoch $epoch but this device is at $current")
            return
        }
        val key = "commit:$conversationId"
        val mine = loadCommit(key)
        try {
            if (Ids.bytesToUuid(env.senderDeviceId.toByteArray()) == deviceId) {
                // Our own commit, accepted by the server although we never saw the ack.
                device.mergePending(gid)
                if (mine != null) saveCommit(key, mine.copy(stage = "merged"))
            } else {
                if (mine?.stage == "staged") {
                    // Someone else took this epoch first; ours can never be accepted now.
                    device.discardPending(gid)
                    saveCommit(key, null)
                }
                device.processCommit(gid, env.ciphertext.toByteArray())
            }
            convs[conversationId]?.let { it.epoch = maxOf(it.epoch, epoch) }
        } catch (e: Exception) {
            Log.e(TAG, "$conversationId: could not apply commit for epoch $epoch", e)
        }
        persist()
    }

    private suspend fun senderKey(gid: ByteArray, identity: ByteArray): ByteArray? {
        val slot = "idkey:${Ids.hex(identity)}"
        device.memberKey(gid, identity)?.let { member ->
            // Remembered so messages from a device that later leaves still verify.
            if (senderKeys[slot] == null) {
                senderKeys[slot] = member
                store.set(slot, member)
            }
            return member
        }
        return senderKeys[slot] ?: store.get(slot)?.also { senderKeys[slot] = it }
    }

    private suspend fun applyApplication(conversationId: String, seq: Long, senderId: String, env: Envelope) {
        val id = Ids.bytesToUuid(env.id.toByteArray())
        val senderDeviceId = Ids.bytesToUuid(env.senderDeviceId.toByteArray())
        val ts = env.serverTs
        val gid = env.conversationId.toByteArray()
        val frame = env.ciphertext.toByteArray()

        val content = try {
            val sender = PulseDevice.frameSender(frame)
            // The signed sender inside the ciphertext must be who the server says sent it.
            require(sender.contentEquals(Ids.concat(env.senderId.toByteArray(), env.senderDeviceId.toByteArray()))) { "sender mismatch" }
            val key = senderKey(gid, sender) ?: error("unknown sender")
            Content.parseFrom(device.decrypt(gid, frame, key).plaintext)
        } catch (e: Exception) {
            null
        }

        if (content != null) {
            applyContent(Meta(id, conversationId, seq, senderId, senderDeviceId, ts, "sent"), content)
            return
        }
        // No key for it (sent before this device joined and not shared yet) or it failed verification.
        val existing = store.getMessage(conversationId, id)
        if (existing != null && !existing.unavailable) {
            store.putMessage(existing.copy(seq = seq, sortOrder = seq, ts = ts, status = "sent"))
            return
        }
        store.putMessage(
            LocalMessage(
                conversationId = conversationId, id = id, seq = seq, sortOrder = seq, senderId = senderId,
                senderDeviceId = senderDeviceId, ts = ts, status = "sent", text = "", unavailable = true,
            ),
        )
    }

    private data class Meta(
        val id: String, val conversationId: String, val seq: Long?, val senderId: String,
        val senderDeviceId: String, val ts: Long, val status: String,
    )

    /** Folds decrypted content into the local store: new messages, and reactions/edits/deletes onto their targets. */
    private suspend fun applyContent(meta: Meta, content: Content) {
        val conversationId = meta.conversationId
        if (content.bodyCase == Content.BodyCase.REACTION || content.bodyCase == Content.BodyCase.EDIT || content.bodyCase == Content.BodyCase.DELETE) {
            // Read before this device had the key, the entry was stored as an unreadable placeholder.
            // It is not a message of its own, so the placeholder goes once the entry can be applied.
            if (store.getMessage(conversationId, meta.id)?.unavailable == true) store.deleteMessage(conversationId, meta.id)
        }
        when (content.bodyCase) {
            Content.BodyCase.TEXT, Content.BodyCase.MEDIA -> {
                val prev = store.getMessage(conversationId, meta.id)
                val isMedia = content.bodyCase == Content.BodyCase.MEDIA
                store.putMessage(
                    LocalMessage(
                        conversationId = conversationId,
                        id = meta.id,
                        seq = meta.seq,
                        sortOrder = meta.seq ?: pendingOrder(meta.ts),
                        senderId = meta.senderId,
                        senderDeviceId = meta.senderDeviceId,
                        ts = meta.ts,
                        status = meta.status,
                        text = if (isMedia) content.media.caption else content.text.body,
                        media = if (isMedia) content.media.toByteArray() else null,
                        replyToId = content.replyToId.takeIf { it.size() == 16 }?.let { Ids.bytesToUuid(it.toByteArray()) },
                        threadRootId = content.threadRootId.takeIf { it.size() == 16 }?.let { Ids.bytesToUuid(it.toByteArray()) },
                        tags = content.tagsList.map {
                            LocalTag(it.typeValue, Ids.bytesToUuid(it.id.toByteArray()), it.offset, it.length, it.snapshotTitle, it.snapshotStatus)
                        },
                        reactions = prev?.reactions ?: emptyMap(),
                    ),
                )
            }
            Content.BodyCase.REACTION -> {
                val target = store.getMessage(conversationId, Ids.bytesToUuid(content.reaction.targetId.toByteArray())) ?: return
                val reactions = target.reactions.toMutableMap()
                if (content.reaction.emoji.isNotEmpty()) reactions[meta.senderId] = content.reaction.emoji
                else reactions.remove(meta.senderId)
                store.putMessage(target.copy(reactions = reactions))
            }
            Content.BodyCase.EDIT -> {
                val target = store.getMessage(conversationId, Ids.bytesToUuid(content.edit.targetId.toByteArray())) ?: return
                if (target.senderId != meta.senderId || target.deleted) return // only the author may edit
                store.putMessage(target.copy(text = content.edit.text.body, edited = true))
            }
            Content.BodyCase.DELETE -> {
                val target = store.getMessage(conversationId, Ids.bytesToUuid(content.delete.targetId.toByteArray())) ?: return
                if (target.senderId != meta.senderId) return // only the author may delete
                store.putMessage(target.copy(text = "", media = null, tags = emptyList(), deleted = true))
            }
            else -> Unit
        }
    }

    private suspend fun handleDirect(direct: Direct) {
        val payload = direct.payload.toByteArray()
        try {
            if (payload.isEmpty()) return
            val body = payload.copyOfRange(1, payload.size)
            val gid = direct.conversationId.toByteArray()
            when (payload[0].toInt()) {
                DIRECT_WELCOME -> if (gid.isEmpty() || !device.hasGroup(gid)) {
                    val conversationId = Ids.bytesToUuid(device.join(body))
                    persist()
                    scheduleRefresh(conversationId, 0)
                }
                DIRECT_HISTORY_KEYS -> if (device.hasGroup(gid)) {
                    val sender = PulseDevice.frameSender(body)
                    require(sender.contentEquals(Ids.concat(direct.fromUserId.toByteArray(), direct.fromDeviceId.toByteArray()))) { "sender mismatch" }
                    val key = senderKey(gid, sender) ?: error("history keys from a device outside the group")
                    val keys = ByteBuffer.wrap(device.decrypt(gid, body, key).plaintext)
                    while (keys.remaining() >= 40) {
                        val epoch = keys.long
                        val k = ByteArray(32).also { keys.get(it) }
                        device.importEpochKey(gid, epoch, k)
                    }
                    persist()
                    // Re-read the log so messages stored before this device joined become readable.
                    val conversationId = Ids.bytesToUuid(gid)
                    setCursor(conversationId, 0)
                    scheduleRefresh(conversationId, 0)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "could not process device payload", e)
        }
        socket?.notify { setDirectAck(DirectAck.newBuilder().addIds(direct.id)) }
    }

    private fun scheduleRefresh(conversationId: String, delayMs: Long) {
        synchronized(refreshJobs) {
            if (stopped || refreshJobs.containsKey(conversationId)) return
            refreshJobs[conversationId] = scope.launch {
                delay(delayMs)
                synchronized(refreshJobs) { refreshJobs.remove(conversationId) }
                enqueue { refreshConversation(conversationId) }
            }
        }
    }

    /** Refetches one conversation after its membership or this device's access to it changed. */
    private suspend fun refreshConversation(conversationId: String) {
        val conv = try {
            api.conversation(conversationId)
        } catch (e: PulseHttpException) {
            if (e.status == 404) {
                convs.remove(conversationId) // removed from it
                saveConversations()
            }
            return
        }
        convs[conversationId] = conv
        saveConversations()
        setUp(listOf(conv))
        flushOutbox()
    }

    // ───────────────────────────── Membership ─────────────────────────────

    private fun identityOf(d: DeviceInfo): ByteArray = Ids.concat(Ids.uuidToBytes(d.userId), Ids.uuidToBytes(d.id))

    /**
     * Makes the encryption group match the server's member list: every active device of every
     * member is in, everything else is out. The server's epoch ordering lets exactly one commit win.
     */
    private suspend fun reconcile(conv: PulseConversation, directory: Map<String, List<DeviceInfo>>) {
        val gid = Ids.uuidToBytes(conv.id)
        if (!device.hasGroup(gid)) return

        // Finish a commit left over from an earlier attempt before planning a new one.
        if (driveCommit(conv) == "conflict") return

        val want = LinkedHashMap<String, DeviceInfo>()
        for (m in conv.members) for (d in directory[m.userId].orEmpty()) want[Ids.hex(identityOf(d))] = d
        val have = device.memberIdentities(gid).map { Ids.hex(it) }.toSet()
        val me = Ids.hex(identity)

        val remove = have.filter { it != me && it !in want }
        if (remove.isNotEmpty()) {
            if (stage(conv, { device.removeMembers(gid, remove.map { Ids.fromHex(it) }) }, emptyList()) != "ok") return
        }

        val add = want.filter { (h, _) -> h != me && h !in have }.values
        if (add.isNotEmpty()) {
            val packages = mutableListOf<ByteArray>()
            val added = mutableListOf<String>()
            for (uid in add.map { it.userId }.distinct()) {
                val claimed = api.claimKeyPackages(uid)
                for (d in add.filter { it.userId == uid }) {
                    val kp = claimed.firstOrNull { it.deviceId == d.id } ?: continue // out of packages; a later pass retries
                    val bytes = Ids.unb64(kp.keyPackage)
                    // The package must be signed by, and name, the device we asked for.
                    val ok = runCatching { device.keyPackageIdentity(bytes).contentEquals(identityOf(d)) }.getOrDefault(false)
                    if (!ok) continue
                    packages += bytes
                    added += d.id
                }
            }
            if (packages.isNotEmpty()) {
                stage(conv, { device.addMembers(gid, packages) }, added)
                return
            }
        }

        // A brand-new group with nobody to add yet still has to claim its first epoch.
        if (device.currentEpoch(gid) == 0L) stage(conv, { device.selfUpdate(gid) }, emptyList())
    }

    @Serializable
    private data class PendingCommit(
        val id: String,
        val commit: String,
        val epoch: Long,
        /** staged: not yet accepted by the server. merged: accepted; welcomes still to deliver. */
        val stage: String,
        val welcome: String? = null,
        val welcomeTo: List<String> = emptyList(),
    )

    private suspend fun loadCommit(key: String): PendingCommit? =
        store.getString(key)?.let { json.decodeFromString(PendingCommit.serializer(), it) }

    private suspend fun saveCommit(key: String, rec: PendingCommit?) =
        store.setDurable(key, rec?.let { json.encodeToString(PendingCommit.serializer(), it) }?.encodeToByteArray())

    private suspend fun stage(conv: PulseConversation, build: () -> PulseDevice.Commit, welcomeTo: List<String>): String {
        val gid = Ids.uuidToBytes(conv.id)
        runCatching { device.discardPending(gid) } // a staged commit that never got a record was never sent
        val staged = build()
        // Keys first, then the record: a record without its staged keys could never be completed.
        persist()
        saveCommit(
            "commit:${conv.id}",
            PendingCommit(Ids.uuidv7(), Ids.b64(staged.commit), staged.epoch, "staged", staged.welcome?.let { Ids.b64(it) }, welcomeTo),
        )
        return if (driveCommit(conv) == "conflict") "conflict" else "ok"
    }

    /** Pushes a recorded commit through: send, merge on acceptance, then welcome the added devices. */
    private suspend fun driveCommit(conv: PulseConversation): String {
        val key = "commit:${conv.id}"
        val gid = Ids.uuidToBytes(conv.id)
        var rec = loadCommit(key) ?: return "none"
        val s = socket ?: throw PulseSocketException(PulseSocketException.Kind.OFFLINE, message = "not connected")

        if (rec.stage == "staged") {
            val reply = try {
                s.request {
                    setSend(
                        Send.newBuilder().setConversationId(bs(gid)).setId(bs(Ids.uuidToBytes(rec.id)))
                            .setKind(MessageKind.MESSAGE_KIND_HANDSHAKE).setCiphertext(bs(Ids.unb64(rec.commit))).setEpoch(rec.epoch),
                    )
                }
            } catch (e: PulseSocketException) {
                if (!e.conflict) throw e // transient: the record stays and is retried
                try {
                    device.discardPending(gid)
                    // A group still at epoch 0 was our own attempt to start the conversation and lost;
                    // drop it and wait to be welcomed into the winner's.
                    if (device.currentEpoch(gid) == 0L) {
                        device.dropGroup(gid)
                        conv.epoch = maxOf(conv.epoch, 1)
                    }
                } catch (err: Exception) {
                    Log.e(TAG, "could not roll back a rejected commit", err)
                }
                saveCommit(key, null)
                persist()
                scheduleRefresh(conv.id, 500 + Random.nextLong(1000))
                return "conflict"
            }

            if (device.currentEpoch(gid) < rec.epoch) device.mergePending(gid)
            persist()
            rec = rec.copy(stage = "merged")
            saveCommit(key, rec)
            conv.epoch = maxOf(conv.epoch, rec.epoch)
            if (reply.bodyCase == ServerFrame.BodyCase.SEND_ACK) {
                val seq = reply.sendAck.seq
                if (seq == cursor(conv.id) + 1) setCursor(conv.id, seq)
                conv.lastSeq = maxOf(conv.lastSeq, seq)
            }
        }

        welcome(conv, rec)
        saveCommit(key, null)
        return "ok"
    }

    /** Sends the welcome, then this device's older message keys, to each newly added device. */
    private suspend fun welcome(conv: PulseConversation, rec: PendingCommit) {
        val welcome = rec.welcome ?: return
        if (rec.welcomeTo.isEmpty()) return
        val gid = Ids.uuidToBytes(conv.id)
        val s = socket ?: throw PulseSocketException(PulseSocketException.Kind.OFFLINE, message = "not connected")

        val payloads = mutableListOf(Ids.concat(byteArrayOf(DIRECT_WELCOME.toByte()), Ids.unb64(welcome)))
        val keys = mutableListOf<ByteArray>()
        for (epoch in 0 until rec.epoch) {
            val k = device.epochKey(gid, epoch) ?: continue
            keys += ByteBuffer.allocate(40).putLong(epoch).put(k).array()
        }
        // Sealed for the new epoch, which only the group (now including the new devices) can open.
        for (chunk in keys.chunked(HISTORY_KEYS_PER_FRAME)) {
            payloads += Ids.concat(byteArrayOf(DIRECT_HISTORY_KEYS.toByte()), device.encrypt(gid, Ids.concat(*chunk.toTypedArray())))
        }

        for (target in rec.welcomeTo) {
            for (payload in payloads) {
                try {
                    s.request { setDirectSend(DirectSend.newBuilder().setToDeviceId(bs(Ids.uuidToBytes(target))).setConversationId(bs(gid)).setPayload(bs(payload))) }
                } catch (e: Exception) {
                    if (isTransient(e)) throw e // keep the record; retried on the next pass
                    break // the device is gone (revoked); nothing to deliver
                }
            }
        }
    }

    // ───────────────────────────── Outbox ─────────────────────────────

    /** Sends queued messages in order. Retries reuse the same id, so nothing is duplicated. */
    private suspend fun flushOutbox() {
        for (item in store.listOutbox()) {
            val s = socket ?: return
            if (!s.connected) return
            val gid = Ids.uuidToBytes(item.conversationId)
            // No usable key yet (waiting to be welcomed, or the group is still being started).
            if (!device.hasGroup(gid) || device.currentEpoch(gid) == 0L) continue

            val reply = try {
                s.request {
                    setSend(
                        Send.newBuilder().setConversationId(bs(gid)).setId(bs(Ids.uuidToBytes(item.id)))
                            .setKind(MessageKind.MESSAGE_KIND_APPLICATION).setCiphertext(bs(device.encrypt(gid, item.content)))
                            .setEpoch(device.currentEpoch(gid)),
                    )
                }
            } catch (e: Exception) {
                if (isTransient(e)) return // try again on the next flush
                store.deleteOutbox(item.id)
                store.getMessage(item.conversationId, item.id)?.let { store.putMessage(it.copy(status = "failed")) }
                emit(PulseEvent.Messages(item.conversationId))
                continue
            }

            store.deleteOutbox(item.id)
            if (reply.bodyCase != ServerFrame.BodyCase.SEND_ACK) continue
            val seq = reply.sendAck.seq
            store.getMessage(item.conversationId, item.id)?.let {
                store.putMessage(it.copy(seq = seq, sortOrder = seq, ts = reply.sendAck.serverTs, status = "sent"))
            }
            if (seq == cursor(item.conversationId) + 1) setCursor(item.conversationId, seq)

            convs[item.conversationId]?.let { conv ->
                conv.lastSeq = maxOf(conv.lastSeq, seq)
                conv.lastMessageAt = Instant.ofEpochMilli(reply.sendAck.serverTs).toString()
                conv.members.firstOrNull { it.userId == userId }?.let {
                    it.deliveredSeq = maxOf(it.deliveredSeq, seq)
                    it.readSeq = maxOf(it.readSeq, seq)
                }
            }
            emit(PulseEvent.Messages(item.conversationId))
            publishConversations()
        }
    }

    /** Keeps enough one-time key packages on the server for others to add this device while it is offline. */
    private suspend fun replenishKeyPackages() {
        if (api.keyPackagesRemaining(deviceId) >= KEY_PACKAGE_LOW_WATER) return
        val keyPackages = newKeyPackages(KEY_PACKAGE_BATCH)
        persist()
        api.addKeyPackages(deviceId, keyPackages)
    }

    private companion object {
        const val TAG = "Pulse"
        const val KEY_PACKAGE_BATCH = 20
        const val KEY_PACKAGE_LOW_WATER = 8
        const val SYNC_PAGE = 200
        const val HISTORY_KEYS_PER_FRAME = 1000
        // Device-to-device payload types (first byte of a Direct payload).
        const val DIRECT_WELCOME = 1
        const val DIRECT_HISTORY_KEYS = 2

        const val K_DEVICE = "device"
        const val K_DEVICE_ID = "device-id"
        const val K_REGISTERED = "device-registered"
        const val K_CONVERSATIONS = "conversations"

        fun bs(bytes: ByteArray): ByteString = ByteString.copyFrom(bytes)

        fun parseTime(iso: String): Long = runCatching { Instant.parse(iso).toEpochMilli() }
            .recoverCatching { java.time.OffsetDateTime.parse(iso).toInstant().toEpochMilli() }
            .getOrDefault(0L)

        fun isTransient(e: Throwable): Boolean =
            (e is PulseSocketException && e.transient) || (e is PulseHttpException && e.transient)
    }
}
