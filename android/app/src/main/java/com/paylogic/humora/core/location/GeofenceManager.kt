package com.paylogic.humora.core.location

import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

data class GeofenceStatus(
    val isInside: Boolean,
    val distanceMeters: Double,
    val officeName: String,
    val radiusMeters: Double
)

object GeofenceManager {

    private const val EARTH_RADIUS_METERS = 6371000.0

    /**
     * Calculates precise distance using Haversine formula
     */
    fun calculateDistanceMeters(
        lat1: Double,
        lon1: Double,
        lat2: Double,
        lon2: Double
    ): Double {
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)

        val a = sin(dLat / 2) * sin(dLat / 2) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
                sin(dLon / 2) * sin(dLon / 2)

        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return EARTH_RADIUS_METERS * c
    }

    /**
     * Evaluates whether the current coordinate is within the designated office geofence.
     */
    fun checkGeofence(
        userLat: Double,
        userLon: Double,
        officeLat: Double,
        officeLon: Double,
        allowedRadiusMeters: Double = 150.0,
        officeName: String = "Corporate HQ"
    ): GeofenceStatus {
        val distance = calculateDistanceMeters(userLat, userLon, officeLat, officeLon)
        val isInside = distance <= allowedRadiusMeters

        return GeofenceStatus(
            isInside = isInside,
            distanceMeters = distance,
            officeName = officeName,
            radiusMeters = allowedRadiusMeters
        )
    }
}
