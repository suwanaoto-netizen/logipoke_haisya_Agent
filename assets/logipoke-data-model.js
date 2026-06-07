/* ============================================================================
 *  Logipoke 配車Agent ― 理想7層データモデル（フロント実装 / バックエンド不要）
 * ----------------------------------------------------------------------------
 *  設計: docs/ideal-data-model.md / docs/operation-layer-deep-dive.md
 *  DDL : db/schema.sql（本モジュールはその in-browser 版。型・参照規約を一致させる）
 *
 *  ① マスタ  Company / Base / VehicleType / Vehicle / Driver / User / RecurringRoute
 *  ② 受付    Reception( + AiExtraction )
 *  ③ 案件    Order( + 値オブジェクト Location / Cargo / TimeWindow )
 *  ④ 運行★   Trip > Leg > Stop + Assignment      ← 単一情報源(SSoT)
 *  ⑤ 法令    ComplianceCheck / DriverWorkLog
 *  ⑥ 運賃    Fare / Invoice
 *  ⑦ 横断    Ownership / EditLock / AuditLog / Notification
 *
 *  ブラウザでは window.LogipokeDB、Node では module.exports で利用可能。
 *  localStorage への永続化は受付層(②)で使用（旧 INTAKE_QUEUE_KEY を正規化キーで置換）。
 * ========================================================================== */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;   // Node
  if (root) root.LogipokeDB = mod;                                             // Browser
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  /* ───────────────────────── ID 発番（プレフィックス付き安定ID） ───────────── */
  var _seq = {};
  function mkId(prefix) { _seq[prefix] = (_seq[prefix] || 0) + 1; return prefix + '_' + String(_seq[prefix]).padStart(4, '0'); }
  function resetSeq() { _seq = {}; }

  /* ───────────────────────── 値オブジェクト & パーサ（課題C4/C5を解消） ───── */

  // 生住所 → 構造化 Location（旧 from/to/area の文字列）
  function parseLocation(raw) {
    var s = String(raw == null ? '' : raw).trim();
    var pref = (s.match(/^(.+?[都道府県])/) || [])[1] || null;
    var city = (s.match(/[都道府県](.+?[市区町村])/) || [])[1] || null;
    var detail = null;
    var dm = s.match(/[（(](.+?)[）)]/);            // 「横浜市（横浜港）」→ 横浜港
    if (dm) detail = dm[1];
    return { raw: s, prefecture: pref, city: city, detail: detail, baseId: null };
  }

  // "パレット / 800kg / 常温" → 構造化 Cargo
  function parseCargo(goods) {
    var s = String(goods == null ? '' : goods);
    var head = (s.split('/')[0] || '').trim();
    var packaging =
      /パレット/.test(head) ? 'pallet' :
      /ケース|箱/.test(head) ? 'case' :
      /ロール/.test(head) ? 'roll' :
      /コンテナ/.test(head) ? 'container' :
      /バラ|ばら/.test(head) ? 'bulk' : 'other';
    var wm = s.match(/([\d,]+)\s*kg/);
    var weightKg = wm ? parseInt(wm[1].replace(/,/g, ''), 10) : 0;
    var tempZone = /冷凍/.test(s) ? 'frozen' : (/冷蔵/.test(s) ? 'chilled' : 'ambient');
    return { description: head, packaging: packaging, packageCount: null,
      weightKg: weightKg, volumeM3: null, tempZone: tempZone, hazardous: false, notes: null, raw: s };
  }

  // "05/25 AM指定" / "本日中" / "05/19 13:00 集荷指定" → 構造化 TimeWindow
  function parseTimeWindow(deadline, year) {
    var s = String(deadline == null ? '' : deadline).trim();
    if (!s) return { earliest: null, latest: null, label: null, strict: false };
    var strict = /指定|厳守/.test(s);
    var dm = s.match(/(\d{1,2})\/(\d{1,2})/);
    var tm = s.match(/(\d{1,2}):(\d{2})/);
    var hh = null;
    if (tm) hh = tm[1].padStart(2, '0') + ':' + tm[2];
    else if (/夜/.test(s)) hh = '21:00';
    else if (/夕方/.test(s)) hh = '17:00';
    else if (/PM/.test(s)) hh = '18:00';
    else if (/AM/.test(s)) hh = '12:00';
    else if (/終日/.test(s)) hh = '18:00';
    var latest = null;
    if (dm) latest = (year || new Date().getFullYear()) + '-' + dm[1].padStart(2, '0') + '-' + dm[2].padStart(2, '0') +
      'T' + (hh || '23:59') + ':00+09:00';
    return { earliest: null, latest: latest, label: s, strict: strict };
  }

  var CLIENT_TYPE_ENUM = { '定期': 'regular', 'スポット': 'spot', 'チャーター': 'charter', '特殊': 'special', '冷蔵': 'chilled' };
  var PATTERN_ENUM = { '定期案件': 'regular', 'スポット案件': 'spot', 'チャーター案件': 'charter', '特殊条件案件': 'special', '多地点配送': 'multidrop' };
  var COMPLIANCE_RULE_ENUM = { '日間運転時間': 'daily_drive', '拘束時間': 'duty_hours', '週間上限時間': 'weekly_cap',
    '勤務間休息': 'interval_rest', '連続運転制限': 'continuous_drive', '休憩確保': 'break_rule' };

  /* ───────────────────────── ストア（正規化エンティティの保持） ───────────── */
  function createDB() {
    return {
      // ① マスタ
      companies: new Map(), bases: new Map(), vehicleTypes: new Map(), vehicles: new Map(),
      drivers: new Map(), users: new Map(), recurringRoutes: new Map(), locations: new Map(),
      // ② 受付
      receptions: new Map(),
      // ③ 案件
      orders: new Map(),
      // ④ 運行（SSoT）
      trips: new Map(), legs: new Map(), stops: new Map(), assignments: new Map(),
      // ⑤ 法令
      complianceChecks: new Map(), complianceItems: new Map(), workLogs: new Map(),
      // ⑥ 運賃・請求
      fares: new Map(), invoices: new Map(),
      // ⑦ 横断
      ownerships: [], locks: new Map(), auditLog: [], notifications: [],
      // 名寄せ用インデックス（名前→ID。課題C3）
      _idx: { companyByName: new Map(), driverByName: new Map(), vehicleByPlate: new Map(), baseByAlias: new Map() }
    };
  }

  function _emitLocation(db, raw, baseId) {
    var loc = parseLocation(raw); loc.id = mkId('loc'); if (baseId) loc.baseId = baseId;
    db.locations.set(loc.id, loc); return loc.id;
  }

  /* ───────────────────────── ① マスタ：seed（旧配列を取込）+ adapter（旧形へ復元） ─ */

  function seedMasters(db, legacy) {
    legacy = legacy || {};
    // 拠点
    (legacy.bases || []).forEach(function (b) {
      var id = b.id;
      var locId = _emitLocation(db, (b.aliases && b.aliases[b.aliases.length - 1]) || b.name, id);
      db.bases.set(id, { id: id, name: b.name, region: b.region, aliases: (b.aliases || []).slice(), locationId: locId });
      (b.aliases || []).forEach(function (a) { db._idx.baseByAlias.set(a, id); });
    });
    // 社内ユーザー
    (legacy.users || []).forEach(function (u) {
      db.users.set(u.id, { id: u.id, name: u.name, color: u.color, initial: u.initial, role: u.role || 'dispatcher', active: true });
    });
    // 取引先 / 協力会社（統合）
    (legacy.clients || []).forEach(function (c) {
      var id = c.id, locId = _emitLocation(db, c.area, null);
      db.companies.set(id, {
        id: id, kind: 'client', name: c.name, locationId: locId,
        contact: { name: c.contact, tel: c.tel, email: c.email },
        clientType: CLIENT_TYPE_ENUM[c.type] || null, clientTypeRaw: c.type || null,
        billingFormatId: c.defaultFormatId || null, serviceableVehicleTypes: null,
        caseIds: (c.cases || []).slice(), legacyId: id
      });
      db._idx.companyByName.set(c.name, id);
    });
    (legacy.partners || []).forEach(function (p) {
      var id = p.id, locId = _emitLocation(db, p.area, null);
      db.companies.set(id, {
        id: id, kind: 'partner', name: p.name, locationId: locId,
        contact: { name: p.contact, tel: p.tel, email: p.email },
        clientType: null, clientTypeRaw: null, billingFormatId: null,
        serviceableVehicleTypes: (p.vehicleTypes || []).slice(),
        caseIds: (p.cases || []).slice(), legacyId: id,
        partnerRates: p.partnerRates, performance: p.performance
      });
      db._idx.companyByName.set(p.name, id);
    });
    // 車格（名称マスタ。旧 allVehicleTypes）
    (legacy.vehicleTypes || []).forEach(function (t) {
      db.vehicleTypes.set(t.name, { id: t.name, name: t.name });
    });
    // ドライバー / 車両（旧 drivers[] / vehicles[] をそのまま正規化保持）
    (legacy.drivers || []).forEach(function (d) {
      db.drivers.set(d.id, Object.assign({}, d)); db._idx.driverByName.set(d.name, d.id);
    });
    (legacy.vehicles || []).forEach(function (v) {
      db.vehicles.set(v.id, Object.assign({}, v)); if (v.plate) db._idx.vehicleByPlate.set(v.plate, v.id);
    });
    // 定期便
    (legacy.recurringRoutes || []).forEach(function (r, i) {
      var id = r.id || ('route_' + String(i + 1).padStart(3, '0'));
      db.recurringRoutes.set(id, {
        id: id, name: r.name, pattern: r.pattern, clientName: r.client,
        clientId: db._idx.companyByName.get(r.client) || null,
        originRaw: r.from, destinationRaw: r.to, frequency: r.freq,
        activeFrom: r.startDate, activeTo: r.endDate, standardFareJpy: parseInt(String(r.fare || '0').replace(/[^\d]/g, ''), 10) || 0,
        vehicleLabel: r.vehicle, autoCreateOrder: !!r.autoReflect, details: r.detail || {}, notes: r.note || ''
      });
    });
    return db;
  }

  // adapter：正規化 → 旧 clientMasterData 形（UI互換。lossless）
  function toClientMaster(db) {
    var out = [];
    db.companies.forEach(function (c) {
      if (c.kind !== 'client') return;
      var loc = db.locations.get(c.locationId);
      out.push({ id: c.id, defaultFormatId: c.billingFormatId, name: c.name, area: loc ? loc.raw : '',
        contact: c.contact.name, tel: c.contact.tel, email: c.contact.email, type: c.clientTypeRaw, cases: c.caseIds.slice() });
    });
    return out;
  }
  function toPartnerMaster(db) {
    var out = [];
    db.companies.forEach(function (c) {
      if (c.kind !== 'partner') return;
      var loc = db.locations.get(c.locationId);
      var o = { id: c.id, name: c.name, area: loc ? loc.raw : '', contact: c.contact.name, tel: c.contact.tel,
        email: c.contact.email, vehicleTypes: (c.serviceableVehicleTypes || []).slice(), cases: c.caseIds.slice() };
      // 増車推薦用の傭車レート/実績（存在時のみ。キー順は seed と一致＝lossless）
      if (c.partnerRates !== undefined) o.partnerRates = c.partnerRates;
      if (c.performance !== undefined) o.performance = c.performance;
      out.push(o);
    });
    return out;
  }
  function toBasesArray(db) {
    var out = []; db.bases.forEach(function (b) { out.push({ id: b.id, name: b.name, region: b.region, aliases: b.aliases.slice() }); }); return out;
  }
  function toTeamMembers(db) {
    var out = []; db.users.forEach(function (u) { out.push({ id: u.id, name: u.name, color: u.color, initial: u.initial }); }); return out;
  }
  // ドライバー / 車両：seedMasters が Object.assign で全プロパティを保持しているため、
  // 挿入順（=seed順）に射影すれば JSON 一致のロスレス往復（_ssotDerive 用）。
  function toDriversArray(db) {
    var out = []; db.drivers.forEach(function (d) { out.push(Object.assign({}, d)); }); return out;
  }
  function toVehiclesArray(db) {
    var out = []; db.vehicles.forEach(function (v) { out.push(Object.assign({}, v)); }); return out;
  }
  function toTeikiSamples(db) {
    var out = [];
    db.recurringRoutes.forEach(function (r) {
      out.push({ name: r.name, pattern: r.pattern, client: r.clientName, from: r.originRaw, to: r.destinationRaw,
        freq: r.frequency, startDate: r.activeFrom, endDate: r.activeTo, fare: String(r.standardFareJpy),
        vehicle: r.vehicleLabel, note: r.notes, autoReflect: r.autoCreateOrder, detail: r.details });
    });
    return out;
  }

  /* ───────────────────────── ② 受付層（AiExtraction を独立構造に） ──────────── */

  // 生フィールド（旧 intake 相当）→ 正規化 Reception + AiExtraction
  function createReception(db, input) {
    input = input || {};
    var rid = input.id || mkId('rcpt');
    var clientId = (db && db._idx) ? (db._idx.companyByName.get(input.client) || null) : null;
    var reception = {
      id: rid, channel: input.channel || 'ai_phone', receivedAt: input.receivedAt || new Date().toISOString(),
      status: input.status || 'pending', transcript: input.transcript || null, orderId: null, reviewedBy: null,
      legacyId: input.legacyId || rid,
      aiExtraction: {
        confidence: input.confidence || 'high',
        clientName: input.client || null, matchedClientId: clientId,
        origin: parseLocation(input.from), destination: parseLocation(input.to),
        cargo: parseCargo(input.goods), timeWindow: parseTimeWindow(input.deadline, (new Date()).getFullYear()),
        conditions: input.conditions ? String(input.conditions).split('/').map(function (x) { return x.trim(); }).filter(Boolean) : [],
        suggestedVehicleType: input.vehicleType || null
      }
    };
    if (db && db.receptions) db.receptions.set(rid, reception);
    return reception;
  }

  // Reception → 旧 intake 形（後方互換 / 取込用）
  function receptionToLegacyIntake(reception) {
    var ai = reception.aiExtraction || {};
    return {
      id: reception.id, client: ai.clientName, from: ai.origin ? ai.origin.raw : '', to: ai.destination ? ai.destination.raw : '',
      goods: ai.cargo ? ai.cargo.raw : '', deadline: ai.timeWindow ? ai.timeWindow.label : '',
      conditions: (ai.conditions || []).join(' / '), ch: reception.channel === 'mail' ? 'mail' : 'tel',
      source: 'ai-phone-reception', receivedAt: reception.receivedAt,
      time: (function () { var d = new Date(reception.receivedAt); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); })()
    };
  }

  /* 受付の localStorage 永続化（正規化キー。旧 INTAKE_QUEUE_KEY を置換） */
  var RECEPTION_KEY = 'logipoke_db_receptions_v1';
  function _hasLS() { try { return typeof localStorage !== 'undefined'; } catch (e) { return false; } }
  function saveReceptions(list) { if (_hasLS()) localStorage.setItem(RECEPTION_KEY, JSON.stringify(list || [])); }
  function loadReceptions() { if (!_hasLS()) return []; try { var r = localStorage.getItem(RECEPTION_KEY); return r ? JSON.parse(r) : []; } catch (e) { return []; } }
  function pushReception(reception) { var list = loadReceptions(); list.push(reception); saveReceptions(list); return reception; }
  function clearReceptions() { if (_hasLS()) localStorage.removeItem(RECEPTION_KEY); }

  /* ───────────────────────── ④ 運行層（SSoT）最小ファクトリ ─────────────────── */
  function createTrip(db, t) {
    var id = (t && t.id) || mkId('trip');
    var trip = Object.assign({ id: id, tab: 'planning', status: 'planned', shape: 'single', multiReasons: [],
      ownerId: null, mainOwnerId: null, relatedReturnTripId: null, riskFlag: false }, t || {}, { id: id });
    db.trips.set(id, trip); return trip;
  }
  function addLeg(db, l) {
    var id = (l && l.id) || mkId('leg');
    var leg = Object.assign({ id: id, sequenceNo: 1, role: 'pickup_delivery', handoffType: null, handoffLocation: null,
      nextLegId: null, crossBase: false, work: { load: 0, drive: 0, unload: 0, rest: 0 }, active: true }, l || {}, { id: id });
    db.legs.set(id, leg); return leg;
  }
  function addStop(db, s) { var id = (s && s.id) || mkId('stop'); var stop = Object.assign({ id: id, sequenceNo: 1, kind: 'pickup' }, s || {}, { id: id }); db.stops.set(id, stop); return stop; }
  function assign(db, a) { var id = (a && a.id) || mkId('asgn'); var as = Object.assign({ id: id }, a || {}, { id: id }); db.assignments.set(id, as); return as; }

  // 案件タイムライン（v_case_timeline 相当の派生）
  function deriveCaseTimeline(db, orderId) {
    var out = [];
    db.assignments.forEach(function (a) {
      if (a.orderId !== orderId) return;
      var leg = db.legs.get(a.legId); if (!leg || !leg.active) return;
      var drv = db.drivers.get(leg.driverId), veh = db.vehicles.get(leg.vehicleId);
      out.push({ orderId: orderId, legId: leg.id, sequenceNo: leg.sequenceNo, role: leg.role,
        startAt: leg.startAt, endAt: leg.endAt, handoffType: leg.handoffType,
        driverName: drv ? drv.name : null, vehicleLabel: veh ? veh.plate : null });
    });
    return out.sort(function (x, y) { return (x.sequenceNo || 0) - (y.sequenceNo || 0); });
  }

  /* ───────────────────────── ④ 運行層 取込（旧 case.legs[] → SSoT）課題C6 ───── */
  // 旧プロトタイプの案件(caseObj)を Trip>Leg>Stop+Assignment へ取込む（書込先を一本化）。
  // vehicleMode: single/relay/multi を Trip.shape に集約し、中継は driver_swap 引き継ぎ＋
  // next_leg_id 連鎖で表現。区間の担当はプロトタイプ表記(driverName/vehicleLabel)のまま保持
  // （氏名→ID解決＝C2/C3 は別フェーズ。本フェーズは「運行構造の一本化」に限定）。
  var _CASE_SHAPE = { single: 'single', relay: 'relay', multi: 'co_load' };
  // toCaseLegs が正規化スロット/Stop から復元するキー。それ以外は _extra に温存（完全ロスレス）。
  var _CASELEG_MAPPED = {
    legId: 1, legNo: 1, vehicleId: 1, vehicleName: 1, driverName: 1, role: 1,
    relayFrom: 1, relayTo: 1, startTime: 1, endTime: 1
  };
  function ingestCaseLegs(db, caseObj) {
    caseObj = caseObj || {};
    var shape = _CASE_SHAPE[caseObj.vehicleMode] || 'single';
    var orderId = caseObj.id || mkId('ord');
    if (db.orders && !db.orders.has(orderId)) {
      db.orders.set(orderId, {
        id: orderId, orderNo: orderId, clientName: caseObj.client || null,
        pattern: PATTERN_ENUM[caseObj.casePattern] || 'spot',
        originRaw: caseObj.from || null, destinationRaw: caseObj.to || null, legacyCase: caseObj
      });
    }
    var trip = createTrip(db, {
      id: caseObj.jobId || mkId('trip'), shape: shape,
      multiReasons: (caseObj.multiReasons || []).slice(), legacyCaseId: orderId
    });
    // legs[] が無い単一便は 案件の from/to/vehicle/driver から1区間を合成
    var srcLegs = (caseObj.legs && caseObj.legs.length) ? caseObj.legs : [{
      legNo: 1, vehicleId: caseObj.vehicle, vehicleName: caseObj.vehicle, driverName: caseObj.driver,
      relayFrom: caseObj.from, relayTo: caseObj.to, startTime: caseObj.startTime, endTime: caseObj.endTime,
      role: 'pickup_delivery'
    }];
    var isRelay = shape === 'relay';
    var legIds = [];
    srcLegs.forEach(function (l, i) {
      var lastLeg = i === srcLegs.length - 1;
      // 中継編集(c.legs)の拡張フィールド（vehicleType/vehicleIdx/lawOk/notes 等）を温存し、
      // toCaseLegs で完全ロスレスに復元する（モデルが拡張フィールドを吸収＝C6・第7段）。
      var legExtra = {};
      Object.keys(l).forEach(function (k) { if (!_CASELEG_MAPPED[k]) legExtra[k] = l[k]; });
      var leg = addLeg(db, {
        id: l.legId || mkId('leg'), tripId: trip.id, sequenceNo: l.legNo || (i + 1),
        driverName: l.driverName || null, vehicleLabel: l.vehicleId || l.vehicleName || null,
        role: l.role || (isRelay ? 'relay' : 'pickup_delivery'),
        startTime: l.startTime || null, endTime: l.endTime || null,
        handoffType: (isRelay && !lastLeg) ? 'driver_swap' : null,
        handoffLocation: (isRelay && !lastLeg) ? (l.relayTo || null) : null,
        capacity: l.capacity || null, notes: l.notes || null,
        vehicleName: l.vehicleName, _extra: legExtra, _origKeys: Object.keys(l)
      });
      // Stop: 発(pickup/中継受け) → 着(dropoff/中継渡し)
      addStop(db, { legId: leg.id, sequenceNo: 1, kind: (isRelay && i > 0) ? 'relay_handoff' : 'pickup',
        locationRaw: l.relayFrom || null, orderId: orderId });
      addStop(db, { legId: leg.id, sequenceNo: 2, kind: (isRelay && !lastLeg) ? 'relay_handoff' : 'dropoff',
        locationRaw: l.relayTo || null, orderId: orderId });
      // Assignment: 同一案件を各区間へ（中継は両Legに同一Order＝多対多の中核）
      assign(db, { orderId: orderId, legId: leg.id, sequenceNo: leg.sequenceNo });
      legIds.push(leg.id);
    });
    // 区間連鎖（前→次）
    for (var k = 0; k < legIds.length - 1; k++) { db.legs.get(legIds[k]).nextLegId = legIds[k + 1]; }
    return { tripId: trip.id, orderId: orderId, legIds: legIds };
  }

  /* ───────────────────────── ④ 運行層 派生（SSoT → 旧3画面）課題C6 ─────────── */
  function _legStops(db, legId) {
    var s = []; db.stops.forEach(function (x) { if (x.legId === legId) s.push(x); });
    return s.sort(function (a, b) { return (a.sequenceNo || 0) - (b.sequenceNo || 0); });
  }
  function _legClients(db, legId) {
    var names = [];
    db.assignments.forEach(function (a) {
      if (a.legId !== legId) return;
      var o = db.orders.get(a.orderId);
      if (o && o.clientName && names.indexOf(o.clientName) < 0) names.push(o.clientName);
    });
    return names;
  }

  // v_schedule_block 相当：1 Leg = 1ブロック（配車計画ガント）
  function toScheduleBlocks(db) {
    var out = [];
    db.legs.forEach(function (leg) {
      if (leg.active === false) return;
      var stops = _legStops(db, leg.id);
      var trip = db.trips.get(leg.tripId);
      out.push({
        legId: leg.id, tripId: leg.tripId, shape: trip ? trip.shape : null,
        sequenceNo: leg.sequenceNo, driverName: leg.driverName, vehicleLabel: leg.vehicleLabel,
        role: leg.role, start: leg.startTime, end: leg.endTime,
        from: stops.length ? stops[0].locationRaw : null,
        to: stops.length ? stops[stops.length - 1].locationRaw : null,
        clients: _legClients(db, leg.id).join(' / '),
        handoffType: leg.handoffType, handoffLocation: leg.handoffLocation
      });
    });
    return out.sort(function (a, b) {
      return String(a.tripId + '#' + a.sequenceNo).localeCompare(String(b.tripId + '#' + b.sequenceNo));
    });
  }

  // v_dnd_board 相当：driver×vehicle ごとの区間配列（DnDボード）
  function toDndBoard(db) {
    var byKey = {};
    db.legs.forEach(function (leg) {
      if (leg.active === false) return;
      var key = (leg.driverName || '?') + '|' + (leg.vehicleLabel || '?');
      if (!byKey[key]) byKey[key] = { driverName: leg.driverName, vehicleLabel: leg.vehicleLabel, legs: [] };
      byKey[key].legs.push({ legId: leg.id, role: leg.role, start: leg.startTime, end: leg.endTime, handoff: leg.handoffType });
    });
    return Object.keys(byKey).map(function (k) {
      byKey[k].legs.sort(function (a, b) { return String(a.start).localeCompare(String(b.start)); });
      return byKey[k];
    });
  }

  // ── DnDボード通常行(dndAssignments[driverId][dateKey]) の SSoT ロスレス往復（課題C6・第9段）──
  // 1ブロック=1 Leg。start/end/from/to を正規化スロット/Stop へ、その他（client/goods/積荷段組
  // loadMin等/中継注入マーカー _relayLegId 等）は _extra に温存。toDndBlocks で完全ロスレス復元。
  var _DNDBLOCK_MAPPED = { start: 1, end: 1, from: 1, to: 1 };
  function ingestDndBlocks(db, driverId, dateKey, blocks) {
    blocks = blocks || [];
    var tripKey = 'dnd|' + driverId + '|' + dateKey;
    var trip = db.trips.get(tripKey) || createTrip(db, {
      id: tripKey, tab: 'planning', serviceDate: dateKey || null, shape: 'single', source: 'dnd', dndDriverId: driverId
    });
    blocks.forEach(function (b, i) {
      var extra = {};
      Object.keys(b).forEach(function (k) { if (!_DNDBLOCK_MAPPED[k]) extra[k] = b[k]; });
      var leg = addLeg(db, {
        id: tripKey + '#' + i, tripId: trip.id, sequenceNo: i + 1, driverId: driverId,
        startTime: b.start, endTime: b.end, role: 'pickup_delivery',
        _extra: extra, _origKeys: Object.keys(b), _dndIdx: i
      });
      addStop(db, { legId: leg.id, sequenceNo: 1, kind: 'pickup', locationRaw: b.from });
      addStop(db, { legId: leg.id, sequenceNo: 2, kind: 'dropoff', locationRaw: b.to });
    });
    return db;
  }
  function toDndBlocks(db, driverId, dateKey) {
    var tripKey = 'dnd|' + driverId + '|' + dateKey;
    var rows = [];
    db.legs.forEach(function (leg) {
      if (leg.tripId !== tripKey || leg.active === false) return;
      var stops = _legStops(db, leg.id);
      var full = { start: leg.startTime, end: leg.endTime,
        from: stops.length ? stops[0].locationRaw : null,
        to: stops.length ? stops[stops.length - 1].locationRaw : null };
      var extra = leg._extra || {};
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) full[k] = extra[k];
      var keys = leg._origKeys || Object.keys(full);
      var rec = {};
      keys.forEach(function (k) { rec[k] = full[k]; });
      rec.__idx = leg._dndIdx;
      rows.push(rec);
    });
    rows.sort(function (a, b) { return (a.__idx || 0) - (b.__idx || 0); });
    rows.forEach(function (r) { delete r.__idx; });
    return rows;
  }

  // v_case_timeline 相当（プロトタイプ表記の driverName/vehicleLabel をそのまま射影）
  function toCaseTimeline(db, orderId) {
    var rows = [];
    db.assignments.forEach(function (a) {
      if (a.orderId !== orderId) return;
      var leg = db.legs.get(a.legId); if (!leg || leg.active === false) return;
      var stops = _legStops(db, leg.id);
      rows.push({
        orderId: orderId, legId: leg.id, sequenceNo: leg.sequenceNo, role: leg.role,
        start: leg.startTime, end: leg.endTime, handoffType: leg.handoffType, handoffLocation: leg.handoffLocation,
        driverName: leg.driverName, vehicleLabel: leg.vehicleLabel,
        from: stops.length ? stops[0].locationRaw : null,
        to: stops.length ? stops[stops.length - 1].locationRaw : null,
        isMultiday: false
      });
    });
    return rows.sort(function (x, y) { return (x.sequenceNo || 0) - (y.sequenceNo || 0); });
  }

  // SSoT → 旧 c.legs 形（完全ロスレス復元。中継編集の書込面を SSoT から再構成できる土台）。
  function toCaseLegs(db, orderId) {
    var rows = [];
    db.assignments.forEach(function (a) {
      if (a.orderId !== orderId) return;
      var leg = db.legs.get(a.legId); if (!leg || leg.active === false) return;
      var stops = _legStops(db, leg.id);
      var full = {
        legId: leg.id, legNo: leg.sequenceNo,
        vehicleId: leg.vehicleLabel, vehicleName: leg.vehicleName != null ? leg.vehicleName : leg.vehicleLabel,
        driverName: leg.driverName, role: leg.role,
        relayFrom: stops.length ? stops[0].locationRaw : null,
        relayTo: stops.length ? stops[stops.length - 1].locationRaw : null,
        startTime: leg.startTime, endTime: leg.endTime
      };
      var extra = leg._extra || {};
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) full[k] = extra[k];
      var keys = leg._origKeys || Object.keys(full);
      var rec = {};
      keys.forEach(function (k) { rec[k] = full[k]; });
      rec._seq = leg.sequenceNo;   // 並び替え用（出力では除去）
      rows.push(rec);
    });
    rows.sort(function (x, y) { return (x._seq || 0) - (y._seq || 0); });
    rows.forEach(function (r) { delete r._seq; });
    return rows;
  }

  /* ───────────────────────── ④ 運行層 取込（旧 assignments[] → SSoT）課題C6 ─── */
  // 配車計画ガント/DnD通常行の正準フラット層 assignments[]（1ブロック=1運行）を
  // 正規化 Trip>Leg>Stop+Assignment へ取込む。同一(tab×日×driver×vehicle)を1 Tripに束ね、
  // 各ブロックを Leg（pickup/dropoff の2 Stop）として表現。表示/再構築に要する素フィールドは
  // 欠損なく保持し、toAssignments でロスレスに復元できる（ガントの裏付けをSSoTへ移すための土台）。
  // 拡張フィールドを正規化スロットへ吸収（完全インバージョンの土台＝課題C6・第7段）。
  // 下記キーは Leg/Order/Stop の正規化スロットから復元する（モデルが権威）。それ以外（DnD固有の
  // loadMin/driveMin/sub/isPreset 等）は assignment._extra に温存し、_origKeys で元の形に射影する。
  var _ASSIGN_MAPPED = {
    id:1, tab:1, date:1, driverId:1, vehicleId:1, start:1, end:1, status:1, client:1, from:1, to:1,
    goods:1, deadline:1, label:1, color:1, effectiveBaseId:1, crossBase:1, ownerId:1, mainOwnerId:1,
    caseIds:1, isReturn:1, relatedReturnId:1, createdAt:1, updatedAt:1
  };
  function ingestAssignments(db, flat) {
    flat = flat || [];
    var seqByTrip = {};
    flat.forEach(function (a) {
      var tripKey = [a.tab, a.date, a.driverId, a.vehicleId].join('|');
      var trip = db.trips.get(tripKey) || createTrip(db, {
        id: tripKey, tab: a.tab || 'planning', serviceDate: a.date || null, shape: 'single', source: 'assignments'
      });
      var seq = (seqByTrip[tripKey] = (seqByTrip[tripKey] || 0) + 1);
      // 区間単位の拡張フィールドを Leg スロットへ吸収（1 assignment = 1 Leg のため可逆）。
      var leg = addLeg(db, {
        id: a.id, tripId: trip.id, sequenceNo: seq,
        driverId: a.driverId, vehicleId: a.vehicleId,
        startTime: a.start, endTime: a.end, status: a.status, role: 'pickup_delivery',
        effectiveBaseId: a.effectiveBaseId, crossBase: a.crossBase,
        ownerId: a.ownerId, mainOwnerId: a.mainOwnerId,
        isReturn: a.isReturn, relatedReturnId: a.relatedReturnId,
        legCreatedAt: a.createdAt, legUpdatedAt: a.updatedAt
      });
      addStop(db, { legId: leg.id, sequenceNo: 1, kind: 'pickup', locationRaw: a.from, orderId: a.id });
      addStop(db, { legId: leg.id, sequenceNo: 2, kind: 'dropoff', locationRaw: a.to, orderId: a.id });
      if (db.orders && !db.orders.has(a.id)) {
        db.orders.set(a.id, { id: a.id, orderNo: a.id, clientName: a.client || null,
          goods: a.goods || null, deadline: a.deadline || null, originRaw: a.from || null,
          destinationRaw: a.to || null, caseIds: a.caseIds });
      }
      // 非マッピング項目を温存（完全ロスレス）。元のキー集合も保持し、射影時に余分なキーを出さない。
      var extra = {};
      Object.keys(a).forEach(function (k) { if (!_ASSIGN_MAPPED[k]) extra[k] = a[k]; });
      assign(db, { id: a.id, orderId: a.id, legId: leg.id, label: a.label, color: a.color,
        _extra: extra, _origKeys: Object.keys(a) });
    });
    return db;
  }

  // SSoT → 旧 assignments[] 形（完全ロスレス復元。元のキー集合のみ射影し deepStrictEqual を満たす）。
  function toAssignments(db) {
    var out = [];
    db.assignments.forEach(function (as) {
      var leg = db.legs.get(as.legId); if (!leg) return;
      var trip = db.trips.get(leg.tripId) || {};
      var order = db.orders.get(as.orderId) || {};
      var stops = _legStops(db, leg.id);
      var full = {
        id: as.id, tab: trip.tab, date: trip.serviceDate,
        driverId: leg.driverId, vehicleId: leg.vehicleId,
        start: leg.startTime, end: leg.endTime, status: leg.status,
        client: order.clientName, from: stops.length ? stops[0].locationRaw : null,
        to: stops.length ? stops[stops.length - 1].locationRaw : null,
        goods: order.goods, deadline: order.deadline, label: as.label, color: as.color,
        effectiveBaseId: leg.effectiveBaseId, crossBase: leg.crossBase,
        ownerId: leg.ownerId, mainOwnerId: leg.mainOwnerId, caseIds: order.caseIds,
        isReturn: leg.isReturn, relatedReturnId: leg.relatedReturnId,
        createdAt: leg.legCreatedAt, updatedAt: leg.legUpdatedAt
      };
      var extra = as._extra || {};
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) full[k] = extra[k];
      // 元の assignment が持っていたキーだけを出力（undefined キー混入を防ぐ）。
      var keys = as._origKeys || Object.keys(full);
      var rec = {};
      keys.forEach(function (k) { rec[k] = full[k]; });
      out.push(rec);
    });
    return out.sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
  }

  /* ───────────────────────── ④ 運行層 書込・不変条件（課題C6・第4段）─────────
   *  SSoT を「書込先（権威）」にする。I1/I2（同一ドライバー/車両が同一 service_date で
   *  時間重複する区間を持てない＝schema.sql の EXCLUDE 制約相当）を正規化レイヤーで強制。
   *  I6 積載量/I7 免許は車両マスタ参照のためアプリ層に残す（deep-dive §2）。
   * ------------------------------------------------------------------------- */
  function _hhmmMin(t) {
    if (t == null) return null;
    var p = String(t).split(':'); var h = parseInt(p[0], 10), m = parseInt(p[1] || '0', 10);
    return isNaN(h) ? null : h * 60 + (isNaN(m) ? 0 : m);
  }
  // I1/I2：対象 Leg と時間重複する「同一ドライバー / 同一車両」の Leg id を返す。
  function checkLegConflicts(db, legId) {
    var out = { driver: [], vehicle: [] };
    var leg = db.legs.get(legId); if (!leg || leg.active === false) return out;
    var date = (db.trips.get(leg.tripId) || {}).serviceDate || null;
    var s = _hhmmMin(leg.startTime), e = _hhmmMin(leg.endTime);
    if (s == null || e == null) return out;
    db.legs.forEach(function (o) {
      if (o.id === leg.id || o.active === false) return;
      if (((db.trips.get(o.tripId) || {}).serviceDate || null) !== date) return;
      var os = _hhmmMin(o.startTime), oe = _hhmmMin(o.endTime);
      if (os == null || oe == null) return;
      if (!(s < oe && os < e)) return;                         // 重複なし
      if (o.driverId != null && o.driverId === leg.driverId) out.driver.push(o.id);
      if (o.vehicleId != null && o.vehicleId === leg.vehicleId) out.vehicle.push(o.id);
    });
    return out;
  }
  // 書込：Leg のドライバー/車両を差し替え（SSoT が書込先）、I1/I2 判定を併せて返す。
  function reassignLeg(db, legId, change) {
    var leg = db.legs.get(legId);
    if (!leg) return { ok: false, reason: 'leg not found', conflicts: { driver: [], vehicle: [] } };
    change = change || {};
    if (change.driverId != null) leg.driverId = change.driverId;
    if (change.vehicleId != null) leg.vehicleId = change.vehicleId;
    var conflicts = checkLegConflicts(db, legId);
    return { ok: conflicts.driver.length === 0 && conflicts.vehicle.length === 0, conflicts: conflicts, legId: legId };
  }

  // 中継編集(c.legs)の書込検証：I9（引き継ぎ連続性＝前区間の着=次区間の発）と、
  // 同一ドライバーが時間重複する2区間を担当（I1相当）を検出。書込面 c.legs はそのまま、
  // この検証を権威にしてUIへ不整合を提示する（書込側の不変条件をSSoT層に集約）。
  function validateRelayLegs(legs) {
    legs = legs || [];
    var issues = [];
    for (var i = 0; i < legs.length - 1; i++) {
      var cur = legs[i], nxt = legs[i + 1];
      if (cur.relayTo && nxt.relayFrom && String(cur.relayTo) !== String(nxt.relayFrom)) {
        issues.push({ type: 'handoff_gap', seq: cur.legNo || (i + 1), detail: cur.relayTo + ' ≠ ' + nxt.relayFrom });
      }
    }
    for (var a = 0; a < legs.length; a++) {
      for (var b = a + 1; b < legs.length; b++) {
        var la = legs[a], lb = legs[b];
        if (!la.driverName || la.driverName !== lb.driverName) continue;
        var s1 = _hhmmMin(la.startTime), e1 = _hhmmMin(la.endTime);
        var s2 = _hhmmMin(lb.startTime), e2 = _hhmmMin(lb.endTime);
        if (s1 == null || e1 == null || s2 == null || e2 == null) continue;
        if (s1 < e2 && s2 < e1) issues.push({ type: 'driver_overlap', detail: la.driverName });
      }
    }
    return { ok: issues.length === 0, issues: issues };
  }

  /* ───────────────────────── ④ 運行層 永続ストア（課題C6・第8段／物理統合）──────
   *  単一の永続 LogipokeDB を保持し、レガシー配列(assignments[])を無損失同期。
   *  reader を本ストアからの「ライブ派生」へ1画面ずつ切替える物理統合の足場。
   *  ・syncFromAssignments: 書込時に呼び、運行層エンティティを再構築（完全ロスレス）。
   *  ・getAssignments(tab): フラット層をライブ派生（toAssignments）。
   *  ・reassign: 本ストア上で I1/I2 検証付き書込（将来の書込先一本化用）。
   * ------------------------------------------------------------------------- */
  function createOperationStore() {
    var db = createDB();
    return {
      db: db,
      // レガシー assignments[] から運行層を再構築（運行エンティティのみクリアして再取込）
      syncFromAssignments: function (flat) {
        db.trips.clear(); db.legs.clear(); db.stops.clear(); db.assignments.clear(); db.orders.clear();
        ingestAssignments(db, flat || []);
        return this;
      },
      getAssignments: function (tab) {
        var all = toAssignments(db);
        return tab ? all.filter(function (a) { return a.tab === tab; }) : all;
      },
      checkConflicts: function (id) { return checkLegConflicts(db, id); },
      reassign: function (id, change) { return reassignLeg(db, id, change); },
      // 書込先一本化：1件追加（id=assignment id でleg/order/assignmentを生成）
      add: function (rec) { ingestAssignments(db, [rec]); return this; },
      // 1件削除（leg/stops/order/assignment を id で除去）
      remove: function (id) {
        var del = []; db.stops.forEach(function (s) { if (s.legId === id) del.push(s.id); });
        del.forEach(function (sid) { db.stops.delete(sid); });
        db.legs.delete(id); db.assignments.delete(id); db.orders.delete(id);
        return this;
      },
      // 1件更新（driver/vehicle/時刻を差し替え。move 等の多フィールド変更用）
      update: function (id, patch) {
        var leg = db.legs.get(id); if (!leg) return this; patch = patch || {};
        if (patch.driverId != null) leg.driverId = patch.driverId;
        if (patch.vehicleId != null) leg.vehicleId = patch.vehicleId;
        if (patch.start != null) leg.startTime = patch.start;
        if (patch.end != null) leg.endTime = patch.end;
        return this;
      }
    };
  }

  /* ───────────────────────── 公開API ─────────────────────────────────────── */
  return {
    // helpers / value objects
    mkId: mkId, resetSeq: resetSeq, parseLocation: parseLocation, parseCargo: parseCargo, parseTimeWindow: parseTimeWindow,
    CLIENT_TYPE_ENUM: CLIENT_TYPE_ENUM, PATTERN_ENUM: PATTERN_ENUM, COMPLIANCE_RULE_ENUM: COMPLIANCE_RULE_ENUM,
    // store
    createDB: createDB,
    // ① masters
    seedMasters: seedMasters, toClientMaster: toClientMaster, toPartnerMaster: toPartnerMaster,
    toBasesArray: toBasesArray, toTeamMembers: toTeamMembers, toTeikiSamples: toTeikiSamples,
    toDriversArray: toDriversArray, toVehiclesArray: toVehiclesArray,
    // ② reception
    createReception: createReception, receptionToLegacyIntake: receptionToLegacyIntake,
    RECEPTION_KEY: RECEPTION_KEY, saveReceptions: saveReceptions, loadReceptions: loadReceptions,
    pushReception: pushReception, clearReceptions: clearReceptions,
    // ④ operation
    createTrip: createTrip, addLeg: addLeg, addStop: addStop, assign: assign, deriveCaseTimeline: deriveCaseTimeline,
    // ④ operation：旧 case.legs[] → SSoT 取込 と SSoT → 3画面 派生（課題C6）
    ingestCaseLegs: ingestCaseLegs, toScheduleBlocks: toScheduleBlocks, toDndBoard: toDndBoard,
    toCaseTimeline: toCaseTimeline, toCaseLegs: toCaseLegs,
    // ④ operation：DnD通常行(dndAssignmentsブロック)の SSoT ロスレス往復（課題C6・第9段）
    ingestDndBlocks: ingestDndBlocks, toDndBlocks: toDndBlocks,
    // ④ operation：旧 assignments[]（ガント/DnD正準層）の SSoT ロスレス往復（課題C6・第3段）
    ingestAssignments: ingestAssignments, toAssignments: toAssignments,
    // ④ operation：書込先SSoT化＋不変条件 I1/I2 の強制（課題C6・第4段）
    checkLegConflicts: checkLegConflicts, reassignLeg: reassignLeg,
    // ④ operation：中継編集(c.legs)の書込検証 I9/ドライバー重複（課題C6・第5段）
    validateRelayLegs: validateRelayLegs,
    // ④ operation：永続ストア（物理統合の足場・課題C6・第8段）
    createOperationStore: createOperationStore
  };
});
