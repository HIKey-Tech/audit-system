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
/** Mulberry32 — tiny seeded PRNG; same seed always yields the same sequence. */
export declare const mulberry32: (seed: number) => (() => number);
/**
 * Draw a sample from a population. Throws plain `Error` with a user-readable
 * message on invalid parameters (the service maps it to a 400).
 */
export declare const drawSample: (rows: Record<string, unknown>[], params: SamplingParams) => SampleDraw;
//# sourceMappingURL=sampler.utility.d.ts.map