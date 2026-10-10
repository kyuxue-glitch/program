/* ══════════════════════════════════════════════════════════════════
   assistant.js —— 星野，一个完全本地的陪伴式助手
   规则式对话，不发任何网络请求，不会上传聊天内容。
   ══════════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  const KEY = "hoshino.buddy.log";

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  let log = load();
  if (!log.length) {
    log = [{ me: false, text: "你好呀，我是星野。有什么想聊的吗？", time: Date.now() }];
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(log.slice(-60)));
    } catch (e) { /* 忽略 */ }
  }

  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  const JOKES = [
    "为什么程序员分不清万圣节和圣诞节？因为 Oct 31 = Dec 25。",
    "有一只北极熊走进酒吧，说：今天好冷。",
    "我问星星为什么一直眨眼，它说灯太亮了。",
    "为什么月亮不去上班？因为它已经有一个「月」薪了。",
    "番茄走在路上摔倒了，然后它变成了番茄酱。"
  ];
  const COMFORT = [
    "如果今天很累，就先只做一件事，剩下的明天再说。",
    "你已经做得很好了。真的，不骗你。",
    "难过的时候不用急着好起来，可以先坐一会儿。",
    "星星也是在黑夜里才被看见的。",
    "要不要去听一首歌？音乐厅就在左边。"
  ];

  /* ── 规则式回复 ───────────────────────────────── */
  function reply(text) {
    const t = String(text || "").trim();
    const low = t.toLowerCase();
    const has = function () {
      for (let i = 0; i < arguments.length; i += 1) {
        if (t.includes(arguments[i])) return true;
      }
      return false;
    };

    if (!t) return "嗯？你好像什么都没说。";
    if (has("你好", "您好", "hi", "hello", "早上好", "晚上好", "在吗", "嗨")) {
      const h = new Date().getHours();
      const when = h < 5 ? "夜深了，还没睡吗？" : h < 11 ? "早上好呀。" : h < 14 ? "中午好。" : h < 18 ? "下午好。" : "晚上好。";
      return when + "我是星野，可以陪你聊聊天，也可以帮你在星球上找东西。";
    }
    if (has("你是谁", "你叫什么", "自我介绍", "介绍一下你")) {
      return "我叫星野，是这个星球上的看门人。我不会联网，也不会把你的话传出去——所以你可以放心说。";
    }
    if (has("歌", "音乐", "推荐", "听什么", "bgm", "bgm")) {
      const tracks = global.HS.store.data.tracks || [];
      const t2 = pick(tracks);
      return t2
        ? "推荐《" + t2.title + "》，" + t2.mood + "的感觉，适合" + (new Date().getHours() > 20 ? "现在这个时间" : "慢慢听") + "。要我帮你放起来吗？"
        : "去音乐页面看看吧，那里的旋律都是现场合成的。";
    }
    if (has("决定", "选择", "选哪", "帮我选", "纠结")) {
      return pick(["出去走十分钟", "先睡一觉再说", "做那个更大胆的选择", "把两件事都写下来，看哪个更让你心跳", "听一首歌再决定"]) + "——这是我随便说的，但决定权在你。";
    }
    if (has("运势", "运气", "今天怎么样", "抽签")) {
      return "今日运势：「" + pick(["大吉", "中吉", "小吉", "吉", "末吉"]) + "」。幸运色是" +
        pick(["深蓝", "樱粉", "极光青", "落日橙"]) + "。" + pick(COMFORT);
    }
    if (has("笑话", "讲个", "冷笑话", "无聊")) return pick(JOKES);
    if (has("难过", "累", "难受", "不开心", "emo", "焦虑", "压力", "想哭")) return pick(COMFORT);
    if (has("谢谢", "感谢", "太好了", "厉害")) return pick(["不用谢，这是我该做的。", "能被你需要，我也很开心 ✦", "嘿，别客气。"]);
    if (has("再见", "晚安", "拜拜", "睡了")) return pick(["晚安，梦里也有星星。", "去吧，记得关灯。", "明天见，我一直在。"]);
    if (has("时间", "几点", "日期", "今天几号")) {
      const d = new Date();
      return "现在是 " + d.getFullYear() + " 年 " + (d.getMonth() + 1) + " 月 " + d.getDate() + " 日 " +
        String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + "。";
    }
    if (has("文章", "写作", "灵感", "标题")) {
      return "写作最难的是第一句。要不要先试试这个开头：「我一直在想，那天下午的光是什么样的……」";
    }
    if (has("帮助", "会什么", "功能", "怎么用", "能做什么")) {
      return "我可以陪聊、推荐音乐、帮你做随机决定、讲冷笑话、看运势、报时间。你也可以按 Ctrl+K 搜索这个星球。";
    }
    if (has("星", "梦", "宇宙", "天空")) {
      return pick(["如果有一天你能摘下一颗星星，许愿的时候别太小声。", "宇宙很大，但你的这条轨迹只有一条。", "我们都在别人的星图里亮着。"]);
    }
    if (low.includes("?") || t.includes("？") || t.includes("吗")) {
      return pick(["这个嘛……我觉得怎么说都有道理。你自己更倾向哪一边？", "嗯，我不太确定，但我愿意听你多说一点。", "让我想想——你先说说你的直觉是什么？"]);
    }
    return pick([
      "嗯，我在听。",
      "原来是这样。那后来呢？",
      "这个话题有点意思，再说说看。",
      "我先记下来了。",
      "听起来你今天经历了不少事情。",
      "要不要把这句话记到时间河流里？"
    ]);
  }

  /* ── DOM 渲染 ─────────────────────────────────── */
  function esc(str) {
    return String(str).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }

  function renderLog() {
    const el = document.getElementById("buddyLog");
    if (!el) return;
    el.innerHTML = log.map(function (m) {
      return '<div class="bubble bubble--' + (m.me ? "me" : "them") + '">' + esc(m.text) + "</div>";
    }).join("");
    el.scrollTop = el.scrollHeight;
  }

  function bubbleText(text) {
    const el = document.getElementById("buddyLine");
    if (el) el.textContent = text;
    const box = document.getElementById("buddyBubble");
    if (box) {
      box.classList.remove("is-muted");
      box.style.animation = "none";
      void box.offsetWidth;
      box.style.animation = "";
    }
  }

  function ask(text, silent) {
    const t = String(text || "").trim();
    if (!t) return "";
    log.push({ me: true, text: t, time: Date.now() });
    const r = reply(t);
    log.push({ me: false, text: r, time: Date.now() });
    save();
    renderLog();
    if (!silent) bubbleText(r.slice(0, 36));
    return r;
  }

  function greet() {
    const h = new Date().getHours();
    const name = global.HS.store.user.name;
    if (h < 5) return name + "，这么晚还不睡吗？";
    if (h < 11) return name + "，早上好，今天想先做什么？";
    if (h < 14) return name + "，中午好，别忘了好好吃饭。";
    if (h < 18) return name + "，下午的光很好看。";
    if (h < 23) return name + "，晚上好，要去星球上逛逛吗？";
    return name + "，夜深了，要不要听首歌再睡？";
  }

  function clear() {
    log = [{ me: false, text: "对话清空了。我们重新开始吧 ✦", time: Date.now() }];
    save();
    renderLog();
  }

  global.HS = global.HS || {};
  global.HS.assistant = {
    reply: reply,
    ask: ask,
    greet: greet,
    clear: clear,
    renderLog: renderLog,
    history: function () { return log.slice(); }
  };
})(window);
