package com.paylogic.humora.presentation.screens.profile

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.paylogic.humora.core.theme.*
import com.paylogic.humora.presentation.components.ClayButton
import com.paylogic.humora.presentation.components.ClayCard
import com.paylogic.humora.presentation.components.clayEffect
import com.paylogic.humora.presentation.viewmodel.ProfileViewModel

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun UserProfileScreen(
    profileViewModel: ProfileViewModel = viewModel(),
    onNavigateBack: () -> Unit = {},
    onLogout: () -> Unit = {}
) {
    val uiState by profileViewModel.uiState.collectAsState()
    val emp = uiState.employeeProfile?.employee
    val personal = uiState.employeeProfile?.personalDetails
    val bank = uiState.employeeProfile?.bankDetails
    val contacts = uiState.employeeProfile?.emergencyContacts ?: emptyList()
    val skills = uiState.employeeProfile?.skills ?: emptyList()
    val assets = uiState.employeeProfile?.assignedAssets ?: emptyList()

    val rotation by animateFloatAsState(
        targetValue = if (uiState.isLoading) 360f else 0f,
        animationSpec = tween(600),
        label = "spin"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(top = 16.dp, bottom = 100.dp)
        ) {
            // ==========================================
            // 1. TOP BAR NAVIGATION
            // ==========================================
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(38.dp)
                                .clayEffect(
                                    shape = CircleShape,
                                    elevation = 6.dp,
                                    borderWidth = 1.dp,
                                    borderBrush = ClayBorderGradient,
                                    backgroundBrush = ClaySurfaceGradient
                                )
                                .clickable { onNavigateBack() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                                tint = TextPrimaryDark,
                                modifier = Modifier.size(18.dp)
                            )
                        }

                        Column {
                            Text(
                                text = "My Profile",
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimaryDark
                            )
                            Text(
                                text = if (uiState.isAdmin) "Management & Platform Identity" else "Employee Self-Service Dossier",
                                fontSize = 11.sp,
                                color = TextMutedDark
                            )
                        }
                    }

                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clayEffect(
                                shape = CircleShape,
                                elevation = 6.dp,
                                borderWidth = 1.dp,
                                borderBrush = ClayBorderGradient,
                                backgroundBrush = ClaySurfaceGradient
                            )
                            .clickable { profileViewModel.loadProfile() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Refresh",
                            tint = if (uiState.isLoading) BrandPrimary else TextPrimaryDark,
                            modifier = Modifier
                                .size(18.dp)
                                .rotate(rotation)
                        )
                    }
                }
            }

            // ==========================================
            // 2. HERO IDENTITY CLAY CARD
            // ==========================================
            item {
                ClayCard(
                    cornerRadius = 24.dp,
                    elevation = 12.dp,
                    contentPadding = PaddingValues(20.dp)
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        // Avatar Halo with Presence Ring
                        Box(
                            modifier = Modifier
                                .size(84.dp)
                                .shadow(8.dp, CircleShape, ambientColor = Color(0x66000000))
                                .clip(CircleShape)
                                .background(
                                    Brush.linearGradient(
                                        listOf(
                                            if (uiState.isAdmin) BrandPrimary else EmeraldSuccess,
                                            DarkSurfaceVariant
                                        )
                                    )
                                )
                                .border(
                                    2.dp,
                                    if (uiState.isAdmin) BrandPrimary.copy(alpha = 0.6f) else EmeraldSuccess.copy(alpha = 0.6f),
                                    CircleShape
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            val initials = (emp?.fullName?.ifBlank { uiState.userName } ?: uiState.userEmail)
                                .split(" ", "@", ".")
                                .mapNotNull { it.firstOrNull()?.toString() }
                                .take(2)
                                .joinToString("")
                                .uppercase()
                                .ifBlank { "ME" }

                            Text(
                                text = initials,
                                color = TextPrimaryDark,
                                fontSize = 26.sp,
                                fontWeight = FontWeight.Black
                            )
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        // Full Name
                        Text(
                            text = emp?.fullName?.ifBlank { uiState.userName }?.ifBlank { uiState.userEmail } ?: "User",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimaryDark
                        )

                        Spacer(modifier = Modifier.height(3.dp))

                        // Designation & Department
                        val designationText = when {
                            emp?.designationTitle != null -> listOfNotNull(emp.designationTitle, emp.departmentName).joinToString(" • ")
                            else -> roleLabel(uiState.userRole)
                        }

                        Text(
                            text = designationText,
                            fontSize = 12.sp,
                            color = TextSecondaryDark
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        // Role & Employee Code Pills Row
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Role Badge
                            val roleColor = if (uiState.isAdmin) BrandPrimary else EmeraldSuccess
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(roleColor.copy(alpha = 0.18f))
                                    .border(1.dp, roleColor.copy(alpha = 0.45f), RoundedCornerShape(12.dp))
                                    .padding(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(
                                        imageVector = if (uiState.isAdmin) Icons.Default.AdminPanelSettings else Icons.Default.VerifiedUser,
                                        contentDescription = null,
                                        tint = roleColor,
                                        modifier = Modifier.size(13.dp)
                                    )
                                    Text(
                                        text = roleLabel(uiState.userRole),
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = roleColor
                                    )
                                }
                            }

                            // Employee Code Badge (if present)
                            val code = emp?.employeeCode?.takeIf { it.isNotBlank() }
                            if (code != null) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(ClaySurfacePressed)
                                        .border(1.dp, DarkBorder, RoundedCornerShape(12.dp))
                                        .padding(horizontal = 10.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = code,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = TextSecondaryDark
                                    )
                                }
                            }

                            // Presence Indicator
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(EmeraldSuccess.copy(alpha = 0.15f))
                                    .border(1.dp, EmeraldSuccess.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                                    .padding(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(6.dp)
                                            .clip(CircleShape)
                                            .background(EmeraldSuccess)
                                    )
                                    Text(
                                        text = "Active",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = EmeraldSuccess
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // ==========================================
            // 3. QUICK METRIC STATS TILES (3 Columns)
            // ==========================================
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    QuickStatTile(
                        modifier = Modifier.weight(1f),
                        icon = Icons.Default.Business,
                        label = "Organization",
                        value = uiState.userSummary?.tenantName ?: "Humora Tech",
                        accentColor = BrandPrimary
                    )
                    QuickStatTile(
                        modifier = Modifier.weight(1f),
                        icon = Icons.Default.WorkOutline,
                        label = "Type",
                        value = if (uiState.isAdmin) "Executive" else "Full-Time",
                        accentColor = EmeraldSuccess
                    )
                    QuickStatTile(
                        modifier = Modifier.weight(1f),
                        icon = Icons.Default.Security,
                        label = "Access",
                        value = if (uiState.isAdmin) "All Domains" else "Self-Service",
                        accentColor = AmberWarning
                    )
                }
            }

            // ==========================================
            // 4. BASIC WORK & IDENTITY DETAILS
            // ==========================================
            item {
                SectionHeader(title = "Work & Contact Info", icon = Icons.Default.Badge)
            }

            item {
                ClayCard(
                    cornerRadius = 20.dp,
                    elevation = 6.dp,
                    contentPadding = PaddingValues(16.dp)
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        ProfileDetailRow(
                            icon = Icons.Default.Email,
                            label = "Work Email",
                            value = emp?.workEmail?.ifBlank { uiState.userEmail } ?: uiState.userEmail
                        )
                        ProfileDetailRow(
                            icon = Icons.Default.CorporateFare,
                            label = "Department",
                            value = emp?.departmentName ?: "Not set"
                        )
                        ProfileDetailRow(
                            icon = Icons.Default.AccountBox,
                            label = "Designation",
                            value = emp?.designationTitle ?: "Not set"
                        )
                        ProfileDetailRow(
                            icon = Icons.Default.Fingerprint,
                            label = "Employee Code",
                            value = emp?.employeeCode?.takeIf { it.isNotBlank() } ?: "Not set"
                        )
                        if (emp?.dateOfJoining != null) {
                            ProfileDetailRow(
                                icon = Icons.Default.CalendarToday,
                                label = "Date of Joining",
                                value = emp.dateOfJoining.take(10)
                            )
                        }
                    }
                }
            }

            // ==========================================
            // 5. PERSONAL DOSSIER DETAILS (If available)
            // ==========================================
            if (personal != null) {
                item {
                    SectionHeader(title = "Personal Information", icon = Icons.Default.PersonOutline)
                }

                item {
                    ClayCard(
                        cornerRadius = 20.dp,
                        elevation = 6.dp,
                        contentPadding = PaddingValues(16.dp)
                    ) {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            personal.dob?.let {
                                ProfileDetailRow(icon = Icons.Default.Cake, label = "Date of Birth", value = it)
                            }
                            personal.gender?.let {
                                ProfileDetailRow(icon = Icons.Default.Wc, label = "Gender", value = it)
                            }
                            personal.bloodGroup?.let {
                                ProfileDetailRow(icon = Icons.Default.Bloodtype, label = "Blood Group", value = it)
                            }
                            personal.maritalStatus?.let {
                                ProfileDetailRow(icon = Icons.Default.FavoriteBorder, label = "Marital Status", value = it)
                            }
                            personal.currentAddress?.let {
                                ProfileDetailRow(icon = Icons.Default.Home, label = "Current Address", value = it)
                            }
                        }
                    }
                }
            }

            // ==========================================
            // 6. EMERGENCY CONTACTS (If available)
            // ==========================================
            if (contacts.isNotEmpty()) {
                item {
                    SectionHeader(title = "Emergency Contacts", icon = Icons.Default.ContactPhone)
                }

                items(contacts) { contact ->
                    ClayCard(
                        cornerRadius = 16.dp,
                        elevation = 5.dp,
                        contentPadding = PaddingValues(14.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = contact.name,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimaryDark
                                )
                                Text(
                                    text = contact.relationship,
                                    fontSize = 11.sp,
                                    color = BrandPrimary
                                )
                            }
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Icon(
                                    imageVector = Icons.Default.Phone,
                                    contentDescription = null,
                                    tint = EmeraldSuccess,
                                    modifier = Modifier.size(14.dp)
                                )
                                Text(
                                    text = contact.phone,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = TextSecondaryDark
                                )
                            }
                        }
                    }
                }
            }

            // ==========================================
            // 7. BANK & PAYROLL INFO (If available)
            // ==========================================
            if (bank != null) {
                item {
                    SectionHeader(title = "Payroll & Banking", icon = Icons.Default.AccountBalance)
                }

                item {
                    ClayCard(
                        cornerRadius = 20.dp,
                        elevation = 6.dp,
                        contentPadding = PaddingValues(16.dp)
                    ) {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            bank.bankName?.let {
                                ProfileDetailRow(icon = Icons.Default.AccountBalance, label = "Bank", value = it)
                            }
                            bank.accountNumberMasked?.let {
                                ProfileDetailRow(icon = Icons.Default.CreditCard, label = "Account Number", value = it)
                            }
                            bank.routingNumber?.let {
                                ProfileDetailRow(icon = Icons.Default.Pin, label = "Routing Number", value = it)
                            }
                            ProfileDetailRow(
                                icon = Icons.Default.CheckCircle,
                                label = "Direct Deposit",
                                value = if (bank.directDeposit) "Active • Configured" else "Inactive"
                            )
                        }
                    }
                }
            }

            // ==========================================
            // 8. SKILLS & COMPETENCIES (If available)
            // ==========================================
            if (skills.isNotEmpty()) {
                item {
                    SectionHeader(title = "Verified Technical Skills", icon = Icons.Default.Terminal)
                }

                item {
                    ClayCard(
                        cornerRadius = 20.dp,
                        elevation = 6.dp,
                        contentPadding = PaddingValues(16.dp)
                    ) {
                        FlowRow(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            skills.forEach { skill ->
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(ClaySurfacePressed)
                                        .border(1.dp, BrandPrimary.copy(alpha = 0.35f), RoundedCornerShape(12.dp))
                                        .padding(horizontal = 10.dp, vertical = 6.dp)
                                ) {
                                    Text(
                                        text = skill,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = TextPrimaryDark
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // ==========================================
            // 9. ASSIGNED HARDWARE ASSETS (If available)
            // ==========================================
            if (assets.isNotEmpty()) {
                item {
                    SectionHeader(title = "Assigned Hardware Assets", icon = Icons.Default.LaptopMac)
                }

                items(assets) { asset ->
                    ClayCard(
                        cornerRadius = 16.dp,
                        elevation = 5.dp,
                        contentPadding = PaddingValues(14.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = asset.assetName,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimaryDark
                                )
                                Text(
                                    text = "${asset.category} • S/N: ${asset.serial}",
                                    fontSize = 11.sp,
                                    color = TextSecondaryDark
                                )
                            }
                            Text(
                                text = asset.assignedDate,
                                fontSize = 10.sp,
                                color = TextMutedDark
                            )
                        }
                    }
                }
            }

            // ==========================================
            // 10. APP & SECURITY SESSION SLATE
            // ==========================================
            item {
                SectionHeader(title = "Security & Session", icon = Icons.Default.Lock)
            }

            item {
                ClayCard(
                    cornerRadius = 20.dp,
                    elevation = 6.dp,
                    contentPadding = PaddingValues(16.dp)
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        ProfileDetailRow(
                            icon = Icons.Default.Shield,
                            label = "Authentication",
                            value = "Bearer JWT (HMAC-SHA256)"
                        )
                        ProfileDetailRow(
                            icon = Icons.Default.Smartphone,
                            label = "Client Version",
                            value = "Humora Mobile v2.1"
                        )

                        Spacer(modifier = Modifier.height(4.dp))

                        // Sign Out Button
                        ClayButton(
                            text = "Sign Out of Workspace",
                            icon = Icons.AutoMirrored.Filled.Logout,
                            brush = ClayErrorGradient,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp),
                            cornerRadius = 14.dp,
                            fontSize = 13.sp,
                            elevation = 8.dp,
                            onClick = onLogout
                        )
                    }
                }
            }
        }
    }
}

// =========================================================================
// PROFILE HELPERS & CHIPS
// =========================================================================

@Composable
private fun SectionHeader(title: String, icon: ImageVector) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.padding(top = 4.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = BrandPrimary,
            modifier = Modifier.size(16.dp)
        )
        Text(
            text = title,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = TextPrimaryDark,
            letterSpacing = 0.5.sp
        )
    }
}

@Composable
private fun QuickStatTile(
    icon: ImageVector,
    label: String,
    value: String,
    accentColor: Color,
    modifier: Modifier = Modifier
) {
    ClayCard(
        modifier = modifier,
        cornerRadius = 16.dp,
        elevation = 6.dp,
        contentPadding = PaddingValues(12.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Box(
                modifier = Modifier
                    .size(26.dp)
                    .clip(CircleShape)
                    .background(accentColor.copy(alpha = 0.18f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = accentColor,
                    modifier = Modifier.size(14.dp)
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = value,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimaryDark,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = label,
                fontSize = 9.sp,
                color = TextMutedDark,
                maxLines = 1
            )
        }
    }
}

@Composable
private fun ProfileDetailRow(
    icon: ImageVector,
    label: String,
    value: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.weight(0.9f)
        ) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(ClaySurfacePressed),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = TextMutedDark,
                    modifier = Modifier.size(14.dp)
                )
            }
            Text(
                text = label,
                fontSize = 12.sp,
                color = TextSecondaryDark
            )
        }

        Text(
            text = value,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = TextPrimaryDark,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
    }
}

/** Human-readable name of an account role, as stored in the session. */
private fun roleLabel(role: String): String = when (role.lowercase()) {
    "superadmin" -> "Super administrator"
    "admin" -> "Administrator"
    "hr_admin" -> "HR administrator"
    "", "employee" -> "Employee"
    else -> role.replace('_', ' ').replaceFirstChar { it.uppercase() }
}
