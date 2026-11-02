import { calibrate, calibrateSignals } from '../src/lib/analyze/calibrate'
import { ALL_PACKS } from '../src/lib/analyze/packs'
import { PRESET_MODES } from '../src/lib/verdict'
import type { FamilyId } from '../src/lib/analyze/families'

/**
 * 判定自检的 CLI 版本。界面里的「自检」面板跑的是同一套逻辑。
 *
 *   pnpm eval          看总表
 *   pnpm eval -- -v    看每一条漏判与误伤
 */

declare const process: { argv: string[]; exitCode?: number }

const verbose = process.argv.includes('-v') || process.argv.includes('--verbose')

/** 标准力度下的底线：召回不能低于 80%，反例误伤不能超过 10%。CI 用它当回归门。 */
const GATE = { recall: 0.8, falseRate: 0.1 }
let gateFailed = false

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`
}

function pad(s: string, n: number): string {
  // 中文按两格宽对齐
  let width = 0
  for (const ch of s) width += /[\u4e00-\u9fff]/.test(ch) ? 2 : 1
  return s + ' '.repeat(Math.max(0, n - width))
}

for (const preset of ['conservative', 'standard', 'aggressive'] as const) {
  const families = (Object.keys(PRESET_MODES[preset]) as FamilyId[]).filter(
    (f) => PRESET_MODES[preset][f] !== 'off',
  )
  const modes = PRESET_MODES[preset]
  const result = calibrate(families, modes)
  const signal = calibrateSignals(modes)

  console.log(`\n=== ${preset} ===`)
  console.log(`${pad('分类', 14)}${pad('样本', 6)}${pad('命中', 6)}${pad('边缘', 6)}召回`)
  for (const row of result.families) {
    const recall = row.targets ? row.caught / row.targets : 0
    console.log(
      `${pad(row.label, 14)}${pad(String(row.targets), 6)}${pad(String(row.caught), 6)}${pad(
        String(row.borderline),
        6,
      )}${pct(recall)}`,
    )
  }
  const recall = result.targetTotal ? result.targetCaught / result.targetTotal : 0
  const falseRate = result.negativeTotal ? result.negativeHit / result.negativeTotal : 0
  console.log(
    `合计：目标 ${result.targetCaught}/${result.targetTotal}（${pct(recall)}） · 误伤 ${result.negativeHit}/${result.negativeTotal}（${pct(falseRate)}）`,
  )
  console.log(`结构信号：${signal.hits}/${signal.total}，误伤 ${signal.falseHits}/${signal.negatives}`)

  if (preset === 'standard') {
    if (recall < GATE.recall || falseRate > GATE.falseRate) {
      gateFailed = true
      console.error(`⚠ 标准力度未达底线：召回 ${pct(recall)} / 误伤 ${pct(falseRate)}`)
    }
    if (signal.hits < signal.total) {
      gateFailed = true
      console.error(`⚠ 结构信号漏判 ${signal.total - signal.hits} 条`)
    }
  }

  if (verbose) {
    for (const row of result.families) {
      for (const m of row.missed) {
        console.log(`  漏 ${row.label} ${m.score.toFixed(2)} ${m.text}`)
      }
    }
    for (const f of result.falseHits) {
      console.log(`  误 ${f.label} ${f.score.toFixed(2)} [${f.kind}] ${f.text} ← ${f.reason}`)
    }
    for (const d of signal.detail) {
      const watched = d.expect !== '放行' && !d.blocked && d.got === d.expect
      if (d.expect !== '放行' && !d.blocked) {
        console.log(`  结构漏 ${d.note} → ${d.got} ${d.score.toFixed(2)}${watched ? '（阈值未到）' : ''}`)
      }
      if (d.expect === '放行' && d.blocked) console.log(`  结构误 ${d.note} → ${d.got} ${d.score.toFixed(2)}`)
    }
  }
}

console.log(`\n分类总数：${ALL_PACKS.length}`)
if (gateFailed) process.exitCode = 1
