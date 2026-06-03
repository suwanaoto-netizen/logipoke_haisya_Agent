import { chromium } from 'playwright';
const F = 'file:///home/user/logipoke_haisya_Agent/index.html';
const D = '/home/user/logipoke_haisya_Agent/docs/mockups/';
const browser = await chromium.launch();

// ── Part A: Leaflet無し（CDN遮断）→ SVGフォールバックが動くこと ──
{
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 880 }, deviceScaleFactor: 1.5 });
  page.on('pageerror', e => errs.push('A: ' + e.message));
  await page.goto(F, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.evaluate(() => { document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); document.getElementById('page-dispatch').classList.add('active'); switchDispatchSubtab('dotai'); });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => ({
    Ldefined: typeof window.L !== 'undefined',
    svgVisible: document.querySelector('.dotai-svg') ? getComputedStyle(document.querySelector('.dotai-svg')).display !== 'none' : false,
    leafletEl: !!document.getElementById('dotai-leaflet-map'),
    sideItems: document.querySelectorAll('.dotai-side-item').length,
    trucks: document.querySelectorAll('.dotai-pin-truck').length,
  }));
  console.log('PART A (fallback SVG):', JSON.stringify(r), '/ errors:', errs.length);
  errs.forEach(e => console.log('  ', e));
  await page.screenshot({ path: D + 'feat-dotai-fallback.png' });
  await page.close();
}

// ── Part B: Leafletモックを注入 → 実地図ブランチが例外なく完走すること ──
{
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 880 } });
  page.on('pageerror', e => errs.push('B: ' + e.message));
  await page.addInitScript(() => {
    const handler = { get: (t, prop) => { if (prop === 'then') return undefined; if (prop === 'getZoom') return () => 5; return () => proxy; } };
    const proxy = new Proxy(function () {}, handler);
    window.L = proxy; // L.map 等すべてのメソッドがチェーン可能なスタブ
  });
  await page.goto(F, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.__dotaiSimNow = '10:00'; document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); document.getElementById('page-dispatch').classList.add('active'); switchDispatchSubtab('dotai'); });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => ({
    Ltype: typeof window.L,
    svgDisplay: document.querySelector('.dotai-svg') ? getComputedStyle(document.querySelector('.dotai-svg')).display : 'no-el',
    leafletEl: !!document.getElementById('dotai-leaflet-map'),
    scaleDisplay: document.querySelector('.dotai-mega-scale') ? getComputedStyle(document.querySelector('.dotai-mega-scale')).display : 'no-el',
    sideItems: document.querySelectorAll('.dotai-side-item').length,
  }));
  // ズーム/リセット/フォーカス（リスト項目クリック）が例外を出さないか
  const interact = await page.evaluate(() => { try { _dotaiZoom(1.5); _dotaiZoom(0.5); _dotaiResetView(); const li = document.querySelector('.dotai-side-item'); if (li) li.click(); return 'no-throw'; } catch (e) { return 'THREW: ' + e.message; } });
  console.log('PART B (mock Leaflet):', JSON.stringify(r), '/ errors:', errs.length);
  errs.forEach(e => console.log('  ', e));
  console.log('PART B interactions:', interact);
  console.log('  → svgDisplay===none かつ leafletEl===true なら、実地図ブランチ(マーカー描画含む)が完走');
  await page.close();
}
await browser.close();
console.log('DONE');
