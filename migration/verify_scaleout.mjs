#!/usr/bin/env node
// 検証: 増車判定エンジン(assets/logipoke-scaleout.js) が仕様書 §13 の受け入れ基準
// T1〜T8 を満たし、かつ同一入力に対し決定的に再現することを確認する。
//   node migration/verify_scaleout.mjs
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const SO = require(resolve(ROOT, 'assets/logipoke-scaleout.js'));
const ev = SO.evaluateScaleOut;

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log('  ✅ ' + name); pass++; }
  catch (e) { console.log('  ❌ ' + name + '\n     ' + e.message); fail++; }
}

console.log('\n増車判定エンジン 受け入れ基準（docs/scale-out-judgement.md §13）\n');

// T1: 4t車・必要6,800kg → required（不足2,800kg / 2台 / parallel）
check('T1 積載超過 → required', () => {
  const v = ev({ goods: '精密機器 / 6,800kg / 常温', vehicle: '4t', deadline: '05/26 AM' });
  assert.equal(v.verdict, 'required');
  assert.ok(v.reasons.some(r => r.type === 'overload'), 'overload 理由');
  assert.equal(v.deficit.weightKg, 2800, 'deficit.weightKg');
  assert.equal(v.deficit.vehicles, 2, 'deficit.vehicles');
  assert.equal(v.shapeHint, 'parallel');
});

// T2: 時間厳守・1台で納期40分超過 → required（time_window / relay）
check('T2 時間窓不成立 → required', () => {
  const v = ev({ goods: 'パレット / 1,200kg', vehicle: '4t', deadline: '翌日AM 厳守' },
    { timeDeficitMin: () => 40 });
  assert.equal(v.verdict, 'required');
  assert.ok(v.reasons.some(r => r.type === 'time_window'), 'time_window 理由');
  assert.equal(v.shapeHint, 'relay');
});

// T3: 単独で拘束超過、別便分割で解消可 → required（compliance / relay）
check('T3 改善基準違反 → required', () => {
  const v = ev({ goods: 'パレット / 1,000kg', vehicle: '4t', deadline: '本日中' },
    { complianceSingle: () => 'violation' });
  assert.equal(v.verdict, 'required');
  assert.ok(v.reasons.some(r => r.type === 'compliance'), 'compliance 理由');
  assert.equal(v.shapeHint, 'relay');
});

// T4: 積載率96%・時間厳守だが1台可能 → recommended（余裕薄トリガー）
check('T4 余裕薄 → recommended', () => {
  const v = ev({ goods: '建材 / 3,850kg', vehicle: '4t', deadline: '05/25 AM 厳守', casePattern: '定期案件' });
  assert.equal(v.verdict, 'recommended');
  assert.equal(typeof v.score, 'number');
});

// T5: 重量不明（confidence/パース不能）→ review
check('T5 情報不足 → review', () => {
  const v = ev({ goods: '機械（重量未確認）', vehicle: '4t', deadline: '終日' });
  assert.equal(v.verdict, 'review');
});

// T6: 必須だが自社・協力とも空き0 → negotiate
check('T6 手配困難 → negotiate', () => {
  const v = ev({ goods: '精密機器 / 6,800kg', vehicle: '4t', deadline: '05/26 AM' },
    { feasible: () => false });
  assert.equal(v.verdict, 'negotiate');
  assert.ok(v.reasons.some(r => r.type === 'overload'));
});

// T7: スポットで増車すると粗利8% → 推奨しない（採算下限ガード）→ none
check('T7 採算下限ガード → none', () => {
  const v = ev({ goods: '飲料 / 3,900kg', vehicle: '4t', deadline: '05/25 AM', casePattern: 'スポット案件' },
    { profitPctIfScaledOut: () => 8 });
  assert.equal(v.verdict, 'none');
});

// T8: 1台で余裕・増車メリットなし → none
check('T8 余裕あり → none', () => {
  const v = ev({ goods: 'パレット / 1,800kg', vehicle: '4t', deadline: '14:00', casePattern: '定期案件' });
  assert.equal(v.verdict, 'none');
});

// 決定性: 同一入力で複数回呼んでも同じ結果（LLM非依存）
check('決定性（同一入力 → 同一結果）', () => {
  const order = { goods: '精密機器 / 6,800kg', vehicle: '4t', deadline: '05/26 AM' };
  const a = JSON.stringify(ev(order));
  for (let i = 0; i < 20; i++) assert.equal(JSON.stringify(ev(order)), a);
});

// 容積超過 H2 / 混載 H6 の補助確認
check('H2 容積超過 → required', () => {
  const v = ev({ goods: 'パレット / 500kg', vehicle: '4t', cargo: { weightKg: 500, volumeM3: 30 } },
    { maxSingleVolumeM3: () => 20 });
  assert.equal(v.verdict, 'required');
  assert.ok(v.reasons.some(r => r.type === 'volume'));
});
check('H6 混載不可 → required', () => {
  const v = ev({ goods: '加工品 / 1,200kg / 冷凍・常温混載', vehicle: '4t', deadline: '本日中' });
  assert.equal(v.verdict, 'required');
  assert.ok(v.reasons.some(r => r.type === 'mixload'));
});

// explainVerdict: 決定的な理由文（LLMフォールバック）
check('explainVerdict 理由文（決定的）', () => {
  const req = ev({ goods: '精密機器 / 6,800kg', vehicle: '4t', deadline: '05/26 AM' });
  const t = SO.explainVerdict(req);
  assert.ok(/増車必要/.test(t), '必要の文言');
  assert.ok(/2,800kg/.test(t), '不足量を含む');
  const none = SO.explainVerdict({ verdict: 'none', reasons: [] });
  assert.ok(/増車不要/.test(none));
});

console.log('\n' + (fail === 0
  ? '✅ 全 ' + pass + ' 件パス'
  : '❌ ' + fail + ' 件失敗 / ' + (pass + fail) + ' 件中') + '\n');
process.exit(fail === 0 ? 0 : 1);
