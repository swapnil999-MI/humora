package com.paylogic.humora.presentation.screens.chat

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaPlayer
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.paylogic.humora.data.model.ChatMessage
import com.paylogic.humora.pulse.v1.MediaKind
import com.paylogic.humora.presentation.viewmodel.ChatViewModel
import java.io.File

/**
 * PulseChatScreen — the end-to-end encrypted chat: the conversation list and, when one is open,
 * the conversation. Hosts the system pickers (files, camera, microphone permission), voice-message
 * playback, the full-screen image viewer and error messages.
 */
@Composable
fun PulseChatScreen(
    viewModel: ChatViewModel = viewModel(),
    onOpenQrScanner: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }

    // ── Voice message playback (one at a time) ──
    var player by remember { mutableStateOf<MediaPlayer?>(null) }
    var playingId by remember { mutableStateOf<String?>(null) }
    fun stopPlayback() {
        player?.release()
        player = null
        playingId = null
    }
    DisposableEffect(Unit) {
        viewModel.setScreenVisible(true)
        onDispose {
            viewModel.setScreenVisible(false)
            stopPlayback()
        }
    }

    // Android 13+: ask once for permission to show message notifications.
    val notificationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    LaunchedEffect(Unit) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    // ── System pickers ──
    val pickFile = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri ?: return@rememberLauncherForActivityResult
        val mime = context.contentResolver.getType(uri).orEmpty()
        val kind = when {
            mime.startsWith("image/") -> MediaKind.MEDIA_KIND_IMAGE
            mime.startsWith("video/") -> MediaKind.MEDIA_KIND_VIDEO
            mime.startsWith("audio/") -> MediaKind.MEDIA_KIND_AUDIO
            else -> MediaKind.MEDIA_KIND_DOCUMENT
        }
        viewModel.sendAttachment(uri, kind)
    }
    var cameraFile by remember { mutableStateOf<File?>(null) }
    val takePhoto = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val file = cameraFile ?: return@rememberLauncherForActivityResult
        if (ok && file.length() > 0) {
            viewModel.sendAttachment(Uri.fromFile(file), MediaKind.MEDIA_KIND_IMAGE, fileName = "Photo.jpg", mimeType = "image/jpeg")
        }
    }
    fun launchCamera() {
        val dir = File(context.cacheDir, "camera").apply { mkdirs() }
        val file = File(dir, "photo-${System.currentTimeMillis()}.jpg")
        cameraFile = file
        takePhoto.launch(FileProvider.getUriForFile(context, "${context.packageName}.files", file))
    }
    val cameraPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) launchCamera()
    }
    val micPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) viewModel.startRecording()
    }

    fun openAttachment(message: ChatMessage) {
        val att = message.attachment ?: return
        if (att.isVoice && playingId == message.id) {
            stopPlayback()
            return
        }
        viewModel.openAttachment(message) { file, a ->
            when {
                a.isImage -> viewModel.viewImage(file)
                a.isVoice -> {
                    stopPlayback()
                    val mp = MediaPlayer()
                    try {
                        mp.setDataSource(file.absolutePath)
                        mp.setOnCompletionListener { stopPlayback() }
                        mp.prepare()
                        mp.start()
                        player = mp
                        playingId = message.id
                    } catch (e: Exception) {
                        mp.release()
                        viewModel.showError("Could not play this voice message")
                    }
                }
                else -> {
                    val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
                    val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uri, a.mimeType).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    try {
                        context.startActivity(Intent.createChooser(intent, a.fileName))
                    } catch (e: ActivityNotFoundException) {
                        viewModel.showError("No app on this phone can open ${a.fileName}")
                    }
                }
            }
        }
    }

    LaunchedEffect(uiState.error) {
        uiState.error?.let {
            snackbar.showSnackbar(it)
            viewModel.clearError()
        }
    }

    BackHandler(enabled = uiState.isInConversation) {
        stopPlayback()
        if (uiState.recordingSince != null) viewModel.stopRecording(false)
        viewModel.closeConversation()
    }

    Box(Modifier.fillMaxSize()) {
        AnimatedContent(
            targetState = uiState.isInConversation,
            transitionSpec = {
                if (targetState) {
                    slideInHorizontally(initialOffsetX = { it }, animationSpec = tween(300)) togetherWith
                        slideOutHorizontally(targetOffsetX = { -it / 3 }, animationSpec = tween(300))
                } else {
                    slideInHorizontally(initialOffsetX = { -it / 3 }, animationSpec = tween(300)) togetherWith
                        slideOutHorizontally(targetOffsetX = { it }, animationSpec = tween(300))
                }
            },
            label = "PulseChatNav"
        ) { inConversation ->
            if (inConversation) {
                ChatConversationView(
                    uiState = uiState,
                    playingId = playingId,
                    actions = ConversationActions(
                        onBack = {
                            stopPlayback()
                            viewModel.closeConversation()
                        },
                        onSend = viewModel::send,
                        onInputChanged = viewModel::onInputChanged,
                        onLoadOlder = viewModel::loadOlder,
                        onReact = viewModel::toggleReaction,
                        onReply = viewModel::startReply,
                        onEdit = viewModel::startEdit,
                        onDelete = viewModel::delete,
                        onRetry = viewModel::retry,
                        onCancelCompose = viewModel::cancelCompose,
                        onOpenAttachment = ::openAttachment,
                        onAttach = { pickFile.launch("*/*") },
                        onCamera = {
                            if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) launchCamera()
                            else cameraPermission.launch(Manifest.permission.CAMERA)
                        },
                        onStartRecording = {
                            if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) viewModel.startRecording()
                            else micPermission.launch(Manifest.permission.RECORD_AUDIO)
                        },
                        onStopRecording = viewModel::stopRecording,
                    ),
                )
            } else {
                ChatRosterView(
                    uiState = uiState,
                    onSearchChange = viewModel::setSearchQuery,
                    onFilterChange = viewModel::setFilter,
                    onConversationClick = viewModel::openConversation,
                    onNewChat = { viewModel.showNewChat(true) },
                    onQrScanClick = onOpenQrScanner
                )
            }
        }

        uiState.busy?.let { label ->
            Surface(
                color = Color(0xFF1F2C34), shape = MaterialTheme.shapes.medium, shadowElevation = 6.dp,
                modifier = Modifier.align(Alignment.TopCenter).statusBarsPadding().padding(top = 64.dp)
            ) {
                Row(Modifier.padding(horizontal = 14.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(strokeWidth = 2.dp, color = Color(0xFF00A884), modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(10.dp))
                    Text(label, color = Color.White)
                }
            }
        }

        SnackbarHost(snackbar, modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 96.dp))
    }

    if (uiState.showNewChat) {
        NewChatSheet(
            contacts = uiState.contacts,
            onDismiss = { viewModel.showNewChat(false) },
            onDirect = viewModel::startDirect,
            onGroup = viewModel::createGroup,
        )
    }

    uiState.viewingImage?.let { file ->
        Dialog(onDismissRequest = { viewModel.viewImage(null) }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
            Box(Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) {
                AsyncImage(model = file, contentDescription = "Photo", modifier = Modifier.fillMaxWidth())
            }
        }
    }
}
