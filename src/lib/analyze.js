// 検定群をまとめて走らせ、Holm 補正で「本物の乱数と区別できるか」を判定する。
import { binomSf, holm, wilson } from './stats.js';
import { runLengths, frequencyTest, alternationTest, longestRunTest, serialTest, countSwitches } from './checks.js';
import { runPredictor } from './predictor.js';
import { mulberry32, randomBits } from './rng.js';

export const ALPHA = 0.05;
export const MIN_LENGTH = 20;
export const RUN_BUCKETS = 8; // 連の長さ 1..7 と「8以上」

function runHistogram(bits) {
  const h = new Array(RUN_BUCKETS).fill(0);
  for (const r of runLengths(bits)) h[Math.min(r, RUN_BUCKETS) - 1]++;
  return h;
}

function quantile(sorted, q) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
}

const NULL_CACHE = new Map();

/** 長さ n の本物の乱数を samples 本作り、各統計量の分布を返す(図と圧縮率の p 値に使う) */
export function nullDistribution(n, samples = 2000, seed = 20261016) {
  const key = `${n}:${samples}:${seed}`;
  if (NULL_CACHE.has(key)) return NULL_CACHE.get(key);
  const rng = mulberry32(seed);
  const d = { n, samples, ones: [], switches: [], longest: [], serial: [], compression: [], hits: [], runs: [] };
  for (let s = 0; s < samples; s++) {
    const b = randomBits(n, rng);
    const pr = runPredictor(b);
    d.ones.push(b.reduce((a, x) => a + x, 0));
    d.switches.push(countSwitches(b));
    d.longest.push(Math.max(...runLengths(b)));
    d.serial.push(serialTest(b, 3).stat);
    d.compression.push(pr.bitsPerMove);
    d.hits.push(pr.hits);
    d.runs.push(runHistogram(b));
  }
  d.runBand = Array.from({ length: RUN_BUCKETS }, (_, k) => {
    const col = d.runs.map((h) => h[k]).sort((a, b) => a - b);
    return { mean: col.reduce((a, x) => a + x, 0) / samples, lo: quantile(col, 0.025), hi: quantile(col, 0.975) };
  });
  NULL_CACHE.set(key, d);
  return d;
}

/** 本命の結果。tests は図の並び順、p は補正前、pAdj は Holm 補正後 */
export function analyze(bits, { nullSamples = 2000, seed } = {}) {
  const n = bits.length;
  if (n < MIN_LENGTH) throw new Error(`${MIN_LENGTH}手以上必要です`);
  const nul = nullDistribution(n, nullSamples, seed);
  const pr = runPredictor(bits);
  const freq = frequencyTest(bits);
  const alt = alternationTest(bits);
  const lr = longestRunTest(bits);
  const ser = serialTest(bits, 3);
  const below = nul.compression.filter((x) => x <= pr.bitsPerMove).length;

  const tests = [
    {
      id: 'prediction', name: '予測の的中',
      stat: pr.hits, hits: pr.hits, n, rate: pr.hits / n, ci: wilson(pr.hits, n),
      p: binomSf(pr.hits, n), sided: 'upper', nullValues: nul.hits,
    },
    { id: 'alternation', name: '交代率', stat: alt.switches, trials: alt.trials, rate: alt.switches / alt.trials, p: alt.p, sided: 'two', nullValues: nul.switches },
    { id: 'longest', name: '最長の連', stat: lr.longest, p: lr.p, sided: 'two', nullValues: nul.longest },
    { id: 'serial', name: '3手パターン', stat: ser.stat, counts: ser.counts, p: ser.p, sided: 'upper', nullValues: nul.serial },
    {
      id: 'compression', name: '圧縮率',
      stat: pr.bitsPerMove, p: (1 + below) / (1 + nul.samples), sided: 'lower', nullValues: nul.compression,
      monteCarlo: nul.samples,
    },
    { id: 'frequency', name: '表の割合', stat: freq.ones, rate: freq.ones / n, p: freq.p, sided: 'two', nullValues: nul.ones },
  ];
  holm(tests.map((t) => t.p)).forEach((pa, i) => {
    tests[i].pAdj = pa;
    tests[i].rejected = pa < ALPHA;
  });

  const rejected = tests.filter((t) => t.rejected);
  const strongest = [...tests].sort((a, b) => a.pAdj - b.pAdj)[0];
  const verdict = {
    distinguishable: rejected.length > 0,
    rejectedIds: rejected.map((t) => t.id),
    strongestId: strongest.id,
    headline: rejected.length
      ? `あなたの乱数は、本物の乱数と区別できます(${tests.length}検定中${rejected.length}つで補正後 p<${ALPHA})`
      : `本物の乱数と区別できませんでした。どの差も偶然の範囲内です(補正後 p≥${ALPHA})`,
  };

  return {
    n, bits: [...bits], tests, verdict,
    predictor: pr,
    runs: { yours: runHistogram(bits), band: nul.runBand },
    familyAlpha: ALPHA,
    uncorrectedFamilyRisk: 1 - (1 - ALPHA) ** tests.length,
  };
}
