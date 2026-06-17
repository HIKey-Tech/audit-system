"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepositoryController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const repository_request_dto_1 = require("../dto/request/repository.request.dto");
class RepositoryController {
    repositoryService;
    router;
    constructor(repositoryService) {
        this.repositoryService = repositoryService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /audit/repository
         * @desc   Centralized audit repository — all audit records, supporting
         *         documents and evidence in one paginated list. Use the `category`
         *         query param as the dropdown filter.
         * @access Private - engagement:read
         */
        this.router.get('/repository', (0, auth_middleware_1.requirePermission)('engagement:read'), (0, validate_middleware_1.validate)(repository_request_dto_1.RepositoryQuerySchema, 'query'), this._list.bind(this));
        /**
         * @route  GET /audit/repository/:id/download
         * @desc   Stream a single repository item for download
         * @access Private - engagement:read
         */
        this.router.get('/repository/:id/download', (0, auth_middleware_1.requirePermission)('engagement:read'), this._download.bind(this));
    }
    async _list(req, res, next) {
        try {
            const { items, meta } = await this.repositoryService.list(req.query, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(items, 'Success', meta));
        }
        catch (err) {
            next(err);
        }
    }
    async _download(req, res, next) {
        try {
            const file = await this.repositoryService.getFile(req.params.id, req.user);
            // RFC 5987 encoding keeps non-ASCII filenames intact for browsers.
            const encodedName = encodeURIComponent(file.originalName);
            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Length', file.fileSize);
            res.setHeader('Content-Disposition', `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
            res.status(200).send(file.buffer);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.RepositoryController = RepositoryController;
//# sourceMappingURL=repository.controller.js.map