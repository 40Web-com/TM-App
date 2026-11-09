package com.tm.gamecompanion

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.util.DisplayMetrics
import android.view.WindowManager
import kotlin.math.max

class ScreenCaptureService : Service() {
    companion object {
        const val ACTION_STOP = "com.tm.gamecompanion.STOP"
        const val EXTRA_RESULT_CODE = "result_code"
        const val EXTRA_RESULT_DATA = "result_data"
        private const val CHANNEL_ID = "tm_game_monitor"
        private const val NOTIFICATION_ID = 77
    }

    private var projection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private var worker: HandlerThread? = null
    private var handler: Handler? = null
    private var lastSampleAt = 0L

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopCapture()
            stopSelf()
            return START_NOT_STICKY
        }
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
        val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, 0) ?: 0
        val data = if (Build.VERSION.SDK_INT >= 33) intent?.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java) else @Suppress("DEPRECATION") intent?.getParcelableExtra(EXTRA_RESULT_DATA)
        if (resultCode == 0 || data == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        beginCapture(resultCode, data)
        return START_NOT_STICKY
    }

    private fun beginCapture(resultCode: Int, data: Intent) {
        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        (getSystemService(WINDOW_SERVICE) as WindowManager).defaultDisplay.getRealMetrics(metrics)
        val width = max(1, metrics.widthPixels / 2)
        val height = max(1, metrics.heightPixels / 2)
        val density = metrics.densityDpi
        worker = HandlerThread("tm-frame-sampler").also { it.start() }
        handler = Handler(worker!!.looper)
        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 3)
        imageReader?.setOnImageAvailableListener({ reader ->
            val now = System.currentTimeMillis()
            if (now - lastSampleAt < 1000) {
                reader.acquireLatestImage()?.close()
                return@setOnImageAvailableListener
            }
            lastSampleAt = now
            reader.acquireLatestImage()?.use { image ->
                val plane = image.planes.firstOrNull() ?: return@use
                val buffer = plane.buffer
                val pixelStride = plane.pixelStride
                val rowStride = plane.rowStride
                val row = ByteArray(rowStride)
                var total = 0L
                var count = 0L
                val y = image.height / 2
                buffer.position(y * rowStride)
                buffer.get(row, 0, minOf(row.size, buffer.remaining()))
                var x = 0
                while (x < image.width) {
                    val offset = x * pixelStride
                    if (offset + 2 < row.size) {
                        val red = row[offset].toInt() and 0xff
                        val green = row[offset + 1].toInt() and 0xff
                        val blue = row[offset + 2].toInt() and 0xff
                        total += (red * 299 + green * 587 + blue * 114) / 1000
                        count++
                    }
                    x += 12
                }
                val averageLuma = if (count > 0) total / count else 0
                val update = Intent("com.tm.gamecompanion.FRAME_SAMPLE").setPackage(packageName)
                    .putExtra("timestamp", now).putExtra("average_luma", averageLuma)
                sendBroadcast(update)
            }
        }, handler)
        val manager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        projection = manager.getMediaProjection(resultCode, data)
        projection?.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() {
                stopCapture()
                stopSelf()
            }
        }, handler)
        virtualDisplay = projection?.createVirtualDisplay("TMGameplayCapture", width, height, density,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, imageReader?.surface, null, handler)
    }

    private fun stopCapture() {
        imageReader?.setOnImageAvailableListener(null, null)
        virtualDisplay?.release(); virtualDisplay = null
        imageReader?.close(); imageReader = null
        projection?.stop(); projection = null
        worker?.quitSafely(); worker = null; handler = null
        stopForeground(STOP_FOREGROUND_REMOVE)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel(CHANNEL_ID, "Gameplay monitoring", NotificationManager.IMPORTANCE_LOW)
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL_ID) else Notification.Builder(this)
        return builder.setContentTitle("TM Game Companion")
            .setContentText("Gameplay screen monitoring is active. Tap Stop in the companion to end capture.")
            .setSmallIcon(android.R.drawable.ic_menu_view).setOngoing(true).build()
    }

    override fun onDestroy() { stopCapture(); super.onDestroy() }
    override fun onBind(intent: Intent?): IBinder? = null
}
