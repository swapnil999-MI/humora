package com.paylogic.humora.core.security

import android.content.Intent
import android.net.Uri
import android.util.Base64
import com.paylogic.humora.HumoraApp
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * Social sign-in with PKCE. This app keeps a random secret (the verifier) and sends only its
 * SHA-256 to the server; the server releases the tokens for the one-time code it redirects back
 * with only to whoever shows the verifier. Another app that grabs the humora:// link gets nothing.
 */
object OAuthPkce {
    private fun b64url(bytes: ByteArray): String =
        Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)

    /** The browser intent that starts a sign-in with [provider], remembering a fresh verifier. */
    fun startIntent(apiBaseUrl: String, provider: String): Intent {
        val verifier = b64url(ByteArray(32).also { SecureRandom().nextBytes(it) })
        HumoraApp.instance.sessionManager.pendingOAuthVerifier(verifier)
        val challenge = b64url(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.US_ASCII)))
        val url = "${apiBaseUrl.trimEnd('/')}/auth/oauth/$provider?client=mobile&challenge=$challenge"
        return Intent(Intent.ACTION_VIEW, Uri.parse(url))
    }
}
