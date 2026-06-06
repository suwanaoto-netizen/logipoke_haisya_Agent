import { chromium } from 'playwright';
const F = 'file:///home/user/logipoke_haisya_Agent/index.html';
const errs = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 880 } });
page.on('pageerror', e => errs.push(e.message));
await page.goto(F, { waitUntil: 'load' });
await page.waitForTimeout(900);

const expectedBases = [
  { id:'B001', name:'川口拠点', region:'関東', aliases:['川口市','川口','埼玉県川口市'] },
  { id:'B002', name:'戸田拠点', region:'関東', aliases:['戸田市','戸田','埼玉県戸田市'] },
  { id:'B003', name:'川崎拠点', region:'関東', aliases:['川崎市','川崎','神奈川県川崎市'] },
  { id:'B004', name:'船橋拠点', region:'関東', aliases:['船橋市','船橋','千葉県船橋市'] },
  { id:'B005', name:'品川拠点', region:'関東', aliases:['品川区','品川','東京都品川区'] },
  { id:'B006', name:'江東拠点', region:'関東', aliases:['江東区','江東','東京都江東区'] },
  { id:'B007', name:'横浜拠点', region:'関東', aliases:['横浜市','横浜','神奈川県横浜市'] },
  { id:'B008', name:'大田拠点', region:'関東', aliases:['大田区','大田','東京都大田区'] },
];

const c1 = await page.evaluate((exp) => {
  return {
    LogipokeDB: typeof window.LogipokeDB !== 'undefined',
    viaSSoT: window.__logipokeBasesViaSSoT,
    basesEqual: JSON.stringify(window.bases) === JSON.stringify(exp),
    basesLen: (window.bases || []).length,
    getBaseB005: (typeof getBaseById === 'function' && getBaseById('B005')) ? getBaseById('B005').name : 'NG',
  };
}, expectedBases);
console.log('C1 (拠点 derive):', JSON.stringify(c1));

const c2 = await page.evaluate(() => {
  const r = (x) => { const v = window.resolveVehicleRef ? window.resolveVehicleRef(x) : null; return v ? v.id : null; };
  const vm0 = (window.vehicleMasterData && window.vehicleMasterData[0]) || {};
  return {
    'resolve(1245)': r('1245'),
    'resolve(V1245)': r('V1245'),
    'resolve(車両1245)': r('車両1245'),
    'resolve(D001)': r('D001'),
    'resolve(0552→null)': r('0552'),
    vm0_id: vm0.id,
    vm0_canonical: vm0._canonicalVehicleId,
    v0_legacyIds: (window.vehicles && window.vehicles[0]) ? window.vehicles[0].legacyIds : null,
  };
});
console.log('C2 (ID解決/クロスリンク):', JSON.stringify(c2));

// 回帰：配車計画表(D&D)が描画されるか
await page.evaluate(() => { try { document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); document.getElementById('page-dispatch').classList.add('active'); switchDispatchSubtab('dnd'); } catch (e) {} });
await page.waitForTimeout(500);
const reg = await page.evaluate(() => ({ dndRows: document.querySelectorAll('#dnd-timeline .dnd-row').length, cards: document.querySelectorAll('#dnd-list .dnd-card').length }));
console.log('回帰 (配車盤描画):', JSON.stringify(reg));

console.log('=== JS ERRORS:', errs.length, '===');
errs.slice(0, 20).forEach(e => console.log('  ', e));
await browser.close();
console.log('DONE');
