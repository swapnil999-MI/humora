package com.paylogic.humora.presentation.viewmodel

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.paylogic.humora.HumoraApp
import com.paylogic.humora.data.model.ChatAttachment
import com.paylogic.humora.data.model.ChatContact
import com.paylogic.humora.data.model.ChatMessage
import com.paylogic.humora.data.model.ChatReaction
import com.paylogic.humora.data.model.ChatReplyPreview
import com.paylogic.humora.data.model.ChatRow
import com.paylogic.humora.pulse.PulseClient
import com.paylogic.humora.pulse.PulseConversation
import com.paylogic.humora.pulse.PulseEvent
import com.paylogic.humora.pulse.PulseService
import com.paylogic.humora.pulse.SendOptions
import com.paylogic.humora.pulse.VoiceRecorder
import com.paylogic.humora.pulse.store.LocalMessage
import com.paylogic.humora.pulse.v1.Media
import com.paylogic.humora.pulse.v1.MediaKind
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/** Filter for the conversations roster, mirrors web "All | Unread | Groups | Direct" pills */
enum class ChatFilter(val label: String) {
    ALL("All"),
    UNREAD("Unread"),
    GROUPS("Groups"),
    DMS("Direct")
}

/** A one-shot request to scroll to and highlight [messageId]; [nonce] makes repeats distinct. */
data class JumpTarget(val messageId: String, val nonce: Long)

data class ChatUiState(
    // Roster
    val rows: List<ChatRow> = emptyList(),
    val searchQuery: String = "",
    val activeFilter: ChatFilter = ChatFilter.ALL,
    val connected: Boolean = false,
    /** Signed in, but the encrypted chat client is not running yet (or the session has no user id). */
    val starting: Boolean = true,

    // Active conversation
    val activeConversationId: String? = null,
    val activeKind: String = "dm",
    val activeTitle: String = "",
    val activeSubtitle: String = "",
    val messages: List<ChatMessage> = emptyList(),
    val hasOlder: Boolean = false,
    val replyTo: ChatReplyPreview? = null,
    val editing: ChatMessage? = null,
    /** Set when the view should scroll to a message and flash it (tapping a quote). */
    val jumpTarget: JumpTarget? = null,

    // New chat
    val contacts: List<ChatContact> = emptyList(),
    val showNewChat: Boolean = false,

    // Feedback
    val busy: String? = null,
    val error: String? = null,
    val recordingSince: Long? = null,
    /** Message id -> decrypted local file, for attachments opened in this session. */
    val openedFiles: Map<String, File> = emptyMap(),
    val viewingImage: File? = null,
) {
    val isInConversation: Boolean get() = activeConversationId != null
    val totalUnread: Int get() = rows.sumOf { it.unread }

    val filteredRows: List<ChatRow>
        get() {
            val byFilter = when (activeFilter) {
                ChatFilter.ALL -> rows
                ChatFilter.UNREAD -> rows.filter { it.unread > 0 }
                ChatFilter.GROUPS -> rows.filter { it.isGroup }
                ChatFilter.DMS -> rows.filter { !it.isGroup }
            }
            if (searchQuery.isBlank()) return byFilter
            return byFilter.filter { it.title.contains(searchQuery, true) || it.snippet.contains(searchQuery, true) }
        }
}

@OptIn(ExperimentalCoroutinesApi::class)
class ChatViewModel(
    private val service: PulseService = HumoraApp.instance.pulseService,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    private val client: PulseClient? get() = service.client.value
    private val me: String get() = client?.userId.orEmpty()

    // Starred messages stay on this phone, per signed-in user.
    private val starPrefs get() = HumoraApp.instance.getSharedPreferences("pulse_starred_$me", android.content.Context.MODE_PRIVATE)
    private fun starredIds(): Set<String> = starPrefs.getStringSet("ids", emptySet()) ?: emptySet()

    /** conversationId -> userId -> time the typing indicator expires. */
    private val typing = HashMap<String, HashMap<String, Long>>()
    private var rosterJob: Job? = null
    private var typingSentAt = 0L
    private var recorder: VoiceRecorder? = null

    init {
        viewModelScope.launch {
            service.client.collectLatest { c ->
                _uiState.update { it.copy(starting = c == null) }
                if (c == null) {
                    _uiState.update { ChatUiState(starting = true) }
                    return@collectLatest
                }
                launch { c.connected.collect { connected -> _uiState.update { it.copy(connected = connected) } } }
                launch { c.conversations.collect { scheduleRoster() } }
                launch { service.people.collect { scheduleRoster(); refreshActive(); buildContacts() } }
                c.events.collect { e ->
                    when (e) {
                        is PulseEvent.Messages -> {
                            scheduleRoster()
                            if (e.conversationId == _uiState.value.activeConversationId) {
                                refreshActive()
                                // Blue ticks only for messages the user can actually see.
                                if (service.isUserLooking(e.conversationId)) c.markRead(e.conversationId)
                            }
                        }
                        is PulseEvent.Typing -> onTyping(e)
                        else -> Unit
                    }
                }
            }
        }
        viewModelScope.launch {
            // A notification was tapped: open that chat once the client knows it.
            service.openRequests.collect { id ->
                if (id == null) return@collect
                val c = service.client.first { it != null }!!
                c.conversations.first { list -> list.any { it.id == id } }
                service.consumeOpenRequest()
                openConversation(id)
            }
        }
        viewModelScope.launch {
            // Expire typing indicators that never got their "stopped" event.
            while (true) {
                delay(2_000)
                val now = System.currentTimeMillis()
                var changed = false
                for (users in typing.values) changed = users.values.removeAll { it < now } || changed
                if (changed) scheduleRoster()
            }
        }
    }

    // ───────────────────────────── Roster ─────────────────────────────

    private fun scheduleRoster() {
        rosterJob?.cancel()
        rosterJob = viewModelScope.launch {
            delay(80) // coalesce bursts (a sync batch emits many events)
            buildRoster()
        }
    }

    private suspend fun buildRoster() {
        val c = client ?: return
        val rows = c.conversations.value.map { conv ->
            val last = c.lastMessage(conv.id)
            val ts = last?.ts ?: parseTime(conv.lastMessageAt ?: conv.createdAt)
            ChatRow(
                id = conv.id,
                kind = conv.kind,
                title = title(conv),
                subtitle = subtitle(conv),
                snippet = last?.let { snippet(conv, it) } ?: if (conv.kind == "dm") "" else conv.topic,
                timeLabel = if (ts > 0) rosterTime(ts) else "",
                sortTs = ts,
                unread = c.unreadCount(conv.id),
                lastTick = last?.takeIf { it.senderId == me }?.let { c.tick(it) },
                typing = typingLabel(conv),
            )
        }.sortedByDescending { it.sortTs }
        _uiState.update { it.copy(rows = rows) }
    }

    private fun title(conv: PulseConversation): String = when {
        conv.kind == "dm" -> conv.members.firstOrNull { it.userId != me }?.let { service.person(it.userId).name } ?: "Just you"
        conv.name.isNotBlank() -> conv.name
        else -> conv.members.filter { it.userId != me }.take(3).joinToString { service.person(it.userId).name.substringBefore(' ') }
    }

    private fun subtitle(conv: PulseConversation): String = when (conv.kind) {
        "dm" -> conv.members.firstOrNull { it.userId != me }?.let { service.person(it.userId).role }.orEmpty()
        else -> conv.topic.ifBlank { "${conv.members.size} members" }
    }

    private fun snippet(conv: PulseConversation, m: LocalMessage): String {
        val body = when {
            m.deleted -> "This message was deleted"
            m.unavailable -> "Waiting for this message…"
            m.media != null -> attachmentLabel(runCatching { Media.parseFrom(m.media) }.getOrNull())
            else -> m.text
        }
        val who = if (m.senderId == me) "" else if (conv.kind != "dm") service.person(m.senderId).name.substringBefore(' ') + ": " else ""
        return who + body
    }

    private fun attachmentLabel(media: Media?): String = when (media?.kind) {
        MediaKind.MEDIA_KIND_IMAGE -> "📷 Photo"
        MediaKind.MEDIA_KIND_VIDEO -> "🎬 Video"
        MediaKind.MEDIA_KIND_AUDIO, MediaKind.MEDIA_KIND_VOICE_NOTE -> "🎤 Voice message"
        else -> "📄 " + (media?.fileName ?: "File")
    } + (media?.caption?.takeIf { it.isNotBlank() }?.let { " · $it" } ?: "")

    private fun typingLabel(conv: PulseConversation): String? {
        val now = System.currentTimeMillis()
        val who = typing[conv.id]?.filter { it.value > now && it.key != me }?.keys.orEmpty()
        if (who.isEmpty()) return null
        if (conv.kind == "dm") return "typing…"
        val names = who.map { service.person(it).name.substringBefore(' ') }
        return if (names.size == 1) "${names[0]} is typing…" else "${names.size} people are typing…"
    }

    private fun onTyping(e: PulseEvent.Typing) {
        val users = typing.getOrPut(e.conversationId) { HashMap() }
        if (e.active) users[e.userId] = System.currentTimeMillis() + 6_000 else users.remove(e.userId)
        scheduleRoster()
        if (e.conversationId == _uiState.value.activeConversationId) updateActiveHeader()
    }

    fun setSearchQuery(query: String) = _uiState.update { it.copy(searchQuery = query) }

    fun setFilter(filter: ChatFilter) = _uiState.update { it.copy(activeFilter = filter) }

    // ───────────────────────────── Conversation ─────────────────────────────

    fun openConversation(id: String) {
        val c = client ?: return
        val conv = c.conversation(id) ?: return
        _uiState.update {
            it.copy(activeConversationId = id, activeKind = conv.kind, messages = emptyList(), replyTo = null, editing = null, hasOlder = false)
        }
        service.visibleConversationId = id
        updateActiveHeader()
        refreshActive()
        c.markRead(id)
    }

    fun closeConversation() {
        _uiState.value.activeConversationId?.let { client?.setTyping(it, false) }
        service.visibleConversationId = null
        _uiState.update { it.copy(activeConversationId = null, messages = emptyList(), replyTo = null, editing = null) }
        scheduleRoster()
    }

    private fun updateActiveHeader() {
        val c = client ?: return
        val conv = _uiState.value.activeConversationId?.let { c.conversation(it) } ?: return
        _uiState.update { it.copy(activeTitle = title(conv), activeSubtitle = typingLabel(conv) ?: subtitle(conv)) }
    }

    /** Reloads the visible page of the active conversation (newest messages, plus any older ones already loaded). */
    private fun refreshActive() {
        val id = _uiState.value.activeConversationId ?: return
        viewModelScope.launch {
            val c = client ?: return@launch
            val loaded = _uiState.value.messages.size
            val raw = c.messages(id, limit = maxOf(PAGE, loaded))
            if (id != _uiState.value.activeConversationId) return@launch
            _uiState.update { it.copy(messages = toUi(c, raw), hasOlder = raw.size >= maxOf(PAGE, loaded)) }
            updateActiveHeader()
        }
    }

    fun loadOlder() {
        val state = _uiState.value
        val id = state.activeConversationId ?: return
        val oldest = state.messages.firstOrNull() ?: return
        if (!state.hasOlder) return
        viewModelScope.launch {
            val c = client ?: return@launch
            val older = c.messages(id, beforeOrder = oldest.sortOrder, limit = PAGE)
            val current = c.messages(id, beforeOrder = Long.MAX_VALUE, limit = state.messages.size)
            _uiState.update { it.copy(messages = toUi(c, older + current), hasOlder = older.size >= PAGE) }
        }
    }

    private suspend fun toUi(c: PulseClient, raw: List<LocalMessage>): List<ChatMessage> {
        var lastDay: LocalDate? = null
        val starred = starredIds()
        return raw.map { m ->
            val day = Instant.ofEpochMilli(m.ts).atZone(ZoneId.systemDefault()).toLocalDate()
            val header = if (day != lastDay) dayLabel(day) else null
            lastDay = day
            val media = m.media?.let { runCatching { Media.parseFrom(it) }.getOrNull() }
            val reply = m.replyToId?.let { rid -> replyPreview(rid, c.message(m.conversationId, rid)) }
            ChatMessage(
                id = m.id,
                senderId = m.senderId,
                senderName = if (m.senderId == me) "You" else service.person(m.senderId).name,
                isMe = m.senderId == me,
                text = m.text,
                timeLabel = timeOfDay(m.ts),
                ts = m.ts,
                sortOrder = m.sortOrder,
                tick = if (m.senderId == me) c.tick(m) else null,
                edited = m.edited,
                deleted = m.deleted,
                unavailable = m.unavailable,
                reactions = m.reactions.entries.groupBy { it.value }.map { (emoji, who) -> ChatReaction(emoji, who.size, who.any { it.key == me }) },
                attachment = media?.let {
                    ChatAttachment(
                        it.kindValue, it.fileName, it.mimeType, it.sizeBytes, it.width, it.height, it.durationMs,
                        it.thumbnail.toByteArray().takeIf { b -> b.isNotEmpty() }, it.waveform.toByteArray().takeIf { b -> b.isNotEmpty() },
                    )
                },
                replyTo = reply,
                dayHeader = header,
                starred = m.id in starred,
            )
        }
    }

    // ───────────────────────────── Sending ─────────────────────────────

    fun onInputChanged(text: String) {
        val id = _uiState.value.activeConversationId ?: return
        val now = System.currentTimeMillis()
        if (text.isNotBlank() && now - typingSentAt > 3_000) {
            typingSentAt = now
            client?.setTyping(id, true)
        }
    }

    fun send(text: String) {
        val id = _uiState.value.activeConversationId ?: return
        val body = text.trim()
        if (body.isEmpty()) return
        val c = client ?: return
        val editing = _uiState.value.editing
        val replyTo = _uiState.value.replyTo
        _uiState.update { it.copy(replyTo = null, editing = null) }
        typingSentAt = 0
        c.setTyping(id, false)
        viewModelScope.launch {
            runCatching {
                if (editing != null) c.editMessage(id, editing.id, body)
                else c.sendText(id, body, SendOptions(replyToId = replyTo?.messageId))
            }.onFailure { showError("Could not send: ${it.message}") }
        }
    }

    fun startReply(message: ChatMessage) {
        if (message.deleted || message.unavailable) return
        val att = message.attachment
        _uiState.update {
            it.copy(
                replyTo = ChatReplyPreview(
                    messageId = message.id,
                    senderId = message.senderId,
                    senderName = message.senderName,
                    isMe = message.isMe,
                    text = replySnippet(message.text, att?.kind ?: 0, att?.fileName, att?.durationMs ?: 0),
                    mediaKind = att?.kind ?: 0,
                    thumbnail = att?.thumbnail,
                ),
                editing = null,
            )
        }
    }

    /**
     * Tapping a quote jumps to the original: older pages are loaded until it is in the list,
     * then the view scrolls to it and flashes it (see [ChatUiState.jumpTarget]).
     */
    fun jumpToMessage(messageId: String) {
        val id = _uiState.value.activeConversationId ?: return
        viewModelScope.launch {
            val c = client ?: return@launch
            var pages = 0
            while (_uiState.value.messages.none { it.id == messageId } && _uiState.value.hasOlder && pages < 40) {
                val state = _uiState.value
                val oldest = state.messages.firstOrNull() ?: break
                val older = c.messages(id, beforeOrder = oldest.sortOrder, limit = PAGE)
                val current = c.messages(id, beforeOrder = Long.MAX_VALUE, limit = state.messages.size)
                if (id != _uiState.value.activeConversationId) return@launch
                _uiState.update { it.copy(messages = toUi(c, older + current), hasOlder = older.size >= PAGE) }
                pages++
            }
            if (_uiState.value.messages.any { it.id == messageId }) {
                _uiState.update { it.copy(jumpTarget = JumpTarget(messageId, System.nanoTime())) }
            } else {
                showError("The original message is no longer available.")
            }
        }
    }

    private fun replyPreview(rid: String, r: LocalMessage?): ChatReplyPreview {
        if (r == null) return ChatReplyPreview(rid, "", "", false, "Original message is not available", unavailable = true)
        val media = r.media?.let { runCatching { Media.parseFrom(it) }.getOrNull() }
        val isMe = r.senderId == me
        return ChatReplyPreview(
            messageId = rid,
            senderId = r.senderId,
            senderName = if (isMe) "You" else service.person(r.senderId).name,
            isMe = isMe,
            text = when {
                r.deleted -> "This message was deleted"
                r.unavailable -> "Waiting for this message"
                else -> replySnippet(r.text, media?.kindValue ?: 0, media?.fileName, media?.durationMs ?: 0, media?.caption)
            },
            mediaKind = if (r.deleted || r.unavailable) 0 else media?.kindValue ?: 0,
            thumbnail = if (r.deleted) null else media?.thumbnail?.toByteArray()?.takeIf { it.isNotEmpty() },
            unavailable = r.deleted || r.unavailable,
        )
    }

    /** WhatsApp-style one-line snippet: the text, or "Photo" / "Voice message (0:12)" / the file name. */
    private fun replySnippet(text: String, kind: Int, fileName: String?, durationMs: Int, caption: String? = null): String {
        val body = text.ifBlank { caption.orEmpty() }.replace('\n', ' ').trim()
        if (body.isNotEmpty()) return body
        return when (kind) {
            1 -> "Photo"
            2 -> "Video"
            3, 4 -> "Voice message" + if (durationMs > 0) " (%d:%02d)".format(durationMs / 60000, durationMs / 1000 % 60) else ""
            0 -> ""
            else -> fileName ?: "Document"
        }
    }

    fun startEdit(message: ChatMessage) {
        if (!message.isMe || message.deleted || message.attachment != null) return
        _uiState.update { it.copy(editing = message, replyTo = null) }
    }

    fun cancelCompose() = _uiState.update { it.copy(replyTo = null, editing = null) }

    fun toggleStar(message: ChatMessage) {
        val ids = starredIds().toMutableSet()
        val nowStarred = ids.add(message.id) || run { ids.remove(message.id); false }
        starPrefs.edit().putStringSet("ids", ids).apply()
        _uiState.update { s -> s.copy(messages = s.messages.map { if (it.id == message.id) it.copy(starred = nowStarred) else it }) }
    }

    fun delete(message: ChatMessage) {
        val id = _uiState.value.activeConversationId ?: return
        if (!message.isMe) return
        viewModelScope.launch { runCatching { client?.deleteMessage(id, message.id) }.onFailure { showError("Could not delete") } }
    }

    /** Tapping your current reaction removes it; any other emoji replaces it. */
    fun toggleReaction(message: ChatMessage, emoji: String) {
        val id = _uiState.value.activeConversationId ?: return
        val mine = message.reactions.firstOrNull { it.mine }?.emoji
        viewModelScope.launch { runCatching { client?.react(id, message.id, if (mine == emoji) "" else emoji) } }
    }

    fun retry(message: ChatMessage) {
        val id = _uiState.value.activeConversationId ?: return
        viewModelScope.launch { client?.retry(id, message.id) }
    }

    fun sendAttachment(uri: Uri, kind: MediaKind, fileName: String? = null, mimeType: String? = null, caption: String = "") {
        val id = _uiState.value.activeConversationId ?: return
        val c = client ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(busy = "Encrypting and uploading…") }
            try {
                val media = c.media.upload(id, uri, kind, caption = caption, fileName = fileName, mimeType = mimeType)
                c.sendMedia(id, media)
            } catch (e: Exception) {
                showError(e.message ?: "Upload failed")
            } finally {
                _uiState.update { it.copy(busy = null) }
            }
        }
    }

    // ───────────────────────────── Voice notes ─────────────────────────────

    fun startRecording() {
        if (recorder?.isRecording == true) return
        val r = VoiceRecorder(HumoraApp.instance)
        try {
            r.start(viewModelScope)
            recorder = r
            _uiState.update { it.copy(recordingSince = System.currentTimeMillis()) }
        } catch (e: Exception) {
            showError("Could not start recording")
        }
    }

    fun stopRecording(send: Boolean) {
        val r = recorder ?: return
        recorder = null
        _uiState.update { it.copy(recordingSince = null) }
        if (!send) {
            r.cancel()
            return
        }
        val recording = r.stop() ?: return
        val id = _uiState.value.activeConversationId
        val c = client
        if (id == null || c == null) {
            recording.file.delete()
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(busy = "Sending voice message…") }
            try {
                val media = c.media.upload(
                    id, Uri.fromFile(recording.file), MediaKind.MEDIA_KIND_VOICE_NOTE,
                    durationMs = recording.durationMs, waveform = recording.waveform,
                    fileName = "Voice message.m4a", mimeType = "audio/mp4",
                )
                c.sendMedia(id, media)
            } catch (e: Exception) {
                showError(e.message ?: "Could not send the voice message")
            } finally {
                recording.file.delete()
                _uiState.update { it.copy(busy = null) }
            }
        }
    }

    // ───────────────────────────── Attachments ─────────────────────────────

    /** Downloads, verifies and decrypts an attachment, then hands the file to [onReady]. */
    fun openAttachment(message: ChatMessage, onReady: (File, ChatAttachment) -> Unit) {
        val id = _uiState.value.activeConversationId ?: return
        val att = message.attachment ?: return
        _uiState.value.openedFiles[message.id]?.let { onReady(it, att); return }
        val c = client ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(busy = "Decrypting…") }
            try {
                val raw = c.message(id, message.id)?.media ?: return@launch
                val file = c.media.open(id, message.id, Media.parseFrom(raw))
                _uiState.update { it.copy(openedFiles = it.openedFiles + (message.id to file)) }
                onReady(file, att)
            } catch (e: Exception) {
                showError(e.message ?: "Could not open the attachment")
            } finally {
                _uiState.update { it.copy(busy = null) }
            }
        }
    }

    fun viewImage(file: File?) = _uiState.update { it.copy(viewingImage = file) }

    // ───────────────────────────── New chat ─────────────────────────────

    fun showNewChat(show: Boolean) {
        if (show && _uiState.value.contacts.isEmpty()) viewModelScope.launch { service.loadPeople() }
        _uiState.update { it.copy(showNewChat = show) }
    }

    private fun buildContacts() {
        val contacts = service.people.value.values
            .filter { it.userId != me }
            .sortedBy { it.name.lowercase() }
            .map { ChatContact(it.userId, it.name, it.role, it.department) }
        _uiState.update { it.copy(contacts = contacts) }
    }

    /** Opens the existing DM with this person, or creates it. */
    fun startDirect(userId: String) {
        val c = client ?: return
        _uiState.update { it.copy(showNewChat = false) }
        c.conversations.value.firstOrNull { conv -> conv.kind == "dm" && conv.members.any { it.userId == userId } }?.let {
            openConversation(it.id)
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(busy = "Setting up encrypted chat…") }
            try {
                val conv = c.createConversation("dm", listOf(userId))
                buildRoster()
                openConversation(conv.id)
            } catch (e: Exception) {
                showError(e.message ?: "Could not start the chat")
            } finally {
                _uiState.update { it.copy(busy = null) }
            }
        }
    }

    fun createGroup(name: String, memberIds: List<String>) {
        val c = client ?: return
        if (name.isBlank() || memberIds.isEmpty()) return
        _uiState.update { it.copy(showNewChat = false) }
        viewModelScope.launch {
            _uiState.update { it.copy(busy = "Creating group…") }
            try {
                val conv = c.createConversation("group", memberIds, name = name.trim())
                buildRoster()
                openConversation(conv.id)
            } catch (e: Exception) {
                showError(e.message ?: "Could not create the group")
            } finally {
                _uiState.update { it.copy(busy = null) }
            }
        }
    }

    // ───────────────────────────── Helpers ─────────────────────────────

    fun clearError() = _uiState.update { it.copy(error = null) }

    fun showError(message: String) = _uiState.update { it.copy(error = message) }

    /** The chat screen became visible or hidden (tab switches, app backgrounded). */
    fun setScreenVisible(visible: Boolean) {
        service.pulseScreenVisible = visible
        service.visibleConversationId = if (visible) _uiState.value.activeConversationId else null
    }

    override fun onCleared() {
        service.pulseScreenVisible = false
        service.visibleConversationId = null
        recorder?.cancel()
        super.onCleared()
    }

    private companion object {
        const val PAGE = 60
        val TIME: DateTimeFormatter = DateTimeFormatter.ofPattern("h:mm a")
        val DATE: DateTimeFormatter = DateTimeFormatter.ofPattern("d/M/yy")
        val LONG_DATE: DateTimeFormatter = DateTimeFormatter.ofPattern("d MMMM yyyy")

        fun parseTime(iso: String): Long = runCatching { Instant.parse(iso).toEpochMilli() }
            .recoverCatching { java.time.OffsetDateTime.parse(iso).toInstant().toEpochMilli() }.getOrDefault(0L)

        fun timeOfDay(ts: Long): String = Instant.ofEpochMilli(ts).atZone(ZoneId.systemDefault()).format(TIME)

        fun rosterTime(ts: Long): String {
            val day = Instant.ofEpochMilli(ts).atZone(ZoneId.systemDefault()).toLocalDate()
            val today = LocalDate.now()
            return when {
                day == today -> timeOfDay(ts)
                day == today.minusDays(1) -> "Yesterday"
                day.isAfter(today.minusDays(7)) -> day.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.getDefault())
                else -> day.format(DATE)
            }
        }

        fun dayLabel(day: LocalDate): String {
            val today = LocalDate.now()
            return when {
                day == today -> "TODAY"
                day == today.minusDays(1) -> "YESTERDAY"
                day.isAfter(today.minusDays(7)) -> day.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.getDefault()).uppercase()
                else -> day.format(LONG_DATE).uppercase()
            }
        }
    }
}
