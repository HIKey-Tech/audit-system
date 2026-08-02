import { Skeleton } from '@/components/ui/Skeleton';

export default function AppLoading(): JSX.Element {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
