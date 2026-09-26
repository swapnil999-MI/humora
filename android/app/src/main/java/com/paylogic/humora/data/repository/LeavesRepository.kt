package com.paylogic.humora.data.repository

import com.paylogic.humora.data.model.ApplyLeaveRequest
import com.paylogic.humora.data.model.LeaveBalanceItem
import com.paylogic.humora.data.model.LeaveRequestItem
import com.paylogic.humora.data.model.LeaveTypeItem
import com.paylogic.humora.data.remote.HumoraApiClient
import com.paylogic.humora.data.remote.NetworkResult

class LeavesRepository(
    private val apiClient: HumoraApiClient
) {
    suspend fun getLeaveBalances(): NetworkResult<List<LeaveBalanceItem>> {
        return apiClient.getLeaveBalances()
    }

    suspend fun getMyLeaves(): NetworkResult<List<LeaveRequestItem>> {
        return apiClient.getMyLeaves()
    }

    suspend fun getLeaveTypes(): NetworkResult<List<LeaveTypeItem>> {
        return apiClient.getLeaveTypes()
    }

    suspend fun applyLeave(
        leaveTypeId: String,
        fromDate: String,
        toDate: String,
        reason: String
    ): NetworkResult<LeaveRequestItem> {
        val req = ApplyLeaveRequest(
            leaveTypeId = leaveTypeId,
            fromDate = fromDate,
            toDate = toDate,
            reason = reason
        )
        return apiClient.applyLeave(req)
    }
}
