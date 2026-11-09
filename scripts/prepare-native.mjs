import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const out = path.join(root, "www");
const skip = new Set([".git", "node_modules", "www", "android", ".github", ".vscode"]);
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });
async function copyDir(from, to) {
  for (const entry of await fs.readdir(from, { withFileTypes: true })) {
    if (skip.has(entry.name) && from === root) continue;
    if (entry.name === "package-lock.json" || entry.name === "capacitor.config.json" || entry.name === "vite.native.config.js" || entry.name === "native-entry.js" || entry.name === "scripts") continue;
    const src = path.join(from, entry.name), dest = path.join(to, entry.name);
    if (entry.isDirectory()) { await fs.mkdir(dest, { recursive: true }); await copyDir(src, dest); }
    else if (entry.isFile()) await fs.copyFile(src, dest);
  }
}
await copyDir(root, out);
const indexPath = path.join(out, "index.html");
let html = await fs.readFile(indexPath, "utf8");
html = html.replace(/<script src="\.\/main\.js[^"]*" defer><\/script>/, '<script type="module" src="./assets/native-entry.js"></script>');
html = html.replace(/<script>if \("serviceWorker" in navigator\)[\s\S]*?<\/script>/, "");
html = html.replace(/<button id="tm-install-app"[\s\S]*?<\/button>\s*<div id="tm-install-help"[\s\S]*?<\/div>/, "");
await fs.writeFile(indexPath, html);
const svg = await fs.readFile(path.join(root, "logo.svg"));
await fs.mkdir(path.join(root, "resources"), { recursive: true });
await sharp(svg).resize(1024, 1024, { fit: "contain", background: "#100626" }).png().toFile(path.join(root, "resources/icon.png"));
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#100626" } }).png().toFile(path.join(root, "resources/splash.png"));
console.log("Prepared bundled TM App assets and launcher artwork.");
