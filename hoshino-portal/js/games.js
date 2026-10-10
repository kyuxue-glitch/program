/* ══════════════════════════════════════════════════════════════════
   games.js —— 星之轨迹小游戏（按需加载）
   4 个小游戏：星屑接接乐 / 记忆星图 / 弹幕躲避 / 星轨节拍
   全部支持鼠标、触摸与键盘，最高分存在本地。
   ══════════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  const HS = global.HS;

  const LIST = [
    { id: "catch", name: "星屑接接乐", icon: "✦", tag: "反应", desc: "用星篮接住落下的星屑，别碰到陨石。" },
    { id: "memory", name: "记忆星图", icon: "◈", tag: "记忆", desc: "翻开卡片，把同一片星图配成一对。" },
    { id: "dodge", name: "弹幕躲避", icon: "✧", tag: "生存", desc: "在流星雨中坚持 30 秒。" },
    { id: "rhythm", name: "星轨节拍", icon: "♫", tag: "节奏", desc: "在光点落到轨道线时按下。" }
  ];

  /* ── 通用工具 ─────────────────────────────────── */
  function scoreboard() {
    const store = HS.store;
    store.data.games = store.data.games || {};
    return store.data.games;
  }

  function saveBest(id, score) {
    const all = scoreboard();
    const rec = all[id] || { best: 0, plays: 0 };
    rec.plays += 1;
    const isBest = score > rec.best;
    if (isBest) rec.best = score;
    all[id] = rec;
    HS.store.save(true);
    return isBest;
  }

  function best(id) {
    const rec = scoreboard()[id];
    return rec ? rec.best : 0;
  }

  function makeStage(host, aspect) {
    host.innerHTML = "";
    host.classList.add("game-stage");
    const canvas = document.createElement("canvas");
    const hud = document.createElement("div");
    hud.className = "game-hud";
    const overlay = document.createElement("div");
    overlay.className = "game-overlay";
    host.appendChild(canvas);
    host.appendChild(hud);
    host.appendChild(overlay);
    const ctx = canvas.getContext("2d");
    const state = { w: 0, h: 0, dpr: 1 };

    function resize() {
      const rect = host.getBoundingClientRect();
      state.dpr = Math.min(global.devicePixelRatio || 1, 2);
      state.w = Math.max(280, rect.width);
      state.h = Math.round(state.w / (aspect || 1.7));
      state.h = Math.min(state.h, Math.round(global.innerHeight * 0.62));
      canvas.style.height = state.h + "px";
      canvas.width = Math.floor(state.w * state.dpr);
      canvas.height = Math.floor(state.h * state.dpr);
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    }
    resize();
    global.addEventListener("resize", resize, { passive: true });

    return {
      canvas: canvas, ctx: ctx, hud: hud, overlay: overlay,
      get w() { return state.w; },
      get h() { return state.h; },
      resize: resize,
      destroy() { global.removeEventListener("resize", resize); }
    };
  }

  function setHud(hud, items) {
    const sig = items.map(function (it) { return it[0] + ":" + it[1]; }).join("|");
    if (hud.dataset.sig === sig) return;
    hud.dataset.sig = sig;
    hud.innerHTML = items.map(function (it) {
      return '<span class="game-hud__item"><i>' + it[0] + "</i><b>" + it[1] + "</b></span>";
    }).join("");
  }

  function showOverlay(overlay, html) {
    overlay.innerHTML = '<div class="game-overlay__card">' + html + "</div>";
    overlay.classList.add("is-on");
  }

  function hideOverlay(overlay) {
    overlay.classList.remove("is-on");
    overlay.innerHTML = "";
  }

  function loopRunner(fn) {
    let raf = 0;
    let last = 0;
    let running = false;
    function frame(t) {
      if (!running) { raf = 0; return; }
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
      last = t;
      fn(dt);
    }
    return {
      start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
      stop() { running = false; cancelAnimationFrame(raf); raf = 0; },
      get running() { return running; }
    };
  }

  function star(ctx, x, y, r, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const rad = i % 2 === 0 ? r : r * 0.44;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = x + Math.cos(a) * rad;
      const py = y + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function bg(ctx, w, h, t) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0b1230");
    g.addColorStop(0.6, "#151d46");
    g.addColorStop(1, "#0a1028");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 46; i += 1) {
      const x = ((i * 97) % w);
      const y = ((i * 61 + t * 8 * (1 + (i % 3))) % h);
      ctx.fillStyle = i % 5 === 0 ? "#ffd9ec" : "#cfe0ff";
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.restore();
  }

  /* ══════════════ 1. 星屑接接乐 ══════════════ */
  function catchGame(host) {
    const st = makeStage(host, 1.75);
    const runner = loopRunner(update);
    let basket = st.w / 2;
    let target = st.w / 2;
    let items = [];
    let score = 0;
    let combo = 0;
    let lives = 3;
    let time = 0;
    let spawnT = 0;
    let over = false;
    let keys = { l: false, r: false };

    function reset() {
      basket = st.w / 2; target = st.w / 2;
      items = []; score = 0; combo = 0; lives = 3; time = 0; spawnT = 0; over = false;
      hideOverlay(st.overlay);
      runner.start();
    }

    function spawn() {
      const kind = Math.random() < 0.16 ? "bomb" : Math.random() < 0.12 ? "gold" : "star";
      items.push({
        x: 30 + Math.random() * (st.w - 60),
        y: -20,
        vy: 120 + Math.random() * 130 + time * 2.6,
        r: kind === "bomb" ? 15 : kind === "gold" ? 13 : 11,
        kind: kind,
        rot: Math.random() * 6
      });
    }

    function update(dt) {
      if (over) return;
      time += dt;
      if (keys.l) target -= 420 * dt;
      if (keys.r) target += 420 * dt;
      target = Math.max(34, Math.min(st.w - 34, target));
      basket += (target - basket) * Math.min(1, dt * 12);

      spawnT -= dt;
      if (spawnT <= 0) { spawn(); spawnT = Math.max(0.26, 0.78 - time * 0.012); }

      bg(st.ctx, st.w, st.h, time);

      // 星篮
      const ctx = st.ctx;
      ctx.save();
      ctx.translate(basket, st.h - 42);
      ctx.fillStyle = "rgba(139,123,247,0.9)";
      ctx.beginPath();
      ctx.moveTo(-42, -14);
      ctx.lineTo(42, -14);
      ctx.lineTo(30, 16);
      ctx.lineTo(-30, 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(-42, -14, 84, 5);
      ctx.restore();

      for (let i = items.length - 1; i >= 0; i -= 1) {
        const it = items[i];
        it.y += it.vy * dt;
        it.rot += dt * 2;
        if (it.kind === "bomb") {
          ctx.save();
          ctx.translate(it.x, it.y);
          ctx.rotate(it.rot);
          ctx.fillStyle = "#4a4470";
          ctx.beginPath();
          ctx.arc(0, 0, it.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ff8a8a";
          ctx.beginPath();
          ctx.arc(0, 0, it.r * 0.45, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(255,180,180,.55)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, it.r + 3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else {
          star(ctx, it.x, it.y, it.r, it.kind === "gold" ? "#ffe08a" : "#bfe6ff", 0.95);
        }

        // 判定
        if (it.y > st.h - 62 && Math.abs(it.x - basket) < 54) {
          if (it.kind === "bomb") {
            lives -= 1;
            combo = 0;
            if (lives <= 0) return end();
          } else {
            combo += 1;
            score += (it.kind === "gold" ? 8 : 2) + Math.floor(combo / 5);
          }
          items.splice(i, 1);
          continue;
        }
        if (it.y > st.h + 20) {
          if (it.kind !== "bomb") combo = 0;
          items.splice(i, 1);
        }
      }

      setHud(st.hud, [["分数", score], ["连击", combo], ["生命", "✦".repeat(Math.max(0, lives))], ["最高", Math.max(best("catch"), score)]]);
    }

    function end() {
      over = true;
      runner.stop();
      const isBest = saveBest("catch", score);
      showOverlay(st.overlay,
        "<h3>星屑收集完毕</h3><p>本局得分 <b>" + score + "</b> · 最高连击 " + combo + " 次</p>" +
        (isBest ? '<p class="game-new">✦ 新纪录！</p>' : "") +
        '<button class="btn btn--primary" data-game="restart">再来一局</button>');
    }

    const onMove = function (e) {
      const r = st.canvas.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      target = Math.max(34, Math.min(st.w - 34, x * (st.w / r.width)));
    };
    st.canvas.addEventListener("pointermove", onMove, { passive: true });
    st.canvas.addEventListener("touchmove", function (e) { e.preventDefault(); onMove(e); }, { passive: false });

    const onKey = function (e) {
      if (e.key === "ArrowLeft" || e.key === "a") keys.l = e.type === "keydown";
      if (e.key === "ArrowRight" || e.key === "d") keys.r = e.type === "keydown";
    };
    global.addEventListener("keydown", onKey);
    global.addEventListener("keyup", onKey);

    showOverlay(st.overlay,
      "<h3>星屑接接乐</h3><p>移动鼠标 / 手指接住星屑，金色星屑更值钱，别碰陨石。</p>" +
      '<button class="btn btn--primary" data-game="restart">开始游戏</button>');

    return {
      restart: reset,
      destroy() {
        runner.stop();
        st.destroy();
        global.removeEventListener("keydown", onKey);
        global.removeEventListener("keyup", onKey);
      }
    };
  }

  /* ══════════════ 2. 记忆星图 ══════════════ */
  function memoryGame(host) {
    host.innerHTML = "";
    host.classList.add("game-stage", "game-stage--dom");
    const grid = document.createElement("div");
    grid.className = "memory";
    const hud = document.createElement("div");
    hud.className = "game-hud";
    const overlay = document.createElement("div");
    overlay.className = "game-overlay";
    host.appendChild(hud);
    host.appendChild(grid);
    host.appendChild(overlay);

    const kinds = HS.art.kinds.slice(0, 8);
    let cards = [];
    let open = [];
    let moves = 0;
    let matched = 0;
    let startAt = 0;
    let timer = 0;
    let lock = false;

    function build() {
      cards = [];
      kinds.forEach(function (k) {
        cards.push({ kind: k, pair: k + "-a" });
        cards.push({ kind: k, pair: k + "-a" });
      });
      for (let i = cards.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = cards[i]; cards[i] = cards[j]; cards[j] = t;
      }
      open = []; moves = 0; matched = 0; lock = false;
      timer = 0; startAt = performance.now();
      render();
      hideOverlay(overlay);
      runner.start();
    }

    function render() {
      grid.innerHTML = cards.map(function (c, i) {
        const shown = c.done || open.indexOf(i) >= 0;
        return '<button class="mem-card' + (shown ? " is-open" : "") + (c.done ? " is-done" : "") +
          '" data-i="' + i + '" aria-label="卡片 ' + (i + 1) + '">' +
          '<span class="mem-card__face">' +
          (shown ? HS.art.cover(c.kind + "seed", { kind: c.kind, alt: c.kind }) : "") +
          '<span class="mem-card__tag">' + (shown ? HS.games.sceneName(c.kind) : "✦") + "</span>" +
          "</span></button>";
      }).join("");
      setHud(hud, [["步数", moves], ["配对", matched + "/8"], ["用时", timer.toFixed(0) + "s"], ["最高", best("memory")]]);
    }

    const runner = loopRunner(function () {
      timer = (performance.now() - startAt) / 1000;
      const t = hud.querySelector(".game-hud__item:nth-child(3) b");
      if (t) t.textContent = timer.toFixed(0) + "s";
    });

    grid.addEventListener("click", function (e) {
      const btn = e.target.closest(".mem-card");
      if (!btn || lock) return;
      const i = Number(btn.dataset.i);
      if (cards[i].done || open.indexOf(i) >= 0) return;
      open.push(i);
      render();
      if (open.length === 2) {
        moves += 1;
        const [a, b] = open;
        if (cards[a].pair === cards[b].pair) {
          cards[a].done = cards[b].done = true;
          matched += 1;
          open = [];
          render();
          if (matched === 8) win();
        } else {
          lock = true;
          setTimeout(function () {
            open = [];
            lock = false;
            render();
          }, 620);
        }
      }
    });

    function win() {
      runner.stop();
      const score = Math.max(10, Math.round(1400 - moves * 34 - timer * 6));
      const isBest = saveBest("memory", score);
      showOverlay(overlay,
        "<h3>星图已复原 ✦</h3><p>用时 " + timer.toFixed(1) + "s · 共用 " + moves + " 步 · 得分 <b>" + score + "</b></p>" +
        (isBest ? '<p class="game-new">✦ 新纪录！</p>' : "") +
        '<button class="btn btn--primary" data-game="restart">再玩一次</button>');
    }

    build();
    return {
      restart: build,
      destroy() { runner.stop(); }
    };
  }

  /* ══════════════ 3. 弹幕躲避 ══════════════ */
  function dodgeGame(host) {
    const st = makeStage(host, 1.7);
    const runner = loopRunner(update);
    let px = st.w / 2;
    let py = st.h - 60;
    let tx = px;
    let ty = py;
    let bullets = [];
    let hp = 3;
    let time = 0;
    let survive = 30;
    let spawnT = 0;
    let keys = {};
    let over = false;
    let invul = 0;

    function reset() {
      px = tx = st.w / 2; py = ty = st.h - 60;
      bullets = []; hp = 3; time = 0; spawnT = 0; over = false; invul = 0;
      hideOverlay(st.overlay);
      runner.start();
    }

    function spawnRing() {
      const cx = Math.random() * st.w;
      const cy = Math.random() * st.h * 0.4;
      const n = 5 + Math.floor(Math.random() * 5) + Math.floor(time / 8);
      const base = Math.random() * Math.PI * 2;
      for (let i = 0; i < n; i += 1) {
        const a = base + (i / n) * Math.PI * 2;
        bullets.push({
          x: cx, y: cy,
          vx: Math.cos(a) * (70 + Math.random() * 40 + time * 2),
          vy: Math.sin(a) * (70 + Math.random() * 40 + time * 2),
          r: 5 + Math.random() * 3
        });
      }
    }

    function spawnEdge() {
      const side = Math.floor(Math.random() * 3);
      const speed = 130 + Math.random() * 90 + time * 3;
      if (side === 0) bullets.push({ x: -10, y: Math.random() * st.h, vx: speed, vy: 0, r: 6 });
      else if (side === 1) bullets.push({ x: st.w + 10, y: Math.random() * st.h, vx: -speed, vy: 0, r: 6 });
      else bullets.push({ x: Math.random() * st.w, y: -10, vx: 0, vy: speed, r: 6 });
    }

    function update(dt) {
      if (over) return;
      time += dt;
      invul = Math.max(0, invul - dt);
      const speed = 460;
      if (keys.ArrowLeft || keys.a) tx -= speed * dt;
      if (keys.ArrowRight || keys.d) tx += speed * dt;
      if (keys.ArrowUp || keys.w) ty -= speed * dt;
      if (keys.ArrowDown || keys.s) ty += speed * dt;
      tx = Math.max(16, Math.min(st.w - 16, tx));
      ty = Math.max(16, Math.min(st.h - 16, ty));
      px += (tx - px) * Math.min(1, dt * 14);
      py += (ty - py) * Math.min(1, dt * 14);

      spawnT -= dt;
      if (spawnT <= 0) {
        (Math.random() < 0.55 ? spawnRing : spawnEdge)();
        spawnT = Math.max(0.28, 0.95 - time * 0.02);
      }

      bg(st.ctx, st.w, st.h, time);
      const ctx = st.ctx;

      for (let i = bullets.length - 1; i >= 0; i -= 1) {
        const b = bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < -40 || b.x > st.w + 40 || b.y < -40 || b.y > st.h + 40) { bullets.splice(i, 1); continue; }
        ctx.fillStyle = "#ff9ec2";
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.24;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        const dx = b.x - px;
        const dy = b.y - py;
        if (invul <= 0 && dx * dx + dy * dy < (b.r + 12) * (b.r + 12)) {
          hp -= 1;
          invul = 1.5;
          bullets.splice(i, 1);
          if (hp <= 0) return end(false);
        }
      }

      // 玩家
      ctx.save();
      ctx.translate(px, py);
      ctx.globalAlpha = invul > 0 ? (Math.sin(time * 30) > 0 ? 0.35 : 1) : 1;
      ctx.fillStyle = "#8fd8ff";
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(11, 12);
      ctx.lineTo(0, 6);
      ctx.lineTo(-11, 12);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "#c9b6ff";
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;

      if (time >= survive) return end(true);
      setHud(st.hud, [["剩余", Math.max(0, (survive - time)).toFixed(1) + "s"], ["生命", "♥".repeat(hp)], ["弹幕", bullets.length], ["最高", best("dodge")]]);
    }

    function end(survived) {
      over = true;
      runner.stop();
      const score = survived ? Math.round(600 + (30 - time) * 0 + hp * 120) : Math.round(time * 22);
      const isBest = saveBest("dodge", score);
      showOverlay(st.overlay,
        "<h3>" + (survived ? "成功穿越流星雨 ✦" : "被流星击中了…") + "</h3>" +
        "<p>坚持了 <b>" + time.toFixed(1) + "s</b> · 得分 <b>" + score + "</b></p>" +
        (isBest ? '<p class="game-new">✦ 新纪录！</p>' : "") +
        '<button class="btn btn--primary" data-game="restart">再来一次</button>');
    }

    st.canvas.addEventListener("pointermove", function (e) {
      const r = st.canvas.getBoundingClientRect();
      tx = (e.clientX - r.left) * (st.w / r.width);
      ty = (e.clientY - r.top) * (st.h / r.height);
    }, { passive: true });
    st.canvas.addEventListener("touchmove", function (e) {
      e.preventDefault();
      const r = st.canvas.getBoundingClientRect();
      const t = e.touches[0];
      tx = (t.clientX - r.left) * (st.w / r.width);
      ty = (t.clientY - r.top) * (st.h / r.height);
    }, { passive: false });

    const onKey = function (e) {
      keys[e.key] = e.type === "keydown";
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].indexOf(e.key) >= 0) e.preventDefault();
    };
    global.addEventListener("keydown", onKey);
    global.addEventListener("keyup", onKey);

    showOverlay(st.overlay,
      "<h3>弹幕躲避</h3><p>用鼠标 / 手指拖动飞船，或用方向键移动。坚持 30 秒即为通关。</p>" +
      '<button class="btn btn--primary" data-game="restart">开始游戏</button>');

    return {
      restart: reset,
      destroy() {
        runner.stop();
        st.destroy();
        global.removeEventListener("keydown", onKey);
        global.removeEventListener("keyup", onKey);
      }
    };
  }

  /* ══════════════ 4. 星轨节拍 ══════════════ */
  function rhythmGame(host) {
    const st = makeStage(host, 1.9);
    const runner = loopRunner(update);
    const LANES = 4;
    const BPM = 104;
    const beat = 60 / BPM;
    let notes = [];
    let hit = 0;
    let miss = 0;
    let combo = 0;
    let maxCombo = 0;
    let time = 0;
    let nextT = 0.8;
    let over = false;
    let flashes = [0, 0, 0, 0];
    const keys = ["a", "s", "k", "l"];

    function laneX(i) { return (st.w / LANES) * (i + 0.5); }

    function reset() {
      notes = []; hit = 0; miss = 0; combo = 0; maxCombo = 0; time = 0; nextT = 0.8; over = false;
      flashes = [0, 0, 0, 0];
      hideOverlay(st.overlay);
      runner.start();
    }

    function press(i) {
      flashes[i] = 1;
      const lineY = st.h - 56;
      let bestIdx = -1;
      let bestD = 1e9;
      notes.forEach(function (n, idx) {
        if (n.lane !== i || n.done) return;
        const d = Math.abs(n.y - lineY);
        if (d < bestD) { bestD = d; bestIdx = idx; }
      });
      if (bestIdx >= 0 && bestD < 46) {
        notes[bestIdx].done = true;
        notes[bestIdx].hitAt = time;
        hit += 1;
        combo += 1;
        maxCombo = Math.max(maxCombo, combo);
      }
    }

    function update(dt) {
      if (over) return;
      time += dt;
      const speed = 250;
      const lineY = st.h - 56;

      nextT -= dt;
      if (nextT <= 0) {
        const lane = Math.floor(Math.random() * LANES);
        notes.push({ lane: lane, y: -20, vy: speed, done: false });
        if (Math.random() < 0.3) notes.push({ lane: Math.floor(Math.random() * LANES), y: -20 - 40, vy: speed, done: false });
        nextT = beat * (Math.random() < 0.25 ? 2 : 1);
      }

      st.ctx.fillStyle = "#0a1028";
      st.ctx.fillRect(0, 0, st.w, st.h);
      bg(st.ctx, st.w, st.h, time * 0.4);

      const ctx = st.ctx;
      for (let i = 0; i < LANES; i += 1) {
        const x = laneX(i);
        const w = st.w / LANES - 14;
        ctx.save();
        ctx.globalAlpha = 0.16 + flashes[i] * 0.5;
        ctx.fillStyle = i === 0 || i === 3 ? "#6fd8ff" : "#8b7bf7";
        ctx.fillRect(x - w / 2, 0, w, st.h);
        ctx.restore();
        flashes[i] = Math.max(0, flashes[i] - dt * 4);

        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + w / 2 + 7, 0);
        ctx.lineTo(x + w / 2 + 7, st.h);
        ctx.stroke();
      }

      ctx.save();
      ctx.strokeStyle = "#ffe6a8";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#ffe6a8";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(0, lineY);
      ctx.lineTo(st.w, lineY);
      ctx.stroke();
      ctx.restore();

      for (let i = notes.length - 1; i >= 0; i -= 1) {
        const n = notes[i];
        n.y += n.vy * dt;
        if (n.done) {
          const a = Math.max(0, 1 - (time - (n.hitAt || 0)) * 4);
          if (a > 0) {
            star(ctx, laneX(n.lane), lineY, 18 * a + 6, "#ffe08a", a);
          }
          if (a <= 0) notes.splice(i, 1);
          continue;
        }
        star(ctx, laneX(n.lane), n.y, 13, "#bfe6ff", 0.95);
        if (n.y > lineY + 42) {
          miss += 1;
          combo = 0;
          notes.splice(i, 1);
        }
      }

      const stopped = Math.floor(time / 4) % 2 === 0;
      setHud(st.hud, [
        ["命中", hit], ["失误", miss], ["连击", combo],
        ["最高", Math.max(best("rhythm"), hit * 10 + maxCombo * 5)]
      ]);
    }

    const onKeyDown = function (e) {
      const idx = keys.indexOf(e.key.toLowerCase());
      if (idx >= 0) { e.preventDefault(); press(idx); }
    };
    const onPointer = function (e) {
      const r = st.canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * (st.w / r.width);
      press(Math.max(0, Math.min(LANES - 1, Math.floor(x / (st.w / LANES)))));
    };
    global.addEventListener("keydown", onKeyDown);
    st.canvas.addEventListener("pointerdown", onPointer);

    showOverlay(st.overlay,
      "<h3>星轨节拍</h3><p>光点落到金色轨道线时按下对应轨道。键盘：A / S / K / L；手机：直接点轨道。</p>" +
      '<button class="btn btn--primary" data-game="start">开始</button>');

    const watcher = setInterval(function () {
      if (over) return;
      if (time > 45 && !over) {
        over = true;
        runner.stop();
        clearInterval(watcher);
        const score = hit * 10 + maxCombo * 5;
        const isBest = saveBest("rhythm", score);
        showOverlay(st.overlay,
          "<h3>演奏结束 ♫</h3><p>命中 " + hit + " · 失误 " + miss + " · 最高连击 " + maxCombo + " · 得分 <b>" + score + "</b></p>" +
          (isBest ? '<p class="game-new">✦ 新纪录！</p>' : "") +
          '<button class="btn btn--primary" data-game="restart">再弹一次</button>');
      }
    }, 400);

    return {
      restart: reset,
      destroy() {
        runner.stop();
        clearInterval(watcher);
        st.destroy();
        global.removeEventListener("keydown", onKeyDown);
      }
    };
  }

  const FACTORY = { catch: catchGame, memory: memoryGame, dodge: dodgeGame, rhythm: rhythmGame };

  function mount(host, id) {
    const make = FACTORY[id];
    if (!make) return function () {};
    const api = make(host);
    host.addEventListener("click", function (e) {
      const b = e.target.closest("[data-game]");
      if (!b) return;
      e.preventDefault();
      api.restart();
    });
    return function dispose() { try { api.destroy(); } catch (e) {} };
  }

  HS.games = {
    LIST: LIST,
    mount: mount,
    best: best,
    sceneName: function (k) {
      return { city: "城市夜景", sea: "海边日落", torii: "鸟居雪景", mountain: "云海山脊", forest: "萤火森林",
        rain: "雨夜霓虹", aurora: "极光湖面", sakura: "樱花小路", cafe: "窗边咖啡", space: "深空星海" }[k] || k;
    }
  };
})(window);
