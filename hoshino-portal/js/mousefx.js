/* ══════════════════════════════════════════════════════════════════
   mousefx.js —— 鼠标/指针动效
   · 光标星屑拖尾 + 柔光
   · 背景视差（--px / --py）
   · 卡片聚光与轻微 3D 倾斜
   只在「精确指针」（鼠标）设备上启用，触摸设备自动跳过。
   ══════════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  const fine = global.matchMedia && global.matchMedia("(pointer: fine)").matches;
  const reduce = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let w = 0;
  let h = 0;
  let raf = 0;
  let enabled = false;
  let ready = false;
  const parts = [];
  const ptr = { x: -999, y: -999, sx: -999, sy: -999, has: false };
  const COLORS = ["#9fe6ff", "#c9b6ff", "#ffc0dd", "#ffe6a8", "#ffffff"];

  function settings() {
    try { return global.HS.store.settings; } catch (e) { return { motion: true, fx: true }; }
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(global.devicePixelRatio || 1, 2);
    w = global.innerWidth;
    h = global.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawn(x, y, n) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = Math.random() * 0.7 + 0.1;
      parts.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.15,
        life: 1,
        decay: 0.016 + Math.random() * 0.02,
        r: 0.8 + Math.random() * 2.1,
        color: COLORS[(Math.random() * COLORS.length) | 0]
      });
      if (parts.length > 220) parts.shift();
    }
  }

  function loop() {
    if (!enabled) { raf = 0; return; }
    raf = requestAnimationFrame(loop);
    ptr.sx += (ptr.x - ptr.sx) * 0.22;
    ptr.sy += (ptr.y - ptr.sy) * 0.22;

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    // 柔光
    if (ptr.has) {
      const g = ctx.createRadialGradient(ptr.sx, ptr.sy, 0, ptr.sx, ptr.sy, 150);
      g.addColorStop(0, "rgba(150,180,255,0.16)");
      g.addColorStop(0.5, "rgba(139,123,247,0.07)");
      g.addColorStop(1, "rgba(139,123,247,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ptr.sx, ptr.sy, 150, 0, Math.PI * 2);
      ctx.fill();
    }

    // 星屑
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const p = parts[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.97;
      p.vy = p.vy * 0.97 + 0.006;
      p.life -= p.decay;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      ctx.globalAlpha = p.life * 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /* ── 视差与卡片 ───────────────────────────────── */
  let lastX = 0, lastY = 0, moved = false;

  function onMove(e) {
    ptr.x = e.clientX;
    ptr.y = e.clientY;
    if (!ptr.has) { ptr.sx = e.clientX; ptr.sy = e.clientY; ptr.has = true; }

    if (enabled) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (dx * dx + dy * dy > 40) {
        spawn(e.clientX, e.clientY, 2);
        lastX = e.clientX;
        lastY = e.clientY;
      }
    }

    if (!moved) {
      moved = true;
      requestAnimationFrame(applyParallax);
    }
  }

  function applyParallax() {
    moved = false;
    if (!settings().motion) return;
    const px = (ptr.x / global.innerWidth) * 2 - 1;
    const py = (ptr.y / global.innerHeight) * 2 - 1;
    const root = document.documentElement;
    root.style.setProperty("--px", px.toFixed(3));
    root.style.setProperty("--py", py.toFixed(3));
  }

  function bindCards() {
    document.addEventListener("pointermove", function (e) {
      const card = e.target.closest(".card, .shot, .stat, .palette__item, .track");
      if (!card || !settings().motion) return;
      const r = card.getBoundingClientRect();
      const mx = ((e.clientX - r.left) / r.width) * 100;
      const my = ((e.clientY - r.top) / r.height) * 100;
      const rx = ((my - 50) / 50) * -3.2;
      const ry = ((mx - 50) / 50) * 3.6;
      card.style.setProperty("--mx", mx.toFixed(1) + "%");
      card.style.setProperty("--my", my.toFixed(1) + "%");
      if (card.classList.contains("card") || card.classList.contains("shot")) {
        card.style.transform = "perspective(900px) translateY(-5px) rotateX(" + rx.toFixed(2) +
          "deg) rotateY(" + ry.toFixed(2) + "deg)";
      }
    }, { passive: true });

    document.addEventListener("pointerout", function (e) {
      const card = e.target.closest(".card, .shot");
      if (card && !card.contains(e.relatedTarget)) card.style.transform = "";
    }, { passive: true });
  }

  function start() {
    if (enabled || !fine || reduce) return;
    if (!settings().fx || !settings().motion) return;
    if (!ready) build();
    enabled = true;
    canvas.style.display = "block";
    if (!raf) loop();
  }

  function stop() {
    enabled = false;
    cancelAnimationFrame(raf);
    raf = 0;
    parts.length = 0;
    if (canvas) {
      ctx.clearRect(0, 0, w, h);
      canvas.style.display = "none";
    }
    document.documentElement.style.removeProperty("--px");
    document.documentElement.style.removeProperty("--py");
  }

  function build() {
    canvas = document.createElement("canvas");
    canvas.className = "fx__cursor";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    resize();
    global.addEventListener("resize", resize, { passive: true });
    global.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", function () { ptr.has = false; }, { passive: true });
    bindCards();
    ready = true;
  }

  function init() {
    if (!fine || reduce) return;
    if (!settings().fx || !settings().motion) return;
    start();
  }

  /* 点击时的星屑爆开（供按钮等调用） */
  function burst(x, y, n) {
    if (!ready || !enabled) return;
    spawn(x, y, n || 18);
  }

  global.HS = global.HS || {};
  global.HS.mousefx = {
    init: init,
    start: start,
    stop: stop,
    burst: burst,
    supported: fine && !reduce
  };
})(window);
