import { describe, it, expect } from 'vitest';
import { nullHistogramSvg, stripSvg, excessHitsSvg } from '../src/ui/charts.js';

describe('図', () => {
  it('分布の図にあなたの値が書かれ、極端側が塗られる', () => {
    const svg = nullHistogramSvg([1, 2, 2, 3, 3, 3, 4, 4, 5], 5, { sided: 'upper' });
    expect(svg).toContain('あなた 5');
    expect(svg).toContain('h-tail');
    expect(svg).not.toContain('NaN');
  });
  it('並びの図はマス数=手数', () => {
    const svg = stripSvg([1, 0, 1, 1], { marks: [true, false, false, true] });
    expect(svg.match(/<rect/g).length).toBe(4);
    expect(svg.match(/hit-dot/g).length).toBe(2);
  });
  it('勝ち越しの図は NaN を出さない', () => {
    expect(excessHitsSvg([1, 1, 2, 3])).not.toContain('NaN');
  });
});
