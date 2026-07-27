'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { engagementsApi } from '@/lib/api/audit';
import { usePermission } from '@/hooks/usePermission';
import { humanizeStatus } from '@/lib/utils/status';
import { SamplingPanel } from '@/components/audit/engagements/SamplingPanel';
import { SampleSizeCalculator } from '@/components/audit/engagements/SampleSizeCalculator';

/**
 * Standalone audit sampling workspace: size a test, then draw a reproducible
 * sample. The draw panel is the same `SamplingPanel` embedded on the engagement
 * Working Papers tab (where it can also prefill a working paper).
 */
export default function SamplingPage(): JSX.Element | null {
  const router = useRouter();
  const canSample = usePermission('evidence:upload');
  const [engagementId, setEngagementId] = useState('');

  useEffect(() => {
    if (!canSample) router.replace('/dashboard');
  }, [canSample, router]);

  const engagements = useQuery({
    queryKey: ['engagements', 'sampling-picker'],
    queryFn: () => engagementsApi.list({ page: 1, pageSize: 100 }),
    enabled: canSample,
  });

  const options = engagements.data?.items ?? [];
  const selected = useMemo(
    () => options.find((e) => e.id === engagementId) ?? null,
    [options, engagementId],
  );

  if (!canSample) return null;

  return (
    <div>
      <PageHeader
        title="Audit Sampling"
        subtitle="Test a defensible subset of a large population instead of checking every item — and prove exactly how you chose it."
      />

      {/* What / why */}
      <Card padded className="mb-4">
        <h2 className="text-sm font-semibold text-text-primary">What is audit sampling?</h2>
        <p className="mt-1.5 text-sm text-text-secondary">
          Checking every record in a large population — every payment, invoice, or access log — is usually
          impractical. Sampling lets you examine a smaller, statistically defensible subset and draw a supported
          conclusion about the whole population, rather than eyeballing a handful of records and hoping they are
          representative. The point is <span className="font-medium text-text-primary">efficiency with
          defensibility</span>: you test far fewer items, but a reviewer or regulator can see the method, the size
          rationale, and the exact selection behind your conclusion.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-text-secondary">
          <li>
            <span className="font-semibold text-text-primary">1. Size it</span> — work out how many items you must
            test to be, say, 95% confident the true error rate is within a level you would tolerate.
          </li>
          <li>
            <span className="font-semibold text-text-primary">2. Draw it</span> — select exactly that many items
            (at random, by interval, or by value) in a way anyone can reproduce, with the population and the chosen
            sample saved as engagement evidence.
          </li>
        </ul>
      </Card>

      {/* Step 1 — sample size */}
      <Card padded className="mb-4">
        <CardHeader
          title="Step 1 — How many items should you test?"
          subtitle="Attribute-sampling size for a target confidence and tolerable error rate. Pure planning — no file needed."
        />
        <SampleSizeCalculator />
      </Card>

      {/* Step 2 — pick an engagement */}
      <Card padded className="mb-4">
        <CardHeader
          title="Step 2 — Draw the sample"
          subtitle="Choose the engagement the sample belongs to; the population and sample are stored there as evidence."
        />
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
          Engagement
        </label>
        {engagements.isLoading ? (
          <p className="text-xs text-text-muted">Loading engagements…</p>
        ) : options.length === 0 ? (
          <p className="text-xs text-text-muted">No engagements are available to you yet.</p>
        ) : (
          <Select value={engagementId} onChange={(e) => setEngagementId(e.target.value)}>
            <option value="">Select an engagement…</option>
            {options.map((e) => (
              <option key={e.id} value={e.id}>
                {e.referenceNumber} — {e.title} ({humanizeStatus(e.status)})
              </option>
            ))}
          </Select>
        )}
        {selected && (
          <p className="mt-2 text-xs text-text-secondary">
            Auditable entity: <span className="font-medium text-text-primary">{selected.universeName ?? '—'}</span> ·
            Type: <span className="font-medium text-text-primary">{humanizeStatus(selected.auditType)}</span>
          </p>
        )}
      </Card>

      {selected ? (
        <Card padded>
          <CardHeader title="Draw a sample" subtitle={`${selected.referenceNumber} — ${selected.title}`} />
          <SamplingPanel
            key={selected.id}
            engagementId={selected.id}
            engagementHref={`/audit/engagements/${selected.id}?tab=working-papers`}
          />
        </Card>
      ) : (
        <Card padded>
          <EmptyState
            icon={<FlaskConical className="h-4 w-4" />}
            title="Pick an engagement to draw a sample"
            description="Once you select an engagement above, upload the population CSV and draw your sample here."
          />
        </Card>
      )}
    </div>
  );
}
