(function(){
'use strict';

// ── 状態 ──
var _partnerActive = false;
var _partnerStep = 0;
var _partnerPhase = 'unprocessed';
var _partnerCaseIdx = 0;

// ── ウェルカムモーダル ──
var _partnerWelcomeEl = document.createElement('div');
_partnerWelcomeEl.id = 'partner-guide-welcome';
_partnerWelcomeEl.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9100;align-items:center;justify-content:center;';
_partnerWelcomeEl.innerHTML = [
  '<div style="background:#fff;border-radius:16px;width:380px;max-width:calc(100vw - 40px);box-shadow:0 24px 64px rgba(0,0,0,0.25);overflow:hidden;animation:guideWelcomeIn .35s cubic-bezier(.4,0,.2,1)">',
    '<div style="background:linear-gradient(135deg,#0D4A3A 0%,#1a7a5e 60%,#3BB888 100%);padding:14px 20px 12px;text-align:center">',
      '<div style="font-size:26px;margin-bottom:4px">🤝</div>',
      '<div style="font-size:15px;font-weight:800;color:#fff;margin-bottom:2px">協力会社へ依頼 ガイド</div>',
      '<div style="font-size:11px;color:rgba(255,255,255,0.8)">会社選択から発注書送信まで 5ステップで解説します</div>',
    '</div>',
    '<div style="padding:12px 16px">',
      '<div style="display:flex;flex-direction:column;gap:5px" id="partner-welcome-steps-list"></div>',
    '</div>',
    '<div style="padding:0 16px 14px;display:flex;gap:10px">',
      '<button onclick="closePartnerGuideWelcome()" style="padding:10px 16px;background:#f3f4f6;color:#374151;font-size:13px;font-weight:600;border:1px solid #e5e7eb;border-radius:10px;cursor:pointer;">後で見る</button>',
      '<button onclick="beginPartnerGuide()" style="flex:1;padding:10px;background:#0D4A3A;color:#fff;font-size:13px;font-weight:700;border:none;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 3px 10px rgba(13,74,58,0.3)">',
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
        'ガイドをスタート',
      '</button>',
    '</div>',
  '</div>'
].join('');
document.body.appendChild(_partnerWelcomeEl);

// ── 完了モーダル ──
var _partnerCompleteEl = document.createElement('div');
_partnerCompleteEl.id = 'partner-guide-complete';
_partnerCompleteEl.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9100;align-items:center;justify-content:center;';
_partnerCompleteEl.innerHTML = [
  '<div style="background:#fff;border-radius:20px;width:400px;max-width:calc(100vw - 40px);padding:36px 28px 28px;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.22);animation:guideWelcomeIn .35s cubic-bezier(.4,0,.2,1)">',
    '<span style="font-size:52px;margin-bottom:12px;display:block">🎉</span>',
    '<div style="font-size:20px;font-weight:800;color:#0D4A3A;margin-bottom:8px">ガイド完了！</div>',
    '<div style="font-size:13px;color:#6b7280;line-height:1.7;margin-bottom:20px">協力会社へ依頼の主要フローを確認しました。<br>さっそく協力会社へ依頼してみましょう！</div>',
    '<div style="background:#eaf5f0;border:1px solid #a7f3d0;border-radius:10px;padding:14px 16px;text-align:left;margin-bottom:20px;font-size:12px;color:#065f46;line-height:1.8">',
      '<strong>💡 覚えておきたいポイント</strong><br>',
      '🏢 <strong>マッチ度</strong>でエリア・車格に合った会社を瞬時に選定<br>',
      '📞 <strong>電話・メール・SMS</strong>を一画面から発信できる<br>',
      '📄 <strong>発注書</strong>は下請法対応の必須項目を自動セット<br>',
      '✅ <strong>確定</strong>で送信ログを残し、案件と紐付け管理',
    '</div>',
    '<button onclick="closePartnerGuideComplete()" style="width:100%;padding:12px;background:#0D4A3A;color:#fff;font-size:14px;font-weight:700;border:none;border-radius:10px;cursor:pointer;">✨ 閉じる</button>',
  '</div>'
].join('');
document.body.appendChild(_partnerCompleteEl);

// ── welcomeステップラベル ──
var _partnerStepLabels = [
  ['🤝','「協力会社へ依頼」モーダルを開く'],
  ['🏢','STEP1：協力会社を選ぶ（マッチ度確認）'],
  ['📞','STEP2：連絡する（電話・メール・SMS）'],
  ['📄','STEP3：発注書を作成（下請法対応）'],
  ['✅','STEP4：確定して依頼を完了']
];
(function(){
  var el = document.getElementById('partner-welcome-steps-list');
  if (!el) return;
  el.innerHTML = _partnerStepLabels.map(function(s, i) {
    return '<div style="display:flex;align-items:center;gap:10px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:6px 10px">'
      + '<div style="width:20px;height:20px;border-radius:50%;background:#0D4A3A;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:Inter,sans-serif">' + (i+1) + '</div>'
      + '<div style="font-size:11px;font-weight:700;color:#111827">' + s[0] + ' ' + s[1] + '</div>'
      + '</div>';
  }).join('');
})();

// ── 公開関数 ──
window.startPartnerGuide = function(phase, caseIdx) {
  _partnerPhase = phase || 'unprocessed';
  _partnerCaseIdx = (typeof caseIdx === 'number') ? caseIdx : 0;
  var el = document.getElementById('partner-guide-welcome');
  if (el) { el.style.display = 'flex'; }
};
window.closePartnerGuideWelcome = function() {
  var el = document.getElementById('partner-guide-welcome');
  if (el) { el.style.display = 'none'; }
};
window.closePartnerGuideComplete = function() {
  var el = document.getElementById('partner-guide-complete');
  if (el) { el.style.setProperty('display', 'none', 'important'); }
};
window.beginPartnerGuide = function() {
  closePartnerGuideWelcome();
  _partnerActive = true;
  _partnerStep = 0;
  var bd = document.getElementById('guide-backdrop');
  if (bd) bd.classList.add('active');
  _runPartnerStep(0);
};
window.partnerGuideNext = function() {
  if (_partnerStep < PARTNER_STEPS.length - 1) {
    _partnerStep++;
    _runPartnerStep(_partnerStep);
  } else {
    // 最終ステップ：ガイドを終了して完了モーダル表示
    _endPartnerGuide();
    setTimeout(_showPartnerComplete, 100);
  }
};
window.partnerGuidePrev = function() {
  if (_partnerStep > 0) { _partnerStep--; _runPartnerStep(_partnerStep); }
};
window.skipPartnerGuide = function() { _endPartnerGuide(); };

function _endPartnerGuide() {
  _partnerActive = false;
  // モーダルを閉じる（z-indexのインラインスタイルもクリア + 強制的に非表示）
  var m = document.getElementById('partner-modal');
  if (m) {
    m.classList.remove('open');
    m.style.zIndex = '';
    m.style.setProperty('display', 'none', 'important');
    // 次回開く時のためにdisplayを元に戻す（遅延）
    setTimeout(function(){
      m.style.removeProperty('display');
    }, 500);
  }
  var bd = document.getElementById('guide-backdrop');
  if (bd) bd.classList.remove('active');
  var b = document.getElementById('guide-bubble');
  if (b) { b.style.cssText = 'display:none'; b.className = ''; }
  var ring = document.getElementById('guide-ring');
  if (ring) ring.style.display = 'none';
}

// ── 完了モーダルを確実に表示するヘルパー ──
function _showPartnerComplete() {
  var el = document.getElementById('partner-guide-complete');
  if (!el) return;
  // DOM末尾に移動して、後発の要素より確実に上に来るようにする
  document.body.appendChild(el);
  // 表示
  el.style.setProperty('display', 'flex', 'important');
}

// ── ヘルパー：パートナーモーダルを開く（ガイド用） ──
function _openPartnerModalForGuide(targetStep, done) {
  var m = document.getElementById('partner-modal');
  var isOpen = m && m.classList.contains('open');
  if (!isOpen) {
    if (typeof openPartnerModal === 'function') {
      openPartnerModal(_partnerCaseIdx, _partnerPhase);
    }
  }
  // モーダルの z-index をバックドロップより上、リングより下に設定
  if (m) m.style.zIndex = '9008';

  // ガイドではユーザーが選択をしないので、STEP 2 以降に進む前に協力会社を仮選択しておく
  // （これがないと buildConfirmStep などで partnerSelectedId が null でクラッシュする）
  function ensurePartnerSelected() {
    if (typeof window.selectPartner !== 'function') return;
    // 既に選択済みかチェック（.partner-card.selected が存在するか）
    var alreadySelected = document.querySelector('.partner-card.selected');
    if (alreadySelected) return;
    // partner-list 内の最初のカードを探して、その id から partner id を取得
    var firstCard = document.querySelector('#partner-list .partner-card');
    if (firstCard && firstCard.id && firstCard.id.indexOf('pcard-') === 0) {
      var partnerId = firstCard.id.substring('pcard-'.length);
      try { window.selectPartner(partnerId); } catch (e) { /* ignore */ }
    }
  }

  // STEP切り替え
  if (typeof goToPartnerStep === 'function' && targetStep) {
    setTimeout(function(){
      // STEP 2 以降に進む前に協力会社を選択
      if (targetStep >= 2) {
        ensurePartnerSelected();
      }
      try { goToPartnerStep(targetStep); } catch(e) { console.warn('goToPartnerStep failed:', e); }
      setTimeout(done, 200);
    }, isOpen ? 50 : 350);
  } else {
    setTimeout(done, isOpen ? 50 : 350);
  }
}

// ── ステップ定義 ──
var PARTNER_STEPS = [
  {
    badge: 'STEP 1 / 5', emoji: '🤝',
    title: '「協力会社へ依頼」ボタンを押す',
    body: '案件詳細の中央付近にある<span class="ghl">「協力会社へ依頼」ボタン</span>を押すと、依頼モーダルが立ち上がります。<br><br>'
        + '自社で配車できない案件や、複数台が必要な案件で<span class="ghl">傭車・委託</span>を行うときに使います。',
    arrowDir: 'above',
    prepare: function(done) {
      // モーダルが既に開いていれば閉じる
      var m = document.getElementById('partner-modal');
      if (m && m.classList.contains('open')) {
        if (typeof closeModal === 'function') closeModal('partner-modal');
        else m.classList.remove('open');
      }
      // 該当ページへ遷移
      if (typeof showPage === 'function') showPage('cases');
      if (typeof switchPhase === 'function') switchPhase(_partnerPhase);
      guideDelay(300, done);
    },
    targetFn: function() {
      // 該当案件カードの「協力会社へ依頼」ボタンを探す
      var btns = document.querySelectorAll('button.btn.btn-secondary.btn-sm');
      for (var i = 0; i < btns.length; i++) {
        var oc = btns[i].getAttribute('onclick') || '';
        if (oc.indexOf("openPartnerModal(" + _partnerCaseIdx + ",'" + _partnerPhase + "')") >= 0) {
          return btns[i];
        }
      }
      // 見つからない場合は最初の協力会社へ依頼ボタン
      for (var j = 0; j < btns.length; j++) {
        var oc2 = btns[j].getAttribute('onclick') || '';
        if (oc2.indexOf('openPartnerModal') >= 0) return btns[j];
      }
      return null;
    }
  },
  {
    badge: 'STEP 2 / 5', emoji: '🏢',
    title: '協力会社を選ぶ（マッチ度を確認）',
    body: '一覧から依頼する<span class="ghl">協力会社を1社選択</span>します。<br><br>'
        + '各社のカードには<span class="ghl">エリア・車格のマッチ度</span>や過去実績、運賃目安が表示されます。<br><br>'
        + '緑のタグが付いている会社は<span class="ghl">この案件との適合度が高い</span>会社です。',
    arrowDir: 'right',
    prepare: function(done) {
      _openPartnerModalForGuide(1, done);
    },
    targetFn: function() {
      return document.getElementById('partner-list')
        || document.getElementById('partner-step1');
    }
  },
  {
    badge: 'STEP 3 / 5', emoji: '📞',
    title: '連絡方法を選ぶ（電話・メール・SMS）',
    body: '会社を選んだら<span class="ghl">「次へ：連絡方法を選ぶ」</span>でSTEP2へ。<br><br>'
        + '<span class="ghl">📞 電話 / ✉️ メール / 💬 SMS</span>の3つから連絡手段を選べます。<br><br>'
        + '電話タブでは<strong>トークスクリプト</strong>、メール／SMSタブでは<strong>本文テンプレート</strong>が案件情報から自動生成されます。',
    arrowDir: 'right',
    prepare: function(done) {
      _openPartnerModalForGuide(2, done);
    },
    targetFn: function() {
      return document.querySelector('#partner-step2 .contact-tabs')
        || document.getElementById('partner-step2');
    }
  },
  {
    badge: 'STEP 4 / 5', emoji: '📄',
    title: '発注書を作成する（下請法対応）',
    body: 'STEP3では<span class="ghl">下請法対応の発注書</span>を作成します。<br><br>'
        + '案件情報から<span class="ghl">運賃・支払期日・取引条件など必須項目が自動セット</span>されるので、内容を確認して送信できます。<br><br>'
        + '<span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:3px;font-weight:700;font-size:11px">法対応</span> 書面の発行・控えの保管も自動で記録されます。',
    arrowDir: 'right',
    prepare: function(done) {
      _openPartnerModalForGuide(3, done);
    },
    targetFn: function() {
      return document.getElementById('partner-step3');
    }
  },
  {
    badge: 'STEP 5 / 5', emoji: '✅',
    title: '確定して依頼を完了する',
    body: '最後にSTEP4で<span class="ghl">依頼内容の最終確認</span>を行い、<br>'
        + '<span class="ghl">「確定（協力会社へ依頼）」ボタン</span>を押すと依頼が完了します。<br><br>'
        + '送信ログは案件に紐付いて残り、<span class="ghl">処理中タブの「協力会社」タグ</span>から後で確認できます。',
    arrowDir: 'above',
    prepare: function(done) {
      _openPartnerModalForGuide(4, done);
    },
    targetFn: function() {
      return document.getElementById('partner-next-btn')
        || document.getElementById('partner-step4');
    }
  }
];

// ── ステップ実行 ──
function _runPartnerStep(index) {
  var step = PARTNER_STEPS[index];
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
  var prevBtn = document.getElementById('guide-prev-btn');
  prevBtn.style.display = index === 0 ? 'none' : '';
  prevBtn.removeAttribute('onclick'); // HTML属性のonclick="guidePrev()"を削除
  prevBtn.onclick = function() { window.partnerGuidePrev(); };

  var nb = document.getElementById('guide-next-btn');
  nb.innerHTML = index === PARTNER_STEPS.length - 1
    ? '完了 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
    : '次へ <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
  nb.removeAttribute('onclick'); // HTML属性のonclick="guideNext()"を削除
  nb.onclick = function() { window.partnerGuideNext(); };

  var skipBtn = document.querySelector('.guide-btn-skip');
  if (skipBtn) {
    skipBtn.removeAttribute('onclick'); // HTML属性のonclick="skipGuide()"を削除
    skipBtn.onclick = function() { window.skipPartnerGuide(); };
  }

  document.getElementById('guide-progress').innerHTML = PARTNER_STEPS
    .map(function(_, i) { return '<div class="guide-dot ' + (i < index ? 'done' : i === index ? 'active' : '') + '"></div>'; }).join('');

  var bd = document.getElementById('guide-backdrop');
  if (bd) bd.classList.add('active');

  step.prepare(function() {
    guideRAF(4, function() { _placeGuide(step); });
  });
}

})();