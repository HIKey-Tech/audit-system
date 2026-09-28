'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp, Play } from 'lucide-react';
import { toast } from 'sonner';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { engagementsApi } from '@/lib/api/audit';
import {
  systemAuditApi,
  type AnalysisType,
  type ExtractPreview,
  type LiveSource,
} from '@/lib/api/system-audit';
import { ANALYSIS_META, SOURCE_LABELS } from '@/lib/system-audit';
import { ParametersEditor, type ParametersResult } from './ParametersEditor';

type SourceChoice = 'upload' | LiveSource;

interface IntegrityConfig {
  keyColumns: string[];
  requiredColumns: string[];
  sequenceColumn: string;
  amountColumn: string;
  expectedTotal: string;
  expectedCount: string;
  dateColumn: string;
  periodStart: string;
  periodEnd: string;
}

const EMPTY_INTEGRITY: IntegrityConfig = {
  keyColumns: [],
  requiredColumns: [],
  sequenceColumn: '',
  amountColumn: '',
  expectedTotal: '',
  expectedCount: '',
  dateColumn: '',
  periodStart: '',
  periodEnd: '',
};

const integrityParameters = (c: IntegrityConfig): Record<string, unknown> => ({
  ...(c.keyColumns.length && { keyColumns: c.keyColumns }),
  ...(c.requiredColumns.length && { requiredColumns: c.requiredColumns }),
  ...(c.sequenceColumn && { sequenceColumn: c.sequenceColumn }),
  ...(c.amountColumn && { amountColumn: c.amountColumn }),
  ...(c.expectedTotal !== '' && { expectedTotal: Number(c.expectedTotal.replace(/,/g, '')) }),
  ...(c.expectedCount !== '' && { expectedCount: Number(c.expectedCount) }),
  ...(c.dateColumn && { dateColumn: c.dateColumn }),
  ...(c.periodStart && { periodStart: c.periodStart }),
  ...(c.periodEnd && { periodEnd: c.periodEnd }),
});

const INTEGRITY_KEYS = [
  'keyColumns', 'requiredColumns', 'sequenceColumn', 'amountColumn', 'expectedTotal',
  'expectedCount', 'dateColumn', 'periodStart', 'periodEnd',
];

export const NewAnalysisSlideOver = ({
  open,
  onClose,
  initialType,
  lockType,
  engagementId: fixedEngagementId,
  securityTestId: fixedSecurityTestId,
}: {
  open: boolean;
  onClose: () => void;
  initialType?: AnalysisType;
  /** Keep the analysis type fixed (e.g. the access-review page). */
  lockType?: boolean;
  engagementId?: string;
  securityTestId?: string;
}): JSX.Element => {
  const router = useRouter();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<AnalysisType>(initialType ?? 'access_listing');
  const [source, setSource] = useState<SourceChoice>('upload');
  const [systemName, setSystemName] = useState('');
  const [title, setTitle] = useState('');
  const [engagementId, setEngagementId] = useState(fixedEngagementId ?? '');
  const [securityTestId, setSecurityTestId] = useState(fixedSecurityTestId ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ExtractPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [dateOrder, setDateOrder] = useState<'dmy' | 'mdy'>('dmy');
  const [days, setDays] = useState('30');
  const [params, setParams] = useState<ParametersResult>({ changed: {}, error: null });
  const [integrity, setIntegrity] = useState<IntegrityConfig>(EMPTY_INTEGRITY);

  const types = useQuery({ queryKey: ['system-audit', 'types'], queryFn: () => systemAuditApi.types(), staleTime: 10 * 60_000 });
  const engagements = useQuery({
    queryKey: ['engagements', 'in-progress-picker'],
    queryFn: () => engagementsApi.list({ pageSize: 100, status: 'in_progress' }),
    enabled: open && !fixedEngagementId,
  });
  const securityTests = useQuery({
    queryKey: ['system-audit', 'security-tests', 'picker'],
    queryFn: () => systemAuditApi.listSecurityTests({ pageSize: 100 }),
    enabled: open && type === 'vulnerability_scan' && !fixedSecurityTestId,
  });

  const info = types.data?.find((t) => t.type === type);
  const meta = ANALYSIS_META[type];
  const isIntegrity = type === 'data_integrity';
  const usesWindow = type === 'security_event_log' || type === 'incident_log';

  // Reset per-analysis state whenever the panel opens or the analysis changes.
  const resetFile = (): void => {
    setFile(null);
    setPreview(null);
    setMapping({});
    setIntegrity(EMPTY_INTEGRITY);
    if (fileRef.current) fileRef.current.value = '';
  };
  useEffect(() => {
    if (!open) return;
    setType(initialType ?? 'access_listing');
    setSource('upload');
    setSystemName('');
    setTitle('');
    setEngagementId(fixedEngagementId ?? '');
    setSecurityTestId(fixedSecurityTestId ?? '');
    setDays('30');
    resetFile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    setSource('upload');
    resetFile();
  }, [type]);

  const previewMutation = useMutation({
    mutationFn: (f: File) => systemAuditApi.preview(type, f),
    onSuccess: (p) => {
      setPreview(p);
      setMapping(p.suggestedMapping);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not read the file');
      resetFile();
    },
  });

  const run = useMutation({
    mutationFn: async () => {
      const parameters = { ...params.changed, ...(isIntegrity ? integrityParameters(integrity) : {}) };
      if (source === 'upload') {
        return systemAuditApi.runUpload({
          analysisType: type,
          systemName: systemName.trim(),
          title: title.trim() || undefined,
          engagementId: engagementId || undefined,
          securityTestId: securityTestId || undefined,
          dateOrder,
          mapping: isIntegrity ? undefined : mapping,
          parameters,
          file: file!,
        });
      }
      return systemAuditApi.runLive({
        analysisType: type,
        source,
        title: title.trim() || undefined,
        engagementId: engagementId || undefined,
        days: usesWindow ? Number(days) || 30 : undefined,
        parameters,
      });
    },
    onSuccess: (result) => {
      toast.success(`${result.reference}: ${result.exceptionCount} exception(s) found in ${result.recordCount} record(s)`);
      qc.invalidateQueries({ queryKey: ['system-audit'] });
      onClose();
      router.push(`/system-audit/analytics/${result.id}`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'The analysis failed'),
  });

  const missingRequired = useMemo(
    () => (info && !isIntegrity ? info.fields.filter((f) => f.required && !mapping[f.key]) : []),
    [info, isIntegrity, mapping],
  );

  const submit = (): void => {
    if (params.error) return void toast.error(params.error);
    if (source === 'upload') {
      if (!file || !preview) return void toast.error('Choose the export file to analyse');
      if (!systemName.trim()) return void toast.error('Name the system the export came from');
      if (missingRequired.length) return void toast.error(`Map a column for: ${missingRequired.map((f) => f.label).join(', ')}`);
    }
    run.mutate();
  };

  const sourceChoices: SourceChoice[] = ['upload', ...(info?.liveSources ?? [])];
  const toggle = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={lockType ? meta.label : 'New analysis'}
      description="Analyse system data read-only. Uploaded exports are fingerprinted and kept as evidence."
      width="xl"
      dirty={Boolean(file) || Boolean(systemName)}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" leftIcon={<Play className="h-3.5 w-3.5" />} onClick={submit} isLoading={run.isPending}>
            Run analysis
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {!lockType && (
          <FormField label="Analysis" required description={meta.hint}>
            <Select value={type} onChange={(e) => setType(e.target.value as AnalysisType)}>
              {(types.data ?? []).map((t) => (
                <option key={t.type} value={t.type}>{t.label}</option>
              ))}
            </Select>
          </FormField>
        )}
        {lockType && <p className="text-sm text-text-secondary">{meta.hint}</p>}

        {info && (
          <div className="rounded-md border border-border bg-surface-alt px-3 py-2 text-xs text-text-secondary">
            <p>{info.description}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="font-semibold text-text-primary">Evidence for:</span>
              {info.controls.map((c) => <Badge key={c} tone="gray" size="xs">{c}</Badge>)}
            </p>
          </div>
        )}

        {sourceChoices.length > 1 && (
          <FormField label="Data source" required>
            <div className="flex flex-wrap gap-2">
              {sourceChoices.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSource(s)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    source === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-secondary hover:border-primary'
                  }`}
                >
                  {SOURCE_LABELS[s]}
                </button>
              ))}
            </div>
          </FormField>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {source === 'upload' && (
            <FormField label="System" required hint="Where the export came from, e.g. Dynafin, Active Directory, FW-CORE-01">
              <Input value={systemName} onChange={(e) => setSystemName(e.target.value)} maxLength={200} />
            </FormField>
          )}
          <FormField label="Title" optional hint="Defaults to the analysis and system name">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </FormField>
          {!fixedEngagementId && (
            <FormField
              label="Engagement"
              optional
              hint={source === 'upload' ? 'Links the run and stores the extract as engagement evidence (engagement must be in progress)' : 'Links the run to an engagement'}
            >
              <Select value={engagementId} onChange={(e) => setEngagementId(e.target.value)}>
                <option value="">Organisation-wide (no engagement)</option>
                {engagements.data?.items.map((e) => (
                  <option key={e.id} value={e.id}>{e.referenceNumber} — {e.title}</option>
                ))}
              </Select>
            </FormField>
          )}
          {type === 'vulnerability_scan' && !fixedSecurityTestId && source === 'upload' && (
            <FormField label="Security test" optional hint="Record these results against a planned test">
              <Select value={securityTestId} onChange={(e) => setSecurityTestId(e.target.value)}>
                <option value="">None</option>
                {securityTests.data?.items.map((t) => (
                  <option key={t.id} value={t.id}>{t.reference} — {t.title}</option>
                ))}
              </Select>
            </FormField>
          )}
          {source !== 'upload' && usesWindow && (
            <FormField label="Look-back (days)" required>
              <Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />
            </FormField>
          )}
        </div>

        {source === 'upload' && (
          <FormField label="Export file" required hint="CSV, TSV, or Excel — first row must be the column headers">
            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xls"
                className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setPreview(null);
                  if (f) previewMutation.mutate(f);
                }}
              />
              {previewMutation.isPending && <span className="text-xs text-text-muted">Reading…</span>}
            </div>
          </FormField>
        )}

        {source === 'upload' && preview && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-text-primary">
              <FileUp className="h-4 w-4 text-primary" />
              <span className="font-medium">{preview.fileName}</span>
              <span className="text-text-secondary">— {preview.rowCount.toLocaleString()} rows, {preview.headers.length} columns</span>
            </p>

            {!isIntegrity && info && (
              <div className="rounded-md border border-border">
                <div className="border-b border-border bg-surface-alt px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Column mapping {missingRequired.length > 0 && <span className="ml-2 normal-case text-red-600">— {missingRequired.length} required column(s) not matched</span>}
                </div>
                <div className="divide-y divide-border">
                  {info.fields.map((field) => (
                    <div key={field.key} className="grid grid-cols-2 items-center gap-3 px-3 py-1.5">
                      <span className="text-sm text-text-primary">
                        {field.label}
                        {field.required && <span className="text-red-600"> *</span>}
                      </span>
                      <Select
                        value={mapping[field.key] ?? ''}
                        onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value || null }))}
                        error={field.required && !mapping[field.key] ? 'Required' : undefined}
                      >
                        <option value="">— not in file —</option>
                        {preview.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isIntegrity && (
              <div className="space-y-3 rounded-md border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Integrity checks</p>
                <FormField label="Unique key column(s)" hint="Rows must not repeat these values (duplicate detection)">
                  <div className="flex flex-wrap gap-1.5">
                    {preview.headers.map((h) => (
                      <button key={h} type="button" onClick={() => setIntegrity((c) => ({ ...c, keyColumns: toggle(c.keyColumns, h) }))}
                        className={`rounded border px-2 py-0.5 text-xs ${integrity.keyColumns.includes(h) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-secondary'}`}>
                        {h}
                      </button>
                    ))}
                  </div>
                </FormField>
                <FormField label="Mandatory column(s)" hint="Every row must have a value">
                  <div className="flex flex-wrap gap-1.5">
                    {preview.headers.map((h) => (
                      <button key={h} type="button" onClick={() => setIntegrity((c) => ({ ...c, requiredColumns: toggle(c.requiredColumns, h) }))}
                        className={`rounded border px-2 py-0.5 text-xs ${integrity.requiredColumns.includes(h) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-secondary'}`}>
                        {h}
                      </button>
                    ))}
                  </div>
                </FormField>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {([
                    ['sequenceColumn', 'Document sequence column', 'Numbers should run without gaps'],
                    ['amountColumn', 'Amount column', 'Summed for the control total'],
                    ['dateColumn', 'Date column', 'Checked against the period'],
                  ] as const).map(([key, label, hint]) => (
                    <FormField key={key} label={label} hint={hint}>
                      <Select value={integrity[key]} onChange={(e) => setIntegrity((c) => ({ ...c, [key]: e.target.value }))}>
                        <option value="">Not checked</option>
                        {preview.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                      </Select>
                    </FormField>
                  ))}
                  <FormField label="Control total" hint="Total per the source system or ledger">
                    <Input inputMode="decimal" value={integrity.expectedTotal} onChange={(e) => setIntegrity((c) => ({ ...c, expectedTotal: e.target.value }))} />
                  </FormField>
                  <FormField label="Expected record count">
                    <Input type="number" min={0} value={integrity.expectedCount} onChange={(e) => setIntegrity((c) => ({ ...c, expectedCount: e.target.value }))} />
                  </FormField>
                  <FormField label="Period start">
                    <Input type="date" value={integrity.periodStart} onChange={(e) => setIntegrity((c) => ({ ...c, periodStart: e.target.value }))} />
                  </FormField>
                  <FormField label="Period end">
                    <Input type="date" value={integrity.periodEnd} onChange={(e) => setIntegrity((c) => ({ ...c, periodEnd: e.target.value }))} />
                  </FormField>
                </div>
              </div>
            )}

            {preview.sampleRows.length > 0 && (
              <details className="rounded-md border border-border">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-text-secondary">First {preview.sampleRows.length} rows</summary>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-surface-alt">
                      <tr>{preview.headers.map((h) => <th key={h} className="px-2 py-1 text-left font-semibold text-text-secondary">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.sampleRows.map((row, i) => (
                        <tr key={i} className="border-t border-border">
                          {preview.headers.map((h) => <td key={h} className="whitespace-nowrap px-2 py-1 text-text-primary">{String(row[h] ?? '')}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            <FormField label="Date format in the file" hint="Used for dates written like 03/04/2026">
              <Select value={dateOrder} onChange={(e) => setDateOrder(e.target.value as 'dmy' | 'mdy')}>
                <option value="dmy">Day first (03/04/2026 = 3 April)</option>
                <option value="mdy">Month first (03/04/2026 = 4 March)</option>
              </Select>
            </FormField>
          </div>
        )}

        {info && (
          <details className="rounded-md border border-border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-text-primary">
              Rules & thresholds <span className="text-xs font-normal text-text-muted">(optional — defaults follow good practice)</span>
            </summary>
            <div className="space-y-4 border-t border-border p-3">
              <ul className="space-y-1 text-xs text-text-secondary">
                {info.rules.map((r) => (
                  <li key={r.code}>
                    <span className="font-mono text-[10px] text-text-muted">{r.code}</span> — {r.label}
                    {r.severity !== 'varies' && <span className="text-text-muted"> ({r.severity})</span>}
                  </li>
                ))}
              </ul>
              <ParametersEditor
                defaults={info.defaultParameters}
                onChange={setParams}
                exclude={isIntegrity ? INTEGRITY_KEYS : []}
              />
            </div>
          </details>
        )}
      </div>
    </SlideOver>
  );
};
