// 「デタラメのつもりの人間」の合成モデル。同じ面が続くほど変えたくなる。
// 心理学でよく報告される交代率(約 0.6)と、長い連を避ける傾向を再現する。

export const TYPICAL_HUMAN = { switchByRun: [0.6, 0.7, 0.85, 0.95] };

export function simulateHuman(n, rng, profile = TYPICAL_HUMAN) {
  const sw = profile.switchByRun;
  const out = [];
  let run = 0;
  for (let i = 0; i < n; i++) {
    let b;
    if (i === 0) b = rng() < 0.5 ? 1 : 0;
    else {
      const p = sw[Math.min(run, sw.length) - 1];
      b = rng() < p ? 1 - out[i - 1] : out[i - 1];
    }
    run = i > 0 && b === out[i - 1] ? run + 1 : 1;
    out.push(b);
  }
  return out;
}
