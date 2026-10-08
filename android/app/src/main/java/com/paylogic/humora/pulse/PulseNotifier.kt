package com.paylogic.humora.pulse

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.content.ContextCompat
import com.paylogic.humora.MainActivity
import com.paylogic.humora.R
import com.paylogic.humora.pulse.store.LocalMessage
import com.paylogic.humora.pulse.v1.Media
import com.paylogic.humora.pulse.v1.MediaKind

/**
 * Shows one notification per conversation for messages the user has not seen, built on the device
 * from decrypted content (the push that woke the app carried none). Tapping it opens the chat.
 */
class PulseNotifier(private val context: Context) {

    init {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Messages", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "New Pulse chat messages"
                enableVibration(true)
            }
            context.getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    val permitted: Boolean
        get() = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    /** Notifies about [messages] (oldest first) in one conversation. */
    fun show(conversationId: String, title: String, isGroup: Boolean, messages: List<LocalMessage>, nameOf: (String) -> String) {
        if (messages.isEmpty() || !permitted) return
        val me = Person.Builder().setName("You").build()
        val style = NotificationCompat.MessagingStyle(me).setGroupConversation(isGroup)
        if (isGroup) style.setConversationTitle(title)
        for (m in messages.takeLast(MAX_LINES)) {
            style.addMessage(preview(m), m.ts, Person.Builder().setName(nameOf(m.senderId)).setKey(m.senderId).build())
        }
        val open = PendingIntent.getActivity(
            context,
            conversationId.hashCode(),
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra(EXTRA_CONVERSATION_ID, conversationId),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setStyle(style)
            .setContentTitle(title)
            .setContentText(preview(messages.last()))
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            // Message text stays off the lock screen unless the user allows it in system settings.
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setNumber(messages.size)
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        try {
            NotificationManagerCompat.from(context).notify(TAG, conversationId.hashCode(), notification)
        } catch (e: SecurityException) {
            // Permission revoked between the check and the call.
        }
    }

    fun cancel(conversationId: String) {
        NotificationManagerCompat.from(context).cancel(TAG, conversationId.hashCode())
    }

    fun cancelAll() {
        NotificationManagerCompat.from(context).cancelAll()
    }

    private fun preview(m: LocalMessage): String = when {
        m.unavailable -> "New message"
        m.media != null -> when (runCatching { Media.parseFrom(m.media).kind }.getOrNull()) {
            MediaKind.MEDIA_KIND_IMAGE -> "📷 Photo"
            MediaKind.MEDIA_KIND_VIDEO -> "🎬 Video"
            MediaKind.MEDIA_KIND_AUDIO, MediaKind.MEDIA_KIND_VOICE_NOTE -> "🎤 Voice message"
            else -> "📄 File"
        } + if (m.text.isNotBlank()) " · ${m.text}" else ""
        else -> m.text
    }

    companion object {
        const val CHANNEL_ID = "pulse_messages"
        const val EXTRA_CONVERSATION_ID = "pulse_conversation_id"
        private const val TAG = "pulse"
        private const val MAX_LINES = 6
    }
}
