"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MfaAdminResetRequestSchema = exports.MfaVerifyRequestSchema = exports.MfaEnrollRequestSchema = exports.MfaSetupRequestSchema = exports.MfaMethodSchema = exports.ResetPasswordRequestSchema = exports.ForgotPasswordRequestSchema = exports.OidcCallbackRequestSchema = exports.RefreshTokenRequestSchema = exports.LoginRequestSchema = void 0;
// src/modules/user/dto/request/auth.request.dto.ts
const zod_1 = require("zod");
exports.LoginRequestSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
exports.RefreshTokenRequestSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, 'Refresh token is required'),
});
exports.OidcCallbackRequestSchema = zod_1.z.object({
    code: zod_1.z.string(),
    state: zod_1.z.string().min(1, 'state is required'),
    session_state: zod_1.z.string().optional(),
});
exports.ForgotPasswordRequestSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
});
exports.ResetPasswordRequestSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Reset token is required'),
    newPassword: zod_1.z
        .string()
        .min(8)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, 'Password must contain uppercase, lowercase, number and special character'),
});
exports.MfaMethodSchema = zod_1.z.enum(['totp', 'email']);
exports.MfaSetupRequestSchema = zod_1.z.object({
    method: exports.MfaMethodSchema,
});
exports.MfaEnrollRequestSchema = zod_1.z.object({
    method: exports.MfaMethodSchema,
    code: zod_1.z.string().trim().min(1, 'Verification code is required'),
});
exports.MfaVerifyRequestSchema = zod_1.z.object({
    code: zod_1.z.string().trim().min(1, 'Verification code is required'),
});
exports.MfaAdminResetRequestSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid('A valid user id is required'),
});
//# sourceMappingURL=auth.request.dto.js.map