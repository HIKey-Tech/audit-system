'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, CircleHelp, Search, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { HelpMarkdown } from '@/components/help/HelpMarkdown';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useSession } from '@/components/providers/AuthProvider';
import { gettingStartedKey } from '@/components/dashboard/GettingStarted';
import { excerpt, getHelpArticle, HELP_ARTICLES, searchHelp, type HelpArticle } from '@/lib/help/search';

interface Task {
  label: string;
  id: string;
}

const COMMON_TASKS: Task[] = [
  { label: 'Sign in or reset my password', id: 'signin' },
  { label: 'Find my way around', id: 'nav' },
  { label: 'Add my signature', id: 'signature' },
  { label: 'Approve something waiting for me', id: 'approve-do' },
  { label: 'See the full audit from start to finish', id: 'ch-example' },
];

const AUDITOR_TASKS: Task[] = [
  { label: 'Start a new audit', id: 'wizard' },
  { label: 'Test controls and record results', id: 'checklists' },
  { label: 'Write and submit a working paper', id: 'wp' },
  { label: 'Ask the auditee for documents', id: 'evreq' },
  { label: 'Raise a finding', id: 'finding-raise' },
  { label: 'Draw an audit sample', id: 'sampling' },
  { label: 'Write and issue the review', id: 'review-flow' },
];

const AUDITEE_TASKS: Task[] = [
  { label: 'What do I need to do as an auditee?', id: 'auditee' },
  { label: 'Respond to a finding', id: 'auditee-respond' },
  { label: 'Upload a document the auditors asked for', id: 'auditee-docs' },
];

const ADMIN_TASKS: Task[] = [
  { label: 'Create a user or change a role', id: 'users' },
  { label: 'Edit what a role can do', id: 'settings' },
  { label: 'Change approval chains and lifecycle rules', id: 'cust' },
  { label: 'Choose the right audit type', id: 'types' },
];

const EXAMPLE_QUESTIONS = [
  'How do I raise a finding?',
  'Why can’t I approve my own request?',
  'How do I draw a sample?',
  'What does Quality Assurance mean?',
];

const HelpCenterInner = (): JSX.Element => {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { isAuditee, isFieldAuditor, canManageAuditProgramme, hasPermission } = usePermissions();
  const session = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [restored, setRestored] = useState(false);

  const articleId = params?.get('a') ?? '';
  const urlQuery = params?.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);

  const article = useMemo(() => getHelpArticle(articleId), [articleId]);
  const results = useMemo(() => (query.trim().length >= 2 ? searchHelp(query, 10) : []), [query]);

  // Keep the box in sync when the link changes (back/forward, palette links).
  useEffect(() => setQuery(urlQuery), [urlQuery]);

  // Focus the box when landing without an article — the page's main job is answering a question.
  useEffect(() => {
    if (!articleId) inputRef.current?.focus();
  }, [articleId]);

  // Scroll to the top of the content area whenever the article changes.
  useEffect(() => {
    if (articleId) window.scrollTo({ top: 0 });
  }, [articleId]);

  const go = (next: { a?: string; q?: string }) => {
    const sp = new URLSearchParams();
    if (next.a) sp.set('a', next.a);
    if (next.q) sp.set('q', next.q);
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : (pathname ?? '/help/center'));
  };

  const chapters = useMemo(() => {
    const map = new Map<string, { title: string; num: string; items: HelpArticle[] }>();
    for (const a of HELP_ARTICLES) {
      const key = a.chapter;
      if (!map.has(key)) map.set(key, { title: a.chapter, num: a.chapterNum, items: [] });
      if (!a.isIntro) map.get(key)!.items.push(a);
    }
    return [...map.values()];
  }, []);

  const siblings = useMemo(() => {
    if (!article) return { prev: undefined, next: undefined };
    const i = HELP_ARTICLES.findIndex((a) => a.id === article.id);
    return { prev: HELP_ARTICLES[i - 1], next: HELP_ARTICLES[i + 1] };
  }, [article]);

  const roleTasks: Task[] = [
    ...(isAuditee ? AUDITEE_TASKS : []),
    ...(isFieldAuditor || canManageAuditProgramme ? AUDITOR_TASKS : []),
    ...(hasPermission('user:read') || hasPermission('settings:read') ? ADMIN_TASKS : []),
  ];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    go({ q: query.trim() });
  };

  return (
    <div>
      <PageHeader
        title="Help Centre"
        subtitle="Ask a question in your own words, or browse the guide. Every answer comes with step-by-step screenshots."
        actions={
          <Link
            href="/help"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-alt"
          >
            <CircleHelp className="h-3.5 w-3.5" /> How IAMS works
          </Link>
        }
      />

      <form onSubmit={submit} className="mb-6" role="search">
        <label htmlFor="help-q" className="sr-only">
          Ask a question or search the help
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" aria-hidden />
          <input
            id="help-q"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question — e.g. “How do I raise a finding?”"
            className="h-14 w-full rounded-xl border border-border bg-white pl-12 pr-28 text-base shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            autoComplete="off"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            Search
          </button>
        </div>
      </form>

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Guide navigation */}
        <nav aria-label="Guide contents" className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 scrollbar-thin">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              <BookOpen className="h-3.5 w-3.5" /> Guide
            </p>
            <ul className="space-y-3">
              {chapters.map((c) => (
                <li key={c.title}>
                  <button
                    type="button"
                    onClick={() => go({ a: HELP_ARTICLES.find((a) => a.chapter === c.title)?.id })}
                    className="text-left text-xs font-semibold text-text-primary hover:text-primary"
                  >
                    {c.num ? `${c.num}. ` : ''}
                    {c.title}
                  </button>
                  {article?.chapter === c.title && c.items.length > 0 && (
                    <ul className="mt-1 space-y-0.5 border-l border-border pl-3">
                      {c.items.map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => go({ a: a.id })}
                            className={cn(
                              'block w-full truncate py-0.5 text-left text-xs hover:text-primary',
                              a.id === article.id ? 'font-semibold text-primary' : 'text-text-secondary',
                            )}
                          >
                            {a.num} {a.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="min-w-0">
          {/* Search results */}
          {urlQuery && !article && (
            <section aria-live="polite">
              <p className="mb-3 text-sm text-text-secondary">
                {results.length === 0
                  ? `No guide pages matched “${urlQuery}”. Try fewer or different words.`
                  : `Best answers for “${urlQuery}”`}
              </p>
              <ul className="space-y-2">
                {searchHelp(urlQuery, 10).map(({ article: a }, i) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => go({ a: a.id, q: urlQuery })}
                      className={cn(
                        'group w-full rounded-lg border bg-white px-4 py-3 text-left transition hover:border-primary hover:shadow-sm',
                        i === 0 ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {i === 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            <Sparkles className="h-3 w-3" /> Best match
                          </span>
                        )}
                        <span className="text-sm font-semibold text-text-primary group-hover:text-primary">
                          {a.num} {a.title}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[11px] text-text-muted">Chapter {a.chapterNum || ''} · {a.chapter}</span>
                      <span className="mt-1 block text-xs text-text-secondary">{excerpt(a, urlQuery)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Article */}
          {article && (
            <article>
              <div className="mb-1 flex flex-wrap items-center gap-1 text-xs text-text-secondary">
                <button type="button" onClick={() => go({})} className="hover:text-primary">
                  Help Centre
                </button>
                <ChevronRight className="h-3 w-3" aria-hidden />
                <span>{article.chapter}</span>
                {urlQuery && (
                  <>
                    <span className="mx-1">·</span>
                    <button type="button" onClick={() => go({ q: urlQuery })} className="text-primary hover:underline">
                      Back to results for “{urlQuery}”
                    </button>
                  </>
                )}
              </div>
              <h2 className="mb-4 text-2xl font-semibold tracking-tight text-text-primary">
                {article.num && <span className="mr-2 text-accent">{article.num}</span>}
                {article.title}
              </h2>
              <Card padded>
                <HelpMarkdown content={article.body || '*This chapter is organised into the sections listed on the left.*'} />
              </Card>
              <div className="mt-4 flex items-center justify-between gap-3">
                {siblings.prev ? (
                  <button
                    type="button"
                    onClick={() => go({ a: siblings.prev!.id })}
                    className="inline-flex max-w-[48%] items-center gap-1.5 truncate rounded-md border border-border bg-white px-3 py-2 text-xs font-medium hover:border-primary hover:text-primary"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{siblings.prev.title}</span>
                  </button>
                ) : (
                  <span />
                )}
                {siblings.next && (
                  <button
                    type="button"
                    onClick={() => go({ a: siblings.next!.id })}
                    className="inline-flex max-w-[48%] items-center gap-1.5 truncate rounded-md border border-border bg-white px-3 py-2 text-xs font-medium hover:border-primary hover:text-primary"
                  >
                    <span className="truncate">{siblings.next.title}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                  </button>
                )}
              </div>
              <p className="mt-6 text-center text-[11px] text-text-muted">
                Can’t find what you need? Ask your audit manager or system administrator.
              </p>
            </article>
          )}

          {/* Landing */}
          {!article && !urlQuery && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-2 text-sm font-semibold text-text-primary">Try asking</h2>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setQuery(q);
                        go({ q });
                      }}
                      className="rounded-full border border-border bg-white px-3 py-1.5 text-xs text-text-secondary hover:border-primary hover:text-primary"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {roleTasks.length > 0 && (
                <TaskList title="For your role" tasks={roleTasks} onPick={(id) => go({ a: id })} />
              )}
              <TaskList title="Everyone" tasks={COMMON_TASKS} onPick={(id) => go({ a: id })} />

              <div>
                <h2 className="mb-2 text-sm font-semibold text-text-primary">Browse the guide</h2>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {chapters.map((c) => (
                    <button
                      key={c.title}
                      type="button"
                      onClick={() => go({ a: HELP_ARTICLES.find((a) => a.chapter === c.title)?.id })}
                      className="rounded-lg border border-border bg-white px-4 py-3 text-left hover:border-primary hover:shadow-sm"
                    >
                      <span className="block text-sm font-semibold text-text-primary">
                        {c.num ? `${c.num}. ` : ''}
                        {c.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-text-muted">{c.items.length} topics</span>
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-text-muted">
                <button
                  type="button"
                  className="mr-3 text-primary hover:underline"
                  onClick={() => {
                    try {
                      window.localStorage.removeItem(gettingStartedKey(session.id));
                    } catch {
                      /* ignore */
                    }
                    setRestored(true);
                  }}
                >
                  {restored ? 'Checklist restored — see your Home page' : 'Show the getting-started checklist on Home again'}
                </button>
                Tip: press <kbd className="rounded border border-border bg-white px-1 py-0.5 text-[10px]">?</kbd> anywhere to see keyboard shortcuts.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TaskList = ({
  title,
  tasks,
  onPick,
}: {
  title: string;
  tasks: Task[];
  onPick: (id: string) => void;
}): JSX.Element => (
  <div>
    <h2 className="mb-2 text-sm font-semibold text-text-primary">{title}</h2>
    <ul className="grid gap-2 sm:grid-cols-2">
      {tasks.map((t) => (
        <li key={t.id + t.label}>
          <button
            type="button"
            onClick={() => onPick(t.id)}
            className="flex w-full items-center justify-between rounded-lg border border-border bg-white px-4 py-2.5 text-left text-sm hover:border-primary hover:text-primary"
          >
            <span>{t.label}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  </div>
);

export default function HelpCenterPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <HelpCenterInner />
    </Suspense>
  );
}
