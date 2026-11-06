// dsh-log-trim host half (dsh-log-trim.goal-repair.js), VENDORED by tools/vendor.mjs - DO NOT EDIT.
//
// Source: ../dsh-log-trim/lib/goal-repair.js  (v0.7.6, sha256 0801a28f35667ee7)
// Regenerate with `npm run vendor`; test/sync.test.js fails when this is stale.
//
// src/shell.js imports the copy named after the component, which is why the
// studio installs with no runtime dependency on the component package.
/**
 * Repair sessions whose goal bookkeeping was lost by a log rewrite.
 *
 * `goal/change` is not a surface event: it carries the durable goal snapshot
 * (create / edit / pause / resume / complete / block / clear), while the goal's
 * rounds arrive as ordinary `user/message` events whose `data.source` says
 * `{kind: 'goal', goalId, revision, round}`. The goal projection folds the two
 * together and demands that every round be *the next admitted round* of the
 * currently active goal.
 *
 * A rewrite that rebuilds the log from its visible surface (`rebuildSurface` in
 * `lossless.js`, exposed by `applyFlatten` / `applyRebuild`) used to keep the
 * rounds - they are surface nodes - and drop every `goal/change`. The log still
 * passes every host format validator, because the format layer does not know
 * goal semantics, but on the next load the goal projection refuses the whole
 * log:
 *
 *   goal replay failed at session event N: goal round at session event N is not
 *   the next admitted round of the active goal
 *
 * and `/goal` is unusable in that session forever (`command.execute failed`).
 *
 * The durable goal is already gone at that point - the snapshots were deleted -
 * so the honest repair is to drop the now-dangling goal attribution from those
 * rounds: they stay in the model's history as what they are, user messages, and
 * `/goal` can create a fresh goal. Nothing is invented and no sequence number
 * moves, so the repair cannot itself invalidate a log.
 */

/** Goal operations that keep (or replace) a current goal snapshot. */
const SNAPSHOT_OPERATIONS = new Set(['create', 'edit', 'pause', 'resume', 'complete', 'block'])

/**
 * @typedef {{current?: {id?: string, revision?: number, phase?: string, maxGoalRounds?: number}, roundsStarted: number}} GoalFold
 */

/**
 * Apply one `goal/change` payload to the local fold.
 *
 * Deliberately tolerant: a payload this function does not understand leaves the
 * fold alone instead of failing the whole repair.
 *
 * @param {GoalFold} state - fold accumulator.
 * @param {unknown} data - the event payload.
 * @returns {GoalFold} the next fold state.
 */
function applyChange(state, data) {
  if (data === null || typeof data !== 'object' || data.kind !== 'goal/change') return state
  if (data.operation === 'clear') return { current: undefined, roundsStarted: 0 }
  if (!SNAPSHOT_OPERATIONS.has(data.operation)) return state
  const goal = data.goal
  if (goal === null || typeof goal !== 'object' || typeof goal.id !== 'string') return state
  return {
    current: {
      id: goal.id,
      revision: goal.revision,
      phase: goal.phase,
      maxGoalRounds: goal.maxGoalRounds,
    },
    roundsStarted: Number.isSafeInteger(data.roundsStarted) ? data.roundsStarted : state.roundsStarted,
  }
}

/**
 * Whether one goal-source round is admitted by the fold (same rule as the goal
 * projection's `applyGoalEvent`).
 *
 * @param {GoalFold} state - fold state before this round.
 * @param {object} source - the message's `data.source`.
 * @returns {boolean} true when the projection would admit this round.
 */
function admitsRound(state, source) {
  const current = state.current
  if (current === undefined) return false
  if (current.phase !== 'active') return false
  if (source.goalId !== current.id || source.revision !== current.revision) return false
  if (source.round !== state.roundsStarted + 1) return false
  if (Number.isSafeInteger(current.maxGoalRounds) && source.round > current.maxGoalRounds) return false
  return true
}

/**
 * Find the goal rounds a replay would reject as orphans.
 *
 * @param {object[]} events - the session's events, in seq order.
 * @returns {number[]} the seqs of goal-source user messages no goal admits.
 */
export function orphanGoalRounds(events) {
  /** @type {GoalFold} */
  let state = { current: undefined, roundsStarted: 0 }
  const orphans = []
  for (const event of events) {
    if (event.type === 'goal/change') {
      state = applyChange(state, event.data)
      continue
    }
    if (event.type !== 'user/message') continue
    const source = event.data?.source
    if (source === null || typeof source !== 'object' || source.kind !== 'goal') continue
    if (admitsRound(state, source)) {
      state = { ...state, roundsStarted: source.round }
      continue
    }
    orphans.push(event.seq)
  }
  return orphans
}

/**
 * Whether one log event belongs to the goal domain.
 *
 * Both halves matter: `goal/change` carries the snapshots, and every admitted
 * `user/message` with a goal source advances `roundsStarted`. Losing either one
 * makes the goal projection reject the whole log on replay.
 *
 * @param {object} event - a session event.
 * @returns {boolean} true for goal bookkeeping events.
 */
export function isGoalEvent(event) {
  if (event === null || typeof event !== 'object') return false
  if (event.type === 'goal/change') return true
  return event.type === 'user/message' && event.data?.source?.kind === 'goal'
}

/**
 * How many goal-domain events a log carries.
 *
 * @param {object[]} events - session events.
 * @returns {number} the count.
 */
export function goalEventCount(events) {
  let count = 0
  for (const event of events) if (isGoalEvent(event)) count += 1
  return count
}

/**
 * Refuse a rewrite that would drop a goal event.
 *
 * The goal projection folds the **whole** log, shadowed history included, so it
 * is not enough to keep what the model can currently read: a compaction may have
 * replaced a round, and trimming that round away turns every later round into an
 * orphan. `goal/change` is preserved by the current writers; goal rounds are
 * surface events and cannot be re-added as invisible bookkeeping, so a rewrite
 * that would lose one has to stop rather than produce a log `/goal` cannot open.
 *
 * @param {object[]} original - the log before the rewrite.
 * @param {object[]} kept - the events the rewrite would write.
 * @throws {Error} when a goal event would disappear.
 */
export function assertGoalEventsKept(original, kept) {
  const before = goalEventCount(original)
  if (before === 0) return
  const after = goalEventCount(kept)
  if (after >= before) return
  throw new Error(
    `压缩会删掉 ${before - after} 条目标事件（goal/change 或目标轮次）。目标投影从整份日志折叠，` +
      '删掉任何一条都会让该会话的 /goal 永久报 "goal replay failed"；已放弃这次写入',
  )
}

/**
 * Rewrite the orphan rounds' attribution into plain user messages.
 *
 * Copy-on-write: untouched events keep their identity, so a caller that finds
 * no orphans can skip the write entirely.
 *
 * @param {object[]} events - the session's events, in seq order.
 * @param {number[]} orphans - seqs from {@link orphanGoalRounds}.
 * @returns {object[]} the repaired events (same seq numbering).
 */
export function stripOrphanGoalSources(events, orphans) {
  const doomed = new Set(orphans)
  if (doomed.size === 0) return events
  return events.map((event) => {
    if (!doomed.has(event.seq) || event.type !== 'user/message') return event
    const data = event.data ?? {}
    return { ...event, data: { ...data, source: { kind: 'user' } } }
  })
}
