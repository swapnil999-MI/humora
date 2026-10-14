package com.paylogic.humora.presentation.screens.admin

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddAPhoto
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.paylogic.humora.core.theme.*
import com.paylogic.humora.presentation.viewmodel.AdminUiState
import com.paylogic.humora.presentation.viewmodel.AdminViewModel
import com.paylogic.humora.presentation.viewmodel.BiometricKind

/**
 * HR/admin controls for one employee's punch methods. Everything here is enforced by the
 * server: deleting face data stops face punches, deleting fingerprint data stops fingerprint
 * punches, at once and on every device.
 *
 * Android never exposes whose finger touched the sensor, so an admin cannot capture an
 * employee's fingerprint on the admin's phone. Instead the admin allows fingerprint punching,
 * and the employee binds their own phone from the fingerprint punch sheet after a face match.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminBiometricAccessSheet(uiState: AdminUiState, adminViewModel: AdminViewModel) {
    val state = uiState.employees.firstOrNull { it.employee.id == uiState.activeBiometricEmployeeId } ?: return
    val emp = state.employee
    val busy = uiState.isUpdatingBiometrics

    ModalBottomSheet(
        onDismissRequest = { adminViewModel.closeBiometricAccess() },
        containerColor = DarkSurface,
        dragHandle = { BottomSheetDefaults.DragHandle(color = DarkBorder) },
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 12.dp)
                .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(emp.fullName, color = TextPrimaryDark, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Text(
                "Punch methods for ${emp.employeeCode}. Every punch needs face or fingerprint.",
                color = TextSecondaryDark,
                fontSize = 12.sp
            )

            uiState.errorMessage?.let { Text(it, color = RoseError, fontSize = 12.sp) }
            uiState.successMessage?.let { Text(it, color = EmeraldSuccess, fontSize = 12.sp) }

            // Face
            MethodCard(
                icon = Icons.Default.Face,
                title = "Face verification",
                status = if (state.isFaceRegistered) "Enrolled. Face punch is on." else "Not enrolled. Face punch is off.",
                active = state.isFaceRegistered
            ) {
                OutlinedButton(
                    onClick = { adminViewModel.closeBiometricAccess(); adminViewModel.openFaceEnrollment(emp) },
                    enabled = !busy,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Icon(Icons.Default.AddAPhoto, contentDescription = null, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(if (state.isFaceRegistered) "Re-enroll" else "Enroll face", fontSize = 12.sp)
                }
                if (state.isFaceRegistered) {
                    DeleteButton(enabled = !busy, modifier = Modifier.weight(1f)) {
                        adminViewModel.requestBiometricDelete(emp, BiometricKind.FACE)
                    }
                }
            }

            // Fingerprint
            val fp = state.fingerprint
            MethodCard(
                icon = Icons.Default.Fingerprint,
                title = "Fingerprint",
                status = when {
                    fp == null -> "Off. The employee cannot punch with a fingerprint."
                    state.isFingerprintRegistered -> "On, bound to ${fp.deviceLabel.ifBlank { "the employee's phone" }}."
                    else -> "Allowed. Waiting for the employee to set up their phone (needs a face match)."
                },
                active = state.isFingerprintRegistered
            ) {
                if (fp == null) {
                    OutlinedButton(
                        onClick = { adminViewModel.allowFingerprint(emp) },
                        enabled = !busy,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(Icons.Default.Fingerprint, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Allow fingerprint", fontSize = 12.sp)
                    }
                } else {
                    DeleteButton(enabled = !busy, modifier = Modifier.weight(1f)) {
                        adminViewModel.requestBiometricDelete(emp, BiometricKind.FINGERPRINT)
                    }
                }
            }

            if (busy) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = BrandPrimary)
            }
            Spacer(Modifier.height(8.dp))
        }
    }

    uiState.pendingBiometricDelete?.let { pending ->
        val what = if (pending.kind == BiometricKind.FACE) "face data" else "fingerprint data"
        val effect = if (pending.kind == BiometricKind.FACE) {
            "${pending.employee.fullName} will not be able to punch with their face until it is enrolled again. Setting up fingerprint on a new phone also needs the face."
        } else {
            "${pending.employee.fullName} will not be able to punch with a fingerprint. Their phone's key is removed; to use fingerprint again you must allow it and they must set it up again."
        }
        AlertDialog(
            onDismissRequest = { adminViewModel.cancelBiometricDelete() },
            containerColor = DarkSurface,
            title = { Text("Delete $what?", color = TextPrimaryDark, fontWeight = FontWeight.Bold) },
            text = { Text(effect, color = TextSecondaryDark, fontSize = 13.sp) },
            confirmButton = {
                TextButton(onClick = { adminViewModel.confirmBiometricDelete() }) {
                    Text("Delete", color = RoseError, fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = {
                TextButton(onClick = { adminViewModel.cancelBiometricDelete() }) {
                    Text("Cancel", color = TextSecondaryDark)
                }
            }
        )
    }
}

@Composable
private fun MethodCard(
    icon: ImageVector,
    title: String,
    status: String,
    active: Boolean,
    actions: @Composable RowScope.() -> Unit
) {
    val tint = if (active) EmeraldSuccess else AmberWarning
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(DarkSurfaceVariant)
            .border(1.dp, tint.copy(alpha = 0.35f), RoundedCornerShape(14.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(22.dp))
            Column {
                Text(title, color = TextPrimaryDark, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                Text(status, color = TextSecondaryDark, fontSize = 12.sp, textAlign = TextAlign.Start)
            }
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), content = actions)
    }
}

@Composable
private fun DeleteButton(enabled: Boolean, modifier: Modifier, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier,
        shape = RoundedCornerShape(10.dp),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = RoseError),
        border = ButtonDefaults.outlinedButtonBorder.copy(brush = SolidColor(RoseError.copy(alpha = 0.5f)))
    ) {
        Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.size(14.dp))
        Spacer(Modifier.width(6.dp))
        Text("Delete", fontSize = 12.sp)
    }
}
