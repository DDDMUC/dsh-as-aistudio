// dsh-log-trim host half (dsh-log-trim.worker.mjs), VENDORED by tools/vendor.mjs - DO NOT EDIT.
//
// Source: ../dsh-log-trim/lib/worker.mjs  (v0.7.6, sha256 675a759a767b7e38)
// Regenerate with `npm run vendor`; test/sync.test.js fails when this is stale.
//
// src/shell.js imports the copy named after the component, which is why the
// studio installs with no runtime dependency on the component package.
/**
 * 开机扫描的工人线程。
 *
 * 扫描是纯 CPU 活：解压上千帧 zstd、解析上万条事件、重编号、再压回去。放在宿主
 * 主线程上跑，一次开机就能把事件循环按住两分钟——首屏请求全落空，侧边栏显示 0 个
 * 会话、点不进去。所以整轮扫描搬到 worker 里：主线程只收一份摘要。
 *
 * 这个 worker 能干的事和 `runScan` 完全一样（它自己读配置、写账本与扫描记忆），
 * 唯一的差别是 logger 变成了 postMessage。
 */
import { parentPort, workerData } from 'node:worker_threads'

const post = (message) => {
  try {
    parentPort?.postMessage(message)
  } catch {
    // 主线程已经走了，没人收就算了。
  }
}

try {
  const { runScan } = await import('./dsh-log-trim.js')
  const summary = await runScan(workerData.config ?? {}, {
    info: () => {},
    warn: (message) => post({ type: 'warn', message: String(message) }),
  })
  post({ type: 'done', summary })
} catch (error) {
  post({ type: 'error', message: error instanceof Error ? error.message : String(error) })
}
