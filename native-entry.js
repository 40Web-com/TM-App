import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";

// Native bridge is available before the existing TM interface starts.
window.TMNative = {
  isNative: true,
  openBrowser: (url) => Browser.open({ url, presentationStyle: "popover" })
};

App.addListener("appUrlOpen", ({ url }) => {
  if (url && url.startsWith("tmapp://auth/callback")) {
    window.dispatchEvent(new CustomEvent("tm-native-oauth-callback", { detail: { url } }));
  }
});

function startTM() {
  if (document.querySelector('script[data-tm-main]')) return;
  const script = document.createElement("script");
  script.src = "./main.js";
  script.defer = true;
  script.dataset.tmMain = "true";
  document.body.appendChild(script);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startTM, { once: true });
else startTM();
