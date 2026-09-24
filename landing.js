"use strict";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

let deferredPrompt = null;
const installBtn = document.getElementById("btn-install");

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  if (installBtn) installBtn.hidden = false;
});

if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch (_e) {}
    deferredPrompt = null;
    installBtn.hidden = true;
  });
}

window.addEventListener("appinstalled", () => {
  if (installBtn) installBtn.hidden = true;
});
