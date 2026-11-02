import { Reflex } from './analyze/engine'
import { enabledFamilies } from './verdict'
import type { Targets } from './types'

/** 按当前目标配置构建判定器。词库是常量，构建一次就够，这里只做轻量缓存。 */
let cache: { key: string; reflex: Reflex } | null = null

export function targetsKey(targets: Targets): string {
  return JSON.stringify([targets.modes, targets.extraMarkers, targets.extraGuards])
}

export function buildReflex(targets: Targets): Reflex {
  const key = targetsKey(targets)
  if (cache && cache.key === key) return cache.reflex
  const reflex = new Reflex(enabledFamilies(targets.modes), {
    markers: targets.extraMarkers,
    guards: targets.extraGuards,
  })
  cache = { key, reflex }
  return reflex
}
