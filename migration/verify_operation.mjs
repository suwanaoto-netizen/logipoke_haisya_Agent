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

check('描画切替パリティ：DnD中継行ビューが旧 legs[] と1:1一致（第2段の契約）', () => {
  // index.html の deriveRelayLegsView が行う SSoT→旧leg形マッピングを再現し、
  // フラグONでも従来描画と同一バーになることを保証する。
  DB.resetSeq();
  const db = DB.createDB();
  DB.ingestCaseLegs(db, relayCase);
  const view = DB.toCaseTimeline(db, '20240524104').map((r, i) => {
    const sc = relayCase.legs[i] || {};
    return { legId: r.legId, legNo: r.sequenceNo, driverName: r.driverName, vehicleId: r.vehicleLabel,
      vehicleName: sc.vehicleName || r.vehicleLabel, startTime: r.start, endTime: r.end,
      relayFrom: r.from, relayTo: r.to, vehicleType: sc.vehicleType, capacity: sc.capacity, lawOk: sc.lawOk };
  });
  assert.equal(view.length, relayCase.legs.length);
  relayCase.legs.forEach((src, i) => {
    // 構造（SSoT由来）
    assert.equal(view[i].legId, src.legId);
    assert.equal(view[i].legNo, src.legNo);
    assert.equal(view[i].driverName, src.driverName);
    assert.equal(view[i].vehicleId, src.vehicleId);
    assert.equal(view[i].startTime, src.startTime);
    assert.equal(view[i].endTime, src.endTime);
    assert.equal(view[i].relayFrom, src.relayFrom);
    assert.equal(view[i].relayTo, src.relayTo);
    // 表示用付帯情報（順序対応で原データから引継ぎ）
    assert.equal(view[i].vehicleName, src.vehicleName);
    assert.equal(view[i].vehicleType, src.vehicleType);
    assert.equal(view[i].capacity, src.capacity);
    assert.equal(view[i].lawOk, src.lawOk);
  });
});

// ── 旧 assignments[]（ガント/DnD正準層）の SSoT ロスレス往復（第3段 / b-2） ──
// 同一ドライバーの複数ブロック・planning/confirmed の両タブを含む代表サンプル。
const flatAssignments = [
  { id: 'A00001', tab: 'planning', date: '2026-05-27', driverId: 'D001', vehicleId: 'V0001',
    start: '06:00', end: '10:30', status: '稼動中', client: '株式会社○○商事', from: '埼玉県川口市',
    to: '神奈川県横浜市', goods: 'パレット/800kg/常温', deadline: '本日中', label: '○○商事', color: '#3BB888' },
  { id: 'A00002', tab: 'planning', date: '2026-05-27', driverId: 'D001', vehicleId: 'V0001',
    start: '12:00', end: '15:00', status: '稼動中', client: '△△食品株式会社', from: '東京都大田区',
    to: '千葉県船橋市', goods: 'ケース/500kg/冷蔵', deadline: '夕方', label: '△△食品', color: '#60a5fa' },
  { id: 'A00003', tab: 'confirmed', date: '2026-05-27', driverId: 'D002', vehicleId: 'V0002',
    start: '08:00', end: '18:30', status: 'アラート', client: '南関東物流株式会社', from: '神奈川県川崎市',
    to: '静岡県静岡市', goods: '電子部品/400kg/精密', deadline: '⚠ 遅延の恐れ', label: '南関東', color: '#f97316' }
];

check('assignments 取込：Trip束ね（同driver×vehicle×tab×日=1 Trip / ブロック=Leg）', () => {
  DB.resetSeq();
  const db = DB.createDB();
  DB.ingestAssignments(db, flatAssignments);
  // D001 の planning 2件 → 1 Trip / 2 Leg、D002 confirmed 1件 → 1 Trip / 1 Leg
  assert.equal(db.trips.size, 2);
  assert.equal(db.legs.size, 3);
  assert.equal(db.stops.size, 6);          // 各Leg 2 Stop
  assert.equal(db.assignments.size, 3);
});

check('assignments ロスレス往復：toAssignments が元配列と完全一致', () => {
  DB.resetSeq();
  const db = DB.createDB();
  DB.ingestAssignments(db, flatAssignments);
  const round = DB.toAssignments(db);
  const norm = arr => arr.slice().sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(norm(round), norm(flatAssignments));
});

check('完全ロスレス：拡張フィールド全部入りの assignment が deepStrictEqual で往復', () => {
  // DnD由来の拡張フィールド（effectiveBaseId/crossBase/owner/caseIds/監査/DnD固有 loadMin等）を全部入り。
  const rich = [{
    id: 'A09001', tab: 'planning', date: '2026-05-27', driverId: 'D001', vehicleId: 'V0001',
    start: '06:00', end: '10:30', status: '運行中', client: 'A社', from: '川口', to: '横浜',
    goods: 'パレット/800kg/常温', deadline: '本日中', label: 'A社', color: '#3BB888',
    effectiveBaseId: 'B001', ownerId: 'me', mainOwnerId: 'me', crossBase: true,
    caseIds: ['20240524001'], isReturn: false, relatedReturnId: null,
    _caseId: '20240524001', loadMin: 30, driveMin: 240, unloadMin: 30,
    loadStart: '06:00', loadEnd: '06:30', driveEnd: '10:00', unloadEnd: '10:30',
    sub: '川口→横浜', isPreset: false, urgent: false,
    createdAt: '2026-05-27T06:00:00.000Z', updatedAt: '2026-05-27T06:00:00.000Z'
  }];
  DB.resetSeq();
  const db = DB.createDB();
  DB.ingestAssignments(db, rich);
  const round = DB.toAssignments(db);
  assert.equal(round.length, 1);
  assert.deepEqual(round[0], rich[0]);   // 拡張フィールドまで含めて完全一致
});

check('完全ロスレス：reassignLeg 後も拡張フィールドが保持（driverのみ変化）', () => {
  const rich = {
    id: 'A09002', tab: 'planning', date: '2026-05-27', driverId: 'D001', vehicleId: 'V0001',
    start: '06:00', end: '10:30', status: '運行中', client: 'A社', from: '川口', to: '横浜',
    goods: 'x/100kg/常温', deadline: '本日中', label: 'A社', color: '#1',
    effectiveBaseId: 'B001', ownerId: 'me', caseIds: ['c1'], loadMin: 30, sub: 'X'
  };
  DB.resetSeq();
  const db = DB.createDB();
  DB.ingestAssignments(db, [rich]);
  DB.reassignLeg(db, 'A09002', { driverId: 'D999' });
  const out = DB.toAssignments(db)[0];
  assert.equal(out.driverId, 'D999');           // 変更は反映
  assert.equal(out.effectiveBaseId, 'B001');    // 拡張フィールドは保持
  assert.deepEqual(out.caseIds, ['c1']);
  assert.equal(out.loadMin, 30);
  assert.equal(out.sub, 'X');
});

check('assignments 往復は決定的（同入力で同出力）', () => {
  function build() {
    DB.resetSeq();
    const db = DB.createDB();
    DB.ingestAssignments(db, flatAssignments);
    return JSON.stringify(DB.toAssignments(db));
  }
  assert.equal(build(), build());
});

// ── 書込先SSoT化＋不変条件 I1/I2（第4段 / d） ──
// 同一 service_date の planning 2件。初期は重複なし（別driver/別vehicle/別時間帯）。
const writeSample = [
  { id: 'A00001', tab: 'planning', date: '2026-05-27', driverId: 'D001', vehicleId: 'V0001',
    start: '06:00', end: '10:00', status: '稼動中', client: 'A社', from: '川口', to: '横浜',
    goods: 'x/100kg/常温', deadline: '本日中', label: 'A', color: '#1' },
  { id: 'A00002', tab: 'planning', date: '2026-05-27', driverId: 'D009', vehicleId: 'V0009',
    start: '09:00', end: '12:00', status: '稼動中', client: 'B社', from: '大田', to: '船橋',
    goods: 'y/100kg/常温', deadline: '夕方', label: 'B', color: '#2' }
];

check('不変条件 I1：別driverなら時間が重なっても衝突なし', () => {
  DB.resetSeq();
  const db = DB.createDB();
  DB.ingestAssignments(db, writeSample);
  const c = DB.checkLegConflicts(db, 'A00002');
  assert.equal(c.driver.length, 0);
  assert.equal(c.vehicle.length, 0);
});

check('書込(reassignLeg)：同driverへ移すと時間重複を I1 で検出', () => {
  DB.resetSeq();
  const db = DB.createDB();
  DB.ingestAssignments(db, writeSample);
  // A00002(09:00-12:00) を D001 へ → A00001(06:00-10:00) と重複
  const r = DB.reassignLeg(db, 'A00002', { driverId: 'D001' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.conflicts.driver, ['A00001']);
});

check('書込(reassignLeg)：同vehicleへ移すと時間重複を I2 で検出', () => {
  DB.resetSeq();
  const db = DB.createDB();
  DB.ingestAssignments(db, writeSample);
  const r = DB.reassignLeg(db, 'A00002', { vehicleId: 'V0001' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.conflicts.vehicle, ['A00001']);
});

check('書込→射影：reassignLeg 後の toAssignments に新driverIdが反映（他は不変）', () => {
  DB.resetSeq();
  const db = DB.createDB();
  DB.ingestAssignments(db, writeSample);
  DB.reassignLeg(db, 'A00002', { driverId: 'D001' }); // 重複でも適用（UIが衝突を提示）
  const out = DB.toAssignments(db);
  const a2 = out.find(a => a.id === 'A00002');
  assert.equal(a2.driverId, 'D001');
  assert.equal(a2.client, 'B社');         // 他フィールドは不変
  assert.equal(a2.from, '大田');
  assert.equal(a2.end, '12:00');
});

check('書込：重ならない時間帯への差し替えは衝突なし', () => {
  DB.resetSeq();
  const db = DB.createDB();
  DB.ingestAssignments(db, [
    writeSample[0],
    Object.assign({}, writeSample[1], { start: '10:30', end: '12:00' }) // A00001 と重ならない
  ]);
  const r = DB.reassignLeg(db, 'A00002', { driverId: 'D001' });
  assert.equal(r.ok, true);
});

// ── 中継編集(c.legs)の書込検証 I9/ドライバー重複（第5段 / e） ──
check('中継検証：連続かつ別ドライバーなら ok', () => {
  const r = DB.validateRelayLegs(relayCase.legs);
  assert.equal(r.ok, true);
  assert.equal(r.issues.length, 0);
});

check('中継検証 I9：引き継ぎ地点が不連続なら handoff_gap を検出', () => {
  const broken = [
    Object.assign({}, relayCase.legs[0], { relayTo: '愛知県名古屋市' }),
    Object.assign({}, relayCase.legs[1], { relayFrom: '岐阜県岐阜市' }) // 前区間の着と不一致
  ];
  const r = DB.validateRelayLegs(broken);
  assert.equal(r.ok, false);
  assert.equal(r.issues[0].type, 'handoff_gap');
});

check('中継検証：同一ドライバーが時間重複する2区間なら driver_overlap', () => {
  const dup = [
    { legNo: 1, driverName: '松本 十郎', relayFrom: 'A', relayTo: 'B', startTime: '06:00', endTime: '12:00' },
    { legNo: 2, driverName: '松本 十郎', relayFrom: 'B', relayTo: 'C', startTime: '10:00', endTime: '14:00' }
  ];
  const r = DB.validateRelayLegs(dup);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some(x => x.type === 'driver_overlap'));
});

check('中継検証：別ドライバーなら時間が重なっても ok（中継の正常形）', () => {
  const ok = [
    { legNo: 1, driverName: '松本 十郎', relayFrom: 'A', relayTo: 'B', startTime: '06:00', endTime: '10:30' },
    { legNo: 2, driverName: '山田 一郎', relayFrom: 'B', relayTo: 'C', startTime: '10:00', endTime: '14:30' }
  ];
  assert.equal(DB.validateRelayLegs(ok).ok, true);
});

check('完全ロスレス：中継 c.legs が toCaseLegs で deepStrictEqual 往復（拡張フィールド込み）', () => {
  DB.resetSeq();
  const db = DB.createDB();
  DB.ingestCaseLegs(db, relayCase);
  const legs = DB.toCaseLegs(db, '20240524104');
  assert.equal(legs.length, relayCase.legs.length);
  // 元の各 leg（legId/vehicleType/vehicleIdx/lawOk/notes/capacity 等を含む）と完全一致
  relayCase.legs.forEach((src, i) => assert.deepEqual(legs[i], src));
});

// ── 永続ストア（第8段 / 物理統合） ──
check('永続ストア：getAssignments がレガシー配列とロスレス一致', () => {
  const store = DB.createOperationStore().syncFromAssignments(flatAssignments);
  const norm = arr => arr.slice().sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(norm(store.getAssignments()), norm(flatAssignments));
});

check('永続ストア：tab フィルタが効く', () => {
  const store = DB.createOperationStore().syncFromAssignments(flatAssignments);
  const planning = store.getAssignments('planning');
  assert.ok(planning.length > 0);
  assert.ok(planning.every(a => a.tab === 'planning'));
});

check('永続ストア：syncFromAssignments 再同期で前回状態が残らない', () => {
  const store = DB.createOperationStore();
  store.syncFromAssignments(flatAssignments);
  store.syncFromAssignments([flatAssignments[0]]);   // 1件に縮小
  const out = store.getAssignments();
  assert.equal(out.length, 1);
  assert.equal(out[0].id, flatAssignments[0].id);
});

check('永続ストア：reassign が getAssignments に反映（拡張フィールド保持）', () => {
  const rich = { id: 'A07001', tab: 'planning', date: '2026-05-27', driverId: 'D001', vehicleId: 'V0001',
    start: '06:00', end: '10:00', status: '運行中', client: 'A社', from: '川口', to: '横浜',
    goods: 'x/100kg/常温', deadline: '本日中', label: 'A社', color: '#1', effectiveBaseId: 'B001', sub: 'X' };
  const store = DB.createOperationStore().syncFromAssignments([rich]);
  store.reassign('A07001', { driverId: 'D777' });
  const out = store.getAssignments()[0];
  assert.equal(out.driverId, 'D777');
  assert.equal(out.effectiveBaseId, 'B001');
  assert.equal(out.sub, 'X');
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
