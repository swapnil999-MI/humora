package com.paylogic.humora.data.model

import com.paylogic.humora.pulse.Tick

// ==========================================
// PULSE / CHAT UI MODELS
// Built by ChatViewModel from the end-to-end encrypted PulseClient; nothing here is stored.
// ==========================================

/** One row in the conversation list. */
data class ChatRow(
    val id: String,
    /** dm | group | channel */
    val kind: String,
    val title: String,
    /** Topic for channels/groups, job title for DMs. */
    val subtitle: String,
    val snippet: String,
    val timeLabel: String,
    val sortTs: Long,
    val unread: Int,
    /** Tick of the last message when the current user sent it, else null. */
    val lastTick: Tick?,
    val typing: String? = null,
) {
    val isGroup: Boolean get() = kind != "dm"
}

data class ChatReaction(val emoji: String, val count: Int, val mine: Boolean)

data class ChatAttachment(
    /** pulse.v1.MediaKind number. */
    val kind: Int,
    val fileName: String,
    val mimeType: String,
    val sizeBytes: Long,
    val width: Int,
    val height: Int,
    val durationMs: Int,
    val thumbnail: ByteArray?,
    val waveform: ByteArray?,
) {
    val isImage get() = kind == 1
    val isVoice get() = kind == 3 || kind == 4

    override fun equals(other: Any?) = other is ChatAttachment && other.fileName == fileName && other.sizeBytes == sizeBytes && other.kind == kind
    override fun hashCode() = fileName.hashCode() * 31 + sizeBytes.hashCode()
}

/**
 * The quoted message shown above a reply (in the bubble and in the composer), WhatsApp-style:
 * coloured sender name, one-line snippet, a media icon and a thumbnail for photos.
 */
data class ChatReplyPreview(
    val messageId: String,
    val senderId: String,
    val senderName: String,
    val isMe: Boolean,
    val text: String,
    /** pulse.v1.MediaKind number, 0 for text. */
    val mediaKind: Int = 0,
    val thumbnail: ByteArray? = null,
    /** The original is deleted, still locked, or not on this device; there is nothing to jump to. */
    val unavailable: Boolean = false,
) {
    override fun equals(other: Any?) = other is ChatReplyPreview && other.messageId == messageId && other.text == text &&
        other.senderName == senderName && other.unavailable == unavailable && other.mediaKind == mediaKind
    override fun hashCode() = messageId.hashCode() * 31 + text.hashCode()
}

/** One message bubble, or a day separator when [dayHeader] is set. */
data class ChatMessage(
    val id: String,
    val senderId: String,
    val senderName: String,
    val isMe: Boolean,
    val text: String,
    val timeLabel: String,
    val ts: Long,
    val sortOrder: Long,
    val tick: Tick?,
    val edited: Boolean,
    val deleted: Boolean,
    /** Sent before this device had the key; it becomes readable once another device shares it. */
    val unavailable: Boolean,
    val reactions: List<ChatReaction>,
    val attachment: ChatAttachment?,
    val replyTo: ChatReplyPreview?,
    val dayHeader: String? = null,
    /** Starred on this phone (kept locally, like WhatsApp's starred messages). */
    val starred: Boolean = false,
)

/** Someone the user can start a chat with. */
data class ChatContact(val userId: String, val name: String, val role: String, val department: String)
