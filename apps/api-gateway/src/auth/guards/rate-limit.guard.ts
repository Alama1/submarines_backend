import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';

interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;

const RULES: Array<{ test: (method: string, url: string) => boolean; limit: number }> = [
  {
    test: (method, url) => method === 'POST' && (url === '/api/orders' || url === '/orders'),
    limit: 10,
  },
  {
    test: (method, url) =>
      method === 'GET' &&
      (url.startsWith('/api/orders/lookup/') || url.startsWith('/orders/lookup/')),
    limit: 60,
  },
];

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private readonly sweeper = setInterval(() => this.sweep(), WINDOW_MS);

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const url: string = (req.raw?.url ?? req.url ?? '').split('?')[0];
    const method: string = req.method ?? 'GET';
    const ip: string = req.ip ?? req.raw?.socket?.remoteAddress ?? 'unknown';

    const limit = RULES.find((r) => r.test(method, url))?.limit ?? 240;
    const key = `${ip}|${limit}`;
    const now = Date.now();

    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + WINDOW_MS };
      this.buckets.set(key, bucket);
    }

    bucket.count++;
    if (bucket.count > limit) {
      throw new HttpException(
        { statusCode: 429, message: 'Too Many Requests', retryAfterMs: bucket.resetAt - now },
        429,
      );
    }
    return true;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
