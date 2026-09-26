package com.paylogic.humora.data.repository

import com.paylogic.humora.data.model.ProjectItem
import com.paylogic.humora.data.model.SprintTaskItem
import com.paylogic.humora.data.model.TransitionIssueRequest
import com.paylogic.humora.data.model.WorklogRequest
import com.paylogic.humora.data.remote.HumoraApiClient
import com.paylogic.humora.data.remote.NetworkResult

class WorkRepository(
    private val apiClient: HumoraApiClient
) {
    suspend fun getProjects(): NetworkResult<List<ProjectItem>> {
        return apiClient.getProjects()
    }

    suspend fun getProjectIssues(projectId: String): NetworkResult<List<SprintTaskItem>> {
        return apiClient.getProjectIssues(projectId)
    }

    suspend fun transitionIssue(issueId: String, newStatusId: String): NetworkResult<Unit> {
        return apiClient.transitionIssue(issueId, TransitionIssueRequest(newStatusId))
    }

    suspend fun logWork(issueId: String, timeSpentSeconds: Int, comment: String? = null): NetworkResult<Unit> {
        return apiClient.logWork(issueId, WorklogRequest(timeSpentSeconds, comment))
    }
}
