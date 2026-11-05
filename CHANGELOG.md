# 更新日志 / Changelog

本文档按语言分节；每条对应一个版本号。

## 中文

**0.5.11** —— 跟进 dsh-log-trim 0.7.0（worker 扫描 + 异步裁剪 + 用量账本）。

- 内嵌 log-trim 升到 0.7.0：开机扫描在 worker 里跑（`src/vendor/host/dsh-log-trim.worker.mjs`），
  裁剪内核改异步，账本记录被裁部分的 usage 差额。
- 重新 vendor（含运行时引用的 worker 模块）；删掉 0.5.9 手工补的那份重复校验器副本。
- 包描述与 README 改成五个组件（四个动作 + 一个维护），与内嵌数量一致。

**0.5.10** —— 开机扫描不再把宿主按住（会话列表变空的那个 bug）。

- 整轮扫描搬进 worker（`src/vendor/host/dsh-log-trim.worker.mjs`），主线程只等一份摘要。本机实测：162 个会话、12 个大会话，旧版按住事件循环 **117 秒**，新版全程最大停顿 **43 ms**。
- 解压/压缩分片让出事件循环（`readLogAsync` / `encodeLogAsync`），会话之间也 `setImmediate` 一次。
- 修 `keepLastWindows` 的两处浪费：`events.find()` 套在可见事件的 `map` 里是 O(n²)；被裁掉的事件也照样 `structuredClone` 了一遍。18 MB 日志 6.3 s → 1.6 s。
- 开机扫描延后 3 秒再起，把首屏让开。

**0.5.9** —— 修复内嵌 dsh-log-trim 的校验器副本缺失。

- `dsh-log-trim.js` / `lossless.js` 动态导入 `dsh-log-trim.vendor.verify-session-log.mjs`，但 0.5.8 只带了一份 `dsh-log-trim.verify-session-log.mjs`（少了 `.vendor.`），且那份内部还指向不存在的 `dsh-log-trim.compact-session.mjs`。任何走到「裁剪前用宿主校验器验日志」的路径都会抛 `Cannot find module`，表现为扫描失败、`last:null`。现在补齐命名正确的副本，并对齐两份文件内部的相对导入。
- 新增 `test/vendor-imports.test.js`：扫描 `src/vendor/host/` 下全部相对导入，发布前拦住悬空引用。

**0.5.8** —— 跟进 dsh-log-trim 0.6.1（扫描崩溃修复、`/run` 后台执行）。

**0.5.7** —— 跟进 dsh-delete-turn 0.2.4（多选条「取消」）。

**0.5.6** —— 组件设置里补上「会话日志裁剪」的卡片。

- `CONFIG_CARDS` 之前只列了 edit / rerun / delete，log-trim 的 `ConfigCard` 虽然已导出却没被渲染，
  于是 studio 页面上没有裁剪设置。现在它作为第四张卡片出现（窗口/清流/折叠/清理已遮蔽、
  阈值、备份、`/ledger` 统计开关都在里面）。

**0.5.5** —— 跟进 dsh-delete-turn 0.2.3（多选工具条重排）。

- 内嵌 delete 半部更新：多选条从输入框正中挪到上方右侧、体量缩小。

**0.5.4** —— 跟进 dsh-log-trim 0.6.0（裁剪统计账本）。

- 内嵌的 log-trim 升到 0.6.0：每次改写记一笔窗口/事件/字节账，写在 `~/.dsh/dsh-log-trim/ledger.json`，
  并暴露 `GET /api/dsh-log-trim/ledger` 给其它插件读。

**0.5.3** —— 跟进四个组件：设置卡只挂在包自己的页面上。

- edit 0.5.16 / rerun 0.2.9 / delete 0.2.2 / log-trim 0.5.2：去掉 `plugins.row.config`，只保留 `plugins.bundle.config`。
  于是 `#/panel/plugins/<包名>` 直接看到设置，行上不再有「配置」按钮，也没有两份入口。
- 契约表随之减少三条 `plugins.row.config` 记录。

**0.5.2** —— 跟进三个动作组件：设置卡片同时挂到包自己的页面。

- dsh-edit-turn 0.5.15 / dsh-rerun-turn 0.2.8 / dsh-delete-turn 0.2.1：新增 `plugins.bundle.config`（key 是裸包名），
  于是 `#/panel/plugins/<包名>` 直接能看到设置，不再只能从 `…/<包名>/<包名>` 那一层进去。
- 内嵌浏览器半部随重新 vendor 更新。

**0.5.1** —— 组件行标出「动作 / 维护」；跟进内嵌组件。

- 面板里每个组件行在名字后多一个徽章：`动作`（edit/rerun/delete/markdown）或 `维护`（log-trim）。
- 内嵌 dsh-log-trim 升到 0.5.1（双份安装告警）。

**0.5.0** —— 第五个组件：会话日志裁剪（dsh-log-trim 0.5.0）。

- **维护型组件**：manifest 新增 `{ id: 'dsh-log-trim', suffix: 'trim', kind: 'maintenance' }`，它没有消息行动作、没有输入区浮层，因此不占 slot / overlay；补丁行、`exports["./trim"]`、vendor 副本与状态行照旧，和其它四个组件一样由本包内置。
- **装 studio 就有全部五个功能**：启动时裁掉模型看不到的旧窗口、清空逐块回放记录、折叠 edit/rerun/delete 痕迹，写盘前过宿主自己的九项校验；不需要再单独装 `dsh-log-trim`。
- **体积与内存不重复**：单独安装的副本与本包内置的副本是两个插件身份，同时装会各跑一遍启动扫描（会互相看见对方的备份）。推荐只留一个：要么装本包、要么单独装。
- 内嵌组件版本：edit 0.5.14 / rerun 0.2.7 / delete 0.2.0 / markdown 0.1.5 / trim 0.5.0。

**0.4.9** —— 跟进内嵌组件 dsh-edit-turn 0.5.14。

- 内置版本记录与浏览器半部同步到 `dsh-edit-turn 0.5.14`（工具侧修复，运行代码无行为变化）。
- `vendor --check` 干净，115/115。

**0.4.8** —— 跟进内嵌组件：delete 0.2.0、rerun 0.2.7。

- **dsh-delete-turn 0.2.0**：多选删除；载体写上 `op`/`turn`，整轮删除额外写 `deletedTurn`/`deleteIndex`。
- **dsh-rerun-turn 0.2.7**：遮蔽窗口按表面节点、重放按槽位顺序、生成期间冻结旧轮渲染（不再闪回/空白/丢提问）。
- 内置版本记录同步更新；`vendor --check` 干净，115/115 全绿。

**0.4.7** —— 打开着的会话不再重新解码整份日志（跟进 `dsh-edit-turn` 0.5.13）。

- **组件跟进**：`dsh-edit-turn` **0.5.13**、`dsh-rerun-turn` 0.2.6、`dsh-delete-turn` 0.1.15、`dsh-markdown-bubble` 0.1.5。

- 单独计时后：插件的全部计算只有几十毫秒，**读日志 + 解压 1,408 ms** 才是瓶颈。现在宿主已经打开的会话直接用内存快照，不再从磁盘重解一遍 —— 编辑笔的出现从"秒级"降到"几十毫秒级"。

**0.4.6** —— 复制已修好，临时诊断撤掉；`/state` 再快一档。

- **组件跟进**：`dsh-edit-turn` **0.5.12**、`dsh-rerun-turn` 0.2.6、`dsh-delete-turn` 0.1.15、`dsh-markdown-bubble` 0.1.5。

- **复制修好了**：根因是 `/state` 太大太慢（25 MB / 13 秒），那段时间里浏览器半部没有任何编辑条目，按下复制不会被插件接管 —— 瘦身之后复制拿到的是改写后的文本。0.4.4 加的自报诊断按计划撤掉。

- **再提速**：`rollbackLedger` 原本自己又折了一遍表面（`/state` 已经折过），31k 事件等于走两遍；现在折一次、四个遍历共用同一份索引。

- `dsh-edit-turn` 同时把工具链依赖的 `dsh-session-format-catalog` 写进了 devDependencies（之前只在 node_modules 里，重装就丢）。

**0.4.5** —— `/state` 再提速（跟进 `dsh-edit-turn` 0.5.11）。

- **组件跟进**：`dsh-edit-turn` **0.5.11**、`dsh-rerun-turn` 0.2.6、`dsh-delete-turn` 0.1.15、`dsh-markdown-bubble` 0.1.5。

- 回复列表不再构建分块：同一个会话 **2,227 ms → 29 ms**（中间数据 22.4 MB → 1.1 MB）。编辑笔的出现不再等这一下。

**0.4.4** —— 复制失败的诊断（跟进 `dsh-edit-turn` 0.5.10）。

- **组件跟进**：`dsh-edit-turn` **0.5.10**（另三个不变：`dsh-rerun-turn` 0.2.6、`dsh-delete-turn` 0.1.15、`dsh-markdown-bubble` 0.1.5）。

- 复制仍拿到改写前的原文时，浏览器**标签页标题**会显示 `[复制诊断] <原因>`，用来定位是哪一环没接管；接管成功时标题自动恢复。

**0.4.3** —— 编辑入口不再"等半天才出现"（`/state` 从 25 MB 降到几百 KB）。

- **组件跟进**：`dsh-edit-turn` **0.5.9**（另三个不变：`dsh-rerun-turn` 0.2.6、`dsh-delete-turn` 0.1.15、`dsh-markdown-bubble` 0.1.5）。

- **症状**：编辑笔要等很久才出现；而且在这之前按复制，拿到的是改写前的原文。

- **根因（两件事同一个原因）**：`dsh-edit-turn` 的 `/state` 把每条回复的**整轮**推理与正文全文都发了出去。实测一个会话 291 条回复 = **27.9 MB**，一次 `/state` 要 **13 秒**。这段时间里浏览器半部没有任何编辑条目 —— 笔不出现，复制也就不会被插件接管。

- **修法**：`/state` 的 `replies` 只发身份（`seq` / `turn` / `messageId` / `attachments` / `textLength` / `blockCount`），全文与分块走新的 `/reply` 接口，只在按复制或打开编辑器时取一次。

**0.4.2** —— 复制拿到改写后的文本（改到平台写入器这一层）。

- **组件跟进**：`dsh-edit-turn` **0.5.8**（另三个不变：`dsh-rerun-turn` 0.2.6、`dsh-delete-turn` 0.1.15、`dsh-markdown-bubble` 0.1.5）。

- 0.4.1 里跟进的 0.5.7 没修好：它把"回答复制按下"从按钮节点挪到文档级捕获监听，实测仍复制出原文，说明这次按下没有经过那条路。0.5.8 换到**所有复制都要经过的唯一关口**——`navigator.clipboard.writeText`（宿主自己的 `writeClipboard` 原语内部就是调它）：写入的文本如果正是某条被改写消息的原文，就换成改写后的文本，其余写入一字不动。登记表放在页级（`globalThis` 上的 Symbol），因为实时重载后旧 bundle 装的包装器仍在写入路径上。

**0.4.1** —— 编辑过的消息，复制按钮被宿主重画之后仍然复制改写后的文本。

- **组件跟进**：`dsh-edit-turn` **0.5.7**（另三个不变：`dsh-rerun-turn` 0.2.6、`dsh-delete-turn` 0.1.15、`dsh-markdown-bubble` 0.1.5）。

- **复制拿到的是改写前的原文**：编辑一条消息后，界面上显示的是改写后的文本，但点那一排的复制按钮，粘出来的是原文。原因是这次按下原本由**挂在宿主那个按钮节点上**的捕获期监听回答，而动作条是宿主 React 画的——任何一次重渲染都可能换掉那个按钮节点，监听就跟着旧节点一起消失，按下于是落到宿主自己的处理上（它复制"这一行被画出来时的那条消息"）。现在改由**文档级捕获期监听按行**回答：与按钮是不是同一个节点无关，捕获期在 React 根节点之前，宿主自己的处理看不到这次按下。本包已把修好的 `dsh-edit-turn` 0.5.7 重新 vendor 进来并重建了浏览器 bundle。

**0.4.0** —— 少要一个平台包；四个组件跟进到最新。

- **不再要求 `dsh-tools`**：本包内置的宿主半部以前要 `@deepseek-ai/dsh-tools`，唯一原因是 `dsh-edit-turn` 向模型暴露了一个工具（`edit_turn_targets`）。那个工具已经删掉——编辑是靠 UI 面板做的，模型不需要知道这件事——于是整族插件都不再声明模型可见的工具，宿主半部的解析只需要 `dsh-session`。少一个平台包，就少一处跟宿主版本绑定的地方。

- **组件跟进**：`dsh-edit-turn` **0.5.6**、`dsh-rerun-turn` **0.2.6**；另两个不变（`dsh-delete-turn` 0.1.15、`dsh-markdown-bubble` 0.1.5）。

  - `dsh-edit-turn` 0.5.5 把模型工具拿掉；0.5.6 给会话日志裁剪工具加了"先验后写"（那个工具在 `tools/` 下、不随 npm 包发布，本包也不含它，只是版本号跟着走）。
  - `dsh-rerun-turn` 0.2.6 修 `sourceEventSeqs`：写入前摊平嵌套数组、去重、排序，并且**只接受真正的数字**——之前写出的形状（嵌套数组、缺项、倒序区间）会被宿主的校验器整条拒收，**整份会话日志都加载不了**。这是实测出来的：一个 29,497 事件的会话里有三条这样的记录，宿主三层校验全拒。

**0.3.0** —— 设置页搬到插件行自己的配置箭头；组件设置卡片直接复用组件自己的那一个。

- **设置页换了位置**：以前是「设置 → 插件 → AI Studio」里多一个标签页，和别的插件都不一样。现在注册到 `plugins.row.config`，键是 `dsh-as-aistudio#dsh-as-aistudio`（`<包名>#<行 id>` 的约定），于是**本包那一行**右侧多了配置箭头 —— 和这个 profile 里其它插件完全一致。点进去是整页：四个组件的实时状态，加下面的「组件设置」。
- **设置卡不再重画**：编辑样式、重跑方式、删除确认这三张卡，现在读组件自己导出的 `exports.ConfigCard`（`EditorStyleOption` / `AskBeforeRerunOption` / `AskBeforeDeleteOption`），渲染的就是组件那个组件函数本身。同一份设置、同一份存储键，组件页和本包页不会漂移；某个组件没跑起来时，它那张卡自动不出现。
- **每张卡用自己的字典**：卡里的文案（`config.style`、`config.ask` …）属于各组件自己的命名空间，本包按组件 id 取那个命名空间的翻译器再交给卡；否则屏幕上会原样打出键名。
- **版本不再「未知」**：四个组件的两半都内置在本包里，所以组件包**可以不装**。版本号以前从「已安装的包」读，于是不装就显示未知；现在 `tools/vendor.mjs` 在抄组件时写一份 `src/vendor/versions.json`，宿主半侧报的是**正在跑的那份代码**的版本（已安装的那份另记为 `installedVersion`）。实测四个包 `installed: false` 而 `mounted: true`，版本照样是 0.5.4 / 0.2.5 / 0.1.15 / 0.1.5。
- **组件跟进**：`dsh-edit-turn` 0.5.4、`dsh-rerun-turn` 0.2.5、`dsh-delete-turn` 0.1.15 —— 三者都导出了设置卡；rerun 另外把「顺补 / 自补」两个选项收成两个字、选项说明各收成一句、下拉宽度改成跟内容走。

**0.2.18** —— 报「正在跑的是哪一版」，不再依赖组件包是否安装。

**0.2.17** —— 重跑的下拉框宽度跟内容走（原来有 190px 下限，被撑满一行）。

**0.2.16** —— 重跑两个补法的选项说明各收成一句，去掉括号堆叠。

**0.2.15** —— 修正后的文案能真正进到页面：客户端按模块 id 缓存，旧 bundle 刷新也换不掉，换版本号是为了换 URL。

**0.2.14** —— 浏览器半侧与宿主半侧全部内置：本包没有任何运行时依赖，装它不会再装别的包；宿主半侧改为从运行中的 harness 解析平台包（`_platform.js`），并把组件导入的兄弟模块一起抄进来。

## English

**0.5.10** — the boot scan no longer freezes the host (the bug that left the session list empty).

- The whole scan now runs in a worker (`src/vendor/host/dsh-log-trim.worker.mjs`); the main thread only receives a summary. Measured here: 162 sessions with 12 large ones went from **117 s of blocked event loop** to a **43 ms worst stall**.
- Decompression, parsing and re-compression yield between slices (`readLogAsync` / `encodeLogAsync`), and between sessions.
- Two wasteful passes in `keepLastWindows`: `events.find()` inside a map over visible events was O(n²), and events that were about to be dropped were still `structuredClone`d. 18 MB log: 6.3 s → 1.6 s.
- The boot scan starts 3 s after mount so the first screen loads first.

**0.5.9** — fix a missing vendored verifier.

- `dsh-log-trim.js` / `lossless.js` dynamically import `dsh-log-trim.vendor.verify-session-log.mjs`, but 0.5.8 shipped only `dsh-log-trim.verify-session-log.mjs`, whose own import pointed at a non-existent `dsh-log-trim.compact-session.mjs`. Any trim reaching pre-write verification threw `Cannot find module`. Both names now exist and every internal import resolves.
- New `test/vendor-imports.test.js` scans all relative imports under `src/vendor/host/` so a dangling copy cannot ship again.

**0.3.0** — the settings page moved to this plugin's own row, and the component cards are the components' own.

- **A row surface instead of a settings tab**: registered under `plugins.row.config` with the `dsh-as-aistudio#dsh-as-aistudio` key (`<package name>#<row id>`), so OUR row in the plugin manager gains the configure arrow every other plugin in this profile already has.
- **No second implementation**: the edit, rerun and delete cards render each component's own `exports.ConfigCard`, so the two surfaces share one preference and one storage key; a component that is not running contributes no card.
- **Each card speaks its own namespace**, and the version comes from what is vendored (`src/vendor/versions.json`) rather than from an installed package, which is why a fully self-contained studio never reports "version unknown".
