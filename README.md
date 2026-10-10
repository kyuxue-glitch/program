# 星之轨迹 · Hoshino Portal

一个可以直接部署到 **Cloudflare Pages** 的纯静态二次元个人空间。
没有后端、没有数据库、没有第三方图片与音频——首页星空、花瓣、序章粒子、全部插画都由
Canvas / SVG 现场绘制，音乐由 Web Audio 实时合成，因此完全原创、可离线、体积很小。

---

## 一、部署（3 步）

1. 打开 Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Upload assets**。
2. 把 `hoshino-portal` 整个文件夹（或打包成 zip）上传。
3. 完成，访问分配的 `xxx.pages.dev` 域名即可。

用 Git 部署也一样：仓库根目录就是本项目目录，构建命令留空，输出目录填 `/`。

> 本地预览：直接双击 `index.html` 也能运行；
> 若想让 Service Worker 与相对路径都正常工作，建议起一个静态服务，例如
> `npx serve` 或 `python -m http.server`。

---

## 二、项目结构

```
hoshino-portal/
├── index.html            页面骨架（侧栏 / 顶栏 / 音乐坞 / 伙伴 / 命令面板 / 图标精灵）
├── styles.css            设计变量 + 全部组件与响应式样式（含深色 / 浅色主题）
├── app.js                应用外壳：路由、导航、主题、浮层、全局事件、启动流程
├── js/
│   ├── art.js            原创程序化插画引擎（场景 / 封面 / 角色肖像 / 头像）
│   ├── store.js          本地数据仓库（localStorage、示例内容、导入导出）
│   ├── particles.js      Canvas 特效：星空视差、飘落花瓣、序章粒子星座
│   ├── mousefx.js        鼠标动效：光标星屑、背景视差、卡片聚光 / 倾斜
│   ├── player.js         Web Audio 原创氛围音乐引擎 + 频谱可视化
│   ├── views.js          所有页面与交互动作（首页 / 文章 / 说说 / 相册 / 小游戏 …）
│   ├── games.js          小游戏模块（按需加载）
│   └── assistant.js      星野：完全本地的规则式陪伴助手
├── assets/
│   ├── hero.svg          首页主视觉（手写 SVG 夜景，非位图）
│   ├── intro.mp4         序章短片（程序化录制，1MB，可替换成自己的视频）
│   ├── favicon.svg       站点图标
│   └── hero.png          旧版占位图，已不再被引用，可以删除
├── sw.js                 可选离线缓存（HTML/JS/CSS 网络优先，资源缓存优先）
├── manifest.webmanifest  PWA 清单，可“添加到主屏幕”
├── robots.txt
├── _headers              Cloudflare Pages 缓存与安全响应头
└── 404.html              独立样式的错误页
```

---

## 三、功能一览

**开场与氛围**
- 序章：`assets/intro.mp4` 星海短片（程序化生成的 8 秒 MP4，自动循环、静音播放）
  + Canvas 粒子汇聚成星座 + 标题浮现动画，可跳过，可在设置里重播
- 鼠标动效：光标星屑拖尾与柔光、背景极光视差、卡片聚光 + 轻微 3D 倾斜
  （仅在鼠标设备启用，触摸设备自动跳过）
- 陪伴角色「星野」：内联 SVG 手绘角色，带呼吸浮动、说话时的小跳与脚下光环；
  鼠标划过展开「聊天 / 音乐 / 小游戏 / 收起」，对话气泡 15 秒后自动收起，可在设置里关掉
- 日系氛围音乐：默认曲目为和风原创音轨（筝 / 尺八 / 太鼓 + 都节・平调子音阶），
  全部由 Web Audio 实时合成

**内容**
- 文章：列表 / 标签筛选 / 搜索 / 详情阅读进度条 / 新建 · 编辑 · 删除 / 评论 / 点赞 / 复制链接
- 说说：发布、话题标签、点赞、删除；会同时写入时间河流
- 时间河流：按天分组、按时分记录、可删除
- 小说：书架、章节阅读、字号调节（记忆在本地）
- 照片墙：10 种程序化场景风格、风格筛选、灯箱浏览（方向键切换）、导出 SVG
- 收藏 / 友链 / 项目（进度条）/ 访客创作（Markdown 风格正文）
- 角色馆：自创角色档案、能力条、肖像自动生成

**互动**
- 星野助手：陪聊、推荐音乐、随机决定、冷笑话、运势、报时间（全本地规则引擎）
- 私信：多会话、自动回复（星野会话走助手引擎）
- 杂谈留言板：发话题、回复、删除
- 小游戏（`#/games`）：星屑接接乐、记忆星图、弹幕躲避、星轨节拍；鼠标 / 触摸 / 键盘都能玩，
  最高分存在本地；游戏代码按需加载（`js/games.js`）
- 应用中心：计算器、番茄钟、配色实验室、JSON 格式化、随机决定器、纪念日倒计时
- 放映室：可自行添加 B 站 / YouTube 嵌入地址或 mp4 直链

**系统**
- 本地账户：注册 / 登录 / 游客昵称，头像随昵称生成
- 主题：深色 / 浅色 + 5 组强调色；动画、背景特效、花瓣可单独关闭
- 命令面板：`Ctrl / ⌘ + K`，支持搜索与 `/help`、`/music`、`/theme`、`/export` 等指令
- 数据：导出 / 导入 JSON 备份，一键恢复示例数据，侧栏显示存储占用
- 响应式：桌面侧栏 / 移动抽屉导航 + 底部标签栏；支持 `prefers-reduced-motion`
- 性能：性能模式（关闭模糊 / 粒子）、按需加载、惰性画廊、插画结果缓存、`content-visibility`

---

## 四、二次开发入口

| 想改什么 | 改哪里 |
| --- | --- |
| 站点名、导航、栏目 | `app.js` 里的 `ROUTE_TITLE`、`js/views.js` 顶部的 `NAV` |
| 示例文章 / 说说 / 照片 / 音乐 | `js/store.js` 的 `seed()` |
| 视觉配色、圆角、动效时长 | `styles.css` 顶部的 `:root` 设计变量 |
| 插画风格与配色 | `js/art.js` 的 `PALETTES`、`SCENES` 与各 `kind` 分支 |
| 首页大图 | 直接替换 `assets/hero.svg`（或换成自己的图片并改 `.hero__art` 的 `background-image`） |
| 陪伴角色 | `index.html` 里的 `<template id="mascotTpl">`（SVG 骨骼）+ `styles.css` 的 `.m-*` 动画 |
| 鼠标动效 | `js/mousefx.js` |
| 小游戏 | `js/games.js`（新增游戏只需加一个 `xxxGame(host)` 工厂并注册到 `FACTORY`） |
| 开场短片 | 重新生成：打开 `C:\aiprogram\_tools\intro-gen.html`（录制后自动上传到 assets） |
| 助手语料 | `js/assistant.js` 的 `reply()` |
| 音乐 | `js/player.js` 的 `SCALES` / `PROGRESSIONS` / `scheduleStep()` |

### 调试
在网址后加 `?debug=1` 会在控制台打印每次交互的动作名，方便排查。

### 换成自己的数据 / API
本项目默认离线运行。若要接入真实后端，把 `store.data` 的数组换成 `fetch()` 结果即可，
例如在 `app.js` 的 `boot()` 里：

```js
const res = await fetch("/api/articles");
store.data.articles = await res.json();
```

私有接口请用 Cloudflare Worker 代理，不要把密钥写进浏览器端。

### 关于外部依赖
只保留了 Google Fonts（Noto Sans SC / ZCOOL KuaiLe）。
删除 `index.html` 里的两个 `<link>` 即可完全离线，字体自动回退到系统字体。

---

## 五、注意事项

- **数据在浏览器里**：文章、说说、账户、设置都保存在 localStorage，换设备不会同步，请用「个性设置 → 数据管理」导出备份。
- **图片与音乐**：全部为程序生成，不含任何第三方素材，可以自由修改和发布。
- **Service Worker**：`sw.js` 对代码走“网络优先”，因此重新部署后刷新即可看到新内容；
  不想要离线缓存时删掉该文件就行，`app.js` 的注册失败不会影响站点运行。
- `_headers` 已配置长缓存与基础安全头，Cloudflare Pages 会自动读取。
- **改完文件看不到变化时**：`index.html` 里的 `?v=2.0.2` 是缓存标识，把版本号往上加一位
  （CSS / JS 都要改）即可强制浏览器与 CDN 重新取文件；`/assets/*` 是一年强缓存，
  替换图片时建议同时改文件名。

愿你在这片星空下，找到属于自己的光。 ✦
