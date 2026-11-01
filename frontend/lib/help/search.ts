import data from './articles.json';

/**
 * Offline help search. The articles are generated from the user manual
 * (manual/export-help.js) — no network call, no AI, so answers are always the
 * documented ones. Keep this file dependency-free; it is also used by the
 * command palette.
 */
export interface HelpArticle {
  id: string;
  chapter: string;
  chapterNum: string;
  num: string;
  title: string;
  isIntro: boolean;
  body: string;
  /** Plain text (no markdown/images) used for matching. */
  text: string;
  /** Everyday wording for the topic (curated), weighted like the title. */
  keywords: string;
}

interface HelpData {
  aliases: Record<string, string>;
  articles: HelpArticle[];
}

const DATA = data as HelpData;
export const HELP_ARTICLES: HelpArticle[] = DATA.articles;

const BY_ID = new Map(HELP_ARTICLES.map((a) => [a.id, a]));

/** Look up an article by id, following sub-heading aliases. */
export const getHelpArticle = (id: string | null | undefined): HelpArticle | undefined => {
  if (!id) return undefined;
  return BY_ID.get(id) ?? BY_ID.get(DATA.aliases[id] ?? '');
};

const STOP = new Set(
  ('a an the and or of to in on for with from by is are was were be been do does did can could should would will ' +
    'how what where when why which who whom i me my we our you your it its this that these those as at into about ' +
    'please need want would like get make find show tell there here if so than then').split(' '),
);

/** Words people use that the manual words differently. */
const SYNONYMS: Record<string, string[]> = {
  signoff: ['approve', 'sign'],
  sign: ['approve', 'signature'],
  fix: ['remediation', 'remediate'],
  delete: ['remove', 'deactivate'],
  remove: ['delete', 'deactivate'],
  add: ['create', 'new'],
  new: ['create', 'add'],
  password: ['credentials', 'reset'],
  login: ['sign', 'signing'],
  logout: ['sign', 'out'],
  report: ['review'],
  issue: ['issued', 'raise'],
  upload: ['attach', 'evidence'],
  document: ['evidence', 'file'],
  user: ['users', 'account'],
  access: ['permission', 'role'],
  permission: ['role', 'access'],
  who: ['role'],
};

const stem = (w: string): string => {
  let s = w;
  for (const suf of ['ing', 'ed', 'es', 's']) {
    if (s.length > suf.length + 3 && s.endsWith(suf)) {
      s = s.slice(0, -suf.length);
      break;
    }
  }
  return s;
};

const tokenise = (q: string): string[] => {
  const raw = q
    .toLowerCase()
    .replace(/sign[- ]?off/g, 'signoff')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
  const out = new Set<string>();
  for (const w of raw) {
    out.add(stem(w));
    for (const syn of SYNONYMS[w] ?? []) out.add(stem(syn));
  }
  return [...out];
};

const countOf = (hay: string, needle: string): number => {
  let n = 0;
  let i = hay.indexOf(needle);
  while (i !== -1 && n < 6) {
    n += 1;
    i = hay.indexOf(needle, i + needle.length);
  }
  return n;
};

export interface HelpHit {
  article: HelpArticle;
  score: number;
}

export const searchHelp = (query: string, limit = 8): HelpHit[] => {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const tokens = tokenise(q);
  if (tokens.length === 0) return [];

  const hits: HelpHit[] = [];
  for (const article of HELP_ARTICLES) {
    const title = article.title.toLowerCase();
    const chapter = article.chapter.toLowerCase();
    const text = article.text.toLowerCase();
    const kws = (article.keywords ?? '').toLowerCase();
    // Long sections mention everything; scale their body matches down so focused sections win.
    const lenNorm = 1 / Math.sqrt(1 + text.length / 2500);
    let score = 0;
    let matched = 0;
    for (const t of tokens) {
      let s = 0;
      if (title.includes(t)) s += 8;
      if (chapter.includes(t)) s += 2;
      if (kws.includes(t)) s += 7;
      s += countOf(text, t) * 1.2 * lenNorm;
      if (s > 0) matched += 1;
      score += s;
    }
    if (matched === 0) continue;
    // Reward articles that match most of the distinct words asked.
    score *= 0.5 + matched / tokens.length;
    if (title.includes(q)) score += 12;
    else if (kws.includes(q)) score += 8;
    else if (text.includes(q)) score += 4;
    if (article.isIntro) score *= 0.6;
    hits.push({ article, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
};

/** A short excerpt around the first matched word, for result lists. */
export const excerpt = (article: HelpArticle, query: string, length = 150): string => {
  const tokens = tokenise(query);
  const text = article.text;
  const lower = text.toLowerCase();
  let at = -1;
  for (const t of tokens) {
    const i = lower.indexOf(t);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  const start = Math.max(0, (at === -1 ? 0 : at) - 40);
  const snippet = text.slice(start, start + length).trim();
  return `${start > 0 ? '…' : ''}${snippet}${start + length < text.length ? '…' : ''}`;
};
