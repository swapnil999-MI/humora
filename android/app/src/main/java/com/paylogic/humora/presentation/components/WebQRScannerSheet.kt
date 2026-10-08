package com.paylogic.humora.presentation.components

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.paylogic.humora.core.theme.*
import com.paylogic.humora.presentation.viewmodel.AuthViewModel

/**
 * WebQRScannerSheet — WhatsApp-Style "Link a Device" Scanner Sheet.
 * Allows employees to scan or approve the live QR code displayed on Humora Web.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WebQRScannerSheet(
    authViewModel: AuthViewModel,
    onDismiss: () -> Unit
) {
    var rawInput by remember { mutableStateOf("") }
    var detectedSessionId by remember { mutableStateOf<String?>(null) }
    var isAuthorizing by remember { mutableStateOf(false) }
    var authSuccess by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = DarkBackground,
        scrimColor = Color.Black.copy(alpha = 0.7f),
        dragHandle = {
            Box(
                modifier = Modifier
                    .padding(vertical = 10.dp)
                    .width(36.dp)
                    .height(4.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.2f))
            )
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 8.dp)
                .navigationBarsPadding(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF0F3E36)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.QrCodeScanner,
                            contentDescription = null,
                            tint = Color(0xFF00A884),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    Text(
                        text = "Link a Device",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimaryDark
                    )
                }

                IconButton(onClick = onDismiss) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = TextMutedDark
                    )
                }
            }

            Spacer(Modifier.height(14.dp))

            if (authSuccess) {
                // Success State
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(CircleShape)
                                .background(Color(0xFF0F3E36))
                                .border(1.5.dp, Color(0xFF00A884), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = null,
                                tint = Color(0xFF00A884),
                                modifier = Modifier.size(36.dp)
                            )
                        }
                        Spacer(Modifier.height(16.dp))
                        Text(
                            text = "Web Session Linked!",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimaryDark
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = "Your browser has logged in automatically.",
                            fontSize = 13.sp,
                            color = TextMutedDark,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            } else if (detectedSessionId != null) {
                // Confirmation State
                ClayCard(
                    modifier = Modifier.fillMaxWidth(),
                    cornerRadius = 20.dp,
                    contentPadding = PaddingValues(18.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.Computer,
                            contentDescription = null,
                            tint = Color(0xFF00A884),
                            modifier = Modifier.size(42.dp)
                        )
                        Spacer(Modifier.height(12.dp))
                        Text(
                            text = "Authorize Humora Web Login?",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimaryDark
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = "A web browser on your network is requesting access to your corporate workspace.",
                            fontSize = 12.sp,
                            color = TextMutedDark,
                            textAlign = TextAlign.Center,
                            lineHeight = 16.sp
                        )

                        Spacer(Modifier.height(18.dp))

                        if (errorMessage != null) {
                            Text(
                                text = errorMessage!!,
                                color = RoseError,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(bottom = 10.dp)
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Button(
                                onClick = { detectedSessionId = null },
                                colors = ButtonDefaults.buttonColors(containerColor = ClaySurfacePressed),
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text("Cancel", color = TextMutedDark, fontSize = 13.sp)
                            }

                            Button(
                                onClick = {
                                    isAuthorizing = true
                                    errorMessage = null
                                    authViewModel.confirmQRLogin(detectedSessionId!!) { success, err ->
                                        isAuthorizing = false
                                        if (success) {
                                            authSuccess = true
                                        } else {
                                            errorMessage = err ?: "Authorization failed"
                                        }
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00A884)),
                                modifier = Modifier.weight(1.3f),
                                shape = RoundedCornerShape(12.dp),
                                enabled = !isAuthorizing
                            ) {
                                if (isAuthorizing) {
                                    CircularProgressIndicator(
                                        color = Color.White,
                                        modifier = Modifier.size(16.dp),
                                        strokeWidth = 2.dp
                                    )
                                } else {
                                    Text("Authorize Web", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                }
                            }
                        }
                    }
                }
            } else {
                // Scanner / Input State
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "Point your camera at the QR code on your computer screen or enter the session payload below.",
                        fontSize = 12.5.sp,
                        color = TextMutedDark,
                        textAlign = TextAlign.Center,
                        lineHeight = 17.sp
                    )

                    Spacer(Modifier.height(18.dp))

                    // Scanner Target Frame Box
                    Box(
                        modifier = Modifier
                            .size(200.dp)
                            .shadow(6.dp, RoundedCornerShape(20.dp), ambientColor = Color(0x44000000))
                            .clip(RoundedCornerShape(20.dp))
                            .background(ClaySurfaceElevated)
                            .border(2.dp, Color(0xFF00A884).copy(alpha = 0.6f), RoundedCornerShape(20.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.QrCode,
                                contentDescription = null,
                                tint = Color(0xFF00A884),
                                modifier = Modifier.size(64.dp)
                            )
                            Spacer(Modifier.height(8.dp))
                            Text(
                                text = "Scanner Active",
                                color = Color(0xFF00A884),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }

                    Spacer(Modifier.height(18.dp))

                    // Quick Session ID Input (Enables test authorization without camera setup)
                    ClayDebossedBox(
                        modifier = Modifier.fillMaxWidth(),
                        cornerRadius = 14.dp,
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(
                                value = rawInput,
                                onValueChange = { input ->
                                    rawInput = input
                                    // Detect humora:auth:qr:<session_id>:<nonce>
                                    if (input.startsWith("humora:auth:qr:")) {
                                        val parts = input.split(":")
                                        if (parts.size >= 4) {
                                            detectedSessionId = parts[3]
                                        }
                                    } else if (input.length == 36 && input.contains("-")) {
                                        // Plain UUID session ID
                                        detectedSessionId = input
                                    }
                                },
                                placeholder = {
                                    Text("Paste QR code payload or Session ID", fontSize = 12.sp, color = TextMutedDark)
                                },
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = Color.Transparent,
                                    unfocusedBorderColor = Color.Transparent,
                                    focusedTextColor = TextPrimaryDark,
                                    unfocusedTextColor = TextPrimaryDark
                                ),
                                textStyle = androidx.compose.ui.text.TextStyle(fontSize = 12.sp),
                                modifier = Modifier.weight(1f)
                            )

                            if (rawInput.isNotBlank()) {
                                IconButton(
                                    onClick = {
                                        val id = if (rawInput.startsWith("humora:auth:qr:")) {
                                            rawInput.split(":").getOrNull(3) ?: rawInput
                                        } else rawInput
                                        detectedSessionId = id.trim()
                                    }
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.CheckCircle,
                                        contentDescription = "Confirm",
                                        tint = Color(0xFF00A884)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}
