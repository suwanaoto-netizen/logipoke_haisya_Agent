// ════════════════════════════════════════════════════════════════
//  配車表メイン運用 拡張機能 v2.0
// ════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  // ════════════════════════════════════════════════════════════════
  //  ユーザー / 担当分担モデル
  // ════════════════════════════════════════════════════════════════
  // プロトタイプなので、メンバーリストとして固定で持つ（実運用ではテナント側マスタ）
  const TEAM_MEMBERS = [
    { id: 'me',  name: '配車 太郎',   color: '#1a7a5e', initial: '太' },
    { id: 'u2',  name: '田中 花子',   color: '#dc2626', initial: '田' },
    { id: 'u3',  name: '佐々木 健',   color: '#7c3aed', initial: '佐' },
    { id: 'u4',  name: '吉田 美咲',   color: '#0891b2', initial: '吉' },
  ];
  const CURRENT_USER_ID = 'me';

  // ドライバー担当割当（プロトタイプ初期値：50台を4人のチームに分散）
  // 「自分(me)」が一定数（約14-15台）担当する設定
  // 実運用ではバックエンド保存
  let driverOwners = (function() {
    const owners = {};
    const memberIds = TEAM_MEMBERS.map(m => m.id); // ['me', 'u2', 'u3', 'u4']
    const drivers = (typeof dndDrivers !== 'undefined') ? dndDrivers : [];
    drivers.forEach((d, i) => {
      // 担当未設定を少しだけ含める（5台に1台）
      if (i % 17 === 13) return; // ~3台は未設定のまま
      // 4人のメンバーに分散
      owners[d.id] = memberIds[i % memberIds.length];
    });
    return owners;
  })();

  // ─────────────────────────────────────────────────────────────
  // Phase 1a：新マスタ drivers[] の defaultOwnerId を driverOwners から逆引きして埋める
  // dndDrivers[].id は 'V'+車両番号 形式（=vehicleIdと一致）。同じインデックスの
  // 新drivers[i] に対応するため、_legacyDriverIdToNew 経由でマッピングする
  // ─────────────────────────────────────────────────────────────
  (function _initDefaultOwnerIds() {
    if (typeof window === 'undefined') return;
    if (typeof drivers === 'undefined' || !Array.isArray(window.bases)) return;
    if (typeof _legacyDriverIdToNew !== 'function') return;
    for (const legacyId in driverOwners) {
      const newDriverId = _legacyDriverIdToNew(legacyId);
      if (!newDriverId) continue;
      const d = drivers.find(x => x.id === newDriverId);
      if (d) d.defaultOwnerId = driverOwners[legacyId];
    }
  })();

  // ロック（編集中ドライバー）：プロトタイプでは「田中さんが特定車両を編集中」を模擬
  // 実運用では WebSocket / Presence で同期
  // 注意：dndDrivers の id と一致している必要があるので、生成された ID を参照
  let driverLocks = (function() {
    const drivers = (typeof dndDrivers !== 'undefined') ? dndDrivers : [];
    if (drivers.length < 16) return {};
    // 15番目のドライバー（佐藤あたり）を u2 が編集中、と模擬
    const target = drivers[15];
    if (!target) return {};
    return {
      [target.id]: { userId: 'u2', startedAt: Date.now() - 60000 }
    };
  })();

  // 担当フィルタ：'all' | 'mine' | userId
  // 初期は「自分の担当」を選択した状態で表示
  let assignFilter = 'mine';

  // ─────────────────────────────────────────────────────────────
  // Phase 1b：軸フィルタ拡張
  // 既存の assignFilter は後方互換のため残し、軸モード（filterAxis）と
  // 軸ごとの選択値（filterValue）を追加。'owner' 軸時は assignFilter と filterValue が同期する。
  //
  // 論点5：排他（同時には効かせない）
  // 軸ごとの直近選択値は lastFilterValues に記憶（軸切替時に復元）
  // ─────────────────────────────────────────────────────────────
  let filterAxis = 'owner';     // 'owner' | 'base' | 'all'
  let filterValue = 'mine';     // 軸に応じた値
  let lastFilterValues = {
    owner: 'mine',              // owner軸の直近選択：'all'|'mine'|'unassigned'|userId
    base:  'all'                // base軸の直近選択：'all'|baseId|'__cross__'|'__partner__'
  };


  // 送信ログ
  let sendLogs = [];
  // 予約送信タイマーID
  let scheduledTimers = [];

  // 一括確定モーダル用：送信スケジュール
  let bulkSendSchedule = { mode: 'immediate', at: null }; // 'immediate' | 'in1h' | 'morning' | 'custom'

  // ユーティリティ
  function getMember(id) { return TEAM_MEMBERS.find(m => m.id === id) || null; }
  function ownerOf(driverId) { return driverOwners[driverId] || null; }
  function isLockedByOther(driverId) {
    const lock = driverLocks[driverId];
    return lock && lock.userId !== CURRENT_USER_ID;
  }
  function canEditDriver(driverId) {
    if (isLockedByOther(driverId)) return false;
    const owner = ownerOf(driverId);
    // 担当未設定なら誰でも編集可。担当設定済みなら担当者のみ。
    if (!owner) return true;
    return owner === CURRENT_USER_ID;
  }

  // ════════════════════════════════════════════════════════════════
  //  担当フィルタバーの設置
  // ════════════════════════════════════════════════════════════════
  function ensureAssignFilterBar() {
    if (document.getElementById('assign-filter-bar')) return;
    const wb = document.getElementById('dispatch-warning-bar');
    if (!wb) return;
    const bar = document.createElement('div');
    bar.className = 'assign-filter-bar';
    bar.id = 'assign-filter-bar';
    bar.innerHTML = `
      <div class="afb-axis-segment" id="afb-axis-segment" role="tablist" aria-label="絞り込み軸">
        <span class="afb-axis-item ${filterAxis==='owner'?'active':''}" data-axis="owner" onclick="window.setFilterAxis('owner')" role="tab" aria-selected="${filterAxis==='owner'}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          担当
        </span>
        <span class="afb-axis-item ${filterAxis==='base'?'active':''}" data-axis="base" onclick="window.setFilterAxis('base')" role="tab" aria-selected="${filterAxis==='base'}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h2M9 13h2M9 17h2M13 9h2M13 13h2M13 17h2"/></svg>
          拠点
        </span>
        <span class="afb-axis-item ${filterAxis==='all'?'active':''}" data-axis="all" onclick="window.setFilterAxis('all')" role="tab" aria-selected="${filterAxis==='all'}">
          すべて
        </span>
      </div>
      <div class="afb-axis-divider"></div>
      <div class="afb-chips" id="afb-chips"></div>
      <div class="afb-current-user" onclick="openSendLogModal()" title="クリックで指示送信ログを表示">
        <span class="afb-current-user-avatar">${getMember(CURRENT_USER_ID).initial}</span>
        <span>${getMember(CURRENT_USER_ID).name}</span>
        <span style="color:#94a3b8;">|</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.35 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 5.5 5.5l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        <span>送信ログ</span>
      </div>
    `;
    wb.parentNode.insertBefore(bar, wb.nextSibling);
    refreshAssignFilterBar();
  }

  function refreshAssignFilterBar() {
    // 軸セグメントの active 状態を同期
    const seg = document.getElementById('afb-axis-segment');
    if (seg) {
      seg.querySelectorAll('.afb-axis-item').forEach(el => {
        const axis = el.getAttribute('data-axis');
        el.classList.toggle('active', axis === filterAxis);
        el.setAttribute('aria-selected', axis === filterAxis ? 'true' : 'false');
      });
    }

    const chipsEl = document.getElementById('afb-chips');
    if (!chipsEl) return;

    // 軸セグメントの右隣のディバイダを「すべて」モード時は非表示にして余白を返却
    const divider = document.querySelector('#assign-filter-bar .afb-axis-divider');
    if (divider) divider.style.display = (filterAxis === 'all' ? 'none' : '');

    // 「すべて」モード：チップ群を空にして、タイムラインに余白を返却
    if (filterAxis === 'all') {
      chipsEl.innerHTML = '';
      return;
    }

    // ─── 担当軸 ───
    if (filterAxis === 'owner') {
      // 各担当のドライバー数を計算
      const counts = { all: 0, mine: 0 };
      TEAM_MEMBERS.forEach(m => { counts[m.id] = 0; });
      (window.dndDrivers || []).forEach(d => {
        counts.all++;
        const owner = ownerOf(d.id);
        if (owner === CURRENT_USER_ID) counts.mine++;
        if (owner) counts[owner] = (counts[owner] || 0) + 1;
      });
      const unassignedCount = (window.dndDrivers || []).filter(d => !ownerOf(d.id)).length;

      const chips = [
        `<span class="afb-chip ${filterValue==='all'?'active':''}" onclick="window.setAssignFilter('all')">すべて<span class="afb-chip-count">${counts.all}</span></span>`,
        `<span class="afb-chip ${filterValue==='mine'?'active':''}" onclick="window.setAssignFilter('mine')">自分の担当<span class="afb-chip-count">${counts.mine}</span></span>`,
      ];
      TEAM_MEMBERS.forEach(m => {
        if (m.id === CURRENT_USER_ID) return;
        if (counts[m.id] === 0) return;
        chips.push(`<span class="afb-chip ${filterValue===m.id?'active':''}" onclick="window.setAssignFilter('${m.id}')">${m.name}<span class="afb-chip-count">${counts[m.id]}</span></span>`);
      });
      if (unassignedCount > 0) {
        chips.push(`<span class="afb-chip ${filterValue==='unassigned'?'active':''}" onclick="window.setAssignFilter('unassigned')">未割当<span class="afb-chip-count">${unassignedCount}</span></span>`);
      }
      chipsEl.innerHTML = chips.join('');
      return;
    }

    // ─── 拠点軸 ───
    if (filterAxis === 'base') {
      // 各拠点のドライバー数を計算（dndDrivers経由でマスタ参照）
      const counts = { __all: 0, __partner: 0, __cross: 0, __unset: 0 };
      (window.bases || []).forEach(b => { counts[b.id] = 0; });
      (window.dndDrivers || []).forEach(d => {
        counts.__all++;
        // 拠点判定：マスタ参照
        const driverId = d._driverId;
        const masterDriver = driverId ? (typeof getDriverById === 'function' ? getDriverById(driverId) : null) : null;
        if (masterDriver && masterDriver.partner) {
          counts.__partner++;
          return;
        }
        const baseId = masterDriver ? masterDriver.baseId : null;
        if (!baseId) counts.__unset++;
        else if (counts[baseId] !== undefined) counts[baseId]++;
      });
      // クロス配車件数：当日の Assignment から計算
      try {
        const todayKey = (typeof window.dndGetCurrentDateKey === 'function')
          ? window.dndGetCurrentDateKey()
          : new Date().toISOString().slice(0, 10);
        const todays = (typeof window.getAssignmentsForDate === 'function')
          ? window.getAssignmentsForDate(todayKey) : [];
        counts.__cross = todays.filter(a => a.crossBase).length;
      } catch (e) {
        counts.__cross = 0;
      }

      const chips = [
        `<span class="afb-chip ${filterValue==='all'?'active':''}" onclick="window.setAssignFilter('all')">すべて<span class="afb-chip-count">${counts.__all}</span></span>`,
      ];
      // 拠点チップ（件数が0でも表示しないと無味乾燥になるので、件数>0のもののみ）
      (window.bases || []).forEach(b => {
        if (counts[b.id] === 0) return;
        const dotColor = _baseColorForChip(b.id);
        chips.push(`<span class="afb-chip ${filterValue===b.id?'active':''}" onclick="window.setAssignFilter('${b.id}')"><span class="afb-chip-base-dot" style="background:${dotColor}"></span>${b.name.replace(/拠点$/, '')}<span class="afb-chip-count">${counts[b.id]}</span></span>`);
      });
      // 拠点未設定（自社で baseId なし。協力会社以外）
      if (counts.__unset > 0) {
        chips.push(`<span class="afb-chip ${filterValue==='__unset'?'active':''}" onclick="window.setAssignFilter('__unset')">拠点未設定<span class="afb-chip-count">${counts.__unset}</span></span>`);
      }
      // 区切り線 → 特殊チップ
      if (counts.__cross > 0 || counts.__partner > 0) {
        chips.push(`<span class="afb-chip-separator" aria-hidden="true"></span>`);
      }
      if (counts.__cross > 0) {
        chips.push(`<span class="afb-chip afb-chip-cross ${filterValue==='__cross'?'active':''}" onclick="window.setAssignFilter('__cross')" title="ドライバーと車両の拠点が異なる配車"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>クロス配車<span class="afb-chip-count">${counts.__cross}</span></span>`);
      }
      if (counts.__partner > 0) {
        chips.push(`<span class="afb-chip afb-chip-partner ${filterValue==='__partner'?'active':''}" onclick="window.setAssignFilter('__partner')" title="協力会社ドライバー">協力会社<span class="afb-chip-count">${counts.__partner}</span></span>`);
      }
      chipsEl.innerHTML = chips.join('');
      return;
    }
  }

  // 拠点ごとのカラーパレット（最大8拠点）
  const _BASE_COLOR_PALETTE = ['#1a7a5e','#2563eb','#d97706','#7c3aed','#0891b2','#dc2626','#65a30d','#be185d'];
  function _baseColorForChip(baseId) {
    const idx = (window.bases || []).findIndex(b => b.id === baseId);
    if (idx < 0) return '#94a3b8';
    return _BASE_COLOR_PALETTE[idx % _BASE_COLOR_PALETTE.length];
  }
  // applyOwnerVisuals 側からも参照したいので公開
  if (typeof window !== 'undefined') window.__baseColorForChip = _baseColorForChip;

  window.setAssignFilter = function(f) {
    // Phase 1b: 軸ごとの値を保存しつつ、後方互換のため assignFilter も同期
    filterValue = f;
    lastFilterValues[filterAxis] = f;
    // 後方互換：owner軸の時は assignFilter と同期。base軸時は 'all' にして既存の担当フィルタを無効化
    if (filterAxis === 'owner') {
      assignFilter = f;
    } else {
      assignFilter = 'all';
    }
    refreshAssignFilterBar();
    applyOwnerVisuals();
    // 運行スケジュール側も再描画
    if (typeof window.applyScheduleFilter === 'function') {
      window.applyScheduleFilter();
    }
  };

  // 軸セグメント切替（論点5：排他。軸変更時は前軸の値を記憶し、新軸の直近値を復元）
  window.setFilterAxis = function(axis) {
    if (axis !== 'owner' && axis !== 'base' && axis !== 'all') return;
    if (axis === filterAxis) return;
    // 軽いトランジション
    const chipsEl = document.getElementById('afb-chips');
    if (chipsEl) chipsEl.classList.add('switching');
    // 現軸の選択値を記憶
    if (filterAxis !== 'all') lastFilterValues[filterAxis] = filterValue;
    filterAxis = axis;
    // 新軸の直近値を復元（'all' 軸はフィルタ無効）
    if (axis === 'all') {
      filterValue = null;
      assignFilter = 'all';
    } else {
      filterValue = lastFilterValues[axis] || 'all';
      assignFilter = (axis === 'owner') ? filterValue : 'all';
    }
    // 短い遅延を入れてアニメーションを見せる
    setTimeout(() => {
      refreshAssignFilterBar();
      applyOwnerVisuals();
      if (typeof window.applyScheduleFilter === 'function') {
        window.applyScheduleFilter();
      }
      if (chipsEl) chipsEl.classList.remove('switching');
    }, 130);
  };

  // ── 運行スケジュール側からアクセスするためのグローバルブリッジ ──
  window.__getAssignFilter = function() { return assignFilter; };
  window.__getDriverOwner  = function(driverId) { return ownerOf(driverId); };
  window.__getTeamMember   = function(memberId) { return getMember(memberId); };
  window.__getCurrentUserId = function() { return CURRENT_USER_ID; };
  window.__isLockedByOther = function(driverId) { return isLockedByOther(driverId); };
  window.__getDriverLock   = function(driverId) { return driverLocks[driverId] || null; };
  window.__ensureAssignFilterBar = function() { ensureAssignFilterBar(); };
  window.__refreshAssignFilterBar = function() { refreshAssignFilterBar(); };
  window.__openOwnerPicker = function(driverId, anchorEl) { openOwnerPicker(driverId, anchorEl); };
  // Phase 1b：軸フィルタ関連
  window.__getFilterAxis = function() { return filterAxis; };
  window.__getFilterValue = function() { return filterValue; };

  // ════════════════════════════════════════════════════════════════
  //  ドライバー行に担当バッジ・ロック表示
  //  Phase 1b：拠点バッジ・クロス配車インジケータ・拠点フィルタも統合
  // ════════════════════════════════════════════════════════════════
  function applyOwnerVisuals() {
    if (typeof window.dndDrivers === 'undefined') return;
    const isConfirmedTab = window.currentDispatchTab === 'confirmed';
    const rows = document.querySelectorAll('.dnd-row');
    window.dndDrivers.forEach((d, i) => {
      const row = rows[i];
      if (!row) return;
      const cell = row.querySelector('.dnd-driver-cell');
      const track = row.querySelector('.dnd-track');
      if (!cell || !track) return;

      // ── 既存の担当バッジを削除して再設置 ──
      const oldBadge = cell.querySelector('.dnd-owner-badge');
      if (oldBadge) oldBadge.remove();

      const ownerId = ownerOf(d.id);
      const owner = ownerId ? getMember(ownerId) : null;
      const isMine = ownerId === CURRENT_USER_ID;
      const badge = document.createElement('div');
      badge.className = 'dnd-owner-badge ' + (isMine ? 'mine' : (owner ? '' : 'unassigned'));
      if (owner) {
        badge.innerHTML = `<span class="dnd-owner-avatar" style="background:${owner.color}">${owner.initial}</span><span>${owner.name}</span>`;
      } else {
        badge.innerHTML = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="7" r="4"/></svg><span>担当未設定</span>`;
      }
      // 確定済みタブでは担当変更不可（参照のみ）
      if (!isConfirmedTab) {
        badge.title = 'クリックで担当者を変更';
        badge.onclick = function(e) {
          e.stopPropagation();
          openOwnerPicker(d.id, badge);
        };
      } else {
        badge.style.cursor = 'default';
      }
      cell.appendChild(badge);

      // ── ロック表示 ──
      row.classList.remove('locked-by-other');
      const lock = driverLocks[d.id];
      if (lock && lock.userId !== CURRENT_USER_ID) {
        const lockUser = getMember(lock.userId);
        row.classList.add('locked-by-other');
        track.setAttribute('data-lock-by', lockUser ? lockUser.name : '他ユーザー');
      } else {
        track.removeAttribute('data-lock-by');
      }

      // ─────────────────────────────────────────────────────────
      // Phase 1b：拠点バッジ・クロス配車インジケータ
      // ドライバーセルの line2 に挿入（既存ステータス・車種等の隣）
      // ─────────────────────────────────────────────────────────
      const line2 = cell.querySelector('.dnd-driver-line2');
      if (line2) {
        // 既存のPhase 1b要素を一旦削除
        line2.querySelectorAll('.dnd-base-badge, .dnd-cross-indicator').forEach(el => el.remove());

        // マスタからドライバー・車両の拠点情報を取得
        const masterDriver = d._driverId && typeof getDriverById === 'function'
          ? getDriverById(d._driverId) : null;
        const masterVehicle = d._vehicleId && typeof getVehicleById === 'function'
          ? getVehicleById(d._vehicleId) : null;

        // 当日のAssignment（存在すれば effectiveBaseId が運用拠点）
        const todayKey = (typeof window.dndGetCurrentDateKey === 'function')
          ? window.dndGetCurrentDateKey()
          : new Date().toISOString().slice(0, 10);
        let effBaseId = null;
        let isCross = false;
        if (typeof window.getAssignmentByDriverAndDate === 'function' && masterDriver) {
          const a = window.getAssignmentByDriverAndDate(masterDriver.id, todayKey);
          if (a) {
            effBaseId = a.effectiveBaseId;
            isCross = !!a.crossBase;
          }
        }
        // Assignmentがない日は、ドライバーの拠点をデフォルト表示
        if (!effBaseId) {
          effBaseId = masterDriver ? masterDriver.baseId : null;
        }

        // 拠点バッジを作成
        const baseBadge = document.createElement('span');
        baseBadge.className = 'dnd-base-badge';
        if (masterDriver && masterDriver.partner) {
          baseBadge.classList.add('dnd-base-partner');
          baseBadge.innerHTML = '<span class="dnd-base-dot"></span>協力会社';
          baseBadge.title = '協力会社：' + (masterDriver.partnerName || '');
        } else if (effBaseId) {
          const base = typeof getBaseById === 'function' ? getBaseById(effBaseId) : null;
          const color = (typeof window.__baseColorForChip === 'function')
            ? window.__baseColorForChip(effBaseId) : '#475569';
          baseBadge.style.color = color;
          baseBadge.style.background = color + '1a';
          baseBadge.innerHTML = '<span class="dnd-base-dot"></span>' + (base ? base.name.replace(/拠点$/, '') : effBaseId);
          baseBadge.title = base ? base.name : effBaseId;
        } else {
          baseBadge.classList.add('dnd-base-unset');
          baseBadge.innerHTML = '<span class="dnd-base-dot"></span>未設定';
          baseBadge.title = '拠点が設定されていません';
        }
        line2.appendChild(baseBadge);

        // クロス配車インジケータ
        if (isCross && masterDriver && masterVehicle) {
          const ind = document.createElement('span');
          ind.className = 'dnd-cross-indicator';
          ind.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>';
          const dBaseName = masterDriver.baseId ? (getBaseById(masterDriver.baseId) || {}).name : '拠点未設定';
          const vBaseName = masterVehicle.baseId ? (getBaseById(masterVehicle.baseId) || {}).name : '拠点未設定';
          const effBaseName = effBaseId ? (getBaseById(effBaseId) || {}).name : '?';
          ind.title = 'クロス配車：' + dBaseName + 'のドライバー × ' + vBaseName + 'の車両（当日運用：' + effBaseName + '）';
          line2.appendChild(ind);
        }

        // 行のクラスにクロス配車を反映（左端のオレンジ線）
        row.classList.toggle('dnd-row-cross-base', isCross);
      }

      // ─────────────────────────────────────────────────────────
      // フィルタ適用：軸モードに応じて表示判定
      // 論点5：軸は排他
      // ─────────────────────────────────────────────────────────
      row.classList.remove('dimmed-by-filter');
      let pass = true;
      if (filterAxis === 'owner') {
        if (filterValue === 'mine') pass = ownerId === CURRENT_USER_ID;
        else if (filterValue === 'unassigned') pass = !ownerId;
        else if (filterValue !== 'all') pass = ownerId === filterValue;
      } else if (filterAxis === 'base') {
        // 拠点軸の判定
        const masterDriver = d._driverId && typeof getDriverById === 'function'
          ? getDriverById(d._driverId) : null;
        const isPartner = masterDriver ? masterDriver.partner : false;
        // クロス配車判定の取り直し（上で計算した isCross を使う）
        const todayKey2 = (typeof window.dndGetCurrentDateKey === 'function')
          ? window.dndGetCurrentDateKey()
          : new Date().toISOString().slice(0, 10);
        let crossNow = false;
        if (typeof window.getAssignmentByDriverAndDate === 'function' && masterDriver) {
          const a = window.getAssignmentByDriverAndDate(masterDriver.id, todayKey2);
          crossNow = !!(a && a.crossBase);
        }
        const driverBaseId = masterDriver ? masterDriver.baseId : null;

        if (filterValue === 'all') pass = true;
        else if (filterValue === '__partner') pass = isPartner;
        else if (filterValue === '__cross') pass = crossNow;
        else if (filterValue === '__unset') pass = !isPartner && !driverBaseId;
        else pass = driverBaseId === filterValue;
      }
      // filterAxis === 'all' のときは全表示（pass=true のまま）
      if (!pass) row.classList.add('dimmed-by-filter');
    });
  }

  // 担当者選択ポップオーバー
  // Phase 1d：担当者を選んだ後にスコープ選択（この日のみ / 今週末まで / 恒久）が出る
  function openOwnerPicker(driverId, anchorEl) {
    const pop = document.getElementById('owner-picker-pop');
    const currentOwner = ownerOf(driverId);
    _renderOwnerPickerMain(pop, driverId, currentOwner);
    const rect = anchorEl.getBoundingClientRect();
    pop.style.display = 'block';
    pop.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    pop.style.left = (rect.left + window.scrollX) + 'px';
    // 範囲外クリックで閉じる
    setTimeout(() => {
      const handler = function(e) {
        if (!pop.contains(e.target) && e.target !== anchorEl) {
          pop.style.display = 'none';
          document.removeEventListener('click', handler, true);
        }
      };
      document.addEventListener('click', handler, true);
    }, 0);
  }

  // 状態：「次に適用する担当者ID」と「スコープ」を保持
  let _ownerPickerPending = null;  // { driverId, ownerId, scope }

  function _renderOwnerPickerMain(pop, driverId, currentOwner) {
    const items = [
      `<div class="owner-picker-item ${!currentOwner?'selected':''}" onclick="window.__ownerPickerPickPerson('${driverId}', null)">
        <span class="owner-picker-item-avatar" style="background:#9ca3af;">—</span>
        <span>担当未設定</span>
      </div>`,
      ...TEAM_MEMBERS.map(m => `
        <div class="owner-picker-item ${currentOwner===m.id?'selected':''}" onclick="window.__ownerPickerPickPerson('${driverId}', '${m.id}')">
          <span class="owner-picker-item-avatar" style="background:${m.color}">${m.initial}</span>
          <span>${m.name}${m.id===CURRENT_USER_ID?' (自分)':''}</span>
        </div>
      `)
    ];
    pop.innerHTML = items.join('');
  }

  // 担当者をクリックされたとき：スコープ選択セクションを下部に追加
  window.__ownerPickerPickPerson = function(driverId, ownerId) {
    const pop = document.getElementById('owner-picker-pop');
    if (!pop) return;
    const currentOwner = ownerOf(driverId);
    // 同じ担当者を選んだ場合は何もしない（誤クリック対策）
    if (ownerId === currentOwner) {
      pop.style.display = 'none';
      return;
    }
    _ownerPickerPending = { driverId, ownerId, scope: 'today' };

    // 既存のスコープセクションを除去
    const oldScope = pop.querySelector('.owner-picker-scope');
    if (oldScope) oldScope.remove();

    // 全アイテムの選択ハイライトを更新
    pop.querySelectorAll('.owner-picker-item').forEach((el, i) => {
      const isSelected = (i === 0 && ownerId === null) ||
        (i > 0 && TEAM_MEMBERS[i-1] && TEAM_MEMBERS[i-1].id === ownerId);
      el.classList.toggle('selected', isSelected);
    });

    const personLabel = ownerId
      ? (getMember(ownerId) ? getMember(ownerId).name : ownerId)
      : '担当未設定';

    // 今日と「週末」（今週の日曜）の日付計算
    const today = new Date();
    const dow = today.getDay(); // 0=日曜
    const daysToSun = (7 - dow) % 7;  // 日曜まで何日（今日が日曜なら 0）
    const weekend = new Date(today);
    weekend.setDate(today.getDate() + daysToSun);
    const fmt = d => `${d.getMonth()+1}/${d.getDate()}`;
    const todayLabel = fmt(today);
    const weekendLabel = fmt(weekend);

    const scopeHtml = `
      <div class="owner-picker-scope">
        <div class="owner-picker-scope-title">「${personLabel}」を担当に：適用範囲</div>
        <div class="owner-picker-scope-options">
          <label class="owner-picker-scope-option">
            <input type="radio" name="ownerScope" value="today" checked onchange="window.__ownerPickerSetScope('today')">
            <div>
              <div>この日のみ（${todayLabel}）</div>
              <div class="owner-picker-scope-hint">今日の Assignment だけ変更</div>
            </div>
          </label>
          <label class="owner-picker-scope-option">
            <input type="radio" name="ownerScope" value="weekend" onchange="window.__ownerPickerSetScope('weekend')">
            <div>
              <div>今週末まで（〜${weekendLabel}）</div>
              <div class="owner-picker-scope-hint">今日から今週日曜までの Assignment</div>
            </div>
          </label>
          <label class="owner-picker-scope-option">
            <input type="radio" name="ownerScope" value="permanent" onchange="window.__ownerPickerSetScope('permanent')">
            <div>
              <div>デフォルト担当も変更（恒久）</div>
              <div class="owner-picker-scope-hint">マスタの担当を更新。今日以降の新規割当に反映</div>
            </div>
          </label>
        </div>
        <div class="owner-picker-scope-actions">
          <button class="owner-picker-scope-btn cancel" onclick="window.__ownerPickerCancel()">キャンセル</button>
          <button class="owner-picker-scope-btn apply" onclick="window.__ownerPickerApply()">適用</button>
        </div>
      </div>
    `;
    pop.insertAdjacentHTML('beforeend', scopeHtml);
  };

  window.__ownerPickerSetScope = function(scope) {
    if (_ownerPickerPending) _ownerPickerPending.scope = scope;
  };

  window.__ownerPickerCancel = function() {
    _ownerPickerPending = null;
    document.getElementById('owner-picker-pop').style.display = 'none';
  };

  window.__ownerPickerApply = function() {
    if (!_ownerPickerPending) return;
    const { driverId, ownerId, scope } = _ownerPickerPending;
    _ownerPickerPending = null;
    _applyOwnerChange(driverId, ownerId, scope);
    document.getElementById('owner-picker-pop').style.display = 'none';
  };

  // 担当者変更の適用本体（スコープ別に処理）
  function _applyOwnerChange(driverId, ownerId, scope) {
    // 旧driverOwners は dndDrivers の id（旧形式）ベース
    const driver = (window.dndDrivers || []).find(d => d.id === driverId);
    const owner = ownerId ? getMember(ownerId) : null;

    // 1) 旧構造の更新：driverOwners（"その日のみ" でも互換のためここを更新する）
    if (ownerId) driverOwners[driverId] = ownerId;
    else delete driverOwners[driverId];

    // 2) スコープ別に Assignment / マスタを更新
    const newDriverId = (typeof _legacyDriverIdToNew === 'function')
      ? _legacyDriverIdToNew(driverId) : null;

    let updatedCount = 0;

    if (newDriverId && typeof assignments !== 'undefined') {
      // 対象日付の範囲を決める
      const today = new Date();
      const todayKey = today.toISOString().slice(0, 10);

      let dateRangeCheck = null;
      if (scope === 'today') {
        dateRangeCheck = (d) => d === todayKey;
      } else if (scope === 'weekend') {
        const dow = today.getDay();
        const daysToSun = (7 - dow) % 7;
        const weekend = new Date(today);
        weekend.setDate(today.getDate() + daysToSun);
        const weekendKey = weekend.toISOString().slice(0, 10);
        dateRangeCheck = (d) => d >= todayKey && d <= weekendKey;
      } else if (scope === 'permanent') {
        // 全期間（過去含む）。Assignmentの ownerId を更新
        dateRangeCheck = () => true;
      }

      assignments.forEach(a => {
        if (a.driverId !== newDriverId) return;
        if (!dateRangeCheck(a.date)) return;
        if (typeof window.updateAssignment === 'function') {
          window.updateAssignment(a.id, {
            ownerId: ownerId,
            mainOwnerId: ownerId
          }, (typeof window.__getCurrentUserId === 'function' ? window.__getCurrentUserId() : null));
          updatedCount++;
        } else {
          a.ownerId = ownerId;
          a.mainOwnerId = ownerId;
        }
      });

      // 恒久変更ならマスタのdefaultOwnerIdも更新
      if (scope === 'permanent' && typeof window.getDriverById === 'function') {
        const masterD = window.getDriverById(newDriverId);
        if (masterD) masterD.defaultOwnerId = ownerId;
      }
    }

    // 3) UI再描画
    refreshAssignFilterBar();
    applyOwnerVisuals();

    // 4) トースト
    if (typeof window.showDndToast === 'function') {
      const scopeLabel = ({today:'この日のみ', weekend:'今週末まで', permanent:'恒久'})[scope] || '';
      const driverLabel = driver ? driver.driver : driverId;
      const msg = owner
        ? `${driverLabel} の担当を ${owner.name} に変更（${scopeLabel}） ／ Assignment ${updatedCount}件 更新`
        : `${driverLabel} の担当を解除（${scopeLabel}） ／ Assignment ${updatedCount}件 更新`;
      window.showDndToast(msg);
    }
  }

  // 互換性：既存の window.assignDriverOwner も生かしておく（直接呼ばれる箇所がある場合のため）
  window.assignDriverOwner = function(driverId, ownerId) {
    _applyOwnerChange(driverId, ownerId, 'today');
    const pop = document.getElementById('owner-picker-pop');
    if (pop) pop.style.display = 'none';
  };

  // ════════════════════════════════════════════════════════════════
  //  ロック取得・解放
  // ════════════════════════════════════════════════════════════════
  // 実運用ではWebSocketで他クライアントに通知。プロトタイプでは自分のロックのみ管理
  function acquireLockIfNeeded(driverId) {
    if (isLockedByOther(driverId)) return false;
    driverLocks[driverId] = { userId: CURRENT_USER_ID, startedAt: Date.now() };
    return true;
  }
  function releaseLock(driverId) {
    const lock = driverLocks[driverId];
    if (lock && lock.userId === CURRENT_USER_ID) {
      delete driverLocks[driverId];
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  既存D&D / 確定処理をフックして編集権限をチェック
  // ════════════════════════════════════════════════════════════════
  function hookEditGuard() {
    // dndTrackDrop：ロック/担当ガード
    if (typeof window.dndTrackDrop === 'function' && !window.dndTrackDrop._ownerGuarded) {
      const orig = window.dndTrackDrop;
      window.dndTrackDrop = function(e, driverId) {
        if (!canEditDriver(driverId)) {
          e.preventDefault();
          const owner = ownerOf(driverId);
          const lock = driverLocks[driverId];
          let msg = 'この車両は編集できません';
          if (lock && lock.userId !== CURRENT_USER_ID) {
            const u = getMember(lock.userId);
            msg = `${u ? u.name : '他ユーザー'} が編集中のためロックされています`;
          } else if (owner && owner !== CURRENT_USER_ID) {
            const u = getMember(owner);
            msg = `この車両の担当は ${u ? u.name : '他ユーザー'} です。担当者しか配車できません`;
          }
          if (typeof window.showDndToast === 'function') window.showDndToast(msg, true);
          // クリーンアップ
          e.currentTarget.classList.remove('drop-hover', 'drop-invalid');
          return;
        }
        // 自分が編集 → ロック取得
        acquireLockIfNeeded(driverId);
        return orig.call(this, e, driverId);
      };
      window.dndTrackDrop._ownerGuarded = true;
    }

    // dndRemoveAssignment：解除も担当ガード
    if (typeof window.dndRemoveAssignment === 'function' && !window.dndRemoveAssignment._ownerGuarded) {
      const orig = window.dndRemoveAssignment;
      window.dndRemoveAssignment = function(driverId, idx) {
        if (!canEditDriver(driverId)) {
          if (typeof window.showDndToast === 'function') {
            window.showDndToast('この車両は担当外のため操作できません', true);
          }
          return;
        }
        return orig.call(this, driverId, idx);
      };
      window.dndRemoveAssignment._ownerGuarded = true;
    }

    // confirmSingleBlock：担当ガード
    if (typeof window.confirmSingleBlock === 'function' && !window.confirmSingleBlock._ownerGuarded) {
      const orig = window.confirmSingleBlock;
      window.confirmSingleBlock = function(driverId, blockIdx) {
        if (!canEditDriver(driverId)) {
          if (typeof window.showDndToast === 'function') {
            window.showDndToast('この車両は担当外のため確定できません', true);
          }
          return;
        }
        const r = orig.call(this, driverId, blockIdx);
        // 即時送信ログを記録（単独確定は即時送信のみ）
        recordSendLog(driverId, blockIdx, 'immediate');
        refreshKpiDock();
        return r;
      };
      window.confirmSingleBlock._ownerGuarded = true;
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  指示送信のバルク化と予約
  // ════════════════════════════════════════════════════════════════
  // 一括確定モーダルに送信スケジュール選択肢を注入
  function injectSendScheduleSection() {
    const modalBody = document.querySelector('#bulk-confirm-modal .modal-body');
    if (!modalBody) return;
    if (document.getElementById('send-schedule-section')) return;
    const sec = document.createElement('div');
    sec.id = 'send-schedule-section';
    sec.className = 'send-schedule-section';
    sec.innerHTML = `
      <div class="send-schedule-title">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ドライバーへの指示送信タイミング
      </div>
      <div class="send-schedule-options">
        <div class="send-schedule-opt selected" data-mode="immediate" onclick="window.selectSendSchedule('immediate', this)">
          <span class="send-schedule-opt-radio"></span>
          <span class="send-schedule-opt-icon">⚡</span>
          <div class="send-schedule-opt-main">
            <div class="send-schedule-opt-label">即時送信</div>
            <div class="send-schedule-opt-sub">確定と同時に送る</div>
          </div>
        </div>
        <div class="send-schedule-opt" data-mode="in1h" onclick="window.selectSendSchedule('in1h', this)">
          <span class="send-schedule-opt-radio"></span>
          <span class="send-schedule-opt-icon">⏱</span>
          <div class="send-schedule-opt-main">
            <div class="send-schedule-opt-label">1時間後</div>
            <div class="send-schedule-opt-sub">最終確認の余裕を確保</div>
          </div>
        </div>
        <div class="send-schedule-opt" data-mode="morning" onclick="window.selectSendSchedule('morning', this)">
          <span class="send-schedule-opt-radio"></span>
          <span class="send-schedule-opt-icon">🌅</span>
          <div class="send-schedule-opt-main">
            <div class="send-schedule-opt-label">運行日の朝5時</div>
            <div class="send-schedule-opt-sub">早朝出発に間に合うよう自動送信</div>
          </div>
        </div>
        <div class="send-schedule-opt" data-mode="custom" onclick="window.selectSendSchedule('custom', this)">
          <span class="send-schedule-opt-radio"></span>
          <span class="send-schedule-opt-icon">📅</span>
          <div class="send-schedule-opt-main">
            <div class="send-schedule-opt-label">日時指定</div>
            <div class="send-schedule-opt-sub">任意の予約</div>
          </div>
        </div>
      </div>
      <div class="send-schedule-custom" id="send-schedule-custom">
        <span style="font-size:11px; color:#475569; font-weight:600;">送信日時：</span>
        <input type="datetime-local" id="send-schedule-datetime" />
      </div>
    `;
    modalBody.appendChild(sec);
  }

  window.selectSendSchedule = function(mode, el) {
    bulkSendSchedule.mode = mode;
    document.querySelectorAll('.send-schedule-opt').forEach(o => o.classList.remove('selected'));
    if (el) el.classList.add('selected');
    const custom = document.getElementById('send-schedule-custom');
    if (custom) custom.classList.toggle('show', mode === 'custom');
    if (mode === 'custom') {
      // デフォルトで明朝6時を仮セット
      const input = document.getElementById('send-schedule-datetime');
      if (input && !input.value) {
        const t = new Date();
        t.setDate(t.getDate() + 1);
        t.setHours(6, 0, 0, 0);
        const local = new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        input.value = local;
      }
    }
  };

  // executeBulkConfirmをラップして送信スケジュールを適用
  function hookExecuteBulkConfirm() {
    if (typeof window.executeBulkConfirm !== 'function') return;
    if (window.executeBulkConfirm._scheduleHooked) return;
    const orig = window.executeBulkConfirm;
    window.executeBulkConfirm = function() {
      const targets = (window._bulkConfirmTargets || []).slice();
      // 担当外を弾く
      const targetsAllowed = targets.filter(t => canEditDriver(t.driverId));
      const blocked = targets.length - targetsAllowed.length;
      if (targetsAllowed.length === 0) {
        if (typeof window.showDndToast === 'function') {
          window.showDndToast('担当外のため確定できる案件がありません', true);
        }
        return;
      }
      // 送信スケジュール判定
      const scheduleAt = resolveScheduleAt(bulkSendSchedule.mode);
      const isImmediate = bulkSendSchedule.mode === 'immediate';

      // 元のexecuteBulkConfirmを上書き対象だけで動かすため、_bulkConfirmTargetsを差し替え
      window._bulkConfirmTargets = targetsAllowed;
      // 元処理：確定フラグを立てる
      orig.call(this);

      // 送信ログ記録（即時 or 予約）
      targetsAllowed.forEach(t => {
        recordSendLog(t.driverId, null, isImmediate ? 'immediate' : 'scheduled', scheduleAt, t.a);
      });

      // 予約送信ならタイマーセット（プロトタイプではセットしておいてsetTimeoutで発火）
      if (!isImmediate && scheduleAt) {
        const delay = Math.max(0, scheduleAt.getTime() - Date.now());
        const sentLabel = scheduleAt.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        // ブロックに予約フラグを付与
        targetsAllowed.forEach(t => {
          const arr = (window.dndAssignments[t.driverId] && window.dndAssignments[t.driverId][window.dndGetCurrentDateKey()]) || [];
          if (arr[t.idx]) {
            arr[t.idx].sendScheduledAt = scheduleAt.toISOString();
            arr[t.idx].sendSent = false;
          }
        });
        if (typeof window.renderDnd === 'function') window.renderDnd();
        // タイマー（実環境では別途バックエンドジョブ）
        const tid = setTimeout(() => {
          sendLogs.forEach(l => {
            if (l.status === 'pending' && l.scheduledAt && new Date(l.scheduledAt).getTime() <= Date.now()) {
              l.status = 'sent';
              l.sentAt = new Date().toISOString();
            }
          });
          if (typeof window.showDndToast === 'function') {
            window.showDndToast(`📤 予約していた ${targetsAllowed.length} 件の指示を ${sentLabel} に送信しました`);
          }
          refreshKpiDock();
        }, delay);
        scheduledTimers.push(tid);
        if (typeof window.showDndToast === 'function') {
          window.showDndToast(`⏰ ${targetsAllowed.length} 件を確定。指示送信は ${sentLabel} に予約しました${blocked > 0 ? `（${blocked} 件は担当外のためスキップ）` : ''}`);
        }
      } else {
        if (typeof window.showDndToast === 'function' && blocked > 0) {
          window.showDndToast(`⚡ 即時送信完了。${blocked} 件は担当外のためスキップ`);
        }
      }
      refreshKpiDock();
    };
    window.executeBulkConfirm._scheduleHooked = true;
  }

  function resolveScheduleAt(mode) {
    const now = new Date();
    if (mode === 'immediate') return now;
    if (mode === 'in1h') return new Date(now.getTime() + 60 * 60 * 1000);
    if (mode === 'morning') {
      // 表示中の日付の朝5時。今日朝5時を過ぎていれば翌日朝5時
      const key = window.dndGetCurrentDateKey ? window.dndGetCurrentDateKey() : null;
      const base = key ? new Date(key + 'T05:00:00') : (() => { const t = new Date(); t.setHours(5,0,0,0); return t; })();
      if (base.getTime() <= now.getTime()) {
        base.setDate(base.getDate() + 1);
      }
      return base;
    }
    if (mode === 'custom') {
      const input = document.getElementById('send-schedule-datetime');
      if (input && input.value) return new Date(input.value);
      return null;
    }
    return now;
  }

  // 送信ログ記録
  function recordSendLog(driverId, blockIdx, mode, scheduleAt, blockSnapshot) {
    const driver = (window.dndDrivers || []).find(d => d.id === driverId);
    let block = blockSnapshot;
    if (!block && blockIdx != null) {
      const k = window.dndGetCurrentDateKey();
      const arr = (window.dndAssignments[driverId] && window.dndAssignments[driverId][k]) || [];
      block = arr[blockIdx];
    }
    sendLogs.unshift({
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).slice(2,7),
      driverId,
      driverName: driver ? driver.driver : '—',
      client: block ? (block.client || block.label) : '—',
      time: block ? `${block.start}〜${block.end}` : '—',
      mode,
      scheduledAt: scheduleAt ? scheduleAt.toISOString() : null,
      status: mode === 'immediate' ? 'sent' : 'pending',
      createdAt: new Date().toISOString(),
      sentAt: mode === 'immediate' ? new Date().toISOString() : null,
      operator: getMember(CURRENT_USER_ID).name,
    });
    // 最大100件保持
    if (sendLogs.length > 100) sendLogs.length = 100;
  }

  // 送信ログモーダル
  window.openSendLogModal = function() {
    const listEl = document.getElementById('send-log-list');
    if (sendLogs.length === 0) {
      listEl.innerHTML = `<div style="padding: 30px; text-align: center; color: #6b7280; font-size: 12px;">送信ログはまだありません</div>`;
    } else {
      listEl.innerHTML = sendLogs.map(l => {
        const icon = l.status === 'sent' ? '✓' : l.status === 'pending' ? '⏰' : '✕';
        const label = l.status === 'sent' ? '送信済' : l.status === 'pending' ? '予約' : '失敗';
        const dt = l.status === 'pending' && l.scheduledAt
          ? new Date(l.scheduledAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : (l.sentAt ? new Date(l.sentAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
        return `<div class="send-log-item">
          <div class="send-log-status ${l.status}">${icon}</div>
          <div class="send-log-main">
            <div style="font-weight:700; color:#111827;">${l.client}</div>
            <div style="color:#6b7280; margin-top:1px;">${l.driverName} · ${l.time} · 操作：${l.operator}</div>
          </div>
          <div class="send-log-time">
            <div>${label}</div>
            <div style="margin-top:2px;">${dt}</div>
          </div>
        </div>`;
      }).join('');
    }
    document.getElementById('send-log-modal').classList.add('open');
  };

  // ════════════════════════════════════════════════════════════════
  //  KPIダッシュボード
  // ════════════════════════════════════════════════════════════════
  // 案件のおおよその売上を推定（プロトタイプ用簡易ロジック）
  function estimateRevenue(block) {
    if (!block) return 0;
    // 時間×単価ベース。durationあるなら使う、なければstart/endから計算
    const [sh, sm] = (block.start || '00:00').split(':').map(Number);
    const [eh, em] = (block.end || '00:00').split(':').map(Number);
    const dur = (eh + em/60) - (sh + sm/60);
    // 1時間あたり ¥7,500 仮（プロト用）
    let base = Math.max(0, dur) * 7500;
    if (block.urgent) base *= 1.15;
    return Math.round(base);
  }

  function computeKpi() {
    const k = window.dndGetCurrentDateKey ? window.dndGetCurrentDateKey() : null;
    if (!k || !window.dndDrivers) {
      return { confirmed:0, total:0, revenue:0, util:0, totalDrivers:0, busyDrivers:0, alerts:0, perDriver:[] };
    }
    let confirmed = 0, total = 0, revenue = 0;
    let busyDrivers = 0;
    let alerts = 0;
    const perDriver = [];
    window.dndDrivers.forEach(d => {
      const arr = (window.dndAssignments[d.id] && window.dndAssignments[d.id][k]) || [];
      const nonPreset = arr.filter(a => !a.isPreset);
      total += nonPreset.length;
      let driverConfirmed = 0;
      let driverRevenue = 0;
      nonPreset.forEach(a => {
        if (a.confirmed) {
          confirmed++;
          driverConfirmed++;
          const r = estimateRevenue(a);
          revenue += r;
          driverRevenue += r;
        }
      });
      if (arr.length > 0) busyDrivers++;
      // 拘束時間
      let dutyMin = 0;
      if (typeof window.kaizenComputeDuty === 'function' && arr.length > 0) {
        dutyMin = window.kaizenComputeDuty(arr);
      }
      // 法令アラート
      let lawLevel = 'ok';
      if (typeof window.kaizenCheck === 'function' && nonPreset.length > 0) {
        const r = window.kaizenCheck(d.id, k, null);
        lawLevel = r.level;
        if (r.level === 'violation' || r.level === 'warn') alerts++;
      }
      perDriver.push({
        driver: d,
        cases: nonPreset.length,
        confirmed: driverConfirmed,
        revenue: driverRevenue,
        dutyMin,
        lawLevel,
        ownerId: ownerOf(d.id),
      });
    });
    // 未確定もアラートにカウント
    const unconfirmed = total - confirmed;
    alerts += unconfirmed;
    const totalDrivers = window.dndDrivers.length;
    const util = totalDrivers > 0 ? Math.round((busyDrivers / totalDrivers) * 100) : 0;
    return { confirmed, total, revenue, util, totalDrivers, busyDrivers, alerts, unconfirmed, perDriver };
  }

  function refreshKpiDock() {
    const dock = document.getElementById('kpi-dock');
    if (!dock) return;
    // 配車計画表ページ・D&Dサブタブのみ表示
    const onDispatch = window.currentDispatchSubtab === 'dnd';
    const pageEl = document.getElementById('page-dispatch');
    const dispatchVisible = pageEl && pageEl.classList.contains('active');
    if (!onDispatch || !dispatchVisible) {
      dock.style.display = 'none';
      return;
    }
    dock.style.display = 'flex';

    const kpi = computeKpi();
    // 確定済み
    const cv = document.getElementById('kpi-confirmed-val');
    const cs = document.getElementById('kpi-confirmed-sub');
    if (cv) cv.textContent = kpi.confirmed;
    if (cs) cs.textContent = `${kpi.confirmed} / 全 ${kpi.total} 件`;
    // 推定売上
    const rv = document.getElementById('kpi-revenue-val');
    const rs = document.getElementById('kpi-revenue-sub');
    if (rv) rv.textContent = '¥' + kpi.revenue.toLocaleString();
    if (rs) rs.textContent = kpi.confirmed > 0 ? `${kpi.confirmed} 件 確定分` : '未確定';
    // 稼働率
    const uv = document.getElementById('kpi-util-val');
    const us = document.getElementById('kpi-util-sub');
    if (uv) {
      uv.textContent = kpi.util + '%';
      uv.classList.remove('good', 'warn', 'danger');
      if (kpi.util >= 80) uv.classList.add('good');
      else if (kpi.util >= 50) uv.classList.add('warn');
      else uv.classList.add('danger');
    }
    if (us) us.textContent = `${kpi.busyDrivers} / ${kpi.totalDrivers} 台`;
    // アラート
    const av = document.getElementById('kpi-alert-val');
    const as = document.getElementById('kpi-alert-sub');
    if (av) {
      av.textContent = kpi.alerts;
      av.classList.remove('good', 'warn', 'danger');
      if (kpi.alerts === 0) av.classList.add('good');
      else if (kpi.alerts <= 3) av.classList.add('warn');
      else av.classList.add('danger');
    }
    if (as) as.textContent = kpi.unconfirmed > 0 ? `未確定${kpi.unconfirmed}件含む` : '法令注意のみ';

    // FABバッジ：折りたたみ中でもアラート件数が分かるように
    const badge = document.getElementById('kpi-fab-badge');
    if (badge) {
      if (kpi.alerts > 0) {
        badge.textContent = kpi.alerts > 99 ? '99+' : kpi.alerts;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }

  // KPIドックの折りたたみ / 展開トグル
  // localStorageに状態を永続化（リロード後も維持）
  window.toggleKpiDock = function() {
    const dock = document.getElementById('kpi-dock');
    if (!dock) return;
    const isCollapsed = dock.classList.toggle('collapsed');
    try {
      localStorage.setItem('kpiDockCollapsed', isCollapsed ? '1' : '0');
    } catch(e) { /* ignore */ }
  };

  // 初期化時に保存された折りたたみ状態を復元
  function restoreKpiDockState() {
    const dock = document.getElementById('kpi-dock');
    if (!dock) return;
    try {
      if (localStorage.getItem('kpiDockCollapsed') === '1') {
        dock.classList.add('collapsed');
      }
    } catch(e) { /* ignore */ }
  }

  // KPI詳細モーダル
  window.openKpiDetailModal = function() {
    const kpi = computeKpi();
    const k = window.dndGetCurrentDateKey();
    const dateD = new Date(k + 'T00:00:00');
    const dateStr = dateD.toLocaleDateString('ja-JP', { month:'long', day:'numeric', weekday:'short' });
    document.getElementById('kpi-detail-title').textContent = `${dateStr} の運行サマリー`;

    // 過去7日の確定件数推移（ダミー：実運用ではAPIで取得）
    const sparkData = generateSparkData(kpi.confirmed);
    const maxSpark = Math.max(...sparkData.map(s => s.v), 1);

    // ドライバー別テーブル
    const driverRows = kpi.perDriver
      .filter(p => p.cases > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .map(p => {
        const dutyH = Math.floor(p.dutyMin / 60);
        const dutyM = p.dutyMin % 60;
        const dutyStr = p.dutyMin === 0 ? '—' : `${dutyH}h${dutyM > 0 ? dutyM + 'm' : ''}`;
        const dutyPct = Math.min(100, (p.dutyMin / (15 * 60)) * 100);
        const dutyClass = p.dutyMin > 15 * 60 ? 'danger' : p.dutyMin > 13 * 60 ? 'warn' : 'safe';
        const owner = p.ownerId ? getMember(p.ownerId) : null;
        const lawBadge = p.lawLevel === 'violation' ? `<span style="color:#dc2626; font-weight:700;">⚠ 違反</span>`
          : p.lawLevel === 'warn' ? `<span style="color:#d97706; font-weight:700;">! 注意</span>`
          : `<span style="color:#16a34a;">✓</span>`;
        return `<tr>
          <td>
            <div style="font-weight:700;">${p.driver.driver}</div>
            <div style="font-size:10px; color:#6b7280;">${p.driver.vehicle}</div>
          </td>
          <td>${owner ? `<span class="dnd-owner-avatar" style="background:${owner.color}; display:inline-flex;">${owner.initial}</span> ${owner.name}` : '<span style="color:#9ca3af;">—</span>'}</td>
          <td style="font-family:'Inter',sans-serif; font-weight:700;">${p.cases}</td>
          <td style="font-family:'Inter',sans-serif; font-weight:700; color:#1a7a5e;">${p.confirmed}</td>
          <td style="font-family:'Inter',sans-serif; font-weight:700;">¥${p.revenue.toLocaleString()}</td>
          <td>
            <div style="font-family:'Inter',sans-serif; font-size:10px; margin-bottom:2px;">${dutyStr}</div>
            <div class="kpi-mini-gauge"><div class="kpi-mini-gauge-fill" style="width:${dutyPct}%; background:${dutyClass==='danger'?'#dc2626':dutyClass==='warn'?'#f59e0b':'#16a34a'}"></div></div>
          </td>
          <td>${lawBadge}</td>
        </tr>`;
      }).join('');

    const body = document.getElementById('kpi-detail-body');
    body.innerHTML = `
      <div class="kpi-stat-grid">
        <div class="kpi-stat-tile">
          <div class="kpi-stat-tile-label">確定済み</div>
          <div class="kpi-stat-tile-value" style="color:#16a34a;">${kpi.confirmed}<span style="font-size:13px; color:#6b7280; font-weight:600;"> / ${kpi.total}</span></div>
          <div class="kpi-stat-tile-sub">${kpi.unconfirmed > 0 ? `未確定 ${kpi.unconfirmed} 件` : '本日分すべて確定'}</div>
        </div>
        <div class="kpi-stat-tile">
          <div class="kpi-stat-tile-label">推定売上</div>
          <div class="kpi-stat-tile-value">¥${kpi.revenue.toLocaleString()}</div>
          <div class="kpi-stat-tile-sub">確定分の合算</div>
        </div>
        <div class="kpi-stat-tile">
          <div class="kpi-stat-tile-label">車両稼働率</div>
          <div class="kpi-stat-tile-value" style="color:${kpi.util >= 80 ? '#16a34a' : kpi.util >= 50 ? '#d97706' : '#dc2626'};">${kpi.util}%</div>
          <div class="kpi-stat-tile-sub">${kpi.busyDrivers} / ${kpi.totalDrivers} 台稼働</div>
        </div>
      </div>

      <div class="kpi-section-title">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        過去7日 確定件数推移
      </div>
      <div class="kpi-bar-chart" style="margin-bottom: 24px;">
        ${sparkData.map(s => `
          <div class="kpi-bar" style="height:${(s.v / maxSpark) * 100}%">
            <span class="kpi-bar-value">${s.v}</span>
            <span class="kpi-bar-label">${s.label}</span>
          </div>
        `).join('')}
      </div>

      <div class="kpi-section-title">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.38 8.38 0 0 1 13 0"/></svg>
        ドライバー別 詳細
      </div>
      ${kpi.perDriver.filter(p => p.cases > 0).length === 0
        ? `<div style="padding: 20px; text-align: center; color: #6b7280; font-size: 12px; background: #f8fafc; border-radius: 8px;">本日の配車はまだありません</div>`
        : `<table class="kpi-driver-table">
            <thead>
              <tr>
                <th>ドライバー / 車両</th>
                <th>担当</th>
                <th>件数</th>
                <th>確定</th>
                <th>推定売上</th>
                <th>拘束時間</th>
                <th>法令</th>
              </tr>
            </thead>
            <tbody>${driverRows}</tbody>
          </table>`
      }
    `;
    document.getElementById('kpi-detail-modal').classList.add('open');
  };

  // 過去7日のダミーデータ
  function generateSparkData(today) {
    const arr = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('ja-JP', { weekday: 'short' });
      const v = i === 0 ? today : Math.floor(8 + Math.random() * 12);
      arr.push({ label, v });
    }
    return arr;
  }

  // ════════════════════════════════════════════════════════════════
  //  renderDndへのフック：所有者UI・KPI更新
  // ════════════════════════════════════════════════════════════════
  function hookRender() {
    if (typeof window.renderDnd !== 'function') return;
    if (window.renderDnd._v2Enhanced) return;
    const orig = window.renderDnd;
    window.renderDnd = function(...args) {
      const r = orig.apply(this, args);
      try {
        ensureAssignFilterBar();
        applyOwnerVisuals();
        refreshAssignFilterBar();
        refreshKpiDock();
        // 確定モーダルが開いていれば、送信スケジュールセクション注入
        const bm = document.getElementById('bulk-confirm-modal');
        if (bm && bm.classList.contains('open')) injectSendScheduleSection();
      } catch(e) { console.warn('v2 hookRender error', e); }
      return r;
    };
    window.renderDnd._v2Enhanced = true;
  }

  // 車両並び替え（重量順ソート / 行 D&D 入れ替え）が renderDnd を介さず
  // renderDndTimeline を単独で呼ぶケース向けのフック。
  // renderDndTimeline は行 HTML を全置換するので、
  // 担当バッジ・拠点バッジ・クロス配車インジケータ・ロック状態などが消えてしまう。
  // ここで window.renderDndTimeline をラップして、毎回 applyOwnerVisuals を再実行する。
  function hookRenderTimeline() {
    if (typeof window.renderDndTimeline !== 'function') return;
    if (window.renderDndTimeline._v2Enhanced) return;
    const orig = window.renderDndTimeline;
    window.renderDndTimeline = function(...args) {
      const r = orig.apply(this, args);
      try {
        applyOwnerVisuals();
      } catch(e) { console.warn('v2 hookRenderTimeline error', e); }
      return r;
    };
    window.renderDndTimeline._v2Enhanced = true;
  }

  // 一括確定モーダルが開かれた時に、スケジュールセクションを注入
  function observeBulkModal() {
    const bm = document.getElementById('bulk-confirm-modal');
    if (!bm) return;
    const obs = new MutationObserver(() => {
      if (bm.classList.contains('open')) {
        injectSendScheduleSection();
        // 初期は即時送信
        bulkSendSchedule = { mode: 'immediate', at: null };
        document.querySelectorAll('.send-schedule-opt').forEach(o => {
          o.classList.toggle('selected', o.dataset.mode === 'immediate');
        });
        const custom = document.getElementById('send-schedule-custom');
        if (custom) custom.classList.remove('show');
      }
    });
    obs.observe(bm, { attributes: true, attributeFilter: ['class'] });
  }

  // openBulkConfirmModal自体にもフックして確実に注入
  function hookOpenBulkConfirmModal() {
    if (typeof window.openBulkConfirmModal !== 'function') return;
    if (window.openBulkConfirmModal._v2Hooked) return;
    const orig = window.openBulkConfirmModal;
    window.openBulkConfirmModal = function(...args) {
      const r = orig.apply(this, args);
      // モーダル開いた直後に注入
      setTimeout(() => {
        injectSendScheduleSection();
        bulkSendSchedule = { mode: 'immediate', at: null };
        document.querySelectorAll('.send-schedule-opt').forEach(o => {
          o.classList.toggle('selected', o.dataset.mode === 'immediate');
        });
      }, 0);
      return r;
    };
    window.openBulkConfirmModal._v2Hooked = true;
  }

  // タブ・サブタブ切替時のKPI更新
  function hookTabSwitch() {
    if (typeof window.switchDispatchTab === 'function' && !window.switchDispatchTab._v2Hooked) {
      const orig = window.switchDispatchTab;
      window.switchDispatchTab = function(...args) {
        const r = orig.apply(this, args);
        setTimeout(() => { refreshKpiDock(); applyOwnerVisuals(); }, 80);
        return r;
      };
      window.switchDispatchTab._v2Hooked = true;
    }
    if (typeof window.switchDispatchSubtab === 'function' && !window.switchDispatchSubtab._v2Hooked) {
      const orig = window.switchDispatchSubtab;
      window.switchDispatchSubtab = function(...args) {
        const r = orig.apply(this, args);
        setTimeout(refreshKpiDock, 80);
        // 運行スケジュールタブを開いた際にも担当絞り込みバーを表示
        setTimeout(function() {
          try {
            if (typeof window.__ensureAssignFilterBar === 'function') {
              window.__ensureAssignFilterBar();
              if (typeof window.__refreshAssignFilterBar === 'function') {
                window.__refreshAssignFilterBar();
              }
            }
          } catch(e) { /* noop */ }
        }, 50);
        return r;
      };
      window.switchDispatchSubtab._v2Hooked = true;
    }
    if (typeof window.showPage === 'function' && !window.showPage._v2Hooked) {
      const orig = window.showPage;
      window.showPage = function(...args) {
        const r = orig.apply(this, args);
        setTimeout(refreshKpiDock, 80);
        return r;
      };
      window.showPage._v2Hooked = true;
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  初期化
  // ════════════════════════════════════════════════════════════════
  function init() {
    hookRender();
    hookRenderTimeline();
    hookTabSwitch();
    hookEditGuard();
    hookExecuteBulkConfirm();
    hookOpenBulkConfirmModal();
    observeBulkModal();
    // 折りたたみ状態を復元
    restoreKpiDockState();
    // 初期描画
    setTimeout(() => {
      try {
        ensureAssignFilterBar();
        applyOwnerVisuals();
        refreshAssignFilterBar();
        refreshKpiDock();
      } catch(e) { console.warn('v2 init render', e); }
    }, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();