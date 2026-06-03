import { chromium } from 'playwright';
const F = 'file:///home/user/logipoke_haisya_Agent/index.html';
const D = '/home/user/logipoke_haisya_Agent/docs/mockups/';
const errs = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 880 }, deviceScaleFactor: 1.5 });
page.on('pageerror', e => errs.push(e.message));
await page.goto(F, { waitUntil: 'load' });
await page.waitForTimeout(700);
const probe = () => page.evaluate(() => {
  const sb = document.querySelector('.sidebar');
  const lbl = document.querySelector('.sidebar .nav-label');
  const body = document.querySelector('.app-body');
  return {
    collapsedClass: body ? body.classList.contains('sidebar-collapsed') : 'no-el',
    sidebarW: sb ? Math.round(sb.getBoundingClientRect().width) : -1,
    labelVisible: lbl ? (getComputedStyle(lbl).display !== 'none' && lbl.getBoundingClientRect().width > 0) : 'no-el',
    toggleBtn: !!document.getElementById('sidebar-toggle'),
  };
});
console.log('初期(展開):', JSON.stringify(await probe()));
await page.screenshot({ path: D + 'feat-sidebar-expanded.png' });

await page.click('#sidebar-toggle');
await page.waitForTimeout(400);
console.log('1回クリック(折りたたみ):', JSON.stringify(await probe()));
await page.screenshot({ path: D + 'feat-sidebar-collapsed.png' });

// 永続化：リロードしても折りたたみ維持
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(700);
console.log('リロード後(維持):', JSON.stringify(await probe()));

await page.click('#sidebar-toggle');
await page.waitForTimeout(400);
console.log('再クリック(展開に戻る):', JSON.stringify(await probe()));

await page.evaluate(() => { try { localStorage.removeItem('logipoke_sidebar_collapsed'); } catch (e) {} });
console.log('=== JS ERRORS:', errs.length, '===');
errs.slice(0, 20).forEach(e => console.log('  ', e));
await browser.close();
console.log('DONE');
