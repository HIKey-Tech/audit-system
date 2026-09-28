import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny } from 'zod';
export declare const validate: (schema: ZodTypeAny, source?: "body" | "query" | "params") => (req: Request, _res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=validate.middleware.d.ts.map