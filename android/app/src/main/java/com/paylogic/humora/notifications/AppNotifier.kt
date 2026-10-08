package com.paylogic.humora.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import com.paylogic.humora.MainActivity
import com.paylogic.humora.R
import com.paylogic.humora.data.model.AppNotificationDto
import com.paylogic.humora.data.remote.HumoraApiClient
import com.paylogic.humora.data.remote.NetworkResult
import com.paylogic.humora.data.remote.SessionManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.OffsetDateTime

/**
 * Shows the server's in-app notifications (leave decisions, approvals waiting, payslips, task
 * assignments ...) as system notifications. A push only says "something new"; the app fetches the
 * list over the authenticated API and shows each unread item once. Without push it checks while
 * the app is open.
 */
class AppNotifier(
    private val context: Context,
    private val session: SessionManager,
    private val api: HumoraApiClient,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val lock = Mutex()
    private val prefs = context.getSharedPreferences("humora_notifications", Context.MODE_PRIVATE)
    private var pollJob: Job? = null

    init {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Updates", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Leave decisions, approvals waiting for you, payslips and task assignments"
            }
            context.getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
        ProcessLifecycleOwner.get().lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onStart(owner: LifecycleOwner) {
                pollJob?.cancel()
                pollJob = scope.launch {
                    while (isActive) {
                        sync()
                        delay(FOREGROUND_POLL_MS)
                    }
                }
            }

            override fun onStop(owner: LifecycleOwner) {
                pollJob?.cancel()
            }
        })
        scope.launch {
            session.isLoggedIn.collect { loggedIn -> if (!loggedIn) reset() }
        }
    }

    private val permitted: Boolean
        get() = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    /** Fetches the latest notifications and shows the unread ones not shown before. */
    suspend fun sync() = lock.withLock {
        if (session.accessToken.isBlank()) return@withLock
        val res = api.getNotifications(limit = 30)
        val items = (res as? NetworkResult.Success)?.data?.items ?: return@withLock
        val owner = session.userId
        if (prefs.getString(KEY_OWNER, null) != owner) {
            // First run for this account: only recent items are news, not the whole backlog.
            prefs.edit().putString(KEY_OWNER, owner).putLong(KEY_WATERMARK, System.currentTimeMillis() - FIRST_RUN_WINDOW_MS).apply()
        }
        val watermark = prefs.getLong(KEY_WATERMARK, 0)
        val fresh = items
            .filter { it.readAt == null }
            .mapNotNull { n -> millis(n.createdAt)?.let { n to it } }
            .filter { (_, at) -> at > watermark }
            .sortedBy { (_, at) -> at }
        if (fresh.isEmpty()) return@withLock
        for ((n, _) in fresh.takeLast(MAX_SHOWN)) show(n)
        prefs.edit().putLong(KEY_WATERMARK, fresh.maxOf { it.second }).apply()
    }

    private fun show(n: AppNotificationDto) {
        if (!permitted) return
        val open = PendingIntent.getActivity(
            context,
            n.id.hashCode(),
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra(EXTRA_NOTIFICATION_ID, n.id),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(n.title)
            .setContentText(n.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(n.body))
            .setWhen(millis(n.createdAt) ?: System.currentTimeMillis())
            .setShowWhen(true)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setGroup(GROUP)
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        try {
            NotificationManagerCompat.from(context).notify(TAG, n.id.hashCode(), notification)
        } catch (e: SecurityException) {
            // Permission revoked between the check and the call.
        }
    }

    /** The user opened a notification: it is read on every device. */
    fun opened(notificationId: String) {
        scope.launch { runCatching { api.markNotificationRead(notificationId) } }
    }

    private fun reset() {
        prefs.edit().clear().apply()
        runCatching { NotificationManagerCompat.from(context).cancelAll() }
    }

    private fun millis(iso: String): Long? = try {
        OffsetDateTime.parse(iso).toInstant().toEpochMilli()
    } catch (e: Exception) {
        Log.w(TAG, "bad notification time $iso")
        null
    }

    companion object {
        const val CHANNEL_ID = "humora_updates"
        const val EXTRA_NOTIFICATION_ID = "humora_notification_id"
        private const val TAG = "AppNotifier"
        private const val GROUP = "humora_updates"
        private const val KEY_OWNER = "owner"
        private const val KEY_WATERMARK = "watermark"
        private const val MAX_SHOWN = 5
        private const val FOREGROUND_POLL_MS = 60_000L
        private const val FIRST_RUN_WINDOW_MS = 60 * 60_000L
    }
}
