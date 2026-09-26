package com.paylogic.humora.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.paylogic.humora.HumoraApp
import com.paylogic.humora.data.model.LeaveBalanceItem
import com.paylogic.humora.data.model.LeaveRequestItem
import com.paylogic.humora.data.model.LeaveTypeItem
import com.paylogic.humora.data.remote.NetworkResult
import com.paylogic.humora.data.repository.LeavesRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class LeavesUiState(
    val isLoading: Boolean = false,
    val balances: List<LeaveBalanceItem> = emptyList(),
    val myLeaves: List<LeaveRequestItem> = emptyList(),
    val leaveTypes: List<LeaveTypeItem> = emptyList(),
    val isSubmitting: Boolean = false,
    val actionMessage: String? = null
)

class LeavesViewModel(
    private val leavesRepo: LeavesRepository = HumoraApp.instance.leavesRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(LeavesUiState())
    val uiState: StateFlow<LeavesUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    fun loadData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)

            val balancesRes = leavesRepo.getLeaveBalances()
            val leavesRes = leavesRepo.getMyLeaves()
            val typesRes = leavesRepo.getLeaveTypes()

            val balances = if (balancesRes is NetworkResult.Success) {
                balancesRes.data
            } else {
                listOf(
                    LeaveBalanceItem("1", "20000000-0000-0000-0000-000000000003", "Casual Leave", "CL", 6.0, 8.0, 2.0),
                    LeaveBalanceItem("2", "20000000-0000-0000-0000-000000000002", "Sick Leave", "SL", 10.0, 12.0, 2.0),
                    LeaveBalanceItem("3", "20000000-0000-0000-0000-000000000001", "Privilege Leave", "PL", 14.0, 18.0, 4.0)
                )
            }

            val requests = if (leavesRes is NetworkResult.Success) {
                leavesRes.data
            } else {
                listOf(
                    LeaveRequestItem("1", "Casual Leave", "2026-08-14", "2026-08-14", 1.0, 0.0, "Family function", "approved"),
                    LeaveRequestItem("2", "Sick Leave", "2026-07-02", "2026-07-03", 2.0, 0.0, "Viral fever and doctor visit", "approved")
                )
            }

            val types = if (typesRes is NetworkResult.Success) {
                typesRes.data
            } else {
                listOf(
                    LeaveTypeItem("20000000-0000-0000-0000-000000000003", "Casual Leave", "CL", 8.0),
                    LeaveTypeItem("20000000-0000-0000-0000-000000000002", "Sick Leave", "SL", 12.0),
                    LeaveTypeItem("20000000-0000-0000-0000-000000000001", "Privilege Leave", "PL", 18.0)
                )
            }

            _uiState.value = _uiState.value.copy(
                isLoading = false,
                balances = balances,
                myLeaves = requests,
                leaveTypes = types
            )
        }
    }

    fun submitLeave(
        leaveTypeId: String,
        fromDate: String,
        toDate: String,
        reason: String,
        onDone: (Boolean, String) -> Unit
    ) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSubmitting = true)
            when (val res = leavesRepo.applyLeave(leaveTypeId, fromDate, toDate, reason)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isSubmitting = false,
                        actionMessage = "Leave application submitted successfully!"
                    )
                    loadData()
                    onDone(true, "Leave application submitted successfully!")
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(isSubmitting = false)
                    onDone(false, res.message)
                }
                is NetworkResult.Exception -> {
                    _uiState.value = _uiState.value.copy(isSubmitting = false)
                    onDone(false, res.throwable.message ?: "Failed to submit leave")
                }
            }
        }
    }

    fun clearActionMessage() {
        _uiState.value = _uiState.value.copy(actionMessage = null)
    }
}
