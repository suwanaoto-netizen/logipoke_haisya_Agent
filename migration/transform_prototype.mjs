#!/usr/bin/env node
// ============================================================================
//  prototype → 理想データモデル 移行(ETL)スクリプト
// ----------------------------------------------------------------------------
//  現行プロトタイプ（index.html / ai-phone-reception.html）の in-memory JS データを
//  db/schema.sql のテーブルへ流し込む SQL を生成する。docs/ideal-data-model.md §9 の
//  Phase 0〜4（ID実体化・値構造化・運行一本化・案件統合・受付サーバ化）を実装。
//
//  使い方:
//    node migration/transform_prototype.mjs > db/seed_from_prototype.sql
//    （生成SQLは schema.sql 適用済みDBに psql -f で投入可能）
//
//  ※ 同梱データは index.html から抽出した「代表サブセット」。全件移行する場合は
//    末尾 PROTOTYPE の各配列に元データを貼り替えれば、同じ変換でフル生成できる。
// ============================================================================

/* ───────────────────────── 1. 共通ユーティリティ ───────────────────────── */
const NL = '\n';
const sqlStr = (v) => (v === null || v === undefined) ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
const sqlNum = (v) => (v === null || v === undefined || v === '') ? 'NULL' : String(v);
const sqlBool = (v) => v ? 'TRUE' : 'FALSE';
const sqlArr = (arr) => !arr || arr.length === 0 ? `'{}'`
  : `'{${arr.map((x) => `"${String(x).replace(/"/g, '\\"')}"`).join(',')}}'`;
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);

function insert(table, cols, vals) {
  return `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});`;
}

/* ───────────────────────── 2. 値の構造化変換 ─────────────────────────────
   旧コードでは goods/deadline/fare/status を文字列で保持していた（課題C4/C5/C7）。
   ここで構造化・enum 化する。 */

// "パレット / 800kg / 常温" → {description, packaging, weightKg, tempZone}
function parseGoods(goods) {
  const s = String(goods || '');
  const parts = s.split('/').map((x) => x.trim());
  const head = parts[0] || '';
  const packaging =
    /パレット/.test(head) ? 'pallet' :
    /ケース|箱/.test(head) ? 'case' :
    /ロール/.test(head) ? 'roll' :
    /コンテナ/.test(head) ? 'container' :
    /バラ|ばら/.test(head) ? 'bulk' : 'other';
  const wm = s.match(/([\d,]+)\s*kg/);          // 旧 validateAssignment と同じ抽出
  const weightKg = wm ? parseInt(wm[1].replace(/,/g, ''), 10) : 0;
  const tempZone =
    /冷凍/.test(s) ? 'frozen' :
    /冷蔵/.test(s) ? 'chilled' : 'ambient';     // 「精密/常温」は ambient 扱い
  return { description: head, packaging, weightKg, tempZone };
}

// "05/25 AM指定" / "本日中" / "05/19 13:00 集荷指定" → {latest, label, strict}
function parseTimeWindow(deadline, year) {
  const s = String(deadline || '').trim();
  if (!s) return { latest: null, label: null, strict: false };
  const strict = /指定|厳守/.test(s);
  const dm = s.match(/(\d{1,2})\/(\d{1,2})/);
  let hh = null;
  const tm = s.match(/(\d{1,2}):(\d{2})/);
  if (tm) hh = `${tm[1].padStart(2, '0')}:${tm[2]}`;
  else if (/夜/.test(s)) hh = '21:00';
  else if (/夕方/.test(s)) hh = '17:00';
  else if (/PM/.test(s)) hh = '18:00';
  else if (/AM/.test(s)) hh = '12:00';
  else if (/終日/.test(s)) hh = '18:00';
  let latest = null;
  if (dm) {
    const mm = dm[1].padStart(2, '0'), dd = dm[2].padStart(2, '0');
    latest = `${year}-${mm}-${dd}T${hh || '23:59'}:00+09:00`;
  }
  return { latest, label: s, strict };
}

const parseFare = (f) => { const n = parseInt(String(f || '').replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? n : 0; };

const CLIENT_TYPE = { '定期': 'regular', 'スポット': 'spot', 'チャーター': 'charter', '特殊': 'special', '冷蔵': 'chilled' };
const PATTERN = { '定期案件': 'regular', 'スポット案件': 'spot', 'チャーター案件': 'charter', '特殊条件案件': 'special', '多地点配送': 'multidrop' };
const ORDER_STATUS = { '未処理': 'unassigned', '未解析': 'unassigned', '要確認': 'draft', '処理中': 'assigning', '完了': 'completed', '過去': 'completed' };
const PRIORITY = { '緊急': 'urgent', '通常': 'normal' };
const COMPLIANCE_RULE = {
  '日間運転時間': 'daily_drive', '拘束時間': 'duty_hours', '週間上限時間': 'weekly_cap',
  '勤務間休息': 'interval_rest', '連続運転制限': 'continuous_drive', '休憩確保': 'break_rule',
};

/* ───────────────────────── 3. ID レジストリ（名前→ID 名寄せ。課題C2/C3） ── */
const out = [];                                  // 生成SQL行
const companyByName = new Map();                 // 会社名 → co_id
const driverByName = new Map();                  // 氏名   → drv_id
const vehicleByLabel = new Map();                // "車両1245" → veh_id
const locSeq = { n: 0 };
const mkLoc = (raw) => `loc_${String(++locSeq.n).padStart(4, '0')}`;

// 住所文字列 → location 行を作りつつ id を返す（重複は作るが移行用途では許容）
function emitLocation(raw, baseId = null) {
  const id = mkLoc(raw);
  const s = String(raw || '');
  const pm = s.match(/^(.+?[都道府県])/);
  const cm = s.match(/[都道府県](.+?[市区町村])/);
  out.push(insert('location', ['id', 'raw', 'prefecture', 'city', 'base_id'],
    [sqlStr(id), sqlStr(s), sqlStr(pm ? pm[1] : null), sqlStr(cm ? cm[1] : null), sqlStr(baseId)]));
  return id;
}

/* ───────────────────────── 4. レイヤー別の変換 ───────────────────────────── */

function emitBases(bases, distances) {
  out.push(`-- ① マスタ層: 拠点 / 拠点間距離`);
  for (const b of bases) {
    const id = 'base_' + slug(b.id);
    // base→location→base の循環。base を先に入れ、location を作ってから location_id を後付け
    out.push(insert('base', ['id', 'name', 'region', 'aliases'],
      [sqlStr(id), sqlStr(b.name), sqlStr(b.region), sqlArr(b.aliases)]));
    const locId = emitLocation(b.aliases[b.aliases.length - 1] || b.name, id);
    out.push(`UPDATE base SET location_id = ${sqlStr(locId)} WHERE id = ${sqlStr(id)};`);
    b._id = id;
  }
  const idOf = (raw) => 'base_' + slug(raw);
  for (const [a, c, km] of distances) {
    // CHECK (from <= to) を満たすよう小さいID側を from に正規化
    const [f, t] = [idOf(a), idOf(c)].sort();
    out.push(insert('base_distance', ['from_base_id', 'to_base_id', 'distance_km'],
      [sqlStr(f), sqlStr(t), sqlNum(km)]));
  }
}

function emitVehicleTypes(types) {
  out.push(`-- ① マスタ層: 車格`);
  for (const t of types) {
    out.push(insert('vehicle_type', ['id', 'name', 'body_type', 'ton_class', 'max_load_kg', 'temp_zones'],
      [sqlStr(t.id), sqlStr(t.name), sqlStr(t.bodyType), sqlNum(t.ton), sqlNum(t.ton * 1000), sqlArr(t.tempZones)]));
  }
}

function emitCompanies(clients, partners) {
  out.push(`-- ① マスタ層: 会社（荷主+協力会社を統合）`);
  for (const c of clients) {
    const id = 'co_' + slug(c.id);
    const locId = emitLocation(c.area, null);
    companyByName.set(c.name, id);
    out.push(insert('company',
      ['id', 'kind', 'name', 'location_id', 'contact_name', 'contact_tel', 'contact_email', 'client_type', 'legacy_ids'],
      [sqlStr(id), sqlStr('client'), sqlStr(c.name), sqlStr(locId), sqlStr(c.contact), sqlStr(c.tel),
       sqlStr(c.email), sqlStr(CLIENT_TYPE[c.type] || null), sqlArr([c.id])]));
  }
  for (const p of partners) {
    const id = 'co_' + slug(p.id);
    const locId = emitLocation(p.area, null);
    companyByName.set(p.name, id);
    out.push(insert('company',
      ['id', 'kind', 'name', 'location_id', 'contact_name', 'contact_tel', 'contact_email', 'legacy_ids'],
      [sqlStr(id), sqlStr('partner'), sqlStr(p.name), sqlStr(locId), sqlStr(p.contact), sqlStr(p.tel),
       sqlStr(p.email), sqlArr([p.id])]));
  }
}

function emitUsers(team) {
  out.push(`-- ① マスタ層: 社内ユーザー`);
  for (const m of team) {
    out.push(insert('app_user', ['id', 'name', 'role', 'color'],
      [sqlStr('usr_' + slug(m.id)), sqlStr(m.name), sqlStr(m.role || 'dispatcher'), sqlStr(m.color)]));
  }
}

// 氏名→drv_id を採番（初出時に登録）。partner 情報も保持
function registerDriver(name, { isPartner = false, partnerName = null, homeBaseId = null } = {}) {
  if (driverByName.has(name)) return driverByName.get(name);
  const id = 'drv_' + String(driverByName.size + 1).padStart(3, '0');
  driverByName.set(name, id);
  const partnerCoId = partnerName ? (companyByName.get(partnerName) || null) : null;
  out.push(insert('driver',
    ['id', 'name', 'is_partner', 'partner_company_id', 'home_base_id', 'legacy_ids'],
    [sqlStr(id), sqlStr(name), sqlBool(isPartner), sqlStr(partnerCoId), sqlStr(homeBaseId), sqlArr([])]));
  return id;
}

// "車両1245" / "1245" → veh_id を採番（数字を抽出）
function registerVehicle(label, { vehicleTypeId = 'vtype_4t_flatbed', homeBaseId = 'base_b005' } = {}) {
  const num = (String(label).match(/\d+/) || ['0'])[0];
  const plate = `車両${num}`;
  if (vehicleByLabel.has(plate)) return vehicleByLabel.get(plate);
  const id = 'veh_' + num;
  vehicleByLabel.set(plate, id);
  out.push(insert('vehicle', ['id', 'plate_label', 'vehicle_type_id', 'home_base_id', 'legacy_ids'],
    [sqlStr(id), sqlStr(plate), sqlStr(vehicleTypeId), sqlStr(homeBaseId), sqlArr(['V' + num])]));
  return id;
}

// 受付(intake)→ reception（+ それを起点とする order は emitOrders 側で client 紐付け）
function emitReceptions(intakes) {
  out.push(`-- ② 受付層: AI電話受付（旧 localStorage intake を正規化）`);
  for (const k of intakes) {
    const id = 'rcpt_' + slug(k.id);
    const matched = companyByName.get(k.client) || null;
    const extraction = JSON.stringify({
      clientName: k.client, origin: k.from, destination: k.to,
      goods: k.goods, deadline: k.deadline, conditions: k.conditions,
    });
    out.push(insert('reception',
      ['id', 'channel', 'received_at', 'status', 'ai_confidence', 'matched_client_id', 'extraction', 'legacy_ids'],
      [sqlStr(id), sqlStr('ai_phone'), sqlStr(k.receivedAt), sqlStr('confirmed'),
       sqlStr('high'), sqlStr(matched), `${sqlStr(extraction)}::jsonb`, sqlArr([k.id])]));
    k._rcptId = id;
  }
}

// 案件（cases）→ transport_order（+ requirement / order_event）
function emitOrders(cases, year) {
  out.push(`-- ③ 案件層: transport_order（旧 4テーブルを統合）`);
  for (const c of cases) {
    const id = 'ord_' + slug(c.id);
    const clientId = companyByName.get(c.client);
    if (!clientId) { out.push(`-- [WARN] client未解決: ${c.client}（先にマスタ投入が必要）`); continue; }
    const originId = emitLocation(c.from);
    const destId = emitLocation(c.to);
    const g = parseGoods(c.goods);
    const dw = parseTimeWindow(c.deadline, year);
    const status = ORDER_STATUS[c.status] || 'unassigned';
    const cols = ['id', 'order_no', 'client_id', 'origin_location_id', 'destination_location_id',
      'cargo_description', 'cargo_packaging', 'cargo_weight_kg', 'cargo_temp_zone',
      'delivery_latest', 'delivery_label', 'delivery_strict',
      'pattern', 'priority', 'status', 'channel', 'completed_at', 'legacy_ids'];
    const vals = [sqlStr(id), sqlStr(c.id), sqlStr(clientId), sqlStr(originId), sqlStr(destId),
      sqlStr(g.description), sqlStr(g.packaging), sqlNum(g.weightKg), sqlStr(g.tempZone),
      sqlStr(dw.latest), sqlStr(dw.label), sqlBool(dw.strict),
      sqlStr(PATTERN[c.casePattern] || PATTERN[c.pattern] || 'spot'),
      sqlStr(PRIORITY[c.priority] || 'normal'), sqlStr(status), sqlStr(c.ch === 'mail' ? 'mail' : (c.ch ? 'phone' : 'manual')),
      sqlStr(status === 'completed' ? `${year}-05-25T10:00:00+09:00` : null), sqlArr([c.id])];
    out.push(insert('transport_order', cols, vals));
    // 状態イベント（初期状態の記録）
    out.push(insert('order_event', ['id', 'order_id', 'to_status', 'reason'],
      [sqlStr('oev_' + slug(c.id)), sqlStr(id), sqlStr(status), sqlStr('migrated from prototype')]));
    // 受付起点ならリンク
    if (c._fromReceptionId) {
      out.push(`UPDATE transport_order SET reception_id = ${sqlStr(c._fromReceptionId)} WHERE id = ${sqlStr(id)};`);
      out.push(`UPDATE reception SET order_id = ${sqlStr(id)} WHERE id = ${sqlStr(c._fromReceptionId)};`);
    }
    c._id = id;
  }
}

// 中継案件の legs[] → trip / leg / stop / assignment（運行層 SSoT。課題C6）
function emitRelayTrip(c, year) {
  out.push(`-- ④ 運行層: 中継運行 ${c.id}（旧 case.legs[] を Trip/Leg/Stop/Assignment へ）`);
  const tripId = 'trip_' + slug(c.id);
  out.push(insert('trip', ['id', 'service_date', 'status', 'shape', 'multi_reasons', 'legacy_ids'],
    [sqlStr(tripId), sqlStr(`${year}-05-27`), sqlStr('planned'), sqlStr('relay'),
     sqlArr(c.multiReasons || []), sqlArr([c.jobId || c.id])]));
  const orderId = 'ord_' + slug(c.id);
  const legIds = c.legs.map((_, i) => `leg_${slug(c.id)}_${i + 1}`);
  c.legs.forEach((lg, i) => {
    const driverId = registerDriver(lg.driverName);
    const vehicleId = registerVehicle(lg.vehicleName || lg.vehicleId);
    const isLast = i === c.legs.length - 1;
    const cols = ['id', 'trip_id', 'sequence_no', 'driver_id', 'vehicle_id', 'role',
      'start_at', 'end_at', 'handoff_type', 'handoff_location', 'next_leg_id',
      'work_load_min', 'work_drive_min', 'work_unload_min'];
    const vals = [sqlStr(legIds[i]), sqlStr(tripId), sqlNum(lg.legNo || i + 1), sqlStr(driverId), sqlStr(vehicleId),
      sqlStr('relay'), sqlStr(`${year}-05-27T${lg.startTime}:00+09:00`), sqlStr(`${year}-05-27T${lg.endTime}:00+09:00`),
      sqlStr(isLast ? null : 'driver_swap'), sqlStr(isLast ? null : lg.relayTo), sqlStr(isLast ? null : legIds[i + 1]),
      sqlNum(0), sqlNum(0), sqlNum(0)];
    out.push(insert('leg', cols, vals));
    // 立寄地：relayFrom / relayTo
    out.push(insert('stop', ['id', 'leg_id', 'sequence_no', 'kind', 'location_id', 'order_id'],
      [sqlStr(`${legIds[i]}_s1`), sqlStr(legIds[i]), sqlNum(1), sqlStr(i === 0 ? 'pickup' : 'relay_handoff'),
       sqlStr(emitLocation(lg.relayFrom)), sqlStr(orderId)]));
    out.push(insert('stop', ['id', 'leg_id', 'sequence_no', 'kind', 'location_id', 'order_id'],
      [sqlStr(`${legIds[i]}_s2`), sqlStr(legIds[i]), sqlNum(2), sqlStr(isLast ? 'dropoff' : 'relay_handoff'),
       sqlStr(emitLocation(lg.relayTo)), sqlStr(orderId)]));
    // 割当：同一 order を両 leg に（中継）
    out.push(insert('assignment', ['id', 'order_id', 'leg_id'],
      [sqlStr(`asgn_${slug(c.id)}_${i + 1}`), sqlStr(orderId), sqlStr(legIds[i])]));
    // 法令チェック（候補1位の law をこの leg のスナップショットに）
    const cand = (c.vehicles || [])[0];
    if (cand && cand.law) {
      const chkId = `comp_${slug(c.id)}_${i + 1}`;
      out.push(insert('compliance_check', ['id', 'leg_id', 'driver_id', 'overall'],
        [sqlStr(chkId), sqlStr(legIds[i]), sqlStr(driverId), sqlStr(cand.law.status === 'warn' ? 'warn' : 'ok')]));
      cand.law.items.forEach((it, k) => {
        out.push(insert('compliance_item', ['id', 'check_id', 'rule', 'ok', 'message'],
          [sqlStr(`${chkId}_${k}`), sqlStr(chkId), sqlStr(COMPLIANCE_RULE[it.title] || 'duty_hours'),
           sqlBool(it.ok), sqlStr(it.val)]));
      });
    }
  });
}

// 完了案件 → invoice（旧 processedCases の請求情報）
function emitInvoices(processed) {
  out.push(`-- ⑥ 請求層: invoice（旧 processedCases の請求情報）`);
  const seen = new Set();
  for (const p of processed) {
    if (!p.invoiceNo || seen.has(p.invoiceNo)) continue;
    seen.add(p.invoiceNo);
    const id = 'inv_' + slug(p.invoiceNo);
    const clientId = companyByName.get(p.client) || null;
    const cost = (p.fuel || 0) + (p.other || 0);
    out.push(insert('invoice',
      ['id', 'invoice_no', 'client_id', 'issue_date', 'due_date', 'total_jpy', 'cost_jpy', 'status', 'paid', 'confirmed_at', 'legacy_ids'],
      [sqlStr(id), sqlStr(p.invoiceNo), sqlStr(clientId),
       sqlStr(p.invoiceDate.replace(/\//g, '-')), sqlStr(p.due.replace(/\//g, '-')),
       sqlNum(p.sales || 0), sqlNum(cost), sqlStr(p.billingConfirmed ? 'issued' : 'draft'),
       sqlBool(p.paid), sqlStr(p.billingConfirmedAt ? p.billingConfirmedAt.replace(/\//g, '-').replace(' ', 'T') + ':00+09:00' : null),
       sqlArr([p.id])]));
  }
}

/* ───────────────────────── 5. 入力データ（代表サブセット） ───────────────── */
//  index.html / ai-phone-reception.html から抽出。全件移行時はここを差し替える。
const PROTOTYPE = {
  bases: [
    { id: 'B001', name: '川口拠点', region: '関東', aliases: ['川口市', '川口', '埼玉県川口市'] },
    { id: 'B005', name: '品川拠点', region: '関東', aliases: ['品川区', '品川', '東京都品川区'] },
    { id: 'B007', name: '横浜拠点', region: '関東', aliases: ['横浜市', '横浜', '神奈川県横浜市'] },
  ],
  baseDistances: [['B001', 'B005', 25], ['B005', 'B007', 18]],
  vehicleTypes: [
    { id: 'vtype_4t_flatbed', name: '4t平車', bodyType: 'flatbed', ton: 4, tempZones: ['ambient'] },
    { id: 'vtype_4t_wing', name: '4tウィング', bodyType: 'wing', ton: 4, tempZones: ['ambient'] },
    { id: 'vtype_2t', name: '2tトラック', bodyType: 'box', ton: 2, tempZones: ['ambient', 'chilled'] },
    { id: 'vtype_reefer', name: '冷蔵車', bodyType: 'reefer', ton: 4, tempZones: ['chilled', 'frozen'] },
  ],
  clients: [
    { id: 'CL-001', name: '株式会社○○商事', area: '埼玉県川口市', contact: '山田 花子', tel: '048-111-2222', email: 'y.hanako@marumarushouji.co.jp', type: '定期' },
    { id: 'CL-005', name: '関西化学工業株式会社', area: '大阪府大阪市', contact: '伊藤 四郎', tel: '06-9999-0000', email: 'ito@kansaichem.co.jp', type: 'チャーター' },
  ],
  partners: [
    { id: 'PT-001', name: '北関東物流株式会社', area: '埼玉県熊谷市', contact: '安藤 清志', tel: '048-222-3333', email: 'ando@kitatrans.co.jp' },
  ],
  team: [
    { id: 'me', name: '配車 太郎', color: '#1a7a5e', role: 'dispatcher' },
    { id: 'u2', name: '田中 花子', color: '#dc2626', role: 'dispatcher' },
  ],
  intakes: [
    { id: 'AI20260529134501', client: '株式会社サンライズ物産', from: '千葉県市原市', to: '神奈川県横浜市（横浜港）',
      goods: '建材 / 2,500kg / 常温（4t平ボディ）', deadline: '05/19 13:00 集荷指定',
      conditions: 'バース予約済み / 担当：佐藤様', receivedAt: '2026-05-29T13:45:01+09:00' },
  ],
  // 案件（単一便1件 + 中継便1件）
  simpleCases: [
    { id: '20240524001', client: '株式会社○○商事', from: '埼玉県川口市', to: '神奈川県横浜市',
      goods: 'パレット / 800kg / 常温', deadline: '05/25 AM指定', ch: 'tel', status: '未処理', casePattern: '定期案件' },
  ],
  relayCases: [
    { id: '20240524104', status: '処理中', priority: '緊急', casePattern: 'チャーター案件',
      client: '関西化学工業株式会社', from: '東京都品川区', to: '大阪府大阪市',
      goods: '化学品 / 900kg / 常温', deadline: '05/26 AM', jobId: 'J-20240524104-RELAY',
      multiReasons: ['長距離での運転手の改善基準対策', '拘束時間の分散'],
      legs: [
        { legNo: 1, vehicleId: '車両2580', vehicleName: '車両2580', driverName: '松本 十郎',
          role: 'relay', relayFrom: '東京都品川区', relayTo: '愛知県名古屋市', startTime: '06:00', endTime: '10:30' },
        { legNo: 2, vehicleId: '車両1245', vehicleName: '車両1245', driverName: '山田 一郎',
          role: 'relay', relayFrom: '愛知県名古屋市', relayTo: '大阪府大阪市', startTime: '11:00', endTime: '14:30' },
      ],
      vehicles: [{ rank: 1, id: '車両2580', driver: '松本 十郎', law: { status: 'ok', items: [
        { ok: true, title: '日間運転時間', val: '全員 9h以内' }, { ok: true, title: '拘束時間', val: '全員 13h以内' },
        { ok: true, title: '週間上限時間', val: '全員 週65h以内' }, { ok: true, title: '勤務間休息', val: 'インターバル8h確保' },
        { ok: true, title: '連続運転制限', val: '上限まで余裕あり' }, { ok: true, title: '休憩確保', val: '30分休憩ルール適合' },
      ] } }],
    },
  ],
  processedCases: [
    { id: '20240524001', client: '株式会社○○商事', sales: 45000, fuel: 18000, other: 0,
      invoiceNo: 'INV-202405-00123', invoiceDate: '2024/05/26', due: '2024/06/30', paid: false,
      billingConfirmed: true, billingConfirmedAt: '2024/05/27 10:30' },
  ],
};

/* ───────────────────────── 6. 実行 ──────────────────────────────────────── */
const YEAR = 2024;
out.push('-- ============================================================');
out.push('-- 自動生成: migration/transform_prototype.mjs（prototype → 理想モデル）');
out.push('-- 適用前提: db/schema.sql 済み。 psql -v ON_ERROR_STOP=1 -f db/seed_from_prototype.sql');
out.push('-- ============================================================');
out.push('BEGIN;');

emitUsers(PROTOTYPE.team);
emitBases(PROTOTYPE.bases, PROTOTYPE.baseDistances);
emitVehicleTypes(PROTOTYPE.vehicleTypes);
emitCompanies(PROTOTYPE.clients, PROTOTYPE.partners);
emitReceptions(PROTOTYPE.intakes);

// 受付→案件 のリンク用に、intake を案件化した1件を simpleCases に合成
const intakeOrder = (() => {
  const k = PROTOTYPE.intakes[0];
  return { id: 'AI-' + k.id, client: k.client, from: k.from, to: k.to, goods: k.goods,
    deadline: k.deadline, ch: 'tel', status: '未処理', casePattern: 'スポット案件', _fromReceptionId: k._rcptId };
})();
// サンライズ物産は clients に無いので会社マスタへ追加（受付からの新規荷主）
const sunrise = 'co_sunrise';
companyByName.set('株式会社サンライズ物産', sunrise);
out.push(insert('company', ['id', 'kind', 'name', 'client_type', 'legacy_ids'],
  [sqlStr(sunrise), sqlStr('client'), sqlStr('株式会社サンライズ物産'), sqlStr('spot'), sqlArr([])]));

emitOrders([...PROTOTYPE.simpleCases, intakeOrder, ...PROTOTYPE.relayCases], YEAR);
for (const c of PROTOTYPE.relayCases) emitRelayTrip(c, YEAR);
emitInvoices(PROTOTYPE.processedCases);

out.push('COMMIT;');
process.stdout.write(out.join(NL) + NL);
