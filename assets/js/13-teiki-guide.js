(function(){
'use strict';

// ── ウェルカムモーダル ──
var _teikiWelcomeEl = document.createElement('div');
_teikiWelcomeEl.id = 'teiki-guide-welcome';
_teikiWelcomeEl.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9100;align-items:center;justify-content:center;';
_teikiWelcomeEl.innerHTML = [
  '<div style="background:#fff;border-radius:16px;width:380px;max-width:calc(100vw - 40px);box-shadow:0 24px 64px rgba(0,0,0,0.25);overflow:hidden;animation:guideWelcomeIn .35s cubic-bezier(.4,0,.2,1)">',
    '<div style="background:linear-gradient(135deg,#0D4A3A 0%,#1a7a5e 60%,#3BB888 100%);padding:14px 20px 12px;text-align:center">',
      '<div style="font-size:26px;margin-bottom:4px">🗓️</div>',
      '<div style="font-size:15px;font-weight:800;color:#fff;margin-bottom:2px">定期案件登録 ガイド</div>',
      '<div style="font-size:11px;color:rgba(255,255,255,0.8)">新規登録から自動反映まで 6ステップで解説します</div>',
    '</div>',
    '<div style="padding:12px 16px">',
      '<div style="display:flex;flex-direction:column;gap:5px" id="teiki-welcome-steps-list"></div>',
    '</div>',
    '<div style="padding:0 16px 14px;display:flex;gap:10px">',
      '<button onclick="closeTeikiGuideWelcome()" style="padding:10px 16px;background:#f3f4f6;color:#374151;font-size:13px;font-weight:600;border:1px solid #e5e7eb;border-radius:10px;cursor:pointer;">後で見る</button>',
      '<button onclick="beginTeikiGuide()" style="flex:1;padding:10px;background:#0D4A3A;color:#fff;font-size:13px;font-weight:700;border:none;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 3px 10px rgba(13,74,58,0.3)">',
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
        'ガイドをスタート',
      '</button>',
    '</div>',
  '</div>'
].join('');
document.body.appendChild(_teikiWelcomeEl);

// ── 完了モーダル ──
var _teikiCompleteEl = document.createElement('div');
_teikiCompleteEl.id = 'teiki-guide-complete';
_teikiCompleteEl.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9100;align-items:center;justify-content:center;';
_teikiCompleteEl.innerHTML = [
  '<div style="background:#fff;border-radius:20px;width:400px;max-width:calc(100vw - 40px);padding:36px 28px 28px;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.22);animation:guideWelcomeIn .35s cubic-bezier(.4,0,.2,1)">',
    '<span style="font-size:52px;margin-bottom:12px;display:block">🎉</span>',
    '<div style="font-size:20px;font-weight:800;color:#0D4A3A;margin-bottom:8px">ガイド完了！</div>',
    '<div style="font-size:13px;color:#6b7280;line-height:1.7;margin-bottom:20px">定期案件登録の主要フローを確認しました。<br>さっそく定期案件を登録してみましょう！</div>',
    '<div style="background:#eaf5f0;border:1px solid #a7f3d0;border-radius:10px;padding:14px 16px;text-align:left;margin-bottom:20px;font-size:12px;color:#065f46;line-height:1.8">',
      '<strong>💡 覚えておきたいポイント</strong><br>',
      '🗓️ <strong>定期パターン</strong>でパターン別の追加項目が表示される<br>',
      '🔄 <strong>運行頻度＋開始日</strong>を設定すると自動反映が使える<br>',
      '⚡ <strong>自動反映ON</strong>で運行日2日前に未処理へ自動登録<br>',
      '▶ <strong>発生ボタン</strong>で手動でも即座に未処理へ追加できる',
    '</div>',
    '<button onclick="closeTeikiGuideComplete()" style="width:100%;padding:12px;background:#0D4A3A;color:#fff;font-size:14px;font-weight:700;border:none;border-radius:10px;cursor:pointer;">✨ 定期案件一覧を確認する</button>',
  '</div>'
].join('');
document.body.appendChild(_teikiCompleteEl);

// ── ステップ定義 ──
var TEIKI_STEPS = [
  {
    badge: 'STEP 1 / 6', emoji: '📋',
    title: '定期案件一覧を確認する',
    body: 'このページには<span class="ghl">登録済みの定期案件テンプレート一覧</span>が表示されます。<br><br>'
        + '各行に<span class="ghl">状態・パターン・取引先・開始日・運賃・操作ボタン</span>が並んでいます。<br><br>'
        + '🔍 上部の検索バーでパターン・状態・自動反映ON/OFFで絞り込みができます。',
    arrowDir: 'below',
    prepare: function(done) {
      _closeTeikiModal();
      showPage_byName('teiki');
      guideDelay(200, done);
    },
    targetFn: function() {
      return document.querySelector('#teiki-list-body tr.teiki-row') || document.getElementById('teiki-list-body');
    }
  },
  {
    badge: 'STEP 2 / 6', emoji: '➕',
    title: '新規定期案件を登録ボタン',
    body: '右上の<span class="ghl">「新規定期案件を登録」ボタン</span>を押すと、登録モーダルが開きます。<br><br>'
        + 'このモーダルから定期便のテンプレートを作成し、<span class="ghl">繰り返し発生する運行案件</span>を一元管理できます。',
    arrowDir: 'left',
    prepare: function(done) {
      _closeTeikiModal();
      showPage_byName('teiki');
      guideDelay(200, done);
    },
    targetFn: function() {
      var btn = document.querySelector('#page-teiki button[onclick="openTeikiModal()"]');
      return btn || null;
    }
  },
  {
    badge: 'STEP 3 / 6', emoji: '🏷️',
    title: '定期パターンを選択する',
    body: 'モーダル最上部で<span class="ghl">定期パターン</span>を選択します。<br><br>'
        + '選択したパターンによって、入力フォームの下部に<span class="ghl">パターン固有の追加設定項目</span>が展開されます。<br><br>'
        + '例：🏪 店舗ルート配送 → <strong>配送先数・ラウンド順</strong>など<br>'
        + '例：⏰ 時間帯固定定期便 → <strong>発車時刻・着時刻指定</strong>など',
    arrowDir: 'right',
    prepare: function(done) {
      _openTeikiModalForGuide(done);
    },
    targetFn: function() {
      return document.getElementById('tf-pattern-group');
    }
  },
  {
    badge: 'STEP 4 / 6', emoji: '🔄',
    title: '運行頻度・開始日を設定する',
    body: '<span class="ghl">運行頻度</span>（毎日 / 週次 / 月次 / カスタム）と<span class="ghl">案件開始日</span>を入力します。<br><br>'
        + '両方を入力すると、下の<span class="ghl">「自動で個別案件処理へ反映」チェックボックス</span>がアクティブになり、チェックできるようになります。',
    arrowDir: 'right',
    prepare: function(done) {
      _openTeikiModalForGuide(done);
    },
    targetFn: function() {
      return document.querySelector('.teiki-modal-body-inner') || document.querySelector('[id="tf-start-date"]')?.closest('div') || document.getElementById('tf-start-date');
    }
  },
  {
    badge: 'STEP 5 / 6', emoji: '⚡',
    title: '自動で個別案件処理へ反映チェック',
    body: '<span class="ghl">「自動で個別案件処理へ反映」</span>をONにすると、<strong style="color:#0D4A3A">運行日の2日前に自動で未処理リストへ登録</strong>されます。<br><br>'
        + '✅ OFFのままでも、一覧の<span class="ghl">「発生（未処理へ）」ボタン</span>をクリックすれば手動で追加できます。<br><br>'
        + '📌 自動反映がONの場合、発生ボタンは<span class="ghl">「自動反映中」表示</span>に変わります。',
    arrowDir: 'above',
    prepare: function(done) {
      _openTeikiModalForGuide(done);
    },
    targetFn: function() {
      return document.getElementById('tf-auto-reflect-wrap');
    }
  },
  {
    badge: 'STEP 6 / 6', emoji: '▶',
    title: '操作ボタン：発生・編集・自動反映',
    body: '登録後、一覧の<span class="ghl">操作列</span>に3種類のボタンが表示されます。<br><br>'
        + '📝 <strong>編集</strong> — 登録内容をいつでも修正できます<br>'
        + '▶ <strong>発生（未処理へ）</strong> — クリックすると即座に<span class="ghl">個別案件処理（未処理）へ新規追加</span>されます<br>'
        + '🔄 <strong>自動反映中</strong> — 自動反映ONの案件はこの表示に変わり、手動操作不要になります<br><br>'
        + '登録後の案件は<span class="ghl">個別案件処理（未処理タブ）</span>にリアルタイムで反映されます！',
    arrowDir: 'left',
    prepare: function(done) {
      _closeTeikiModal();
      showPage_byName('teiki');
      guideDelay(200, done);
    },
    targetFn: function() {
      var rows = document.querySelectorAll('#teiki-list-body tr.teiki-row');
      if (rows.length > 0) {
        return rows[rows.length - 1].querySelector('td:last-child') || rows[0];
      }
      return document.querySelector('#teiki-list-body tr.teiki-row');
    }
  }
];

// ── ヘルパー ──
function _closeTeikiModal() {
  var ov = document.getElementById('teiki-modal-overlay');
  if (ov) ov.style.display = 'none';
}

function _openTeikiModalForGuide(done) {
  showPage_byName('teiki');
  guideDelay(80, function() {
    var ov = document.getElementById('teiki-modal-overlay');
    if (ov) {
      ov.style.display = 'flex';
      ov.style.zIndex = '9005'; // guide-backdropより手前になるよう
    }
    guideDelay(150, done);
  });
}

// ── 状態 ──
var _teikiStep = 0, _teikiActive = false;

// ── ウェルカムステップリスト描画 ──
var _teikiStepLabels = [
  ['📋','定期案件一覧を確認する'],
  ['➕','新規定期案件を登録ボタン'],
  ['🏷️','定期パターンを選択する'],
  ['🔄','運行頻度・開始日を設定する'],
  ['⚡','自動で個別案件処理へ反映チェック'],
  ['▶', '操作ボタン：発生・編集・自動反映']
];
(function(){
  var el = document.getElementById('teiki-welcome-steps-list');
  if (!el) return;
  el.innerHTML = _teikiStepLabels.map(function(s, i) {
    return '<div style="display:flex;align-items:center;gap:10px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:6px 10px">'
      + '<div style="width:20px;height:20px;border-radius:50%;background:#0D4A3A;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:Inter,sans-serif">' + (i+1) + '</div>'
      + '<div style="font-size:11px;font-weight:700;color:#111827">' + s[0] + ' ' + s[1] + '</div>'
      + '</div>';
  }).join('');
})();

// ── 公開関数 ──
window.startTeikiGuide = function() {
  var el = document.getElementById('teiki-guide-welcome');
  if (el) { el.style.display = 'flex'; }
};
window.closeTeikiGuideWelcome = function() {
  var el = document.getElementById('teiki-guide-welcome');
  if (el) { el.style.display = 'none'; }
};
window.closeTeikiGuideComplete = function() {
  var el = document.getElementById('teiki-guide-complete');
  if (el) { el.style.setProperty('display', 'none', 'important'); }
  showPage_byName('teiki');
};
window.beginTeikiGuide = function() {
  closeTeikiGuideWelcome();
  _teikiActive = true;
  _teikiStep = 0;
  var bd = document.getElementById('guide-backdrop');
  if (bd) bd.classList.add('active');
  _runTeikiStep(0);
};
window.teikiGuideNext = function() {
  if (_teikiStep < TEIKI_STEPS.length - 1) {
    _teikiStep++;
    _runTeikiStep(_teikiStep);
  } else {
    _endTeikiGuide();
    setTimeout(function(){
      var el = document.getElementById('teiki-guide-complete');
      if (el) {
        document.body.appendChild(el);
        el.style.setProperty('display', 'flex', 'important');
      }
    }, 50);
  }
};
window.teikiGuidePrev = function() {
  if (_teikiStep > 0) { _teikiStep--; _runTeikiStep(_teikiStep); }
};
window.skipTeikiGuide = function() { _endTeikiGuide(); };

function _endTeikiGuide() {
  _teikiActive = false;
  _closeTeikiModal();
  var bd = document.getElementById('guide-backdrop');
  if (bd) bd.classList.remove('active');
  var b = document.getElementById('guide-bubble');
  if (b) { b.style.cssText = 'display:none'; b.className = ''; }
  var ring = document.getElementById('guide-ring');
  if (ring) ring.style.display = 'none';
}

function _runTeikiStep(index) {
  var step = TEIKI_STEPS[index];
  var bubble = document.getElementById('guide-bubble');
  var ring = document.getElementById('guide-ring');
  if (!bubble) return;
  bubble.style.cssText = 'display:none'; bubble.className = '';
  if (ring) ring.style.display = 'none';

  // テキスト更新
  document.getElementById('guide-badge').textContent = step.badge;
  document.getElementById('guide-emoji').textContent = step.emoji || '';
  document.getElementById('guide-title').textContent = step.title;
  document.getElementById('guide-body').innerHTML    = step.body;
  document.getElementById('guide-prev-btn').style.display = index === 0 ? 'none' : '';
  document.getElementById('guide-prev-btn').onclick = function() { window.teikiGuidePrev(); };

  var nb = document.getElementById('guide-next-btn');
  nb.innerHTML = index === TEIKI_STEPS.length - 1
    ? '完了 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
    : '次へ <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
  nb.onclick = function() { window.teikiGuideNext(); };

  var skipBtn = document.querySelector('.guide-btn-skip');
  if (skipBtn) skipBtn.onclick = function() { window.skipTeikiGuide(); };

  document.getElementById('guide-progress').innerHTML = TEIKI_STEPS
    .map(function(_, i) { return '<div class="guide-dot ' + (i < index ? 'done' : i === index ? 'active' : '') + '"></div>'; }).join('');

  var bd = document.getElementById('guide-backdrop');
  if (bd) bd.classList.add('active');

  step.prepare(function() {
    guideRAF(4, function() { _placeGuide(step); });
  });
}

})();