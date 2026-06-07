/* ============================================================================
 *  Logipoke 配車Agent ― 増車（scale-out）推薦エンジン
 * ----------------------------------------------------------------------------
 *  設計: docs/scale-out-judgement.md（後続フェーズ）
 *  増車判定(verdict=required/recommended)の後段：
 *    AI自社車両推薦 → AI協力会社推薦 → AI運賃推薦 → 増車プラン合成
 *  をすべて決定的ロジックで提供する純モジュール（LLM非依存・Node単体テスト可能）。
 *
 *  方針（既存 calcFare/AI_WEIGHTS と整合）:
 *    - コスト積み上げは calcFare と同じ係数（燃料/高速/人件費/車両/諸経費15%）。
 *    - 自社は候補スコアで貪欲選抜（積載を満たす最小台数）、不足分を協力会社で補完。
 *    - 運賃＝受注額 − 自社原価 − 傭車支払 → 粗利/粗利率。
 *
 *  ブラウザでは window.LogipokeRecommend、Node では module.exports。
 * ========================================================================== */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  if (root) root.LogipokeRecommend = mod;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  /* ───────────────────────── 既定パラメータ ───────────────────────────────── */
  // 車格別コスト係数（index.html getVehicleParams と一致）。
  var COST_PARAMS = {
    light: { fuelKm: 12,  fuelCost: 175, highwayPer100: 600,  driverHourly: 2200, depreciationDay: 2500, maxLoadKg: 350,   name: '軽バン' },
    t2:    { fuelKm: 8,   fuelCost: 175, highwayPer100: 1800, driverHourly: 2800, depreciationDay: 4000, maxLoadKg: 2000,  name: '2tトラック' },
    t4:    { fuelKm: 5,   fuelCost: 175, highwayPer100: 3200, driverHourly: 3200, depreciationDay: 6000, maxLoadKg: 4000,  name: '4tウィング' },
    t10:   { fuelKm: 3.5, fuelCost: 175, highwayPer100: 5500, driverHourly: 3800, depreciationDay: 9000, maxLoadKg: 10000, name: '10tトラック' }
  };
  var DEFAULT_PARAMS = {
    PARTNER_MARKUP: 1.18,   // 傭車支払 ≒ 協力会社の原価 × この係数（協力会社の利幅込み）
    TARGET_MARGIN: 1.28,    // 受注額フォールバック（原価×この係数）。calcFare と一致
    MARGIN_OK_PCT: 20,      // 粗利率の OK しきい
    MARGIN_WARN_PCT: 10,    // 粗利率の 要交渉しきい
    AVG_SPEED_KMH: 60,      // 平均速度
    LOAD_UNLOAD_H: 1.5      // 積降し時間
  };

  /* ───────────────────────── 共通ヘルパー ─────────────────────────────────── */
  function round1000(n) { return Math.round(n / 1000) * 1000; }
  function paramsForCapKg(kg) {
    if (!kg || kg <= 350) return COST_PARAMS.light;
    if (kg <= 2000) return COST_PARAMS.t2;
    if (kg <= 4000) return COST_PARAMS.t4;
    return COST_PARAMS.t10;
  }
  function paramsForLabel(label) {
    var s = String(label == null ? '' : label);
    if (/軽/.test(s)) return COST_PARAMS.light;
    if (/10\s*t|大型/i.test(s)) return COST_PARAMS.t10;
    if (/4\s*t|ウィング|中型/i.test(s)) return COST_PARAMS.t4;
    if (/2\s*t|小型/i.test(s)) return COST_PARAMS.t2;
    return null;
  }

  // 1区間の原価積み上げ（calcFare と同係数）。
  function estimateLegCost(distanceKm, params, hours) {
    var p = params || COST_PARAMS.t2;
    var dist = Math.max(0, distanceKm || 0);
    var h = hours != null ? hours : Math.max(1, (dist / DEFAULT_PARAMS.AVG_SPEED_KMH) + DEFAULT_PARAMS.LOAD_UNLOAD_H);
    var fuel = Math.round(dist / p.fuelKm * p.fuelCost);
    var highway = Math.round(dist * p.highwayPer100 / 100);
    var driver = Math.round(h * p.driverHourly);
    var depreciation = Math.round(p.depreciationDay * Math.max(1, dist / 200));
    var overhead = Math.round((fuel + highway + driver + depreciation) * 0.15);
    var total = fuel + highway + driver + depreciation + overhead;
    return { fuel: fuel, highway: highway, driver: driver, depreciation: depreciation, overhead: overhead, total: total };
  }

  function capToKg(cap) {
    if (typeof cap === 'number') return cap;
    var s = String(cap == null ? '' : cap);
    var kg = s.match(/([\d,]+)\s*kg/i);
    if (kg) return parseInt(kg[1].replace(/,/g, ''), 10);
    var t = s.match(/([\d.]+)\s*t(?![a-z])/i);
    if (t) return Math.round(parseFloat(t[1]) * 1000);
    return 0;
  }

  /* ───────────────────────── ① AI自社車両推薦 ─────────────────────────────── */
  // ctx: { requiredKg, neededCount, distanceKm, candidates:[{id,driver,capKg|cap,score,available,complianceOk}] }
  // 戻り: { ranked, selected, coveredKg, satisfied, remainingKg, remainingCount }
  function recommendOwnFleet(ctx) {
    ctx = ctx || {};
    var requiredKg = ctx.requiredKg || 0;
    var neededCount = ctx.neededCount || 1;
    var ranked = (ctx.candidates || []).map(function (v, i) {
      return {
        id: v.id, driver: v.driver,
        capKg: v.capKg != null ? v.capKg : capToKg(v.cap),
        score: v.score != null ? v.score : 0,
        available: v.available != null ? v.available : (v.avail ? /空車|可/.test(String(v.avail)) : true),
        complianceOk: v.complianceOk != null ? v.complianceOk : true,
        _order: i
      };
    }).sort(function (a, b) {
      // スコア降順 → 積載大きい順（同点時は積載で寄せる）
      if (b.score !== a.score) return b.score - a.score;
      return b.capKg - a.capKg;
    });

    var selected = [], covered = 0;
    for (var i = 0; i < ranked.length; i++) {
      var v = ranked[i];
      if (!v.available) continue;
      selected.push(v);
      covered += v.capKg;
      // 積載を満たし、かつ必要台数に達したら終了
      if (covered >= requiredKg && selected.length >= neededCount) break;
    }
    var satisfied = covered >= requiredKg && selected.length >= 1;
    return {
      ranked: ranked,
      selected: selected,
      coveredKg: covered,
      satisfied: satisfied,
      remainingKg: Math.max(0, requiredKg - covered),
      remainingCount: Math.max(0, neededCount - selected.length)
    };
  }

  /* ───────────────────────── ② AI協力会社推薦 ─────────────────────────────── */
  // ctx: { remainingKg, remainingCount, requiredVehicleType, originPrefecture, distanceKm,
  //        partners:[{id,name,area,vehicleTypes,cases,available,perKm,baseCharge,performance}] }
  function recommendPartners(ctx) {
    ctx = ctx || {};
    var distanceKm = ctx.distanceKm || 0;
    var reqType = ctx.requiredVehicleType || '';
    var origin = String(ctx.originPrefecture || '');
    var ranked = (ctx.partners || []).map(function (p) {
      var types = p.vehicleTypes || [];
      var typeMatch = reqType ? types.some(function (t) { return String(t).indexOf(reqType) >= 0 || reqType.indexOf(String(t)) >= 0; }) : true;
      // エリア近接（同一県名の先頭一致をプロキシに）
      var areaNear = origin && p.area ? (String(p.area).slice(0, 3) === origin.slice(0, 3)) : false;
      var usage = (p.cases || []).length;          // 過去依頼数（信頼性プロキシ）
      var available = p.available != null ? p.available : true;
      // 傭車見積：協力会社の原価×マークアップ（rates が無い場合の決定的推定）
      var charge;
      if (p.baseCharge != null) charge = p.baseCharge + (p.perKm || 0) * distanceKm;
      else {
        var pr = paramsForLabel(reqType) || paramsForLabel((types[0] || '')) || COST_PARAMS.t4;
        charge = round1000(estimateLegCost(distanceKm, pr).total * DEFAULT_PARAMS.PARTNER_MARKUP);
      }
      // 適合スコア 0-100：車格適合40 + エリア20 + 実績20 + 空き20
      var score = (typeMatch ? 40 : 0) + (areaNear ? 20 : 0)
        + Math.min(20, usage * 5) + (available ? 20 : 0);
      // 品質スコアがあれば反映（performance.qualityScore 0-100 を ±10 補正）
      if (p.performance && typeof p.performance.qualityScore === 'number') {
        score = Math.round(score * 0.8 + p.performance.qualityScore * 0.2);
      }
      return {
        id: p.id, name: p.name, area: p.area, vehicleTypes: types,
        typeMatch: typeMatch, areaNear: areaNear, usage: usage,
        available: available, charge: charge, score: Math.min(100, score)
      };
    }).filter(function (p) { return p.available; })
      .sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return a.charge - b.charge;       // 同点は安い順
      });

    var need = Math.max(ctx.remainingCount || 0, ctx.remainingKg > 0 ? 1 : 0);
    var selected = ranked.slice(0, need);
    return { ranked: ranked, selected: selected };
  }

  /* ───────────────────────── ③ AI運賃推薦 ─────────────────────────────────── */
  // ctx: { sales?, ownLegs:[{capKg,distanceKm}], partnerLegs:[{charge}], distanceKm, config }
  function recommendFare(ctx) {
    ctx = ctx || {};
    var ownLegs = ctx.ownLegs || [];
    var partnerLegs = ctx.partnerLegs || [];
    var cfg = assign({}, DEFAULT_PARAMS, ctx.config || {});

    var ownBreakdown = ownLegs.map(function (l) {
      return estimateLegCost(l.distanceKm != null ? l.distanceKm : ctx.distanceKm, paramsForCapKg(l.capKg));
    });
    var ownCost = ownBreakdown.reduce(function (s, b) { return s + b.total; }, 0);
    var partnerCharge = partnerLegs.reduce(function (s, l) { return s + (l.charge || 0); }, 0);

    // 受注額：指定が無ければ「単一車前提の市場推奨運賃」を原価×目標粗利で推定。
    var sales = ctx.sales;
    if (sales == null) {
      var single = estimateLegCost(ctx.distanceKm, paramsForCapKg(
        ownLegs.concat(partnerLegs).reduce(function (m, l) { return Math.max(m, l.capKg || 0); }, 4000)));
      sales = round1000(single.total * cfg.TARGET_MARGIN);
    }
    var grossProfit = sales - ownCost - partnerCharge;
    var marginPct = sales > 0 ? Math.round(grossProfit / sales * 100) : 0;
    var status = marginPct >= cfg.MARGIN_OK_PCT ? 'ok' : (marginPct >= cfg.MARGIN_WARN_PCT ? 'warn' : 'ng');
    return {
      sales: sales, ownCost: ownCost, partnerCharge: partnerCharge,
      grossProfit: grossProfit, marginPct: marginPct, status: status,
      ownBreakdown: ownBreakdown
    };
  }

  /* ───────────────────────── ④ 増車プラン合成 ─────────────────────────────── */
  // order: 案件, verdict: LogipokeScaleOut の判定結果, resources: { candidates, partners, sales }
  function composeScaleOutPlan(order, verdict, resources, config) {
    order = order || {}; verdict = verdict || {}; resources = resources || {};
    var cfg = assign({}, DEFAULT_PARAMS, config || {});
    var d = verdict.deficit || {};
    var requiredKg = (order.cargo && order.cargo.weightKg) || order.weightKg || resources.requiredKg || 0;
    var neededCount = d.vehicles || 1;
    var distanceKm = resources.distanceKm || order.distanceKm || 0;
    var reqType = resources.requiredVehicleType
      || (order.aiResult && order.aiResult.vehicle) || order.vehicle || '4tウィング';

    var own = recommendOwnFleet({
      requiredKg: requiredKg, neededCount: neededCount, distanceKm: distanceKm,
      candidates: resources.candidates || []
    });

    var partnersSel = [];
    if (!own.satisfied && (own.remainingKg > 0 || own.remainingCount > 0)) {
      var rp = recommendPartners({
        remainingKg: own.remainingKg, remainingCount: Math.max(own.remainingCount, own.remainingKg > 0 ? 1 : 0),
        requiredVehicleType: reqType, originPrefecture: (order.origin && order.origin.prefecture) || order.from,
        distanceKm: distanceKm, partners: resources.partners || []
      });
      partnersSel = rp.selected;
    }

    // 区間（便）を組み立て：自社①②… → 協力会社③…
    var legs = [];
    own.selected.forEach(function (v) {
      legs.push({ seq: legs.length + 1, kind: 'own', id: v.id, driver: v.driver, capKg: v.capKg, score: v.score, distanceKm: distanceKm });
    });
    partnersSel.forEach(function (p) {
      legs.push({ seq: legs.length + 1, kind: 'partner', id: p.id, name: p.name, score: p.score, charge: p.charge, distanceKm: distanceKm });
    });

    var fare = recommendFare({
      sales: resources.sales, distanceKm: distanceKm,
      ownLegs: legs.filter(function (l) { return l.kind === 'own'; }),
      partnerLegs: legs.filter(function (l) { return l.kind === 'partner'; }),
      config: cfg
    });

    var coveredKg = own.coveredKg + partnersSel.length * (paramsForLabel(reqType) || COST_PARAMS.t4).maxLoadKg;
    return {
      shape: verdict.shapeHint || 'parallel',
      legs: legs,
      ownCount: own.selected.length,
      partnerCount: partnersSel.length,
      satisfied: coveredKg >= requiredKg && legs.length > 0,
      fare: fare,
      ownDetail: own,
      partnerCandidates: (resources.partners ? recommendPartners({
        remainingKg: own.remainingKg, requiredVehicleType: reqType,
        originPrefecture: (order.origin && order.origin.prefecture) || order.from,
        distanceKm: distanceKm, partners: resources.partners
      }).ranked : [])
    };
  }

  function assign(t) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i]; if (!s) continue;
      for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k];
    }
    return t;
  }

  /* ───────────────────────── 公開API ─────────────────────────────────────── */
  return {
    COST_PARAMS: COST_PARAMS,
    DEFAULT_PARAMS: DEFAULT_PARAMS,
    estimateLegCost: estimateLegCost,
    paramsForCapKg: paramsForCapKg,
    paramsForLabel: paramsForLabel,
    capToKg: capToKg,
    recommendOwnFleet: recommendOwnFleet,
    recommendPartners: recommendPartners,
    recommendFare: recommendFare,
    composeScaleOutPlan: composeScaleOutPlan
  };
});
