// ─── 運行指示書PDF出力 ──────────────────────────────
(function(){
  'use strict';

  // モーダル内部状態
  const state = {
    mode: 'active',          // 'active' | 'all' | 'custom'
    tab: 'planning',         // 'planning' | 'confirmed'
    selected: new Set(),     // driverIdの集合
  };

  // 会社・運行管理者の情報（テナント単位の固定情報）
  const COMPANY = {
    name: '東日本物流株式会社',
    addr: '埼玉県川口市芝中田1-2-3',
    tel:  '048-XXX-XXXX',
    manager: '配車 太郎',
    managerLicense: '運行管理者資格者証 第XXXXXX号',
  };

  // ─── 公開API：モーダルを開く ───────────────────────
  window.openDriverOrderModal = function() {
    // 現在表示中のタブを初期値にする
    if (typeof currentDispatchTab !== 'undefined') {
      state.tab = (currentDispatchTab === 'confirmed') ? 'confirmed' : 'planning';
    }
    const sel = document.getElementById('dor-tab-select');
    if (sel) sel.value = state.tab;
    document.getElementById('dor-tab-label').textContent = state.tab === 'confirmed' ? '請求確定済み' : '計画中';

    state.selected.clear();
    dorSetMode(state.mode); // 初期モードでリスト構築
    document.getElementById('dor-modal-backdrop').classList.add('active');
  };

  window.closeDriverOrderModal = function() {
    document.getElementById('dor-modal-backdrop').classList.remove('active');
  };

  // ─── モード切替 ─────────────────────────────────
  window.dorSetMode = function(mode) {
    state.mode = mode;
    document.querySelectorAll('.dor-mode-tab').forEach(el => {
      el.classList.toggle('active', el.dataset.mode === mode);
    });
    // モード切替時は選択も初期化
    state.selected.clear();
    dorRefreshList();
  };

  // ─── 一覧再描画 ─────────────────────────────────
  window.dorRefreshList = function() {
    const tabSel = document.getElementById('dor-tab-select');
    if (tabSel) state.tab = tabSel.value;
    document.getElementById('dor-tab-label').textContent = state.tab === 'confirmed' ? '請求確定済み' : '計画中';

    const listEl = document.getElementById('dor-driver-list');
    const rows = buildDriverListRows();

    if (rows.length === 0) {
      listEl.innerHTML = '<div class="dor-empty-note">対象タブに運行が登録されているドライバーがいません</div>';
    } else {
      // モード別の初期選択：active/all はチェック済み、custom は未チェック
      if (state.mode !== 'custom') {
        rows.forEach(r => { if (r.assigns.length > 0) state.selected.add(r.driver.id); });
      }
      listEl.innerHTML = rows.map(renderDriverRow).join('');
    }

    updateSelectionUI();
  };

  // モードに応じたドライバー行データの構築
  function buildDriverListRows() {
    if (typeof drivers === 'undefined') return [];

    return drivers.map(d => {
      const assigns = (typeof getAssignmentsForDriver === 'function')
        ? getAssignmentsForDriver(d.id, state.tab)
        : [];
      // 1ドライバー1車両前提（旧driverId='V'+vehicleNum 互換）
      const vehicleId = assigns[0]?.vehicleId || d.id;
      const vehicle = (typeof getVehicleById === 'function') ? getVehicleById(vehicleId) : null;
      return { driver: d, vehicle, assigns };
    }).filter(r => {
      if (state.mode === 'active') return r.assigns.length > 0;
      return true; // 'all' / 'custom' は全件表示（運行0件はdisabled）
    });
  }

  // 1行のHTML
  function renderDriverRow({ driver, vehicle, assigns }) {
    const hasTrips = assigns.length > 0;
    const checked  = state.selected.has(driver.id);
    const disabled = !hasTrips;
    const partnerBadge = driver.partner
      ? `<span class="dor-row-partner-badge">傭車 ${escapeHtml(driver.partnerName || '')}</span>`
      : '';
    const vehicleText = vehicle
      ? `${escapeHtml(vehicle.plate)}<span class="dor-row-vehicle-type">${escapeHtml(vehicle.type)}/${vehicle.ton}t</span>`
      : '<span class="dor-row-vehicle-type">—</span>';

    return `
      <div class="dor-driver-row ${disabled ? 'disabled' : ''}" onclick="dorToggleRow('${driver.id}', ${disabled})">
        <div class="dor-row-check">
          <input type="checkbox" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} onclick="event.stopPropagation();dorToggleRow('${driver.id}', ${disabled})">
        </div>
        <div class="dor-row-name">
          ${escapeHtml(driver.name)}
          <span class="dor-row-id">${escapeHtml(driver.id)}</span>
          ${partnerBadge}
        </div>
        <div class="dor-row-vehicle">${vehicleText}</div>
        <div class="dor-row-count ${hasTrips ? '' : 'zero'}"><b>${assigns.length}</b> 件</div>
      </div>
    `;
  }

  // 行クリック → トグル
  window.dorToggleRow = function(driverId, disabled) {
    if (disabled) return;
    if (state.selected.has(driverId)) state.selected.delete(driverId);
    else state.selected.add(driverId);
    // 該当行のチェックボックスだけ反映（全体再描画は避けて軽量に）
    const row = document.querySelector(`.dor-driver-row [onclick*="${driverId}"]`);
    const list = document.getElementById('dor-driver-list');
    // 全体は再描画せず、UIだけ更新
    list.querySelectorAll('.dor-driver-row').forEach(rowEl => {
      const cb = rowEl.querySelector('input[type=checkbox]');
      if (!cb) return;
      const id = (rowEl.getAttribute('onclick') || '').match(/'([^']+)'/);
      if (id && id[1] === driverId) cb.checked = state.selected.has(driverId);
    });
    updateSelectionUI();
  };

  // 全選択トグル
  window.dorToggleSelectAll = function(checked) {
    const listEl = document.getElementById('dor-driver-list');
    listEl.querySelectorAll('.dor-driver-row').forEach(rowEl => {
      if (rowEl.classList.contains('disabled')) return;
      const cb = rowEl.querySelector('input[type=checkbox]');
      if (!cb) return;
      const m = (rowEl.getAttribute('onclick') || '').match(/'([^']+)'/);
      if (!m) return;
      const id = m[1];
      if (checked) state.selected.add(id);
      else state.selected.delete(id);
      cb.checked = checked;
    });
    updateSelectionUI();
  };

  // 選択件数バッジ・出力ボタンの活性制御
  function updateSelectionUI() {
    const n = state.selected.size;
    document.getElementById('dor-selected-count').textContent = n;
    document.getElementById('dor-btn-export').disabled = (n === 0);

    // 全選択チェックボックスの状態
    const allCb = document.getElementById('dor-select-all');
    const listEl = document.getElementById('dor-driver-list');
    const enabledRows = listEl.querySelectorAll('.dor-driver-row:not(.disabled)').length;
    if (allCb) {
      if (n === 0)                    { allCb.checked = false; allCb.indeterminate = false; }
      else if (n >= enabledRows)      { allCb.checked = true;  allCb.indeterminate = false; }
      else                            { allCb.checked = false; allCb.indeterminate = true;  }
    }
  }

  // ─── 出力実行 ───────────────────────────────────
  window.exportDriverOrders = function() {
    if (state.selected.size === 0) return;

    const driverIds = Array.from(state.selected);
    const data = buildDriverOrderData(driverIds, state.tab);
    if (data.length === 0) {
      alert('対象タブに運行データがありません');
      return;
    }

    const area = document.getElementById('driver-order-print-area');
    area.innerHTML = data.map(renderDriverOrderPage).join('');

    // モーダルを閉じてから印刷ダイアログを出すと、印刷プレビューがクリーンに見える
    closeDriverOrderModal();

    // 印刷モード用クラスを付与（@media print 内のスタイルがこれで切り替わる）
    document.body.classList.add('printing-driver-orders');

    // 印刷完了/キャンセル後にクラスを外す（afterprintで戻す）
    const cleanup = () => {
      document.body.classList.remove('printing-driver-orders');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    // requestAnimationFrame 経由でレイアウト確定後に印刷
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { window.print(); });
    });
  };

  // ─── データ構築 ─────────────────────────────────
  function buildDriverOrderData(driverIds, tab) {
    return driverIds.map(driverId => {
      const driver = (typeof getDriverById === 'function') ? getDriverById(driverId) : null;
      if (!driver) return null;

      const myAssigns = ((typeof getAssignmentsForDriver === 'function')
        ? getAssignmentsForDriver(driverId, tab)
        : []
      ).slice().sort((a, b) => (a.start || '').localeCompare(b.start || ''));

      const vehicleId = myAssigns[0]?.vehicleId || driverId;
      const vehicle   = (typeof getVehicleById === 'function') ? getVehicleById(vehicleId) : null;

      return { driver, vehicle, assignments: myAssigns };
    }).filter(x => x && x.assignments.length > 0);
  }

  // ─── 1ドライバー分のHTML生成（運行指示書） ───────
  function renderDriverOrderPage({ driver, vehicle, assignments }) {
    const issueDate = formatJpDate(new Date());
    const opDate    = assignments[0]?.date ? formatJpDateStr(assignments[0].date) : '—';
    const startTime = assignments[0]?.start || '—';
    const endTime   = assignments[assignments.length - 1]?.end || '—';
    const startLoc  = assignments[0]?.from || '—';
    const endLoc    = assignments[assignments.length - 1]?.to || '—';

    const tripsRows = assignments.length === 0
      ? `<tr class="dor-trip-empty"><td colspan="6">運行予定なし</td></tr>`
      : assignments.map((a, i) => `
          <tr>
            <td class="col-no">${i + 1}</td>
            <td class="col-time">${escapeHtml(a.start || '')}<br>〜<br>${escapeHtml(a.end || '')}</td>
            <td class="col-loc">
              <div class="dor-trip-client">${escapeHtml(a.client || '')}</div>
              <div class="dor-trip-route">
                ${escapeHtml(a.from || '—')}
                <span class="dor-route-arrow">→</span>
                ${escapeHtml(a.to || '—')}
              </div>
            </td>
            <td class="col-goods">${escapeHtml(a.goods || '—')}</td>
            <td class="col-deadline">${escapeHtml(a.deadline || '—')}</td>
            <td class="col-no">${escapeHtml(a.label || '')}</td>
          </tr>
        `).join('');

    const partnerInfo = driver.partner
      ? `<span class="dor-info-value">${escapeHtml(driver.name)}（傭車：${escapeHtml(driver.partnerName || '')}）</span>`
      : `<span class="dor-info-value">${escapeHtml(driver.name)}</span>`;

    const licenseStr = (driver.license || []).join('・') || '—';
    const vehicleStr = vehicle
      ? `${escapeHtml(vehicle.plate)}（${escapeHtml(vehicle.type)} ${vehicle.ton}t）`
      : '—';

    return `
      <div class="dor-page">

        <!-- ヘッダー -->
        <div class="dor-doc-header">
          <div>
            <div class="dor-doc-title">運 行 指 示 書</div>
            <div style="font-size:10px;color:#6b7280;margin-top:4px;letter-spacing:0.1em">DRIVER ORDER SHEET</div>
          </div>
          <div class="dor-doc-meta">
            <div>発行日：<b>${issueDate}</b></div>
            <div>運行日：<b>${opDate}</b></div>
            <div>指示書No.：<b>${makeOrderNo(driver.id, assignments[0]?.date)}</b></div>
          </div>
        </div>

        <!-- 会社・乗務員・車両情報 -->
        <div class="dor-info-grid">
          <div class="dor-info-cell">
            <span class="dor-info-label">事業者</span>
            <span class="dor-info-value">${escapeHtml(COMPANY.name)}</span>
          </div>
          <div class="dor-info-cell">
            <span class="dor-info-label">運行管理者</span>
            <span class="dor-info-value">${escapeHtml(COMPANY.manager)}　<span class="dor-info-value muted" style="font-size:9px">${escapeHtml(COMPANY.managerLicense)}</span></span>
          </div>
          <div class="dor-info-cell">
            <span class="dor-info-label">乗務員氏名</span>
            ${partnerInfo}
          </div>
          <div class="dor-info-cell">
            <span class="dor-info-label">乗務員ID</span>
            <span class="dor-info-value">${escapeHtml(driver.id)}</span>
          </div>
          <div class="dor-info-cell">
            <span class="dor-info-label">運転免許</span>
            <span class="dor-info-value">${escapeHtml(licenseStr)}</span>
          </div>
          <div class="dor-info-cell">
            <span class="dor-info-label">使用車両</span>
            <span class="dor-info-value">${vehicleStr}</span>
          </div>
          <div class="dor-info-cell">
            <span class="dor-info-label">出庫</span>
            <span class="dor-info-value">${escapeHtml(startTime)}　<span class="dor-info-value muted">${escapeHtml(startLoc)}</span></span>
          </div>
          <div class="dor-info-cell">
            <span class="dor-info-label">帰庫</span>
            <span class="dor-info-value">${escapeHtml(endTime)}　<span class="dor-info-value muted">${escapeHtml(endLoc)}</span></span>
          </div>
        </div>

        <!-- 運行計画 -->
        <div class="dor-section-title">運 行 計 画（運行経路・主な経由地）</div>
        <table class="dor-trips-table">
          <thead>
            <tr>
              <th class="col-no">No.</th>
              <th class="col-time">時刻</th>
              <th class="col-loc">荷主／発着地</th>
              <th class="col-goods">荷物・数量</th>
              <th class="col-deadline">納期</th>
              <th class="col-no">区分</th>
            </tr>
          </thead>
          <tbody>
            ${tripsRows}
          </tbody>
        </table>

        <!-- 安全指示・特記事項 -->
        <div class="dor-section-title">安全運行に関する指示事項</div>
        <div class="dor-notes-box">
          <ul>
            <li>連続運転時間は4時間を超えない範囲とし、4時間ごとに合計30分以上の休憩を確保すること。</li>
            <li>運転開始前にアルコール検知器による点呼を受け、健康状態に異常がないことを確認すること。</li>
            <li>積込・荷下ろし時は周囲の安全確認、車止め・安全コーンの設置を徹底すること。</li>
            <li>悪天候（強風・大雨・降雪）時は運行管理者と連絡を取り、安全を最優先に判断すること。</li>
            <li>事故・遅延・経路変更が発生した場合は速やかに運行管理者へ連絡すること。</li>
          </ul>
        </div>

        <!-- 確認サイン -->
        <div class="dor-signs">
          <div class="dor-sign-box">
            <div class="dor-sign-label">乗務前点呼</div>
            <div class="dor-sign-content">　／　：　</div>
          </div>
          <div class="dor-sign-box">
            <div class="dor-sign-label">乗務員 受領印</div>
            <div class="dor-sign-content">　　　　　　　印</div>
          </div>
          <div class="dor-sign-box">
            <div class="dor-sign-label">乗務後点呼</div>
            <div class="dor-sign-content">　／　：　</div>
          </div>
        </div>

        <!-- フッター -->
        <div class="dor-doc-footer">
          <div>${escapeHtml(COMPANY.name)}　${escapeHtml(COMPANY.addr)}　TEL ${escapeHtml(COMPANY.tel)}</div>
          <div class="dor-legal">貨物自動車運送事業輸送安全規則 第9条の3 準拠</div>
        </div>

      </div>
    `;
  }

  // ─── ヘルパー ──────────────────────────────────
  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function formatJpDate(d) {
    return `${d.getFullYear()}年${pad2(d.getMonth() + 1)}月${pad2(d.getDate())}日`;
  }
  function formatJpDateStr(yyyymmdd) {
    // '2026-05-27' → '2026年05月27日'
    const m = String(yyyymmdd).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return yyyymmdd;
    return `${m[1]}年${m[2]}月${m[3]}日`;
  }
  function makeOrderNo(driverId, dateStr) {
    const d = (dateStr || '').replace(/-/g, '') || (new Date().toISOString().slice(0,10).replace(/-/g,''));
    return `${d}-${driverId}`;
  }

  // Escキーで閉じる
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const bd = document.getElementById('dor-modal-backdrop');
      if (bd && bd.classList.contains('active')) closeDriverOrderModal();
    }
  });
})();