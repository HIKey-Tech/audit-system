"use strict";
// src/modules/messaging/utility/template.utility.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTemplate = void 0;
const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
const renderTemplate = (body, variables) => body.replace(PLACEHOLDER_PATTERN, (match, key) => {
    const value = variables[key];
    return value === undefined ? match : value;
});
exports.renderTemplate = renderTemplate;
//# sourceMappingURL=template.utility.js.map