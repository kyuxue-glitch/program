/* ══════════════════════════════════════════════════════════════════
   views.js —— 页面与交互逻辑
   每个视图 = { title, sub, render(), mount(root) }
   ══════════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  const art = () => global.HS.art;
  const store = () => global.HS.store;
  const player = () => global.HS.player;
  const D = () => store().data;
  const S = () => store().settings;
  const U = () => store().user;

  /* ── 小工具 ───────────────────────────────────── */
  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function rel(iso) {
    const t = new Date(iso).getTime();
    if (!t || isNaN(t)) return "";
    const d = Date.now() - t;
    const min = Math.floor(d / 60000);
    if (min < 1) return "刚刚";
    if (min < 60) return min + " 分钟前";
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + " 小时前";
    const day = Math.floor(hr / 24);
    if (day < 7) return day + " 天前";
    const dt = new Date(iso);
    return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
  }

  function dayLabel(iso) {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    const same = (a, b) => a.toDateString() === b.toDateString();
    if (same(d, today)) return "今天";
    if (same(d, yesterday)) return "昨天";
    const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return d.getFullYear() + " 年 " + (d.getMonth() + 1) + " 月 " + d.getDate() + " 日 · " + week[d.getDay()];
  }

  function hhmm(iso) {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function icon(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  /* 轻量 Markdown 渲染（标题 / 引用 / 列表 / 代码 / 强调） */
  function md(text) {
    const lines = String(text || "").split("\n");
    let out = "";
    let inList = false;
    let inCode = false;
    let buf = [];

    function flush() {
      if (!buf.length) return;
      const para = buf.join("<br>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/`(.+?)`/g, "<code>$1</code>");
      out += "<p>" + para + "</p>";
      buf = [];
    }
    function closeList() {
      if (inList) { out += "</ul>"; inList = false; }
    }

    lines.forEach(function (raw) {
      const line = raw.trim();
      if (line.startsWith("```")) {
        flush();
        closeList();
        if (inCode) { out += "</pre>"; inCode = false; }
        else { out += "<pre>"; inCode = true; }
        return;
      }
      if (inCode) { out += esc(raw) + "\n"; return; }
      if (!line) { flush(); closeList(); return; }
      if (line.startsWith("### ")) { flush(); closeList(); out += "<h3>" + esc(line.slice(4)) + "</h3>"; return; }
      if (line.startsWith("## ")) { flush(); closeList(); out += "<h2>" + esc(line.slice(3)) + "</h2>"; return; }
      if (line.startsWith("> ")) { flush(); closeList(); out += "<blockquote>" + esc(line.slice(2)) + "</blockquote>"; return; }
      if (line.startsWith("- ")) {
        flush();
        if (!inList) { out += "<ul>"; inList = true; }
        out += "<li>" + esc(line.slice(2)) + "</li>";
        return;
      }
      closeList();
      buf.push(esc(line));
    });
    flush();
    closeList();
    if (inCode) out += "</pre>";
    return out;
  }

  /* ── 导航结构 ─────────────────────────────────── */
  const NAV = [
    { title: "我的星球", items: [
      { id: "home", label: "首页", icon: "star" },
      { id: "timeline", label: "时间河流", icon: "clock" },
      { id: "moments", label: "说说", icon: "sparkle" },
      { id: "articles", label: "文章", icon: "edit" }
    ] },
    { title: "创作", items: [
      { id: "novels", label: "小说", icon: "star" },
      { id: "works", label: "访客创作", icon: "edit" },
      { id: "projects", label: "项目", icon: "drag" },
      { id: "photos", label: "照片墙", icon: "eye" }
    ] },
    { title: "收藏夹", items: [
      { id: "favorites", label: "收藏", icon: "heart" },
      { id: "characters", label: "角色馆", icon: "sparkle" },
      { id: "music", label: "音乐", icon: "volume" },
      { id: "cinema", label: "放映室", icon: "play" }
    ] },
    { title: "互动", items: [
      { id: "guestbook", label: "杂谈", icon: "link" },
      { id: "messages", label: "私信", icon: "bell", badge: "unread" },
      { id: "friends", label: "友链", icon: "link" },
      { id: "lab", label: "交互实验", icon: "sparkle" },
      { id: "games", label: "小游戏", icon: "play" },
      { id: "apps", label: "应用中心", icon: "drag" }
    ] },
    { title: "系统", items: [
      { id: "search", label: "站内搜索", icon: "search" },
      { id: "commands", label: "指令大全", icon: "edit" },
      { id: "assistant", label: "星野助手", icon: "sparkle" },
      { id: "settings", label: "个性设置", icon: "menu" }
    ] }
  ];

  /* ── 卡片构件 ─────────────────────────────────── */
  function articleCard(a) {
    return (
      '<article class="card card--click reveal" data-act="open-article" data-id="' + a.id + '" tabindex="0">' +
      '<div class="card__thumb">' + art().cover(a.id + a.tag, { kind: a.art, palette: a.palette, alt: a.title }) +
      '<span class="card__badge">' + esc(a.tag) + "</span></div>" +
      '<div class="card__body"><h3 class="card__title">' + esc(a.title) + "</h3>" +
      '<p class="card__desc">' + esc(a.excerpt) + "</p>" +
      '<div class="card__meta"><span>' + icon("eye") + a.views + '</span><span>' + icon("heart") + a.likes +
      '</span><span>' + rel(a.date) + "</span></div></div></article>"
    );
  }

  function trackRow(t, i, playing) {
    const on = playing && player().state.index === i && !player().state.external;
    return (
      '<button class="track' + (on ? " is-on" : "") + '" data-act="play-track" data-id="' + i + '">' +
      '<span class="track__art">' + (on ? "♫" : i + 1) + "</span>" +
      '<span class="track__main"><b>' + esc(t.title) + "</b><span>" + esc(t.artist) + "</span></span>" +
      (on ? '<span class="track__bars"><i></i><i></i><i></i><i></i></span>' : '<span class="track__time">' + (t.bpm || 70) + " BPM</span>") +
      "</button>"
    );
  }

  /* ══════════════ 首页 ══════════════ */
  const home = {
    title: "首页",
    sub: "关于这个星球的一切",
    render() {
      const d = D();
      const u = U();
      const hour = new Date().getHours();
      const greet = hour < 5 ? "夜深了" : hour < 11 ? "早上好" : hour < 14 ? "午安" : hour < 18 ? "下午好" : hour < 23 ? "晚上好" : "夜深了";
      const featured = d.articles.slice(0, 6);
      const acts = d.moments.slice(0, 4);
      const visits = store().stats.visits || 1;

      const heat = Array.from({ length: 98 }, function (_, i) {
        const lv = (i * 7 + (store().stats.visits || 3)) % 5;
        return '<i data-lv="' + (i % 13 === 0 ? 4 : lv) + '"></i>';
      }).join("");

      return (
        '<section class="hero">' +
        '<div class="hero__art" aria-hidden="true"></div><div class="hero__shade"></div>' +
        '<div class="hero__clock"><b id="heroTime">--:--</b><span id="heroDate">星之轨迹</span>' +
        '<span class="hero__greet">' + greet + "，" + esc(u.name) + "</span></div>" +
        '<div class="hero__copy">' +
        '<p class="hero__eyebrow">✦ HOSHINO PORTAL · 一个属于你的小宇宙</p>' +
        "<h1>让热爱，<span>成为生活的底色</span></h1>" +
        '<p class="hero__sub">写下想说的话，收藏喜欢的人与故事，把每一个普通的日子，慢慢拼成只属于你的星之轨迹。</p>' +
        '<div class="hero__actions">' +
        '<button class="btn btn--primary" data-act="go" data-route="#/articles">开始逛逛 ' + icon("star") + "</button>" +
        '<button class="btn btn--soft" data-act="compose">写点什么</button>' +
        '<button class="btn btn--ghost" data-act="play-random">随机一首 ' + icon("volume") + "</button>" +
        "</div>" +
        '<div class="hero__tags"><span class="chip">✦ 纯静态 · 零依赖</span><span class="chip">✦ 数据只存在本地</span>' +
        '<span class="chip">✦ 原创 svg 插画</span><span class="chip">✦ 已访问 ' + visits + " 次</span></div>" +
        "</div></section>" +

        '<section class="welcome">' +
        '<span class="avatar avatar--lg avatar--ring">' + art().avatar(u.name, u.seed) + "</span>" +
        '<div class="welcome__text"><b>' + (u.registered ? "欢迎回来，" + esc(u.name) : "你好，陌生旅人") + "</b>" +
        "<span>" + esc(u.bio || "这里是一个属于你的二次元小宇宙。") + "</span></div>" +
        '<div class="welcome__actions">' +
        (u.registered
          ? '<button class="btn btn--soft" data-act="go" data-route="#/profile">个人中心</button><button class="btn btn--ghost" data-act="edit-profile">编辑资料</button>'
          : '<button class="btn btn--primary" data-act="auth" data-kind="login">登录</button>' +
            '<button class="btn btn--soft" data-act="auth" data-kind="register">注册</button>' +
            '<button class="btn btn--ghost" data-act="auth" data-kind="guest">游客模式</button>') +
        "</div></section>" +

        '<div class="split" style="margin-top:18px">' +
        '<div class="stack">' +
        '<section class="section"><div class="section__head"><div><h2>今日精选</h2><p>一些适合今天打开的东西</p></div>' +
        '<div class="tabs" data-act="home-tabs"><button class="tab is-on" data-tab="hot">热门</button>' +
        '<button class="tab" data-tab="new">最新</button><button class="tab" data-tab="random">随机</button></div></div>' +
        '<div class="grid grid--3" id="featuredGrid">' + featured.slice(0, 3).map(articleCard).join("") + "</div></section>" +

        '<section class="section"><div class="section__head"><div><h2>最新动态</h2><p>星球上的新鲜事</p></div>' +
        '<button class="panel__link" data-act="compose">＋ 写点什么</button></div>' +
        '<div class="panel"><div class="list" id="activityList">' +
        acts.map(function (m) {
          return '<div class="row"><span class="avatar avatar--sm">' + art().avatar(m.author, m.id) + "</span>" +
            '<span class="row__main"><b>' + esc(m.author) + "</b><span>" + esc(m.text.split("\n")[0].slice(0, 42)) + "</span></span>" +
            '<span class="row__side">' + rel(m.time) + "</span></div>";
        }).join("") +
        "</div></div></section>" +

        '<section class="section"><div class="section__head"><div><h2>创作足迹</h2><p>最近 14 周的记录密度</p></div>' +
        '<span class="muted">共 ' + (d.articles.length + d.moments.length + d.timeline.length) + " 条记录</span></div>" +
        '<div class="panel"><div class="heat">' + heat + "</div>" +
        '<div class="stat-row" style="margin-top:16px">' +
        '<div class="stat"><b>' + d.articles.length + "</b><span>篇文章</span></div>" +
        '<div class="stat"><b>' + d.moments.length + "</b><span>条说说</span></div>" +
        '<div class="stat"><b>' + d.photos.length + "</b><span>张画</span></div>" +
        '<div class="stat"><b>' + d.timeline.length + "</b><span>个瞬间</span></div>" +
        "</div></div></section>" +
        "</div>" +

        '<aside class="stack">' +
        '<section class="panel widget"><div class="panel__head"><h3>推荐音乐</h3>' +
        '<button class="panel__link" data-act="go" data-route="#/music">全部 ›</button></div>' +
        d.tracks.slice(0, 4).map((t, i) => trackRow(t, i, true)).join("") +
        '<p class="muted" style="margin-top:10px">这些旋律由 Web Audio 现场合成，完全原创。</p></section>' +

        '<section class="panel widget"><div class="panel__head"><h3>热门标签</h3></div><div class="chip-row">' +
        ["二次元", "动漫", "音乐", "旅行", "生活", "游戏", "原创", "技术"].map(function (t) {
          return '<span class="chip" data-act="tag-search" data-tag="' + t + '"># ' + t + "</span>";
        }).join("") + "</div></section>" +

        '<section class="panel widget"><div class="panel__head"><h3>时间河流</h3>' +
        '<button class="panel__link" data-act="go" data-route="#/timeline">查看 ›</button></div>' +
        '<div class="mini-tl">' + d.timeline.slice(0, 5).map(function (t) {
          return '<div class="mini-tl__row"><b>' + hhmm(t.time) + "</b><span>" + esc(t.text) + "</span></div>";
        }).join("") + "</div></section>" +

        '<section class="quote-card"><p>“世界上没有绝对的黑暗，只有还没被发现的光。”</p>' +
        "<span>—— 写给此刻正在看这句话的你</span></section>" +
        "</aside></div>"
      );
    },
    mount(root) {
      const time = root.querySelector("#heroTime");
      const date = root.querySelector("#heroDate");
      const paint = function () {
        const d = new Date();
        if (time) time.textContent = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
        if (date) date.textContent = dayLabel(d.toISOString());
      };
      paint();
      clearInterval(home._timer);
      home._timer = setInterval(paint, 15000);
    }
  };

  /* ══════════════ 文章列表 ══════════════ */
  const articles = {
    title: "文章",
    sub: "写下真正值得留下来的东西",
    render(ctx) {
      const list = D().articles;
      const tag = (ctx.query && ctx.query.tag) || "全部";
      const tags = ["全部"].concat([...new Set(list.map((a) => a.tag))]);
      const shown = tag === "全部" ? list : list.filter((a) => a.tag === tag);
      return (
        '<div class="section__head"><div><h2>全部文章</h2><p>共 ' + list.length + " 篇 · 全部保存在你的浏览器里</p></div>" +
        '<div class="section__tools"><div class="input-row" style="width:240px">' +
        '<input class="input" id="articleSearch" placeholder="搜索标题 / 标签…" /></div>' +
        '<button class="btn btn--primary" data-act="new-article">＋ 新建文章</button></div></div>' +
        '<div class="chip-row" style="margin-bottom:16px">' + tags.map(function (t) {
          return '<span class="chip' + (t === tag ? " is-on" : "") + '" data-act="filter-articles" data-tag="' + t + '">' + t + "</span>";
        }).join("") + "</div>" +
        '<div class="grid grid--3" id="articleGrid">' + shown.map(articleCard).join("") + "</div>" +
        (shown.length ? "" : '<div class="empty"><b>✦</b>没有符合条件的文章</div>')
      );
    },
    mount(root, ctx) {
      const input = root.querySelector("#articleSearch");
      const grid = root.querySelector("#articleGrid");
      if (input && grid) {
        input.addEventListener("input", function () {
          const q = input.value.trim().toLowerCase();
          const hit = D().articles.filter(function (a) {
            return !q || a.title.toLowerCase().includes(q) || a.tag.toLowerCase().includes(q);
          });
          grid.innerHTML = hit.map(articleCard).join("") || '<div class="empty"><b>✦</b>没有找到匹配的文章</div>';
          global.HS.ui.observe(root);
        });
      }
    }
  };

  /* ══════════════ 文章详情 ══════════════ */
  const article = {
    hidden: true,
    title: "文章详情",
    render(ctx) {
      const a = D().articles.find((x) => x.id === ctx.id);
      if (!a) return global.HS.views.notfound.render(ctx);
      const comments = D().comments[a.id] || [];
      const liked = store().stats.liked.includes(a.id);
      return (
        '<div class="reader">' +
        '<button class="btn btn--ghost btn--tiny" data-act="back" style="margin-bottom:16px">← 返回文章列表</button>' +
        '<div class="reader__head"><span class="chip chip--solid">' + esc(a.tag) + "</span>" +
        "<h1 style=\"margin-top:12px\">" + esc(a.title) + "</h1>" +
        '<div class="reader__meta"><span>' + icon("clock") + rel(a.date) + "</span>" +
        "<span>" + icon("eye") + a.views + " 次阅读</span>" +
        "<span>约 " + a.minutes + " 分钟</span>" +
        "<span>心情：" + esc(a.mood) + "</span></div></div>" +
        '<div class="reader__body prose">' + md(a.body) + "</div>" +
        '<div class="reader__foot">' +
        '<button class="icon-action' + (liked ? " is-on" : "") + '" data-act="like-article" data-id="' + a.id + '">' +
        icon("heart") + (liked ? "已喜欢 " : "喜欢 ") + (a.likes + (liked ? 1 : 0)) + "</button>" +
        '<button class="icon-action" data-act="edit-article" data-id="' + a.id + '">' + icon("edit") + "编辑</button>" +
        '<button class="icon-action" data-act="delete-article" data-id="' + a.id + '">' + icon("trash") + "删除</button>" +
        '<button class="icon-action" data-act="copy-link" data-id="' + a.id + '">' + icon("link") + "复制链接</button>" +
        "</div>" +
        '<div class="divider"></div>' +
        '<div class="section__head"><div><h2>评论 (' + comments.length + ")</h2></div></div>" +
        '<div class="panel">' +
        (comments.length
          ? comments.map(function (c) {
              return '<div class="comment"><span class="avatar avatar--sm">' + art().avatar(c.name, c.id) + "</span>" +
                '<div class="comment__main"><b>' + esc(c.name) + "</b><p>" + esc(c.text) + "</p><time>" + rel(c.time) + "</time></div></div>";
            }).join("")
          : '<div class="empty"><b>✦</b>还没有评论，做第一个说话的人吧</div>') +
        '<form data-form="comment" data-id="' + a.id + '" style="margin-top:16px">' +
        '<div class="input-row"><input class="input" name="text" placeholder="说点什么…" required maxlength="200" />' +
        '<button class="btn btn--primary" type="submit" style="flex:0 0 auto">发表评论</button></div></form></div>' +
        "</div>"
      );
    },
    mount(root) {
      const bar = document.createElement("div");
      bar.className = "readbar";
      bar.id = "readbar";
      document.body.appendChild(bar);
      const onScroll = function () {
        const h = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0) + "%";
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
      return function cleanup() {
        window.removeEventListener("scroll", onScroll);
        bar.remove();
      };
    }
  };

  /* ══════════════ 说说 ══════════════ */
  const moments = {
    title: "说说",
    sub: "一句话也可以装下一整天",
    render() {
      const list = D().moments;
      return (
        '<div class="split">' +
        '<div class="stack">' +
        '<section class="panel"><div class="panel__head"><h3>今天想说点什么？</h3>' +
        '<span class="muted">支持换行 · 数据只在本机</span></div>' +
        '<form data-form="moment"><textarea class="textarea" name="text" maxlength="500" placeholder="记录此刻的心情、想法或一句话…" required></textarea>' +
        '<div class="input-row" style="margin-top:12px">' +
        '<input class="input" name="tags" placeholder="话题标签，用空格分隔（可留空）" style="min-width:180px" />' +
        '<button class="btn btn--primary" type="submit" style="flex:0 0 auto">发布说说</button></div></form></section>' +
        '<div class="stack" id="momentList">' + list.map(momentCard).join("") + "</div>" +
        "</div>" +
        '<aside class="stack">' +
        '<section class="panel"><div class="panel__head"><h3>说说统计</h3></div>' +
        '<div class="stat-row"><div class="stat"><b>' + list.length + "</b><span>条说说</span></div>" +
        '<div class="stat"><b>' + list.reduce((s, m) => s + m.likes, 0) + "</b><span>累计喜欢</span></div></div></section>" +
        '<section class="panel"><div class="panel__head"><h3>常用话题</h3></div><div class="chip-row">' +
        [...new Set(list.flatMap((m) => m.tags || []))].map(function (t) {
          return '<span class="chip" data-act="tag-search" data-tag="' + t + '"># ' + t + "</span>";
        }).join("") + "</div></section>" +
        '<section class="quote-card"><p>“把琐碎的日子写下来，它们就不再消失了。”</p><span>—— 星之轨迹 · 说说区</span></section>' +
        "</aside></div>"
      );
    }
  };

  function momentCard(m) {
    const liked = store().stats.liked.includes(m.id);
    return (
      '<article class="moment reveal"><div class="moment__head">' +
      '<span class="avatar">' + art().avatar(m.author, m.id) + "</span>" +
      '<span class="moment__who"><b>' + esc(m.author) + "</b><time>" + rel(m.time) + "</time></span>" +
      (m.tags || []).map((t) => '<span class="chip" style="margin-left:auto">#' + esc(t) + "</span>").join("") +
      "</div>" +
      '<div class="moment__text">' + esc(m.text) + "</div>" +
      '<div class="moment__actions">' +
      '<button class="icon-action' + (liked ? " is-on" : "") + '" data-act="like-moment" data-id="' + m.id + '">' +
      icon("heart") + (m.likes + (liked ? 1 : 0)) + "</button>" +
      '<button class="icon-action" data-act="copy-text" data-id="' + m.id + '">' + icon("link") + "复制</button>" +
      '<button class="icon-action" data-act="delete-moment" data-id="' + m.id + '" style="margin-left:auto">' + icon("trash") + "删除</button>" +
      "</div></article>"
    );
  }

  /* ══════════════ 杂谈 / 留言板 ══════════════ */
  const guestbook = {
    title: "杂谈",
    sub: "随便聊点什么，来都来了",
    render() {
      const list = D().guestbook;
      return (
        '<div class="split">' +
        '<div class="stack">' +
        '<section class="panel"><div class="panel__head"><h3>开一个新话题</h3><span class="muted">游客也可以发言</span></div>' +
        '<form data-form="topic"><input class="input" name="topic" placeholder="话题标题，例如：有没有一首歌一听前奏就想哭？" required />' +
        '<div class="input-row" style="margin-top:10px"><input class="input" name="text" placeholder="补充说明（可留空）" />' +
        '<button class="btn btn--primary" type="submit" style="flex:0 0 auto">发布话题</button></div></form></section>' +
        '<div class="stack" id="topicList">' + list.map(topicCard).join("") + "</div>" +
        "</div>" +
        '<aside class="stack">' +
        '<section class="panel"><div class="panel__head"><h3>杂谈守则</h3></div>' +
        '<div class="prose" style="font-size:13.5px">' +
        "<p>1. 这里没有算法，只有人。</p><p>2. 观点可以不同，语气尽量温柔。</p>" +
        "<p>3. 所有内容都存在你自己的浏览器里，是真正的“自言自语”。</p></div></section>" +
        '<section class="quote-card"><p>“来都来了，留下点什么再走吧。”</p><span>—— 星之轨迹 · 杂谈区</span></section>' +
        "</aside></div>"
      );
    }
  };

  function topicCard(t) {
    return (
      '<article class="topic reveal" id="topic-' + t.id + '">' +
      '<div class="topic__head"><span class="avatar avatar--sm">' + art().avatar(t.author, t.id) + "</span>" +
      "<b>" + esc(t.topic) + "</b><span class=\"muted\" style=\"margin-left:auto\">" + rel(t.time) + " · " + t.replies.length + " 回复</span></div>" +
      (t.replies.length
        ? '<div style="margin-top:6px">' + t.replies.map(function (rp) {
            return '<div class="reply"><span class="avatar avatar--sm">' + art().avatar(rp.author, rp.id) + "</span>" +
              "<span><b>" + esc(rp.author) + "</b>：" + esc(rp.text) + " <span class=\"muted\">" + rel(rp.time) + "</span></span></div>";
          }).join("") + "</div>"
        : '<p class="muted" style="margin-top:4px">还没有人回复，说点什么吧。</p>') +
      '<form data-form="reply" data-id="' + t.id + '" style="margin-top:10px">' +
      '<div class="input-row"><input class="input" name="text" placeholder="回复这个话题…" required />' +
      '<button class="btn btn--soft" type="submit" style="flex:0 0 auto">回复</button>' +
      '<button class="btn btn--ghost" type="button" data-act="delete-topic" data-id="' + t.id + '" style="flex:0 0 auto">删除</button></div></form>' +
      "</article>"
    );
  }

  /* ══════════════ 照片墙 ══════════════ */
  function shotHTML(p) {
    return '<figure class="shot' + (p.tall ? " shot--tall" : "") + ' reveal" data-act="open-photo" data-id="' + p.id + '" tabindex="0">' +
      art().scene(p.id + p.kind, { kind: p.kind, palette: p.palette, alt: p.title }) +
      '<figcaption class="shot__label">' + esc(p.title) + "<span>" + esc(p.place) + " · " + rel(p.time) + "</span></figcaption></figure>";
  }

  const photos = {
    title: "照片墙",
    sub: "这些画全部由代码现场绘制",
    render(ctx) {
      const all = D().photos;
      const kind = (ctx.query && ctx.query.kind) || "全部";
      const kinds = ["全部"].concat([...new Set(all.map((p) => p.kind))]);
      const shown = kind === "全部" ? all : all.filter((p) => p.kind === kind);
      const PAGE = 6;
      photos._rest = shown.slice(PAGE);
      return (
        '<div class="section__head"><div><h2>画与光</h2><p>共 ' + all.length + " 张 · 程序化生成，可随主题变色</p></div>" +
        '<div class="section__tools"><button class="btn btn--soft" data-act="new-photo">＋ 生成一张新画</button>' +
        '<button class="btn btn--ghost" data-act="play-random">配一首歌</button></div></div>' +
        '<div class="chip-row" style="margin-bottom:16px">' + kinds.map(function (k) {
          return '<span class="chip' + (k === kind ? " is-on" : "") + '" data-act="filter-photos" data-kind="' + k + '">' +
            (k === "全部" ? "全部" : sceneName(k)) + "</span>";
        }).join("") + "</div>" +
        '<div class="gallery" id="gallery">' + shown.slice(0, PAGE).map(shotHTML).join("") + "</div>" +
        (photos._rest.length
          ? '<div class="load-more"><button class="btn btn--soft" type="button" data-act="gallery-more">显示更多画作（还有 ' +
            photos._rest.length + " 张）</button></div>"
          : "")
      );
    }
  };

  /* ══════════════ 项目 ══════════════ */
  const projects = {
    title: "项目",
    sub: "正在做的、做完的、想做的",
    render() {
      const list = D().projects;
      return (
        '<div class="section__head"><div><h2>项目清单</h2><p>共 ' + list.length + " 个</p></div>" +
        '<button class="btn btn--primary" data-act="new-project">＋ 新建项目</button></div>' +
        '<div class="grid grid--2">' + list.map(function (p) {
          return '<article class="card reveal"><div class="card__thumb">' +
            art().cover(p.id + p.name, { kind: "space", palette: "aurora", alt: p.name }) + "</div>" +
            '<div class="card__body"><div class="spread"><h3 class="card__title">' + esc(p.name) + "</h3>" +
            '<span class="chip">' + esc(p.status) + "</span></div>" +
            '<p class="card__desc">' + esc(p.desc) + "</p>" +
            '<div class="progress"><i style="width:' + p.progress + '%"></i></div>' +
            '<div class="card__meta"><span>' + p.progress + '% 完成</span><span>' +
            (p.tags || []).map((t) => "#" + esc(t)).join(" ") + "</span></div>" +
            '<div class="input-row" style="margin-top:10px">' +
            '<button class="btn btn--soft btn--tiny" data-act="bump-project" data-id="' + p.id + '">进度 +10%</button>' +
            '<button class="btn btn--ghost btn--tiny" data-act="delete-project" data-id="' + p.id + '">删除</button>' +
            "</div></div></article>";
        }).join("") + "</div>"
      );
    }
  };

  /* ══════════════ 小说 ══════════════ */
  const novels = {
    title: "小说",
    sub: "连载、短篇与未完待续",
    render() {
      const list = D().novels;
      return (
        '<div class="section__head"><div><h2>书架</h2><p>共 ' + list.length + " 部作品</p></div>" +
        '<button class="btn btn--primary" data-act="new-novel">＋ 新建作品</button></div>' +
        '<div class="grid grid--3">' + list.map(function (n) {
          return '<article class="card card--click reveal" data-act="open-novel" data-id="' + n.id + '">' +
            '<div class="card__thumb">' + art().cover(n.id + n.title, { kind: n.art, palette: n.palette, alt: n.title }) + "</div>" +
            '<div class="card__body"><h3 class="card__title">' + esc(n.title) + "</h3>" +
            '<div class="card__meta"><span class="chip">' + esc(n.tag) + "</span><span>" +
            n.chapters.length + " 章 · " + (n.words / 1000).toFixed(1) + "k 字</span></div></div></article>";
        }).join("") + "</div>"
      );
    }
  };

  const novel = {
    hidden: true,
    title: "阅读",
    render(ctx) {
      const n = D().novels.find((x) => x.id === ctx.id);
      if (!n) return global.HS.views.notfound.render(ctx);
      const idx = Math.min(n.chapters.length - 1, Math.max(0, Number(ctx.query && ctx.query.ch) || 0));
      const ch = n.chapters[idx];
      return (
        '<div class="reader">' +
        '<button class="btn btn--ghost btn--tiny" data-act="back" style="margin-bottom:16px">← 返回书架</button>' +
        '<div class="reader__head"><span class="chip chip--solid">' + esc(n.tag) + "</span>" +
        "<h1 style=\"margin-top:12px\">" + esc(n.title) + "</h1>" +
        '<div class="reader__meta"><span>' + icon("star") + "第 " + (idx + 1) + " / " + n.chapters.length + " 章</span>" +
        "<span>" + icon("clock") + "全书约 " + (n.words / 1000).toFixed(1) + "k 字</span></div></div>" +
        '<div class="reader__body"><h2 style="margin-top:0">' + esc(ch.title) + "</h2>" +
        '<div class="prose" id="novelText" style="font-size:calc(15px * var(--reading-scale,1))">' +
        esc(ch.text).split("\n").map((p) => (p.trim() ? "<p>" + p + "</p>" : "")).join("") + "</div></div>" +
        '<div class="reader__foot">' +
        '<button class="btn btn--soft" data-act="novel-chapter" data-id="' + n.id + '" data-ch="' + (idx - 1) + '"' + (idx === 0 ? " disabled" : "") + ">上一章</button>" +
        '<button class="btn btn--primary" data-act="novel-chapter" data-id="' + n.id + '" data-ch="' + (idx + 1) + '"' + (idx >= n.chapters.length - 1 ? " disabled" : "") + ">下一章</button>" +
        '<span class="muted" style="margin-left:auto">字号</span>' +
        '<button class="btn btn--ghost btn--tiny" data-act="novel-font" data-delta="-0.1">A－</button>' +
        '<button class="btn btn--ghost btn--tiny" data-act="novel-font" data-delta="0.1">A＋</button>' +
        "</div></div>"
      );
    },
    mount(root) {
      const saved = Number(localStorage.getItem("hoshino.novelScale") || 1);
      document.documentElement.style.setProperty("--reading-scale", saved);
    }
  };

  /* ══════════════ 收藏 ══════════════ */
  const favorites = {
    title: "收藏",
    sub: "把喜欢的东西放在这里",
    render(ctx) {
      const list = D().favorites;
      const kind = (ctx.query && ctx.query.kind) || "全部";
      const kinds = ["全部"].concat([...new Set(list.map((f) => f.kind))]);
      const shown = kind === "全部" ? list : list.filter((f) => f.kind === kind);
      return (
        '<div class="section__head"><div><h2>收藏夹</h2><p>共 ' + list.length + " 项</p></div>" +
        '<button class="btn btn--primary" data-act="new-favorite">＋ 添加收藏</button></div>' +
        '<div class="chip-row" style="margin-bottom:16px">' + kinds.map(function (k) {
          return '<span class="chip' + (k === kind ? " is-on" : "") + '" data-act="filter-favorites" data-kind="' + k + '">' + k + "</span>";
        }).join("") + "</div>" +
        '<div class="grid grid--3">' + shown.map(function (f) {
          return '<article class="card reveal"><div class="card__thumb" style="aspect-ratio:16/7">' +
            art().cover(f.id + f.title, { kind: "space", palette: "aurora", alt: f.title }) + "</div>" +
            '<div class="card__body"><div class="spread"><h3 class="card__title">' + esc(f.title) + "</h3>" +
            '<span class="chip">' + esc(f.kind) + "</span></div>" +
            '<p class="card__desc">' + esc(f.note) + "</p>" +
            '<div class="card__meta"><span>收藏于 ' + rel(store().daysAgo(3)) + "</span>" +
            '<button class="icon-action" data-act="delete-favorite" data-id="' + f.id + '">' + icon("trash") + "移除</button></div>" +
            "</div></article>";
        }).join("") + "</div>"
      );
    }
  };

  /* ══════════════ 友链 ══════════════ */
  const friends = {
    title: "友链",
    sub: "来自不同角落的星光",
    render() {
      const list = D().friends;
      return (
        '<div class="section__head"><div><h2>友情链接</h2><p>共 ' + list.length + " 位邻居</p></div>" +
        '<button class="btn btn--primary" data-act="new-friend">＋ 添加友链</button></div>' +
        '<div class="grid grid--3">' + list.map(function (f) {
          return '<a class="card card--click reveal" href="' + esc(f.url) + '" target="_blank" rel="noreferrer noopener">' +
            '<div class="card__thumb" style="aspect-ratio:16/7">' + art().cover(f.id + f.name, { kind: "space", palette: "ocean", alt: f.name }) + "</div>" +
            '<div class="card__body"><div class="spread"><h3 class="card__title">' + f.emoji + " " + esc(f.name) + "</h3>" +
            '<button class="icon-action" data-act="delete-friend" data-id="' + f.id + '" title="移除">' + icon("trash") + "</button></div>" +
            '<p class="card__desc">' + esc(f.desc) + "</p>" +
            '<div class="card__meta"><span>' + esc(f.url.replace(/^https?:\/\//, "")) + "</span><span>访问 ↗</span></div>" +
            "</div></a>";
        }).join("") + "</div>"
      );
    }
  };

  /* ══════════════ 时间河流 ══════════════ */
  const timeline = {
    title: "时间河流",
    sub: "记录每个值得记住的瞬间",
    render() {
      const list = D().timeline.slice().sort((a, b) => new Date(b.time) - new Date(a.time));
      const groups = {};
      list.forEach(function (t) {
        const key = new Date(t.time).toDateString();
        (groups[key] = groups[key] || []).push(t);
      });
      return (
        '<div class="split">' +
        '<div class="stack">' +
        (Object.keys(groups).map(function (key) {
          return '<section class="panel"><div class="tl__day">' + dayLabel(groups[key][0].time) + "</div>" +
            '<div class="tl">' + groups[key].map(function (t) {
              return '<div class="tl__item"><div class="tl__time">' + hhmm(t.time) + "</div>" +
                '<div class="tl__body">' + esc(t.text) +
                ' <button class="icon-action" data-act="delete-timeline" data-id="' + t.id + '" style="float:right">' + icon("trash") + "</button></div></div>";
            }).join("") + "</div></section>";
        }).join("") || '<div class="empty"><b>✦</b>河流还没有开始流动</div>') +
        "</div>" +
        '<aside class="stack">' +
        '<section class="panel"><div class="panel__head"><h3>记录一个瞬间</h3></div>' +
        '<form data-form="timeline"><input class="input" type="time" name="time" value="' + new Date().toTimeString().slice(0, 5) + '" style="margin-bottom:10px" />' +
        '<textarea class="textarea" name="text" placeholder="此刻发生了什么？" required style="min-height:80px"></textarea>' +
        '<button class="btn btn--primary btn--block" type="submit" style="margin-top:10px">写入河流</button></form></section>' +
        '<section class="panel"><div class="panel__head"><h3>本周概览</h3></div>' +
        '<div class="stat-row"><div class="stat"><b>' + list.length + "</b><span>条记录</span></div>" +
        '<div class="stat"><b>' + Object.keys(groups).length + "</b><span>个日子</span></div></div></section>" +
        "</aside></div>"
      );
    }
  };

  /* ══════════════ 私信 ══════════════ */
  const messages = {
    title: "私信",
    sub: "消息只保存在你自己的浏览器里",
    render(ctx) {
      const list = D().messages;
      const active = list.find((m) => m.id === (ctx.query && ctx.query.id)) || list[0];
      if (active) active.unread = 0;
      return (
        '<div class="assistant-layout">' +
        '<div class="threads stack">' + list.map(function (m) {
          return '<button class="thread' + (active && m.id === active.id ? " is-on" : "") + '" data-act="open-thread" data-id="' + m.id + '">' +
            '<span class="avatar avatar--sm">' + art().avatar(m.name, m.id) + "</span>" +
            '<span class="thread__main"><b>' + esc(m.name) + "</b><span>" +
            esc(m.thread[m.thread.length - 1].text.slice(0, 20)) + "</span></span>" +
            (m.unread ? '<span class="nav-item__badge">' + m.unread + "</span>" : "") + "</button>";
        }).join("") + "</div>" +
        '<div class="chat">' +
        '<div class="chat__log" id="msgLog">' + (active ? active.thread.map(function (t) {
          return '<div class="bubble bubble--' + (t.me ? "me" : "them") + '">' + esc(t.text) + "</div>";
        }).join("") : "") + "</div>" +
        '<form class="chat__form" data-form="message" data-id="' + (active ? active.id : "") + '">' +
        '<input class="input" name="text" placeholder="输入消息…" autocomplete="off" required />' +
        '<button class="btn btn--primary" type="submit">发送</button></form>' +
        "</div></div>"
      );
    },
    mount(root) {
      const log = root.querySelector("#msgLog");
      if (log) log.scrollTop = log.scrollHeight;
    }
  };

  /* ══════════════ 音乐 ══════════════ */
  const music = {
    title: "音乐",
    sub: "全部由代码现场合成，完全原创",
    render() {
      const tracks = D().tracks;
      const p = player().state;
      const t = tracks[p.index] || tracks[0];
      const scale = S().fontScale;
      return (
        '<div class="split split--wide">' +
        '<section class="stack">' +
        '<div class="music__now">' +
        '<div class="music__disc' + (p.playing ? " is-spinning" : "") + '" id="musicDisc"><canvas id="musicVizDisc" style="width:100%;height:100%;border-radius:50%"></canvas></div>' +
        "<h2>" + esc(p.external ? p.external.title : t.title) + "</h2>" +
        '<p class="muted">' + (p.external ? "自定义音轨 · 来自你的音频链接" : esc(t.artist)) + "</p>" +
        '<canvas class="music__viz" id="musicViz"></canvas>' +
        '<div class="input-row" style="margin-top:14px;justify-content:center">' +
        '<button class="btn btn--soft" data-act="music-prev">' + icon("prev") + "上一首</button>" +
        '<button class="btn btn--primary" data-act="music-toggle">' + (p.playing ? "暂停" : "播放") + "</button>" +
        '<button class="btn btn--soft" data-act="music-next">下一首 ' + icon("next") + "</button></div>" +
        '<p class="music__hint">播放器使用 Web Audio 实时合成：和声垫 + 琶音 + 稀疏铃声，每首曲子的调式与速度都不同。</p>' +
        "</div>" +
        '<section class="panel"><div class="panel__head"><h3>曲目列表</h3>' +
        '<span class="muted">原创生成音轨 ' + tracks.length + " 首</span></div>" +
        tracks.map((tt, i) => trackRow(tt, i, true)).join("") + "</section>" +
        "</section>" +
        '<aside class="stack">' +
        '<section class="panel"><div class="panel__head"><h3>音量</h3><span class="muted" id="volText">' + Math.round(S().volume) + "%</span></div>" +
        '<input type="range" id="musicVol" min="0" max="100" value="' + S().volume + '" />' +
        '<div class="switch" style="margin-top:12px"><span class="switch__text"><b>播放自定义音轨</b><i>填入 MP3 / OGG / M4A 直链即可播放</i></span></div>' +
        '<input class="input" id="externalUrl" placeholder="https://…/your-track.mp3" style="margin-top:8px" />' +
        '<div class="input-row" style="margin-top:10px"><button class="btn btn--soft" data-act="music-external">载入链接</button>' +
        '<button class="btn btn--ghost" data-act="music-clear-external">恢复默认</button></div></section>' +
        '<section class="panel"><div class="panel__head"><h3>说明</h3></div>' +
        '<p class="muted">本站不引用任何第三方音频，因此不存在版权风险。你也可以把自己的音频放在同一目录下，再填入相对路径。</p></section>' +
        "</aside></div>"
      );
    },
    mount(root) {
      const viz = root.querySelector("#musicViz");
      const disc = root.querySelector("#musicVizDisc");
      if (viz) player().attachVisualizer(viz, false);
      if (disc) player().attachVisualizer(disc, true);
      const vol = root.querySelector("#musicVol");
      if (vol) {
        vol.addEventListener("input", function () {
          player().setVolume(Number(vol.value));
          store().settings.volume = Number(vol.value);
          store().save();
          const txt = root.querySelector("#volText");
          if (txt) txt.textContent = vol.value + "%";
        });
      }
    }
  };

  /* ══════════════ 角色馆 ══════════════ */
  const characters = {
    title: "角色馆",
    sub: "自创角色的档案与名台词",
    render() {
      const list = D().characters;
      return (
        '<div class="section__head"><div><h2>角色档案</h2><p>共 ' + list.length + " 位角色 · 肖像由代码生成</p></div>" +
        '<button class="btn btn--primary" data-act="new-character">＋ 新建角色</button></div>' +
        '<div class="grid grid--4">' + list.map(function (c, i) {
          return '<article class="card reveal"><div class="char__portrait">' +
            art().portrait(c.id + c.name, { palette: c.palette, alt: c.name }) + "</div>" +
            '<div class="card__body"><div class="spread"><h3 class="card__title">' + esc(c.name) + "</h3>" +
            '<span class="chip">' + esc(c.tag) + "</span></div>" +
            '<p class="card__desc">「' + esc(c.quote) + "」</p>" +
            '<div class="char__attrs">' +
            attrBar("力量", c.power) + attrBar("共情", c.empathy) + attrBar("勇气", c.courage) +
            "</div>" +
            '<div class="card__meta"><span>性格：' + esc(c.tone) + "</span>" +
            '<button class="icon-action" data-act="char-detail" data-id="' + c.id + '">' + icon("eye") + "档案</button></div>" +
            "</div></article>";
        }).join("") + "</div>"
      );
    }
  };

  function attrBar(label, v) {
    return '<div class="char__attr"><span>' + label + "</span><span class=\"progress\"><i style=\"width:" + v + '%"></i></span><b>' + v + "</b></div>";
  }

  /* ══════════════ 交互实验 ══════════════ */
  const lab = {
    title: "交互实验",
    sub: "一些没什么用但很好玩的东西",
    render() {
      const r = art().rng(String(new Date().toDateString()));
      const quotes = [
        "今天也要把普通日子过得闪闪发光。",
        "你不需要成为谁，你只需要继续走。",
        "雨停之后，路面会替你记住天空。",
        "慢一点也没关系，反正星星一直在。",
        "把想做的事写在纸上，它就有了重量。",
        "所有的笨拙，都是认真过的证据。"
      ];
      const quote = quotes[Math.floor(r() * quotes.length)];
      return (
        '<div class="grid grid--2">' +
        '<section class="panel"><div class="panel__head"><h3>星光画布</h3><span class="muted">点击任意位置</span></div>' +
        '<div class="lab__stage" id="labStage"><canvas id="labCanvas"></canvas></div>' +
        '<div class="input-row" style="margin-top:12px">' +
        '<button class="btn btn--soft" data-act="lab-burst">来一场流星雨</button>' +
        '<button class="btn btn--ghost" data-act="lab-clear">清空画布</button></div></section>' +

        '<section class="panel"><div class="panel__head"><h3>灵感胶囊</h3></div>' +
        '<p class="prose" id="labQuote" style="font-size:16px;min-height:70px">「 ' + esc(quote) + ' 」</p>' +
        '<div class="input-row" style="margin-top:10px"><button class="btn btn--primary" data-act="lab-quote">再来一句</button>' +
        '<button class="btn btn--ghost" data-act="lab-copy-quote">复制</button></div></section>' +

        '<section class="panel"><div class="panel__head"><h3>配色实验室</h3><span class="muted">点击色块复制</span></div>' +
        '<div class="swatches" id="labPalette"></div>' +
        '<button class="btn btn--soft" data-act="lab-palette" style="margin-top:12px">换一组配色</button></section>' +

        '<section class="panel"><div class="panel__head"><h3>今日运程</h3><span class="muted">按日期计算，每天不同</span></div>' +
        '<div id="labFortune" class="prose" style="font-size:14.5px"></div>' +
        '<button class="btn btn--ghost" data-act="lab-fortune" style="margin-top:10px">重新解读</button></section>' +
        "</div>"
      );
    },
    mount(root) {
      const canvas = root.querySelector("#labCanvas");
      const stage = root.querySelector("#labStage");
      if (!canvas || !stage) return;
      const ctx = canvas.getContext("2d");
      let parts = [];
      let raf = 0;

      function fit() {
        const dpr = Math.min(devicePixelRatio || 1, 2);
        const rect = stage.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { w: rect.width, h: rect.height };
      }
      let size = fit();
      window.addEventListener("resize", function () { size = fit(); }, { passive: true });

      function spawn(x, y, n) {
        for (let i = 0; i < (n || 26); i += 1) {
          const a = Math.random() * Math.PI * 2;
          const sp = Math.random() * 2.6 + 0.4;
          parts.push({
            x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 1, r: Math.random() * 2 + 0.8,
            color: ["#6fd8ff", "#8b7bf7", "#ff9ecb", "#ffe6a8"][(Math.random() * 4) | 0]
          });
        }
      }

      function loop() {
        raf = requestAnimationFrame(loop);
        ctx.clearRect(0, 0, size.w, size.h);
        for (let i = parts.length - 1; i >= 0; i -= 1) {
          const p = parts[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.015;
          p.vx *= 0.985;
          p.vy *= 0.985;
          p.life -= 0.008;
          if (p.life <= 0) { parts.splice(i, 1); continue; }
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      loop();

      stage.addEventListener("pointerdown", function (e) {
        const rect = stage.getBoundingClientRect();
        spawn(e.clientX - rect.left, e.clientY - rect.top, 30);
      });
      stage.addEventListener("pointermove", function (e) {
        if (e.buttons) {
          const rect = stage.getBoundingClientRect();
          spawn(e.clientX - rect.left, e.clientY - rect.top, 6);
        }
      });

      lab._api = {
        burst() {
          for (let i = 0; i < 6; i += 1) {
            setTimeout(function () { spawn(Math.random() * size.w, Math.random() * size.h * 0.5, 30); }, i * 120);
          }
        },
        clear() { parts = []; ctx.clearRect(0, 0, size.w, size.h); },
        stop() { cancelAnimationFrame(raf); }
      };
      lab.renderPalette(root);
      lab.renderFortune(root);
    },
    renderPalette(root) {
      const box = root.querySelector("#labPalette");
      if (!box) return;
      const r = art().rng(String(Math.random()));
      const base = Math.floor(r() * 360);
      const colors = [0, 32, 74, 168, 232].map(function (off) {
        const h = (base + off) % 360;
        const s = 62 + Math.floor(r() * 24);
        const l = 52 + Math.floor(r() * 18);
        return hslToHex(h, s, l);
      });
      box.innerHTML = colors.map(function (c) {
        return '<div class="swatch" data-act="lab-copy-color" data-color="' + c + '"><i style="background:' + c + '"></i><span>' + c + "</span></div>";
      }).join("");
    },
    renderFortune(root) {
      const box = root.querySelector("#labFortune");
      if (!box) return;
      const seed = new Date().toDateString();
      const r = art().rng(seed);
      const luck = ["大吉", "中吉", "小吉", "吉", "末吉"][Math.floor(r() * 5)];
      const colors = ["深蓝", "樱粉", "极光青", "落日橙", "夜紫"];
      const items = ["一杯热牛奶", "一首循环的老歌", "一条没走过的路", "把手机放远十分钟", "给很久没联系的人发条消息"];
      const numbers = Math.floor(r() * 99) + 1;
      box.innerHTML =
        "<p><b>运势：</b>" + luck + "　<b>幸运色：</b>" + colors[Math.floor(r() * colors.length)] +
        "　<b>幸运数字：</b>" + numbers + "</p>" +
        "<p><b>今日建议：</b>" + items[Math.floor(r() * items.length)] + "</p>" +
        "<p class=\"muted\">（完全由日期计算，纯属娱乐）</p>";
    }
  };

  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, "0");
    return "#" + toHex(f(0)) + toHex(f(8)) + toHex(f(4));
  }

  /* ══════════════ 访客创作 ══════════════ */
  const works = {
    title: "访客创作",
    sub: "在这里写下你的东西，它会留在这台设备上",
    render() {
      const list = D().works || [];
      return (
        '<div class="split">' +
        '<div class="stack">' +
        (list.length
          ? list.map(function (w) {
              return '<article class="card reveal"><div class="card__thumb" style="aspect-ratio:16/6">' +
                art().cover(w.id + w.title, { kind: w.kind, palette: w.palette, alt: w.title }) + "</div>" +
                '<div class="card__body"><div class="spread"><h3 class="card__title">' + esc(w.title) + "</h3>" +
                '<span class="muted">' + rel(w.time) + "</span></div>" +
                '<div class="prose" style="font-size:14px">' + md(w.text) + "</div>" +
                '<div class="card__meta"><span>由 ' + esc(w.author) + " 创作</span>" +
                '<button class="icon-action" data-act="delete-work" data-id="' + w.id + '">' + icon("trash") + "删除</button></div></div></article>";
            }).join("")
          : '<div class="empty"><b>✦</b>还没有作品，写第一篇吧</div>') +
        "</div>" +
        '<aside class="stack">' +
        '<section class="panel"><div class="panel__head"><h3>写下你的创作</h3></div>' +
        '<form data-form="work">' +
        '<input class="input" name="title" placeholder="标题" required style="margin-bottom:10px" />' +
        '<textarea class="textarea" name="text" placeholder="正文，支持 Markdown 风格的标题与引用…" required></textarea>' +
        '<label class="field" style="margin-top:10px"><span>插画风格</span>' +
        '<select class="select" name="kind">' + art().kinds.map((k) => '<option value="' + k + '">' + sceneName(k) + "</option>").join("") + "</select></label>" +
        '<button class="btn btn--primary btn--block" type="submit">发布作品</button></form></section>' +
        '<section class="quote-card"><p>“内容只保存在你的浏览器里，你可以随时导出成 JSON。”</p><span>—— 星之轨迹</span></section>' +
        "</aside></div>"
      );
    }
  };

  function sceneName(k) {
    return { city: "城市夜景", sea: "海边日落", torii: "鸟居雪景", mountain: "云海山脊", forest: "萤火森林",
      rain: "雨夜霓虹", aurora: "极光湖面", sakura: "樱花小路", cafe: "窗边咖啡", space: "深空星海" }[k] || k;
  }

  /* ══════════════ 应用中心 ══════════════ */
  const games = {
    title: "小游戏",
    sub: "在星球上玩一会儿",
    render(ctx) {
      const list = [
        { id: "catch", name: "星屑接接乐", icon: "✦", tag: "反应", desc: "接住星屑，躲开陨石" },
        { id: "memory", name: "记忆星图", icon: "◈", tag: "记忆", desc: "找出成对的星图" },
        { id: "dodge", name: "弹幕躲避", icon: "✧", tag: "生存", desc: "坚持 30 秒穿越流星雨" },
        { id: "rhythm", name: "星轨节拍", icon: "♫", tag: "节奏", desc: "跟着节拍点亮轨道" }
      ];
      const active = list.find((g) => g.id === ctx.id) || list[0];
      const scores = (store().data.games) || {};
      return (
        '<div class="section__head"><div><h2>小游戏</h2><p>全部离线运行 · 支持鼠标 / 触摸 / 键盘</p></div>' +
        '<span class="muted">' + list.length + " 个小游戏</span></div>" +
        '<div class="chip-row" style="margin-bottom:14px">' + list.map(function (g) {
          return '<button class="chip' + (g.id === active.id ? " is-on" : "") + '" data-act="open-game" data-id="' + g.id + '">' +
            g.icon + " " + g.name + " · " + g.tag + "</button>";
        }).join("") + "</div>" +
        '<div class="game-wrap">' +
        '<div class="panel game-panel">' +
        '<div class="panel__head"><h3>' + active.icon + " " + active.name + "</h3>" +
        '<span class="muted">' + active.desc + "</span></div>" +
        '<div id="gameStage"></div>' +
        "</div>" +
        '<aside class="stack">' +
        '<section class="panel"><div class="panel__head"><h3>排行榜（本地）</h3></div>' +
        '<div class="list">' + list.map(function (g) {
          const rec = scores[g.id];
          return '<div class="row"><span class="track__art">' + g.icon + "</span>" +
            '<span class="row__main"><b>' + g.name + "</b><span>" + g.tag + "</span></span>" +
            '<span class="row__side">' + (rec ? rec.best + " 分" : "—") + "</span></div>";
        }).join("") + "</div></section>" +
        '<section class="panel"><div class="panel__head"><h3>操作</h3></div>' +
        '<div class="prose" style="font-size:13px"><p>鼠标 / 手指：拖动或点击</p><p>键盘：方向键、A / S / K / L</p>' +
        "<p>所有分数只保存在你的浏览器里。</p></div></section>" +
        "</aside></div>"
      );
    },
    mount(root, ctx) {
      const host = root.querySelector("#gameStage");
      if (!host) return;
      const id = ctx.id || "catch";
      let disposed = false;
      let cleanup = null;
      const boot = function () {
        if (disposed || !global.HS.games) return;
        cleanup = global.HS.games.mount(host, id);
      };
      if (global.HS.games) boot();
      else {
        host.innerHTML = '<div class="game-loading"><span></span>正在加载游戏模块…</div>';
        const s = document.createElement("script");
        s.src = "js/games.js?v=2.0.4";
        s.onload = boot;
        s.onerror = function () {
          host.innerHTML = '<div class="empty"><b>✦</b>游戏模块加载失败，请刷新后再试</div>';
        };
        document.head.appendChild(s);
      }
      return function () {
        disposed = true;
        if (typeof cleanup === "function") cleanup();
      };
    }
  };

  const apps = {
    title: "应用中心",
    sub: "把常用的小工具收纳起来",
    render() {
      return (
        '<div class="section__head"><div><h2>小工具</h2><p>全部在本地运行，不发送任何请求</p></div></div>' +
        '<div class="grid grid--3">' + D().apps.map(function (a) {
          return '<button class="card card--click reveal" data-act="open-app" data-id="' + a.id + '" style="text-align:left">' +
            '<div class="card__body"><div style="font-size:30px">' + a.icon + "</div>" +
            '<h3 class="card__title">' + esc(a.name) + "</h3>" +
            '<p class="card__desc">' + esc(a.desc) + "</p>" +
            '<div class="card__meta"><span>打开工具</span><span>→</span></div></div></button>';
        }).join("") + "</div>"
      );
    }
  };

  const TOOLS = {
    calc: {
      title: "计算器",
      render() {
        return '<h2>计算器</h2><p class="modal__sub">支持 + － × ÷ 与括号</p><div class="calc">' +
          '<div class="calc__screen"><b id="calcOut">0</b><span id="calcExpr">就绪</span></div>' +
          '<div class="calc__keys">' +
          ["C", "(", ")", "÷", "7", "8", "9", "×", "4", "5", "6", "－", "1", "2", "3", "＋", "0", ".", "←", "="]
            .map(function (k) {
              const op = ["÷", "×", "－", "＋"].includes(k);
              return '<button data-k="' + k + '" class="' + (op ? "is-op" : "") + (k === "=" ? " is-eq" : "") + '">' + k + "</button>";
            }).join("") + "</div></div>";
      },
      mount(root) {
        let expr = "";
        const out = root.querySelector("#calcOut");
        const ex = root.querySelector("#calcExpr");
        function paint() {
          out.textContent = expr || "0";
          ex.textContent = expr ? "运算中…" : "就绪";
        }
        root.querySelectorAll("[data-k]").forEach(function (b) {
          b.addEventListener("click", function () {
            const k = b.dataset.k;
            if (k === "C") expr = "";
            else if (k === "←") expr = expr.slice(0, -1);
            else if (k === "=") {
              const safe = expr.replace(/÷/g, "/").replace(/×/g, "*").replace(/－/g, "-").replace(/＋/g, "+");
              if (/^[0-9+\-*/().\s]+$/.test(safe) && safe.trim()) {
                try {
                  const v = Function('"use strict";return (' + safe + ")")();
                  ex.textContent = expr + " =";
                  expr = String(Number.isFinite(v) ? Math.round(v * 1e10) / 1e10 : "错误");
                  out.textContent = expr;
                  return;
                } catch (err) { ex.textContent = "表达式有误"; return; }
              }
              ex.textContent = "无法计算";
              return;
            } else expr += k;
            paint();
          });
        });
        paint();
      }
    },
    timer: {
      title: "番茄钟",
      render() {
        return '<h2>番茄钟</h2><p class="modal__sub">25 分钟专注 · 5 分钟休息</p>' +
          '<div class="timer"><div class="timer__ring">' +
          '<svg viewBox="0 0 120 120"><defs><linearGradient id="timerGrad" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#6fd8ff"/><stop offset="1" stop-color="#8b7bf7"/></linearGradient></defs>' +
          '<circle class="bg" cx="60" cy="60" r="52"/><circle class="fg" id="timerFg" cx="60" cy="60" r="52" stroke-dasharray="327" stroke-dashoffset="0"/></svg>' +
          '<div class="timer__time" id="timerTime">25:00</div></div>' +
          '<div class="input-row" style="justify-content:center">' +
          '<button class="btn btn--primary" id="timerStart">开始</button>' +
          '<button class="btn btn--soft" id="timerReset">重置</button>' +
          '<button class="btn btn--ghost" id="timerMode">切换到休息</button></div></div>';
      },
      mount(root) {
        let total = 25 * 60;
        let left = total;
        let id = null;
        let rest = false;
        const timeEl = root.querySelector("#timerTime");
        const ring = root.querySelector("#timerFg");
        const startBtn = root.querySelector("#timerStart");
        function paint() {
          timeEl.textContent = String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0");
          ring.setAttribute("stroke-dashoffset", String(327 * (1 - left / total)));
        }
        function tick() {
          if (left <= 0) {
            clearInterval(id); id = null;
            startBtn.textContent = "开始";
            global.HS.ui.toast(rest ? "休息结束，继续加油 ✦" : "专注完成，去休息一下吧 ✦");
            return;
          }
          left -= 1;
          paint();
        }
        startBtn.addEventListener("click", function () {
          if (id) { clearInterval(id); id = null; startBtn.textContent = "继续"; return; }
          id = setInterval(tick, 1000);
          startBtn.textContent = "暂停";
        });
        root.querySelector("#timerReset").addEventListener("click", function () {
          clearInterval(id); id = null; left = total; startBtn.textContent = "开始"; paint();
        });
        root.querySelector("#timerMode").addEventListener("click", function () {
          rest = !rest;
          total = (rest ? 5 : 25) * 60;
          left = total;
          clearInterval(id); id = null;
          startBtn.textContent = "开始";
          paint();
        });
        paint();
      }
    },
    color: {
      title: "配色实验室",
      render() {
        return '<h2>配色实验室</h2><p class="modal__sub">点击色块复制色值</p><div class="swatches" id="toolPalette"></div>' +
          '<button class="btn btn--soft" id="toolNew" style="margin-top:14px">换一组</button>';
      },
      mount(root) {
        function build() {
          const box = root.querySelector("#toolPalette");
          const r = art().rng(String(Math.random()));
          const base = Math.floor(r() * 360);
          const list = [0, 30, 72, 180, 240].map(function (o) {
            return hslToHex((base + o) % 360, 60 + Math.floor(r() * 30), 50 + Math.floor(r() * 20));
          });
          box.innerHTML = list.map(function (c) {
            return '<div class="swatch" data-copy="' + c + '"><i style="background:' + c + '"></i><span>' + c + "</span></div>";
          }).join("");
          box.querySelectorAll("[data-copy]").forEach(function (el) {
            el.addEventListener("click", function () {
              copyText(el.dataset.copy, "已复制 " + el.dataset.copy);
            });
          });
        }
        build();
        root.querySelector("#toolNew").addEventListener("click", build);
      }
    },
    json: {
      title: "JSON 格式化",
      render() {
        return '<h2>JSON 格式化</h2><p class="modal__sub">校验并美化，纯本地处理</p>' +
          '<textarea class="textarea" id="jsonIn" placeholder=\'{"hello":"world"}\' style="min-height:160px"></textarea>' +
          '<div class="input-row" style="margin-top:10px"><button class="btn btn--primary" id="jsonFmt">格式化</button>' +
          '<button class="btn btn--soft" id="jsonMin">压缩</button>' +
          '<button class="btn btn--ghost" id="jsonCopy">复制结果</button></div>' +
          '<div class="muted" id="jsonMsg" style="margin-top:10px"></div>';
      },
      mount(root) {
        const ta = root.querySelector("#jsonIn");
        const msg = root.querySelector("#jsonMsg");
        function run(min) {
          try {
            const v = JSON.parse(ta.value);
            ta.value = min ? JSON.stringify(v) : JSON.stringify(v, null, 2);
            msg.textContent = "✅ 格式正确";
            store().data._lastJson = v;
          } catch (e) {
            msg.textContent = "❌ " + e.message;
          }
        }
        root.querySelector("#jsonFmt").addEventListener("click", () => run(false));
        root.querySelector("#jsonMin").addEventListener("click", () => run(true));
        root.querySelector("#jsonCopy").addEventListener("click", function () { copyText(ta.value, "结果已复制"); });
      }
    },
    picker: {
      title: "随机决定器",
      render() {
        return '<h2>随机决定器</h2><p class="modal__sub">每行一个选项</p>' +
          '<textarea class="textarea" id="pickIn" style="min-height:150px">看番\n写代码\n出去走走\n早点睡觉\n点一份宵夜</textarea>' +
          '<div class="input-row" style="margin-top:12px"><button class="btn btn--primary" id="pickGo">帮我决定</button></div>' +
          '<p class="prose" id="pickOut" style="margin-top:16px;font-size:18px;text-align:center">—</p>';
      },
      mount(root) {
        root.querySelector("#pickGo").addEventListener("click", function () {
          const list = root.querySelector("#pickIn").value.split("\n").map((s) => s.trim()).filter(Boolean);
          if (!list.length) return;
          const out = root.querySelector("#pickOut");
          let n = 0;
          const timer = setInterval(function () {
            out.textContent = list[(Math.random() * list.length) | 0];
            n += 1;
            if (n > 12) { clearInterval(timer); out.textContent = "✦ " + list[(Math.random() * list.length) | 0] + " ✦"; }
          }, 70);
        });
      }
    },
    countdown: {
      title: "纪念日倒计时",
      render() {
        const t = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
        return '<h2>纪念日倒计时</h2><p class="modal__sub">选择日期，看看还有多久</p>' +
          '<input class="input" type="date" id="cdDate" value="' + t + '" />' +
          '<input class="input" id="cdName" placeholder="那天是什么日子？（可留空）" style="margin-top:10px" />' +
          '<div class="stat-row" id="cdOut" style="margin-top:16px"></div>' +
          '<button class="btn btn--soft" id="cdGo" style="margin-top:14px">计算</button>';
      },
      mount(root) {
        function calc() {
          const d = new Date(root.querySelector("#cdDate").value);
          const name = root.querySelector("#cdName").value || "那一天";
          const days = Math.ceil((d - new Date()) / 86400000);
          const out = root.querySelector("#cdOut");
          out.innerHTML =
            '<div class="stat"><b>' + (days >= 0 ? days : Math.abs(days)) + "</b><span>" + (days >= 0 ? "天后" : "天前") + "</span></div>" +
            '<div class="stat"><b>' + Math.round(Math.abs(days) / 7) + "</b><span>周</span></div>" +
            '<div class="stat"><b>' + esc(name) + "</b><span>" + d.toLocaleDateString("zh-CN") + "</span></div>";
        }
        root.querySelector("#cdGo").addEventListener("click", calc);
        calc();
      }
    }
  };

  /* ══════════════ 放映室 ══════════════ */
  const cinema = {
    title: "放映室",
    sub: "视频源可以换成你自己的嵌入地址",
    render(ctx) {
      const list = D().cinema;
      const active = list.find((v) => v.id === (ctx.query && ctx.query.id)) || list[0];
      const p = player();
      return (
        '<div class="split split--wide">' +
        '<section class="stack">' +
        '<div class="cinema__player">' +
        (active
          ? active.kind === "file"
            ? '<video controls playsinline src="' + esc(active.src) + '"></video>'
            : '<iframe src="' + esc(active.src) + '" title="' + esc(active.title) +
              '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>'
          : "") +
        "</div>" +
        '<div class="panel"><div class="panel__head"><h3>' + esc(active ? active.title : "未选择视频") + "</h3>" +
        '<span class="muted">' + (active ? (active.kind === "file" ? "本地视频" : "外部嵌入") : "") + "</span></div>" +
        '<p class="muted">' + esc(active ? active.desc : "") + "</p></div>" +
        "</section>" +
        '<aside class="stack">' +
        '<section class="panel"><div class="panel__head"><h3>播放列表</h3><span class="muted">' + list.length + " 个</span></div>" +
        '<div class="cinema__list">' + list.map(function (v) {
          return '<div class="cinema__item' + (active && v.id === active.id ? " is-on" : "") + '">' +
            '<span class="track__art">▶</span><span class="row__main"><b>' + esc(v.title) + "</b><span>" + esc(v.kind) + "</span></span>" +
            '<button class="btn btn--soft btn--tiny" data-act="play-video" data-id="' + v.id + '">播放</button>' +
            '<button class="icon-action" data-act="delete-video" data-id="' + v.id + '">' + icon("trash") + "</button></div>";
        }).join("") + "</div></section>" +
        '<section class="panel"><div class="panel__head"><h3>添加视频源</h3></div>' +
        '<form data-form="video"><input class="input" name="title" placeholder="标题" required style="margin-bottom:8px" />' +
        '<input class="input" name="src" placeholder="嵌入地址或 mp4 直链" required style="margin-bottom:8px" />' +
        '<select class="select" name="kind" style="margin-bottom:10px">' +
        '<option value="youtube">外部嵌入（iframe）</option><option value="file">本地 / 直链视频（mp4）</option></select>' +
        '<button class="btn btn--primary btn--block" type="submit">添加</button></form>' +
        '<p class="muted" style="margin-top:10px">B 站 / YouTube 请使用「嵌入地址」，例如 https://www.youtube.com/embed/xxxx 。</p></section>' +
        '<section class="panel"><div class="panel__head"><h3>边看边听</h3></div>' +
        '<p class="muted">看视频时记得先暂停音乐播放器，否则会串音。</p>' +
        '<button class="btn btn--soft btn--block" data-act="music-pause" style="margin-top:10px">暂停音乐</button></section>' +
        "</aside></div>"
      );
    }
  };

  /* ══════════════ 搜索 ══════════════ */
  function searchAll(q) {
    q = (q || "").trim().toLowerCase();
    if (!q) return [];
    const d = D();
    const groups = [];
    const hit = (s) => String(s || "").toLowerCase().includes(q);
    const arts = d.articles.filter((a) => hit(a.title) || hit(a.tag) || hit(a.body) || hit(a.excerpt));
    const moms = d.moments.filter((m) => hit(m.text) || hit((m.tags || []).join(" ")));
    const phos = d.photos.filter((p) => hit(p.title) || hit(p.place) || hit(p.kind));
    const prjs = d.projects.filter((p) => hit(p.name) || hit(p.desc) || hit((p.tags || []).join(" ")));
    const novs = d.novels.filter((n) => hit(n.title) || hit(n.tag));
    const chars = d.characters.filter((c) => hit(c.name) || hit(c.quote) || hit(c.tag));
    const favs = d.favorites.filter((f) => hit(f.title) || hit(f.kind) || hit(f.note));
    const tls = d.timeline.filter((t) => hit(t.text));
    if (arts.length) groups.push({ label: "文章", items: arts.map((a) => ({ id: a.id, title: a.title, sub: a.tag + " · " + rel(a.date), route: "#/article/" + a.id })) });
    if (moms.length) groups.push({ label: "说说", items: moms.map((m) => ({ id: m.id, title: m.text.slice(0, 40), sub: rel(m.time), route: "#/moments" })) });
    if (phos.length) groups.push({ label: "照片墙", items: phos.map((p) => ({ id: p.id, title: p.title, sub: p.place, route: "#/photos" })) });
    if (prjs.length) groups.push({ label: "项目", items: prjs.map((p) => ({ id: p.id, title: p.name, sub: p.status, route: "#/projects" })) });
    if (novs.length) groups.push({ label: "小说", items: novs.map((n) => ({ id: n.id, title: n.title, sub: n.chapters.length + " 章", route: "#/novel/" + n.id })) });
    if (chars.length) groups.push({ label: "角色馆", items: chars.map((c) => ({ id: c.id, title: c.name, sub: c.tag, route: "#/characters" })) });
    if (favs.length) groups.push({ label: "收藏", items: favs.map((f) => ({ id: f.id, title: f.title, sub: f.kind, route: "#/favorites" })) });
    if (tls.length) groups.push({ label: "时间河流", items: tls.map((t) => ({ id: t.id, title: t.text, sub: rel(t.time), route: "#/timeline" })) });
    return groups;
  }

  const search = {
    title: "站内搜索",
    sub: "搜索星球上的一切内容",
    render(ctx) {
      const q = (ctx.query && ctx.query.q) || "";
      const groups = searchAll(q);
      const total = groups.reduce((s, g) => s + g.items.length, 0);
      return (
        '<div class="panel" style="max-width:760px;margin:0 auto">' +
        '<div class="input-row"><input class="input" id="searchInput" value="' + esc(q) +
        '" placeholder="输入关键词，例如：音乐 / 星 / 雨 / 项目" autocomplete="off" />' +
        '<button class="btn btn--primary" data-act="run-search" style="flex:0 0 auto">搜索</button></div>' +
        (q ? '<p class="muted" style="margin-top:12px">“' + esc(q) + "” 共找到 " + total + " 条结果</p>" : '<p class="muted" style="margin-top:12px">试试搜索：音乐、雨、星、项目</p>') +
        "</div>" +
        '<div class="stack" id="searchResults" style="max-width:760px;margin:16px auto 0">' +
        groups.map(function (g) {
          return '<section class="panel"><div class="panel__head"><h3>' + g.label + "</h3><span class=\"muted\">" + g.items.length + " 条</span></div>" +
            '<div class="list">' + g.items.map(function (it) {
              return '<button class="row" data-act="go" data-route="' + it.route + '">' +
                '<span class="row__main"><b>' + esc(it.title) + "</b><span>" + esc(it.sub) + "</span></span>" +
                '<span class="row__side">打开 →</span></button>';
            }).join("") + "</div></section>";
        }).join("") +
        (q && !total ? '<div class="empty"><b>✦</b>没有找到相关内容，换个词试试</div>' : "") +
        "</div>"
      );
    },
    mount(root) {
      const input = root.querySelector("#searchInput");
      if (input) {
        input.focus();
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter") global.HS.app.go("#/search?q=" + encodeURIComponent(input.value.trim()));
        });
      }
    }
  };

  /* ══════════════ 指令大全 ══════════════ */
  const COMMANDS = [
    { cmd: "/help", desc: "列出所有可用指令" },
    { cmd: "/home", desc: "回到首页" },
    { cmd: "/music", desc: "打开音乐播放器" },
    { cmd: "/play", desc: "播放 / 暂停当前曲目" },
    { cmd: "/next", desc: "切换下一首" },
    { cmd: "/theme", desc: "在深色 / 浅色之间切换" },
    { cmd: "/accent", desc: "切换一组强调色" },
    { cmd: "/fx", desc: "开关背景特效" },
    { cmd: "/me", desc: "查看当前账户信息" },
    { cmd: "/export", desc: "导出全部本地数据" },
    { cmd: "/random", desc: "随机打开一篇文章" },
    { cmd: "/clear", desc: "清空本地数据（需确认）" }
  ];

  const commands = {
    title: "指令大全",
    sub: "在搜索面板里输入 / 即可使用",
    render() {
      return (
        '<div class="split">' +
        '<section class="panel"><div class="panel__head"><h3>可用指令</h3><span class="muted">共 ' + COMMANDS.length + " 条</span></div>" +
        '<div class="list">' + COMMANDS.map(function (c) {
          return '<div class="row"><code class="chip" style="font-size:12px">' + c.cmd + "</code>" +
            '<span class="row__main"><span>' + c.desc + "</span></span>" +
            '<button class="btn btn--soft btn--tiny" data-act="run-command" data-cmd="' + c.cmd + '">执行</button></div>';
        }).join("") + "</div></section>" +
        '<aside class="stack">' +
        '<section class="panel"><div class="panel__head"><h3>怎么用</h3></div>' +
        '<div class="prose" style="font-size:13.5px"><p>1. 按 <kbd class="kbd">Ctrl</kbd><kbd class="kbd">K</kbd> 打开搜索面板。</p>' +
        '<p>2. 输入 <code>/</code> 会显示全部指令。</p>' +
        "<p>3. 输入关键词可以搜索文章、说说、照片、项目与小说。</p></div></section>" +
        '<section class="quote-card"><p>“键盘比鼠标快，前提是你记得住快捷键。”</p><span>—— 星之轨迹 · 指令区</span></section>' +
        "</aside></div>"
      );
    }
  };

  /* ══════════════ 助手 ══════════════ */
  const assistant = {
    title: "星野助手",
    sub: "一个住在角落里的本地小助手",
    render() {
      const log = global.HS.assistant.history();
      return (
        '<div class="split split--wide">' +
        '<div class="chat">' +
        '<div class="chat__log" id="buddyLog">' + log.map(function (m) {
          return '<div class="bubble bubble--' + (m.me ? "me" : "them") + '">' + esc(m.text) + "</div>";
        }).join("") + "</div>" +
        '<form class="chat__form" data-form="assistant">' +
        '<input class="input" name="text" placeholder="和星野说点什么…" autocomplete="off" required />' +
        '<button class="btn btn--primary" type="submit">发送</button></form>' +
        "</div>" +
        '<aside class="stack">' +
        '<section class="panel"><div class="panel__head"><h3>可以试试</h3></div><div class="stack">' +
        ["你好呀", "推荐一首歌", "帮我做个决定", "今天运势如何", "讲个冷笑话", "你是谁"].map(function (t) {
          return '<button class="btn btn--soft btn--block" data-act="quick-prompt" data-text="' + t + '">' + t + "</button>";
        }).join("") + "</div></section>" +
        '<section class="panel"><div class="panel__head"><h3>关于星野</h3></div>' +
        '<p class="muted">星野是一个完全运行在浏览器里的规则式助手，不会上传任何对话。她能聊天、推荐音乐、做随机决定、讲冷笑话，也能帮你导航到各个页面。</p>' +
        '<button class="btn btn--ghost btn--block" data-act="assistant-clear" style="margin-top:10px">清空对话</button></section>' +
        "</aside></div>"
      );
    },
    mount(root) {
      const log = root.querySelector("#buddyLog");
      if (log) log.scrollTop = log.scrollHeight;
    }
  };

  /* ══════════════ 个性设置 ══════════════ */
  const settings = {
    title: "个性设置",
    sub: "所有设置只保存在你的浏览器里",
    render() {
      const s = S();
      const u = U();
      const usage = store().usage();
      return (
        '<div class="grid grid--2">' +
        '<section class="panel"><div class="panel__head"><h3>个人资料</h3></div>' +
        '<form data-form="profile">' +
        '<div class="spread" style="justify-content:flex-start;gap:16px;margin-bottom:14px">' +
        '<span class="avatar avatar--lg avatar--ring">' + art().avatar(u.name, u.seed) + "</span>" +
        '<div><b style="font-size:16px">' + esc(u.name) + "</b><p class=\"muted\">" +
        (u.registered ? "已注册（本地账户）" : "游客模式") + " · 加入于 " + new Date(u.joined).toLocaleDateString("zh-CN") + "</p>" +
        '<button class="btn btn--ghost btn--tiny" type="button" data-act="random-avatar" style="margin-top:8px">换一个头像</button></div></div>' +
        '<label class="field"><span>昵称</span><input class="input" name="name" value="' + esc(u.name) + '" maxlength="16" /></label>' +
        '<label class="field"><span>签名</span><input class="input" name="bio" value="' + esc(u.bio || "") + '" maxlength="60" /></label>' +
        '<button class="btn btn--primary" type="submit">保存资料</button></form></section>' +

        '<section class="panel"><div class="panel__head"><h3>外观</h3></div>' +
        '<div class="switch"><span class="switch__text"><b>主题</b><i>夜间星空 / 晨雾浅色</i></span>' +
        '<span class="tabs"><button class="tab' + (s.theme === "dark" ? " is-on" : "") + '" data-act="theme-set" data-theme="dark">深色</button>' +
        '<button class="tab' + (s.theme === "light" ? " is-on" : "") + '" data-act="theme-set" data-theme="light">浅色</button></span></div>' +
        '<div class="switch"><span class="switch__text"><b>强调色</b><i>影响按钮、进度与高光颜色</i></span></div>' +
        '<div class="accent-row">' + ["aurora", "sakura", "ocean", "sunset", "forest"].map(function (a) {
          const map = { aurora: ["#6fd8ff", "#8b7bf7"], sakura: ["#ffb3d1", "#ff7fa8"], ocean: ["#74e5d6", "#4fa8ff"],
            sunset: ["#ffc46b", "#ff8a6b"], forest: ["#9ce88a", "#4fd0b0"] };
          return '<button class="accent-dot' + (s.accent === a ? " is-on" : "") + '" data-act="accent-set" data-accent="' + a +
            '" title="' + a + '" style="background:linear-gradient(135deg,' + map[a][0] + "," + map[a][1] + ')"></button>';
        }).join("") + "</div>" +
        toggleRow("动画效果", "关闭后减少所有过渡与浮动动画", "motion", s.motion) +
        toggleRow("背景特效", "极光、星空与粒子层", "fx", s.fx) +
        toggleRow("飘落花瓣", "首页飘落的樱花", "petals", s.petals) +
        toggleRow("性能模式", "关闭背景模糊与粒子，老设备更流畅", "perf", s.perf) +
        toggleRow("陪伴角色", "右下角的星野（鼠标划过会靠过来）", "buddy", s.buddy !== false) +
        '<div class="switch"><span class="switch__text"><b>开场动画</b><i>星辰序章 + 星海短片</i></span>' +
        '<button class="btn btn--soft btn--tiny" type="button" data-act="replay-prologue">重播</button></div>' +
        '<div class="divider"></div>' +
        '<div class="spread"><span class="muted">阅读字号</span><span class="muted" id="scaleText">' + Math.round(s.fontScale * 100) + "%</span></div>" +
        '<input type="range" id="fontScale" min="85" max="130" value="' + Math.round(s.fontScale * 100) + '" style="margin-top:10px" /></div>' +
        "</section>" +

        '<section class="panel"><div class="panel__head"><h3>音乐</h3></div>' +
        '<div class="spread"><span class="muted">默认音量</span><span class="muted" id="volText2">' + Math.round(s.volume) + "%</span></div>" +
        '<input type="range" id="settingsVolume" min="0" max="100" value="' + s.volume + '" style="margin-top:10px" />' +
        '<label class="field" style="margin-top:14px"><span>自定义音轨直链</span>' +
        '<input class="input" id="settingsExternal" placeholder="https://…/music.mp3" value="' + esc(s.externalUrl || "") + '" /></label>' +
        '<div class="input-row"><button class="btn btn--soft" data-act="save-external">载入并保存</button>' +
        '<button class="btn btn--ghost" data-act="music-clear-external">清除自定义音轨</button></div></section>' +

        '<section class="panel"><div class="panel__head"><h3>数据管理</h3><span class="muted">' +
        (usage.bytes / 1024).toFixed(1) + " KB / 5 MB</span></div>" +
        '<div class="progress"><i style="width:' + Math.max(2, usage.ratio * 100).toFixed(2) + '%"></i></div>' +
        '<p class="muted" style="margin-top:10px">所有文章、说说、设置与账户都保存在浏览器 localStorage 中。换设备不会同步，请用导出功能备份。</p>' +
        '<div class="input-row" style="margin-top:14px">' +
        '<button class="btn btn--soft" data-act="data-export">导出 JSON</button>' +
        '<button class="btn btn--soft" data-act="data-import">导入 JSON</button>' +
        '<button class="btn btn--danger" data-act="data-reset">恢复初始数据</button></div>' +
        '<input type="file" id="importFile" accept="application/json" hidden /></section>' +

        '<section class="panel" style="grid-column:1/-1"><div class="panel__head"><h3>关于这个星球</h3></div>' +
        '<div class="grid grid--2"><div class="prose" style="font-size:13.5px">' +
        "<p>星之轨迹是一个纯静态的个人空间：没有后端、没有数据库、没有第三方图片与音频。</p>" +
        "<p>首页星空、花瓣、序章粒子与全部插画都用 Canvas / SVG 现场绘制；音乐由 Web Audio 实时合成，因此完全原创。</p>" +
        "<p>把整个文件夹上传到 Cloudflare Pages，就等于完成部署。</p></div>" +
        '<div class="stat-row"><div class="stat"><b>0</b><span>外部图片</span></div>' +
        '<div class="stat"><b>0</b><span>第三方音频</span></div>' +
        '<div class="stat"><b>' + art().kinds.length + "</b><span>插画风格</span></div>" +
        '<div class="stat"><b>' + NAV.reduce((n, g) => n + g.items.length, 0) + "</b><span>功能页面</span></div></div></div></section>" +
        "</div>"
      );
    },
    mount(root) {
      const scale = root.querySelector("#fontScale");
      if (scale) {
        scale.addEventListener("input", function () {
          const v = Number(scale.value) / 100;
          store().settings.fontScale = v;
          document.documentElement.style.setProperty("--reading-scale", v);
          const t = root.querySelector("#scaleText");
          if (t) t.textContent = scale.value + "%";
          store().save();
        });
      }
      const vol = root.querySelector("#settingsVolume");
      if (vol) {
        vol.addEventListener("input", function () {
          player().setVolume(Number(vol.value));
          store().settings.volume = Number(vol.value);
          const t = root.querySelector("#volText2");
          if (t) t.textContent = vol.value + "%";
          store().save();
        });
      }
    }
  };

  function toggleRow(label, hint, key, on) {
    return '<div class="switch"><span class="switch__text"><b>' + label + "</b><i>" + hint + "</i></span>" +
      '<button class="toggle" role="switch" aria-checked="' + (on ? "true" : "false") + '" data-act="toggle-setting" data-key="' + key + '" aria-label="' + label + '"></button></div>';
  }

  /* ══════════════ 个人中心 ══════════════ */
  const profile = {
    title: "个人中心",
    sub: "你的资料与创作概览",
    render() {
      const u = U();
      const d = D();
      const likes = d.articles.reduce((s, a) => s + a.likes, 0) + d.moments.reduce((s, m) => s + m.likes, 0);
      return (
        '<section class="profile-hero">' +
        '<span class="avatar avatar--lg avatar--ring" style="width:88px;height:88px;border-radius:28px">' + art().avatar(u.name, u.seed) + "</span>" +
        '<div class="profile-hero__main"><h2>' + esc(u.name) + "</h2><p>" + esc(u.bio || "还没有写签名。") + "</p>" +
        '<div class="chip-row" style="margin-top:10px"><span class="chip">' + (u.registered ? "本地账户" : "游客") + "</span>" +
        "<span class=\"chip\">加入于 " + new Date(u.joined).toLocaleDateString("zh-CN") + "</span>" +
        '<span class="chip">已访问 ' + (store().stats.visits || 1) + " 次</span></div></div>" +
        '<div class="profile-hero__stats">' +
        "<div><b>" + d.articles.length + "</b><span>文章</span></div>" +
        "<div><b>" + d.moments.length + "</b><span>说说</span></div>" +
        "<div><b>" + d.photos.length + "</b><span>画作</span></div>" +
        "<div><b>" + likes + "</b><span>获赞</span></div></div>" +
        '<div class="stack" style="min-width:180px">' +
        '<button class="btn btn--primary" data-act="edit-profile">编辑资料</button>' +
        '<button class="btn btn--soft" data-act="go" data-route="#/settings">个性设置</button></div>' +
        "</section>" +
        '<div class="split" style="margin-top:18px">' +
        '<div class="stack">' +
        '<section class="section"><div class="section__head"><div><h2>我的文章</h2><p>最近写下的东西</p></div>' +
        '<button class="panel__link" data-act="go" data-route="#/articles">全部 ›</button></div>' +
        '<div class="panel"><div class="list">' + d.articles.slice(0, 5).map(function (a) {
          return '<button class="row" data-act="open-article" data-id="' + a.id + '">' +
            '<span class="row__main"><b>' + esc(a.title) + "</b><span>" + esc(a.tag) + " · " + rel(a.date) + "</span></span>" +
            '<span class="row__side">' + a.views + " 阅读</span></button>";
        }).join("") + "</div></div></section>" +
        '<section class="section"><div class="section__head"><div><h2>最近的瞬间</h2><p>来自时间河流</p></div></div>' +
        '<div class="panel"><div class="mini-tl">' + d.timeline.slice(0, 6).map(function (t) {
          return '<div class="mini-tl__row"><b>' + hhmm(t.time) + "</b><span>" + esc(t.text) + "</span></div>";
        }).join("") + "</div></div></section>" +
        "</div>" +
        '<aside class="stack">' +
        '<section class="panel"><div class="panel__head"><h3>我的收藏</h3><button class="panel__link" data-act="go" data-route="#/favorites">管理 ›</button></div>' +
        d.favorites.slice(0, 5).map(function (f) {
          return '<div class="row"><span class="row__main"><b>' + esc(f.title) + "</b><span>" + esc(f.kind) + "</span></span></div>";
        }).join("") + "</section>" +
        '<section class="quote-card"><p>“你记录的一切，都会在某个深夜回到你身边。”</p><span>—— 写给未来的你</span></section>' +
        "</aside></div>"
      );
    }
  };

  /* ══════════════ 404 ══════════════ */
  const notfound = {
    title: "迷路了",
    sub: "这颗星星还不存在",
    render() {
      return '<div class="notfound"><div><b>404</b><p>哎呀，这个页面没有在星之轨迹上留下脚印。</p>' +
        '<div class="input-row" style="justify-content:center"><button class="btn btn--primary" data-act="go" data-route="#/home">回到首页</button>' +
        '<button class="btn btn--soft" data-act="open-search">搜索一下</button></div></div></div>';
    }
  };

  /* ── 复制文本 ─────────────────────────────────── */
  function copyText(text, msg) {
    const done = () => global.HS.ui.toast(msg || "已复制到剪贴板 ✦");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallback());
    } else fallback();
    function fallback() {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { global.HS.ui.toast("复制失败，请手动选择", "warn"); }
      ta.remove();
    }
  }

  /* ══════════════ 交互动作表 ══════════════ */
  const actions = {
    go(el) { global.HS.app.go(el.dataset.route); },
    back() { history.back(); },
    "open-search"() { global.HS.ui.palette(); },
    compose() { global.HS.app.compose(); },
    auth(el) { global.HS.app.auth(el.dataset.kind); },
    "edit-profile"() { global.HS.app.editProfile(); },
    "play-random"() { global.HS.app.playRandom(); },

    /* 文章 */
    "open-article"(el) { global.HS.app.go("#/article/" + el.dataset.id); },
    "new-article"() { global.HS.app.newArticle(); },
    "edit-article"(el) { global.HS.app.newArticle(el.dataset.id); },
    "delete-article"(el) {
      global.HS.ui.confirm("删除这篇文章？", "删除后无法恢复（但你可以先用导出功能备份）。", function () {
        const d = D();
        d.articles = d.articles.filter((a) => a.id !== el.dataset.id);
        store().save(true);
        global.HS.ui.toast("文章已删除");
        global.HS.app.go("#/articles");
      });
    },
    "like-article"(el) {
      const id = el.dataset.id;
      const a = D().articles.find((x) => x.id === id);
      const liked = store().stats.liked;
      const i = liked.indexOf(id);
      const on = i < 0;
      if (on) { liked.push(id); if (a) a.likes += 1; }
      else { liked.splice(i, 1); if (a && a.likes > 0) a.likes -= 1; }
      store().save(true);
      // 只更新当前按钮，避免整页重绘
      el.classList.toggle("is-on", on);
      el.innerHTML = icon("heart") + (on ? "已喜欢 " : "喜欢 ") + (a ? a.likes : 0);
      global.HS.ui.toast(on ? "已加入喜欢 ✦" : "已取消喜欢");
    },
    "copy-link"(el) {
      copyText(location.origin + location.pathname + "#/article/" + el.dataset.id, "链接已复制 ✦");
    },
    "filter-articles"(el) { global.HS.app.go("#/articles?tag=" + encodeURIComponent(el.dataset.tag)); },
    "tag-search"(el) { global.HS.app.go("#/search?q=" + encodeURIComponent(el.dataset.tag)); },
    "run-search"() {
      const input = document.querySelector("#searchInput");
      if (input) global.HS.app.go("#/search?q=" + encodeURIComponent(input.value.trim()));
    },
    "home-tabs"(el, e) {
      const btn = e.target.closest(".tab");
      if (!btn) return;
      el.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-on", t === btn));
      const grid = document.querySelector("#featuredGrid");
      if (!grid) return;
      const list = D().articles.slice();
      if (btn.dataset.tab === "new") list.sort((a, b) => new Date(b.date) - new Date(a.date));
      else if (btn.dataset.tab === "random") list.sort(() => Math.random() - 0.5);
      else list.sort((a, b) => b.views - a.views);
      grid.innerHTML = list.slice(0, 3).map(articleCard).join("");
      global.HS.ui.observe(grid);
    },

    /* 说说 */
    "like-moment"(el) {
      const id = el.dataset.id;
      const m = D().moments.find((x) => x.id === id);
      if (!m) return;
      const liked = store().stats.liked;
      const i = liked.indexOf(id);
      const on = i < 0;
      if (on) { liked.push(id); m.likes += 1; }
      else { liked.splice(i, 1); m.likes = Math.max(0, m.likes - 1); }
      store().save(true);
      el.classList.toggle("is-on", on);
      el.innerHTML = icon("heart") + m.likes;
    },
    "delete-moment"(el) {
      D().moments = D().moments.filter((m) => m.id !== el.dataset.id);
      store().save(true);
      global.HS.ui.toast("已删除这条说说");
      global.HS.app.refresh();
    },
    "copy-text"(el) {
      const m = D().moments.find((x) => x.id === el.dataset.id);
      if (m) copyText(m.text, "内容已复制 ✦");
    },
    "delete-topic"(el) {
      global.HS.ui.confirm("删除这个话题？", "包含的全部回复也会一起删除。", function () {
        D().guestbook = D().guestbook.filter((t) => t.id !== el.dataset.id);
        store().save(true);
        global.HS.app.refresh();
      });
    },

    /* 照片 */
    "open-photo"(el) { global.HS.ui.lightbox(D().photos, el.dataset.id); },
    "gallery-more"(el) {
      const grid = document.querySelector("#gallery");
      if (!grid) return;
      const rest = photos._rest || [];
      grid.insertAdjacentHTML("beforeend", rest.map(shotHTML).join(""));
      photos._rest = [];
      const box = el.closest(".load-more");
      if (box) box.remove();
      global.HS.ui.observe(grid);
    },
    "new-photo"() {
      const kinds = art().kinds;
      const palettes = art().palettes;
      const kind = kinds[(Math.random() * kinds.length) | 0];
      const palette = palettes[(Math.random() * palettes.length) | 0];
      D().photos.unshift({
        id: store().uid(), title: sceneName(kind) + " · 新作", place: "刚刚生成",
        kind: kind, palette: palette, time: new Date().toISOString()
      });
      store().save(true);
      global.HS.ui.toast("生成了一张新的画 ✦");
      global.HS.app.refresh();
    },
    "filter-photos"(el) { global.HS.app.go("#/photos?kind=" + encodeURIComponent(el.dataset.kind)); },

    /* 项目 */
    "new-project"() {
      global.HS.ui.modal(
        '<h2>新建项目</h2><p class="modal__sub">记录一个正在做或想做的项目</p>' +
        '<form id="projForm"><label class="field"><span>名称</span><input class="input" name="name" required /></label>' +
        '<label class="field"><span>简介</span><input class="input" name="desc" /></label>' +
        '<label class="field"><span>状态</span><select class="select" name="status"><option>计划中</option><option>进行中</option><option>实验中</option><option>稳定</option></select></label>' +
        '<button class="btn btn--primary btn--block" type="submit">创建</button></form>',
        {
          mount(root) {
            root.querySelector("#projForm").addEventListener("submit", function (e) {
              e.preventDefault();
              const f = new FormData(e.target);
              D().projects.unshift({
                id: store().uid(), name: f.get("name"), desc: f.get("desc") || "还没有写简介",
                status: f.get("status"), progress: 10, tags: ["新项目"]
              });
              store().save(true);
              global.HS.ui.closeModal();
              global.HS.ui.toast("项目已创建 ✦");
              global.HS.app.refresh();
            });
          }
        }
      );
    },
    "bump-project"(el) {
      const p = D().projects.find((x) => x.id === el.dataset.id);
      if (!p) return;
      p.progress = Math.min(100, p.progress + 10);
      if (p.progress === 100) p.status = "稳定";
      store().save(true);
      global.HS.app.refresh();
    },
    "delete-project"(el) {
      D().projects = D().projects.filter((p) => p.id !== el.dataset.id);
      store().save(true);
      global.HS.app.refresh();
    },

    /* 小说 */
    "open-novel"(el) { global.HS.app.go("#/novel/" + el.dataset.id); },
    "novel-chapter"(el) { global.HS.app.go("#/novel/" + el.dataset.id + "?ch=" + el.dataset.ch); },
    "novel-font"(el) {
      const cur = Number(localStorage.getItem("hoshino.novelScale") || 1);
      const next = Math.max(0.85, Math.min(1.4, cur + Number(el.dataset.delta)));
      localStorage.setItem("hoshino.novelScale", String(next));
      document.documentElement.style.setProperty("--reading-scale", next);
      global.HS.ui.toast("字号 " + Math.round(next * 100) + "%");
    },
    "new-novel"() {
      global.HS.ui.modal(
        '<h2>新建作品</h2><p class="modal__sub">一个新的故事从第一句话开始</p>' +
        '<form id="novelForm"><label class="field"><span>标题</span><input class="input" name="title" required /></label>' +
        '<label class="field"><span>类型</span><input class="input" name="tag" value="短篇" /></label>' +
        '<label class="field"><span>第一章正文</span><textarea class="textarea" name="text" required></textarea></label>' +
        '<button class="btn btn--primary btn--block" type="submit">创建</button></form>',
        {
          mount(root) {
            root.querySelector("#novelForm").addEventListener("submit", function (e) {
              e.preventDefault();
              const f = new FormData(e.target);
              D().novels.unshift({
                id: store().uid(), title: f.get("title"), tag: f.get("tag") || "短篇",
                art: "space", palette: "aurora", words: String(f.get("text")).length,
                chapters: [{ title: "第一章", text: f.get("text") }]
              });
              store().save(true);
              global.HS.ui.closeModal();
              global.HS.app.refresh();
              global.HS.ui.toast("作品已创建 ✦");
            });
          }
        }
      );
    },

    /* 收藏 / 友链 */
    "new-favorite"() {
      global.HS.ui.modal(
        '<h2>添加收藏</h2><p class="modal__sub">记下喜欢的东西</p>' +
        '<form id="favForm"><label class="field"><span>名称</span><input class="input" name="title" required /></label>' +
        '<label class="field"><span>分类</span><input class="input" name="kind" value="音乐" /></label>' +
        '<label class="field"><span>备注</span><input class="input" name="note" /></label>' +
        '<button class="btn btn--primary btn--block" type="submit">添加</button></form>',
        {
          mount(root) {
            root.querySelector("#favForm").addEventListener("submit", function (e) {
              e.preventDefault();
              const f = new FormData(e.target);
              D().favorites.unshift({ id: store().uid(), title: f.get("title"), kind: f.get("kind") || "其他", note: f.get("note") || "" });
              store().save(true);
              global.HS.ui.closeModal();
              global.HS.app.refresh();
            });
          }
        }
      );
    },
    "delete-favorite"(el) {
      D().favorites = D().favorites.filter((f) => f.id !== el.dataset.id);
      store().save(true);
      global.HS.app.refresh();
    },
    "filter-favorites"(el) { global.HS.app.go("#/favorites?kind=" + encodeURIComponent(el.dataset.kind)); },
    "new-friend"() {
      global.HS.ui.modal(
        '<h2>添加友链</h2><p class="modal__sub">把喜欢的站点放进来</p>' +
        '<form id="friendForm"><label class="field"><span>站点名</span><input class="input" name="name" required /></label>' +
        '<label class="field"><span>地址</span><input class="input" name="url" placeholder="https://" required /></label>' +
        '<label class="field"><span>一句话介绍</span><input class="input" name="desc" /></label>' +
        '<button class="btn btn--primary btn--block" type="submit">添加</button></form>',
        {
          mount(root) {
            root.querySelector("#friendForm").addEventListener("submit", function (e) {
              e.preventDefault();
              const f = new FormData(e.target);
              D().friends.unshift({ id: store().uid(), name: f.get("name"), url: f.get("url"), desc: f.get("desc") || "一个有趣的小站", emoji: "✦" });
              store().save(true);
              global.HS.ui.closeModal();
              global.HS.app.refresh();
            });
          }
        }
      );
    },
    "delete-friend"(el, e) {
      e.preventDefault();
      e.stopPropagation();
      D().friends = D().friends.filter((f) => f.id !== el.dataset.id);
      store().save(true);
      global.HS.app.refresh();
    },

    /* 时间河流 */
    "delete-timeline"(el) {
      D().timeline = D().timeline.filter((t) => t.id !== el.dataset.id);
      store().save(true);
      global.HS.app.refresh();
    },

    /* 私信 */
    "open-thread"(el) { global.HS.app.go("#/messages?id=" + el.dataset.id); },

    /* 音乐 */
    "play-track"(el) {
      const i = Number(el.dataset.id);
      if (player().state.index === i && player().state.playing) player().pause();
      else player().play(i);
      global.HS.app.syncPlayer();
      global.HS.app.refresh();
    },
    "music-toggle"() { player().toggle(); global.HS.app.syncPlayer(); global.HS.app.refresh(); },
    "music-next"() { player().next(); global.HS.app.syncPlayer(); global.HS.app.refresh(); },
    "music-prev"() { player().prev(); global.HS.app.syncPlayer(); global.HS.app.refresh(); },
    "music-pause"() { player().pause(); global.HS.app.syncPlayer(); },
    "music-external"() {
      const input = document.querySelector("#externalUrl");
      if (!input || !input.value.trim()) return global.HS.ui.toast("请先填写音频链接", "warn");
      player().setExternal(input.value.trim(), "自定义音轨");
      store().save(true);
      player().play();
      global.HS.app.syncPlayer();
      global.HS.ui.toast("已载入自定义音轨 ✦");
      global.HS.app.refresh();
    },
    "music-clear-external"() {
      player().setExternal(null);
      store().settings.externalUrl = "";
      store().save(true);
      global.HS.app.syncPlayer();
      global.HS.ui.toast("已恢复默认音轨");
      global.HS.app.refresh();
    },
    "save-external"() {
      const input = document.querySelector("#settingsExternal");
      const url = input ? input.value.trim() : "";
      store().settings.externalUrl = url;
      player().setExternal(url || null, "自定义音轨");
      store().save(true);
      global.HS.ui.toast(url ? "音轨链接已保存 ✦" : "已清除自定义音轨");
      global.HS.app.syncPlayer();
    },

    /* 角色馆 */
    "char-detail"(el) {
      const c = D().characters.find((x) => x.id === el.dataset.id);
      if (!c) return;
      global.HS.ui.modal(
        '<div class="grid grid--2" style="gap:18px"><div>' + art().portrait(c.id + c.name, { palette: c.palette, alt: c.name }) + "</div>" +
        '<div><h2>' + esc(c.name) + '</h2><p class="modal__sub">' + esc(c.tag) + " · " + esc(c.tone) + "</p>" +
        '<div class="prose" style="font-size:14px"><blockquote>' + esc(c.quote) + "</blockquote></div>" +
        '<div class="char__attrs">' + attrBar("力量", c.power) + attrBar("共情", c.empathy) + attrBar("勇气", c.courage) + "</div>" +
        '<button class="btn btn--primary btn--block" data-act="char-like" data-id="' + c.id + '" style="margin-top:14px">' +
        "把 TA 加入收藏</button></div></div>",
        { wide: true }
      );
    },
    "char-like"(el) {
      const c = D().characters.find((x) => x.id === el.dataset.id);
      if (!c) return;
      D().favorites.unshift({ id: store().uid(), title: c.name, kind: "角色", note: c.quote });
      store().save(true);
      global.HS.ui.closeModal();
      global.HS.ui.toast("已加入收藏 ✦");
    },
    "new-character"() {
      global.HS.ui.modal(
        '<h2>新建角色</h2><p class="modal__sub">肖像会根据名字自动生成</p>' +
        '<form id="charForm"><div class="input-row">' +
        '<label class="field"><span>名字</span><input class="input" name="name" required /></label>' +
        '<label class="field"><span>身份</span><input class="input" name="tag" value="旅人" /></label></div>' +
        '<label class="field"><span>名台词</span><input class="input" name="quote" value="今天也一起加油吧。" /></label>' +
        '<label class="field"><span>配色</span><select class="select" name="palette">' +
        ["aurora", "sakura", "ocean", "sunset", "forest", "mono"].map((p) => '<option value="' + p + '">' + p + "</option>").join("") +
        "</select></label><button class=\"btn btn--primary btn--block\" type=\"submit\">创建</button></form>",
        {
          mount(root) {
            root.querySelector("#charForm").addEventListener("submit", function (e) {
              e.preventDefault();
              const f = new FormData(e.target);
              D().characters.unshift({
                id: store().uid(), name: f.get("name"), tag: f.get("tag") || "旅人", tone: "未知",
                quote: f.get("quote") || "……", palette: f.get("palette"), hair: (Math.random() * 4) | 0,
                power: 40 + ((Math.random() * 60) | 0), empathy: 40 + ((Math.random() * 60) | 0), courage: 40 + ((Math.random() * 60) | 0)
              });
              store().save(true);
              global.HS.ui.closeModal();
              global.HS.app.refresh();
            });
          }
        }
      );
    },

    /* 实验室 */
    "lab-burst"() { if (lab._api) lab._api.burst(); },
    "lab-clear"() { if (lab._api) lab._api.clear(); global.HS.ui.toast("画布已清空"); },
    "lab-quote"() {
      const quotes = [
        "今天也要把普通日子过得闪闪发光。", "你不需要成为谁，你只需要继续走。",
        "雨停之后，路面会替你记住天空。", "慢一点也没关系，反正星星一直在。",
        "把想做的事写在纸上，它就有了重量。", "所有的笨拙，都是认真过的证据。",
        "如果今天很难，就先只做一件事。", "月亮也在看你，只是它不擅长说话。"
      ];
      const el = document.querySelector("#labQuote");
      if (el) el.textContent = "「 " + quotes[(Math.random() * quotes.length) | 0] + " 」";
    },
    "lab-copy-quote"() {
      const el = document.querySelector("#labQuote");
      if (el) copyText(el.textContent, "灵感已复制 ✦");
    },
    "lab-palette"() { lab.renderPalette(document); },
    "lab-copy-color"(el) { copyText(el.dataset.color, "已复制 " + el.dataset.color); },
    "lab-fortune"() { lab.renderFortune(document); },

    /* 应用 */
    "open-game"(el) { global.HS.app.go("#/games/" + el.dataset.id); },
    "open-app"(el) {
      const tool = TOOLS[el.dataset.id];
      if (!tool) return;
      global.HS.ui.modal(tool.render(), { mount: tool.mount });
    },

    /* 放映室 */
    "play-video"(el) { global.HS.app.go("#/cinema?id=" + el.dataset.id); },
    "delete-video"(el) {
      D().cinema = D().cinema.filter((v) => v.id !== el.dataset.id);
      store().save(true);
      global.HS.app.refresh();
    },

    /* 助手 */
    "quick-prompt"(el) { global.HS.assistant.ask(el.dataset.text); },
    "assistant-clear"() {
      global.HS.assistant.clear();
      global.HS.app.refresh();
      global.HS.ui.toast("对话已清空");
    },

    /* 设置 */
    "replay-prologue"() { global.HS.app.replayPrologue(); },
    "theme-set"(el) { global.HS.app.setTheme(el.dataset.theme); },
    "accent-set"(el) { global.HS.app.setAccent(el.dataset.accent); },
    "toggle-setting"(el) {
      const key = el.dataset.key;
      const val = el.getAttribute("aria-checked") !== "true";
      el.setAttribute("aria-checked", val ? "true" : "false");
      store().settings[key] = val;
      store().save(true);
      global.HS.app.applySettings();
    },
    "random-avatar"() {
      U().seed = store().uid();
      store().save(true);
      global.HS.ui.toast("头像已更换 ✦");
      global.HS.app.refresh();
      global.HS.app.syncUser();
    },
    "data-export"() {
      const blob = new Blob([store().exportJSON()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "hoshino-portal-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      global.HS.ui.toast("已导出备份文件 ✦");
    },
    "data-import"() {
      const input = document.querySelector("#importFile");
      if (input) input.click();
    },
    "data-reset"() {
      global.HS.ui.confirm("恢复初始数据？", "当前所有文章、说说与设置都会被替换成示例内容。", function () {
        store().reset();
        global.HS.app.applySettings();
        global.HS.app.refresh();
        global.HS.app.syncUser();
        global.HS.ui.toast("已恢复初始数据");
      });
    },

    /* 指令 */
    "run-command"(el) { global.HS.app.runCommand(el.dataset.cmd); }
  };

  /* ── 导出 ─────────────────────────────────────── */
  global.HS = global.HS || {};
  global.HS.views = {
    NAV: NAV,
    home: home, articles: articles, article: article, moments: moments, guestbook: guestbook,
    photos: photos, projects: projects, novels: novels, novel: novel, favorites: favorites,
    friends: friends, timeline: timeline, messages: messages, music: music, characters: characters,
    lab: lab, works: works, apps: apps, cinema: cinema, search: search, commands: commands, games: games,
    assistant: assistant, settings: settings, profile: profile, notfound: notfound,
    actions: actions, COMMANDS: COMMANDS, TOOLS: TOOLS, TOOLSREFS: null,
    articleCard: articleCard, trackRow: trackRow, searchAll: searchAll, md: md,
    esc: esc, rel: rel, icon: icon, sceneName: sceneName, copyText: copyText
  };
})(window);
