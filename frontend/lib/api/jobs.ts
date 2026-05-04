import { api } from '../api-client';
import type { ScheduledJob } from '../types/domain';

export const jobsApi = {
  list: () => api.get<ScheduledJob[]>('/jobs'),
  get: (id: string) => api.get<ScheduledJob>(`/jobs/${id}`),
  runs: (id: string) => api.get<unknown[]>(`/jobs/${id}/runs`),
  enable: (id: string) => api.post<ScheduledJob>(`/jobs/${id}/enable`),
  disable: (id: string) => api.post<ScheduledJob>(`/jobs/${id}/disable`),
};
