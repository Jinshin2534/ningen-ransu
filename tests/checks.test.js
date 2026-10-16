import { describe, it, expect } from 'vitest';
import {
  runLengths, frequencyTest, alternationTest, probLongestAtMost, longestRunTest, serialTest,
} from '../src/lib/checks.js';

const bits = (s) => [...s].map(Number);

describe('連の長さ', () => {
  it('同じ面のかたまりの長さを返す', () => {
    expect(runLengths(bits('0011101'))).toEqual([2, 3, 1, 1]);
    expect(runLengths([])).toEqual([]);
  });
});

describe('偏りと交代率', () => {
  it('表の数を数え、両側p値を出す', () => {
    const r = frequencyTest(bits('1111111111'));
    expect(r.ones).toBe(10);
    expect(r.p).toBeCloseTo(2 / 1024, 12);
  });
  it('交代は n-1 回の遷移を数える', () => {
    const r = alternationTest(bits('0101010101'));
    expect(r.switches).toBe(9);
    expect(r.trials).toBe(9);
    expect(r.p).toBeCloseTo(2 / 512, 12);
  });
});

describe('最長連', () => {
  it('小さい n で総当たりと一致する', () => {
    const n = 10;
    for (let r = 0; r <= n; r++) {
      let c = 0;
      for (let x = 0; x < 1 << n; x++) {
        const b = Array.from({ length: n }, (_, i) => (x >> i) & 1);
        if (Math.max(0, ...runLengths(b)) <= r) c++;
      }
      expect(probLongestAtMost(n, r)).toBeCloseTo(c / (1 << n), 12);
    }
  });
  it('200回で最長3は極めて珍しい', () => {
    const b = [];
    for (let i = 0; i < 200; i++) b.push(Math.floor(i / 3) % 2);
    const r = longestRunTest(b);
    expect(r.longest).toBe(3);
    expect(r.p).toBeLessThan(1e-4);
  });
});

describe('系列検定(NIST SP800-22 2.11)', () => {
  it('NIST の例題 0011011101, m=3 を再現する', () => {
    const r = serialTest(bits('0011011101'), 3);
    expect(r.stat).toBeCloseTo(1.6, 10);
    expect(r.p).toBeCloseTo(0.808792, 5);
    expect(r.counts.reduce((a, b) => a + b, 0)).toBe(10);
  });
});
