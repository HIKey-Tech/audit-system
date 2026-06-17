'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { SignaturePad } from '@/components/common/SignaturePad';
import { signatureApi } from '@/lib/api/signature';
import type { UserSignature } from '@/lib/types/domain';

export function SignatureCard(): JSX.Element {
  const qc = useQueryClient();
  const { data: sig, isLoading } = useQuery({
    queryKey: ['signature'],
    queryFn: () => signatureApi.get(),
  });

  const save = useMutation({
    mutationFn: ({ blob, kind }: { blob: Blob; kind: 'drawn' | 'uploaded' }) =>
      signatureApi.save(blob, kind),
    onSuccess: () => {
      toast.success('Signature saved');
      qc.invalidateQueries({ queryKey: ['signature'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to save signature'),
  });

  const remove = useMutation({
    mutationFn: () => signatureApi.remove(),
    onSuccess: () => {
      toast.success('Signature removed');
      qc.invalidateQueries({ queryKey: ['signature'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to remove signature'),
  });

  return (
    <Card>
      <CardHeader
        title="My signature"
        subtitle="Used when you sign workflow requests. Draw it or upload a PNG/JPG (transparent PNG recommended)."
      />
      {isLoading ? (
        <Skeleton className="h-24 w-full max-w-sm" />
      ) : sig ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sig.imageUrl}
            alt="Your signature"
            className="h-20 rounded-md border border-border bg-white object-contain p-2"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => qc.setQueryData<UserSignature | null>(['signature'], null)}
            >
              Replace
            </Button>
            <Button size="sm" variant="danger" isLoading={remove.isPending} onClick={() => remove.mutate()}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="max-w-sm">
          <SignaturePad onChange={(blob, kind) => save.mutate({ blob, kind })} />
        </div>
      )}
    </Card>
  );
}
