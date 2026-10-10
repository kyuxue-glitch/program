/* ══════════════════════════════════════════════════════════════════
   app.js —— 应用外壳：路由、导航、主题、浮层与全局交互
   ══════════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  const HS = global.HS;
  const store = HS.store;
  const views = HS.views;
  const ui = {};
  const app = {};

  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

  /* ── 路由 ─────────────────────────────────────── */
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, "");
    const qIndex = raw.indexOf("?");
    const path = (qIndex >= 0 ? raw.slice(0, qIndex) : raw) || "home";
    const queryStr = qIndex >= 0 ? raw.slice(qIndex + 1) : "";
    const segs = path.split("/").filter(Boolean);
    const query = {};
    new URLSearchParams(queryStr).forEach((v, k) => { query[k] = v; });
    return { name: segs[0] || "home", id: segs[1] || "", query: query };
  }

  const ROUTE_TITLE = {
    home: ["首页"], articles: ["文章"], article: ["文章", "详情"], moments: ["说说"],
    guestbook: ["杂谈"], photos: ["照片墙"], projects: ["项目"], novels: ["小说"], novel: ["小说", "阅读"],
    favorites: ["收藏"], friends: ["友链"], timeline: ["时间河流"], messages: ["私信"], music: ["音乐"],
    characters: ["角色馆"], lab: ["交互实验"], works: ["访客创作"], apps: ["应用中心"], cinema: ["放映室"],
    search: ["站内搜索"], commands: ["指令大全"], assistant: ["星野助手"], games: ["小游戏"], settings: ["个性设置"],
    profile: ["个人中心"], notfound: ["迷路了"]
  };

  const NAV_ALIAS = { article: "articles", novel: "novels" };

  let cleanup = null;
  let currentCtx = null;

  function render() {
    const ctx = parseHash();
    const name = ROUTE_TITLE[ctx.name] ? ctx.name : "notfound";
    const view = views[name] || views.notfound;
    currentCtx = ctx;

    ui.closeOverlays();
    document.body.dataset.route = name;
    if (typeof cleanup === "function") {
      try { cleanup(); } catch (e) { /* 忽略 */ }
      cleanup = null;
    }

    const host = $("#view");
    host.innerHTML = view.render(ctx) || "";
    host.style.animation = "none";
    void host.offsetWidth;
    host.style.animation = "";

    // 面包屑
    const crumb = ROUTE_TITLE[name] || ["首页"];
    $("#crumbs").innerHTML =
      '<button data-act="go" data-route="#/home">星之轨迹</button>' +
      crumb.map((c, i) => '<i>/</i>' + (i === crumb.length - 1 ? "<b>" + c + "</b>" : "<span>" + c + "</span>")).join("");

    // 导航高亮
    const active = NAV_ALIAS[name] || name;
    $$(".nav-item").forEach((b) => b.classList.toggle("is-active", b.dataset.route === "#/" + active));
    $$(".tabbar button").forEach((b) => b.classList.toggle("is-active", b.dataset.route === "#/" + active));

    // 标题
    document.title = (crumb[crumb.length - 1] || "首页") + " · 星之轨迹";

    if (typeof view.mount === "function") {
      const maybe = view.mount(host, ctx);
      if (typeof maybe === "function") cleanup = maybe;
    }
    ui.observe(host);
    paintStorage();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  app.go = function (hash) {
    if (!hash) return;
    if (!$("#modal").hidden) ui.closeModal();
    if (!$("#palette").hidden) ui.closePalette();
    if (location.hash === hash) render();
    else location.hash = hash;
  };

  app.refresh = function () {
    const ctx = currentCtx || parseHash();
    const name = ROUTE_TITLE[ctx.name] ? ctx.name : "notfound";
    const view = views[name] || views.notfound;
    if (typeof cleanup === "function") { try { cleanup(); } catch (e) {} cleanup = null; }
    const host = $("#view");
    host.innerHTML = view.render(ctx) || "";
    if (typeof view.mount === "function") {
      const maybe = view.mount(host, ctx);
      if (typeof maybe === "function") cleanup = maybe;
    }
    ui.observe(host);
    paintStorage();
    paintNavBadge();
  };

  /* ── 导航渲染 ─────────────────────────────────── */
  function buildNav() {
    const nav = $("#sidebarNav");
    nav.innerHTML = views.NAV.map(function (g) {
      return '<div class="nav-group"><div class="nav-group__title">' + g.title + "</div>" +
        g.items.map(function (it) {
          return '<button class="nav-item" data-act="go" data-route="#/' + it.id + '">' +
            views.icon(it.icon) + "<span>" + it.label + "</span>" +
            (it.badge ? '<i class="nav-item__badge" data-badge="' + it.badge + '" hidden></i>' : "") +
            "</button>";
        }).join("") + "</div>";
    }).join("");

    const tabs = [
      { id: "home", label: "首页", icon: "star" },
      { id: "articles", label: "文章", icon: "edit" },
      { id: "photos", label: "画墙", icon: "eye" },
      { id: "music", label: "音乐", icon: "volume" },
      { id: "profile", label: "我的", icon: "heart" }
    ];
    $("#tabbar").innerHTML = tabs.map(function (t) {
      return '<button data-act="go" data-route="#/' + t.id + '">' + views.icon(t.icon) + "<span>" + t.label + "</span></button>";
    }).join("");
    paintNavBadge();
  }

  function paintNavBadge() {
    const unread = (store.data.messages || []).reduce((n, m) => n + (m.unread || 0), 0);
    $$("[data-badge]").forEach(function (b) {
      b.hidden = !unread;
      b.textContent = unread;
    });
  }

  function paintStorage() {
    const u = store.usage();
    const bar = $("#storageBar");
    const txt = $("#storageText");
    if (bar) bar.style.width = Math.max(3, Math.min(100, u.ratio * 100)).toFixed(1) + "%";
    if (txt) txt.textContent = (u.bytes / 1024).toFixed(1) + " KB";
  }

  /* ── 主题 / 设置 ───────────────────────────────── */
  app.applySettings = function () {
    const s = store.settings;
    document.documentElement.dataset.theme = s.theme;
    document.documentElement.dataset.accent = s.accent;
    document.body.dataset.fx = s.fx ? "on" : "off";
    document.body.dataset.motion = s.motion ? "on" : "off";
    document.body.dataset.perf = s.perf ? "on" : "off";
    document.body.dataset.buddy = s.buddy === false ? "off" : "on";
    document.body.dataset.route = (currentCtx && currentCtx.name) || "home";
    const themeBtn = $("#themeBtn");
    if (themeBtn) themeBtn.innerHTML = '<svg viewBox="0 0 24 24"><use href="#i-' + (s.theme === "dark" ? "moon" : "sun") + '"></use></svg>';
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", s.theme === "dark" ? "#0b1026" : "#eef1ff");
    if (petals) petals.setEnabled(s.petals && s.motion && !s.perf);
    if (stars) { if (s.fx && s.motion && !s.perf) stars.start(); else stars.stop(); }
    if (HS.mousefx) { if (s.fx && s.motion && !s.perf) HS.mousefx.start(); else HS.mousefx.stop(); }
    if (s.volume != null) HS.player.setVolume(s.volume);
    const scale = Number(localStorage.getItem("hoshino.novelScale") || 1);
    document.documentElement.style.setProperty("--reading-scale", scale);
  };

  app.setTheme = function (theme) {
    store.settings.theme = theme;
    store.save(true);
    app.applySettings();
    if (currentCtx && currentCtx.name === "settings") app.refresh();
    ui.toast(theme === "dark" ? "已切换到夜间星空 ☾" : "已切换到晨雾浅色 ☀");
  };

  app.setAccent = function (accent) {
    store.settings.accent = accent;
    store.save(true);
    app.applySettings();
    if (currentCtx && currentCtx.name === "settings") app.refresh();
    ui.toast("强调色已更新 ✦");
  };

  /* ── 账户 ─────────────────────────────────────── */
  app.syncUser = function () {
    const u = store.user;
    const nameEl = $("#userName");
    const roleEl = $("#userRole");
    const avatar = $("#userAvatar");
    if (nameEl) nameEl.textContent = u.name;
    if (roleEl) roleEl.textContent = u.registered ? "已登录" : "游客";
    if (avatar) avatar.innerHTML = HS.art.avatar(u.name, u.seed);
    const buddy = $("#buddyLine");
    if (buddy && !buddy.dataset.touched) buddy.textContent = HS.assistant.greet();
  };

  app.auth = function (kind) {
    if (kind === "guest") {
      ui.modal(
        '<h2>游客模式</h2><p class="modal__sub">给自己取一个临时昵称，随时可以改。</p>' +
        '<form id="guestForm"><label class="field"><span>昵称</span><input class="input" name="name" value="小星星" maxlength="16" required /></label>' +
        '<button class="btn btn--primary btn--block" type="submit">进入星球</button></form>',
        {
          mount(root) {
            root.querySelector("#guestForm").addEventListener("submit", function (e) {
              e.preventDefault();
              const name = new FormData(e.target).get("name").trim() || "小星星";
              store.user.name = name;
              store.user.registered = false;
              store.user.seed = store.uid();
              store.save(true);
              app.syncUser();
              ui.closeModal();
              ui.toast("欢迎你，" + name + " ✦");
              app.refresh();
            });
          }
        }
      );
      return;
    }
    const isReg = kind === "register";
    ui.modal(
      '<h2>' + (isReg ? "创建本地账户" : "欢迎回来") + "</h2>" +
      '<p class="modal__sub">账户与密码只保存在这台设备的浏览器里，不联网、不上传。</p>' +
      '<form id="authForm">' +
      '<label class="field"><span>昵称</span><input class="input" name="name" value="' + views.esc(store.user.name === "游客" ? "" : store.user.name) + '" maxlength="16" required /></label>' +
      '<label class="field"><span>密码（仅本地校验，可以随便填）</span><input class="input" type="password" name="pass" /></label>' +
      '<button class="btn btn--primary btn--block" type="submit">' + (isReg ? "注册并进入" : "登录") + "</button>" +
      '<div class="modal__actions"><button class="btn btn--soft" type="button" data-act="auth" data-kind="guest">游客模式</button>' +
      '<button class="btn btn--ghost" type="button" data-act="auth" data-kind="' + (isReg ? "login" : "register") + '">' +
      (isReg ? "已有账户？登录" : "还没有账户？注册") + "</button></div></form>",
      {
        mount(root) {
          root.querySelector("#authForm").addEventListener("submit", function (e) {
            e.preventDefault();
            const f = new FormData(e.target);
            const name = (f.get("name") || "").trim() || "星空旅人";
            store.user.name = name;
            store.user.pass = simpleHash(String(f.get("pass") || ""));
            store.user.registered = true;
            store.user.seed = store.user.seed || store.uid();
            store.save(true);
            app.syncUser();
            ui.closeModal();
            ui.toast((isReg ? "注册成功，" : "登录成功，") + "欢迎回来 " + name + " ✦");
            app.refresh();
          });
        }
      }
    );
  };

  function simpleHash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i += 1) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return "h" + h.toString(36);
  }

  app.editProfile = function () {
    ui.modal(
      '<h2>编辑资料</h2><p class="modal__sub">这些信息只保存在你的浏览器里。</p>' +
      '<form id="profileForm">' +
      '<label class="field"><span>昵称</span><input class="input" name="name" value="' + views.esc(store.user.name) + '" maxlength="16" /></label>' +
      '<label class="field"><span>签名</span><input class="input" name="bio" value="' + views.esc(store.user.bio || "") + '" maxlength="60" /></label>' +
      '<div class="spread"><span class="muted">头像会随昵称自动生成</span>' +
      '<button class="btn btn--ghost btn--tiny" type="button" data-act="random-avatar">换一个</button></div>' +
      '<button class="btn btn--primary btn--block" type="submit" style="margin-top:16px">保存</button></form>',
      {
        mount(root) {
          root.querySelector("#profileForm").addEventListener("submit", function (e) {
            e.preventDefault();
            const f = new FormData(e.target);
            store.user.name = (f.get("name") || "").trim() || "游客";
            store.user.bio = (f.get("bio") || "").trim();
            store.save(true);
            app.syncUser();
            ui.closeModal();
            ui.toast("资料已更新 ✦");
            app.refresh();
          });
        }
      }
    );
  };

  app.playRandom = function () {
    const n = store.data.tracks.length;
    HS.player.play((Math.random() * n) | 0);
    app.syncPlayer();
    ui.toast("来一首《" + HS.player.track.title + "》 ✦");
  };

  /* ── 创作 ─────────────────────────────────────── */
  app.compose = function () {
    ui.modal(
      '<h2>写点什么</h2><p class="modal__sub">可以写成说说，也可以直接开一篇文章。</p>' +
      '<form id="composeForm">' +
      '<div class="tabs" style="margin-bottom:12px"><button class="tab is-on" type="button" data-mode="moment">说说</button>' +
      '<button class="tab" type="button" data-mode="article">文章</button></div>' +
      '<input class="input" name="title" placeholder="标题（写说说可以留空）" style="margin-bottom:10px" />' +
      '<textarea class="textarea" name="text" placeholder="此刻想说的话…" required></textarea>' +
      '<button class="btn btn--primary btn--block" type="submit" style="margin-top:14px">发布</button></form>',
      {
        mount(root) {
          let mode = "moment";
          root.querySelectorAll("[data-mode]").forEach(function (b) {
            b.addEventListener("click", function () {
              mode = b.dataset.mode;
              root.querySelectorAll("[data-mode]").forEach((x) => x.classList.toggle("is-on", x === b));
            });
          });
          root.querySelector("#composeForm").addEventListener("submit", function (e) {
            e.preventDefault();
            const f = new FormData(e.target);
            const text = String(f.get("text") || "").trim();
            const title = String(f.get("title") || "").trim();
            if (mode === "moment") {
              store.data.moments.unshift({
                id: store.uid(), author: store.user.name, text: text, time: new Date().toISOString(),
                likes: 0, liked: false, tags: ["随笔"]
              });
              store.data.timeline.unshift({ id: store.uid(), time: new Date().toISOString(), text: text.slice(0, 40) });
              store.save(true);
              ui.closeModal();
              ui.toast("说说已发布 ✦");
              app.go("#/moments");
              app.refresh();
            } else {
              const kind = HS.art.kinds[(Math.random() * HS.art.kinds.length) | 0];
              const id = store.uid();
              store.data.articles.unshift({
                id: id, title: title || "无题", tag: "随笔", art: kind,
                palette: HS.art.palettes[(Math.random() * HS.art.palettes.length) | 0],
                date: new Date().toISOString(), likes: 0, views: 0, mood: "平静",
                minutes: Math.max(1, Math.round(text.length / 300)),
                excerpt: text.slice(0, 50).replace(/\n/g, " "), body: text
              });
              store.save(true);
              ui.closeModal();
              ui.toast("文章已创建 ✦");
              app.go("#/article/" + id);
            }
          });
        }
      }
    );
  };

  app.newArticle = function (id) {
    const editing = id ? store.data.articles.find((a) => a.id === id) : null;
    ui.modal(
      '<h2>' + (editing ? "编辑文章" : "新建文章") + '</h2><p class="modal__sub">支持 Markdown 风格：## 标题、&gt; 引用、- 列表、**加粗**</p>' +
      '<form id="articleForm">' +
      '<label class="field"><span>标题</span><input class="input" name="title" value="' + views.esc(editing ? editing.title : "") + '" required /></label>' +
      '<div class="input-row"><label class="field"><span>标签</span><input class="input" name="tag" value="' + views.esc(editing ? editing.tag : "随笔") + '" /></label>' +
      '<label class="field"><span>心情</span><input class="input" name="mood" value="' + views.esc(editing ? editing.mood : "平静") + '" /></label></div>' +
      '<label class="field"><span>正文</span><textarea class="textarea" name="body" style="min-height:220px" required>' + views.esc(editing ? editing.body : "") + "</textarea></label>" +
      '<button class="btn btn--primary btn--block" type="submit">' + (editing ? "保存修改" : "发布文章") + "</button></form>",
      {
        wide: true,
        mount(root) {
          root.querySelector("#articleForm").addEventListener("submit", function (e) {
            e.preventDefault();
            const f = new FormData(e.target);
            const body = String(f.get("body") || "");
            if (editing) {
              editing.title = f.get("title");
              editing.tag = f.get("tag");
              editing.mood = f.get("mood");
              editing.body = body;
              editing.excerpt = body.slice(0, 50).replace(/\n/g, " ");
              ui.toast("已保存修改 ✦");
            } else {
              const nid = store.uid();
              store.data.articles.unshift({
                id: nid, title: f.get("title"), tag: f.get("tag") || "随笔",
                art: HS.art.kinds[(Math.random() * HS.art.kinds.length) | 0],
                palette: HS.art.palettes[(Math.random() * HS.art.palettes.length) | 0],
                date: new Date().toISOString(), likes: 0, views: 0, mood: f.get("mood") || "平静",
                minutes: Math.max(1, Math.round(body.length / 300)),
                excerpt: body.slice(0, 50).replace(/\n/g, " "), body: body
              });
              ui.toast("文章已发布 ✦");
              id = nid;
            }
            store.save(true);
            ui.closeModal();
            app.refresh();
          });
        }
      }
    );
  };

  /* ── 指令 ─────────────────────────────────────── */
  app.runCommand = function (cmd) {
    const c = String(cmd || "").trim();
    switch (c) {
      case "/help": ui.palette("/"); break;
      case "/home": app.go("#/home"); break;
      case "/music": app.go("#/music"); break;
      case "/play": HS.player.toggle(); app.syncPlayer(); ui.toast(HS.player.state.playing ? "开始播放 ▶" : "已暂停 ⏸"); break;
      case "/next": HS.player.next(); app.syncPlayer(); ui.toast("下一首：" + HS.player.track.title); break;
      case "/theme": app.setTheme(store.settings.theme === "dark" ? "light" : "dark"); break;
      case "/accent": {
        const list = ["aurora", "sakura", "ocean", "sunset", "forest"];
        const i = list.indexOf(store.settings.accent);
        app.setAccent(list[(i + 1) % list.length]);
        break;
      }
      case "/fx": {
        store.settings.fx = !store.settings.fx;
        store.save(true);
        app.applySettings();
        ui.toast(store.settings.fx ? "背景特效已开启 ✦" : "背景特效已关闭");
        break;
      }
      case "/me": {
        const u = store.user;
        ui.modal(
          "<h2>当前账户</h2><p class=\"modal__sub\">" + views.esc(u.name) + " · " + (u.registered ? "本地账户" : "游客") + "</p>" +
          '<div class="stat-row"><div class="stat"><b>' + store.data.articles.length + "</b><span>文章</span></div>" +
          '<div class="stat"><b>' + store.data.moments.length + "</b><span>说说</span></div>" +
          '<div class="stat"><b>' + (store.stats.visits || 1) + "</b><span>访问次数</span></div></div>",
          { mount(root) { root.querySelector(".modal__actions") && null; } }
        );
        break;
      }
      case "/export": views.actions["data-export"](); break;
      case "/random": {
        const a = store.data.articles[(Math.random() * store.data.articles.length) | 0];
        if (a) { app.go("#/article/" + a.id); ui.toast("随机打开《" + a.title + "》"); }
        break;
      }
      case "/clear":
        ui.confirm("清空本地数据？", "所有文章、说说、设置都会恢复到示例状态。", function () {
          store.reset();
          app.applySettings();
          app.refresh();
          app.syncUser();
          ui.toast("已恢复初始数据");
        });
        break;
      default:
        if (c.startsWith("/")) ui.toast("没有这条指令，输入 /help 查看全部", "warn");
    }
  };

  /* ══════════════ 通用 UI ══════════════ */
  ui.toast = function (msg, kind) {
    const box = $("#toasts");
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = (kind === "warn" ? "<b>!</b>" : "<b>✦</b>") + "<span>" + views.esc(msg) + "</span>";
    box.appendChild(el);
    setTimeout(function () {
      el.classList.add("is-out");
      setTimeout(() => el.remove(), 340);
    }, 2500);
  };

  ui.modal = function (html, opts) {
    opts = opts || {};
    const card = $("#modalCard");
    card.classList.toggle("modal__card--wide", !!opts.wide);
    $("#modalBody").innerHTML = html;
    const modal = $("#modal");
    modal.hidden = false;
    document.body.classList.add("is-locked");
    if (typeof opts.mount === "function") opts.mount($("#modalBody"), opts);
    const focusable = card.querySelector("input, textarea, select, button");
    if (focusable) setTimeout(() => focusable.focus(), 60);
  };

  ui.closeModal = function () {
    $("#modal").hidden = true;
    $("#modalBody").innerHTML = "";
    if ($("#palette").hidden) document.body.classList.remove("is-locked");
  };

  /* 关闭所有浮层（灯箱 / 模态 / 搜索面板）——切换页面时调用 */
  ui.closeOverlays = function () {
    layerClosers.slice().forEach(function (fn) { try { fn(); } catch (e) { /* 忽略 */ } });
    $$(".lightbox").forEach((el) => el.remove());
    $("#modal").hidden = true;
    $("#modalBody").innerHTML = "";
    $("#palette").hidden = true;
    $("#scrim").hidden = true;
    document.body.classList.remove("is-locked", "is-nav-open");
  };

  ui.confirm = function (title, text, onYes) {
    ui.modal(
      "<h2>" + views.esc(title) + '</h2><p class="modal__sub">' + views.esc(text) + "</p>" +
      '<div class="modal__actions"><button class="btn btn--danger" id="confirmYes">确定</button>' +
      '<button class="btn btn--ghost" id="confirmNo">取消</button></div>',
      {
        mount(root) {
          root.querySelector("#confirmYes").addEventListener("click", function () {
            ui.closeModal();
            if (onYes) onYes();
          });
          root.querySelector("#confirmNo").addEventListener("click", ui.closeModal);
        }
      }
    );
  };

  /* 图片灯箱 */
  const layerClosers = [];

  ui.lightbox = function (list, id) {
    let index = Math.max(0, list.findIndex((p) => p.id === id));
    const layer = document.createElement("div");
    layer.className = "lightbox";
    document.body.appendChild(layer);
    document.body.classList.add("is-locked");

    function paint() {
      const p = list[index];
      layer.innerHTML =
        '<div class="lightbox__top"><span>' + views.esc(p.title) + " · " + views.esc(p.place) + "</span>" +
        '<button class="icon-btn" data-x="close">' + views.icon("close") + "</button></div>" +
        '<div class="lightbox__stage">' + HS.art.scene(p.id + p.kind, { kind: p.kind, palette: p.palette, w: 800, h: 560, alt: p.title }) + "</div>" +
        '<div class="lightbox__bar"><button class="btn btn--soft" data-x="prev">← 上一张</button>' +
        "<span>" + (index + 1) + " / " + list.length + "</span>" +
        '<button class="btn btn--soft" data-x="next">下一张 →</button>' +
        '<button class="btn btn--ghost" data-x="save">下载 SVG</button></div>';
    }
    function close() {
      document.removeEventListener("keydown", onKey);
      layer.remove();
      document.body.classList.remove("is-locked");
      const i = layerClosers.indexOf(close);
      if (i >= 0) layerClosers.splice(i, 1);
    }
    function onKey(e) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") { index = (index + 1) % list.length; paint(); }
      if (e.key === "ArrowLeft") { index = (index - 1 + list.length) % list.length; paint(); }
    }
    layer.addEventListener("click", function (e) {
      const b = e.target.closest("[data-x]");
      if (!b) return;
      const x = b.dataset.x;
      if (x === "close") close();
      if (x === "next") { index = (index + 1) % list.length; paint(); }
      if (x === "prev") { index = (index - 1 + list.length) % list.length; paint(); }
      if (x === "save") {
        const p = list[index];
        const blob = new Blob([HS.art.scene(p.id + p.kind, { kind: p.kind, palette: p.palette, w: 1200, h: 840, alt: p.title })], { type: "image/svg+xml" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "hoshino-" + p.kind + "-" + index + ".svg";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
        ui.toast("插画已下载 ✦");
      }
    });
    document.addEventListener("keydown", onKey);
    layerClosers.push(close);
    paint();
  };

  /* 滚动出现 */
  let io = null;
  ui.observe = function (root) {
    const items = $$(".reveal", root || document);
    if (!("IntersectionObserver" in window) || !store.settings.motion) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("is-in");
            io.unobserve(en.target);
          }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    }
    items.forEach(function (el) {
      if (!el.classList.contains("is-in")) io.observe(el);
    });
  };

  /* ── 命令面板 ─────────────────────────────────── */
  let paletteItems = [];
  let paletteIndex = 0;

  ui.palette = function (preset) {
    const box = $("#palette");
    box.hidden = false;
    document.body.classList.add("is-locked");
    const input = $("#paletteInput");
    input.value = preset || "";
    paintPalette(input.value);
    setTimeout(function () { input.focus(); input.select(); }, 40);
  };

  ui.closePalette = function () {
    $("#palette").hidden = true;
    if ($("#modal").hidden) document.body.classList.remove("is-locked");
  };

  function paintPalette(q) {
    q = String(q || "");
    const list = $("#paletteList");
    paletteItems = [];

    if (q.startsWith("/")) {
      views.COMMANDS.filter((c) => c.cmd.includes(q)).forEach(function (c) {
        paletteItems.push({ icon: "edit", title: c.cmd, sub: c.desc, run: () => app.runCommand(c.cmd) });
      });
      if (!paletteItems.length) {
        views.COMMANDS.forEach(function (c) {
          paletteItems.push({ icon: "edit", title: c.cmd, sub: c.desc, run: () => app.runCommand(c.cmd) });
        });
      }
    } else {
      const groups = views.searchAll(q);
      groups.forEach(function (g) {
        g.items.slice(0, 4).forEach(function (it) {
          paletteItems.push({ icon: "search", title: it.title, sub: g.label + " · " + it.sub, run: () => app.go(it.route) });
        });
      });
      views.NAV.forEach(function (g) {
        g.items.forEach(function (it) {
          if (!q || it.label.includes(q)) paletteItems.push({ icon: it.icon, title: it.label, sub: "前往 " + g.title, run: () => app.go("#/" + it.id) });
        });
      });
      if (q) paletteItems.push({ icon: "search", title: '在站内搜索 "' + q + '"', sub: "查看完整结果", run: () => app.go("#/search?q=" + encodeURIComponent(q)) });
    }

    paletteIndex = 0;
    list.innerHTML = paletteItems.length
      ? paletteItems.map(function (it, i) {
          return '<button class="palette__item' + (i === 0 ? " is-on" : "") + '" data-i="' + i + '">' +
            views.icon(it.icon) + "<span><b>" + views.esc(it.title) + "</b><span>" + views.esc(it.sub || "") + "</span></span>" +
            '<i>↵</i></button>';
        }).join("")
      : '<div class="empty"><b>✦</b>没有找到匹配的内容</div>';
    $("#paletteHint").textContent = q.startsWith("/") ? "指令模式 · 回车执行" : "支持 /help /music /theme 等指令";
  }

  function movePalette(delta) {
    if (!paletteItems.length) return;
    paletteIndex = (paletteIndex + delta + paletteItems.length) % paletteItems.length;
    $$("#paletteList .palette__item").forEach((el, i) => el.classList.toggle("is-on", i === paletteIndex));
    const on = $("#paletteList .palette__item.is-on");
    if (on) on.scrollIntoView({ block: "nearest" });
  }

  /* ── 播放器同步 ───────────────────────────────── */
  app.syncPlayer = function () {
    const p = HS.player.state;
    const t = HS.player.track || {};
    const external = p.external;
    const titleEl = $("#dockTitle");
    const artistEl = $("#dockArtist");
    if (titleEl) titleEl.textContent = external ? external.title : t.title || "未选择曲目";
    if (artistEl) artistEl.textContent = external ? "自定义音轨" : t.artist || "星之轨迹";
    const play = $("#dockPlay");
    if (play) play.innerHTML = '<svg viewBox="0 0 24 24"><use href="#i-' + (p.playing ? "pause" : "play") + '"></use></svg>';
    const e = HS.player.elapsed();
    const prog = $("#dockProgress");
    if (prog) prog.style.width = Math.min(100, (e / (p.duration || 180)) * 100).toFixed(1) + "%";
    const disc = $("#musicDisc");
    if (disc) disc.classList.toggle("is-spinning", !!p.playing);
  };

  /* ── 表单处理 ─────────────────────────────────── */
  document.addEventListener("submit", function (e) {
    const form = e.target.closest("[data-form]");
    if (!form) return;
    e.preventDefault();
    const kind = form.dataset.form;
    const f = new FormData(form);
    const text = String(f.get("text") || "").trim();
    const now = new Date().toISOString();

    if (kind === "comment") {
      if (!text) return;
      const id = form.dataset.id;
      (store.data.comments[id] = store.data.comments[id] || []).push({
        id: store.uid(), name: store.user.name, text: text, time: now
      });
      store.save(true);
      form.reset();
      ui.toast("评论已发布 ✦");
      app.refresh();
      return;
    }
    if (kind === "moment") {
      if (!text) return;
      const tags = String(f.get("tags") || "").split(/\s+/).filter(Boolean).slice(0, 3);
      store.data.moments.unshift({ id: store.uid(), author: store.user.name, text: text, time: now, likes: 0, liked: false, tags: tags });
      store.data.timeline.unshift({ id: store.uid(), time: now, text: text.slice(0, 40) });
      store.save(true);
      form.reset();
      ui.toast("说说已发布 ✦");
      app.refresh();
      return;
    }
    if (kind === "topic") {
      const topic = String(f.get("topic") || "").trim();
      if (!topic) return;
      const extra = String(f.get("text") || "").trim();
      store.data.guestbook.unshift({
        id: store.uid(), topic: topic, author: store.user.name, time: now,
        replies: extra ? [{ id: store.uid(), author: store.user.name, text: extra, time: now }] : []
      });
      store.save(true);
      ui.toast("话题已发布 ✦");
      app.refresh();
      return;
    }
    if (kind === "reply") {
      if (!text) return;
      const topic = store.data.guestbook.find((t) => t.id === form.dataset.id);
      if (topic) topic.replies.push({ id: store.uid(), author: store.user.name, text: text, time: now });
      store.save(true);
      form.reset();
      app.refresh();
      return;
    }
    if (kind === "timeline") {
      if (!text) return;
      const time = String(f.get("time") || "12:00");
      const d = new Date();
      const parts = time.split(":");
      d.setHours(Number(parts[0]) || 0, Number(parts[1]) || 0, 0, 0);
      store.data.timeline.unshift({ id: store.uid(), time: d.toISOString(), text: text });
      store.save(true);
      form.reset();
      ui.toast("已写入时间河流 ✦");
      app.refresh();
      return;
    }
    if (kind === "work") {
      const title = String(f.get("title") || "").trim();
      if (!title || !text) return;
      store.data.works = store.data.works || [];
      store.data.works.unshift({
        id: store.uid(), title: title, text: text, author: store.user.name, time: now,
        kind: f.get("kind") || "space",
        palette: HS.art.palettes[(Math.random() * HS.art.palettes.length) | 0]
      });
      store.save(true);
      ui.toast("作品已发布 ✦");
      app.refresh();
      return;
    }
    if (kind === "video") {
      const title = String(f.get("title") || "").trim();
      const src = String(f.get("src") || "").trim();
      if (!/^https?:\/\//i.test(src)) return ui.toast("请填写 http(s) 开头的地址", "warn");
      store.data.cinema.unshift({ id: store.uid(), title: title, src: src, kind: f.get("kind") || "youtube", desc: "由你添加的视频源。" });
      store.save(true);
      ui.toast("视频源已添加 ✦");
      app.refresh();
      return;
    }
    if (kind === "message") {
      if (!text) return;
      const thread = store.data.messages.find((m) => m.id === form.dataset.id);
      if (!thread) return;
      thread.thread.push({ me: true, text: text, time: now });
      form.reset();
      const log = $("#msgLog");
      if (log) {
        log.insertAdjacentHTML("beforeend", '<div class="bubble bubble--me">' + views.esc(text) + "</div>");
        log.scrollTop = log.scrollHeight;
      }
      store.save(true);
      if (thread.name === "星野") {
        setTimeout(function () {
          const r = HS.assistant.reply(text);
          thread.thread.push({ me: false, text: r, time: new Date().toISOString() });
          store.save(true);
          if (log) {
            log.insertAdjacentHTML("beforeend", '<div class="bubble bubble--them">' + views.esc(r) + "</div>");
            log.scrollTop = log.scrollHeight;
          }
        }, 600);
      } else {
        setTimeout(function () {
          const r = views.esc("收到啦，谢谢你的消息 ✦（这是本地演示回复）");
          thread.thread.push({ me: false, text: r, time: new Date().toISOString() });
          store.save(true);
          const l2 = $("#msgLog");
          if (l2) {
            l2.insertAdjacentHTML("beforeend", '<div class="bubble bubble--them">' + r + "</div>");
            l2.scrollTop = l2.scrollHeight;
          }
        }, 800);
      }
      return;
    }
    if (kind === "assistant") {
      if (!text) return;
      form.reset();
      HS.assistant.ask(text);
      return;
    }
    if (kind === "profile") {
      store.user.name = String(f.get("name") || "").trim() || "游客";
      store.user.bio = String(f.get("bio") || "").trim();
      store.save(true);
      app.syncUser();
      ui.toast("资料已保存 ✦");
      app.refresh();
      return;
    }
  });

  /* ── 全局点击 ─────────────────────────────────── */
  document.addEventListener("click", function (e) {
    const actEl = e.target.closest("[data-act]");
    const closeModalEl = e.target.closest("[data-close-modal]");
    if (closeModalEl) { ui.closeModal(); return; }
    if (!actEl) return;
    const act = actEl.dataset.act;
    const fn = views.actions[act] || ui.actions[act];
    if (global.__hsDebug) console.log("[hs] act=" + act + " target=" + (actEl.className || actEl.tagName));
    if (typeof fn === "function") {
      e.preventDefault();
      fn(actEl, e);
    }
  });

  /* 键盘：Enter 打开卡片 */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      const el = e.target.closest('.card--click[tabindex], .shot[tabindex]');
      if (el && el.dataset.act) {
        e.preventDefault();
        (views.actions[el.dataset.act] || function () {})(el, e);
      }
    }
  });

  ui.actions = {
    "menu-toggle"() {},
    "nav-close"() {},
    "buddy-hide"() {
      const buddy = $("#buddy");
      buddy.classList.add("is-hidden");
      if (!document.getElementById("buddyRestore")) {
        const b = document.createElement("button");
        b.id = "buddyRestore";
        b.className = "buddy__restore";
        b.type = "button";
        b.title = "唤回星野";
        b.setAttribute("aria-label", "唤回星野");
        b.textContent = "✦";
        b.addEventListener("click", function () {
          buddy.classList.remove("is-hidden");
          b.remove();
          ui.toast("星野回来啦 ✦");
        });
        buddy.appendChild(b);
      }
      ui.toast("星野先躲起来了，点 ✦ 就能叫她回来");
    }
  };

  /* ── 顶部 / 悬浮控件 ───────────────────────────── */
  function on(sel, evt, fn) {
    const el = typeof sel === "string" ? $(sel) : sel;
    if (el) el.addEventListener(evt, fn);
    return el;
  }

  function bindChrome() {
    on("#menuBtn", "click", function () {
      document.body.classList.toggle("is-nav-open");
      const open = document.body.classList.contains("is-nav-open");
      $("#scrim").hidden = !open;
    });
    on("#scrim", "click", function () {
      document.body.classList.remove("is-nav-open");
      $("#scrim").hidden = true;
    });

    on("#themeBtn", "click", function () {
      app.setTheme(store.settings.theme === "dark" ? "light" : "dark");
    });

    on("#fxBtn", "click", function () {
      store.settings.fx = !store.settings.fx;
      store.save(true);
      app.applySettings();
      ui.toast(store.settings.fx ? "背景特效已开启 ✦" : "背景特效已关闭");
    });

    const openSearch = function () { ui.palette(); };
    on("#searchBtn", "click", openSearch);
    on("#sidebarSearch", "click", openSearch);

    on("#notifyBtn", "click", function () {
      const list = store.data.notifications;
      ui.modal(
        "<h2>通知中心</h2><p class=\"modal__sub\">共 " + list.length + " 条</p>" +
        '<div class="list">' + (list.length ? list.map(function (n) {
          return '<div class="row"><span class="row__main"><b>' + views.esc(n.text) + "</b><span>" + views.rel(n.time) + "</span></span>" +
            '<button class="btn btn--soft btn--tiny" data-act="go" data-route="' + n.route + '">查看</button></div>';
        }).join("") : '<div class="empty"><b>✦</b>暂时没有新通知</div>') + "</div>",
        { mount() {} }
      );
      list.forEach((n) => { n.read = true; });
      store.save(true);
      $("#notifyDot").hidden = true;
    });

    on("#userBtn", "click", function () {
      const u = store.user;
      ui.modal(
        '<div class="spread" style="justify-content:flex-start;gap:14px;margin-bottom:8px">' +
        '<span class="avatar avatar--lg avatar--ring">' + HS.art.avatar(u.name, u.seed) + "</span>" +
        '<div><h2 style="font-size:20px">' + views.esc(u.name) + "</h2><p class=\"muted\">" +
        (u.registered ? "本地账户" : "游客模式") + "</p></div></div>" +
        '<div class="modal__actions">' +
        (u.registered
          ? '<button class="btn btn--primary" data-act="edit-profile">编辑资料</button>'
          : '<button class="btn btn--primary" data-act="auth" data-kind="login">登录</button>' +
            '<button class="btn btn--soft" data-act="auth" data-kind="register">注册</button>') +
        '<button class="btn btn--soft" data-act="go" data-route="#/profile">个人中心</button>' +
        '<button class="btn btn--ghost" data-act="go" data-route="#/settings">个性设置</button>' +
        (u.registered ? '<button class="btn btn--ghost" id="logoutBtn">退出登录</button>' : "") +
        "</div>",
        {
          mount(root) {
            const out = root.querySelector("#logoutBtn");
            if (out) {
              out.addEventListener("click", function () {
                store.user.name = "游客";
                store.user.bio = "在星海边缘散步的人。";
                store.user.registered = false;
                store.user.pass = "";
                store.user.seed = store.uid();
                store.save(true);
                app.syncUser();
                ui.closeModal();
                ui.toast("已退出登录");
                app.refresh();
              });
            }
          }
        }
      );
    });

    /* 音乐坞 */
    on("#dockPlay", "click", function () {
      HS.player.toggle();
      app.syncPlayer();
    });
    on("#dockNext", "click", function () { HS.player.next(); app.syncPlayer(); });
    on("#dockPrev", "click", function () { HS.player.prev(); app.syncPlayer(); });
    on("#dockToggle", "click", function () {
      $("#dock").classList.toggle("is-open");
    });
    on("#dockVol", "input", function () {
      const v = Number(this.value);
      HS.player.setVolume(v);
      store.settings.volume = v;
      store.save();
    });
    on("#dockSeek", "click", function (e) {
      const audio = document.getElementById("audio");
      if (HS.player.state.external && audio && audio.duration) {
        const rect = this.getBoundingClientRect();
        audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
      }
    });

    /* 陪伴角色 */
    on("#buddyBody", "click", function () {
      if (global.__hsDebug) console.log("[hs] buddy-click");
      const buddy = $("#buddy");
      buddy.classList.add("is-talking");
      setTimeout(() => buddy.classList.remove("is-talking"), 2600);
      if (currentCtx && currentCtx.name === "assistant") {
        const input = $('.chat__form input[name="text"]');
        if (input) input.focus();
      } else {
        app.go("#/assistant");
      }
      HS.assistant.renderLog();
    });
    on("#buddyBody", "keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.click();
      }
    });
    on("#buddyBubble", "click", function () {
      const lines = [
        HS.assistant.greet(),
        "要不要去时间河流写一句话？",
        "今天的插画是我用代码画的哦。",
        "按 Ctrl+K 可以找到星球上的一切。",
        "累的话，就先听一首《星屑のワルツ》吧。"
      ];
      const line = lines[Math.floor(Math.random() * lines.length)];
      const el = $("#buddyLine");
      el.dataset.touched = "1";
      el.textContent = line;
      HS.assistant.ask(line, true);
    });

    /* 模态关闭 */
    on("#modalClose", "click", ui.closeModal);
    on("#paletteList", "click", function (e) {
      const item = e.target.closest(".palette__item");
      if (!item) return;
      const it = paletteItems[Number(item.dataset.i)];
      if (it) { ui.closePalette(); it.run(); }
    });
    on("#paletteInput", "input", function () { paintPalette(this.value); });

    /* 导入文件 */
    document.addEventListener("change", function (e) {
      const input = e.target.closest("#importFile");
      if (!input) return;
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          store.importJSON(String(reader.result));
          app.applySettings();
          app.syncUser();
          app.refresh();
          ui.toast("数据已导入 ✦");
        } catch (err) {
          ui.toast("导入失败：" + err.message, "warn");
        }
      };
      reader.readAsText(file);
      input.value = "";
    });

    /* 快捷键 */
    document.addEventListener("keydown", function (e) {
      const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ui.palette();
        return;
      }
      if (e.key === "Escape") {
        if (!$("#palette").hidden) ui.closePalette();
        else if (!$("#modal").hidden) ui.closeModal();
        else if (document.body.classList.contains("is-nav-open")) {
          document.body.classList.remove("is-nav-open");
          $("#scrim").hidden = true;
        }
        return;
      }
      if ($("#palette").hidden) return;
      if (e.key === "ArrowDown") { e.preventDefault(); movePalette(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); movePalette(-1); }
      else if (e.key === "Enter") {
        e.preventDefault();
        const it = paletteItems[paletteIndex];
        if (it) { ui.closePalette(); it.run(); }
      } else if (e.key === "/" && !inField) {
        ui.palette("/");
      }
    });

    window.addEventListener("hashchange", render);

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) paintClock();
    });
  }

  /* ── 时钟 ─────────────────────────────────────── */
  function paintClock() {
    const d = new Date();
    const time = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") +
      ":" + String(d.getSeconds()).padStart(2, "0");
    const clock = $("#topbarClock");
    if (clock) {
      clock.querySelector("b").textContent = time;
      const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
      clock.querySelector("i").textContent = d.getMonth() + 1 + " 月 " + d.getDate() + " 日 · " + week;
    }
    const foot = $("#footerClock");
    if (foot) foot.textContent = "本地时间 " + time + " · 数据保存在本机";
  }

  /* ── 序章 ─────────────────────────────────────── */
  let stars = null;
  let petals = null;

  function runPrologue() {
    const pro = $("#prologue");
    if (!pro) return;
    const show = store.settings.prologue;
    if (!show || HS.fx.reduceMotion) {
      pro.hidden = true;
      const v0 = $("#prologueVideo");
      if (v0) v0.pause();
      return;
    }
    const video = $("#prologueVideo");
    if (video) {
      video.currentTime = 0;
      video.play().catch(function () { video.style.display = "none"; });
      video.addEventListener("error", function () { video.style.display = "none"; });
    }
    const ctrl = HS.fx.prologue($("#prologueCanvas"), { status: $("#prologueStatus") });
    function leave() {
      ctrl.stop();
      if (video) {
        video.pause();
        setTimeout(function () { video.removeAttribute("src"); video.load(); }, 1200);
      }
      pro.classList.add("is-leaving");
      setTimeout(function () { pro.hidden = true; }, 950);
      store.settings.prologue = false;
      store.save();
      ui.toast("欢迎来到星之轨迹 ✦");
      HS.assistant.renderLog();
    }
    $("#prologueEnter").addEventListener("click", leave);
    $("#prologueSkip").addEventListener("click", leave);
    setTimeout(function () {
      const c = $("#prologueCanvas");
      if (c) c.addEventListener("dblclick", leave);
    }, 200);
  }

  app.replayPrologue = function () {
    const pro = $("#prologue");
    if (!pro) return;
    pro.hidden = false;
    pro.classList.remove("is-leaving");
    store.settings.prologue = true;
    runPrologue();
  };

  /* ── 启动 ─────────────────────────────────────── */
  function boot() {
    store.load();
    global.__hsDebug = /[?&]debug=1/.test(location.search);
    HS.player.init({
      audioEl: $("#audio"),
      tracks: store.data.tracks,
      volume: store.settings.volume,
      onState: function () { app.syncPlayer(); }
    });
    if (store.settings.externalUrl) HS.player.setExternal(store.settings.externalUrl, "自定义音轨");

    buildNav();
    bindChrome();
    // 角色的对话气泡会在 15 秒后自动收起，避免挡住内容；有新的回复时会重新出现
    const isSmall = global.matchMedia("(max-width: 720px)").matches;
    setTimeout(function () {
      const b = $("#buddyBubble");
      if (b && !b.matches(":hover")) b.classList.add("is-muted");
    }, isSmall ? 6000 : 15000);
    app.applySettings();
    app.syncUser();
    paintClock();
    setInterval(paintClock, 1000);

    stars = HS.fx.stars($("#fxStars"));
    petals = HS.fx.petals($("#fxPetals"));
    if (store.settings.fx && store.settings.motion) stars.start();
    petals.setEnabled(store.settings.petals && store.settings.motion);
    petals.start();
    if (HS.mousefx) HS.mousefx.init();

    HS.player.attachVisualizer($("#dockVisual"), true);
    const notifyDot = $("#notifyDot");
    if (notifyDot) notifyDot.hidden = !store.data.notifications.some((n) => !n.read);

    render();
    runPrologue();

    store.onChange(function () { paintStorage(); paintNavBadge(); });

    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(function () { /* 离线缓存可选 */ });
    }
  }

  app.render = render;
  app.currentCtx = function () { return currentCtx; };

  global.HS.ui = ui;
  global.HS.app = app;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
