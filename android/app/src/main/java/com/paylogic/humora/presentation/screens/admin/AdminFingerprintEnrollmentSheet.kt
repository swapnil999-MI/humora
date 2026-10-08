package com.paylogic.humora.presentation.screens.admin

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.fragment.app.FragmentActivity
import com.paylogic.humora.core.security.BiometricPromptManager
import com.paylogic.humora.core.theme.*
import com.paylogic.humora.data.model.EmployeeDetail
import com.paylogic.humora.presentation.viewmodel.AdminViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminFingerprintEnrollmentSheet(
    employee: EmployeeDetail,
    adminViewModel: AdminViewModel,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val activity = context as? FragmentActivity

    var statusMessage by remember { mutableStateOf<String?>(null) }
    var isSuccess by remember { mutableStateOf(false) }
    var isFailed by remember { mutableStateOf(false) }

    fun triggerFingerprintScan() {
        if (activity == null) {
            statusMessage = "Biometric prompt requires an active activity."
            isFailed = true
            return
        }

        val manager = BiometricPromptManager(activity)
        if (!manager.canAuthenticate()) {
            statusMessage = "Fingerprint sensor is unavailable or no fingerprints are enrolled on this device. Please check Android Settings."
            isFailed = true
            return
        }

        manager.showBiometricPrompt(
            title = "Register Fingerprint Credential",
            subtitle = "Place employee finger on the sensor to register for ${employee.fullName}",
            description = "This credential will be bound to employee code ${employee.employeeCode}."
        ) { result ->
            when (result) {
                is BiometricPromptManager.BiometricResult.AuthenticationSuccess -> {
                    isSuccess = true
                    isFailed = false
                    statusMessage = "Fingerprint registered successfully!"
                    adminViewModel.onFingerprintEnrolled(employee.id)
                }
                is BiometricPromptManager.BiometricResult.AuthenticationFailed -> {
                    isFailed = true
                    statusMessage = "Fingerprint not recognized. Please scan again."
                }
                is BiometricPromptManager.BiometricResult.AuthenticationError -> {
                    isFailed = true
                    statusMessage = result.errString
                }
                is BiometricPromptManager.BiometricResult.NoneEnrolled -> {
                    isFailed = true
                    statusMessage = "No fingerprints enrolled on device. Please register a fingerprint in Android Security Settings first."
                }
                else -> {
                    isFailed = true
                    statusMessage = "Biometric sensor hardware unavailable."
                }
            }
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = DarkSurface,
        dragHandle = { BottomSheetDefaults.DragHandle(color = DarkBorder) },
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 12.dp)
                .navigationBarsPadding(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Register Fingerprint",
                color = TextPrimaryDark,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Bind biometric hardware template for ${employee.fullName}",
                color = TextSecondaryDark,
                fontSize = 12.sp,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(28.dp))

            // Large Fingerprint Icon Reticle
            Box(
                modifier = Modifier
                    .size(110.dp)
                    .clip(CircleShape)
                    .background(if (isSuccess) EmeraldSuccess.copy(alpha = 0.15f) else BrandPrimary.copy(alpha = 0.15f))
                    .border(
                        2.dp,
                        if (isSuccess) EmeraldSuccess else if (isFailed) RoseError else BrandPrimary,
                        CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isSuccess) Icons.Default.CheckCircle else Icons.Default.Fingerprint,
                    contentDescription = "Fingerprint",
                    tint = if (isSuccess) EmeraldSuccess else if (isFailed) RoseError else BrandPrimary,
                    modifier = Modifier.size(56.dp)
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            Text(
                text = "${employee.fullName} (${employee.employeeCode})",
                color = TextPrimaryDark,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = employee.workEmail,
                color = TextMutedDark,
                fontSize = 12.sp
            )

            if (statusMessage != null) {
                Spacer(modifier = Modifier.height(14.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (isSuccess) EmeraldSuccess.copy(alpha = 0.12f) else RoseError.copy(alpha = 0.12f))
                        .border(
                            1.dp,
                            if (isSuccess) EmeraldSuccess.copy(alpha = 0.3f) else RoseError.copy(alpha = 0.3f),
                            RoundedCornerShape(10.dp)
                        )
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = if (isSuccess) Icons.Default.CheckCircle else Icons.Default.Warning,
                        contentDescription = null,
                        tint = if (isSuccess) EmeraldSuccess else RoseError,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = statusMessage ?: "",
                        color = if (isSuccess) EmeraldSuccess else RoseError,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            Spacer(modifier = Modifier.height(28.dp))

            // Action Button
            Button(
                onClick = { triggerFingerprintScan() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isSuccess) EmeraldSuccess else BrandPrimary
                )
            ) {
                Icon(
                    imageVector = Icons.Default.Fingerprint,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isSuccess) "Fingerprint Registered" else "Scan Employee Fingerprint",
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(10.dp))
        }
    }
}
