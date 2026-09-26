package com.paylogic.humora.data.remote

import android.content.Context
import android.content.SharedPreferences

object NetworkConfig {
    private const val PREFS_NAME = "humora_network_prefs"
    private const val KEY_BASE_URL = "backend_base_url"

    // Host machine private LAN IP for physical device testing
    const val DEVICE_LAN_IP = "192.168.1.50"
    const val DEFAULT_DEVICE_PORT = "8090"
    const val FALLBACK_DEVICE_PORT = "8000"

    // Primary base URL set to user's private IP on LAN
    const val DEFAULT_BASE_URL = "http://$DEVICE_LAN_IP:$DEFAULT_DEVICE_PORT/api/v1"
    const val DEVICE_PORT_8000_URL = "http://$DEVICE_LAN_IP:$FALLBACK_DEVICE_PORT/api/v1"
    const val EMULATOR_BASE_URL = "http://10.0.2.2:$DEFAULT_DEVICE_PORT/api/v1"
    const val LOCALHOST_BASE_URL = "http://127.0.0.1:$DEFAULT_DEVICE_PORT/api/v1"

    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        // If no custom URL is stored yet, initialize with the private LAN IP
        if (!prefs.contains(KEY_BASE_URL)) {
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
