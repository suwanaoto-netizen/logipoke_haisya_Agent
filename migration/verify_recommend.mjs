#!/usr/bin/env node
// 検証: 増車推薦エンジン(assets/logipoke-recommend.js) の自社車両推薦／協力会社推薦／
// 運賃推薦／プラン合成が決定的に正しく動くことを確認する。
//   node migration/verify_recommend.mjs
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const R = require(resolve(ROOT, 'assets/logipoke-recommend.js'));
const SO = require(resolve(ROOT, 'assets/logipoke-scaleout.js'));

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log('  ✅ ' + name); pass++; }
  catch (e) { console.log('  ❌ ' + name + '\n     ' + e.message); fail++; }
}

console.log('\n増車推薦エンジン（自社/協力会社/運賃/合成）\n');

// 原価積み上げ：各項目が正で合計が一致
check('estimateLegCost 合計整合', () => {
  const c = R.estimateLegCost(365, R.paramsForCapKg(4000));
  assert.ok(c.fuel > 0 && c.highway > 0 && c.driver > 0 && c.depreciation > 0 && c.overhead > 0);
  assert.equal(c.total, c.fuel + c.highway + c.driver + c.depreciation + c.overhead);
});

// ① 自社車両推薦：6,800kg を 4t×2 で充足、スコア高い順に選抜
check('recommendOwnFleet 積載充足＋スコア順', () => {
  const r = R.recommendOwnFleet({
    requiredKg: 6800, neededCount: 2, distanceKm: 365,
    candidates: [
      { id: '車両1245', driver: '山田', cap: '4,000kg', score: 95, avail: '空車' },
      { id: '車両2580', driver: '佐藤', cap: '4,000kg', score: 88, avail: '空車' },
      { id: '車両1356', driver: '鈴木', cap: '2,000kg', score: 70, avail: '空車' }
    ]
  });
  assert.equal(r.satisfied, true);
  assert.equal(r.selected.length, 2);
  assert.equal(r.selected[0].id, '車両1245');         // スコア最上位が先頭
  assert.ok(r.coveredKg >= 6800);
});

// ① 自社のみでは不足 → remainingKg が出る
check('recommendOwnFleet 不足検出', () => {
  const r = R.recommendOwnFleet({
    requiredKg: 12000, neededCount: 3, distanceKm: 365,
    candidates: [
      { id: 'A', cap: '4,000kg', score: 90, avail: '空車' },
      { id: 'B', cap: '4,000kg', score: 80, avail: '空車' }
    ]
  });
  assert.equal(r.satisfied, false);
  assert.ok(r.remainingKg >= 4000);
});

// 空車でない車両は選抜対象外
check('recommendOwnFleet 稼働中は除外', () => {
  const r = R.recommendOwnFleet({
    requiredKg: 2000, neededCount: 1, distanceKm: 40,
    candidates: [
      { id: 'busy', cap: '4,000kg', score: 99, avail: '運行中', available: false },
      { id: 'free', cap: '4,000kg', score: 70, avail: '空車' }
    ]
  });
  assert.equal(r.selected[0].id, 'free');
});

// ② 協力会社推薦：車格適合・実績で順位、傭車見積が出る
check('recommendPartners 適合順＋傭車見積', () => {
  const r = R.recommendPartners({
    remainingKg: 2800, remainingCount: 1, requiredVehicleType: '4tウィング',
    originPrefecture: '茨城県', distanceKm: 365,
    partners: [
      { id: 'PT-001', name: '北関東物流', area: '埼玉県熊谷市', vehicleTypes: ['4tウィング', '2tトラック'], cases: ['x', 'y'] },
      { id: 'PT-004', name: '中央フレート', area: '東京都江戸川区', vehicleTypes: ['軽バン'], cases: [] }
    ]
  });
  assert.equal(r.ranked[0].id, 'PT-001');             // 4t適合が上位
  assert.ok(r.ranked[0].charge > 0, '傭車見積が算出される');
  assert.equal(r.selected.length, 1);
});

// ③ 運賃推薦：粗利＝受注−自社原価−傭車支払
check('recommendFare 粗利計算', () => {
  const f = R.recommendFare({
    sales: 168000, distanceKm: 365,
    ownLegs: [{ capKg: 4000, distanceKm: 365 }, { capKg: 4000, distanceKm: 365 }],
    partnerLegs: [{ charge: 38000 }]
  });
  assert.equal(f.grossProfit, f.sales - f.ownCost - f.partnerCharge);
  assert.equal(f.partnerCharge, 38000);
  assert.equal(typeof f.marginPct, 'number');
  assert.ok(['ok', 'warn', 'ng'].includes(f.status));
});

// 受注額未指定 → 原価×目標粗利でフォールバック
check('recommendFare 受注額フォールバック', () => {
  const f = R.recommendFare({ distanceKm: 365, ownLegs: [{ capKg: 4000, distanceKm: 365 }], partnerLegs: [] });
  assert.ok(f.sales > 0);
  assert.ok(f.grossProfit > 0);
});

// ④ 合成：判定(required) → 自社＋協力会社の便＋運賃まで一気通貫
check('composeScaleOutPlan 一気通貫', () => {
  const order = { goods: '精密機器 / 6,800kg', vehicle: '4tウィング', deadline: '05/26 AM', from: '茨城県つくば市', to: '愛知県名古屋市', weightKg: 6800, distanceKm: 365 };
  const verdict = SO.evaluateScaleOut(order, { maxSingleLoadKg: () => 4000 });
  assert.equal(verdict.verdict, 'required');
  const plan = R.composeScaleOutPlan(order, verdict, {
    distanceKm: 365, sales: 168000,
    candidates: [
      { id: '車両1245', driver: '山田', cap: '4,000kg', score: 95, avail: '空車' },
      { id: '車両2580', driver: '佐藤', cap: '4,000kg', score: 88, avail: '空車' }
    ],
    partners: [{ id: 'PT-001', name: '北関東物流', area: '埼玉県熊谷市', vehicleTypes: ['4tウィング'], cases: ['x'] }]
  });
  assert.ok(plan.legs.length >= 2, '便が組まれる');
  assert.equal(plan.legs[0].kind, 'own');
  assert.equal(typeof plan.fare.grossProfit, 'number');
  assert.ok(plan.ownCount >= 1);
});

// 決定性：同一入力で同一結果
check('決定性（合成）', () => {
  const order = { weightKg: 6800, distanceKm: 365, vehicle: '4tウィング' };
  const verdict = { verdict: 'required', deficit: { vehicles: 2, weightKg: 2800 }, shapeHint: 'parallel' };
  const res = { distanceKm: 365, sales: 168000, candidates: [{ id: 'A', cap: '4,000kg', score: 90, avail: '空車' }, { id: 'B', cap: '4,000kg', score: 80, avail: '空車' }], partners: [{ id: 'PT-001', name: 'X', area: '埼玉県', vehicleTypes: ['4tウィング'], cases: [] }] };
  const a = JSON.stringify(R.composeScaleOutPlan(order, verdict, res));
  for (let i = 0; i < 15; i++) assert.equal(JSON.stringify(R.composeScaleOutPlan(order, verdict, res)), a);
});

console.log('\n' + (fail === 0
  ? '✅ 全 ' + pass + ' 件パス'
  : '❌ ' + fail + ' 件失敗 / ' + (pass + fail) + ' 件中') + '\n');
process.exit(fail === 0 ? 0 : 1);
