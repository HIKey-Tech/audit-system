// src/shared/middleware/validate.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { AppError } from '../errors/app.error';

export const validate =
  // Zod refinements (for example, "provide either ID or number") return a
  // ZodEffects wrapper rather than a bare ZodObject. Accept every Zod schema
  // so controllers can preserve that validation at the HTTP boundary.
  (schema: ZodTypeAny, source: 'body' | 'query' | 'params' = 'body') =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req[source]);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        next(AppError.validationError(details));
      } else {
        next(err);
      }
    }
  };
