package com.paylogic.humora

import android.app.Application
import androidx.room.Room
import com.paylogic.humora.data.local.HumoraDatabase
import com.paylogic.humora.data.remote.HumoraApiClient
import com.paylogic.humora.data.remote.NetworkConfig
import com.paylogic.humora.data.remote.SessionManager
import com.paylogic.humora.data.repository.*

class HumoraApp : Application() {

    lateinit var database: HumoraDatabase
        private set

    lateinit var sessionManager: SessionManager
        private set

    lateinit var apiClient: HumoraApiClient
        private set

    lateinit var authRepository: AuthRepository
        private set

    lateinit var attendanceRepository: AttendanceRepository
        private set

    lateinit var leavesRepository: LeavesRepository
        private set

    lateinit var workRepository: WorkRepository
        private set

    lateinit var payrollRepository: PayrollRepository
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        NetworkConfig.init(this)

        database = Room.databaseBuilder(
            applicationContext,
            HumoraDatabase::class.java,
            "humora_enterprise.db"
        ).fallbackToDestructiveMigration()
         .build()

        sessionManager = SessionManager(this)
        apiClient = HumoraApiClient(sessionManager)

        authRepository = AuthRepository(apiClient, sessionManager)
        attendanceRepository = AttendanceRepository(this, apiClient, database)
        leavesRepository = LeavesRepository(apiClient)
        workRepository = WorkRepository(apiClient)
        payrollRepository = PayrollRepository(apiClient)
    }

    companion object {
        lateinit var instance: HumoraApp
            private set
    }
}
