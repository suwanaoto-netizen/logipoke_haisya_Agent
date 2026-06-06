import { chromium } from 'playwright';
const A = 'file:///home/user/logipoke_haisya_Agent/ai-phone-reception.html';
const B = 'file:///home/user/logipoke_haisya_Agent/index.html';
const browser = await chromium.launch();

// ── 書込側: ai-phone-reception.html が正規化キーへ Reception を書く ──
{
  const errs = [];
  const page = await browser.newPage();
  page.on('pageerror', e => errs.push('A: ' + e.message));
  await page.goto(A, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    try { localStorage.removeItem('logipoke_db_receptions_v1'); localStorage.removeItem('logipoke_ai_intake_queue'); } catch (e) {}
    if (typeof pushIntakeToBackend === 'function') pushIntakeToBackend();
    const rec = JSON.parse(localStorage.getItem('logipoke_db_receptions_v1') || '[]');
    return {
      LogipokeDB: typeof window.LogipokeDB !== 'undefined',
      receptionCount: rec.length,
      hasAiExtraction: !!(rec[0] && rec[0].aiExtraction),
      hasLegacySnapshot: !!(rec[0] && rec[0]._legacyIntake),
      client: rec[0] && rec[0].aiExtraction && rec[0].aiExtraction.clientName,
      oldKeyWritten: localStorage.getItem('logipoke_ai_intake_queue') !== null,
      lastId: window.__logipokeLastIntakeId,
    };
  });
  console.log('書込側(ai-phone):', JSON.stringify(r), '/ errors', errs.length);
  errs.forEach(e => console.log('  ', e));
  await page.close();
}

// ── 取込側: index.html が正規化キーから取り込む ──
{
  const errs = [];
  const page = await browser.newPage();
  page.on('pageerror', e => errs.push('B: ' + e.message));
  await page.goto(B, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => {
    if (typeof window.LogipokeDB === 'undefined') return { err: 'LogipokeDB未読込' };
    LogipokeDB.clearReceptions();
    const intake = { id: 'AI-TEST-XYZ', client: '検証商事', from: '東京都港区', to: '大阪府大阪市', goods: 'パレット / 500kg / 冷蔵', deadline: '05/30 PM', conditions: '時間厳守', ch: 'tel', time: '09:00' };
    const rec = LogipokeDB.createReception(null, intake);
    rec._legacyIntake = intake;
    LogipokeDB.pushReception(rec); // → logipoke_db_receptions_v1
    const before = LogipokeDB.loadReceptions().length;
    const n = (window.__logipokeAIIntake && window.__logipokeAIIntake.drainIntakeQueue) ? window.__logipokeAIIntake.drainIntakeQueue() : -1;
    return { before, ingested: n, receptionsLeftAfterDrain: LogipokeDB.loadReceptions().length };
  });
  console.log('取込側(index):', JSON.stringify(r), '/ errors', errs.length);
  errs.forEach(e => console.log('  ', e));
  await page.close();
}
await browser.close();
console.log('DONE');
