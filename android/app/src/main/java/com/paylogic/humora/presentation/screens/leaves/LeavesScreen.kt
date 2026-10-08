package com.paylogic.humora.presentation.screens.leaves

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Info
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.SolidColor
import androidx.lifecycle.viewmodel.compose.viewModel
import com.paylogic.humora.core.theme.*
import com.paylogic.humora.data.model.LeaveBalanceItem
import com.paylogic.humora.data.model.LeaveRequestItem
import com.paylogic.humora.presentation.components.ClayBadge
import com.paylogic.humora.presentation.components.ClayButton
import com.paylogic.humora.presentation.components.ClayCard
import com.paylogic.humora.presentation.components.clayEffect
import com.paylogic.humora.presentation.viewmodel.LeavesViewModel

@Composable
fun LeavesScreen(
    viewModel: LeavesViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showApplyModal by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(bottom = 80.dp)
    ) {
        // Notification Banner
        if (uiState.actionMessage != null) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(DarkSurfaceVariant)
                        .border(1.dp, EmeraldSuccess, RoundedCornerShape(12.dp))
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = uiState.actionMessage ?: "",
                        color = EmeraldSuccess,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(
                        onClick = { viewModel.clearActionMessage() },
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(Icons.Default.Close, contentDescription = "Dismiss", tint = TextMutedDark, modifier = Modifier.size(16.dp))
                    }
                }
            }
        }

        // 1. LEAVE BALANCES CAROUSEL
        item {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Leave Balances",
                        color = TextPrimaryDark,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold
                    )
                    val totalAvailable = uiState.balances.sumOf { it.balance }
                    Text(
                        text = "Total: ${totalAvailable.toInt()} Days",
                        color = BrandPrimary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(uiState.balances) { balance ->
                        LeaveBalanceCard(balance)
                    }
                }
            }
        }

        // 2. QUICK APPLY ACTION
        item {
            ClayCard {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.CalendarMonth,
                            contentDescription = "Leave",
                            tint = BrandPrimary,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Apply for Leave",
                            color = TextPrimaryDark,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Submit planned leaves or emergency time-off requests directly for approval.",
                        color = TextSecondaryDark,
                        fontSize = 12.sp
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                    ClayButton(
                        text = "New Leave Application",
                        icon = Icons.Default.Add,
                        brush = ClayAccentGradient,
                        modifier = Modifier.fillMaxWidth(),
                        cornerRadius = 14.dp,
                        onClick = { showApplyModal = true }
                    )
                }
            }
        }

        // 3. PAST LEAVE REQUESTS
        item {
            Column {
                Text(
                    text = "Recent Applications",
                    color = TextPrimaryDark,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(10.dp))

                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    uiState.myLeaves.forEach { req ->
                        LeaveRequestCard(req)
                    }
                }
            }
        }
    }

    // Apply Leave Dialog
    if (showApplyModal) {
        var selectedTypeId by remember {
            mutableStateOf(uiState.leaveTypes.firstOrNull()?.id ?: "")
        }
        // Issue #12 Fix: Pre-fill with today's date dynamically instead of hardcoded stale dates
        val today = java.time.LocalDate.now()
        var fromDateInput by remember { mutableStateOf(today.toString()) }
        var toDateInput   by remember { mutableStateOf(today.toString()) }
        var reasonInput by remember { mutableStateOf("") }
        var errorMsg by remember { mutableStateOf<String?>(null) }

        Dialog(onDismissRequest = { showApplyModal = false }) {
            ClayCard(
                cornerRadius = 24.dp,
                elevation = 16.dp,
                contentPadding = PaddingValues(20.dp)
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Apply Leave",
                            color = TextPrimaryDark,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        IconButton(onClick = { showApplyModal = false }) {
                            Icon(Icons.Default.Close, contentDescription = "Close", tint = TextMutedDark)
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Text("Select Leave Category", color = TextSecondaryDark, fontSize = 12.sp)
                    Spacer(modifier = Modifier.height(6.dp))

                    // Leave Type Selector Chips (Tactile 3D Clay Pills)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(uiState.leaveTypes) { type ->
                            val isSelected = selectedTypeId == type.id
                            Box(
                                modifier = Modifier
                                    .shadow(if (isSelected) 4.dp else 1.dp, RoundedCornerShape(12.dp), ambientColor = Color(0x66000000))
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(if (isSelected) ClayAccentGradient else SolidColor(ClaySurfacePressed))
                                    .border(
                                        1.dp,
                                        if (isSelected) Brush.verticalGradient(listOf(Color.White.copy(0.45f), Color.White.copy(0.18f)))
                                        else Brush.verticalGradient(listOf(Color.White.copy(0.15f), Color.White.copy(0.08f))),
                                        RoundedCornerShape(12.dp)
                                    )
                                    .clickable { selectedTypeId = type.id }
                                    .padding(horizontal = 12.dp, vertical = 7.dp)
                            ) {
                                Text(
                                    text = "${type.name} (${type.code})",
                                    color = if (isSelected) Color.White else TextSecondaryDark,
                                    fontSize = 11.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedTextField(
                            value = fromDateInput,
                            onValueChange = { fromDateInput = it },
                            label = { Text("From (YYYY-MM-DD)", fontSize = 10.sp) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextPrimaryDark,
                                unfocusedTextColor = TextPrimaryDark,
                                focusedBorderColor = BrandPrimary,
                                unfocusedBorderColor = DarkBorder,
                                focusedContainerColor = ClaySurfacePressed,
                                unfocusedContainerColor = ClaySurfacePressed
                            )
                        )
                        OutlinedTextField(
                            value = toDateInput,
                            onValueChange = { toDateInput = it },
                            label = { Text("To (YYYY-MM-DD)", fontSize = 10.sp) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextPrimaryDark,
                                unfocusedTextColor = TextPrimaryDark,
                                focusedBorderColor = BrandPrimary,
                                unfocusedBorderColor = DarkBorder,
                                focusedContainerColor = ClaySurfacePressed,
                                unfocusedContainerColor = ClaySurfacePressed
                            )
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    OutlinedTextField(
                        value = reasonInput,
                        onValueChange = { reasonInput = it },
                        label = { Text("Reason for absence", fontSize = 11.sp) },
                        modifier = Modifier.fillMaxWidth(),
                        maxLines = 3,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimaryDark,
                            unfocusedTextColor = TextPrimaryDark,
                            focusedBorderColor = BrandPrimary,
                            unfocusedBorderColor = DarkBorder,
                            focusedContainerColor = ClaySurfacePressed,
                            unfocusedContainerColor = ClaySurfacePressed
                        )
                    )

                    if (errorMsg != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(errorMsg ?: "", color = RoseError, fontSize = 11.sp)
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    ClayButton(
                        text = "Submit Application",
                        modifier = Modifier.fillMaxWidth(),
                        isLoading = uiState.isSubmitting,
                        enabled = !uiState.isSubmitting,
                        brush = ClayAccentGradient,
                        cornerRadius = 14.dp,
                        onClick = {
                            if (reasonInput.isBlank()) {
                                errorMsg = "Please enter reason for absence"
                                return@ClayButton
                            }
                            val effectiveTypeId = selectedTypeId.ifBlank {
                                uiState.leaveTypes.firstOrNull()?.id ?: "20000000-0000-0000-0000-000000000003"
                            }
                            viewModel.submitLeave(effectiveTypeId, fromDateInput, toDateInput, reasonInput) { success, msg ->
                                if (success) {
                                    showApplyModal = false
                                } else {
                                    errorMsg = msg
                                }
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun LeaveBalanceCard(balance: LeaveBalanceItem) {
    ClayCard(
        modifier = Modifier.width(135.dp),
        cornerRadius = 20.dp,
        elevation = 7.dp,
        contentPadding = PaddingValues(14.dp)
    ) {
        Column {
            Text(
                text = balance.code,
                color = BrandPrimary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = balance.name,
                color = TextSecondaryDark,
                fontSize = 12.sp,
                maxLines = 1
            )
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = "${balance.balance.toInt()}",
                color = TextPrimaryDark,
                fontSize = 26.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "of ${balance.credited.toInt()} left",
                color = TextMutedDark,
                fontSize = 11.sp
            )
        }
    }
}

@Composable
private fun LeaveRequestCard(req: LeaveRequestItem) {
    ClayCard(
        cornerRadius = 20.dp,
        elevation = 6.dp,
        contentPadding = PaddingValues(14.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = req.typeName ?: "Leave Request",
                    color = BrandPrimary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "${req.fromDate} to ${req.toDate} (${req.totalDays} Days)",
                    color = TextPrimaryDark,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold
                )
                if (req.reason.isNotBlank()) {
                    Text(
                        text = req.reason,
                        color = TextMutedDark,
                        fontSize = 11.sp,
                        maxLines = 1
                    )
                }
            }

            val badgeBrush = when (req.status.lowercase()) {
                "approved" -> ClaySuccessGradient
                "pending" -> ClayWarningGradient
                else -> ClayErrorGradient
            }

            ClayBadge(
                text = req.status.uppercase(),
                brush = badgeBrush,
                textColor = Color.White
            )
        }
    }
}
