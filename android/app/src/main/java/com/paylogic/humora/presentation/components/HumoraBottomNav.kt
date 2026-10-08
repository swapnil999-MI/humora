package com.paylogic.humora.presentation.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Assignment
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.paylogic.humora.core.theme.*

enum class HumoraTab(val title: String, val icon: ImageVector) {
    WORKDAY("Workday", Icons.Default.Dashboard),
    ATTENDANCE("Punch", Icons.Default.Fingerprint),
    LEAVES("Leaves", Icons.Default.CalendarMonth),
    WORK("Tasks", Icons.AutoMirrored.Filled.Assignment),
    PAYROLL("Payroll", Icons.Default.AccountBalanceWallet),
    PULSE("Pulse", Icons.AutoMirrored.Filled.Chat),
    ADMIN("Capacity", Icons.Default.AdminPanelSettings),
    PROFILE("Profile", Icons.Default.Person)
}

/**
 * Ultra-Premium Tactile 3D Clay Floating Dock.
 * Custom clay extrusion with inflated 3D active pills and haptic-ready states.
 */
@Composable
fun HumoraBottomNav(
    selectedTab: HumoraTab,
    onTabSelected: (HumoraTab) -> Unit,
    isAdmin: Boolean = false,
    modifier: Modifier = Modifier
) {
    val visibleTabs = if (isAdmin) {
        listOf(HumoraTab.ADMIN, HumoraTab.WORK, HumoraTab.PULSE, HumoraTab.PROFILE)
    } else {
        listOf(
            HumoraTab.WORKDAY,
            HumoraTab.ATTENDANCE,
            HumoraTab.LEAVES,
            HumoraTab.WORK,
            HumoraTab.PAYROLL,
            HumoraTab.PULSE,
            HumoraTab.PROFILE
        )
    }
    val shape = RoundedCornerShape(32.dp)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 14.dp, vertical = 8.dp)
            .clayEffect(
                shape = shape,
                elevation = 16.dp,
                borderWidth = 1.3.dp,
                borderBrush = ClayBorderGradient,
                backgroundBrush = ClaySurfaceGradient
            )
            .padding(horizontal = 6.dp, vertical = 6.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(58.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            visibleTabs.forEach { tab ->
                val isSelected = selectedTab == tab
                val iconColor by animateColorAsState(
                    targetValue = if (isSelected) Color.White else TextMutedDark,
                    animationSpec = tween(200)
                )
                val pillElevation by animateDpAsState(
                    targetValue = if (isSelected) 6.dp else 0.dp,
                    animationSpec = tween(200)
                )

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .padding(horizontal = 2.dp, vertical = 2.dp)
                        .then(
                            if (isSelected) {
                                Modifier
                                    .shadow(
                                        elevation = pillElevation,
                                        shape = RoundedCornerShape(22.dp),
                                        ambientColor = Color(0x66000000),
                                        spotColor = Color(0x8A000000)
                                    )
                                    .clip(RoundedCornerShape(22.dp))
                                    .background(ClayAccentGradient)
                                    .border(
                                        1.2.dp,
                                        Brush.verticalGradient(
                                            listOf(
                                                Color.White.copy(alpha = 0.45f),
                                                Color.White.copy(alpha = 0.16f)
                                            )
                                        ),
                                        RoundedCornerShape(22.dp)
                                    )
                            } else {
                                Modifier
                                    .clip(RoundedCornerShape(22.dp))
                            }
                        )
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null
                        ) { onTabSelected(tab) },
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = tab.icon,
                            contentDescription = tab.title,
                            tint = iconColor,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = tab.title,
                            color = iconColor,
                            fontSize = 9.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                        )
                    }
                }
            }
        }
    }
}
