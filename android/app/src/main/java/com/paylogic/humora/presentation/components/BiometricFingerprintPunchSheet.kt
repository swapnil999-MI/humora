package com.paylogic.humora.presentation.components

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.location.Location
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.paylogic.humora.HumoraApp
import androidx.biometric.BiometricPrompt
import com.paylogic.humora.core.security.BiometricPromptManager
import com.paylogic.humora.core.security.PunchKey
import com.paylogic.humora.data.remote.NetworkResult
import com.paylogic.humora.core.theme.*
import com.paylogic.humora.data.repository.AttendanceRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors

@Composable
fun BiometricFingerprintPunchSheet(
    punchType: String, // "in" or "out"
    onDismiss: () -> Unit,
    onPunchSuccess: (String) -> Unit,
    attendanceRepo: AttendanceRepository = HumoraApp.instance.attendanceRepository
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val activity = context as? FragmentActivity
    val scope = rememberCoroutineScope()

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        )
    }

    // Punching needs the device location as well as the camera, so both are asked for up front.
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        hasCameraPermission = grants[Manifest.permission.CAMERA] ?: hasCameraPermission
    }

    LaunchedEffect(Unit) {
        val missing = listOf(
            Manifest.permission.CAMERA,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        ).filter { ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) permissionLauncher.launch(missing.toTypedArray())
    }

    var imageCapture: ImageCapture? by remember { mutableStateOf(null) }
    var isFingerprintVerified by remember { mutableStateOf(false) }
    var isPunching by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var statusText by remember { mutableStateOf("Checking fingerprint punch on this phone...") }
    // null = still checking or not allowed; false = this phone must be set up with a face check first.
    var isDeviceReady by remember { mutableStateOf<Boolean?>(null) }
    var isNotAllowed by remember { mutableStateOf(false) }
    val userId = remember { HumoraApp.instance.sessionManager.userId }

    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 0.95f,
        targetValue = 1.08f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse"
    )

    fun bitmapToBase64DataUrl(bitmap: Bitmap): String {
        val maxDim = 800
        val scaled = if (bitmap.width > maxDim || bitmap.height > maxDim) {
            val scale = maxDim.toFloat() / maxOf(bitmap.width, bitmap.height)
            val newW = (bitmap.width * scale).toInt()
            val newH = (bitmap.height * scale).toInt()
            Bitmap.createScaledBitmap(bitmap, newW, newH, true)
        } else {
            bitmap
        }
        val stream = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, 85, stream)
        val base64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
        return "data:image/jpeg;base64,$base64"
    }

    fun networkMessage(res: NetworkResult<*>): String = when (res) {
        is NetworkResult.Error -> res.message
        is NetworkResult.Exception -> "You're offline. Connect to the internet to punch."
        is NetworkResult.Success -> ""
    }

    // Signs a fresh server challenge with the fingerprint-bound key and records the punch.
    fun promptFingerprint() {
        if (activity == null) {
            errorMessage = "Biometric prompt requires an active activity."
            return
        }
        errorMessage = null
        scope.launch {
            val location = com.paylogic.humora.core.location.LocationProvider.getCurrentLocation(context)
            attendanceRepo.precheckLocation(location)?.let {
                errorMessage = it
                return@launch
            }

            val signature = PunchKey.signatureForPrompt(userId)
            if (signature == null) {
                isDeviceReady = false
                statusText = "Fingerprints on this phone changed. Verify your face to set up fingerprint punch again."
                return@launch
            }
            val challengeRes = attendanceRepo.getPunchChallenge(punchType)
            if (challengeRes !is NetworkResult.Success) {
                errorMessage = networkMessage(challengeRes)
                return@launch
            }
            val challenge = challengeRes.data.challenge

            statusText = "Touch the fingerprint sensor to verify..."
            BiometricPromptManager(activity).showBiometricPrompt(
                title = if (punchType.equals("in", ignoreCase = true)) "Fingerprint Check-In" else "Fingerprint Check-Out",
                subtitle = "Verify your fingerprint to record this punch",
                description = "Place your registered finger on the sensor.",
                cryptoObject = BiometricPrompt.CryptoObject(signature)
            ) { result ->
                when (result) {
                    is BiometricPromptManager.BiometricResult.AuthenticationSuccess -> {
                        val unlocked = result.cryptoObject?.signature
                        if (unlocked == null) {
                            errorMessage = "Fingerprint verification did not unlock the punch key. Please try again."
                            return@showBiometricPrompt
                        }
                        isFingerprintVerified = true
                        scope.launch {
                            isPunching = true
                            statusText = "Fingerprint verified. Recording punch..."
                            val signed = PunchKey.sign(unlocked, challenge)
                            val res = attendanceRepo.submitFingerprintPunch(punchType, challenge, signed, location!!)
                            isPunching = false
                            if (res is NetworkResult.Success) {
                                val action = if (punchType.equals("in", ignoreCase = true)) "CHECK-IN" else "CHECK-OUT"
                                statusText = "$action recorded with fingerprint!"
                                delay(1200)
                                onPunchSuccess("$action Verified via Fingerprint")
                                onDismiss()
                            } else {
                                isFingerprintVerified = false
                                errorMessage = networkMessage(res)
                            }
                        }
                    }
                    is BiometricPromptManager.BiometricResult.AuthenticationFailed -> {
                        errorMessage = "Fingerprint did not match. Please try again."
                    }
                    is BiometricPromptManager.BiometricResult.AuthenticationError -> {
                        errorMessage = result.errString
                    }
                    is BiometricPromptManager.BiometricResult.NoneEnrolled -> {
                        errorMessage = "No fingerprints enrolled on this device. Please enroll in Android Settings."
                    }
                    is BiometricPromptManager.BiometricResult.HardwareUnavailable -> {
                        errorMessage = "Biometric hardware is currently unavailable."
                    }
                    is BiometricPromptManager.BiometricResult.FeatureUnavailable -> {
                        errorMessage = "This phone has no strong fingerprint sensor. Use face punch instead."
                    }
                }
            }
        }
    }

    // One-time setup: a selfie that matches the enrolled face registers this phone's key.
    fun setUpWithSelfie(selfieBase64: String) {
        scope.launch {
            isPunching = true
            statusText = "Checking your face to set up fingerprint punch..."
            val res = attendanceRepo.setUpFingerprint(userId, selfieBase64)
            isPunching = false
            if (res is NetworkResult.Success) {
                isDeviceReady = true
                statusText = "Fingerprint punch is set up on this phone."
                promptFingerprint()
            } else {
                errorMessage = networkMessage(res)
                statusText = "Look at the camera and tap Verify Face to set up fingerprint punch."
            }
        }
    }

    fun captureSetupSelfie() {
        errorMessage = null
        val capture = imageCapture
        if (capture == null || !hasCameraPermission) {
            errorMessage = "Camera access is needed once to verify your face for fingerprint punch."
            return
        }
        statusText = "Capturing selfie..."
        val executor = Executors.newSingleThreadExecutor()
        capture.takePicture(executor, object : ImageCapture.OnImageCapturedCallback() {
            override fun onCaptureSuccess(image: ImageProxy) {
                val rotationDegrees = image.imageInfo.rotationDegrees
                val buffer = image.planes[0].buffer
                val bytes = ByteArray(buffer.remaining())
                buffer.get(bytes)
                val originalBitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                image.close()

                val matrix = Matrix().apply {
                    postRotate(rotationDegrees.toFloat())
                    // Mirror for front camera natural alignment
                    postScale(-1f, 1f)
                }
                val correctedBitmap = Bitmap.createBitmap(
                    originalBitmap, 0, 0, originalBitmap.width, originalBitmap.height, matrix, true
                )
                setUpWithSelfie(bitmapToBase64DataUrl(correctedBitmap))
            }

            override fun onError(exception: ImageCaptureException) {
                scope.launch {
                    errorMessage = "Could not take the selfie: ${exception.message}"
                }
            }
        })
    }

    LaunchedEffect(Unit) {
        delay(300)
        when (val ready = attendanceRepo.fingerprintReadiness(userId)) {
            is NetworkResult.Success -> when (ready.data) {
                AttendanceRepository.FingerprintReadiness.READY -> {
                    isDeviceReady = true
                    statusText = "Touch the fingerprint sensor to verify"
                    promptFingerprint()
                }
                AttendanceRepository.FingerprintReadiness.NEEDS_SETUP -> {
                    isDeviceReady = false
                    statusText = "Fingerprint punch isn't set up on this phone yet. Look at the camera and tap Verify Face (one time)."
                }
                AttendanceRepository.FingerprintReadiness.NOT_ALLOWED -> {
                    isNotAllowed = true
                    statusText = "Fingerprint punch is not enabled for you. Ask HR or an admin to allow it, or punch with your face."
                }
            }
            else -> {
                errorMessage = networkMessage(ready)
                statusText = "Could not check fingerprint punch."
            }
        }
    }

    Dialog(onDismissRequest = onDismiss) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(DarkSurface)
                .border(1.dp, DarkBorder, RoundedCornerShape(24.dp))
                .padding(20.dp)
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxWidth()
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(BrandSecondary.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Fingerprint,
                                contentDescription = null,
                                tint = BrandSecondary,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Column {
                            Text(
                                text = if (punchType.equals("in", ignoreCase = true)) "Fingerprint Check-In" else "Fingerprint Check-Out",
                                color = TextPrimaryDark,
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = if (isDeviceReady == false) "One-time setup with a face check" else "Signed with this phone's fingerprint key",
                                color = TextMutedDark,
                                fontSize = 11.sp
                            )
                        }
                    }

                    IconButton(onClick = onDismiss, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Default.Close, contentDescription = "Close", tint = TextMutedDark)
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Front Camera Viewport (only for the one-time face check during setup)
                if (isDeviceReady == false) Box(
                    modifier = Modifier
                        .size(190.dp)
                        .clip(RoundedCornerShape(95.dp))
                        .background(Color.Black)
                        .border(
                            2.dp,
                            if (isFingerprintVerified) EmeraldSuccess else BrandSecondary,
                            RoundedCornerShape(95.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    if (hasCameraPermission) {
                        AndroidView(
                            factory = { ctx ->
                                val previewView = PreviewView(ctx).apply {
                                    scaleType = PreviewView.ScaleType.FILL_CENTER
                                }
                                val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
                                cameraProviderFuture.addListener({
                                    val cameraProvider = cameraProviderFuture.get()
                                    val preview = Preview.Builder().build().also {
                                        it.surfaceProvider = previewView.surfaceProvider
                                    }
                                    val capture = ImageCapture.Builder()
                                        .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                                        .build()
                                    imageCapture = capture

                                    val cameraSelector = CameraSelector.Builder()
                                        .requireLensFacing(CameraSelector.LENS_FACING_FRONT)
                                        .build()

                                    try {
                                        cameraProvider.unbindAll()
                                        cameraProvider.bindToLifecycle(
                                            lifecycleOwner,
                                            cameraSelector,
                                            preview,
                                            capture
                                        )
                                    } catch (_: Exception) {}
                                }, ContextCompat.getMainExecutor(ctx))
                                previewView
                            },
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(16.dp)
                        ) {
                            Icon(Icons.Default.CameraAlt, contentDescription = null, tint = TextMutedDark, modifier = Modifier.size(36.dp))
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "Camera ready for snapshot",
                                fontSize = 11.sp,
                                color = TextMutedDark,
                                textAlign = TextAlign.Center
                            )
                        }
                    }

                    // Watermark / Sensor indicator overlay
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .padding(bottom = 10.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.Black.copy(alpha = 0.65f))
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.CameraFront,
                                contentDescription = null,
                                tint = EmeraldSuccess,
                                modifier = Modifier.size(12.dp)
                            )
                            Text(
                                text = "Face check",
                                fontSize = 10.sp,
                                color = Color.White,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Sensor Animation / Status Card
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(DarkSurfaceVariant)
                        .border(
                            1.dp,
                            if (isFingerprintVerified) EmeraldSuccess.copy(alpha = 0.5f) else DarkBorder,
                            RoundedCornerShape(14.dp)
                        )
                        .padding(14.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        if (isPunching) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(32.dp),
                                color = BrandSecondary,
                                strokeWidth = 3.dp
                            )
                        } else if (isFingerprintVerified) {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = EmeraldSuccess,
                                modifier = Modifier.size(36.dp)
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Default.Fingerprint,
                                contentDescription = null,
                                tint = BrandSecondary,
                                modifier = Modifier
                                    .size(38.dp)
                            )
                        }

                        Text(
                            text = statusText,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = if (isFingerprintVerified) EmeraldSuccess else TextPrimaryDark,
                            textAlign = TextAlign.Center
                        )
                    }
                }

                // Error Message Notice
                AnimatedVisibility(visible = errorMessage != null) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 12.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(RoseError.copy(alpha = 0.12f))
                            .border(1.dp, RoseError.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
                            .padding(10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = errorMessage ?: "",
                            color = RoseError,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            textAlign = TextAlign.Center
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Action buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = TextSecondaryDark),
                        border = ButtonDefaults.outlinedButtonBorder.copy(
                            brush = androidx.compose.ui.graphics.SolidColor(DarkBorder)
                        )
                    ) {
                        Text("Cancel")
                    }

                    Button(
                        onClick = { if (isDeviceReady == false) captureSetupSelfie() else promptFingerprint() },
                        enabled = !isPunching && isDeviceReady != null && !isNotAllowed,
                        modifier = Modifier.weight(1.3f),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = BrandSecondary)
                    ) {
                        Icon(if (isDeviceReady == false) Icons.Default.Face else Icons.Default.Fingerprint, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (isDeviceReady == false) "Verify Face" else "Scan Finger", fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}
