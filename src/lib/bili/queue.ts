/** 令牌桶 + 并发上限，避免触发风控。 */
export class RateLimiter {
  private queue: Array<() => void> = []
  private active = 0
  private lastStart = 0
  private cooldownUntil = 0

  constructor(
    private concurrency = 2,
    private minInterval = 420,
  ) {}

  setConcurrency(n: number): void {
    this.concurrency = Math.max(1, Math.min(6, n))
  }

  /** 风控命中后全局冷却 */
  cooldown(ms: number): void {
    this.cooldownUntil = Math.max(this.cooldownUntil, Date.now() + ms)
  }

  get cooling(): boolean {
    return Date.now() < this.cooldownUntil
  }

  private async gate(): Promise<void> {
    for (;;) {
      const now = Date.now()
      const waitCooldown = this.cooldownUntil - now
      if (waitCooldown > 0) {
        await sleep(Math.min(waitCooldown, 5000))
        continue
      }
      if (this.active >= this.concurrency) {
        await new Promise<void>((resolve) => this.queue.push(resolve))
        continue
      }
      const gap = this.minInterval - (now - this.lastStart)
      if (gap > 0) {
        await sleep(gap + Math.random() * 120)
        continue
      }
      this.active++
      this.lastStart = Date.now()
      return
    }
  }

  private release(): void {
    this.active--
    const next = this.queue.shift()
    if (next) next()
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.gate()
    try {
      return await task()
    } finally {
      this.release()
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
