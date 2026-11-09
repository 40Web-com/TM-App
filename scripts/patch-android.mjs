import fs from "node:fs/promises";
const file = "android/app/src/main/AndroidManifest.xml";
let xml = await fs.readFile(file, "utf8");
if (!xml.includes('android:scheme="tmapp"')) {
  xml = xml.replace(/(<activity[^>]*android:name="\.MainActivity"[\s\S]*?<\/activity>)/, block => {
    const updated = block.replace("<activity", '<activity android:launchMode="singleTask"');
    return updated.replace("</activity>", `
      <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="tmapp" android:host="auth" android:pathPrefix="/callback" />
      </intent-filter>
    </activity>`);
  });
}
await fs.writeFile(file, xml);
console.log("Configured tmapp://auth/callback deep link.");
