"use strict";

function showPage(id) {
  PAGES.forEach((p) => { const el = $(p); if (el) el.hidden = p !== id; });
  state.session.mode = id;
  if (DOCK_PAGES.includes(id)) state.lastHub = id;
  const dock = $("dock");
  dock.hidden = !DOCK_PAGES.includes(id);
  dock.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.getAttribute("data-go") === id));
  $("drawer").hidden = true;
  $("actions").hidden = true;
}
function go(id, extra) {
  if (id === "lab") id = "toolbox";
  if (id === "ide") id = "editor";
  if (id === "welcome" && state.session.welcomeSeen && state.files.length) id = "home";
  if (id === "editor") paintEditor();
  else if (id === "home") paintHome();
  else if (id === "workspace") paintWorkspace();
  else if (id === "toolbox") paintToolbox();
  else if (id === "settings") paintSettings();
  else if (id === "preview") paintPreview();
  else if (id === "search") paintSearch(extra || "");
  else if (id === "ai") paintAi();
  else if (id === "tool") paintTool(extra || state.session.tool || "runner");
  showPage(id); saveSession();
}
function fileRow(file) {
  const btn = document.createElement("button");
  btn.className = "file-row"; btn.type = "button";
  const when = (file.updatedAt || "").slice(0, 16).replace("T", " ");
  btn.innerHTML = `<span class="ext">${escapeHtml((file.language || "txt").slice(0, 4))}</span><span><b>${escapeHtml(file.name)}</b><small>${escapeHtml(when)}</small></span>`;
  btn.addEventListener("click", () => openFile(file.id));
  return btn;
}
function emptyBox(text) {
  const p = document.createElement("p"); p.className = "empty"; p.textContent = text; return p;
}
function toolTiles(root) {
  root.innerHTML = "";
  const svgs = {
    snippets: '<path d="M7 5h7l4 4v10H7z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M14 5v4h4" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    regex: '<path d="M7 8h10M7 12h6M7 16h8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    json: '<path d="M8 6c-2 0-3 2-3 6s1 6 3 6M16 6c2 0 3 2 3 6s-1 6-3 6" fill="none" stroke="currentColor" stroke-width="1.7"/>',
    runner: '<path d="M8 6.5v11l10-5.5z" fill="currentColor"/>'
  };
  TOOLS.forEach((t) => {
    const b = document.createElement("button");
    b.className = "tool-tile"; b.type = "button";
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${svgs[t.id]}</svg><span>${t.label}</span>`;
    b.addEventListener("click", () => go("tool", t.id));
    root.appendChild(b);
  });
}
function paintHome() {
  const files = sortedFiles(); const resume = $("home-resume"); resume.innerHTML = "";
  if (files[0]) {
    const f = files[0]; const peek = String(f.body || "").split("\n").slice(0, 4).join("\n") || "Empty file";
    const card = document.createElement("button"); card.className = "resume"; card.type = "button";
    card.innerHTML = `<div class="resume-top"><span class="resume-ico">${escapeHtml((f.language || "txt").slice(0, 3))}</span><span><strong>${escapeHtml(f.name)}</strong><small>Continue editing</small></span></div><pre>${escapeHtml(peek)}</pre><div class="resume-cta"><span class="muted">Last file on this phone</span><span class="play-mini" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 6.5v11l10-5.5z" fill="currentColor"/></svg></span></div>`;
    card.addEventListener("click", () => openFile(f.id)); resume.appendChild(card);
  } else resume.appendChild(emptyBox("No files yet. Import one or start from Workspace."));
  toolTiles($("home-tools"));
  const rec = $("home-recents"); rec.innerHTML = "";
  files.slice(0, 6).forEach((f) => rec.appendChild(fileRow(f)));
  if (!files.length) rec.appendChild(emptyBox("Recents will land here."));
}
function paintWorkspace() {
  const files = sortedFiles();
  const open = files.find((f) => f.id === state.session.activeId) || files[0];
  $("ws-strip").innerHTML = open ? `<strong>${escapeHtml(open.name)}</strong> · ${files.length} on device` : "Empty workspace";
  const bar = $("ws-filters"); bar.innerHTML = "";
  FILTERS.forEach((key) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = key;
    b.className = state.filter === key ? "on" : "";
    b.addEventListener("click", () => { state.filter = key; paintWorkspace(); });
    bar.appendChild(b);
  });
  const list = $("ws-list"); list.innerHTML = "";
  const shown = files.filter((f) => state.filter === "all" || f.language === state.filter);
  shown.forEach((f) => list.appendChild(fileRow(f)));
  if (!shown.length) list.appendChild(emptyBox("Nothing in this filter. Import a file or create one."));
}
function paintToolbox() {
  toolTiles($("box-tools"));
  const rec = $("box-recents"); rec.innerHTML = "";
  const rows = (state.lab.recents || []).map((id) => state.files.find((f) => f.id === id)).filter(Boolean);
  rows.forEach((f) => rec.appendChild(fileRow(f)));
  if (!rows.length) rec.appendChild(emptyBox("Tools you run will keep a short trail here."));
}
function paintSettings() {
  const prefs = readPrefs(); const keys = readKeys();
  $("settings-body").innerHTML = `
    <h2>Editor</h2>
    <label class="check"><input id="pref-wrap" type="checkbox"${prefs.wrap ? " checked" : ""}> Wrap long lines</label>
    <label class="check"><input id="pref-restore" type="checkbox"${prefs.restore ? " checked" : ""}> Restore last place</label>
    <label class="field"><span>Font size</span><select id="pref-font"><option value="14">14</option><option value="16">16</option><option value="18">18</option></select></label>
    <h2>Keys on this phone</h2>
    <p class="muted">Stored in localStorage on this device. Never sent unless you tap Send in Assistant.</p>
    <label class="field"><span>Gemini key</span><input id="key-gemini" type="password" autocomplete="off"></label>
    <label class="field"><span>OpenRouter key</span><input id="key-openrouter" type="password" autocomplete="off"></label>
    <button class="primary" id="save-keys" type="button">Save keys</button>
    <h2>Backup</h2>
    <div class="row"><button class="ghost" id="btn-export" type="button">Export JSON</button><button class="ghost" id="btn-import-bak" type="button">Restore JSON</button></div>
    <h2>Project</h2>
    <div class="row"><button class="ghost" id="btn-github" type="button">Open GitHub repo</button><button class="ghost" id="btn-ai" type="button">Assistant</button></div>
    <p class="muted">Extensions Hub — coming later. Naija DevKit ${VERSION}.</p>
    <input id="bak-input" type="file" accept="application/json,.json" hidden>`;
  $("pref-font").value = prefs.font || "16";
  $("key-gemini").value = keys.gemini || "";
  $("key-openrouter").value = keys.openrouter || "";
  $("pref-wrap").onchange = () => { prefs.wrap = $("pref-wrap").checked; writePrefs(prefs); };
  $("pref-restore").onchange = () => { prefs.restore = $("pref-restore").checked; writePrefs(prefs); };
  $("pref-font").onchange = () => { prefs.font = $("pref-font").value; writePrefs(prefs); };
  $("save-keys").onclick = () => { writeKeys({ gemini: $("key-gemini").value.trim(), openrouter: $("key-openrouter").value.trim() }); toast("Keys stayed on this phone"); };
  $("btn-export").onclick = exportBackup;
  $("btn-import-bak").onclick = () => $("bak-input").click();
  $("bak-input").onchange = importBackup;
  $("btn-github").onclick = () => window.open(GH, "_blank", "noopener");
  $("btn-ai").onclick = () => go("ai");
}
function paintChips(file) {
  const place = state.session.place;
  const lang = place === "markdown" ? "md" : place === "text" ? "txt" : (file && file.language) || "txt";
  const row = $("chips"); row.innerHTML = "";
  (CHIPS[lang] || []).forEach((chip) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = chip;
    b.addEventListener("click", () => insertChip(chip)); row.appendChild(b);
  });
  const hide = !readPrefs().chips || !(CHIPS[lang] || []).length;
  $("chip-sheet").hidden = hide;
  $("chip-sheet").classList.toggle("off", state.chipsOpen === false);
}
function paintGutter() {
  const ed = $("code"); const g = $("gutter");
  const n = Math.max(String(ed.value || "").split("\n").length, 1);
  const parts = []; for (let i = 1; i <= n; i += 1) parts.push(i);
  g.textContent = parts.join("\n"); g.scrollTop = ed.scrollTop;
}
function paintEditor() {
  const file = activeFile(); const ed = $("code"); const prefs = readPrefs();
  const page = document.getElementById("editor");
  ed.style.fontSize = (prefs.font || 16) + "px"; $("gutter").style.fontSize = (prefs.font || 16) + "px";
  page.classList.toggle("wrap", !!prefs.wrap);
  page.classList.toggle("text-place", state.session.place === "text" || state.session.place === "markdown");
  if (!file) { $("ed-name").textContent = "No file"; ed.value = ""; paintGutter(); paintChips(null); return; }
  $("ed-name").textContent = file.name;
  if (ed.value !== file.body) ed.value = file.body || "";
  try { ed.setSelectionRange(state.session.cursor || 0, state.session.cursor || 0); } catch (_e) {}
  ed.scrollTop = state.session.scrollTop || 0; paintGutter(); paintChips(file);
}
function insertChip(text) {
  const ed = $("code"); ed.setRangeText(text, ed.selectionStart, ed.selectionEnd, "end");
  ed.focus(); paintGutter(); schedulePersist();
}
async function openFile(id, place) {
  const file = state.files.find((f) => f.id === id); if (!file) return;
  if (!state.session.openIds.includes(id)) state.session.openIds.push(id);
  state.session.activeId = id; state.session.place = placeFor(file, place); file.place = state.session.place;
  if (!state.lab.recents.includes(id)) state.lab.recents.unshift(id);
  state.lab.recents = state.lab.recents.slice(0, 8); await saveLab(); go("editor");
}
function paintDrawer() {
  const open = $("drawer-open"); const all = $("drawer-all"); open.innerHTML = ""; all.innerHTML = "";
  state.session.openIds.map((id) => state.files.find((f) => f.id === id)).filter(Boolean).forEach((f) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = f.name;
    b.className = f.id === state.session.activeId ? "on" : "";
    b.onclick = () => { $("drawer").hidden = true; openFile(f.id); }; open.appendChild(b);
  });
  if (!open.childNodes.length) open.appendChild(emptyBox("No open files."));
  sortedFiles().forEach((f) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = f.name;
    b.className = f.id === state.session.activeId ? "on" : "";
    b.onclick = () => { $("drawer").hidden = true; openFile(f.id); }; all.appendChild(b);
  });
}
function paintSearch(q) {
  $("search-input").value = q || $("search-input").value || "";
  const needle = String($("search-input").value || "").toLowerCase();
  const box = $("search-results"); box.innerHTML = "";
  sortedFiles().filter((f) => !needle || f.name.toLowerCase().includes(needle) || String(f.body).toLowerCase().includes(needle)).forEach((f) => box.appendChild(fileRow(f)));
  if (!box.childNodes.length) box.appendChild(emptyBox("No match on this device."));
}
async function createFile(name) {
  const n = uniqueName(name || "untitled.html");
  const file = { id: uuid(), name: n, path: n, body: n.endsWith(".html") ? "<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"utf-8\">\n  <title>page</title>\n</head>\n<body>\n  \n</body>\n</html>\n" : "", language: langFromName(n), createdAt: now(), updatedAt: now(), source: "new" };
  state.session.welcomeSeen = true; await saveFile(file); await openFile(file.id);
}
function promptName(next) { const name = window.prompt("File name", "untitled.html"); if (name) next(safeName(name, langFromName(name))); }
function bindUi() {
  $("btn-start").onclick = () => promptName(createFile);
  $("btn-import-welcome").onclick = () => $("file-input").click();
  $("ws-import").onclick = () => $("file-input").click();
  $("ws-new").onclick = () => promptName(createFile);
  $("ws-search").onclick = () => go("search");
  $("home-cmd").onclick = () => go("search");
  $("search-back").onclick = () => go(state.lastHub || "home");
  $("search-input").addEventListener("input", () => paintSearch());
  $("ed-back").onclick = async () => { await flushEditor(); go(state.lastHub || "home"); };
  $("ed-files").onclick = () => { paintDrawer(); $("drawer").hidden = false; };
  $("ed-name").onclick = () => { paintDrawer(); $("drawer").hidden = false; };
  $("ed-play").onclick = async () => { await flushEditor(); buzz(10); go("preview"); };
  $("ed-more").onclick = () => { $("actions").hidden = !$("actions").hidden; };
  $("chip-toggle").onclick = () => { state.chipsOpen = !state.chipsOpen; $("chip-sheet").classList.toggle("off", !state.chipsOpen); };
  $("drawer-scrim").onclick = () => { $("drawer").hidden = true; };
  $("drawer-new").onclick = () => { $("drawer").hidden = true; promptName(createFile); };
  $("pv-back").onclick = () => go("editor");
  $("pv-reload").onclick = () => paintPreview();
  $("ai-back").onclick = () => go(state.lastHub || "home");
  $("tool-back").onclick = () => go("toolbox");
  $("file-input").addEventListener("change", onImport);
  $("code").addEventListener("input", () => { paintGutter(); schedulePersist(); });
  $("code").addEventListener("scroll", () => { $("gutter").scrollTop = $("code").scrollTop; });
  $("dock").addEventListener("click", (ev) => { const b = ev.target.closest("button[data-go]"); if (b) go(b.getAttribute("data-go")); });
  $("actions").addEventListener("click", onAction);
  document.addEventListener("keydown", (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key === "s") { ev.preventDefault(); flushEditor().then(() => toast("Saved on device")); }
  });
}
function onAction(ev) {
  const act = ev.target.getAttribute("data-act"); if (!act) return;
  $("actions").hidden = true; const file = activeFile();
  if (act === "code" && file) openFile(file.id, "code");
  if (act === "markdown" && file) openFile(file.id, "markdown");
  if (act === "text" && file) openFile(file.id, "text");
  if (act === "download" && file) downloadBlob(file.name, file.body || "", MIME[file.language] || "text/plain");
  if (act === "rename" && file) {
    const name = window.prompt("Rename", file.name);
    if (name) { file.name = uniqueName(safeName(name, langFromName(name))); file.path = file.name; file.language = langFromName(file.name); saveFile(file).then(() => paintEditor()); }
  }
  if (act === "ai") go("ai");
  if (act === "close" && file) {
    state.session.openIds = state.session.openIds.filter((id) => id !== file.id);
    state.session.activeId = state.session.openIds[0] || null;
    if (state.session.activeId) openFile(state.session.activeId); else go(state.lastHub || "home");
  }
}
async function onImport(ev) {
  const files = [...(ev.target.files || [])]; ev.target.value = ""; if (!files.length) return;
  for (const raw of files) {
    const body = await raw.text();
    const name = uniqueName(safeName(raw.name, langFromName(raw.name)));
    const file = { id: uuid(), name, path: name, body, language: langFromName(name), createdAt: now(), updatedAt: now(), source: "import" };
    state.session.welcomeSeen = true; await saveFile(file); await openFile(file.id);
  }
  toast(files.length === 1 ? "Imported" : `Imported ${files.length} files`);
}
