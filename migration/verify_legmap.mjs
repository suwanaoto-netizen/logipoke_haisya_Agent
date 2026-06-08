// #5 理想データモデル(DB)への正式反映：プロトタイプ区間(leg) → DDL(leg)カラム マッピング検証。
// 外部依存なし（logipoke-data-model.js の legToDDLRecord を検証）。
import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const DB = require('../assets/logipoke-data-model.js');

let pass = 0;
function ok(label, cond) { assert.ok(cond, label); console.log('  ✓ ' + label); pass++; }

assert.equal(typeof DB.legToDDLRecord, 'function', 'legToDDLRecord export');

// 1) 自社便：ドライバー/車両の分離 + クロス配車 + 便ごと積載
const own = DB.legToDDLRecord({
  legId: 'leg-1', legNo: 1, driverRefId: 'D001', vehicleRefId: 'V1382',
  effectiveBaseId: 'B002', crossBase: true, loadKg: 3000,
  startTime: '08:00', endTime: '12:00', role: 'main'
}, { tripId: 'trip-x' });
ok('own.driver_id=D001', own.driver_id === 'D001');
ok('own.vehicle_id=V1382', own.vehicle_id === 'V1382');
ok('own.is_hired=false', own.is_hired === false);
ok('own.cross_base=true', own.cross_base === true);
ok('own.effective_base_id=B002', own.effective_base_id === 'B002');
ok('own.loaded_weight_kg=3000', own.loaded_weight_kg === 3000);
ok('own.purchase_order_no=null', own.purchase_order_no === null);
ok('own.hired_charge_jpy=null', own.hired_charge_jpy === null);

// 2) 傭車（協力会社）：vehicle_id=NULL + is_hired + 傭車運賃 + PO
const hired = DB.legToDDLRecord({
  legId: 'leg-2', legNo: 2, driverRefId: 'D009', partnerVehicle: true,
  partnerCharge: 37600, purchaseOrderNo: 'PO-202606-96517',
  startTime: '08:00', endTime: '12:00'
}, { tripId: 'trip-x', hiredCompanyId: 'PT-001' });
ok('hired.driver_id=D009', hired.driver_id === 'D009');
ok('hired.vehicle_id=null（傭車は自社マスタ外）', hired.vehicle_id === null);
ok('hired.is_hired=true', hired.is_hired === true);
ok('hired.hired_company_id=PT-001', hired.hired_company_id === 'PT-001');
ok('hired.hired_charge_jpy=37600', hired.hired_charge_jpy === 37600);
ok('hired.purchase_order_no=PO-…', hired.purchase_order_no === 'PO-202606-96517');

// 3) DDL CHECK 整合: is_hired = (vehicle_id IS NULL)
[own, hired].forEach((r, i) => ok('CHECK is_hired=(vehicle_id IS NULL) #' + i, r.is_hired === (r.vehicle_id === null)));
// 傭車は hired_company_id 必須（CHECK: NOT is_hired OR hired_company_id IS NOT NULL）
ok('CHECK hired ⇒ hired_company_id', !hired.is_hired || hired.hired_company_id != null);

console.log('\nverify_legmap: ' + pass + ' assertions passed');
