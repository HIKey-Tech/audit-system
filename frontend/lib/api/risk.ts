import { api } from '../api-client';
import type { Risk, RiskCategory, RiskAssessment } from '../types/domain';

export interface RisksListQuery {
  page?: number;
  pageSize?: number;
  categoryId?: string;
  status?: string;
  scoreBand?: 'critical' | 'high' | 'medium' | 'low';
  search?: string;
}

export interface CreateRiskDto {
  title: string;
  description?: string;
  categoryId: string;
  ownerId: string;
  likelihood: number;
  impact: number;
  status?: string;
  universeId?: string;
}

export interface CreateAssessmentDto {
  likelihood: number;
  impact: number;
  notes?: string;
}

export interface CreateRiskCategoryDto {
  name: string;
  description?: string;
}

export interface RiskMonitoringSummary {
  total: number;
  byScoreBand: { critical: number; high: number; medium: number; low: number };
  byStatus: { open: number; mitigated: number; accepted: number; closed: number };
}

export const riskApi = {
  // categories
  listCategories: () => api.get<RiskCategory[]>('/risk/categories'),
  createCategory: (dto: CreateRiskCategoryDto) =>
    api.post<RiskCategory>('/risk/categories', dto),
  updateCategory: (id: string, dto: Partial<CreateRiskCategoryDto>) =>
    api.put<RiskCategory>(`/risk/categories/${id}`, dto),
  deactivateCategory: (id: string) => api.delete(`/risk/categories/${id}`),

  // register
  list: (q?: RisksListQuery) =>
    api.getPaginated<Risk>('/risk/register', q as Record<string, string | number | boolean | undefined>),
  get: (id: string) => api.get<Risk>(`/risk/register/${id}`),
  listByUniverse: (universeId: string) =>
    api.get<Risk[]>(`/risk/register/universe/${universeId}`),
  create: (dto: CreateRiskDto) => api.post<Risk>('/risk/register', dto),
  update: (id: string, dto: Partial<CreateRiskDto>) =>
    api.put<Risk>(`/risk/register/${id}`, dto),
  updateStatus: (id: string, status: string) =>
    api.patch<Risk>(`/risk/register/${id}/status`, { status }),
  remove: (id: string) => api.delete(`/risk/register/${id}`),

  // assessments
  listAssessments: (riskId: string) =>
    api.get<RiskAssessment[]>(`/risk/register/${riskId}/assessments`),
  getLatestAssessment: (riskId: string) =>
    api.get<RiskAssessment>(`/risk/register/${riskId}/assessments/latest`),
  getTrend: (riskId: string) =>
    api.get<RiskAssessment[]>(`/risk/register/${riskId}/trend`),
  createAssessment: (riskId: string, dto: CreateAssessmentDto) =>
    api.post<RiskAssessment>(`/risk/register/${riskId}/assessments`, dto),

  // monitoring
  getHighRisk: () => api.get<Risk[]>('/risk/monitoring/high-risk'),
  getAttentionRequired: () => api.get<Risk[]>('/risk/monitoring/attention-required'),
  getSummary: () => api.get<RiskMonitoringSummary>('/risk/monitoring/summary'),
};
