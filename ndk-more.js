"use strict";

function showSettings() {
  state.session.mode = "settings"; showPage("settings");
  const keys = readKeys(); const prefs = readPrefs(); const lastBackup = prefs.lastBackup || "never";
  $("settings-body").innerHTML =
    "<h3>Workspace</h3>" +
    "<label class=\"field\">Editor size <select id=\"st-font\"><option value=\"14\">14</option><option value=\"16\">16</option><option value=\"18\">18</option></select></label>" +
    "<label class=\"check\"><input id=\"st-wrap\" type=\"checkbox\"> Wrap lines</label>" +
    "<label class=\"check\"><input id=\"st-restore\" type=\"checkbox\"> Restore last place on open</label>" +
    "<label class=\"check\"><input id=\"st-chips\" type=\"checkbox\"> Keyboard chips</label>" +
    "<h3>Keys</h3><p class=\"muted\">Stored only in this browser. Never sent unless you tap Send in AI Assistant.</p>" +
    "<label class=\"field\">Gemini <input id=\"st-gem\" type=\"password\" autocomplete=\"off\"></label>" +
    "<label class=\"field\">OpenRouter <input id=\"st-or\" type=\"password\" autocomplete=\"off\"></label>" +
    "<div class=\"row\"><button class=\"primary\" id=\"st-save-keys\" type=\"button\">Save keys</button><button class=\"danger\" id=\"st-clear-keys\" type=\"button\">Clear keys</button></div>" +
    "<h3>Backup</h3><p class=\"muted\">Last backup: " + escapeHtml(lastBackup) + "</p>" +
    "<label class=\"check\"><input id=\"st-inc-keys\" type=\"checkbox\"> Include keys in backup file</label>" +
    "<div class=\"row\"><button class=\"primary\" id=\"st-backup\" type=\"button\">Full backup</button><button class=\"ghost\" id=\"st-restore-btn\" type=\"button\">Restore</button></div>" +
    "<input id=\"st-restore-file\" type=\"file\" accept=\"application/json,.json\" hidden>" +
    "<h3>About</h3><p>Naija DevKit " + VERSION + " \u00b7 offline first</p>" +
    "<div class=\"row\"><button class=\"ghost\" id=\"st-gh\" type=\"button\">Open GitHub repo</button></div>" +
    "<h3>Danger</h3><div class=\"row\"><button class=\"danger\" id=\"st-clear-lab\" type=\"button\">Clear lab history</button><button class=\"danger\" id=\"st-wipe\" type=\"button\">Delete vault</button></div>";
  $("st-font").value = String(prefs.font);
  $("st-wrap").checked = !!prefs.wrap;
  $("st-restore").checked = prefs.restore !== false;
  $("st-chips").checked = prefs.chips !== false;
  $("st-gem").value = keys.gemini || ""; $("st-or").value = keys.openrouter || "";
  const saveP = () => { writePrefs({ font: $("st-font").value, wrap: $("st-wrap").checked, restore: $("st-restore").checked, chips: $("st-chips").checked, lastBackup: readPrefs().lastBackup }); applyPrefs(); };
  ["st-font", "st-wrap", "st-restore", "st-chips"].forEach((id) => $(id).addEventListener("change", saveP));
  $("st-save-keys").addEventListener("click", () => { writeKeys({ gemini: $("st-gem").value.trim(), openrouter: $("st-or").value.trim() }); toast("Keys saved on this phone"); });
  $("st-clear-keys").addEventListener("click", () => { localStorage.removeItem(KEYS); $("st-gem").value = ""; $("st-or").value = ""; toast("Keys cleared"); });
  $("st-backup").addEventListener("click", () => exportBackup($("st-inc-keys").checked));
  $("st-restore-btn").addEventListener("click", () => $("st-restore-file").click());
  $("st-restore-file").addEventListener("change", async (ev) => {
    const file = ev.target.files && ev.target.files[0]; ev.target.value = ""; if (!file) return;
    try { await importBackup(JSON.parse(await file.text())); toast("Restore complete"); bootPaint(); }
    catch (err) { toast(err.message || "Restore failed"); }
  });
  $("st-gh").addEventListener("click", () => { if (!navigator.onLine) { toast("Needs a connection"); return; } location.href = GH; });
  $("st-clear-lab").addEventListener("click", async () => { state.lab.recents = []; await saveLab(); toast("Lab history cleared"); });
  $("st-wipe").addEventListener("click", async () => {
    if (!confirm("Delete every workspace file on this phone?")) return;
    await clearOf("files"); state.files = [];
    state.session = Object.assign(sess(), { welcomeSeen: true, mode: "workspace" });
    await saveSession(); showWorkspace(); toast("Vault cleared");
  });
  saveSession();
}
function showAi() {
  state.session.mode = "ai"; showPage("ai");
  const keys = readKeys(); const log = $("ai-log"); log.replaceChildren();
  state.messages.forEach((m) => { const d = document.createElement("div"); d.className = "msg " + m.role; d.textContent = m.text; log.appendChild(d); });
  if (!keys.gemini) $("ai-hint").textContent = "Save a Gemini key in Settings. Chat needs a connection.";
  else if (!navigator.onLine) $("ai-hint").textContent = "Offline. The editor still works. Chat waits for a connection.";
  else $("ai-hint").textContent = "Uses the key on this phone. Slow networks time out after 8 seconds.";
  saveSession();
}
async function sendAi() {
  const keys = readKeys(); const text = $("ai-in").value.trim();
  if (!text) return;
  if (!keys.gemini) { toast("Add a Gemini key first"); return; }
  if (!navigator.onLine) { toast("Chat needs a connection"); return; }
  const file = activeFile();
  const ctx = $("ai-inc").checked && file ? "\nActive file: " + file.name + "\n-----\n" + String(file.body || "").slice(0, 12000) + "\n-----\n" : "";
  const user = { id: uuid(), role: "user", text, createdAt: now() };
  state.messages.push(user); await putOf("messages", user); $("ai-in").value = "";
  const d = document.createElement("div"); d.className = "msg user"; d.textContent = text; $("ai-log").appendChild(d);
  $("ai-send").disabled = true;
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" + encodeURIComponent(keys.gemini), {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "You are a coding assistant inside Naija DevKit on a phone. Be direct.\n" + ctx + "User: " + text }] }] })
    });
    const data = await res.json();
    const reply = (((data || {}).candidates || [])[0] || {}).content;
    const out = reply && reply.parts ? reply.parts.map((p) => p.text || "").join("\n") : (data.error && data.error.message) || "No reply";
    const asst = { id: uuid(), role: "assistant", text: out, createdAt: now() };
    state.messages.push(asst); await putOf("messages", asst);
    const a = document.createElement("div"); a.className = "msg assistant"; a.textContent = out; $("ai-log").appendChild(a);
  } catch (err) {
    toast(err && err.name === "AbortError" ? "Network too slow. Editor still saved." : "Request failed");
  } finally { clearTimeout(timer); $("ai-send").disabled = false; }
}
function showPreview() {
  flushEditor(); const file = activeFile();
  if (!file) { toast("Open a file first"); return; }
  state.session.mode = "preview"; showPage("preview"); $("pv-title").textContent = file.name;
  const stage = $("pv-stage"); const log = $("pv-log"); log.hidden = true; log.textContent = "";
  if (state.session.place === "markdown" || file.language === "md") {
    stage.innerHTML = "<article class=\"md-view\">" + renderMarkdown(file.body || "") + "</article>";
  } else {
    stage.innerHTML = "<iframe id=\"pv-frame\" sandbox=\"allow-scripts\" title=\"Preview\"></iframe>";
    const html = file.language === "html" ? (file.body || "") : "<pre>" + escapeHtml(file.body || "") + "</pre>";
    $("pv-frame").srcdoc = html;
  }
  saveSession();
}
function openLab(kind) {
  state.session.mode = "tool"; showPage("tool");
  const titles = { snippets: "Snippets", regex: "Regex Test", json: "JSON Lab", vibe: "Vibe" };
  $("tool-title").textContent = titles[kind] || "Lab"; touchLab(kind, titles[kind] || kind);
  if (kind === "snippets") labSnippets(); else if (kind === "regex") labRegex(); else if (kind === "json") labJson(); else labVibe();
}
function labSnippets() {
  const box = $("tool-body"); box.replaceChildren();
  const p = document.createElement("p"); p.className = "muted"; p.textContent = "Workspace files double as snippets. Open one or create a small file."; box.appendChild(p);
  const list = document.createElement("div"); list.className = "file-list";
  if (!state.files.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "No files yet."; list.appendChild(empty); }
  else state.files.forEach((f) => list.appendChild(fileRow(f, () => openInIde(f.id))));
  box.appendChild(list);
}
function labRegex() {
  $("tool-body").innerHTML = "<label class=\"field\">Pattern <input id=\"rx-p\"></label><label class=\"field\">Flags <input id=\"rx-f\" value=\"g\"></label><label class=\"field\">Sample <textarea id=\"rx-s\" rows=\"8\"></textarea></label><p class=\"status\" id=\"rx-st\"></p>";
  $("rx-p").value = state.lab.regex.pattern || ""; $("rx-f").value = state.lab.regex.flags || "g"; $("rx-s").value = state.lab.regex.sample || "";
  const run = () => {
    state.lab.regex = { pattern: $("rx-p").value, flags: $("rx-f").value, sample: $("rx-s").value }; saveLab();
    try {
      const rx = new RegExp($("rx-p").value, $("rx-f").value);
      const hits = [...String($("rx-s").value).matchAll(rx)].map((m) => m[0]);
      $("rx-st").className = "status ok"; $("rx-st").textContent = hits.length ? hits.length + " match(es): " + hits.slice(0, 8).join(" \u00b7 ") : "No matches";
    } catch (err) { $("rx-st").className = "status bad"; $("rx-st").textContent = err.message; }
  };
  ["rx-p", "rx-f", "rx-s"].forEach((id) => $(id).addEventListener("input", run)); run();
}
function labJson() {
  $("tool-body").innerHTML = "<label class=\"field\"><textarea id=\"j-in\" rows=\"14\"></textarea></label><div class=\"row\"><button class=\"primary\" id=\"j-pretty\" type=\"button\">Pretty</button><button class=\"ghost\" id=\"j-min\" type=\"button\">Minify</button></div><p class=\"status\" id=\"j-st\"></p>";
  $("j-in").value = state.lab.json || "{\n  \n}\n";
  const persist = () => { state.lab.json = $("j-in").value; saveLab(); };
  $("j-in").addEventListener("input", persist);
  $("j-pretty").addEventListener("click", () => { try { $("j-in").value = JSON.stringify(JSON.parse($("j-in").value), null, 2); $("j-st").className = "status ok"; $("j-st").textContent = "Valid JSON"; persist(); } catch (err) { $("j-st").className = "status bad"; $("j-st").textContent = err.message; } });
  $("j-min").addEventListener("click", () => { try { $("j-in").value = JSON.stringify(JSON.parse($("j-in").value)); $("j-st").className = "status ok"; $("j-st").textContent = "Minified"; persist(); } catch (err) { $("j-st").className = "status bad"; $("j-st").textContent = err.message; } });
}
function labVibe() {
  $("tool-body").innerHTML = "<label class=\"field\">Scratch <textarea id=\"vibe-in\" rows=\"10\"></textarea></label><button class=\"primary\" id=\"vibe-run\" type=\"button\">Run</button><iframe id=\"vibe-frame\" sandbox=\"allow-scripts\" title=\"Vibe\" style=\"width:100%;min-height:40vh;border:1px solid var(--line);margin-top:12px;background:#fff\"></iframe>";
  $("vibe-in").value = state.lab.vibe || "";
  $("vibe-in").addEventListener("input", () => { state.lab.vibe = $("vibe-in").value; saveLab(); });
  $("vibe-run").addEventListener("click", () => { $("vibe-frame").srcdoc = $("vibe-in").value; touchLab("vibe", "Vibe run"); });
}
function download(name, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime || "text/plain" }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}
function exportBackup(includeKeys) {
  const payload = { app: APP, schema: 2, version: VERSION, exportedAt: now(), files: state.files, session: state.session, lab: state.lab, messages: state.messages, prefs: readPrefs() };
  if (includeKeys) payload.keys = readKeys();
  download("naija-devkit-backup.json", JSON.stringify(payload, null, 2), "application/json");
  const prefs = readPrefs(); prefs.lastBackup = now(); writePrefs(prefs); toast("Backup downloaded");
}
async function importBackup(data) {
  if (!data || data.app !== APP) throw new Error("Not a Naija DevKit backup");
  await clearOf("files");
  state.files = (Array.isArray(data.files) ? data.files : []).map((f) => ({
    id: String(f.id || uuid()), name: String(f.name || f.path || "untitled.txt"), path: String(f.path || f.name || "untitled.txt"),
    body: String(f.body || ""), language: EXT[f.language] ? f.language : langFromName(f.name || ""),
    createdAt: f.createdAt || now(), updatedAt: f.updatedAt || now(), source: "restore", place: f.place
  }));
  const db = await openDb(); const tx = db.transaction("files", "readwrite");
  state.files.forEach((f) => tx.objectStore("files").put(f)); await txDone(tx); db.close();
  if (data.session) state.session = Object.assign(sess(), data.session, { id: "ui" });
  if (data.lab) state.lab = Object.assign(state.lab, data.lab);
  if (data.prefs) writePrefs(Object.assign(readPrefs(), data.prefs));
  if (data.keys) writeKeys(data.keys);
  if (Array.isArray(data.messages)) { await clearOf("messages"); state.messages = data.messages; for (const m of data.messages) await putOf("messages", m); }
  await saveLab(); await saveSession();
}
async function importLocalFiles(list) {
  let last = null;
  for (const raw of [...list]) {
    const name = uniqueName(raw.name || "import.txt"); let text = "";
    try { text = await raw.text(); } catch (_e) { toast("Could not read " + raw.name); continue; }
    if (raw.size > 1500000 && !confirm(name + " is large. Import anyway?")) continue;
    const clash = state.files.find((f) => f.path === raw.name);
    if (clash && confirm("Replace " + clash.name + "?")) { clash.body = text; clash.source = "imported"; await saveFile(clash); last = clash; continue; }
    const file = { id: uuid(), name, path: name, body: text, language: langFromName(name), createdAt: now(), updatedAt: now(), source: "imported" };
    state.files.unshift(file); await saveFile(file); last = file;
  }
  if (!last) return;
  state.session.welcomeSeen = true;
  if (!state.session.openIds.includes(last.id)) state.session.openIds.push(last.id);
  state.session.activeId = last.id; await openInIde(last.id);
}
async function suggestFix() {
  hideActions(); const file = activeFile(); if (!file) return;
  const hint = localHint(file); if (hint) { $("code-hint").hidden = false; $("code-hint").textContent = hint; }
  const keys = readKeys();
  if (!keys.gemini) { toast("Local check done. Add a Gemini key for a suggested patch."); return; }
  if (!navigator.onLine) { toast("Needs a connection for a suggested patch."); return; }
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 8000); toast("Asking for a patch\u2026");
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" + encodeURIComponent(keys.gemini), {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Return only corrected file contents for " + file.name + ".\n-----\n" + String(file.body || "").slice(0, 12000) }] }] })
    });
    const data = await res.json();
    const reply = (((data || {}).candidates || [])[0] || {}).content;
    const out = reply && reply.parts ? reply.parts.map((p) => p.text || "").join("\n") : "";
    if (!out) { toast("No patch returned"); return; }
    if (confirm("Replace file with suggested patch?")) { $("editor").value = out.replace(/^```[a-z]*\n?|```$/g, ""); updateGutter(); scheduleSave(); }
  } catch (err) {
    toast(err && err.name === "AbortError" ? "Network too slow. Editor still saved." : "Request failed");
  } finally { clearTimeout(timer); }
}
function bootPaint() {
  applyPrefs(); const prefs = readPrefs(); const s = state.session;
  if (!s.welcomeSeen && state.files.length === 0) { showWelcome(); return; }
  if (prefs.restore === false) { showWorkspace(); return; }
  if (s.mode === "ide" && s.activeId && state.files.some((f) => f.id === s.activeId)) showIde();
  else if (s.mode === "lab" || s.mode === "tool") showLab();
  else if (s.mode === "settings") showSettings();
  else if (s.mode === "ai") showAi();
  else if (s.mode === "preview" && s.activeId) { showIde(); showPreview(); }
  else showWorkspace();
}
function bind() {
  ["welcome-menu", "ws-menu", "lab-menu", "set-menu", "ide-menu"].forEach((id) => $(id).addEventListener("click", openSidebar));
  $("sidebar-scrim").addEventListener("click", closeSidebar);
  document.querySelectorAll("[data-go]").forEach((btn) => btn.addEventListener("click", () => go(btn.getAttribute("data-go"))));
  $("btn-start").addEventListener("click", () => createFile("index.html"));
  $("btn-import-welcome").addEventListener("click", () => $("file-input").click());
  $("ws-import").addEventListener("click", () => $("file-input").click());
  $("ws-new").addEventListener("click", askNewFile);
  $("ws-search").addEventListener("click", openSearch);
  $("search-back").addEventListener("click", closeSearch);
  $("search-input").addEventListener("input", () => paintSearch($("search-input").value));
  $("file-input").addEventListener("change", async (ev) => { const list = ev.target.files; ev.target.value = ""; if (list && list.length) await importLocalFiles(list); });
  $("ide-back").addEventListener("click", backFromIde);
  $("ide-preview").addEventListener("click", showPreview);
  $("ide-more").addEventListener("click", showActions);
  $("pv-back").addEventListener("click", showIde);
  $("pv-reload").addEventListener("click", showPreview);
  $("tool-back").addEventListener("click", showLab);
  $("ai-back").addEventListener("click", () => { if (state.lastList === "lab") showLab(); else showWorkspace(); });
  $("ai-send").addEventListener("click", sendAi);
  $("editor").addEventListener("input", () => { updateGutter(); paintHint(); scheduleSave(); });
  $("editor").addEventListener("scroll", () => { $("gutter").scrollTop = $("editor").scrollTop; });
  document.querySelectorAll("[data-lab]").forEach((btn) => btn.addEventListener("click", () => openLab(btn.getAttribute("data-lab"))));
  $("actions").addEventListener("click", async (ev) => {
    const act = ev.target.getAttribute("data-act"); if (!act) return; const file = activeFile();
    if (act === "close") { hideActions(); return; }
    if (act === "download" && file) { download(file.name, file.body || "", MIME[file.language] || "text/plain"); hideActions(); toast("Saved to Downloads"); }
    if (act === "rename" && file) {
      const name = prompt("Rename", file.name);
      if (name) { file.name = uniqueName(name); file.path = file.name; file.language = langFromName(file.name); await saveFile(file); renderTabs(); loadActive(); }
      hideActions();
    }
    if (act === "hint") { hideActions(); paintHint(); toast($("code-hint").hidden ? "Looks fine locally" : "See hint above editor"); }
    if (act === "suggest") suggestFix();
  });
  window.addEventListener("online", () => { renderWorkspace(); renderLab(); });
  window.addEventListener("offline", () => { renderWorkspace(); renderLab(); });
  window.addEventListener("pagehide", () => { flushEditor(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushEditor(); });
}
async function boot() {
  bind();
  try {
    state.files = await allOf("files"); state.files.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const sessions = await allOf("session"); if (sessions[0]) state.session = Object.assign(sess(), sessions[0]);
    state.filter = state.session.filter || "all"; state.lastList = state.session.lastList || "workspace";
    const labs = await allOf("lab"); if (labs[0]) state.lab = Object.assign(state.lab, labs[0]);
    state.messages = await allOf("messages");
  } catch (_e) { toast("Storage unavailable"); }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  bootPaint();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
