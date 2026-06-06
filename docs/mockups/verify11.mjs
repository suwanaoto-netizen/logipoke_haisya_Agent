import { chromium } from 'playwright';
const F = 'file:///home/user/logipoke_haisya_Agent/index.html';
const errs = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 880 } });
page.on('pageerror', e => errs.push(e.message));
await page.goto(F, { waitUntil: 'load' });
await page.waitForTimeout(900);

const c = await page.evaluate(() => {
  const api = (typeof window.vehicleMasterUpsert === 'function' && typeof window.vehicleMasterRemove === 'function' && typeof window.vehicleMasterSetDriver === 'function');
  const n0 = window.vehicleMasterData.length;
  // 追加（正規フリート外 id=9999 → _canonicalVehicleId は null、legacyIds は付与）
  window.vehicleMasterUpsert({ id: '9999', plate: 'テスト 800 あ 9999', type: '2tトラック', cap: 1000, base: '川口拠点', driverName: '山田 一郎' });
  const added = window.vehicleMasterData[window.vehicleMasterData.length - 1];
  // 更新（idx0 = id'1245' → _canonicalVehicleId 'V1245'）
  window.vehicleMasterUpsert({ id: '1245', plate: '品川 800 あ 1245', type: '4tウィング', driverName: '山田 一郎' }, 0);
  const updCanonical = window.vehicleMasterData[0]._canonicalVehicleId;
  // 担当変更
  window.vehicleMasterSetDriver(0, '鈴木 次郎');
  const drv = window.vehicleMasterData[0].driverName;
  // 削除（末尾の追加分）
  const before = window.vehicleMasterData.length;
  window.vehicleMasterRemove(window.vehicleMasterData.length - 1);
  const removed = before - window.vehicleMasterData.length;
  return { api, n0, addedCanonical: added._canonicalVehicleId, addedLegacy: added.legacyIds, updCanonical, drv, removed };
});
console.log('(c) 単一窓口API:', JSON.stringify(c));

// 回帰：配車盤が描画されるか
await page.evaluate(() => { try { document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); document.getElementById('page-dispatch').classList.add('active'); switchDispatchSubtab('dnd'); } catch (e) {} });
await page.waitForTimeout(400);
const reg = await page.evaluate(() => ({ dndRows: document.querySelectorAll('#dnd-timeline .dnd-row').length, basesViaSSoT: window.__logipokeBasesViaSSoT }));
console.log('回帰:', JSON.stringify(reg));
console.log('=== JS ERRORS:', errs.length, '==='); errs.slice(0, 20).forEach(e => console.log('  ', e));
await browser.close();
console.log('DONE');
