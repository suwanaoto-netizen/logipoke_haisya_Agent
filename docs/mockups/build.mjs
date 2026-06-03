// 配車計画表「情報量削減」提案モックアップ ジェネレータ
// 実アプリ(index.html)のデザイントークンを使って 現状 + 3案 を生成し、PNG化する。
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const W = 1360, H = 840;

/* ───────── サンプルデータ（実アプリの雰囲気に合わせる） ───────── */
const drivers = [
  { n: '山田 一郎', v: '2t 平ボディ',   cap: '最大 2,000kg',  st: 'busy' },
  { n: '鈴木 次郎', v: '4t 冷凍',       cap: '最大 4,000kg',  st: 'busy' },
  { n: '田中 三郎', v: '10t ウィング',  cap: '最大 10,000kg', st: 'busy' },
  { n: '佐藤 四郎', v: '3t 平ボディ',   cap: '最大 3,000kg',  st: 'busy' },
  { n: '高橋 五郎', v: '大型トレーラ',  cap: '最大 25,000kg', st: 'available' },
  { n: '伊藤 六郎', v: '2t 冷蔵',       cap: '最大 2,000kg',  st: 'busy' },
  { n: '渡辺 七郎', v: '4t 平ボディ',   cap: '最大 4,000kg',  st: 'available' },
  { n: '中村 八郎', v: '10t 平ボディ',  cap: '最大 10,000kg', st: 'busy' },
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
const cases = [
  { c: '株式会社○○商事', f: '埼玉県川口市', t: '神奈川県横浜市', time: '09:00', dur: '3h', goods: 'パレット/800kg/常温', dl: '05/25 AM指定', st: 'unprocessed', urgent: true },
  { c: '△△食品株式会社', f: '千葉県船橋市', t: '東京都大田区', time: '10:00', dur: '4h', goods: 'ケース/500kg/冷蔵', dl: '05/24 PM指定', st: 'unprocessed', urgent: true },
  { c: '株式会社□□製作所', f: '茨城県つくば市', t: '愛知県名古屋市', time: '07:00', dur: '8h', goods: '機械部品/1200kg/常温', dl: '05/25 終日', st: 'processing' },
  { c: '関東物流センター', f: '東京都江東区', t: '千葉県千葉市', time: '13:00', dur: '2h', goods: 'パレット/600kg/常温', dl: '本日 17:00', st: 'processing' },
  { c: 'エコフレッシュ食品', f: '神奈川県川崎市', t: '静岡県静岡市', time: '15:00', dur: '3h', goods: '飲料/1000kg/冷蔵', dl: '明日 AM指定', st: 'unprocessed' },
  { c: '明和産業株式会社', f: '埼玉県さいたま市', t: '東京都品川区', time: '10:00', dur: '3h', goods: '電子部品/300kg/精密', dl: '本日中', st: 'processing' },
  { c: '日東精工', f: '東京都大田区', t: '埼玉県川口市', time: '09:00', dur: '2.5h', goods: '金属部品/900kg', dl: '明日 終日', st: 'unprocessed' },
  { c: '中央運送株式会社', f: '神奈川県横浜市', t: '宮城県仙台市', time: '06:00', dur: '5h', goods: '雑貨/2000kg', dl: '本日 夕方', st: 'processing' },
];

const pct = h => (h / 24 * 100);
const stLabel = { unprocessed: '未処理', processing: '処理中', confirmed: '確定済', planned: '計画' };

/* ───────── 共有CSS（実アプリ index.html の :root トークンを踏襲） ───────── */
const BASE = `
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --sidebar-bg:#1A6B56;--accent:#3BB888;--accent-pale:#EAF5F0;--header-bg:#0D4A3A;
  --text-primary:#1a1a1a;--text-secondary:#6b7280;--text-muted:#9ca3af;
  --border:#e5e7eb;--bg:#f4f6f8;--orange:#f97316;--green:#16a34a;--red:#dc2626;
  --blk:#1a7a5e;
}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:var(--bg);
  font-family:'IPAPGothic','IPAGothic','WenQuanYi Zen Hei',sans-serif;color:var(--text-primary);
  -webkit-font-smoothing:antialiased;}
.num{font-family:'DejaVu Sans',sans-serif;font-feature-settings:'tnum'}
.app{display:flex;height:${H}px}
/* 左レール */
.rail{width:54px;background:var(--header-bg);display:flex;flex-direction:column;align-items:center;padding-top:10px;gap:4px;flex-shrink:0}
.rail .logo{width:30px;height:30px;border-radius:7px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;margin-bottom:8px}
.rail .ic{width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#bfe6d6;opacity:.7}
.rail .ic.on{background:rgba(255,255,255,.14);color:#fff;opacity:1}
.main{flex:1;display:flex;flex-direction:column;min-width:0}
/* ブランドバー */
.brand{height:38px;background:var(--header-bg);display:flex;align-items:center;padding:0 16px;color:#eaf5f0;gap:10px;flex-shrink:0}
.brand b{font-size:13px;font-weight:800;letter-spacing:.02em}
.brand .sp{flex:1}
.brand .u{width:24px;height:24px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:700}
/* 配車ヘッダー */
.dh{height:50px;background:#fff;border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 18px;gap:12px;flex-shrink:0}
.dh .ttl{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:800}
.dh .ttl .dot{width:16px;height:16px;border-radius:50%;border:2.5px solid var(--blk)}
.dh .btn{font-size:11px;font-weight:700;padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:#fff;color:var(--text-secondary);display:flex;align-items:center;gap:5px}
.dh .btn.green{background:var(--blk);color:#fff;border-color:var(--blk)}
.dh .sp{flex:1}
.tabs{display:flex;gap:6px}
.tab{font-size:12px;font-weight:700;padding:6px 12px;border-radius:7px;display:flex;align-items:center;gap:6px;color:var(--text-secondary);border:1px solid transparent}
.tab.on{background:var(--blk);color:#fff}
.tab .b{font-size:10px;font-weight:800;padding:1px 7px;border-radius:20px}
.tab.on .b{background:var(--red);color:#fff}
.tab .b.g{background:#e5e7eb;color:var(--text-secondary)}
/* サブタブ */
.subs{height:38px;background:#fff;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:4px;padding:0 18px;flex-shrink:0}
.sub{font-size:11.5px;font-weight:700;padding:6px 11px;border-radius:6px 6px 0 0;color:var(--text-secondary);display:flex;align-items:center;gap:5px}
.sub.on{color:var(--blk);border-bottom:2px solid var(--blk)}
.sub .dd{font-size:8.5px;font-weight:800;padding:1px 5px;border-radius:9px;background:var(--accent);color:#fff}
/* ボード */
.board{flex:1;display:flex;min-height:0;overflow:hidden}
/* タイムライン共通 */
.tl{flex:1;display:flex;flex-direction:column;min-width:0;background:#fff;overflow:hidden}
.rhead{height:46px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;padding:0 14px;flex-shrink:0}
.rhead .rt{font-size:12px;font-weight:800;display:flex;align-items:center;gap:6px}
.datenav{display:flex;align-items:center;gap:3px}
.datenav .nb{width:20px;height:22px;border:1px solid var(--border);border-radius:5px;background:#fff;color:var(--text-secondary);font-size:11px;display:flex;align-items:center;justify-content:center}
.datenav .today{font-size:10.5px;font-weight:700;padding:3px 9px;border:1px solid var(--border);border-radius:5px;color:var(--text-secondary)}
.pill{background:#1A6B56;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;display:flex;align-items:center;gap:5px}
.dlabel{font-size:11px;font-weight:800;min-width:120px;text-align:center}
.strip{display:flex;gap:3px}
.chip{min-width:30px;display:flex;flex-direction:column;align-items:center;padding:2px 4px;border-radius:5px;font-size:7px;color:var(--text-muted)}
.chip .d{font-size:11px;font-weight:800;color:var(--text-primary)}
.chip.on{background:#1A6B56}.chip.on *{color:#fff}
.chip.tdy{background:var(--accent-pale)}
.rsp{flex:1}
.stat{font-size:10.5px;color:var(--text-secondary)}
.stat b{font-size:13px;color:var(--blk);font-weight:800}
.tlbody{flex:1;overflow:hidden;padding:6px 0}
.thead{display:grid;grid-template-columns:150px 1fr;height:22px;border-bottom:1px solid var(--border)}
.thead .l{font-size:9.5px;font-weight:700;color:var(--text-muted);padding:5px 10px}
.tk{position:relative}
.tk .t{position:absolute;top:3px;transform:translateX(-50%);font-size:9px;font-weight:700;color:var(--text-muted)}
.row{display:grid;grid-template-columns:150px 1fr;margin-bottom:4px;height:52px}
.dcell{display:flex;flex-direction:column;justify-content:center;gap:1px;padding:4px 8px;background:#fafbfc;border:1px solid var(--border);border-right:none;border-radius:8px 0 0 8px}
.dn{font-size:11px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dv{font-size:9.5px;color:var(--text-muted)}
.dl2{display:flex;align-items:center;gap:6px}
.ds{font-size:9px;font-weight:700;display:inline-flex;align-items:center;gap:3px}
.ds::before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor}
.ds.available{color:var(--green)}.ds.busy{color:var(--orange)}
.dcap{font-size:9px;color:var(--text-muted)}
.track{position:relative;height:52px;border:1px solid var(--border);border-left:none;border-radius:0 8px 8px 0;background-color:#fbfcfd;
  background-image:repeating-linear-gradient(90deg,transparent,transparent calc(100%/24 - 1px),#eef0f3 calc(100%/24 - 1px),#eef0f3 calc(100%/24)),
   repeating-linear-gradient(90deg,transparent,transparent calc(100%/8 - 1px),#d1d5db calc(100%/8 - 1px),#d1d5db calc(100%/8))}
.blk{position:absolute;top:3px;bottom:3px;border-radius:5px;display:flex;flex-direction:column;justify-content:center;padding:0 7px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.15);background:var(--blk)}
.blk .bt{font-size:10.5px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;position:relative;z-index:2}
.blk .bs{font-size:9px;color:rgba(255,255,255,.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;position:relative;z-index:2}
.segs{position:absolute;inset:0;display:flex;border-radius:inherit;overflow:hidden;z-index:1}
.seg{height:100%}
.seg.load{background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0) 0 4px,rgba(255,255,255,.35) 4px 8px);border-right:1px dashed rgba(255,255,255,.75)}
.seg.drive{border-right:1px dashed rgba(255,255,255,.75)}
.seg.unload{background-image:repeating-linear-gradient(-45deg,rgba(0,0,0,0) 0 4px,rgba(0,0,0,.22) 4px 8px)}
.blk.conf{box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.4),0 1px 3px rgba(0,0,0,.15)}
.blk.warn{box-shadow:0 0 0 2px var(--red),0 1px 3px rgba(0,0,0,.25)}
`;

/* ───────── 部品 ───────── */
const rail = on => `<aside class="rail">
  <div class="logo">ロ</div>
  ${['🏠','📋','🚚','📞','📊','⚙'].map((e,i)=>`<div class="ic ${i===2?'on':''}">${e}</div>`).join('')}
</aside>`;

const brand = `<div class="brand"><b>ロジポケ配車Agent</b><span class="sp"></span>
  <span style="font-size:11px;opacity:.85">2026/06/03</span><span class="u">配</span></div>`;

const dh = (extraRight='', showNew=true) => `<div class="dh">
  <div class="ttl"><span class="dot"></span>配車計画表</div>
  ${showNew?`<button class="btn green">＋ 新規登録</button>`:''}
  <span class="sp"></span>
  <div class="tabs">
    <div class="tab on">▦ 計画中 <span class="b">6</span></div>
    <div class="tab">✓ 請求確定済み <span class="b g">3</span></div>
  </div>
  ${extraRight}
</div>`;

const subs = `<div class="subs">
  <div class="sub on">≡ 配車割当 <span class="dd">D&D</span></div>
  <div class="sub">▦ 運行スケジュール</div>
  <div class="sub">◎ 動態管理</div>
  <div class="sub">💬 連絡状況</div>
</div>`;

const rheadFull = `<div class="rhead">
  <div class="rt">🚚 トラック・ドライバー</div>
  <div class="datenav">
    <div class="nb">‹‹</div><div class="nb">‹</div><div class="today">今日</div><div class="nb">›</div><div class="nb">››</div>
    <div class="pill">📅 2026年5月 ▾</div>
    <div class="dlabel">5月24日(土)</div>
  </div>
  <div class="strip">
    ${['22日','23日','24日','25日','26日','27日'].map((d,i)=>`<div class="chip ${i===2?'on':''}"><span>${['木','金','土','日','月','火'][i]}</span><span class="d">${24-2+i}</span><span>${[3,5,6,2,4,1][i]}件</span></div>`).join('')}
  </div>
  <div class="rsp"></div>
  <div class="stat">割当済 <b class="num">18</b></div>
  <div class="stat">稼働率 <b class="num">82%</b></div>
</div>`;

/* タイムライン本体 */
function timeline(rowFn, headRight = rheadFull, opts = {}) {
  const ticks = [0, 3, 6, 9, 12, 15, 18, 21, 24];
  return `<div class="tl">
    ${headRight}
    <div class="tlbody">
      <div class="thead"><div class="l">トラック / ドライバー</div>
        <div class="tk">${ticks.map(h => `<span class="t num" style="left:${pct(h)}%">${h}</span>`).join('')}</div></div>
      ${drivers.map((d, i) => rowFn(d, i)).join('')}
    </div>
  </div>`;
}

/* ════════════ 現状（参考） ════════════ */
function rowCurrent(d, i) {
  const blocks = (asg[i] || []).map(b => {
    const w = pct(b.e - b.s), lw = Math.min(22, 100 * 0.5 / (b.e - b.s)), uw = lw * 0.9;
    return `<div class="blk ${b.st === 'confirmed' ? 'conf' : ''} ${b.warn ? 'warn' : ''}" style="left:${pct(b.s)}%;width:${w}%;background:var(--blk)">
      <div class="segs"><div class="seg load" style="width:${lw}%"></div><div class="seg drive" style="flex:1"></div><div class="seg unload" style="width:${uw}%"></div></div>
      <div class="bt">${b.c}${b.warn ? ' ⚠' : ''}</div><div class="bs">${b.f}→${b.t}</div>
    </div>`;
  }).join('');
  return `<div class="row">
    <div class="dcell">
      <div class="dn">${d.n}</div><div class="dv num">${d.v}</div>
      <div class="dl2"><span class="ds ${d.st}">${d.st === 'available' ? '空き' : '稼働中'}</span><span class="dcap num">${d.cap}</span></div>
    </div>
    <div class="track">${blocks}</div>
  </div>`;
}
function cardCurrent(c) {
  return `<div class="cardc">
    <div class="ch"><span class="cc">${c.c}</span><span class="cst ${c.st}">${stLabel[c.st]}</span></div>
    <div class="cr">📍 ${c.f} → ${c.t}</div>
    <div class="cm"><span class="cp time num">⏱ ${c.time}</span><span class="cp num">${c.dur}</span>${c.urgent ? '<span class="cp urg">緊急</span>' : ''}</div>
    <div class="cg">📦 ${c.goods}</div>
    <div class="cg">🕒 納期: ${c.dl}</div>
    <div class="crow"><span class="cedit">✎ 編集</span><span class="csrc">🎙 AI受付</span></div>
  </div>`;
}
const leftCurrentCSS = `
.lpanel{width:300px;border-right:1px solid var(--border);background:#fff;display:flex;flex-direction:column;flex-shrink:0}
.lh{padding:9px 11px;border-bottom:1px solid var(--border)}
.lt{font-size:12px;font-weight:800;display:flex;align-items:center;gap:6px}
.lt .lb{font-size:10px;font-weight:800;background:var(--red);color:#fff;padding:1px 7px;border-radius:20px}
.lsub{font-size:9.5px;color:var(--text-muted);margin:3px 0 7px}
.lfil{display:flex;gap:5px;margin-bottom:7px}
.fc{font-size:9.5px;font-weight:700;padding:3px 8px;border-radius:13px;border:1px solid var(--border);color:var(--text-secondary)}
.fc.on{background:var(--blk);color:#fff;border-color:var(--blk)}
.lsearch{display:flex;align-items:center;gap:6px;border:1px solid var(--border);border-radius:7px;padding:5px 9px;font-size:10px;color:var(--text-muted)}
.llist{flex:1;overflow:hidden;padding:8px 10px;display:flex;flex-direction:column;gap:8px}
.cardc{border:1.5px solid var(--border);border-radius:8px;padding:8px 10px}
.ch{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:5px}
.cc{font-size:11px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cst{font-size:8.5px;font-weight:700;padding:1px 6px;border-radius:8px;flex-shrink:0}
.cst.unprocessed{background:#fee2e2;color:#b91c1c}.cst.processing{background:#fef3c7;color:#92400e}
.cr{font-size:10px;color:var(--text-secondary);margin-bottom:4px}
.cm{display:flex;gap:6px;margin-bottom:4px}
.cp{font-size:9px;font-weight:600;padding:1px 6px;border-radius:4px;background:#f3f4f6;color:var(--text-secondary)}
.cp.time{background:#eff6ff;color:#1e40af}.cp.urg{background:#fef2f2;color:#b91c1c;font-weight:700}
.cg{font-size:9.5px;color:var(--text-secondary);margin-bottom:2px}
.crow{display:flex;gap:6px;margin-top:5px}
.cedit{font-size:9px;font-weight:600;padding:2px 7px;border:1px solid var(--border);border-radius:5px;color:var(--text-secondary)}
.csrc{font-size:9px;font-weight:700;padding:2px 7px;border-radius:9px;background:#eafaf3;color:#0d7a52;border:1px solid #b6e6d3}
`;
function screenCurrent() {
  const left = `<div class="lpanel">
    <div class="lh">
      <div class="lt">☑ 未割当案件 <span class="lb">12</span></div>
      <div class="lsub">案件カードを右のトラックにドラッグして配車</div>
      <div class="lfil"><span class="fc on">すべて</span><span class="fc">未処理・処理中</span><span class="fc">処理済み 0</span></div>
      <div class="lsearch">🔍 荷主名で検索（例：商事、食品）</div>
    </div>
    <div class="llist">${cases.map(cardCurrent).join('')}</div>
  </div>`;
  return doc('現状（参考）', leftCurrentCSS, rail() + `<div class="main">${brand}${dh(`<button class="btn">📄 運行指示書を出力</button><button class="btn">個別案件処理へ ›</button>`)}${subs}
    <div class="board">${left}${timeline(rowCurrent)}</div></div>`);
}

/* ════════════ 案A：色バーだけミニマル・ガント ════════════ */
const aCSS = `
.lpanel{width:188px;border-right:1px solid var(--border);background:#fff;display:flex;flex-direction:column;flex-shrink:0}
.lh{padding:9px 11px;border-bottom:1px solid var(--border)}
.lt{font-size:12px;font-weight:800;display:flex;align-items:center;gap:6px}
.lt .lb{font-size:10px;font-weight:800;background:var(--red);color:#fff;padding:1px 7px;border-radius:20px}
.llist{flex:1;overflow:hidden;padding:6px 8px;display:flex;flex-direction:column;gap:4px}
.lrow{display:flex;align-items:center;gap:7px;padding:6px 8px;border-radius:6px;border:1px solid var(--border)}
.lrow .ud{width:7px;height:7px;border-radius:50%;background:var(--text-muted);flex-shrink:0}
.lrow.urg .ud{background:var(--red)}
.lrow .lc{font-size:11px;font-weight:700;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lrow .lt2{font-size:10px;color:var(--text-secondary)}
/* ブロック=色バーのみ */
.row .blk{box-shadow:0 1px 2px rgba(0,0,0,.12);border-radius:4px}
.row .blk.plan{background:#bfe0d2}
.row .blk .bt{font-size:9.5px;font-weight:700;opacity:.92}
.row .blk.plan .bt{color:#0f5740}
.dn2{font-size:11px;font-weight:800;display:flex;align-items:center;gap:5px}
.dn2 .sd{width:6px;height:6px;border-radius:50%}
.dn2 .sd.busy{background:var(--orange)}.dn2 .sd.available{background:var(--green)}
.dcell.mini{justify-content:center}
/* ホバー詳細ピーク */
.peek{position:absolute;background:#1f2937;color:#f9fafb;border-radius:9px;padding:9px 12px;width:210px;font-size:10.5px;line-height:1.5;box-shadow:0 10px 28px rgba(0,0,0,.32);z-index:50}
.peek .pt{font-size:12px;font-weight:800;margin-bottom:3px}
.peek .pr{color:#cbd5e1}
.peek b{color:#fff}
.legend{display:flex;align-items:center;gap:12px;font-size:10px;color:var(--text-secondary)}
.legend i{display:inline-block;width:12px;height:10px;border-radius:3px;vertical-align:-1px;margin-right:4px}
`;
function rowA(d, i) {
  const blocks = (asg[i] || []).map(b => {
    const isPlan = b.st !== 'confirmed';
    return `<div class="blk ${isPlan ? 'plan' : ''} ${b.warn ? 'warn' : ''}" style="left:${pct(b.s)}%;width:${pct(b.e - b.s)}%">
      <div class="bt">${b.c}${b.warn ? ' ⚠' : ''}</div></div>`;
  }).join('');
  return `<div class="row">
    <div class="dcell mini"><div class="dn2"><span class="sd ${d.st}"></span>${d.n}</div></div>
    <div class="track">${blocks}</div>
  </div>`;
}
function screenA() {
  const left = `<div class="lpanel">
    <div class="lh"><div class="lt">未割当 <span class="lb">12</span></div></div>
    <div class="llist">${cases.map(c => `<div class="lrow ${c.urgent ? 'urg' : ''}"><span class="ud"></span><span class="lc">${c.c.replace(/株式会社|＝/g, '')}</span><span class="lt2 num">${c.time}</span></div>`).join('')}</div>
  </div>`;
  // 詳細ピーク（1ブロック上に開いた状態を例示）：山田一郎の○○商事 09:20 付近
  const peek = `<div class="peek" style="left:368px;top:150px">
    <div class="pt">○○商事</div>
    <div class="pr">📍 川口 → 横浜</div>
    <div class="pr">⏱ <b>09:20–12:20</b>（3h）</div>
    <div class="pr">📦 パレット 800kg / 常温</div>
    <div class="pr">✓ <b>確定済み</b></div>
  </div>`;
  const head = `<div class="rhead">
    <div class="rt">🚚 トラック・ドライバー</div>
    <div class="datenav"><div class="nb">‹</div><div class="dlabel">5月24日(土)</div><div class="nb">›</div></div>
    <div class="rsp"></div>
    <div class="legend"><span><i style="background:var(--blk)"></i>確定</span><span><i style="background:#bfe0d2"></i>計画中</span><span><i style="box-shadow:0 0 0 2px var(--red);background:var(--blk)"></i>警告</span></div>
  </div>`;
  return doc('案A：色バーだけミニマル・ガント', aCSS, rail() + `<div class="main">${brand}${dh('', false)}
    <div class="board" style="position:relative">${left}${timeline(rowA, head)}${peek}</div></div>`);
}

/* ════════════ 案B：ドライバー別 1行サマリ ════════════ */
const bCSS = `
.blist{flex:1;background:#fff;overflow:hidden;display:flex;flex-direction:column}
.bbanner{display:flex;align-items:center;gap:10px;padding:9px 16px;background:#fff7ed;border-bottom:1px solid #fed7aa;font-size:11.5px;color:#9a3412;font-weight:700}
.bbanner .bg2{margin-left:auto;font-size:10.5px;font-weight:700;color:#9a3412;border:1px solid #fdba74;border-radius:6px;padding:4px 10px}
.bhd{display:grid;grid-template-columns:200px 96px 1fr 150px 70px;gap:12px;padding:8px 18px;border-bottom:1px solid var(--border);font-size:10px;font-weight:700;color:var(--text-muted)}
.brow{display:grid;grid-template-columns:200px 96px 1fr 150px 70px;gap:12px;padding:11px 18px;border-bottom:1px solid #f1f3f5;align-items:center}
.brow:nth-child(even){background:#fcfdfe}
.bd{display:flex;align-items:center;gap:8px}
.bd .sd{width:8px;height:8px;border-radius:50%}
.bd .sd.busy{background:var(--orange)}.bd .sd.available{background:var(--green)}
.bd .nm{font-size:12.5px;font-weight:800}
.bd .vv{font-size:9.5px;color:var(--text-muted)}
.vch{font-size:10px;font-weight:700;color:var(--text-secondary);background:#f3f4f6;border-radius:5px;padding:3px 8px;text-align:center}
.cnt{display:flex;align-items:center;gap:6px}
.cnt .dots{display:flex;gap:3px}
.cnt .o{width:14px;height:14px;border-radius:4px;background:var(--blk)}
.cnt .o.p{background:#bfe0d2}
.cnt .cn{font-size:11px;color:var(--text-secondary);margin-left:4px}
.gauge{height:9px;border-radius:5px;background:#eef0f3;overflow:hidden;margin-top:6px;width:100%}
.gauge>i{display:block;height:100%;background:var(--accent)}
.gtx{font-size:10px;color:var(--text-secondary);margin-top:3px}
.nx{font-size:11px;font-weight:700}
.nx .tm{color:var(--blk)}
.nx .ds3{font-size:9.5px;color:var(--text-muted)}
.free{font-size:11px;font-weight:800;text-align:right}
.free.ok{color:var(--green)}.free.no{color:var(--text-muted)}
`;
function screenB() {
  const data = drivers.map((d, i) => {
    const a = asg[i] || [];
    const busyH = a.reduce((s, b) => s + (b.e - b.s), 0);
    const rate = Math.min(100, Math.round(busyH / 11 * 100));
    const next = a.find(b => b.st === 'planned') || a[0];
    const conf = a.filter(b => b.st === 'confirmed').length, plan = a.length - conf;
    return { d, n: a.length, conf, plan, rate, next, free: Math.max(0, 11 - busyH) };
  });
  const rows = data.map(x => `<div class="brow">
    <div class="bd"><span class="sd ${x.d.st}"></span><div><div class="nm">${x.d.n}</div><div class="vv num">${x.d.v}</div></div></div>
    <div class="vch num">${x.d.cap.replace('最大 ', '')}</div>
    <div>
      <div class="cnt"><div class="dots">${Array.from({ length: x.conf }).map(() => '<span class="o"></span>').join('')}${Array.from({ length: x.plan }).map(() => '<span class="o p"></span>').join('')}${x.n === 0 ? '<span style="font-size:10.5px;color:var(--text-muted)">割当なし</span>' : ''}</div><span class="cn num">${x.n}件</span></div>
      <div class="gauge"><i style="width:${x.rate}%"></i></div>
      <div class="gtx">稼働 <b class="num">${x.rate}%</b></div>
    </div>
    <div class="nx">${x.next ? `<span class="tm num">${String(Math.floor(x.next.s)).padStart(2, '0')}:${String(Math.round((x.next.s % 1) * 60)).padStart(2, '0')}</span> ${x.next.c}<div class="ds3">${x.next.f}→${x.next.t}${x.next.warn ? ' ⚠改善基準' : ''}</div>` : '<span style="color:var(--text-muted)">予定なし</span>'}</div>
    <div class="free ${x.free > 1 ? 'ok' : 'no'} num">${x.free > 1 ? '空 ' + x.free.toFixed(1) + 'h' : '—'}</div>
  </div>`).join('');
  const body = `<div class="blist">
    <div class="bbanner">⚠ 未割当 6件（うち緊急2件）が配車待ちです<span class="bg2">未割当を割り当てる ›</span></div>
    <div class="bhd"><div>ドライバー / 車両</div><div>積載</div><div>割当・稼働率</div><div>次の出発</div><div>空き</div></div>
    ${rows}
  </div>`;
  return doc('案B：ドライバー別 1行サマリ', bCSS, rail() + `<div class="main">${brand}${dh('', false)}
    <div class="board">${body}</div></div>`);
}

/* ════════════ 案C：要対応だけの例外フォーカス ════════════ */
const cCSS = `
.cwrap{flex:1;overflow:hidden;padding:18px 22px;display:flex;flex-direction:column;gap:16px;background:var(--bg)}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.kpi{background:#fff;border:1px solid var(--border);border-radius:12px;padding:15px 18px;position:relative;overflow:hidden}
.kpi .kl{font-size:11px;font-weight:700;color:var(--text-secondary)}
.kpi .kv{font-size:30px;font-weight:800;margin-top:4px}
.kpi .ks{font-size:10px;color:var(--text-muted);margin-top:2px}
.kpi.red{background:#fef2f2;border-color:#fecaca}.kpi.red .kv{color:var(--red)}
.kpi.amber{background:#fffbeb;border-color:#fde68a}.kpi.amber .kv{color:#b45309}
.kpi.green .kv{color:var(--blk)}
.kpi .bar{position:absolute;left:0;top:0;bottom:0;width:5px}
.kpi.red .bar{background:var(--red)}.kpi.amber .bar{background:#f59e0b}.kpi.green .bar{background:var(--accent)}
.panel{background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden}
.ptitle{display:flex;align-items:center;gap:8px;padding:12px 18px;border-bottom:1px solid var(--border);font-size:13px;font-weight:800}
.ptitle .cnt{font-size:11px;font-weight:800;background:var(--red);color:#fff;border-radius:20px;padding:1px 9px}
.erow{display:flex;align-items:center;gap:12px;padding:13px 18px;border-bottom:1px solid #f1f3f5}
.erow .sev{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.sev.r{background:var(--red)}.sev.o{background:var(--orange)}.sev.y{background:#eab308}
.erow .badge{font-size:9.5px;font-weight:800;padding:2px 8px;border-radius:6px;flex-shrink:0;width:118px;text-align:center}
.badge.r{background:#fee2e2;color:#b91c1c}.badge.o{background:#ffedd5;color:#9a3412}.badge.y{background:#fef9c3;color:#854d0e}
.erow .body{flex:1;min-width:0}
.erow .b1{font-size:12.5px;font-weight:700}
.erow .b2{font-size:10.5px;color:var(--text-secondary);margin-top:1px}
.erow .act{font-size:11px;font-weight:700;padding:6px 14px;border-radius:7px;background:var(--blk);color:#fff;flex-shrink:0}
.erow .act.ghost{background:#fff;color:var(--blk);border:1px solid var(--blk)}
.collapsed{display:flex;align-items:center;gap:10px;padding:14px 18px;background:#f5fdf9;border:1px dashed #bbf7d0;border-radius:12px;font-size:12px;font-weight:700;color:#065f46}
.collapsed .ar{margin-left:auto;color:var(--text-muted);font-size:11px;font-weight:700}
`;
function screenC() {
  const exc = [
    { sev: 'r', badge: '未割当・緊急', bc: 'r', b1: '株式会社○○商事 　川口 → 横浜', b2: '09:00 必着 ／ パレット 800kg ・常温 ／ 受付 30分前', act: '配車する' },
    { sev: 'r', badge: '未割当・緊急', bc: 'r', b1: '△△食品株式会社 　船橋 → 大田', b2: '10:00 必着 ／ ケース 500kg ・冷蔵', act: '配車する' },
    { sev: 'o', badge: '改善基準告示', bc: 'o', b1: '佐藤 四郎（3t）　富士物産 14:30–17:00', b2: '連続運転 4時間20分 ／ 休憩不足の見込み', act: '休憩を挿入', ghost: true },
    { sev: 'y', badge: '確定待ち', bc: 'y', b1: '関東物流センター 　山田 一郎（仮）14:00', b2: '計画のまま未確定 ／ 締切まで 3時間', act: '確定', ghost: true },
    { sev: 'y', badge: '確定待ち', bc: 'y', b1: '東和ロジ 　中村 八郎（仮）13:30', b2: '計画のまま未確定 ／ 締切まで 5時間', act: '確定', ghost: true },
  ];
  const rows = exc.map(e => `<div class="erow">
    <span class="sev ${e.sev}"></span>
    <span class="badge ${e.bc}">${e.badge}</span>
    <div class="body"><div class="b1">${e.b1}</div><div class="b2">${e.b2}</div></div>
    <span class="act ${e.ghost ? 'ghost' : ''}">${e.act} ›</span>
  </div>`).join('');
  const body = `<div class="cwrap">
    <div class="kpis">
      <div class="kpi red"><div class="bar"></div><div class="kl">未割当案件</div><div class="kv num">6</div><div class="ks">うち緊急 2件</div></div>
      <div class="kpi amber"><div class="bar"></div><div class="kl">確定待ち</div><div class="kv num">5</div><div class="ks">計画のまま未確定</div></div>
      <div class="kpi amber"><div class="bar"></div><div class="kl">改善基準 警告</div><div class="kv num">1</div><div class="ks">連続運転オーバー</div></div>
      <div class="kpi green"><div class="bar"></div><div class="kl">稼働率</div><div class="kv num">82%</div><div class="ks">稼働 8台 / 確定 42件</div></div>
    </div>
    <div class="panel">
      <div class="ptitle">🔔 対応が必要な案件 <span class="cnt">8</span></div>
      ${rows}
      <div class="erow" style="border-bottom:none;justify-content:center;color:var(--text-secondary);font-size:11px;font-weight:700">未割当 残り4件を表示 ▾</div>
    </div>
    <div class="collapsed">✓ 確定済み 42件・稼働中 8台 は問題なし（折りたたみ中）<span class="ar">タイムラインで開く ›</span></div>
  </div>`;
  return doc('案C：要対応だけの例外フォーカス', cCSS, rail() + `<div class="main">${brand}${dh('', false)}
    <div class="board">${body}</div></div>`);
}

/* ───────── ドキュメント枠 ───────── */
function doc(title, css, inner) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${title}</title>
  <style>${BASE}${css}</style></head><body><div class="app">${inner}</div></body></html>`;
}

/* ───────── 出力 ───────── */
const screens = [
  ['00-current', screenCurrent()],
  ['A-minimal-gantt', screenA()],
  ['B-driver-summary', screenB()],
  ['C-exception-focus', screenC()],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
for (const [name, html] of screens) {
  const htmlPath = join(DIR, name + '.html');
  writeFileSync(htmlPath, html);
  await page.goto('file://' + htmlPath);
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(DIR, name + '.png') });
  console.log('rendered', name);
}
await browser.close();
console.log('DONE');
