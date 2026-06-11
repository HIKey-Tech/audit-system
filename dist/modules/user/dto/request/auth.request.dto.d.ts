import { z } from 'zod';
export declare const LoginRequestSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const RefreshTokenRequestSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
export declare const OidcCallbackRequestSchema: z.ZodObject<{
    code: z.ZodString;
    state: z.ZodString;
    session_state: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    state: string;
    session_state?: string | undefined;
}, {
    code: string;
    state: string;
    session_state?: string | undefined;
}>;
export declare const ForgotPasswordRequestSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const ResetPasswordRequestSchema: z.ZodObject<{
    token: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
    newPassword: string;
}, {
    token: string;
    newPassword: string;
}>;
export declare const MfaMethodSchema: z.ZodEnum<["totp", "email"]>;
export declare const MfaSetupRequestSchema: z.ZodObject<{
    method: z.ZodEnum<["totp", "email"]>;
}, "strip", z.ZodTypeAny, {
    method: "email" | "totp";
}, {
    method: "email" | "totp";
}>;
export declare const MfaEnrollRequestSchema: z.ZodObject<{
    method: z.ZodEnum<["totp", "email"]>;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    method: "email" | "totp";
}, {
    code: string;
    method: "email" | "totp";
}>;
export declare const MfaVerifyRequestSchema: z.ZodObject<{
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
}, {
    code: string;
}>;
export declare const MfaAdminResetRequestSchema: z.ZodObject<{
    userId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    userId: string;
}, {
    userId: string;
}>;
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
//# sourceMappingURL=auth.request.dto.d.ts.map