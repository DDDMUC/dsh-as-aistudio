# dsh-as-aistudio

**把 DeepSeek Harness 用成 Google AI Studio —— 一轮对话就是一个可以反复打磨的 prompt playground，而且插件列表里只占一行。** 改一句提示词并重跑、原位重跑某条回复、把不该留下的那一轮从模型上下文里删掉、让发出的提示词按 Markdown 渲染。

[中文](#中文) · [English](#english)

---

## 中文

### 为什么需要它

AI Studio 的好用之处不在模型，在于一轮对话中的每一步都能回头改。DSH 官方只提供整段压缩（/compact），没有轮次级的编辑、重跑与删除。

四个组件补上了这一层，而这个包负责让它们装得下、合得来、看得见：

- **装得下** —— 自包含安装，一次装完；
- **合得来** —— 四个组件各自独立、任意子集共存，互操作契约由本包固化并测试；
- **看得见** —— 设置 → 插件 → AI Studio 面板如实报告哪几个真的活着。

### 特性

- **一行搞定** —— 插件列表里只有 AI Studio 一行。四个组件是本包的 dependencies，由本包的四个补丁行 `dsh-as-aistudio/edit` 等挂载（详情页因此能列出这 4 个组件），不再各自占一行（和 @linxin666/dsh-web-all 同一个模式）。
- **组件仍是独立包** —— 每个都有自己的仓库与 cordis.patch.yml，单独安装照样工作；本包不复制任何组件逻辑：宿主半侧（路由、回滚、重放）就是组件自己，浏览器 factory 由 tools/vendor.mjs 从组件源码逐字剥离生成。
- **副本不会漂移** —— npm run vendor 重新生成内联包，npm run build 重新生成大 bundle，verify:vendor / verify:build 是只读校验；测试里 vendor-sync / build-sync 会在副本过期时失败。
- **一个挂了不影响其余** —— 四个 vendored factory 各自带 guard 挂载，一个抛错不会带走另外三个。
- **互操作契约可验证** —— slot order 分配、行隐藏归属、兄弟探测协议写在 docs/INTEROP.md，并由组合矩阵测试断言。
- **web 与桌面端同构** —— 同一份 dsh.client.platform: web bundle；没有 location.origin / window.open / navigator.* / dialog / popover。

### 安装

```sh
dsh plugin --profile web add dsh-as-aistudio
```

桌面端把 --profile web 换成 --profile desktop。四个组件会作为 dependencies 一起装上，不需要逐个装。

### 使用

装好后动作条就在消息行上：

1. 悬停你发出的那条消息 → 铅笔（编辑并重跑）；
2. 悬停模型的回复 → 重跑 / 删除；
3. 设置 → 插件 多出一个 AI Studio 标签页，列出每个组件的实时状态、版本、占用的槽位，以及互操作契约分配表。

### 工作原理

- **四个组件行**（cordis.patch.yml + src/shell.js）：每个组件一条 `dsh-as-aistudio/<后缀>` 行，行名经本包 `exports` 全部指向同一个壳文件，壳读行配置里的 `config.plugin` 并 `import` + `ctx.plugin` 挂真正的组件包 —— 组件的 loopback 路由与回滚/重放服务因此就位。缺哪个报哪个，绝不致命；宿主半侧自己一个组件都不挂（再挂一次就是挂两遍，路由必冲突）。
- **浏览器半侧**（src/client.js，由 tools/build.mjs 生成）：单一大 bundle —— studio 自己的浏览器半侧 + 四个组件的 factory（各自 var module / var exports / const react，靠 var 提升共处一个 scope）。bundle 是按 Loader 行下发的，所以这是它们到达页面的唯一方式。
- **为什么宿主半侧不内联**：宿主代码对插件列表不可见，复制它只会凭空多出一份要维护的东西。
- **状态面板**：读 GET /api/dsh-as-aistudio/status，对每个组件报告 installed / hostMounted / version / ownRows（ownRows 大于 0 表示它还被独立安装着）。hostMounted 不是自报，是从 Loader 读那一条行的 fiber 状态（只有 state === 2 才算活着），所以关掉的行、没装好的包、起失败的组件都会如实显示成因。
- **挂载门**：浏览器半侧挂载前先读一次这道状态，只画 hostMounted 为真的组件 —— 宿主没挂起来就没有路由，按钮画出来也点不动。宿主答不上来时按「未知」处理，四个都挂（保持旧行为）。

### 已知限制

- 四个组件的 browser factory 是生成副本。改了组件必须 npm run vendor && npm run build 再发本包；verify:vendor / verify:build 会拦住过期副本。
- 组件缺席（有人手动删了依赖）时，它的 browser half 不会挂载，面板显示「已安装，宿主未挂载」或「未安装」。
- 宿主版本常量只在进程启动时读一次：改了本包要重启宿主 + 硬刷新。

### 兼容性

- DSH >=0.1.6-alpha.2（0.2.0-rc.1 实测通过）；
- profile：web、desktop；
- 四个组件都可单独安装，也可以任意子集和本包共存。

### License

MIT

---

## English

### Why you need it

What makes AI Studio pleasant is not the model: it is that every step of a turn can be revisited. DSH offers whole-transcript compaction only. Four components add turn-level edit, re-run and delete; this package makes them installable, compatible and visible.

### Features

- **One row** — the plugin list shows only AI Studio. The four components are dependencies mounted by this package's four patch rows (`dsh-as-aistudio/edit` and friends, which is why the detail page can list all four) and no longer occupy rows of their own (the @linxin666/dsh-web-all pattern).
- **Components stay independent packages** — each keeps its own repo and its own cordis.patch.yml and works alone. This package copies no component logic: the host halves ARE the components, and the browser factories are lifted verbatim from their sources by tools/vendor.mjs.
- **The vendored copy cannot drift** — npm run vendor regenerates it, npm run build regenerates the bundle, and verify:vendor / verify:build are read-only gates; the test suite fails on a stale copy.
- **One failure does not take the rest** — each vendored factory mounts behind its own guard.
- **A verifiable interop contract** — slot orders, row-hide ownership and the sibling probe protocol live in docs/INTEROP.md and are asserted by the combination matrix.
- **Web and desktop are one implementation** — the same dsh.client.platform: web bundle; no location.origin, window.open, navigator.*, dialog or popover.

### Install

```sh
dsh plugin --profile web add dsh-as-aistudio
```

Use --profile desktop on the desktop app. The four components arrive as dependencies; there is nothing else to install.

### Usage

1. Hover a message you sent → the pencil (edit and re-run);
2. Hover a model reply → re-run / delete;
3. Settings → Plugins gains an AI Studio tab listing each component's live state, version, the slot it claims, and the interop allocation.

### How it works

- **The four component rows** (cordis.patch.yml + src/shell.js): one row per component, named `dsh-as-aistudio/<suffix>`; every one of those names maps through this package's exports to the same shell, which reads `config.plugin` from the row and imports + applies the real component package — that is what puts its loopback routes and its rollback / replay services in place. A missing one is reported, never fatal. The host half itself mounts nothing: mounting here too would run every component twice and collide on its routes.
- **Browser half** (src/client.js, generated by tools/build.mjs): one bundle — the studio's own browser half plus the four component factories, each with its own var module / var exports / const react in one scope via hoisting. A bundle is served per Loader row, so this is the only way they can reach the page.
- **Why the host halves are not vendored**: host code is invisible to the plugin list, so copying it would only create a second thing to fix.
- **The panel** reads GET /api/dsh-as-aistudio/status and reports installed / hostMounted / version / ownRows per component (ownRows greater than 0 means it is also installed standalone). hostMounted is not self-reported: it is read from the Loader row's fiber state (only state === 2 counts as live), so a disabled row, a missing package and a failed start each show their own reason.
- **The mount gate**: before mounting anything, the browser half reads that status once and draws only the components it calls mounted — a component whose host half is not up has no routes, so its buttons would do nothing. A host that cannot answer is treated as unknown and all four mount, which is the pre-gate behaviour.

### Known limitations

- The four browser factories are a generated copy. After changing a component, run npm run vendor && npm run build before releasing this package; the verify gates block a stale copy.
- A component that is somehow absent is not mounted and the panel says so.
- The host version constant is read once at process start: after changing this package, restart the host and hard-refresh.

### Compatibility

- DSH >=0.1.6-alpha.2 (verified on 0.2.0-rc.1);
- Profiles: web, desktop;
- Every component installs alone, and any subset coexists with this package.

### License

MIT

