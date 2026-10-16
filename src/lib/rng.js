// テストとデモ用の種つき乱数。画面の「本物の乱数」は crypto を使う。

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomBits(n, rng) {
  return Array.from({ length: n }, () => (rng() < 0.5 ? 1 : 0));
}

/** ブラウザの暗号論的乱数で公平なビット列を作る */
export function cryptoBits(n) {
  const buf = new Uint8Array(n);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, (x) => x & 1);
}
