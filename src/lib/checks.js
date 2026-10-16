// 個々の検定。bits は 0/1 の配列(1=表)。どれも「本物の公平なコイン」を帰無仮説にする。
import { binomCdf, binomSf, twoSided, chi2SfEven } from './stats.js';

export function runLengths(bits) {
  const out = [];
  for (let i = 0; i < bits.length; i++) {
    if (i > 0 && bits[i] === bits[i - 1]) out[out.length - 1]++;
    else out.push(1);
  }
  return out;
}

/** 偏り: 表の数は Binomial(n, 1/2) */
export function frequencyTest(bits) {
  const n = bits.length;
  const ones = bits.reduce((a, b) => a + b, 0);
  return { n, ones, stat: ones, p: twoSided(binomCdf(ones, n), binomSf(ones, n)) };
}

/** 交代率: 直前と違う面になる回数は Binomial(n-1, 1/2)(隣どうしの XOR も公平で独立だから) */
export function countSwitches(bits) {
  let s = 0;
  for (let i = 1; i < bits.length; i++) if (bits[i] !== bits[i - 1]) s++;
  return s;
}
export function alternationTest(bits) {
  const trials = Math.max(0, bits.length - 1);
  const switches = countSwitches(bits);
  return { trials, switches, stat: switches, p: twoSided(binomCdf(switches, trials), binomSf(switches, trials)) };
}

/** n 回投げて最長連が r 以下になる正確な確率(連の長さを状態にした DP) */
export function probLongestAtMost(n, r) {
  if (n === 0) return 1;
  if (r <= 0) return 0;
  let dp = new Float64Array(r + 1);
  dp[1] = 1;
  for (let i = 1; i < n; i++) {
    const next = new Float64Array(r + 1);
    let total = 0;
    for (let j = 1; j <= r; j++) total += dp[j];
    next[1] = total / 2;
    for (let j = 1; j < r; j++) next[j + 1] = dp[j] / 2;
    dp = next;
  }
  let s = 0;
  for (let j = 1; j <= r; j++) s += dp[j];
  return s;
}

/** 最長連: 正確な分布で両側検定 */
export function longestRunTest(bits) {
  const n = bits.length;
  const longest = Math.max(0, ...runLengths(bits));
  const lower = probLongestAtMost(n, longest);
  const upper = 1 - probLongestAtMost(n, longest - 1);
  return { n, longest, stat: longest, p: twoSided(lower, upper) };
}

/** NIST SP800-22 の系列検定(∇ψ²_m)。counts は巡回させた m 連パターンの出現数 */
export function serialTest(bits, m = 3) {
  const n = bits.length;
  const psi = (k) => {
    if (k === 0) return { v: 0, counts: [] };
    const counts = new Array(1 << k).fill(0);
    for (let i = 0; i < n; i++) {
      let x = 0;
      for (let j = 0; j < k; j++) x = (x << 1) | bits[(i + j) % n];
      counts[x]++;
    }
    const sq = counts.reduce((a, c) => a + c * c, 0);
    return { v: ((1 << k) / n) * sq - n, counts };
  };
  const a = psi(m);
  const b = psi(m - 1);
  const stat = a.v - b.v;
  return { n, m, counts: a.counts, stat, p: chi2SfEven(stat, 1 << (m - 1)) };
}
