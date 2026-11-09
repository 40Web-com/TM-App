import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
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
const svg = await fs.readFile("logo.svg");
const densities = { "mipmap-mdpi":48, "mipmap-hdpi":72, "mipmap-xhdpi":96, "mipmap-xxhdpi":144, "mipmap-xxxhdpi":192 };
for (const [folder,size] of Object.entries(densities)) {
  const dir = path.join("android/app/src/main/res", folder);
  await fs.mkdir(dir, { recursive: true });
  const png = await sharp(svg).resize(size,size,{fit:"contain",background:"#100626"}).png().toBuffer();
  await fs.writeFile(path.join(dir,"ic_launcher.png"),png);
  await fs.writeFile(path.join(dir,"ic_launcher_round.png"),png);
}
console.log("Configured TM launcher icons and tmapp://auth/callback deep link.");
