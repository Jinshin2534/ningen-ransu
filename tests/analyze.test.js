import { describe, it, expect } from 'vitest';
import { analyze, nullDistribution, ALPHA } from '../src/lib/analyze.js';
import { mulberry32, randomBits } from '../src/lib/rng.js';
import { simulateHuman } from '../src/lib/human.js';
import { holm } from '../src/lib/stats.js';

const OPTS = { nullSamples: 1000 };

describe('analyze の形', () => {
  it('6つの検定を返し、補正後p値は Holm と一致する', () => {
    const r = analyze(simulateHuman(200, mulberry32(1)), OPTS);
    expect(r.tests.map((t) => t.id)).toEqual(['prediction', 'alternation', 'longest', 'serial', 'compression', 'frequency']);
    const adj = holm(r.tests.map((t) => t.p));
    r.tests.forEach((t, i) => expect(t.pAdj).toBeCloseTo(adj[i], 12));
    for (const t of r.tests) {
      expect(t.p).toBeGreaterThan(0);
      expect(t.p).toBeLessThanOrEqual(1);
      expect(t.pAdj).toBeGreaterThanOrEqual(t.p);
    }
  });
  it('20手未満は検定しない', () => {
    expect(() => analyze([0, 1, 0], OPTS)).toThrow();
  });
  it('帰無分布は種が同じなら同じで、キャッシュされる', () => {
    const a = nullDistribution(200, 300, 1);
    const b = nullDistribution(200, 300, 1);
    expect(a).toBe(b);
    expect(a.compression.length).toBe(300);
  });
  it('予測の的中p値は二項分布の上側(片側)', () => {
    const r = analyze(Array.from({ length: 200 }, (_, i) => i % 2), OPTS);
    const t = r.tests.find((x) => x.id === 'prediction');
    expect(t.hits).toBeGreaterThan(190);
    expect(t.p).toBeLessThan(1e-40);
    expect(r.verdict.distinguishable).toBe(true);
  });
});

describe('多重検定を正直に補正する', () => {
  it('本物の乱数を「人間っぽい」と誤判定する率は 5% 程度に収まる', () => {
    const rng = mulberry32(777);
    const N = 400;
    let falseAlarm = 0;
    let rawAlarm = 0;
    for (let i = 0; i < N; i++) {
      const r = analyze(randomBits(200, rng), OPTS);
      if (r.verdict.distinguishable) falseAlarm++;
      if (r.tests.some((t) => t.p < ALPHA)) rawAlarm++;
    }
    // 補正後は 5% 以下(標本誤差込みで 8% 未満)。補正しなければもっと多く引っかかる
    expect(falseAlarm / N).toBeLessThan(0.08);
    expect(rawAlarm).toBeGreaterThan(falseAlarm);
  });
  it('本物の乱数なら「偶然の範囲内」と言う', () => {
    const r = analyze(randomBits(200, mulberry32(4)), OPTS);
    expect(r.verdict.distinguishable).toBe(false);
    expect(r.verdict.headline).toMatch(/偶然の範囲/);
  });
});

describe('典型的な人間は見抜ける', () => {
  it('合成人間 50人中 8割以上を本物と区別できる', () => {
    const rng = mulberry32(8);
    let caught = 0;
    for (let i = 0; i < 50; i++) if (analyze(simulateHuman(200, rng), OPTS).verdict.distinguishable) caught++;
    expect(caught).toBeGreaterThanOrEqual(40);
  });
});
