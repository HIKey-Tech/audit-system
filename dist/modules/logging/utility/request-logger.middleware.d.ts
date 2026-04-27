import { Request, Response, NextFunction } from 'express';
/**
 * Express middleware that automatically logs mutating requests (POST/PUT/PATCH/DELETE)
 * to the audit log after the response is sent.
 */
export declare const requestAuditLogger: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=request-logger.middleware.d.ts.map