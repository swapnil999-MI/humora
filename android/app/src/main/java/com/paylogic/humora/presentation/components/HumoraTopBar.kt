package com.paylogic.humora.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.paylogic.humora.core.theme.BrandPrimary
import com.paylogic.humora.core.theme.DarkBorder
import com.paylogic.humora.core.theme.DarkSurface
import com.paylogic.humora.core.theme.EmeraldSuccess
import com.paylogic.humora.core.theme.RoseError
import com.paylogic.humora.core.theme.TextMutedDark
import com.paylogic.humora.core.theme.TextPrimaryDark
import com.paylogic.humora.core.theme.TextSecondaryDark

@Composable
fun HumoraTopBar(
    userName: String = "Swapnil",
    userRole: String = "Principal Engineer",
    isInsideGeofence: Boolean = true,
    distanceMeters: Double = 18.0,
    isServerConnected: Boolean = true,
    onOpenSettings: () -> Unit = {},
    onLogout: () -> Unit = {}
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Left: Official Logo + Greeting
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(DarkSurface)
                    .border(1.dp, DarkBorder, RoundedCornerShape(12.dp))
                    .padding(5.dp),
                contentAlignment = Alignment.Center
            ) {
                androidx.compose.foundation.Image(
                    painter = androidx.compose.ui.res.painterResource(id = com.paylogic.humora.R.drawable.ic_peopleos_logo),
                    contentDescription = "PeopleOS Logo",
                    modifier = Modifier.size(28.dp)
                )
            }

            Spacer(modifier = Modifier.width(10.dp))

            Column {
                Text(
                    text = "Welcome back,",
                    color = TextMutedDark,
                    fontSize = 11.sp
                )
                Text(
                    text = userName,
                    color = TextPrimaryDark,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            }
        }

        // Right: Geofence Status + Server Connection Status Button + Logout
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Geofence Radar Status Pill
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(DarkSurface)
                    .border(1.dp, DarkBorder, RoundedCornerShape(20.dp))
                    .padding(horizontal = 9.dp, vertical = 5.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(7.dp)
                        .clip(CircleShape)
                        .background(if (isInsideGeofence) EmeraldSuccess else RoseError)
                )
                Spacer(modifier = Modifier.width(5.dp))
                Text(
                    text = if (isInsideGeofence) "${distanceMeters.toInt()}m" else "Out",
                    color = if (isInsideGeofence) EmeraldSuccess else RoseError,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }

            // Server Indicator / Settings Button
            Box(
                modifier = Modifier
                    .size(34.dp)
                    .clip(CircleShape)
                    .background(DarkSurface)
                    .border(1.dp, if (isServerConnected) EmeraldSuccess.copy(alpha = 0.5f) else DarkBorder, CircleShape)
                    .clickable { onOpenSettings() },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isServerConnected) Icons.Default.CloudDone else Icons.Default.CloudOff,
                    contentDescription = "Backend Settings",
                    tint = if (isServerConnected) EmeraldSuccess else RoseError,
                    modifier = Modifier.size(17.dp)
                )
            }

            // Logout Action Button
            Box(
                modifier = Modifier
                    .size(34.dp)
                    .clip(CircleShape)
                    .background(DarkSurface)
                    .border(1.dp, DarkBorder, CircleShape)
                    .clickable { onLogout() },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Lock,
                    contentDescription = "Sign Out",
                    tint = TextMutedDark,
                    modifier = Modifier.size(17.dp)
                )
            }
        }
    }
}
