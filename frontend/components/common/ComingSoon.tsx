import Link from 'next/link';
import { type LucideIcon, ArrowLeft } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface ComingSoonProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const ComingSoon = ({ icon: Icon, title, description }: ComingSoonProps): JSX.Element => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <Card className="max-w-xl text-center" padded={false}>
      <div className="px-8 py-12">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary/5 text-primary">
          <Icon className="h-7 w-7" aria-hidden />
        </div>
        <Badge tone="amber" className="mb-4">
          In Development
        </Badge>
        <h1 className="text-xl font-semibold text-primary">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-text-secondary">{description}</p>
        <Link href="/dashboard" className="inline-block mt-6">
          <Button variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </Card>
  </div>
);
