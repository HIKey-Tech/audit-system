import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { prisma } from '../../../../shared/prisma/prisma.client';
import { borderedTableLayout, renderPdf, severityBadge } from '../../../../shared/utils/pdf.util';

/**
 * Periodic CAE → audit committee oversight pack. Deliberately org-wide (no
 * per-actor scoping): access is gated by the `committee_pack:read` permission
 * on the route, and holders are oversight-level by definition.
 */
export interface CommitteePackDto {
  generatedAt: string;
  periodStart: string;
  engagements: {
    totalThisYear: number;
    byStatus: Array<{ status: string; count: number }>;
    overdue: number;
    completionRate: number;
    recent: Array<{
      referenceNumber: string;
      title: string;
      status: string;
      auditType: string;
      slaDeadline: string;
      overdue: boolean;
    }>;
  };
  findings: {
    totalOpen: number;
    bySeverity: Array<{ severity: string; count: number }>;
    aging: Array<{ bucket: string; count: number }>;
    closedThisYear: number;
  };
  reportsIssuedThisYear: number;
  risks: {
    byBand: Array<{ band: string; count: number }>;
    top: Array<{ title: string; score: number; band: string; status: string }>;
  };
  escalationsLast90Days: number;
}

const CLOSED = 'closed';
const AGING_BUCKETS = ['< 30 days', '30–90 days', '> 90 days'] as const;

const riskBand = (score: number): string => {
  if (score >= 20) return 'critical';
  if (score >= 13) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
};

const agingBucket = (createdAt: Date, now: Date): (typeof AGING_BUCKETS)[number] => {
  const days = (now.getTime() - createdAt.getTime()) / 86_400_000;
  if (days < 30) return AGING_BUCKETS[0];
  if (days <= 90) return AGING_BUCKETS[1];
  return AGING_BUCKETS[2];
};

export class CommitteePackService {
  async getCommitteePack(): Promise<CommitteePackDto> {
    const now = new Date();
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000);

    const [
      statusGroups,
      totalThisYear,
      closedThisYear,
      overdue,
      recentEngagements,
      openFindings,
      severityGroups,
      findingsClosedThisYear,
      reportsIssuedThisYear,
      risks,
      escalationsLast90Days,
    ] = await Promise.all([
      prisma.audit_Engagement.groupBy({
        by: ['status'],
        where: { deleted_at: null },
        _count: { _all: true },
      }),
      prisma.audit_Engagement.count({ where: { deleted_at: null, created_at: { gte: yearStart } } }),
      prisma.audit_Engagement.count({
        where: { deleted_at: null, created_at: { gte: yearStart }, status: CLOSED },
      }),
      prisma.audit_Engagement.count({
        where: { deleted_at: null, status: { not: CLOSED }, sla_deadline: { lt: now } },
      }),
      prisma.audit_Engagement.findMany({
        where: { deleted_at: null },
        orderBy: { created_at: 'desc' },
        take: 15,
        select: {
          reference_number: true,
          title: true,
          status: true,
          audit_type: true,
          sla_deadline: true,
        },
      }),
      prisma.audit_Finding.findMany({
        where: { deleted_at: null, status: { not: CLOSED } },
        select: { created_at: true },
      }),
      prisma.audit_Finding.groupBy({
        by: ['severity'],
        where: { deleted_at: null, status: { not: CLOSED } },
        _count: { _all: true },
      }),
      prisma.audit_Finding.count({
        where: { deleted_at: null, status: CLOSED, updated_at: { gte: yearStart } },
      }),
      prisma.audit_Report.count({
        where: { deleted_at: null, status: 'issued', issued_at: { gte: yearStart } },
      }),
      prisma.risk_Register.findMany({
        where: { deleted_at: null },
        select: { title: true, current_score: true, status: true },
        orderBy: { current_score: 'desc' },
      }),
      prisma.workflow_Escalation.count({ where: { created_at: { gte: ninetyDaysAgo } } }),
    ]);

    const agingCounts = new Map<string, number>(AGING_BUCKETS.map((bucket) => [bucket, 0]));
    for (const finding of openFindings) {
      const bucket = agingBucket(finding.created_at, now);
      agingCounts.set(bucket, (agingCounts.get(bucket) ?? 0) + 1);
    }

    const bandCounts = new Map<string, number>();
    for (const risk of risks) {
      const band = riskBand(risk.current_score);
      bandCounts.set(band, (bandCounts.get(band) ?? 0) + 1);
    }

    return {
      generatedAt: now.toISOString(),
      periodStart: yearStart.toISOString(),
      engagements: {
        totalThisYear,
        byStatus: statusGroups.map((group) => ({ status: group.status, count: group._count._all })),
        overdue,
        completionRate: totalThisYear > 0 ? Math.round((closedThisYear / totalThisYear) * 100) : 0,
        recent: recentEngagements.map((engagement) => ({
          referenceNumber: engagement.reference_number,
          title: engagement.title,
          status: engagement.status,
          auditType: engagement.audit_type,
          slaDeadline: engagement.sla_deadline.toISOString(),
          overdue: engagement.status !== CLOSED && engagement.sla_deadline < now,
        })),
      },
      findings: {
        totalOpen: openFindings.length,
        bySeverity: severityGroups.map((group) => ({ severity: group.severity, count: group._count._all })),
        aging: AGING_BUCKETS.map((bucket) => ({ bucket, count: agingCounts.get(bucket) ?? 0 })),
        closedThisYear: findingsClosedThisYear,
      },
      reportsIssuedThisYear,
      risks: {
        byBand: Array.from(bandCounts.entries()).map(([band, count]) => ({ band, count })),
        top: risks.slice(0, 5).map((risk) => ({
          title: risk.title,
          score: risk.current_score,
          band: riskBand(risk.current_score),
          status: risk.status,
        })),
      },
      escalationsLast90Days,
    };
  }

  async exportCommitteePackPdf(): Promise<Buffer> {
    const pack = await this.getCommitteePack();
    const generated = new Date(pack.generatedAt);

    const kpiTable: Content = {
      table: {
        widths: ['*', '*', '*', '*', '*'],
        body: [
          ['Engagements this year', 'Completion rate', 'Overdue engagements', 'Open findings', 'Reports issued'].map(
            (text) => ({ text, bold: true, fontSize: 9 }),
          ),
          [
            String(pack.engagements.totalThisYear),
            `${pack.engagements.completionRate}%`,
            String(pack.engagements.overdue),
            String(pack.findings.totalOpen),
            String(pack.reportsIssuedThisYear),
          ].map((text) => ({ text, fontSize: 14, bold: true })),
        ],
      },
      layout: borderedTableLayout,
      margin: [0, 0, 0, 16] as [number, number, number, number],
    };

    const engagementRows = pack.engagements.recent.map((engagement) => [
      engagement.referenceNumber,
      engagement.title,
      engagement.auditType,
      engagement.status.replace(/_/g, ' '),
      {
        text: engagement.slaDeadline.slice(0, 10) + (engagement.overdue ? '  (overdue)' : ''),
        color: engagement.overdue ? '#DC2626' : undefined,
      },
    ]);

    const definition: TDocumentDefinitions = {
      pageMargins: [40, 50, 40, 50],
      content: [
        { text: 'Internal Audit — Committee Pack', fontSize: 20, bold: true },
        {
          text: `Generated ${generated.toISOString().slice(0, 10)} · Period from ${pack.periodStart.slice(0, 10)}`,
          fontSize: 10,
          color: '#64748B',
          margin: [0, 4, 0, 20],
        },
        { text: 'Key indicators', fontSize: 14, bold: true, margin: [0, 0, 0, 8] },
        kpiTable,
        { text: 'Engagement status', fontSize: 14, bold: true, margin: [0, 8, 0, 8] },
        {
          table: {
            widths: ['*', 'auto'],
            body: [
              [{ text: 'Status', bold: true }, { text: 'Count', bold: true }],
              ...pack.engagements.byStatus.map((row) => [row.status.replace(/_/g, ' '), String(row.count)]),
            ],
          },
          layout: borderedTableLayout,
          margin: [0, 0, 0, 16] as [number, number, number, number],
        },
        { text: 'Open findings — severity and aging', fontSize: 14, bold: true, margin: [0, 8, 0, 8] },
        {
          columns: [
            {
              table: {
                widths: ['*', 'auto'],
                body: [
                  [{ text: 'Severity', bold: true }, { text: 'Open', bold: true }],
                  ...pack.findings.bySeverity.map((row) => [severityBadge(row.severity), String(row.count)]),
                ],
              },
              layout: borderedTableLayout,
            },
            {
              table: {
                widths: ['*', 'auto'],
                body: [
                  [{ text: 'Age', bold: true }, { text: 'Open', bold: true }],
                  ...pack.findings.aging.map((row) => [row.bucket, String(row.count)]),
                ],
              },
              layout: borderedTableLayout,
            },
          ],
          columnGap: 16,
          margin: [0, 0, 0, 4] as [number, number, number, number],
        },
        {
          text: `${pack.findings.closedThisYear} finding(s) closed this year · ${pack.escalationsLast90Days} escalation(s) in the last 90 days`,
          fontSize: 10,
          color: '#64748B',
          margin: [0, 4, 0, 16],
        },
        { text: 'Top risks', fontSize: 14, bold: true, margin: [0, 8, 0, 8] },
        {
          table: {
            widths: ['*', 'auto', 'auto', 'auto'],
            body: [
              ['Risk', 'Score', 'Band', 'Status'].map((text) => ({ text, bold: true })),
              ...pack.risks.top.map((risk) => [risk.title, String(risk.score), risk.band, risk.status]),
            ],
          },
          layout: borderedTableLayout,
          margin: [0, 0, 0, 16] as [number, number, number, number],
        },
        { text: 'Recent engagements', fontSize: 14, bold: true, margin: [0, 8, 0, 8] },
        {
          table: {
            widths: ['auto', '*', 'auto', 'auto', 'auto'],
            body: [
              ['Reference', 'Title', 'Type', 'Status', 'SLA deadline'].map((text) => ({ text, bold: true })),
              ...engagementRows,
            ],
          },
          layout: borderedTableLayout,
        },
      ],
    };

    return renderPdf(definition);
  }
}

export const committeePackService = new CommitteePackService();
