import { chromium } from 'playwright';
const F = 'file:///home/user/logipoke_haisya_Agent/index.html';
const errs = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 880 } });
page.on('pageerror', e => errs.push(e.message));
await page.goto(F, { waitUntil: 'load' });
await page.waitForTimeout(900);
// 盤面を一度描画して dndAssignments を確実に有効化
await page.evaluate(() => { try { document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); document.getElementById('page-dispatch').classList.add('active'); switchDispatchSubtab('dnd'); } catch (e) {} });
await page.waitForTimeout(500);

const r = await page.evaluate(() => {
  // #1 案件解決
  const someUnprocessed = (typeof unprocessedCases !== 'undefined' && unprocessedCases[0]) ? unprocessedCases[0].id : null;
  const c1 = {
    apiResolveCase: typeof window.resolveCase === 'function',
    resolveDashCase: window.resolveCase ? (window.resolveCase('D-001') || {}).phase : 'NG',
    resolveUnprocessed: (someUnprocessed && window.resolveCase) ? (window.resolveCase(someUnprocessed) || {}).phase : 'n/a',
    resolveBogus: window.resolveCase ? window.resolveCase('NOPE-XYZ') : 'NG',
    indexSize: window.caseIndexAll ? Object.keys(window.caseIndexAll()).length : -1,
  };
  // #2 運行層SSoT投影：現在日付の dndAssignments から caseId を1つ拾って復元
  const dk = (typeof dndGetCurrentDateKey === 'function') ? dndGetCurrentDateKey() : null;
  let pickCase = null;
  if (typeof dndAssignments !== 'undefined') {
    for (const drvId of Object.keys(dndAssignments)) {
      const blocks = (dndAssignments[drvId] && dndAssignments[drvId][dk]) || [];
      const b = blocks.find(x => x && x.caseId != null);
      if (b) { pickCase = b.caseId; break; }
    }
  }
  const db = window.buildOperationSSoT ? window.buildOperationSSoT(dk) : null;
  const tl = (pickCase && window.deriveCaseTimelineLive) ? window.deriveCaseTimelineLive(pickCase) : [];
  const c2 = {
    apiBuild: typeof window.buildOperationSSoT === 'function',
    tripCount: db ? db.trips.size : -1,
    legCount: db ? db.legs.size : -1,
    pickCase, timelineLen: tl.length, firstDriver: tl[0] ? tl[0].driverName : null,
  };
  // #3 ドライバーマスタ単一窓口
  const before = window.driverMasterData.length;
  window.driverMasterUpsert({ id: 'DRV-TEST', name: '検証 ドライバー', vehicleId: '1245', base: '品川区' });
  const added = window.driverMasterData[window.driverMasterData.length - 1];
  window.driverMasterUpsert({ stars: 5 }, 0); // 既存(0)をマージ更新
  const mergedKeepsName = !!window.driverMasterData[0].name && window.driverMasterData[0].stars === 5;
  const lenBeforeRemove = window.driverMasterData.length;
  window.driverMasterRemove(window.driverMasterData.length - 1);
  const c3 = {
    api: typeof window.driverMasterUpsert === 'function' && typeof window.driverMasterRemove === 'function',
    addedCanonical: added._canonicalVehicleId, // '1245' → 'V1245'
    mergedKeepsName,
    removed: lenBeforeRemove - window.driverMasterData.length,
  };
  return { c1, c2, c3, dndRows: document.querySelectorAll('#dnd-timeline .dnd-row').length };
});
console.log('#1 案件解決:', JSON.stringify(r.c1));
console.log('#2 運行層SSoT投影:', JSON.stringify(r.c2));
console.log('#3 ドライバー単一窓口:', JSON.stringify(r.c3));
console.log('回帰 dndRows:', r.dndRows, '/ JS ERRORS:', errs.length);
errs.slice(0, 20).forEach(e => console.log('  ', e));
await browser.close();
console.log('DONE');
