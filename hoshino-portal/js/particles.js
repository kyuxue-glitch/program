/* ══════════════════════════════════════════════════════════════════
   particles.js —— 原创 Canvas 特效
   · 星空：视差漂移 + 闪烁 + 偶发流星
   · 花瓣：随风飘落的樱花
   · 序章：粒子汇聚成星座，再回到星海
   ══════════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  const reduceMotion = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function fit(canvas, ctx) {
    const dpr = Math.min(global.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width || canvas.clientWidth || 800);
    const h = Math.max(1, rect.height || canvas.clientHeight || 600);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: w, h: h };
  }

  /* ── 星空 ─────────────────────────────────────── */
  function createStars(canvas) {
    const ctx = canvas.getContext("2d");
    let size = { w: 0, h: 0 };
    let stars = [];
    let shooting = [];
    let raf = 0;
    let t = 0;
    let running = false;
    let pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    const PALETTE = ["#ffffff", "#d8e6ff", "#ffd9ec", "#c9f4ff", "#e6dcff"];

    function build() {
      size = fit(canvas, ctx);
      const count = Math.round(Math.min(260, (size.w * size.h) / 6200));
      stars = [];
      for (let i = 0; i < count; i += 1) {
        const depth = Math.random();
        stars.push({
          x: Math.random() * size.w,
          y: Math.random() * size.h,
          r: 0.4 + depth * 1.5,
          depth: depth,
          color: PALETTE[(Math.random() * PALETTE.length) | 0],
          phase: Math.random() * Math.PI * 2,
          speed: 0.02 + Math.random() * 0.06,
          vy: 0.02 + depth * 0.12
        });
      }
    }

    function loop() {
      if (!running) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
      t += 1;
      ctx.clearRect(0, 0, size.w, size.h);

      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;

      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        const tw = 0.42 + 0.58 * Math.abs(Math.sin(s.phase + t * s.speed));
        const px = s.x + pointer.x * (6 + s.depth * 26);
        const py = s.y + pointer.y * (6 + s.depth * 26);
        ctx.globalAlpha = tw * (0.35 + s.depth * 0.65);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fill();

        if (!reduceMotion) {
          s.y -= s.vy;
          if (s.y < -4) {
            s.y = size.h + 4;
            s.x = Math.random() * size.w;
          }
        }
      }

      // 流星
      if (!reduceMotion && Math.random() < 0.0035 && shooting.length < 2) {
        shooting.push({
          x: Math.random() * size.w * 0.9,
          y: Math.random() * size.h * 0.4,
          len: 90 + Math.random() * 140,
          life: 1,
          speed: 6 + Math.random() * 5
        });
      }
      for (let i = shooting.length - 1; i >= 0; i -= 1) {
        const m = shooting[i];
        ctx.globalAlpha = m.life * 0.75;
        const g = ctx.createLinearGradient(m.x, m.y, m.x - m.len, m.y + m.len * 0.55);
        g.addColorStop(0, "rgba(255,255,255,0.95)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - m.len, m.y + m.len * 0.55);
        ctx.stroke();
        m.x += m.speed;
        m.y += m.speed * 0.55;
        m.life -= 0.012;
        if (m.life <= 0) shooting.splice(i, 1);
      }
      ctx.globalAlpha = 1;
    }

    function onMove(e) {
      const x = (e.clientX / global.innerWidth) * 2 - 1;
      const y = (e.clientY / global.innerHeight) * 2 - 1;
      pointer.tx = -x;
      pointer.ty = -y;
    }

    function start() {
      running = true;
      if (!raf) loop();
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
    }

    build();
    global.addEventListener("resize", build, { passive: true });
    global.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (running && !raf) {
        loop();
      }
    });
    return {
      start: start,
      stop: stop,
      rebuild: build,
      canvas: canvas
    };
  }

  /* ── 花瓣 ─────────────────────────────────────── */
  function createPetals(canvas) {
    const ctx = canvas.getContext("2d");
    let size = { w: 0, h: 0 };
    let list = [];
    let raf = 0;
    let running = false;
    let enabled = !reduceMotion;

    function make() {
      return {
        x: Math.random() * size.w,
        y: Math.random() * size.h,
        r: 3 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.02,
        vy: 0.25 + Math.random() * 0.65,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 0.008 + Math.random() * 0.014,
        alpha: 0.25 + Math.random() * 0.45,
        hue: Math.random() < 0.5 ? "255,180,214" : "255,222,238"
      };
    }

    function build() {
      size = fit(canvas, ctx);
      const count = Math.round(Math.min(70, (size.w * size.h) / 26000));
      list = [];
      for (let i = 0; i < count; i += 1) list.push(make());
    }

    function loop() {
      if (!running || !enabled) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
      ctx.clearRect(0, 0, size.w, size.h);
      for (let i = 0; i < list.length; i += 1) {
        const p = list[i];
        p.sway += p.swaySpeed;
        p.x += Math.sin(p.sway) * 0.7;
        p.y += p.vy;
        p.rot += p.spin;
        if (p.y > size.h + 20) {
          list[i] = make();
          list[i].y = -20;
          continue;
        }
        if (p.x < -30) p.x = size.w + 20;
        if (p.x > size.w + 30) p.x = -20;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = "rgba(" + p.hue + ",1)";
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r, p.r * 0.58, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    function start() {
      running = true;
      if (!raf && enabled) loop();
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
    }

    build();
    global.addEventListener("resize", build, { passive: true });
    return {
      start: start,
      stop: stop,
      setEnabled: function (v) {
        enabled = !!v && !reduceMotion;
        if (!enabled) {
          cancelAnimationFrame(raf);
          raf = 0;
          ctx.clearRect(0, 0, size.w, size.h);
        } else if (running && !raf) {
          loop();
        }
      }
    };
  }

  /* ── 序章：粒子汇聚成星座 ─────────────────────── */
  function createPrologue(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext("2d");
    const statusEl = opts.status;
    let size = { w: 0, h: 0 };
    let parts = [];
    let links = [];
    let raf = 0;
    let t = 0;
    let running = true;
    let gather = 0;
    let pointer = { x: 0, y: 0 };
    const statuses = ["正在点亮星图…", "星海已在此等候", "轻触星光，开启此间物语"];

    // 目标形状：一颗大星 + 两圈星轨
    function targets(count) {
      const out = [];
      const cx = size.w / 2;
      const cy = size.h * 0.46;
      const scale = Math.min(size.w, size.h) * 0.3;
      const starPts = 12;
      for (let i = 0; i < count; i += 1) {
        const mode = i % 10;
        let x;
        let y;
        if (mode < 4) {
          // 五角星轮廓
          const k = (i % 5) / 5;
          const a = -Math.PI / 2 + k * Math.PI * 2;
          const rad = (i % 2 === 0 ? 1 : 0.44) * scale;
          x = cx + Math.cos(a) * rad;
          y = cy + Math.sin(a) * rad;
        } else if (mode < 7) {
          const a = (i / 10) * Math.PI * 2 + t * 0.004;
          const rad = scale * (1.35 + (i % 3) * 0.16);
          x = cx + Math.cos(a) * rad * 1.25;
          y = cy + Math.sin(a) * rad * 0.75;
        } else {
          const a = (i / 10) * Math.PI * 2 - t * 0.003;
          const rad = scale * (1.85 + (i % 4) * 0.12);
          x = cx + Math.cos(a) * rad * 1.1;
          y = cy + Math.sin(a) * rad * 0.62;
        }
        out.push({ x: x, y: y });
      }
      links = [];
      for (let i = 0; i < starPts; i += 1) {
        links.push([out[i % out.length], out[(i + 1) % starPts]]);
      }
      return out;
    }

    function build() {
      size = fit(canvas, ctx);
      const count = Math.round(Math.min(190, (size.w * size.h) / 9000));
      const tg = targets(count);
      parts = [];
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const rad = Math.random() * Math.max(size.w, size.h) * 0.7;
        parts.push({
          x: size.w / 2 + Math.cos(a) * rad,
          y: size.h / 2 + Math.sin(a) * rad,
          tx: tg[i] ? tg[i].x : Math.random() * size.w,
          ty: tg[i] ? tg[i].y : Math.random() * size.h,
          vx: 0,
          vy: 0,
          r: 0.6 + Math.random() * 1.9,
          alpha: 0.35 + Math.random() * 0.65,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    function loop() {
      if (!running) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
      t += 1;
      gather = Math.min(1, gather + 0.006);

      ctx.clearRect(0, 0, size.w, size.h);
      const ease = 1 - Math.pow(1 - gather, 3);

      // 视差
      const px = (pointer.x - size.w / 2) * 0.02;
      const py = (pointer.y - size.h / 2) * 0.02;

      // 星轨连线
      ctx.lineWidth = 0.7;
      for (let i = 0; i < links.length; i += 1) {
        const a = links[i][0];
        const b = links[i][1];
        const ax = a.x * ease + px;
        const ay = a.y * ease + py;
        const bx = b.x * ease + px;
        const by = b.y * ease + py;
        ctx.strokeStyle = "rgba(180,200,255," + (0.22 * ease).toFixed(3) + ")";
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }

      for (let i = 0; i < parts.length; i += 1) {
        const p = parts[i];
        p.vx += (p.tx - p.x) * 0.0016 * (0.4 + ease);
        p.vy += (p.ty - p.y) * 0.0016 * (0.4 + ease);
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.x += p.vx;
        p.y += p.vy;

        // 汇聚后轻微呼吸
        const breathe = gather > 0.98 ? Math.sin(t * 0.02 + p.phase) * 2.4 : 0;
        const dx = Math.cos(p.phase + t * 0.004) * breathe;
        const dy = Math.sin(p.phase + t * 0.005) * breathe;

        const tw = 0.6 + 0.4 * Math.abs(Math.sin(p.phase + t * 0.03));
        ctx.globalAlpha = p.alpha * tw;
        ctx.fillStyle = i % 7 === 0 ? "#ffe6a8" : i % 5 === 0 ? "#ffc0dd" : "#dce8ff";
        ctx.beginPath();
        ctx.arc(p.x + dx + px, p.y + dy + py, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function onMove(e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    }
    function onDown(e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      gather = Math.max(gather, 0.35);
    }

    build();
    global.addEventListener("resize", build, { passive: true });
    global.addEventListener("pointermove", onMove, { passive: true });
    global.addEventListener("pointerdown", onDown, { passive: true });

    if (statusEl) {
      let i = 0;
      const timer = setInterval(function () {
        i += 1;
        if (i >= statuses.length) {
          clearInterval(timer);
          return;
        }
        statusEl.textContent = statuses[i];
      }, 1400);
    }

    loop();

    return {
      stop: function () {
        running = false;
        cancelAnimationFrame(raf);
      },
      rush: function () {
        gather = Math.max(gather, 0.6);
      }
    };
  }

  global.HS = global.HS || {};
  global.HS.fx = {
    stars: createStars,
    petals: createPetals,
    prologue: createPrologue,
    reduceMotion: reduceMotion
  };
})(window);
