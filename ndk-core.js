"use strict";
const APP = "naija-devkit";
const VERSION = "0.0.1";
const DB_NAME = "naija-devkit";
const DB_VERSION = 2;
const KEYS = "ndk.keys.v1";
const PREFS = "ndk.prefs.v1";
const GH = "https://github.com/aydanmoussa74-a11y/naija-devkit";
const EXT = { html:"html", css:"css", js:"js", ts:"ts", py:"py", md:"md", json:"json", txt:"txt" };
const MIME = { html:"text/html", css:"text/css", js:"text/javascript", ts:"text/plain", py:"text/x-python", md:"text/markdown", json:"application/json", txt:"text/plain" };
const CHIPS = {
  html: ["<div>","<a>","<img>","<p>","class","id","href","src","=","\"\"","<",">","</","<!-- -->"],
  css: ["{","}",":",";","color","display","flex","#","."],
  js: ["const ","function ","return ","=>","{}","()","[]","await "],
  py: ["def ","return ","if ","for ","print(",")",":"],
  md: ["# ","## ","- ","** **","` `","[]()","```"],
  json: ["{","}","[","]",":",",","\"\""],
  txt: []
};
const $ = (id) => document.getElementById(id);
function sess() {
  return { id:"ui", mode:"home", openIds:[], activeId:null, cursor:0, scrollTop:0, drawerOpen:false, welcomeSeen:false, viewMode:"code", updatedAt:now() };
}
function now() { return new Date().toISOString(); }
const state = { files:[], session:sess(), lab:{ regex:{pattern:"",flags:"g",sample:""}, json:"", vibe:"<!DOCTYPE html>\n<h1>hello</h1>\n" }, messages:[], persistTimer:0 };
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map((x) => x.toString(16).padStart(2,"0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
function toast(msg) {
  const el = $("toast"); el.textContent = msg; el.classList.add("on");
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("on"), 2200);
}
function langFromName(name) {
  const ext = String(name || "").split(".").pop().toLowerCase();
  return EXT[ext] || "txt";
}
function modeFor(file) {
  if (!file) return "code";
  if (file.viewMode) return file.viewMode;
  if (file.language === "md") return "markdown";
  if (file.language === "txt") return "text";
  return "code";
}
function escapeHtml(s) {
  return String(s).replace(/&/g,"&").replace(/</g,"<").replace(/>/g,">");
}
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      ["files","session","lab","messages"].forEach((n) => {
        if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath:"id" });
      });
      if (db.objectStoreNames.contains("items")) {
        const tx = req.transaction;
        tx.objectStore("items").getAll().onsuccess = (ev) => {
          (ev.target.result || []).forEach((item) => {
            const name = safeName(item.title || "untitled", item.language || "txt");
            tx.objectStore("files").put({
              id: item.id || uuid(), name, path:name, body:item.body || "",
              language: item.language || langFromName(name), createdAt:item.createdAt || now(),
              updatedAt:item.updatedAt || now(), source:"migrated"
            });
          });
        };
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
async function allOf(store) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store,"readonly").objectStore(store).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
async function putOf(store, value) {
  const db = await openDb();
  const tx = db.transaction(store,"readwrite");
  tx.objectStore(store).put(value);
  await txDone(tx); db.close();
}
async function clearOf(store) {
  const db = await openDb();
  const tx = db.transaction(store,"readwrite");
  tx.objectStore(store).clear();
  await txDone(tx); db.close();
}
function safeName(title, lang) {
  const base = String(title || "untitled").toLowerCase().replace(/[^a-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"") || "untitled";
  const ext = EXT[lang] || "txt";
  return base.endsWith("."+ext) ? base : `${base}.${ext}`;
}
function uniqueName(name) {
  const have = new Set(state.files.map((f) => f.path));
  if (!have.has(name)) return name;
  const i = name.lastIndexOf(".");
  const stem = i >= 0 ? name.slice(0,i) : name;
  const ext = i >= 0 ? name.slice(i) : "";
  let n = 2;
  while (have.has(`${stem}-${n}${ext}`)) n += 1;
  return `${stem}-${n}${ext}`;
}
function readKeys() { try { return JSON.parse(localStorage.getItem(KEYS) || "{}"); } catch(_e) { return {}; } }
function writeKeys(k) { localStorage.setItem(KEYS, JSON.stringify(k)); }
function readPrefs() {
  try { return Object.assign({ wrap:true, font:"16", restore:true, chips:true }, JSON.parse(localStorage.getItem(PREFS) || "{}")); }
  catch(_e) { return { wrap:true, font:"16", restore:true, chips:true }; }
}
function writePrefs(p) { localStorage.setItem(PREFS, JSON.stringify(p)); }
function applyPrefs() {
  const p = readPrefs();
  document.documentElement.style.setProperty("--font", `${p.font}px`);
  $("editor").style.whiteSpace = p.wrap ? "pre-wrap" : "pre";
  $("chips").style.display = p.chips === false ? "none" : "flex";
}
function activeFile() { return state.files.find((f) => f.id === state.session.activeId) || null; }
function upsert(file) {
  const i = state.files.findIndex((f) => f.id === file.id);
  if (i >= 0) state.files.splice(i,1,file); else state.files.unshift(file);
  state.files.sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
async function saveFile(file) {
  file.updatedAt = now();
  await putOf("files", file);
  upsert(file);
}
async function saveSession() {
  state.session.updatedAt = now();
  await putOf("session", state.session);
}
function scheduleSave() {
  clearTimeout(state.persistTimer);
  state.persistTimer = setTimeout(flushEditor, 400);
}
async function flushEditor() {
  const file = activeFile();
  if (!file) return;
  file.body = $("editor").value;
  file.viewMode = $("view-mode").value;
  state.session.cursor = $("editor").selectionStart;
  state.session.scrollTop = $("editor").scrollTop;
  try { await saveFile(file); await saveSession(); }
  catch (err) { toast(err && err.name === "QuotaExceededError" ? "Storage full. Export a backup." : "Save failed"); }
}
Object.assign(window, { APP, VERSION, DB_NAME, DB_VERSION, KEYS, PREFS, GH, EXT, MIME, CHIPS, $, state });
