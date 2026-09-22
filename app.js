(() => {
  "use strict";

  const DB_NAME = "naija-devkit";
  const DB_VERSION = 1;
  const KEY_STORE = "ndk.keys.v1";
  const PREF_STORE = "ndk.prefs.v1";
  const ROUTES = ["vault", "json", "regex", "backup", "settings"];
  const LANG_EXT = { js: "js", ts: "ts", py: "py", html: "html", css: "css", json: "json", md: "md", txt: "txt" };
  const MIME = {
    js: "text/javascript",
    ts: "text/plain",
    py: "text/x-python",
    html: "text/html",
    css: "text/css",
    json: "application/json",
    md: "text/markdown",
    txt: "text/plain"
  };

  const $ = (id) => document.getElementById(id);
  const state = {
    items: [],
    activeId: null,
    dirty: false,
    route: "vault",
    persistTimer: 0
  };

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("is-on");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("is-on"), 2200);
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("items")) {
          const store = db.createObjectStore("items", { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt");
          store.createIndex("kind", "kind");
          store.createIndex("language", "language");
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function withStore(name, mode, fn) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(name, mode);
      const store = tx.objectStore(name);
      const result = fn(store);
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error || new Error("Transaction aborted"));
      };
    });
  }

  const db = {
    async allItems() {
      const dbh = await openDb();
      return new Promise((resolve, reject) => {
        const tx = dbh.transaction("items", "readonly");
        const req = tx.objectStore("items").getAll();
        req.onsuccess = () => {
          dbh.close();
          const rows = req.result || [];
          rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
          resolve(rows);
        };
        req.onerror = () => {
          dbh.close();
          reject(req.error);
        };
      });
    },
    async putItem(item) {
      try {
        await withStore("items", "readwrite", (store) => store.put(item));
      } catch (error) {
        if (error && error.name === "QuotaExceededError") {
          throw new Error("Storage full. Export a backup and delete old snippets.");
        }
        throw error;
      }
    },
    async deleteItem(id) {
      await withStore("items", "readwrite", (store) => store.delete(id));
    },
    async replaceAll(items) {
      const dbh = await openDb();
      return new Promise((resolve, reject) => {
        const tx = dbh.transaction("items", "readwrite");
        const store = tx.objectStore("items");
        store.clear();
        items.forEach((item) => store.put(item));
        tx.oncomplete = () => {
          dbh.close();
          resolve();
        };
        tx.onerror = () => {
          dbh.close();
          reject(tx.error);
        };
      });
    },
    async wipe() {
      await withStore("items", "readwrite", (store) => store.clear());
    }
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function highlight(code, lang) {
    let text = escapeHtml(code);
    const paint = (pattern, cls) => {
      text = text.replace(pattern, (match) => `<span class="${cls}">${match}</span>`);
    };
    if (lang === "json") {
      paint(/&quot;([^&]|&amp;)*&quot;(?=\s*:)/g, "tok-fn");
      paint(/&quot;([^&]|&amp;)*&quot;/g, "tok-str");
      paint(/\b-?\d+(?:\.\d+)?\b/g, "tok-num");
      paint(/\b(?:true|false|null)\b/g, "tok-kw");
      return text;
    }
    paint(/\/\*[\s\S]*?\*\//g, "tok-com");
    paint(/(^|[^:])\/\/.*$/gm, "tok-com");
    paint(/#.*$/gm, "tok-com");
    paint(/(&quot;|&#39;)(?:\\.|(?!\1).)*\1/g, "tok-str");
    paint(/`(?:\\.|[^\\`])*`/g, "tok-str");
    paint(/\b-?\d+(?:\.\d+)?\b/g, "tok-num");
    paint(/\b(?:const|let|var|function|return|if|else|for|while|class|import|from|export|async|await|try|catch|new|def|and|or|not|in|True|False|None|print|with|as|elif)\b/g, "tok-kw");
    return text;
  }

  function fileNameFor(item) {
    const base = (item.title || "untitled").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";
    const ext = item.kind === "note" && item.language === "txt" ? "txt" : (LANG_EXT[item.language] || "txt");
    return base.endsWith("." + ext) ? base : `${base}.${ext}`;
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function readKeys() {
    try {
      return JSON.parse(localStorage.getItem(KEY_STORE) || "{}");
    } catch (_error) {
      return {};
    }
  }

  function writeKeys(keys) {
    localStorage.setItem(KEY_STORE, JSON.stringify(keys));
  }

  function readPrefs() {
    try {
      return Object.assign({ wrap: true, font: "16" }, JSON.parse(localStorage.getItem(PREF_STORE) || "{}"));
    } catch (_error) {
      return { wrap: true, font: "16" };
    }
  }

  function writePrefs(prefs) {
    localStorage.setItem(PREF_STORE, JSON.stringify(prefs));
  }

  function applyPrefs() {
    const prefs = readPrefs();
    document.documentElement.style.setProperty("--font", `${prefs.font}px`);
    $("pref-wrap").checked = !!prefs.wrap;
    $("pref-font").value = String(prefs.font);
    $("item-highlight").parentElement.classList.toggle("is-wrap", !!prefs.wrap);
  }

  function currentDraft() {
    return {
      id: state.activeId || uuid(),
      title: $("item-title").value.trim() || "untitled",
      kind: $("item-kind").value,
      language: $("item-lang").value,
      tags: $("item-tags").value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
      body: $("item-body").value,
      createdAt: (state.items.find((i) => i.id === state.activeId) || {}).createdAt || nowIso(),
      updatedAt: nowIso()
    };
  }

  function renderHighlight() {
    const lang = $("item-lang").value;
    $("item-highlight").innerHTML = highlight($("item-body").value, lang) + "\n";
  }

  function syncScroll() {
    $("item-highlight").scrollTop = $("item-body").scrollTop;
    $("item-highlight").scrollLeft = $("item-body").scrollLeft;
  }

  function setSaveState(label) {
    $("save-state").textContent = label;
  }

  function showVaultEditor(show) {
    $("vault-empty").classList.toggle("is-hidden", show);
    $("vault-editor").classList.toggle("is-hidden", !show);
  }

  function loadItem(item) {
    state.activeId = item ? item.id : null;
    state.dirty = false;
    if (!item) {
      showVaultEditor(false);
      $("title-file").textContent = "Welcome";
      return;
    }
    showVaultEditor(true);
    $("item-title").value = item.title || "";
    $("item-kind").value = item.kind || "snippet";
    $("item-lang").value = item.language || "js";
    $("item-tags").value = (item.tags || []).join(", ");
    $("item-body").value = item.body || "";
    $("title-file").textContent = fileNameFor(item);
    renderHighlight();
    setSaveState("Saved");
    renderTree();
  }

  function matchesFilter(item, query) {
    if (!query) return true;
    const blob = `${item.title} ${(item.tags || []).join(" ")} ${item.language} ${item.kind}`.toLowerCase();
    return blob.includes(query);
  }

  function renderTree() {
    const q = ($("search-box").value || "").trim().toLowerCase();
    const snippets = state.items.filter((i) => i.kind !== "note" && matchesFilter(i, q));
    const notes = state.items.filter((i) => i.kind === "note" && matchesFilter(i, q));
    const make = (item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tree-item" + (item.id === state.activeId ? " is-active" : "");
      btn.innerHTML = `<span>${escapeHtml(fileNameFor(item))}</span><small>${escapeHtml(item.language || "")}</small>`;
      btn.addEventListener("click", async () => {
        if (state.dirty && state.route === "vault") await saveCurrent(false);
        navigate("vault");
        loadItem(item);
        if (window.matchMedia("(max-width: 879px)").matches) setExplorer(false);
      });
      return btn;
    };
    const tree = $("file-tree");
    tree.replaceChildren();
    const addGroup = (label, rows) => {
      const head = document.createElement("div");
      head.className = "tree-group";
      head.textContent = label;
      tree.appendChild(head);
      if (!rows.length) {
        const empty = document.createElement("div");
        empty.className = "tree-empty";
        empty.textContent = "Empty";
        tree.appendChild(empty);
        return;
      }
      rows.forEach((row) => tree.appendChild(make(row)));
    };
    addGroup("SNIPPETS", snippets);
    addGroup("NOTES", notes);
    $("sb-count").textContent = `${state.items.length} file${state.items.length === 1 ? "" : "s"}`;
  }

  async function saveCurrent(announce) {
    const item = currentDraft();
    await db.putItem(item);
    const idx = state.items.findIndex((i) => i.id === item.id);
    if (idx >= 0) state.items.splice(idx, 1, item);
    else state.items.unshift(item);
    state.items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    state.activeId = item.id;
    state.dirty = false;
    setSaveState("Saved " + new Date().toLocaleTimeString());
    $("title-file").textContent = fileNameFor(item);
    renderTree();
    refreshStorage();
    if (announce !== false) toast("Saved to this device");
    return item;
  }

  function newItem(kind) {
    const item = {
      id: uuid(),
      title: kind === "note" ? "new-note" : "new-snippet",
      kind: kind || "snippet",
      language: kind === "note" ? "md" : "js",
      tags: [],
      body: kind === "note" ? "" : "// Naija DevKit\n",
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    state.items.unshift(item);
    state.activeId = item.id;
    state.dirty = true;
    navigate("vault");
    loadItem(item);
    setSaveState("Unsaved");
    $("item-title").focus();
  }

  function navigate(route) {
    if (!ROUTES.includes(route)) route = "vault";
    state.route = route;
    document.querySelectorAll(".activity-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.route === route);
    });
    document.querySelectorAll(".view").forEach((view) => {
      const on = view.dataset.view === route;
      view.classList.toggle("is-active", on);
      if (on) view.removeAttribute("hidden");
      else view.setAttribute("hidden", "");
    });
    $("sb-route").textContent = route.toUpperCase();
    if (route !== "vault") $("title-file").textContent = route;
    if (route === "vault" && state.activeId) {
      const item = state.items.find((i) => i.id === state.activeId);
      if (item) $("title-file").textContent = fileNameFor(item);
    }
    try {
      history.replaceState({ route }, "", `#${route}`);
    } catch (_error) {}
    if (route === "backup") renderBackupStats();
    if (route === "settings") fillKeyFields();
  }

  function setExplorer(open) {
    $("explorer").classList.toggle("is-open", open);
    $("btn-explorer").setAttribute("aria-expanded", open ? "true" : "false");
  }

  function setOnline(online) {
    $("sb-net").textContent = online ? "ONLINE" : "OFFLINE";
    $("statusbar").classList.toggle("is-offline", !online);
  }

  async function refreshStorage() {
    let label = `${state.items.length} records`;
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        const used = est.usage || 0;
        const quota = est.quota || 0;
        label = `${formatBytes(used)} / ${formatBytes(quota)}`;
      }
    } catch (_error) {}
    $("sb-store").textContent = label;
    $("storage-detail").textContent = `Vault items: ${state.items.length}. Browser reports ${label}. Export often — Android may reclaim unused site data.`;
  }

  function formatBytes(n) {
    if (!n) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i += 1;
    }
    return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function renderBackupStats() {
    refreshStorage();
    $("backup-status").textContent = `Ready. ${state.items.length} vault item(s) will be included.`;
  }

  function fillKeyFields() {
    const keys = readKeys();
    $("key-openrouter").value = keys.openrouter || "";
    $("key-gemini").value = keys.gemini || "";
    $("keys-status").textContent = keys.openrouter || keys.gemini ? "Keys are stored only on this device." : "No keys saved.";
  }

  function copyText(value, ok) {
    const done = () => toast(ok || "Copied");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(done).catch(() => fallbackCopy(value, done));
    } else fallbackCopy(value, done);
  }

  function fallbackCopy(value, done) {
    const ta = document.createElement("textarea");
    ta.value = value;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (_e) {}
    ta.remove();
    done();
  }

  function jsonFix(input) {
    let text = input.replace(/^\uFEFF/, "").trim();
    text = text.replace(/,\s*([}\]])/g, "$1");
    text = text.replace(/'/g, '"');
    text = text.replace(/([{,]\s*)([A-Za-z_][\w-]*)\s*:/g, '$1"$2":');
    return text;
  }

  function runJson(mode) {
    const raw = $("json-input").value;
    const status = $("json-status");
    try {
      let text = raw;
      if (mode === "fix") text = jsonFix(raw);
      const parsed = JSON.parse(text);
      if (mode === "mini") $("json-input").value = JSON.stringify(parsed);
      else $("json-input").value = JSON.stringify(parsed, null, 2);
      status.textContent = "Valid JSON.";
      status.className = "status-line is-ok";
    } catch (error) {
      status.textContent = "Invalid JSON: " + error.message;
      status.className = "status-line is-bad";
    }
  }

  function runRegex() {
    const pattern = $("rx-pattern").value;
    const flags = $("rx-flags").value || "";
    const sample = $("rx-sample").value;
    const preview = $("rx-preview");
    const status = $("rx-status");
    if (!pattern) {
      preview.textContent = sample;
      status.textContent = "Enter a pattern.";
      status.className = "status-line";
      return;
    }
    let rx;
    try {
      rx = new RegExp(pattern, flags);
    } catch (error) {
      preview.textContent = sample;
      status.textContent = "Bad pattern: " + error.message;
      status.className = "status-line is-bad";
      return;
    }
    if (!flags.includes("g")) {
      const one = sample.match(rx);
      preview.textContent = sample;
      status.textContent = one ? `1 match: ${one[0]}` : "No matches.";
      status.className = "status-line " + (one ? "is-ok" : "");
      if (one && one.index >= 0) {
        const i = one.index;
        const j = i + one[0].length;
        preview.innerHTML = escapeHtml(sample.slice(0, i)) + '<mark class="rx-hit">' + escapeHtml(sample.slice(i, j)) + "</mark>" + escapeHtml(sample.slice(j));
      }
      return;
    }
    const matches = [];
    let m;
    const safe = sample;
    let last = 0;
    let html = "";
    let guard = 0;
    rx.lastIndex = 0;
    while ((m = rx.exec(safe)) !== null) {
      guard += 1;
      if (guard > 5000) break;
      if (m[0] === "") {
        rx.lastIndex += 1;
        continue;
      }
      html += escapeHtml(safe.slice(last, m.index));
      html += '<mark class="rx-hit">' + escapeHtml(m[0]) + "</mark>";
      last = m.index + m[0].length;
      matches.push(m[0]);
      if (!rx.global) break;
    }
    html += escapeHtml(safe.slice(last));
    preview.innerHTML = html || escapeHtml(sample);
    status.textContent = `${matches.length} match${matches.length === 1 ? "" : "es"}`;
    status.className = "status-line " + (matches.length ? "is-ok" : "");
  }

  function utf8ToB64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin);
  }

  function b64ToUtf8(str) {
    const clean = str.replace(/\s+/g, "");
    const bin = atob(clean);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function buildBackup(includeKeys) {
    const payload = {
      app: "naija-devkit",
      schema: 1,
      exportedAt: nowIso(),
      items: state.items
    };
    if (includeKeys) payload.keys = readKeys();
    return payload;
  }

  async function importBackup(data) {
    if (!data || data.app !== "naija-devkit") throw new Error("Not a Naija DevKit backup.");
    if (data.schema !== 1) throw new Error("Unsupported backup schema " + data.schema);
    const items = Array.isArray(data.items) ? data.items : [];
    const cleaned = items.map((item) => ({
      id: String(item.id || uuid()),
      title: String(item.title || "untitled").slice(0, 120),
      kind: item.kind === "note" ? "note" : "snippet",
      language: LANG_EXT[item.language] ? item.language : "txt",
      tags: Array.isArray(item.tags) ? item.tags.map((t) => String(t).toLowerCase()).slice(0, 12) : [],
      body: String(item.body || ""),
      createdAt: item.createdAt || nowIso(),
      updatedAt: item.updatedAt || nowIso()
    }));
    await db.replaceAll(cleaned);
    state.items = cleaned.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    if (data.keys && typeof data.keys === "object") {
      writeKeys({
        openrouter: String(data.keys.openrouter || ""),
        gemini: String(data.keys.gemini || "")
      });
    }
    state.activeId = state.items[0] ? state.items[0].id : null;
    loadItem(state.items[0] || null);
    renderTree();
    refreshStorage();
  }

  function registerSw() {
    if (!("serviceWorker" in navigator)) {
      $("sb-sw").textContent = "SW n/a";
      return;
    }
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).then((reg) => {
      $("sb-sw").textContent = "SW ready";
      if (reg.waiting) $("sb-sw").textContent = "SW update";
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            $("sb-sw").textContent = "SW update";
            toast("Update cached. Reload to apply.");
          }
        });
      });
    }).catch(() => {
      $("sb-sw").textContent = "SW failed";
    });
  }

  function bind() {
    document.querySelectorAll(".activity-btn").forEach((btn) => {
      btn.addEventListener("click", () => navigate(btn.dataset.route));
    });
    $("btn-explorer").addEventListener("click", () => {
      setExplorer(!$("explorer").classList.contains("is-open"));
    });
    $("btn-command").addEventListener("click", () => newItem("snippet"));
    $("btn-new-item").addEventListener("click", () => newItem("snippet"));
    $("btn-empty-new").addEventListener("click", () => newItem("snippet"));
    $("search-box").addEventListener("input", renderTree);

    ["item-title", "item-kind", "item-lang", "item-tags", "item-body"].forEach((id) => {
      $(id).addEventListener("input", () => {
        state.dirty = true;
        setSaveState("Unsaved");
        if (id === "item-body" || id === "item-lang") renderHighlight();
        if (id === "item-title" || id === "item-lang") $("title-file").textContent = fileNameFor(currentDraft());
        clearTimeout(state.persistTimer);
        state.persistTimer = setTimeout(() => saveCurrent(false).catch((err) => toast(err.message)), 500);
      });
    });
    $("item-body").addEventListener("scroll", syncScroll);
    $("btn-save-item").addEventListener("click", () => saveCurrent(true).catch((err) => toast(err.message)));
    $("btn-copy-item").addEventListener("click", () => copyText($("item-body").value, "Snippet copied"));
    $("btn-download-item").addEventListener("click", async () => {
      const item = await saveCurrent(false);
      downloadText(fileNameFor(item), item.body, MIME[item.language] || "text/plain");
      toast("Download started");
    });
    $("btn-delete-item").addEventListener("click", async () => {
      if (!state.activeId) return;
      if (!confirm("Delete this item from the vault?")) return;
      await db.deleteItem(state.activeId);
      state.items = state.items.filter((i) => i.id !== state.activeId);
      state.activeId = state.items[0] ? state.items[0].id : null;
      loadItem(state.items[0] || null);
      renderTree();
      refreshStorage();
      toast("Deleted");
    });

    $("btn-json-pretty").addEventListener("click", () => runJson("pretty"));
    $("btn-json-mini").addEventListener("click", () => runJson("mini"));
    $("btn-json-fix").addEventListener("click", () => runJson("fix"));
    $("btn-json-copy").addEventListener("click", () => copyText($("json-input").value, "JSON copied"));
    $("btn-json-download").addEventListener("click", () => {
      downloadText("naija-devkit.json", $("json-input").value, "application/json");
    });

    ["rx-pattern", "rx-flags", "rx-sample"].forEach((id) => $(id).addEventListener("input", runRegex));
    $("btn-uuid").addEventListener("click", () => { $("uuid-out").value = uuid(); });
    $("btn-copy-uuid").addEventListener("click", () => copyText($("uuid-out").value, "UUID copied"));
    $("btn-b64-enc").addEventListener("click", () => {
      try { $("b64-out").value = utf8ToB64($("b64-in").value); }
      catch (error) { $("b64-out").value = "Encode failed: " + error.message; }
    });
    $("btn-b64-dec").addEventListener("click", () => {
      try { $("b64-out").value = b64ToUtf8($("b64-in").value); }
      catch (error) { $("b64-out").value = "Decode failed: " + error.message; }
    });
    $("btn-b64-copy").addEventListener("click", () => copyText($("b64-out").value, "Result copied"));

    $("btn-export").addEventListener("click", () => {
      const payload = buildBackup($("include-keys").checked);
      downloadText("naija-devkit-backup.json", JSON.stringify(payload, null, 2), "application/json");
      $("backup-status").textContent = "Backup downloaded.";
      $("backup-status").className = "status-line is-ok";
    });
    $("btn-import").addEventListener("click", () => $("import-file").click());
    $("import-file").addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      event.target.value = "";
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        await importBackup(data);
        $("backup-status").textContent = "Import complete.";
        $("backup-status").className = "status-line is-ok";
        toast("Backup imported");
      } catch (error) {
        $("backup-status").textContent = error.message;
        $("backup-status").className = "status-line is-bad";
      }
    });
    $("btn-wipe").addEventListener("click", async () => {
      if (!confirm("Delete every snippet and note on this device?")) return;
      await db.wipe();
      state.items = [];
      state.activeId = null;
      loadItem(null);
      renderTree();
      refreshStorage();
      toast("Vault cleared");
    });

    $("btn-save-keys").addEventListener("click", () => {
      writeKeys({
        openrouter: $("key-openrouter").value.trim(),
        gemini: $("key-gemini").value.trim()
      });
      $("keys-status").textContent = "Keys saved in localStorage on this phone.";
      $("keys-status").className = "status-line is-ok";
    });
    $("btn-clear-keys").addEventListener("click", () => {
      localStorage.removeItem(KEY_STORE);
      $("key-openrouter").value = "";
      $("key-gemini").value = "";
      $("keys-status").textContent = "Keys removed from this device.";
    });
    $("btn-copy-openrouter").addEventListener("click", () => {
      const key = readKeys().openrouter || "YOUR_OPENROUTER_KEY";
      copyText(`fetch("https://openrouter.ai/api/v1/chat/completions", {\n  method: "POST",\n  headers: {\n    "Authorization": "Bearer ${key}",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({ model: "openrouter/auto", messages: [{ role: "user", content: "Hello from Naija DevKit" }] })\n});`, "OpenRouter snippet copied");
    });
    $("btn-copy-gemini").addEventListener("click", () => {
      const key = readKeys().gemini || "YOUR_GEMINI_KEY";
      copyText(`fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ contents: [{ parts: [{ text: "Hello from Naija DevKit" }] }] })\n});`, "Gemini snippet copied");
    });
    $("pref-wrap").addEventListener("change", () => {
      const prefs = readPrefs();
      prefs.wrap = $("pref-wrap").checked;
      writePrefs(prefs);
      applyPrefs();
    });
    $("pref-font").addEventListener("change", () => {
      const prefs = readPrefs();
      prefs.font = $("pref-font").value;
      writePrefs(prefs);
      applyPrefs();
    });

    window.addEventListener("online", () => setOnline(true));
    window.addEventListener("offline", () => setOnline(false));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && state.dirty) {
        saveCurrent(false).catch(() => {});
      }
    });
    window.addEventListener("pagehide", () => {
      if (state.dirty) saveCurrent(false).catch(() => {});
    });
    window.addEventListener("hashchange", () => {
      const route = location.hash.replace("#", "");
      if (ROUTES.includes(route)) navigate(route);
    });
    window.addEventListener("popstate", () => {
      const route = location.hash.replace("#", "");
      if (ROUTES.includes(route)) navigate(route);
    });
  }

  async function boot() {
    bind();
    applyPrefs();
    setOnline(navigator.onLine);
    registerSw();
    try {
      state.items = await db.allItems();
    } catch (_error) {
      state.items = [];
      toast("IndexedDB unavailable; vault will not persist.");
    }
    renderTree();
    if (state.items.length) loadItem(state.items[0]);
    else loadItem(null);
    const initial = location.hash.replace("#", "");
    navigate(ROUTES.includes(initial) ? initial : "vault");
    $("uuid-out").value = uuid();
    refreshStorage();
    if (window.matchMedia("(min-width: 880px)").matches) setExplorer(true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
