package com.paylogic.humora.presentation.screens.work

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Timer
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
import com.paylogic.humora.data.model.SprintTaskItem
import com.paylogic.humora.presentation.components.ClayCard
import com.paylogic.humora.presentation.viewmodel.AgileTasksViewModel

@Composable
fun AgileTasksScreen(
    viewModel: AgileTasksViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val filterTabs = listOf("All", "To Do", "In Progress", "Done")

    // Bug #2 Fix: Show full-screen loader while data is loading
    if (uiState.isLoading) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(
                color = BrandPrimary,
                strokeWidth = 3.dp,
                modifier = Modifier.size(48.dp)
            )
        }
        return
    }

    val totalTasks = uiState.allTasks.size
    val doneTasks = uiState.allTasks.count { it.status.equals("done", ignoreCase = true) }
    // Bug #3 Fix: Use 0f instead of 0.72f — don't show fake progress when no tasks
    val progressFraction = if (totalTasks > 0) doneTasks.toFloat() / totalTasks else 0f

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(bottom = 90.dp)
    ) {
        // Bug #4 Fix: Always emit the banner item; use AnimatedVisibility instead of
        // conditionally inserting/removing at index 0 to prevent list recomposition flicker.
        item {
            AnimatedVisibility(
                visible = uiState.actionMessage != null,
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .shadow(6.dp, RoundedCornerShape(16.dp), ambientColor = Color(0x66000000))
                        .clip(RoundedCornerShape(16.dp))
                        .background(ClaySurfaceElevated)
                        .border(1.dp, EmeraldSuccess.copy(alpha = 0.40f), RoundedCornerShape(16.dp))
                        .padding(horizontal = 16.dp, vertical = 12.dp),
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
            } // end AnimatedVisibility
        } // end item

        // 1. SPRINT PROGRESS HERO (3D Clay Card)
        item {
            ClayCard(
                cornerRadius = 24.dp,
                elevation = 12.dp
            ) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(8.dp)
                                        .clip(CircleShape)
                                        .background(BrandPrimary)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "ACTIVE SPRINT",
                                    color = BrandPrimary,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    letterSpacing = 1.sp
                                )
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = uiState.sprintName.ifBlank { "Active Sprint" },
                                color = TextPrimaryDark,
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "${uiState.allTasks.size} assigned backlog items",
                                color = TextMutedDark,
                                fontSize = 12.sp
                            )
                        }

                        // 3D Inflated Percentage Pill
                        Box(
                            modifier = Modifier
                                .shadow(6.dp, RoundedCornerShape(16.dp), ambientColor = Color(0x66000000))
                                .clip(RoundedCornerShape(16.dp))
                                .background(ClaySuccessGradient)
                                .border(
                                    1.dp,
                                    Brush.verticalGradient(
                                        listOf(Color.White.copy(alpha = 0.40f), Color.White.copy(alpha = 0.16f))
                                    ),
                                    RoundedCornerShape(16.dp)
                                )
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = "${(progressFraction * 100).toInt()}% Done",
                                color = Color.White,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Debossed Carved Progress Track with 3D Fill
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(10.dp)
                            .shadow(4.dp, RoundedCornerShape(5.dp), ambientColor = Color(0x66000000))
                            .clip(RoundedCornerShape(5.dp))
                            .background(ClaySurfacePressed)
                            .border(
                                1.dp,
                                Brush.verticalGradient(
                                    listOf(Color.Black.copy(alpha = 0.45f), Color.White.copy(alpha = 0.10f))
                                ),
                                RoundedCornerShape(5.dp)
                            )
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxHeight()
                                .fillMaxWidth(progressFraction)
                                .clip(RoundedCornerShape(5.dp))
                                .background(ClaySuccessGradient)
                        )
                    }
                }
            }
        }

        // 2. 3D CLAY SEGMENTED SLIDER (Debossed track with inflated active button)
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(6.dp, RoundedCornerShape(18.dp), ambientColor = Color(0x66000000))
                    .clip(RoundedCornerShape(18.dp))
                    .background(ClaySurfacePressed)
                    .border(
                        1.dp,
                        Brush.verticalGradient(
                            listOf(Color.Black.copy(alpha = 0.50f), Color.White.copy(alpha = 0.10f))
                        ),
                        RoundedCornerShape(18.dp)
                    )
                    .padding(4.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                filterTabs.forEachIndexed { index, title ->
                    val isSelected = uiState.selectedFilterIndex == index
                    val tabModifier = if (isSelected) {
                        Modifier
                            .shadow(6.dp, RoundedCornerShape(14.dp), ambientColor = Color(0x66000000))
                            .background(ClayAccentGradient)
                            .border(
                                1.dp,
                                Brush.verticalGradient(
                                    listOf(Color.White.copy(alpha = 0.40f), Color.White.copy(alpha = 0.16f))
                                ),
                                RoundedCornerShape(14.dp)
                            )
                    } else {
                        Modifier
                    }

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(14.dp))
                            .then(tabModifier)
                            .clickable { viewModel.setFilterIndex(index) }
                            .padding(vertical = 9.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = title,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) Color.White else TextMutedDark,
                            fontSize = 11.sp,
                            maxLines = 1
                        )
                    }
                }
            }
        }

        // 3. TASK LIST (Tactile 3D Clay Cards)
        if (uiState.filteredTasks.isEmpty()) {
            // Empty state — no hardcoded tasks, show a real message
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (uiState.allTasks.isEmpty())
                            "No tasks assigned yet. Check back when your sprint is planned."
                        else
                            "No tasks match the selected filter.",
                        color = TextMutedDark,
                        fontSize = 13.sp,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }
            }
        } else {
            items(uiState.filteredTasks) { task ->
                AgileTaskDetailCard(
                    task = task,
                    isUpdating = uiState.isUpdating,
                    onTransition = {
                        viewModel.transitionTask(task.id, task.status)
                    }
                )
            }
        }
    }
}

@Composable
private fun AgileTaskDetailCard(
    task: SprintTaskItem,
    isUpdating: Boolean,
    onTransition: () -> Unit
) {
    val isDone = task.status.equals("done", ignoreCase = true)
    val inProgress = task.status.equals("in_progress", ignoreCase = true)

    val priorityColor = when (task.priority.lowercase()) {
        "highest", "high" -> RoseError
        "lowest", "low" -> EmeraldSuccess
        else -> AmberWarning
    }

    ClayCard(
        cornerRadius = 22.dp,
        elevation = 8.dp,
        contentPadding = PaddingValues(16.dp)
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Issue Key Badge
                Box(
                    modifier = Modifier
                        .shadow(3.dp, RoundedCornerShape(8.dp), ambientColor = Color(0x66000000))
                        .clip(RoundedCornerShape(8.dp))
                        .background(ClaySurfaceElevated)
                        .border(1.dp, BrandPrimary.copy(alpha = 0.45f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                ) {
                    Text(
                        text = task.issueKey,
                        color = BrandPrimary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                // Priority Badge
                Box(
                    modifier = Modifier
                        .shadow(3.dp, RoundedCornerShape(8.dp), ambientColor = Color(0x66000000))
                        .clip(RoundedCornerShape(8.dp))
                        .background(ClaySurfaceElevated)
                        .border(1.dp, priorityColor.copy(alpha = 0.50f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                ) {
                    Text(
                        text = task.priority.uppercase(),
                        color = priorityColor,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = task.title,
                color = TextPrimaryDark,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold
            )

            Spacer(modifier = Modifier.height(14.dp))

            // Subtle Debossed Divider
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(Color.Black.copy(alpha = 0.35f))
            )

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Status indicator
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
                    Spacer(modifier = Modifier.width(5.dp))
                    Text(
                        text = statusText,
                        color = if (isDone) EmeraldSuccess else if (inProgress) BrandPrimary else TextSecondaryDark,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                // Inflated 3D Clay Action Button
                Box(
                    modifier = Modifier
                        .shadow(6.dp, RoundedCornerShape(12.dp), ambientColor = Color(0x66000000))
                        .clip(RoundedCornerShape(12.dp))
                        .background(
                            if (isUpdating) ClayDarkButtonGradient
                            else if (inProgress) ClaySuccessGradient
                            else ClayAccentGradient
                        )
                        .border(
                            1.dp,
                            Brush.verticalGradient(
                                listOf(Color.White.copy(alpha = 0.40f), Color.White.copy(alpha = 0.16f))
                            ),
                            RoundedCornerShape(12.dp)
                        )
                        .then(if (!isUpdating) Modifier.clickable { onTransition() } else Modifier)
                        .padding(horizontal = 14.dp, vertical = 6.dp)
                ) {
                    if (isUpdating) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(13.dp),
                            color = Color.White,
                            strokeWidth = 1.5.dp
                        )
                    } else {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = btnIcon,
                                contentDescription = btnLabel,
                                tint = Color.White,
                                modifier = Modifier.size(13.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = btnLabel,
                                color = Color.White,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}
