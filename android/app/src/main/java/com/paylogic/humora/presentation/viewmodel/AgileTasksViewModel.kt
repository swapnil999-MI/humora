package com.paylogic.humora.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.paylogic.humora.HumoraApp
import com.paylogic.humora.data.model.ProjectItem
import com.paylogic.humora.data.model.SprintTaskItem
import com.paylogic.humora.data.remote.NetworkResult
import com.paylogic.humora.data.repository.WorkRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AgileTasksUiState(
    val isLoading: Boolean = false,
    val projects: List<ProjectItem> = emptyList(),
    val selectedProjectId: String? = null,
    val allTasks: List<SprintTaskItem> = emptyList(),
    val selectedFilterIndex: Int = 0, // 0: All, 1: Todo, 2: In Progress, 3: Done
    val isUpdating: Boolean = false,
    val actionMessage: String? = null
) {
    val filteredTasks: List<SprintTaskItem>
        get() = when (selectedFilterIndex) {
            1 -> allTasks.filter { it.status.equals("todo", ignoreCase = true) }
            2 -> allTasks.filter { it.status.equals("in_progress", ignoreCase = true) }
            3 -> allTasks.filter { it.status.equals("done", ignoreCase = true) }
            else -> allTasks
        }
}

class AgileTasksViewModel(
    private val workRepo: WorkRepository = HumoraApp.instance.workRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AgileTasksUiState())
    val uiState: StateFlow<AgileTasksUiState> = _uiState.asStateFlow()

    init {
        loadProjectsAndTasks()
    }

    fun loadProjectsAndTasks() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)

            when (val projectsRes = workRepo.getProjects()) {
                is NetworkResult.Success -> {
                    val projects = projectsRes.data
                    val activeProject = projects.firstOrNull()
                    _uiState.value = _uiState.value.copy(
                        projects = projects,
                        selectedProjectId = activeProject?.id
                    )

                    if (activeProject != null) {
                        loadIssuesForProject(activeProject.id)
                    } else {
                        setFallbackTasks()
                    }
                }
                else -> {
                    setFallbackTasks()
                }
            }
        }
    }

    private suspend fun loadIssuesForProject(projectId: String) {
        when (val issuesRes = workRepo.getProjectIssues(projectId)) {
            is NetworkResult.Success -> {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    allTasks = issuesRes.data
                )
            }
            else -> setFallbackTasks()
        }
    }

    private fun setFallbackTasks() {
        _uiState.value = _uiState.value.copy(
            isLoading = false,
            allTasks = listOf(
                SprintTaskItem("1", "HUM-204", "Geofence Mock Detection Engine", "high", "in_progress", "In Progress", 14400, 7200),
                SprintTaskItem("2", "HUM-189", "Sandwich Leave Rule Calculator", "medium", "todo", "To Do", 10800, 10800),
                SprintTaskItem("3", "HUM-156", "Statutory Tax Deductions preview", "low", "todo", "To Do", 7200, 7200),
                SprintTaskItem("4", "HUM-142", "Biometric Face Embedding Preprocessor", "high", "done", "Done", 18000, 0)
            )
        )
    }

    fun setFilterIndex(index: Int) {
        _uiState.value = _uiState.value.copy(selectedFilterIndex = index)
    }

    fun transitionTask(taskId: String, currentStatus: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isUpdating = true)
            val newStatus = when (currentStatus.lowercase()) {
                "todo" -> "in_progress"
                "in_progress" -> "done"
                else -> "todo"
            }

            // Target workflow status ID matching default agile workflow
            val targetStatusId = when (newStatus) {
                "in_progress" -> "40000000-0000-0000-0000-000000000002"
                "done" -> "40000000-0000-0000-0000-000000000004"
                else -> "40000000-0000-0000-0000-000000000001"
            }

            workRepo.transitionIssue(taskId, targetStatusId)

            // Optimistically update list
            val updated = _uiState.value.allTasks.map {
                if (it.id == taskId) it.copy(status = newStatus) else it
            }
            _uiState.value = _uiState.value.copy(
                isUpdating = false,
                allTasks = updated,
                actionMessage = "Task transitioned to ${newStatus.replace('_', ' ').uppercase()}"
            )
        }
    }

    fun clearActionMessage() {
        _uiState.value = _uiState.value.copy(actionMessage = null)
    }
}
