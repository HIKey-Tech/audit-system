// src/shared/utils/hash.util.ts
import { createHash } from 'crypto';

/** SHA-256 of a buffer or string, as lowercase hex. */
export const sha256Hex = (input: Buffer | string): string =>
  createHash('sha256').update(input).digest('hex');
