'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { UserSelect } from '@/components/common/UserSelect';
import { universeApi } from '@/lib/api/audit';
import { assetsApi } from '@/lib/api/assets';
import { systemAuditApi, type SystemDocument, type SystemDocumentType } from '@/lib/api/system-audit';
import { DOC_TYPE_LABELS } from '@/lib/system-audit';

export type DocumentPanelMode = 'create' | 'edit' | 'version';

const day = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10) : '');
const CONTRACT_TYPES: SystemDocumentType[] = ['contract', 'sla'];

const EMPTY = {
  title: '',
  docType: 'policy' as SystemDocumentType,
  description: '',
  versionLabel: '',
  ownerId: '',
  universeId: '',
  assetId: '',
  vendor: '',
  effectiveDate: '',
  reviewDueDate: '',
  expiryDate: '',
  status: 'active' as 'active' | 'archived',
  changeNote: '',
};

/** Add a library document, edit its metadata, or upload a new version. */
export const SystemDocumentSlideOver = ({
  open,
  onClose,
  mode,
  document,
  initialType,
}: {
  open: boolean;
  onClose: () => void;
  mode: DocumentPanelMode;
  document?: SystemDocument;
  initialType?: SystemDocumentType;
}): JSX.Element => {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
    setForm(
      document
        ? {
            title: document.title,
            docType: document.docType,
            description: document.description ?? '',
            versionLabel: mode === 'version' ? '' : document.versionLabel ?? '',
            ownerId: document.owner?.id ?? '',
            universeId: document.universe?.id ?? '',
            assetId: document.asset?.id ?? '',
            vendor: document.vendor ?? '',
            effectiveDate: day(document.effectiveDate),
            reviewDueDate: mode === 'version' ? '' : day(document.reviewDueDate),
            expiryDate: day(document.expiryDate),
            status: document.status,
            changeNote: '',
          }
        : { ...EMPTY, docType: initialType ?? 'policy' },
    );
  }, [open, document, mode, initialType]);

  const universe = useQuery({ queryKey: ['universe', 'doc-picker'], queryFn: () => universeApi.list({ pageSize: 100 }), enabled: open && mode !== 'version' });
  const assets = useQuery({ queryKey: ['assets', 'doc-picker'], queryFn: () => assetsApi.list({ pageSize: 100 }), enabled: open && mode !== 'version' });

  const save = useMutation({
    mutationFn: async () => {
      if (mode === 'version') {
        return systemAuditApi.uploadDocumentVersion(document!.id, file!, {
          versionLabel: form.versionLabel || undefined,
          changeNote: form.changeNote || undefined,
          reviewDueDate: form.reviewDueDate || undefined,
        });
      }
      if (mode === 'edit') {
        return systemAuditApi.updateDocument(document!.id, {
          title: form.title.trim(),
          docType: form.docType,
          description: form.description.trim() || null,
          versionLabel: form.versionLabel.trim() || null,
          ownerId: form.ownerId || undefined,
          universeId: form.universeId || null,
          assetId: form.assetId || null,
          vendor: form.vendor.trim() || null,
          effectiveDate: form.effectiveDate || null,
          reviewDueDate: form.reviewDueDate || null,
          expiryDate: form.expiryDate || null,
          status: form.status,
        });
      }
      return systemAuditApi.createDocument(
        {
          title: form.title.trim(),
          docType: form.docType,
          description: form.description.trim() || undefined,
          versionLabel: form.versionLabel.trim() || undefined,
          ownerId: form.ownerId || undefined,
          universeId: form.universeId || undefined,
          assetId: form.assetId || undefined,
          vendor: form.vendor.trim() || undefined,
          effectiveDate: form.effectiveDate || undefined,
          reviewDueDate: form.reviewDueDate || undefined,
          expiryDate: form.expiryDate || undefined,
        },
        file!,
      );
    },
    onSuccess: () => {
      toast.success(mode === 'version' ? 'New version uploaded' : mode === 'edit' ? 'Document updated' : 'Document added to the library');
      qc.invalidateQueries({ queryKey: ['system-audit'] });
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not save the document'),
  });

  const submit = (): void => {
    if (mode !== 'edit' && !file) return void toast.error('Choose the file');
    if (mode !== 'version' && !form.title.trim()) return void toast.error('Give the document a title');
    save.mutate();
  };

  const set = (key: keyof typeof EMPTY, value: string): void => setForm((f) => ({ ...f, [key]: value }));
  const isContract = CONTRACT_TYPES.includes(form.docType);

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={mode === 'version' ? `New version — ${document?.title}` : mode === 'edit' ? 'Edit document' : 'Add to documentation library'}
      description={mode === 'version' ? 'The previous file stays in the version history.' : 'Link documents to the audit universe or an asset so auditors see what is relevant to their scope.'}
      width="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} isLoading={save.isPending}>{mode === 'version' ? 'Upload version' : mode === 'edit' ? 'Save' : 'Add document'}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {mode !== 'edit' && (
          <FormField label="File" required>
            <input
              ref={fileRef}
              type="file"
              className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </FormField>
        )}
        {mode === 'version' ? (
          <>
            <FormField label="Version label" optional><Input value={form.versionLabel} maxLength={50} onChange={(e) => set('versionLabel', e.target.value)} placeholder="e.g. v3.1" /></FormField>
            <FormField label="What changed" optional><Textarea rows={2} value={form.changeNote} maxLength={500} onChange={(e) => set('changeNote', e.target.value)} /></FormField>
            <FormField label="Next review due" optional><Input type="date" value={form.reviewDueDate} onChange={(e) => set('reviewDueDate', e.target.value)} /></FormField>
          </>
        ) : (
          <>
            <FormField label="Title" required><Input value={form.title} maxLength={200} onChange={(e) => set('title', e.target.value)} /></FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Type" required>
                <Select value={form.docType} onChange={(e) => set('docType', e.target.value)}>
                  {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </FormField>
              <FormField label="Version" optional><Input value={form.versionLabel} maxLength={50} onChange={(e) => set('versionLabel', e.target.value)} placeholder="e.g. v3.0" /></FormField>
              <FormField label="Owner" optional hint="Defaults to you"><UserSelect value={form.ownerId} onChange={(v) => set('ownerId', v)} placeholder="Me" /></FormField>
              {isContract && <FormField label="Vendor / supplier" optional><Input value={form.vendor} maxLength={200} onChange={(e) => set('vendor', e.target.value)} /></FormField>}
              <FormField label="Audit universe entity" optional>
                <Select value={form.universeId} onChange={(e) => set('universeId', e.target.value)}>
                  <option value="">None</option>
                  {universe.data?.items.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
              </FormField>
              <FormField label="Asset" optional>
                <Select value={form.assetId} onChange={(e) => set('assetId', e.target.value)}>
                  <option value="">None</option>
                  {assets.data?.items.map((a) => <option key={a.id} value={a.id}>{a.assetTag} — {a.name}</option>)}
                </Select>
              </FormField>
              <FormField label="Effective from" optional><Input type="date" value={form.effectiveDate} onChange={(e) => set('effectiveDate', e.target.value)} /></FormField>
              <FormField label="Next review due" optional hint="Flagged when overdue"><Input type="date" value={form.reviewDueDate} onChange={(e) => set('reviewDueDate', e.target.value)} /></FormField>
              {isContract && <FormField label="Expires" optional hint="Flagged 60 days ahead"><Input type="date" value={form.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} /></FormField>}
              {mode === 'edit' && (
                <FormField label="Status">
                  <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
                    <option value="active">Active</option>
                    <option value="archived">Archived (superseded)</option>
                  </Select>
                </FormField>
              )}
            </div>
            <FormField label="Description" optional><Textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} /></FormField>
          </>
        )}
      </div>
    </SlideOver>
  );
};
