// src/modules/user/utility/token.utility.ts
import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import ms from 'ms';
import { config } from '../../../shared/config/app.config';
import { JwtPayload } from '../../../shared/middleware/auth.middleware';
import { TokenPair } from '../domain/entity/token.entity';

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
