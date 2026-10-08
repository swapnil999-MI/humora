package com.paylogic.humora.presentation.screens.auth

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
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
import com.paylogic.humora.BuildConfig
import com.paylogic.humora.R
import com.paylogic.humora.core.theme.*
import com.paylogic.humora.presentation.components.BackendSettingsDialog
import com.paylogic.humora.presentation.components.ClayButton
import com.paylogic.humora.presentation.components.ClayCard
import com.paylogic.humora.presentation.components.GlassMeshBackground
import com.paylogic.humora.presentation.components.clayEffect
import com.paylogic.humora.presentation.viewmodel.AuthViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    authViewModel: AuthViewModel
) {
    val authState by authViewModel.uiState.collectAsState()
    val focusManager = LocalFocusManager.current

    var email by remember { mutableStateOf(authState.userEmail.ifBlank { if (BuildConfig.DEBUG) "admin@humora.internal" else "" }) }
    var password by remember { mutableStateOf(if (BuildConfig.DEBUG) "Password@123" else "") }
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

    GlassMeshBackground {
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
                .padding(horizontal = 22.dp, vertical = if (isImeVisible) 16.dp else 36.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = if (isImeVisible) Arrangement.Top else Arrangement.Center
        ) {
            // Server Status Header Pill (Tactile Clay)
            Row(
                modifier = Modifier
                    .clayEffect(
                        shape = RoundedCornerShape(30.dp),
                        elevation = 4.dp,
                        borderWidth = 1.dp,
                        borderBrush = Brush.linearGradient(
                            listOf(
                                if (authState.isServerConnected) EmeraldSuccess.copy(alpha = 0.6f) else AmberWarning.copy(alpha = 0.6f),
                                Color.White.copy(alpha = 0.15f)
                            )
                        ),
                        backgroundBrush = Brush.verticalGradient(
                            listOf(
                                Color(0xFF1E2B47),
                                Color(0xFF131B2D)
                            )
                        )
                    )
                    .clickable { showSettingsDialog = true }
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(if (authState.isServerConnected) EmeraldSuccess else AmberWarning)
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

            Spacer(modifier = Modifier.height(26.dp))

            // Humora Gold Brand Emblem (matching Web design)
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clayEffect(
                        shape = RoundedCornerShape(24.dp),
                        elevation = 12.dp,
                        borderWidth = 1.2.dp,
                        borderBrush = Brush.linearGradient(
                            listOf(
                                Color(0xFFF59E0B).copy(alpha = 0.50f),
                                Color(0xFFFBBF24).copy(alpha = 0.20f)
                            )
                        ),
                        backgroundBrush = Brush.linearGradient(
                            listOf(
                                Color(0xFF261D12),
                                Color(0xFF16120D)
                            )
                        )
                    )
                    .padding(14.dp),
                contentAlignment = Alignment.Center
            ) {
                androidx.compose.foundation.Image(
                    painter = androidx.compose.ui.res.painterResource(id = R.drawable.ic_peopleos_logo),
                    contentDescription = "Humora Logo",
                    modifier = Modifier.size(52.dp)
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "HUMORA",
                    color = TextPrimaryDark,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 2.sp
                )
                Spacer(modifier = Modifier.width(8.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFFF59E0B).copy(alpha = 0.18f))
                        .border(1.dp, Color(0xFFF59E0B).copy(alpha = 0.35f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 7.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = "PLATFORM",
                        color = Color(0xFFFBBF24),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                }
            }

            Text(
                text = "Enterprise HRMS & Biometric Workforce",
                color = TextSecondaryDark,
                fontSize = 13.sp,
                fontWeight = FontWeight.Normal,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(26.dp))

            // Main Tactile 3D Clay Login Slate
            ClayCard(
                cornerRadius = 28.dp,
                elevation = 14.dp,
                contentPadding = PaddingValues(22.dp)
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Sign In to Workspace",
                        color = TextPrimaryDark,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Enter your work credentials to authenticate",
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
                                .clip(RoundedCornerShape(14.dp))
                                .background(RoseError.copy(alpha = 0.15f))
                                .border(1.dp, RoseError.copy(alpha = 0.40f), RoundedCornerShape(14.dp))
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
                    modifier = Modifier.padding(bottom = 5.dp)
                )
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    placeholder = { Text("you@company.com", color = TextMutedDark, fontSize = 13.sp) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextPrimaryDark,
                        unfocusedTextColor = TextPrimaryDark,
                        focusedBorderColor = BrandPrimary,
                        unfocusedBorderColor = DarkBorder,
                        focusedContainerColor = ClaySurfacePressed,
                        unfocusedContainerColor = ClaySurfacePressed
                    ),
                    shape = RoundedCornerShape(14.dp),
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
                    modifier = Modifier.padding(bottom = 5.dp)
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
                        focusedContainerColor = ClaySurfacePressed,
                        unfocusedContainerColor = ClaySurfacePressed
                    ),
                    shape = RoundedCornerShape(14.dp),
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

                // Quick-fill chips for the seeded demo accounts: debug builds only.
                if (BuildConfig.DEBUG) Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Chip 1: Humora Tech Admin
                    Row(
                        modifier = Modifier
                            .weight(1.1f)
                            .shadow(3.dp, RoundedCornerShape(14.dp), ambientColor = Color(0x66000000))
                            .clip(RoundedCornerShape(14.dp))
                            .background(ClaySurfaceElevated)
                            .border(
                                1.dp,
                                Brush.verticalGradient(
                                    listOf(BrandPrimary.copy(alpha = 0.55f), BrandPrimary.copy(alpha = 0.22f))
                                ),
                                RoundedCornerShape(14.dp)
                            )
                            .clickable {
                                email = "admin@humora.internal"
                                password = "Password@123"
                            }
                            .padding(horizontal = 8.dp, vertical = 9.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.AdminPanelSettings,
                            contentDescription = null,
                            tint = BrandPrimary,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(5.dp))
                        Text(
                            text = "Admin",
                            color = BrandPrimary,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    // Chip 2: Employee (Rahul)
                    Row(
                        modifier = Modifier
                            .weight(1f)
                            .shadow(3.dp, RoundedCornerShape(14.dp), ambientColor = Color(0x66000000))
                            .clip(RoundedCornerShape(14.dp))
                            .background(ClaySurfaceElevated)
                            .border(
                                1.dp,
                                Brush.verticalGradient(
                                    listOf(EmeraldSuccess.copy(alpha = 0.50f), EmeraldSuccess.copy(alpha = 0.20f))
                                ),
                                RoundedCornerShape(14.dp)
                            )
                            .clickable {
                                email = "rahul.sharma@humoratechnologies.com"
                                password = "Password@123"
                            }
                            .padding(horizontal = 8.dp, vertical = 9.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = null,
                            tint = EmeraldSuccess,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(5.dp))
                        Text(
                            text = "Employee",
                            color = EmeraldSuccess,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Submit Button (Tactile 3D Clay Action Button)
                ClayButton(
                    text = if (authState.isLoading) "Authenticating..." else "Sign In",
                    trailingIcon = if (!authState.isLoading) Icons.AutoMirrored.Filled.ArrowForward else null,
                    isLoading = authState.isLoading,
                    enabled = !authState.isLoading && email.isNotBlank() && password.isNotBlank(),
                    brush = ClayAccentGradient,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    cornerRadius = 16.dp,
                    fontSize = 15.sp,
                    elevation = 10.dp,
                    onClick = {
                        focusManager.clearFocus()
                        authViewModel.login(email.trim(), password)
                    }
                )

                // Social Login Section (Google, GitHub, Microsoft)
                val providers = authState.authProviders
                val hasSocial = providers.google || providers.github || providers.microsoft
                if (hasSocial) {
                    Spacer(modifier = Modifier.height(18.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        HorizontalDivider(
                            modifier = Modifier.weight(1f),
                            thickness = 0.5.dp,
                            color = Color.White.copy(alpha = 0.1f)
                        )
                        Text(
                            text = "OR CONTINUE WITH",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextMutedDark,
                            modifier = Modifier.padding(horizontal = 8.dp)
                        )
                        HorizontalDivider(
                            modifier = Modifier.weight(1f),
                            thickness = 0.5.dp,
                            color = Color.White.copy(alpha = 0.1f)
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    val context = androidx.compose.ui.platform.LocalContext.current

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        if (providers.google) {
                            SocialButton(
                                label = "Google",
                                icon = Icons.Default.Public,
                                color = Color(0xFFEA4335),
                                modifier = Modifier.weight(1f),
                                onClick = {
                                    val url = "${authState.currentBaseUrl}/auth/oauth/google?client=mobile"
                                    val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
                                    context.startActivity(intent)
                                }
                            )
                        }
                        if (providers.github) {
                            SocialButton(
                                label = "GitHub",
                                icon = Icons.Default.Code,
                                color = Color(0xFF818CF8),
                                modifier = Modifier.weight(1f),
                                onClick = {
                                    val url = "${authState.currentBaseUrl}/auth/oauth/github?client=mobile"
                                    val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
                                    context.startActivity(intent)
                                }
                            )
                        }
                        if (providers.microsoft) {
                            SocialButton(
                                label = "Microsoft",
                                icon = Icons.Default.Work,
                                color = Color(0xFF00A4EF),
                                modifier = Modifier.weight(1f),
                                onClick = {
                                    val url = "${authState.currentBaseUrl}/auth/oauth/microsoft?client=mobile"
                                    val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
                                    context.startActivity(intent)
                                }
                            )
                        }
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

@Composable
private fun SocialButton(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    color: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        modifier = modifier.height(44.dp),
        shape = RoundedCornerShape(12.dp),
        color = ClaySurfaceElevated,
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = color,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = label,
                color = TextPrimaryDark,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}
