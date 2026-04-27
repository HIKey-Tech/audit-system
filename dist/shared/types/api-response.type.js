"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePagination = exports.buildPaginationMeta = exports.buildResponse = void 0;
const buildResponse = (data, message = 'Success', meta) => ({
    success: true,
    message,
    data,
    meta,
    timestamp: new Date().toISOString(),
});
exports.buildResponse = buildResponse;
const buildPaginationMeta = (total, page, pageSize) => ({
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    hasNext: page * pageSize < total,
    hasPrev: page > 1,
});
exports.buildPaginationMeta = buildPaginationMeta;
const parsePagination = (query) => {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
};
exports.parsePagination = parsePagination;
//# sourceMappingURL=api-response.type.js.map