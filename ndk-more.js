function showSettings() {
  const keys = readKeys();
  const prefs = readPrefs();
  openSheet("Settings",
    "<h3>Workspace</h3><label class=\"field\">Font <select id=\"st-font\"><option value=\"14\">14</option><option value=\"16\">16</option><option value=\"18\">18</option></select></label>" +
    "<label class=\"field\"><span><input id=\"st-wrap\" type=\"checkbox\"> Wrap lines</span></label>" +
    "<label class=\"field\"><span><input id=\"st-restore\" type=\"checkbox\"> Restore last session</span></label>" +
    "<h3>Keys</h3><p class=\"muted\">Stay on this phone.</p>" +
    "<label class=\"field\">Gemini <input id=\"st-gem\" type=\"password\" autocomplete=\"off\"></label>" +
    "<label class=\"field\">OpenRouter <input id=\"st-or\" type=\"password\" autocomplete=\"off\"></label>" +
    "<div class=\"row\"><button class=\"primary\" id=\"st-save-keys\" type=\"button\">Save keys</button><button class=\"danger\" id=\"st-clear-keys\" type=\"button\">Clear keys</button></div>" +
    "<h3>Backup</h3><label class=\"field\"><span><input id=\"st-inc-keys\" type=\"checkbox\"> Include keys</span></label>" +
    "<div class=\"row\"><button class=\"primary\" id=\"st-backup\" type=\"button\">Full backup</button><button class=\"ghost\" id=\"st-restore-btn\" type=\"button\">Restore</button></div>" +
    "<input id=\"st-restore-file\" type=\"file\" accept=\"application/json,.json\" hidden>" +
    "<h3>About</h3><p>Naija DevKit " + VERSION + "</p>" +
    "<button class=\"ghost\" id=\"st-gh\" type=\"button\">Open GitHub repo</button>" +
    "<h3>Danger</h3><button class=\"danger\" id=\"st-wipe\" type=\"button\">Delete vault</button>",
    () => {
      $("st-font").value = String(prefs.font);
      $("st-wrap").checked = !!prefs.wrap;
      $("st-restore").checked = prefs.restore !== false;
      $("st-gem").value = keys.gemini || "";
      $("st-or").value = keys.openrouter || "";
      const saveP = () => { writePrefs({ font: $("st-font").value, wrap: $("st-wrap").checked, restore: $("st-restore").checked, chips: true }); applyPrefs(); };
      $("st-font").addEventListener("change", saveP);
      $("st-wrap").addEventListener("change", saveP);
      $("st-restore").addEventListener("change", saveP);
      $("st-save-keys").addEventListener("click", () => { writeKeys({ gemini: $("st-gem").value.trim(), openrouter: $("st-or").value.trim() }); toast("Keys saved on this phone"); });
      $("st-clear-keys").addEventListener("click", () => { localStorage.removeItem(KEYS); $("st-gem").value = ""; $("st-or").value = ""; toast("Keys cleared"); });
      $("st-backup").addEventListener("click", () => exportBackup($("st-inc-keys").checked));
      $("st-restore-btn").addEventListener("click", () => $("st-restore-file").click());
      $("st-restore-file").addEventListener("change", async (ev) => {
        const file = ev.target.files && ev.target.files[0]; ev.target.value = ""; if (!file) return;
        try { await importBackup(JSON.parse(await file.text())); toast("Restore complete"); closeSheet(); bootPaint(); }
        catch (err) { toast(err.message || "Restore failed"); }
      });
      $("st-gh").addEventListener("click", () => { if (!navigator.onLine) { toast("Needs a connection"); return; } location.href = GH; });
      $("st-wipe").addEventListener("click", async () => {
        if (!confirm("Delete every workspace file on this phone?")) return;
        await clearOf("files"); state.files = []; state.session = Object.assign(sess(), { welcomeSeen: true, mode: "home" });
        await saveSession(); closeSheet(); showHome(); toast("Vault cleared");
      });
    }
  );
}
function showAi() {
  const keys = readKeys();
  openSheet("AI Assistant", "<p class=\"muted\" id=\"ai-hint\"></p><label class=\"field\"><textarea id=\"ai-in\" rows=\"3\"></textarea></label>");
  if (!keys.gemini) $("ai-hint").textContent = "Save a Gemini key in Settings.";
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
  toast("Backup downloaded");
}
async function importBackup(data) {
  if (!data || data.app !== APP) throw new Error("Not a Naija DevKit backup");
  await clearOf("files");
  state.files = (Array.isArray(data.files) ? data.files : []).map((f) => ({
    id: String(f.id || uuid()), name: String(f.name || f.path || "untitled.txt"), path: String(f.path || f.name || "untitled.txt"),
    body: String(f.body || ""), language: EXT[f.language] ? f.language : langFromName(f.name || ""),
    createdAt: f.createdAt || now(), updatedAt: f.updatedAt || now(), source: "restore"
  }));
  const db = await openDb(); const tx = db.transaction("files", "readwrite");
  state.files.forEach((f) => tx.objectStore("files").put(f));
  await txDone(tx); db.close();
  if (data.session) state.session = Object.assign(sess(), data.session, { id: "ui" });
  if (data.prefs) writePrefs(Object.assign(readPrefs(), data.prefs));
  if (data.keys) writeKeys(data.keys);
  await saveSession();
}
async function importLocalFiles(list) {
  for (const raw of [].slice.call(list)) {
    const name = uniqueName(raw.name || "import.txt");
    let text = "";
    try { text = await raw.text(); } catch (_e) { toast("Could not read " + raw.name); continue; }
    const file = { id: uuid(), name: name, path: name, body: text, language: langFromName(name), createdAt: now(), updatedAt: now(), source: "imported" };
    state.files.unshift(file); await saveFile(file);
    if (!state.session.openIds.includes(file.id)) state.session.openIds.push(file.id);
    state.session.activeId = file.id;
  }
  state.session.welcomeSeen = true;
  showIde();
}
function goSide(action) {
  closeSidebar();
  if (action === "home" || action === "lab") { showHome(); return; }
  if (action === "settings") { showSettings(); return; }
  if (action === "ai") { showAi(); return; }
  if (action === "extensions") { toast("Extensions Hub comes later"); return; }
  if (action === "github") { if (!navigator.onLine) { toast("Needs a connection"); return; } location.href = GH; }
}
function bind() {
  $("home-menu").addEventListener("click", () => openSidebar("home"));
  $("ide-folder").addEventListener("click", () => openSidebar("ide"));
  $("sidebar-scrim").addEventListener("click", closeSidebar);
  $("home-search-btn").addEventListener("click", openSearch);
  $("search-launch").addEventListener("click", openSearch);
  $("search-back").addEventListener("click", closeSearch);
  $("search-input").addEventListener("input", () => paintSearch($("search-input").value));
  $("btn-start").addEventListener("click", () => createFile("index.html"));
  $("btn-open-ide").addEventListener("click", () => {
    if (state.session.activeId || state.files[0]) openInIde(state.session.activeId || state.files[0].id);
    else createFile("index.html");
  });
  $("btn-import-home").addEventListener("click", () => $("file-input").click());
  $("btn-import-hub").addEventListener("click", () => $("file-input").click());
  $("file-input").addEventListener("change", async (ev) => {
    const list = ev.target.files; ev.target.value = "";
    if (list && list.length) await importLocalFiles(list);
  });
  $("ide-back").addEventListener("click", async () => { await flushEditor(); showHome(); });
  $("btn-new-file").addEventListener("click", () => { const name = prompt("File name", "note.md"); if (name) createFile(name); });
  $("btn-preview").addEventListener("click", showPreview);
  $("view-mode").addEventListener("change", () => {
    const file = activeFile();
    state.session.viewMode = $("view-mode").value;
    if (file) file.viewMode = $("view-mode").value;
    $("ide").classList.toggle("is-text", $("view-mode").value === "text");
    saveSession();
  });
  $("editor").addEventListener("input", () => { updateGutter(); scheduleSave(); });
  $("sheet-back").addEventListener("click", closeSheet);
  document.querySelectorAll("[data-lab]").forEach((btn) => btn.addEventListener("click", () => {
    const id = btn.getAttribute("data-lab");
    if (id === "snippets") labSnippets();
    if (id === "regex") labRegex();
    if (id === "json") labJson();
    if (id === "vibe") labVibe();
  }));
  document.querySelectorAll("[data-go]").forEach((btn) => btn.addEventListener("click", () => goSide(btn.getAttribute("data-go"))));
  window.addEventListener("pagehide", () => { flushEditor(); });
}
function bootPaint() {
  applyPrefs();
  const prefs = readPrefs();
  if (prefs.restore !== false && state.session.mode === "ide" && state.session.activeId && state.files.some((f) => f.id === state.session.activeId)) showIde();
  else showHome();
}
async function boot() {
  bind();
  try {
    state.files = await allOf("files");
    state.files.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const sessions = await allOf("session");
    if (sessions[0]) state.session = Object.assign(sess(), sessions[0]);
    const labs = await allOf("lab");
    if (labs[0]) state.lab = Object.assign(state.lab, labs[0]);
    state.messages = await allOf("messages");
  } catch (_e) { toast("Storage unavailable"); }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  bootPaint();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
