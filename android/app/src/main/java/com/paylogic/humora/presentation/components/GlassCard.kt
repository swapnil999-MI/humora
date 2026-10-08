package com.paylogic.humora.presentation.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.paylogic.humora.core.theme.ClayBorderGradient
import com.paylogic.humora.core.theme.ClaySurfaceGradient

/**
 * Compatibility modifier mapped to Claymorphism 3D effect.
 */
fun Modifier.glassEffect(
    shape: Shape = RoundedCornerShape(24.dp),
    borderWidth: Dp = 1.2.dp,
    borderBrush: Brush = ClayBorderGradient,
    backgroundBrush: Brush = ClaySurfaceGradient
): Modifier = this.clayEffect(
    shape = shape,
    elevation = 10.dp,
    borderWidth = borderWidth,
    borderBrush = borderBrush,
    backgroundBrush = backgroundBrush
)

/**
 * Card mapped directly to 3D ClayCard.
 */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 24.dp,
    borderBrush: Brush = ClayBorderGradient,
    backgroundBrush: Brush = ClaySurfaceGradient,
    borderColor: Color? = null,
    backgroundColor: Color? = null,
    showTopGlare: Boolean = false,
    contentPadding: PaddingValues = PaddingValues(18.dp),
    content: @Composable BoxScope.() -> Unit
) {
    ClayCard(
        modifier = modifier,
        cornerRadius = cornerRadius,
        elevation = 10.dp,
        borderBrush = borderBrush,
        backgroundBrush = backgroundBrush,
        borderColor = borderColor,
        backgroundColor = backgroundColor,
        contentPadding = contentPadding,
        content = content
    )
}
