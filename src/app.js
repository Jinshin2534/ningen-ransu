import './style.css';
import { analyze, nullDistribution, ALPHA } from './lib/analyze.js';
import { createPredictor, runPredictor } from './lib/predictor.js';
import { cryptoBits, mulberry32 } from './lib/rng.js';
import { simulateHuman } from './lib/human.js';
import { nullHistogramSvg, stripSvg, excessHitsSvg, runLengthSvg, triplesSvg, TRIPLE_LABELS } from './ui/charts.js';

const N = 200;
const root = document.getElementById('app');

const state = {
  screen: 'intro', // intro | input | busy | result
  bits: [],
  sealed: [], // 押す前に封をした予測
  source: 'you', // you | human-demo | random-demo
  predictor: null,
  result: null,
  honest: null,
};

const pct = (x, d = 0) => `${(x * 100).toFixed(d)}%`;
const fmtP = (p) => (p < 0.0001 ? 'p<0.0001' : `p=${p < 0.01 ? p.toFixed(4) : p.toFixed(3)}`);

// 帰無分布は重いので、押している間に先に作っておく
function warmUp() {
  setTimeout(() => nullDistribution(N), 50);
}

function start(source = 'you') {
  state.screen = 'input';
  state.bits = [];
  state.sealed = [];
  state.source = source;
  state.predictor = createPredictor();
  state.result = null;
  state.honest = null;
  state.sealed.push(state.predictor.predict());
  warmUp();
  render();
}

function press(bit) {
  if (state.screen !== 'input' || state.bits.length >= N) return;
  state.bits.push(bit);
  state.predictor.update(bit);
  if (state.bits.length < N) state.sealed.push(state.predictor.predict());
  if (state.bits.length >= N) finish();
  else renderInputProgress(bit);
}

function fill(bits, source) {
  start(source);
  for (const b of bits) press(b);
}

function demo(kind) {
  if (kind === 'human') fill(simulateHuman(N, mulberry32((Math.random() * 2 ** 32) >>> 0)), 'human-demo');
  else fill(cryptoBits(N), 'random-demo');
}

function finish() {
  state.screen = 'busy';
  render();
  setTimeout(() => {
    state.result = analyze(state.bits);
    // 正直さの確認: 封をしていた予測と、列全体から再計算した予測が一致するか
    const recomputed = runPredictor(state.bits).predictions;
    const same = recomputed.every((p, i) => p === state.sealed[i]);
    state.honest = { same, count: recomputed.length };
    state.screen = 'result';
    render();
    window.scrollTo(0, 0);
  }, 30);
}

function header() {
  return `<header class="app-header">
    <p class="kicker">学び × 統計</p>
    <h1>人間乱数検定</h1>
    <p class="lede">デタラメに押したつもりの表と裏。その乱数、本物と見分けがつきますか。</p>
  </header>`;
}

function renderIntro() {
  root.innerHTML = `<main class="screen">
    ${header()}
    <section class="card">
      <h2>やること</h2>
      <ol class="steps">
        <li><b class="omote">表</b>か<b class="ura">裏</b>を、できるだけデタラメに <b>${N}回</b> 押します。</li>
        <li>押す前に毎回、予測器があなたの次の手をこっそり予想して<b>封</b>をします。</li>
        <li>最後に6つの検定と予測の的中率で、本物の乱数とどこが違うかを見せます。</li>
      </ol>
      <button class="primary big" data-act="start">はじめる</button>
      <p class="hint">キーボードなら <kbd>F</kbd> = 表 / <kbd>J</kbd> = 裏(<kbd>←</kbd><kbd>→</kbd> も可)</p>
    </section>
    <section class="card quiet">
      <h3>押さずに試す</h3>
      <p class="muted">比べるための見本です。結果画面にも見本と明記します。</p>
      <div class="row">
        <button class="ghost" data-act="demo-human">典型的な人間(合成)</button>
        <button class="ghost" data-act="demo-random">本物の乱数</button>
      </div>
    </section>
    <footer class="foot">記録はどこにも送りません。計算はすべてこのブラウザの中です。</footer>
  </main>`;
}

function renderInput() {
  root.innerHTML = `<main class="screen">
    <div class="progress-head">
      <span class="count"><b id="count">${state.bits.length}</b> / ${N}</span>
      <span class="sealed">封をした予測 <b id="sealed">${state.sealed.length}</b> 通</span>
    </div>
    <div class="bar"><div class="bar-fill" id="bar" style="width:${(state.bits.length / N) * 100}%"></div></div>
    <div class="pad">
      <button class="coin omote-btn" data-bit="1"><span>表</span><small>F / ←</small></button>
      <button class="coin ura-btn" data-bit="0"><span>裏</span><small>J / →</small></button>
    </div>
    <div class="live-strip" id="strip">${stripSvg(state.bits, { cols: 40 })}</div>
    <p class="hint">考えすぎず、でも規則的にならないように。予測器の予想は最後まで見せません。</p>
    <button class="link" data-act="quit">やめてはじめに戻る</button>
  </main>`;
}

function renderInputProgress() {
  const c = document.getElementById('count');
  if (!c) return renderInput();
  c.textContent = state.bits.length;
  document.getElementById('sealed').textContent = state.sealed.length;
  document.getElementById('bar').style.width = `${(state.bits.length / N) * 100}%`;
  document.getElementById('strip').innerHTML = stripSvg(state.bits, { cols: 40 });
}

function renderBusy() {
  root.innerHTML = `<main class="screen"><section class="card center"><p class="big-text">検定中…</p><p class="muted">本物の乱数 2000 本ぶんと比べています</p></section></main>`;
}

function verdictBadge(t) {
  return t.rejected
    ? `<span class="badge hit">本物と違う</span>`
    : `<span class="badge calm">偶然の範囲内</span>`;
}

function pLine(t) {
  const mc = t.monteCarlo ? `(本物の乱数${t.monteCarlo}本との比較)` : '';
  return `<p class="pline">補正後 <b>${fmtP(t.pAdj)}</b> <span class="muted">/ 補正前 ${fmtP(t.p)}${mc}</span></p>`;
}

/** 本物の乱数のうち、あなたと同じかもっと極端だった本数(図の濃い部分と同じ数え方) */
function extremeCount(values, obs, sided) {
  const med = [...values].sort((a, b) => a - b)[values.length >> 1];
  const side = sided === 'two' ? (obs >= med ? 'upper' : 'lower') : sided;
  return values.filter((v) => (side === 'upper' ? v >= obs : v <= obs)).length;
}

function testCard(t, r) {
  const n = r.n;
  const k = extremeCount(t.nullValues, t.stat, t.sided);
  const tailNote = `<p class="cap">灰色の山 = 本物の乱数 ${t.nullValues.length} 本ぶんの値。濃い部分 = あなたと同じか、もっと極端だった本物。${k === 0 ? '<b>1本もありませんでした。</b>' : `${k}本ありました。`}</p>`;
  switch (t.id) {
    case 'alternation':
      return `<article class="card test">
        <div class="test-head"><h3>交代率 — 変えすぎていないか</h3>${verdictBadge(t)}</div>
        <p>直前と<b>違う面</b>を押した割合は <b class="num">${pct(t.rate, 1)}</b>。本物の乱数ならほぼ 50% です。人は「同じ面が続くとデタラメっぽくない」と感じて、変えすぎる傾向があります。</p>
        ${nullHistogramSvg(t.nullValues, t.stat, { sided: 'two', fmt: (x) => pct(x / t.trials) })}
        ${tailNote}${pLine(t)}
      </article>`;
    case 'longest': {
      const med = [...t.nullValues].sort((a, b) => a - b)[t.nullValues.length >> 1];
      return `<article class="card test">
        <div class="test-head"><h3>最長の連 — 続けるのを怖がっていないか</h3>${verdictBadge(t)}</div>
        <p>同じ面がいちばん長く続いたのは <b class="num">${t.stat}回</b>。${n}回の本物の乱数なら、ふつう <b>${med}回</b> くらいは続きます。下は連の長さごとの数です。</p>
        ${runLengthSvg(r.runs.yours, r.runs.band)}
        <p class="cap">棒 = あなた。点と縦線 = 本物の乱数の平均と、95% が収まる幅。</p>
        ${nullHistogramSvg(t.nullValues, t.stat, { sided: 'two', fmt: (x) => `${x}回` })}
        ${tailNote}${pLine(t)}
      </article>`;
    }
    case 'serial': {
      const exp = n / 8;
      let lo = 0;
      let hi = 0;
      t.counts.forEach((c, i) => {
        if (c < t.counts[lo]) lo = i;
        if (c > t.counts[hi]) hi = i;
      });
      return `<article class="card test">
        <div class="test-head"><h3>3手パターン — 出方に好き嫌いがないか</h3>${verdictBadge(t)}</div>
        <p>連続する3手の並びは8通り。本物ならどれも約 ${exp.toFixed(0)} 回ずつ出ます。あなたが一番避けたのは <b>${TRIPLE_LABELS[lo]}</b>(${t.counts[lo]}回)、一番多かったのは <b>${TRIPLE_LABELS[hi]}</b>(${t.counts[hi]}回)。</p>
        ${triplesSvg(t.counts, exp)}
        <p class="cap">点線 = 本物なら期待される回数。ばらつきの大きさを NIST SP800-22 の系列検定(自由度4のカイ二乗)で測っています。</p>
        ${pLine(t)}
      </article>`;
    }
    case 'compression':
      return `<article class="card test">
        <div class="test-head"><h3>圧縮率 — どれだけ縮むか</h3>${verdictBadge(t)}</div>
        <p>予測器の確率で符号化すると、あなたの列は1手あたり <b class="num">${t.stat.toFixed(3)} ビット</b>。本物の乱数は縮まず、平均 ${(t.nullValues.reduce((a, x) => a + x, 0) / t.nullValues.length).toFixed(2)} ビット(学ぼうとしたぶん1を少し超える)。小さいほど「読める」列です。</p>
        ${nullHistogramSvg(t.nullValues, t.stat, { discrete: false, sided: 'lower', fmt: (x) => x.toFixed(2) })}
        ${tailNote}${pLine(t)}
      </article>`;
    case 'frequency':
      return `<article class="card test">
        <div class="test-head"><h3>表の割合 — 片方に寄っていないか</h3>${verdictBadge(t)}</div>
        <p>表を押した割合は <b class="num">${pct(t.rate, 1)}</b>(${t.stat}/${n})。人は意外とここでは偏りません。</p>
        ${nullHistogramSvg(t.nullValues, t.stat, { sided: 'two', fmt: (x) => `${x}` })}
        ${tailNote}${pLine(t)}
      </article>`;
    default:
      return '';
  }
}

function renderResult() {
  const r = state.result;
  const pred = r.tests.find((t) => t.id === 'prediction');
  const others = r.tests.filter((t) => t.id !== 'prediction');
  const [ciLo, ciHi] = pred.ci;
  const sourceNote = {
    you: '',
    'human-demo': '<p class="demo-note">これは見本です: 交代しすぎる「典型的な人間」の合成データ。</p>',
    'random-demo': '<p class="demo-note">これは見本です: この端末の暗号論的乱数(crypto.getRandomValues)で作った本物の乱数。</p>',
  }[state.source];
  const predSay = pred.rejected
    ? `本物の乱数相手なら当たるのは 50% 前後。あなたの手は<b>読まれています</b>。`
    : pred.p < ALPHA
      ? `50% より多いものの、6つの検定をした補正のあとでは偶然の範囲内です。`
      : `本物の乱数相手と同じく 50% 前後。予測器はあなたを読めませんでした。`;
  const honest = state.honest.same
    ? `<p class="ok">✓ 押す前に封をした予測 ${state.honest.count} 手ぶんと、列全体から計算し直した予測が完全に一致しました(後出しなし)。</p>`
    : `<p class="ng">✗ 封をした予測と再計算が一致しませんでした。この結果は信用しないでください。</p>`;
  const random = cryptoBits(r.n);

  root.innerHTML = `<main class="screen">
    ${header()}
    ${sourceNote}
    <section class="card verdict ${r.verdict.distinguishable ? 'v-hit' : 'v-calm'}">
      <p class="v-label">判定</p>
      <h2>${r.verdict.distinguishable ? 'あなたの乱数は、本物と見分けられます' : '本物の乱数と見分けられませんでした'}</h2>
      <p>${r.verdict.headline}</p>
    </section>

    <section class="card test">
      <div class="test-head"><h3>予測器はあなたの次の手を</h3>${verdictBadge(pred)}</div>
      <p class="hero-num"><b>${pct(pred.rate)}</b> で当てた</p>
      <p class="muted">${r.n}手中 ${pred.hits}手的中 ・ 95%区間 ${pct(ciLo)}〜${pct(ciHi)}</p>
      <p>${predSay}</p>
      ${excessHitsSvg(r.predictor.hitsCum)}
      <p class="cap">線 = コイン投げより何手多く当てたか。灰色の帯 = 本物の乱数相手なら 95% がこの中に収まる幅。上に抜けるほど読まれています。</p>
      ${pLine(pred)}
    </section>

    <section class="card">
      <h3>並べてみる</h3>
      <p class="strip-label">あなた <span class="muted">(白い点 = 予測器が当てた手)</span></p>
      <div class="strip-wrap">${stripSvg(r.bits, { marks: r.predictor.predictions.map((p, i) => p === r.bits[i]) })}</div>
      <p class="strip-label">本物の乱数 <span class="muted">(いまこの端末で作った ${r.n} 手)</span></p>
      <div class="strip-wrap">${stripSvg(random)}</div>
      <p class="cap">本物のほうが、同じ色のかたまりが大きく見えるはずです。<span class="omote">■</span>表 <span class="ura">■</span>裏</p>
    </section>

    ${others.map((t) => testCard(t, r)).join('')}

    <section class="card quiet">
      <h3>多重検定の補正について</h3>
      <p>6つの検定を同時にすると、本物の乱数でもどれか1つが偶然 p&lt;0.05 になる確率は最大で約 <b>${pct(r.uncorrectedFamilyRisk)}</b> あります。そこで <b>Holm 法</b>で p 値を補正し、補正後の値だけで判定しています。各カードには補正前の値も並べました。</p>
      <h3>予測器のしくみ</h3>
      <p>直近 0〜6 手の表裏、直近 1〜5 回の「変えた/続けた」をそれぞれ文脈にした n-gram 予測を、当たり具合に応じて重みづけして混ぜます(文脈混合)。各手の予測はその手より前の手だけで決まり、${r.n}手ぶんの的中数は本物の乱数相手なら正確に二項分布 B(${r.n}, 1/2) に従います。</p>
      ${honest}
    </section>

    <div class="row center">
      <button class="primary big" data-act="start">もう一度挑戦</button>
      <button class="ghost" data-act="home">はじめに戻る</button>
    </div>
    <footer class="foot">記録はどこにも送りません。計算はすべてこのブラウザの中です。</footer>
  </main>`;
}

function render() {
  if (state.screen === 'intro') renderIntro();
  else if (state.screen === 'input') renderInput();
  else if (state.screen === 'busy') renderBusy();
  else renderResult();
}

root.addEventListener('click', (e) => {
  const coin = e.target.closest('[data-bit]');
  if (coin) return press(Number(coin.dataset.bit));
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'start') start();
  else if (act === 'demo-human') demo('human');
  else if (act === 'demo-random') demo('random');
  else if (act === 'quit' || act === 'home') {
    state.screen = 'intro';
    render();
  }
});

window.addEventListener('keydown', (e) => {
  if (state.screen !== 'input' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'f' || k === 'arrowleft') press(1);
  else if (k === 'j' || k === 'arrowright') press(0);
  else return;
  e.preventDefault();
});

// ヘッドレス検証用
window.__app = { state, start, press, fill, demo, N };

render();
