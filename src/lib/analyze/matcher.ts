/**
 * 多模式匹配：Aho–Corasick 自动机。
 *
 * 判定表里有几百个词，评论动辄上万条，逐词 indexOf 会退化成 O(词数 × 文本数)。
 * 构建一次自动机后，单条文本只扫描一遍，代价与词表规模无关。
 */

export interface TermHit {
  /** 词在 terms 数组中的下标 */
  index: number
  start: number
  end: number
}

interface Node {
  next: Map<string, number>
  fail: number
  out: number[]
}

export class TermMatcher {
  private nodes: Node[] = []
  private readonly maxLen: number

  constructor(private readonly terms: string[]) {
    this.maxLen = terms.reduce((m, t) => Math.max(m, t.length), 0)
    this.build()
  }

  private build(): void {
    this.nodes = [{ next: new Map(), fail: 0, out: [] }]
    for (let i = 0; i < this.terms.length; i++) {
      const term = this.terms[i]
      if (!term) continue
      let state = 0
      for (const ch of term) {
        let next = this.nodes[state].next.get(ch)
        if (next === undefined) {
          next = this.nodes.length
          this.nodes.push({ next: new Map(), fail: 0, out: [] })
          this.nodes[state].next.set(ch, next)
        }
        state = next
      }
      this.nodes[state].out.push(i)
    }

    const queue: number[] = []
    for (const child of this.nodes[0].next.values()) {
      this.nodes[child].fail = 0
      queue.push(child)
    }
    for (let head = 0; head < queue.length; head++) {
      const state = queue[head]
      const node = this.nodes[state]
      for (const [ch, child] of node.next) {
        let f = node.fail
        for (;;) {
          const jump = this.nodes[f].next.get(ch)
          if (jump !== undefined && jump !== child) {
            f = jump
            break
          }
          if (f === 0) {
            f = 0
            break
          }
          f = this.nodes[f].fail
        }
        this.nodes[child].fail = f
        if (this.nodes[f].out.length) this.nodes[child].out = this.nodes[child].out.concat(this.nodes[f].out)
        queue.push(child)
      }
    }
  }

  get size(): number {
    return this.terms.length
  }

  find(text: string): TermHit[] {
    const hits: TermHit[] = []
    let state = 0
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      for (;;) {
        const next = this.nodes[state].next.get(ch)
        if (next !== undefined) {
          state = next
          break
        }
        if (state === 0) break
        state = this.nodes[state].fail
      }
      for (const index of this.nodes[state].out) {
        const len = this.terms[index].length
        hits.push({ index, start: i + 1 - len, end: i + 1 })
      }
    }
    return hits
  }

  /** 只需要「有没有」时用它，避免构造命中数组。 */
  test(text: string): boolean {
    let state = 0
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      for (;;) {
        const next = this.nodes[state].next.get(ch)
        if (next !== undefined) {
          state = next
          break
        }
        if (state === 0) break
        state = this.nodes[state].fail
      }
      if (this.nodes[state].out.length) return true
    }
    return false
  }

  get maxTermLength(): number {
    return this.maxLen
  }
}

/** 小词表直接 includes，够用且省一次自动机构建。 */
export function containsAny(text: string, terms: string[]): string | null {
  for (const t of terms) {
    if (t && text.includes(t)) return t
  }
  return null
}
