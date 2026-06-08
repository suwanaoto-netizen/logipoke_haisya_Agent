#!/usr/bin/env node
// 検証: 案件層統合（課題C7・第1段）。旧 4分割配列
//   unprocessedCases / processingCases / processedCases / allCasesMasterData を
//   LogipokeDB.ingestCases で単一ストアへ統合し、per-phase 配列を完全ロスレスに復元できること、
//   同一 id が複数フェーズに異なるシェイプで併存できること（フェーズ分離）を確認する。
//   node migration/verify_cases.mjs
//
// 本フェーズは「統合ストアの基盤＋ロスレス往復」のみ。本体UI（4配列の reader）は未変更で、
// ここで証明した派生を後続フェーズで一覧/詳細の reader に接続する（ストラングラー方式）。
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

// 各フェーズの代表サンプル（フェーズ固有フィールド込み）。同一 id 20240524001 が
// master / unprocessed / processed の3フェーズに異なるシェイプで併存する点を再現。
const unprocessed = [
  { id: '20240524001', status: '未解析', client: '株式会社○○商事', from: '埼玉県川口市', to: '神奈川県横浜市',
    goods: 'パレット / 800kg / 常温', deadline: '05/25 AM指定', ch: 'tel', time: '09:15', analyzed: true,
    casePattern: '定期案件', aiResult: { confidence: '高信頼度', vehicle: '4tウィング', count: 1 },
    vehicles: [{ rank: 1, id: '車両1245', driver: '山田 一郎', cap: '2,000kg', stars: 5, score: 95 }] },
  { id: '20240524002', status: '要確認', client: '△△食品株式会社', from: '千葉県船橋市', to: '東京都大田区',
    goods: 'ケース / 500kg / 冷蔵', deadline: '05/24 PM指定', ch: 'tel', time: '09:26', analyzed: false, vehicles: [] }
];
const processing = [
  { id: '20240524104', status: '処理中', priority: '緊急', casePattern: 'チャーター案件', client: '関西化学工業株式会社',
    from: '東京都品川区', to: '大阪府大阪市', goods: '化学品 / 900kg / 常温', deadline: '05/26 AM',
    vehicle: '車両2580', driver: '松本 十郎', distance: '540km', vehicleMode: 'relay', jobId: 'J-20240524104-RELAY',
    multiReasons: ['長距離での運転手の改善基準対策'],
    legs: [{ legId: 'relay-104-1', legNo: 1, vehicleId: '車両2580', driverName: '松本 十郎', relayFrom: '東京都品川区', relayTo: '愛知県名古屋市', startTime: '06:00', endTime: '10:30' }],
    vehicles: [{ rank: 1, id: '車両2580', driver: '松本 十郎', cap: '2,000kg', stars: 5, score: 93 }] }
];
const processed = [
  { id: '20240524001', status: '完了', casePattern: '定期案件', partner: false, client: '株式会社○○商事',
    from: '埼玉県川口市', to: '神奈川県横浜市', goods: 'パレット / 800kg / 常温', completion: '2024/05/25 09:32',
    distance: '35km', delay: 'なし', driver: '山田 一郎', vehicle: '1245',
    sales: 45000, fuel: 18000, other: 0, profit: 27000, margin: 60,
    invoiceNo: 'INV-202405-00123', invoiceDate: '2024/05/26', due: '2024/06/30', paid: false,
    billingConfirmed: true, billingConfirmedAt: '2024/05/27 10:30', billingConfirmedBy: '配車 太郎' }
];
const master = [
  { id: '20240524001', client: '株式会社○○商事', from: '埼玉県川口市', to: '神奈川県横浜市', pattern: '定期案件', status: '未処理', deadline: '05/25 AM', sales: null },
  { id: '20240524104', client: '関西化学工業株式会社', from: '東京都品川区', to: '大阪府大阪市', pattern: 'チャーター案件', status: '処理中', deadline: '05/26 AM', sales: null }
];

console.log('\n案件層統合（課題C7・第1段：統合ストア＋per-phase ロスレス往復）\n');

function freshIngest() {
  DB.resetSeq();
  const db = DB.createDB();
  DB.ingestCases(db, { unprocessed, processing, processed, master });
  return db;
}

check('未処理 配列がロスレス往復（aiResult/vehicles 込み）', () => {
  assert.deepEqual(DB.toUnprocessedCases(freshIngest()), unprocessed);
});
check('処理中 配列がロスレス往復（relay legs/vehicles 込み）', () => {
  assert.deepEqual(DB.toProcessingCases(freshIngest()), processing);
});
check('完了 配列がロスレス往復（invoice/billing 込み）', () => {
  assert.deepEqual(DB.toProcessedCases(freshIngest()), processed);
});
check('総覧(master) 配列がロスレス往復', () => {
  assert.deepEqual(DB.toAllCasesMaster(freshIngest()), master);
});

check('同一 id がフェーズをまたいで分離保持される（20240524001）', () => {
  const db = freshIngest();
  const u = DB.toUnprocessedCases(db).find(c => c.id === '20240524001');
  const p = DB.toProcessedCases(db).find(c => c.id === '20240524001');
  const m = DB.toAllCasesMaster(db).find(c => c.id === '20240524001');
  assert.equal(u.status, '未解析');         // 未処理シェイプ
  assert.equal(p.status, '完了');           // 完了シェイプ（invoice 付き）
  assert.equal(p.invoiceNo, 'INV-202405-00123');
  assert.equal(m.status, '未処理');         // 総覧シェイプ（軽量）
  assert.equal(m.sales, null);
});

check('統合ビュー toCaseOverview：全フェーズ横断で件数・phase 付与', () => {
  const ov = DB.toCaseOverview(freshIngest());
  assert.equal(ov.length, unprocessed.length + processing.length + processed.length + master.length);
  assert.ok(ov.every(r => ['unprocessed', 'processing', 'processed', 'master'].includes(r.phase)));
  // フェーズ順（unprocessed→processing→processed→master）で安定
  assert.equal(ov[0].phase, 'unprocessed');
  assert.equal(ov[ov.length - 1].phase, 'master');
});

check('フェーズ内の順序が保持される', () => {
  const db = freshIngest();
  const u = DB.toUnprocessedCases(db);
  assert.deepEqual(u.map(c => c.id), ['20240524001', '20240524002']);
});

check('決定性：2回取込んでも同一復元', () => {
  const a = JSON.stringify(DB.toProcessingCases(freshIngest()));
  const b = JSON.stringify(DB.toProcessingCases(freshIngest()));
  assert.equal(a, b);
});

console.log('\n' + (fail === 0
  ? '✅ 全 ' + pass + ' 件パス'
  : '❌ ' + fail + ' 件失敗 / ' + (pass + fail) + ' 件中') + '\n');
process.exit(fail === 0 ? 0 : 1);
