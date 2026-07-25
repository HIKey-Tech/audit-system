import { attributeSampleSize, drawSample, invNormalCdf, mulberry32 } from '../utility/sampler.utility';

const population = Array.from({ length: 100 }, (_, i) => ({
  id: `TXN-${i + 1}`,
  amount: (i + 1) * 10,
}));

describe('sampler.utility', () => {
  it('mulberry32 is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('random sampling: same seed reproduces the exact same sample', () => {
    const first = drawSample(population, { method: 'random', sampleSize: 10, seed: 12345 });
    const second = drawSample(population, { method: 'random', sampleSize: 10, seed: 12345 });
    expect(first.rowNumbers).toEqual(second.rowNumbers);
    expect(first.selected).toEqual(second.selected);
    expect(first.selected).toHaveLength(10);
    // A different seed produces a different selection.
    const third = drawSample(population, { method: 'random', sampleSize: 10, seed: 54321 });
    expect(third.rowNumbers).not.toEqual(first.rowNumbers);
  });

  it('interval sampling selects evenly spaced rows within bounds', () => {
    const draw = drawSample(population, { method: 'interval', sampleSize: 10, seed: 7 });
    expect(draw.selected).toHaveLength(10);
    const gaps = new Set(draw.rowNumbers.slice(1).map((n, i) => n - draw.rowNumbers[i]));
    expect(gaps.size).toBe(1); // constant interval
    expect(Math.max(...draw.rowNumbers)).toBeLessThanOrEqual(100);
  });

  it('high-value sampling picks the largest amounts', () => {
    const draw = drawSample(population, {
      method: 'high_value',
      sampleSize: 5,
      seed: 1,
      valueColumn: 'amount',
    });
    expect(draw.selected.map((r) => r.amount)).toEqual([960, 970, 980, 990, 1000]);
  });

  it('high-value threshold keeps only rows at or above the threshold', () => {
    const draw = drawSample(population, {
      method: 'high_value',
      sampleSize: 50,
      seed: 1,
      valueColumn: 'amount',
      threshold: 950,
    });
    expect(draw.selected).toHaveLength(6); // 950..1000
    expect(draw.selected.every((r) => (r.amount as number) >= 950)).toBe(true);
  });

  it('rejects invalid parameters with readable errors', () => {
    expect(() => drawSample([], { method: 'random', sampleSize: 5, seed: 1 })).toThrow('Population is empty');
    expect(() => drawSample(population, { method: 'random', sampleSize: 100, seed: 1 })).toThrow('smaller than the population');
    expect(() => drawSample(population, { method: 'high_value', sampleSize: 5, seed: 1 })).toThrow('valueColumn is required');
    expect(() =>
      drawSample(population, { method: 'high_value', sampleSize: 5, seed: 1, valueColumn: 'nope' }),
    ).toThrow('not found');
  });
});

describe('attributeSampleSize', () => {
  it('invNormalCdf recovers the standard z-scores', () => {
    expect(invNormalCdf(0.975)).toBeCloseTo(1.95996, 4); // two-sided 95%
    expect(invNormalCdf(0.995)).toBeCloseTo(2.57583, 4); // two-sided 99%
  });

  it('zero-expected-error formula matches the audit textbook value', () => {
    // n = ln(1-0.95)/ln(1-0.05) ≈ 58.4 → 59 for a large population.
    const r = attributeSampleSize({ populationSize: 10_000_000, confidenceLevel: 0.95, tolerableRate: 0.05 });
    expect(r.sampleSize).toBe(59);
  });

  it('applies finite-population correction (smaller N → smaller n)', () => {
    const big = attributeSampleSize({ populationSize: 10_000_000, confidenceLevel: 0.95, tolerableRate: 0.05 });
    const small = attributeSampleSize({ populationSize: 200, confidenceLevel: 0.95, tolerableRate: 0.05 });
    expect(small.sampleSize).toBeLessThan(big.sampleSize);
  });

  it('higher confidence requires a larger sample', () => {
    const c90 = attributeSampleSize({ populationSize: 5000, confidenceLevel: 0.9, tolerableRate: 0.05 });
    const c99 = attributeSampleSize({ populationSize: 5000, confidenceLevel: 0.99, tolerableRate: 0.05 });
    expect(c99.sampleSize).toBeGreaterThan(c90.sampleSize);
  });

  it('uses the normal approximation when a deviation is expected', () => {
    const r = attributeSampleSize({ populationSize: 10_000_000, confidenceLevel: 0.95, tolerableRate: 0.1, expectedRate: 0.02 });
    // z²·p(1-p)/(e-p)² = 3.8415·0.0196/0.0064 ≈ 11.76 → 12
    expect(r.sampleSize).toBe(12);
    expect(r.zScore).toBeCloseTo(1.95996, 4);
  });

  it('never exceeds the population (census cap)', () => {
    const r = attributeSampleSize({ populationSize: 20, confidenceLevel: 0.99, tolerableRate: 0.02 });
    expect(r.sampleSize).toBeLessThanOrEqual(20);
  });

  it('rejects invalid parameters', () => {
    expect(() => attributeSampleSize({ populationSize: 0, confidenceLevel: 0.95, tolerableRate: 0.05 })).toThrow('Population size');
    expect(() => attributeSampleSize({ populationSize: 100, confidenceLevel: 1, tolerableRate: 0.05 })).toThrow('Confidence level');
    expect(() => attributeSampleSize({ populationSize: 100, confidenceLevel: 0.95, tolerableRate: 0 })).toThrow('Tolerable rate');
    expect(() =>
      attributeSampleSize({ populationSize: 100, confidenceLevel: 0.95, tolerableRate: 0.05, expectedRate: 0.05 }),
    ).toThrow('smaller than the tolerable');
  });
});
