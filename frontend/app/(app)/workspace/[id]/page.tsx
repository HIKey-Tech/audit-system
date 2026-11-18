'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { workspaceApi } from '@/lib/api/workspace';

// The editor is large and only this page needs it, so it is loaded on demand and never runs on the server.
const DocumentEditor = dynamic(() => import('@/components/workspace/DocumentEditor').then((m) => m.DocumentEditor), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-text-muted">Loading editor…</p>,
});

export default function WorkspaceDocumentPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  // Fetched once: the editor owns the content from then on, so a background refetch must never overwrite typing.
  const doc = useQuery({ queryKey: ['workspace', 'document', id], queryFn: () => workspaceApi.get(id), enabled: Boolean(id), staleTime: Infinity, gcTime: 0, refetchOnWindowFocus: false });

  if (doc.isLoading) return <p className="p-6 text-sm text-text-muted">Opening document…</p>;
  if (doc.isError || !doc.data) return <p className="p-6 text-sm text-danger">This document could not be opened. It may have been deleted.</p>;
  return <DocumentEditor key={doc.data.id} doc={doc.data} />;
}
