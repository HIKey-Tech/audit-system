'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Building2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ProjectPlusEntityList } from '@/components/integrations/ProjectPlusEntityList';
import { hasPermission, useSession } from '@/components/providers/AuthProvider';
import { PROJECT_PLUS_COMING_SOON, projectPlusApi, ProjectPlusRealStatus } from '@/lib/api/projectplus';

export default function ProjectPlusPage(): JSX.Element {
  if (PROJECT_PLUS_COMING_SOON) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Project Plus"
          subtitle="Read-only view of customers, vendors and clients held in Project Plus."
          breadcrumbs={[{ label: 'Integrations', href: '/integrations' }, { label: 'Project Plus' }]}
        />
        <Card>
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 h-5 w-5 text-text-muted" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-text-primary">Project Plus integration</h2>
                <Badge tone="amber">Coming soon</Badge>
              </div>
              <p className="mt-1 text-sm text-text-secondary">
                This integration is being set up. It will let auditors look up vendors and customers from Project Plus and optionally attach them to an audit.
              </p>
              <p className="mt-2 text-xs text-text-muted">No audit workflow depends on it.</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }
  return <ProjectPlusPageContent />;
}

function ProjectPlusPageContent(): JSX.Element {
  const session = useSession();
  const canRead = hasPermission(session, 'projectplus:read');
  const status = useQuery({ queryKey: ['integration', 'projectplus', 'status'], queryFn: projectPlusApi.status });
  const docTypes = useQuery({
    queryKey: ['integration', 'projectplus', 'document-types'],
    queryFn: projectPlusApi.documentTypes,
    enabled: canRead && Boolean(status.data?.enabled && status.data?.configured),
  });

  const test = useMutation({
    mutationFn: projectPlusApi.checkStatus,
    onSuccess: (r: ProjectPlusRealStatus) =>
      r.reachable && r.authenticated
        ? toast.success('Project Plus is reachable and authenticated')
        : toast.error(`Project Plus test failed: ${r.lastError ?? 'service unreachable'}`),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Connection test failed'),
  });

  const enabled = Boolean(status.data?.enabled);
  const configured = Boolean(status.data?.configured);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Plus"
        subtitle="Read-only view of customers, vendors and clients held in Project Plus. Optional — no audit depends on it."
        breadcrumbs={[{ label: 'Integrations', href: '/integrations' }, { label: 'Project Plus' }]}
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-text-primary">Project Plus gateway</h2>
                {status.isLoading ? <Skeleton className="h-5 w-20" /> : (
                  <Badge tone={enabled && configured ? 'green' : enabled ? 'amber' : 'gray'}>
                    {enabled && configured ? 'Configured' : enabled ? 'Configuration pending' : 'Disabled'}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-text-secondary">IAMS only reads from Project Plus; it never creates, edits or approves anything there.</p>
            </div>
          </div>
          <Button size="sm" variant="secondary" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} isLoading={test.isPending} disabled={!enabled} onClick={() => test.mutate()}>
            Test connection
          </Button>
        </div>
      </Card>

      {!canRead ? (
        <Card><p className="text-sm text-text-secondary">You do not have permission to view Project Plus data.</p></Card>
      ) : !enabled ? (
        <Card><p className="text-sm text-text-secondary">Project Plus is not enabled. No audit workflow is blocked while it stays disabled.</p></Card>
      ) : (
        <>
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-text-primary">Entity lookup</h3>
            <ProjectPlusEntityList enabled={configured} pageSize={15} />
          </Card>
          {docTypes.data && docTypes.data.length > 0 && (
            <Card>
              <h3 className="mb-2 text-sm font-semibold text-text-primary">Contract document types</h3>
              <div className="flex flex-wrap gap-2">
                {docTypes.data.map((d) => <Badge key={d.code} tone="blue">{d.description || d.code}</Badge>)}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
