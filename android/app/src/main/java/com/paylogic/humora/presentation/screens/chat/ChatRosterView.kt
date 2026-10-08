package com.paylogic.humora.presentation.screens.chat

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.ripple
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.paylogic.humora.core.theme.*
import com.paylogic.humora.data.model.ChatRow
import com.paylogic.humora.pulse.Tick
import com.paylogic.humora.presentation.components.ClayDebossedBox
import com.paylogic.humora.presentation.viewmodel.ChatFilter
import com.paylogic.humora.presentation.viewmodel.ChatUiState

/**
 * ChatRosterView — WhatsApp-style list of the user's end-to-end encrypted conversations: search,
 * filter pills, unread badges, live typing, real delivery ticks, and a button to start a new chat.
 */
@Composable
fun ChatRosterView(
    uiState: ChatUiState,
    onSearchChange: (String) -> Unit,
    onFilterChange: (ChatFilter) -> Unit,
    onConversationClick: (id: String) -> Unit,
    onNewChat: () -> Unit,
    onQrScanClick: () -> Unit = {}
) {
    var isSearchVisible by remember { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxSize().background(DarkBackground)) {
        Column(modifier = Modifier.fillMaxSize()) {
            WhatsAppTopBar(
                totalUnread = uiState.totalUnread,
                onSearchClick = {
                    isSearchVisible = !isSearchVisible
                    if (!isSearchVisible) onSearchChange("")
                },
                onCameraClick = onQrScanClick
            )

            AnimatedVisibility(visible = !uiState.starting && !uiState.connected) {
                Text(
                    "Connecting… messages will send when you are back online",
                    color = Color(0xFFFFD279), fontSize = 12.sp,
                    modifier = Modifier.fillMaxWidth().background(Color(0xFF182229)).padding(horizontal = 16.dp, vertical = 6.dp)
                )
            }

            AnimatedVisibility(
                visible = isSearchVisible || uiState.searchQuery.isNotEmpty(),
                enter = expandVertically() + fadeIn(),
                exit = shrinkVertically() + fadeOut()
            ) {
                Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
                    ClayDebossedBox(
                        modifier = Modifier.fillMaxWidth(),
                        cornerRadius = 24.dp,
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                            Icon(Icons.Default.Search, contentDescription = "Search", tint = TextMutedDark, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(10.dp))
                            BasicTextField(
                                value = uiState.searchQuery,
                                onValueChange = onSearchChange,
                                singleLine = true,
                                textStyle = TextStyle(color = TextPrimaryDark, fontSize = 14.sp),
                                cursorBrush = SolidColor(AmberWarning),
                                decorationBox = { inner ->
                                    if (uiState.searchQuery.isEmpty()) Text("Search chats…", color = TextMutedDark, fontSize = 14.sp)
                                    inner()
                                },
                                modifier = Modifier.weight(1f)
                            )
                            if (uiState.searchQuery.isNotEmpty()) {
                                IconButton(onClick = { onSearchChange("") }, modifier = Modifier.size(20.dp)) {
                                    Icon(Icons.Default.Close, contentDescription = "Clear", tint = TextMutedDark, modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ChatFilter.entries.forEach { filter ->
                    WhatsAppFilterChip(label = filter.label, isActive = uiState.activeFilter == filter, onClick = { onFilterChange(filter) })
                }
            }

            Spacer(Modifier.height(4.dp))

            val rows = uiState.filteredRows
            if (rows.isEmpty()) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
                        if (uiState.starting) {
                            CircularProgressIndicator(color = Color(0xFF00A884), strokeWidth = 2.dp, modifier = Modifier.size(32.dp))
                            Spacer(Modifier.height(16.dp))
                            Text("Setting up encrypted chat…", color = TextMutedDark, fontSize = 13.sp)
                        } else {
                            Box(
                                Modifier.size(72.dp).clip(CircleShape).background(ClaySurfaceElevated).border(1.dp, Color.White.copy(alpha = 0.08f), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = null, tint = TextMutedDark, modifier = Modifier.size(34.dp))
                            }
                            Spacer(Modifier.height(16.dp))
                            Text(
                                if (uiState.searchQuery.isNotEmpty()) "No chats matching \"${uiState.searchQuery}\"" else "No chats yet",
                                color = TextPrimaryDark, fontSize = 15.sp, fontWeight = FontWeight.SemiBold
                            )
                            Spacer(Modifier.height(6.dp))
                            Text("Tap the message button to start a conversation", color = TextMutedDark, fontSize = 13.sp)
                        }
                    }
                }
            } else {
                LazyColumn(modifier = Modifier.weight(1f), contentPadding = PaddingValues(bottom = 96.dp)) {
                    items(rows, key = { it.id }) { row ->
                        ConversationRow(row = row, onClick = { onConversationClick(row.id) })
                        HorizontalDivider(modifier = Modifier.padding(start = 82.dp), thickness = 0.6.dp, color = Color.White.copy(alpha = 0.05f))
                    }
                }
            }
        }

        if (!uiState.starting) {
            WhatsAppFAB(modifier = Modifier.align(Alignment.BottomEnd).padding(end = 18.dp, bottom = 86.dp), onClick = onNewChat)
        }
    }
}

// ─── WhatsApp Top App Bar ───────────────────────────────────────────────────

@Composable
private fun WhatsAppTopBar(
    totalUnread: Int,
    onSearchClick: () -> Unit,
    onCameraClick: () -> Unit = {}
) {
    var showMenu by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(DarkBackground)
            .statusBarsPadding()
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // Pulse Logo + Unread Badge
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Pulse",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimaryDark,
                    letterSpacing = 0.3.sp
                )
                if (totalUnread > 0) {
                    Box(
                        modifier = Modifier
                            .background(AmberWarning, CircleShape)
                            .padding(horizontal = 7.dp, vertical = 2.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (totalUnread > 99) "99+" else "$totalUnread",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.Black
                        )
                    }
                }
            }

            // Right Action Icons (Camera, Search, More Options)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                IconButton(onClick = onCameraClick) {
                    Icon(
                        imageVector = Icons.Default.CameraAlt,
                        contentDescription = "Scan Web QR / Camera",
                        tint = TextSecondaryDark,
                        modifier = Modifier.size(22.dp)
                    )
                }
                IconButton(onClick = onSearchClick) {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = "Search",
                        tint = TextSecondaryDark,
                        modifier = Modifier.size(22.dp)
                    )
                }
                Box {
                    IconButton(onClick = { showMenu = true }) {
                        Icon(
                            imageVector = Icons.Default.MoreVert,
                            contentDescription = "More",
                            tint = TextSecondaryDark,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    DropdownMenu(
                        expanded = showMenu,
                        onDismissRequest = { showMenu = false },
                        modifier = Modifier
                            .background(DarkSurfaceVariant)
                            .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(8.dp))
                    ) {
                        DropdownMenuItem(
                            text = { Text("Linked devices", color = TextPrimaryDark, fontSize = 14.sp) },
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Default.QrCodeScanner,
                                    contentDescription = null,
                                    tint = EmeraldSuccess,
                                    modifier = Modifier.size(18.dp)
                                )
                            },
                            onClick = {
                                showMenu = false
                                onCameraClick()
                            }
                        )
                    }
                }
            }
        }
    }
}

// ─── WhatsApp Filter Chip ───────────────────────────────────────────────────

@Composable
private fun WhatsAppFilterChip(
    label: String,
    isActive: Boolean,
    onClick: () -> Unit
) {
    val shape = RoundedCornerShape(20.dp)
    val bg = if (isActive) Color(0xFF0F3E36) else ClaySurfaceElevated.copy(alpha = 0.7f)
    val borderColor = if (isActive) Color(0xFF00A884) else Color.White.copy(alpha = 0.08f)
    val textColor = if (isActive) Color(0xFF00A884) else TextMutedDark

    Box(
        modifier = Modifier
            .clip(shape)
            .background(bg)
            .border(1.dp, borderColor, shape)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = ripple(bounded = true, color = Color.White.copy(alpha = 0.2f)),
                onClick = onClick
            )
            .padding(horizontal = 14.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            color = textColor,
            fontSize = 12.sp,
            fontWeight = if (isActive) FontWeight.SemiBold else FontWeight.Normal
        )
    }
}

// ─── Conversation Row ───────────────────────────────────────────────────────

@Composable
private fun ConversationRow(row: ChatRow, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = ripple(bounded = true, color = Color.White.copy(alpha = 0.1f)),
                onClick = onClick
            )
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Avatar(row.title, row.isGroup, 52)
        Spacer(Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(row.title, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = TextPrimaryDark, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                Spacer(Modifier.width(8.dp))
                Text(
                    row.timeLabel, fontSize = 12.sp,
                    color = if (row.unread > 0) Color(0xFF00A884) else TextMutedDark,
                    fontWeight = if (row.unread > 0) FontWeight.SemiBold else FontWeight.Normal
                )
            }
            Spacer(Modifier.height(4.dp))
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                if (row.typing == null) {
                    row.lastTick?.let { tick ->
                        val (icon, tint) = when (tick) {
                            Tick.PENDING -> Icons.Default.Schedule to TextMutedDark
                            Tick.FAILED -> Icons.Default.ErrorOutline to Color(0xFFF15C6D)
                            Tick.SENT -> Icons.Default.Done to TextMutedDark
                            Tick.DELIVERED -> Icons.Default.DoneAll to TextMutedDark
                            Tick.READ -> Icons.Default.DoneAll to Color(0xFF53BDEB)
                        }
                        Icon(icon, contentDescription = tick.name.lowercase(), tint = tint, modifier = Modifier.size(16.dp).padding(end = 3.dp))
                    }
                }
                Text(
                    row.typing ?: row.snippet.ifBlank { "No messages yet" },
                    fontSize = 13.5.sp,
                    color = if (row.typing != null) Color(0xFF00A884) else TextMutedDark,
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                if (row.unread > 0) {
                    Box(
                        Modifier.padding(start = 8.dp).defaultMinSize(minWidth = 20.dp, minHeight = 20.dp).clip(CircleShape).background(Color(0xFF00A884)).padding(horizontal = 6.dp, vertical = 2.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(if (row.unread > 99) "99+" else "${row.unread}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.Black)
                    }
                }
            }
        }
    }
}

// ─── WhatsApp Floating Action Button ────────────────────────────────────────

@Composable
private fun WhatsAppFAB(
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val fabShape = RoundedCornerShape(16.dp)

    Box(
        modifier = modifier
            .size(56.dp)
            .shadow(12.dp, fabShape, ambientColor = Color(0x66000000), spotColor = Color(0xFF00A884))
            .clip(fabShape)
            .background(
                Brush.linearGradient(
                    listOf(Color(0xFF00A884), Color(0xFF008069))
                )
            )
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = ripple(bounded = true, color = Color.White.copy(alpha = 0.3f)),
                onClick = onClick
            ),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.AutoMirrored.Filled.Chat,
            contentDescription = "New Chat",
            tint = Color.White,
            modifier = Modifier.size(24.dp)
        )
    }
}
