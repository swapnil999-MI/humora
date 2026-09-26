package com.paylogic.humora.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ==========================================
// 1. AUTHENTICATION & USER SESSION DTOs
// ==========================================

@Serializable
data class LoginRequest(
    @SerialName("tenant_slug") val tenantSlug: String = "",
    val email: String,
    val password: String
)

@Serializable
data class UserSummary(
    val id: String = "",
    @SerialName("tenant_id") val tenantId: String = "",
    @SerialName("tenant_name") val tenantName: String = "",
    @SerialName("tenant_slug") val tenantSlug: String = "",
    val email: String = "",
    val status: String = "",
    @SerialName("presence_status") val presenceStatus: String = "",
    val roles: List<String> = emptyList(),
    val permissions: List<String> = emptyList()
)

@Serializable
data class AuthResponse(
    @SerialName("access_token") val accessToken: String = "",
    @SerialName("refresh_token") val refreshToken: String = "",
    @SerialName("token_type") val tokenType: String = "Bearer",
    @SerialName("expires_in") val expiresIn: Long = 0L,
    val user: UserSummary = UserSummary()
)

// ==========================================
// 2. ATTENDANCE & PUNCH DTOs
// ==========================================

@Serializable
data class PunchRequest(
    @SerialName("punch_type") val punchType: String, // "in", "out", "break_start", "break_end"
    val latitude: Double? = null,
    val longitude: Double? = null,
    @SerialName("accuracy_meters") val accuracyMeters: Double? = null,
    @SerialName("location_id") val locationId: String? = null,
    @SerialName("wifi_bssid") val wifiBssid: String = "",
    @SerialName("punched_at") val punchedAt: String? = null,
    val source: String = "android"
)

@Serializable
data class PunchResponse(
    val id: String = "",
    @SerialName("punch_type") val punchType: String = "",
    @SerialName("punched_at") val punchedAt: String = "",
    @SerialName("is_geofence_verified") val isGeofenceVerified: Boolean = false,
    @SerialName("is_offline_signed") val isOfflineSigned: Boolean = false,
    val message: String = ""
)

@Serializable
data class PunchWithFaceRequest(
    @SerialName("punch_type") val punchType: String,
    @SerialName("selfie_image") val selfieImage: String,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @SerialName("accuracy_meters") val accuracyMeters: Double? = null,
    val source: String = "android"
)

@Serializable
data class PunchWithFaceResponse(
    val id: String = "",
    @SerialName("punch_type") val punchType: String = "",
    @SerialName("punched_at") val punchedAt: String = "",
    @SerialName("is_face_verified") val isFaceVerified: Boolean = false,
    @SerialName("face_confidence") val faceConfidence: Double = 0.0,
    @SerialName("face_distance") val faceDistance: Float = 0.0f,
    @SerialName("selfie_url") val selfieUrl: String? = null,
    @SerialName("is_geofence_verified") val isGeofenceVerified: Boolean = false,
    val message: String = ""
)

@Serializable
data class EnrollBiometricFaceRequest(
    val images: List<String>
)

@Serializable
data class EnrollBiometricFaceResponse(
    @SerialName("employee_id") val employeeId: String = "",
    @SerialName("face_url") val faceUrl: String = "",
    @SerialName("sample_count") val sampleCount: Int = 0,
    @SerialName("enrolled_at") val enrolledAt: String = "",
    val message: String = ""
)

@Serializable
data class EmployeeMini(
    val id: String = "",
    @SerialName("first_name") val firstName: String = "",
    @SerialName("last_name") val lastName: String = "",
    @SerialName("work_email") val workEmail: String = "",
    @SerialName("face_embedding") val faceEmbedding: String? = null
)

@Serializable
data class MyProfileResponse(
    val employee: EmployeeMini = EmployeeMini()
)


@Serializable
data class AttendancePunchItem(
    val id: String = "",
    @SerialName("punch_type") val punchType: String = "",
    @SerialName("punched_at") val punchedAt: String = "",
    val latitude: Double? = null,
    val longitude: Double? = null,
    @SerialName("is_geofence_verified") val isGeofenceVerified: Boolean = false
)

@Serializable
data class AttendanceSessionResponse(
    @SerialName("employee_id") val employeeId: String = "",
    @SerialName("current_state") val currentState: String = "out", // 'out', 'working', 'on_break'
    @SerialName("first_punch_in") val firstPunchIn: String? = null,
    @SerialName("last_punch_time") val lastPunchTime: String? = null,
    @SerialName("last_punch_type") val lastPunchType: String = "",
    @SerialName("active_work_seconds") val activeWorkSeconds: Long = 0,
    @SerialName("break_seconds") val breakSeconds: Long = 0,
    @SerialName("is_late_in") val isLateIn: Boolean = false,
    @SerialName("today_punches") val todayPunches: List<AttendancePunchItem> = emptyList()
)

@Serializable
data class AttendanceSummary(
    @SerialName("punched_in") val punchedIn: Boolean = false,
    @SerialName("last_punch_type") val lastPunchType: String = "",
    @SerialName("last_punch_time") val lastPunchTime: String? = null,
    @SerialName("today_hours") val todayHours: Double = 0.0,
    @SerialName("presence_status") val presenceStatus: String = "not_punched",
    @SerialName("shift_name") val shiftName: String = "General Shift (09:00 - 18:00)"
)

@Serializable
data class MonthlyAttendanceDay(
    val date: String, // "2026-09-01"
    @SerialName("day_of_week") val dayOfWeek: String = "",
    val status: String, // 'present', 'half_day', 'absent', 'leave', 'holiday', 'weekend', 'regularized'
    @SerialName("status_label") val statusLabel: String = "",
    @SerialName("work_hours") val workHours: Double = 0.0,
    @SerialName("is_late_in") val isLateIn: Boolean = false,
    @SerialName("shift_name") val shiftName: String = ""
)

@Serializable
data class MonthlyAttendanceResponse(
    val year: Int = 2026,
    val month: Int = 9,
    val days: List<MonthlyAttendanceDay> = emptyList(),
    @SerialName("total_present") val totalPresent: Double = 0.0,
    @SerialName("total_half_days") val totalHalfDays: Int = 0,
    @SerialName("total_absent") val totalAbsent: Int = 0,
    @SerialName("total_leaves") val totalLeaves: Double = 0.0,
    @SerialName("total_holidays") val totalHolidays: Int = 0,
    @SerialName("total_work_hours") val totalWorkHours: Double = 0.0,
    @SerialName("average_work_hours") val averageWorkHours: Double = 0.0
)

@Serializable
data class TeamMemberPresence(
    @SerialName("employee_id") val id: String,
    @SerialName("first_name") val firstName: String,
    @SerialName("last_name") val lastName: String,
    @SerialName("work_email") val workEmail: String = "",
    @SerialName("department_name") val departmentName: String? = null,
    @SerialName("presence_status") val status: String, // "working", "on_break", "late_in", "on_leave", "absent", "not_punched"
    @SerialName("active_work_seconds") val activeWorkSeconds: Long = 0,
    @SerialName("shift_name") val shiftName: String = "",
    val avatarColor: Long = 0xFF6366F1
) {
    val fullName: String
        get() = "$firstName $lastName".trim()
}

// ==========================================
// 3. LEAVES & TIME OFF DTOs
// ==========================================

@Serializable
data class LeaveTypeItem(
    val id: String,
    val name: String,
    val code: String,
    @SerialName("annual_quota") val annualQuota: Double = 0.0
)

@Serializable
data class LeaveBalanceItem(
    val id: String,
    @SerialName("leave_type_id") val leaveTypeId: String = "",
    @SerialName("leave_type_name") val name: String,
    @SerialName("leave_type_code") val code: String,
    val balance: Double = 0.0,
    val credited: Double = 0.0,
    val used: Double = 0.0,
    val year: Int = 2026
)

@Serializable
data class LeaveRequestItem(
    val id: String,
    @SerialName("leave_type_name") val typeName: String? = null,
    @SerialName("from_date") val fromDate: String,
    @SerialName("to_date") val toDate: String,
    @SerialName("total_days") val totalDays: Double = 1.0,
    @SerialName("sandwich_days_added") val sandwichDaysAdded: Double = 0.0,
    val reason: String = "",
    val status: String = "pending" // 'pending', 'approved', 'rejected'
)

@Serializable
data class ApplyLeaveRequest(
    @SerialName("leave_type_id") val leaveTypeId: String,
    @SerialName("from_date") val fromDate: String, // YYYY-MM-DD
    @SerialName("to_date") val toDate: String,     // YYYY-MM-DD
    val reason: String
)

// ==========================================
// 4. AGILE WORK & TASKS DTOs
// ==========================================

@Serializable
data class ProjectItem(
    val id: String,
    val key: String,
    val name: String,
    val status: String = "active"
)

@Serializable
data class SprintTaskItem(
    val id: String,
    @SerialName("issue_key") val issueKey: String,
    val title: String,
    val priority: String = "medium", // lowest, low, medium, high, highest
    val status: String = "todo",     // todo, in_progress, done
    @SerialName("status_name") val statusName: String? = null,
    @SerialName("original_estimate_seconds") val originalEstimateSeconds: Int = 0,
    @SerialName("remaining_estimate_seconds") val remainingEstimateSeconds: Int = 0
) {
    val estimatedHours: Double
        get() = originalEstimateSeconds / 3600.0
    val loggedHours: Double
        get() = (originalEstimateSeconds - remainingEstimateSeconds).coerceAtLeast(0) / 3600.0
}

@Serializable
data class TransitionIssueRequest(
    @SerialName("to_status_id") val toStatusId: String
)

@Serializable
data class WorklogRequest(
    @SerialName("time_spent_seconds") val timeSpentSeconds: Int,
    val comment: String? = null
)

// ==========================================
// 5. PAYROLL DTOs
// ==========================================

@Serializable
data class PayslipItem(
    val id: String,
    @SerialName("employee_name") val employeeName: String = "",
    val month: Int = 8,
    val year: Int = 2026,
    @SerialName("pay_period") val payPeriod: String = "August 2026",
    @SerialName("net_pay") val netPayAmount: Double = 0.0,
    @SerialName("gross_earnings") val grossEarnings: Double = 0.0,
    @SerialName("total_deductions") val totalDeductions: Double = 0.0,
    val status: String = "paid",
    @SerialName("payment_date") val paymentDate: String? = null
) {
    val monthYear: String
        get() = payPeriod.ifBlank { "$month/$year" }
    val formattedNetPay: String
        get() = "₹ %,d".format(netPayAmount.toLong())
    val formattedGrossPay: String
        get() = "₹ %,d".format(grossEarnings.toLong())
}

@Serializable
data class CompensationItem(
    @SerialName("annual_ctc") val annualCtc: Double = 0.0,
    @SerialName("monthly_gross") val monthlyGross: Double = 0.0,
    val basic: Double = 0.0,
    val hra: Double = 0.0,
    @SerialName("special_allowance") val specialAllowance: Double = 0.0
)
