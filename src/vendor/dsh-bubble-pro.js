// dsh-bubble-pro browser half, VENDORED by tools/vendor.mjs - DO NOT EDIT.
//
// Source: ../dsh-bubble-pro/src/client.js  (v0.1.0, sha256 c544937233dc6221)
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
/* 目标：用户消息从对话列最左到最右，宽度与输入框一致，不画气泡。
   两种 DOM 都要覆盖：
     a) 宿主自己的 UserMessageBubble（带 data-message-bubble）
     b) 气泡 Lite 的 .dshmb-* 座位
   任何一方命中都能生效，互不依赖。 */

/* 1) 宿主气泡 */
[data-message-bubble]{
  background:none!important;border:none!important;border-radius:0!important;
  padding:0!important;max-width:100%!important;width:100%!important;box-sizing:border-box;
}
/* 2) Lite 座位 */
.dshmb-stack{max-width:100%!important;width:100%!important;align-items:stretch!important}
.dshmb-bubble{background:none!important;border:none!important;border-radius:0!important;padding:0!important;max-width:100%!important;width:100%!important;box-sizing:border-box}

/* 3) 用户行本身：解除右对齐与宽度上限 */
[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"]{justify-content:stretch!important;align-items:stretch!important}
[data-chat-flow-kind="user"] > *, [data-chat-flow-kind="steering"] > *{
  max-width:100%!important;width:100%!important;box-sizing:border-box;
}
[data-chat-flow-kind="user"] > * > *, [data-chat-flow-kind="steering"] > * > *{
  max-width:100%!important;
}

/* 4) 记录式的呼吸：下边一条细分隔线 + 段间距 */
[data-chat-flow-kind="user"] [data-message-bubble],
[data-chat-flow-kind="user"] .dshmb-stack{
  padding-bottom:14px!important;
  border-bottom:1px solid var(--dsw-alias-border-l2,rgba(16,24,40,.12));
  margin-bottom:14px!important;
}
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
