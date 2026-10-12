package com.paylogic.humora.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.paylogic.humora.HumoraApp
import com.paylogic.humora.data.remote.NetworkConfig
import com.paylogic.humora.data.remote.NetworkResult
import com.paylogic.humora.data.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AuthUiState(
    val isLoading: Boolean = false,
    val isLoggedIn: Boolean = false,
    val userName: String = "",
    val userEmail: String = "",
    val userRole: String = "employee",
    val tenantSlug: String = "",
    val currentBaseUrl: String = NetworkConfig.baseUrl,
    val isServerConnected: Boolean = false,
    val errorMessage: String? = null,
    val successMessage: String? = null,
    val isAdmin: Boolean = false,
    val authProviders: com.paylogic.humora.data.model.AuthProvidersResponse = com.paylogic.humora.data.model.AuthProvidersResponse()
)

class AuthViewModel(
    private val authRepo: AuthRepository = HumoraApp.instance.authRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        AuthUiState(
            isLoggedIn = HumoraApp.instance.sessionManager.isLoggedIn.value,
            userName = HumoraApp.instance.sessionManager.userName.value,
            userEmail = HumoraApp.instance.sessionManager.userEmail,
            userRole = HumoraApp.instance.sessionManager.userRole,
            tenantSlug = HumoraApp.instance.sessionManager.tenantSlug,
            isAdmin = HumoraApp.instance.sessionManager.isAdmin
        )
    )
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            HumoraApp.instance.sessionManager.isLoggedIn.collect { loggedIn ->
                _uiState.value = _uiState.value.copy(
                    isLoggedIn = loggedIn,
                    userName = HumoraApp.instance.sessionManager.userName.value,
                    userEmail = HumoraApp.instance.sessionManager.userEmail,
                    userRole = HumoraApp.instance.sessionManager.userRole,
                    tenantSlug = HumoraApp.instance.sessionManager.tenantSlug,
                    isAdmin = HumoraApp.instance.sessionManager.isAdmin
                )
            }
        }
        checkServerConnection()
        fetchAuthProviders()
    }

    fun checkServerConnection() {
        viewModelScope.launch {
            when (HumoraApp.instance.apiClient.ping()) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(isServerConnected = true, errorMessage = null)
                }
                else -> {
                    _uiState.value = _uiState.value.copy(isServerConnected = false)
                }
            }
        }
    }

    fun updateBaseUrl(newUrl: String) {
        NetworkConfig.baseUrl = newUrl
        _uiState.value = _uiState.value.copy(currentBaseUrl = NetworkConfig.baseUrl)
        checkServerConnection()
    }

    fun login(email: String, pass: String, slug: String = "") {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val res = authRepo.login(email, pass, slug)) {
                is NetworkResult.Success -> {
                    val primaryRole = res.data.user.roles.firstOrNull() ?: "employee"
                    val isUserAdmin = res.data.user.roles.any {
                        it.equals("superadmin", true) || it.equals("admin", true) || it.equals("hr_admin", true)
                    }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isLoggedIn = true,
                        userName = res.data.user.email.substringBefore("@").replaceFirstChar { it.uppercase() },
                        userEmail = res.data.user.email,
                        userRole = primaryRole,
                        tenantSlug = res.data.user.tenantSlug,
                        isAdmin = isUserAdmin,
                        successMessage = "Authenticated successfully as ${res.data.user.email}"
                    )
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = res.message
                    )
                }
                is NetworkResult.Exception -> {
                    val rawMsg = res.throwable.message ?: "Failed to reach server"
                    val userFriendly = if (rawMsg.contains("Connection refused", ignoreCase = true) || rawMsg.contains("ConnectException", ignoreCase = true)) {
                        "Connection refused: Humora backend is not reachable at ${NetworkConfig.baseUrl}. Please verify your computer's IP and make sure the server is running."
                    } else {
                        rawMsg
                    }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = userFriendly
                    )
                }
            }
        }
    }

    fun registerOrganization(
        orgName: String,
        slug: String,
        adminEmail: String,
        adminPass: String,
        firstName: String,
        lastName: String = ""
    ) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null, successMessage = null)
            when (val res = authRepo.registerOrganization(orgName, slug, adminEmail, adminPass, firstName, lastName)) {
                is NetworkResult.Success -> {
                    val primaryRole = res.data.user.roles.firstOrNull() ?: "superadmin"
                    val isUserAdmin = true
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isLoggedIn = true,
                        userName = if (firstName.isNotBlank()) "$firstName $lastName".trim() else res.data.user.email.substringBefore("@"),
                        userEmail = res.data.user.email,
                        userRole = primaryRole,
                        tenantSlug = res.data.user.tenantSlug,
                        isAdmin = isUserAdmin,
                        successMessage = "Organization '${res.data.user.tenantName}' created successfully!"
                    )
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = res.message
                    )
                }
                is NetworkResult.Exception -> {
                    val rawMsg = res.throwable.message ?: "Failed to reach server"
                    val userFriendly = if (rawMsg.contains("Connection refused", ignoreCase = true) || rawMsg.contains("ConnectException", ignoreCase = true)) {
                        "Connection refused: Humora backend is not reachable at ${NetworkConfig.baseUrl}."
                    } else {
                        rawMsg
                    }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = userFriendly
                    )
                }
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            // Revoke this device and wipe its chat data while the session can still authenticate.
            runCatching { HumoraApp.instance.pulseService.signOut() }
            authRepo.logout()
            _uiState.value = _uiState.value.copy(
                isLoggedIn = false,
                successMessage = "Signed out"
            )
        }
    }

    fun fetchAuthProviders() {
        viewModelScope.launch {
            when (val res = authRepo.getAuthProviders()) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(authProviders = res.data)
                }
                else -> {}
            }
        }
    }

    fun handleOAuthSuccess(accessToken: String, refreshToken: String?) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            HumoraApp.instance.sessionManager.accessToken = accessToken
            if (!refreshToken.isNullOrBlank()) {
                HumoraApp.instance.sessionManager.refreshToken = refreshToken
            }
            when (val res = authRepo.refreshProfile()) {
                is NetworkResult.Success -> {
                    val user = res.data
                    val primaryRole = user.roles.firstOrNull() ?: "employee"
                    val isUserAdmin = user.roles.any {
                        it.equals("superadmin", true) || it.equals("admin", true) || it.equals("hr_admin", true)
                    }
                    val name = user.email.substringBefore("@").replaceFirstChar { it.uppercase() }
                    HumoraApp.instance.sessionManager.saveSession(
                        access = accessToken,
                        refresh = refreshToken ?: "",
                        email = user.email,
                        role = primaryRole,
                        tenant = user.tenantSlug,
                        name = name,
                        userId = user.id
                    )
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isLoggedIn = true,
                        userName = name,
                        userEmail = user.email,
                        userRole = primaryRole,
                        tenantSlug = user.tenantSlug,
                        isAdmin = isUserAdmin,
                        successMessage = "Signed in successfully"
                    )
                }
                else -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isLoggedIn = true,
                        successMessage = "Signed in successfully"
                    )
                }
            }
        }
    }

    /** Who is asking to be signed in by a QR code, so the user can check before approving. */
    fun loadQRInfo(sessionId: String, nonce: String, onResult: (com.paylogic.humora.data.model.QRInfo?, String?) -> Unit) {
        viewModelScope.launch {
            when (val res = authRepo.qrInfo(sessionId, nonce)) {
                is NetworkResult.Success -> onResult(res.data, null)
                is NetworkResult.Error -> onResult(null, res.message)
                is NetworkResult.Exception -> onResult(null, res.throwable.message ?: "Could not check this QR code")
            }
        }
    }

    /**
     * A social sign-in came back with a one-time code. It is only redeemed if this app started
     * that sign-in (it holds the PKCE verifier), so a crafted humora:// link cannot sign the user
     * into someone else's account, and an app hijacking the link cannot redeem the code.
     */
    fun finishOAuth(code: String) {
        val verifier = HumoraApp.instance.sessionManager.takeOAuthVerifier() ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            when (val res = authRepo.exchangeOAuth(code, verifier)) {
                is NetworkResult.Success -> handleOAuthSuccess(res.data.accessToken, res.data.refreshToken)
                is NetworkResult.Error -> _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = res.message)
                is NetworkResult.Exception -> _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = res.throwable.message ?: "Sign-in failed")
            }
        }
    }

    fun confirmQRLogin(sessionId: String, nonce: String, onResult: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            when (val res = authRepo.confirmQR(sessionId, nonce)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(isLoading = false)
                    onResult(true, null)
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false)
                    onResult(false, res.message)
                }
                is NetworkResult.Exception -> {
                    _uiState.value = _uiState.value.copy(isLoading = false)
                    onResult(false, res.throwable.message ?: "Failed to authorize QR login")
                }
            }
        }
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(errorMessage = null, successMessage = null)
    }
}
