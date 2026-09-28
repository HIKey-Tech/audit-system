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
export declare const invNormalCdf: (p: number) => number;
/**
 * Attribute-sampling sample size with finite-population correction.
 * - expected deviation 0 → exact zero-error formula n0 = ln(1−c)/ln(1−e).
 * - expected deviation > 0 → normal approximation n0 = z²·p(1−p)/(e−p)².
 * Throws plain `Error` on invalid parameters (the service maps it to a 400).
 */
export declare const attributeSampleSize: (params: AttributeSampleSizeParams) => AttributeSampleSizeResult;
/** Mulberry32 — tiny seeded PRNG; same seed always yields the same sequence. */
export declare const mulberry32: (seed: number) => (() => number);
/**
 * Draw a sample from a population. Throws plain `Error` with a user-readable
 * message on invalid parameters (the service maps it to a 400).
 */
export declare const drawSample: (rows: Record<string, unknown>[], params: SamplingParams) => SampleDraw;
//# sourceMappingURL=sampler.utility.d.ts.map