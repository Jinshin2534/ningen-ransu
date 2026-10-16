import { describe, it, expect } from 'vitest';
import { binomPmf, binomCdf, binomSf, twoSided, chi2SfEven, holm, wilson } from '../src/lib/stats.js';

describe('二項分布', () => {
  it('pmf は合計1で、既知値と一致する', () => {
    let s = 0;
    for (let k = 0; k <= 20; k++) s += binomPmf(k, 20);
    expect(s).toBeCloseTo(1, 12);
    expect(binomPmf(5, 10)).toBeCloseTo(252 / 1024, 12);
  });
  it('cdf と sf は重なり1点ぶんだけ1を超える', () => {
    expect(binomCdf(4, 10) + binomSf(5, 10)).toBeCloseTo(1, 12);
    expect(binomSf(0, 10)).toBeCloseTo(1, 12);
    expect(binomSf(11, 10)).toBe(0);
  });
  it('両側p値は1を超えない', () => {
    expect(twoSided(0.7, 0.6)).toBe(1);
    expect(twoSided(0.01, 0.995)).toBeCloseTo(0.02, 12);
  });
});

describe('カイ二乗(自由度偶数)', () => {
  it('既知値と一致する', () => {
    expect(chi2SfEven(2, 2)).toBeCloseTo(Math.exp(-1), 12);
    expect(chi2SfEven(9.488, 4)).toBeCloseTo(0.05, 3);
    expect(chi2SfEven(0, 4)).toBe(1);
  });
  it('自由度が奇数なら例外', () => {
    expect(() => chi2SfEven(1, 3)).toThrow();
  });
});

describe('Holm 補正', () => {
  it('教科書どおりの補正値になり、順序を保つ', () => {
    const a = holm([0.01, 0.04, 0.03, 0.005]);
    [0.03, 0.06, 0.06, 0.02].forEach((v, i) => expect(a[i]).toBeCloseTo(v, 12));
  });
  it('補正後は1で頭打ち、単調性を守る', () => {
    const a = holm([0.5, 0.6, 0.01]);
    expect(a[2]).toBeCloseTo(0.03, 12);
    expect(a[0]).toBe(1);
    expect(a[1]).toBe(1);
  });
});

describe('Wilson 区間', () => {
  it('50/100 は 0.5 を中心に対称', () => {
    const [lo, hi] = wilson(50, 100);
    expect(lo).toBeCloseTo(0.4038, 3);
    expect(hi).toBeCloseTo(0.5962, 3);
  });
});
