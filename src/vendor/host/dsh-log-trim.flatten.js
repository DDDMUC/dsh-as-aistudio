// dsh-log-trim host half (dsh-log-trim.flatten.js), VENDORED by tools/vendor.mjs - DO NOT EDIT.
//
// Source: ../dsh-log-trim/lib/flatten.js  (v0.6.1, sha256 3aa1fdcbb120ab06)
// Regenerate with `npm run vendor`; test/sync.test.js fails when this is stale.
//
// src/shell.js imports the copy named after the component, which is why the
// studio installs with no runtime dependency on the component package.
/**
 * 折叠：把 edit / rerun / delete 留下的「注释行」就地落实，然后重写成一份干净的日志。
 *
 * 日志是追加式的：插件不改旧行，而是在后面追加一条带 `surfaceOp: replace` 的载体
 * （edit 的载体里带新文本，rerun/delete 的载体是静默的）。折叠就是用户的线性直觉：
 * 把该抄的抄回原行、把该删的行删掉、后面的行整体上移。
 *
 * 实现分三步：
 *   1. edit 的新正文抄回它替换的那一行（保留原行的 id/role，换的只是文本）；
 *   2. 删掉载体本身；rerun / delete 还要删掉它们盖住的目标行；
 *   3. 用 `rebuildSurface` 按表面重建整份日志（轮次/步骤成对、工具调用成对、
 *      没有 replace 记录、没有静默载体），再修掉指向已删事件的标题引用。
 *
 * 写完前必须过宿主的九项校验；验不过就不写（由调用方保证）。
 */

import { rebuildSurface } from './dsh-log-trim.lossless.js'
import { renumber, renumberLifecycle } from './dsh-log-trim.vendor.compact-session.mjs'

const INVISIBLE = /[\s\u200b\u200c\u200d\ufeff]/g

/** 载体：带一条替换记录、并且出自某个插件或 edit。 */
function carrierKind(event) {
  const source = event?.data?.source
  if (source === null || source === undefined) return null
  const kind = source.kind
  if (typeof kind === 'string' && kind.startsWith('plugin:')) return 'plugin'
  if (typeof source.editedBy === 'string' && source.editedBy !== '') return 'edit'
  return null
}

/** 载体里的正文算不算“可读”（零宽空格是静默载体的兜底，不算）。 */
function readableContent(message) {
  if (message === null || message === undefined) return false
  if (!Array.isArray(message.content)) return false
  return message.content.some((block) => block && typeof block.text === 'string' && block.text.replace(INVISIBLE, '') !== '')
}

/**
 * 折叠整份日志。
 *
 * @param {object[]} events - 原始事件（不会被修改）。
 * @returns {{ events: object[], folded: { edits: number, reruns: number, deletes: number, drop: number } }}
 *   折叠后的事件与统计；没有任何载体时原样返回。
 */
export function flattenHistory(events) {
  const folded = { edits: 0, reruns: 0, deletes: 0, drop: 0 }
  const drop = new Set()
  const patches = new Map()
  let carriers = 0

  for (const event of events) {
    const kind = carrierKind(event)
    if (kind === null) continue
    carriers += 1
    drop.add(event.seq)
    // 两种正文形状都要认：`data.message {role, content}` 与扁平 `data.content`。
    const message =
      event.data?.message ??
      (Array.isArray(event.data?.content) ? { role: event.data.role, content: event.data.content } : null)
    const payload = readableContent(message)
    if (kind === 'edit' && payload) {
      const target = (event.sourceEventSeqs ?? []).find((seq) => typeof seq === 'number')
      if (target !== undefined) {
        // 换的是文本，不是身份：保留原行的 id/role。
        patches.set(target, message.content)
        folded.edits += 1
      }
    } else if (kind === 'plugin') {
      // 按载体出自哪个插件来数，而不是看有没有 deletedTurn：逐行删除的载体没有那个字段。
      if (String(event.data?.source?.kind ?? '').includes('delete-turn')) folded.deletes += 1
      else folded.reruns += 1
      for (const seq of event.sourceEventSeqs ?? []) if (typeof seq === 'number') drop.add(seq)
    }
  }
  if (carriers === 0) return { events, folded }

  const kept = events
    .filter((event) => !drop.has(event.seq))
    .map((event) => {
      const content = patches.get(event.seq)
      if (content === undefined) return event
      if (event.data?.message !== undefined) return { ...event, data: { ...event.data, message: { ...event.data.message, content } } }
      return { ...event, data: { ...event.data, content } }
    })

  folded.drop = events.length - kept.length
  const rebuilt = rebuildSurface(kept)
  const seqd = renumber(rebuilt)
  const renumbered = renumberLifecycle(seqd.events)
  // 标题的 messageSeqs 必须指向一条更早的**消息**；重编号之后再修，否则顺序会再变一次。
  const fixedTitles = renumbered.flatMap((event) => {
    if (event.type !== 'session/title') return [event]
    const seqs = Array.isArray(event.data?.messageSeqs) ? event.data.messageSeqs : null
    if (seqs === null) return [event]
    const kept = seqs.filter((seq) => typeof seq === 'number' && seq < event.seq &&
      renumbered.some((other) => other.seq === seq && (other.type === 'user/message' || other.type === 'assistant/message')))
    if (kept.length > 0 && kept.length === seqs.length) return [event]
    const data = { ...event.data }
    if (kept.length > 0) {
      data.messageSeqs = kept
      return [{ ...event, data }]
    }
    let earlier = null
    for (const candidate of renumbered) {
      if (candidate.seq >= event.seq) break
      if (candidate.type === 'user/message' || candidate.type === 'assistant/message') earlier = candidate.seq
    }
    // 前面一条消息都没有：这条标题无法满足“必须指一条更早的消息”，只能整条去掉。
    if (earlier === null) return []
    data.messageSeqs = [earlier]
    return [{ ...event, data }]
  })
  // 去掉标题之后 seq 会留洞：再上移一次，并同步轮次/步骤编号。
  const packed = renumberLifecycle(renumber(fixedTitles).events)
  return { events: packed, folded }
}
