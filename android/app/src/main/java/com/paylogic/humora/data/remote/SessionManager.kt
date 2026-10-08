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

    /** The signed-in user's id (UUID), needed for end-to-end encrypted chat. */
    var userId: String
        get() = prefs.getString(KEY_USER_ID, "") ?: ""
        set(value) {
            prefs.edit().putString(KEY_USER_ID, value).apply()
        }

    /** Replaces the token pair after a refresh, keeping the rest of the session. */
    fun updateTokens(access: String, refresh: String) {
        prefs.edit().putString(KEY_ACCESS_TOKEN, access).putString(KEY_REFRESH_TOKEN, refresh).commit()
        _isLoggedIn.value = access.isNotBlank()
    }

    var tenantSlug: String
        get() = prefs.getString(KEY_TENANT_SLUG, "") ?: ""
        set(value) {
            prefs.edit().putString(KEY_TENANT_SLUG, value).apply()
        }

    var userEmail: String
        get() = prefs.getString(KEY_USER_EMAIL, "") ?: ""
        set(value) {
            prefs.edit().putString(KEY_USER_EMAIL, value).apply()
        }

    var userRole: String
        get() = prefs.getString(KEY_USER_ROLE, "employee") ?: "employee"
        set(value) {
            prefs.edit().putString(KEY_USER_ROLE, value).apply()
        }

    val isAdmin: Boolean
        get() = userRole.equals("superadmin", ignoreCase = true) ||
                userRole.equals("admin", ignoreCase = true) ||
                userRole.equals("hr_admin", ignoreCase = true)

    fun isFingerprintEnrolledFor(employeeId: String): Boolean {
        return prefs.getBoolean("fp_enrolled_$employeeId", false)
    }

    fun setFingerprintEnrolledFor(employeeId: String, enrolled: Boolean) {
        prefs.edit().putBoolean("fp_enrolled_$employeeId", enrolled).apply()
    }

    private val userNameStored: String
        get() = prefs.getString(KEY_USER_NAME, "") ?: ""

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
        name: String = "",
        userId: String = ""
    ) {
        prefs.edit()
            .putString(KEY_USER_ID, userId)
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
            .remove(KEY_USER_ID)
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
        private const val KEY_USER_ID = "user_id"
    }
}
