package com.paylogic.humora.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.paylogic.humora.core.theme.DarkBackground

/**
 * Clean Canvas for Claymorphism.
 * Grounded matte dark canvas providing maximum contrast and depth
 * for 3D inflated clay surfaces.
 */
@Composable
fun GlassMeshBackground(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(DarkBackground),
        content = content
    )
}
