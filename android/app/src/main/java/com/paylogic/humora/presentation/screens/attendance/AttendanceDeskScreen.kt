package com.paylogic.humora.presentation.screens.attendance

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.viewmodel.compose.viewModel
import com.paylogic.humora.core.theme.*
import com.paylogic.humora.data.model.MonthlyAttendanceDay
import com.paylogic.humora.presentation.components.GlassCard
import com.paylogic.humora.presentation.viewmodel.AttendanceViewModel

@Composable
fun AttendanceDeskScreen(
    viewModel: AttendanceViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showFacePunchModal by remember { mutableStateOf(false) }

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

        // Offline Queue Banner (if punches are stored in SQLite Room)
        if (uiState.pendingOfflineSyncCount > 0) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(AmberWarning.copy(alpha = 0.15f))
                        .border(1.dp, AmberWarning, RoundedCornerShape(12.dp))
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "${uiState.pendingOfflineSyncCount} Punches Stored Locally",
                            color = AmberWarning,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                        Text(
                            text = "Room DB has offline punches awaiting backend sync.",
                            color = TextSecondaryDark,
                            fontSize = 11.sp
                        )
                    }
                    Button(
                        onClick = { viewModel.triggerOfflineSync() },
                        colors = ButtonDefaults.buttonColors(containerColor = AmberWarning),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Sync Now", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 11.sp)
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
                                text = "GPS Verified",
                                color = EmeraldSuccess,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Text(
                        text = "Current Location: 18m from Corporate HQ (Within 200m perimeter)",
                        color = TextSecondaryDark,
                        fontSize = 13.sp
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "High Accuracy GPS • Lat: 12.9716, Lon: 77.5946 (±3.2m)",
                        color = TextMutedDark,
                        fontSize = 11.sp
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Biometric Selfie / Punch Buttons
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Button(
                            onClick = { showFacePunchModal = true },
                            colors = ButtonDefaults.buttonColors(containerColor = BrandPrimary),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                imageVector = Icons.Default.CameraAlt,
                                contentDescription = "Selfie",
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Face Punch", fontWeight = FontWeight.SemiBold)
                        }

                        OutlinedButton(
                            onClick = { viewModel.triggerOfflineSync() },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Sync,
                                contentDescription = "Sync",
                                tint = TextPrimaryDark,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Sync Queue", color = TextPrimaryDark, fontWeight = FontWeight.SemiBold)
                        }
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
                        Text(
                            text = "September 2026 Calendar",
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

                    val calendarDays = uiState.monthlyCalendar.days

                    // 7 Columns Grid for days
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(7),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(210.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        userScrollEnabled = false
                    ) {
                        items(calendarDays) { day ->
                            val normalizedStatus = day.status.lowercase()
                            val (bgColor, textColor) = when (normalizedStatus) {
                                "present" -> Pair(EmeraldSuccess.copy(alpha = 0.2f), EmeraldSuccess)
                                "half_day", "late" -> Pair(AmberWarning.copy(alpha = 0.2f), AmberWarning)
                                "absent" -> Pair(RoseError.copy(alpha = 0.2f), RoseError)
                                "weekend" -> Pair(DarkSurfaceVariant, TextMutedDark)
                                else -> Pair(Color.Transparent, TextMutedDark)
                            }

                            val dayNumber = day.date.takeLast(2).toIntOrNull() ?: 1

                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(bgColor)
                                    .border(
                                        1.dp,
                                        if (normalizedStatus == "present") EmeraldSuccess.copy(alpha = 0.4f) else DarkBorder,
                                        RoundedCornerShape(8.dp)
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = dayNumber.toString(),
                                    color = textColor,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    textAlign = TextAlign.Center
                                )
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
        com.paylogic.humora.presentation.components.BiometricFacePunchSheet(
            punchType = "in",
            onDismiss = { showFacePunchModal = false },
            onPunchSuccess = { msg ->
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
