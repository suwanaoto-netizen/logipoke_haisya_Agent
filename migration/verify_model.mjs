#!/usr/bin/env node
// 検証: 正規化モデル(assets/logipoke-data-model.js) の masters adapter が
// 現行プロトタイプの literal と完全一致(lossless)し、受付層が round-trip することを確認する。
//   node migration/verify_model.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const DB = require(resolve(ROOT, 'assets/logipoke-data-model.js'));

// index.html から seed 配列を「宣言名 → 対応する [ ] のブラケット対応」で切り出して eval する。
// 行番号に依存しないので、リファクタで行がずれても壊れない。
const src = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
function extract(name) {
  const decl = new RegExp('(?:const|var|let)\\s+' + name + '\\s*=\\s*');
  const m = decl.exec(src);
  if (!m) throw new Error('宣言が見つかりません: ' + name);
  let i = m.index + m[0].length, depth = 0, inStr = null, started = false;
  const start = i;
  for (; i < src.length; i++) {
    const ch = src[i], prev = src[i - 1];
    if (inStr) { if (ch === inStr && prev !== '\\') inStr = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { inStr = ch; continue; }
    if (ch === '[') { depth++; started = true; }
    else if (ch === ']') { depth--; if (depth === 0 && started) { i++; break; } }
  }
  // eslint-disable-next-line no-eval
  return eval('(' + src.slice(start, i) + ')');
}

// 移行後はマスタ literal が *_Seed にリネームされ、UI は model からの derive を使う。
// derive(seed) === seed を示せば「UIが受け取るデータは元 literal と同一」が保証される。
const clientMasterData = extract('_clientMasterSeed');
const partnerMasterData = extract('_partnerMasterSeed');
const bases = extract('_basesSeed');
const TEAM_MEMBERS = extract('_teamSeed');
const TEIKI_SAMPLES = extract('_teikiSeed');

let pass = 0, fail = 0;
function check(label, fn) {
  try { fn(); console.log('  ✓ ' + label); pass++; }
  catch (e) { console.log('  ✗ ' + label + '\n      ' + (e.message || e).split('\n')[0]); fail++; }
}

console.log('① マスタ層 adapter の lossless 検証（model → 旧形 が literal と一致）');
const db = DB.createDB();
DB.seedMasters(db, {
  clients: clientMasterData, partners: partnerMasterData, bases: bases,
  users: TEAM_MEMBERS, recurringRoutes: TEIKI_SAMPLES
});

check('clientMasterData (15社) が完全一致', () => assert.deepStrictEqual(DB.toClientMaster(db), clientMasterData));
check('partnerMasterData (6社) が完全一致', () => assert.deepStrictEqual(DB.toPartnerMaster(db), partnerMasterData));
check('bases (8拠点) が完全一致', () => assert.deepStrictEqual(DB.toBasesArray(db), bases));
check('TEAM_MEMBERS (4名) が完全一致', () => assert.deepStrictEqual(DB.toTeamMembers(db), TEAM_MEMBERS));
check('TEIKI_SAMPLES が完全一致', () => assert.deepStrictEqual(DB.toTeikiSamples(db), TEIKI_SAMPLES));

console.log('② 受付層: 値オブジェクト構造化 + round-trip');
const reception = DB.createReception(db, {
  id: 'AI20260601090000', client: '株式会社サンライズ物産', from: '千葉県市原市',
  to: '神奈川県横浜市（横浜港）', goods: '建材 / 2,500kg / 常温（4t平ボディ）',
  deadline: '05/19 13:00 集荷指定', conditions: 'バース予約済み / 担当：佐藤様',
  receivedAt: '2026-06-01T09:00:00+09:00'
});
check('Cargo: weightKg=2500 / tempZone=ambient / packaging=other', () => {
  assert.equal(reception.aiExtraction.cargo.weightKg, 2500);
  assert.equal(reception.aiExtraction.cargo.tempZone, 'ambient');
});
check('Location: 横浜市（横浜港）→ city=横浜市 / detail=横浜港', () => {
  assert.equal(reception.aiExtraction.destination.city, '横浜市');
  assert.equal(reception.aiExtraction.destination.detail, '横浜港');
});
check('TimeWindow: 13:00集荷指定 → latest時刻=13:00 / strict=true', () => {
  assert.ok(/T13:00:00/.test(reception.aiExtraction.timeWindow.latest));
  assert.equal(reception.aiExtraction.timeWindow.strict, true);
});
check('AiExtraction.conditions が配列化', () => {
  assert.deepStrictEqual(reception.aiExtraction.conditions, ['バース予約済み', '担当：佐藤様']);
});
check('Reception → 旧 intake 形へ round-trip', () => {
  const legacy = DB.receptionToLegacyIntake(reception);
  assert.equal(legacy.id, 'AI20260601090000');
  assert.equal(legacy.client, '株式会社サンライズ物産');
  assert.equal(legacy.from, '千葉県市原市');
  assert.equal(legacy.goods, '建材 / 2,500kg / 常温（4t平ボディ）');
});

console.log('②b 受付→配車 ブリッジ: localStorage 経由の round-trip（旧 INTAKE_QUEUE_KEY を置換）');
globalThis.localStorage = (function () { const s = {}; return {
  getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: (k) => { delete s[k]; }
}; })();
DB.clearReceptions();
const rc = DB.createReception(null, { id: 'AI-TEST', client: 'X社', from: '東京都港区', to: '大阪府大阪市',
  goods: 'パレット / 500kg / 冷蔵', deadline: '05/30 PM', conditions: '時間厳守' });
DB.pushReception(rc); // ← ai-phone-reception.html 側の動作
check('pushReception → loadReceptions で永続化される', () => assert.equal(DB.loadReceptions().length, 1));
check('drain相当: Reception → ingest可能な intake 形へ変換', () => {
  const intake = DB.loadReceptions().map(DB.receptionToLegacyIntake)[0]; // ← index.html drain 側の動作
  assert.equal(intake.id, 'AI-TEST');
  assert.equal(intake.client, 'X社');
  assert.equal(intake.from, '東京都港区');
  assert.ok(intake.goods && intake.deadline);
});
DB.clearReceptions();
check('clearReceptions で空になる（取込後のクリア）', () => assert.equal(DB.loadReceptions().length, 0));

console.log('④ 運行層(SSoT): Trip>Leg>Stop+Assignment で中継を表現 → タイムライン復元');
DB.resetSeq();
const db2 = DB.createDB();
db2.drivers.set('drv_001', { id: 'drv_001', name: '松本 十郎' });
db2.drivers.set('drv_002', { id: 'drv_002', name: '山田 一郎' });
db2.vehicles.set('veh_2580', { id: 'veh_2580', plate: '車両2580' });
db2.vehicles.set('veh_1245', { id: 'veh_1245', plate: '車両1245' });
const trip = DB.createTrip(db2, { id: 'trip_104', shape: 'relay' });
const l1 = DB.addLeg(db2, { tripId: trip.id, sequenceNo: 1, driverId: 'drv_001', vehicleId: 'veh_2580', role: 'relay', startAt: '2026-05-27T06:00:00+09:00', endAt: '2026-05-27T10:30:00+09:00', handoffType: 'driver_swap' });
const l2 = DB.addLeg(db2, { tripId: trip.id, sequenceNo: 2, driverId: 'drv_002', vehicleId: 'veh_1245', role: 'relay', startAt: '2026-05-27T11:00:00+09:00', endAt: '2026-05-27T14:30:00+09:00' });
DB.assign(db2, { orderId: 'ord_104', legId: l1.id });
DB.assign(db2, { orderId: 'ord_104', legId: l2.id });
check('中継案件のタイムラインが2区間(担当2名)で復元', () => {
  const tl = DB.deriveCaseTimeline(db2, 'ord_104');
  assert.equal(tl.length, 2);
  assert.equal(tl[0].driverName, '松本 十郎');
  assert.equal(tl[1].driverName, '山田 一郎');
  assert.equal(tl[0].handoffType, 'driver_swap');
});

console.log('\n結果: PASS=' + pass + ' FAIL=' + fail);
process.exit(fail === 0 ? 0 : 1);
