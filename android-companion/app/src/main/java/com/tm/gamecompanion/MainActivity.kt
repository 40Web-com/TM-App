package com.tm.gamecompanion

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import org.json.JSONObject

class MainActivity : Activity() {
    companion object {
        private const val CAPTURE_REQUEST = 4107
        private const val HOME_URL = "https://40web-com.github.io/TM-App/"
        private const val METRICS_PREFS = "tm_capture_metrics"
    }

    private lateinit var webView: WebView
    private var receiverRegistered = false
    private val projectionManager by lazy {
        getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    }

    private val frameReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (::webView.isInitialized) {
                webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('tm-frame-sample'));",
                    null
                )
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.loadsImagesAutomatically = true
        webView.settings.javaScriptCanOpenWindowsAutomatically = false
        webView.settings.allowFileAccess = false
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.scheme == "https" && uri.host == "40web-com.github.io") return false
                if (uri.scheme == "http" || uri.scheme == "https") {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    return true
                }
                return true
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                dispatchCaptureStatus()
            }
        }
        webView.addJavascriptInterface(TmNativeBridge(), "TMNative")
        setContentView(webView)

        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(frameReceiver, IntentFilter("com.tm.gamecompanion.FRAME_SAMPLE"), Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            registerReceiver(frameReceiver, IntentFilter("com.tm.gamecompanion.FRAME_SAMPLE"))
        }
        receiverRegistered = true

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl(HOME_URL)
        }
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) dispatchCaptureStatus()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        if (::webView.isInitialized) webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    @Deprecated("Android permission result callback")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != CAPTURE_REQUEST) return

        if (resultCode == RESULT_OK && data != null) {
            val service = Intent(this, ScreenCaptureService::class.java).apply {
                putExtra(ScreenCaptureService.EXTRA_RESULT_CODE, resultCode)
                putExtra(ScreenCaptureService.EXTRA_RESULT_DATA, data)
            }
            startForegroundService(service)
            Toast.makeText(this, "TM Game Hub screen monitoring started", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "Screen capture permission was not granted", Toast.LENGTH_SHORT).show()
        }
        dispatchCaptureStatus()
    }

    private fun dispatchCaptureStatus() {
        if (!::webView.isInitialized) return
        webView.post {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('tm-capture-status'));",
                null
            )
        }
    }

    private inner class TmNativeBridge {
        @JavascriptInterface
        fun startCapture() {
            runOnUiThread {
                if (isCaptureActive()) {
                    dispatchCaptureStatus()
                } else {
                    startActivityForResult(projectionManager.createScreenCaptureIntent(), CAPTURE_REQUEST)
                }
            }
        }

        @JavascriptInterface
        fun stopCapture() {
            runOnUiThread {
                startService(Intent(this@MainActivity, ScreenCaptureService::class.java).setAction(ScreenCaptureService.ACTION_STOP))
                dispatchCaptureStatus()
            }
        }

        @JavascriptInterface
        fun isCaptureActive(): Boolean {
            val prefs = getSharedPreferences(METRICS_PREFS, MODE_PRIVATE)
            val lastSample = prefs.getLong("last_sample_at", 0L)
            return lastSample > 0L && System.currentTimeMillis() - lastSample < 3500L
        }

        @JavascriptInterface
        fun getCaptureMetrics(): String {
            val prefs = getSharedPreferences(METRICS_PREFS, MODE_PRIVATE)
            val lastSample = prefs.getLong("last_sample_at", 0L)
            val active = lastSample > 0L && System.currentTimeMillis() - lastSample < 3500L
            return JSONObject().apply {
                put("active", active)
                put("sampleCount", prefs.getLong("sample_count", 0L))
                put("averageLuma", prefs.getLong("average_luma", -1L))
                put("lastSampleAt", lastSample)
            }.toString()
        }
    }

    @Deprecated("Deprecated in Android API")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        if (receiverRegistered) {
            unregisterReceiver(frameReceiver)
            receiverRegistered = false
        }
        if (::webView.isInitialized) webView.destroy()
        super.onDestroy()
    }
}
