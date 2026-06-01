// ─── 収支レポート ───────────────────────────────────────
(function(){

// 月次ダミーデータ生成（2025年1〜12月）
const MONTHLY_DATA = [
  {m:'1月',  sales:1820000, vehicleCost:420000, cases:14},
  {m:'2月',  sales:1650000, vehicleCost:390000, cases:12},
  {m:'3月',  sales:2240000, vehicleCost:510000, cases:18},
  {m:'4月',  sales:2480000, vehicleCost:580000, cases:20},
  {m:'5月',  sales:2150000, vehicleCost:498000, cases:17},  // 当月（実績）
  {m:'6月',  sales:0,       vehicleCost:0,      cases:0, forecast:true},
  {m:'7月',  sales:0,       vehicleCost:0,      cases:0, forecast:true},
  {m:'8月',  sales:0,       vehicleCost:0,      cases:0, forecast:true},
  {m:'9月',  sales:0,       vehicleCost:0,      cases:0, forecast:true},
  {m:'10月', sales:0,       vehicleCost:0,      cases:0, forecast:true},
  {m:'11月', sales:0,       vehicleCost:0,      cases:0, forecast:true},
  {m:'12月', sales:0,       vehicleCost:0,      cases:0, forecast:true},
];

let rptView = 'monthly';
let rptMonth = 4; // 0-based index → 5月

// ── processedCases に運賃フィールドを補完 ──
function getCasesForMonth(monthIdx) {
  // 実際のprocessedCasesデータを使用（月フィルタなしで全件）
  const base = (typeof processedCases !== 'undefined') ? processedCases : [];
  // ダミー補完：月次データに合わせてスケーリング
  const scale = MONTHLY_DATA[monthIdx].sales / 105000; // 既存3件合計105000
  return base.map(c => ({
    ...c,
    sales: Math.round(c.sales * scale),
    fuel: Math.round(c.fuel * scale),
    other: Math.round((c.other||0) * scale),
    profit: Math.round(c.profit * scale),
  }));
}

// ── 車両コストを期間に応じて集計 ──
function getVehicleCosts(monthIdx) {
  if(typeof window.vehicleMasterData === 'undefined') return [];
  const d = MONTHLY_DATA[monthIdx];
  // 全コストをスケーリング
  const totalActualCost = window.vehicleMasterData.reduce((s,v)=>{
    return s + (v.costLogs||[]).reduce((a,l)=>a+l.amount,0)
              + (v.fuelLogs||[]).reduce((a,l)=>a+l.amount,0);
  },0);
  const scale = d.vehicleCost / (totalActualCost||1);

  return window.vehicleMasterData.map(v=>{
    const fuel  = (v.fuelLogs||[]).reduce((a,l)=>a+l.amount,0);
    const maint = (v.costLogs||[]).filter(l=>['修理・整備','3ヶ月点検','その他点検','車検'].includes(l.cat)).reduce((a,l)=>a+l.amount,0);
    const ins   = (v.costLogs||[]).filter(l=>['自賠責保険','任意保険','自動車税','自動車重量税'].includes(l.cat)).reduce((a,l)=>a+l.amount,0);
    const other = (v.costLogs||[]).filter(l=>['部品購入'].includes(l.cat)).reduce((a,l)=>a+l.amount,0);
    return {
      id: v.id, type: v.type, driver: v.driverName,
      fuel:  Math.round(fuel*scale),
      maint: Math.round(maint*scale),
      ins:   Math.round(ins*scale),
      other: Math.round(other*scale),
      total: Math.round((fuel+maint+ins+other)*scale),
    };
  });
}

// ── 数値フォーマット ──
const fmt = n => n.toLocaleString('ja-JP');
const fmtM = n => n >= 1000000 ? (n/1000000).toFixed(1)+'M' : (n/1000).toFixed(0)+'K';

// ── KPIカード ──
function renderKPICards(sales, cost, profit, margin) {
  const prevSales = sales * 0.92;
  const salesDiff = ((sales - prevSales)/prevSales*100).toFixed(1);
  const prevMargin = (margin * 0.96).toFixed(1);
  document.getElementById('rpt-kpi-row').innerHTML = [
    {label:'売上', val:'¥'+fmt(sales), sub:'前期比 +'+salesDiff+'%', color:'#0D4A3A', icon:'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'},
    {label:'コスト', val:'¥'+fmt(cost), sub:'売上比 '+Math.round(cost/sales*100)+'%', color:'#0D4A3A', icon:'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'},
    {label:'粗利益', val:'¥'+fmt(profit), sub:'前期比 +'+(salesDiff*1.05).toFixed(1)+'%', color:'#0D4A3A', icon:'M22 12h-4l-3 9L9 3l-3 9H2'},
    {label:'利益率', val:margin.toFixed(1)+'%', sub:'前期 '+prevMargin+'%', color:'#0D4A3A', icon:'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'},
  ].map(k=>`
    <div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px 18px;border-left:4px solid #0D4A3A">
      <div style="font-size:10px;color:var(--text-secondary);font-weight:700;letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px">${k.label}</div>
      <div style="font-size:24px;font-weight:800;font-family:'Inter',sans-serif;color:#111827;margin-bottom:4px">${k.val}</div>
      <div style="font-size:11px;color:var(--text-secondary)">${k.sub}</div>
    </div>
  `).join('');
}

// ── Canvas棒グラフ（tooltip付き） ──
let _chartData = [];
let _chartPad  = {t:10, b:30, l:50, r:10};
let _chartStep = 0;
let _chartBarW = 0;
let _chartMaxVal = 0;
let _chartH_inner = 0;

function drawChart(data) {
  const canvas = document.getElementById('rpt-chart');
  if(!canvas) return;
  const W = canvas.offsetWidth || canvas.parentElement.offsetWidth - 36 || 600;
  const H = 220;
  canvas.width = W; canvas.height = H;

  _chartData = data;
  const pad = _chartPad;
  const chartW = W - pad.l - pad.r;
  const chartH = H - pad.t - pad.b;
  _chartH_inner = chartH;
  const step = chartW / data.length;
  _chartStep = step;
  const barW = step * 0.2;
  _chartBarW = barW;
  const maxVal = Math.max(...data.map(d=>Math.max(d.sales||0, d.vehicleCost||0, (d.sales-d.vehicleCost)||0)));
  _chartMaxVal = maxVal;

  _drawChartFrame(canvas, data, W, H, pad, chartW, chartH, step, barW, maxVal, -1);

  // mousemove / mouseleave
  canvas._chartHandler && canvas.removeEventListener('mousemove', canvas._chartHandler);
  canvas._chartLeave   && canvas.removeEventListener('mouseleave', canvas._chartLeave);

  canvas._chartHandler = function(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
    let hit = -1;
    data.forEach((d,i)=>{
      const cx = pad.l + i*step + step/2;
      if(mx >= cx - step/2 && mx < cx + step/2) hit = i;
    });
    _drawChartFrame(canvas, data, W, H, pad, chartW, chartH, step, barW, maxVal, hit);
    if(hit >= 0) _drawTooltip(canvas, data[hit], hit, W, H, pad, step, maxVal, chartH);
  };
  canvas._chartLeave = function() {
    _drawChartFrame(canvas, data, W, H, pad, chartW, chartH, step, barW, maxVal, -1);
  };
  canvas.addEventListener('mousemove', canvas._chartHandler);
  canvas.addEventListener('mouseleave', canvas._chartLeave);
}

function _drawChartFrame(canvas, data, W, H, pad, chartW, chartH, step, barW, maxVal, hitIdx) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);

  // グリッド線
  ctx.strokeStyle = '#f3f4f6';
  ctx.lineWidth = 1;
  for(let i=0;i<=4;i++){
    const y = pad.t + chartH - (chartH/4)*i;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W-pad.r, y); ctx.stroke();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(fmtM(maxVal/4*i), pad.l-4, y+3);
  }

  // ホバー列ハイライト
  if(hitIdx >= 0) {
    const hx = pad.l + hitIdx * step;
    ctx.fillStyle = 'rgba(13,74,58,0.05)';
    ctx.fillRect(hx, pad.t, step, chartH);
  }

  // 棒グラフ
  data.forEach((d,i)=>{
    const x = pad.l + i*step + step/2;
    const isForecast = d.forecast;
    const isHit = i === hitIdx;
    const alpha = isForecast ? 0.25 : 1;
    const bright = isHit ? 1.15 : 1;

    const drawBar = (val, color, offset)=>{
      if(!val) return;
      const h = (val/maxVal)*chartH;
      const bx = x + offset - barW/2;
      const by = pad.t + chartH - h;
      ctx.globalAlpha = alpha * (isHit ? 1 : 0.9);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(bx,by,barW,h,3) : ctx.rect(bx,by,barW,h);
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    drawBar(d.sales,       '#3BB888', -barW-2);
    drawBar(d.vehicleCost, '#6b7280', 0);
    const profit = (d.sales||0) - (d.vehicleCost||0);
    if(profit>0) drawBar(profit, '#f59e0b', barW+2);

    // X軸ラベル
    ctx.globalAlpha = 1;
    ctx.fillStyle = isHit ? '#0D4A3A' : (rptView==='annual' && i===rptMonth ? '#0D4A3A' : (isForecast ? '#d1d5db' : '#6b7280'));
    ctx.font = (isHit || (rptView==='annual' && i===rptMonth)) ? 'bold 10px Noto Sans JP' : '10px Noto Sans JP';
    ctx.textAlign = 'center';
    ctx.fillText(d.m, x, H-8);
  });
}

function _drawTooltip(canvas, d, idx, W, H, pad, step, maxVal, chartH) {
  const ctx = canvas.getContext('2d');
  const profit = (d.sales||0) - (d.vehicleCost||0);
  const margin = d.sales ? (profit/d.sales*100).toFixed(1) : '0.0';
  const lines = [
    {label:'売上',   val:'¥'+fmt(d.sales||0),       color:'#3BB888'},
    {label:'コスト', val:'¥'+fmt(d.vehicleCost||0),  color:'#6b7280'},
    {label:'利益',   val:'¥'+fmt(profit),             color:'#f59e0b'},
    {label:'利益率', val:margin+'%',                  color:'#0D4A3A'},
  ];

  const TW = 168, TH = 18 + lines.length * 22 + 8;
  const cx = pad.l + idx * step + step/2;
  // tooltip X位置（右に出すが画面端で折り返し）
  let tx = cx + 10;
  if(tx + TW > W - 4) tx = cx - TW - 10;
  // Y位置
  let ty = pad.t + 4;

  // 影
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur  = 10;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#0D4A3A';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(tx, ty, TW, TH, 8) : ctx.rect(tx, ty, TW, TH);
  ctx.fill();
  ctx.restore();

  // ヘッダー
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px Noto Sans JP, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(d.m + (d.forecast?' (見込み)':''), tx+10, ty+14);

  // 区切り線
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tx+8, ty+20); ctx.lineTo(tx+TW-8, ty+20);
  ctx.stroke();

  // 各行
  lines.forEach((l,i)=>{
    const ly = ty + 34 + i*22;
    // ドット
    ctx.fillStyle = l.color;
    ctx.beginPath();
    ctx.arc(tx+14, ly-4, 4, 0, Math.PI*2);
    ctx.fill();
    // ラベル
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(l.label, tx+24, ly);
    // 値
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(l.val, tx+TW-10, ly);
  });
}

// ── コスト内訳 ──
function renderCostBreakdown(vehicleCosts) {
  const cats = [
    {key:'fuel',  label:'燃料費',   color:'#0D4A3A'},
    {key:'maint', label:'整備・修理',color:'#3BB888'},
    {key:'ins',   label:'保険・税金',color:'#6b7280'},
    {key:'other', label:'その他',   color:'#e5e7eb'},
  ];
  const totals = {};
  cats.forEach(c=>{ totals[c.key] = vehicleCosts.reduce((s,v)=>s+(v[c.key]||0),0); });
  const grand = Object.values(totals).reduce((a,b)=>a+b,0)||1;

  document.getElementById('rpt-cost-breakdown').innerHTML = cats.map(c=>`
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="width:8px;height:8px;background:${c.color};border-radius:2px;display:inline-block"></span>
          <span style="font-size:12px;color:var(--text-primary);font-weight:500">${c.label}</span>
        </div>
        <span style="font-size:12px;font-family:'Inter',sans-serif;font-weight:700;color:#111827">¥${fmt(totals[c.key])}</span>
      </div>
      <div class="cost-bar-wrap">
        <div class="cost-bar-fill" style="width:${(totals[c.key]/grand*100).toFixed(1)}%;background:${c.color}"></div>
      </div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:2px;text-align:right">${(totals[c.key]/grand*100).toFixed(1)}%</div>
    </div>
  `).join('') + `
    <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);display:flex;justify-content:space-between">
      <span style="font-size:12px;font-weight:700;color:var(--text-secondary)">合計コスト</span>
      <span style="font-size:14px;font-weight:800;font-family:'Inter',sans-serif;color:#111827">¥${fmt(grand)}</span>
    </div>
  `;
}

// ── 案件テーブル ──
function renderCaseTable(cases, totalCostForPeriod) {
  const totalSales = cases.reduce((s,c)=>s+(c.sales||0),0);
  const totalCost  = cases.reduce((s,c)=>s+(c.fuel||0)+(c.other||0),0);
  const grandCost  = totalCost + totalCostForPeriod;

  document.getElementById('rpt-case-count').textContent = cases.length + '件';
  const patColors = {
    '定期案件':'#0D4A3A','スポット案件':'#2563eb','チャーター案件':'#d97706',
    '緊急案件':'#dc2626','特殊条件案件':'#7c3aed'
  };
  document.getElementById('rpt-case-tbody').innerHTML = cases.map(c=>{
    const cost = (c.fuel||0)+(c.other||0);
    const profit = (c.sales||0) - cost;
    const margin = c.sales ? (profit/c.sales*100).toFixed(1) : '-';
    const pColor = patColors[c.casePattern] || '#6b7280';
    return `<tr>
      <td style="font-family:'Inter',sans-serif;font-size:11px;color:var(--text-secondary)">${c.id}</td>
      <td style="font-weight:600;font-size:12px">${c.client}</td>
      <td><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px;background:${pColor}18;color:${pColor}">${c.casePattern||'-'}</span></td>
      <td style="font-size:12px;color:var(--text-secondary)">${c.completion||'-'}</td>
      <td style="text-align:right;font-family:'Inter',sans-serif;font-weight:700;color:#111827">¥${fmt(c.sales||0)}</td>
      <td style="text-align:right;font-family:'Inter',sans-serif;color:#6b7280">¥${fmt(cost)}</td>
      <td style="text-align:right;font-family:'Inter',sans-serif;font-weight:700;color:${profit>=0?'#16a34a':'#dc2626'}">¥${fmt(profit)}</td>
      <td style="text-align:right;font-family:'Inter',sans-serif;color:#6b7280">${margin}%</td>
      <td><span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;background:${c.paid?'#f0fdf4':'#fffbeb'};color:${c.paid?'#16a34a':'#d97706'}">${c.paid?'入金済':'未入金'}</span></td>
    </tr>`;
  }).join('');
  document.getElementById('rpt-case-tfoot').innerHTML = `
    <td colspan="4" style="font-weight:700;font-size:12px">合計（${cases.length}件）</td>
    <td style="text-align:right;font-family:'Inter',sans-serif">¥${fmt(totalSales)}</td>
    <td style="text-align:right;font-family:'Inter',sans-serif">¥${fmt(totalCost)}</td>
    <td style="text-align:right;font-family:'Inter',sans-serif">¥${fmt(totalSales-totalCost)}</td>
    <td style="text-align:right;font-family:'Inter',sans-serif">${totalSales?(((totalSales-totalCost)/totalSales)*100).toFixed(1):0}%</td>
    <td></td>
  `;
}

// ── 車両テーブル ──
function renderVehicleTable(vehicleCosts, monthLabel) {
  document.getElementById('rpt-vehicle-label').textContent = monthLabel;
  const totalFuel  = vehicleCosts.reduce((s,v)=>s+(v.fuel||0),0);
  const totalMaint = vehicleCosts.reduce((s,v)=>s+(v.maint||0),0);
  const totalIns   = vehicleCosts.reduce((s,v)=>s+(v.ins||0),0);
  const totalOther = vehicleCosts.reduce((s,v)=>s+(v.other||0),0);
  const grandTotal = vehicleCosts.reduce((s,v)=>s+(v.total||0),0);

  document.getElementById('rpt-vehicle-tbody').innerHTML = vehicleCosts.map(v=>`
    <tr>
      <td style="font-family:'Inter',sans-serif;font-weight:700;color:#0D4A3A">${v.id}</td>
      <td style="font-size:12px">${v.type}</td>
      <td style="font-size:12px">${v.driver}</td>
      <td style="text-align:left;font-family:'Inter',sans-serif">¥${fmt(v.fuel)}</td>
      <td style="text-align:left;font-family:'Inter',sans-serif">¥${fmt(v.maint)}</td>
      <td style="text-align:left;font-family:'Inter',sans-serif">¥${fmt(v.ins)}</td>
      <td style="text-align:left;font-family:'Inter',sans-serif">¥${fmt(v.other)}</td>
      <td style="text-align:right;font-family:'Inter',sans-serif;font-weight:800;color:#111827">¥${fmt(v.total)}</td>
    </tr>
  `).join('');
  document.getElementById('rpt-vehicle-tfoot').innerHTML = `
    <td colspan="3" style="font-weight:700;font-size:12px">合計（${vehicleCosts.length}台）</td>
    <td>¥${fmt(totalFuel)}</td>
    <td>¥${fmt(totalMaint)}</td>
    <td>¥${fmt(totalIns)}</td>
    <td>¥${fmt(totalOther)}</td>
    <td style="text-align:right;font-family:'Inter',sans-serif">¥${fmt(grandTotal)}</td>
  `;
}

// ── 当月見込み ──
function renderForecast() {
  const processingCount = (typeof processingCases !== 'undefined') ? processingCases.length : 6;
  const avgSalesPerCase = 45000;
  const forecastSales = MONTHLY_DATA[4].sales + processingCount * avgSalesPerCase;
  const forecastCost  = MONTHLY_DATA[4].vehicleCost + processingCount * 12000;
  const forecastProfit = forecastSales - forecastCost;
  const forecastMargin = (forecastProfit/forecastSales*100).toFixed(1);
  const progress = 62; // 月の進捗率

  document.getElementById('rpt-forecast-body').innerHTML = [
    {label:'見込み売上', val:'¥'+fmt(forecastSales), sub:'処理中'+processingCount+'件含む', color:'#0D4A3A'},
    {label:'見込みコスト', val:'¥'+fmt(forecastCost), sub:'車両コスト含む', color:'#0D4A3A'},
    {label:'見込み粗利益', val:'¥'+fmt(forecastProfit), sub:'', color:'#0D4A3A'},
    {label:'見込み利益率', val:forecastMargin+'%', sub:'月進捗 '+progress+'%', color:'#0D4A3A'},
  ].map(k=>`
    <div style="background:var(--accent-pale);border:1px solid #b6e0d0;border-radius:10px;padding:14px 16px;border-left:4px solid #0D4A3A">
      <div style="font-size:10px;color:#0D4A3A;font-weight:700;letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px">${k.label}</div>
      <div style="font-size:22px;font-weight:800;font-family:'Inter',sans-serif;color:#0D4A3A;margin-bottom:2px">${k.val}</div>
      <div style="font-size:11px;color:#3BB888">${k.sub}</div>
    </div>
  `).join('');
}

// ── 月タブ描画 ──
function renderMonthTabs() {
  const tab = document.getElementById('rpt-month-tabs');
  if(rptView !== 'monthly'){ tab.style.display='none'; return; }
  tab.style.display='flex';
  tab.innerHTML = MONTHLY_DATA.map((d,i)=>`
    <button onclick="selectMonth(${i})" style="
      padding:8px 14px; border:none; cursor:pointer; font-size:12px; font-weight:${i===rptMonth?'700':'500'};
      border-bottom:3px solid ${i===rptMonth?'#0D4A3A':'transparent'};
      background:transparent; color:${i===rptMonth?'#0D4A3A':(d.forecast?'#d1d5db':'#6b7280')};
      white-space:nowrap; transition:all .18s;
    ">${d.m}${d.forecast?' (見込)':''}</button>
  `).join('');
}

window.selectMonth = function(i){
  rptMonth = i;
  renderReport();
};
window.setReportView = function(v){
  rptView = v;
  document.getElementById('rpt-view-monthly').style.cssText = v==='monthly'
    ? 'padding:5px 14px;border-radius:6px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:#fff;color:var(--text-primary);box-shadow:0 1px 3px rgba(0,0,0,.1)'
    : 'padding:5px 14px;border-radius:6px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:transparent;color:var(--text-secondary)';
  document.getElementById('rpt-view-annual').style.cssText = v==='annual'
    ? 'padding:5px 14px;border-radius:6px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:#fff;color:var(--text-primary);box-shadow:0 1px 3px rgba(0,0,0,.1)'
    : 'padding:5px 14px;border-radius:6px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:transparent;color:var(--text-secondary)';
  document.getElementById('rpt-chart-title').textContent = v==='annual' ? '年次収支グラフ（2025年）' : '月次収支グラフ';
  renderReport();
};

window.renderReport = function(){
  const mi = rptView === 'annual' ? 4 : rptMonth;
  const d  = MONTHLY_DATA[mi];
  const sales = d.sales || 0;
  const vcosts = getVehicleCosts(mi);
  const totalVehicleCost = vcosts.reduce((s,v)=>s+(v.total||0),0);
  const casesData = getCasesForMonth(mi);
  const caseSalesCost = casesData.reduce((s,c)=>s+(c.fuel||0)+(c.other||0),0);
  const totalCost  = totalVehicleCost;
  const profit = sales - totalCost;
  const margin = sales ? profit/sales*100 : 0;

  renderMonthTabs();
  renderKPICards(sales, totalCost, profit, margin);

  const chartData = rptView === 'annual' ? MONTHLY_DATA : MONTHLY_DATA.slice(Math.max(0,mi-2), mi+4);
  requestAnimationFrame(()=>{ drawChart(chartData); });

  renderCostBreakdown(vcosts);
  renderCaseTable(casesData, totalVehicleCost);
  renderVehicleTable(vcosts, MONTHLY_DATA[mi].m);

  // 当月見込みは月次5月のみ表示（または年次は常時）
  const fcastEl = document.getElementById('rpt-forecast-section');
  if(rptView==='annual' || mi===4) {
    fcastEl.style.display='block';
    renderForecast();
  } else {
    fcastEl.style.display='none';
  }
};

// ── showPage hookにレポート描画を追加 ──
const _origShowPage = window.showPage;
window.showPage = function(name){
  _origShowPage(name);
  if(name==='report'){
    setTimeout(()=>renderReport(), 50);
  }
};

})();