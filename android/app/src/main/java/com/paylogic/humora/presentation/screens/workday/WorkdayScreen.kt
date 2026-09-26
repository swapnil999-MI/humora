package com.paylogic.humora.presentation.screens.workday

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.paylogic.humora.core.theme.*
import com.paylogic.humora.data.model.SprintTaskItem
import com.paylogic.humora.data.model.TeamMemberPresence
import com.paylogic.humora.presentation.components.GlassCard
import com.paylogic.humora.presentation.components.SwipeToPunchSlider
import com.paylogic.humora.presentation.viewmodel.WorkdayViewModel

@Composable
fun WorkdayScreen(
    viewModel: WorkdayViewModel = viewModel(),
    onNavigateToAttendance: () -> Unit = {},
    onNavigateToLeaves: () -> Unit = {},
    onNavigateToTasks: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    var showBiometricFaceSheet by remember { mutableStateOf(false) }
    var targetPunchType by remember { mutableStateOf("in") }

    val hours = uiState.sessionTimerSeconds / 3600
    val minutes = (uiState.sessionTimerSeconds % 3600) / 60
    val seconds = uiState.sessionTimerSeconds % 60
    val formattedTime = String.format("%02d:%02d:%02d", hours, minutes, seconds)

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(bottom = 80.dp)
    ) {
        // Notification / Result Banner
        if (uiState.bannerMessage != null) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(DarkSurfaceVariant)
                        .border(1.dp, BrandPrimary, RoundedCornerShape(12.dp))
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = uiState.bannerMessage ?: "",
                        color = TextPrimaryDark,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(
                        onClick = { viewModel.clearBanner() },
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(Icons.Default.Close, contentDescription = "Dismiss", tint = TextMutedDark, modifier = Modifier.size(16.dp))
                    }
                }
            }
        }

        // 1. HERO PUNCH WIDGET
        item {
            GlassCard {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "PUNCH STATUS",
                                color = TextMutedDark,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )
                            Text(
                                text = uiState.punchStatusText,
                                color = if (uiState.isPunchedIn) EmeraldSuccess else AmberWarning,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        // Shift Badge
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(DarkSurfaceVariant)
                                .padding(horizontal = 10.dp, vertical = 5.dp)
                        ) {
                            Text(
                                text = uiState.shiftName,
                                color = TextSecondaryDark,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // Big Digital Timer
                    Text(
                        text = if (uiState.isPunchedIn) formattedTime else "00:00:00",
                        color = TextPrimaryDark,
                        fontSize = 42.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 2.sp
                    )
                    Text(
                        text = if (uiState.isPunchedIn) "Logged Today • Connected to Cloud HRMS" else "Swipe below to record punch with backend",
                        color = TextMutedDark,
                        fontSize = 12.sp
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    // Swipe Slider (Triggers Biometric Face Verification)
                    SwipeToPunchSlider(
                        isPunchedIn = uiState.isPunchedIn,
                        onSwipeComplete = {
                            targetPunchType = if (uiState.isPunchedIn) "out" else "in"
                            showBiometricFaceSheet = true
                        }
                    )
                }
            }
        }

        // 2. QUICK ACTION PILLS
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                QuickActionChip(
                    title = "Apply Leave",
                    icon = Icons.Default.DateRange,
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToLeaves
                )
                QuickActionChip(
                    title = "Log Time",
                    icon = Icons.Default.Schedule,
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToTasks
                )
                QuickActionChip(
                    title = "Punch Desk",
                    icon = Icons.AutoMirrored.Filled.ReceiptLong,
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToAttendance
                )
            }
        }

        // 3. TEAM PRESENCE RADAR
        item {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Team Presence Radar",
                        color = TextPrimaryDark,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "${uiState.teamMembers.count { it.status == "working" || it.status == "IN_OFFICE" }} Active",
                        color = EmeraldSuccess,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(uiState.teamMembers) { member ->
                        TeamMemberRadarCard(member)
                    }
                }
            }
        }

        // 4. TODAY'S SPRINT TASKS
        item {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Active Sprint Tasks",
                        color = TextPrimaryDark,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "View All",
                        color = BrandPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    uiState.quickTasks.forEach { task ->
                        SprintTaskMiniCard(task)
                    }
                }
            }
        }
    }

    if (showBiometricFaceSheet) {
        com.paylogic.humora.presentation.components.BiometricFacePunchSheet(
            punchType = targetPunchType,
            onDismiss = { showBiometricFaceSheet = false },
            onPunchSuccess = { successMsg ->
                viewModel.refreshData()
            }
        )
    }
}

@Composable
private fun QuickActionChip(
    title: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(DarkSurface)
            .border(1.dp, DarkBorder, RoundedCornerShape(12.dp))
            .padding(vertical = 12.dp, horizontal = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = title,
                tint = BrandPrimary,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = title,
                color = TextPrimaryDark,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun TeamMemberRadarCard(member: TeamMemberPresence) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(68.dp)
    ) {
        Box {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(Color(member.avatarColor)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = member.firstName.take(1),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            }
            // Status dot
            Box(
                modifier = Modifier
                    .size(12.dp)
                    .clip(CircleShape)
                    .background(
                        when (member.status.lowercase()) {
                            "working", "in_office" -> EmeraldSuccess
                            "on_break", "remote" -> Color(0xFF3B82F6)
                            "on_leave" -> AmberWarning
                            else -> TextMutedDark
                        }
                    )
                    .border(2.dp, DarkSurface, CircleShape)
                    .align(Alignment.BottomEnd)
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = member.firstName,
            color = TextPrimaryDark,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1
        )
    }
}

@Composable
private fun SprintTaskMiniCard(task: SprintTaskItem) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(DarkSurface)
            .border(1.dp, DarkBorder, RoundedCornerShape(12.dp))
            .padding(14.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "${task.issueKey} • ${task.priority.uppercase()}",
                    color = BrandPrimary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = task.title,
                    color = TextPrimaryDark,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
            }
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(DarkSurfaceVariant)
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text(
                    text = task.status.replace("_", " ").uppercase(),
                    color = if (task.status.equals("in_progress", ignoreCase = true)) EmeraldSuccess else TextMutedDark,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
