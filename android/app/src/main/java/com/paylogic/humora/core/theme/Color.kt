package com.paylogic.humora.core.theme

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

// Claymorphism Dark Canvas
val DarkBackground = Color(0xFF090D17)
val DarkSurface = Color(0xFF162035)         // Volumetric Tactile Dark Slate Clay
val DarkSurfaceVariant = Color(0xFF1D2A44)  // Elevated Clay Layer
val DarkBorder = Color(0x33FFFFFF)

// Explicit Claymorphism Tokens
val ClayBackground = Color(0xFF090D17)
val ClaySurface = Color(0xFF162035)
val ClaySurfaceElevated = Color(0xFF1E2B47)
val ClaySurfacePressed = Color(0xFF111828)

// Clay 3D Volumetric Fill (Simulates soft curved light falling on inflated clay)
val ClaySurfaceGradient = Brush.linearGradient(
    colors = listOf(
        Color(0xFF263554),  // Top-left diffuse clay highlight
        Color(0xFF1D283E),  // Rich tactile clay body
        Color(0xFF182236)   // Bottom-right: distinctly brighter than background
    ),
    start = Offset(0f, 0f),
    end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY)
)

val ClayAccentGradient = Brush.linearGradient(
    colors = listOf(
        Color(0xFF7578F8),  // Light top-left clay crest
        Color(0xFF5B5EEB),  // Solid Brand Indigo Clay body
        Color(0xFF4346D8)   // Bottom-right curvature
    ),
    start = Offset(0f, 0f),
    end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY)
)

val ClaySuccessGradient = Brush.linearGradient(
    colors = listOf(
        Color(0xFF34D399),
        Color(0xFF10B981),
        Color(0xFF059669)
    ),
    start = Offset(0f, 0f),
    end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY)
)

val ClayWarningGradient = Brush.linearGradient(
    colors = listOf(
        Color(0xFFFBBF24),
        Color(0xFFF59E0B),
        Color(0xFFD97706)
    )
)

val ClayErrorGradient = Brush.linearGradient(
    colors = listOf(
        Color(0xFFFB7185),
        Color(0xFFF43F5E),
        Color(0xFFE11D48)
    )
)

val ClaySecondaryGradient = Brush.linearGradient(
    colors = listOf(
        Color(0xFFA78BFA),
        Color(0xFF8B5CF6),
        Color(0xFF7C3AED)
    ),
    start = Offset(0f, 0f),
    end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY)
)

val ClayDarkButtonGradient = Brush.linearGradient(
    colors = listOf(
        Color(0xFF2E3D5C),
        Color(0xFF222E44),
        Color(0xFF1A2438)
    ),
    start = Offset(0f, 0f),
    end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY)
)

// Clay Beveled Rim (Directional studio lighting - fully visible around entire perimeter)
val ClayBorderGradient = Brush.linearGradient(
    colors = listOf(
        Color.White.copy(alpha = 0.38f),         // Top-left soft specular clay highlight
        Color.White.copy(alpha = 0.22f),         // Mid transition
        Color.White.copy(alpha = 0.14f)          // Bottom-right: distinctly visible rim
    ),
    start = Offset(0f, 0f),
    end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY)
)

// Inner Cushion Occlusion (Gives the surface its tactile 3D pillow volume without darkening)
val ClayInnerCrestGradient = Brush.verticalGradient(
    colors = listOf(
        Color.White.copy(alpha = 0.08f),         // Soft top-down sheen
        Color.Transparent                        // Tapers away cleanly without darkening the right side
    )
)

// Debossed/Carved Channel Gradient
val ClayDebossedGradient = Brush.linearGradient(
    colors = listOf(
        Color.Black.copy(alpha = 0.50f),
        Color(0xFF101726),
        Color.White.copy(alpha = 0.08f)
    ),
    start = Offset(0f, 0f),
    end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY)
)

// Aliases for compatibility
val GlassBorderGradient = ClayBorderGradient
val GlassCardBrush = ClaySurfaceGradient
val GlassSurfaceBase = ClaySurface
val GlassSurfaceElevated = ClaySurfaceElevated
val GlassSurfaceCard = ClaySurface
val GlassBorderSubtle = Color(0x24FFFFFF)

// Brand Accents
val BrandPrimary = Color(0xFF5B5EEB)      // Humora Indigo Clay
val BrandSecondary = Color(0xFF8B5CF6)    // Electric Violet
val BrandGradientStart = Color(0xFF5B5EEB)
val BrandGradientEnd = Color(0xFF7C3AED)

// Semantic Accents
val EmeraldSuccess = Color(0xFF10B981)
val AmberWarning = Color(0xFFF59E0B)
val RoseError = Color(0xFFF43F5E)
val CyanInfo = Color(0xFF06B6D4)

// Text Colors
val TextPrimaryDark = Color(0xFFFFFFFF)
val TextSecondaryDark = Color(0xFFCBD5E1)
val TextMutedDark = Color(0xFF94A3B8)

// Light Palette
val LightBackground = Color(0xFFF1F5F9)
val LightSurface = Color(0xFFFFFFFF)
val LightSurfaceVariant = Color(0xFFE2E8F0)
val LightBorder = Color(0xFFCBD5E1)
val TextPrimaryLight = Color(0xFF0F172A)
val TextSecondaryLight = Color(0xFF475569)
