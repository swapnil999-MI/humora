package com.paylogic.humora.presentation.screens.chat

import android.graphics.BitmapFactory
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.InsertDriveFile
import androidx.compose.material.icons.automirrored.filled.Reply
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.paylogic.humora.core.theme.*
import com.paylogic.humora.data.model.ChatAttachment
import com.paylogic.humora.data.model.ChatMessage
import com.paylogic.humora.pulse.Tick
import com.paylogic.humora.presentation.viewmodel.ChatUiState
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter

private val REACTIONS = listOf("👍", "❤️", "😂", "😮", "😢", "🙏")

/** Actions the conversation view can ask for; implemented by PulseChatScreen. */
class ConversationActions(
    val onBack: () -> Unit,
    val onSend: (String) -> Unit,
    val onInputChanged: (String) -> Unit,
    val onLoadOlder: () -> Unit,
    val onReact: (ChatMessage, String) -> Unit,
    val onReply: (ChatMessage) -> Unit,
    val onEdit: (ChatMessage) -> Unit,
    val onDelete: (ChatMessage) -> Unit,
    val onRetry: (ChatMessage) -> Unit,
    val onCancelCompose: () -> Unit,
    val onOpenAttachment: (ChatMessage) -> Unit,
    val onAttach: () -> Unit,
    val onCamera: () -> Unit,
    val onStartRecording: () -> Unit,
    val onStopRecording: (Boolean) -> Unit,
)

/**
 * ChatConversationView — one end-to-end encrypted conversation, WhatsApp-style: real delivery
 * ticks, day separators, replies, attachments, voice messages and a long-press action sheet.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatConversationView(
    uiState: ChatUiState,
    actions: ConversationActions,
    playingId: String?,
) {
    var inputText by remember(uiState.activeConversationId) { mutableStateOf("") }
    var actionTarget by remember { mutableStateOf<ChatMessage?>(null) }
    val listState = rememberLazyListState()

    // Editing pre-fills the field with the original text.
    LaunchedEffect(uiState.editing?.id) { uiState.editing?.let { inputText = it.text } }

    // Follow new messages when the user is already at the bottom (and always for their own).
    val lastId = uiState.messages.lastOrNull()?.id
    LaunchedEffect(lastId) {
        if (uiState.messages.isEmpty()) return@LaunchedEffect
        val lastVisible = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
        val nearBottom = lastVisible >= listState.layoutInfo.totalItemsCount - 3
        if (nearBottom || uiState.messages.last().isMe) listState.animateScrollToItem(uiState.messages.size - 1)
    }
    // Reaching the top loads the previous page.
    LaunchedEffect(listState, uiState.hasOlder) {
        snapshotFlow { listState.firstVisibleItemIndex }
            .distinctUntilChanged()
            .filter { it == 0 && uiState.hasOlder }
            .collect { actions.onLoadOlder() }
    }

    Column(modifier = Modifier.fillMaxSize().background(Color(0xFF0B141A))) {
        ConversationTopBar(uiState, actions.onBack)

        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(3.dp)
            ) {
                items(uiState.messages, key = { it.id }) { msg ->
                    Column {
                        msg.dayHeader?.let { DayPill(it) }
                        MessageBubble(
                            message = msg,
                            showSender = uiState.activeKind != "dm",
                            playing = playingId == msg.id,
                            onLongPress = { actionTarget = msg },
                            onReactionClick = { actions.onReact(msg, it) },
                            onAttachmentClick = { actions.onOpenAttachment(msg) },
                            onRetry = { actions.onRetry(msg) },
                        )
                    }
                }
                if (uiState.messages.isEmpty()) {
                    item { EncryptionNotice(Modifier.fillParentMaxWidth().padding(vertical = 48.dp)) }
                }
            }
        }

        ChatInputBar(
            inputText = inputText,
            onInputChange = {
                inputText = it
                actions.onInputChanged(it)
            },
            onSend = {
                actions.onSend(inputText)
                inputText = ""
            },
            replyTo = uiState.replyTo,
            editing = uiState.editing,
            onCancelCompose = {
                if (uiState.editing != null) inputText = ""
                actions.onCancelCompose()
            },
            onAttach = actions.onAttach,
            onCamera = actions.onCamera,
            recordingSince = uiState.recordingSince,
            onStartRecording = actions.onStartRecording,
            onStopRecording = actions.onStopRecording,
        )
    }

    actionTarget?.let { target ->
        MessageActionSheet(
            message = target,
            onDismiss = { actionTarget = null },
            onReact = { actions.onReact(target, it); actionTarget = null },
            onReply = { actions.onReply(target); actionTarget = null },
            onEdit = { actions.onEdit(target); actionTarget = null },
            onDelete = { actions.onDelete(target); actionTarget = null },
            onRetry = { actions.onRetry(target); actionTarget = null },
        )
    }
}

@Composable
private fun ConversationTopBar(uiState: ChatUiState, onBack: () -> Unit) {
    val isGroup = uiState.activeKind != "dm"
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF0C131A))
            .statusBarsPadding()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onBack, modifier = Modifier.size(40.dp)) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TextPrimaryDark, modifier = Modifier.size(22.dp))
        }
        Avatar(uiState.activeTitle, isGroup, 38)
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(uiState.activeTitle, fontSize = 15.5.sp, fontWeight = FontWeight.SemiBold, color = TextPrimaryDark, maxLines = 1, overflow = TextOverflow.Ellipsis)
            val subtitle = if (!uiState.connected) "connecting…" else uiState.activeSubtitle
            if (subtitle.isNotBlank()) {
                Text(
                    subtitle,
                    fontSize = 11.5.sp,
                    color = if (subtitle.endsWith("typing…")) Color(0xFF00A884) else Color(0xFF8696A0),
                    maxLines = 1, overflow = TextOverflow.Ellipsis
                )
            }
        }
        Icon(Icons.Default.Lock, contentDescription = "End-to-end encrypted", tint = Color(0xFF8696A0), modifier = Modifier.padding(end = 14.dp).size(16.dp))
    }
}

@Composable
internal fun Avatar(name: String, isGroup: Boolean, sizeDp: Int) {
    Box(
        modifier = Modifier
            .size(sizeDp.dp)
            .clip(CircleShape)
            .background(
                if (isGroup) Brush.linearGradient(listOf(Color(0xFF133E38), Color(0xFF0A221F)))
                else Brush.linearGradient(listOf(ClaySurfaceElevated, ClaySurfacePressed))
            )
            .border(1.dp, if (isGroup) Color(0xFF00A884).copy(alpha = 0.4f) else Color.White.copy(alpha = 0.12f), CircleShape),
        contentAlignment = Alignment.Center
    ) {
        if (isGroup) {
            Icon(Icons.Default.Groups, contentDescription = null, tint = Color(0xFF00A884), modifier = Modifier.size((sizeDp / 2).dp))
        } else {
            Text(name.firstOrNull()?.uppercase() ?: "?", fontSize = (sizeDp * 0.4f).sp, fontWeight = FontWeight.Bold, color = TextPrimaryDark)
        }
    }
}

@Composable
private fun DayPill(label: String) {
    Box(Modifier.fillMaxWidth().padding(vertical = 10.dp), contentAlignment = Alignment.Center) {
        Text(
            label,
            fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF8696A0), letterSpacing = 0.8.sp,
            modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(Color(0xFF182229)).padding(horizontal = 12.dp, vertical = 5.dp)
        )
    }
}

@Composable
private fun EncryptionNotice(modifier: Modifier) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            "🔒 Messages and files are end-to-end encrypted. Only the people in this chat can read them.",
            color = Color(0xFFFFD279), fontSize = 11.5.sp, lineHeight = 16.sp,
            modifier = Modifier.padding(horizontal = 32.dp).clip(RoundedCornerShape(10.dp)).background(Color(0xFF182229)).padding(horizontal = 16.dp, vertical = 8.dp)
        )
        Spacer(Modifier.height(18.dp))
        Text("Send a message to start chatting", color = Color(0xFF8696A0), fontSize = 13.sp)
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MessageBubble(
    message: ChatMessage,
    showSender: Boolean,
    playing: Boolean,
    onLongPress: () -> Unit,
    onReactionClick: (String) -> Unit,
    onAttachmentClick: () -> Unit,
    onRetry: () -> Unit,
) {
    val isMe = message.isMe
    val shape = RoundedCornerShape(topStart = if (isMe) 14.dp else 4.dp, topEnd = if (isMe) 4.dp else 14.dp, bottomStart = 14.dp, bottomEnd = 14.dp)
    val bg = if (isMe) Brush.linearGradient(listOf(Color(0xFF005C4B), Color(0xFF025142)))
    else Brush.linearGradient(listOf(Color(0xFF202C33), Color(0xFF1D272E)))

    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 1.dp), horizontalAlignment = if (isMe) Alignment.End else Alignment.Start) {
        Box(
            modifier = Modifier
                .widthIn(max = 300.dp)
                .clip(shape)
                .background(bg)
                .combinedClickable(
                    onClick = { if (message.tick == Tick.FAILED) onRetry() else if (message.attachment != null && !message.deleted) onAttachmentClick() },
                    onLongClick = { if (!message.deleted && !message.unavailable) onLongPress() },
                )
                .padding(start = 9.dp, top = 6.dp, end = 9.dp, bottom = 5.dp)
        ) {
            Column {
                if (!isMe && showSender) {
                    Text(message.senderName, fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = senderColor(message.senderId), modifier = Modifier.padding(bottom = 3.dp))
                }
                message.replyTo?.let { r ->
                    Row(
                        Modifier.padding(bottom = 5.dp).clip(RoundedCornerShape(6.dp)).background(Color(0x33000000)).padding(end = 8.dp).height(IntrinsicSize.Min)
                    ) {
                        Box(Modifier.width(3.dp).fillMaxHeight().background(Color(0xFF53BDEB)))
                        Column(Modifier.padding(start = 7.dp, top = 4.dp, bottom = 4.dp)) {
                            Text(r.senderName, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF53BDEB))
                            Text(r.text, fontSize = 12.sp, color = Color(0xFFB0BEC5), maxLines = 2, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }

                when {
                    message.deleted -> Text(
                        if (isMe) "🚫 You deleted this message" else "🚫 This message was deleted",
                        fontSize = 14.sp, fontStyle = FontStyle.Italic, color = Color(0xFF8696A0)
                    )
                    message.unavailable -> Text(
                        "🔒 Waiting for this message. It will appear once one of your devices shares the key.",
                        fontSize = 13.sp, fontStyle = FontStyle.Italic, color = Color(0xFF8696A0)
                    )
                    else -> {
                        message.attachment?.let { AttachmentView(it, playing) }
                        if (message.text.isNotBlank()) {
                            if (message.attachment != null) Spacer(Modifier.height(4.dp))
                            Text(message.text, fontSize = 14.5.sp, color = TextPrimaryDark, lineHeight = 20.sp)
                        }
                    }
                }

                Row(modifier = Modifier.align(Alignment.End).padding(top = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (message.edited && !message.deleted) {
                        Text("edited", fontSize = 10.sp, fontStyle = FontStyle.Italic, color = Color(0xFF8DA39C))
                        Spacer(Modifier.width(4.dp))
                    }
                    Text(message.timeLabel, fontSize = 10.5.sp, color = if (isMe) Color(0xFF8DA39C) else Color(0xFF8696A0))
                    message.tick?.let { Spacer(Modifier.width(3.dp)); TickIcon(it) }
                }
            }
        }

        if (message.reactions.isNotEmpty()) {
            Row(Modifier.offset(y = (-4).dp).padding(horizontal = 6.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                message.reactions.forEach { reaction ->
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (reaction.mine) Color(0xFF0F3E36) else Color(0xFF1F2C34))
                            .border(0.8.dp, if (reaction.mine) Color(0xFF00A884) else Color.White.copy(alpha = 0.12f), RoundedCornerShape(12.dp))
                            .clickable { onReactionClick(reaction.emoji) }
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(reaction.emoji, fontSize = 12.sp)
                        if (reaction.count > 1) {
                            Spacer(Modifier.width(3.dp))
                            Text("${reaction.count}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF8696A0))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TickIcon(tick: Tick) {
    val (icon, tint, label) = when (tick) {
        Tick.PENDING -> Triple(Icons.Default.Schedule, Color(0xFF8DA39C), "Sending")
        Tick.FAILED -> Triple(Icons.Default.ErrorOutline, Color(0xFFF15C6D), "Not sent, tap to retry")
        Tick.SENT -> Triple(Icons.Default.Done, Color(0xFF8DA39C), "Sent")
        Tick.DELIVERED -> Triple(Icons.Default.DoneAll, Color(0xFF8DA39C), "Delivered")
        Tick.READ -> Triple(Icons.Default.DoneAll, Color(0xFF53BDEB), "Read")
    }
    Icon(icon, contentDescription = label, tint = tint, modifier = Modifier.size(15.dp))
}

@Composable
private fun AttachmentView(att: ChatAttachment, playing: Boolean) {
    when {
        att.isImage -> {
            val bitmap = remember(att) { att.thumbnail?.let { runCatching { BitmapFactory.decodeByteArray(it, 0, it.size)?.asImageBitmap() }.getOrNull() } }
            val ratio = if (att.width > 0 && att.height > 0) (att.width.toFloat() / att.height).coerceIn(0.5f, 2f) else 1.33f
            Box(
                Modifier.width(240.dp).aspectRatio(ratio).clip(RoundedCornerShape(8.dp)).background(Color(0x33000000)),
                contentAlignment = Alignment.Center
            ) {
                if (bitmap != null) Image(bitmap, contentDescription = att.fileName, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                else Icon(Icons.Default.Image, contentDescription = att.fileName, tint = Color(0xFF8696A0), modifier = Modifier.size(36.dp))
            }
        }
        att.isVoice -> Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.width(230.dp)) {
            Icon(
                if (playing) Icons.Default.PauseCircle else Icons.Default.PlayCircle,
                contentDescription = if (playing) "Pause" else "Play voice message",
                tint = Color(0xFF00A884), modifier = Modifier.size(36.dp)
            )
            Spacer(Modifier.width(6.dp))
            Waveform(att.waveform, Modifier.weight(1f).height(26.dp))
            Spacer(Modifier.width(6.dp))
            val sec = att.durationMs / 1000
            Text("%d:%02d".format(sec / 60, sec % 60), fontSize = 11.sp, color = Color(0xFF8696A0))
        }
        else -> Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.widthIn(min = 200.dp).clip(RoundedCornerShape(8.dp)).background(Color(0x33000000)).padding(10.dp)
        ) {
            Icon(Icons.AutoMirrored.Filled.InsertDriveFile, contentDescription = null, tint = Color(0xFF8696A0), modifier = Modifier.size(30.dp))
            Spacer(Modifier.width(8.dp))
            Column {
                Text(att.fileName, fontSize = 13.5.sp, color = TextPrimaryDark, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(formatBytes(att.sizeBytes) + " · " + att.mimeType.substringAfter('/').uppercase().take(8), fontSize = 11.sp, color = Color(0xFF8696A0))
            }
        }
    }
}

@Composable
private fun Waveform(samples: ByteArray?, modifier: Modifier) {
    val bars = samples?.map { (it.toInt() and 0xff) / 255f } ?: List(40) { 0.35f }
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(1.5.dp)) {
        bars.forEach { level ->
            Box(Modifier.weight(1f).fillMaxHeight(level.coerceIn(0.12f, 1f)).clip(RoundedCornerShape(1.dp)).background(Color(0xFF8DA39C)))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MessageActionSheet(
    message: ChatMessage,
    onDismiss: () -> Unit,
    onReact: (String) -> Unit,
    onReply: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onRetry: () -> Unit,
) {
    val clipboard = LocalClipboardManager.current
    var confirmDelete by remember { mutableStateOf(false) }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Color(0xFF1F2C34)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            REACTIONS.forEach { emoji ->
                val mine = message.reactions.any { it.mine && it.emoji == emoji }
                Text(
                    emoji, fontSize = 26.sp,
                    modifier = Modifier.clip(CircleShape).background(if (mine) Color(0xFF0F3E36) else Color.Transparent).clickable { onReact(emoji) }.padding(6.dp)
                )
            }
        }
        HorizontalDivider(color = Color.White.copy(alpha = 0.06f))
        if (message.tick == Tick.FAILED) SheetAction(Icons.Default.Refresh, "Try sending again", onClick = onRetry)
        if (message.tick != Tick.PENDING && message.tick != Tick.FAILED) SheetAction(Icons.AutoMirrored.Filled.Reply, "Reply", onClick = onReply)
        if (message.text.isNotBlank()) SheetAction(Icons.Default.ContentCopy, "Copy text") { clipboard.setText(AnnotatedString(message.text)); onDismiss() }
        if (message.isMe && message.attachment == null && message.tick != Tick.PENDING && message.tick != Tick.FAILED) SheetAction(Icons.Default.Edit, "Edit", onClick = onEdit)
        if (message.isMe && message.tick != Tick.PENDING) SheetAction(Icons.Default.Delete, "Delete for everyone", tint = Color(0xFFF15C6D)) { confirmDelete = true }
        Spacer(Modifier.height(24.dp))
    }
    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete for everyone?") },
            text = { Text("Everyone in this chat will see that the message was deleted.") },
            confirmButton = { TextButton(onClick = { confirmDelete = false; onDelete() }) { Text("Delete", color = Color(0xFFF15C6D)) } },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun SheetAction(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, tint: Color = TextPrimaryDark, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 24.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(18.dp))
        Text(label, color = tint, fontSize = 15.sp)
    }
}

private val SENDER_COLORS = listOf(0xFF53BDEB, 0xFFFFD279, 0xFFE78FFF, 0xFF7AE3A6, 0xFFFF9D7A, 0xFF9DA8FF).map { Color(it) }

private fun senderColor(userId: String) = SENDER_COLORS[(userId.hashCode() and 0x7fffffff) % SENDER_COLORS.size]

internal fun formatBytes(n: Long): String = when {
    n >= 1L shl 20 -> "%.1f MB".format(n / (1024.0 * 1024))
    else -> "${maxOf(1, n / 1024)} KB"
}
