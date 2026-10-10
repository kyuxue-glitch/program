/* ══════════════════════════════════════════════════════════════════
   store.js —— 本地数据仓库
   全部内容保存在 localStorage，不上传任何服务器。
   ══════════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  const KEY = "hoshino.portal.v2";
  const LEGACY_USER = "hoshino_user";
  const LEGACY_THEME = "hoshino_theme";

  /* ── 工具 ─────────────────────────────────────── */
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  /* ── 种子内容 ─────────────────────────────────── */
  function seed() {
    return {
      articles: [
        {
          id: "a1", title: "在海风里写作：我的二次元生活", tag: "生活", art: "sea", palette: "ocean",
          date: daysAgo(0), likes: 128, views: 2412, mood: "安静", minutes: 6,
          excerpt: "把喜欢的东西写下来，日子就会慢慢长出形状。",
          body: [
            "## 为什么要写",
            "小时候我有一本很厚的本子，封面贴着贴纸，每一页都写满了动画角色的名字和台词。后来本子丢了，我却一直记得那种把喜欢的东西留下来的感觉。",
            "写下来这件事，本身就是一种确认：确认我今天确实活了，确实被某一段旋律、某一帧画面打动过。",
            "> 记录不是为了给谁看，而是为了在很久以后，还能认出当时的自己。",
            "## 关于节奏",
            "我给自己定的规矩是：不追求每天都写，但每一次打开编辑器，都要留下一点真实的东西。可以是三行，也可以是三千字。",
            "大多数时候我写得很慢。一段反复改五六遍，删掉重来是常事。但慢下来之后，反而更容易听见自己真正想说什么。",
            "## 一个小清单",
            "- 夜晚的便利店和自动门的声音",
            "- 番剧片尾曲结束前的那两秒静默",
            "- 雨落在站台顶棚上的节奏",
            "这些东西都不重要，但它们加起来就是我的生活。",
            "所以，如果你也有想写的东西，就先写第一句吧。哪怕只是「今天有点想哭」。"
          ].join("\n\n")
        },
        {
          id: "a2", title: "从零搭一个属于自己的静态空间", tag: "技术", art: "city", palette: "night",
          date: daysAgo(2), likes: 96, views: 1832, mood: "专注", minutes: 9,
          excerpt: "不用服务器、不用框架，三个文件也能做出一个有呼吸感的网站。",
          body: [
            "## 先说结论",
            "一个 HTML、一个 CSS、一个 JS，加上一份数据，就足够撑起一个能长期使用的个人空间。真正让页面变好看的从来不是框架，而是节奏感——间距、层级、动效的时长。",
            "## 性能上的取舍",
            "所有插画都用 SVG 现场生成，不需要下载图片；背景星空用 canvas 绘制，只在需要的时候占用 CPU。",
            "```\n// 只在页面可见时运行动画\nif (document.hidden) return pause();\n```",
            "### 三层缓存策略",
            "1. 静态资源（`/assets/*`）长缓存，一年过期；",
            "2. CSS / JS 缓存一周；",
            "3. HTML 永不缓存，保证内容能及时更新。",
            "## 写在最后",
            "技术方案没有最好的，只有最合适的。如果你的目标是「我能随时改一句话就上线」，那静态站就是最优解。"
          ].join("\n\n")
        },
        {
          id: "a3", title: "深夜的歌单与一杯温牛奶", tag: "音乐", art: "space", palette: "aurora",
          date: daysAgo(4), likes: 214, views: 3120, mood: "困倦", minutes: 5,
          excerpt: "音乐是唯一能把时间折叠起来的东西。",
          body: [
            "## 深夜的两小时",
            "晚上十一点之后，世界会变得很轻。键盘声、冰箱的嗡鸣、窗外偶尔经过的车，都被放大成一种温柔的背景音。",
            "这个时段我通常听三类音乐：钢琴独奏、氛围合成器、以及动画的原声。它们共同的特点是不抢注意力，只是陪着你。",
            "## 关于本站的「音乐」模块",
            "这里的曲目不是外链音频，而是用 Web Audio 现场合成的。每一首都有自己的调式、速度和音色——虽然是代码写的，但它们确实是原创的旋律。",
            "> 如果某一段旋律突然让你想起某个夏天，那它就完成了使命。",
            "## 一点建议",
            "睡前把音量调到 30% 左右，比戴耳机更舒服。"
          ].join("\n\n")
        },
        {
          id: "a4", title: "为什么我开始收集光", tag: "随笔", art: "aurora", palette: "aurora",
          date: daysAgo(7), likes: 168, views: 2044, mood: "明亮", minutes: 4,
          excerpt: "清晨六点二十的斜光、路灯下的雨、老式显示器的余晖。",
          body: [
            "## 收集光的第 90 天",
            "我做了一件很傻的事：每天拍一张「光」的照片。不做筛选，不修图，只是拍下来，放在一个独立文件夹里。",
            "九十天之后回看，我发现这些照片里几乎没有人物。它们都是空房间、地板、窗帘、街道——但每一张我都能立刻想起那天的情绪。",
            "## 结论",
            "光比语言诚实。它不会说谎，也不会美化。",
            "如果你最近很累，试着拍一张今天的光。不用发出去，留给自己就好。"
          ].join("\n\n")
        },
        {
          id: "a5", title: "把普通日子过成番剧片尾曲", tag: "生活", art: "cafe", palette: "dusk",
          date: daysAgo(12), likes: 302, views: 4210, mood: "柔软", minutes: 7,
          excerpt: "片尾曲从来不是结局，而是让人舍不得关掉的那一小段。",
          body: [
            "## 片尾曲的作用",
            "好的片尾曲不是收尾，而是把情绪延长。它让故事结束后还留在你身体里，跟着你走出房间、走上楼梯、走到第二天早上。",
            "普通日子也可以有片尾曲。比如洗碗的时候放一首歌，比如下班绕远路经过那条有花的路。",
            "## 我的一天",
            "07:10 起床，拉开窗帘，看天气；\n08:40 通勤，戴耳机听半小时播客；\n13:20 午休，趴在桌子上睡十五分钟；\n19:30 做饭，锅铲碰撞的声音像节拍器；\n23:00 写一点东西，然后关灯。",
            "这些片段单独看都没有意义，串起来就是我的主题曲。"
          ].join("\n\n")
        },
        {
          id: "a6", title: "在雨天整理收藏夹", tag: "随笔", art: "rain", palette: "mono",
          date: daysAgo(18), likes: 87, views: 1120, mood: "怀旧", minutes: 5,
          excerpt: "收藏夹是一个人的精神考古现场。",
          body: [
            "## 考古发现",
            "今天清了一下午的收藏夹，翻出很多已经打不开的链接。有些网站消失了，有些视频下架了，有些文章只剩下标题。",
            "但我依然能想起当时为什么收藏它——那种「这个以后一定有用」的确信，本身就是一种年轻。",
            "## 分类方式",
            "最后我把它分成了四类：**马上要看**、**以后要做**、**想成为的人**、**舍不得删**。",
            "第三类最少，也最珍贵。"
          ].join("\n\n")
        }
      ],

      comments: {
        a1: [
          { id: uid(), name: "Mori", text: "写下来这件事，本身就是一种确认。这句太戳我了。", time: daysAgo(0) },
          { id: uid(), name: "小星星", text: "已加入我的深夜必读清单 ✦", time: daysAgo(0) }
        ],
        a3: [{ id: uid(), name: "Aki", text: "合成出来的旋律真的很惊喜，希望以后能下载到。", time: daysAgo(3) }]
      },

      moments: [
        { id: uid(), author: "星之轨迹", text: "今天把首页全部重做了一遍，星空是代码画出来的。\n小时候以为星星是别人给的，现在知道可以自己做。 ✦", time: daysAgo(0), likes: 24, liked: false, tags: ["随笔", "建站"] },
        { id: uid(), author: "星之轨迹", text: "深夜十二点，煮了一碗面。\n世界的噪音突然都消失了，只剩下汤在冒泡的声音。", time: daysAgo(1), likes: 41, liked: false, tags: ["日常"] },
        { id: uid(), author: "星之轨迹", text: "整理了一份「让人安静下来的歌单」，一共 12 首氛围曲，都是这里现场合成出来的。", time: daysAgo(3), likes: 63, liked: false, tags: ["音乐"] },
        { id: uid(), author: "星之轨迹", text: "有人问我为什么做个人网站。\n因为社交媒体会消失，域名只要续费就还在。", time: daysAgo(6), likes: 118, liked: false, tags: ["建站"] }
      ],

      photos: [
        { id: uid(), title: "月光下的海", place: "想象的海岸", kind: "sea", palette: "ocean", tall: true, time: daysAgo(1) },
        { id: uid(), title: "凌晨四点的城市", place: "顶楼", kind: "city", palette: "night", time: daysAgo(2) },
        { id: uid(), title: "鸟居与第一场雪", place: "某个山脚", kind: "torii", palette: "sakura", time: daysAgo(5) },
        { id: uid(), title: "极光落在湖面", place: "北方", kind: "aurora", palette: "aurora", tall: true, time: daysAgo(8) },
        { id: uid(), title: "雨天的霓虹街", place: "回家路上", kind: "rain", palette: "mono", time: daysAgo(11) },
        { id: uid(), title: "樱花铺满小路", place: "旧校舍", kind: "sakura", palette: "sakura", time: daysAgo(14) },
        { id: uid(), title: "窗边的座位", place: "街角咖啡店", kind: "cafe", palette: "dusk", time: daysAgo(20) },
        { id: uid(), title: "云海之上的山脊", place: "高处", kind: "mountain", palette: "ocean", time: daysAgo(27) },
        { id: uid(), title: "萤火虫的森林", place: "夏夜", kind: "forest", palette: "forest", time: daysAgo(33) }
      ],

      projects: [
        { id: uid(), name: "Hoshino Portal", desc: "你正在看的这个空间，纯静态、零依赖。", status: "进行中", progress: 78, tags: ["HTML", "CSS", "JS"], link: "" },
        { id: uid(), name: "Starfield Engine", desc: "首页星空的粒子引擎，支持鼠标视差与自适应。", status: "稳定", progress: 100, tags: ["Canvas", "性能"], link: "" },
        { id: uid(), name: "Ambient Synth", desc: "用 Web Audio 生成原创氛围旋律的实验。", status: "实验中", progress: 54, tags: ["Web Audio"], link: "" },
        { id: uid(), name: "Journal CLI", desc: "把随手写的东西整理成时间河流的小工具。", status: "计划中", progress: 12, tags: ["Node"], link: "" }
      ],

      novels: [
        {
          id: "n1", title: "星之彼岸", tag: "长篇", art: "space", palette: "aurora", words: 32400,
          chapters: [
            { title: "第一章 · 观星台的约定", text: "她在观星台的第三级台阶上等了很久。\n\n天文台的铁门早已锁死，只有风还忠于职守，年复一年地穿过栏杆。\n\n「你说过会回来。」她把那句话轻轻放在风里，像是寄出一封没有地址的信。\n\n城市的灯在脚下连成一条河，而真正的河在天上。她数过无数遍那些星星，却始终数不清别人离开的理由。" },
            { title: "第二章 · 没有寄出的信", text: "抽屉最深处有十七封信。\n\n每一封都以「亲爱的」开头，却没有任何一封被贴上邮票。她写的时候很认真，写完就放进抽屉，像把一颗石子沉进井里。\n\n「如果思念可以不吵醒任何人。」她在第十八封信上这样写。\n\n然后她决定不再写信了，改成每天傍晚去观星台坐十分钟。十分钟，不做任何别的事。" },
            { title: "第三章 · 光年之外的回复", text: "第七十九天的傍晚，仪器响了。\n\n那是她三年前抛向天空的坐标换来的回音——一串不完整的数据，反复了七遍。\n\n她把数据抄在纸上，辨认了整夜，终于拼出一句话：\n\n「我看见了，你一直在那里。」\n\n她笑了，又哭了很久很久。" }
          ]
        },
        {
          id: "n2", title: "东京雨季", tag: "中篇", art: "rain", palette: "mono", words: 18600,
          chapters: [
            { title: "第一章 · 便利店", text: "雨从下午三点开始下，一直没停。\n\n便利店的门每隔两分钟自动打开一次，带进一阵潮湿的风。店员在整理货架，动作很慢，像是怕打扰了雨。\n\n她站在关东煮前面，看了看时间：凌晨一点十七分。\n\n「再等十分钟。」她对自己说。" },
            { title: "第二章 · 伞", text: "伞是第二天还回来的。\n\n他把伞放在柜台上，说：「谢谢。」\n\n「不用。」她说，「反正也没人用它了。」\n\n后来那把伞一直插在门边的伞架里，伞骨上还留着雨水干掉的痕迹。谁的雨，没有人再问。" }
          ]
        },
        {
          id: "n3", title: "樱花落下之前", tag: "短篇集", art: "sakura", palette: "sakura", words: 9200,
          chapters: [
            { title: "第一篇 · 七天", text: "樱花从绽放到落下大约七天。\n\n他们用了六天决定见面，用了一天决定不再见面。\n\n第七天，风很大，花落得很快。" },
            { title: "第二篇 · 单车", text: "放学后的坡道很长。\n\n她总是推着车走，说这样比较慢，能多看一会儿天。\n\n其实只是想等一等，等那个总在最后关门的人。" }
          ]
        }
      ],

      favorites: [
        { id: uid(), title: "星屑のワルツ", kind: "音乐", note: "本站生成音轨，适合深夜" },
        { id: uid(), title: "《四叠半神话大系》", kind: "动画", note: "每年的固定复习" },
        { id: uid(), title: "《星河战队：星之梦》", kind: "游戏", note: "和星空的第一次和解" },
        { id: uid(), title: "《夜晚的潜水艇》", kind: "书籍", note: "文字很有湿度" },
        { id: uid(), title: "极光配色表", kind: "设计", note: "#6fd8ff / #8b7bf7 / #ff9ecb" },
        { id: uid(), title: "雨声白噪音", kind: "声音", note: "写东西时循环" }
      ],

      friends: [
        { id: uid(), name: "Mori 的森", url: "https://example.com/mori", desc: "一个人写的森林观察笔记", emoji: "🌲" },
        { id: uid(), name: "Aki 的小屋", url: "https://example.com/aki", desc: "摄影 / 咖啡 / 短歌", emoji: "☕" },
        { id: uid(), name: "Blue Moon", url: "https://example.com/bluemoon", desc: "深夜电台与合成器", emoji: "🌙" },
        { id: uid(), name: "椿的杂货铺", url: "https://example.com/tsubaki", desc: "插画约稿与手作", emoji: "🌸" },
        { id: uid(), name: "未来档案室", url: "https://example.com/archive", desc: "老番资料整理", emoji: "📼" },
        { id: uid(), name: "星野观测站", url: "https://example.com/obs", desc: "天文与摄影", emoji: "🔭" }
      ],

      characters: [
        { id: uid(), name: "星野 澪", tone: "温柔", quote: "别怕，星星也会迷路。", palette: "aurora", hair: 1, power: 78, empathy: 92, courage: 64, tag: "领航员" },
        { id: uid(), name: "白鸟 铃", tone: "元气", quote: "今天就先笑一下嘛！", palette: "sakura", hair: 0, power: 61, empathy: 84, courage: 88, tag: "歌姬" },
        { id: uid(), name: "夜见 咲", tone: "冷淡", quote: "我不是不关心，只是不擅长。", palette: "mono", hair: 2, power: 90, empathy: 56, courage: 95, tag: "剑士" },
        { id: uid(), name: "雾岛 遥", tone: "理性", quote: "数据不会说谎，人会。", palette: "ocean", hair: 3, power: 72, empathy: 60, courage: 74, tag: "研究员" },
        { id: uid(), name: "花菱 桃", tone: "活泼", quote: "甜点可以解决大部分问题。", palette: "sunset", hair: 1, power: 48, empathy: 96, courage: 58, tag: "糕点师" },
        { id: uid(), name: "月城 凛", tone: "沉稳", quote: "慢一点也没关系。", palette: "forest", hair: 2, power: 84, empathy: 76, courage: 82, tag: "守夜人" }
      ],

      cinema: [
        { id: uid(), title: "星海序章 · 概念影像", src: "https://www.youtube.com/embed/ScMzIvxBSi4", kind: "youtube", desc: "占位演示视频，可在设置里替换成你自己的嵌入地址。" },
        { id: uid(), title: "自制开场动画（步骤记录）", src: "https://www.youtube.com/embed/aqz-KE-bpKQ", kind: "youtube", desc: "记录从分镜到合成的完整过程。" }
      ],

      tracks: [
        { id: "t1", title: "桜の記憶", artist: "星之轨迹 · 和风原创音轨", bpm: 62, scale: "insen", mood: "樱花", palette: "sakura", timbre: "wagakoto" },
        { id: "t2", title: "宵の祭り", artist: "星之轨迹 · 和风原创音轨", bpm: 88, scale: "yo", mood: "祭典", palette: "sunset", timbre: "wagakoto" },
        { id: "t3", title: "雪の音", artist: "星之轨迹 · 和风原创音轨", bpm: 54, scale: "hirajoshi", mood: "初雪", palette: "ocean", timbre: "wagakoto" },
        { id: "t4", title: "星屑のワルツ", artist: "星之轨迹 · 原创音轨", bpm: 68, scale: "pentatonic", mood: "夜空", palette: "aurora" },
        { id: "t5", title: "雨上がりのバス停", artist: "星之轨迹 · 原创音轨", bpm: 76, scale: "lydian", mood: "雨", palette: "mono" },
        { id: "t6", title: "夏の残像", artist: "星之轨迹 · 原创音轨", bpm: 88, scale: "major", mood: "夏日", palette: "sakura" },
        { id: "t7", title: "深夜ラジオ", artist: "星之轨迹 · 原创音轨", bpm: 62, scale: "minor", mood: "深夜", palette: "night" }
      ],

      apps: [
        { id: "calc", name: "计算器", icon: "🧮", desc: "极简四则运算" },
        { id: "timer", name: "番茄钟", icon: "⏳", desc: "25 分钟专注计时" },
        { id: "color", name: "配色实验室", icon: "🎨", desc: "生成协调色板" },
        { id: "json", name: "JSON 格式化", icon: "🧩", desc: "校验与美化" },
        { id: "picker", name: "随机决定器", icon: "🎲", desc: "让选择变简单" },
        { id: "countdown", name: "纪念日倒计时", icon: "📅", desc: "距离那一天还有" }
      ],

      timeline: [
        { id: uid(), time: daysAgo(0), text: "重做了首页，星海是代码画的。" },
        { id: uid(), time: daysAgo(0), text: "把音乐换成现场合成的原创音轨。" },
        { id: uid(), time: daysAgo(1), text: "凌晨一点煮了一碗阳春面。" },
        { id: uid(), time: daysAgo(2), text: "整理完一篇关于静态站的技术笔记。" },
        { id: uid(), time: daysAgo(4), text: "在阳台看了很久的月亮。" },
        { id: uid(), time: daysAgo(6), text: "给照片墙补了六张新画。" },
        { id: uid(), time: daysAgo(9), text: "收到一条很温暖的长评论。" }
      ],

      guestbook: [
        { id: uid(), topic: "你最近单曲循环的是哪一首？", author: "Mori", time: daysAgo(0), replies: [{ id: uid(), author: "星之轨迹", text: "《星屑のワルツ》——就是本站生成的那首。", time: daysAgo(0) }] },
        { id: uid(), topic: "有没有一首歌一听前奏就想哭？", author: "Aki", time: daysAgo(2), replies: [{ id: uid(), author: "Blue Moon", text: "有。而且是那种前奏只有两个音的。", time: daysAgo(2) }] },
        { id: uid(), topic: "关于「把爱好变成工作」的一点想法", author: "椿", time: daysAgo(5), replies: [] }
      ],

      messages: [
        { id: "m1", name: "Mori", vibe: "dusk", unread: 2, thread: [
          { me: false, text: "你首页的星空是新做的吗？好漂亮。", time: daysAgo(0) },
          { me: true, text: "是，全部用 canvas 画的，一个图片都没用。", time: daysAgo(0) },
          { me: false, text: "下次教教我！我也想做一个自己的空间。", time: daysAgo(0) }
        ] },
        { id: "m2", name: "Aki", vibe: "sakura", unread: 0, thread: [
          { me: false, text: "照片墙里的「樱花铺满小路」我很喜欢。", time: daysAgo(1) },
          { me: true, text: "那是我最满意的一张，谢谢你 ✦", time: daysAgo(1) }
        ] },
        { id: "m3", name: "星野", vibe: "aurora", unread: 1, thread: [
          { me: false, text: "我一直在这里。需要的时候就叫我。", time: daysAgo(3) }
        ] }
      ],

      notifications: [
        { id: uid(), text: "Mori 给你的文章《在海风里写作》留了言。", time: daysAgo(0), read: false, route: "#/article/a1" },
        { id: uid(), text: "Aki 收藏了你的照片《樱花铺满小路》。", time: daysAgo(1), read: false, route: "#/photos" },
        { id: uid(), text: "本周你记录了 7 条时间河流。", time: daysAgo(2), read: true, route: "#/timeline" },
        { id: uid(), text: "系统：本站数据全部保存在你的浏览器里。", time: daysAgo(3), read: true, route: "#/settings" }
      ]
    };
  }

  /* ── 默认状态 ─────────────────────────────────── */
  function defaults() {
    return {
      version: 3,
      user: { name: "游客", pass: "", bio: "在星海边缘散步的人。", joined: new Date().toISOString(), registered: false, seed: uid() },
      settings: {
        theme: "dark",
        accent: "aurora",
        motion: true,
        fx: true,
        petals: true,
        perf: false,
        buddy: true,
        volume: 45,
        fontScale: 1,
        prologue: true
      },
      stats: { visits: 1, lastVisit: new Date().toISOString(), day: new Date().toDateString(), liked: [] },
      data: seed()
    };
  }

  /* ── 读取 / 保存 ──────────────────────────────── */
  let state = defaults();
  let saveTimer = null;
  const listeners = [];

  function merge(base, saved) {
    const out = Object.assign({}, base, saved || {});
    out.settings = Object.assign({}, base.settings, (saved && saved.settings) || {});
    out.stats = Object.assign({}, base.stats, (saved && saved.stats) || {});
    const data = Object.assign({}, base.data, (saved && saved.data) || {});
    Object.keys(base.data).forEach(function (k) {
      if (!Array.isArray(data[k]) && typeof base.data[k] === "object") data[k] = base.data[k];
    });
    out.data = data;
    return out;
  }

  function load() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || "null");
    } catch (e) {
      saved = null;
    }
    state = merge(defaults(), saved);

    // 兼容旧版本站点留下的数据
    if (!saved) {
      try {
        const oldUser = JSON.parse(localStorage.getItem(LEGACY_USER) || "null");
        const oldTheme = localStorage.getItem(LEGACY_THEME);
        if (oldUser && oldUser.name) {
          state.user.name = oldUser.name;
          state.user.registered = !!oldUser.registered;
        }
        if (oldTheme === "light" || oldTheme === "dark") state.settings.theme = oldTheme;
      } catch (e) { /* 忽略 */ }
    }

    // 版本迁移：v3 起替换为和风曲目，并补上小游戏记录
    if (!saved || (saved.version || 1) < 3) {
      state.data.tracks = seed().tracks;
      state.data.games = state.data.games || {};
      state.version = 3;
    }

    const today = new Date().toDateString();
    if (state.stats.day !== today) {
      state.stats.day = today;
      state.stats.visits = (state.stats.visits || 0) + 1;
    }
    state.stats.lastVisit = new Date().toISOString();
    return state;
  }

  function save(immediate) {
    const write = function () {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch (e) {
        if (global.HS && HS.ui && HS.ui.toast) HS.ui.toast("本地存储已满，请清理部分内容", "warn");
      }
      listeners.forEach(function (fn) { try { fn(state); } catch (e) {} });
    };
    if (immediate) {
      clearTimeout(saveTimer);
      write();
      return;
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(write, 220);
  }

  function onChange(fn) { listeners.push(fn); }

  function reset() {
    state = defaults();
    save(true);
    return state;
  }

  function exportJSON() {
    return JSON.stringify({ app: "hoshino-portal", exportedAt: new Date().toISOString(), state: state }, null, 2);
  }

  function importJSON(text) {
    const parsed = JSON.parse(text);
    const incoming = parsed && parsed.state ? parsed.state : parsed;
    if (!incoming || !incoming.data) throw new Error("数据格式不正确");
    state = merge(defaults(), incoming);
    save(true);
    return state;
  }

  function usage() {
    let bytes = 0;
    try {
      bytes = new Blob([JSON.stringify(state)]).size;
    } catch (e) { bytes = JSON.stringify(state).length; }
    const limit = 5 * 1024 * 1024;
    return { bytes: bytes, limit: limit, ratio: Math.min(1, bytes / limit) };
  }

  /* ── 便捷访问 ─────────────────────────────────── */
  const store = {
    KEY: KEY,
    get state() { return state; },
    get data() { return state.data; },
    get settings() { return state.settings; },
    get user() { return state.user; },
    get stats() { return state.stats; },
    load: load,
    save: save,
    reset: reset,
    onChange: onChange,
    exportJSON: exportJSON,
    importJSON: importJSON,
    usage: usage,
    uid: uid,
    daysAgo: daysAgo,
    clone: clone,
    seedData: seed
  };

  global.HS = global.HS || {};
  global.HS.store = store;
})(window);
