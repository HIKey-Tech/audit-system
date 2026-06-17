'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

/**
 * Minimal signature capture: a Draw tab (canvas, pointer events) and an Upload tab
 * (PNG/JPG). Emits a PNG/image Blob plus the chosen kind. No external dependency.
 */
export function SignaturePad({
  onChange,
}: {
  onChange: (blob: Blob, kind: 'drawn' | 'uploaded') => void;
}): JSX.Element {
  const [tab, setTab] = useState<'draw' | 'upload'>('draw');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  const pos = (e: React.PointerEvent): { x: number; y: number } => {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvasRef.current!.width,
      y: ((e.clientY - r.top) / r.height) * canvasRef.current!.height,
    };
  };
  const start = (e: React.PointerEvent): void => {
    drawing.current = true;
    const c = canvasRef.current!.getContext('2d')!;
    const p = pos(e);
    c.beginPath();
    c.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent): void => {
    if (!drawing.current) return;
    const c = canvasRef.current!.getContext('2d')!;
    const p = pos(e);
    c.lineWidth = 2;
    c.lineCap = 'round';
    c.strokeStyle = '#0f172a';
    c.lineTo(p.x, p.y);
    c.stroke();
    hasDrawn.current = true;
  };
  const end = (): void => {
    drawing.current = false;
  };
  const clear = (): void => {
    const c = canvasRef.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    hasDrawn.current = false;
  };
  const saveDrawn = (): void => {
    if (!hasDrawn.current) return;
    canvasRef.current!.toBlob((b) => b && onChange(b, 'drawn'), 'image/png');
  };

  return (
    <div>
      <div className="mb-2 flex gap-3 text-sm">
        <button
          type="button"
          onClick={() => setTab('draw')}
          className={tab === 'draw' ? 'font-semibold text-primary' : 'text-text-secondary'}
        >
          Draw
        </button>
        <button
          type="button"
          onClick={() => setTab('upload')}
          className={tab === 'upload' ? 'font-semibold text-primary' : 'text-text-secondary'}
        >
          Upload
        </button>
      </div>

      {tab === 'draw' ? (
        <div>
          <canvas
            ref={canvasRef}
            width={360}
            height={120}
            className="w-full touch-none rounded-md border border-border bg-white"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="ghost" onClick={clear}>
              Clear
            </Button>
            <Button size="sm" onClick={saveDrawn}>
              Use signature
            </Button>
          </div>
        </div>
      ) : (
        <input
          type="file"
          accept="image/png,image/jpeg"
          className="text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onChange(f, 'uploaded');
          }}
        />
      )}
    </div>
  );
}
