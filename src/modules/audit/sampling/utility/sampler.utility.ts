// Pure, deterministic sampling logic. Kept free of I/O so it is unit-testable
// and the drawn sample is reproducible from (population, method, params, seed) —
// the reproducibility is what makes the sample defensible to a reviewer.

export type SamplingMethod = 'random' | 'interval' | 'high_value';

export interface SamplingParams {
  method: SamplingMethod;
  sampleSize: number;
  seed: number;
  /** Column holding the monetary/numeric value — required for high_value. */
  valueColumn?: string;
  /** high_value: select every row with value >= threshold (capped at sampleSize by value). */
  threshold?: number;
}

export interface SampleDraw {
  /** Selected rows, in selection order. */
  selected: Record<string, unknown>[];
  /** 1-based population row numbers of the selection (for the methodology write-up). */
  rowNumbers: number[];
  /** Human-readable description of how the selection was made. */
  methodDescription: string;
}

// ── Attribute sample-size planning ─────────────────────────────
// Determines how many items to test for a target confidence and tolerable
// deviation rate, so the sample size is derived, not guessed. Pure and
// deterministic; the description records the formula for the working paper.

export interface AttributeSampleSizeParams {
  /** Population size N (finite-population correction is applied). */
  populationSize: number;
  /** Desired confidence level, 0<c<1 (e.g. 0.95). */
  confidenceLevel: number;
  /** Tolerable deviation rate, 0<e<=1 (e.g. 0.05). */
  tolerableRate: number;
  /** Expected deviation rate, 0<=p<tolerable (default 0). */
  expectedRate?: number;
}

export interface AttributeSampleSizeResult {
  sampleSize: number;
  /** Two-sided z used for the normal approximation (reference; unused at p=0). */
  zScore: number;
  methodDescription: string;
}

/**
 * Inverse standard-normal CDF (Acklam's rational approximation, |err| < 1.15e-9).
 * Returns z such that Φ(z) = p, for 0 < p < 1.
 */
export const invNormalCdf = (p: number): number => {
  if (!(p > 0 && p < 1)) throw new Error('invNormalCdf expects 0 < p < 1');
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  const phigh = 1 - plow;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= phigh) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
};

/**
 * Attribute-sampling sample size with finite-population correction.
 * - expected deviation 0 → exact zero-error formula n0 = ln(1−c)/ln(1−e).
 * - expected deviation > 0 → normal approximation n0 = z²·p(1−p)/(e−p)².
 * Throws plain `Error` on invalid parameters (the service maps it to a 400).
 */
export const attributeSampleSize = (params: AttributeSampleSizeParams): AttributeSampleSizeResult => {
  const N = Math.floor(params.populationSize);
  const c = params.confidenceLevel;
  const e = params.tolerableRate;
  const expected = params.expectedRate ?? 0;

  if (!Number.isFinite(N) || N < 1) throw new Error('Population size must be at least 1');
  if (!(c > 0 && c < 1)) throw new Error('Confidence level must be between 0 and 1 (e.g. 0.95)');
  if (!(e > 0 && e <= 1)) throw new Error('Tolerable rate must be between 0 and 1');
  if (!(expected >= 0 && expected < 1)) throw new Error('Expected rate must be between 0 and 1');
  if (expected >= e) throw new Error('Expected rate must be smaller than the tolerable rate');

  const z = invNormalCdf(1 - (1 - c) / 2);
  let n0: number;
  let formula: string;
  if (expected === 0) {
    n0 = Math.log(1 - c) / Math.log(1 - e);
    formula = `Zero-expected-error attribute sampling: n0 = ln(1−${c}) / ln(1−${e}) = ${n0.toFixed(2)}`;
  } else {
    const precision = e - expected;
    n0 = (z * z * expected * (1 - expected)) / (precision * precision);
    formula = `Normal-approximation attribute sampling: n0 = z²·p(1−p)/(e−p)² with two-sided z=${z.toFixed(4)} at ${(c * 100).toFixed(0)}% confidence, p=${expected}, e=${e} → ${n0.toFixed(2)}`;
  }

  const corrected = n0 / (1 + (n0 - 1) / N); // finite-population correction
  const sampleSize = Math.min(Math.max(1, Math.ceil(corrected)), N);
  const census = sampleSize >= N ? ' Sample meets or exceeds the population — test 100% (census).' : '';

  return {
    sampleSize,
    zScore: Number(z.toFixed(4)),
    methodDescription: `${formula}; finite-population correction for N=${N} → n=${sampleSize}.${census}`,
  };
};

/** Mulberry32 — tiny seeded PRNG; same seed always yields the same sequence. */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  const parsed = parseFloat(String(value ?? '').replace(/[,\s₦$€£]/g, ''));
  return Number.isFinite(parsed) ? parsed : NaN;
};

const pick = (rows: Record<string, unknown>[], indices: number[]): SampleDraw => ({
  selected: indices.map((i) => rows[i]),
  rowNumbers: indices.map((i) => i + 1),
  methodDescription: '',
});

/**
 * Draw a sample from a population. Throws plain `Error` with a user-readable
 * message on invalid parameters (the service maps it to a 400).
 */
export const drawSample = (rows: Record<string, unknown>[], params: SamplingParams): SampleDraw => {
  const population = rows.length;
  if (population === 0) throw new Error('Population is empty');
  const n = Math.floor(params.sampleSize);
  if (!Number.isFinite(n) || n < 1) throw new Error('Sample size must be at least 1');
  if (n >= population) throw new Error(`Sample size (${n}) must be smaller than the population (${population})`);

  const rand = mulberry32(params.seed);

  if (params.method === 'random') {
    // Seeded Fisher-Yates over the index array, take the first n.
    const indices = Array.from({ length: population }, (_, i) => i);
    for (let i = population - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const chosen = indices.slice(0, n).sort((a, b) => a - b);
    const draw = pick(rows, chosen);
    draw.methodDescription = `Simple random sampling (seeded Fisher–Yates shuffle, seed ${params.seed}); ${n} of ${population} rows selected.`;
    return draw;
  }

  if (params.method === 'interval') {
    const interval = Math.floor(population / n);
    const start = Math.floor(rand() * interval);
    const chosen: number[] = [];
    for (let i = 0; i < n; i += 1) chosen.push(start + i * interval);
    const draw = pick(rows, chosen);
    draw.methodDescription = `Systematic interval sampling: every ${interval}th row starting at row ${start + 1} (seeded random start, seed ${params.seed}); ${n} of ${population} rows selected.`;
    return draw;
  }

  // high_value
  const column = params.valueColumn;
  if (!column) throw new Error('valueColumn is required for high-value sampling');
  if (!(column in rows[0])) throw new Error(`Column "${column}" not found in the population file`);
  const valued = rows
    .map((row, index) => ({ index, value: toNumber(row[column]) }))
    .filter((entry) => Number.isFinite(entry.value));
  if (valued.length === 0) throw new Error(`Column "${column}" contains no numeric values`);

  let candidates = valued;
  if (params.threshold !== undefined) {
    candidates = valued.filter((entry) => entry.value >= params.threshold!);
    if (candidates.length === 0) {
      throw new Error(`No rows have "${column}" >= ${params.threshold}`);
    }
  }
  const chosen = candidates
    .sort((a, b) => b.value - a.value)
    .slice(0, n)
    .map((entry) => entry.index)
    .sort((a, b) => a - b);
  const draw = pick(rows, chosen);
  draw.methodDescription =
    params.threshold !== undefined
      ? `High-value selection: rows with "${column}" >= ${params.threshold}, highest first, capped at ${n} (${chosen.length} of ${population} rows selected).`
      : `High-value selection: top ${chosen.length} of ${population} rows by "${column}".`;
  return draw;
};
