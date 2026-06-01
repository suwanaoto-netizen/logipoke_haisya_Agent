// ════════════════════════════════════════════════════════════════
//  配車表メイン運用 拡張機能
// ════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  // ── グローバル状態 ──
  let bulkSelectMode = false;
  const bulkSelected = new Set(); // "driverId|idx" のキー
  let openedDetailKey = null;
  const undoStack = [];
  const redoStack = [];
  const MAX_HISTORY = 30;

  // ── ユーティリティ：割当配列のディープコピー ──
  function snapshotAssignments() {
    return JSON.parse(JSON.stringify(window.dndAssignments || {}));
  }
  function restoreAssignments(snap) {
    Object.keys(window.dndAssignments || {}).forEach(k => { delete window.dndAssignments[k]; });
    Object.keys(snap).forEach(k => { window.dndAssignments[k] = snap[k]; });
  }

  // ── Undo/Redo ──
  function pushHistory() {
    undoStack.push(snapshotAssignments());
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
    updateUndoRedoButtons();
  }
  window.undoDispatch = function() {
    if (undoStack.length === 0) {
      if (typeof showDndToast === 'function') showDndToast('元に戻す操作はありません', true);
      return;
    }
    redoStack.push(snapshotAssignments());
    const prev = undoStack.pop();
    restoreAssignments(prev);
    bulkSelected.clear();
    if (typeof renderDnd === 'function') renderDnd();
    refreshWarningBar();
    updateUndoRedoButtons();
    if (typeof showDndToast === 'function') showDndToast('↶ 操作を元に戻しました');
  };
  window.redoDispatch = function() {
    if (redoStack.length === 0) {
      if (typeof showDndToast === 'function') showDndToast('やり直す操作はありません', true);
      return;
    }
    undoStack.push(snapshotAssignments());
    const next = redoStack.pop();
    restoreAssignments(next);
    bulkSelected.clear();
    if (typeof renderDnd === 'function') renderDnd();
    refreshWarningBar();
    updateUndoRedoButtons();
    if (typeof showDndToast === 'function') showDndToast('↷ 操作をやり直しました');
  };
  function updateUndoRedoButtons() {
    const u = document.getElementById('dwb-btn-undo');
    const r = document.getElementById('dwb-btn-redo');
    if (u) u.disabled = undoStack.length === 0;
    if (r) r.disabled = redoStack.length === 0;
  }

  // ── 既存関数のフック：履歴記録 ──
  // dndTrackDrop / dndRemoveAssignment の直前にスナップショット取得
  function wrapWithHistory(fnName) {
    if (typeof window[fnName] !== 'function') return;
    const orig = window[fnName];
    window[fnName] = function(...args) {
      pushHistory();
      return orig.apply(this, args);
    };
  }
  // 配車操作にUndo対応を仕込む（DOMContentLoaded後）
  function installHistoryHooks() {
    wrapWithHistory('dndTrackDrop');
    wrapWithHistory('dndRemoveAssignment');
  }

  // ════════════════════════════════════════════════════════════════
  //  拘束時間累積ゲージ（ドライバー行ヘッダ用）
  // ════════════════════════════════════════════════════════════════
  function computeDutyForDriver(driverId, dateKey) {
    if (!window.dndAssignments || !window.dndAssignments[driverId]) return 0;
    const blocks = window.dndAssignments[driverId][dateKey] || [];
    if (blocks.length === 0) return 0;
    if (typeof window.kaizenComputeDuty === 'function') {
      return window.kaizenComputeDuty(blocks);
    }
    return 0;
  }

  function renderDutyGauges() {
    if (typeof window.dndDrivers === 'undefined') return;
    const currentKey = (typeof window.dndGetCurrentDateKey === 'function')
      ? window.dndGetCurrentDateKey() : null;
    if (!currentKey) return;
    // タブが計画中の時のみ表示
    const isConfirmedTab = (typeof window.currentDispatchTab !== 'undefined' && window.currentDispatchTab === 'confirmed');
    if (isConfirmedTab) return;
    const DUTY_LIMIT = 15 * 60;
    const DUTY_PRINCIPLE = 13 * 60;
    document.querySelectorAll('.dnd-driver-cell').forEach((cell, i) => {
      const driver = window.dndDrivers[i];
      if (!driver) return;
      // 既存ゲージを削除
      const existing = cell.querySelector('.dnd-duty-gauge-wrap');
      if (existing) existing.remove();
      const dutyMin = computeDutyForDriver(driver.id, currentKey);
      const pct = Math.min(100, (dutyMin / DUTY_LIMIT) * 100);
      let cls = 'safe';
      let labelCls = '';
      if (dutyMin > DUTY_LIMIT) { cls = 'danger'; labelCls = 'danger'; }
      else if (dutyMin > DUTY_PRINCIPLE) { cls = 'warn'; labelCls = 'warn'; }
      const h = Math.floor(dutyMin / 60);
      const m = dutyMin % 60;
      const txt = dutyMin === 0 ? '0h' : (m === 0 ? `${h}h` : `${h}h${m}m`);
      const wrap = document.createElement('div');
      wrap.className = 'dnd-duty-gauge-wrap';
      wrap.style.cssText = 'margin-top:2px; width:100%;';
      wrap.innerHTML = `
        <div class="dnd-duty-gauge">
          <div class="dnd-duty-gauge-fill ${cls}" style="width:${pct}%"></div>
        </div>
        <div class="dnd-duty-label">
          <span>拘束</span>
          <span class="duty-val ${labelCls}">${txt} / 15h</span>
        </div>
      `;
      wrap.title = `1日の拘束時間：${txt}\n原則上限：13h / 絶対上限：15h`;
      cell.appendChild(wrap);
    });
  }

  // ════════════════════════════════════════════════════════════════
  //  警告サマリーバー
  // ════════════════════════════════════════════════════════════════
  function ensureWarningBar() {
    if (document.getElementById('dispatch-warning-bar')) return;
    // 配車計画表ページの該当箇所に挿入
    const sub = document.querySelector('.dispatch-subtabs');
    if (!sub) return;
    const bar = document.createElement('div');
    bar.className = 'dispatch-warning-bar';
    bar.id = 'dispatch-warning-bar';
    bar.innerHTML = `
      <div class="dwb-title" id="dwb-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span>本日のサマリー</span>
      </div>
      <div class="dwb-chips" id="dwb-chips"></div>
      <div class="dwb-actions">
        <button class="dwb-btn-help" onclick="document.getElementById('kbd-help-modal').classList.add('open')" title="キーボードショートカット (?)">?</button>
        <button class="dwb-btn-undo" id="dwb-btn-undo" onclick="undoDispatch()" title="元に戻す (Ctrl+Z)" disabled>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
        </button>
        <button class="dwb-btn-redo" id="dwb-btn-redo" onclick="redoDispatch()" title="やり直し (Ctrl+Shift+Z)" disabled>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
        </button>
        <button class="dwb-btn-bulk" id="dwb-btn-toggle-select" onclick="toggleBulkSelectMode()" title="選択モード (S)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <span id="dwb-toggle-label">選択モード</span>
        </button>
        <button class="dwb-btn-bulk" id="dwb-btn-bulk-confirm" onclick="openBulkConfirmModal()" disabled>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          <span id="dwb-confirm-label">一括仮確定</span>
        </button>
      </div>
    `;
    sub.parentNode.insertBefore(bar, sub.nextSibling);
  }

  function refreshWarningBar() {
    ensureWarningBar();
    const bar = document.getElementById('dispatch-warning-bar');
    const chipsEl = document.getElementById('dwb-chips');
    if (!bar || !chipsEl) return;
    const isConfirmedTab = (typeof window.currentDispatchTab !== 'undefined' && window.currentDispatchTab === 'confirmed');
    if (isConfirmedTab) {
      bar.style.display = 'none';
      return;
    }
    bar.style.display = 'flex';

    const currentKey = (typeof window.dndGetCurrentDateKey === 'function')
      ? window.dndGetCurrentDateKey() : null;
    if (!currentKey || !window.dndDrivers) return;

    let violations = 0;
    let warnings = 0;
    let unconfirmed = 0;
    let confirmed = 0;
    let conflicts = 0;

    window.dndDrivers.forEach(d => {
      const arr = (window.dndAssignments[d.id] && window.dndAssignments[d.id][currentKey]) || [];
      const nonPreset = arr.filter(a => !a.isPreset);
      nonPreset.forEach(a => {
        if (a.confirmed) confirmed++;
        else unconfirmed++;
      });
      if (typeof window.kaizenCheck === 'function' && nonPreset.length > 0) {
        const k = window.kaizenCheck(d.id, currentKey, null);
        if (k.level === 'violation') violations++;
        else if (k.level === 'warn') warnings++;
      }
    });

    const totalIssues = violations + warnings;
    bar.classList.toggle('all-clear', totalIssues === 0 && unconfirmed === 0);

    const titleEl = document.getElementById('dwb-title');
    if (titleEl) {
      const dateD = new Date(currentKey + 'T00:00:00');
      const dateStr = dateD.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
      titleEl.querySelector('span').textContent = `${dateStr} のサマリー`;
    }

    const chips = [];
    if (violations > 0) chips.push(`<span class="dwb-chip violation">⚠ 法令違反 <span class="dwb-chip-num">${violations}</span> 件</span>`);
    if (warnings > 0) chips.push(`<span class="dwb-chip warn">! 法令注意 <span class="dwb-chip-num">${warnings}</span> 件</span>`);
    if (unconfirmed > 0) chips.push(`<span class="dwb-chip unconfirmed">📋 未確定 <span class="dwb-chip-num">${unconfirmed}</span> 件</span>`);
    if (confirmed > 0) chips.push(`<span class="dwb-chip confirmed">✓ 確定済み <span class="dwb-chip-num">${confirmed}</span> 件</span>`);
    if (chips.length === 0) chips.push(`<span class="dwb-chip confirmed">🎉 本日のリスク・未処理なし</span>`);
    chipsEl.innerHTML = chips.join('');

    // 一括確定ボタンの有効/無効
    const btn = document.getElementById('dwb-btn-bulk-confirm');
    const lbl = document.getElementById('dwb-confirm-label');
    if (btn) {
      const selectedCount = bulkSelected.size;
      if (bulkSelectMode && selectedCount > 0) {
        btn.disabled = false;
        if (lbl) lbl.textContent = `選択 ${selectedCount} 件を仮確定`;
      } else if (!bulkSelectMode && unconfirmed > 0) {
        btn.disabled = false;
        if (lbl) lbl.textContent = `当日未確定 ${unconfirmed} 件を一括仮確定`;
      } else {
        btn.disabled = true;
        if (lbl) lbl.textContent = '一括仮確定';
      }
    }
    updateUndoRedoButtons();
  }

  // ════════════════════════════════════════════════════════════════
  //  選択モード切替
  // ════════════════════════════════════════════════════════════════
  window.toggleBulkSelectMode = function() {
    bulkSelectMode = !bulkSelectMode;
    bulkSelected.clear();
    document.body.classList.toggle('bulk-select-mode', bulkSelectMode);
    const lbl = document.getElementById('dwb-toggle-label');
    if (lbl) lbl.textContent = bulkSelectMode ? '✕ 選択モード解除' : '選択モード';
    applyBulkSelectionUI();
    refreshWarningBar();
    if (typeof showDndToast === 'function') {
      showDndToast(bulkSelectMode ? '配車ブロックをクリックして選択 / Sキーで解除' : '選択モードを終了しました');
    }
  };

  function applyBulkSelectionUI() {
    document.querySelectorAll('.dnd-block').forEach(el => {
      el.classList.remove('bulk-selected');
    });
    bulkSelected.forEach(key => {
      const [driverId, idx] = key.split('|');
      const block = findBlockEl(driverId, parseInt(idx, 10));
      if (block) block.classList.add('bulk-selected');
    });
  }

  function findBlockEl(driverId, idx) {
    // dnd-rowを順に探索
    const rows = document.querySelectorAll('.dnd-row');
    const driverIdx = (window.dndDrivers || []).findIndex(d => d.id === driverId);
    if (driverIdx < 0 || !rows[driverIdx]) return null;
    const blocks = rows[driverIdx].querySelectorAll('.dnd-block');
    return blocks[idx] || null;
  }

  // ════════════════════════════════════════════════════════════════
  //  配車ブロッククリック → 選択 or 詳細表示
  // ════════════════════════════════════════════════════════════════
  // 委譲方式：bodyにclickリスナー設置（renderDndのたびにブロックが再生成されるため）
  document.addEventListener('click', function(e) {
    const block = e.target.closest('.dnd-block');
    if (!block) return;
    if (e.target.closest('.dnd-block-remove')) return; // 削除ボタンは別処理
    // 配車計画表ページにいる時のみ
    if (typeof window.currentDispatchSubtab !== 'undefined' && window.currentDispatchSubtab !== 'dnd') return;

    const row = block.closest('.dnd-row');
    if (!row) return;
    const allRows = Array.from(document.querySelectorAll('.dnd-row'));
    const rowIdx = allRows.indexOf(row);
    if (rowIdx < 0) return;
    const driver = (window.dndDrivers || [])[rowIdx];
    if (!driver) return;
    const blockIdx = Array.from(row.querySelectorAll('.dnd-block')).indexOf(block);
    if (blockIdx < 0) return;
    const currentKey = window.dndGetCurrentDateKey();
    const arr = (window.dndAssignments[driver.id] && window.dndAssignments[driver.id][currentKey]) || [];
    const a = arr[blockIdx];
    if (!a) return;
    // プリセット（固定便）はクリック不可
    if (a.isPreset) return;

    if (bulkSelectMode) {
      // 確定済みは選択不可
      if (a.confirmed) return;
      const key = driver.id + '|' + blockIdx;
      if (bulkSelected.has(key)) bulkSelected.delete(key);
      else bulkSelected.add(key);
      applyBulkSelectionUI();
      refreshWarningBar();
    } else {
      openDndDetailPane(driver.id, blockIdx);
    }
  });

  // ════════════════════════════════════════════════════════════════
  //  右ペイン詳細表示
  // ════════════════════════════════════════════════════════════════
  window.openDndDetailPane = function(driverId, blockIdx) {
    const currentKey = window.dndGetCurrentDateKey();
    const arr = (window.dndAssignments[driverId] && window.dndAssignments[driverId][currentKey]) || [];
    const a = arr[blockIdx];
    if (!a) return;
    const driver = (window.dndDrivers || []).find(d => d.id === driverId);
    if (!driver) return;
    openedDetailKey = driverId + '|' + blockIdx;

    // 案件本体の参照（個別案件処理ページのデータから取得）
    let caseObj = null;
    if (a.caseListId && typeof window.processingCases !== 'undefined') {
      caseObj = window.processingCases.find(c => c.id === a.caseListId);
    }
    if (!caseObj && a.caseListId && typeof window.unprocessedCases !== 'undefined') {
      caseObj = window.unprocessedCases.find(c => c.id === a.caseListId);
    }

    // 改善基準告示の結果
    const k = (typeof window.kaizenCheck === 'function')
      ? window.kaizenCheck(driverId, currentKey, null) : { level: 'ok', violations: [], warnings: [] };

    const lawChip = k.level === 'violation'
      ? `<span class="dnd-detail-law-chip violation">⚠ 法令違反</span>`
      : k.level === 'warn'
      ? `<span class="dnd-detail-law-chip warn">! 法令注意</span>`
      : `<span class="dnd-detail-law-chip ok">✓ 法令適合</span>`;

    const lawDetail = (k.violations.length + k.warnings.length > 0)
      ? `<div style="margin-top:8px; font-size:11px; color:#78350f; background:#fffbeb; padding:8px 10px; border-radius:6px;">
           ${[...k.violations, ...k.warnings].map(s => `・${s}`).join('<br>')}
         </div>`
      : '';

    const urgentBadge = a.urgent ? `<span class="dnd-detail-urgent-badge">緊急</span>` : '';
    const confirmedBadge = a.confirmed
      ? `<span style="display:inline-block; padding:3px 10px; background:#16a34a; color:#fff; font-size:11px; font-weight:700; border-radius:12px; margin-left:8px;">✓ 確定済み</span>`
      : `<span style="display:inline-block; padding:3px 10px; background:#dbeafe; color:#1e40af; font-size:11px; font-weight:700; border-radius:12px; margin-left:8px;">📋 未確定</span>`;

    const body = document.getElementById('dnd-detail-body');
    body.innerHTML = `
      <div class="dnd-detail-section">
        <div class="dnd-detail-client">${a.client || a.label}${urgentBadge}</div>
        <div class="dnd-detail-route">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
          <span>${a.from || '—'}</span>
          <span class="dnd-detail-route-arrow">→</span>
          <span>${a.to || '—'}</span>
        </div>
        <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
          <span class="dnd-detail-time-pill">⏱ ${a.start}〜${a.end}</span>
          ${confirmedBadge}
        </div>
      </div>

      <div class="dnd-detail-section">
        <div class="dnd-detail-section-title">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2.5"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.38 8.38 0 0 1 13 0"/></svg>
          ドライバー / 車両
        </div>
        <div class="dnd-detail-row"><span class="dnd-detail-label">ドライバー</span><span class="dnd-detail-val">${driver.driver}</span></div>
        <div class="dnd-detail-row"><span class="dnd-detail-label">車両</span><span class="dnd-detail-val">${driver.vehicle}</span></div>
        <div class="dnd-detail-row"><span class="dnd-detail-label">車格 / 積載</span><span class="dnd-detail-val">${driver.type} / ${(driver.maxLoad/1000).toFixed(0)}t</span></div>
        ${driver.partner ? `<div class="dnd-detail-row"><span class="dnd-detail-label">区分</span><span class="dnd-detail-val" style="color:#9333ea; font-weight:700;">傭車（${driver.partnerName}）</span></div>` : ''}
      </div>

      <div class="dnd-detail-section">
        <div class="dnd-detail-section-title">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2.5"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M8 8V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3"/></svg>
          荷物・条件
        </div>
        <div class="dnd-detail-row"><span class="dnd-detail-label">荷姿</span><span class="dnd-detail-val">${a.goods || '—'}</span></div>
        <div class="dnd-detail-row"><span class="dnd-detail-label">納期</span><span class="dnd-detail-val">${a.deadline || '—'}</span></div>
        ${caseObj ? `<div class="dnd-detail-row"><span class="dnd-detail-label">案件番号</span><span class="dnd-detail-val" style="font-family:'Inter',sans-serif; font-size:11px;">${caseObj.id}</span></div>` : ''}
        ${caseObj && caseObj.priority ? `<div class="dnd-detail-row"><span class="dnd-detail-label">優先度</span><span class="dnd-detail-val">${caseObj.priority}</span></div>` : ''}
      </div>

      <div class="dnd-detail-section">
        <div class="dnd-detail-section-title">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          改善基準告示（2024年問題）
        </div>
        ${lawChip}
        ${lawDetail}
      </div>
    `;

    // アクションボタン
    const actions = document.getElementById('dnd-detail-actions');
    // リレー追加ボタン：確定前 & リレー輸送が編集可能な案件のみ表示
    const canAddRelay = !a.confirmed && !a.isPreset;
    const relayBtn = canAddRelay ? `
      <button class="dnd-detail-btn relay-add" onclick="openRelayAddPickerFromDetail('${driverId}', ${blockIdx})"
              title="この案件にリレー区間を追加して、別のドライバー・車両を割り当てる">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="5" cy="12" r="3"/><circle cx="19" cy="12" r="3"/><path d="M8 12h8M12 7v2M12 15v2"/>
        </svg>
        リレー追加
      </button>
    ` : '';
    if (a.confirmed) {
      actions.innerHTML = `
        <button class="dnd-detail-btn secondary" onclick="closeDndDetailPane()">閉じる</button>
        <button class="dnd-detail-btn primary" disabled>✓ 確定済み</button>
      `;
    } else {
      actions.innerHTML = `
        <button class="dnd-detail-btn secondary" onclick="closeDndDetailPane()">閉じる</button>
        ${relayBtn}
        <button class="dnd-detail-btn partner" onclick="dispatchBlockToPartner('${driverId}', ${blockIdx})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>
          協力会社へ
        </button>
        <button class="dnd-detail-btn primary" onclick="confirmSingleBlock('${driverId}', ${blockIdx})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          この案件を確定
        </button>
      `;
    }

    document.getElementById('dnd-detail-pane').classList.add('open');
  };

  window.closeDndDetailPane = function() {
    document.getElementById('dnd-detail-pane').classList.remove('open');
    openedDetailKey = null;
  };

  // ════════════════════════════════════════════════════════════════
  //  単独確定（詳細ペインからの確定ボタン）
  // ════════════════════════════════════════════════════════════════
  window.confirmSingleBlock = function(driverId, blockIdx) {
    pushHistory();
    const currentKey = window.dndGetCurrentDateKey();
    const arr = (window.dndAssignments[driverId] && window.dndAssignments[driverId][currentKey]) || [];
    const a = arr[blockIdx];
    if (!a || a.isPreset || a.confirmed) return;
    a.confirmed = true;
    a.confirmedAt = new Date().toISOString();
    const driver = (window.dndDrivers || []).find(d => d.id === driverId);

    // 個別案件処理側を「処理済み」に移動（連動）
    let movedMsg = '';
    if (a.caseListId && typeof window.dndCaseToProcessed === 'function') {
      try {
        window.dndCaseToProcessed(a.caseListId, driverId, currentKey, a.start, a.end);
        movedMsg = ' ｜ 個別案件処理「処理済み」に移動しました';
      } catch(e) { console.warn('dndCaseToProcessed error:', e); }
    }

    if (typeof showDndToast === 'function') {
      showDndToast(`✓ ${a.client || a.label} を確定 — ${driver ? driver.driver : ''} へ指示送信${movedMsg}`);
    }
    closeDndDetailPane();
    if (typeof renderDnd === 'function') renderDnd();
    // 個別案件処理ページが開いていれば再描画
    refreshCasesPageIfOpen();
    refreshWarningBar();
  };

  // 個別案件処理ページが現在表示されていれば、各フェーズリストと件数を更新する
  function refreshCasesPageIfOpen() {
    const casesPage = document.getElementById('page-cases');
    if (!casesPage || !casesPage.classList.contains('active')) {
      // 表示されていなくても件数バッジは更新（updatePhaseCounts は配車計画表バッジも更新）
      if (typeof window.updatePhaseCounts === 'function') {
        try { window.updatePhaseCounts(); } catch(e) {}
      }
      return;
    }
    try {
      if (typeof window.renderUnprocessedList === 'function') window.renderUnprocessedList();
      if (typeof window.renderProcessingList === 'function') window.renderProcessingList();
      if (typeof window.renderProcessedList === 'function') window.renderProcessedList();
      if (typeof window.updatePhaseCounts === 'function') window.updatePhaseCounts();
    } catch(e) { console.warn('refreshCasesPageIfOpen error:', e); }
  }

  // ════════════════════════════════════════════════════════════════
  //  配車表からの協力会社依頼分岐
  // ════════════════════════════════════════════════════════════════
  window.dispatchBlockToPartner = function(driverId, blockIdx) {
    const currentKey = window.dndGetCurrentDateKey();
    const arr = (window.dndAssignments[driverId] && window.dndAssignments[driverId][currentKey]) || [];
    const a = arr[blockIdx];
    if (!a) return;

    // 個別案件処理ページの該当インデックスを探す
    let caseIdx = -1;
    if (a.caseListId && typeof window.processingCases !== 'undefined') {
      caseIdx = window.processingCases.findIndex(c => c.id === a.caseListId);
    }

    // 【フォールバック】紐付いていない場合はその場で processingCases に自動登録
    if (caseIdx < 0 && typeof linkDndCaseToProcessing === 'function') {
      try {
        const driver = (window.dndDrivers || []).find(d => d.id === driverId);
        // ブロック情報から仮想caseObjを作って紐付け
        const tempCaseObj = {
          id: a.caseId || ('block-' + driverId + '-' + blockIdx),
          client: a.client || a.label || '案件',
          from: a.from || '—',
          to: a.to || '—',
          goods: a.goods || '—',
          deadline: a.deadline || '—',
          urgent: !!a.urgent,
          color: a.color
        };
        const linkedId = linkDndCaseToProcessing(tempCaseObj, {
          driverId, driver, start: a.start, end: a.end, dateKey: currentKey
        });
        if (linkedId) {
          a.caseListId = linkedId;
          // dndUnassignedCases 側にも反映（あれば）
          if (typeof window.dndUnassignedCases !== 'undefined') {
            const card = window.dndUnassignedCases.find(x => x.id === a.caseId);
            if (card) { card.caseListId = linkedId; card.originalPhase = 'processing'; }
          }
          caseIdx = window.processingCases.findIndex(c => c.id === linkedId);
          if (typeof showDndToast === 'function') {
            showDndToast(`📋 ${tempCaseObj.client} を個別案件処理「処理中」へ自動連動しました`);
          }
        }
      } catch(e) {
        console.warn('[auto-link on partner] failed:', e);
      }
    }

    if (caseIdx >= 0 && typeof window.openPartnerModal === 'function') {
      closeDndDetailPane();
      // 協力会社依頼モーダルを起動（個別案件処理側の既存フローを再利用）
      window.openPartnerModal(caseIdx, 'processing');
      if (typeof showDndToast === 'function') {
        showDndToast(`🤝 ${a.client || a.label} を協力会社依頼フローへ`);
      }
    } else {
      if (typeof showDndToast === 'function') {
        showDndToast('協力会社依頼を起動できませんでした。案件情報が不完全な可能性があります', true);
      }
    }
  };

  // ════════════════════════════════════════════════════════════════
  //  一括確定モーダル
  // ════════════════════════════════════════════════════════════════
  window.openBulkConfirmModal = function() {
    const currentKey = window.dndGetCurrentDateKey();
    // 対象を収集
    const targets = []; // { driverId, idx, a, kaizenLevel, kaizenIssues }
    if (bulkSelectMode && bulkSelected.size > 0) {
      bulkSelected.forEach(key => {
        const [driverId, idxStr] = key.split('|');
        const idx = parseInt(idxStr, 10);
        const arr = (window.dndAssignments[driverId] && window.dndAssignments[driverId][currentKey]) || [];
        const a = arr[idx];
        if (a && !a.isPreset && !a.confirmed) {
          const k = (typeof window.kaizenCheck === 'function')
            ? window.kaizenCheck(driverId, currentKey, null) : { level: 'ok', violations: [], warnings: [] };
          targets.push({ driverId, idx, a, kaizenLevel: k.level, kaizenIssues: [...k.violations, ...k.warnings] });
        }
      });
    } else {
      // 当日の未確定すべて
      (window.dndDrivers || []).forEach(d => {
        const arr = (window.dndAssignments[d.id] && window.dndAssignments[d.id][currentKey]) || [];
        arr.forEach((a, idx) => {
          if (a.isPreset || a.confirmed) return;
          const k = (typeof window.kaizenCheck === 'function')
            ? window.kaizenCheck(d.id, currentKey, null) : { level: 'ok', violations: [], warnings: [] };
          targets.push({ driverId: d.id, idx, a, kaizenLevel: k.level, kaizenIssues: [...k.violations, ...k.warnings] });
        });
      });
    }

    if (targets.length === 0) {
      if (typeof showDndToast === 'function') showDndToast('確定対象がありません', true);
      return;
    }

    window._bulkConfirmTargets = targets;

    // サマリー
    const summary = document.getElementById('bulk-confirm-summary');
    const dateD = new Date(currentKey + 'T00:00:00');
    const dateStr = dateD.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
    summary.innerHTML = `
      <div style="font-size:12px; color:#6b7280; margin-bottom:4px;">${dateStr} の配車</div>
      <div style="font-size:18px; font-weight:700; color:#111827;">
        <span style="font-family:'Inter',sans-serif; color:var(--orange); font-size:24px;">${targets.length}</span> 件の案件を一括仮確定します
      </div>
    `;

    // 警告セクション
    const warnCount = targets.filter(t => t.kaizenLevel !== 'ok').length;
    const warnSec = document.getElementById('bulk-confirm-warn-section');
    if (warnCount > 0) {
      warnSec.style.display = 'block';
      const violations = targets.filter(t => t.kaizenLevel === 'violation').length;
      const warns = targets.filter(t => t.kaizenLevel === 'warn').length;
      document.getElementById('bulk-confirm-warn-count').textContent =
        `${warnCount} 件に法令チェックの指摘あり` +
        (violations > 0 ? `（違反 ${violations} 件）` : '') +
        (warns > 0 ? `（注意 ${warns} 件）` : '');
    } else {
      warnSec.style.display = 'none';
    }

    // リスト
    const listEl = document.getElementById('bulk-confirm-list');
    listEl.innerHTML = targets.map(t => {
      const driver = (window.dndDrivers || []).find(d => d.id === t.driverId);
      const lawStatus = t.kaizenLevel === 'violation'
        ? `<span class="bulk-confirm-status warn">⚠ 違反</span>`
        : t.kaizenLevel === 'warn'
        ? `<span class="bulk-confirm-status warn">! 注意</span>`
        : `<span class="bulk-confirm-status ok">✓ 適合</span>`;
      return `<div class="bulk-confirm-item ${t.kaizenLevel !== 'ok' ? 'has-warn' : ''}">
        <div class="bulk-confirm-color" style="background:${t.a.color}"></div>
        <div class="bulk-confirm-main">
          <div class="bulk-confirm-client">${t.a.client || t.a.label}</div>
          <div class="bulk-confirm-meta">${driver ? driver.driver : '—'} / ${driver ? driver.vehicle : '—'}${t.a.from && t.a.to ? ' · ' + t.a.from.replace(/.*?[都道府県]/,'') + ' → ' + t.a.to.replace(/.*?[都道府県]/,'') : ''}</div>
          ${t.kaizenIssues.length > 0 ? `<div style="font-size:10px; color:#92400e; margin-top:3px;">${t.kaizenIssues.slice(0,2).join(' / ')}</div>` : ''}
        </div>
        <div class="bulk-confirm-time">${t.a.start}〜${t.a.end}</div>
        ${lawStatus}
      </div>`;
    }).join('');

    document.getElementById('bulk-confirm-modal').classList.add('open');
  };

  window.executeBulkConfirm = function() {
    const targets = window._bulkConfirmTargets || [];
    if (targets.length === 0) return;
    pushHistory();
    const currentKey = window.dndGetCurrentDateKey();
    const now = new Date().toISOString();
    let movedCount = 0;
    targets.forEach(t => {
      const arr = (window.dndAssignments[t.driverId] && window.dndAssignments[t.driverId][currentKey]) || [];
      const a = arr[t.idx];
      if (a && !a.isPreset && !a.confirmed) {
        a.confirmed = true;
        a.confirmedAt = now;
        // 個別案件処理側を「処理済み」に移動
        if (a.caseListId && typeof window.dndCaseToProcessed === 'function') {
          try {
            window.dndCaseToProcessed(a.caseListId, t.driverId, currentKey, a.start, a.end);
            movedCount++;
          } catch(e) { console.warn('dndCaseToProcessed error:', e); }
        }
      }
    });
    if (typeof window.closeModal === 'function') window.closeModal('bulk-confirm-modal');
    else document.getElementById('bulk-confirm-modal').classList.remove('open');

    // 選択モード解除
    if (bulkSelectMode) window.toggleBulkSelectMode();

    if (typeof showDndToast === 'function') {
      const movedMsg = movedCount > 0 ? ` ｜ ${movedCount} 件を個別案件処理「処理済み」へ移動` : '';
      showDndToast(`✓ ${targets.length} 件を一括仮確定${movedMsg}`);
    }
    if (typeof renderDnd === 'function') renderDnd();
    refreshCasesPageIfOpen();
    refreshWarningBar();
  };

  // ════════════════════════════════════════════════════════════════
  //  既存renderDndへのフック：確定ブロック表示・選択状態反映
  // ════════════════════════════════════════════════════════════════
  function applyBlockDecorations() {
    const currentKey = (typeof window.dndGetCurrentDateKey === 'function')
      ? window.dndGetCurrentDateKey() : null;
    if (!currentKey || !window.dndDrivers) return;
    const rows = document.querySelectorAll('.dnd-row');
    window.dndDrivers.forEach((d, ri) => {
      const row = rows[ri];
      if (!row) return;
      const blocks = row.querySelectorAll('.dnd-block');
      const arr = (window.dndAssignments[d.id] && window.dndAssignments[d.id][currentKey]) || [];
      blocks.forEach((bl, bi) => {
        const a = arr[bi];
        if (!a) return;
        // データ属性
        bl.dataset.preset = a.isPreset ? 'true' : 'false';
        // 確定済みクラス
        bl.classList.toggle('confirmed-block', !!a.confirmed);
        // 選択チェック要素（一括選択モード用）
        if (!bl.querySelector('.dnd-block-select')) {
          const ck = document.createElement('div');
          ck.className = 'dnd-block-select';
          bl.appendChild(ck);
        }
      });
    });
    applyBulkSelectionUI();
  }

  function hookRenderDnd() {
    if (typeof window.renderDnd !== 'function') return;
    if (window.renderDnd._dispatchEnhanced) return;
    const orig = window.renderDnd;
    window.renderDnd = function(...args) {
      const r = orig.apply(this, args);
      // 後処理：ゲージ・装飾・サマリーバー
      try { renderDutyGauges(); } catch(e) { console.warn('renderDutyGauges', e); }
      try { applyBlockDecorations(); } catch(e) { console.warn('applyBlockDecorations', e); }
      try { refreshWarningBar(); } catch(e) { console.warn('refreshWarningBar', e); }
      return r;
    };
    window.renderDnd._dispatchEnhanced = true;
  }

  // 車両並び替え（重量順ソート / 行 D&D 入れ替え）は renderDndTimeline を単独で呼ぶため、
  // 行 HTML が再生成されて装飾（確定済みブロック・選択状態・改善基準告示ゲージ・警告バー）
  // が消えてしまう。renderDndTimeline 自体をラップして毎回再装飾を行う。
  function hookRenderDndTimelineV1() {
    if (typeof window.renderDndTimeline !== 'function') return;
    if (window.renderDndTimeline._dispatchEnhanced) return;
    const orig = window.renderDndTimeline;
    window.renderDndTimeline = function(...args) {
      const r = orig.apply(this, args);
      try { renderDutyGauges(); } catch(e) {}
      try { applyBlockDecorations(); } catch(e) {}
      try { refreshWarningBar(); } catch(e) {}
      return r;
    };
    window.renderDndTimeline._dispatchEnhanced = true;
  }

  // switchDispatchTabのフック（タブ切替時にバーを更新）
  function hookSwitchDispatchTab() {
    if (typeof window.switchDispatchTab !== 'function') return;
    if (window.switchDispatchTab._dispatchEnhanced) return;
    const orig = window.switchDispatchTab;
    window.switchDispatchTab = function(...args) {
      const r = orig.apply(this, args);
      window.currentDispatchTab = args[0];
      setTimeout(refreshWarningBar, 50);
      return r;
    };
    window.switchDispatchTab._dispatchEnhanced = true;
  }

  // switchDispatchSubtabのフック
  function hookSwitchDispatchSubtab() {
    if (typeof window.switchDispatchSubtab !== 'function') return;
    if (window.switchDispatchSubtab._dispatchEnhanced) return;
    const orig = window.switchDispatchSubtab;
    window.switchDispatchSubtab = function(...args) {
      const r = orig.apply(this, args);
      window.currentDispatchSubtab = args[0];
      setTimeout(refreshWarningBar, 50);
      return r;
    };
    window.switchDispatchSubtab._dispatchEnhanced = true;
  }

  // ════════════════════════════════════════════════════════════════
  //  キーボードショートカット
  // ════════════════════════════════════════════════════════════════
  document.addEventListener('keydown', function(e) {
    // input/textarea/contenteditableにフォーカスがある時は無効
    const tgt = e.target;
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
    // 配車計画表ページにいる時のみ
    const dispatchPage = document.getElementById('page-dispatch');
    if (dispatchPage && !dispatchPage.classList.contains('active')) return;
    // モーダルが開いている時はEscのみ受け付ける
    const anyModalOpen = Array.from(document.querySelectorAll('.modal-overlay.open')).length > 0;

    // Ctrl+Z / Cmd+Z
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
      if (anyModalOpen) return;
      e.preventDefault();
      window.undoDispatch();
      return;
    }
    // Ctrl+Shift+Z (Redo)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
      if (anyModalOpen) return;
      e.preventDefault();
      window.redoDispatch();
      return;
    }
    // Ctrl+Enter (一括確定モーダル)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (anyModalOpen) return;
      e.preventDefault();
      window.openBulkConfirmModal();
      return;
    }
    // Ctrl+A (全選択：未確定のみ)
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      if (anyModalOpen) return;
      e.preventDefault();
      if (!bulkSelectMode) window.toggleBulkSelectMode();
      const currentKey = window.dndGetCurrentDateKey();
      bulkSelected.clear();
      (window.dndDrivers || []).forEach(d => {
        const arr = (window.dndAssignments[d.id] && window.dndAssignments[d.id][currentKey]) || [];
        arr.forEach((a, idx) => {
          if (!a.isPreset && !a.confirmed) bulkSelected.add(d.id + '|' + idx);
        });
      });
      applyBulkSelectionUI();
      refreshWarningBar();
      if (typeof showDndToast === 'function') showDndToast(`未確定 ${bulkSelected.size} 件を全選択しました`);
      return;
    }
    // Escape
    if (e.key === 'Escape') {
      const helpModal = document.getElementById('kbd-help-modal');
      if (helpModal && helpModal.classList.contains('open')) {
        helpModal.classList.remove('open');
        return;
      }
      const pane = document.getElementById('dnd-detail-pane');
      if (pane && pane.classList.contains('open')) {
        window.closeDndDetailPane();
        return;
      }
      if (bulkSelectMode) {
        window.toggleBulkSelectMode();
        return;
      }
      return;
    }
    if (anyModalOpen) return;

    // S (選択モード)
    if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      window.toggleBulkSelectMode();
      return;
    }
    // ? (ヘルプ)
    if (e.key === '?') {
      e.preventDefault();
      document.getElementById('kbd-help-modal').classList.add('open');
      return;
    }
    // 矢印キー（前日/翌日）
    if (e.key === 'ArrowLeft') {
      const prev = document.getElementById('dnd-date-prev');
      if (prev && !prev.disabled) { e.preventDefault(); prev.click(); }
      return;
    }
    if (e.key === 'ArrowRight') {
      const next = document.getElementById('dnd-date-next');
      if (next && !next.disabled) { e.preventDefault(); next.click(); }
      return;
    }
  });

  // ════════════════════════════════════════════════════════════════
  //  初期化
  // ════════════════════════════════════════════════════════════════
  function init() {
    hookRenderDnd();
    hookRenderDndTimelineV1();
    hookSwitchDispatchTab();
    hookSwitchDispatchSubtab();
    installHistoryHooks();
    ensureWarningBar();
    // 配車計画表ページが初期表示されていれば、すぐに装飾を反映
    setTimeout(() => {
      if (typeof window.renderDnd === 'function' &&
          typeof window.currentDispatchSubtab !== 'undefined' &&
          window.currentDispatchSubtab === 'dnd') {
        try {
          renderDutyGauges();
          applyBlockDecorations();
          refreshWarningBar();
        } catch(e) { console.warn('init render error', e); }
      }
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();