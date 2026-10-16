// 検定に使う分布と補正。すべて純粋関数。

const LOG_FACT = [0];
function logFact(n) {
  for (let i = LOG_FACT.length; i <= n; i++) LOG_FACT[i] = LOG_FACT[i - 1] + Math.log(i);
  return LOG_FACT[n];
}

export function binomPmf(k, n, p = 0.5) {
  if (k < 0 || k > n) return 0;
  return Math.exp(logFact(n) - logFact(k) - logFact(n - k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

/** P(X ≤ k) */
export function binomCdf(k, n, p = 0.5) {
  let s = 0;
  for (let i = 0; i <= Math.min(k, n); i++) s += binomPmf(i, n, p);
  return Math.min(1, s);
}

/** P(X ≥ k) */
export function binomSf(k, n, p = 0.5) {
  let s = 0;
  for (let i = Math.max(0, k); i <= n; i++) s += binomPmf(i, n, p);
  return Math.min(1, s);
}

/** 下側・上側の確率から両側p値(2倍して1で頭打ち) */
export function twoSided(lower, upper) {
  return Math.min(1, 2 * Math.min(lower, upper));
}

/** カイ二乗分布の上側確率。自由度が偶数のときは閉じた式で正確に出せる */
export function chi2SfEven(x, df) {
  if (df % 2 !== 0 || df <= 0) throw new Error('自由度は正の偶数のみ');
  if (x <= 0) return 1;
  const h = x / 2;
  let term = 1;
  let sum = 1;
  for (let i = 1; i < df / 2; i++) {
    term *= h / i;
    sum += term;
  }
  return Math.min(1, Math.exp(-h) * sum);
}

/** Holm–Bonferroni 補正後のp値(入力と同じ並び) */
export function holm(ps) {
  const m = ps.length;
  const order = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(m);
  let running = 0;
  order.forEach(([p, i], j) => {
    running = Math.max(running, Math.min(1, (m - j) * p));
    out[i] = running;
  });
  return out;
}

/** 比率の Wilson 信頼区間 */
export function wilson(k, n, z = 1.96) {
  if (n === 0) return [0, 1];
  const ph = k / n;
  const d = 1 + (z * z) / n;
  const c = (ph + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((ph * (1 - ph)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
