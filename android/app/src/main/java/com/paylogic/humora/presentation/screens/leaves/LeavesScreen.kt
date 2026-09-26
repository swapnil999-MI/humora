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
import androidx.lifecycle.viewmodel.compose.viewModel
import com.paylogic.humora.core.theme.*
import com.paylogic.humora.data.model.LeaveBalanceItem
import com.paylogic.humora.data.model.LeaveRequestItem
import com.paylogic.humora.presentation.components.GlassCard
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

        // 2. SANDWICH RULE NOTICE & APPLY BUTTON
        item {
            GlassCard {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Info,
                            contentDescription = "Info",
                            tint = AmberWarning,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Sandwich Rule Policy Active",
                            color = TextPrimaryDark,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Taking leaves immediately before and after weekend/holidays counts intervening days as leave on the backend.",
                        color = TextSecondaryDark,
                        fontSize = 12.sp
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                    Button(
                        onClick = { showApplyModal = true },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = BrandPrimary),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(imageVector = Icons.Default.Add, contentDescription = "Apply")
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Apply for Leave", fontWeight = FontWeight.Bold)
                    }
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
        var fromDateInput by remember { mutableStateOf("2026-09-25") }
        var toDateInput by remember { mutableStateOf("2026-09-26") }
        var reasonInput by remember { mutableStateOf("") }
        var errorMsg by remember { mutableStateOf<String?>(null) }

        Dialog(onDismissRequest = { showApplyModal = false }) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(DarkSurface)
                    .border(1.dp, DarkBorder, RoundedCornerShape(20.dp))
                    .padding(20.dp)
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

                    // Leave Type Selector Chips
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(uiState.leaveTypes) { type ->
                            val isSelected = selectedTypeId == type.id
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (isSelected) BrandPrimary else DarkSurfaceVariant)
                                    .border(1.dp, if (isSelected) BrandPrimary else DarkBorder, RoundedCornerShape(8.dp))
                                    .clickable { selectedTypeId = type.id }
                                    .padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text(
                                    text = "${type.name} (${type.code})",
                                    color = TextPrimaryDark,
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
                            shape = RoundedCornerShape(10.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextPrimaryDark,
                                unfocusedTextColor = TextPrimaryDark,
                                focusedBorderColor = BrandPrimary,
                                unfocusedBorderColor = DarkBorder
                            )
                        )
                        OutlinedTextField(
                            value = toDateInput,
                            onValueChange = { toDateInput = it },
                            label = { Text("To (YYYY-MM-DD)", fontSize = 10.sp) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextPrimaryDark,
                                unfocusedTextColor = TextPrimaryDark,
                                focusedBorderColor = BrandPrimary,
                                unfocusedBorderColor = DarkBorder
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
                        shape = RoundedCornerShape(10.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimaryDark,
                            unfocusedTextColor = TextPrimaryDark,
                            focusedBorderColor = BrandPrimary,
                            unfocusedBorderColor = DarkBorder
                        )
                    )

                    if (errorMsg != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(errorMsg ?: "", color = RoseError, fontSize = 11.sp)
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = {
                            if (reasonInput.isBlank()) {
                                errorMsg = "Please enter reason for absence"
                                return@Button
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
                        },
                        enabled = !uiState.isSubmitting,
                        colors = ButtonDefaults.buttonColors(containerColor = BrandPrimary),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        if (uiState.isSubmitting) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White)
                        } else {
                            Text("Submit Application", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LeaveBalanceCard(balance: LeaveBalanceItem) {
    Box(
        modifier = Modifier
            .width(130.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(DarkSurface)
            .border(1.dp, DarkBorder, RoundedCornerShape(14.dp))
            .padding(14.dp)
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
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(DarkSurface)
            .border(1.dp, DarkBorder, RoundedCornerShape(12.dp))
            .padding(14.dp)
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

            val (statusBg, statusText) = when (req.status.lowercase()) {
                "approved" -> Pair(EmeraldSuccess.copy(alpha = 0.2f), EmeraldSuccess)
                "pending" -> Pair(AmberWarning.copy(alpha = 0.2f), AmberWarning)
                else -> Pair(RoseError.copy(alpha = 0.2f), RoseError)
            }

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(statusBg)
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text(
                    text = req.status.uppercase(),
                    color = statusText,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
