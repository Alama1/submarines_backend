import * as crypto from 'crypto';

const CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excludes confusing characters 0/O, 1/I

function randomGroup(): string {
  const bytes = crypto.randomBytes(4);
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += CHARS[bytes[i] % CHARS.length];
  }
  return out;
}

/**
 * Builds a `PREFIX-XXXX-XXXX...` code, retrying until `exists` says the code
 * is free. After 10 collisions it falls back to a timestamp-based code
 * (still unique in practice, slightly less pretty).
 */
export async function generateReadableCode(
  prefix: string,
  groups: number,
  exists: (code: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = `${prefix}-${Array.from({ length: groups }, () => randomGroup()).join('-')}`;
    if (!(await exists(code))) return code;
  }
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}
