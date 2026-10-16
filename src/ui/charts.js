// 図はすべて SVG 文字列を返す純粋関数。色は CSS 変数で塗る。

export const TRIPLE_LABELS = ['裏裏裏', '裏裏表', '裏表裏', '裏表表', '表裏裏', '表裏表', '表表裏', '表表表'];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/**
 * 「本物の乱数◯本ぶん」の分布の山と、あなたの位置。
 * あなたと同じかそれ以上に極端だった側を濃く塗る(その面積がおおよそ片側の p 値)。
 */
export function nullHistogramSvg(values, observed, { discrete = true, sided = 'two', fmt = (x) => String(x), width = 340, height = 128 } = {}) {
  const lo = Math.min(observed, ...values);
  const hi = Math.max(observed, ...values);
  let bins;
  let binOf;
  let edgeOf;
  if (discrete) {
    const step = Math.max(1, Math.ceil((hi - lo + 1) / 40));
    bins = Math.floor((hi - lo) / step) + 1;
    binOf = (x) => Math.floor((x - lo) / step);
    edgeOf = (i) => lo + i * step;
  } else {
    bins = 32;
    const w = (hi - lo) / bins || 1;
    binOf = (x) => Math.min(bins - 1, Math.floor((x - lo) / w));
    edgeOf = (i) => lo + i * w;
  }
  const counts = new Array(bins).fill(0);
  for (const v of values) counts[binOf(v)]++;
  const max = Math.max(...counts, 1);
  const padL = 8, padR = 8, top = 22, axis = 20;
  const plotW = width - padL - padR;
  const plotH = height - top - axis;
  const bw = plotW / bins;
  const ob = binOf(observed);
  const med = median(values);
  const side = sided === 'two' ? (observed >= med ? 'upper' : 'lower') : sided;
  const extreme = (i) => (side === 'upper' ? i >= ob : i <= ob);
  const bars = counts.map((c, i) => {
    const h = (c / max) * plotH;
    const cls = extreme(i) ? 'h-tail' : 'h-bar';
    return `<rect class="${cls}" x="${(padL + i * bw + 0.5).toFixed(1)}" y="${(top + plotH - h).toFixed(1)}" width="${Math.max(1, bw - 1).toFixed(1)}" height="${h.toFixed(1)}"/>`;
  }).join('');
  const xOf = (x) => {
    const i = binOf(x);
    const frac = discrete ? 0.5 : Math.min(1, Math.max(0, (x - edgeOf(i)) / ((hi - lo) / bins || 1)));
    return padL + (i + frac) * bw;
  };
  const mx = xOf(observed);
  const anchor = mx < width * 0.2 ? 'start' : mx > width * 0.8 ? 'end' : 'middle';
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="本物の乱数の分布とあなたの値 ${esc(fmt(observed))}">
${bars}
<line class="axis" x1="${padL}" x2="${width - padR}" y1="${top + plotH}" y2="${top + plotH}"/>
<line class="you-line" x1="${mx.toFixed(1)}" x2="${mx.toFixed(1)}" y1="${top - 4}" y2="${top + plotH}"/>
<text class="you-label" x="${mx.toFixed(1)}" y="${top - 8}" text-anchor="${anchor}">あなた ${esc(fmt(observed))}</text>
<text class="tick" x="${padL}" y="${height - 4}">${esc(fmt(lo))}</text>
<text class="tick" x="${xOf(med).toFixed(1)}" y="${height - 4}" text-anchor="middle">${esc(fmt(med))}</text>
<text class="tick" x="${width - padR}" y="${height - 4}" text-anchor="end">${esc(fmt(hi))}</text>
</svg>`;
}

/** 表裏の並び。marks[i] が true のマスに点(予測器が当てた手) */
export function stripSvg(bits, { cols = 40, cell = 8, gap = 1, marks = null } = {}) {
  const rows = Math.ceil(bits.length / cols) || 1;
  const w = cols * (cell + gap) - gap;
  const h = rows * (cell + gap) - gap;
  const cells = bits.map((b, i) => {
    const x = (i % cols) * (cell + gap);
    const y = Math.floor(i / cols) * (cell + gap);
    const dot = marks && marks[i] ? `<circle class="hit-dot" cx="${x + cell / 2}" cy="${y + cell / 2}" r="${cell * 0.18}"/>` : '';
    return `<rect class="${b ? 'c-omote' : 'c-ura'}" x="${x}" y="${y}" width="${cell}" height="${cell}" rx="1.5"/>${dot}`;
  }).join('');
  return `<svg class="strip" viewBox="0 0 ${w} ${h}" role="img" aria-label="表裏の並び ${bits.length}手">${cells}</svg>`;
}

/** 予測器の「コイン投げより何手多く当てたか」の推移と、本物の乱数相手の95%の幅 */
export function excessHitsSvg(hitsCum, { width = 340, height = 170 } = {}) {
  const n = hitsCum.length;
  const ex = hitsCum.map((h, t) => h - (t + 1) / 2);
  const band = Array.from({ length: n }, (_, t) => 1.96 * Math.sqrt(t + 1) / 2);
  const ymax = Math.max(4, ...ex.map(Math.abs), band[n - 1] || 0) * 1.1;
  const padL = 30, padR = 10, top = 10, bottom = 22;
  const pw = width - padL - padR, ph = height - top - bottom;
  const x = (t) => padL + ((t + 1) / n) * pw;
  const y = (v) => top + ph / 2 - (v / ymax) * (ph / 2);
  const upper = band.map((b, t) => `${x(t).toFixed(1)},${y(b).toFixed(1)}`);
  const lower = band.map((b, t) => `${x(t).toFixed(1)},${y(-b).toFixed(1)}`).reverse();
  const area = `M${padL},${y(0)} L${upper.join(' L')} L${lower.join(' L')} Z`;
  const line = ex.map((v, t) => `${t ? 'L' : 'M'}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = ex[n - 1] ?? 0;
  const yl = Math.round(ymax / 1.1);
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="予測器の勝ち越し ${last.toFixed(1)}手">
<path class="band" d="${area}"/>
<line class="axis" x1="${padL}" x2="${width - padR}" y1="${y(0)}" y2="${y(0)}"/>
<path class="you-path" d="${line}"/>
<text class="tick" x="${padL - 4}" y="${y(yl) + 4}" text-anchor="end">+${yl}</text>
<text class="tick" x="${padL - 4}" y="${y(0) + 4}" text-anchor="end">0</text>
<text class="tick" x="${padL - 4}" y="${y(-yl) + 4}" text-anchor="end">−${yl}</text>
<text class="tick" x="${padL}" y="${height - 4}">1手目</text>
<text class="tick" x="${width - padR}" y="${height - 4}" text-anchor="end">${n}手目</text>
</svg>`;
}

/** 連の長さごとの数。棒=あなた、点と縦線=本物の乱数の平均と95%の幅 */
export function runLengthSvg(yours, band, { width = 340, height = 160 } = {}) {
  const k = yours.length;
  const ymax = Math.max(...yours, ...band.map((b) => b.hi), 1) * 1.08;
  const padL = 26, padR = 6, top = 8, bottom = 22;
  const pw = width - padL - padR, ph = height - top - bottom;
  const bw = pw / k;
  const y = (v) => top + ph - (v / ymax) * ph;
  const parts = yours.map((c, i) => {
    const cx = padL + i * bw + bw / 2;
    const b = band[i];
    return `<rect class="h-you" x="${(padL + i * bw + bw * 0.18).toFixed(1)}" y="${y(c).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${(top + ph - y(c)).toFixed(1)}"/>
<line class="null-range" x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${y(b.lo).toFixed(1)}" y2="${y(b.hi).toFixed(1)}"/>
<circle class="null-mean" cx="${cx.toFixed(1)}" cy="${y(b.mean).toFixed(1)}" r="3"/>
<text class="tick" x="${cx.toFixed(1)}" y="${height - 6}" text-anchor="middle">${i === k - 1 ? `${k}+` : i + 1}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="連の長さの分布">
<line class="axis" x1="${padL}" x2="${width - padR}" y1="${top + ph}" y2="${top + ph}"/>
<text class="tick" x="${padL - 4}" y="${y(Math.round(ymax / 1.08)) + 4}" text-anchor="end">${Math.round(ymax / 1.08)}</text>
${parts}
</svg>`;
}

/** 3手パターン8通りの出現数と、本物なら期待される数 */
export function triplesSvg(counts, expected, { width = 340, height = 150 } = {}) {
  const labels = TRIPLE_LABELS;
  const ymax = Math.max(...counts, expected) * 1.12;
  const padL = 6, padR = 6, top = 8, bottom = 24;
  const pw = width - padL - padR, ph = height - top - bottom;
  const bw = pw / 8;
  const y = (v) => top + ph - (v / ymax) * ph;
  const bars = counts.map((c, i) => {
    const x = padL + i * bw;
    const txt = labels[i].split('').map((ch, j) => `<tspan class="${ch === '表' ? 't-omote' : 't-ura'}">${ch}</tspan>`).join('');
    return `<rect class="h-you" x="${(x + bw * 0.15).toFixed(1)}" y="${y(c).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${(top + ph - y(c)).toFixed(1)}"/>
<text class="tick" x="${(x + bw / 2).toFixed(1)}" y="${(y(c) - 3).toFixed(1)}" text-anchor="middle">${c}</text>
<text class="tick tri" x="${(x + bw / 2).toFixed(1)}" y="${height - 6}" text-anchor="middle">${txt}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="3手パターンの出現数">
${bars}
<line class="expect-line" x1="${padL}" x2="${width - padR}" y1="${y(expected).toFixed(1)}" y2="${y(expected).toFixed(1)}"/>
</svg>`;
}
