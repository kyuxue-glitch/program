/* ══════════════════════════════════════════════════════════════════
   player.js —— 原创生成的氛围音乐引擎
   没有外链音频文件：旋律由 Web Audio 按调式现场合成，
   因此完全原创、可离线、体积为零。也支持播放你自己的音频 URL。
   ══════════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  const SCALES = {
    pentatonic: [0, 2, 4, 7, 9],
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    /* 和风音阶 */
    insen: [0, 1, 5, 7, 8],          // 都节
    hirajoshi: [0, 2, 3, 7, 8],      // 平调子
    yo: [0, 2, 5, 7, 9]              // 阳旋法
  };
  const PROGRESSIONS = {
    pentatonic: [0, 3, 4, 2],
    major: [0, 4, 5, 3],
    minor: [0, 5, 3, 4],
    dorian: [0, 3, 6, 4],
    lydian: [0, 4, 1, 5],
    insen: [0, 3, 5, 1],
    hirajoshi: [0, 4, 2, 5],
    yo: [0, 3, 2, 4]
  };

  const state = {
    index: 0,
    playing: false,
    elapsed: 0,
    duration: 168,
    external: null,
    volume: 45,
    ready: false
  };

  let ctx = null;
  let master = null;
  let analyser = null;
  let wetBus = null;
  let delayBus = null;
  let audioEl = null;
  let mediaSource = null;
  let schedulerId = null;
  let step = 0;
  let nextNoteTime = 0;
  let startedAt = 0;
  let lastElapsed = 0;
  let tracks = [];
  let onState = function () {};
  let seed = 1;
  let rafViz = 0;
  const vizTargets = new Set();

  /* ── 确定性随机（让每首曲子的旋律固定） ───────── */
  function makeRng(s) {
    let a = s >>> 0 || 1;
    return function () {
      a ^= a << 13; a >>>= 0;
      a ^= a >> 17;
      a ^= a << 5; a >>>= 0;
      return a / 4294967296;
    };
  }

  const noteHz = (semi) => 440 * Math.pow(2, (semi - 9) / 12);

  /* ── 音频初始化 ───────────────────────────────── */
  function ensureCtx() {
    if (ctx) return ctx;
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = state.volume / 100 * 0.5;

    analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.78;

    // 简易混响
    const conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c += 1) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < len; i += 1) {
        ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
      }
    }
    conv.buffer = ir;
    wetBus = ctx.createGain();
    wetBus.gain.value = 0.32;
    wetBus.connect(conv);
    conv.connect(master);

    // 延迟
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const damp = ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 2200;
    delayBus = ctx.createGain();
    delayBus.gain.value = 0.3;
    delayBus.connect(delay);
    delay.connect(damp);
    damp.connect(fb);
    fb.connect(delay);
    damp.connect(master);

    master.connect(analyser);
    analyser.connect(ctx.destination);
    state.ready = true;
    return ctx;
  }

  function connectElement() {
    if (!audioEl || !ctx || mediaSource) return;
    try {
      mediaSource = ctx.createMediaElementSource(audioEl);
      mediaSource.connect(master);
    } catch (e) { /* 某些浏览器会重复创建失败，忽略 */ }
  }

  /* ── 音色 ─────────────────────────────────────── */
  function pad(freq, time, dur, gain, type) {
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.Q.value = 0.7;
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = type || "sine";
    o2.type = "triangle";
    o1.frequency.value = freq;
    o2.frequency.value = freq * 1.005;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gain, time + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, time + dur);
    o1.connect(filter);
    o2.connect(filter);
    filter.connect(g);
    g.connect(master);
    g.connect(wetBus);
    o1.start(time);
    o2.start(time);
    o1.stop(time + dur + 0.05);
    o2.stop(time + dur + 0.05);
  }

  function pluck(freq, time, dur, gain, type) {
    const g = ctx.createGain();
    const o = ctx.createOscillator();
    o.type = type || "triangle";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g);
    g.connect(master);
    g.connect(delayBus);
    g.connect(wetBus);
    o.start(time);
    o.stop(time + dur + 0.05);
  }

  function bell(freq, time, gain) {
    [1, 2.01, 2.98].forEach(function (mult, i) {
      const g = ctx.createGain();
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq * mult;
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(gain / (i + 1.4), time + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 2.4 / (i * 0.4 + 1));
      o.connect(g);
      g.connect(wetBus);
      g.connect(master);
      o.start(time);
      o.stop(time + 2.6);
    });
  }

  function noiseHit(time, gain, freq, q) {
    const len = 0.14;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = q || 1.2;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(bp);
    bp.connect(g);
    g.connect(master);
    src.start(time);
  }

  /* ── 和风音色 ─────────────────────────────────── */
  // 十三弦筝：拨弦 + 快速衰减 + 轻微音高下滑
  function koto(freq, time, dur, gain) {
    const g = ctx.createGain();
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const bp = ctx.createBiquadFilter();
    bp.type = "lowpass";
    bp.frequency.value = 4200;
    o1.type = "triangle";
    o2.type = "sine";
    o1.frequency.setValueAtTime(freq * 1.006, time);
    o1.frequency.exponentialRampToValueAtTime(freq, time + 0.22);
    o2.frequency.value = freq * 2.004;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o1.connect(bp);
    o2.connect(bp);
    bp.connect(g);
    g.connect(master);
    g.connect(wetBus);
    g.connect(delayBus);
    o1.start(time); o2.start(time);
    o1.stop(time + dur + 0.05);
    o2.stop(time + dur + 0.05);
    // 指甲触弦的瞬态
    noiseHit(time, gain * 0.28, 2600, 1.6);
  }

  // 尺八：气声长音 + 缓慢颤音
  function shakuhachi(freq, time, dur, gain) {
    const g = ctx.createGain();
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 4.6;
    lfoGain.gain.value = freq * 0.012;
    lfo.connect(lfoGain);
    lfoGain.connect(o.frequency);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1800;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gain * 0.6, time + 0.18);
    g.gain.linearRampToValueAtTime(gain, time + dur * 0.5);
    g.gain.linearRampToValueAtTime(0.0001, time + dur);
    o.connect(filter);
    filter.connect(g);
    g.connect(master);
    g.connect(wetBus);
    o.start(time);
    lfo.start(time);
    o.stop(time + dur + 0.05);
    lfo.stop(time + dur + 0.05);
    // 吹奏气声
    const len = Math.min(0.5, dur);
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) {
      const env = Math.min(1, i / (d.length * 0.25)) * (1 - i / d.length);
      d[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "bandpass";
    hp.frequency.value = freq * 2.2;
    hp.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.value = gain * 0.35;
    src.connect(hp);
    hp.connect(ng);
    ng.connect(master);
    src.start(time);
  }

  // 太鼓
  function taikoHit(time, gain) {
    const g = ctx.createGain();
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(84, time);
    o.frequency.exponentialRampToValueAtTime(44, time + 0.3);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.55);
    o.connect(g);
    g.connect(master);
    o.start(time);
    o.stop(time + 0.6);
    noiseHit(time, gain * 0.4, 420, 0.7);
  }

  function thump(time, gain) {
    const g = ctx.createGain();
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(96, time);
    o.frequency.exponentialRampToValueAtTime(42, time + 0.22);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.4);
    o.connect(g);
    g.connect(master);
    o.start(time);
    o.stop(time + 0.45);
  }

  /* ── 调度器 ───────────────────────────────────── */
  function currentTrack() {
    return tracks[state.index] || { title: "未命名", bpm: 70, scale: "pentatonic" };
  }

  function scheduleStep(time) {
    const tr = currentTrack();
    const bpm = tr.bpm || 70;
    const scale = SCALES[tr.scale] || SCALES.pentatonic;
    const prog = PROGRESSIONS[tr.scale] || PROGRESSIONS.pentatonic;
    const bar = Math.floor(step / 16) % prog.length;
    const root = 45 + prog[bar]; // A2 起
    const r = makeRng(seed + step * 2654435761);
    const inBar = step % 16;

    /* 和风编曲：筝 + 尺八 + 太鼓 */
    if (tr.timbre === "wagakoto") {
      if (inBar === 0) {
        pad(noteHz(root - 12), time, (60 / bpm) * 8, 0.03, "sine");
        if (Math.floor(step / 16) % 2 === 0) taikoHit(time, 0.11);
      }
      if (inBar === 8) taikoHit(time, 0.085);
      if (inBar % 2 === 0) {
        const deg = scale[Math.floor(r() * scale.length)];
        const oct = r() > 0.7 ? 36 : 24;
        koto(noteHz(root + deg + oct), time, 1.3 + r() * 0.9, 0.045 + r() * 0.032);
      }
      if (inBar === 0 && Math.floor(step / 16) % 4 === 0) {
        shakuhachi(noteHz(root + 12 + scale[Math.floor(r() * scale.length)]), time, (60 / bpm) * 6.5, 0.045);
      }
      if (inBar === 0 && r() > 0.55) {
        shakuhachi(noteHz(root + 24), time, (60 / bpm) * 3, 0.022);
      }
      if (r() > 0.95) bell(noteHz(root + 36 + scale[Math.floor(r() * scale.length)]), time, 0.03);
      return;
    }

    // 和声垫（每两小节换一次）
    if (inBar === 0) {
      pad(noteHz(root + 12), time, (60 / bpm) * 8, 0.055, "sine");
      pad(noteHz(root + 19), time, (60 / bpm) * 8, 0.04, "sine");
      if (r() > 0.5) pad(noteHz(root + 24), time, (60 / bpm) * 8, 0.028, "sine");
    }

    // 琶音
    if (inBar % 2 === 0) {
      const deg = scale[Math.floor(r() * scale.length)];
      const oct = r() > 0.72 ? 24 : 12;
      pluck(noteHz(root + deg + oct), time, 0.9 + r() * 0.7, 0.06 + r() * 0.04, r() > 0.6 ? "sine" : "triangle");
    }

    // 铃声（稀疏）
    if (r() > 0.94) {
      const deg = scale[Math.floor(r() * scale.length)];
      bell(noteHz(root + deg + 24), time, 0.05);
    }

    // 节奏（速度快的曲子才有）
    if (bpm >= 76) {
      if (inBar % 8 === 0) thump(time, 0.14);
      if (inBar % 4 === 2) noiseHit(time, 0.035, 6200, 0.9);
    }
  }

  function scheduler() {
    if (!ctx) return;
    const ahead = 0.35;
    const stepDur = 60 / (currentTrack().bpm || 70) / 4;
    while (nextNoteTime < ctx.currentTime + ahead) {
      scheduleStep(nextNoteTime);
      nextNoteTime += stepDur;
      step += 1;
    }
  }

  /* ── 对外控制 ─────────────────────────────────── */
  function setState(patch) {
    Object.assign(state, patch);
    onState(state);
  }

  function startTicking() {
    if (schedulerId) return;
    step = 0;
    nextNoteTime = ctx.currentTime + 0.08;
    startedAt = ctx.currentTime;
    schedulerId = setInterval(scheduler, 40);
    scheduler();
  }

  function stopTicking() {
    clearInterval(schedulerId);
    schedulerId = null;
  }

  function play(index) {
    if (typeof index === "number" && index !== state.index) {
      state.index = ((index % tracks.length) + tracks.length) % tracks.length;
      state.elapsed = 0;
      step = 0;
    }
    // 外部音频优先
    if (state.external && audioEl) {
      ensureCtx();
      connectElement();
      audioEl.play().catch(function () {});
      if (ctx && ctx.state === "suspended") ctx.resume();
      setState({ playing: true });
      startExternalClock();
      return;
    }
    if (!ensureCtx()) {
      onState(Object.assign({}, state, { error: "当前浏览器不支持音频合成" }));
      return;
    }
    if (ctx.state === "suspended") ctx.resume();
    seed = (HS.art ? HS.art.hash(currentTrack().id || currentTrack().title) : 7) || 7;
    state.duration = 150 + (builtinLength(currentTrack()) || 18);
    startTicking();
    startedAt = ctx.currentTime - state.elapsed;
    setState({ playing: true });
  }

  function builtinLength(tr) {
    return (HS.art ? HS.art.hash(tr.title) % 90 : 40);
  }

  function pause() {
    if (audioEl && !audioEl.paused) audioEl.pause();
    stopTicking();
    stopExternalClock();
    if (ctx) state.elapsed = Math.max(0, ctx.currentTime - startedAt);
    setState({ playing: false });
  }

  function toggle() {
    if (state.playing) pause();
    else play();
  }

  function next(dir) {
    const d = dir || 1;
    state.index = ((state.index + d) % tracks.length + tracks.length) % tracks.length;
    state.elapsed = 0;
    step = 0;
    if (state.playing) play();
    else setState({ index: state.index, elapsed: 0 });
  }

  function setVolume(v) {
    state.volume = Math.max(0, Math.min(100, v));
    if (master) master.gain.value = (state.volume / 100) * 0.5;
    onState(state);
  }

  function setExternal(url, title) {
    state.external = url ? { url: url, title: title || "自定义音轨" } : null;
    state.elapsed = 0;
    if (audioEl) {
      if (url) {
        audioEl.src = url;
        audioEl.loop = true;
      } else {
        audioEl.removeAttribute("src");
      }
    }
    onState(state);
  }

  let clockId = null;
  function startExternalClock() {
    if (clockId) return;
    clockId = setInterval(function () {
      if (audioEl && audioEl.duration && isFinite(audioEl.duration)) {
        state.duration = audioEl.duration;
        state.elapsed = audioEl.currentTime;
      }
      onState(state);
    }, 500);
  }
  function stopExternalClock() {
    clearInterval(clockId);
    clockId = null;
  }

  /* ── 可视化 ───────────────────────────────────── */
  function drawViz() {
    rafViz = requestAnimationFrame(drawViz);
    if (!analyser) return;
    const bins = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(bins);
    vizTargets.forEach(function (canvas) {
      const ctx2 = canvas.getContext("2d");
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      if (canvas.width !== Math.floor(w * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2.clearRect(0, 0, w, h);

      const bars = Math.min(bins.length, 42);
      const gap = 2;
      const bw = (w - gap * (bars - 1)) / bars;
      for (let i = 0; i < bars; i += 1) {
        const v = bins[i] / 255;
        const bh = Math.max(2, v * h * (canvas.dataset.mini ? 0.92 : 0.78));
        const x = i * (bw + gap);
        const y = h - bh;
        if (canvas.dataset.mini) {
          ctx2.fillStyle = "rgba(255,255,255," + (0.35 + v * 0.6).toFixed(2) + ")";
          ctx2.beginPath();
          ctx2.roundRect ? ctx2.roundRect(x, y, bw, bh, 2) : ctx2.rect(x, y, bw, bh);
          ctx2.fill();
        } else {
          const grad = ctx2.createLinearGradient(0, h, 0, 0);
          grad.addColorStop(0, "#6fd8ff");
          grad.addColorStop(0.6, "#8b7bf7");
          grad.addColorStop(1, "#ff9ecb");
          ctx2.fillStyle = grad;
          ctx2.globalAlpha = 0.35 + v * 0.65;
          ctx2.beginPath();
          ctx2.roundRect ? ctx2.roundRect(x, y, bw, bh, 3) : ctx2.rect(x, y, bw, bh);
          ctx2.fill();
          ctx2.globalAlpha = 1;
        }
      }
    });
  }

  function attachVisualizer(canvas, mini) {
    if (!canvas) return;
    if (mini) canvas.dataset.mini = "1";
    vizTargets.add(canvas);
    if (!rafViz) drawViz();
    return function detach() {
      vizTargets.delete(canvas);
    };
  }

  function elapsed() {
    if (state.external && audioEl && audioEl.duration) return audioEl.currentTime;
    if (state.playing && ctx) return Math.max(0, ctx.currentTime - startedAt);
    return state.elapsed;
  }

  function tick() {
    const e = elapsed();
    if (state.playing && !state.external && e > state.duration) {
      next(1);
      return;
    }
    onState(state);
  }

  setInterval(tick, 400);

  function init(opts) {
    opts = opts || {};
    audioEl = opts.audioEl || document.getElementById("audio");
    tracks = opts.tracks || [];
    if (typeof opts.onState === "function") onState = opts.onState;
    if (typeof opts.volume === "number") state.volume = opts.volume;
    if (audioEl) {
      audioEl.addEventListener("ended", function () { next(1); });
    }
    return api;
  }

  const api = {
    init: init,
    play: play,
    pause: pause,
    toggle: toggle,
    next: next,
    prev: function () { next(-1); },
    setVolume: setVolume,
    setExternal: setExternal,
    attachVisualizer: attachVisualizer,
    elapsed: elapsed,
    state: state,
    get track() { return currentTrack(); }
  };

  global.HS = global.HS || {};
  global.HS.player = api;
})(window);
