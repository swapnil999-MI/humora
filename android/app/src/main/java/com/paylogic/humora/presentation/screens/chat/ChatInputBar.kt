package com.paylogic.humora.presentation.screens.chat

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.automirrored.filled.Reply
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.ripple
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.paylogic.humora.core.theme.TextPrimaryDark
import com.paylogic.humora.data.model.ChatMessage
import com.paylogic.humora.data.model.ChatReplyPreview
import kotlinx.coroutines.delay

/**
 * ChatInputBar — WhatsApp-style input dock: reply/edit banner, a rounded input pill with attach and
 * camera, and a round action button that sends text or, when the field is empty, records a voice
 * message (tap to start, tap again to send; the bin cancels).
 */
@Composable
fun ChatInputBar(
    inputText: String,
    onInputChange: (String) -> Unit,
    onSend: () -> Unit,
    replyTo: ChatReplyPreview?,
    editing: ChatMessage?,
    onCancelCompose: () -> Unit,
    onAttach: () -> Unit,
    onCamera: () -> Unit,
    recordingSince: Long?,
    onStartRecording: () -> Unit,
    onStopRecording: (send: Boolean) -> Unit,
) {
    val hasText = inputText.isNotBlank()
    val recording = recordingSince != null

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF0B141A))
            .navigationBarsPadding()
            .imePadding()
    ) {
        // Reply / edit banner
        val banner = when {
            editing != null -> Triple(Icons.Default.Edit, "Edit message", editing.text)
            replyTo != null -> Triple(Icons.AutoMirrored.Filled.Reply, "Replying to ${replyTo.senderName}", replyTo.text)
            else -> null
        }
        AnimatedVisibility(visible = banner != null) {
            if (banner != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 12.dp, end = 4.dp, top = 6.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color(0xFF1F2C34))
                        .padding(start = 10.dp, top = 6.dp, bottom = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(Modifier.width(3.dp).height(32.dp).background(Color(0xFF00A884), RoundedCornerShape(2.dp)))
                    Spacer(Modifier.width(8.dp))
                    Icon(banner.first, contentDescription = null, tint = Color(0xFF00A884), modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Column(Modifier.weight(1f)) {
                        Text(banner.second, color = Color(0xFF00A884), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        Text(banner.third, color = Color(0xFF8696A0), fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    IconButton(onClick = onCancelCompose, modifier = Modifier.size(36.dp)) {
                        Icon(Icons.Default.Close, contentDescription = "Cancel", tint = Color(0xFF8696A0), modifier = Modifier.size(18.dp))
                    }
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .defaultMinSize(minHeight = 48.dp)
                    .shadow(2.dp, RoundedCornerShape(26.dp), ambientColor = Color(0x33000000))
                    .clip(RoundedCornerShape(26.dp))
                    .background(Color(0xFF202C33))
                    .border(0.6.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(26.dp))
                    .padding(horizontal = 4.dp, vertical = 4.dp)
            ) {
                if (recording) {
                    RecordingIndicator(recordingSince!!, onCancel = { onStopRecording(false) })
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                        BasicTextField(
                            value = inputText,
                            onValueChange = onInputChange,
                            textStyle = TextStyle(color = TextPrimaryDark, fontSize = 15.sp, lineHeight = 20.sp),
                            cursorBrush = SolidColor(Color(0xFF00A884)),
                            // Enter inserts a newline; the send button sends.
                            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                            maxLines = 6,
                            decorationBox = { inner ->
                                if (inputText.isEmpty()) Text("Message", color = Color(0xFF8696A0), fontSize = 15.sp)
                                inner()
                            },
                            modifier = Modifier
                                .weight(1f)
                                .padding(start = 12.dp, end = 6.dp, top = 8.dp, bottom = 8.dp)
                        )
                        if (editing == null) {
                            IconButton(onClick = onAttach, modifier = Modifier.size(36.dp)) {
                                Icon(Icons.Default.AttachFile, contentDescription = "Attach a file", tint = Color(0xFF8696A0), modifier = Modifier.size(22.dp))
                            }
                            AnimatedVisibility(visible = !hasText, enter = fadeIn() + expandHorizontally(), exit = fadeOut() + shrinkHorizontally()) {
                                IconButton(onClick = onCamera, modifier = Modifier.size(36.dp)) {
                                    Icon(Icons.Default.CameraAlt, contentDescription = "Take a photo", tint = Color(0xFF8696A0), modifier = Modifier.size(22.dp))
                                }
                            }
                        }
                    }
                }
            }

            val showSend = hasText || recording || editing != null
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .shadow(6.dp, CircleShape, ambientColor = Color(0x44000000), spotColor = Color(0xFF00A884))
                    .clip(CircleShape)
                    .background(Brush.linearGradient(listOf(Color(0xFF00A884), Color(0xFF008069))))
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = ripple(bounded = true, color = Color.White.copy(alpha = 0.3f)),
                        onClick = {
                            when {
                                recording -> onStopRecording(true)
                                hasText -> onSend()
                                editing == null -> onStartRecording()
                            }
                        }
                    ),
                contentAlignment = Alignment.Center
            ) {
                AnimatedContent(targetState = showSend, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "SendMicToggle") { isSend ->
                    Icon(
                        imageVector = if (isSend) Icons.AutoMirrored.Filled.Send else Icons.Default.Mic,
                        contentDescription = if (isSend) "Send" else "Record a voice message",
                        tint = Color.White,
                        modifier = Modifier.size(if (isSend) 20.dp else 22.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun RecordingIndicator(since: Long, onCancel: () -> Unit) {
    var elapsed by remember { mutableLongStateOf(0L) }
    LaunchedEffect(since) {
        while (true) {
            elapsed = System.currentTimeMillis() - since
            delay(250)
        }
    }
    val seconds = elapsed / 1000
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 6.dp)
    ) {
        IconButton(onClick = onCancel, modifier = Modifier.size(32.dp)) {
            Icon(Icons.Default.Delete, contentDescription = "Discard recording", tint = Color(0xFFF15C6D), modifier = Modifier.size(22.dp))
        }
        Spacer(Modifier.width(6.dp))
        Box(Modifier.size(10.dp).background(Color(0xFFF15C6D), CircleShape))
        Spacer(Modifier.width(8.dp))
        Text("%d:%02d".format(seconds / 60, seconds % 60), color = TextPrimaryDark, fontSize = 15.sp)
        Spacer(Modifier.width(10.dp))
        Text("Recording…", color = Color(0xFF8696A0), fontSize = 13.sp)
    }
}
