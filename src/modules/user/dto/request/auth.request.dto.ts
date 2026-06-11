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

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      'Password must contain uppercase, lowercase, number and special character',
    ),
});

export const MfaMethodSchema = z.enum(['totp', 'email']);

export const MfaSetupRequestSchema = z.object({
  method: MfaMethodSchema,
});

export const MfaEnrollRequestSchema = z.object({
  method: MfaMethodSchema,
  code: z.string().trim().min(1, 'Verification code is required'),
});

export const MfaVerifyRequestSchema = z.object({
  code: z.string().trim().min(1, 'Verification code is required'),
});

export const MfaAdminResetRequestSchema = z.object({
  userId: z.string().uuid('A valid user id is required'),
});

export type LoginRequestDto = z.infer<typeof LoginRequestSchema>;
export type RefreshTokenRequestDto = z.infer<typeof RefreshTokenRequestSchema>;
export type OidcCallbackRequestDto = z.infer<typeof OidcCallbackRequestSchema>;
export type ForgotPasswordRequestDto = z.infer<typeof ForgotPasswordRequestSchema>;
export type ResetPasswordRequestDto = z.infer<typeof ResetPasswordRequestSchema>;
export type MfaMethod = z.infer<typeof MfaMethodSchema>;
export type MfaSetupRequestDto = z.infer<typeof MfaSetupRequestSchema>;
export type MfaEnrollRequestDto = z.infer<typeof MfaEnrollRequestSchema>;
export type MfaVerifyRequestDto = z.infer<typeof MfaVerifyRequestSchema>;
export type MfaAdminResetRequestDto = z.infer<typeof MfaAdminResetRequestSchema>;