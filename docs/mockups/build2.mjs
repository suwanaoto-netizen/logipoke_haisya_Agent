// 配車計画表「情報量削減」提案モックアップ 第2弾
//  ① A＋C 2モード切替（俯瞰⇄要対応） ② 配色の調整版 ③ しきい値の調整版
// 実アプリ index.html のトークン・改善基準告示の色（warn=#d97706 / violation=#dc2626）を踏襲。
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const DIR = dirname(fileURLToPath(import.meta.url));

/* ───────── データ（第1弾と同じ世界観） ───────── */
const drivers = [
  { n: '山田 一郎', v: '2t 平ボディ', st: 'busy' },
  { n: '鈴木 次郎', v: '4t 冷凍', st: 'busy' },
  { n: '田中 三郎', v: '10t ウィング', st: 'busy' },
  { n: '佐藤 四郎', v: '3t 平ボディ', st: 'busy' },
  { n: '高橋 五郎', v: '大型トレーラ', st: 'available' },
  { n: '伊藤 六郎', v: '2t 冷蔵', st: 'busy' },
  { n: '渡辺 七郎', v: '4t 平ボディ', st: 'available' },
  { n: '中村 八郎', v: '10t 平ボディ', st: 'busy' },
];
const asg = {
  0: [{ c: '○○商事', f: '川口', t: '横浜', s: 9.33, e: 12.33, st: 'confirmed' }, { c: '関東物流', f: '江東', t: '千葉', s: 14, e: 17.5, st: 'planned' }],
  1: [{ c: '△△食品', f: '船橋', t: '大田', s: 8, e: 12.5, st: 'confirmed' }, { c: 'エコフレッシュ', f: '川崎', t: '静岡', s: 15, e: 18, st: 'planned' }],
  2: [{ c: '□□製作所', f: 'つくば', t: '名古屋', s: 7, e: 15, st: 'confirmed' }],
  3: [{ c: '明和産業', f: 'さいたま', t: '品川', s: 10, e: 13, st: 'planned' }, { c: '富士物産', f: '柏', t: '町田', s: 14.5, e: 17, st: 'planned', warn: true }],
  4: [{ c: '中央運送', f: '横浜', t: '仙台', s: 6, e: 11, st: 'confirmed' }],
  5: [{ c: '日東精工', f: '大田', t: '川口', s: 9, e: 11.5, st: 'confirmed' }, { c: 'ABC機器', f: '品川', t: '厚木', s: 13, e: 16.5, st: 'planned' }],
  6: [],
  7: [{ c: 'XYZ部品', f: '市川', t: '春日部', s: 8.5, e: 12, st: 'confirmed' }, { c: '東和ロジ', f: '浦安', t: '宇都宮', s: 13.5, e: 18.5, st: 'planned' }],
};
const pct = h => h / 24 * 100;
const fmt = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const util = i => Math.min(100, Math.round((asg[i] || []).reduce((s, b) => s + (b.e - b.s), 0) / 11 * 100));

/* ───────── 共有CSS ───────── */
const makeBase = (w, h) => `
*{box-sizing:border-box;margin:0;padding:0}
:root{--accent:#3BB888;--accent-pale:#EAF5F0;--header-bg:#0D4A3A;--text-primary:#1a1a1a;
  --text-secondary:#6b7280;--text-muted:#9ca3af;--border:#e5e7eb;--bg:#f4f6f8;
  --orange:#f97316;--green:#16a34a;--red:#dc2626;--blk:#1a7a5e;--warn:#d97706}
html,body{width:${w}px;height:${h}px;overflow:hidden;background:var(--bg);
  font-family:'IPAPGothic','IPAGothic','WenQuanYi Zen Hei',sans-serif;color:var(--text-primary);-webkit-font-smoothing:antialiased}
.num{font-family:'DejaVu Sans',sans-serif;font-feature-settings:'tnum'}
.app{display:flex;height:${h}px}
.rail{width:54px;background:var(--header-bg);display:flex;flex-direction:column;align-items:center;padding-top:10px;gap:4px;flex-shrink:0}
.rail .logo{width:30px;height:30px;border-radius:7px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;margin-bottom:8px}
.rail .ic{width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#bfe6d6;opacity:.7}
.rail .ic.on{background:rgba(255,255,255,.14);color:#fff;opacity:1}
.main{flex:1;display:flex;flex-direction:column;min-width:0}
.brand{height:38px;background:var(--header-bg);display:flex;align-items:center;padding:0 16px;color:#eaf5f0;gap:10px;flex-shrink:0}
.brand b{font-size:13px;font-weight:800}
.brand .sp{flex:1}
.brand .u{width:24px;height:24px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:700}
.dh{height:50px;background:#fff;border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 18px;gap:14px;flex-shrink:0}
.dh .ttl{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:800}
.dh .ttl .dot{width:16px;height:16px;border-radius:50%;border:2.5px solid var(--blk)}
.dh .sp{flex:1}
/* モード切替（セグメント） */
.modeseg{display:flex;background:#eef2f0;border-radius:10px;padding:3px;gap:2px;border:1px solid #e2e8e4}
.modeseg .m{font-size:12.5px;font-weight:700;padding:7px 16px;border-radius:8px;color:var(--text-secondary);display:flex;align-items:center;gap:7px}
.modeseg .m.on{background:#fff;color:var(--blk);box-shadow:0 1px 4px rgba(0,0,0,.13)}
.modeseg .m .b{font-size:10px;font-weight:800;background:var(--red);color:#fff;border-radius:20px;padding:1px 7px}
.modeseg .m.on .b{background:var(--red)}
.btn{font-size:11px;font-weight:700;padding:6px 11px;border-radius:6px;border:1px solid var(--border);background:#fff;color:var(--text-secondary);display:inline-flex;align-items:center;gap:5px}
/* 常時表示の要対応ストリップ */
.reqstrip{display:flex;align-items:center;gap:10px;padding:8px 16px;background:#fff7ed;border-bottom:1px solid #fed7aa;font-size:11.5px;color:#9a3412;font-weight:700;flex-shrink:0}
.reqstrip .rc{display:inline-flex;align-items:center;gap:5px;background:#fff;border:1px solid #fed7aa;border-radius:13px;padding:3px 10px;font-size:11px}
.reqstrip .rc .dt{width:7px;height:7px;border-radius:50%}
.reqstrip .sp{flex:1}
.reqstrip .go{font-size:11px;font-weight:800;color:#fff;background:var(--orange);border-radius:7px;padding:5px 12px}
.board{flex:1;display:flex;min-height:0;overflow:hidden}
/* ガント */
.tl{flex:1;display:flex;flex-direction:column;min-width:0;background:#fff;overflow:hidden}
.rhead{height:42px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;padding:0 14px;flex-shrink:0}
.rhead .rt{font-size:12px;font-weight:800;display:flex;align-items:center;gap:6px}
.rsp{flex:1}
.legend{display:flex;align-items:center;gap:14px;font-size:10.5px;color:var(--text-secondary)}
.legend i{display:inline-block;width:13px;height:11px;border-radius:3px;vertical-align:-1px;margin-right:5px}
.datemini{display:flex;align-items:center;gap:4px;font-size:11px;font-weight:800;color:var(--text-secondary)}
.datemini .nb{width:18px;height:20px;border:1px solid var(--border);border-radius:4px;display:flex;align-items:center;justify-content:center}
.tlbody{flex:1;overflow:hidden;padding:6px 0}
.thead{display:grid;grid-template-columns:150px 1fr;height:22px;border-bottom:1px solid var(--border)}
.thead .l{font-size:9.5px;font-weight:700;color:var(--text-muted);padding:5px 10px}
.tk{position:relative}
.tk .t{position:absolute;top:3px;transform:translateX(-50%);font-size:9px;font-weight:700;color:var(--text-muted)}
.row{display:grid;grid-template-columns:150px 1fr;margin-bottom:4px;height:52px}
.dcell{display:flex;flex-direction:column;justify-content:center;gap:2px;padding:4px 8px;background:#fafbfc;border:1px solid var(--border);border-right:none;border-radius:8px 0 0 8px}
.dn2{font-size:11px;font-weight:800;display:flex;align-items:center;gap:5px}
.dn2 .sd{width:6px;height:6px;border-radius:50%}
.dn2 .sd.busy{background:var(--orange)}.dn2 .sd.available{background:var(--green)}
.track{position:relative;height:52px;border:1px solid var(--border);border-left:none;border-radius:0 8px 8px 0;background-color:#fbfcfd;
  background-image:repeating-linear-gradient(90deg,transparent,transparent calc(100%/24 - 1px),#eef0f3 calc(100%/24 - 1px),#eef0f3 calc(100%/24)),
   repeating-linear-gradient(90deg,transparent,transparent calc(100%/8 - 1px),#d1d5db calc(100%/8 - 1px),#d1d5db calc(100%/8))}
.blk{position:absolute;top:4px;bottom:4px;border-radius:4px;display:flex;align-items:center;padding:0 8px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.12)}
.blk .bt{font-size:10px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`;

/* ───────── 部品 ───────── */
const rail = `<aside class="rail"><div class="logo">ロ</div>${['🏠','📋','🚚','📞','📊','⚙'].map((e,i)=>`<div class="ic ${i===2?'on':''}">${e}</div>`).join('')}</aside>`;
const brand = `<div class="brand"><b>ロジポケ配車Agent</b><span class="sp"></span><span style="font-size:11px;opacity:.85">2026/06/03</span><span class="u">配</span></div>`;
const toggle = active => `<div class="modeseg">
  <div class="m ${active === 'overview' ? 'on' : ''}">🗺 俯瞰</div>
  <div class="m ${active === 'action' ? 'on' : ''}">🔔 要対応 <span class="b">8</span></div>
</div>`;
const dhMode = (active, right = '') => `<div class="dh"><div class="ttl"><span class="dot"></span>配車計画表</div><span class="sp"></span>${toggle(active)}${right}</div>`;
const reqStrip = `<div class="reqstrip">
  <span>⚠ 対応待ち</span>
  <span class="rc"><span class="dt" style="background:var(--red)"></span>未割当 6（緊急2）</span>
  <span class="rc"><span class="dt" style="background:var(--warn)"></span>改善基準 1</span>
  <span class="rc"><span class="dt" style="background:#eab308"></span>確定待ち 5</span>
  <span class="sp"></span>
  <span class="go">要対応モードで処理 →</span>
</div>`;
const doc = (w, h, css, inner) => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${makeBase(w, h)}${css}</style></head><body><div class="app">${inner}</div></body></html>`;

/* ガント（colorFn で配色を差し替え可能） */
function gantt(ids, colorFn, { head = '', compact = false } = {}) {
  const ticks = compact ? [0, 6, 12, 18, 24] : [0, 3, 6, 9, 12, 15, 18, 21, 24];
  const rows = ids.map(i => {
    const d = drivers[i];
    const blocks = (asg[i] || []).map(b => {
      const c = colorFn(b, i);
      return `<div class="blk" style="left:${pct(b.s)}%;width:${pct(b.e - b.s)}%;background:${c.bg};${c.ring ? `box-shadow:inset 0 0 0 2px ${c.ring},0 1px 2px rgba(0,0,0,.15);` : ''}">
        <span class="bt" style="color:${c.fg}">${b.c}${b.warn ? ' ⚠' : ''}</span></div>`;
    }).join('') || (i === 6 ? '' : '');
    return `<div class="row"><div class="dcell"><div class="dn2"><span class="sd ${d.st}"></span>${d.n}</div>${compact ? '' : `<div style="font-size:9px;color:var(--text-muted)" class="num">${d.v}・稼働${util(i)}%</div>`}</div><div class="track">${blocks}</div></div>`;
  }).join('');
  return `<div class="tl">${head}<div class="tlbody">
    <div class="thead"><div class="l">トラック / ドライバー</div><div class="tk">${ticks.map(h => `<span class="t num" style="left:${pct(h)}%">${h}</span>`).join('')}</div></div>
    ${rows}</div></div>`;
}

/* 配色関数 */
const colSemantic = b => b.warn
  ? { bg: 'var(--blk)', fg: '#fff', ring: 'var(--warn)' }
  : b.st === 'confirmed' ? { bg: 'var(--blk)', fg: '#fff' } : { bg: '#bfe0d2', fg: '#0f5740' };
const colCalm = b => b.warn
  ? { bg: '#fde68a', fg: '#92400e', ring: 'var(--warn)' }
  : b.st === 'confirmed' ? { bg: '#94a3b8', fg: '#fff' } : { bg: '#e2e8f0', fg: '#475569' };
const heatColor = u => u >= 90 ? { bg: '#d97706', fg: '#fff' } : u >= 70 ? { bg: '#2f9b75', fg: '#fff' } : u >= 50 ? { bg: '#7cc6a6', fg: '#0f5740' } : { bg: '#cfe8db', fg: '#0f5740' };
const colHeat = (b, i) => b.warn ? { ...heatColor(util(i)), ring: 'var(--warn)' } : heatColor(util(i));

const GANTT_IDS = [0, 1, 2, 3, 4, 5, 6, 7];
const legendSemantic = `<div class="legend"><span><i style="background:var(--blk)"></i>確定</span><span><i style="background:#bfe0d2"></i>計画中</span><span><i style="background:var(--blk);box-shadow:inset 0 0 0 2px var(--warn)"></i>改善基準 警告</span></div>`;

/* ════════════ ① A＋C 2モード切替 — 俯瞰モード ════════════ */
function screenOverview() {
  const head = `<div class="rhead"><div class="rt">🚚 トラック・ドライバー</div>
    <div class="datemini"><span class="nb">‹</span>5月24日(土)<span class="nb">›</span></div>
    <div class="rsp"></div>${legendSemantic}
    <div class="stat" style="font-size:10.5px;color:var(--text-secondary)">割当済 <b class="num" style="color:var(--blk);font-size:13px">18</b>・稼働率 <b class="num" style="color:var(--blk);font-size:13px">82%</b></div></div>`;
  return doc(1360, 840, '', rail + `<div class="main">${brand}${dhMode('overview')}${reqStrip}
    <div class="board">${gantt(GANTT_IDS, colSemantic, { head })}</div></div>`);
}

/* ════════════ ① A＋C 2モード切替 — 要対応モード ════════════ */
const actionCSS = `
.cwrap{flex:1;overflow:hidden;padding:16px 22px;display:flex;flex-direction:column;gap:14px;background:var(--bg)}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:13px}
.kpi{background:#fff;border:1px solid var(--border);border-radius:12px;padding:13px 17px;position:relative;overflow:hidden}
.kpi .kl{font-size:11px;font-weight:700;color:var(--text-secondary)}
.kpi .kv{font-size:28px;font-weight:800;margin-top:3px}
.kpi .ks{font-size:10px;color:var(--text-muted);margin-top:2px}
.kpi.red{background:#fef2f2;border-color:#fecaca}.kpi.red .kv{color:var(--red)}
.kpi.amber{background:#fffbeb;border-color:#fde68a}.kpi.amber .kv{color:#b45309}
.kpi.green .kv{color:var(--blk)}
.kpi .bar{position:absolute;left:0;top:0;bottom:0;width:5px}
.kpi.red .bar{background:var(--red)}.kpi.amber .bar{background:#f59e0b}.kpi.green .bar{background:var(--accent)}
.panel{background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden}
.ptitle{display:flex;align-items:center;gap:8px;padding:11px 18px;border-bottom:1px solid var(--border);font-size:13px;font-weight:800}
.ptitle .cnt{font-size:11px;font-weight:800;background:var(--red);color:#fff;border-radius:20px;padding:1px 9px}
.erow{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid #f1f3f5}
.erow .sev{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.sev.r{background:var(--red)}.sev.o{background:var(--warn)}.sev.y{background:#eab308}
.erow .badge{font-size:9.5px;font-weight:800;padding:2px 8px;border-radius:6px;flex-shrink:0;width:118px;text-align:center}
.badge.r{background:#fee2e2;color:#b91c1c}.badge.o{background:#fef3c7;color:#92400e;border:1px solid #fcd34d}.badge.y{background:#fef9c3;color:#854d0e}
.erow .body{flex:1;min-width:0}
.erow .b1{font-size:12.5px;font-weight:700}
.erow .b2{font-size:10.5px;color:var(--text-secondary);margin-top:1px}
.erow .act{font-size:11px;font-weight:700;padding:6px 13px;border-radius:7px;background:var(--blk);color:#fff;flex-shrink:0}
.erow .act.ghost{background:#fff;color:var(--blk);border:1px solid var(--blk)}
.collapsed{display:flex;align-items:center;gap:10px;padding:13px 18px;background:#f5fdf9;border:1px dashed #bbf7d0;border-radius:12px;font-size:12px;font-weight:700;color:#065f46}
.collapsed .ar{margin-left:auto;color:var(--blk);font-size:11px;font-weight:800}
`;
function screenAction() {
  const exc = [
    { sev: 'r', badge: '未割当・緊急', bc: 'r', b1: '株式会社○○商事 　川口 → 横浜', b2: '09:00 必着 ／ パレット 800kg・常温', act: '配車する' },
    { sev: 'r', badge: '未割当・緊急', bc: 'r', b1: '△△食品株式会社 　船橋 → 大田', b2: '10:00 必着 ／ ケース 500kg・冷蔵', act: '配車する' },
    { sev: 'o', badge: '改善基準告示', bc: 'o', b1: '佐藤 四郎（3t）　富士物産 14:30–17:00', b2: '連続運転 4時間20分 ／ 休憩不足の見込み', act: '休憩を挿入', ghost: true },
    { sev: 'y', badge: '確定待ち', bc: 'y', b1: '関東物流センター 　山田 一郎（仮）14:00', b2: '計画のまま未確定 ／ 締切まで 3時間', act: 'ガントで確定', ghost: true },
    { sev: 'y', badge: '確定待ち', bc: 'y', b1: '東和ロジ 　中村 八郎（仮）13:30', b2: '計画のまま未確定 ／ 締切まで 5時間', act: 'ガントで確定', ghost: true },
  ];
  const rows = exc.map(e => `<div class="erow"><span class="sev ${e.sev}"></span><span class="badge ${e.bc}">${e.badge}</span>
    <div class="body"><div class="b1">${e.b1}</div><div class="b2">${e.b2}</div></div><span class="act ${e.ghost ? 'ghost' : ''}">${e.act} ›</span></div>`).join('');
  const body = `<div class="cwrap">
    <div class="kpis">
      <div class="kpi red"><div class="bar"></div><div class="kl">未割当案件</div><div class="kv num">6</div><div class="ks">うち緊急 2件</div></div>
      <div class="kpi amber"><div class="bar"></div><div class="kl">確定待ち</div><div class="kv num">5</div><div class="ks">計画のまま未確定</div></div>
      <div class="kpi amber"><div class="bar"></div><div class="kl">改善基準 警告</div><div class="kv num">1</div><div class="ks">連続運転オーバー</div></div>
      <div class="kpi green"><div class="bar"></div><div class="kl">稼働率</div><div class="kv num">82%</div><div class="ks">稼働 8台 / 確定 42件</div></div>
    </div>
    <div class="panel"><div class="ptitle">🔔 対応が必要な案件 <span class="cnt">8</span></div>${rows}
      <div class="erow" style="border-bottom:none;justify-content:center;color:var(--text-secondary);font-size:11px;font-weight:700">未割当 残り4件を表示 ▾</div></div>
    <div class="collapsed">✓ 確定済み 42件・稼働中 8台 は問題なし（折りたたみ中）<span class="ar">俯瞰モードで開く →</span></div>
  </div>`;
  return doc(1360, 840, actionCSS, rail + `<div class="main">${brand}${dhMode('action')}<div class="board">${body}</div></div>`);
}

/* ════════════ ② 配色の調整版（3パターン比較） ════════════ */
const cmpCSS = `
.chead{height:46px;background:#fff;border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 20px;gap:10px}
.chead b{font-size:15px;font-weight:800}
.chead span{font-size:11px;color:var(--text-secondary)}
.cbody{padding:14px 20px;display:flex;flex-direction:column;gap:12px;overflow:hidden}
.sec{border:1px solid var(--border);border-radius:11px;overflow:hidden;background:#fff}
.sec .sh{display:flex;align-items:center;gap:10px;padding:9px 14px;background:#fafbfc;border-bottom:1px solid var(--border)}
.sec .sh .tag{font-size:11px;font-weight:800;color:#fff;background:var(--blk);border-radius:6px;padding:3px 9px}
.sec .sh .nm{font-size:13px;font-weight:800}
.sec .sh .ds{font-size:10.5px;color:var(--text-secondary)}
.sec .gwrap{padding:6px 12px 10px}
.sec .legend{margin-left:auto}
.sec .tl{background:transparent}
.sec .row{height:34px;margin-bottom:3px}
.sec .dcell{padding:3px 8px}
.sec .track{height:34px}
.sec .blk{top:3px;bottom:3px}
.sec .thead{height:16px}.sec .thead .t{top:1px}
`;
function ganttMini(ids, colorFn, legend) {
  const ticks = [0, 6, 12, 18, 24];
  const rows = ids.map(i => {
    const d = drivers[i];
    const blocks = (asg[i] || []).map(b => {
      const c = colorFn(b, i);
      return `<div class="blk" style="left:${pct(b.s)}%;width:${pct(b.e - b.s)}%;background:${c.bg};${c.ring ? `box-shadow:inset 0 0 0 2px ${c.ring},0 1px 2px rgba(0,0,0,.15);` : ''}"><span class="bt" style="color:${c.fg}">${b.c}${b.warn ? ' ⚠' : ''}</span></div>`;
    }).join('');
    return `<div class="row"><div class="dcell"><div class="dn2"><span class="sd ${d.st}"></span>${d.n}</div></div><div class="track">${blocks}</div></div>`;
  }).join('');
  return `<div class="tl"><div class="tlbody" style="padding:4px 0">
    <div class="thead"><div class="l">ドライバー</div><div class="tk">${ticks.map(h => `<span class="t num" style="left:${pct(h)}%">${h}</span>`).join('')}</div></div>${rows}</div></div>`;
}
function screenPalette() {
  const ids = [0, 1, 3, 4, 7];
  const lg = (...items) => `<div class="legend">${items.map(([c, t, ring]) => `<span><i style="background:${c};${ring ? `box-shadow:inset 0 0 0 2px ${ring}` : ''}"></i>${t}</span>`).join('')}</div>`;
  const sec = (tag, nm, ds, gantt, legend) => `<div class="sec"><div class="sh"><span class="tag">${tag}</span><span class="nm">${nm}</span><span class="ds">${ds}</span>${legend}</div><div class="gwrap">${gantt}</div></div>`;
  const body = `<div class="cbody">
    ${sec('①', 'セマンティック（状態で色分け）', '確定/計画/警告を色で即判別。トリアージが速い＝既定の推奨', ganttMini(ids, colSemantic), lg(['var(--blk)', '確定'], ['#bfe0d2', '計画'], ['var(--blk)', '警告', 'var(--warn)']))}
    ${sec('②', 'カーム（モノトーン基調・色は要対応だけ）', '通常便はグレー。色は警告/緊急のみ＝色ノイズ最小で異常が際立つ', ganttMini(ids, colCalm), lg(['#94a3b8', '確定'], ['#e2e8f0', '計画'], ['#fde68a', '警告', 'var(--warn)']))}
    ${sec('③', '稼働ヒート（バー色＝その日の稼働率）', '薄→濃で詰まり具合。誰に余力があるか・過密(>90%)が色で分かる', ganttMini(ids, colHeat), lg(['#cfe8db', '〜50%'], ['#7cc6a6', '〜70%'], ['#2f9b75', '〜90%'], ['#d97706', '過密']))}
  </div>`;
  return doc(1180, 600, cmpCSS, `<div class="main" style="height:100%"><div class="chead"><b>配色の調整版</b><span>— 俯瞰ガント（案A）の色設計 3パターン。情報量は同じでも「色の使い方」で読み取りやすさが変わる</span></div>${body}</div>`);
}

/* ════════════ ③ しきい値の調整版（3プリセット比較） ════════════ */
const thCSS = `
.chead{height:46px;background:#fff;border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 20px;gap:10px}
.chead b{font-size:15px;font-weight:800}.chead span{font-size:11px;color:var(--text-secondary)}
.tbody{flex:1;padding:16px 20px;display:flex;gap:16px;overflow:hidden}
.col{flex:1;background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.col.std{border:2px solid var(--accent);box-shadow:0 4px 14px rgba(59,184,136,.15)}
.colh{padding:12px 15px;border-bottom:1px solid var(--border)}
.colh .pn{font-size:13.5px;font-weight:800;display:flex;align-items:center;gap:8px}
.colh .pn .rec{font-size:9.5px;font-weight:800;color:#fff;background:var(--accent);border-radius:5px;padding:2px 7px}
.colh .pd{font-size:10.5px;color:var(--text-secondary);margin-top:3px}
.cnt{display:flex;align-items:baseline;gap:6px;margin-top:9px}
.cnt b{font-size:30px;font-weight:800}.cnt.red b{color:var(--red)}.cnt.amber b{color:#b45309}.cnt.green b{color:var(--blk)}
.cnt span{font-size:11px;color:var(--text-secondary)}
.thset{padding:10px 15px;background:#fafbfc;border-bottom:1px solid var(--border)}
.thset .tt{font-size:10px;font-weight:800;color:var(--text-muted);margin-bottom:6px;letter-spacing:.03em}
.throw{display:flex;align-items:center;justify-content:space-between;font-size:10.5px;padding:3px 0}
.throw .k{color:var(--text-secondary)}
.throw .v{font-weight:800;font-family:'DejaVu Sans',sans-serif;background:#eef2f0;border-radius:5px;padding:2px 8px}
.throw .v.off{background:#f3f4f6;color:var(--text-muted)}
.elist{flex:1;padding:8px 12px;display:flex;flex-direction:column;gap:5px;overflow:hidden}
.eitem{display:flex;align-items:center;gap:8px;font-size:11px;padding:6px 9px;border-radius:7px;background:#fff;border:1px solid #f1f3f5}
.eitem .sev{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.sev.r{background:var(--red)}.sev.o{background:var(--warn)}.sev.y{background:#eab308}
.eitem .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
.eitem .tg{font-size:9px;font-weight:800;padding:1px 6px;border-radius:5px;flex-shrink:0}
.tg.r{background:#fee2e2;color:#b91c1c}.tg.o{background:#fef3c7;color:#92400e}.tg.y{background:#fef9c3;color:#854d0e}
.more{font-size:10.5px;color:var(--text-muted);text-align:center;padding:4px;font-weight:700}
`;
function screenThreshold() {
  const item = (sev, nm, tg, tc) => `<div class="eitem"><span class="sev ${sev}"></span><span class="nm">${nm}</span><span class="tg ${tc}">${tg}</span></div>`;
  const strict = [
    item('r', '○○商事 09:00必着', '緊急', 'r'), item('r', '△△食品 10:00必着', '緊急', 'r'),
    item('r', 'エコフレッシュ 15:00', '未割当', 'r'), item('r', '日東精工 09:00', '未割当', 'r'),
    item('o', '佐藤四郎 連続3h40m', '改善基準', 'o'), item('o', '中村八郎 連続3h30m', '改善基準', 'o'),
    item('y', '関東物流 締切18h', '確定待ち', 'y'), item('y', 'ABC機器 締切20h', '確定待ち', 'y'),
    item('y', '高橋五郎 稼働91%', '過密', 'y'),
  ];
  const std = [
    item('r', '○○商事 09:00必着', '緊急', 'r'), item('r', '△△食品 10:00必着', '緊急', 'r'),
    item('o', '佐藤四郎 連続4h20m', '改善基準', 'o'),
    item('y', '関東物流 締切3h', '確定待ち', 'y'), item('y', '東和ロジ 締切5h', '確定待ち', 'y'),
  ];
  const loose = [
    item('r', '○○商事 09:00必着', '緊急', 'r'), item('r', '△△食品 10:00必着', '緊急', 'r'),
    item('o', '佐藤四郎 連続4h30m超', '法令違反', 'o'),
  ];
  const thset = (a, b, c, d) => `<div class="thset"><div class="tt">表示条件（しきい値）</div>
    <div class="throw"><span class="k">確定待ち：締切まで</span><span class="v">${a}</span></div>
    <div class="throw"><span class="k">連続運転 警告</span><span class="v">${b}</span></div>
    <div class="throw"><span class="k">過密 警告：稼働率</span><span class="v ${c === '—' ? 'off' : ''}">${c}</span></div>
    <div class="throw"><span class="k">未割当の表示</span><span class="v">${d}</span></div></div>`;
  const col = (cls, name, rec, desc, cntcls, n, set, list, more) => `<div class="col ${cls}"><div class="colh">
    <div class="pn">${name}${rec ? '<span class="rec">推奨</span>' : ''}</div><div class="pd">${desc}</div>
    <div class="cnt ${cntcls}"><b class="num">${n}</b><span>件が「要対応」</span></div></div>
    ${set}<div class="elist">${list.join('')}${more ? `<div class="more">ほか ${more} 件 ▾</div>` : ''}</div></div>`;
  const body = `<div class="tbody">
    ${col('', '厳しめ', false, '広めに拾う・見逃さない運用', 'red', 14, thset('24時間', '3h30m', '≥90%', '全件'), strict, 5)}
    ${col('std', '標準', true, 'バランス重視（既定）', 'amber', 8, thset('12時間', '4h00m', '≥98%', '全件'), std, 3)}
    ${col('', '緩め', false, '本当に急ぎだけ・通知を絞る', 'green', 3, thset('4時間', '4h30m(法令)', '—', '緊急のみ'), loose, 0)}
  </div>`;
  return doc(1340, 660, thCSS, `<div class="main" style="height:100%"><div class="chead"><b>しきい値の調整版</b><span>— 同じ配車データでも「何を“要対応”とみなすか」の設定で、案Cに出てくる件数と中身が変わる</span></div>${body}</div>`);
}

/* ───────── 出力 ───────── */
const screens = [
  ['AC-1-overview', screenOverview(), 1360, 840],
  ['AC-2-action', screenAction(), 1360, 840],
  ['palette-variants', screenPalette(), 1180, 600],
  ['threshold-variants', screenThreshold(), 1340, 660],
];
const browser = await chromium.launch();
for (const [name, html, w, h] of screens) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const p = join(DIR, name + '.html');
  writeFileSync(p, html);
  await page.goto('file://' + p);
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(DIR, name + '.png') });
  await page.close();
  console.log('rendered', name);
}
await browser.close();
console.log('DONE');
