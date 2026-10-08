package com.paylogic.humora.pulse

import com.paylogic.humora.pulse.v1.ClientFrame
import com.paylogic.humora.pulse.v1.ErrorCode
import com.paylogic.humora.pulse.v1.Ping
import com.paylogic.humora.pulse.v1.ServerFrame
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import okio.ByteString.Companion.toByteString
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.min
import kotlin.random.Random

/** A failed gateway request: no connection, no reply in time, or an Error frame from the server. */
class PulseSocketException(val kind: Kind, val code: ErrorCode? = null, message: String) : Exception(message) {
    enum class Kind { OFFLINE, TIMEOUT, SERVER }

    /** Worth retrying later rather than giving up on the operation. */
    val transient: Boolean
        get() = kind != Kind.SERVER || code == ErrorCode.ERROR_CODE_RATE_LIMITED || code == ErrorCode.ERROR_CODE_INTERNAL

    val conflict: Boolean get() = code == ErrorCode.ERROR_CODE_CONFLICT
}

/**
 * One persistent WebSocket to the Pulse gateway (mirrors web/src/pulse/socket.ts): binary protobuf
 * frames, request/response matching by req_id, keepalive pings and automatic reconnection.
 */
class PulseSocket(
    private val http: OkHttpClient,
    private val scope: CoroutineScope,
    /** A fresh gateway URL (with a single-use ticket) for each attempt. */
    private val getUrl: suspend () -> String,
    private val onOpen: () -> Unit,
    private val onClose: () -> Unit,
    /** Frames that are not a reply to a request. */
    private val onFrame: (ServerFrame) -> Unit,
) {
    private val nextReqId = AtomicLong(0)
    private val pending = ConcurrentHashMap<Long, CompletableDeferred<ServerFrame>>()
    @Volatile private var ws: WebSocket? = null
    /** The connection attempt that callbacks are allowed to act on; older sockets are ignored. */
    @Volatile private var current: WebSocket? = null
    @Volatile private var open = false
    @Volatile private var wanted = false
    private var attempt = 0
    private var connectJob: Job? = null
    private var pingJob: Job? = null

    /** Last measured round trip to the gateway, in milliseconds. */
    @Volatile var rttMs: Long? = null
        private set

    val connected: Boolean get() = open

    @Synchronized fun start() {
        if (wanted) return
        wanted = true
        connect(0)
    }

    @Synchronized fun stop() {
        wanted = false
        connectJob?.cancel()
        val socket = current ?: return
        socket.close(1000, null)
        // Offline from now on: do not wait (up to a minute) for the server to acknowledge the close.
        closed(socket)
        scope.launch {
            delay(2_000)
            socket.cancel()
        }
    }

    /** Called when the network comes back: skip the remaining backoff and try now. */
    @Synchronized fun reconnectNow() {
        if (!wanted || open) return
        attempt = 0
        connect(0)
    }

    @Synchronized private fun connect(delayMs: Long) {
        connectJob?.cancel()
        connectJob = scope.launch {
            if (delayMs > 0) delay(delayMs)
            val url = try {
                getUrl()
            } catch (e: Exception) {
                scheduleReconnect()
                return@launch
            }
            if (!wanted) return@launch
            val request = Request.Builder().url(url).build()
            synchronized(this@PulseSocket) {
                if (!wanted) return@launch
                current = http.newWebSocket(request, Listener())
            }
        }
    }

    @Synchronized private fun scheduleReconnect() {
        if (!wanted) return
        // Exponential backoff with jitter, so a server restart is not met by every client at once.
        val ceiling = min(BACKOFF_MAX_MS, BACKOFF_MIN_MS shl min(attempt++, 10))
        connect(ceiling / 2 + Random.nextLong(ceiling / 2 + 1))
    }

    private inner class Listener : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            synchronized(this@PulseSocket) {
                // Not wanted any more, superseded by a newer attempt, or another one already opened.
                if (!wanted || webSocket !== current || open) {
                    webSocket.close(1000, null)
                    return
                }
                ws = webSocket
                open = true
                attempt = 0
            }
            pingJob = scope.launch {
                while (isActive && open) {
                    delay(PING_INTERVAL_MS)
                    ping()
                }
            }
            onOpen()
        }

        override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
            val frame = try {
                ServerFrame.parseFrom(bytes.toByteArray())
            } catch (e: Exception) {
                return
            }
            val waiter = if (frame.reqId != 0L) pending.remove(frame.reqId) else null
            if (waiter == null) {
                onFrame(frame)
            } else if (frame.bodyCase == ServerFrame.BodyCase.ERROR) {
                waiter.completeExceptionally(PulseSocketException(PulseSocketException.Kind.SERVER, frame.error.code, frame.error.message))
            } else {
                waiter.complete(frame)
            }
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            webSocket.close(1000, null)
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) = closed(webSocket)

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) = closed(webSocket)
    }

    private fun closed(webSocket: WebSocket) {
        val wasOpen: Boolean
        synchronized(this) {
            if (webSocket !== current) return // an old socket, or this one was already handled
            current = null
            wasOpen = open
            ws = null
            open = false
        }
        pingJob?.cancel()
        for ((_, waiter) in pending) {
            waiter.completeExceptionally(PulseSocketException(PulseSocketException.Kind.OFFLINE, message = "connection closed"))
        }
        pending.clear()
        if (wasOpen) onClose()
        scheduleReconnect()
    }

    private suspend fun ping() {
        val sent = System.currentTimeMillis()
        try {
            request { setPing(Ping.newBuilder().setClientTs(sent)) }
            rttMs = System.currentTimeMillis() - sent
        } catch (e: PulseSocketException) {
            // No answer: the connection is dead even if the OS has not noticed.
            ws?.cancel()
        }
    }

    private fun write(reqId: Long, body: ClientFrame.Builder.() -> Unit): Boolean {
        val socket = ws ?: return false
        if (!open) return false
        val frame = ClientFrame.newBuilder().setReqId(reqId).apply(body).build()
        return socket.send(frame.toByteArray().toByteString())
    }

    /** Sends a frame and returns its reply; throws on an Error reply, timeout, or disconnect. */
    suspend fun request(body: ClientFrame.Builder.() -> Unit): ServerFrame {
        val reqId = nextReqId.incrementAndGet()
        val waiter = CompletableDeferred<ServerFrame>()
        pending[reqId] = waiter
        if (!write(reqId, body)) {
            pending.remove(reqId)
            throw PulseSocketException(PulseSocketException.Kind.OFFLINE, message = "not connected")
        }
        return try {
            withTimeout(REQUEST_TIMEOUT_MS) { waiter.await() }
        } catch (e: TimeoutCancellationException) {
            pending.remove(reqId)
            throw PulseSocketException(PulseSocketException.Kind.TIMEOUT, message = "request timed out")
        }
    }

    /** Sends a frame that expects no reply. Dropped silently when offline. */
    fun notify(body: ClientFrame.Builder.() -> Unit) {
        write(0, body)
    }

    private companion object {
        const val REQUEST_TIMEOUT_MS = 10_000L
        const val PING_INTERVAL_MS = 25_000L
        const val BACKOFF_MIN_MS = 500L
        const val BACKOFF_MAX_MS = 30_000L
    }
}
