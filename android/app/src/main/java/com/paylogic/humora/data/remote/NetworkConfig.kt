package com.paylogic.humora.data.remote

import android.content.Context
import android.content.SharedPreferences
import com.paylogic.humora.BuildConfig

object NetworkConfig {
    private const val PREFS_NAME = "humora_network_prefs"
    private const val KEY_BASE_URL = "backend_base_url"

    // Host machine private LAN IP for physical device testing
    const val DEVICE_LAN_IP = "192.168.1.50"
    const val DEFAULT_DEVICE_PORT = "8090"
    const val FALLBACK_DEVICE_PORT = "8000"

    // Per build type: LAN backend for debug, the production HTTPS endpoint for release.
    // Not `const`: an inlined constant can survive an incremental build after the URL changes.
    val DEFAULT_BASE_URL: String = BuildConfig.API_BASE_URL
    const val DEVICE_PORT_8000_URL = "http://$DEVICE_LAN_IP:$FALLBACK_DEVICE_PORT/api/v1"
    const val EMULATOR_BASE_URL = "http://$DEVICE_LAN_IP:$DEFAULT_DEVICE_PORT/api/v1"
    const val LOCALHOST_BASE_URL = "http://$DEVICE_LAN_IP:$DEFAULT_DEVICE_PORT/api/v1"

    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val current = prefs.getString(KEY_BASE_URL, null)
        // If no custom URL is stored yet, or if it points to legacy emulator/localhost, upgrade to LAN private IP
        if (current == null || current.contains("10.0.2.2") || current.contains("127.0.0.1") || current.contains("localhost")) {
            prefs.edit().putString(KEY_BASE_URL, DEFAULT_BASE_URL).apply()
        }
    }

    var baseUrl: String
        get() {
            if (!::prefs.isInitialized) return DEFAULT_BASE_URL
            return prefs.getString(KEY_BASE_URL, DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL
        }
        set(value) {
            if (::prefs.isInitialized) {
                val cleanUrl = value.trim().removeSuffix("/")
                prefs.edit().putString(KEY_BASE_URL, cleanUrl).apply()
            }
        }
}
