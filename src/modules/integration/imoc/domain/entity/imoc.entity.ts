export interface ImocProcessingRecord {
  handleOpinion: string | null;
  handleResult: string | null;
  handleTime: string | null;
  handleUser: string | null;
  handleGroupName: string | null;
  stepName: string | null;
}

/**
 * Deliberately safe projection of an IMOC ticket. Raw form fields, model field
 * definitions, and privacy/secret values are never passed through IAMS.
 */
export interface ImocTicket {
  orderId: string;
  orderNumber: string;
  orderName: string | null;
  modelId: string | null;
  modelName: string | null;
  modelType: string | null;
  orderStatus: string | null;
  slaStatus: string | null;
  currentStepId: string | null;
  currentStepName: string | null;
  currentStepSequence: number | null;
  currentUser: string | null;
  currentHandlingGroup: string | null;
  applicant: string | null;
  beginTime: string | null;
  endTime: string | null;
  processType: string | null;
  sourceTenant: string | null;
  processingHistory: ImocProcessingRecord[];
  retrievedAt: string;
}

export interface ImocTicketPage {
  items: ImocTicket[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface ImocModelSummary {
  modelId: string;
  modelName: string | null;
  modelType: string | null;
  isSensitive: boolean | null;
  isEnabled: boolean | null;
  steps: Array<{
    stepId: string;
    stepName: string | null;
    sequence: number | null;
    distributionMode: string | null;
    signType: string | null;
  }>;
}

export interface ImocTicketLookup {
  orderId?: string;
  orderNumber?: string;
}

export interface ImocTicketSearch {
  page: number;
  pageSize: number;
  orderStatus?: string;
  modelId?: string;
  modelName?: string;
  orderNumber?: string;
  orderName?: string;
  currentUser?: string;
  slaStatus?: string;
  beginStartDate?: string;
  beginEndDate?: string;
  endStartDate?: string;
  endEndDate?: string;
}

export interface ImocIntegrationStatus {
  enabled: boolean;
  configured: boolean;
  syncEnabled: boolean;
  lastSuccessfulSyncAt: string | null;
  linkedTicketCount: number;
  connectionMessage: string;
}
