import fs from "node:fs/promises";
const file = "android/app/src/main/AndroidManifest.xml";
let xml = await fs.readFile(file, "utf8");
if (!xml.includes('android:scheme="tmapp"')) {
  const activity = /<activity[^>]*android:name="[^"]*MainActivity"[^>]*>[\s\S]*?<\/activity>/;
  if (!activity.test(xml)) throw new Error("Capacitor MainActivity was not found in AndroidManifest.xml");
  xml = xml.replace(activity, block => block.replace("</activity>", `
      <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="tmapp" android:host="auth" android:pathPrefix="/callback" />
      </intent-filter>
    </activity>`));
}
await fs.writeFile(file, xml);
console.log("Configured tmapp://auth/callback deep link.");
