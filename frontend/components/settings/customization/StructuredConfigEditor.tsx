'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

export type JsonValue = boolean | number | string | null | JsonValue[] | { [key: string]: JsonValue };

/** camelCase / snake_case / kebab-case → "Title Case". */
export const humanizeKey = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

const blankLike = (sample: JsonValue): JsonValue => {
  if (typeof sample === 'boolean') return false;
  if (typeof sample === 'number') return 0;
  if (Array.isArray(sample)) return [];
  if (sample && typeof sample === 'object') {
    return Object.fromEntries(Object.entries(sample).map(([k, v]) => [k, blankLike(v)]));
  }
  return '';
};

const inputClass =
  'w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }): JSX.Element => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
      checked ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-4' : 'translate-x-0.5'
      }`}
    />
  </button>
);

const ArrayEditor = ({
  value,
  onChange,
}: {
  value: JsonValue[];
  onChange: (v: JsonValue[]) => void;
}): JSX.Element => {
  const replace = (index: number, next: JsonValue) =>
    onChange(value.map((item, i) => (i === index ? next : item)));
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const add = () => onChange([...value, value.length ? blankLike(value[0]) : '']);

  return (
    <div className="space-y-2">
      {value.length === 0 && <p className="text-xs text-text-muted">None yet.</p>}
      {value.map((item, index) => {
        const isScalar = item === null || typeof item !== 'object';
        return (
          <div key={index} className="flex items-start gap-1.5">
            <div className="flex flex-col pt-0.5">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="text-text-muted transition hover:text-text-primary disabled:opacity-30"
                aria-label="Move up"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={index === value.length - 1}
                onClick={() => move(index, 1)}
                className="text-text-muted transition hover:text-text-primary disabled:opacity-30"
                aria-label="Move down"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className={`flex-1 ${isScalar ? '' : 'rounded-md border border-border bg-surface-alt p-2'}`}>
              <ConfigValueEditor value={item} onChange={(next) => replace(index, next)} />
            </div>
            <button
              type="button"
              onClick={() => remove(index)}
              className="rounded-md p-1.5 text-text-muted transition hover:bg-red-50 hover:text-red-600"
              aria-label="Remove item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2.5 py-1 text-xs font-medium text-text-secondary transition hover:border-primary hover:text-primary"
      >
        <Plus className="h-3.5 w-3.5" /> Add
      </button>
    </div>
  );
};

export const ConfigValueEditor = ({
  value,
  onChange,
}: {
  value: JsonValue;
  onChange: (v: JsonValue) => void;
}): JSX.Element => {
  if (typeof value === 'boolean') {
    return <Toggle checked={value} onChange={onChange} />;
  }
  if (typeof value === 'number') {
    return (
      <input
        type="number"
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      />
    );
  }
  if (value === null || typeof value === 'string') {
    return (
      <input
        type="text"
        className={inputClass}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (Array.isArray(value)) {
    return <ArrayEditor value={value} onChange={onChange} />;
  }

  return <ObjectEditor value={value} onChange={onChange} />;
};

const FIELD_TYPES: { key: string; label: string; make: () => JsonValue }[] = [
  { key: 'text', label: 'Text', make: () => '' },
  { key: 'number', label: 'Number', make: () => 0 },
  { key: 'toggle', label: 'Toggle', make: () => false },
  { key: 'list', label: 'List', make: () => [] },
  { key: 'group', label: 'Group', make: () => ({}) },
];

const ObjectEditor = ({
  value,
  onChange,
}: {
  value: { [key: string]: JsonValue };
  onChange: (v: JsonValue) => void;
}): JSX.Element => {
  const [newKey, setNewKey] = useState('');
  const [newType, setNewType] = useState('text');

  const trimmedKey = newKey.trim();
  const duplicate = trimmedKey.length > 0 && trimmedKey in value;

  const addField = () => {
    if (!trimmedKey || duplicate) return;
    const make = FIELD_TYPES.find((t) => t.key === newType)?.make ?? (() => '');
    onChange({ ...value, [trimmedKey]: make() });
    setNewKey('');
    setNewType('text');
  };

  const removeField = (key: string) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {Object.entries(value).map(([key, fieldValue]) => {
        const isBool = typeof fieldValue === 'boolean';
        return (
          <div key={key} className={isBool ? 'flex items-center justify-between gap-3' : 'space-y-1'}>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">{humanizeKey(key)}</label>
              <button
                type="button"
                onClick={() => removeField(key)}
                className="text-text-muted/60 transition hover:text-red-600"
                aria-label={`Remove ${humanizeKey(key)}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <ConfigValueEditor value={fieldValue} onChange={(next) => onChange({ ...value, [key]: next })} />
          </div>
        );
      })}

      {/* Add a new field */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addField()}
          placeholder="New field name"
          className="flex-1 min-w-[8rem] rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-primary outline-none focus:border-primary"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={addField}
          disabled={!trimmedKey || duplicate}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs font-medium text-text-secondary transition hover:border-primary hover:text-primary disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> Add field
        </button>
        {duplicate && <span className="text-[11px] text-red-600">Field already exists</span>}
      </div>
    </div>
  );
};
