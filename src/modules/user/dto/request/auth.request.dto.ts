// src/modules/user/dto/request/auth.request.dto.ts
import { z } from 'zod';

export const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const OidcCallbackRequestSchema = z.object({
  code: z.string(),
  state: z.string().min(1, 'state is required'),
  session_state: z.string().optional(),
});

export type LoginRequestDto = z.infer<typeof LoginRequestSchema>;
export type RefreshTokenRequestDto = z.infer<typeof RefreshTokenRequestSchema>;
export type OidcCallbackRequestDto = z.infer<typeof OidcCallbackRequestSchema>;