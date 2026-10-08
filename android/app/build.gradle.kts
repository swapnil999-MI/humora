import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
}

// Release signing comes from android/keystore.properties (git-ignored) or HUMORA_KEYSTORE_* env vars.
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
fun signingValue(key: String, env: String): String? =
    keystoreProps.getProperty(key) ?: System.getenv(env)

val isReleaseBuild = gradle.startParameter.taskNames.any { it.contains("Release", ignoreCase = true) }
// Production API endpoint: pass -Phumora.apiBaseUrl=https://api.yourdomain/api/v1 (or set it in gradle.properties).
val releaseApiBaseUrl = providers.gradleProperty("humora.apiBaseUrl").orNull
if (isReleaseBuild) {
    require(releaseApiBaseUrl?.startsWith("https://") == true) {
        "Release builds need -Phumora.apiBaseUrl=https://... (got: $releaseApiBaseUrl)"
    }
    require(signingValue("storeFile", "HUMORA_KEYSTORE_FILE") != null) {
        "Release builds need android/keystore.properties or HUMORA_KEYSTORE_FILE; refusing to sign with the debug key"
    }
}

android {
    namespace = "com.paylogic.humora"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.paylogic.humora"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }

        // Push notifications (Firebase Cloud Messaging). Optional: set these in gradle.properties from the
        // Firebase console (Project settings > Your apps > Android). Left empty, push is simply off.
        fun prop(name: String) = providers.gradleProperty(name).orNull ?: ""
        buildConfigField("String", "FCM_PROJECT_ID", "\"${prop("humora.fcm.projectId")}\"")
        buildConfigField("String", "FCM_APP_ID", "\"${prop("humora.fcm.appId")}\"")
        buildConfigField("String", "FCM_API_KEY", "\"${prop("humora.fcm.apiKey")}\"")
        buildConfigField("String", "FCM_SENDER_ID", "\"${prop("humora.fcm.senderId")}\"")
    }

    signingConfigs {
        create("release") {
            signingValue("storeFile", "HUMORA_KEYSTORE_FILE")?.let { storeFile = file(it) }
            storePassword = signingValue("storePassword", "HUMORA_KEYSTORE_PASSWORD")
            keyAlias = signingValue("keyAlias", "HUMORA_KEY_ALIAS")
            keyPassword = signingValue("keyPassword", "HUMORA_KEY_PASSWORD")
        }
    }

    buildTypes {
        release {
            buildConfigField("String", "API_BASE_URL", "\"${releaseApiBaseUrl ?: ""}\"")
            manifestPlaceholders["usesCleartextTraffic"] = "false"
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            applicationIdSuffix = ".debug"
            isDebuggable = true
            // Local backend on the developer LAN over plain HTTP; override with -Phumora.debugApiBaseUrl=...
            val debugApi = providers.gradleProperty("humora.debugApiBaseUrl").orNull ?: "http://192.168.1.50:8090/api/v1"
            buildConfigField("String", "API_BASE_URL", "\"$debugApi\"")
            manifestPlaceholders["usesCleartextTraffic"] = "true"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += listOf(
            "-opt-in=androidx.compose.material3.ExperimentalMaterial3Api",
            "-opt-in=kotlinx.coroutines.ExperimentalCoroutinesApi"
        )
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

ksp {
    arg("room.generateKotlin", "true")
}

dependencies {
    // AndroidX & Lifecycle
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)

    // Jetpack Compose
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)
    debugImplementation(libs.androidx.ui.tooling)

    // Coroutines & Serialization
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.coroutines.play.services)
    implementation(libs.kotlinx.serialization.json)

    // Ktor Client (Ultra-lightweight HTTP engine)
    implementation(libs.ktor.client.core)
    implementation(libs.ktor.client.cio)
    implementation(libs.ktor.client.content.negotiation)
    implementation(libs.ktor.serialization.kotlinx.json)
    implementation(libs.ktor.client.logging)

    // Room Database (Offline Cache & Sync Queue)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    // Hardware Telemetry & Security
    implementation(libs.play.services.location)
    implementation(libs.androidx.biometric)
    implementation(libs.androidx.camera.core)
    implementation(libs.androidx.camera.camera2)
    implementation(libs.androidx.camera.lifecycle)
    implementation(libs.androidx.camera.view)

    // WorkManager
    implementation(libs.androidx.work.runtime.ktx)

    // Image Loading
    implementation(libs.coil.compose)

    // Pulse end-to-end encrypted messaging: wire protocol, gateway socket, encrypted local store
    implementation(libs.protobuf.javalite)
    implementation(libs.okhttp)
    implementation(libs.sqlcipher.android)
    implementation(libs.androidx.sqlite.ktx)
    implementation(libs.androidx.lifecycle.process)
    implementation(libs.firebase.messaging)
}
