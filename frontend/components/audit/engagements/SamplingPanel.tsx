'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { FlaskConical, FileSpreadsheet, CheckCircle2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Select } from '@/components/ui/Input';
import { samplingApi, type SamplingRunResult } from '@/lib/api/audit';

/** Read the header row of a CSV file for the value-column dropdown. */
const readCsvHeaders = async (file: File): Promise<string[]> => {
  const head = await file.slice(0, 64 * 1024).text();
  const firstLine = head.split(/\r?\n/, 1)[0] ?? '';
  return firstLine
    .split(',')
    .map((h) => h.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
};

/**
 * Audit sampling: upload a population CSV, draw a reproducible sample (recorded
 * seed), store both files as engagement evidence, and return the methodology
 * write-up. Shared by the Working Papers slide-over (which prefills a working
 * paper from the result) and the standalone Sampling page (which links back to
 * the engagement instead).
 */
export const SamplingPanel = ({
  engagementId,
  onCreateWorkingPaper,
  onClose,
  engagementHref,
  onDirtyChange,
}: {
  engagementId: string;
  /** When provided, offers "Create working paper from this" (prefills the methodology). */
  onCreateWorkingPaper?: (title: string, content: string) => void;
  /** When provided, renders Cancel/Done buttons that call this (e.g. close a slide-over). */
  onClose?: () => void;
  /** When provided, offers a link to the engagement after a sample is drawn. */
  engagementHref?: string;
  /** Reports whether the panel holds work that closing would discard. */
  onDirtyChange?: (dirty: boolean) => void;
}): JSX.Element => {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [method, setMethod] = useState<'random' | 'interval' | 'high_value'>('random');
  const [sampleSize, setSampleSize] = useState('25');
  const [seed, setSeed] = useState('');
  const [valueColumn, setValueColumn] = useState('');
  const [threshold, setThreshold] = useState('');
  const [result, setResult] = useState<SamplingRunResult | null>(null);

  // A chosen population file or a drawn sample is work a stray click shouldn't bin.
  const isDirty = Boolean(file) || Boolean(result);
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  // Clear the flag on unmount so a reopened panel never starts out "dirty".
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const reset = (): void => {
    setFile(null);
    setHeaders([]);
    setMethod('random');
    setSampleSize('25');
    setSeed('');
    setValueColumn('');
    setThreshold('');
    setResult(null);
  };

  const run = useMutation({
    mutationFn: () =>
      samplingApi.run(engagementId, file!, {
        method,
        sampleSize: parseInt(sampleSize, 10),
        seed: seed.trim() ? parseInt(seed, 10) : undefined,
        valueColumn: method === 'high_value' ? valueColumn : undefined,
        threshold: method === 'high_value' && threshold.trim() ? parseFloat(threshold) : undefined,
      }),
    onSuccess: (r) => {
      setResult(r);
      toast.success(`Sample drawn — ${r.sampleCount} of ${r.populationCount} items (seed ${r.seed})`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Sampling failed'),
  });

  const canRun =
    Boolean(file) &&
    parseInt(sampleSize, 10) > 0 &&
    (method !== 'high_value' || Boolean(valueColumn));

  return (
    <div className="space-y-4">
      {result ? (
        <>
          <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">
                {result.sampleCount} of {result.populationCount} items selected — seed {result.seed}
              </p>
              <p className="mt-0.5 text-xs">
                Population and sample files are attached to this engagement&apos;s Evidence tab. Re-running
                the same method with seed {result.seed} reproduces this exact selection.
              </p>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
              Sample preview {result.previewRows.length < result.sampleCount && `(first ${result.previewRows.length})`}
            </p>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {result.previewColumns.map((c) => (
                      <th key={c} className="border-b border-border bg-surface-alt px-2 py-1.5 text-left font-semibold">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.previewRows.map((row, i) => (
                    <tr key={i} className="odd:bg-surface even:bg-surface-alt/40">
                      {result.previewColumns.map((c) => (
                        <td key={c} className="px-2 py-1.5">
                          {String(row[c] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <FormField
            label="Population file (CSV)"
            required
            hint="Export the population from the source system as CSV — e.g. a GL dump or transaction listing."
          >
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border p-3 text-sm text-text-secondary hover:bg-surface-alt">
              <FileSpreadsheet className="h-4 w-4" />
              {file ? <span className="text-text-primary">{file.name}</span> : 'Choose a .csv file…'}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setValueColumn('');
                  setHeaders(f ? await readCsvHeaders(f).catch(() => []) : []);
                  e.target.value = '';
                }}
              />
            </label>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Method" required>
              <Select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                <option value="random">Simple random</option>
                <option value="interval">Systematic interval</option>
                <option value="high_value">High value</option>
              </Select>
            </FormField>
            <FormField label="Sample size" required>
              <Input
                type="number"
                min={1}
                value={sampleSize}
                onChange={(e) => setSampleSize(e.target.value)}
              />
            </FormField>
          </div>

          {method === 'high_value' && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Value column" required hint="The monetary/numeric column to rank by.">
                <Select value={valueColumn} onChange={(e) => setValueColumn(e.target.value)}>
                  <option value="">Select column…</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Threshold" hint="Optional — select all items at or above this value.">
                <Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
              </FormField>
            </div>
          )}

          <FormField
            label="Seed"
            hint="Optional — leave blank for a fresh random seed. The seed used is always recorded, so any sample can be reproduced."
          >
            <Input type="number" min={0} value={seed} onChange={(e) => setSeed(e.target.value)} />
          </FormField>
        </>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        {result ? (
          <>
            <Button variant="secondary" size="sm" onClick={reset}>
              New sample
            </Button>
            {engagementHref && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<ExternalLink className="h-3.5 w-3.5" />}
                onClick={() => router.push(engagementHref)}
              >
                Open engagement
              </Button>
            )}
            {onClose && (
              <Button variant="secondary" size="sm" onClick={onClose}>
                Done
              </Button>
            )}
            {onCreateWorkingPaper && (
              <Button
                size="sm"
                onClick={() =>
                  onCreateWorkingPaper(
                    `Sampling — ${file?.name ?? 'population'}`,
                    result.methodologyMarkdown,
                  )
                }
              >
                Create working paper from this
              </Button>
            )}
          </>
        ) : (
          <>
            {onClose && (
              <Button variant="secondary" size="sm" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              leftIcon={<FlaskConical className="h-3.5 w-3.5" />}
              disabled={!canRun}
              isLoading={run.isPending}
              onClick={() => run.mutate()}
            >
              Draw sample
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
