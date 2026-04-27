import { z } from 'zod';
import { OpenApiGeneratorV3, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
export declare const openApiRegistry: OpenAPIRegistry;
export declare const bearerAuth: {
    BearerAuth: string[];
}[];
/**
 * Generic envelope used by every IAMS response.
 * Mirrors `ApiResponse<T>` in `shared/types/api-response.type.ts`.
 */
export declare const ApiResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    message: z.ZodString;
    data: z.ZodOptional<z.ZodUnknown>;
    errors: z.ZodOptional<z.ZodUnknown>;
    meta: z.ZodOptional<z.ZodObject<{
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
        total: z.ZodNumber;
        totalPages: z.ZodNumber;
        hasNext: z.ZodBoolean;
        hasPrev: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    }, {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    }>>;
    timestamp: z.ZodString;
    requestId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    message: string;
    success: boolean;
    errors?: unknown;
    meta?: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    } | undefined;
    data?: unknown;
    requestId?: string | undefined;
}, {
    timestamp: string;
    message: string;
    success: boolean;
    errors?: unknown;
    meta?: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    } | undefined;
    data?: unknown;
    requestId?: string | undefined;
}>;
export declare const buildOpenApiDocument: () => ReturnType<OpenApiGeneratorV3["generateDocument"]>;
//# sourceMappingURL=openapi.util.d.ts.map