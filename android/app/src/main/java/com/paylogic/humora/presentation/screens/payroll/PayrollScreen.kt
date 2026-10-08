package com.paylogic.humora.presentation.screens.payroll

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.paylogic.humora.core.theme.*
import com.paylogic.humora.presentation.components.ClayBadge
import com.paylogic.humora.presentation.components.ClayButton
import com.paylogic.humora.presentation.components.ClayCard
import com.paylogic.humora.presentation.components.GlassCard
import com.paylogic.humora.presentation.viewmodel.PayrollViewModel

@Composable
fun PayrollScreen(
    viewModel: PayrollViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val latestSlip = uiState.payslips.firstOrNull()

    val netPayText = latestSlip?.formattedNetPay
        ?: if (uiState.compensation.monthlyGross > 0)
            "₹ %,d".format((uiState.compensation.monthlyGross * 0.85).toLong())
        else "--"  // Issue #5 Fix: don't show fake salary when no data loaded
    val grossPayText = latestSlip?.formattedGrossPay
        ?: if (uiState.compensation.monthlyGross > 0)
            "₹ %,d".format(uiState.compensation.monthlyGross.toLong())
        else "--"
    val deductionsText = latestSlip?.let { "₹ %,d".format(it.totalDeductions.toLong()) }
        ?: if (uiState.compensation.monthlyGross > 0)
            "₹ %,d".format((uiState.compensation.monthlyGross * 0.15).toLong())
        else "--"

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(bottom = 80.dp)
    ) {
        // 1. SALARY SNAPSHOT
        item {
            GlassCard {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Issue #4 Fix: Show next pay date from uiState or hide when not available
                        if (uiState.nextPayDate.isNotBlank()) {
                            Text(
                                text = "Next Pay Date: ${uiState.nextPayDate}",
                                color = TextMutedDark,
                                fontSize = 12.sp
                            )
                        } else {
                            Text(
                                text = "Payroll data loaded from your HR system",
                                color = TextMutedDark,
                                fontSize = 12.sp
                            )
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Lock,
                                contentDescription = "Secure",
                                tint = EmeraldSuccess,
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "Private to you",
                                color = EmeraldSuccess,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Text(
                        text = "Net In-Hand (${latestSlip?.payPeriod ?: "Monthly Prorated"})",
                        color = TextSecondaryDark,
                        fontSize = 13.sp
                    )
                    Text(
                        text = netPayText,
                        color = TextPrimaryDark,
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(text = "Gross Earnings", color = TextMutedDark, fontSize = 11.sp)
                            Text(text = grossPayText, color = TextPrimaryDark, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        }
                        Column {
                            Text(text = "TDS & Statutory Deductions", color = TextMutedDark, fontSize = 11.sp)
                            Text(text = deductionsText, color = TextPrimaryDark, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }

        // 2. EXPENSE REIMBURSEMENT QUICK ACTION
        item {
            ClayCard(
                cornerRadius = 22.dp,
                elevation = 8.dp,
                contentPadding = PaddingValues(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Expense Reimbursements",
                            color = TextPrimaryDark,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "Upload receipts for broadband or wellness claims",
                            color = TextSecondaryDark,
                            fontSize = 12.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    ClayButton(
                        text = "Claim",
                        brush = ClayAccentGradient,
                        cornerRadius = 12.dp,
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        onClick = {}
                    )
                }
            }
        }

        // 3. PAYSLIPS LIST
        item {
            Text(
                text = "Generated Payslips",
                color = TextPrimaryDark,
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold
            )
        }

        items(uiState.payslips) { item ->
            ClayCard(
                cornerRadius = 20.dp,
                elevation = 6.dp,
                contentPadding = PaddingValues(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = item.monthYear,
                                color = TextPrimaryDark,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            ClayBadge(
                                text = item.status.uppercase(),
                                brush = if (item.status.equals("paid", ignoreCase = true)) ClaySuccessGradient else ClayWarningGradient,
                                textColor = Color.White
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Net In-Hand: ${item.formattedNetPay}",
                            color = TextSecondaryDark,
                            fontSize = 12.sp
                        )
                    }

                    Box(
                        modifier = Modifier
                            .shadow(4.dp, RoundedCornerShape(12.dp), ambientColor = Color(0x66000000))
                            .clip(RoundedCornerShape(12.dp))
                            .background(ClaySurfaceElevated)
                            .border(
                                1.dp,
                                Brush.verticalGradient(
                                    listOf(Color.White.copy(alpha = 0.30f), Color.White.copy(alpha = 0.12f))
                                ),
                                RoundedCornerShape(12.dp)
                            )
                            .clickable {}
                            .padding(8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Download,
                            contentDescription = "Download PDF",
                            tint = BrandPrimary,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }
    }
}
