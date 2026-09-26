package com.paylogic.humora.data.repository

import com.paylogic.humora.data.model.CompensationItem
import com.paylogic.humora.data.model.PayslipItem
import com.paylogic.humora.data.remote.HumoraApiClient
import com.paylogic.humora.data.remote.NetworkResult

class PayrollRepository(
    private val apiClient: HumoraApiClient
) {
    suspend fun getMyPayslips(): NetworkResult<List<PayslipItem>> {
        return apiClient.getMyPayslips()
    }

    suspend fun getMyCompensation(): NetworkResult<CompensationItem> {
        return apiClient.getMyCompensation()
    }
}
