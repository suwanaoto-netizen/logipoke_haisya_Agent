#!/usr/bin/env node
// 検証: 案件 status 統一（課題C7・第2段）の「描画切替パリティ」。
//   index.html の DnD配車盤 reader 3箇所を、生 status 比較から正準相アクセサ
//   (_orderStatusCanon / _orderStatusClass = LogipokeDB.normalizeOrderStatus 経由) へ
//   切替えた。本検証は「切替後の式」が「旧式」と全 status 値で 1:1 一致する（＝挙動不変）こと、
//   および LogipokeDB 非ロード時にフォールバックで旧挙動へ縮退することを保証する。
//   node migration/verify_c7_render.mjs
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DB = require(resolve(ROOT, 'assets/logipoke-data-model.js'));

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log('  ✅ ' + name); pass++; }
  catch (e) { console.log('  ❌ ' + name + '\n     ' + e.message); fail++; }
}

// index.html のアクセサと同一実装（LogipokeDB あり / なし を切替えて両経路を検証）。
function makeAccessors(LIB) {
  const canon = (c) => {
    try { if (LIB && LIB.normalizeOrderStatus) return LIB.normalizeOrderStatus(c).status; } catch (e) {}
    return c && c.status;
  };
  const cls = (c) => {
    try { if (LIB && LIB.orderStatusClass) return LIB.orderStatusClass(canon(c)); } catch (e) {}
    return c && c.status;
  };
  return { canon, cls };
}

// 旧式（置換前）
const legacy = {
  filterPending: (c) => !(c.status !== 'unprocessed' && c.status !== 'processing'),    // true=残す
  filterSpecific: (c, f) => !(c.status !== f),
  label: (c, processed) => processed ? '処理済み' : (c.status === 'unprocessed' ? '未処理' : '処理中'),
  cls: (c, processed) => processed ? 'processed' : c.status
};
// 新式（置換後）
function makeNext({ canon, cls }) {
  return {
    filterPending: (c) => { const ns = canon(c); return !(ns !== 'unprocessed' && ns !== 'processing'); },
    filterSpecific: (c, f) => { const ns = canon(c); return !(ns !== f); },
    label: (c, processed) => processed ? '処理済み' : (canon(c) === 'unprocessed' ? '未処理' : '処理中'),
    cls: (c, processed) => processed ? 'processed' : cls(c)
  };
}

// dndUnassignedCases が実際に取りうる status 値（英語正準語彙）。
const REACHABLE = ['unprocessed', 'processing', 'processed'];

console.log('\n案件 status 統一（課題C7・第2段：DnD reader 描画切替パリティ）\n');

check('LogipokeDB が正準API（normalizeOrderStatus / orderStatusClass）を公開', () => {
  assert.equal(typeof DB.normalizeOrderStatus, 'function');
  assert.equal(typeof DB.orderStatusClass, 'function');
});

check('フィルタ pending：到達 status 全てで旧式==新式（LogipokeDBあり）', () => {
  const next = makeNext(makeAccessors(DB));
  REACHABLE.forEach(s => {
    const c = { id: 'x', status: s };
    assert.equal(next.filterPending(c), legacy.filterPending(c), s);
  });
});

check('フィルタ specific（all以外＝processed絞り込み）：旧式==新式', () => {
  const next = makeNext(makeAccessors(DB));
  REACHABLE.forEach(s => {
    const c = { id: 'x', status: s };
    assert.equal(next.filterSpecific(c, 'processed'), legacy.filterSpecific(c, 'processed'), s);
    assert.equal(next.filterSpecific(c, 'unprocessed'), legacy.filterSpecific(c, 'unprocessed'), s);
  });
});

check('statusLabel：processed有無 × 到達 status で旧式==新式', () => {
  const next = makeNext(makeAccessors(DB));
  [true, false].forEach(processed => REACHABLE.forEach(s => {
    const c = { id: 'x', status: s };
    assert.equal(next.label(c, processed), legacy.label(c, processed), s + '/' + processed);
  }));
});

check('statusClass：processed有無 × 到達 status で旧式==新式（CSSクラス不変）', () => {
  const next = makeNext(makeAccessors(DB));
  [true, false].forEach(processed => REACHABLE.forEach(s => {
    const c = { id: 'x', status: s };
    assert.equal(next.cls(c, processed), legacy.cls(c, processed), s + '/' + processed);
  }));
});

check('フォールバック：LogipokeDB 非ロード時は新式==旧式（素の status へ縮退）', () => {
  const next = makeNext(makeAccessors(null));   // LIB なし
  REACHABLE.forEach(s => {
    const c = { id: 'x', status: s };
    assert.equal(next.filterPending(c), legacy.filterPending(c), s);
    assert.equal(next.filterSpecific(c, 'processed'), legacy.filterSpecific(c, 'processed'), s);
    [true, false].forEach(p => {
      assert.equal(next.label(c, p), legacy.label(c, p), s);
      assert.equal(next.cls(c, p), legacy.cls(c, p), s);
    });
  });
});

console.log('\n' + (fail === 0
  ? '✅ 全 ' + pass + ' 件パス'
  : '❌ ' + fail + ' 件失敗 / ' + (pass + fail) + ' 件中') + '\n');
process.exit(fail === 0 ? 0 : 1);
