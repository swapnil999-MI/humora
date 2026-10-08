package com.paylogic.humora

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.fragment.app.FragmentActivity
import com.paylogic.humora.core.theme.HumoraTheme
import com.paylogic.humora.presentation.screens.auth.LoginScreen
import com.paylogic.humora.presentation.screens.main.MainContainerScreen
import com.paylogic.humora.presentation.viewmodel.AuthViewModel

class MainActivity : FragmentActivity() {
    private val authViewModel: AuthViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleAuthDeepLink(intent)
        handleNotificationTap(intent)
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

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleAuthDeepLink(intent)
        handleNotificationTap(intent)
    }

    /** A Pulse notification was tapped: open that conversation. */
    private fun handleNotificationTap(intent: android.content.Intent?) {
        // An HR/work notification was tapped: it is read now, on every device.
        intent?.getStringExtra(com.paylogic.humora.notifications.AppNotifier.EXTRA_NOTIFICATION_ID)?.let {
            HumoraApp.instance.appNotifier.opened(it)
            intent.removeExtra(com.paylogic.humora.notifications.AppNotifier.EXTRA_NOTIFICATION_ID)
        }
        val id = intent?.getStringExtra(com.paylogic.humora.pulse.PulseNotifier.EXTRA_CONVERSATION_ID) ?: return
        HumoraApp.instance.pulseService.requestOpen(id)
        intent.removeExtra(com.paylogic.humora.pulse.PulseNotifier.EXTRA_CONVERSATION_ID)
    }

    private fun handleAuthDeepLink(intent: android.content.Intent?) {
        val uri = intent?.data ?: return
        if (uri.scheme == "humora" && uri.host == "auth") {
            val token = uri.getQueryParameter("token")
            val refresh = uri.getQueryParameter("refresh")
            if (!token.isNullOrBlank()) {
                authViewModel.handleOAuthSuccess(token, refresh)
            }
        }
    }
}
