'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Calculator } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Select } from '@/components/ui/Input';
import { samplingApi, type SampleSizeResult } from '@/lib/api/audit';

/**
 * Attribute-sampling size calculator: "how many items must I test to be X% confident
 * the true deviation rate is within the level I'll tolerate?" Pure planning math — no
 * engagement or file needed. Calls the existing POST /audit/sampling/sample-size.
 */
export const SampleSizeCalculator = (): JSX.Element => {
  const [populationSize, setPopulationSize] = useState('1000');
  const [confidenceLevel, setConfidenceLevel] = useState('0.95');
  const [tolerableRate, setTolerableRate] = useState('0.05');
  const [expectedRate, setExpectedRate] = useState('');
  const [result, setResult] = useState<SampleSizeResult | null>(null);

  const calc = useMutation({
    mutationFn: () =>
      samplingApi.sampleSize({
        populationSize: parseInt(populationSize, 10),
        confidenceLevel: parseFloat(confidenceLevel),
        tolerableRate: parseFloat(tolerableRate),
        expectedRate: expectedRate.trim() ? parseFloat(expectedRate) : undefined,
      }),
    onSuccess: (r) => setResult(r),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not calculate sample size'),
  });

  const canCalc =
    parseInt(populationSize, 10) > 0 &&
    parseFloat(confidenceLevel) > 0 &&
    parseFloat(confidenceLevel) < 1 &&
    parseFloat(tolerableRate) > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FormField label="Population size" hint="Total items in scope.">
          <Input
            type="number"
            min={1}
            value={populationSize}
            onChange={(e) => setPopulationSize(e.target.value)}
          />
        </FormField>
        <FormField label="Confidence" hint="How sure you want to be.">
          <Select value={confidenceLevel} onChange={(e) => setConfidenceLevel(e.target.value)}>
            <option value="0.90">90%</option>
            <option value="0.95">95%</option>
            <option value="0.99">99%</option>
          </Select>
        </FormField>
        <FormField label="Tolerable rate" hint="Max error rate you'll accept — 0.05 = 5%.">
          <Input
            type="number"
            step="0.01"
            min={0.001}
            max={1}
            value={tolerableRate}
            onChange={(e) => setTolerableRate(e.target.value)}
          />
        </FormField>
        <FormField label="Expected rate" hint="Errors you actually expect — optional, 0 if blank.">
          <Input
            type="number"
            step="0.01"
            min={0}
            placeholder="0"
            value={expectedRate}
            onChange={(e) => setExpectedRate(e.target.value)}
          />
        </FormField>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button
          size="sm"
          leftIcon={<Calculator className="h-3.5 w-3.5" />}
          disabled={!canCalc}
          isLoading={calc.isPending}
          onClick={() => calc.mutate()}
        >
          Calculate sample size
        </Button>
        {result && (
          <p className="text-right">
            <span className="text-3xl font-semibold tabular-nums text-primary">{result.sampleSize}</span>
            <span className="ml-1.5 text-xs text-text-secondary">items to test</span>
          </p>
        )}
      </div>

      {result && (
        <p className="rounded-md border border-border bg-surface-alt px-3 py-2 text-xs text-text-secondary">
          {result.methodDescription}
        </p>
      )}
    </div>
  );
};
