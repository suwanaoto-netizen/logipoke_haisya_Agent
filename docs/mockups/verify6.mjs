import { chromium } from 'playwright';
const D = '/home/user/logipoke_haisya_Agent/docs/mockups/';
const errs = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 880 }, deviceScaleFactor: 2 });
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await page.goto('file:///home/user/logipoke_haisya_Agent/index.html', { waitUntil: 'load' });
await page.waitForTimeout(900);
const nav = async (fn) => { await page.evaluate(fn); await page.waitForTimeout(400); };
const actDisp = () => page.evaluate(() => {
  const a = document.querySelector('.dispatch-subtabs .dwb-actions');
  return { inSubtabs: !!a, display: a ? getComputedStyle(a).display : 'NO-EL' };
});

await nav(() => { try { document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); document.getElementById('page-dispatch').classList.add('active'); } catch (e) {} switchDispatchSubtab('dnd'); });
await page.waitForTimeout(300);
console.log('dnd     (visible):', JSON.stringify(await actDisp()));
await nav(() => switchDispatchSubtab('schedule'));
console.log('schedule(hidden) :', JSON.stringify(await actDisp()));
await nav(() => switchDispatchSubtab('comm'));
console.log('comm    (hidden) :', JSON.stringify(await actDisp()));
await nav(() => switchDispatchSubtab('display'));
console.log('display (hidden) :', JSON.stringify(await actDisp()));
await page.screenshot({ path: D + 'feat-9-display-tab-noactions.png' });
await nav(() => switchDispatchSubtab('dnd'));
console.log('dnd     (visible):', JSON.stringify(await actDisp()));
await page.screenshot({ path: D + 'feat-10-dnd-actions.png' });

await page.evaluate(() => { try { localStorage.removeItem('logipoke_dispatch_view_v1'); } catch (e) {} });
console.log('\n=== JS ERRORS:', errs.length, '===');
errs.slice(0, 30).forEach(e => console.log(e));
await browser.close();
console.log('DONE');
