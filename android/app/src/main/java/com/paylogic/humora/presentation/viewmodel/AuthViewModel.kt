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
    val userName: String = "Swapnil",
    val userEmail: String = "admin@humora.internal",
    val userRole: String = "superadmin",
    val tenantSlug: String = "humora-corp",
    val currentBaseUrl: String = NetworkConfig.baseUrl,
    val isServerConnected: Boolean = false,
    val errorMessage: String? = null,
    val successMessage: String? = null
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
            tenantSlug = HumoraApp.instance.sessionManager.tenantSlug
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
                    tenantSlug = HumoraApp.instance.sessionManager.tenantSlug
                )
            }
        }
        checkServerConnection()
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
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isLoggedIn = true,
                        userName = res.data.user.email.substringBefore("@").replaceFirstChar { it.uppercase() },
                        userEmail = res.data.user.email,
                        userRole = res.data.user.roles.firstOrNull() ?: "employee",
                        tenantSlug = res.data.user.tenantSlug,
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

    fun logout() {
        authRepo.logout()
        _uiState.value = _uiState.value.copy(
            isLoggedIn = false,
            successMessage = "Signed out"
        )
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(errorMessage = null, successMessage = null)
    }
}
