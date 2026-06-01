// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  データ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  案件パターン定義
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const CASE_PATTERNS = {
  '定期案件': {
    id: '定期案件',
    color: '#0D4A3A',
    bgColor: '#EAF5F0',
    borderColor: '#3BB888',
    icon: '',
    logic: '固定リソースの紐付け：特定の車・人を最優先で予約し、空きが出ないようブロックする。',
    requiredData: '車両ID・乗務員ID・運行スケジュール',
    dispatchLogic: '固定担当車両を最優先。継続性・信頼性が高いドライバーを選定。バックアップ車両も確保。',
  },
  'スポット案件': {
    id: 'スポット案件',
    color: '#0D4A3A',
    bgColor: '#EAF5F0',
    borderColor: '#3BB888',
    icon: '',
    logic: '空車マッチング・利益率：現在地と荷出し先の距離（空車回送距離）を最小化し、かつ粗利が高い順に提示する。',
    requiredData: 'GPS位置情報・現在時刻・運賃マスタ・空車予定時刻',
    dispatchLogic: '現在地から最も近い空車を優先。帰り荷との組み合わせで実車率を最大化。粗利率が高い組み合わせを推奨。',
  },
  'チャーター案件': {
    id: 'チャーター案件',
    color: '#0D4A3A',
    bgColor: '#EAF5F0',
    borderColor: '#3BB888',
    icon: '',
    logic: '拘束時間の残業チェック：その仕事を受けた場合、改善基準告示（13〜15時間等）をクリアできるかを計算。',
    requiredData: '稼働開始時間・過去1週間の平均拘束時間',
    dispatchLogic: '拘束時間の残余が最も多いドライバーを優先。一日拘束に耐えられる稼働実績・評価が高い人材を選定。',
  },
  '緊急案件': {
    id: '緊急案件',
    color: '#0D4A3A',
    bgColor: '#EAF5F0',
    borderColor: '#3BB888',
    icon: '',
    logic: 'ETA（到着予想時刻）最短順：今から向かって何分で着くかのみでソート。ルート上の渋滞も加味する。',
    requiredData: 'リアルタイム交通情報・周辺車両の走行ステータス',
    dispatchLogic: '現場から最も近い車両をリアルタイムGPSで特定。交通情報を加味したETA最短車両を第1候補に。協力会社も即時打診。',
  },
  '多地点配送': {
    id: '多地点配送',
    color: '#0D4A3A',
    bgColor: '#EAF5F0',
    borderColor: '#3BB888',
    icon: '',
    logic: 'ルート最適化（巡回セールスマン問題）：指定時間（タイムウィンドウ）を守りつつ、総走行距離が最短になる組み合わせを算出。',
    requiredData: '配送先座標・指定時間・積載容量（容積・重量）',
    dispatchLogic: '積載量と配送先タイムウィンドウを考慮したルート最適化。積載率80%超の効率的な組み合わせを優先して提案。',
  },
  '特殊条件案件': {
    id: '特殊条件案件',
    color: '#0D4A3A',
    bgColor: '#EAF5F0',
    borderColor: '#3BB888',
    icon: '',
    logic: '属性フィルタリング（排他条件）：冷凍車でなければ不可・フォーク免許なしは不可、といった1/0判定。',
    requiredData: '車両スペック・乗務員スキル（資格）・現場制約情報',
    dispatchLogic: '必須条件（資格・設備）を満たす車両・ドライバーのみを候補に絞り込み。コンプライアンスチェックを最優先で実施。',
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AIスコアリング重み付け（設定画面と連動）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
window.AI_WEIGHTS = {
  distance: 30,   // 距離効率
  load:     25,   // 積載量適合度
  driver:   20,   // ドライバー実績
  law:      15,   // 拘束時間余裕
  customer: 10,   // 顧客相性スコア
};

// 各車両が持つ"素点"（0〜100）。重み付けを変えるとスコアが変動する
const VEHICLE_RAW_SCORES = {
  '車両1245': { distance:98, load:95, driver:100, law:95, customer:90 },
  '車両1123': { distance:92, load:85, driver:80,  law:70, customer:88 },
  '車両1356': { distance:78, load:75, driver:80,  law:90, customer:82 },
  '車両0887': { distance:80, load:72, driver:80,  law:85, customer:75 },
  '車両2201': { distance:96, load:88, driver:100, law:95, customer:85 },
  '車両3312': { distance:88, load:95, driver:80,  law:60, customer:80 },
  '車両0445': { distance:75, load:68, driver:60,  law:90, customer:72 },
  '車両0552': { distance:86, load:78, driver:80,  law:92, customer:82 },
  '車両0781': { distance:78, load:82, driver:80,  law:65, customer:74 },
  '車両1099': { distance:68, load:55, driver:60,  law:88, customer:70 },
  '車両2580': { distance:95, load:95, driver:100, law:95, customer:92 },
  '車両1872': { distance:88, load:95, driver:80,  law:72, customer:85 },
  '車両0934': { distance:78, load:82, driver:80,  law:85, customer:76 },
  '車両3301': { distance:90, load:95, driver:100, law:92, customer:80 },
  '車両2240': { distance:82, load:95, driver:80,  law:88, customer:76 },
  '車両4410': { distance:72, load:78, driver:60,  law:65, customer:80 },
  '車両5521': { distance:92, load:82, driver:100, law:95, customer:85 },
  '車両6632': { distance:85, load:72, driver:80,  law:92, customer:86 },
  '車両7743': { distance:76, load:65, driver:80,  law:88, customer:72 },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  車両スケジュール空き情報（当日の空き時間帯）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const VEHICLE_SCHEDULE = {
  '車両1245': { busySlots:[{s:'07:00',e:'12:00'},{s:'13:00',e:'15:30'}], nextFreeFrom:'15:30', idleHours:8.5, utilizationPct:62, gaps:[{s:'12:00',e:'13:00',dur:60},{s:'15:30',e:'24:00',dur:510}] },
  '車両1123': { busySlots:[{s:'10:00',e:'13:00'}],                       nextFreeFrom:'13:00', idleHours:13,  utilizationPct:25, gaps:[{s:'00:00',e:'10:00',dur:600},{s:'13:00',e:'24:00',dur:660}] },
  '車両1356': { busySlots:[],                                             nextFreeFrom:'今すぐ', idleHours:24,  utilizationPct:0,  gaps:[{s:'00:00',e:'24:00',dur:1440}] },
  '車両0887': { busySlots:[{s:'11:00',e:'15:20'}],                       nextFreeFrom:'15:20', idleHours:16,  utilizationPct:35, gaps:[{s:'00:00',e:'11:00',dur:660},{s:'15:20',e:'24:00',dur:520}] },
  '車両2201': { busySlots:[{s:'08:00',e:'18:30'}],                       nextFreeFrom:'18:30', idleHours:9.5, utilizationPct:60, gaps:[{s:'00:00',e:'08:00',dur:480},{s:'18:30',e:'24:00',dur:330}] },
  '車両3312': { busySlots:[{s:'10:00',e:'15:00'}],                       nextFreeFrom:'15:00', idleHours:14,  utilizationPct:32, gaps:[{s:'00:00',e:'10:00',dur:600},{s:'15:00',e:'24:00',dur:540}] },
  '車両0445': { busySlots:[],                                             nextFreeFrom:'今すぐ', idleHours:24,  utilizationPct:0,  gaps:[{s:'00:00',e:'24:00',dur:1440}] },
  '車両0552': { busySlots:[{s:'18:00',e:'22:00'}],                       nextFreeFrom:'今すぐ', idleHours:20,  utilizationPct:17, gaps:[{s:'00:00',e:'18:00',dur:1080},{s:'22:00',e:'24:00',dur:120}] },
  '車両0781': { busySlots:[{s:'09:00',e:'12:00'},{s:'14:00',e:'16:00'}], nextFreeFrom:'16:00', idleHours:12,  utilizationPct:42, gaps:[{s:'00:00',e:'09:00',dur:540},{s:'12:00',e:'14:00',dur:120},{s:'16:00',e:'24:00',dur:480}] },
  '車両1099': { busySlots:[],                                             nextFreeFrom:'今すぐ', idleHours:24,  utilizationPct:0,  gaps:[{s:'00:00',e:'24:00',dur:1440}] },
  '車両2580': { busySlots:[{s:'06:00',e:'20:00'}],                       nextFreeFrom:'20:00', idleHours:10,  utilizationPct:58, gaps:[{s:'00:00',e:'06:00',dur:360},{s:'20:00',e:'24:00',dur:240}] },
  '車両1872': { busySlots:[{s:'08:00',e:'14:00'}],                       nextFreeFrom:'14:00', idleHours:14,  utilizationPct:32, gaps:[{s:'00:00',e:'08:00',dur:480},{s:'14:00',e:'24:00',dur:600}] },
  '車両0934': { busySlots:[],                                             nextFreeFrom:'今すぐ', idleHours:24,  utilizationPct:0,  gaps:[{s:'00:00',e:'24:00',dur:1440}] },
  '車両3301': { busySlots:[{s:'08:00',e:'22:00'}],                       nextFreeFrom:'22:00', idleHours:10,  utilizationPct:58, gaps:[{s:'00:00',e:'08:00',dur:480},{s:'22:00',e:'24:00',dur:120}] },
  '車両2240': { busySlots:[{s:'10:00',e:'16:00'}],                       nextFreeFrom:'16:00', idleHours:16,  utilizationPct:30, gaps:[{s:'00:00',e:'10:00',dur:600},{s:'16:00',e:'24:00',dur:480}] },
  '車両4410': { busySlots:[{s:'07:00',e:'09:00'}],                       nextFreeFrom:'09:00', idleHours:22,  utilizationPct:8,  gaps:[{s:'09:00',e:'24:00',dur:900}] },
  '車両5521': { busySlots:[{s:'09:00',e:'17:00'}],                       nextFreeFrom:'17:00', idleHours:16,  utilizationPct:33, gaps:[{s:'00:00',e:'09:00',dur:540},{s:'17:00',e:'24:00',dur:420}] },
  '車両6632': { busySlots:[{s:'11:00',e:'15:00'}],                       nextFreeFrom:'15:00', idleHours:18,  utilizationPct:22, gaps:[{s:'00:00',e:'11:00',dur:660},{s:'15:00',e:'24:00',dur:540}] },
  '車両7743': { busySlots:[],                                             nextFreeFrom:'今すぐ', idleHours:24,  utilizationPct:0,  gaps:[{s:'00:00',e:'24:00',dur:1440}] },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  車両利益データ（過去実績・単価情報）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const VEHICLE_PROFIT = {
  '車両1245': { avgSales:48000, avgFuelCost:15000, avgOtherCost:3000, marginPct:63, returnLoadRate:72, avgKmSales:1371 },
  '車両1123': { avgSales:38000, avgFuelCost:14000, avgOtherCost:3500, marginPct:53, returnLoadRate:55, avgKmSales:1188 },
  '車両1356': { avgSales:32000, avgFuelCost:12000, avgOtherCost:2500, marginPct:55, returnLoadRate:48, avgKmSales:1143 },
  '車両0887': { avgSales:28000, avgFuelCost:10000, avgOtherCost:2000, marginPct:57, returnLoadRate:60, avgKmSales:1200 },
  '車両2201': { avgSales:52000, avgFuelCost:16000, avgOtherCost:4000, marginPct:62, returnLoadRate:68, avgKmSales:1333 },
  '車両3312': { avgSales:44000, avgFuelCost:15500, avgOtherCost:3500, marginPct:57, returnLoadRate:52, avgKmSales:1280 },
  '車両0445': { avgSales:25000, avgFuelCost:10000, avgOtherCost:2000, marginPct:52, returnLoadRate:40, avgKmSales:1042 },
  '車両0552': { avgSales:35000, avgFuelCost:12000, avgOtherCost:2500, marginPct:59, returnLoadRate:62, avgKmSales:1224 },
  '車両0781': { avgSales:30000, avgFuelCost:11000, avgOtherCost:2200, marginPct:56, returnLoadRate:50, avgKmSales:1111 },
  '車両1099': { avgSales:22000, avgFuelCost:9000,  avgOtherCost:2000, marginPct:50, returnLoadRate:38, avgKmSales:1000 },
  '車両2580': { avgSales:68000, avgFuelCost:20000, avgOtherCost:5000, marginPct:63, returnLoadRate:75, avgKmSales:1457 },
  '車両1872': { avgSales:55000, avgFuelCost:18000, avgOtherCost:4500, marginPct:59, returnLoadRate:65, avgKmSales:1311 },
  '車両0934': { avgSales:42000, avgFuelCost:14000, avgOtherCost:3500, marginPct:58, returnLoadRate:55, avgKmSales:1225 },
  '車両3301': { avgSales:58000, avgFuelCost:18000, avgOtherCost:4000, marginPct:62, returnLoadRate:70, avgKmSales:1389 },
  '車両2240': { avgSales:50000, avgFuelCost:16500, avgOtherCost:3500, marginPct:60, returnLoadRate:63, avgKmSales:1333 },
  '車両4410': { avgSales:36000, avgFuelCost:13000, avgOtherCost:3000, marginPct:56, returnLoadRate:45, avgKmSales:1200 },
  '車両5521': { avgSales:46000, avgFuelCost:15000, avgOtherCost:3500, marginPct:60, returnLoadRate:66, avgKmSales:1300 },
  '車両6632': { avgSales:38000, avgFuelCost:13500, avgOtherCost:3000, marginPct:57, returnLoadRate:58, avgKmSales:1190 },
  '車両7743': { avgSales:30000, avgFuelCost:11000, avgOtherCost:2500, marginPct:55, returnLoadRate:48, avgKmSales:1111 },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  最終推薦ロジック①：スケジュール隙間フィット
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getBestScheduleFitVehicle(caseObj) {
  const vehicles = (caseObj.vehicles || []);
  if (!vehicles.length) return null;
  // 推定所要時間（荷物重量・距離から簡易算出）
  const estimatedHours = caseObj.distance
    ? Math.max(1, Math.round(parseInt(String(caseObj.distance).replace(/[^0-9]/g,'')) / 60 * 10) / 10)
    : 3;
  let best = null, bestScore = -1;
  vehicles.forEach(v => {
    const sched = VEHICLE_SCHEDULE[v.id];
    if (!sched) return;
    // 空き時間が必要時間をぴったり埋められるギャップを探す
    const fitGap = sched.gaps.find(g => {
      const durH = g.dur / 60;
      return durH >= estimatedHours && durH <= estimatedHours * 2.0;
    });
    // スコア = ギャップの「余裕なし度」（短いほど高得点）+ 空き率ペナルティ
    const gapDurH = fitGap ? fitGap.dur / 60 : (sched.idleHours || 0);
    const fitScore = fitGap
      ? 100 - Math.round((gapDurH - estimatedHours) / estimatedHours * 30)
      : Math.round(sched.idleHours * 3);
    if (fitScore > bestScore) { bestScore = fitScore; best = { v, sched, fitGap, estimatedHours, fitScore }; }
  });
  return best;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  最終推薦ロジック②：利益最大化
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getBestProfitVehicle(caseObj) {
  const vehicles = (caseObj.vehicles || []);
  if (!vehicles.length) return null;
  let best = null, bestProfit = -1;
  vehicles.forEach(v => {
    const p = VEHICLE_PROFIT[v.id];
    if (!p) return;
    // 予想粗利 = 平均売上 × 粗利率 + 帰り荷期待値
    const expectedProfit = Math.round(p.avgSales * p.marginPct / 100);
    const returnBonus    = Math.round(p.avgSales * 0.15 * p.returnLoadRate / 100);
    const totalExpected  = expectedProfit + returnBonus;
    if (totalExpected > bestProfit) { bestProfit = totalExpected; best = { v, p, expectedProfit, returnBonus, totalExpected }; }
  });
  return best;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  最終推薦カードHTML生成
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderFinalRecommendCard(caseObj) {
  const schedFit  = getBestScheduleFitVehicle(caseObj);
  const profitBest = getBestProfitVehicle(caseObj);
  if (!schedFit && !profitBest) return '';

  // ── スケジュール隙間フィットカード ──
  const schedHtml = schedFit ? (() => {
    const { v, sched, fitGap, estimatedHours } = schedFit;
    const timelineHtml = sched.busySlots.map(slot =>
      `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
        <span style="font-size:9px;font-family:Inter,sans-serif;color:#6b7280;width:60px;flex-shrink:0">${slot.s}〜${slot.e}</span>
        <div style="flex:1;height:10px;background:#fee2e2;border-radius:3px;display:flex;align-items:center;padding:0 5px">
          <span style="font-size:8px;color:#dc2626;font-weight:600">稼働中</span>
        </div>
      </div>`
    ).join('') +
    (fitGap ? `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
        <span style="font-size:9px;font-family:Inter,sans-serif;color:#6b7280;width:60px;flex-shrink:0">${fitGap.s}〜${fitGap.e}</span>
        <div style="flex:1;height:10px;background:#d1fae5;border-radius:3px;border:1.5px dashed #059669;display:flex;align-items:center;justify-content:center;gap:4px">
          <span style="font-size:8px;color:#059669;font-weight:700">▶ この案件を挿入</span>
        </div>
      </div>` : '');
    const gapLabel = fitGap
      ? `${fitGap.s}〜${fitGap.e}（空き${(fitGap.dur/60).toFixed(1)}h）に${estimatedHours}h案件がぴったり収まります`
      : `空き時間 ${sched.idleHours}h — 即アサイン可能`;
    return `
      <div style="border:1.5px solid #059669;border-radius:10px;overflow:hidden;margin-bottom:10px">
        <div style="background:linear-gradient(135deg,#065f46 0%,#047857 100%);padding:10px 14px;display:flex;align-items:center;gap:8px">
          <div style="width:28px;height:28px;background:rgba(255,255,255,.15);border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div>
            <div style="font-size:11px;font-weight:800;color:#fff;letter-spacing:.03em">📅 隙間フィット最適車両</div>
            <div style="font-size:9px;color:rgba(255,255,255,.7)">スケジュールの空き時間を最大活用</div>
          </div>
          <div style="margin-left:auto;background:rgba(255,255,255,.15);border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;color:#6ee7b7;font-family:Inter,sans-serif">
            稼働率 +${Math.round((estimatedHours/24)*100)}% UP
          </div>
        </div>
        <div style="padding:12px 14px;background:#f0fdf4">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div style="flex:1">
              <div style="font-size:13px;font-weight:800;color:#065f46">${v.driver}</div>
              <div style="font-size:10px;color:#6b7280;margin-top:1px">${v.id} ／ 次の空き：<span style="font-weight:700;color:#059669">${sched.nextFreeFrom}</span></div>
            </div>
            <div style="text-align:center">
              <div style="font-size:22px;font-weight:900;font-family:Inter,sans-serif;color:#059669;line-height:1">${sched.idleHours}h</div>
              <div style="font-size:9px;color:#6b7280">本日空き時間</div>
            </div>
          </div>
          <div style="background:#fff;border-radius:8px;padding:8px 10px;margin-bottom:8px">
            <div style="font-size:9px;font-weight:700;color:#6b7280;margin-bottom:6px;letter-spacing:.06em">本日スケジュール</div>
            ${timelineHtml}
          </div>
          <div style="background:#d1fae5;border-radius:7px;padding:7px 10px;font-size:11px;font-weight:600;color:#065f46;line-height:1.5">
            💡 ${gapLabel}
          </div>
        </div>
      </div>`;
  })() : '';

  // ── 利益最大化カード ──
  const profitHtml = profitBest ? (() => {
    const { v, p, expectedProfit, returnBonus, totalExpected } = profitBest;
    const profitBarW = Math.min(100, Math.round(p.marginPct));
    const returnBarW = Math.min(100, p.returnLoadRate);
    return `
      <div style="border:1.5px solid #d97706;border-radius:10px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#92400e 0%,#b45309 100%);padding:10px 14px;display:flex;align-items:center;gap:8px">
          <div style="width:28px;height:28px;background:rgba(255,255,255,.15);border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fcd34d" stroke-width="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div>
            <div style="font-size:11px;font-weight:800;color:#fff;letter-spacing:.03em">💰 利益最大化車両</div>
            <div style="font-size:9px;color:rgba(255,255,255,.7)">粗利率・帰り荷率から算出した最大収益候補</div>
          </div>
          <div style="margin-left:auto;background:rgba(255,255,255,.15);border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;color:#fcd34d;font-family:Inter,sans-serif">
            予想粗利 ¥${totalExpected.toLocaleString()}
          </div>
        </div>
        <div style="padding:12px 14px;background:#fffbeb">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div style="flex:1">
              <div style="font-size:13px;font-weight:800;color:#92400e">${v.driver}</div>
              <div style="font-size:10px;color:#6b7280;margin-top:1px">${v.id} ／ 平均単価 ¥${p.avgSales.toLocaleString()}/案件</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:22px;font-weight:900;font-family:Inter,sans-serif;color:#d97706;line-height:1">${p.marginPct}%</div>
              <div style="font-size:9px;color:#6b7280">粗利率実績</div>
            </div>
          </div>
          <div style="background:#fff;border-radius:8px;padding:8px 10px;margin-bottom:8px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
              <span style="font-size:10px;font-weight:600;color:#6b7280">粗利率</span>
              <span style="font-size:10px;font-weight:700;font-family:Inter,sans-serif;color:#d97706">${p.marginPct}%</span>
            </div>
            <div style="height:7px;background:#f1f5f9;border-radius:4px;overflow:hidden;margin-bottom:8px">
              <div style="height:100%;width:${profitBarW}%;background:linear-gradient(90deg,#f59e0b,#d97706);border-radius:4px"></div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
              <span style="font-size:10px;font-weight:600;color:#6b7280">帰り荷獲得率</span>
              <span style="font-size:10px;font-weight:700;font-family:Inter,sans-serif;color:#059669">${p.returnLoadRate}%</span>
            </div>
            <div style="height:7px;background:#f1f5f9;border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${returnBarW}%;background:linear-gradient(90deg,#34d399,#059669);border-radius:4px"></div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
            <div style="background:#fff;border-radius:7px;padding:7px 10px;text-align:center">
              <div style="font-size:9px;color:#6b7280;margin-bottom:2px">予想粗利（本案件）</div>
              <div style="font-size:14px;font-weight:800;font-family:Inter,sans-serif;color:#d97706">¥${expectedProfit.toLocaleString()}</div>
            </div>
            <div style="background:#d1fae5;border-radius:7px;padding:7px 10px;text-align:center">
              <div style="font-size:9px;color:#065f46;margin-bottom:2px">帰り荷期待収益</div>
              <div style="font-size:14px;font-weight:800;font-family:Inter,sans-serif;color:#059669">+¥${returnBonus.toLocaleString()}</div>
            </div>
          </div>
          <div style="background:#fef3c7;border-radius:7px;padding:7px 10px;font-size:11px;font-weight:600;color:#92400e;line-height:1.5">
            💡 過去実績より粗利率・帰り荷率がともに高く、この案件で<strong>¥${totalExpected.toLocaleString()}</strong>の収益貢献が期待できます
          </div>
        </div>
      </div>`;
  })() : '';

  return `
    <div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:14px">
      <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);padding:12px 16px;display:flex;align-items:center;gap:8px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <div style="font-size:13px;font-weight:800;color:#fff">最終AIレコメンド（2軸評価）</div>
        <div style="margin-left:auto;font-size:9px;color:rgba(255,255,255,.6)">スケジュール効率 × 収益最大化</div>
      </div>
      <div style="padding:12px 14px;background:#f8fafc">
        ${schedHtml}
        ${profitHtml}
      </div>
    </div>`;
}

function calcAIScore(vehicleId) {
  const raw = VEHICLE_RAW_SCORES[vehicleId];
  if (!raw) return 75;
  const w = window.AI_WEIGHTS;
  const total = w.distance + w.load + w.driver + w.law + w.customer;
  if (total === 0) return 0;
  const score = (
    raw.distance * w.distance +
    raw.load     * w.load     +
    raw.driver   * w.driver   +
    raw.law      * w.law      +
    raw.customer * w.customer
  ) / total;
  return Math.round(score);
}

function recalcAllScores() {
  const allCases = [...(window.unprocessedCases||unprocessedCases), ...(window.processingCases||processingCases)];
  allCases.forEach(c => {
    if (!c.vehicles) return;
    c.vehicles.forEach(v => {
      v.score = calcAIScore(v.id);
    });
    // スコア降順で rank を振り直す
    c.vehicles.sort((a,b) => b.score - a.score);
    c.vehicles.forEach((v,i) => { v.rank = i+1; });
  });
}

const unprocessedCases = [
  { id:'20240524001', status:'未解析', client:'株式会社○○商事', from:'埼玉県川口市', to:'神奈川県横浜市', goods:'パレット / 800kg / 常温', deadline:'05/25 AM指定', ch:'tel', time:'09:15', analyzed:true,
    casePattern: '定期案件',
    aiResult:{ confidence:'高信頼度', client:'株式会社○○商事', from:'埼玉県川口市', to:'神奈川県横浜市', goods:'パレット / 800kg / 常温', deadline:'05/25 AM指定', conditions:'時間厳守 / バース予約済み', vehicle:'4tウィング', count:1 },
    vehicles:[ {rank:1,id:'車両1245',driver:'山田 一郎',base:'川口市',avail:'空車',cap:'2,000kg',stars:5,score:95},
               {rank:2,id:'車両1123',driver:'鈴木 次郎',base:'川口市',avail:'空車',cap:'1,500kg',stars:4,score:88},
               {rank:3,id:'車両1356',driver:'佐藤 三郎',base:'戸田市',avail:'空車',cap:'1,200kg',stars:4,score:82} ],
    fareResult: null
  },
  { id:'20240524002', status:'要確認', client:'△△食品株式会社', from:'千葉県船橋市', to:'東京都大田区', goods:'ケース / 500kg / 冷蔵', deadline:'05/24 PM指定', ch:'tel', time:'09:26', analyzed:false,
    casePattern: '特殊条件案件',
    vehicles:[ {rank:1,id:'車両0887',driver:'田中 四郎',base:'船橋市',avail:'空車',cap:'1,000kg',stars:4,score:78} ]
  },
  { id:'20240524003', status:'未解析', client:'株式会社□□製作所', from:'茨城県つくば市', to:'愛知県名古屋市', goods:'機械部品 / 1200kg / 常温', deadline:'05/25 終日', ch:'tel', time:'09:42', analyzed:false,
    casePattern: 'チャーター案件',
    vehicles:[]
  },
  { id:'20240524004', status:'未解析', client:'◇◇アパレル株式会社', from:'東京都渋谷区', to:'大阪府大阪市', goods:'アパレル / 300kg / 常温', deadline:'05/26 AM指定', ch:'mail', time:'10:05', analyzed:false,
    casePattern: 'スポット案件',
    vehicles:[]
  },
];

const processingCases = [
  { id:'20240524101', status:'処理中', priority:'緊急', casePattern:'定期案件', client:'株式会社○○商事', from:'埼玉県川口市', to:'神奈川県横浜市', goods:'パレット / 800kg / 常温', deadline:'05/25 AM', vehicle:'車両1245', driver:'山田 一郎', distance:'35km', selectedVehicleIdx:0,
    vehicleMode:'single', legs:[], multiReasons:[],
    vehicles:[
      {rank:1,id:'車両1245',driver:'山田 一郎',base:'川口市',avail:'空車',cap:'2,000kg',stars:5,score:95,
       law:{ status:'ok', label:'適合', items:[
         {ok:true, title:'日間運転時間', val:'全員 9h以内'},
         {ok:true, title:'拘束時間',     val:'全員 13h以内'},
         {ok:true, title:'週間上限時間', val:'全員 週65h以内'},
         {ok:true, title:'勤務間休息',   val:'インターバル8h確保'},
         {ok:true, title:'連続運転制限', val:'上限まで余裕あり'},
         {ok:true, title:'休憩確保',     val:'30分休憩ルール適合'},
       ]}},
      {rank:2,id:'車両1123',driver:'鈴木 次郎',base:'川口市',avail:'空車',cap:'1,500kg',stars:4,score:88,
       law:{ status:'warn', label:'要確認', items:[
         {ok:false,title:'連続運転制限', val:'連続運転3.6h — あと0.4hで上限'},
         {ok:true, title:'日間運転時間', val:'全員 9h以内'},
         {ok:true, title:'拘束時間',     val:'全員 13h以内'},
         {ok:true, title:'週間上限時間', val:'全員 週65h以内'},
         {ok:true, title:'勤務間休息',   val:'翌日シフト問題なし'},
         {ok:true, title:'休憩確保',     val:'30分休憩ルール適合'},
       ]}},
      {rank:3,id:'車両1356',driver:'佐藤 三郎',base:'戸田市',avail:'空車',cap:'1,200kg',stars:4,score:79,
       law:{ status:'ok', label:'適合', items:[
         {ok:true, title:'日間運転時間', val:'全員 9h以内'},
         {ok:true, title:'拘束時間',     val:'全員 13h以内'},
         {ok:true, title:'週間上限時間', val:'全員 週65h以内'},
         {ok:true, title:'勤務間休息',   val:'インターバル8h確保'},
         {ok:true, title:'連続運転制限', val:'上限まで余裕あり'},
         {ok:true, title:'休憩確保',     val:'30分休憩ルール適合'},
       ]}},
    ]
  },
  { id:'20240524102', status:'処理中', priority:'通常', casePattern:'スポット案件', client:'南関東物流株式会社', from:'神奈川県川崎市', to:'静岡県静岡市', goods:'電子部品 / 400kg / 精密', deadline:'05/24 夕方', vehicle:'車両2201', driver:'伊藤 五郎', distance:'120km', selectedVehicleIdx:0,
    vehicleMode:'single', legs:[], multiReasons:[],
    vehicles:[
      {rank:1,id:'車両2201',driver:'伊藤 五郎',base:'川崎市',avail:'空車',cap:'1,500kg',stars:5,score:91,
       law:{ status:'ok', label:'適合', items:[
         {ok:true, title:'日間運転時間', val:'全員 9h以内'},
         {ok:true, title:'拘束時間',     val:'全員 13h以内'},
         {ok:true, title:'週間上限時間', val:'全員 週65h以内'},
         {ok:true, title:'勤務間休息',   val:'インターバル8h確保'},
         {ok:true, title:'連続運転制限', val:'上限まで余裕あり'},
         {ok:true, title:'休憩確保',     val:'30分休憩ルール適合'},
       ]}},
      {rank:2,id:'車両3312',driver:'中村 六太',base:'横浜市',avail:'空車',cap:'2,000kg',stars:4,score:83,
       law:{ status:'warn', label:'要確認', items:[
         {ok:false,title:'連続運転制限', val:'連続運転3.2h — あと0.8hで上限'},
         {ok:true, title:'日間運転時間', val:'全員 9h以内'},
         {ok:false,title:'週間上限時間', val:'今週 62h — あと3hで上限'},
         {ok:true, title:'拘束時間',     val:'全員 13h以内'},
         {ok:true, title:'勤務間休息',   val:'翌日シフト問題なし'},
         {ok:true, title:'休憩確保',     val:'30分休憩ルール適合'},
       ]}},
      {rank:3,id:'車両0445',driver:'小林 七海',base:'川崎市',avail:'空車',cap:'1,200kg',stars:3,score:74,
       law:{ status:'ok', label:'適合', items:[
         {ok:true, title:'日間運転時間', val:'全員 9h以内'},
         {ok:true, title:'拘束時間',     val:'全員 13h以内'},
         {ok:true, title:'週間上限時間', val:'全員 週65h以内'},
         {ok:true, title:'勤務間休息',   val:'インターバル8h確保'},
         {ok:true, title:'連続運転制限', val:'上限まで余裕あり'},
         {ok:true, title:'休憩確保',     val:'30分休憩ルール適合'},
       ]}},
    ]
  },
  { id:'20240524103', status:'処理中', priority:'通常', client:'北海道産直食品', from:'東京都江東区', to:'千葉県千葉市', goods:'生鮮食品 / 600kg / 冷蔵', deadline:'05/24 夜', vehicle:'未割当', driver:'未割当', distance:'45km', selectedVehicleIdx:0,
    vehicleMode:'single', legs:[], multiReasons:[],
    vehicles:[
      {rank:1,id:'車両0552',driver:'渡辺 六郎',base:'江東区',avail:'空車',cap:'1,000kg',stars:4,score:82,
       law:{ status:'ok', label:'適合', items:[
         {ok:true, title:'日間運転時間', val:'全員 9h以内'},
         {ok:true, title:'拘束時間',     val:'全員 13h以内'},
         {ok:true, title:'週間上限時間', val:'全員 週65h以内'},
         {ok:true, title:'勤務間休息',   val:'インターバル8h確保'},
         {ok:true, title:'連続運転制限', val:'上限まで余裕あり'},
         {ok:true, title:'休憩確保',     val:'30分休憩ルール適合'},
       ]}},
      {rank:2,id:'車両0781',driver:'加藤 八郎',base:'墨田区',avail:'空車',cap:'1,200kg',stars:4,score:76,
       law:{ status:'warn', label:'要確認', items:[
         {ok:false,title:'連続運転制限', val:'連続運転3.6h — あと0.4hで上限'},
         {ok:true, title:'日間運転時間', val:'全員 9h以内'},
         {ok:true, title:'拘束時間',     val:'全員 13h以内'},
         {ok:true, title:'週間上限時間', val:'全員 週65h以内'},
         {ok:true, title:'勤務間休息',   val:'翌日シフト問題なし'},
         {ok:true, title:'休憩確保',     val:'30分休憩ルール適合'},
       ]}},
      {rank:3,id:'車両1099',driver:'田辺 九条',base:'江戸川区',avail:'空車',cap:'800kg',stars:3,score:68,
       law:{ status:'ok', label:'適合', items:[
         {ok:true, title:'日間運転時間', val:'全員 9h以内'},
         {ok:true, title:'拘束時間',     val:'全員 13h以内'},
         {ok:true, title:'週間上限時間', val:'全員 週65h以内'},
         {ok:true, title:'勤務間休息',   val:'インターバル8h確保'},
         {ok:true, title:'連続運転制限', val:'上限まで余裕あり'},
         {ok:true, title:'休憩確保',     val:'30分休憩ルール適合'},
       ]}},
    ]
  },
  { id:'20240524104', status:'処理中', priority:'緊急', casePattern:'チャーター案件', client:'関西化学工業株式会社', from:'東京都品川区', to:'大阪府大阪市', goods:'化学品 / 900kg / 常温', deadline:'05/26 AM', vehicle:'車両2580', driver:'松本 十郎', distance:'540km', selectedVehicleIdx:0,
    vehicleMode:'relay',
    jobId:'J-20240524104-RELAY',
    multiReasons:['長距離での運転手の改善基準対策', '拘束時間の分散'],
    legs:[
      {
        legId:'relay-104-1', legNo:1,
        vehicleId:'車両2580', vehicleName:'車両2580',
        driverName:'松本 十郎',
        capacity:'2,000kg', vehicleType:'4t車',
        role:'relay',
        relayFrom:'東京都品川区',
        relayTo:'愛知県名古屋市',
        startTime:'06:00',
        endTime:'10:30',
        notes:'品川→名古屋（東名高速）',
        vehicleIdx:0, lawOk:true,
      },
      {
        legId:'relay-104-2', legNo:2,
        vehicleId:'車両1245', vehicleName:'車両1245',
        driverName:'山田 一郎',
        capacity:'2,000kg', vehicleType:'4t車',
        role:'relay',
        relayFrom:'愛知県名古屋市',
        relayTo:'大阪府大阪市',
        startTime:'11:00',
        endTime:'14:30',
        notes:'名古屋→大阪（名神高速）',
        vehicleIdx:1, lawOk:true,
      }
    ],
    vehicles:[
      {rank:1,id:'車両2580',driver:'松本 十郎',base:'品川区',avail:'空車',cap:'2,000kg',stars:5,score:93,
       law:{ status:'ok', label:'適合', items:[
         {ok:true, title:'日間運転時間', val:'全員 9h以内'},
         {ok:true, title:'拘束時間',     val:'全員 13h以内'},
         {ok:true, title:'週間上限時間', val:'全員 週65h以内'},
         {ok:true, title:'勤務間休息',   val:'インターバル8h確保'},
         {ok:true, title:'連続運転制限', val:'上限まで余裕あり'},
         {ok:true, title:'休憩確保',     val:'30分休憩ルール適合'},
       ]}},
      {rank:2,id:'車両1872',driver:'高木 十一',base:'大田区',avail:'空車',cap:'2,000kg',stars:4,score:85,
       law:{ status:'warn', label:'要確認', items:[
         {ok:false,title:'連続運転制限', val:'連続運転3.4h — あと0.6hで上限'},
         {ok:true, title:'日間運転時間', val:'全員 9h以内'},
         {ok:true, title:'拘束時間',     val:'全員 13h以内'},
         {ok:true, title:'週間上限時間', val:'全員 週65h以内'},
         {ok:true, title:'勤務間休息',   val:'翌日シフト問題なし'},
         {ok:true, title:'休憩確保',     val:'30分休憩ルール適合'},
       ]}},
      {rank:3,id:'車両0934',driver:'藤田 十二',base:'品川区',avail:'空車',cap:'1,500kg',stars:4,score:77,
       law:{ status:'ok', label:'適合', items:[
         {ok:true, title:'日間運転時間', val:'全員 9h以内'},
         {ok:true, title:'拘束時間',     val:'全員 13h以内'},
         {ok:true, title:'週間上限時間', val:'全員 週65h以内'},
         {ok:true, title:'勤務間休息',   val:'インターバル8h確保'},
         {ok:true, title:'連続運転制限', val:'上限まで余裕あり'},
         {ok:true, title:'休憩確保',     val:'30分休憩ルール適合'},
       ]}},
    ]
  },
  { id:'20240524105', status:'処理中', priority:'通常', casePattern:'特殊条件案件', client:'九州青果株式会社', from:'福岡県福岡市', to:'東京都中央区', goods:'青果物 / 1,200kg / 冷蔵', deadline:'05/25 夕方', vehicle:'未割当', driver:'未割当', distance:'1,100km', selectedVehicleIdx:0,
    vehicleMode:'single', legs:[], multiReasons:[],
    vehicles:[
      {rank:1,id:'車両3301',driver:'山本 十三',base:'福岡市',avail:'空車',cap:'2,000kg',stars:5,score:89,
       law:{ status:'ok', label:'適合', items:[
         {ok:true, title:'日間運転時間', val:'全員 9h以内'},
         {ok:true, title:'拘束時間',     val:'全員 13h以内'},
         {ok:true, title:'週間上限時間', val:'全員 週65h以内'},
         {ok:true, title:'勤務間休息',   val:'インターバル8h確保'},
         {ok:true, title:'連続運転制限', val:'上限まで余裕あり'},
         {ok:true, title:'休憩確保',     val:'30分休憩ルール適合'},
       ]}},
      {rank:2,id:'車両2240',driver:'中島 十四',base:'北九州市',avail:'空車',cap:'2,000kg',stars:4,score:81,
       law:{ status:'ok', label:'適合', items:[
         {ok:true, title:'日間運転時間', val:'全員 9h以内'},
         {ok:true, title:'拘束時間',     val:'全員 13h以内'},
         {ok:true, title:'週間上限時間', val:'全員 週65h以内'},
         {ok:true, title:'勤務間休息',   val:'インターバル8h確保'},
         {ok:true, title:'連続運転制限', val:'上限まで余裕あり'},
         {ok:true, title:'休憩確保',     val:'30分休憩ルール適合'},
       ]}},
      {rank:3,id:'車両4410',driver:'小野 十五',base:'福岡市',avail:'空車',cap:'1,500kg',stars:3,score:72,
       law:{ status:'warn', label:'要確認', items:[
         {ok:false,title:'週間上限時間', val:'今週 61h — あと4hで上限'},
         {ok:true, title:'日間運転時間', val:'全員 9h以内'},
         {ok:true, title:'拘束時間',     val:'全員 13h以内'},
         {ok:true, title:'連続運転制限', val:'上限まで余裕あり'},
         {ok:true, title:'勤務間休息',   val:'インターバル8h確保'},
         {ok:true, title:'休憩確保',     val:'30分休憩ルール適合'},
       ]}},
    ]
  },
  { id:'20240524106', status:'処理中', priority:'通常', casePattern:'特殊条件案件', client:'東北精密機械株式会社', from:'宮城県仙台市', to:'神奈川県川崎市', goods:'精密機械 / 500kg / 精密', deadline:'05/27 AM', vehicle:'未割当', driver:'未割当', distance:'320km', selectedVehicleIdx:0,
    vehicleMode:'single', legs:[], multiReasons:[],
    vehicles:[
      {rank:1,id:'車両5521',driver:'斉藤 十六',base:'仙台市',avail:'空車',cap:'1,500kg',stars:5,score:90,
       law:{ status:'ok', label:'適合', items:[
         {ok:true, title:'日間運転時間', val:'全員 9h以内'},
         {ok:true, title:'拘束時間',     val:'全員 13h以内'},
         {ok:true, title:'週間上限時間', val:'全員 週65h以内'},
         {ok:true, title:'勤務間休息',   val:'インターバル8h確保'},
         {ok:true, title:'連続運転制限', val:'上限まで余裕あり'},
         {ok:true, title:'休憩確保',     val:'30分休憩ルール適合'},
       ]}},
      {rank:2,id:'車両6632',driver:'池田 十七',base:'福島市',avail:'空車',cap:'1,200kg',stars:4,score:84,
       law:{ status:'ok', label:'適合', items:[
         {ok:true, title:'日間運転時間', val:'全員 9h以内'},
         {ok:true, title:'拘束時間',     val:'全員 13h以内'},
         {ok:true, title:'週間上限時間', val:'全員 週65h以内'},
         {ok:true, title:'勤務間休息',   val:'インターバル8h確保'},
         {ok:true, title:'連続運転制限', val:'上限まで余裕あり'},
         {ok:true, title:'休憩確保',     val:'30分休憩ルール適合'},
       ]}},
      {rank:3,id:'車両7743',driver:'木村 十八',base:'仙台市',avail:'空車',cap:'1,000kg',stars:4,score:75,
       law:{ status:'ok', label:'適合', items:[
         {ok:true, title:'日間運転時間', val:'全員 9h以内'},
         {ok:true, title:'拘束時間',     val:'全員 13h以内'},
         {ok:true, title:'週間上限時間', val:'全員 週65h以内'},
         {ok:true, title:'勤務間休息',   val:'インターバル8h確保'},
         {ok:true, title:'連続運転制限', val:'上限まで余裕あり'},
         {ok:true, title:'休憩確保',     val:'30分休憩ルール適合'},
       ]}},
    ]
  },
];

const processedCases = [
  { id:'20240524201-L1', status:'完了', casePattern:'スポット案件', partner: false,
    client:'テスト物流株式会社', from:'東京都品川区', to:'神奈川県横浜市', goods:'パレット / 1,200kg / 常温',
    completion:'2024/05/25 10:00 完了（第1便）', distance:'42km', delay:'なし',
    driver:'山田 一郎', vehicle:'1245',
    vehicleType:'4tウィング', vehicleCap:2000,
    multiCase:true, legNo:1, totalLegs:2, parentId:'20240524201',
    legRole:'main', legReason:'単純な物量超過',
    sales:22500, fuel:8000, other:0, profit:14500, margin:64,
    invoiceNo:'INV-202405-00201', invoiceDate:'2024/05/25', due:'2024/06/30', paid:false,
    progress:50, truckTop:50, progressPct:50, remain:'—', eta:'—', donekm:0,
    billingConfirmed: false
  },
  { id:'20240524201-L2', status:'完了', casePattern:'スポット案件', partner: false,
    client:'テスト物流株式会社', from:'東京都品川区', to:'神奈川県横浜市', goods:'パレット / 1,200kg / 常温',
    completion:'2024/05/25 10:15 完了（第2便）', distance:'42km', delay:'なし',
    driver:'鈴木 次郎', vehicle:'1123',
    vehicleType:'2tトラック', vehicleCap:1000,
    multiCase:true, legNo:2, totalLegs:2, parentId:'20240524201',
    legRole:'sub', legReason:'単純な物量超過',
    sales:22500, fuel:8000, other:0, profit:14500, margin:64,
    invoiceNo:'INV-202405-00201-2', invoiceDate:'2024/05/25', due:'2024/06/30', paid:false,
    progress:50, truckTop:50, progressPct:50, remain:'—', eta:'—', donekm:0,
    billingConfirmed: false
  },
  { id:'20240524001', status:'完了', casePattern:'定期案件', partner: false,
    client:'株式会社○○商事', from:'埼玉県川口市', to:'神奈川県横浜市', goods:'パレット / 800kg / 常温',
    completion:'2024/05/25 09:32', distance:'35km', delay:'なし', driver:'山田 一郎', vehicle:'1245',
    sales:45000, fuel:18000, other:0, profit:27000, margin:60,
    invoiceNo:'INV-202405-00123', invoiceDate:'2024/05/26', due:'2024/06/30', paid:false,
    progress:62, truckTop:50, progressPct:68, remain:'12', eta:'11:15', donekm:23,
    billingConfirmed: true, billingConfirmedAt: '2024/05/27 10:30', billingConfirmedBy: '配車 太郎'
  },
  { id:'20240524100', status:'完了', casePattern:'特殊条件案件', partner: true, partnerName:'北関東物流㈱',
    client:'△△食品株式会社', from:'千葉県船橋市', to:'東京都大田区', goods:'ケース / 500kg / 冷蔵',
    completion:'2024/05/24 15:20', distance:'42km', delay:'なし', driver:'田中 四郎', vehicle:'0887',
    sales:38000, fuel:14000, other:2000, profit:22000, margin:58,
    invoiceNo:'INV-202405-00120', invoiceDate:'2024/05/25', due:'2024/06/25', paid:true,
    progress:45, truckTop:55, progressPct:42, remain:'24', eta:'13:50', donekm:18,
    billingConfirmed: true, billingConfirmedAt: '2024/05/26 14:10', billingConfirmedBy: '配車 太郎',
    purchaseOrderNo:'PO-2024-58234', purchaseOrderTotal:36960,
    purchaseOrderIssuedAt:'2024/05/24 09:15:32',
    purchaseOrderMethod:'銀行振込（月末締め翌月末払い）',
    purchaseOrderRoute:'千葉県船橋市 → 東京都大田区',
    purchaseOrderGoods:'ケース / 500kg / 冷蔵',
    purchaseOrderReceipt:'東京都大田区倉庫Bにて荷受け担当者へ手渡し',
    purchaseOrderPayDue:'2024/06/30'
  },
  { id:'20240523099', status:'完了', casePattern:'スポット案件', partner: false,
    client:'XYZ物産株式会社', from:'東京都品川区', to:'埼玉県さいたま市', goods:'事務用品 / 200kg / 常温',
    completion:'2024/05/23 17:45', distance:'28km', delay:'なし', driver:'鈴木 次郎', vehicle:'1123',
    sales:22000, fuel:9000, other:0, profit:13000, margin:59,
    invoiceNo:'INV-202405-00098', invoiceDate:'2024/05/24', due:'2024/06/24', paid:false,
    progress:78, truckTop:45, progressPct:85, remain:'4', eta:'10:58', donekm:24,
    billingConfirmed: true, billingConfirmedAt: '2024/05/24 18:30', billingConfirmedBy: '配車 太郎'
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ページ・フェーズ切替
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ページ・フェーズ切替
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 案件一覧ナビのトグル（親クリック：子が閉じてれば開く、子ページ表示も）
function toggleCasesNav(e) {
  e && e.stopPropagation();
  var subGroup = document.getElementById('cases-sub-group');
  var navItem  = document.getElementById('nav-cases');
  var isOpen   = subGroup.classList.contains('open');
  if (isOpen) {
    subGroup.classList.remove('open');
    navItem.classList.remove('sub-open');
  } else {
    subGroup.classList.add('open');
    navItem.classList.add('sub-open');
  }
  // 案件一覧ページを表示
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-item-sub').forEach(n => n.classList.remove('active'));
  var pg = document.getElementById('page-cases');
  if (pg) pg.classList.add('active');
  navItem.classList.add('active');
}

// サブページ切替（定期案件登録など）
function showSubPage(name, e) {
  e && e.stopPropagation();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-item-sub').forEach(n => n.classList.remove('active'));
  var pg = document.getElementById('page-' + name);
  if (pg) pg.classList.add('active');
  // 親を半アクティブ（ハイライト）
  var parentNav = document.getElementById('nav-cases');
  if (parentNav) parentNav.classList.add('active');
  var subNav = document.getElementById('nav-sub-' + name);
  if (subNav) subNav.classList.add('active');
}

// 自動反映チェックボックスの有効／無効制御
function checkTeikiAutoReflect() {
  var startDate = (document.getElementById('tf-start-date') || {}).value || '';
  var freq = document.querySelector('input[name="tf-freq"]:checked');
  var cb = document.getElementById('tf-auto-reflect');
  var wrap = document.getElementById('tf-auto-reflect-wrap');
  var label = document.getElementById('tf-auto-reflect-label');
  if (!cb) return;
  var canCheck = startDate !== '' && freq !== null;
  cb.disabled = !canCheck;
  if (wrap) {
    wrap.style.borderColor = canCheck ? '#3BB888' : 'var(--border)';
    wrap.style.background  = canCheck ? '#f8fdfb' : '#fafafa';
  }
  if (label) label.style.cursor = canCheck ? 'pointer' : 'not-allowed';
  // 条件が外れたらチェックも外す
  if (!canCheck && cb.checked) {
    cb.checked = false;
    onTeikiAutoReflectChange(cb);
  }
}

function onTeikiAutoReflectChange(cb) {
  var badge = document.getElementById('tf-auto-reflect-badge');
  var desc  = document.getElementById('tf-auto-reflect-desc');
  var wrap  = document.getElementById('tf-auto-reflect-wrap');
  if (cb.checked) {
    if (badge) badge.style.display = 'inline-block';
    if (wrap)  { wrap.style.borderColor = '#0D4A3A'; wrap.style.background = '#EAF5F0'; }
    if (desc) desc.innerHTML = '運行日の<strong style="color:#0D4A3A">2日前</strong>に自動で個別案件処理（未処理）へ登録されます。';
  } else {
    if (badge) badge.style.display = 'none';
    if (wrap)  { wrap.style.borderColor = '#3BB888'; wrap.style.background = '#f8fdfb'; }
    if (desc) desc.innerHTML = '案件開始日・運行頻度を入力するとチェックできます。<br>有効にすると、運行日の<strong style="color:#374151">2日前</strong>に自動で個別案件処理（未処理）へ登録されます。';
  }
}

// ── パターン別詳細項目定義 ──
var TEIKI_PATTERN_DETAIL = {
  trunk: {
    label: '拠点間定期便',
    fields: [
      { id:'tf-d-load-unit',    label:'積載条件',               placeholder:'例：パレット単位、ケース単位' },
      { id:'tf-d-load-rate',    label:'積載率・最大積載量',     placeholder:'例：最大10t、積載率80%目安' },
      { id:'tf-d-hub',          label:'中継拠点（ハブ）設定',   placeholder:'例：名古屋中継所' },
      { id:'tf-d-route-fix',    label:'定型ルート',             placeholder:'例：A→B→C（順序固定）' },
      { id:'tf-d-roundtrip',    label:'往復運用フラグ',         placeholder:'例：復路貨物あり／なし', type:'select', options:['指定なし','復路貨物あり','復路なし（片道）'] },
      { id:'tf-d-vehicle-fix',  label:'車種固定 or 車格指定',   placeholder:'例：10tウィング固定', type:'select', options:['指定なし','車種固定','車格指定'] },
      { id:'tf-d-leadtime',     label:'リードタイム（標準所要時間）', placeholder:'例：8時間' },
    ]
  },
  store: {
    label: '店舗ルート配送',
    fields: [
      { id:'tf-d-order',        label:'巡回順序',               placeholder:'', type:'select', options:['指定なし','最適順（AI算出）','固定順'] },
      { id:'tf-d-work-time',    label:'1店舗あたり作業時間',   placeholder:'例：20分（荷下ろし・検品含む）' },
      { id:'tf-d-delivery-win', label:'納品時間帯制約（店舗別）', placeholder:'例：8:00〜10:00 開店前納品' },
      { id:'tf-d-open-time',    label:'立ち寄り可能時間帯',     placeholder:'例：営業時間 10:00〜21:00' },
      { id:'tf-d-transfer',     label:'積み替え可否',           placeholder:'', type:'select', options:['指定なし','同一ルート内積み替えあり','積み替えなし'] },
      { id:'tf-d-store-limit',  label:'1便あたり店舗上限数',   placeholder:'例：最大12店舗' },
      { id:'tf-d-return-flag',  label:'返品・回収同時実施',     placeholder:'', type:'select', options:['指定なし','同時実施あり','なし'] },
    ]
  },
  area: {
    label: 'エリア定期配送',
    fields: [
      { id:'tf-d-area-def',     label:'エリア定義',             placeholder:'例：〒140〜145、東京都品川区全域' },
      { id:'tf-d-route-var',    label:'当日ルート可変フラグ',   placeholder:'', type:'select', options:['指定なし','可変あり（AI最適化）','固定ルート'] },
      { id:'tf-d-skip-rule',    label:'スキップ・追加訪問許容ルール', placeholder:'例：不在時スキップ可、翌日補填' },
      { id:'tf-d-density',      label:'配送密度（件数変動上限）', placeholder:'例：1エリア最大30件' },
      { id:'tf-d-priority',     label:'優先度ルール',           placeholder:'例：緊急案件は当日割り込み可' },
      { id:'tf-d-driver-range', label:'ドライバー裁量範囲',     placeholder:'', type:'select', options:['指定なし','順序変更可','順序固定'] },
    ]
  },
  pickup: {
    label: '回収・集荷定期便',
    fields: [
      { id:'tf-d-collect-cond', label:'回収対象条件',           placeholder:'例：段ボール箱・60サイズ以下' },
      { id:'tf-d-container',    label:'容器・資材回収の有無',   placeholder:'', type:'select', options:['指定なし','容器回収あり','なし'] },
      { id:'tf-d-prep',         label:'事前準備要否',           placeholder:'例：梱包済み必須、ラベル貼付' },
      { id:'tf-d-collect-freq', label:'回収頻度',               placeholder:'', type:'select', options:['指定なし','曜日固定','需要連動'] },
      { id:'tf-d-scan',         label:'伝票・スキャン要件',     placeholder:'例：現場にてハンディスキャン必須' },
      { id:'tf-d-weight-limit', label:'積載重量上限（復路）',   placeholder:'例：最大4t（復路積載影響考慮）' },
      { id:'tf-d-check-items',  label:'回収漏れ防止チェック項目', placeholder:'例：個数確認・写真撮影・サイン' },
    ]
  },
  yard: {
    label: '構内・専属定期便',
    fields: [
      { id:'tf-d-zone-rule',    label:'構内動線ルール',         placeholder:'例：第2エリアは立入禁止、Aゲート限定' },
      { id:'tf-d-shift',        label:'作業時間帯（シフト連動）', placeholder:'例：早番 6:00〜14:00 / 遅番 14:00〜22:00' },
      { id:'tf-d-headcount',    label:'常駐人数・固定人員管理', placeholder:'例：常駐2名固定' },
      { id:'tf-d-vehicle-yard', label:'構内車両制限',           placeholder:'例：EV車・電動台車のみ可' },
      { id:'tf-d-safety',       label:'安全教育・資格要件',     placeholder:'例：構内資格証取得者、フォーク免許' },
      { id:'tf-d-work-scope',   label:'作業範囲',               placeholder:'例：荷役・仕分け・検品・棚入れ' },
      { id:'tf-d-kpi-yard',     label:'KPI基準',               placeholder:'例：1時間あたり処理量80件以上' },
    ]
  },
  time: {
    label: '時間帯固定定期便',
    fields: [
      { id:'tf-d-time-win',     label:'時間帯ウィンドウ',       placeholder:'例：10:00〜10:30（許容幅±15分）' },
      { id:'tf-d-sla',          label:'到着SLA（遅延ペナルティ基準）', placeholder:'例：30分超過で報告義務' },
      { id:'tf-d-recovery',     label:'リカバリルート（代替便設定）',  placeholder:'例：遅延時は第2ルート自動割当' },
      { id:'tf-d-deadline',     label:'出発締切時間（デッドライン）',  placeholder:'例：9:30までに出発必須' },
      { id:'tf-d-traffic',      label:'交通影響係数',           placeholder:'例：高速依存大、渋滞係数×1.3' },
      { id:'tf-d-buffer',       label:'バッファ時間設定',       placeholder:'例：積込15分＋待機5分' },
      { id:'tf-d-tracking',     label:'リアルタイム追跡',       placeholder:'', type:'select', options:['指定なし','必須','任意'] },
    ]
  }
};

// パターン選択時に詳細セクションを更新
function renderTeikiPatternDetail(patternVal) {
  var wrap  = document.getElementById('tf-pattern-detail-wrap');
  var title = document.getElementById('tf-detail-title');
  var body  = document.getElementById('tf-detail-body');
  var arrow = document.getElementById('tf-detail-arrow');
  if (!wrap) return;

  var def = TEIKI_PATTERN_DETAIL[patternVal];
  if (!def) { wrap.style.display = 'none'; return; }

  title.textContent = def.label;

  var html = '<div style="display:flex;flex-direction:column;gap:14px">';
  def.fields.forEach(function(f) {
    html += '<div>';
    html += '<label style="display:block;font-size:11px;font-weight:600;color:#374151;margin-bottom:5px">' + f.label + '</label>';
    if (f.type === 'select') {
      html += '<select id="' + f.id + '" style="width:100%;border:1px solid var(--border);border-radius:6px;padding:8px 11px;font-size:12px;font-family:\'Noto Sans JP\',sans-serif;background:#fff;outline:none;cursor:pointer">';
      f.options.forEach(function(o){ html += '<option>' + o + '</option>'; });
      html += '</select>';
    } else {
      html += '<input id="' + f.id + '" type="text" placeholder="' + (f.placeholder||'') + '"'
        + ' style="width:100%;border:1px solid var(--border);border-radius:6px;padding:8px 11px;font-size:12px;font-family:\'Noto Sans JP\',sans-serif;outline:none"'
        + ' onfocus="this.style.borderColor=\'#0D4A3A\'" onblur="this.style.borderColor=\'var(--border)\'">';
    }
    html += '</div>';
  });
  html += '</div>';

  body.innerHTML = html;
  wrap.style.display = 'block';

  // 開いた状態でレンダリング
  body.style.display = 'block';
  if (arrow) arrow.style.transform = 'rotate(180deg)';
}

function toggleTeikiDetail() {
  var body  = document.getElementById('tf-detail-body');
  var arrow = document.getElementById('tf-detail-arrow');
  if (!body) return;
  var open = body.style.display !== 'none';
  body.style.display  = open ? 'none' : 'block';
  if (arrow) arrow.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
}

// 定期案件一覧の絞り込み
function filterTeikiList() {
  var text    = (document.getElementById('teiki-search-text')    || {}).value || '';
  var pattern = (document.getElementById('teiki-search-pattern') || {}).value || '';
  var status  = (document.getElementById('teiki-search-status')  || {}).value || '';
  var auto    = (document.getElementById('teiki-search-auto')    || {}).value || '';
  text = text.trim().toLowerCase();

  var filtered = TEIKI_SAMPLES.map(function(d, i){ return { data: d, idx: i }; }).filter(function(item) {
    var d = item.data;
    // フリーワード
    if (text) {
      var haystack = [(d.name||''), (d.client||''), (d.from||''), (d.to||'')].join(' ').toLowerCase();
      if (haystack.indexOf(text) === -1) return false;
    }
    // パターン
    if (pattern && d.pattern !== pattern) return false;
    // 状態
    if (status === 'active'  && d.stopped) return false;
    if (status === 'stopped' && !d.stopped) return false;
    // 自動反映
    if (auto === 'on'  && !d.autoReflect) return false;
    if (auto === 'off' && d.autoReflect)  return false;
    return true;
  });

  renderTeikiListFiltered(filtered);

  var countEl = document.getElementById('teiki-filter-count');
  if (countEl) countEl.textContent = filtered.length + ' / ' + TEIKI_SAMPLES.length + ' 件';
}

function resetTeikiFilter() {
  ['teiki-search-text','teiki-search-pattern','teiki-search-status','teiki-search-auto'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderTeikiList();
  var countEl = document.getElementById('teiki-filter-count');
  if (countEl) countEl.textContent = '';
}

// 定期案件一覧をテーブルごと描画（絞り込み結果版）
function renderTeikiListFiltered(items) {
  var tbody = document.getElementById('teiki-list-body');
  if (!tbody) return;

  var PATTERN_LABEL = {
    trunk:'拠点間定期便', store:'店舗ルート配送', area:'エリア定期配送',
    pickup:'回収・集荷定期便', yard:'構内・専属定期便', time:'時間帯固定定期便', custom:'カスタム'
  };
  var FREQ_LABEL = { daily:'毎日', weekly:'週次', monthly:'月次', custom:'カスタム' };

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="padding:32px;text-align:center;color:var(--text-muted);font-size:13px">条件に一致する定期案件がありません</td></tr>';
    return;
  }

  tbody.innerHTML = items.map(function(item, i) {
    var data = item.data;
    var idx  = item.idx;
    var stopped    = data.stopped === true;
    var statusBg   = stopped ? '#f3f4f6' : '#EAF5F0';
    var statusColor= stopped ? '#6b7280' : '#0D4A3A';
    var statusText = stopped ? '停止中' : '有効';
    var patLabel   = PATTERN_LABEL[data.pattern] || data.pattern || '—';
    var freqText   = FREQ_LABEL[data.freq] || data.freq || '—';
    var fareText   = data.fare ? '¥' + Number(data.fare).toLocaleString() : '—';
    var fareColor  = stopped ? '#9ca3af' : '#0D4A3A';
    var startText  = data.startDate ? data.startDate.replace(/-/g,'/') : '—';
    var startColor = stopped ? '#9ca3af' : 'var(--text-secondary)';
    var borderStyle= i < items.length - 1 ? 'border-bottom:1px solid var(--border)' : '';

    var genBtn;
    if (stopped) {
      genBtn = '<button disabled style="background:#e5e7eb;border:none;border-radius:5px;padding:4px 12px;font-size:11px;cursor:not-allowed;color:#9ca3af;font-weight:600;white-space:nowrap;width:100%">発生（未処理へ）</button>';
    } else if (data.autoReflect) {
      genBtn = '<button disabled style="background:#EAF5F0;border:1.5px solid #3BB888;border-radius:5px;padding:4px 12px;font-size:11px;cursor:not-allowed;color:#0D4A3A;font-weight:700;white-space:nowrap;width:100%;display:flex;align-items:center;justify-content:center;gap:4px">'
             + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0D4A3A" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>'
             + '自動反映中</button>';
    } else {
      genBtn = '<button onclick="genTeikiCase(' + idx + ')" style="background:var(--accent);border:none;border-radius:5px;padding:4px 12px;font-size:11px;cursor:pointer;color:#fff;font-weight:600;white-space:nowrap;width:100%">発生（未処理へ）</button>';
    }
    var opCell = '<div style="display:flex;flex-direction:column;gap:5px;align-items:flex-start">'
      + '<button onclick="editTeiki(' + idx + ')" style="background:none;border:1px solid var(--border);border-radius:5px;padding:4px 12px;font-size:11px;cursor:pointer;color:var(--text-secondary);white-space:nowrap;width:100%">編集</button>'
      + genBtn + '</div>';

    return '<tr class="teiki-row" style="' + borderStyle + '">'
      + '<td style="padding:12px 16px"><span style="background:' + statusBg + ';color:' + statusColor + ';font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;white-space:nowrap;display:inline-block">' + statusText + '</span></td>'
      + '<td style="padding:12px 16px;font-weight:600">' + (data.name||'—') + '</td>'
      + '<td style="padding:12px 16px"><span class="teiki-pattern-badge" data-pattern="' + (data.pattern||'') + '">' + patLabel + '</span></td>'
      + '<td style="padding:12px 16px;color:var(--text-secondary)">' + (data.client||'—') + '</td>'
      + '<td style="padding:12px 16px;font-family:\'Inter\',sans-serif;color:' + startColor + '">' + startText + '</td>'
      + '<td style="padding:12px 16px;color:var(--text-secondary)">' + (data.from||'—') + ' → ' + (data.to||'—') + '</td>'
      + '<td style="padding:12px 16px"><span style="background:' + (stopped?'#f3f4f6':'#eff6ff') + ';color:' + (stopped?'#6b7280':'var(--blue)') + ';font-size:11px;padding:2px 8px;border-radius:4px">' + freqText + '</span></td>'
      + '<td style="padding:12px 16px;font-family:\'Inter\',sans-serif;font-weight:600;color:' + fareColor + '">' + fareText + '</td>'
      + '<td style="padding:10px 16px">' + opCell + '</td>'
      + '</tr>';
  }).join('');
}

// 定期案件一覧をテーブルごと描画
function renderTeikiList() {
  var tbody = document.getElementById('teiki-list-body');
  if (!tbody) return;

  var PATTERN_LABEL = {
    trunk:'拠点間定期便', store:'店舗ルート配送', area:'エリア定期配送',
    pickup:'回収・集荷定期便', yard:'構内・専属定期便', time:'時間帯固定定期便', custom:'カスタム'
  };
  var FREQ_LABEL = { daily:'毎日', weekly:'週次', monthly:'月次', custom:'カスタム' };

  tbody.innerHTML = TEIKI_SAMPLES.map(function(data, idx) {
    var active  = data.active !== false; // デフォルト有効
    var stopped = data.stopped === true;
    var statusBg   = stopped ? '#f3f4f6' : '#EAF5F0';
    var statusColor= stopped ? '#6b7280' : '#0D4A3A';
    var statusText = stopped ? '停止中' : '有効';

    var patLabel = PATTERN_LABEL[data.pattern] || data.pattern || '—';
    var freqText = FREQ_LABEL[data.freq] || data.freq || '—';
    var fareText = data.fare ? '¥' + Number(data.fare).toLocaleString() : '—';
    var fareColor= stopped ? '#9ca3af' : '#0D4A3A';
    var startText= data.startDate ? data.startDate.replace(/-/g,'/') : '—';
    var startColor=stopped ? '#9ca3af' : 'var(--text-secondary)';
    var borderStyle = idx < TEIKI_SAMPLES.length - 1 ? 'border-bottom:1px solid var(--border)' : '';

    // 操作ボタン
    var genBtn;
    if (stopped) {
      genBtn = '<button disabled style="background:#e5e7eb;border:none;border-radius:5px;padding:4px 12px;font-size:11px;cursor:not-allowed;color:#9ca3af;font-weight:600;white-space:nowrap;width:100%">発生（未処理へ）</button>';
    } else if (data.autoReflect) {
      genBtn = '<button disabled style="background:#EAF5F0;border:1.5px solid #3BB888;border-radius:5px;padding:4px 12px;font-size:11px;cursor:not-allowed;color:#0D4A3A;font-weight:700;white-space:nowrap;width:100%;display:flex;align-items:center;justify-content:center;gap:4px">'
             + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0D4A3A" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>'
             + '自動反映中</button>';
    } else {
      genBtn = '<button onclick="genTeikiCase(' + idx + ')" style="background:var(--accent);border:none;border-radius:5px;padding:4px 12px;font-size:11px;cursor:pointer;color:#fff;font-weight:600;white-space:nowrap;width:100%">発生（未処理へ）</button>';
    }
    var opCell = '<div style="display:flex;flex-direction:column;gap:5px;align-items:flex-start">'
      + '<button onclick="editTeiki(' + idx + ')" style="background:none;border:1px solid var(--border);border-radius:5px;padding:4px 12px;font-size:11px;cursor:pointer;color:var(--text-secondary);white-space:nowrap;width:100%">編集</button>'
      + genBtn + '</div>';

    return '<tr class="teiki-row" style="' + borderStyle + '">'
      + '<td style="padding:12px 16px"><span style="background:' + statusBg + ';color:' + statusColor + ';font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;white-space:nowrap;display:inline-block">' + statusText + '</span></td>'
      + '<td style="padding:12px 16px;font-weight:600">' + (data.name || '—') + '</td>'
      + '<td style="padding:12px 16px"><span class="teiki-pattern-badge" data-pattern="' + (data.pattern||'') + '">' + patLabel + '</span></td>'
      + '<td style="padding:12px 16px;color:var(--text-secondary)">' + (data.client || '—') + '</td>'
      + '<td style="padding:12px 16px;font-family:\'Inter\',sans-serif;color:' + startColor + '">' + startText + '</td>'
      + '<td style="padding:12px 16px;color:var(--text-secondary)">' + (data.from||'—') + ' → ' + (data.to||'—') + '</td>'
      + '<td style="padding:12px 16px"><span style="background:' + (stopped?'#f3f4f6':'#eff6ff') + ';color:' + (stopped?'#6b7280':'var(--blue)') + ';font-size:11px;padding:2px 8px;border-radius:4px">' + freqText + '</span></td>'
      + '<td style="padding:12px 16px;font-family:\'Inter\',sans-serif;font-weight:600;color:' + fareColor + '">' + fareText + '</td>'
      + '<td style="padding:10px 16px">' + opCell + '</td>'
      + '</tr>';
  }).join('');

  // 件数バッジ更新
  var countBadge = document.querySelector('#teiki-tab-list .tab-count');
  if (countBadge) countBadge.textContent = TEIKI_SAMPLES.length;
}
document.addEventListener('DOMContentLoaded', renderTeikiList);

// 定期パターンカード 選択ハンドラ
document.addEventListener('change', function(e) {
  if (e.target && e.target.name === 'tf-pattern') {
    document.querySelectorAll('.teiki-pattern-card').forEach(function(card) {
      card.classList.toggle('selected', card.dataset.val === e.target.value);
    });
    renderTeikiPatternDetail(e.target.value);
  }
});

// ── 取引先オートコンプリート（顧客管理 clientMasterData と連動） ──
function getTeikiClientNames() {
  if (typeof clientMasterData !== 'undefined') {
    return clientMasterData.map(function(c){ return c.name; });
  }
  return [];
}

function showTeikiClientSuggest(val) {
  var box = document.getElementById('tf-client-suggest');
  if (!box) return;
  var names = getTeikiClientNames();
  var q = (val || '').trim();
  var filtered = q === ''
    ? names
    : names.filter(function(n){ return n.indexOf(q) !== -1; });
  if (filtered.length === 0) { box.style.display = 'none'; return; }
  box.innerHTML = filtered.map(function(n) {
    var highlighted = q ? n.replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'g'),
      '<span style="color:#0D4A3A;font-weight:700">$1</span>') : n;
    return '<div class="tf-suggest-item" onmousedown="selectTeikiClient(\'' + n.replace(/'/g,"\\'") + '\')" '
      + 'style="padding:9px 14px;font-size:13px;cursor:pointer;border-bottom:1px solid #f3f4f6;transition:background .1s" '
      + 'onmouseenter="this.style.background=\'#EAF5F0\'" onmouseleave="this.style.background=\'\'">'
      + highlighted + '</div>';
  }).join('');
  box.style.display = 'block';
}

function hideTeikiClientSuggest() {
  var box = document.getElementById('tf-client-suggest');
  if (box) box.style.display = 'none';
}

function selectTeikiClient(name) {
  var inp = document.getElementById('tf-client');
  if (inp) { inp.value = name; inp.style.borderColor = '#0D4A3A'; }
  hideTeikiClientSuggest();
}

// 定期案件モーダル開閉
function openTeikiModal() {
  var overlay = document.getElementById('teiki-modal-overlay');
  if (overlay) { overlay.style.display = 'flex'; }
}
function closeTeikiModal() {
  var overlay = document.getElementById('teiki-modal-overlay');
  if (overlay) { overlay.style.display = 'none'; }
  ['tf-name','tf-from','tf-to','tf-fare','tf-note','tf-start-date','tf-end-date'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  var cb = document.getElementById('tf-auto-reflect');
  if (cb) { cb.checked = false; cb.disabled = true; }
  // チェックボックス周りのUIリセット
  var wrap  = document.getElementById('tf-auto-reflect-wrap');
  var badge = document.getElementById('tf-auto-reflect-badge');
  var desc  = document.getElementById('tf-auto-reflect-desc');
  if (wrap)  { wrap.style.borderColor = 'var(--border)'; wrap.style.background = '#fafafa'; }
  if (badge) badge.style.display = 'none';
  if (desc)  desc.innerHTML = '案件開始日・運行頻度を入力するとチェックできます。<br>有効にすると、運行日の<strong style="color:#374151">2日前</strong>に自動で個別案件処理（未処理）へ登録されます。';
  // パターン詳細リセット
  var detailWrap = document.getElementById('tf-pattern-detail-wrap');
  var detailBody = document.getElementById('tf-detail-body');
  if (detailWrap) detailWrap.style.display = 'none';
  if (detailBody) { detailBody.innerHTML = ''; detailBody.style.display = 'none'; }
  var arrow = document.getElementById('tf-detail-arrow');
  if (arrow) arrow.style.transform = 'rotate(0deg)';
  // ラジオボタンリセット
  document.querySelectorAll('input[name="tf-freq"], input[name="tf-pattern"]').forEach(function(r){ r.checked = false; });
  document.querySelectorAll('.teiki-pattern-card').forEach(function(c){ c.classList.remove('selected'); });
}

// 定期案件ページ内タブ切替（後方互換のため残す）
function switchTeikiTab(tab) {
  if (tab === 'new') { openTeikiModal(); }
  else { closeTeikiModal(); }
}

// 定期案件保存
function saveTeikiCase() {
  var name = (document.getElementById('tf-name') || {}).value || '';
  name = name.trim();
  if (!name) { alert('案件名を入力してください。'); return; }

  var getVal = function(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
  var patternRadio = document.querySelector('input[name="tf-pattern"]:checked');
  var freqRadio    = document.querySelector('input[name="tf-freq"]:checked');
  var autoReflect  = !!(document.getElementById('tf-auto-reflect') || {}).checked;

  // TEIKI_SAMPLES に追加
  TEIKI_SAMPLES.push({
    name:        name,
    pattern:     patternRadio ? patternRadio.value : 'custom',
    client:      getVal('tf-client'),
    from:        getVal('tf-from'),
    to:          getVal('tf-to'),
    freq:        freqRadio ? freqRadio.value : '',
    startDate:   getVal('tf-start-date'),
    endDate:     getVal('tf-end-date'),
    fare:        getVal('tf-fare'),
    vehicle:     getVal('tf-vehicle'),
    note:        getVal('tf-note'),
    autoReflect: autoReflect,
    stopped:     false,
    detail:      {}
  });

  // 一覧を再描画
  renderTeikiList();

  // トースト通知
  var tc = document.querySelector('.toast-container');
  if (tc) {
    var t = document.createElement('div');
    t.className = 'toast toast-success';
    t.innerHTML = '<span class="toast-icon">✅</span> 定期案件「' + name + '」を登録しました';
    tc.appendChild(t);
    setTimeout(function(){ t.remove(); }, 3500);
  }
  closeTeikiModal();
}

// ── サンプル定期案件データ ──
var TEIKI_SAMPLES = [
  {
    name: '東京〜大阪 定期便',
    pattern: 'trunk',
    client: '株式会社サンプル荷主',
    from: '東京都江東区',
    to: '大阪府大阪市',
    freq: 'weekly',
    startDate: '2026-04-01',
    endDate: '',
    fare: '85000',
    vehicle: '10tトラック',
    note: '積み下ろしはフォーク使用。荷受担当者立ち合い必須。',
    autoReflect: true,
    detail: {
      'tf-d-load-unit':   'パレット単位（11枚積み）',
      'tf-d-load-rate':   '最大10t、積載率80%目安',
      'tf-d-hub':         '名古屋中継所（第2倉庫）',
      'tf-d-route-fix':   '東京江東区 → 名古屋 → 大阪（順序固定）',
      'tf-d-roundtrip':   '復路貨物あり',
      'tf-d-vehicle-fix': '車種固定',
      'tf-d-leadtime':    '8時間（標準）'
    }
  },
  {
    name: '横浜〜名古屋 週2便',
    pattern: 'store',
    client: '○○商事株式会社',
    from: '神奈川県横浜市',
    to: '愛知県名古屋市',
    freq: 'weekly',
    startDate: '2026-03-15',
    endDate: '2026-12-31',
    fare: '42000',
    vehicle: '4tトラック',
    note: '店舗ごとに荷量が異なるため、積み付け順に注意。',
    autoReflect: true,
    detail: {
      'tf-d-order':        '固定順',
      'tf-d-work-time':    '20分（荷下ろし・検品含む）',
      'tf-d-delivery-win': '8:00〜10:00（開店前納品）',
      'tf-d-open-time':    '営業時間 10:00〜21:00',
      'tf-d-transfer':     '積み替えなし',
      'tf-d-store-limit':  '最大8店舗',
      'tf-d-return-flag':  '同時実施あり'
    }
  },
  {
    name: '福岡〜広島 月1便',
    pattern: 'time',
    client: '九州輸送株式会社',
    from: '福岡県福岡市',
    to: '広島県広島市',
    freq: 'monthly',
    startDate: '2026-01-06',
    endDate: '',
    fare: '68000',
    vehicle: 'ウィング車',
    note: '高速利用必須。山陽道経由で運行。',
    autoReflect: false,
    detail: {
      'tf-d-time-win':  '10:00〜10:30（許容幅±15分）',
      'tf-d-sla':       '30分超過で報告義務',
      'tf-d-recovery':  '遅延時は第2ルート自動割当',
      'tf-d-deadline':  '9:30までに出発必須',
      'tf-d-traffic':   '山陽道依存大、渋滞係数×1.2',
      'tf-d-buffer':    '積込20分＋待機5分',
      'tf-d-tracking':  '必須'
    }
  }
];

// 定期案件編集
function editTeiki(idx) {
  var data = TEIKI_SAMPLES[idx];
  if (!data) { openTeikiModal(); return; }

  // まずモーダルをリセット状態で開く
  closeTeikiModal();
  openTeikiModal();

  // モーダルタイトル変更
  var titleEl = document.querySelector('#teiki-modal-overlay .tpc-name, #teiki-modal-overlay [style*="font-size:15px"]');

  // 基本項目セット
  setTimeout(function() {
    var set = function(id, val) { var el = document.getElementById(id); if (el) el.value = val || ''; };
    set('tf-name',       data.name);
    set('tf-client',     data.client);
    set('tf-from',       data.from);
    set('tf-to',         data.to);
    set('tf-fare',       data.fare);
    set('tf-vehicle',    data.vehicle);
    set('tf-note',       data.note);
    set('tf-start-date', data.startDate);
    set('tf-end-date',   data.endDate);

    // パターン選択
    var radio = document.querySelector('input[name="tf-pattern"][value="' + data.pattern + '"]');
    if (radio) {
      radio.checked = true;
      document.querySelectorAll('.teiki-pattern-card').forEach(function(card) {
        card.classList.toggle('selected', card.dataset.val === data.pattern);
      });
      renderTeikiPatternDetail(data.pattern);
    }

    // 運行頻度
    var freqRadio = document.querySelector('input[name="tf-freq"][value="' + data.freq + '"]');
    if (freqRadio) freqRadio.checked = true;

    // 自動反映チェックボックス
    checkTeikiAutoReflect();
    var cb = document.getElementById('tf-auto-reflect');
    if (cb && data.autoReflect) {
      cb.checked = true;
      onTeikiAutoReflectChange(cb);
    }

    // パターン詳細フィールドに値をセット（renderTeikiPatternDetail後）
    setTimeout(function() {
      if (data.detail) {
        Object.keys(data.detail).forEach(function(fieldId) {
          var el = document.getElementById(fieldId);
          if (el) el.value = data.detail[fieldId];
        });
      }
    }, 50);
  }, 30);
}

// 定期案件→案件一覧（未処理）へ発生
function genTeikiCase(idx) {
  var data = TEIKI_SAMPLES[idx];
  if (!data) return;

  // 新規IDを生成（現在日時ベース）
  var now = new Date();
  var pad = function(n){ return String(n).padStart(2,'0'); };
  var newId = 'TK' + now.getFullYear() + pad(now.getMonth()+1) + pad(now.getDate())
            + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());

  // unprocessedCases に追加
  unprocessedCases.unshift({
    id: newId,
    status: '未解析',
    client: data.client,
    from: data.from,
    to: data.to,
    goods: '定期案件 / ' + data.name,
    deadline: '定期便',
    ch: 'teiki',
    time: pad(now.getHours()) + ':' + pad(now.getMinutes()),
    analyzed: false,
    casePattern: '定期案件',
    teikiPattern: data.pattern,
    vehicles: []
  });

  // 未処理リスト再描画（案件一覧ページが表示中でなくても更新）
  if (typeof renderUnprocessedList === 'function') renderUnprocessedList();

  // 配車計画表サイドバーバッジを更新（未割当案件数ベース）
  if (typeof updateDispatchNavBadge === 'function') updateDispatchNavBadge();
  var tabCount = document.querySelector('.phase-tab.unprocessed .tab-count');
  if (tabCount) {
    tabCount.textContent = unprocessedCases.length;
    tabCount.removeAttribute('data-zero');
  }

  // トースト通知
  var tc = document.querySelector('.toast-container');
  if (tc) {
    var t = document.createElement('div');
    t.className = 'toast toast-success';
    t.innerHTML = '<span class="toast-icon">📋</span>'
      + '「' + data.name + '」を個別案件処理（未処理）に追加しました'
      + ' <button onclick="showPage_byName(\'cases\')" '
      + 'style="margin-left:8px;background:#0D4A3A;color:#fff;border:none;border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer">確認する</button>';
    tc.appendChild(t);
    setTimeout(function(){ t.remove(); }, 5000);
  }
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  event.currentTarget.classList.add('active');
  if (name === 'dispatch') { setTimeout(renderDispatchContent, 30); }
  if (name === 'fax') { setTimeout(initFaxPage, 30); }
  if (name === 'dashboard') { setTimeout(initDashboard, 80); }
  if (name === 'invoice') { setTimeout(initInvoicePage, 30); }
  if (name === 'vehicle') { setTimeout(initVehiclePage, 30); }
  if (name === 'customer') { setTimeout(function(){ if(window.initCustomerPage) window.initCustomerPage(); }, 30); }
  if (name === 'masters') { setTimeout(function(){ if(window.renderMastersPage) window.renderMastersPage(); }, 30); }
}

// イベントコンテキスト不要版（プログラムから呼び出し用）
function showPage_byName(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  // サイドバーのアクティブ状態を更新
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes("'"+name+"'")) {
      n.classList.add('active');
    }
  });
  if (name === 'dispatch') { setTimeout(renderDispatchContent, 30); }
  if (name === 'fax') { setTimeout(initFaxPage, 30); }
  if (name === 'dashboard') { setTimeout(initDashboard, 80); }
  if (name === 'invoice') { setTimeout(initInvoicePage, 30); }
  if (name === 'vehicle') { setTimeout(initVehiclePage, 30); }
  if (name === 'customer') { setTimeout(function(){ if(window.initCustomerPage) window.initCustomerPage(); }, 30); }
  if (name === 'masters') { setTimeout(function(){ if(window.renderMastersPage) window.renderMastersPage(); }, 30); }
}

// 案件一覧 → 配車計画表へ遷移（タブ指定付き）
// tab: 'planning' (計画中) | 'confirmed' (確定済み)
function gotoDispatch(tab) {
  showPage_byName('dispatch');
  // ページ遷移後に確実にタブ切替が反映されるよう少し遅延を入れる
  setTimeout(function() {
    if (typeof switchDispatchTab === 'function') {
      switchDispatchTab(tab);
    }
  }, 60);
}

function gotoCaseProcessing(phase) {
  showPage_byName('cases');
  // ページ遷移後にフェーズタブ切替を反映
  setTimeout(function() {
    if (typeof switchPhase === 'function') {
      switchPhase(phase || 'processing');
    }
  }, 60);
}

function switchPhase(phase) {
  document.querySelectorAll('.phase-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.phase-content').forEach(c => c.classList.remove('active'));
  document.querySelector('.phase-tab.' + phase).classList.add('active');
  document.getElementById('phase-' + phase).classList.add('active');
  const btn = document.getElementById('btn-new-register');
  if (btn) btn.style.display = phase === 'unprocessed' ? '' : 'none';
  // フェーズ切り替え時に該当リスト・詳細を再描画（ボタン表示状態を正しく反映するため）
  if (phase === 'unprocessed') {
    renderUnprocessedList();
    if (unprocessedCases.length > 0) {
      const selIdx = selectedUnprocessedId
        ? unprocessedCases.findIndex(c => c.id === selectedUnprocessedId)
        : 0;
      renderUnprocessedDetail(selIdx >= 0 ? selIdx : 0);
    }
  } else if (phase === 'processing') {
    renderProcessingList();
    if (processingCases.length > 0) renderProcessingDetail(0);
  } else if (phase === 'processed') {
    renderProcessedList();
    var _pfCases = getFilteredProcessedCases();
    if (_pfCases.length) renderProcessedDetail(processedCases.indexOf(_pfCases[0]));
    else document.getElementById('processed-detail').innerHTML = '';
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  未処理フェーズ描画
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let chFilter = 'all'; // 'all' | 'mail' | 'fax' | 'tel'

// ━━ 未処理：一括選択 & 一括AI解析（処理済みの一括請求と同仕様） ━━
let unprocessedCheckedIds = new Set();

function getFilteredUnprocessedCases() {
  let r = holdFilterUnprocessed ? unprocessedCases.filter(c => c.onHold) : unprocessedCases.slice();
  if (patternFilterUnprocessed !== 'all') r = r.filter(c => c.casePattern === patternFilterUnprocessed);
  if (chFilter !== 'all') r = r.filter(c => c.ch === chFilter);
  return r;
}

function updateUnprocessedSelUI() {
  const cases = getFilteredUnprocessedCases();
  const selCount = cases.filter(c => unprocessedCheckedIds.has(c.id)).length;
  const total = cases.length;
  const allChk = document.getElementById('unprocessed-check-all');
  if (allChk) {
    const allChecked  = total > 0 && cases.every(c => unprocessedCheckedIds.has(c.id));
    const someChecked = cases.some(c => unprocessedCheckedIds.has(c.id));
    allChk.checked = allChecked;
    allChk.indeterminate = !allChecked && someChecked;
  }
  const totalEl = document.getElementById('unprocessed-total-count');
  if (totalEl) totalEl.textContent = total + ' 件';
  const selCountEl = document.getElementById('unprocessed-sel-count');
  if (selCountEl) {
    selCountEl.textContent = selCount + ' 件選択中';
    selCountEl.style.display = selCount > 0 ? 'inline-flex' : 'none';
  }
  const bar = document.getElementById('unprocessed-bulk-bar');
  if (bar) bar.classList.toggle('visible', selCount > 0);
  const barLabel = document.getElementById('unprocessed-bulk-bar-label');
  if (barLabel) barLabel.textContent = selCount + ' 件選択中';
}

function toggleUnprocessedAll(checked) {
  const cases = getFilteredUnprocessedCases();
  if (checked) cases.forEach(c => unprocessedCheckedIds.add(c.id));
  else unprocessedCheckedIds.clear();
  renderUnprocessedList();
}

function toggleUnprocessedOne(id, checked, event) {
  if (event) event.stopPropagation();
  if (checked) unprocessedCheckedIds.add(id);
  else unprocessedCheckedIds.delete(id);
  const card = document.getElementById('ucard-' + id);
  if (card) card.classList.toggle('checked', checked);
  updateUnprocessedSelUI();
}

function clearUnprocessedSelection() {
  unprocessedCheckedIds.clear();
  renderUnprocessedList();
}

// 一括AI解析：選択中の案件を対象にモーダルを開く
function bulkAiAnalyze() {
  const selectedCases = unprocessedCases.filter(c => unprocessedCheckedIds.has(c.id));
  if (!selectedCases.length) {
    showToast('案件が選択されていません', 'info');
    return;
  }
  openBulkAiModal(selectedCases);
}

// 一括AI解析モーダル制御
let _bulkAiCases = [];
let _bulkAiRunning = false;

function openBulkAiModal(cases) {
  _bulkAiCases = cases;
  _bulkAiRunning = false;

  // 解析対象 / スキップ（既に analyzed === true）の振り分け
  const targets  = cases.filter(c => !c.analyzed);
  const skipped  = cases.filter(c =>  c.analyzed);

  // 統計表示
  const tgtEl = document.getElementById('bam-stat-target');
  const skpEl = document.getElementById('bam-stat-skip');
  const dnEl  = document.getElementById('bam-stat-done');
  if (tgtEl) tgtEl.textContent = targets.length;
  if (skpEl) skpEl.textContent = skipped.length;
  if (dnEl)  dnEl.textContent  = 0;

  // サブタイトル
  const sub = document.getElementById('bam-subtitle');
  if (sub) sub.textContent = cases.length + ' 件選択中（解析対象 ' + targets.length + ' 件 / スキップ ' + skipped.length + ' 件）';

  // 対象案件リスト描画
  const listEl = document.getElementById('bam-list');
  const cntEl  = document.getElementById('bam-list-count');
  if (cntEl) cntEl.textContent = cases.length;
  if (listEl) {
    listEl.innerHTML = cases.map((c, i) => {
      const isSkip = c.analyzed;
      return '<div class="bam-list-item ' + (isSkip ? 'skipped' : '') + '" id="bam-item-' + c.id + '">'
        + '<div class="bam-item-status">' + (isSkip ? '−' : (i + 1)) + '</div>'
        + '<div class="bam-item-client">' + c.client + '</div>'
        + '<div class="bam-item-id">' + c.id + '</div>'
        + '</div>';
    }).join('');
  }

  // 解析開始ボタンの有効化
  const startBtn = document.getElementById('bam-start-btn');
  if (startBtn) {
    startBtn.disabled = targets.length === 0;
    startBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>解析を開始（' + targets.length + '件）';
  }
  // プログレス非表示
  const progWrap = document.getElementById('bam-progress-wrap');
  if (progWrap) progWrap.style.display = 'none';
  // info表示
  const info = document.getElementById('bam-info-section');
  if (info) info.style.display = '';

  // モーダル表示
  document.getElementById('bulk-ai-modal').classList.add('open');
}

function closeBulkAiModal() {
  if (_bulkAiRunning) {
    showToast('解析処理を実行中です。完了までお待ちください', 'info');
    return;
  }
  document.getElementById('bulk-ai-modal').classList.remove('open');
}

async function startBulkAiAnalyze() {
  if (_bulkAiRunning) return;
  const targets = _bulkAiCases.filter(c => !c.analyzed);
  if (!targets.length) {
    closeBulkAiModal();
    return;
  }
  _bulkAiRunning = true;

  // UI制御：ボタン無効化、プログレス表示
  const startBtn = document.getElementById('bam-start-btn');
  const cancelBtn = document.getElementById('bam-cancel-btn');
  const closeBtn  = document.querySelector('.bam-close-btn');
  if (startBtn)  { startBtn.disabled = true; startBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>解析中...'; }
  if (cancelBtn) cancelBtn.disabled = true;
  if (closeBtn)  closeBtn.style.opacity = '0.4';
  const info = document.getElementById('bam-info-section');
  if (info) info.style.display = 'none';
  const progWrap = document.getElementById('bam-progress-wrap');
  if (progWrap) progWrap.style.display = '';

  const dnEl = document.getElementById('bam-stat-done');
  const progBar = document.getElementById('bam-progress-bar');
  const progTxt = document.getElementById('bam-progress-text');
  const progCnt = document.getElementById('bam-progress-count');

  let done = 0;
  let errors = 0;

  for (let i = 0; i < targets.length; i++) {
    const c = targets[i];

    // 案件項目を「処理中」に
    const item = document.getElementById('bam-item-' + c.id);
    if (item) {
      item.classList.remove('skipped');
      item.classList.add('processing');
      const st = item.querySelector('.bam-item-status');
      if (st) st.textContent = '…';
    }
    if (progTxt) progTxt.textContent = c.client + ' を解析中...';
    if (progCnt) progCnt.textContent = (i + 1) + ' / ' + targets.length;

    try {
      // 実際の解析処理（runAnalysisと同等の同期処理 + 非同期fareResult）
      await runBulkAiSingle(c);

      // 完了マーク
      if (item) {
        item.classList.remove('processing');
        item.classList.add('done');
        const st = item.querySelector('.bam-item-status');
        if (st) st.innerHTML = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>';
      }
      done++;
    } catch (e) {
      errors++;
      if (item) {
        item.classList.remove('processing');
        item.classList.add('error');
        const st = item.querySelector('.bam-item-status');
        if (st) st.textContent = '!';
      }
    }
    // 統計更新
    if (dnEl) dnEl.textContent = done;
    // プログレスバー
    const pct = ((i + 1) / targets.length) * 100;
    if (progBar) progBar.style.width = pct + '%';
  }

  // 完了
  _bulkAiRunning = false;
  if (progTxt) progTxt.textContent = '✓ ' + done + ' 件の解析が完了しました' + (errors > 0 ? '（エラー ' + errors + ' 件）' : '');
  if (progBar) progBar.style.width = '100%';
  if (startBtn) {
    startBtn.disabled = false;
    startBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>閉じる';
    startBtn.onclick = function() {
      closeBulkAiModal();
      // ボタンを元に戻す（次回モーダルオープン時に再設定される）
      startBtn.onclick = startBulkAiAnalyze;
      // 選択解除＆リスト再描画
      clearUnprocessedSelection();
    };
  }
  if (cancelBtn) cancelBtn.disabled = false;
  if (closeBtn)  closeBtn.style.opacity = '';

  showToast(done + ' 件のAI解析が完了しました', 'success');

  // 未処理リストを更新
  renderUnprocessedList();
  if (selectedUnprocessedId) {
    const idx = unprocessedCases.findIndex(c => c.id === selectedUnprocessedId);
    if (idx >= 0) renderUnprocessedDetail(idx);
  }
}

// 単一案件のAI解析（runAnalysisのロジックを抽出）
function runBulkAiSingle(c) {
  return new Promise((resolve) => {
    // 解析処理（同期パート）
    c.analyzed = true;
    c.status = '未解析';
    c.fareResult = null;
    c.casePattern = autoDetectPattern(c);
    if (!c.aiResult) {
      c.aiResult = {
        confidence:'中信頼度', client:c.client,
        from:c.from, to:c.to,
        goods:c.goods, deadline:c.deadline,
        conditions:'特になし', vehicle:'2tトラック', count:1
      };
    }
    if (!c.vehicles || !c.vehicles.length) {
      c.vehicles = [
        {rank:1,id:'車両0771',driver:'高橋 七郎',base:'近隣',avail:'空車',cap:'2,000kg',stars:4,score:80}
      ];
    }

    // 解析っぽい待ち時間（疑似処理時間：400〜800ms）
    const delay = 400 + Math.random() * 400;
    setTimeout(() => {
      // 運賃判定（非同期）
      if (typeof calcFare === 'function') {
        calcFare(c).then(fareResult => {
          c.fareResult = fareResult;
          resolve();
        }).catch(() => resolve());
      } else {
        resolve();
      }
    }, delay);
  });
}

function setChFilter(ch) {
  chFilter = ch;
  ['all','mail','fax','tel'].forEach(k => {
    const btn = document.getElementById('ch-filter-' + k);
    if (btn) btn.classList.toggle('active', k === ch);
  });
  renderUnprocessedList();
}

function renderUnprocessedList() {
  const el = document.getElementById('unprocessed-list');
  let filtered = holdFilterUnprocessed ? unprocessedCases.filter(c => c.onHold) : unprocessedCases;
  if (patternFilterUnprocessed !== 'all') filtered = filtered.filter(c => c.casePattern === patternFilterUnprocessed);
  if (chFilter !== 'all') filtered = filtered.filter(c => c.ch === chFilter);

  // チャネルごとのラベル
  function chBadge(ch) {
    if (ch === 'mail') return '<span class="ch-badge mail"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>メール</span>';
    if (ch === 'fax')  return '<span class="ch-badge fax"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>FAX</span>';
    if (ch === 'tel')  return '<span class="ch-badge tel"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.63 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16z"/></svg>電話</span>';
    if (ch === 'teiki') return '<span class="ch-badge" style="background:#EAF5F0;color:#0D4A3A;border-color:#3BB888"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>定期</span>';
    return '<span class="ch-badge other">その他</span>';
  }

  el.innerHTML = filtered.map(function(c) {
    const idx = unprocessedCases.indexOf(c);
    const cid = c.id;
    const holdChip = c.onHold ? '<span class="badge-hold">&#9646; 仮押さえ</span>' : '';
    const statusCls = c.status === '未解析' ? 'badge-unanalyzed' : 'badge-checking';
    const actionBtn = c.analyzed
      ? '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openMatchingModal(' + idx + ')">マッチングへ</button>'
      : '<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();runAnalysis(' + idx + ')">AI解析</button>';
    const fromCls = c.ch === 'mail' ? ' from-mail' : c.ch === 'fax' ? ' from-fax' : '';
    const fromBanner = (c.ch === 'mail' || c.ch === 'fax')
      ? '<div style="display:flex;align-items:center;gap:5px;padding:4px 8px;margin:-2px -2px 6px;border-radius:4px 4px 0 0;background:' + (c.ch==='mail' ? '#eff6ff' : '#fffbeb') + ';border-bottom:1px solid ' + (c.ch==='mail' ? '#bfdbfe' : '#fde68a') + '">'
        + chBadge(c.ch)
        + '<span style="font-size:10px;color:' + (c.ch==='mail' ? '#1d4ed8' : '#92400e') + ';font-weight:600">メール・FAX受付から取り込み</span>'
        + '</div>'
      : '';
    const pat = c.casePattern ? CASE_PATTERNS[c.casePattern] : null;
    const patMini = pat
      ? '<span class="case-pattern-mini" style="background:' + pat.bgColor + ';color:' + pat.color + ';border-color:' + pat.borderColor + '">' + pat.icon + ' ' + pat.id + '</span>'
      : '';
    const isSelected = String(cid) === String(selectedUnprocessedId);
    const isChecked  = unprocessedCheckedIds.has(cid);
    return '<div class="case-card with-check' + fromCls + (isSelected?' selected':'') + (isChecked?' checked':'') + '" onclick="selectUnprocessed(\'' + cid + '\')" data-case-id="' + cid + '" id="ucard-' + cid + '">'
      + '<div class="case-card-check">'
      + '<input type="checkbox"' + (isChecked ? ' checked' : '')
      + ' onclick="event.stopPropagation()"'
      + ' onchange="toggleUnprocessedOne(\'' + cid + '\',this.checked,event)">'
      + '</div>'
      + fromBanner
      + '<div class="case-card-header">'
        + '<span class="case-no">No. ' + c.id + '</span>'
        + '<div style="display:flex;gap:4px;align-items:center;margin-left:auto;flex-wrap:wrap">'
          + holdChip
          + patMini
          + chBadge(c.ch)
          + '<span class="case-status-badge ' + statusCls + '">' + c.status + '</span>'
        + '</div>'
      + '</div>'
      + '<div class="case-client">' + c.client + '</div>'
      + '<div class="case-route">'
        + '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>'
        + c.from + ' → ' + c.to
      + '</div>'
      + '<div class="case-meta">'
        + '<div class="case-meta-item">📦 ' + c.goods + '</div>'
        + '<div class="case-meta-item">🕐 納品：' + c.deadline + '</div>'
      + '</div>'
      + '<div class="case-actions-mini">'
        + actionBtn
        + '<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();selectUnprocessed(\'' + cid + '\')">確認・編集</button>'
      + '</div>'
    + '</div>';
  }).join('') || '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">該当する案件はありません</div>';
  updateUnprocessedSelUI();
}
let selectedUnprocessedId = null;

function selectUnprocessed(caseId) {
  selectedUnprocessedId = caseId;
  document.querySelectorAll('#unprocessed-list .case-card').forEach(el => {
    el.classList.toggle('selected', el.dataset.caseId === String(caseId));
  });
  const idx = unprocessedCases.findIndex(c => c.id === caseId);
  if (idx !== -1) renderUnprocessedDetail(idx);
}

// 後方互換：インデックスでも呼べるようにするラッパー
function selectUnprocessedByIdx(idx) {
  const c = unprocessedCases[idx];
  if (c) selectUnprocessed(c.id);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  案件パターン ヘルパー（グローバル）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderPatternFlag(pattern, isEdit, caseIdx) {
  const p = CASE_PATTERNS[pattern] || null;
  if (isEdit) {
    const opts = Object.keys(CASE_PATTERNS).map(k =>
      `<option value="${k}" ${k===pattern?'selected':''}>${CASE_PATTERNS[k].icon} ${k}</option>`
    ).join('');
    return `<select class="pattern-select" id="pattern-select-${caseIdx}" onchange="updateCasePattern(${caseIdx},this.value)">${opts}</select>`;
  }
  if (!p) return '<span style="font-size:11px;color:var(--text-muted)">未設定</span>';
  return `<div class="pattern-flag-wrap">
    <span class="pattern-flag" style="background:${p.bgColor};color:${p.color};border-color:${p.borderColor}">${p.icon} ${p.id}</span>
    <div class="pattern-tip">
      <div class="pattern-tip-title">${p.icon} ${p.id}</div>
      <div class="pattern-tip-logic">📌 ${p.logic}</div>
      <div class="pattern-tip-data">🗂 必要データ：${p.requiredData}</div>
    </div>
  </div>`;
}

function getPatternDispatchReason(caseObj, v, patternId) {
  switch(patternId) {
    case '定期案件':     return `継続担当・信頼性 ★${v.stars}`;
    case 'スポット案件': return `空車回送距離 最小化・粗利最大`;
    case 'チャーター案件': return `拘束時間残余 十分確保済み`;
    case '緊急案件':     return `ETA最短・リアルタイム最近傍`;
    case '多地点配送':   return `積載率 最適・ルート効率 ◎`;
    case '特殊条件案件': return `資格・設備 条件適合 ✓`;
    default:             return `AIスコア ${v.score}点`;
  }
}

function renderPatternRecommend(caseObj, caseIdx) {
  const vehicles = (typeof getVehiclesForCase === 'function' ? getVehiclesForCase(caseObj) : null) || caseObj.vehicles || [];
  if (!vehicles.length) return '';
  const p = caseObj.casePattern ? CASE_PATTERNS[caseObj.casePattern] : null;
  const patLabel = p ? `${p.icon} ${p.id}` : '案件パターン別';
  const patColor = p ? p.color : '#0D4A3A';
  const patBg    = p ? p.bgColor : '#EAF5F0';

  const vcards = vehicles.slice(0, 3).map((v, ri) => {
    const rankBg    = ri === 0 ? 'var(--sidebar-bg)' : '#f1f5f9';
    const rankColor = ri === 0 ? '#6DD5A8' : '#64748b';
    const reason    = p ? getPatternDispatchReason(caseObj, v, p.id) : `AIスコア ${v.score}点`;
    return `<div class="vcard ${ri===0?'vcard-top':''}" style="${ri===0?'border-color:'+patColor+';background:linear-gradient(135deg,'+patBg+' 0%,#fff 100%)':''}">
      ${ri===0 ? `<div class="vcard-recommend-badge" style="background:${patColor}">${patLabel} 最適解</div>` : ''}
      <div class="vcard-rank" style="background:${rankBg};color:${rankColor}">${ri+1}</div>
      <div class="vcard-info">
        <div class="vcard-driver">${v.driver}</div>
        <div class="vcard-vehicle">${v.id}</div>
        <div class="vcard-tags">
          <span class="vcard-tag vcard-tag-base">${v.base}</span>
          <span class="vcard-tag vcard-tag-cap">${v.cap}</span>
          <span class="vcard-tag vcard-tag-avail">${v.avail}</span>
        </div>
        <div style="font-size:10px;color:${patColor};font-weight:600;margin-top:4px;background:${patBg};padding:3px 7px;border-radius:5px;display:inline-block">${reason}</div>
      </div>
      <div class="vcard-right">
        <div class="vcard-score" style="color:${ri===0?patColor:'var(--sidebar-bg)'}">${v.score}</div>
        <div class="vcard-score-label">AIスコア</div>
        <div class="vcard-stars">${'★'.repeat(v.stars)}${'☆'.repeat(5-v.stars)}</div>
      </div>
    </div>`;
  }).join('');

  return `<div class="pattern-recommend-card">
    <div class="pattern-recommend-header">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${patColor}" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
      <div class="pattern-recommend-title">配車AIレコメンド（${patLabel}）</div>
      <span style="margin-left:auto;font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:${patBg};color:${patColor}">パターン最適化</span>
    </div>
    <div class="pattern-recommend-desc">${p ? p.dispatchLogic : '案件条件に基づいた最適配車を提案します。'}</div>
    <div class="vcard-list">${vcards}</div>
  </div>`;
}

function renderUnprocessedDetail(i) {
  const c = unprocessedCases[i];
  const el = document.getElementById('unprocessed-detail');
  if (!c) { el.innerHTML = ''; return; }

  const pat = c.casePattern ? CASE_PATTERNS[c.casePattern] : null;

  const barsHtml = Array.from({length:32}, (_,k) => {
    const h = 8 + Math.sin(k*0.7)*10 + Math.random()*12;
    return `<div class="waveform-bar" style="height:${Math.max(4,h)}px"></div>`;
  }).join('');

  let vehicleRows = '';
  const cVehicles = (typeof getVehiclesForCase === 'function' ? getVehiclesForCase(c) : null) || c.vehicles || [];
  if (cVehicles.length) {
    // Phase 1c：案件の発地から推定した拠点を参照拠点とする
    const caseBaseId = typeof window.resolveBaseIdByAlias === 'function'
      ? window.resolveBaseIdByAlias(c.from) : null;

    vehicleRows = cVehicles.map((v,ri) => {
      // クロス配車判定（v.base 文字列を baseId に変換）
      const vBaseId = typeof window.resolveBaseIdByAlias === 'function'
        ? window.resolveBaseIdByAlias(v.base) : null;
      const isCross = caseBaseId && vBaseId && caseBaseId !== vBaseId;
      const dist = isCross && typeof window.getBaseDistance === 'function'
        ? window.getBaseDistance(caseBaseId, vBaseId) : null;
      const crossMark = isCross
        ? `<span title="クロス配車${dist != null ? `（${dist}km）` : ''}" style="display:inline-flex;align-items:center;gap:3px;font-size:10px;color:#c2410c;background:#fff7ed;border:1px solid #fdba74;padding:1px 5px;border-radius:6px;margin-left:6px;font-weight:700"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>${dist != null ? `${dist}km` : ''}</span>`
        : '';
      return `
      <tr class="${ri===0?'vehicle-row-selected':''}">
        <td><div class="vehicle-rank rank-${v.rank}">${v.rank}</div></td>
        <td><span style="font-family:'Inter',sans-serif;font-weight:600">${v.id}</span></td>
        <td>${v.driver}</td>
        <td>${v.base}${crossMark}</td>
        <td><span class="avail-badge avail-ok">${v.avail}</span></td>
        <td>${v.cap}</td>
        <td><span class="star-rating">${'★'.repeat(v.stars)}${'☆'.repeat(5-v.stars)}</span></td>
        <td><span class="ai-score score-high">${v.score}</span></td>
      </tr>
    `;
    }).join('');
  } else {
    vehicleRows = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-muted)">AI解析後に候補車両が表示されます</td></tr>';
  }

  el.innerHTML = `
    ${(c.ch === 'mail' || c.ch === 'fax') ? `
    <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;margin-bottom:14px;background:${c.ch==='mail'?'#eff6ff':'#fffbeb'};border:1px solid ${c.ch==='mail'?'#bfdbfe':'#fde68a'};border-radius:8px">
      <span style="font-size:18px">${c.ch==='mail'?'✉️':'📠'}</span>
      <div>
        <div style="font-size:12px;font-weight:700;color:${c.ch==='mail'?'#1d4ed8':'#92400e'}">メール・FAX受付から取り込んだ案件</div>
        <div style="font-size:11px;color:${c.ch==='mail'?'#3b82f6':'#d97706'};margin-top:1px">${c.ch==='mail'?'✉️ メール受信':'📠 FAX受信'}からAIが自動データ化しました</div>
      </div>
      <span class="ch-badge ${c.ch}" style="margin-left:auto">${c.ch==='mail'?'メール':'FAX'}</span>
    </div>
    ` : ''}

    ${c.analyzed ? `
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn btn-outline btn-sm" id="hold-btn-u-${i}" onclick="toggleHold(${i},'unprocessed')">${c.onHold ? "✓ 仮押さえ中" : "仮押さえ"}</button>
      <button class="btn btn-primary" onclick="openMatchingModal(${i})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/></svg>
        マッチングへ
      </button>
      <button class="btn btn-secondary btn-sm" onclick="openPartnerModal(${i},'unprocessed')">協力会社へ依頼</button>
      <button onclick="startPartnerGuide('unprocessed',${i})" title="協力会社依頼ガイドを開始" style="width:26px;height:26px;border-radius:50%;border:none;background:var(--accent);color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s;box-shadow:0 1px 4px rgba(59,184,136,0.4);align-self:center" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8" stroke-width="3" stroke-linecap="round"/><line x1="12" y1="12" x2="12" y2="16"/></svg>
      </button>
    </div>
    ` : `
    <div style="margin-bottom:16px">
      <button class="btn btn-primary" style="width:100%;justify-content:center;padding:12px;font-size:13px;gap:8px" onclick="runAnalysis(${i})">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 8v4l3 3"/></svg>
        AI解析を実行
      </button>
      <div style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:6px">取引先・発地・着地・荷物情報などを自動抽出します</div>
    </div>
    `}

    <!-- ━━ 案件パターン行 ━━ -->
    <div class="detail-card" style="margin-bottom:14px">
      <div class="detail-card-header" style="background:${pat ? pat.bgColor : '#f8fafc'}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${pat ? pat.color : '#6b7280'}" stroke-width="2"><path d="M7 7h10M7 12h10M7 17h10"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
        <div class="detail-card-title" style="color:${pat ? pat.color : 'var(--text-primary)'}">案件パターン</div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
          ${renderPatternFlag(c.casePattern, false, i)}
          <button class="btn btn-secondary btn-sm" style="font-size:10px;padding:3px 8px" onclick="togglePatternEdit(${i})">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            変更
          </button>
        </div>
      </div>
      <div id="pattern-edit-row-${i}" style="display:none;padding:10px 14px;background:#fafff8;border-top:1px solid #d1fae5;display:none">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="font-size:11px;font-weight:600;color:var(--text-secondary)">パターンを選択：</span>
          ${renderPatternFlag(c.casePattern, true, i)}
          <button class="btn btn-primary btn-sm" style="font-size:10px" onclick="savePatternEdit(${i})">保存</button>
          <button class="btn btn-secondary btn-sm" style="font-size:10px" onclick="cancelPatternEdit(${i})">キャンセル</button>
        </div>
      </div>
    </div>

    ${c.analyzed ? `
    <div class="detail-card" id="ai-result-card-${i}">
      <div class="detail-card-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 8v4l3 3"/></svg>
        <div class="detail-card-title">AI抽出結果</div>
        <span class="detail-card-badge badge-high" style="margin-left:auto">${c.aiResult.confidence}</span>
        ${c.aiResult.edited ? '<span class="ai-edit-badge">編集済み</span>' : ''}
        <button class="btn btn-secondary btn-sm" style="margin-left:8px" onclick="toggleAiEdit(${i})">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          編集
        </button>
      </div>
      <div class="detail-card-body" id="ai-view-${i}">
        <div class="info-grid">
          <div class="info-item"><div class="info-label">取引先</div><div class="info-value">${c.aiResult.client}</div></div>
          <div class="info-item"><div class="info-label">発地</div><div class="info-value">${c.aiResult.from}</div></div>
          <div class="info-item"><div class="info-label">着地</div><div class="info-value">${c.aiResult.to}</div></div>
          <div class="info-item"><div class="info-label">荷物</div><div class="info-value">${c.aiResult.goods}</div></div>
          <div class="info-item"><div class="info-label">納期</div><div class="info-value">${c.aiResult.deadline}</div></div>
          <div class="info-item"><div class="info-label">条件・備考</div><div class="info-value">${c.aiResult.conditions}</div></div>
          <div class="info-item"><div class="info-label">車格（推定）</div><div class="info-value">${c.aiResult.vehicle}</div></div>
          <div class="info-item"><div class="info-label">必要台数</div><div class="info-value">${c.aiResult.count}台</div></div>
        </div>
      </div>
      <div class="detail-card-body" id="ai-edit-${i}" style="display:none;background:#fafff8;border-top:1px solid #d1fae5">
        <div style="font-size:11px;color:#065f46;font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:5px">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          AI抽出内容を修正できます。変更後「保存」を押してください。
        </div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">取引先</div>
            <input class="ai-edit-input" id="ae-client-${i}" value="${c.aiResult.client}">
          </div>
          <div class="info-item">
            <div class="info-label">発地</div>
            <input class="ai-edit-input" id="ae-from-${i}" value="${c.aiResult.from}">
          </div>
          <div class="info-item">
            <div class="info-label">着地</div>
            <input class="ai-edit-input" id="ae-to-${i}" value="${c.aiResult.to}">
          </div>
          <div class="info-item">
            <div class="info-label">荷物</div>
            <input class="ai-edit-input" id="ae-goods-${i}" value="${c.aiResult.goods}">
          </div>
          <div class="info-item">
            <div class="info-label">納期</div>
            <input class="ai-edit-input" id="ae-deadline-${i}" value="${c.aiResult.deadline}">
          </div>
          <div class="info-item">
            <div class="info-label">条件・備考</div>
            <input class="ai-edit-input" id="ae-conditions-${i}" value="${c.aiResult.conditions}">
          </div>
          <div class="info-item">
            <div class="info-label">車格（推定）</div>
            <select class="ai-edit-select" id="ae-vehicle-${i}">
              ${['軽バン','2tトラック','4tウィング','10tトラック','トレーラー'].map(v=>`<option value="${v}" ${c.aiResult.vehicle===v?'selected':''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="info-item">
            <div class="info-label">必要台数</div>
            <input class="ai-edit-input" id="ae-count-${i}" type="number" min="1" max="10" value="${c.aiResult.count}" style="width:80px">
          </div>
        </div>
        <div class="ai-edit-actions">
          <button class="btn btn-primary" onclick="saveAiEdit(${i})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            保存
          </button>
          <button class="btn btn-secondary" onclick="cancelAiEdit(${i})">キャンセル</button>
          <button class="btn btn-secondary btn-sm" style="margin-left:auto;color:var(--text-muted)" onclick="resetAiEdit(${i})">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.85"/></svg>
            AI解析値に戻す
          </button>
        </div>
      </div>
    </div>

    ${renderCaseScheduleTimeline(c)}
    ` : `
    <div class="detail-card">
      <div class="detail-card-header">
        <div class="detail-card-title">案件情報</div>
        <span class="detail-card-badge badge-medium" style="margin-left:auto">${c.status}</span>
      </div>
      <div class="detail-card-body">
        <div class="info-grid">
          <div class="info-item"><div class="info-label">取引先</div><div class="info-value">${c.client}</div></div>
          <div class="info-item"><div class="info-label">発地</div><div class="info-value">${c.from}</div></div>
          <div class="info-item"><div class="info-label">着地</div><div class="info-value">${c.to}</div></div>
          <div class="info-item"><div class="info-label">荷物</div><div class="info-value">${c.goods}</div></div>
          <div class="info-item"><div class="info-label">納期</div><div class="info-value">${c.deadline}</div></div>
        </div>
      </div>
    </div>

    ${renderCaseScheduleTimeline(c)}
    `}

    <!-- ━━ パターン別 配車AIレコメンド ━━ -->
    ${renderPatternRecommend(c, i)}

    ${c.analyzed && c.fareResult ? `
    <div class="fare-card" id="fare-card-${i}">
      <div class="fare-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        <div class="fare-title">運賃適正判定（AI）</div>
        <span class="fare-status ${c.fareResult.statusClass}" style="margin-left:auto">${c.fareResult.statusIcon} ${c.fareResult.statusLabel}</span>
      </div>
      <div class="fare-body">

        <!-- 推奨価格 -->
        <div class="fare-hero">
          <div class="fare-price">¥${c.fareResult.recommend.toLocaleString()}</div>
          <div class="fare-unit">推奨提示価格</div>
        </div>
        <div class="fare-range">相場レンジ：¥${c.fareResult.min.toLocaleString()} 〜 ¥${c.fareResult.max.toLocaleString()}</div>

        <!-- コスト内訳 -->
        <div class="fare-breakdown" style="margin-top:14px">
          <div class="fare-breakdown-title">📊 コスト内訳（積み上げ計算）</div>
          ${c.fareResult.costs.map(cost => `
          <div class="fare-bar-row">
            <div class="fare-bar-label">${cost.label}</div>
            <div class="fare-bar-wrap"><div class="fare-bar-fill" style="width:${cost.pct}%;background:${cost.color}"></div></div>
            <div class="fare-bar-val">¥${cost.val.toLocaleString()}</div>
          </div>`).join('')}
          <div style="border-top:1px dashed var(--border);margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-size:12px;font-weight:700">
            <span>原価合計</span>
            <span style="font-family:'Inter',sans-serif;color:var(--sidebar-bg)">¥${c.fareResult.totalCost.toLocaleString()}</span>
          </div>
        </div>

        <!-- 相場比較 -->
        <div class="fare-breakdown-title">📈 市場相場比較</div>
        <div class="fare-market">
          <div class="fare-market-item"><div class="fare-market-label">相場 下限</div><div class="fare-market-val low">¥${c.fareResult.min.toLocaleString()}</div></div>
          <div class="fare-market-item" style="border-color:var(--accent)"><div class="fare-market-label">相場 平均</div><div class="fare-market-val mid">¥${c.fareResult.avg.toLocaleString()}</div></div>
          <div class="fare-market-item"><div class="fare-market-label">相場 上限</div><div class="fare-market-val high">¥${c.fareResult.max.toLocaleString()}</div></div>
        </div>

        <!-- 提案パターン -->
        <div class="fare-breakdown-title">💡 価格提案パターン</div>
        <div class="fare-proposals">
          ${c.fareResult.proposals.map((p,pi) => `
          <div class="fare-proposal ${pi===0?'selected':''}" onclick="selectFareProposal(this)">
            <span class="fare-proposal-tag ${p.tagClass}">${p.tag}</span>
            <div class="fare-proposal-detail">${p.detail}</div>
            <div class="fare-proposal-price">¥${p.price.toLocaleString()}</div>
          </div>`).join('')}
        </div>

        <!-- AI根拠 -->
        <div style="margin-top:12px;background:#f8fafc;border-radius:8px;padding:10px 12px;font-size:11px;color:var(--text-secondary);line-height:1.7;border:1px solid var(--border)">
          <span style="font-weight:600;color:var(--sidebar-bg)">🤖 AI判定根拠：</span>${c.fareResult.reason}
        </div>
      </div>
    </div>
    ` : c.analyzed ? `<div class="fare-card"><div class="fare-loading"><div class="fare-loading-spinner"></div>運賃適正判定を計算中...</div></div>` : ''}

    <div class="detail-card">
      <div class="detail-card-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07"/></svg>
        <div class="detail-card-title">録音（電話）</div>
      </div>
      <div class="detail-card-body">
        <div class="audio-player">
          <button class="audio-play-btn">▶</button>
          <div class="waveform">${barsHtml}</div>
          <span class="audio-time">00:00 / 00:45</span>
          <span class="audio-speed">1.0x</span>
        </div>
        <div style="margin-top:8px;display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm">メモを追加</button>
          <button class="btn btn-secondary btn-sm">文字起こしを見る</button>
        </div>
      </div>
    </div>

  `;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  案件パターン 自動判定（共通）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function autoDetectPattern(caseObj) {
  const g    = (caseObj.goods        || '').toLowerCase();
  const note = (caseObj.conditions   || (caseObj.aiResult?.conditions) || '').toLowerCase();
  const dl   = (caseObj.deadline     || '').toLowerCase();
  const cli  = (caseObj.client       || '').toLowerCase();
  const from = (caseObj.from         || '').toLowerCase();
  const to   = (caseObj.to           || '').toLowerCase();

  // 特殊条件：冷蔵・冷凍・危険物・資格・免許・フォーク・温度管理
  if (g.includes('冷蔵') || g.includes('冷凍') || g.includes('冷却') ||
      g.includes('危険') || g.includes('薬品') || g.includes('生鮮') ||
      note.includes('フォーク') || note.includes('免許') || note.includes('資格') ||
      note.includes('冷蔵') || note.includes('温度') || note.includes('危険')) {
    return '特殊条件案件';
  }
  // 緊急：緊急・至急・当日・即日
  if (note.includes('緊急') || note.includes('至急') || note.includes('即日') ||
      dl.includes('当日') || dl.includes('本日') || caseObj.priority === '緊急') {
    return '緊急案件';
  }
  // 多地点：複数配送先・複数住所・複数箇所
  if (note.includes('複数') || note.includes('多地点') || note.includes('巡回') ||
      note.includes('複数箇所') || (caseObj.destinations && caseObj.destinations.length > 1)) {
    return '多地点配送';
  }
  // チャーター：チャーター・丸一日・終日・長距離（200km超）
  if (note.includes('チャーター') || note.includes('終日') || note.includes('丸一日') ||
      dl.includes('終日') || (from && to && isLongDistance(from, to))) {
    return 'チャーター案件';
  }
  // 定期：定期・毎週・毎月・固定
  if (note.includes('定期') || note.includes('毎週') || note.includes('毎月') ||
      note.includes('固定') || dl.includes('定期') || cli.includes('定期')) {
    return '定期案件';
  }
  // デフォルト：スポット
  return 'スポット案件';
}

function isLongDistance(from, to) {
  const farPairs = [
    ['東京','大阪'],['東京','京都'],['東京','神戸'],['東京','名古屋'],
    ['東京','福岡'],['東京','仙台'],['東京','札幌'],
    ['埼玉','大阪'],['千葉','大阪'],['神奈川','大阪'],
    ['大阪','仙台'],['大阪','札幌'],['名古屋','福岡'],
  ];
  for (const [a, b] of farPairs) {
    if ((from.includes(a) && to.includes(b)) || (from.includes(b) && to.includes(a))) return true;
  }
  return false;
}


function runAnalysis(i) {
  showToast('AI解析を開始しました...', 'success');
  const c = unprocessedCases[i];
  c.analyzed = true;
  c.status = '未解析';
  c.fareResult = null; // ローディング表示

  // パターン自動判定（未設定または再判定）
  c.casePattern = autoDetectPattern(c);

  if (!c.aiResult) {
    c.aiResult = {
      confidence:'中信頼度', client:c.client,
      from:c.from, to:c.to,
      goods:c.goods, deadline:c.deadline,
      conditions:'特になし', vehicle:'2tトラック', count:1
    };
  }
  if (!c.vehicles || !c.vehicles.length) {
    c.vehicles = [
      {rank:1,id:'車両0771',driver:'高橋 七郎',base:'近隣',avail:'空車',cap:'2,000kg',stars:4,score:80}
    ];
  }

  renderUnprocessedList();
  renderUnprocessedDetail(i);

  // 非同期で運賃判定
  calcFare(c).then(fareResult => {
    unprocessedCases[i].fareResult = fareResult;
    renderUnprocessedDetail(i);
    showToast('AI解析・運賃判定が完了しました', 'success');
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  処理中フェーズ描画
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderProcessingList() {
  const el = document.getElementById('processing-list');
  const filteredP = (() => {
    let r = holdFilterProcessing ? processingCases.filter(c => c.onHold) : processingCases;
    if (patternFilterProcessing !== 'all') r = r.filter(c => c.casePattern === patternFilterProcessing);
    return r;
  })();
  el.innerHTML = filteredP.map(function(c) {
    const i = processingCases.indexOf(c);
    const holdChip = c.onHold ? '<span class="badge-hold">&#9646; 仮押さえ</span>' : '';
    const priCls = c.priority === '緊急' ? 'badge-urgent' : 'badge-normal';
    const borderStyle = c.priority === '緊急' ? 'border-left:3px solid var(--red)' : '';
    const pat = c.casePattern ? CASE_PATTERNS[c.casePattern] : null;
    const patMini = pat ? '<span class="case-pattern-mini" style="background:' + pat.bgColor + ';color:' + pat.color + ';border-color:' + pat.borderColor + ';font-size:11px;padding:2px 8px">' + pat.id + '</span>' : '';
    return '<div class="case-card" onclick="selectProcessing(' + i + ')" id="pcard-' + i + '" style="' + borderStyle + '">'
      + '<div class="case-card-header">'
        + '<span class="case-no">No. ' + c.id + '</span>'
        + '<div style="display:flex;gap:4px;align-items:center;margin-left:auto;flex-wrap:wrap">'
          + holdChip
          + patMini
          + '<span class="case-status-badge ' + priCls + '">' + c.priority + '</span>'
        + '</div>'
      + '</div>'
      + '<div class="case-client">' + c.client + '</div>'
      + '<div class="case-route">'
        + '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>'
        + c.from + ' → ' + c.to
      + '</div>'
      + '<div class="case-meta">'
        + '<div class="case-meta-item">🚛 ' + (c.vehicleMode==='multi' && c.legs && c.legs.length>0 ? c.legs.map(l=>l.driverName).join(' / ') + ' <span class="multi-badge">複数台 '+c.legs.length+'台</span>' : c.driver) + '</div>'
        + '<div class="case-meta-item">📅 納期：' + c.deadline + '</div>'
      + '</div>'
      + '<div class="case-actions-mini">'
        + '<button class="btn btn-orange btn-sm" onclick="event.stopPropagation();openConfirmModal(' + i + ')">確定（ドライバーへ指示）</button>'
      + '</div>'
    + '</div>';
  }).join('');
}
let selectedProcessing = 0;
function selectProcessing(i) {
  selectedProcessing = i;
  document.querySelectorAll('#processing-list .case-card').forEach((el,idx) => {
    el.classList.toggle('selected', idx===i);
  });
  renderProcessingDetail(i);
}

// ── ★配送スケジュール（縦タイムライン）ヘルパー ─────────────────
// 個別案件処理ページで、案件1件の段取り（積込→走行→荷下ろし）を縦に表示する。
// 配車表で割当済みなら絶対時刻（dndAssignments の start/end/loadStart/...）を使い、
// 未割当ならドライバー側の preferredStart からシミュレートする。

// 案件IDから現在の配車割当を探す（未割当なら null）
function findAssignmentForCase(caseListId, caseObjId) {
  if (typeof dndAssignments === 'undefined') return null;
  for (const driverId in dndAssignments) {
    const byDate = dndAssignments[driverId];
    for (const dateKey in byDate) {
      const blk = (byDate[dateKey] || []).find(b =>
        (caseListId && b.caseListId === caseListId) ||
        (caseObjId && b.caseId === caseObjId)
      );
      if (blk) {
        const drv = (typeof dndDrivers !== 'undefined')
          ? dndDrivers.find(d => d.id === driverId) : null;
        return Object.assign({}, blk, { driverId, dateKey, _driver: drv });
      }
    }
  }
  return null;
}

// 「HH:MM」 + 分数 → 「HH:MM」
function _addMinHHMM(hhmm, m) {
  const [h, mm] = hhmm.split(':').map(Number);
  const total = h * 60 + mm + m;
  const hh = Math.floor(total / 60);
  const mn = total % 60;
  return String(hh).padStart(2, '0') + ':' + String(mn).padStart(2, '0');
}

// 個別案件処理の「案件」(unprocessedCases / processingCases / processedCases) を
// 配送スケジュール表示用に正規化する（caseListId をキーに dndUnassignedCases も参照）
function _resolveCaseSegments(c) {
  // c.id は個別案件処理側のID（caseListId に相当することが多い）
  // dndUnassignedCases 側に同 caseListId があれば内訳を借りる
  let loadMin = null, driveMin = null, unloadMin = null;
  let dndCase = null;
  if (typeof dndUnassignedCases !== 'undefined') {
    dndCase = dndUnassignedCases.find(d => d.caseListId === c.id);
    if (dndCase) {
      loadMin   = dndCase.loadMin;
      driveMin  = dndCase.driveMin;
      unloadMin = dndCase.unloadMin;
    }
  }
  // dndUnassignedCases に紐付けが無ければ goods から算出
  if (loadMin == null && typeof calcLoadingMinutes === 'function') {
    const m = calcLoadingMinutes(c.goods);
    loadMin   = m.loadMin;
    unloadMin = m.unloadMin;
    // driveMin は不明 → 距離から雑に推定（30km/h想定）
    const distMatch = String(c.distance || '').match(/(\d+)/);
    const km = distMatch ? parseInt(distMatch[1], 10) : 50;
    driveMin = Math.max(15, Math.round(km / 30 * 60 / 15) * 15);
  }
  return { loadMin, driveMin, unloadMin, dndCase };
}

// 縦タイムラインHTMLを生成
// ★M5: 新スキーマ jobs[] からこの案件の全ジョブを取得
// caseListId をキーに jobs[] を検索
function findJobsForCase(caseListId, caseObjId) {
  if (typeof window.jobs === 'undefined') return [];
  const result = window.jobs.filter(j =>
    (caseListId && j.caseListId === caseListId) ||
    (caseObjId && j.caseId === caseObjId)
  );
  // sequenceNo 昇順、同じなら startDateTime 昇順
  result.sort((a, b) => {
    if (a.sequenceNo !== b.sequenceNo) return a.sequenceNo - b.sequenceNo;
    return a.startDateTime.localeCompare(b.startDateTime);
  });
  return result;
}

// ★M5: 複数ジョブ（複数日案件）用の縦タイムライン
// jobs[] と steps[] から、案件全体の段取りを日付グループ別に表示する
function renderMultiDayCaseTimeline(c, jobsForCase) {
  if (!jobsForCase || jobsForCase.length === 0) return '';

  // 日付ごとにジョブをグループ化（dateKey -> [job, ...]）
  const groupByDate = {};
  jobsForCase.forEach(j => {
    const startDate = j.startDateTime.substring(0, 10);
    const endDate   = j.endDateTime.substring(0, 10);
    [startDate, endDate].forEach(dk => {
      if (!groupByDate[dk]) groupByDate[dk] = [];
      // 既に追加済みでなければ
      if (!groupByDate[dk].find(x => x.jobId === j.jobId)) {
        groupByDate[dk].push(j);
      }
    });
  });

  // ドライバー名（先頭ジョブから）
  const firstJob = jobsForCase[0];
  const driverInfo = (typeof dndDrivers !== 'undefined')
    ? dndDrivers.find(d => d.id === firstJob.driverId)
    : null;
  const allSameDriver = jobsForCase.every(j => j.driverId === firstJob.driverId);

  // 確定度を判定
  const allConfirmed  = jobsForCase.every(j => j.confirmed);
  const someConfirmed = jobsForCase.some(j => j.confirmed);
  const badgeCls = allConfirmed ? 'confirmed' : (someConfirmed ? 'planned' : 'planned');
  const sourceLabel = allConfirmed ? '配車確定済み' : '配車割当済み';

  // 日付の昇順でソート
  const sortedDates = Object.keys(groupByDate).sort();

  // ドライバー表示
  let driverHtml = '';
  if (driverInfo) {
    driverHtml = allSameDriver
      ? `<div class="case-schedule-driver">🚚 担当：<b>${driverInfo.driver}</b>（${driverInfo.vehicle}） — ${sortedDates.length}日連続</div>`
      : `<div class="case-schedule-driver">🚚 複数ドライバーで分担</div>`;
  }

  // タイムライン本体
  const fmtDate = (dk) => {
    const [y, m, d] = dk.split('-').map(Number);
    const dayOfWeek = ['日','月','火','水','木','金','土'][new Date(dk + 'T00:00:00').getDay()];
    return `${m}/${d} (${dayOfWeek})`;
  };
  const fmtTime = (iso) => iso.substring(11, 16);

  const segments = jobsForCase.map(j => {
    const sd = j.startDateTime.substring(0, 10);
    const ed = j.endDateTime.substring(0, 10);
    const isMultiDay = sd !== ed;
    const roleLabel = ({
      preload: '前日積込',
      transport: '走行',
      delivery: '配達',
      pickup_delivery: '配送',
      relay_leg: '中継走行',
    })[j.role] || j.role;
    const roleIcon = ({
      preload: '📥', transport: '🚛', delivery: '📤',
      pickup_delivery: '🚚', relay_leg: '🚛',
    })[j.role] || '🚛';

    const durMin = Math.round((new Date(j.endDateTime) - new Date(j.startDateTime)) / 60000);

    let crossNote = '';
    if (isMultiDay) {
      crossNote = `<span class="case-schedule-cross">🌙 日跨ぎ（${fmtDate(sd)}〜${fmtDate(ed)}）</span>`;
    }

    // handoff (引き継ぎ) 情報
    let handoffNote = '';
    if (j.nextJobId && j.handoffType && j.handoffType !== 'none') {
      const handoffLabel = ({
        overnight_park: '🅿 夜間駐車',
        driver_swap: '🔄 ドライバー交代',
        depot_transfer: '🏢 デポ間転送',
        parallel: '⏸ 並行（同時実行）',
      })[j.handoffType] || j.handoffType;
      handoffNote = `<div class="case-schedule-handoff">
        ${handoffLabel}${j.handoffLocation ? ` (${j.handoffLocation})` : ''}
      </div>`;
    }

    return { job: j, sd, ed, isMultiDay, roleLabel, roleIcon, durMin, crossNote, handoffNote };
  });

  // 日付セクション形式で出力
  const dayHtml = sortedDates.map(dk => {
    // この日付に出現するジョブ（開始日として記録されているもの優先）
    const todaysJobs = segments.filter(s => s.sd === dk);
    if (todaysJobs.length === 0) {
      // 終了日として現れるジョブ（前日からの続き）
      const tail = segments.find(s => s.ed === dk && s.sd !== dk);
      if (!tail) return '';
      return `
        <div class="case-schedule-day">
          <div class="case-schedule-day-head">${fmtDate(dk)}</div>
          <div class="case-schedule-day-body">
            <div class="case-schedule-step continuation">
              <div class="case-schedule-time">00:00</div>
              <div class="case-schedule-bar drive ghost"></div>
              <div class="case-schedule-content">
                <div class="case-schedule-action ghost-action">‹ 前日からの続き</div>
              </div>
            </div>
            <div class="case-schedule-step end">
              <div class="case-schedule-time">${fmtTime(tail.job.endDateTime)}</div>
              <div class="case-schedule-content">
                <div class="case-schedule-action">${tail.roleIcon} ${tail.roleLabel} 完了</div>
              </div>
            </div>
          </div>
        </div>`;
    }
    const stepsHtml = todaysJobs.map((s, idx) => {
      const last = idx === todaysJobs.length - 1;
      return `
        <div class="case-schedule-step">
          <div class="case-schedule-time">${fmtTime(s.job.startDateTime)}</div>
          <div class="case-schedule-bar ${s.job.role === 'preload' ? 'load' : (s.job.role === 'delivery' ? 'unload' : 'drive')}"></div>
          <div class="case-schedule-content">
            <div class="case-schedule-action">${s.roleIcon} ${s.roleLabel}（${s.durMin}分）</div>
            <div class="case-schedule-place">
              ${s.isMultiDay ? `${fmtTime(s.job.startDateTime)} → 翌${fmtTime(s.job.endDateTime)}` : `〜 ${fmtTime(s.job.endDateTime)}`}
              ${s.crossNote}
            </div>
            ${s.handoffNote}
          </div>
        </div>`;
    }).join('');
    return `
      <div class="case-schedule-day">
        <div class="case-schedule-day-head">${fmtDate(dk)}</div>
        <div class="case-schedule-day-body">
          ${stepsHtml}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="detail-card">
      <div class="detail-card-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        <div class="detail-card-title">配送スケジュール（${sortedDates.length}日間 / ${jobsForCase.length}ジョブ）</div>
        <span class="case-schedule-badge ${badgeCls}" style="margin-left:8px">${sourceLabel}</span>
        <button class="case-schedule-edit-btn" onclick="openJobSplitModal('${c.id || ''}', '${c.dndCaseId || c.caseListId || ''}')" style="margin-left:auto">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          ジョブ構成
        </button>
      </div>
      <div class="case-schedule-body">
        ${driverHtml}
        ${dayHtml}
      </div>
    </div>
  `;
}

function renderCaseScheduleTimeline(c) {
  // ★M5: まず新スキーマ jobs[] でこの案件の全ジョブを探す
  const jobsForCase = findJobsForCase(c.id, c.dndCaseId || null);
  if (jobsForCase.length > 1) {
    // 複数ジョブ案件 → マルチデイ表示
    return renderMultiDayCaseTimeline(c, jobsForCase);
  }
  // 単一ジョブ or 未割当 → 従来の単日表示
  const assignment = findAssignmentForCase(c.id, (c.dndCaseId || null));
  const isPlanned = !!assignment;
  const segs = _resolveCaseSegments(c);

  // 表示する時刻系列を決定
  let t1, t2, t3, t4, loadMin, driveMin, unloadMin, sourceLabel;
  if (isPlanned && assignment.loadStart) {
    t1 = assignment.loadStart;
    t2 = assignment.loadEnd;
    t3 = assignment.driveEnd;
    t4 = assignment.unloadEnd;
    loadMin   = assignment.loadMin;
    driveMin  = assignment.driveMin;
    unloadMin = assignment.unloadMin;
    sourceLabel = assignment.confirmed ? '配車確定済み' : '配車表で割当済み';
  } else {
    // 未割当 → preferredStart から仮スケジュール
    loadMin   = segs.loadMin   || 30;
    driveMin  = segs.driveMin  || 120;
    unloadMin = segs.unloadMin || 30;
    const startTime = (segs.dndCase && segs.dndCase.preferredStart) || '09:00';
    t1 = startTime;
    t2 = _addMinHHMM(t1, loadMin);
    t3 = _addMinHHMM(t2, driveMin);
    t4 = _addMinHHMM(t3, unloadMin);
    sourceLabel = '仮スケジュール（未割当）';
  }

  // 場所表示の整形（都道府県を残し、ちょっと縮める）
  const shortLoc = (s) => String(s || '—');

  const badgeCls = isPlanned ? (assignment.confirmed ? 'confirmed' : 'planned') : 'tentative';
  const driverHtml = (isPlanned && assignment._driver)
    ? `<div class="case-schedule-driver">🚚 担当：<b>${assignment._driver.driver}</b>（${assignment._driver.vehicle}）</div>`
    : '';

  return `
    <div class="detail-card">
      <div class="detail-card-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <div class="detail-card-title">配送スケジュール（予定）</div>
        <span class="case-schedule-badge ${badgeCls}" style="margin-left:8px">${sourceLabel}</span>
        <button class="case-schedule-edit-btn" onclick="openJobSplitModal('${c.id || ''}', '${c.dndCaseId || c.caseListId || c.id || ''}')" style="margin-left:auto">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          ジョブ構成
        </button>
      </div>
      <div class="case-schedule-body">
        ${driverHtml}
        <div class="case-schedule">
          <div class="case-schedule-step">
            <div class="case-schedule-time">${t1}</div>
            <div class="case-schedule-bar load"></div>
            <div class="case-schedule-content">
              <div class="case-schedule-action"><span class="case-schedule-icon">📥</span>積込（${loadMin}分）</div>
              <div class="case-schedule-place">${shortLoc(c.from)}</div>
            </div>
          </div>
          <div class="case-schedule-step">
            <div class="case-schedule-time">${t2}</div>
            <div class="case-schedule-bar drive"></div>
            <div class="case-schedule-content">
              <div class="case-schedule-action"><span class="case-schedule-icon">🚛</span>走行（${driveMin}分）</div>
              <div class="case-schedule-place">${shortLoc(c.from)} → ${shortLoc(c.to)}</div>
            </div>
          </div>
          <div class="case-schedule-step">
            <div class="case-schedule-time">${t3}</div>
            <div class="case-schedule-bar unload"></div>
            <div class="case-schedule-content">
              <div class="case-schedule-action"><span class="case-schedule-icon">📤</span>荷下ろし（${unloadMin}分）</div>
              <div class="case-schedule-place">${shortLoc(c.to)}</div>
            </div>
          </div>
          <div class="case-schedule-step end">
            <div class="case-schedule-time">${t4}</div>
            <div class="case-schedule-content">
              <div class="case-schedule-action complete">✓ 完了</div>
            </div>
          </div>
        </div>
        ${!isPlanned ? `
          <div class="case-schedule-hint">
            ℹ 配車表でこの案件をドライバーにドラッグすると、実際の開始時刻が反映されます
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// ★M6: ジョブ分割モーダル
// ═══════════════════════════════════════════════════════════════════
// 案件のジョブ構成を編集する。手動分解＋テンプレート適用に対応。
// editingJobs はモーダル内のドラフト状態。保存ボタンで replaceJobsForCase() を呼ぶ。

let _jobSplitModalState = {
  isOpen: false,
  caseId: null,
  caseListId: null,
  caseObj: null,
  editingJobs: [],  // {sequenceNo, driverId, startDateTime, endDateTime, role, handoffType, handoffLocation, loadMin, driveMin, unloadMin, ...}
  isDirty: false,
};

function openJobSplitModal(caseId, caseListId) {
  // case の解決
  let caseObj = null;
  if (typeof cases !== 'undefined') {
    caseObj = cases.find(c =>
      (caseId && c.id === caseId) ||
      (caseListId && c.caseListId === caseListId)
    );
  }
  // cases に無ければ dndUnassignedCases / processingCases を探す
  if (!caseObj && typeof dndUnassignedCases !== 'undefined') {
    caseObj = dndUnassignedCases.find(c =>
      (caseId && c.id === caseId) ||
      (caseListId && c.caseListId === caseListId)
    );
  }
  if (!caseObj && typeof processingCases !== 'undefined') {
    const pc = processingCases.find(c =>
      (caseListId && c.id === caseListId) ||
      (caseId && c.id === caseId)
    );
    if (pc) {
      caseObj = {
        id: pc.id, caseListId: pc.id,
        client: pc.client, from: pc.from, to: pc.to, goods: pc.goods, deadline: pc.deadline,
        loadMin: 30, driveMin: 120, unloadMin: 30,
      };
    }
  }
  if (!caseObj) {
    alert('案件情報が見つかりません');
    return;
  }

  // 既存ジョブを取得 → editingJobs にコピー
  const existing = findJobsForCase(caseObj.id, caseObj.caseListId);
  const editingJobs = existing.map(j => ({
    sequenceNo: j.sequenceNo,
    driverId: j.driverId,
    startDateTime: j.startDateTime,
    endDateTime: j.endDateTime,
    role: j.role,
    handoffType: j.handoffType,
    handoffLocation: j.handoffLocation,
    // ステップから集計
    loadMin: (steps.filter(s => s.jobId === j.jobId && s.stepType === 'load').reduce((a,s) => a + s.durationMin, 0)),
    driveMin: (steps.filter(s => s.jobId === j.jobId && s.stepType === 'drive').reduce((a,s) => a + s.durationMin, 0)),
    unloadMin: (steps.filter(s => s.jobId === j.jobId && s.stepType === 'unload').reduce((a,s) => a + s.durationMin, 0)),
    _originalJobId: j.jobId,
    _editingCaseId: caseObj.id,
  }));

  _jobSplitModalState = {
    isOpen: true,
    caseId: caseObj.id,
    caseListId: caseObj.caseListId,
    caseObj,
    editingJobs,
    isDirty: false,
  };

  _renderJobSplitModal();
}
window.openJobSplitModal = openJobSplitModal;

function closeJobSplitModal(skipConfirm) {
  if (!skipConfirm && _jobSplitModalState.isDirty) {
    if (!confirm('編集内容が破棄されます。閉じますか？')) return;
  }
  _jobSplitModalState.isOpen = false;
  const el = document.getElementById('job-split-modal');
  if (el) el.remove();
}
window.closeJobSplitModal = closeJobSplitModal;

// テンプレ適用
function applyJobTemplate(templateId) {
  const s = _jobSplitModalState;
  if (!s.isOpen || !s.caseObj) return;
  if (s.editingJobs.length > 0) {
    if (!confirm('既存のジョブ構成を「' + (JOB_TEMPLATES.find(t=>t.id===templateId)?.label||'テンプレ') + '」で置き換えます。よろしいですか？')) return;
  }
  // 基準日：既存ジョブの最終ジョブの endDateTime か、なければ「今日 + 1日」
  let baseDate;
  if (s.editingJobs.length > 0) {
    const last = [...s.editingJobs].sort((a,b) => (b.sequenceNo||0) - (a.sequenceNo||0))[0];
    baseDate = (last.endDateTime || '').substring(0, 10);
  }
  if (!baseDate) {
    const d = (typeof dndToday === 'function') ? dndToday() : new Date();
    baseDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  const generated = generateJobsFromTemplate(templateId, s.caseObj, baseDate);
  if (!generated) return;

  // 既存ジョブの driverId を引き継ぐ（先頭ジョブのドライバーを継承）
  const prevDriver = s.editingJobs[0]?.driverId || null;
  s.editingJobs = generated.map(g => Object.assign({}, g, {
    driverId: prevDriver,
    _editingCaseId: s.caseObj.id,
  }));
  s.isDirty = true;
  _renderJobSplitModal();
}
window.applyJobTemplate = applyJobTemplate;

// 個別フィールド編集
function _updateJobField(idx, field, value) {
  const s = _jobSplitModalState;
  if (!s.editingJobs[idx]) return;
  if (field === 'startDate' || field === 'startTime' || field === 'endDate' || field === 'endTime') {
    // 日付/時刻の分割編集
    const j = s.editingJobs[idx];
    let sIso = j.startDateTime || '2026-05-28T09:00:00';
    let eIso = j.endDateTime   || '2026-05-28T12:00:00';
    const sDate = sIso.substring(0,10), sTime = sIso.substring(11,16);
    const eDate = eIso.substring(0,10), eTime = eIso.substring(11,16);
    if (field === 'startDate') j.startDateTime = value + 'T' + sTime + ':00';
    if (field === 'startTime') j.startDateTime = sDate + 'T' + value + ':00';
    if (field === 'endDate')   j.endDateTime   = value + 'T' + eTime + ':00';
    if (field === 'endTime')   j.endDateTime   = eDate + 'T' + value + ':00';
  } else {
    s.editingJobs[idx][field] = value;
  }

  // ★M7: ドライバー変更時、前後ジョブとの整合性を自動補正
  if (field === 'driverId') {
    const cur = s.editingJobs[idx];
    const prev = s.editingJobs[idx - 1];
    const next = s.editingJobs[idx + 1];

    // 前ジョブ → 自分への引き継ぎを自動補正
    if (prev) {
      if (cur.driverId && prev.driverId && cur.driverId !== prev.driverId) {
        // ドライバー違い → driver_swap に
        if (prev.handoffType === 'none' || prev.handoffType === 'overnight_park') {
          prev.handoffType = 'driver_swap';
        }
      } else if (cur.driverId && prev.driverId && cur.driverId === prev.driverId) {
        // ドライバー同じ → driver_swap だったなら戻す
        if (prev.handoffType === 'driver_swap') {
          // 日跨ぎなら overnight_park、同日なら none
          const prevEndDate = (prev.endDateTime || '').substring(0,10);
          const curStartDate = (cur.startDateTime || '').substring(0,10);
          prev.handoffType = (prevEndDate !== curStartDate) ? 'overnight_park' : 'none';
        }
      }
    }
    // 自分 → 次ジョブへの引き継ぎを自動補正
    if (next) {
      if (cur.driverId && next.driverId && cur.driverId !== next.driverId) {
        if (cur.handoffType === 'none' || cur.handoffType === 'overnight_park') {
          cur.handoffType = 'driver_swap';
        }
      } else if (cur.driverId && next.driverId && cur.driverId === next.driverId) {
        if (cur.handoffType === 'driver_swap') {
          const curEndDate = (cur.endDateTime || '').substring(0,10);
          const nextStartDate = (next.startDateTime || '').substring(0,10);
          cur.handoffType = (curEndDate !== nextStartDate) ? 'overnight_park' : 'none';
        }
      }
    }
  }

  s.isDirty = true;
  _renderJobSplitModal();
}
window._updateJobField = _updateJobField;

function _addBlankJob() {
  const s = _jobSplitModalState;
  const lastSeq = s.editingJobs.reduce((max, j) => Math.max(max, j.sequenceNo || 0), 0);
  // 既存末尾ジョブの終了時刻を引き継ぎ
  const last = s.editingJobs[s.editingJobs.length - 1];
  let startIso, endIso;
  if (last && last.endDateTime) {
    startIso = last.endDateTime;
    endIso = isoAddMinutes(startIso, 180); // 3時間後
  } else {
    const d = (typeof dndToday === 'function') ? dndToday() : new Date();
    const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    startIso = dk + 'T09:00:00';
    endIso   = dk + 'T12:00:00';
  }
  s.editingJobs.push({
    sequenceNo: lastSeq + 1,
    driverId: last?.driverId || null,
    startDateTime: startIso,
    endDateTime: endIso,
    role: 'pickup_delivery',
    handoffType: 'none',
    handoffLocation: null,
    loadMin: s.caseObj?.loadMin || 30,
    driveMin: s.caseObj?.driveMin || 120,
    unloadMin: s.caseObj?.unloadMin || 30,
    _editingCaseId: s.caseObj.id,
  });
  s.isDirty = true;
  _renderJobSplitModal();
}
window._addBlankJob = _addBlankJob;

function _removeJob(idx) {
  const s = _jobSplitModalState;
  const target = s.editingJobs[idx];
  if (!target) return;

  // ★M7: 中間ジョブの削除をチェック
  const hasPrev = idx > 0;
  const hasNext = idx < s.editingJobs.length - 1;
  if (hasPrev && hasNext) {
    const prev = s.editingJobs[idx - 1];
    const next = s.editingJobs[idx + 1];
    const prevRole = ({preload:'前日積込', transport:'走行', delivery:'配達', pickup_delivery:'当日完結'})[prev.role] || prev.role;
    const nextRole = ({preload:'前日積込', transport:'走行', delivery:'配達', pickup_delivery:'当日完結'})[next.role] || next.role;
    if (!confirm(
      'このジョブを削除すると、前後の連結が変わります。\n\n' +
      `  前: Job ${prev.sequenceNo} (${prevRole})\n` +
      `  ★削除: Job ${target.sequenceNo}\n` +
      `  後: Job ${next.sequenceNo} (${nextRole}) ← Job ${prev.sequenceNo} に直接続くようになります\n\n` +
      '続行しますか？'
    )) return;
  } else if (s.editingJobs.length <= 1) {
    if (!confirm('最後のジョブを削除すると、案件が未配車状態になります。続行しますか？')) return;
  }

  s.editingJobs.splice(idx, 1);
  // sequenceNo を振り直し
  s.editingJobs.forEach((j, i) => { j.sequenceNo = i + 1; });
  s.isDirty = true;
  _renderJobSplitModal();
}
window._removeJob = _removeJob;

function saveJobSplit() {
  const s = _jobSplitModalState;
  if (!s.isOpen) return;
  const warnings = validateEditingJobs(s.editingJobs);
  const errors = warnings.filter(w => w.level === 'error');
  if (errors.length > 0) {
    alert('保存できない問題があります:\n' + errors.map(e => '・' + e.msg).join('\n'));
    return;
  }
  try {
    replaceJobsForCase(s.caseId, s.caseListId, s.editingJobs);
    closeJobSplitModal(true);
    // 個別案件処理ページが開いている場合は再描画
    if (typeof renderProcessingDetail === 'function' &&
        typeof selectedProcessing !== 'undefined' &&
        typeof processingCases !== 'undefined') {
      const targetIdx = processingCases.findIndex(c => c.id === s.caseListId);
      if (targetIdx >= 0) renderProcessingDetail(targetIdx);
    }
    if (typeof renderDnd === 'function') renderDnd();
  } catch (err) {
    console.error('saveJobSplit failed:', err);
    alert('保存に失敗しました: ' + err.message);
  }
}
window.saveJobSplit = saveJobSplit;

// モーダル本体のレンダリング
function _renderJobSplitModal() {
  const s = _jobSplitModalState;
  if (!s.isOpen) {
    const el = document.getElementById('job-split-modal');
    if (el) el.remove();
    return;
  }

  let el = document.getElementById('job-split-modal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'job-split-modal';
    document.body.appendChild(el);
  }

  // 警告/エラー集計
  const warnings = validateEditingJobs(s.editingJobs);

  // ドライバー選択肢
  const driversOpts = (typeof dndDrivers !== 'undefined' ? dndDrivers : [])
    .map(d => ({ id: d.id, label: d.driver + (d.vehicle ? `（${d.vehicle}）` : '') }));

  // テンプレボタン
  const templatesHtml = JOB_TEMPLATES.map(t => `
    <button class="job-split-tpl-btn" onclick="applyJobTemplate('${t.id}')" title="${t.description}">
      <span class="job-split-tpl-icon">${t.icon}</span>
      <span class="job-split-tpl-label">${t.label}</span>
    </button>
  `).join('');

  // ジョブカード
  const jobsHtml = s.editingJobs.map((j, idx) => {
    const sDate = (j.startDateTime || '').substring(0,10);
    const sTime = (j.startDateTime || '').substring(11,16);
    const eDate = (j.endDateTime   || '').substring(0,10);
    const eTime = (j.endDateTime   || '').substring(11,16);
    const isMultiDay = sDate && eDate && sDate !== eDate;
    const roleLabels = {
      preload: '前日積込',
      transport: '走行',
      delivery: '配達',
      pickup_delivery: '当日完結',
      relay_leg: '中継走行',
    };
    const roleOpts = Object.keys(roleLabels).map(r =>
      `<option value="${r}" ${j.role === r ? 'selected' : ''}>${roleLabels[r]}</option>`
    ).join('');
    const handoffLabels = {
      none: 'なし',
      overnight_park: '夜間駐車',
      driver_swap: 'ドライバー交代',
      depot_transfer: 'デポ間転送',
      parallel: '並行（同時実行）',
    };
    const handoffOpts = Object.keys(handoffLabels).map(h =>
      `<option value="${h}" ${j.handoffType === h ? 'selected' : ''}>${handoffLabels[h]}</option>`
    ).join('');
    const driverOpts = '<option value="">未割当</option>' + driversOpts.map(d =>
      `<option value="${d.id}" ${j.driverId === d.id ? 'selected' : ''}>${d.label}</option>`
    ).join('');
    const isLast = idx === s.editingJobs.length - 1;

    // このジョブに関する警告
    const jobWarnings = warnings.filter(w => w.jobIdx === idx);
    const warnHtml = jobWarnings.length === 0 ? '' :
      `<div class="job-split-warn">${jobWarnings.map(w =>
        `<div class="job-split-warn-row ${w.level}">${w.level === 'error' ? '⚠' : '!'} ${w.msg.replace(/^ジョブ\d+:\s*/,'')}</div>`
      ).join('')}</div>`;

    return `
      <div class="job-split-card">
        <div class="job-split-card-head">
          <div class="job-split-seqno">Job ${j.sequenceNo || idx+1}</div>
          ${isMultiDay ? '<span class="job-split-tag multiday">🌙 日跨ぎ</span>' : ''}
          <select class="job-split-role" onchange="_updateJobField(${idx},'role',this.value)">${roleOpts}</select>
          <button class="job-split-icon-btn" onclick="_removeJob(${idx})" title="このジョブを削除">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
        <div class="job-split-card-body">
          <div class="job-split-row">
            <div class="job-split-field">
              <label>開始</label>
              <div class="job-split-datetime">
                <input type="date" value="${sDate}" onchange="_updateJobField(${idx},'startDate',this.value)">
                <input type="time" value="${sTime}" onchange="_updateJobField(${idx},'startTime',this.value)">
              </div>
            </div>
            <div class="job-split-field">
              <label>終了</label>
              <div class="job-split-datetime">
                <input type="date" value="${eDate}" onchange="_updateJobField(${idx},'endDate',this.value)">
                <input type="time" value="${eTime}" onchange="_updateJobField(${idx},'endTime',this.value)">
              </div>
            </div>
          </div>
          <div class="job-split-row">
            <div class="job-split-field" style="grid-column: span 2;">
              <label>担当ドライバー</label>
              <select onchange="_updateJobField(${idx},'driverId',this.value)">${driverOpts}</select>
            </div>
          </div>
          ${!isLast ? `
          <div class="job-split-row">
            <div class="job-split-field">
              <label>次への引き継ぎ</label>
              <select onchange="_updateJobField(${idx},'handoffType',this.value)">${handoffOpts}</select>
            </div>
            <div class="job-split-field">
              <label>引き継ぎ地点</label>
              <input type="text" value="${j.handoffLocation || ''}" placeholder="例: 川口デポ" onchange="_updateJobField(${idx},'handoffLocation',this.value)">
            </div>
          </div>
          ` : ''}
          ${warnHtml}
        </div>
      </div>
    `;
  }).join('');

  // 全体警告サマリ
  const generalWarnings = warnings.filter(w => w.jobIdx === undefined);
  const summaryHtml = generalWarnings.length === 0 ? '' :
    `<div class="job-split-summary-warn">${generalWarnings.map(w =>
      `<div class="job-split-warn-row ${w.level}">${w.level === 'error' ? '⚠' : '!'} ${w.msg}</div>`
    ).join('')}</div>`;

  const c = s.caseObj;
  el.innerHTML = `
    <div class="job-split-backdrop" onclick="closeJobSplitModal()"></div>
    <div class="job-split-dialog">
      <div class="job-split-head">
        <div>
          <div class="job-split-title">ジョブ構成を編集 — ${c.client || c.id}</div>
          <div class="job-split-sub">${c.from || ''} → ${c.to || ''} ／ ${c.id}</div>
        </div>
        <button class="job-split-close" onclick="closeJobSplitModal()">×</button>
      </div>

      <div class="job-split-tpl-row">
        <span class="job-split-tpl-label-head">テンプレ適用：</span>
        ${templatesHtml}
      </div>

      <div class="job-split-body">
        ${s.editingJobs.length === 0
          ? '<div class="job-split-empty">ジョブがありません。上のテンプレから選ぶか、下のボタンで追加してください。</div>'
          : jobsHtml}
        <button class="job-split-add-btn" onclick="_addBlankJob()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          ジョブを追加
        </button>
        ${summaryHtml}
      </div>

      <div class="job-split-foot">
        <button class="job-split-btn-cancel" onclick="closeJobSplitModal()">キャンセル</button>
        <button class="job-split-btn-save" onclick="saveJobSplit()">保存して配車表に反映</button>
      </div>
    </div>
  `;
}

function renderProcessingDetail(i) {
  const c = processingCases[i];
  const el = document.getElementById('processing-detail');
  const selIdx = c.selectedVehicleIdx ?? 0;
  const selV = c.vehicles[selIdx];

  const vcards = c.vehicles.map((v, ri) => {
    const isTop = ri === 0;
    const isSel = ri === selIdx;
    // Phase 1c：クロス配車判定（ドライバーの所属拠点 vs 車両の拠点）
    let crossWarnHtml = '';
    // Phase 1d：法令分離評価でも同じ判定結果を使う
    let _lawIsCross = false;
    let _lawDBaseName = null;
    let _lawVBaseName = null;
    let _lawDist = null;
    try {
      // 案件のvehicles[]エントリにdriverIdとvehicleIdが付いている場合、マスタ参照で判定
      const vid = v.vehicleId || (v.id && v.id.startsWith('車両') ? 'V' + v.id.replace('車両', '') : v.id);
      const did = v.driverId;
      const masterV = vid && typeof window.getVehicleById === 'function' ? window.getVehicleById(vid) : null;
      const masterD = did && typeof window.getDriverById === 'function' ? window.getDriverById(did) : null;
      const dBaseId = masterD ? masterD.baseId : null;
      const vBaseId = masterV ? masterV.baseId : null;
      if (dBaseId && vBaseId && dBaseId !== vBaseId && !((masterD || {}).partner)) {
        const dBase = typeof window.getBaseById === 'function' ? window.getBaseById(dBaseId) : null;
        const vBase = typeof window.getBaseById === 'function' ? window.getBaseById(vBaseId) : null;
        const dist = typeof window.getBaseDistance === 'function' ? window.getBaseDistance(dBaseId, vBaseId) : null;
        const tip = `クロス配車：${dBase ? dBase.name : '?'}のドライバー × ${vBase ? vBase.name : '?'}の車両${dist != null ? `（距離${dist}km）` : ''}`;
        crossWarnHtml = `<span class="vcard-tag" style="background:#fff7ed;color:#9a3412;border:1px solid #fdba74;display:inline-flex;align-items:center;gap:3px" title="${tip}"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>クロス${dist != null ? ` ${dist}km` : ''}</span>`;
        _lawIsCross = true;
        _lawDBaseName = dBase ? dBase.name : null;
        _lawVBaseName = vBase ? vBase.name : null;
        _lawDist = dist;
      }
    } catch (e) { /* noop */ }

    return `
    <div class="vcard ${isTop?'vcard-top':''} ${isSel?'vcard-selected':''}"
         onclick="selectVehicle(${i},${ri})">
      ${isTop ? '<div class="vcard-recommend-badge">AI 推奨</div>' : ''}
      <div class="vcard-rank vcard-rank-${v.rank}">${v.rank}</div>
      <div class="vcard-info">
        <div class="vcard-driver">${v.driver}</div>
        <div class="vcard-vehicle">${v.id}${isSel ? `<button class="vcard-swap-vehicle-btn" onclick="event.stopPropagation();openVehicleSwap(${i},${ri})" title="ドライバーは同じまま車両だけ差し替えます">🔧 車両だけ変更</button>` : ''}</div>
        <div class="vcard-tags">
          <span class="vcard-tag vcard-tag-base">📍 ${v.base}</span>
          <span class="vcard-tag vcard-tag-cap">📦 ${v.cap}</span>
          <span class="vcard-tag vcard-tag-avail">✅ ${v.avail}</span>
          ${crossWarnHtml}
          ${v.law && typeof window.buildLawChipHtml === 'function'
            ? window.buildLawChipHtml(v, {
                isCross: _lawIsCross,
                dCenterName: _lawDBaseName,
                vCenterName: _lawVBaseName,
                distanceKm: _lawDist
              })
            : ''}
        </div>
      </div>
      <div class="vcard-right">
        <div class="vcard-score">${v.score}</div>
        <div class="vcard-score-label">AIスコア</div>
        <div class="vcard-stars">${'★'.repeat(v.stars)}${'☆'.repeat(5-v.stars)}</div>
      </div>
      ${isSel ? `<div class="vcard-check"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>` : ''}
    </div>`;
  }).join('');

  el.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" id="hold-btn-p-${i}" onclick="toggleHold(${i},'processing')">${c.onHold ? "✓ 仮押さえ中" : "仮押さえ"}</button>
      <button class="btn btn-orange" onclick="openConfirmModal(${i})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        確定（ドライバーへ指示依頼）
      </button>
      <button class="btn btn-secondary btn-sm" onclick="openPartnerModal(${i},'processing')">協力会社へ依頼</button>
      <button onclick="startPartnerGuide('processing',${i})" title="協力会社依頼ガイドを開始" style="width:26px;height:26px;border-radius:50%;border:none;background:var(--accent);color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s;box-shadow:0 1px 4px rgba(59,184,136,0.4);align-self:center" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8" stroke-width="3" stroke-linecap="round"/><line x1="12" y1="12" x2="12" y2="16"/></svg>
      </button>
    </div>

    <!-- 案件パターン -->
    <div class="detail-card" style="margin-bottom:14px">
      <div class="detail-card-header" style="background:${c.casePattern ? CASE_PATTERNS[c.casePattern]?.bgColor : '#f8fafc'}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${c.casePattern ? CASE_PATTERNS[c.casePattern]?.color : '#6b7280'}" stroke-width="2"><path d="M7 7h10M7 12h10M7 17h10"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
        <div class="detail-card-title" style="color:${c.casePattern ? CASE_PATTERNS[c.casePattern]?.color : 'var(--text-primary)'}">案件パターン</div>
        <div style="margin-left:auto">${c.casePattern ? renderPatternFlag(c.casePattern, false, i + '_p') : '<span style="font-size:11px;color:var(--text-muted)">未設定</span>'}</div>
      </div>
    </div>

    <div class="detail-card">
      <div class="detail-card-header">
        <div class="detail-card-title">案件情報 No. ${c.id}</div>
        <span class="case-status-badge ${c.priority==='緊急'?'badge-urgent':'badge-normal'}" style="margin-left:auto">${c.priority}</span>
      </div>
      <div class="detail-card-body">
        <div class="info-grid">
          <div class="info-item"><div class="info-label">取引先</div><div class="info-value">${c.client}</div></div>
          <div class="info-item"><div class="info-label">必要車格</div><div class="info-value">4tウィング</div></div>
          <div class="info-item"><div class="info-label">発地</div><div class="info-value">${c.from}</div></div>
          <div class="info-item"><div class="info-label">着地</div><div class="info-value">${c.to}</div></div>
          <div class="info-item"><div class="info-label">荷物</div><div class="info-value">${c.goods}</div></div>
          <div class="info-item"><div class="info-label">納期</div><div class="info-value">${c.deadline}</div></div>
          <div class="info-item"><div class="info-label">必要台数</div><div class="info-value">1台</div></div>
          <div class="info-item"><div class="info-label">距離</div><div class="info-value">${c.distance}</div></div>
        </div>
      </div>
    </div>

    ${renderCaseScheduleTimeline(c)}

    <div class="detail-card">
      <div class="detail-card-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/></svg>
        <div class="detail-card-title">車両候補（AI推薦）</div>
        <span style="margin-left:auto;font-size:10px;color:var(--text-muted)">クリックで選択変更</span>
      </div>
      <!-- 複数台モード切り替え -->
      <div style="padding:10px 14px 4px">
        <div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:6px">配車構成</div>
        <div class="multi-mode-toggle">
          <button class="multi-mode-btn ${(c.vehicleMode||'single')==='single'?'active':''}"
            onclick="setVehicleMode(${i},'single')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            1台で対応
          </button>
          <button class="multi-mode-btn ${(c.vehicleMode||'single')==='multi'?'active':''}"
            onclick="setVehicleMode(${i},'multi')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            複数台で対応
            ${(c.vehicleMode||'single')==='multi' && c.legs && c.legs.length>0 ? '<span class="multi-badge" style="font-size:9px;padding:1px 5px;margin-left:4px">'+c.legs.length+'台</span>' : ''}
          </button>
          <button class="multi-mode-btn ${(c.vehicleMode||'single')==='relay'?'active':''}"
            onclick="setVehicleMode(${i},'relay')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="3"/><circle cx="19" cy="12" r="3"/><path d="M8 12h8M12 7v2M12 15v2"/></svg>
            リレー輸送
            ${(c.vehicleMode||'single')==='relay' && c.legs && c.legs.length>0 ? '<span class="multi-badge" style="font-size:9px;padding:1px 5px;margin-left:4px;background:#0d9488">'+c.legs.length+'区間</span>' : ''}
          </button>
        </div>
      </div>

      <!-- 1台モード: 従来のvcard表示 -->
      <div id="single-mode-panel-${i}" style="display:${(c.vehicleMode||'single')==='single'?'block':'none'}">
        <div class="vcard-list">${vcards}</div>
      </div>

      <!-- 複数台モード -->
      <div id="multi-mode-panel-${i}" style="display:${(c.vehicleMode||'single')==='multi'?'block':'none'}">
        <!-- 理由チップ -->
        <div style="padding:6px 14px 2px;font-size:11px;font-weight:600;color:var(--text-secondary)">複数台にする理由（複数選択可）</div>
        <div class="multi-reason-chips">
          ${['単純な物量超過','ピストン輸送','積地/着地の待機時間短縮','積載の最適化（大型+小型）','現場制限による小分け配送','帰り荷の都合','荷姿の混在（平ボディ+ウイング等）','付帯作業の有無（クレーン付き等）'].map(r =>
            `<span class="multi-reason-chip ${(c.multiReasons||[]).includes(r)?'selected':''}"
              onclick="toggleMultiReason(${i},'${r}')">${r}</span>`
          ).join('')}
        </div>
        <!-- Leg構成 -->
        <div style="padding:10px 14px 4px;font-size:11px;font-weight:600;color:var(--text-secondary)">便構成（最大3台）</div>
        <div style="padding:0 14px 10px" id="leg-list-${i}">
          ${renderLegList(i, c)}
        </div>
        <!-- 協力会社への引き渡し案内 -->
        ${(c.legs||[]).length > 0 ? `
        <div class="partner-after-multi-note" style="margin:0 14px 12px">
          💡 自社${(c.legs||[]).length}台の配車が確定後、「協力会社へ依頼」ボタンから<br>
          残りの輸送量を協力会社に依頼できます。
        </div>` : ''}
      </div>

      <!-- リレー輸送モード -->
      <div id="relay-mode-panel-${i}" style="display:${(c.vehicleMode||'single')==='relay'?'block':'none'}">
        <div style="padding:10px 14px 6px">
          <div style="font-size:11px;color:var(--text-secondary);background:#f0fdfa;border-left:3px solid #0d9488;padding:8px 10px;border-radius:0 4px 4px 0">
            <strong style="color:#0f766e">🔁 リレー輸送モード</strong><br>
            出発地から到着地までを<strong>中継地点で運転手を交代</strong>しながら運ぶ方式です。<br>
            各区間（レッグ）が時系列で連鎖し、前区間の到着地点 = 次区間の出発地点になります。
          </div>
        </div>
        <!-- リレー区間構成 -->
        <div style="padding:10px 14px 4px;font-size:11px;font-weight:600;color:var(--text-secondary)">リレー区間（最大4区間）</div>
        <div style="padding:0 14px 10px" id="relay-list-${i}">
          ${renderRelayList(i, c)}
        </div>
        <!-- リレーの理由 -->
        <div style="padding:6px 14px 2px;font-size:11px;font-weight:600;color:var(--text-secondary)">リレー輸送にする理由（複数選択可）</div>
        <div class="multi-reason-chips" style="padding:0 14px 10px">
          ${['長距離での運転手の改善基準対策','拘束時間の分散','24時間以内の納品要件','悪天候対策（雪国の中継）','コスト最適化','他社との協業（中継地で引き渡し）'].map(r =>
            `<span class="multi-reason-chip ${(c.multiReasons||[]).includes(r)?'selected':''}"
              onclick="toggleMultiReason(${i},'${r}')">${r}</span>`
          ).join('')}
        </div>
      </div>
    </div>

    <!-- 選択中の車両サマリー -->
    <div id="selected-summary-block-${i}" style="background:var(--accent-pale);border:1.5px solid var(--sidebar-bg);border-radius:10px;padding:12px 16px;margin-bottom:16px;display:${(c.vehicleMode||'single')==='single'?'flex':'none'};align-items:center;gap:12px">
      <div style="width:36px;height:36px;background:var(--sidebar-bg);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0D4A3A" stroke-width="2.5"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/></svg>
      </div>
      <div style="flex:1">
        <div style="font-size:10px;color:var(--sidebar-bg);font-weight:600;margin-bottom:2px">現在の選択車両</div>
        <div style="font-size:14px;font-weight:800;color:var(--sidebar-bg)" id="selected-summary-${i}">${selV.driver}（${selV.id}）</div>
      </div>
      <div style="font-size:22px;font-weight:800;font-family:'Inter',sans-serif;color:var(--sidebar-bg)">
        ${selV.score}<span style="font-size:10px;font-weight:400;color:var(--text-muted);margin-left:2px">pt</span>
      </div>
    </div>
    <!-- 複数台サマリー -->
    <div id="multi-summary-block-${i}" style="background:var(--accent-pale);border:1.5px solid var(--sidebar-bg);border-radius:10px;padding:12px 16px;margin-bottom:16px;display:${(c.vehicleMode||'single')==='multi'&&(c.legs||[]).length>0?'block':'none'}">
      <div style="font-size:10px;color:var(--sidebar-bg);font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:6px">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/></svg>
        複数台配車構成（${(c.legs||[]).length}台）
      </div>
      ${(c.legs||[]).map((leg,li) => `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 0;${li<(c.legs||[]).length-1?'border-bottom:1px solid #d1fae5':''}">
          <span style="font-size:10px;font-weight:700;color:#6DD5A8;background:var(--sidebar-bg);padding:2px 6px;border-radius:10px;flex-shrink:0">第${li+1}便</span>
          <span style="font-size:12px;font-weight:600;color:var(--sidebar-bg)">${leg.driverName}（${leg.vehicleName}）</span>
          <span style="font-size:10px;color:var(--text-muted);margin-left:auto">${leg.vehicleType} · ${leg.capacity}</span>
          ${leg.lawOk ? '<span style="font-size:10px;background:#d1fae5;color:#065f46;padding:1px 7px;border-radius:10px;font-weight:700;flex-shrink:0">法令✓</span>' : ''}
        </div>
      `).join('')}
    </div>

    <!-- ━━ 最終AIレコメンド（2軸評価）━━ -->
    ${renderFinalRecommendCard(c)}

    <div class="detail-card">
      <div class="detail-card-header">
        <div class="detail-card-title">案件履歴</div>
      </div>
      <div class="detail-card-body">
        <div class="timeline">
          <div class="timeline-item"><div class="timeline-time">09:15</div><div class="timeline-dot"></div><div><div class="timeline-text">電話受付・AI解析完了</div><div class="timeline-by">配車 太郎</div></div></div>
          <div class="timeline-item"><div class="timeline-time">10:02</div><div class="timeline-dot"></div><div><div class="timeline-text">案件情報を確認</div><div class="timeline-by">配車 太郎</div></div></div>
          <div class="timeline-item"><div class="timeline-time">10:15</div><div class="timeline-dot"></div><div><div class="timeline-text">${c.vehicles[0].id} AI推薦・仮押さえ</div><div class="timeline-by">配車 太郎</div></div></div>
        </div>
      </div>
    </div>
  `;
}

function selectVehicle(caseIdx, vehicleIdx) {
  processingCases[caseIdx].selectedVehicleIdx = vehicleIdx;
  const v = processingCases[caseIdx].vehicles[vehicleIdx];
  // ドライバー・車両も更新
  processingCases[caseIdx].driver  = v.driver;
  processingCases[caseIdx].vehicle = v.id;
  renderProcessingDetail(caseIdx);
  showToast(v.driver + '（' + v.id + '）を選択しました', 'success');
}

// ═══════════════════════════════════════════════════════════════
//  ステップ9：車両だけ差し替えUI
//  ドライバーは同じまま車両だけ別のものに差し替える機能。
//  vehicles[] マスタから候補を出し、積載量チェックを自動で行う。
// ═══════════════════════════════════════════════════════════════

let _vehiclePickerState = null; // {caseIdx, vehicleIdx}

function openVehicleSwap(caseIdx, vehicleIdx) {
  _vehiclePickerState = { caseIdx, vehicleIdx };
  const c = processingCases[caseIdx];
  if (!c || !c.vehicles || !c.vehicles[vehicleIdx]) return;
  const entry = c.vehicles[vehicleIdx];

  // 既存の正規化（driverId/vehicleId付与）を保証
  if (typeof normalizeCaseVehicleEntry === 'function') normalizeCaseVehicleEntry(entry);

  // 案件に必要な積載量を抽出（goodsから "800kg" などを抜く）
  let neededKg = 0;
  const goodsStr = String(c.goods || '');
  const mGoods = goodsStr.match(/([\d,]+)\s*kg/);
  if (mGoods) neededKg = parseInt(mGoods[1].replace(/,/g, ''), 10);

  // 現在の車両情報
  const currentV = entry.vehicleId ? getVehicleById(entry.vehicleId) : null;
  const currentPlate = currentV ? currentV.plate : (entry.id || '—');
  const currentTon = currentV ? `${currentV.ton}t (${currentV.type})` : '';
  const driverName = entry.driver || '—';

  // ─── Phase 1c：拠点絞り込み状態管理 ─────────────────────────────
  // 論点F：個別案件処理の候補車両テーブルでは「ログインユーザーの接続拠点」を初期選択
  // ここではログインユーザーの所属拠点を使う想定。TEAM_MEMBERSのbaseIds[]が無い場合は
  // 案件の出発地（from）から推定した拠点を初期選択
  function _resolveInitialBase() {
    // 出発地から拠点ID推定
    if (typeof window.resolveBaseIdByAlias === 'function' && c.from) {
      const bid = window.resolveBaseIdByAlias(c.from);
      if (bid) return bid;
    }
    // 現在の車両の拠点
    if (currentV && currentV.baseId) return currentV.baseId;
    return null;
  }
  // 現在選択中の拠点フィルタ。null = すべて
  let selectedBaseId = _resolveInitialBase();
  let showCrossOnly = false;  // クロス配車のみ表示するチップ

  // 拠点ごとの車両件数を計算（マスタの全車両）
  function computeBaseCounts() {
    const counts = { __all: vehicles.length, __cross: 0 };
    (window.bases || []).forEach(b => { counts[b.id] = 0; });
    vehicles.forEach(v => {
      if (v.baseId && counts[v.baseId] !== undefined) counts[v.baseId]++;
      // クロス配車になる候補：ドライバーの拠点と異なる
      // ここではドライバー本人の所属拠点と異なる場合をカウント
      const driverBaseId = entry.driverId
        ? (getDriverById(entry.driverId) || {}).baseId : null;
      if (driverBaseId && v.baseId && driverBaseId !== v.baseId) counts.__cross++;
    });
    return counts;
  }

  function buildBaseFilterRow() {
    const counts = computeBaseCounts();
    const driverBaseId = entry.driverId
      ? (getDriverById(entry.driverId) || {}).baseId : null;
    const driverBaseName = driverBaseId && typeof getBaseById === 'function'
      ? (getBaseById(driverBaseId) || {}).name : null;
    const chips = [];
    chips.push(`<span class="vehicle-picker-base-chip ${selectedBaseId === null && !showCrossOnly ? 'active' : ''}" onclick="window.__vpSetBase(null)">すべて<span class="vehicle-picker-base-chip-count">${counts.__all}</span></span>`);
    (window.bases || []).forEach(b => {
      if (counts[b.id] === 0) return;
      const color = (typeof window.__baseColorForChip === 'function')
        ? window.__baseColorForChip(b.id) : '#475569';
      chips.push(`<span class="vehicle-picker-base-chip ${selectedBaseId === b.id && !showCrossOnly ? 'active' : ''}" data-base-id="${b.id}" onclick="window.__vpSetBase('${b.id}')"><span class="vp-base-dot" style="background:${color}"></span>${b.name.replace(/拠点$/, '')}<span class="vehicle-picker-base-chip-count">${counts[b.id]}</span></span>`);
    });
    if (counts.__cross > 0 && (window.dispatchConfig || {}).crossBaseEnabled !== false) {
      chips.push(`<span class="vehicle-picker-base-chip ${showCrossOnly ? 'active' : ''}" onclick="window.__vpToggleCrossOnly()" style="border-color:#fdba74;color:#9a3412"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>クロス配車<span class="vehicle-picker-base-chip-count">${counts.__cross}</span></span>`);
    }
    const hint = driverBaseName
      ? `<span style="font-size:10px;color:#94a3b8;margin-left:auto">ドライバー：${driverBaseName}</span>`
      : '';
    return `<div class="vehicle-picker-base-filter" id="vehicle-picker-base-filter">
      <span class="vehicle-picker-base-filter-label">拠点</span>
      ${chips.join('')}
      ${hint}
    </div>`;
  }

  // 候補リスト（全車両 + 拠点フィルタ + 検索）
  function buildList(filter) {
    const f = (filter || '').trim().toLowerCase();
    const driverBaseId = entry.driverId
      ? (getDriverById(entry.driverId) || {}).baseId : null;

    const items = vehicles.map(v => {
      const isCurrent = currentV && currentV.id === v.id;
      const insufficient = neededKg > 0 && v.maxLoad < neededKg;
      const matchesFilter = !f ||
        v.plate.toLowerCase().includes(f) ||
        v.type.toLowerCase().includes(f) ||
        String(v.ton).includes(f);
      // クロス配車になるか：ドライバーの拠点と車両の拠点が異なる
      const isCross = driverBaseId && v.baseId && driverBaseId !== v.baseId;
      // 拠点フィルタ
      let matchesBase = true;
      if (showCrossOnly) {
        matchesBase = isCross;
      } else if (selectedBaseId !== null) {
        matchesBase = v.baseId === selectedBaseId || (v.baseIds && v.baseIds.includes(selectedBaseId));
      }
      // 距離（クロス配車時のみ）
      const distance = isCross && typeof window.getBaseDistance === 'function'
        ? window.getBaseDistance(driverBaseId, v.baseId)
        : null;
      return { v, isCurrent, insufficient, matchesFilter, matchesBase, isCross, distance };
    }).filter(x => x.matchesFilter && x.matchesBase);

    if (items.length === 0) {
      return '<div class="vehicle-picker-empty">該当する車両がありません</div>';
    }
    // 並び順：現在 → 同一拠点 → クロス（距離昇順）
    items.sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      if (a.isCross !== b.isCross) return a.isCross ? 1 : -1;
      if (a.isCross && b.isCross) {
        const da = a.distance == null ? 9999 : a.distance;
        const db = b.distance == null ? 9999 : b.distance;
        return da - db;
      }
      return 0;
    });
    return items.map(x => {
      // 拠点バッジ
      const base = x.v.baseId && typeof getBaseById === 'function'
        ? getBaseById(x.v.baseId) : null;
      const color = (typeof window.__baseColorForChip === 'function' && x.v.baseId)
        ? window.__baseColorForChip(x.v.baseId) : '#475569';
      const baseBadge = base
        ? `<span class="vehicle-picker-item-base" style="color:${color};background:${color}1a"><span class="vp-item-base-dot"></span>${base.name.replace(/拠点$/, '')}</span>`
        : '';
      const crossBadge = x.isCross
        ? `<span class="vehicle-picker-item-cross" title="ドライバーの拠点と異なります"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>クロス</span>`
        : '';
      const distLabel = x.distance != null
        ? `<span class="vehicle-picker-item-distance">${x.distance}km</span>`
        : '';
      return `
      <div class="vehicle-picker-item ${x.isCurrent ? 'current' : ''} ${x.insufficient ? 'insufficient' : ''}"
           data-vehicle-id="${x.v.id}"
           onclick="window.__pickVehicle('${x.v.id}', ${x.insufficient}, ${x.isCross})">
        <span class="vehicle-picker-item-plate">${x.v.plate}</span>
        <span class="vehicle-picker-item-type">${x.v.type}</span>
        <span class="vehicle-picker-item-cap">${(x.v.maxLoad/1000).toFixed(1)}t</span>
        ${baseBadge}
        ${crossBadge}${distLabel}
        ${x.isCurrent ? '<span style="font-size:10px;color:#1A6B56;font-weight:700;margin-left:auto">現在の車両</span>' : ''}
      </div>
    `;
    }).join('');
  }

  // モーダルを構築
  const backdrop = document.createElement('div');
  backdrop.className = 'vehicle-picker-backdrop';
  backdrop.id = 'vehicle-picker-backdrop';
  backdrop.onclick = function(e) {
    if (e.target === backdrop) closeVehicleSwap();
  };
  backdrop.innerHTML = `
    <div class="vehicle-picker" onclick="event.stopPropagation()">
      <div class="vehicle-picker-header">
        <div class="vehicle-picker-title">🔧 車両を差し替え</div>
        <button class="vehicle-picker-close" onclick="closeVehicleSwap()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="vehicle-picker-body">
        <div class="vehicle-picker-current">
          <strong>ドライバー：${driverName}</strong>（変更されません）
          ${neededKg > 0 ? ` ｜ 必要積載：<strong>${neededKg.toLocaleString()}kg</strong>` : ''}
        </div>
        ${buildBaseFilterRow()}
        <input type="text" class="vehicle-picker-search" id="vehicle-picker-search"
               placeholder="車両番号・タイプ・トン数で絞り込み..." oninput="window.__refreshVehiclePickerList(this.value)">
        <div class="vehicle-picker-list" id="vehicle-picker-list">
          ${buildList('')}
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  // データを保存しておく（リフレッシュ用）
  window.__vehiclePickerNeededKg = neededKg;
  window.__vehiclePickerBuildList = buildList;
  window.__vehiclePickerBuildBaseFilterRow = buildBaseFilterRow;
  // 拠点フィルタの状態操作関数
  window.__vpSetBase = function(baseId) {
    selectedBaseId = baseId;
    showCrossOnly = false;
    _refreshAll();
  };
  window.__vpToggleCrossOnly = function() {
    showCrossOnly = !showCrossOnly;
    if (showCrossOnly) selectedBaseId = null;
    _refreshAll();
  };
  function _refreshAll() {
    // 拠点フィルタ行とリストの両方を再描画
    const filterRow = document.getElementById('vehicle-picker-base-filter');
    if (filterRow && filterRow.parentNode) {
      const newRow = document.createElement('div');
      newRow.innerHTML = buildBaseFilterRow().trim();
      filterRow.parentNode.replaceChild(newRow.firstChild, filterRow);
    }
    const searchEl = document.getElementById('vehicle-picker-search');
    const searchVal = searchEl ? searchEl.value : '';
    const list = document.getElementById('vehicle-picker-list');
    if (list) list.innerHTML = buildList(searchVal);
  }
}

window.__refreshVehiclePickerList = function(filter) {
  const list = document.getElementById('vehicle-picker-list');
  if (list && typeof window.__vehiclePickerBuildList === 'function') {
    list.innerHTML = window.__vehiclePickerBuildList(filter);
  }
};

window.__pickVehicle = function(newVehicleId, insufficient, isCross) {
  if (!_vehiclePickerState) return;
  if (insufficient) {
    if (!confirm('この車両は積載量が不足しています。それでも差し替えますか？')) return;
  }
  const { caseIdx, vehicleIdx } = _vehiclePickerState;
  const c = processingCases[caseIdx];
  if (!c) { closeVehicleSwap(); return; }

  // Phase 1c：クロス配車になる場合は確認ダイアログを表示
  // （論点C：クロス配車確定時に自動で翌日の回送を提案／ON/OFF）
  // ─── クロス配車確認モーダルへ ───
  if (isCross && typeof window.openCrossBaseConfirmDialog === 'function') {
    window.openCrossBaseConfirmDialog({
      caseObj: c,
      caseIdx,
      vehicleIdx,
      newVehicleId,
      driverId: c.vehicles[vehicleIdx].driverId,
      onConfirm: function(opts) {
        _applyVehicleSwap(c, caseIdx, vehicleIdx, newVehicleId, opts);
      },
      onCancel: function() {
        // 何もしない（ピッカーは開いたまま）
      }
    });
    return;
  }
  // クロス配車でない場合は即適用
  _applyVehicleSwap(c, caseIdx, vehicleIdx, newVehicleId, {
    createReturn: false,
    notifyReceiving: false
  });
};

// 車両差し替えの実適用関数（クロス確認後 or 同一拠点時に呼ばれる）
function _applyVehicleSwap(c, caseIdx, vehicleIdx, newVehicleId, opts) {
  opts = opts || {};
  // 新APIで車両だけ差し替え
  const result = window.caseAssignAPI.changeVehicle(c, vehicleIdx, newVehicleId);
  if (!result.ok) {
    showToast('車両の差し替えに失敗: ' + (result.reason || '不明'), 'error');
    return;
  }

  // 案件側の表示用文字列も整合させる（vehicle/driverトップフィールド）
  const selIdx = c.selectedVehicleIdx ?? 0;
  if (vehicleIdx === selIdx) {
    const newV = getVehicleById(newVehicleId);
    if (newV) c.vehicle = newV.plate;
  }

  // 同じドライバーで稼働中のassignmentがあれば、その車両も同期更新
  const entry = c.vehicles[vehicleIdx];
  let updatedAssignmentId = null;
  if (entry && entry.driverId && typeof assignments !== 'undefined') {
    const matching = assignments.find(a =>
      a.driverId === entry.driverId &&
      a.client === c.client
    );
    if (matching) {
      window.assignmentAPI.changeVehicle(matching.id, newVehicleId);
      updatedAssignmentId = matching.id;
      // クロス配車の effectiveBaseId を再計算（車両のbaseIdをデフォルトに）
      const newV = getVehicleById(newVehicleId);
      if (newV && typeof window.updateAssignment === 'function') {
        window.updateAssignment(matching.id, {
          effectiveBaseId: newV.baseId
        }, (typeof window.__getCurrentUserId === 'function' ? window.__getCurrentUserId() : null));
      }
    }
  }

  // 戻り回送の自動生成（クロス配車かつopts.createReturn=true時）
  let returnAssignmentId = null;
  if (opts.createReturn && updatedAssignmentId && typeof window.createReturnAssignment === 'function') {
    const ret = window.createReturnAssignment(updatedAssignmentId);
    if (ret) returnAssignmentId = ret.id;
  }

  closeVehicleSwap();
  renderProcessingDetail(caseIdx);
  const newV = getVehicleById(newVehicleId);
  let msg = `車両を ${newV ? newV.plate : newVehicleId} に差し替えました（ドライバーは ${entry.driver} のまま）`;
  if (returnAssignmentId) msg += `／翌日朝に戻り回送を登録しました`;
  if (opts.notifyReceiving) msg += `／受け入れ拠点に通知しました（デモ）`;
  showToast(msg, 'success');
}

function closeVehicleSwap() {
  const el = document.getElementById('vehicle-picker-backdrop');
  if (el) el.remove();
  _vehiclePickerState = null;
}

// ═══════════════════════════════════════════════════════════════
//  Phase 1c：クロス配車確認ダイアログ
//  論点C/E：戻り回送をデフォルトON、ON/OFF選択可
//  論点R：受け入れ拠点への通知（チェック式）
//  論点S：両拠点を警告表示
// ═══════════════════════════════════════════════════════════════
window.openCrossBaseConfirmDialog = function(options) {
  // options: { caseObj, caseIdx, vehicleIdx, newVehicleId, driverId, onConfirm, onCancel }
  if (!options || !options.newVehicleId || !options.driverId) {
    console.warn('openCrossBaseConfirmDialog: missing required options');
    return;
  }

  const driverId = options.driverId;
  const newVehicleId = options.newVehicleId;
  const driver = typeof window.getDriverById === 'function' ? window.getDriverById(driverId) : null;
  const newVehicle = typeof window.getVehicleById === 'function' ? window.getVehicleById(newVehicleId) : null;
  if (!driver || !newVehicle) {
    console.warn('cross base dialog: master lookup failed');
    return;
  }

  const dBase = driver.baseId ? window.getBaseById(driver.baseId) : null;
  const vBase = newVehicle.baseId ? window.getBaseById(newVehicle.baseId) : null;
  const distance = typeof window.getBaseDistance === 'function'
    ? window.getBaseDistance(driver.baseId, newVehicle.baseId) : null;

  const dColor = (typeof window.__baseColorForChip === 'function' && driver.baseId)
    ? window.__baseColorForChip(driver.baseId) : '#475569';
  const vColor = (typeof window.__baseColorForChip === 'function' && newVehicle.baseId)
    ? window.__baseColorForChip(newVehicle.baseId) : '#475569';

  // 効率的な運用拠点：論点D「車両の baseId が初期値」
  const effectiveBase = vBase;
  const effectiveColor = vColor;

  // 既存のダイアログをクリーンアップ
  const old = document.getElementById('crossbase-confirm-backdrop');
  if (old) old.remove();

  const backdrop = document.createElement('div');
  backdrop.className = 'crossbase-confirm-backdrop';
  backdrop.id = 'crossbase-confirm-backdrop';
  backdrop.onclick = function(e) {
    if (e.target === backdrop) _closeCrossBaseDialog(options.onCancel);
  };

  backdrop.innerHTML = `
    <div class="crossbase-confirm-modal" onclick="event.stopPropagation()">
      <div class="crossbase-confirm-header">
        <div class="crossbase-confirm-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="16 3 21 3 21 8"/>
            <line x1="4" y1="20" x2="21" y2="3"/>
            <polyline points="21 16 21 21 16 21"/>
            <line x1="15" y1="15" x2="21" y2="21"/>
            <line x1="4" y1="4" x2="9" y2="9"/>
          </svg>
        </div>
        <div style="flex:1">
          <div class="crossbase-confirm-title">クロス営業所配車の確認</div>
          <div class="crossbase-confirm-subtitle">この配車は営業所をまたぎます</div>
        </div>
      </div>
      <div class="crossbase-confirm-body">
        <div class="crossbase-confirm-section">
          <div class="crossbase-confirm-section-title">配車の組み合わせ</div>
          <div class="crossbase-pair-card">
            <div class="crossbase-pair-side">
              <div class="crossbase-pair-side-label">ドライバー</div>
              <div class="crossbase-pair-side-name" title="${driver.name}">${driver.name}</div>
              <span class="crossbase-pair-side-base" style="color:${dColor};background:${dColor}1a">
                <span class="cb-dot"></span>
                ${dBase ? dBase.name : '拠点未設定'}
              </span>
            </div>
            <div class="crossbase-pair-arrow">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
            <div class="crossbase-pair-side">
              <div class="crossbase-pair-side-label">車両</div>
              <div class="crossbase-pair-side-name" title="${newVehicle.plate}">${newVehicle.plate}（${newVehicle.type} ${newVehicle.ton}t）</div>
              <span class="crossbase-pair-side-base" style="color:${vColor};background:${vColor}1a">
                <span class="cb-dot"></span>
                ${vBase ? vBase.name : '拠点未設定'}
              </span>
            </div>
          </div>
        </div>

        <div class="crossbase-confirm-section">
          <div class="crossbase-confirm-section-title">当日の運用拠点</div>
          <div class="crossbase-runtime-base">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${effectiveColor}" stroke-width="2.5">
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h2M9 13h2M9 17h2M13 9h2M13 13h2M13 17h2"/>
            </svg>
            <span>出庫：<strong>${effectiveBase ? effectiveBase.name : '不明'}</strong></span>
            <select id="crossbase-effective-base" style="margin-left:8px;padding:3px 6px;font-size:11px;border:1px solid #cbd5e1;border-radius:6px;background:#fff">
              ${(window.bases || []).map(b => `<option value="${b.id}" ${b.id === (effectiveBase && effectiveBase.id) ? 'selected' : ''}>${b.name}</option>`).join('')}
            </select>
            ${distance != null
              ? `<span class="crossbase-distance">距離 ${distance}km</span>`
              : ''}
          </div>
        </div>

        <div class="crossbase-confirm-section">
          <div class="crossbase-confirm-section-title">オプション</div>
          <div class="crossbase-options">
            <label class="crossbase-option">
              <input type="checkbox" id="crossbase-opt-return" checked>
              <div>
                <div class="crossbase-option-text">翌日朝の戻り回送を自動登録する</div>
                <div class="crossbase-option-hint">${vBase ? vBase.name : '車両拠点'} → ${dBase ? dBase.name : 'ドライバー拠点'}（6:00〜9:00予定）</div>
              </div>
            </label>
            <label class="crossbase-option">
              <input type="checkbox" id="crossbase-opt-notify" checked>
              <div>
                <div class="crossbase-option-text">受け入れ拠点の担当者に通知する</div>
                <div class="crossbase-option-hint">${vBase ? vBase.name : ''}の担当者・ドライバー本人・車両拠点担当に自動送信（デモ）</div>
              </div>
            </label>
          </div>
        </div>
      </div>
      <div class="crossbase-confirm-footer">
        <button class="crossbase-btn crossbase-btn-cancel" onclick="window.__closeCrossBaseDialog(false)">キャンセル</button>
        <button class="crossbase-btn crossbase-btn-confirm" onclick="window.__confirmCrossBaseDialog()">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          この内容で配車
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  // 状態を保存（onConfirm/onCancel コールバック用）
  window.__crossBaseDialogState = options;
};

function _closeCrossBaseDialog(cancelCb) {
  const el = document.getElementById('crossbase-confirm-backdrop');
  if (el) el.remove();
  if (typeof cancelCb === 'function') cancelCb();
  window.__crossBaseDialogState = null;
}

window.__closeCrossBaseDialog = function(cancel) {
  const state = window.__crossBaseDialogState;
  _closeCrossBaseDialog(cancel === false ? null : (state && state.onCancel));
};

window.__confirmCrossBaseDialog = function() {
  const state = window.__crossBaseDialogState;
  if (!state) return;
  const createReturn = !!(document.getElementById('crossbase-opt-return') || {}).checked;
  const notify = !!(document.getElementById('crossbase-opt-notify') || {}).checked;
  const effSel = document.getElementById('crossbase-effective-base');
  const effectiveBaseId = effSel ? effSel.value : null;
  _closeCrossBaseDialog(null);
  if (typeof state.onConfirm === 'function') {
    state.onConfirm({
      createReturn,
      notifyReceiving: notify,
      effectiveBaseId
    });
  }
};

// ═══════════════════════════════════════════════════════════════
//  Phase 1d：D&D配車時のクロス警告チェック
//  ドロップされたドライバーと、自動で割り当てられる車両（既定はドライバー固定車両）の
//  拠点が異なる場合にクロス配車確認ダイアログを開く。
//  ユーザーがOKしたら effectiveBaseId と関連設定を適用、キャンセルなら配車を取り消す。
// ═══════════════════════════════════════════════════════════════
window.__checkDndCrossBaseAndConfirm = function(opts) {
  const { driverId, caseObj, block, dateKey } = opts || {};
  if (!driverId || !block || !dateKey) return;

  // 旧driverId(='V'+num) → 新driverId / vehicleId に解決
  const newDriverId = (typeof _legacyDriverIdToNew === 'function')
    ? _legacyDriverIdToNew(driverId) : null;
  const vehicleId = driverId;  // 旧形式では driverId === vehicleId
  if (!newDriverId) return;

  const masterD = (typeof window.getDriverById === 'function') ? window.getDriverById(newDriverId) : null;
  const masterV = (typeof window.getVehicleById === 'function') ? window.getVehicleById(vehicleId) : null;
  if (!masterD || !masterV) return;

  // 協力会社ドライバーはクロス配車対象外（論点3）
  if (masterD.partner) return;
  // ドライバーに拠点がなければ判定不能
  if (!masterD.baseId || !masterV.baseId) return;

  // 案件の発地から拠点ID推定
  const caseFromBaseId = (typeof window.resolveBaseIdByAlias === 'function')
    ? window.resolveBaseIdByAlias(caseObj.from)
    : null;

  // クロス配車判定：以下のいずれかでクロス
  //   (a) ドライバー拠点 ≠ 車両拠点
  //   (b) 案件発地拠点（解決できれば）≠ ドライバー拠点
  const driverVsVehicle = masterD.baseId !== masterV.baseId;
  const driverVsCase = caseFromBaseId && caseFromBaseId !== masterD.baseId;

  if (!driverVsVehicle && !driverVsCase) return;  // クロスでない → 警告不要

  // 該当する Assignment を探す（dndTrackDrop で push されたもの）
  let targetAssignment = null;
  if (typeof assignments !== 'undefined') {
    targetAssignment = assignments.find(a =>
      a.driverId === newDriverId &&
      a.start === block.start &&
      a.end === block.end &&
      a.client === block.client
    );
  }

  // ダイアログを開く
  window.openCrossBaseConfirmDialog({
    caseObj,
    driverId: newDriverId,
    newVehicleId: vehicleId,
    onConfirm: function(dlgOpts) {
      // effectiveBaseId 更新
      if (targetAssignment && typeof window.updateAssignment === 'function') {
        window.updateAssignment(targetAssignment.id, {
          effectiveBaseId: dlgOpts.effectiveBaseId
        }, (typeof window.__getCurrentUserId === 'function' ? window.__getCurrentUserId() : null));
      }
      // 戻り回送の自動生成
      if (dlgOpts.createReturn && targetAssignment
          && typeof window.createReturnAssignment === 'function') {
        const ret = window.createReturnAssignment(targetAssignment.id);
        if (ret && typeof showDndToast === 'function') {
          showDndToast(`✓ クロス配車を確定 ／ 翌日朝に戻り回送を登録しました`);
        }
      }
      // 通知（デモ）
      if (dlgOpts.notifyReceiving && typeof showDndToast === 'function') {
        showDndToast(`✓ 受け入れ拠点の担当者に通知しました（デモ）`);
      }
      // 表示更新
      if (typeof renderDnd === 'function') renderDnd();
      if (typeof window.__refreshAssignFilterBar === 'function') window.__refreshAssignFilterBar();
    },
    onCancel: function() {
      // 配車自体を取り消す：ブロックを dndAssignments から削除し、未割当に戻す
      try {
        if (typeof dndAssignments !== 'undefined' && dndAssignments[driverId]) {
          const arr = dndAssignments[driverId][dateKey] || [];
          const idx = arr.findIndex(b =>
            b.client === block.client && b.start === block.start && b.end === block.end
          );
          if (idx >= 0) arr.splice(idx, 1);
        }
        // 新Assignmentからも削除
        if (targetAssignment && typeof window.deleteAssignment === 'function') {
          window.deleteAssignment(targetAssignment.id,
            (typeof window.__getCurrentUserId === 'function' ? window.__getCurrentUserId() : null));
        }
        // 案件は未割当に残ったまま（dndUnassignedCases に戻る必要があるかは caseObj が残るので問題なし）
        if (typeof renderDnd === 'function') renderDnd();
        if (typeof showDndToast === 'function') showDndToast('クロス配車をキャンセルしました', false);
      } catch (e) {
        console.warn('[D&D cross cancel] cleanup failed:', e);
      }
    }
  });
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  複数台配車 ヘルパー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function setVehicleMode(caseIdx, mode) {
  const c = processingCases[caseIdx];
  c.vehicleMode = mode;
  if (mode === 'multi' && (!c.legs || c.legs.length === 0)) {
    // 初回: 第1便を自動追加（AI推薦1位を初期値）
    const v = c.vehicles[0];
    c.legs = [{
      legId: 'leg-' + Date.now(),
      legNo: 1,
      vehicleId: v.id,
      vehicleName: v.id,
      driverName: v.driver,
      capacity: v.cap,
      vehicleType: v.cap.includes('2,000')||v.cap.includes('2t') ? '2t車' : v.cap.includes('1,500') ? '中型' : '小型',
      role: 'main',
      reason: '',
      notes: '',
      vehicleIdx: 0,
      lawOk: v.law ? v.law.items.every(it=>it.ok) : true,
    }];
  } else if (mode === 'relay' && (!c.legs || c.legs.length === 0 || !c.legs[0].relayFrom)) {
    // リレー輸送の初期化：2区間を自動セットアップ
    const v1 = c.vehicles[0];
    const v2 = c.vehicles[1] || c.vehicles[0];
    // 中継地点の自動推定（出発地と到着地の中間的な地点）
    const midpoint = _suggestRelayMidpoint(c.from, c.to);
    c.legs = [
      {
        legId: 'relay-' + Date.now() + '-1',
        legNo: 1,
        vehicleId: v1.id,
        vehicleName: v1.id,
        driverName: v1.driver,
        capacity: v1.cap,
        vehicleType: v1.cap.includes('2,000')||v1.cap.includes('2t') ? '2t車' : v1.cap.includes('1,500') ? '中型' : '小型',
        role: 'relay',
        relayFrom: c.from,
        relayTo: midpoint,
        startTime: '06:00',
        endTime: '10:00',
        reason: '',
        notes: '出発地から中継地点まで',
        vehicleIdx: 0,
        lawOk: v1.law ? v1.law.items.every(it=>it.ok) : true,
      },
      {
        legId: 'relay-' + Date.now() + '-2',
        legNo: 2,
        vehicleId: v2.id,
        vehicleName: v2.id,
        driverName: v2.driver,
        capacity: v2.cap,
        vehicleType: v2.cap.includes('2,000')||v2.cap.includes('2t') ? '2t車' : v2.cap.includes('1,500') ? '中型' : '小型',
        role: 'relay',
        relayFrom: midpoint,
        relayTo: c.to,
        startTime: '10:30',
        endTime: '14:30',
        reason: '',
        notes: '中継地点から到着地まで',
        vehicleIdx: 1,
        lawOk: v2.law ? v2.law.items.every(it=>it.ok) : true,
      }
    ];
    // jobIdを割り当て
    if (!c.jobId) c.jobId = 'J-' + (c.id || 'NEW') + '-' + Date.now();
  }
  renderProcessingDetail(caseIdx);
}

// 出発地・到着地から中継地点を推定（簡易実装：地理的中間点）
function _suggestRelayMidpoint(from, to) {
  // 主要なリレー中継地のマッピング
  const relayRoutes = {
    '東京_大阪': '愛知県名古屋市', '大阪_東京': '愛知県名古屋市',
    '東京_福岡': '大阪府大阪市', '福岡_東京': '大阪府大阪市',
    '東京_仙台': '福島県郡山市', '仙台_東京': '栃木県宇都宮市',
    '東京_札幌': '宮城県仙台市', '札幌_東京': '宮城県仙台市',
    '大阪_福岡': '広島県広島市', '福岡_大阪': '広島県広島市',
    '名古屋_福岡': '大阪府大阪市', '福岡_名古屋': '大阪府大阪市',
  };
  // 出発・到着から地名キーを抽出（県/市レベル）
  function extractKey(addr) {
    if (!addr) return '';
    const cities = ['東京', '大阪', '名古屋', '福岡', '仙台', '札幌', '広島', '横浜', '川崎'];
    for (const c of cities) {
      if (addr.includes(c)) return c;
    }
    return addr.replace(/[県都府道市区].*$/, '').substring(0, 4);
  }
  const fromKey = extractKey(from);
  const toKey = extractKey(to);
  const routeKey = fromKey + '_' + toKey;
  if (relayRoutes[routeKey]) return relayRoutes[routeKey];
  // フォールバック：「中継地点」とのみ
  return '中継地点（未設定）';
}

// リレー輸送のレッグリストを描画
function renderRelayList(caseIdx, c) {
  const legs = c.legs || [];
  if (legs.length === 0) {
    return '<div style="padding:14px;text-align:center;color:#9ca3af;font-size:11px">区間がまだ設定されていません</div>';
  }
  return legs.map((leg, li) => {
    const isLast = li === legs.length - 1;
    const v = c.vehicles[leg.vehicleIdx || 0];
    const lawOk = leg.lawOk !== false;
    return `
      <div class="relay-leg-card">
        <div class="relay-leg-header">
          <span class="relay-leg-no">区間 ${leg.legNo}</span>
          <span class="relay-leg-route">${leg.relayFrom || '—'} → ${leg.relayTo || '—'}</span>
          ${legs.length > 2 ? `<button class="relay-leg-del" onclick="removeRelayLeg(${caseIdx}, ${li})" title="この区間を削除">×</button>` : ''}
        </div>
        <div class="relay-leg-body">
          <div class="relay-leg-fields">
            <label class="relay-leg-field">
              <span class="relay-leg-label">出発地</span>
              <input type="text" value="${leg.relayFrom || ''}" placeholder="出発地"
                     onchange="updateRelayLeg(${caseIdx}, ${li}, 'relayFrom', this.value)">
            </label>
            <label class="relay-leg-field">
              <span class="relay-leg-label">中継地/到着地</span>
              <input type="text" value="${leg.relayTo || ''}" placeholder="${isLast ? '到着地' : '中継地'}"
                     onchange="updateRelayLeg(${caseIdx}, ${li}, 'relayTo', this.value)">
            </label>
          </div>
          <div class="relay-leg-fields">
            <label class="relay-leg-field">
              <span class="relay-leg-label">出発時刻</span>
              <input type="time" value="${leg.startTime || ''}"
                     onchange="updateRelayLeg(${caseIdx}, ${li}, 'startTime', this.value)">
            </label>
            <label class="relay-leg-field">
              <span class="relay-leg-label">到着時刻</span>
              <input type="time" value="${leg.endTime || ''}"
                     onchange="updateRelayLeg(${caseIdx}, ${li}, 'endTime', this.value)">
            </label>
          </div>
          <div class="relay-leg-driver-row">
            <select onchange="setRelayLegVehicle(${caseIdx}, ${li}, this.value)" class="relay-leg-vselect">
              ${c.vehicles.map((vv, vi) => `<option value="${vi}" ${vi === (leg.vehicleIdx||0) ? 'selected' : ''}>${vv.driver}（${vv.id} ${vv.cap}）${vv.law && vv.law.items.every(it=>it.ok) ? ' ✅' : ' ⚠️'}</option>`).join('')}
            </select>
            ${!lawOk ? '<span class="relay-leg-warn">⚠️ 改善基準告示で要確認</span>' : '<span class="relay-leg-ok">✅ 法令適合</span>'}
          </div>
        </div>
        ${!isLast ? `
          <div class="relay-handoff">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="10"/><path d="M12 2v4M12 18v4"/></svg>
            <span>中継地点で運転手交代</span>
          </div>
        ` : ''}
      </div>
    `;
  }).join('') + (legs.length < 4 ? `
    <button class="relay-add-btn" onclick="addRelayLeg(${caseIdx})">
      <span style="font-size:14px">＋</span> 区間を追加（最大4区間）
    </button>
  ` : '');
}

// リレーレッグの追加
function addRelayLeg(caseIdx) {
  const c = processingCases[caseIdx];
  if (!c.legs) c.legs = [];
  if (c.legs.length >= 4) { showToast('リレー輸送は最大4区間まで追加できます', 'warn'); return; }
  const lastLeg = c.legs[c.legs.length - 1];
  const newLegNo = c.legs.length + 1;
  const usedIds = c.legs.map(l => l.vehicleId);
  const nextV = c.vehicles.find(v => !usedIds.includes(v.id)) || c.vehicles[0];
  // 前区間の終了時刻＋30分インターバルで開始時刻を提案
  let nextStart = '12:00';
  let nextEnd = '16:00';
  if (lastLeg && lastLeg.endTime) {
    const [eh, em] = lastLeg.endTime.split(':').map(Number);
    let sh = eh, sm = em + 30;
    if (sm >= 60) { sh++; sm -= 60; }
    nextStart = String(sh).padStart(2,'0') + ':' + String(sm).padStart(2,'0');
    nextEnd = String(Math.min(23, sh + 4)).padStart(2,'0') + ':' + String(sm).padStart(2,'0');
  }
  c.legs.push({
    legId: 'relay-' + Date.now() + '-' + newLegNo,
    legNo: newLegNo,
    vehicleId: nextV.id,
    vehicleName: nextV.id,
    driverName: nextV.driver,
    capacity: nextV.cap,
    role: 'relay',
    relayFrom: lastLeg ? lastLeg.relayTo : c.from,
    relayTo: c.to,
    startTime: nextStart,
    endTime: nextEnd,
    notes: '',
    vehicleIdx: c.vehicles.indexOf(nextV) >= 0 ? c.vehicles.indexOf(nextV) : 0,
    lawOk: nextV.law ? nextV.law.items.every(it=>it.ok) : true,
  });
  // 前区間の到着地と新区間の出発地を連動させる
  if (lastLeg) {
    lastLeg.relayTo = lastLeg.relayTo === c.to ? '中継地点（未設定）' : lastLeg.relayTo;
  }
  renderProcessingDetail(caseIdx);
}

// リレーレッグの削除
function removeRelayLeg(caseIdx, legIdx) {
  const c = processingCases[caseIdx];
  if (!c.legs || c.legs.length <= 2) {
    showToast('リレー輸送は最低2区間が必要です', 'warn');
    return;
  }
  c.legs.splice(legIdx, 1);
  // legNo を振り直し
  c.legs.forEach((l, i) => l.legNo = i + 1);
  renderProcessingDetail(caseIdx);
}

// リレーレッグの値を更新
function updateRelayLeg(caseIdx, legIdx, field, value) {
  const c = processingCases[caseIdx];
  const leg = c.legs[legIdx];
  if (!leg) return;
  leg[field] = value;
  // 中継地点の自動連動：相手の出発地を更新
  if (field === 'relayTo' && legIdx < c.legs.length - 1) {
    c.legs[legIdx + 1].relayFrom = value;
  } else if (field === 'relayFrom' && legIdx > 0) {
    c.legs[legIdx - 1].relayTo = value;
  }
  renderProcessingDetail(caseIdx);
}

// リレーレッグの車両/ドライバーを変更
function setRelayLegVehicle(caseIdx, legIdx, vehicleIdx) {
  const c = processingCases[caseIdx];
  const leg = c.legs[legIdx];
  const v = c.vehicles[parseInt(vehicleIdx, 10)];
  if (!leg || !v) return;
  leg.vehicleIdx = parseInt(vehicleIdx, 10);
  leg.vehicleId = v.id;
  leg.vehicleName = v.id;
  leg.driverName = v.driver;
  leg.capacity = v.cap;
  leg.lawOk = v.law ? v.law.items.every(it=>it.ok) : true;
  renderProcessingDetail(caseIdx);
}

function toggleMultiReason(caseIdx, reason) {
  const c = processingCases[caseIdx];
  if (!c.multiReasons) c.multiReasons = [];
  const idx = c.multiReasons.indexOf(reason);
  if (idx >= 0) c.multiReasons.splice(idx, 1);
  else c.multiReasons.push(reason);
  // 理由チップだけ再描画（ちらつき抑止）
  renderProcessingDetail(caseIdx);
}

function addLeg(caseIdx) {
  const c = processingCases[caseIdx];
  if (!c.legs) c.legs = [];
  if (c.legs.length >= 3) { showToast('自社便は最大3台まで追加できます', 'warn'); return; }
  const legNo = c.legs.length + 1;
  // 未使用の推薦候補を探す
  const usedIds = c.legs.map(l=>l.vehicleId);
  const nextV = c.vehicles.find(v => !usedIds.includes(v.id)) || c.vehicles[0];
  c.legs.push({
    legId: 'leg-' + Date.now() + legNo,
    legNo,
    vehicleId: nextV.id,
    vehicleName: nextV.id,
    driverName: nextV.driver,
    capacity: nextV.cap,
    vehicleType: '中型',
    role: 'sub',
    reason: '',
    notes: '',
    vehicleIdx: c.vehicles.indexOf(nextV),
    lawOk: nextV.law ? nextV.law.items.every(it=>it.ok) : true,
  });
  renderProcessingDetail(caseIdx);
}

function removeLeg(caseIdx, legIdx) {
  const c = processingCases[caseIdx];
  c.legs.splice(legIdx, 1);
  c.legs.forEach((l,i) => l.legNo = i+1);
  if (c.legs.length === 0) {
    c.vehicleMode = 'single';
  }
  renderProcessingDetail(caseIdx);
}

function updateLegVehicle(caseIdx, legIdx, vehicleIdx) {
  const c = processingCases[caseIdx];
  const v = c.vehicles[vehicleIdx];
  if (!v) return;
  c.legs[legIdx].vehicleId   = v.id;
  c.legs[legIdx].vehicleName = v.id;
  c.legs[legIdx].driverName  = v.driver;
  c.legs[legIdx].capacity    = v.cap;
  c.legs[legIdx].vehicleIdx  = vehicleIdx;
  c.legs[legIdx].lawOk       = v.law ? v.law.items.every(it=>it.ok) : true;
  renderProcessingDetail(caseIdx);
  showToast(`第${legIdx+1}便を ${v.driver}（${v.id}）に変更しました`, 'success');
}

function updateLegRole(caseIdx, legIdx, role) {
  processingCases[caseIdx].legs[legIdx].role = role;
}

function updateLegNotes(caseIdx, legIdx, notes) {
  processingCases[caseIdx].legs[legIdx].notes = notes;
}

function renderLegList(caseIdx, c) {
  const legs = c.legs || [];
  if (legs.length === 0) {
    return `<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:12px">
      便が未設定です。「＋ 第1便を追加」ボタンから追加してください。
    </div>`;
  }
  const legHtml = legs.map((leg, li) => {
    const v = c.vehicles[leg.vehicleIdx] || c.vehicles[0];
    const lawIcon = leg.lawOk ? '✅ 法令クリア' : '⚠️ 法令要確認';
    const lawCls  = leg.lawOk ? 'background:#d1fae5;color:#065f46' : 'background:#fef2f2;color:#dc2626';

    // 車両選択プルダウン（AI推薦3候補）
    const vehicleOpts = c.vehicles.map((vv, vi) =>
      `<option value="${vi}" ${leg.vehicleIdx===vi?'selected':''}>${vv.driver}（${vv.id}） ${vv.cap} スコア:${vv.score}</option>`
    ).join('');

    return `<div class="leg-block ${leg.vehicleId?'leg-confirmed':''}" id="leg-block-${caseIdx}-${li}">
      <div class="leg-block-header">
        <div class="leg-no-badge ${li===0?'':'sub'}">${li+1}</div>
        <span style="font-size:12px;font-weight:600;color:var(--text-primary)">第${li+1}便</span>
        <select class="leg-role-select" onchange="updateLegRole(${caseIdx},${li},this.value)">
          <option value="main" ${leg.role==='main'?'selected':''}>主役</option>
          <option value="sub"  ${leg.role==='sub' ?'selected':''}>補助</option>
          <option value="special" ${leg.role==='special'?'selected':''}>特殊</option>
        </select>
        <div class="leg-header-right">
          <span style="font-size:10px;padding:2px 7px;border-radius:10px;${lawCls};font-weight:700">${lawIcon}</span>
          ${li > 0 ? `<button class="leg-remove-btn" onclick="removeLeg(${caseIdx},${li})" title="この便を削除">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>` : ''}
        </div>
      </div>
      <!-- 車両選択 -->
      <div style="padding:8px 12px;background:#fafafa;border-bottom:1px solid #f3f4f6">
        <div style="font-size:10px;font-weight:600;color:var(--text-secondary);margin-bottom:4px">AI推薦候補から選択</div>
        <select style="width:100%;border:1px solid var(--border);border-radius:6px;padding:7px 10px;font-size:12px;font-family:'Noto Sans JP',sans-serif;background:#fff;outline:none;cursor:pointer"
          onchange="updateLegVehicle(${caseIdx},${li},this.value)">
          ${vehicleOpts}
        </select>
      </div>
      <!-- 選択中サマリー -->
      <div class="leg-selected-summary">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/></svg>
        ${leg.driverName}（${leg.vehicleName}）· ${leg.capacity}
        <span class="law-ok-pill">${leg.lawOk?'法令✓':'⚠️'}</span>
      </div>
      <!-- 備考 -->
      <div style="padding:6px 12px 8px">
        <input type="text" placeholder="備考（帰り荷の都合、特記事項など）" value="${leg.notes||''}"
          oninput="updateLegNotes(${caseIdx},${li},this.value)"
          style="width:100%;border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:11px;font-family:'Noto Sans JP',sans-serif;outline:none;color:var(--text-primary)"
          onfocus="this.style.borderColor='var(--sidebar-bg)'" onblur="this.style.borderColor='var(--border)'">
      </div>
    </div>`;
  }).join('');

  const addDisabled = legs.length >= 3;
  return legHtml + `
    <button class="add-leg-btn" onclick="addLeg(${caseIdx})" ${addDisabled?'disabled':''}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      第${legs.length+1}便を追加${addDisabled?' （上限3台）':''}
    </button>`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  処理済みフェーズ描画
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ── 処理済みフィルター・チェックボックス状態 ──
let billingFilter = 'all'; // 'all' | 'pending' | 'confirmed'
let processedCheckedIds = new Set();

function getFilteredProcessedCases() {
  var r = patternFilterProcessed === 'all' ? processedCases : processedCases.filter(function(c){ return c.casePattern === patternFilterProcessed; });
  if (partnerFilter === 'partner') r = r.filter(function(c){ return c.partner; });
  else if (partnerFilter === 'own') r = r.filter(function(c){ return !c.partner; });
  if (billingFilter === 'pending')   r = r.filter(function(c){ return !c.billingConfirmed; });
  if (billingFilter === 'confirmed') r = r.filter(function(c){ return  c.billingConfirmed; });
  return r;
}

function setBillingFilter(val) {
  billingFilter = val;
  ['all','pending','confirmed'].forEach(function(k) {
    var t = document.getElementById('bft-' + k);
    if (t) t.classList.toggle('active', k === val);
  });
  renderProcessedList();
  var cases = getFilteredProcessedCases();
  if (cases.length) renderProcessedDetail(processedCases.indexOf(cases[0]));
  else document.getElementById('processed-detail').innerHTML = '';
}

function updateProcessedSelUI() {
  var cases = getFilteredProcessedCases();
  var selCount = cases.filter(function(c){ return processedCheckedIds.has(c.id); }).length;
  var total = cases.length;
  var allChk = document.getElementById('processed-check-all');
  if (allChk) {
    var allChecked  = total > 0 && cases.every(function(c){ return processedCheckedIds.has(c.id); });
    var someChecked = cases.some(function(c){ return processedCheckedIds.has(c.id); });
    allChk.checked = allChecked;
    allChk.indeterminate = !allChecked && someChecked;
  }
  var totalEl = document.getElementById('processed-total-count');
  if (totalEl) totalEl.textContent = total + ' 件';
  var selCountEl = document.getElementById('processed-sel-count');
  if (selCountEl) {
    selCountEl.textContent = selCount + ' 件選択中';
    selCountEl.style.display = selCount > 0 ? 'inline-flex' : 'none';
  }
  var bar = document.getElementById('processed-bulk-bar');
  if (bar) bar.classList.toggle('visible', selCount > 0);
  var barLabel = document.getElementById('bulk-bar-label');
  if (barLabel) barLabel.textContent = selCount + ' 件選択中';
}

function toggleProcessedAll(checked) {
  var cases = getFilteredProcessedCases();
  if (checked) cases.forEach(function(c){ processedCheckedIds.add(c.id); });
  else processedCheckedIds.clear();
  renderProcessedList();
}

function toggleProcessedOne(id, checked, event) {
  if (event) event.stopPropagation();
  if (checked) processedCheckedIds.add(id);
  else processedCheckedIds.delete(id);
  var realIdx = processedCases.findIndex(function(c){ return c.id === id; });
  var card = document.getElementById('dcard-' + realIdx);
  if (card) card.classList.toggle('checked', checked);
  updateProcessedSelUI();
}

function clearProcessedSelection() {
  processedCheckedIds.clear();
  renderProcessedList();
}

function bulkBillingConfirm() {
  var cases = getFilteredProcessedCases().filter(function(c){ return processedCheckedIds.has(c.id) && !c.billingConfirmed; });
  if (!cases.length) { showToast('選択中の未確定案件がありません', 'info'); return; }
  openBulkCsvModal(cases);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  一括請求確定 CSV アップロードモーダル
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// CSVの列定義
var CSV_COLUMNS = [
  { key: 'id',          label: '案件番号',       required: true  },
  { key: 'client',      label: '取引先',         required: true  },
  { key: 'invoiceNo',   label: '請求書番号',      required: true  },
  { key: 'invoiceDate', label: '請求日',         required: true  },
  { key: 'due',         label: '支払期限',       required: true  },
  { key: 'sales',       label: '売上金額',       required: true  },
  { key: 'fuel',        label: '燃料費',         required: false },
  { key: 'other',       label: 'その他費用',     required: false },
  { key: 'from',        label: '発地',           required: false },
  { key: 'to',          label: '着地',           required: false },
  { key: 'distance',    label: '走行距離',       required: false },
  { key: 'driver',      label: 'ドライバー',     required: false },
  { key: 'vehicle',     label: '車両番号',       required: false },
];

var _bulkCsvTargetCases = [];
var _bulkCsvParsedRows  = [];

function openBulkCsvModal(cases) {
  _bulkCsvTargetCases = cases;
  _bulkCsvParsedRows  = [];

  // サブタイトル
  var sub = document.getElementById('bcm-csv-subtitle');
  if (sub) sub.textContent = cases.length + ' 件の未確定案件を一括請求確定します';

  // 列チップ描画
  var chips = document.getElementById('bcm-col-chips');
  if (chips) {
    chips.innerHTML = CSV_COLUMNS.map(function(col) {
      return '<span class="bcm-col-chip' + (col.required ? ' required' : '') + '">'
        + (col.required ? '★ ' : '') + col.label + '</span>';
    }).join('');
  }

  // リセット
  bcmClearFile();
  var modal = document.getElementById('bulk-csv-modal');
  modal.classList.add('open');
}

function closeBulkCsvModal() {
  var modal = document.getElementById('bulk-csv-modal');
  modal.classList.remove('open');
  bcmClearFile();
}

// ── ドラッグ＆ドロップ ──
function bcmDragOver(e) {
  e.preventDefault();
  document.getElementById('bcm-drop-zone').classList.add('dragover');
}
function bcmDragLeave(e) {
  document.getElementById('bcm-drop-zone').classList.remove('dragover');
}
function bcmDrop(e) {
  e.preventDefault();
  document.getElementById('bcm-drop-zone').classList.remove('dragover');
  var file = e.dataTransfer.files[0];
  if (file) bcmFileSelected(file);
}

function bcmClearFile() {
  _bulkCsvParsedRows = [];
  var inp = document.getElementById('bcm-file-input');
  if (inp) inp.value = '';
  var wrap = document.getElementById('bcm-preview-wrap');
  if (wrap) wrap.classList.remove('show');
  var err = document.getElementById('bcm-err-banner');
  if (err) err.classList.remove('show');
  var btn = document.getElementById('bcm-csv-submit-btn');
  if (btn) btn.disabled = true;
  var lbl = document.getElementById('bcm-submit-label');
  if (lbl) lbl.textContent = '一括請求確定する';
}

function bcmShowError(msg) {
  var err = document.getElementById('bcm-err-banner');
  var txt = document.getElementById('bcm-err-text');
  if (err && txt) { txt.textContent = msg; err.classList.add('show'); }
  var btn = document.getElementById('bcm-csv-submit-btn');
  if (btn) btn.disabled = true;
}

function bcmFileSelected(file) {
  if (!file) return;
  if (!file.name.match(/\.csv$/i)) { bcmShowError('CSVファイル（.csv）を選択してください'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      bcmParseAndPreview(e.target.result);
    } catch(err) {
      bcmShowError('CSVの読み込みに失敗しました: ' + err.message);
    }
  };
  reader.readAsText(file, 'UTF-8');
}

function bcmParseCsvLine(line) {
  var result = []; var cur = ''; var inQ = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      result.push(cur.trim()); cur = '';
    } else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
}

function bcmParseAndPreview(text) {
  // BOM除去
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  var lines = text.replace(/\r/g,'').split('\n').filter(function(l){ return l.trim() !== ''; });
  if (lines.length < 2) { bcmShowError('データ行がありません（ヘッダー行 + 1行以上必要です）'); return; }

  var headers = bcmParseCsvLine(lines[0]);
  var requiredKeys = CSV_COLUMNS.filter(function(c){ return c.required; }).map(function(c){ return c.label; });

  // 必須列チェック
  var missing = requiredKeys.filter(function(r){ return headers.indexOf(r) === -1; });
  if (missing.length) {
    bcmShowError('必須列が見つかりません: ' + missing.join(', '));
    return;
  }

  var errBanner = document.getElementById('bcm-err-banner');
  if (errBanner) errBanner.classList.remove('show');

  var rows = []; var errCount = 0;
  for (var i = 1; i < lines.length; i++) {
    var vals = bcmParseCsvLine(lines[i]);
    var row = { _rowNum: i + 1, _errors: [] };
    headers.forEach(function(h, idx) {
      var colDef = CSV_COLUMNS.find(function(c){ return c.label === h; });
      if (colDef) row[colDef.key] = vals[idx] || '';
    });
    // 必須バリデーション
    CSV_COLUMNS.filter(function(c){ return c.required; }).forEach(function(col) {
      if (!row[col.key] || row[col.key].trim() === '') {
        row._errors.push(col.label + 'が空です');
      }
    });
    // 案件番号の存在確認
    if (row.id) {
      var matched = processedCases.find(function(c){ return c.id === row.id.trim(); });
      if (!matched) row._errors.push('案件番号が一致しません');
    }
    if (row._errors.length) errCount++;
    rows.push(row);
  }

  _bulkCsvParsedRows = rows;

  // プレビュー表示
  var previewCols = CSV_COLUMNS.slice(0, 7); // 最初の7列を表示
  var thead = document.getElementById('bcm-preview-thead');
  var tbody = document.getElementById('bcm-preview-tbody');
  if (thead) {
    thead.innerHTML = '<tr><th>状態</th>'
      + previewCols.map(function(c){ return '<th>' + c.label + '</th>'; }).join('')
      + '</tr>';
  }
  if (tbody) {
    tbody.innerHTML = rows.map(function(row) {
      var ok = row._errors.length === 0;
      return '<tr class="' + (ok ? 'row-ok' : 'row-warn') + '">'
        + '<td>' + (ok ? '✅' : '⚠️ ' + row._errors[0]) + '</td>'
        + previewCols.map(function(c){ return '<td>' + (row[c.key] || '') + '</td>'; }).join('')
        + '</tr>';
    }).join('');
  }

  var wrap = document.getElementById('bcm-preview-wrap');
  if (wrap) wrap.classList.add('show');

  var cnt = document.getElementById('bcm-preview-count');
  if (cnt) cnt.textContent = rows.length + ' 件 読み込み済み';

  var errCnt = document.getElementById('bcm-preview-err-count');
  if (errCnt) errCnt.textContent = errCount > 0 ? '⚠️ ' + errCount + ' 件にエラー' : '';

  var btn = document.getElementById('bcm-csv-submit-btn');
  var lbl = document.getElementById('bcm-submit-label');
  var validCount = rows.filter(function(r){ return r._errors.length === 0; }).length;
  if (btn) btn.disabled = validCount === 0;
  if (lbl) lbl.textContent = validCount + ' 件を一括請求確定する';
}

function downloadSampleCsv() {
  var headers = CSV_COLUMNS.map(function(c){ return c.label; });
  // サンプルデータ（選択中の案件 or デフォルト）
  var sampleRows = _bulkCsvTargetCases.length > 0
    ? _bulkCsvTargetCases.map(function(c) {
        return CSV_COLUMNS.map(function(col) {
          var v = c[col.key] !== undefined ? c[col.key] : '';
          return String(v).indexOf(',') !== -1 ? '"' + v + '"' : v;
        }).join(',');
      })
    : [CSV_COLUMNS.map(function(col){
        var ex = { id:'20240524001', client:'株式会社○○商事', invoiceNo:'INV-202405-00123',
                   invoiceDate:'2024/05/26', due:'2024/06/30', sales:'45000', fuel:'18000',
                   other:'0', from:'埼玉県川口市', to:'神奈川県横浜市', distance:'35km',
                   driver:'山田 一郎', vehicle:'1245' };
        return ex[col.key] !== undefined ? ex[col.key] : '';
      }).join(',')];

  var csv = '\uFEFF' + headers.join(',') + '\n' + sampleRows.join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'logipoke_bulk_billing_sample.csv';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast('サンプルCSVをダウンロードしました', 'success');
}

function executeBulkCsvConfirm() {
  var validRows = _bulkCsvParsedRows.filter(function(r){ return r._errors.length === 0; });
  if (!validRows.length) { showToast('確定できる行がありません', 'info'); return; }

  var now = new Date();
  var pad = function(n){ return String(n).padStart(2,'0'); };
  var nowStr = now.getFullYear() + '/' + pad(now.getMonth()+1) + '/' + pad(now.getDate())
             + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());

  var confirmed = 0;
  validRows.forEach(function(row) {
    var c = processedCases.find(function(pc){ return pc.id === row.id.trim(); });
    if (!c) return;
    // CSV値で上書き（数値変換）
    CSV_COLUMNS.forEach(function(col) {
      if (row[col.key] !== undefined && row[col.key] !== '') {
        if (col.key === 'sales' || col.key === 'fuel' || col.key === 'other') {
          var n = parseInt(String(row[col.key]).replace(/,/g,''));
          if (!isNaN(n)) c[col.key] = n;
        } else {
          c[col.key] = row[col.key];
        }
      }
    });
    // 粗利再計算
    c.profit = (c.sales||0) - (c.fuel||0) - (c.other||0);
    c.margin = c.sales > 0 ? Math.round(c.profit / c.sales * 100) : 0;
    c.billingConfirmed    = true;
    c.billingConfirmedAt  = nowStr;
    c.billingConfirmedBy  = '配車 太郎';
    confirmed++;
  });

  processedCheckedIds.clear();
  closeBulkCsvModal();
  renderProcessedList();
  renderProcessedDetail(selectedProcessed);
  if (typeof renderInvoiceList === 'function') renderInvoiceList();
  showToast(confirmed + ' 件を一括請求確定しました', 'ok');
}

function renderProcessedList() {
  var el = document.getElementById('processed-list');
  var cases = getFilteredProcessedCases();
  el.innerHTML = cases.map(function(c, i) {
    var realIdx = processedCases.indexOf(c);
    var pat = c.casePattern ? CASE_PATTERNS[c.casePattern] : null;
    var patMini = pat
      ? '<span class="case-pattern-mini" style="background:' + pat.bgColor + ';color:' + pat.color + ';border-color:' + pat.borderColor + ';font-size:11px;padding:2px 8px">' + pat.id + '</span>'
      : '';
    var partnerBadge = c.partner
      ? '<span class="partner-badge">\uD83E\uDD1D ' + (c.partnerName || '\u5354\u529B\u4F1A\u793E') + '</span>'
      : '';
    var multiBadge = c.multiCase
      ? '<span class="multi-badge">\u7B2C'+c.legNo+'\u4FBF/'+c.totalLegs+'\u53F0</span>'
      : '';
    var billingBadge = c.billingConfirmed
      ? '<span class="billing-confirmed-badge"><svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" style="width:9px;height:9px;stroke:#6DD5A8"><polyline points="20 6 9 17 4 12"/></svg>\u8ACB\u6C42\u78BA\u5B9A</span>'
      : '<span class="billing-pending-badge">\u8ACB\u6C42\u672A\u78BA\u5B9A</span>';
    var isChecked  = processedCheckedIds.has(c.id);
    var isSelected = realIdx === selectedProcessed;
    return '<div class="processed-card'
      + (isSelected ? ' selected' : '')
      + (isChecked  ? ' checked'  : '')
      + '" onclick="selectProcessed(' + realIdx + ')" id="dcard-' + realIdx + '">'
      + '<div class="processed-card-check">'
      + '<input type="checkbox"' + (isChecked ? ' checked' : '')
      + ' onclick="event.stopPropagation()"'
      + ' onchange="toggleProcessedOne(\'' + c.id + '\',this.checked,event)">'
      + '</div>'
      + '<div class="processed-card-body">'
      + '<div class="case-card-header">'
      + '<span class="case-no">No. ' + c.id + '</span>'
      + '<div style="display:flex;gap:4px;align-items:center;margin-left:auto;flex-wrap:wrap">'
      + partnerBadge + multiBadge + patMini
      + '<span class="completed-badge">\u5B8C\u4E86</span>'
      + '</div></div>'
      + '<div class="case-client">' + c.client + '</div>'
      + '<div class="case-route">'
      + '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>'
      + c.from + ' \u2192 ' + c.to
      + '</div>'
      + '<div class="case-meta">'
      + '<div class="case-meta-item">\u2705 \u5B8C\u4E86\uFF1A' + c.completion + '</div>'
      + '<div class="case-meta-item">\uD83D\uDCB0 ' + (c.paid ? '\u5165\u91D1\u6E08' : '\u672A\u5165\u91D1') + '</div>'
      + '</div>'
      + '<div style="margin-top:6px">' + billingBadge + '</div>'
      + '</div>'
      + '</div>';
  }).join('');
  updateProcessedSelUI();
}

let selectedProcessed = 0;
function selectProcessed(i) {
  selectedProcessed = i;
  document.querySelectorAll('#processed-list .processed-card').forEach(function(el) {
    var idx = parseInt(el.id.replace('dcard-', ''));
    el.classList.toggle('selected', idx === i);
  });
  renderProcessedDetail(i);
  setTimeout(function(){ drawLiveMap(i); startLiveUpdates(i); }, 50);
}

function _buildVehicleCard(c) {
  // ── ヘッダーバッジ ──
  const badgeText = c.multiCase
    ? ('複数台 第' + c.legNo + '便/' + c.totalLegs + '台')
    : '割当完了';

  // ── 複数台バナー ──
  let banner = '';
  if (c.multiCase) {
    const roleText = c.legRole === 'main' ? '主役（メイン）' : c.legRole === 'sub' ? '補助' : '特殊';
    const reasonText = c.legReason ? ('　理由：' + c.legReason) : '';
    banner = '<div style="margin-bottom:12px;padding:8px 12px;background:var(--accent-pale);border:1.5px solid var(--sidebar-bg);border-radius:8px;font-size:11px">'
      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;font-weight:700;color:var(--sidebar-bg)">'
      + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/></svg>'
      + '複数台配車 — 第' + c.legNo + '便 / 全' + c.totalLegs + '台'
      + '</div>'
      + '<div style="color:#374151">役割：<b>' + roleText + '</b>' + reasonText + '</div>'
      + '</div>';
  }

  // ── 割当補足行 ──
  const footerRows = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">'
    + '<div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:8px 10px;text-align:center">'
    + '<div style="font-size:9px;color:var(--text-muted);margin-bottom:2px">割当日時</div>'
    + '<div style="font-size:12px;font-weight:700;font-family:\'Inter\',sans-serif">05/24 10:15</div>'
    + '</div>'
    + '<div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:8px 10px;text-align:center">'
    + '<div style="font-size:9px;color:var(--text-muted);margin-bottom:2px">割当担当者</div>'
    + '<div style="font-size:12px;font-weight:700">配車 太郎</div>'
    + '</div>'
    + '<div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:8px 10px;text-align:center">'
    + '<div style="font-size:9px;color:var(--text-muted);margin-bottom:2px">指示送信</div>'
    + '<div style="font-size:12px;font-weight:700;color:var(--green)">✅ 送信済み</div>'
    + '</div>'
    + '</div>';

  return '<div class="detail-card">'
    + '<div class="detail-card-header">'
    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sidebar-bg)" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/></svg>'
    + '<div class="detail-card-title">車両情報（割当済み）</div>'
    + '<span style="margin-left:auto;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;background:#d1fae5;color:#065f46">' + badgeText + '</span>'
    + '</div>'
    + '<div class="detail-card-body">'
    + banner
    + _buildVehicleDriverCard(c)
    + footerRows
    + '</div></div>';
}

function _buildVehicleDriverCard(c) {
  // vehicleMasterData はページ後半で定義されるため、定義済みかチェック
  var masterData = (window.vehicleMasterData && window.vehicleMasterData.length)
    ? window.vehicleMasterData : [];
  var rawId    = c.vehicle || '';
  var lookupId = rawId.replace(/^車両/, '');
  var vm = masterData.find(function(v) {
    return v.id === lookupId || v.id === rawId || v.plate === rawId;
  });

  // マスタから取得、なければ案件データのフォールバック値を使う
  var vType   = vm ? vm.type   : (c.vehicleType   || '—');
  var vCapNum = vm ? vm.cap    : (c.vehicleCap     || null);
  var vCap    = vCapNum ? Number(vCapNum).toLocaleString() + ' kg' : '—';
  var vPlate  = vm ? vm.plate  : (rawId ? '車両' + rawId : '—');
  var vStatus = vm ? vm.status : (c.vehicleStatus  || '—');
  var vMaker  = vm ? (vm.maker + ' ' + vm.model)   : '—';
  var dName   = c.driver || '—';
  var dInitial = (dName && dName !== '—') ? dName.charAt(0) : '？';
  var legLabel = c.multiCase ? ('（第' + c.legNo + '便）') : '';

  return '<div style="display:flex;gap:12px;margin-bottom:14px">'
    + '<div style="flex:1;background:var(--accent-pale);border:1px solid #a7f3d0;border-radius:10px;padding:12px 14px">'
    +   '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
    +     '<div style="width:32px;height:32px;background:var(--sidebar-bg);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0">'
    +       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D4A3A" stroke-width="2.5"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/></svg>'
    +     '</div>'
    +     '<div>'
    +       '<div style="font-size:9px;color:var(--text-muted);font-weight:600;letter-spacing:.05em">車両' + legLabel + '</div>'
    +       '<div style="font-size:14px;font-weight:800;font-family:\'Inter\',sans-serif;color:var(--sidebar-bg)">' + vPlate + '</div>'
    +     '</div>'
    +   '</div>'
    +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">'
    +     '<div><div style="font-size:9px;color:var(--text-muted)">車格</div><div style="font-size:12px;font-weight:600">' + vType + '</div></div>'
    +     '<div><div style="font-size:9px;color:var(--text-muted)">積載量</div><div style="font-size:12px;font-weight:600">' + vCap + '</div></div>'
    +     '<div style="grid-column:span 2"><div style="font-size:9px;color:var(--text-muted)">車種</div><div style="font-size:11px;font-weight:600">' + vMaker + '</div></div>'
    +     '<div><div style="font-size:9px;color:var(--text-muted)">稼働状況</div><div style="font-size:12px;font-weight:600;color:var(--green)">' + vStatus + '</div></div>'
    +   '</div>'
    + '</div>'
    + '<div style="flex:1;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px 14px">'
    +   '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
    +     '<div style="width:32px;height:32px;background:var(--accent);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;font-weight:700;color:#fff">' + dInitial + '</div>'
    +     '<div>'
    +       '<div style="font-size:9px;color:var(--text-muted);font-weight:600;letter-spacing:.05em">ドライバー' + legLabel + '</div>'
    +       '<div style="font-size:14px;font-weight:800;color:var(--sidebar-bg)">' + dName + '</div>'
    +     '</div>'
    +   '</div>'
    +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">'
    +     '<div><div style="font-size:9px;color:var(--text-muted)">所属</div><div style="font-size:12px;font-weight:600">東日本物流</div></div>'
    +     '<div><div style="font-size:9px;color:var(--text-muted)">免許区分</div><div style="font-size:12px;font-weight:600">大型・牽引</div></div>'
    +     '<div><div style="font-size:9px;color:var(--text-muted)">連絡先</div><div style="font-size:12px;font-weight:600">090-XXXX-XXXX</div></div>'
    +     '<div><div style="font-size:9px;color:var(--text-muted)">評価</div><div style="font-size:12px;color:#f59e0b">★★★★★</div></div>'
    +   '</div>'
    + '</div>'
    + '</div>';
}




function renderProcessedDetail(i) {
  const c = processedCases[i];
  const el = document.getElementById('processed-detail');
  if (!c) return;

  var html = '';

  // ── 請求確定ボタンエリア ──
  html += '<div style="padding:12px 16px;background:#fff;border:1px solid var(--border);border-radius:12px;margin-bottom:12px;display:flex;align-items:center;gap:12px">';
  if (c.billingConfirmed) {
    html += '<div style="display:flex;align-items:center;gap:8px;flex:1">'
      + '<span class="billing-confirmed-badge" style="font-size:12px;padding:4px 12px">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" style="width:12px;height:12px;stroke:#6DD5A8"><polyline points="20 6 9 17 4 12"/></svg>'
      + '請求確定済み</span>'
      + '<span style="font-size:11px;color:var(--text-muted)">' + (c.billingConfirmedAt||'') + ' 確定 ／ ' + (c.billingConfirmedBy||'') + '</span>'
      + '</div>'
      + '<button class="btn-billing-confirm already-confirmed" disabled>'
      + '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
      + '請求確定済み</button>';
  } else {
    var multiBadge = c.multiCase
      ? '<span style="margin-left:6px;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;background:#fff3e0;color:#c2410c;border:1px solid #fed7aa">第' + c.legNo + '便 / ' + c.totalLegs + '台</span>'
      : '';
    var descText = c.multiCase
      ? '第' + c.legNo + '便（' + c.driver + ' / ' + c.vehicle + '）の請求情報を確認して確定してください'
      : '請求情報・案件情報・配車割当・運賃を確認して確定してください';
    html += '<div style="flex:1">'
      + '<div style="font-size:12px;font-weight:700;color:var(--text-primary)">請求確定' + multiBadge + '</div>'
      + '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">' + descText + '</div>'
      + '</div>'
      + '<button class="btn-billing-confirm" onclick="openBillingConfirmModal(' + i + ')">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5"><rect x="5" y="2" width="14" height="20" rx="2"/><polyline points="9 12 11 14 15 10"/></svg>'
      + '請求確定する</button>';
  }
  html += '</div>';

  // ── 請求情報カード ──
  html += '<div class="detail-card" id="processed-invoice-card" style="margin-bottom:14px;border:2px solid #bbf7d0">'
    + '<div class="detail-card-header" style="background:#f0fdf4">'
    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>'
    + '<div class="detail-card-title" style="color:#16a34a">請求情報</div>'
    + (c.paid ? '<span class="paid-badge" style="margin-left:auto">入金済</span>' : '<span class="unpaid-badge" style="margin-left:auto">未入金</span>')
    + '</div>'
    + '<div class="detail-card-body">'
    + '<div style="display:flex;gap:8px;margin-bottom:14px">'
    + '<button class="btn btn-outline btn-sm" onclick="openInvoicePreview(\'' + c.id + '\')">📄 請求書を表示</button>'
    + '<button class="btn btn-secondary btn-sm" onclick="openInvoicePreview(\'' + c.id + '\')">🔄 請求書を再発行</button>'
    + '</div>'
    + '<div class="invoice-section">'
    + '<div class="invoice-row"><span>売上金額</span><span style="font-family:\'Inter\',sans-serif;font-weight:600">¥' + (c.sales||0).toLocaleString() + '</span></div>'
    + '<div class="invoice-row"><span>燃料費</span><span>¥' + (c.fuel||0).toLocaleString() + '</span></div>'
    + '<div class="invoice-row"><span>その他費用</span><span>¥' + (c.other||0).toLocaleString() + '</span></div>'
    + '<div class="invoice-row total"><span>粗利</span><span style="color:var(--green)">¥' + (c.profit||0).toLocaleString() + '</span></div>'
    + '<div class="invoice-row"><span>粗利率</span><span style="font-family:\'Inter\',sans-serif;font-weight:700;color:var(--green)">' + (c.margin||0) + '%</span></div>'
    + '</div>'
    + '<div style="margin-top:10px"><div class="info-grid">'
    + '<div class="info-item"><div class="info-label">請求書番号</div><div class="info-value" style="font-size:12px">' + (c.invoiceNo||'—') + '</div></div>'
    + '<div class="info-item"><div class="info-label">請求日</div><div class="info-value" style="font-size:12px">' + (c.invoiceDate||'—') + '</div></div>'
    + '<div class="info-item"><div class="info-label">支払期限</div><div class="info-value" style="font-size:12px">' + (c.due||'—') + '</div></div>'
    + '<div class="info-item"><div class="info-label">支払状況</div><div class="info-value">' + (c.paid ? '<span class="paid-badge">入金済</span>' : '<span class="unpaid-badge">未入金</span>') + '</div></div>'
    + '</div></div>'
    + '</div></div>';

  // ── 発注書カード（協力会社案件のみ） ──
  if (c.partner && c.purchaseOrderNo) {
    html += '<div class="detail-card" style="margin-bottom:14px;border:2px solid #3BB888">'
      + '<div class="detail-card-header" style="background:#EAF5F0">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0D4A3A" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'
      + '<div class="detail-card-title" style="color:#0D4A3A">発注書（下請法対応）</div>'
      + '<span style="margin-left:auto;font-size:10px;font-weight:600;padding:2px 10px;border-radius:10px;background:#d1fae5;color:#065f46">交付済み</span>'
      + '</div>'
      + '<div class="detail-card-body">'
      + '<div style="display:flex;gap:8px;margin-bottom:14px">'
      + '<button class="btn btn-outline btn-sm" onclick="redownloadPurchaseOrderPDF(' + i + ')" style="background:#EAF5F0;border-color:#93c5fd;color:#1e40af">'
      + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
      + '発注書PDFを再ダウンロード</button>'
      + '</div>'
      + '<div class="invoice-section">'
      + '<div class="invoice-row"><span>発注書番号</span><span style="font-family:\'Inter\',sans-serif;font-weight:600">' + (c.purchaseOrderNo||'—') + '</span></div>'
      + '<div class="invoice-row"><span>発注先</span><span>' + (c.partnerName||'—') + '</span></div>'
      + '<div class="invoice-row"><span>金額（税込）</span><span style="font-weight:600;color:#0D4A3A">¥' + (c.purchaseOrderTotal||0).toLocaleString() + '</span></div>'
      + '<div class="invoice-row"><span>支払方法</span><span>' + (c.purchaseOrderMethod||'—') + '</span></div>'
      + '<div class="invoice-row total"><span>支払期日</span><span>' + (c.purchaseOrderPayDue||'—') + '</span></div>'
      + '</div>'
      + '<div style="margin-top:10px"><div class="info-grid">'
      + '<div class="info-item"><div class="info-label">輸送区間</div><div class="info-value" style="font-size:11px">' + (c.purchaseOrderRoute||c.from+' → '+c.to) + '</div></div>'
      + '<div class="info-item"><div class="info-label">受領方法</div><div class="info-value" style="font-size:11px">' + (c.purchaseOrderReceipt||'—') + '</div></div>'
      + '<div class="info-item"><div class="info-label">交付日時</div><div class="info-value" style="font-size:11px">' + (c.purchaseOrderIssuedAt||'—') + '</div></div>'
      + '<div class="info-item"><div class="info-label">交付方法</div><div class="info-value" style="font-size:11px">ブラウザダウンロード（PDF）</div></div>'
      + '</div></div>'
      + '<div style="margin-top:10px;padding:8px 12px;background:#EAF5F0;border-radius:6px;font-size:11px;color:#065f46">📋 下請法第3条に基づく書面を交付済みです。本発注書は監査証跡として記録されています。</div>'
      + '</div></div>';
  }

  // ── 案件パターン ──
  var pat = c.casePattern ? CASE_PATTERNS[c.casePattern] : null;
  html += '<div class="detail-card" style="margin-bottom:14px">'
    + '<div class="detail-card-header" style="background:' + (pat ? pat.bgColor : '#f8fafc') + '">'
    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + (pat ? pat.color : '#6b7280') + '" stroke-width="2"><path d="M7 7h10M7 12h10M7 17h10"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>'
    + '<div class="detail-card-title" style="color:' + (pat ? pat.color : 'var(--text-primary)') + '">案件パターン</div>'
    + '<div style="margin-left:auto">' + (c.casePattern ? renderPatternFlag(c.casePattern, false, i + '_d') : '<span style="font-size:11px;color:var(--text-muted)">未設定</span>') + '</div>'
    + '</div></div>';

  // ── 案件情報 ──
  html += '<div class="detail-card">'
    + '<div class="detail-card-header">'
    + '<div class="detail-card-title">案件情報（完了）No. ' + c.id + '</div>'
    + '<span class="completed-badge" style="margin-left:auto">完了</span>'
    + '</div>'
    + '<div class="detail-card-body"><div class="info-grid">'
    + '<div class="info-item"><div class="info-label">取引先</div><div class="info-value">' + (c.client||'—') + '</div></div>'
    + '<div class="info-item"><div class="info-label">完了日時</div><div class="info-value">' + (c.completion||'—') + '</div></div>'
    + '<div class="info-item"><div class="info-label">発地</div><div class="info-value">' + (c.from||'—') + '</div></div>'
    + '<div class="info-item"><div class="info-label">着地</div><div class="info-value">' + (c.to||'—') + '</div></div>'
    + '<div class="info-item"><div class="info-label">走行距離</div><div class="info-value">' + (c.distance||'—') + '</div></div>'
    + '<div class="info-item"><div class="info-label">遅延</div><div class="info-value">' + (c.delay||'—') + '</div></div>'
    + '<div class="info-item"><div class="info-label">車両</div><div class="info-value">' + (c.vehicle||'—') + '</div></div>'
    + '<div class="info-item"><div class="info-label">配達完了</div><div class="info-value">✅</div></div>'
    + '</div></div></div>';

  // ── ★配送スケジュール（実績） ──
  html += renderCaseScheduleTimeline(c);

  // ── 車両情報カード（ネストなし関数呼び出し） ──
  html += _buildVehicleCard(c);

  // ── 運行実績・動態管理 ──
  var barsHtml = '';
  for (var b = 0; b < 32; b++) {
    var h = Math.max(4, 8 + Math.sin(b * 0.7) * 10 + Math.random() * 12);
    barsHtml += '<div class="waveform-bar" style="height:' + h + 'px"></div>';
  }

  html += '<div class="detail-card" id="processed-operations-card">'
    + '<div class="detail-card-header">'
    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M2 12h4M18 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>'
    + '<div class="detail-card-title">運行実績・動態管理</div>'
    + '<div style="margin-left:auto;display:flex;align-items:center;gap:6px">'
    + '<span style="font-size:10px;color:var(--text-muted)">最終更新：10:47</span>'
    + '<span style="width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block;animation:pulse 1.5s infinite"></span>'
    + '</div></div>'
    + '<div class="detail-card-body">'
    + '<div class="live-map" id="livemap-' + i + '">'
    + '<div class="live-map-roads"></div>'
    + '<div class="live-map-blocks" id="lmblocks-' + i + '"></div>'
    + '<div class="map-badge-row">'
    + '<span class="map-badge gps"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>GPS 連携中</span>'
    + '<span class="map-badge dtc"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>デジタコ 連携中</span>'
    + '</div>'
    + '<svg style="position:absolute;inset:0;width:100%;height:100%;overflow:visible" id="routesvg-' + i + '"></svg>'
    + '<div class="map-pin" style="left:14%;top:72%"><div class="map-pin-circle" style="background:#475569">S</div><div class="map-pin-label">' + (c.from||'').replace('県','').replace('都','').replace('市','市') + '</div></div>'
    + '<div class="map-pin" style="left:82%;top:34%"><div class="map-pin-circle" style="background:var(--red)">G</div><div class="map-pin-label">' + (c.to||'').replace('県','').replace('都','').replace('市','市') + '</div></div>'
    + '<div class="map-truck" id="truck-' + i + '" style="left:' + (c.progress||62) + '%;top:' + (c.truckTop||50) + '%">'
    + '<div class="map-truck-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0D4A3A" stroke-width="2.5"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div>'
    + '<div class="map-truck-label">' + (c.driver||'') + ' / 車両' + (c.vehicle||'') + '</div>'
    + '</div>'
    + '<div class="map-info-overlay">'
    + '<div class="map-info-live"><div class="live-dot"></div>LIVE 運行中</div>'
    + '<div class="map-info-row">'
    + '<div class="map-info-item"><div class="map-info-item-label">現在速度</div><div class="map-info-item-val" id="speed-' + i + '">62<span style="font-size:9px;font-weight:400"> km/h</span></div></div>'
    + '<div class="map-info-item"><div class="map-info-item-label">残距離</div><div class="map-info-item-val">' + (c.remain||'12') + '<span style="font-size:9px;font-weight:400"> km</span></div></div>'
    + '<div class="map-info-item"><div class="map-info-item-label">到着予定</div><div class="map-info-item-val">' + (c.eta||'11:15') + '</div></div>'
    + '</div></div>'
    + '</div>'
    + '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-top:10px;margin-bottom:2px">'
    + '<span>📍 ' + (c.from||'') + '</span>'
    + '<span style="font-weight:600;color:var(--sidebar-bg)">' + (c.progressPct||68) + '% 完了</span>'
    + '<span>🏁 ' + (c.to||'') + '</span>'
    + '</div>'
    + '<div class="route-progress-bar"><div class="route-progress-fill" style="width:' + (c.progressPct||68) + '%"></div></div>'
    + '<div class="live-stats-row">'
    + '<div class="live-stat"><div class="live-stat-label">出発時刻</div><div class="live-stat-val">09:22</div></div>'
    + '<div class="live-stat"><div class="live-stat-label">経過時間</div><div class="live-stat-val" id="elapsed-' + i + '">1:25</div></div>'
    + '<div class="live-stat"><div class="live-stat-label">走行距離</div><div class="live-stat-val ok">' + (c.donekm||23) + ' km</div></div>'
    + '<div class="live-stat"><div class="live-stat-label">遅延状況</div><div class="live-stat-val ok">遅延なし</div></div>'
    + '</div>'
    + '<div style="margin-top:12px;font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:6px">📋 運行イベントログ</div>'
    + '<div class="event-log">'
    + '<div class="event-log-item"><div class="event-time">09:22</div><div class="event-icon start">🚀</div><div><div class="event-text">出発（GPS取得開始）</div><div class="event-sub">' + (c.from||'') + ' / デジタコ記録開始</div></div></div>'
    + '<div class="event-log-item"><div class="event-time">09:45</div><div class="event-icon move">🛣️</div><div><div class="event-text">高速道路進入</div><div class="event-sub">速度：88 km/h・燃費：8.2 km/L</div></div></div>'
    + '<div class="event-log-item"><div class="event-time">10:12</div><div class="event-icon stop">⏸️</div><div><div class="event-text">一時停車（SA）</div><div class="event-sub">停車時間：8分</div></div></div>'
    + '<div class="event-log-item"><div class="event-time">10:47</div><div class="event-icon move">📡</div><div><div class="event-text">現在地更新（GPS）</div><div class="event-sub">速度：62 km/h・残距離：12 km・ETA：11:15</div></div></div>'
    + '</div>'
    + '</div></div>';

  el.innerHTML = html;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  モーダル
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  請求確定モーダル
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let billingConfirmIdx = null;
let bcmEditData = {};

function openBillingConfirmModal(i) {
  billingConfirmIdx = i;
  var c = processedCases[i];
  bcmEditData = {
    invoiceNo:   c.invoiceNo   || '',
    invoiceDate: c.invoiceDate || '',
    due:         c.due         || '',
    sales:       c.sales       || 0,
    fuel:        c.fuel        || 0,
    other:       c.other       || 0,
    client:      c.client      || '',
    from:        c.from        || '',
    to:          c.to          || '',
    goods:       c.goods       || '',
    completion:  c.completion  || '',
    distance:    c.distance    || '',
    delay:       c.delay       || 'なし',
    driver:      c.driver      || '',
    vehicle:     c.vehicle     || '',
    // 複数台フィールド
    multiCase:   c.multiCase   || false,
    legNo:       c.legNo       || null,
    totalLegs:   c.totalLegs   || null,
    legRole:     c.legRole     || null,
    legReason:   c.legReason   || '',
    parentId:    c.parentId    || null,
  };
  var el = document.getElementById('bcm-subtitle');
  if (el) el.textContent = 'No. ' + c.id + ' ／ ' + c.client
    + (c.multiCase ? '（第'+c.legNo+'便/'+c.totalLegs+'台）' : '');
  renderBillingModalBody();
  var modal = document.getElementById('billing-confirm-modal');
  modal.style.display = 'flex';
  modal.classList.add('bcm-open');
}

function closeBillingConfirmModal() {
  var modal = document.getElementById('billing-confirm-modal');
  modal.style.display = 'none';
  modal.classList.remove('bcm-open');
  billingConfirmIdx = null;
  bcmEditData = {};
}

function bcmRecalcProfit() {
  var sEl = document.getElementById('bcm-sales');
  var fEl = document.getElementById('bcm-fuel');
  var oEl = document.getElementById('bcm-other');
  var sales  = parseInt((sEl && sEl.value) || '0') || 0;
  var fuel   = parseInt((fEl && fEl.value) || '0') || 0;
  var other  = parseInt((oEl && oEl.value) || '0') || 0;
  var profit = sales - fuel - other;
  var margin = sales > 0 ? Math.round(profit / sales * 100) : 0;
  var pEl = document.getElementById('bcm-profit-val');
  var mEl = document.getElementById('bcm-margin-val');
  if (pEl) {
    pEl.textContent = '¥' + profit.toLocaleString('ja-JP');
    pEl.style.color = profit < 0 ? '#dc2626' : '#16a34a';
  }
  if (mEl) {
    mEl.textContent = margin + '%';
    mEl.style.color = profit < 0 ? '#dc2626' : '#16a34a';
  }
  bcmEditData.sales = sales;
  bcmEditData.fuel  = fuel;
  bcmEditData.other = other;
}

function _bcmField(labelText, inputId, val, type, extraAttr) {
  type = type || 'text';
  extraAttr = extraAttr || '';
  return '<div class="billing-field">'
    + '<label>' + labelText + '</label>'
    + '<input type="' + type + '" id="' + inputId + '" value="' + String(val).replace(/"/g, '&quot;') + '" ' + extraAttr + ' />'
    + '</div>';
}

function _bcmSelect(labelText, currentVal, options, onchangeKey) {
  var opts = options.map(function(o) {
    return '<option value="' + o + '"' + (o === currentVal ? ' selected' : '') + '>' + o + '</option>';
  }).join('');
  return '<div class="billing-field">'
    + '<label>' + labelText + '</label>'
    + '<select onchange="bcmEditData.' + onchangeKey + '=this.value">' + opts + '</select>'
    + '</div>';
}

function _bcmSectionHeader(svgPath, title) {
  return '<div class="billing-section-header">'
    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sidebar-bg)" stroke-width="2">' + svgPath + '</svg>'
    + '<span>' + title + '</span>'
    + '</div>';
}

function renderBillingModalBody() {
  var d = bcmEditData;
  var profit = (d.sales || 0) - (d.fuel || 0) - (d.other || 0);
  var margin = d.sales > 0 ? Math.round(profit / d.sales * 100) : 0;
  var pColor = profit < 0 ? '#dc2626' : '#16a34a';

  var html = '';

  // ① 請求情報
  html += '<div class="billing-section">';
  html += '<div class="billing-section-header">'
    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>'
    + '<span>① 請求情報</span></div>';
  html += '<div class="billing-section-body"><div class="billing-edit-grid cols3">';
  html += _bcmField('請求書番号', 'bcm-invoiceno', d.invoiceNo, 'text', 'onchange="bcmEditData.invoiceNo=this.value"');
  html += _bcmField('請求日', 'bcm-invoicedate', d.invoiceDate, 'text', 'onchange="bcmEditData.invoiceDate=this.value"');
  html += _bcmField('支払期限', 'bcm-due', d.due, 'text', 'onchange="bcmEditData.due=this.value"');
  html += '</div></div></div>';

  // ② 運賃・費用
  html += '<div class="billing-section">';
  html += '<div class="billing-section-header">'
    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'
    + '<span>② 運賃・費用情報</span></div>';
  html += '<div class="billing-section-body"><div class="billing-edit-grid cols3">';
  html += _bcmField('売上金額（円）', 'bcm-sales', d.sales, 'number', 'oninput="bcmRecalcProfit()"');
  html += _bcmField('燃料費（円）',   'bcm-fuel',  d.fuel,  'number', 'oninput="bcmRecalcProfit()"');
  html += _bcmField('その他費用（円）','bcm-other', d.other, 'number', 'oninput="bcmRecalcProfit()"');
  html += '</div>';
  html += '<div class="billing-profit-bar">'
    + '<div class="billing-profit-item"><div class="billing-profit-label">粗利</div>'
    + '<div id="bcm-profit-val" class="billing-profit-val" style="color:' + pColor + '">¥' + profit.toLocaleString('ja-JP') + '</div></div>'
    + '<div style="width:1px;height:32px;background:var(--border);margin:0 8px"></div>'
    + '<div class="billing-profit-item"><div class="billing-profit-label">粗利率</div>'
    + '<div id="bcm-margin-val" class="billing-profit-val" style="color:' + pColor + '">' + margin + '%</div></div>'
    + '<div style="margin-left:auto;font-size:11px;color:var(--text-muted)">※ 売上 − 燃料費 − その他費用</div>'
    + '</div>';
  html += '</div></div>';

  // ③ 案件情報
  html += '<div class="billing-section">';
  html += '<div class="billing-section-header">'
    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sidebar-bg)" stroke-width="2"><path d="M7 7h10M7 12h10M7 17h10"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>'
    + '<span>③ 案件情報（稼働実績含む）</span></div>';
  html += '<div class="billing-section-body"><div class="billing-edit-grid">';
  html += _bcmField('取引先',   'bcm-client',     d.client,     'text', 'onchange="bcmEditData.client=this.value"');
  html += _bcmField('完了日時', 'bcm-completion',  d.completion,  'text', 'onchange="bcmEditData.completion=this.value"');
  html += _bcmField('発地',     'bcm-from',        d.from,        'text', 'onchange="bcmEditData.from=this.value"');
  html += _bcmField('着地',     'bcm-to',          d.to,          'text', 'onchange="bcmEditData.to=this.value"');
  html += _bcmField('荷物内容', 'bcm-goods',       d.goods,       'text', 'onchange="bcmEditData.goods=this.value"');
  html += _bcmField('走行距離', 'bcm-distance',    d.distance,    'text', 'onchange="bcmEditData.distance=this.value"');
  html += _bcmSelect('遅延状況', d.delay, ['なし', '軽微', '遅延あり'], 'delay');
  html += '</div></div></div>';

  // ④ 配車割当
  html += '<div class="billing-section">';
  html += '<div class="billing-section-header">'
    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sidebar-bg)" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/></svg>'
    + '<span>④ 配車割当情報</span>'
    + (d.multiCase ? '<span style="margin-left:8px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:#fff3e0;color:#c2410c;border:1px solid #fed7aa">複数台 第'+d.legNo+'便/'+d.totalLegs+'台</span>' : '')
    + '</div>';
  html += '<div class="billing-section-body">';

  if (d.multiCase) {
    // 複数台：便構成バナー＋この便のドライバー・車両
    html += '<div style="margin-bottom:12px;padding:10px 14px;background:var(--accent-pale);border:1.5px solid var(--sidebar-bg);border-radius:8px">'
      + '<div style="font-size:11px;font-weight:700;color:var(--sidebar-bg);margin-bottom:6px;display:flex;align-items:center;gap:6px">'
      + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/></svg>'
      + '複数台配車 — 第'+d.legNo+'便 / 全'+d.totalLegs+'台'
      + '</div>'
      + '<div style="font-size:11px;color:#374151;line-height:1.6">'
      + '役割：<b>'+(d.legRole==='main'?'主役（メイン）':d.legRole==='sub'?'補助':'特殊')+'</b>'
      + (d.legReason ? '　理由：'+d.legReason : '')
      + '<br>元案件ID：'+d.parentId
      + '</div>'
      + '</div>';
    // この便のドライバー・車両（編集可）
    html += '<div class="billing-edit-grid">';
    html += _bcmField('ドライバー（第'+d.legNo+'便）', 'bcm-driver',  d.driver,  'text', 'onchange="bcmEditData.driver=this.value"');
    html += _bcmField('車両番号（第'+d.legNo+'便）',   'bcm-vehicle', d.vehicle, 'text', 'onchange="bcmEditData.vehicle=this.value"');
    html += '</div>';
    // 他便へのリンク案内
    html += '<div style="margin-top:10px;padding:8px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:7px;font-size:11px;color:#92400e">'
      + '💡 他の便の請求確定は、処理済みリストから各便のカードを選択して行ってください。'
      + '</div>';
  } else {
    // 1台：従来表示
    html += '<div class="billing-edit-grid">';
    html += _bcmField('ドライバー', 'bcm-driver',  d.driver,  'text', 'onchange="bcmEditData.driver=this.value"');
    html += _bcmField('車両番号',   'bcm-vehicle', d.vehicle, 'text', 'onchange="bcmEditData.vehicle=this.value"');
    html += '</div>';
  }

  html += '</div></div>';

  var bodyEl = document.getElementById('bcm-body');
  if (bodyEl) bodyEl.innerHTML = html;
}

function executeBillingConfirm() {
  if (billingConfirmIdx === null) return;
  // 最新のフォーム値を手動で拾う（onchangeが未発火の場合に備えて）
  var ids = ['bcm-invoiceno','bcm-invoicedate','bcm-due','bcm-client','bcm-completion','bcm-from','bcm-to','bcm-goods','bcm-distance','bcm-driver','bcm-vehicle'];
  var keys= ['invoiceNo','invoiceDate','due','client','completion','from','to','goods','distance','driver','vehicle'];
  for (var n = 0; n < ids.length; n++) {
    var el = document.getElementById(ids[n]);
    if (el) bcmEditData[keys[n]] = el.value;
  }
  var sEl = document.getElementById('bcm-sales');
  var fEl = document.getElementById('bcm-fuel');
  var oEl = document.getElementById('bcm-other');
  if (sEl) bcmEditData.sales = parseInt(sEl.value) || 0;
  if (fEl) bcmEditData.fuel  = parseInt(fEl.value) || 0;
  if (oEl) bcmEditData.other = parseInt(oEl.value) || 0;
  bcmEditData.profit = bcmEditData.sales - bcmEditData.fuel - bcmEditData.other;
  bcmEditData.margin = bcmEditData.sales > 0 ? Math.round(bcmEditData.profit / bcmEditData.sales * 100) : 0;

  var c = processedCases[billingConfirmIdx];
  // 複数台フィールドは上書きしないよう保護
  var multiFields = { multiCase: c.multiCase, legNo: c.legNo, totalLegs: c.totalLegs, legRole: c.legRole, legReason: c.legReason, parentId: c.parentId };
  Object.assign(c, bcmEditData, multiFields);
  var now = new Date();
  var pad = function(n){ return String(n).padStart(2,'0'); };
  var nowStr = now.getFullYear() + '/' + pad(now.getMonth()+1) + '/' + pad(now.getDate())
             + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
  c.billingConfirmed    = true;
  c.billingConfirmedAt  = nowStr;
  c.billingConfirmedBy  = '配車 太郎';

  var confirmedIdx = billingConfirmIdx;
  closeBillingConfirmModal();
  renderProcessedList();
  renderProcessedDetail(confirmedIdx);
  selectedProcessed = confirmedIdx;
  if (typeof renderInvoiceList === 'function') renderInvoiceList();
  var msg = c.multiCase
    ? `第${c.legNo}便（${c.driver}）の請求を確定しました。`
    : '請求確定しました。請求管理ページにも反映されました。';
  showToast(msg, 'ok');
}

let pendingMatchingIdx = null;
function openMatchingModal(i) {
  pendingMatchingIdx = i;
  const c = unprocessedCases[i];
  document.getElementById('modal-case-summary').innerHTML = `
    <b>${c.client}</b>　${c.from} → ${c.to}<br>
    ${c.goods}　納期：${c.deadline}
  `;
  document.getElementById('matching-modal').classList.add('open');
  // チェックボックス初期化（毎回チェック済みに戻す）
  setTimeout(() => {
    const ck = document.getElementById('logipoke-sync-check');
    if (ck) { ck.checked = true; ck.style.background = 'var(--sidebar-bg)'; }
    const tick = document.getElementById('ck-tick-main');
    if (tick) tick.style.opacity = '1';
  }, 0);
}

// 未処理→処理中移行時に vehicle ごとの law データを生成する
function generateLawData(vehicles, casePattern) {
  return vehicles.map((v, idx) => {
    if (v.law) return v; // 既に law データがある場合はそのまま
    // スコアや順位からステータスを判定
    const score = v.score || 80;
    // rank2以降でスコアが低い場合は「要確認」を一部入れてリアリティを出す
    const hasWarn = idx > 0 && score < 85;
    const items = hasWarn ? [
      {ok:false, title:'連続運転制限', val:`連続運転${(3.0 + Math.random()).toFixed(1)}h — あと${(0.5 + Math.random()*0.5).toFixed(1)}hで上限`},
      {ok:true,  title:'日間運転時間', val:'9h以内'},
      {ok:true,  title:'拘束時間',     val:'13h以内'},
      {ok:true,  title:'週間上限時間', val:'週65h以内'},
      {ok:true,  title:'勤務間休息',   val:'インターバル8h確保'},
      {ok:true,  title:'休憩確保',     val:'30分休憩ルール適合'},
    ] : [
      {ok:true, title:'日間運転時間', val:'9h以内'},
      {ok:true, title:'拘束時間',     val:'13h以内'},
      {ok:true, title:'週間上限時間', val:'週65h以内'},
      {ok:true, title:'勤務間休息',   val:'インターバル8h確保'},
      {ok:true, title:'連続運転制限', val:'上限まで余裕あり'},
      {ok:true, title:'休憩確保',     val:'30分休憩ルール適合'},
    ];
    const warnCount = items.filter(it => !it.ok).length;
    return {
      ...v,
      law: {
        status: warnCount > 0 ? 'warn' : 'ok',
        label:  warnCount > 0 ? '要確認' : '適合',
        items
      }
    };
  });
}

function confirmMatching() {
  closeModal('matching-modal');
  const c = unprocessedCases[pendingMatchingIdx];
  const vehiclesWithLaw = generateLawData(c.vehicles || [], c.casePattern);
  // 処理中リストへ追加
  processingCases.unshift({
    id: c.id, status:'処理中', priority:'通常',
    casePattern: c.casePattern || autoDetectPattern(c),
    client: c.client, from: c.from, to: c.to,
    goods: c.goods, deadline: c.deadline,
    vehicle: '未割当', driver: '未割当', distance: '---',
    vehicles: vehiclesWithLaw,
    analyzed: c.analyzed,
    aiResult: c.aiResult,
    ch: c.ch,
    onHold: c.onHold
  });
  // 未処理から削除
  unprocessedCases.splice(pendingMatchingIdx, 1);
  // 次の先頭案件を選択
  if (unprocessedCases.length > 0) {
    selectedUnprocessedId = unprocessedCases[0].id;
    renderUnprocessedList();
    renderUnprocessedDetail(0);
  } else {
    selectedUnprocessedId = null;
    renderUnprocessedList();
    document.getElementById('unprocessed-detail').innerHTML = '';
  }
  // 処理中フェーズへ遷移
  switchPhase('processing');
  renderProcessingList();
  renderProcessingDetail(0);
  updatePhaseCounts();
  showToast(`${c.client}を処理中フェーズへ移行しました`, 'success');
}

let pendingConfirmIdx = null;
function openConfirmModal(i) {
  pendingConfirmIdx = i;
  const c = processingCases[i];
  const isMulti = c.vehicleMode === 'multi' && c.legs && c.legs.length > 0;

  if (isMulti) {
    // 複数台モード: 便リストを表示
    const legsHtml = c.legs.map((leg, li) => {
      const lawStatus = leg.lawOk
        ? `<span style="font-size:10px;background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:10px;font-weight:700">法令チェック ✓ クリア</span>`
        : `<span style="font-size:10px;background:#fef2f2;color:#dc2626;padding:2px 8px;border-radius:10px;font-weight:700">法令要確認</span>`;
      return `<div style="padding:8px 10px;background:#fff;border-radius:7px;border:1px solid #d1fae5;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-size:11px;font-weight:700;color:#6DD5A8;background:var(--sidebar-bg);padding:2px 7px;border-radius:10px">第${li+1}便</span>
          <span style="font-size:13px;font-weight:700;color:var(--text-primary)">${leg.driverName}（${leg.vehicleName}）</span>
          <span style="font-size:10px;color:var(--text-muted)">${leg.vehicleType} · ${leg.capacity}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:11px;color:var(--text-secondary)">役割：${leg.role==='main'?'主役（メイン）':leg.role==='sub'?'補助':'特殊'}</span>
          ${leg.reason ? `<span style="font-size:11px;color:var(--text-secondary)">理由：${leg.reason}</span>` : ''}
          ${lawStatus}
        </div>
        ${leg.notes ? `<div style="font-size:11px;color:#64748b;margin-top:3px">備考：${leg.notes}</div>` : ''}
      </div>`;
    }).join('');

    document.getElementById('confirm-case-summary').innerHTML = `
      <b>${c.client}</b>　${c.from} → ${c.to}<br>
      <span style="color:var(--sidebar-bg);font-weight:700">複数台配車（${c.legs.length}台構成）</span>
      <div style="margin-top:8px">${legsHtml}</div>
    `;
    // 複数台モード: 全便の法令をまとめてチェック（クリアのみ要約表示）
    const allLawOk = c.legs.every(leg => leg.lawOk !== false);
    const lawWarningEl = document.getElementById('confirm-law-warning');
    const lawOkEl      = document.getElementById('confirm-law-ok');
    const lawItemsEl   = document.getElementById('confirm-law-items');
    const lawOkItemsEl = document.getElementById('confirm-law-ok-items');
    const allOkMsg     = document.getElementById('confirm-law-all-ok-msg');
    lawWarningEl.style.display = 'none';
    lawItemsEl.innerHTML = '';
    if (allLawOk) {
      lawOkEl.style.display = 'block';
      lawOkItemsEl.innerHTML = c.legs.map((leg, li) =>
        `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#fff;border-radius:7px;font-size:12px;color:#065f46;border:1px solid #bbf7d0">
          <span style="font-size:15px;flex-shrink:0">✅</span>
          <span>第${li+1}便 <b>${leg.driverName}</b>：改善基準告示 全項目クリア</span>
        </div>`
      ).join('');
      if (allOkMsg) allOkMsg.style.display = 'block';
    } else {
      lawOkEl.style.display = 'none';
    }
  } else {
    // 1台モード: 従来ロジック
    document.getElementById('confirm-case-summary').innerHTML = `
      <b>${c.client}</b>　${c.from} → ${c.to}<br>
      ドライバー：${c.driver}　車両：${c.vehicle}
    `;
    const selIdx = c.selectedVehicleIdx ?? 0;
    const selV = c.vehicles[selIdx];
    const lawWarningEl = document.getElementById('confirm-law-warning');
    const lawItemsEl   = document.getElementById('confirm-law-items');
    const lawOkEl   = document.getElementById('confirm-law-ok');
    const lawOkItemsEl = document.getElementById('confirm-law-ok-items');
    const allItems  = selV?.law?.items || [];
    const warnItems = allItems.filter(it => !it.ok);
    const okItems   = allItems.filter(it => it.ok);
    if (warnItems.length > 0) {
      lawWarningEl.style.display = 'block';
      lawItemsEl.innerHTML = warnItems.map(it => `
        <div style="display:flex;align-items:flex-start;gap:8px;background:#fff;border:1px solid #fde68a;border-radius:7px;padding:7px 10px">
          <span style="font-size:14px;flex-shrink:0">⚠️</span>
          <div>
            <div style="font-size:11px;font-weight:700;color:#92400e">${it.title}</div>
            <div style="font-size:11px;color:#78350f;margin-top:1px">${it.val}</div>
          </div>
        </div>
      `).join('');
    } else {
      lawWarningEl.style.display = 'none';
      lawItemsEl.innerHTML = '';
    }
    if (lawOkEl && lawOkItemsEl) {
      if (okItems.length > 0) {
        lawOkEl.style.display = 'block';
        lawOkItemsEl.innerHTML = okItems.map(it => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#fff;border-radius:7px;font-size:12px;color:#065f46;border:1px solid #bbf7d0">
            <span style="font-size:15px;flex-shrink:0">✅</span><span><b>${it.title}</b>：${it.val}</span>
          </div>
        `).join('');
        const allOkMsg = document.getElementById('confirm-law-all-ok-msg');
        if (allOkMsg) allOkMsg.style.display = warnItems.length === 0 ? 'block' : 'none';
      } else {
        lawOkEl.style.display = 'none';
      }
    }
  }

  document.getElementById('confirm-modal').classList.add('open');
}

function confirmDispatch() {
  closeModal('confirm-modal');
  const c = processingCases[pendingConfirmIdx];
  const isMulti = c.vehicleMode === 'multi' && c.legs && c.legs.length > 0;
  const now = new Date();
  const invBase = 'INV-' + formatDateYYYYMM(now) + '-' + String(Math.floor(Math.random()*900)+100).padStart(5,'0');

  if (isMulti) {
    // 複数台: Leg別に処理済み案件を生成
    c.legs.forEach((leg, li) => {
      const legSales  = Math.round(45000 / c.legs.length);
      const legFuel   = Math.round(16000 / c.legs.length);
      const legProfit = legSales - legFuel;
      // 車両マスタからプレート・スペックを引く
      const rawId = leg.vehicleName || leg.vehicleId || '';
      const lookupId = rawId.replace(/^車両/, '');
      const vm = (window.vehicleMasterData || []).find(v => v.id === lookupId || v.id === rawId);
      const vPlate = vm ? vm.plate : rawId;
      processedCases.unshift({
        id: c.id + '-L' + (li+1), status:'完了', casePattern: c.casePattern || null,
        partner: false, partnerName: null,
        client: c.client, from: c.from, to: c.to,
        goods: c.goods,
        completion: now.toLocaleDateString('ja-JP') + ' 完了（第'+(li+1)+'便）',
        distance: c.distance, delay: 'なし',
        driver: leg.driverName, vehicle: vPlate,
        vehicleType: vm ? vm.type : leg.vehicleType,
        vehicleCap: vm ? vm.cap : null,
        legNo: li+1, totalLegs: c.legs.length, multiCase: true, parentId: c.id,
        legRole: leg.role, legReason: leg.reason,
        sales: legSales, fuel: legFuel, other: 0, profit: legProfit, margin: Math.round(legProfit/legSales*100),
        invoiceNo: invBase + (li > 0 ? '-' + (li+1) : ''),
        invoiceDate: formatDateSlash(now),
        due: formatDateSlash(new Date(now.getTime()+30*86400000)),
        paid: false,
        progress:50, truckTop:50, progressPct:50, remain:'—', eta:'—', donekm:0
      });
    });
  } else {
    // 1台: 従来ロジック
    processedCases.unshift({
      id: c.id, status:'完了', casePattern: c.casePattern || null,
      partner: c.partner || false, partnerName: c.partnerName || null,
      client: c.client, from: c.from, to: c.to,
      goods: c.goods, completion: now.toLocaleDateString('ja-JP') + ' 完了',
      distance: c.distance, delay: 'なし', driver: c.driver, vehicle: c.vehicle,
      sales: 45000, fuel: 16000, other: 0, profit: 29000, margin: 64,
      invoiceNo: invBase,
      invoiceDate: formatDateSlash(now), due: formatDateSlash(new Date(now.getTime()+30*86400000)), paid: false,
      progress:50, truckTop:50, progressPct:50, remain:'—', eta:'—', donekm:0
    });
  }

  processingCases.splice(pendingConfirmIdx, 1);
  renderProcessingList();
  if (processingCases.length > 0) renderProcessingDetail(0);
  else document.getElementById('processing-detail').innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><div>処理中の案件はありません</div></div>';
  switchPhase('processed');
  renderProcessedList();
  renderProcessedDetail(0);
  updatePhaseCounts();
  syncInvoicePage(processedCases[0].id);
  // 配車計画表の処理済みタブと件数連動
  if (typeof notifyProcessedCasesChanged === 'function') notifyProcessedCasesChanged();
  const msg = isMulti
    ? `${c.client}の配車を確定しました（${c.legs.length}台・便別請求書を作成しました）`
    : `${c.client}の配車を確定しました。ドライバーへ指示を送信しました。`;
  showToast(msg, 'success');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
document.querySelectorAll('.modal-overlay').forEach(mo => {
  mo.addEventListener('click', e => { if (e.target === mo) mo.classList.remove('open'); });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  動態マップ描画
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function drawLiveMap(i) {
  const mapEl = document.getElementById(`livemap-${i}`);
  if (!mapEl) return;
  const W = mapEl.offsetWidth || 600;
  const H = mapEl.offsetHeight || 220;

  // ブロック（建物風）描画
  const blocksEl = document.getElementById(`lmblocks-${i}`);
  if (blocksEl) {
    const blocks = [
      {x:5,y:5,w:14,h:18},{x:22,y:8,w:10,h:12},{x:38,y:4,w:16,h:20},
      {x:58,y:10,w:12,h:14},{x:74,y:6,w:8,h:16},{x:84,y:12,w:10,h:10},
      {x:5,y:38,w:12,h:16},{x:24,y:36,w:14,h:18},{x:44,y:40,w:10,h:12},
      {x:60,y:36,w:16,h:20},{x:80,y:38,w:12,h:14},
      {x:5,y:65,w:18,h:16},{x:30,y:68,w:12,h:12},{x:48,y:64,w:14,h:18},
      {x:66,y:66,w:10,h:14},{x:80,y:70,w:14,h:12},
    ];
    blocksEl.innerHTML = blocks.map(b =>
      `<div class="map-block" style="left:${b.x}%;top:${b.y}%;width:${b.w/100*W/W*100}%;height:${b.h}%"></div>`
    ).join('');
  }

  // SVGルート（折れ線：S → 中間点1 → 中間点2 → G）
  const svg = document.getElementById(`routesvg-${i}`);
  if (!svg) return;
  // パーセント座標
  const pts = [ [14,72], [32,58], [52,44], [68,36], [82,34] ];
  const pxPts = pts.map(([px,py]) => [px/100*W, py/100*H]);
  const truckPct = processedCases[i]?.progressPct || 68;
  // ルート全体をポリラインで
  const allD = pxPts.map((p,j) => (j===0?`M`:' L') + p[0]+','+p[1]).join('');
  // 走行済み：最初の3点まで
  const doneIdx = Math.floor(truckPct / 25); // 0-4
  const donePts = pxPts.slice(0, Math.min(doneIdx+2, pxPts.length));
  const doneD = donePts.map((p,j) => (j===0?`M`:' L') + p[0]+','+p[1]).join('');
  const remainPts = pxPts.slice(Math.max(0,doneIdx+1));
  const remainD = remainPts.length>1 ? remainPts.map((p,j) => (j===0?`M`:' L') + p[0]+','+p[1]).join('') : '';

  svg.innerHTML = `
    <defs>
      <filter id="shadow-${i}"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="rgba(0,0,0,.2)"/></filter>
    </defs>
    <!-- 残りルート（破線） -->
    ${remainD ? `<path d="${remainD}" fill="none" stroke="#94a3b8" stroke-width="3" stroke-dasharray="6,4" stroke-linecap="round"/>` : ''}
    <!-- 走行済みルート -->
    <path d="${doneD}" fill="none" stroke="#3BB888" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="url(#shadow-${i})"/>
  `;
}

// 速度のリアルタイム更新シミュレーション
let liveTimers = [];
function startLiveUpdates(i) {
  liveTimers.forEach(t => clearInterval(t));
  liveTimers = [];
  const speeds = [58,62,65,60,67,63,61,64];
  let si = 0;
  const t = setInterval(() => {
    const el = document.getElementById(`speed-${i}`);
    if (!el) { clearInterval(t); return; }
    si = (si+1) % speeds.length;
    el.innerHTML = speeds[si] + '<span style="font-size:9px;font-weight:400"> km/h</span>';
  }, 2200);
  liveTimers.push(t);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ユーティリティ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function updatePhaseCounts() {
  const uEl = document.querySelector('.phase-tab.unprocessed .tab-count');
  const pEl = document.querySelector('.phase-tab.processing .tab-count');
  const dEl = document.querySelector('.phase-tab.processed .tab-count');
  uEl.textContent = unprocessedCases.length;
  pEl.textContent = processingCases.length;
  dEl.textContent = processedCases.length;
  uEl.dataset.zero = unprocessedCases.length === 0 ? 'true' : 'false';
  pEl.dataset.zero = processingCases.length  === 0 ? 'true' : 'false';
  // 配車計画表のサイドバーバッジを「未割当案件数」で更新
  updateDispatchNavBadge();
}

// 配車計画表サイドバーバッジ：dndUnassignedCases のうち
// まだドライバー行に割り当てられていない件数 を表示
// ※ ヘッダー（未割当案件タイトル横）のバッジと同じカウントを返す共通関数
function countDispatchUnassigned() {
  if (typeof dndUnassignedCases === 'undefined' || typeof isCaseAssigned !== 'function') return 0;
  // 確定済み（processedCases に移動済み）案件は配車計画表の対象外なので除外
  const candidates = dndUnassignedCases.filter(c => {
    if (typeof processedCases !== 'undefined' && c.caseListId) {
      if (processedCases.some(p => p.id === c.caseListId)) return false;
    }
    return true;
  });
  return candidates.filter(c => !isCaseAssigned(c.id)).length;
}

function updateDispatchNavBadge() {
  const badgeDispatch = document.getElementById('nav-badge-dispatch');
  if (!badgeDispatch) return;
  const unassignedCount = countDispatchUnassigned();
  badgeDispatch.textContent = unassignedCount;
  // ヘッダーの未割当案件バッジも同期させる
  const headerBadge = document.getElementById('dnd-unassigned-count');
  if (headerBadge) {
    // 確定済みタブのときはリスト側ロジック（請求確定済み件数）に任せる
    const isConfirmedTab = (typeof currentDispatchTab !== 'undefined' && currentDispatchTab === 'confirmed');
    if (!isConfirmedTab) headerBadge.textContent = unassignedCount;
  }
  // 0件のときは控えめにグレー化（任意）
  if (unassignedCount === 0) {
    badgeDispatch.style.background = '#6b7280';
  } else {
    badgeDispatch.style.background = '';
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  個別案件処理(未処理) → 配車計画表(未割当) への自動反映
//  メール・FAX・新規登録モーダル・定期案件発生の共通フック
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const DND_AUTO_COLORS = ['#1A6B56', '#1a7a5e', '#0D4A3A', '#3BB888', '#277A63'];
let _dndAutoColorIdx = 0;

// deadline 文字列から「緊急」かどうかを簡易判定
function _deriveUrgentFromDeadline(deadline) {
  if (!deadline) return false;
  const s = String(deadline);
  // 「指定」「AM」「PM」「時」「:」が含まれていれば時間指定あり＝緊急扱い
  return /指定|AM|PM|時|:/.test(s);
}

// deadline 文字列から推奨開始時間を簡易推定
function _derivePreferredStartFromDeadline(deadline) {
  if (!deadline) return '09:00';
  const s = String(deadline);
  // 「HH:MM」形式
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) {
    const hh = String(Math.max(0, parseInt(m[1], 10) - 2)).padStart(2, '0');
    return hh + ':' + m[2];
  }
  if (/AM/.test(s)) return '07:00';
  if (/PM|夕方|夜/.test(s)) return '13:00';
  return '09:00';
}

// 発地・着地から所要時間（h）を簡易推定（estimateDistance を流用）
function _deriveDurationFromRoute(from, to) {
  if (typeof estimateDistance === 'function') {
    const km = estimateDistance(from || '', to || '');
    // 平均 60km/h で算出、最小1h・最大12h
    return Math.max(1, Math.min(12, Math.round(km / 60)));
  }
  return 4;
}

// 個別案件処理（未処理）に追加した案件を、配車計画表（未割当案件）にも反映する
//   caseListId: unprocessedCases に追加された案件の id
//   src       : { client, from, to, goods, deadline } 等の元データ
// 既に同じ caseListId が dndUnassignedCases に存在する場合は重複追加しない
function addToDispatchUnassigned(caseListId, src) {
  if (typeof dndUnassignedCases === 'undefined') return null;
  if (!caseListId) return null;
  // 重複チェック
  if (dndUnassignedCases.some(c => c.caseListId === caseListId)) return null;

  const color = DND_AUTO_COLORS[_dndAutoColorIdx % DND_AUTO_COLORS.length];
  _dndAutoColorIdx++;

  const newCard = {
    id: 'D-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random()*100),
    caseListId: caseListId,
    originalPhase: 'unprocessed',
    client: src.client || '—',
    status: 'unprocessed',
    from: src.from || '',
    to: src.to || '',
    goods: src.goods || '—',
    durationH: _deriveDurationFromRoute(src.from, src.to),
    preferredStart: _derivePreferredStartFromDeadline(src.deadline),
    deadline: src.deadline || '',
    urgent: _deriveUrgentFromDeadline(src.deadline),
    color: color
  };
  dndUnassignedCases.unshift(newCard);

  // 配車計画表が表示中なら再描画
  if (typeof renderDndList === 'function') {
    try { renderDndList(); } catch (e) {}
  }
  // サイドバーバッジ更新
  if (typeof updateDispatchNavBadge === 'function') updateDispatchNavBadge();

  return newCard;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  新規登録モーダル
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let currentRegTab = 'rec';
let recState = 'idle'; // idle | recording | done
let recTimerInterval = null;
let recSeconds = 0;
let recWaveInterval = null;
let mediaRecorder = null;
let recExtracted = null;
let uploadExtracted = null;

function openRegisterModal() {
  document.getElementById('register-modal').classList.add('open');
  switchRegTab('rec');
  resetRec();
  resetUpload();
  resetImageUpload();
  clearManualForm();
}

function switchRegTab(tab) {
  currentRegTab = tab;
  document.querySelectorAll('.reg-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.reg-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('regtab-' + tab).classList.add('active');
  document.getElementById('regpanel-' + tab).classList.add('active');

  // 画像OCRタブの場合はモーダルを横長に
  const modal = document.querySelector('#register-modal .reg-modal');
  if (modal) {
    if (tab === 'image') modal.classList.add('ocr-wide');
    else modal.classList.remove('ocr-wide');
  }
}

// ── 画像OCR ──
function handleImageDrop(e) {
  e.preventDefault();
  document.getElementById('img-upload-drop').classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f) startImageOcr(f);
}
function handleImageSelect(e) {
  const f = e.target.files[0];
  if (f) startImageOcr(f);
}
function startImageOcr(file) {
  document.getElementById('img-upload-initial').style.display = 'none';
  document.getElementById('img-ocr-result').style.display = 'none';
  document.getElementById('img-ocr-loading').style.display = 'block';

  const bar = document.getElementById('img-ocr-bar');
  const txt = document.getElementById('img-ocr-progress-text');
  const phases = [
    {pct:25, msg:'画像を読み込み中...'},
    {pct:50, msg:'文字領域を検出中...'},
    {pct:78, msg:'文字を認識中...'},
    {pct:100, msg:'項目をマッピング中...'}
  ];
  let idx = 0;
  bar.style.width = '0%';
  const tick = () => {
    if (idx >= phases.length) {
      // 完了 → 結果表示
      document.getElementById('img-ocr-loading').style.display = 'none';
      document.getElementById('img-ocr-result').style.display = 'block';
      const fn = document.getElementById('img-filename');
      if (fn && file && file.name) fn.textContent = file.name;
      ocrDocZoomReset();
      return;
    }
    bar.style.width = phases[idx].pct + '%';
    txt.textContent = phases[idx].msg;
    idx++;
    setTimeout(tick, 480);
  };
  tick();
}
function resetImageUpload() {
  document.getElementById('img-upload-initial').style.display = 'block';
  document.getElementById('img-ocr-loading').style.display = 'none';
  document.getElementById('img-ocr-result').style.display = 'none';
  const inp = document.getElementById('img-upload-input');
  if (inp) inp.value = '';
}
function highlightOcr(key, on) {
  const marks = document.querySelectorAll('#ocr-markings .ocr-mark');
  marks.forEach(m => {
    if (m.getAttribute('data-key') === key) {
      m.classList.toggle('ocr-mark-active', on);
      if (on) {
        // 該当マーキングが見えるようにスクロール
        const viewport = document.getElementById('ocr-doc-viewport');
        const svg = document.getElementById('ocr-doc-svg');
        if (viewport && svg) {
          const svgRect = svg.getBoundingClientRect();
          const vpRect = viewport.getBoundingClientRect();
          const markY = parseFloat(m.getAttribute('y'));
          const ratio = svgRect.height / 990;
          const targetY = markY * ratio - vpRect.height/2 + (svgRect.top - vpRect.top) + viewport.scrollTop + 40;
          viewport.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
        }
      }
    }
  });
}
let ocrDocZoomLevel = 1;
function ocrDocZoom(delta) {
  ocrDocZoomLevel = Math.max(0.5, Math.min(2.5, ocrDocZoomLevel + delta));
  const svg = document.getElementById('ocr-doc-svg');
  if (svg) svg.style.transform = `scale(${ocrDocZoomLevel})`;
  const lbl = document.getElementById('ocr-zoom-label');
  if (lbl) lbl.textContent = Math.round(ocrDocZoomLevel * 100) + '%';
}
function ocrDocZoomReset() {
  ocrDocZoomLevel = 1;
  const svg = document.getElementById('ocr-doc-svg');
  if (svg) svg.style.transform = 'scale(1)';
  const lbl = document.getElementById('ocr-zoom-label');
  if (lbl) lbl.textContent = '100%';
}
function confirmOcrResult() {
  // 互換性のため残置：実処理は submitNewCase() に統合済み
  submitNewCase();
}

// ── 録音 ──
function toggleRecording() {
  if (recState === 'idle') startRec();
  else if (recState === 'recording') stopRec();
}

async function startRec() {
  recState = 'recording';
  recSeconds = 0;
  const btn = document.getElementById('rec-btn');
  btn.classList.remove('idle'); btn.classList.add('recording');
  btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
  document.getElementById('rec-status').textContent = '録音中... マイクボタンを押すと停止します';
  document.getElementById('rec-area').classList.add('recording');
  document.getElementById('rec-result').style.display = 'none';

  // タイマー
  recTimerInterval = setInterval(() => {
    recSeconds++;
    const m = String(Math.floor(recSeconds/60)).padStart(2,'0');
    const s = String(recSeconds%60).padStart(2,'0');
    const el = document.getElementById('rec-timer');
    el.textContent = m+':'+s;
    el.classList.add('running');
  }, 1000);

  // 波形アニメーション
  const bars = document.querySelectorAll('#rec-waveform .rec-bar');
  recWaveInterval = setInterval(() => {
    bars.forEach(b => {
      const h = 6 + Math.random()*20;
      b.style.height = h+'px';
      b.classList.add('active');
    });
  }, 120);

  // マイクAPI
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
  } catch(e) {
    // マイク許可なしでもデモとして続行
  }
}

function stopRec() {
  recState = 'done';
  clearInterval(recTimerInterval);
  clearInterval(recWaveInterval);

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
  }

  const btn = document.getElementById('rec-btn');
  btn.classList.remove('recording'); btn.classList.add('idle');
  btn.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
  document.getElementById('rec-timer').classList.remove('running');
  document.getElementById('rec-area').classList.remove('recording');
  document.getElementById('rec-status').textContent = '録音完了 — AI解析中...';
  document.querySelectorAll('#rec-waveform .rec-bar').forEach(b => { b.style.height='8px'; b.classList.remove('active'); });

  // AI解析（デモ文字起こし→Claude API）
  runAiAnalysis('rec');
}

function resetRec() {
  recState = 'idle';
  clearInterval(recTimerInterval);
  clearInterval(recWaveInterval);
  recExtracted = null;
  const btn = document.getElementById('rec-btn');
  if(btn){ btn.className='rec-btn idle'; btn.innerHTML='<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>'; }
  const timer = document.getElementById('rec-timer');
  if(timer){ timer.textContent='00:00'; timer.classList.remove('running'); }
  const area = document.getElementById('rec-area');
  if(area) area.classList.remove('recording');
  const status = document.getElementById('rec-status');
  if(status) status.textContent='マイクボタンを押して録音を開始してください';
  const result = document.getElementById('rec-result');
  if(result) result.style.display='none';
}

// ── アップロード ──
function handleFileSelect(e) {
  const file = e.target.files[0];
  if(file) processUploadFile(file);
}
function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById('upload-drop').classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if(file) processUploadFile(file);
}
function processUploadFile(file) {
  document.getElementById('upload-drop').style.display='none';
  const preview = document.getElementById('upload-file-preview');
  preview.style.display='block';
  document.getElementById('upload-filename').textContent = file.name;
  document.getElementById('upload-filesize').textContent = (file.size/1024/1024).toFixed(2)+' MB';
  document.getElementById('upload-result').style.display='none';

  // プログレスアニメーション
  let pct = 0;
  const bar = document.getElementById('upload-bar');
  const status = document.getElementById('upload-status');
  status.textContent = 'アップロード中...';
  const prog = setInterval(() => {
    pct += Math.random()*18;
    if(pct>=100){ pct=100; clearInterval(prog); status.textContent='✅ アップロード完了 — AI解析中...'; runAiAnalysis('upload'); }
    bar.style.width = pct+'%';
  }, 180);
}
function resetUpload() {
  uploadExtracted = null;
  const drop = document.getElementById('upload-drop');
  if(drop) drop.style.display='';
  const preview = document.getElementById('upload-file-preview');
  if(preview) preview.style.display='none';
  const result = document.getElementById('upload-result');
  if(result) result.style.display='none';
  const inp = document.getElementById('upload-input');
  if(inp) inp.value='';
}

// ── AI解析（録音・アップロード共通） ──
const demoTranscript = 'もしもし、株式会社〇〇商事の山田と申します。えー、来週の木曜日、5月25日の午前中に、埼玉県川口市から神奈川県横浜市まで、パレット8枚、重量800キロの常温品をお願いしたいんですが。時間は厳守でお願いしたくて、着地のバースは予約済みです。4トンウィングで対応できますか？';

async function runAiAnalysis(mode) {
  const transcriptEl = document.getElementById(mode+'-transcript');
  const gridEl = document.getElementById(mode+'-ai-grid');
  const resultEl = document.getElementById(mode+'-result');
  const badgeEl = mode==='rec' ? document.getElementById('rec-confidence-badge') : null;

  if(resultEl) resultEl.style.display='block';
  if(transcriptEl) transcriptEl.textContent='';

  // タイピングアニメーション
  let idx=0;
  await new Promise(resolve => {
    const typer = setInterval(() => {
      if(!transcriptEl){ clearInterval(typer); resolve(); return; }
      transcriptEl.textContent += demoTranscript[idx];
      idx++;
      if(idx>=demoTranscript.length){ clearInterval(typer); resolve(); }
    }, 28);
  });

  if(gridEl) gridEl.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:12px;color:var(--text-muted);font-size:12px">🤖 Claude AIが解析中...</div>';

  // Claude API呼び出し
  let extracted = null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:600,
        messages:[{ role:'user', content:
          '以下の電話文字起こしから配送案件情報をJSONのみで抽出してください（説明文・コードブロック不要）。キー: client, from, to, goods, weight, deadline, vehicle, conditions。\n\n'+demoTranscript
        }]
      })
    });
    const data = await res.json();
    const text = data.content.map(i=>i.text||'').join('').replace(/```json|```/g,'').trim();
    extracted = JSON.parse(text);
  } catch(e) {
    // フォールバック
    extracted = { client:'株式会社〇〇商事', from:'埼玉県川口市', to:'神奈川県横浜市', goods:'パレット 8枚', weight:'800kg', deadline:'05/25 AM指定', vehicle:'4tウィング', conditions:'時間厳守 / バース予約済み' };
  }

  if(mode==='rec'){ recExtracted=extracted; if(badgeEl) badgeEl.textContent='高信頼度'; }
  else { uploadExtracted=extracted; }

  if(gridEl) {
    const labels = {client:'取引先',from:'発地',to:'着地',goods:'荷物',weight:'重量',deadline:'希望納期',vehicle:'車格',conditions:'条件・備考'};
    gridEl.innerHTML = Object.entries(labels).map(([k,l]) =>
      `<div class="ai-extract-item"><div class="ai-extract-label">${l}</div><div class="ai-extract-val">${extracted[k]||'—'}</div></div>`
    ).join('');
  }

  const statusEl = mode==='rec'
    ? document.getElementById('rec-status')
    : document.getElementById('upload-status');
  if(statusEl) statusEl.textContent = '✅ AI解析完了 — 内容を確認して「個別案件処理へ登録」を押してください';
}

// ── 手入力フォームリセット ──
function clearManualForm() {
  ['f-client','f-phone','f-from','f-to','f-goods','f-weight','f-deadline','f-note'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value='';
  });
  const sel1 = document.getElementById('f-vehicle');
  if(sel1) sel1.selectedIndex=0;
  const sel2 = document.getElementById('f-channel');
  if(sel2) sel2.selectedIndex=0;
}

// ── 登録実行（確認モーダルを挟む） ──
function submitNewCase() {
  let caseData = null;
  const missing = [];

  if (currentRegTab === 'rec') {
    const ext = recExtracted;
    if (!ext) { showToast('録音してAI解析を完了してください', 'warn'); return; }
    const client   = (ext.client   || '').trim();
    const from     = (ext.from     || '').trim();
    const to       = (ext.to       || '').trim();
    const deadline = (ext.deadline || '').trim();
    if (!client)   missing.push('取引先名');
    if (!from)     missing.push('発地');
    if (!to)       missing.push('着地');
    if (!deadline) missing.push('希望納期');
    if (missing.length) { showToast(missing.join('・') + ' は必須です', 'warn'); return; }
    caseData = {
      client, from, to,
      goods: (ext.goods || '') + (ext.weight ? ' / ' + ext.weight : ''),
      deadline, ch: 'tel'
    };

  } else if (currentRegTab === 'upload') {
    const ext = uploadExtracted;
    if (!ext) { showToast('音声ファイルをアップロードしてAI解析を完了してください', 'warn'); return; }
    const client   = (ext.client   || '').trim();
    const from     = (ext.from     || '').trim();
    const to       = (ext.to       || '').trim();
    const deadline = (ext.deadline || '').trim();
    if (!client)   missing.push('取引先名');
    if (!from)     missing.push('発地');
    if (!to)       missing.push('着地');
    if (!deadline) missing.push('希望納期');
    if (missing.length) { showToast(missing.join('・') + ' は必須です', 'warn'); return; }
    caseData = {
      client, from, to,
      goods: (ext.goods || '') + (ext.weight ? ' / ' + ext.weight : ''),
      deadline, ch: 'tel'
    };

  } else if (currentRegTab === 'image') {
    // OCR読取結果から値を取得
    const result = document.getElementById('img-ocr-result');
    if (!result || result.style.display === 'none') {
      showToast('画像をアップロードしてAI-OCR解析を完了してください', 'warn'); return;
    }
    const getVal = (key) => {
      const item = document.querySelector('.ocr-field-item[data-key="' + key + '"] .ocr-field-input');
      return item ? item.value.trim() : '';
    };
    const client       = getVal('client');
    const from         = getVal('from');
    const to           = getVal('to');
    // 画像OCRでは「希望納期」は通常「卸し日」に相当
    const deadline     = getVal('unloadDate') || getVal('loadDate');
    if (!client)   missing.push('取引先名');
    if (!from)     missing.push('発地');
    if (!to)       missing.push('着地');
    if (!deadline) missing.push('希望納期（卸し日）');
    if (missing.length) { showToast(missing.join('・') + ' は必須です', 'warn'); return; }
    const goods = getVal('goods');
    const vehicle = getVal('vehicle');
    const note = getVal('note');
    caseData = {
      client, from, to,
      goods: goods + (vehicle ? ' / ' + vehicle : ''),
      deadline,
      conditions: note,
      ch: 'image'
    };

  } else {
    // 手入力
    const client   = document.getElementById('f-client').value.trim();
    const from     = document.getElementById('f-from').value.trim();
    const to       = document.getElementById('f-to').value.trim();
    const deadline = document.getElementById('f-deadline').value.trim();
    if (!client)   missing.push('取引先名');
    if (!from)     missing.push('発地');
    if (!to)       missing.push('着地');
    if (!deadline) missing.push('希望納期');
    if (missing.length) { showToast(missing.join('・') + ' は必須です', 'warn'); return; }
    const goods  = document.getElementById('f-goods').value.trim();
    const weight = document.getElementById('f-weight').value.trim();
    const ch     = document.getElementById('f-channel').value;
    caseData = {
      client, from, to,
      goods: goods + (weight ? ' / ' + weight : ''),
      deadline, ch
    };
  }

  // 確認モーダルを表示（実登録は確認後）
  _pendingCaseData = caseData;
  openRegisterConfirm(caseData);
}

// ── 確認モーダル：プレビュー表示 ──
let _pendingCaseData = null;
function openRegisterConfirm(d) {
  const sourceMap = { rec:'🎙️ 録音', upload:'📂 音声アップロード', image:'🖼️ 画像OCR', manual:'✏️ 手入力' };
  const html = `
    <div class="rc-row"><div class="rc-label">登録方法</div><div class="rc-val">${sourceMap[currentRegTab] || '—'}</div></div>
    <div class="rc-row"><div class="rc-label">取引先名</div><div class="rc-val rc-strong">${_esc(d.client)}</div></div>
    <div class="rc-row"><div class="rc-label">発地</div><div class="rc-val">${_esc(d.from)}</div></div>
    <div class="rc-row"><div class="rc-label">着地</div><div class="rc-val">${_esc(d.to)}</div></div>
    <div class="rc-row"><div class="rc-label">荷物</div><div class="rc-val">${_esc(d.goods || '—')}</div></div>
    <div class="rc-row"><div class="rc-label">希望納期</div><div class="rc-val rc-strong">${_esc(d.deadline)}</div></div>
    ${d.conditions ? `<div class="rc-row"><div class="rc-label">備考</div><div class="rc-val" style="font-size:11px;color:var(--text-secondary)">${_esc(d.conditions)}</div></div>` : ''}
  `;
  document.getElementById('rc-content').innerHTML = html;
  document.getElementById('register-confirm-modal').classList.add('open');
}
function closeRegisterConfirm() {
  document.getElementById('register-confirm-modal').classList.remove('open');
}
function _esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ── 確認モーダルから「登録を確定」を押下したときの実処理 ──
function confirmRegisterCase() {
  const caseData = _pendingCaseData;
  if (!caseData) { closeRegisterConfirm(); return; }

  // 案件IDを生成して未処理リストに追加
  const now = new Date();
  const newId = now.getFullYear().toString().slice(2)
    + String(now.getMonth()+1).padStart(2,'0')
    + String(now.getDate()).padStart(2,'0')
    + String(Math.floor(Math.random()*900)+100);

  unprocessedCases.unshift({
    id: newId,
    status: '未解析',
    client: caseData.client,
    from: caseData.from,
    to: caseData.to,
    goods: caseData.goods || '—',
    deadline: caseData.deadline,
    conditions: caseData.conditions || '',
    ch: caseData.ch || 'tel',
    time: String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'),
    analyzed: false,
    casePattern: null,
    vehicles: []
  });
  // パターン自動判定
  unprocessedCases[0].casePattern = autoDetectPattern(unprocessedCases[0]);

  // 配車計画表（未割当案件）にも自動反映
  if (typeof addToDispatchUnassigned === 'function') {
    addToDispatchUnassigned(newId, {
      client: caseData.client, from: caseData.from, to: caseData.to,
      goods: caseData.goods || '—', deadline: caseData.deadline
    });
  }

  closeRegisterConfirm();
  closeModal('register-modal');
  switchPhase('unprocessed');
  const newCase = unprocessedCases[0];
  selectedUnprocessedId = newCase.id;
  renderUnprocessedList();
  renderUnprocessedDetail(0);
  setTimeout(() => {
    const card = document.querySelector('#ucard-' + newCase.id);
    if (card) { card.classList.add('selected'); card.scrollIntoView({behavior:'smooth', block:'nearest'}); }
  }, 50);
  updatePhaseCounts();
  showToast('案件「'+caseData.client+'」を未処理リスト / 配車計画表の未割当案件 に登録しました', 'success');
  _pendingCaseData = null;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  運賃適正判定
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 距離の簡易推定（発地・着地キーワードベース）
function estimateDistance(from, to) {
  const dist = {
    '川口': {'横浜':35,'大田':30,'品川':28,'千葉':55,'さいたま':18,'名古屋':380,'大阪':550,'静岡':180},
    '船橋': {'大田':42,'品川':45,'横浜':60,'川口':55,'名古屋':350,'大阪':520},
    'つくば': {'名古屋':410,'横浜':120,'大田':70,'品川':72},
    '渋谷': {'大阪':540,'名古屋':380,'横浜':30,'川口':28},
    '品川': {'さいたま':28,'横浜':22,'川口':26},
    '江東': {'千葉':45,'横浜':55,'川口':35},
  };
  for (const [f, targets] of Object.entries(dist)) {
    if (from.includes(f)) {
      for (const [t, d] of Object.entries(targets)) {
        if (to.includes(t)) return d;
      }
    }
  }
  // デフォルト推定：都道府県間距離
  if (from.includes('東京') && to.includes('大阪')) return 540;
  if (from.includes('東京') && to.includes('名古屋')) return 380;
  if (from.includes('東京') || from.includes('埼玉') || from.includes('千葉') || from.includes('神奈川')) {
    if (to.includes('東京') || to.includes('埼玉') || to.includes('千葉') || to.includes('神奈川')) return 40;
    if (to.includes('名古屋') || to.includes('愛知')) return 380;
    if (to.includes('大阪') || to.includes('京都')) return 540;
    if (to.includes('静岡')) return 180;
  }
  return 80; // fallback
}

// 車格ごとの基礎パラメータ
function getVehicleParams(vehicle) {
  const v = vehicle || '2tトラック';
  if (v.includes('軽')) return { fuelKm:12, fuelCost:175, highwayPer100:600,  driverHourly:2200, depreciationDay:2500, name:'軽バン' };
  if (v.includes('2t'))  return { fuelKm:8,  fuelCost:175, highwayPer100:1800, driverHourly:2800, depreciationDay:4000, name:'2tトラック' };
  if (v.includes('4t'))  return { fuelKm:5,  fuelCost:175, highwayPer100:3200, driverHourly:3200, depreciationDay:6000, name:'4tウィング' };
  if (v.includes('10t')) return { fuelKm:3.5,fuelCost:175, highwayPer100:5500, driverHourly:3800, depreciationDay:9000, name:'10tトラック' };
  return { fuelKm:8, fuelCost:175, highwayPer100:1800, driverHourly:2800, depreciationDay:4000, name:'2tトラック' };
}

async function calcFare(caseObj) {
  const dist = estimateDistance(caseObj.from, caseObj.to);
  const vp   = getVehicleParams(caseObj.aiResult?.vehicle || caseObj.vehicle || '2tトラック');
  const hours = Math.max(1, (dist / 60) + 1.5); // 平均60km/h + 積降し1.5h

  // コスト積み上げ
  const fuel        = Math.round(dist / vp.fuelKm * vp.fuelCost);
  const highway     = Math.round(dist * vp.highwayPer100 / 100);
  const driver      = Math.round(hours * vp.driverHourly);
  const depreciation= Math.round(vp.depreciationDay * Math.max(1, dist/200));
  const overhead    = Math.round((fuel + highway + driver + depreciation) * 0.15);
  const totalCost   = fuel + highway + driver + depreciation + overhead;
  const recommend   = Math.round(totalCost * 1.28 / 1000) * 1000; // 粗利28%
  const min         = Math.round(totalCost * 1.10 / 1000) * 1000;
  const max         = Math.round(totalCost * 1.50 / 1000) * 1000;
  const avg         = Math.round((min + max) / 2 / 500) * 500;

  const costMax = Math.max(fuel, highway, driver, depreciation, overhead);
  const costs = [
    { label:'燃料代',         val:fuel,         pct:Math.round(fuel/costMax*100),         color:'#3BB888' },
    { label:'高速代',         val:highway,       pct:Math.round(highway/costMax*100),       color:'#60a5fa' },
    { label:'ドライバー人件費',val:driver,        pct:Math.round(driver/costMax*100),        color:'#f97316' },
    { label:'車両コスト',     val:depreciation,  pct:Math.round(depreciation/costMax*100),  color:'#a78bfa' },
    { label:'諸経費（15%）', val:overhead,       pct:Math.round(overhead/costMax*100),       color:'#94a3b8' },
  ];

  // Claude API で根拠・提案コメントを生成
  let reason = '';
  let proposals = [];
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:500,
        messages:[{ role:'user', content:
          `以下の配送案件について運賃判定のJSON（説明文・コードブロック不要）を返してください。\n`+
          `案件：${caseObj.from}→${caseObj.to} / 距離${dist}km / 車格:${vp.name} / 荷物:${caseObj.goods}\n`+
          `原価合計:¥${totalCost.toLocaleString()} / 推奨価格:¥${recommend.toLocaleString()}\n`+
          `JSONキー: reason(string,60字以内), proposals(array of {tag,tagClass,detail,price})\n`+
          `tagClassは推奨="tag-recommend", 代替="tag-alt", 最低="tag-min" の3つ。priceはNumber。`
        }]
      })
    });
    const data = await res.json();
    const text = data.content.map(b=>b.text||'').join('').replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(text);
    reason = parsed.reason || '';
    proposals = parsed.proposals || [];
  } catch(e) { /* フォールバック */ }

  if (!reason) reason = `距離${dist}kmの${vp.name}案件。燃料代¥${fuel.toLocaleString()}+高速代¥${highway.toLocaleString()}+人件費¥${driver.toLocaleString()}を積み上げ、市場相場と照合した結果です。`;
  if (!proposals.length) proposals = [
    { tag:'推奨', tagClass:'tag-recommend', detail:`粗利28%確保・市場平均値（交渉余地あり）`, price: recommend },
    { tag:'代替', tagClass:'tag-alt',       detail:`強気設定・付加価値（時間厳守・品質）を訴求`, price: max },
    { tag:'最低', tagClass:'tag-min',       detail:`コスト+10%・継続取引優遇ライン`, price: min },
  ];

  // ステータス判定
  let statusClass, statusIcon, statusLabel;
  if (recommend >= avg * 0.95) { statusClass='ok';   statusIcon='✅'; statusLabel='成約 OK'; }
  else if (recommend >= min)    { statusClass='warn'; statusIcon='⚠️'; statusLabel='要交渉'; }
  else                          { statusClass='ng';   statusIcon='❌'; statusLabel='採算NG'; }

  return { recommend, min, max, avg, totalCost, costs, reason, proposals, statusClass, statusIcon, statusLabel };
}

function selectFareProposal(el) {
  el.closest('.fare-proposals').querySelectorAll('.fare-proposal').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  配車計画ページ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let currentDispatchTab = 'planning';
let currentDispatchSubtab = 'dnd';

function switchDispatchTab(tab) {
  currentDispatchTab = tab;
  document.querySelectorAll('.dispatch-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('dtab-' + tab).classList.add('active');
  // 確定済みバッジ：処理済みの請求確定済み件数を反映
  if (typeof buildConfirmedAssignments === 'function') buildConfirmedAssignments();
  const cntEl = document.getElementById('dtab-confirmed-count');
  if (cntEl && typeof processedCases !== 'undefined') {
    cntEl.textContent = processedCases.filter(function(c){ return c.billingConfirmed; }).length;
  }
  renderDispatchContent();
}

function switchDispatchSubtab(sub) {
  currentDispatchSubtab = sub;
  document.querySelectorAll('.dispatch-subtab').forEach(t => t.classList.remove('active'));
  document.getElementById('dsubtab-' + sub).classList.add('active');
  const dnd = document.getElementById('dispatch-dnd');
  if (dnd) dnd.style.display = sub === 'dnd' ? 'flex' : 'none';
  document.getElementById('dispatch-schedule').style.display = sub === 'schedule' ? 'flex' : 'none';
  document.getElementById('dispatch-dotai').style.display    = sub === 'dotai'    ? 'flex' : 'none';
  const commEl = document.getElementById('dispatch-comm');
  if (commEl) commEl.style.display = sub === 'comm' ? 'flex' : 'none';
  if (sub === 'dnd') renderDnd();
  else if (sub === 'schedule') renderSchedule();
  else if (sub === 'dotai') renderDotai();
  else if (sub === 'comm') renderCommLog();
}

// 時刻 → 0〜24 の割合(%)
function timeToPercent(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return ((h + m / 60) / 24) * 100;
}
function durationToPercent(startStr, endStr) {
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  return (((eh + em / 60) - (sh + sm / 60)) / 24) * 100;
}

// ═══════════════════════════════════════════════════════════════
//  【新】正規化マスタデータ（Layer 1）
//  bases[] / drivers[] / vehicles[] / assignments[] の4層構造
//  既存の _SCHED_DRIVER_NAMES, _DND_INIT_DRIVERS は後方互換のため
//  当面は併存させる（ステップ5で削除）
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// 拠点マスタ（営業所）
// 論点O：拠点IDは名前と同一視。aliases[]で市区町村名と一致を見る
// 既存の個別案件 vehicles[].base は「川口市」等の市区町村名で入っているため、
// マイグレーション時に aliases を介して baseId に変換する
// ─────────────────────────────────────────────────────────────
const bases = [
  { id:'B001', name:'川口拠点',  region:'関東', aliases:['川口市','川口','埼玉県川口市'] },
  { id:'B002', name:'戸田拠点',  region:'関東', aliases:['戸田市','戸田','埼玉県戸田市'] },
  { id:'B003', name:'川崎拠点',  region:'関東', aliases:['川崎市','川崎','神奈川県川崎市'] },
  { id:'B004', name:'船橋拠点',  region:'関東', aliases:['船橋市','船橋','千葉県船橋市'] },
  { id:'B005', name:'品川拠点',  region:'関東', aliases:['品川区','品川','東京都品川区'] },
  { id:'B006', name:'江東拠点',  region:'関東', aliases:['江東区','江東','東京都江東区'] },
  { id:'B007', name:'横浜拠点',  region:'関東', aliases:['横浜市','横浜','神奈川県横浜市'] },
  { id:'B008', name:'大田拠点',  region:'関東', aliases:['大田区','大田','東京都大田区'] },
];
const _baseById = Object.fromEntries(bases.map(b => [b.id, b]));
function getBaseById(id) { return _baseById[id] || null; }

// 市区町村名 → baseId 解決ヘルパー（完全一致 → 前方一致 → 部分一致の順）
function resolveBaseIdByAlias(text) {
  if (!text) return null;
  const t = String(text).trim();
  // 完全一致
  for (const b of bases) {
    if (b.aliases.some(a => a === t)) return b.id;
  }
  // 前方一致
  for (const b of bases) {
    if (b.aliases.some(a => t.startsWith(a))) return b.id;
  }
  // 部分一致
  for (const b of bases) {
    if (b.aliases.some(a => t.indexOf(a) >= 0)) return b.id;
  }
  return null;
}

// クロス配車のグローバル設定（論点A：二択）
const dispatchConfig = {
  crossBaseEnabled: true,   // 全拠点間でクロス可（false=不可）
};

// ─────────────────────────────────────────────────────────────
// 拠点間距離マスタ（論点I：拠点間の距離表をマスタで持つ）
// fromBaseId-toBaseId の対称キー。片方向だけ登録すれば双方向で解決
// ─────────────────────────────────────────────────────────────
const _baseDistanceRaw = [
  // 川口を起点とする近隣（実距離の概算km）
  ['B001','B002',  6],   // 川口-戸田
  ['B001','B005', 25],   // 川口-品川
  ['B001','B006', 22],   // 川口-江東
  ['B001','B003', 32],   // 川口-川崎
  ['B001','B007', 38],   // 川口-横浜
  ['B001','B008', 30],   // 川口-大田
  ['B001','B004', 28],   // 川口-船橋
  // 戸田を起点
  ['B002','B005', 24],
  ['B002','B006', 23],
  ['B002','B003', 30],
  ['B002','B007', 36],
  ['B002','B008', 28],
  ['B002','B004', 32],
  // 川崎を起点
  ['B003','B007',  8],
  ['B003','B005', 12],
  ['B003','B008', 10],
  ['B003','B006', 18],
  ['B003','B004', 38],
  // その他
  ['B004','B005', 26],
  ['B004','B006', 18],
  ['B004','B007', 42],
  ['B004','B008', 28],
  ['B005','B006', 12],
  ['B005','B007', 18],
  ['B005','B008',  5],
  ['B006','B007', 24],
  ['B006','B008', 14],
  ['B007','B008', 14],
];
const _baseDistanceMap = (function(){
  const m = {};
  for (const [a, b, d] of _baseDistanceRaw) {
    m[a + '-' + b] = d;
    m[b + '-' + a] = d;  // 対称
  }
  return m;
})();
function getBaseDistance(fromBaseId, toBaseId) {
  if (!fromBaseId || !toBaseId) return null;
  if (fromBaseId === toBaseId) return 0;
  const v = _baseDistanceMap[fromBaseId + '-' + toBaseId];
  return (typeof v === 'number') ? v : null;
}

// ドライバーマスタ：車両を持たない
// 論点3：協力会社ドライバーは baseId:null（拠点なし）
// 論点P：通常ドライバーは単一拠点。複数拠点運用は車両側で表現
const drivers = (function(){
  const NAMES = [
    '山田 一郎','鈴木 次郎','佐藤 三郎','田中 四郎','高橋 五郎','渡辺 六郎','伊藤 七郎','中村 八郎','小林 九郎','松本 十郎',
    '加藤 十一','吉田 十二','山本 十三','井上 十四','木村 十五','斉藤 十六','清水 十七','林  十八','山口 十九','森  二十',
    '池田 大輔','橋本 健一','石川 翔太','前田 拓也','藤田 直樹','岡田 雄一','後藤 達也','長谷川 賢','村上 浩司','近藤 修平',
    '坂本 慎吾','遠藤 亮介','青木 隼人','藤井 大樹','西村 涼太','福田 翔','太田 圭','三浦 蓮','岡本 颯太','金子 陽介',
    '中島 海斗','原田 智也','安藤 諒','武田 篤志','上田 悠真','谷口 駿','宮崎 樹','野口 翼','大野 弘樹','菊地 凌'
  ];
  const PARTNER_IDX = new Set([8, 23, 31, 42, 47]);
  const PARTNERS = ['北関東物流㈱', '関東陸運㈱', '東海運輸㈱', 'みなと物流㈱', '中部運送㈱'];
  // 自社ドライバーを8拠点に分散配置（決定論的に割当）
  // 既存の個別案件データ（vehicles[].base）と整合させやすい配置
  const ASSIGNED_BASE_IDS = ['B001','B002','B003','B004','B005','B006','B007','B008'];
  let pCounter = 0;
  return NAMES.map((name, i) => {
    const isPartner = PARTNER_IDX.has(i);
    const obj = {
      id: 'D' + String(i + 1).padStart(3, '0'),  // D001..D050
      name,
      license: i % 3 === 0 ? ['中型','大型'] : (i % 3 === 1 ? ['大型'] : ['中型']),
      partner: false,
      // ★ Phase 1a 追加：拠点情報
      baseId:     isPartner ? null : ASSIGNED_BASE_IDS[i % ASSIGNED_BASE_IDS.length],
      homeBaseId: isPartner ? null : ASSIGNED_BASE_IDS[i % ASSIGNED_BASE_IDS.length],
      // ★ デフォルト担当者（Assignment作成時の初期値）。後でTEAM_MEMBERS初期化後に値が入る
      defaultOwnerId: null
    };
    if (isPartner) {
      obj.partner = true;
      obj.partnerName = PARTNERS[pCounter % PARTNERS.length];
      pCounter++;
    }
    return obj;
  });
})();

// 車両マスタ：ドライバーを持たない
// 論点P：車両は複数拠点に所属できる（baseIds:[]）。主拠点は baseId として保持
// 論点3：自社車両のみ。協力会社の車両は管理外
const vehicles = (function(){
  const TYPES = [
    {type:'平ボディ', cap:[2,4,10]}, {type:'ウィング', cap:[4,10]},
    {type:'冷蔵',     cap:[2,4]},    {type:'冷凍',     cap:[2,4]},
    {type:'箱',       cap:[2,4]}
  ];
  // 約10%の車両は複数拠点で運用される長距離車両として設定
  // （論点P：拠点をまたがる「中間にいる車両」）
  const MULTI_BASE_VEHICLE_IDX = new Set([3, 11, 19, 27, 35, 43]);
  return drivers.map((d, i) => {
    const vehNum = String(1000 + ((i * 137 + 245) % 9000)).padStart(4, '0');
    const typeDef = TYPES[i % TYPES.length];
    const ton = typeDef.cap[i % typeDef.cap.length];
    // 初期値はドライバーの拠点と同じ（移行容易性）。協力会社ドライバー位置の車両は
    // baseIdを別途割り当てる必要があるが、ここではドライバーと同じ並びで決定論的に配置
    let mainBaseId = d.baseId;
    if (!mainBaseId) {
      // ドライバーが協力会社の場合、車両は近隣の自社拠点に割り当て
      const ASSIGNED = ['B001','B002','B003','B004','B005','B006','B007','B008'];
      mainBaseId = ASSIGNED[i % ASSIGNED.length];
    }
    const baseIds = [mainBaseId];
    if (MULTI_BASE_VEHICLE_IDX.has(i)) {
      // 隣接拠点を1つ追加（決定論的に選択）
      const NEIGHBOR_MAP = {
        'B001':'B002','B002':'B001','B003':'B007','B004':'B006',
        'B005':'B008','B006':'B004','B007':'B003','B008':'B005'
      };
      const secondary = NEIGHBOR_MAP[mainBaseId];
      if (secondary && !baseIds.includes(secondary)) baseIds.push(secondary);
    }
    return {
      id: 'V' + vehNum,
      plate: '車両' + vehNum,
      type: typeDef.type,
      ton,
      maxLoad: ton * 1000,
      // ★ Phase 1a 追加：拠点情報
      baseId: mainBaseId,         // 主拠点
      homeBaseId: mainBaseId,     // 戻り先（通常は主拠点と同じ）
      baseIds: baseIds            // 全所属拠点（主拠点 + 副拠点）
    };
  });
})();

// マスタ参照ヘルパー（O(1)アクセス用のインデックス）
const _driverById = Object.fromEntries(drivers.map(d => [d.id, d]));
const _vehicleById = Object.fromEntries(vehicles.map(v => [v.id, v]));
function getDriverById(id) { return _driverById[id] || null; }
function getVehicleById(id) { return _vehicleById[id] || null; }

// 旧IDとの橋渡し：scheduleData/dndDrivers が使う 'V1382' 形式の旧driverIdから新drivers.idへ
// （旧定義では driverId='V'+vehicleNum だったため、初期データでは vehicleId と一致する）
function _legacyDriverIdToNew(legacyId) {
  // legacyId='V1382' → vehicleId='V1382' を持つ車両のインデックス → 同じインデックスのdriver.id
  const idx = vehicles.findIndex(v => v.id === legacyId);
  return idx >= 0 ? drivers[idx].id : null;
}

// ═══════════════════════════════════════════════════════════════
//  Assignment レイヤー（Phase 1a 追加）
//  日次のドライバー×車両の組み合わせを表現する3層目のテーブル
//
//  ★ 注意：既存コードに `assignments` 配列と関連APIが後方で定義されている（line 18000付近）。
//  Phase 1a では、既存実装に拠点・担当・クロス配車関連のプロパティを「追加」する形で進める。
//  本セクションでは Phase 1a 固有のヘルパーのみを定義し、既存 `assignments` 配列が
//  生成された後（DOMContentLoaded等のタイミング）に拠点情報を充填する。
//
//  論点1：ID は既存実装の 'A' + 連番をそのまま使用（_newAssignmentId）
//  論点2：ownerId をAssignmentに持つ（Phase 1a で追加プロパティ）
//  論点4：法令チェックはドライバー側/車両側を別評価（実装はPhase 1b以降）
//  論点B/D：effectiveBaseId は車両のbaseIdをデフォルトとして配車時に明示選択
//  論点E：戻り回送は relatedReturnId で紐付け
//  論点G：全員編集可（権限制御は業務ルールでナビゲート）
//  論点H：mainOwnerId が主担当（他者は参照のみ、UIで誘導）
//  論点J：主担当の初期値は配車実行者
// ═══════════════════════════════════════════════════════════════

// クロス配車判定（論点S：ドライバーbaseId と effectiveBaseId が異なる、または車両の副拠点運用）
function isCrossBaseAssignment(assignment) {
  if (!assignment) return false;
  const d = getDriverById(assignment.driverId);
  const v = getVehicleById(assignment.vehicleId);
  if (!d || !v) return false;
  if (d.partner) return false;  // 協力会社は対象外（論点3）
  const effBase = assignment.effectiveBaseId || v.baseId;
  if (d.baseId && d.baseId !== effBase) return true;
  if (v.baseId !== effBase) return true;
  return false;
}

// Phase 1a プロパティの初期値計算
function _computePhase1aProps(assignment) {
  const d = getDriverById(assignment.driverId);
  const v = getVehicleById(assignment.vehicleId);
  // effectiveBaseId のデフォルト：車両のbaseId（論点D）
  const effectiveBaseId = assignment.effectiveBaseId
    || (v ? v.baseId : null);
  // ownerId のデフォルト：ドライバーのdefaultOwnerId（後で TEAM_MEMBERS 初期化時に設定される）
  const ownerId = assignment.ownerId
    || (d ? d.defaultOwnerId : null);
  return {
    effectiveBaseId,
    ownerId,
    mainOwnerId: assignment.mainOwnerId || ownerId,
    caseIds: assignment.caseIds || (assignment.client ? [] : []),
    legNo: assignment.legNo || null,
    parentAssignmentId: assignment.parentAssignmentId || null,
    relatedReturnId: assignment.relatedReturnId || null,
    isReturn: assignment.isReturn || false,
    note: assignment.note || ''
  };
}

// 既存 assignments 配列の各レコードに Phase 1a プロパティを追加する
// （既存 assignments が生成された後、DOMContentLoaded で呼ばれる）
function _augmentAssignmentsWithPhase1a() {
  if (typeof assignments === 'undefined' || !Array.isArray(assignments)) return 0;
  let count = 0;
  for (const a of assignments) {
    // 既に追加済みならスキップ（idempotent）
    if (Object.prototype.hasOwnProperty.call(a, 'effectiveBaseId')) continue;
    const props = _computePhase1aProps(a);
    Object.assign(a, props);
    a.crossBase = isCrossBaseAssignment(a);
    if (!a.createdAt) a.createdAt = new Date().toISOString();
    if (!a.updatedAt) a.updatedAt = a.createdAt;
    count++;
  }
  return count;
}

// ─────────────────────────────────────────────────────────────
// Assignment CRUD（Phase 1a 追加）
// 既存の reassignDriver/reassignVehicle とは別軸で、フルライフサイクル管理を提供
// ─────────────────────────────────────────────────────────────

function getAssignmentsForDate(dateKey) {
  if (typeof assignments === 'undefined') return [];
  return assignments.filter(a => a.date === dateKey);
}

function getAssignmentByDriverAndDate(driverId, dateKey) {
  return getAssignmentsForDate(dateKey).find(a => a.driverId === driverId) || null;
}

function getAssignmentsByVehicleAndDate(vehicleId, dateKey) {
  return getAssignmentsForDate(dateKey).filter(a => a.vehicleId === vehicleId);
}

function createAssignment(input) {
  if (typeof assignments === 'undefined') return null;
  if (!input || !input.date || !input.driverId || !input.vehicleId) {
    console.warn('createAssignment: missing required fields', input);
    return null;
  }
  const now = new Date().toISOString();
  const actorId = input.ownerId
    || (typeof window !== 'undefined' && window.__getCurrentUserId ? window.__getCurrentUserId() : null);
  // ID 発番：既存実装の _newAssignmentId を使う
  const id = input.id || (typeof _newAssignmentId === 'function' ? _newAssignmentId() : ('A' + Date.now()));
  const a = Object.assign({
    id,
    tab: input.tab || 'planning',
    date: input.date,
    driverId: input.driverId,
    vehicleId: input.vehicleId,
    start: input.start || null,
    end: input.end || null,
    status: input.status || '計画中',
    client: input.client || '',
    from: input.from || '',
    to: input.to || '',
    goods: input.goods || '',
    deadline: input.deadline || '',
    label: input.label || '',
    color: input.color || '',
  }, _computePhase1aProps(input), {
    createdAt: now,
    createdBy: actorId,
    updatedAt: now,
    updatedBy: actorId,
  });
  a.ownerId = actorId || a.ownerId;
  a.mainOwnerId = a.mainOwnerId || a.ownerId;
  a.crossBase = isCrossBaseAssignment(a);

  assignments.push(a);
  if (typeof rebuildAssignmentIndex === 'function') rebuildAssignmentIndex();
  _appendAssignmentLog(a.id, 'create', null, a, actorId);
  return a;
}

function updateAssignment(id, patch, actorId) {
  if (typeof getAssignmentById !== 'function') return null;
  const a = getAssignmentById(id);
  if (!a) return null;
  const before = Object.assign({}, a);
  const ALLOWED = ['date','driverId','vehicleId','effectiveBaseId','ownerId',
    'mainOwnerId','caseIds','start','end','status','client','from','to',
    'goods','deadline','label','color','legNo','parentAssignmentId',
    'relatedReturnId','isReturn','note','tab'];
  for (const key of ALLOWED) {
    if (patch && Object.prototype.hasOwnProperty.call(patch, key)) {
      a[key] = patch[key];
    }
  }
  a.crossBase = isCrossBaseAssignment(a);
  a.updatedAt = new Date().toISOString();
  a.updatedBy = actorId || a.ownerId;
  if (typeof rebuildAssignmentIndex === 'function') rebuildAssignmentIndex();
  _appendAssignmentLog(a.id, 'update', before, a, actorId);
  return a;
}

function deleteAssignment(id, actorId) {
  if (typeof assignments === 'undefined') return false;
  const idx = assignments.findIndex(a => a.id === id);
  if (idx < 0) return false;
  const before = assignments[idx];
  assignments.splice(idx, 1);
  if (typeof rebuildAssignmentIndex === 'function') rebuildAssignmentIndex();
  _appendAssignmentLog(id, 'delete', before, null, actorId);
  return true;
}

// ─────────────────────────────────────────────────────────────
// 戻り回送の生成（論点C/E）
// クロス配車Assignmentを引数に取り、翌日朝のケースなしAssignmentを作る
// ─────────────────────────────────────────────────────────────
function createReturnAssignment(srcAssignmentId, options) {
  if (typeof getAssignmentById !== 'function') return null;
  const src = getAssignmentById(srcAssignmentId);
  if (!src || !src.crossBase) return null;
  const opts = options || {};

  // 翌日のYYYY-MM-DD
  const srcDate = new Date(src.date + 'T00:00:00');
  srcDate.setDate(srcDate.getDate() + 1);
  const nextDateKey = srcDate.toISOString().slice(0, 10);

  const v = getVehicleById(src.vehicleId);
  const returnBaseId = v ? v.homeBaseId : src.effectiveBaseId;

  const ret = createAssignment({
    tab: src.tab,
    date: nextDateKey,
    driverId: src.driverId,
    vehicleId: src.vehicleId,
    effectiveBaseId: returnBaseId,
    ownerId: src.ownerId,
    mainOwnerId: src.mainOwnerId,
    caseIds: [],
    start: opts.start || '06:00',
    end:   opts.end   || '09:00',
    label: '戻り回送',
    isReturn: true,
    note: '戻り回送（' + src.id + ' から自動生成）'
  });
  if (ret) {
    updateAssignment(src.id, { relatedReturnId: ret.id }, src.ownerId);
  }
  return ret;
}

// ─────────────────────────────────────────────────────────────
// 変更履歴ログ（論点Q）
// ─────────────────────────────────────────────────────────────
let assignmentLogs = [];
function _appendAssignmentLog(assignmentId, action, before, after, actorId) {
  let diff = null;
  if (before && after) {
    diff = {};
    const TRACKED = ['driverId','vehicleId','effectiveBaseId','ownerId',
      'mainOwnerId','caseIds','start','end','isReturn','crossBase','status'];
    for (const key of TRACKED) {
      const bv = before[key];
      const av = after[key];
      const bStr = Array.isArray(bv) ? JSON.stringify(bv) : bv;
      const aStr = Array.isArray(av) ? JSON.stringify(av) : av;
      if (bStr !== aStr) diff[key] = { from: bv, to: av };
    }
  }
  assignmentLogs.push({
    id: 'L' + String(assignmentLogs.length + 1).padStart(6, '0'),
    assignmentId,
    action,
    diff,
    snapshot: after ? Object.assign({}, after) : null,
    actorId: actorId || null,
    at: new Date().toISOString()
  });
}
function getAssignmentLogs(assignmentId) {
  return assignmentLogs.filter(L => L.assignmentId === assignmentId);
}

// ═══════════════════════════════════════════════════════════════
//  Phase 1d：法令チェック分離評価
//  v.law.items は全てドライバー属性として分類（運転時間/拘束/休息/連続運転/休憩）
//  車両属性は v.cap（積載量）と v.type（車種）から派生で生成
//
//  buildLawChipHtml(vEntry, opts)
//    - vEntry: { law, cap, type, driverId, vehicleId, ... } 案件の候補車両エントリ
//    - opts:   { isCross?:bool, dCenterName?, vCenterName?, distanceKm? }
//    - 通常配車：従来通り単一ポップオーバー（中身を「ドライバー側」セクションだけにする）
//    - クロス配車：「ドライバー側 / 車両側」を別セクションで表示し、回送距離を併記
//  戻り値：HTMLストリング（チップ＋ポップオーバー）
// ═══════════════════════════════════════════════════════════════
function buildLawChipHtml(vEntry, opts) {
  if (!vEntry || !vEntry.law) return '';
  const l = vEntry.law;
  opts = opts || {};
  const icon = l.status === 'ok' ? '✅' : l.status === 'warn' ? '⚠️' : '❌';
  const warnCount = (l.items || []).filter(it => !it.ok).length;

  // ドライバー側の項目（既存のv.law.items全部）
  function renderItems(items) {
    return items.map(it => `
      <div class="law-tip-item ${!it.ok ? 'warn-item' : ''}">
        <div class="law-tip-label">${it.ok ? '<span style="color:#6ee7b7">✅</span>' : '<span style="color:#fca5a5">⚠️</span>'} ${it.title}</div>
        <div class="law-tip-val">${it.val}</div>
      </div>
    `).join('');
  }

  // 車両側の項目を派生生成（積載・車種・最大積載）
  function buildVehicleItems() {
    const items = [];
    // 積載量チェック
    if (vEntry.cap) {
      items.push({
        ok: true,
        title: '車両最大積載',
        val: vEntry.cap + ' まで対応'
      });
    }
    // 車種
    if (vEntry.type) {
      items.push({
        ok: true,
        title: '車種',
        val: vEntry.type
      });
    }
    // マスタから取れる情報があれば追加
    const masterV = vEntry.vehicleId && typeof window.getVehicleById === 'function'
      ? window.getVehicleById(vEntry.vehicleId) : null;
    if (masterV) {
      items.push({
        ok: true,
        title: '車両拠点',
        val: (typeof window.getBaseById === 'function' && masterV.baseId
          ? (window.getBaseById(masterV.baseId) || {}).name : masterV.baseId) || '—'
      });
      items.push({
        ok: true,
        title: '所属拠点',
        val: (masterV.baseIds && masterV.baseIds.length > 1)
          ? `${masterV.baseIds.length}拠点で運用可`
          : '主拠点のみ'
      });
    }
    return items;
  }

  // 通常配車：従来UI互換
  if (!opts.isCross) {
    const tipItems = renderItems(l.items || []);
    return `<span class="law-chip-wrap" onclick="event.stopPropagation()">
      <span class="law-chip ${l.status}">${icon} 法令${l.label}${warnCount > 0 ? ' (' + warnCount + '件)' : ''}</span>
      <div class="law-tip">
        <div class="law-tip-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${l.status === 'ok' ? '#6ee7b7' : '#fcd34d'}" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          法令適合判定
        </div>
        <div class="law-tip-grid">${tipItems}</div>
      </div>
    </span>`;
  }

  // クロス配車：ドライバー側 / 車両側 を別セクションで表示
  const driverItems = renderItems(l.items || []);
  const vehicleItemsArr = buildVehicleItems();
  const vehicleItemsHtml = renderItems(vehicleItemsArr);

  const distanceHint = (opts.distanceKm != null && opts.distanceKm > 0)
    ? `<div class="law-tip-relay-note"><strong>回送距離 ${opts.distanceKm}km</strong> を運転時間に加算して評価しています</div>`
    : '';

  const dMeta = opts.dCenterName
    ? `<div class="law-tip-section-meta">ドライバー所属：<strong>${opts.dCenterName}</strong></div>`
    : '';
  const vMeta = opts.vCenterName
    ? `<div class="law-tip-section-meta">車両所属：<strong>${opts.vCenterName}</strong></div>`
    : '';

  return `<span class="law-chip-wrap" onclick="event.stopPropagation()">
    <span class="law-chip ${l.status}">${icon} 法令${l.label}${warnCount > 0 ? ' (' + warnCount + '件)' : ''}</span>
    <div class="law-tip" style="width:360px">
      <div class="law-tip-title">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${l.status === 'ok' ? '#6ee7b7' : '#fcd34d'}" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        法令適合判定（クロス配車）
      </div>
      <div class="law-tip-section law-tip-section-driver">
        <div class="law-tip-section-header">
          <span class="law-tip-section-icon">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#a5f3fc" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </span>
          ドライバー側
        </div>
        ${dMeta}
        <div class="law-tip-grid">${driverItems}</div>
        ${distanceHint}
      </div>
      <div class="law-tip-section law-tip-section-vehicle">
        <div class="law-tip-section-header">
          <span class="law-tip-section-icon">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fcd34d" stroke-width="2.5"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></svg>
          </span>
          車両側
        </div>
        ${vMeta}
        <div class="law-tip-grid">${vehicleItemsHtml}</div>
      </div>
    </div>
  </span>`;
}
// グローバル公開
if (typeof window !== 'undefined') {
  window.buildLawChipHtml = buildLawChipHtml;
}

// ─────────────────────────────────────────────────────────────
// 既存形式 → Assignment マイグレーション（論点L/M）
// 既存の processedCases から baseId/ownerId を逆引きしてAssignment化
// ─────────────────────────────────────────────────────────────

function _resolveVehicleIdByPlate(plate) {
  if (!plate) return null;
  const s = String(plate).replace(/^車両/, '').trim();
  if (!s) return null;
  const v = vehicles.find(v => v.id === 'V' + s || v.plate === '車両' + s || v.plate === plate);
  return v ? v.id : null;
}

function _resolveDriverIdByName(name) {
  if (!name) return null;
  const d = drivers.find(d => d.name === name);
  return d ? d.id : null;
}

function _resolveBaseIdForCase(caseObj, vehicleId) {
  if (caseObj && Array.isArray(caseObj.vehicles)) {
    const match = caseObj.vehicles.find(v => v.id === vehicleId || v.id === ('車両' + vehicleId));
    if (match && match.base) {
      const bid = resolveBaseIdByAlias(match.base);
      if (bid) return bid;
    }
  }
  const v = getVehicleById(vehicleId);
  return v ? v.baseId : null;
}

function _migrateProcessedCaseToAssignment(c) {
  if (!c) return null;
  const driverId = _resolveDriverIdByName(c.driver);
  const vehicleId = _resolveVehicleIdByPlate(c.vehicle);
  if (!driverId || !vehicleId) return null;

  let dateKey = null;
  const m = String(c.completion || '').match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (m) {
    dateKey = m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
  }
  if (!dateKey) return null;

  const effBaseId = _resolveBaseIdForCase(c, vehicleId)
    || (getVehicleById(vehicleId) ? getVehicleById(vehicleId).baseId : null);

  return createAssignment({
    tab: 'confirmed',
    date: dateKey,
    driverId,
    vehicleId,
    effectiveBaseId: effBaseId,
    caseIds: [c.id],
    status: c.status || '完了',
    client: c.client || '',
    from: c.from || '',
    to: c.to || '',
    goods: c.goods || '',
    label: c.client || '',
    note: '過去データから自動移行'
  });
}

function migrateLegacyDataToAssignments(options) {
  const opts = options || {};
  const result = { migrated: 0, skipped: 0, errors: [] };
  const source = opts.processedCases
    || (typeof processedCases !== 'undefined' ? processedCases : null);
  if (!Array.isArray(source)) {
    result.errors.push('processedCases not accessible');
    return result;
  }
  for (const c of source) {
    try {
      const a = _migrateProcessedCaseToAssignment(c);
      if (a) result.migrated++;
      else result.skipped++;
    } catch (e) {
      result.errors.push({ caseId: c && c.id, error: String(e) });
      result.skipped++;
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// 既存 dndDrivers との橋渡し（互換性レイヤー）
// ─────────────────────────────────────────────────────────────

// 旧IDから新Assignment IDへ
function _legacyDndIdToAssignmentId(legacyId, dateKey) {
  const list = getAssignmentsForDate(dateKey);
  const a = list.find(x => x.vehicleId === legacyId);
  return a ? a.id : null;
}

// ─────────────────────────────────────────────────────────────
// グローバル公開
// ─────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.bases = bases;
  window.assignmentLogs = assignmentLogs;
  window.dispatchConfig = dispatchConfig;
  window.getBaseById = getBaseById;
  window.resolveBaseIdByAlias = resolveBaseIdByAlias;
  window.getBaseDistance = getBaseDistance;
  window.isCrossBaseAssignment = isCrossBaseAssignment;
  window.getAssignmentsForDate = getAssignmentsForDate;
  window.getAssignmentByDriverAndDate = getAssignmentByDriverAndDate;
  window.getAssignmentsByVehicleAndDate = getAssignmentsByVehicleAndDate;
  window.createAssignment = createAssignment;
  window.updateAssignment = updateAssignment;
  window.deleteAssignment = deleteAssignment;
  window.createReturnAssignment = createReturnAssignment;
  window.getAssignmentLogs = getAssignmentLogs;
  window.migrateLegacyDataToAssignments = migrateLegacyDataToAssignments;
  window._legacyDndIdToAssignmentId = _legacyDndIdToAssignmentId;
  window._augmentAssignmentsWithPhase1a = _augmentAssignmentsWithPhase1a;
  // Phase 1b：UIから呼ぶマスタアクセス関数の追加公開
  window.getDriverById = getDriverById;
  window.getVehicleById = getVehicleById;
  window._legacyDriverIdToNew = _legacyDriverIdToNew;

  // 開発用：データ構造の状態を確認するヘルパー
  window.__phase1aDataStatus = function() {
    return {
      bases: bases.length,
      drivers: drivers.length,
      vehicles: vehicles.length,
      assignments: (typeof assignments !== 'undefined' ? assignments.length : 0),
      assignmentLogs: assignmentLogs.length,
      partnerDrivers: drivers.filter(d => d.partner).length,
      multiBaseVehicles: vehicles.filter(v => v.baseIds && v.baseIds.length > 1).length,
      driversWithBase: drivers.filter(d => d.baseId).length,
      augmentedAssignments: (typeof assignments !== 'undefined'
        ? assignments.filter(a => a.effectiveBaseId !== undefined).length : 0),
      crossBaseAssignments: (typeof assignments !== 'undefined'
        ? assignments.filter(a => a.crossBase).length : 0),
      baseDistribution: bases.map(b => ({
        baseId: b.id, name: b.name,
        drivers: drivers.filter(d => d.baseId === b.id).length,
        vehicles: vehicles.filter(v => v.baseId === b.id).length
      }))
    };
  };

  // 起動時：データ層の初期化状態をコンソールに出力（Phase 1a の検証用）
  document.addEventListener('DOMContentLoaded', function _phase1aBootCheck() {
    try {
      // 既存 assignments への Phase 1a プロパティ充填
      const augmented = _augmentAssignmentsWithPhase1a();

      // Phase 1b デモ用：今日の日付で数件のクロス配車Assignmentを投入
      // （UI動作確認用。本番運用時は削除）
      _seedDemoCrossBaseAssignments();

      const s = window.__phase1aDataStatus();
      console.log('[Phase 1a/1b] Data layer initialized:', s);
      console.log('[Phase 1a] Augmented ' + augmented + ' existing assignments with base/owner props.');
    } catch (e) {
      console.error('[Phase 1a] Boot check failed:', e);
    }
  });

  // Phase 1b デモ用：今日の日付で数件のクロス配車Assignmentを投入する
  // 動作確認後は削除する想定
  function _seedDemoCrossBaseAssignments() {
    if (typeof assignments === 'undefined') return;
    const todayKey = new Date().toISOString().slice(0, 10);
    // 既に当日Assignmentがあるならスキップ（重複防止）
    const existing = assignments.filter(a => a.date === todayKey);
    if (existing.length > 0) return;

    // パターン1：D001（B001=川口）が B002=戸田 の車両を運用（クロス配車）
    //   drivers[1] と同じ車両を使う（V+番号）
    const d1 = drivers[0];  // B001
    const v_for_b002 = vehicles.find(v => v.baseId === 'B002');
    if (d1 && v_for_b002) {
      createAssignment({
        date: todayKey,
        driverId: d1.id,
        vehicleId: v_for_b002.id,
        effectiveBaseId: 'B002',
        client: '本日のクロス配車テスト',
        start: '09:00',
        end: '17:00',
        status: '計画中',
        note: '[デモ] B001ドライバー × B002車両のクロス配車'
      });
    }
    // パターン2：複数拠点車両（vehicles[3]、B004 主拠点・B006 副拠点持ち）を B006 で運用
    const v_multi = vehicles[3];
    const d_for_b006 = drivers.find(d => d.baseId === 'B006');
    if (v_multi && d_for_b006) {
      createAssignment({
        date: todayKey,
        driverId: d_for_b006.id,
        vehicleId: v_multi.id,
        effectiveBaseId: 'B006',
        client: '副拠点運用テスト',
        start: '08:00',
        end: '16:00',
        status: '計画中',
        note: '[デモ] 複数拠点車両（B004主・B006副）をB006で運用'
      });
    }
    // パターン3：通常配車（クロスでない）×2件くらい、バッジ表示の確認用
    [10, 20].forEach(i => {
      const d = drivers[i];
      if (!d || d.partner) return;
      const v = vehicles[i];
      if (!v) return;
      createAssignment({
        date: todayKey,
        driverId: d.id,
        vehicleId: v.id,
        effectiveBaseId: v.baseId,
        client: '本日の通常配車',
        start: '08:30',
        end: '15:30',
        status: '計画中'
      });
    });
  }
}

// ═══════════════════════════════════════════════════════════════
//  【旧→正規化済み】既存コード互換のための派生定義
//  旧named constantsの "中身" は新マスタ drivers[]/vehicles[] から
//  自動生成する。これにより：
//   - 旧コード（dndDrivers, scheduleDataなど45箇所参照）はそのまま動作
//   - データの単一情報源（Source of Truth）は drivers[]/vehicles[]/assignments[] に集約
//   - マスタ修正（名前変更等）が全体に自動伝播
// ═══════════════════════════════════════════════════════════════

// 旧 _SCHED_DRIVER_NAMES：drivers[].name から派生
const _SCHED_DRIVER_NAMES = drivers.map(d => d.name);

const _SCHED_CLIENTS = [
  {name:'株式会社○○商事',    from:'埼玉県川口市',   to:'神奈川県横浜市'},
  {name:'△△食品株式会社',    from:'千葉県船橋市',   to:'東京都大田区'},
  {name:'南関東物流株式会社',  from:'神奈川県川崎市', to:'静岡県静岡市'},
  {name:'XYZ物産株式会社',     from:'東京都品川区',   to:'埼玉県さいたま市'},
  {name:'北海道産直食品',      from:'東京都江東区',   to:'千葉県千葉市'},
  {name:'関西化学工業株式会社',from:'東京都品川区',   to:'大阪府大阪市'},
  {name:'九州青果株式会社',    from:'福岡県福岡市',   to:'東京都中央区'},
  {name:'東北精密機械株式会社',from:'宮城県仙台市',   to:'神奈川県川崎市'},
  {name:'◇◇アパレル株式会社',from:'東京都渋谷区',   to:'大阪府大阪市'},
  {name:'関東建材株式会社',    from:'群馬県前橋市',   to:'東京都板橋区'},
  {name:'みらい飲料',          from:'静岡県浜松市',   to:'愛知県名古屋市'},
  {name:'ABC電子工業',         from:'神奈川県厚木市', to:'山梨県甲府市'},
];

const _SCHED_GOODS = [
  'パレット/800kg/常温','ケース/500kg/冷蔵','電子部品/400kg','事務用品/200kg',
  '生鮮/600kg/冷蔵','化学品/900kg/常温','青果物/1,200kg/冷蔵','精密機械/500kg',
  '衣料品/300kg','建材/1,800kg','飲料/700kg','機械部品/650kg',
];

// 計画中ステータス分布の重み（運行中50%, 待機35%, アラート6%, 休車9%）
function _pickStatus(seed, isConfirmed) {
  if (isConfirmed) return '完了';
  // ハッシュ風ミックスで分布を均す
  let h = (seed * 2654435761) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 1597334677); h ^= h >>> 15;
  const r = (h >>> 0) % 100;
  if (r < 6)  return 'アラート';
  if (r < 56) return '運行中';
  if (r < 91) return '待機中';
  return '休車';
}

// 簡易疑似乱数（同じインデックスで毎回同じ結果を返す）
function _srand(i, salt) { return ((i * 2654435761 + salt * 374761393) >>> 0) % 1000 / 1000; }

// ブロックの色（計画中 = 緑、確定済み = 明緑、積込/準備 = グレー）
// カラフルさを避け、運行は1色、状態（準備/完了/要対応）のみ色で区別
function _planColor(kind) {
  if (kind === 'prep')    return '#64748b'; // 準備（グレー）
  if (kind === 'main')    return '#1a7a5e'; // 計画運行
  if (kind === 'second')  return '#1a7a5e'; // 2件目も同じ緑に統一（旧 #0D4A3A）
  if (kind === 'done')    return '#3BB888'; // 完了（明緑）
  if (kind === 'wait')    return '#cbd5e1'; // 待機
  return '#94a3b8';
}

function _genScheduleRow(i, isConfirmed) {
  // 旧：const name = _SCHED_DRIVER_NAMES[i]; → drivers[i].name から取得
  // 旧：vehicleNum = (i * 137 + 245) % 9000 計算 → vehicles[i] から取得
  const driverMaster = drivers[i];
  const vehicleMaster = vehicles[i];
  const name = driverMaster ? driverMaster.name : '—';
  const vehicleNum = vehicleMaster ? vehicleMaster.id.replace(/^V/, '') : '0000';
  const vehicle = vehicleMaster ? vehicleMaster.plate : '車両0000';
  const driverId = vehicleMaster ? vehicleMaster.id : ('V' + vehicleNum); // 旧形式互換
  const status = _pickStatus(i + 1, isConfirmed);

  // 休車は空便
  if (status === '休車') return { id:driverId, driver:name, vehicle, status, blocks:[] };

  const c1 = _SCHED_CLIENTS[(i * 3 + 1) % _SCHED_CLIENTS.length];
  const c2 = _SCHED_CLIENTS[(i * 5 + 7) % _SCHED_CLIENTS.length];
  const g1 = _SCHED_GOODS[(i * 2 + 3) % _SCHED_GOODS.length];
  const g2 = _SCHED_GOODS[(i * 4 + 5) % _SCHED_GOODS.length];

  // 開始時刻：5:00〜10:00 の間で散らす
  const startH = 5 + Math.floor(_srand(i, 11) * 6);
  const startM = Math.floor(_srand(i, 13) * 4) * 15;
  const startStr = String(startH).padStart(2,'0') + ':' + String(startM).padStart(2,'0');

  // 運行時間：2〜5時間
  const runH = 2 + Math.floor(_srand(i, 17) * 4);
  const endH1 = Math.min(23, startH + runH);
  const end1Str = String(endH1).padStart(2,'0') + ':' + String(startM).padStart(2,'0');

  // 準備ブロック（30分前）
  const prepStart = startH * 60 + startM - 30;
  const prepStartStr = String(Math.floor(prepStart/60)).padStart(2,'0') + ':' + String(prepStart%60).padStart(2,'0');

  const blocks = [];

  // 確定済みタブは完了ブロック1個
  if (isConfirmed) {
    blocks.push({
      start:startStr, end:end1Str, label:c1.name.replace('株式会社','').replace('株式','').substring(0,8),
      color:_planColor('done'),
      client:c1.name, from:c1.from, to:c1.to, goods:g1, deadline:'完了'
    });
    return { id:driverId, driver:name, vehicle, status, blocks };
  }

  // 準備
  if (prepStart >= 0) {
    blocks.push({
      start:prepStartStr, end:startStr, label:'準備',
      color:_planColor('prep'),
      client:c1.name, from:c1.from, to:'積込・出発準備', goods:g1, deadline:'-'
    });
  }
  // 1件目
  blocks.push({
    start:startStr, end:end1Str, label:c1.name.replace('株式会社','').replace('株式','').substring(0,8),
    color: status === 'アラート' ? '#dc2626' : _planColor('main'),
    client:c1.name, from:c1.from, to:c1.to, goods:g1,
    deadline: status === 'アラート' ? '⚠ 遅延の恐れ' : '本日中'
  });

  // 2件目（半数程度）
  if (_srand(i, 23) > 0.45 && endH1 + 1 < 22) {
    const start2H = endH1 + 1;
    const start2Str = String(start2H).padStart(2,'0') + ':00';
    const run2 = 2 + Math.floor(_srand(i, 29) * 3);
    const end2H = Math.min(22, start2H + run2);
    const end2Str = String(end2H).padStart(2,'0') + ':00';
    blocks.push({
      start:start2Str, end:end2Str, label:c2.name.replace('株式会社','').replace('株式','').substring(0,8),
      color:_planColor('second'),
      client:c2.name, from:c2.from, to:c2.to, goods:g2, deadline:'夕方'
    });
  }
  return { id:driverId, driver:name, vehicle, status, blocks };
}

const scheduleData = {
  planning:  _SCHED_DRIVER_NAMES.map((_, i) => _genScheduleRow(i, false)),
  confirmed: _SCHED_DRIVER_NAMES.slice(0, 18).map((_, i) => _genScheduleRow(i, true))
};

// ═══════════════════════════════════════════════════════════════
//  【新】アサインメント層（Layer 2）
//  「いつ・誰が・どの車両で・どの案件を」を1レコード=1運行で表現
//  scheduleData の各 block を案件1つ分のアサインメントとして変換
// ═══════════════════════════════════════════════════════════════

let _assignmentSeq = 1;
function _newAssignmentId() {
  return 'A' + String(_assignmentSeq++).padStart(5, '0');
}

// scheduleDataの行 → アサインメントの配列に変換
function _scheduleRowToAssignments(row, tab) {
  // 旧driverId(='V'+vehicleNum)から新driverIdへマップ
  const newDriverId = _legacyDriverIdToNew(row.id) || row.id;
  // 初期データではdriverと車両が1対1なので、行のidをそのままvehicleIdとして使う
  const vehicleId = row.id;
  const date = '2026-05-27'; // 初期データは本日扱い

  return (row.blocks || [])
    .filter(b => b.label !== '準備') // 準備ブロックはアサインメントではなく派生表示
    .map(b => ({
      id: _newAssignmentId(),
      tab,              // 'planning' | 'confirmed'
      date,
      driverId: newDriverId,
      vehicleId,
      start: b.start,
      end: b.end,
      status: row.status,
      client: b.client,
      from: b.from,
      to: b.to,
      goods: b.goods,
      deadline: b.deadline,
      label: b.label,
      color: b.color
    }));
}

// 初期アサインメントを生成
const assignments = (function(){
  const out = [];
  ['planning', 'confirmed'].forEach(tab => {
    (scheduleData[tab] || []).forEach(row => {
      _scheduleRowToAssignments(row, tab).forEach(a => out.push(a));
    });
  });
  return out;
})();

// 検索用インデックス（必要に応じて再構築）
function rebuildAssignmentIndex() {
  _assignByDriver = {};
  _assignByVehicle = {};
  _assignById = {};
  assignments.forEach(a => {
    _assignById[a.id] = a;
    (_assignByDriver[a.driverId] = _assignByDriver[a.driverId] || []).push(a);
    (_assignByVehicle[a.vehicleId] = _assignByVehicle[a.vehicleId] || []).push(a);
  });
}
let _assignByDriver = {}, _assignByVehicle = {}, _assignById = {};
rebuildAssignmentIndex();

// 取得系API
function getAssignmentsForDriver(driverId, tab) {
  return (_assignByDriver[driverId] || []).filter(a => !tab || a.tab === tab);
}
function getAssignmentsForVehicle(vehicleId, tab) {
  return (_assignByVehicle[vehicleId] || []).filter(a => !tab || a.tab === tab);
}
function getAssignmentById(id) { return _assignById[id] || null; }

// 時間帯重複チェック（"HH:MM"を分に変換）
function _hhmmToMin(s) { const [h, m] = s.split(':').map(Number); return h * 60 + m; }
function _overlaps(a, b) {
  if (a.date !== b.date) return false;
  return _hhmmToMin(a.start) < _hhmmToMin(b.end) && _hhmmToMin(b.start) < _hhmmToMin(a.end);
}

// バリデーション：同じドライバー/車両の時間衝突を検出
function validateAssignment(target) {
  const conflicts = { driver: [], vehicle: [], capacity: null, license: null };
  assignments.forEach(a => {
    if (a.id === target.id) return;
    if (a.driverId === target.driverId && _overlaps(a, target)) conflicts.driver.push(a);
    if (a.vehicleId === target.vehicleId && _overlaps(a, target)) conflicts.vehicle.push(a);
  });
  // 積載量チェック（goodsから重量を抽出）
  const v = getVehicleById(target.vehicleId);
  if (v && target.goods) {
    const m = String(target.goods).match(/([\d,]+)\s*kg/);
    if (m) {
      const kg = parseInt(m[1].replace(/,/g, ''), 10);
      if (kg > v.maxLoad) conflicts.capacity = { needed: kg, max: v.maxLoad };
    }
  }
  return {
    ok: conflicts.driver.length === 0 && conflicts.vehicle.length === 0 && !conflicts.capacity,
    conflicts
  };
}

// 更新系API：ドライバーだけ差し替え / 車両だけ差し替え / 両方
function reassignDriver(assignmentId, newDriverId) {
  const a = getAssignmentById(assignmentId);
  if (!a) return { ok: false, reason: 'assignment not found' };
  if (!getDriverById(newDriverId)) return { ok: false, reason: 'driver not found' };
  const before = a.driverId;
  a.driverId = newDriverId;
  const r = validateAssignment(a);
  rebuildAssignmentIndex();
  return { ok: true, before, after: newDriverId, validation: r };
}
function reassignVehicle(assignmentId, newVehicleId) {
  const a = getAssignmentById(assignmentId);
  if (!a) return { ok: false, reason: 'assignment not found' };
  if (!getVehicleById(newVehicleId)) return { ok: false, reason: 'vehicle not found' };
  const before = a.vehicleId;
  a.vehicleId = newVehicleId;
  const r = validateAssignment(a);
  rebuildAssignmentIndex();
  return { ok: true, before, after: newVehicleId, validation: r };
}

// ═══════════════════════════════════════════════════════════════
//  【橋渡し】assignmentsからscheduleData形式を再構築する派生ビュー
//  ステップ4で renderSchedule をこちらに切り替える
// ═══════════════════════════════════════════════════════════════
function buildScheduleViewFromAssignments(tab) {
  const byDriver = {};
  assignments.filter(a => a.tab === tab).forEach(a => {
    if (!byDriver[a.driverId]) byDriver[a.driverId] = [];
    byDriver[a.driverId].push(a);
  });
  return drivers.map((d, i) => {
    const veh = vehicles[i]; // 当面は同インデックスの車両を既定の表示用とする
    const list = (byDriver[d.id] || []).slice().sort((x, y) => _hhmmToMin(x.start) - _hhmmToMin(y.start));
    // 準備ブロックを最初のアサインメントの30分前に挿入（旧形式互換）
    const blocks = [];
    list.forEach((a, idx) => {
      const vForBlock = getVehicleById(a.vehicleId);
      if (idx === 0) {
        const startMin = _hhmmToMin(a.start) - 30;
        if (startMin >= 0) {
          const ps = String(Math.floor(startMin / 60)).padStart(2, '0') + ':' + String(startMin % 60).padStart(2, '0');
          blocks.push({
            start: ps, end: a.start, label: '準備',
            color: '#64748b', client: a.client, from: a.from, to: '積込・出発準備', goods: a.goods, deadline: '-'
          });
        }
      }
      blocks.push({
        start: a.start, end: a.end,
        label: (a.label || a.client || '').replace('株式会社','').replace('株式','').substring(0, 8),
        color: a.color,
        client: a.client, from: a.from, to: a.to, goods: a.goods, deadline: a.deadline,
        _assignmentId: a.id,
        _vehicleId: a.vehicleId,
        _vehicleLabel: vForBlock ? vForBlock.plate : null
      });
    });
    // ステータス：休車は空、それ以外は最初のアサインメントから引く
    let status = '休車';
    if (list.length > 0) status = list[0].status;
    return {
      id: 'V' + (veh ? veh.id.slice(1) : '0000'),
      driver: d.name,
      vehicle: veh ? `${veh.plate} (${veh.ton}t)` : '—',
      status,
      blocks,
      _driverId: d.id,
      _defaultVehicleId: veh ? veh.id : null
    };
  });
}

// デバッグ用：console.log(window.__assignmentsDebug()) で状態確認
window.__assignmentsDebug = function() {
  return {
    drivers: drivers.length,
    vehicles: vehicles.length,
    assignments: assignments.length,
    samplePlanning: assignments.filter(a => a.tab === 'planning').slice(0, 3),
    sampleConfirmed: assignments.filter(a => a.tab === 'confirmed').slice(0, 3)
  };
};

// ═══════════════════════════════════════════════════════════════
//  ステップ7：衝突インジケータ
//  validateAll() の結果をタイムライン上に赤バッジで表示する
//  renderSchedule の後で呼べばOK。再描画ごとに自動で実行される。
// ═══════════════════════════════════════════════════════════════

// 旧driverId(='V'+vehicleNum) を新driverIdに、また逆方向の引きを担う
function _newDriverIdToLegacy(newDid) {
  // drivers配列のインデックス = vehicles配列のインデックス という規約に従う
  const i = drivers.findIndex(d => d.id === newDid);
  if (i < 0) return null;
  return vehicles[i] ? vehicles[i].id : null;
}

// 描画後のフック装着（旧 __refreshConflictBadges から
// バッジ表示処理を削除した版。車両D&D装着とサマリーバーのボタン挿入だけを行う）
window.__refreshConflictBadges = function() {
  const wrap = document.getElementById('schedule-wrap-inner');
  if (!wrap) return;

  // 車両D&D入れ替え用ハンドラを再装着
  if (typeof window.__attachVehicleSwapDnd === 'function') {
    window.__attachVehicleSwapDnd();
  }

  // 違反解消提案・エクスポートボタンを差し込む
  if (typeof window.__attachKaizenProposalButton === 'function') {
    window.__attachKaizenProposalButton();
  }
};

// サマリーバーに「違反解消提案」ボタンを動的に挿入
window.__attachKaizenProposalButton = function() {
  const summaryEl = document.querySelector('.sched-summary');
  if (!summaryEl) return;
  // 既存のボタンを削除（再装着）
  summaryEl.querySelectorAll('.sched-kpf-trigger, .sched-export-trigger').forEach(b => b.remove());

  // エクスポートボタンは常に表示
  const exportBtn = document.createElement('button');
  exportBtn.className = 'sched-kpf-trigger sched-export-trigger';
  exportBtn.style.background = '#EAF5F0';
  exportBtn.style.color = '#0D4A3A';
  exportBtn.style.borderColor = '#A7D8C5';
  exportBtn.innerHTML = `📥 エクスポート`;
  exportBtn.title = 'アサインメントをCSV/JSONで出力';
  exportBtn.onclick = function() { window.openExportMenu(); };

  // 違反件数を集計
  let violationCount = 0;
  try {
    const alerts = (typeof kaizenScanAll === 'function') ? kaizenScanAll() : [];
    violationCount = alerts.filter(a => a.level === 'violation').length;
  } catch(e) {}

  let kpfBtn = null;
  if (violationCount > 0) {
    kpfBtn = document.createElement('button');
    kpfBtn.className = 'sched-kpf-trigger';
    kpfBtn.innerHTML = `🩺 違反解消提案 <span class="sched-kpf-trigger-count">${violationCount}</span>`;
    kpfBtn.title = `${violationCount}件の改善基準告示違反があります。クリックして解消提案を確認`;
    kpfBtn.onclick = function() { window.openKaizenProposals(); };
  }

  // sched-sum-spacerの直前あたりに挿入（左から: 違反解消, エクスポート）
  const spacer = summaryEl.querySelector('.sched-sum-spacer');
  if (spacer) {
    if (kpfBtn) summaryEl.insertBefore(kpfBtn, spacer);
    summaryEl.insertBefore(exportBtn, spacer);
  } else {
    if (kpfBtn) summaryEl.appendChild(kpfBtn);
    summaryEl.appendChild(exportBtn);
  }
};

// ═══════════════════════════════════════════════════════════════
//  ステップ12：車両D&D入れ替え
//  タイムラインのドライバー欄にある車両表示をドラッグして、
//  別ドライバー行の車両表示にドロップすると、両者の車両が入れ替わる。
//  ドライバーは変わらず、車両だけ交換される。
//  影響範囲：
//   - そのドライバーの当日全アサインメントの vehicleId を更新
//   - 衝突判定（積載量・車両時間衝突）を自動再評価
// ═══════════════════════════════════════════════════════════════

let _vehicleSwapState = null; // {fromRowEl, fromDriverId, fromVehicleId}

window.__attachVehicleSwapDnd = function() {
  const wrap = document.getElementById('schedule-wrap-inner');
  if (!wrap) return;
  // 確定済みタブでは入れ替え禁止
  const isConfirmed = (typeof currentDispatchTab !== 'undefined' && currentDispatchTab === 'confirmed');

  wrap.querySelectorAll('[data-vehicle-swap-source="1"]').forEach(el => {
    // 既にハンドラ装着済みならスキップ
    if (el.__swapHandlerAttached) return;
    el.__swapHandlerAttached = true;

    if (isConfirmed) {
      el.setAttribute('draggable', 'false');
      el.style.cursor = 'default';
      return;
    }

    el.addEventListener('dragstart', function(e) {
      const rowEl = el.closest('.sched-row');
      if (!rowEl) return;
      const legacyDid = rowEl.getAttribute('data-driver-id');
      const newDid = _legacyDriverIdToNew(legacyDid);
      if (!newDid) { e.preventDefault(); return; }
      // 当該ドライバーの代表vehicleIdを取得（最初のassignmentから or マスタの固定車両）
      const myAssigns = assignments.filter(a => a.driverId === newDid && a.tab === currentDispatchTab);
      const vid = myAssigns.length > 0 ? myAssigns[0].vehicleId : legacyDid;
      _vehicleSwapState = {
        fromDriverId: newDid,
        fromLegacyDid: legacyDid,
        fromVehicleId: vid
      };
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'vehicle-swap:' + vid);
      // 透明なドラッグ画像（既存D&Dと統一）
      const img = new Image();
      img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
      e.dataTransfer.setDragImage(img, 0, 0);
      // ドラッグ中、他の車両アイコンに drop-target を準備（dragoverハンドラがクラス付与）
      e.stopPropagation();
    });

    el.addEventListener('dragend', function(e) {
      el.classList.remove('dragging');
      wrap.querySelectorAll('.sched-driver-vehicle.drop-target-vehicle').forEach(t => {
        t.classList.remove('drop-target-vehicle');
      });
      _vehicleSwapState = null;
    });

    el.addEventListener('dragover', function(e) {
      if (!_vehicleSwapState) return;
      const rowEl = el.closest('.sched-row');
      const legacyDid = rowEl ? rowEl.getAttribute('data-driver-id') : null;
      if (!legacyDid) return;
      const targetNewDid = _legacyDriverIdToNew(legacyDid);
      if (targetNewDid === _vehicleSwapState.fromDriverId) return; // 自分自身は不可
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      el.classList.add('drop-target-vehicle');
    });

    el.addEventListener('dragleave', function(e) {
      el.classList.remove('drop-target-vehicle');
    });

    el.addEventListener('drop', function(e) {
      e.preventDefault();
      el.classList.remove('drop-target-vehicle');
      if (!_vehicleSwapState) return;
      const rowEl = el.closest('.sched-row');
      const legacyDid = rowEl ? rowEl.getAttribute('data-driver-id') : null;
      if (!legacyDid) return;
      const targetNewDid = _legacyDriverIdToNew(legacyDid);
      if (!targetNewDid || targetNewDid === _vehicleSwapState.fromDriverId) return;

      // ターゲットドライバーの代表vehicleIdを取得
      const targetAssigns = assignments.filter(a => a.driverId === targetNewDid && a.tab === currentDispatchTab);
      const targetVid = targetAssigns.length > 0 ? targetAssigns[0].vehicleId : legacyDid;

      const swapResult = window.__swapDriverVehicles(
        _vehicleSwapState.fromDriverId, _vehicleSwapState.fromVehicleId,
        targetNewDid, targetVid
      );

      // 視覚フィードバック
      if (swapResult.ok) {
        el.classList.add('swap-flash');
        const srcEl = wrap.querySelector(`[data-driver-id="${_vehicleSwapState.fromLegacyDid}"] .sched-driver-vehicle`);
        if (srcEl) {
          srcEl.classList.add('swap-flash');
          setTimeout(() => srcEl.classList.remove('swap-flash'), 1200);
        }
        setTimeout(() => el.classList.remove('swap-flash'), 1200);
        // トースト＋再描画
        const fromV = getVehicleById(_vehicleSwapState.fromVehicleId);
        const toV = getVehicleById(targetVid);
        if (typeof showToast === 'function') {
          showToast(`車両を入れ替えました：${fromV ? fromV.plate : ''} ⇄ ${toV ? toV.plate : ''}`, 'success');
        } else if (typeof showDndToast === 'function') {
          showDndToast(`車両を入れ替えました：${fromV ? fromV.plate : ''} ⇄ ${toV ? toV.plate : ''}`);
        }
        // タイムライン再描画して整合性を取る
        if (typeof renderSchedule === 'function') renderSchedule();
      } else {
        if (typeof showToast === 'function') {
          showToast('車両入れ替えに失敗: ' + (swapResult.reason || ''), 'error');
        }
      }
      _vehicleSwapState = null;
    });
  });
};

// 2人のドライバーの全アサインメントの車両を入れ替える
// 戻り値: {ok, reason, swappedCount, validation}
window.__swapDriverVehicles = function(driverIdA, vehicleIdA, driverIdB, vehicleIdB) {
  if (!driverIdA || !driverIdB || driverIdA === driverIdB) {
    return { ok: false, reason: '同じドライバー同士は入れ替えできません' };
  }
  const vA = getVehicleById(vehicleIdA);
  const vB = getVehicleById(vehicleIdB);
  if (!vA || !vB) {
    return { ok: false, reason: '車両マスタに該当がありません' };
  }
  // 入れ替え実行
  let swapped = 0;
  assignments.forEach(a => {
    if (a.driverId === driverIdA && a.vehicleId === vehicleIdA) {
      a.vehicleId = vehicleIdB;
      swapped++;
    } else if (a.driverId === driverIdB && a.vehicleId === vehicleIdB) {
      a.vehicleId = vehicleIdA;
      swapped++;
    }
  });
  rebuildAssignmentIndex();

  // 入れ替え後の衝突チェック
  const validation = {
    aConflicts: 0, bConflicts: 0, capacityIssues: []
  };
  assignments.filter(a => a.driverId === driverIdA || a.driverId === driverIdB).forEach(a => {
    const r = validateAssignment(a);
    if (!r.ok) {
      if (a.driverId === driverIdA) validation.aConflicts++;
      else validation.bConflicts++;
      if (r.conflicts.capacity) validation.capacityIssues.push({
        assignmentId: a.id,
        driverId: a.driverId,
        client: a.client,
        needed: r.conflicts.capacity.needed,
        max: r.conflicts.capacity.max
      });
    }
  });

  return { ok: true, swappedCount: swapped, validation };
};

// 公開API（assignmentAPIが既に定義されていれば追加、未定義なら遅延セット）
if (typeof window.assignmentAPI === 'object' && window.assignmentAPI) {
  window.assignmentAPI.swapVehicles = window.__swapDriverVehicles;
} else if (typeof setTimeout !== 'undefined') {
  setTimeout(function() {
    if (window.assignmentAPI) window.assignmentAPI.swapVehicles = window.__swapDriverVehicles;
  }, 0);
}

// ═══════════════════════════════════════════════════════════════
//  ステップ3：UI操作API
//  UIから「ドライバーだけ差し替え」「車両だけ差し替え」「両方差し替え」
//  を呼べる公開関数。後ろで scheduleData にも反映して、既存の
//  描画コードがそのまま動くようにする（橋渡し）。
// ═══════════════════════════════════════════════════════════════

// scheduleData側に変更を反映：旧コードがscheduleDataを直接参照していても
// 表示がずれないように、新assignmentsの差分をscheduleDataにも書き戻す
function _syncAssignmentToScheduleData(assignmentId) {
  const a = getAssignmentById(assignmentId);
  if (!a) return;
  const data = scheduleData[a.tab] || [];
  // 新driverId → 旧driverId(=新vehicleId='V'+vehNum)へ逆引き
  const dIdx = drivers.findIndex(d => d.id === a.driverId);
  if (dIdx < 0) return;
  const legacyDriverRowId = vehicles[dIdx] ? vehicles[dIdx].id : null;
  // 該当行を探す。見つからない場合はスキップ
  const row = data.find(r => r.id === legacyDriverRowId);
  if (!row) return;
  // 行の vehicle 表記も更新（車両差し替え対応）
  const v = getVehicleById(a.vehicleId);
  if (v) row.vehicle = v.plate;
  // block側のラベル/メタも更新（_assignmentIdで紐付ける用に印を入れる）
  // 既存ブロックには_assignmentIdが無いため、startが一致するブロックを更新する簡易マッチ
  (row.blocks || []).forEach(b => {
    if (b.label === '準備') return;
    if (b.start === a.start && b.end === a.end) {
      b.client = a.client; b.from = a.from; b.to = a.to; b.goods = a.goods;
      b._assignmentId = a.id;
      b._vehicleId = a.vehicleId;
    }
  });
}

// 公開API：UI/コンソールから呼ぶ用
window.assignmentAPI = {
  list: () => assignments.slice(),
  get: (id) => getAssignmentById(id),
  forDriver: (did) => getAssignmentsForDriver(did),
  forVehicle: (vid) => getAssignmentsForVehicle(vid),

  // ドライバー差し替え
  changeDriver(assignmentId, newDriverIdOrName) {
    let newId = newDriverIdOrName;
    if (!getDriverById(newId)) {
      const d = drivers.find(x => x.name === newDriverIdOrName);
      if (d) newId = d.id;
    }
    const r = reassignDriver(assignmentId, newId);
    if (r.ok) _syncAssignmentToScheduleData(assignmentId);
    return r;
  },

  // 車両差し替え
  changeVehicle(assignmentId, newVehicleIdOrPlate) {
    let newId = newVehicleIdOrPlate;
    if (!getVehicleById(newId)) {
      const v = vehicles.find(x => x.plate === newVehicleIdOrPlate);
      if (v) newId = v.id;
    }
    const r = reassignVehicle(assignmentId, newId);
    if (r.ok) _syncAssignmentToScheduleData(assignmentId);
    return r;
  },

  // ドライバー×車両のペアごと差し替え（案件単位の組み合わせ変更）
  reassignPair(assignmentId, newDriverIdOrName, newVehicleIdOrPlate) {
    const r1 = this.changeDriver(assignmentId, newDriverIdOrName);
    if (!r1.ok) return r1;
    const r2 = this.changeVehicle(assignmentId, newVehicleIdOrPlate);
    return { ok: r2.ok, driverResult: r1, vehicleResult: r2 };
  },

  // 衝突チェック（変更前のドライランに使う）
  validate(assignmentId) {
    const a = getAssignmentById(assignmentId);
    return a ? validateAssignment(a) : { ok: false, reason: 'not found' };
  },

  // 全アサインメントの衝突を一括検査
  validateAll() {
    return assignments.map(a => ({
      id: a.id, driverId: a.driverId, vehicleId: a.vehicleId,
      validation: validateAssignment(a)
    })).filter(r => !r.validation.ok);
  }
};

// 既存D&D層との橋渡しイベント
// 既存D&Dコードが `dndAssignments` を書き換えたタイミングで
// 新 assignments[] にも反映するハブ。
//
// 想定アクション：
//  {type:'add',    driverId, dateKey, block}            … 新規配車（未割当→ドライバー）
//  {type:'remove', driverId, dateKey, block}            … 割当解除
//  {type:'move',   fromDriverId, toDriverId, dateKey,
//                   block, fromBlockBefore}             … ドライバー間移動（=ドライバー差し替え）
//
// blockは旧構造の{caseId, client, from, to, goods, deadline, start, end, color, label, ...}
//
// 旧driverId は 'V'+vehicleNum 形式。新driverIdへの変換は _legacyDriverIdToNew が担当。
window.__notifyDndChange = function(action) {
  if (!action || !action.type) return;

  // 旧driverId → 新driverId 変換
  const toNewDriverId = (legacyId) => _legacyDriverIdToNew(legacyId) || null;
  // 旧driverId(='V'+num) は同じ番号の vehicleId と一致（初期データの場合）
  const toVehicleId = (legacyId) => legacyId;

  // assignmentを探すヘルパー：caseId と driverId と時間で一意特定
  function findAssignment(driverId, block) {
    if (!block) return null;
    return assignments.find(a =>
      a.driverId === driverId &&
      a.start === block.start &&
      a.end === block.end &&
      a.client === block.client
    );
  }

  if (action.type === 'add') {
    const newDid = toNewDriverId(action.driverId);
    if (!newDid) return;
    // 既に同じものが新assignmentsにあるならスキップ（多重同期防止）
    if (findAssignment(newDid, action.block)) return;
    const b = action.block;
    const vehicleId = toVehicleId(action.driverId);
    // Phase 1a/1b：拠点関連プロパティを付与（effectiveBaseId・crossBase・ownerId）
    const masterV = (typeof getVehicleById === 'function') ? getVehicleById(vehicleId) : null;
    const masterD = (typeof getDriverById === 'function') ? getDriverById(newDid) : null;
    const effectiveBaseId = masterV ? masterV.baseId : null;
    let crossBase = false;
    if (masterD && !masterD.partner && masterD.baseId && effectiveBaseId
        && masterD.baseId !== effectiveBaseId) {
      crossBase = true;
    }
    const ownerId = masterD ? masterD.defaultOwnerId : null;
    assignments.push({
      id: _newAssignmentId(),
      tab: 'planning',
      date: action.dateKey || '2026-05-27',
      driverId: newDid,
      vehicleId: vehicleId, // 既定はドライバー固定車両（後で変更可）
      start: b.start, end: b.end,
      status: '運行中',
      client: b.client, from: b.from, to: b.to,
      goods: b.goods, deadline: b.deadline,
      label: b.label, color: b.color,
      _caseId: b.caseId || null,
      // Phase 1a プロパティ
      effectiveBaseId,
      ownerId,
      mainOwnerId: ownerId,
      crossBase,
      caseIds: b.caseId ? [b.caseId] : [],
      isReturn: false,
      relatedReturnId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    rebuildAssignmentIndex();
  }

  else if (action.type === 'remove') {
    const newDid = toNewDriverId(action.driverId);
    if (!newDid) return;
    const target = findAssignment(newDid, action.block);
    if (target) {
      const i = assignments.indexOf(target);
      if (i >= 0) assignments.splice(i, 1);
      rebuildAssignmentIndex();
    }
  }

  else if (action.type === 'move') {
    // ドライバー間移動 = ドライバー差し替え（同じassignmentのdriverIdを更新）
    const fromNewDid = toNewDriverId(action.fromDriverId);
    const toNewDid = toNewDriverId(action.toDriverId);
    if (!fromNewDid || !toNewDid) return;
    // 移動前の旧block情報で検索（時間はドロップ位置で変わるので action.fromBlockBefore を見る）
    const ref = action.fromBlockBefore || action.block;
    const target = findAssignment(fromNewDid, ref);
    if (target) {
      target.driverId = toNewDid;
      // ドロップ位置で時間が変わった場合は反映
      if (action.block) {
        target.start = action.block.start;
        target.end = action.block.end;
      }
      // 既定では車両もそのドライバー固定車両に差し替え（=「車両ごと移る」既定挙動）
      // 必要なら別途 assignmentAPI.changeVehicle で個別に変更可能
      const vid = toVehicleId(action.toDriverId);
      if (vid) target.vehicleId = vid;
      rebuildAssignmentIndex();
    } else {
      // 元assignmentが見つからない＝外部から追加されたケース。新規としてaddする
      window.__notifyDndChange({
        type: 'add',
        driverId: action.toDriverId,
        dateKey: action.dateKey,
        block: action.block
      });
    }
  }

  // 同期完了後、衝突インジケータを更新
  if (typeof window.__refreshConflictBadges === 'function') {
    window.__refreshConflictBadges();
  }
};

// ═══════════════════════════════════════════════════════════════
//  ステップ5：案件レコード側のID解決ヘルパー
//  既存コードでは c.vehicles[i] = {id:'車両0771', driver:'高橋 七郎', ...}
//  のように「文字列」で持っているため、各エントリにID参照を追加して
//  正規化マスタとリンクできるようにする。
//  既存プロパティ（id/driverなど）は維持して後方互換を保つ。
// ═══════════════════════════════════════════════════════════════

// 案件vehiclesエントリ1件を正規化（既存プロパティを保ったままID参照を付与）
function normalizeCaseVehicleEntry(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  // 既に正規化済みならスキップ
  if (entry._normalized) return entry;

  // id文字列(例:'車両0771')から vehicleId を逆引き
  if (typeof entry.id === 'string' && entry.id !== '未割当') {
    const num = entry.id.replace(/[^\d]/g, '');
    if (num) {
      const v = vehicles.find(x => x.plate === '車両' + num) || getVehicleById('V' + num);
      if (v) {
        entry.vehicleId = v.id;
      } else {
        // マスタにない車両番号 → 未解決として記録
        entry._vehicleUnmapped = true;
        entry._originalVehicleId = entry.id; // 元の値を保持
      }
    }
  } else if (entry.id === '未割当') {
    entry._isUnassigned = true;
  }
  // driver名から driverId を逆引き
  if (typeof entry.driver === 'string' && entry.driver !== '未割当') {
    const d = drivers.find(x => x.name === entry.driver);
    if (d) {
      entry.driverId = d.id;
    } else {
      // マスタにないドライバー名 → 未解決として記録
      entry._driverUnmapped = true;
      entry._originalDriverName = entry.driver;
    }
  } else if (entry.driver === '未割当') {
    entry._isUnassigned = true;
  }

  // 補完ロジック：ドライバーが解決できて車両が未解決なら、ドライバー固定車両を候補に
  if (entry.driverId && !entry.vehicleId && !entry._isUnassigned) {
    const idx = drivers.findIndex(d => d.id === entry.driverId);
    if (idx >= 0 && vehicles[idx]) {
      entry._suggestedVehicleId = vehicles[idx].id;
      entry._suggestedVehiclePlate = vehicles[idx].plate;
    }
  }

  entry._normalized = true;
  return entry;
}

// 案件単位で正規化
function normalizeCaseVehicles(caseObj) {
  if (!caseObj || !Array.isArray(caseObj.vehicles)) return caseObj;
  caseObj.vehicles.forEach(normalizeCaseVehicleEntry);
  return caseObj;
}

// 【ステップ11】全サンプル案件データを起動時に一括正規化
// unprocessedCases / processingCases / processedCases の vehicles[] に
// driverId/vehicleId を自動付与する。マスタにない参照は _unmapped 印を残す。
function normalizeAllCaseSamples() {
  const allCases = [];
  if (typeof unprocessedCases !== 'undefined') allCases.push(...unprocessedCases);
  if (typeof processingCases !== 'undefined') allCases.push(...processingCases);
  if (typeof processedCases !== 'undefined') allCases.push(...processedCases);

  let totalEntries = 0, resolved = 0, unmappedV = 0, unmappedD = 0, unassigned = 0;
  allCases.forEach(c => {
    if (!c || !Array.isArray(c.vehicles)) return;
    c.vehicles.forEach(entry => {
      totalEntries++;
      normalizeCaseVehicleEntry(entry);
      if (entry.vehicleId && entry.driverId) resolved++;
      if (entry._vehicleUnmapped) unmappedV++;
      if (entry._driverUnmapped) unmappedD++;
      if (entry._isUnassigned) unassigned++;
    });

    // 案件トップレベルの driver / vehicle 文字列もID解決
    if (typeof c.driver === 'string' && c.driver !== '未割当' && !c.driverId) {
      const d = drivers.find(x => x.name === c.driver);
      if (d) c.driverId = d.id;
    }
    if (typeof c.vehicle === 'string' && c.vehicle !== '未割当' && !c.vehicleId) {
      const num = c.vehicle.replace(/[^\d]/g, '');
      if (num) {
        const v = vehicles.find(x => x.plate === '車両' + num) || getVehicleById('V' + num);
        if (v) c.vehicleId = v.id;
      }
    }
  });

  return { totalCases: allCases.length, totalEntries, resolved, unmappedV, unmappedD, unassigned };
}

// 公開：手動で再正規化したい場合のデバッグ用
window.__normalizeAllCaseSamples = normalizeAllCaseSamples;

// 起動時に自動実行（unprocessedCasesなどが既に定義されていればすぐ実行、
// まだなら DOMContentLoaded で実行）
function _bootNormalizeCases() {
  try {
    const stats = normalizeAllCaseSamples();
    // 開発者向けのコンソール出力（本番では消してもOK）
    if (typeof console !== 'undefined' && console.log) {
      console.log('[case normalization]', stats);
    }
  } catch(e) {
    console.warn('[case normalization] failed:', e);
  }
}

if (typeof unprocessedCases !== 'undefined' && typeof processingCases !== 'undefined') {
  // すでに定義済みなら即実行
  _bootNormalizeCases();
} else if (typeof document !== 'undefined') {
  // 未定義なら描画前に実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _bootNormalizeCases);
  } else {
    setTimeout(_bootNormalizeCases, 0);
  }
}

// 案件側からドライバー/車両マスタを取得するゲッター（新コードはこちらを使う）
function getDriverForCaseVehicle(caseObj, idx) {
  const entry = caseObj && caseObj.vehicles && caseObj.vehicles[idx];
  if (!entry) return null;
  normalizeCaseVehicleEntry(entry);
  return entry.driverId ? getDriverById(entry.driverId) : null;
}
function getVehicleForCaseVehicle(caseObj, idx) {
  const entry = caseObj && caseObj.vehicles && caseObj.vehicles[idx];
  if (!entry) return null;
  normalizeCaseVehicleEntry(entry);
  return entry.vehicleId ? getVehicleById(entry.vehicleId) : null;
}

// 案件の特定エントリにドライバー/車両を再アサイン
// （UI からのドライバー単独 / 車両単独 / 両方 の差し替えに使う）
window.caseAssignAPI = {
  // 案件のidx番目のvehicleエントリでドライバーだけ差し替え
  changeDriver(caseObj, idx, newDriverIdOrName) {
    const entry = caseObj && caseObj.vehicles && caseObj.vehicles[idx];
    if (!entry) return { ok: false, reason: 'entry not found' };
    normalizeCaseVehicleEntry(entry);
    let newId = newDriverIdOrName;
    let d = getDriverById(newId);
    if (!d) d = drivers.find(x => x.name === newDriverIdOrName);
    if (!d) return { ok: false, reason: 'driver not found' };
    const before = { driverId: entry.driverId, driver: entry.driver };
    entry.driverId = d.id;
    entry.driver = d.name; // 後方互換のため文字列も維持
    return { ok: true, before, after: { driverId: d.id, driver: d.name } };
  },
  // 同 車両だけ差し替え
  changeVehicle(caseObj, idx, newVehicleIdOrPlate) {
    const entry = caseObj && caseObj.vehicles && caseObj.vehicles[idx];
    if (!entry) return { ok: false, reason: 'entry not found' };
    normalizeCaseVehicleEntry(entry);
    let newId = newVehicleIdOrPlate;
    let v = getVehicleById(newId);
    if (!v) v = vehicles.find(x => x.plate === newVehicleIdOrPlate);
    if (!v) return { ok: false, reason: 'vehicle not found' };
    // 積載量チェック
    if (entry.cap) {
      const m = String(entry.cap).match(/([\d,]+)/);
      if (m) {
        const need = parseInt(m[1].replace(/,/g, ''), 10);
        if (need > v.maxLoad) {
          return { ok: false, reason: 'capacity insufficient', needed: need, max: v.maxLoad };
        }
      }
    }
    const before = { vehicleId: entry.vehicleId, id: entry.id };
    entry.vehicleId = v.id;
    entry.id = v.plate; // 後方互換のため旧形式の文字列も維持
    entry.cap = (v.ton * 1000).toLocaleString() + 'kg';
    return { ok: true, before, after: { vehicleId: v.id, plate: v.plate } };
  },
  // ペア差し替え
  reassignPair(caseObj, idx, newDriver, newVehicle) {
    const r1 = this.changeDriver(caseObj, idx, newDriver);
    if (!r1.ok) return r1;
    const r2 = this.changeVehicle(caseObj, idx, newVehicle);
    if (!r2.ok) {
      // ドライバーは反映済みだがロールバックせず、UIに警告を返すだけにする
      return { ok: false, driverResult: r1, vehicleResult: r2 };
    }
    return { ok: true, driverResult: r1, vehicleResult: r2 };
  }
};


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  運行スケジュール（本日・50台一画面ビュー）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function renderSchedule() {
  const wrap = document.getElementById('schedule-wrap-inner');
  if (!wrap) return;
  // （配車割当ページを開く前にスケジュールを直接開いた場合の対策）
  try {
    if (typeof window.__ensureAssignFilterBar === 'function') {
      window.__ensureAssignFilterBar();
      if (typeof window.__refreshAssignFilterBar === 'function') window.__refreshAssignFilterBar();
    }
  } catch(e) { /* 初期化前なら無視 */ }

  // 【新】__useAssignmentView=true で assignments[] からのビュー再構築モードに切替
  // 既定は false（既存挙動）。ブラウザのコンソールで window.__useAssignmentView=true; renderSchedule();
  // を実行すると新構造の動作確認ができる。
  let data = (window.__useAssignmentView === true)
    ? buildScheduleViewFromAssignments(currentDispatchTab)
    : (scheduleData[currentDispatchTab] || []);

  const now = new Date();
  const nowPct = ((now.getHours() + now.getMinutes()/60) / 24) * 100;
  const nowStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  const dateStr = now.toLocaleDateString('ja-JP', {month:'long', day:'numeric', weekday:'short'});

  // 担当フィルタ取得（未初期化なら 'all'）
  const filter = (typeof window.__getAssignFilter === 'function') ? window.__getAssignFilter() : 'all';
  const myId = (typeof window.__getCurrentUserId === 'function') ? window.__getCurrentUserId() : 'me';
  // Phase 1b：軸モード取得
  const fAxis = (typeof window.__getFilterAxis === 'function') ? window.__getFilterAxis() : 'owner';
  const fVal  = (typeof window.__getFilterValue === 'function') ? window.__getFilterValue() : filter;

  function rowOwnerId(row) {
    if (typeof window.__getDriverOwner !== 'function') return null;
    return window.__getDriverOwner(row.id);
  }
  // 旧row.id（V+車両番号形式）から新drivers.idへ
  function rowMasterDriver(row) {
    if (typeof window._legacyDriverIdToNew !== 'function') {
      // 念のためのフォールバック：window公開がない場合はnull
      return null;
    }
    const newId = window._legacyDriverIdToNew(row.id);
    return (newId && typeof window.getDriverById === 'function') ? window.getDriverById(newId) : null;
  }
  function rowMatchFilter(row) {
    // Phase 1b：軸モードに応じた判定（論点5：排他）
    if (fAxis === 'all') return true;
    if (fAxis === 'owner') {
      if (fVal === 'all') return true;
      const owner = rowOwnerId(row);
      if (fVal === 'mine')       return owner === myId;
      if (fVal === 'unassigned') return !owner;
      return owner === fVal;
    }
    if (fAxis === 'base') {
      if (fVal === 'all') return true;
      const md = rowMasterDriver(row);
      if (!md) return false;
      if (fVal === '__partner') return !!md.partner;
      if (fVal === '__unset')   return !md.partner && !md.baseId;
      if (fVal === '__cross') {
        // クロス配車：当日のAssignmentを引いて判定
        const todayKey = new Date().toISOString().slice(0, 10);
        if (typeof window.getAssignmentByDriverAndDate !== 'function') return false;
        const a = window.getAssignmentByDriverAndDate(md.id, todayKey);
        return !!(a && a.crossBase);
      }
      return md.baseId === fVal;
    }
    return true;
  }

  // ステータス別カウントは「フィルタ後」のデータを使う
  const visibleData = data.filter(rowMatchFilter);
  const cnt = { running:0, waiting:0, alert:0, off:0, done:0 };
  visibleData.forEach(r => {
    if (r.status === '運行中')   cnt.running++;
    else if (r.status === '待機中') cnt.waiting++;
    else if (r.status === 'アラート') cnt.alert++;
    else if (r.status === '休車')   cnt.off++;
    else if (r.status === '完了')   cnt.done++;
  });

  // 時刻軸：4時間刻みで主要ラベル
  const ticks = [0, 4, 8, 12, 16, 20, 24];
  const tickHtml = ticks.map(h =>
    `<div class="sched-time-tick" style="left:${(h/24)*100}%">${h === 0 || h === 24 ? '' : String(h).padStart(2,'0') + ':00'}</div>`
  ).join('');

  // サマリーバー
  const isConf = currentDispatchTab === 'confirmed';
  const summary = `
    <div class="sched-summary">
      <div class="sched-sum-date">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        ${dateStr}　${isConf ? '実績' : '運行計画'}
      </div>
      <div class="sched-sum-divider"></div>
      <div class="sched-sum-stat">
        <span>表示</span>
        <span class="sched-sum-stat-num">${visibleData.length}</span>
        <span style="color:var(--text-muted)">/ ${data.length}台</span>
      </div>
      ${isConf
        ? `<div class="sched-sum-stat done"><span>完了</span><span class="sched-sum-stat-num">${cnt.done}</span></div>`
        : `<div class="sched-sum-stat running"><span>運行中</span><span class="sched-sum-stat-num">${cnt.running}</span></div>
           <div class="sched-sum-stat waiting"><span>待機</span><span class="sched-sum-stat-num">${cnt.waiting}</span></div>
           <div class="sched-sum-stat alert"><span>要対応</span><span class="sched-sum-stat-num">${cnt.alert}</span></div>
           <div class="sched-sum-stat"><span style="color:#94a3b8">休車</span><span class="sched-sum-stat-num" style="color:#94a3b8">${cnt.off}</span></div>`
      }
      <div class="sched-sum-spacer"></div>
      <div class="sched-sum-legend">
        ${isConf
          ? `<div class="sched-sum-legend-item"><span class="sched-sum-legend-swatch" style="background:#3BB888"></span>完了</div>`
          : `<div class="sched-sum-legend-item"><span class="sched-sum-legend-swatch" style="background:#64748b"></span>準備</div>
             <div class="sched-sum-legend-item"><span class="sched-sum-legend-swatch" style="background:#1a7a5e"></span>運行</div>
             <div class="sched-sum-legend-item"><span class="sched-sum-legend-swatch" style="background:#dc2626"></span>要対応</div>`
        }
        <div class="sched-sum-now">現在 ${nowStr}</div>
      </div>
    </div>`;

  // ドライバー行（フィルタ後）
  const rowsHtml = visibleData.map(row => {
    let dotClass = 'waiting';
    if (row.status === '運行中')   dotClass = 'running';
    else if (row.status === 'アラート') dotClass = 'alert';
    else if (row.status === '休車')   dotClass = 'off';
    else if (row.status === '完了')   dotClass = 'done';

    // 担当者バッジ
    const ownerId = rowOwnerId(row);
    const owner = (ownerId && typeof window.__getTeamMember === 'function') ? window.__getTeamMember(ownerId) : null;
    const isMine = ownerId === myId;
    const ownerBadge = owner
      ? `<span class="sched-owner-badge ${isMine?'mine':''}" title="担当：${owner.name}" style="background:${owner.color}1a;color:${owner.color};border-color:${owner.color}44">
           <span class="sched-owner-dot" style="background:${owner.color}"></span>${owner.initial}
         </span>`
      : `<span class="sched-owner-badge unassigned" title="担当未設定">—</span>`;

    // ロック表示（他ユーザーが編集中）
    const isLocked = (typeof window.__isLockedByOther === 'function') ? window.__isLockedByOther(row.id) : false;
    const lockInfo = isLocked && typeof window.__getDriverLock === 'function' ? window.__getDriverLock(row.id) : null;
    const lockUser = (lockInfo && typeof window.__getTeamMember === 'function') ? window.__getTeamMember(lockInfo.userId) : null;
    const lockMark = isLocked
      ? `<span class="sched-lock-mark" title="${lockUser ? lockUser.name : '他ユーザー'}が編集中">🔒</span>`
      : '';

    const blocksHtml = (row.blocks || []).map((b, bi) => {
      const left = timeToPercent(b.start);
      const width = durationToPercent(b.start, b.end);
      const tiny = width < 2.5;
      // data属性でツールチップに必要な情報を持たせる（HTMLエスケープ：シンプルな置換）
      function esc(s) {
        return String(s == null ? '' : s)
          .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
      }
      // 緊急度：色が赤＝アラート、'⚠' を含む納期＝アラート
      const isAlert = b.color === '#dc2626' || (b.deadline && b.deadline.indexOf('⚠') >= 0);

      // assignmentIdの解決：
      //  - 派生ビューモード時はblockに_assignmentIdが入っている
      //  - 旧モード時は行driverId(=旧形式) → 新driverId に変換して、start/end/clientで突合
      return `<div class="sched-block ${tiny?'tiny':''}"
        style="left:${left}%;width:${width}%;background:${b.color}"
        data-sched-tip="1"
        data-tip-client="${esc(b.client)}"
        data-tip-driver="${esc(row.driver)}"
        data-tip-vehicle="${esc(row.vehicle)}"
        data-tip-status="${esc(row.status)}"
        data-tip-start="${esc(b.start)}"
        data-tip-end="${esc(b.end)}"
        data-tip-from="${esc(b.from)}"
        data-tip-to="${esc(b.to)}"
        data-tip-goods="${esc(b.goods)}"
        data-tip-deadline="${esc(b.deadline)}"
        data-tip-color="${esc(b.color)}"
        data-tip-label="${esc(b.label)}"
        data-tip-alert="${isAlert ? '1' : ''}">
        <span class="sched-block-label">${b.label}</span>
      </div>`;
    }).join('');

    const emptyHint = (row.blocks || []).length === 0
      ? `<div style="position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:9px;color:#cbd5e1">${row.status === '休車' ? '休車' : '予定なし'}</div>`
      : '';

    // Phase 1b：拠点バッジ・クロス配車インジケータ（運行スケジュール側）
    let baseBadgeHtml = '';
    let crossIndHtml = '';
    let rowCrossClass = '';
    try {
      const md = rowMasterDriver(row);
      const mv = md && md.id && typeof window.getVehicleById === 'function'
        ? null  // 後で取得
        : null;
      // 当日の Assignment を引く
      const todayKey = new Date().toISOString().slice(0, 10);
      let effBaseId = null;
      let isCross = false;
      let masterVehicle = null;
      if (md && typeof window.getAssignmentByDriverAndDate === 'function') {
        const a = window.getAssignmentByDriverAndDate(md.id, todayKey);
        if (a) {
          effBaseId = a.effectiveBaseId;
          isCross = !!a.crossBase;
          if (a.vehicleId && typeof window.getVehicleById === 'function') {
            masterVehicle = window.getVehicleById(a.vehicleId);
          }
        }
      }
      if (!effBaseId && md) effBaseId = md.baseId;

      if (md && md.partner) {
        baseBadgeHtml = `<span class="sched-base-badge sched-base-partner" title="協力会社：${md.partnerName || ''}">協力会社</span>`;
      } else if (effBaseId && typeof window.getBaseById === 'function') {
        const base = window.getBaseById(effBaseId);
        const color = (typeof window.__baseColorForChip === 'function')
          ? window.__baseColorForChip(effBaseId) : '#475569';
        baseBadgeHtml = `<span class="sched-base-badge" style="color:${color};background:${color}1a" title="${base ? base.name : effBaseId}">${base ? base.name.replace(/拠点$/, '') : effBaseId}</span>`;
      } else if (md && !md.baseId) {
        baseBadgeHtml = `<span class="sched-base-badge sched-base-unset" title="拠点未設定">未設定</span>`;
      }
      if (isCross && md && masterVehicle) {
        const dBaseName = md.baseId && typeof window.getBaseById === 'function'
          ? (window.getBaseById(md.baseId) || {}).name : '拠点未設定';
        const vBaseName = masterVehicle.baseId && typeof window.getBaseById === 'function'
          ? (window.getBaseById(masterVehicle.baseId) || {}).name : '拠点未設定';
        const effBaseName = effBaseId && typeof window.getBaseById === 'function'
          ? (window.getBaseById(effBaseId) || {}).name : '?';
        const t = `クロス配車：${dBaseName}のドライバー × ${vBaseName}の車両（当日運用：${effBaseName}）`;
        crossIndHtml = `<span class="sched-cross-indicator" title="${t.replace(/"/g, '&quot;')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg></span>`;
        rowCrossClass = ' sched-row-cross-base';
      }
    } catch (e) { /* 安全側：何も追加しない */ }

    return `<div class="sched-row${rowCrossClass}" data-driver-id="${row.id}">
      <div class="sched-driver">
        <span class="sched-driver-status-dot ${dotClass}" title="${row.status}"></span>
        <span class="sched-driver-name">${row.driver}</span>
        ${ownerBadge}
        ${baseBadgeHtml}
        ${crossIndHtml}
        ${lockMark}
        <span class="sched-driver-vehicle"
              draggable="true"
              data-vehicle-swap-source="1"
              title="ドラッグして他のドライバーの車両と入れ替え">${row.vehicle.replace('車両','')}</span>
      </div>
      <div class="sched-bar-wrap">
        ${emptyHint}
        ${blocksHtml}
      </div>
    </div>`;
  }).join('');

  // フィルタで表示件数が0だった時のエンプティ状態
  const emptyState = visibleData.length === 0
    ? `<div style="padding:32px 24px;text-align:center;color:var(--text-muted);font-size:12px">
         <div style="font-size:24px;margin-bottom:8px">🔍</div>
         <div style="font-weight:700;margin-bottom:4px;color:var(--text-secondary)">該当するドライバーがいません</div>
         <div>「担当絞り込み」を変更してください（上部バー）</div>
       </div>`
    : '';

  // 現在時刻ライン（計画中タブのみ、かつ表示行がある時のみ）
  // 165pxはドライバーカラム幅、その右側の(100% - 165px)領域に対する nowPct% の位置
  const nowLineHtml = (!isConf && visibleData.length > 0)
    ? `<div style="position:absolute;top:20px;bottom:0;left:calc(165px + (100% - 165px) * ${nowPct/100});width:2px;background:#dc2626;z-index:6;pointer-events:none">
         <div style="position:absolute;top:-4px;left:-3px;width:8px;height:8px;background:#dc2626;border-radius:50%;box-shadow:0 0 0 2px rgba(220,38,38,.2)"></div>
         <div style="position:absolute;top:-16px;left:50%;transform:translateX(-50%);font-size:9px;font-weight:700;color:#dc2626;font-family:'Inter',sans-serif;white-space:nowrap;background:#fff;padding:1px 4px;border-radius:3px;border:1px solid #fecaca">${nowStr}</div>
       </div>`
    : '';

  wrap.innerHTML = `
    ${summary}
    <div class="sched-board">
      <div class="sched-time-header">
        <div class="sched-time-header-label">ドライバー / 車両（${visibleData.length}台）</div>
        <div class="sched-time-axis">${tickHtml}</div>
      </div>
      <div class="sched-rows" id="sched-rows-scroll">
        ${rowsHtml}
        ${emptyState}
      </div>
      ${nowLineHtml}
    </div>`;

  // 担当バッジクリックで担当者ピッカーを開く
  if (!isConf && typeof window.__openOwnerPicker === 'function') {
    wrap.querySelectorAll('.sched-owner-badge').forEach((badge) => {
      const rowEl = badge.closest('.sched-row');
      if (!rowEl) return;
      const driverId = rowEl.getAttribute('data-driver-id');
      if (!driverId) return;
      badge.style.cursor = 'pointer';
      badge.title = badge.title + '（クリックで変更）';
      badge.addEventListener('click', function(e) {
        e.stopPropagation();
        window.__openOwnerPicker(driverId, badge);
      });
    });
  }

  // 案件ブロックのホバーツールチップを設定
  _setupSchedHoverTip(wrap);

  // 衝突インジケータを描画後にリフレッシュ（バッジ＋ブロック赤縁）
  try {
    if (typeof window.__refreshConflictBadges === 'function') {
      window.__refreshConflictBadges();
    }
  } catch(e) { /* ignore */ }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  運行スケジュール：案件カード簡易ホバー詳細
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function _ensureSchedHoverTipEl() {
  let el = document.getElementById('sched-hover-tip');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'sched-hover-tip';
  document.body.appendChild(el);
  return el;
}

function _setupSchedHoverTip(wrap) {
  if (!wrap) return;
  const tipEl = _ensureSchedHoverTipEl();
  let hideTimer = null;

  function hideTip() {
    tipEl.classList.remove('visible');
    // フェードアウト後に display:none
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      tipEl.classList.remove('show', 'arrow-down', 'arrow-up');
    }, 130);
  }

  function showTipForBlock(block) {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

    // データ取得
    const d = block.dataset;
    const color = d.tipColor || '#1a7a5e';
    const urgency = d.tipAlert === '1'
      ? '<span class="sched-tip-badge urgent">要対応</span>'
      : '';

    // ステータスバッジ
    let statusBadge = '';
    if (d.tipStatus === '運行中')   statusBadge = '<span class="sched-tip-badge normal" style="background:rgba(34,197,94,.2);color:#86efac">運行中</span>';
    else if (d.tipStatus === '待機中') statusBadge = '<span class="sched-tip-badge normal" style="background:rgba(148,163,184,.2);color:#cbd5e1">待機中</span>';
    else if (d.tipStatus === '完了')   statusBadge = '<span class="sched-tip-badge normal" style="background:rgba(59,184,136,.2);color:#86efac">完了</span>';

    tipEl.innerHTML = `
      <div class="sched-tip-header">
        <span class="sched-tip-swatch" style="background:${color}"></span>
        <span class="sched-tip-client">${d.tipClient || '—'}</span>
        ${urgency}
      </div>
      <div class="sched-tip-driver">
        <span class="sched-tip-driver-name">${d.tipDriver || ''}</span>
        <span>（${d.tipVehicle || ''}）</span>
        ${statusBadge}
      </div>
      <div class="sched-tip-row">
        <span class="sched-tip-icon">🕐</span>
        <span class="sched-tip-value"><strong>${d.tipStart || '—'}</strong> → <strong>${d.tipEnd || '—'}</strong></span>
      </div>
      <div class="sched-tip-row">
        <span class="sched-tip-icon">📍</span>
        <span class="sched-tip-route">
          <span>${d.tipFrom || '—'}</span>
          <span class="sched-tip-route-arrow">→</span>
          <span>${d.tipTo || '—'}</span>
        </span>
      </div>
      <div class="sched-tip-row">
        <span class="sched-tip-icon">📦</span>
        <span class="sched-tip-value">${d.tipGoods || '—'}</span>
      </div>
      <div class="sched-tip-row">
        <span class="sched-tip-icon">⏰</span>
        <span class="sched-tip-value">納期：${d.tipDeadline || '—'}</span>
      </div>
    `;

    // 位置計算：基本はブロックの真上、画面上端ならブロックの下に
    const rect = block.getBoundingClientRect();
    const tipW = 260;
    const tipH = 160; // おおよその高さ（中身による）

    // 一旦表示してから実サイズを取得
    tipEl.classList.add('show');
    tipEl.style.left = '0px';
    tipEl.style.top = '0px';

    // 実サイズを取得
    const actualH = tipEl.offsetHeight;

    // x座標：ブロック中心
    let x = rect.left + rect.width / 2 - tipW / 2;
    // 画面端の補正
    const minX = 8;
    const maxX = window.innerWidth - tipW - 8;
    if (x < minX) x = minX;
    if (x > maxX) x = maxX;

    // y座標：基本はブロックの上に表示（矢印は下向き）
    let y = rect.top - actualH - 10;
    let arrowDir = 'arrow-down'; // ツールチップの下に矢印（=上に表示）

    if (y < 8) {
      // 画面上端で見切れる → 下に表示
      y = rect.bottom + 10;
      arrowDir = 'arrow-up'; // ツールチップの上に矢印（=下に表示）
    }

    // 矢印のX位置：ブロック中心
    const blockCenterX = rect.left + rect.width / 2;
    const tipLeftX = x;
    const arrowX = blockCenterX - tipLeftX;
    // 矢印が tip 内に収まるよう制限
    const clampedArrowX = Math.max(14, Math.min(tipW - 14, arrowX));

    tipEl.style.left = x + 'px';
    tipEl.style.top  = y + 'px';
    tipEl.style.setProperty('--tip-arrow-x', clampedArrowX + 'px');
    tipEl.classList.remove('arrow-down', 'arrow-up');
    tipEl.classList.add(arrowDir);

    // フェードイン
    requestAnimationFrame(() => {
      tipEl.classList.add('visible');
    });
  }

  // イベント委譲：wrap全体でmouseover/mouseoutを捕捉
  wrap.addEventListener('mouseover', function(e) {
    const block = e.target.closest('[data-sched-tip="1"]');
    if (block && wrap.contains(block)) {
      showTipForBlock(block);
    }
  });
  wrap.addEventListener('mouseout', function(e) {
    const block = e.target.closest('[data-sched-tip="1"]');
    if (!block) return;
    // mouseoutが子要素から発火した場合に親に戻るパターンを除外
    const related = e.relatedTarget;
    if (related && block.contains(related)) return;
    hideTip();
  });
  // スクロール／リサイズ時にツールチップを消す（位置がずれるため）
  const scrollArea = wrap.querySelector('.sched-rows');
  if (scrollArea && !scrollArea._tipScrollHooked) {
    scrollArea.addEventListener('scroll', hideTip, { passive: true });
    scrollArea._tipScrollHooked = true;
  }
  if (!window._schedTipResizeHooked) {
    window.addEventListener('resize', hideTip);
    window._schedTipResizeHooked = true;
  }
}

// 担当フィルタ変更時のフック：スケジュールが現在表示されていれば再描画
window.applyScheduleFilter = function() {
  const el = document.getElementById('dispatch-schedule');
  if (el && el.style.display !== 'none') {
    renderSchedule();
  }
};

// ═══════════════════════════════════════════════════════════════
//  動態管理：巨大マップビュー
//  全運行中案件を1つの日本地図にプロット。ズーム・パン対応。
// ═══════════════════════════════════════════════════════════════

// 都道府県・主要市の代表座標（経度,緯度）。
// マップ投影は単純な「経度→x, 緯度→y(反転)」の等距円筒図法。
// SVG viewBox はおおむね日本本土を覆う範囲 ([128.0, 30.0] - [146.0, 46.0])
const _DOTAI_PLACES = {
  // 北海道
  '北海道':[141.35,43.06],'札幌市':[141.35,43.06],'函館':[140.73,41.77],'旭川':[142.36,43.77],
  // 東北
  '青森':[140.74,40.82],'青森県':[140.74,40.82],'岩手':[141.15,39.70],'岩手県':[141.15,39.70],
  '宮城':[140.87,38.26],'宮城県':[140.87,38.26],'仙台':[140.87,38.26],'仙台市':[140.87,38.26],
  '秋田':[140.10,39.72],'秋田県':[140.10,39.72],'山形':[140.36,38.24],'山形県':[140.36,38.24],
  '福島':[140.47,37.75],'福島県':[140.47,37.75],
  // 関東
  '茨城':[140.45,36.34],'茨城県':[140.45,36.34],'つくば':[140.12,36.08],'つくば市':[140.12,36.08],
  '栃木':[139.88,36.57],'栃木県':[139.88,36.57],'群馬':[139.06,36.39],'群馬県':[139.06,36.39],
  '埼玉':[139.65,35.86],'埼玉県':[139.65,35.86],'川口市':[139.72,35.81],'さいたま市':[139.65,35.86],
  '千葉':[140.12,35.61],'千葉県':[140.12,35.61],'船橋市':[139.98,35.69],'千葉市':[140.12,35.61],
  '東京':[139.69,35.69],'東京都':[139.69,35.69],
  '大田区':[139.72,35.56],'品川区':[139.74,35.61],'渋谷区':[139.70,35.66],
  '中央区':[139.77,35.67],'江東区':[139.82,35.67],
  '神奈川':[139.64,35.45],'神奈川県':[139.64,35.45],
  '横浜市':[139.64,35.44],'川崎市':[139.70,35.53],
  // 中部
  '新潟':[139.02,37.90],'新潟県':[139.02,37.90],'富山':[137.21,36.70],'富山県':[137.21,36.70],
  '石川':[136.63,36.59],'石川県':[136.63,36.59],'福井':[136.22,36.07],'福井県':[136.22,36.07],
  '山梨':[138.57,35.66],'山梨県':[138.57,35.66],'長野':[138.18,36.65],'長野県':[138.18,36.65],
  '岐阜':[136.72,35.39],'岐阜県':[136.72,35.39],'静岡':[138.38,34.98],'静岡県':[138.38,34.98],
  '静岡市':[138.38,34.98],'愛知':[136.91,35.18],'愛知県':[136.91,35.18],
  '名古屋':[136.91,35.18],'名古屋市':[136.91,35.18],
  // 近畿
  '三重':[136.51,34.73],'三重県':[136.51,34.73],'滋賀':[135.87,35.00],'滋賀県':[135.87,35.00],
  '京都':[135.76,35.02],'京都府':[135.76,35.02],
  '大阪':[135.52,34.69],'大阪府':[135.52,34.69],'大阪市':[135.50,34.69],
  '兵庫':[135.18,34.69],'兵庫県':[135.18,34.69],'神戸市':[135.18,34.69],
  '奈良':[135.83,34.69],'奈良県':[135.83,34.69],'和歌山':[135.17,34.23],'和歌山県':[135.17,34.23],
  // 中国
  '鳥取':[134.24,35.50],'鳥取県':[134.24,35.50],'島根':[133.05,35.47],'島根県':[133.05,35.47],
  '岡山':[133.93,34.66],'岡山県':[133.93,34.66],'広島':[132.46,34.40],'広島県':[132.46,34.40],
  '山口':[131.47,34.19],'山口県':[131.47,34.19],
  // 四国
  '徳島':[134.56,34.07],'徳島県':[134.56,34.07],'香川':[134.04,34.34],'香川県':[134.04,34.34],
  '愛媛':[132.77,33.84],'愛媛県':[132.77,33.84],'高知':[133.53,33.56],'高知県':[133.53,33.56],
  // 九州・沖縄
  '福岡':[130.42,33.61],'福岡県':[130.42,33.61],'福岡市':[130.42,33.59],
  '佐賀':[130.30,33.25],'佐賀県':[130.30,33.25],'長崎':[129.87,32.74],'長崎県':[129.87,32.74],
  '熊本':[130.74,32.79],'熊本県':[130.74,32.79],'大分':[131.61,33.24],'大分県':[131.61,33.24],
  '宮崎':[131.42,31.91],'宮崎県':[131.42,31.91],
  '鹿児島':[130.55,31.56],'鹿児島県':[130.55,31.56],
  '沖縄':[127.68,26.21],'沖縄県':[127.68,26.21]
};

// 住所文字列から代表座標を解決
function _dotaiResolveCoord(addr) {
  if (!addr) return null;
  // 完全一致を試す
  if (_DOTAI_PLACES[addr]) return _DOTAI_PLACES[addr];
  // 部分一致：登録キーが住所文字列に含まれるものから
  // 「市・区」を含むキーを最優先（より具体的）、次に最長一致
  let candidates = [];
  for (const k in _DOTAI_PLACES) {
    if (addr.indexOf(k) >= 0) {
      const isSpecific = /[市区]/.test(k);
      candidates.push({ k, len: k.length, specific: isSpecific });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    if (a.specific !== b.specific) return a.specific ? -1 : 1;
    return b.len - a.len;
  });
  return _DOTAI_PLACES[candidates[0].k];
}

// 経緯度 → SVG座標
// 表示域: lng [128, 146], lat [30, 46] → SVG [0, 1000] × [0, 800]
const _DOTAI_PROJ = { lng0:128, lng1:146, lat0:30, lat1:46, w:1000, h:800 };
function _dotaiProject(lng, lat) {
  const p = _DOTAI_PROJ;
  const x = (lng - p.lng0) / (p.lng1 - p.lng0) * p.w;
  const y = (p.lat1 - lat) / (p.lat1 - p.lat0) * p.h;
  return [x, y];
}

// 日本本土の簡易シルエット（極めて簡略化したパス）。
// 高精度の地図ではなくあくまで「地域感」が伝わる背景として機能する。
// SVGのpath d値（経緯度→投影済み座標）
function _dotaiBuildSilhouette() {
  // 本土を 12 ポイント程度で代表
  const ringsLngLat = [
    // 北海道（簡易）
    [[140.5,45.5],[145.5,44.0],[145.0,42.0],[141.0,41.5],[140.0,42.5],[139.5,44.0],[140.5,45.5]],
    // 本州（簡易ループ）
    [[140.7,41.0],[141.5,39.5],[141.5,38.0],[141.0,36.5],[140.5,35.7],[140.0,34.9],[139.0,34.6],
     [137.0,34.4],[135.0,33.8],[133.0,34.0],[131.0,34.3],[131.5,35.5],[133.0,35.8],[135.5,35.7],
     [137.5,37.5],[139.0,38.0],[139.5,40.0],[140.7,41.0]],
    // 四国
    [[134.5,34.1],[134.7,33.5],[133.0,33.3],[132.5,33.9],[133.5,34.3],[134.5,34.1]],
    // 九州
    [[131.7,33.6],[131.9,32.5],[131.0,31.4],[130.2,31.0],[129.5,32.0],[129.7,33.2],[130.5,33.9],[131.7,33.6]],
    // 沖縄（極小）
    [[127.5,26.1],[128.2,26.4],[128.4,26.0],[127.7,25.8],[127.5,26.1]]
  ];
  return ringsLngLat.map(ring => {
    return 'M' + ring.map(([lng,lat]) => _dotaiProject(lng,lat).map(n => n.toFixed(1)).join(',')).join(' L') + ' Z';
  }).join(' ');
}

// 状態オブジェクト
const _dotaiState = {
  zoom: 1,
  panX: 0, panY: 0,
  isPanning: false,
  panStartX: 0, panStartY: 0,
  panOrigX: 0, panOrigY: 0,
  focusedId: null
};

function _dotaiApplyTransform() {
  const g = document.getElementById('dotai-svg-g');
  if (!g) return;
  g.setAttribute('transform', `translate(${_dotaiState.panX} ${_dotaiState.panY}) scale(${_dotaiState.zoom})`);
}

function _dotaiZoom(factor, cx, cy) {
  const prevZoom = _dotaiState.zoom;
  const newZoom = Math.max(0.4, Math.min(8, prevZoom * factor));
  if (newZoom === prevZoom) return;
  // ズーム中心を保つ：(cx, cy) のSVG座標がズーム前後で同じ位置になるよう pan を調整
  if (cx == null || cy == null) {
    // 画面中央でズーム
    const svg = document.querySelector('.dotai-svg');
    if (svg) {
      const r = svg.getBoundingClientRect();
      cx = r.width / 2;
      cy = r.height / 2;
    } else { cx = 0; cy = 0; }
  }
  // 現在の pan を加味した中心点
  const wx = (cx - _dotaiState.panX) / prevZoom;
  const wy = (cy - _dotaiState.panY) / prevZoom;
  _dotaiState.zoom = newZoom;
  _dotaiState.panX = cx - wx * newZoom;
  _dotaiState.panY = cy - wy * newZoom;
  _dotaiApplyTransform();
  _dotaiUpdateScale();
}

function _dotaiResetView() {
  _dotaiState.zoom = 1;
  _dotaiState.panX = 0;
  _dotaiState.panY = 0;
  _dotaiApplyTransform();
  _dotaiUpdateScale();
}

function _dotaiUpdateScale() {
  // 縮尺表示：ズーム1.0 で約 「日本全域 ～約2000km」、拡大するほど短くなる
  const el = document.getElementById('dotai-scale-label');
  if (!el) return;
  const km = Math.round(2000 / _dotaiState.zoom);
  el.textContent = km >= 1000 ? `~${(km/1000).toFixed(1)}千km` : `~${km}km`;
}

function _dotaiFocusOnAssignment(id) {
  _dotaiState.focusedId = id;
  // パンしてピンを中央に
  const truck = document.querySelector(`[data-dotai-id="${id}"]`);
  document.querySelectorAll('.dotai-pin-truck').forEach(p => p.classList.remove('focused'));
  document.querySelectorAll('.dotai-side-item').forEach(li => {
    li.classList.toggle('focused', li.getAttribute('data-dotai-id') === id);
  });
  if (!truck) return;
  truck.classList.add('focused');
  // ターゲットのSVG座標を取得
  const cx = parseFloat(truck.getAttribute('data-cx'));
  const cy = parseFloat(truck.getAttribute('data-cy'));
  if (!isNaN(cx) && !isNaN(cy)) {
    const svg = document.querySelector('.dotai-svg');
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    // SVG viewBox は 0,0 - 1000,800。ピクセル/SVG ユニット比は r.width/1000
    const ratioX = r.width / _DOTAI_PROJ.w;
    const ratioY = r.height / _DOTAI_PROJ.h;
    // 拡大率も上げる
    const targetZoom = Math.max(_dotaiState.zoom, 2.2);
    const ratio = Math.min(ratioX, ratioY);
    _dotaiState.zoom = targetZoom;
    _dotaiState.panX = r.width / 2 - cx * ratio * targetZoom;
    _dotaiState.panY = r.height / 2 - cy * ratio * targetZoom;
    _dotaiApplyTransform();
    _dotaiUpdateScale();
  }
}

// 現在時刻（HH:MM）を分単位に変換するユーティリティ
function _dotaiHHMMtoMin(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

// 動態管理の「現在時刻」を取得する
// ・デモ用に固定値を上書きできる（window.__dotaiSimNow = 'HH:MM' で）
// ・確定済みタブを開いていたらすべて完了として扱うため null を返す
// ・それ以外は実時刻
function _dotaiGetNowMin() {
  if (currentDispatchTab === 'confirmed') return null; // 完了モード
  if (typeof window.__dotaiSimNow === 'string') {
    const m = _dotaiHHMMtoMin(window.__dotaiSimNow);
    if (m != null) return m;
  }
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function renderDotai() {
  const wrap = document.getElementById('dotai-wrap-inner');
  if (!wrap) return;
  const data = (window.__useAssignmentView === true)
    ? buildScheduleViewFromAssignments(currentDispatchTab)
    : scheduleData[currentDispatchTab];

  const isConfirmedTab = currentDispatchTab === 'confirmed';
  const nowMin = _dotaiGetNowMin(); // null なら全完了モード

  // 現在時刻と各 block を突き合わせて「今動いているトラック」だけを抽出
  // block.label === '準備' は出発前なのでスキップ。実運行ブロックのみ評価対象。
  const trips = data.map((row, ri) => {
    if (!row.blocks || row.blocks.length === 0) return null;
    // 実運行ブロック（準備を除く）
    const runBlocks = row.blocks.filter(b => b.label !== '準備' && b.from && b.to);
    if (runBlocks.length === 0) return null;

    let activeBlock = null;
    let pct = 0;
    let phase = 'idle'; // 'running' | 'between' | 'before' | 'after'

    if (isConfirmedTab) {
      // 確定済みタブ：すべて完了として扱う（最後のブロックを100%地点で表示）
      activeBlock = runBlocks[runBlocks.length - 1];
      pct = 100;
      phase = 'after';
    } else if (nowMin != null) {
      // 1) 今この時刻に走っているブロックを探す
      const runningIdx = runBlocks.findIndex(b => {
        const s = _dotaiHHMMtoMin(b.start);
        const e = _dotaiHHMMtoMin(b.end);
        return s != null && e != null && nowMin >= s && nowMin <= e;
      });
      if (runningIdx >= 0) {
        activeBlock = runBlocks[runningIdx];
        const s = _dotaiHHMMtoMin(activeBlock.start);
        const e = _dotaiHHMMtoMin(activeBlock.end);
        pct = Math.max(0, Math.min(100, ((nowMin - s) / (e - s)) * 100));
        phase = 'running';
      } else {
        // 2) これから走るブロックがあるか
        const nextBlock = runBlocks.find(b => {
          const s = _dotaiHHMMtoMin(b.start);
          return s != null && s > nowMin;
        });
        if (nextBlock) {
          // 直前のブロック → 待機（出発前 or 案件間休憩）
          const prevBlock = runBlocks.filter(b => {
            const e = _dotaiHHMMtoMin(b.end);
            return e != null && e <= nowMin;
          }).pop();
          if (prevBlock) {
            // 案件間：前の案件のゴール地点で待機
            activeBlock = prevBlock;
            pct = 100;
            phase = 'between';
          } else {
            // 出発前：これから走る案件の出発地で待機
            activeBlock = nextBlock;
            pct = 0;
            phase = 'before';
          }
        } else {
          // 今日の全運行が終了 → 最後のブロックのゴール地点
          activeBlock = runBlocks[runBlocks.length - 1];
          pct = 100;
          phase = 'after';
        }
      }
    }

    if (!activeBlock) return null;
    const sCoord = _dotaiResolveCoord(activeBlock.from);
    const gCoord = _dotaiResolveCoord(activeBlock.to);
    if (!sCoord || !gCoord) return null;

    // 直線距離（概算km）→ 残距離と速度を導出
    const distKm = _dotaiHaversineKm(sCoord[1], sCoord[0], gCoord[1], gCoord[0]);
    const remainKm = Math.round(distKm * (100 - pct) / 100);
    let speedNum = 0;
    if (phase === 'running') {
      const e = _dotaiHHMMtoMin(activeBlock.end);
      const remainMin = Math.max(1, e - nowMin);
      speedNum = Math.round(remainKm / (remainMin / 60));
      // 一般道〜高速まで現実的な範囲にクリップ
      if (speedNum < 20) speedNum = 30 + ((ri * 7) % 15);
      if (speedNum > 90) speedNum = 65 + ((ri * 5) % 15);
    }
    const speedDisp = phase === 'running' ? speedNum + ' km/h'
      : phase === 'between' ? '待機'
      : phase === 'before' ? '出発前'
      : '完了';
    const eta = activeBlock.end || '—';
    // ステータス判定
    let phaseLabel, phaseColor;
    if (phase === 'running') { phaseLabel = '運行中'; phaseColor = '#22c55e'; }
    else if (phase === 'between') { phaseLabel = '案件間'; phaseColor = '#f59e0b'; }
    else if (phase === 'before') { phaseLabel = '出発前'; phaseColor = '#3b82f6'; }
    else { phaseLabel = '完了'; phaseColor = '#3BB888'; }

    const [sx, sy] = _dotaiProject(sCoord[0], sCoord[1]);
    const [gx, gy] = _dotaiProject(gCoord[0], gCoord[1]);
    const tx = sx + (gx - sx) * pct / 100;
    const ty = sy + (gy - sy) * pct / 100;

    return {
      id: row.id || ('row' + ri),
      driver: row.driver, vehicle: row.vehicle,
      phase, phaseLabel, phaseColor,
      from: activeBlock.from, to: activeBlock.to,
      start: activeBlock.start, end: activeBlock.end,
      client: activeBlock.client,
      pct: Math.round(pct), speed: speedDisp, speedNum,
      remain: remainKm, distKm: Math.round(distKm), eta,
      statusColor: phaseColor,
      sx, sy, gx, gy, tx, ty,
      ri
    };
  }).filter(Boolean);

  // 運行中だけマップに出す。待機系もリストには出すが地図プロットは選択式。
  const runningTrips = trips.filter(t => t.phase === 'running' || t.phase === 'between');
  const onMapTrips = isConfirmedTab ? trips : runningTrips;

  // 「シミュレート時刻」UI用：現在時刻表示
  const nowDisplay = isConfirmedTab ? '完了モード'
    : (window.__dotaiSimNow ? '🕐 ' + window.__dotaiSimNow + ' (シミュ)'
       : '🕐 ' + new Date().toTimeString().substring(0, 5) + ' (現在)');

  // SVG出力
  const silhouettePath = _dotaiBuildSilhouette();
  const routesSvg = onMapTrips.map(t => {
    const stColor = t.phaseColor;
    return `
      <path class="dotai-route-bg" d="M${t.sx} ${t.sy} L${t.gx} ${t.gy}"/>
      <path class="dotai-route-done" d="M${t.sx} ${t.sy} L${t.tx} ${t.ty}" stroke="${stColor}"/>
      <circle class="dotai-pin-start" cx="${t.sx}" cy="${t.sy}" r="3.5"/>
      <circle class="dotai-pin-goal"  cx="${t.gx}" cy="${t.gy}" r="3.5"/>
    `;
  }).join('');
  const trucksSvg = onMapTrips.map(t => {
    const isMoving = t.phase === 'running';
    return `
      <g class="dotai-pin-truck" data-dotai-id="${t.id}" data-cx="${t.tx}" data-cy="${t.ty}"
         onclick="_dotaiFocusOnAssignment('${t.id}')" transform="translate(${t.tx} ${t.ty})">
        ${isMoving ? `<circle class="dotai-pin-truck-pulse" r="6"/>` : ''}
        <circle class="dotai-pin-truck-circle" r="5" fill="${t.phaseColor}"/>
        <text class="dotai-pin-label" text-anchor="middle" y="-9">${(t.driver || '').split(' ')[0]}</text>
      </g>
    `;
  }).join('');

  // サイドパネル（フェーズ別グルーピング）
  const tripsByPhase = {
    running: trips.filter(t => t.phase === 'running'),
    between: trips.filter(t => t.phase === 'between'),
    before:  trips.filter(t => t.phase === 'before'),
    after:   trips.filter(t => t.phase === 'after')
  };
  function renderSideGroup(label, list, color) {
    if (list.length === 0) return '';
    return `
      <div class="dotai-side-group-label" style="color:${color}">
        ${label} <span style="color:#9ca3af;font-weight:600">${list.length}</span>
      </div>
      ${list.map(t => `
        <div class="dotai-side-item" data-dotai-id="${t.id}" onclick="_dotaiFocusOnAssignment('${t.id}')">
          <div class="dotai-side-item-head">
            <span class="dotai-side-item-dot" style="background:${t.phaseColor}"></span>
            <span class="dotai-side-item-driver">${t.driver}</span>
            <span class="dotai-side-item-status" style="background:${t.phaseColor}22;color:${t.phaseColor}">${t.phaseLabel}</span>
          </div>
          <div class="dotai-side-item-route">📍 ${t.from} → ${t.to}</div>
          <div class="dotai-side-item-prog">
            <div class="dotai-side-item-prog-bar" style="width:${t.pct}%;background:${t.phaseColor}"></div>
          </div>
          <div class="dotai-side-item-meta">
            <span>${t.speed}</span>
            <span>${t.phase === 'running' ? '残 ' + t.remain + 'km' : t.distKm + 'km'}</span>
            <span>${t.phase === 'before' ? '発 ' + t.start : (t.phase === 'after' ? '着 ' + t.end : 'ETA ' + t.eta)}</span>
          </div>
        </div>
      `).join('')}
    `;
  }
  const sideHtml = isConfirmedTab
    ? renderSideGroup('完了', tripsByPhase.after, '#3BB888')
    : (
        renderSideGroup('🟢 運行中', tripsByPhase.running, '#22c55e') +
        renderSideGroup('🟡 案件間（待機）', tripsByPhase.between, '#f59e0b') +
        renderSideGroup('🔵 出発前', tripsByPhase.before, '#3b82f6') +
        renderSideGroup('⚫ 本日終了', tripsByPhase.after, '#94a3b8')
      );

  // ヘッダーカウント
  const movingCount = tripsByPhase.running.length;
  const totalCount = trips.length;

  wrap.innerHTML = `
    <div class="dotai-mega">
      <div class="dotai-mega-map" id="dotai-mega-map">
        <svg class="dotai-svg" viewBox="0 0 ${_DOTAI_PROJ.w} ${_DOTAI_PROJ.h}" preserveAspectRatio="xMidYMid meet">
          <g id="dotai-svg-g">
            <path class="dotai-pref" d="${silhouettePath}"/>
            ${(function(){
              let g = '';
              for (let lng = 130; lng <= 145; lng += 5) {
                const [x1] = _dotaiProject(lng, 30);
                const [x2] = _dotaiProject(lng, 46);
                g += `<line x1="${x1}" y1="0" x2="${x2}" y2="${_DOTAI_PROJ.h}" stroke="#bdc9d4" stroke-width="0.4" stroke-dasharray="2 3" opacity=".5"/>`;
              }
              for (let lat = 32; lat <= 44; lat += 4) {
                const [, y1] = _dotaiProject(128, lat);
                const [, y2] = _dotaiProject(146, lat);
                g += `<line x1="0" y1="${y1}" x2="${_DOTAI_PROJ.w}" y2="${y2}" stroke="#bdc9d4" stroke-width="0.4" stroke-dasharray="2 3" opacity=".5"/>`;
              }
              return g;
            })()}
            ${routesSvg}
            ${trucksSvg}
          </g>
        </svg>

        <div class="dotai-mega-header">
          <div class="dotai-mega-header-title">📡 リアルタイム動態管理</div>
          <div class="dotai-mega-header-count">${isConfirmedTab ? `完了 ${totalCount}件` : `運行中 ${movingCount} / 計画 ${totalCount}`}</div>
          <div class="dotai-mega-header-live" id="dotai-now-display" title="クリックでシミュ時刻を変更" style="cursor:pointer" onclick="_dotaiPromptSimTime()">${nowDisplay}</div>
        </div>

        <div class="dotai-mega-ctrl">
          <button class="dotai-mega-btn" onclick="_dotaiZoom(1.5)" title="拡大">＋</button>
          <button class="dotai-mega-btn" onclick="_dotaiZoom(1/1.5)" title="縮小">−</button>
          <button class="dotai-mega-btn compact" onclick="_dotaiResetView()" title="表示リセット">全国</button>
        </div>

        <div class="dotai-mega-scale">
          <div class="dotai-mega-scale-bar"></div>
          <span id="dotai-scale-label">~2000km</span>
        </div>

        <div class="dotai-mega-legend">
          <div class="dotai-mega-legend-item"><span class="dotai-mega-legend-dot" style="background:#22c55e"></span>運行中（移動）</div>
          <div class="dotai-mega-legend-item"><span class="dotai-mega-legend-dot" style="background:#f59e0b"></span>案件間（待機）</div>
          <div class="dotai-mega-legend-item"><span class="dotai-mega-legend-dot" style="background:#64748b"></span>出発地</div>
          <div class="dotai-mega-legend-item"><span class="dotai-mega-legend-dot" style="background:#dc2626"></span>到着地</div>
        </div>
      </div>

      <div class="dotai-side">
        <div class="dotai-side-header">
          <div>${isConfirmedTab ? `完了 ${totalCount}件` : `本日の運行 ${totalCount}件`}</div>
          ${!isConfirmedTab ? `<div style="font-size:10px;color:var(--text-muted);font-weight:500;margin-top:2px">🟢 ${tripsByPhase.running.length} 移動中　🟡 ${tripsByPhase.between.length} 待機　🔵 ${tripsByPhase.before.length} 出発前　⚫ ${tripsByPhase.after.length} 終了</div>` : ''}
        </div>
        <div class="dotai-side-list">${sideHtml || '<div style="padding:24px;text-align:center;color:#9ca3af;font-size:11px">表示可能な案件がありません</div>'}</div>
      </div>
    </div>
  `;

  // イベントバインド
  _dotaiBindEvents();
  _dotaiResetView();

  // 1分ごとに自動更新（再描画でトラック位置が時間経過に合わせて動く）
  if (window.__dotaiAutoRefresh) clearInterval(window.__dotaiAutoRefresh);
  window.__dotaiAutoRefresh = setInterval(() => {
    // タブが見えているときだけ再描画
    const dotaiPanel = document.getElementById('dispatch-dotai');
    if (dotaiPanel && dotaiPanel.style.display !== 'none') renderDotai();
  }, 60 * 1000);
}

// 簡易ハーバーサイン公式（直線距離km）
function _dotaiHaversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// シミュレート時刻を変更するプロンプト
window._dotaiPromptSimTime = function() {
  const cur = window.__dotaiSimNow || new Date().toTimeString().substring(0,5);
  const t = prompt('シミュレートする現在時刻を HH:MM 形式で入力（空欄で実時刻に戻す）', cur);
  if (t === null) return;
  if (t.trim() === '') {
    delete window.__dotaiSimNow;
  } else if (/^\d{1,2}:\d{2}$/.test(t.trim())) {
    window.__dotaiSimNow = t.trim();
  } else {
    return;
  }
  renderDotai();
};

function _dotaiBindEvents() {
  const mapEl = document.getElementById('dotai-mega-map');
  if (!mapEl) return;

  // ホイールズーム
  mapEl.addEventListener('wheel', function(e) {
    e.preventDefault();
    const r = mapEl.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    const factor = e.deltaY < 0 ? 1.15 : 1/1.15;
    _dotaiZoom(factor, cx, cy);
  }, { passive: false });

  // パン（ドラッグ）
  mapEl.addEventListener('mousedown', function(e) {
    // トラックピンクリックはバブルアップでズームパンせず focusOn が拾う
    if (e.target.closest('.dotai-pin-truck')) return;
    _dotaiState.isPanning = true;
    _dotaiState.panStartX = e.clientX;
    _dotaiState.panStartY = e.clientY;
    _dotaiState.panOrigX = _dotaiState.panX;
    _dotaiState.panOrigY = _dotaiState.panY;
    mapEl.classList.add('panning');
  });
  document.addEventListener('mousemove', function(e) {
    if (!_dotaiState.isPanning) return;
    _dotaiState.panX = _dotaiState.panOrigX + (e.clientX - _dotaiState.panStartX);
    _dotaiState.panY = _dotaiState.panOrigY + (e.clientY - _dotaiState.panStartY);
    _dotaiApplyTransform();
  });
  document.addEventListener('mouseup', function() {
    if (_dotaiState.isPanning) {
      _dotaiState.isPanning = false;
      mapEl.classList.remove('panning');
    }
  });

  // ピンチズーム（タッチ）：簡易実装
  let pinchStartDist = null, pinchStartZoom = 1;
  mapEl.addEventListener('touchstart', function(e) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist = Math.sqrt(dx*dx + dy*dy);
      pinchStartZoom = _dotaiState.zoom;
    } else if (e.touches.length === 1) {
      _dotaiState.isPanning = true;
      _dotaiState.panStartX = e.touches[0].clientX;
      _dotaiState.panStartY = e.touches[0].clientY;
      _dotaiState.panOrigX = _dotaiState.panX;
      _dotaiState.panOrigY = _dotaiState.panY;
    }
  }, { passive: true });
  mapEl.addEventListener('touchmove', function(e) {
    if (e.touches.length === 2 && pinchStartDist) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const r = mapEl.getBoundingClientRect();
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
      const factor = (dist / pinchStartDist) / (_dotaiState.zoom / pinchStartZoom);
      _dotaiZoom(factor, cx, cy);
    } else if (e.touches.length === 1 && _dotaiState.isPanning) {
      _dotaiState.panX = _dotaiState.panOrigX + (e.touches[0].clientX - _dotaiState.panStartX);
      _dotaiState.panY = _dotaiState.panOrigY + (e.touches[0].clientY - _dotaiState.panStartY);
      _dotaiApplyTransform();
    }
  }, { passive: true });
  mapEl.addEventListener('touchend', function() {
    pinchStartDist = null;
    _dotaiState.isPanning = false;
  });
}

function renderDispatchContent() {
  if (currentDispatchSubtab === 'dnd') renderDnd();
  else if (currentDispatchSubtab === 'schedule') renderSchedule();
  else if (currentDispatchSubtab === 'comm') renderCommLog();
  else renderDotai();
}

// ═══════════════════════════════════════════════════════════════
//  連絡状況（コミュニケーション履歴）
//  協力会社への依頼メール返信、ドライバーへの配車依頼の承認履歴など
//  期間と種別で絞り込みできる一覧画面
// ═══════════════════════════════════════════════════════════════

// 連絡履歴サンプルデータ
// 注: 時刻は「現在から相対的に」設定するため、レンダリング時に動的生成
function _buildCommLogSamples() {
  const now = new Date();
  function ago(hours, minutes) {
    const d = new Date(now.getTime() - (hours * 60 + (minutes || 0)) * 60 * 1000);
    return d;
  }
  return [
    {
      id: 'C-2026-0527-001',
      type: 'partner-reply',        // 種別：協力会社からの返信
      typeLabel: '協力会社返信',
      channel: 'email',
      direction: 'in',              // 受信
      counterparty: '北関東物流㈱（佐藤様）',
      subject: 'Re: 5/28 横浜→仙台 4tウィング配車依頼の件',
      snippet: 'ご依頼の件、承りました。28日午前6時の積込で対応可能です。担当は伊藤を予定しております。料金につきましては別途お見積り書をお送りします。',
      status: 'replied',
      statusLabel: '返信あり',
      sentAt: ago(0, 28),
      relatedCase: '20240524104',
      relatedClient: '関西化学工業株式会社',
      relatedAssignment: null
    },
    {
      id: 'C-2026-0527-002',
      type: 'driver-approval',      // 種別：ドライバーからの承認
      typeLabel: 'ドライバー承認',
      channel: 'app',
      direction: 'in',
      counterparty: '山田 一郎',
      subject: '【承認】5/28 6:45発 △△食品 川口→横浜',
      snippet: '配車依頼を承認しました。当日は5:30に出社して点検後、積込地点へ向かいます。',
      status: 'success',
      statusLabel: '承認',
      sentAt: ago(1, 15),
      relatedCase: '20240524101',
      relatedClient: '株式会社○○商事',
      relatedAssignment: 'A00012'
    },
    {
      id: 'C-2026-0527-003',
      type: 'partner-request',      // 種別：協力会社への依頼
      typeLabel: '協力会社依頼',
      channel: 'email',
      direction: 'out',             // 送信
      counterparty: '関東陸運㈱（中村様）',
      subject: '【依頼】5/29 東京→大阪 10t車1台 確認願い',
      snippet: 'いつもお世話になっております。下記案件にて10t車のご手配可能か、ご確認願います。希望出発時刻：5/29 6:00、品目：化学品900kg、納期：5/29 PM 大阪市住之江区。',
      status: 'pending',
      statusLabel: '返信待ち',
      sentAt: ago(2, 40),
      relatedCase: '20240524108',
      relatedClient: '関西化学工業株式会社',
      relatedAssignment: null
    },
    {
      id: 'C-2026-0527-004',
      type: 'driver-dispatch',      // 種別：ドライバーへの配車依頼
      typeLabel: 'ドライバー配車依頼',
      channel: 'app',
      direction: 'out',
      counterparty: '鈴木 次郎',
      subject: '【配車依頼】5/28 9:30発 北海道産直食品 江東→千葉',
      snippet: '明日の配車にてご対応願います。集荷9:30、納品14:30、車両は冷蔵車をご使用ください。詳細は添付の配車指示書をご確認ください。',
      status: 'pending',
      statusLabel: '承認待ち',
      sentAt: ago(3, 10),
      relatedCase: '20240524103',
      relatedClient: '北海道産直食品',
      relatedAssignment: 'A00014'
    },
    {
      id: 'C-2026-0527-005',
      type: 'driver-approval',
      typeLabel: 'ドライバー承認',
      channel: 'line',
      direction: 'in',
      counterparty: '高橋 五郎',
      subject: '【辞退】5/30 福岡長距離の件',
      snippet: '申し訳ありませんが、5/30の福岡行きは健康診断と重なっており辞退させてください。代替案として5/31以降であれば対応可能です。',
      status: 'declined',
      statusLabel: '辞退',
      sentAt: ago(5, 0),
      relatedCase: '20240524111',
      relatedClient: '九州青果株式会社',
      relatedAssignment: null
    },
    {
      id: 'C-2026-0527-006',
      type: 'customer-confirm',
      typeLabel: '顧客確認',
      channel: 'email',
      direction: 'out',
      counterparty: '株式会社○○商事（田中様）',
      subject: '【受注確定】5/28 川口→横浜 配車手配完了のご連絡',
      snippet: 'お世話になっております。本日ご依頼の5/28案件につきまして、ドライバー山田 一郎（4tウィング 車両1245）にて手配完了いたしました。当日6:45の集荷でご対応いたします。',
      status: 'confirmed',
      statusLabel: '送信済み',
      sentAt: ago(6, 30),
      relatedCase: '20240524101',
      relatedClient: '株式会社○○商事',
      relatedAssignment: 'A00012'
    }
  ];
}

// フィルタ状態
let _commFilter = {
  range: 'today',  // 'today' | '7days' | '30days' | 'all'
  type: 'all',     // 'all' | 'partner' | 'driver' | 'customer'
  q: ''
};

function _commIcon(channel) {
  const map = { email:'✉️', app:'📱', fax:'📠', phone:'📞', line:'💬' };
  return map[channel] || '📩';
}

function _commFormatTime(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
}

function _commFormatRelative(d) {
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間前`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}日前`;
  return `${Math.floor(day / 7)}週間前`;
}

function _commDayLabel(d) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const target = new Date(d);
  target.setHours(0,0,0,0);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diffDays === 0) return '本日';
  if (diffDays === 1) return '昨日';
  if (diffDays === 2) return '一昨日';
  const dow = ['日','月','火','水','木','金','土'][target.getDay()];
  return `${target.getFullYear()}年${target.getMonth()+1}月${target.getDate()}日(${dow})`;
}

function renderCommLog() {
  const wrap = document.getElementById('comm-wrap-inner');
  if (!wrap) return;

  // サンプルデータをキャッシュ（初回のみ生成、フィルタで使い回す）
  if (!window.__commLogData) {
    window.__commLogData = _buildCommLogSamples();
  }
  const all = window.__commLogData;

  // 期間フィルタ
  const now = Date.now();
  const ranges = {
    today:  { label:'今日',     ms: 24 * 60 * 60 * 1000 },
    '7days':{ label:'過去7日',  ms:  7 * 24 * 60 * 60 * 1000 },
    '30days':{label:'過去30日', ms: 30 * 24 * 60 * 60 * 1000 },
    all:    { label:'すべて',   ms: Infinity }
  };
  const rangeMs = ranges[_commFilter.range].ms;
  // 種別フィルタの定義
  const typeFilters = {
    all:       { label:'すべて', match: () => true },
    partner:   { label:'協力会社', match: t => t === 'partner-request' || t === 'partner-reply' },
    driver:    { label:'ドライバー', match: t => t === 'driver-dispatch' || t === 'driver-approval' },
    customer:  { label:'顧客', match: t => t === 'customer-confirm' }
  };
  const typeMatch = typeFilters[_commFilter.type].match;

  // フィルタ適用
  const q = (_commFilter.q || '').trim().toLowerCase();
  const filtered = all.filter(item => {
    if (now - item.sentAt.getTime() > rangeMs) return false;
    if (!typeMatch(item.type)) return false;
    if (q) {
      const hay = (item.counterparty + ' ' + item.subject + ' ' + item.snippet + ' ' +
                   (item.relatedClient || '') + ' ' + (item.relatedCase || ''))
                   .toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });

  // 新しい順にソート
  filtered.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());

  // 日付別グルーピング
  const groups = {};
  filtered.forEach(item => {
    const key = item.sentAt.toDateString();
    if (!groups[key]) groups[key] = { label: _commDayLabel(item.sentAt), items: [] };
    groups[key].items.push(item);
  });

  // フィルタバー
  const filterBarHtml = `
    <div class="comm-filter-bar">
      <span class="comm-filter-label">期間</span>
      <div class="comm-filter-group">
        ${Object.keys(ranges).map(k => `
          <button class="comm-filter-btn ${_commFilter.range === k ? 'active' : ''}"
                  onclick="window.__commSetFilter('range','${k}')">${ranges[k].label}</button>
        `).join('')}
      </div>
      <span class="comm-filter-label">種別</span>
      <div class="comm-filter-group">
        ${Object.keys(typeFilters).map(k => `
          <button class="comm-filter-btn ${_commFilter.type === k ? 'active' : ''}"
                  onclick="window.__commSetFilter('type','${k}')">${typeFilters[k].label}</button>
        `).join('')}
      </div>
      <input class="comm-filter-search" type="text" placeholder="キーワード検索（顧客名・件名・案件ID...）"
             value="${(_commFilter.q || '').replace(/"/g,'&quot;')}"
             oninput="window.__commSetFilter('q', this.value)">
      <div class="comm-filter-stats"><strong>${filtered.length}</strong> / ${all.length}件</div>
    </div>
  `;

  // リスト本体
  let listHtml = '';
  if (filtered.length === 0) {
    listHtml = `<div class="comm-empty">
      <div class="comm-empty-icon">📭</div>
      <div>条件に一致する連絡履歴はありません</div>
      <div style="font-size:10px;color:#9ca3af;margin-top:6px">フィルタ条件を変更してください</div>
    </div>`;
  } else {
    Object.keys(groups).forEach(key => {
      const grp = groups[key];
      listHtml += `
        <div class="comm-day-header">
          ${grp.label}
          <span class="comm-day-header-count">${grp.items.length}件</span>
        </div>
      `;
      listHtml += grp.items.map(item => {
        // 関連情報タグ
        const relatedTags = [];
        if (item.relatedCase) relatedTags.push(`<span class="comm-related-tag">案件 ${item.relatedCase}</span>`);
        if (item.relatedClient) relatedTags.push(`<span class="comm-related-tag">${item.relatedClient}</span>`);
        if (item.relatedAssignment) relatedTags.push(`<span class="comm-related-tag">${item.relatedAssignment}</span>`);

        const dirText = item.direction === 'out' ? '↑ 送信' : '↓ 受信';
        return `
          <div class="comm-item">
            <div class="comm-icon ${item.channel}">${_commIcon(item.channel)}</div>
            <div class="comm-main">
              <div class="comm-main-head">
                <span class="comm-type-badge ${item.type}">${item.typeLabel}</span>
                <span class="comm-direction ${item.direction}">${dirText}</span>
                <span class="comm-counterparty">${item.counterparty}</span>
              </div>
              <div class="comm-subject">${item.subject}</div>
              <div class="comm-snippet">${item.snippet}</div>
              ${relatedTags.length > 0 ? `<div class="comm-related">🔗 ${relatedTags.join(' ')}</div>` : ''}
            </div>
            <div class="comm-meta">
              <div class="comm-time">
                ${_commFormatTime(item.sentAt)}
                <div class="comm-time-rel">${_commFormatRelative(item.sentAt)}</div>
              </div>
              <div class="comm-status ${item.status}">${item.statusLabel}</div>
            </div>
          </div>
        `;
      }).join('');
    });
  }

  wrap.innerHTML = `
    ${filterBarHtml}
    <div class="comm-list">${listHtml}</div>
  `;
}

window.__commSetFilter = function(key, value) {
  _commFilter[key] = value;
  renderCommLog();
};


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  D&D 配車割当ビュー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ━━ 案件一覧ページとの連携ヘルパー ━━
// D&D配車が確定したら：案件一覧の元フェーズから案件を取り出し、processedCasesに追加する
// 解除されたら：逆の動きで元フェーズに戻す
function dndCaseToProcessed(caseListId, driverId, dateKey, start, end) {
  if (!caseListId) return; // 紐付けがない仮想案件はスキップ
  if (typeof unprocessedCases === 'undefined' || typeof processingCases === 'undefined' || typeof processedCases === 'undefined') return;

  let movedCase = null;
  let fromPhase = null;

  // 未処理から探す
  let idx = unprocessedCases.findIndex(c => c.id === caseListId);
  if (idx >= 0) {
    movedCase = unprocessedCases[idx];
    fromPhase = 'unprocessed';
    unprocessedCases.splice(idx, 1);
  } else {
    // 処理中から探す
    idx = processingCases.findIndex(c => c.id === caseListId);
    if (idx >= 0) {
      movedCase = processingCases[idx];
      fromPhase = 'processing';
      processingCases.splice(idx, 1);
    }
  }
  if (!movedCase) return;

  // processedCasesに簡易エントリとして追加（既に存在しなければ）
  if (!processedCases.some(c => c.id === caseListId)) {
    const drv = dndDrivers.find(d => d.id === driverId);
    const dateD = new Date(dateKey + 'T00:00:00');
    const dateStr = dateD.toLocaleDateString('ja-JP', {month:'numeric',day:'numeric'});
    const processedEntry = {
      id: caseListId,
      status: '完了',
      casePattern: movedCase.casePattern || 'スポット案件',
      partner: false,
      client: movedCase.client,
      from: movedCase.from,
      to: movedCase.to,
      goods: movedCase.goods,
      completion: `${dateStr} ${start} D&D配車`,
      distance: movedCase.distance || '—',
      delay: 'なし',
      driver: drv ? drv.driver : '—',
      vehicle: drv ? (drv.vehicle.match(/\d+/) || ['—'])[0] : '—',
      vehicleType: drv ? drv.type : '—',
      vehicleCap: drv ? drv.maxLoad : 0,
      sales: 0, fuel: 0, other: 0, profit: 0, margin: 0,
      invoiceNo: '—', invoiceDate: '—', due: '—', paid: false,
      progress: 0, truckTop: 0, progressPct: 0, remain: '—', eta: '—', donekm: 0,
      billingConfirmed: false,
      // D&D由来の案件をマーク（元フェーズに戻すために保持）
      _dndOrigin: { fromPhase, originalData: movedCase, dndDriverId: driverId, dndDateKey: dateKey, dndStart: start, dndEnd: end }
    };
    // 先頭に追加（最新が上に来るように）
    processedCases.unshift(processedEntry);
  }

  // 案件一覧の再描画（ページが開いていれば反映）
  rerenderCasesPageIfVisible();
  // 配車計画表の処理済みタブと件数連動
  if (typeof notifyProcessedCasesChanged === 'function') notifyProcessedCasesChanged();
}

function dndCaseFromProcessed(caseListId) {
  if (!caseListId) return;
  if (typeof unprocessedCases === 'undefined' || typeof processingCases === 'undefined' || typeof processedCases === 'undefined') return;

  const idx = processedCases.findIndex(c => c.id === caseListId);
  if (idx < 0) return;
  const entry = processedCases[idx];
  if (!entry._dndOrigin) return; // D&D由来でなければ操作しない

  // 元のデータを復元
  const orig = entry._dndOrigin.originalData;
  const fromPhase = entry._dndOrigin.fromPhase;
  processedCases.splice(idx, 1);

  if (fromPhase === 'unprocessed') {
    unprocessedCases.unshift(orig);
  } else if (fromPhase === 'processing') {
    processingCases.unshift(orig);
  }

  rerenderCasesPageIfVisible();
  // 配車計画表の処理済みタブと件数連動
  if (typeof notifyProcessedCasesChanged === 'function') notifyProcessedCasesChanged();
}

// 案件一覧ページが現在開いている場合、フェーズ別カウントとリストを更新する
function rerenderCasesPageIfVisible() {
  const casesPage = document.getElementById('page-cases');
  if (!casesPage) return;
  const isVisible = casesPage.classList.contains('active');
  // フェーズタブのカウント更新
  updateCasesPhaseCounts();
  if (!isVisible) return;
  // 表示中なら、現在アクティブなフェーズを再レンダリング
  try {
    const activeUnprocessed = document.querySelector('.phase-tab.unprocessed.active');
    const activeProcessing  = document.querySelector('.phase-tab.processing.active');
    const activeProcessed   = document.querySelector('.phase-tab.processed.active');
    if (activeUnprocessed && typeof renderUnprocessedList === 'function') renderUnprocessedList();
    else if (activeProcessing && typeof renderProcessingList === 'function') renderProcessingList();
    else if (activeProcessed && typeof renderProcessedList === 'function') renderProcessedList();
  } catch(e) { /* レンダラ未定義時はスキップ */ }
}

// 初期表示時のハードコード値と配列長を保存（最初の呼び出し時のみ）
let _dndInitialPhaseSnapshot = null;
function captureInitialCounts() {
  if (_dndInitialPhaseSnapshot) return;
  if (typeof unprocessedCases === 'undefined' || typeof processingCases === 'undefined' || typeof processedCases === 'undefined') return;
  const get = sel => {
    const el = document.querySelector(sel);
    if (!el) return 0;
    return parseInt(el.textContent, 10) || 0;
  };
  _dndInitialPhaseSnapshot = {
    counts: {
      unprocessed: get('.phase-tab.unprocessed .tab-count'),
      processing:  get('.phase-tab.processing .tab-count'),
      processed:   get('.phase-tab.processed .tab-count'),
    },
    arrayLengths: {
      unprocessed: unprocessedCases.length,
      processing:  processingCases.length,
      processed:   processedCases.length,
    }
  };
}

// フェーズタブのカウント数字を最新化（初期値からの差分で計算）
function updateCasesPhaseCounts() {
  try {
    captureInitialCounts();
    if (!_dndInitialPhaseSnapshot) return;
    const init = _dndInitialPhaseSnapshot;
    const diffs = {
      unprocessed: unprocessedCases.length - init.arrayLengths.unprocessed,
      processing:  processingCases.length  - init.arrayLengths.processing,
      processed:   processedCases.length   - init.arrayLengths.processed,
    };
    const setCount = (sel, val) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const v = Math.max(0, val);
      el.textContent = v;
      el.setAttribute('data-zero', String(v === 0));
    };
    setCount('.phase-tab.unprocessed .tab-count', init.counts.unprocessed + diffs.unprocessed);
    setCount('.phase-tab.processing .tab-count',  init.counts.processing  + diffs.processing);
    setCount('.phase-tab.processed .tab-count',   init.counts.processed   + diffs.processed);
  } catch(e) {}
}

// スプリッターの初期幅
const DND_LEFT_DEFAULT_WIDTH = 300;
const DND_LEFT_MIN_WIDTH = 220;
const DND_LEFT_MAX_WIDTH = 560;
let dndSplitterDragging = false;
let dndSplitterStartX = 0;
let dndSplitterStartW = 0;

function dndSplitterStart(e) {
  e.preventDefault();
  const left = document.querySelector('.dnd-left');
  if (!left) return;
  const splitter = document.getElementById('dnd-splitter');
  dndSplitterDragging = true;
  dndSplitterStartX = e.clientX;
  dndSplitterStartW = left.getBoundingClientRect().width;
  if (splitter) splitter.classList.add('dragging');
  document.body.classList.add('dnd-splitter-resizing');
  document.addEventListener('mousemove', dndSplitterMove);
  document.addEventListener('mouseup',   dndSplitterEnd);
}

function dndSplitterMove(e) {
  if (!dndSplitterDragging) return;
  const left = document.querySelector('.dnd-left');
  if (!left) return;
  const dx = e.clientX - dndSplitterStartX;
  let w = dndSplitterStartW + dx;
  w = Math.max(DND_LEFT_MIN_WIDTH, Math.min(DND_LEFT_MAX_WIDTH, w));
  left.style.width = w + 'px';
}

function dndSplitterEnd() {
  dndSplitterDragging = false;
  const splitter = document.getElementById('dnd-splitter');
  if (splitter) splitter.classList.remove('dragging');
  document.body.classList.remove('dnd-splitter-resizing');
  document.removeEventListener('mousemove', dndSplitterMove);
  document.removeEventListener('mouseup',   dndSplitterEnd);
  // 幅をlocalStorageに保存（任意：再訪時に復元）
  const left = document.querySelector('.dnd-left');
  if (left) {
    try { localStorage.setItem('dndLeftWidth', parseInt(left.style.width, 10)); } catch(e){}
  }
}

function dndSplitterReset() {
  const left = document.querySelector('.dnd-left');
  if (!left) return;
  left.style.width = DND_LEFT_DEFAULT_WIDTH + 'px';
  try { localStorage.removeItem('dndLeftWidth'); } catch(e){}
}

// 未割当案件データ（処理中・未処理を含む）
// caseListId：案件一覧（unprocessedCases / processingCases）と紐づけるID
// originalPhase：元のフェーズ（'unprocessed' or 'processing'）
const dndUnassignedCases = (function() {
  // 配車計画表のブロックは緑1色で統一する（カラフルさを避け、視認性を優先）
  // 緊急/通常などの状態はバッジやアイコンで区別する設計
  const BLOCK_COLOR = '#1a7a5e';

  // 既存の重要8件（案件一覧と紐付けあり）
  const base = [
    { id:'D-001', caseListId:'20240524001', originalPhase:'unprocessed', client:'株式会社○○商事',      status:'unprocessed', from:'埼玉県川口市',  to:'神奈川県横浜市', goods:'パレット/800kg/常温', durationH:3, preferredStart:'09:00', deadline:'05/25 AM指定',  urgent:true,  color:BLOCK_COLOR },
    { id:'D-002', caseListId:'20240524002', originalPhase:'unprocessed', client:'△△食品株式会社',      status:'unprocessed', from:'千葉県船橋市',  to:'東京都大田区',   goods:'ケース/500kg/冷蔵',   durationH:4, preferredStart:'10:00', deadline:'05/24 PM指定',  urgent:true,  color:BLOCK_COLOR },
    { id:'D-003', caseListId:'20240524003', originalPhase:'unprocessed', client:'株式会社□□製作所',    status:'unprocessed', from:'茨城県つくば市',to:'愛知県名古屋市', goods:'機械部品/1200kg/常温',durationH:8, preferredStart:'07:00', deadline:'05/25 終日',     urgent:false, color:BLOCK_COLOR },
    { id:'D-004', caseListId:'20240524004', originalPhase:'unprocessed', client:'◇◇アパレル株式会社', status:'unprocessed', from:'東京都渋谷区',  to:'大阪府大阪市',   goods:'アパレル/300kg/常温', durationH:9, preferredStart:'08:00', deadline:'05/26 AM指定',  urgent:false, color:BLOCK_COLOR },
    { id:'D-005', caseListId:'20240524101', originalPhase:'processing',  client:'株式会社○○商事',      status:'processing',  from:'埼玉県川口市',  to:'神奈川県横浜市', goods:'パレット/800kg/常温', durationH:3, preferredStart:'09:00', deadline:'05/25 AM',      urgent:false, color:BLOCK_COLOR },
    { id:'D-006', caseListId:'20240524102', originalPhase:'processing',  client:'南関東物流株式会社',   status:'processing',  from:'神奈川県川崎市',to:'静岡県静岡市',   goods:'電子部品/400kg/精密', durationH:5, preferredStart:'11:00', deadline:'05/24 夕方',    urgent:true,  color:BLOCK_COLOR },
    { id:'D-007', caseListId:null,          originalPhase:null,          client:'東日本電子工業',       status:'processing',  from:'東京都大田区',  to:'静岡県浜松市',   goods:'電子部品/550kg/精密', durationH:5, preferredStart:'11:00', deadline:'05/26 AM',      urgent:false, color:BLOCK_COLOR },
    { id:'D-008', caseListId:null,          originalPhase:null,          client:'NSK製造株式会社',      status:'unprocessed', from:'神奈川県横浜市',to:'千葉県船橋市',   goods:'部品/720kg/常温',     durationH:3, preferredStart:'13:00', deadline:'05/25 17:00',   urgent:true,  color:BLOCK_COLOR },
  ];

  // 自動生成用のテンプレート
  const CLIENTS = [
    '関東物流センター','エコフレッシュ食品','明和産業株式会社','日東精工','中央運送株式会社',
    '富士物産','大和ロジテック','東洋食品工業','HK化学工業','三井金属加工',
    'プラスチック工業','森山運輸','北信精密','コスモ電子','スター物流',
    '青葉商事','日新建材','東海製造','西武ロジ','北陸食糧',
    '光陽印刷','タカハシ金属','京和産業','緑風物流','RST工業',
    'ABC機器','XYZ部品','クリーン化学','ベイサイド物流','エアロ精機',
    'ハーモニーフード','GreenPath運輸','Logix東日本','LDX関西','ナイス物流',
    'モリヤマ物産','清和食品','UNITED運輸','Pacific物流','MEGA電子',
    'シルバー工業','東邦運輸','住江化成','南九州物産'
  ];
  const ROUTES = [
    ['東京都江東区','千葉県千葉市'], ['神奈川県川崎市','静岡県静岡市'],
    ['埼玉県さいたま市','東京都品川区'], ['千葉県市川市','東京都中央区'],
    ['茨城県水戸市','栃木県宇都宮市'], ['群馬県前橋市','埼玉県熊谷市'],
    ['東京都板橋区','神奈川県横浜市'], ['静岡県浜松市','愛知県名古屋市'],
    ['東京都品川区','大阪府大阪市'], ['宮城県仙台市','東京都渋谷区'],
    ['福岡県福岡市','広島県広島市'], ['新潟県新潟市','長野県長野市'],
    ['東京都台東区','埼玉県川口市'], ['神奈川県厚木市','山梨県甲府市'],
    ['愛知県豊田市','岐阜県岐阜市'], ['大阪府堺市','京都府京都市'],
  ];
  const GOODS = [
    'パレット/600kg/常温','ケース/450kg/冷蔵','電子部品/300kg/精密','飲料/1000kg',
    '機械部品/700kg','衣料品/250kg','生鮮/550kg/冷蔵','建材/1500kg',
    '化学品/800kg','事務用品/180kg','金属部品/950kg','食品/650kg/冷蔵',
    'プラスチック/420kg','医療機器/350kg/精密','文具/220kg',
  ];
  const DEADLINES = [
    '本日中', '本日 17:00', '本日 PM指定', '明日 AM指定',
    '明日 終日', '本日 夕方', '明日 12:00', '本日 19:00'
  ];

  const auto = [];
  for (let i = 0; i < 42; i++) {
    const idNum = String(9 + i).padStart(3, '0');
    const r = ROUTES[i % ROUTES.length];
    const isProcessing = (i % 3 === 1);
    const urgent = (i * 7 % 5) === 1; // ~20%が緊急
    const sh = 6 + (i * 3) % 12; // 6:00〜17:00 で散らす
    const sm = (i % 4) * 15;
    const startStr = String(sh).padStart(2,'0') + ':' + String(sm).padStart(2,'0');
    auto.push({
      id: 'D-' + idNum,
      caseListId: null,
      originalPhase: null,
      client: CLIENTS[i % CLIENTS.length],
      status: isProcessing ? 'processing' : 'unprocessed',
      from: r[0],
      to: r[1],
      goods: GOODS[i % GOODS.length],
      durationH: 2 + (i % 7),
      preferredStart: startStr,
      deadline: DEADLINES[i % DEADLINES.length],
      urgent: urgent,
      color: BLOCK_COLOR
    });
  }

  // ── ★積荷時間 自動算出ロジック（純粋関数）──────────────────────
  // goods 文字列（例: "パレット/800kg/常温"）から積込・荷下ろし時間を算出する。
  // - パレット枚数明示があれば優先（例: "パレット11枚積み"）
  // - 重量・荷種・温度帯から経験則で組み立てる
  // - 15分単位にスナップ、上下限ガードあり
  function calcLoadingMinutes(goods) {
    const text = String(goods || '').toLowerCase();

    // 単位時間（分）
    const MIN_PER_PALLET = 15;     // パレット1枚あたり
    const MIN_PER_500KG  = 10;     // パレット以外の重量物（ケース等）
    const MIN_PRECISION  = 10;     // 精密品の取扱増分

    // パレット枚数：明示があれば優先、なければ重量から推定（500kg/枚）
    let palletCount = 0;
    const palletMatch = text.match(/(\d+)\s*枚/);
    if (palletMatch) palletCount = parseInt(palletMatch[1], 10);

    const kgMatch = text.match(/(\d+)\s*kg/);
    const kg = kgMatch ? parseInt(kgMatch[1], 10) : 0;

    let loadMin = 0;

    if (text.includes('パレット')) {
      // パレット荷役
      if (palletCount > 0)      loadMin = palletCount * MIN_PER_PALLET;
      else if (kg > 0)          loadMin = Math.ceil(kg / 500) * MIN_PER_PALLET;
      else                      loadMin = 30; // 不明時のデフォルト
    } else if (text.includes('機械') || text.includes('建材')) {
      // 重量物・大型 → 一律長め
      loadMin = 45;
    } else if (kg > 0) {
      // ケース・段ボール系
      loadMin = Math.max(15, Math.ceil(kg / 500) * MIN_PER_500KG);
    } else {
      loadMin = 20; // 完全不明
    }

    // 加算：精密品/冷蔵冷凍は丁寧な扱いで +分
    if (text.includes('精密')) loadMin += MIN_PRECISION;
    if (text.includes('冷蔵') || text.includes('冷凍')) loadMin += 5;

    // 上限・下限を切る（極端値ガード）
    loadMin = Math.max(10, Math.min(loadMin, 120));

    // 荷下ろしは経験則として積込の0.9倍。シンプルに同じか少し短めに。
    let unloadMin = Math.round(loadMin * 0.9);
    unloadMin = Math.max(10, Math.min(unloadMin, 120));

    // 15分単位にスナップ（タイムライン精度に合わせる）
    const snap15 = (m) => Math.max(15, Math.round(m / 15) * 15);
    loadMin   = snap15(loadMin);
    unloadMin = snap15(unloadMin);

    return { loadMin, unloadMin };
  }

  // 案件に load/drive/unload を埋め込む。durationH を保ちつつ drive を逆算。
  // 手動編集（durationSource='manual'）の案件は触らない。
  function enrichCaseWithLoadingTime(c) {
    if (!c) return c;
    if (c.durationSource === 'manual') return c;

    const { loadMin, unloadMin } = calcLoadingMinutes(c.goods);
    const totalMin = (c.durationH || 0) * 60;
    let driveMin = totalMin - loadMin - unloadMin;
    if (driveMin < 15) driveMin = 15; // 走行は最低15分は確保

    c.loadMin = loadMin;
    c.driveMin = driveMin;
    c.unloadMin = unloadMin;
    // durationH を load+drive+unload と整合させる
    c.durationH = (loadMin + driveMin + unloadMin) / 60;
    c.durationSource = c.durationSource || 'auto';
    return c;
  }

  // グローバルにも公開（後続レイヤーやデバッグから使えるように）
  window.calcLoadingMinutes = calcLoadingMinutes;
  window.enrichCaseWithLoadingTime = enrichCaseWithLoadingTime;

  // 全案件に算出結果を埋め込む
  const all = base.concat(auto);
  all.forEach(enrichCaseWithLoadingTime);
  return all;
})();

// ═══════════════════════════════════════════════════════════════════
// ★M0: 新スキーマ（CASES / JOBS / STEPS）グローバル定義
// ═══════════════════════════════════════════════════════════════════
// 設計方針:
//  - cases[]    : 案件マスタ（既存 dndUnassignedCases の正規化）
//  - jobs[]     : ジョブテーブル（「あるドライバーのある期間の作業」が1レコード）
//  - steps[]    : 工程テーブル（積込/走行/休憩/荷下ろし）
//  - dndAssignments は jobs[] から rebuild される「派生ビュー」だが、
//    既存コード（76箇所が `.push()`等で直接書き換えている）との互換のため
//    物理的にも保持する。jobs[] を真とし、書き込み時に同期再構築する。
//  - M0/M1/M2 では「内部スキーマを構築し外見を変えない」ことだけを行う。
//    UI（日跨ぎマーカー等）の追加は M4 以降で行う。

let cases = [];   // CASE レコードの配列
let jobs  = [];   // JOB レコードの配列
let steps = [];   // STEP レコードの配列

// グローバルからもアクセスできるように公開（デバッグ・後続レイヤー用）
window.cases = cases;
window.jobs  = jobs;
window.steps = steps;

// ── ID生成ユーティリティ ────────────────────────────────────────────
function _newJobId(caseId, seq) {
  return `${caseId}-J${seq}`;
}
function _newStepId(jobId, ord) {
  return `${jobId}-S${ord}`;
}

// ── ISO datetime ユーティリティ ─────────────────────────────────────
// 既存コードは HH:MM 形式 (時刻のみ) を使う。新スキーマは ISO datetime
// (日付+時刻) を使う。双方向の変換ヘルパー。
function combineToIsoDateTime(dateKey, hhmm) {
  // 'YYYY-MM-DD' + 'HH:MM' → 'YYYY-MM-DDTHH:MM:00'
  return `${dateKey}T${hhmm}:00`;
}
function extractDateKey(isoDateTime) {
  return isoDateTime.substring(0, 10);
}
function extractHHMM(isoDateTime) {
  return isoDateTime.substring(11, 16);
}
function isoSameDay(iso1, iso2) {
  return extractDateKey(iso1) === extractDateKey(iso2);
}
function isoAddMinutes(iso, mins) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + mins);
  // ISO形式に戻す（タイムゾーン無視、ローカル時刻として扱う）
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

window.combineToIsoDateTime = combineToIsoDateTime;
window.extractDateKey = extractDateKey;
window.extractHHMM = extractHHMM;
window.isoSameDay = isoSameDay;
window.isoAddMinutes = isoAddMinutes;

// ドライバー&トラック（タイムライン行）
// 旧定義は drivers[]/vehicles[] マスタから派生させる方式に切り替え済み。
// 互換のため _DND_VEHICLE_TYPES / _DND_INIT_DRIVERS という名前自体は維持。
const _DND_VEHICLE_TYPES = [
  {type:'平ボディ', cap:[2,4,10]}, {type:'ウィング', cap:[4,10]},
  {type:'冷蔵',     cap:[2,4]},    {type:'冷凍',     cap:[2,4]},
  {type:'箱',       cap:[2,4]},
];
const _DND_INIT_DRIVERS = drivers.map((d, i) => {
  const v = vehicles[i];
  const obj = {
    id: v ? v.id : ('V' + String(i).padStart(4, '0')),  // 旧コードは 'V'+vehicleNum 形式を期待
    driver: d.name,
    vehicle: v ? `${v.plate} (${v.ton}t)` : '—',
    maxLoad: v ? v.maxLoad : 0,
    type: v ? v.type : '平ボディ',
    preset: [],
    // 新マスタへの参照（将来の置換用）
    _driverId: d.id,
    _vehicleId: v ? v.id : null
  };
  if (d.partner) {
    obj.partner = true;
    obj.partnerName = d.partnerName;
  }
  return obj;
});

const dndDrivers = _DND_INIT_DRIVERS;

// ── 日付管理ヘルパー ──
function dndDateKey(d) {
  // ローカルタイムの YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function dndToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function dndAddDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}
const DND_DATE_RANGE = 365; // 前後365日（月ナビゲーションをサポート）
const DND_STRIP_RANGE = 7;  // 日付ストリップ（前後の日付チップ）の表示範囲

// 現在表示中の日付（オフセット：-7〜+7）
let dndDateOffset = 0;

function dndGetCurrentDate() {
  return dndAddDays(dndToday(), dndDateOffset);
}
function dndGetCurrentDateKey() {
  return dndDateKey(dndGetCurrentDate());
}

// 割当状態: { driverId: { 'YYYY-MM-DD': [{caseId, start, end, ...}], ... }, ... }
let dndAssignments = {};
dndDrivers.forEach(d => {
  dndAssignments[d.id] = {};
  // presetは「今日」の固定便として配置
  const todayKey = dndDateKey(dndToday());
  if (d.preset && d.preset.length > 0) {
    dndAssignments[d.id][todayKey] = d.preset.map(p => ({ ...p, isPreset:true }));
  }
});

// ── プリセット：いくつかの未割当案件を「すでに配車済み」として配置 ──
// 配車割当ページが「既に運用中」のリアルな状態を見せるためのデモデータ
(function _prePopulateAssignments() {
  const todayKey = dndDateKey(dndToday());

  // 配車プラン：caseId（dndUnassignedCases.id）と割当先（driverIdxまたはdriverId）と時間帯
  // driverIdx = dndDrivers配列のインデックス
  // confirmed: true で「配車確定済み（処理済み）」状態
  const plan = [
    // 既存の重要案件（D-001〜D-008）を5件配車
    { caseId:'D-001', driverIdx:0,  start:'09:20', end:'12:20', confirmed:true }, // 山田一郎 → ○○商事 (確定済み)
    { caseId:'D-002', driverIdx:3,  start:'10:00', end:'14:00', confirmed:true }, // 田中四郎 → △△食品 (確定済み)
    { caseId:'D-005', driverIdx:1,  start:'09:00', end:'12:00' }, // 鈴木次郎 → ○○商事(処理中)
    { caseId:'D-006', driverIdx:7,  start:'11:00', end:'16:00' }, // 中村八郎 → 南関東物流
    { caseId:'D-007', driverIdx:5,  start:'11:00', end:'16:00' }, // 渡辺六郎 → 東日本電子工業

    // 自動生成案件から10件を割当（D-009以降）
    { caseId:'D-009', driverIdx:10, start:'06:00', end:'10:00', confirmed:true },
    { caseId:'D-012', driverIdx:14, start:'09:00', end:'13:00', confirmed:true },
    { caseId:'D-015', driverIdx:17, start:'12:00', end:'15:00' },
    { caseId:'D-018', driverIdx:20, start:'15:00', end:'19:00' },
    { caseId:'D-021', driverIdx:22, start:'06:00', end:'11:00', confirmed:true },
    { caseId:'D-024', driverIdx:26, start:'09:00', end:'14:00' },
    { caseId:'D-027', driverIdx:30, start:'12:00', end:'17:00', confirmed:true },
    { caseId:'D-030', driverIdx:33, start:'15:00', end:'18:00' },
    { caseId:'D-033', driverIdx:36, start:'07:00', end:'11:00' },
    { caseId:'D-036', driverIdx:40, start:'10:00', end:'14:00', confirmed:true },
    { caseId:'D-040', driverIdx:44, start:'13:00', end:'17:00' },

    // 1日2件配車のドライバー（複数案件持ち）
    { caseId:'D-013', driverIdx:0,  start:'13:30', end:'17:00' }, // 山田一郎 2件目
    { caseId:'D-020', driverIdx:3,  start:'15:00', end:'18:00' }, // 田中四郎 2件目
  ];

  plan.forEach(p => {
    const caseObj = (typeof dndUnassignedCases !== 'undefined')
      ? dndUnassignedCases.find(c => c.id === p.caseId)
      : null;
    if (!caseObj) return;
    const driver = (p.driverId)
      ? dndDrivers.find(d => d.id === p.driverId)
      : dndDrivers[p.driverIdx];
    if (!driver) return;

    if (!dndAssignments[driver.id][todayKey]) dndAssignments[driver.id][todayKey] = [];

    // ラベル整形
    const label = caseObj.client.length > 8
      ? caseObj.client.substring(0, 7) + '…'
      : caseObj.client;
    const sub = caseObj.from.replace(/.*?[都道府県]/, '').substring(0, 3)
              + '→'
              + caseObj.to.replace(/.*?[都道府県]/, '').substring(0, 3);

    dndAssignments[driver.id][todayKey].push((function() {
      // ★積荷時間セグメント計算（プリセット投入分にも適用）
      const loadMin   = (caseObj.loadMin   != null) ? caseObj.loadMin   : 30;
      const unloadMin = (caseObj.unloadMin != null) ? caseObj.unloadMin : 30;
      const _toMin = (t) => { const [h,m]=t.split(':').map(Number); return h*60+m; };
      const _fmt   = (m) => String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0');
      const totalMin = _toMin(p.end) - _toMin(p.start);
      let driveMin = totalMin - loadMin - unloadMin;
      if (driveMin < 15) driveMin = 15;
      const loadStartMin = _toMin(p.start);
      const loadEndMin   = loadStartMin + loadMin;
      const driveEndMin  = loadEndMin + driveMin;
      const unloadEndMin = driveEndMin + unloadMin;

      return {
        caseId: caseObj.id,
        caseListId: caseObj.caseListId || null,
        client: caseObj.client,
        from: caseObj.from,
        to: caseObj.to,
        goods: caseObj.goods,
        deadline: caseObj.deadline,
        urgent: caseObj.urgent,
        label: label,
        sub: sub,
        start: p.start,
        end: p.end,
        // ★積荷時間セグメント
        loadStart: _fmt(loadStartMin),
        loadEnd:   _fmt(loadEndMin),
        driveEnd:  _fmt(driveEndMin),
        unloadEnd: _fmt(unloadEndMin),
        loadMin:   loadMin,
        driveMin:  driveMin,
        unloadMin: unloadMin,
        color: caseObj.color || '#1a7a5e',
        isPreset: false,
        confirmed: !!p.confirmed,
        confirmedAt: p.confirmed ? new Date().toISOString() : null,
      };
    })());
  });

  // 開始時刻順にソート
  Object.keys(dndAssignments).forEach(did => {
    if (dndAssignments[did][todayKey]) {
      dndAssignments[did][todayKey].sort(function(a, b) {
        const [ah, am] = a.start.split(':').map(Number);
        const [bh, bm] = b.start.split(':').map(Number);
        return (ah * 60 + am) - (bh * 60 + bm);
      });
    }
  });

  // ── 担当外案件の未確定 → 確定済みに（サンプル初期状態の調整） ──
  // 「自分(me)」が担当しないドライバーに割当てられた未確定の運行を、
  // 既に確定された他者の作業として表現するため confirmed:true にする。
  // 担当割当ロジック（後段の driverOwners 生成IIFEと同じ）をここでもシミュレート。
  const MEMBER_IDS = ['me', 'u2', 'u3', 'u4'];
  function _previewOwnerOf(driverIndex) {
    // 担当未設定パターン（i % 17 === 13）はオーナーなし
    if (driverIndex % 17 === 13) return null;
    return MEMBER_IDS[driverIndex % MEMBER_IDS.length];
  }
  const nowIso = new Date().toISOString();
  dndDrivers.forEach((drv, idx) => {
    const ownerId = _previewOwnerOf(idx);
    // 「担当外」= 自分(me)以外（未割当ドライバーは "担当外" に含めない＝ そのまま）
    if (!ownerId || ownerId === 'me') return;
    const arr = (dndAssignments[drv.id] && dndAssignments[drv.id][todayKey]) || [];
    arr.forEach(a => {
      if (a.isPreset) return;       // 固定便はそのまま
      if (a.confirmed) return;       // 既に確定済みはそのまま
      a.confirmed = true;
      a.confirmedAt = nowIso;
    });
  });
})();

// ═══════════════════════════════════════════════════════════════════
// ★M1: マイグレーション — 既存データから cases/jobs/steps を構築
// ═══════════════════════════════════════════════════════════════════
// 既存の dndUnassignedCases と dndAssignments[did][date][] からの読み取り。
// この時点で _prePopulateAssignments() が完了しており、初期配車も入っている。
(function _migrateExistingDataToJobs() {
  // ── ステップ1: 案件マスタ (cases[]) を生成 ──────────────────────────
  if (typeof dndUnassignedCases === 'undefined') return;

  dndUnassignedCases.forEach(c => {
    cases.push({
      id: c.id,
      caseListId: c.caseListId || null,
      client: c.client,
      from: c.from,
      to: c.to,
      goods: c.goods,
      deadline: c.deadline,
      durationH: c.durationH,
      preferredStart: c.preferredStart,
      urgent: c.urgent,
      color: c.color,
      // 算出済み積荷時間（S1-S4で埋めた値）
      loadMin: c.loadMin,
      driveMin: c.driveMin,
      unloadMin: c.unloadMin,
      durationSource: c.durationSource,
      status: 'planned', // 'draft' | 'planned' | 'in_progress' | 'completed' | 'cancelled'
      _migratedFrom: 'dndUnassignedCases',
    });
  });

  // ── ステップ2: 既存ブロックを jobs[]/steps[] に変換 ──────────────────
  // dndAssignments[driverId][dateKey][i] の各ブロック → JOB 1件 + STEP 1〜3件
  Object.keys(dndAssignments).forEach(driverId => {
    const byDate = dndAssignments[driverId] || {};
    Object.keys(byDate).forEach(dateKey => {
      const blocks = byDate[dateKey] || [];
      blocks.forEach((block, blockIdx) => {
        // jobId を割り当て。caseId をベースにする。プリセットは独自ID
        let baseId;
        if (block.isPreset) {
          baseId = `PRESET-${driverId}-${dateKey}-${blockIdx}`;
        } else if (block.caseId) {
          baseId = block.caseId;
        } else {
          baseId = `UNKNOWN-${driverId}-${dateKey}-${blockIdx}`;
        }
        // 同じcaseIdで複数ブロック（複数日配車）の場合は連番
        const existingForCase = jobs.filter(j => j.caseId === baseId).length;
        const seqNo = existingForCase + 1;
        const jobId = _newJobId(baseId, seqNo);

        // JOB レコードを構築
        const startIso = combineToIsoDateTime(dateKey, block.start);
        // 日跨ぎは現状の dndAssignments には存在しない（HH:MMだけなので）
        // end が start より早ければ翌日とみなす（既存データはこのケース無いはず）
        let endDateKey = dateKey;
        if (block.end < block.start) {
          // 翌日扱い
          const d = new Date(dateKey + 'T00:00:00');
          d.setDate(d.getDate() + 1);
          endDateKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        }
        const endIso = combineToIsoDateTime(endDateKey, block.end);

        // role の判定：プリセットは preset_fixed、それ以外は pickup_delivery（当日完結）
        const role = block.isPreset ? 'preset_fixed' : 'pickup_delivery';

        const job = {
          jobId,
          caseId: block.isPreset ? null : block.caseId,
          caseListId: block.caseListId || null,
          sequenceNo: seqNo,
          driverId,
          startDateTime: startIso,
          endDateTime: endIso,
          role,
          nextJobId: null,        // M1時点では単発のみ → 連結は無し
          handoffType: 'none',
          handoffLocation: null,
          // 既存ブロックの属性を保持（表示で使う）
          color: block.color,
          isPreset: !!block.isPreset,
          confirmed: !!block.confirmed,
          confirmedAt: block.confirmedAt || null,
          locked: !!block.locked,
          // 引き継ぎ用：このjobに対応するblockへの参照（M2で逆引き同期に使う）
          _sourceBlockRef: { driverId, dateKey, blockIdx },
          _migratedFrom: 'dndAssignments',
        };

        // 既存ブロックに jobId を埋め込む（双方向参照）
        block.jobId = jobId;

        jobs.push(job);

        // STEP レコードを構築
        // S1-S4 で埋めた loadStart/loadEnd/driveEnd/unloadEnd があれば活用
        const stepOrder = [];
        if (block.loadStart && block.loadEnd && block.loadMin > 0) {
          stepOrder.push({
            stepType: 'load',
            stepStart: combineToIsoDateTime(dateKey, block.loadStart),
            stepEnd:   combineToIsoDateTime(dateKey, block.loadEnd),
            durationMin: block.loadMin,
          });
        }
        if (block.loadEnd && block.driveEnd && block.driveMin > 0) {
          stepOrder.push({
            stepType: 'drive',
            stepStart: combineToIsoDateTime(dateKey, block.loadEnd),
            stepEnd:   combineToIsoDateTime(dateKey, block.driveEnd),
            durationMin: block.driveMin,
          });
        }
        if (block.driveEnd && block.unloadEnd && block.unloadMin > 0) {
          stepOrder.push({
            stepType: 'unload',
            stepStart: combineToIsoDateTime(dateKey, block.driveEnd),
            stepEnd:   combineToIsoDateTime(dateKey, block.unloadEnd),
            durationMin: block.unloadMin,
          });
        }
        // S1-S4 のデータが無い場合（presetなど）はブロック全体を単一stepで
        if (stepOrder.length === 0) {
          const dur = (() => {
            const [sh, sm] = block.start.split(':').map(Number);
            const [eh, em] = block.end.split(':').map(Number);
            return (eh*60 + em) - (sh*60 + sm);
          })();
          stepOrder.push({
            stepType: block.isPreset ? 'fixed_route' : 'drive',
            stepStart: startIso,
            stepEnd:   endIso,
            durationMin: dur,
          });
        }

        stepOrder.forEach((s, ord) => {
          steps.push({
            stepId: _newStepId(jobId, ord + 1),
            jobId,
            orderNo: ord + 1,
            stepType: s.stepType,
            stepStart: s.stepStart,
            stepEnd: s.stepEnd,
            durationMin: s.durationMin,
          });
        });
      });
    });
  });

  // ── ステップ3: 整合性チェック（コンソールにサマリーを出す） ──────────
  console.log(`[M1 Migration] cases: ${cases.length}, jobs: ${jobs.length}, steps: ${steps.length}`);
})();

// ═══════════════════════════════════════════════════════════════════
// ★M8: 既存 legs[] / _isRelayLeg の jobs[] への統合
// ═══════════════════════════════════════════════════════════════════
// 既存案件オブジェクトに残っている c.legs[] (複数台モード・リレーモード) を
// jobs[] にも複製変換する。既存の c.legs[] 自体は破棄せず、現存の描画コード
// (c.legs.length 等を直接参照する箇所が多数) は無修正で動き続ける。
//
// 設計判断: 「双方向同期」ではなく「起動時の一方向変換」のみ実装する。
// 以降の編集は M6 のジョブ分割モーダル経由で行う前提。
// 既存の「複数台モード」「リレー輸送」の編集 UI で c.legs が更新される
// ケースは jobs[] 側に反映されないが、現時点では運用上の混乱は無い
// （描画は今まで通り動き、新スキーマ側ジョブ表示は併存する）。

(function _migrateLegsToJobs() {
  if (typeof dndUnassignedCases === 'undefined') return;
  let convertedCases = 0;
  let createdJobs = 0;

  dndUnassignedCases.forEach(c => {
    // legs 配列が無い、または空 → スキップ
    if (!Array.isArray(c.legs) || c.legs.length === 0) return;
    // 既に jobs[] に同 caseId のジョブがある場合 → 重複生成回避
    if (jobs.some(j => j.caseId === c.id)) return;

    const mode = c.vehicleMode || 'single';
    const isMulti = mode === 'multi';
    const isRelay = mode === 'relay';

    if (!isMulti && !isRelay) return;

    // 基準日：その案件の preferredStart や、なければ今日
    const baseDate = (function(){
      const d = (typeof dndToday === 'function') ? dndToday() : new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    })();

    c.legs.forEach((leg, legIdx) => {
      // sequenceNo:
      //   multi → 全 leg を同じ番号 (並行)
      //   relay → leg ごとに連番 (直列)
      const seqNo = isMulti ? 1 : (legIdx + 1);
      const jobId = _newJobId(c.id, isMulti ? `M${legIdx+1}` : (legIdx+1));

      // leg にある時刻 (relayStartTime / relayEndTime) があれば使い、無ければ
      // preferredStart からシフト
      let startHHMM = leg.relayStartTime || leg.startTime || c.preferredStart || '09:00';
      let endHHMM = leg.relayEndTime || leg.endTime || null;
      let startIso, endIso;
      startIso = combineToIsoDateTime(baseDate, startHHMM);
      if (endHHMM) {
        endIso = combineToIsoDateTime(baseDate, endHHMM);
        // 日跨ぎ判定 (end < start なら翌日)
        if (endHHMM < startHHMM) {
          const d = new Date(baseDate + 'T00:00:00');
          d.setDate(d.getDate() + 1);
          const nextDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          endIso = combineToIsoDateTime(nextDate, endHHMM);
        }
      } else {
        // 終了時刻不明 → durationH/legDurationH から計算
        const dur = leg.legDurationH || (c.durationH ? c.durationH / c.legs.length : 3);
        endIso = isoAddMinutes(startIso, Math.round(dur * 60));
      }

      // ドライバー解決：leg.vehicleId or leg.driverId → dndDrivers から照合
      let driverId = leg.driverId || null;
      if (!driverId && leg.vehicleId && typeof dndDrivers !== 'undefined') {
        const drv = dndDrivers.find(d => d.id === leg.vehicleId);
        if (drv) driverId = drv.id;
      }
      if (!driverId && leg.driverName && typeof dndDrivers !== 'undefined') {
        const drv = dndDrivers.find(d => d.driver === leg.driverName);
        if (drv) driverId = drv.id;
      }

      // 役割と引き継ぎ
      let role, handoffType, handoffLocation;
      if (isMulti) {
        role = 'pickup_delivery';
        handoffType = 'parallel';
        handoffLocation = null;
      } else {
        // relay
        if (legIdx === 0) {
          role = 'relay_leg';
          handoffType = 'driver_swap';
          handoffLocation = leg.relayTo || null;
        } else if (legIdx === c.legs.length - 1) {
          role = 'relay_leg';
          handoffType = 'none';
          handoffLocation = null;
        } else {
          role = 'relay_leg';
          handoffType = 'driver_swap';
          handoffLocation = leg.relayTo || null;
        }
      }

      const job = {
        jobId,
        caseId: c.id,
        caseListId: c.caseListId || null,
        sequenceNo: seqNo,
        driverId,
        startDateTime: startIso,
        endDateTime:   endIso,
        role,
        nextJobId: null,  // 後で連結
        handoffType,
        handoffLocation,
        color: c.color || '#1a7a5e',
        isPreset: false,
        confirmed: false,
        confirmedAt: null,
        locked: false,
        _createdAt: new Date().toISOString(),
        _migratedFromLegs: true,
        _legIdx: legIdx,
      };
      jobs.push(job);
      createdJobs++;

      // ステップは簡略化：1つの drive step として登録
      const durMin = Math.round((new Date(endIso) - new Date(startIso)) / 60000);
      steps.push({
        stepId: _newStepId(jobId, 1),
        jobId, orderNo: 1, stepType: 'drive',
        stepStart: startIso, stepEnd: endIso,
        durationMin: durMin,
      });
    });

    // relay: 直列ジョブの nextJobId を再連結
    if (isRelay) {
      const myJobs = jobs.filter(j => j.caseId === c.id && j._migratedFromLegs)
        .sort((a, b) => a.sequenceNo - b.sequenceNo);
      for (let i = 0; i < myJobs.length - 1; i++) {
        myJobs[i].nextJobId = myJobs[i+1].jobId;
      }
    }
    // multi: 並行ジョブなので nextJobId は不要 (handoffType=parallel)
    convertedCases++;
  });

  if (convertedCases > 0) {
    console.log(`[M8 Migration] ${convertedCases} cases (legs/relay) → ${createdJobs} jobs converted`);
  }
})();

// ═══════════════════════════════════════════════════════════════════
// ★M2: 派生ビュー同期 — jobs[] から dndAssignments を再構築
// ═══════════════════════════════════════════════════════════════════
// jobs[] を真のソースとし、書き込み時にこの関数を呼んで dndAssignments を
// 再構築する。既存コード（76箇所が dndAssignments を直接参照）が無修正で
// 動き続けることを保証する。
//
// 重要：dndAssignments は新しいオブジェクトに差し替えるのではなく、
// 「既存のキーをクリアして新しいキーを書き込む」方式で in-place 更新する。
// これにより、既存コードが `dndAssignments[driverId]` を変数にキャッシュ
// していても壊れない（参照は同じ）。

function rebuildDndAssignmentsFromJobs() {
  // 全ドライバーのスロットを準備（既存キーは保持しつつ、各日付配列はクリア）
  if (typeof dndDrivers === 'undefined') return;

  dndDrivers.forEach(d => {
    if (!dndAssignments[d.id]) dndAssignments[d.id] = {};
  });

  // 既存の全日付配列をクリア（in-place）
  Object.keys(dndAssignments).forEach(driverId => {
    const byDate = dndAssignments[driverId];
    Object.keys(byDate).forEach(dateKey => {
      // 配列は length=0 で in-place クリア（参照を保つ）
      byDate[dateKey].length = 0;
    });
  });

  // jobs[] からブロックを生成して詰める
  jobs.forEach(job => {
    if (!job.driverId) return;
    if (!dndAssignments[job.driverId]) dndAssignments[job.driverId] = {};

    // ★M4: 日跨ぎジョブの場合、本体ブロック + ゴーストブロック の2つを返すことがある
    const blocks = _buildBlocksFromJob(job);
    if (!blocks || blocks.length === 0) return;

    blocks.forEach(block => {
      const dateKey = block._dateKey;
      delete block._dateKey;  // 補助フィールドはブロックに含めない

      if (!dndAssignments[job.driverId][dateKey]) {
        dndAssignments[job.driverId][dateKey] = [];
      }
      dndAssignments[job.driverId][dateKey].push(block);
    });
  });

  // 各日付の配列を start 昇順でソート
  Object.keys(dndAssignments).forEach(driverId => {
    const byDate = dndAssignments[driverId];
    Object.keys(byDate).forEach(dateKey => {
      byDate[dateKey].sort((a, b) => {
        const [ah, am] = a.start.split(':').map(Number);
        const [bh, bm] = b.start.split(':').map(Number);
        return (ah * 60 + am) - (bh * 60 + bm);
      });
    });
  });
}

// ★M4: 1つのジョブから1つまたは2つの表示ブロックを生成
// - 同日内ジョブ: 1個（従来通り）
// - 日跨ぎジョブ: 2個（本体[開始日] + ゴースト[終了日]）
function _buildBlocksFromJob(job) {
  const startDateKey = extractDateKey(job.startDateTime);
  const endDateKey   = extractDateKey(job.endDateTime);
  const isMultiDay = startDateKey !== endDateKey;

  if (!isMultiDay) {
    // 同日完結：従来通り1ブロック
    const block = _buildBlockFromJob(job);
    return block ? [block] : [];
  }

  // 日跨ぎ：本体（開始日） + ゴースト（終了日）の2ブロック
  const primaryBlock = _buildBlockFromJob(job, { displayMode: 'primary' });
  const ghostBlock   = _buildBlockFromJob(job, { displayMode: 'ghost' });

  const result = [];
  if (primaryBlock) result.push(primaryBlock);
  if (ghostBlock) result.push(ghostBlock);
  return result;
}

// JOB 1件 → 既存形式のブロック1件を生成
// opts.displayMode: undefined | 'primary' | 'ghost'
//   - undefined : 同日完結ジョブ
//   - 'primary' : 日跨ぎジョブの本体（開始日のセルに、end='24:00'で表示）
//   - 'ghost'   : 日跨ぎジョブのゴースト（終了日のセルに、start='00:00'で表示。クリック不可）
function _buildBlockFromJob(job, opts) {
  opts = opts || {};
  // 該当の cases/steps を取得
  const c = cases.find(x => x.id === job.caseId);
  const jobSteps = steps.filter(s => s.jobId === job.jobId).sort((a,b) => a.orderNo - b.orderNo);

  // 表示用に start/end は HH:MM 形式
  const startDateKey = extractDateKey(job.startDateTime);
  const endDateKey   = extractDateKey(job.endDateTime);
  const isMultiDay = startDateKey !== endDateKey;

  // 表示する日付セル・start/end を displayMode に応じて決定
  let displayDateKey, displayStart, displayEnd;
  if (opts.displayMode === 'ghost') {
    // ゴースト：終了日のセルに 00:00〜endHHMM で配置
    displayDateKey = endDateKey;
    displayStart = '00:00';
    displayEnd   = extractHHMM(job.endDateTime);
  } else if (opts.displayMode === 'primary' || isMultiDay) {
    // 本体（日跨ぎ時）：開始日のセルに startHHMM〜24:00 で配置
    displayDateKey = startDateKey;
    displayStart = extractHHMM(job.startDateTime);
    displayEnd   = '24:00';
  } else {
    // 同日完結
    displayDateKey = startDateKey;
    displayStart = extractHHMM(job.startDateTime);
    displayEnd   = extractHHMM(job.endDateTime);
  }

  // セグメント情報を steps から計算（S1-S4互換）
  // ★日跨ぎ時のセグメントは表示日付に該当する分だけ算出
  let loadStart = null, loadEnd = null, driveEnd = null, unloadEnd = null;
  let loadMin = 0, driveMin = 0, unloadMin = 0;

  if (!isMultiDay) {
    // 同日完結：従来通り全工程をブロック内に描画
    const loadStep   = jobSteps.find(s => s.stepType === 'load');
    const driveStep  = jobSteps.find(s => s.stepType === 'drive');
    const unloadStep = jobSteps.find(s => s.stepType === 'unload');
    if (loadStep) {
      loadStart = extractHHMM(loadStep.stepStart);
      loadEnd   = extractHHMM(loadStep.stepEnd);
      loadMin   = loadStep.durationMin;
    } else {
      loadStart = displayStart; loadEnd = displayStart;
    }
    if (driveStep) {
      driveEnd = extractHHMM(driveStep.stepEnd);
      driveMin = driveStep.durationMin;
    } else { driveEnd = loadEnd; }
    if (unloadStep) {
      unloadEnd = extractHHMM(unloadStep.stepEnd);
      unloadMin = unloadStep.durationMin;
    } else { unloadEnd = driveEnd; }
  } else {
    // 日跨ぎ：このブロックが表示する範囲のセグメントを切り出す
    // ★単純化：日跨ぎ時はセグメント分割を表示しない（バー全体を素色で）
    // 詳細な工程はツールチップと個別案件処理の縦タイムラインで見せる
    loadStart = displayStart;
    loadEnd   = displayStart;
    driveEnd  = displayEnd;
    unloadEnd = displayEnd;
    loadMin = 0; driveMin = 0; unloadMin = 0;
  }

  // ラベル整形（既存ロジックと同じ）
  const client = (c && c.client) || (job.isPreset ? 'プリセット' : '—');
  const from   = (c && c.from)   || '';
  const to     = (c && c.to)     || '';
  const goods  = (c && c.goods)  || '';
  const deadline = (c && c.deadline) || '';
  const urgent = (c && c.urgent) || false;
  const label = client.length > 8 ? client.substring(0, 7) + '…' : client;
  const sub   = from && to
    ? (from.replace(/.*?[都道府県]/, '').substring(0, 3) + '→' + to.replace(/.*?[都道府県]/, '').substring(0, 3))
    : '';

  return {
    // 旧来のブロック形式（既存コード互換）
    jobId: job.jobId,
    caseId: job.caseId,
    caseListId: job.caseListId,
    client, from, to, goods, deadline, urgent,
    label, sub,
    start: displayStart,
    end:   displayEnd,
    // セグメント（S1-S4互換）
    loadStart, loadEnd, driveEnd, unloadEnd,
    loadMin, driveMin, unloadMin,
    color: job.color || (c && c.color) || '#1a7a5e',
    isPreset: !!job.isPreset,
    confirmed: !!job.confirmed,
    confirmedAt: job.confirmedAt,
    locked: !!job.locked,
    // ★M4: 日跨ぎ表示マーカー（描画で参照）
    _multiDayMarker: {
      isMultiDay: isMultiDay,
      displayMode: opts.displayMode || (isMultiDay ? 'primary' : 'normal'),
      isGhost: opts.displayMode === 'ghost',
      continuesToNextDay: isMultiDay && opts.displayMode !== 'ghost',
      continuesFromPrevDay: isMultiDay && opts.displayMode === 'ghost',
      continuesFromPrevJob: !!findPrevJobInCase(job),
      continuesToNextJob: !!job.nextJobId,
      sequenceCurrent: job.sequenceNo,
      sequenceTotal: countJobsInCase(job.caseId),
      // 元のジョブの全時刻（ツールチップで表示するため）
      jobStartDateTime: job.startDateTime,
      jobEndDateTime: job.endDateTime,
    },
    // 内部用：どの日付セルに置くか
    _dateKey: displayDateKey,
  };
}

function findPrevJobInCase(job) {
  if (!job.caseId) return null;
  return jobs.find(j => j.nextJobId === job.jobId) || null;
}

function countJobsInCase(caseId) {
  if (!caseId) return 1;
  return jobs.filter(j => j.caseId === caseId).length;
}

window.rebuildDndAssignmentsFromJobs = rebuildDndAssignmentsFromJobs;
window._buildBlockFromJob = _buildBlockFromJob;
window._buildBlocksFromJob = _buildBlocksFromJob;
window.findPrevJobInCase = findPrevJobInCase;
window.countJobsInCase = countJobsInCase;

// ═══════════════════════════════════════════════════════════════════
// ★M3: 書き込みパスの新スキーマ同期API
// ═══════════════════════════════════════════════════════════════════
// dndTrackDrop（ドラッグドロップ）と dndRemoveAssignment（割当解除）の
// 既存処理を活かしつつ、jobs[]/steps[] にも同じ変更を反映する。
//
// 設計判断: 既存の `dndAssignments[driverId][dateKey].push(block)` は
// そのまま動かす（76箇所が依存）。ブロック追加直後に addJobFromBlock を
// 呼んで jobs/steps を整合させる方式。
//
// 完全置き換え（jobs[]を真にして dndAssignments を Pure View にする）は
// M5 以降の段階で実施。M3 では「読みも書きも両方で整合する」状態を作る。

// ブロックから新規 JOB+STEPS を生成して jobs[]/steps[] に追加
// 既にブロックに jobId が振られていればそれを使い、無ければ新規発番
function addJobFromBlock(block, driverId, dateKey) {
  if (!block) return null;

  // 既にこのブロックに jobId があれば既存ジョブを更新（重複追加しない）
  if (block.jobId) {
    const existing = jobs.find(j => j.jobId === block.jobId);
    if (existing) {
      _syncJobFromBlock(existing, block, driverId, dateKey);
      _syncStepsFromBlock(existing.jobId, block, dateKey);
      return existing;
    }
  }

  // 新規発番：同じ caseId のジョブが既にあれば連番、なければ J1
  const baseId = block.caseId || `ANON-${driverId}-${dateKey}-${Date.now()}`;
  const existingCount = jobs.filter(j => j.caseId === block.caseId).length;
  const seqNo = existingCount + 1;
  const jobId = _newJobId(baseId, seqNo);

  // ブロックに jobId を埋め込む（双方向参照）
  block.jobId = jobId;

  const job = {
    jobId,
    caseId: block.caseId || null,
    caseListId: block.caseListId || null,
    sequenceNo: seqNo,
    driverId,
    startDateTime: combineToIsoDateTime(dateKey, block.start),
    endDateTime:   combineToIsoDateTime(dateKey, block.end),
    role: 'pickup_delivery',  // M3時点で新規追加はすべて当日完結。日跨ぎはM4以降
    nextJobId: null,
    handoffType: 'none',
    handoffLocation: null,
    color: block.color,
    isPreset: !!block.isPreset,
    confirmed: !!block.confirmed,
    confirmedAt: block.confirmedAt || null,
    locked: !!block.locked,
    _createdAt: new Date().toISOString(),
  };
  jobs.push(job);

  // STEPS も追加
  _syncStepsFromBlock(jobId, block, dateKey);

  return job;
}

// 既存ジョブのフィールドをブロックに合わせて更新（移動・編集時用）
function _syncJobFromBlock(job, block, driverId, dateKey) {
  job.driverId = driverId;
  job.startDateTime = combineToIsoDateTime(dateKey, block.start);
  job.endDateTime   = combineToIsoDateTime(dateKey, block.end);
  job.color = block.color;
  job.confirmed = !!block.confirmed;
  job.confirmedAt = block.confirmedAt || null;
  job.locked = !!block.locked;
}

// ブロックのセグメント情報から STEPS を再生成（既存のものを削除して入れ直し）
function _syncStepsFromBlock(jobId, block, dateKey) {
  // 既存ステップを削除
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].jobId === jobId) steps.splice(i, 1);
  }
  // 新規ステップを追加
  let ord = 1;
  if (block.loadStart && block.loadEnd && block.loadMin > 0) {
    steps.push({
      stepId: _newStepId(jobId, ord++),
      jobId,
      orderNo: ord - 1,
      stepType: 'load',
      stepStart: combineToIsoDateTime(dateKey, block.loadStart),
      stepEnd:   combineToIsoDateTime(dateKey, block.loadEnd),
      durationMin: block.loadMin,
    });
  }
  if (block.loadEnd && block.driveEnd && block.driveMin > 0) {
    steps.push({
      stepId: _newStepId(jobId, ord++),
      jobId,
      orderNo: ord - 1,
      stepType: 'drive',
      stepStart: combineToIsoDateTime(dateKey, block.loadEnd),
      stepEnd:   combineToIsoDateTime(dateKey, block.driveEnd),
      durationMin: block.driveMin,
    });
  }
  if (block.driveEnd && block.unloadEnd && block.unloadMin > 0) {
    steps.push({
      stepId: _newStepId(jobId, ord++),
      jobId,
      orderNo: ord - 1,
      stepType: 'unload',
      stepStart: combineToIsoDateTime(dateKey, block.driveEnd),
      stepEnd:   combineToIsoDateTime(dateKey, block.unloadEnd),
      durationMin: block.unloadMin,
    });
  }
  if (ord === 1) {
    // セグメントが取れない場合：ブロック全体を1つの drive step として扱う
    steps.push({
      stepId: _newStepId(jobId, 1),
      jobId,
      orderNo: 1,
      stepType: 'drive',
      stepStart: combineToIsoDateTime(dateKey, block.start),
      stepEnd:   combineToIsoDateTime(dateKey, block.end),
      durationMin: 0,
    });
  }
}

// jobId を指定して jobs[]/steps[] から削除
function removeJobByBlockRef(jobId) {
  if (!jobId) return;
  // 関連ステップを削除
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].jobId === jobId) steps.splice(i, 1);
  }
  // ジョブを削除
  const jobIdx = jobs.findIndex(j => j.jobId === jobId);
  if (jobIdx >= 0) {
    // 削除前に、このjobを nextJobId として指している他jobがあれば nextJobId をクリア
    jobs.forEach(other => {
      if (other.nextJobId === jobId) other.nextJobId = null;
    });
    jobs.splice(jobIdx, 1);
  }
}

window.addJobFromBlock = addJobFromBlock;
window.removeJobByBlockRef = removeJobByBlockRef;

// ── M3の整合性検証ヘルパー ──────────────────────────────────────────
// 「dndAssignmentsのブロック数」と「jobs[]の件数」が常に一致するか確認
function _verifyM3Sync() {
  let blockCount = 0;
  Object.keys(dndAssignments).forEach(did => {
    Object.keys(dndAssignments[did]).forEach(dk => {
      blockCount += (dndAssignments[did][dk] || []).length;
    });
  });
  const ok = (blockCount === jobs.length);
  if (!ok) {
    console.warn(`[M3 Verify] ⚠ dndAssignments blocks (${blockCount}) ≠ jobs.length (${jobs.length})`);
  }
  return ok;
}
window._verifyM3Sync = _verifyM3Sync;

// ═══════════════════════════════════════════════════════════════════
// ★M6: ジョブテンプレート定義（手動分解の補助）
// ═══════════════════════════════════════════════════════════════════
// 配車係が案件を複数ジョブに分割する際の出発点となるテンプレート。
// generator(caseObj, baseDate) は editingJobs 配列を返す。
// baseDate は基準日（YYYY-MM-DD）。各ジョブの日付は baseDate からの相対計算。

const JOB_TEMPLATES = [
  {
    id: 'single_day',
    label: '当日完結',
    description: '積込〜配達まで1日で完結する標準パターン',
    icon: '☀',
    generator: function(caseObj, baseDate) {
      const lm = caseObj.loadMin   || 30;
      const dm = caseObj.driveMin  || 120;
      const um = caseObj.unloadMin || 30;
      const startHHMM = (caseObj.preferredStart || '09:00');
      const endIso = isoAddMinutes(combineToIsoDateTime(baseDate, startHHMM), lm + dm + um);
      return [{
        sequenceNo: 1,
        startDateTime: combineToIsoDateTime(baseDate, startHHMM),
        endDateTime: endIso,
        role: 'pickup_delivery',
        nextJobId: null,
        handoffType: 'none',
        handoffLocation: null,
        loadMin: lm, driveMin: dm, unloadMin: um,
      }];
    },
  },
  {
    id: 'preload_next_day',
    label: '前日積込＋翌日配送',
    description: '夜のうちに積込、翌朝出発で配達',
    icon: '🌆',
    generator: function(caseObj, baseDate) {
      const lm = caseObj.loadMin   || 30;
      const dm = caseObj.driveMin  || 120;
      const um = caseObj.unloadMin || 30;
      // baseDate = 配達日。前日 = baseDate -1日
      const prevDate = (function(){
        const d = new Date(baseDate + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      })();
      return [
        {
          sequenceNo: 1,
          startDateTime: combineToIsoDateTime(prevDate, '18:00'),
          endDateTime:   combineToIsoDateTime(prevDate, _addMinHHMMpure('18:00', lm)),
          role: 'preload',
          handoffType: 'overnight_park',
          handoffLocation: '出発地デポ',
          loadMin: lm, driveMin: 0, unloadMin: 0,
        },
        {
          sequenceNo: 2,
          startDateTime: combineToIsoDateTime(baseDate, '07:00'),
          endDateTime:   combineToIsoDateTime(baseDate, _addMinHHMMpure('07:00', dm + um)),
          role: 'delivery',
          handoffType: 'none',
          handoffLocation: null,
          loadMin: 0, driveMin: dm, unloadMin: um,
        },
      ];
    },
  },
  {
    id: 'long_distance_3day',
    label: '長距離3日便',
    description: '前日積込 → 中間日走行 → 翌日配達',
    icon: '🚛',
    generator: function(caseObj, baseDate) {
      const lm = caseObj.loadMin   || 60;
      const um = caseObj.unloadMin || 30;
      // baseDate = 配達日。中間日 = -1日、積込日 = -2日
      const dt = (offset) => {
        const d = new Date(baseDate + 'T00:00:00');
        d.setDate(d.getDate() + offset);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      };
      const loadDate = dt(-2);
      const driveDate = dt(-1);
      const delivDate = baseDate;
      return [
        {
          sequenceNo: 1,
          startDateTime: combineToIsoDateTime(loadDate, '18:00'),
          endDateTime:   combineToIsoDateTime(loadDate, _addMinHHMMpure('18:00', lm)),
          role: 'preload',
          handoffType: 'overnight_park',
          handoffLocation: '出発地デポ',
          loadMin: lm, driveMin: 0, unloadMin: 0,
        },
        {
          sequenceNo: 2,
          startDateTime: combineToIsoDateTime(driveDate, '04:00'),
          endDateTime:   combineToIsoDateTime(driveDate, '20:00'),
          role: 'transport',
          handoffType: 'overnight_park',
          handoffLocation: '中継ターミナル',
          loadMin: 0, driveMin: 960, unloadMin: 0,
        },
        {
          sequenceNo: 3,
          startDateTime: combineToIsoDateTime(delivDate, '06:00'),
          endDateTime:   combineToIsoDateTime(delivDate, _addMinHHMMpure('06:00', 180 + um)),
          role: 'delivery',
          handoffType: 'none',
          handoffLocation: null,
          loadMin: 0, driveMin: 180, unloadMin: um,
        },
      ];
    },
  },
  {
    id: 'overnight_drive',
    label: '深夜便（日跨ぎ単発）',
    description: '夜出発、翌朝到着の1ジョブ',
    icon: '🌙',
    generator: function(caseObj, baseDate) {
      const lm = caseObj.loadMin   || 30;
      const dm = caseObj.driveMin  || 360;
      const um = caseObj.unloadMin || 30;
      // baseDate = 出発日（夜）。翌朝に着く。
      const prevEvening = combineToIsoDateTime(baseDate, '22:00');
      const endIso = isoAddMinutes(prevEvening, lm + dm + um);
      return [{
        sequenceNo: 1,
        startDateTime: prevEvening,
        endDateTime: endIso,
        role: 'pickup_delivery',
        handoffType: 'none',
        handoffLocation: null,
        loadMin: lm, driveMin: dm, unloadMin: um,
      }];
    },
  },
];

// テンプレ内で使う、純粋関数版の addMinHHMM（24時間超は丸める）
function _addMinHHMMpure(hhmm, m) {
  const [h, mm] = hhmm.split(':').map(Number);
  const total = (h * 60 + mm + m) % (24 * 60);
  const t = total < 0 ? total + 24*60 : total;
  return String(Math.floor(t/60)).padStart(2,'0') + ':' + String(t%60).padStart(2,'0');
}

window.JOB_TEMPLATES = JOB_TEMPLATES;

// ═══════════════════════════════════════════════════════════════════
// ★M6: ジョブ集合の置換API（モーダルからの「保存」用）
// ═══════════════════════════════════════════════════════════════════
// 1つの案件に対するジョブ群を、新しい構成で完全に置き換える。
//
// 動作:
//   1. 既存の jobs[]/steps[] からこの案件のものを削除
//   2. editingJobs を元に新規 jobs/steps を作成
//   3. nextJobId を再連結（実行順に従い）
//   4. dndAssignments を再構築

function replaceJobsForCase(caseId, caseListId, editingJobs) {
  if (!caseId && !caseListId) {
    throw new Error('replaceJobsForCase: caseId or caseListId is required');
  }

  // 1. 既存ジョブ削除（このcaseに紐付くもの全部）
  const matchCase = (j) =>
    (caseId && j.caseId === caseId) ||
    (caseListId && j.caseListId === caseListId);
  const targetJobIds = jobs.filter(matchCase).map(j => j.jobId);
  for (let i = steps.length - 1; i >= 0; i--) {
    if (targetJobIds.includes(steps[i].jobId)) steps.splice(i, 1);
  }
  for (let i = jobs.length - 1; i >= 0; i--) {
    if (matchCase(jobs[i])) jobs.splice(i, 1);
  }

  // 2. editingJobs を元に新規作成
  // sequenceNo 昇順、同じなら startDateTime 昇順
  editingJobs.sort((a, b) => {
    if (a.sequenceNo !== b.sequenceNo) return a.sequenceNo - b.sequenceNo;
    return (a.startDateTime || '').localeCompare(b.startDateTime || '');
  });

  // 案件マスタの参照（color 等を引くため）
  const caseObj = cases.find(c =>
    (caseId && c.id === caseId) || (caseListId && c.caseListId === caseListId)
  );

  const newJobIds = [];
  editingJobs.forEach((ej, idx) => {
    const seqNo = ej.sequenceNo || (idx + 1);
    const jobId = _newJobId(caseId || ('CASE-' + caseListId), seqNo);
    newJobIds.push(jobId);

    const job = {
      jobId,
      caseId: caseId || (caseObj && caseObj.id) || null,
      caseListId: caseListId || (caseObj && caseObj.caseListId) || null,
      sequenceNo: seqNo,
      driverId: ej.driverId || null,
      startDateTime: ej.startDateTime,
      endDateTime: ej.endDateTime,
      role: ej.role || 'pickup_delivery',
      nextJobId: null,  // 後で再連結
      handoffType: ej.handoffType || 'none',
      handoffLocation: ej.handoffLocation || null,
      color: (caseObj && caseObj.color) || '#1a7a5e',
      isPreset: false,
      confirmed: !!ej.confirmed,
      confirmedAt: ej.confirmedAt || null,
      locked: !!ej.locked,
      _createdAt: new Date().toISOString(),
    };
    jobs.push(job);

    // ステップを生成（テンプレ提供の loadMin/driveMin/unloadMin から）
    const startIso = ej.startDateTime;
    let cursor = startIso;
    let ord = 1;
    if (ej.loadMin > 0) {
      const endIso = isoAddMinutes(cursor, ej.loadMin);
      steps.push({
        stepId: _newStepId(jobId, ord++),
        jobId, orderNo: ord - 1, stepType: 'load',
        stepStart: cursor, stepEnd: endIso, durationMin: ej.loadMin,
      });
      cursor = endIso;
    }
    if (ej.driveMin > 0) {
      const endIso = isoAddMinutes(cursor, ej.driveMin);
      steps.push({
        stepId: _newStepId(jobId, ord++),
        jobId, orderNo: ord - 1, stepType: 'drive',
        stepStart: cursor, stepEnd: endIso, durationMin: ej.driveMin,
      });
      cursor = endIso;
    }
    if (ej.unloadMin > 0) {
      const endIso = isoAddMinutes(cursor, ej.unloadMin);
      steps.push({
        stepId: _newStepId(jobId, ord++),
        jobId, orderNo: ord - 1, stepType: 'unload',
        stepStart: cursor, stepEnd: endIso, durationMin: ej.unloadMin,
      });
    }
    // 全てゼロの場合（presetなど）：1つの drive step で全体を表現
    if (ord === 1) {
      steps.push({
        stepId: _newStepId(jobId, 1),
        jobId, orderNo: 1, stepType: 'drive',
        stepStart: ej.startDateTime, stepEnd: ej.endDateTime,
        durationMin: Math.round((new Date(ej.endDateTime) - new Date(ej.startDateTime)) / 60000),
      });
    }
  });

  // 3. nextJobId を再連結（順序に従って）
  for (let i = 0; i < newJobIds.length - 1; i++) {
    const j = jobs.find(x => x.jobId === newJobIds[i]);
    if (j) j.nextJobId = newJobIds[i + 1];
  }

  // 4. dndAssignments 再構築
  rebuildDndAssignmentsFromJobs();
}

window.replaceJobsForCase = replaceJobsForCase;

// テンプレートから editingJobs 候補を生成（モーダルで使う）
function generateJobsFromTemplate(templateId, caseObj, baseDate) {
  const tpl = JOB_TEMPLATES.find(t => t.id === templateId);
  if (!tpl) return null;
  return tpl.generator(caseObj, baseDate);
}
window.generateJobsFromTemplate = generateJobsFromTemplate;

// 編集中ジョブ群に対するバリデーション（警告として返す、エラーで保存はブロックしない）
function validateEditingJobs(editingJobs) {
  const warnings = [];

  // 必須チェック
  editingJobs.forEach((j, idx) => {
    if (!j.startDateTime || !j.endDateTime) {
      warnings.push({ level: 'error', jobIdx: idx, msg: 'ジョブ' + (idx+1) + ': 開始/終了時刻が未入力です' });
      return;
    }
    if (new Date(j.endDateTime) <= new Date(j.startDateTime)) {
      warnings.push({ level: 'error', jobIdx: idx, msg: 'ジョブ' + (idx+1) + ': 終了時刻が開始時刻と同じか前です' });
    }
    if (!j.driverId) {
      warnings.push({ level: 'warn', jobIdx: idx, msg: 'ジョブ' + (idx+1) + ': ドライバーが未割当です' });
    }
  });

  // 順序の整合性（sequenceNo昇順で時刻も昇順）
  const sorted = [...editingJobs].sort((a,b) => (a.sequenceNo||0) - (b.sequenceNo||0));
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i], nxt = sorted[i+1];
    if (!cur.endDateTime || !nxt.startDateTime) continue;
    if (new Date(nxt.startDateTime) < new Date(cur.endDateTime)) {
      warnings.push({
        level: 'warn',
        msg: `ジョブ${cur.sequenceNo}とジョブ${nxt.sequenceNo}の時刻が重複しています`
      });
    }
  }

  // 同じドライバーで時間重複（既存ジョブとも比較）
  editingJobs.forEach((ej, idx) => {
    if (!ej.driverId || !ej.startDateTime || !ej.endDateTime) return;
    const conflict = jobs.find(other => {
      if (!other.driverId || other.driverId !== ej.driverId) return false;
      // 編集中の自分自身は除外（caseIdが一致するもの全部）
      if (other.caseId && editingJobs[0] && editingJobs[0]._editingCaseId === other.caseId) return false;
      const oS = new Date(other.startDateTime);
      const oE = new Date(other.endDateTime);
      const eS = new Date(ej.startDateTime);
      const eE = new Date(ej.endDateTime);
      return oS < eE && eS < oE;
    });
    if (conflict) {
      warnings.push({
        level: 'warn',
        jobIdx: idx,
        msg: `ジョブ${ej.sequenceNo}: ${conflict.driverId} の既存配車（${conflict.jobId}）と時間が重複しています`
      });
    }
  });

  // ★M7: handoffType とドライバーの整合性チェック
  const sortedJ = [...editingJobs].sort((a,b) => (a.sequenceNo||0) - (b.sequenceNo||0));
  for (let i = 0; i < sortedJ.length - 1; i++) {
    const cur = sortedJ[i], nxt = sortedJ[i+1];
    const curIdx = editingJobs.indexOf(cur);
    if (!cur.driverId || !nxt.driverId) continue;

    const sameDriver = cur.driverId === nxt.driverId;
    const ht = cur.handoffType || 'none';

    if (!sameDriver && ht !== 'driver_swap' && ht !== 'depot_transfer' && ht !== 'parallel') {
      warnings.push({
        level: 'warn',
        jobIdx: curIdx,
        msg: `ジョブ${cur.sequenceNo}→${nxt.sequenceNo}: ドライバーが異なるのに引き継ぎが「${ht}」です（driver_swap推奨）`
      });
    }
    if (sameDriver && ht === 'driver_swap') {
      warnings.push({
        level: 'warn',
        jobIdx: curIdx,
        msg: `ジョブ${cur.sequenceNo}→${nxt.sequenceNo}: 同じドライバーなのに「ドライバー交代」になっています`
      });
    }

    // 日跨ぎ判定
    if (cur.endDateTime && nxt.startDateTime) {
      const curEndDate = cur.endDateTime.substring(0,10);
      const nxtStartDate = nxt.startDateTime.substring(0,10);
      const hasGap = curEndDate !== nxtStartDate;
      if (hasGap && sameDriver && ht === 'none') {
        warnings.push({
          level: 'warn',
          jobIdx: curIdx,
          msg: `ジョブ${cur.sequenceNo}→${nxt.sequenceNo}: 日付が変わるのに引き継ぎが「なし」です（overnight_park推奨）`
        });
      }
    }

    // 引き継ぎ地点の必須チェック
    if (ht !== 'none' && ht !== 'parallel' && !cur.handoffLocation) {
      warnings.push({
        level: 'warn',
        jobIdx: curIdx,
        msg: `ジョブ${cur.sequenceNo}: 引き継ぎ地点が未入力です`
      });
    }
  }

  return warnings;
}
window.validateEditingJobs = validateEditingJobs;

// ═══════════════════════════════════════════════════════════════════
// ★M4 デモデータ: 日跨ぎ + マルチデイ案件をサンプル投入
// ═══════════════════════════════════════════════════════════════════
// 既存の機能を壊さないよう、未使用ドライバーに1件だけ複数日ジョブを投入。
// 「東京→福岡 長距離便」を 5/27夜積込 → 5/28走行(日跨ぎ) → 5/29配達 で構成。
(function _seedMultiDayDemoJobs() {
  if (typeof dndDrivers === 'undefined' || dndDrivers.length < 2) return;

  // デモ案件を cases[] に追加
  const demoCase = {
    id: 'D-DEMO-1',
    caseListId: '20260527DEMO',
    client: '○○商事（長距離便）',
    from: '東京都港区',
    to: '福岡県福岡市',
    goods: 'パレット20枚/8000kg/常温',
    deadline: '5/29 18:00',
    durationH: 0, // ジョブ側で管理
    preferredStart: '18:00',
    urgent: false,
    color: '#1e40af', // 青系で識別
    loadMin: 120, driveMin: 0, unloadMin: 30,
    durationSource: 'manual',
    status: 'planned',
    _isMultiDayDemo: true,
  };
  cases.push(demoCase);

  // 担当ドライバーを決定（先頭の未使用ドライバーを探す）
  const today = dndToday();
  const todayKey = dndDateKey(today);
  // 「5/27 と 5/28 と 5/29 が全て空のドライバー」を探す
  const dayMinusOne = new Date(today); dayMinusOne.setDate(dayMinusOne.getDate() - 1);
  const dayPlusOne  = new Date(today); dayPlusOne.setDate(dayPlusOne.getDate() + 1);
  const k0 = dndDateKey(dayMinusOne);
  const k1 = todayKey;
  const k2 = dndDateKey(dayPlusOne);

  const targetDriver = dndDrivers.find(d => {
    const byDate = dndAssignments[d.id] || {};
    const c0 = (byDate[k0] || []).length;
    const c1 = (byDate[k1] || []).length;
    const c2 = (byDate[k2] || []).length;
    return c0 === 0 && c1 === 0 && c2 === 0;
  });

  if (!targetDriver) {
    console.log('[M4 Demo] 空きドライバーが無いためデモ投入をスキップ');
    return;
  }

  // 3つのジョブを構築
  const j1 = {
    jobId: 'D-DEMO-1-J1',
    caseId: 'D-DEMO-1',
    caseListId: '20260527DEMO',
    sequenceNo: 1,
    driverId: targetDriver.id,
    startDateTime: combineToIsoDateTime(k0, '18:00'),
    endDateTime:   combineToIsoDateTime(k0, '20:00'),
    role: 'preload',
    nextJobId: 'D-DEMO-1-J2',
    handoffType: 'overnight_park',
    handoffLocation: '川口デポ',
    color: '#1e40af',
    isPreset: false, confirmed: false, locked: false,
  };
  // J2: 日跨ぎ単発（22:00 → 翌04:00）
  const j2 = {
    jobId: 'D-DEMO-1-J2',
    caseId: 'D-DEMO-1',
    caseListId: '20260527DEMO',
    sequenceNo: 2,
    driverId: targetDriver.id,
    startDateTime: combineToIsoDateTime(k1, '22:00'),
    endDateTime:   combineToIsoDateTime(k2, '04:00'),
    role: 'transport',
    nextJobId: 'D-DEMO-1-J3',
    handoffType: 'overnight_park',
    handoffLocation: '広島中継ターミナル',
    color: '#1e40af',
    isPreset: false, confirmed: false, locked: false,
  };
  const j3 = {
    jobId: 'D-DEMO-1-J3',
    caseId: 'D-DEMO-1',
    caseListId: '20260527DEMO',
    sequenceNo: 3,
    driverId: targetDriver.id,
    startDateTime: combineToIsoDateTime(k2, '06:00'),
    endDateTime:   combineToIsoDateTime(k2, '10:00'),
    role: 'delivery',
    nextJobId: null,
    handoffType: 'none',
    handoffLocation: null,
    color: '#1e40af',
    isPreset: false, confirmed: false, locked: false,
  };
  jobs.push(j1, j2, j3);

  // ステップは簡略化（M4では最小限）
  steps.push({
    stepId: 'D-DEMO-1-J1-S1', jobId: 'D-DEMO-1-J1', orderNo: 1, stepType: 'load',
    stepStart: j1.startDateTime, stepEnd: j1.endDateTime, durationMin: 120
  });
  steps.push({
    stepId: 'D-DEMO-1-J2-S1', jobId: 'D-DEMO-1-J2', orderNo: 1, stepType: 'drive',
    stepStart: j2.startDateTime, stepEnd: j2.endDateTime, durationMin: 360
  });
  steps.push({
    stepId: 'D-DEMO-1-J3-S1', jobId: 'D-DEMO-1-J3', orderNo: 1, stepType: 'drive',
    stepStart: j3.startDateTime, stepEnd: isoAddMinutes(j3.startDateTime, 210), durationMin: 210
  });
  steps.push({
    stepId: 'D-DEMO-1-J3-S2', jobId: 'D-DEMO-1-J3', orderNo: 2, stepType: 'unload',
    stepStart: isoAddMinutes(j3.startDateTime, 210), stepEnd: j3.endDateTime, durationMin: 30
  });

  console.log(`[M4 Demo] 投入完了: ドライバー=${targetDriver.driver}, ジョブ3件 (${k0} preload / ${k1}→${k2} 日跨ぎ走行 / ${k2} delivery)`);

  // rebuild して dndAssignments に反映
  rebuildDndAssignmentsFromJobs();
})();

// ── M2の整合性検証 ────────────────────────────────────────────────
// 起動時に1回だけ：rebuildを実行して既存のブロック数と一致するか確認
(function _verifyM2Consistency() {
  // 現在の dndAssignments のブロック総数を数える
  let beforeCount = 0;
  Object.keys(dndAssignments).forEach(did => {
    const byDate = dndAssignments[did];
    Object.keys(byDate).forEach(dk => {
      beforeCount += (byDate[dk] || []).length;
    });
  });

  // rebuild を試す
  rebuildDndAssignmentsFromJobs();

  // rebuild 後のブロック総数
  let afterCount = 0;
  Object.keys(dndAssignments).forEach(did => {
    const byDate = dndAssignments[did];
    Object.keys(byDate).forEach(dk => {
      afterCount += (byDate[dk] || []).length;
    });
  });

  console.log(`[M2 Verify] rebuild前: ${beforeCount} blocks → rebuild後: ${afterCount} blocks (jobs:${jobs.length})`);
  if (beforeCount !== afterCount) {
    console.warn(`[M2 Verify] ⚠ ブロック数が一致しません。差分: ${beforeCount - afterCount}`);
  }
})();

// ── 確定済みタブ専用の割当ストア（請求確定済みのprocessedCasesから動的生成、読み取り専用） ──
// 計画中(dndAssignments)とは独立したデータソース。確定済みタブでは常にここを参照する。
let dndConfirmedAssignments = {};

// processedCasesのうち billingConfirmed===true のものを抽出してドライバー/日付ごとのブロックに整形
function buildConfirmedAssignments() {
  dndConfirmedAssignments = {};
  if (typeof processedCases === 'undefined' || !Array.isArray(processedCases)) return;
  const today = dndToday();
  // 同じドライバー+日付の重複時に分散させるためのカウンタ
  // ※デモ表示用：実運用ではcompletion日時から正確に決まる想定
  processedCases.forEach(function(c, ci) {
    if (!c.billingConfirmed) return;
    // driver名 → driverId にマッチ。一致しなければスキップ
    const drv = dndDrivers.find(function(d){ return d.driver === c.driver; });
    if (!drv) return;
    // 完了日時から日付を抽出。デモのため、相対的に「今日」「昨日」「一昨日」に振り分けて視認性を確保。
    // 既に同じドライバー・日付に予定があれば、空いている近い日に逃がす
    const tail = String(c.id).slice(-3);
    const n = parseInt(tail, 10);
    let baseOffset = 0;
    if (!isNaN(n)) baseOffset = -(n % 3); // 0, -1, -2
    // 重複回避：±3日の範囲で空いている日を探す
    let dateOffset = baseOffset;
    for (let tries = 0; tries < 6; tries++) {
      const tryDate = dndAddDays(today, dateOffset);
      const tryKey = dndDateKey(tryDate);
      const existing = (dndConfirmedAssignments[drv.id] && dndConfirmedAssignments[drv.id][tryKey]) || [];
      if (existing.length === 0) break;
      // 1つ前の日に逃がす
      dateOffset = dateOffset - 1;
      if (dateOffset < -3) dateOffset = baseOffset + 1;
      if (dateOffset > 0)  dateOffset = -2;
    }
    const targetDate = dndAddDays(today, dateOffset);
    const dateKey = dndDateKey(targetDate);
    // completion文字列から HH:MM を取り出して開始時刻に流用
    let startTime = '09:00';
    let endTime = '12:00';
    const tm = String(c.completion || '').match(/(\d{1,2}):(\d{2})/);
    if (tm) {
      let eh = parseInt(tm[1], 10), em = parseInt(tm[2], 10);
      const km = parseInt(String(c.distance || '').replace(/[^\d]/g,''), 10) || 30;
      // ざっくり：30km/h相当の移動時間 + 1時間の積み込み・荷下ろし
      const dur = Math.max(2, Math.min(10, Math.round((km / 30) + 1)));
      let sh = eh - dur;
      if (sh < 4) sh = 4; // 早朝過ぎる場合の補正
      startTime = String(sh).padStart(2,'0') + ':' + String(em).padStart(2,'0');
      endTime   = String(eh).padStart(2,'0') + ':' + String(em).padStart(2,'0');
    }
    // ブロックの色：運用ブロックは緑1色に統一（カラフルさを避ける）
    const block = {
      caseId: c.id,
      start: startTime,
      end: endTime,
      label: c.client,
      sub: (String(c.from || '').slice(0,4)) + '→' + (String(c.to || '').slice(0,4)),
      color: '#1a7a5e',
      confirmed: true,
      // 念のため：D&Dや削除を絶対に許可しない印
      locked: true,
    };
    if (!dndConfirmedAssignments[drv.id]) dndConfirmedAssignments[drv.id] = {};
    if (!dndConfirmedAssignments[drv.id][dateKey]) dndConfirmedAssignments[drv.id][dateKey] = [];
    dndConfirmedAssignments[drv.id][dateKey].push(block);
  });
}
// 初回構築
buildConfirmedAssignments();

// 現在表示中の日付における特定ドライバーの割当配列を返す（無ければ空配列を作成）
function dndAssignmentsFor(driverId, dateKey) {
  const key = dateKey || dndGetCurrentDateKey();
  if (!dndAssignments[driverId]) dndAssignments[driverId] = {};
  if (!dndAssignments[driverId][key]) dndAssignments[driverId][key] = [];
  return dndAssignments[driverId][key];
}

let dndCurrentFilter = 'all';
let dndSearchQuery = ''; // 荷主名検索クエリ
let dndDraggingCaseId = null;
let dndDraggingFromDriver = null; // 既存ブロックを動かすときの元ドライバー
let dndDraggingBlockIdx = null;
let dndDraggingFromDateKey = null; // 既存ブロック移動時の元日付
let dndGhostEl = null;

// 荷主検索クエリの更新
function dndSetSearchQuery(q) {
  dndSearchQuery = (q || '').trim();
  const clearBtn = document.getElementById('dnd-search-clear');
  if (clearBtn) clearBtn.style.display = dndSearchQuery ? 'flex' : 'none';
  renderDndList();
}

function dndClearSearch() {
  dndSearchQuery = '';
  const input = document.getElementById('dnd-search-input');
  if (input) input.value = '';
  const clearBtn = document.getElementById('dnd-search-clear');
  if (clearBtn) clearBtn.style.display = 'none';
  renderDndList();
}

// ── 案件が「処理済み」かを判定 ──
// 個別案件処理の processedCases に該当する案件のみが処理済み。
// これにより、配車計画表の「処理済み」と個別案件処理の「処理済み」が
// 同じデータソースを参照し、件数が完全に連動する。
function isCaseProcessed(caseId) {
  if (typeof processedCases === 'undefined' || !Array.isArray(processedCases)) return false;
  // caseId が processedCases.id と一致するか、または
  // dndUnassignedCases 側の caseListId が processedCases.id と一致するかをチェック
  for (let i = 0; i < processedCases.length; i++) {
    if (processedCases[i].id === caseId) return true;
  }
  // 紐付けで一致するケース
  if (typeof dndUnassignedCases !== 'undefined') {
    const c = dndUnassignedCases.find(x => x.id === caseId);
    if (c && c.caseListId) {
      for (let i = 0; i < processedCases.length; i++) {
        if (processedCases[i].id === c.caseListId) return true;
      }
    }
  }
  return false;
}

// processedCases の案件を未割当案件カード形式（dndUnassignedCases相当）に変換
// 配車計画表の「処理済み」タブで参照表示する用
function _buildProcessedCardFromProcessedCase(c) {
  // 既に dndUnassignedCases 側に該当案件があればそれを返す（情報を維持）
  if (typeof dndUnassignedCases !== 'undefined') {
    const exists = dndUnassignedCases.find(x => x.id === c.id || (x.caseListId && x.caseListId === c.id));
    if (exists) return exists;
  }
  // 無ければ processedCases からカード形式に変換
  const goodsStr = String(c.goods || '').replace(/\s*\/\s*/g, '/');
  return {
    id: c.id,
    caseListId: c.id,
    originalPhase: 'processed',
    client: c.client || '—',
    status: 'processing', // 処理ステータスは「処理中」相当（カード内ステータスバッジ用、実体はprocessed扱い）
    from: c.from || '—',
    to: c.to || '—',
    goods: goodsStr || '—',
    durationH: 3,
    preferredStart: '—',
    deadline: c.completion ? ('完了：' + c.completion) : '完了',
    urgent: false,
    color: '#1a7a5e',
    // 処理済みカード用の追加情報
    _isProcessedDirect: true,
    _processedCaseRef: c,
  };
}

// processedCases に変更があった時に呼ぶ通知関数（個別案件処理 ⇔ 配車計画表の連動）
// 個別案件処理で「処理済み」になった/戻された案件は、配車計画表の処理済みタブにも即時反映する
function notifyProcessedCasesChanged() {
  // 配車計画表（D&D）が表示中ならリストを再描画
  if (typeof renderDndList === 'function') {
    try { renderDndList(); } catch(e) { /* noop */ }
  }
  // サイドバーの未割当バッジも更新（処理済み移動で未割当も変動するため）
  if (typeof updateDispatchNavBadge === 'function') {
    try { updateDispatchNavBadge(); } catch(e) { /* noop */ }
  }
}
// グローバル公開
window.notifyProcessedCasesChanged = notifyProcessedCasesChanged;

function renderDnd() {
  // 拡張機能（配車表メイン運用機能）からアクセスできるようwindow露出
  try {
    window.dndAssignments = dndAssignments;
    window.dndDrivers = dndDrivers;
    window.dndConfirmedAssignments = dndConfirmedAssignments;
    window.dndUnassignedCases = dndUnassignedCases;
    window.currentDispatchTab = (typeof currentDispatchTab !== 'undefined') ? currentDispatchTab : 'planning';
    window.currentDispatchSubtab = (typeof currentDispatchSubtab !== 'undefined') ? currentDispatchSubtab : 'dnd';
    window.dndGetCurrentDateKey = dndGetCurrentDateKey;
    window.kaizenCheck = (typeof kaizenCheck !== 'undefined') ? kaizenCheck : window.kaizenCheck;
    window.kaizenComputeDuty = (typeof kaizenComputeDuty !== 'undefined') ? kaizenComputeDuty : window.kaizenComputeDuty;
    window.processingCases = (typeof processingCases !== 'undefined') ? processingCases : window.processingCases;
    window.unprocessedCases = (typeof unprocessedCases !== 'undefined') ? unprocessedCases : window.unprocessedCases;
    window.processedCases = (typeof processedCases !== 'undefined') ? processedCases : window.processedCases;
    window.isCaseAssigned = (typeof isCaseAssigned === 'function') ? isCaseAssigned : window.isCaseAssigned;
    window.updateDispatchNavBadge = (typeof updateDispatchNavBadge === 'function') ? updateDispatchNavBadge : window.updateDispatchNavBadge;
    window.dndCaseToProcessed = (typeof dndCaseToProcessed === 'function') ? dndCaseToProcessed : window.dndCaseToProcessed;
    window.dndCaseFromProcessed = (typeof dndCaseFromProcessed === 'function') ? dndCaseFromProcessed : window.dndCaseFromProcessed;
    window.renderProcessedList = (typeof renderProcessedList === 'function') ? renderProcessedList : window.renderProcessedList;
    window.renderProcessingList = (typeof renderProcessingList === 'function') ? renderProcessingList : window.renderProcessingList;
    window.renderUnprocessedList = (typeof renderUnprocessedList === 'function') ? renderUnprocessedList : window.renderUnprocessedList;
    window.updatePhaseCounts = (typeof updatePhaseCounts === 'function') ? updatePhaseCounts : window.updatePhaseCounts;
  } catch(e) { /* ignore */ }

  // 前回の幅を復元
  try {
    const saved = parseInt(localStorage.getItem('dndLeftWidth'), 10);
    if (saved && !isNaN(saved)) {
      const left = document.querySelector('.dnd-left');
      if (left) {
        const w = Math.max(DND_LEFT_MIN_WIDTH, Math.min(DND_LEFT_MAX_WIDTH, saved));
        left.style.width = w + 'px';
      }
    }
  } catch(e) {}

  // タブに応じて左パネルの見出し・サブテキスト・フィルター行を切替
  const isConfirmedTab = (typeof currentDispatchTab !== 'undefined' && currentDispatchTab === 'confirmed');
  const titleEl = document.getElementById('dnd-left-title-text');
  const subEl = document.getElementById('dnd-left-sub');
  const filterRow = document.getElementById('dnd-filter-row');
  const dndLeft = document.querySelector('.dnd-left');
  if (dndLeft) dndLeft.classList.toggle('readonly-mode', isConfirmedTab);
  if (titleEl) titleEl.textContent = isConfirmedTab ? '請求確定済み案件' : '未割当案件';
  if (subEl)   subEl.textContent   = isConfirmedTab ? '請求確定済みの案件のみが配車計画表にプロットされます（参照のみ）' : '案件カードを右のトラックにドラッグして配車';
  if (filterRow) filterRow.style.display = isConfirmedTab ? 'none' : '';

  // 確定済みタブに切り替わった瞬間にデータを再構築（処理済み側で請求確定の状態が変わった場合に備える）
  if (isConfirmedTab && typeof buildConfirmedAssignments === 'function') {
    buildConfirmedAssignments();
  }

  // 日付ナビゲーション更新
  renderDndDateNav();

  // 日付表示
  const dateLbl = document.getElementById('dnd-right-date');
  if (dateLbl) {
    const cur = dndGetCurrentDate();
    dateLbl.textContent = cur.toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'});
  }
  renderDndList();
  renderDndTimeline();
  dndUpdateSortBtnUI();
  updateDndStats();
  // リレー輸送トグル（束ね/分散/リセット）の描画
  if (typeof renderDndRelayToggle === 'function') renderDndRelayToggle();
  // サイドバーの「配車計画表」バッジを未割当案件数で更新
  // （計画中タブでも確定済みタブでも、また現在表示中でなくても更新）
  if (typeof updateDispatchNavBadge === 'function') updateDispatchNavBadge();
}

// ═══════════════════════════════════════════════════════════════
//  配車割当ページ：リレー輸送トグル
//  リレー案件が存在する時のみ表示。束ね/分散切替＋リセット
// ═══════════════════════════════════════════════════════════════
function renderDndRelayToggle() {
  const host = document.getElementById('dnd-relay-toggle-host');
  if (!host) return;
  if (typeof processingCases === 'undefined') {
    host.innerHTML = '';
    return;
  }
  const relayCases = processingCases.filter(c =>
    c.vehicleMode === 'relay' && c.legs && c.legs.length > 0
  );
  if (relayCases.length === 0) {
    host.innerHTML = '';
    return;
  }
  if (typeof window.__relayDisplayMode === 'undefined') {
    window.__relayDisplayMode = 'grouped';
  }
  const mode = window.__relayDisplayMode;
  host.innerHTML = `
    <div class="dnd-relay-toggle">
      <span class="dnd-relay-toggle-label">🔁 リレー ${relayCases.length}件</span>
      <button class="dnd-relay-mode-btn ${mode==='grouped'?'active':''}"
              onclick="window.__setRelayDisplayMode('grouped')"
              title="同案件のレッグを1行にまとめて表示">束ね</button>
      <button class="dnd-relay-mode-btn ${mode==='separate'?'active':''}"
              onclick="window.__setRelayDisplayMode('separate')"
              title="各レッグをドライバー行に分散して表示">分散</button>
      <button class="dnd-relay-reset-btn"
              onclick="window.__resetRelayDisplay()"
              title="リレー輸送モードの案件を全て1台モードに戻す">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 10 9 10"/></svg>
        リセット
      </button>
    </div>
  `;
}

// 切替（モード変更）
window.__setRelayDisplayMode = function(mode) {
  window.__relayDisplayMode = mode;
  // 配車割当ページのタイムラインを再描画
  if (typeof renderDndTimeline === 'function') renderDndTimeline();
  if (typeof renderDndRelayToggle === 'function') renderDndRelayToggle();
};

// リセット：リレー輸送モードの案件を全て1台モードに戻す
window.__resetRelayDisplay = function() {
  if (typeof processingCases === 'undefined') return;
  const relayCases = processingCases.filter(c => c.vehicleMode === 'relay');
  if (relayCases.length === 0) return;
  const count = relayCases.length;
  const ok = confirm(
    `リレー輸送モードの案件 ${count}件 を「1台で対応」モードに戻します。\n` +
    `各案件のリレー区間設定は削除されます。本当に実行しますか？`
  );
  if (!ok) return;
  relayCases.forEach(c => {
    c.vehicleMode = 'single';
    c.legs = [];
    c.multiReasons = [];
    delete c.jobId;
  });
  // 表示モードもgroupedに戻す
  window.__relayDisplayMode = 'grouped';
  // 再描画
  if (typeof renderDnd === 'function') renderDnd();
  // 開いている案件詳細モーダルがあれば更新
  if (typeof renderProcessingDetail === 'function') {
    const idx = relayCases.length > 0 ? processingCases.findIndex(c => c.id === relayCases[0].id) : -1;
    if (idx >= 0 && document.querySelector('.proc-modal.is-open')) {
      try { renderProcessingDetail(idx); } catch(e) {}
    }
  }
  if (typeof showToast === 'function') {
    showToast(`${count}件のリレー輸送案件を1台モードに戻しました`, 'success');
  }
};

// ═══════════════════════════════════════════════════════════════
//  リレー配車 追加ピッカー
//  D&D編集モーダルの「🔁 リレー配車を追加」ボタンから呼ばれる。
//  現在の案件に対して、利用可能な車両/ドライバーを一覧表示し
//  選択するとタイムラインにリレー区間ブロックとして追加される。
// ═══════════════════════════════════════════════════════════════

let _relayPickerState = null;

// 案件詳細モーダル（dnd-detail-pane）から呼ばれるリレー追加
// (driverId, blockIdx) を起点に、現在のブロックの情報を取得してピッカーを開く
window.openRelayAddPickerFromDetail = function(driverId, blockIdx) {
  const currentDateKey = dndGetCurrentDateKey();
  const arr = (dndAssignments[driverId] && dndAssignments[driverId][currentDateKey]) || [];
  const a = arr[blockIdx];
  if (!a) {
    if (typeof showToast === 'function') showToast('案件情報が取得できませんでした', 'warn');
    return;
  }

  // 1区間目（メイン配車）の情報を取得
  const primaryDriver = dndDrivers.find(d => d.id === driverId);
  const c = {
    id: a.id || a.caseListId || ('case-' + Date.now()),
    caseListId: a.caseListId,
    client: a.client || a.label || '案件',
    from: a.from || '',
    to: a.to || '',
    goods: a.goods || '',
    deadline: a.deadline || '',
    preferredStart: a.start || '09:00'
  };

  // 同じ案件のリレー区間がすでにある場合のために収集
  const existingRelayLegs = [];
  Object.keys(dndAssignments).forEach(did => {
    const ar = (dndAssignments[did] && dndAssignments[did][currentDateKey]) || [];
    ar.forEach(x => {
      if (x._relayCaseId === c.id ||
          (x.caseListId && x.caseListId === c.caseListId) ||
          (a.caseListId && x.caseListId === a.caseListId)) {
        existingRelayLegs.push({ driverId:did, block:x });
      }
    });
  });
  // 最新区間の終了時刻＋30分インターバルで提案
  let proposedStart = '13:00', proposedEnd = '16:00';
  let fromVal = a.to || '';
  if (existingRelayLegs.length > 0) {
    // 最も遅い終了時刻のレッグを基準に
    const latest = existingRelayLegs.reduce((latest, x) => {
      return _relayTimeToMin(x.block.end) > _relayTimeToMin(latest.block.end) ? x : latest;
    }, existingRelayLegs[0]);
    const [eh, em] = latest.block.end.split(':').map(Number);
    let sh = eh, sm = em + 30;
    if (sm >= 60) { sh++; sm -= 60; }
    proposedStart = String(sh).padStart(2,'0') + ':' + String(sm).padStart(2,'0');
    proposedEnd = String(Math.min(23, sh + 3)).padStart(2,'0') + ':' + String(sm).padStart(2,'0');
    fromVal = latest.block.to || a.to || '';
  } else if (a.end) {
    const [eh, em] = a.end.split(':').map(Number);
    let sh = eh, sm = em + 30;
    if (sm >= 60) { sh++; sm -= 60; }
    proposedStart = String(sh).padStart(2,'0') + ':' + String(sm).padStart(2,'0');
    proposedEnd = String(Math.min(23, sh + 3)).padStart(2,'0') + ':' + String(sm).padStart(2,'0');
  }

  _relayPickerState = {
    caseId: c.id,
    caseListId: c.caseListId,
    case: c,
    primaryDriverId: driverId,
    primaryAssignment: a,
    primaryBlockIdx: blockIdx,
    existingLegs: existingRelayLegs,
    selectedDriverId: null,
    fromValue: fromVal,
    toValue: c.to || '',
    startValue: proposedStart,
    endValue: proposedEnd
  };
  // 案件詳細モーダルを閉じてピッカーを開く
  if (typeof closeDndDetailPane === 'function') closeDndDetailPane();
  _renderRelayPicker();
};

// 旧フロー（編集モーダルから）も互換のため残す
window.openRelayAddPicker = function() {
  if (typeof dndEditingCaseId === 'undefined' || !dndEditingCaseId) {
    if (typeof showToast === 'function') showToast('案件を特定できませんでした', 'warn');
    return;
  }
  const c = dndUnassignedCases.find(x => x.id === dndEditingCaseId);
  if (!c) {
    if (typeof showToast === 'function') showToast('案件情報が見つかりません', 'warn');
    return;
  }
  // 既存のアサインメントから「この案件が今どの時間でどこを走っているか」を取得
  const currentDateKey = dndGetCurrentDateKey();
  let primaryAssignment = null;
  let primaryDriverId = null;
  Object.keys(dndAssignments).forEach(driverId => {
    const arr = dndAssignments[driverId] && dndAssignments[driverId][currentDateKey];
    if (!arr) return;
    arr.forEach(a => {
      if (a.caseListId === c.id || a.id === c.id || a.client === c.client) {
        if (!primaryAssignment) {
          primaryAssignment = a;
          primaryDriverId = driverId;
        }
      }
    });
  });

  // 現在の運行時刻からリレー区間の時刻を提案
  const primaryStart = primaryAssignment ? primaryAssignment.start : (c.preferredStart || '09:00');
  const primaryEnd = primaryAssignment ? primaryAssignment.end : '13:00';
  // 既定値：1区間目のあとに30分インターバルで2区間目を提案
  const [eh, em] = primaryEnd.split(':').map(Number);
  let sh = eh, sm = em + 30;
  if (sm >= 60) { sh++; sm -= 60; }
  const proposedStart = String(sh).padStart(2,'0') + ':' + String(sm).padStart(2,'0');
  const proposedEnd = String(Math.min(23, sh + 3)).padStart(2,'0') + ':' + String(sm).padStart(2,'0');

  _relayPickerState = {
    caseId: c.id,
    caseListId: c.caseListId,
    case: c,
    primaryDriverId: primaryDriverId,
    primaryAssignment: primaryAssignment,
    selectedDriverId: null,
    fromValue: c.to || '',
    toValue: c.to || '',
    startValue: proposedStart,
    endValue: proposedEnd
  };
  _renderRelayPicker();
};

function _renderRelayPicker() {
  const state = _relayPickerState;
  if (!state) return;
  // 既存のピッカーを閉じる
  const existing = document.getElementById('relay-picker-backdrop');
  if (existing) existing.remove();

  // 利用可能なドライバー一覧を構築（現在の案件に既に割り当てられているドライバーは除外）
  const currentDateKey = dndGetCurrentDateKey();
  const myId = (typeof window.__getCurrentUserId === 'function') ? window.__getCurrentUserId() : 'me';
  const candidates = dndDrivers.map(d => {
    // 担当者情報
    const ownerId = (typeof window.__getDriverOwner === 'function') ? window.__getDriverOwner(d.id) : null;
    const owner = (ownerId && typeof window.__getTeamMember === 'function') ? window.__getTeamMember(ownerId) : null;
    const ownerKind = !ownerId ? 'unassigned'         // 担当未設定
                     : ownerId === myId ? 'mine'       // 自分担当
                     : 'other';                        // 他担当

    // 既にこの案件のメインドライバー → 除外候補
    if (d.id === state.primaryDriverId) {
      return { driver:d, status:'unavailable', statusLabel:'メイン担当者', law:'ok', conflict:null, owner, ownerKind };
    }
    // 該当時間帯の衝突チェック
    const assigned = (dndAssignments[d.id] && dndAssignments[d.id][currentDateKey]) || [];
    const sMin = _relayTimeToMin(state.startValue);
    const eMin = _relayTimeToMin(state.endValue);
    let conflict = null;
    for (const a of assigned) {
      const asMin = _relayTimeToMin(a.start);
      const aeMin = _relayTimeToMin(a.end);
      if (sMin < aeMin && eMin > asMin) {
        conflict = a;
        break;
      }
    }
    // 改善基準告示
    let lawStatus = 'ok';
    if (typeof kaizenCheck === 'function') {
      try {
        const k = kaizenCheck(d.id, currentDateKey, {start:state.startValue, end:state.endValue});
        if (k && k.level === 'violation') lawStatus = 'violation';
        else if (k && k.level === 'warn') lawStatus = 'warn';
      } catch(e) {}
    }
    let status, statusLabel;
    if (conflict) {
      status = 'unavailable';
      statusLabel = `衝突: ${conflict.start}-${conflict.end}`;
    } else if (lawStatus === 'violation') {
      status = 'unavailable';
      statusLabel = '改善基準違反';
    } else if (lawStatus === 'warn') {
      status = 'partial';
      statusLabel = '改善基準注意';
    } else {
      status = 'available';
      statusLabel = '空き';
    }
    return { driver:d, status, statusLabel, law:lawStatus, conflict, owner, ownerKind };
  }).sort((a, b) => {
    // available → partial → unavailable の順、さらに同ステータス内では mine → unassigned → other の順
    const statusOrder = { available:0, partial:1, unavailable:2 };
    const ownerOrder = { mine:0, unassigned:1, other:2 };
    const s = (statusOrder[a.status]||0) - (statusOrder[b.status]||0);
    if (s !== 0) return s;
    return (ownerOrder[a.ownerKind]||0) - (ownerOrder[b.ownerKind]||0);
  });

  // 集計
  const availCount = candidates.filter(x => x.status === 'available').length;
  const mineAvailCount = candidates.filter(x => x.status === 'available' && x.ownerKind === 'mine').length;

  // 選択中ドライバー有無で「決定」ボタンの有効/無効
  const decideBtnDisabled = !state.selectedDriverId
    ? 'disabled style="opacity:.5;cursor:not-allowed"'
    : '';

  const c = state.case;
  const backdrop = document.createElement('div');
  backdrop.id = 'relay-picker-backdrop';
  backdrop.className = 'relay-picker-backdrop';
  backdrop.onclick = (e) => { if (e.target === backdrop) closeRelayPicker(); };
  backdrop.innerHTML = `
    <div class="relay-picker" onclick="event.stopPropagation()">
      <div class="relay-picker-header">
        <div class="relay-picker-icon">🔁</div>
        <div class="relay-picker-title">
          <h3>リレー配車を追加</h3>
          <p>${_pickerEsc(c.client)} ｜ ${_pickerEsc(c.from)} → ${_pickerEsc(c.to)}</p>
        </div>
        <button class="relay-picker-close" onclick="closeRelayPicker()" title="閉じる">✕</button>
      </div>
      <div class="relay-picker-body">
        <div class="relay-picker-info">
          ${state.primaryAssignment
            ? `<strong>現在の配車</strong>：${_pickerEsc((dndDrivers.find(d=>d.id===state.primaryDriverId)||{}).name||'—')}（${state.primaryAssignment.start}-${state.primaryAssignment.end}）<br>`
            : '<strong>初回配車</strong>：まだメインの配車がありません。<br>'}
          リレー区間を追加し、別のドライバー・車両に途中から引き継がせます。<br>
          時刻と区間を設定したあと、下のリストから引き継ぎ先を選択してください。
        </div>

        <div class="relay-picker-section-label">リレー区間の時間と地点</div>
        <div class="relay-picker-fields">
          <div class="relay-picker-field">
            <label>出発時刻</label>
            <input type="time" id="relay-pick-start" value="${state.startValue}"
                   onchange="_relayPickerUpdateField('startValue', this.value)">
          </div>
          <div class="relay-picker-field">
            <label>到着時刻</label>
            <input type="time" id="relay-pick-end" value="${state.endValue}"
                   onchange="_relayPickerUpdateField('endValue', this.value)">
          </div>
          <div class="relay-picker-field">
            <label>出発地（前区間の到着地）</label>
            <input type="text" id="relay-pick-from" value="${_pickerEsc(state.fromValue)}"
                   placeholder="例：愛知県名古屋市"
                   onchange="_relayPickerUpdateField('fromValue', this.value)">
          </div>
          <div class="relay-picker-field">
            <label>到着地</label>
            <input type="text" id="relay-pick-to" value="${_pickerEsc(state.toValue)}"
                   placeholder="例：大阪府大阪市"
                   onchange="_relayPickerUpdateField('toValue', this.value)">
          </div>
        </div>

        <div class="relay-picker-section-label">
          <span>引き継ぎ先のドライバー・車両を選択（${availCount}名空き / 全${candidates.length}名）</span>
          <div class="relay-picker-owner-filter">
            <button class="relay-picker-owner-fbtn ${(state.ownerFilter||'all')==='all'?'active':''}"
                    onclick="_relayPickerSetOwnerFilter('all')">すべて</button>
            <button class="relay-picker-owner-fbtn mine ${state.ownerFilter==='mine'?'active':''}"
                    onclick="_relayPickerSetOwnerFilter('mine')" title="自分の担当ドライバーのみ表示">
              担当 ${mineAvailCount > 0 ? `<span class="relay-picker-owner-fbtn-count">${mineAvailCount}</span>` : ''}
            </button>
            <button class="relay-picker-owner-fbtn ${state.ownerFilter==='other'?'active':''}"
                    onclick="_relayPickerSetOwnerFilter('other')" title="他担当のドライバーも表示">担当外</button>
          </div>
        </div>
        <div class="relay-picker-list" id="relay-picker-list">
          ${(() => {
            // フィルタ適用
            const f = state.ownerFilter || 'all';
            const filtered = candidates.filter(x => {
              if (f === 'all') return true;
              if (f === 'mine') return x.ownerKind === 'mine';
              if (f === 'other') return x.ownerKind === 'other' || x.ownerKind === 'unassigned';
              return true;
            });
            if (filtered.length === 0) {
              return '<div class="relay-picker-empty">フィルタ条件に該当する候補がありません</div>';
            }
            return filtered.map(({driver:d, status, statusLabel, law, owner, ownerKind}) => {
              const disabled = status === 'unavailable';
              const selected = state.selectedDriverId === d.id;
              const lawCls = law === 'violation' ? 'warn' : (law === 'warn' ? 'warn' : 'ok');
              const lawLabel = law === 'violation' ? '違反' : (law === 'warn' ? '注意' : '適合');
              // 担当者バッジ：担当未設定 / 自分担当 / 他担当 の3区分で色分け
              let ownerBadge;
              if (ownerKind === 'mine') {
                const c = (owner && owner.color) ? owner.color : '#1A6B56';
                ownerBadge = `<span class="relay-pick-owner mine" style="background:${c}1a;color:${c};border-color:${c}55" title="自分の担当ドライバー">
                  <span class="relay-pick-owner-dot" style="background:${c}"></span>担当
                </span>`;
              } else if (ownerKind === 'other' && owner) {
                ownerBadge = `<span class="relay-pick-owner other" style="background:${owner.color}10;color:${owner.color};border-color:${owner.color}33" title="他担当：${_pickerEsc(owner.name)}">
                  <span class="relay-pick-owner-dot" style="background:${owner.color}"></span>${_pickerEsc(owner.initial || '他')}
                </span>`;
              } else {
                ownerBadge = `<span class="relay-pick-owner unassigned" title="担当未設定">―</span>`;
              }
              return `
                <div class="relay-pick-item ${disabled?'disabled':''} ${selected?'selected':''} owner-${ownerKind}"
                     ${disabled ? '' : `onclick="_relayPickerSelect('${d.id}')"`}>
                  <div class="relay-pick-avail"></div>
                  <div class="relay-pick-info">
                    <div class="relay-pick-driver">${_pickerEsc(d.name)}</div>
                    <div class="relay-pick-vehicle">${_pickerEsc(d.vehicle || d.id)} ｜ ${_pickerEsc(d.type || '')}/${((d.maxLoad||0)/1000).toFixed(0)}t</div>
                  </div>
                  ${ownerBadge}
                  <span class="relay-pick-law ${lawCls}">${lawLabel}</span>
                  <span class="relay-pick-status ${status}">${_pickerEsc(statusLabel)}</span>
                </div>
              `;
            }).join('');
          })()}
        </div>
      </div>
      <div class="relay-picker-footer">
        <button class="dnd-edit-btn dnd-edit-btn-cancel" onclick="closeRelayPicker()">キャンセル</button>
        <button class="dnd-edit-btn dnd-edit-btn-save" ${decideBtnDisabled}
                onclick="confirmRelayAdd()" style="background:#0d9488">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          決定してタイムラインに追加
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
}

window._relayPickerUpdateField = function(field, value) {
  if (!_relayPickerState) return;
  _relayPickerState[field] = value;
  _renderRelayPicker(); // 時刻変更で衝突再判定するため全体再描画
};

window._relayPickerSelect = function(driverId) {
  if (!_relayPickerState) return;
  _relayPickerState.selectedDriverId = driverId;
  _renderRelayPicker();
};

window._relayPickerSetOwnerFilter = function(filter) {
  if (!_relayPickerState) return;
  _relayPickerState.ownerFilter = filter;
  // 選択中のドライバーがフィルタ外になったら選択解除
  _renderRelayPicker();
};

window.closeRelayPicker = function() {
  const el = document.getElementById('relay-picker-backdrop');
  if (el) el.remove();
  _relayPickerState = null;
};

window.confirmRelayAdd = function() {
  const state = _relayPickerState;
  if (!state || !state.selectedDriverId) return;
  const driver = dndDrivers.find(d => d.id === state.selectedDriverId);
  if (!driver) return;
  const c = state.case;
  const currentDateKey = dndGetCurrentDateKey();

  // dndAssignmentsに「リレー区間」として追加
  if (!dndAssignments[driver.id]) dndAssignments[driver.id] = {};
  if (!dndAssignments[driver.id][currentDateKey]) dndAssignments[driver.id][currentDateKey] = [];

  // 既存のメイン配車のレッグNo
  const existingLegs = [];
  Object.keys(dndAssignments).forEach(did => {
    const arr = (dndAssignments[did] && dndAssignments[did][currentDateKey]) || [];
    arr.forEach(a => {
      if (a._relayCaseId === c.id) existingLegs.push(a);
    });
  });
  const newLegNo = existingLegs.length + 2; // メイン1 + 既存リレー数 + 1

  // メイン配車側にリレーフラグを立てる（最初の1件目だけ）
  if (existingLegs.length === 0 && state.primaryAssignment) {
    state.primaryAssignment._isRelayLeg = true;
    state.primaryAssignment._relayLegNo = 1;
    state.primaryAssignment._relayCaseId = c.id;
    state.primaryAssignment.color = '#0d9488';
  }

  const newBlock = {
    id: 'relay-' + c.id + '-' + Date.now(),
    caseListId: c.caseListId,
    start: state.startValue,
    end: state.endValue,
    client: c.client,
    from: state.fromValue,
    to: state.toValue,
    goods: c.goods,
    deadline: c.deadline,
    color: '#0d9488',
    label: c.client + ' (リレー)',
    _isRelayLeg: true,
    _relayLegNo: newLegNo,
    _relayCaseId: c.id,
    _isNew: true
  };
  dndAssignments[driver.id][currentDateKey].push(newBlock);

  // 既存リレーブロックのレッグ番号を更新（total数を反映）
  const totalLegs = newLegNo;
  Object.keys(dndAssignments).forEach(did => {
    const arr = (dndAssignments[did] && dndAssignments[did][currentDateKey]) || [];
    arr.forEach(a => {
      if (a._relayCaseId === c.id) a._relayTotalLegs = totalLegs;
    });
  });

  // processingCases側にも反映
  if (c.caseListId && typeof processingCases !== 'undefined') {
    const pc = processingCases.find(p => p.id === c.caseListId);
    if (pc) {
      if (pc.vehicleMode !== 'relay') {
        pc.vehicleMode = 'relay';
        pc.jobId = pc.jobId || 'J-' + pc.id + '-' + Date.now();
        pc.legs = [];
      }
      pc.legs.push({
        legId: newBlock.id,
        legNo: newLegNo,
        vehicleId: driver.vehicle || driver.id,
        vehicleName: driver.vehicle || driver.id,
        driverName: driver.name,
        capacity: ((driver.maxLoad||0)/1000).toFixed(0) + 't',
        role: 'relay',
        relayFrom: state.fromValue,
        relayTo: state.toValue,
        startTime: state.startValue,
        endTime: state.endValue,
        notes: '配車割当ページから追加',
        vehicleIdx: 0,
        lawOk: true,
      });
    }
  }

  closeRelayPicker();
  // 編集モーダルも閉じる
  if (typeof closeDndEditModal === 'function') closeDndEditModal();
  // タイムライン再描画
  if (typeof renderDnd === 'function') renderDnd();

  if (typeof showToast === 'function') {
    showToast(`🔁 リレー区間を ${driver.name} に追加しました`, 'success');
  }
};

// HHMM→分
function _relayTimeToMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

// HTMLエスケープ（ピッカー用）
function _pickerEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 日付ナビゲーション全体描画
function renderDndDateNav() {
  // ◀ / ▶ ボタンの活性制御
  const prevBtn = document.getElementById('dnd-date-prev');
  const nextBtn = document.getElementById('dnd-date-next');
  if (prevBtn) prevBtn.disabled = dndDateOffset <= -DND_DATE_RANGE;
  if (nextBtn) nextBtn.disabled = dndDateOffset >= DND_DATE_RANGE;

  // 月切替ボタンの活性制御（dndDateOffsetが範囲外の月にいくならdisable）
  const monthPrevBtn = document.getElementById('dnd-month-prev');
  const monthNextBtn = document.getElementById('dnd-month-next');
  if (monthPrevBtn) {
    // 前月の同日にいけるか
    const cur = dndGetCurrentDate();
    const prevMonth = new Date(cur);
    prevMonth.setMonth(cur.getMonth() - 1);
    const diff = Math.round((prevMonth - dndToday()) / 86400000);
    monthPrevBtn.disabled = diff < -DND_DATE_RANGE;
  }
  if (monthNextBtn) {
    const cur = dndGetCurrentDate();
    const nextMonth = new Date(cur);
    nextMonth.setMonth(cur.getMonth() + 1);
    const diff = Math.round((nextMonth - dndToday()) / 86400000);
    monthNextBtn.disabled = diff > DND_DATE_RANGE;
  }

  // 月ピル：「2026年5月」のような表示
  const monthPillLabel = document.getElementById('dnd-month-pill-label');
  if (monthPillLabel) {
    const cur = dndGetCurrentDate();
    monthPillLabel.textContent = `${cur.getFullYear()}年${cur.getMonth() + 1}月`;
  }

  // ピル表示（今日/過去/未来）
  const pill = document.getElementById('dnd-date-pill');
  if (pill) {
    pill.classList.remove('show','past','future');
    if (dndDateOffset === 0) {
      pill.textContent = '今日';
      pill.classList.add('show');
    } else if (dndDateOffset < 0) {
      pill.textContent = `${dndDateOffset}日`;
      pill.classList.add('show','past');
    } else {
      pill.textContent = `+${dndDateOffset}日`;
      pill.classList.add('show','future');
    }
  }

  // 日付ストリップ（前後7日）
  const strip = document.getElementById('dnd-date-strip');
  if (strip) {
    const today = dndToday();
    const currentDate = dndGetCurrentDate(); // 現在表示中の日付（ストリップの中心）
    const DOW = ['日','月','火','水','木','金','土'];
    const chips = [];
    for (let off = -DND_STRIP_RANGE; off <= DND_STRIP_RANGE; off++) {
      const d = dndAddDays(currentDate, off);
      const key = dndDateKey(d);
      // 全体オフセット（today基準）：表示中＋strip内オフセット
      const totalOff = dndDateOffset + off;
      const isActive = off === 0; // ストリップの中心が現在選択中
      const isToday = totalOff === 0;
      const isPast = totalOff < 0 && !isActive;
      const dow = d.getDay();
      const isWeekend = dow === 0 || dow === 6;
      // この日の総割当数
      let count = 0;
      const isConfTab = (typeof currentDispatchTab !== 'undefined' && currentDispatchTab === 'confirmed');
      dndDrivers.forEach(drv => {
        if (isConfTab) {
          const arr = (dndConfirmedAssignments[drv.id] && dndConfirmedAssignments[drv.id][key]) || [];
          count += arr.length;
        } else {
          const arr = (dndAssignments[drv.id] && dndAssignments[drv.id][key]) || [];
          count += arr.filter(a => !a.isPreset).length;
        }
      });
      const cls = [
        'dnd-date-chip',
        isActive ? 'active' : '',
        isToday ? 'today' : '',
        isPast && !isActive ? 'past' : '',
        isWeekend ? 'weekend' : '',
      ].filter(Boolean).join(' ');
      chips.push(`<button class="${cls}" onclick="dndSetDateOffset(${totalOff})" title="${d.toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'long'})}">
        <span class="dnd-date-chip-dow">${DOW[dow]}</span>
        <span class="dnd-date-chip-day">${d.getDate()}</span>
        <span class="dnd-date-chip-count">${count > 0 ? '●'.repeat(Math.min(count,3)) : ''}</span>
      </button>`);
    }
    strip.innerHTML = chips.join('');
  }
}

// 日付ナビ操作
function dndNavDate(dir) {
  const next = dndDateOffset + dir;
  if (next < -DND_DATE_RANGE || next > DND_DATE_RANGE) return;
  dndDateOffset = next;
  renderDnd();
}
function dndNavDateToday() {
  dndDateOffset = 0;
  renderDnd();
}
function dndSetDateOffset(off) {
  off = Math.max(-DND_DATE_RANGE, Math.min(DND_DATE_RANGE, off));
  dndDateOffset = off;
  renderDnd();
}

// ── 月切替：現在表示中の日付の月だけを動かす（日は維持） ──
function dndNavMonth(dir) {
  const cur = dndGetCurrentDate();
  const target = new Date(cur);
  target.setMonth(cur.getMonth() + dir);
  // 月跨ぎで日が存在しない場合の補正（例：1/31→2/末日）
  if (target.getMonth() !== ((cur.getMonth() + dir) % 12 + 12) % 12) {
    // setMonthによる自動補正で月がさらにずれた → 最終日に戻す
    target.setDate(0); // 前月の末日に
  }
  const diff = Math.round((target - dndToday()) / 86400000);
  if (diff < -DND_DATE_RANGE || diff > DND_DATE_RANGE) return;
  dndDateOffset = diff;
  renderDnd();
}

// ── 月ピッカー：年月を直接選択 ──
let _dndMpYear = null; // ピッカーで表示中の年
function dndToggleMonthPicker(evt) {
  if (evt) evt.stopPropagation();
  const pop = document.getElementById('dnd-month-picker');
  if (!pop) return;
  const isOpen = pop.classList.contains('open');
  if (isOpen) {
    pop.classList.remove('open');
    return;
  }
  // 現在表示中の月を初期表示
  const cur = dndGetCurrentDate();
  _dndMpYear = cur.getFullYear();
  dndMpRender();
  // ピルの直下に配置
  const pill = document.getElementById('dnd-month-pill');
  if (pill) {
    const rect = pill.getBoundingClientRect();
    pop.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    pop.style.left = (rect.left + window.scrollX) + 'px';
  }
  pop.classList.add('open');
  // 外側クリックで閉じる
  setTimeout(() => {
    const handler = (e) => {
      if (!pop.contains(e.target) && !e.target.closest('#dnd-month-pill')) {
        pop.classList.remove('open');
        document.removeEventListener('click', handler, true);
      }
    };
    document.addEventListener('click', handler, true);
  }, 0);
}

function dndMpChangeYear(dir) {
  _dndMpYear += dir;
  dndMpRender();
}

function dndMpRender() {
  const yearLabel = document.getElementById('dnd-mp-year-label');
  const monthsEl = document.getElementById('dnd-mp-months');
  if (!yearLabel || !monthsEl) return;
  yearLabel.textContent = _dndMpYear + '年';
  const today = dndToday();
  const cur = dndGetCurrentDate();
  const curY = cur.getFullYear();
  const curM = cur.getMonth();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const months = [];
  for (let m = 0; m < 12; m++) {
    const isActive = _dndMpYear === curY && m === curM;
    const isCurrent = _dndMpYear === todayY && m === todayM;
    // この月が範囲外なら disable
    const targetDate = new Date(_dndMpYear, m, 1);
    const diff = Math.round((targetDate - today) / 86400000);
    const outOfRange = diff < -DND_DATE_RANGE - 31 || diff > DND_DATE_RANGE + 31;
    const cls = ['dnd-mp-month', isActive ? 'active' : '', isCurrent ? 'current' : ''].filter(Boolean).join(' ');
    months.push(`<button class="${cls}" ${outOfRange ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''} onclick="dndMpSelectMonth(${_dndMpYear}, ${m})">
      ${m + 1}月
    </button>`);
  }
  monthsEl.innerHTML = months.join('');
}

function dndMpSelectMonth(year, month) {
  // 現在表示中の日付の「日」を維持して年月を変える
  const cur = dndGetCurrentDate();
  const targetDay = cur.getDate();
  // 月の最終日チェック
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(targetDay, lastDayOfMonth);
  const target = new Date(year, month, day);
  const diff = Math.round((target - dndToday()) / 86400000);
  const clamped = Math.max(-DND_DATE_RANGE, Math.min(DND_DATE_RANGE, diff));
  dndDateOffset = clamped;
  const pop = document.getElementById('dnd-month-picker');
  if (pop) pop.classList.remove('open');
  renderDnd();
}

function dndSetFilter(f) {
  dndCurrentFilter = f;
  document.querySelectorAll('.dnd-filter-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.filter === f);
  });
  renderDndList();
}

function isCaseAssigned(caseId) {
  for (const did in dndAssignments) {
    const byDate = dndAssignments[did] || {};
    for (const k in byDate) {
      if (byDate[k].some(a => a.caseId === caseId)) return true;
    }
  }
  return false;
}

// 案件がどの日付・ドライバーに割当られているかを返す
function findCaseAssignment(caseId) {
  for (const did in dndAssignments) {
    const byDate = dndAssignments[did] || {};
    for (const k in byDate) {
      const idx = byDate[k].findIndex(a => a.caseId === caseId);
      if (idx >= 0) return { driverId: did, dateKey: k, index: idx, block: byDate[k][idx] };
    }
  }
  return null;
}

function renderDndList() {
  const list = document.getElementById('dnd-list');
  if (!list) return;

  const isConfirmedTab = (typeof currentDispatchTab !== 'undefined' && currentDispatchTab === 'confirmed');

  // ── 確定済みタブ：請求確定済み案件のみを参照表示（ドラッグ不可） ──
  if (isConfirmedTab) {
    const confirmed = (typeof processedCases !== 'undefined' ? processedCases : [])
      .filter(function(c){ return c.billingConfirmed; });

    // バッジ
    const badge = document.getElementById('dnd-unassigned-count');
    if (badge) badge.textContent = confirmed.length;

    if (confirmed.length === 0) {
      list.innerHTML = `<div class="dnd-empty">
        <div class="dnd-empty-icon">📋</div>
        <div>請求確定済みの案件はありません</div>
      </div>`;
      return;
    }

    list.innerHTML = confirmed.map(function(c) {
      // 完了日のラベル
      const compMatch = String(c.completion || '').match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/);
      const dateStr = compMatch ? `${compMatch[2]}/${compMatch[3]} ${compMatch[4]}:${compMatch[5]}` : (c.completion || '—');
      return `
        <div class="dnd-card readonly is-confirmed" data-case-id="${c.id}" draggable="false">
          <div class="dnd-card-head">
            <div class="dnd-card-client" title="${c.client}">${c.client}</div>
            <div class="dnd-card-status confirmed">請求確定済み</div>
          </div>
          <div class="dnd-card-route">
            <span style="color:var(--text-muted)">📍</span>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.from} → ${c.to}</span>
          </div>
          <div style="font-size:10px;color:var(--text-secondary);line-height:1.4">${c.goods}</div>
          <div class="dnd-card-meta">
            <span class="dnd-card-chip">✓ 完了 ${dateStr}</span>
            <span class="dnd-card-chip">🚚 ${c.driver}</span>
          </div>
        </div>`;
    }).join('');
    return;
  }

  // ── 計画中タブ（既存ロジック） ──
  // 「処理済み」タブは個別案件処理の processedCases を直接参照（件数も完全連動）。
  // それ以外のタブ（すべて/未処理・処理中）は dndUnassignedCases から「未処理済み」を表示。
  let filtered;
  if (dndCurrentFilter === 'processed') {
    // 個別案件処理の processedCases をカード形式にして表示
    const sourceCases = (typeof processedCases !== 'undefined' && Array.isArray(processedCases))
      ? processedCases
      : [];
    filtered = sourceCases.map(_buildProcessedCardFromProcessedCase).filter(c => {
      // 荷主名検索（部分一致・大文字小文字区別なし）
      if (dndSearchQuery) {
        const q = dndSearchQuery.toLowerCase();
        const client = String(c.client || '').toLowerCase();
        if (client.indexOf(q) < 0) return false;
      }
      return true;
    });
  } else {
    filtered = dndUnassignedCases.filter(c => {
      const processed = isCaseProcessed(c.id);
      // 処理済みは他タブから除外
      if (processed) return false;
      // ステータス絞り込み
      if (dndCurrentFilter === 'pending') {
        if (c.status !== 'unprocessed' && c.status !== 'processing') return false;
      } else if (dndCurrentFilter !== 'all') {
        if (c.status !== dndCurrentFilter) return false;
      }
      // 荷主名検索（部分一致・大文字小文字区別なし）
      if (dndSearchQuery) {
        const q = dndSearchQuery.toLowerCase();
        const client = String(c.client || '').toLowerCase();
        if (client.indexOf(q) < 0) return false;
      }
      return true;
    });
    // 割当済み（薄く表示されるカード）を末尾に並び替え
    // 未割当案件は元の順序を維持し、割当済みカードのみ最下部に押し下げる
    filtered.sort((a, b) => {
      const aAssigned = !!findCaseAssignment(a.id);
      const bAssigned = !!findCaseAssignment(b.id);
      if (aAssigned === bAssigned) return 0;
      return aAssigned ? 1 : -1;
    });
  }

  // 「処理済み」タブのカウント = processedCases.length と完全一致
  const processedCount = (typeof processedCases !== 'undefined' && Array.isArray(processedCases))
    ? processedCases.length
    : 0;
  const processedCountEl = document.getElementById('dnd-filter-count-processed');
  if (processedCountEl) processedCountEl.textContent = processedCount;

  // ヘッダーバッジはサイドバーバッジと同じ計算ロジック（共通関数）を使う
  const unassignedCount = (typeof countDispatchUnassigned === 'function')
    ? countDispatchUnassigned()
    : dndUnassignedCases.filter(c => !isCaseAssigned(c.id)).length;
  const badge = document.getElementById('dnd-unassigned-count');
  if (badge) badge.textContent = unassignedCount;
  // サイドバーバッジも同時に更新
  if (typeof updateDispatchNavBadge === 'function') updateDispatchNavBadge();

  if (filtered.length === 0) {
    let emptyMsg = '該当する案件はありません';
    let emptyIcon = '📭';
    if (dndSearchQuery) {
      emptyMsg = `「${dndSearchQuery}」に一致する荷主はありません`;
      emptyIcon = '🔍';
    } else if (dndCurrentFilter === 'processed') {
      emptyMsg = '処理済みの案件はまだありません';
      emptyIcon = '✓';
    }
    list.innerHTML = `<div class="dnd-empty">
      <div class="dnd-empty-icon">${emptyIcon}</div>
      <div>${emptyMsg}</div>
    </div>`;
    return;
  }

  list.innerHTML = filtered.map(c => {
    const assignment = findCaseAssignment(c.id);
    const assigned = !!assignment;
    const processed = isCaseProcessed(c.id);
    const statusLabel = processed ? '処理済み' : (c.status === 'unprocessed' ? '未処理' : '処理中');
    const statusClass = processed ? 'processed' : c.status;
    // 割当済みの場合：いつ・誰にの情報を組み立て
    let assignedInfo = '';
    if (assignment) {
      const drv = dndDrivers.find(x => x.id === assignment.driverId);
      const d = new Date(assignment.dateKey + 'T00:00:00');
      const today = dndToday();
      const diffDays = Math.round((d - today) / 86400000);
      let dayLabel;
      if (diffDays === 0) dayLabel = '今日';
      else if (diffDays === 1) dayLabel = '明日';
      else if (diffDays === -1) dayLabel = '昨日';
      else if (diffDays > 0) dayLabel = `+${diffDays}日`;
      else dayLabel = `${diffDays}日`;
      const dateStr = d.toLocaleDateString('ja-JP',{month:'numeric',day:'numeric',weekday:'short'});
      const checkMark = processed ? '✅' : '✓';
      assignedInfo = `<div style="font-size:9px;font-weight:700;color:${processed ? '#16a34a' : 'var(--accent)'};margin-top:5px;display:flex;align-items:center;gap:4px;flex-wrap:wrap">
        <span>${checkMark} ${dateStr}（${dayLabel}）${processed ? '配車確定済み' : ''}</span>
        <span style="color:var(--text-secondary)">${drv ? drv.driver : ''} ${assignment.block.start}〜${assignment.block.end}</span>
      </div>`;
    } else if (processed) {
      // 処理済みかつ未割当（processedCases由来）：個別案件処理の処理済みからの参照
      // processedCases の該当案件から完了情報を取得
      let processedRef = null;
      if (typeof processedCases !== 'undefined') {
        processedRef = processedCases.find(x => x.id === c.id)
                    || (c.caseListId ? processedCases.find(x => x.id === c.caseListId) : null);
      }
      if (processedRef) {
        const driverName = processedRef.driver || '—';
        const completion = processedRef.completion || '完了';
        assignedInfo = `<div style="font-size:9px;font-weight:700;color:#16a34a;margin-top:5px;display:flex;align-items:center;gap:4px;flex-wrap:wrap">
          <span>✅ ${completion}</span>
          <span style="color:var(--text-secondary)">🚚 ${driverName}</span>
          <span style="color:var(--text-muted);font-weight:500">クリックで個別案件処理へ →</span>
        </div>`;
      } else {
        assignedInfo = `<div style="font-size:9px;font-weight:700;color:#16a34a;margin-top:5px;">
          <span>✅ 処理済み</span>
          <span style="color:var(--text-muted);font-weight:500;margin-left:4px">クリックで個別案件処理へ →</span>
        </div>`;
      }
    }
    // 協力会社へ依頼ボタン（処理済みでは非表示・割当済みでは非表示）
    const partnerBtn = (!processed && !assigned) ? `
        <button class="dnd-card-partner-btn"
          onclick="event.stopPropagation();openDndPartnerModal('${c.id}')"
          onmousedown="event.stopPropagation()"
          ondragstart="event.preventDefault();event.stopPropagation()"
          draggable="false"
          title="協力会社へ依頼する">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="9" cy="7" r="4"/>
            <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
          </svg>
          協力会社へ依頼
        </button>` : '';

    return `
      <div class="dnd-card ${assigned ? 'assigned' : ''} ${processed ? 'is-processed' : ''}"
           data-case-id="${c.id}"
           draggable="${(assigned || processed) ? 'false' : 'true'}"
           ${(assigned || processed) ? `onclick="dndJumpToAssignment('${c.id}')" style="cursor:pointer"` : `onmousedown="dndCardMouseDown(event,'${c.id}')"
           ondragstart="dndCardDragStart(event,'${c.id}')"
           ondragend="dndCardDragEnd(event)"`}>
        <div class="dnd-card-head">
          <div class="dnd-card-client" title="${c.client}">${c.client}</div>
          <div class="dnd-card-status ${statusClass}">${statusLabel}</div>
          ${(assigned || processed) ? '' : `<button class="dnd-card-edit-btn"
            onclick="event.stopPropagation();openDndEditModal('${c.id}')"
            onmousedown="event.stopPropagation()"
            ondragstart="event.preventDefault();event.stopPropagation()"
            draggable="false"
            title="案件情報を編集">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            編集
          </button>`}
        </div>
        <div class="dnd-card-route">
          <span style="color:var(--text-muted)">📍</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.from} → ${c.to}</span>
        </div>
        <div style="font-size:10px;color:var(--text-secondary);line-height:1.4">${c.goods}</div>
        <div class="dnd-card-meta">
          <span class="dnd-card-chip time">⏱ ${c.preferredStart}〜 / ${c.durationH}h</span>
          ${c.urgent ? `<span class="dnd-card-chip urgent">⚡ ${c.deadline}</span>` : `<span class="dnd-card-chip">${c.deadline}</span>`}
        </div>
        ${assignedInfo}
        ${partnerBtn}
      </div>`;
  }).join('');
}

// 割当済みカードをクリックしたら該当日付へジャンプ
// 処理済みカード（processedCases由来）の場合は個別案件処理の処理済みタブへジャンプ
function dndJumpToAssignment(caseId) {
  // まず処理済みかチェック
  if (typeof processedCases !== 'undefined' && Array.isArray(processedCases)) {
    const pc = processedCases.find(c => c.id === caseId);
    if (pc) {
      // 個別案件処理の処理済みタブへ移動
      if (typeof gotoCaseProcessing === 'function') {
        gotoCaseProcessing('processed');
      }
      return;
    }
    // caseListId 経由で processedCases に紐付くケースも対応
    if (typeof dndUnassignedCases !== 'undefined') {
      const card = dndUnassignedCases.find(x => x.id === caseId);
      if (card && card.caseListId) {
        const pc2 = processedCases.find(c => c.id === card.caseListId);
        if (pc2) {
          if (typeof gotoCaseProcessing === 'function') {
            gotoCaseProcessing('processed');
          }
          return;
        }
      }
    }
  }
  // それ以外（配車割当済み）はタイムラインの該当日付へ
  const a = findCaseAssignment(caseId);
  if (!a) return;
  const targetDate = new Date(a.dateKey + 'T00:00:00');
  const today = dndToday();
  const off = Math.round((targetDate - today) / 86400000);
  dndSetDateOffset(off);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 未割当案件 → 協力会社へ依頼モーダル連携
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 個別案件処理（openPartnerModal）と同じモーダルを使うため、
// dndUnassignedCases の案件を unprocessedCases 形式に変換して
// 同じフローを呼び出す。
function openDndPartnerModal(caseId) {
  const c = (typeof dndUnassignedCases !== 'undefined')
    ? dndUnassignedCases.find(x => x.id === caseId)
    : null;
  if (!c) {
    if (typeof showDndToast === 'function') showDndToast('案件が見つかりません');
    return;
  }

  // 既存の unprocessedCases / processingCases に該当案件があれば、そのindexで呼ぶ
  if (c.caseListId) {
    if (typeof unprocessedCases !== 'undefined') {
      const upIdx = unprocessedCases.findIndex(x => x.id === c.caseListId);
      if (upIdx >= 0 && typeof openPartnerModal === 'function') {
        openPartnerModal(upIdx, 'unprocessed');
        return;
      }
    }
    if (typeof processingCases !== 'undefined') {
      const prIdx = processingCases.findIndex(x => x.id === c.caseListId);
      if (prIdx >= 0 && typeof openPartnerModal === 'function') {
        openPartnerModal(prIdx, 'processing');
        return;
      }
    }
  }

  // 紐付け先がない仮想案件 → 一時的に unprocessedCases へ追加してモーダル呼び出し、終わったら削除
  if (typeof unprocessedCases === 'undefined' || typeof openPartnerModal !== 'function') {
    if (typeof showDndToast === 'function') showDndToast('協力会社モーダルを開けません');
    return;
  }

  // 案件オブジェクトを unprocessedCases 形式に変換
  // 必要最小限のフィールド：id, status, client, from, to, goods, deadline, ch, time, analyzed, casePattern, aiResult, vehicles
  const tempCase = {
    id: c.id || ('TEMP-' + Date.now()),
    status: '未解析',
    client: c.client,
    from: c.from,
    to: c.to,
    goods: c.goods,
    deadline: c.deadline,
    ch: 'tel',
    time: c.preferredStart || '09:00',
    analyzed: false,
    casePattern: c.urgent ? 'スポット案件' : '定期案件',
    aiResult: {
      confidence: '中信頼度',
      client: c.client,
      from: c.from,
      to: c.to,
      goods: c.goods,
      deadline: c.deadline,
      conditions: c.urgent ? '緊急対応' : '通常',
      vehicle: '中型',
      count: 1
    },
    vehicles: [],
    fareResult: null,
    _isTempFromDnd: true // 後で削除するためのマーカー
  };

  // 一時追加してインデックスを取得
  const tempIdx = unprocessedCases.length;
  unprocessedCases.push(tempCase);

  // モーダルを開く
  try {
    openPartnerModal(tempIdx, 'unprocessed');
  } catch (e) {
    console.warn('openPartnerModal error:', e);
    // 失敗時は元に戻す
    unprocessedCases.splice(tempIdx, 1);
    if (typeof showDndToast === 'function') showDndToast('モーダルを開けませんでした');
    return;
  }

  // モーダルが閉じられた時に一時データを削除するためのオブザーバを設定
  const modal = document.getElementById('partner-modal');
  if (modal && !modal._dndTempObserverHooked) {
    const obs = new MutationObserver(() => {
      if (!modal.classList.contains('open')) {
        // モーダルが閉じられた → 一時データを掃除
        for (let i = unprocessedCases.length - 1; i >= 0; i--) {
          if (unprocessedCases[i]._isTempFromDnd) {
            unprocessedCases.splice(i, 1);
          }
        }
      }
    });
    obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
    modal._dndTempObserverHooked = true;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 未割当案件 編集モーダル
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 編集中の案件ID（dndUnassignedCases.id）
let dndEditingCaseId = null;
let dndEditUrgentState = false;

// preferredStart を <input type="time"> 用に正規化（"9:00" -> "09:00"）
function dndNormalizeTime(t) {
  if (!t) return '';
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  const h = String(parseInt(m[1], 10)).padStart(2, '0');
  return `${h}:${m[2]}`;
}

// 編集モーダルを開く
function openDndEditModal(caseId) {
  const c = dndUnassignedCases.find(x => x.id === caseId);
  if (!c) { console.warn('[dndEdit] case not found:', caseId); return; }

  dndEditingCaseId = caseId;
  dndEditUrgentState = !!c.urgent;

  // 案件IDバッジ：D-XXX (案件一覧 No.YYYY)
  const noText = c.caseListId
    ? `${c.id}　│　個別案件処理 No. ${c.caseListId}`
    : `${c.id}（D&D独自案件）`;
  const elNo = document.getElementById('dnd-edit-caseno-text');
  if (elNo) elNo.textContent = noText;

  // フィールド初期化
  document.getElementById('dnd-edit-client').value   = c.client   || '';
  document.getElementById('dnd-edit-from').value     = c.from     || '';
  document.getElementById('dnd-edit-to').value       = c.to       || '';
  document.getElementById('dnd-edit-goods').value    = c.goods    || '';
  document.getElementById('dnd-edit-start').value    = dndNormalizeTime(c.preferredStart);
  document.getElementById('dnd-edit-duration').value = (c.durationH != null) ? c.durationH : '';
  document.getElementById('dnd-edit-deadline').value = c.deadline || '';

  // 緊急トグル
  const urgentRow = document.getElementById('dnd-edit-urgent-row');
  if (urgentRow) urgentRow.classList.toggle('active', dndEditUrgentState);

  // 連動バナーの表示切替
  const banner = document.getElementById('dnd-edit-sync-banner');
  if (banner) {
    if (c.caseListId) {
      banner.classList.remove('no-link');
      banner.innerHTML = `<span class="dnd-edit-sync-banner-icon">🔄</span>
        <div><strong>個別案件処理と連動</strong><br>
        ここで保存した変更は、個別案件処理ページの <strong>No. ${c.caseListId}</strong> のカード・詳細パネルにも反映されます。</div>`;
    } else {
      banner.classList.add('no-link');
      banner.innerHTML = `<span class="dnd-edit-sync-banner-icon">ℹ️</span>
        <div><strong>このカードは個別案件処理と紐付いていません</strong><br>
        配車計画表のみで管理されている独自カードです。変更は配車計画表内のみに反映されます。</div>`;
    }
  }

  // モーダル表示
  const modal = document.getElementById('dnd-edit-modal');
  if (modal) modal.classList.add('open');

  // 最初のフィールドにフォーカス
  setTimeout(() => {
    const f = document.getElementById('dnd-edit-client');
    if (f) f.focus();
  }, 80);
}

// 緊急フラグトグル
function dndEditToggleUrgent() {
  dndEditUrgentState = !dndEditUrgentState;
  const row = document.getElementById('dnd-edit-urgent-row');
  if (row) row.classList.toggle('active', dndEditUrgentState);
}

// 背景クリックで閉じる
function dndEditModalBgClick(ev) {
  if (ev.target && ev.target.id === 'dnd-edit-modal') closeDndEditModal();
}

// モーダルを閉じる
function closeDndEditModal() {
  const modal = document.getElementById('dnd-edit-modal');
  if (modal) modal.classList.remove('open');
  dndEditingCaseId = null;
}

// ESCで閉じる
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const modal = document.getElementById('dnd-edit-modal');
    if (modal && modal.classList.contains('open')) closeDndEditModal();
  }
});

// 保存：dndUnassignedCases と 案件一覧側（unprocessedCases / processingCases）を同期更新
function saveDndEditModal() {
  if (!dndEditingCaseId) return;
  const c = dndUnassignedCases.find(x => x.id === dndEditingCaseId);
  if (!c) { closeDndEditModal(); return; }

  // 値取得
  const newClient   = (document.getElementById('dnd-edit-client').value || '').trim();
  const newFrom     = (document.getElementById('dnd-edit-from').value || '').trim();
  const newTo       = (document.getElementById('dnd-edit-to').value || '').trim();
  const newGoods    = (document.getElementById('dnd-edit-goods').value || '').trim();
  const newStart    = (document.getElementById('dnd-edit-start').value || '').trim();
  const newDuration = parseFloat(document.getElementById('dnd-edit-duration').value);
  const newDeadline = (document.getElementById('dnd-edit-deadline').value || '').trim();
  const newUrgent   = !!dndEditUrgentState;

  // 必須チェック
  if (!newClient || !newFrom || !newTo) {
    alert('取引先・発地・着地は必須項目です');
    return;
  }

  // D&D側を更新
  c.client = newClient;
  c.from   = newFrom;
  c.to     = newTo;
  c.goods  = newGoods;
  c.preferredStart = newStart || c.preferredStart;
  if (!isNaN(newDuration) && newDuration > 0) c.durationH = newDuration;
  c.deadline = newDeadline;
  c.urgent = newUrgent;

  // 案件一覧側を同期更新（caseListId が紐付いている場合のみ）
  let listSynced = false;
  if (c.caseListId) {
    // unprocessedCases
    if (typeof unprocessedCases !== 'undefined') {
      const u = unprocessedCases.find(x => x.id === c.caseListId);
      if (u) {
        u.client   = newClient;
        u.from     = newFrom;
        u.to       = newTo;
        u.goods    = newGoods;
        u.deadline = newDeadline;
        // AI抽出結果側にも反映（存在すれば）
        if (u.aiResult) {
          u.aiResult.client   = newClient;
          u.aiResult.from     = newFrom;
          u.aiResult.to       = newTo;
          u.aiResult.goods    = newGoods;
          u.aiResult.deadline = newDeadline;
        }
        listSynced = true;
      }
    }
    // processingCases
    if (typeof processingCases !== 'undefined') {
      const p = processingCases.find(x => x.id === c.caseListId);
      if (p) {
        p.client   = newClient;
        p.from     = newFrom;
        p.to       = newTo;
        p.goods    = newGoods;
        p.deadline = newDeadline;
        listSynced = true;
      }
    }
    // 顧客ページの allCasesMasterData (custRenderAllCases 用) も同期
    if (typeof allCasesMasterData !== 'undefined') {
      const a = allCasesMasterData.find(x => x.id === c.caseListId);
      if (a) {
        a.client = newClient;
        a.from   = newFrom;
        a.to     = newTo;
        a.deadline = newDeadline;
      }
    }
  }

  // D&Dビューを再描画
  if (typeof renderDndList === 'function') renderDndList();
  if (typeof renderDndTimeline === 'function') renderDndTimeline();

  // 案件一覧側の表示を再描画（関数が存在すれば呼ぶ）
  if (typeof renderUnprocessedList === 'function') {
    try { renderUnprocessedList(); } catch (e) { console.warn('[dndEdit] renderUnprocessedList failed', e); }
  }
  if (typeof renderProcessingList === 'function') {
    try { renderProcessingList(); } catch (e) { console.warn('[dndEdit] renderProcessingList failed', e); }
  }
  // 現在開いている詳細パネルが対象案件なら詳細も再描画
  if (c.caseListId && typeof unprocessedCases !== 'undefined') {
    const uIdx = unprocessedCases.findIndex(x => x.id === c.caseListId);
    if (uIdx >= 0 && typeof selectedUnprocessedId !== 'undefined'
        && String(selectedUnprocessedId) === String(c.caseListId)
        && typeof renderUnprocessedDetail === 'function') {
      try { renderUnprocessedDetail(uIdx); } catch (e) { console.warn('[dndEdit] renderUnprocessedDetail failed', e); }
    }
  }
  if (c.caseListId && typeof processingCases !== 'undefined') {
    const pIdx = processingCases.findIndex(x => x.id === c.caseListId);
    if (pIdx >= 0 && typeof selectedProcessing !== 'undefined'
        && selectedProcessing === pIdx
        && typeof renderProcessingDetail === 'function') {
      try { renderProcessingDetail(pIdx); } catch (e) { console.warn('[dndEdit] renderProcessingDetail failed', e); }
    }
  }
  // 顧客タブで開かれている案件一覧も再描画
  if (typeof custRenderAllCases === 'function') {
    try { custRenderAllCases(); } catch (e) { /* 静かに無視 */ }
  }

  // 完了トースト
  const toastText = document.getElementById('dnd-edit-toast-text');
  if (toastText) {
    toastText.textContent = listSynced
      ? '変更を保存し、個別案件処理に反映しました'
      : '変更を保存しました';
  }
  const toast = document.getElementById('dnd-edit-toast');
  if (toast) {
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2400);
  }

  closeDndEditModal();
}

// ─────────────────────────────────────────────
// 車両（行）並び替え機能：重量順ソート ＋ D&D 入れ替え
// ─────────────────────────────────────────────
// 並び順の状態：'original' | 'desc' | 'asc' | 'custom'
//  - original : マスタ初期順（_DND_INIT_DRIVERS 由来）
//  - desc     : maxLoad 降順
//  - asc      : maxLoad 昇順
//  - custom   : ユーザーが D&D で手動並び替えした
let dndVehicleSortMode = 'original';
// 初期順を保存しておく（custom やソート解除時に復元するため）
const _DND_DRIVERS_ORIGINAL_ORDER = dndDrivers.map(d => d.id);

function dndApplyVehicleSort() {
  // dndDrivers は const だがミドルクオートで配列中身は変更可能。インプレースで並び替える。
  if (dndVehicleSortMode === 'original') {
    // 初期順に戻す
    const idx = new Map(_DND_DRIVERS_ORIGINAL_ORDER.map((id, i) => [id, i]));
    dndDrivers.sort((a, b) => (idx.get(a.id) ?? 0) - (idx.get(b.id) ?? 0));
  } else if (dndVehicleSortMode === 'desc') {
    dndDrivers.sort((a, b) => (b.maxLoad || 0) - (a.maxLoad || 0));
  } else if (dndVehicleSortMode === 'asc') {
    dndDrivers.sort((a, b) => (a.maxLoad || 0) - (b.maxLoad || 0));
  }
  // 'custom' の場合は何もしない（既に dndDrivers が手動順序になっている）
}

function dndUpdateSortBtnUI() {
  const btn = document.getElementById('dnd-sort-weight-btn');
  const label = document.getElementById('dnd-sort-weight-label');
  const arrow = document.getElementById('dnd-sort-weight-arrow');
  if (!btn || !label || !arrow) return;
  // 確定済みタブでは並び替えの意味が薄いのでボタンを隠す
  const isConfirmedTab = (typeof currentDispatchTab !== 'undefined' && currentDispatchTab === 'confirmed');
  btn.style.display = isConfirmedTab ? 'none' : '';
  if (isConfirmedTab) return;
  if (dndVehicleSortMode === 'desc') {
    btn.classList.add('active');
    label.textContent = '重量順';
    arrow.textContent = '↓';
    btn.title = '現在：重量降順（重い→軽い）。クリックで昇順に切替';
  } else if (dndVehicleSortMode === 'asc') {
    btn.classList.add('active');
    label.textContent = '重量順';
    arrow.textContent = '↑';
    btn.title = '現在：重量昇順（軽い→重い）。クリックで解除';
  } else if (dndVehicleSortMode === 'custom') {
    btn.classList.remove('active');
    label.textContent = '手動順';
    arrow.textContent = '';
    btn.title = 'D&Dで手動並び替え中。クリックで重量降順に並び替え';
  } else {
    btn.classList.remove('active');
    label.textContent = '重量順';
    arrow.textContent = '';
    btn.title = 'クリックで重量降順に並び替え';
  }
}

function dndCycleVehicleSort() {
  // original → desc → asc → original の循環。custom 状態からは desc へ。
  if (dndVehicleSortMode === 'original' || dndVehicleSortMode === 'custom') {
    dndVehicleSortMode = 'desc';
  } else if (dndVehicleSortMode === 'desc') {
    dndVehicleSortMode = 'asc';
  } else {
    dndVehicleSortMode = 'original';
  }
  dndApplyVehicleSort();
  dndUpdateSortBtnUI();
  // renderDndTimeline は v1/v2 IIFE 側でフックされており、
  // 担当バッジ・拠点バッジ・確定済みブロック等の装飾が自動で再適用される。
  renderDndTimeline();
}

// ─────────────────────────────────────────────
// 行（ドライバー/車両）の D&D 並び替え
// ─────────────────────────────────────────────
let _dndRowDragSrcId = null;        // ドラッグ中の行（driver id）
let _dndRowDropTargetId = null;     // 現在ホバーしている行の id
let _dndRowDropPosition = null;     // 'before' | 'after'

function dndRowDragStart(ev, driverId) {
  // 確定済みタブやリレー仮想行は D&D 不可
  const isConfirmedTab = (typeof currentDispatchTab !== 'undefined' && currentDispatchTab === 'confirmed');
  if (isConfirmedTab) { ev.preventDefault(); return; }
  _dndRowDragSrcId = driverId;
  try {
    ev.dataTransfer.effectAllowed = 'move';
    // 既存のブロック D&D と区別するため独自タイプを設定
    ev.dataTransfer.setData('application/x-dnd-driver-row', driverId);
    // Firefox など text/plain がないと開始しない環境向けのフォールバック
    ev.dataTransfer.setData('text/plain', 'driver-row:' + driverId);
  } catch (e) {}
  // ドラッグ中の見た目
  const row = ev.currentTarget.closest('.dnd-row');
  if (row) row.classList.add('dnd-row-dragging');
}

function dndRowDragEnd(ev) {
  // 後始末
  document.querySelectorAll('.dnd-row.dnd-row-dragging')
    .forEach(r => r.classList.remove('dnd-row-dragging'));
  document.querySelectorAll('.dnd-row-drop-before, .dnd-row-drop-after')
    .forEach(r => { r.classList.remove('dnd-row-drop-before'); r.classList.remove('dnd-row-drop-after'); });
  _dndRowDragSrcId = null;
  _dndRowDropTargetId = null;
  _dndRowDropPosition = null;
}

function dndRowDragOver(ev, driverId) {
  if (!_dndRowDragSrcId) return;          // 行 D&D 中でなければ無視（ブロック D&D を妨げない）
  if (driverId === _dndRowDragSrcId) return;
  ev.preventDefault();
  ev.dataTransfer.dropEffect = 'move';
  // セル内の上半分なら before、下半分なら after
  const cell = ev.currentTarget;
  const rect = cell.getBoundingClientRect();
  const pos = (ev.clientY - rect.top) < (rect.height / 2) ? 'before' : 'after';
  // 既存のインジケータをクリア
  document.querySelectorAll('.dnd-row-drop-before, .dnd-row-drop-after')
    .forEach(r => { r.classList.remove('dnd-row-drop-before'); r.classList.remove('dnd-row-drop-after'); });
  const row = cell.closest('.dnd-row');
  if (row) row.classList.add(pos === 'before' ? 'dnd-row-drop-before' : 'dnd-row-drop-after');
  _dndRowDropTargetId = driverId;
  _dndRowDropPosition = pos;
}

function dndRowDragLeave(ev) {
  // セルを完全に離れた時のみインジケータを消す（子要素間の出入りは無視）
  const cell = ev.currentTarget;
  const rel = ev.relatedTarget;
  if (rel && cell.contains(rel)) return;
  const row = cell.closest('.dnd-row');
  if (row) { row.classList.remove('dnd-row-drop-before'); row.classList.remove('dnd-row-drop-after'); }
}

function dndRowDrop(ev, driverId) {
  if (!_dndRowDragSrcId) return;
  ev.preventDefault();
  ev.stopPropagation();
  const srcId = _dndRowDragSrcId;
  const targetId = driverId;
  const pos = _dndRowDropPosition || 'after';
  // 後始末は dragend にも入るが、念のため
  document.querySelectorAll('.dnd-row-drop-before, .dnd-row-drop-after')
    .forEach(r => { r.classList.remove('dnd-row-drop-before'); r.classList.remove('dnd-row-drop-after'); });
  if (srcId === targetId) return;
  const srcIdx = dndDrivers.findIndex(d => d.id === srcId);
  let tgtIdx = dndDrivers.findIndex(d => d.id === targetId);
  if (srcIdx < 0 || tgtIdx < 0) return;
  // src を取り出して挿入位置に入れる
  const [moved] = dndDrivers.splice(srcIdx, 1);
  // splice 後にターゲットの index は再計算が必要
  tgtIdx = dndDrivers.findIndex(d => d.id === targetId);
  const insertIdx = pos === 'before' ? tgtIdx : tgtIdx + 1;
  dndDrivers.splice(insertIdx, 0, moved);
  // 手動順に切替
  dndVehicleSortMode = 'custom';
  dndUpdateSortBtnUI();
  renderDndTimeline();
  dndReapplyRowDecorations();
}



function renderDndTimeline() {
  const wrap = document.getElementById('dnd-timeline');
  if (!wrap) return;

  // 再描画時はホバーツールチップを閉じる（要素が消えて宙ぶらりんになるのを防ぐ）
  if (typeof dndBlockTipHide === 'function') dndBlockTipHide();

  const currentDateKey = dndGetCurrentDateKey();
  const isToday = dndDateOffset === 0;
  const isPast = dndDateOffset < 0;

  // 確定済みタブかどうか（タブにより参照データソース・操作可否が切り替わる）
  const isConfirmedTab = (typeof currentDispatchTab !== 'undefined' && currentDispatchTab === 'confirmed');
  // 確定済みタブ：読み取り専用クラスを付与（CSSでD&D系UIを抑制）
  wrap.classList.toggle('readonly-mode', isConfirmedTab);

  // 過去日は薄く＆斜線パターン表示
  wrap.classList.toggle('past-day', isPast);

  // 時刻ヘッダー（0〜24時、3時間ごとにラベル）
  const hours = Array.from({length:25},(_,i)=>i);
  const tickHtml = hours.map(h => {
    const pct = (h/24)*100;
    const showLabel = h % 3 === 0 && h !== 0 && h !== 24;
    return `<div class="dnd-time-tick-line" style="left:${pct}%"></div>
      ${showLabel ? `<div class="dnd-time-tick" style="left:${pct}%">${String(h).padStart(2,'0')}:00</div>` : ''}`;
  }).join('');

  // 現在時刻（「今日」表示中のみ）
  const now = new Date();
  const nowPct = ((now.getHours() + now.getMinutes()/60)/24)*100;
  const nowStr = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');

  const rowsHtml = dndDrivers.map(d => {
    // 参照する割当：確定済みタブなら専用ストア、それ以外は通常のdndAssignments
    let assigned;
    if (isConfirmedTab) {
      assigned = (dndConfirmedAssignments[d.id] && dndConfirmedAssignments[d.id][currentDateKey]) || [];
    } else {
      assigned = dndAssignmentsFor(d.id, currentDateKey);
    }

    // 【リレー輸送】分散モード時：このドライバーが担当する区間を一時的にassignedへ注入
    if (!isConfirmedTab && (window.__relayDisplayMode || 'grouped') === 'separate'
        && typeof processingCases !== 'undefined') {
      const driverFirstName = (d.name || '').split(' ')[0];
      processingCases.forEach(c => {
        if (c.vehicleMode !== 'relay' || !c.legs) return;
        c.legs.forEach(leg => {
          if (!leg.driverName) return;
          // ドライバー名のマッチング（姓のみで判定）
          const legFirstName = leg.driverName.split(' ')[0];
          if (legFirstName !== driverFirstName) return;
          // 重複防止：同じレッグが既に注入済みかチェック
          const dup = assigned.some(a => a._relayLegId === leg.legId);
          if (dup) return;
          assigned.push({
            id: 'relay-' + leg.legId,
            _relayLegId: leg.legId,
            _relayJobId: c.jobId || c.id,
            _relayLegNo: leg.legNo,
            _relayTotalLegs: c.legs.length,
            _relayCaseId: c.id,
            start: leg.startTime || '00:00',
            end: leg.endTime || '00:00',
            client: c.client,
            from: leg.relayFrom || c.from,
            to: leg.relayTo || c.to,
            goods: c.goods,
            deadline: c.deadline,
            color: '#0d9488',
            label: c.client + ` (${leg.legNo}/${c.legs.length})`,
            locked: true,  // リレー区間は配車割当ページからは編集不可（モーダルで操作）
            _isRelayLeg: true
          });
        });
      });
      // start順に並び替え
      assigned.sort((a, b) => {
        const sa = timeToPercent(a.start), sb = timeToPercent(b.start);
        return sa - sb;
      });
    }

    // 改善基準告示：この日のこのドライバーのステータス（計画中タブのみ）
    let kaizenStatus = null;
    if (!isConfirmedTab) {
      kaizenStatus = kaizenCheck(d.id, currentDateKey, null);
    }
    const blocksHtml = assigned.map((a, idx) => {
      const left = timeToPercent(a.start);
      const width = durationToPercent(a.start, a.end);
      const isNew = a._isNew === true;
      // フラグを次回以降クリア
      if (isNew) setTimeout(() => { a._isNew = false; }, 600);
      // 確定済みタブ or preset or locked → ドラッグ・削除ボタンなし
      const interactive = !isConfirmedTab && !a.isPreset && !a.locked;
      // 改善基準告示の状態をブロックのクラスに反映（プリセットは除外）
      const blockKaizenCls = (kaizenStatus && !a.isPreset)
        ? (kaizenStatus.level === 'violation' ? 'kaizen-violation' : kaizenStatus.level === 'warn' ? 'kaizen-warn' : '')
        : '';
      // リレーレッグの専用クラス
      const relayLegCls = a._isRelayLeg ? 'dnd-block-relay-leg' : '';
      const relayLegAttr = a._isRelayLeg
        ? `data-leg-no="${a._relayLegNo || '?'}${a._relayTotalLegs ? '/' + a._relayTotalLegs : ''}"`
        : '';
      // ★積荷時間セグメント（loadStart等が存在し、presetでもrelayLegでもない場合）
      let segmentsHtml = '';
      if (!a.isPreset && !a._isRelayLeg && a.loadStart && a.loadEnd && a.driveEnd && a.unloadEnd) {
        const totalMin = timeToMin(a.end) - timeToMin(a.start);
        if (totalMin > 0 && (a.loadMin > 0 || a.driveMin > 0 || a.unloadMin > 0)) {
          const loadPct   = ((a.loadMin   || 0) / totalMin) * 100;
          const drivePct  = ((a.driveMin  || 0) / totalMin) * 100;
          const unloadPct = ((a.unloadMin || 0) / totalMin) * 100;
          segmentsHtml = `<div class="dnd-block-segments">
            <div class="dnd-block-seg seg-load"   style="width:${loadPct}%"   title="積込 ${a.loadStart}〜${a.loadEnd}（${a.loadMin}分）"></div>
            <div class="dnd-block-seg seg-drive"  style="width:${drivePct}%"  title="走行 ${a.loadEnd}〜${a.driveEnd}（${a.driveMin}分）"></div>
            <div class="dnd-block-seg seg-unload" style="width:${unloadPct}%" title="荷下ろし ${a.driveEnd}〜${a.unloadEnd}（${a.unloadMin}分）"></div>
          </div>`;
        }
      }

      // ★M4: 日跨ぎマーカー
      const mdm = a._multiDayMarker || {};
      const isGhost = !!mdm.isGhost;
      const multiDayCls = mdm.isMultiDay
        ? (isGhost ? 'is-multiday-ghost' : 'is-multiday-primary')
        : '';
      // 左端アイコン（前日からの続き）
      const leftMarker = mdm.continuesFromPrevDay
        ? `<span class="dnd-block-md-marker md-left" title="前日からの続き">‹</span>`
        : '';
      // 右端アイコン（翌日へ続く）
      const rightMarker = mdm.continuesToNextDay
        ? `<span class="dnd-block-md-marker md-right" title="翌日へ続く">›</span>`
        : '';
      // ゴーストはドラッグ・削除不可
      const interactiveForBlock = interactive && !isGhost;

      return `<div class="dnd-block ${isNew ? 'new-arrival' : ''} ${a.confirmed ? 'is-confirmed' : ''} ${blockKaizenCls} ${relayLegCls} ${multiDayCls}"
                   style="left:${left}%;width:${width}%;background:${a.color}"
                   ${relayLegAttr}
                   ${interactiveForBlock ? `draggable="true"
                   onmousedown="dndBlockMouseDown(event,'${d.id}',${idx})"
                   ondragstart="dndBlockDragStart(event,'${d.id}',${idx})"
                   ondragend="dndBlockDragEnd(event)"` : ''}
                   onmouseenter="dndBlockTipShow(event,'${d.id}',${idx})"
                   onmousemove="dndBlockTipReposition(event)"
                   onmouseleave="dndBlockTipHide()">
        ${segmentsHtml}
        ${leftMarker}
        <div class="dnd-block-title">${a.label}${mdm.sequenceTotal > 1 ? `<span class="dnd-block-seq">${mdm.sequenceCurrent}/${mdm.sequenceTotal}</span>` : ''}</div>
        <div class="dnd-block-sub">${a.start}〜${a.end}${a.sub ? ' · ' + a.sub : ''}</div>
        ${rightMarker}
        ${interactiveForBlock ? `<button class="dnd-block-remove" onclick="event.stopPropagation();dndRemoveAssignment('${d.id}',${idx})" title="割当解除">×</button>` : ''}
      </div>`;
    }).join('');

    const busy = assigned.length > 0;
    const statusCls = busy ? 'busy' : 'available';
    const statusTxt = busy ? '配車あり' : '空き';

    // 改善基準告示の表示（ドライバー欄に小バッジ）
    let kaizenBadgeHtml = '';
    if (kaizenStatus && kaizenStatus.level !== 'ok' && assigned.length > 0) {
      const cls = kaizenStatus.level === 'violation' ? 'kaizen-badge violation' : 'kaizen-badge warn';
      const icon = kaizenStatus.level === 'violation' ? '⚠' : '!';
      const tip = (kaizenStatus.level === 'violation' ? kaizenStatus.violations : kaizenStatus.warnings).join(' / ');
      kaizenBadgeHtml = `<div class="${cls}" title="改善基準告示：${tip.replace(/"/g, '&quot;')}">${icon} ${kaizenStatus.level === 'violation' ? '違反' : '注意'}</div>`;
    }

    // 確定済みタブではドラッグ系ハンドラを外す
    const trackHandlers = isConfirmedTab ? '' : `ondragover="dndTrackDragOver(event,'${d.id}')"
           ondragleave="dndTrackDragLeave(event)"
           ondrop="dndTrackDrop(event,'${d.id}')"`;

    // 行 D&D（並び替え）用ハンドラ：計画中タブのみ有効
    const rowDragAttrs = isConfirmedTab ? '' :
      `draggable="true"
       ondragstart="dndRowDragStart(event,'${d.id}')"
       ondragend="dndRowDragEnd(event)"
       ondragover="dndRowDragOver(event,'${d.id}')"
       ondragleave="dndRowDragLeave(event)"
       ondrop="dndRowDrop(event,'${d.id}')"`;
    // ハンドルアイコン（並び替え可能であることを示す）
    const handleIconHtml = isConfirmedTab ? '' :
      `<span class="dnd-driver-cell-handle" title="ドラッグで車両の並びを入れ替え">
         <svg width="9" height="11" viewBox="0 0 9 11" fill="currentColor" aria-hidden="true">
           <circle cx="2" cy="2" r="1"/><circle cx="7" cy="2" r="1"/>
           <circle cx="2" cy="5.5" r="1"/><circle cx="7" cy="5.5" r="1"/>
           <circle cx="2" cy="9" r="1"/><circle cx="7" cy="9" r="1"/>
         </svg>
       </span>`;

    return `<div class="dnd-row">
      <div class="dnd-driver-cell" ${rowDragAttrs}>
        <div class="dnd-driver-line1">
          ${handleIconHtml}
          <span class="dnd-driver-name">${d.driver}</span>
        </div>
        <div class="dnd-driver-line2">
          <span class="dnd-driver-status ${statusCls}">${statusTxt}</span>
          <span class="dnd-driver-vehicle">${d.vehicle.replace(/\s*車両/, '').replace(/^V?(\d+)/, '$1')}</span>
          <span class="dnd-driver-capacity">${d.type}/${(d.maxLoad/1000).toFixed(0)}t</span>
        </div>
        ${kaizenBadgeHtml}
      </div>
      <div class="dnd-track"
           data-driver-id="${d.id}"
           ${trackHandlers}>
        ${isToday ? `<div class="dnd-now-line" style="left:${nowPct}%"></div>` : ''}
        ${blocksHtml}
      </div>
    </div>`;
  }).join('');

  // 【リレー輸送】束ねモード時：リレー案件ごとに専用の「リレー仮想行」を末尾に追加
  let relayRowsHtml = '';
  if (!isConfirmedTab && (window.__relayDisplayMode || 'grouped') === 'grouped'
      && typeof processingCases !== 'undefined') {
    const relayCases = processingCases.filter(c =>
      c.vehicleMode === 'relay' && c.legs && c.legs.length > 0
    );
    relayRowsHtml = relayCases.map(c => {
      const driverChain = c.legs
        .map(l => (l.driverName || '—').split(' ')[0])
        .join(' → ');
      const vehicleList = c.legs.map(l => l.vehicleId).join(' / ');
      // 各区間のブロック
      const blocksHtml = c.legs.map(leg => {
        const left = timeToPercent(leg.startTime || '00:00');
        const width = durationToPercent(leg.startTime || '00:00', leg.endTime || '00:00');
        const tip = `${c.client}\n区間${leg.legNo}: ${leg.relayFrom} → ${leg.relayTo}\n${leg.startTime} - ${leg.endTime}\n${leg.driverName} (${leg.vehicleId})`;
        return `<div class="dnd-block dnd-block-relay-leg"
                     data-leg-no="${leg.legNo}/${c.legs.length}"
                     style="left:${left}%;width:${width}%;background:#0d9488"
                     title="${tip.replace(/"/g, '&quot;').replace(/\n/g, ' / ')}">
          <div class="dnd-block-title">${(leg.driverName || '').split(' ')[0]}</div>
          <div class="dnd-block-sub">${leg.startTime}〜${leg.endTime}</div>
        </div>`;
      }).join('');
      // 車両IDから"車両"プレフィックスを除去（通常行と同じ表示形式）
      const vehicleListShort = c.legs.map(l => (l.vehicleId || '').replace('車両', '')).join('/');
      // 取引先名（長すぎる場合は省略）
      const clientShort = (c.client || '').length > 8
        ? c.client.substring(0, 7) + '…'
        : c.client;
      return `<div class="dnd-row dnd-row-relay">
        <div class="dnd-driver-cell">
          <div class="dnd-driver-line1">
            <span class="dnd-driver-name" title="${(c.client || '').replace(/"/g, '&quot;')}">🔁 ${clientShort}</span>
            <span class="dnd-driver-vehicle" title="${vehicleList.replace(/"/g, '&quot;')}">${vehicleListShort}</span>
          </div>
          <div class="dnd-driver-line2">
            <span class="dnd-driver-status dnd-relay-row-label">リレー ${c.legs.length}区間</span>
            <span class="dnd-driver-capacity" title="${driverChain.replace(/"/g, '&quot;')}">${driverChain}</span>
          </div>
        </div>
        <div class="dnd-track dnd-track-relay">
          ${isToday ? `<div class="dnd-now-line" style="left:${nowPct}%"></div>` : ''}
          ${blocksHtml}
        </div>
      </div>`;
    }).join('');
  }

  wrap.innerHTML = `
    <div class="dnd-time-header">
      <div class="dnd-time-header-label">ドライバー / 車両</div>
      <div class="dnd-time-ticks">
        ${tickHtml}
        ${isToday ? `<div class="dnd-now-label" style="left:${nowPct}%">${nowStr}</div>` : ''}
      </div>
    </div>
    ${rowsHtml}
    ${relayRowsHtml}`;
}

function updateDndStats() {
  const currentKey = dndGetCurrentDateKey();
  const isConfirmedTab = (typeof currentDispatchTab !== 'undefined' && currentDispatchTab === 'confirmed');
  // 「割当済」は表示中の日付の値（プリセット除く）
  let totalAssigned = 0;
  let usedDrivers = 0;
  dndDrivers.forEach(d => {
    let arr;
    if (isConfirmedTab) {
      arr = (dndConfirmedAssignments[d.id] && dndConfirmedAssignments[d.id][currentKey]) || [];
      totalAssigned += arr.length;
    } else {
      arr = (dndAssignments[d.id] && dndAssignments[d.id][currentKey]) || [];
      const nonPreset = arr.filter(a => !a.isPreset).length;
      totalAssigned += nonPreset;
    }
    if (arr.length > 0) usedDrivers++;
  });
  const totalDrivers = dndDrivers.length;
  const rate = totalDrivers > 0 ? Math.round((usedDrivers/totalDrivers)*100) : 0;
  const aEl = document.getElementById('dnd-stat-assigned');
  const rEl = document.getElementById('dnd-stat-rate');
  if (aEl) aEl.textContent = totalAssigned;
  if (rEl) rEl.textContent = rate + '%';
}

// ── 配車ブロック ホバーツールチップ（案件詳細） ──
// body 直下に 1 個だけ要素を生成して使い回す
function dndBlockTipEnsure() {
  let el = document.getElementById('dnd-block-tip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dnd-block-tip';
    el.innerHTML = '<div class="dnd-block-tip-body"></div><div class="dnd-block-tip-arrow-pt"></div>';
    document.body.appendChild(el);
  }
  return el;
}

// 時間計算（hh:mm → 「Xh Ym」表記）
function dndFormatDuration(startStr, endStr) {
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  let mins = (eh*60 + em) - (sh*60 + sm);
  if (mins < 0) mins += 24*60;
  const h = Math.floor(mins/60);
  const m = mins % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

// ホバー対象のブロック情報からツールチップHTMLを生成
function dndBlockTipBuildHtml(driverId, blockIdx) {
  const currentDateKey = dndGetCurrentDateKey();
  const isConfirmedTab = (typeof currentDispatchTab !== 'undefined' && currentDispatchTab === 'confirmed');
  const arr = isConfirmedTab
    ? ((dndConfirmedAssignments[driverId] && dndConfirmedAssignments[driverId][currentDateKey]) || [])
    : ((dndAssignments[driverId] && dndAssignments[driverId][currentDateKey]) || []);
  const a = arr[blockIdx];
  if (!a) return '';
  const driver = dndDrivers.find(d => d.id === driverId);
  const driverLine = driver ? `${driver.driver}（${driver.vehicle}）` : '';
  const duration = dndFormatDuration(a.start, a.end);

  // 案件ID から元案件を引いて詳細情報を取得
  let detail = null;
  if (a.caseId) {
    // 計画中はdndUnassignedCases、確定済みはprocessedCasesを参照
    if (isConfirmedTab && typeof processedCases !== 'undefined') {
      detail = processedCases.find(c => c.id === a.caseId);
    } else {
      detail = dndUnassignedCases.find(c => c.id === a.caseId);
    }
  }

  // 確定済みブロックの場合：請求確定済みバッジを上部に出す
  if (isConfirmedTab && a.confirmed && detail) {
    const goodsDisp = (detail.goods || '—').toString().replace(/\s+/g,' ');
    const dateMatch = String(detail.completion || '').match(/(\d{4})\/(\d{2})\/(\d{2})/);
    const dateStr = dateMatch ? `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}` : '—';
    return `
      <div class="dnd-block-tip-head">
        <span class="dnd-block-tip-swatch" style="background:${a.color || '#0D4A3A'}"></span>
        <span class="dnd-block-tip-client">${detail.client || a.label || '—'}</span>
        <span class="dnd-block-tip-badge preset" style="background:#d1fae5;color:#065f46;border-color:#a7f3d0">請求確定済み</span>
      </div>
      <div class="dnd-block-tip-row">
        <span class="dnd-block-tip-icon">🕐</span>
        <span class="dnd-block-tip-text">
          <span class="dnd-block-tip-time">${a.start}</span>
          <span class="dnd-block-tip-arrow">→</span>
          <span class="dnd-block-tip-time">${a.end}</span>
          <span style="color:#9ca3af; font-size:10px; margin-left:4px;">（${duration}）</span>
        </span>
      </div>
      <div class="dnd-block-tip-row">
        <span class="dnd-block-tip-icon">📍</span>
        <span class="dnd-block-tip-text"><b>${detail.from || '—'}</b> <span class="dnd-block-tip-arrow">→</span> <b>${detail.to || '—'}</b></span>
      </div>
      <div class="dnd-block-tip-row">
        <span class="dnd-block-tip-icon">📦</span>
        <span class="dnd-block-tip-text">${goodsDisp}</span>
      </div>
      <div class="dnd-block-tip-row">
        <span class="dnd-block-tip-icon">📅</span>
        <span class="dnd-block-tip-text">完了日：<b>${dateStr}</b></span>
      </div>
      <div class="dnd-block-tip-meta">
        ${driverLine ? `<span class="dnd-block-tip-meta-item">🚚 <b>${driverLine}</b></span>` : ''}
        <span class="dnd-block-tip-meta-item">案件 <b>${detail.id}</b></span>
      </div>
    `;
  }

  if (a.isPreset) {
    // 固定便（プリセット）
    const headTitle = (a.label || '固定便');
    return `
      <div class="dnd-block-tip-head">
        <span class="dnd-block-tip-swatch" style="background:${a.color || '#94a3b8'}"></span>
        <span class="dnd-block-tip-client">${headTitle}</span>
        <span class="dnd-block-tip-badge preset">固定便</span>
      </div>
      <div class="dnd-block-tip-row">
        <span class="dnd-block-tip-icon">🕐</span>
        <span class="dnd-block-tip-text">
          <span class="dnd-block-tip-time">${a.start}</span>
          <span class="dnd-block-tip-arrow">→</span>
          <span class="dnd-block-tip-time">${a.end}</span>
          <span style="color:#9ca3af; font-size:10px; margin-left:4px;">（${duration}）</span>
        </span>
      </div>
      ${a.sub ? `<div class="dnd-block-tip-row">
        <span class="dnd-block-tip-icon">📍</span>
        <span class="dnd-block-tip-text">${a.sub}</span>
      </div>` : ''}
      ${driverLine ? `<div class="dnd-block-tip-meta">
        <span class="dnd-block-tip-meta-item">🚚 <b>${driverLine}</b></span>
      </div>` : ''}
    `;
  }

  // 通常の案件
  const client    = (detail && detail.client) || a.label || '—';
  const from      = (detail && detail.from)   || '—';
  const to        = (detail && detail.to)     || '—';
  const goods     = (detail && detail.goods)  || '—';
  const deadline  = (detail && detail.deadline) || '—';
  const urgent    = !!(detail && detail.urgent);
  const caseId    = a.caseId || '';

  // 改善基準告示の状況（このドライバー・この日）
  let kaizenHtml = '';
  if (!isConfirmedTab) {
    const k = kaizenCheck(driverId, currentDateKey, null);
    if (k.level === 'violation') {
      kaizenHtml = `<div class="dnd-block-tip-kaizen violation">
        <span class="dnd-block-tip-kaizen-head">⚠ 改善基準告示違反</span>
        ${k.violations.map(v => `<div class="dnd-block-tip-kaizen-item">・${v}</div>`).join('')}
      </div>`;
    } else if (k.level === 'warn') {
      kaizenHtml = `<div class="dnd-block-tip-kaizen warn">
        <span class="dnd-block-tip-kaizen-head">! 改善基準告示 注意</span>
        ${k.warnings.map(v => `<div class="dnd-block-tip-kaizen-item">・${v}</div>`).join('')}
      </div>`;
    }
  }

  // ★M4: 日跨ぎ情報
  const mdm = a._multiDayMarker || {};
  let multiDayHtml = '';
  if (mdm.isMultiDay && mdm.jobStartDateTime && mdm.jobEndDateTime) {
    const fmtJa = (iso) => {
      const d = new Date(iso);
      const M = d.getMonth() + 1, D = d.getDate();
      const hh = String(d.getHours()).padStart(2,'0');
      const mm = String(d.getMinutes()).padStart(2,'0');
      return `${M}/${D} ${hh}:${mm}`;
    };
    const totalH = Math.round((new Date(mdm.jobEndDateTime) - new Date(mdm.jobStartDateTime)) / 3600000 * 10) / 10;
    multiDayHtml = `
    <div class="dnd-block-tip-multiday">
      <div class="dnd-block-tip-multiday-head">
        <span class="dnd-block-tip-multiday-icon">🌙</span>
        <span>日跨ぎ便（${mdm.isGhost ? '前日からの続き' : '翌日へ続く'}）</span>
      </div>
      <div class="dnd-block-tip-multiday-body">
        <div class="dnd-block-tip-multiday-row">
          <span class="dnd-block-tip-multiday-label">開始</span>
          <span class="dnd-block-tip-multiday-time">${fmtJa(mdm.jobStartDateTime)}</span>
        </div>
        <div class="dnd-block-tip-multiday-row">
          <span class="dnd-block-tip-multiday-label">終了</span>
          <span class="dnd-block-tip-multiday-time">${fmtJa(mdm.jobEndDateTime)}</span>
        </div>
        <div class="dnd-block-tip-multiday-row">
          <span class="dnd-block-tip-multiday-label">合計</span>
          <span class="dnd-block-tip-multiday-time">${totalH}h</span>
        </div>
      </div>
    </div>`;
  } else if (mdm.sequenceTotal > 1) {
    // 同日ジョブでも、案件内で複数ジョブ構成なら sequence を表示
    multiDayHtml = `
    <div class="dnd-block-tip-multiday">
      <div class="dnd-block-tip-multiday-head">
        <span class="dnd-block-tip-multiday-icon">📅</span>
        <span>案件内ジョブ ${mdm.sequenceCurrent} / ${mdm.sequenceTotal}</span>
      </div>
    </div>`;
  }

  return `
    <div class="dnd-block-tip-head">
      <span class="dnd-block-tip-swatch" style="background:${a.color || '#1a7a5e'}"></span>
      <span class="dnd-block-tip-client">${client}</span>
      ${urgent ? '<span class="dnd-block-tip-badge">急ぎ</span>' : '<span class="dnd-block-tip-badge normal">配車済</span>'}
    </div>
    <div class="dnd-block-tip-row">
      <span class="dnd-block-tip-icon">🕐</span>
      <span class="dnd-block-tip-text">
        <span class="dnd-block-tip-time">${a.start}</span>
        <span class="dnd-block-tip-arrow">→</span>
        <span class="dnd-block-tip-time">${a.end}</span>
        <span style="color:#9ca3af; font-size:10px; margin-left:4px;">（${duration}）</span>
      </span>
    </div>
    ${multiDayHtml}
    <div class="dnd-block-tip-row">
      <span class="dnd-block-tip-icon">📍</span>
      <span class="dnd-block-tip-text"><b>${from}</b> <span class="dnd-block-tip-arrow">→</span> <b>${to}</b></span>
    </div>
    <div class="dnd-block-tip-row">
      <span class="dnd-block-tip-icon">📦</span>
      <span class="dnd-block-tip-text">${goods}</span>
    </div>
    ${(a.loadStart && a.loadEnd && a.driveEnd && a.unloadEnd && !mdm.isMultiDay) ? `
    <div class="dnd-block-tip-segments">
      <div class="dnd-block-tip-seg-row">
        <span class="dnd-block-tip-seg-icon">📥</span>
        <span class="dnd-block-tip-seg-label">積込</span>
        <span class="dnd-block-tip-seg-time">${a.loadStart}〜${a.loadEnd}</span>
        <span class="dnd-block-tip-seg-min">${a.loadMin}分</span>
      </div>
      <div class="dnd-block-tip-seg-row">
        <span class="dnd-block-tip-seg-icon">🚛</span>
        <span class="dnd-block-tip-seg-label">走行</span>
        <span class="dnd-block-tip-seg-time">${a.loadEnd}〜${a.driveEnd}</span>
        <span class="dnd-block-tip-seg-min">${a.driveMin}分</span>
      </div>
      <div class="dnd-block-tip-seg-row">
        <span class="dnd-block-tip-seg-icon">📤</span>
        <span class="dnd-block-tip-seg-label">荷下ろし</span>
        <span class="dnd-block-tip-seg-time">${a.driveEnd}〜${a.unloadEnd}</span>
        <span class="dnd-block-tip-seg-min">${a.unloadMin}分</span>
      </div>
    </div>
    ` : ''}
    <div class="dnd-block-tip-row">
      <span class="dnd-block-tip-icon">⏰</span>
      <span class="dnd-block-tip-text">納期：<b>${deadline}</b></span>
    </div>
    ${kaizenHtml}
    <div class="dnd-block-tip-meta">
      ${driverLine ? `<span class="dnd-block-tip-meta-item">🚚 <b>${driverLine}</b></span>` : ''}
      ${caseId ? `<span class="dnd-block-tip-meta-item">案件 <b>${caseId}</b></span>` : ''}
    </div>
  `;
}

// 位置決め：ブロックの上に出すのが基本。上に入らなければ下、左右もはみ出さないよう調整
function dndBlockTipPosition(blockEl, tipEl) {
  const rect = blockEl.getBoundingClientRect();
  const tipRect = tipEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 8;
  const gap = 10; // ブロックとツールチップの隙間

  // 水平：ブロック中央に合わせつつ、ビューポート内に収める
  const blockCenterX = rect.left + rect.width / 2;
  let left = blockCenterX - tipRect.width / 2;
  left = Math.max(margin, Math.min(left, vw - tipRect.width - margin));

  // 垂直：基本は上、入らない場合は下
  let top = rect.top - tipRect.height - gap;
  let arrow = 'down'; // 矢印はツールチップ下から（=ブロックを指す）
  if (top < margin) {
    top = rect.bottom + gap;
    arrow = 'up'; // 矢印はツールチップ上から
    // 下にも入らない場合は、ビューポート上下にクランプ
    if (top + tipRect.height > vh - margin) {
      top = Math.max(margin, vh - tipRect.height - margin);
    }
  }

  tipEl.style.left = left + 'px';
  tipEl.style.top  = top  + 'px';

  // 矢印の水平位置：ブロック中央をツールチップ座標系に変換
  const arrowEl = tipEl.querySelector('.dnd-block-tip-arrow-pt');
  if (arrowEl) {
    const arrowX = blockCenterX - left;
    const clampedX = Math.max(14, Math.min(arrowX, tipRect.width - 14));
    arrowEl.style.left = clampedX + 'px';
  }

  tipEl.classList.remove('arrow-up', 'arrow-down');
  tipEl.classList.add('arrow-' + arrow);
}

function dndBlockTipShow(e, driverId, blockIdx) {
  // ★重要: e.currentTarget は同期ハンドラ終了後に null になるため、
  //   非同期コールバックに入る前に参照を確保しておく
  const blockEl = e.currentTarget;
  if (!blockEl) return;

  const tipEl = dndBlockTipEnsure();
  const html = dndBlockTipBuildHtml(driverId, blockIdx);
  if (!html) { dndBlockTipHide(); return; }
  const body = tipEl.querySelector('.dnd-block-tip-body');
  if (body) body.innerHTML = html;

  // 一旦表示してサイズを確定（display:block にしないと getBoundingClientRect が 0 になる）
  tipEl.classList.add('show');

  // 位置決め（同期、display:block 後すぐ寸法を取れる）
  dndBlockTipPosition(blockEl, tipEl);

  // フェードイン（次フレームで visible を付ける）
  requestAnimationFrame(() => tipEl.classList.add('visible'));
}

function dndBlockTipReposition(e) {
  // 同一ブロック上のマウス移動では再計算しない（矢印位置のチラつき防止）
  // スクロール／リサイズ時には dndBlockTipHide が走るので位置ズレの心配はない
  return;
}

function dndBlockTipHide() {
  const tipEl = document.getElementById('dnd-block-tip');
  if (!tipEl) return;
  tipEl.classList.remove('visible', 'show', 'arrow-up', 'arrow-down');
}

// タイムラインスクロール・リサイズ時にはツールチップを閉じる（位置ズレ防止）
(function dndBlockTipBindGlobal() {
  if (window.__dndBlockTipBound) return;
  window.__dndBlockTipBound = true;
  document.addEventListener('scroll', () => {
    const el = document.getElementById('dnd-block-tip');
    if (el && el.classList.contains('show')) dndBlockTipHide();
  }, true); // capture でタイムライン内スクロールも拾う
  window.addEventListener('resize', dndBlockTipHide);
})();

// ── ドラッグ&ドロップ：未割当カード ──
function dndCardDragStart(e, caseId) {
  // 確定済みタブでは絶対にD&Dを発動させない
  if (typeof currentDispatchTab !== 'undefined' && currentDispatchTab === 'confirmed') { e.preventDefault(); return; }
  dndDraggingCaseId = caseId;
  dndDraggingFromDriver = null;
  dndDraggingBlockIdx = null;
  dndDraggingFromDateKey = null;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', caseId);
  // ドラッグ画像をデフォルトの透明にして、カスタムゴーストを自作
  const img = new Image();
  img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  e.dataTransfer.setDragImage(img, 0, 0);
  e.target.classList.add('dragging');
  showDndGhost(e, caseId);
}
function dndCardMouseDown(e, caseId) {
  // ゴーストの初期位置を保持するため
}
function dndCardDragEnd(e) {
  e.target.classList.remove('dragging');
  hideDndGhost();
  hideAllDropTimePreviews();
  document.querySelectorAll('.dnd-track').forEach(t => {
    t.classList.remove('drop-hover', 'drop-invalid');
  });
  dndDraggingCaseId = null;
  dndDraggingFromDriver = null;
  dndDraggingBlockIdx = null;
  dndDraggingFromDateKey = null;
}

// ── ドラッグ&ドロップ：既存ブロック移動 ──
function dndBlockDragStart(e, driverId, idx) {
  // 確定済みタブではブロック移動も不可
  if (typeof currentDispatchTab !== 'undefined' && currentDispatchTab === 'confirmed') { e.preventDefault(); return; }
  // ホバーツールチップを閉じる（ドラッグ中に残ると邪魔）
  if (typeof dndBlockTipHide === 'function') dndBlockTipHide();
  const currentKey = dndGetCurrentDateKey();
  const arr = (dndAssignments[driverId] && dndAssignments[driverId][currentKey]) || [];
  const block = arr[idx];
  if (!block || block.isPreset) { e.preventDefault(); return; }
  dndDraggingCaseId = block.caseId;
  dndDraggingFromDriver = driverId;
  dndDraggingBlockIdx = idx;
  dndDraggingFromDateKey = currentKey;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', 'move:' + block.caseId);
  const img = new Image();
  img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  e.dataTransfer.setDragImage(img, 0, 0);
  e.target.classList.add('dragging');
  showDndGhost(e, block.caseId, block.label);
  e.stopPropagation();
}
function dndBlockDragEnd(e) {
  e.target.classList.remove('dragging');
  hideDndGhost();
  hideAllDropTimePreviews();
  document.querySelectorAll('.dnd-track').forEach(t => {
    t.classList.remove('drop-hover', 'drop-invalid');
  });
  dndDraggingCaseId = null;
  dndDraggingFromDriver = null;
  dndDraggingBlockIdx = null;
  dndDraggingFromDateKey = null;
}

// ── トラック側 ──
function dndTrackDragOver(e, driverId) {
  // 確定済みタブではdropエフェクトを許可しない
  if (typeof currentDispatchTab !== 'undefined' && currentDispatchTab === 'confirmed') { return; }
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  // 衝突チェック
  const ok = canDropOnDriver(driverId, e);
  const track = e.currentTarget;
  document.querySelectorAll('.dnd-track').forEach(t => {
    if (t !== track) t.classList.remove('drop-hover', 'drop-invalid');
  });
  track.classList.toggle('drop-hover', ok);
  track.classList.toggle('drop-invalid', !ok);
  // ドロップ予定時間のプレビュー
  showDropTimePreview(track, e, driverId, ok);
  // ゴースト追従
  if (dndGhostEl) {
    dndGhostEl.style.left = e.clientX + 'px';
    dndGhostEl.style.top  = e.clientY + 'px';
  }
}
function dndTrackDragLeave(e) {
  // 子要素に出入りすると発火しすぎるので、関連要素チェック
  const related = e.relatedTarget;
  if (!related || !e.currentTarget.contains(related)) {
    e.currentTarget.classList.remove('drop-hover', 'drop-invalid');
    // プレビューも消す
    hideDropTimePreviewOn(e.currentTarget);
  }
}

// ── ドロップ位置の開始〜終了時刻プレビュー ──
// ドラッグ中、トラック上の現在カーソル位置に対応する時間帯を視覚化する
function getDraggingCaseDuration() {
  // ケース → durationH を解決
  if (!dndDraggingCaseId) return null;
  // 既存ブロック移動の場合は、元ブロックの長さを優先
  if (dndDraggingFromDriver != null && dndDraggingBlockIdx != null) {
    const arr = (dndAssignments[dndDraggingFromDriver] && dndAssignments[dndDraggingFromDriver][dndDraggingFromDateKey]) || [];
    const block = arr[dndDraggingBlockIdx];
    if (block) {
      const [sh, sm] = block.start.split(':').map(Number);
      const [eh, em] = block.end.split(':').map(Number);
      return (eh + em/60) - (sh + sm/60);
    }
  }
  // 新規カードドラッグの場合
  const c = dndUnassignedCases.find(x => x.id === dndDraggingCaseId);
  return c ? c.durationH : null;
}

function showDropTimePreview(track, e, driverId, ok) {
  const dur = getDraggingCaseDuration();
  if (dur == null) return;
  const { start, end, startH } = getDropTime(track, e, dur);
  // 詳細評価（改善基準告示・積載・衝突）
  const ctx = evaluateDropContext(driverId, e);
  // 既存プレビュー（このトラック内）
  let prev = track.querySelector('.dnd-drop-preview');
  if (!prev) {
    // 他のトラックに残っている古いプレビューはクリーンアップ
    document.querySelectorAll('.dnd-drop-preview').forEach(el => {
      if (el.parentNode !== track) el.remove();
    });
    prev = document.createElement('div');
    prev.className = 'dnd-drop-preview';
    prev.innerHTML = `
      <span class="dnd-drop-preview-start"></span>
      <span class="dnd-drop-preview-center">
        <span class="dnd-drop-preview-duration"></span>
        <span class="dnd-drop-preview-warn"></span>
      </span>
      <span class="dnd-drop-preview-end"></span>
    `;
    track.appendChild(prev);
  }
  // 位置・幅
  const leftPct = (startH / 24) * 100;
  const widthPct = (dur / 24) * 100;
  prev.style.left = leftPct + '%';
  prev.style.width = widthPct + '%';
  // ラベル更新
  const startEl = prev.querySelector('.dnd-drop-preview-start');
  const endEl   = prev.querySelector('.dnd-drop-preview-end');
  const durEl   = prev.querySelector('.dnd-drop-preview-duration');
  const warnEl  = prev.querySelector('.dnd-drop-preview-warn');
  if (startEl) startEl.textContent = start;
  if (endEl)   endEl.textContent   = end;
  if (durEl) {
    const h = Math.floor(dur);
    const m = Math.round((dur - h) * 60);
    durEl.textContent = m === 0 ? (h + 'h') : (h + 'h ' + m + 'm');
  }

  // ── 配置可否＆ステータスに応じた色クラス ──
  // 優先順位: 違反 > 警告 > 通常エラー(衝突/積載) > OK
  prev.classList.remove('invalid', 'warn', 'kaizen-violation');
  let label = '';
  if (ctx.kaizenLevel === 'violation') {
    prev.classList.add('invalid', 'kaizen-violation');
    label = '⚠ ' + (ctx.kaizenIssues[0] || '改善基準告示違反');
  } else if (!ctx.canDrop) {
    // 改善基準以外の理由でNG（衝突・積載）
    prev.classList.add('invalid');
    label = '✕ ' + (ctx.reason || '配置不可');
  } else if (ctx.kaizenLevel === 'warn') {
    prev.classList.add('warn');
    label = '注意: ' + (ctx.kaizenIssues[0] || '');
  }
  if (warnEl) {
    warnEl.textContent = label;
    warnEl.style.display = label ? '' : 'none';
  }

  // 端寄り判定（ラベル位置を逃がす）
  prev.classList.toggle('near-start', leftPct < 5);
  prev.classList.toggle('near-end',   (leftPct + widthPct) > 95);
  // 幅が小さい時のラベル衝突回避
  prev.classList.toggle('narrow', widthPct < 7);
  // 最上段トラックではラベルが時刻ヘッダーと被るので下に出す
  let belowMode = false;
  try {
    const row = track.closest('.dnd-row');
    if (row) {
      const rows = Array.from(row.parentNode.querySelectorAll('.dnd-row'));
      if (rows.indexOf(row) <= 1) belowMode = true;
    }
  } catch (e) { /* noop */ }
  prev.classList.toggle('label-below', belowMode);
}

function hideDropTimePreviewOn(track) {
  if (!track) return;
  const prev = track.querySelector('.dnd-drop-preview');
  if (prev) prev.remove();
}

function hideAllDropTimePreviews() {
  document.querySelectorAll('.dnd-drop-preview').forEach(el => el.remove());
}

function getDropTime(track, e, durationH) {
  const rect = track.getBoundingClientRect();
  const x = e.clientX - rect.left;
  let pct = x / rect.width;
  pct = Math.max(0, Math.min(1, pct));
  let startH = pct * 24;
  // 15分単位にスナップ
  startH = Math.round(startH * 4) / 4;
  // 終了が24を越えないように調整
  if (startH + durationH > 24) startH = 24 - durationH;
  if (startH < 0) startH = 0;
  const fmt = (h) => {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return String(hh).padStart(2,'0') + ':' + String(mm).padStart(2,'0');
  };
  return { start: fmt(startH), end: fmt(startH + durationH), startH };
}

function canDropOnDriver(driverId, e) {
  if (!dndDraggingCaseId) return false;
  const c = dndUnassignedCases.find(x => x.id === dndDraggingCaseId);
  if (!c) return false;
  const driver = dndDrivers.find(d => d.id === driverId);
  if (!driver) return false;
  // 積載量チェック
  const goodsMatch = c.goods.match(/(\d+)kg/);
  const goodsKg = goodsMatch ? parseInt(goodsMatch[1], 10) : 0;
  if (goodsKg > driver.maxLoad) return false;
  // 現在表示中の日付の割当に対して衝突チェック
  const currentKey = dndGetCurrentDateKey();
  const track = e.currentTarget;
  const { start, end } = getDropTime(track, e, c.durationH);
  const arr = (dndAssignments[driverId] && dndAssignments[driverId][currentKey]) || [];
  const newStart = timeToMin(start), newEnd = timeToMin(end);
  for (let i = 0; i < arr.length; i++) {
    // 自分自身を移動中の場合（同じドライバー＋同じ日＋同じインデックス）はスキップ
    if (dndDraggingFromDriver === driverId
        && dndDraggingFromDateKey === currentKey
        && dndDraggingBlockIdx === i) continue;
    const s = timeToMin(arr[i].start), eM = timeToMin(arr[i].end);
    if (newStart < eM && newEnd > s) return false;
  }
  // 改善基準告示チェック：violationならドロップ不可
  const excludeIdx = (dndDraggingFromDriver === driverId && dndDraggingFromDateKey === currentKey)
    ? dndDraggingBlockIdx : undefined;
  const k = kaizenCheck(driverId, currentKey, { start, end }, excludeIdx);
  if (k.level === 'violation') return false;
  return true;
}

// ホバー時のドロップ可否＋改善基準告示の結果をひとまとめに返す
// (showDropTimePreview から呼ぶ用)
function evaluateDropContext(driverId, e) {
  const result = {
    canDrop: false,           // ドロップ可能か（trueなら緑、falseなら赤）
    reason: '',               // ドロップ不可の主因（衝突・積載・違反）
    kaizenLevel: 'ok',        // 'ok' | 'warn' | 'violation'
    kaizenIssues: [],         // 違反・警告メッセージ
    start: '', end: '',
  };
  if (!dndDraggingCaseId) return result;
  const c = dndUnassignedCases.find(x => x.id === dndDraggingCaseId);
  if (!c) return result;
  const driver = dndDrivers.find(d => d.id === driverId);
  if (!driver) return result;
  const track = e.currentTarget;
  const dur = getDraggingCaseDuration();
  if (dur == null) return result;
  const { start, end } = getDropTime(track, e, dur);
  result.start = start;
  result.end = end;

  // 積載量
  const goodsMatch = (c.goods || '').match(/(\d+)kg/);
  const goodsKg = goodsMatch ? parseInt(goodsMatch[1], 10) : 0;
  if (goodsKg > driver.maxLoad) {
    result.reason = `積載量超過（${goodsKg}kg > ${driver.maxLoad}kg）`;
    return result;
  }

  // 時間重複
  const currentKey = dndGetCurrentDateKey();
  const arr = (dndAssignments[driverId] && dndAssignments[driverId][currentKey]) || [];
  const newStart = timeToMin(start), newEnd = timeToMin(end);
  for (let i = 0; i < arr.length; i++) {
    if (dndDraggingFromDriver === driverId
        && dndDraggingFromDateKey === currentKey
        && dndDraggingBlockIdx === i) continue;
    const s = timeToMin(arr[i].start), eM = timeToMin(arr[i].end);
    if (newStart < eM && newEnd > s) {
      result.reason = '時間重複';
      return result;
    }
  }

  // 改善基準告示
  const excludeIdx = (dndDraggingFromDriver === driverId && dndDraggingFromDateKey === currentKey)
    ? dndDraggingBlockIdx : undefined;
  const k = kaizenCheck(driverId, currentKey, { start, end }, excludeIdx);
  result.kaizenLevel = k.level;
  result.kaizenIssues = k.level === 'violation' ? k.violations : k.warnings;
  if (k.level === 'violation') {
    result.reason = '改善基準告示違反';
    return result;
  }

  result.canDrop = true;
  return result;
}

function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  改善基準告示（2024年問題）チェック
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// トラック運転者の主要規制：
//   - 1日の拘束時間 ：13h（最大15h）
//   - 連続運転時間  ：4h
//   - 休息期間      ：継続11h（最低9h）
// 候補ブロック(start/end)を組み込んだ場合の違反を検出する。
// 返り値: {
//   level: 'ok' | 'warn' | 'violation',
//   violations: [string],  // 違反（ドロップ不可）
//   warnings:   [string],  // 警告（ドロップ可だが注意）
// }
const KAIZEN_LIMITS = {
  duty13:    13 * 60,  // 拘束時間の原則上限（分）
  duty15:    15 * 60,  // 拘束時間の絶対上限
  drive4:     4 * 60,  // 連続運転の上限
  rest9:      9 * 60,  // 休息期間の絶対最小
  rest11:    11 * 60,  // 休息期間の原則
};

// 日内のブロック群と新候補から「拘束時間」を算出
// 拘束時間 = 業務開始から終業までの総時間（休憩・荷待ち含む）
function kaizenComputeDuty(blocks) {
  if (blocks.length === 0) return 0;
  let minStart = Infinity, maxEnd = -Infinity;
  blocks.forEach(b => {
    const s = timeToMin(b.start), e = timeToMin(b.end);
    if (s < minStart) minStart = s;
    if (e > maxEnd) maxEnd = e;
  });
  return maxEnd - minStart;
}

// 連続運転時間チェック：30分以上の空き（休憩）が入らない連続区間の最大長
// 単一ブロックは業務内に休憩を含むものとして「ブロック1個ではフラグを立てない」
// 複数ブロックが30分未満の間隔で連続している場合に、その連続合計が4hを超えたら違反
function kaizenComputeMaxContinuous(blocks) {
  if (blocks.length <= 1) return 0; // 単体は判定対象外
  // 開始時刻でソート
  const sorted = blocks.slice().sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
  let maxCont = 0;
  let curStart = timeToMin(sorted[0].start);
  let curEnd   = timeToMin(sorted[0].end);
  let curBlocks = 1;
  for (let i = 1; i < sorted.length; i++) {
    const s = timeToMin(sorted[i].start);
    const e = timeToMin(sorted[i].end);
    const gap = s - curEnd; // 前のブロックとの間隔
    if (gap >= 30) {
      // 30分以上の休憩あり → 区切る
      if (curBlocks >= 2) maxCont = Math.max(maxCont, curEnd - curStart);
      curStart = s;
      curEnd   = e;
      curBlocks = 1;
    } else {
      // 連続とみなす
      curEnd = Math.max(curEnd, e);
      curBlocks++;
    }
  }
  if (curBlocks >= 2) maxCont = Math.max(maxCont, curEnd - curStart);
  return maxCont;
}

// 候補ブロックを含めた場合の改善基準チェック
// driverId: 対象ドライバー / dateKey: 対象日 / candidate: {start, end} or null
// excludeIdx: 既存ブロック移動の場合に除外するインデックス
function kaizenCheck(driverId, dateKey, candidate, excludeIdx) {
  const result = { level: 'ok', violations: [], warnings: [] };
  if (!driverId || !dateKey) return result;

  // 当日のブロック（候補追加・自身除外）を構築
  const dayArr = (dndAssignments[driverId] && dndAssignments[driverId][dateKey]) || [];
  const dayBlocks = dayArr
    .filter((b, i) => i !== excludeIdx)
    .map(b => ({ start: b.start, end: b.end }));
  if (candidate && candidate.start && candidate.end) {
    dayBlocks.push({ start: candidate.start, end: candidate.end });
  }
  if (dayBlocks.length === 0) return result;

  // 1) 拘束時間チェック
  const duty = kaizenComputeDuty(dayBlocks);
  if (duty > KAIZEN_LIMITS.duty15) {
    result.violations.push(`拘束時間 ${kaizenFmtH(duty)}（上限15h超）`);
  } else if (duty > KAIZEN_LIMITS.duty13) {
    result.warnings.push(`拘束時間 ${kaizenFmtH(duty)}（原則13h超）`);
  }

  // 2) 連続運転時間チェック
  const cont = kaizenComputeMaxContinuous(dayBlocks);
  if (cont > KAIZEN_LIMITS.drive4) {
    result.violations.push(`連続運転 ${kaizenFmtH(cont)}（上限4h超・要30分休憩）`);
  } else if (cont > KAIZEN_LIMITS.drive4 - 30) {
    // 上限-30分以内は注意（3h30m〜4h）
    result.warnings.push(`連続運転 ${kaizenFmtH(cont)}（4h目前）`);
  }

  // 3) 前日終業〜当日始業の休息期間チェック
  const prevDateKey = dndDateKey(dndAddDays(new Date(dateKey + 'T00:00:00'), -1));
  const prevArr = (dndAssignments[driverId] && dndAssignments[driverId][prevDateKey]) || [];
  if (prevArr.length > 0 && dayBlocks.length > 0) {
    const prevMaxEnd = Math.max(...prevArr.map(b => timeToMin(b.end)));
    const todayMinStart = Math.min(...dayBlocks.map(b => timeToMin(b.start)));
    // 休息期間 = 24*60 - prevMaxEnd + todayMinStart
    const rest = (24 * 60 - prevMaxEnd) + todayMinStart;
    if (rest < KAIZEN_LIMITS.rest9) {
      result.violations.push(`休息期間 ${kaizenFmtH(rest)}（最低9h未満）`);
    } else if (rest < KAIZEN_LIMITS.rest11) {
      result.warnings.push(`休息期間 ${kaizenFmtH(rest)}（原則11h未満）`);
    }
  }

  // 4) 翌日始業との関係でも休息期間チェック
  const nextDateKey = dndDateKey(dndAddDays(new Date(dateKey + 'T00:00:00'), 1));
  const nextArr = (dndAssignments[driverId] && dndAssignments[driverId][nextDateKey]) || [];
  if (nextArr.length > 0 && dayBlocks.length > 0) {
    const todayMaxEnd = Math.max(...dayBlocks.map(b => timeToMin(b.end)));
    const nextMinStart = Math.min(...nextArr.map(b => timeToMin(b.start)));
    const rest = (24 * 60 - todayMaxEnd) + nextMinStart;
    if (rest < KAIZEN_LIMITS.rest9) {
      result.violations.push(`翌日との休息期間 ${kaizenFmtH(rest)}（最低9h未満）`);
    } else if (rest < KAIZEN_LIMITS.rest11) {
      result.warnings.push(`翌日との休息期間 ${kaizenFmtH(rest)}（原則11h未満）`);
    }
  }

  if (result.violations.length > 0) result.level = 'violation';
  else if (result.warnings.length > 0) result.level = 'warn';
  return result;
}

// ═══════════════════════════════════════════════════════════════
//  ステップ10：改善基準告示チェックをassignmentベースに移行
//  従来の kaizenCheck() は dndAssignments[driverId][dateKey] を見ていたが、
//  これは「ドライバー行 = 1人」の前提で、車両を差し替えても影響しないため
//  実態に合っていた。ただしassignments[]を真のソースにすると、
//  ・案件単位での解析
//  ・複数日にまたがる分析
//  ・新APIから直接呼び出し
//  が可能になる。両APIの結果が一致するように設計。
// ═══════════════════════════════════════════════════════════════

// 新版: assignments[] からドライバー別/日付別のブロックを直接構築
//   driverId: 新形式（'D001'など）or 旧形式（'V1245'など）どちらでもOK
//   dateKey: 'YYYY-MM-DD'
//   candidate: 追加検討する {start, end}（移動先評価用、nullなら現状評価）
//   excludeAssignmentId: 移動元assignmentのID（重複カウント回避）
function kaizenCheckByAssignments(driverId, dateKey, candidate, excludeAssignmentId) {
  const result = { level: 'ok', violations: [], warnings: [] };
  if (!driverId || !dateKey) return result;

  // driverIdの正規化：旧形式('V1245')なら新形式('D002')に変換
  let newDid = driverId;
  if (driverId.startsWith('V')) {
    const converted = _legacyDriverIdToNew(driverId);
    if (converted) newDid = converted;
  }

  // 当日のassignmentsを集める（自身除外＋候補追加）
  const dayBlocks = assignments
    .filter(a => a.driverId === newDid && a.date === dateKey && a.id !== excludeAssignmentId)
    .map(a => ({ start: a.start, end: a.end, _aid: a.id, _client: a.client }));
  if (candidate && candidate.start && candidate.end) {
    dayBlocks.push({ start: candidate.start, end: candidate.end, _candidate: true });
  }
  if (dayBlocks.length === 0) return result;

  // 1) 拘束時間
  const duty = kaizenComputeDuty(dayBlocks);
  if (duty > KAIZEN_LIMITS.duty15) {
    result.violations.push(`拘束時間 ${kaizenFmtH(duty)}（上限15h超）`);
  } else if (duty > KAIZEN_LIMITS.duty13) {
    result.warnings.push(`拘束時間 ${kaizenFmtH(duty)}（原則13h超）`);
  }

  // 2) 連続運転時間
  const cont = kaizenComputeMaxContinuous(dayBlocks);
  if (cont > KAIZEN_LIMITS.drive4) {
    result.violations.push(`連続運転 ${kaizenFmtH(cont)}（上限4h超・要30分休憩）`);
  } else if (cont > KAIZEN_LIMITS.drive4 - 30) {
    result.warnings.push(`連続運転 ${kaizenFmtH(cont)}（4h目前）`);
  }

  // 3) 前日との休息期間
  const prevDateKey = dndDateKey(dndAddDays(new Date(dateKey + 'T00:00:00'), -1));
  const prevBlocks = assignments
    .filter(a => a.driverId === newDid && a.date === prevDateKey)
    .map(a => ({ start: a.start, end: a.end }));
  if (prevBlocks.length > 0) {
    const prevMaxEnd = Math.max(...prevBlocks.map(b => timeToMin(b.end)));
    const todayMinStart = Math.min(...dayBlocks.map(b => timeToMin(b.start)));
    const rest = (24 * 60 - prevMaxEnd) + todayMinStart;
    if (rest < KAIZEN_LIMITS.rest9) {
      result.violations.push(`休息期間 ${kaizenFmtH(rest)}（最低9h未満）`);
    } else if (rest < KAIZEN_LIMITS.rest11) {
      result.warnings.push(`休息期間 ${kaizenFmtH(rest)}（原則11h未満）`);
    }
  }

  // 4) 翌日との休息期間
  const nextDateKey = dndDateKey(dndAddDays(new Date(dateKey + 'T00:00:00'), 1));
  const nextBlocks = assignments
    .filter(a => a.driverId === newDid && a.date === nextDateKey)
    .map(a => ({ start: a.start, end: a.end }));
  if (nextBlocks.length > 0) {
    const todayMaxEnd = Math.max(...dayBlocks.map(b => timeToMin(b.end)));
    const nextMinStart = Math.min(...nextBlocks.map(b => timeToMin(b.start)));
    const rest = (24 * 60 - todayMaxEnd) + nextMinStart;
    if (rest < KAIZEN_LIMITS.rest9) {
      result.violations.push(`翌日との休息期間 ${kaizenFmtH(rest)}（最低9h未満）`);
    } else if (rest < KAIZEN_LIMITS.rest11) {
      result.warnings.push(`翌日との休息期間 ${kaizenFmtH(rest)}（原則11h未満）`);
    }
  }

  if (result.violations.length > 0) result.level = 'violation';
  else if (result.warnings.length > 0) result.level = 'warn';
  return result;
}

// 全ドライバー×全日付の違反集計を返す（衝突インジケータ的に使える）
function kaizenScanAll() {
  const days = new Set();
  const byDriver = new Set();
  assignments.forEach(a => { days.add(a.date); byDriver.add(a.driverId); });

  const out = [];
  byDriver.forEach(did => {
    days.forEach(d => {
      const r = kaizenCheckByAssignments(did, d, null, null);
      if (r.level !== 'ok') {
        out.push({ driverId: did, date: d, ...r });
      }
    });
  });
  return out;
}

// 公開APIに追加
if (typeof window !== 'undefined' && window.assignmentAPI) {
  window.assignmentAPI.kaizenCheck = kaizenCheckByAssignments;
  window.assignmentAPI.kaizenScanAll = kaizenScanAll;
  // 既存のvalidateにkaizenを統合
  const _origValidate = window.assignmentAPI.validate;
  window.assignmentAPI.validateFull = function(assignmentId) {
    const base = _origValidate.call(window.assignmentAPI, assignmentId);
    const a = getAssignmentById(assignmentId);
    if (!a) return base;
    const k = kaizenCheckByAssignments(a.driverId, a.date, null, assignmentId);
    return Object.assign({}, base, { kaizen: k });
  };
}

// ═══════════════════════════════════════════════════════════════
//  ステップ13：改善基準告示違反の自動解消提案
//  違反assignmentに対して「このドライバーに移すと違反が解消される」
//  候補を推薦する。スコアリングは以下の優先度：
//   1. 移動先で違反/警告が出ないか
//   2. 移動先の積載量が足りるか
//   3. 移動先で時間衝突が出ないか
//   4. 移動元・移動先の改善基準告示が改善するか（余裕度）
// ═══════════════════════════════════════════════════════════════

// 1つのassignmentについて、現在のドライバー以外で「移動可能・改善する」候補を返す
//   maxResults: 候補上位N件
function proposeKaizenFix(assignmentId, maxResults) {
  maxResults = maxResults || 5;
  const a = getAssignmentById(assignmentId);
  if (!a) return { ok: false, reason: 'assignment not found', candidates: [] };

  // 現在のドライバーの違反状況
  const beforeKaizen = kaizenCheckByAssignments(a.driverId, a.date, null);
  const beforeValidation = validateAssignment(a);

  const candidates = [];

  drivers.forEach(d => {
    if (d.id === a.driverId) return; // 自分自身はスキップ
    if (d.partner) return; // 協力会社ドライバーは原則対象外（必要なら緩和可能）

    // この移動先で「a を持っていったら」どうなるかをシミュレート
    // 物理的に書き換えず、kaizenCheckByAssignmentsのcandidate引数で評価
    const simKaizen = kaizenCheckByAssignments(d.id, a.date, { start: a.start, end: a.end }, a.id);

    // 時間衝突チェック：dの当日のassignmentsとaが重なるか
    const dAssigns = assignments.filter(x => x.driverId === d.id && x.date === a.date && x.id !== a.id);
    const conflict = dAssigns.some(x => _overlaps(x, a));

    // 移動先車両（D固定車両）での積載チェック
    const idx = drivers.findIndex(x => x.id === d.id);
    const defaultV = vehicles[idx] || null;
    let capacityOk = true;
    let capacityNeeded = 0, capacityMax = 0;
    if (defaultV && a.goods) {
      const m = String(a.goods).match(/([\d,]+)\s*kg/);
      if (m) {
        const need = parseInt(m[1].replace(/,/g, ''), 10);
        capacityNeeded = need;
        capacityMax = defaultV.maxLoad;
        if (need > defaultV.maxLoad) capacityOk = false;
      }
    }

    // 拘束時間の「余裕」を計算（移動先の業務終了時刻 - 開始時刻）
    const dayBlocks = dAssigns.map(x => ({ start: x.start, end: x.end }));
    dayBlocks.push({ start: a.start, end: a.end });
    const duty = kaizenComputeDuty(dayBlocks); // 分

    // スコアリング（高いほど推奨）
    let score = 100;
    let reasonTags = [];
    let blockers = [];

    if (simKaizen.level === 'violation') {
      score -= 60;
      blockers.push('改善基準告示違反: ' + (simKaizen.violations[0] || ''));
    } else if (simKaizen.level === 'warn') {
      score -= 20;
      reasonTags.push('注意付き');
    } else {
      reasonTags.push('改善基準クリア');
    }

    if (conflict) {
      score -= 70;
      blockers.push('時間衝突あり');
    } else {
      reasonTags.push('時間OK');
    }

    if (!capacityOk) {
      score -= 50;
      blockers.push(`積載不足(${capacityNeeded}/${capacityMax}kg)`);
    } else if (capacityNeeded > 0) {
      reasonTags.push(`積載余裕 ${Math.round((1 - capacityNeeded/capacityMax) * 100)}%`);
    }

    // 拘束時間が短いほど高評価（余裕がある）
    const dutyHours = duty / 60;
    if (dutyHours < 10) score += 8;
    else if (dutyHours < 12) score += 3;

    candidates.push({
      driverId: d.id,
      driverName: d.name,
      vehicleId: defaultV ? defaultV.id : null,
      vehiclePlate: defaultV ? defaultV.plate : '—',
      score,
      blockers,
      reasonTags,
      simKaizen,
      capacityOk,
      timeOk: !conflict,
      dutyAfter: duty,
      feasible: simKaizen.level !== 'violation' && !conflict && capacityOk
    });
  });

  // スコア降順
  candidates.sort((x, y) => y.score - x.score);

  return {
    ok: true,
    assignment: {
      id: a.id, driverId: a.driverId, date: a.date,
      start: a.start, end: a.end, client: a.client, goods: a.goods
    },
    currentDriver: {
      driverId: a.driverId,
      driverName: (getDriverById(a.driverId) || {}).name,
      beforeKaizen,
      beforeValidation
    },
    candidates: candidates.slice(0, maxResults),
    feasibleCount: candidates.filter(c => c.feasible).length
  };
}

// 全違反assignmentに対する解消提案を一括取得
function proposeKaizenFixAll() {
  const alerts = kaizenScanAll();
  // 各alertのdriverIdの日付の中で違反を起こしているassignmentを集める
  const out = [];
  alerts.filter(al => al.level === 'violation').forEach(al => {
    // このドライバー・日付の各assignmentについて、その案件を別ドライバーに移したら違反が解消されるか
    const dayAssigns = assignments.filter(x => x.driverId === al.driverId && x.date === al.date);
    dayAssigns.forEach(a => {
      // この案件を除外した場合、まだ違反が残るか
      const withoutThis = kaizenCheckByAssignments(al.driverId, al.date, null, a.id);
      const willResolve = al.level === 'violation' && withoutThis.level !== 'violation';
      if (willResolve) {
        const proposal = proposeKaizenFix(a.id, 3);
        out.push({
          assignmentId: a.id,
          driverId: al.driverId,
          driverName: (getDriverById(al.driverId) || {}).name,
          date: al.date,
          client: a.client,
          start: a.start, end: a.end,
          violations: al.violations,
          topCandidates: proposal.candidates.filter(c => c.feasible).slice(0, 3)
        });
      }
    });
  });
  return out;
}

window.assignmentAPI.proposeKaizenFix = proposeKaizenFix;
window.assignmentAPI.proposeKaizenFixAll = proposeKaizenFixAll;

// 提案を適用する：assignmentId を 候補のドライバーに移す
window.assignmentAPI.applyKaizenProposal = function(assignmentId, targetDriverId, opts) {
  opts = opts || {};
  const a = getAssignmentById(assignmentId);
  if (!a) return { ok: false, reason: 'assignment not found' };
  const beforeDid = a.driverId;
  // 移動先のドライバー固定車両も合わせて差し替えるか
  const r1 = reassignDriver(assignmentId, targetDriverId);
  if (!r1.ok) return r1;
  if (opts.alsoChangeVehicle !== false) {
    const idx = drivers.findIndex(d => d.id === targetDriverId);
    if (idx >= 0 && vehicles[idx]) {
      reassignVehicle(assignmentId, vehicles[idx].id);
    }
  }
  rebuildAssignmentIndex();
  return { ok: true, beforeDid, after: targetDriverId, assignmentId };
};

// ─── 提案モーダルUI ───
window.openKaizenProposals = function() {
  // 既存があれば閉じる
  const existing = document.getElementById('kaizen-proposal-backdrop');
  if (existing) existing.remove();

  const proposals = proposeKaizenFixAll();

  let body;
  if (proposals.length === 0) {
    body = `<div style="padding:40px 20px;text-align:center;color:#6b7280">
      <div style="font-size:32px;margin-bottom:8px">✅</div>
      <div style="font-size:14px;font-weight:600;color:#0D4A3A">解消可能な改善基準告示違反はありません</div>
      <div style="font-size:11px;color:#9ca3af;margin-top:4px">現在のシステム判定では、配車変更で解消できる違反は検出されませんでした。</div>
    </div>`;
  } else {
    body = proposals.map(p => {
      const candHtml = p.topCandidates.length > 0
        ? p.topCandidates.map(c => {
            const tags = c.reasonTags.map(t => `<span class="kpf-tag">${t}</span>`).join('');
            return `<div class="kpf-cand" data-assignment-id="${p.assignmentId}" data-driver-id="${c.driverId}">
              <div class="kpf-cand-main">
                <div class="kpf-cand-name">${c.driverName}</div>
                <div class="kpf-cand-vehicle">${c.vehiclePlate}</div>
                <div class="kpf-cand-tags">${tags}</div>
              </div>
              <div class="kpf-cand-score">
                <div class="kpf-cand-score-val">${c.score}</div>
                <div class="kpf-cand-score-label">適合度</div>
              </div>
              <button class="kpf-apply-btn" onclick="window.__applyKaizenProposal('${p.assignmentId}','${c.driverId}')">適用</button>
            </div>`;
          }).join('')
        : '<div class="kpf-no-cand">移動可能なドライバーが見つかりません</div>';

      const violationsHtml = p.violations.map(v => `<div class="kpf-violation-line">🚨 ${v}</div>`).join('');

      return `<div class="kpf-proposal">
        <div class="kpf-prop-header">
          <div class="kpf-prop-current">
            <div class="kpf-prop-badge">違反</div>
            <div>
              <div class="kpf-prop-driver">${p.driverName} <span class="kpf-prop-date">@ ${p.date}</span></div>
              <div class="kpf-prop-case">${p.client} ｜ ${p.start} - ${p.end}</div>
            </div>
          </div>
          <div class="kpf-prop-violations">${violationsHtml}</div>
        </div>
        <div class="kpf-prop-suggest-title">↓ 以下のドライバーに移すと違反が解消します</div>
        <div class="kpf-cands">${candHtml}</div>
      </div>`;
    }).join('');
  }

  const backdrop = document.createElement('div');
  backdrop.id = 'kaizen-proposal-backdrop';
  backdrop.className = 'vehicle-picker-backdrop';
  backdrop.onclick = function(e) { if (e.target === backdrop) backdrop.remove(); };
  backdrop.innerHTML = `
    <div class="vehicle-picker" style="width:720px;max-width:94vw" onclick="event.stopPropagation()">
      <div class="vehicle-picker-header">
        <div class="vehicle-picker-title">🩺 改善基準告示違反の自動解消提案
          ${proposals.length > 0 ? `<span style="font-size:11px;color:#dc2626;font-weight:700;margin-left:8px">${proposals.length}件の解消候補</span>` : ''}
        </div>
        <button class="vehicle-picker-close" onclick="document.getElementById('kaizen-proposal-backdrop').remove()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="vehicle-picker-body" style="max-height:70vh">
        ${body}
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
};

window.__applyKaizenProposal = function(assignmentId, targetDriverId) {
  const result = window.assignmentAPI.applyKaizenProposal(assignmentId, targetDriverId, { alsoChangeVehicle: true });
  if (!result.ok) {
    if (typeof showToast === 'function') showToast('適用に失敗: ' + (result.reason || ''), 'error');
    return;
  }
  const d = getDriverById(targetDriverId);
  if (typeof showToast === 'function') {
    showToast(`案件を ${d ? d.name : targetDriverId} に移しました。違反が解消されました。`, 'success');
  }
  // モーダルを閉じて再描画
  const bd = document.getElementById('kaizen-proposal-backdrop');
  if (bd) bd.remove();
  if (typeof renderSchedule === 'function') renderSchedule();
};

// ═══════════════════════════════════════════════════════════════
//  ステップ14：アサインメントのCSV/JSONエクスポート
//  assignments[] が単一情報源になったので、データ出力もシンプル。
//  drivers/vehicles も join した「フラット」な形式で出力する。
// ═══════════════════════════════════════════════════════════════

// CSV用：1セルをエスケープ
function _csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  // ダブルクォート・カンマ・改行を含むならクォート＋ダブルクォートはエスケープ
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// フィルタオプションに従ってassignmentを抽出
function _filterAssignments(opts) {
  opts = opts || {};
  let list = assignments.slice();
  if (opts.tab) list = list.filter(a => a.tab === opts.tab);
  if (opts.date) list = list.filter(a => a.date === opts.date);
  if (opts.driverId) list = list.filter(a => a.driverId === opts.driverId);
  if (opts.dateFrom) list = list.filter(a => a.date >= opts.dateFrom);
  if (opts.dateTo) list = list.filter(a => a.date <= opts.dateTo);
  return list;
}

// 1行をフラット化（drivers/vehicles を join）
function _flattenAssignment(a) {
  const d = getDriverById(a.driverId);
  const v = getVehicleById(a.vehicleId);
  // 衝突状態
  const val = validateAssignment(a);
  const kaizen = kaizenCheckByAssignments(a.driverId, a.date, null, a.id);
  return {
    assignmentId: a.id,
    tab: a.tab,
    date: a.date,
    start: a.start,
    end: a.end,
    durationMin: _hhmmToMin(a.end) - _hhmmToMin(a.start),
    driverId: a.driverId,
    driverName: d ? d.name : '',
    driverLicense: d ? (d.license || []).join('|') : '',
    driverPartner: d ? (d.partner ? d.partnerName : '') : '',
    vehicleId: a.vehicleId,
    vehiclePlate: v ? v.plate : '',
    vehicleType: v ? v.type : '',
    vehicleTon: v ? v.ton : '',
    vehicleMaxLoad: v ? v.maxLoad : '',
    status: a.status,
    client: a.client,
    from: a.from,
    to: a.to,
    goods: a.goods,
    deadline: a.deadline,
    hasDriverConflict: val.conflicts.driver.length > 0 ? 'YES' : '',
    hasVehicleConflict: val.conflicts.vehicle.length > 0 ? 'YES' : '',
    hasCapacityIssue: val.conflicts.capacity ? 'YES' : '',
    kaizenLevel: kaizen.level,
    kaizenIssues: [...(kaizen.violations || []), ...(kaizen.warnings || [])].join(' | ')
  };
}

// CSVエクスポート
function exportAssignmentsCSV(opts) {
  const list = _filterAssignments(opts);
  if (list.length === 0) return '';
  const flat = list.map(_flattenAssignment);
  const headers = Object.keys(flat[0]);
  const rows = flat.map(o => headers.map(h => _csvEscape(o[h])).join(','));
  // BOM付きでExcelでも文字化けしない
  return '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
}

// JSONエクスポート（schema付きの構造化形式）
function exportAssignmentsJSON(opts) {
  const list = _filterAssignments(opts);
  // 関連するdrivers/vehicles も含めて自己完結したアーカイブ形式に
  const usedDriverIds = new Set(list.map(a => a.driverId));
  const usedVehicleIds = new Set(list.map(a => a.vehicleId));
  return {
    schema: 'logipocket-dispatch-v1',
    exportedAt: new Date().toISOString(),
    filter: opts || {},
    drivers: drivers.filter(d => usedDriverIds.has(d.id)),
    vehicles: vehicles.filter(v => usedVehicleIds.has(v.id)),
    assignments: list.map(a => ({
      id: a.id,
      tab: a.tab,
      date: a.date,
      start: a.start,
      end: a.end,
      driverId: a.driverId,
      vehicleId: a.vehicleId,
      status: a.status,
      client: a.client,
      from: a.from,
      to: a.to,
      goods: a.goods,
      deadline: a.deadline,
      label: a.label,
      color: a.color
    })),
    // 統計情報も同梱
    stats: {
      total: list.length,
      byTab: list.reduce((acc, a) => { acc[a.tab] = (acc[a.tab] || 0) + 1; return acc; }, {}),
      byDate: list.reduce((acc, a) => { acc[a.date] = (acc[a.date] || 0) + 1; return acc; }, {}),
      conflictCount: list.filter(a => !validateAssignment(a).ok).length,
      kaizenViolationCount: list.filter(a => {
        const k = kaizenCheckByAssignments(a.driverId, a.date, null, a.id);
        return k.level === 'violation';
      }).length
    }
  };
}

// ブラウザでダウンロード
function downloadAssignments(format, opts) {
  format = (format || 'csv').toLowerCase();
  const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  let content, mime, filename;
  if (format === 'json') {
    content = JSON.stringify(exportAssignmentsJSON(opts), null, 2);
    mime = 'application/json;charset=utf-8';
    filename = `assignments_${ts}.json`;
  } else {
    content = exportAssignmentsCSV(opts);
    mime = 'text/csv;charset=utf-8';
    filename = `assignments_${ts}.csv`;
  }
  if (typeof Blob === 'undefined') return content; // Node環境向けフォールバック

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  if (typeof showToast === 'function') {
    showToast(`${filename} をダウンロードしました（${(opts && opts.tab) || '全タブ'} / ${(opts && opts.date) || '全日付'}）`, 'success');
  }
  return filename;
}

// エクスポートメニューUI
window.openExportMenu = function() {
  // 既存があれば閉じる
  const existing = document.getElementById('export-menu-backdrop');
  if (existing) existing.remove();

  // 利用可能な日付/タブを集計
  const dates = [...new Set(assignments.map(a => a.date))].sort();
  const tabs = [...new Set(assignments.map(a => a.tab))];

  const backdrop = document.createElement('div');
  backdrop.id = 'export-menu-backdrop';
  backdrop.className = 'vehicle-picker-backdrop';
  backdrop.onclick = function(e) { if (e.target === backdrop) backdrop.remove(); };
  backdrop.innerHTML = `
    <div class="vehicle-picker" style="width:520px;max-width:92vw" onclick="event.stopPropagation()">
      <div class="vehicle-picker-header">
        <div class="vehicle-picker-title">📥 アサインメントをエクスポート</div>
        <button class="vehicle-picker-close" onclick="document.getElementById('export-menu-backdrop').remove()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="vehicle-picker-body">
        <div style="margin-bottom:14px;font-size:12px;color:#6b7280">
          現在のアサインメント <strong style="color:#1a1a1a">${assignments.length}件</strong>
          ｜ ドライバー <strong style="color:#1a1a1a">${new Set(assignments.map(a=>a.driverId)).size}人</strong>
          ｜ 車両 <strong style="color:#1a1a1a">${new Set(assignments.map(a=>a.vehicleId)).size}台</strong>
        </div>

        <div style="margin-bottom:10px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">フィルタ</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          <label style="display:flex;flex-direction:column;gap:4px">
            <span style="font-size:11px;color:#6b7280">タブ</span>
            <select id="export-filter-tab" class="vehicle-picker-search" style="margin:0">
              <option value="">すべて</option>
              ${tabs.map(t => `<option value="${t}">${t === 'planning' ? '計画中' : t === 'confirmed' ? '確定済み' : t}</option>`).join('')}
            </select>
          </label>
          <label style="display:flex;flex-direction:column;gap:4px">
            <span style="font-size:11px;color:#6b7280">日付</span>
            <select id="export-filter-date" class="vehicle-picker-search" style="margin:0">
              <option value="">すべて</option>
              ${dates.map(d => `<option value="${d}">${d}</option>`).join('')}
            </select>
          </label>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button onclick="window.__doExport('csv')" style="padding:12px;background:#1A6B56;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif;display:flex;flex-direction:column;align-items:center;gap:4px">
            <span style="font-size:18px">📊</span>
            <span>CSV形式</span>
            <span style="font-size:10px;font-weight:400;opacity:.85">Excel・スプレッドシート向き</span>
          </button>
          <button onclick="window.__doExport('json')" style="padding:12px;background:#0D4A3A;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif;display:flex;flex-direction:column;align-items:center;gap:4px">
            <span style="font-size:18px">📦</span>
            <span>JSON形式</span>
            <span style="font-size:10px;font-weight:400;opacity:.85">システム連携・バックアップ向き</span>
          </button>
        </div>

        <div style="margin-top:10px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">📄 PDF出力（印刷用）</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px">
          <button onclick="window.__doExport('pdf-table')" style="padding:12px;background:#fff;color:#0D4A3A;border:2px solid #0D4A3A;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif;display:flex;flex-direction:column;align-items:center;gap:4px">
            <span style="font-size:18px">📄</span>
            <span>PDF：運行表</span>
            <span style="font-size:10px;font-weight:400;color:#6b7280">A4縦・案件ごとに1行</span>
          </button>
          <button onclick="window.__doExport('pdf-timeline')" style="padding:12px;background:#fff;color:#0D4A3A;border:2px solid #0D4A3A;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif;display:flex;flex-direction:column;align-items:center;gap:4px">
            <span style="font-size:18px">📅</span>
            <span>PDF：タイムライン</span>
            <span style="font-size:10px;font-weight:400;color:#6b7280">A4横・ガントチャート形式</span>
          </button>
        </div>

        <div style="margin-top:14px;padding:10px 12px;background:#f9fafb;border-radius:6px;font-size:11px;color:#6b7280">
          <strong style="color:#1a1a1a">📋 出力形式について</strong>：<br>
          ・<strong>CSV/JSON</strong>：assignment + drivers + vehicles をjoinした24カラム形式。時間衝突・積載超過・改善基準告示違反のフラグも含まれます。<br>
          ・<strong>PDF</strong>：印刷ダイアログが開きます。「PDFとして保存」を選ぶとPDFファイルとして出力できます。
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
};

window.__doExport = function(format) {
  const tab = (document.getElementById('export-filter-tab') || {}).value || null;
  const date = (document.getElementById('export-filter-date') || {}).value || null;
  const opts = {};
  if (tab) opts.tab = tab;
  if (date) opts.date = date;

  if (format === 'pdf-table') {
    exportAssignmentsPDF(opts);
  } else if (format === 'pdf-timeline') {
    exportAssignmentsPDFTimeline(opts);
  } else {
    downloadAssignments(format, opts);
  }

  const bd = document.getElementById('export-menu-backdrop');
  if (bd) bd.remove();
};

window.assignmentAPI.exportCSV = exportAssignmentsCSV;
window.assignmentAPI.exportJSON = exportAssignmentsJSON;
window.assignmentAPI.download = downloadAssignments;

// ═══════════════════════════════════════════════════════════════
//  PDFエクスポート（運行表 / タイムライン）
//  ブラウザの印刷機能を活用：印刷用CSS付きの新規ウィンドウを開き
//  ユーザーが「PDFとして保存」を選んで出力する方式。
//  日本語フォントは ブラウザ標準を使うので埋め込み不要・崩れなし。
// ═══════════════════════════════════════════════════════════════

// HTML特殊文字をエスケープ
function _pdfEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// 日付フォーマット（YYYY-MM-DD → 2026年5月27日(水)）
function _pdfFormatDate(ymd) {
  if (!ymd) return '';
  const m = ymd.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return ymd;
  const d = new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]));
  const dow = ['日','月','火','水','木','金','土'][d.getDay()];
  return `${parseInt(m[1])}年${parseInt(m[2])}月${parseInt(m[3])}日(${dow})`;
}

// 共通：印刷ウィンドウを開いて HTML を流し込む
function _pdfOpenPrintWindow(title, bodyHtml, extraCss) {
  const w = window.open('', '_blank', 'width=900,height=720');
  if (!w) {
    if (typeof showToast === 'function') showToast('ポップアップがブロックされました。許可してください', 'error');
    return null;
  }
  const css = `
    @page { size: A4; margin: 12mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif;
      margin: 0; padding: 16px;
      color: #1a1a1a; font-size: 11px; line-height: 1.5;
      background: #fff;
    }
    .pdf-toolbar {
      position: sticky; top: 0; z-index: 100;
      background: #f3f4f6; border-bottom: 1px solid #d1d5db;
      padding: 10px 16px; margin: -16px -16px 16px;
      display: flex; align-items: center; gap: 10px;
    }
    .pdf-toolbar button {
      padding: 8px 16px; border: none; border-radius: 6px;
      cursor: pointer; font-size: 12px; font-weight: 700;
      font-family: inherit;
    }
    .pdf-toolbar .btn-primary { background: #1A6B56; color: #fff; }
    .pdf-toolbar .btn-primary:hover { background: #0D4A3A; }
    .pdf-toolbar .btn-secondary { background: #fff; border: 1px solid #d1d5db; color: #374151; }
    .pdf-toolbar .pdf-toolbar-hint { font-size: 11px; color: #6b7280; margin-left: auto; }
    .pdf-header {
      display: flex; justify-content: space-between; align-items: flex-end;
      border-bottom: 2px solid #1A6B56; padding-bottom: 8px; margin-bottom: 14px;
    }
    .pdf-title { font-size: 18px; font-weight: 800; color: #0D4A3A; }
    .pdf-subtitle { font-size: 11px; color: #6b7280; margin-top: 3px; }
    .pdf-meta { font-size: 10px; color: #6b7280; text-align: right; }
    .pdf-meta strong { color: #1a1a1a; }
    .pdf-stats {
      display: flex; gap: 14px;
      margin-bottom: 14px;
      padding: 8px 12px; background: #f9fafb; border-left: 3px solid #1A6B56; border-radius: 0 4px 4px 0;
    }
    .pdf-stat { font-size: 11px; color: #6b7280; }
    .pdf-stat strong { color: #1a1a1a; font-size: 13px; font-weight: 800; margin-right: 4px; }
    .pdf-footer {
      margin-top: 20px; padding-top: 8px;
      border-top: 1px solid #d1d5db;
      font-size: 9px; color: #9ca3af;
      display: flex; justify-content: space-between;
    }
    ${extraCss || ''}
  `;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${_pdfEsc(title)}</title><style>${css}</style></head><body>${bodyHtml}</body></html>`);
  w.document.close();
  return w;
}

// 印刷トリガー用のツールバーHTML
function _pdfToolbarHtml() {
  return `
    <div class="pdf-toolbar no-print">
      <button class="btn-primary" onclick="window.print()">🖨️ PDFとして保存 / 印刷</button>
      <button class="btn-secondary" onclick="window.close()">閉じる</button>
      <span class="pdf-toolbar-hint">印刷ダイアログで「PDFとして保存」または「PDFに保存」を選択してください</span>
    </div>
  `;
}

// PDF出力：一覧表形式（A4縦・各案件1行）
function exportAssignmentsPDF(opts) {
  const list = _filterAssignments(opts || {});
  // 日付→ドライバー名→開始時刻 でソート
  list.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const dnA = (getDriverById(a.driverId) || {}).name || '';
    const dnB = (getDriverById(b.driverId) || {}).name || '';
    if (dnA !== dnB) return dnA < dnB ? -1 : 1;
    return _hhmmToMin(a.start) - _hhmmToMin(b.start);
  });

  // 集計
  const driverSet = new Set(list.map(a => a.driverId));
  const vehicleSet = new Set(list.map(a => a.vehicleId));
  const dateSet = new Set(list.map(a => a.date));
  const tabLabel = opts && opts.tab ? (opts.tab === 'planning' ? '計画中' : opts.tab === 'confirmed' ? '確定済み' : opts.tab) : '全タブ';
  const dateLabel = opts && opts.date ? _pdfFormatDate(opts.date) : (dateSet.size === 1 ? _pdfFormatDate([...dateSet][0]) : `全${dateSet.size}日`);

  // テーブル行
  const rows = list.map((a, idx) => {
    const d = getDriverById(a.driverId);
    const v = getVehicleById(a.vehicleId);
    const val = validateAssignment(a);
    const kaizen = kaizenCheckByAssignments(a.driverId, a.date, null, a.id);
    let flags = [];
    if (!val.ok) {
      if (val.conflicts.driver.length > 0) flags.push('時間衝突');
      if (val.conflicts.vehicle.length > 0) flags.push('車両衝突');
      if (val.conflicts.capacity) flags.push('積載超過');
    }
    if (kaizen.level === 'violation') flags.push('基準違反');
    else if (kaizen.level === 'warn') flags.push('基準注意');

    return `
      <tr>
        <td class="num">${idx + 1}</td>
        <td>${_pdfEsc(a.date)}</td>
        <td class="time">${_pdfEsc(a.start)}–${_pdfEsc(a.end)}</td>
        <td>${_pdfEsc(d ? d.name : a.driverId)}${d && d.partner ? `<br><span class="sub">傭車: ${_pdfEsc(d.partnerName || '')}</span>` : ''}</td>
        <td class="vehicle">${_pdfEsc(v ? v.plate : a.vehicleId)}${v ? `<br><span class="sub">${_pdfEsc(v.type)} ${v.ton}t</span>` : ''}</td>
        <td>${_pdfEsc(a.client)}</td>
        <td class="route">${_pdfEsc(a.from)}<br>→ ${_pdfEsc(a.to)}</td>
        <td>${_pdfEsc(a.goods || '')}</td>
        <td>${_pdfEsc(a.deadline || '')}</td>
        <td class="flags">${flags.map(f => `<span class="flag flag-${f.includes('違反') || f.includes('衝突') || f.includes('超過') ? 'bad' : 'warn'}">${f}</span>`).join('')}</td>
      </tr>
    `;
  }).join('');

  const extraCss = `
    .runtable {
      width: 100%; border-collapse: collapse; font-size: 10px;
    }
    .runtable thead th {
      background: #0D4A3A; color: #fff;
      padding: 7px 6px; text-align: left;
      font-weight: 700; font-size: 9px;
      border: 1px solid #0D4A3A;
      letter-spacing: 0.02em;
    }
    .runtable tbody td {
      padding: 6px 6px; border: 1px solid #d1d5db;
      vertical-align: top; line-height: 1.4;
    }
    .runtable tbody tr:nth-child(even) td { background: #f9fafb; }
    .runtable .num { text-align: right; width: 28px; color: #9ca3af; font-family: monospace; }
    .runtable .time { white-space: nowrap; font-family: 'Inter', monospace; font-weight: 600; }
    .runtable .vehicle { font-family: 'Inter', monospace; }
    .runtable .route { font-size: 9.5px; }
    .runtable .sub { color: #6b7280; font-size: 9px; }
    .runtable .flags { white-space: nowrap; }
    .runtable .flag {
      display: inline-block; padding: 1px 5px; margin: 0 2px 2px 0;
      font-size: 8px; font-weight: 700; border-radius: 3px;
      white-space: nowrap;
    }
    .runtable .flag-bad { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .runtable .flag-warn { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
    .empty-state { text-align: center; padding: 40px; color: #9ca3af; }
  `;

  const body = `
    ${_pdfToolbarHtml()}
    <div class="pdf-header">
      <div>
        <div class="pdf-title">運行表（${_pdfEsc(tabLabel)}）</div>
        <div class="pdf-subtitle">対象期間：${_pdfEsc(dateLabel)}</div>
      </div>
      <div class="pdf-meta">
        出力日時：<strong>${new Date().toLocaleString('ja-JP')}</strong><br>
        出力者：<strong>配車計画システム</strong>
      </div>
    </div>
    <div class="pdf-stats">
      <div class="pdf-stat"><strong>${list.length}</strong>件の運行</div>
      <div class="pdf-stat"><strong>${driverSet.size}</strong>名のドライバー</div>
      <div class="pdf-stat"><strong>${vehicleSet.size}</strong>台の車両</div>
      <div class="pdf-stat"><strong>${dateSet.size}</strong>日分</div>
    </div>
    ${list.length === 0 ? '<div class="empty-state">該当する運行データがありません</div>' :
    `<table class="runtable">
      <thead>
        <tr>
          <th style="width:28px">#</th>
          <th style="width:75px">日付</th>
          <th style="width:65px">時間</th>
          <th style="width:90px">ドライバー</th>
          <th style="width:85px">車両</th>
          <th>顧客</th>
          <th>区間</th>
          <th>貨物</th>
          <th style="width:75px">納期</th>
          <th style="width:85px">フラグ</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`}
    <div class="pdf-footer">
      <span>運行表 / ${_pdfEsc(tabLabel)} / ${_pdfEsc(dateLabel)}</span>
      <span>生成: 配車計画システム</span>
    </div>
  `;

  const w = _pdfOpenPrintWindow('運行表_' + new Date().toISOString().substring(0, 10), body, extraCss);
  return w ? 'opened' : null;
}

// PDF出力：タイムライン形式（A4横・1日のガントチャート風）
function exportAssignmentsPDFTimeline(opts) {
  opts = opts || {};
  // タイムラインは日付別なので、日付が指定されていない場合は最頻日を採用
  let targetDate = opts.date;
  if (!targetDate) {
    const dateCounts = {};
    assignments.forEach(a => {
      if (opts.tab && a.tab !== opts.tab) return;
      dateCounts[a.date] = (dateCounts[a.date] || 0) + 1;
    });
    let max = 0;
    Object.keys(dateCounts).forEach(d => {
      if (dateCounts[d] > max) { max = dateCounts[d]; targetDate = d; }
    });
  }
  if (!targetDate) {
    if (typeof showToast === 'function') showToast('出力対象の日付が見つかりません', 'error');
    return null;
  }

  const list = _filterAssignments({ ...opts, date: targetDate });
  // ドライバー別にまとめる
  const byDriver = {};
  list.forEach(a => {
    if (!byDriver[a.driverId]) byDriver[a.driverId] = [];
    byDriver[a.driverId].push(a);
  });
  const driverIds = Object.keys(byDriver).sort((a, b) => {
    const dA = getDriverById(a), dB = getDriverById(b);
    return (dA && dA.name ? dA.name : a).localeCompare(dB && dB.name ? dB.name : b, 'ja');
  });

  // タイムスケール：データから 1時間前後広めに取る
  let minStart = 24 * 60, maxEnd = 0;
  list.forEach(a => {
    minStart = Math.min(minStart, _hhmmToMin(a.start));
    maxEnd = Math.max(maxEnd, _hhmmToMin(a.end));
  });
  if (list.length === 0) { minStart = 6 * 60; maxEnd = 20 * 60; }
  const scaleStart = Math.max(0, Math.floor(minStart / 60) * 60);
  const scaleEnd = Math.min(24 * 60, Math.ceil(maxEnd / 60) * 60);
  const scaleSpan = scaleEnd - scaleStart;

  // ヘッダー時刻ティック（1時間ごと）
  const ticksHtml = (function() {
    let html = '';
    for (let m = scaleStart; m <= scaleEnd; m += 60) {
      const pct = ((m - scaleStart) / scaleSpan) * 100;
      const label = String(Math.floor(m / 60)).padStart(2, '0') + ':00';
      html += `<div class="gantt-tick" style="left:${pct}%"><span>${label}</span></div>`;
    }
    return html;
  })();

  const tabLabel = opts.tab === 'planning' ? '計画中' : opts.tab === 'confirmed' ? '確定済み' : opts.tab || '全タブ';

  // ドライバー行
  const rowsHtml = driverIds.map(did => {
    const d = getDriverById(did);
    const dName = d ? d.name : did;
    const aList = byDriver[did];
    // 案件ブロック
    const blocksHtml = aList.map(a => {
      const s = _hhmmToMin(a.start);
      const e = _hhmmToMin(a.end);
      const left = ((s - scaleStart) / scaleSpan) * 100;
      const width = Math.max(2, ((e - s) / scaleSpan) * 100);
      const v = getVehicleById(a.vehicleId);
      const val = validateAssignment(a);
      const k = kaizenCheckByAssignments(a.driverId, a.date, null, a.id);
      const cls = !val.ok ? 'gantt-block-bad'
                : k.level === 'violation' ? 'gantt-block-bad'
                : k.level === 'warn' ? 'gantt-block-warn'
                : 'gantt-block-ok';
      const tip = `${a.start}-${a.end} ${a.client}\n${a.from} → ${a.to}\n貨物: ${a.goods || ''}\n車両: ${v ? v.plate : ''}`;
      return `<div class="gantt-block ${cls}" style="left:${left}%;width:${width}%" title="${_pdfEsc(tip)}">
        <span class="gantt-block-label">${_pdfEsc(a.client)}</span>
        <span class="gantt-block-time">${_pdfEsc(a.start)}-${_pdfEsc(a.end)}</span>
      </div>`;
    }).join('');

    const vehSet = new Set(aList.map(a => a.vehicleId));
    const vList = [...vehSet].map(vid => {
      const v = getVehicleById(vid);
      return v ? v.plate : vid;
    }).join(', ');

    return `
      <div class="gantt-row">
        <div class="gantt-row-label">
          <div class="gantt-row-driver">${_pdfEsc(dName)}${d && d.partner ? '<span class="gantt-row-partner">傭車</span>' : ''}</div>
          <div class="gantt-row-vehicle">${_pdfEsc(vList)}</div>
        </div>
        <div class="gantt-row-track">
          ${blocksHtml}
        </div>
      </div>
    `;
  }).join('');

  const extraCss = `
    @page { size: A4 landscape; margin: 10mm; }
    .gantt {
      width: 100%; border: 1px solid #d1d5db; border-radius: 4px;
      overflow: hidden;
    }
    .gantt-header {
      display: grid; grid-template-columns: 130px 1fr;
      background: #0D4A3A; color: #fff;
      font-size: 10px; font-weight: 700;
    }
    .gantt-header-left { padding: 7px 10px; }
    .gantt-header-right {
      position: relative; height: 28px;
      border-left: 1px solid rgba(255,255,255,.3);
    }
    .gantt-tick {
      position: absolute; top: 0; bottom: 0;
      border-left: 1px dashed rgba(255,255,255,.25);
    }
    .gantt-tick span {
      position: absolute; top: 5px; left: -16px;
      font-family: 'Inter', monospace; font-size: 9px;
      width: 32px; text-align: center;
    }
    .gantt-row {
      display: grid; grid-template-columns: 130px 1fr;
      border-top: 1px solid #e5e7eb;
      min-height: 32px;
    }
    .gantt-row:nth-child(even) { background: #f9fafb; }
    .gantt-row-label {
      padding: 6px 8px; border-right: 1px solid #d1d5db;
      font-size: 10px; line-height: 1.3;
    }
    .gantt-row-driver {
      font-weight: 700; color: #1a1a1a;
      display: flex; align-items: center; gap: 4px;
    }
    .gantt-row-partner {
      display: inline-block;
      background: #fef3c7; color: #92400e;
      font-size: 8px; font-weight: 700;
      padding: 0px 4px; border-radius: 3px;
    }
    .gantt-row-vehicle {
      color: #6b7280; font-size: 9px;
      font-family: 'Inter', monospace; margin-top: 1px;
    }
    .gantt-row-track {
      position: relative; min-height: 32px;
      background-image: repeating-linear-gradient(
        to right, transparent 0,
        transparent calc((100% / ${(scaleEnd - scaleStart) / 60}) - 1px),
        #e5e7eb calc((100% / ${(scaleEnd - scaleStart) / 60}) - 1px),
        #e5e7eb calc(100% / ${(scaleEnd - scaleStart) / 60})
      );
    }
    .gantt-block {
      position: absolute; top: 4px; bottom: 4px;
      border-radius: 3px;
      padding: 2px 5px;
      overflow: hidden;
      display: flex; flex-direction: column; justify-content: center;
      font-size: 8.5px; line-height: 1.2;
      color: #fff;
      border: 1px solid rgba(0,0,0,.1);
    }
    .gantt-block-ok { background: #1A6B56; }
    .gantt-block-warn { background: #d97706; }
    .gantt-block-bad { background: #dc2626; }
    .gantt-block-label {
      font-weight: 700;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .gantt-block-time {
      font-family: 'Inter', monospace; font-size: 7.5px; opacity: .85;
      white-space: nowrap;
    }
    .gantt-legend {
      margin-top: 10px; display: flex; gap: 14px;
      font-size: 9px; color: #6b7280;
    }
    .gantt-legend-item { display: flex; align-items: center; gap: 5px; }
    .gantt-legend-color {
      width: 12px; height: 8px; border-radius: 2px;
    }
    .empty-state { text-align: center; padding: 40px; color: #9ca3af; }
  `;

  const body = `
    ${_pdfToolbarHtml()}
    <div class="pdf-header">
      <div>
        <div class="pdf-title">運行スケジュール（タイムライン）</div>
        <div class="pdf-subtitle">${_pdfFormatDate(targetDate)}　${_pdfEsc(tabLabel)}</div>
      </div>
      <div class="pdf-meta">
        出力日時：<strong>${new Date().toLocaleString('ja-JP')}</strong><br>
        ${driverIds.length}名 / ${list.length}運行
      </div>
    </div>
    ${list.length === 0 ? '<div class="empty-state">この日の運行データがありません</div>' :
    `<div class="gantt">
      <div class="gantt-header">
        <div class="gantt-header-left">ドライバー / 車両</div>
        <div class="gantt-header-right">${ticksHtml}</div>
      </div>
      ${rowsHtml}
    </div>
    <div class="gantt-legend">
      <div class="gantt-legend-item"><span class="gantt-legend-color" style="background:#1A6B56"></span>運行（正常）</div>
      <div class="gantt-legend-item"><span class="gantt-legend-color" style="background:#d97706"></span>注意（改善基準告示）</div>
      <div class="gantt-legend-item"><span class="gantt-legend-color" style="background:#dc2626"></span>違反（衝突・積載・基準違反）</div>
    </div>`}
    <div class="pdf-footer">
      <span>運行スケジュール / ${_pdfFormatDate(targetDate)} / ${_pdfEsc(tabLabel)}</span>
      <span>生成: 配車計画システム</span>
    </div>
  `;

  const w = _pdfOpenPrintWindow('運行スケジュール_' + targetDate, body, extraCss);
  return w ? 'opened' : null;
}

window.assignmentAPI.exportPDF = exportAssignmentsPDF;
window.assignmentAPI.exportPDFTimeline = exportAssignmentsPDFTimeline;

// ═══════════════════════════════════════════════════════════════
//  ステップ15：マスタ管理画面（page-masters）
//  drivers[] / vehicles[] / assignments[] の閲覧と編集UI
// ═══════════════════════════════════════════════════════════════

let _mastersTab = 'driver';

window.__switchMastersTab = function(tab) {
  _mastersTab = tab;
  ['driver', 'vehicle', 'assignment'].forEach(t => {
    const btn = document.getElementById('mtab-' + t);
    if (btn) {
      const active = t === tab;
      btn.style.borderBottomColor = active ? 'var(--sidebar-bg)' : 'transparent';
      btn.style.color = active ? 'var(--sidebar-bg)' : 'var(--text-secondary)';
      const cnt = document.getElementById('mtab-' + t + '-count');
      if (cnt) {
        cnt.style.background = active ? 'var(--sidebar-bg)' : '#e5e7eb';
        cnt.style.color = active ? '#fff' : 'var(--text-secondary)';
      }
    }
  });
  window.__renderMastersList();
};

window.renderMastersPage = function() {
  // カウント更新
  document.getElementById('mtab-driver-count').textContent = drivers.length;
  document.getElementById('mtab-vehicle-count').textContent = vehicles.length;
  document.getElementById('mtab-assignment-count').textContent = assignments.length;
  window.__renderMastersList();
};

window.__renderMastersList = function() {
  const content = document.getElementById('masters-content');
  if (!content) return;
  const search = (document.getElementById('masters-search') || {}).value || '';
  const q = search.trim().toLowerCase();
  const statsEl = document.getElementById('masters-stats');

  if (_mastersTab === 'driver') {
    const list = drivers.filter(d => {
      if (!q) return true;
      return (d.name || '').toLowerCase().includes(q) ||
             (d.id || '').toLowerCase().includes(q) ||
             (d.license || []).join(',').toLowerCase().includes(q) ||
             (d.partnerName || '').toLowerCase().includes(q);
    });
    statsEl.textContent = `${list.length} / ${drivers.length} 人`;
    content.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f9fafb;border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:10px 12px;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase">ID</th>
            <th style="text-align:left;padding:10px 12px;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase">氏名</th>
            <th style="text-align:left;padding:10px 12px;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase">免許</th>
            <th style="text-align:left;padding:10px 12px;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase">区分</th>
            <th style="text-align:left;padding:10px 12px;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase">本日の運行</th>
            <th style="text-align:right;padding:10px 12px;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase">操作</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(d => {
            const todayAssigns = assignments.filter(a => a.driverId === d.id);
            const conflicts = todayAssigns.filter(a => !validateAssignment(a).ok).length;
            return `
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 12px;font-family:'Inter',sans-serif;color:#6b7280">${d.id}</td>
              <td style="padding:10px 12px;font-weight:600">${d.name}</td>
              <td style="padding:10px 12px">${(d.license || []).map(l => `<span style="display:inline-block;background:#dbeafe;color:#1e40af;font-size:10px;padding:2px 7px;border-radius:4px;margin-right:3px">${l}</span>`).join('')}</td>
              <td style="padding:10px 12px">${d.partner ? `<span style="background:#fef3c7;color:#92400e;font-size:10px;padding:2px 7px;border-radius:4px">傭車: ${d.partnerName}</span>` : '<span style="color:#9ca3af;font-size:11px">自社</span>'}</td>
              <td style="padding:10px 12px;font-size:12px;color:#6b7280">
                ${todayAssigns.length}件
                ${conflicts > 0 ? `<span style="background:#fef2f2;color:#dc2626;font-size:10px;padding:1px 6px;border-radius:4px;font-weight:700;margin-left:6px">⚠ ${conflicts}件衝突</span>` : ''}
              </td>
              <td style="padding:10px 12px;text-align:right">
                <button onclick="window.__editMasterDriver('${d.id}')" style="background:#fff;border:1px solid #1A6B56;color:#1A6B56;padding:4px 10px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;margin-right:4px">編集</button>
                <button onclick="window.__deleteMasterDriver('${d.id}')" style="background:#fff;border:1px solid #fecaca;color:#dc2626;padding:4px 10px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer">削除</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      ${list.length === 0 ? '<div style="padding:40px;text-align:center;color:#9ca3af;font-size:12px">該当するドライバーがいません</div>' : ''}
    `;
  } else if (_mastersTab === 'vehicle') {
    const list = vehicles.filter(v => {
      if (!q) return true;
      return (v.id || '').toLowerCase().includes(q) ||
             (v.plate || '').toLowerCase().includes(q) ||
             (v.type || '').toLowerCase().includes(q);
    });
    statsEl.textContent = `${list.length} / ${vehicles.length} 台`;
    content.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f9fafb;border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:10px 12px;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase">ID</th>
            <th style="text-align:left;padding:10px 12px;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase">車両番号</th>
            <th style="text-align:left;padding:10px 12px;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase">タイプ</th>
            <th style="text-align:left;padding:10px 12px;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase">トン数</th>
            <th style="text-align:left;padding:10px 12px;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase">最大積載</th>
            <th style="text-align:left;padding:10px 12px;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase">本日の運行</th>
            <th style="text-align:right;padding:10px 12px;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase">操作</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(v => {
            const todayAssigns = assignments.filter(a => a.vehicleId === v.id);
            return `
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 12px;font-family:'Inter',sans-serif;color:#6b7280">${v.id}</td>
              <td style="padding:10px 12px;font-weight:600;font-family:'Inter',sans-serif">${v.plate}</td>
              <td style="padding:10px 12px"><span style="display:inline-block;background:#f3f4f6;color:#374151;font-size:11px;padding:2px 8px;border-radius:4px">${v.type}</span></td>
              <td style="padding:10px 12px;font-family:'Inter',sans-serif">${v.ton}t</td>
              <td style="padding:10px 12px;font-family:'Inter',sans-serif;color:#6b7280">${v.maxLoad.toLocaleString()}kg</td>
              <td style="padding:10px 12px;font-size:12px;color:#6b7280">${todayAssigns.length}件</td>
              <td style="padding:10px 12px;text-align:right">
                <button onclick="window.__editMasterVehicle('${v.id}')" style="background:#fff;border:1px solid #1A6B56;color:#1A6B56;padding:4px 10px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;margin-right:4px">編集</button>
                <button onclick="window.__deleteMasterVehicle('${v.id}')" style="background:#fff;border:1px solid #fecaca;color:#dc2626;padding:4px 10px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer">削除</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      ${list.length === 0 ? '<div style="padding:40px;text-align:center;color:#9ca3af;font-size:12px">該当する車両がありません</div>' : ''}
    `;
  } else if (_mastersTab === 'assignment') {
    const list = assignments.filter(a => {
      if (!q) return true;
      const d = getDriverById(a.driverId);
      const v = getVehicleById(a.vehicleId);
      return (a.client || '').toLowerCase().includes(q) ||
             (a.id || '').toLowerCase().includes(q) ||
             (a.driverId || '').toLowerCase().includes(q) ||
             (d ? d.name : '').toLowerCase().includes(q) ||
             (v ? v.plate : '').toLowerCase().includes(q);
    });
    statsEl.textContent = `${list.length} / ${assignments.length} 件`;
    content.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#f9fafb;border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:9px 10px;font-size:10px;color:#6b7280;font-weight:700">ID</th>
            <th style="text-align:left;padding:9px 10px;font-size:10px;color:#6b7280;font-weight:700">日付</th>
            <th style="text-align:left;padding:9px 10px;font-size:10px;color:#6b7280;font-weight:700">時間</th>
            <th style="text-align:left;padding:9px 10px;font-size:10px;color:#6b7280;font-weight:700">ドライバー</th>
            <th style="text-align:left;padding:9px 10px;font-size:10px;color:#6b7280;font-weight:700">車両</th>
            <th style="text-align:left;padding:9px 10px;font-size:10px;color:#6b7280;font-weight:700">案件</th>
            <th style="text-align:left;padding:9px 10px;font-size:10px;color:#6b7280;font-weight:700">状態</th>
          </tr>
        </thead>
        <tbody>
          ${list.slice(0, 200).map(a => {
            const d = getDriverById(a.driverId);
            const v = getVehicleById(a.vehicleId);
            const val = validateAssignment(a);
            const k = kaizenCheckByAssignments(a.driverId, a.date, null, a.id);
            return `
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:7px 10px;font-family:'Inter',sans-serif;color:#9ca3af;font-size:11px">${a.id}</td>
              <td style="padding:7px 10px;font-family:'Inter',sans-serif">${a.date}</td>
              <td style="padding:7px 10px;font-family:'Inter',sans-serif">${a.start}-${a.end}</td>
              <td style="padding:7px 10px">${d ? d.name : a.driverId}</td>
              <td style="padding:7px 10px;font-family:'Inter',sans-serif">${v ? v.plate : a.vehicleId}</td>
              <td style="padding:7px 10px;color:#374151">${a.client}</td>
              <td style="padding:7px 10px">
                ${!val.ok ? '<span style="background:#fef2f2;color:#dc2626;font-size:10px;padding:1px 5px;border-radius:3px;font-weight:700;margin-right:3px">⚠衝突</span>' : ''}
                ${k.level === 'violation' ? '<span style="background:#fef2f2;color:#991b1b;font-size:10px;padding:1px 5px;border-radius:3px;font-weight:700">🚨基準違反</span>' : ''}
                ${k.level === 'warn' ? '<span style="background:#fffbeb;color:#92400e;font-size:10px;padding:1px 5px;border-radius:3px;font-weight:700">⚠基準注意</span>' : ''}
                ${val.ok && k.level === 'ok' ? '<span style="color:#22c55e;font-size:11px">✓</span>' : ''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      ${list.length === 0 ? '<div style="padding:40px;text-align:center;color:#9ca3af;font-size:12px">該当するアサインメントがありません</div>' : ''}
      ${list.length > 200 ? `<div style="padding:12px;text-align:center;color:#9ca3af;font-size:11px;background:#f9fafb;border-top:1px solid var(--border)">最初の200件のみ表示中（全${list.length}件）</div>` : ''}
    `;
  }
};

// ───── ドライバー追加・編集モーダル ─────
window.__openMasterAddModal = function() {
  if (_mastersTab === 'driver') window.__editMasterDriver(null);
  else if (_mastersTab === 'vehicle') window.__editMasterVehicle(null);
  else if (typeof showToast === 'function') {
    showToast('アサインメントは案件編集／タイムラインから操作してください', 'info');
  }
};

window.__editMasterDriver = function(driverId) {
  const isNew = !driverId;
  const d = isNew ? { id: '', name: '', license: [], partner: false, partnerName: '' } : getDriverById(driverId);
  if (!d) return;

  const existing = document.getElementById('master-edit-backdrop');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'master-edit-backdrop';
  backdrop.className = 'vehicle-picker-backdrop';
  backdrop.onclick = function(e) { if (e.target === backdrop) backdrop.remove(); };
  backdrop.innerHTML = `
    <div class="vehicle-picker" style="width:480px" onclick="event.stopPropagation()">
      <div class="vehicle-picker-header">
        <div class="vehicle-picker-title">${isNew ? '👤 ドライバーを追加' : '✏️ ドライバーを編集'}</div>
        <button class="vehicle-picker-close" onclick="document.getElementById('master-edit-backdrop').remove()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="vehicle-picker-body">
        <label style="display:block;margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:4px">ID</div>
          <input type="text" id="me-d-id" value="${d.id}" ${isNew ? '' : 'readonly'} placeholder="D051" class="vehicle-picker-search" style="margin:0;${isNew ? '' : 'background:#f3f4f6;color:#6b7280'}">
        </label>
        <label style="display:block;margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:4px">氏名 <span style="color:#dc2626">*</span></div>
          <input type="text" id="me-d-name" value="${d.name}" placeholder="山田 太郎" class="vehicle-picker-search" style="margin:0">
        </label>
        <div style="margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:4px">免許</div>
          <label style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;font-size:12px">
            <input type="checkbox" id="me-d-lic-medium" ${d.license && d.license.includes('中型') ? 'checked' : ''}> 中型
          </label>
          <label style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;font-size:12px">
            <input type="checkbox" id="me-d-lic-large" ${d.license && d.license.includes('大型') ? 'checked' : ''}> 大型
          </label>
          <label style="display:inline-flex;align-items:center;gap:5px;font-size:12px">
            <input type="checkbox" id="me-d-lic-tow" ${d.license && d.license.includes('牽引') ? 'checked' : ''}> 牽引
          </label>
        </div>
        <div style="margin-bottom:12px">
          <label style="display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:600">
            <input type="checkbox" id="me-d-partner" ${d.partner ? 'checked' : ''} onchange="document.getElementById('me-d-partner-name-wrap').style.display=this.checked?'block':'none'"> 協力会社（傭車）ドライバー
          </label>
          <div id="me-d-partner-name-wrap" style="display:${d.partner ? 'block' : 'none'};margin-top:8px">
            <input type="text" id="me-d-partner-name" value="${d.partnerName || ''}" placeholder="北関東物流㈱" class="vehicle-picker-search" style="margin:0">
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
          <button onclick="document.getElementById('master-edit-backdrop').remove()" style="background:#fff;border:1px solid var(--border);padding:8px 16px;border-radius:6px;font-size:13px;cursor:pointer">キャンセル</button>
          <button onclick="window.__saveMasterDriver(${isNew ? 'null' : "'" + driverId + "'"})" style="background:#1A6B56;color:#fff;border:none;padding:8px 18px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer">${isNew ? '追加' : '保存'}</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
};

window.__saveMasterDriver = function(driverId) {
  const isNew = !driverId;
  const id = document.getElementById('me-d-id').value.trim();
  const name = document.getElementById('me-d-name').value.trim();
  if (!name) {
    if (typeof showToast === 'function') showToast('氏名は必須です', 'error');
    return;
  }
  if (isNew && !id) {
    if (typeof showToast === 'function') showToast('IDは必須です', 'error');
    return;
  }
  if (isNew && getDriverById(id)) {
    if (typeof showToast === 'function') showToast('そのIDは既に存在します', 'error');
    return;
  }
  const license = [];
  if (document.getElementById('me-d-lic-medium').checked) license.push('中型');
  if (document.getElementById('me-d-lic-large').checked) license.push('大型');
  if (document.getElementById('me-d-lic-tow').checked) license.push('牽引');
  const partner = document.getElementById('me-d-partner').checked;
  const partnerName = partner ? document.getElementById('me-d-partner-name').value.trim() : '';

  if (isNew) {
    const newD = { id, name, license, partner };
    if (partner) newD.partnerName = partnerName;
    drivers.push(newD);
    _driverById[id] = newD;
  } else {
    const d = getDriverById(driverId);
    d.name = name;
    d.license = license;
    d.partner = partner;
    if (partner) d.partnerName = partnerName;
    else delete d.partnerName;
  }
  document.getElementById('master-edit-backdrop').remove();
  if (typeof showToast === 'function') showToast(isNew ? `ドライバー「${name}」を追加しました` : `「${name}」を更新しました`, 'success');
  window.renderMastersPage();
  // タイムラインも再描画
  if (typeof renderSchedule === 'function') {
    const dispatchActive = document.getElementById('page-dispatch');
    if (dispatchActive && dispatchActive.classList.contains('active')) renderSchedule();
  }
};

window.__deleteMasterDriver = function(driverId) {
  const d = getDriverById(driverId);
  if (!d) return;
  const todayAssigns = assignments.filter(a => a.driverId === driverId);
  if (todayAssigns.length > 0) {
    if (!confirm(`「${d.name}」にはまだ ${todayAssigns.length}件 のアサインメントがあります。削除すると参照が外れます。本当に削除しますか？`)) return;
  } else {
    if (!confirm(`「${d.name}」を削除しますか？`)) return;
  }
  const idx = drivers.findIndex(x => x.id === driverId);
  if (idx >= 0) {
    drivers.splice(idx, 1);
    delete _driverById[driverId];
  }
  if (typeof showToast === 'function') showToast(`ドライバー「${d.name}」を削除しました`, 'success');
  window.renderMastersPage();
};

// ───── 車両追加・編集モーダル ─────
window.__editMasterVehicle = function(vehicleId) {
  const isNew = !vehicleId;
  const v = isNew ? { id: '', plate: '', type: '平ボディ', ton: 2, maxLoad: 2000 } : getVehicleById(vehicleId);
  if (!v) return;

  const existing = document.getElementById('master-edit-backdrop');
  if (existing) existing.remove();

  const TYPES = ['平ボディ', 'ウィング', '冷蔵', '冷凍', '箱'];

  const backdrop = document.createElement('div');
  backdrop.id = 'master-edit-backdrop';
  backdrop.className = 'vehicle-picker-backdrop';
  backdrop.onclick = function(e) { if (e.target === backdrop) backdrop.remove(); };
  backdrop.innerHTML = `
    <div class="vehicle-picker" style="width:480px" onclick="event.stopPropagation()">
      <div class="vehicle-picker-header">
        <div class="vehicle-picker-title">${isNew ? '🚛 車両を追加' : '✏️ 車両を編集'}</div>
        <button class="vehicle-picker-close" onclick="document.getElementById('master-edit-backdrop').remove()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="vehicle-picker-body">
        <label style="display:block;margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:4px">ID</div>
          <input type="text" id="me-v-id" value="${v.id}" ${isNew ? '' : 'readonly'} placeholder="V9999" class="vehicle-picker-search" style="margin:0;${isNew ? '' : 'background:#f3f4f6;color:#6b7280'}">
        </label>
        <label style="display:block;margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:4px">車両番号（表示名） <span style="color:#dc2626">*</span></div>
          <input type="text" id="me-v-plate" value="${v.plate}" placeholder="車両9999" class="vehicle-picker-search" style="margin:0">
        </label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <label>
            <div style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:4px">タイプ</div>
            <select id="me-v-type" class="vehicle-picker-search" style="margin:0">
              ${TYPES.map(t => `<option value="${t}" ${v.type === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </label>
          <label>
            <div style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:4px">トン数</div>
            <input type="number" id="me-v-ton" value="${v.ton}" min="1" max="50" step="0.5" class="vehicle-picker-search" style="margin:0">
          </label>
        </div>
        <div style="background:#f9fafb;padding:10px;border-radius:6px;font-size:11px;color:#6b7280;margin-bottom:12px">
          💡 最大積載量はトン数から自動計算されます（トン数 × 1000kg）
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
          <button onclick="document.getElementById('master-edit-backdrop').remove()" style="background:#fff;border:1px solid var(--border);padding:8px 16px;border-radius:6px;font-size:13px;cursor:pointer">キャンセル</button>
          <button onclick="window.__saveMasterVehicle(${isNew ? 'null' : "'" + vehicleId + "'"})" style="background:#1A6B56;color:#fff;border:none;padding:8px 18px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer">${isNew ? '追加' : '保存'}</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
};

window.__saveMasterVehicle = function(vehicleId) {
  const isNew = !vehicleId;
  const id = document.getElementById('me-v-id').value.trim();
  const plate = document.getElementById('me-v-plate').value.trim();
  const type = document.getElementById('me-v-type').value;
  const ton = parseFloat(document.getElementById('me-v-ton').value);
  if (!plate || !ton || ton <= 0) {
    if (typeof showToast === 'function') showToast('車両番号とトン数は必須です', 'error');
    return;
  }
  if (isNew && !id) {
    if (typeof showToast === 'function') showToast('IDは必須です', 'error');
    return;
  }
  if (isNew && getVehicleById(id)) {
    if (typeof showToast === 'function') showToast('そのIDは既に存在します', 'error');
    return;
  }
  if (isNew) {
    const newV = { id, plate, type, ton, maxLoad: Math.round(ton * 1000) };
    vehicles.push(newV);
    _vehicleById[id] = newV;
  } else {
    const v = getVehicleById(vehicleId);
    v.plate = plate;
    v.type = type;
    v.ton = ton;
    v.maxLoad = Math.round(ton * 1000);
  }
  document.getElementById('master-edit-backdrop').remove();
  if (typeof showToast === 'function') showToast(isNew ? `車両「${plate}」を追加しました` : `「${plate}」を更新しました`, 'success');
  window.renderMastersPage();
};

window.__deleteMasterVehicle = function(vehicleId) {
  const v = getVehicleById(vehicleId);
  if (!v) return;
  const todayAssigns = assignments.filter(a => a.vehicleId === vehicleId);
  if (todayAssigns.length > 0) {
    if (!confirm(`「${v.plate}」にはまだ ${todayAssigns.length}件 のアサインメントがあります。削除すると参照が外れます。本当に削除しますか？`)) return;
  } else {
    if (!confirm(`「${v.plate}」を削除しますか？`)) return;
  }
  const idx = vehicles.findIndex(x => x.id === vehicleId);
  if (idx >= 0) {
    vehicles.splice(idx, 1);
    delete _vehicleById[vehicleId];
  }
  if (typeof showToast === 'function') showToast(`車両「${v.plate}」を削除しました`, 'success');
  window.renderMastersPage();
};

function kaizenFmtH(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

// ═══════════════════════════════════════════════════════════════
//  配車割当ページの案件 → 個別案件処理「処理中」へ自動紐付け
//  配車割当ページでドロップしたが個別案件処理側にエントリがない案件
//  （caseListId が無い案件）を、processingCases に登録して連動させる。
//  協力会社依頼・案件詳細・編集等の機能が使えるようになる。
// ═══════════════════════════════════════════════════════════════
function linkDndCaseToProcessing(caseObj, dropInfo) {
  if (typeof processingCases === 'undefined' || !Array.isArray(processingCases)) {
    return null;
  }
  if (caseObj.caseListId) return caseObj.caseListId;

  // 既に同じ案件が processingCases に存在しないか確認（誤多重登録防止）
  // 同じ client / from / to の組み合わせが既にあれば、それを再利用
  const sameCase = processingCases.find(p =>
    p.client === caseObj.client &&
    p.from === caseObj.from &&
    p.to === caseObj.to
  );
  if (sameCase) {
    // 既存エントリにDnD案件IDが未登録なら設定
    if (!sameCase._linkedDndCaseId) {
      sameCase._linkedDndCaseId = caseObj.id;
    }
    return sameCase.id;
  }

  // 新規エントリを作成
  const goods = (caseObj.goods || '').split('/').map(s => s.trim()).filter(Boolean).join(' / ');
  const newId = 'GEN' + Date.now().toString().slice(-6) + Math.floor(Math.random()*900+100);
  const driver = dropInfo && dropInfo.driver;
  // 配車先ドライバー/車両を初期車両候補として登録（協力会社依頼モーダルが必要とする vehicles[] を埋める）
  const initialVehicles = [];
  if (driver) {
    initialVehicles.push({
      rank: 1,
      id: driver.vehicle || ('車両' + driver.id),
      driver: driver.driver || driver.name || '—',
      driverId: driver.id,
      base: driver.base || '—',
      avail: '配車割当済',
      cap: ((driver.maxLoad || 2000) / 1000).toFixed(0) + ',000kg',
      stars: 4,
      score: 80,
      law: {
        status: 'ok',
        label: '適合',
        items: [
          {ok:true, title:'日間運転時間', val:'適合'},
          {ok:true, title:'拘束時間',     val:'適合'},
          {ok:true, title:'週間上限時間', val:'適合'},
          {ok:true, title:'勤務間休息',   val:'適合'},
          {ok:true, title:'連続運転制限', val:'適合'},
          {ok:true, title:'休憩確保',     val:'適合'},
        ]
      }
    });
  }
  const newEntry = {
    id: newId,
    status: '処理中',
    priority: caseObj.urgent ? '緊急' : '通常',
    casePattern: 'スポット案件',
    client: caseObj.client,
    from: caseObj.from,
    to: caseObj.to,
    goods: goods || '—',
    deadline: caseObj.deadline || '—',
    vehicle: driver ? (driver.vehicle || '—') : '未割当',
    driver: driver ? (driver.driver || driver.name || '—') : '未割当',
    distance: '—',
    selectedVehicleIdx: 0,
    vehicleMode: 'single',
    legs: [],
    multiReasons: [],
    vehicles: initialVehicles,
    _linkedDndCaseId: caseObj.id,
    _autoLinkedFromDnd: true,
    _linkedAt: new Date().toISOString(),
    _linkedAssignment: dropInfo ? {
      driverId: dropInfo.driverId,
      start: dropInfo.start,
      end: dropInfo.end,
      dateKey: dropInfo.dateKey
    } : null
  };
  processingCases.push(newEntry);
  // 個別案件処理ページの「処理中」タブが表示されていれば再描画
  try {
    if (typeof renderProcessingList === 'function') renderProcessingList();
  } catch(e) {}
  // 案件一覧ページも更新（処理中フェーズに反映）
  try {
    if (typeof renderCaseList === 'function') renderCaseList();
  } catch(e) {}
  // バッジ更新
  try {
    if (typeof updateProcessingBadge === 'function') updateProcessingBadge();
  } catch(e) {}
  console.log('[auto-link] dnd案件を処理中へ自動連動:', newEntry.id, caseObj.client);
  return newId;
}

function dndTrackDrop(e, driverId) {
  // 確定済みタブではドロップ処理を完全に無効化
  if (typeof currentDispatchTab !== 'undefined' && currentDispatchTab === 'confirmed') {
    e.preventDefault();
    return;
  }
  e.preventDefault();
  const track = e.currentTarget;
  track.classList.remove('drop-hover', 'drop-invalid');
  hideDndGhost();
  hideAllDropTimePreviews();

  if (!dndDraggingCaseId) return;
  const caseObj = dndUnassignedCases.find(c => c.id === dndDraggingCaseId);
  if (!caseObj) return;

  if (!canDropOnDriver(driverId, e)) {
    // 詳細な理由を取り出して通知
    const ctx = evaluateDropContext(driverId, e);
    let msg = '配車できません';
    if (ctx.kaizenLevel === 'violation') {
      msg = '改善基準告示違反のため配車できません：' + (ctx.kaizenIssues[0] || '');
    } else if (ctx.reason) {
      msg = '配車できません：' + ctx.reason;
    }
    showDndToast(msg, true);
    return;
  }
  const { start, end } = getDropTime(track, e, caseObj.durationH);
  const targetKey = dndGetCurrentDateKey();

  // 新規配車（未割当→トラック）か、既存ブロックの移動かを判別
  const isNewAssignment = !dndDraggingFromDriver;

  // 【新API同期用】移動の場合は、削除前にblock情報を保存
  let _movedBlockSnapshot = null;
  if (dndDraggingFromDriver && dndDraggingBlockIdx !== null && dndDraggingFromDateKey) {
    const fromArrSnap = (dndAssignments[dndDraggingFromDriver] && dndAssignments[dndDraggingFromDriver][dndDraggingFromDateKey]) || [];
    if (fromArrSnap[dndDraggingBlockIdx]) {
      _movedBlockSnapshot = Object.assign({}, fromArrSnap[dndDraggingBlockIdx]);
    }
  }

  // 既存ブロック移動の場合：元の場所から削除（元日付・元ドライバーから）
  if (dndDraggingFromDriver && dndDraggingBlockIdx !== null && dndDraggingFromDateKey) {
    const fromArr = (dndAssignments[dndDraggingFromDriver] && dndAssignments[dndDraggingFromDriver][dndDraggingFromDateKey]) || [];
    if (fromArr[dndDraggingBlockIdx]) {
      fromArr.splice(dndDraggingBlockIdx, 1);
    }
  }

  // 追加（現在表示中の日付に対して）
  if (!dndAssignments[driverId]) dndAssignments[driverId] = {};
  if (!dndAssignments[driverId][targetKey]) dndAssignments[driverId][targetKey] = [];

  // 【新】新規ドロップ時に caseListId 未紐付けの案件を processingCases へ自動登録
  // 配車割当ページで仮確定前案件をドラッグ → 個別案件処理「処理中」へ連動
  let _autoLinkedToProcessing = false;
  if (isNewAssignment && !caseObj.caseListId
      && typeof processingCases !== 'undefined'
      && typeof linkDndCaseToProcessing === 'function') {
    try {
      const linkedId = linkDndCaseToProcessing(caseObj, { driverId, driver: dndDrivers.find(d => d.id === driverId), start, end, dateKey: targetKey });
      if (linkedId) {
        caseObj.caseListId = linkedId;
        caseObj.originalPhase = 'processing';
        _autoLinkedToProcessing = true;
      }
    } catch(linkErr) {
      console.warn('[link to processing] failed:', linkErr);
    }
  }

  // ★積荷時間：案件側から内訳を取り出し、ブロック内のセグメント境界を計算
  const _loadMin   = (caseObj.loadMin   != null) ? caseObj.loadMin   : 30;
  const _unloadMin = (caseObj.unloadMin != null) ? caseObj.unloadMin : 30;
  const _totalBlockMin = timeToMin(end) - timeToMin(start);
  // 念のためdriveMinはブロック全体から逆算（durationH の丸めズレを吸収）
  let _driveMin = _totalBlockMin - _loadMin - _unloadMin;
  if (_driveMin < 15) _driveMin = 15;

  const _addMin = (hhmm, m) => {
    const [hh, mm] = hhmm.split(':').map(Number);
    const total = hh * 60 + mm + m;
    return String(Math.floor(total / 60)).padStart(2,'0') + ':' + String(total % 60).padStart(2,'0');
  };
  const _loadStart = start;
  const _loadEnd   = _addMin(_loadStart, _loadMin);
  const _driveEnd  = _addMin(_loadEnd, _driveMin);
  const _unloadEnd = _addMin(_driveEnd, _unloadMin);

  const _newBlock = {
    caseId: caseObj.id,
    caseListId: caseObj.caseListId || null,
    client: caseObj.client,
    from: caseObj.from,
    to: caseObj.to,
    goods: caseObj.goods,
    deadline: caseObj.deadline,
    urgent: caseObj.urgent,
    label: caseObj.client.length > 8 ? caseObj.client.substring(0,7)+'…' : caseObj.client,
    sub: caseObj.from.replace(/.*?[都道府県]/,'').substring(0,3) + '→' + caseObj.to.replace(/.*?[都道府県]/,'').substring(0,3),
    start, end,
    // ★積荷時間セグメント（S3でUI化、S4で個別案件処理ページから参照）
    loadStart: _loadStart,
    loadEnd:   _loadEnd,
    driveEnd:  _driveEnd,
    unloadEnd: _unloadEnd,
    loadMin:   _loadMin,
    driveMin:  _driveMin,
    unloadMin: _unloadMin,
    color: caseObj.color,
    isPreset: false,
    confirmed: false,
    _isNew: true,
  };
  dndAssignments[driverId][targetKey].push(_newBlock);
  // 開始時刻順にソート
  dndAssignments[driverId][targetKey].sort((a,b) => timeToMin(a.start) - timeToMin(b.start));

  // ★M3: 新スキーマ jobs[]/steps[] にも同じ内容を追加
  // 既存のブロック .push() を維持しつつ、jobs/steps を整合させる
  try {
    if (typeof addJobFromBlock === 'function') {
      addJobFromBlock(_newBlock, driverId, targetKey);
    }
  } catch (m3err) {
    console.warn('[M3 sync addJob] failed:', m3err);
  }

  // 【新API同期】旧構造の変更を新assignments[]に伝搬
  try {
    if (isNewAssignment) {
      window.__notifyDndChange({
        type: 'add',
        driverId,
        dateKey: targetKey,
        block: _newBlock
      });
    } else {
      window.__notifyDndChange({
        type: 'move',
        fromDriverId: dndDraggingFromDriver,
        toDriverId: driverId,
        dateKey: targetKey,
        block: _newBlock,
        fromBlockBefore: _movedBlockSnapshot
      });
    }
  } catch(syncErr) {
    console.warn('[assignment sync] failed:', syncErr);
  }

  const driver = dndDrivers.find(d => d.id === driverId);
  const dateD = new Date(targetKey + 'T00:00:00');
  const dateStr = dateD.toLocaleDateString('ja-JP',{month:'numeric',day:'numeric',weekday:'short'});

  // D&D割当時は個別案件処理側のフェーズを移動しない
  // （確定操作で初めて processed に移動する仕様に変更）
  // ただし、自動連動で processingCases に新規登録された場合は明示的に通知
  const wasAutoLinked = isNewAssignment && _autoLinkedToProcessing;
  if (wasAutoLinked) {
    showDndToast(`✓ ${caseObj.client} を ${dateStr} ${driver.driver}（${driver.vehicle}）に配車 ${start}〜${end} ／ 個別案件処理「処理中」へ自動連動しました`);
  } else if (isNewAssignment && caseObj.caseListId) {
    showDndToast(`✓ ${caseObj.client} を ${dateStr} ${driver.driver}（${driver.vehicle}）に配車 ${start}〜${end}`);
  } else {
    showDndToast(`✓ ${caseObj.client} を ${dateStr} ${driver.driver}（${driver.vehicle}）に配車 ${start}〜${end}`);
  }

  renderDnd(); // 日付ストリップのカウントも更新するため全体再描画

  // ★個別案件処理ページが開いている場合、配送スケジュールカードを再描画
  // （配車されたcaseListIdが当該パネルの案件と一致する場合のみ更新）
  try {
    if (caseObj.caseListId) {
      // 処理中パネル
      if (typeof renderProcessingDetail === 'function'
          && typeof processingCases !== 'undefined'
          && typeof selectedProcessing !== 'undefined') {
        const target = processingCases[selectedProcessing];
        if (target && target.id === caseObj.caseListId) {
          renderProcessingDetail(selectedProcessing);
        }
      }
      // 未処理パネル
      if (typeof renderUnprocessedDetail === 'function'
          && typeof unprocessedCases !== 'undefined'
          && typeof selectedUnprocessedId !== 'undefined' && selectedUnprocessedId) {
        if (selectedUnprocessedId === caseObj.caseListId) {
          const idx = unprocessedCases.findIndex(c => c.id === selectedUnprocessedId);
          if (idx >= 0) renderUnprocessedDetail(idx);
        }
      }
    }
  } catch(e) {
    console.warn('[case schedule sync] failed:', e);
  }

  // ─────────────────────────────────────────────────────────────
  // Phase 1d：D&D配車時のクロス警告
  // ドライバーの所属拠点 ≠ 案件発地拠点 のときに警告ダイアログを開く
  // クロス配車の確認は新規追加(isNewAssignment)のみ。移動はスキップ。
  // ─────────────────────────────────────────────────────────────
  if (isNewAssignment && typeof window.__checkDndCrossBaseAndConfirm === 'function') {
    setTimeout(() => {
      window.__checkDndCrossBaseAndConfirm({
        driverId,
        caseObj,
        block: _newBlock,
        dateKey: targetKey
      });
    }, 50);  // renderDnd完了後にダイアログを出す
  }
}

function dndRemoveAssignment(driverId, idx) {
  // 確定済みタブでは割当解除も不可
  if (typeof currentDispatchTab !== 'undefined' && currentDispatchTab === 'confirmed') return;
  const currentKey = dndGetCurrentDateKey();
  const arr = (dndAssignments[driverId] && dndAssignments[driverId][currentKey]) || [];
  const a = arr[idx];
  if (!a || a.isPreset) return;
  const caseObj = dndUnassignedCases.find(c => c.id === a.caseId);
  const wasConfirmed = !!a.confirmed;

  // ★M7: マルチデイ案件かチェック → 全ジョブ削除 or 当該ジョブのみの選択肢
  let cascadeRemove = false;
  if (a.jobId && typeof jobs !== 'undefined') {
    const targetJob = jobs.find(j => j.jobId === a.jobId);
    if (targetJob && targetJob.caseId) {
      const siblings = jobs.filter(j => j.caseId === targetJob.caseId);
      if (siblings.length > 1) {
        // マルチデイ案件：依存ジョブの一覧を見せて確認
        const otherJobs = siblings.filter(j => j.jobId !== targetJob.jobId);
        const otherJobsDesc = otherJobs.map(j => {
          const role = ({preload:'前日積込',transport:'走行',delivery:'配達',pickup_delivery:'当日完結',relay_leg:'中継'})[j.role] || j.role;
          const dateOnly = (j.startDateTime || '').substring(5,10).replace('-','/');
          return '  • Job ' + j.sequenceNo + ' (' + role + ' ' + dateOnly + ')';
        }).join('\n');

        const choice = confirm(
          'この案件はマルチデイ構成です（合計 ' + siblings.length + ' ジョブ）。\n\n' +
          '★削除する: Job ' + targetJob.sequenceNo + '\n' +
          '残るジョブ:\n' + otherJobsDesc + '\n\n' +
          '【OK】案件全体（' + siblings.length + 'ジョブ）を一括削除\n' +
          '【キャンセル】このジョブだけ削除する/中止する'
        );
        if (choice) {
          cascadeRemove = true;
        } else {
          // 二段階目: 単独削除するか、操作自体を取りやめか
          if (!confirm(
            'Job ' + targetJob.sequenceNo + ' のみを削除します。\n' +
            '前後の連結が変わります。続行しますか？\n\n' +
            '【OK】このジョブだけ削除\n' +
            '【キャンセル】削除を取りやめ'
          )) {
            return;
          }
        }
      }
    }
  }

  // 【新API同期用】削除前のblock情報を保存
  const _removedSnap = Object.assign({}, a);

  if (cascadeRemove && _removedSnap.jobId) {
    // ★M7: 案件全体削除
    const targetJob = jobs.find(j => j.jobId === _removedSnap.jobId);
    if (targetJob && targetJob.caseId) {
      const targetCaseId = targetJob.caseId;
      // 同じ caseId のジョブIDを集める
      const cascadingJobIds = jobs.filter(j => j.caseId === targetCaseId).map(j => j.jobId);
      // jobs[] / steps[] から削除
      cascadingJobIds.forEach(jid => removeJobByBlockRef(jid));
      // dndAssignments も rebuild で同期
      if (typeof rebuildDndAssignmentsFromJobs === 'function') {
        rebuildDndAssignmentsFromJobs();
      }
      if (caseObj) showDndToast('案件 ' + (caseObj.client || targetCaseId) + ' の全 ' + cascadingJobIds.length + ' ジョブを削除しました');
      renderDnd();
      return;
    }
  }

  arr.splice(idx, 1);

  // ★M3: 新スキーマ jobs[]/steps[] からも該当ジョブを削除
  try {
    if (typeof removeJobByBlockRef === 'function' && _removedSnap.jobId) {
      removeJobByBlockRef(_removedSnap.jobId);
    }
  } catch (m3err) {
    console.warn('[M3 sync removeJob] failed:', m3err);
  }

  // 【新API同期】削除を新assignments[]に伝搬
  try {
    window.__notifyDndChange({
      type: 'remove',
      driverId,
      dateKey: currentKey,
      block: _removedSnap
    });
  } catch(syncErr) {
    console.warn('[assignment sync] remove failed:', syncErr);
  }

  // 確定済みブロックの解除：個別案件処理側を元フェーズに戻す
  // （D&D割当時にはフェーズ移動しなくなったので、確定済みの時だけ戻し処理が必要）
  if (wasConfirmed && caseObj && caseObj.caseListId) {
    const stillAssigned = isCaseAssigned(caseObj.id);
    if (!stillAssigned) {
      dndCaseFromProcessed(caseObj.caseListId);
      if (caseObj) showDndToast(`${caseObj.client} の確定済み配車を解除しました ｜ ステータス：${caseObj.originalPhase === 'unprocessed' ? '未処理' : '処理中'}に戻しました`);
    } else {
      if (caseObj) showDndToast(`${caseObj.client} の割当を解除しました`);
    }
  } else {
    if (caseObj) showDndToast(`${caseObj.client} の割当を解除しました`);
  }
  renderDnd();

  // ★割当解除時も個別案件処理ページの配送スケジュールを再描画
  try {
    const targetCaseListId = (caseObj && caseObj.caseListId) || _removedSnap.caseListId;
    if (targetCaseListId) {
      if (typeof renderProcessingDetail === 'function'
          && typeof processingCases !== 'undefined'
          && typeof selectedProcessing !== 'undefined') {
        const target = processingCases[selectedProcessing];
        if (target && target.id === targetCaseListId) {
          renderProcessingDetail(selectedProcessing);
        }
      }
      if (typeof renderUnprocessedDetail === 'function'
          && typeof unprocessedCases !== 'undefined'
          && typeof selectedUnprocessedId !== 'undefined' && selectedUnprocessedId) {
        if (selectedUnprocessedId === targetCaseListId) {
          const uIdx = unprocessedCases.findIndex(c => c.id === selectedUnprocessedId);
          if (uIdx >= 0) renderUnprocessedDetail(uIdx);
        }
      }
    }
  } catch(e) {
    console.warn('[case schedule sync on remove] failed:', e);
  }
}

// ── ゴースト ──
function showDndGhost(e, caseId, overrideLabel) {
  const c = dndUnassignedCases.find(x => x.id === caseId);
  if (!c) return;
  hideDndGhost();
  const g = document.createElement('div');
  g.className = 'dnd-ghost';
  g.innerHTML = `<div>${overrideLabel || c.client}</div>
    <div class="dnd-ghost-sub">${c.from.replace(/.*?[都道府県]/,'')} → ${c.to.replace(/.*?[都道府県]/,'')} · ${c.durationH}h</div>`;
  g.style.left = e.clientX + 'px';
  g.style.top  = e.clientY + 'px';
  document.body.appendChild(g);
  dndGhostEl = g;
}
function hideDndGhost() {
  if (dndGhostEl) {
    dndGhostEl.remove();
    dndGhostEl = null;
  }
}
// dragoverイベントはdocument全体でも拾ってゴーストを追従させる
document.addEventListener('dragover', (e) => {
  if (dndGhostEl) {
    dndGhostEl.style.left = e.clientX + 'px';
    dndGhostEl.style.top  = e.clientY + 'px';
  }
});
// ドラッグキャンセル時（ESCやドラッグ可能領域外でリリース）にプレビュー残りを掃除
document.addEventListener('dragend', () => {
  if (typeof hideAllDropTimePreviews === 'function') hideAllDropTimePreviews();
});

// ── トースト ──
let dndToastTimer = null;
function showDndToast(msg, isError) {
  const old = document.querySelector('.dnd-toast');
  if (old) old.remove();
  if (dndToastTimer) clearTimeout(dndToastTimer);
  const t = document.createElement('div');
  t.className = 'dnd-toast' + (isError ? ' error' : '');
  t.innerHTML = (isError ? '⚠️ ' : '') + msg;
  document.body.appendChild(t);
  dndToastTimer = setTimeout(() => { t.remove(); }, 3000);
}



// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AI抽出結果 編集
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function toggleAiEdit(i) {
  const view = document.getElementById('ai-view-' + i);
  const edit = document.getElementById('ai-edit-' + i);
  if (!view || !edit) return;
  const isEditing = edit.style.display !== 'none';
  view.style.display = isEditing ? '' : 'none';
  edit.style.display = isEditing ? 'none' : '';
  // ボタンラベル切替
  const btn = document.querySelector('#ai-result-card-' + i + ' .btn-secondary');
  if (btn) btn.innerHTML = isEditing
    ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> 編集'
    : '✕ 閉じる';
}

function saveAiEdit(i) {
  const c = unprocessedCases[i];
  const orig = { ...c.aiResult }; // 元データを保持
  c.aiResult._orig = c.aiResult._orig || orig;

  c.aiResult.client     = document.getElementById('ae-client-' + i)?.value     || c.aiResult.client;
  c.aiResult.from       = document.getElementById('ae-from-' + i)?.value       || c.aiResult.from;
  c.aiResult.to         = document.getElementById('ae-to-' + i)?.value         || c.aiResult.to;
  c.aiResult.goods      = document.getElementById('ae-goods-' + i)?.value      || c.aiResult.goods;
  c.aiResult.deadline   = document.getElementById('ae-deadline-' + i)?.value   || c.aiResult.deadline;
  c.aiResult.conditions = document.getElementById('ae-conditions-' + i)?.value || c.aiResult.conditions;
  c.aiResult.vehicle    = document.getElementById('ae-vehicle-' + i)?.value    || c.aiResult.vehicle;
  c.aiResult.count      = Number(document.getElementById('ae-count-' + i)?.value) || c.aiResult.count;
  c.aiResult.edited     = true;

  // 案件本体にも反映
  c.client   = c.aiResult.client;
  c.from     = c.aiResult.from;
  c.to       = c.aiResult.to;
  c.goods    = c.aiResult.goods;
  c.deadline = c.aiResult.deadline;

  renderUnprocessedList();
  renderUnprocessedDetail(i);
  showToast('案件情報を保存しました', 'success');
}

function cancelAiEdit(i) {
  const view = document.getElementById('ai-view-' + i);
  const edit = document.getElementById('ai-edit-' + i);
  if (view) view.style.display = '';
  if (edit) edit.style.display = 'none';
  const btn = document.querySelector('#ai-result-card-' + i + ' .btn-secondary');
  if (btn) btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> 編集';
}

function resetAiEdit(i) {
  const c = unprocessedCases[i];
  if (!c.aiResult._orig) { showToast('元のAI解析値がありません', 'success'); return; }
  const orig = c.aiResult._orig;
  ['client','from','to','goods','deadline','conditions','vehicle','count'].forEach(k => {
    const el = document.getElementById('ae-' + k + '-' + i);
    if (el) el.value = orig[k] ?? '';
  });
  showToast('AI解析値に戻しました', 'success');
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  協力会社依頼モーダル
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 協力会社マスタデータ
const partnerCompanies = [
  { id:'p01', name:'東日本輸送株式会社', initial:'東', tel:'03-1234-5678', contact:'佐々木 部長',
    area:['関東','東北'], vehicleTypes:['4tウィング','10tトラック','2tトラック'],
    rating:4.8, deals:142, price:'¥42,000〜', tags:['関東得意','冷蔵対応','緊急対応可'],
    fleet:{ total:18, byType:{'4tウィング':8,'10tトラック':6,'2tトラック':4} },
    avgResponseMin:12, responseRate:0.92 },
  { id:'p02', name:'中部ロジスティクス', initial:'中', tel:'052-234-5678', contact:'田村 課長',
    area:['中部','関西','関東'], vehicleTypes:['10tトラック','トレーラー','4tウィング'],
    rating:4.5, deals:87, price:'¥38,000〜', tags:['長距離得意','大型対応','土日可'],
    fleet:{ total:24, byType:{'10tトラック':12,'トレーラー':6,'4tウィング':6} },
    avgResponseMin:25, responseRate:0.85 },
  { id:'p03', name:'西日本フレート株式会社', initial:'西', tel:'06-3456-7890', contact:'中西 部長',
    area:['関西','中国','四国','九州'], vehicleTypes:['4tウィング','2tトラック','軽バン'],
    rating:4.6, deals:203, price:'¥35,000〜', tags:['関西・九州得意','食品輸送','当日対応'],
    fleet:{ total:32, byType:{'4tウィング':14,'2tトラック':12,'軽バン':6} },
    avgResponseMin:8, responseRate:0.94 },
  { id:'p04', name:'北日本物流サービス', initial:'北', tel:'011-456-7890', contact:'高橋 マネージャー',
    area:['北海道','東北','関東'], vehicleTypes:['10tトラック','4tウィング','冷蔵車'],
    rating:4.3, deals:56, price:'¥45,000〜', tags:['北海道得意','冷蔵・冷凍','生鮮対応'],
    fleet:{ total:14, byType:{'10tトラック':5,'4tウィング':5,'冷蔵車':4} },
    avgResponseMin:35, responseRate:0.78 },
  { id:'p05', name:'山陽急送株式会社', initial:'山', tel:'082-567-8901', contact:'松田 主任',
    area:['中国','四国','関西'], vehicleTypes:['2tトラック','軽バン','4tウィング'],
    rating:4.4, deals:98, price:'¥30,000〜', tags:['小口対応','精密機器','短納期対応'],
    fleet:{ total:20, byType:{'2tトラック':10,'軽バン':6,'4tウィング':4} },
    avgResponseMin:15, responseRate:0.89 },
];

let partnerModalPhase = 'unprocessed'; // 'unprocessed' | 'processing'
let partnerModalCaseIdx = -1;
let partnerCurrentStep = 1;
let partnerSelectedId = null;
let partnerSplitPct = 60; // 自社担当%（処理中のみ）
let currentContactTab = 'phone';

function openPartnerModal(i, phase) {
  partnerModalPhase = phase;
  partnerModalCaseIdx = i;
  partnerCurrentStep = 1;
  partnerSelectedId = null;
  partnerSplitPct = 60;
  poSentLog = [];
  const sendPanel = document.getElementById('po-send-panel');
  if (sendPanel) sendPanel.style.display = 'none';

  // ヘッダータイトル
  const caseData = phase === 'unprocessed' ? unprocessedCases[i] : processingCases[i];
  const isMulti = phase === 'processing' && caseData.vehicleMode === 'multi' && caseData.legs && caseData.legs.length > 0;

  document.getElementById('partner-modal-title').textContent =
    isMulti
      ? `協力会社へ依頼（自社${caseData.legs.length}台確定後の残量）`
      : phase === 'unprocessed' ? '協力会社へ依頼（未処理案件）' : '協力会社へ依頼（処理中・傭車）';

  // 処理中：区間設定表示
  document.getElementById('route-split-section').style.display = phase === 'processing' ? 'block' : 'none';
  if (phase === 'processing') {
    document.getElementById('split-from-label').textContent = caseData.from;
    document.getElementById('split-to-label').textContent = caseData.to;
    updateSplitBar(isMulti ? 80 : 60, caseData); // 複数台自社分は多め
    initSplitDrag(caseData);
  }

  // 複数台文脈バナー
  const multiNote = document.getElementById('partner-multi-context-note');
  if (multiNote) {
    if (isMulti) {
      multiNote.style.display = 'block';
      multiNote.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:8px">
          <span style="font-size:16px;flex-shrink:0">🚛</span>
          <div>
            <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:3px">自社${caseData.legs.length}台の配車を確定済みです</div>
            <div style="font-size:11px;color:#78350f;line-height:1.5">
              ${caseData.legs.map((l,li)=>`第${li+1}便：${l.driverName}（${l.vehicleName}）`).join(' ／ ')}<br>
              不足分の輸送量について協力会社への依頼を行います。
            </div>
          </div>
        </div>`;
    } else {
      multiNote.style.display = 'none';
    }
  }

  // 協力会社リスト生成
  renderPartnerList(caseData);
  goToPartnerStep(1);
  document.getElementById('partner-modal').classList.add('open');
}

function renderPartnerList(caseData) {
  const list = document.getElementById('partner-list');
  // 案件の希望日時を抽出（ホバー時の判定で再利用）
  const caseSchedule = _extractCaseSchedule(caseData);

  list.innerHTML = partnerCompanies.map(p => {
    // マッチ度判定（エリア・車格）
    const areaMatch = p.area.some(a =>
      (caseData.from||'').includes(a.slice(0,2)) || (caseData.to||'').includes(a.slice(0,2))
    );
    const vehicleMatch = p.vehicleTypes.some(v =>
      (caseData.aiResult?.vehicle||caseData.goods||'').includes(v.slice(0,2))
    );
    const isMatch = areaMatch || vehicleMatch;

    // 空き状況を事前計算してdata属性に格納
    const avail = _computePartnerAvailability(p, caseData, caseSchedule);

    const stars = '★'.repeat(Math.floor(p.rating)) + (p.rating%1>=0.5?'☆':'');
    const tagsHtml = p.tags.map(t => `<span class="partner-tag ${isMatch?'match':''}">${t}</span>`).join('');

    // 空き状況ミニインジケータ（カード右上）
    const availDotClass = avail.level === 'good' ? 'good' : avail.level === 'tight' ? 'tight' : 'busy';
    const availMiniText = `空 ${avail.available}/${p.fleet.total}`;

    return `<div class="partner-card" id="pcard-${p.id}"
      data-partner-id="${p.id}"
      onclick="selectPartner('${p.id}')"
      onmouseenter="_showPartnerAvailabilityTip(this)"
      onmouseleave="_hidePartnerAvailabilityTip()">
      <div class="partner-card-check">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="partner-avatar">${p.initial}</div>
      <div style="flex:1;min-width:0">
        <div class="partner-name">${p.name} ${isMatch?'<span style="font-size:10px;background:#d1fae5;color:#065f46;padding:1px 6px;border-radius:10px;font-weight:600">マッチ</span>':''}</div>
        <div class="partner-tags">${tagsHtml}</div>
        <div class="partner-meta">
          <span>${stars} ${p.rating}</span>
          <span>取引実績 ${p.deals}件</span>
          <span class="partner-meta-avail ${availDotClass}">
            <span class="partner-avail-dot"></span>${availMiniText}
          </span>
        </div>
      </div>
      <div class="partner-rate">${p.price}</div>
    </div>`;
  }).join('');

  // 案件スケジュール情報をリストに保持（ツールチップ参照用）
  list.dataset.caseSchedule = JSON.stringify(caseSchedule);
  list.dataset.caseFrom = caseData.from || '';
  list.dataset.caseTo   = caseData.to   || '';
  list.dataset.caseGoods = caseData.goods || '';
  list.dataset.caseVehicleHint = (caseData.aiResult && caseData.aiResult.vehicle) || '';
}

// 案件から希望日付・時間帯を抽出（deadline / time / preferredStart などから推定）
function _extractCaseSchedule(caseData) {
  // 日付：deadlineの先頭から MM/DD やこれを今日の年に補完
  const today = new Date();
  let date = new Date(today);
  const dl = String(caseData.deadline || '');
  const dlMatch = dl.match(/(\d{1,2})\/(\d{1,2})/);
  if (dlMatch) {
    date = new Date(today.getFullYear(), parseInt(dlMatch[1],10)-1, parseInt(dlMatch[2],10));
  }
  // 時間帯
  let timeStart = '09:00';
  let timeEnd   = '18:00';
  let timeLabel = '終日';
  if (/AM/i.test(dl)) { timeStart = '08:00'; timeEnd = '12:00'; timeLabel = 'AM指定'; }
  else if (/PM/i.test(dl)) { timeStart = '13:00'; timeEnd = '17:00'; timeLabel = 'PM指定'; }
  else if (/夕方/.test(dl)) { timeStart = '15:00'; timeEnd = '18:00'; timeLabel = '夕方'; }
  else if (/夜/.test(dl)) { timeStart = '18:00'; timeEnd = '22:00'; timeLabel = '夜間'; }
  else if (/(\d{1,2}):(\d{2})/.test(dl)) {
    const m = dl.match(/(\d{1,2}):(\d{2})/);
    timeEnd = String(m[1]).padStart(2,'0') + ':' + m[2];
    timeLabel = timeEnd + ' 必着';
  }
  // 案件のtime（受付時刻）も参照
  if (caseData.time && /\d{2}:\d{2}/.test(caseData.time)) {
    // preferredStart的に使う
    timeStart = caseData.time;
  }
  if (caseData.preferredStart) timeStart = caseData.preferredStart;
  const dateStr = date.toLocaleDateString('ja-JP', { month:'numeric', day:'numeric', weekday:'short' });
  return { dateStr, timeStart, timeEnd, timeLabel, dateIso: date.toISOString().slice(0,10) };
}

// 協力会社の空き状況を擬似計算
// pid と 日付・時間帯からハッシュベースで決定的に空き台数を決める（同じ条件なら同じ結果）
function _computePartnerAvailability(p, caseData, sched) {
  const total = (p.fleet && p.fleet.total) || 0;
  if (total === 0) return { level:'busy', available:0, busy:0, byType:{}, percent:0 };

  // 決定的ハッシュ
  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  const seed = hash(p.id + '|' + sched.dateIso + '|' + sched.timeStart);
  // 稼働率 50〜90% の範囲
  const utilization = 0.50 + (seed % 41) / 100;  // 0.50〜0.90
  const busy = Math.round(total * utilization);
  const available = Math.max(0, total - busy);

  // 車格別の空き
  const byType = {};
  Object.keys(p.fleet.byType || {}).forEach((vt, i) => {
    const totalVt = p.fleet.byType[vt];
    const seedVt = hash(p.id + vt + sched.dateIso);
    const busyVt = Math.min(totalVt, Math.round(totalVt * (0.5 + (seedVt % 41)/100)));
    byType[vt] = { total: totalVt, available: totalVt - busyVt };
  });

  let level = 'good';
  const percent = available / total;
  if (percent >= 0.3) level = 'good';
  else if (percent >= 0.12) level = 'tight';
  else level = 'busy';

  return { level, available, busy, byType, percent: Math.round(percent*100) };
}

// ホバー時に空き状況ツールチップを表示
function _ensurePartnerTipEl() {
  let el = document.getElementById('partner-availability-tip');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'partner-availability-tip';
  document.body.appendChild(el);
  return el;
}

function _showPartnerAvailabilityTip(cardEl) {
  if (!cardEl) return;
  const pid = cardEl.dataset.partnerId;
  if (!pid) return;
  const p = partnerCompanies.find(x => x.id === pid);
  if (!p) return;

  const list = document.getElementById('partner-list');
  let sched = { dateStr: '—', timeStart: '—', timeEnd: '—', timeLabel: '—', dateIso: '' };
  let caseInfo = { from:'—', to:'—', goods:'—', vehicleHint:'' };
  try {
    if (list && list.dataset.caseSchedule) sched = JSON.parse(list.dataset.caseSchedule);
    caseInfo = {
      from: list.dataset.caseFrom || '—',
      to:   list.dataset.caseTo   || '—',
      goods:list.dataset.caseGoods|| '—',
      vehicleHint: list.dataset.caseVehicleHint || ''
    };
  } catch(e) {}

  // 該当案件のcaseData（モーダル表示中の案件）を取得して空き計算
  let caseData = null;
  if (typeof partnerModalCaseIdx !== 'undefined' && partnerModalCaseIdx >= 0) {
    if (partnerModalPhase === 'unprocessed' && typeof unprocessedCases !== 'undefined') {
      caseData = unprocessedCases[partnerModalCaseIdx];
    } else if (partnerModalPhase === 'processing' && typeof processingCases !== 'undefined') {
      caseData = processingCases[partnerModalCaseIdx];
    }
  }
  const avail = _computePartnerAvailability(p, caseData || {}, sched);

  // エリアマッチ・車格マッチの判定
  const areaMatch = p.area.some(a =>
    (caseInfo.from||'').includes(a.slice(0,2)) || (caseInfo.to||'').includes(a.slice(0,2))
  );
  const vehicleMatch = p.vehicleTypes.some(v =>
    (caseInfo.vehicleHint||caseInfo.goods||'').includes(v.slice(0,2))
  );

  // 応答性
  const respMin = p.avgResponseMin || 20;
  const respColor = respMin <= 15 ? '#22c55e' : respMin <= 30 ? '#eab308' : '#ef4444';
  const respLabel = respMin <= 15 ? '速い' : respMin <= 30 ? '普通' : '遅め';

  // レベル別カラー
  const levelColor = avail.level === 'good' ? '#22c55e' : avail.level === 'tight' ? '#eab308' : '#ef4444';
  const levelLabel = avail.level === 'good' ? '余裕あり' : avail.level === 'tight' ? '逼迫気味' : '満車近い';

  // 車格別空き表示
  const byTypeRows = Object.keys(avail.byType).map(vt => {
    const info = avail.byType[vt];
    const isHit = caseInfo.vehicleHint && vt.includes(caseInfo.vehicleHint.slice(0,2));
    return `<div class="patip-vt-row ${isHit?'hit':''} ${info.available === 0 ? 'empty':''}">
      <span class="patip-vt-name">${isHit?'⭐ ':''}${vt}</span>
      <span class="patip-vt-bar">
        <span class="patip-vt-bar-fill" style="width:${info.total>0?(info.available/info.total)*100:0}%;background:${info.available>0?'#22c55e':'#94a3b8'}"></span>
      </span>
      <span class="patip-vt-count">${info.available}/${info.total}</span>
    </div>`;
  }).join('');

  const tipEl = _ensurePartnerTipEl();
  tipEl.innerHTML = `
    <div class="patip-header">
      <div class="patip-title">${p.name}</div>
      <div class="patip-subtitle">空き状況シミュレーション（参考値）</div>
    </div>

    <div class="patip-schedule">
      <div class="patip-row">
        <span class="patip-icon">📅</span>
        <span class="patip-row-label">対象日時</span>
        <span class="patip-row-val">${sched.dateStr}　${sched.timeStart}〜${sched.timeEnd}<span class="patip-tag">${sched.timeLabel}</span></span>
      </div>
    </div>

    <div class="patip-section">
      <div class="patip-section-head">
        <span class="patip-section-title">🚛 車両稼働状況</span>
        <span class="patip-level" style="background:${levelColor}1a;color:${levelColor};border:1px solid ${levelColor}44">●  ${levelLabel}</span>
      </div>
      <div class="patip-main-stats">
        <div class="patip-stat">
          <div class="patip-stat-num" style="color:${levelColor}">${avail.available}</div>
          <div class="patip-stat-lbl">空き</div>
        </div>
        <div class="patip-stat-divider">/</div>
        <div class="patip-stat">
          <div class="patip-stat-num">${p.fleet.total}</div>
          <div class="patip-stat-lbl">保有</div>
        </div>
        <div class="patip-stat patip-stat-busy">
          <div class="patip-stat-num" style="color:#94a3b8">${avail.busy}</div>
          <div class="patip-stat-lbl">稼働中</div>
        </div>
      </div>
      <div class="patip-vt-list">
        ${byTypeRows}
      </div>
    </div>

    <div class="patip-section">
      <div class="patip-section-title">📞 過去の応答実績</div>
      <div class="patip-resp">
        <div class="patip-resp-item">
          <span class="patip-resp-icon" style="color:${respColor}">⏱</span>
          <span>平均応答 <strong>${respMin}分</strong></span>
          <span class="patip-tag" style="background:${respColor}1a;color:${respColor}">${respLabel}</span>
        </div>
        <div class="patip-resp-item">
          <span class="patip-resp-icon">✓</span>
          <span>応答率 <strong>${Math.round(p.responseRate*100)}%</strong></span>
        </div>
      </div>
    </div>

    <div class="patip-match">
      <div class="patip-match-item ${areaMatch?'ok':'ng'}">
        <span>${areaMatch?'✓':'✕'}</span> エリア${areaMatch?'対応':'外'}
      </div>
      <div class="patip-match-item ${vehicleMatch?'ok':'ng'}">
        <span>${vehicleMatch?'✓':'✕'}</span> 車格${vehicleMatch?'対応':'外'}
      </div>
    </div>

    <div class="patip-hint">${avail.level === 'busy' ? '⚠ 別の協力会社も検討しましょう' : '電話で確認すると確実です'}</div>
  `;

  // 位置：カードの右側に表示。画面右端で見切れたら左側に
  const rect = cardEl.getBoundingClientRect();
  const tipW = 300;
  tipEl.classList.add('show');
  tipEl.style.left = '0px';
  tipEl.style.top  = '0px';
  const tipH = tipEl.offsetHeight;

  let x = rect.right + 10;
  if (x + tipW > window.innerWidth - 8) {
    x = rect.left - tipW - 10;
    tipEl.classList.add('arrow-right'); // 矢印を右側に
    tipEl.classList.remove('arrow-left');
  } else {
    tipEl.classList.add('arrow-left');
    tipEl.classList.remove('arrow-right');
  }
  if (x < 8) x = 8;

  // y座標：カードの上端に合わせ、画面下端で見切れたら上に補正
  let y = rect.top;
  if (y + tipH > window.innerHeight - 8) {
    y = Math.max(8, window.innerHeight - tipH - 8);
  }

  tipEl.style.left = x + 'px';
  tipEl.style.top  = y + 'px';

  requestAnimationFrame(() => tipEl.classList.add('visible'));
}

function _hidePartnerAvailabilityTip() {
  const tipEl = document.getElementById('partner-availability-tip');
  if (!tipEl) return;
  tipEl.classList.remove('visible');
  setTimeout(() => {
    if (!tipEl.classList.contains('visible')) {
      tipEl.classList.remove('show', 'arrow-left', 'arrow-right');
    }
  }, 130);
}

function selectPartner(id) {
  partnerSelectedId = id;
  document.querySelectorAll('.partner-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById('pcard-' + id);
  if (card) card.classList.add('selected');
}

// 区間ドラッグ
function updateSplitBar(pct, caseData) {
  partnerSplitPct = Math.max(10, Math.min(90, pct));
  const own = document.getElementById('split-own');
  const part = document.getElementById('split-partner');
  const handle = document.getElementById('split-handle');
  if (own) own.style.width = partnerSplitPct + '%';
  if (part) { part.style.left = partnerSplitPct + '%'; part.style.width = (100-partnerSplitPct) + '%'; }
  if (handle) handle.style.left = partnerSplitPct + '%';
  document.getElementById('split-own-pct').textContent = partnerSplitPct + '%';
  document.getElementById('split-partner-pct').textContent = (100-partnerSplitPct) + '%';
  const dist = parseInt((caseData?.distance||'100km').replace(/[^0-9]/g,'')) || 100;
  document.getElementById('split-own-km').textContent = '(' + Math.round(dist*partnerSplitPct/100) + 'km)';
  document.getElementById('split-partner-km').textContent = '(' + Math.round(dist*(100-partnerSplitPct)/100) + 'km)';
}

function initSplitDrag(caseData) {
  const bar = document.getElementById('split-bar');
  const handle = document.getElementById('split-handle');
  if (!bar || !handle) return;
  let dragging = false;
  handle.onmousedown = e => { dragging = true; e.preventDefault(); };
  document.onmousemove = e => {
    if (!dragging) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    updateSplitBar(pct, caseData);
  };
  document.onmouseup = () => { dragging = false; };
}

// ── 発注書ステップ状態 ──
let poConfirmed = false; // 発注書確定済みフラグ

// STEP管理（4ステップ対応）
function goToPartnerStep(step) {
  partnerCurrentStep = step;
  [1,2,3,4].forEach(s => {
    const panel = document.getElementById('partner-step' + s);
    if (!panel) return;
    if (s === step) {
      panel.style.display = 'flex';
      panel.style.flexDirection = 'column';
      panel.style.flex = '1';
      panel.style.minHeight = '0';
      panel.style.overflowY = 'auto';
      panel.scrollTop = 0;
    } else {
      panel.style.display = 'none';
    }
  });

  // ステップインジケーター更新（4ステップ）
  [1,2,3,4].forEach(s => {
    const el = document.getElementById('pstep-' + s);
    if (!el) return;
    const dot = el.querySelector('div');
    if (s < step) {
      // 完了済み：チェックマーク
      el.style.color = 'var(--sidebar-bg)';
      dot.style.background = 'var(--sidebar-bg)'; dot.style.color = '#fff';
      dot.textContent = '✓';
    } else if (s === step) {
      // 現在：緑強調
      el.style.color = 'var(--sidebar-bg)';
      dot.style.background = 'var(--sidebar-bg)'; dot.style.color = '#fff';
      dot.textContent = String(s);
    } else {
      // 未来：グレー
      el.style.color = 'var(--text-muted)';
      dot.style.background = 'var(--border)'; dot.style.color = 'var(--text-muted)';
      dot.textContent = String(s);
    }
  });

  // ボタン制御
  document.getElementById('partner-back-btn').style.display = step > 1 ? '' : 'none';
  const nextBtn = document.getElementById('partner-next-btn');
  nextBtn.disabled = false;
  nextBtn.style.opacity = '1';

  if (step === 1) {
    nextBtn.innerHTML = '次へ：連絡方法を選ぶ →';
  } else if (step === 2) {
    nextBtn.innerHTML = '次へ：発注書を作成する →';
  } else if (step === 3) {
    // 発注書ステップ：確定済みか否かでボタン変化
    _updatePoNextBtn();
  } else {
    // STEP4
    nextBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> 確定（協力会社へ依頼）';
  }

  if (step === 2) buildContactStep();
  if (step === 3) buildPurchaseOrderStep();
  if (step === 4) buildConfirmStep();
}

function _updatePoNextBtn() {
  const nextBtn = document.getElementById('partner-next-btn');
  if (!nextBtn) return;
  if (poConfirmed) {
    nextBtn.innerHTML = '次へ：確定する →';
  } else {
    const ok = _checkPoRequired();
    nextBtn.innerHTML = ok
      ? '✅ 発注書を確定して次へ →'
      : '発注書を確定する →';
  }
  // disabled は使わない：押した時点でチェックする
  nextBtn.disabled = false;
  nextBtn.style.opacity = '1';
}

// 発注書プレビュー
function openPoPreview() {
  const overlay = document.getElementById('po-preview-overlay');
  const content = document.getElementById('po-preview-content');
  if (!overlay || !content) return;

  // フォームから現在値を収集してHTML生成
  const toVal     = document.getElementById('po-to')?.value || '';
  const fromVal   = document.getElementById('po-from-company')?.value || '東日本物流株式会社';
  const poNum     = document.getElementById('po-number')?.value || '';
  const poDate    = document.getElementById('po-date')?.value || '';
  const delivDate = document.getElementById('po-delivery-date')?.value || '';
  const svcType   = document.getElementById('po-service-type')?.value || '';
  const route     = document.getElementById('po-route')?.value || '';
  const goods     = document.getElementById('po-goods')?.value || '';
  const receipt   = document.getElementById('po-receipt')?.value || '';
  const item1name = document.getElementById('po-item1-name')?.value || '輸送費';
  const item1price= parseFloat(document.getElementById('po-item1-price')?.value||'0')||0;
  const item2name = document.getElementById('po-item2-name')?.value || '';
  const item2price= parseFloat(document.getElementById('po-item2-price')?.value||'0')||0;
  const subtotal  = item1price + item2price;
  const tax       = Math.round(subtotal * 0.1);
  const total     = subtotal + tax;
  const fmt       = n => '¥' + n.toLocaleString();
  const payMethod = document.getElementById('po-payment-method')?.value || '';
  const payDue    = document.getElementById('po-payment-due')?.value || '';
  const notes     = document.getElementById('po-notes')?.value || '';
  const now       = new Date().toLocaleString('ja-JP');

  content.innerHTML = `
    <div style="border-bottom:3px solid #0D4A3A;padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <div style="font-size:20px;font-weight:700;color:#0D4A3A;letter-spacing:0.06em">発 注 書</div>
        <div style="font-size:10px;color:#9ca3af;margin-top:3px">Purchase Order　　<span style="background:#fef3c7;color:#92400e;font-size:10px;padding:2px 8px;border-radius:4px;font-weight:600">プレビュー</span></div>
      </div>
      <div style="text-align:right;font-size:11px;color:#374151;line-height:1.8">
        <div><b>発注書番号：</b>${poNum}</div>
        <div><b>発注日：</b>${poDate}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px">
      <div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px">
        <div style="font-size:9px;color:#9ca3af;margin-bottom:3px;font-weight:600;letter-spacing:0.05em">発注先</div>
        <div style="font-size:13px;font-weight:700">${toVal||'—'}</div>
      </div>
      <div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px">
        <div style="font-size:9px;color:#9ca3af;margin-bottom:3px;font-weight:600;letter-spacing:0.05em">発注元</div>
        <div style="font-size:13px;font-weight:700">${fromVal}</div>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px">
      <tr style="background:#f8fafc"><td style="padding:6px 10px;border:1px solid #e5e7eb;font-weight:600;width:32%;color:#374151">業務種別</td><td style="padding:6px 10px;border:1px solid #e5e7eb">${svcType}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #e5e7eb;font-weight:600;background:#f8fafc;color:#374151">輸送区間</td><td style="padding:6px 10px;border:1px solid #e5e7eb">${route}</td></tr>
      <tr style="background:#f8fafc"><td style="padding:6px 10px;border:1px solid #e5e7eb;font-weight:600;color:#374151">荷物</td><td style="padding:6px 10px;border:1px solid #e5e7eb">${goods}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #e5e7eb;font-weight:600;background:#f8fafc;color:#374151">受領方法・納品場所</td><td style="padding:6px 10px;border:1px solid #e5e7eb">${receipt||'<span style="color:#dc2626">未入力</span>'}</td></tr>
      <tr style="background:#f8fafc"><td style="padding:6px 10px;border:1px solid #e5e7eb;font-weight:600;color:#374151">納品期日</td><td style="padding:6px 10px;border:1px solid #e5e7eb">${delivDate}</td></tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:6px;font-size:12px">
      <thead><tr style="background:#0D4A3A;color:#fff">
        <th style="padding:7px 10px;text-align:left;font-weight:600;width:52%">項目</th>
        <th style="padding:7px 10px;text-align:right;font-weight:600">金額（税抜）</th>
      </tr></thead>
      <tbody>
        <tr><td style="padding:6px 10px;border:1px solid #e5e7eb">${item1name}</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:right">${fmt(item1price)}</td></tr>
        ${item2name ? '<tr><td style="padding:6px 10px;border:1px solid #e5e7eb">'+item2name+'</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:right">'+fmt(item2price)+'</td></tr>' : ''}
        <tr style="background:#f8fafc"><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:right;color:#6b7280">小計</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:right">${fmt(subtotal)}</td></tr>
        <tr><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:right;color:#6b7280">消費税（10%）</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:right">${fmt(tax)}</td></tr>
        <tr style="background:#EAF5F0"><td style="padding:8px 10px;border:2px solid #0D4A3A;text-align:right;font-weight:700;color:#0D4A3A">合計（税込）</td><td style="padding:8px 10px;border:2px solid #0D4A3A;text-align:right;font-weight:700;font-size:14px;color:#0D4A3A">${fmt(total)}</td></tr>
      </tbody>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:12px">
      <tr style="background:#f8fafc"><td style="padding:6px 10px;border:1px solid #e5e7eb;font-weight:600;width:32%;color:#374151">支払方法</td><td style="padding:6px 10px;border:1px solid #e5e7eb">${payMethod}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #e5e7eb;font-weight:600;background:#f8fafc;color:#374151">支払期日</td><td style="padding:6px 10px;border:1px solid #e5e7eb">${payDue}</td></tr>
      ${notes ? '<tr style="background:#f8fafc"><td style="padding:6px 10px;border:1px solid #e5e7eb;font-weight:600;color:#374151">備考</td><td style="padding:6px 10px;border:1px solid #e5e7eb">'+notes+'</td></tr>' : ''}
    </table>

    <div style="border-top:1px solid #e5e7eb;padding-top:10px;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between">
      <span>本書は下請法第3条に基づく発注書面です。</span>
      <span>発行：${fromVal}</span>
    </div>
  `;

  overlay.style.display = 'flex';
}

function closePoPreview() {
  const overlay = document.getElementById('po-preview-overlay');
  if (overlay) overlay.style.display = 'none';
}

function _poFieldChanged() { _renderPoChecklist(); _updatePoNextBtn(); }

function _checkPoRequired() {
  const fields = ['po-receipt','po-delivery-date','po-payment-due'];
  const price = parseFloat(document.getElementById('po-item1-price')?.value||'0');
  const allFilled = fields.every(id => {
    const el = document.getElementById(id);
    return el && el.value.trim() !== '';
  });
  return allFilled && price > 0;
}

function partnerStepNext() {
  if (partnerCurrentStep === 1) {
    if (!partnerSelectedId) { showToast('協力会社を選択してください', 'success'); return; }
    poConfirmed = false;
    goToPartnerStep(2);
  } else if (partnerCurrentStep === 2) {
    goToPartnerStep(3);
  } else if (partnerCurrentStep === 3) {
    if (poConfirmed) {
      const _pd = {
        poNum: document.getElementById('po-number')?.value || '',
        total: document.getElementById('po-total')?.textContent || '',
        route: document.getElementById('po-route')?.value || '',
        p: partnerCompanies.find(x => x.id === partnerSelectedId)
      };
      goToPartnerStep(4);
      _openPoSendPanel(_pd);
    } else {
      // 発注書確定処理
      if (!_checkPoRequired()) {
        showToast('未入力の必須項目があります', 'error'); return;
      }
      _confirmPurchaseOrder();
    }
  } else {
    confirmPartnerDispatch();
  }
}
function partnerStepBack() {
  if (partnerCurrentStep === 4) { goToPartnerStep(3); return; }
  goToPartnerStep(partnerCurrentStep - 1);
}

// STEP2: 連絡
function buildContactStep() {
  const p = partnerCompanies.find(x => x.id === partnerSelectedId);
  if (!p) return;
  const caseData = partnerModalPhase === 'unprocessed' ? unprocessedCases[partnerModalCaseIdx] : processingCases[partnerModalCaseIdx];

  document.getElementById('partner-selected-info').innerHTML =
    `<b>${p.name}</b>　担当：${p.contact}　📞 ${p.tel}`;
  document.getElementById('partner-phone-number').textContent = p.tel;
  document.getElementById('partner-phone-contact').textContent = p.contact;
  document.getElementById('partner-tel-link').href = 'tel:' + p.tel.replace(/-/g,'');

  const splitNote = partnerModalPhase === 'processing'
    ? `\n※自社担当区間：${partnerSplitPct}%・協力会社担当区間：${100-partnerSplitPct}%` : '';

  // トークスクリプト
  document.getElementById('phone-script').innerHTML =
    `「${p.name}さん、お世話になっております。東日本物流の配車太郎と申します。<br>
    本日 <b>${caseData.client||caseData.client}</b> 様の案件でご相談させてください。<br>
    ${caseData.from} から ${caseData.to} までの輸送で、<b>${caseData.goods||''}</b>、<br>
    納期は <b>${caseData.deadline}</b> となっております。ご対応いただけますでしょうか？」`;

  // メールテンプレート
  const mailSubject = `【配送依頼】${caseData.client||''} 様案件 / ${caseData.from}→${caseData.to}`;
  document.getElementById('email-subject').value = mailSubject;
  document.getElementById('email-body').value =
`${p.name} 御中
${p.contact} 様

お世話になっております。東日本物流 配車太郎と申します。
以下の案件についてご対応をお願いしたくご連絡いたします。

【案件概要】
・取引先：${caseData.client||''}
・発地：${caseData.from}
・着地：${caseData.to}
・荷物：${caseData.goods||''}
・納期：${caseData.deadline}${splitNote}

ご対応可否とお見積りをご返信いただけますと幸いです。
何卒よろしくお願いいたします。

東日本物流株式会社
配車 太郎　TEL: 03-0000-0000`;

  // SMSテンプレート
  const smsText = `【東日本物流】${caseData.from}→${caseData.to} ${caseData.deadline}の案件配送依頼です。${caseData.goods||''}。対応可否ご返信ください。`;
  document.getElementById('sms-body').value = smsText;
  document.getElementById('sms-count').textContent = smsText.length + '文字';
  document.getElementById('sms-body').oninput = function() {
    document.getElementById('sms-count').textContent = this.value.length + '文字';
  };

  switchContactTab('phone');
}

function switchContactTab(tab) {
  currentContactTab = tab;
  ['phone','email','sms'].forEach(t => {
    document.getElementById('contact-' + t).style.display = t === tab ? '' : 'none';
    document.getElementById('ctab-' + t).classList.toggle('active', t === tab);
  });
}

function sendEmail() { showToast('メールを送信しました', 'success'); }
function sendSMS()   { showToast('SMSを送信しました', 'success'); }
function copyToClipboard(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard?.writeText(el.value).then(() => showToast('コピーしました', 'success'));
}

// STEP3: 発注書
function buildPurchaseOrderStep() {
  const p = partnerCompanies.find(x => x.id === partnerSelectedId);
  if (!p) return;
  const caseData = partnerModalPhase === 'unprocessed' ? unprocessedCases[partnerModalCaseIdx] : processingCases[partnerModalCaseIdx];

  // 案件から推定金額（既存データの other を流用）
  const estimatedAmt = caseData.other || 38000;
  const isRequired = estimatedAmt >= 30000;

  document.getElementById('po-skip-notice').style.display    = isRequired ? 'none' : '';
  document.getElementById('po-required-notice').style.display = isRequired ? '' : 'none';
  document.getElementById('po-amount-disp').textContent = '¥' + estimatedAmt.toLocaleString();

  // 自動プリフィル
  document.getElementById('po-to').value = p.name + '（担当：' + p.contact + '）';
  const poNum = 'PO-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random()*90000)+10000);
  document.getElementById('po-number').value = poNum;
  const today = new Date();
  document.getElementById('po-date').value = today.toISOString().slice(0,10);
  // 納品期日：案件のdeadlineから変換
  const dlRaw = caseData.deadline || '';
  const dlMatch = dlRaw.match(/(\d+)\/(\d+)/);
  if (dlMatch) {
    const m = dlMatch[1].padStart(2,'0'), d = dlMatch[2].padStart(2,'0');
    document.getElementById('po-delivery-date').value = today.getFullYear() + '-' + m + '-' + d;
  }
  // 支払期日：翌月末
  const due = new Date(today.getFullYear(), today.getMonth()+2, 0);
  document.getElementById('po-payment-due').value = due.toISOString().slice(0,10);
  document.getElementById('po-route').value = (caseData.from||'') + ' → ' + (caseData.to||'');
  document.getElementById('po-goods').value = caseData.goods || '';
  document.getElementById('po-item1-price').value = estimatedAmt;
  // 受領方法：着地から自動生成（編集可能）
  document.getElementById('po-receipt').value = (caseData.to || '') ? (caseData.to) + ' にて荷受け担当者へ手渡し' : '';
  updatePoTotal();

  // 入力変化でチェックリスト更新（addEventListener で確実に登録）
  ['po-receipt','po-delivery-date','po-payment-due','po-item1-price','po-item2-price',
   'po-payment-method','po-service-type'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.removeEventListener('input',  _poFieldChanged);
    el.removeEventListener('change', _poFieldChanged);
    el.addEventListener('input',  _poFieldChanged);
    el.addEventListener('change', _poFieldChanged);
  });

  // 自動入力済みフィールドを反映して初期状態を評価
  setTimeout(function() { _renderPoChecklist(); _updatePoNextBtn(); }, 50);
}

function updatePoTotal() {
  const p1 = parseFloat(document.getElementById('po-item1-price')?.value||'0')||0;
  const p2 = parseFloat(document.getElementById('po-item2-price')?.value||'0')||0;
  const sub = p1 + p2;
  const tax = Math.round(sub * 0.1);
  const total = sub + tax;
  const fmt = n => '¥' + n.toLocaleString();
  document.getElementById('po-subtotal').textContent = fmt(sub);
  document.getElementById('po-tax').textContent      = fmt(tax);
  document.getElementById('po-total').textContent    = fmt(total);
  _renderPoChecklist();
  _updatePoNextBtn();
}

function _renderPoChecklist() {
  const checks = [
    { label:'発注先・発注元の名称', ok: !!document.getElementById('po-to')?.value },
    { label:'発注書番号・発注日', ok: !!document.getElementById('po-number')?.value },
    { label:'給付の内容（業務種別）', ok: !!document.getElementById('po-service-type')?.value },
    { label:'給付期日（納品期日）', ok: !!document.getElementById('po-delivery-date')?.value },
    { label:'下請代金の額（1円以上）', ok: (parseFloat(document.getElementById('po-item1-price')?.value||'0')||0) > 0 },
    { label:'支払方法・支払期日', ok: !!(document.getElementById('po-payment-method')?.value && document.getElementById('po-payment-due')?.value) },
    { label:'受領方法・納品場所', ok: !!(document.getElementById('po-receipt')?.value?.trim()) },
  ];
  const cl = document.getElementById('po-checklist');
  if (!cl) return;
  cl.innerHTML = checks.map(c =>
    `<div style="display:flex;align-items:center;gap:8px;font-size:11px;padding:5px 10px;border-radius:6px;background:${c.ok?'#f0fdf4':'#fef2f2'};color:${c.ok?'#065f46':'#dc2626'}">
      <span style="font-size:13px">${c.ok?'✅':'❌'}</span>${c.label}
    </div>`
  ).join('');
}

// 送信済み記録
let poSentLog = []; // [{method, to, sentAt}]

function _confirmPurchaseOrder() {
  poConfirmed = true;
  poSentLog = []; // 送信ログリセット
  const p = partnerCompanies.find(x => x.id === partnerSelectedId);
  const poNum   = document.getElementById('po-number').value;
  const total   = document.getElementById('po-total').textContent;
  const payDue  = document.getElementById('po-payment-due').value;
  const method  = document.getElementById('po-payment-method').value;
  const now     = new Date().toLocaleString('ja-JP');

  // 確定日時を発注書番号欄の下に表示
  const notice = document.getElementById('po-required-notice');
  if (notice) {
    notice.style.background = '#f0fdf4';
    notice.style.borderColor = '#a7f3d0';
    notice.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#065f46" stroke-width="2.5" style="flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>
      <div style="font-size:11px;color:#065f46;line-height:1.6"><b>✅ 発注書を確定しました（${now}）</b><br>
      ${poNum} / ${total} / PDFをダウンロードしています...</div>`;
  }
  // 入力値をここで退避（STEP3が非表示になる前に取得）
  const _savedPoData = {
    poNum, total, route: document.getElementById('po-route')?.value || '',
    payDue, payMethod: method, p, now
  };
  _updatePoNextBtn();

  // PDF生成・ダウンロード
  _downloadPurchaseOrderPDF(poNum, now).then(() => {
    showToast('発注書 ' + poNum + ' を確定・PDFをダウンロードしました', 'success');
  }).catch(e => {
    console.error(e);
    showToast('発注書は確定しました（PDF生成エラー: ' + e.message + '）', 'success');
  });
  // STEP4へ遷移して送信パネルを表示
  goToPartnerStep(4);
  _openPoSendPanel(_savedPoData);
}

// 発注書送信パネルを開いて初期値を設定（STEP4上に常駐）
function _openPoSendPanel(saved) {
  const p = (saved && saved.p) || partnerCompanies.find(x => x.id === partnerSelectedId);
  if (!p) return;
  const caseData = partnerModalPhase === 'unprocessed' ? unprocessedCases[partnerModalCaseIdx] : processingCases[partnerModalCaseIdx];
  const poNum = (saved && saved.poNum) || document.getElementById('po-number')?.value || '';
  const total = (saved && saved.total) || document.getElementById('po-total')?.textContent || '';
  const route = (saved && saved.route) || document.getElementById('po-route')?.value || '';

  const recipientEl = document.getElementById('po-send-recipient');
  if (recipientEl) recipientEl.textContent = p.name + '（' + p.contact + '）';

  const emailSubjEl = document.getElementById('po-send-email-subject');
  if (emailSubjEl) emailSubjEl.value = `【発注書】${poNum} / ${caseData ? (caseData.client || '') : ''} 様案件`;

  const emailBodyEl = document.getElementById('po-send-email-body');
  if (emailBodyEl) emailBodyEl.value =
`${p.name} 御中
${p.contact} 様

お世話になっております。東日本物流 配車太郎です。
下記の通り発注書をお送りいたします。ご確認のほどよろしくお願いいたします。

■ 発注書番号：${poNum}
■ 輸送区間：${route}
■ 金額：${total}（税込）

発注書PDFを添付しておりますのでご確認ください。

東日本物流株式会社　配車 太郎`;

  const slackMsgEl = document.getElementById('po-send-slack-msg');
  if (slackMsgEl) slackMsgEl.value =
`:page_facing_up: *発注書送付のお知らせ*
*発注先：* ${p.name}（${p.contact}）
*発注書番号：* ${poNum}
*輸送区間：* ${route}
*金額：* ${total}
発注書PDFを添付します。`;

  const smsBodyEl = document.getElementById('po-send-sms-body');
  if (smsBodyEl) {
    const smsText = `【東日本物流】発注書(${poNum})を送付しました。${route}、${total}。ご確認ください。`;
    smsBodyEl.value = smsText;
    const countEl = document.getElementById('po-send-sms-count');
    if (countEl) countEl.textContent = smsText.length;
    smsBodyEl.oninput = function() { if (countEl) countEl.textContent = this.value.length; };
  }

  const telEl = document.getElementById('po-send-sms-tel');
  if (telEl && p.tel) telEl.value = p.tel;

  const statusEl = document.getElementById('po-send-status');
  if (statusEl) { statusEl.style.display = 'none'; statusEl.innerHTML = ''; }

  // ── ここが核心：STEP4内にあるパネルを block で表示 ──
  const panel = document.getElementById('po-send-panel');
  if (panel) panel.style.display = 'block';

  switchSendTab('email');
}

// 送信タブ切替
function switchSendTab(tab) {
  ['email','slack','sms'].forEach(t => {
    const btn = document.getElementById('sendtab-' + t);
    const content = document.getElementById('send-content-' + t);
    const isActive = t === tab;
    if (btn) {
      if (isActive) {
        btn.style.background = '#0D4A3A';
        btn.style.color = '#fff';
        btn.style.borderColor = '#0D4A3A';
      } else {
        btn.style.background = '#fff';
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderColor = 'var(--border)';
      }
    }
    if (content) content.style.display = isActive ? '' : 'none';
  });
  // Slackタブだけパープル
  if (tab === 'slack') {
    const slackBtn = document.getElementById('sendtab-slack');
    if (slackBtn) {
      slackBtn.style.background = '#4A154B';
      slackBtn.style.color = '#fff';
      slackBtn.style.borderColor = '#4A154B';
    }
  }
}

// 発注書送信実行
async function executePOSend(method) {
  const p = partnerCompanies.find(x => x.id === partnerSelectedId);
  const poNum = document.getElementById('po-number')?.value || '—';
  const statusEl = document.getElementById('po-send-status');
  const btnId = 'po-send-' + method + '-btn';
  const btn = document.getElementById(btnId);

  // バリデーション
  if (method === 'email') {
    const emailTo = document.getElementById('po-send-email-to')?.value?.trim();
    if (!emailTo) { showToast('送信先メールアドレスを入力してください', 'error'); return; }
  }
  if (method === 'sms') {
    const tel = document.getElementById('po-send-sms-tel')?.value?.trim();
    if (!tel) { showToast('送信先電話番号を入力してください', 'error'); return; }
  }

  // 送信中UI
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.textContent = '送信中...'; }

  await new Promise(r => setTimeout(r, 1200)); // 送信シミュレーション

  // 送信完了処理
  const sentAt = new Date().toLocaleString('ja-JP');
  let toLabel = '';
  if (method === 'email') toLabel = document.getElementById('po-send-email-to')?.value || '';
  else if (method === 'slack') toLabel = document.getElementById('po-send-slack-channel')?.value || '';
  else if (method === 'sms') toLabel = document.getElementById('po-send-sms-tel')?.value || '';

  poSentLog.push({ method, to: toLabel, sentAt });

  // ステータス表示
  const methodLabel = { email:'メール', slack:'Slack', sms:'SMS' }[method];
  const methodIcon  = { email:'📧', slack:'💬', sms:'📱' }[method];
  if (statusEl) {
    statusEl.style.display = '';
    statusEl.style.background = '#f0fdf4';
    statusEl.style.border = '1px solid #a7f3d0';
    statusEl.style.color = '#065f46';
    statusEl.innerHTML = poSentLog.map(log => {
      const lIcon = { email:'📧', slack:'💬', sms:'📱' }[log.method];
      const lLabel = { email:'メール', slack:'Slack', sms:'SMS' }[log.method];
      return `<div style="display:flex;align-items:center;gap:6px"><span style="font-size:14px">${lIcon}</span><b>${lLabel}</b>で送信完了（${log.sentAt}）→ ${log.to}</div>`;
    }).join('');
  }

  // ボタン復元 + 送信済みマーク
  if (btn) {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.background = '#16a34a';
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> 送信済み`;
  }

  showToast(`発注書 ${poNum} を${methodLabel}で送信しました`, 'success');

  // STEP4の送信ステータスを事前更新
  _updateStep4SentStatus();
}

// 送信ステータス表示を更新（po-send-statusに集約）
function _updateStep4SentStatus() {
  const el = document.getElementById('po-send-status');
  if (!el) return;
  if (poSentLog.length === 0) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.style.background = '#f0fdf4';
  el.style.border = '1px solid #a7f3d0';
  el.style.color = '#065f46';
  el.innerHTML = poSentLog.map(log => {
    const lIcon  = { email:'📧', slack:'💬', sms:'📱' }[log.method];
    const lLabel = { email:'メール', slack:'Slack', sms:'SMS' }[log.method];
    return `<div style="display:flex;align-items:center;gap:6px"><span>${lIcon}</span><b>${lLabel}</b>で送信完了（${log.sentAt}）→ ${log.to}</div>`;
  }).join('');
}

async function _downloadPurchaseOrderPDF(poNum, issuedAt) {
  const area = document.getElementById('po-print-area');
  if (!area) throw new Error('印刷エリアが見つかりません');

  // 発注書フォームから値を収集
  const toVal      = document.getElementById('po-to')?.value || '';
  const fromVal    = document.getElementById('po-from-company')?.value || '東日本物流株式会社';
  const poDate     = document.getElementById('po-date')?.value || '';
  const delivDate  = document.getElementById('po-delivery-date')?.value || '';
  const svcType    = document.getElementById('po-service-type')?.value || '';
  const route      = document.getElementById('po-route')?.value || '';
  const goods      = document.getElementById('po-goods')?.value || '';
  const receipt    = document.getElementById('po-receipt')?.value || '';
  const item1name  = document.getElementById('po-item1-name')?.value || '輸送費';
  const item1price = document.getElementById('po-item1-price')?.value || '0';
  const item2name  = document.getElementById('po-item2-name')?.value || '';
  const item2price = document.getElementById('po-item2-price')?.value || '0';
  const subtotal   = document.getElementById('po-subtotal')?.textContent || '';
  const tax        = document.getElementById('po-tax')?.textContent || '';
  const total      = document.getElementById('po-total')?.textContent || '';
  const payMethod  = document.getElementById('po-payment-method')?.value || '';
  const payDue     = document.getElementById('po-payment-due')?.value || '';
  const notes      = document.getElementById('po-notes')?.value || '';
  const now        = issuedAt || new Date().toLocaleString('ja-JP');

  // 印刷用HTMLを生成
  area.innerHTML = `
    <div style="border-bottom:3px solid #0D4A3A;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <div style="font-size:22px;font-weight:700;color:#0D4A3A;letter-spacing:0.05em">発 注 書</div>
        <div style="font-size:11px;color:#6b7280;margin-top:4px">Purchase Order</div>
      </div>
      <div style="text-align:right;font-size:12px;color:#374151">
        <div><b>発注書番号：</b>${poNum}</div>
        <div><b>発注日：</b>${poDate}</div>
        <div style="font-size:10px;color:#9ca3af;margin-top:2px">確定日時：${now}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
      <div style="border:1px solid #e5e7eb;border-radius:6px;padding:12px">
        <div style="font-size:10px;color:#9ca3af;margin-bottom:4px">発注先</div>
        <div style="font-size:13px;font-weight:700">${toVal}</div>
      </div>
      <div style="border:1px solid #e5e7eb;border-radius:6px;padding:12px">
        <div style="font-size:10px;color:#9ca3af;margin-bottom:4px">発注元</div>
        <div style="font-size:13px;font-weight:700">${fromVal}</div>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px">
      <tr style="background:#f8fafc">
        <td style="padding:7px 10px;border:1px solid #e5e7eb;font-weight:600;width:30%">業務種別</td>
        <td style="padding:7px 10px;border:1px solid #e5e7eb">${svcType}</td>
      </tr>
      <tr>
        <td style="padding:7px 10px;border:1px solid #e5e7eb;font-weight:600;background:#f8fafc">輸送区間</td>
        <td style="padding:7px 10px;border:1px solid #e5e7eb">${route}</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:7px 10px;border:1px solid #e5e7eb;font-weight:600">荷物</td>
        <td style="padding:7px 10px;border:1px solid #e5e7eb">${goods}</td>
      </tr>
      <tr>
        <td style="padding:7px 10px;border:1px solid #e5e7eb;font-weight:600;background:#f8fafc">受領方法・納品場所</td>
        <td style="padding:7px 10px;border:1px solid #e5e7eb">${receipt}</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:7px 10px;border:1px solid #e5e7eb;font-weight:600">納品期日</td>
        <td style="padding:7px 10px;border:1px solid #e5e7eb">${delivDate}</td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:12px">
      <thead>
        <tr style="background:#0D4A3A;color:#fff">
          <th style="padding:7px 10px;text-align:left;font-weight:600;width:50%">項目</th>
          <th style="padding:7px 10px;text-align:right;font-weight:600">金額（税抜）</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:7px 10px;border:1px solid #e5e7eb">${item1name}</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:right">¥${Number(item1price||0).toLocaleString()}</td>
        </tr>
        ${item2name ? `<tr><td style="padding:7px 10px;border:1px solid #e5e7eb">${item2name}</td><td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:right">¥${Number(item2price||0).toLocaleString()}</td></tr>` : ''}
        <tr style="background:#f8fafc">
          <td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:right;color:#6b7280">小計</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:right">${subtotal}</td>
        </tr>
        <tr>
          <td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:right;color:#6b7280">消費税（10%）</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:right">${tax}</td>
        </tr>
        <tr style="background:#EAF5F0">
          <td style="padding:9px 10px;border:2px solid #0D4A3A;text-align:right;font-weight:700;color:#0D4A3A">合計（税込）</td>
          <td style="padding:9px 10px;border:2px solid #0D4A3A;text-align:right;font-weight:700;font-size:15px;color:#0D4A3A">${total}</td>
        </tr>
      </tbody>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px">
      <tr style="background:#f8fafc">
        <td style="padding:7px 10px;border:1px solid #e5e7eb;font-weight:600;width:30%">支払方法</td>
        <td style="padding:7px 10px;border:1px solid #e5e7eb">${payMethod}</td>
      </tr>
      <tr>
        <td style="padding:7px 10px;border:1px solid #e5e7eb;font-weight:600;background:#f8fafc">支払期日</td>
        <td style="padding:7px 10px;border:1px solid #e5e7eb">${payDue}</td>
      </tr>
      ${notes ? `<tr style="background:#f8fafc"><td style="padding:7px 10px;border:1px solid #e5e7eb;font-weight:600">備考</td><td style="padding:7px 10px;border:1px solid #e5e7eb">${notes}</td></tr>` : ''}
    </table>

    <div style="border-top:1px solid #e5e7eb;padding-top:12px;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between">
      <span>本書は下請法第3条に基づく発注書面です。</span>
      <span>発行：${fromVal}</span>
    </div>
  `;

  // html2canvas → jsPDF（請求書と同方式）
  const canvas = await html2canvas(area, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false
  });

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW  = pageW;
  const imgH  = (canvas.height / canvas.width) * imgW;
  const imgData = canvas.toDataURL('image/png');

  if (imgH <= pageH) {
    pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH);
  } else {
    let yOffset = 0;
    while (yOffset < imgH) {
      if (yOffset > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, -yOffset, imgW, imgH);
      yOffset += pageH;
    }
  }

  pdf.save('発注書_' + poNum + '.pdf');
}

// STEP4: 確認
function buildConfirmStep() {
  const p = partnerCompanies.find(x => x.id === partnerSelectedId);
  const caseData = partnerModalPhase === 'unprocessed' ? unprocessedCases[partnerModalCaseIdx] : processingCases[partnerModalCaseIdx];
  const splitNote = partnerModalPhase === 'processing'
    ? `<br>自社担当：${partnerSplitPct}%・協力会社担当：${100-partnerSplitPct}%` : '';
  document.getElementById('partner-confirm-summary').innerHTML =
    `<b>協力会社：</b>${p.name}（${p.contact}）<br>
     <b>案件：</b>${caseData.client||''}<br>
     <b>区間：</b>${caseData.from} → ${caseData.to}<br>
     <b>荷物：</b>${caseData.goods||''}<br>
     <b>納期：</b>${caseData.deadline}${splitNote}`;

  // 発注書確定済みの場合、発注書サマリを表示
  const poBlock = document.getElementById('po-confirmed-block');
  if (poConfirmed && poBlock) {
    poBlock.style.display = '';
    const poNum    = document.getElementById('po-number')?.value || '—';
    const total    = document.getElementById('po-total')?.textContent || '—';
    const payDue   = document.getElementById('po-payment-due')?.value || '—';
    const method   = document.getElementById('po-payment-method')?.value || '—';
    document.getElementById('po-confirmed-summary').innerHTML =
      `<b>発注書番号：</b>${poNum}<br>
       <b>金額：</b>${total}<br>
       <b>支払期日：</b>${payDue}<br>
       <b>支払方法：</b>${method}`;
  } else if (poBlock) {
    poBlock.style.display = 'none';
  }
  _updateStep4SentStatus();
}
// 確定処理
function confirmPartnerDispatch() {
  const p = partnerCompanies.find(x => x.id === partnerSelectedId);
  const phase = partnerModalPhase;
  const idx = partnerModalCaseIdx;
  const caseData = phase === 'unprocessed' ? unprocessedCases[idx] : processingCases[idx];

  // 発注書情報（確定済みの場合）
  const poNum     = poConfirmed ? (document.getElementById('po-number')?.value || null) : null;
  const poTotal   = poConfirmed ? (parseFloat(document.getElementById('po-item1-price')?.value||'0') + parseFloat(document.getElementById('po-item2-price')?.value||'0')) : 0;
  const poTax     = Math.round(poTotal * 0.1);
  const poIssuedAt = poConfirmed ? new Date().toISOString() : null;

  // 処理済みへ追加
  processedCases.unshift({
    id: caseData.id, status:'完了',
    casePattern: caseData.casePattern || null,
    partner: true, partnerName: p.name,
    client: caseData.client||'',
    from: caseData.from, to: caseData.to, goods: caseData.goods||'',
    completion: new Date().toLocaleDateString('ja-JP') + ' 協力会社依頼',
    distance: caseData.distance||'—', delay: 'なし',
    driver: '協力会社', vehicle: p.name,
    sales: 42000, fuel: 0, other: poTotal || 38000, profit: 4000, margin: 10,
    invoiceNo: 'INV-P-' + String(Math.floor(Math.random()*9000)+1000),
    invoiceDate: formatDateSlash(new Date()), due: formatDateSlash(new Date(Date.now()+30*86400000)), paid: false,
    progress: 0, truckTop: 50, progressPct: 0, remain: '—', eta: '—', donekm: 0,
    // 発注書情報（監査証跡）
    purchaseOrderNo: poNum,
    purchaseOrderTotal: poTotal ? poTotal + poTax : null,
    purchaseOrderIssuedAt: poIssuedAt,
    purchaseOrderMethod: poConfirmed ? (document.getElementById('po-payment-method')?.value || null) : null,
    purchaseOrderRoute:   poConfirmed ? (document.getElementById('po-route')?.value || null) : null,
    purchaseOrderGoods:   poConfirmed ? (document.getElementById('po-goods')?.value || null) : null,
    purchaseOrderReceipt: poConfirmed ? (document.getElementById('po-receipt')?.value || null) : null,
    purchaseOrderPayDue:  poConfirmed ? (document.getElementById('po-payment-due')?.value || null) : null
  });

  if (phase === 'unprocessed') {
    unprocessedCases.splice(idx, 1);
    renderUnprocessedList();
    if (unprocessedCases.length) renderUnprocessedDetail(0);
    else document.getElementById('unprocessed-detail').innerHTML = '';
  } else {
    processingCases.splice(idx, 1);
    renderProcessingList();
    if (processingCases.length) renderProcessingDetail(0);
    else document.getElementById('processing-detail').innerHTML = '';
  }

  closeModal('partner-modal');
  switchPhase('processed');
  renderProcessedList();
  renderProcessedDetail(0);
  updatePhaseCounts();
  // 請求管理ページのデータを連動更新
  syncInvoicePage(processedCases[0].id);
  const poMsg = poNum ? `（発注書 ${poNum} 交付済み）` : '';
  showToast(`${p.name}への依頼を確定しました。案件を処理済みに移行しました。${poMsg}`, 'success');
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  仮押さえ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let holdFilterUnprocessed = false;
let holdFilterProcessing  = false;
let patternFilterUnprocessed = 'all';
let patternFilterProcessing  = 'all';
let patternFilterProcessed   = 'all';
let partnerFilter            = 'all';

function setPartnerFilter(value) {
  partnerFilter = value;
  var sel = document.getElementById('partner-filter-select');
  if (sel) sel.value = value;
  renderProcessedList();
  var filtered = getFilteredProcessedCases();
  if (filtered.length) renderProcessedDetail(processedCases.indexOf(filtered[0]));
  else document.getElementById('processed-detail').innerHTML = '';
}

function setPatternFilter(phase, pattern) {
  if (phase === 'unprocessed') {
    patternFilterUnprocessed = pattern;
    const sel = document.getElementById('pf-u-select');
    if (sel) sel.value = pattern;
    renderUnprocessedList();
    const first = (pattern === 'all' ? unprocessedCases : unprocessedCases.filter(c => c.casePattern === pattern))[0];
    if (first) { selectedUnprocessedId = first.id; renderUnprocessedDetail(unprocessedCases.indexOf(first)); }
    else { selectedUnprocessedId = null; document.getElementById('unprocessed-detail').innerHTML = ''; }
  } else if (phase === 'processing') {
    patternFilterProcessing = pattern;
    const sel = document.getElementById('pf-p-select');
    if (sel) sel.value = pattern;
    renderProcessingList();
    const first = (pattern === 'all' ? processingCases : processingCases.filter(c => c.casePattern === pattern))[0];
    if (first) renderProcessingDetail(processingCases.indexOf(first));
    else document.getElementById('processing-detail').innerHTML = '';
  } else if (phase === 'processed') {
    patternFilterProcessed = pattern;
    var sel = document.getElementById('pf-d-select');
    if (sel) sel.value = pattern;
    renderProcessedList();
    var filtered = getFilteredProcessedCases();
    if (filtered.length) renderProcessedDetail(processedCases.indexOf(filtered[0]));
    else document.getElementById('processed-detail').innerHTML = '';
  }
}

// 受付チャネル selectからの呼び出し
function setChFilterSelect(value) {
  setChFilter(value);
}


function togglePatternEdit(i) {
  const row = document.getElementById('pattern-edit-row-' + i);
  if (!row) return;
  row.style.display = row.style.display === 'none' ? 'block' : 'none';
}

function cancelPatternEdit(i) {
  const row = document.getElementById('pattern-edit-row-' + i);
  if (row) row.style.display = 'none';
  // selectをリセット
  const sel = document.getElementById('pattern-select-' + i);
  if (sel) sel.value = unprocessedCases[i].casePattern || '';
}

function updateCasePattern(i, value) {
  unprocessedCases[i].casePattern = value;
}

function savePatternEdit(i) {
  const sel = document.getElementById('pattern-select-' + i);
  if (sel) unprocessedCases[i].casePattern = sel.value;
  const row = document.getElementById('pattern-edit-row-' + i);
  if (row) row.style.display = 'none';
  const caseId = unprocessedCases[i].id;
  selectedUnprocessedId = caseId;
  renderUnprocessedDetail(i);
  renderUnprocessedList();
  showToast('案件パターンを「' + unprocessedCases[i].casePattern + '」に更新しました', 'success');
}

function toggleHold(i, phase) {
  const cases = phase === 'unprocessed' ? unprocessedCases : processingCases;
  cases[i].onHold = !cases[i].onHold;
  const isHold = cases[i].onHold;

  if (phase === 'unprocessed') {
    const caseId = unprocessedCases[i].id;
    selectedUnprocessedId = caseId;
    renderUnprocessedList();
    renderUnprocessedDetail(i);
  } else {
    renderProcessingList();
    renderProcessingDetail(i);
    setTimeout(() => {
      const cards = document.querySelectorAll('#processing-list .case-card');
      if (cards[i]) cards[i].classList.add('selected');
    }, 10);
  }
  showToast(isHold ? '仮押さえしました' : '仮押さえを解除しました', 'success');
}

function toggleHoldFilter(phase) {
  if (phase === 'unprocessed') {
    holdFilterUnprocessed = !holdFilterUnprocessed;
    const btn = document.getElementById('filter-hold-u');
    if (btn) btn.classList.toggle('active', holdFilterUnprocessed);
    renderUnprocessedList();
    const cases = holdFilterUnprocessed
      ? unprocessedCases.filter(c => c.onHold)
      : unprocessedCases;
    if (cases.length) renderUnprocessedDetail(unprocessedCases.indexOf(cases[0]));
  } else {
    holdFilterProcessing = !holdFilterProcessing;
    const btn = document.getElementById('filter-hold-p');
    if (btn) btn.classList.toggle('active', holdFilterProcessing);
    renderProcessingList();
    const cases = holdFilterProcessing
      ? processingCases.filter(c => c.onHold)
      : processingCases;
    if (cases.length) renderProcessingDetail(processingCases.indexOf(cases[0]));
  }
}

function showToast(msg, type='success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${type==='success'?'✓':type==='info'?'ℹ':'!'}</span> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  メール・FAX受付
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── 受信Boxデータ（チャネル単位） ──
// 各Boxは「メール専用」または「FAX専用」のアドレス/番号を持つ
// 届いたメール・FAXはAIが取引先・種別を自動判定してデータ化
const faxBoxes = [
  {
    id: 'box-mail-1',
    label: '新規依頼受付',
    channelType: 'mail',                        // 'mail' | 'fax'
    address: 'uketsuke-main@logipoke.jp',
    faxNo: null,
    unread: 3,
    items: [
      {
        id: 'i1', type: 'mail',
        detectedClient: '株式会社○○商事',       // AI判定
        detectedConfidence: '高',
        from: 'yamada@marumaru-shoji.co.jp', fromName: '山田 健二（○○商事）',
        subject: '【配送依頼】5/26 東京→大阪 パレット便',
        time: '10:32',
        body: `いつもお世話になっております。\n○○商事 山田です。\n\n以下の内容にて配送をお願いしたく、ご連絡いたします。\n\n【集荷日時】5月26日（月）午前中\n【集荷場所】東京都品川区西品川1-1-1\n【配送先】大阪府大阪市北区梅田2-2-2\n【荷物内容】パレット積み / 1,200kg / 常温\n【希望納品】5月27日 午前中指定\n【備考】バース予約済み・時間厳守でお願いします\n\n何卒よろしくお願いいたします。`,
        analyzed: true,
        aiResult: { confidence:'高信頼度', client:'株式会社○○商事', from:'東京都品川区西品川1-1-1', to:'大阪府大阪市北区梅田2-2-2', goods:'パレット / 1,200kg / 常温', deadline:'05/27 AM指定', conditions:'時間厳守 / バース予約済み', vehicle:'10t車' }
      },
      {
        id: 'i2', type: 'mail',
        detectedClient: '△△食品株式会社',
        detectedConfidence: '高',
        from: 'order@deltafoods.co.jp', fromName: '田村 係長（△△食品）',
        subject: '【急配依頼】5/25 船橋→大田区 冷蔵便',
        time: '09:55',
        body: `お世話になっております。\n△△食品 田村です。\n\n急ぎの配送をお願いしたく連絡しました。\n\n集荷：千葉県船橋市○○倉庫（5/25 午前9時）\n配送：東京都大田区△△スーパー DC\n荷物：冷蔵食品（ケース）/ 500kg / 冷蔵\n納品希望：5/25 12:00まで\n特記：食品衛生管理 / 温度記録票必要\n\nよろしくお願いいたします。`,
        analyzed: true,
        aiResult: { confidence:'高信頼度', client:'△△食品株式会社', from:'千葉県船橋市', to:'東京都大田区', goods:'冷蔵食品(ケース) / 500kg / 冷蔵', deadline:'05/25 12:00', conditions:'温度記録票必要', vehicle:'冷蔵車' }
      },
      {
        id: 'i3', type: 'mail',
        detectedClient: '判定中…',
        detectedConfidence: 'low',
        from: 'logistics@unknown-corp.co.jp', fromName: 'unknown-corp 物流担当',
        subject: 'Re: 運賃確認および依頼について',
        time: '08:12',
        body: `お世話になっております。\n先日ご連絡しました件ですが、\n正式に依頼させていただきたく存じます。\n\n詳細は添付のとおりです。ご確認ください。`,
        analyzed: false, aiResult: null
      },
    ]
  },
  {
    id: 'box-fax-1',
    label: 'FAX受付（全般）',
    channelType: 'fax',
    address: null,
    faxNo: '03-6000-7700',
    unread: 2,
    items: [
      {
        id: 'i4', type: 'fax',
        detectedClient: '株式会社□□製作所',
        detectedConfidence: '高',
        from: 'fax-in@logipoke.jp', fromName: 'FAX受信 (0X-5000-9921)',
        subject: '【FAX受信】配送依頼書 05/24',
        time: '09:42',
        body: `--- FAX受信データ（AI-OCR変換済み）---\n\n運送依頼書\n\n発行日：R6.5.24\n発行：株式会社□□製作所 関西支社\n\n品名：機械部品（精密機器）\n数量：パレット3枚分 / 重量：1,200kg / 常温\n\n積地：茨城県つくば市 □□製作所 東日本工場\n卸地：愛知県名古屋市緑区 □□製作所 中部工場\n\n集荷希望：5月25日（土）10:00\n納品希望：5月25日（土）終日\n\n担当：鈴木 / 内線 501`,
        analyzed: true,
        aiResult: { confidence:'高信頼度', client:'株式会社□□製作所', from:'茨城県つくば市', to:'愛知県名古屋市緑区', goods:'機械部品 / 1,200kg / 常温', deadline:'05/25 終日', conditions:'精密機器・取扱注意', vehicle:'4t平車' }
      },
      {
        id: 'i5', type: 'fax',
        detectedClient: '◇◇アパレル株式会社',
        detectedConfidence: '中',
        from: 'fax-in@logipoke.jp', fromName: 'FAX受信 (0X-3000-4411)',
        subject: '【FAX受信】配送依頼書 05/24',
        time: '14:20',
        body: `--- FAX受信データ（AI-OCR変換済み）---\n\n配送依頼書\n\n依頼日：2024.5.24\n会社名：◇◇アパレル株式会社\n\n集荷地：東京都渋谷区△△倉庫\n配送先：大阪府大阪市 ○○DC\n\n品名：アパレル / 重量：300kg / 常温\n希望納品：5月26日 午前中\n\n※一部文字の読取が不鮮明なため要確認`,
        analyzed: true,
        aiResult: { confidence:'中信頼度', client:'◇◇アパレル株式会社', from:'東京都渋谷区', to:'大阪府大阪市', goods:'アパレル / 300kg / 常温', deadline:'05/26 AM指定', conditions:'OCR一部不鮮明・要確認', vehicle:'未特定' }
      },
    ]
  },
  {
    id: 'box-mail-2',
    label: '定期便専用',
    channelType: 'mail',
    address: 'teiki@logipoke.jp',
    faxNo: null,
    unread: 2,
    items: [
      {
        id: 'i6', type: 'mail',
        detectedClient: '株式会社○○商事',
        detectedConfidence: '高',
        from: 'logistics@marumaru-shoji.co.jp', fromName: '○○商事 物流部',
        subject: '6月定期便スケジュール送付',
        time: '16:05',
        body: `お世話になっております。\n6月分の定期便スケジュールを送付いたします。\n\n■毎週火・木（全8便）\n集荷：埼玉県川口市 弊社倉庫\n配送：神奈川県横浜市 ○○センター\n荷物：パレット / 600〜800kg / 常温\n\n詳細は添付のExcelをご確認ください。`,
        analyzed: true,
        aiResult: { confidence:'高信頼度', client:'株式会社○○商事', from:'埼玉県川口市', to:'神奈川県横浜市', goods:'パレット / 600〜800kg / 常温', deadline:'毎週火・木（定期）', conditions:'定期8便 / 要スケジュール登録', vehicle:'4tウィング' }
      },
      {
        id: 'i7', type: 'mail',
        detectedClient: '△△食品株式会社',
        detectedConfidence: '高',
        from: 'schedule@deltafoods.co.jp', fromName: '△△食品 スケジュール担当',
        subject: '来月の定期便スケジュール確認',
        time: '15:30',
        body: `お世話になっております。\n来月の定期便スケジュールについて確認させてください。\n\n6月の第1・3週（火・木）で週2便でお願いしたいのですが\n対応可能でしょうか？\n\nご確認のほどよろしくお願いいたします。`,
        analyzed: false, aiResult: null
      },
    ]
  },
];

let faxCurrentBoxIdx = 0;
let faxCurrentItemId = null;
let faxChecked = new Set();

// ── 左ペイン：Box一覧 ──
function renderFaxAddrList() {
  const el = document.getElementById('fax-addr-list');
  if (!el) return;
  el.innerHTML = faxBoxes.map((box, i) => {
    const isMail = box.channelType === 'mail';
    const addr = isMail ? box.address : box.faxNo;
    const unanalyzed = box.items.filter(it => !it.analyzed).length;
    return `
      <div class="fax-addr-item ${i === faxCurrentBoxIdx ? 'active' : ''}" onclick="selectFaxBox(${i})">
        <div class="fax-addr-name">
          <span style="font-size:15px">${isMail ? '✉️' : '📠'}</span>
          ${box.label}
        </div>
        <div class="fax-addr-email">${addr}</div>
        <div class="fax-addr-meta" style="gap:5px;flex-wrap:wrap">
          <span class="fax-type-badge ${isMail ? 'mail' : 'fax'}" style="font-size:9px">${isMail ? 'メール受信' : 'FAX受信'}</span>
          <span style="font-size:10px;color:var(--text-muted)">${box.items.length}件</span>
          ${unanalyzed > 0 ? `<span style="font-size:9px;background:#fef3c7;color:#92400e;padding:1px 5px;border-radius:4px;font-weight:700">未解析 ${unanalyzed}</span>` : ''}
          ${box.unread > 0 ? `<span class="fax-addr-unread">${box.unread}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
  const total = faxBoxes.reduce((s, b) => s + b.unread, 0);
  const cnt = document.getElementById('fax-unread-total');
  if (cnt) { cnt.textContent = total; cnt.style.display = total > 0 ? '' : 'none'; }
}

function selectFaxBox(idx) {
  faxCurrentBoxIdx = idx;
  faxCurrentItemId = null;
  faxChecked = new Set();
  renderFaxAddrList();
  renderFaxMailList();
  renderFaxDetail(null);
  updateFaxBulkBar();
}

// ── 中央ペイン：受信一覧 ──
function renderFaxMailList() {
  const box = faxBoxes[faxCurrentBoxIdx];
  const el = document.getElementById('fax-mail-list');
  const titleEl = document.getElementById('fax-center-title');
  const addrEl = document.getElementById('fax-center-addr');
  const badgeEl = document.getElementById('fax-center-type-badge');
  if (!el || !box) return;

  if (titleEl) titleEl.textContent = box.label;
  const addr = box.channelType === 'mail' ? box.address : box.faxNo;
  if (addrEl) addrEl.textContent = addr;
  if (badgeEl) {
    badgeEl.className = 'fax-type-badge ' + (box.channelType === 'fax' ? 'fax' : 'mail');
    badgeEl.textContent = box.channelType === 'fax' ? 'FAX受信' : 'メール受信';
  }

  if (box.items.length === 0) {
    el.innerHTML = '<div class="fax-empty-box"><div class="fax-empty-icon">📭</div><div>受信した案件はありません</div></div>';
    return;
  }

  el.innerHTML = box.items.map(it => {
    const clientColor = it.detectedConfidence === '高' ? '#065f46' : it.detectedConfidence === '中' ? '#92400e' : '#6b7280';
    const clientBg = it.detectedConfidence === '高' ? '#d1fae5' : it.detectedConfidence === '中' ? '#fef3c7' : '#f3f4f6';
    return `
      <div class="fax-mail-item ${it.id === faxCurrentItemId ? 'active' : ''} ${faxChecked.has(it.id) ? 'selected' : ''}" onclick="selectFaxItem('${it.id}')">
        <div class="fax-mail-item-header">
          <input type="checkbox" class="fax-mail-checkbox" ${faxChecked.has(it.id) ? 'checked' : ''}
            onclick="event.stopPropagation();toggleFaxCheck('${it.id}',this.checked)">
          <div class="fax-mail-from">${it.fromName}</div>
          <div class="fax-mail-time">${it.time}</div>
        </div>
        <div class="fax-mail-subject">${it.subject}</div>
        <!-- AI判定：取引先 -->
        <div style="margin:4px 0;display:flex;align-items:center;gap:5px">
          <span style="font-size:9px;font-weight:700;letter-spacing:.04em;color:var(--text-muted)">AI判定：</span>
          <span style="font-size:11px;font-weight:700;padding:1px 7px;border-radius:4px;background:${clientBg};color:${clientColor}">
            ${it.detectedClient}
          </span>
          <span style="font-size:9px;color:var(--text-muted)">${it.detectedConfidence === '高' ? '（高）' : it.detectedConfidence === '中' ? '（中）' : ''}</span>
        </div>
        <div class="fax-mail-tags">
          <span class="fax-mail-tag ${it.type === 'fax' ? 'fax-tag' : 'mail-tag'}">${it.type === 'fax' ? '📠 FAX' : '✉️ メール'}</span>
          ${it.analyzed ? '<span class="fax-mail-tag ai-done">✓ AI解析済み</span>' : '<span class="fax-mail-tag new">● 未解析</span>'}
        </div>
      </div>
    `;
  }).join('');
}

function selectFaxItem(itemId) {
  faxCurrentItemId = itemId;
  renderFaxMailList();
  renderFaxDetail(itemId);
  const box = faxBoxes[faxCurrentBoxIdx];
  const item = box.items.find(it => it.id === itemId);
  if (item && !item._read) {
    item._read = true;
    if (box.unread > 0) box.unread--;
    renderFaxAddrList();
  }
}

// ── 右ペイン：詳細 ──
function renderFaxDetail(itemId) {
  const emptyEl = document.getElementById('fax-detail-empty');
  const contentEl = document.getElementById('fax-detail-content');
  const headerEl = document.getElementById('fax-detail-header');
  const bodyEl = document.getElementById('fax-detail-body');
  const actionEl = document.getElementById('fax-action-bar');
  if (!emptyEl || !contentEl) return;

  if (!itemId) {
    emptyEl.style.display = 'flex'; contentEl.style.display = 'none'; return;
  }
  const box = faxBoxes[faxCurrentBoxIdx];
  const item = box.items.find(it => it.id === itemId);
  if (!item) return;

  emptyEl.style.display = 'none'; contentEl.style.display = 'flex';

  const confidenceLabel = { '高': '高信頼度', '中': '中信頼度', 'low': '判定中' }[item.detectedConfidence] || '';
  const confidenceColor = { '高': '#065f46', '中': '#92400e', 'low': '#6b7280' }[item.detectedConfidence];
  const confidenceBg = { '高': '#d1fae5', '中': '#fef3c7', 'low': '#f3f4f6' }[item.detectedConfidence];

  headerEl.innerHTML = `
    <div class="fax-detail-from-row">
      <div class="fax-detail-avatar">${item.type === 'fax' ? '📠' : '✉️'}</div>
      <div class="fax-detail-from-info">
        <div class="fax-detail-from-name">${item.fromName}</div>
        <div class="fax-detail-from-email">${item.from}</div>
      </div>
      <div class="fax-detail-time">${item.time}</div>
    </div>
    <div class="fax-detail-subject">${item.subject}</div>
    <div class="fax-detail-meta" style="gap:6px;flex-wrap:wrap">
      <span class="fax-mail-tag ${item.type === 'fax' ? 'fax-tag' : 'mail-tag'}" style="font-size:10px">${item.type === 'fax' ? '📠 FAX受信' : '✉️ メール受信'}</span>
      <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;background:${confidenceBg};color:${confidenceColor}">
        AI取引先判定：${item.detectedClient}（${confidenceLabel}）
      </span>
      ${item.analyzed ? '<span class="fax-mail-tag ai-done" style="font-size:10px">✓ AI解析済み</span>' : '<span class="fax-mail-tag analyzing" style="font-size:10px">⏳ 未解析</span>'}
    </div>
  `;

  let aiPanelHtml = '';
  if (item.analyzed && item.aiResult) {
    const r = item.aiResult;
    aiPanelHtml = `
      <div class="fax-ai-panel">
        <div class="fax-ai-panel-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          AIデータ化結果
          <span class="fax-ai-confidence">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            ${r.confidence}
          </span>
        </div>
        <div class="fax-ai-grid">
          <div class="fax-ai-item"><div class="fax-ai-label">取引先（AI判定）</div><div class="fax-ai-value">${r.client}</div></div>
          <div class="fax-ai-item"><div class="fax-ai-label">車両目安</div><div class="fax-ai-value">${r.vehicle}</div></div>
          <div class="fax-ai-item fax-ai-full"><div class="fax-ai-label">集荷 → 配送</div><div class="fax-ai-value">${r.from} → ${r.to}</div></div>
          <div class="fax-ai-item"><div class="fax-ai-label">荷物</div><div class="fax-ai-value">${r.goods}</div></div>
          <div class="fax-ai-item"><div class="fax-ai-label">希望納期</div><div class="fax-ai-value">${r.deadline}</div></div>
          ${r.conditions ? `<div class="fax-ai-item fax-ai-full"><div class="fax-ai-label">条件・備考</div><div class="fax-ai-value">${r.conditions}</div></div>` : ''}
        </div>
      </div>
    `;
  } else {
    aiPanelHtml = `
      <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:14px 16px;margin-bottom:14px">
        <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:6px;display:flex;align-items:center;gap:6px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          AIデータ化（未実行）
        </div>
        <div style="font-size:12px;color:#78350f;margin-bottom:10px">AI解析を実行すると、取引先・集荷先・配送先・荷物情報などを自動抽出します。</div>
        <button class="btn btn-primary btn-sm" onclick="runFaxAI('${item.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          AI解析を実行する
        </button>
      </div>
    `;
  }

  bodyEl.innerHTML = `
    ${aiPanelHtml}
    <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px">受信内容</div>
    <div class="fax-mail-text">${item.body}</div>
  `;

  const canMove = item.analyzed && item.aiResult;
  actionEl.innerHTML = `
    <button class="btn btn-secondary" onclick="showToast('返信メールを開きました', 'success')">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
      返信
    </button>
    ${!item.analyzed ? `
      <button class="btn btn-secondary" onclick="runFaxAI('${item.id}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        AI解析実行
      </button>
    ` : ''}
    <div style="margin-left:auto">
      <button class="btn btn-primary" ${canMove ? '' : 'disabled style="opacity:.4;cursor:not-allowed"'} onclick="faxMoveToUnprocessed('${item.id}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="5 12 19 12"/><polyline points="12 5 19 12 12 19"/></svg>
        個別案件処理の未処理へ
      </button>
    </div>
  `;
}

function runFaxAI(itemId) {
  const box = faxBoxes[faxCurrentBoxIdx];
  const item = box.items.find(it => it.id === itemId);
  if (!item) return;
  showToast('AI解析中…', 'info');
  setTimeout(() => {
    item.analyzed = true;
    item.detectedConfidence = '中';
    item.detectedClient = item.detectedClient === '判定中…' ? '（自動判定済み）' : item.detectedClient;
    item.aiResult = {
      confidence: '中信頼度',
      client: item.detectedClient,
      from: '集荷地（要確認）', to: '配送先（要確認）',
      goods: '荷物（要確認）', deadline: '納期（要確認）',
      conditions: '内容をご確認・修正してください', vehicle: '未特定'
    };
    renderFaxMailList();
    renderFaxDetail(itemId);
    showToast('AI解析が完了しました', 'success');
  }, 1400);
}

function faxMoveToUnprocessed(itemId) {
  const box = faxBoxes[faxCurrentBoxIdx];
  const item = box.items.find(it => it.id === itemId);
  if (!item || !item.aiResult) return;
  const r = item.aiResult;
  const newCase = {
    id: '202405' + String(Date.now()).slice(-5),
    status: '未解析', client: r.client, from: r.from, to: r.to,
    goods: r.goods, deadline: r.deadline, conditions: r.conditions || '',
    ch: item.type === 'fax' ? 'fax' : 'mail',
    time: item.time, analyzed: true,
    casePattern: null,
    aiResult: { confidence: r.confidence, client: r.client, from: r.from, to: r.to, goods: r.goods, deadline: r.deadline, conditions: r.conditions || '', vehicle: r.vehicle || '', count: 1 },
    vehicles: []
  };
  newCase.casePattern = autoDetectPattern(newCase);
  unprocessedCases.unshift(newCase);
  // 配車計画表（未割当案件）にも自動反映
  if (typeof addToDispatchUnassigned === 'function') {
    addToDispatchUnassigned(newCase.id, {
      client: newCase.client, from: newCase.from, to: newCase.to,
      goods: newCase.goods, deadline: newCase.deadline
    });
  }
  box.items = box.items.filter(it => it.id !== itemId);
  faxCurrentItemId = null;
  renderFaxAddrList(); renderFaxMailList(); renderFaxDetail(null);
  updatePhaseCounts && updatePhaseCounts();
  showToast('個別案件処理の未処理 / 配車計画表の未割当案件 に登録しました', 'success');
}

function toggleFaxCheck(itemId, checked) {
  if (checked) faxChecked.add(itemId); else faxChecked.delete(itemId);
  renderFaxMailList(); updateFaxBulkBar();
}
function faxSelectAll() {
  const box = faxBoxes[faxCurrentBoxIdx];
  if (!box) return;
  if (faxChecked.size === box.items.length) faxChecked = new Set();
  else faxChecked = new Set(box.items.map(it => it.id));
  renderFaxMailList(); updateFaxBulkBar();
}
function faxClearSelection() {
  faxChecked = new Set(); renderFaxMailList(); updateFaxBulkBar();
}
function updateFaxBulkBar() {
  const bar = document.getElementById('fax-bulk-bar');
  const cnt = document.getElementById('fax-bulk-count');
  if (!bar) return;
  const n = faxChecked.size;
  bar.style.display = n > 0 ? 'flex' : 'none';
  if (cnt) cnt.textContent = n;
}
function faxBulkMoveToUnprocessed() {
  const box = faxBoxes[faxCurrentBoxIdx];
  if (!box || faxChecked.size === 0) return;
  const toMove = box.items.filter(it => faxChecked.has(it.id) && it.analyzed && it.aiResult);
  const skipped = box.items.filter(it => faxChecked.has(it.id) && (!it.analyzed || !it.aiResult)).length;
  toMove.forEach(item => {
    const r = item.aiResult;
    const newCase = {
      id: '202405' + String(Date.now() + Math.random()).slice(-5),
      status: '未解析', client: r.client, from: r.from, to: r.to,
      goods: r.goods, deadline: r.deadline, conditions: r.conditions || '',
      ch: item.type === 'fax' ? 'fax' : 'mail', time: item.time, analyzed: true,
      casePattern: null,
      aiResult: { confidence: r.confidence, client: r.client, from: r.from, to: r.to, goods: r.goods, deadline: r.deadline, conditions: r.conditions||'', vehicle: r.vehicle||'', count: 1 },
      vehicles: []
    };
    newCase.casePattern = autoDetectPattern(newCase);
    unprocessedCases.unshift(newCase);
    // 配車計画表（未割当案件）にも自動反映
    if (typeof addToDispatchUnassigned === 'function') {
      addToDispatchUnassigned(newCase.id, {
        client: newCase.client, from: newCase.from, to: newCase.to,
        goods: newCase.goods, deadline: newCase.deadline
      });
    }
  });
  box.items = box.items.filter(it => !faxChecked.has(it.id) || (!it.analyzed || !it.aiResult));
  faxChecked = new Set(); faxCurrentItemId = null;
  renderFaxAddrList(); renderFaxMailList(); renderFaxDetail(null);
  updateFaxBulkBar(); updatePhaseCounts && updatePhaseCounts();

  // 案件一覧の未処理タブへ遷移して先頭（新規追加分）を選択
  if (toMove.length > 0) {
    showPage_byName('cases');
    switchPhase('unprocessed');
    const newCase = unprocessedCases[0];
    selectedUnprocessedId = newCase.id;
    renderUnprocessedList();
    renderUnprocessedDetail(0);
    setTimeout(() => {
      const card = document.querySelector('#ucard-' + newCase.id);
      if (card) { card.classList.add('selected'); card.scrollIntoView({behavior:'smooth', block:'nearest'}); }
    }, 50);
  }

  let msg = `${toMove.length}件を個別案件処理の未処理 / 配車計画表の未割当案件 に登録しました`;
  if (skipped > 0) msg += `（${skipped}件はAI解析未完了のためスキップ）`;
  showToast(msg, 'success');
}

// ── 新規アドレス発行モーダル ──
let _faxPreviewRand = Math.random().toString(36).slice(2,7);
function openNewAddrModal() {
  _faxPreviewRand = Math.random().toString(36).slice(2,7);
  const overlay = document.getElementById('fax-new-addr-modal-overlay');
  if (overlay) overlay.style.display = 'flex';
  updateFaxAddrPreview();
}
function closeFaxModal() {
  const overlay = document.getElementById('fax-new-addr-modal-overlay');
  if (overlay) overlay.style.display = 'none';
}
function updateFaxAddrPreview() {
  const previewEl = document.getElementById('fax-addr-preview');
  if (!previewEl) return;
  const type = document.querySelector('input[name="fax-new-type"]:checked')?.value || 'mail';
  const labelEl = document.getElementById('fax-new-label');
  const label = labelEl?.value.trim();
  const slugBase = label ? label.replace(/[^\w]/g,'').toLowerCase().slice(0,8) : 'uketsuke';
  if (type === 'mail') {
    previewEl.innerHTML = `<div>✉️ ${slugBase}-${_faxPreviewRand}@logipoke.jp</div><div style="font-size:11px;color:var(--text-muted);margin-top:4px">メールアドレスとして発行されます</div>`;
  } else {
    previewEl.innerHTML = `<div>📠 FAX番号：0X-${Math.floor(3000+parseInt(_faxPreviewRand,36)%7000)}-${Math.floor(1000+parseInt(_faxPreviewRand,36)%9000)}</div><div style="font-size:11px;color:var(--text-muted);margin-top:4px">FAX番号として発行されます</div>`;
  }
  // ラジオボタンの選択ハイライト
  ['mail','fax'].forEach(t => {
    const lbl = document.getElementById('fax-type-label-'+t);
    if (lbl) lbl.style.borderColor = type===t ? 'var(--sidebar-bg)' : 'var(--border)';
    if (lbl) lbl.style.background = type===t ? 'var(--accent-pale)' : '';
  });
}
function confirmNewAddr() {
  const type = document.querySelector('input[name="fax-new-type"]:checked')?.value || 'mail';
  const labelEl = document.getElementById('fax-new-label');
  const label = labelEl?.value.trim() || (type === 'mail' ? 'メール受付' : 'FAX受付');
  const slugBase = label.replace(/[^\w]/g,'').toLowerCase().slice(0,8) || 'uketsuke';
  const rand = _faxPreviewRand;
  const newBox = {
    id: 'box-' + Date.now(),
    label,
    channelType: type,
    address: type === 'mail' ? `${slugBase}-${rand}@logipoke.jp` : null,
    faxNo: type === 'fax' ? `0X-${Math.floor(3000+parseInt(rand,36)%7000)}-${Math.floor(1000+parseInt(rand,36)%9000)}` : null,
    unread: 0, items: []
  };
  faxBoxes.push(newBox);
  faxCurrentBoxIdx = faxBoxes.length - 1;
  faxChecked = new Set(); faxCurrentItemId = null;
  closeFaxModal();
  if (labelEl) labelEl.value = '';
  renderFaxAddrList(); renderFaxMailList(); renderFaxDetail(null);
  showToast(`「${label}」の${type === 'mail' ? 'メール' : 'FAX'}アドレスを発行しました`, 'success');
}

document.addEventListener('DOMContentLoaded', () => {
  const labelEl = document.getElementById('fax-new-label');
  if (labelEl) labelEl.addEventListener('input', updateFaxAddrPreview);
  document.querySelectorAll('input[name="fax-new-type"]').forEach(r => r.addEventListener('change', updateFaxAddrPreview));
  // 初期表示：案件一覧のサブグループを開いておく
  var sg = document.getElementById('cases-sub-group');
  var ni = document.getElementById('nav-cases');
  if (sg) sg.classList.add('open');
  if (ni) ni.classList.add('sub-open');
  // 初期表示が配車計画表の場合：コンテンツを描画する
  const dispatchPage = document.getElementById('page-dispatch');
  if (dispatchPage && dispatchPage.classList.contains('active')) {
    setTimeout(function() {
      if (typeof renderDispatchContent === 'function') renderDispatchContent();
    }, 30);
  }
  // 配車計画表「確定済み」タブのバッジ数値を実データから初期化
  try {
    if (typeof buildConfirmedAssignments === 'function') buildConfirmedAssignments();
    const cntEl = document.getElementById('dtab-confirmed-count');
    if (cntEl && typeof processedCases !== 'undefined') {
      cntEl.textContent = processedCases.filter(function(c){ return c.billingConfirmed; }).length;
    }
  } catch (e) { /* noop */ }
});

function initFaxPage() {
  renderFaxAddrList();
  renderFaxMailList();
  renderFaxDetail(null);
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  スプリッター
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function() {
  function makeSplitter(splitterId, minW, maxW) {
    var splitter = document.getElementById(splitterId);
    if (!splitter || splitter._init) return;
    splitter._init = true;
    var prev = splitter.previousElementSibling;
    if (!prev) return;

    var dragging = false, startX = 0, startW = 0;

    splitter.addEventListener('mousedown', function(e) {
      dragging = true;
      startX = e.clientX;
      startW = prev.offsetWidth;
      splitter.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
      if (!dragging) return;
      var nw = Math.max(minW, Math.min(maxW, startW + e.clientX - startX));
      prev.style.width = nw + 'px';
    });
    document.addEventListener('mouseup', function() {
      if (!dragging) return;
      dragging = false;
      splitter.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });
    // タッチ対応
    splitter.addEventListener('touchstart', function(e) {
      dragging = true; startX = e.touches[0].clientX; startW = prev.offsetWidth;
      splitter.classList.add('dragging'); e.preventDefault();
    }, {passive: false});
    document.addEventListener('touchmove', function(e) {
      if (!dragging) return;
      var nw = Math.max(minW, Math.min(maxW, startW + e.touches[0].clientX - startX));
      prev.style.width = nw + 'px';
    }, {passive: false});
    document.addEventListener('touchend', function() {
      if (!dragging) return;
      dragging = false; splitter.classList.remove('dragging');
    });
  }

  function initSplitters() {
    makeSplitter('splitter-unprocessed', 276, 676);
    makeSplitter('splitter-processing',  276, 676);
    makeSplitter('splitter-processed',   276, 676);
    makeSplitter('splitter-invoice',     220, 620);
  }

  document.addEventListener('DOMContentLoaded', initSplitters);
  window.addEventListener('load', function() { initSplitters(); setTimeout(initSplitters, 200); });
})();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  案件パターン ツールチップ 位置制御
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function() {
  const TIP_W = 280;
  const GAP = 8;

  document.addEventListener('mouseover', function(e) {
    const wrap = e.target.closest('.pattern-flag-wrap');
    if (!wrap) return;
    const tip = wrap.querySelector('.pattern-tip');
    if (!tip) return;

    tip.style.display = 'block';
    const flagRect = wrap.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tipH = tip.offsetHeight;

    // 左端：フラグ中心 - チップ幅の半分、はみ出し補正
    let left = flagRect.left + flagRect.width / 2 - TIP_W / 2;
    left = Math.max(8, Math.min(left, vw - TIP_W - 8));

    // 上下：上に収まるなら上、なければ下
    const spaceAbove = flagRect.top;
    const spaceBelow = vh - flagRect.bottom;
    let top, tipClass;
    if (spaceAbove >= tipH + GAP + 12) {
      top = flagRect.top - tipH - GAP;
      tipClass = 'tip-above';
    } else {
      top = flagRect.bottom + GAP;
      tipClass = 'tip-below';
    }

    // 矢印位置（チップ左端からの相対位置）
    const arrowLeft = flagRect.left + flagRect.width / 2 - left;
    const arrowPct = Math.max(12, Math.min(arrowLeft, TIP_W - 12));

    tip.className = 'pattern-tip ' + tipClass;
    tip.style.setProperty('--tip-arrow-left', arrowPct + 'px');
    tip.style.left = left + 'px';
    tip.style.top  = top  + 'px';
  });

  document.addEventListener('mouseout', function(e) {
    const wrap = e.target.closest('.pattern-flag-wrap');
    if (!wrap) return;
    // relatedTarget が wrap 内なら非表示にしない
    if (wrap.contains(e.relatedTarget)) return;
    const tip = wrap.querySelector('.pattern-tip');
    if (tip) tip.style.display = 'none';
  });
})();


renderUnprocessedList();
if (unprocessedCases.length > 0) {
  selectedUnprocessedId = unprocessedCases[0].id;
  renderUnprocessedDetail(0);
}
// 初期表示ケース（001：analyzed済み）の運賃判定を自動実行
if (unprocessedCases[0] && unprocessedCases[0].analyzed && !unprocessedCases[0].fareResult) {
  calcFare(unprocessedCases[0]).then(r => { unprocessedCases[0].fareResult = r; renderUnprocessedDetail(0); });
}
renderProcessingList();
renderProcessingDetail(0);
renderProcessedList();
renderProcessedDetail(0);
setTimeout(() => { drawLiveMap(0); startLiveUpdates(0); }, 50);
// 初期バッジ色セット
updatePhaseCounts();

// チェックボックス初期スタイル（チェック済み=深緑）
document.addEventListener('DOMContentLoaded', () => {});
const ckEl = document.getElementById('logipoke-sync-check');
if (ckEl) ckEl.style.background = 'var(--sidebar-bg)';