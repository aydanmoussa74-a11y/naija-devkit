"use strict";
state.folder = state.folder || "";
state.opsTarget = null;
function dirName(path) { const p = String(path || ""); const i = p.lastIndexOf("/"); return i >= 0 ? p.slice(0, i) : ""; }
function baseName(path) { const p = String(path || ""); const i = p.lastIndexOf("/"); return i >= 0 ? p.slice(i + 1) : p; }
function joinPath(folder, name) { const n = String(name || "").replace(/^\/+/, ""); return folder ? folder.replace(/\/+$/, "") + "/" + n : n; }
function isDir(file) { return !!(file && (file.kind === "dir" || file.language === "dir")); }
function typeMark(file) {
  if (isDir(file)) return "DIR";
  const lang = (file && file.language) || langFromName((file && file.name) || "") || "txt";
  return ({ html: "HTML", css: "CSS", js: "JS", ts: "TS", py: "PY", md: "MD", json: "JSON", txt: "TXT" }[lang] || String(lang).toUpperCase().slice(0, 4));
}
async function shareItem(file) {
  if (!file || isDir(file)) return;
  const blob = new File([file.body || ""], file.name || "file.txt", { type: MIME[file.language] || "text/plain" });
  try {
    if (navigator.share) {
      if (navigator.canShare && navigator.canShare({ files: [blob] })) { await navigator.share({ files: [blob], title: file.name }); return; }
      await navigator.share({ title: file.name, text: file.body || file.name }); return;
    }
  } catch (_e) {}
  downloadBlob(file.name, file.body || "", MIME[file.language] || "text/plain");
  toast("Saved to downloads");
}
function bindLongPress(el, item) {
  let timer = 0;
  const start = (ev) => { if (ev.pointerType === "mouse" && ev.button !== 0) return; timer = setTimeout(() => { timer = 0; openOps(item); }, 480); };
  const clear = () => { if (timer) { clearTimeout(timer); timer = 0; } };
  el.addEventListener("pointerdown", start);
  ["pointerup", "pointerleave", "pointercancel"].forEach((n) => el.addEventListener(n, clear));
  el.addEventListener("contextmenu", (ev) => { ev.preventDefault(); openOps(item); });
}
function openOps(item) { state.opsTarget = item; $("actions").hidden = false; }
function fileRow(file) {
  const row = document.createElement("div");
  row.className = "file-row tree-row";
  const mark = typeMark(file);
  const label = baseName(file.path || file.name);
  const when = isDir(file) ? "Folder" : (file.scratch ? "Untitled" : (file.updatedAt || "").slice(0, 16).replace("T", " "));
  const main = document.createElement("button");
  main.className = "tree-main"; main.type = "button";
  main.innerHTML = `<span class="ext kind-${escapeHtml(String(file.language || (isDir(file) ? "dir" : "txt")))}">${escapeHtml(mark)}</span><span class="tree-copy"><b>${escapeHtml(label)}</b><small>${escapeHtml(when)}</small></span>${isDir(file) ? "" : `<span class="lang-pill">${escapeHtml(mark)}</span>`}`;
  main.addEventListener("click", () => {
    if (isDir(file)) { state.folder = file.path; paintWorkspace(); return; }
    openFile(file.id);
  });
  bindLongPress(main, file);
  const more = document.createElement("button");
  more.className = "row-kebab"; more.type = "button"; more.setAttribute("aria-label", "File actions");
  more.textContent = "⋮";
  more.addEventListener("click", (ev) => { ev.stopPropagation(); openOps(file); });
  row.appendChild(main); row.appendChild(more);
  return row;
}
function paintWorkspace() {
  const files = sortedFiles();
  const folder = state.folder || "";
  const box = (state.workspaces || []).find((w) => w.id === state.workspaceId);
  const chips = $("ws-boxes");
  if (chips) {
    chips.innerHTML = "";
    (state.workspaces || []).forEach((w) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = w.name;
      b.className = w.id === state.workspaceId ? "on" : "";
      b.addEventListener("click", () => {
        state.workspaceId = w.id; state.folder = ""; state.session.workspaceId = w.id;
        w.lastOpened = now(); putOf("workspaces", w); saveSession(); paintWorkspace();
      });
      chips.appendChild(b);
    });
  }
  $("ws-strip").innerHTML = folder
    ? `<strong>${escapeHtml(folder)}</strong>`
    : `<strong>${escapeHtml((box && box.name) || "Personal")}</strong> · ${files.filter((f) => !isDir(f)).length} files`;
  const bar = $("ws-filters"); bar.innerHTML = "";
  FILTERS.forEach((key) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = key;
    b.className = state.filter === key ? "on" : "";
    b.addEventListener("click", () => { state.filter = key; paintWorkspace(); });
    bar.appendChild(b);
  });
  const list = $("ws-list"); list.innerHTML = "";
  if (folder) {
    const up = document.createElement("div"); up.className = "file-row tree-row";
    up.innerHTML = `<button class="tree-main" type="button"><span class="ext kind-dir">UP</span><span class="tree-copy"><b>Up</b><small>Parent folder</small></span></button>`;
    up.querySelector("button").onclick = () => { state.folder = dirName(folder); paintWorkspace(); };
    list.appendChild(up);
  }
  const dirs = new Map(); const shown = [];
  files.forEach((f) => {
    const path = f.path || f.name; const parent = dirName(path);
    if (parent === folder) { if (state.filter === "all" || f.language === state.filter || isDir(f)) shown.push(f); return; }
    if (folder ? path.startsWith(folder + "/") : path.includes("/")) {
      const rest = folder ? path.slice(folder.length + 1) : path;
      const next = rest.split("/")[0];
      if (next) dirs.set(joinPath(folder, next), next);
    }
  });
  dirs.forEach((name, path) => list.appendChild(fileRow({ id: "dir:" + path, kind: "dir", name, path, language: "dir" })));
  shown.filter((f) => !isDir(f)).forEach((f) => list.appendChild(fileRow(f)));
  if (!list.querySelector(".tree-row, .file-row")) {
    list.appendChild(emptyBox("This workspace is empty. Start writing or tap +."));
  }
}
function paintPills() {
  const bar = $("place-pills"); if (!bar) return;
  bar.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.getAttribute("data-place") === (state.session.place || "code")));
}
const _paintEditor = paintEditor;
paintEditor = function () { _paintEditor(); paintPills(); };
const _paintDrawer = paintDrawer;
paintDrawer = function () {
  _paintDrawer();
  ["drawer-open", "drawer-all"].forEach((id) => {
    const root = $(id); if (!root) return;
    root.querySelectorAll("button").forEach((b) => {
      if (b.querySelector(".ext")) return;
    });
  });
};
async function createFolder(name) {
  const label = String(name || "folder").replace(/[^a-z0-9._-]+/gi, "-") || "folder";
  const path = joinPath(state.folder || "", label);
  await saveFile({
    id: uuid(), name: label, path, body: "", language: "dir", kind: "dir",
    workspaceId: state.workspaceId || PERSONAL,
    createdAt: now(), updatedAt: now(), source: "new"
  });
  toast("Folder ready"); if (state.session.mode === "workspace") paintWorkspace();
}
async function createWorkspace(name) {
  const box = { id: uuid(), name: String(name || "Workspace").trim() || "Workspace", createdAt: now(), lastOpened: now() };
  state.workspaces.push(box);
  await putOf("workspaces", box);
  state.workspaceId = box.id;
  state.session.workspaceId = box.id;
  state.folder = "";
  await saveSession();
  toast("New workspace");
  await startScratch();
}
async function deleteItem(file) {
  if (!file || String(file.id).startsWith("dir:")) return;
  await delOf("files", file.id);
  state.files = state.files.filter((f) => f.id !== file.id);
  state.session.openIds = state.session.openIds.filter((id) => id !== file.id);
  if (state.session.activeId === file.id) state.session.activeId = state.session.openIds[0] || null;
  await saveSession();
  toast("Removed");
  if (state.session.activeId) openFile(state.session.activeId);
  else if (state.session.mode === "workspace") paintWorkspace();
  else go("workspace");
}
function handleOps(ev) {
  const act = ev.target.getAttribute("data-act"); if (!act) return;
  $("actions").hidden = true;
  const file = state.opsTarget || activeFile();
  if (act === "code" && file && file.id && !String(file.id).startsWith("dir:")) openFile(file.id, "code");
  else if (act === "markdown" && file && file.id && !String(file.id).startsWith("dir:")) openFile(file.id, "markdown");
  else if (act === "text" && file && file.id && !String(file.id).startsWith("dir:")) openFile(file.id, "text");
  else if (act === "download" && file && !isDir(file)) downloadBlob(file.name, file.body || "", MIME[file.language] || "text/plain");
  else if (act === "share" && file) shareItem(file);
  else if (act === "new-file") askName("New file", "untitled.html", (n) => createFile(n));
  else if (act === "new-folder") askName("Folder name", "notes", (n) => createFolder(n));
  else if (act === "rename" && file && !String(file.id).startsWith("dir:")) {
    askName("Rename", file.name, (name) => {
      const parent = dirName(file.path || file.name);
      const next = uniqueName(joinPath(parent, safeName(name, langFromName(name))));
      file.name = baseName(next); file.path = next; file.language = langFromName(file.name); file.scratch = false;
      saveFile(file).then(() => { paintEditor(); if (state.session.mode === "workspace") paintWorkspace(); });
    });
  } else if (act === "delete" && file) deleteItem(file);
  else if (act === "ai") go("ai");
  else if (act === "close" && file && !isDir(file)) {
    state.session.openIds = state.session.openIds.filter((id) => id !== file.id);
    state.session.activeId = state.session.openIds[0] || null;
    if (state.session.activeId) openFile(state.session.activeId); else go(state.lastHub || "home");
  }
}
function bindKb() {
  const vv = window.visualViewport;
  const apply = () => { let kb = 0; if (vv) kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); document.documentElement.style.setProperty("--kb", kb + "px"); };
  if (vv) { vv.addEventListener("resize", apply); vv.addEventListener("scroll", apply); }
  window.addEventListener("resize", apply); apply();
}
document.addEventListener("DOMContentLoaded", () => {
  bindKb();
  const pills = $("place-pills");
  if (pills) pills.addEventListener("click", (ev) => { const b = ev.target.closest("button[data-place]"); const file = activeFile(); if (b && file) openFile(file.id, b.getAttribute("data-place")); });
  const old = $("actions");
  if (old) { const neu = old.cloneNode(true); old.parentNode.replaceChild(neu, old); neu.addEventListener("click", handleOps); }
  const create = $("create-sheet");
  if (create) {
    create.addEventListener("click", (ev) => {
      const act = ev.target.getAttribute("data-create"); if (!act) return;
      create.hidden = true;
      if (act === "scratch") startScratch();
      else if (act === "file") askName("New file", "untitled.html", (n) => createFile(n));
      else if (act === "folder") askName("Folder name", "notes", (n) => createFolder(n));
      else if (act === "workspace") askName("Workspace name", "Notes", (n) => createWorkspace(n));
    });
  }
  const sheet = $("name-sheet");
  if (sheet) {
    $("name-sheet-cancel").onclick = () => { sheet.hidden = true; };
    $("name-sheet-ok").onclick = () => {
      const value = String($("name-sheet-input").value || "").trim();
      const fn = sheet._onok; sheet.hidden = true; sheet._onok = null;
      if (value && fn) fn(value);
    };
    $("name-sheet-input").addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); $("name-sheet-ok").click(); }
      if (ev.key === "Escape") sheet.hidden = true;
    });
    $("name-sheet-scrim").onclick = () => { sheet.hidden = true; };
  }
});
