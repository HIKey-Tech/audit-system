import {
  buildSafeImocSnapshot,
  hashSnapshot,
  normalizeImocModel,
  normalizeImocTicket,
} from '../utility/imoc.utility';

describe('IMOC response normalisation', () => {
  it('projects only allow-listed ticket context and processing history', () => {
    const ticket = normalizeImocTicket({
      orderId: 'imoc-ticket-id',
      orderNumber: 'INC-1001',
      orderName: 'Database availability incident',
      modelId: 'incident-model',
      modelName: 'Incident',
      orderStatus: 'processing',
      slaStatus: 'NORMAL',
      currentStepName: 'Investigate',
      currentStepSeq: 2,
      allCurrentUser: 'Operations Team / A. Analyst',
      processGroups: [{ groupName: 'Operations Team' }],
      logList: [{ handleOpinion: 'Assigned', handleResult: 'assign', handleTime: '2026-09-20 10:00:00', handleUser: 'analyst', stepName: 'Triage' }],
      // These representative dynamic form fields must never reach the IAMS DTO.
      fieldList: [{ fieldName: 'Customer phone', secret: 'yes', fieldDefault: '+234...' }],
      arbitrarySensitivePayload: 'must not leak',
    });

    expect(ticket).toMatchObject({
      orderId: 'imoc-ticket-id',
      orderNumber: 'INC-1001',
      currentHandlingGroup: 'Operations Team',
      processingHistory: [{ stepName: 'Triage', handleUser: 'analyst' }],
    });
    expect(ticket).not.toHaveProperty('fieldList');
    expect(ticket).not.toHaveProperty('arbitrarySensitivePayload');
  });

  it('creates a stable redacted snapshot without IMOC form definitions', () => {
    const ticket = normalizeImocTicket({
      orderId: 'imoc-ticket-id',
      orderNumber: 'INC-1001',
      orderStatus: 'completed',
      currentStepSeq: 4,
      stepList: [{ fieldList: [{ secret: 'yes' }] }],
    });
    const snapshot = buildSafeImocSnapshot(ticket);

    expect(JSON.stringify(snapshot)).toContain('INC-1001');
    expect(JSON.stringify(snapshot)).not.toContain('fieldList');
    expect(JSON.stringify(snapshot)).not.toContain('secret');
    expect(hashSnapshot(snapshot)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('allows safe model metadata but excludes its dynamic field configuration', () => {
    const model = normalizeImocModel({
      modelId: 'incident-model',
      modelName: 'Incident',
      isSensitive: 'yes',
      enableFlag: 'true',
      stepList: [{ stepId: 'triage', stepName: 'Triage', stepSeq: 1, fieldList: [{ secret: 'yes' }] }],
    });

    expect(model).toEqual({
      modelId: 'incident-model',
      modelName: 'Incident',
      modelType: null,
      isSensitive: true,
      isEnabled: true,
      steps: [{ stepId: 'triage', stepName: 'Triage', sequence: 1, distributionMode: null, signType: null }],
    });
  });
});
