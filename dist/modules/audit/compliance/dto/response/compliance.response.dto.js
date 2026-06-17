"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapControlToResponse = exports.mapFrameworkToResponse = void 0;
const audit_utility_1 = require("../../../utility/audit.utility");
const mapFrameworkToResponse = (f) => ({
    id: f.id,
    code: f.code,
    name: f.name,
    description: f.description,
    category: f.category,
    isActive: f.is_active,
    createdAt: (0, audit_utility_1.toIso)(f.created_at),
    updatedAt: (0, audit_utility_1.toIso)(f.updated_at),
});
exports.mapFrameworkToResponse = mapFrameworkToResponse;
const mapControlToResponse = (c) => ({
    id: c.id,
    frameworkId: c.framework_id,
    frameworkCode: c.framework?.code ?? null,
    frameworkName: c.framework?.name ?? null,
    controlReference: c.control_reference,
    controlDescription: c.control_description,
    testProcedure: c.test_procedure,
    auditType: c.audit_type,
    isActive: c.is_active,
    createdAt: (0, audit_utility_1.toIso)(c.created_at),
    updatedAt: (0, audit_utility_1.toIso)(c.updated_at),
});
exports.mapControlToResponse = mapControlToResponse;
//# sourceMappingURL=compliance.response.dto.js.map