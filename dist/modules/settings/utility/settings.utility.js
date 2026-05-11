"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stringifyJson = exports.parseNullableJson = exports.asReportVariables = exports.asReportSections = exports.asWorkingPaperSections = exports.toStoredReportTemplateSections = exports.toReportTemplateSections = void 0;
const app_error_1 = require("../../../shared/errors/app.error");
const toReportTemplateSections = (sections) => sections.map((section) => ({
    key: section.key,
    title: section.title,
    description: section.description,
    includeFindings: section.includeFindings ?? section.include_findings ?? false,
}));
exports.toReportTemplateSections = toReportTemplateSections;
const toStoredReportTemplateSections = (sections) => sections.map((section) => ({
    key: section.key,
    title: section.title,
    description: section.description,
    include_findings: section.includeFindings,
}));
exports.toStoredReportTemplateSections = toStoredReportTemplateSections;
const asWorkingPaperSections = (value) => parseJson(value);
exports.asWorkingPaperSections = asWorkingPaperSections;
const asReportSections = (value) => (0, exports.toReportTemplateSections)(parseJson(value));
exports.asReportSections = asReportSections;
const asReportVariables = (value) => parseJson(value);
exports.asReportVariables = asReportVariables;
const parseNullableJson = (value) => {
    if (value === null)
        return null;
    return parseJson(value);
};
exports.parseNullableJson = parseNullableJson;
const stringifyJson = (value) => JSON.stringify(value);
exports.stringifyJson = stringifyJson;
const parseJson = (value) => {
    if (typeof value !== 'string')
        return value;
    try {
        return JSON.parse(value);
    }
    catch {
        throw app_error_1.AppError.internal('Stored settings JSON is invalid');
    }
};
//# sourceMappingURL=settings.utility.js.map