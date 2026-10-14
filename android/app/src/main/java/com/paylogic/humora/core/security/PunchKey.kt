package com.paylogic.humora.core.security

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec

/**
 * The fingerprint-punch key: an ECDSA P-256 key in the Android Keystore that can sign only
 * right after a strong biometric (fingerprint) scan on this phone. Enrolling a new fingerprint
 * permanently invalidates it, so nobody can add their own finger and punch for the owner.
 * The server verifies the signatures with the public key registered after a face match.
 */
object PunchKey {
    private const val ALIAS_PREFIX = "humora_punch_key_"

    private fun alias(userId: String) = ALIAS_PREFIX + userId

    private fun keyStore(): KeyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    fun exists(userId: String): Boolean = keyStore().containsAlias(alias(userId))

    fun delete(userId: String) {
        runCatching { keyStore().deleteEntry(alias(userId)) }
    }

    /** A new key's public half and its Android attestation chain (base64 DER, leaf first). */
    class Created(val publicKey: String, val attestationChain: List<String>)

    /**
     * Creates a fresh key (replacing any old one). [attestationChallenge] (SHA-256 of the
     * server's registration challenge) is sealed into the key's attestation certificate, which
     * lets the server verify the key lives in secure hardware and needs a fingerprint.
     */
    fun create(userId: String, attestationChallenge: ByteArray): Created {
        delete(userId)
        val spec = KeyGenParameterSpec.Builder(alias(userId), KeyProperties.PURPOSE_SIGN)
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setUserAuthenticationRequired(true)
            .setInvalidatedByBiometricEnrollment(true)
            .setAttestationChallenge(attestationChallenge)
            .apply {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    // Every signature needs its own fingerprint scan; no PIN/pattern fallback.
                    setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
                } else {
                    @Suppress("DEPRECATION")
                    setUserAuthenticationValidityDurationSeconds(-1)
                }
            }
            .build()
        val gen = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
        gen.initialize(spec)
        val publicKey = Base64.encodeToString(gen.generateKeyPair().public.encoded, Base64.NO_WRAP)
        val chain = keyStore().getCertificateChain(alias(userId)).orEmpty()
            .map { Base64.encodeToString(it.encoded, Base64.NO_WRAP) }
        return Created(publicKey, chain)
    }

    /** Public key of the existing key as base64 DER, or null if there is none. */
    fun publicKey(userId: String): String? {
        val cert = keyStore().getCertificate(alias(userId)) ?: return null
        return Base64.encodeToString(cert.publicKey.encoded, Base64.NO_WRAP)
    }

    /**
     * A Signature ready to be unlocked by BiometricPrompt, or null when the key is gone or was
     * invalidated (for example a fingerprint was added), in which case setup must run again.
     */
    fun signatureForPrompt(userId: String): Signature? {
        val key = keyStore().getKey(alias(userId), null) as? PrivateKey ?: return null
        return try {
            Signature.getInstance("SHA256withECDSA").apply { initSign(key) }
        } catch (e: KeyPermanentlyInvalidatedException) {
            delete(userId)
            null
        }
    }

    fun sign(unlocked: Signature, challenge: String): String {
        unlocked.update(challenge.toByteArray(Charsets.UTF_8))
        return Base64.encodeToString(unlocked.sign(), Base64.NO_WRAP)
    }
}
