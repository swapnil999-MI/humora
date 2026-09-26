package com.paylogic.humora.presentation.screens.auth

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.paylogic.humora.R
import com.paylogic.humora.core.theme.*
import com.paylogic.humora.presentation.components.BackendSettingsDialog
import com.paylogic.humora.presentation.viewmodel.AuthViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    authViewModel: AuthViewModel
) {
    val authState by authViewModel.uiState.collectAsState()
    val focusManager = LocalFocusManager.current

    var email by remember { mutableStateOf(authState.userEmail.ifBlank { "marcus@gamil.com" }) }
    var password by remember { mutableStateOf("123") }
    var passwordVisible by remember { mutableStateOf(false) }
    var showSettingsDialog by remember { mutableStateOf(false) }

    val scrollState = rememberScrollState()
    val density = LocalDensity.current
    val imeBottom = WindowInsets.ime.getBottom(density)
    val isImeVisible = imeBottom > 0

    // Auto-scroll when keyboard pops up so the active fields and login card are immediately visible
    LaunchedEffect(isImeVisible) {
        if (isImeVisible) {
            scrollState.animateScrollTo(scrollState.maxValue)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
    ) {
        // Ambient background subtle glow
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            BrandPrimary.copy(alpha = 0.12f),
                            Color.Transparent
                        ),
                        radius = 1200f
                    )
                )
        )

        // Dismiss keyboard when tapping on empty background
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null
                ) {
                    focusManager.clearFocus()
                }
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .imePadding()
                .verticalScroll(scrollState)
                .padding(horizontal = 24.dp, vertical = if (isImeVisible) 16.dp else 36.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = if (isImeVisible) Arrangement.Top else Arrangement.Center
        ) {
            // Server Status Header Pill
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(30.dp))
                    .background(DarkSurface)
                    .border(
                        1.dp,
                        if (authState.isServerConnected) EmeraldSuccess.copy(alpha = 0.4f) else AmberWarning.copy(alpha = 0.4f),
                        RoundedCornerShape(30.dp)
                    )
                    .clickable { showSettingsDialog = true }
                    .padding(horizontal = 14.dp, vertical = 7.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(if (authState.isServerConnected) EmeraldSuccess else RoseError)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (authState.isServerConnected) "Server Online (${authState.currentBaseUrl.replace("http://", "").replace("/api/v1", "")})" else "Server Offline (${authState.currentBaseUrl.replace("http://", "").replace("/api/v1", "")})",
                    color = if (authState.isServerConnected) EmeraldSuccess else AmberWarning,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium
                )
                Spacer(modifier = Modifier.width(6.dp))
                Icon(
                    imageVector = Icons.Default.Settings,
                    contentDescription = "Config",
                    tint = TextMutedDark,
                    modifier = Modifier.size(13.dp)
                )
            }

            Spacer(modifier = Modifier.height(28.dp))

            // Humora PeopleOS Logo
            Box(
                modifier = Modifier
                    .size(68.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(DarkSurface)
                    .border(
                        1.5.dp,
                        Brush.linearGradient(listOf(BrandPrimary, BrandSecondary)),
                        RoundedCornerShape(20.dp)
                    )
                    .padding(10.dp),
                contentAlignment = Alignment.Center
            ) {
                androidx.compose.foundation.Image(
                    painter = androidx.compose.ui.res.painterResource(id = R.drawable.ic_peopleos_logo),
                    contentDescription = "Humora Logo",
                    modifier = Modifier.size(44.dp)
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            Text(
                text = "HUMORA",
                color = TextPrimaryDark,
                fontSize = 26.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 2.sp
            )

            Text(
                text = "Enterprise HRMS & Biometric Workforce",
                color = TextSecondaryDark,
                fontSize = 13.sp,
                fontWeight = FontWeight.Normal,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(30.dp))

            // Main Glass Login Card
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(22.dp))
                    .background(DarkSurface)
                    .border(1.dp, DarkBorder, RoundedCornerShape(22.dp))
                    .padding(22.dp)
            ) {
                Text(
                    text = "Sign In to Workspace",
                    color = TextPrimaryDark,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Enter your unique work email and password",
                    color = TextMutedDark,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(bottom = 18.dp)
                )

                // Error message alert
                AnimatedVisibility(visible = authState.errorMessage != null) {
                    authState.errorMessage?.let { error ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 14.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(RoseError.copy(alpha = 0.12f))
                                .border(1.dp, RoseError.copy(alpha = 0.35f), RoundedCornerShape(12.dp))
                                .padding(12.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Warning,
                                    contentDescription = null,
                                    tint = RoseError,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = error,
                                    color = RoseError,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                            if (!authState.isServerConnected) {
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = "Tap 'Server Offline' above to check IP or verify your backend is running.",
                                    color = TextSecondaryDark,
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }
                }

                // Field 1: Work Email
                Text(
                    text = "WORK EMAIL",
                    color = TextSecondaryDark,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                    modifier = Modifier.padding(bottom = 4.dp)
                )
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    placeholder = { Text("admin@humora.internal", color = TextMutedDark, fontSize = 13.sp) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextPrimaryDark,
                        unfocusedTextColor = TextPrimaryDark,
                        focusedBorderColor = BrandPrimary,
                        unfocusedBorderColor = DarkBorder,
                        focusedContainerColor = DarkBackground,
                        unfocusedContainerColor = DarkBackground
                    ),
                    shape = RoundedCornerShape(12.dp),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                        imeAction = ImeAction.Next
                    )
                )

                Spacer(modifier = Modifier.height(14.dp))

                // Field 2: Password
                Text(
                    text = "PASSWORD",
                    color = TextSecondaryDark,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                    modifier = Modifier.padding(bottom = 4.dp)
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    placeholder = { Text("••••••••••••", color = TextMutedDark, fontSize = 13.sp) },
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(
                                imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                contentDescription = if (passwordVisible) "Hide password" else "Show password",
                                tint = TextMutedDark,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextPrimaryDark,
                        unfocusedTextColor = TextPrimaryDark,
                        focusedBorderColor = BrandPrimary,
                        unfocusedBorderColor = DarkBorder,
                        focusedContainerColor = DarkBackground,
                        unfocusedContainerColor = DarkBackground
                    ),
                    shape = RoundedCornerShape(12.dp),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done
                    ),
                    keyboardActions = KeyboardActions(
                        onDone = {
                            focusManager.clearFocus()
                            if (email.isNotBlank() && password.isNotBlank()) {
                                authViewModel.login(email.trim(), password)
                            }
                        }
                    )
                )

                Spacer(modifier = Modifier.height(18.dp))

                // Quick Prefill Chips
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Chip 1: Marcus Vance
                    Row(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .background(DarkBackground)
                            .border(1.dp, BrandPrimary.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
                            .clickable {
                                email = "marcus@gamil.com"
                                password = "123"
                            }
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = null,
                            tint = BrandPrimary,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Fill Marcus",
                            color = BrandPrimary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    // Chip 2: Admin
                    Row(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .background(DarkBackground)
                            .border(1.dp, DarkBorder, RoundedCornerShape(10.dp))
                            .clickable {
                                email = "admin@humora.internal"
                                password = "Password@123"
                            }
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.AdminPanelSettings,
                            contentDescription = null,
                            tint = CyanInfo,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Fill Admin",
                            color = CyanInfo,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Submit Button
                Button(
                    onClick = {
                        focusManager.clearFocus()
                        authViewModel.login(email.trim(), password)
                    },
                    enabled = !authState.isLoading && email.isNotBlank() && password.isNotBlank(),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = BrandPrimary,
                        disabledContainerColor = BrandPrimary.copy(alpha = 0.4f)
                    )
                ) {
                    if (authState.isLoading) {
                        CircularProgressIndicator(
                            color = Color.White,
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = "Authenticating...",
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    } else {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "Sign In",
                                color = Color.White,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "Humora Enterprise Platform v1.0 · Protected by TLS & JWT",
                color = TextMutedDark,
                fontSize = 11.sp,
                textAlign = TextAlign.Center
            )
        }

        // Settings Dialog for IP change or ping
        if (showSettingsDialog) {
            BackendSettingsDialog(
                authViewModel = authViewModel,
                uiState = authState,
                onDismiss = { showSettingsDialog = false }
            )
        }
    }
}
