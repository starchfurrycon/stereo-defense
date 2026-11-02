import { ACT_BLOCK, batchBlock, modifyRelation } from './bili/api'

/**
 * 批量拉黑。
 *
 * 经验来自同类工具：先单条试拉黑，失败就整体中止——多半是 CSRF 失效或撞了风控，
 * 继续跑只会把后面的账号一起拖成失败。批量接口一次 20 个，
 * 遇到失败退化成逐条重试，最后把两边的失败并起来。
 */
export interface BlockOutcome {
  ok: number[]
  failed: number[]
  /** 单条测试就失败时，整批不会执行 */
  aborted?: string
}

const CHUNK = 20

export async function executeBlocks(
  mids: number[],
  csrf: string,
  onNote: (text: string) => void,
  shouldStop: () => boolean = () => false,
): Promise<BlockOutcome> {
  const unique = [...new Set(mids.filter((m) => m > 0))]
  if (!unique.length) return { ok: [], failed: [] }
  if (!csrf) return { ok: [], failed: unique, aborted: '缺少 CSRF，请先登录' }

  const failed = new Set<number>()

  try {
    onNote('测试第一条')
    await modifyRelation(unique[0], ACT_BLOCK, csrf)
  } catch (err) {
    return {
      ok: [],
      failed: unique,
      aborted: err instanceof Error ? err.message : '单条测试失败',
    }
  }

  const rest = unique.slice(1)
  let done = 1
  for (let i = 0; i < rest.length; i += CHUNK) {
    if (shouldStop()) break
    const group = rest.slice(i, i + CHUNK)
    onNote(`拉黑 ${done}/${unique.length}`)
    try {
      const bad = await batchBlock(group, csrf)
      for (const m of bad) failed.add(m)
    } catch {
      for (const m of group) {
        try {
          await modifyRelation(m, ACT_BLOCK, csrf)
        } catch {
          failed.add(m)
        }
      }
    }
    done += group.length
  }

  return { ok: unique.filter((m) => !failed.has(m)), failed: [...failed] }
}
