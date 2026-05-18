import { api } from '../api-client';
import type {
  RoleListDto,
  PermissionDto,
  WorkingPaperTemplateDto,
  ReportTemplateDto,
  SystemConfigDto,
  SettingsAuditType,
  WorkingPaperTemplateSection,
  ReportTemplateSection,
  ReportTemplateVariable,
} from '../types/domain';

// ============================================================
// Roles
// ============================================================
export interface CreateRoleDto {
  name: string;
  description?: string;
}

export interface UpdateRoleDto {
  name?: string;
  description?: string | null;
}

export type PermissionsGrouped = Record<string, Array<PermissionDto & { description: string | null }>>;

export const rolesApi = {
  list: () => api.get<RoleListDto[]>('/settings/roles'),
  get: (id: string) => api.get<RoleListDto>(`/settings/roles/${id}`),
  create: (dto: CreateRoleDto) => api.post<RoleListDto>('/settings/roles', dto),
  update: (id: string, dto: UpdateRoleDto) =>
    api.put<RoleListDto>(`/settings/roles/${id}`, dto),
  remove: (id: string) => api.delete(`/settings/roles/${id}`),
  replacePermissions: (id: string, permissionIds: string[]) =>
    api.put<RoleListDto>(`/settings/roles/${id}/permissions`, { permissionIds }),
};

export const permissionsApi = {
  listGrouped: () => api.get<PermissionsGrouped>('/settings/permissions'),
};

// ============================================================
// Working Paper Templates
// ============================================================
export interface CreateWPTemplateDto {
  name: string;
  description?: string;
  auditType: SettingsAuditType;
  sections: WorkingPaperTemplateSection[];
  isDefault?: boolean;
}

export interface UpdateWPTemplateDto {
  name?: string;
  description?: string | null;
  auditType?: SettingsAuditType;
  sections?: WorkingPaperTemplateSection[];
  isDefault?: boolean;
}

/** @deprecated use wpTemplatesApi */
export const workingPaperTemplatesApi = {
  getDefault: (auditType: SettingsAuditType | string) =>
    api.get<WorkingPaperTemplateDto>(
      `/settings/working-paper-templates/default/${encodeURIComponent(auditType)}`,
    ),
};

export const wpTemplatesApi = {
  list: () =>
    api.get<WorkingPaperTemplateDto[]>('/settings/working-paper-templates', {
      pageSize: '100',
      sortBy: 'name',
      sortOrder: 'asc',
    } as Record<string, string>),
  create: (dto: CreateWPTemplateDto) =>
    api.post<WorkingPaperTemplateDto>('/settings/working-paper-templates', dto),
  update: (id: string, dto: UpdateWPTemplateDto) =>
    api.put<WorkingPaperTemplateDto>(`/settings/working-paper-templates/${id}`, dto),
  setDefault: (id: string) =>
    api.post<WorkingPaperTemplateDto>(
      `/settings/working-paper-templates/${id}/set-default`,
    ),
  remove: (id: string) =>
    api.delete(`/settings/working-paper-templates/${id}`),
  getDefault: (auditType: SettingsAuditType | string) =>
    api.get<WorkingPaperTemplateDto>(
      `/settings/working-paper-templates/default/${encodeURIComponent(auditType)}`,
    ),
};

// ============================================================
// Report Templates
// ============================================================
export interface CreateReportTemplateDto {
  name: string;
  description?: string;
  sections: ReportTemplateSection[];
  availableVariables: ReportTemplateVariable[];
  isDefault?: boolean;
}

export interface UpdateReportTemplateDto {
  name?: string;
  description?: string | null;
  sections?: ReportTemplateSection[];
  availableVariables?: ReportTemplateVariable[];
  isDefault?: boolean;
}

export const reportTemplatesApi = {
  list: () =>
    api.get<ReportTemplateDto[]>('/settings/report-templates', {
      pageSize: '100',
      sortBy: 'name',
      sortOrder: 'asc',
    } as Record<string, string>),
  create: (dto: CreateReportTemplateDto) =>
    api.post<ReportTemplateDto>('/settings/report-templates', dto),
  update: (id: string, dto: UpdateReportTemplateDto) =>
    api.put<ReportTemplateDto>(`/settings/report-templates/${id}`, dto),
  setDefault: (id: string) =>
    api.post<ReportTemplateDto>(`/settings/report-templates/${id}/set-default`),
  remove: (id: string) => api.delete(`/settings/report-templates/${id}`),
};

// ============================================================
// System Config
// ============================================================
export const systemConfigApi = {
  list: () => api.get<SystemConfigDto[]>('/settings/config'),
  update: (key: string, value: string | null) =>
    api.put<SystemConfigDto>(`/settings/config/${key}`, { value }),
};
