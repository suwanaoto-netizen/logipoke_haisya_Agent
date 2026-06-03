import { chromium } from 'playwright';
const D = '/home/user/logipoke_haisya_Agent/docs/mockups/';
const errs = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 880 }, deviceScaleFactor: 2 });
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await page.goto('file:///home/user/logipoke_haisya_Agent/index.html', { waitUntil: 'load' });
await page.waitForTimeout(900);
const nav = async (fn) => { await page.evaluate(fn); await page.waitForTimeout(450); };
const disp = () => page.evaluate(() => {
  const g = id => { const e = document.getElementById(id); return e ? getComputedStyle(e).display : 'NO-EL'; };
  return { afb: g('assign-filter-bar'), summary: g('dispatch-warning-bar'), dateStrip: g('dnd-date-strip'),
    compact: (document.getElementById('dnd-timeline')||{}).classList ? document.getElementById('dnd-timeline').classList.contains('dv-rows-compact') : 'NO-EL',
    pgClass: (document.getElementById('page-dispatch')||{}).className };
});

await nav(() => { try { document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); document.getElementById('page-dispatch').classList.add('active'); } catch (e) {} switchDispatchSubtab('dnd'); });
console.log('STANDARD (both bars should show):', JSON.stringify(await disp()));
await page.screenshot({ path: D + 'feat-4-board-bars-on.png' });

await nav(() => switchDispatchSubtab('display'));
await page.screenshot({ path: D + 'feat-5-settings-bars.png' });

await nav(() => { dvSetFlag('showFilterBar', false); dvSetFlag('showSummaryBar', false); switchDispatchSubtab('dnd'); });
console.log('BARS OFF (both should be none):', JSON.stringify(await disp()));
await page.screenshot({ path: D + 'feat-6-board-bars-off.png' });

await nav(() => { dvApplyPreset('full'); switchDispatchSubtab('dnd'); });
console.log('FULL (both should show again):', JSON.stringify(await disp()));

await nav(() => { dvApplyPreset('minimal'); switchDispatchSubtab('dnd'); });
console.log('MINIMAL (all hidden):', JSON.stringify(await disp()));

await page.evaluate(() => { try { localStorage.removeItem('logipoke_dispatch_view_v1'); } catch (e) {} });
console.log('\n=== JS ERRORS:', errs.length, '===');
errs.slice(0, 30).forEach(e => console.log(e));
await browser.close();
console.log('DONE');
