# ProGuard & R8 Optimization Rules for Humora Android App

# Keep Kotlinx Serialization
-keepattributes *Annotation*,InnerClasses
-dontnote kotlinx.serialization.SerializationKt
-keepclassmembers class * {
    @kotlinx.serialization.Serializable mMethod(...);
    static ** Companion;
}
-keepclassmembers class **$Serializer {
    *;
}

# Keep Ktor Client Engines & Models
-keep class io.ktor.** { *; }

# Keep Room DB generated implementations
-keep class * extends androidx.room.RoomDatabase
-dontwarn androidx.room.paging.**

# Keep Compose Stability
-keepclassmembers class * {
    @androidx.compose.runtime.Composable *;
}

# Ktor IntellijIdeaDebugDetector references JVM-only management APIs that do not exist on Android.
-dontwarn java.lang.management.ManagementFactory
-dontwarn java.lang.management.RuntimeMXBean

# ── Pulse ─────────────────────────────────────────────────────────────────────
# protobuf-javalite reads message fields reflectively by name.
-keep class * extends com.google.protobuf.GeneratedMessageLite { <fields>; }
# JNI: native methods are bound by name, and Rust throws this exception class by name.
-keep class com.paylogic.humora.pulse.crypto.PulseNative { native <methods>; }
-keep class com.paylogic.humora.pulse.crypto.PulseCryptoException { <init>(java.lang.String); }
# SQLCipher's native library calls back into these classes.
-keep class net.zetetic.database.** { *; }
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
