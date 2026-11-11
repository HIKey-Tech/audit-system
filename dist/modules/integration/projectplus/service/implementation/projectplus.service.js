"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectPlusService = void 0;
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const projectplus_utility_1 = require("../../utility/projectplus.utility");
/**
 * Read-only passthrough. The gateway returns the whole customer list for a type,
 * so search/status filtering and pagination are applied here. Nothing is stored.
 */
class ProjectPlusService {
    client;
    constructor(client) {
        this.client = client;
    }
    getStatus() {
        return { enabled: this.client.enabled, configured: this.client.configured };
    }
    checkStatus() {
        return this.client.checkStatus();
    }
    async listEntities(query) {
        const all = await this.client.listEntities(query.customerType);
        const status = query.status?.toLowerCase();
        const filtered = all.filter((e) => (!status || e.status?.toLowerCase() === status) &&
            (!query.search || (0, projectplus_utility_1.matchesProjectPlusSearch)(e, query.search)));
        const start = (query.page - 1) * query.pageSize;
        logger_util_1.logger.info('Project Plus entities listed', {
            customerType: query.customerType,
            fetched: all.length,
            matched: filtered.length,
        });
        return {
            items: filtered.slice(start, start + query.pageSize),
            total: filtered.length,
            page: query.page,
            pageSize: query.pageSize,
        };
    }
    getContractDocumentTypes() {
        return this.client.getContractDocumentTypes();
    }
}
exports.ProjectPlusService = ProjectPlusService;
//# sourceMappingURL=projectplus.service.js.map