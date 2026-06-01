(function(){
  'use strict';

  var INTAKE_QUEUE_KEY = 'logipoke_ai_intake_queue';

  // AI電話受付から渡された案件1件を、未処理＋未割当の両方に取り込む
  function ingestIntakeItem(intake) {
    if (!intake || !intake.id) return false;
    // 重複ガード（既に同IDが unprocessedCases にある場合はスキップ）
    if (typeof unprocessedCases !== 'undefined'
        && Array.isArray(unprocessedCases)
        && unprocessedCases.some(function(c){ return c && c.id === intake.id; })) {
      return false;
    }

    // ① 個別案件処理（未処理）に追加
    if (typeof unprocessedCases !== 'undefined' && Array.isArray(unprocessedCases)) {
      var now = new Date();
      var pad = function(n){ return String(n).padStart(2,'0'); };
      var timeStr = intake.time || (pad(now.getHours()) + ':' + pad(now.getMinutes()));

      var newCase = {
        id: intake.id,
        status: '未解析',
        client: intake.client || '—',
        from: intake.from || '',
        to: intake.to || '',
        goods: intake.goods || '—',
        deadline: intake.deadline || '',
        conditions: intake.conditions || '',
        ch: intake.ch || 'tel',
        time: timeStr,
        analyzed: false,
        casePattern: null,
        vehicles: [],
        sourceTag: 'AI電話受付'
      };
      if (typeof autoDetectPattern === 'function') {
        try { newCase.casePattern = autoDetectPattern(newCase); } catch(e){}
      }
      unprocessedCases.unshift(newCase);
    }

    // ② 配車計画表（未割当案件）にも反映
    if (typeof addToDispatchUnassigned === 'function') {
      try {
        addToDispatchUnassigned(intake.id, {
          client: intake.client || '—',
          from: intake.from || '',
          to: intake.to || '',
          goods: intake.goods || '—',
          deadline: intake.deadline || ''
        });
      } catch(e){ console.warn('addToDispatchUnassigned 失敗:', e); }
    }

    return true;
  }

  // localStorage 上のキューを全部取り込み、空にする
  function drainIntakeQueue() {
    var queue = [];
    try {
      var raw = localStorage.getItem(INTAKE_QUEUE_KEY);
      queue = raw ? JSON.parse(raw) : [];
    } catch(e){ queue = []; }
    if (!Array.isArray(queue) || queue.length === 0) return 0;

    var ingested = 0;
    queue.forEach(function(item){
      if (ingestIntakeItem(item)) ingested++;
    });

    // 処理済みなのでキューを空にする
    try { localStorage.removeItem(INTAKE_QUEUE_KEY); } catch(e){}

    if (ingested > 0) {
      if (typeof renderUnprocessedList === 'function') {
        try { renderUnprocessedList(); } catch(e){}
      }
      if (typeof updatePhaseCounts === 'function') {
        try { updatePhaseCounts(); } catch(e){}
      }
      if (typeof renderDndList === 'function') {
        try { renderDndList(); } catch(e){}
      }
      if (typeof updateDispatchNavBadge === 'function') {
        try { updateDispatchNavBadge(); } catch(e){}
      }
      var tabCount = document.querySelector('.phase-tab.unprocessed .tab-count');
      if (tabCount && typeof unprocessedCases !== 'undefined') {
        tabCount.textContent = unprocessedCases.length;
        tabCount.removeAttribute('data-zero');
      }
      showIntakeToast(ingested);
    }
    return ingested;
  }

  // 取り込み完了トースト
  function showIntakeToast(count) {
    var msg = 'AI電話受付から案件を ' + count + ' 件取り込み、未処理 / 未割当 に反映しました';
    if (typeof showToast === 'function') {
      try { showToast(msg, 'success'); return; } catch(e){}
    }
    var t = document.createElement('div');
    t.style.cssText = [
      'position:fixed','bottom:24px','right:24px','z-index:9999',
      'background:#fff','border:1px solid #bbf7d0','border-left:4px solid #16a34a',
      'border-radius:10px','padding:14px 18px',
      'box-shadow:0 8px 24px rgba(0,0,0,0.12)',
      'min-width:280px','max-width:380px',
      'font-family:"Noto Sans JP",sans-serif','font-size:12px','color:#1a1a1a',
      'transform:translateX(20px)','opacity:0','transition:all 0.3s'
    ].join(';');
    t.innerHTML = '<div style="font-weight:700;margin-bottom:4px;color:#0D4A3A">📞 AI電話受付から自動反映</div>'
                + '<div style="color:#6b7280;font-size:11px">' + msg + '</div>';
    document.body.appendChild(t);
    requestAnimationFrame(function(){
      t.style.transform = 'translateX(0)';
      t.style.opacity = '1';
    });
    setTimeout(function(){
      t.style.transform = 'translateX(20px)';
      t.style.opacity = '0';
      setTimeout(function(){ t.remove(); }, 300);
    }, 5000);
  }

  // ── URLハッシュ → ページ遷移 ──
  function applyHashRoute() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return;
    var page = decodeURIComponent(h).split('?')[0].trim();
    var valid = ['dashboard','dispatch','cases','fax','vehicle','masters','invoice','customer','report','settings','teiki','phone'];
    if (valid.indexOf(page) === -1) return;
    setTimeout(function(){
      if (typeof showPage_byName === 'function') {
        try { showPage_byName(page); } catch(e){}
      }
    }, 50);
  }

  // ── イベント配線 ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){
      setTimeout(function(){
        drainIntakeQueue();
        applyHashRoute();
      }, 300);
    });
  } else {
    setTimeout(function(){
      drainIntakeQueue();
      applyHashRoute();
    }, 300);
  }

  // 他タブ（AI電話受付）からの書込み通知
  window.addEventListener('storage', function(ev){
    if (ev.key === INTAKE_QUEUE_KEY && ev.newValue) {
      drainIntakeQueue();
    }
  });

  // タブ復帰時の保険
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'visible') {
      drainIntakeQueue();
    }
  });

  // ハッシュ変更でもページ遷移
  window.addEventListener('hashchange', applyHashRoute);

  // 埋め込み AI受付(iframe)からのページ遷移要求を受けて、メイン側で切替（サイドバーは保持）
  window.addEventListener('message', function(ev){
    var d = ev.data;
    if (d && d.type === 'logipoke-nav' && typeof d.page === 'string' && typeof showPage_byName === 'function') {
      try { showPage_byName(d.page); } catch(e){}
    }
  });

  // デバッグ用にグローバル公開
  window.__logipokeAIIntake = { drainIntakeQueue: drainIntakeQueue, ingestIntakeItem: ingestIntakeItem };
})();