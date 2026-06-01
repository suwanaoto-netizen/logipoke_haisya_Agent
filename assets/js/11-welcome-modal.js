(function(){
'use strict';

// ── ウェルカム・完了モーダルをbodyに追加 ──
var _faxWelcomeEl = document.createElement('div');
_faxWelcomeEl.id = 'fax-guide-welcome';
_faxWelcomeEl.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9100;align-items:center;justify-content:center;';
_faxWelcomeEl.innerHTML = [
  '<div style="background:#fff;border-radius:16px;width:360px;max-width:calc(100vw - 40px);box-shadow:0 24px 64px rgba(0,0,0,0.25);overflow:hidden;animation:guideWelcomeIn .35s cubic-bezier(.4,0,.2,1)">',
    '<div style="background:linear-gradient(135deg,#0D4A3A 0%,#1a7a5e 60%,#3BB888 100%);padding:14px 20px 12px;text-align:center">',
      '<div style="font-size:24px;margin-bottom:4px">📬</div>',
      '<div style="font-size:15px;font-weight:800;color:#fff;margin-bottom:2px">メール・FAX受付 ガイド</div>',
      '<div style="font-size:11px;color:rgba(255,255,255,0.8)">届いた依頼をAIが自動解析→案件登録まで 5ステップ</div>',
    '</div>',
    '<div style="padding:12px 16px">',
      '<div style="display:flex;flex-direction:column;gap:5px" id="fax-welcome-steps"></div>',
    '</div>',
    '<div style="padding:0 16px 14px;display:flex;gap:10px">',
      '<button onclick="closeFaxGuideWelcome()" style="padding:10px 16px;background:#f3f4f6;color:#374151;font-size:13px;font-weight:600;border:1px solid #e5e7eb;border-radius:10px;cursor:pointer;">後で見る</button>',
      '<button onclick="beginFaxGuide()" style="flex:1;padding:10px;background:#0D4A3A;color:#fff;font-size:13px;font-weight:700;border:none;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 3px 10px rgba(13,74,58,0.3)">',
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
        'ガイドをスタート',
      '</button>',
    '</div>',
  '</div>'
].join('');
document.body.appendChild(_faxWelcomeEl);

var _faxCompleteEl = document.createElement('div');
_faxCompleteEl.id = 'fax-guide-complete';
_faxCompleteEl.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9100;align-items:center;justify-content:center;';
_faxCompleteEl.innerHTML = [
  '<div style="background:#fff;border-radius:20px;width:400px;max-width:calc(100vw - 40px);padding:36px 28px 28px;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.22);animation:guideWelcomeIn .35s cubic-bezier(.4,0,.2,1)">',
    '<span style="font-size:52px;margin-bottom:12px;display:block">🎉</span>',
    '<div style="font-size:20px;font-weight:800;color:#0D4A3A;margin-bottom:8px">ガイド完了！</div>',
    '<div style="font-size:13px;color:#6b7280;line-height:1.7;margin-bottom:20px">メール・FAX受付の主要フローを確認しました。<br>さっそく受信Boxから依頼を処理しましょう！</div>',
    '<div style="background:#eaf5f0;border:1px solid #a7f3d0;border-radius:10px;padding:14px 16px;text-align:left;margin-bottom:20px;font-size:12px;color:#065f46;line-height:1.8">',
      '<strong>💡 覚えておきたいポイント</strong><br>',
      '📬 <strong>受信Box</strong>は取引先ごとに発行できる<br>',
      '🤖 <strong>AI解析</strong>で発地・着地・荷物を自動抽出<br>',
      '🚀 ワンクリックで<strong>個別案件処理の未処理</strong>へ登録<br>',
      '📦 <strong>一括選択</strong>で複数メールをまとめて送信',
    '</div>',
    '<button onclick="closeFaxGuideComplete()" style="width:100%;padding:12px;background:#0D4A3A;color:#fff;font-size:14px;font-weight:700;border:none;border-radius:10px;cursor:pointer;">✨ 受信Boxを確認する</button>',
  '</div>'
].join('');
document.body.appendChild(_faxCompleteEl);

// ── ステップ定義 ──
var FAX_STEPS = [
  {
    badge:'STEP 1 / 5', emoji:'📬',
    title:'受信Box一覧を確認する',
    body:'左ペインには取引先・チャネルごとの<span class="ghl">受信Box</span>が並んでいます。<br><br>✉️ メール / 📠 FAX の種別と<span class="ghl">未読バッジ</span>がひと目でわかります。',
    arrowDir:'right',
    needsRightPane: false,
    prepare: function(done){
      _faxBackdropNormal();
      showPage_byName('fax');
      guideDelay(80, done);
    },
    targetFn: function(){
      return document.querySelector('#fax-addr-list .fax-addr-item') || document.getElementById('fax-addr-list');
    }
  },
  {
    badge:'STEP 2 / 5', emoji:'📨',
    title:'受信メール・FAXを選択する',
    body:'中央ペインに届いた<span class="ghl">メール・FAX一覧</span>が表示されます。<br><br><span class="ghl">「AI解析済」タグ</span>がついたものはAIが内容を抽出済みです。',
    arrowDir:'right',
    needsRightPane: false,
    prepare: function(done){
      _faxBackdropNormal();
      showPage_byName('fax');
      guideDelay(80, done);
    },
    targetFn: function(){
      return document.querySelector('#fax-mail-list .fax-mail-item') || document.getElementById('fax-mail-list');
    }
  },
  {
    badge:'STEP 3 / 5', emoji:'🤖',
    title:'AIデータ化結果を確認する',
    body:'右ペインの<span class="ghl">AIデータ化結果パネル</span>に、AIが自動抽出した情報が表示されます。<br><br>集荷・配送先、荷物、希望納期を自動で読み取ります。',
    arrowDir:'left',
    needsRightPane: true,
    prepare: function(done){
      _faxOpenRightPane('i1', done);
    },
    targetFn: function(){
      return document.querySelector('#fax-detail-body .fax-ai-panel');
    }
  },
  {
    badge:'STEP 4 / 5', emoji:'🚀',
    title:'個別案件処理の未処理へ登録する',
    body:'AI解析完了後、右ペイン下部の<span class="ghl">「個別案件処理の未処理へ」ボタン</span>を押します。<br><br>ワンクリックで案件管理の<span class="ghl">未処理リストに自動登録</span>されます。',
    arrowDir:'above',
    needsRightPane: true,
    prepare: function(done){
      _faxOpenRightPane('i1', done);
    },
    targetFn: function(){
      var bar = document.getElementById('fax-action-bar');
      if(!bar) return null;
      return bar.querySelector('.btn-primary') || bar;
    }
  },
  {
    badge:'STEP 5 / 5', emoji:'🏢',
    title:'新規受信アドレスを発行する',
    body:'取引先ごとに専用の受信アドレスを発行できます。<br><br>右上の<span class="ghl">「新規アドレス発行」ボタン</span>をクリックして種別と取引先名を入力するだけです。',
    arrowDir:'below',
    needsRightPane: false,
    prepare: function(done){
      _faxBackdropNormal();
      showPage_byName('fax');
      guideDelay(80, done);
    },
    targetFn: function(){
      return document.querySelector('#page-fax .fax-add-btn');
    }
  }
];

// ── ヘルパー ──

// STEP3・4用: 右ペインにメールを表示させる
// guide-backdrop を消して右ペインをそのまま見せる
function _faxOpenRightPane(itemId, done){
  // 1. faxページを表示（initFaxPageを差し替えてリセット防止）
  var _orig = window.initFaxPage;
  window.initFaxPage = function(){};
  showPage_byName('fax');

  guideDelay(50, function(){
    window.initFaxPage = _orig;

    // 2. BoxとItemを直接セット
    window.faxCurrentBoxIdx = 0;
    window.faxCurrentItemId = itemId;

    // 3. 右ペインを描画
    renderFaxDetail(itemId);
    renderFaxMailList();
    renderFaxAddrList();

    // 4. guide-backdropを非表示にして右ペインを見せる
    _faxBackdropHide();

    done();
  });
}

function _faxBackdropHide(){
  var bd = document.getElementById('guide-backdrop');
  if(bd){ bd.classList.add('active'); bd.style.opacity='0'; bd.style.pointerEvents='none'; }
}

function _faxBackdropNormal(){
  var bd = document.getElementById('guide-backdrop');
  if(bd){ bd.style.opacity=''; bd.style.pointerEvents=''; }
}

// ── 状態 ──
var _faxStep = 0, _faxActive = false;

// ── ウェルカムステップリスト描画 ──
var stepLabels = [
  ['📬','受信Box一覧を確認する'],
  ['📨','受信メール・FAXを選択する'],
  ['🤖','AIデータ化結果を確認する'],
  ['🚀','個別案件処理の未処理へ登録する'],
  ['🏢','新規受信アドレスを発行する']
];
var stepsEl = document.getElementById('fax-welcome-steps');
if(stepsEl){
  stepsEl.innerHTML = stepLabels.map(function(s,i){
    return '<div style="display:flex;align-items:center;gap:10px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:6px 10px">'
      +'<div style="width:20px;height:20px;border-radius:50%;background:#0D4A3A;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:Inter,sans-serif">'+(i+1)+'</div>'
      +'<div style="font-size:11px;font-weight:700;color:#111827">'+s[0]+' '+s[1]+'</div>'
      +'</div>';
  }).join('');
}

// ── 外部API ──
window.startFaxGuide = function(){
  document.getElementById('fax-guide-welcome').style.display = 'flex';
};
window.closeFaxGuideWelcome = function(){
  document.getElementById('fax-guide-welcome').style.display = 'none';
};
window.beginFaxGuide = function(){
  closeFaxGuideWelcome();
  _faxActive = true; _faxStep = 0;
  _runFaxStep(0);
};
window.faxGuideNext = function(){
  if(_faxStep < FAX_STEPS.length-1){ _faxStep++; _runFaxStep(_faxStep); }
  else{ _endFaxGuide(); document.getElementById('fax-guide-complete').style.display='flex'; }
};
window.faxGuidePrev = function(){
  if(_faxStep > 0){ _faxStep--; _runFaxStep(_faxStep); }
};
window.skipFaxGuide = function(){ _endFaxGuide(); };
window.closeFaxGuideComplete = function(){
  document.getElementById('fax-guide-complete').style.display='none';
};

function _endFaxGuide(){
  _faxActive = false;
  _faxBackdropNormal();
  var bd = document.getElementById('guide-backdrop');
  if(bd){ bd.classList.remove('active'); }
  var b = document.getElementById('guide-bubble');
  b.style.cssText='display:none'; b.className='';
  document.getElementById('guide-ring').style.display='none';
}

// ── ステップ実行 ──
function _runFaxStep(index){
  var step = FAX_STEPS[index];
  var bubble = document.getElementById('guide-bubble');
  bubble.style.cssText='display:none'; bubble.className='';
  document.getElementById('guide-ring').style.display='none';

  document.getElementById('guide-badge').textContent = step.badge;
  document.getElementById('guide-emoji').textContent = step.emoji||'';
  document.getElementById('guide-title').textContent = step.title;
  document.getElementById('guide-body').innerHTML    = step.body;
  document.getElementById('guide-prev-btn').style.display = index===0?'none':'';
  document.getElementById('guide-prev-btn').onclick = function(){ window.faxGuidePrev(); };

  var nb = document.getElementById('guide-next-btn');
  nb.innerHTML = index===FAX_STEPS.length-1
    ? '完了 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
    : '次へ <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
  nb.onclick = function(){ window.faxGuideNext(); };

  var skipBtn = document.querySelector('.guide-btn-skip');
  if(skipBtn) skipBtn.onclick = function(){ window.skipFaxGuide(); };

  document.getElementById('guide-progress').innerHTML = FAX_STEPS
    .map(function(_,i){ return '<div class="guide-dot '+(i<index?'done':i===index?'active':'')+'"></div>'; }).join('');

  // STEP1・2・5はbackdropを通常表示
  if(!step.needsRightPane){
    var bd = document.getElementById('guide-backdrop');
    if(bd){ bd.classList.add('active'); }
  }

  step.prepare(function(){
    guideRAF(4, function(){ _placeGuide(step); });
  });
}

})();