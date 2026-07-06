import { drawSample, mulberry32 } from '../utility/sampler.utility';

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
