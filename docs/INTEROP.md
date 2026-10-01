# AI Studio 组件互操作契约 (v1)

> 本文档是四个组件插件 + 聚合插件 `dsh-as-aistudio` 之间**唯一**的跨包约定。
> 它是权威来源：任何组件在改动前必须对照本文件；冲突时以本文件为准。
> 目标：**任意子集都能装、都能跑、互不破坏**（1/2/3/4 个组件、以及叠加聚合插件的任意组合）。

## 0. 参与方

| 包名 | 角色 | 仓库 |
| --- | --- | --- |
| `dsh-delete-turn` | 组件：逐条消息删除 | https://github.com/DDDMUC/dsh-delete-turn |
| `dsh-edit-turn` | 组件：编辑任意用户轮次并重放 | https://github.com/DDDMUC/dsh-edit-turn |
| `dsh-rerun-turn` | 组件：原位重跑（infix rerun） | https://github.com/DDDMUC/dsh-rerun-turn |
| `dsh-markdown-bubble` | 组件：已发送消息的 Markdown 渲染 | https://github.com/DDDMUC/dsh-markdown-bubble |
| `dsh-as-aistudio` | 聚合：把上面四个组合成 AI Studio 式体验 | https://github.com/DDDMUC/dsh-as-aistudio |

运行环境：DSH `>=0.1.6-alpha.2`（本机实测 `0.2.0-rc.1`）；profile `web`、`desktop`、`headless` 共用同一套客户端插件机制。

## 1. 铁律（违反即为 Bug）

**I1 —— 零硬依赖。** 组件之间**不得**互相 `import`/`require`，不得把兄弟包写进 `dependencies`/`peerDependencies`/`devDependencies`。任何兄弟协作必须是「运行时探测 + 缺席时优雅退场」。

**I2 —— 唯一身份。** 每个插件在 `ctx.slots.register` 时使用自己的 `id`；同一 slot 上的 `order` 值必须全平台唯一（见 §2 分配表）。相同 `order` 的先后顺序未定义。

**I3 —— 只动自己的 DOM。** 向消息行注入节点时：
- 每个自建节点必须带 `data-<ns>-*` 命名空间属性（`dshdt`/`dshet`/`dsrr`）；
- **绝不**删除、改写、移动不是自己创建的节点；
- 绝不假设自己的节点是父节点的唯一子节点或最后一个子节点；
- 注入必须幂等：重复渲染找到已有节点就复用，不要再造一个。

**I4 —— 隐藏归因（本次重点修复项）。** 行/气泡的隐藏用**归属属性**表达：
`data-dshdt-hidden` (delete-turn)、`data-dshet-hidden` (edit-turn)、`data-dsrr-hidden` (rerun-turn)。
- 只有**设置了自己那个属性**的插件，才有资格清掉 `row.style.display`；
- 恢复可见前，必须确认**其他**归属属性都不存在（见 §4 的 `foreignHide` 辅助函数）；
- 绝不因为「我看不到 `display:none` 的来源」就把它清掉。

**I5 —— 缺席的兄弟不是错误。** 探测兄弟插件失败（404 / fetch 抛错 / 超时）必须走「缺席」分支并且**不报错、不弹提示**。禁止用 `console.error` 刷缺席态。

**I6 —— web / desktop 同构。** 客户端半侧不得依赖 web profile 专有的全局量（如 `window.__DSH_BOOT__`、`location.port`、特定 DOM 层级）。宿主路由一律走**相对路径**，不经 `location.origin` 拼接。loopback 校验留在宿主半侧。桌面端（Electron 壳）与浏览器共用同一份 client bundle，任何 `navigator.userAgent` 分支都必须有另一种实现的等价路径。

**I7 —— 功能冻结。** 本轮**只修 Bug / 加固兼容性**。不得删除、改名、或改变任何已有交互的语义（按钮文案、点击序列、确认步骤、路由契约、日志文案）。可以新增测试、新增防御分支、修正明显错误的行为。

**I8 —— 自己那半侧自洽。** 每个包的 `npm test` 必须全绿；`npm run verify:contract` / `verify:client`（若存在）必须全绿。新增测试请覆盖你修的那个 Bug。

**I9 —— 版本与文档同步。** 每个包修完后：`package.json` version +1（patch 位），`dsh.engines.dsh` 保持与宿主兼容，README 增补一行「修复」条目（中英各一条）。

## 2. Slot order 分配表（权威）

`conversation.chat.assistant-actions`（助手回复下方的操作条）：

| order | 插件 | id |
| --- | --- | --- |
| 5 | dsh-edit-turn | `edit-turn-reply` |
| 6 | dsh-rerun-turn | `rerun-turn-reply` |
| 40 | dsh-delete-turn | `delete-turn` |

→ **保持现状**，已唯一，不要改动。

`conversation.input.overlay`（输入框上方的浮层槽，零高度）：

| order | 插件 | id |
| --- | --- | --- |
| 8 | dsh-delete-turn | `delete-turn` |
| 9 | dsh-edit-turn | `edit-turn` |
| 10 | dsh-rerun-turn | `rerun-turn` |

→ **dsh-rerun-turn 需从 8 改为 10**（当前与 delete-turn 撞号）。`dsh-as-aistudio` 自己的浮层用 order `12`，id `as-aistudio-overlay`。

## 3. 兄弟探测协议（edit-turn ↔ rerun-turn）

`dsh-edit-turn` 的编辑器里有一个「重跑」按钮，它的拥有者是 `dsh-rerun-turn`。探测方式（现状，**保留**）：

```js
const response = await fetch(`${RERUN_PREFIX}/state`, { headers: { accept: 'application/json' } })
const present = response.status === 400 || response.status === 405
```

补充硬化要求：
- 探测结果为 `unknown` 时**不要**渲染兄弟按钮（避免闪一下又消失）；
- 任何 `fetch` 异常都归入 `absent`，且不得 `console.error`；
- 探测必须在每次编辑器打开时刷新，缓存上限 = 一次会话内一次（现状即可）。

## 4. 隐藏归因辅助函数（每个组件各自拷一份，约 10 行，**不共享包**）

```js
// 三个组件的隐藏归属属性。别的插件设的隐藏，我不能清掉。
const HIDE_OWNERS = [
  ['dshdt', 'data-dshdt-hidden', 'dshdtHidden'],
  ['dshet', 'data-dshet-hidden', 'dshetHidden'],
  ['dsrr', 'data-dsrr-hidden', 'dsrrHidden'],
]
/** 除 `own` 之外，还有别的插件声明了隐藏吗？ */
function foreignHideOn(row, own) {
  for (const [key, attr, prop] of HIDE_OWNERS) {
    if (key === own) continue
    if (row.dataset?.[prop] === '1') return true
    if (typeof row.hasAttribute === 'function' && row.hasAttribute(attr)) return true
  }
  return false
}
```

用法：**任何把 `row.style.display` 置回 `''` 的地方**，先问 `foreignHideOn(row, 'dsrr')`；为真时保持 `display:none`（即别人的隐藏继续生效）。

## 5. 消息行操作条的注入契约

三个组件都会往「用户消息行 / 助手回复行」的操作条里塞按钮。

- 锚点：**行内已有的操作条**；找不到就退到行尾，不要凭空造一条 bar；
- 插入位置右对齐、不挤掉宿主自己的按钮；
- 每次 MutationObserver 回调都要**先找自己的按钮**（按 `data-<ns>-*`），找到就只做状态同步（`disabled`/文案），不要 remove+re-insert（会丢焦点、会闪）；
- `display:none` 的按钮必须能被第二次扫描跳过，不要堆积幽灵节点。

## 6. Web / Desktop 契约

- 宿主路由：相对路径 `/dsh-<name>/*` 或 `/api/dsh-<name>/*`，客户端一律 `fetch(prefix + ...)` 相对调用；
- 不得使用 `window.open`、`showDirectoryPicker`、剪贴板特权 API；
- 不得依赖 `<dialog>` 的 top-layer、`popover`、`CSS anchor positioning` 等仅在特定 Chromium 版本可用的特性（桌面端壳的 Chromium 版本可能更旧）；
- 字体/字号跟随平台设置（历史 Bug：改写气泡不跟随平台字号）；
- 键盘事件只监听 `keydown`，并且不 `preventDefault` 平台快捷键（`Cmd/Ctrl+K` 等）。

## 7. 交付物（每个组件）

1. 代码修复（只在自己的仓库里）；
2. 新增/更新测试，覆盖修复点；
3. `README.md` 增补一行修复说明（中文 1 行 + English 1 行）；
4. `package.json` version patch +1；
5. 一份 `FIXES.md`（或等价报告）写在会话工作区：`/Users/337mu/Documents/Default Project/_aistudio-reports/<包名>.md`，内容：**症状 / 证据（file:line）/ 修复 / 验证命令与结果 / 未解决项**。

## 8. 验收（聚合方会跑）

1. 每个包：`npm test`（+ `verify:*`）全绿；
2. 组合矩阵：把 4 个 client bundle 以 2^4 种组合装载进同一个 DOM stub，断言：无异常、slot 注册 id 唯一、无重复按钮、隐藏归因正确；
3. 真机：web profile 装载 `dsh-as-aistudio` + 任意子集，页面加载无 `error` 级别日志。
## 9. 热重载纪律（HMR）—— 2026-10-01「点不动」事故后新增

**改任何组件的 `client.js` 之后，必须重启宿主进程 + 让页面硬刷新，不要把 HMR 混合态交付给用户。**

事故形态（dsh-rerun-turn，2026-10-01 13:5x）：用户点回答行 / 用户行的 ↻ 没有任何反应，宿主 `/debug` 也收不到 `apply` 请求；直取 `/plugins/<id>/client.js` 返回空。
根因不是代码缺陷，而是**混合态**：client bundle 被 HMR 单独重载（0.1.21 / 0.1.22 的改动触发了多次），而宿主进程没有重启 —— 页面里是「新 bundle 实例 + 旧实例已 dispose 的控制器 / 旧按钮上已死的监听」。
恢复动作：**重启宿主 + 硬刷新页面**（重启后 host 0.1.22、bundle 200 非空、两处 ↻ 点击均正常触发 `apply`）。

配套约定：

- 交付前检查三件事：宿主版本 == bundle 版本；`/plugins/<entry>/client.js` 返回 200 且非空；行上的动作按钮真的点得动。
- 组件在 `dispose` 之后会主动早退（不唤醒已退休的控制器），所以混合态表现为**静默无响应**而不是报错 —— 这是刻意的设计，不是 Bug；遇到它先重启宿主再判断。
- 跨端（host / client）不兼容改动必须 bump 三处版本号（`package.json` + 宿主半侧 + 浏览器半侧）并跑该仓库的全部门禁。
- 本契约的 §2（slot order 分配）与 §4（隐藏归因）属于三个注入型组件的**共享面**：改其中一侧，必须同时检查另外两侧不受影响；组合矩阵（`dsh-as-aistudio/test/combination.test.js`）是这条规则的回归网。
## 10. 跨插件运行时契约：dsh-edit-turn → dsh-rerun-turn

这是**唯一一条两个组件之间真实存在的运行时依赖**，也是唯一一条不走 DOM、只走回环 HTTP 的依赖。写在契约里，
是因为它跨越两个仓库、两个维护者，任何一侧单独改动都不会让另一侧的测试变红。

流程（`dsh-edit-turn` 0.2.12+ 的提示词编辑器「重跑」按钮）：

1. 按钮**只在探测到 rerun-turn 挂载时**出现：不带 `sessionId` 请求 `GET /dsh-rerun-turn/state`，
   按 **400 / 405 = 装着、404 = 没装** 判定；
2. 点击后先 `POST /dsh-edit-turn/apply` 就地保存改写（不调模型），
3. 紧接着链式 `POST /dsh-rerun-turn/apply { sessionId, seq }`，其中 `seq` 取自 rerun-turn `/state` 的
   `replies[]`（匹配被编辑那一轮的 `turn`、取 `seq` 最大者）；
4. rerun-turn 侧的 `planRerun` 沿 `source.kind = plugin:dsh-edit-turn` 的就地替换链读**活节点**，
   于是重跑用改后的措辞生成。

双向边界：

- edit-turn **只**走 rerun-turn 的公开回环路由，不碰对方的 client 半侧或 DOM；
- 反过来，**纯 dsh-edit-turn（没装 rerun-turn）没有任何重跑入口** —— 编辑器只有「取消 / 保存」。

不许改的形状（回归测试：`dsh-rerun-turn/test/contract.test.js`，16 例，已做变异验证）：

| 形状 | 约束 |
| --- | --- |
| 挂载探测 | 不带 `sessionId` 的 `GET /state` 必须仍答 400；改成 404 按钮会静默消失 |
| 目标列表 | `/state` 持续返回完整的 `replies[{seq, turn}]` |
| 调用形状 | `POST /apply` 只要求 `sessionId` + (`seq` \| `messageId`)，**不得新增必填参数** |
| 载荷 | edit-turn 不传文本；未知字段必须被忽略而不是 400 |
| 错误码 | `not-rerunnable` / `already-retired` / `busy` / `rerunning` / `stale` / `session-not-found` / `session-not-active` / `invalid` 机读且稳定（edit-turn 原样提示给用户） |
| 链式解析 | `planRerun` 继续跟随就地替换链取活文本 |

**给改这两个包的 agent**：动路由、`planRerun` 或错误码之前，先在 `dsh-rerun-turn` 跑
`node --test test/contract.test.js`；把探测状态的 400 改成 404 会让 2 例转红，给 `/apply` 加一个必填
`confirmToken` 会让 5 例转红 —— 破坏契约会在本地就暴露，而不是等用户发现按钮点不动。
