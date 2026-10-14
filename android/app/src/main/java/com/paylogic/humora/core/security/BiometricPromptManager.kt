package com.paylogic.humora.core.security

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

class BiometricPromptManager(private val activity: FragmentActivity) {

    sealed interface BiometricResult {
        object HardwareUnavailable : BiometricResult
        object FeatureUnavailable : BiometricResult
        object NoneEnrolled : BiometricResult
        object AuthenticationFailed : BiometricResult
        data class AuthenticationSuccess(val cryptoObject: BiometricPrompt.CryptoObject?) : BiometricResult
        data class AuthenticationError(val errorCode: Int, val errString: String) : BiometricResult
    }

    fun canAuthenticate(): Boolean {
        val biometricManager = BiometricManager.from(activity)
        val status = biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.BIOMETRIC_WEAK
        )
        return status == BiometricManager.BIOMETRIC_SUCCESS
    }

    fun showBiometricPrompt(
        title: String,
        subtitle: String,
        description: String? = null,
        negativeButtonText: String = "Cancel",
        cryptoObject: BiometricPrompt.CryptoObject? = null,
        onResult: (BiometricResult) -> Unit
    ) {
        // Keystore keys can only be unlocked by strong (class 3) biometrics.
        val authenticators = if (cryptoObject != null) {
            BiometricManager.Authenticators.BIOMETRIC_STRONG
        } else {
            BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.BIOMETRIC_WEAK
        }
        val biometricManager = BiometricManager.from(activity)
        val status = biometricManager.canAuthenticate(authenticators)

        when (status) {
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> {
                onResult(BiometricResult.HardwareUnavailable)
                return
            }
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> {
                onResult(BiometricResult.FeatureUnavailable)
                return
            }
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
                onResult(BiometricResult.NoneEnrolled)
                return
            }
            else -> Unit
        }

        val executor = ContextCompat.getMainExecutor(activity)
        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                onResult(BiometricResult.AuthenticationError(errorCode, errString.toString()))
            }

            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                onResult(BiometricResult.AuthenticationSuccess(result.cryptoObject))
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                onResult(BiometricResult.AuthenticationFailed)
            }
        }

        val promptInfoBuilder = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeButtonText(negativeButtonText)
            .setAllowedAuthenticators(authenticators)

        description?.let { promptInfoBuilder.setDescription(it) }

        val biometricPrompt = BiometricPrompt(activity, executor, callback)
        if (cryptoObject != null) {
            biometricPrompt.authenticate(promptInfoBuilder.build(), cryptoObject)
        } else {
            biometricPrompt.authenticate(promptInfoBuilder.build())
        }
    }
}
