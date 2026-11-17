import { api } from '@/lib/api-client';

/** Mirrors src/modules/integration/dynafin/domain/entity/dynafin.entity.ts */
export interface DynafinConnectionInfo {
  enabled: boolean;
  configured: boolean;
  driver: 'http' | 'fixture' | 'disabled';
  /** True when the data is made-up demo data. Never true in production. */
  sampleData: boolean;
}

export interface DynafinStatus {
  reachable: boolean;
  authenticated: boolean;
  lastError: string | null;
  checkedAt: string;
}

export const dynafinApi = {
  status: () => api.get<DynafinConnectionInfo>('/integration/dynafin/status'),
  check: () => api.get<DynafinStatus>('/integration/dynafin/status/check'),
};
