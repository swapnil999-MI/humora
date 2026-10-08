package com.paylogic.humora.presentation.screens.main

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.viewmodel.compose.viewModel
import com.paylogic.humora.presentation.components.BackendSettingsDialog
import com.paylogic.humora.presentation.components.GlassMeshBackground
import com.paylogic.humora.presentation.components.HumoraBottomNav
import com.paylogic.humora.presentation.components.HumoraTab
import com.paylogic.humora.presentation.components.HumoraTopBar
import com.paylogic.humora.presentation.components.WebQRScannerSheet
import com.paylogic.humora.presentation.screens.admin.AdminCapacityScreen
import com.paylogic.humora.presentation.screens.admin.AdminManagementScreen
import com.paylogic.humora.presentation.screens.attendance.AttendanceDeskScreen
import com.paylogic.humora.presentation.screens.leaves.LeavesScreen
import com.paylogic.humora.presentation.screens.payroll.PayrollScreen
import com.paylogic.humora.presentation.screens.profile.UserProfileScreen
import com.paylogic.humora.presentation.screens.work.AgileTasksScreen
import com.paylogic.humora.presentation.screens.chat.PulseChatScreen
import com.paylogic.humora.presentation.screens.workday.WorkdayScreen
import com.paylogic.humora.presentation.viewmodel.AuthViewModel

@Composable
fun MainContainerScreen(
    authViewModel: AuthViewModel = viewModel(),
    onLogout: () -> Unit = {}
) {
    val authState by authViewModel.uiState.collectAsState()
    var currentTab by remember(authState.isAdmin) {
        mutableStateOf(if (authState.isAdmin) HumoraTab.ADMIN else HumoraTab.WORKDAY)
    }
    var showSettingsDialog by remember { mutableStateOf(false) }
    var showQrScannerSheet by remember { mutableStateOf(false) }

    // A tapped message notification switches to the chat tab (the chat screen opens the conversation).
    val openRequest by com.paylogic.humora.HumoraApp.instance.pulseService.openRequests.collectAsState()
    LaunchedEffect(openRequest) {
        if (openRequest != null) currentTab = HumoraTab.PULSE
    }

    // Real geofence status for the top bar: load the offices and check the last known location once.
    val attendanceRepo = com.paylogic.humora.HumoraApp.instance.attendanceRepository
    val attendanceGeofence by attendanceRepo.geofence.collectAsState()
    LaunchedEffect(Unit) {
        attendanceRepo.fetchOfficeLocations()
        attendanceRepo.checkGeofence(
            com.paylogic.humora.core.location.LocationProvider.getLastKnownLocation(com.paylogic.humora.HumoraApp.instance)
        )
    }

    LaunchedEffect(authState.isAdmin) {
        if (authState.isAdmin) {
            val employeeOnlyTabs = listOf(HumoraTab.WORKDAY, HumoraTab.ATTENDANCE, HumoraTab.LEAVES, HumoraTab.PAYROLL)
            if (currentTab in employeeOnlyTabs) {
                currentTab = HumoraTab.ADMIN
            }
        }
    }

    GlassMeshBackground {
        Scaffold(
            bottomBar = {
                HumoraBottomNav(
                    selectedTab = currentTab,
                    onTabSelected = { currentTab = it },
                    isAdmin = authState.isAdmin
                )
            },
            containerColor = Color.Transparent
        ) { innerPadding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .consumeWindowInsets(innerPadding)
            ) {
                // Persistent Enterprise Top Bar with Live Session & Server Status (Hidden in Pulse Chat and Profile)
                if (currentTab != HumoraTab.PULSE && currentTab != HumoraTab.PROFILE) {
                    HumoraTopBar(
                        userName = authState.userName,
                        userRole = authState.userRole,
                        geofence = attendanceGeofence,
                        isServerConnected = authState.isServerConnected,
                        isAdmin = authState.isAdmin,
                        onOpenProfile = { currentTab = HumoraTab.PROFILE },
                        onOpenSettings = { showSettingsDialog = true },
                        onLogout = onLogout
                    )
                }

                // Dynamic Screen Content
                Box(modifier = Modifier.fillMaxSize()) {
                    when (currentTab) {
                        HumoraTab.WORKDAY -> {
                            if (!authState.isAdmin) {
                                WorkdayScreen(
                                    onNavigateToAttendance = { currentTab = HumoraTab.ATTENDANCE },
                                    onNavigateToLeaves = { currentTab = HumoraTab.LEAVES },
                                    onNavigateToTasks = { currentTab = HumoraTab.WORK }
                                )
                            } else {
                                AdminCapacityScreen()
                            }
                        }
                        HumoraTab.ATTENDANCE -> {
                            if (!authState.isAdmin) AttendanceDeskScreen() else AdminCapacityScreen()
                        }
                        HumoraTab.LEAVES -> {
                            if (!authState.isAdmin) LeavesScreen() else AdminCapacityScreen()
                        }
                        HumoraTab.PAYROLL -> {
                            if (!authState.isAdmin) PayrollScreen() else AdminCapacityScreen()
                        }
                        HumoraTab.WORK -> AgileTasksScreen()
                        HumoraTab.PULSE -> PulseChatScreen(
                            onOpenQrScanner = { showQrScannerSheet = true }
                        )
                        HumoraTab.ADMIN -> AdminCapacityScreen()
                        HumoraTab.PROFILE -> UserProfileScreen(
                            onNavigateBack = {
                                currentTab = if (authState.isAdmin) HumoraTab.ADMIN else HumoraTab.WORKDAY
                            },
                            onLogout = onLogout
                        )
                    }
                }

                if (showSettingsDialog) {
                    BackendSettingsDialog(
                        authViewModel = authViewModel,
                        uiState = authState,
                        onDismiss = { showSettingsDialog = false },
                        onOpenQrScanner = { showQrScannerSheet = true }
                    )
                }

                if (showQrScannerSheet) {
                    WebQRScannerSheet(
                        authViewModel = authViewModel,
                        onDismiss = { showQrScannerSheet = false }
                    )
                }
            }
        }
    }
}
