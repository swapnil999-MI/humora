package com.paylogic.humora.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.paylogic.humora.core.theme.*

/**
 * Universal Claymorphism modifier that applies:
 * 1. Deep physical drop shadow
 * 2. Pillowy clipping curve
 * 3. Volumetric clay gradient
 * 4. Dual-lighting directional bevel
 */
fun Modifier.clayEffect(
    shape: Shape = RoundedCornerShape(24.dp),
    elevation: Dp = 10.dp,
    borderWidth: Dp = 1.3.dp,
    borderBrush: Brush = ClayBorderGradient,
    backgroundBrush: Brush = ClaySurfaceGradient
): Modifier = this
    .shadow(
        elevation = elevation,
        shape = shape,
        ambientColor = Color(0x66000000),
        spotColor = Color(0x8A000000)
    )
    .clip(shape)
    .background(backgroundBrush)
    .border(borderWidth, borderBrush, shape)

/**
 * Debossed / Inset Clay modifier for wells, inputs, and track channels.
 */
fun Modifier.clayDebossed(
    shape: Shape = RoundedCornerShape(16.dp),
    borderWidth: Dp = 1.2.dp
): Modifier = this
    .clip(shape)
    .background(ClaySurfacePressed)
    .border(
        borderWidth,
        Brush.verticalGradient(
            listOf(Color.Black.copy(alpha = 0.55f), Color.White.copy(alpha = 0.12f))
        ),
        shape
    )

/**
 * Ultra-Premium Tactile 3D Claymorphism Card.
 * Uses a double-layered volumetric surface:
 * - Base clay body gradient (crisp and clearly distinct across 100% of card surface)
 * - Inner 3D cushion occlusion layer (soft light crest on top, never darkens bottom/right)
 * - Studio directional rim lighting (fully defined around all 4 edges)
 */
@Composable
fun ClayCard(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 24.dp,
    elevation: Dp = 10.dp,
    borderBrush: Brush = ClayBorderGradient,
    backgroundBrush: Brush = ClaySurfaceGradient,
    borderColor: Color? = null,
    backgroundColor: Color? = null,
    borderWidth: Dp = 1.3.dp,
    contentPadding: PaddingValues = PaddingValues(18.dp),
    content: @Composable BoxScope.() -> Unit
) {
    val finalBorderBrush = if (borderColor != null) Brush.linearGradient(listOf(borderColor, borderColor)) else borderBrush
    val finalBgBrush = if (backgroundColor != null) Brush.linearGradient(listOf(backgroundColor, backgroundColor)) else backgroundBrush
    val shape = RoundedCornerShape(cornerRadius)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .shadow(
                elevation = elevation,
                shape = shape,
                ambientColor = Color(0x66000000),
                spotColor = Color(0x8A000000)
            )
            .clip(shape)
            .background(finalBgBrush)
            .border(borderWidth, finalBorderBrush, shape)
    ) {
        // Inner Volumetric 3D Cushion Layer (Physical depth & soft key-lighting)
        Box(
            modifier = Modifier
                .matchParentSize()
                .clip(shape)
                .background(ClayInnerCrestGradient)
        )

        // Inner Content
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(contentPadding),
            content = content
        )
    }
}

/**
 * Tactile Inflated 3D Clay Action Button.
 * Features 3D pillow volume, dual-tone specular crest, and tactile depression.
 */
@Composable
fun ClayButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 16.dp,
    brush: Brush = ClayAccentGradient,
    contentColor: Color = Color.White,
    icon: ImageVector? = null,
    trailingIcon: ImageVector? = null,
    enabled: Boolean = true,
    isLoading: Boolean = false,
    fontSize: TextUnit = 13.sp,
    elevation: Dp = 8.dp,
    contentPadding: PaddingValues = PaddingValues(horizontal = 18.dp, vertical = 12.dp)
) {
    val shape = RoundedCornerShape(cornerRadius)
    val effectiveBrush = if (enabled) brush else ClayDarkButtonGradient
    val effectiveColor = if (enabled) contentColor else TextMutedDark

    Box(
        modifier = modifier
            .shadow(
                elevation = if (enabled) elevation else 2.dp,
                shape = shape,
                ambientColor = Color(0x59000000),
                spotColor = Color(0x80000000)
            )
            .clip(shape)
            .background(effectiveBrush)
            .border(
                1.2.dp,
                Brush.verticalGradient(
                    listOf(
                        Color.White.copy(alpha = if (enabled) 0.45f else 0.15f),
                        Color.White.copy(alpha = if (enabled) 0.18f else 0.08f)
                    )
                ),
                shape
            )
            .then(
                if (enabled && !isLoading) {
                    Modifier.clickable { onClick() }
                } else Modifier
            )
            .padding(contentPadding),
        contentAlignment = Alignment.Center
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(18.dp),
                color = effectiveColor,
                strokeWidth = 2.dp
            )
        } else {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                if (icon != null) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = effectiveColor,
                        modifier = Modifier.size(17.dp)
                    )
                    Spacer(modifier = Modifier.width(7.dp))
                }

                Text(
                    text = text,
                    color = effectiveColor,
                    fontSize = fontSize,
                    fontWeight = FontWeight.Bold
                )

                if (trailingIcon != null) {
                    Spacer(modifier = Modifier.width(7.dp))
                    Icon(
                        imageVector = trailingIcon,
                        contentDescription = null,
                        tint = effectiveColor,
                        modifier = Modifier.size(17.dp)
                    )
                }
            }
        }
    }
}

/**
 * Inflated 3D Clay Pill / Status Badge.
 */
@Composable
fun ClayBadge(
    text: String,
    modifier: Modifier = Modifier,
    brush: Brush = ClayAccentGradient,
    textColor: Color = Color.White,
    cornerRadius: Dp = 10.dp
) {
    val shape = RoundedCornerShape(cornerRadius)

    Box(
        modifier = modifier
            .shadow(4.dp, shape, ambientColor = Color(0x66000000))
            .clip(shape)
            .background(brush)
            .border(
                1.dp,
                Brush.verticalGradient(
                    listOf(Color.White.copy(alpha = 0.40f), Color.White.copy(alpha = 0.16f))
                ),
                shape
            )
            .padding(horizontal = 9.dp, vertical = 4.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = textColor,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

/**
 * Debossed Carved Container for inputs, search bars, and tracks.
 */
@Composable
fun ClayDebossedBox(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 14.dp,
    contentPadding: PaddingValues = PaddingValues(12.dp),
    content: @Composable BoxScope.() -> Unit
) {
    val shape = RoundedCornerShape(cornerRadius)
    Box(
        modifier = modifier
            .clayDebossed(shape)
            .padding(contentPadding),
        content = content
    )
}
