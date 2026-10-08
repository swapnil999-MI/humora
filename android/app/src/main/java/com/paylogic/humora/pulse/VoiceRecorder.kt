package com.paylogic.humora.pulse

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.File

/** Records a voice note to an AAC (.m4a) file and samples its loudness for the waveform. */
class VoiceRecorder(private val context: Context) {
    class Recording(val file: File, val durationMs: Int, val waveform: ByteArray)

    private var recorder: MediaRecorder? = null
    private var file: File? = null
    private var startedAt = 0L
    private val levels = mutableListOf<Int>()
    private var sampler: Job? = null

    val isRecording: Boolean get() = recorder != null

    fun start(scope: CoroutineScope) {
        if (recorder != null) return
        val out = File(context.cacheDir, "voice-${System.currentTimeMillis()}.m4a")
        val r = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(context) else @Suppress("DEPRECATION") MediaRecorder()
        r.setAudioSource(MediaRecorder.AudioSource.MIC)
        r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        r.setAudioEncodingBitRate(48_000)
        r.setAudioSamplingRate(44_100)
        r.setOutputFile(out.absolutePath)
        r.prepare()
        r.start()
        recorder = r
        file = out
        startedAt = System.currentTimeMillis()
        levels.clear()
        sampler = scope.launch {
            while (isActive) {
                levels += recorder?.maxAmplitude ?: 0
                delay(100)
            }
        }
    }

    /** Stops and returns the recording, or null if it was too short to keep. */
    fun stop(): Recording? {
        val r = recorder ?: return null
        sampler?.cancel()
        recorder = null
        val duration = (System.currentTimeMillis() - startedAt).toInt()
        val ok = runCatching { r.stop() }.isSuccess
        r.release()
        val f = file ?: return null
        if (!ok || duration < 700) {
            f.delete()
            return null
        }
        return Recording(f, duration, waveform())
    }

    fun cancel() {
        val r = recorder ?: return
        sampler?.cancel()
        recorder = null
        runCatching { r.stop() }
        r.release()
        file?.delete()
    }

    /** 40 bars, scaled so the loudest is 255. */
    private fun waveform(): ByteArray {
        val bars = 40
        if (levels.isEmpty()) return ByteArray(bars) { 90.toByte() }
        val step = maxOf(1, levels.size / bars)
        val peaks = List(bars) { i -> levels.subList(minOf(i * step, levels.size), minOf((i + 1) * step, levels.size)).maxOrNull() ?: 0 }
        val loudest = maxOf(1, peaks.max())
        return ByteArray(bars) { (peaks[it] * 255 / loudest).toByte() }
    }
}
