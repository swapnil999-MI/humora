package com.paylogic.humora.presentation.screens.admin

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch
import com.paylogic.humora.core.theme.*
import com.paylogic.humora.data.model.MemberBurnoutRisk
import com.paylogic.humora.data.model.TeamMemberCapacity
import com.paylogic.humora.presentation.components.ClayCard
import com.paylogic.humora.presentation.components.clayEffect
import com.paylogic.humora.presentation.viewmodel.AdminDeskTab
import com.paylogic.humora.presentation.viewmodel.AdminUiState
import com.paylogic.humora.presentation.viewmodel.AdminViewModel
import com.paylogic.humora.presentation.viewmodel.EmployeeBiometricState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminCapacityScreen(
    adminViewModel: AdminViewModel = viewModel()
) {
    val uiState by adminViewModel.uiState.collectAsState()
    val teamCapacity = uiState.teamCapacity
    val burnout = uiState.burnoutSentinel

    var searchLocal by remember { mutableStateOf("") }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            contentPadding = PaddingValues(top = 16.dp, bottom = 100.dp)
        ) {
            // ==========================================
            // 1. COMMAND DESK HEADER & REFRESH ACTION
            // ==========================================
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(BrandPrimary.copy(alpha = 0.20f))
                                    .padding(horizontal = 7.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = "SYNERGY COMMAND",
                                    color = BrandPrimary,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp
                                )
                            }
                            Text(
                                text = "Cross-Domain Ops",
                                color = TextMutedDark,
                                fontSize = 11.sp
                            )
                        }

                        Spacer(modifier = Modifier.height(3.dp))

                        Text(
                            text = "Workforce Capacity Desk",
                            fontSize = 21.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimaryDark
                        )

                        Text(
                            text = "Live orchestration of team bandwidth, presence & burnout prevention",
                            fontSize = 11.sp,
                            color = TextSecondaryDark,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    // Tactile Refresh Button with rotation animation
                    val rotation by animateFloatAsState(
                        targetValue = if (uiState.isLoading) 360f else 0f,
                        animationSpec = tween(600),
                        label = "spin"
                    )

                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clayEffect(
                                shape = CircleShape,
                                elevation = 6.dp,
                                borderWidth = 1.dp,
                                borderBrush = ClayBorderGradient,
                                backgroundBrush = ClaySurfaceGradient
                            )
                            .clickable { adminViewModel.refreshAll() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Refresh",
                            tint = if (uiState.isLoading) BrandPrimary else TextPrimaryDark,
                            modifier = Modifier
                                .size(20.dp)
                                .rotate(rotation)
                        )
                    }
                }
            }

            // ==========================================
            // 2. ERROR & SUCCESS NOTICES
            // ==========================================
            item {
                AnimatedVisibility(visible = uiState.errorMessage != null) {
                    uiState.errorMessage?.let { error ->
                        NoticeBanner(
                            message = error,
                            color = RoseError,
                            icon = Icons.Default.Warning,
                            onDismiss = { adminViewModel.clearMessages() }
                        )
                    }
                }
            }

            item {
                AnimatedVisibility(visible = uiState.successMessage != null) {
                    uiState.successMessage?.let { msg ->
                        NoticeBanner(
                            message = msg,
                            color = EmeraldSuccess,
                            icon = Icons.Default.CheckCircle,
                            onDismiss = { adminViewModel.clearMessages() }
                        )
                    }
                }
            }

            // ==========================================
            // 3. TACTILE 3D CLAY SUB-TAB SELECTOR
            // ==========================================
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clayEffect(
                            shape = RoundedCornerShape(20.dp),
                            elevation = 8.dp,
                            borderWidth = 1.dp,
                            borderBrush = ClayBorderGradient,
                            backgroundBrush = ClaySurfaceGradient
                        )
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    val tabs = listOf(
                        Triple(AdminDeskTab.CAPACITY_WORKLOAD, "Workload", teamCapacity?.totalEngineers ?: 0),
                        Triple(AdminDeskTab.BURNOUT_SENTINEL, "Sentinel", burnout?.teamBurnoutIndex ?: 0),
                        Triple(AdminDeskTab.BIOMETRIC_KIOSK, "Kiosk Hub", uiState.employees.size),
                        Triple(AdminDeskTab.GEOFENCE_SETTINGS, "Geofence", uiState.officeLocations.size)
                    )

                    tabs.forEach { (tab, label, count) ->
                        val isSelected = uiState.selectedDeskTab == tab
                        val bgBrush = if (isSelected) {
                            Brush.verticalGradient(listOf(BrandGradientStart, BrandGradientEnd))
                        } else {
                            Brush.verticalGradient(listOf(Color.Transparent, Color.Transparent))
                        }

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(16.dp))
                                .background(bgBrush)
                                .clickable { adminViewModel.selectDeskTab(tab) }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(5.dp)
                            ) {
                                Text(
                                    text = label,
                                    color = if (isSelected) Color.White else TextSecondaryDark,
                                    fontSize = 12.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                                )
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(
                                            if (isSelected) Color.White.copy(alpha = 0.25f)
                                            else ClaySurfacePressed
                                        )
                                        .padding(horizontal = 5.dp, vertical = 1.dp)
                                ) {
                                    Text(
                                        text = "$count",
                                        color = if (isSelected) Color.White else TextMutedDark,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // ==========================================
            // 4. TAB CONTENT RENDERERS
            // ==========================================
            when (uiState.selectedDeskTab) {
                AdminDeskTab.CAPACITY_WORKLOAD -> {
                    // 4 KPI Summary Cards
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                CapacityKpiTile(
                                    modifier = Modifier.weight(1f),
                                    title = "Total Squad",
                                    value = "${teamCapacity?.totalEngineers ?: 0}",
                                    subtitle = "Engineers",
                                    icon = Icons.Default.People,
                                    accentColor = BrandPrimary
                                )
                                CapacityKpiTile(
                                    modifier = Modifier.weight(1f),
                                    title = "Clocked In",
                                    value = "${teamCapacity?.clockedInCount ?: 0}",
                                    subtitle = "Active Now",
                                    icon = Icons.Default.CheckCircle,
                                    accentColor = EmeraldSuccess
                                )
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                CapacityKpiTile(
                                    modifier = Modifier.weight(1f),
                                    title = "On Leave",
                                    value = "${teamCapacity?.onLeaveCount ?: 0}",
                                    subtitle = "Out of Office",
                                    icon = Icons.Default.FlightTakeoff,
                                    accentColor = AmberWarning
                                )
                                CapacityKpiTile(
                                    modifier = Modifier.weight(1f),
                                    title = "Overloaded",
                                    value = "${teamCapacity?.overallocatedCount ?: 0}",
                                    subtitle = ">15 pts allocated",
                                    icon = Icons.Default.Warning,
                                    accentColor = RoseError
                                )
                            }
                        }
                    }

                    // Filter Pills & Search
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            // Search Box
                            OutlinedTextField(
                                value = searchLocal,
                                onValueChange = { searchLocal = it },
                                placeholder = { Text("Filter engineers by name, dept, or code...", color = TextMutedDark, fontSize = 12.sp) },
                                leadingIcon = {
                                    Icon(
                                        imageVector = Icons.Default.Search,
                                        contentDescription = "Search",
                                        tint = TextMutedDark,
                                        modifier = Modifier.size(18.dp)
                                    )
                                },
                                trailingIcon = {
                                    if (searchLocal.isNotEmpty()) {
                                        IconButton(onClick = { searchLocal = "" }) {
                                            Icon(
                                                imageVector = Icons.Default.Close,
                                                contentDescription = "Clear",
                                                tint = TextMutedDark,
                                                modifier = Modifier.size(16.dp)
                                            )
                                        }
                                    }
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clayEffect(
                                        shape = RoundedCornerShape(16.dp),
                                        elevation = 4.dp,
                                        borderWidth = 1.dp,
                                        borderBrush = ClayBorderGradient,
                                        backgroundBrush = ClaySurfaceGradient
                                    ),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedTextColor = TextPrimaryDark,
                                    unfocusedTextColor = TextPrimaryDark,
                                    focusedBorderColor = Color.Transparent,
                                    unfocusedBorderColor = Color.Transparent,
                                    focusedContainerColor = Color.Transparent,
                                    unfocusedContainerColor = Color.Transparent
                                ),
                                shape = RoundedCornerShape(16.dp),
                                singleLine = true
                            )

                            // Horizontal Presence Filter Chips
                            LazyRow(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                contentPadding = PaddingValues(horizontal = 2.dp)
                            ) {
                                val filters = listOf(
                                    "all" to "All Members",
                                    "in_office" to "In Office",
                                    "on_leave" to "On Leave",
                                    "overloaded" to "Overloaded (>15pts)"
                                )
                                items(filters) { (key, label) ->
                                    val isSelected = uiState.presenceFilter == key
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(14.dp))
                                            .background(
                                                if (isSelected) BrandPrimary.copy(alpha = 0.25f)
                                                else ClaySurfacePressed
                                            )
                                            .border(
                                                1.dp,
                                                if (isSelected) BrandPrimary else DarkBorder,
                                                RoundedCornerShape(14.dp)
                                            )
                                            .clickable { adminViewModel.setPresenceFilter(key) }
                                            .padding(horizontal = 12.dp, vertical = 6.dp)
                                    ) {
                                        Text(
                                            text = label,
                                            fontSize = 11.sp,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                            color = if (isSelected) BrandPrimary else TextSecondaryDark
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Engineer Capacity Cards
                    val members = teamCapacity?.members ?: emptyList()
                    val filteredMembers = members.filter { m ->
                        val matchesSearch = searchLocal.isBlank() ||
                                m.employeeName.contains(searchLocal, ignoreCase = true) ||
                                m.departmentName.contains(searchLocal, ignoreCase = true) ||
                                m.employeeCode.contains(searchLocal, ignoreCase = true) ||
                                m.designationTitle.contains(searchLocal, ignoreCase = true)

                        val matchesFilter = when (uiState.presenceFilter) {
                            "in_office" -> m.punchedIn || m.presenceStatus == "in_office"
                            "on_leave" -> m.presenceStatus == "on_leave"
                            "overloaded" -> m.capacityStatus == "overloaded"
                            else -> true
                        }

                        matchesSearch && matchesFilter
                    }

                    if (filteredMembers.isEmpty()) {
                        item {
                            ClayCard(
                                cornerRadius = 20.dp,
                                elevation = 6.dp,
                                contentPadding = PaddingValues(24.dp)
                            ) {
                                Column(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Groups,
                                        contentDescription = null,
                                        tint = TextMutedDark,
                                        modifier = Modifier.size(36.dp)
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = "No team members matched",
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimaryDark
                                    )
                                    Text(
                                        text = "Try adjusting your search query or filter selection",
                                        fontSize = 12.sp,
                                        color = TextMutedDark
                                    )
                                }
                            }
                        }
                    } else {
                        items(filteredMembers) { member ->
                            EngineerCapacityCard(member = member)
                        }
                    }
                }

                AdminDeskTab.BURNOUT_SENTINEL -> {
                    // Burnout Sentinel Dashboard Slate
                    item {
                        BurnoutOverviewTile(burnout = burnout)
                    }

                    // System Recommendations Banner
                    val recs = burnout?.systemRecommendations ?: emptyList()
                    if (recs.isNotEmpty()) {
                        item {
                            ClayCard(
                                cornerRadius = 20.dp,
                                elevation = 8.dp,
                                contentPadding = PaddingValues(16.dp)
                            ) {
                                Column(modifier = Modifier.fillMaxWidth()) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Psychology,
                                            contentDescription = null,
                                            tint = BrandPrimary,
                                            modifier = Modifier.size(20.dp)
                                        )
                                        Text(
                                            text = "Early Warning System Recommendations",
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = TextPrimaryDark
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(10.dp))
                                    recs.forEach { rec ->
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(vertical = 4.dp),
                                            verticalAlignment = Alignment.Top,
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            Text(text = "•", color = BrandPrimary, fontWeight = FontWeight.Bold)
                                            Text(
                                                text = rec,
                                                fontSize = 12.sp,
                                                color = TextSecondaryDark,
                                                lineHeight = 16.sp
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Member Burnout Risk Cards
                    val burnoutMembers = burnout?.members ?: emptyList()
                    item {
                        Text(
                            text = "Engineer Well-Being Breakdown",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimaryDark,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }

                    items(burnoutMembers) { memberRisk ->
                        BurnoutRiskCard(member = memberRisk)
                    }
                }

                AdminDeskTab.BIOMETRIC_KIOSK -> {
                    // Biometric Hub Sub-View (Face & Fingerprint Manager)
                    item {
                        ClayCard(
                            cornerRadius = 20.dp,
                            elevation = 8.dp,
                            contentPadding = PaddingValues(16.dp)
                        ) {
                            Column(modifier = Modifier.fillMaxWidth()) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Fingerprint,
                                            contentDescription = null,
                                            tint = EmeraldSuccess,
                                            modifier = Modifier.size(20.dp)
                                        )
                                        Column {
                                            Text(
                                                text = "Kiosk Biometric Credentials",
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = TextPrimaryDark
                                            )
                                            Text(
                                                text = "Enroll Face & Fingerprint for kiosk attendance",
                                                fontSize = 11.sp,
                                                color = TextMutedDark
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Employee list for Biometrics
                    items(uiState.employees) { empState ->
                        EmployeeBiometricRow(
                            empState = empState,
                            onEnrollFace = { adminViewModel.openFaceEnrollment(empState.employee) },
                            onEnrollFingerprint = { adminViewModel.openFingerprintEnrollment(empState.employee) }
                        )
                    }
                }

                AdminDeskTab.GEOFENCE_SETTINGS -> {
                    item {
                        AdminGeofenceSection(
                            adminViewModel = adminViewModel,
                            uiState = uiState
                        )
                    }
                }
            }
        }

        // ==========================================
        // 5. SHEETS & MODALS (Face & Fingerprint)
        // ==========================================
        uiState.activeFaceEnrollEmployee?.let { emp ->
            AdminFaceEnrollmentSheet(
                employee = emp,
                adminViewModel = adminViewModel,
                onDismiss = { adminViewModel.closeFaceEnrollment() }
            )
        }

        uiState.activeFingerprintEnrollEmployee?.let { emp ->
            AdminFingerprintEnrollmentSheet(
                employee = emp,
                adminViewModel = adminViewModel,
                onDismiss = { adminViewModel.closeFingerprintEnrollment() }
            )
        }
    }
}

// =========================================================================
// SUB-COMPONENTS
// =========================================================================

@Composable
private fun CapacityKpiTile(
    title: String,
    value: String,
    subtitle: String,
    icon: ImageVector,
    accentColor: Color,
    modifier: Modifier = Modifier
) {
    ClayCard(
        modifier = modifier,
        cornerRadius = 18.dp,
        elevation = 6.dp,
        contentPadding = PaddingValues(14.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = title,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextMutedDark
                )
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(accentColor.copy(alpha = 0.18f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = accentColor,
                        modifier = Modifier.size(15.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = value,
                fontSize = 20.sp,
                fontWeight = FontWeight.Black,
                color = TextPrimaryDark
            )
            Text(
                text = subtitle,
                fontSize = 10.sp,
                color = TextSecondaryDark
            )
        }
    }
}

@Composable
private fun EngineerCapacityCard(member: TeamMemberCapacity) {
    val isOverloaded = member.capacityStatus == "overloaded"
    val isBalanced = member.capacityStatus == "balanced"

    val statusColor = when {
        isOverloaded -> RoseError
        isBalanced -> BrandPrimary
        else -> EmeraldSuccess
    }

    val statusLabel = when {
        isOverloaded -> "Overloaded (>15pts)"
        isBalanced -> "Balanced (8-15pts)"
        else -> "Available (<8pts)"
    }

    ClayCard(
        cornerRadius = 20.dp,
        elevation = 7.dp,
        contentPadding = PaddingValues(16.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Top Row: Avatar + Name + Capacity Status Pill
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    // Tactile Avatar Box with active presence status dot
                    Box(
                        modifier = Modifier.size(42.dp),
                        contentAlignment = Alignment.BottomEnd
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .clip(RoundedCornerShape(13.dp))
                                .background(
                                    Brush.linearGradient(
                                        listOf(BrandPrimary.copy(alpha = 0.4f), DarkSurfaceVariant)
                                    )
                                )
                                .border(1.dp, Color.White.copy(alpha = 0.15f), RoundedCornerShape(13.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            val initials = member.employeeName
                                .split(" ")
                                .mapNotNull { it.firstOrNull()?.toString() }
                                .take(2)
                                .joinToString("")
                                .ifBlank { "EM" }

                            Text(
                                text = initials,
                                color = TextPrimaryDark,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        // Live Presence indicator dot
                        val presenceColor = when (member.presenceStatus) {
                            "in_office" -> EmeraldSuccess
                            "on_leave" -> AmberWarning
                            "remote" -> BrandPrimary
                            else -> if (member.punchedIn) EmeraldSuccess else Color.Gray
                        }

                        Box(
                            modifier = Modifier
                                .size(11.dp)
                                .clip(CircleShape)
                                .background(presenceColor)
                                .border(1.5.dp, DarkBackground, CircleShape)
                        )
                    }

                    Column {
                        Text(
                            text = member.employeeName,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimaryDark,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = member.designationTitle.ifBlank { "Engineer" },
                                fontSize = 11.sp,
                                color = TextSecondaryDark
                            )
                            Text(text = "•", fontSize = 10.sp, color = TextMutedDark)
                            Text(
                                text = member.employeeCode,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = BrandPrimary
                            )
                        }
                    }
                }

                // Capacity Status Pill
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(statusColor.copy(alpha = 0.16f))
                        .border(1.dp, statusColor.copy(alpha = 0.45f), RoundedCornerShape(10.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = statusLabel,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = statusColor
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Middle Stats Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(ClaySurfacePressed)
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(text = "ASSIGNED SPRINT", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = TextMutedDark)
                    Text(
                        text = "${member.totalStoryPoints} pts (${member.assignedIssueCount} issues)",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimaryDark
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(text = "CURRENT FOCUS", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = TextMutedDark)
                    Text(
                        text = member.currentFocusIssue ?: "Idle / Available",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        color = if (member.currentFocusIssue != null) BrandPrimary else TextMutedDark
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Capacity Allocation Progress Bar
            // Measured against the server's overload line (more than 15 points = overloaded).
            val progressFraction = (member.totalStoryPoints / 15.0f).coerceIn(0f, 1f)
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(text = "Sprint Bandwidth", fontSize = 10.sp, color = TextMutedDark)
                    Text(
                        text = "${member.totalStoryPoints} pts · ${member.assignedIssueCount} issues",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = statusColor
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(ClaySurfacePressed)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(progressFraction)
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(3.dp))
                            .background(
                                Brush.horizontalGradient(
                                    listOf(statusColor.copy(alpha = 0.7f), statusColor)
                                )
                            )
                    )
                }
            }

            // Upcoming Leave Banner (if any)
            if (!member.upcomingLeaveDates.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(10.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(AmberWarning.copy(alpha = 0.12f))
                        .padding(horizontal = 10.dp, vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.EventBusy,
                        contentDescription = null,
                        tint = AmberWarning,
                        modifier = Modifier.size(13.dp)
                    )
                    Text(
                        text = "Upcoming Leave: ${member.upcomingLeaveDates}",
                        fontSize = 10.sp,
                        color = AmberWarning,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}

@Composable
private fun BurnoutOverviewTile(burnout: com.paylogic.humora.data.model.BurnoutSentinelReport?) {
    val score = burnout?.teamBurnoutIndex ?: 0
    val tier = burnout?.overallTier ?: "optimal"

    val (tierColor, tierLabel) = when (tier.lowercase()) {
        "high", "high_risk" -> RoseError to "High Risk"
        "moderate" -> AmberWarning to "Moderate Warning"
        else -> EmeraldSuccess to "Optimal Velocity"
    }

    ClayCard(
        cornerRadius = 22.dp,
        elevation = 8.dp,
        contentPadding = PaddingValues(18.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "TEAM BURNOUT INDEX",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                        color = TextMutedDark
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(
                        verticalAlignment = Alignment.Bottom,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = "$score",
                            fontSize = 32.sp,
                            fontWeight = FontWeight.Black,
                            color = tierColor
                        )
                        Text(
                            text = "/100",
                            fontSize = 14.sp,
                            color = TextMutedDark,
                            modifier = Modifier.padding(bottom = 5.dp)
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(tierColor.copy(alpha = 0.18f))
                        .border(1.dp, tierColor.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = tierLabel,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = tierColor
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Distribution Breakdown Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                BurnoutTierCountBox(
                    label = "Optimal",
                    count = burnout?.optimalCount ?: 0,
                    color = EmeraldSuccess,
                    modifier = Modifier.weight(1f)
                )
                BurnoutTierCountBox(
                    label = "Moderate",
                    count = burnout?.moderateCount ?: 0,
                    color = AmberWarning,
                    modifier = Modifier.weight(1f)
                )
                BurnoutTierCountBox(
                    label = "High Risk",
                    count = burnout?.highRiskCount ?: 0,
                    color = RoseError,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun BurnoutTierCountBox(
    label: String,
    count: Int,
    color: Color,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(ClaySurfacePressed)
            .border(1.dp, color.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
            .padding(vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text = "$count", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = color)
            Text(text = label, fontSize = 10.sp, color = TextMutedDark)
        }
    }
}

@Composable
private fun BurnoutRiskCard(member: MemberBurnoutRisk) {
    val tierColor = when (member.riskTier.lowercase()) {
        "high", "high_risk" -> RoseError
        "moderate" -> AmberWarning
        else -> EmeraldSuccess
    }

    ClayCard(
        cornerRadius = 20.dp,
        elevation = 6.dp,
        contentPadding = PaddingValues(16.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = member.employeeName,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimaryDark
                    )
                    Text(
                        text = "${member.designationTitle} • ${member.departmentName}",
                        fontSize = 11.sp,
                        color = TextSecondaryDark
                    )
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(tierColor.copy(alpha = 0.16f))
                        .border(1.dp, tierColor.copy(alpha = 0.45f), RoundedCornerShape(10.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "Risk: ${member.riskScore}/100",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = tierColor
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // 4 Mini Breakdown Metrics
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                MiniRiskPill(modifier = Modifier.weight(1f), label = "Late Checkouts", value = "${member.lateCheckoutDays}d")
                MiniRiskPill(modifier = Modifier.weight(1f), label = "Weekend Log", value = "${member.weekendHoursLogged.toInt()}h")
                MiniRiskPill(modifier = Modifier.weight(1f), label = "Sprint Pts", value = "${member.activeSprintPoints}")
                MiniRiskPill(modifier = Modifier.weight(1f), label = "Days Since Off", value = "${member.daysSinceLastLeave}d")
            }

            if (member.primaryRiskTrigger.isNotBlank()) {
                Spacer(modifier = Modifier.height(10.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(ClaySurfacePressed)
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = null,
                        tint = BrandPrimary,
                        modifier = Modifier.size(13.dp)
                    )
                    Text(
                        text = member.primaryRiskTrigger,
                        fontSize = 11.sp,
                        color = TextSecondaryDark
                    )
                }
            }
        }
    }
}

@Composable
private fun MiniRiskPill(label: String, value: String, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(ClaySurfacePressed)
            .padding(vertical = 5.dp, horizontal = 4.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text = value, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextPrimaryDark)
            Text(text = label, fontSize = 8.sp, color = TextMutedDark, maxLines = 1)
        }
    }
}

@Composable
private fun EmployeeBiometricRow(
    empState: EmployeeBiometricState,
    onEnrollFace: () -> Unit,
    onEnrollFingerprint: () -> Unit
) {
    val emp = empState.employee
    ClayCard(
        cornerRadius = 18.dp,
        elevation = 5.dp,
        contentPadding = PaddingValues(14.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "${emp.firstName} ${emp.lastName}",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimaryDark
                )
                Text(
                    text = "${emp.designationTitle} • ${emp.employeeCode}",
                    fontSize = 11.sp,
                    color = TextSecondaryDark
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                // Face Enrollment Icon Button
                IconButton(
                    onClick = onEnrollFace,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(
                            if (empState.isFaceRegistered) EmeraldSuccess.copy(alpha = 0.2f)
                            else AmberWarning.copy(alpha = 0.2f)
                        )
                ) {
                    Icon(
                        imageVector = if (empState.isFaceRegistered) Icons.Default.Face else Icons.Default.AddAPhoto,
                        contentDescription = "Face",
                        tint = if (empState.isFaceRegistered) EmeraldSuccess else AmberWarning,
                        modifier = Modifier.size(18.dp)
                    )
                }

                // Fingerprint Enrollment Icon Button
                IconButton(
                    onClick = onEnrollFingerprint,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(
                            if (empState.isFingerprintRegistered) EmeraldSuccess.copy(alpha = 0.2f)
                            else BrandPrimary.copy(alpha = 0.2f)
                        )
                ) {
                    Icon(
                        imageVector = Icons.Default.Fingerprint,
                        contentDescription = "Fingerprint",
                        tint = if (empState.isFingerprintRegistered) EmeraldSuccess else BrandPrimary,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun NoticeBanner(
    message: String,
    color: Color,
    icon: ImageVector,
    onDismiss: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(DarkSurfaceVariant)
            .border(1.dp, color.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = color,
                modifier = Modifier.size(18.dp)
            )
            Text(
                text = message,
                color = color,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium
            )
        }
        IconButton(
            onClick = onDismiss,
            modifier = Modifier.size(24.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Close,
                contentDescription = "Dismiss",
                tint = TextMutedDark,
                modifier = Modifier.size(14.dp)
            )
        }
    }
}

@Composable
fun AdminGeofenceSection(
    adminViewModel: AdminViewModel,
    uiState: AdminUiState
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var name by remember(uiState.activeOfficeLocation) {
        mutableStateOf(uiState.activeOfficeLocation?.name ?: "")
    }
    var latStr by remember(uiState.activeOfficeLocation) {
        mutableStateOf(uiState.activeOfficeLocation?.latitude?.toString() ?: "")
    }
    var lonStr by remember(uiState.activeOfficeLocation) {
        mutableStateOf(uiState.activeOfficeLocation?.longitude?.toString() ?: "")
    }
    var radiusStr by remember(uiState.activeOfficeLocation) {
        mutableStateOf((uiState.activeOfficeLocation?.radiusMeters ?: 200).toString())
    }
    var isDetectingLocation by remember { mutableStateOf(false) }
    var validationError by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Active Geofence Status Card
        ClayCard(
            cornerRadius = 20.dp,
            elevation = 6.dp,
            contentPadding = PaddingValues(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(BrandPrimary.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.ShareLocation,
                        contentDescription = "Radar",
                        tint = BrandPrimary,
                        modifier = Modifier.size(24.dp)
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Active Office Perimeter",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimaryDark
                    )
                    Text(
                        text = "${name} • Radius: ${radiusStr}m",
                        fontSize = 12.sp,
                        color = EmeraldSuccess,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "Lat: $latStr, Lon: $lonStr",
                        fontSize = 11.sp,
                        color = TextMutedDark
                    )
                }
            }
        }

        // Notification Feedback
        if (uiState.successMessage != null) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(EmeraldSuccess.copy(alpha = 0.15f))
                    .border(1.dp, EmeraldSuccess, RoundedCornerShape(12.dp))
                    .padding(14.dp)
            ) {
                Text(
                    text = uiState.successMessage,
                    color = EmeraldSuccess,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        if (uiState.errorMessage != null || validationError != null) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(RoseError.copy(alpha = 0.15f))
                    .border(1.dp, RoseError, RoundedCornerShape(12.dp))
                    .padding(14.dp)
            ) {
                Text(
                    text = validationError ?: uiState.errorMessage ?: "",
                    color = RoseError,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        // Configuration Form Card
        ClayCard(
            cornerRadius = 20.dp,
            elevation = 8.dp,
            contentPadding = PaddingValues(18.dp)
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = "Configure Office Coordinates",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimaryDark
                )

                // Office Name
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it; validationError = null },
                    label = { Text("Office / Campus Name") },
                    placeholder = { Text("e.g. Bangalore Tech Park HQ") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = BrandPrimary,
                        unfocusedBorderColor = GlassBorderSubtle,
                        focusedLabelColor = BrandPrimary,
                        unfocusedLabelColor = TextMutedDark,
                        focusedTextColor = TextPrimaryDark,
                        unfocusedTextColor = TextPrimaryDark
                    )
                )

                // Latitude & Longitude in 2 columns
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(
                        value = latStr,
                        onValueChange = { latStr = it; validationError = null },
                        label = { Text("Latitude") },
                        placeholder = { Text("12.9715987") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = BrandPrimary,
                            unfocusedBorderColor = GlassBorderSubtle,
                            focusedLabelColor = BrandPrimary,
                            unfocusedLabelColor = TextMutedDark,
                            focusedTextColor = TextPrimaryDark,
                            unfocusedTextColor = TextPrimaryDark
                        )
                    )

                    OutlinedTextField(
                        value = lonStr,
                        onValueChange = { lonStr = it; validationError = null },
                        label = { Text("Longitude") },
                        placeholder = { Text("77.5945627") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = BrandPrimary,
                            unfocusedBorderColor = GlassBorderSubtle,
                            focusedLabelColor = BrandPrimary,
                            unfocusedLabelColor = TextMutedDark,
                            focusedTextColor = TextPrimaryDark,
                            unfocusedTextColor = TextPrimaryDark
                        )
                    )
                }

                // Quick GPS Detect Button
                Button(
                    onClick = {
                        isDetectingLocation = true
                        validationError = null
                        scope.launch {
                            val loc = com.paylogic.humora.core.location.LocationProvider.getCurrentLocation(context)
                            isDetectingLocation = false
                            if (loc != null) {
                                latStr = "%.7f".format(java.util.Locale.US, loc.latitude)
                                lonStr = "%.7f".format(java.util.Locale.US, loc.longitude)
                            } else {
                                validationError = "GPS signal unavailable. Please ensure device location is enabled."
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = DarkSurfaceVariant),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.MyLocation,
                        contentDescription = null,
                        tint = BrandPrimary,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (isDetectingLocation) "Detecting GPS Fix…" else "Use My Current Device Location",
                        color = BrandPrimary,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 12.sp
                    )
                }

                // Radius selection
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = "Allowed Perimeter Radius: $radiusStr meters",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextPrimaryDark
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        val presets = listOf(50, 100, 200, 350, 500)
                        presets.forEach { r ->
                            val isSel = radiusStr == r.toString()
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (isSel) BrandPrimary else DarkSurfaceVariant)
                                    .clickable { radiusStr = r.toString() }
                                    .padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "${r}m",
                                    color = if (isSel) Color.White else TextSecondaryDark,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                // Save & Deploy Button
                Button(
                    onClick = {
                        val lat = latStr.toDoubleOrNull()
                        val lon = lonStr.toDoubleOrNull()
                        val radius = radiusStr.toIntOrNull()
                        if (name.isBlank()) {
                            validationError = "Office / Campus Name is required."
                            return@Button
                        }
                        if (lat == null || lat < -90.0 || lat > 90.0) {
                            validationError = "Valid latitude [-90, 90] is required."
                            return@Button
                        }
                        if (lon == null || lon < -180.0 || lon > 180.0) {
                            validationError = "Valid longitude [-180, 180] is required."
                            return@Button
                        }
                        if (radius == null || radius <= 0) {
                            validationError = "Valid radius in meters is required."
                            return@Button
                        }

                        adminViewModel.saveGeofence(
                            id = uiState.activeOfficeLocation?.id,
                            name = name,
                            lat = lat,
                            lon = lon,
                            radiusMeters = radius
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = BrandPrimary),
                    shape = RoundedCornerShape(12.dp),
                    enabled = !uiState.isSavingGeofence
                ) {
                    if (uiState.isSavingGeofence) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Deploying Perimeter…", color = Color.White, fontWeight = FontWeight.Bold)
                    } else {
                        Icon(imageVector = Icons.Default.Save, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Save & Deploy Geofence Perimeter", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

