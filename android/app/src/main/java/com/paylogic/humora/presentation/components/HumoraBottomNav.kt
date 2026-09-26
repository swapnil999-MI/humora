package com.paylogic.humora.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.paylogic.humora.core.theme.BrandPrimary
import com.paylogic.humora.core.theme.DarkBorder
import com.paylogic.humora.core.theme.DarkSurface
import com.paylogic.humora.core.theme.TextMutedDark
import com.paylogic.humora.core.theme.TextPrimaryDark

enum class HumoraTab(val title: String, val icon: ImageVector) {
    WORKDAY("Workday", Icons.Default.Dashboard),
    ATTENDANCE("Punch", Icons.Default.Fingerprint),
    LEAVES("Leaves", Icons.Default.CalendarMonth),
    WORK("Tasks", Icons.Default.Assignment),
    PAYROLL("Payroll", Icons.Default.AccountBalanceWallet)
}

@Composable
fun HumoraBottomNav(
    selectedTab: HumoraTab,
    onTabSelected: (HumoraTab) -> Unit,
    modifier: Modifier = Modifier
) {
    NavigationBar(
        modifier = modifier
            .fillMaxWidth()
            .height(72.dp)
            .border(1.dp, DarkBorder, RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp))
            .clip(RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)),
        containerColor = DarkSurface,
        tonalElevation = 8.dp
    ) {
        HumoraTab.values().forEach { tab ->
            val isSelected = selectedTab == tab
            NavigationBarItem(
                selected = isSelected,
                onClick = { onTabSelected(tab) },
                icon = {
                    Icon(
                        imageVector = tab.icon,
                        contentDescription = tab.title
                    )
                },
                label = {
                    Text(
                        text = tab.title,
                        fontSize = 11.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                    )
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = BrandPrimary,
                    selectedTextColor = BrandPrimary,
                    unselectedIconColor = TextMutedDark,
                    unselectedTextColor = TextMutedDark,
                    indicatorColor = BrandPrimary.copy(alpha = 0.15f)
                )
            )
        }
    }
}
