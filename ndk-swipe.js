"use strict";

(function () {
  const ORDER = ["home", "workspace", "toolbox", "settings"];
  const IGNORE = "input, textarea, select, .dock, .filters, .ws-boxes, .sheet, .actions, .drawer";
  const SNAP = 0.35;
  const LOCK = 14;
  const MS = 220;

  let gest = null;
  let busy = false;

  function w() { return window.innerWidth || 360; }
  function pageEl(id) { return document.getElementById(id); }
  function idx() { return ORDER.indexOf(state.session.mode); }
  function beside(dx) {
    const i = idx();
    if (dx < 0) return ORDER[i + 1] || null;
    if (dx > 0) return ORDER[i - 1] || null;
    return null;
  }
  function live(el, on) {
    if (!el) return;
    el.classList.toggle("swipe-live", on);
    if (on) el.hidden = false;
  }
  function setX(el, x, anim) {
    if (!el) return;
    el.style.transition = anim ? "transform " + MS + "ms ease-out" : "none";
    el.style.transform = "translate3d(" + x + "px,0,0)";
  }
  function wipe() {
    ORDER.forEach((id) => {
      const el = pageEl(id);
      if (!el) return;
      el.style.transition = "";
      el.style.transform = "";
      el.classList.remove("swipe-live");
    });
    document.body.classList.remove("swiping");
  }
  function paint(dx) {
    const cur = pageEl(state.session.mode);
    const next = beside(dx);
    ORDER.forEach((id) => live(pageEl(id), id === state.session.mode || id === next));
    setX(cur, dx, false);
    if (next) setX(pageEl(next), dx + (dx < 0 ? w() : -w()), false);
  }
  function start(ev) {
    if (busy || gest) return;
    if (!ORDER.includes(state.session.mode)) return;
    if (ev.touches.length !== 1) return;
    if (ev.target.closest(IGNORE)) return;
    const t = ev.touches[0];
    gest = { x: t.clientX, y: t.clientY, dx: 0, locked: false, from: state.session.mode };
  }
  function move(ev) {
    if (!gest) return;
    const t = ev.touches[0];
    const dx = t.clientX - gest.x;
    const dy = t.clientY - gest.y;
    if (!gest.locked) {
      if (Math.abs(dy) > LOCK && Math.abs(dy) >= Math.abs(dx)) { gest = null; return; }
      if (Math.abs(dx) < LOCK) return;
      gest.locked = true;
      document.body.classList.add("swiping");
    }
    ev.preventDefault();
    const i = idx();
    let x = dx;
    if ((i <= 0 && dx > 0) || (i >= ORDER.length - 1 && dx < 0)) x = dx * 0.28;
    gest.dx = x;
    paint(x);
  }
  function finish() {
    if (!gest) return;
    const g = gest;
    gest = null;
    if (!g.locked) return;
    const next = beside(g.dx);
    const cur = pageEl(g.from);
    const width = w();
    const pass = next && Math.abs(g.dx) > width * SNAP;
    busy = true;
    if (pass) {
      setX(cur, g.dx < 0 ? -width : width, true);
      setX(pageEl(next), 0, true);
      buzz(8);
      setTimeout(() => { wipe(); go(next); busy = false; }, MS + 16);
      return;
    }
    setX(cur, 0, true);
    if (next) setX(pageEl(next), g.dx < 0 ? width : -width, true);
    setTimeout(() => { wipe(); busy = false; }, MS + 16);
  }
  function cancel() {
    if (!gest) return;
    if (gest.locked) {
      const next = beside(gest.dx);
      setX(pageEl(gest.from), 0, true);
      if (next) setX(pageEl(next), gest.dx < 0 ? w() : -w(), true);
      busy = true;
      setTimeout(() => { wipe(); busy = false; }, MS + 16);
    }
    gest = null;
  }

  document.addEventListener("touchstart", start, { passive: true });
  document.addEventListener("touchmove", move, { passive: false });
  document.addEventListener("touchend", finish, { passive: true });
  document.addEventListener("touchcancel", cancel, { passive: true });
})();
