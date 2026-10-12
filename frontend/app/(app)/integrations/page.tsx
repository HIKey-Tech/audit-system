'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowUpDown,
  Bookmark,
  CheckCircle2,
  Clock,
  CloudCog,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sliders,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { SlideOver } from '@/components/ui/SlideOver';
import { useSession, hasPermission } from '@/components/providers/AuthProvider';
import {
  imocApi,
  ImocIngestionRule,
  ImocRealStatus,
  ImocRuleCriteria,
  ImocStoredTicket,
  StoredTicketDetail,
} from '@/lib/api/imoc';
import { formatDate } from '@/lib/utils/format';

export default function IntegrationsPage(): JSX.Element {
  const session = useSession();
  const qc = useQueryClient();

  // Permission flags
  const canReadImoc = hasPermission(session, 'imoc:read');
  const canManageRules = hasPermission(session, 'imoc:rules');
  const canIngest = hasPermission(session, 'imoc:ingest');
  const canExport = hasPermission(session, 'imoc:export');
  const canCreateRisk = hasPermission(session, 'risk:create');

  // Active workspace tab
  const [activeTab, setActiveTab] = useState<'tickets' | 'rules' | 'ingestion'>('tickets');

  // Ticket Filters State
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedSla, setSelectedSla] = useState<string>('');

  // Selected Ticket Drawer State
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Rule Creation SlideOver State
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [previewSample, setPreviewSample] = useState<any[] | null>(null);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    description: '',
    priority: 100,
    category: '',
    lookbackDays: 30,
    statusProcessing: true,
    statusCompleted: false,
    statusDismissed: false,
    slaBreak: false,
    slaNormal: false,
    nameContains: '',
    currentUser: '',
  });

  // Risk Creation Modal State (from ticket)
  const [riskModalOpen, setRiskModalOpen] = useState(false);
  const [riskForm, setRiskForm] = useState({
    title: '',
    description: '',
    categoryId: '',
    likelihood: 3,
    impact: 3,
    businessObjective: '',
  });

  // Queries
  const statusQuery = useQuery({
    queryKey: ['integration', 'imoc', 'status'],
    queryFn: imocApi.status,
  });

  const checkStatusQuery = useQuery({
    queryKey: ['integration', 'imoc', 'checkStatus'],
    queryFn: imocApi.checkStatus,
    enabled: false,
  });

  const summaryQuery = useQuery({
    queryKey: ['integration', 'imoc', 'summary', selectedCategory, selectedStatus, selectedSla, searchQuery],
    queryFn: () =>
      imocApi.getStoredSummary({
        category: selectedCategory || undefined,
        status: selectedStatus || undefined,
        slaStatus: selectedSla || undefined,
        search: searchQuery || undefined,
      }),
    enabled: canReadImoc,
  });

  const ticketsQuery = useQuery({
    queryKey: ['integration', 'imoc', 'tickets', page, selectedCategory, selectedStatus, selectedSla, searchQuery],
    queryFn: () =>
      imocApi.listStoredTickets({
        page,
        pageSize: 15,
        category: selectedCategory || undefined,
        status: selectedStatus || undefined,
        slaStatus: selectedSla || undefined,
        search: searchQuery || undefined,
      }),
    enabled: canReadImoc,
  });

  const ticketDetailQuery = useQuery({
    queryKey: ['integration', 'imoc', 'ticket', selectedTicketId],
    queryFn: () => imocApi.getStoredTicket(selectedTicketId!),
    enabled: Boolean(selectedTicketId),
  });

  const rulesQuery = useQuery({
    queryKey: ['integration', 'imoc', 'rules'],
    queryFn: imocApi.listRules,
    enabled: canManageRules,
  });

  const runsQuery = useQuery({
    queryKey: ['integration', 'imoc', 'runs'],
    queryFn: () => imocApi.listRuns(1, 15),
    enabled: canManageRules || canIngest,
  });

  const savedViewsQuery = useQuery({
    queryKey: ['integration', 'imoc', 'savedViews'],
    queryFn: imocApi.listViews,
    enabled: canReadImoc,
  });

  // Mutations
  const testConnMutation = useMutation({
    mutationFn: imocApi.checkStatus,
    onSuccess: (data: ImocRealStatus) => {
      if (data.reachable && data.authenticated) {
        toast.success('Live IMOC connection healthy and authenticated');
      } else {
        toast.error(`IMOC test failed: ${data.lastError || 'Service unreachable'}`);
      }
      qc.invalidateQueries({ queryKey: ['integration', 'imoc', 'status'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Connectivity check failed'),
  });

  const runIngestMutation = useMutation({
    mutationFn: imocApi.runIngestion,
    onSuccess: (res) => {
      toast.success(
        `Ingestion run finished (${res.status}): created ${res.created}, updated ${res.updated}, skipped ${res.skipped}`,
      );
      qc.invalidateQueries({ queryKey: ['integration', 'imoc', 'runs'] });
      qc.invalidateQueries({ queryKey: ['integration', 'imoc', 'tickets'] });
      qc.invalidateQueries({ queryKey: ['integration', 'imoc', 'summary'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Ingestion run failed'),
  });

  const toggleRuleMutation = useMutation({
    mutationFn: (id: string) => imocApi.toggleRule(id),
    onSuccess: (rule) => {
      toast.success(`Rule "${rule.name}" is now ${rule.isActive ? 'active' : 'inactive'}`);
      qc.invalidateQueries({ queryKey: ['integration', 'imoc', 'rules'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not toggle rule'),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => imocApi.deleteRule(id),
    onSuccess: () => {
      toast.success('Ingestion rule deleted');
      qc.invalidateQueries({ queryKey: ['integration', 'imoc', 'rules'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not delete rule'),
  });

  const previewRuleMutation = useMutation({
    mutationFn: (criteria: ImocRuleCriteria) =>
      imocApi.previewRule({ criteria, lookbackDays: ruleForm.lookbackDays }),
    onSuccess: (data) => {
      setPreviewSample(data.sample);
      toast.info(`Dry-run matched ${data.total} sample ticket(s) upstream`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Preview failed'),
  });

  const createRuleMutation = useMutation({
    mutationFn: (ruleData: any) => imocApi.createRule(ruleData),
    onSuccess: () => {
      toast.success('Ingestion rule created successfully');
      setRuleModalOpen(false);
      setPreviewSample(null);
      qc.invalidateQueries({ queryKey: ['integration', 'imoc', 'rules'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not create rule'),
  });

  const createRiskMutation = useMutation({
    mutationFn: (payload: any) => imocApi.linkRisk(payload),
    onSuccess: () => {
      toast.success('Risk raised and linked to IMOC ticket');
      setRiskModalOpen(false);
      qc.invalidateQueries({ queryKey: ['integration', 'imoc', 'ticket', selectedTicketId] });
      qc.invalidateQueries({ queryKey: ['integration', 'imoc', 'tickets'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not raise risk'),
  });

  // Calculate combinations for rule form preview
  const ruleCombinations = useMemo(() => {
    let statusCount = 0;
    if (ruleForm.statusProcessing) statusCount++;
    if (ruleForm.statusCompleted) statusCount++;
    if (ruleForm.statusDismissed) statusCount++;
    statusCount = statusCount || 1;

    let slaCount = 0;
    if (ruleForm.slaBreak) slaCount++;
    if (ruleForm.slaNormal) slaCount++;
    slaCount = slaCount || 1;

    return statusCount * slaCount;
  }, [ruleForm]);

  const buildCriteriaFromForm = (): ImocRuleCriteria => {
    const statuses: any[] = [];
    if (ruleForm.statusProcessing) statuses.push('processing');
    if (ruleForm.statusCompleted) statuses.push('completed');
    if (ruleForm.statusDismissed) statuses.push('dismissed');

    const slaStatuses: string[] = [];
    if (ruleForm.slaBreak) slaStatuses.push('BREAK');
    if (ruleForm.slaNormal) slaStatuses.push('NORMAL');

    return {
      orderStatus: statuses.length ? statuses : undefined,
      slaStatus: slaStatuses.length ? slaStatuses : undefined,
      nameContains: ruleForm.nameContains.trim() || undefined,
      currentUsers: ruleForm.currentUser.trim() ? [ruleForm.currentUser.trim()] : undefined,
    };
  };

  const handlePreviewRule = () => {
    const criteria = buildCriteriaFromForm();
    previewRuleMutation.mutate(criteria);
  };

  const handleSaveRule = (e: FormEvent) => {
    e.preventDefault();
    if (!ruleForm.name.trim()) {
      toast.error('Please enter a rule name');
      return;
    }
    const criteria = buildCriteriaFromForm();
    createRuleMutation.mutate({
      name: ruleForm.name.trim(),
      description: ruleForm.description.trim() || undefined,
      priority: Number(ruleForm.priority) || 100,
      category: ruleForm.category.trim() || undefined,
      lookbackDays: Number(ruleForm.lookbackDays) || 30,
      criteria,
    });
  };

  const handleExport = (format: 'csv' | 'xlsx') => {
    const params = new URLSearchParams();
    if (selectedCategory) params.append('category', selectedCategory);
    if (selectedStatus) params.append('status', selectedStatus);
    if (selectedSla) params.append('slaStatus', selectedSla);
    if (searchQuery) params.append('search', searchQuery);
    params.append('format', format);
    window.open(`/api/proxy/integration/imoc/store/export?${params.toString()}`, '_blank');
  };

  const openRiskModal = (ticket: StoredTicketDetail) => {
    setRiskForm({
      title: `Service disruption: ${ticket.orderName || ticket.orderNumber}`,
      description: `Raised from IMOC ticket #${ticket.orderNumber} (${ticket.category || 'Uncategorised'}). Status: ${ticket.orderStatus}, SLA: ${ticket.slaStatus ?? 'N/A'}.`,
      categoryId: '',
      likelihood: ticket.slaStatus === 'BREAK' ? 4 : 3,
      impact: ticket.priority === 'HIGH' || ticket.priority === 'P1' ? 4 : 3,
      businessObjective: 'GBB IT infrastructure and service availability continuity',
    });
    setRiskModalOpen(true);
  };

  const tabs = [
    { key: 'tickets', label: 'Tickets' },
    ...(canManageRules ? [{ key: 'rules', label: 'Rules' }] : []),
    ...(canManageRules || canIngest ? [{ key: 'ingestion', label: 'Ingestion' }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="IMOC Operations & Ingestion"
        subtitle="Ingested Galaxy Backbone service tickets, audit analytics, and automated rules engine."
      />

      {/* Top Connection Status Banner */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-subtle border border-border">
              <CloudCog className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-text-primary">IMOC Service Gateway</h2>
                <Badge
                  tone={
                    statusQuery.data?.enabled && statusQuery.data?.configured
                      ? 'green'
                      : statusQuery.data?.enabled
                      ? 'amber'
                      : 'gray'
                  }
                >
                  {statusQuery.data?.enabled && statusQuery.data?.configured
                    ? 'Connected & Trusted'
                    : statusQuery.data?.enabled
                    ? 'Configuration Pending'
                    : 'Disabled'}
                </Badge>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                {statusQuery.data?.connectionMessage || 'Read-only IMOC endpoint'} ·{' '}
                {summaryQuery.data?.total ?? 0} tickets stored locally
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              isLoading={testConnMutation.isPending}
              onClick={() => testConnMutation.mutate()}
            >
              Test Connection
            </Button>
            {canIngest && (
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Play className="h-3.5 w-3.5" />}
                isLoading={runIngestMutation.isPending}
                onClick={() => runIngestMutation.mutate()}
              >
                Run Ingest Now
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Workspace Tabs */}
      <Tabs
        tabs={tabs}
        active={activeTab}
        onChange={(key) => setActiveTab(key as any)}
      />

      {/* ========================================================================= */}
      {/* TICKETS TAB (Default Browse, Summary, Drawer)                             */}
      {/* ========================================================================= */}
      {activeTab === 'tickets' && (
        <div className="space-y-6">
          {/* Summary KPI Panel */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted">Total Ingested Tickets</span>
                <Database className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-bold text-text-primary">
                {summaryQuery.isLoading ? <Skeleton className="h-8 w-16" /> : summaryQuery.data?.total ?? 0}
              </p>
              <span className="text-[11px] text-text-muted">In local audit cache</span>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted">SLA Breached (BREAK)</span>
                <ShieldAlert className="h-4 w-4 text-danger" />
              </div>
              <p className="mt-2 text-2xl font-bold text-danger">
                {summaryQuery.isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  summaryQuery.data?.slaBreachedCount ?? 0
                )}
              </p>
              <span className="text-[11px] text-text-muted">High priority audit signals</span>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted">Open / In Progress</span>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-text-primary">
                {summaryQuery.isLoading ? <Skeleton className="h-8 w-16" /> : summaryQuery.data?.openCount ?? 0}
              </p>
              <span className="text-[11px] text-text-muted">Active tickets</span>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted">Top Categories</span>
                <Layers className="h-4 w-4 text-text-muted" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {summaryQuery.data?.byCategory &&
                  Object.entries(summaryQuery.data.byCategory).slice(0, 3).map(([cat, count]) => (
                    <Badge
                      key={cat}
                      tone="blue"
                      className="cursor-pointer hover:opacity-80"
                      onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                    >
                      {cat}: {count}
                    </Badge>
                  ))}
              </div>
            </Card>
          </div>

          {/* Filter Bar */}
          <Card padded={false} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="relative min-w-[240px] flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-muted" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search by ticket # or title..."
                    className="pl-8"
                  />
                </div>

                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 rounded-md border border-border bg-surface px-2.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All Categories</option>
                  {summaryQuery.data?.byCategory &&
                    Object.keys(summaryQuery.data.byCategory).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                </select>

                {/* SLA Filter */}
                <select
                  value={selectedSla}
                  onChange={(e) => {
                    setSelectedSla(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 rounded-md border border-border bg-surface px-2.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All SLAs</option>
                  <option value="BREAK">BREAK (Breached)</option>
                  <option value="NORMAL">NORMAL</option>
                </select>

                {/* Status Filter */}
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 rounded-md border border-border bg-surface px-2.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All Statuses</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="suspend">Suspend</option>
                </select>

                {(selectedCategory || selectedStatus || selectedSla || searchQuery) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedCategory('');
                      setSelectedStatus('');
                      setSelectedSla('');
                      setSearchQuery('');
                      setPage(1);
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>

              {/* Export Controls */}
              {canExport && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<FileSpreadsheet className="h-3.5 w-3.5" />}
                    onClick={() => handleExport('xlsx')}
                  >
                    Export Excel
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<Download className="h-3.5 w-3.5" />}
                    onClick={() => handleExport('csv')}
                  >
                    Export CSV
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Tickets Results Table */}
          <Card padded={false}>
            {ticketsQuery.isLoading ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !ticketsQuery.data?.items?.length ? (
              <EmptyState
                icon={<Database className="h-6 w-6" />}
                title="No tickets match these rules or filters"
                description="Configure ingestion rules or run a sync to ingest tickets from IMOC."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-surface-subtle text-text-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Ticket #</th>
                      <th className="px-4 py-3 font-semibold">Title</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">SLA</th>
                      <th className="px-4 py-3 font-semibold">Current Handler</th>
                      <th className="px-4 py-3 font-semibold">Created In IMOC</th>
                      <th className="px-4 py-3 font-semibold">Audit Context</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ticketsQuery.data.items.map((ticket: ImocStoredTicket) => {
                      const isBreached = ticket.slaStatus?.toUpperCase() === 'BREAK';
                      return (
                        <tr
                          key={ticket.id}
                          className="cursor-pointer transition-colors hover:bg-surface-subtle"
                          onClick={() => setSelectedTicketId(ticket.id)}
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-mono font-medium text-text-primary">
                            {ticket.orderNumber}
                          </td>
                          <td className="max-w-xs truncate px-4 py-3 text-text-secondary">
                            {ticket.orderName || 'Untitled'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <Badge tone="blue">{ticket.category || 'Uncategorised'}</Badge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <Badge tone="gray">{ticket.orderStatus || 'Unknown'}</Badge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <Badge tone={isBreached ? 'red' : ticket.slaStatus ? 'green' : 'gray'}>
                              {ticket.slaStatus ? `SLA: ${ticket.slaStatus}` : 'N/A'}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-text-muted">
                            {ticket.currentHandler || 'Unassigned'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-text-muted">
                            {ticket.imocCreatedAt ? formatDate(ticket.imocCreatedAt) : '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-text-muted">
                            <div className="flex items-center gap-1">
                              {ticket.linkedEngagementCount > 0 && (
                                <Badge tone="purple">{ticket.linkedEngagementCount} audit(s)</Badge>
                              )}
                              {ticket.linkedRiskCount > 0 && (
                                <Badge tone="red">{ticket.linkedRiskCount} risk(s)</Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {ticketsQuery.data && (ticketsQuery.data.totalPages ?? Math.ceil(ticketsQuery.data.total / (ticketsQuery.data.pageSize || 1))) > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <span className="text-xs text-text-muted">
                  Page {ticketsQuery.data.page} of {ticketsQuery.data.totalPages ?? Math.ceil(ticketsQuery.data.total / (ticketsQuery.data.pageSize || 1))} ({ticketsQuery.data.total} total)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={page >= (ticketsQuery.data.totalPages ?? Math.ceil(ticketsQuery.data.total / (ticketsQuery.data.pageSize || 1)))}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RULES TAB (Configuration, Combination Guard, Preview Dry-Run)            */}
      {/* ========================================================================= */}
      {activeTab === 'rules' && canManageRules && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-text-primary">Ingestion Rules</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Rules govern what tickets are fetched during scheduled hourly ingestion and map them to audit categories.
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => {
                setRuleModalOpen(true);
                setPreviewSample(null);
              }}
            >
              New Rule
            </Button>
          </div>

          <Card padded={false}>
            {rulesQuery.isLoading ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !rulesQuery.data?.length ? (
              <EmptyState
                icon={<Sliders className="h-6 w-6" />}
                title="No ingestion rules configured"
                description="Create a rule to define which IMOC service tickets are retrieved into IAMS."
              />
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface-subtle text-text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Priority</th>
                    <th className="px-4 py-3 font-semibold">Rule Name</th>
                    <th className="px-4 py-3 font-semibold">Assigned Category</th>
                    <th className="px-4 py-3 font-semibold">Lookback</th>
                    <th className="px-4 py-3 font-semibold">Last Run</th>
                    <th className="px-4 py-3 font-semibold">Active</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rulesQuery.data.map((rule: ImocIngestionRule) => (
                    <tr key={rule.id}>
                      <td className="px-4 py-3 font-semibold text-text-primary">{rule.priority}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-text-primary">{rule.name}</div>
                        {rule.description && (
                          <div className="text-[11px] text-text-muted">{rule.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="blue">{rule.category || 'Default Mapping'}</Badge>
                      </td>
                      <td className="px-4 py-3 text-text-muted">{rule.lookbackDays} days</td>
                      <td className="px-4 py-3">
                        {rule.lastRunStatus ? (
                          <div className="flex items-center gap-1.5">
                            <Badge tone={rule.lastRunStatus === 'success' ? 'green' : 'red'}>
                              {rule.lastRunStatus}
                            </Badge>
                            <span className="text-[11px] text-text-muted">
                              ({rule.lastRunIngested ?? 0} ingested)
                            </span>
                          </div>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={rule.isActive}
                          onChange={() => toggleRuleMutation.mutate(rule.id)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Delete rule "${rule.name}"?`)) {
                              deleteRuleMutation.mutate(rule.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-danger" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INGESTION TAB (Scheduled Runs & Observability)                            */}
      {/* ========================================================================= */}
      {activeTab === 'ingestion' && (canManageRules || canIngest) && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-text-primary">Ingestion Pipeline History</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Audit trail of all automated hourly runs and manual sync jobs.
              </p>
            </div>
            {canIngest && (
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Play className="h-3.5 w-3.5" />}
                isLoading={runIngestMutation.isPending}
                onClick={() => runIngestMutation.mutate()}
              >
                Trigger Ingestion Now
              </Button>
            )}
          </div>

          <Card padded={false}>
            {runsQuery.isLoading ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !runsQuery.data?.items?.length ? (
              <EmptyState
                icon={<Clock className="h-6 w-6" />}
                title="No ingestion runs recorded"
                description="Runs will appear here once the scheduler executes or you trigger a manual run."
              />
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface-subtle text-text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Started At</th>
                    <th className="px-4 py-3 font-semibold">Trigger</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Rules</th>
                    <th className="px-4 py-3 font-semibold">Fetched</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                    <th className="px-4 py-3 font-semibold">Updated</th>
                    <th className="px-4 py-3 font-semibold">Skipped</th>
                    <th className="px-4 py-3 font-semibold">Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {runsQuery.data.items.map((run: any) => (
                    <tr key={run.id}>
                      <td className="px-4 py-3 text-text-primary">{formatDate(run.startedAt)}</td>
                      <td className="px-4 py-3">
                        <Badge tone="blue">{run.trigger}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            run.status === 'success'
                              ? 'green'
                              : run.status === 'partial'
                              ? 'amber'
                              : run.status === 'running'
                              ? 'blue'
                              : 'red'
                          }
                        >
                          {run.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-text-muted">{run.rulesEvaluated}</td>
                      <td className="px-4 py-3 text-text-muted">{run.fetched}</td>
                      <td className="px-4 py-3 font-semibold text-green-600">{run.created}</td>
                      <td className="px-4 py-3 text-text-muted">{run.updated}</td>
                      <td className="px-4 py-3 text-text-muted">{run.skipped}</td>
                      <td className="px-4 py-3 text-text-muted max-w-xs truncate">
                        {run.errorSummary || 'None'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TICKET DETAIL DRAWER (SlideOver)                                          */}
      {/* ========================================================================= */}
      <SlideOver
        open={Boolean(selectedTicketId)}
        onClose={() => setSelectedTicketId(null)}
        title={ticketDetailQuery.data?.orderNumber || 'IMOC Ticket Details'}
        description={ticketDetailQuery.data?.orderName || undefined}
        width="lg"
      >
        {ticketDetailQuery.isLoading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : ticketDetailQuery.data ? (
          <div className="space-y-6 text-xs text-text-secondary">
            {/* Quick Status Bar */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-subtle border border-border p-3">
              <Badge tone="blue">{ticketDetailQuery.data.category || 'Uncategorised'}</Badge>
              <Badge tone="gray">{ticketDetailQuery.data.orderStatus}</Badge>
              {ticketDetailQuery.data.slaStatus && (
                <Badge tone={ticketDetailQuery.data.slaStatus === 'BREAK' ? 'red' : 'green'}>
                  SLA: {ticketDetailQuery.data.slaStatus}
                </Badge>
              )}
              {ticketDetailQuery.data.priority && (
                <Badge tone="amber">Priority: {ticketDetailQuery.data.priority}</Badge>
              )}
            </div>

            {/* Metadata Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="font-semibold text-text-primary block">IMOC Order ID</span>
                <span className="font-mono text-text-muted">{ticketDetailQuery.data.orderId}</span>
              </div>
              <div>
                <span className="font-semibold text-text-primary block">Model Name</span>
                <span>{ticketDetailQuery.data.modelName || '—'}</span>
              </div>
              <div>
                <span className="font-semibold text-text-primary block">Current Handler</span>
                <span>{ticketDetailQuery.data.currentHandler || 'Unassigned'}</span>
              </div>
              <div>
                <span className="font-semibold text-text-primary block">Applicant</span>
                <span>{ticketDetailQuery.data.createdByName || '—'}</span>
              </div>
              <div>
                <span className="font-semibold text-text-primary block">IMOC Created At</span>
                <span>
                  {ticketDetailQuery.data.imocCreatedAt
                    ? formatDate(ticketDetailQuery.data.imocCreatedAt)
                    : '—'}
                </span>
              </div>
              <div>
                <span className="font-semibold text-text-primary block">Last Synced</span>
                <span>{formatDate(ticketDetailQuery.data.lastSyncedAt)}</span>
              </div>
            </div>

            {/* Matched Ingestion Rules */}
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Matched Ingestion Rules</h3>
              {ticketDetailQuery.data.matchedRuleNames?.length ? (
                <div className="flex flex-wrap gap-1">
                  {ticketDetailQuery.data.matchedRuleNames.map((name) => (
                    <Badge key={name} tone="purple">
                      {name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-text-muted">Direct or legacy link (no active rule recorded)</p>
              )}
            </div>

            {/* Linked Engagements */}
            <div>
              <h3 className="font-semibold text-text-primary mb-1">
                Linked Audit Engagements ({ticketDetailQuery.data.linkedEngagements.length})
              </h3>
              {ticketDetailQuery.data.linkedEngagements.length ? (
                <ul className="divide-y divide-border rounded border border-border">
                  {ticketDetailQuery.data.linkedEngagements.map((eng) => (
                    <li key={eng.linkId} className="p-2.5">
                      <div className="font-medium text-text-primary">{eng.engagementTitle}</div>
                      <div className="text-[11px] text-text-muted">
                        Ref: {eng.engagementCode} · Linked {formatDate(eng.linkedAt)}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-text-muted">Not linked to any audit engagements yet.</p>
              )}
            </div>

            {/* Linked Risks (P3) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-text-primary">
                  Linked Risks ({ticketDetailQuery.data.linkedRisks.length})
                </h3>
                {canCreateRisk && (
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<ShieldAlert className="h-3 w-3" />}
                    onClick={() => openRiskModal(ticketDetailQuery.data!)}
                  >
                    Raise Risk
                  </Button>
                )}
              </div>
              {ticketDetailQuery.data.linkedRisks.length ? (
                <ul className="divide-y divide-border rounded border border-border">
                  {ticketDetailQuery.data.linkedRisks.map((risk) => (
                    <li key={risk.id} className="p-2.5">
                      <div className="font-medium text-text-primary">{risk.title}</div>
                      <div className="text-[11px] text-text-muted">
                        Score: {risk.currentScore} · Status: {risk.status}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-text-muted">No audit risk entries linked to this ticket.</p>
              )}
            </div>
          </div>
        ) : null}
      </SlideOver>

      {/* ========================================================================= */}
      {/* CREATE RULE SLIDEOVER (SlideOver with preview)                             */}
      {/* ========================================================================= */}
      <SlideOver
        open={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        title="Create Ingestion Rule"
        description="Filter tickets from IMOC and assign them to audit categories."
        width="lg"
      >
        <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-text-primary mb-1">Rule Name *</label>
            <Input
              value={ruleForm.name}
              onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
              placeholder="e.g. SLA Breached Core Incidents"
              required
            />
          </div>

          <div>
            <label className="block font-medium text-text-primary mb-1">Description</label>
            <Input
              value={ruleForm.description}
              onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
              placeholder="Rationale for ingesting this subset"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-text-primary mb-1">Evaluation Priority</label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={ruleForm.priority}
                onChange={(e) => setRuleForm({ ...ruleForm, priority: Number(e.target.value) })}
              />
              <span className="text-[11px] text-text-muted">Lower number = higher precedence</span>
            </div>
            <div>
              <label className="block font-medium text-text-primary mb-1">Lookback (Days)</label>
              <Input
                type="number"
                min={1}
                max={365}
                value={ruleForm.lookbackDays}
                onChange={(e) => setRuleForm({ ...ruleForm, lookbackDays: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-text-primary mb-1">Assign Category</label>
            <Input
              value={ruleForm.category}
              onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value })}
              placeholder="e.g. Critical Incident Management"
            />
          </div>

          {/* Criteria Checkboxes */}
          <div className="rounded-lg border border-border p-3 space-y-3 bg-surface-subtle">
            <h4 className="font-semibold text-text-primary">Upstream Filter Criteria</h4>

            <div>
              <span className="font-medium text-text-primary block mb-1">Order Statuses:</span>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ruleForm.statusProcessing}
                    onChange={(e) => setRuleForm({ ...ruleForm, statusProcessing: e.target.checked })}
                  />
                  <span>processing</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ruleForm.statusCompleted}
                    onChange={(e) => setRuleForm({ ...ruleForm, statusCompleted: e.target.checked })}
                  />
                  <span>completed</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ruleForm.statusDismissed}
                    onChange={(e) => setRuleForm({ ...ruleForm, statusDismissed: e.target.checked })}
                  />
                  <span>dismissed</span>
                </label>
              </div>
            </div>

            <div>
              <span className="font-medium text-text-primary block mb-1">SLA Statuses:</span>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ruleForm.slaBreak}
                    onChange={(e) => setRuleForm({ ...ruleForm, slaBreak: e.target.checked })}
                  />
                  <span className="text-danger font-medium">BREAK (Breached)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ruleForm.slaNormal}
                    onChange={(e) => setRuleForm({ ...ruleForm, slaNormal: e.target.checked })}
                  />
                  <span>NORMAL</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block font-medium text-text-primary mb-1">Title Contains (Local Match):</label>
              <Input
                value={ruleForm.nameContains}
                onChange={(e) => setRuleForm({ ...ruleForm, nameContains: e.target.value })}
                placeholder="e.g. Router, Firewall, Database"
              />
            </div>

            {/* Combination Cap Guard Indicator */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
              <span>
                Generated query combinations: <strong>{ruleCombinations}</strong> / 20 cap
              </span>
              {ruleCombinations > 20 ? (
                <Badge tone="red">Exceeds 20-query limit</Badge>
              ) : (
                <Badge tone="green">Valid</Badge>
              )}
            </div>
          </div>

          {/* Action Buttons & Preview Dry-run */}
          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="secondary"
              leftIcon={<Eye className="h-3.5 w-3.5" />}
              isLoading={previewRuleMutation.isPending}
              onClick={handlePreviewRule}
            >
              Dry-run Preview
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={ruleCombinations > 20}
              isLoading={createRuleMutation.isPending}
            >
              Save Rule
            </Button>
          </div>

          {/* Preview Results Display */}
          {previewSample && (
            <div className="mt-4 rounded-lg border border-border p-3 bg-surface">
              <h4 className="font-semibold text-text-primary mb-2">
                Dry-run Preview Sample ({previewSample.length} ticket(s) found)
              </h4>
              {previewSample.length === 0 ? (
                <p className="text-text-muted">No tickets currently match these criteria upstream.</p>
              ) : (
                <ul className="divide-y divide-border text-[11px] max-h-48 overflow-y-auto">
                  {previewSample.map((t) => (
                    <li key={t.orderId} className="py-1.5">
                      <span className="font-mono font-medium text-text-primary mr-1">
                        {t.orderNumber}
                      </span>
                      <span>{t.orderName}</span>
                      <span className="text-text-muted ml-1">
                        ({t.orderStatus}, SLA: {t.slaStatus ?? 'None'})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </form>
      </SlideOver>

      {/* ========================================================================= */}
      {/* RAISE RISK SLIDEOVER (P3)                                                 */}
      {/* ========================================================================= */}
      <SlideOver
        open={riskModalOpen}
        onClose={() => setRiskModalOpen(false)}
        title="Raise Risk from IMOC Ticket"
        description="Creates a formal audit risk register record referencing this ticket."
        width="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!riskForm.title.trim()) {
              toast.error('Risk title is required');
              return;
            }
            createRiskMutation.mutate({
              imocTicketId: selectedTicketId,
              createRisk: {
                title: riskForm.title.trim(),
                description: riskForm.description.trim(),
                categoryId: riskForm.categoryId || 'c0000000-0000-0000-0000-000000000001', // Fallback or pick
                likelihood: Number(riskForm.likelihood) || 3,
                impact: Number(riskForm.impact) || 3,
                businessObjective: riskForm.businessObjective.trim() || undefined,
              },
            });
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block font-medium text-text-primary mb-1">Risk Title *</label>
            <Input
              value={riskForm.title}
              onChange={(e) => setRiskForm({ ...riskForm, title: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block font-medium text-text-primary mb-1">Description *</label>
            <textarea
              value={riskForm.description}
              onChange={(e) => setRiskForm({ ...riskForm, description: e.target.value })}
              rows={4}
              className="w-full rounded-md border border-border bg-surface p-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-text-primary mb-1">Likelihood (1–5)</label>
              <Input
                type="number"
                min={1}
                max={5}
                value={riskForm.likelihood}
                onChange={(e) => setRiskForm({ ...riskForm, likelihood: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block font-medium text-text-primary mb-1">Impact (1–5)</label>
              <Input
                type="number"
                min={1}
                max={5}
                value={riskForm.impact}
                onChange={(e) => setRiskForm({ ...riskForm, impact: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-text-primary mb-1">Business Objective Threatened</label>
            <Input
              value={riskForm.businessObjective}
              onChange={(e) => setRiskForm({ ...riskForm, businessObjective: e.target.value })}
            />
          </div>

          <div className="pt-2 flex justify-end">
            <Button type="submit" variant="primary" isLoading={createRiskMutation.isPending}>
              Create & Link Risk
            </Button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
