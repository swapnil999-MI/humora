package com.paylogic.humora.presentation.viewmodel

import android.location.Location
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.paylogic.humora.HumoraApp
import com.paylogic.humora.data.model.MonthlyAttendanceDay
import com.paylogic.humora.data.model.MonthlyAttendanceResponse
import com.paylogic.humora.data.remote.NetworkResult
import com.paylogic.humora.data.repository.AttendanceRepository
import com.paylogic.humora.data.repository.PunchResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AttendanceUiState(
    val isLoading: Boolean = false,
    val monthlyCalendar: MonthlyAttendanceResponse = MonthlyAttendanceResponse(),
    /** Nearest-office check; null until both the location and the offices are known. */
    val geofence: com.paylogic.humora.core.location.GeofenceStatus? = null,
    val locationKnown: Boolean = false,
    /** null while loading; false when the organisation has no office configured. */
    val officesConfigured: Boolean? = null,
    val calendarError: String? = null,
    val pendingOfflineSyncCount: Int = 0,
    val isFacePunching: Boolean = false,
    val isPunchedIn: Boolean = false,  // Bug #5 Fix: track punch-in/out state
    val actionMessage: String? = null
)

class AttendanceViewModel(
    private val attendanceRepo: AttendanceRepository = HumoraApp.instance.attendanceRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AttendanceUiState())
    val uiState: StateFlow<AttendanceUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            attendanceRepo.fetchOfficeLocations()
            _uiState.value = _uiState.value.copy(officesConfigured = attendanceRepo.hasOffices)
            updateCurrentLocation(com.paylogic.humora.core.location.LocationProvider.getLastKnownLocation(HumoraApp.instance))
        }
        loadMonthlyAttendance()
        checkOfflinePunches()
    }

    fun updateCurrentLocation(loc: Location?) {
        if (loc != null) {
            _uiState.value = _uiState.value.copy(
                geofence = attendanceRepo.checkGeofence(loc),
                locationKnown = true,
                officesConfigured = attendanceRepo.hasOffices
            )
        }
    }

    fun loadMonthlyAttendance(year: Int = java.time.LocalDate.now().year, month: Int = java.time.LocalDate.now().monthValue) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            when (val res = attendanceRepo.getMonthlyAttendance(year, month)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        monthlyCalendar = res.data,
                        calendarError = null
                    )
                }
                is NetworkResult.Error -> _uiState.value = _uiState.value.copy(isLoading = false, calendarError = res.message)
                is NetworkResult.Exception -> _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    calendarError = "Attendance history is unavailable offline. It will load when you reconnect."
                )
            }
        }
    }

    fun checkOfflinePunches() {
        viewModelScope.launch {
            val pending = HumoraApp.instance.database.offlinePunchDao().getPendingPunches()
            _uiState.value = _uiState.value.copy(pendingOfflineSyncCount = pending.size)
        }
    }

    fun triggerOfflineSync() {
        viewModelScope.launch {
            val count = attendanceRepo.syncOfflinePunches()
            checkOfflinePunches()
            _uiState.value = _uiState.value.copy(
                actionMessage = if (count > 0) "Successfully synced $count offline punches!" else "No pending punches to sync."
            )
        }
    }

    fun punchWithFace(
        punchType: String,
        base64Image: String,
        location: Location?,
        onDone: (Boolean, String) -> Unit
    ) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isFacePunching = true)
            val effectiveLoc = location ?: com.paylogic.humora.core.location.LocationProvider.getCurrentLocation(HumoraApp.instance)
            if (effectiveLoc == null) {
                _uiState.value = _uiState.value.copy(isFacePunching = false)
                onDone(false, "Location check failed: GPS coordinates are required for attendance check-in/check-out. Please enable GPS.")
                return@launch
            }

            val result = attendanceRepo.recordPunchWithFace(punchType, base64Image, effectiveLoc)
            _uiState.value = _uiState.value.copy(isFacePunching = false)

            when (result) {
                is com.paylogic.humora.data.repository.BiometricPunchResult.Success -> {
                    val msg = "Biometric Face Punch ${punchType.uppercase()} Verified (${result.confidence.toInt()}% match)!"
                    // Bug #5 Fix: update isPunchedIn based on punch direction
                    val nowPunchedIn = punchType.lowercase() == "in"
                    _uiState.value = _uiState.value.copy(
                        actionMessage = msg,
                        isPunchedIn = nowPunchedIn
                    )
                    loadMonthlyAttendance()
                    onDone(true, msg)
                }
                is com.paylogic.humora.data.repository.BiometricPunchResult.NotEnrolled -> {
                    onDone(false, result.message)
                }
                is com.paylogic.humora.data.repository.BiometricPunchResult.IdentityMismatch -> {
                    onDone(false, result.message)
                }
                is com.paylogic.humora.data.repository.BiometricPunchResult.SecurityRejection -> {
                    onDone(false, "Security: ${result.reason}")
                }
                is com.paylogic.humora.data.repository.BiometricPunchResult.GeofenceRejection -> {
                    onDone(false, "Geofence: Outside radius (${result.distanceMeters.toInt()}m)")
                }
                is com.paylogic.humora.data.repository.BiometricPunchResult.Error -> {
                    onDone(false, result.message)
                }
            }
        }
    }

    fun clearActionMessage() {
        _uiState.value = _uiState.value.copy(actionMessage = null)
    }
}
