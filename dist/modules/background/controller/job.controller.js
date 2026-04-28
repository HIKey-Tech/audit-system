"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackgroundJobController = void 0;
// src/modules/background/controller/job.controller.ts
const express_1 = require("express");
const auth_middleware_1 = require("../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../shared/types/api-response.type");
const job_request_dto_1 = require("../dto/request/job.request.dto");
class BackgroundJobController {
    jobService;
    router;
    constructor(jobService) {
        this.jobService = jobService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        // All job routes require authentication
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /jobs
         * @desc   List all registered background jobs with current status and last run
         * @access Private — job:read
         */
        this.router.get('/', (0, auth_middleware_1.requirePermission)('job:read'), this._listJobs.bind(this));
        /**
         * @route  GET /jobs/:id
         * @desc   Get a single background job by ID with its run history
         * @access Private — job:read
         */
        this.router.get('/:id', (0, auth_middleware_1.requirePermission)('job:read'), (0, validate_middleware_1.validate)(job_request_dto_1.JobIdParamsSchema, 'params'), this._getJobById.bind(this));
        /**
         * @route  GET /jobs/:id/runs
         * @desc   Paginated run history for a specific job
         * @access Private — job:read
         */
        this.router.get('/:id/runs', (0, auth_middleware_1.requirePermission)('job:read'), (0, validate_middleware_1.validate)(job_request_dto_1.JobIdParamsSchema, 'params'), (0, validate_middleware_1.validate)(job_request_dto_1.JobRunHistoryQuerySchema, 'query'), this._listRuns.bind(this));
        /**
         * @route  POST /jobs/:id/enable
         * @desc   Enable and immediately start a background job
         * @access Private — job:admin
         */
        this.router.post('/:id/enable', (0, auth_middleware_1.requirePermission)('job:admin'), (0, validate_middleware_1.validate)(job_request_dto_1.JobIdParamsSchema, 'params'), this._enableJob.bind(this));
        /**
         * @route  POST /jobs/:id/disable
         * @desc   Disable and immediately stop a background job
         * @access Private — job:admin
         */
        this.router.post('/:id/disable', (0, auth_middleware_1.requirePermission)('job:admin'), (0, validate_middleware_1.validate)(job_request_dto_1.JobIdParamsSchema, 'params'), this._disableJob.bind(this));
    }
    async _listJobs(_req, res, next) {
        try {
            const jobs = await this.jobService.listJobs();
            res.status(200).json((0, api_response_type_1.buildResponse)(jobs));
        }
        catch (err) {
            next(err);
        }
    }
    async _getJobById(req, res, next) {
        try {
            const job = await this.jobService.getJobById(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(job));
        }
        catch (err) {
            next(err);
        }
    }
    async _listRuns(req, res, next) {
        try {
            const { runs, meta } = await this.jobService.listRuns(req.params.id, req.query);
            res.status(200).json({ ...(0, api_response_type_1.buildResponse)(runs), meta });
        }
        catch (err) {
            next(err);
        }
    }
    async _enableJob(req, res, next) {
        try {
            const job = await this.jobService.enableJob(req.params.id, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(job, 'Job enabled'));
        }
        catch (err) {
            next(err);
        }
    }
    async _disableJob(req, res, next) {
        try {
            const job = await this.jobService.disableJob(req.params.id, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(job, 'Job disabled'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.BackgroundJobController = BackgroundJobController;
//# sourceMappingURL=job.controller.js.map