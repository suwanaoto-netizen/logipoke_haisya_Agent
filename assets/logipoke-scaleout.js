/* ============================================================================
 *  Logipoke 配車Agent ― 増車（scale-out）判定エンジン
 * ----------------------------------------------------------------------------
 *  設計: docs/scale-out-judgement.md
 *  「どの案件を増車に回すべきか」を判定し、UIボタンの状態(verdict)を返す純ロジック。
 *
 *  方針（仕様書 §2）:
 *    - 可能性(決定的) と 最適性(AIスコア) を分離。可能性を優先。
 *    - ハード判定は不足量(deficit)を返す。LLMには委ねない（本モジュールは決定的）。
 *    - 抑制ガード（情報不足/手配困難/採算下限）を先行評価し、誤手配・過検知を防ぐ。
 *
 *  外部依存（距離/積載/法令/空き/採算）は deps で注入。未注入時は order から最善推定。
 *  これにより index.html 無しに Node 単体テスト可能（migration/verify_scaleout.mjs）。
 *
 *  ブラウザでは window.LogipokeScaleOut、Node では module.exports で利用可能。
 * ========================================================================== */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;   // Node
  if (root) root.LogipokeScaleOut = mod;                                       // Browser
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  /* ───────────────────────── 既定しきい値（設定画面と連動・仕様書 §11） ───── */
  var DEFAULT_CONFIG = {
    SCALEOUT_THRESHOLD: 70,   // ソフト推奨を出す増車推奨度の下限
    LOAD_RATE_TIGHT:    0.95, // 「余裕薄」と見なす積載率
    DEADLINE_MARGIN_MIN: 30,  // 「余裕薄」と見なす納期マージン（分）
    PROFIT_FLOOR_PCT:   10,   // 採算下限（％・G3）
    weights: { tight: 30, law: 20, profit: 25, customer: 15, pattern: 10 } // ソフト判定の重み
  };

  // verdict → UI表示ラベル（PR2以降の画面が参照）。色はグリーン基調（docs §9.2）。
  var VERDICT_LABELS = {
    required:    { label: '増車必要',  tone: 'required'  }, // オレンジ（要対応）
    recommended: { label: 'AIで増車プランを見る', tone: 'recommended' }, // グリーン
    negotiate:   { label: '要交渉',    tone: 'negotiate' }, // アンバー
    review:      { label: '要確認',    tone: 'review'    }, // グレー
    none:        { label: '',          tone: 'none'      }
  };

  /* ───────────────────────── 軽量パーサ（LogipokeDB と同挙動） ───────────── */

  // "パレット / 6,800kg / 常温" → 数値kg（不明は 0）。"6.8t" 等も解釈。
  function parseWeightKg(goods) {
    var s = String(goods == null ? '' : goods);
    var kg = s.match(/([\d,]+(?:\.\d+)?)\s*kg/i);
    if (kg) return Math.round(parseFloat(kg[1].replace(/,/g, '')));
    var t = s.match(/([\d,]+(?:\.\d+)?)\s*(?:t|ton|トン|ｔ)\b/i);
    if (t) return Math.round(parseFloat(t[1].replace(/,/g, '')) * 1000);
    return 0; // 不明
  }

  function parseTempZones(goods) {
    var s = String(goods == null ? '' : goods);
    var zones = [];
    if (/冷凍/.test(s)) zones.push('frozen');
    if (/冷蔵/.test(s)) zones.push('chilled');
    if (/常温/.test(s)) zones.push('ambient');
    return zones;
  }

  function isStrictDeadline(deadline) {
    return /指定|厳守/.test(String(deadline == null ? '' : deadline));
  }

  // 車格ラベル → 最大積載kg。"(\d+)t" / "([\d,]+)kg" を優先、無ければキーワード表。
  var CAP_KEYWORDS = [
    [/軽/, 350], [/トレーラ|trailer/i, 25000], [/大型/, 10000],
    [/10\s*t/i, 10000], [/6\s*t/i, 6000], [/4\s*t/i, 4000], [/3\s*t/i, 3000],
    [/2\s*t/i, 2000], [/中型/, 4000], [/小型/, 2000], [/冷凍|冷蔵|リーファー/, 2000]
  ];
  function capLabelToKg(label) {
    var s = String(label == null ? '' : label);
    var kg = s.match(/([\d,]+)\s*kg/i);
    if (kg) return parseInt(kg[1].replace(/,/g, ''), 10);
    var t = s.match(/([\d.]+)\s*t(?![a-z])/i);
    if (t) return Math.round(parseFloat(t[1]) * 1000);
    for (var i = 0; i < CAP_KEYWORDS.length; i++) if (CAP_KEYWORDS[i][0].test(s)) return CAP_KEYWORDS[i][1];
    return null;
  }

  /* ───────────────────────── 入力の解決（deps 優先 → order 推定） ───────── */

  // 最適1台の最大積載kg：候補車両の最大 cap、無ければ割当車格、無ければ既定4000。
  function resolveMaxSingleLoadKg(order, deps) {
    if (deps.maxSingleLoadKg) { var d = deps.maxSingleLoadKg(order); if (d) return d; }
    var caps = [];
    if (order.vehicles && order.vehicles.length) {
      order.vehicles.forEach(function (v) {
        var c = capLabelToKg(v.cap || v.capLabel || v.vehicleType || v.maxLoadKg);
        if (c) caps.push(c);
      });
    }
    if (caps.length) return Math.max.apply(null, caps);
    var byLabel = capLabelToKg(order.vehicle || order.vehicleType || order.aiVehicle);
    return byLabel || 4000;
  }

  function resolveRequiredWeightKg(order) {
    if (order.cargo && typeof order.cargo.weightKg === 'number') return order.cargo.weightKg;
    if (typeof order.weightKg === 'number') return order.weightKg;
    return parseWeightKg(order.goods);
  }

  function resolveConfidence(order) {
    return (order.aiResult && order.aiResult.confidence) || order.aiConfidence || 'high';
  }

  // 単独運行の法令適合: deps 優先、無ければ候補1位の law.status から推定。
  function resolveComplianceSingle(order, deps) {
    if (deps.complianceSingle) return deps.complianceSingle(order);
    var st = order.vehicles && order.vehicles[0] && order.vehicles[0].law && order.vehicles[0].law.status;
    if (st === 'ng' || st === 'violation') return 'violation';
    if (st === 'warn') return 'warn';
    return 'ok';
  }

  /* ───────────────────────── ソフト判定スコア（仕様書 §7） ───────────────── */
  function scaleOutScore(order, ctx) {
    var w = ctx.config.weights, lr = ctx.loadRate;
    var tight = lr >= 0.95 ? 100 : lr >= 0.90 ? 75 : lr >= 0.85 ? 45 : Math.max(0, (lr - 0.6) * 100);
    var law = ctx.compliance === 'violation' ? 100 : ctx.compliance === 'warn' ? 70 : 0;
    var improve = ctx.deps.profitImprovePct ? ctx.deps.profitImprovePct(order) : 0; // 増車での粗利率改善ポイント
    var profit = clamp(improve * 10, 0, 100); // +10pt改善 → 100
    var customer = order.priority === '緊急' || order.priority === 'urgent' ? 100 : (order.important ? 70 : 30);
    var pat = String(order.casePattern || order.pattern || '');
    var pattern = /緊急/.test(pat) ? 90 : /多地点/.test(pat) ? 80 : /スポット/.test(pat) ? 40 : /定期/.test(pat) ? 30 : 50;
    var denom = w.tight + w.law + w.profit + w.customer + w.pattern;
    return Math.round((tight * w.tight + law * w.law + profit * w.profit + customer * w.customer + pattern * w.pattern) / denom);
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function uniq(arr) { return arr.filter(function (x, i) { return arr.indexOf(x) === i; }); }

  function pickShape(reasons) {
    for (var i = 0; i < reasons.length; i++) {
      if (reasons[i].type === 'compliance' || reasons[i].type === 'time_window') return 'relay';
    }
    return 'parallel';
  }

  function aggregateDeficit(reasons, reqKg, maxKg) {
    var d = {};
    var needs = reasons.map(function (r) { return r.need || 0; });
    var need = needs.length ? Math.max.apply(null, needs) : 0;
    if (need) d.vehicles = need;
    var ov = reasons.filter(function (r) { return r.type === 'overload'; })[0];
    if (ov && maxKg) d.weightKg = reqKg - maxKg;
    var tw = reasons.filter(function (r) { return r.type === 'time_window'; })[0];
    if (tw && tw.minutes) d.minutes = tw.minutes;
    return d;
  }

  function mk(verdict, reasons) { return { verdict: verdict, reasons: reasons || [] }; }

  /* ───────────────────────── 本体 evaluateScaleOut（仕様書 §10） ─────────── */
  function evaluateScaleOut(order, deps, config) {
    order = order || {};
    deps = deps || {};
    config = assign({}, DEFAULT_CONFIG, config || {});
    if (config.weights) config.weights = assign({}, DEFAULT_CONFIG.weights, config.weights);

    var reqKg = resolveRequiredWeightKg(order);
    var maxKg = resolveMaxSingleLoadKg(order, deps);
    var conf  = resolveConfidence(order);
    var strict = order.timeStrict != null ? !!order.timeStrict : isStrictDeadline(order.deadline);

    // ── G1 review（情報不足は必須化しない・誤手配防止） ──
    // conf は 'low' / '低' / '低信頼度' 等を低信頼度として扱う（日英・和表記対応）。
    if (/low|低/i.test(String(conf)) || !reqKg || reqKg <= 0) {
      return mk('review', [{ type: 'info', detail: '荷量/時間が不明（信頼度low）' }]);
    }

    // ── Layer1 ハード判定（不足量を返す） ──
    var reasons = [];
    if (maxKg && reqKg > maxKg) {
      reasons.push({ type: 'overload', detail: '不足 ' + (reqKg - maxKg) + 'kg', need: Math.ceil(reqKg / maxKg) });
    }
    var volM3 = order.cargo && order.cargo.volumeM3;
    var maxVol = deps.maxSingleVolumeM3 && deps.maxSingleVolumeM3(order);
    if (volM3 && maxVol && volM3 > maxVol) {
      reasons.push({ type: 'volume', need: Math.ceil(volM3 / maxVol) });
    }
    var tDef = deps.timeDeficitMin ? deps.timeDeficitMin(order) : 0;
    if (strict && tDef > 0) {
      reasons.push({ type: 'time_window', detail: tDef + '分超過', minutes: tDef });
    }
    if (resolveComplianceSingle(order, deps) === 'violation') {
      reasons.push({ type: 'compliance', shape: 'relay' });
    }
    var origins = order.origins;
    if (Array.isArray(origins) && origins.length > 1 && order.simultaneousPickup) {
      reasons.push({ type: 'geo', need: origins.length });
    }
    var zones = order.tempZones || parseTempZones(order.goods);
    if (Array.isArray(zones) && uniq(zones).length > 1) {
      reasons.push({ type: 'mixload', need: uniq(zones).length });
    }

    if (reasons.length) {
      // ── G2 negotiate（増車必須だが手配先0） ──
      var feasible = deps.feasible ? deps.feasible(order, reasons) : true;
      if (!feasible) return mk('negotiate', reasons);
      var out = mk('required', reasons);
      out.deficit = aggregateDeficit(reasons, reqKg, maxKg);
      out.shapeHint = pickShape(reasons);
      return out;
    }

    // ── Layer2 ソフト判定（推奨） ──
    var comp = resolveComplianceSingle(order, deps);
    var loadRate = maxKg ? reqKg / maxKg : 0;
    var dMargin = deps.deadlineMarginMin ? deps.deadlineMarginMin(order) : null;
    var deadlineTight = (dMargin != null) && (dMargin < config.DEADLINE_MARGIN_MIN);
    var score = scaleOutScore(order, { loadRate: loadRate, compliance: comp, deps: deps, config: config });

    var profitPct = deps.profitPctIfScaledOut ? deps.profitPctIfScaledOut(order) : null;
    var profitGuardOk = (profitPct == null) ? true : (profitPct >= config.PROFIT_FLOOR_PCT);
    var tightTrigger = (loadRate >= config.LOAD_RATE_TIGHT) || deadlineTight;

    if ((score >= config.SCALEOUT_THRESHOLD || tightTrigger) && profitGuardOk) {
      var rec = mk('recommended', []);
      rec.score = score;
      rec.shapeHint = pickShape([]);
      return rec;
    }
    var none = mk('none', []);
    none.score = score;
    return none;
  }

  function assign(t) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i]; if (!s) continue;
      for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k];
    }
    return t;
  }

  // verdict が「増車要件数」に含まれるか（サマリーの ⊕増車要N件 集計用）
  function countsAsScaleOut(verdict) {
    return verdict === 'required' || verdict === 'recommended';
  }

  /* ───────────────────────── 公開API ─────────────────────────────────────── */
  return {
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    VERDICT_LABELS: VERDICT_LABELS,
    evaluateScaleOut: evaluateScaleOut,
    countsAsScaleOut: countsAsScaleOut,
    // helpers（再利用・テスト用）
    parseWeightKg: parseWeightKg,
    capLabelToKg: capLabelToKg,
    parseTempZones: parseTempZones,
    isStrictDeadline: isStrictDeadline,
    scaleOutScore: scaleOutScore
  };
});
