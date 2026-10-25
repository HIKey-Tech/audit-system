'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  ZoomIn,
  ZoomOut,
  PenTool,
  Type,
  Trash2,
  CheckCircle2,
  Download,
  AlertCircle,
  GripVertical,
  Check,
  FileText,
  Loader2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ArrowDownToLine,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { SignaturePad } from '@/components/common/SignaturePad';
import { signatureApi } from '@/lib/api/signature';
import { requestsApi, type DocumentPlacementDto } from '@/lib/api/workflow';
import { useSession } from '@/components/providers/AuthProvider';
import { cn } from '@/lib/utils/cn';

interface DocumentSignerModalProps {
  open: boolean;
  onClose: () => void;
  documentId?: string;
  fileUrl?: string;
  documentName?: string;
  requestId?: string;
  isSignable?: boolean;
  onSigned?: () => void;
  onApprove?: () => void;
  isApproving?: boolean;
}

interface PlacedItem {
  id: string;
  type: 'signature' | 'text';
  pageIndex: number;
  xPercent: number; // 0 to 100
  yPercent: number; // 0 to 100
  widthPercent: number;
  heightPercent: number;
  text?: string;
  fontSize?: number;
}

export function DocumentSignerModal({
  open,
  onClose,
  documentId,
  fileUrl,
  documentName = 'Document',
  requestId,
  isSignable = false,
  onSigned,
  onApprove,
  isApproving = false,
}: DocumentSignerModalProps): JSX.Element | null {
  const session = useSession();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.1);
  const [pageCount, setPageCount] = useState(0);
  const [activePage, setActivePage] = useState(0);
  const [items, setItems] = useState<PlacedItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Signature creation state if user has no saved signature
  const [showDrawPad, setShowDrawPad] = useState(false);
  // Confirmation dialog before final submission
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [affirmation, setAffirmation] = useState('');
  const [comment, setComment] = useState('');

  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Stored signature query
  const { data: sig, refetch: refetchSig } = useQuery({
    queryKey: ['signature', 'active'],
    queryFn: () => signatureApi.get(),
    enabled: open,
  });

  const saveSignature = useMutation({
    mutationFn: ({ blob, kind }: { blob: Blob; kind: 'drawn' | 'uploaded' }) =>
      signatureApi.save(blob, kind),
    onSuccess: () => {
      toast.success('Signature saved to your profile');
      refetchSig();
      queryClient.invalidateQueries({ queryKey: ['signature'] });
      setShowDrawPad(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save signature'),
  });

  const fullName = session.displayName?.trim() || `${session.firstName} ${session.lastName}`.trim();
  const primaryRole = session.roles[0]?.replace(/_/g, ' ') ?? 'Auditor';

  const isWordDoc = Boolean(documentName && /\.(docx?|doc)$/i.test(documentName));
  const docUrl = fileUrl || (documentId ? `/api/proxy/documents/${documentId}/file${isWordDoc ? '?asPdf=true' : ''}` : '');

  // Load and render PDF pages using local pdfjs
  useEffect(() => {
    if (!open || !docUrl) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setItems([]);

    const renderPdf = async () => {
      try {
        // Dynamically import the local PDF.js ES module in browser only
        // @ts-expect-error dynamic browser module
        const pdfjs = await import(/* webpackIgnore: true */ '/vendor/pdfjs/pdf.min.mjs');
        if (pdfjs.GlobalWorkerOptions) {
          pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
        }

        const res = await fetch(docUrl, { credentials: 'include' });
        if (!res.ok) throw new Error(`Could not load document (status ${res.status})`);

        const arrayBuffer = await res.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

        if (!isMounted) return;
        setPageCount(pdf.numPages);
        setLoading(false);

        // Render each page into canvas
        setTimeout(async () => {
          for (let i = 1; i <= pdf.numPages; i++) {
            if (!isMounted) break;
            const page = await pdf.getPage(i);
            const container = pageRefs.current[i - 1];
            if (!container) continue;

            const viewport = page.getViewport({ scale });
            const canvas = container.querySelector<HTMLCanvasElement>('canvas');
            if (!canvas) continue;

            const context = canvas.getContext('2d');
            if (!context) continue;

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
              canvasContext: context,
              viewport,
            }).promise;
          }
        }, 50);
      } catch (err) {
        if (!isMounted) return;
        console.error('PDF render error:', err);
        setError('Could not render document preview. You can still download the file directly.');
        setLoading(false);
      }
    };

    renderPdf();

    return () => {
      isMounted = false;
    };
  }, [open, documentId, scale]);

  // Set default affirmation
  useEffect(() => {
    if (open) {
      setAffirmation(fullName);
      setComment('');
      setConfirmOpen(false);
    }
  }, [open, fullName]);

  // Add signature stamp
  const handleAddSignature = () => {
    if (!sig) {
      setShowDrawPad(true);
      return;
    }

    const newItem: PlacedItem = {
      id: `sig-${Date.now()}`,
      type: 'signature',
      pageIndex: activePage,
      xPercent: 55,
      yPercent: 75,
      widthPercent: 28,
      heightPercent: 9,
    };
    setItems((prev) => [...prev, newItem]);
    setSelectedItemId(newItem.id);
    toast.success('Signature placed. Drag it to your desired position.');
  };

  // Add name & date text stamp
  const handleAddText = () => {
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const newItem: PlacedItem = {
      id: `text-${Date.now()}`,
      type: 'text',
      pageIndex: activePage,
      xPercent: 55,
      yPercent: 86,
      widthPercent: 32,
      heightPercent: 5,
      text: `${fullName} · ${primaryRole}\nDate: ${today}`,
      fontSize: 10,
    };
    setItems((prev) => [...prev, newItem]);
    setSelectedItemId(newItem.id);
    toast.success('Signer text box added. Drag it to position.');
  };

  const scrollToPage = useCallback(
    (index: number) => {
      if (index >= 0 && index < pageCount) {
        setActivePage(index);
        pageRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [pageCount],
  );

  const handleQuickStamp = () => {
    if (!sig) {
      setShowDrawPad(true);
      return;
    }
    const targetPage = pageCount > 0 ? pageCount - 1 : 0;
    scrollToPage(targetPage);

    const sigItem: PlacedItem = {
      id: `item-${Date.now()}-1`,
      type: 'signature',
      pageIndex: targetPage,
      xPercent: 60,
      yPercent: 78,
      widthPercent: 32,
      heightPercent: 12,
    };
    const textItem: PlacedItem = {
      id: `item-${Date.now()}-2`,
      type: 'text',
      pageIndex: targetPage,
      xPercent: 60,
      yPercent: 91,
      widthPercent: 32,
      heightPercent: 6,
      text: `${fullName} · ${primaryRole}\nDate: ${new Date().toLocaleDateString('en-GB')}`,
      fontSize: 9,
    };
    setItems((prev) => [...prev.filter((i) => i.pageIndex !== targetPage), sigItem, textItem]);
    toast.success(`Standard signature block placed on Page ${targetPage + 1}`);
  };

  // Keyboard navigation & shortcuts
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'Escape') {
        if (confirmOpen) setConfirmOpen(false);
        else if (showDrawPad) setShowDrawPad(false);
        else onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        scrollToPage(Math.min(pageCount - 1, activePage + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        scrollToPage(Math.max(0, activePage - 1));
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setScale((s) => Math.min(2.0, s + 0.15));
      } else if (e.key === '-') {
        e.preventDefault();
        setScale((s) => Math.max(0.7, s - 0.15));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, confirmOpen, showDrawPad, activePage, pageCount, scrollToPage]);

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (selectedItemId === id) setSelectedItemId(null);
  };

  // Dragging logic
  const handleDragStart = (
    e: React.PointerEvent<HTMLDivElement>,
    itemId: string,
    pageIdx: number,
  ) => {
    e.stopPropagation();
    setSelectedItemId(itemId);

    const pageContainer = pageRefs.current[pageIdx];
    if (!pageContainer) return;

    const pageRect = pageContainer.getBoundingClientRect();
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialLeft = (item.xPercent / 100) * pageRect.width;
    const initialTop = (item.yPercent / 100) * pageRect.height;

    const onPointerMove = (moveEvt: PointerEvent) => {
      const deltaX = moveEvt.clientX - startX;
      const deltaY = moveEvt.clientY - startY;

      let newLeftPx = initialLeft + deltaX;
      let newTopPx = initialTop + deltaY;

      const maxLeft = pageRect.width - (item.widthPercent / 100) * pageRect.width;
      const maxTop = pageRect.height - (item.heightPercent / 100) * pageRect.height;

      newLeftPx = Math.max(0, Math.min(newLeftPx, maxLeft));
      newTopPx = Math.max(0, Math.min(newTopPx, maxTop));

      const newXPercent = (newLeftPx / pageRect.width) * 100;
      const newYPercent = (newTopPx / pageRect.height) * 100;

      setItems((prev) =>
        prev.map((it) =>
          it.id === itemId ? { ...it, xPercent: newXPercent, yPercent: newYPercent } : it,
        ),
      );
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Sign mutation
  const signMutation = useMutation({
    mutationFn: () => {
      const placementsDto: DocumentPlacementDto[] = items.map((i) => ({
        type: i.type,
        pageIndex: i.pageIndex,
        xPercent: i.xPercent,
        yPercent: i.yPercent,
        widthPercent: i.widthPercent,
        heightPercent: i.heightPercent,
        text: i.text,
        fontSize: i.fontSize,
      }));

      if (!requestId) {
        throw new Error('Request ID is required to sign this document');
      }

      return requestsApi.sign(requestId, {
        affirmation: affirmation.trim(),
        comment: comment.trim() || undefined,
        documentId,
        placements: placementsDto,
      });
    },
    onSuccess: () => {
      toast.success('Document signed and stamped successfully');
      setConfirmOpen(false);
      onClose();
      if (onSigned) onSigned();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to sign document'),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
      <div className="relative flex flex-col h-[94vh] w-full max-w-6xl rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        {/* Top Header / Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/95 px-4 py-3 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="h-5 w-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-100">{documentName}</h3>
              <p className="text-[11px] text-slate-400">
                {pageCount > 0 ? `${pageCount} page(s)` : 'Loading...'} · {isSignable ? 'Signing mode' : 'Preview mode'}
              </p>
            </div>
          </div>

          {/* Interactive Tools */}
          <div className="flex items-center gap-2">
            {/* Page Navigation & Jump */}
            {pageCount > 1 && (
              <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 text-xs text-slate-300">
                <button
                  type="button"
                  onClick={() => scrollToPage(activePage - 1)}
                  disabled={activePage === 0}
                  className="p-1 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300"
                  title="Previous page (←)"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="px-1.5 font-mono text-[11px]">
                  {activePage + 1} / {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => scrollToPage(activePage + 1)}
                  disabled={activePage >= pageCount - 1}
                  className="p-1 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300"
                  title="Next page (→)"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollToPage(pageCount - 1)}
                  className="ml-1.5 flex items-center gap-1 rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700 hover:text-white"
                  title="Jump to signature page"
                >
                  <ArrowDownToLine className="h-3 w-3 text-amber-400" />
                  Last Page
                </button>
              </div>
            )}

            {/* Zoom Controls */}
            <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800/80 px-1 py-0.5">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.7, s - 0.15))}
                className="p-1 text-slate-300 hover:text-white"
                title="Zoom out (-)"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs font-mono text-slate-300">{Math.round(scale * 100)}%</span>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(2.0, s + 0.15))}
                className="p-1 text-slate-300 hover:text-white"
                title="Zoom in (+)"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>

            {/* Direct Approve button (for View & Approve workflow) */}
            {onApprove && (
              <Button
                variant="success"
                size="sm"
                leftIcon={<Check className="h-3.5 w-3.5" />}
                isLoading={isApproving}
                onClick={() => {
                  onApprove();
                  onClose();
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                title="Approve directly after reviewing this document"
              >
                Approve
              </Button>
            )}

            {/* Stamping tools (only if signable) */}
            {isSignable && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Sparkles className="h-3.5 w-3.5 text-amber-400" />}
                  onClick={handleQuickStamp}
                  className="bg-amber-950/40 border-amber-600/40 text-amber-200 hover:bg-amber-900/50 hover:text-amber-100"
                  title="1-click place signature & date block onto bottom right of final page"
                >
                  Quick Stamp
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<PenTool className="h-3.5 w-3.5 text-emerald-400" />}
                  onClick={handleAddSignature}
                  className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
                >
                  Append Signature
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Type className="h-3.5 w-3.5 text-blue-400" />}
                  onClick={handleAddText}
                  className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
                >
                  Add Name & Date
                </Button>

                {items.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Trash2 className="h-3.5 w-3.5 text-rose-400" />}
                    onClick={() => setItems([])}
                    className="text-slate-400 hover:text-rose-300"
                  >
                    Clear
                  </Button>
                )}

                <Button
                  variant="success"
                  size="sm"
                  leftIcon={<CheckCircle2 className="h-4 w-4" />}
                  onClick={() => setConfirmOpen(true)}
                  disabled={items.length === 0}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow-sm"
                >
                  Save & Sign
                </Button>
              </>
            )}

            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Informational Banner when signing */}
        {isSignable && (
          <div className="flex items-center justify-between bg-emerald-950/70 border-b border-emerald-800/60 px-4 py-2 text-xs text-emerald-200">
            <span>
              <strong>DocuSign-style Signing:</strong> Click <strong>Append Signature</strong> or <strong>Add Name & Date</strong> above, then drag the boxes to the signature line at the bottom of the letter.
            </span>
            <span className="text-[11px] text-emerald-300/80">
              {items.length} item(s) placed
            </span>
          </div>
        )}

        {/* Document Pages Scroll Area */}
        <div
          ref={pagesContainerRef}
          className="flex-1 overflow-y-auto bg-slate-950/90 p-4 sm:p-8 scrollbar-thin"
        >
          {loading && (
            <div className="flex h-96 flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <p className="text-sm">Rendering document pages…</p>
            </div>
          )}

          {error && (
            <div className="mx-auto my-12 max-w-md rounded-lg border border-rose-800/40 bg-rose-950/40 p-5 text-center text-rose-200">
              <AlertCircle className="mx-auto mb-2 h-7 w-7 text-rose-400" />
              <p className="text-sm font-medium">{error}</p>
              <a
                href={`/api/proxy/documents/${documentId}/file`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-rose-300 underline"
              >
                Download PDF to view locally
              </a>
            </div>
          )}

          {!loading && !error && (
            <div className="mx-auto flex flex-col items-center gap-6">
              {Array.from({ length: pageCount }).map((_, pageIdx) => {
                const pageItems = items.filter((it) => it.pageIndex === pageIdx);

                return (
                  <div
                    key={`page-${pageIdx}`}
                    ref={(el) => {
                      pageRefs.current[pageIdx] = el;
                    }}
                    onMouseEnter={() => setActivePage(pageIdx)}
                    className="relative rounded-lg bg-white shadow-2xl overflow-hidden select-none"
                    style={{
                      // Minimum placeholder dimension before canvas renders
                      minWidth: 400 * scale,
                      minHeight: 560 * scale,
                    }}
                  >
                    {/* The rendered PDF page */}
                    <canvas className="block" />

                    {/* Stamping Overlay */}
                    {isSignable && (
                      <div className="absolute inset-0 pointer-events-auto">
                        {pageItems.map((item) => {
                          const isSelected = selectedItemId === item.id;

                          return (
                            <div
                              key={item.id}
                              onPointerDown={(e) => handleDragStart(e, item.id, pageIdx)}
                              className={cn(
                                'absolute group cursor-move touch-none select-none rounded border-2 transition-shadow',
                                isSelected
                                  ? 'border-emerald-500 bg-emerald-50/80 shadow-lg ring-2 ring-emerald-400/40'
                                  : 'border-dashed border-emerald-400/80 bg-white/70 hover:border-emerald-500',
                              )}
                              style={{
                                left: `${item.xPercent}%`,
                                top: `${item.yPercent}%`,
                                width: `${item.widthPercent}%`,
                                height: `${item.heightPercent}%`,
                              }}
                            >
                              {/* Top Bar with drag handle and remove */}
                              <div className="absolute -top-6 left-0 right-0 flex items-center justify-between rounded-t bg-slate-900/90 px-1.5 py-0.5 text-[9px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="flex items-center gap-1">
                                  <GripVertical className="h-2.5 w-2.5" />
                                  {item.type === 'signature' ? 'Signature' : 'Name & Date'}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveItem(item.id);
                                  }}
                                  className="text-slate-400 hover:text-rose-400"
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </div>

                              {/* Card Content */}
                              <div className="flex h-full w-full items-center justify-center p-1 overflow-hidden">
                                {item.type === 'signature' ? (
                                  sig?.imageUrl ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                      src={sig.imageUrl}
                                      alt="Signature stamp"
                                      className="max-h-full max-w-full object-contain pointer-events-none"
                                    />
                                  ) : (
                                    <span className="text-[10px] font-semibold text-emerald-800">
                                      Signature Stamp
                                    </span>
                                  )
                                ) : (
                                  <div className="w-full text-left font-sans text-slate-800 leading-tight">
                                    <p className="text-[11px] font-bold truncate">{fullName}</p>
                                    <p className="text-[9px] text-slate-600 truncate">{primaryRole}</p>
                                    <p className="text-[8px] font-mono text-slate-500 mt-0.5">
                                      Date: {new Date().toLocaleDateString('en-GB')}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Page Counter */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900 px-4 py-2 text-xs text-slate-400">
          <span>Active page: Page {activePage + 1} of {pageCount || 1}</span>
          <span className="text-[11px]">GBB Internal Audit Management System</span>
        </div>
      </div>

      {/* Signature Setup Modal if user doesn't have one */}
      {showDrawPad && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <h4 className="text-sm font-semibold text-slate-900">Create your signature</h4>
            <p className="mt-1 text-xs text-slate-500">
              Draw or upload your official signature. It will be saved to your profile and stamped on this document.
            </p>
            <div className="mt-4">
              <SignaturePad
                onChange={(blob, kind) => {
                  saveSignature.mutate({ blob, kind });
                }}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowDrawPad(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal before burning signature onto document */}
      {confirmOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <h4 className="text-sm font-semibold text-slate-900">Sign & finalize document</h4>
            <p className="mt-1 text-xs text-slate-600">
              This will permanently burn your signature and name onto the document at the selected position and complete your review step.
            </p>

            <div className="mt-4 space-y-3">
              <FormField label="Affirm your full name" required>
                <Input
                  value={affirmation}
                  onChange={(e) => setAffirmation(e.target.value)}
                  placeholder="Type your full name"
                />
              </FormField>

              <FormField label="Optional comment">
                <Textarea
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="e.g. Approved and signed as requested"
                />
              </FormField>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(false)}>
                Back to adjust
              </Button>
              <Button
                variant="success"
                size="sm"
                leftIcon={<Check className="h-4 w-4" />}
                isLoading={signMutation.isPending}
                disabled={!affirmation.trim()}
                onClick={() => signMutation.mutate()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                Confirm & Burn Signature
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
