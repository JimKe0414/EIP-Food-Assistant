interface Bucket {
  timestamps: number[]
}

export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  consume(key: string, now = Date.now()) {
    const cutoff = now - this.windowMs
    const bucket = this.buckets.get(key) ?? { timestamps: [] }
    bucket.timestamps = bucket.timestamps.filter(timestamp => timestamp > cutoff)

    if (bucket.timestamps.length >= this.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.timestamps[0] + this.windowMs - now) / 1000))
      return { allowed: false as const, retryAfterSeconds, remaining: 0 }
    }

    bucket.timestamps.push(now)
    this.buckets.set(key, bucket)
    return { allowed: true as const, retryAfterSeconds: 0, remaining: this.limit - bucket.timestamps.length }
  }
}

export const lunchRecommendationLimiter = new SlidingWindowRateLimiter(10, 5 * 60 * 1000)
