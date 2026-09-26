package com.paylogic.humora.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.paylogic.humora.core.theme.*
import com.paylogic.humora.data.remote.NetworkConfig
import com.paylogic.humora.presentation.viewmodel.AuthUiState
import com.paylogic.humora.presentation.viewmodel.AuthViewModel

@Composable
fun BackendSettingsDialog(
    authViewModel: AuthViewModel,
    uiState: AuthUiState,
    onDismiss: () -> Unit
) {
    var baseUrlInput by remember { mutableStateOf(uiState.currentBaseUrl) }
    var tenantSlugInput by remember { mutableStateOf(uiState.tenantSlug) }
    var emailInput by remember { mutableStateOf(uiState.userEmail) }
    var passwordInput by remember { mutableStateOf("Password@123") }
    var showAuthTab by remember { mutableStateOf(false) }

    Dialog(onDismissRequest = onDismiss) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(DarkSurface)
                .border(1.dp, DarkBorder, RoundedCornerShape(20.dp))
                .padding(20.dp)
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Backend & Session",
                        color = TextPrimaryDark,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Close", tint = TextMutedDark)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Server Status Indicator Card
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (uiState.isServerConnected) EmeraldSuccess.copy(alpha = 0.15f) else RoseError.copy(alpha = 0.15f))
                        .border(1.dp, if (uiState.isServerConnected) EmeraldSuccess.copy(alpha = 0.3f) else RoseError.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text(
                            text = if (uiState.isServerConnected) "Connected to Go Backend" else "Server Offline / Unreachable",
                            color = if (uiState.isServerConnected) EmeraldSuccess else RoseError,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                        Text(
                            text = uiState.currentBaseUrl,
                            color = TextSecondaryDark,
                            fontSize = 11.sp
                        )
                    }
                    IconButton(onClick = { authViewModel.checkServerConnection() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Test Ping", tint = TextPrimaryDark)
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Tabs: Connection vs Auth
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(DarkSurfaceVariant)
                        .padding(4.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (!showAuthTab) BrandPrimary else Color.Transparent)
                            .clickable { showAuthTab = false }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("Host URL", color = TextPrimaryDark, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (showAuthTab) BrandPrimary else Color.Transparent)
                            .clickable { showAuthTab = true }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("Auth / User", color = TextPrimaryDark, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                if (!showAuthTab) {
                    // Quick host selector pills
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                baseUrlInput = NetworkConfig.DEFAULT_BASE_URL
                                authViewModel.updateBaseUrl(baseUrlInput)
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 4.dp, vertical = 6.dp)
                        ) {
                            Text("LAN :8090", fontSize = 10.sp, color = TextPrimaryDark, maxLines = 1)
                        }
                        OutlinedButton(
                            onClick = {
                                baseUrlInput = NetworkConfig.DEVICE_PORT_8000_URL
                                authViewModel.updateBaseUrl(baseUrlInput)
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 4.dp, vertical = 6.dp)
                        ) {
                            Text("LAN :8000", fontSize = 10.sp, color = TextPrimaryDark, maxLines = 1)
                        }
                        OutlinedButton(
                            onClick = {
                                baseUrlInput = NetworkConfig.EMULATOR_BASE_URL
                                authViewModel.updateBaseUrl(baseUrlInput)
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 4.dp, vertical = 6.dp)
                        ) {
                            Text("Emulator", fontSize = 10.sp, color = TextPrimaryDark, maxLines = 1)
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    OutlinedTextField(
                        value = baseUrlInput,
                        onValueChange = { baseUrlInput = it },
                        label = { Text("Base API URL", color = TextSecondaryDark, fontSize = 12.sp) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimaryDark,
                            unfocusedTextColor = TextPrimaryDark,
                            focusedBorderColor = BrandPrimary,
                            unfocusedBorderColor = DarkBorder
                        )
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Button(
                        onClick = {
                            authViewModel.updateBaseUrl(baseUrlInput)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = BrandPrimary),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text("Apply & Test Ping", fontWeight = FontWeight.SemiBold)
                    }
                } else {
                    // Auth / Login Section
                    if (uiState.isLoggedIn) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(DarkSurfaceVariant)
                                .padding(12.dp)
                        ) {
                            Text("Active Session", color = TextMutedDark, fontSize = 11.sp)
                            Text(uiState.userEmail, color = TextPrimaryDark, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text("Role: ${uiState.userRole} • Tenant: ${uiState.tenantSlug}", color = TextSecondaryDark, fontSize = 12.sp)
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Button(
                            onClick = { authViewModel.logout() },
                            colors = ButtonDefaults.buttonColors(containerColor = RoseError),
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text("Sign Out", fontWeight = FontWeight.SemiBold)
                        }
                    } else {
                        OutlinedTextField(
                            value = tenantSlugInput,
                            onValueChange = { tenantSlugInput = it },
                            label = { Text("Tenant Slug (e.g. humora-corp)", color = TextSecondaryDark, fontSize = 12.sp) },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextPrimaryDark,
                                unfocusedTextColor = TextPrimaryDark,
                                focusedBorderColor = BrandPrimary,
                                unfocusedBorderColor = DarkBorder
                            )
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        OutlinedTextField(
                            value = emailInput,
                            onValueChange = { emailInput = it },
                            label = { Text("Email", color = TextSecondaryDark, fontSize = 12.sp) },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextPrimaryDark,
                                unfocusedTextColor = TextPrimaryDark,
                                focusedBorderColor = BrandPrimary,
                                unfocusedBorderColor = DarkBorder
                            )
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        OutlinedTextField(
                            value = passwordInput,
                            onValueChange = { passwordInput = it },
                            label = { Text("Password", color = TextSecondaryDark, fontSize = 12.sp) },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextPrimaryDark,
                                unfocusedTextColor = TextPrimaryDark,
                                focusedBorderColor = BrandPrimary,
                                unfocusedBorderColor = DarkBorder
                            )
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        Button(
                            onClick = {
                                authViewModel.login(emailInput, passwordInput, tenantSlugInput)
                            },
                            enabled = !uiState.isLoading,
                            colors = ButtonDefaults.buttonColors(containerColor = BrandPrimary),
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            if (uiState.isLoading) {
                                CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White)
                            } else {
                                Text("Login with Seed Credentials", fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }

                if (uiState.errorMessage != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = uiState.errorMessage,
                        color = RoseError,
                        fontSize = 12.sp
                    )
                }

                if (uiState.successMessage != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = uiState.successMessage,
                        color = EmeraldSuccess,
                        fontSize = 12.sp
                    )
                }
            }
        }
    }
}
