"use strict";

const APP = "naija-devkit";
const VERSION = "0.0.1";
const DB_NAME = "naija-devkit";
const DB_VERSION = 2;
const KEYS = "ndk.keys.v1";
const PREFS = "ndk.prefs.v1";
const GH = "https://github.com/aydanmoussa74-a11y/naija-devkit";
const PAGES = ["welcome", "home", "workspace", "toolbox", "settings", "editor", "preview", "search", "ai", "tool"];
const DOCK_PAGES = ["home", "workspace", "toolbox", "settings"];
const EXT = { html: "html", css: "css", js: "js", ts: "ts", py: "py", md: "md", json: "json", txt: "txt" };
const MIME = {
  html: "text/html", css: "text/css", js: "text/javascript", ts: "text/plain",
  py: "text/x-python", md: "text/markdown", json: "application/json", txt: "text/plain"
};
const CHIPS = {
  html: ["</>", "{}", "()", "[]", "=", "\"\"", "<div>", "<p>", "<a>", "<img>", "class", "id"],
  css: ["{}", ":", ";", "#", ".", "flex", "grid", "color"],
  js: ["{}", "()", "[]", "=>", "const ", "let ", "function ", "return "],
  ts: ["{}", "()", "=>", "type ", "interface "],
  py: ["def ", "return ", "if ", "for ", "print(", ":"],
  md: ["# ", "## ", "- ", "** **", "` `", "[]()", "```"],
  json: ["{}", "[]", ":", ",", "\"\""],
  txt: []
};
const FILTERS = ["all", "html", "css", "js", "md", "json", "txt"];
const TOOLS = [
  { id: "snippets", label: "Snippets" },
  { id: "regex", label: "Regex" },
  { id: "json", label: "JSON" },
  { id: "runner", label: "Runner" }
];

const $ = (id) => document.getElementById(id);

const state = {
  files: [],
  session: sess(),
  lab: {
    regex: { pattern: "", flags: "g", sample: "" },
    json: "",
    runner: "<!DOCTYPE html>\n<html><body>\n<h1>hello</h1>\n</body></html>\n",
    snippets: [],
    recents: []
  },
  messages: [],
  persistTimer: 0,
  filter: "all",
  lastHub: "home",
  dirty: false,
  chipsOpen: true
};

function sess() {
  return {
    id: "ui", mode: "welcome", openIds: [], activeId: null, cursor: 0, scrollTop: 0,
    welcomeSeen: false, place: "code", filter: "all", lastHub: "home", tool: null, updatedAt: now()
  };
}
function now() { return new Date().toISOString(); }
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function toast(msg) {
  const el = $("toast"); el.textContent = msg; el.classList.add("on");
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("on"), 2200);
}
function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 10); } catch (_e) {} }
function langFromName(name) {
  const ext = String(name || "").split(".").pop().toLowerCase();
  return EXT[ext] || "txt";
}
function placeFor(file, override) {
  if (override) return override;
  if (!file) return "code";
  if (file.place) return file.place;
  if (file.language === "md") return "markdown";
  if (file.language === "txt") return "text";
  return "code";
}
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      ["files", "session", "lab", "messages"].forEach((n) => {
        if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath: "id" });
      });
      if (db.objectStoreNames.contains("items")) {
        const tx = req.transaction;
        tx.objectStore("items").getAll().onsuccess = (ev) => {
          (ev.target.result || []).forEach((item) => {
            const name = safeName(item.title || "untitled", item.language || "txt");
            tx.objectStore("files").put({
              id: item.id || uuid(), name, path: name, body: item.body || "",
              language: item.language || langFromName(name),
              createdAt: item.createdAt || now(), updatedAt: item.updatedAt || now(), source: "migrated"
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
    const req = db.transaction(store, "readonly").objectStore(store).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
async function putOf(store, value) {
  const db = await openDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value);
  await txDone(tx); db.close();
}
async function delOf(store, id) {
  const db = await openDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).delete(id);
  await txDone(tx); db.close();
}
async function clearOf(store) {
  const db = await openDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).clear();
  await txDone(tx); db.close();
}
function safeName(title, lang) {
  const base = String(title || "untitled").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";
  const ext = EXT[lang] || "txt";
  return base.endsWith("." + ext) ? base : `${base}.${ext}`;
}
function uniqueName(name) {
  const have = new Set(state.files.map((f) => f.path));
  if (!have.has(name)) return name;
  const i = name.lastIndexOf(".");
  const stem = i >= 0 ? name.slice(0, i) : name;
  const ext = i >= 0 ? name.slice(i) : "";
  let n = 2;
  while (have.has(`${stem}-${n}${ext}`)) n += 1;
  return `${stem}-${n}${ext}`;
}
function readKeys() { try { return JSON.parse(localStorage.getItem(KEYS) || "{}"); } catch (_e) { return {}; } }
function writeKeys(k) { localStorage.setItem(KEYS, JSON.stringify(k)); }
function readPrefs() {
  try { return Object.assign({ wrap: true, font: "16", restore: true, chips: true }, JSON.parse(localStorage.getItem(PREFS) || "{}")); }
  catch (_e) { return { wrap: true, font: "16", restore: true, chips: true }; }
}
function writePrefs(p) { localStorage.setItem(PREFS, JSON.stringify(p)); }
function activeFile() { return state.files.find((f) => f.id === state.session.activeId) || null; }
function sortedFiles() { return state.files.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))); }
async function saveFile(file) {
  file.updatedAt = now();
  const i = state.files.findIndex((f) => f.id === file.id);
  if (i >= 0) state.files[i] = file; else state.files.push(file);
  await putOf("files", file);
}
async function saveSession() {
  state.session.updatedAt = now();
  state.session.filter = state.filter;
  state.session.lastHub = state.lastHub;
  await putOf("session", state.session);
}
async function saveLab() { await putOf("lab", Object.assign({ id: "lab" }, state.lab)); }
function schedulePersist() {
  state.dirty = true;
  const dot = $("ed-dirty"); if (dot) dot.hidden = false;
  clearTimeout(state.persistTimer);
  state.persistTimer = setTimeout(flushEditor, 400);
}
async function flushEditor() {
  const file = activeFile(); const ed = $("code");
  if (!file || !ed) return;
  file.body = ed.value;
  state.session.cursor = ed.selectionStart || 0;
  state.session.scrollTop = ed.scrollTop || 0;
  await saveFile(file); await saveSession();
  state.dirty = false;
  const dot = $("ed-dirty"); if (dot) dot.hidden = true;
}
function downloadBlob(name, body, type) {
  const blob = new Blob([body], { type: type || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}
function renderMd(src) {
  const lines = String(src || "").split("\n");
  const out = []; let fence = false; let buf = [];
  const flush = () => { if (!buf.length) return; out.push("<p>" + inline(buf.join(" ")) + "</p>"); buf = []; };
  const inline = (t) => escapeHtml(t)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  lines.forEach((line) => {
    if (line.startsWith("```")) {
      if (fence) { out.push("<pre><code>" + escapeHtml(buf.join("\n")) + "</code></pre>"); buf = []; fence = false; }
      else { flush(); fence = true; }
      return;
    }
    if (fence) { buf.push(line); return; }
    if (/^### /.test(line)) { flush(); out.push("<h3>" + inline(line.slice(4)) + "</h3>"); }
    else if (/^## /.test(line)) { flush(); out.push("<h2>" + inline(line.slice(3)) + "</h2>"); }
    else if (/^# /.test(line)) { flush(); out.push("<h1>" + inline(line.slice(2)) + "</h1>"); }
    else if (/^[-*] /.test(line)) { flush(); out.push("<li>" + inline(line.slice(2)) + "</li>"); }
    else if (!line.trim()) flush();
    else buf.push(line);
  });
  if (fence) out.push("<pre><code>" + escapeHtml(buf.join("\n")) + "</code></pre>");
  else flush();
  return out.join("");
}
