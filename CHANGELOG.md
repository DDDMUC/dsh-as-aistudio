# 更新日志 / Changelog

本文档按语言分节；每条对应一个版本号。

## 中文

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

**0.3.0** — the settings page moved to this plugin's own row, and the component cards are the components' own.

- **A row surface instead of a settings tab**: registered under `plugins.row.config` with the `dsh-as-aistudio#dsh-as-aistudio` key (`<package name>#<row id>`), so OUR row in the plugin manager gains the configure arrow every other plugin in this profile already has.
- **No second implementation**: the edit, rerun and delete cards render each component's own `exports.ConfigCard`, so the two surfaces share one preference and one storage key; a component that is not running contributes no card.
- **Each card speaks its own namespace**, and the version comes from what is vendored (`src/vendor/versions.json`) rather than from an installed package, which is why a fully self-contained studio never reports "version unknown".
