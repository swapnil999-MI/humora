package com.paylogic.humora.data.repository

import com.paylogic.humora.data.model.BurnoutSentinelReport
import com.paylogic.humora.data.model.EmployeeDetail
import com.paylogic.humora.data.model.EnrollBiometricFaceResponse
import com.paylogic.humora.data.model.FingerprintAccess
import com.paylogic.humora.data.model.TeamCapacityResponse
import com.paylogic.humora.data.remote.HumoraApiClient
import com.paylogic.humora.data.remote.NetworkResult
import com.paylogic.humora.data.remote.SessionManager

class AdminRepository(
    private val apiClient: HumoraApiClient,
    private val sessionManager: SessionManager
) {
    suspend fun getEmployees(search: String = ""): NetworkResult<List<EmployeeDetail>> {
        return when (val res = apiClient.getEmployees(search = search, limit = 100)) {
            is NetworkResult.Success -> NetworkResult.Success(res.data.items)
            is NetworkResult.Error -> res
            is NetworkResult.Exception -> res
        }
    }

    suspend fun enrollEmployeeFace(employeeId: String, images: List<String>): NetworkResult<EnrollBiometricFaceResponse> {
        return apiClient.enrollBiometricFace(employeeId, images)
    }

    // Fingerprint access lives on the server: the admin allows or removes it, and the
    // employee binds their own phone (after a face match) from the fingerprint punch sheet.
    suspend fun listFingerprintAccess(): NetworkResult<List<FingerprintAccess>> = apiClient.listFingerprintAccess()

    suspend fun allowFingerprint(employeeId: String): NetworkResult<Unit> = apiClient.allowEmployeeFingerprint(employeeId)

    suspend fun deleteFingerprint(employeeId: String): NetworkResult<Unit> = apiClient.deleteEmployeeFingerprint(employeeId)

    suspend fun deleteFace(employeeId: String): NetworkResult<Unit> = apiClient.deleteEmployeeFace(employeeId)

    suspend fun getTeamCapacity(): NetworkResult<TeamCapacityResponse> {
        return apiClient.getTeamCapacity()
    }

    suspend fun getBurnoutSentinel(): NetworkResult<BurnoutSentinelReport> {
        return apiClient.getBurnoutSentinel()
    }

    suspend fun getOfficeLocations(): NetworkResult<List<com.paylogic.humora.data.model.OfficeLocationDto>> {
        return apiClient.getOfficeLocations()
    }

    suspend fun createOfficeLocation(name: String, lat: Double, lon: Double, radiusMeters: Int): NetworkResult<com.paylogic.humora.data.model.OfficeLocationDto> {
        return apiClient.createOfficeLocation(com.paylogic.humora.data.model.CreateOfficeLocationDto(name, lat, lon, radiusMeters))
    }

    suspend fun updateOfficeLocation(id: String, name: String, lat: Double, lon: Double, radiusMeters: Int): NetworkResult<com.paylogic.humora.data.model.OfficeLocationDto> {
        return apiClient.updateOfficeLocation(id, com.paylogic.humora.data.model.UpdateOfficeLocationDto(name, lat, lon, radiusMeters))
    }

    val isAdmin: Boolean
        get() = sessionManager.isAdmin
}

