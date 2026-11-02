import type { Candidate, FamilyMatch } from '../types'
import { familyLabel } from '../verdict'

/**
 * 复核员提示词。
 * 只在用户配置了 API 时启用，用来裁决「分数到了、但拿不准」的边界候选。
 */
export const ARBITER_SYSTEM = `你是内容审核复核员。给你一类目标人群的定义，以及某个 B 站账号的证据片段，判断这个账号是否属于该类。

只输出 JSON：
{"decision":"block"|"pass"|"unsure","reason":"不超过 30 字的中文理由"}

判断要求：
- 只有证据体现的是「目标人群自己的立场或表达」时才判 block。
- 如果证据是批判、反驳、揭露、科普、转述该立场，判 pass。
- 如果只是聊到相关话题但没有明确立场，判 pass。
- 证据不足以下结论时判 unsure，不要勉强判断。
- 不要因为「评论区只有一条发言」就放宽标准，也不要因为粉丝多就放行。`

export function arbiterUserPrompt(match: FamilyMatch, candidate: Candidate): string {
  const snippets = candidate.evidences.slice(0, 8).map((e, i) => `${i + 1}. [${e.source}] ${e.text.slice(0, 200)}`)
  return [
    `判定类别：${familyLabel(match.family)}`,
    `机器命中的依据：${match.reasons.join('；') || '（无）'}`,
    '',
    `账号昵称：${candidate.uname}`,
    `个性签名：${candidate.sign || '（空）'}`,
    `粉丝数：${candidate.fans ?? 0}`,
    '',
    '内容片段：',
    ...snippets,
  ].join('\n')
}
