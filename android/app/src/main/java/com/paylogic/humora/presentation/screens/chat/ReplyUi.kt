package com.paylogic.humora.presentation.screens.chat

import android.graphics.BitmapFactory
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.InsertDriveFile
import androidx.compose.material.icons.automirrored.filled.Reply
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.paylogic.humora.data.model.ChatReplyPreview
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/** WhatsApp shows your own quoted messages in teal and other people in their name colour. */
private val OWN_QUOTE_COLOR = Color(0xFF06CF9C)

internal fun replyAccent(preview: ChatReplyPreview): Color = when {
    preview.isMe -> OWN_QUOTE_COLOR
    preview.senderId.isEmpty() -> Color(0xFF8696A0)
    else -> senderColor(preview.senderId)
}

private fun mediaIcon(kind: Int): ImageVector? = when (kind) {
    0 -> null
    1 -> Icons.Default.PhotoCamera
    2 -> Icons.Default.Videocam
    3, 4 -> Icons.Default.Mic
    else -> Icons.AutoMirrored.Filled.InsertDriveFile
}

/**
 * The quoted message: coloured bar, sender name, one-line snippet with a media icon and, for
 * photos, a square thumbnail on the right. Used inside bubbles and above the composer.
 *
 * @param background tint behind the quote; darker than the surrounding bubble or pill.
 * @param onClose shows the close button (composer only).
 */
@Composable
internal fun ReplyQuote(
    preview: ChatReplyPreview,
    background: Color,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    onClose: (() -> Unit)? = null,
) {
    val accent = replyAccent(preview)
    val thumb = remember(preview.messageId, preview.thumbnail) {
        preview.thumbnail?.let { runCatching { BitmapFactory.decodeByteArray(it, 0, it.size)?.asImageBitmap() }.getOrNull() }
    }
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(background)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .height(IntrinsicSize.Min),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(Modifier.width(4.dp).fillMaxHeight().background(accent))
        Column(
            Modifier
                .weight(1f, fill = false)
                .widthIn(min = 120.dp)
                .padding(start = 8.dp, end = if (thumb == null && onClose == null) 10.dp else 6.dp, top = 6.dp, bottom = 6.dp)
        ) {
            if (preview.senderName.isNotEmpty()) {
                Text(preview.senderName, color = accent, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                mediaIcon(preview.mediaKind)?.let {
                    Icon(it, contentDescription = null, tint = Color(0xFF8696A0), modifier = Modifier.size(15.dp))
                    Spacer(Modifier.width(4.dp))
                }
                Text(
                    preview.text,
                    color = Color(0xFFAEBAC1),
                    fontSize = 13.sp,
                    maxLines = if (onClose != null) 1 else 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        if (thumb != null) {
            Image(
                thumb, contentDescription = null, contentScale = ContentScale.Crop,
                modifier = Modifier.size(52.dp).clip(RoundedCornerShape(topEnd = 8.dp, bottomEnd = 8.dp))
            )
        }
        if (onClose != null) {
            Box(
                Modifier
                    .align(Alignment.Top)
                    .padding(4.dp)
                    .size(26.dp)
                    .clip(CircleShape)
                    .clickable(onClick = onClose),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Close, contentDescription = "Cancel reply", tint = Color(0xFF8696A0), modifier = Modifier.size(18.dp))
            }
        }
    }
}

/**
 * Swipe a message to the right to reply, as in WhatsApp: the bubble follows the finger, a reply
 * icon grows in behind it, the phone ticks once the swipe is far enough, and it springs back.
 */
@Composable
internal fun SwipeToReply(
    enabled: Boolean,
    onReply: () -> Unit,
    content: @Composable () -> Unit,
) {
    if (!enabled) {
        content()
        return
    }
    val density = LocalDensity.current
    val haptics = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val maxPx = with(density) { 84.dp.toPx() }
    val triggerPx = with(density) { 56.dp.toPx() }
    val offset = remember { Animatable(0f) }
    var armed by remember { mutableStateOf(false) }
    // The gesture handler lives across recompositions; always call the latest callback.
    val currentOnReply by rememberUpdatedState(onReply)

    Box(
        Modifier.pointerInput(Unit) {
            detectHorizontalDragGestures(
                onDragEnd = {
                    if (armed) currentOnReply()
                    armed = false
                    scope.launch { offset.animateTo(0f, spring(dampingRatio = 0.7f, stiffness = 500f)) }
                },
                onDragCancel = {
                    armed = false
                    scope.launch { offset.animateTo(0f) }
                },
                onHorizontalDrag = { change, drag ->
                    val next = (offset.value + drag * 0.85f).coerceIn(0f, maxPx)
                    if (next != offset.value) change.consume()
                    scope.launch { offset.snapTo(next) }
                    val nowArmed = next >= triggerPx
                    if (nowArmed && !armed) haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                    armed = nowArmed
                },
            )
        }
    ) {
        val progress = (offset.value / triggerPx).coerceIn(0f, 1f)
        Box(
            Modifier
                .align(Alignment.CenterStart)
                .padding(start = 6.dp)
                .alpha(progress)
                .scale(0.6f + 0.4f * progress)
                .size(32.dp)
                .clip(CircleShape)
                .background(Color(0xFF202C33)),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.AutoMirrored.Filled.Reply, contentDescription = null, tint = Color(0xFFE9EDEF), modifier = Modifier.size(18.dp))
        }
        Box(Modifier.offset { IntOffset(offset.value.roundToInt(), 0) }) {
            content()
        }
    }
}
