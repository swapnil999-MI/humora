package com.paylogic.humora.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.paylogic.humora.HumoraApp
import com.paylogic.humora.data.model.SprintTaskItem
import com.paylogic.humora.data.model.TeamMemberPresence
import com.paylogic.humora.data.remote.NetworkResult
import com.paylogic.humora.data.repository.AttendanceRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class WorkdayUiState(
    val isPunchedIn: Boolean = false,
    val punchStatusText: String = "Shift Not Started",
    val shiftName: String = "",   // blank until API responds — avoid showing wrong shift
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
                    // Issue #7 Fix: No fake fallback team members — show empty list if API unavailable
                    // This prevents developer names (Swapnil, Ananya, etc.) from leaking to real users
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
                    // Issue #9 Fix: No fake fallback tasks — leave quickTasks empty if API unavailable
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

    fun clearBanner() {
        _uiState.value = _uiState.value.copy(bannerMessage = null)
    }
}
