/* ══════════════════════════════════════════════════════════════════
   art.js —— 原创程序化插画引擎
   所有封面、场景与角色头像都由代码现场绘制（确定性随机），
   不依赖任何外部图片，可离线、可随主题变色。
   ══════════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  /* ── 确定性随机 ───────────────────────────────── */
  function hash(str) {
    let h = 2166136261 >>> 0;
    str = String(str);
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rng(seed) {
    let a = hash(seed);
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(r, arr) {
    return arr[Math.floor(r() * arr.length) % arr.length];
  }

  function rr(r, min, max) {
    return min + r() * (max - min);
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ── 配色 ─────────────────────────────────────── */
  const PALETTES = {
    night:  { sky: ["#101a48", "#28397c", "#6b54a8"], far: "#33407f", near: "#1a2350", ink: "#0d1330", a1: "#9fd7ff", a2: "#ffe6a8", a3: "#ff9ecb" },
    dusk:   { sky: ["#3a2560", "#9c4a80", "#ffb37a"], far: "#5e3470", near: "#2a1c3c", ink: "#1d1230", a1: "#ffd9a0", a2: "#ff8fb0", a3: "#ffc46b" },
    sakura: { sky: ["#4a2a60", "#a35c8b", "#ffcede"], far: "#6b3a76", near: "#331c3e", ink: "#241431", a1: "#ffd0e2", a2: "#ffe9f2", a3: "#ffb0cd" },
    ocean:  { sky: ["#062c4f", "#14708f", "#7fdcdc"], far: "#0d4a68", near: "#07293f", ink: "#041c2b", a1: "#b6f2ea", a2: "#7fd8ff", a3: "#ffe6a8" },
    forest: { sky: ["#0b2830", "#1a5a50", "#66b183"], far: "#17483f", near: "#0b2624", ink: "#06191a", a1: "#c9ff9f", a2: "#ffd88a", a3: "#8ce8c8" },
    aurora: { sky: ["#08153f", "#1c4a86", "#7fe3d4"], far: "#16456c", near: "#0a1b38", ink: "#061229", a1: "#8cffd8", a2: "#a5b4ff", a3: "#ff9ecb" },
    mono:   { sky: ["#1b1f27", "#31363f", "#5b626f"], far: "#39404b", near: "#1c2027", ink: "#10131a", a1: "#dfe6f2", a2: "#9fb0c8", a3: "#ffd88a" }
  };

  const SCENES = ["city", "sea", "torii", "mountain", "forest", "rain", "aurora", "sakura", "cafe", "space"];

  /* ── 小工具：把色值做明度变化 ─────────────────── */
  function shade(hex, amt) {
    const m = hex.replace("#", "");
    const num = parseInt(m.length === 3 ? m.replace(/(.)/g, "$1$1") : m, 16);
    let r = (num >> 16) & 255;
    let g = (num >> 8) & 255;
    let b = num & 255;
    r = Math.max(0, Math.min(255, Math.round(r + 255 * amt)));
    g = Math.max(0, Math.min(255, Math.round(g + 255 * amt)));
    b = Math.max(0, Math.min(255, Math.round(b + 255 * amt)));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  let uid = 0;
  function nextId(prefix) {
    uid += 1;
    return prefix + uid;
  }

  /* ── 生成结果缓存（同一 seed 只画一次，避免重复计算与重复 DOM） ── */
  const CACHE = new Map();
  const CACHE_MAX = 260;

  /* ── 星空 / 花瓣 / 雨 / 雪 等散布元素 ─────────── */
  function stars(r, w, h, count, colors) {
    let out = "";
    for (let i = 0; i < count; i += 1) {
      const x = rr(r, 0, w).toFixed(1);
      const y = rr(r, 0, h * 0.72).toFixed(1);
      const rad = rr(r, 0.5, 1.7).toFixed(2);
      const op = rr(r, 0.25, 0.95).toFixed(2);
      const fill = pick(r, colors);
      out += '<circle cx="' + x + '" cy="' + y + '" r="' + rad + '" fill="' + fill + '" opacity="' + op + '"/>';
    }
    return out;
  }

  function fall(r, w, h, count, color, len) {
    let out = "";
    for (let i = 0; i < count; i += 1) {
      const x = rr(r, 0, w).toFixed(1);
      const y = rr(r, 0, h).toFixed(1);
      const l = rr(r, len * 0.6, len * 1.4).toFixed(1);
      out += '<line x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + (Number(y) + Number(l)).toFixed(1) +
        '" stroke="' + color + '" stroke-width="1" opacity="' + rr(r, 0.15, 0.5).toFixed(2) + '"/>';
    }
    return out;
  }

  function petals(r, w, h, count, color) {
    let out = "";
    for (let i = 0; i < count; i += 1) {
      const x = rr(r, 0, w).toFixed(1);
      const y = rr(r, 0, h).toFixed(1);
      const rot = rr(r, -60, 60).toFixed(1);
      out += '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rr(r, 2.4, 5).toFixed(1) + '" ry="' +
        rr(r, 1.4, 2.8).toFixed(1) + '" fill="' + color + '" opacity="' + rr(r, 0.3, 0.8).toFixed(2) +
        '" transform="rotate(' + rot + " " + x + " " + y + ')"/>';
    }
    return out;
  }

  function fireflies(r, w, h, count, color) {
    let out = "";
    for (let i = 0; i < count; i += 1) {
      const x = rr(r, 0, w).toFixed(1);
      const y = rr(r, h * 0.4, h).toFixed(1);
      out += '<circle cx="' + x + '" cy="' + y + '" r="' + rr(r, 1, 2.4).toFixed(1) + '" fill="' + color +
        '" opacity="' + rr(r, 0.4, 0.95).toFixed(2) + '"/>';
    }
    return out;
  }

  /* ── 建筑群 ───────────────────────────────────── */
  function skyline(r, w, h, base, color, winColor, density) {
    let out = "";
    let x = -10;
    const gap = density || 26;
    while (x < w) {
      const bw = rr(r, 18, 46).toFixed(1);
      const bh = rr(r, 34, 128).toFixed(1);
      const by = (base - bh).toFixed(1);
      out += '<rect x="' + x.toFixed(1) + '" y="' + by + '" width="' + bw + '" height="' + bh + '" fill="' + color + '" rx="1.5"/>';
      const cols = Math.max(1, Math.floor(Number(bw) / 9));
      const rows = Math.max(1, Math.floor(Number(bh) / 12));
      for (let c = 0; c < cols; c += 1) {
        for (let ro = 0; ro < rows; ro += 1) {
          if (r() > 0.42) continue;
          const wx = (Number(x) + 4 + c * 9).toFixed(1);
          const wy = (Number(by) + 6 + ro * 12).toFixed(1);
          out += '<rect x="' + wx + '" y="' + wy + '" width="3.4" height="5" rx="1" fill="' + winColor +
            '" opacity="' + rr(r, 0.35, 0.95).toFixed(2) + '"/>';
        }
      }
      x += Number(bw) + rr(r, 2, 9);
    }
    return out;
  }

  /* ── 山脊 ─────────────────────────────────────── */
  function ridge(r, w, h, base, color, jag) {
    let d = "M0 " + h + " L0 " + base;
    let x = 0;
    while (x < w) {
      const step = rr(r, 30, 90);
      x += step;
      const y = base - rr(r, 0, jag);
      d += " L" + x.toFixed(1) + " " + y.toFixed(1);
    }
    d += " L" + w + " " + base + " L" + w + " " + h + " Z";
    return '<path d="' + d + '" fill="' + color + '"/>';
  }

  function smoothRidge(r, w, h, base, color, amp) {
    const p1 = base - rr(r, amp * 0.4, amp);
    const p2 = base - rr(r, amp * 0.2, amp * 0.85);
    const p3 = base - rr(r, amp * 0.5, amp * 1.1);
    return (
      '<path d="M0 ' + h + ' L0 ' + base + ' C ' + (w * 0.18).toFixed(0) + " " + p1.toFixed(0) + ", " +
      (w * 0.32).toFixed(0) + " " + p2.toFixed(0) + ", " + (w * 0.5).toFixed(0) + " " + p2.toFixed(0) +
      " S " + (w * 0.78).toFixed(0) + " " + p3.toFixed(0) + ", " + w + " " + (base - amp * 0.3).toFixed(0) +
      " L " + w + " " + h + " Z\" fill=\"" + color + '"/>'
    );
  }

  /* ── 树 ───────────────────────────────────────── */
  function tree(r, x, y, scale, color) {
    const s = scale || 1;
    return (
      '<g transform="translate(' + x.toFixed(1) + " " + y.toFixed(1) + ") scale(" + s.toFixed(2) + ')" fill="' + color + '">' +
      '<rect x="-2.2" y="-24" width="4.4" height="26" rx="2.2"/>' +
      '<path d="M-4 -22 C -16 -26, -21 -36, -19 -46 C -11 -44, -6 -38, -4 -31 Z"/>' +
      '<path d="M4 -22 C 16 -26, 21 -36, 19 -46 C 11 -44, 6 -38, 4 -31 Z"/>' +
      '<path d="M0 -70 C 12 -70, 19 -62, 19 -53 C 19 -47, 15 -42, 9 -40 C 13 -36, 12 -30, 6 -28 L -6 -28 C -12 -30, -13 -36, -9 -40 C -15 -42, -19 -47, -19 -53 C -19 -62, -12 -70, 0 -70 Z"/>' +
      '<circle cx="-9" cy="-58" r="8.5"/>' +
      '<circle cx="9" cy="-56" r="8"/>' +
      '<circle cx="0" cy="-64" r="9"/>' +
      '<circle cx="-4" cy="-46" r="8"/>' +
      '<circle cx="6" cy="-45" r="7.5"/>' +
      "</g>"
    );
  }

  function torii(x, y, scale, color) {
    const s = scale || 1;
    return (
      '<g transform="translate(' + x.toFixed(1) + " " + y.toFixed(1) + ") scale(" + s.toFixed(2) + ')" fill="' + color + '">' +
      '<path d="M-62 -6 C -40 -16, -14 -20, 0 -20 C 14 -20, 40 -16, 62 -6 C 40 -10, 14 -13, 0 -13 C -14 -13, -40 -10, -62 -6 Z"/>' +
      '<rect x="-52" y="-2" width="104" height="8" rx="3"/>' +
      '<rect x="-46" y="20" width="92" height="6.5" rx="2.5"/>' +
      '<rect x="-34" y="6" width="8" height="112" rx="2"/>' +
      '<rect x="26" y="6" width="8" height="112" rx="2"/>' +
      '<rect x="-2" y="-20" width="4" height="14" rx="1.6"/>' +
      "</g>"
    );
  }

  /* ── 场景生成器 ───────────────────────────────── */
  function sceneBody(kind, pal, r, w, h) {
    const id = nextId("g");
    const sky = pal.sky;
    const grad =
      '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + sky[0] + '"/><stop offset="0.55" stop-color="' + sky[1] +
      '"/><stop offset="1" stop-color="' + sky[2] + '"/></linearGradient>';
    let defs = grad;
    let body = '<rect width="' + w + '" height="' + h + '" fill="url(#' + id + ')"/>';

    // 光晕
    const sunX = rr(r, w * 0.18, w * 0.82);
    const sunY = rr(r, h * 0.28, h * 0.5);
    const glowId = nextId("glow");
    defs +=
      '<radialGradient id="' + glowId + '"><stop offset="0" stop-color="' + pal.a2 +
      '" stop-opacity="0.85"/><stop offset="0.5" stop-color="' + pal.a3 +
      '" stop-opacity="0.24"/><stop offset="1" stop-color="' + pal.a3 + '" stop-opacity="0"/></radialGradient>';

    if (kind === "city") {
      body += stars(r, w, h, 90, ["#ffffff", pal.a1, pal.a2]);
      body += '<circle cx="' + sunX.toFixed(0) + '" cy="' + sunY.toFixed(0) + '" r="' + (h * 0.42).toFixed(0) + '" fill="url(#' + glowId + ')"/>';
      body += '<circle cx="' + sunX.toFixed(0) + '" cy="' + sunY.toFixed(0) + '" r="' + rr(r, 14, 22).toFixed(1) + '" fill="#fff8e6" opacity="0.95"/>';
      body += smoothRidge(r, w, h, h * 0.68, pal.far, h * 0.1);
      body += skyline(r, w, h, h * 0.78, pal.far, pal.a2, 24);
      body += skyline(r, w, h, h * 0.93, pal.near, pal.a1, 30);
      body += '<rect x="0" y="' + (h * 0.93).toFixed(0) + '" width="' + w + '" height="' + h + '" fill="' + pal.ink + '" opacity="0.85"/>';
      // 霓虹招牌
      for (let i = 0; i < 4; i += 1) {
        const ex = rr(r, w * 0.05, w * 0.9);
        const ey = rr(r, h * 0.52, h * 0.72);
        body += '<rect x="' + ex.toFixed(0) + '" y="' + ey.toFixed(0) + '" width="' + rr(r, 10, 26).toFixed(0) + '" height="' +
          rr(r, 14, 34).toFixed(0) + '" rx="3" fill="' + pick(r, [pal.a1, pal.a3]) + '" opacity="' + rr(r, 0.5, 0.9).toFixed(2) + '"/>';
      }
      // 街灯
      for (let i = 0; i < 7; i += 1) {
        body += '<circle cx="' + rr(r, 0, w).toFixed(0) + '" cy="' + rr(r, h * 0.86, h * 0.94).toFixed(0) + '" r="' + rr(r, 1.4, 3).toFixed(1) +
          '" fill="' + pal.a2 + '" opacity="' + rr(r, 0.6, 1).toFixed(2) + '"/>';
      }
      body += fireflies(r, w, h, 14, pal.a2);
    } else if (kind === "sea") {
      body += '<circle cx="' + sunX.toFixed(0) + '" cy="' + (h * 0.46).toFixed(0) + '" r="' + (h * 0.52).toFixed(0) + '" fill="url(#' + glowId + ')"/>';
      body += '<circle cx="' + sunX.toFixed(0) + '" cy="' + (h * 0.46).toFixed(0) + '" r="' + rr(r, 20, 30).toFixed(1) + '" fill="' + pal.a2 + '" opacity="0.95"/>';
      body += '<rect x="0" y="' + (h * 0.52).toFixed(0) + '" width="' + w + '" height="' + (h * 0.48).toFixed(0) + '" fill="' + shade(pal.far, -0.06) + '"/>';
      for (let i = 0; i < 26; i += 1) {
        const y = h * 0.54 + i * (h * 0.018);
        const len = rr(r, w * 0.08, w * 0.22);
        const x = sunX - len / 2 + rr(r, -w * 0.08, w * 0.08);
        body += '<rect x="' + x.toFixed(0) + '" y="' + y.toFixed(1) + '" width="' + len.toFixed(0) + '" height="' +
          rr(r, 1, 2.6).toFixed(1) + '" rx="1" fill="' + pal.a2 + '" opacity="' + rr(r, 0.12, 0.4).toFixed(2) + '"/>';
      }
      // 两侧礁石
      body += '<path d="M0 ' + h + " L0 " + (h * 0.66).toFixed(0) + " C " + (w * 0.06).toFixed(0) + " " + (h * 0.72).toFixed(0) +
        ", " + (w * 0.1).toFixed(0) + " " + (h * 0.86).toFixed(0) + ", " + (w * 0.2).toFixed(0) + " " + h + ' Z" fill="' + shade(pal.ink, 0.02) + '"/>';
      body += '<path d="M' + w + " " + h + " L" + w + " " + (h * 0.6).toFixed(0) + " C " + (w * 0.94).toFixed(0) + " " + (h * 0.7).toFixed(0) +
        ", " + (w * 0.9).toFixed(0) + " " + (h * 0.88).toFixed(0) + ", " + (w * 0.8).toFixed(0) + " " + h + ' Z" fill="' + shade(pal.ink, 0.02) + '"/>';
      // 海鸟
      for (let i = 0; i < 3; i += 1) {
        const bx = rr(r, w * 0.2, w * 0.8);
        const by = rr(r, h * 0.2, h * 0.42);
        body += '<path d="M' + bx.toFixed(0) + " " + by.toFixed(0) + " q4 -4 8 0 q4 -4 8 0" + '" stroke="#ffffff" stroke-width="1.4" fill="none" opacity="0.55"/>';
      }
      body += '<path d="M0 ' + h + " L0 " + (h * 0.8).toFixed(0) + " C " + (w * 0.2).toFixed(0) + " " + (h * 0.72).toFixed(0) +
        ", " + (w * 0.4).toFixed(0) + " " + (h * 0.92).toFixed(0) + ", " + (w * 0.62).toFixed(0) + " " + (h * 0.84).toFixed(0) +
        " L " + w + " " + (h * 0.9).toFixed(0) + " L " + w + " " + h + ' Z" fill="' + pal.ink + '"/>';
    } else if (kind === "torii") {
      body += stars(r, w, h, 40, ["#ffffff", pal.a1]);
      body += '<circle cx="' + (w * 0.74).toFixed(0) + '" cy="' + (h * 0.26).toFixed(0) + '" r="' + (h * 0.4).toFixed(0) + '" fill="url(#' + glowId + ')"/>';
      body += smoothRidge(r, w, h, h * 0.6, pal.far, h * 0.08);
      body += '<ellipse cx="' + (w * 0.2).toFixed(0) + '" cy="' + (h * 0.42).toFixed(0) + '" rx="' + (w * 0.3).toFixed(0) + '" ry="' + (h * 0.05).toFixed(0) + '" fill="#ffffff" opacity="0.14"/>';
      body += '<path d="M0 ' + h + " L0 " + (h * 0.68).toFixed(0) + " C " + (w * 0.32).toFixed(0) + " " + (h * 0.62).toFixed(0) +
        ", " + (w * 0.5).toFixed(0) + " " + (h * 0.74).toFixed(0) + ", " + w + " " + (h * 0.66).toFixed(0) + " L " + w + " " + h +
        ' Z" fill="' + shade(pal.near, 0.02) + '"/>';
      body += torii(w * 0.66, h * 0.36, 0.82, pal.ink);
      body += tree(r, w * 0.14, h * 0.78, 0.72, shade(pal.near, -0.2));
      body += tree(r, w * 0.92, h * 0.8, 0.6, shade(pal.near, -0.24));
      body += '<circle cx="' + (w * 0.58).toFixed(0) + '" cy="' + (h * 0.44).toFixed(0) + '" r="2.6" fill="#ffd88a" opacity="0.95"/>';
      body += '<circle cx="' + (w * 0.74).toFixed(0) + '" cy="' + (h * 0.46).toFixed(0) + '" r="2.6" fill="#ffd88a" opacity="0.95"/>';
      body += petals(r, w, h, 26, pal.a2);
    } else if (kind === "mountain") {
      body += '<circle cx="' + (w * 0.2).toFixed(0) + '" cy="' + (h * 0.24).toFixed(0) + '" r="' + (h * 0.34).toFixed(0) + '" fill="url(#' + glowId + ')"/>';
      body += stars(r, w, h * 0.5, 26, ["#ffffff", pal.a1]);
      body += smoothRidge(r, w, h, h * 0.62, shade(pal.far, 0.1), h * 0.16);
      body += smoothRidge(r, w, h, h * 0.72, pal.far, h * 0.2);
      body += smoothRidge(r, w, h, h * 0.84, pal.near, h * 0.18);
      for (let i = 0; i < 4; i += 1) {
        body += '<ellipse cx="' + rr(r, 0, w).toFixed(0) + '" cy="' + rr(r, h * 0.5, h * 0.86).toFixed(0) + '" rx="' + rr(r, w * 0.2, w * 0.45).toFixed(0) + '" ry="' + rr(r, 6, 16).toFixed(0) + '" fill="#ffffff" opacity="' + rr(r, 0.06, 0.16).toFixed(2) + '"/>';
      }
      body += tree(r, w * 0.12, h * 0.98, 0.7, shade(pal.near, -0.18));
      body += tree(r, w * 0.88, h, 0.85, shade(pal.near, -0.18));
    } else if (kind === "forest") {
      body += '<circle cx="' + (w * 0.55).toFixed(0) + '" cy="' + (h * 0.3).toFixed(0) + '" r="' + (h * 0.34).toFixed(0) + '" fill="url(#' + glowId + ')"/>';
      for (let i = 0; i < 9; i += 1) {
        const tx = (i / 8) * w + rr(r, -14, 14);
        const sc = rr(r, 0.6, 1.25);
        body += tree(r, tx, h * (0.8 + rr(r, 0, 0.14)), sc, shade(pal.near, i % 2 ? -0.1 : 0.03));
      }
      body += smoothRidge(r, w, h, h * 0.92, pal.ink, h * 0.05);
      body += fireflies(r, w, h * 0.9, 34, pal.a1);
      body += fireflies(r, w, h * 0.7, 12, pal.a2);
    } else if (kind === "rain") {
      body += skyline(r, w, h, h * 0.72, shade(pal.far, -0.04), pal.a2, 22);
      body += skyline(r, w, h, h * 0.88, pal.near, pal.a1, 28);
      const roadY = h * 0.88;
      body += '<rect x="0" y="' + roadY.toFixed(0) + '" width="' + w + '" height="' + (h - roadY).toFixed(0) + '" fill="' + pal.ink + '"/>';
      for (let i = 0; i < 10; i += 1) {
        const x = rr(r, 0, w);
        const len = rr(r, 10, 30);
        body += '<rect x="' + x.toFixed(0) + '" y="' + roadY.toFixed(0) + '" width="' + len.toFixed(0) + '" height="' +
          rr(r, 1.5, 3).toFixed(1) + '" fill="' + pick(r, [pal.a1, pal.a2, pal.a3]) + '" opacity="' + rr(r, 0.25, 0.7).toFixed(2) + '"/>';
      }
      body += '<ellipse cx="' + (w * 0.3).toFixed(0) + '" cy="' + (h * 0.96).toFixed(0) + '" rx="' + (w * 0.24).toFixed(0) + '" ry="8" fill="' + pal.a1 + '" opacity="0.2"/>';
      body += fall(r, w, h, 90, "#ffffff", 16);
    } else if (kind === "aurora") {
      body += stars(r, w, h, 80, ["#ffffff", pal.a1]);
      const aid = nextId("aur");
      defs +=
        '<linearGradient id="' + aid + '" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" stop-color="' + pal.a1 + '" stop-opacity="0"/><stop offset="0.45" stop-color="' + pal.a1 +
        '" stop-opacity="0.7"/><stop offset="1" stop-color="' + pal.a3 + '" stop-opacity="0"/></linearGradient>';
      for (let i = 0; i < 3; i += 1) {
        const y = h * (0.2 + i * 0.09);
        body += '<path d="M0 ' + y.toFixed(0) + " C " + (w * 0.3).toFixed(0) + " " + (y - rr(r, 20, 50)).toFixed(0) +
          ", " + (w * 0.6).toFixed(0) + " " + (y + rr(r, 18, 46)).toFixed(0) + ", " + w + " " + (y - rr(r, 10, 30)).toFixed(0) +
          '" stroke="url(#' + aid + ')" stroke-width="' + rr(r, 12, 26).toFixed(0) + '" fill="none" opacity="0.55" stroke-linecap="round"/>';
      }
      body += smoothRidge(r, w, h, h * 0.62, pal.far, h * 0.1);
      body += '<rect x="0" y="' + (h * 0.72).toFixed(0) + '" width="' + w + '" height="' + (h * 0.28).toFixed(0) + '" fill="' + shade(pal.near, -0.04) + '"/>';
      for (let i = 0; i < 12; i += 1) {
        body += '<rect x="' + rr(r, 0, w - 60).toFixed(0) + '" y="' + rr(r, h * 0.74, h * 0.98).toFixed(0) + '" width="' +
          rr(r, 20, 70).toFixed(0) + '" height="1.6" rx="1" fill="' + pal.a1 + '" opacity="' + rr(r, 0.1, 0.35).toFixed(2) + '"/>';
      }
      body += tree(r, w * 0.08, h, 0.8, pal.ink);
    } else if (kind === "sakura") {
      body += '<circle cx="' + (w * 0.78).toFixed(0) + '" cy="' + (h * 0.24).toFixed(0) + '" r="' + (h * 0.36).toFixed(0) + '" fill="url(#' + glowId + ')"/>';
      body += smoothRidge(r, w, h, h * 0.66, pal.far, h * 0.08);
      body += '<path d="M' + (w * 0.34).toFixed(0) + " " + h + " L" + (w * 0.46).toFixed(0) + " " + (h * 0.66).toFixed(0) +
        " L" + (w * 0.56).toFixed(0) + " " + (h * 0.66).toFixed(0) + " L" + (w * 0.72).toFixed(0) + " " + h + ' Z" fill="' + shade(pal.near, 0.06) + '"/>';
      body += tree(r, w * 0.14, h * 0.84, 0.95, shade(pal.near, -0.16));
      body += tree(r, w * 0.9, h * 0.82, 0.8, shade(pal.near, -0.2));
      body += '<circle cx="' + (w * 0.2).toFixed(0) + '" cy="' + (h * 0.46).toFixed(0) + '" r="' + (w * 0.2).toFixed(0) + '" fill="' + pal.a1 + '" opacity="0.3"/>';
      body += '<circle cx="' + (w * 0.86).toFixed(0) + '" cy="' + (h * 0.42).toFixed(0) + '" r="' + (w * 0.16).toFixed(0) + '" fill="' + pal.a3 + '" opacity="0.28"/>';
      body += petals(r, w, h, 46, pal.a2);
    } else if (kind === "cafe") {
      const wid = nextId("win");
      defs +=
        '<linearGradient id="' + wid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="' + pal.ink + '" stop-opacity="0.9"/><stop offset="1" stop-color="' + pal.far + '" stop-opacity="0.5"/></linearGradient>';
      body += stars(r, w, h, 44, ["#ffffff", pal.a1]);
      body += '<rect x="' + (w * 0.08).toFixed(0) + '" y="' + (h * 0.1).toFixed(0) + '" width="' + (w * 0.84).toFixed(0) + '" height="' + (h * 0.66).toFixed(0) + '" rx="10" fill="url(#' + wid + ')" stroke="' + pal.a2 + '" stroke-opacity="0.4" stroke-width="3"/>';
      body += '<line x1="' + (w * 0.5).toFixed(0) + '" y1="' + (h * 0.1).toFixed(0) + '" x2="' + (w * 0.5).toFixed(0) + '" y2="' + (h * 0.76).toFixed(0) + '" stroke="' + pal.a2 + '" stroke-opacity="0.35" stroke-width="3"/>';
      body += '<line x1="' + (w * 0.08).toFixed(0) + '" y1="' + (h * 0.42).toFixed(0) + '" x2="' + (w * 0.92).toFixed(0) + '" y2="' + (h * 0.42).toFixed(0) + '" stroke="' + pal.a2 + '" stroke-opacity="0.3" stroke-width="3"/>';
      body += '<circle cx="' + (w * 0.62).toFixed(0) + '" cy="' + (h * 0.28).toFixed(0) + '" r="' + (h * 0.14).toFixed(0) + '" fill="' + pal.a3 + '" opacity="0.5"/>';
      body += '<rect x="0" y="' + (h * 0.76).toFixed(0) + '" width="' + w + '" height="' + (h * 0.24).toFixed(0) + '" fill="' + shade(pal.near, -0.06) + '"/>';
      body += '<ellipse cx="' + (w * 0.3).toFixed(0) + '" cy="' + (h * 0.88).toFixed(0) + '" rx="26" ry="9" fill="' + pal.a2 + '" opacity="0.5"/>';
      body += '<rect x="' + (w * 0.26).toFixed(0) + '" y="' + (h * 0.76).toFixed(0) + '" width="8" height="' + (h * 0.14).toFixed(0) + '" fill="' + pal.a2 + '" opacity="0.5"/>';
    } else {
      // space
      body += stars(r, w, h, 170, ["#ffffff", pal.a1, pal.a2, pal.a3]);
      body += '<circle cx="' + sunX.toFixed(0) + '" cy="' + (h * 0.5).toFixed(0) + '" r="' + (h * 0.44).toFixed(0) + '" fill="url(#' + glowId + ')"/>';
      body += '<circle cx="' + sunX.toFixed(0) + '" cy="' + (h * 0.5).toFixed(0) + '" r="' + rr(r, 30, 52).toFixed(1) + '" fill="none" stroke="' + pal.a1 + '" stroke-width="2" opacity="0.6"/>';
      body += '<circle cx="' + sunX.toFixed(0) + '" cy="' + (h * 0.5).toFixed(0) + '" r="' + rr(r, 52, 74).toFixed(1) + '" fill="none" stroke="' + pal.a2 + '" stroke-width="1.4" opacity="0.45" stroke-dasharray="6 8"/>';
      body += '<ellipse cx="' + (w * 0.78).toFixed(0) + '" cy="' + (h * 0.78).toFixed(0) + '" rx="' + rr(r, 14, 22).toFixed(1) + '" ry="10" fill="' + pal.a3 + '" opacity="0.7"/>';
      body += '<path d="M' + (w * 0.1).toFixed(0) + " " + (h * 0.72).toFixed(0) + " L" + (w * 0.3).toFixed(0) + " " + (h * 0.34).toFixed(0) +
        '" stroke="#ffffff" stroke-width="1.6" opacity="0.5" stroke-linecap="round"/>';
    }

    return { defs: defs, body: body };
  }

  /* ── 对外的场景 API ───────────────────────────── */
  function scene(seed, opts) {
    opts = opts || {};
    const key = "s|" + seed + "|" + (opts.kind || "-") + "|" + (opts.palette || "-") + "|" +
      (opts.w || 400) + "x" + (opts.h || 280);
    if (CACHE.has(key)) return CACHE.get(key);
    const r = rng(seed);
    const w = opts.w || 400;
    const h = opts.h || 280;
    const kind = opts.kind || pick(r, SCENES);
    const pal = PALETTES[opts.palette || pick(r, Object.keys(PALETTES))] || PALETTES.night;
    const built = sceneBody(kind, pal, r, w, h);
    const svg = (
      '<svg viewBox="0 0 ' + w + " " + h + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
      esc(opts.alt || kind) + '" preserveAspectRatio="xMidYMid slice">' +
      "<defs>" + built.defs + "</defs>" + built.body + "</svg>"
    );
    if (CACHE.size > CACHE_MAX) CACHE.clear();
    CACHE.set(key, svg);
    return svg;
  }

  /* ── 抽象封面（卡片缩略图） ───────────────────── */
  function cover(seed, opts) {
    opts = opts || {};
    const key = "c|" + seed + "|" + (opts.kind || "-") + "|" + (opts.palette || "-");
    if (CACHE.has(key)) return CACHE.get(key);
    const r = rng(seed);
    const w = 400;
    const h = 250;
    const pal = PALETTES[opts.palette || pick(r, Object.keys(PALETTES))] || PALETTES.night;
    const id = nextId("cv");
    const gid = nextId("cg");
    let defs =
      '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + pal.sky[2] + '"/><stop offset="0.42" stop-color="' + pal.sky[1] +
      '"/><stop offset="1" stop-color="' + pal.sky[0] + '"/></linearGradient>' +
      '<radialGradient id="' + gid + '"><stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>' +
      '<stop offset="0.45" stop-color="' + pal.a2 + '" stop-opacity="0.3"/>' +
      '<stop offset="1" stop-color="' + pal.a1 + '" stop-opacity="0"/></radialGradient>';
    let body = '<rect width="' + w + '" height="' + h + '" fill="url(#' + id + ')"/>';
    body += '<circle cx="' + rr(r, w * 0.55, w * 0.95).toFixed(0) + '" cy="' + rr(r, h * 0.05, h * 0.5).toFixed(0) +
      '" r="' + (h * 0.75).toFixed(0) + '" fill="url(#' + gid + ')"/>';

    for (let i = 0; i < 4; i += 1) {
      const cx = rr(r, -40, w + 40);
      const cy = rr(r, -30, h + 30);
      body += '<circle cx="' + cx.toFixed(0) + '" cy="' + cy.toFixed(0) + '" r="' + rr(r, 50, 130).toFixed(0) +
        '" fill="' + pick(r, [pal.a1, pal.a2, pal.a3]) + '" opacity="' + rr(r, 0.16, 0.42).toFixed(2) +
        '" style="mix-blend-mode:screen"/>';
    }
    const style = Math.floor(r() * 3);
    if (style === 0) {
      for (let i = 0; i < 5; i += 1) {
        body += '<path d="M0 ' + rr(r, h * 0.3, h).toFixed(0) + " C " + (w * 0.3).toFixed(0) + " " + rr(r, 0, h).toFixed(0) +
          ", " + (w * 0.7).toFixed(0) + " " + rr(r, 0, h).toFixed(0) + ", " + w + " " + rr(r, h * 0.3, h).toFixed(0) +
          '" stroke="' + pick(r, [pal.a1, pal.a2, pal.a3]) + '" stroke-width="' + rr(r, 1, 3).toFixed(1) +
          '" fill="none" opacity="' + rr(r, 0.2, 0.55).toFixed(2) + '"/>';
      }
    } else if (style === 1) {
      for (let i = 0; i < 16; i += 1) {
        const x = rr(r, 0, w);
        body += '<rect x="' + x.toFixed(0) + '" y="' + rr(r, 0, h * 0.6).toFixed(0) + '" width="' + rr(r, 4, 16).toFixed(0) +
          '" height="' + rr(r, 30, 140).toFixed(0) + '" rx="6" fill="' + pick(r, [pal.a1, pal.a2, pal.a3]) +
          '" opacity="' + rr(r, 0.08, 0.3).toFixed(2) + '"/>';
      }
    } else {
      for (let i = 0; i < 7; i += 1) {
        const s = rr(r, 30, 110);
        const cx = rr(r, 0, w);
        const cy = rr(r, 0, h);
        body += '<rect x="' + (cx - s / 2).toFixed(0) + '" y="' + (cy - s / 2).toFixed(0) + '" width="' + s.toFixed(0) +
          '" height="' + s.toFixed(0) + '" rx="' + (s * 0.18).toFixed(0) + '" fill="none" stroke="' +
          pick(r, [pal.a1, pal.a2, pal.a3]) + '" stroke-width="1.4" opacity="' + rr(r, 0.15, 0.45).toFixed(2) +
          '" transform="rotate(' + rr(r, -30, 30).toFixed(1) + " " + cx.toFixed(0) + " " + cy.toFixed(0) + ')"/>';
      }
    }
    body += stars(r, w, h * 0.9, 40, ["#ffffff", pal.a1]);
    body += '<rect y="' + (h * 0.55).toFixed(0) + '" width="' + w + '" height="' + (h * 0.45).toFixed(0) +
      '" fill="' + pal.ink + '" opacity="0.42"/>';

    const svg = (
      '<svg viewBox="0 0 ' + w + " " + h + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
      esc(opts.alt || "封面") + '" preserveAspectRatio="xMidYMid slice"><defs>' + defs + "</defs>" + body + "</svg>"
    );
    if (CACHE.size > CACHE_MAX) CACHE.clear();
    CACHE.set(key, svg);
    return svg;
  }

  /* ── 角色肖像（矢量风格） ─────────────────────── */
  function portrait(seed, opts) {
    opts = opts || {};
    const key = "p|" + seed + "|" + (opts.palette || "-");
    if (CACHE.has(key)) return CACHE.get(key);
    const r = rng(seed);
    const w = 300;
    const h = 400;
    const pal = PALETTES[opts.palette || pick(r, Object.keys(PALETTES))] || PALETTES.sakura;
    const hairColors = [pal.sky[2], pal.a1, pal.a2, pal.a3, "#e8f1ff", "#ffd9ea", "#c9b6ff", "#9fe0d0"];
    const hair = pick(r, hairColors);
    const skin = pick(r, ["#ffe6d8", "#ffe0cf", "#ffdcc6", "#f7d7c9"]);
    const eye = pick(r, [pal.a1, pal.a2, "#6fb6ff", "#c07bff", "#5fd6c8", "#ff9ecb"]);
    const style = Math.floor(r() * 4);
    const id = nextId("pt");

    let defs =
      '<linearGradient id="' + id + 'b" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + pal.sky[1] + '"/><stop offset="1" stop-color="' + pal.ink + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'h" x1="0" y1="0" x2="0.4" y2="1">' +
      '<stop offset="0" stop-color="' + shade(hair, 0.16) + '"/><stop offset="1" stop-color="' + shade(hair, -0.12) + '"/></linearGradient>';

    let body = '<rect width="' + w + '" height="' + h + '" fill="url(#' + id + 'b)"/>';
    body += '<circle cx="' + (w * 0.5).toFixed(0) + '" cy="' + (h * 0.42).toFixed(0) + '" r="' + (w * 0.42).toFixed(0) + '" fill="' + pal.a2 + '" opacity="0.22"/>';
    body += stars(r, w, h * 0.8, 30, ["#ffffff", pal.a1]);
    if (style === 3) {
      body += '<circle cx="' + (w * 0.5).toFixed(0) + '" cy="' + (h * 0.5).toFixed(0) + '" r="' + (w * 0.3).toFixed(0) + '" fill="none" stroke="' + pal.a1 + '" stroke-width="1.6" opacity="0.5" stroke-dasharray="5 7"/>';
    }

    // 身体
    body += '<path d="M' + (w * 0.16).toFixed(0) + " " + h + " C " + (w * 0.2).toFixed(0) + " " + (h * 0.78).toFixed(0) +
      ", " + (w * 0.36).toFixed(0) + " " + (h * 0.7).toFixed(0) + ", " + (w * 0.5).toFixed(0) + " " + (h * 0.7).toFixed(0) +
      " C " + (w * 0.64).toFixed(0) + " " + (h * 0.7).toFixed(0) + ", " + (w * 0.8).toFixed(0) + " " + (h * 0.78).toFixed(0) +
      ", " + (w * 0.84).toFixed(0) + " " + h + ' Z" fill="' + shade(pal.a2, -0.06) + '"/>';
    body += '<path d="M' + (w * 0.38).toFixed(0) + " " + (h * 0.7).toFixed(0) + " L" + (w * 0.5).toFixed(0) + " " + (h * 0.84).toFixed(0) +
      " L" + (w * 0.62).toFixed(0) + " " + (h * 0.7).toFixed(0) + ' Z" fill="#ffffff" opacity="0.9"/>';

    // 后发
    if (style === 0 || style === 2) {
      body += '<path d="M' + (w * 0.2).toFixed(0) + " " + (h * 0.62).toFixed(0) + " C " + (w * 0.14).toFixed(0) + " " + (h * 0.3).toFixed(0) +
        ", " + (w * 0.32).toFixed(0) + " " + (h * 0.12).toFixed(0) + ", " + (w * 0.5).toFixed(0) + " " + (h * 0.12).toFixed(0) +
        " C " + (w * 0.68).toFixed(0) + " " + (h * 0.12).toFixed(0) + ", " + (w * 0.86).toFixed(0) + " " + (h * 0.3).toFixed(0) +
        ", " + (w * 0.8).toFixed(0) + " " + (h * 0.62).toFixed(0) + " C " + (w * 0.78).toFixed(0) + " " + (h * 0.86).toFixed(0) +
        ", " + (w * 0.62).toFixed(0) + " " + (h * 0.96).toFixed(0) + ", " + (w * 0.5).toFixed(0) + " " + (h * 0.96).toFixed(0) +
        " C " + (w * 0.38).toFixed(0) + " " + (h * 0.96).toFixed(0) + ", " + (w * 0.22).toFixed(0) + " " + (h * 0.86).toFixed(0) +
        ", " + (w * 0.2).toFixed(0) + " " + (h * 0.62).toFixed(0) + ' Z" fill="url(#' + id + 'h)" opacity="0.95"/>';
    }
    if (style === 1) {
      // 双马尾
      body += '<ellipse cx="' + (w * 0.2).toFixed(0) + '" cy="' + (h * 0.56).toFixed(0) + '" rx="' + (w * 0.1).toFixed(0) + '" ry="' + (h * 0.2).toFixed(0) + '" fill="url(#' + id + 'h)"/>';
      body += '<ellipse cx="' + (w * 0.8).toFixed(0) + '" cy="' + (h * 0.56).toFixed(0) + '" rx="' + (w * 0.1).toFixed(0) + '" ry="' + (h * 0.2).toFixed(0) + '" fill="url(#' + id + 'h)"/>';
    }

    // 脸
    body += '<ellipse cx="' + (w * 0.5).toFixed(0) + '" cy="' + (h * 0.44).toFixed(0) + '" rx="' + (w * 0.19).toFixed(0) + '" ry="' + (h * 0.17).toFixed(0) + '" fill="' + skin + '"/>';

    // 前发
    body += '<path d="M' + (w * 0.29).toFixed(0) + " " + (h * 0.4).toFixed(0) + " C " + (w * 0.3).toFixed(0) + " " + (h * 0.22).toFixed(0) +
      ", " + (w * 0.4).toFixed(0) + " " + (h * 0.15).toFixed(0) + ", " + (w * 0.5).toFixed(0) + " " + (h * 0.15).toFixed(0) +
      " C " + (w * 0.6).toFixed(0) + " " + (h * 0.15).toFixed(0) + ", " + (w * 0.7).toFixed(0) + " " + (h * 0.22).toFixed(0) +
      ", " + (w * 0.71).toFixed(0) + " " + (h * 0.4).toFixed(0) +
      " C " + (w * 0.68).toFixed(0) + " " + (h * 0.33).toFixed(0) + ", " + (w * 0.6).toFixed(0) + " " + (h * 0.3).toFixed(0) +
      ", " + (w * 0.56).toFixed(0) + " " + (h * 0.34).toFixed(0) +
      " C " + (w * 0.5).toFixed(0) + " " + (h * 0.26).toFixed(0) + ", " + (w * 0.4).toFixed(0) + " " + (h * 0.28).toFixed(0) +
      ", " + (w * 0.36).toFixed(0) + " " + (h * 0.36).toFixed(0) +
      " C " + (w * 0.33).toFixed(0) + " " + (h * 0.42).toFixed(0) + ", " + (w * 0.31).toFixed(0) + " " + (h * 0.44).toFixed(0) +
      ", " + (w * 0.29).toFixed(0) + " " + (h * 0.4).toFixed(0) + ' Z" fill="url(#' + id + 'h)"/>';
    // 呆毛
    body += '<path d="M' + (w * 0.5).toFixed(0) + " " + (h * 0.15).toFixed(0) + " C " + (w * 0.54).toFixed(0) + " " + (h * 0.06).toFixed(0) +
      ", " + (w * 0.62).toFixed(0) + " " + (h * 0.08).toFixed(0) + ", " + (w * 0.6).toFixed(0) + " " + (h * 0.13).toFixed(0) +
      '" stroke="' + shade(hair, -0.05) + '" stroke-width="4" fill="none" stroke-linecap="round"/>';

    // 眼睛
    const eyeY = h * 0.45;
    [-1, 1].forEach(function (s) {
      const ex = w * 0.5 + s * w * 0.075;
      body += '<ellipse cx="' + ex.toFixed(0) + '" cy="' + eyeY.toFixed(0) + '" rx="' + (w * 0.045).toFixed(1) + '" ry="' + (h * 0.032).toFixed(1) + '" fill="' + eye + '"/>';
      body += '<ellipse cx="' + ex.toFixed(0) + '" cy="' + (eyeY + 3).toFixed(0) + '" rx="' + (w * 0.022).toFixed(1) + '" ry="' + (h * 0.016).toFixed(1) + '" fill="#ffffff" opacity="0.9"/>';
      body += '<path d="M' + (ex - w * 0.055).toFixed(0) + " " + (eyeY - h * 0.035).toFixed(0) + " Q " + ex.toFixed(0) + " " + (eyeY - h * 0.062).toFixed(0) +
        ", " + (ex + w * 0.055).toFixed(0) + " " + (eyeY - h * 0.035).toFixed(0) + '" stroke="' + shade(hair, -0.3) + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
    });
    // 腮红 / 嘴
    body += '<ellipse cx="' + (w * 0.37).toFixed(0) + '" cy="' + (h * 0.5).toFixed(0) + '" rx="' + (w * 0.035).toFixed(0) + '" ry="' + (h * 0.014).toFixed(0) + '" fill="#ff9eb5" opacity="0.55"/>';
    body += '<ellipse cx="' + (w * 0.63).toFixed(0) + '" cy="' + (h * 0.5).toFixed(0) + '" rx="' + (w * 0.035).toFixed(0) + '" ry="' + (h * 0.014).toFixed(0) + '" fill="#ff9eb5" opacity="0.55"/>';
    body += '<path d="M' + (w * 0.47).toFixed(0) + " " + (h * 0.535).toFixed(0) + " Q " + (w * 0.5).toFixed(0) + " " + (h * 0.555).toFixed(0) +
      ", " + (w * 0.53).toFixed(0) + " " + (h * 0.535).toFixed(0) + '" stroke="#c9707e" stroke-width="2.2" fill="none" stroke-linecap="round"/>';

    // 点缀
    body += '<circle cx="' + (w * 0.24).toFixed(0) + '" cy="' + (h * 0.24).toFixed(0) + '" r="2.4" fill="' + pal.a3 + '" opacity="0.9"/>';
    body += '<circle cx="' + (w * 0.78).toFixed(0) + '" cy="' + (h * 0.3).toFixed(0) + '" r="1.8" fill="' + pal.a1 + '" opacity="0.9"/>';
    body += fireflies(r, w, h, 10, pal.a2);

    const svg = (
      '<svg viewBox="0 0 ' + w + " " + h + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
      esc(opts.alt || "角色肖像") + '"><defs>' + defs + "</defs>" + body + "</svg>"
    );
    if (CACHE.size > CACHE_MAX) CACHE.clear();
    CACHE.set(key, svg);
    return svg;
  }

  /* ── 头像（首字 + 渐变） ──────────────────────── */
  function avatar(name, seed) {
    const key = "av|" + (name || "") + "|" + (seed || "");
    if (CACHE.has(key)) return CACHE.get(key);
    const r = rng(seed || name || "guest");
    const pal = PALETTES[pick(r, Object.keys(PALETTES))] || PALETTES.aurora;
    const id = nextId("av");
    const ch = (String(name || "旅").trim()[0] || "旅");
    const svg = (
      '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>' +
      '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + pal.a1 +
      '"/><stop offset="0.55" stop-color="' + pal.a2 + '"/><stop offset="1" stop-color="' + pal.a3 +
      '"/></linearGradient></defs>' +
      '<rect width="80" height="80" fill="url(#' + id + ')"/>' +
      stars(r, 80, 80, 12, ["#ffffff"]) +
      '<text x="40" y="42" text-anchor="middle" dominant-baseline="middle" font-size="34" font-weight="700" fill="#0b1026" font-family="sans-serif">' +
      esc(ch) + "</text></svg>"
    );
    if (CACHE.size > CACHE_MAX) CACHE.clear();
    CACHE.set(key, svg);
    return svg;
  }

  function avatarURI(name, seed) {
    const key = "au|" + (name || "") + "|" + (seed || "");
    if (CACHE.has(key)) return CACHE.get(key);
    const uri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(avatar(name, seed));
    CACHE.set(key, uri);
    return uri;
  }

  global.HS = global.HS || {};
  global.HS.art = {
    scene: scene,
    cover: cover,
    portrait: portrait,
    avatar: avatar,
    avatarURI: avatarURI,
    palettes: Object.keys(PALETTES),
    kinds: SCENES,
    hash: hash,
    rng: rng
  };
})(window);
