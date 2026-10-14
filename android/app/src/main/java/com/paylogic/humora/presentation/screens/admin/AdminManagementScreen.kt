package com.paylogic.humora.presentation.screens.admin

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.paylogic.humora.core.theme.*
import com.paylogic.humora.presentation.components.GlassCard
import com.paylogic.humora.presentation.viewmodel.AdminViewModel
import com.paylogic.humora.presentation.viewmodel.EmployeeBiometricState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminManagementScreen(
    adminViewModel: AdminViewModel = viewModel()
) {
    val uiState by adminViewModel.uiState.collectAsState()

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
            contentPadding = PaddingValues(top = 16.dp, bottom = 96.dp)
        ) {
            // Screen Header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(BrandPrimary.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.AdminPanelSettings,
                                    contentDescription = "Admin Shield",
                                    tint = BrandPrimary,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                            Text(
                                text = "Admin Biometric Hub",
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimaryDark
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Enroll faces, allow or delete face & fingerprint punching",
                            fontSize = 12.sp,
                            color = TextMutedDark
                        )
                    }

                    IconButton(
                        onClick = { adminViewModel.loadEmployees() },
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(DarkSurfaceVariant)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Refresh",
                            tint = TextSecondaryDark,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }

            // Overview Stats
            item {
                val total = uiState.employees.size
                val faceCount = uiState.employees.count { it.isFaceRegistered }
                val fingerCount = uiState.employees.count { it.isFingerprintRegistered }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    StatCard(
                        modifier = Modifier.weight(1f),
                        label = "Employees",
                        value = total.toString(),
                        accentColor = BrandPrimary,
                        icon = Icons.Default.People
                    )
                    StatCard(
                        modifier = Modifier.weight(1f),
                        label = "Faces",
                        value = "$faceCount/$total",
                        accentColor = EmeraldSuccess,
                        icon = Icons.Default.Face
                    )
                    StatCard(
                        modifier = Modifier.weight(1f),
                        label = "Fingerprints",
                        value = "$fingerCount/$total",
                        accentColor = AmberWarning,
                        icon = Icons.Default.Fingerprint
                    )
                }
            }

            // Notification banners
            if (uiState.successMessage != null) {
                item {
                    BannerNotice(
                        message = uiState.successMessage!!,
                        color = EmeraldSuccess,
                        icon = Icons.Default.CheckCircle,
                        onDismiss = { adminViewModel.clearMessages() }
                    )
                }
            }

            if (uiState.errorMessage != null) {
                item {
                    BannerNotice(
                        message = uiState.errorMessage!!,
                        color = RoseError,
                        icon = Icons.Default.ErrorOutline,
                        onDismiss = { adminViewModel.clearMessages() }
                    )
                }
            }

            // Search Bar
            item {
                OutlinedTextField(
                    value = uiState.searchQuery,
                    onValueChange = { adminViewModel.onSearchQueryChange(it) },
                    placeholder = {
                        Text("Search by employee name, code, email...", fontSize = 13.sp, color = TextMutedDark)
                    },
                    leadingIcon = {
                        Icon(Icons.Default.Search, contentDescription = "Search", tint = TextMutedDark)
                    },
                    trailingIcon = {
                        if (uiState.searchQuery.isNotEmpty()) {
                            IconButton(onClick = { adminViewModel.onSearchQueryChange("") }) {
                                Icon(Icons.Default.Close, contentDescription = "Clear", tint = TextMutedDark)
                            }
                        }
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = DarkSurface,
                        unfocusedContainerColor = DarkSurface,
                        focusedBorderColor = BrandPrimary,
                        unfocusedBorderColor = DarkBorder,
                        focusedTextColor = TextPrimaryDark,
                        unfocusedTextColor = TextPrimaryDark
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Employee List Header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Directory (${uiState.employees.size})",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextSecondaryDark
                    )
                    if (uiState.isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            color = BrandPrimary,
                            strokeWidth = 2.dp
                        )
                    }
                }
            }

            if (uiState.employees.isEmpty() && !uiState.isLoading) {
                item {
                    GlassCard(
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Default.PersonSearch,
                                contentDescription = null,
                                tint = TextMutedDark,
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = if (uiState.searchQuery.isNotEmpty()) "No employees found for \"${uiState.searchQuery}\"" else "No employees found",
                                fontSize = 14.sp,
                                color = TextMutedDark
                            )
                        }
                    }
                }
            } else {
                items(uiState.employees, key = { it.employee.id }) { empState ->
                    EmployeeAdminCard(
                        state = empState,
                        onRegisterFace = { adminViewModel.openFaceEnrollment(empState.employee) },
                        onManageAccess = { adminViewModel.openBiometricAccess(empState.employee) }
                    )
                }
            }
        }

        // Active Dialogs/Sheets
        uiState.activeFaceEnrollEmployee?.let { emp ->
            AdminFaceEnrollmentSheet(
                employee = emp,
                adminViewModel = adminViewModel,
                onDismiss = { adminViewModel.closeFaceEnrollment() }
            )
        }

        if (uiState.activeBiometricEmployeeId != null) {
            AdminBiometricAccessSheet(uiState = uiState, adminViewModel = adminViewModel)
        }
    }
}

@Composable
private fun EmployeeAdminCard(
    state: EmployeeBiometricState,
    onRegisterFace: () -> Unit,
    onManageAccess: () -> Unit
) {
    val emp = state.employee

    GlassCard(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Employee top details
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(BrandPrimary.copy(alpha = 0.15f))
                        .border(1.dp, BrandPrimary.copy(alpha = 0.3f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = emp.fullName.take(2).uppercase(),
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = BrandPrimary
                    )
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = emp.fullName,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp,
                        color = TextPrimaryDark,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "${emp.employeeCode} • ${emp.departmentName ?: "General"} • ${emp.workEmail}",
                        fontSize = 11.sp,
                        color = TextMutedDark,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            // Biometric Status Pills
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                BiometricStatusBadge(
                    label = if (state.isFaceRegistered) "Face Enrolled" else "Face Pending",
                    icon = Icons.Default.Face,
                    isRegistered = state.isFaceRegistered,
                    modifier = Modifier.weight(1f)
                )
                BiometricStatusBadge(
                    label = when {
                        state.isFingerprintRegistered -> "Fingerprint On"
                        state.isFingerprintAllowed -> "Fingerprint Allowed"
                        else -> "Fingerprint Off"
                    },
                    icon = Icons.Default.Fingerprint,
                    isRegistered = state.isFingerprintRegistered,
                    modifier = Modifier.weight(1f)
                )
            }

            // Action Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onRegisterFace,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = if (state.isFaceRegistered) EmeraldSuccess else BrandPrimary
                    ),
                    border = ButtonDefaults.outlinedButtonBorder.copy(
                        brush = androidx.compose.ui.graphics.SolidColor(
                            if (state.isFaceRegistered) EmeraldSuccess.copy(alpha = 0.4f) else BrandPrimary.copy(alpha = 0.4f)
                        )
                    ),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 6.dp)
                ) {
                    Icon(
                        imageVector = if (state.isFaceRegistered) Icons.Default.CheckCircle else Icons.Default.AddAPhoto,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (state.isFaceRegistered) "Update Face" else "Register Face",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }

                OutlinedButton(
                    onClick = onManageAccess,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = if (state.isFingerprintRegistered) AmberWarning else BrandSecondary
                    ),
                    border = ButtonDefaults.outlinedButtonBorder.copy(
                        brush = androidx.compose.ui.graphics.SolidColor(
                            if (state.isFingerprintRegistered) AmberWarning.copy(alpha = 0.4f) else BrandSecondary.copy(alpha = 0.4f)
                        )
                    ),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Fingerprint,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Manage Access",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}

@Composable
private fun BiometricStatusBadge(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    isRegistered: Boolean,
    modifier: Modifier = Modifier
) {
    val tint = if (isRegistered) EmeraldSuccess else AmberWarning
    val bg = tint.copy(alpha = 0.12f)
    val border = tint.copy(alpha = 0.3f)

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(13.dp)
        )
        Spacer(modifier = Modifier.width(5.dp))
        Text(
            text = label,
            fontSize = 10.sp,
            fontWeight = FontWeight.Medium,
            color = tint,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun StatCard(
    modifier: Modifier = Modifier,
    label: String,
    value: String,
    accentColor: Color,
    icon: androidx.compose.ui.graphics.vector.ImageVector
) {
    GlassCard(
        modifier = modifier
    ) {
        Column(
            modifier = Modifier
                .padding(10.dp)
                .fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = label,
                    fontSize = 11.sp,
                    color = TextMutedDark
                )
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = accentColor,
                    modifier = Modifier.size(14.dp)
                )
            }
            Text(
                text = value,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimaryDark
            )
        }
    }
}

@Composable
private fun BannerNotice(
    message: String,
    color: Color,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
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
