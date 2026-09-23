function showHome() {
  state.session.mode = "home";
  $("home").classList.remove("is-hidden");
  $("ide").classList.add("is-hidden");
  closeSidebar();
  renderHome();
  saveSession();
}
function showIde() {
  state.session.mode = "ide";
  $("home").classList.add("is-hidden");
  $("ide").classList.remove("is-hidden");
  renderTabs();
  loadActive();
  renderChips();
  saveSession();
}
function renderHome() {
  const first = !state.session.welcomeSeen && state.files.length === 0;
  $("welcome").classList.toggle("is-hidden", !first);
  $("hub").classList.toggle("is-hidden", first);
  $("home-search-btn").style.visibility = first ? "hidden" : "visible";
  $("home-recents").replaceChildren();
  const recents = state.files.slice(0, 8);
  if (!recents.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Nothing recent yet.";
    $("home-recents").appendChild(p);
  } else recents.forEach((f) => $("home-recents").appendChild(fileRow(f, () => openInIde(f.id))));
  const last = state.files[0];
  $("home-summary").textContent = state.files.length ? state.files.length + " file(s)" : "No files yet.";
}
function fileRow(file, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.innerHTML = "<span>" + escapeHtml(file.name) + "</span><small>" + escapeHtml(file.language) + "</small>";
  btn.addEventListener("click", onClick);
  return btn;
}
function renderTabs() {
  const box = $("tabs");
  box.replaceChildren();
  state.session.openIds.map((id) => state.files.find((f) => f.id === id)).filter(Boolean).forEach((file) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "tab" + (file.id === state.session.activeId ? " is-on" : "");
    tab.innerHTML = "<span>" + escapeHtml(file.name) + "</span>";
    const x = document.createElement("button");
    x.type = "button"; x.className = "x"; x.textContent = "x";
    x.addEventListener("click", (ev) => { ev.stopPropagation(); closeTab(file.id); });
    tab.appendChild(x);
    tab.addEventListener("click", () => openInIde(file.id));
    box.appendChild(tab);
  });
}
function paintList(el, rows) {
  el.replaceChildren();
  if (!rows.length) {
    const p = document.createElement("p"); p.className = "muted"; p.style.padding = "8px"; p.textContent = "Empty";
    el.appendChild(p); return;
  }
  rows.forEach((f) => {
    const btn = fileRow(f, () => { openInIde(f.id); closeSidebar(); });
    if (f.id === state.session.activeId) btn.classList.add("is-on");
    el.appendChild(btn);
  });
}
function renderTree() {
  paintList($("opened-list"), state.session.openIds.map((id) => state.files.find((f) => f.id === id)).filter(Boolean));
  paintList($("recent-list"), state.files.slice(0, 8));
  paintList($("tree-list"), state.files.slice().sort((a, b) => a.name.localeCompare(b.name)));
  $("outline-list").replaceChildren();
}
function renderChips() {
  const file = activeFile();
  const list = CHIPS[file ? file.language : "html"] || CHIPS.html;
  const box = $("chips");
  box.replaceChildren();
  list.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = c;
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", () => insertChip(c));
    box.appendChild(b);
  });
}
function insertChip(text) {
  const ed = $("editor");
  const start = ed.selectionStart, end = ed.selectionEnd;
  ed.value = ed.value.slice(0, start) + text + ed.value.slice(end);
  ed.focus(); ed.setSelectionRange(start + text.length, start + text.length);
  updateGutter(); scheduleSave();
}
function updateGutter() {
  const n = $("editor").value.split("\n").length;
  $("gutter").textContent = Array.from({ length: n }, (_, i) => i + 1).join("\n");
  $("gutter").scrollTop = $("editor").scrollTop;
}
function loadActive() {
  const file = activeFile();
  if (!file) { $("editor").value = ""; updateGutter(); return; }
  $("editor").value = file.body || "";
  const mode = modeFor(file);
  $("view-mode").value = mode;
  state.session.viewMode = mode;
  $("ide").classList.toggle("is-text", mode === "text");
  updateGutter(); renderChips(); renderTree();
}
async function openInIde(id) {
  const file = state.files.find((f) => f.id === id);
  if (!file) return;
  if (!state.session.openIds.includes(id)) state.session.openIds.push(id);
  state.session.activeId = id;
  state.session.welcomeSeen = true;
  showIde();
}
async function closeTab(id) {
  await flushEditor();
  state.session.openIds = state.session.openIds.filter((x) => x !== id);
  if (state.session.activeId === id) state.session.activeId = state.session.openIds[state.session.openIds.length - 1] || null;
  if (!state.session.activeId) { showHome(); return; }
  renderTabs(); loadActive(); saveSession();
}
function defaultBody(lang) {
  if (lang === "html") return "<!DOCTYPE html>\n<html><head><meta charset=\"utf-8\"><title>doc</title></head><body>\n\n</body></html>\n";
  if (lang === "md") return "# note\n\n";
  if (lang === "json") return "{\n  \n}\n";
  return "";
}
async function createFile(name, body) {
  const path = uniqueName(name || "untitled.html");
  const file = { id: uuid(), name: path, path, body: body || defaultBody(langFromName(path)), language: langFromName(path), createdAt: now(), updatedAt: now(), source: "created" };
  state.files.unshift(file);
  await saveFile(file);
  await openInIde(file.id);
  return file;
}
function openSidebar(ctx) {
  $("sidebar").hidden = false;
  $("side-ide").style.display = (ctx === "ide" || state.session.mode === "ide") ? "block" : "none";
  renderTree();
}
function closeSidebar() { $("sidebar").hidden = true; }
function openSearch() {
  $("search").hidden = false;
  $("search-input").value = "";
  paintSearch("");
  $("search-input").focus();
}
function closeSearch() { $("search").hidden = true; }
function paintSearch(q) {
  const query = q.trim().toLowerCase();
  const rows = state.files.filter((f) => !query || (f.name + " " + f.body.slice(0, 200)).toLowerCase().includes(query));
  const box = $("search-results");
  box.replaceChildren();
  rows.forEach((f) => box.appendChild(fileRow(f, () => { closeSearch(); openInIde(f.id); })));
  if (!rows.length) {
    const p = document.createElement("p"); p.className = "muted"; p.textContent = "No matches."; box.appendChild(p);
  }
}
function openSheet(title, html, after) {
  $("sheet-title").textContent = title;
  $("sheet-body").innerHTML = html;
  $("sheet").hidden = false;
  if (after) after();
}
function closeSheet() { $("sheet").hidden = true; $("sheet-body").replaceChildren(); }
function showPreview() {
  flushEditor();
  const file = activeFile();
  openSheet("Preview", "<pre class=\"mono\">" + escapeHtml(file ? file.body || "" : "No file") + "</pre>");
}
function labSnippets() {
  openSheet("Snippets", "<div class=\"list\" id=\"snip-list\"></div>");
  const box = $("snip-list");
  if (!state.files.length) {
    const p = document.createElement("p"); p.className = "muted"; p.textContent = "Import or create a file first."; box.appendChild(p);
  } else state.files.forEach((f) => box.appendChild(fileRow(f, () => { closeSheet(); openInIde(f.id); })));
}
function labRegex() {
  openSheet("Regex Test", "<label class=\"field\">Pattern <input id=\"rx-p\"></label><label class=\"field\">Flags <input id=\"rx-f\" value=\"g\"></label><label class=\"field\">Sample <textarea id=\"rx-s\" rows=\"6\"></textarea></label>");
}
function labJson() {
  openSheet("JSON Lab", "<label class=\"field\"><textarea id=\"j-in\" rows=\"12\"></textarea></label><button class=\"ghost\" id=\"j-pretty\" type=\"button\">Pretty</button><p class=\"status\" id=\"j-st\"></p>", () => {
    $("j-pretty").addEventListener("click", () => {
      try { $("j-in").value = JSON.stringify(JSON.parse($("j-in").value), null, 2); $("j-st").textContent = "Valid JSON"; }
      catch (err) { $("j-st").textContent = err.message; }
    });
  });
}
function labVibe() {
  openSheet("Vibe", "<label class=\"field\"><textarea id=\"vibe-in\" rows=\"8\"><!DOCTYPE html><h1>hello</h1></textarea></label><button class=\"primary\" id=\"vibe-run\" type=\"button\">Run</button><iframe class=\"preview-frame\" id=\"vibe-frame\" sandbox=\"allow-scripts\" title=\"Vibe\"></iframe>", () => {
    $("vibe-run").addEventListener("click", () => { $("vibe-frame").srcdoc = $("vibe-in").value; });
  });
}
