"use strict";

function showPage(id) {
  PAGES.forEach((p) => { const el = $(p); if (el) el.hidden = p !== id; });
  document.body.dataset.route = id;
  markNav(id === "ide" || id === "preview" || id === "tool" || id === "search" ? (state.lastList || "workspace") : id);
  renderSideContext();
}
function markNav(route) {
  document.querySelectorAll(".side-row").forEach((btn) => {
    btn.classList.toggle("is-on", btn.getAttribute("data-go") === route);
  });
}
function closeSidebar() { $("sidebar").hidden = true; }
function openSidebar() { renderSideContext(); $("sidebar").hidden = false; }
function go(route) {
  closeSidebar(); hideActions();
  if (route === "github") { if (!navigator.onLine) { toast("Needs a connection"); return; } location.href = GH; return; }
  if (route === "extensions") { toast("Extensions Hub comes later"); return; }
  if (route === "workspace") return showWorkspace();
  if (route === "lab") return showLab();
  if (route === "settings") return showSettings();
  if (route === "ai") return showAi();
}
function showWelcome() { state.session.mode = "welcome"; showPage("welcome"); saveSession(); }
function showWorkspace() { state.session.mode = "workspace"; state.lastList = "workspace"; showPage("workspace"); renderWorkspace(); saveSession(); }
function showLab() { state.session.mode = "lab"; state.lastList = "lab"; showPage("lab"); renderLab(); saveSession(); }
function showIde() { state.session.mode = "ide"; showPage("ide"); renderTabs(); loadActive(); saveSession(); }
function backFromIde() { flushEditor(); if (state.lastList === "lab") showLab(); else showWorkspace(); }
function renderWorkspace() {
  const last = state.files[0];
  $("ws-strip").innerHTML = state.files.length
    ? "<strong>" + state.files.length + "</strong> files \u00b7 last " + escapeHtml(last ? last.name : "")
    : "No files yet. Import from Downloads or create one.";
  const box = $("ws-filters"); box.replaceChildren();
  FILTERS.forEach((f) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = f === "all" ? "All" : f.toUpperCase();
    b.className = state.filter === f ? "is-on" : "";
    b.addEventListener("click", () => { state.filter = f; renderWorkspace(); saveSession(); });
    box.appendChild(b);
  });
  const rows = state.files.filter((f) => state.filter === "all" || f.language === state.filter);
  paintFiles($("ws-list"), rows, "Nothing in this filter.");
  $("ws-net").textContent = netLabel();
  $("ws-net").className = navigator.onLine ? "ok" : "bad";
  $("ws-count").textContent = state.files.length + " files";
}
function renderLab() {
  $("lab-net").textContent = netLabel();
  $("lab-net").className = navigator.onLine ? "ok" : "bad";
  const box = $("lab-recents"); box.replaceChildren();
  const recents = state.lab.recents || [];
  if (!recents.length) {
    const p = document.createElement("p"); p.className = "empty"; p.textContent = "Open a lab tool. Last experiments show up here."; box.appendChild(p); return;
  }
  recents.forEach((r) => {
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "file-row";
    btn.innerHTML = "<span>" + escapeHtml(r.label || r.kind) + "</span><small>" + escapeHtml(r.kind) + "</small>";
    btn.addEventListener("click", () => openLab(r.kind)); box.appendChild(btn);
  });
}
function fileRow(file, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "file-row" + (file.id === state.session.activeId ? " is-on" : "");
  btn.innerHTML = "<span>" + escapeHtml(file.name) + "</span><small>" + escapeHtml(file.language) + "</small>";
  btn.addEventListener("click", onClick); return btn;
}
function paintFiles(el, rows, emptyText) {
  el.replaceChildren();
  if (!rows.length) { const p = document.createElement("p"); p.className = "empty"; p.textContent = emptyText || "Empty"; el.appendChild(p); return; }
  rows.forEach((f) => el.appendChild(fileRow(f, () => openInIde(f.id))));
}
function renderSideContext() {
  const box = $("side-context"); box.replaceChildren();
  const route = document.body.dataset.route;
  const needTree = route === "workspace" || route === "ide" || route === "preview";
  const needLab = route === "lab" || route === "tool";
  if (needTree) {
    addSideLabel(box, "Explorer"); addSideHead(box, "Opened Files", true);
    box.appendChild(listWrap(state.session.openIds.map((id) => state.files.find((f) => f.id === id)).filter(Boolean)));
    addSideHead(box, "Recent"); box.appendChild(listWrap(state.files.slice(0, 8)));
    addSideHead(box, "Workspace"); box.appendChild(listWrap(state.files.slice().sort((a, b) => a.name.localeCompare(b.name))));
    const outline = outlineOf(activeFile()); addSideHead(box, "Outline");
    const ol = document.createElement("div");
    if (!outline.length) { const p = document.createElement("p"); p.className = "empty"; p.textContent = "No headings or functions yet."; ol.appendChild(p); }
    else outline.forEach((row) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "file-row";
      b.innerHTML = "<span>" + escapeHtml(row.label) + "</span><small>L" + row.line + "</small>";
      b.addEventListener("click", () => jumpLine(row.line)); ol.appendChild(b);
    });
    box.appendChild(ol); return;
  }
  if (needLab) {
    addSideLabel(box, "Lab recents");
    const recents = state.lab.recents || [];
    if (!recents.length) { const p = document.createElement("p"); p.className = "empty"; p.textContent = "No lab history yet."; box.appendChild(p); }
    else recents.forEach((r) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "file-row";
      b.innerHTML = "<span>" + escapeHtml(r.label || r.kind) + "</span><small>" + escapeHtml(r.kind) + "</small>";
      b.addEventListener("click", () => { closeSidebar(); openLab(r.kind); }); box.appendChild(b);
    });
    return;
  }
  addSideLabel(box, "On this device");
  const p = document.createElement("p"); p.className = "empty";
  p.textContent = state.files.length + " workspace file(s). Keys and notes stay in the browser.";
  box.appendChild(p);
}
function addSideLabel(box, text) { const p = document.createElement("p"); p.className = "side-label"; p.textContent = text; box.appendChild(p); }
function addSideHead(box, text, plus) {
  const row = document.createElement("div"); row.className = "side-head";
  const span = document.createElement("span"); span.textContent = text; row.appendChild(span);
  if (plus) { const b = document.createElement("button"); b.type = "button"; b.className = "tiny"; b.textContent = "+"; b.addEventListener("click", askNewFile); row.appendChild(b); }
  box.appendChild(row);
}
function listWrap(rows) {
  const wrap = document.createElement("div");
  if (!rows.length) { const p = document.createElement("p"); p.className = "empty"; p.textContent = "Empty"; wrap.appendChild(p); return wrap; }
  rows.forEach((f) => wrap.appendChild(fileRow(f, () => { closeSidebar(); openInIde(f.id); })));
  return wrap;
}
function renderTabs() {
  const box = $("tabs"); box.replaceChildren();
  state.session.openIds.map((id) => state.files.find((f) => f.id === id)).filter(Boolean).forEach((file) => {
    const tab = document.createElement("button"); tab.type = "button";
    tab.className = "tab" + (file.id === state.session.activeId ? " is-on" : "");
    tab.innerHTML = "<span>" + escapeHtml(file.name) + "</span>";
    const x = document.createElement("button"); x.type = "button"; x.className = "x"; x.setAttribute("aria-label", "Close " + file.name); x.textContent = "\u00d7";
    x.addEventListener("click", (ev) => { ev.stopPropagation(); closeTab(file.id); });
    tab.appendChild(x); tab.addEventListener("click", () => openInIde(file.id)); box.appendChild(tab);
  });
}
function renderPlaceBar() {
  const box = $("place-bar"); box.replaceChildren();
  const file = activeFile(); const current = state.session.place;
  [["code", "Code"], ["markdown", "Markdown"], ["text", "Text"]].forEach(([id, label]) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = label;
    b.className = current === id ? "is-on" : ""; b.addEventListener("click", () => setPlace(id)); box.appendChild(b);
  });
  if (file && file.language === "html") {
    const run = document.createElement("button"); run.type = "button"; run.textContent = "Run";
    run.addEventListener("click", () => showPreview()); box.appendChild(run);
  }
}
function setPlace(place) {
  const file = activeFile(); state.session.place = place; if (file) file.place = place;
  applyPlace(); renderChips(); renderPlaceBar(); saveSession();
}
function applyPlace() {
  const ide = $("ide"); const place = state.session.place;
  ide.classList.toggle("is-text", place === "text"); ide.classList.toggle("is-md", place === "markdown");
}
function renderChips() {
  const file = activeFile(); const place = state.session.place;
  let list = [];
  if (place === "markdown") list = CHIPS.md;
  else if (place === "text") list = CHIPS.txt;
  else list = CHIPS[file ? file.language : "html"] || CHIPS.html;
  const box = $("chips"); box.replaceChildren();
  list.forEach((c) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = c;
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", () => insertChip(c)); box.appendChild(b);
  });
}
function insertChip(text) {
  const ed = $("editor"); const start = ed.selectionStart; const end = ed.selectionEnd;
  ed.value = ed.value.slice(0, start) + text + ed.value.slice(end);
  ed.focus(); ed.setSelectionRange(start + text.length, start + text.length);
  updateGutter(); scheduleSave();
}
function updateGutter() {
  const n = $("editor").value.split("\n").length;
  $("gutter").textContent = Array.from({ length: n }, (_, i) => i + 1).join("\n");
  $("gutter").scrollTop = $("editor").scrollTop;
}
function paintHint() {
  const file = activeFile(); const hint = localHint(file); const el = $("code-hint");
  if (!hint || state.session.place !== "code") { el.hidden = true; el.textContent = ""; return; }
  el.hidden = false; el.textContent = hint;
}
function loadActive() {
  const file = activeFile(); const ed = $("editor");
  if (!file) { ed.value = ""; updateGutter(); return; }
  ed.value = file.body || ""; state.session.place = placeFor(file);
  applyPlace(); updateGutter(); renderChips(); renderPlaceBar(); paintHint(); renderSideContext();
  try { ed.selectionStart = ed.selectionEnd = state.session.cursor || 0; ed.scrollTop = state.session.scrollTop || 0; } catch (_e) {}
}
async function openInIde(id) {
  const file = state.files.find((f) => f.id === id); if (!file) return;
  if (!state.session.openIds.includes(id)) state.session.openIds.push(id);
  state.session.activeId = id; state.session.welcomeSeen = true; showIde();
}
async function closeTab(id) {
  await flushEditor();
  state.session.openIds = state.session.openIds.filter((x) => x !== id);
  if (state.session.activeId === id) state.session.activeId = state.session.openIds[state.session.openIds.length - 1] || null;
  if (!state.session.activeId) { backFromIde(); return; }
  renderTabs(); loadActive(); saveSession();
}
function defaultBody(lang) {
  if (lang === "html") return "<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <title>doc</title>\n</head>\n<body>\n  <h1>hello</h1>\n</body>\n</html>\n";
  if (lang === "md") return "# note\n\nWrite here.\n";
  if (lang === "json") return "{\n  \n}\n";
  if (lang === "js") return "console.log(\"hello\");\n";
  return "";
}
async function createFile(name, body) {
  const path = uniqueName(name || "untitled.html");
  const file = { id: uuid(), name: path, path, body: body == null ? defaultBody(langFromName(path)) : body, language: langFromName(path), createdAt: now(), updatedAt: now(), source: "created" };
  state.files.unshift(file); await saveFile(file); await openInIde(file.id); return file;
}
function askNewFile() { const name = prompt("File name", "note.md"); if (name) createFile(name); }
function jumpLine(n) {
  closeSidebar(); const ed = $("editor"); const lines = ed.value.split("\n"); let pos = 0;
  for (let i = 0; i < n - 1 && i < lines.length; i += 1) pos += lines[i].length + 1;
  ed.focus(); ed.setSelectionRange(pos, pos); ed.scrollTop = Math.max(0, (n - 3) * 16 * 1.55);
}
function openSearch() { showPage("search"); $("search-input").value = ""; paintSearch(""); $("search-input").focus(); }
function closeSearch() {
  if (state.session.mode === "ide") showIde();
  else if (state.lastList === "lab") showLab();
  else if (state.files.length || state.session.welcomeSeen) showWorkspace();
  else showWelcome();
}
function paintSearch(q) {
  const query = q.trim().toLowerCase();
  const rows = state.files.filter((f) => !query || (f.name + " " + String(f.body || "").slice(0, 400)).toLowerCase().includes(query));
  const box = $("search-results"); box.replaceChildren();
  if (!rows.length) { const p = document.createElement("p"); p.className = "empty"; p.textContent = "No matches."; box.appendChild(p); return; }
  rows.forEach((f) => box.appendChild(fileRow(f, () => openInIde(f.id))));
}
function hideActions() { $("actions").hidden = true; }
function showActions() { $("actions").hidden = false; }
Object.assign(window, {
  showPage, markNav, closeSidebar, openSidebar, go,
  showWelcome, showWorkspace, showLab, showIde, backFromIde,
  renderWorkspace, renderLab, fileRow, paintFiles, renderSideContext,
  renderTabs, renderPlaceBar, setPlace, applyPlace, renderChips, insertChip,
  updateGutter, paintHint, loadActive, openInIde, closeTab, defaultBody,
  createFile, askNewFile, jumpLine, openSearch, closeSearch, paintSearch,
  hideActions, showActions
});
