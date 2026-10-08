package com.paylogic.humora.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.paylogic.humora.HumoraApp
import com.paylogic.humora.data.model.CompensationItem
import com.paylogic.humora.data.model.PayslipItem
import com.paylogic.humora.data.remote.NetworkResult
import com.paylogic.humora.data.repository.PayrollRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class PayrollUiState(
    val isLoading: Boolean = false,
    val payslips: List<PayslipItem> = emptyList(),
    val compensation: CompensationItem = CompensationItem(), // zeroed — populated from API
    val nextPayDate: String = "",                           // populated from API or left blank
    val actionMessage: String? = null
)

class PayrollViewModel(
    private val payrollRepo: PayrollRepository = HumoraApp.instance.payrollRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(PayrollUiState())
    val uiState: StateFlow<PayrollUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    fun loadData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)

            val payslipsRes = payrollRepo.getMyPayslips()
            val compRes = payrollRepo.getMyCompensation()

            // Issue #6 Fix: No fake fallback payslips — show empty list on API failure
            val payslips = if (payslipsRes is NetworkResult.Success && payslipsRes.data.isNotEmpty()) {
                payslipsRes.data
            } else {
                emptyList()
            }

            val comp = if (compRes is NetworkResult.Success) {
                compRes.data
            } else {
                _uiState.value.compensation
            }

            _uiState.value = _uiState.value.copy(
                isLoading = false,
                payslips = payslips,
                compensation = comp
            )
        }
    }
}
