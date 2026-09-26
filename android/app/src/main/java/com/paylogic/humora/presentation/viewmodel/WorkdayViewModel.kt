package com.paylogic.humora.presentation.viewmodel

import android.location.Location
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.paylogic.humora.HumoraApp
import com.paylogic.humora.data.model.SprintTaskItem
import com.paylogic.humora.data.model.TeamMemberPresence
import com.paylogic.humora.data.remote.NetworkResult
import com.paylogic.humora.data.repository.AttendanceRepository
import com.paylogic.humora.data.repository.PunchResult
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class WorkdayUiState(
    val isPunchedIn: Boolean = false,
    val punchStatusText: String = "Shift Not Started",
    val shiftName: String = "General: 09:00 - 18:00",
    val sessionTimerSeconds: Long = 0L,
    val teamMembers: List<TeamMemberPresence> = emptyList(),
    val quickTasks: List<SprintTaskItem> = emptyList(),
    val isActionLoading: Boolean = false,
    val bannerMessage: String? = null
)

class WorkdayViewModel(
    private val attendanceRepo: AttendanceRepository = HumoraApp.instance.attendanceRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(WorkdayUiState())
    val uiState: StateFlow<WorkdayUiState> = _uiState.asStateFlow()

    private var timerJob: Job? = null

    init {
        // Collect attendance summary and session
        viewModelScope.launch {
            attendanceRepo.summary.collect { summary ->
                _uiState.value = _uiState.value.copy(
                    isPunchedIn = summary.punchedIn,
                    punchStatusText = if (summary.punchedIn) "Active On-Duty" else "Shift Not Started",
                    shiftName = summary.shiftName
                )
                if (summary.punchedIn) {
                    startTimer()
                } else {
                    stopTimer()
                }
            }
        }

        refreshData()
    }

    fun refreshData() {
        viewModelScope.launch {
            // Fetch live session
            when (val res = attendanceRepo.refreshSession()) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        sessionTimerSeconds = res.data.activeWorkSeconds,
                        isPunchedIn = res.data.currentState == "working" || res.data.currentState == "on_break"
                    )
                    if (_uiState.value.isPunchedIn) startTimer()
                }
                else -> {}
            }

            // Fetch live team presence radar
            when (val radarRes = attendanceRepo.getTeamPresenceRadar()) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(teamMembers = radarRes.data)
                }
                else -> {
                    // Fallback to sample team members if backend has no colleagues yet
                    if (_uiState.value.teamMembers.isEmpty()) {
                        _uiState.value = _uiState.value.copy(
                            teamMembers = listOf(
                                TeamMemberPresence("1", "Swapnil", "P.", "swapnil@humora.internal", "Engineering", "working", 14400, "General Shift", 0xFF6366F1),
                                TeamMemberPresence("2", "Ananya", "S.", "ananya@humora.internal", "Product", "working", 12600, "General Shift", 0xFF10B981),
                                TeamMemberPresence("3", "Rahul", "K.", "rahul@humora.internal", "Engineering", "on_break", 7200, "General Shift", 0xFF3B82F6),
                                TeamMemberPresence("4", "Priya", "M.", "priya@humora.internal", "Design", "on_leave", 0, "General Shift", 0xFFF59E0B)
                            )
                        )
                    }
                }
            }

            // Fetch quick tasks
            when (val tasksRes = HumoraApp.instance.workRepository.getProjects()) {
                is NetworkResult.Success -> {
                    val firstProject = tasksRes.data.firstOrNull()
                    if (firstProject != null) {
                        val issues = HumoraApp.instance.workRepository.getProjectIssues(firstProject.id)
                        if (issues is NetworkResult.Success) {
                            _uiState.value = _uiState.value.copy(quickTasks = issues.data.take(3))
                        }
                    }
                }
                else -> {
                    if (_uiState.value.quickTasks.isEmpty()) {
                        _uiState.value = _uiState.value.copy(
                            quickTasks = listOf(
                                SprintTaskItem("1", "HUM-204", "Geofence Mock Detection Engine", "high", "in_progress", "In Progress", 14400, 7200),
                                SprintTaskItem("2", "HUM-189", "Sandwich Leave Rule Calculator", "medium", "todo", "To Do", 10800, 10800),
                                SprintTaskItem("3", "HUM-156", "Statutory Tax Deductions preview", "low", "todo", "To Do", 7200, 7200)
                            )
                        )
                    }
                }
            }
        }
    }

    private fun startTimer() {
        if (timerJob?.isActive == true) return
        timerJob = viewModelScope.launch {
            while (true) {
                delay(1000)
                _uiState.value = _uiState.value.copy(
                    sessionTimerSeconds = _uiState.value.sessionTimerSeconds + 1
                )
            }
        }
    }

    private fun stopTimer() {
        timerJob?.cancel()
        timerJob = null
    }

    fun handleSwipePunch(targetPunchIn: Boolean, location: Location?, onComplete: (String) -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isActionLoading = true)
            val punchType = if (targetPunchIn) "in" else "out"

            // Default mock Bangalore HQ location if device has no GPS fix yet
            val effectiveLocation = location ?: Location("default").apply {
                latitude = attendanceRepo.officeLatitude
                longitude = attendanceRepo.officeLongitude
                accuracy = 5.0f
            }

            val result = attendanceRepo.recordPunch(punchType, effectiveLocation)
            _uiState.value = _uiState.value.copy(isActionLoading = false)

            when (result) {
                is PunchResult.Success -> {
                    val msg = if (result.isOfflineQueued) {
                        "Punch ${punchType.uppercase()} queued offline. Will sync when connected."
                    } else {
                        "Punch ${punchType.uppercase()} verified with backend!"
                    }
                    _uiState.value = _uiState.value.copy(bannerMessage = msg)
                    onComplete(msg)
                }
                is PunchResult.SecurityRejection -> {
                    val msg = "Security Alert: ${result.reason}"
                    _uiState.value = _uiState.value.copy(bannerMessage = msg)
                    onComplete(msg)
                }
                is PunchResult.GeofenceRejection -> {
                    val msg = "Geofence Alert: You are ${result.distanceMeters.toInt()}m away (max allowed ${result.allowedMeters.toInt()}m)"
                    _uiState.value = _uiState.value.copy(bannerMessage = msg)
                    onComplete(msg)
                }
                is PunchResult.Error -> {
                    val msg = "Punch failed: ${result.message}"
                    _uiState.value = _uiState.value.copy(bannerMessage = msg)
                    onComplete(msg)
                }
            }
        }
    }

    fun clearBanner() {
        _uiState.value = _uiState.value.copy(bannerMessage = null)
    }
}
