package com.paylogic.humora.pulse

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.paylogic.humora.HumoraApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Debug builds only: runs exactly what a Firebase push runs, so the wake → sync → decrypt → notify
 * path can be tested without a Firebase project:
 *   adb shell am broadcast -a com.paylogic.humora.debug.SIMULATE_PUSH -p com.paylogic.humora.debug [--es conversation_id <id>]
 * and for HR/work notifications: ... SIMULATE_PUSH -p com.paylogic.humora.debug --es type notification
 */
class DebugPushReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val done = goAsync()
        CoroutineScope(Dispatchers.Default).launch {
            try {
                if (intent.getStringExtra("type") == "notification") {
                    HumoraApp.instance.appNotifier.sync()
                } else {
                    HumoraApp.instance.pulseService.handlePush(intent.getStringExtra("conversation_id"))
                }
            } finally {
                done.finish()
            }
        }
    }
}
