/* ============================================================================
 *  Logipoke 新デザイン ⇄ 7層データモデル ブリッジ
 * ----------------------------------------------------------------------------
 *  新 index.html（React standalone デザイン）は全データを window.LP_DATA から読む。
 *  本ブリッジは:
 *    ① AI電話受付（Reception / assets/logipoke-data-model.js）→ デザインの case 形へ変換
 *    ② window.LP_DATA への代入を横取りし、AI受付案件を initialCases の先頭に前置
 *       （= デザイン側を一切編集せずに「実データ接続」を実現）
 *    ③ React 側のライブ更新用に window.LogipokeDesign.getAiCases() を公開
 *
 *  依存: window.LogipokeDB（先に読み込むこと）。クラシック script のため
 *        ページ <head> で同期読込され、グローバルは document 置換後も window に残る。
 * ========================================================================== */
(function (global) {
  'use strict';
  if (!global.LogipokeDB) { console.warn('[design-bridge] LogipokeDB 未ロード（先に logipoke-data-model.js を読み込んでください）'); }

  function tempJP(z) { return z === 'frozen' ? '冷凍' : (z === 'chilled' ? '冷蔵' : '常温'); }
  function hhmm(iso) { if (!iso) return null; var m = String(iso).match(/T(\d{2}:\d{2})/); return m ? m[1] : null; }

  // Reception(+AiExtraction) → デザインの case 形
  // { id, shipper, status, origin, destination, item, weight, temp, timeStart, duration, deadline, urgent, assignee }
  function receptionToDesignCase(r) {
    var ai = (r && r.aiExtraction) || {};
    var cargo = ai.cargo || {}, tw = ai.timeWindow || {};
    return {
      id: r.id,
      shipper: ai.clientName || '—',
      status: '未処理',
      origin: (ai.origin && ai.origin.raw) || '',
      destination: (ai.destination && ai.destination.raw) || '',
      item: cargo.description || '—',
      weight: cargo.weightKg || 0,
      temp: tempJP(cargo.tempZone),
      timeStart: hhmm(tw.latest) || '09:00',
      duration: 4,
      deadline: tw.label || '',
      urgent: !!tw.strict,
      assignee: '未割当',
      sourceTag: 'AI電話受付'
    };
  }

  // localStorage 上の正規化 Reception を全件 → デザイン case 配列
  function getAiCases() {
    if (!global.LogipokeDB) return [];
    try { return global.LogipokeDB.loadReceptions().map(receptionToDesignCase); }
    catch (e) { return []; }
  }

  // 既存 initialCases に AI受付案件を前置（重複IDは除外）
  function mergeAiCases(initialCases) {
    var ai = getAiCases();
    if (!ai.length) return initialCases;
    var seen = {}; (initialCases || []).forEach(function (c) { seen[c.id] = 1; });
    var add = ai.filter(function (c) { return !seen[c.id]; });
    return add.length ? add.concat(initialCases) : initialCases;
  }

  // window.LP_DATA への代入を横取りして AI受付案件をマージ（デザイン無編集で実データ接続）
  var _lp;
  try {
    Object.defineProperty(global, 'LP_DATA', {
      configurable: true,
      get: function () { return _lp; },
      set: function (v) {
        try {
          if (v && Array.isArray(v.initialCases)) {
            v = Object.assign({}, v, { initialCases: mergeAiCases(v.initialCases) });
          }
        } catch (e) { console.warn('[design-bridge] LP_DATA マージ失敗', e); }
        _lp = v;
      }
    });
  } catch (e) { console.warn('[design-bridge] LP_DATA インターセプト失敗', e); }

  global.LogipokeDesign = {
    receptionToDesignCase: receptionToDesignCase,
    getAiCases: getAiCases,
    mergeAiCases: mergeAiCases
  };
})(typeof window !== 'undefined' ? window : globalThis);
