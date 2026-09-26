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
