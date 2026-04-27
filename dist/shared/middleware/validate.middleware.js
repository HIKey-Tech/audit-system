"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const zod_1 = require("zod");
const app_error_1 = require("../errors/app.error");
const validate = (schema, source = 'body') => async (req, _res, next) => {
    try {
        const parsed = await schema.parseAsync(req[source]);
        req[source] = parsed;
        next();
    }
    catch (err) {
        if (err instanceof zod_1.ZodError) {
            const details = err.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
            }));
            next(app_error_1.AppError.validationError(details));
        }
        else {
            next(err);
        }
    }
};
exports.validate = validate;
//# sourceMappingURL=validate.middleware.js.map