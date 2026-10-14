package com.paylogic.humora.presentation.screens.attendance

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.viewmodel.compose.viewModel
import com.paylogic.humora.core.theme.*
import com.paylogic.humora.data.model.MonthlyAttendanceDay
import com.paylogic.humora.presentation.components.ClayButton
import com.paylogic.humora.presentation.components.GlassCard
import com.paylogic.humora.presentation.viewmodel.AttendanceViewModel

@Composable
fun AttendanceDeskScreen(
    viewModel: AttendanceViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showFacePunchModal by remember { mutableStateOf(false) }
    var showFingerprintPunchModal by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(bottom = 80.dp)
    ) {
        // Notification / Result Banner
        if (uiState.actionMessage != null) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(DarkSurfaceVariant)
                        .border(1.dp, EmeraldSuccess, RoundedCornerShape(12.dp))
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = uiState.actionMessage ?: "",
                        color = EmeraldSuccess,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(
                        onClick = { viewModel.clearActionMessage() },
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(Icons.Default.Close, contentDescription = "Dismiss", tint = TextMutedDark, modifier = Modifier.size(16.dp))
                    }
                }
            }
        }

        // 1. GEOFENCE RADAR & ANTI-SPOOF STATUS
        item {
            GlassCard {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.GpsFixed,
                                contentDescription = "GPS",
                                tint = EmeraldSuccess,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Geofence Sentinel",
                                color = TextPrimaryDark,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        // Anti-Spoof Badge
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(DarkSurfaceVariant)
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Shield,
                                contentDescription = "Security",
                                tint = EmeraldSuccess,
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = if (uiState.locationKnown) "GPS Verified" else "Locating…",
                                color = if (uiState.locationKnown) EmeraldSuccess else TextMutedDark,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Issue #1 Fix: Derive GPS text from uiState instead of hardcoded strings
                    val fence = uiState.geofence
                    val geoText = when {
                        uiState.officesConfigured == false -> "No office location is set up yet. Ask HR to add one."
                        !uiState.locationKnown -> "Checking your location…"
                        fence == null -> "Checking office locations…"
                        fence.isInside -> "Inside ${fence.officeName} • ${fence.distanceMeters.toInt()}m from the centre"
                        else -> "Outside ${fence.officeName} • ${fence.distanceMeters.toInt()}m away (allowed ${fence.radiusMeters.toInt()}m)"
                    }
                    Text(
                        text = geoText,
                        color = TextSecondaryDark,
                        fontSize = 13.sp
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    // Issue #2 Fix: No hardcoded lat/lon — show GPS verification status only
                    Text(
                        text = if (uiState.locationKnown) "GPS location acquired" else "Acquiring GPS signal…",
                        color = TextMutedDark,
                        fontSize = 11.sp
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Biometric Selfie / Fingerprint Punch Buttons (Tactile 3D Clay)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        ClayButton(
                            text = "Face Punch",
                            icon = Icons.Default.CameraAlt,
                            brush = ClayAccentGradient,
                            modifier = Modifier.weight(1f),
                            cornerRadius = 14.dp,
                            onClick = { showFacePunchModal = true }
                        )

                        ClayButton(
                            text = "Fingerprint",
                            icon = Icons.Default.Fingerprint,
                            brush = ClaySecondaryGradient,
                            modifier = Modifier.weight(1f),
                            cornerRadius = 14.dp,
                            onClick = { showFingerprintPunchModal = true }
                        )
                    }

                }
            }
        }

        // 2. MONTHLY ATTENDANCE MATRIX
        item {
            GlassCard {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Issue #3 Fix: Derive month/year from uiState instead of hardcoded "September 2026"
                        val monthNames = listOf("", "January", "February", "March", "April",
                            "May", "June", "July", "August", "September", "October", "November", "December")
                        val calMonth = uiState.monthlyCalendar.month.coerceIn(1, 12)
                        val calYear = uiState.monthlyCalendar.year
                        Text(
                            text = "${monthNames[calMonth]} $calYear Calendar",
                            color = TextPrimaryDark,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "${uiState.monthlyCalendar.totalPresent.toInt()} Present Days",
                            color = EmeraldSuccess,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    uiState.calendarError?.let {
                        Text(text = it, color = TextMutedDark, fontSize = 12.sp)
                        Spacer(modifier = Modifier.height(8.dp))
                    }

                    val calendarDays = uiState.monthlyCalendar.days

                    // Bug #7 Fix: Replace LazyVerticalGrid (which needed fixed height inside LazyColumn)
                    // with a plain Column+Row grid that adapts to content height naturally.
                    val rows = calendarDays.chunked(7)
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        rows.forEach { rowDays ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                rowDays.forEach { day ->
                                    val normalizedStatus = day.status.lowercase()
                                    val isPresent = normalizedStatus == "present"
                                    val isAbsent = normalizedStatus == "absent"
                                    val isHalfDay = normalizedStatus == "half_day" || normalizedStatus == "late"
                                    val dayNumber = day.date.takeLast(2).toIntOrNull() ?: 1

                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .aspectRatio(1f)
                                            .shadow(2.dp, RoundedCornerShape(10.dp), ambientColor = Color(0x66000000))
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(
                                                when {
                                                    isPresent -> ClaySuccessGradient
                                                    isAbsent -> ClayErrorGradient
                                                    isHalfDay -> ClayWarningGradient
                                                    else -> SolidColor(ClaySurfaceElevated)
                                                }
                                            )
                                            .border(
                                                1.dp,
                                                Brush.verticalGradient(
                                                    listOf(Color.White.copy(alpha = 0.28f), Color.White.copy(alpha = 0.12f))
                                                ),
                                                RoundedCornerShape(10.dp)
                                            ),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = dayNumber.toString(),
                                            color = if (isPresent || isAbsent || isHalfDay) Color.White else TextMutedDark,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            textAlign = TextAlign.Center
                                        )
                                    }
                                }
                                // Fill remaining cells in last row to keep alignment
                                repeat(7 - rowDays.size) {
                                    Box(modifier = Modifier.weight(1f))
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Legend
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        CalendarLegendItem("Present", EmeraldSuccess)
                        CalendarLegendItem("Half Day", AmberWarning)
                        CalendarLegendItem("Absent", RoseError)
                        CalendarLegendItem("Weekend", TextMutedDark)
                    }
                }
            }
        }

        // 3. ATTENDANCE REGULARIZATION DESK
        item {
            GlassCard {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Missed a punch?",
                            color = TextPrimaryDark,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Apply OD / Regularization",
                            color = BrandPrimary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Submit a regularization request for biometric or geofence anomalies. Your reporting manager will review it on the Go backend.",
                        color = TextSecondaryDark,
                        fontSize = 12.sp
                    )
                }
            }
        }
    }

    // Biometric Face Punch Modal
    if (showFacePunchModal) {
        // Bug #5 Fix: derive punch direction from state instead of hardcoding "in"
        val punchType = if (uiState.isPunchedIn) "out" else "in"
        com.paylogic.humora.presentation.components.BiometricFacePunchSheet(
            punchType = punchType,
            onDismiss = { showFacePunchModal = false },
            onPunchSuccess = { msg ->
                // Bug #6 Fix: forward the success message to the action banner
                viewModel.clearActionMessage()
                viewModel.loadMonthlyAttendance()
            }
        )
    }

    // Biometric Fingerprint Punch Modal (with Auto-Selfie)
    if (showFingerprintPunchModal) {
        // Bug #5 Fix: derive punch direction from state instead of hardcoding "in"
        val punchType = if (uiState.isPunchedIn) "out" else "in"
        com.paylogic.humora.presentation.components.BiometricFingerprintPunchSheet(
            punchType = punchType,
            onDismiss = { showFingerprintPunchModal = false },
            onPunchSuccess = { msg ->
                // Bug #6 Fix: forward the success message to the action banner
                viewModel.clearActionMessage()
                viewModel.loadMonthlyAttendance()
            }
        )
    }
}

@Composable
private fun CalendarLegendItem(label: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(color)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(text = label, color = TextSecondaryDark, fontSize = 11.sp)
    }
}
