package com.paylogic.humora.data.remote

import com.paylogic.humora.BuildConfig
import com.paylogic.humora.data.model.*
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logger
import io.ktor.client.plugins.logging.Logging
import io.ktor.client.plugins.logging.SIMPLE
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.json.Json

class HumoraApiClient(
    private val sessionManager: SessionManager
) {
    private val jsonConfig = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
        coerceInputValues = true
    }

    private val client = HttpClient(CIO) {
        install(ContentNegotiation) {
            json(jsonConfig)
        }

        install(HttpTimeout) {
            requestTimeoutMillis = 15000
            connectTimeoutMillis = 10000
            socketTimeoutMillis = 15000
        }

        install(Logging) {
            logger = Logger.SIMPLE
            // Request logs include URLs with tokens/tickets; never emit them from release builds.
            level = if (BuildConfig.DEBUG) LogLevel.INFO else LogLevel.NONE
        }

        defaultRequest {
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            header(HttpHeaders.Accept, ContentType.Application.Json.toString())
            val token = sessionManager.accessToken
            if (token.isNotBlank()) {
                header(HttpHeaders.Authorization, "Bearer $token")
            }
        }
    }

    private val refreshLock = Mutex()

    @Serializable
    private data class RefreshRequest(@SerialName("refresh_token") val refreshToken: String)

    /**
     * Exchanges the refresh token for a new token pair after a request was rejected with
     * [staleToken]. Concurrent callers share one refresh. Returns false when the session is over
     * (refresh token expired or revoked), in which case the user is signed out.
     */
    suspend fun refreshSession(staleToken: String): Boolean = refreshLock.withLock {
        val current = sessionManager.accessToken
        if (current.isNotBlank() && current != staleToken) return true // another caller already refreshed
        val refresh = sessionManager.refreshToken
        if (refresh.isBlank()) return false
        try {
            val response = client.post(endpoint("auth/refresh")) { setBody(RefreshRequest(refresh)) }
            if (response.status.isSuccess()) {
                val data = response.body<ApiResponse<AuthResponse>>().data ?: return false
                sessionManager.updateTokens(data.accessToken, data.refreshToken)
                return true
            }
            if (response.status.value == 401 || response.status.value == 400) {
                sessionManager.clearSession()
            }
            false
        } catch (e: Throwable) {
            false
        }
    }

    private fun endpoint(path: String): String {
        val base = NetworkConfig.baseUrl.trimEnd('/')
        val rel = path.trimStart('/')
        return "$base/$rel"
    }

    private suspend inline fun <reified T> executeRequest(
        crossinline call: suspend HttpClient.() -> HttpResponse
    ): NetworkResult<T> {
        return try {
            val sentWith = sessionManager.accessToken
            var response = client.call()
            // Expired access token: refresh once and replay the request.
            if (response.status.value == 401 && sentWith.isNotBlank() && refreshSession(sentWith)) {
                response = client.call()
            }
            if (response.status.isSuccess()) {
                val apiResponse = response.body<ApiResponse<T>>()
                if (apiResponse.success && apiResponse.data != null) {
                    NetworkResult.Success(apiResponse.data, apiResponse.message)
                } else if (apiResponse.success && Unit is T) {
                    @Suppress("UNCHECKED_CAST")
                    NetworkResult.Success(Unit as T, apiResponse.message)
                } else {
                    NetworkResult.Error(apiResponse.message.ifBlank { "Operation failed" }, response.status.value)
                }
            } else {
                val errorMsg = try {
                    val err = response.body<ApiResponse<String>>()
                    err.message
                } catch (_: Exception) {
                    "HTTP ${response.status.value}: ${response.status.description}"
                }
                NetworkResult.Error(errorMsg, response.status.value)
            }
        } catch (e: Throwable) {
            NetworkResult.Exception(e)
        }
    }

    // ==========================================
    // 1. HEALTH & CONNECTIVITY
    // ==========================================
    suspend fun ping(): NetworkResult<Map<String, String>> {
        return executeRequest {
            get(endpoint("ping"))
        }
    }

    // ==========================================
    // 2. AUTHENTICATION
    // ==========================================
    suspend fun login(request: LoginRequest): NetworkResult<AuthResponse> {
        return executeRequest {
            post(endpoint("auth/login")) {
                setBody(request)
            }
        }
    }

    suspend fun registerOrganization(request: RegisterOrganizationRequest): NetworkResult<AuthResponse> {
        return executeRequest {
            post(endpoint("auth/register")) {
                setBody(request)
            }
        }
    }

    suspend fun getProfile(): NetworkResult<UserSummary> {
        return executeRequest {
            get(endpoint("auth/me"))
        }
    }

    suspend fun getNotifications(limit: Int = 30): NetworkResult<AppNotificationList> {
        return executeRequest {
            get(endpoint("notifications")) { parameter("limit", limit) }
        }
    }

    suspend fun markNotificationRead(id: String): NetworkResult<Unit> {
        return executeRequest {
            post(endpoint("notifications/$id/read"))
        }
    }

    suspend fun getAuthProviders(): NetworkResult<AuthProvidersResponse> {
        return executeRequest {
            get(endpoint("auth/providers"))
        }
    }

    suspend fun confirmQR(sessionId: String, nonce: String): NetworkResult<Unit> {
        return executeRequest {
            post(endpoint("auth/qr/confirm")) {
                setBody(QRConfirmRequest(sessionId, nonce))
            }
        }
    }

    suspend fun qrInfo(sessionId: String, nonce: String): NetworkResult<QRInfo> {
        return executeRequest {
            get(endpoint("auth/qr/info")) {
                url.parameters.append("session_id", sessionId)
                url.parameters.append("nonce", nonce)
            }
        }
    }

    /** Collects a finished social login with the PKCE verifier this app holds. */
    suspend fun exchangeOAuth(code: String, verifier: String): NetworkResult<AuthResponse> {
        return executeRequest {
            post(endpoint("auth/oauth/exchange")) {
                setBody(OAuthExchangeRequest(code, verifier))
            }
        }
    }

    // ==========================================
    // 3. ATTENDANCE & PUNCH
    // ==========================================
    suspend fun punch(request: PunchRequest): NetworkResult<PunchResponse> {
        return executeRequest {
            post(endpoint("hrms/attendance/punch")) {
                setBody(request)
            }
        }
    }

    suspend fun punchWithFace(request: PunchWithFaceRequest): NetworkResult<PunchWithFaceResponse> {
        return executeRequest {
            post(endpoint("hrms/attendance/punch-with-face")) {
                setBody(request)
            }
        }
    }

    suspend fun enrollBiometricFace(employeeId: String, images: List<String>): NetworkResult<EnrollBiometricFaceResponse> {
        return executeRequest {
            post(endpoint("hrms/employees/$employeeId/biometric-face")) {
                setBody(EnrollBiometricFaceRequest(images))
            }
        }
    }

    suspend fun getEmployees(search: String = "", limit: Int = 100, page: Int = 1): NetworkResult<PaginatedEmployeesResponse> {
        return executeRequest {
            get(endpoint("hrms/employees")) {
                if (search.isNotBlank()) parameter("search", search)
                parameter("limit", limit)
                parameter("page", page)
            }
        }
    }

    suspend fun getMyProfile(): NetworkResult<FullEmployeeProfile> {
        return executeRequest {
            get(endpoint("hrms/profile/me"))
        }
    }

    suspend fun getAttendanceSession(): NetworkResult<AttendanceSessionResponse> {
        return executeRequest {
            get(endpoint("hrms/attendance/session"))
        }
    }

    suspend fun getAttendanceSummary(): NetworkResult<AttendanceSummary> {
        return executeRequest {
            get(endpoint("hrms/attendance/summary"))
        }
    }

    suspend fun getMonthlyAttendance(year: Int = 2026, month: Int = 9): NetworkResult<MonthlyAttendanceResponse> {
        return executeRequest {
            get(endpoint("hrms/attendance/calendar")) {
                parameter("year", year)
                parameter("month", month)
            }
        }
    }

    suspend fun getTeamPresenceRadar(): NetworkResult<List<TeamMemberPresence>> {
        return executeRequest {
            get(endpoint("hrms/attendance/radar"))
        }
    }

    // ==========================================
    // 4. LEAVES
    // ==========================================
    suspend fun getLeaveBalances(): NetworkResult<List<LeaveBalanceItem>> {
        return executeRequest {
            get(endpoint("hrms/leaves/balances"))
        }
    }

    suspend fun getMyLeaves(): NetworkResult<List<LeaveRequestItem>> {
        return executeRequest {
            get(endpoint("hrms/leaves/my-requests"))
        }
    }

    suspend fun getLeaveTypes(): NetworkResult<List<LeaveTypeItem>> {
        return executeRequest {
            get(endpoint("hrms/leaves/types"))
        }
    }

    suspend fun applyLeave(request: ApplyLeaveRequest): NetworkResult<LeaveRequestItem> {
        return executeRequest {
            post(endpoint("hrms/leaves/apply")) {
                setBody(request)
            }
        }
    }

    // ==========================================
    // 5. WORK & AGILE TASKS
    // ==========================================
    suspend fun getProjects(): NetworkResult<List<ProjectItem>> {
        return executeRequest {
            get(endpoint("work/projects"))
        }
    }

    suspend fun getProjectIssues(projectId: String): NetworkResult<List<SprintTaskItem>> {
        return executeRequest {
            get(endpoint("work/projects/$projectId/issues"))
        }
    }

    suspend fun transitionIssue(issueId: String, request: TransitionIssueRequest): NetworkResult<Unit> {
        return executeRequest {
            put(endpoint("work/issues/$issueId/transition")) {
                setBody(request)
            }
        }
    }

    suspend fun logWork(issueId: String, request: WorklogRequest): NetworkResult<Unit> {
        return executeRequest {
            post(endpoint("work/issues/$issueId/worklogs")) {
                setBody(request)
            }
        }
    }

    // ==========================================
    // 6. PAYROLL
    // ==========================================
    suspend fun getMyPayslips(): NetworkResult<List<PayslipItem>> {
        return executeRequest {
            get(endpoint("hrms/payroll/payslips/mine"))
        }
    }

    suspend fun getMyCompensation(): NetworkResult<CompensationItem> {
        return executeRequest {
            get(endpoint("hrms/payroll/compensation/me"))
        }
    }

    // ==========================================
    // 7. SYNERGY CAPACITY & BURNOUT SENTINEL
    // ==========================================
    suspend fun getTeamCapacity(): NetworkResult<TeamCapacityResponse> {
        return executeRequest {
            get(endpoint("fusion/team-capacity"))
        }
    }

    suspend fun getBurnoutSentinel(): NetworkResult<BurnoutSentinelReport> {
        return executeRequest {
            get(endpoint("fusion/burnout-sentinel"))
        }
    }

    // ==========================================
    // 8. OFFICE GEOFENCE LOCATIONS
    // ==========================================
    suspend fun getOfficeLocations(): NetworkResult<List<OfficeLocationDto>> {
        return executeRequest {
            get(endpoint("hrms/locations"))
        }
    }

    suspend fun createOfficeLocation(request: CreateOfficeLocationDto): NetworkResult<OfficeLocationDto> {
        return executeRequest {
            post(endpoint("hrms/locations")) {
                setBody(request)
            }
        }
    }

    suspend fun updateOfficeLocation(id: String, request: UpdateOfficeLocationDto): NetworkResult<OfficeLocationDto> {
        return executeRequest {
            put(endpoint("hrms/locations/$id")) {
                setBody(request)
            }
        }
    }
}

