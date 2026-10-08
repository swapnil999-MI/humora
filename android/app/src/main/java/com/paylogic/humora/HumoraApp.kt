package com.paylogic.humora

import android.app.Application
import androidx.room.Room
import com.paylogic.humora.data.local.HumoraDatabase
import com.paylogic.humora.data.remote.HumoraApiClient
import com.paylogic.humora.data.remote.NetworkConfig
import com.paylogic.humora.data.remote.SessionManager
import com.paylogic.humora.data.repository.*
import com.paylogic.humora.pulse.PulseService

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

    lateinit var adminRepository: AdminRepository
        private set

    lateinit var pulseService: PulseService
        private set

    lateinit var appNotifier: com.paylogic.humora.notifications.AppNotifier
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
        adminRepository = AdminRepository(apiClient, sessionManager)
        pulseService = PulseService(this, sessionManager, apiClient)
        appNotifier = com.paylogic.humora.notifications.AppNotifier(this, sessionManager, apiClient)
    }

    companion object {
        lateinit var instance: HumoraApp
            private set
    }
}
