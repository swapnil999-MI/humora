package com.paylogic.humora.data.remote

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class SessionManager(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("humora_auth_session", Context.MODE_PRIVATE)

    private val _isLoggedIn = MutableStateFlow(accessToken.isNotBlank())
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    private val _userName = MutableStateFlow(userNameStored)
    val userName: StateFlow<String> = _userName.asStateFlow()

    var accessToken: String
        get() = prefs.getString(KEY_ACCESS_TOKEN, "") ?: ""
        set(value) {
            prefs.edit().putString(KEY_ACCESS_TOKEN, value).apply()
            _isLoggedIn.value = value.isNotBlank()
        }

    var refreshToken: String
        get() = prefs.getString(KEY_REFRESH_TOKEN, "") ?: ""
        set(value) {
            prefs.edit().putString(KEY_REFRESH_TOKEN, value).apply()
        }

    var tenantSlug: String
        get() = prefs.getString(KEY_TENANT_SLUG, "humora-corp") ?: "humora-corp"
        set(value) {
            prefs.edit().putString(KEY_TENANT_SLUG, value).apply()
        }

    var userEmail: String
        get() = prefs.getString(KEY_USER_EMAIL, "admin@humora.internal") ?: "admin@humora.internal"
        set(value) {
            prefs.edit().putString(KEY_USER_EMAIL, value).apply()
        }

    var userRole: String
        get() = prefs.getString(KEY_USER_ROLE, "superadmin") ?: "superadmin"
        set(value) {
            prefs.edit().putString(KEY_USER_ROLE, value).apply()
        }

    private val userNameStored: String
        get() = prefs.getString(KEY_USER_NAME, "Swapnil") ?: "Swapnil"

    fun updateUserData(name: String, email: String, role: String) {
        prefs.edit()
            .putString(KEY_USER_NAME, name)
            .putString(KEY_USER_EMAIL, email)
            .putString(KEY_USER_ROLE, role)
            .apply()
        _userName.value = name
    }

    fun saveSession(
        access: String,
        refresh: String,
        email: String,
        role: String,
        tenant: String,
        name: String = "Swapnil"
    ) {
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, access)
            .putString(KEY_REFRESH_TOKEN, refresh)
            .putString(KEY_USER_EMAIL, email)
            .putString(KEY_USER_ROLE, role)
            .putString(KEY_TENANT_SLUG, tenant)
            .putString(KEY_USER_NAME, name)
            .apply()

        _isLoggedIn.value = access.isNotBlank()
        _userName.value = name
    }

    fun clearSession() {
        prefs.edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_REFRESH_TOKEN)
            .apply()
        _isLoggedIn.value = false
    }

    companion object {
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_TENANT_SLUG = "tenant_slug"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_USER_ROLE = "user_role"
        private const val KEY_USER_NAME = "user_name"
    }
}
