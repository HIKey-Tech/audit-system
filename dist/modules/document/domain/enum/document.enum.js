"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateCategory = exports.StorageProvider = void 0;
// src/modules/document/domain/enum/document.enum.ts
var StorageProvider;
(function (StorageProvider) {
    StorageProvider["LOCAL"] = "local";
    StorageProvider["AZURE_BLOB"] = "azure_blob";
    StorageProvider["AWS_S3"] = "aws_s3";
})(StorageProvider || (exports.StorageProvider = StorageProvider = {}));
var TemplateCategory;
(function (TemplateCategory) {
    TemplateCategory["WORKING_PAPER"] = "working_paper";
    TemplateCategory["AUDIT_REPORT"] = "audit_report";
    TemplateCategory["FINDING"] = "finding";
    TemplateCategory["RISK_ASSESSMENT"] = "risk_assessment";
    TemplateCategory["CHECKLIST"] = "checklist";
    TemplateCategory["POLICY"] = "policy";
    TemplateCategory["PROCEDURE"] = "procedure";
})(TemplateCategory || (exports.TemplateCategory = TemplateCategory = {}));
//# sourceMappingURL=document.enum.js.map