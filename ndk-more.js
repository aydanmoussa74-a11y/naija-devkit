"use strict";

function previewSrc(file) {
  if (!file) return "";
  if (file.language === "html" || /\.html?$/i.test(file.name)) return file.body || "";
  if (file.language === "md" || state.session.place === "markdown") return null;
  const escaped = escapeHtml(file.body || "");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font:14px/1.45 ui-monospace,monospace;padding:16px;white-space:pre-wrap}</style></head><body>${escaped}</body></html>`;
}
function paintPreview() {
  const file = activeFile(); const stage = $("pv-stage"); const log = $("pv-log");
  stage.innerHTML = ""; log.hidden = true;
  if (!file) { $("pv-title").textContent = "Preview"; stage.textContent = "No file"; return; }
  $("pv-title").textContent = file.name;
  if (file.language === "md" || state.session.place === "markdown") {
    const view = document.createElement("div"); view.className = "md-view"; view.innerHTML = renderMd(file.body || "");
    stage.appendChild(view); return;
  }
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-scripts allow-modals"); iframe.title = "Local preview";
  stage.appendChild(iframe); iframe.srcdoc = previewSrc(file);
}
function paintTool(id) {
  state.session.tool = id;
  const title = { snippets: "Snippets", regex: "Regex", json: "JSON", runner: "Runner", vibe: "Runner" }[id] || "Tool";
  $("tool-title").textContent = title; const body = $("tool-body");
  if (id === "snippets") {
    body.innerHTML = `<p class="muted">Reusable bits stay on this phone.</p><label class="field"><span>New snippet</span><textarea id="snip-in" rows="6"></textarea></label><button class="primary" id="snip-add" type="button">Save snippet</button><div id="snip-list" class="file-list"></div>`;
    const list = $("snip-list");
    (state.lab.snippets || []).forEach((s, i) => {
      const b = document.createElement("button"); b.className = "file-row"; b.type = "button";
      b.innerHTML = `<span class="ext">snip</span><span><b>Snippet ${i + 1}</b><small>${escapeHtml(String(s).slice(0, 48))}</small></span>`;
      b.onclick = () => { createFile("snippet.txt").then(() => { const f = activeFile(); if (f) { f.body = s; $("code").value = s; saveFile(f); } }); };
      list.appendChild(b);
    });
    $("snip-add").onclick = async () => {
      const text = $("snip-in").value; if (!text.trim()) return;
      state.lab.snippets = state.lab.snippets || []; state.lab.snippets.unshift(text);
      await saveLab(); paintTool("snippets"); toast("Snippet saved");
    }; return;
  }
  if (id === "regex") {
    const r = state.lab.regex || { pattern: "", flags: "g", sample: "" };
    body.innerHTML = `<label class="field"><span>Pattern</span><input id="rx-p" value="${escapeHtml(r.pattern)}"></label><label class="field"><span>Flags</span><input id="rx-f" value="${escapeHtml(r.flags || "g")}"></label><label class="field"><span>Sample</span><textarea id="rx-s" rows="6">${escapeHtml(r.sample)}</textarea></label><button class="primary" id="rx-run" type="button">Test</button><pre class="lab-out" id="rx-out"></pre>`;
    $("rx-run").onclick = () => {
      state.lab.regex = { pattern: $("rx-p").value, flags: $("rx-f").value, sample: $("rx-s").value }; saveLab();
      try { const re = new RegExp(state.lab.regex.pattern, state.lab.regex.flags); const hits = [...String(state.lab.regex.sample).matchAll(re)].map((m) => m[0]); $("rx-out").textContent = hits.length ? hits.join("\n") : "No match"; }
      catch (err) { $("rx-out").textContent = String(err.message || err); }
    }; return;
  }
  if (id === "json") {
    body.innerHTML = `<label class="field"><span>JSON</span><textarea id="js-in" rows="10">${escapeHtml(state.lab.json || "")}</textarea></label><div class="row"><button class="primary" id="js-pretty" type="button">Pretty</button><button class="ghost" id="js-mini" type="button">Minify</button></div><pre class="lab-out" id="js-out"></pre>`;
    const apply = (pretty) => {
      state.lab.json = $("js-in").value; saveLab();
      try { const data = JSON.parse(state.lab.json); const out = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data); $("js-in").value = out; state.lab.json = out; $("js-out").textContent = "Valid JSON"; saveLab(); }
      catch (err) { $("js-out").textContent = String(err.message || err); }
    };
    $("js-pretty").onclick = () => apply(true); $("js-mini").onclick = () => apply(false); return;
  }
  body.innerHTML = `<p class="muted">Scratch HTML. Run opens a local preview. Nothing leaves the phone.</p><label class="field"><span>Markup</span><textarea id="run-in" rows="12">${escapeHtml(state.lab.runner || state.lab.vibe || "")}</textarea></label><button class="primary" id="run-go" type="button">Run</button>`;
  $("run-go").onclick = async () => {
    state.lab.runner = $("run-in").value; await saveLab();
    const name = uniqueName("runner.html");
    const file = { id: uuid(), name, path: name, body: state.lab.runner, language: "html", workspaceId: state.workspaceId || PERSONAL, createdAt: now(), updatedAt: now(), source: "runner" };
    await saveFile(file); await openFile(file.id, "code"); buzz(10); go("preview");
  };
}
function paintAi() {
  const keys = readKeys();
  $("ai-hint").textContent = keys.gemini ? "Gemini key is on this phone. Needs a network hop when you send." : "Add a Gemini key in Settings. Until then this stays local-only.";
  $("ai-log").textContent = (state.messages || []).map((m) => m.role + ": " + m.text).join("\n") || "No messages yet.";
  $("ai-send").onclick = sendAi;
}
async function sendAi() {
  const text = $("ai-in").value.trim(); if (!text) return;
  const keys = readKeys(); const file = activeFile();
  const context = $("ai-inc").checked && file ? `\n\nFILE ${file.name}:\n${file.body}` : "";
  state.messages.push({ id: uuid(), role: "you", text, at: now() }); $("ai-in").value = ""; paintAi();
  if (!keys.gemini) {
    state.messages.push({ id: uuid(), role: "kit", text: "No Gemini key saved. Add it in Settings.", at: now() });
    await putOf("messages", state.messages[state.messages.length - 1]); paintAi(); return;
  }
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + encodeURIComponent(keys.gemini), {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({ contents: [{ parts: [{ text: text + context }] }] })
    });
    const data = await res.json();
    const reply = (((data.candidates || [])[0] || {}).content || {}).parts;
    const out = Array.isArray(reply) ? reply.map((p) => p.text || "").join("") : (data.error && data.error.message) || "No reply";
    state.messages.push({ id: uuid(), role: "kit", text: out, at: now() });
  } catch (err) {
    state.messages.push({ id: uuid(), role: "kit", text: "Network too slow or blocked. Editor still works offline.", at: now() });
  }
  clearTimeout(timer); await putOf("messages", state.messages[state.messages.length - 1]); paintAi();
}
async function exportBackup() {
  await flushEditor();
  const bag = { app: APP, version: VERSION, exportedAt: now(), files: state.files, workspaces: state.workspaces, session: state.session, lab: state.lab, messages: state.messages, prefs: readPrefs(), keys: readKeys() };
  downloadBlob("naija-devkit-backup.json", JSON.stringify(bag, null, 2), "application/json"); toast("Backup ready");
}
async function importBackup(ev) {
  const file = ev.target.files && ev.target.files[0]; ev.target.value = ""; if (!file) return;
  try {
    const bag = JSON.parse(await file.text());
    if (!bag || !Array.isArray(bag.files)) throw new Error("Not a DevKit backup");
    await clearOf("files"); state.files = [];
    for (const f of bag.files) { if (!f || !f.id) continue; if (!f.workspaceId) f.workspaceId = PERSONAL; await putOf("files", f); state.files.push(f); }
    if (Array.isArray(bag.workspaces)) {
      await clearOf("workspaces"); state.workspaces = [];
      for (const w of bag.workspaces) { if (!w || !w.id) continue; await putOf("workspaces", w); state.workspaces.push(w); }
    }
    if (bag.lab) { state.lab = Object.assign(state.lab, bag.lab, { id: "lab" }); await saveLab(); }
    if (bag.session) { state.session = Object.assign(sess(), bag.session, { id: "ui" }); await saveSession(); }
    if (bag.prefs) writePrefs(Object.assign(readPrefs(), bag.prefs));
    if (bag.keys) writeKeys(Object.assign(readKeys(), bag.keys));
    toast("Restore complete"); go(state.files.length ? "home" : "welcome");
  } catch (err) { toast("Could not restore that file"); }
}
async function boot() {
  bindUi();
  try {
    state.files = await allOf("files");
    const sessions = await allOf("session");
    if (sessions[0]) state.session = Object.assign(sess(), sessions[0], { id: "ui" });
    const labs = await allOf("lab");
    if (labs[0]) state.lab = Object.assign(state.lab, labs[0]);
    if (state.lab.vibe && !state.lab.runner) state.lab.runner = state.lab.vibe;
    state.messages = await allOf("messages");
    try { state.workspaces = await allOf("workspaces"); } catch (_e) { state.workspaces = []; }
    if (!state.workspaces.length) {
      const box = { id: PERSONAL, name: "Personal", createdAt: now(), lastOpened: now() };
      await putOf("workspaces", box);
      state.workspaces = [box];
    }
    for (const f of state.files) {
      if (!f.workspaceId) { f.workspaceId = PERSONAL; await putOf("files", f); }
    }
    state.workspaceId = state.session.workspaceId || PERSONAL;
    if (!state.workspaces.some((w) => w.id === state.workspaceId)) state.workspaceId = state.workspaces[0].id;
    state.filter = state.session.filter || "all";
    state.lastHub = state.session.lastHub || "home";
    if (["lab", "workspace", "settings", "home"].includes(state.session.mode)) {
      if (state.session.mode === "lab") state.session.mode = "toolbox";
      state.lastHub = state.session.mode;
    }
  } catch (err) { toast("Storage unavailable"); }
  const prefs = readPrefs();
  if (!state.session.welcomeSeen && !state.files.length) { showPage("welcome"); return; }
  state.session.welcomeSeen = true; await saveSession();
  const mode = prefs.restore ? state.session.mode : "home";
  if (mode === "welcome") go("home");
  else if (mode === "editor" || mode === "ide" || mode === "preview") {
    if (state.session.activeId && state.files.some((f) => f.id === state.session.activeId)) go(mode === "preview" ? "preview" : "editor");
    else go("home");
  } else if (PAGES.includes(mode)) go(mode, state.session.tool);
  else go("home");
}
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => {}); });
}
document.addEventListener("DOMContentLoaded", boot);
