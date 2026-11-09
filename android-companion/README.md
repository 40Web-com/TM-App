# TM Game Hub Android App

This Android app opens the existing TM App web experience inside a native WebView. The existing website/PWA remains the main interface; the Android shell adds the native MediaProjection permission and foreground screen-capture service required for live gameplay monitoring.

The Android application ID remains `com.tm.gamecompanion` so a future TM Game Hub APK can update an already-installed companion package instead of installing a second app. The launcher name is **TM Game Hub**.

## Build

Use JDK 17 and Android SDK 35. The GitHub Actions workflow builds a debug APK and publishes it as a prerelease asset.

## Current implementation boundary

The capture permission and frame-sampling pipeline are implemented. The sampler currently emits a simple average-luminance metric about once per second for pipeline verification. It does **not** yet recognize Free Fire HUD elements, kills, aim, movement, opponents, or match outcomes, and it does not upload or store captured frames. Those require the next vision-model and authenticated TM backend integration. No gameplay input automation or hidden capture is included.

Android's system screen-capture consent prompt is required each time a new capture session starts. The capture service runs with a visible foreground notification.
