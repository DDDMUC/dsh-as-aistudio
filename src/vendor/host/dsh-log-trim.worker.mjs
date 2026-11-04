// 开机扫描的工人线程。
//
// 扫描是纯 CPU 活：解压千帧 zstd、解析上万条事件、重编号、再压回去。放在宿主主线程
// 上跑，一次开机就能把事件循环按两分钟——首屏请求全落空，侧边栏显示 0 个会话。
// 所以整轮扫描搬到 worker 里：主线程只收一份摘要。
//
// 这个 worker 能干的事和 `runScan` 完全一样（它自己读配置、写账本与扫描记忆），
// 唯一的差别是 logger 变成了 postMessage。
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
