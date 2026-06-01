// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ダッシュボード JS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let dbCharts = {};
let dbEditMode = false;
let dbLayout = null; // 保存済みレイアウト（一時）
let dbPendingLayout = null; // 確定前レイアウト

// ── カード定義 ──
// col: 12カラムグリッドでのデフォルト幅
const DB_CARDS = [
  // 行1: オペレーション（4+5+3=12）
  { id:'donut',    col:4, label:'ステータス別案件数' },
  { id:'hourly',   col:5, label:'時間帯別 受注・架電数推移' },
  { id:'waiting',  col:3, label:'協力会社 返答待ち' },
  // 行2: 稼働率・収益（3+4+5=12）
  { id:'gauge',    col:3, label:'自社車両稼働率' },
  { id:'pie',      col:4, label:'荷主別売上構成比' },
  { id:'revenue',  col:5, label:'売上 vs 庸車費 推移' },
  // 行3: コンプライアンス（4+4+4=12）
  { id:'labor',    col:4, label:'労働時間アラート' },
  { id:'histogram',col:4, label:'連続運転時間 分布' },
  { id:'trouble',  col:4, label:'トラブル・遅延発生率' },
];

// カードのHTMLを返す
const DRAG_HANDLE_SVG = `<span class="db-drag-handle" title="ドラッグして移動"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="5" r="1.2" fill="#0D4A3A"/><circle cx="15" cy="5" r="1.2" fill="#0D4A3A"/><circle cx="9" cy="12" r="1.2" fill="#0D4A3A"/><circle cx="15" cy="12" r="1.2" fill="#0D4A3A"/><circle cx="9" cy="19" r="1.2" fill="#0D4A3A"/><circle cx="15" cy="19" r="1.2" fill="#0D4A3A"/></svg></span>`;

function getCardHTML(card) {
  const id = card.id;

  if (id === 'donut') return `
    <div class="db-card-header">
      ${DRAG_HANDLE_SVG}
      <span class="db-card-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0D4A3A" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg></span>
      <span class="db-card-title">ステータス別案件数</span>
      <span class="db-card-badge" style="background:rgba(13,74,58,0.15);color:#0D4A3A;display:none" id="db-unprocessed-warn">⚠ 未処理過多</span>
    </div>
    <div style="flex:1;display:flex;align-items:center;gap:14px;padding:12px 14px">
      <div style="position:relative;width:100px;height:100px;flex-shrink:0">
        <canvas id="db-donut" width="100" height="100"></canvas>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;line-height:1.2">
          <div style="font-family:'Inter',sans-serif;font-size:20px;font-weight:700;color:#111827" id="db-donut-total">41</div>
          <div style="font-size:10px;color:#9ca3af">総件数</div>
        </div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:6px" id="db-donut-legend">
        <div class="db-legend-row"><span class="db-legend-dot" style="background:#374151"></span><span class="db-legend-lbl">未処理</span><span class="db-legend-val">12</span></div>
        <div class="db-legend-row"><span class="db-legend-dot" style="background:#6b7280"></span><span class="db-legend-lbl">処理中</span><span class="db-legend-val">6</span></div>
        <div class="db-legend-row"><span class="db-legend-dot" style="background:#0D4A3A"></span><span class="db-legend-lbl">配車確定</span><span class="db-legend-val">8</span></div>
        <div class="db-legend-row"><span class="db-legend-dot" style="background:#1a5c4a"></span><span class="db-legend-lbl">運行中</span><span class="db-legend-val">7</span></div>
        <div class="db-legend-row"><span class="db-legend-dot" style="background:#d1d5db"></span><span class="db-legend-lbl">完了</span><span class="db-legend-val">8</span></div>
      </div>
    </div>`;

  if (id === 'hourly') return `
    <div class="db-card-header">
      ${DRAG_HANDLE_SVG}
      <span class="db-card-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0D4A3A" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></span>
      <span class="db-card-title">時間帯別 受注・架電数推移</span>
    </div>
    <div style="flex:1;padding:10px 14px 12px;min-height:0;display:flex;flex-direction:column">
      <canvas id="db-hourly-bar" style="flex:1;width:100%;min-height:0"></canvas>
    </div>`;

  if (id === 'waiting') return `
    <div class="db-card-header">
      ${DRAG_HANDLE_SVG}
      <span class="db-card-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0D4A3A" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
      <span class="db-card-title">協力会社 返答待ち</span>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;min-height:0">
      <div style="flex:1;overflow-y:auto;padding:10px 12px 6px;display:flex;flex-direction:column;gap:6px" id="db-waiting-list">
        <div class="db-waiting-row db-waiting-over"><div class="db-waiting-company">東関東トラック㈱</div><div class="db-waiting-case">川崎→静岡 電子部品</div><div class="db-waiting-time">4時間経過 <span class="db-waiting-badge red">期限超過</span></div></div>
        <div class="db-waiting-row db-waiting-over"><div class="db-waiting-company">千葉運輸㈱</div><div class="db-waiting-case">船橋→大田区 冷蔵</div><div class="db-waiting-time">3時間経過 <span class="db-waiting-badge red">期限超過</span></div></div>
        <div class="db-waiting-row db-waiting-warn"><div class="db-waiting-company">横浜物流㈱</div><div class="db-waiting-case">横浜→名古屋 機械部品</div><div class="db-waiting-time">2時間経過 <span class="db-waiting-badge orange">要催促</span></div></div>
        <div class="db-waiting-row"><div class="db-waiting-company">埼玉急便㈱</div><div class="db-waiting-case">川口→横浜 パレット</div><div class="db-waiting-time">45分経過 <span class="db-waiting-badge gray">待機中</span></div></div>
      </div>
      <div style="padding:6px 12px 10px;border-top:1px solid #e5e7eb;flex-shrink:0">
        <button class="btn btn-secondary btn-sm" style="font-size:11px;width:100%" onclick="showPage('cases')">全件確認 →</button>
      </div>
    </div>`;

  if (id === 'gauge') return `
    <div class="db-card-header">
      ${DRAG_HANDLE_SVG}
      <span class="db-card-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0D4A3A" stroke-width="2.5"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/></svg></span>
      <span class="db-card-title">自社車両稼働率</span>
      <span class="db-card-badge" id="db-utilization-badge" style="background:rgba(13,74,58,0.15);color:#0D4A3A">良好</span>
    </div>
    <div style="flex:1;padding:10px 14px 12px;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;gap:6px">
      <div style="position:relative;width:100%;max-width:150px;height:80px;overflow:hidden;flex-shrink:0">
        <canvas id="db-gauge" style="width:100%;height:100%"></canvas>
        <div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);text-align:center">
          <div style="font-family:'Inter',sans-serif;font-size:22px;font-weight:800;color:#111827" id="db-gauge-val">78%</div>
        </div>
      </div>
      <div style="width:100%;display:grid;grid-template-columns:1fr 1fr;gap:5px;font-size:11px">
        <div style="background:#f3f4f6;border-radius:6px;padding:5px;text-align:center"><div style="color:#0D4A3A;font-weight:700;font-family:'Inter',sans-serif;font-size:14px">7</div><div style="color:#9ca3af;font-size:10px">運行中</div></div>
        <div style="background:#f3f4f6;border-radius:6px;padding:5px;text-align:center"><div style="font-weight:700;font-family:'Inter',sans-serif;font-size:14px;color:#374151">4</div><div style="color:#9ca3af;font-size:10px">配車済み</div></div>
        <div style="background:#f3f4f6;border-radius:6px;padding:5px;text-align:center"><div style="font-weight:700;font-family:'Inter',sans-serif;font-size:14px;color:#374151">5</div><div style="color:#9ca3af;font-size:10px">空車</div></div>
        <div style="background:#f3f4f6;border-radius:6px;padding:5px;text-align:center"><div style="color:#6b7280;font-weight:700;font-family:'Inter',sans-serif;font-size:14px">2</div><div style="color:#9ca3af;font-size:10px">整備中</div></div>
      </div>
    </div>`;

  if (id === 'pie') return `
    <div class="db-card-header">
      ${DRAG_HANDLE_SVG}
      <span class="db-card-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0D4A3A" stroke-width="2.5"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg></span>
      <span class="db-card-title">荷主別売上構成比</span>
    </div>
    <div style="flex:1;display:flex;align-items:center;gap:12px;padding:10px 14px 12px">
      <div style="flex-shrink:0"><canvas id="db-pie" width="100" height="100"></canvas></div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:space-evenly;height:100%;gap:4px;font-size:11px">
        <div class="db-legend-row"><span class="db-legend-dot" style="background:#0D4A3A"></span><span class="db-legend-lbl">㈱○○商事</span><span class="db-legend-val">32%</span></div>
        <div class="db-legend-row"><span class="db-legend-dot" style="background:#1a5c4a"></span><span class="db-legend-lbl">△△食品㈱</span><span class="db-legend-val">22%</span></div>
        <div class="db-legend-row"><span class="db-legend-dot" style="background:#374151"></span><span class="db-legend-lbl">南関東物流㈱</span><span class="db-legend-val">18%</span></div>
        <div class="db-legend-row"><span class="db-legend-dot" style="background:#6b7280"></span><span class="db-legend-lbl">□□製作所</span><span class="db-legend-val">14%</span></div>
        <div class="db-legend-row"><span class="db-legend-dot" style="background:#9ca3af"></span><span class="db-legend-lbl">◇◇アパレル</span><span class="db-legend-val">9%</span></div>
        <div class="db-legend-row"><span class="db-legend-dot" style="background:#d1d5db"></span><span class="db-legend-lbl">その他</span><span class="db-legend-val">5%</span></div>
      </div>
    </div>`;

  if (id === 'revenue') return `
    <div class="db-card-header">
      ${DRAG_HANDLE_SVG}
      <span class="db-card-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0D4A3A" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></span>
      <span class="db-card-title">売上 vs 庸車費 推移（直近7日）</span>
    </div>
    <div style="flex:1;padding:10px 14px 12px;min-height:0;display:flex;flex-direction:column">
      <canvas id="db-revenue-line" style="flex:1;width:100%;min-height:0"></canvas>
    </div>`;

  if (id === 'labor') return `
    <div class="db-card-header">
      ${DRAG_HANDLE_SVG}
      <span class="db-card-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0D4A3A" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
      <span class="db-card-title">労働時間アラート（2024年問題対応）</span>
    </div>
    <div style="flex:1;padding:10px 14px 12px;display:flex;flex-direction:column;justify-content:space-evenly" id="db-labor-list">
      <div class="db-labor-row"><div class="db-labor-driver"><div class="db-labor-name">中村 六太</div><div class="db-labor-vehicle">車両3312</div></div><div class="db-labor-bar-wrap"><div class="db-labor-bar-bg"><div class="db-labor-bar-fill" style="width:94%;background:#374151"></div></div><div class="db-labor-hr" style="color:#374151;font-weight:700">62h / 65h</div></div><span class="db-labor-badge red">⚠ 危険</span></div>
      <div class="db-labor-row"><div class="db-labor-driver"><div class="db-labor-name">鈴木 次郎</div><div class="db-labor-vehicle">車両1123</div></div><div class="db-labor-bar-wrap"><div class="db-labor-bar-bg"><div class="db-labor-bar-fill" style="width:87%;background:#6b7280"></div></div><div class="db-labor-hr" style="color:#6b7280;font-weight:600">56h / 65h</div></div><span class="db-labor-badge orange">注意</span></div>
      <div class="db-labor-row"><div class="db-labor-driver"><div class="db-labor-name">佐藤 三郎</div><div class="db-labor-vehicle">車両1356</div></div><div class="db-labor-bar-wrap"><div class="db-labor-bar-bg"><div class="db-labor-bar-fill" style="width:79%;background:#9ca3af"></div></div><div class="db-labor-hr" style="color:#6b7280">51h / 65h</div></div><span class="db-labor-badge yellow">要注意</span></div>
      <div class="db-labor-row"><div class="db-labor-driver"><div class="db-labor-name">山田 一郎</div><div class="db-labor-vehicle">車両1245</div></div><div class="db-labor-bar-wrap"><div class="db-labor-bar-bg"><div class="db-labor-bar-fill" style="width:62%;background:#0D4A3A"></div></div><div class="db-labor-hr" style="color:#9ca3af">40h / 65h</div></div><span class="db-labor-badge green">良好</span></div>
      <div class="db-labor-row"><div class="db-labor-driver"><div class="db-labor-name">伊藤 五郎</div><div class="db-labor-vehicle">車両2201</div></div><div class="db-labor-bar-wrap"><div class="db-labor-bar-bg"><div class="db-labor-bar-fill" style="width:55%;background:#3BB888"></div></div><div class="db-labor-hr">36h / 65h</div></div><span class="db-labor-badge green">良好</span></div>
    </div>`;

  if (id === 'histogram') return `
    <div class="db-card-header">
      ${DRAG_HANDLE_SVG}
      <span class="db-card-icon" style="background:#fff7ed">🛣</span>
      <span class="db-card-title">連続運転時間 分布</span>
    </div>
    <div style="flex:1;padding:10px 14px 4px;min-height:0;display:flex;flex-direction:column">
      <canvas id="db-histogram" style="flex:1;width:100%;min-height:0"></canvas>
    </div>
    <div style="padding:4px 14px 10px;font-size:10px;color:var(--text-muted)">※ 4時間以上は法令上の義務休憩が必要</div>`;

  if (id === 'trouble') return `
    <div class="db-card-header">
      ${DRAG_HANDLE_SVG}
      <span class="db-card-icon" style="background:#fef2f2">🚨</span>
      <span class="db-card-title">トラブル・遅延発生率 トレンド</span>
    </div>
    <div style="flex:1;padding:10px 14px 6px;min-height:0;display:flex;flex-direction:column">
      <canvas id="db-trouble-trend" style="flex:1;width:100%;min-height:0"></canvas>
    </div>
    <div style="padding:0 14px 10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:11px">
      <div style="text-align:center;background:#fef2f2;border-radius:6px;padding:5px"><div style="font-weight:700;font-family:'Inter',sans-serif;color:var(--red);font-size:13px">3</div><div style="color:var(--text-muted);font-size:10px">今週遅延</div></div>
      <div style="text-align:center;background:#fff7ed;border-radius:6px;padding:5px"><div style="font-weight:700;font-family:'Inter',sans-serif;color:#f97316;font-size:13px">1</div><div style="color:var(--text-muted);font-size:10px">車両故障</div></div>
      <div style="text-align:center;background:#f0fdf4;border-radius:6px;padding:5px"><div style="font-weight:700;font-family:'Inter',sans-serif;color:#16a34a;font-size:13px">5.2%</div><div style="color:var(--text-muted);font-size:10px">遅延率</div></div>
    </div>`;

  return '';
}

// ── グリッドレンダリング ──
function renderDbGrid() {
  const grid = document.getElementById('db-card-grid');
  if (!grid) return;
  const layout = dbLayout || DB_CARDS;
  grid.innerHTML = '';
  layout.forEach(card => {
    const wrapper = document.createElement('div');
    wrapper.className = 'db-grid-item';
    wrapper.dataset.cardId = card.id;
    wrapper.dataset.col = String(card.col);
    wrapper.setAttribute('data-col', String(card.col));
    // CSSセレクタに依存せずstyleで直接指定（確実性のため）
    wrapper.style.gridColumn = 'span ' + card.col;

    const inner = document.createElement('div');
    inner.className = 'db-card';
    inner.innerHTML = getCardHTML(card);

    // リサイズハンドル
    const resizeBtn = document.createElement('div');
    resizeBtn.className = 'db-resize-handle';
    resizeBtn.title = 'サイズ変更';
    resizeBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
    resizeBtn.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); });
    resizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSizePicker(wrapper, card);
    });

    wrapper.appendChild(inner);
    wrapper.appendChild(resizeBtn);
    grid.appendChild(wrapper);

    // ドラッグ設定
    setupDragItem(wrapper);
  });
}

// ── ドラッグ＆ドロップ（中心座標比較方式） ──
let dragSrc      = null;
let dragGhost    = null;
let dragOverItem = null;

function setupDragItem(el) {
  const handle = el.querySelector('.db-drag-handle');
  if (!handle) return;

  handle.addEventListener('mousedown', e => {
    if (!dbEditMode) return;
    e.preventDefault();
    e.stopPropagation();

    dragSrc = el;

    // ゴースト生成
    const rect = el.getBoundingClientRect();
    const title = el.querySelector('.db-card-title');
    dragGhost = document.createElement('div');
    dragGhost.style.cssText = [
      'position:fixed',
      `top:${rect.top}px`,
      `left:${rect.left}px`,
      `width:${rect.width}px`,
      'height:44px',
      'opacity:0.9',
      'pointer-events:none',
      'z-index:99999',
      'border-radius:8px',
      'border:2px solid #3BB888',
      'background:#d1fae5',
      'box-shadow:0 6px 24px rgba(13,74,58,0.3)',
      'display:flex',
      'align-items:center',
      'padding:0 14px',
      'gap:8px',
      'font-size:12px',
      'font-weight:600',
      'color:#065f46',
      'white-space:nowrap',
      'overflow:hidden',
    ].join(';');
    dragGhost.textContent = '↔ ' + (title ? title.textContent : 'カード移動中');
    document.body.appendChild(dragGhost);

    el.style.opacity = '0.2';
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    const offX = e.clientX - rect.left;
    const offY = e.clientY - rect.top;

    function getClosestItem(mx, my) {
      const grid = document.getElementById('db-card-grid');
      if (!grid) return null;
      let closest = null;
      let minDist = Infinity;
      grid.querySelectorAll('.db-grid-item').forEach(item => {
        if (item === dragSrc) return;
        const r = item.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top  + r.height / 2;
        const dist = Math.hypot(mx - cx, my - cy);
        if (dist < minDist) { minDist = dist; closest = item; }
      });
      // 遠すぎる場合はnull（300px以上離れていたらターゲットなし）
      return minDist < 300 ? closest : null;
    }

    function onMove(ev) {
      dragGhost.style.left = (ev.clientX - offX) + 'px';
      dragGhost.style.top  = (ev.clientY - offY) + 'px';

      const hit = getClosestItem(ev.clientX, ev.clientY);
      if (hit !== dragOverItem) {
        if (dragOverItem) {
          dragOverItem.style.outline = '';
          dragOverItem.style.background = '';
        }
        dragOverItem = hit;
        if (dragOverItem) {
          dragOverItem.style.outline = '2px solid #3BB888';
          dragOverItem.style.background = '#eaf5f0';
        }
      }
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);

      if (dragGhost) { dragGhost.remove(); dragGhost = null; }
      if (dragSrc)   { dragSrc.style.opacity = ''; }
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      if (dragOverItem) {
        dragOverItem.style.outline = '';
        dragOverItem.style.background = '';
      }

      // 入れ替え
      if (dragOverItem && dragOverItem !== dragSrc) {
        const grid  = document.getElementById('db-card-grid');
        const items = [...grid.querySelectorAll('.db-grid-item')];
        const si = items.indexOf(dragSrc);
        const ti = items.indexOf(dragOverItem);
        if (si !== -1 && ti !== -1) {
          if (si < ti) dragOverItem.after(dragSrc);
          else         dragOverItem.before(dragSrc);
          // gridColumn 再適用
          grid.querySelectorAll('.db-grid-item').forEach(item => {
            item.style.gridColumn = 'span ' + (item.dataset.col || 4);
          });
          syncLayoutFromDOM();
        }
      }

      dragSrc      = null;
      dragOverItem = null;
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}

function syncLayoutFromDOM() {
  const grid = document.getElementById('db-card-grid');
  if (!grid) return;
  const base = dbLayout || DB_CARDS;
  dbLayout = [...grid.querySelectorAll('.db-grid-item')].map(el => {
    const found = base.find(c => c.id === el.dataset.cardId) || {};
    return { id: el.dataset.cardId, col: parseInt(el.dataset.col) || 4, label: found.label || el.dataset.cardId };
  });
}

// ── サイズ変更ピッカー ──
let activePicker = null;
function openSizePicker(wrapper, card) {
  closeSizePicker();
  const sizes = [
    { label: '小（幅1/3）', col: 4 },
    { label: '中（幅5/12）', col: 5 },
    { label: '中大（幅1/2）', col: 6 },
    { label: '大（幅7/12）', col: 7 },
    { label: '特大（幅2/3）', col: 8 },
    { label: '全幅（幅100%）', col: 12 },
  ];
  const picker = document.createElement('div');
  picker.className = 'db-size-picker';
  picker.innerHTML = `<div class="db-size-picker-label">カードサイズ</div>`;
  sizes.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'db-size-btn' + (card.col === s.col ? ' active' : '');
    btn.textContent = s.label;
    btn.onclick = (e) => {
      e.stopPropagation();
      card.col = s.col;
      wrapper.dataset.col = String(s.col);
      wrapper.setAttribute('data-col', String(s.col));
      wrapper.style.gridColumn = 'span ' + s.col;
      syncLayoutFromDOM();
      closeSizePicker();
      // チャートを再描画
      setTimeout(() => redrawAllCharts(), 60);
    };
    picker.appendChild(btn);
  });
  wrapper.appendChild(picker);
  activePicker = picker;
  setTimeout(() => document.addEventListener('click', closeSizePicker, { once: true }), 10);
}
function closeSizePicker() {
  if (activePicker) { activePicker.remove(); activePicker = null; }
}

// ── 編集モード ON/OFF ──
function toggleDbEdit() {
  if (!dbEditMode) {
    // 編集モード ON
    dbEditMode = true;
    document.getElementById('db-card-grid').classList.add('db-edit-mode');
    document.getElementById('db-edit-banner').style.display = 'flex';
    document.getElementById('db-edit-btn').style.display = 'none';
    document.getElementById('db-refresh-btn').disabled = true;
    document.getElementById('db-refresh-btn').style.opacity = '0.4';
  } else {
    // 確定ボタン押下：モーダル表示
    dbPendingLayout = JSON.parse(JSON.stringify(dbLayout || DB_CARDS));
    syncLayoutFromDOM();
    dbPendingLayout = JSON.parse(JSON.stringify(dbLayout));
    showDbConfirmModal();
  }
}

function showDbConfirmModal() {
  const layout = dbPendingLayout || [];
  const sizeLabels = {4:'小（幅1/3）',5:'中（幅5/12）',6:'中大（幅1/2）',7:'大（幅7/12）',8:'特大（幅2/3）',12:'全幅'};
  const lines = layout.map((c,i) => `${i+1}. ${c.label}（${sizeLabels[c.col] || c.col+'列'}）`).join('<br>');
  document.getElementById('db-confirm-summary-text').innerHTML = lines;
  document.getElementById('db-confirm-modal').style.display = 'flex';
}

function closeDbConfirmModal() {
  document.getElementById('db-confirm-modal').style.display = 'none';
}

function commitDbLayout() {
  // レイアウトを確定保存
  dbLayout = JSON.parse(JSON.stringify(dbPendingLayout));
  closeDbConfirmModal();
  exitEditMode();
  showToast('レイアウトを保存しました ✓', 'success');
}

function exitEditMode() {
  dbEditMode = false;
  document.getElementById('db-card-grid').classList.remove('db-edit-mode');
  document.getElementById('db-edit-banner').style.display = 'none';
  document.getElementById('db-edit-btn').style.display = '';
  document.getElementById('db-refresh-btn').disabled = false;
  document.getElementById('db-refresh-btn').style.opacity = '';
  closeSizePicker();
  setTimeout(() => redrawAllCharts(), 80);
}

// ── チャートを全部再描画 ──
function redrawAllCharts() {
  Object.values(dbCharts).forEach(c => { try { c.destroy(); } catch(e){} });
  dbCharts = {};
  drawDonut(); drawHourlyBar(); drawGauge(); drawPie(); drawRevenueLine(); drawHistogram(); drawTroubleTrend();
}

function initDashboard() {
  // 日付ラベル
  const now = new Date();
  const label = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日（${['日','月','火','水','木','金','土'][now.getDay()]}）`;
  const el = document.getElementById('db-date-label');
  if (el) el.textContent = label;

  // 既存チャートを破棄
  Object.values(dbCharts).forEach(c => { try { c.destroy(); } catch(e){} });
  dbCharts = {};

  // 編集モードを解除してグリッドを描画
  dbEditMode = false;
  const banner = document.getElementById('db-edit-banner');
  const editBtn = document.getElementById('db-edit-btn');
  const refreshBtn = document.getElementById('db-refresh-btn');
  const grid = document.getElementById('db-card-grid');
  if (banner) banner.style.display = 'none';
  if (editBtn) editBtn.style.display = '';
  if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.style.opacity = ''; }
  if (grid) grid.classList.remove('db-edit-mode');

  renderDbGrid();
  setTimeout(() => {
    drawDonut(); drawHourlyBar(); drawGauge(); drawPie();
    drawRevenueLine(); drawHistogram(); drawTroubleTrend();
  }, 30);
}

// ①ドーナツ
function drawDonut() {
  const ctx = document.getElementById('db-donut');
  if (!ctx) return;
  const unprocessed = unprocessedCases.length; // 実データ
  const processing  = processingCases.length;
  const confirmed   = 8;
  const running     = 7;
  const done        = processedCases ? processedCases.length : 8;
  const total = unprocessed + processing + confirmed + running + done;
  document.getElementById('db-donut-total').textContent = total;
  // 未処理過多警告
  const warnEl = document.getElementById('db-unprocessed-warn');
  if (warnEl) warnEl.style.display = unprocessed > 8 ? '' : 'none';

  dbCharts.donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [unprocessed, processing, confirmed, running, done],
        backgroundColor: ['#374151','#6b7280','#0D4A3A','#1a5c4a','#d1d5db'],
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 4
      }]
    },
    options: {
      cutout: '68%',
      plugins: { legend: { display: false }, tooltip: {
        callbacks: {
          label: function(c) {
            const labels = ['未処理','処理中','配車確定','運行中','完了'];
            return ` ${labels[c.dataIndex]}: ${c.raw}件`;
          }
        }
      }},
      animation: { duration: 700 }
    }
  });
  // レジェンド更新
  const vals = [unprocessed, processing, confirmed, running, done];
  const rows = document.querySelectorAll('#db-donut-legend .db-legend-val');
  rows.forEach((r,i) => { if (vals[i] !== undefined) r.textContent = vals[i]; });
  document.getElementById('kpi-unassigned').textContent = unprocessed;
}

// ②時間帯別受注・架電数（積み上げ棒）
function drawHourlyBar() {
  const ctx = document.getElementById('db-hourly-bar');
  if (!ctx) return;
  const hours = ['8','9','10','11','12','13','14','15','16','17','18'];
  const telData  = [1,3,4,2,1,3,2,4,3,2,1];
  const mailData = [0,1,2,3,1,2,1,2,1,1,0];
  const faxData  = [1,1,1,0,0,1,1,0,1,0,0];
  dbCharts.hourly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: hours.map(h => h+'時'),
      datasets: [
        { label:'電話', data: telData,  backgroundColor: '#0D4A3A', borderRadius: 2 },
        { label:'メール', data: mailData, backgroundColor: '#6b7280', borderRadius: 2 },
        { label:'FAX',  data: faxData,  backgroundColor: '#d1d5db', borderRadius: 2 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position:'top', labels:{font:{size:10},boxWidth:10,padding:8} } },
      scales: {
        x: { stacked:true, ticks:{font:{size:9}}, grid:{display:false} },
        y: { stacked:true, ticks:{font:{size:9},stepSize:2}, grid:{color:'#f3f4f6'} }
      },
      animation: { duration: 600 }
    }
  });
}

// ④ゲージ（半円）
function drawGauge() {
  const ctx = document.getElementById('db-gauge');
  if (!ctx) return;
  const utilization = 78; // 7稼働+4配車 / 18台 ≒ 61%、ここは仮78%
  const color = utilization >= 80 ? '#0D4A3A' : utilization >= 65 ? '#374151' : '#6b7280';
  const badgeEl = document.getElementById('db-utilization-badge');
  if (badgeEl) {
    if (utilization >= 80) { badgeEl.style.background='rgba(13,74,58,0.15)'; badgeEl.style.color='#0D4A3A'; badgeEl.textContent='良好'; }
    else if (utilization >= 65) { badgeEl.style.background='rgba(13,74,58,0.2)'; badgeEl.style.color='#0D4A3A'; badgeEl.textContent='要強化'; }
    else { badgeEl.style.background='rgba(13,74,58,0.25)'; badgeEl.style.color='#0D4A3A'; badgeEl.textContent='低稼働'; }
  }
  document.getElementById('db-gauge-val').textContent = utilization + '%';
  document.getElementById('db-gauge-val').style.color = color;
  dbCharts.gauge = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [utilization, 100 - utilization],
        backgroundColor: [color, '#f3f4f6'],
        borderWidth: 0,
        circumference: 180,
        rotation: -90,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: { legend:{display:false}, tooltip:{enabled:false} },
      animation: { duration: 800 }
    }
  });
}

// ⑤荷主別売上円グラフ
function drawPie() {
  const ctx = document.getElementById('db-pie');
  if (!ctx) return;
  dbCharts.pie = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['㈱○○商事','△△食品㈱','南関東物流㈱','□□製作所','◇◇アパレル','その他'],
      datasets: [{
        data: [32,22,18,14,9,5],
        backgroundColor: ['#0D4A3A','#1a5c4a','#374151','#6b7280','#9ca3af','#d1d5db'],
        borderWidth: 2, borderColor: '#fff'
      }]
    },
    options: {
      responsive: false,
      plugins: { legend:{display:false}, tooltip:{
        callbacks:{ label: c => ` ${c.label}: ${c.raw}%` }
      }},
      animation:{duration:700}
    }
  });
}

// ⑥売上vs庸車費折れ線
function drawRevenueLine() {
  const ctx = document.getElementById('db-revenue-line');
  if (!ctx) return;
  const days = ['5/17','5/18','5/19','5/20','5/21','5/22','5/23'];
  const sales  = [1520,1680,1430,1750,1620,1880,1847];
  const subcon = [380, 420, 510, 390, 430, 360, 410];
  dbCharts.revenue = new Chart(ctx, {
    type: 'line',
    data: {
      labels: days,
      datasets: [
        { label:'売上（千円）',  data:sales,  borderColor:'#0D4A3A', backgroundColor:'rgba(13,74,58,0.08)', fill:true, tension:.3, pointRadius:3, borderWidth:2 },
        { label:'庸車費（千円）', data:subcon, borderColor:'#6b7280', backgroundColor:'rgba(107,114,128,0.07)', fill:true, tension:.3, pointRadius:3, borderWidth:2, borderDash:[4,3] },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend:{ position:'top', labels:{font:{size:10},boxWidth:10,padding:8} } },
      scales: {
        x: { ticks:{font:{size:9}}, grid:{display:false} },
        y: { ticks:{font:{size:9},callback:v=>v+'k'}, grid:{color:'#f3f4f6'} }
      },
      animation:{duration:600}
    }
  });
}

// ⑧連続運転時間ヒストグラム
function drawHistogram() {
  const ctx = document.getElementById('db-histogram');
  if (!ctx) return;
  const bins   = ['0-1h','1-2h','2-3h','3-4h','4h+'];
  const counts = [3, 5, 6, 2, 2];
  const colors = ['#0D4A3A','#1a5c4a','#374151','#6b7280','#9ca3af'];
  dbCharts.hist = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: bins,
      datasets: [{
        label:'ドライバー数',
        data: counts,
        backgroundColor: colors,
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend:{display:false},
        tooltip:{ callbacks:{ label:c=>`${c.raw}名` } },
        annotation: {}
      },
      scales: {
        x: { ticks:{font:{size:10}}, grid:{display:false} },
        y: { ticks:{font:{size:9},stepSize:2}, grid:{color:'#f3f4f6'} }
      },
      animation:{duration:600}
    }
  });
}

// ⑨トラブル・遅延トレンド
function drawTroubleTrend() {
  const ctx = document.getElementById('db-trouble-trend');
  if (!ctx) return;
  const weeks = ['W1','W2','W3','W4','W5','W6','今週'];
  const delays = [2,5,3,7,4,3,3];
  const breakdowns = [0,1,0,2,1,0,1];
  dbCharts.trouble = new Chart(ctx, {
    type: 'line',
    data: {
      labels: weeks,
      datasets: [
        { label:'遅延件数', data:delays,     borderColor:'#374151', backgroundColor:'rgba(55,65,81,0.08)', fill:true, tension:.3, pointRadius:3, borderWidth:2 },
        { label:'車両故障', data:breakdowns, borderColor:'#9ca3af', backgroundColor:'rgba(156,163,175,0.08)', fill:true, tension:.3, pointRadius:3, borderWidth:2 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend:{ position:'top', labels:{font:{size:10},boxWidth:10,padding:8} } },
      scales: {
        x: { ticks:{font:{size:9}}, grid:{display:false} },
        y: { ticks:{font:{size:9},stepSize:2}, grid:{color:'#f3f4f6'} }
      },
      animation:{duration:600}
    }
  });
}

function refreshDashboard() {
  initDashboard();
  showToast('ダッシュボードを更新しました', 'success');
}

// 初期ページが dashboard でも動くよう DOMContentLoaded で試みる
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('page-dashboard')?.classList.contains('active')) {
    setTimeout(initDashboard, 100);
  }
});


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  車両・ドライバー管理
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── グローバルデータストア（案件一覧の配車AIと連動） ──
window.vehicleMasterData = [
  { id:'1245', plate:'品川 800 あ 1245', type:'4tウィング', cap:2000, base:'品川区', status:'運行中', inspection:'2025/08/31', fuel:'軽油', note:'', driverName:'山田 一郎', maker:'いすゞ', model:'エルフ NLR85AR', regdate:'2020/04', mileage:95400,
    fuelLogs:[
      {date:'2025/04/28', liters:62.4, amount:10920, odo:95400, note:'品川SS'},
      {date:'2025/04/14', liters:58.1, amount:10165, odo:93200, note:'品川SS'},
      {date:'2025/03/31', liters:65.0, amount:11375, odo:90800, note:'川口IC'},
    ],
    costLogs:[
      {date:'2025/04/01', cat:'自動車税', amount:27500, note:'令和7年度'},
      {date:'2025/03/15', cat:'修理・整備', amount:42000, note:'ブレーキパッド交換'},
      {date:'2025/01/10', cat:'3ヶ月点検', amount:18000, note:'定期'},
    ]
  },
  { id:'1123', plate:'品川 800 い 1123', type:'2tトラック', cap:1000, base:'品川区', status:'空車', inspection:'2025/11/30', fuel:'軽油', note:'', driverName:'鈴木 次郎', maker:'日野', model:'デュトロ XZU600', regdate:'2021/07', mileage:62300,
    fuelLogs:[
      {date:'2025/04/25', liters:38.2, amount:6685, odo:62300, note:'品川SS'},
      {date:'2025/04/10', liters:41.5, amount:7262, odo:60500, note:''},
    ],
    costLogs:[
      {date:'2025/02/20', cat:'任意保険', amount:85000, note:'年間保険料'},
      {date:'2025/01/15', cat:'部品購入', amount:12800, note:'エアフィルター'},
    ]
  },
  { id:'0552', plate:'足立 800 う 0552', type:'冷蔵車', cap:1500, base:'足立区', status:'運行中', inspection:'2025/06/15', fuel:'軽油', note:'冷蔵機能あり', driverName:'渡辺 六郎', maker:'三菱ふそう', model:'キャンター FEA50', regdate:'2019/10', mileage:118700,
    fuelLogs:[
      {date:'2025/04/27', liters:71.8, amount:12565, odo:118700, note:'足立SS'},
      {date:'2025/04/13', liters:69.2, amount:12110, odo:116200, note:'足立SS'},
      {date:'2025/03/28', liters:74.1, amount:12967, odo:113400, note:''},
    ],
    costLogs:[
      {date:'2025/04/05', cat:'車検', amount:185000, note:'2年定期'},
      {date:'2025/03/01', cat:'修理・整備', amount:28000, note:'冷凍機ガス補充'},
      {date:'2025/01/20', cat:'自賠責保険', amount:31680, note:'24ヶ月'},
    ]
  },
  { id:'2580', plate:'品川 800 え 2580', type:'10tトラック', cap:6000, base:'品川区', status:'空車', inspection:'2026/02/28', fuel:'軽油', note:'', driverName:'松本 十郎', maker:'いすゞ', model:'ギガ CYJ77A', regdate:'2022/01', mileage:74200,
    fuelLogs:[
      {date:'2025/04/22', liters:128.5, amount:22487, odo:74200, note:'品川SS'},
      {date:'2025/04/08', liters:135.2, amount:23660, odo:71800, note:'大阪給油'},
    ],
    costLogs:[
      {date:'2025/03/10', cat:'自動車重量税', amount:65600, note:'2年分'},
      {date:'2025/02/15', cat:'3ヶ月点検', amount:32000, note:''},
      {date:'2025/01/05', cat:'部品購入', amount:18500, note:'タイヤ交換（前輪）'},
    ]
  },
  { id:'3301', plate:'福岡 800 お 3301', type:'4tウィング', cap:2000, base:'福岡市', status:'空車', inspection:'2025/09/30', fuel:'軽油', note:'', driverName:'山本 十三', maker:'日野', model:'レンジャー GD7JGAA', regdate:'2021/03', mileage:88900,
    fuelLogs:[
      {date:'2025/04/20', liters:59.8, amount:10465, odo:88900, note:'博多SS'},
      {date:'2025/04/05', liters:63.1, amount:11042, odo:86700, note:''},
    ],
    costLogs:[
      {date:'2025/04/01', cat:'自動車税', amount:27500, note:''},
      {date:'2025/02/28', cat:'修理・整備', amount:15000, note:'ウィング油圧調整'},
    ]
  },
  { id:'5521', plate:'宮城 800 か 5521', type:'4tウィング', cap:2000, base:'仙台市', status:'空車', inspection:'2025/12/31', fuel:'軽油', note:'精密機器対応', driverName:'斉藤 十六', maker:'三菱ふそう', model:'ファイター FK71F', regdate:'2020/09', mileage:102300,
    fuelLogs:[
      {date:'2025/04/24', liters:64.2, amount:11235, odo:102300, note:'仙台SS'},
      {date:'2025/04/09', liters:61.8, amount:10815, odo:100100, note:''},
    ],
    costLogs:[
      {date:'2025/03/20', cat:'その他点検', amount:9800, note:'タコグラフ点検'},
      {date:'2025/01/15', cat:'任意保険', amount:92000, note:'年間'},
    ]
  },
  { id:'0887', plate:'千葉 800 き 0887', type:'冷蔵車', cap:1500, base:'船橋市', status:'空車', inspection:'2025/07/31', fuel:'軽油', note:'食品衛生管理対応', driverName:'田中 四郎', maker:'日野', model:'デュトロ XZU710', regdate:'2019/06', mileage:126500,
    fuelLogs:[
      {date:'2025/04/26', liters:68.4, amount:11970, odo:126500, note:'船橋SS'},
      {date:'2025/04/12', liters:72.1, amount:12617, odo:124100, note:''},
      {date:'2025/03/29', liters:69.8, amount:12215, odo:121500, note:''},
    ],
    costLogs:[
      {date:'2025/04/10', cat:'修理・整備', amount:55000, note:'冷凍機コンプレッサー修理'},
      {date:'2025/02/05', cat:'自賠責保険', amount:31680, note:'24ヶ月'},
      {date:'2025/01/20', cat:'3ヶ月点検', amount:22000, note:''},
    ]
  },
  { id:'1872', plate:'大田 800 く 1872', type:'4tウィング', cap:2000, base:'大田区', status:'空車', inspection:'2025/10/31', fuel:'軽油', note:'', driverName:'高木 十一', maker:'いすゞ', model:'フォワード FRR90S', regdate:'2021/11', mileage:55800,
    fuelLogs:[
      {date:'2025/04/23', liters:55.6, amount:9730, odo:55800, note:'大田SS'},
      {date:'2025/04/07', liters:58.9, amount:10307, odo:53700, note:''},
    ],
    costLogs:[
      {date:'2025/03/25', cat:'部品購入', amount:8200, note:'ワイパーブレード・油脂類'},
      {date:'2025/01/30', cat:'自動車税', amount:27500, note:''},
    ]
  },
  { id:'0934', plate:'品川 800 け 0934', type:'2tトラック', cap:1500, base:'品川区', status:'整備中', inspection:'2025/05/31', fuel:'軽油', note:'車検前点検中', driverName:'藤田 十二', maker:'三菱ふそう', model:'キャンター FEB90', regdate:'2018/12', mileage:144600,
    fuelLogs:[
      {date:'2025/04/15', liters:44.2, amount:7735, odo:144600, note:'品川SS'},
      {date:'2025/03/30', liters:46.8, amount:8190, odo:142400, note:''},
    ],
    costLogs:[
      {date:'2025/04/20', cat:'車検', amount:220000, note:'車検前整備中'},
      {date:'2025/04/20', cat:'修理・整備', amount:68000, note:'エンジンオーバーホール'},
      {date:'2025/02/10', cat:'自動車重量税', amount:41400, note:'2年分'},
    ]
  },
  { id:'2240', plate:'北九州 800 こ 2240', type:'10tトラック', cap:6000, base:'北九州市', status:'空車', inspection:'2026/01/31', fuel:'軽油', note:'', driverName:'中島 十四', maker:'日野', model:'プロフィア FS1EXPA', regdate:'2022/06', mileage:68100,
    fuelLogs:[
      {date:'2025/04/21', liters:142.3, amount:24902, odo:68100, note:'北九州SS'},
      {date:'2025/04/06', liters:138.7, amount:24272, odo:65200, note:'大阪給油'},
    ],
    costLogs:[
      {date:'2025/03/05', cat:'3ヶ月点検', amount:35000, note:''},
      {date:'2025/01/12', cat:'部品購入', amount:24000, note:'タイヤ（後輪2本）'},
    ]
  },
  { id:'4410', plate:'福岡 800 さ 4410', type:'4tウィング', cap:2000, base:'福岡市', status:'空車', inspection:'2025/08/15', fuel:'軽油', note:'', driverName:'小野 十五', maker:'いすゞ', model:'フォワード FRR90', regdate:'2020/02', mileage:91200,
    fuelLogs:[
      {date:'2025/04/19', liters:61.4, amount:10745, odo:91200, note:'博多SS'},
      {date:'2025/04/04', liters:59.2, amount:10360, odo:89100, note:''},
    ],
    costLogs:[
      {date:'2025/02/20', cat:'修理・整備', amount:22000, note:'クラッチ調整'},
      {date:'2025/01/10', cat:'任意保険', amount:88000, note:'年間'},
    ]
  },
  { id:'6632', plate:'福島 800 し 6632', type:'2tトラック', cap:1000, base:'福島市', status:'休憩中', inspection:'2025/09/15', fuel:'軽油', note:'', driverName:'池田 十七', maker:'三菱ふそう', model:'キャンター FEA20', regdate:'2021/05', mileage:48700,
    fuelLogs:[
      {date:'2025/04/22', liters:36.8, amount:6440, odo:48700, note:'福島SS'},
      {date:'2025/04/07', liters:38.4, amount:6720, odo:47100, note:''},
    ],
    costLogs:[
      {date:'2025/03/15', cat:'自賠責保険', amount:25830, note:'24ヶ月'},
      {date:'2025/01/25', cat:'その他点検', amount:6500, note:'エアコン点検'},
    ]
  },
];

window.driverMasterData = [
  { id:'DRV-001', name:'山田 一郎',   empNo:'EMP-001', tel:'090-1234-5678', license:'大型・牽引', vehicleId:'1245', stars:5, avail:'運行中', base:'品川区',   note:'フォークリフト所持' },
  { id:'DRV-002', name:'鈴木 次郎',   empNo:'EMP-002', tel:'090-2345-6789', license:'大型',      vehicleId:'1123', stars:4, avail:'空車',   base:'品川区',   note:'' },
  { id:'DRV-003', name:'渡辺 六郎',   empNo:'EMP-003', tel:'090-3456-7890', license:'大型',      vehicleId:'0552', stars:4, avail:'運行中', base:'足立区',   note:'冷蔵車専任' },
  { id:'DRV-004', name:'松本 十郎',   empNo:'EMP-004', tel:'090-4567-8901', license:'大型・牽引', vehicleId:'2580', stars:5, avail:'空車',   base:'品川区',   note:'危険物取扱' },
  { id:'DRV-005', name:'山本 十三',   empNo:'EMP-005', tel:'090-5678-9012', license:'大型',      vehicleId:'3301', stars:5, avail:'空車',   base:'福岡市',   note:'' },
  { id:'DRV-006', name:'斉藤 十六',   empNo:'EMP-006', tel:'090-6789-0123', license:'大型',      vehicleId:'5521', stars:5, avail:'空車',   base:'仙台市',   note:'精密機器輸送経験豊富' },
  { id:'DRV-007', name:'田中 四郎',   empNo:'EMP-007', tel:'090-7890-1234', license:'中型',      vehicleId:'0887', stars:4, avail:'空車',   base:'船橋市',   note:'食品衛生管理者' },
  { id:'DRV-008', name:'高木 十一',   empNo:'EMP-008', tel:'090-8901-2345', license:'大型',      vehicleId:'1872', stars:4, avail:'空車',   base:'大田区',   note:'' },
  { id:'DRV-009', name:'藤田 十二',   empNo:'EMP-009', tel:'090-9012-3456', license:'準中型',    vehicleId:'0934', stars:4, avail:'休憩中', base:'品川区',   note:'' },
  { id:'DRV-010', name:'中島 十四',   empNo:'EMP-010', tel:'090-0123-4567', license:'大型・牽引', vehicleId:'2240', stars:4, avail:'空車',   base:'北九州市', note:'長距離得意' },
  { id:'DRV-011', name:'小野 十五',   empNo:'EMP-011', tel:'090-1111-2222', license:'大型',      vehicleId:'4410', stars:3, avail:'空車',   base:'福岡市',   note:'' },
  { id:'DRV-012', name:'池田 十七',   empNo:'EMP-012', tel:'090-2222-3333', license:'中型',      vehicleId:'6632', stars:4, avail:'休憩中', base:'福島市',   note:'東北エリア専任' },
];

// 車両マスタロード完了 → 処理済み詳細パネルを再描画して車両情報を正しく表示
if (typeof renderProcessedList === 'function') {
  renderProcessedList();
  renderProcessedDetail(typeof selectedProcessed !== 'undefined' ? selectedProcessed : 0);
}

let currentVehicleTab = 'vehicle';  // 'vehicle' | 'driver'
let currentVehicleView = 'table';   // 'table' | 'card'
let vehicleEditIdx = null;          // 編集中インデックス（null=新規）
let vehicleModalTab = 'vehicle';
let csvPendingData = null;
let csvPendingType = null;

// ── ページ切替時に初期化 ──
function initVehiclePage() {
  renderVehicleContent();
  updateVehicleTabCounts();
}

function updateVehicleTabCounts() {
  const vc = document.getElementById('vtab-vehicle-count');
  const dc = document.getElementById('vtab-driver-count');
  if (vc) vc.textContent = window.vehicleMasterData.length;
  if (dc) dc.textContent = window.driverMasterData.length;
}

function switchVehicleTab(tab) {
  currentVehicleTab = tab;
  // タブUI更新
  ['vehicle','driver'].forEach(t => {
    const el = document.getElementById('vtab-' + t);
    if (!el) return;
    const isActive = t === tab;
    el.style.borderBottomColor = isActive ? 'var(--sidebar-bg)' : 'transparent';
    el.style.color = isActive ? 'var(--sidebar-bg)' : 'var(--text-secondary)';
    const badge = el.querySelector('span');
    if (badge) {
      badge.style.background = isActive ? 'var(--sidebar-bg)' : '#e5e7eb';
      badge.style.color = isActive ? '#fff' : 'var(--text-secondary)';
    }
  });
  // フィルターをリセット
  const sf = document.getElementById('vehicle-status-filter');
  const tf = document.getElementById('vehicle-type-filter');
  const search = document.getElementById('vehicle-search');
  if (sf) sf.value = 'all';
  if (tf) tf.value = 'all';
  if (search) search.value = '';
  renderVehicleContent();
}

function switchVehicleView(view) {
  currentVehicleView = view;
  ['table','card'].forEach(v => {
    const btn = document.getElementById('vview-' + v);
    if (!btn) return;
    const isActive = v === view;
    btn.style.background = isActive ? 'var(--sidebar-bg)' : '#fff';
    btn.style.borderColor = isActive ? 'var(--sidebar-bg)' : 'var(--border)';
    btn.style.color = isActive ? '#fff' : 'var(--text-secondary)';
  });
  renderVehicleContent();
}

function filterVehicleTable() { renderVehicleContent(); }

function getFilteredData() {
  const search = (document.getElementById('vehicle-search')?.value || '').toLowerCase();
  const statusF = document.getElementById('vehicle-status-filter')?.value || 'all';
  const typeF   = document.getElementById('vehicle-type-filter')?.value || 'all';

  if (currentVehicleTab === 'vehicle') {
    return window.vehicleMasterData.filter(v => {
      const matchSearch = !search || v.id.toLowerCase().includes(search) || v.plate.toLowerCase().includes(search) || (v.driverName||'').toLowerCase().includes(search);
      const matchStatus = statusF === 'all' || v.status === statusF;
      const matchType   = typeF === 'all' || v.type === typeF;
      return matchSearch && matchStatus && matchType;
    });
  } else {
    return window.driverMasterData.filter(d => {
      const matchSearch = !search || d.name.toLowerCase().includes(search) || (d.vehicleId||'').toLowerCase().includes(search) || d.empNo.toLowerCase().includes(search);
      const matchStatus = statusF === 'all' || d.avail === statusF;
      const matchType   = typeF === 'all'; // ドライバーは車格フィルターなし
      return matchSearch && matchStatus && matchType;
    });
  }
}

function renderVehicleContent() {
  const area = document.getElementById('vehicle-content-area');
  if (!area) return;
  const data = getFilteredData();
  if (currentVehicleView === 'table') {
    area.innerHTML = currentVehicleTab === 'vehicle' ? renderVehicleTable(data) : renderDriverTable(data);
  } else {
    area.innerHTML = currentVehicleTab === 'vehicle' ? renderVehicleCards(data) : renderDriverCards(data);
  }
}

// ── ステータスバッジ ──
function statusBadge(s) {
  const map = {
    '空車':   { bg:'#dcfce7', color:'#16a34a' },
    '運行中': { bg:'#dbeafe', color:'#1d4ed8' },
    '整備中': { bg:'#fef3c7', color:'#92400e' },
    '休憩中': { bg:'#f3f4f6', color:'#6b7280' },
    '休日':   { bg:'#f3f4f6', color:'#9ca3af' },
  };
  const m = map[s] || { bg:'#f3f4f6', color:'#6b7280' };
  return `<span style="background:${m.bg};color:${m.color};font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap">${s}</span>`;
}

function starStr(n) {
  return '★'.repeat(n) + '☆'.repeat(5-n);
}

// ── 車両テーブル ──
function renderVehicleTable(data) {
  if (!data.length) return `<div class="empty-state"><div class="empty-state-icon">🚛</div><div>該当する車両がありません</div></div>`;
  const rows = data.map((v, i) => {
    const realIdx = window.vehicleMasterData.indexOf(v);
    const inspColor = isInspectionNear(v.inspection) ? 'color:#dc2626;font-weight:700' : '';
    return `
    <tr style="border-bottom:1px solid var(--border);transition:background .12s;cursor:pointer" onclick="openVehicleDetail(${realIdx})" onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background=''">
      <td style="padding:12px 14px;font-weight:700;font-family:'Inter',sans-serif;color:var(--sidebar-bg);font-size:13px">${v.id}</td>
      <td style="padding:12px 8px;font-size:12px">${v.plate}</td>
      <td style="padding:12px 8px">
        <span style="background:#f0fdf4;color:#0D4A3A;font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px">${v.type}</span>
      </td>
      <td style="padding:12px 8px;font-size:12px;font-family:'Inter',sans-serif">${(v.cap||0).toLocaleString()} kg</td>
      <td style="padding:12px 8px;font-size:12px">${v.base}</td>
      <td style="padding:12px 8px">${statusBadge(v.status)}</td>
      <td style="padding:12px 8px;font-size:12px;${inspColor}">${v.inspection||'—'}</td>
      <td style="padding:12px 8px;font-size:12px;color:var(--text-secondary)">${v.driverName||'未割当'}</td>
      <td style="padding:12px 8px" onclick="event.stopPropagation()">
        <div style="display:flex;gap:6px">
          <button onclick="editVehicleItem('vehicle',${realIdx})" style="padding:4px 10px;font-size:11px;font-weight:600;border:1.5px solid var(--border);border-radius:6px;background:#fff;cursor:pointer;color:var(--text-secondary)">編集</button>
          <button onclick="deleteVehicleItem('vehicle',${realIdx})" style="padding:4px 10px;font-size:11px;font-weight:600;border:1.5px solid #fee2e2;border-radius:6px;background:#fef2f2;cursor:pointer;color:#dc2626">削除</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  return `
  <div style="background:#fff;border-radius:12px;border:1px solid var(--border);overflow:hidden">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#f8fafc;border-bottom:2px solid var(--border)">
          <th style="padding:10px 14px;font-size:11px;font-weight:700;color:var(--text-secondary);text-align:left;letter-spacing:.04em">車両番号</th>
          <th style="padding:10px 8px;font-size:11px;font-weight:700;color:var(--text-secondary);text-align:left">ナンバー</th>
          <th style="padding:10px 8px;font-size:11px;font-weight:700;color:var(--text-secondary);text-align:left">車格</th>
          <th style="padding:10px 8px;font-size:11px;font-weight:700;color:var(--text-secondary);text-align:left">積載量</th>
          <th style="padding:10px 8px;font-size:11px;font-weight:700;color:var(--text-secondary);text-align:left">拠点</th>
          <th style="padding:10px 8px;font-size:11px;font-weight:700;color:var(--text-secondary);text-align:left">稼働状況</th>
          <th style="padding:10px 8px;font-size:11px;font-weight:700;color:var(--text-secondary);text-align:left">車検期限</th>
          <th style="padding:10px 8px;font-size:11px;font-weight:700;color:var(--text-secondary);text-align:left">担当ドライバー</th>
          <th style="padding:10px 8px;font-size:11px;font-weight:700;color:var(--text-secondary);text-align:left">操作</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function isInspectionNear(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr.replace(/\//g,'-'));
  const diff = (d - new Date()) / (1000 * 60 * 60 * 24);
  return diff < 60;
}

// ── ドライバーテーブル ──
function renderDriverTable(data) {
  if (!data.length) return `<div class="empty-state"><div class="empty-state-icon">👤</div><div>該当するドライバーがいません</div></div>`;
  const rows = data.map((d) => {
    const realIdx = window.driverMasterData.indexOf(d);
    return `
    <tr style="border-bottom:1px solid var(--border);transition:background .12s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
      <td style="padding:12px 14px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:34px;height:34px;border-radius:50%;background:var(--accent);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${d.name.charAt(0)}</div>
          <div>
            <div style="font-size:13px;font-weight:700">${d.name}</div>
            <div style="font-size:10px;color:var(--text-muted)">${d.empNo}</div>
          </div>
        </div>
      </td>
      <td style="padding:12px 8px;font-size:12px">${d.tel}</td>
      <td style="padding:12px 8px"><span style="background:#f0fdf4;color:#0D4A3A;font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px">${d.license}</span></td>
      <td style="padding:12px 8px;font-size:12px;font-family:'Inter',sans-serif;color:var(--sidebar-bg);font-weight:700">${d.vehicleId||'—'}</td>
      <td style="padding:12px 8px">${statusBadge(d.avail)}</td>
      <td style="padding:12px 8px;font-size:12px">${d.base}</td>
      <td style="padding:12px 8px;font-size:13px;color:#f59e0b">${starStr(d.stars||3)}</td>
      <td style="padding:12px 8px;font-size:11px;color:var(--text-secondary);max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.note||'—'}</td>
      <td style="padding:12px 8px">
        <div style="display:flex;gap:6px">
          <button onclick="editVehicleItem('driver',${realIdx})" style="padding:4px 10px;font-size:11px;font-weight:600;border:1.5px solid var(--border);border-radius:6px;background:#fff;cursor:pointer;color:var(--text-secondary)">編集</button>
          <button onclick="deleteVehicleItem('driver',${realIdx})" style="padding:4px 10px;font-size:11px;font-weight:600;border:1.5px solid #fee2e2;border-radius:6px;background:#fef2f2;cursor:pointer;color:#dc2626">削除</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  return `
  <div style="background:#fff;border-radius:12px;border:1px solid var(--border);overflow:hidden">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#f8fafc;border-bottom:2px solid var(--border)">
          <th style="padding:10px 14px;font-size:11px;font-weight:700;color:var(--text-secondary);text-align:left">氏名</th>
          <th style="padding:10px 8px;font-size:11px;font-weight:700;color:var(--text-secondary);text-align:left">電話番号</th>
          <th style="padding:10px 8px;font-size:11px;font-weight:700;color:var(--text-secondary);text-align:left">免許区分</th>
          <th style="padding:10px 8px;font-size:11px;font-weight:700;color:var(--text-secondary);text-align:left">担当車両</th>
          <th style="padding:10px 8px;font-size:11px;font-weight:700;color:var(--text-secondary);text-align:left">稼働状況</th>
          <th style="padding:10px 8px;font-size:11px;font-weight:700;color:var(--text-secondary);text-align:left">拠点</th>
          <th style="padding:10px 8px;font-size:11px;font-weight:700;color:var(--text-secondary);text-align:left">評価</th>
          <th style="padding:10px 8px;font-size:11px;font-weight:700;color:var(--text-secondary);text-align:left">備考</th>
          <th style="padding:10px 8px;font-size:11px;font-weight:700;color:var(--text-secondary);text-align:left">操作</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ── 車両カード表示 ──
function renderVehicleCards(data) {
  if (!data.length) return `<div class="empty-state"><div class="empty-state-icon">🚛</div><div>該当する車両がありません</div></div>`;
  const cards = data.map(v => {
    const realIdx = window.vehicleMasterData.indexOf(v);
    const inspColor = isInspectionNear(v.inspection) ? '#dc2626' : 'var(--text-secondary)';
    return `
    <div style="background:#fff;border-radius:12px;border:1.5px solid var(--border);padding:16px;display:flex;flex-direction:column;gap:10px;transition:box-shadow .15s" onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow=''">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:40px;height:40px;background:var(--sidebar-bg);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D4A3A" stroke-width="2.5"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        </div>
        <div style="flex:1">
          <div style="font-size:15px;font-weight:800;font-family:'Inter',sans-serif;color:var(--sidebar-bg)">車両 ${v.id}</div>
          <div style="font-size:11px;color:var(--text-muted)">${v.plate}</div>
        </div>
        ${statusBadge(v.status)}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><div style="font-size:9px;color:var(--text-muted);margin-bottom:2px">車格</div><div style="font-size:12px;font-weight:600">${v.type}</div></div>
        <div><div style="font-size:9px;color:var(--text-muted);margin-bottom:2px">積載量</div><div style="font-size:12px;font-weight:600">${(v.cap||0).toLocaleString()} kg</div></div>
        <div><div style="font-size:9px;color:var(--text-muted);margin-bottom:2px">拠点</div><div style="font-size:12px;font-weight:600">${v.base}</div></div>
        <div><div style="font-size:9px;color:var(--text-muted);margin-bottom:2px">担当ドライバー</div><div style="font-size:12px;font-weight:600">${v.driverName||'未割当'}</div></div>
      </div>
      ${v.note ? `<div style="font-size:11px;color:var(--text-secondary);background:#f8fafc;border-radius:6px;padding:6px 8px">${v.note}</div>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid var(--border)">
        <div style="font-size:10px;color:${inspColor}">車検：${v.inspection||'—'}</div>
        <div style="display:flex;gap:6px">
          <button onclick="editVehicleItem('vehicle',${realIdx})" style="padding:4px 12px;font-size:11px;font-weight:600;border:1.5px solid var(--border);border-radius:6px;background:#fff;cursor:pointer">編集</button>
          <button onclick="deleteVehicleItem('vehicle',${realIdx})" style="padding:4px 12px;font-size:11px;font-weight:600;border:1.5px solid #fee2e2;border-radius:6px;background:#fef2f2;cursor:pointer;color:#dc2626">削除</button>
        </div>
      </div>
    </div>`;
  }).join('');
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">${cards}</div>`;
}

// ── ドライバーカード表示 ──
function renderDriverCards(data) {
  if (!data.length) return `<div class="empty-state"><div class="empty-state-icon">👤</div><div>該当するドライバーがいません</div></div>`;
  const cards = data.map(d => {
    const realIdx = window.driverMasterData.indexOf(d);
    return `
    <div style="background:#fff;border-radius:12px;border:1.5px solid var(--border);padding:16px;display:flex;flex-direction:column;gap:10px;transition:box-shadow .15s" onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow=''">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:40px;height:40px;border-radius:50%;background:var(--accent);color:#fff;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${d.name.charAt(0)}</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:800;color:var(--sidebar-bg)">${d.name}</div>
          <div style="font-size:10px;color:var(--text-muted)">${d.empNo}</div>
        </div>
        ${statusBadge(d.avail)}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><div style="font-size:9px;color:var(--text-muted);margin-bottom:2px">免許区分</div><div style="font-size:12px;font-weight:600">${d.license}</div></div>
        <div><div style="font-size:9px;color:var(--text-muted);margin-bottom:2px">担当車両</div><div style="font-size:12px;font-weight:600;font-family:'Inter',sans-serif;color:var(--sidebar-bg)">${d.vehicleId||'—'}</div></div>
        <div><div style="font-size:9px;color:var(--text-muted);margin-bottom:2px">拠点</div><div style="font-size:12px;font-weight:600">${d.base}</div></div>
        <div><div style="font-size:9px;color:var(--text-muted);margin-bottom:2px">評価</div><div style="font-size:13px;color:#f59e0b">${starStr(d.stars||3)}</div></div>
      </div>
      <div style="font-size:11px;color:var(--text-secondary)">${d.tel}</div>
      ${d.note ? `<div style="font-size:11px;color:var(--text-secondary);background:#f8fafc;border-radius:6px;padding:6px 8px">${d.note}</div>` : ''}
      <div style="display:flex;justify-content:flex-end;gap:6px;padding-top:8px;border-top:1px solid var(--border)">
        <button onclick="editVehicleItem('driver',${realIdx})" style="padding:4px 12px;font-size:11px;font-weight:600;border:1.5px solid var(--border);border-radius:6px;background:#fff;cursor:pointer">編集</button>
        <button onclick="deleteVehicleItem('driver',${realIdx})" style="padding:4px 12px;font-size:11px;font-weight:600;border:1.5px solid #fee2e2;border-radius:6px;background:#fef2f2;cursor:pointer;color:#dc2626">削除</button>
      </div>
    </div>`;
  }).join('');
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px">${cards}</div>`;
}

// ── モーダル制御 ──
function openVehicleAddModal() {
  vehicleEditIdx = null;
  const title = document.getElementById('vehicle-modal-title');
  if (title) title.textContent = '新規追加';
  clearVehicleForm();
  switchVehicleModalTab('vehicle');
  document.getElementById('vehicle-add-modal').style.display = 'flex';
}

function closeVehicleModal() {
  document.getElementById('vehicle-add-modal').style.display = 'none';
}

function switchVehicleModalTab(tab) {
  vehicleModalTab = tab;
  ['vehicle','fuel','cost','driver'].forEach(t => {
    const btn = document.getElementById('vmodal-tab-' + t);
    const form = document.getElementById('vform-' + t);
    const isActive = t === tab;
    if (btn) {
      btn.style.borderBottomColor = isActive ? 'var(--accent)' : 'transparent';
      btn.style.color = isActive ? '#fff' : 'rgba(255,255,255,0.4)';
    }
    if (form) form.style.display = isActive ? '' : 'none';
  });
}

function clearVehicleForm() {
  ['vf-id','vf-plate','vf-cap','vf-base','vf-inspection','vf-note','vf-maker','vf-model','vf-regdate','vf-mileage',
   'vf-dname','vf-dno','vf-dtel','vf-dvehicle','vf-dbase','vf-dnote'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['vf-type','vf-status','vf-fuel','vf-dlicense','vf-dstars','vf-davail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.selectedIndex = 0;
  });
  const fe = document.getElementById('vf-fuel-entries-form');
  if (fe) fe.innerHTML = '';
  const ce = document.getElementById('vf-cost-entries-form');
  if (ce) ce.innerHTML = '';
}

// 給油記録フォーム行追加
function addFuelEntryForm(entry) {
  const container = document.getElementById('vf-fuel-entries-form');
  if (!container) return;
  const idx = container.children.length;
  const div = document.createElement('div');
  div.className = 'vf-entry-row';
  div.innerHTML = `
    <button class="vf-entry-del" onclick="this.parentElement.remove()">✕</button>
    <div class="vf-entry-label">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 22V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/><line x1="3" y1="22" x2="21" y2="22"/></svg>
      給油記録 ${idx + 1}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
      <div>
        <label style="font-size:10px;font-weight:600;color:#6b7280;display:block;margin-bottom:3px;letter-spacing:.04em;text-transform:uppercase">給油日</label>
        <input class="form-input" style="font-size:12px;padding:6px 8px;border-color:#d1d5db" data-fuel="date" value="${entry?.date||''}" placeholder="2025/04/28">
      </div>
      <div>
        <label style="font-size:10px;font-weight:600;color:#6b7280;display:block;margin-bottom:3px;letter-spacing:.04em;text-transform:uppercase">給油量 (L)</label>
        <input class="form-input" style="font-size:12px;padding:6px 8px;border-color:#d1d5db" data-fuel="liters" type="number" value="${entry?.liters||''}" placeholder="62.4">
      </div>
      <div>
        <label style="font-size:10px;font-weight:600;color:#6b7280;display:block;margin-bottom:3px;letter-spacing:.04em;text-transform:uppercase">金額 (円)</label>
        <input class="form-input" style="font-size:12px;padding:6px 8px;border-color:#d1d5db" data-fuel="amount" type="number" value="${entry?.amount||''}" placeholder="10920">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <div>
        <label style="font-size:10px;font-weight:600;color:#6b7280;display:block;margin-bottom:3px;letter-spacing:.04em;text-transform:uppercase">累計走行距離 (km)</label>
        <input class="form-input" style="font-size:12px;padding:6px 8px;border-color:#d1d5db" data-fuel="odo" type="number" value="${entry?.odo||''}" placeholder="95400">
      </div>
      <div>
        <label style="font-size:10px;font-weight:600;color:#6b7280;display:block;margin-bottom:3px;letter-spacing:.04em;text-transform:uppercase">給油場所</label>
        <input class="form-input" style="font-size:12px;padding:6px 8px;border-color:#d1d5db" data-fuel="note" value="${entry?.note||''}" placeholder="品川SS">
      </div>
      <div>
        <label style="font-size:10px;font-weight:600;color:#9ca3af;display:block;margin-bottom:3px;letter-spacing:.04em;text-transform:uppercase">燃費 (自動)</label>
        <input class="form-input" style="font-size:12px;padding:6px 8px;background:#f3f4f6;border-color:#e5e7eb;color:#9ca3af" data-fuel="kmpl" readonly placeholder="—">
      </div>
    </div>`;
  container.appendChild(div);
}

function calcFuelEntry(el) {
  const row = el.closest('div[style*="border-radius:10px"]');
  const liters = parseFloat(row.querySelector('[data-fuel=liters]').value) || 0;
  const odo    = parseFloat(row.querySelector('[data-fuel=odo]').value) || 0;
  // 前のODOは簡易計算（実際は前回記録から）
  const kmpl = row.querySelector('[data-fuel=kmpl]');
  if (liters > 0 && odo > 0) {
    kmpl.value = '—（要前回ODO）';
  }
}

// コスト記録フォーム行追加
const COST_CATS = ['給油','車検','3ヶ月点検','その他点検','修理・整備','部品購入','自動車税','自動車重量税','自賠責保険','任意保険'];
function addCostEntryForm(entry) {
  const container = document.getElementById('vf-cost-entries-form');
  if (!container) return;
  const idx = container.children.length;
  const div = document.createElement('div');
  div.className = 'vf-entry-row';
  const catOptions = COST_CATS.map(c => `<option ${c===(entry?.cat||'')?'selected':''}>${c}</option>`).join('');
  div.innerHTML = `
    <button class="vf-entry-del" onclick="this.parentElement.remove()">✕</button>
    <div class="vf-entry-label">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
      コスト記録 ${idx + 1}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
      <div>
        <label style="font-size:10px;font-weight:600;color:#6b7280;display:block;margin-bottom:3px;letter-spacing:.04em;text-transform:uppercase">日付</label>
        <input class="form-input" style="font-size:12px;padding:6px 8px;border-color:#d1d5db" data-cost="date" value="${entry?.date||''}" placeholder="2025/04/01">
      </div>
      <div>
        <label style="font-size:10px;font-weight:600;color:#6b7280;display:block;margin-bottom:3px;letter-spacing:.04em;text-transform:uppercase">カテゴリ</label>
        <select class="form-select" style="font-size:12px;padding:6px 8px;border-color:#d1d5db" data-cost="cat">
          <option value="">選択してください</option>${catOptions}
        </select>
      </div>
      <div>
        <label style="font-size:10px;font-weight:600;color:#6b7280;display:block;margin-bottom:3px;letter-spacing:.04em;text-transform:uppercase">金額 (円)</label>
        <input class="form-input" style="font-size:12px;padding:6px 8px;border-color:#d1d5db" data-cost="amount" type="number" value="${entry?.amount||''}" placeholder="27500">
      </div>
    </div>
    <div>
      <label style="font-size:10px;font-weight:600;color:#6b7280;display:block;margin-bottom:3px;letter-spacing:.04em;text-transform:uppercase">備考</label>
      <input class="form-input" style="font-size:12px;padding:6px 8px;border-color:#d1d5db;width:100%" data-cost="note" value="${entry?.note||''}" placeholder="例：令和7年度">
    </div>`;
  container.appendChild(div);
}

function editVehicleItem(type, idx) {
  vehicleEditIdx = idx;
  const title = document.getElementById('vehicle-modal-title');
  if (title) title.textContent = '編集';
  clearVehicleForm();

  if (type === 'vehicle') {
    const v = window.vehicleMasterData[idx];
    switchVehicleModalTab('vehicle');
    document.getElementById('vf-id').value = v.id || '';
    document.getElementById('vf-plate').value = v.plate || '';
    document.getElementById('vf-type').value = v.type || '';
    document.getElementById('vf-cap').value = v.cap || '';
    document.getElementById('vf-base').value = v.base || '';
    document.getElementById('vf-status').value = v.status || '空車';
    document.getElementById('vf-inspection').value = v.inspection || '';
    document.getElementById('vf-fuel').value = v.fuel || '軽油';
    document.getElementById('vf-note').value = v.note || '';
    document.getElementById('vf-maker').value = v.maker || '';
    document.getElementById('vf-model').value = v.model || '';
    document.getElementById('vf-regdate').value = v.regdate || '';
    document.getElementById('vf-mileage').value = v.mileage || '';
    // 給油・コスト記録を読み込む
    (v.fuelLogs||[]).forEach(e => addFuelEntryForm(e));
    (v.costLogs||[]).forEach(e => addCostEntryForm(e));
  } else {
    const d = window.driverMasterData[idx];
    switchVehicleModalTab('driver');
    document.getElementById('vf-dname').value = d.name || '';
    document.getElementById('vf-dno').value = d.empNo || '';
    document.getElementById('vf-dtel').value = d.tel || '';
    document.getElementById('vf-dlicense').value = d.license || '';
    document.getElementById('vf-dvehicle').value = d.vehicleId || '';
    document.getElementById('vf-dstars').value = d.stars || 5;
    document.getElementById('vf-davail').value = d.avail || '空車';
    document.getElementById('vf-dbase').value = d.base || '';
    document.getElementById('vf-dnote').value = d.note || '';
  }
  vehicleEditType = type;
  document.getElementById('vehicle-add-modal').style.display = 'flex';
}

let vehicleEditType = 'vehicle';
let vDetailCurrentIdx = null;
let vDetailCurrentTab = 'basic';

// ── 詳細モーダルを開く ──
function openVehicleDetail(idx) {
  vDetailCurrentIdx = idx;
  vDetailCurrentTab = 'basic';
  const v = window.vehicleMasterData[idx];
  const titleEl = document.getElementById('vdetail-title');
  if (titleEl) titleEl.textContent = `車両 ${v.id}　${v.plate}`;
  switchVDetailTab('basic');
  document.getElementById('vehicle-detail-modal').style.display = 'flex';
}

function closeVehicleDetailModal() {
  document.getElementById('vehicle-detail-modal').style.display = 'none';
}

function editFromDetail() {
  if (vDetailCurrentIdx === null) return;
  closeVehicleDetailModal();
  editVehicleItem('vehicle', vDetailCurrentIdx);
}

function switchVDetailTab(tab) {
  vDetailCurrentTab = tab;
  ['basic','fuel','cost'].forEach(t => {
    const btn = document.getElementById('vdt-' + t);
    if (btn) btn.classList.toggle('active', t === tab);
  });
  renderVDetailBody();
}

function renderVDetailBody() {
  const v = window.vehicleMasterData[vDetailCurrentIdx];
  if (!v) return;
  const body = document.getElementById('vdetail-body');
  if (!body) return;

  if (vDetailCurrentTab === 'basic') {
    body.innerHTML = renderVDetailBasic(v);
  } else if (vDetailCurrentTab === 'fuel') {
    body.innerHTML = renderVDetailFuel(v);
  } else {
    body.innerHTML = renderVDetailCost(v);
  }
}

// ── 基本情報タブ ──
function renderVDetailBasic(v) {
  const driver = window.driverMasterData.find(d => d.vehicleId === v.id);
  const inspColor = isInspectionNear(v.inspection) ? '#dc2626' : 'var(--text-primary)';
  const totalFuel = (v.fuelLogs||[]).reduce((s,f)=>s+(f.liters||0),0);
  const totalCost = (v.costLogs||[]).reduce((s,c)=>s+(c.amount||0),0);
  // 燃費計算（最新2件のODO差）
  let avgKmpl = '—';
  const logs = (v.fuelLogs||[]).slice().sort((a,b)=>b.odo-a.odo);
  if (logs.length >= 2) {
    const dist = logs[0].odo - logs[logs.length-1].odo;
    const fuel = logs.slice(0,-1).reduce((s,l)=>s+(l.liters||0),0);
    if (fuel > 0) avgKmpl = (dist / fuel).toFixed(1) + ' km/L';
  }

  return `
  <!-- KPIバー -->
  <div class="vd-kpi-row">
    <div class="vd-kpi" style="border-left-color:#0D4A3A">
      <div class="vd-kpi-label">現在走行距離</div>
      <div class="vd-kpi-val">${(v.mileage||0).toLocaleString()}</div>
      <div class="vd-kpi-sub">km</div>
    </div>
    <div class="vd-kpi" style="border-left-color:#0D4A3A">
      <div class="vd-kpi-label">平均燃費</div>
      <div class="vd-kpi-val" style="font-size:15px">${avgKmpl}</div>
      <div class="vd-kpi-sub">直近記録より</div>
    </div>
    <div class="vd-kpi" style="border-left-color:#0D4A3A">
      <div class="vd-kpi-label">累計燃料使用量</div>
      <div class="vd-kpi-val">${totalFuel.toFixed(1)}</div>
      <div class="vd-kpi-sub">L（記録分）</div>
    </div>
    <div class="vd-kpi" style="border-left-color:#0D4A3A">
      <div class="vd-kpi-label">累計コスト</div>
      <div class="vd-kpi-val" style="font-size:15px">¥${totalCost.toLocaleString()}</div>
      <div class="vd-kpi-sub">記録分合計</div>
    </div>
  </div>

  <!-- 車両基本情報 -->
  <div class="vd-card">
    <div class="vd-card-header">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0D4A3A" stroke-width="2.5"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
      <div class="vd-card-title">車両基本情報</div>
      <span style="margin-left:auto;font-size:10px;font-weight:700;padding:2px 10px;border-radius:10px;background:${v.status==='空車'?'#e5e7eb':v.status==='運行中'?'#1a2a24':'#374151'};color:${v.status==='空車'?'#374151':'#fff'}">${v.status}</span>
    </div>
    <div class="vd-card-body">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
        <div><div style="font-size:10px;color:#9ca3af;margin-bottom:3px;font-weight:600;letter-spacing:.04em;text-transform:uppercase">車両番号</div><div style="font-size:14px;font-weight:800;font-family:'Inter',sans-serif;color:#111827">${v.id}</div></div>
        <div><div style="font-size:10px;color:#9ca3af;margin-bottom:3px;font-weight:600;letter-spacing:.04em;text-transform:uppercase">ナンバープレート</div><div style="font-size:13px;font-weight:600;color:#374151">${v.plate}</div></div>
        <div><div style="font-size:10px;color:#9ca3af;margin-bottom:3px;font-weight:600;letter-spacing:.04em;text-transform:uppercase">車格</div><div style="font-size:13px;font-weight:600;color:#374151">${v.type}</div></div>
        <div><div style="font-size:10px;color:#9ca3af;margin-bottom:3px;font-weight:600;letter-spacing:.04em;text-transform:uppercase">積載量</div><div style="font-size:13px;font-weight:600;color:#374151">${(v.cap||0).toLocaleString()} kg</div></div>
        <div><div style="font-size:10px;color:#9ca3af;margin-bottom:3px;font-weight:600;letter-spacing:.04em;text-transform:uppercase">拠点</div><div style="font-size:13px;font-weight:600;color:#374151">${v.base}</div></div>
        <div><div style="font-size:10px;color:#9ca3af;margin-bottom:3px;font-weight:600;letter-spacing:.04em;text-transform:uppercase">燃料種別</div><div style="font-size:13px;font-weight:600;color:#374151">${v.fuel||'軽油'}</div></div>
        <div><div style="font-size:10px;color:#9ca3af;margin-bottom:3px;font-weight:600;letter-spacing:.04em;text-transform:uppercase">メーカー</div><div style="font-size:13px;font-weight:600;color:#374151">${v.maker||'—'}</div></div>
        <div><div style="font-size:10px;color:#9ca3af;margin-bottom:3px;font-weight:600;letter-spacing:.04em;text-transform:uppercase">型式</div><div style="font-size:13px;font-weight:600;color:#374151">${v.model||'—'}</div></div>
        <div><div style="font-size:10px;color:#9ca3af;margin-bottom:3px;font-weight:600;letter-spacing:.04em;text-transform:uppercase">初度登録</div><div style="font-size:13px;font-weight:600;color:#374151">${v.regdate||'—'}</div></div>
        <div><div style="font-size:10px;color:#9ca3af;margin-bottom:3px;font-weight:600;letter-spacing:.04em;text-transform:uppercase">車検期限</div>
          <div style="font-size:13px;font-weight:700;color:${isInspectionNear(v.inspection)?'#dc2626':'#374151'};display:flex;align-items:center;gap:4px">
            ${v.inspection||'—'}${isInspectionNear(v.inspection)?'<span style="background:#fee2e2;color:#dc2626;font-size:10px;padding:1px 6px;border-radius:4px">要確認</span>':''}
          </div>
        </div>
        <div><div style="font-size:10px;color:#9ca3af;margin-bottom:3px;font-weight:600;letter-spacing:.04em;text-transform:uppercase">走行距離</div><div style="font-size:13px;font-weight:600;color:#374151">${(v.mileage||0).toLocaleString()} km</div></div>
        <div><div style="font-size:10px;color:#9ca3af;margin-bottom:3px;font-weight:600;letter-spacing:.04em;text-transform:uppercase">備考</div><div style="font-size:12px;color:#6b7280">${v.note||'—'}</div></div>
      </div>
    </div>
  </div>

  <!-- 担当ドライバー -->
  <div class="vd-card">
    <div class="vd-card-header">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6DD5A8" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      <div class="vd-card-title">担当ドライバー</div>
    </div>
    <div class="vd-card-body">
    ${driver ? `
      <div style="display:flex;align-items:center;gap:14px">
        <div class="vd-driver-avatar">${driver.name.charAt(0)}</div>
        <div style="flex:1">
          <div style="font-size:15px;font-weight:800;color:#111827">${driver.name}</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:2px">${driver.empNo} | ${driver.tel}</div>
          <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;align-items:center">
            <span style="background:#e5e7eb;color:#374151;font-size:11px;font-weight:600;padding:2px 8px;border-radius:5px">${driver.license}</span>
            <span style="background:${driver.avail==='空車'?'#e5e7eb':driver.avail==='運行中'?'#1a2a24':'#374151'};color:${driver.avail==='空車'?'#374151':'#fff'};font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">${driver.avail}</span>
            <span style="font-size:13px;color:#374151;font-weight:600">${'★'.repeat(driver.stars||3)}${'☆'.repeat(5-(driver.stars||3))}</span>
          </div>
          ${driver.note ? `<div style="font-size:11px;color:#6b7280;margin-top:6px">📝 ${driver.note}</div>` : ''}
        </div>
      </div>` : `<div style="text-align:center;padding:20px;color:#9ca3af;font-size:13px">担当ドライバー未割当</div>`}
    </div>
  </div>`;
}

// ── 給油・燃費タブ ──
function renderVDetailFuel(v) {
  const logs = (v.fuelLogs||[]).slice().sort((a,b) => {
    return new Date(b.date.replace(/\//g,'-')) - new Date(a.date.replace(/\//g,'-'));
  });
  const totalLiters = logs.reduce((s,l)=>s+(l.liters||0),0);
  const totalAmount = logs.reduce((s,l)=>s+(l.amount||0),0);
  // CO2（軽油：2.58 kg-CO2/L）
  const co2 = (totalLiters * 2.58).toFixed(1);
  // 燃費履歴（ログが2件以上ある場合）
  let kmplRows = '';
  for (let i = 0; i < logs.length - 1; i++) {
    const dist = logs[i].odo - logs[i+1].odo;
    const fuel = logs[i].liters;
    const kmpl = fuel > 0 && dist > 0 ? (dist/fuel).toFixed(1) : '—';
    kmplRows += logs[i].odo > 0 && dist > 0 ? `<span style="font-size:11px;font-weight:700;color:var(--accent)">${kmpl} km/L</span>` : '';
  }

  const tableRows = logs.map((l,i) => {
    const prevOdo = logs[i+1]?.odo;
    const dist = prevOdo ? (l.odo - prevOdo) : null;
    const kmpl = (dist && l.liters) ? (dist/l.liters).toFixed(1) : '—';
    const pricePerL = l.liters > 0 ? Math.round(l.amount/l.liters) : '—';
    const co2l = (l.liters * 2.58).toFixed(1);
    const kmplColor = parseFloat(kmpl) < 5 ? '#374151' : parseFloat(kmpl) >= 8 ? '#0D4A3A' : '#6b7280';
    return `<tr>
      <td style="padding:9px 10px;white-space:nowrap">${l.date}</td>
      <td style="padding:9px 10px;font-family:'Inter',sans-serif;font-weight:600">${l.liters?.toFixed(1)} L</td>
      <td style="padding:9px 10px;font-family:'Inter',sans-serif">¥${(l.amount||0).toLocaleString()}</td>
      <td style="padding:9px 10px;font-size:11px;color:var(--text-muted)">¥${pricePerL}/L</td>
      <td style="padding:9px 10px;font-family:'Inter',sans-serif">${l.odo ? l.odo.toLocaleString()+'km' : '—'}</td>
      <td style="padding:9px 10px;font-family:'Inter',sans-serif">${dist ? dist.toLocaleString()+'km' : '—'}</td>
      <td style="padding:9px 10px;font-weight:700;color:${kmplColor}">${kmpl !== '—' ? kmpl+' km/L' : '—'}</td>
      <td style="padding:9px 10px;font-size:11px">${co2l} kg</td>
      <td style="padding:9px 10px;font-size:11px;color:var(--text-muted)">${l.note||'—'}</td>
    </tr>`;
  }).join('');

  return `
  <!-- 燃費KPI -->
  <div class="vd-kpi-row">
    <div class="vd-kpi" style="border-left-color:#0D4A3A">
      <div class="vd-kpi-label">総給油量</div>
      <div class="vd-kpi-val">${totalLiters.toFixed(1)}</div>
      <div class="vd-kpi-sub">L（${logs.length}回分）</div>
    </div>
    <div class="vd-kpi" style="border-left-color:#0D4A3A">
      <div class="vd-kpi-label">総燃料費</div>
      <div class="vd-kpi-val" style="font-size:15px">¥${totalAmount.toLocaleString()}</div>
      <div class="vd-kpi-sub">記録分合計</div>
    </div>
    <div class="vd-kpi" style="border-left-color:#0D4A3A">
      <div class="vd-kpi-label">平均単価</div>
      <div class="vd-kpi-val" style="font-size:15px">¥${totalLiters>0?Math.round(totalAmount/totalLiters):'—'}</div>
      <div class="vd-kpi-sub">円/L</div>
    </div>
    <div class="vd-kpi" style="border-left-color:#0D4A3A">
      <div class="vd-kpi-label">CO₂排出量</div>
      <div class="vd-kpi-val" style="font-size:15px">${co2}</div>
      <div class="vd-kpi-sub">kg（軽油換算）</div>
    </div>
  </div>

  <!-- 給油履歴テーブル -->
  <div class="vd-card">
    <div class="vd-card-header">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6DD5A8" stroke-width="2"><path d="M3 22V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/><path d="M17 8h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/><line x1="3" y1="22" x2="21" y2="22"/></svg>
      <div class="vd-card-title">給油履歴・燃費実績</div>
      <button onclick="openAddFuelModal(${vDetailCurrentIdx})" class="btn btn-sm" style="margin-left:auto;font-size:11px;background:#1a2a24;color:#6DD5A8;border:1px solid #0D4A3A;padding:4px 12px">＋ 追加</button>
    </div>
    ${logs.length ? `
    <div style="overflow-x:auto">
      <table class="vd-table">
        <thead><tr>
          <th>給油日</th><th>給油量</th><th>金額</th><th>単価</th><th>累計走行距離</th><th>区間走行距離</th><th>燃費</th><th>CO₂排出量</th><th>場所</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
        <tfoot><tr>
          <td style="padding:9px 10px">合計</td>
          <td style="padding:9px 10px;font-family:'Inter',sans-serif">${totalLiters.toFixed(1)} L</td>
          <td style="padding:9px 10px;font-family:'Inter',sans-serif">¥${totalAmount.toLocaleString()}</td>
          <td colspan="3"></td>
          <td style="padding:9px 10px">—</td>
          <td style="padding:9px 10px;font-family:'Inter',sans-serif">${co2} kg</td>
          <td></td>
        </tr></tfoot>
      </table>
    </div>` : `<div style="padding:30px;text-align:center;color:#9ca3af;font-size:13px">給油記録がありません</div>`}
  </div>`;
}

// ── コスト管理タブ ──
const COST_CAT_COLORS = {
  '給油':       {bg:'#ecfdf5',color:'#059669'},
  '車検':       {bg:'#eff6ff',color:'#2563eb'},
  '3ヶ月点検':  {bg:'#f0f9ff',color:'#0284c7'},
  'その他点検': {bg:'#f8fafc',color:'#64748b'},
  '修理・整備': {bg:'#fef3c7',color:'#d97706'},
  '部品購入':   {bg:'#fff7ed',color:'#ea580c'},
  '自動車税':   {bg:'#fdf4ff',color:'#9333ea'},
  '自動車重量税':{bg:'#fdf2f8',color:'#be185d'},
  '自賠責保険': {bg:'#f0fdf4',color:'#16a34a'},
  '任意保険':   {bg:'#dcfce7',color:'#15803d'},
};

function renderVDetailCost(v) {
  const logs = (v.costLogs||[]).slice().sort((a,b) => new Date(b.date.replace(/\//g,'-')) - new Date(a.date.replace(/\//g,'-')));
  const totalCost = logs.reduce((s,c)=>s+(c.amount||0),0);

  // カテゴリ別集計
  const bycat = {};
  COST_CATS.forEach(c => bycat[c] = 0);
  logs.forEach(l => { if (bycat[l.cat] !== undefined) bycat[l.cat] += l.amount||0; });
  const maxCat = Math.max(...Object.values(bycat), 1);

  const catBars = COST_CATS.map(cat => {
    const val = bycat[cat];
    const pct = Math.round(val/maxCat*100);
    const cc = COST_CAT_COLORS[cat] || {bg:'#f3f4f6',color:'#6b7280'};
    return val > 0 ? `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
        <span class="cost-cat" style="background:${cc.bg};color:${cc.color}">${cat}</span>
        <span style="font-size:12px;font-weight:700;font-family:'Inter',sans-serif">¥${val.toLocaleString()}</span>
      </div>
      <div class="cost-bar-wrap"><div class="cost-bar-fill" style="width:${pct}%;background:${cc.color}"></div></div>
    </div>` : '';
  }).join('');

  const tableRows = logs.map(l => {
    const cc = COST_CAT_COLORS[l.cat] || {bg:'#f3f4f6',color:'#6b7280'};
    return `<tr>
      <td style="padding:9px 10px;white-space:nowrap">${l.date}</td>
      <td style="padding:9px 10px"><span class="cost-cat" style="background:${cc.bg};color:${cc.color}">${l.cat}</span></td>
      <td style="padding:9px 10px;font-family:'Inter',sans-serif;font-weight:700">¥${(l.amount||0).toLocaleString()}</td>
      <td style="padding:9px 10px;font-size:11px;color:var(--text-secondary)">${l.note||'—'}</td>
    </tr>`;
  }).join('');

  return `
  <!-- コストKPI -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">
    <div class="vd-kpi" style="border-left-color:#0D4A3A">
      <div class="vd-kpi-label">累計コスト合計</div>
      <div class="vd-kpi-val" style="font-size:16px">¥${totalCost.toLocaleString()}</div>
      <div class="vd-kpi-sub">${logs.length}件の記録</div>
    </div>
    <div class="vd-kpi" style="border-left-color:#0D4A3A">
      <div class="vd-kpi-label">最高コスト項目</div>
      <div class="vd-kpi-val" style="font-size:13px;color:#374151">${Object.entries(bycat).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—'}</div>
      <div class="vd-kpi-sub">¥${Math.max(...Object.values(bycat)).toLocaleString()}</div>
    </div>
    <div class="vd-kpi" style="border-left-color:#0D4A3A">
      <div class="vd-kpi-label">直近コスト</div>
      <div class="vd-kpi-val" style="font-size:13px;color:#374151">${logs[0] ? '¥'+logs[0].amount.toLocaleString() : '—'}</div>
      <div class="vd-kpi-sub">${logs[0]?.date||'—'} ${logs[0]?.cat||''}</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1.6fr;gap:12px">
    <!-- カテゴリ別グラフ -->
    <div class="vd-card">
      <div class="vd-card-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6DD5A8" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        <div class="vd-card-title">カテゴリ別コスト</div>
      </div>
      <div class="vd-card-body">${catBars || '<div style="color:#9ca3af;font-size:12px;text-align:center;padding:20px">記録なし</div>'}</div>
    </div>

    <!-- コスト履歴テーブル -->
    <div class="vd-card">
      <div class="vd-card-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6DD5A8" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
        <div class="vd-card-title">コスト履歴</div>
        <button onclick="openAddCostModal(${vDetailCurrentIdx})" class="btn btn-sm" style="margin-left:auto;font-size:11px;background:#1a2a24;color:#6DD5A8;border:1px solid #0D4A3A;padding:4px 12px">＋ 追加</button>
      </div>
      ${logs.length ? `
      <div style="overflow-y:auto;max-height:340px">
        <table class="vd-table">
          <thead><tr><th>日付</th><th>カテゴリ</th><th>金額</th><th>備考</th></tr></thead>
          <tbody>${tableRows}</tbody>
          <tfoot><tr>
            <td style="padding:9px 10px" colspan="2">合計</td>
            <td style="padding:9px 10px;font-family:'Inter',sans-serif">¥${totalCost.toLocaleString()}</td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>` : `<div style="padding:30px;text-align:center;color:#9ca3af;font-size:13px">コスト記録がありません</div>`}
    </div>
  </div>`;
}

// 詳細から直接給油・コスト追加
function openAddFuelModal(idx) {
  vDetailCurrentIdx = idx;
  closeVehicleDetailModal();
  editVehicleItem('vehicle', idx);
  setTimeout(() => switchVehicleModalTab('fuel'), 50);
}
function openAddCostModal(idx) {
  vDetailCurrentIdx = idx;
  closeVehicleDetailModal();
  editVehicleItem('vehicle', idx);
  setTimeout(() => switchVehicleModalTab('cost'), 50);
}

function saveVehicleItem() {
  const tab = vehicleModalTab;
  if (tab === 'vehicle' || tab === 'fuel' || tab === 'cost') {
    const id = document.getElementById('vf-id').value.trim();
    const plate = document.getElementById('vf-plate').value.trim();
    const type = document.getElementById('vf-type').value;
    if (!id || !plate || !type) { showToast('車両番号・ナンバー・車格は必須です', 'warn'); return; }

    // 給油ログを収集
    const fuelEntries = [];
    document.querySelectorAll('#vf-fuel-entries-form > div').forEach(row => {
      const date   = row.querySelector('[data-fuel=date]')?.value?.trim();
      const liters = parseFloat(row.querySelector('[data-fuel=liters]')?.value);
      const amount = parseInt(row.querySelector('[data-fuel=amount]')?.value);
      const odo    = parseInt(row.querySelector('[data-fuel=odo]')?.value);
      const note   = row.querySelector('[data-fuel=note]')?.value?.trim() || '';
      if (date && liters) fuelEntries.push({ date, liters, amount: amount||0, odo: odo||0, note });
    });
    // コストログを収集
    const costEntries = [];
    document.querySelectorAll('#vf-cost-entries-form > div').forEach(row => {
      const date   = row.querySelector('[data-cost=date]')?.value?.trim();
      const cat    = row.querySelector('[data-cost=cat]')?.value;
      const amount = parseInt(row.querySelector('[data-cost=amount]')?.value);
      const note   = row.querySelector('[data-cost=note]')?.value?.trim() || '';
      if (date && cat && amount) costEntries.push({ date, cat, amount, note });
    });

    const existing = vehicleEditIdx !== null ? window.vehicleMasterData[vehicleEditIdx] : {};
    const obj = {
      id, plate, type,
      cap: parseInt(document.getElementById('vf-cap').value) || 0,
      base: document.getElementById('vf-base').value.trim(),
      status: document.getElementById('vf-status').value,
      inspection: document.getElementById('vf-inspection').value.trim(),
      fuel: document.getElementById('vf-fuel').value,
      note: document.getElementById('vf-note').value.trim(),
      maker: document.getElementById('vf-maker').value.trim(),
      model: document.getElementById('vf-model').value.trim(),
      regdate: document.getElementById('vf-regdate').value.trim(),
      mileage: parseInt(document.getElementById('vf-mileage').value) || existing.mileage || 0,
      driverName: existing.driverName || '',
      fuelLogs: fuelEntries.length ? fuelEntries : (existing.fuelLogs || []),
      costLogs: costEntries.length ? costEntries : (existing.costLogs || []),
    };
    if (vehicleEditIdx !== null && vehicleEditType === 'vehicle') {
      window.vehicleMasterData[vehicleEditIdx] = obj;
      showToast('車両情報を更新しました', 'success');
    } else {
      window.vehicleMasterData.push(obj);
      showToast('車両を追加しました', 'success');
    }
  } else {
    const name = document.getElementById('vf-dname').value.trim();
    if (!name) { showToast('氏名は必須です', 'warn'); return; }
    const obj = {
      id: 'DRV-' + String(window.driverMasterData.length + 1).padStart(3,'0'),
      name,
      empNo: document.getElementById('vf-dno').value.trim(),
      tel: document.getElementById('vf-dtel').value.trim(),
      license: document.getElementById('vf-dlicense').value,
      vehicleId: document.getElementById('vf-dvehicle').value.trim(),
      stars: parseInt(document.getElementById('vf-dstars').value) || 3,
      avail: document.getElementById('vf-davail').value,
      base: document.getElementById('vf-dbase').value.trim(),
      note: document.getElementById('vf-dnote').value.trim(),
    };
    if (vehicleEditIdx !== null && vehicleEditType === 'driver') {
      window.driverMasterData[vehicleEditIdx] = { ...window.driverMasterData[vehicleEditIdx], ...obj };
      showToast('ドライバー情報を更新しました', 'success');
    } else {
      window.driverMasterData.push(obj);
      showToast('ドライバーを追加しました', 'success');
    }
    const vidx = window.vehicleMasterData.findIndex(v => v.id === obj.vehicleId);
    if (vidx >= 0) window.vehicleMasterData[vidx].driverName = name;
  }
  syncVehicleDataToProcessing();
  closeVehicleModal();
  renderVehicleContent();
  updateVehicleTabCounts();
}

function deleteVehicleItem(type, idx) {
  if (!confirm('本当に削除しますか？')) return;
  if (type === 'vehicle') {
    window.vehicleMasterData.splice(idx, 1);
    showToast('車両を削除しました', 'success');
  } else {
    window.driverMasterData.splice(idx, 1);
    showToast('ドライバーを削除しました', 'success');
  }
  syncVehicleDataToProcessing();
  renderVehicleContent();
  updateVehicleTabCounts();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 案件一覧（未処理・処理中）の配車AIレコメンドとの連動
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function syncVehicleDataToProcessing() {
  // processingCases の vehicles[] を vehicleMasterData から動的に生成
  if (typeof processingCases === 'undefined') return;
  processingCases.forEach(c => {
    // 既存のvehiclesがない場合、またはvehicleMasterDataから再生成
    const rebuilt = window.vehicleMasterData.map((v, i) => {
      const driver = window.driverMasterData.find(d => d.vehicleId === v.id);
      return {
        rank: i + 1,
        id: '車両' + v.id,
        driver: driver ? driver.name : v.driverName || '未割当',
        base: v.base,
        avail: v.status === '空車' ? '空車' : v.status,
        cap: v.cap + 'kg',
        stars: driver ? driver.stars : 3,
        score: driver ? Math.round(75 + driver.stars * 4 + Math.random() * 5) : 70,
        law: { status:'ok', label:'適合', items:[
          {ok:true, title:'日間運転時間', val:'9h以内'},
          {ok:true, title:'拘束時間',     val:'13h以内'},
          {ok:true, title:'週間上限時間', val:'週65h以内'},
          {ok:true, title:'勤務間休息',   val:'8h確保'},
          {ok:true, title:'連続運転制限', val:'余裕あり'},
          {ok:true, title:'休憩確保',     val:'30分ルール適合'},
        ]}
      };
    }).sort((a,b) => b.score - a.score).map((v,i) => ({...v, rank: i+1}));
    c._dynamicVehicles = rebuilt;
  });
  if (typeof unprocessedCases !== 'undefined') {
    unprocessedCases.forEach(c => {
      const rebuilt = window.vehicleMasterData.map((v, i) => {
        const driver = window.driverMasterData.find(d => d.vehicleId === v.id);
        return {
          rank: i + 1,
          id: '車両' + v.id,
          driver: driver ? driver.name : v.driverName || '未割当',
          base: v.base,
          avail: v.status === '空車' ? '空車' : v.status,
          cap: v.cap + 'kg',
          stars: driver ? driver.stars : 3,
          score: driver ? Math.round(75 + driver.stars * 4 + Math.random() * 5) : 70,
          law: { status:'ok', label:'適合', items:[
            {ok:true, title:'日間運転時間', val:'9h以内'},
            {ok:true, title:'拘束時間',     val:'13h以内'},
            {ok:true, title:'週間上限時間', val:'週65h以内'},
            {ok:true, title:'勤務間休息',   val:'8h確保'},
            {ok:true, title:'連続運転制限', val:'余裕あり'},
            {ok:true, title:'休憩確保',     val:'30分ルール適合'},
          ]}
        };
      }).sort((a,b) => b.score - a.score).map((v,i) => ({...v, rank: i+1}));
      c._dynamicVehicles = rebuilt;
    });
  }
}

// ── 案件詳細で vehicles を取得する際に動的データ優先 ──
function getVehiclesForCase(c) {
  if (c._dynamicVehicles && c._dynamicVehicles.length) return c._dynamicVehicles;
  return c.vehicles || [];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CSV インポート / エクスポート
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function importVehicleCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { showToast('CSVにデータが見つかりません', 'warn'); return; }
    const header = lines[0].split(',').map(h => h.trim().replace(/"/g,''));

    // 車両CSV判定
    const isVehicle = header.includes('id') || header.includes('plate') || header.includes('車両番号');
    csvPendingType = isVehicle ? 'vehicle' : 'driver';

    const parsed = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/"/g,''));
      const obj = {};
      header.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    }).filter(o => Object.values(o).some(v => v));

    csvPendingData = parsed;

    // プレビュー表示
    const guideTitle = document.getElementById('csv-guide-title');
    const guideContent = document.getElementById('csv-guide-content');
    const preview = document.getElementById('csv-preview-area');
    if (guideTitle) guideTitle.textContent = `CSVインポート（${isVehicle ? '車両' : 'ドライバー'}）`;
    if (guideContent) guideContent.innerHTML = `<strong>📄 ファイル：</strong>${file.name}<br><strong>検出件数：</strong>${parsed.length} 件<br><strong>種別判定：</strong>${isVehicle ? '🚛 車両データ' : '👤 ドライバーデータ'}`;
    if (preview) {
      const rows = parsed.slice(0,5).map(obj =>
        `<tr>${Object.values(obj).map(v => `<td style="padding:4px 8px;font-size:11px;border-bottom:1px solid var(--border)">${v||'—'}</td>`).join('')}</tr>`
      ).join('');
      const heads = Object.keys(parsed[0]).map(h => `<th style="padding:6px 8px;font-size:10px;font-weight:700;color:var(--text-secondary);text-align:left;background:#f8fafc">${h}</th>`).join('');
      preview.innerHTML = `<div style="font-size:11px;font-weight:600;margin-bottom:6px;color:var(--text-secondary)">プレビュー（先頭5件）</div><div style="overflow:auto"><table style="width:100%;border-collapse:collapse;border:1px solid var(--border);border-radius:8px;overflow:hidden"><thead><tr>${heads}</tr></thead><tbody>${rows}</tbody></table></div>${parsed.length > 5 ? `<div style="font-size:10px;color:var(--text-muted);margin-top:6px">…他 ${parsed.length-5} 件</div>` : ''}`;
    }
    document.getElementById('csv-guide-modal').style.display = 'flex';
  };
  reader.readAsText(file, 'UTF-8');
  event.target.value = ''; // リセット
}

function closeCsvGuide() {
  document.getElementById('csv-guide-modal').style.display = 'none';
  csvPendingData = null;
  csvPendingType = null;
}

function confirmCsvImport() {
  if (!csvPendingData || !csvPendingType) return;
  if (csvPendingType === 'vehicle') {
    csvPendingData.forEach(row => {
      const id = row.id || row['車両番号'] || row['車両ID'] || '';
      if (!id) return;
      const existing = window.vehicleMasterData.findIndex(v => v.id === id);
      const obj = {
        id,
        plate: row.plate || row['ナンバープレート'] || row['ナンバー'] || '',
        type:  row.type  || row['車格'] || '2tトラック',
        cap:   parseInt(row.cap || row['積載量'] || row['capacity']) || 0,
        base:  row.base  || row['拠点'] || '',
        status:row.status|| row['稼働状況'] || '空車',
        inspection: row.inspection || row['車検期限'] || '',
        fuel:  row.fuel  || row['燃料'] || '軽油',
        note:  row.note  || row['備考'] || '',
        driverName: row.driverName || row['担当ドライバー'] || '',
      };
      if (existing >= 0) window.vehicleMasterData[existing] = obj;
      else window.vehicleMasterData.push(obj);
    });
    showToast(`車両データを ${csvPendingData.length} 件インポートしました`, 'success');
  } else {
    csvPendingData.forEach(row => {
      const name = row.name || row['氏名'] || row['名前'] || '';
      if (!name) return;
      const existing = window.driverMasterData.findIndex(d => d.name === name);
      const obj = {
        id: 'DRV-' + String(window.driverMasterData.length + 1).padStart(3,'0'),
        name,
        empNo:   row.empNo   || row['社員番号'] || '',
        tel:     row.tel     || row['電話番号'] || '',
        license: row.license || row['免許区分'] || '大型',
        vehicleId: row.vehicleId || row['担当車両'] || '',
        stars:   parseInt(row.stars || row['評価']) || 3,
        avail:   row.avail   || row['稼働状況'] || '空車',
        base:    row.base    || row['拠点'] || '',
        note:    row.note    || row['備考'] || '',
      };
      if (existing >= 0) window.driverMasterData[existing] = { ...window.driverMasterData[existing], ...obj };
      else window.driverMasterData.push(obj);
    });
    showToast(`ドライバーデータを ${csvPendingData.length} 件インポートしました`, 'success');
  }
  syncVehicleDataToProcessing();
  closeCsvGuide();
  renderVehicleContent();
  updateVehicleTabCounts();
}

function exportVehicleCSV() {
  let csv, filename;
  if (currentVehicleTab === 'vehicle') {
    const header = 'id,plate,type,cap,base,status,inspection,fuel,driverName,note';
    const rows = window.vehicleMasterData.map(v =>
      [v.id,v.plate,v.type,v.cap,v.base,v.status,v.inspection,v.fuel,v.driverName,v.note].map(s=>`"${s||''}"`).join(',')
    );
    csv = [header, ...rows].join('\n');
    filename = 'vehicle_master.csv';
  } else {
    const header = 'name,empNo,tel,license,vehicleId,stars,avail,base,note';
    const rows = window.driverMasterData.map(d =>
      [d.name,d.empNo,d.tel,d.license,d.vehicleId,d.stars,d.avail,d.base,d.note].map(s=>`"${s||''}"`).join(',')
    );
    csv = [header, ...rows].join('\n');
    filename = 'driver_master.csv';
  }
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  showToast('CSVをエクスポートしました', 'success');
}

// ── vehicle ページ初期化は showPage 内の既存フックに合流済み ──
// （下記 showPage / showPage_byName のパッチで対応）

// ── DOMContentLoaded で初期同期 ──
document.addEventListener('DOMContentLoaded', () => {
  syncVehicleDataToProcessing();
});