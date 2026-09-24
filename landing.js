"use strict";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

let deferredPrompt = null;
const installBtn = document.getElementById("btn-install");
const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault(); deferredPrompt = event;
  if (installBtn) installBtn.hidden = false;
});

if (installBtn) installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  try { await deferredPrompt.userChoice; } catch (_error) {}
  deferredPrompt = null; installBtn.hidden = true;
});
window.addEventListener("appinstalled", () => { if (installBtn) installBtn.hidden = true; });

if (menuToggle && siteNav) {
  menuToggle.addEventListener("click", () => {
    const open = siteNav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.textContent = open ? "Close" : "Menu";
  });
  siteNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    siteNav.classList.remove("open"); menuToggle.setAttribute("aria-expanded", "false"); menuToggle.textContent = "Menu";
  }));
}

const revealItems = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries, obs) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add("visible"); obs.unobserve(entry.target); }
  }), { threshold: .12 });
  revealItems.forEach((item) => observer.observe(item));
} else revealItems.forEach((item) => item.classList.add("visible"));
