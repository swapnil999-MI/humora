package com.paylogic.humora.data.repository

import com.paylogic.humora.data.model.AuthResponse
import com.paylogic.humora.data.model.LoginRequest
import com.paylogic.humora.data.model.UserSummary
import com.paylogic.humora.data.remote.HumoraApiClient
import com.paylogic.humora.data.remote.NetworkResult
import com.paylogic.humora.data.remote.SessionManager

class AuthRepository(
    private val apiClient: HumoraApiClient,
    private val sessionManager: SessionManager
) {
    val isLoggedIn = sessionManager.isLoggedIn
    val userName = sessionManager.userName

    suspend fun login(email: String, password: String, tenantSlug: String = ""): NetworkResult<AuthResponse> {
        val req = LoginRequest(
            tenantSlug = tenantSlug.trim(),
            email = email.trim(),
            password = password
        )

        return when (val result = apiClient.login(req)) {
            is NetworkResult.Success -> {
                val data = result.data
                sessionManager.saveSession(
                    access = data.accessToken,
                    refresh = data.refreshToken,
                    email = data.user.email,
                    role = data.user.roles.firstOrNull() ?: "employee",
                    tenant = data.user.tenantSlug,
                    name = data.user.email.substringBefore("@").replaceFirstChar { it.uppercase() }
                )
                result
            }
            is NetworkResult.Error -> result
            is NetworkResult.Exception -> result
        }
    }

    suspend fun refreshProfile(): NetworkResult<UserSummary> {
        return when (val res = apiClient.getProfile()) {
            is NetworkResult.Success -> {
                val user = res.data
                sessionManager.updateUserData(
                    name = user.email.substringBefore("@").replaceFirstChar { it.uppercase() },
                    email = user.email,
                    role = user.roles.firstOrNull() ?: "employee"
                )
                res
            }
            is NetworkResult.Error -> res
            is NetworkResult.Exception -> res
        }
    }

    fun logout() {
        sessionManager.clearSession()
    }
}
