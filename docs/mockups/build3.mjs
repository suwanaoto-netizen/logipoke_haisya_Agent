// 配車計画表「表示設定（カスタマイズ）」モック
//  ① 表示設定タブページ（連絡状況の横に追加） ② 最小構成を適用した配車表
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const DIR = dirname(fileURLToPath(import.meta.url));

/* データ */
const drivers = ['山田 一郎', '鈴木 次郎', '田中 三郎', '佐藤 四郎', '高橋 五郎', '伊藤 六郎', '渡辺 七郎', '中村 八郎', '小林 九郎'];
const asg = {
  0: [{ c: '○○商事', s: 9.33, e: 12.33, st: 'c' }, { c: '関東物流', s: 14, e: 17.5, st: 'p' }],
  1: [{ c: '△△食品', s: 8, e: 12.5, st: 'c' }, { c: 'エコフレッシュ', s: 15, e: 18, st: 'p' }],
  2: [{ c: '□□製作所', s: 7, e: 15, st: 'c' }],
  3: [{ c: '明和産業', s: 10, e: 13, st: 'p' }, { c: '富士物産', s: 14.5, e: 17, st: 'p', warn: true }],
  4: [{ c: '中央運送', s: 6, e: 11, st: 'c' }],
  5: [{ c: '日東精工', s: 9, e: 11.5, st: 'c' }, { c: 'ABC機器', s: 13, e: 16.5, st: 'p' }],
  6: [],
  7: [{ c: 'XYZ部品', s: 8.5, e: 12, st: 'c' }, { c: '東和ロジ', s: 13.5, e: 18.5, st: 'p' }],
  8: [{ c: '日新運輸', s: 7.5, e: 10, st: 'c' }],
};
// 最小構成の未割当カード（取引先名 + AI推薦 + 協力会社依頼ボタン のみ）
const cards = [
  { c: '株式会社○○商事', ai: '山田 一郎 09:20〜' },
  { c: '△△食品株式会社', ai: '鈴木 次郎 10:00〜' },
  { c: '株式会社□□製作所', ai: null },
  { c: '関東物流センター', ai: '佐藤 四郎 13:30〜' },
  { c: 'エコフレッシュ食品', ai: '伊藤 六郎 15:10〜' },
  { c: '明和産業株式会社', ai: null },
  { c: '日東精工', ai: '渡辺 七郎 09:00〜' },
  { c: '中央運送株式会社', ai: '高橋 五郎 06:30〜' },
];
const pct = h => h / 24 * 100;

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
.brand b{font-size:13px;font-weight:800}.brand .sp{flex:1}
.brand .u{width:24px;height:24px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:700}
.dh{height:48px;background:#fff;border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 18px;gap:12px;flex-shrink:0}
.dh .ttl{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:800}
.dh .ttl .dot{width:16px;height:16px;border-radius:50%;border:2.5px solid var(--blk)}
.dh .sp{flex:1}
.tabs{display:flex;gap:6px}
.tab{font-size:12px;font-weight:700;padding:6px 12px;border-radius:7px;display:flex;align-items:center;gap:6px;color:var(--text-secondary)}
.tab.on{background:var(--blk);color:#fff}
.tab .b{font-size:10px;font-weight:800;padding:1px 7px;border-radius:20px}
.tab.on .b{background:var(--red);color:#fff}.tab .b.g{background:#e5e7eb;color:var(--text-secondary)}
/* サブタブ */
.subs{height:38px;background:#fff;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:2px;padding:0 14px;flex-shrink:0}
.sub{font-size:11.5px;font-weight:700;padding:9px 12px;color:var(--text-secondary);border-bottom:2px solid transparent;display:flex;align-items:center;gap:5px}
.sub.on{color:var(--blk);border-bottom-color:var(--blk)}
.sub .nw{font-size:8px;font-weight:800;background:var(--accent);color:#fff;border-radius:4px;padding:1px 4px}
`;
const rail = on => `<aside class="rail"><div class="logo">ロ</div>${['🏠','📋','🚚','📞','📊','⚙'].map((e,i)=>`<div class="ic ${i===2?'on':''}">${e}</div>`).join('')}</aside>`;
const brand = `<div class="brand"><b>ロジポケ配車Agent</b><span class="sp"></span><span style="font-size:11px;opacity:.85">2026/06/03</span><span class="u">配</span></div>`;
const dh = `<div class="dh"><div class="ttl"><span class="dot"></span>配車計画表</div><span class="sp"></span>
  <div class="tabs"><div class="tab on">▦ 計画中 <span class="b">6</span></div><div class="tab">✓ 請求確定済み <span class="b g">3</span></div></div></div>`;
const subs = active => `<div class="subs">
  ${[['dnd', '≡ 配車割当'], ['sch', '▦ 運行スケジュール'], ['dot', '◎ 動態管理'], ['comm', '💬 連絡状況'], ['disp', '🎛 表示設定']].map(([k, t]) =>
    `<div class="sub ${active === k ? 'on' : ''}">${t}${k === 'disp' ? '<span class="nw">NEW</span>' : ''}</div>`).join('')}</div>`;
const doc = (w, h, css, inner) => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${makeBase(w, h)}${css}</style></head><body><div class="app">${inner}</div></body></html>`;

/* ════════════ ① 表示設定（カスタマイズ）ページ ════════════ */
const setCSS = `
.page{flex:1;overflow:hidden;background:var(--bg);padding:16px 20px;display:flex;flex-direction:column;gap:14px}
.phead{display:flex;align-items:center;gap:14px}
.phead .h{font-size:17px;font-weight:800;display:flex;align-items:center;gap:8px}
.phead .s{font-size:11.5px;color:var(--text-secondary)}
.phead .sp{flex:1}
.preset{display:flex;background:#eef2f0;border-radius:9px;padding:3px;gap:2px;border:1px solid #e2e8e4}
.preset .p{font-size:11.5px;font-weight:700;padding:6px 13px;border-radius:7px;color:var(--text-secondary)}
.preset .p.on{background:#fff;color:var(--blk);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.save{font-size:12px;font-weight:800;color:#fff;background:var(--blk);border-radius:7px;padding:8px 16px}
.cols{flex:1;display:grid;grid-template-columns:1fr 1fr 380px;gap:14px;min-height:0}
.col{display:flex;flex-direction:column;gap:14px}
.card{background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden}
.ch{display:flex;align-items:center;gap:8px;padding:11px 15px;border-bottom:1px solid var(--border);font-size:13px;font-weight:800}
.ch .ico{width:22px;height:22px;border-radius:6px;background:var(--accent-pale);display:flex;align-items:center;justify-content:center;font-size:12px}
.cb{padding:4px 15px 9px}
.strow{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f5f6f7}
.strow:last-child{border-bottom:none}
.strow .lab{flex:1;font-size:12px;font-weight:600}
.strow .must{font-size:9px;font-weight:800;color:#047857;background:#d1fae5;border:1px solid #6ee7b7;border-radius:5px;padding:1px 6px}
.sw{width:36px;height:20px;border-radius:20px;background:#cbd5e1;position:relative;flex-shrink:0}
.sw.on{background:var(--accent)}
.sw.lock{background:#86c9ad}
.sw::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2)}
.sw.on::after,.sw.lock::after{left:18px}
.note{font-size:10.5px;color:var(--text-secondary);background:#f8fafc;border:1px dashed var(--border);border-radius:7px;padding:7px 9px;margin-top:8px;line-height:1.5}
.note b{color:var(--warn)}
.gain{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:800;color:var(--blk);background:#eafaf3;border:1px solid #b6e6d3;border-radius:7px;padding:7px 10px;margin-top:8px}
/* 切替バー見本 */
.barsample{display:flex;align-items:center;gap:6px;margin-top:9px;padding:8px;border:1px dashed var(--border);border-radius:8px;position:relative;opacity:.5}
.barsample .seg{font-size:10.5px;font-weight:700;padding:4px 10px;border-radius:6px;color:var(--text-secondary);background:#f3f4f6}
.barsample .seg.on{background:var(--blk);color:#fff}
.offmask{position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:9.5px;font-weight:800;color:#9a3412;background:#ffedd5;border:1px solid #fed7aa;border-radius:5px;padding:2px 7px}
/* 日付バー見本（添付画像の再現） */
.datesample{margin-top:9px;border:1px dashed var(--border);border-radius:8px;padding:7px;position:relative;opacity:.5}
.dstrip{display:flex;gap:2px;justify-content:center}
.dchip{min-width:24px;display:flex;flex-direction:column;align-items:center;padding:2px 3px;border-radius:5px;font-size:7px;color:var(--text-muted)}
.dchip .d{font-size:10px;font-weight:800;color:var(--text-primary)}
.dchip.we .d{color:var(--red)}
.dchip.sel{background:var(--blk)}.dchip.sel *{color:#fff!important}
.dchip .dots{display:flex;gap:1px;margin-top:1px}.dchip .dots i{width:3px;height:3px;border-radius:50%;background:#9ca3af}
.dchip.sel .dots i{background:#fff}
.dstat{display:flex;gap:8px;justify-content:center;margin-top:5px;font-size:9px;color:var(--text-secondary)}
.dstat b{color:var(--blk)}
/* プレビュー */
.pvw{background:linear-gradient(160deg,#f0fbf6,#fff);border:1px solid #b6e6d3}
.pvw .ch{background:transparent}
.pvlab{font-size:10px;font-weight:800;color:var(--text-muted);letter-spacing:.04em;margin:2px 0 7px}
.pcard{background:#fff;border:1.5px solid var(--border);border-radius:8px;padding:9px 10px}
.pc-client{font-size:12px;font-weight:800}
.pc-airec{display:flex;align-items:center;gap:5px;margin-top:7px;padding:4px 6px;background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:1px solid #a7f3d0;border-radius:6px;font-size:9.5px}
.pc-airec .lb{font-weight:800;color:#047857;background:#fff;border:1px solid #6ee7b7;padding:1px 5px;border-radius:8px}
.pc-airec .tg{font-weight:800;color:#065f46}
.partner{font-weight:800;color:#92400e;background:#fef3c7;border:1px solid #fcd34d;border-radius:6px}
.partner.full{display:flex;align-items:center;justify-content:center;gap:5px;width:100%;padding:6px;font-size:10.5px;margin-top:7px}
.partner.small{display:inline-flex;align-items:center;gap:3px;padding:3px 8px;font-size:9.5px;margin-top:7px}
.anno{font-size:10px;color:var(--warn);font-weight:700;margin-top:5px;display:flex;align-items:center;gap:5px}
.pdrow{display:flex;align-items:stretch;margin-top:4px}
.pdcell{width:150px;display:flex;flex-direction:column;justify-content:center;padding:6px 8px;background:#fafbfc;border:1px solid var(--border);border-right:none;border-radius:8px 0 0 8px}
.pdn{font-size:11px;font-weight:800}
.pdtrack{flex:1;height:46px;border:1px solid var(--border);border-left:none;border-radius:0 8px 8px 0;background:#fbfcfd;position:relative}
.pdtrack .b{position:absolute;top:6px;bottom:6px;left:18%;width:34%;background:var(--blk);border-radius:4px;display:flex;align-items:center;padding:0 8px;color:#fff;font-size:9.5px;font-weight:700}
`;
function row(lab, state) { // state: 'must' | true | false
  const sw = state === 'must' ? '<div class="sw lock"></div>' : `<div class="sw ${state ? 'on' : ''}"></div>`;
  return `<div class="strow"><span class="lab">${lab}</span>${state === 'must' ? '<span class="must">必須</span>' : ''}${sw}</div>`;
}
function screenSettings() {
  const cardA = `<div class="card"><div class="ch"><span class="ico">📋</span>未割当案件カードの表示項目</div><div class="cb">
    ${row('取引先名', 'must')}${row('AI推薦（おすすめ配車）', 'must')}${row('協力会社へ依頼ボタン', 'must')}
    ${row('ステータスバッジ', false)}${row('発着ルート（発地→着地）', false)}${row('時刻・所要時間', false)}
    ${row('緊急バッジ', false)}${row('荷物情報（種別/重量/温度）', false)}${row('納期', false)}
    ${row('受付経路アイコン（AI受付など）', false)}${row('編集ボタン', false)}
    <div class="note">💡 表示項目が少ないカードでは、<b>「協力会社へ依頼」ボタンを自動で小さく</b>してスペースを節約します（右プレビュー参照）。</div>
  </div></div>`;
  const cardC = `<div class="card"><div class="ch"><span class="ico">🚚</span>車両・ドライバーカードの表示項目</div><div class="cb">
    ${row('ドライバー名', 'must')}${row('車両番号・車種', false)}${row('最大積載量', false)}
    ${row('稼働状態（空き / 稼働中）', false)}${row('改善基準告示バッジ', false)}
    <div class="gain">↕ ドライバー名のみ → 行が低くなり、<b style="margin:0 2px">1画面に＋2台</b>表示</div>
  </div></div>`;
  const cardB = `<div class="card"><div class="ch"><span class="ico">🗂</span>「担当 / 拠点 / すべて」切替バー<div style="flex:1"></div><div class="sw"></div></div><div class="cb">
    <div style="font-size:11px;color:var(--text-secondary)">配車表の行を担当者別・拠点別に切り替えるバー。使わなければOFFに。</div>
    <div class="barsample"><span class="seg on">担当別</span><span class="seg">拠点別</span><span class="seg">すべて</span><span class="offmask">OFF＝行ごと非表示</span></div>
    <div class="gain">↕ OFFで <b style="margin:0 2px">1行ぶん</b> 配車表が広がる</div>
  </div></div>`;
  const dchip = (dow, day, opt = {}) => `<div class="dchip ${opt.we ? 'we' : ''} ${opt.sel ? 'sel' : ''}"><span>${dow}</span><span class="d num">${day}</span>${opt.dots ? `<span class="dots">${'<i></i>'.repeat(opt.dots)}</span>` : '<span class="dots"></span>'}</div>`;
  const cardD = `<div class="card"><div class="ch"><span class="ico">📅</span>日付選択バーの表示<div style="flex:1"></div><div class="sw"></div></div><div class="cb">
    <div style="font-size:11px;color:var(--text-secondary)">前後1週間の日付＋件数＋稼働サマリ（下が現在の見た目）。</div>
    <div class="datesample">
      <div class="dstrip">
        ${dchip('水', 27)}${dchip('木', 28)}${dchip('金', 29)}${dchip('土', 30, { we: 1 })}${dchip('日', 31, { we: 1 })}${dchip('月', 1)}${dchip('火', 2, { dots: 1 })}${dchip('水', 3, { sel: 1, dots: 3 })}${dchip('木', 4, { dots: 2 })}${dchip('金', 5)}${dchip('土', 6, { we: 1 })}${dchip('日', 7, { we: 1 })}${dchip('月', 8)}
      </div>
      <div class="dstat">割当済 <b class="num">19</b>　稼働率 <b class="num">34%</b></div>
      <span class="offmask">OFF＝行ごと非表示</span>
    </div>
    <div class="gain">↕ OFFで <b style="margin:0 2px">1行ぶん</b> 配車表が広がる</div>
  </div></div>`;
  const preview = `<div class="card pvw"><div class="ch"><span class="ico">👁</span>プレビュー（最小構成）</div><div class="cb">
    <div class="pvlab">未割当案件カード</div>
    <div class="pcard">
      <div class="pc-client">株式会社○○商事</div>
      <div class="pc-airec"><span style="font-size:11px">🤖</span><span class="lb">AI推薦</span><span class="tg">山田 一郎 09:20〜</span></div>
      <button class="partner small">🤝 協力会社へ依頼</button>
    </div>
    <div class="anno">↑ 情報が少ないので依頼ボタンは小サイズ</div>
    <div class="pvlab" style="margin-top:14px">ドライバーカード（行）</div>
    <div class="pdrow"><div class="pdcell"><span class="pdn">山田 一郎</span></div><div class="pdtrack"><div class="b">○○商事</div></div></div>
    <div class="pvlab" style="margin-top:14px">この設定の効果</div>
    <div class="gain" style="margin-top:0">✓ 日付バー・切替バーOFF＋カード簡素化で<b style="margin:0 2px">配車操作の領域が拡大</b></div>
  </div></div>`;
  const body = `<div class="page">
    <div class="phead"><div><div class="h">🎛 表示設定（カスタマイズ）</div><div class="s">配車計画表の情報量を絞って、メインの配車操作をしやすくします</div></div>
      <div class="sp"></div>
      <div class="preset"><span class="p on">最小構成</span><span class="p">標準</span><span class="p">全部表示</span></div>
      <span class="save">保存</span>
    </div>
    <div class="cols">
      <div class="col">${cardA}</div>
      <div class="col">${cardC}${cardB}${cardD}</div>
      <div class="col">${preview}</div>
    </div>
  </div>`;
  return doc(1480, 900, setCSS, rail() + `<div class="main">${brand}${dh}${subs('disp')}${body}</div>`);
}

/* ════════════ ② 最小構成を適用した配車表 ════════════ */
const appCSS = `
.applied-note{display:flex;align-items:center;gap:10px;padding:7px 16px;background:#eafaf3;border-bottom:1px solid #b6e6d3;font-size:11px;font-weight:700;color:#0d7a52;flex-shrink:0}
.applied-note .tg{font-size:9.5px;font-weight:800;background:#fff;border:1px solid #b6e6d3;border-radius:5px;padding:2px 7px}
.applied-note .sp{flex:1}
.applied-note .edit{font-size:10.5px;font-weight:700;color:var(--blk);border:1px solid var(--blk);border-radius:6px;padding:4px 10px}
.board{flex:1;display:flex;min-height:0;overflow:hidden}
.lpanel{width:210px;border-right:1px solid var(--border);background:#fff;display:flex;flex-direction:column;flex-shrink:0}
.lh{padding:9px 11px;border-bottom:1px solid var(--border);font-size:12px;font-weight:800;display:flex;align-items:center;gap:6px}
.lh .lb{font-size:10px;font-weight:800;background:var(--red);color:#fff;padding:1px 7px;border-radius:20px}
.llist{flex:1;overflow:hidden;padding:7px 9px;display:flex;flex-direction:column;gap:6px}
.mcard{border:1.5px solid var(--border);border-radius:8px;padding:7px 9px}
.mc-client{font-size:11.5px;font-weight:800}
.mc-ai{display:flex;align-items:center;gap:4px;margin-top:5px;padding:3px 5px;background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:1px solid #a7f3d0;border-radius:5px;font-size:9px}
.mc-ai .lb{font-weight:800;color:#047857;background:#fff;border:1px solid #6ee7b7;padding:0 4px;border-radius:7px}
.mc-ai .tg{font-weight:800;color:#065f46;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc-partner{display:inline-flex;align-items:center;gap:3px;margin-top:6px;padding:3px 8px;font-size:9.5px;font-weight:800;color:#92400e;background:#fef3c7;border:1px solid #fcd34d;border-radius:6px}
.tl{flex:1;display:flex;flex-direction:column;min-width:0;background:#fff;overflow:hidden}
.rhead{height:38px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;padding:0 14px;flex-shrink:0}
.rhead .rt{font-size:12px;font-weight:800}
.rsp{flex:1}
.legend{display:flex;gap:13px;font-size:10.5px;color:var(--text-secondary)}
.legend i{display:inline-block;width:13px;height:11px;border-radius:3px;vertical-align:-1px;margin-right:5px}
.tlbody{flex:1;overflow:hidden;padding:6px 0}
.thead{display:grid;grid-template-columns:140px 1fr;height:22px;border-bottom:1px solid var(--border)}
.thead .l{font-size:9.5px;font-weight:700;color:var(--text-muted);padding:5px 10px}
.tk{position:relative}.tk .t{position:absolute;top:3px;transform:translateX(-50%);font-size:9px;font-weight:700;color:var(--text-muted)}
.row{display:grid;grid-template-columns:140px 1fr;margin-bottom:4px;height:44px}
.dcell{display:flex;align-items:center;padding:0 10px;background:#fafbfc;border:1px solid var(--border);border-right:none;border-radius:8px 0 0 8px}
.dn{font-size:11.5px;font-weight:800}
.track{position:relative;border:1px solid var(--border);border-left:none;border-radius:0 8px 8px 0;background-color:#fbfcfd;
  background-image:repeating-linear-gradient(90deg,transparent,transparent calc(100%/24 - 1px),#eef0f3 calc(100%/24 - 1px),#eef0f3 calc(100%/24)),
   repeating-linear-gradient(90deg,transparent,transparent calc(100%/8 - 1px),#d1d5db calc(100%/8 - 1px),#d1d5db calc(100%/8))}
.blk{position:absolute;top:4px;bottom:4px;border-radius:4px;display:flex;align-items:center;padding:0 8px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.12)}
.blk .bt{font-size:10px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.blk.plan{background:#bfe0d2}.blk.plan .bt{color:#0f5740}
.blk.conf{background:var(--blk)}
.blk.warn{box-shadow:inset 0 0 0 2px var(--warn),0 1px 2px rgba(0,0,0,.15)}
`;
function screenApplied() {
  const ticks = [0, 3, 6, 9, 12, 15, 18, 21, 24];
  const rows = drivers.map((n, i) => {
    const blocks = (asg[i] || []).map(b => `<div class="blk ${b.st === 'c' ? 'conf' : 'plan'} ${b.warn ? 'warn' : ''}" style="left:${pct(b.s)}%;width:${pct(b.e - b.s)}%"><span class="bt">${b.c}${b.warn ? ' ⚠' : ''}</span></div>`).join('');
    return `<div class="row"><div class="dcell"><span class="dn">${n}</span></div><div class="track">${blocks}</div></div>`;
  }).join('');
  const tl = `<div class="tl">
    <div class="rhead"><div class="rt">🚚 トラック・ドライバー</div><div class="rsp"></div>
      <div class="legend"><span><i style="background:var(--blk)"></i>確定</span><span><i style="background:#bfe0d2"></i>計画</span><span><i style="background:var(--blk);box-shadow:inset 0 0 0 2px var(--warn)"></i>警告</span></div></div>
    <div class="tlbody"><div class="thead"><div class="l">ドライバー</div><div class="tk">${ticks.map(h => `<span class="t num" style="left:${pct(h)}%">${h}</span>`).join('')}</div></div>${rows}</div>
  </div>`;
  const left = `<div class="lpanel"><div class="lh">未割当 <span class="lb">12</span></div>
    <div class="llist">${cards.map(c => `<div class="mcard"><div class="mc-client">${c.c}</div>${c.ai ? `<div class="mc-ai"><span style="font-size:10px">🤖</span><span class="lb">AI</span><span class="tg">${c.ai}</span></div>` : ''}<span class="mc-partner">🤝 協力会社へ依頼</span></div>`).join('')}</div>
  </div>`;
  const note = `<div class="applied-note">🎛 最小構成を適用中<span class="tg">日付バー 非表示</span><span class="tg">担当/拠点 切替バー 非表示</span><span class="tg">ドライバー：名前のみ</span><span class="tg">カード：取引先＋AI＋依頼のみ</span><span class="sp"></span><span class="edit">表示設定を変更 →</span></div>`;
  return doc(1360, 840, appCSS, rail() + `<div class="main">${brand}${dh}${subs('dnd')}${note}<div class="board">${left}${tl}</div></div>`);
}

/* 出力 */
const screens = [
  ['custom-settings', screenSettings(), 1480, 900],
  ['custom-applied', screenApplied(), 1360, 840],
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
