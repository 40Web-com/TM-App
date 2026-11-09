package com.tm.gamecompanion

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.view.ViewGroup

class MainActivity : Activity() {
    private val captureRequest = 4107
    private lateinit var status: TextView
    private val projectionManager by lazy { getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 64, 40, 40)
        }
        status = TextView(this).apply {
            text = "TM GAME COMPANION\n\nReady to monitor gameplay.\nScreen capture starts only after you approve Android's permission prompt."
            textSize = 18f
        }
        val start = Button(this).apply {
            text = "Start gameplay monitoring"
            setOnClickListener { startActivityForResult(projectionManager.createScreenCaptureIntent(), captureRequest) }
        }
        val stop = Button(this).apply {
            text = "Stop monitoring"
            setOnClickListener {
                startService(Intent(this@MainActivity, ScreenCaptureService::class.java).setAction(ScreenCaptureService.ACTION_STOP))
                status.text = "Monitoring stopped. No screen frames are being captured."
            }
        }
        layout.addView(status, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        layout.addView(start)
        layout.addView(stop)
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
            status.text = "Monitoring active. Android's screen-sharing indicator remains visible.\n\nLocal frame sampling is running; game-specific AI interpretation is the next integration stage."
        } else {
            status.text = "Permission not granted. Monitoring is off."
        }
    }
}
