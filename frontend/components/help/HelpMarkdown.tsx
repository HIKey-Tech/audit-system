'use client';

import { useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X } from 'lucide-react';

/**
 * Renders a Help Centre article: GFM tables, numbered steps, callout
 * blockquotes, in-app links (client navigation) and click-to-enlarge screenshots.
 */
export const HelpMarkdown = ({ content }: { content: string }): JSX.Element => {
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);

  return (
    <div className="text-sm leading-relaxed text-text-primary [&>*+*]:mt-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h3: ({ children }) => (
            <h3 className="!mt-6 text-base font-semibold text-text-primary">{children}</h3>
          ),
          h4: ({ children }) => <h4 className="!mt-4 text-sm font-semibold">{children}</h4>,
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
          a: ({ children, href }) =>
            href?.startsWith('/') ? (
              <Link href={href} className="font-medium text-primary underline-offset-2 hover:underline">
                {children}
              </Link>
            ) : (
              <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">
                {children}
              </a>
            ),
          code: ({ children }) => (
            <code className="rounded bg-surface-alt px-1 py-0.5 font-mono text-xs">{children}</code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="rounded-r-md border-l-4 border-primary bg-primary/5 px-4 py-2 text-text-primary [&>*+*]:mt-1.5">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border bg-surface-alt px-3 py-2 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border px-3 py-2 align-top last:border-b-0">{children}</td>
          ),
          img: ({ src, alt }) => {
            const url = typeof src === 'string' ? src : '';
            return (
              <figure className="!my-4">
                <button
                  type="button"
                  onClick={() => setZoom({ src: url, alt: alt ?? '' })}
                  className="block w-full cursor-zoom-in overflow-hidden rounded-md border border-border shadow-sm transition-shadow hover:shadow-md"
                  aria-label={`Enlarge screenshot: ${alt ?? ''}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={alt ?? ''} loading="lazy" className="block w-full" />
                </button>
                {alt && <figcaption className="mt-1 text-center text-[11px] italic text-text-muted">{alt}</figcaption>}
              </figure>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>

      {zoom && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot"
          onClick={() => setZoom(null)}
          onKeyDown={(e) => e.key === 'Escape' && setZoom(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-text-primary hover:bg-white"
            onClick={() => setZoom(null)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom.src} alt={zoom.alt} className="max-h-full max-w-full rounded-md bg-white shadow-2xl" />
        </div>
      )}
    </div>
  );
};
