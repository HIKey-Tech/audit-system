'use client';

import { AlertOctagon } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

export default function EscalationsPage(): JSX.Element {
  // The backend exposes escalations per entity (/workflow/escalations/entity/:type/:id),
  // not as a global list — detailed history lives on each engagement/approval detail page.
  return (
    <div>
      <PageHeader title="Escalations" subtitle="Overdue items that have been escalated." />

      <Card>
        <CardHeader title="Active escalations" subtitle="Review escalation history per entity from its detail page." />
        <EmptyState
          icon={<AlertOctagon className="h-4 w-4" />}
          title="Open an entity to view escalations"
          description="The dashboard shows the overall escalation count; detailed escalation history is scoped to an engagement or approval."
        />
      </Card>
    </div>
  );
}
