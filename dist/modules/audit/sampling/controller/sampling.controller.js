"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SamplingController = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const app_error_1 = require("../../../../shared/errors/app.error");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const sampling_request_dto_1 = require("../dto/request/sampling.request.dto");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
class SamplingController {
    samplingService;
    router;
    constructor(samplingService) {
        this.samplingService = samplingService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  POST /audit/engagements/:id/sampling
         * @desc   Draw a reproducible audit sample from an uploaded population CSV;
         *         stores population + sample as engagement evidence
         * @access Private - evidence:upload (the run creates evidence records)
         */
        this.router.post('/engagements/:id/sampling', (0, auth_middleware_1.requirePermission)('evidence:upload'), upload.single('file'), (0, validate_middleware_1.validate)(sampling_request_dto_1.RunSamplingRequestSchema), this._runSampling.bind(this));
    }
    async _runSampling(req, res, next) {
        try {
            if (!req.file)
                throw app_error_1.AppError.badRequest('Population file is required (multipart field "file")');
            const isCsv = /\.csv$/i.test(req.file.originalname) ||
                ['text/csv', 'application/csv', 'application/vnd.ms-excel'].includes(req.file.mimetype);
            if (!isCsv)
                throw app_error_1.AppError.badRequest('Population file must be a CSV');
            const result = await this.samplingService.runSampling(req.params.id, {
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                fileSize: req.file.size,
                buffer: req.file.buffer,
            }, req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(result, 'Sample drawn'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.SamplingController = SamplingController;
//# sourceMappingURL=sampling.controller.js.map