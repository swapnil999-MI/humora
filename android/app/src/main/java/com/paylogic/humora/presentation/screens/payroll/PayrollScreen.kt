package com.paylogic.humora.presentation.screens.payroll

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.paylogic.humora.core.theme.*
import com.paylogic.humora.presentation.components.GlassCard
import com.paylogic.humora.presentation.viewmodel.PayrollViewModel

@Composable
fun PayrollScreen(
    viewModel: PayrollViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val latestSlip = uiState.payslips.firstOrNull()

    val netPayText = latestSlip?.formattedNetPay ?: "₹ %,d".format((uiState.compensation.monthlyGross * 0.85).toLong())
    val grossPayText = latestSlip?.formattedGrossPay ?: "₹ %,d".format(uiState.compensation.monthlyGross.toLong())
    val deductionsText = latestSlip?.let { "₹ %,d".format(it.totalDeductions.toLong()) } ?: "₹ %,d".format((uiState.compensation.monthlyGross * 0.15).toLong())

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
                        Text(
                            text = "Next Pay Date: 30 Sep 2026",
                            color = TextMutedDark,
                            fontSize = 12.sp
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Lock,
                                contentDescription = "Secure",
                                tint = EmeraldSuccess,
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "Biometric Encrypted",
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
            GlassCard {
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
                    Button(
                        onClick = {},
                        colors = ButtonDefaults.buttonColors(containerColor = BrandPrimary),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text("Claim", fontWeight = FontWeight.Bold)
                    }
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
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(DarkSurface)
                    .border(1.dp, DarkBorder, RoundedCornerShape(12.dp))
                    .padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = item.monthYear,
                            color = TextPrimaryDark,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "Net: ${item.formattedNetPay} • Status: ${item.status.uppercase()}",
                            color = TextSecondaryDark,
                            fontSize = 12.sp
                        )
                    }

                    IconButton(onClick = {}) {
                        Icon(
                            imageVector = Icons.Default.Download,
                            contentDescription = "Download PDF",
                            tint = BrandPrimary
                        )
                    }
                }
            }
        }
    }
}
