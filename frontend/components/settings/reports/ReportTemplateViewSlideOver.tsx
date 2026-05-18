'use client';

import { CheckCircle2, XCircle, Tag } from 'lucide-react';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { ReportTemplateDto } from '@/lib/types/domain';

interface Props {
  open: boolean;
  onClose: () => void;
  template: ReportTemplateDto;
}

export const ReportTemplateViewSlideOver = ({ open, onClose, template }: Props): JSX.Element => (
  <SlideOver
    open={open}
    onClose={onClose}
    title={template.name}
    description={template.description ?? 'Report template details'}
    width="xl"
    footer={
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    }
  >
    <div className="space-y-6">
      {/* Sections */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Sections ({template.sections.length})
        </h3>
        <div className="space-y-2">
          {template.sections.map((s, idx) => (
            <div
              key={s.key}
              className="rounded-lg border border-border bg-surface-alt p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-text-muted">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="font-medium text-text-primary">{s.title}</span>
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-text-secondary">
                      {s.key}
                    </code>
                  </div>
                  {s.description && (
                    <p className="mt-1 text-xs text-text-secondary">{s.description}</p>
                  )}
                </div>
                <div className="shrink-0">
                  {s.includeFindings ? (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Includes findings
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-text-muted">
                      <XCircle className="h-3.5 w-3.5" />
                      No findings
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Available variables */}
      {template.availableVariables.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Available Variables ({template.availableVariables.length})
          </h3>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface-alt">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                    Variable
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                    Description
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                    Example
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {template.availableVariables.map((v) => (
                  <tr key={v.key}>
                    <td className="px-4 py-3">
                      <code className="flex items-center gap-1.5 rounded bg-violet-50 px-2 py-0.5 text-xs font-mono text-violet-700">
                        <Tag className="h-3 w-3" />
                        {`{{${v.key}}}`}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{v.description}</td>
                    <td className="px-4 py-3 text-sm text-text-muted italic">{v.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Meta */}
      <section className="rounded-lg border border-border bg-surface-alt p-4">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-text-secondary">Status</p>
            <Badge tone={template.isActive ? 'green' : 'gray'} className="mt-1">
              {template.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <div>
            <p className="text-text-secondary">Default</p>
            <Badge tone={template.isDefault ? 'green' : 'gray'} className="mt-1">
              {template.isDefault ? 'Yes' : 'No'}
            </Badge>
          </div>
        </div>
      </section>
    </div>
  </SlideOver>
);
