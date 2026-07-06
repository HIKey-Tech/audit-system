'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders working-paper (and other auditor-authored) Markdown with GFM tables.
 * Styling is scoped here so every render site looks identical; plain text with
 * no Markdown syntax renders as ordinary paragraphs.
 */
export const Markdown = ({ content }: { content: string }): JSX.Element => (
  <div className="text-sm leading-relaxed text-text-primary [&>*+*]:mt-2">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-base font-bold">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold">{children}</h3>,
        h4: ({ children }) => <h4 className="text-xs font-semibold">{children}</h4>,
        p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
        ul: ({ children }) => <ul className="list-disc space-y-0.5 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal space-y-0.5 pl-5">{children}</ol>,
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">
            {children}
          </a>
        ),
        code: ({ children }) => (
          <code className="rounded bg-surface-alt px-1 py-0.5 font-mono text-xs">{children}</code>
        ),
        pre: ({ children }) => (
          <pre className="overflow-x-auto rounded-md bg-surface-alt p-3 font-mono text-xs">{children}</pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-border pl-3 text-text-secondary">{children}</blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-border bg-surface-alt px-2 py-1.5 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => <td className="border border-border px-2 py-1.5 align-top">{children}</td>,
        hr: () => <hr className="border-border" />,
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);
