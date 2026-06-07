#!/usr/bin/env node
// 検証: index.html の案件依存スコアリング（calcAIScore / calcAIScoreBreakdown）が
// 「同一車両でも案件が変わればスコアが変わる」「容量不足は積載0点」等を満たすことを確認する。
//   node migration/verify_aiscore.mjs
//
// index.html 内のインライン関数を本文から抽出し、グローバル依存をスタブ注入した
// サンドボックスで評価して、実際に出荷されるコードをそのままテストする。
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const SO = require(resolve(ROOT, 'assets/logipoke-scaleout.js'));

// ── index.html から clampScore〜calcAIScore の3関数を抽出 ──
const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const start = html.indexOf('function clampScore');
const end = html.indexOf('function recalcAllScores');
assert.ok(start > 0 && end > start, 'index.html から対象関数を抽出できること');
const code = html.slice(start, end);

// ── 依存スタブ（純粋なスコア合成ロジックのみを対象に） ──
const VEHICLE_RAW_SCORES = {
  V_FALLBACK: { distance: 70, load: 71, driver: 72, law: 73, customer: 74 },
};
const VEHICLE_PROFIT = {}; // 実績ブレンド無し（driver = stars 基準を安定させる）
const AI_WEIGHTS = { distance: 30, load: 25, driver: 20, law: 15, customer: 10 };
const win = { LogipokeScaleOut: SO, AI_WEIGHTS };
// estimateDistance スタブ：集荷地(第2引数)で回送距離を決定論的に返す
function estimateDistance(_base, from) {
  if (String(from).includes('CLOSE')) return 10;
  if (String(from).includes('FAR')) return 300;
  return 50;
}
// getBaseDistance スタブ：拠点IDが解決できた場合の距離マスタ参照（第2段の精度向上）
function getBaseDistance(a, b) { return (a === 'BX' && b === 'BX') ? 5 : null; }

const factory = new Function(
  'window', 'VEHICLE_RAW_SCORES', 'VEHICLE_PROFIT', 'estimateDistance', 'getBaseDistance',
  code + '\n; return { clampScore, calcAIScoreBreakdown, calcAIScore };'
);
const { clampScore, calcAIScoreBreakdown, calcAIScore } =
  factory(win, VEHICLE_RAW_SCORES, VEHICLE_PROFIT, estimateDistance, getBaseDistance);

// ── AI-AFFINITY ブロック（customerAffinity）を抽出 ──
const aStart = html.indexOf('// ===== AI-AFFINITY-START =====');
const aEnd = html.indexOf('// ===== AI-AFFINITY-END =====');
assert.ok(aStart > 0 && aEnd > aStart, 'index.html から customerAffinity ブロックを抽出できること');
const aCode = html.slice(aStart, aEnd);
const affWin = {};
const affProcessed = [
  { client: '株式会社A', vehicle: '1245',     delay: 'なし',     margin: 64 },
  { client: '株式会社A', vehicle: '1245',     delay: 'なし',     margin: 60 },
  { client: '株式会社A', vehicle: '車両1123', delay: '15分遅延', margin: 40 },
];
const affClients = [{ name: '株式会社A', type: '定期' }, { name: 'スポット社', type: 'スポット' }];
new Function('window', 'processedCases', 'clientMasterData', 'clampScore', aCode)(
  affWin, affProcessed, affClients, clampScore
);
const customerAffinity = affWin.customerAffinity;

const lawOk = { status: 'ok', items: [
  { ok: true, title: '日間運転時間' }, { ok: true, title: '拘束時間' },
  { ok: true, title: '週間上限時間' }, { ok: true, title: '勤務間休息' },
  { ok: true, title: '連続運転制限' }, { ok: true, title: '休憩確保' },
] };
const lawWarn = { status: 'warn', items: [
  { ok: false, title: '連続運転制限' }, { ok: true, title: '日間運転時間' },
  { ok: true, title: '拘束時間' }, { ok: true, title: '週間上限時間' },
  { ok: true, title: '勤務間休息' }, { ok: true, title: '休憩確保' },
] };

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log('  ✅ ' + name); pass++; }
  catch (e) { console.log('  ❌ ' + name + '\n     ' + e.message); fail++; }
}

console.log('\n案件依存スコアリング（calcAIScore / calcAIScoreBreakdown）\n');

check('clampScore は 0..100 に丸める', () => {
  assert.equal(clampScore(-5), 0);
  assert.equal(clampScore(150), 100);
  assert.equal(clampScore(63.6), 64);
});

// 案件コンテキスト無し → 静的フォールバック（従来挙動）
check('案件なしは VEHICLE_RAW_SCORES にフォールバック', () => {
  const b = calcAIScoreBreakdown('V_FALLBACK');
  assert.equal(b._static, true);
  assert.equal(b.distance, 70);
  assert.equal(b.load, 71);
});

// 同一車両・別案件でスコアが変わる（距離効率が案件依存）
check('同一車両でも案件が変わればスコアが変わる', () => {
  const veh = { id: 'V1', base: 'BASE', cap: '2,000kg', stars: 4, avail: '空車', law: lawOk };
  const near = calcAIScore('V1', { from: 'CLOSE', goods: 'パレット / 1,700kg / 常温', priority: '通常' }, veh);
  const far  = calcAIScore('V1', { from: 'FAR',   goods: 'パレット / 1,700kg / 常温', priority: '通常' }, veh);
  assert.ok(near > far, `近い集荷地ほど高得点であること (near=${near}, far=${far})`);
});

// 容量不足は積載0点
check('容量不足は積載=0点', () => {
  const veh = { id: 'V1', base: 'BASE', cap: '2,000kg', stars: 4, avail: '空車', law: lawOk };
  const b = calcAIScoreBreakdown('V1', { from: 'CLOSE', goods: 'パレット / 5,000kg / 常温' }, veh);
  assert.equal(b.load, 0);
});

// 積載率0.85前後は積載満点に近い
check('積載率0.85は積載満点付近', () => {
  const veh = { id: 'V1', base: 'BASE', cap: '2,000kg', stars: 4, avail: '空車', law: lawOk };
  const b = calcAIScoreBreakdown('V1', { from: 'CLOSE', goods: 'パレット / 1,700kg / 常温' }, veh);
  assert.ok(b.load >= 95, `load=${b.load}`);
});

// 冷蔵荷で要求車格が冷蔵系でなければ積載点を大幅減点
check('温度帯不適合は積載を減点(<=30)', () => {
  const veh = { id: 'V1', base: 'BASE', cap: '2,000kg', stars: 4, avail: '空車', law: lawOk };
  const b = calcAIScoreBreakdown('V1',
    { from: 'CLOSE', goods: 'ケース / 1,700kg / 冷蔵', vehicle: '2tトラック' }, veh);
  assert.ok(b.load <= 30, `load=${b.load}`);
});

// law が ok の候補は warn より拘束余裕が高い
check('law=ok は warn より拘束スコアが高い', () => {
  const base = { from: 'CLOSE', goods: 'パレット / 1,700kg / 常温' };
  const okB   = calcAIScoreBreakdown('V1', base, { id: 'V1', base: 'BASE', cap: '2,000kg', stars: 4, avail: '空車', law: lawOk });
  const warnB = calcAIScoreBreakdown('V1', base, { id: 'V1', base: 'BASE', cap: '2,000kg', stars: 4, avail: '空車', law: lawWarn });
  assert.ok(okB.law > warnB.law, `ok=${okB.law}, warn=${warnB.law}`);
});

// stars が高いほど実績スコアが高い
check('stars が高いほど実績スコアが高い', () => {
  const c = { from: 'CLOSE', goods: 'パレット / 1,700kg / 常温' };
  const hi = calcAIScoreBreakdown('V1', c, { id: 'V1', base: 'BASE', cap: '2,000kg', stars: 5, avail: '空車', law: lawOk });
  const lo = calcAIScoreBreakdown('V1', c, { id: 'V1', base: 'BASE', cap: '2,000kg', stars: 2, avail: '空車', law: lawOk });
  assert.ok(hi.driver > lo.driver, `hi=${hi.driver}, lo=${lo.driver}`);
});

// 重み合計0 → 0点（ゼロ除算回避）
check('重み合計0 は 0点', () => {
  const saved = Object.assign({}, win.AI_WEIGHTS);
  win.AI_WEIGHTS = { distance: 0, load: 0, driver: 0, law: 0, customer: 0 };
  const s = calcAIScore('V1', { from: 'CLOSE', goods: 'パレット / 1,700kg / 常温' },
    { id: 'V1', base: 'BASE', cap: '2,000kg', stars: 4, avail: '空車', law: lawOk });
  assert.equal(s, 0);
  win.AI_WEIGHTS = saved;
});

// 決定性：同一入力で同一スコア
check('決定性（同一入力で同一スコア）', () => {
  const veh = { id: 'V1', base: 'BASE', cap: '2,000kg', stars: 4, avail: '空車', law: lawOk };
  const c = { from: 'CLOSE', goods: 'パレット / 1,700kg / 常温', priority: '緊急' };
  const a = calcAIScore('V1', c, veh);
  for (let i = 0; i < 15; i++) assert.equal(calcAIScore('V1', c, veh), a);
});

// 距離効率 第2段：拠点ID解決→距離マスタが estimateDistance より優先される
check('距離効率は拠点距離マスタを優先（estimateDistanceに縮退しない）', () => {
  win.resolveBaseIdByAlias = function (t) { return String(t).includes('HUB') ? 'BX' : null; };
  const veh = { id: 'V1', base: 'HUB', cap: '2,000kg', stars: 4, avail: '空車', law: lawOk };
  const b = calcAIScoreBreakdown('V1', { from: 'HUB', goods: 'パレット / 1,700kg / 常温' }, veh);
  // マスタ距離 5km → clamp(100-3)=97。estimateDistance なら 50km → 70 になるはず。
  assert.equal(b.distance, 97, `master優先 (distance=${b.distance})`);
  delete win.resolveBaseIdByAlias;
});

console.log('\n顧客相性（customerAffinity）\n');

check('荷主タイプの基礎点（定期 > スポット）', () => {
  const teiki = customerAffinity('9999', '株式会社A');  // 履歴なし定期 → 70
  const spot  = customerAffinity('9999', 'スポット社');  // 履歴なしスポット → 45
  assert.equal(teiki, 70);
  assert.equal(spot, 45);
});

check('取引実績があるほど相性が高い', () => {
  const base = customerAffinity('9999', '株式会社A');     // 実績なし
  const withHist = customerAffinity('1245', '株式会社A'); // 2回・定時・高粗利
  assert.ok(withHist > base, `実績車両が上振れ (hist=${withHist}, base=${base})`);
  assert.ok(withHist <= 100);
});

check('定時遵守・高粗利の車両ほど相性が高い', () => {
  const good = customerAffinity('1245', '株式会社A');     // 定時2/2・粗利62%
  const poor = customerAffinity('1123', '株式会社A');     // 遅延1/1・粗利40%
  assert.ok(good > poor, `good=${good}, poor=${poor}`);
});

check('未知の荷主は中立値(50)', () => {
  assert.equal(customerAffinity('1245', '未登録商事'), 50);
});

check('clientName 無しは中立値(50)', () => {
  assert.equal(customerAffinity('1245', null), 50);
});

console.log('\n' + (fail === 0
  ? '✅ 全 ' + pass + ' 件パス'
  : '❌ ' + fail + ' 件失敗 / ' + (pass + fail) + ' 件中') + '\n');
process.exit(fail === 0 ? 0 : 1);
