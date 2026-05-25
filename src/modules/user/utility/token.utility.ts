// src/modules/user/utility/token.utility.ts
import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import ms from 'ms';
import { config } from '../../../shared/config/app.config';
import { JwtPayload } from '../../../shared/middleware/auth.middleware';
import { TokenPair } from '../domain/entity/token.entity';

const TEMP_PASSWORD_LOWER = 'abcdefghijkmnopqrstuvwxyz';
const TEMP_PASSWORD_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const TEMP_PASSWORD_DIGITS = '23456789';
const TEMP_PASSWORD_SPECIAL = '@$!%*?&';
const TEMP_PASSWORD_ALL =
  TEMP_PASSWORD_LOWER + TEMP_PASSWORD_UPPER + TEMP_PASSWORD_DIGITS + TEMP_PASSWORD_SPECIAL;

const randomChar = (chars: string): string => chars[crypto.randomInt(chars.length)];

const shuffle = (chars: string[]): string[] => {
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars;
};

export const generateAccessToken = (payload: {
  sub: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
}): string => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
};

export const generateRefreshToken = (): {
  raw: string;
  hash: string;
  expiresAt: Date;
} => {
  const raw = crypto.randomBytes(64).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');

  const expiresInMs = ms(config.jwt.refreshExpiresIn);
  const expiresAt = new Date(Date.now() + expiresInMs);

  return { raw, hash, expiresAt };
};

export const generateTemporaryPassword = (length = 14): string => {
  if (length < 8) {
    throw new Error('Temporary password length must be at least 8 characters');
  }

  const chars = [
    randomChar(TEMP_PASSWORD_LOWER),
    randomChar(TEMP_PASSWORD_UPPER),
    randomChar(TEMP_PASSWORD_DIGITS),
    randomChar(TEMP_PASSWORD_SPECIAL),
  ];

  while (chars.length < length) {
    chars.push(randomChar(TEMP_PASSWORD_ALL));
  }

  return shuffle(chars).join('');
};

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

export const comparePassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const buildTokenPair = (
  accessToken: string,
  refreshToken: string,
): TokenPair => ({
  accessToken,
  refreshToken,
  expiresIn: Math.floor(ms(config.jwt.expiresIn) / 1000),
  tokenType: 'Bearer',
});

export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;
};
