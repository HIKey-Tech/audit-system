/**
 * Security events recorded in the audit trail under module `security`. They
 * give auditors a read-only event-monitoring view of authentication and
 * authorisation activity (who signed in, who failed, who was denied) on top of
 * the generic request trail, which cannot say which account was attempted.
 */
export enum SecurityEvent {
  LoginSucceeded = 'auth.login.succeeded',
  LoginFailed = 'auth.login.failed',
  MfaFailed = 'auth.mfa.failed',
  MfaAdminReset = 'auth.mfa.admin_reset',
  TokenReuseDetected = 'auth.token.reuse_detected',
  Logout = 'auth.logout',
  PasswordResetRequested = 'auth.password_reset.requested',
  PasswordResetCompleted = 'auth.password_reset.completed',
  AccessDenied = 'access.denied',
}

export const SECURITY_LOG_MODULE = 'security';

export enum SystemLogSource {
  Http = 'http',
  Job = 'job',
  App = 'app',
}
