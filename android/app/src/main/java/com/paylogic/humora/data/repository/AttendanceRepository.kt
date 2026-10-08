package com.paylogic.humora.data.repository

import android.content.Context
import android.location.Location
import com.paylogic.humora.core.location.GeofenceManager
import com.paylogic.humora.core.location.GeofenceStatus
import com.paylogic.humora.core.security.AntiSpoofEngine
import com.paylogic.humora.data.local.HumoraDatabase
import com.paylogic.humora.data.local.OfflinePunchEntity
import com.paylogic.humora.data.model.*
import com.paylogic.humora.data.remote.HumoraApiClient
import com.paylogic.humora.data.remote.NetworkResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.text.SimpleDateFormat
import java.util.*

sealed interface PunchResult {
    data class Success(val response: PunchResponse, val isOfflineQueued: Boolean = false) : PunchResult
    data class SecurityRejection(val reason: String) : PunchResult
    data class GeofenceRejection(val distanceMeters: Double, val allowedMeters: Double) : PunchResult
    data class Error(val message: String) : PunchResult
}

sealed interface BiometricPunchResult {
    data class Success(
        val response: PunchWithFaceResponse,
        val confidence: Double,
        val distance: Float,
        val message: String
    ) : BiometricPunchResult
    data class NotEnrolled(val message: String, val employeeId: String? = null) : BiometricPunchResult
    data class IdentityMismatch(val message: String) : BiometricPunchResult
    data class SecurityRejection(val reason: String) : BiometricPunchResult
    data class GeofenceRejection(val distanceMeters: Double, val allowedMeters: Double) : BiometricPunchResult
    data class Error(val message: String) : BiometricPunchResult
}

class AttendanceRepository(
    private val context: Context,
    private val apiClient: HumoraApiClient,
    private val database: HumoraDatabase? = null
) {
    // The organisation's configured offices (Admin > Geofence). Empty until loaded, or if none exist.
    @Volatile private var offices: List<OfficeLocationDto> = emptyList()
    @Volatile private var officesLoaded = false

    private val _geofence = MutableStateFlow<GeofenceStatus?>(null)
    /** Latest check against the nearest office; null until both a location and an office are known. */
    val geofence: StateFlow<GeofenceStatus?> = _geofence.asStateFlow()

    /** null while not loaded yet; false when the organisation has no office set up. */
    val hasOffices: Boolean? get() = if (officesLoaded) offices.isNotEmpty() else null

    private val _summary = MutableStateFlow(
        AttendanceSummary(
            punchedIn = false,
            lastPunchType = "out",
            todayHours = 0.0,
            presenceStatus = "not_punched",
            shiftName = ""
        )
    )
    val summary: StateFlow<AttendanceSummary> = _summary.asStateFlow()

    private val _session = MutableStateFlow(
        AttendanceSessionResponse(
            currentState = "out",
            activeWorkSeconds = 0
        )
    )
    val session: StateFlow<AttendanceSessionResponse> = _session.asStateFlow()

    suspend fun fetchOfficeLocations(): NetworkResult<List<OfficeLocationDto>> {
        val res = apiClient.getOfficeLocations()
        if (res is NetworkResult.Success) {
            offices = res.data
            officesLoaded = true
        }
        return res
    }

    /**
     * Checks [currentLocation] against every configured office: inside any of them wins, otherwise the
     * office whose boundary is closest. Null when the location or the offices are unknown; the server
     * validates every punch regardless.
     */
    fun checkGeofence(currentLocation: Location?): GeofenceStatus? {
        if (currentLocation == null || offices.isEmpty()) return null
        val status = offices
            .map {
                GeofenceManager.checkGeofence(
                    userLat = currentLocation.latitude,
                    userLon = currentLocation.longitude,
                    officeLat = it.latitude,
                    officeLon = it.longitude,
                    allowedRadiusMeters = it.radiusMeters.toDouble(),
                    officeName = it.name
                )
            }
            .minBy { if (it.isInside) -1.0 else it.distanceMeters - it.radiusMeters }
        _geofence.value = status
        return status
    }

    suspend fun refreshSession(): NetworkResult<AttendanceSessionResponse> {
        // Sync active geofence from backend
        fetchOfficeLocations()

        return when (val result = apiClient.getAttendanceSession()) {
            is NetworkResult.Success -> {
                _session.value = result.data
                _summary.value = _summary.value.copy(
                    punchedIn = result.data.currentState == "working" || result.data.currentState == "on_break",
                    lastPunchType = result.data.lastPunchType,
                    lastPunchTime = result.data.lastPunchTime,
                    todayHours = result.data.activeWorkSeconds / 3600.0,
                    presenceStatus = result.data.currentState
                )
                result
            }
            is NetworkResult.Error -> result
            is NetworkResult.Exception -> result
        }
    }

    suspend fun recordPunch(
        punchType: String,
        location: Location?
    ): PunchResult {
        if (location == null) {
            return PunchResult.Error("Location check failed: GPS coordinates are required for attendance check-in/check-out. Please enable GPS.")
        }
        // 1. Anti-Spoof Validation
        val securityCheck = AntiSpoofEngine.validateLocation(location, context)
        if (!securityCheck.isSecure) {
            return PunchResult.SecurityRejection(securityCheck.failureReason ?: "Location compromised")
        }

        val loc = location!!

        // 2. Geofence pre-check (the server enforces it too)
        val geofence = checkGeofence(loc)

        if (geofence != null && !geofence.isInside) {
            return PunchResult.GeofenceRejection(
                distanceMeters = geofence.distanceMeters,
                allowedMeters = geofence.radiusMeters
            )
        }

        val normalizedType = punchType.lowercase() // "in" or "out"
        val request = PunchRequest(
            punchType = normalizedType,
            latitude = loc.latitude,
            longitude = loc.longitude,
            accuracyMeters = loc.accuracy.toDouble(),
            source = "android"
        )

        // 3. Attempt live punch with backend
        return when (val networkResult = apiClient.punch(request)) {
            is NetworkResult.Success -> {
                val resp = networkResult.data
                val isPunched = normalizedType == "in" || normalizedType == "break_end"
                _summary.value = _summary.value.copy(
                    punchedIn = isPunched,
                    lastPunchType = normalizedType,
                    lastPunchTime = resp.punchedAt,
                    presenceStatus = if (isPunched) "working" else "out"
                )
                _session.value = _session.value.copy(
                    currentState = if (isPunched) "working" else "out",
                    lastPunchType = normalizedType,
                    lastPunchTime = resp.punchedAt
                )
                PunchResult.Success(resp, isOfflineQueued = false)
            }
            is NetworkResult.Error -> {
                val msg = networkResult.message
                if ((msg.contains("geofence", ignoreCase = true) || msg.contains("outside", ignoreCase = true)) && geofence != null) {
                    PunchResult.GeofenceRejection(
                        distanceMeters = geofence.distanceMeters,
                        allowedMeters = geofence.radiusMeters
                    )
                } else {
                    PunchResult.Error(msg)
                }
            }
            is NetworkResult.Exception -> {
                // Offline fallback: Queue into Room DB
                val now = System.currentTimeMillis()
                try {
                    database?.offlinePunchDao()?.insertPunch(
                        OfflinePunchEntity(
                            punchType = normalizedType,
                            latitude = loc.latitude,
                            longitude = loc.longitude,
                            accuracy = loc.accuracy,
                            timestamp = now,
                            isSynced = false
                        )
                    )

                    val isPunched = normalizedType == "in" || normalizedType == "break_end"
                    _summary.value = _summary.value.copy(
                        punchedIn = isPunched,
                        lastPunchType = normalizedType,
                        presenceStatus = if (isPunched) "working" else "out"
                    )

                    val timeStr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date(now))
                    PunchResult.Success(
                        PunchResponse(
                            id = "offline-$now",
                            punchType = normalizedType,
                            punchedAt = timeStr,
                            isGeofenceVerified = true,
                            isOfflineSigned = true,
                            message = "Offline punch queued for background sync"
                        ),
                        isOfflineQueued = true
                    )
                } catch (e: Exception) {
                    PunchResult.Error(e.message ?: "Failed to queue offline punch")
                }
            }
        }
    }

    suspend fun recordPunchWithFace(
        punchType: String,
        base64Image: String,
        location: Location?,
        source: String = "android"
    ): BiometricPunchResult {
        if (location == null) {
            return BiometricPunchResult.Error("Location check failed: GPS coordinates are required for attendance check-in/check-out. Please enable GPS.")
        }

        val securityCheck = AntiSpoofEngine.validateLocation(location, context)
        if (!securityCheck.isSecure) {
            return BiometricPunchResult.SecurityRejection(securityCheck.failureReason ?: "Location compromised")
        }

        val loc = location
        val geofence = checkGeofence(loc)
        if (geofence != null && !geofence.isInside) {
            return BiometricPunchResult.GeofenceRejection(geofence.distanceMeters, geofence.radiusMeters)
        }

        val normalizedType = punchType.lowercase()
        val request = PunchWithFaceRequest(
            punchType = normalizedType,
            selfieImage = base64Image,
            latitude = loc.latitude,
            longitude = loc.longitude,
            accuracyMeters = loc.accuracy.toDouble(),
            source = source
        )

        return when (val res = apiClient.punchWithFace(request)) {
            is NetworkResult.Success -> {
                val data = res.data
                val isPunched = normalizedType == "in" || normalizedType == "break_end"
                _summary.value = _summary.value.copy(
                    punchedIn = isPunched,
                    lastPunchType = normalizedType,
                    lastPunchTime = data.punchedAt,
                    presenceStatus = if (isPunched) "working" else "out"
                )
                _session.value = _session.value.copy(
                    currentState = if (isPunched) "working" else "out",
                    lastPunchType = normalizedType,
                    lastPunchTime = data.punchedAt
                )
                BiometricPunchResult.Success(
                    response = data,
                    confidence = data.faceConfidence,
                    distance = data.faceDistance,
                    message = data.message
                )
            }
            is NetworkResult.Error -> {
                val msg = res.message
                if (msg.contains("no biometric face profile registered", ignoreCase = true)) {
                    BiometricPunchResult.NotEnrolled(msg)
                } else if (msg.contains("identity mismatch", ignoreCase = true) || msg.contains("Proxy punch prevented", ignoreCase = true)) {
                    BiometricPunchResult.IdentityMismatch(msg)
                } else if ((msg.contains("geofence", ignoreCase = true) || msg.contains("outside", ignoreCase = true)) && geofence != null) {
                    BiometricPunchResult.GeofenceRejection(geofence.distanceMeters, geofence.radiusMeters)
                } else {
                    BiometricPunchResult.Error(msg)
                }
            }
            is NetworkResult.Exception -> BiometricPunchResult.Error(res.throwable.message ?: "Face verification connection failed")
        }
    }

    suspend fun enrollBiometricFace(images: List<String>): NetworkResult<EnrollBiometricFaceResponse> {
        val profileRes = apiClient.getMyProfile()
        val empId = if (profileRes is NetworkResult.Success) profileRes.data.employee.id else ""
        if (empId.isBlank()) {
            return NetworkResult.Error("Could not retrieve employee record for face enrollment. Ensure user is logged in.")
        }
        return apiClient.enrollBiometricFace(empId, images)
    }

    suspend fun syncOfflinePunches(): Int {
        val dao = database?.offlinePunchDao() ?: return 0
        val pending = dao.getPendingPunches()
        var syncedCount = 0

        for (item in pending) {
            val req = PunchRequest(
                punchType = item.punchType,
                latitude = item.latitude,
                longitude = item.longitude,
                accuracyMeters = item.accuracy.toDouble(),
                punchedAt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }.format(Date(item.timestamp)),
                source = "android"
            )
            val res = apiClient.punch(req)
            if (res is NetworkResult.Success) {
                dao.markPunchSynced(item.localId)
                syncedCount++
            }
        }
        return syncedCount
    }

    suspend fun getMonthlyAttendance(year: Int = 2026, month: Int = 9): NetworkResult<MonthlyAttendanceResponse> {
        return apiClient.getMonthlyAttendance(year, month)
    }

    suspend fun getTeamPresenceRadar(): NetworkResult<List<TeamMemberPresence>> {
        return apiClient.getTeamPresenceRadar()
    }
}
