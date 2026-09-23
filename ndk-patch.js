"use strict";
state.folder = state.folder || "";
state.opsTarget = null;
function dirName(path) { const p = String(path || ""); const i = p.lastIndexOf("/"); return i >= 0 ? p.slice(0, i) : ""; }
function baseName(path) { const p = String(path || ""); const i = p.lastIndexOf("/"); return i >= 0 ? p.slice(i + 1) : p; }
function joinPath(folder, name) { const n = String(name || "").replace(/^\/+/, ""); return folder ? folder.replace(/\/+$/, "") + "/" + n : n; }
async function shareItem(file) {
  if (!file) return;
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
  const btn = document.createElement("button"); btn.className = "file-row"; btn.type = "button";
  const label = baseName(file.path || file.name);
  const mark = file.kind === "dir" || file.language === "dir" ? "dir" : (file.language || "txt").slice(0, 4);
  const when = (file.kind === "dir" || file.language === "dir") ? "Folder" : (file.updatedAt || "").slice(0, 16).replace("T", " ");
  btn.innerHTML = `<span class="ext">${escapeHtml(mark)}</span><span><b>${escapeHtml(label)}</b><small>${escapeHtml(when)}</small></span>`;
  btn.addEventListener("click", () => { if (file.kind === "dir" || file.language === "dir") { state.folder = file.path; paintWorkspace(); return; } openFile(file.id); });
  bindLongPress(btn, file);
  return btn;
}
function paintWorkspace() {
  const files = sortedFiles(); const folder = state.folder || "";
  $("ws-strip").innerHTML = folder ? `<strong>${escapeHtml(folder)}</strong>` : (files[0] ? `<strong>${escapeHtml(files[0].name)}</strong> · ${files.length} on device` : "Empty workspace");
  const bar = $("ws-filters"); bar.innerHTML = "";
  FILTERS.forEach((key) => { const b = document.createElement("button"); b.type = "button"; b.textContent = key; b.className = state.filter === key ? "on" : ""; b.addEventListener("click", () => { state.filter = key; paintWorkspace(); }); bar.appendChild(b); });
  const list = $("ws-list"); list.innerHTML = "";
  if (folder) { const up = document.createElement("button"); up.className = "file-row"; up.type = "button"; up.innerHTML = `<span class="ext">..</span><span><b>Up</b><small>Parent folder</small></span>`; up.onclick = () => { state.folder = dirName(folder); paintWorkspace(); }; list.appendChild(up); }
  const dirs = new Map(); const shown = [];
  files.forEach((f) => {
    const path = f.path || f.name; const parent = dirName(path);
    if (parent === folder) { if (state.filter === "all" || f.language === state.filter || f.language === "dir") shown.push(f); return; }
    if (folder ? path.startsWith(folder + "/") : path.includes("/")) { const rest = folder ? path.slice(folder.length + 1) : path; const next = rest.split("/")[0]; if (next) dirs.set(joinPath(folder, next), next); }
  });
  dirs.forEach((name, path) => list.appendChild(fileRow({ id: "dir:" + path, kind: "dir", name, path, language: "dir" })));
  shown.filter((f) => f.language !== "dir" && f.kind !== "dir").forEach((f) => list.appendChild(fileRow(f)));
  if (!list.childNodes.length) list.appendChild(emptyBox("Nothing here. Long-press for file ops."));
}
function paintPills() {
  const bar = $("place-pills"); if (!bar) return;
  bar.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.getAttribute("data-place") === (state.session.place || "code")));
}
const _paintEditor = paintEditor;
paintEditor = function () { _paintEditor(); paintPills(); };
async function createFolder(name) {
  const label = String(name || "folder").replace(/[^a-z0-9._-]+/gi, "-") || "folder";
  const path = joinPath(state.folder || "", label);
  await saveFile({ id: uuid(), name: label, path, body: "", language: "dir", kind: "dir", createdAt: now(), updatedAt: now(), source: "new" });
  toast("Folder ready"); if (state.session.mode === "workspace") paintWorkspace();
}
function handleOps(ev) {
  const act = ev.target.getAttribute("data-act"); if (!act) return;
  $("actions").hidden = true;
  const file = state.opsTarget || activeFile();
  if (act === "code" && file && file.id && !String(file.id).startsWith("dir:")) openFile(file.id, "code");
  else if (act === "markdown" && file && file.id && !String(file.id).startsWith("dir:")) openFile(file.id, "markdown");
  else if (act === "text" && file && file.id && !String(file.id).startsWith("dir:")) openFile(file.id, "text");
  else if (act === "download" && file && file.kind !== "dir") downloadBlob(file.name, file.body || "", MIME[file.language] || "text/plain");
  else if (act === "share" && file) shareItem(file);
  else if (act === "new-file") promptName(createFile);
  else if (act === "new-folder") { const n = window.prompt("Folder name", "notes"); if (n) createFolder(n); }
  else if (act === "rename" && file && !String(file.id).startsWith("dir:")) {
    const name = window.prompt("Rename", file.name);
    if (name) { const parent = dirName(file.path || file.name); const next = uniqueName(joinPath(parent, safeName(name, langFromName(name)))); file.name = baseName(next); file.path = next; file.language = langFromName(file.name); saveFile(file).then(() => { paintEditor(); if (state.session.mode === "workspace") paintWorkspace(); }); }
  } else if (act === "ai") go("ai");
  else if (act === "close" && file && file.kind !== "dir") {
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
});
