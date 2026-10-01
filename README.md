# dsh-as-aistudio

**把 DeepSeek Harness 用成 Google AI Studio —— 一轮对话就是一个可以反复打磨的 prompt playground。** 改一句提示词并重跑、原位重跑某条回复、把不该留下的那一轮从模型上下文里删掉、让发出的提示词按 Markdown 渲染。这四个能力各自是一个独立插件，本包把它们组合成一次安装，并在「设置 → 插件 → AI Studio」里如实报告哪几个真的活着。

[中文](#中文) · [English](#english)

---

## 中文

### 为什么需要它

AI Studio 的好用之处不在模型，在于**一轮对话中的每一步都能回头改**：提示词写错了就地改完再跑一次、这次答得不好原地重跑、这段不该进上下文就删掉。DSH 的会话日志是 append-only 的，官方只提供整段压缩（`/compact`），没有轮次级的编辑、重跑与删除。

这四个组件补上了这一层，而本包负责让它们**装得下、合得来、看得见**：

- **装得下** —— 一次安装启用整条动作条；
- **合得来** —— 四个组件各自独立、可任意子集共存，互操作契约由本包固化并测试；
- **看得见** —— 谁装了、谁启用了、谁缺席，面板上一目了然。

### 特性

- **一次安装，整条动作条** —— 安装本包即可启用编辑、原位重跑、删除与 Markdown 气泡四个组件；
- **任意子集都能跑** —— 只装其中一个组件时它自己就是完整功能；装两个、三个、四个，或者叠加本包，都不会重复挂载、不会抢同一行；
- **组件仍是独立包** —— 每个组件有自己的仓库、自己的 `cordis.patch.yml`、自己单独的安装方式；本包**不内联、不魔改**它们的代码；
- **互操作契约可验证** —— slot order 分配、行隐藏归属、兄弟探测协议写在 `docs/INTEROP.md`，并由 `test/manifest.test.js` 断言；
- **如实报告** —— `GET /api/dsh-as-aistudio/status` 与设置面板区分「已启用 / 已安装未启用 / 未安装」，缺失组件只会退化，不会把宿主带崩；
- **web 与桌面端同构** —— 浏览器半侧只注册一个设置页标签、只发一次相对路径请求；没有 DOM 注入、没有 MutationObserver、没有键盘监听。

### 组件

| 组件 | 能力 | 仓库 |
| --- | --- | --- |
| `dsh-edit-turn` | 就地改提示词并重跑（回滚到那一条之前） | <https://github.com/DDDMUC/dsh-edit-turn> |
| `dsh-rerun-turn` | 原位重跑：同一句提示词重新生成，后续轮次原样存活 | <https://github.com/DDDMUC/dsh-rerun-turn> |
| `dsh-delete-turn` | 把一条消息 / 一个步骤 / 整条回复从模型上下文里拿掉 | <https://github.com/DDDMUC/dsh-delete-turn> |
| `dsh-markdown-bubble` | 已发送的提示词按 Markdown 渲染 | <https://github.com/DDDMUC/dsh-markdown-bubble> |

四个组件都是**可选依赖**（`optionalDependencies`）：装不上、被移除、离线都只会让对应那一行缺席，本包照常启动。

### 安装

```sh
# AI Studio 全家桶（studio + 四个组件一起启用）
dsh plugin --profile web add dsh-as-aistudio

# 只想要其中一个能力，就单独装那一个
dsh plugin --profile web add dsh-delete-turn
```

桌面端把 `--profile web` 换成 `--profile desktop` 即可，两端共用同一份浏览器半侧。

### 使用

装好后，动作条就在消息行上：

1. 悬停**你发出的那条消息** → 铅笔（编辑并重跑）；
2. 悬停**模型的回复** → 重跑 / 删除；
3. 「设置 → 插件」多出一个 **AI Studio** 标签页，列出每个组件的实时状态、版本、它占用的槽位，以及互操作契约的分配表。

### 工作原理

- 本包的 `cordis.patch.yml` 为**自己和四个组件**各插入一行，行的 `name` 就是组件的裸包名 —— 这是客户端模块扫描器解析 `dsh.client` 声明的方式；
- 宿主侧只做一件事：读 loader 的条目树，回答「这个组件现在有没有启用的条目、装的是哪个版本」，走 loopback-only 的 `/api/dsh-as-aistudio/status`；
- 浏览器侧只做一件事：往 `settings.plugins.tab` 注册一个标签页；
- 条目树按 id 归并，所以「本包插入的行」与「组件自己的 bundle 插入的行」会合并成**一个**条目，而不是挂载两次；
- 某个组件缺席时，它的那一行会在 import 阶段失败并被 loader 隔离，其余行照常启动。

### 已修复 / 版本

- 0.1.1 —— 契约补 §9「热重载纪律」（2026-10-01「点不动」事故：client bundle 单独热重载 + 宿主未重启 = 混合态）；新增 AGENTS.md 与三处版本号一致性测试。
- 0.1.0 —— 首个版本：组合四个组件、固化互操作契约、报告组件状态。

### 已知限制

- 动作条本身由四个组件各自渲染，本包不接管；某个组件缺席时它那一个按钮就不会出现，这符合预期；
- 状态面板不提供开关：启用/禁用条目请在「设置 → 插件」的官方列表里做，那是平台自己的所有权；
- 组件缺席时，宿主日志会有一条该条目的 import 失败记录。这是 loader 的诚实报错，不是本包的异常。

### 兼容性

- DSH `>=0.1.6-alpha.2`（`0.2.0-rc.1` 实测通过）；
- profile：`web`、`desktop`（`headless` 无 Web 界面，仅宿主半侧可用）；
- 四个组件都可单独安装，也可以任意子集叠加本包。

### License

MIT

---

## English

### Why you need it

What makes AI Studio pleasant is not the model: it is that **every step of a turn can be revisited**. Rewrite a prompt in place and run it again, regenerate a reply without disturbing what came later, remove a turn that should never have entered the context. DSH's session log is append-only and the platform only offers whole-transcript compaction (`/compact`) — there is no per-turn edit, re-run or delete.

Four components supply that layer. This package makes them **installable, compatible and visible**:

- **installable** — one install turns on the whole action strip;
- **compatible** — each component is independent and any subset coexists; the interop contract is pinned here and tested;
- **visible** — which component is installed, enabled or absent, on one panel.

### Features

- **One install, the whole strip** — installing this package enables edit, re-run, delete and the Markdown bubble;
- **Any subset works** — one component alone is a complete feature; two, three, four, or components plus this package never double-mount and never fight over a row;
- **Components stay independent packages** — each keeps its own repo, its own `cordis.patch.yml` and its own install path; this package does not inline or rewrite their code;
- **A verifiable interop contract** — slot orders, row-hide ownership and the sibling probe protocol live in `docs/INTEROP.md` and are asserted by `test/manifest.test.js`;
- **Honest reporting** — `GET /api/dsh-as-aistudio/status` and the settings panel distinguish enabled / installed-not-enabled / absent; a missing component degrades, never breaks the host;
- **Web and desktop are one implementation** — the browser half registers one settings tab and makes one relative-path request; no DOM injection, no MutationObserver, no keyboard listener.

### Components

| Component | What it does | Repo |
| --- | --- | --- |
| `dsh-edit-turn` | Rewrite a prompt in place and re-run it (rolls back to just before that turn) | <https://github.com/DDDMUC/dsh-edit-turn> |
| `dsh-rerun-turn` | Infix re-run: regenerate one reply from the same prompt, later turns survive | <https://github.com/DDDMUC/dsh-rerun-turn> |
| `dsh-delete-turn` | Remove a message, a step or a whole reply from the derived model context | <https://github.com/DDDMUC/dsh-delete-turn> |
| `dsh-markdown-bubble` | Render sent prompts as Markdown | <https://github.com/DDDMUC/dsh-markdown-bubble> |

All four are **optional dependencies**: a component that cannot be installed, was removed, or is unavailable offline simply misses its row; the studio still boots.

### Install

```sh
# The whole AI Studio set (studio plus its four components)
dsh plugin --profile web add dsh-as-aistudio

# Or just one capability
dsh plugin --profile web add dsh-delete-turn
```

On the desktop app use `--profile desktop`; both share the same browser half.

### Usage

The action strip lives on the message rows:

1. Hover **a message you sent** → the pencil (edit and re-run);
2. Hover **a model reply** → re-run / delete;
3. Settings → Plugins gains an **AI Studio** tab listing each component's live state, version, the slot it claims, and the interop allocation.

### How it works

- This package's `cordis.patch.yml` inserts one row for itself and one per component, each named by the component's bare package name — that is how the client-module scanner resolves a `dsh.client` declaration;
- The host half does one thing: read the loader's entry tree and answer "does this component have an enabled entry, and which version is installed", over a loopback-only `/api/dsh-as-aistudio/status`;
- The browser half does one thing: register a tab into `settings.plugins.tab`;
- The entry tree is keyed by id, so a row inserted by this patch and the same row inserted by a component's own bundle merge into **one** entry instead of mounting the plugin twice;
- A missing component fails at import and is isolated by the loader; every other row still starts.

### Fixes / versions

- 0.1.1 — contract gains §9 "hot reload discipline" (the 2026-10-01 dead-button incident: a client bundle hot-reloaded alone while the host kept running is a mixed state); adds AGENTS.md and a three-place version check.
- 0.1.0 — first release: composes the four components, pins the interop contract, reports component status.

### Known limitations

- The action strip is rendered by the components themselves; this package does not take it over. A missing component means its button is absent, which is the point;
- The panel reports but does not toggle: enable or disable a row in the platform's own Settings → Plugins list, which owns that state;
- A missing component leaves one import failure in the host log. That is the loader being honest, not an exception from this package.

### Compatibility

- DSH `>=0.1.6-alpha.2` (verified on `0.2.0-rc.1`);
- Profiles: `web`, `desktop` (`headless` has no web surface; the host half still loads);
- Every component installs alone, and any subset composes with this package.

### License

MIT
