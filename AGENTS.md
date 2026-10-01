# AGENTS.md — dsh-as-aistudio（给并行 agent 的说明）

本仓库是聚合插件 **dsh-as-aistudio** 的唯一正本。它**不包含**四个组件的实现：组件是各自仓库里的独立包，
这里只负责组合（`cordis.patch.yml` 的 5 行）、组件状态报告（`GET /api/dsh-as-aistudio/status`）与
设置页标签，以及五包共享的互操作契约 [docs/INTEROP.md](docs/INTEROP.md)。

## 当前状态（2026-10-01）

- 版本 **0.1.1**；`package.json` / `src/components.js` / `src/client.js` 三处版本号必须一致（`test/packaging.test.js` 的 "the studio version is one number in three places" 会拦）。
- 门禁：`npm test`（72 例，含 16 种子集的组合矩阵）。
- **0.1.1 是文档版本**：只改了 docs/INTEROP.md、README、AGENTS.md 与那条新测试，**尚未 npm publish**（npm 上 latest 仍是 0.1.0）；发布需用户明确要求。
- `optionalDependencies` 指向四个组件的**已发布**版本；改组件版本后必须同步这里再发布，否则 `npm i` 解析不到。
- 组件缺席是**正常状态**：其行在 import 阶段被 loader 隔离，状态面板如实报告，不要为它加"兜底"。

## 热重载纪律（2026-10-01「点不动」事故后新增，详见 docs/INTEROP.md §9）

**改任何组件的 client.js 之后必须重启宿主 + 硬刷新页面**，不要停在 HMR 混合态交付。混合态的症状是按钮可见
但点击静默无响应（组件 dispose 后主动早退，是刻意设计）；判断是否为混合态，先看宿主版本与 bundle 版本是否一致。

## 协作规则

- 组合矩阵（[test/combination.test.js](test/combination.test.js)）是需求 2 的回归网：任何改动组件注册（slot / id / order）的行为都必须让它保持全绿；它按 package `exports` 解析，解析不到才回退工作区路径。
- `cordis.patch.yml` 的行名必须是**裸包名**：客户端模块扫描器按 `<name>/package.json` 解析 `dsh.client`，subpath 会被缓存成"非客户端包"而静默不加载。
- 隐藏归因（`data-dshdt-hidden` / `data-dshet-hidden` / `data-dsrr-hidden`）与 slot order 分配是三个注入型组件的共享面：改一侧要检查另两侧。
- 不要替用户重启 / 发布（npm）/ force-push，除非用户明确要求。
