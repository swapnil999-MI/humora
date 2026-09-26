package com.paylogic.humora.presentation.screens.work

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.paylogic.humora.core.theme.*
import com.paylogic.humora.data.model.SprintTaskItem
import com.paylogic.humora.presentation.components.GlassCard
import com.paylogic.humora.presentation.viewmodel.AgileTasksViewModel

@Composable
fun AgileTasksScreen(
    viewModel: AgileTasksViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val filterTabs = listOf("All", "To Do", "In Progress", "Done")

    val totalTasks = uiState.allTasks.size
    val doneTasks = uiState.allTasks.count { it.status.equals("done", ignoreCase = true) }
    val progressFraction = if (totalTasks > 0) doneTasks.toFloat() / totalTasks else 0.72f

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

        // 1. SPRINT PROGRESS HERO
        item {
            GlassCard {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "Sprint 14 • Q3 Release",
                                color = TextPrimaryDark,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "${uiState.allTasks.size} assigned backlog items",
                                color = TextMutedDark,
                                fontSize = 12.sp
                            )
                        }
                        Text(
                            text = "${(progressFraction * 100).toInt()}% Complete",
                            color = EmeraldSuccess,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    LinearProgressIndicator(
                        progress = { progressFraction },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(8.dp)
                            .clip(RoundedCornerShape(4.dp)),
                        color = EmeraldSuccess,
                        trackColor = DarkSurfaceVariant
                    )
                }
            }
        }

        // 2. SEGMENTED TABS
        item {
            TabRow(
                selectedTabIndex = uiState.selectedFilterIndex,
                containerColor = DarkSurface,
                contentColor = BrandPrimary,
                indicator = { tabPositions ->
                    TabRowDefaults.SecondaryIndicator(
                        Modifier.tabIndicatorOffset(tabPositions[uiState.selectedFilterIndex]),
                        color = BrandPrimary
                    )
                },
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .border(1.dp, DarkBorder, RoundedCornerShape(12.dp))
            ) {
                filterTabs.forEachIndexed { index, title ->
                    Tab(
                        selected = uiState.selectedFilterIndex == index,
                        onClick = { viewModel.setFilterIndex(index) },
                        text = {
                            Text(
                                text = title,
                                fontWeight = if (uiState.selectedFilterIndex == index) FontWeight.Bold else FontWeight.Normal,
                                color = if (uiState.selectedFilterIndex == index) TextPrimaryDark else TextMutedDark,
                                fontSize = 12.sp
                            )
                        }
                    )
                }
            }
        }

        // 3. TASK LIST
        items(uiState.filteredTasks) { task ->
            AgileTaskDetailCard(
                task = task,
                onTransition = {
                    viewModel.transitionTask(task.id, task.status)
                }
            )
        }
    }
}

@Composable
private fun AgileTaskDetailCard(
    task: SprintTaskItem,
    onTransition: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(DarkSurface)
            .border(1.dp, DarkBorder, RoundedCornerShape(14.dp))
            .padding(16.dp)
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = task.issueKey,
                    color = BrandPrimary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )

                val priorityColor = when (task.priority.lowercase()) {
                    "highest", "high" -> RoseError
                    "lowest", "low" -> EmeraldSuccess
                    else -> AmberWarning
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(priorityColor.copy(alpha = 0.15f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = task.priority.uppercase(),
                        color = priorityColor,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = task.title,
                color = TextPrimaryDark,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold
            )

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Status pill & button
                val statusText = task.status.replace("_", " ").uppercase()
                val (btnLabel, btnIcon) = when (task.status.lowercase()) {
                    "todo" -> Pair("Start", Icons.Default.PlayArrow)
                    "in_progress" -> Pair("Done", Icons.Default.Check)
                    else -> Pair("Reopen", Icons.Default.PlayArrow)
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Timer,
                        contentDescription = "Time",
                        tint = TextMutedDark,
                        modifier = Modifier.size(15.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = statusText,
                        color = if (task.status.equals("done", ignoreCase = true)) EmeraldSuccess else TextSecondaryDark,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Button(
                    onClick = onTransition,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (task.status.equals("in_progress", ignoreCase = true)) EmeraldSuccess else DarkSurfaceVariant
                    ),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                    modifier = Modifier.height(30.dp)
                ) {
                    Icon(
                        imageVector = btnIcon,
                        contentDescription = btnLabel,
                        tint = TextPrimaryDark,
                        modifier = Modifier.size(13.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(btnLabel, color = TextPrimaryDark, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
