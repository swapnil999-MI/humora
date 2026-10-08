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
                val adminRole = data.user.roles.firstOrNull {
                    it.equals("superadmin", true) || it.equals("admin", true) || it.equals("hr_admin", true)
                }
                val effectiveRole = adminRole ?: data.user.roles.firstOrNull() ?: "employee"
                sessionManager.saveSession(
                    access = data.accessToken,
                    refresh = data.refreshToken,
                    email = data.user.email,
                    role = effectiveRole,
                    tenant = data.user.tenantSlug,
                    name = data.user.email.substringBefore("@").replaceFirstChar { it.uppercase() },
                    userId = data.user.id
                )
                result
            }
            is NetworkResult.Error -> result
            is NetworkResult.Exception -> result
        }
    }

    suspend fun registerOrganization(
        organizationName: String,
        slug: String,
        adminEmail: String,
        adminPassword: String,
        firstName: String,
        lastName: String = ""
    ): NetworkResult<AuthResponse> {
        val req = com.paylogic.humora.data.model.RegisterOrganizationRequest(
            organizationName = organizationName.trim(),
            slug = slug.trim(),
            adminEmail = adminEmail.trim(),
            adminPassword = adminPassword,
            firstName = firstName.trim(),
            lastName = lastName.trim()
        )

        return when (val result = apiClient.registerOrganization(req)) {
            is NetworkResult.Success -> {
                val data = result.data
                val adminRole = data.user.roles.firstOrNull {
                    it.equals("superadmin", true) || it.equals("admin", true) || it.equals("hr_admin", true)
                }
                val effectiveRole = adminRole ?: "admin"
                val displayName = if (firstName.isNotBlank()) "$firstName $lastName".trim() else data.user.email.substringBefore("@")
                sessionManager.saveSession(
                    access = data.accessToken,
                    refresh = data.refreshToken,
                    email = data.user.email,
                    role = effectiveRole,
                    tenant = data.user.tenantSlug,
                    name = displayName,
                    userId = data.user.id
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
                val adminRole = user.roles.firstOrNull {
                    it.equals("superadmin", true) || it.equals("admin", true) || it.equals("hr_admin", true)
                }
                val effectiveRole = adminRole ?: user.roles.firstOrNull() ?: "employee"
                sessionManager.updateUserData(
                    name = user.email.substringBefore("@").replaceFirstChar { it.uppercase() },
                    email = user.email,
                    role = effectiveRole
                )
                if (user.id.isNotBlank()) sessionManager.userId = user.id
                res
            }
            is NetworkResult.Error -> res
            is NetworkResult.Exception -> res
        }
    }

    suspend fun getAuthProviders(): NetworkResult<com.paylogic.humora.data.model.AuthProvidersResponse> {
        return apiClient.getAuthProviders()
    }

    suspend fun confirmQR(sessionId: String): NetworkResult<Unit> {
        return apiClient.confirmQR(sessionId)
    }

    fun logout() {
        sessionManager.clearSession()
    }
}
