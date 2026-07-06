"use strict";
// Pure, deterministic sampling logic. Kept free of I/O so it is unit-testable
// and the drawn sample is reproducible from (population, method, params, seed) —
// the reproducibility is what makes the sample defensible to a reviewer.
Object.defineProperty(exports, "__esModule", { value: true });
exports.drawSample = exports.mulberry32 = void 0;
/** Mulberry32 — tiny seeded PRNG; same seed always yields the same sequence. */
const mulberry32 = (seed) => {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};
exports.mulberry32 = mulberry32;
const toNumber = (value) => {
    if (typeof value === 'number')
        return value;
    const parsed = parseFloat(String(value ?? '').replace(/[,\s₦$€£]/g, ''));
    return Number.isFinite(parsed) ? parsed : NaN;
};
const pick = (rows, indices) => ({
    selected: indices.map((i) => rows[i]),
    rowNumbers: indices.map((i) => i + 1),
    methodDescription: '',
});
/**
 * Draw a sample from a population. Throws plain `Error` with a user-readable
 * message on invalid parameters (the service maps it to a 400).
 */
const drawSample = (rows, params) => {
    const population = rows.length;
    if (population === 0)
        throw new Error('Population is empty');
    const n = Math.floor(params.sampleSize);
    if (!Number.isFinite(n) || n < 1)
        throw new Error('Sample size must be at least 1');
    if (n >= population)
        throw new Error(`Sample size (${n}) must be smaller than the population (${population})`);
    const rand = (0, exports.mulberry32)(params.seed);
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
        const chosen = [];
        for (let i = 0; i < n; i += 1)
            chosen.push(start + i * interval);
        const draw = pick(rows, chosen);
        draw.methodDescription = `Systematic interval sampling: every ${interval}th row starting at row ${start + 1} (seeded random start, seed ${params.seed}); ${n} of ${population} rows selected.`;
        return draw;
    }
    // high_value
    const column = params.valueColumn;
    if (!column)
        throw new Error('valueColumn is required for high-value sampling');
    if (!(column in rows[0]))
        throw new Error(`Column "${column}" not found in the population file`);
    const valued = rows
        .map((row, index) => ({ index, value: toNumber(row[column]) }))
        .filter((entry) => Number.isFinite(entry.value));
    if (valued.length === 0)
        throw new Error(`Column "${column}" contains no numeric values`);
    let candidates = valued;
    if (params.threshold !== undefined) {
        candidates = valued.filter((entry) => entry.value >= params.threshold);
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
exports.drawSample = drawSample;
//# sourceMappingURL=sampler.utility.js.map