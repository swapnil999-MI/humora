package com.paylogic.humora.data.local

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase

@Entity(tableName = "offline_punches")
data class OfflinePunchEntity(
    @PrimaryKey(autoGenerate = true) val localId: Long = 0,
    val punchType: String,
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float,
    val timestamp: Long,
    val isSynced: Boolean = false
)

@Dao
interface OfflinePunchDao {
    @Insert
    suspend fun insertPunch(punch: OfflinePunchEntity): Long

    @Query("SELECT * FROM offline_punches WHERE isSynced = 0 ORDER BY timestamp ASC")
    suspend fun getPendingPunches(): List<OfflinePunchEntity>

    @Query("UPDATE offline_punches SET isSynced = 1 WHERE localId = :id")
    suspend fun markPunchSynced(id: Long): Int
}

@Database(entities = [OfflinePunchEntity::class], version = 1, exportSchema = false)
abstract class HumoraDatabase : RoomDatabase() {
    abstract fun offlinePunchDao(): OfflinePunchDao
}
