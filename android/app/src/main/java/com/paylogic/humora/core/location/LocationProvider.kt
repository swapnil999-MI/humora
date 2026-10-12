package com.paylogic.humora.core.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

object LocationProvider {

    /** What to ask for: precise if the user allows it, approximate otherwise. */
    val PERMISSIONS = arrayOf(
        android.Manifest.permission.ACCESS_FINE_LOCATION,
        android.Manifest.permission.ACCESS_COARSE_LOCATION,
    )

    /** Whether the app may read the location at all (precise or approximate). */
    fun hasPermission(context: Context): Boolean = PERMISSIONS.any {
        androidx.core.content.ContextCompat.checkSelfPermission(context, it) == android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    @SuppressLint("MissingPermission")
    fun getLastKnownLocation(context: Context): Location? {
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
        val providers = lm.getProviders(true)
        var best: Location? = null
        for (p in providers) {
            try {
                val loc = lm.getLastKnownLocation(p) ?: continue
                if (best == null || loc.accuracy < best.accuracy) {
                    best = loc
                }
            } catch (_: SecurityException) {}
        }
        return best
    }

    @SuppressLint("MissingPermission")
    suspend fun getCurrentLocation(context: Context): Location? {
        val last = getLastKnownLocation(context)
        // If last known location is fresh (< 45 seconds old) and reasonably accurate, return it directly
        if (last != null && (System.currentTimeMillis() - last.time) < 45_000 && last.accuracy <= 50.0f) {
            return last
        }

        val lm = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return last

        // A GPS fix can take forever indoors; fall back to the last known location instead of hanging.
        return withTimeoutOrNull(FIX_TIMEOUT_MS) { awaitFix(context, lm, last) } ?: last
    }

    private const val FIX_TIMEOUT_MS = 15_000L

    @SuppressLint("MissingPermission")
    private suspend fun awaitFix(context: Context, lm: LocationManager, last: Location?): Location? =
        suspendCancellableCoroutine { cont ->
            val listener = object : LocationListener {
                override fun onLocationChanged(location: Location) {
                    try {
                        lm.removeUpdates(this)
                    } catch (_: SecurityException) {}
                    if (cont.isActive) {
                        cont.resume(location)
                    }
                }

                @Deprecated("Deprecated in Java")
                override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                override fun onProviderEnabled(provider: String) {}
                override fun onProviderDisabled(provider: String) {}
            }

            try {
                // GPS needs precise permission; with only approximate, asking for it throws.
                val precise = androidx.core.content.ContextCompat.checkSelfPermission(
                    context, android.Manifest.permission.ACCESS_FINE_LOCATION
                ) == android.content.pm.PackageManager.PERMISSION_GRANTED
                val provider = when {
                    precise && lm.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
                    lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
                    else -> null
                }

                if (provider != null) {
                    val looper = Looper.getMainLooper() ?: context.mainLooper
                    lm.requestSingleUpdate(provider, listener, looper)
                    cont.invokeOnCancellation {
                        try {
                            lm.removeUpdates(listener)
                        } catch (_: SecurityException) {}
                    }
                } else {
                    cont.resume(last)
                }
            } catch (_: Exception) {
                cont.resume(last)
            }
        }
}
