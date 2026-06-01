(function() {
  'use strict';

  // ────────────────────────────────────────────────
  //  色のローテーション（新規案件に割り当てるカラー）
  //  既存サンプル(dndUnassignedCases)と同じ緑系3色のみを使い、
  //  配車計画表のカード色を統一する
  // ────────────────────────────────────────────────
  const CASE_COLOR_PALETTE = ['#1A6B56', '#1a7a5e', '#0D4A3A'];
  let _colorCursor = 0;
  function pickCaseColor() {
    const c = CASE_COLOR_PALETTE[_colorCursor % CASE_COLOR_PALETTE.length];
    _colorCursor++;
    return c;
  }

  // ────────────────────────────────────────────────
  //  durationH 推定：荷物重量・距離・荷姿から
  // ────────────────────────────────────────────────
  function estimateDuration(caseObj) {
    if (!caseObj) return 3;
    // 距離があれば距離ベース（高速60km/h想定 + 荷扱い1h）
    const dist = caseObj.distance || '';
    const dm = dist.match(/(\d+)\s*km/);
    if (dm) {
      const km = parseInt(dm[1], 10);
      const h = Math.max(2, Math.round(km / 60 + 1));
      return Math.min(12, h);
    }
    // 出発地〜到着地の都府県跨ぎから粗推定
    const from = caseObj.from || '';
    const to = caseObj.to || '';
    const fromPref = (from.match(/^[^県府都道]+[県府都道]/) || [''])[0];
    const toPref = (to.match(/^[^県府都道]+[県府都道]/) || [''])[0];
    if (!fromPref || !toPref) return 3;
    if (fromPref === toPref) return 3;
    // 関東圏内
    const kanto = ['東京都','神奈川県','埼玉県','千葉県','茨城県','栃木県','群馬県'];
    if (kanto.includes(fromPref) && kanto.includes(toPref)) return 4;
    // 中部以遠
    const chubu = ['静岡県','愛知県','岐阜県','三重県','長野県','山梨県','新潟県','富山県','石川県','福井県'];
    if ((kanto.includes(fromPref) && chubu.includes(toPref)) ||
        (chubu.includes(fromPref) && kanto.includes(toPref))) return 6;
    // 関西圏・以遠
    return 9;
  }

  // ────────────────────────────────────────────────
  //  preferredStart 推定：deadline 文字列から
  // ────────────────────────────────────────────────
  function estimatePreferredStart(caseObj) {
    if (!caseObj) return '09:00';
    const d = (caseObj.deadline || '') + ' ' + (caseObj.conditions || '');
    if (/AM|午前|朝/.test(d)) return '07:00';
    if (/夕方|夕|夜/.test(d)) return '15:00';
    if (/PM|午後/.test(d)) return '13:00';
    return '09:00';
  }

  // ────────────────────────────────────────────────
  //  緊急判定：deadline / status / priority から
  // ────────────────────────────────────────────────
  function detectUrgent(caseObj) {
    if (!caseObj) return false;
    if (caseObj.priority === '緊急') return true;
    if (caseObj.status === '要確認') return true;
    const d = caseObj.deadline || '';
    // 当日 or 翌日の指定
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const tmm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const tdd = String(tomorrow.getDate()).padStart(2, '0');
    if (d.includes(`${mm}/${dd}`) || d.includes(`${tmm}/${tdd}`)) return true;
    return false;
  }

  // ────────────────────────────────────────────────
  //  unprocessedCases / processingCases から
  //  dndUnassignedCases 用エントリを作る
  // ────────────────────────────────────────────────
  let _dndIdCursor = 100; // D-100以降を新規払い出し
  function makeDispatchEntry(caseObj, phase) {
    // 既に紐付け済みエントリがあるかチェック
    const dndList = (typeof dndUnassignedCases !== 'undefined') ? dndUnassignedCases : [];
    const existing = dndList.find(d => d.caseListId === caseObj.id);
    if (existing) return null; // 重複作成を防ぐ
    _dndIdCursor++;
    return {
      id: 'D-' + String(_dndIdCursor).padStart(3, '0'),
      caseListId: caseObj.id,
      originalPhase: phase,
      client: caseObj.client,
      status: phase,
      from: caseObj.from,
      to: caseObj.to,
      goods: (caseObj.goods || '').replace(/\s*\/\s*/g, '/'), // 表記統一
      durationH: estimateDuration(caseObj),
      preferredStart: estimatePreferredStart(caseObj),
      deadline: caseObj.deadline || '—',
      urgent: detectUrgent(caseObj),
      color: pickCaseColor(),
    };
  }

  // ────────────────────────────────────────────────
  //  caseListId が null の dnd エントリを
  //  unprocessedCases/processingCases にも復元
  // ────────────────────────────────────────────────
  function makeCaseProcessingEntry(dndEntry) {
    // goodsの表記を個別案件処理側に揃える（スラッシュ周りスペース）
    const goods = (dndEntry.goods || '').split('/').map(s => s.trim()).join(' / ');
    return {
      id: 'GEN' + Date.now().toString().slice(-6) + Math.floor(Math.random()*900+100),
      status: dndEntry.urgent ? '要確認' : '未解析',
      client: dndEntry.client,
      from: dndEntry.from,
      to: dndEntry.to,
      goods: goods,
      deadline: dndEntry.deadline,
      ch: 'tel',
      time: '—',
      analyzed: false,
      casePattern: 'スポット案件',
      vehicles: [],
    };
  }

  function makeProcessingCaseEntry(dndEntry) {
    const goods = (dndEntry.goods || '').split('/').map(s => s.trim()).join(' / ');
    return {
      id: 'GEN' + Date.now().toString().slice(-6) + Math.floor(Math.random()*900+100),
      status: '処理中',
      priority: dndEntry.urgent ? '緊急' : '通常',
      casePattern: 'スポット案件',
      client: dndEntry.client,
      from: dndEntry.from,
      to: dndEntry.to,
      goods: goods,
      deadline: dndEntry.deadline,
      vehicle: '未割当',
      driver: '未割当',
      distance: '—',
      selectedVehicleIdx: 0,
      vehicleMode: 'single',
      legs: [],
      multiReasons: [],
      vehicles: [],
    };
  }

  // ────────────────────────────────────────────────
  //  双方向同期：初期化時に走らせる
  // ────────────────────────────────────────────────
  function syncCasesAndDispatch() {
    if (typeof dndUnassignedCases === 'undefined') return;
    if (typeof unprocessedCases === 'undefined') return;
    if (typeof processingCases === 'undefined') return;

    // ── 1. 個別案件処理 → 配車計画表 ──
    // 個別案件処理側にあって、配車計画表側にエントリがないものを追加
    const existingCaseIds = new Set(dndUnassignedCases.map(d => d.caseListId).filter(Boolean));

    unprocessedCases.forEach(c => {
      if (!existingCaseIds.has(c.id)) {
        const entry = makeDispatchEntry(c, 'unprocessed');
        if (entry) dndUnassignedCases.push(entry);
      }
    });
    processingCases.forEach(c => {
      if (!existingCaseIds.has(c.id)) {
        const entry = makeDispatchEntry(c, 'processing');
        if (entry) dndUnassignedCases.push(entry);
      }
    });

    // ── 2. 配車計画表 → 個別案件処理 ──
    // caseListIdがnullの仮想案件を、対応する個別案件処理側に追加して紐付け
    dndUnassignedCases.forEach(d => {
      if (d.caseListId) return; // 既に紐付けあり → スキップ
      if (d.status === 'unprocessed' || d.originalPhase === 'unprocessed') {
        const newEntry = makeCaseProcessingEntry(d);
        unprocessedCases.push(newEntry);
        d.caseListId = newEntry.id;
        d.originalPhase = 'unprocessed';
      } else {
        // processing 想定
        const newEntry = makeProcessingCaseEntry(d);
        processingCases.push(newEntry);
        d.caseListId = newEntry.id;
        d.originalPhase = 'processing';
      }
    });
  }

  // ────────────────────────────────────────────────
  //  新規登録ハンドリング
  //  unprocessedCases.unshift が呼ばれた直後に dnd側も連動
  // ────────────────────────────────────────────────
  // 既存コードを直接フックできないので、配列の変更を検知する仕組みを入れる
  // unprocessedCases.unshift の代わりに、観測関数を提供して使ってもらう方式は不可（既存コード書き換え）
  // → 代わりに「unprocessedCasesの長さ変化を MutationObserver 的に検知」する軽量ポーリングを使う
  let lastUnprocessedSnapshot = null;
  let lastProcessingSnapshot = null;

  function snapshotIds(arr) {
    return arr ? arr.map(c => c.id).join(',') : '';
  }

  function detectNewCasesAndSync() {
    if (typeof unprocessedCases === 'undefined') return;
    if (typeof processingCases === 'undefined') return;
    if (typeof dndUnassignedCases === 'undefined') return;

    const curUnprocessed = snapshotIds(unprocessedCases);
    const curProcessing = snapshotIds(processingCases);

    // 初回スナップショット取得
    if (lastUnprocessedSnapshot === null) {
      lastUnprocessedSnapshot = curUnprocessed;
      lastProcessingSnapshot = curProcessing;
      return;
    }

    // 差分検出 → dnd側へ反映
    let changed = false;
    if (curUnprocessed !== lastUnprocessedSnapshot) {
      const oldIds = new Set(lastUnprocessedSnapshot.split(','));
      unprocessedCases.forEach(c => {
        if (!oldIds.has(c.id)) {
          // 新規追加
          const existsInDnd = dndUnassignedCases.some(d => d.caseListId === c.id);
          if (!existsInDnd) {
            const entry = makeDispatchEntry(c, 'unprocessed');
            if (entry) {
              dndUnassignedCases.unshift(entry); // 先頭に追加（一覧上で目立つように）
              changed = true;
              // トーストで通知
              if (typeof window.showDndToast === 'function') {
                setTimeout(() => {
                  window.showDndToast(`📌 「${c.client}」を配車計画表の未割当案件にも追加しました`);
                }, 400);
              }
            }
          }
        }
      });
      lastUnprocessedSnapshot = curUnprocessed;
    }
    if (curProcessing !== lastProcessingSnapshot) {
      const oldIds = new Set(lastProcessingSnapshot.split(','));
      processingCases.forEach(c => {
        if (!oldIds.has(c.id)) {
          const existsInDnd = dndUnassignedCases.some(d => d.caseListId === c.id);
          if (!existsInDnd) {
            const entry = makeDispatchEntry(c, 'processing');
            if (entry) {
              dndUnassignedCases.unshift(entry);
              changed = true;
            }
          }
        }
      });
      lastProcessingSnapshot = curProcessing;
    }

    // 変更があれば配車計画表を再描画
    if (changed) {
      if (typeof window.renderDnd === 'function') {
        // 配車計画表ページが開いている時のみ再描画
        const pageEl = document.getElementById('page-dispatch');
        if (pageEl && pageEl.classList.contains('active')) {
          window.renderDnd();
        }
      }
      // 案件一覧側のフィルタ・カウントも整合させる
      if (typeof window.renderUnprocessedList === 'function') {
        // 個別案件処理ページが開いていれば再描画
        const casesPage = document.getElementById('page-cases');
        if (casesPage && casesPage.classList.contains('active')) {
          try { window.renderUnprocessedList(); } catch(e) {}
        }
      }
      // サイドバーバッジを必ず更新（どのページが開いていても）
      if (typeof window.updateDispatchNavBadge === 'function') {
        window.updateDispatchNavBadge();
      }
    }
  }

  // ────────────────────────────────────────────────
  //  初期化
  // ────────────────────────────────────────────────
  function init() {
    // 初期同期：データ整合性を確保
    try {
      syncCasesAndDispatch();
    } catch(e) {
      console.warn('syncCasesAndDispatch error:', e);
    }

    // 初回スナップショット
    if (typeof unprocessedCases !== 'undefined') lastUnprocessedSnapshot = snapshotIds(unprocessedCases);
    if (typeof processingCases !== 'undefined') lastProcessingSnapshot = snapshotIds(processingCases);

    // ポーリングで変化検知（800msごと、低負荷）
    setInterval(detectNewCasesAndSync, 800);

    // 初期同期後、開いているページに応じて再描画
    setTimeout(() => {
      try {
        // 配車計画表が初期表示されているなら更新
        const dispatchPage = document.getElementById('page-dispatch');
        if (dispatchPage && dispatchPage.classList.contains('active') && typeof window.renderDnd === 'function') {
          window.renderDnd();
        }
        // バッジは現在開いているページに関わらず計算する
        if (typeof window.updateDispatchNavBadge === 'function') {
          window.updateDispatchNavBadge();
        }
      } catch(e) {}
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();