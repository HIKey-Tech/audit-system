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

/**
 * Standalone audit sampling workspace: pick an engagement, draw a reproducible
 * sample. The same `SamplingPanel` is embedded on the engagement Working Papers
 * tab, where it can also prefill a working paper from the methodology.
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
        subtitle="Draw a defensible, reproducible sample from a population file. The population and sample are stored as evidence on the chosen engagement."
      />

      <Card padded className="mb-4">
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
            title="Pick an engagement to begin"
            description="Choose the engagement the sample belongs to, then upload the population CSV and draw your sample."
          />
        </Card>
      )}
    </div>
  );
}
