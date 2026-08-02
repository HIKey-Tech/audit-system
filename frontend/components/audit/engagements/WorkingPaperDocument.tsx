'use client';

import { Markdown } from '@/components/common/Markdown';
import { formatDate } from '@/lib/utils/format';

/** Brand navy — same value the working-paper PDF export uses. */
const BRAND = '#1E3A8A';

export interface WorkingPaperDocumentSection {
  title: string;
  content: string;
}

interface Props {
  title: string;
  sections: WorkingPaperDocumentSection[];
  engagementReference: string;
  engagementTitle: string;
  workingPaperType?: string;
  preparedBy?: string;
  status?: string;
  version?: number;
  reviewerName?: string | null;
  reviewedAt?: string | null;
}

/**
 * On-screen A4 rendering of a working paper — the same document flow the report
 * tab's Preview view uses, and the same header / metadata / sign-off blocks the
 * exported PDF produces (see `working-paper.utility.ts`), so what an auditor
 * previews is what they export.
 */
export const WorkingPaperDocument = ({
  title,
  sections,
  engagementReference,
  engagementTitle,
  workingPaperType,
  preparedBy,
  status = 'draft',
  version = 1,
  reviewerName,
  reviewedAt,
}: Props): JSX.Element => (
  <div className="w-full max-w-[816px] mx-auto bg-white border border-border shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-lg p-8 md:p-10 text-slate-800 space-y-6 font-sans">
    {/* Print header */}
    <div className="text-center pb-5 border-b-2 border-slate-200 space-y-2">
      <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
        Galaxy Backbone Limited
      </div>
      <h1 className="text-xl font-bold tracking-tight uppercase" style={{ color: BRAND }}>
        {title || 'Untitled working paper'}
      </h1>
      <div className="text-[10px] text-text-secondary uppercase tracking-wider">
        Audit Working Paper
      </div>
    </div>

    {/* Metadata block */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-100 rounded-md p-4 text-xs">
      <div className="space-y-2">
        <div className="flex justify-between gap-3 border-b border-slate-200 pb-1.5">
          <span className="font-medium text-slate-500">Engagement Ref:</span>
          <span className="text-text-primary font-semibold">{engagementReference}</span>
        </div>
        <div className="flex justify-between gap-3 border-b border-slate-200 pb-1.5">
          <span className="font-medium text-slate-500">Engagement:</span>
          <span className="text-text-primary font-semibold text-right">{engagementTitle}</span>
        </div>
        <div className="flex justify-between gap-3 border-b border-slate-200 pb-1.5 md:border-none md:pb-0">
          <span className="font-medium text-slate-500">Paper Type:</span>
          <span className="text-text-primary font-semibold capitalize">
            {(workingPaperType ?? 'general').replace(/_/g, ' ')}
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between gap-3 border-b border-slate-200 pb-1.5">
          <span className="font-medium text-slate-500">Prepared By:</span>
          <span className="text-text-primary font-semibold">{preparedBy || '—'}</span>
        </div>
        <div className="flex justify-between gap-3 border-b border-slate-200 pb-1.5">
          <span className="font-medium text-slate-500">Status:</span>
          <span className="text-text-primary font-semibold capitalize">
            {status.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="font-medium text-slate-500">Version:</span>
          <span className="text-text-primary font-semibold">v{version}</span>
        </div>
      </div>
    </div>

    {/* Body sections */}
    {sections.length === 0 ? (
      <p className="text-xs italic text-slate-500">This working paper has no content yet.</p>
    ) : (
      sections.map((section, index) => {
        // A single untitled section is free-text — no heading to invent.
        const heading =
          section.title || (sections.length > 1 ? `Section ${index + 1}` : null);
        return (
          <div key={`${section.title}-${index}`} className="space-y-2">
            {heading && (
              <h2 className="text-sm font-bold text-text-primary border-b border-slate-100 pb-1">
                {sections.length > 1 ? `${index + 1}. ${heading}` : heading}
              </h2>
            )}
            <div className="pl-1 text-slate-700">
              {section.content.trim() ? (
                <Markdown content={section.content} />
              ) : (
                <p className="text-xs italic text-slate-500">Not completed.</p>
              )}
            </div>
          </div>
        );
      })
    )}

    {/* Sign-off blocks */}
    <div className="pt-6 border-t border-slate-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-700">
        <div className="space-y-1 bg-slate-50/50 border border-slate-100 rounded-md p-3">
          <div className="font-bold text-slate-500">Prepared by:</div>
          <div className="font-medium text-slate-900">{preparedBy || '—'}</div>
        </div>
        <div className="space-y-1 bg-slate-50/50 border border-slate-100 rounded-md p-3">
          <div className="font-bold text-slate-500">Reviewed by:</div>
          <div className="font-medium text-slate-900">{reviewerName || '—'}</div>
          {reviewedAt && (
            <div className="text-[10px] text-slate-400">Date: {formatDate(reviewedAt)}</div>
          )}
        </div>
      </div>
    </div>
  </div>
);
