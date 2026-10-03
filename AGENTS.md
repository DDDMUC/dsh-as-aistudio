# AGENTS.md — dsh-as-aistudio（给并行 agent 的说明）

本仓库是聚合插件 **dsh-as-aistudio** 的唯一正本，**自包含**：插件列表里只有它一行。

## 架构（2026-10-02 起重写）

```
cordis.patch.yml    插 5 行：dsh-as-aistudio 自己（裸包名）+ 四条 dsh-as-aistudio/<后缀> 组件行
src/shell.js        组件行的壳：读 config.plugin，await import 后 ctx.plugin 挂真正的组件包
src/index.js        宿主半侧：不挂任何东西，只回答 /api/dsh-as-aistudio/status（hostMounted 读 Loader）
src/studio.js       studio 自己的浏览器半侧（源，注册 id dsh-as-aistudio）+ 四个 factory 的挂载门
src/vendor/*.js     四个组件的 browser factory，由 tools/vendor.mjs 逐字剥离生成，DO NOT EDIT
src/client.js       生成的单一大 bundle: studio + 四个 vendored factory，DO NOT EDIT
tools/vendor.mjs    重新生成 src/vendor/
tools/build.mjs     把 src/studio.js + src/vendor/*.js 缝成 src/client.js
tools/head.txt
tools/tail.txt      ↑ 生成器的字面片段
tools/tail2.txt
```

三条不变量（改这个包之前先读懂，测试都在盯）：

1. **只有一条 profile 行。** 插件列表是「活跃 Loader 行背后的包身份（name+version）去重集合」，
   `dsh-as-aistudio/edit` 这类子路径用 `barePackageName()` 解析回本包，所以多四条行**不多占列表行**。
   行名一旦写成组件自己的包名（`dsh-edit-turn`），列表立刻多一行 —— 用户的硬要求就破了。
2. **组件行的 name 必须是本包子路径。** 客户端模块扫描器只认「精确包说明符」，
   子路径会被跳过、且被缓存成「不是客户端包」——所以组件行永远不会变成第二份浏览器源。
   组件自己的行（裸包名）才带 `./client`，那份 bundle 里装着四个 factory。
3. **宿主半侧不许回流。** 四个组件已由四条行挂载，宿主再 `ctx.plugin` 一次就是同进程挂两遍，
   路由必冲突。`/status` 的 hostMounted 只从 `ctx.loader.entries()` 的行 fiber 状态读（state===2）。

四个组件是 **dependencies**（不是 optionalDependencies）：它们不再是 profile bundle，插件列表里没有自己的行，
缺席就意味着一条组件行导入失败、对应的功能真空。

改完哪个文件要重建什么：

| 改了 | 要跑 |
| --- | --- |
| 组件仓库（另三个 checkout） | `npm run vendor && node tools/build.mjs`（`npm run build` 两步都做） |
| src/studio.js | `node tools/build.mjs`（bundle 由它生成） |
| src/index.js / src/shell.js / src/components.js / cordis.patch.yml / package.json | 不用重建，宿主重启即生效 |

只想重建 bundle 时**别**用 `npm run build`：它会先从组件仓库重取 vendor 副本，
把别人尚未发布的改动一起拉进来。

## 固定流程

    npm run vendor      # 重新生成 src/vendor/（从组件仓库逐字复制）
    node tools/build.mjs   # 重新生成 src/client.js（单一大 bundle）
    node tools/vendor.mjs --check && node tools/build.mjs --check   # 只读校验，过期就 exit 1
    node tools/bump.mjs <版本>   # 三处版本号一起动，它自己断言只改该改的行
    npm test            # 全绿才往下走

**改了任何组件仓库，必须先跑前两条再动本仓库。** vendor-sync / build-sync 测试会拦住过期副本。
哪一类文件要重建什么，见上面的表。

## 热重载纪律（2026-10-01 事故后新增，见 docs/INTEROP.md §9）

**改 src/index.js 或 client 之后必须重启宿主 + 让页面硬刷新**，不要停在 HMR 混合态交付。混合态的症状是：路由 200 但行为是旧的、或组件宿主半侧已挂载而浏览器半侧还跑着上一版。

## 验收（发布前必跑，隔离环境）

    bash _aistudio-reports/verify/self.sh
    node _aistudio-reports/verify/self-gate.mjs <self.url> <self-dump.txt>

门禁断言（2026-10-02 实测全过；2026-10-04 起行结构改为 5 行，见上）：

1. 组合成的树里**没有以组件包名命名的行**：只有 `dsh-as-aistudio` 与四条 `dsh-as-aistudio/<后缀>`；
   插件列表（包身份去重）仍然只有一行；
2. /api/dsh-as-aistudio/status → hostMounted 4/4（读 Loader 行 fiber，不是自报），版本与组件实际安装版本一致；
3. GET /dsh-rerun-turn/state（不带 sessionId）→ **400 invalid**（证明 edit-turn 依赖的挂载探测契约仍在）；
4. boot graph 里 studio 在、**组件条目 0**（它们全在 studio 那份 bundle 里；四条组件行的子路径名被扫描器跳过）；
5. served bundle 200，含四个 factory_* 与 studio 自己的 __DSH_AS_AISTUDIO__。

## 推送

本机 github.com:443 超时、api.github.com 正常（0.3s）。用 REST API 推 blobs→tree→commit→ref，
**blob 请求必须带 encoding: base64**，commit 的 date 必须是 ISO 8601 且保留原时区偏移，
否则 sha 对不上、分支分叉。现成工具：node _aistudio-reports/verify/api-push.mjs DDDMUC/dsh-as-aistudio <repo-dir>。

## 协作规则

- 组件是**独立正本**：修组件去组件仓库，别在这边改；这边只生成副本。
- 不要删 test/combination.test.js 的任何断言 —— 它直接加载四个组件包，是本包架构变更时唯一的连续性保障。
- 不要替用户重启 / 发布（npm）/ force-push，除非用户明确要求。

