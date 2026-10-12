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
    priority: string | null;
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
export interface ImocRealStatus {
    reachable: boolean;
    authenticated: boolean;
    lastError: string | null;
    checkedAt: string;
}
export interface ImocRuleCriteria {
    orderStatus?: Array<'processing' | 'dismissed' | 'reback' | 'completed' | 'suspend' | 'scrapped' | 'draft'>;
    slaStatus?: string[];
    modelIds?: string[];
    modelNames?: string[];
    modelTypes?: string[];
    orderSources?: string[];
    nameContains?: string;
    currentUsers?: string[];
    createdWithinDays?: number;
}
export interface ImocIngestionRuleEntity {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    priority: number;
    criteria: ImocRuleCriteria;
    category: string | null;
    riskCategoryId: string | null;
    lookbackDays: number;
    lastRunAt: string | null;
    lastRunStatus: string | null;
    lastRunFetched: number | null;
    lastRunIngested: number | null;
    lastRunError: string | null;
    createdById: string;
    updatedById: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface ImocIngestionRunEntity {
    id: string;
    trigger: 'scheduled' | 'manual';
    triggeredById: string | null;
    startedAt: string;
    finishedAt: string | null;
    status: 'running' | 'success' | 'partial' | 'failed';
    rulesEvaluated: number;
    fetched: number;
    created: number;
    updated: number;
    skipped: number;
    errorSummary: string | null;
    createdAt: string;
}
export interface ImocIngestionRunSummary {
    runId: string;
    status: 'running' | 'success' | 'partial' | 'failed' | 'skipped';
    trigger: 'scheduled' | 'manual';
    rulesEvaluated: number;
    fetched: number;
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
    durationMs: number;
}
export interface ImocStoredTicket {
    id: string;
    orderId: string;
    orderNumber: string;
    orderName: string | null;
    modelId: string | null;
    modelName: string | null;
    modelType: string | null;
    orderSource: string | null;
    orderStatus: string | null;
    slaStatus: string | null;
    priority: string | null;
    currentHandler: string | null;
    createdByName: string | null;
    imocCreatedAt: string | null;
    imocEndedAt: string | null;
    category: string | null;
    matchedRuleIds: string[];
    matchedRuleNames?: string[];
    linkedEngagementCount?: number;
    riskCount?: number;
    firstIngestedAt: string;
    lastSyncedAt: string;
    isActive: boolean;
}
export interface ImocStoredSummary {
    total: number;
    slaBreachedCount: number;
    openCount: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    bySlaStatus: Record<string, number>;
    byMonth: Array<{
        month: string;
        count: number;
    }>;
    topModels: Array<{
        modelId: string;
        modelName: string;
        count: number;
    }>;
}
export interface ImocSavedViewEntity {
    id: string;
    name: string;
    filters: Record<string, unknown>;
    ownerId: string;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface ImocTicketRiskLinkEntity {
    id: string;
    imocTicketId: string;
    riskId: string;
    notes: string | null;
    createdById: string;
    createdAt: string;
    updatedAt: string;
    risk?: {
        id: string;
        title: string;
        status: string;
        currentScore: number;
    };
}
//# sourceMappingURL=imoc.entity.d.ts.map