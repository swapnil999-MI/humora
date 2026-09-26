package com.paylogic.humora.presentation.screens.main

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.paylogic.humora.core.theme.DarkBackground
import com.paylogic.humora.presentation.components.BackendSettingsDialog
import com.paylogic.humora.presentation.components.HumoraBottomNav
import com.paylogic.humora.presentation.components.HumoraTab
import com.paylogic.humora.presentation.components.HumoraTopBar
import com.paylogic.humora.presentation.screens.attendance.AttendanceDeskScreen
import com.paylogic.humora.presentation.screens.leaves.LeavesScreen
import com.paylogic.humora.presentation.screens.payroll.PayrollScreen
import com.paylogic.humora.presentation.screens.work.AgileTasksScreen
import com.paylogic.humora.presentation.screens.workday.WorkdayScreen
import com.paylogic.humora.presentation.viewmodel.AuthViewModel

@Composable
fun MainContainerScreen(
    authViewModel: AuthViewModel = viewModel(),
    onLogout: () -> Unit = {}
) {
    var currentTab by remember { mutableStateOf(HumoraTab.WORKDAY) }
    var showSettingsDialog by remember { mutableStateOf(false) }
    val authState by authViewModel.uiState.collectAsState()

    Scaffold(
        bottomBar = {
            HumoraBottomNav(
                selectedTab = currentTab,
                onTabSelected = { currentTab = it }
            )
        },
        containerColor = DarkBackground
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(DarkBackground)
        ) {
            // Persistent Enterprise Top Bar with Live Session & Server Status
            HumoraTopBar(
                userName = authState.userName,
                userRole = authState.userRole,
                isInsideGeofence = true,
                distanceMeters = 18.0,
                isServerConnected = authState.isServerConnected,
                onOpenSettings = { showSettingsDialog = true },
                onLogout = onLogout
            )

            // Dynamic Screen Content
            Box(modifier = Modifier.fillMaxSize()) {
                when (currentTab) {
                    HumoraTab.WORKDAY -> WorkdayScreen(
                        onNavigateToAttendance = { currentTab = HumoraTab.ATTENDANCE },
                        onNavigateToLeaves = { currentTab = HumoraTab.LEAVES },
                        onNavigateToTasks = { currentTab = HumoraTab.WORK }
                    )
                    HumoraTab.ATTENDANCE -> AttendanceDeskScreen()
                    HumoraTab.LEAVES -> LeavesScreen()
                    HumoraTab.WORK -> AgileTasksScreen()
                    HumoraTab.PAYROLL -> PayrollScreen()
                }
            }

            if (showSettingsDialog) {
                BackendSettingsDialog(
                    authViewModel = authViewModel,
                    uiState = authState,
                    onDismiss = { showSettingsDialog = false }
                )
            }
        }
    }
}
