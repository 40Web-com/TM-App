package com.tm.gamecompanion

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    private val captureRequest = 4107
    private lateinit var status: TextView
    private lateinit var returnButton: Button
    private var callbackUrl: String? = null
    private val projectionManager by lazy { getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager }
    private val uiHandler = Handler(Looper.getMainLooper())
    private val metricsRefresh = object : Runnable {
        override fun run() {
            refreshCaptureStatus()
            uiHandler.postDelayed(this, 1000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        callbackUrl = intent?.data?.getQueryParameter("callback")
        buildScreen()
    }

    override fun onResume() {
        super.onResume()
        uiHandler.removeCallbacks(metricsRefresh)
        uiHandler.post(metricsRefresh)
    }

    override fun onPause() {
        uiHandler.removeCallbacks(metricsRefresh)
        super.onPause()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        callbackUrl = intent?.data?.getQueryParameter("callback") ?: callbackUrl
    }

    private fun buildScreen() {
        val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(40, 64, 40, 40) }
        status = TextView(this).apply {
            text = "TM GAME COMPANION\n\nReady to connect to TM Game Hub. Screen capture starts only after you approve Android permission."
            textSize = 18f
        }
        val start = Button(this).apply {
            text = "Allow screen capture"
            setOnClickListener {
                startActivityForResult(projectionManager.createScreenCaptureIntent(), captureRequest)
            }
        }
        val stop = Button(this).apply {
            text = "Stop monitoring"
            setOnClickListener {
                startService(Intent(this@MainActivity, ScreenCaptureService::class.java).setAction(ScreenCaptureService.ACTION_STOP))
                status.text = "Monitoring stopped. No screen frames are being captured."
                returnButton.isEnabled = false
            }
        }
        returnButton = Button(this).apply {
            text = "Return to TM Game Hub"
            isEnabled = false
            setOnClickListener { returnToTm() }
        }
        layout.addView(status, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        layout.addView(start)
        layout.addView(stop)
        layout.addView(returnButton)
        setContentView(layout)
    }

    @Deprecated("Android permission result callback")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != captureRequest) return
        if (resultCode == RESULT_OK && data != null) {
            val service = Intent(this, ScreenCaptureService::class.java).apply {
                putExtra(ScreenCaptureService.EXTRA_RESULT_CODE, resultCode)
                putExtra(ScreenCaptureService.EXTRA_RESULT_DATA, data)
            }
            startForegroundService(service)
            status.text = "Permission granted. Waiting for the first screen sample…"
        } else {
            status.text = "Permission not granted. Monitoring is off."
            returnButton.isEnabled = false
        }
    }

    private fun refreshCaptureStatus() {
        if (!::status.isInitialized) return
        val metrics = getSharedPreferences("tm_capture_metrics", MODE_PRIVATE)
        val samples = metrics.getLong("sample_count", 0L)
        val luma = metrics.getLong("average_luma", -1L)
        val lastSample = metrics.getLong("last_sample_at", 0L)
        if (lastSample > 0L && System.currentTimeMillis() - lastSample < 5000L) {
            status.text = "TM GAME COMPANION\n\nSCREEN CAPTURE ACTIVE\nFrames sampled: $samples\nLatest brightness sample: $luma / 255\n\nThis confirms frames are reaching the on-device sampler. It does not yet mean Free Fire events or player skill are being analysed."
            returnButton.isEnabled = true
        } else if (samples > 0L) {
            status.text = "TM GAME COMPANION\n\nNo recent screen sample. Re-open capture permission if monitoring stopped.\nTotal samples recorded: $samples"
            returnButton.isEnabled = false
        }
    }

    private fun returnToTm() {
        val base = callbackUrl ?: "https://40web-com.github.io/TM-App/"
        val uri = Uri.parse(base).buildUpon()
            .appendQueryParameter("tm_companion", "connected")
            .appendQueryParameter("tm_companion_time", System.currentTimeMillis().toString())
            .build()
        startActivity(Intent(Intent.ACTION_VIEW, uri))
    }
}
