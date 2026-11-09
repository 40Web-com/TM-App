# TM Game Companion (Android)

This is the native Android companion for TM Game Hub. It requests the system MediaProjection permission, runs capture in a foreground service, samples a reduced-resolution frame approximately once per second, and stops when the user stops monitoring or Android revokes projection access.

## Build

Open this `android-companion` directory in Android Studio with JDK 17 and Android SDK 35, then build the `app` module. Install the resulting APK on the Android phone.

## Current implementation boundary

The capture permission and frame-sampling pipeline are implemented. The current sampler emits only a simple average-luminance sample for pipeline verification; it does **not** yet recognize Free Fire HUD elements, kills, aim, movement, opponents, or match outcomes, and it does not upload or store captured frames. Those require the next vision-model and authenticated TM backend integration. No gameplay input automation or hidden capture is included.

Android may require notification permission for a visible monitoring notification. The system screen-capture consent prompt is required each time a new capture session starts.
