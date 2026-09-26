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
    val compensation: CompensationItem = CompensationItem(
        annualCtc = 1800000.0,
        monthlyGross = 150000.0,
        basic = 75000.0,
        hra = 37500.0,
        specialAllowance = 37500.0
    ),
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

            val payslips = if (payslipsRes is NetworkResult.Success && payslipsRes.data.isNotEmpty()) {
                payslipsRes.data
            } else {
                listOf(
                    PayslipItem("1", "Swapnil P.", 8, 2026, "August 2026", 142800.0, 165000.0, 22200.0, "paid", "2026-08-31"),
                    PayslipItem("2", "Swapnil P.", 7, 2026, "July 2026", 142800.0, 165000.0, 22200.0, "paid", "2026-07-31"),
                    PayslipItem("3", "Swapnil P.", 6, 2026, "June 2026", 138500.0, 160000.0, 21500.0, "paid", "2026-06-30")
                )
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
