// オンライン予測器: n-gram の専門家たちを文脈混合(ベイズ混合+fixed-share)で束ねる。
// predict() は「これまでに update() された手」だけから決まる。未来の手は構造上見えない。

const BIT_ORDERS = [0, 1, 2, 3, 4, 5, 6]; // 直近 k 手の表裏を文脈にする
const DIFF_ORDERS = [1, 2, 3, 4, 5]; // 直近 k 回の「変えた/続けた」を文脈にする
const SHARE = 0.02; // fixed-share: 癖が途中で変わっても追いかけられるようにする

function makeExpert(kind, k) {
  const counts = new Float64Array((1 << k) * 2);
  return { kind, k, counts };
}

/** 専門家が「次は表」と言う確率。文脈が足りなければ 0.5、更新すべき表の位置も返す */
function expertView(e, hist) {
  const n = hist.length;
  if (e.kind === 'bit') {
    if (n < e.k) return { p: 0.5, slot: -1 };
    let ctx = 0;
    for (let j = n - e.k; j < n; j++) ctx = (ctx << 1) | hist[j];
    const c0 = e.counts[ctx * 2];
    const c1 = e.counts[ctx * 2 + 1];
    return { p: (c1 + 0.5) / (c0 + c1 + 1), slot: ctx }; // Krichevsky–Trofimov 推定
  }
  if (n < e.k + 1) return { p: 0.5, slot: -1 };
  let ctx = 0;
  for (let j = n - e.k; j < n; j++) ctx = (ctx << 1) | (hist[j] ^ hist[j - 1]);
  const stay = e.counts[ctx * 2];
  const sw = e.counts[ctx * 2 + 1];
  const pSwitch = (sw + 0.5) / (stay + sw + 1);
  return { p: hist[n - 1] === 1 ? 1 - pSwitch : pSwitch, slot: ctx };
}

export function createPredictor() {
  const experts = [
    ...BIT_ORDERS.map((k) => makeExpert('bit', k)),
    ...DIFF_ORDERS.map((k) => makeExpert('diff', k)),
  ];
  let weights = experts.map(() => 1 / experts.length);
  const hist = [];

  function views() {
    return experts.map((e) => expertView(e, hist));
  }

  /** 次が表(1)である確率 */
  function prob() {
    const v = views();
    let p = 0;
    for (let i = 0; i < v.length; i++) p += weights[i] * v[i].p;
    return p;
  }

  /** 次の手の予測(0/1)。同率なら直前と逆(人は変えがち)。どちらも過去だけで決まる */
  function predict() {
    const p = prob();
    if (p > 0.5) return 1;
    if (p < 0.5) return 0;
    return hist.length ? 1 - hist[hist.length - 1] : 0;
  }

  function update(bit) {
    const v = views();
    let total = 0;
    weights = weights.map((w, i) => {
      const nw = w * (bit === 1 ? v[i].p : 1 - v[i].p);
      total += nw;
      return nw;
    });
    const m = weights.length;
    weights = weights.map((w) => (1 - SHARE) * (w / total) + SHARE / m);
    experts.forEach((e, i) => {
      const slot = v[i].slot;
      if (slot < 0) return;
      const outcome = e.kind === 'bit' ? bit : bit ^ hist[hist.length - 1];
      e.counts[slot * 2 + outcome]++;
    });
    hist.push(bit);
  }

  return { prob, predict, update, get length() { return hist.length; } };
}

/** 列を頭から順に流し、各手の「押す前の」予測・確率・的中・符号長をまとめる */
export function runPredictor(bits) {
  const p = createPredictor();
  const probs = [];
  const predictions = [];
  const hitsCum = [];
  let hits = 0;
  let bitsTotal = 0;
  for (const b of bits) {
    const q = p.prob();
    const pred = p.predict();
    probs.push(q);
    predictions.push(pred);
    if (pred === b) hits++;
    hitsCum.push(hits);
    bitsTotal += -Math.log2(b === 1 ? q : 1 - q);
    p.update(b);
  }
  return { probs, predictions, hits, hitsCum, bitsTotal, bitsPerMove: bits.length ? bitsTotal / bits.length : 0 };
}
