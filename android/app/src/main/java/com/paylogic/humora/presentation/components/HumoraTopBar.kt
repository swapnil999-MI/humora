package com.paylogic.humora.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.paylogic.humora.core.theme.*

@Composable
fun HumoraTopBar(
    userName: String = "",
    userRole: String = "",
    /** Nearest-office geofence check; null while unknown. */
    geofence: com.paylogic.humora.core.location.GeofenceStatus? = null,
    isServerConnected: Boolean = true,
    isAdmin: Boolean = false,
    onOpenProfile: () -> Unit = {},
    onOpenSettings: () -> Unit = {},
    onLogout: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val shape = RoundedCornerShape(24.dp)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(horizontal = 16.dp, vertical = 6.dp)
            .clayEffect(
                shape = shape,
                elevation = 8.dp,
                borderWidth = 1.2.dp,
                borderBrush = ClayBorderGradient,
                backgroundBrush = ClaySurfaceGradient
            )
            .padding(horizontal = 14.dp, vertical = 10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Left: Official Logo + Greeting (Clickable to open Profile)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clip(RoundedCornerShape(14.dp))
                    .clickable { onOpenProfile() }
                    .padding(end = 4.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .shadow(4.dp, RoundedCornerShape(12.dp), ambientColor = Color(0x66000000))
                        .clip(RoundedCornerShape(12.dp))
                        .background(
                            Brush.linearGradient(
                                listOf(Color(0xFF261D12), Color(0xFF16120D))
                            )
                        )
                        .border(
                            1.dp,
                            Brush.linearGradient(
                                listOf(Color(0xFFF59E0B).copy(alpha = 0.50f), Color(0xFFFBBF24).copy(alpha = 0.20f))
                            ),
                            RoundedCornerShape(12.dp)
                        )
                        .padding(6.dp),
                    contentAlignment = Alignment.Center
                ) {
                    androidx.compose.foundation.Image(
                        painter = androidx.compose.ui.res.painterResource(id = com.paylogic.humora.R.drawable.ic_peopleos_logo),
                        contentDescription = "Humora Logo",
                        modifier = Modifier.size(26.dp)
                    )
                }

                Spacer(modifier = Modifier.width(10.dp))

                Column {
                    Text(
                        text = if (isAdmin) "Enterprise Admin" else "Welcome back,",
                        color = TextMutedDark,
                        fontSize = 11.sp
                    )
                    Text(
                        text = userName,
                        color = TextPrimaryDark,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )
                }
            }

            // Right: Role / Geofence Status + Server Connection Status Button + Logout
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (isAdmin) {
                    // Admin Management Console Badge
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .shadow(4.dp, RoundedCornerShape(20.dp), ambientColor = Color(0x66000000))
                            .clip(RoundedCornerShape(20.dp))
                            .background(ClaySurfaceElevated)
                            .border(1.dp, BrandPrimary.copy(alpha = 0.5f), RoundedCornerShape(20.dp))
                            .padding(horizontal = 9.dp, vertical = 5.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.AdminPanelSettings,
                            contentDescription = "Admin",
                            tint = BrandPrimary,
                            modifier = Modifier.size(13.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Admin Hub",
                            color = BrandPrimary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                } else {
                    // Geofence status pill: real nearest-office check, grey while unknown
                    val fenceColor = when (geofence?.isInside) { true -> EmeraldSuccess; false -> RoseError; null -> TextMutedDark }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .shadow(4.dp, RoundedCornerShape(20.dp), ambientColor = Color(0x66000000))
                            .clip(RoundedCornerShape(20.dp))
                            .background(ClaySurfaceElevated)
                            .border(1.dp, fenceColor.copy(alpha = 0.5f), RoundedCornerShape(20.dp))
                            .padding(horizontal = 10.dp, vertical = 5.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(7.dp)
                                .clip(CircleShape)
                                .background(fenceColor)
                        )
                        Spacer(modifier = Modifier.width(5.dp))
                        Text(
                            text = when (geofence?.isInside) { true -> "In office"; false -> "${geofence.distanceMeters.toInt()}m away"; null -> "—" },
                            color = fenceColor,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                // Profile Action Button
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .shadow(4.dp, CircleShape, ambientColor = Color(0x66000000))
                        .clip(CircleShape)
                        .background(ClaySurfaceElevated)
                        .border(1.dp, BrandPrimary.copy(alpha = 0.45f), CircleShape)
                        .clickable { onOpenProfile() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = "My Profile",
                        tint = BrandPrimary,
                        modifier = Modifier.size(17.dp)
                    )
                }

                // Server Indicator / Settings Button
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .shadow(4.dp, CircleShape, ambientColor = Color(0x66000000))
                        .clip(CircleShape)
                        .background(ClaySurfaceElevated)
                        .border(1.dp, if (isServerConnected) EmeraldSuccess.copy(alpha = 0.5f) else AmberWarning.copy(alpha = 0.5f), CircleShape)
                        .clickable { onOpenSettings() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (isServerConnected) Icons.Default.CloudDone else Icons.Default.CloudOff,
                        contentDescription = "Backend Settings",
                        tint = if (isServerConnected) EmeraldSuccess else AmberWarning,
                        modifier = Modifier.size(17.dp)
                    )
                }

                // Logout Action Button
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .shadow(4.dp, CircleShape, ambientColor = Color(0x66000000))
                        .clip(CircleShape)
                        .background(ClaySurfaceElevated)
                        .border(1.dp, Color.White.copy(alpha = 0.15f), CircleShape)
                        .clickable { onLogout() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = "Sign Out",
                        tint = TextMutedDark,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }
}
