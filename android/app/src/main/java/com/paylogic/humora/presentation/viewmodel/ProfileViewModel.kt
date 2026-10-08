package com.paylogic.humora.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.paylogic.humora.HumoraApp
import com.paylogic.humora.data.model.FullEmployeeProfile
import com.paylogic.humora.data.model.UserSummary
import com.paylogic.humora.data.remote.HumoraApiClient
import com.paylogic.humora.data.remote.NetworkResult
import com.paylogic.humora.data.remote.SessionManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ProfileUiState(
    val isLoading: Boolean = false,
    val userSummary: UserSummary? = null,
    val employeeProfile: FullEmployeeProfile? = null,
    val userName: String = "",
    val userEmail: String = "",
    val userRole: String = "",
    val tenantSlug: String = "",
    val isAdmin: Boolean = false,
    val errorMessage: String? = null
)

class ProfileViewModel(
    private val apiClient: HumoraApiClient = HumoraApp.instance.apiClient,
    private val sessionManager: SessionManager = HumoraApp.instance.sessionManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        ProfileUiState(
            userName = sessionManager.userName.value,
            userEmail = sessionManager.userEmail,
            userRole = sessionManager.userRole,
            tenantSlug = sessionManager.tenantSlug,
            isAdmin = sessionManager.isAdmin
        )
    )
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    init {
        loadProfile()
    }

    fun loadProfile() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)

            // 1. Load user auth profile (/auth/me)
            when (val userRes = apiClient.getProfile()) {
                is NetworkResult.Success -> {
                    val user = userRes.data
                    val isUserAdmin = user.roles.any {
                        it.equals("superadmin", true) || it.equals("admin", true) || it.equals("hr_admin", true)
                    }
                    _uiState.value = _uiState.value.copy(
                        userSummary = user,
                        userEmail = user.email,
                        userRole = user.roles.firstOrNull() ?: "employee",
                        tenantSlug = user.tenantSlug,
                        isAdmin = isUserAdmin
                    )
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(errorMessage = userRes.message)
                }
                is NetworkResult.Exception -> {
                    _uiState.value = _uiState.value.copy(errorMessage = userRes.throwable.message)
                }
            }

            // 2. If employee (or non-admin), load full HRMS employee profile (/hrms/profile/me)
            when (val empRes = apiClient.getMyProfile()) {
                is NetworkResult.Success -> {
                    val profile = empRes.data
                    val empName = "${profile.employee.firstName} ${profile.employee.lastName}".trim()
                    _uiState.value = _uiState.value.copy(
                        employeeProfile = profile,
                        userName = empName.ifBlank { _uiState.value.userName }
                    )
                }
                is NetworkResult.Error -> {
                    // Admins don't have an HRMS employee row; silently keep userSummary
                }
                is NetworkResult.Exception -> {
                    // Silently ignore exception for admins without employee persona
                }
            }

            _uiState.value = _uiState.value.copy(isLoading = false)
        }
    }
}
