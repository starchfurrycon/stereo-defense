import { genderPacks } from './gender'
import { gamePacks } from './game'
import { ideologyPacks } from './ideology'
import { miscPacks } from './misc'
import type { FamilyId } from '../families'
import type { Pack } from './shared'

export const ALL_PACKS: Pack[] = [...ideologyPacks, ...genderPacks, ...gamePacks, ...miscPacks]

export const PACK_MAP = new Map<FamilyId, Pack>(ALL_PACKS.map((p) => [p.id, p]))

export function getPack(id: FamilyId): Pack {
  const pack = PACK_MAP.get(id)
  if (!pack) throw new Error(`未知的目标分类：${id}`)
  return pack
}

export type { Pack, Rule, FamilyLevel, StructuralRule } from './shared'
export { STRONG_GUARDS, SOFT_GUARDS, NEGATIONS, DEFAULT_LEVEL } from './shared'
