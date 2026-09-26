package com.paylogic.humora

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.paylogic.humora.core.theme.HumoraTheme
import com.paylogic.humora.presentation.screens.auth.LoginScreen
import com.paylogic.humora.presentation.screens.main.MainContainerScreen
import com.paylogic.humora.presentation.viewmodel.AuthViewModel

class MainActivity : ComponentActivity() {
    private val authViewModel: AuthViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            HumoraTheme(darkTheme = true) {
                val authState by authViewModel.uiState.collectAsState()

                if (authState.isLoggedIn) {
                    MainContainerScreen(
                        authViewModel = authViewModel,
                        onLogout = { authViewModel.logout() }
                    )
                } else {
                    LoginScreen(
                        authViewModel = authViewModel
                    )
                }
            }
        }
    }
}
