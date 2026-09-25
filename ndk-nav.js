"use strict";
(function () {
  const innerGo = go;
  go = function (id, extra, fromPop) {
    if (id === "lab") id = "toolbox";
    if (id === "ide") id = "editor";
    const prev = state.session.mode;
    innerGo(id, extra);
    if (fromPop) return;
    const payload = { page: state.session.mode, extra: extra || null };
    const hash = extra && payload.page === "tool" ? "#tool/" + extra : "#" + payload.page;
    if (state.booting) history.replaceState(payload, "", hash);
    else if (!history.state || history.state.page !== payload.page || history.state.extra !== payload.extra) {
      history.pushState(payload, "", hash);
      if (prev && prev !== payload.page) buzz(8);
    }
  };
  async function backPlace() {
    if (state.session.mode === "editor" || state.session.mode === "preview") await flushEditor();
    if (history.state && history.state.page && history.length > 1) history.back();
    else innerGo(state.lastHub || "home");
  }
  window.backPlace = backPlace;
  document.addEventListener("DOMContentLoaded", () => {
    const bind = (id) => { const el = $(id); if (el) el.onclick = () => backPlace(); };
    ["ed-back", "pv-back", "search-back", "ai-back", "tool-back"].forEach(bind);
    window.addEventListener("popstate", (ev) => {
      const st = ev.state || {};
      let id = st.page;
      let extra = st.extra || null;
      if (!id) {
        const raw = String(location.hash || "#home").replace(/^#/, "");
        const parts = raw.split("/");
        id = parts[0] || "home";
        extra = parts[1] || null;
      }
      if (!PAGES.includes(id) && id !== "toolbox") id = "home";
      go(id, extra, true);
    });
  });
})();
