#!/usr/bin/env node
// 検証: 運行層SSoT接続（課題C6 / 第1段）。
//   旧 case.legs[]（単一/中継）→ LogipokeDB.ingestCaseLegs → Trip>Leg>Stop+Assignment へ取込み、
//   SSoT → 3画面の派生（toScheduleBlocks / toDndBoard / toCaseTimeline）がロスレスに復元できること、
//   運行層の不変条件（I3/I4/I9・中継の引き継ぎ連続性）を満たすことを確認する。
//   node migration/verify_operation.mjs
//
// 本フェーズは「書込先の一本化」のみ。本体UI(renderSchedule/renderDnd/案件詳細)は未変更で、
// ここで証明した派生を後続フェーズで描画系に接続する（ストラングラー方式）。
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const DB = require(resolve(ROOT, 'assets/logipoke-data-model.js'));

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log('  ✅ ' + name); pass++; }
  catch (e) { console.log('  ❌ ' + name + '\n     ' + e.message); fail++; }
}

// ── 実データ：中継案件 20240524104（品川→名古屋→大阪）。index.html の seed と同形 ──
const relayCase = {
  id: '20240524104', casePattern: 'チャーター案件', client: '関西化学工業株式会社',
  from: '東京都品川区', to: '大阪府大阪市', goods: '化学品 / 900kg / 常温',
  vehicle: '車両2580', driver: '松本 十郎', vehicleMode: 'relay', jobId: 'J-20240524104-RELAY',
  multiReasons: ['長距離での運転手の改善基準対策', '拘束時間の分散'],
  legs: [
    { legId: 'relay-104-1', legNo: 1, vehicleId: '車両2580', vehicleName: '車両2580', driverName: '松本 十郎',
      capacity: '2,000kg', vehicleType: '4t車', role: 'relay', relayFrom: '東京都品川区', relayTo: '愛知県名古屋市',
      startTime: '06:00', endTime: '10:30', notes: '品川→名古屋（東名高速）' },
    { legId: 'relay-104-2', legNo: 2, vehicleId: '車両1245', vehicleName: '車両1245', driverName: '山田 一郎',
      capacity: '2,000kg', vehicleType: '4t車', role: 'relay', relayFrom: '愛知県名古屋市', relayTo: '大阪府大阪市',
      startTime: '11:00', endTime: '14:30', notes: '名古屋→大阪（名神高速）' }
  ]
};
// 単一便（legs[] 無し）。案件の from/to/vehicle/driver から1区間を合成できること。
const singleCase = {
  id: '20240524001', casePattern: '定期案件', client: '株式会社○○商事',
  from: '埼玉県川口市', to: '神奈川県横浜市', vehicle: '車両1245', driver: '山田 一郎',
  vehicleMode: 'single', legs: []
};

console.log('\n運行層SSoT接続（課題C6・第1段：取込＋派生＋不変条件）\n');

check('中継案件の取込：Trip1 / Leg2 / Stop4 / Assignment2', () => {
  DB.resetSeq();
  const db = DB.createDB();
  const r = DB.ingestCaseLegs(db, relayCase);
  assert.equal(db.trips.size, 1);
  assert.equal(r.legIds.length, 2);
  assert.equal(db.legs.size, 2);
  assert.equal(db.stops.size, 4);
  assert.equal(db.assignments.size, 2);
  const trip = db.trips.get(r.tripId);
  assert.equal(trip.shape, 'relay');
  assert.deepEqual(trip.multiReasons, relayCase.multiReasons);
});

check('案件タイムライン復元が設計ドキュメントと一致', () => {
  DB.resetSeq();
  const db = DB.createDB();
  DB.ingestCaseLegs(db, relayCase);
  const tl = DB.toCaseTimeline(db, '20240524104');
  assert.equal(tl.length, 2);
  // seq1: 松本 十郎 / 車両2580 / driver_swap
  assert.equal(tl[0].sequenceNo, 1);
  assert.equal(tl[0].driverName, '松本 十郎');
  assert.equal(tl[0].vehicleLabel, '車両2580');
  assert.equal(tl[0].handoffType, 'driver_swap');
  // seq2: 山田 一郎 / 車両1245 / 最終Leg（引き継ぎなし）
  assert.equal(tl[1].sequenceNo, 2);
  assert.equal(tl[1].driverName, '山田 一郎');
  assert.equal(tl[1].vehicleLabel, '車両1245');
  assert.equal(tl[1].handoffType, null);
});

check('不変条件 I9：中継の引き継ぎ地点が連続（前Legの着 = 次Legの発）', () => {
  DB.resetSeq();
  const db = DB.createDB();
  DB.ingestCaseLegs(db, relayCase);
  const tl = DB.toCaseTimeline(db, '20240524104');
  assert.equal(tl[0].to, '愛知県名古屋市');
  assert.equal(tl[1].from, '愛知県名古屋市');
  assert.equal(tl[0].to, tl[1].from, '前Legの着と次Legの発が一致');
});

check('不変条件 I3/I4：区間時刻あり・Trip内 sequence_no 一意', () => {
  DB.resetSeq();
  const db = DB.createDB();
  const r = DB.ingestCaseLegs(db, relayCase);
  const seqs = r.legIds.map(id => db.legs.get(id).sequenceNo);
  assert.deepEqual([...new Set(seqs)].sort(), seqs.slice().sort(), 'sequence_no が一意');
  r.legIds.forEach(id => { const l = db.legs.get(id); assert.ok(l.startTime && l.endTime); });
});

check('区間連鎖：leg1.nextLegId === leg2.id', () => {
  DB.resetSeq();
  const db = DB.createDB();
  const r = DB.ingestCaseLegs(db, relayCase);
  assert.equal(db.legs.get(r.legIds[0]).nextLegId, r.legIds[1]);
  assert.equal(db.legs.get(r.legIds[1]).nextLegId, null);
});

check('ガント派生(toScheduleBlocks)：1 Leg=1ブロック・from/to・荷主名', () => {
  DB.resetSeq();
  const db = DB.createDB();
  DB.ingestCaseLegs(db, relayCase);
  const blocks = DB.toScheduleBlocks(db);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].from, '東京都品川区');
  assert.equal(blocks[0].to, '愛知県名古屋市');
  assert.equal(blocks[0].clients, '関西化学工業株式会社');
  assert.equal(blocks[0].vehicleLabel, '車両2580');
});

check('DnD盤派生(toDndBoard)：driver×vehicle ごとに区間集約', () => {
  DB.resetSeq();
  const db = DB.createDB();
  DB.ingestCaseLegs(db, relayCase);
  const board = DB.toDndBoard(db);
  assert.equal(board.length, 2, '松本×2580 と 山田×1245 の2系列');
  board.forEach(b => assert.equal(b.legs.length, 1));
  const matsu = board.find(b => b.driverName === '松本 十郎');
  assert.equal(matsu.vehicleLabel, '車両2580');
});

check('ロスレス：派生した各区間の from/to が元 legs[] の relayFrom/relayTo と一致', () => {
  DB.resetSeq();
  const db = DB.createDB();
  DB.ingestCaseLegs(db, relayCase);
  const tl = DB.toCaseTimeline(db, '20240524104');
  relayCase.legs.forEach((src, i) => {
    assert.equal(tl[i].from, src.relayFrom);
    assert.equal(tl[i].to, src.relayTo);
    assert.equal(tl[i].driverName, src.driverName);
    assert.equal(tl[i].vehicleLabel, src.vehicleId);
  });
});

check('単一便：legs[] 無しでも 案件の from/to/driver から1区間を合成', () => {
  DB.resetSeq();
  const db = DB.createDB();
  const r = DB.ingestCaseLegs(db, singleCase);
  assert.equal(r.legIds.length, 1);
  assert.equal(db.assignments.size, 1);
  const tl = DB.toCaseTimeline(db, '20240524001');
  assert.equal(tl[0].from, '埼玉県川口市');
  assert.equal(tl[0].to, '神奈川県横浜市');
  assert.equal(tl[0].driverName, '山田 一郎');
  assert.equal(tl[0].handoffType, null);
  assert.equal(db.trips.get(r.tripId).shape, 'single');
});

check('決定性：同一案件を2回取込んでも同一タイムライン', () => {
  function build() {
    DB.resetSeq();
    const db = DB.createDB();
    DB.ingestCaseLegs(db, relayCase);
    return JSON.stringify(DB.toCaseTimeline(db, '20240524104'));
  }
  assert.equal(build(), build());
});

console.log('\n' + (fail === 0
  ? '✅ 全 ' + pass + ' 件パス'
  : '❌ ' + fail + ' 件失敗 / ' + (pass + fail) + ' 件中') + '\n');
process.exit(fail === 0 ? 0 : 1);
