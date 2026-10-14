package com.paylogic.humora.data.repository

import android.content.Context
import android.location.Location
import com.paylogic.humora.core.location.GeofenceManager
import com.paylogic.humora.core.location.GeofenceStatus
import com.paylogic.humora.core.security.AntiSpoofEngine
import com.paylogic.humora.core.security.PunchKey
import com.paylogic.humora.data.model.*
import com.paylogic.humora.data.remote.HumoraApiClient
import com.paylogic.humora.data.remote.NetworkResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

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
    private val apiClient: HumoraApiClient
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

    // ── Fingerprint punch ────────────────────────────────────────────────────
    // The phone signs a one-time server challenge with PunchKey after a fingerprint scan.

    enum class FingerprintReadiness { NOT_ALLOWED, NEEDS_SETUP, READY }

    /** READY only when HR/admin allowed fingerprint and this phone holds the key the server has on file. */
    suspend fun fingerprintReadiness(userId: String): NetworkResult<FingerprintReadiness> {
        val local = runCatching { PunchKey.publicKey(userId) }.getOrNull()
        return when (val res = apiClient.getFingerprintDevice()) {
            is NetworkResult.Success -> NetworkResult.Success(
                when {
                    !res.data.allowed -> {
                        // Access was removed by HR/admin: drop the now useless key from this phone.
                        PunchKey.delete(userId)
                        FingerprintReadiness.NOT_ALLOWED
                    }
                    res.data.registered && local != null && res.data.publicKey == local -> FingerprintReadiness.READY
                    else -> FingerprintReadiness.NEEDS_SETUP
                }
            )
            is NetworkResult.Error -> res
            is NetworkResult.Exception -> res
        }
    }

    /** Creates a new fingerprint key and registers it; the server accepts it only if the selfie matches. */
    suspend fun setUpFingerprint(userId: String, selfieBase64: String): NetworkResult<FingerprintDeviceStatus> {
        // The new key's attestation must carry the server's fresh challenge.
        val challenge = when (val res = apiClient.getFingerprintRegistrationChallenge()) {
            is NetworkResult.Success -> res.data.challenge
            is NetworkResult.Error -> return res
            is NetworkResult.Exception -> return res
        }
        val created = try {
            PunchKey.create(userId, java.security.MessageDigest.getInstance("SHA-256").digest(challenge.toByteArray(Charsets.UTF_8)))
        } catch (e: Exception) {
            return NetworkResult.Error("This phone cannot create a secure fingerprint key: ${e.message}")
        }
        val label = "${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}".trim()
        val res = apiClient.registerFingerprintDevice(
            RegisterFingerprintDeviceRequest(created.publicKey, selfieBase64, label, challenge, created.attestationChain)
        )
        if (res !is NetworkResult.Success) PunchKey.delete(userId)
        return res
    }

    suspend fun getPunchChallenge(punchType: String): NetworkResult<PunchChallengeResponse> =
        apiClient.getPunchChallenge(punchType.lowercase())

    suspend fun submitFingerprintPunch(
        punchType: String,
        challenge: String,
        signature: String,
        location: Location
    ): NetworkResult<PunchWithFingerprintResponse> {
        val res = apiClient.punchWithFingerprint(
            PunchWithFingerprintRequest(
                punchType = punchType.lowercase(),
                challenge = challenge,
                signature = signature,
                latitude = location.latitude,
                longitude = location.longitude,
                accuracyMeters = location.accuracy.toDouble()
            )
        )
        if (res is NetworkResult.Success) {
            val isPunched = punchType.equals("in", true) || punchType.equals("break_end", true)
            _summary.value = _summary.value.copy(
                punchedIn = isPunched,
                lastPunchType = punchType.lowercase(),
                lastPunchTime = res.data.punchedAt,
                presenceStatus = if (isPunched) "working" else "out"
            )
            _session.value = _session.value.copy(
                currentState = if (isPunched) "working" else "out",
                lastPunchType = punchType.lowercase(),
                lastPunchTime = res.data.punchedAt
            )
        }
        return res
    }

    /** Same location checks a face punch runs before calling the server. */
    fun precheckLocation(location: Location?): String? {
        if (location == null) return "Location check failed: GPS coordinates are required for attendance check-in/check-out. Please enable GPS."
        val security = AntiSpoofEngine.validateLocation(location, context)
        if (!security.isSecure) return "Security Alert: ${security.failureReason ?: "Location compromised"}"
        val geofence = checkGeofence(location)
        if (geofence != null && !geofence.isInside) {
            return "Geofence Violation: You are ${geofence.distanceMeters.toInt()}m from the office (max ${geofence.radiusMeters.toInt()}m)."
        }
        return null
    }

    suspend fun enrollBiometricFace(images: List<String>): NetworkResult<EnrollBiometricFaceResponse> {
        val profileRes = apiClient.getMyProfile()
        val empId = if (profileRes is NetworkResult.Success) profileRes.data.employee.id else ""
        if (empId.isBlank()) {
            return NetworkResult.Error("Could not retrieve employee record for face enrollment. Ensure user is logged in.")
        }
        return apiClient.enrollBiometricFace(empId, images)
    }

    suspend fun getMonthlyAttendance(year: Int = 2026, month: Int = 9): NetworkResult<MonthlyAttendanceResponse> {
        return apiClient.getMonthlyAttendance(year, month)
    }

    suspend fun getTeamPresenceRadar(): NetworkResult<List<TeamMemberPresence>> {
        return apiClient.getTeamPresenceRadar()
    }
}
