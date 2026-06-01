// ══════════════════════════════════════════════════════════════════
//  ロジポケ配車Agent インタラクティブガイド v4
//  ─ モーダルは .open クラスで制御（style.display 不使用）
//  ─ rAF×4 で CSS アニメーション完了後に計測・配置
//  ─ 吹き出し高さを visibility:hidden で実測してから座標確定
// ══════════════════════════════════════════════════════════════════

// ─── ヘルパー ────────────────────────────────────────────────────
function guideOpenModal(id){
  const el=document.getElementById(id);
  if(!el) return;
  el.classList.add('open');
  // バックドロップ(9005)より上でリング(9015)より下に設定
  el.style.zIndex='9008';
}
function guideCloseModal(id){
  const el=document.getElementById(id);
  if(!el) return;
  el.classList.remove('open');
  el.style.zIndex=''; // z-index をリセット
}
function guideModalIsOpen(id){
  const el=document.getElementById(id);
  return el ? el.classList.contains('open') : false;
}
function guideCloseAllModals(){
  ['register-modal','confirm-modal','partner-modal','matching-modal'].forEach(guideCloseModal);
}
function guideDelay(ms, cb){ setTimeout(cb, ms); }
function guideRAF(n, cb){
  if(n <= 0){ cb(); return; }
  requestAnimationFrame(() => guideRAF(n-1, cb));
}

// ─── データ注入 ───────────────────────────────────────────────────
function _injectRecResult(){
  const r = document.getElementById('rec-result');
  if(r) r.style.display = 'block';
  const t = document.getElementById('rec-transcript');
  if(t && !t.textContent.trim())
    t.textContent = '品川区の倉庫から大阪市の配送センターへ、パレット10枚、2トン、5月25日AM指定でお願いします。';
  const g = document.getElementById('rec-ai-grid');
  if(g && !g.querySelector('.ai-extract-item'))
    g.innerHTML = `
      <div class="ai-extract-item"><div class="ai-extract-label">発地</div><div class="ai-extract-val">東京都品川区</div></div>
      <div class="ai-extract-item"><div class="ai-extract-label">着地</div><div class="ai-extract-val">大阪市西区</div></div>
      <div class="ai-extract-item"><div class="ai-extract-label">荷物</div><div class="ai-extract-val">パレット×10 / 2t</div></div>
      <div class="ai-extract-item"><div class="ai-extract-label">納期</div><div class="ai-extract-val">05/25 AM指定</div></div>`;
  const b = document.getElementById('rec-confidence-badge');
  if(b && !b.textContent.trim()) b.textContent = '解析精度 98%';
}
function _injectLawItems(){
  // ガイド専用の法令チェックエリアを表示するだけ（既存のwarningは触らない）
  const area = document.getElementById('confirm-law-ok');
  if(area) area.style.display = 'block';
}

// ─── ステップ定義 ─────────────────────────────────────────────────
const GUIDE_STEPS = [
  {
    badge:'STEP 1 / 11', emoji:'📱',
    title:'新規案件のクイック登録',
    body:`急な電話依頼でも大丈夫！ページ上部の
      <span class="ghl">「新規登録」ボタン</span>を押してください。<br><br>
      メモ不要。<span class="ghl">AIが会話から発地・着地・荷物をすべて自動書き起こし</span>します。`,
    arrowDir:'below',
    prepare(done){
      guideCloseAllModals();
      showPage('cases'); switchPhase('unprocessed');
      guideDelay(350, done);
    },
    targetFn(){ return document.getElementById('btn-new-register'); },
  },
  {
    badge:'STEP 2 / 11', emoji:'🎙️',
    title:'「録音する」タブでAI文字起こし開始',
    body:`新規登録モーダルの <span class="ghl">「🎙️ 録音する」タブ</span> を選びます。<br><br>
      マイクボタンを押して通話を録音するだけで、
      AIがリアルタイムで<span class="ghl">ルート・荷物・日時を自動抽出</span>してくれます。`,
    arrowDir:'below',
    prepare(done){
      guideCloseAllModals();
      openRegisterModal();
      document.getElementById('register-modal').style.zIndex='9008';
      guideDelay(350, () => {
        document.getElementById('regtab-rec')?.click();
        guideDelay(200, done);
      });
    },
    targetFn(){ return document.getElementById('regtab-rec'); },
  },
  {
    badge:'STEP 3 / 11', emoji:'✅',
    title:'AI解析結果を確認して登録',
    body:`録音後、AIが <span class="ghl">「品川区 → 大阪市」などのルート・荷物情報</span> を自動抽出します。<br><br>
      内容を確認したら下部の
      <span class="ghl">「個別案件処理へ登録」ボタン</span>を押すだけで登録完了です。`,
    arrowDir:'above',
    prepare(done){
      if(!guideModalIsOpen('register-modal')){
        openRegisterModal();
        document.getElementById('register-modal').style.zIndex='9008';
        guideDelay(350, () => {
          document.getElementById('regtab-rec')?.click();
          guideDelay(200, () => { _injectRecResult(); guideDelay(100, done); });
        });
      } else {
        _injectRecResult();
        guideDelay(150, done);
      }
    },
    targetFn(){ return document.getElementById('reg-submit-btn'); },
  },
  {
    badge:'STEP 4 / 11', emoji:'🏷️',
    title:'案件パターンと運賃適正判定',
    body:`登録された案件がこのリストに並びます。<br><br>
      各カードにはAIが自動で <span class="ghl">案件パターン（緊急・チャーターなど）</span> と
      <span class="ghl">市場相場との運賃比較</span> を表示。<br><br>
      ⏸ <strong style="color:#0D4A3A">仮押さえ中</strong> バッジでダブルブッキングを防止します。`,
    arrowDir:'right',
    prepare(done){
      guideCloseAllModals();
      showPage('cases'); switchPhase('unprocessed');
      guideDelay(450, done);
    },
    targetFn(){ return document.querySelector('#unprocessed-list .case-card'); },
  },
  {
    badge:'STEP 5 / 11', emoji:'🚛',
    title:'AIが最適ドライバーをスコア順で提案',
    body:`<span class="ghl">「処理中」タブ</span> では配車マッチングを行います。<br><br>
      右パネルにAIが <span class="ghl">現在地・稼働時間・熟練度をスコアリング</span> した
      ドライバー候補を順位付きで表示します。<br><br>
      一番上の候補を選べばまず間違いありません！`,
    arrowDir:'right',
    prepare(done){
      guideCloseAllModals();
      showPage('cases');
      switchPhase('processing');
      guideDelay(500, () => {
        const first = document.querySelector('#processing-list .case-card');
        if(first) first.click();
        guideDelay(700, done);
      });
    },
    targetFn(){
      // 「車両候補（AI推薦）」カード内の vcard-list を指す
      // processing-detail 内の .detail-card のうち vcard-list を持つもの
      const vcardList = document.querySelector('#processing-detail .vcard-list');
      if(vcardList) return vcardList.closest('.detail-card') || vcardList;
      return document.querySelector('#processing-detail');
    },
  },
  {
    badge:'STEP 6 / 11', emoji:'⚖️',
    title:'確定前の法令コンプライアンスチェック',
    body:`「確定（ドライバーへ指示）」を押すとこのモーダルが開きます。<br><br>
      AIが <span class="ghl">改善基準告示（2024年問題）に違反しないか</span> を自動チェックし、
      ✅ / ⚠️ で一覧表示します。<br><br>
      ✅ が揃ったら安心して次へ進めます。`,
    arrowDir:'right',
    prepare(done){
      guideCloseAllModals();
      showPage('cases');
      switchPhase('processing');
      guideDelay(400, () => {
        const first = document.querySelector('#processing-list .case-card');
        if(first) first.click();
        guideDelay(600, () => {
          if(typeof openConfirmModal === 'function') openConfirmModal(0);
          else guideOpenModal('confirm-modal');
          guideDelay(350, () => { _injectLawItems(); done(); });
        });
      });
    },
    targetFn(){ return document.getElementById('confirm-law-ok'); },
  },
  {
    badge:'STEP 7 / 11', emoji:'🎉',
    title:'確定・指示送信でドライバーへ自動通知',
    body:`法令チェックが ✅ なら <span class="ghl">「確定・指示送信」ボタン</span> を押します。<br><br>
      ドライバーのアプリ・SMS・メールへ <span class="ghl">自動で指示が飛びます</span>。<br><br>
      📧 協力会社へのSMS/メールも自動生成。
      <strong style="color:#0D4A3A">「言った言わない」トラブルをゼロ</strong>にします！`,
    arrowDir:'above',
    prepare(done){
      if(!guideModalIsOpen('confirm-modal')){
        showPage('cases');
        switchPhase('processing');
        guideDelay(400, () => {
          const first = document.querySelector('#processing-list .case-card');
          if(first) first.click();
          guideDelay(600, () => {
            if(typeof openConfirmModal === 'function') openConfirmModal(0);
            else guideOpenModal('confirm-modal');
            document.getElementById('confirm-modal').style.zIndex='9008';
            guideDelay(350, () => { _injectLawItems(); done(); });
          });
        });
      } else {
        guideDelay(100, done);
      }
    },
    targetFn(){
      return document.querySelector('#confirm-modal .modal-footer .btn-orange')
          || document.querySelector('#confirm-modal .btn-orange');
    },
  },
  {
    badge:'STEP 8 / 11', emoji:'📡',
    title:'運行実績・動態管理で配車状況を確認',
    body:`マッチングを実行した案件は <span class="ghl">処理済みページに移動</span>します。<br><br>
      右パネルの <span class="ghl">「運行実績・動態管理」</span> カードでは、その配車が
      正しく運行しているかリアルタイムで確認できます。<br><br>
      📍 <strong style="color:#0D4A3A">ライブマップ</strong>でドライバーの現在地・速度・到着予定を
      一目で把握できます。`,
    arrowDir:'left',
    prepare(done){
      guideCloseAllModals();
      showPage('cases');
      switchPhase('processed');
      guideDelay(500, () => {
        const first = document.querySelector('#processed-list .case-card');
        if(first) first.click();
        guideDelay(700, done);
      });
    },
    targetFn(){
      return document.getElementById('processed-operations-card');
    },
  },
  {
    badge:'STEP 9 / 11', emoji:'📄',
    title:'請求情報を確認・請求書を表示',
    body:`処理済みページの右パネルには <span class="ghl">「請求情報」</span> カードが表示されます。<br><br>
      売上・粗利・請求書番号を確認し、
      <span class="ghl">「請求書を表示」</span> ボタンで請求書をその場でプレビューできます。<br><br>
      📥 PDF ダウンロード・印刷も <strong style="color:#0D4A3A">ワンクリックで完結</strong>します！`,
    arrowDir:'left',
    prepare(done){
      guideCloseAllModals();
      showPage('cases');
      switchPhase('processed');
      guideDelay(500, () => {
        const first = document.querySelector('#processed-list .case-card');
        if(first) first.click();
        guideDelay(700, done);
      });
    },
    targetFn(){
      return document.getElementById('processed-invoice-card');
    },
  },
  {
    badge:'STEP 10 / 11', emoji:'✍️',
    title:'請求確定ボタンで案件を最終確定',
    body:`処理済みに移った案件は <span class="ghl">仮確定の状態</span> です。<br><br>
      右パネル上部の <span class="ghl">「請求確定する」ボタン</span> を押すことで、
      案件の<strong style="color:#0D4A3A">最終確定</strong>を行います。<br><br>
      確定後は請求書が正式発行され、請求管理ページにも反映されます。`,
    arrowDir:'below',
    prepare(done){
      guideCloseAllModals();
      // billing-confirm-modal が開いていれば閉じる
      const bcm = document.getElementById('billing-confirm-modal');
      if(bcm){ bcm.style.display='none'; bcm.classList.remove('bcm-open'); }
      showPage('cases');
      switchPhase('processed');
      guideDelay(500, () => {
        const first = document.querySelector('#processed-list .case-card');
        if(first) first.click();
        guideDelay(700, done);
      });
    },
    targetFn(){
      return document.querySelector('.btn-billing-confirm');
    },
  },
  {
    badge:'STEP 11 / 11', emoji:'📝',
    title:'請求確定モーダルで変更点を編集して確定',
    body:`案件開始後に発生した <span class="ghl">変更点はこのモーダルで編集</span>できます。<br><br>
      ルートの変更・実際の運賃など、最終的な情報を修正したうえで
      <span class="ghl">「請求確定する」</span> を押して完了です。<br><br>
      📋 確定した内容がそのまま <strong style="color:#0D4A3A">請求書に反映</strong>されます。`,
    arrowDir:'right',
    prepare(done){
      guideCloseAllModals();
      showPage('cases');
      switchPhase('processed');
      guideDelay(400, () => {
        const first = document.querySelector('#processed-list .case-card');
        if(first) first.click();
        guideDelay(600, () => {
          // 未確定の案件のインデックスを探す
          let idx = processedCases.findIndex(c => !c.billingConfirmed);
          if(idx < 0) idx = 0;
          openBillingConfirmModal(idx);
          const bcm = document.getElementById('billing-confirm-modal');
          if(bcm) bcm.style.zIndex = '9008';
          guideDelay(400, done);
        });
      });
    },
    targetFn(){
      return document.querySelector('.billing-modal-box');
    },
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  請求管理ページ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 日付ユーティリティ
function formatDateSlash(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}/${m}/${day}`;
}
function formatDateYYYYMM(d) {
  return d.getFullYear() + String(d.getMonth()+1).padStart(2,'0');
}
let invoiceSelectedIds = new Set();
let invoiceActiveId = null;

function initInvoicePage() {
  // 月フィルターを processedCases の実データから動的生成
  const monthSel = document.getElementById('inv-month-filter');
  if (monthSel) {
    const months = [...new Set(processedCases.map(c => c.invoiceDate ? c.invoiceDate.slice(0,7) : ''))].filter(Boolean).sort().reverse();
    monthSel.innerHTML = '<option value="">請求月：すべて</option>'
      + months.map(m => {
          const [y, mo] = m.split('/');
          return `<option value="${m}">${y}年${parseInt(mo)}月</option>`;
        }).join('');
  }

  renderInvoiceList();
  // スプリッター再初期化
  if (typeof makeSplitter === 'function') {
    makeSplitter('splitter-invoice', 220, 620);
  }
  // 前回選択 or 最新追加案件があれば自動プレビュー
  const targetId = invoiceActiveId || (processedCases.length ? processedCases[0].id : null);
  if (targetId) {
    invoiceActiveId = targetId;
    const c = processedCases.find(x => x.id === targetId);
    if (c) {
      renderInvoiceList(); // アクティブ行を反映
      renderInvoicePreview(c);
    }
  }
}

function getFilteredInvoiceCases() {
  const monthVal  = (document.getElementById('inv-month-filter')?.value || '');
  const statusVal = (document.getElementById('inv-status-filter')?.value || '');
  return processedCases.filter(c => {
    if (monthVal  && !c.invoiceDate.startsWith(monthVal)) return false;
    if (statusVal === 'paid'   &&  !c.paid) return false;
    if (statusVal === 'unpaid' &&   c.paid) return false;
    return true;
  });
}

function renderInvoiceList() {
  const list = document.getElementById('inv-case-list');
  if (!list) return;
  const cases = getFilteredInvoiceCases();

  // 全選択チェックボックス状態を更新
  const allChecked  = cases.length > 0 && cases.every(c => invoiceSelectedIds.has(c.id));
  const someChecked = cases.some(c => invoiceSelectedIds.has(c.id));
  const allChk = document.getElementById('inv-check-all');
  if (allChk) { allChk.checked = allChecked; allChk.indeterminate = !allChecked && someChecked; }

  const totalEl = document.getElementById('inv-total-count');
  if (totalEl) totalEl.textContent = cases.length + ' 件';

  updateInvoiceSelCount();

  if (!cases.length) {
    list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted);font-size:13px">対象の案件がありません</div>';
    return;
  }

  list.innerHTML = cases.map(c => {
    const checked = invoiceSelectedIds.has(c.id);
    const active  = c.id === invoiceActiveId;
    const isSaved = etaxSavedIds.has(c.id);
    return `<div class="inv-case-row${active ? ' inv-active' : ''}" id="invrow-${c.id}" onclick="selectInvoiceCase('${c.id}')">
      <label class="inv-chk-label" onclick="event.stopPropagation()">
        <input type="checkbox" class="inv-chk" data-id="${c.id}"
          ${checked ? 'checked' : ''}
          onchange="toggleInvoiceOne('${c.id}', this.checked)"
          style="width:15px;height:15px;accent-color:var(--sidebar-bg);cursor:pointer;flex-shrink:0">
      </label>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap">
          <span style="font-size:12px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.client}</span>
          ${c.paid
            ? '<span class="paid-badge" style="font-size:10px;padding:1px 7px;flex-shrink:0">入金済</span>'
            : '<span class="unpaid-badge" style="font-size:10px;padding:1px 7px;flex-shrink:0">未入金</span>'}
          ${isSaved ? '<span class="etax-badge saved" style="font-size:9px;padding:1px 6px;flex-shrink:0">⚑電帳法</span>' : ''}
          ${c.billingConfirmed
            ? '<span class="billing-confirmed-badge" style="font-size:9px;padding:1px 7px;flex-shrink:0"><svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" style="width:8px;height:8px;stroke:#6DD5A8"><polyline points=\"20 6 9 17 4 12\"/></svg>請求確定</span>'
            : '<span class="billing-pending-badge" style="font-size:9px;padding:1px 7px;flex-shrink:0">未確定</span>'}
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.from} → ${c.to}</div>
        <div style="display:flex;gap:10px">
          <span style="font-size:10px;color:var(--text-muted)">${c.invoiceNo}</span>
          <span style="font-size:10px;color:var(--text-muted)">請求日：${c.invoiceDate}</span>
        </div>
        <div style="font-size:12px;font-weight:700;font-family:'Inter',sans-serif;color:var(--sidebar-bg);margin-top:3px">¥${c.sales.toLocaleString()}</div>
      </div>
    </div>`;
  }).join('');
}

function toggleInvoiceAll(checked) {
  const cases = getFilteredInvoiceCases();
  if (checked) cases.forEach(c => invoiceSelectedIds.add(c.id));
  else         invoiceSelectedIds.clear();
  renderInvoiceList();
}

function toggleInvoiceOne(id, checked) {
  if (checked) invoiceSelectedIds.add(id);
  else         invoiceSelectedIds.delete(id);
  // 全選択チェックボックス更新
  const cases = getFilteredInvoiceCases();
  const allChk = document.getElementById('inv-check-all');
  if (allChk) {
    const allChecked  = cases.every(c => invoiceSelectedIds.has(c.id));
    const someChecked = cases.some(c => invoiceSelectedIds.has(c.id));
    allChk.checked       = allChecked;
    allChk.indeterminate = !allChecked && someChecked;
  }
  updateInvoiceSelCount();
}

function updateInvoiceSelCount() {
  const n = invoiceSelectedIds.size;
  const countWrap = document.getElementById('inv-selected-count');
  const countNum  = document.getElementById('inv-sel-num');
  if (countWrap) countWrap.style.display = n > 0 ? '' : 'none';
  if (countNum)  countNum.textContent = n;
  // 電帳法一括保存ボタン表示制御
  const etaxBtn = document.getElementById('inv-etax-bulk-btn');
  if (etaxBtn) etaxBtn.style.display = n > 0 ? 'inline-flex' : 'none';
}

function selectInvoiceCase(id) {
  invoiceActiveId = id;
  // アクティブスタイル更新
  document.querySelectorAll('.inv-case-row').forEach(r => r.classList.remove('inv-active'));
  const row = document.getElementById('invrow-' + id);
  if (row) row.classList.add('inv-active');
  // プレビュー描画
  const c = processedCases.find(x => x.id === id);
  if (c) renderInvoicePreview(c);
}

function renderInvoicePreview(c) {
  const el = document.getElementById('inv-preview-content');
  if (!el) return;

  // フォーマットバー表示・初期化
  const fmtBar = document.getElementById('inv-format-bar');
  if (fmtBar) fmtBar.style.display = 'flex';
  if (typeof updateInvoiceFormatSelectors === 'function') updateInvoiceFormatSelectors();

  // 取引先のデフォルトフォーマットを探してセレクターに反映
  const selEl = document.getElementById('inv-page-format-sel');
  const badgeEl = document.getElementById('inv-fmt-client-badge');
  if (selEl && c && typeof _invFormats !== 'undefined') {
    // clientMasterData から取引先を名前で探す
    const clientRec = typeof clientMasterData !== 'undefined'
      ? clientMasterData.find(function(x){ return x.name === c.client; }) : null;
    const clientFmtId = clientRec && clientRec.defaultFormatId;
    // まだ手動変更していなければ取引先デフォルトを適用
    if (clientFmtId && !selEl._manuallyChanged) {
      selEl.value = clientFmtId;
      if (badgeEl) badgeEl.style.display = '';
    } else if (!selEl._manuallyChanged) {
      // システムデフォルト
      const def = _invFormats.find(function(f){ return f.isDefault; });
      if (def) selEl.value = def.id;
      if (badgeEl) badgeEl.style.display = 'none';
    }
  }

  // 適用フォーマット取得
  const fmtId  = selEl ? selEl.value : null;
  const fmt    = (typeof getInvFormat === 'function') ? getInvFormat(fmtId) : null;
  const accentColor = (fmt && fmt.color) || '#0D4A3A';
  const taxRateVal  = (fmt && fmt.taxRate != null) ? fmt.taxRate : 10;

  const issueDate = c.invoiceDate || '2024/05/26';
  const isSaved   = etaxSavedIds.has(c.id);
  const savedData = isSaved ? etaxRecords.find(r => r.caseId === c.id) : null;

  const subtotal  = (c.sales || 0) + (c.fuel || 0) + (c.other || 0);
  const tax       = Math.round(subtotal * taxRateVal / 100);
  const total     = subtotal + tax;

  const detailRow = (name, qty, unit, amount) => `
    <tr>
      <td style="padding:9px 10px;border-bottom:1px solid #e5e7eb;font-size:12px">${name}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;font-family:'Inter',sans-serif">${qty}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;font-family:'Inter',sans-serif">¥${unit.toLocaleString()}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;font-family:'Inter',sans-serif;font-weight:600">¥${amount.toLocaleString()}</td>
    </tr>`;

  // 備考テキストを変数置換
  const remarksRaw = (fmt && fmt.remarks) || '';
  const remarksText = remarksRaw
    .replace(/\{\{支払期限\}\}/g, c.due)
    .replace(/\{\{顧客名\}\}/g, c.client)
    .replace(/\{\{請求金額\}\}/g, '¥'+total.toLocaleString())
    .split('\n').join('<br>');

  el.innerHTML = `
    <div style="max-width:720px;margin:0 auto">

      <!-- アクションバー -->
      <div style="display:flex;gap:8px;margin-bottom:14px;justify-content:flex-end;flex-wrap:wrap;align-items:center">
        <button class="btn btn-secondary btn-sm" onclick="printInvoice()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          印刷
        </button>
        <button class="btn btn-outline btn-sm" onclick="downloadInvoicePDF()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          PDFダウンロード
        </button>
        <button class="btn btn-secondary btn-sm">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          メール送信
        </button>
        ${isSaved
          ? `<button class="etax-save-btn saved" disabled>
               <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
               電帳法保存済
             </button>`
          : `<button class="etax-save-btn" onclick="etaxSaveOne('${c.id}')">
               <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
               電帳法保存
             </button>`}
      </div>

      ${isSaved && savedData ? `
      <div class="etax-info-bar" style="margin-bottom:12px">
        <div class="etax-info-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:700;color:#1d4ed8;margin-bottom:6px">✓ 電子帳簿保存法　電子取引データとして保存済み</div>
          <table class="etax-meta-table">
            <tr><td class="etax-meta-label">保存日時</td><td class="etax-meta-value">${savedData.savedAt}</td></tr>
            <tr><td class="etax-meta-label">保存者</td><td class="etax-meta-value">${savedData.savedBy}</td></tr>
            <tr><td class="etax-meta-label">整合性ハッシュ</td><td class="etax-meta-value etax-hash">${savedData.hash}</td></tr>
          </table>
        </div>
      </div>` : ''}

      <div id="invoice-print-area" style="background:#fff;border:1px solid #d1d5db;box-shadow:0 2px 16px rgba(0,0,0,.07);padding:40px 44px;font-size:13px;line-height:1.6;color:#111827">

        <!-- ① タイトル -->
        <div style="text-align:center;margin-bottom:28px">
          <div style="font-size:26px;font-weight:700;letter-spacing:.18em;color:#111827">請　求　書</div>
        </div>

        <!-- ② 発行情報（右寄せ） -->
        <div style="display:flex;justify-content:flex-end;margin-bottom:24px">
          <table style="font-size:12px;border-collapse:collapse;text-align:left">
            <tr><td style="color:#6b7280;padding:1px 12px 1px 0;white-space:nowrap">発行日</td><td style="font-weight:600;font-family:'Inter',sans-serif">${issueDate}</td></tr>
            <tr><td style="color:#6b7280;padding:1px 12px 1px 0;white-space:nowrap">請求書番号</td><td style="font-weight:700;color:${accentColor};font-family:'Inter',sans-serif" data-inv-no>${c.invoiceNo}</td></tr>
            <tr><td style="color:#6b7280;padding:1px 12px 1px 0;white-space:nowrap">支払期限</td><td style="font-weight:600;font-family:'Inter',sans-serif">${c.due}</td></tr>
          </table>
        </div>

        <!-- ③ 請求先＋発行者 -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;align-items:start">
          <div>
            <div style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:.1em;margin-bottom:6px">【請求先】</div>
            <div style="font-size:17px;font-weight:700;color:#111827;margin-bottom:4px">${c.client} 御中</div>
            <div style="font-size:11px;color:#6b7280;margin-top:8px;line-height:1.7">〒000-0000<br>東京都○○区△△1-2-3<br>TEL：03-XXXX-XXXX</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:.1em;margin-bottom:6px;text-align:right">【発行者】</div>
            <div style="font-size:14px;font-weight:700;color:${accentColor};margin-bottom:4px">東日本物流株式会社</div>
            <div style="font-size:11px;color:#6b7280;line-height:1.7">〒100-0001　東京都千代田区丸の内1-1-1<br>TEL：03-1234-5678　／　FAX：03-1234-5679<br>適格請求書発行事業者登録番号：T1234567890123</div>
          </div>
        </div>

        <!-- ④ ご請求金額 -->
        <div style="display:flex;justify-content:flex-end;margin-bottom:28px;border-bottom:1px solid #e5e7eb;padding-bottom:16px">
          <div style="text-align:right">
            <div style="font-size:11px;color:#6b7280;margin-bottom:4px">ご請求金額（税込）</div>
            <div style="font-size:28px;font-weight:800;font-family:'Inter',sans-serif;color:${accentColor};line-height:1">¥${total.toLocaleString()}</div>
          </div>
        </div>

        <!-- ⑤ 明細テーブル -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:4px">
          <thead>
            <tr style="background:${accentColor}">
              <th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:600;color:#fff;width:50%">品目</th>
              <th style="padding:9px 10px;text-align:center;font-size:11px;font-weight:600;color:#fff;width:10%">数量</th>
              <th style="padding:9px 10px;text-align:right;font-size:11px;font-weight:600;color:#fff;width:20%">単価</th>
              <th style="padding:9px 10px;text-align:right;font-size:11px;font-weight:600;color:#fff;width:20%">金額</th>
            </tr>
          </thead>
          <tbody>
            ${detailRow(`${c.from} → ${c.to}　運送費`, 1, c.sales, c.sales)}
            ${c.fuel  > 0 ? detailRow('燃料サーチャージ', 1, c.fuel,  c.fuel)  : ''}
            ${c.other > 0 ? detailRow('その他費用',       1, c.other, c.other) : ''}
          </tbody>
        </table>

        <!-- ⑥ 小計・税・合計 -->
        <div style="display:flex;justify-content:flex-end;margin-bottom:28px">
          <table style="border-collapse:collapse;width:260px;font-size:12px">
            <tr><td style="padding:5px 12px;color:#6b7280;border-bottom:1px solid #e5e7eb">小計</td><td style="padding:5px 12px;text-align:right;font-family:'Inter',sans-serif;border-bottom:1px solid #e5e7eb">¥${subtotal.toLocaleString()}</td></tr>
            ${taxRateVal > 0 ? `<tr><td style="padding:5px 12px;color:#6b7280;border-bottom:1px solid #e5e7eb">消費税（${taxRateVal}%）</td><td style="padding:5px 12px;text-align:right;font-family:'Inter',sans-serif;border-bottom:1px solid #e5e7eb">¥${tax.toLocaleString()}</td></tr>` : ''}
            <tr style="background:#f8fdfb">
              <td style="padding:8px 12px;font-weight:700;font-size:13px;color:${accentColor};border-top:2px solid ${accentColor}">合計（税込）</td>
              <td style="padding:8px 12px;text-align:right;font-weight:800;font-size:14px;font-family:'Inter',sans-serif;color:${accentColor};border-top:2px solid ${accentColor}">¥${total.toLocaleString()}</td>
            </tr>
          </table>
        </div>

        <!-- ⑦ 振込先＋備考 -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;border-top:1px solid #e5e7eb;padding-top:20px">
          <div>
            <div style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:.08em;margin-bottom:8px">【お振込先】</div>
            <div style="font-size:12px;line-height:1.9;color:#111827">○○銀行　△△支店<br>普通　1234567<br>口座名義：ヒガシニホンブツリュウ（カ</div>
            <div style="margin-top:10px;font-size:11px;color:#6b7280">※振込手数料はご負担ください。</div>
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:.08em;margin-bottom:8px">【備考】</div>
            <div style="font-size:12px;line-height:1.9;color:#374151">${remarksText || `お支払期限：${c.due}<br>案件ID：${c.id}<br>担当ドライバー：${c.driver||'—'}`}</div>
          </div>
        </div>

      </div><!-- /invoice-print-area -->
    </div>
  `;
}

// フォーマット手動変更
function onInvoiceFormatChange(fmtId) {
  var selEl = document.getElementById('inv-page-format-sel');
  if (selEl) selEl._manuallyChanged = true;
  var badgeEl = document.getElementById('inv-fmt-client-badge');
  if (badgeEl) badgeEl.style.display = 'none';
  // 現在表示中のプレビューを再描画
  if (typeof invoiceActiveId !== 'undefined' && invoiceActiveId) {
    var c = processedCases.find(function(x){ return x.id === invoiceActiveId; });
    if (c) renderInvoicePreview(c);
  }
}

function invoiceIssueSelected() {
  const n = invoiceSelectedIds.size;
  if (n === 0) {
    alert('請求書を発行する案件を選択してください。');
    return;
  }
  const names = [...invoiceSelectedIds].map(id => {
    const c = processedCases.find(x => x.id === id);
    return c ? c.client : id;
  }).join('、');
  alert(`✅ ${n}件の請求書を発行しました。\n\n対象：${names}`);
}

// ══════════════════════════════════════════
//  電子帳簿保存法　電子取引データ保存機能
// ══════════════════════════════════════════

// 保存済みIDセットとレコード配列（セッション内メモリ管理）
const etaxSavedIds = new Set();
const etaxRecords  = [];

// タブ切り替え
window.switchInvoiceTab = function(tab) {
  const listContent    = document.getElementById('etax-content-list');
  const archiveContent = document.getElementById('etax-content-archive');
  const tabList        = document.getElementById('etax-tab-list');
  const tabArchive     = document.getElementById('etax-tab-archive');
  const toolbar        = document.getElementById('inv-toolbar-normal');

  if (tab === 'list') {
    listContent.style.display    = 'flex';
    archiveContent.style.display = 'none';
    tabList.classList.add('active');
    tabArchive.classList.remove('active');
    if (toolbar) toolbar.style.display = 'flex';
  } else {
    listContent.style.display    = 'none';
    archiveContent.style.display = 'flex';
    archiveContent.style.flexDirection = 'column';
    tabList.classList.remove('active');
    tabArchive.classList.add('active');
    if (toolbar) toolbar.style.display = 'none';
    renderEtaxArchive();
  }
};

// ハッシュ生成（簡易擬似ハッシュ：本番はSHA-256を使用）
function generateEtaxHash(c) {
  const str = `${c.id}|${c.invoiceNo}|${c.invoiceDate}|${c.client}|${c.sales}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const hex = (Math.abs(hash) >>> 0).toString(16).padStart(8, '0');
  // 64文字のハッシュ風文字列を生成
  return (hex + hex + hex + hex + hex + hex + hex + hex).substring(0, 64);
}

// 現在日時フォーマット
function nowJST() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} `
       + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// 1件を電帳法保存
window.etaxSaveOne = function(caseId) {
  const c = processedCases.find(x => x.id === caseId);
  if (!c) return;
  if (etaxSavedIds.has(caseId)) {
    alert('この請求書はすでに電帳法保存済みです。');
    return;
  }

  // 保存実行（本番ではサーバーへPDF+メタデータをPOST）
  const record = {
    caseId   : c.id,
    invoiceNo: c.invoiceNo,
    client   : c.client,
    date     : c.invoiceDate,
    amount   : Math.round(c.sales * 1.1),
    savedAt  : nowJST(),
    savedBy  : '田中 花子（経理部）',
    hash     : generateEtaxHash(c),
    status   : 'saved',
  };
  etaxSavedIds.add(caseId);
  etaxRecords.unshift(record);
  updateEtaxBadgeCount();

  // プレビューを再描画（保存済み状態で）
  renderInvoicePreview(c);
  // リストも更新
  renderInvoiceList();

  // 成功通知
  showEtaxToast(`✓ ${c.client}（${c.invoiceNo}）を電帳法保存しました`);
};

// 複数件を一括保存
window.etaxSaveSelected = function() {
  const ids = [...invoiceSelectedIds];
  if (ids.length === 0) { alert('保存する案件を選択してください。'); return; }
  let saved = 0;
  ids.forEach(id => {
    if (!etaxSavedIds.has(id)) {
      const c = processedCases.find(x => x.id === id);
      if (c) {
        const record = {
          caseId   : c.id,
          invoiceNo: c.invoiceNo,
          client   : c.client,
          date     : c.invoiceDate,
          amount   : Math.round(c.sales * 1.1),
          savedAt  : nowJST(),
          savedBy  : '田中 花子（経理部）',
          hash     : generateEtaxHash(c),
          status   : 'saved',
        };
        etaxSavedIds.add(id);
        etaxRecords.unshift(record);
        saved++;
      }
    }
  });
  updateEtaxBadgeCount();
  renderInvoiceList();
  if (invoiceActiveId && etaxSavedIds.has(invoiceActiveId)) {
    const c = processedCases.find(x => x.id === invoiceActiveId);
    if (c) renderInvoicePreview(c);
  }
  showEtaxToast(`✓ ${saved}件を電帳法保存しました（既保存分はスキップ）`);
};

// バッジカウント更新
function updateEtaxBadgeCount() {
  const el = document.getElementById('etax-archive-count');
  if (el) el.textContent = etaxRecords.length;
}

// トースト通知
function showEtaxToast(msg) {
  let t = document.getElementById('etax-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'etax-toast';
    t.style.cssText = 'position:fixed;bottom:28px;right:28px;z-index:9999;'
      + 'background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:10px;'
      + 'font-size:13px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,.2);'
      + 'transition:opacity .3s;pointer-events:none;max-width:320px';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}

// 選択件数に応じて一括保存ボタンを表示
const _origUpdateInvSelCount = window.updateInvSelectedCount;
window.updateInvSelectedCount = function() {
  if (typeof _origUpdateInvSelCount === 'function') _origUpdateInvSelCount();
  const btn = document.getElementById('inv-etax-bulk-btn');
  if (btn) btn.style.display = invoiceSelectedIds.size > 0 ? 'inline-flex' : 'none';
};

// 保存管理アーカイブ一覧描画
window.renderEtaxArchive = function() {
  const listEl = document.getElementById('etax-archive-list');
  if (!listEl) return;

  const clientQ = (document.getElementById('etax-search-client')?.value || '').trim().toLowerCase();
  const monthQ  = document.getElementById('etax-search-month')?.value || '';
  const amtMin  = parseFloat(document.getElementById('etax-search-amtmin')?.value) || 0;
  const amtMax  = parseFloat(document.getElementById('etax-search-amtmax')?.value) || Infinity;

  const filtered = etaxRecords.filter(r => {
    if (clientQ && !r.client.toLowerCase().includes(clientQ)) return false;
    if (monthQ) {
      // monthQ = "YYYY-MM"
      const recMonth = (r.date || '').replace(/\//g, '-').slice(0, 7);
      if (recMonth !== monthQ) return false;
    }
    if (r.amount < amtMin || r.amount > amtMax) return false;
    return true;
  });

  const cntEl = document.getElementById('etax-result-count');
  if (cntEl) cntEl.textContent = `${filtered.length} 件表示`;

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state" style="padding-top:60px">
      <div class="empty-state-icon">🗄️</div>
      <div style="font-size:14px;color:var(--text-secondary)">${etaxRecords.length === 0 ? '電帳法保存された請求書はありません' : '検索条件に一致するレコードがありません'}</div>
    </div>`;
    return;
  }

  listEl.innerHTML = filtered.map(r => `
    <div class="etax-archive-row" onclick="etaxShowDetail('${r.caseId}')">
      <div>
        <div style="font-weight:600;font-size:12px">${r.client}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${r.savedBy}</div>
      </div>
      <div>
        <div style="font-size:12px;font-family:'Inter',sans-serif;font-weight:600;color:#1d4ed8">${r.invoiceNo}</div>
      </div>
      <div>
        <div style="font-size:12px">${r.date || '-'}</div>
        <div style="font-size:10px;color:var(--text-muted)">保存：${r.savedAt}</div>
      </div>
      <div style="text-align:right;font-family:'Inter',sans-serif;font-weight:700;font-size:13px;color:#111827">
        ¥${r.amount.toLocaleString()}
      </div>
      <div style="text-align:center;display:flex;gap:6px;justify-content:center">
        <span class="etax-badge saved">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
          保存済
        </span>
        <button class="btn btn-outline btn-sm" style="font-size:10px;padding:3px 8px" onclick="event.stopPropagation();etaxShowDetail('${r.caseId}')">詳細</button>
      </div>
    </div>
  `).join('');
};

// 詳細表示（保存管理 → 請求書プレビューへ遷移）
window.etaxShowDetail = function(caseId) {
  switchInvoiceTab('list');
  invoiceActiveId = caseId;
  const monthSel = document.getElementById('inv-month-filter');
  if (monthSel) monthSel.value = '';
  const statusSel = document.getElementById('inv-status-filter');
  if (statusSel) statusSel.value = '';
  renderInvoiceList();
  const c = processedCases.find(x => x.id === caseId);
  if (c) setTimeout(() => renderInvoicePreview(c), 50);
};

// 検索クリア
window.etaxClearSearch = function() {
  ['etax-search-client','etax-search-month','etax-search-amtmin','etax-search-amtmax']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderEtaxArchive();
};

// 処理済み詳細「請求書を表示」→ 請求管理ページへ遷移してプレビュー表示
function openInvoicePreview(caseId) {
  // 請求管理のアクティブIDをセット
  invoiceActiveId = caseId;

  // サイドバーの「請求管理」ナビを探してクリック相当の処理
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-invoice');
  if (page) page.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes("'invoice'")) {
      n.classList.add('active');
    }
  });

  // 月フィルターを動的再生成して「すべて」にリセット
  const monthSel = document.getElementById('inv-month-filter');
  if (monthSel) {
    const months = [...new Set(processedCases.map(c => c.invoiceDate ? c.invoiceDate.slice(0,7) : ''))].filter(Boolean).sort().reverse();
    monthSel.innerHTML = '<option value="">請求月：すべて</option>'
      + months.map(m => {
          const [y, mo] = m.split('/');
          return `<option value="${m}">${y}年${parseInt(mo)}月</option>`;
        }).join('');
    monthSel.value = '';
  }
  const statusSel = document.getElementById('inv-status-filter');
  if (statusSel) statusSel.value = '';

  // スプリッター初期化
  if (typeof makeSplitter === 'function') makeSplitter('splitter-invoice', 220, 620);

  // リスト描画（対象行がアクティブ表示される）
  renderInvoiceList();

  // プレビューを表示
  const c = processedCases.find(x => x.id === caseId);
  if (c) {
    setTimeout(() => {
      renderInvoicePreview(c);
      // 対象行が見えるようスクロール
      const row = document.getElementById('invrow-' + caseId);
      if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 30);
  }
}

// 印刷：請求書エリアのみ印刷
function printInvoice() {
  const area = document.getElementById('invoice-print-area');
  if (!area) { alert('請求書が表示されていません。'); return; }
  window.print();
}

// PDFダウンロード：請求書エリアをキャプチャしてPDF生成
async function downloadInvoicePDF() {
  const area = document.getElementById('invoice-print-area');
  if (!area) { alert('請求書が表示されていません。'); return; }

  // ボタンの表示状態を一時退避
  const btn = event?.currentTarget;
  const origText = btn ? btn.innerHTML : '';
  if (btn) btn.innerHTML = '⏳ 生成中...';

  try {
    const canvas = await html2canvas(area, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height / canvas.width) * imgW;

    const imgData = canvas.toDataURL('image/png');

    if (imgH <= pageH) {
      pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH);
    } else {
      // 複数ページに分割
      let yOffset = 0;
      while (yOffset < imgH) {
        if (yOffset > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -yOffset, imgW, imgH);
        yOffset += pageH;
      }
    }

    // ファイル名：請求書番号を取得
    const invNoEl = document.querySelector('#invoice-print-area [data-inv-no]');
    const c = invoiceActiveId ? processedCases.find(x => x.id === invoiceActiveId) : null;
    const filename = c ? `請求書_${c.invoiceNo}.pdf` : '請求書.pdf';
    pdf.save(filename);
    showToast('PDFをダウンロードしました', 'success');
  } catch(e) {
    console.error(e);
    alert('PDF生成に失敗しました: ' + e.message);
  } finally {
    if (btn) btn.innerHTML = origText;
  }
}

// 処理済み画面から発注書PDFを再ダウンロード
function redownloadPurchaseOrderPDF(i) {
  const c = processedCases[i];
  if (!c || !c.purchaseOrderNo) { showToast('発注書データが見つかりません', 'error'); return; }

  // 案件データから印刷エリアを再構築して _downloadPurchaseOrderPDF を呼ぶ
  const area = document.getElementById('po-print-area');
  if (!area) { showToast('印刷エリアが初期化されていません', 'error'); return; }

  const poNum    = c.purchaseOrderNo;
  const issuedAt = c.purchaseOrderIssuedAt || '—';
  const total    = c.purchaseOrderTotal ? '¥' + c.purchaseOrderTotal.toLocaleString() : '—';
  const subtotalVal = c.purchaseOrderTotal ? Math.round(c.purchaseOrderTotal / 1.1) : 0;
  const taxVal      = c.purchaseOrderTotal ? c.purchaseOrderTotal - subtotalVal : 0;
  const now = new Date().toLocaleString('ja-JP');

  area.innerHTML = `
    <div style="border-bottom:3px solid #0D4A3A;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <div style="font-size:22px;font-weight:700;color:#0D4A3A;letter-spacing:0.05em">発 注 書</div>
        <div style="font-size:11px;color:#6b7280;margin-top:4px">Purchase Order</div>
      </div>
      <div style="text-align:right;font-size:12px;color:#374151">
        <div><b>発注書番号：</b>${poNum}</div>
        <div style="font-size:10px;color:#9ca3af;margin-top:2px">交付日時：${issuedAt}</div>
        <div style="font-size:10px;color:#9ca3af">再ダウンロード：${now}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
      <div style="border:1px solid #e5e7eb;border-radius:6px;padding:12px">
        <div style="font-size:10px;color:#9ca3af;margin-bottom:4px">発注先</div>
        <div style="font-size:13px;font-weight:700">${c.partnerName}</div>
      </div>
      <div style="border:1px solid #e5e7eb;border-radius:6px;padding:12px">
        <div style="font-size:10px;color:#9ca3af;margin-bottom:4px">発注元</div>
        <div style="font-size:13px;font-weight:700">東日本物流株式会社</div>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px">
      <tr style="background:#f8fafc"><td style="padding:7px 10px;border:1px solid #e5e7eb;font-weight:600;width:30%">輸送区間</td><td style="padding:7px 10px;border:1px solid #e5e7eb">${c.purchaseOrderRoute||c.from+' → '+c.to}</td></tr>
      <tr><td style="padding:7px 10px;border:1px solid #e5e7eb;font-weight:600;background:#f8fafc">荷物</td><td style="padding:7px 10px;border:1px solid #e5e7eb">${c.purchaseOrderGoods||c.goods||'—'}</td></tr>
      <tr style="background:#f8fafc"><td style="padding:7px 10px;border:1px solid #e5e7eb;font-weight:600">受領方法・納品場所</td><td style="padding:7px 10px;border:1px solid #e5e7eb">${c.purchaseOrderReceipt||'—'}</td></tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:12px">
      <thead><tr style="background:#0D4A3A;color:#fff">
        <th style="padding:7px 10px;text-align:left;font-weight:600;width:50%">項目</th>
        <th style="padding:7px 10px;text-align:right;font-weight:600">金額（税抜）</th>
      </tr></thead>
      <tbody>
        <tr><td style="padding:7px 10px;border:1px solid #e5e7eb">輸送費</td><td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:right">¥${subtotalVal.toLocaleString()}</td></tr>
        <tr style="background:#f8fafc"><td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:right;color:#6b7280">小計</td><td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:right">¥${subtotalVal.toLocaleString()}</td></tr>
        <tr><td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:right;color:#6b7280">消費税（10%）</td><td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:right">¥${taxVal.toLocaleString()}</td></tr>
        <tr style="background:#EAF5F0"><td style="padding:9px 10px;border:2px solid #0D4A3A;text-align:right;font-weight:700;color:#0D4A3A">合計（税込）</td><td style="padding:9px 10px;border:2px solid #0D4A3A;text-align:right;font-weight:700;font-size:15px;color:#0D4A3A">${total}</td></tr>
      </tbody>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px">
      <tr style="background:#f8fafc"><td style="padding:7px 10px;border:1px solid #e5e7eb;font-weight:600;width:30%">支払方法</td><td style="padding:7px 10px;border:1px solid #e5e7eb">${c.purchaseOrderMethod||'—'}</td></tr>
      <tr><td style="padding:7px 10px;border:1px solid #e5e7eb;font-weight:600;background:#f8fafc">支払期日</td><td style="padding:7px 10px;border:1px solid #e5e7eb">${c.purchaseOrderPayDue||'—'}</td></tr>
    </table>

    <div style="border-top:1px solid #e5e7eb;padding-top:12px;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between">
      <span>本書は下請法第3条に基づく発注書面です。</span>
      <span>発行：東日本物流株式会社</span>
    </div>
  `;

  html2canvas(area, { scale:2, useCORS:true, backgroundColor:'#ffffff', logging:false })
    .then(canvas => {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW  = pageW;
      const imgH  = (canvas.height / canvas.width) * imgW;
      const imgData = canvas.toDataURL('image/png');
      if (imgH <= pageH) {
        pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH);
      } else {
        let yOffset = 0;
        while (yOffset < imgH) {
          if (yOffset > 0) pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, -yOffset, imgW, imgH);
          yOffset += pageH;
        }
      }
      pdf.save('発注書_' + poNum + '.pdf');
      showToast('発注書PDFをダウンロードしました', 'success');
    })
    .catch(e => { showToast('PDF生成エラー: ' + e.message, 'error'); });
}

// 処理済み移動時に請求管理ページへ連動させる
function syncInvoicePage(newCaseId) {
  invoiceActiveId = newCaseId || null;

  // 月フィルターを最新データで再生成
  const monthSel = document.getElementById('inv-month-filter');
  if (monthSel) {
    const months = [...new Set(processedCases.map(c => c.invoiceDate ? c.invoiceDate.slice(0,7) : ''))].filter(Boolean).sort().reverse();
    monthSel.innerHTML = '<option value="">請求月：すべて</option>'
      + months.map(m => {
          const [y, mo] = m.split('/');
          return `<option value="${m}">${y}年${parseInt(mo)}月</option>`;
        }).join('');
    monthSel.value = ''; // 必ず「すべて」にリセット
  }

  // 請求管理ページが表示中なら即リスト＋プレビュー更新
  const invPage = document.getElementById('page-invoice');
  if (invPage && invPage.classList.contains('active')) {
    renderInvoiceList();
    const c = processedCases.find(x => x.id === newCaseId);
    if (c) renderInvoicePreview(c);
  } else {
    // 非表示中でもリストDOMだけ更新しておく
    renderInvoiceList();
    showToast('請求管理に新しい案件が追加されました。', 'info');
  }
}

// ─── 状態 ────────────────────────────────────────────────────────
let _guideStep=0, _guideActive=false;

// ─── 外部API ─────────────────────────────────────────────────────
function startGuide(){ document.getElementById('guide-welcome').classList.add('active'); }
function closeGuideWelcome(){ document.getElementById('guide-welcome').classList.remove('active'); }
function beginGuide(){
  closeGuideWelcome();
  _guideActive=true; _guideStep=0;
  document.getElementById('guide-backdrop').classList.add('active');
  _runStep(0);
}
function skipGuide(){ _endGuide(); }
function guideNext(){
  if(_guideStep < GUIDE_STEPS.length-1){ _guideStep++; _runStep(_guideStep); }
  else{ _endGuide(); document.getElementById('guide-complete').classList.add('active'); }
}
function guidePrev(){
  if(_guideStep > 0){ _guideStep--; _runStep(_guideStep); }
}
function closeGuideComplete(){ document.getElementById('guide-complete').classList.remove('active'); }

function _endGuide(){
  _guideActive=false;
  guideCloseAllModals();
  // ガイド専用エリアを非表示に戻す
  const area = document.getElementById('confirm-law-ok');
  if(area) area.style.display = 'none';
  document.getElementById('guide-backdrop').classList.remove('active');
  const b=document.getElementById('guide-bubble');
  b.style.cssText='display:none'; b.className='';
  document.getElementById('guide-ring').style.display='none';
}

// ─── ステップ実行 ─────────────────────────────────────────────────
function _runStep(index){
  const step=GUIDE_STEPS[index];
  // 非表示
  const bubble=document.getElementById('guide-bubble');
  bubble.style.cssText='display:none'; bubble.className='';
  document.getElementById('guide-ring').style.display='none';
  // テキスト更新
  document.getElementById('guide-badge').textContent = step.badge;
  document.getElementById('guide-emoji').textContent = step.emoji||'';
  document.getElementById('guide-title').textContent = step.title;
  document.getElementById('guide-body').innerHTML    = step.body;
  document.getElementById('guide-prev-btn').style.display = index===0?'none':'';
  const nb=document.getElementById('guide-next-btn');
  nb.innerHTML = index===GUIDE_STEPS.length-1
    ? `完了 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
    : `次へ <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
  document.getElementById('guide-progress').innerHTML=GUIDE_STEPS
    .map((_,i)=>`<div class="guide-dot ${i<index?'done':i===index?'active':''}"></div>`).join('');
  // 画面遷移→DOM確定→配置
  step.prepare(() => guideRAF(4, () => _placeGuide(step)));
}

// ─── 位置決め ─────────────────────────────────────────────────────
function _placeGuide(step){
  const bubble=document.getElementById('guide-bubble');
  const ring=document.getElementById('guide-ring');
  const BW=360, PAD=14, GAP=12, RM=6;
  const VW=window.innerWidth, VH=window.innerHeight;

  // ターゲット
  const target = typeof step.targetFn==='function' ? step.targetFn() : null;

  // 吹き出し高さを実測（visibility:hidden で配置）
  bubble.style.cssText=`display:block;width:${BW}px;visibility:hidden;left:0;top:0;`;
  const BH=bubble.offsetHeight||220;

  // ターゲット矩形
  let tr = target ? target.getBoundingClientRect() : null;
  // 画面外ならスクロールして再取得
  if(tr && (tr.bottom<0 || tr.top>VH)){
    target.scrollIntoView({block:'center',behavior:'instant'});
    tr=target.getBoundingClientRect();
  }

  // リング
  ring.style.display='none';
  if(tr && tr.width>0){
    ring.style.cssText=`display:block;left:${tr.left-RM}px;top:${tr.top-RM}px;`
      +`width:${tr.width+RM*2}px;height:${tr.height+RM*2}px;border-radius:10px;`;
  }

  // 吹き出し位置
  let bx,by,arrowCls='',aw=24;
  if(tr && tr.width>0){
    const cx=tr.left+tr.width/2, cy=tr.top+tr.height/2;
    const sp={
      above: tr.top-RM-GAP-PAD,
      below: VH-tr.bottom-RM-GAP-PAD,
      left : tr.left-RM-GAP-PAD,
      right: VW-tr.right-RM-GAP-PAD,
    };
    const fits={ above:sp.above>=BH, below:sp.below>=BH, left:sp.left>=BW, right:sp.right>=BW };
    let dir=step.arrowDir||'auto';
    if(dir==='auto'||!fits[dir]){
      dir=Object.entries(sp).sort((a,b)=>b[1]-a[1])[0][0];
    }
    if(dir==='above'){
      by=tr.top-RM-GAP-BH; bx=clamp(cx-BW/2,PAD,VW-BW-PAD);
      arrowCls='arrow-bottom'; aw=clamp(cx-bx-6,16,BW-28);
    } else if(dir==='below'){
      by=tr.bottom+RM+GAP; bx=clamp(cx-BW/2,PAD,VW-BW-PAD);
      arrowCls='arrow-top'; aw=clamp(cx-bx-6,16,BW-28);
    } else if(dir==='left'){
      bx=tr.left-RM-GAP-BW; by=clamp(cy-BH/2,PAD,VH-BH-PAD);
      arrowCls='arrow-right'; aw=clamp(cy-by-6,16,BH-28);
    } else {
      bx=tr.right+RM+GAP; by=clamp(cy-BH/2,PAD,VH-BH-PAD);
      arrowCls='arrow-left'; aw=clamp(cy-by-6,16,BH-28);
    }
  } else {
    bx=clamp((VW-BW)/2,PAD,VW-BW-PAD);
    by=VH-BH-PAD-8;
  }
  bx=clamp(bx,PAD,VW-BW-PAD);
  by=clamp(by,PAD,VH-BH-PAD);

  bubble.className=arrowCls;
  bubble.style.cssText=`display:block;width:${BW}px;left:${bx}px;top:${by}px;`;
  bubble.style.setProperty('--aw', aw+'px');
}

function clamp(v,lo,hi){ return Math.max(lo,Math.min(v,hi)); }