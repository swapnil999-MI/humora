package com.paylogic.humora.presentation.components

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.paylogic.humora.core.theme.*
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/**
 * Tactile Claymorphism Swipe Slider.
 * Carved debossed track with a high-elevation 3D inflated clay thumb.
 */
@Composable
fun SwipeToPunchSlider(
    isPunchedIn: Boolean,
    onSwipeComplete: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val density = LocalDensity.current
    val coroutineScope = rememberCoroutineScope()
    val dragOffset = remember { Animatable(0f) }

    val trackHeight = 66.dp
    val thumbSize = 54.dp
    val thumbPadding = 6.dp

    fun triggerHaptic() {
        try {
            val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createOneShot(50, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(50)
            }
        } catch (_: Exception) {}
    }

    BoxWithConstraints(
        modifier = modifier
            .fillMaxWidth()
            .height(trackHeight)
            .shadow(
                elevation = 6.dp,
                shape = RoundedCornerShape(34.dp),
                ambientColor = Color(0x66000000),
                spotColor = Color(0x8A000000)
            )
            .clip(RoundedCornerShape(34.dp))
            .background(ClaySurfacePressed)
            .border(
                1.2.dp,
                Brush.verticalGradient(
                    listOf(Color.Black.copy(alpha = 0.50f), Color.White.copy(alpha = 0.12f))
                ),
                RoundedCornerShape(34.dp)
            )
    ) {
        val maxDragPx = with(density) {
            (maxWidth - thumbSize - (thumbPadding * 2)).toPx()
        }

        val progress = if (maxDragPx > 0) (dragOffset.value / maxDragPx).coerceIn(0f, 1f) else 0f

        // Progress Fill
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(
                            if (isPunchedIn) Color(0xFFE11D48) else BrandPrimary,
                            if (isPunchedIn) Color(0xFFBE123C) else EmeraldSuccess
                        )
                    ),
                    alpha = progress * 0.35f
                )
        )

        // Center Hint Text
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = if (isPunchedIn) "Swipe to Punch Out >>" else "Swipe to Punch In >>",
                color = TextSecondaryDark.copy(alpha = 1f - (progress * 0.8f)),
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.5.sp
            )
        }

        // Inflated 3D Clay Thumb Knob
        Box(
            modifier = Modifier
                .padding(start = thumbPadding)
                .offset { IntOffset(dragOffset.value.roundToInt(), 0) }
                .size(thumbSize)
                .align(Alignment.CenterStart)
                .shadow(
                    elevation = 10.dp,
                    shape = CircleShape,
                    ambientColor = Color(0x66000000),
                    spotColor = Color(0x99000000)
                )
                .clip(CircleShape)
                .background(
                    if (isPunchedIn) {
                        Brush.linearGradient(listOf(Color(0xFFF43F5E), Color(0xFFBE123C)))
                    } else {
                        ClayAccentGradient
                    }
                )
                .border(
                    1.2.dp,
                    Brush.verticalGradient(
                        listOf(Color.White.copy(alpha = 0.45f), Color.White.copy(alpha = 0.16f))
                    ),
                    CircleShape
                )
                .draggable(
                    orientation = Orientation.Horizontal,
                    state = rememberDraggableState { delta ->
                        coroutineScope.launch {
                            val next = (dragOffset.value + delta).coerceIn(0f, maxDragPx)
                            dragOffset.snapTo(next)
                        }
                    },
                    onDragStopped = {
                        if (dragOffset.value >= maxDragPx * 0.80f) {
                            triggerHaptic()
                            coroutineScope.launch {
                                dragOffset.animateTo(maxDragPx, tween(150))
                                onSwipeComplete()
                                dragOffset.animateTo(0f, tween(300))
                            }
                        } else {
                            coroutineScope.launch {
                                dragOffset.animateTo(0f, tween(250))
                            }
                        }
                    }
                ),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = if (progress > 0.85f) Icons.Default.Check else Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = "Swipe Action",
                tint = Color.White,
                modifier = Modifier.size(24.dp)
            )
        }
    }
}
