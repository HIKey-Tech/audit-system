export const SETTINGS_AUDIT_TYPES = ['it', 'financial', 'compliance', 'systems', 'all'] as const;
export type SettingsAuditType = typeof SETTINGS_AUDIT_TYPES[number];
