import { chromium } from 'playwright';
const D = '/home/user/logipoke_haisya_Agent/docs/mockups/';
const errs = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 880 }, deviceScaleFactor: 2 });
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await page.goto('file:///home/user/logipoke_haisya_Agent/index.html', { waitUntil: 'load' });
await page.waitForTimeout(900);
const nav = async (fn) => { await page.evaluate(fn); await page.waitForTimeout(500); };
const probe = () => page.evaluate(() => {
  const inSubs = document.querySelector('.dispatch-subtabs .dwb-actions');
  const inBar = document.querySelector('#dispatch-warning-bar .dwb-actions');
  const wb = document.getElementById('dispatch-warning-bar');
  const undo = document.getElementById('dwb-btn-undo');
  return {
    actionsParent: (document.querySelector('.dwb-actions') || {}).parentElement ? document.querySelector('.dwb-actions').parentElement.className : 'NO-ACTIONS',
    inSubtabs: !!inSubs,
    inWarningBar: !!inBar,
    actionsVisible: inSubs ? getComputedStyle(inSubs).display : 'NO-EL',
    undoBtnFound: !!undo,
    warningBarDisplay: wb ? getComputedStyle(wb).display : 'NO-EL',
    chipsCount: document.querySelectorAll('#dwb-chips .dwb-chip').length,
  };
});

await nav(() => { try { document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); document.getElementById('page-dispatch').classList.add('active'); } catch (e) {} switchDispatchSubtab('dnd'); });
await page.waitForTimeout(300);
console.log('SUMMARY ON (counts in bar, actions in subtabs):', JSON.stringify(await probe()));
await page.screenshot({ path: D + 'feat-7-summary-on.png' });

await nav(() => switchDispatchSubtab('display'));
await page.screenshot({ path: D + 'feat-5-settings-bars.png' });

await nav(() => { switchDispatchSubtab('dnd'); dvSetFlag('showSummaryBar', false); switchDispatchSubtab('dnd'); });
await page.waitForTimeout(200);
console.log('SUMMARY OFF (counts hidden, actions remain):', JSON.stringify(await probe()));
await page.screenshot({ path: D + 'feat-8-summary-off.png' });

await page.evaluate(() => { try { localStorage.removeItem('logipoke_dispatch_view_v1'); } catch (e) {} });
console.log('\n=== JS ERRORS:', errs.length, '===');
errs.slice(0, 30).forEach(e => console.log(e));
await browser.close();
console.log('DONE');
