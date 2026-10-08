package com.paylogic.humora.pulse

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.paylogic.humora.HumoraApp
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Receives Firebase pushes. A Pulse push only says "conversation X has news"; the app wakes, syncs the
 * encrypted messages, decrypts them on the device and shows the notification itself.
 */
class PulseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        // Runs on a background thread; a high-priority push allows the app about 20 seconds.
        when (message.data["type"]) {
            "pulse" -> runBlocking {
                withTimeoutOrNull(18_000) {
                    HumoraApp.instance.pulseService.handlePush(message.data["conversation_id"])
                }
            }
            // HR/work updates: fetch them over the API and show the new ones.
            "notification" -> runBlocking {
                withTimeoutOrNull(18_000) { HumoraApp.instance.appNotifier.sync() }
            }
        }
    }

    override fun onNewToken(token: String) {
        HumoraApp.instance.pulseService.onNewPushToken(token)
    }
}
