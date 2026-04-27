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
export type LoginRequestDto = z.infer<typeof LoginRequestSchema>;
export type RefreshTokenRequestDto = z.infer<typeof RefreshTokenRequestSchema>;
export type OidcCallbackRequestDto = z.infer<typeof OidcCallbackRequestSchema>;
//# sourceMappingURL=auth.request.dto.d.ts.map