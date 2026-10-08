package com.paylogic.humora.core.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

object LocationProvider {

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

        return suspendCancellableCoroutine { cont ->
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
                val provider = when {
                    lm.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
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
}
