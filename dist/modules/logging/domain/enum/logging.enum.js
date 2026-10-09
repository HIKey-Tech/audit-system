"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemLogSource = exports.SECURITY_LOG_MODULE = exports.SecurityEvent = void 0;
/**
 * Security events recorded in the audit trail under module `security`. They
 * give auditors a read-only event-monitoring view of authentication and
 * authorisation activity (who signed in, who failed, who was denied) on top of
 * the generic request trail, which cannot say which account was attempted.
 */
var SecurityEvent;
(function (SecurityEvent) {
    SecurityEvent["LoginSucceeded"] = "auth.login.succeeded";
    SecurityEvent["LoginFailed"] = "auth.login.failed";
    SecurityEvent["MfaFailed"] = "auth.mfa.failed";
    SecurityEvent["MfaAdminReset"] = "auth.mfa.admin_reset";
    SecurityEvent["TokenReuseDetected"] = "auth.token.reuse_detected";
    SecurityEvent["Logout"] = "auth.logout";
    SecurityEvent["PasswordResetRequested"] = "auth.password_reset.requested";
    SecurityEvent["PasswordResetCompleted"] = "auth.password_reset.completed";
    SecurityEvent["AccessDenied"] = "access.denied";
})(SecurityEvent || (exports.SecurityEvent = SecurityEvent = {}));
exports.SECURITY_LOG_MODULE = 'security';
var SystemLogSource;
(function (SystemLogSource) {
    SystemLogSource["Http"] = "http";
    SystemLogSource["Job"] = "job";
    SystemLogSource["App"] = "app";
})(SystemLogSource || (exports.SystemLogSource = SystemLogSource = {}));
//# sourceMappingURL=logging.enum.js.map