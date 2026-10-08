package com.paylogic.humora.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.paylogic.humora.HumoraApp
import com.paylogic.humora.data.model.BurnoutSentinelReport
import com.paylogic.humora.data.model.EmployeeDetail
import com.paylogic.humora.data.model.TeamCapacityResponse
import com.paylogic.humora.data.remote.NetworkResult
import com.paylogic.humora.data.repository.AdminRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class AdminDeskTab {
    CAPACITY_WORKLOAD,
    BURNOUT_SENTINEL,
    BIOMETRIC_KIOSK,
    GEOFENCE_SETTINGS
}

data class EmployeeBiometricState(
    val employee: EmployeeDetail,
    val isFaceRegistered: Boolean,
    val isFingerprintRegistered: Boolean
)

data class AdminUiState(
    val isLoading: Boolean = false,
    val isEnrolling: Boolean = false,
    val selectedDeskTab: AdminDeskTab = AdminDeskTab.CAPACITY_WORKLOAD,
    val searchQuery: String = "",
    val presenceFilter: String = "all", // "all", "in_office", "on_leave", "overloaded"
    val teamCapacity: TeamCapacityResponse? = null,
    val burnoutSentinel: BurnoutSentinelReport? = null,
    val employees: List<EmployeeBiometricState> = emptyList(),
    val officeLocations: List<com.paylogic.humora.data.model.OfficeLocationDto> = emptyList(),
    val activeOfficeLocation: com.paylogic.humora.data.model.OfficeLocationDto? = null,
    val isSavingGeofence: Boolean = false,
    val errorMessage: String? = null,
    val successMessage: String? = null,
    val activeFaceEnrollEmployee: EmployeeDetail? = null,
    val activeFingerprintEnrollEmployee: EmployeeDetail? = null
)

class AdminViewModel(
    private val adminRepo: AdminRepository = HumoraApp.instance.adminRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AdminUiState())
    val uiState: StateFlow<AdminUiState> = _uiState.asStateFlow()

    init {
        refreshAll()
    }

    fun selectDeskTab(tab: AdminDeskTab) {
        _uiState.value = _uiState.value.copy(selectedDeskTab = tab)
    }

    fun setPresenceFilter(filter: String) {
        _uiState.value = _uiState.value.copy(presenceFilter = filter)
    }

    fun refreshAll() {
        loadCapacity()
        loadBurnoutSentinel()
        loadEmployees()
        loadOfficeLocations()
    }

    fun loadOfficeLocations() {
        viewModelScope.launch {
            when (val res = adminRepo.getOfficeLocations()) {
                is NetworkResult.Success -> {
                    val locs = res.data
                    _uiState.value = _uiState.value.copy(
                        officeLocations = locs,
                        activeOfficeLocation = locs.firstOrNull()
                    )
                }
                else -> {}
            }
        }
    }

    fun saveGeofence(id: String?, name: String, lat: Double, lon: Double, radiusMeters: Int) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSavingGeofence = true, errorMessage = null, successMessage = null)
            val res = if (!id.isNullOrBlank()) {
                adminRepo.updateOfficeLocation(id, name, lat, lon, radiusMeters)
            } else {
                adminRepo.createOfficeLocation(name, lat, lon, radiusMeters)
            }
            _uiState.value = _uiState.value.copy(isSavingGeofence = false)
            when (res) {
                is NetworkResult.Success -> {
                    val updated = res.data
                    _uiState.value = _uiState.value.copy(
                        activeOfficeLocation = updated,
                        successMessage = "Geofence deployed for \"${updated.name}\" (${updated.radiusMeters}m radius)!"
                    )
                    // Refresh the offices used for live geofence checks
                    HumoraApp.instance.attendanceRepository.fetchOfficeLocations()
                    loadOfficeLocations()
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(errorMessage = res.message)
                }
                is NetworkResult.Exception -> {
                    _uiState.value = _uiState.value.copy(errorMessage = res.throwable.message ?: "Failed to save geofence")
                }
            }
        }
    }

    fun loadCapacity() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val res = adminRepo.getTeamCapacity()) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        teamCapacity = res.data
                    )
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = res.message
                    )
                }
                is NetworkResult.Exception -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = res.throwable.message ?: "Failed to load team capacity"
                    )
                }
            }
        }
    }

    fun loadBurnoutSentinel() {
        viewModelScope.launch {
            when (val res = adminRepo.getBurnoutSentinel()) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(burnoutSentinel = res.data)
                }
                else -> {}
            }
        }
    }

    fun onSearchQueryChange(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query)
        loadEmployees(query)
    }

    fun loadEmployees(search: String = _uiState.value.searchQuery) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val res = adminRepo.getEmployees(search)) {
                is NetworkResult.Success -> {
                    val biometricStates = res.data.map { emp ->
                        EmployeeBiometricState(
                            employee = emp,
                            isFaceRegistered = emp.isFaceRegistered,
                            isFingerprintRegistered = adminRepo.isFingerprintEnrolled(emp.id)
                        )
                    }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        employees = biometricStates
                    )
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = res.message
                    )
                }
                is NetworkResult.Exception -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = res.throwable.message ?: "Failed to load employees"
                    )
                }
            }
        }
    }

    fun openFaceEnrollment(emp: EmployeeDetail) {
        _uiState.value = _uiState.value.copy(
            activeFaceEnrollEmployee = emp,
            errorMessage = null,
            successMessage = null
        )
    }

    fun closeFaceEnrollment() {
        _uiState.value = _uiState.value.copy(activeFaceEnrollEmployee = null)
    }

    fun enrollFace(employeeId: String, base64Image: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isEnrolling = true, errorMessage = null)
            when (val res = adminRepo.enrollEmployeeFace(employeeId, listOf(base64Image))) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isEnrolling = false,
                        activeFaceEnrollEmployee = null,
                        successMessage = "Face profile registered successfully for employee"
                    )
                    loadEmployees()
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isEnrolling = false,
                        errorMessage = res.message
                    )
                }
                is NetworkResult.Exception -> {
                    _uiState.value = _uiState.value.copy(
                        isEnrolling = false,
                        errorMessage = res.throwable.message ?: "Face registration failed"
                    )
                }
            }
        }
    }

    fun openFingerprintEnrollment(emp: EmployeeDetail) {
        _uiState.value = _uiState.value.copy(
            activeFingerprintEnrollEmployee = emp,
            errorMessage = null,
            successMessage = null
        )
    }

    fun closeFingerprintEnrollment() {
        _uiState.value = _uiState.value.copy(activeFingerprintEnrollEmployee = null)
    }

    fun onFingerprintEnrolled(employeeId: String) {
        adminRepo.setFingerprintEnrolled(employeeId, true)
        _uiState.value = _uiState.value.copy(
            activeFingerprintEnrollEmployee = null,
            successMessage = "Fingerprint credential successfully bound to employee"
        )
        loadEmployees()
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(errorMessage = null, successMessage = null)
    }
}
