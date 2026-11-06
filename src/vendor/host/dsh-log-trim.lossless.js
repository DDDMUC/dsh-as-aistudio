// dsh-log-trim host half (dsh-log-trim.lossless.js), VENDORED by tools/vendor.mjs - DO NOT EDIT.
//
// Source: ../dsh-log-trim/lib/lossless.js  (v0.7.5, sha256 7e8478a2fd2ec10b)
// Regenerate with `npm run vendor`; test/sync.test.js fails when this is stale.
//
// src/shell.js imports the copy named after the component, which is why the
// studio installs with no runtime dependency on the component package.
/**
 * The lossless mode: shrink the log without changing what the model reads.
 *
 * A log carries two kinds of events. The ones a compaction replaced are shadowed
 * forever - the model cannot reach them, no future compaction will look at them,
 * and they are pure bytes. The ones nothing replaced are still read on every turn.
 *
 * Cutting **windows** (the older mode) throws away both: a window is not "the part
 * the model cannot see", it is "a summary carrier plus whatever tail was never
 * replaced". Measured on a real session: keeping the last window instead of the
 * last two dropped 426 events the model was still reading.
 *
 * So this mode never looks at windows. It deletes exactly the shadowed events -
 * and then proves the result is lossless by folding both logs into the message
 * sequence the model would receive and requiring them to be identical, entry for
 * entry. Anything else is a refusal, not a close call.
 */

import fs from 'node:fs'
import { assertGoalEventsKept } from './dsh-log-trim.goal-repair.js'
import { recordFor } from './dsh-log-trim.ledger.js'
import { commitTrim, derivedHistory, dropOrphanCompactions, encodeLogAsync, foldSurface, readLogAsync, renumber, seededHeaderFor, textLengthOf } from './dsh-log-trim.vendor.compact-session.mjs'

/**
 * Pick the events a lossless pass keeps.
 *
 * The rule is not "drop what a replace covers": the range's endpoints and every
 * reference it points at have to survive, or the host's format layer rejects the
 * file. Measured on a real 4.1 MB session: this selection narrows 8,343 events to
 * 4,638 and leaves the model's message sequence identical entry for entry.
 *
 * It is still not enough on its own - the host additionally requires turn and step
 * numbering to stay dense inside an open turn, which dropping whole steps breaks.
 * That is why the caller verifies with the host's validators and refuses on any
 * failure: a selection that cannot be loaded is not a smaller session, it is a
 * broken one.
 *
 * @param {object[]} events - the session's events.
 * @returns {{ events: object[], dropped: number }} the kept events, still carrying their original seqs.
 */
export function selectLossless(events) {
  // Dialogue the model can still read is the only thing worth keeping from the
  // dialogue events; everything else is dead bytes. Structural events are a
  // different matter: turn/step lifecycle, request headers, retries, approvals,
  // session bookkeeping - the host validates all of them and the renumbering pass
  // rebuilds the numbering from them, so they stay even when nothing points at
  // them. Dropping them is what made this mode fail with
  // `system/message does not match an open turn and step`.
  const DIALOGUE = new Set(['user/message', 'assistant/message', 'tool/result', 'developer/message', 'system/message'])
  const visible = new Set(foldSurface(events).visible ?? [])
  const keep = new Set()
  for (const event of events) {
    if (!DIALOGUE.has(String(event.type ?? '')) || visible.has(event.seq)) keep.add(event.seq)
  }
  // References beat the rule above: a replace endpoint, a header, a sourceEventSeqs
  // entry or a compaction's shadowed seq names an event that must exist for the
  // record that points at it to stay valid.
  for (let round = 0; round < 4; round += 1) {
    let added = false
    for (const event of events) {
      if (!keep.has(event.seq)) continue
      const refs = []
      if (event.surfaceOp !== null && typeof event.surfaceOp === 'object') refs.push(event.surfaceOp.startSeq, event.surfaceOp.endSeq)
      if (Array.isArray(event.sourceEventSeqs)) for (const seq of event.sourceEventSeqs) refs.push(seq)
      if (Number.isSafeInteger(event.data?.headerSeq)) refs.push(event.data.headerSeq)
      if (Array.isArray(event.data?.shadowedSeqs)) for (const seq of event.data.shadowedSeqs) refs.push(seq)
      if (Array.isArray(event.data?.messageSeqs)) for (const seq of event.data.messageSeqs) refs.push(seq)
      for (const seq of refs) {
        if (Number.isSafeInteger(seq) && !keep.has(seq) && events.some((candidate) => candidate.seq === seq)) {
          keep.add(seq)
          added = true
        }
      }
    }
    if (!added) break
  }
  const kept = dropOrphanCompactions(events.filter((event) => keep.has(event.seq)))
  return { events: kept, dropped: events.length - kept.length }
}

/**
 * Fold a log into what the model reads, as signatures.
 *
 * @param {object[]} events - events without the header.
 * @returns {string[]} one signature per visible message.
 */
export function modelView(events) {
  return derivedHistory(events)
}

/**
 * Whether two folded views are the same message sequence.
 *
 * @param {string[]} before - folded original.
 * @param {string[]} after - folded candidate.
 * @returns {boolean} true when nothing the model reads changed.
 */
export function sameView(before, after) {
  if (before.length !== after.length) return false
  for (let index = 0; index < before.length; index += 1) {
    if (before[index] !== after[index]) return false
  }
  return true
}

/**
 * Work out what a lossless pass would do to one log, without writing anything.
 *
 * The candidate event list is returned so the caller does not have to fold the
 * same log twice: a 5 MB log takes about a second to decode.
 *
 * @param {string} logFile - the session's log.
 * @param {object} config - the resolved config.
 * @returns {object} the plan: `should`, `reason`, and the numbers behind it.
 */
export async function planLossless(logFile, config) {
  const original = await readLogAsync(logFile)
  const before = modelView(original.events)
  const cut = selectLossless(original.events)
  try {
    assertGoalEventsKept(original.events, cut.events)
  } catch (error) {
    return { should: false, reason: error instanceof Error ? error.message : String(error), report: { title: '', events: original.events.length, windows: 0, droppable: 0, modelBefore: 0, modelAfter: 0, modelSame: false, bytes: original.compressedBytes, afterBytes: original.compressedBytes }, cut }
  }
  const after = modelView(cut.events)
  const bytes = (await encodeLogAsync(original.header, cut.events)).length
  const same = sameView(before, after)
  const raised = cut.dropped
  const ratio = original.events.length === 0 ? 0 : raised / original.events.length
  const savedRatio = original.compressedBytes === 0 ? 0 : (original.compressedBytes - bytes) / original.compressedBytes

  let title = ''
  for (let index = original.events.length - 1; index >= 0; index -= 1) {
    const event = original.events[index]
    if (event && event.type === 'session/title' && event.data && typeof event.data.title === 'string') {
      title = event.data.title
      break
    }
  }

  const report = {
    title,
    events: original.events.length,
    windows: 0,
    droppable: raised,
    modelBefore: before.length,
    modelAfter: after.length,
    modelSame: same,
    bytes: original.compressedBytes,
    afterBytes: bytes,
  }

  if (!same) {
    return { should: false, reason: `无损校验未通过（模型可见 ${before.length} → ${after.length} 条），放弃`, report, cut }
  }
  if (raised === 0) {
    return { should: false, reason: '没有可删的已遮蔽事件，不需要裁', report, cut }
  }
  if (raised < config.minDroppableEvents) {
    return { should: false, reason: `可删 ${raised} 条，少于阈值 ${config.minDroppableEvents}`, report, cut }
  }
  if (ratio < config.minRatio) {
    return { should: false, reason: `可删占比 ${(ratio * 100).toFixed(1)}%，低于阈值 ${(config.minRatio * 100).toFixed(1)}%`, report, cut }
  }
  if (savedRatio <= 0) {
    return { should: false, reason: '裁剪后体积没有变小', report, cut }
  }
  return {
    should: true,
    reason: `删掉 ${raised} 条已遮蔽事件（${(ratio * 100).toFixed(1)}%），模型可见 ${before.length} 条逐条不变`,
    report,
    cut,
  }
}

/**
 * Write one lossless pass: stage, verify with the host's validators, then commit.
 *
 * The order is the same one the window mode uses, for the same reason - the log
 * format rules live in the host, and a file that "looks right" is not the same as
 * a file the host will load.
 *
 * @param {string} logFile - the session's log.
 * @param {object} config - the resolved config.
 * @param {object} plan - the plan from {@link planLossless}.
 * @param {{ verify?: boolean }} [options] - `verify: false` skips the validators.
 * @returns {Promise<object>} the summary of what was written.
 */
export async function applyLossless(logFile, config, plan, options = {}) {
  const original = await readLogAsync(logFile)
  assertGoalEventsKept(original.events, plan.cut.events)
  const renamed = renumber(plan.cut.events)
  const seqs = new Set(renamed.events.map((event) => event.seq))
  for (let index = 0; index < renamed.events.length; index += 1) {
    if (!seqs.has(index)) throw new Error(`内部错误：seq ${index} 缺失`)
  }
  for (const event of renamed.events) {
    const refs = [...(Array.isArray(event.sourceEventSeqs) ? event.sourceEventSeqs : [])]
    if (event.surfaceOp !== null && typeof event.surfaceOp === 'object') refs.push(event.surfaceOp.startSeq, event.surfaceOp.endSeq)
    for (const ref of refs) {
      if (ref !== undefined && !seqs.has(Number(ref))) throw new Error(`内部错误：seq ${event.seq} 引用不存在的 ${ref}`)
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = `${logFile}.precompact-${stamp}`
  const staging = `${logFile}.staging-${stamp}`
  await fs.promises.writeFile(staging, await encodeLogAsync(original.header, renamed.events))
  const afterBytes = fs.statSync(staging).size

  if (options.verify !== false) {
    let verified
    try {
      const { verifyLog } = await import('./dsh-log-trim.verify-session-log.mjs')
      verified = await verifyLog(staging)
    } catch (error) {
      await fs.promises.rm(staging, { force: true })
      throw new Error(`校验器跑不起来，未写入：${error instanceof Error ? error.message : String(error)}`)
    }
    if (!verified.ok) {
      await fs.promises.rm(staging, { force: true })
      const failed = (verified.checks || []).filter((check) => !check.ok).slice(0, 3)
      const detail = failed.map((check) => `${check.name}：${check.detail}`).join('；')
      throw new Error(`校验未通过，未写入：${detail === '' ? '未知原因' : detail}`)
    }
  }

  const summary = await commitTrim({
    staging,
    backup,
    summary: {
      backup,
      before: { events: original.events.length, bytes: original.compressedBytes },
      after: { events: renamed.events.length, bytes: afterBytes },
      dropped: original.events.length - renamed.events.length,
    },
  }, logFile)
  recordFor(logFile, 'lossless', original.events, renamed.events, { bytesBefore: original.compressedBytes, bytesAfter: summary.after.bytes, record: config?.recordLedger !== false })
  return {
    ...summary,
    mode: 'lossless',
    model: { before: plan.report.modelBefore, after: plan.report.modelAfter, same: plan.report.modelSame },
  }
}

/**
 * Write the rebuilt log: backup, verify with the host's own validators, commit.
 *
 * @param {string} logFile - the session's log.
 * @param {object} config - the resolved config.
 * @returns {object} the same summary shape a window trim returns.
 */
export async function applyRebuild(logFile, config) {
  const original = await readLogAsync(logFile)
  const rebuilt = rebuildSurface(original.events)
  assertGoalEventsKept(original.events, rebuilt)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = `${logFile}.precompact-${stamp}`
  const staging = `${logFile}.staging-${stamp}`
  await fs.promises.writeFile(staging, await encodeLogAsync(seededHeaderFor(original.header, rebuilt), rebuilt))
  const { verifyLog } = await import('./dsh-log-trim.verify-session-log.mjs')
  const verified = await verifyLog(staging)
  if (!verified.ok) {
    await fs.promises.rm(staging, { force: true })
    const failed = (verified.checks || []).filter((check) => !check.ok).slice(0, 3)
    throw new Error('重写结果没通过宿主校验，未写入：' + failed.map((check) => check.name + '：' + check.detail).join('；'))
  }
  const beforeBytes = fs.statSync(staging).size
  await commitTrim({
    staging,
    backup,
    summary: {
      backup,
      before: { events: original.events.length, bytes: original.compressedBytes },
      after: { events: rebuilt.length, bytes: beforeBytes },
      dropped: original.events.length - rebuilt.length,
    },
  }, logFile)
  recordFor(logFile, 'rebuild', original.events, rebuilt, { bytesBefore: original.compressedBytes, bytesAfter: beforeBytes, record: config?.recordLedger !== false })
  return {
    mode: 'rebuild',
    before: { events: original.events.length, bytes: original.compressedBytes, windows: 0 },
    after: { events: rebuilt.length, bytes: beforeBytes },
    dropped: original.events.length - rebuilt.length,
    model: { before: modelView(original.events).length, after: modelView(rebuilt).length },
    backup: backup.slice(backup.lastIndexOf('.precompact-') + 1),
  }
}

/**
 * 只清理流式回放记录：不动行数、不动轮次、不动表面。
 *
 * @param {string} logFile - 日志路径。
 * @param {number} keepTurns - 保留最近几轮。
 * @returns {Promise<object|null>} 摘要；没有可清的就返回 null。
 */
export async function applyStreamOnly(logFile, keepTurns, options = {}) {
  const { stripOldStreams } = await import('./dsh-log-trim.vendor.compact-session.mjs')
  const original = await readLogAsync(logFile)
  const stripped = stripOldStreams(original.events, keepTurns)
  if (stripped.stripped === 0) return null
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = `${logFile}.precompact-${stamp}`
  const staging = `${logFile}.staging-${stamp}`
  await fs.promises.writeFile(staging, await encodeLogAsync(seededHeaderFor(original.header, stripped.events), stripped.events))
  const { verifyLog } = await import('./dsh-log-trim.verify-session-log.mjs')
  const verified = await verifyLog(staging)
  if (!verified.ok) {
    await fs.promises.rm(staging, { force: true })
    throw new Error('清理流式回放后没通过宿主校验，未写入')
  }
  const beforeBytes = fs.statSync(staging).size
  await commitTrim({ staging, backup }, logFile)
  recordFor(logFile, 'stream', original.events, stripped.events, {
    bytesBefore: original.compressedBytes,
    bytesAfter: beforeBytes,
    record: options.record !== false,
  })
  return { events: stripped.stripped, before: original.compressedBytes, after: beforeBytes, backup: backup.slice(backup.lastIndexOf('.precompact-') + 1) }
}

/**
 * 折叠：把 edit / rerun / delete 留下的载体就地落实、删掉，再按表面重写一份。
 *
 * 与 `applyRebuild` 同一条安全线：先写暂存、过宿主的九项校验，验不过一个字节都不写；
 * 通过了先复制备份再替换。
 *
 * @param {string} logFile - 日志路径。
 * @param {object} config - 解析后的配置（只用 `backupKeep`）。
 * @returns {Promise<object>} 结果摘要。
 */
export async function applyFlatten(logFile, config) {
  const original = await readLogAsync(logFile)
  // 动态导入：flatten 依赖本文件的 rebuildSurface，静态导入会形成环。
  const { flattenHistory } = await import('./dsh-log-trim.flatten.js')
  const { stripOldStreams } = await import('./dsh-log-trim.vendor.compact-session.mjs')
  const flattened = flattenHistory(original.events)
  const stats = flattened.folded
  // 与窗口裁剪同一条规则：只留最近几轮的流式回放记录，更早的删掉。
  const stripped = stripOldStreams(flattened.events, 0)
  const folded = stripped.events
  assertGoalEventsKept(original.events, folded)
  if (stats.edits + stats.reruns + stats.deletes === 0) {
    throw new Error('没有需要折叠的编辑/重跑/删除记录')
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = `${logFile}.precompact-${stamp}`
  const staging = `${logFile}.staging-${stamp}`
  await fs.promises.writeFile(staging, await encodeLogAsync(seededHeaderFor(original.header, folded), folded))
  const { verifyLog } = await import('./dsh-log-trim.verify-session-log.mjs')
  const verified = await verifyLog(staging)
  if (!verified.ok) {
    await fs.promises.rm(staging, { force: true })
    const failed = (verified.checks || []).filter((check) => !check.ok).slice(0, 3)
    throw new Error('折叠结果没通过宿主校验，未写入：' + failed.map((check) => check.name + '：' + check.detail).join('；'))
  }
  const beforeBytes = fs.statSync(staging).size
  await commitTrim({
    staging,
    backup,
    summary: {
      backup,
      before: { events: original.events.length, bytes: original.compressedBytes },
      after: { events: folded.length, bytes: beforeBytes },
      dropped: original.events.length - folded.length,
    },
  }, logFile)
  recordFor(logFile, 'flatten', original.events, folded, { bytesBefore: original.compressedBytes, bytesAfter: beforeBytes, record: config?.recordLedger !== false })
  return {
    mode: 'flatten',
    before: { events: original.events.length, bytes: original.compressedBytes, windows: 0 },
    after: { events: folded.length, bytes: beforeBytes },
    dropped: original.events.length - folded.length,
    folded: { ...stats, streamStripped: stripped.stripped },
    backup: backup.slice(backup.lastIndexOf('.precompact-') + 1),
  }
}

/**
 * Log events that are not part of the dialogue surface but that a host
 * projection still folds from the log.
 *
 * The rebuild replays the visible messages and used to discard everything else,
 * which silently deleted durable state:
 *
 * - `goal/change` carries the goal snapshot. Losing it while the goal's rounds
 *   (ordinary surface `user/message` events) survive makes the goal projection
 *   refuse the whole log: "goal round at session event N is not the next
 *   admitted round of the active goal", and `/goal` stays broken forever.
 * - `todo/write`, `plan/mode`, `schedule/change`, `team/*`, `feedback/*` and
 *   `working-directory/change` are the same kind of snapshot state: the UI and
 *   the projections read the last one, and dropping them looks like the user's
 *   todos / plan mode / team board / schedules vanished.
 *
 * The six settings event types already re-emitted at the head of the rebuild
 * (`agent-preset/selected`, `permission/preset`, `sandbox/mode`,
 * `approval/policy`, `session/title`, `model/selection`) are deliberately not
 * listed here: the rebuild regenerates each from its own last event.
 */
const PRESERVED_STATE_TYPES = new Set([
  'goal/change',
  'plan/mode',
  'todo/write',
  'schedule/change',
  'working-directory/change',
  'team/member',
  'team/task',
  'team/message/queued',
  'team/message/delivered',
  'feedback/record',
  'feedback/message-put',
  'feedback/message-delete',
])

/**
 * Re-insert preserved state events just before the first surface block whose
 * source event originally came after them.
 *
 * `out` is already the rebuilt surface; `marks` maps each copied source seq to
 * the index at which its block starts. A state event that originally sat
 * between two messages therefore lands back between them, which is what keeps a
 * goal's create/edit snapshot ahead of the rounds it admits.
 *
 * @param {object[]} out - the rebuilt surface entries.
 * @param {Map<number, number>} marks - source seq → output index.
 * @param {object[]} preserved - state events to keep, in original seq order.
 * @returns {object[]} the surface with state events merged back in.
 */
function mergeStateEvents(out, marks, preserved) {
  if (preserved.length === 0) return out
  const boundaries = [...marks.entries()].sort((left, right) => left[0] - right[0])
  const buckets = new Map()
  for (const event of preserved) {
    let at = out.length
    for (const [seq, index] of boundaries) {
      if (seq > event.seq) {
        at = index
        break
      }
    }
    const bucket = buckets.get(at)
    if (bucket === undefined) buckets.set(at, [event])
    else bucket.push(event)
  }
  const merged = []
  const pushBucket = (index) => {
    const bucket = buckets.get(index)
    if (bucket === undefined) return
    for (const event of bucket) merged.push({ seq: 0, type: event.type, time: event.time, data: event.data })
  }
  for (let index = 0; index < out.length; index += 1) {
    pushBucket(index)
    merged.push(out[index])
  }
  pushBucket(out.length)
  return merged
}

/**
 * Rebuild a log from the surface the model reads.
 *
 * Picking events out of the old log is what kept failing: every repair exposed
 * another pairing the host validates (turn/step density, compaction start/end,
 * a tool call without its result). A rebuild has no such history: the visible
 * messages are replayed in order into fresh turns, so the numberings are dense,
 * every tool result sits in the turn of its call, and no replace or compaction
 * record survives.
 *
 * Events in {@link PRESERVED_STATE_TYPES} are re-inserted at their original
 * position relative to the surface, so a goal snapshot still precedes the round
 * it admits (and a later edit/clear still follows the rounds it follows today).
 *
 * @param {object[]} events - the session's events.
 * @returns {object[]} the rebuilt events, seqs assigned from 0.
 */
export function rebuildSurface(events) {
  const visible = foldSurface(events).visible ?? []
  const bySeq = new Map(events.map((event) => [event.seq, event]))
  const preserved = events.filter((event) => PRESERVED_STATE_TYPES.has(String(event.type ?? '')))
  // Output index at which each visible source event starts; state events are
  // merged back in front of the first visible event that originally followed
  // them.
  const marks = new Map()
  // 每条源事件真正的消息行下标：marks 指向“块起点”（turn/start 等），引用类字段
  // （promptSeq / logFrom / 标题 messageSeqs）必须指向消息行本身。
  const rowIndexBySeq = new Map()
  const headers = events.filter((event) => event.type === 'request/header')
  const headerBefore = (seq) => {
    let found = null
    for (const header of headers) {
      if (header.seq >= seq) break
      found = header
    }
    return found
  }
  const lastOf = (type) => events.filter((event) => event.type === type).pop()
  const answered = new Set()
  const resultByCall = new Map()
  for (const seq of visible) {
    const event = bySeq.get(seq)
    const callId = event?.data?.message?.toolCallId
    if (event?.type !== 'tool/result' || typeof callId !== 'string') continue
    answered.add(callId)
    if (!resultByCall.has(callId)) resultByCall.set(callId, event)
  }
  const consumed = new Set()
  const systemMessages = []
  for (const seq of visible) {
    const event = bySeq.get(seq)
    if (event?.type === 'system/message') systemMessages.push(event)
  }
  // 宿主规定：表面的第一个节点必须是**受保护的 system/message**，之后再有
  // system/message 追加就报 `system/message requires a protected first surface
  // head`。压缩会把旧的 system 消息替换掉，于是它不在可见表面里——只从
  // `visible` 里挑就一个也挑不到，重写出来的日志表面以 user/assistant 开头，
  // 宿主读的时候直接拒收。所以退一步：可见表面里没有，就从**全部事件**里取最后
  // 一条带正文的 system/message 顶到最前面。
  if (systemMessages.length === 0) {
    const fallback = events.filter((event) => event.type === 'system/message' && textLengthOf(event) > 0).pop()
    if (fallback !== undefined) systemMessages.push(fallback)
  }
  const out = []
  // 每一行都必须带 `time`：宿主的行格式把它列为必填（`EVENT_REQUIRED =
  // ["type","seq","time","data"]`），缺了直接拒收整份日志——
  // `released v2 row 0 lacks required field time`，整个会话就打不开了。
  // 所以重写出来的行一律继承"它来自的那条源事件"的时间；生命周期行
  // （turn/start、step/end…）没有源事件，就继承当前正在处理的那条事件的
  // 时间。时钟只进不退，时间线保持非递减。
  let clock = Number.isSafeInteger(events[0]?.time) ? events[0].time : Date.now()
  const advance = (event) => {
    if (Number.isSafeInteger(event?.time)) clock = Math.max(clock, event.time)
    return clock
  }
  const ownTime = (event) => (Number.isSafeInteger(event?.time) ? event.time : clock)
  for (const type of ['agent-preset/selected', 'permission/preset', 'sandbox/mode', 'approval/policy', 'model/selection']) {
    const event = lastOf(type)
    if (event !== undefined) out.push({ seq: 0, type, time: ownTime(event), data: event.data })
  }
  // 标题要引用「更早的事件」，所以不能放在 head：重建时先记下来，最后再追加。
  const titleEvent = lastOf('session/title')
  // 工具定义表：`tool-addition` 通知引用的 header 必须**恰好**定义它点名的那一个工具。
  // 原日志里每个 header 带的是当轮全部工具，直接复制下来会 0 个或 N 个匹配，格式层拒收。
  const toolDefinitions = new Map()
  for (const event of events) {
    if (event.type !== 'request/header') continue
    const tools = event.data?.header?.tools
    if (!Array.isArray(tools)) continue
    for (const tool of tools) {
      if (tool && typeof tool.name === 'string') toolDefinitions.set(tool.name, tool)
    }
  }
  // `mergeStateEvents` 会往 out 里插行，插完后面的下标就变了；headerSeq 必须
  // 在合并之后按最终位置回填，否则会指向别的行。
  const pendingHeaderSeqs = []
  let turn = 0
  let step = 0
  let open = false
  let stepOpen = false
  let openStepKey = null
  let headerIndex = -1
  const closeStep = () => {
    if (!stepOpen) return
    out.push({ seq: 0, type: 'step/end', time: clock, data: { turn, step } })
    stepOpen = false
  }
  const closeTurn = () => {
    if (!open) return
    closeStep()
    out.push({ seq: 0, type: 'turn/end', time: clock, data: { turn, reason: { kind: 'completed' } } })
    open = false
  }
  const openTurn = (header) => {
    closeTurn()
    turn += 1
    step = 0
    out.push({ seq: 0, type: 'turn/start', time: clock, data: { turn } })
    open = true
    if (header !== null) {
      headerIndex = out.length
      out.push({ seq: 0, type: 'request/header', time: clock, data: header.data })
    } else {
      headerIndex = -1
    }
  }
  const openStep = (key) => {
    openStepKey = key === undefined ? null : key
    step += 1
    out.push({ seq: 0, type: 'step/start', time: clock, data: { turn, step } })
    stepOpen = true
  }
  // The session head is the system prompt: the format layer wants the first
  // surface node to be one, and a prompt that was replaced later in the log has
  // to be hoisted to the front, not left where its replacement stood.
  if (systemMessages.length > 0) {
    openTurn(headerBefore(systemMessages[0].seq))
    openStep()
    for (const event of systemMessages) {
      const message = event.data?.message ?? event.data
      out.push({ seq: 0, type: 'system/message', time: advance(event), data: { turn, step, message }, surfaceOp: 'append' })
    }
    closeStep()
  }
  for (const seq of visible) {
    if (consumed.has(seq)) continue
    const event = bySeq.get(seq)
    if (event === undefined) continue
    marks.set(seq, out.length)
    advance(event)
    const data = event.data ?? {}
    const message = data.message ?? data
    const role = message !== null && typeof message === 'object' ? message.role : undefined
    const header = headerBefore(event.seq)
    if (event.type === 'system/message') continue
    // 标题统一在最后重写（引用必须更早）；这里不再原样复制一份。
    if (event.type === 'session/title') continue
    if (event.type === 'developer/message') {
      if (!open) openTurn(header)
      if (!stepOpen) openStep(typeof data.step === 'number' ? data.step : null)
      const next = { turn, step, message }
      const addsTools =
        Array.isArray(message?.content) && message.content.some((part) => part?.type === 'tool-addition')
      if (event.type === 'developer/message' && addsTools) {
        // 通知必须引用一个「恰好定义它点名的工具」的 header：从定义表里取，
        // 凑不齐就干脆不写 headerSeq（格式层只在有 headerSeq 时才校验）。
        const names = [...new Set(message.content.filter((part) => part?.type === 'tool-addition' && typeof part.toolName === 'string').map((part) => part.toolName))]
        const definitions = names.map((name) => toolDefinitions.get(name)).filter((definition) => definition !== undefined)
        if (header !== null && definitions.length === names.length && names.length > 0) {
          const data2 = { ...header.data, header: { ...header.data.header, tools: definitions } }
          const headerRow = { seq: 0, type: 'request/header', time: clock, data: data2 }
          headerIndex = out.length
          out.push(headerRow)
          next.headerSeq = headerIndex
          pendingHeaderSeqs.push({ data: next, row: headerRow })
        }
      }
      rowIndexBySeq.set(event.seq, out.length)
      out.push({ seq: 0, type: event.type, time: ownTime(event), data: next, surfaceOp: 'append' })
      continue
    }
    if (role === 'user' || event.type === 'user/message') {
      openTurn(header)
      // 扁平载荷把 source 放在 data 上；嵌套载荷（data.message）要把它补回去，
      // 否则 kind / promptSeq / rerun 归属全丢，标题也没法引用它。
      const extra = data.source !== undefined && message.source === undefined ? { source: data.source } : {}
      rowIndexBySeq.set(event.seq, out.length)
      out.push({ seq: 0, type: event.type, time: ownTime(event), data: { ...message, ...extra, turn }, surfaceOp: 'append' })
      continue
    }
    if (!open) openTurn(header)
    const stepKey = typeof data.step === 'number' ? data.step : null
    if (stepKey !== null && stepKey !== openStepKey) {
      closeStep()
      openStep(stepKey)
    } else if (!stepOpen) {
      openStep(stepKey)
    }
    let outgoing = message
    if (event.type === 'assistant/message' && Array.isArray(message?.content)) {
      const kept = message.content.filter((block) => block?.type !== 'tool-call' || answered.has(block.id))
      if (kept.length !== message.content.length) outgoing = { ...message, content: kept }
    }
    const payload = { turn, step, message: outgoing }
    if (data.usage !== undefined) payload.usage = data.usage
    if (data.meta !== undefined) payload.meta = data.meta
    // 助手消息必须带 `stream`：宿主的 seed 边界校验
    // （`assertAssistantSettlementShape`）要求 `Array.isArray(data.stream)`，
    // 缺了就是 `seed assistant/message at index N has invalid settlement
    // fields`，整份日志打不开。它是原始分片流，加载时不重放、只原样留着。
    if (data.stream !== undefined) payload.stream = data.stream
    // A fork-generated "tool never started" result carries its own error object;
    // without it the format layer reads the row as a fork result and refuses it.
    if (data.error !== undefined) payload.error = data.error
    if (event.type === 'tool/call') payload.callId = data.callId
    if (data.source !== undefined) payload.source = data.source
    rowIndexBySeq.set(event.seq, out.length)
    out.push({ seq: 0, type: event.type, time: ownTime(event), data: payload, surfaceOp: 'append' })
    // A tool call is announced by its assistant message and "started" by a
    // tool/call event; without that event the result looks like a tool that
    // never ran, and the format layer demands the TOOL_NOT_STARTED repair.
    if (event.type === 'assistant/message' && Array.isArray(message?.content)) {
      for (const block of message.content) {
        if (block === null || block === undefined || block.type !== 'tool-call' || !answered.has(block.id)) continue
        out.push({ seq: 0, type: 'tool/call', time: ownTime(event), data: { turn, step, callId: block.id, name: block.name, arguments: block.arguments } })
        // The model reads a call and its result together; a result that arrived
        // many steps later would otherwise leave the step that advertised the
        // call unresolved, which the format layer refuses.
        const result = resultByCall.get(block.id)
        if (result !== undefined) {
          const resultData = result.data ?? {}
          const resultPayload = { turn, step, message: resultData.message }
          if (resultData.meta !== undefined) resultPayload.meta = resultData.meta
          out.push({ seq: 0, type: 'tool/result', time: advance(result), data: resultPayload, surfaceOp: 'append' })
          consumed.add(result.seq)
        }
      }
    }
  }
  closeTurn()
  const merged = mergeStateEvents(out, marks, preserved)
  // `source.promptSeq` 指向「这一轮是由哪条 prompt 触发的」，格式层要求它更早。
  // 重建后 seq 全变了，按源 seq → 原下标 → 合并后下标 映射回来；映射不到的删掉，
  // 否则整份日志会被交叉引用检查拒绝。
  const outToMerged = new Map()
  for (let index = 0; index < out.length; index += 1) outToMerged.set(out[index], index)
  for (let index = 0; index < merged.length; index += 1) {
    const row = merged[index]
    const rowOutIndex = outToMerged.get(row)
    if (rowOutIndex === undefined) continue
    outToMerged.set(row, index)
  }
  const mergedIndexOfSourceSeq = (sourceSeq) => {
    const outIndex = rowIndexBySeq.get(sourceSeq) ?? marks.get(sourceSeq)
    if (outIndex === undefined) return undefined
    return outToMerged.get(out[outIndex])
  }
  for (const row of merged) {
    // 两种载荷形状都要处理：嵌套的 `data.message.source` 和扁平的 `data.source`
    // （rerun / delete 留下的载体用的是后者）。
    const sources = []
    const message = row.data?.message
    if (message !== null && typeof message === 'object' && message.source !== null && typeof message.source === 'object') sources.push(message.source)
    if (row.data?.source !== null && typeof row.data?.source === 'object') sources.push(row.data.source)
    for (const source of sources) {
      for (const key of ['promptSeq', 'logFrom', 'logTo', 'rerunTurn', 'rerunTurnEnd', 'carrierSeq', 'targetSeq']) {
        if (typeof source[key] !== 'number') continue
        const mapped = mergedIndexOfSourceSeq(source[key])
        const rowIndex = outToMerged.get(row)
        if (mapped === undefined || (rowIndex !== undefined && mapped >= rowIndex)) delete source[key]
        else source[key] = mapped
      }
    }
  }
  for (const pending of pendingHeaderSeqs) {
    const at = merged.indexOf(pending.row)
    if (at >= 0) pending.data.headerSeq = at
    else delete pending.data.headerSeq
  }
  // 标题放在最后：它引用的 `messageSeqs` 必须是**更早**的 `user/message`（且来源是用户），
  // 放在 head 时前面没有任何消息，怎么改都过不了格式层。
  if (titleEvent !== undefined) {
    const candidates = []
    merged.forEach((row, index) => {
      if (row.type !== 'user/message') return
      if (row.data?.source?.kind !== 'user') return
      candidates.push(index)
    })
    const isUserTitle = titleEvent.data?.source?.kind === 'user'
    if (isUserTitle) {
      // 用户自己的标题：messageSeqs 必须为空。
      merged.push({ seq: 0, type: 'session/title', time: ownTime(titleEvent), data: { ...titleEvent.data, messageSeqs: [] } })
    } else if (candidates.length > 0) {
      // 自动标题：必须引用至少一条更早的 user/message。
      const wanted = Math.max(1, Math.min(2, Array.isArray(titleEvent.data?.messageSeqs) ? titleEvent.data.messageSeqs.length : 1))
      merged.push({
        seq: 0,
        type: 'session/title',
        time: ownTime(titleEvent),
        data: { ...titleEvent.data, messageSeqs: candidates.slice(-wanted) },
      })
    }
  }
  const rebuilt = merged.map((event, index) => ({ ...event, seq: index }))
  // A fork result encodes the sequence it was appended at inside its identity
  // (`forked-tool-result-<callId>-<seq>`); renumbering has to follow, or the host
  // reads the row as a replacement that names a sequence it does not have.
  for (const event of rebuilt) {
    const message = event.data?.message
    if (event.type !== 'tool/result' || typeof message?.id !== 'string') continue
    if (!message.id.startsWith('forked-tool-result-')) continue
    const callId = message.source?.callId
    if (typeof callId !== 'string') continue
    message.id = 'forked-tool-result-' + callId + '-' + String(event.seq)
    delete event.sourceEventSeqs
  }
  return rebuilt
}
