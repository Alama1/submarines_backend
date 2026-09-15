import { createHash, timingSafeEqual } from 'node:crypto';

export const INTERNAL_TOKEN_HEADER = 'x-internal-token';

export interface InternalEnvelope<T> {
  token: string;
  payload: T;
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export function safeTokenCompare(provided: string, expected: string): boolean {
  return timingSafeEqual(sha256(provided), sha256(expected));
}

export function createEnvelope<T>(payload: T): InternalEnvelope<T> {
  const token = process.env.INTERNAL_TOKEN;
  if (!token) {
    throw new Error('INTERNAL_TOKEN env var is required to publish internal messages');
  }
  return { token, payload };
}

export function readEnvelope<T>(data: unknown): T | null {
  if (!data || typeof data !== 'object') return null;
  const { token, payload } = data as Record<string, unknown>;
  const expected = process.env.INTERNAL_TOKEN;
  if (!expected || typeof token !== 'string' || !safeTokenCompare(token, expected)) {
    return null;
  }
  return payload as T;
}
