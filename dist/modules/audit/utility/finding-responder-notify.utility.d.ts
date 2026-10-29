export type FindingNotifyStage = 'draft' | 'issued';
/**
 * Tell every responder (primary auditee + co-responders) about the findings assigned to them on
 * an engagement, one notification per person.
 *
 * - `draft`: fieldwork is complete (Quality Assurance). Findings are visible and the management
 *   response is requested *before* the report is issued, so it can go into the report.
 * - `issued`: the report has been issued.
 *
 * Best-effort: never throws into the caller.
 */
export declare const notifyFindingResponders: (engagementId: string, engagementReference: string, stage: FindingNotifyStage) => Promise<void>;
//# sourceMappingURL=finding-responder-notify.utility.d.ts.map