"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeEntryController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const time_entry_request_dto_1 = require("../dto/request/time-entry.request.dto");
class TimeEntryController {
    timeEntryService;
    router;
    constructor(timeEntryService) {
        this.timeEntryService = timeEntryService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  POST /audit/engagements/:id/time-entries
         * @desc   Log hours worked on an engagement (audit team only)
         * @access Private - authenticated; service enforces team membership
         */
        this.router.post('/engagements/:id/time-entries', (0, validate_middleware_1.validate)(time_entry_request_dto_1.LogTimeEntrySchema), this._log.bind(this));
        /**
         * @route  GET /audit/engagements/:id/time-entries
         * @desc   Entries + planned-vs-actual summary (audit team only)
         * @access Private - authenticated; service enforces team membership
         */
        this.router.get('/engagements/:id/time-entries', this._list.bind(this));
        /**
         * @route  DELETE /audit/time-entries/:id
         * @desc   Soft-delete an entry (own entries; engagement:read_all may delete any)
         * @access Private - authenticated; service enforces ownership
         */
        this.router.delete('/time-entries/:id', this._delete.bind(this));
    }
    async _log(req, res, next) {
        try {
            const entry = await this.timeEntryService.logTime(req.params.id, req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(entry, 'Time logged'));
        }
        catch (err) {
            next(err);
        }
    }
    async _list(req, res, next) {
        try {
            const summary = await this.timeEntryService.listForEngagement(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(summary));
        }
        catch (err) {
            next(err);
        }
    }
    async _delete(req, res, next) {
        try {
            await this.timeEntryService.deleteEntry(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Time entry deleted'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.TimeEntryController = TimeEntryController;
//# sourceMappingURL=time-entry.controller.js.map