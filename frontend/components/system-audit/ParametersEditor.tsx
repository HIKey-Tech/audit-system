'use client';

import { useEffect, useState } from 'react';
import { FormField } from '@/components/ui/FormField';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { summaryLabel } from './shared';

type Kind = 'number' | 'boolean' | 'lines' | 'json' | 'severity' | 'text';

const SEVERITY_KEYS = new Set(['minimumSeverity', 'notifyOnSeverity']);

const kindOf = (key: string, value: unknown): Kind => {
  if (SEVERITY_KEYS.has(key)) return 'severity';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) return 'lines';
  if (typeof value === 'string') return 'text';
  return 'json';
};

const toText = (kind: Kind, value: unknown): string => {
  if (kind === 'lines') return (value as string[]).join('\n');
  if (kind === 'json') return value === null ? '' : JSON.stringify(value, null, 2);
  if (kind === 'boolean') return value ? 'true' : 'false';
  return value === null || value === undefined ? '' : String(value);
};

const fromText = (kind: Kind, text: string): unknown => {
  switch (kind) {
    case 'number':
      return text.trim() === '' ? undefined : Number(text);
    case 'boolean':
      return text === 'true';
    case 'lines':
      return text.split('\n').map((l) => l.trim()).filter(Boolean);
    case 'json':
      return text.trim() === '' ? null : JSON.parse(text);
    default:
      return text;
  }
};

export interface ParametersResult {
  /** Only the parameters that differ from the defaults. */
  changed: Record<string, unknown>;
  error: string | null;
}

/**
 * Edits an analysis's parameters, rendering a sensible control per default
 * value. Reports only changed values so server-side, source-specific defaults
 * are preserved for everything the auditor leaves alone.
 */
export const ParametersEditor = ({
  defaults,
  onChange,
  exclude = [],
}: {
  defaults: Record<string, unknown>;
  onChange: (result: ParametersResult) => void;
  exclude?: string[];
}): JSX.Element => {
  const keys = Object.keys(defaults).filter((k) => !exclude.includes(k));
  const [texts, setTexts] = useState<Record<string, string>>({});

  useEffect(() => {
    setTexts(Object.fromEntries(keys.map((k) => [k, toText(kindOf(k, defaults[k]), defaults[k])])));
    // Reset only when the analysis (its defaults) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(defaults)]);

  useEffect(() => {
    const changed: Record<string, unknown> = {};
    let error: string | null = null;
    for (const key of keys) {
      const kind = kindOf(key, defaults[key]);
      const text = texts[key];
      if (text === undefined || text === toText(kind, defaults[key])) continue;
      try {
        const value = fromText(kind, text);
        if (kind === 'number' && (value === undefined || Number.isNaN(value))) {
          error = `${summaryLabel(key)} must be a number`;
          continue;
        }
        changed[key] = value;
      } catch {
        error = `${summaryLabel(key)} is not valid JSON`;
      }
    }
    onChange({ changed, error });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texts]);

  const set = (key: string, text: string): void => setTexts((prev) => ({ ...prev, [key]: text }));

  return (
    <div className="space-y-3">
      {keys.map((key) => {
        const kind = kindOf(key, defaults[key]);
        const value = texts[key] ?? '';
        const label = summaryLabel(key);
        if (kind === 'boolean') {
          return (
            <label key={key} className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                checked={value === 'true'}
                onChange={(e) => set(key, e.target.checked ? 'true' : 'false')}
              />
              {label}
            </label>
          );
        }
        if (kind === 'severity') {
          return (
            <FormField key={key} label={label}>
              <Select value={value} onChange={(e) => set(key, e.target.value)}>
                {['critical', 'high', 'medium', 'low'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </FormField>
          );
        }
        if (kind === 'number' || kind === 'text') {
          return (
            <FormField key={key} label={label}>
              <Input type={kind === 'number' ? 'number' : 'text'} value={value} onChange={(e) => set(key, e.target.value)} />
            </FormField>
          );
        }
        return (
          <FormField
            key={key}
            label={label}
            hint={kind === 'lines' ? 'One per line. * matches any text.' : 'JSON — leave as is to keep the default.'}
          >
            <Textarea
              rows={kind === 'json' ? 6 : 4}
              className="font-mono text-xs"
              value={value}
              onChange={(e) => set(key, e.target.value)}
            />
          </FormField>
        );
      })}
    </div>
  );
};
