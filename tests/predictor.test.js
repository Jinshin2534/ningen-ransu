import { describe, it, expect } from 'vitest';
import { createPredictor, runPredictor } from '../src/lib/predictor.js';
import { mulberry32, randomBits } from '../src/lib/rng.js';
import { simulateHuman } from '../src/lib/human.js';
import { countSwitches } from '../src/lib/checks.js';

describe('乱数源と合成人間', () => {
  it('同じ種なら同じ列', () => {
    expect(randomBits(50, mulberry32(7))).toEqual(randomBits(50, mulberry32(7)));
  });
  it('合成人間は交代しすぎる', () => {
    const b = simulateHuman(2000, mulberry32(1));
    expect(countSwitches(b) / 1999).toBeGreaterThan(0.6);
  });
});

describe('後出し不可', () => {
  it('i 手目の予測は i 手目以降を書き換えても変わらない', () => {
    const rng = mulberry32(42);
    for (let trial = 0; trial < 20; trial++) {
      const a = simulateHuman(200, rng);
      const cut = Math.floor(rng() * 200);
      const b = a.slice(0, cut).concat(randomBits(200 - cut, rng));
      const pa = runPredictor(a).predictions;
      const pb = runPredictor(b).predictions;
      expect(pb.slice(0, cut + 1)).toEqual(pa.slice(0, cut + 1));
    }
  });
  it('押すたびに封をする逐次版と、まとめて再計算した結果が一致する', () => {
    const bits = simulateHuman(200, mulberry32(3));
    const p = createPredictor();
    const sealed = [];
    for (const b of bits) {
      sealed.push(p.predict());
      p.update(b);
    }
    expect(sealed).toEqual(runPredictor(bits).predictions);
  });
  it('予測確率は常に (0,1) の内側', () => {
    const r = runPredictor(new Array(200).fill(1));
    for (const q of r.probs) {
      expect(q).toBeGreaterThan(0);
      expect(q).toBeLessThan(1);
    }
  });
});

describe('真の乱数には勝てない', () => {
  it('300人×200手で的中率は 50% から統計的にずれない(|z|<3)', () => {
    const rng = mulberry32(2024);
    let hits = 0;
    let total = 0;
    for (let i = 0; i < 300; i++) {
      const r = runPredictor(randomBits(200, rng));
      hits += r.hits;
      total += 200;
    }
    const z = (hits - total / 2) / Math.sqrt(total / 4);
    expect(Math.abs(z)).toBeLessThan(3);
  });
  it('真の乱数は1手1ビットを切れない(平均)', () => {
    const rng = mulberry32(99);
    let s = 0;
    for (let i = 0; i < 100; i++) s += runPredictor(randomBits(200, rng)).bitsPerMove;
    expect(s / 100).toBeGreaterThan(1);
  });
});

describe('偏り入力には勝つ', () => {
  it('交代しすぎる合成人間を 58% 以上当てる', () => {
    const rng = mulberry32(5);
    let hits = 0;
    for (let i = 0; i < 50; i++) hits += runPredictor(simulateHuman(200, rng)).hits;
    expect(hits / (50 * 200)).toBeGreaterThan(0.58);
  });
  it('偏り入力は1ビット未満に縮む', () => {
    const rng = mulberry32(6);
    let s = 0;
    for (let i = 0; i < 50; i++) s += runPredictor(simulateHuman(200, rng)).bitsPerMove;
    expect(s / 50).toBeLessThan(0.97);
  });
  it('完全な交互押しはほぼ全部当てる', () => {
    const b = Array.from({ length: 200 }, (_, i) => i % 2);
    expect(runPredictor(b).hits).toBeGreaterThan(190);
  });
});
