# AGENTS.md — dsh-as-aistudio（给并行 agent 的说明）

本仓库是聚合插件 **dsh-as-aistudio** 的唯一正本，**自包含**：插件列表里只有它一行。

## 架构（2026-10-02 起重写）

```
cordis.patch.yml    只插一行：dsh-as-aistudio 自己
src/index.js        宿主半侧：await import 四个组件 + ctx.plugin 挂载 + /api/dsh-as-aistudio/status
src/studio.js       studio 自己的浏览器半侧（源，注册 id dsh-as-aistudio-studio）
src/vendor/*.js     四个组件的 browser factory，由 tools/vendor.mjs 逐字剥离生成，DO NOT EDIT
src/client.js       生成的单一大 bundle: studio + 四个 vendored factory，DO NOT EDIT
tools/vendor.mjs    重新生成 src/vendor/
tools/build.mjs     把 src/studio.js + src/vendor/*.js 缝成 src/client.js
tools/head.txt
tools/tail.txt      ↑ 生成器的字面片段
tools/tail2.txt
```

四个组件是 **dependencies**（不是 optionalDependencies，因为它们不再是行，缺席就意味着功能真空）。

## 每次改动的固定流程

    npm run vendor      # 重新生成 src/vendor/（从组件仓库逐字复制）
    npm run build       # 重新生成 src/client.js（单一大 bundle）
    npm run verify:vendor && npm run verify:build   # 只读校验，过期就 exit 1
    npm test            # 全绿才往下走

**改了任何组件仓库，必须先跑上面四条再动本仓库。** vendor-sync / build-sync 测试会拦住过期副本。

## 热重载纪律（2026-10-01 事故后新增，见 docs/INTEROP.md §9）

**改 src/index.js 或 client 之后必须重启宿主 + 让页面硬刷新**，不要停在 HMR 混合态交付。混合态的症状是：路由 200 但行为是旧的、或组件宿主半侧已挂载而浏览器半侧还跑着上一版。

## 验收（发布前必跑，隔离环境）

    bash _aistudio-reports/verify/self.sh
    node _aistudio-reports/verify/self-gate.mjs <self.url> <self-dump.txt>

门禁断言（2026-10-02 实测全过）：

1. 组合成的 184 行里**四个组件一行都没有**，只有 dsh-as-aistudio；
2. /api/dsh-as-aistudio/status → hostMounted 4/4，版本与组件实际安装版本一致；
3. GET /dsh-rerun-turn/state（不带 sessionId）→ **400 invalid**（证明 edit-turn 依赖的挂载探测契约仍在）；
4. boot graph 66 条，studio 在、**组件条目 0**（它们全在 bundle 里）；
5. served bundle 200，含四个 factory_* 与 studio 自己的 __DSH_AS_AISTUDIO__。

## 推送

本机 github.com:443 超时、api.github.com 正常（0.3s）。用 REST API 推 blobs→tree→commit→ref，
**blob 请求必须带 encoding: base64**，commit 的 date 必须是 ISO 8601 且保留原时区偏移，
否则 sha 对不上、分支分叉。现成工具：node _aistudio-reports/verify/api-push.mjs DDDMUC/dsh-as-aistudio <repo-dir>。

## 协作规则

- 组件是**独立正本**：修组件去组件仓库，别在这边改；这边只生成副本。
- 不要删 test/combination.test.js 的任何断言 —— 它直接加载四个组件包，是本包架构变更时唯一的连续性保障。
- 不要替用户重启 / 发布（npm）/ force-push，除非用户明确要求。

