// dsh-bubble-pro browser half, VENDORED by tools/vendor.mjs - DO NOT EDIT.
//
// Source: ../dsh-bubble-pro/src/client.js  (v0.1.0, sha256 0efa865641ac2fd5)
// Regenerate with `npm run vendor`; test/vendor-sync.test.js fails when this is stale.
//
// The component registers its factory with the host module loader; inside this
// package the factory is called directly, so only the outer wrapper is replaced.
// The factory body is the component own code, unchanged.
export default (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const NS = 'dsh-bubble-pro'
    const PLUGIN_VERSION = '0.1.0'
    const CSS_TAG = NS + '/bubble-pro.css'

    /** 只覆盖 markdown-bubble 自己的类名：不碰宿主命名的节点。 */
    const CSS = `
/* 1. 整列铺满：Lite 的 70% 上限放开，与输入框同一列宽。 */
.dshmb-stack{max-width:100%!important;width:100%!important;align-items:stretch!important}
/* 2. 去掉气泡外观：没有底色、圆角、内边距，文字直接落在页面上。 */
.dshmb-bubble{background:none!important;border:none!important;border-radius:0!important;padding:0!important;max-width:100%!important;width:100%!important;box-sizing:border-box}
/* 3. 记录式的呼吸：下边一条细分隔线 + 段间距，读起来像文档而不是聊天。 */
.dshmb-stack{padding-bottom:14px!important;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(16,24,40,.12));margin-bottom:14px!important}
/* 4. 附件、文件卡也跟着铺开，但保持可读的宽度。 */
.dshmb-attachments{justify-content:flex-start!important}
`

    /** 注入样式表（按自己的 tag 去重）。 */
    function injectStyles() {
      if (typeof document === 'undefined') return
      if (document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_TAG) + ']') !== null) return
      const tag = document.createElement('style')
      tag.dataset.plugin = NS
      tag.dataset.pluginCss = CSS_TAG
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    /** 移除本插件注入的样式表。 */
    function removeStyles() {
      if (typeof document === 'undefined') return
      const tag = document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_TAG) + ']')
      if (tag !== null) tag.remove()
    }

    /**
     * 浏览器插件体：只注入样式，不替换任何座位。
     * @param {object} ctx - 客户端 cordis 上下文。
     */
    function apply(ctx) {
      injectStyles()
      ctx.effect(
        () => () => {
          removeStyles()
        },
        NS + ': lifecycle',
      )
    }

    exports.apply = apply
    exports.inject = []
    exports.PLUGIN_VERSION = PLUGIN_VERSION
    return module.exports
  }
