import { Reflex } from '../src/lib/analyze/engine'
import { ALL_PACKS } from '../src/lib/analyze/packs'

declare const process: { argv: string[] }

const text = process.argv.slice(2).join(' ') || '这游戏明明是一般向，凭什么让男玩家叫老婆'
const reflex = new Reflex(ALL_PACKS.map((p) => p.id))
for (const v of reflex.evaluate(text)) {
  console.log(`${v.family} ${v.score.toFixed(3)} solo=${v.soloWeight} clean=${v.clean}`)
  for (const h of v.hits) {
    console.log(`   ${h.term} ← ${h.reason} w=${h.weight.toFixed(3)} raw=${h.rawWeight} guard=${h.guarded} quote=${h.quoted} neg=${h.negated} pen=${h.penalized}`)
  }
}
