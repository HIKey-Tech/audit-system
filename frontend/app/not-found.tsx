import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function NotFound(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <Card className="max-w-md text-center" padded={false}>
        <div className="px-8 py-12">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">
            404
          </p>
          <h1 className="mt-2 text-xl font-semibold text-primary">Page not found</h1>
          <p className="mt-2 text-sm text-text-secondary">
            The page you tried to open does not exist.
          </p>
          <Link href="/dashboard" className="mt-6 inline-block">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
