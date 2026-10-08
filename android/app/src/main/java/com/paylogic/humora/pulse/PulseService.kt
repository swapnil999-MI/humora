package com.paylogic.humora.pulse

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.os.Build
import android.util.Log
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import com.paylogic.humora.data.remote.HumoraApiClient
import com.paylogic.humora.data.remote.NetworkResult
import com.paylogic.humora.data.remote.SessionManager
import com.paylogic.humora.pulse.store.PulseStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/** Someone in the organisation, as chat shows them. */
data class PulsePerson(val userId: String, val name: String, val role: String, val department: String, val avatarUrl: String?)

/**
 * Owns Pulse for the whole app: starts the encrypted client for the signed-in user, keeps the
 * people directory, reconnects when the network returns, and holds the gateway connection only
 * while the app is in the foreground.
 */
class PulseService(
    private val context: Context,
    private val session: SessionManager,
    private val apiClient: HumoraApiClient,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val lock = Mutex()

    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        // Detects half-open gateway connections at the transport level as well.
        .pingInterval(30, TimeUnit.SECONDS)
        .build()

    private var store: PulseStore? = null
    private var backgroundJob: Job? = null
    private var clientJobs: Job? = null
    @Volatile private var inForeground = false

    val notifier = PulseNotifier(context)

    /** Push needs a Firebase project (see build.gradle.kts); without one the app still works, just without push. */
    val pushEnabled: Boolean = initFirebase()

    /** Whether the Pulse screen is showing; while it is, new messages are visible and need no notification. */
    @Volatile var pulseScreenVisible = false

    /** Whether the user is looking at this conversation right now (only then is it marked read). */
    fun isUserLooking(conversationId: String) =
        inForeground && pulseScreenVisible && visibleConversationId == conversationId

    private fun shouldNotify(conversationId: String) =
        !inForeground || (!pulseScreenVisible && visibleConversationId != conversationId)

    /** The conversation currently on screen; it gets no notifications. */
    @Volatile var visibleConversationId: String? = null
        set(value) {
            field = value
            value?.let { notifier.cancel(it) }
        }

    private val _openRequests = MutableStateFlow<String?>(null)
    /** A conversation the user asked to open from a notification; consumed by the chat screen. */
    val openRequests: StateFlow<String?> = _openRequests.asStateFlow()
    fun requestOpen(conversationId: String?) { _openRequests.value = conversationId }
    fun consumeOpenRequest() { _openRequests.value = null }

    private val _client = MutableStateFlow<PulseClient?>(null)
    /** The running client, or null while signed out. */
    val client: StateFlow<PulseClient?> = _client.asStateFlow()

    private val _people = MutableStateFlow<Map<String, PulsePerson>>(emptyMap())
    val people: StateFlow<Map<String, PulsePerson>> = _people.asStateFlow()

    init {
        ProcessLifecycleOwner.get().lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onStart(owner: LifecycleOwner) {
                inForeground = true
                backgroundJob?.cancel()
                _client.value?.setForeground(true)
                // Back to a chat that stayed open: what arrived meanwhile is now seen.
                val open = visibleConversationId
                if (pulseScreenVisible && open != null) {
                    _client.value?.markRead(open)
                    notifier.cancel(open)
                }
            }

            override fun onStop(owner: LifecycleOwner) {
                inForeground = false
                // Keep the connection briefly so switching apps does not drop it.
                backgroundJob = scope.launch {
                    delay(BACKGROUND_GRACE_MS)
                    _client.value?.setForeground(false)
                }
            }
        })
        val cm = context.getSystemService(ConnectivityManager::class.java)
        if (cm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            cm.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    _client.value?.onNetworkAvailable()
                }
            })
        }
        scope.launch {
            session.isLoggedIn.collect { loggedIn -> if (loggedIn) ensureStarted() else suspendClient() }
        }
    }

    /** Starts the client for the signed-in user (idempotent). */
    suspend fun ensureStarted() = lock.withLock {
        if (session.accessToken.isBlank()) return@withLock
        if (session.userId.isBlank()) {
            // Sessions saved by older app versions have no user id; look it up once.
            (apiClient.getProfile() as? NetworkResult.Success)?.data?.id?.takeIf { it.isNotBlank() }?.let { session.userId = it }
        }
        val userId = session.userId
        if (userId.isBlank()) return@withLock
        _client.value?.let { if (it.userId == userId) return@withLock else stopLocked() }
        try {
            val s = withContext(Dispatchers.IO) { PulseStore.open(context, userId) }
            store = s
            val api = PulseApi(http, session, apiClient)
            val client = PulseClient(userId, s, api, http, deviceName(), PulseMedia(context, api, http))
            _client.value = client
            client.setForeground(ProcessLifecycleOwner.get().lifecycle.currentState.isAtLeast(androidx.lifecycle.Lifecycle.State.STARTED))
            client.start()
            clientJobs = scope.launch {
                launch { registerPushToken(client) }
                // Messages that arrive while the app is in the background, or for a chat that is not on screen.
                client.events.collect { e ->
                    if (e is PulseEvent.Messages && shouldNotify(e.conversationId)) {
                        notifyConversation(client, e.conversationId)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "could not start Pulse", e)
        }
        scope.launch { loadPeople() }
    }

    /** Session ended without an explicit sign-out (e.g. it expired): stop, but keep this device's data. */
    private suspend fun suspendClient() = lock.withLock { stopLocked() }

    /**
     * Explicit sign-out: unregister this device and delete its local chat data and decrypted files.
     * Must run before the session's tokens are cleared, so the device can be revoked on the server.
     */
    suspend fun signOut() = lock.withLock {
        val client = _client.value
        val userId = client?.userId ?: session.userId
        notifier.cancelAll()
        client?.revokeDevice()
        client?.media?.clearCache()
        stopLocked()
        if (userId.isNotBlank()) withContext(Dispatchers.IO) { PulseStore.destroy(context, userId) }
        _people.value = emptyMap()
    }

    private fun stopLocked() {
        clientJobs?.cancel()
        clientJobs = null
        _client.value?.stop()
        _client.value = null
        store?.close()
        store = null
    }

    /** Loads everyone who can sign in, so member ids show as names. */
    suspend fun loadPeople() {
        val people = HashMap<String, PulsePerson>()
        for (page in 1..50) {
            val res = apiClient.getEmployees(limit = 100, page = page)
            val items = (res as? NetworkResult.Success)?.data?.items ?: break
            for (e in items) {
                val uid = e.userId ?: continue
                people[uid] = PulsePerson(uid, e.fullName.ifBlank { e.workEmail }, e.designationTitle.orEmpty(), e.departmentName.orEmpty(), e.avatarUrl)
            }
            if (items.size < 100) break
        }
        if (people.isNotEmpty()) _people.value = people
    }

    /** A push arrived: start if needed, catch up, and notify about anything new. */
    suspend fun handlePush(conversationId: String?) {
        ensureStarted()
        val client = _client.value ?: return
        val synced = client.syncNow()
        if (com.paylogic.humora.BuildConfig.DEBUG) Log.d(TAG, "push: synced=$synced")
        val ids = conversationId?.let { listOf(it) } ?: client.conversations.value.map { it.id }
        for (id in ids) {
            if (shouldNotify(id)) notifyConversation(client, id)
        }
    }

    /** A new push token from Firebase: hand it to the server for this device. */
    fun onNewPushToken(token: String) {
        val client = _client.value ?: return
        scope.launch { runCatching { client.setPushToken(token) } }
    }

    private suspend fun registerPushToken(client: PulseClient) {
        if (!pushEnabled) return
        client.connected.first { it } // the device is registered once it has connected
        runCatching {
            val token = com.google.firebase.messaging.FirebaseMessaging.getInstance().token.await()
            client.setPushToken(token)
        }.onFailure { Log.w(TAG, "push token registration failed", it) }
    }

    private val notifyLock = Mutex()

    // Serialised: a push and a live message can both ask to notify for the same chat at once.
    private suspend fun notifyConversation(client: PulseClient, conversationId: String) = notifyLock.withLock {
        val conv = client.conversation(conversationId) ?: return@withLock
        val messages = client.unnotifiedMessages(conversationId)
        if (messages.isEmpty()) return@withLock
        if (_people.value.isEmpty()) runCatching { loadPeople() }
        val title = when {
            conv.kind == "dm" -> conv.members.firstOrNull { it.userId != client.userId }?.let { person(it.userId).name } ?: "Pulse"
            conv.name.isNotBlank() -> conv.name
            else -> "Group chat"
        }
        notifier.show(conversationId, title, conv.kind != "dm", messages) { person(it).name }
        client.markNotified(conversationId, messages.maxOf { it.seq ?: 0L })
    }

    private fun initFirebase(): Boolean {
        val b = com.paylogic.humora.BuildConfig.FCM_APP_ID
        if (b.isBlank()) return false
        return try {
            if (com.google.firebase.FirebaseApp.getApps(context).isEmpty()) {
                com.google.firebase.FirebaseApp.initializeApp(
                    context,
                    com.google.firebase.FirebaseOptions.Builder()
                        .setApplicationId(com.paylogic.humora.BuildConfig.FCM_APP_ID)
                        .setApiKey(com.paylogic.humora.BuildConfig.FCM_API_KEY)
                        .setProjectId(com.paylogic.humora.BuildConfig.FCM_PROJECT_ID)
                        .setGcmSenderId(com.paylogic.humora.BuildConfig.FCM_SENDER_ID)
                        .build(),
                )
            }
            true
        } catch (e: Exception) {
            Log.w(TAG, "Firebase is misconfigured; push notifications are off", e)
            false
        }
    }

    fun person(userId: String): PulsePerson =
        _people.value[userId] ?: PulsePerson(userId, "User ${userId.take(8)}", "", "", null)

    private fun deviceName(): String = "${Build.MANUFACTURER.replaceFirstChar { it.uppercase() }} ${Build.MODEL}".trim().take(60)

    private companion object {
        const val TAG = "PulseService"
        const val BACKGROUND_GRACE_MS = 60_000L
    }
}
