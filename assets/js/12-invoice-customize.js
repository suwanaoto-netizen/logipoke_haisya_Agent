// ── 請求書カスタマイズ グローバル関数 ──
window.invSwitchTab = function(btn, panelId) {
  document.querySelectorAll('.inv-tab').forEach(function(t){ t.classList.remove('active'); });
  document.querySelectorAll('.inv-tab-panel').forEach(function(p){ p.classList.remove('active'); });
  btn.classList.add('active');
  var panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');
};

// ── テンプレート選択 → 右プレビュー即時反映 ──
window.invSelectTpl = function(card) {
  card.closest('.inv-template-grid').querySelectorAll('.inv-template-card').forEach(function(c){ c.classList.remove('selected'); });
  card.classList.add('selected');
  var tpl = card.querySelector('.inv-tpl-name') ? card.querySelector('.inv-tpl-name').textContent.trim() : '';
  var fp = document.getElementById('inv-full-preview');
  if (!fp) return;
  if (tpl === 'コンパクト') {
    fp.style.padding = '40px 48px';
    fp.style.background = '#fff';
    document.getElementById('fp-title') && (document.getElementById('fp-title').style.fontSize = '24px');
  } else if (tpl === 'モダン') {
    fp.style.padding = '48px 56px';
    fp.style.background = '#f9fffe';
    document.getElementById('fp-title') && (document.getElementById('fp-title').style.fontSize = '28px');
  } else {
    fp.style.padding = '60px 64px';
    fp.style.background = '#fff';
    document.getElementById('fp-title') && (document.getElementById('fp-title').style.fontSize = '32px');
  }
};

// ── ロゴ配置 → 右プレビュー即時反映 ──
window.invSetAlign = function(btn) {
  btn.closest('div').querySelectorAll('.inv-template-card').forEach(function(b){ b.classList.remove('selected'); });
  btn.classList.add('selected');
  var label = btn.textContent.trim();
  var hdr = document.getElementById('fp-header-row');
  var logoBlock = document.getElementById('fp-logo-block');
  var infoBlock = document.getElementById('fp-info-block');
  if (!hdr) return;
  if (label.indexOf('中央') > -1) {
    hdr.style.flexDirection = 'column';
    hdr.style.alignItems = 'center';
    if (logoBlock) { logoBlock.style.textAlign = 'center'; logoBlock.style.marginBottom = '12px'; }
    if (infoBlock) infoBlock.style.textAlign = 'center';
  } else if (label.indexOf('右') > -1) {
    hdr.style.flexDirection = 'row-reverse';
    hdr.style.alignItems = 'flex-start';
    if (logoBlock) { logoBlock.style.textAlign = 'right'; logoBlock.style.marginBottom = '0'; }
    if (infoBlock) infoBlock.style.textAlign = 'left';
  } else {
    hdr.style.flexDirection = 'row';
    hdr.style.alignItems = 'flex-start';
    if (logoBlock) { logoBlock.style.textAlign = 'left'; logoBlock.style.marginBottom = '0'; }
    if (infoBlock) infoBlock.style.textAlign = 'right';
  }
};

// ── カラー変更 → 右プレビュー即時反映 ──
window.invPickColor = function(swatch, color, fromInput) {
  if (!fromInput) {
    document.querySelectorAll('.inv-color-swatch').forEach(function(s){ s.classList.remove('selected'); });
    if (swatch) swatch.classList.add('selected');
  }
  // テーブルヘッダー背景
  var thead = document.getElementById('fp-table-head');
  if (thead) thead.style.background = color;
  // 合計行の文字色・上ボーダー色
  var totalRow = document.getElementById('fp-total-row');
  if (totalRow) {
    totalRow.querySelectorAll('td').forEach(function(td) {
      td.style.color = color;
      td.style.borderTopColor = color;
    });
  }
  // 請求金額テキスト色
  var amt = document.getElementById('fp-amount-box');
  if (amt) amt.style.color = color;
  // 請求書番号色
  var invNo = document.getElementById('fp-inv-no-val');
  if (invNo) invNo.style.color = color;
  // 発行者会社名色
  var co = document.getElementById('fp-field-company');
  if (co) co.style.color = color;
  // ロゴバー背景
  var logoInner = document.querySelector('#fp-logo-bar div');
  if (logoInner) logoInner.style.background = color;
};

// ── 表示項目トグル → 右プレビュー即時反映 ──
window.invToggleField = function(btn) {
  var key = btn.getAttribute('data-fkey');
  var on = btn.classList.contains('on');
  var el = document.getElementById('fp-field-' + key);
  if (el) el.style.display = on ? '' : 'none';
};

// ── カスタム列追加 ──
window.invAddCustomCol = function() {
  // 既存モーダルがあれば削除
  var old = document.getElementById('inv-col-modal');
  if (old) old.remove();

  var modal = document.createElement('div');
  modal.id = 'inv-col-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45)';
  modal.innerHTML =
    '<div style="background:#fff;border-radius:14px;padding:28px 28px 24px;width:340px;box-shadow:0 8px 40px rgba(0,0,0,.2)">'
    +'<div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:18px;display:flex;align-items:center;gap:8px">'
    +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--sidebar-bg)" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
    +'カスタム列を追加</div>'
    +'<div style="margin-bottom:14px">'
    +'<label style="font-size:11px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:5px">列名</label>'
    +'<input id="inv-col-name" class="settings-form-input" placeholder="例：備考、荷物番号 など" style="font-size:13px">'
    +'</div>'
    +'<div style="margin-bottom:14px">'
    +'<label style="font-size:11px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:5px">サンプル値（プレビュー表示用）</label>'
    +'<input id="inv-col-sample" class="settings-form-input" placeholder="例：要冷蔵" style="font-size:13px">'
    +'</div>'
    +'<div style="margin-bottom:20px">'
    +'<label style="font-size:11px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:5px">列幅（%）</label>'
    +'<input id="inv-col-w" class="settings-form-input" type="number" value="15" min="5" max="50" style="font-size:13px">'
    +'</div>'
    +'<div style="display:flex;gap:8px;justify-content:flex-end">'
    +'<button onclick="document.getElementById(\'inv-col-modal\').remove()" class="btn btn-secondary btn-sm">キャンセル</button>'
    +'<button onclick="invConfirmAddCol()" class="btn btn-primary btn-sm">'
    +'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
    +'追加する</button>'
    +'</div>'
    +'</div>';
  document.body.appendChild(modal);
  setTimeout(function(){ var el = document.getElementById('inv-col-name'); if(el) el.focus(); }, 50);
};

window.invConfirmAddCol = function() {
  var name   = (document.getElementById('inv-col-name').value || '').trim();
  var sample = (document.getElementById('inv-col-sample').value || '—').trim();
  var w      = parseInt(document.getElementById('inv-col-w').value) || 15;
  if (!name) {
    document.getElementById('inv-col-name').style.borderColor = '#dc2626';
    document.getElementById('inv-col-name').focus();
    return;
  }
  var key = 'custom_' + Date.now();
  document.getElementById('inv-col-modal').remove();

  // ── 左ペイン：列リストに行追加 ──
  var list = document.getElementById('inv-col-list-wrap');
  if (list) {
    var row = document.createElement('div');
    row.className = 'inv-col-item';
    row.setAttribute('data-col', key);
    row.style.cssText = 'display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:#fafafa;cursor:grab';
    row.innerHTML =
      '<span class="inv-col-drag">⠿</span>'
      +'<span class="inv-col-label" style="flex:1;font-size:12px;font-weight:600;color:var(--text-primary)">✏️ '+name+'</span>'
      +'<input class="inv-col-width" type="number" value="'+w+'" min="5" max="80"'
      +' style="width:56px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:11px;text-align:center;background:#fff"'
      +' oninput="invUpdateColTotal();invSyncColWidth(\''+key+'\',this.value)">'
      +'<span style="font-size:10px;color:var(--text-muted)">%</span>'
      +'<button class="inv-field-toggle on inv-col-vis"'
      +' onclick="this.classList.toggle(\'on\');this.classList.toggle(\'off\');'
      +'this.closest(\'.inv-col-item\').style.opacity=this.classList.contains(\'on\')?1:.6;'
      +'invUpdateColTotal();invSyncColVis(\''+key+'\',this.classList.contains(\'on\'))"></button>'
      +'<button title="削除" onclick="invDeleteCol(this,\''+key+'\')" '
      +'style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:14px;padding:0 2px;flex-shrink:0">✕</button>';
    list.appendChild(row);
    invUpdateColTotal();
  }

  // ── 右プレビュー：<th> 追加 ──
  var thead = document.querySelector('#fp-table-head');
  if (thead) {
    var th = document.createElement('th');
    th.setAttribute('data-col', key);
    th.style.cssText = 'color:#fff;font-weight:700;padding:8px 10px;text-align:left;width:'+w+'%';
    th.textContent = name;
    thead.appendChild(th);
  }

  // ── 右プレビュー：各 <tr> に <td> 追加 ──
  var rows = document.querySelectorAll('#fp-tbody tr');
  rows.forEach(function(tr){
    var td = document.createElement('td');
    td.setAttribute('data-col', key);
    td.style.cssText = 'padding:8px 10px;width:'+w+'%';
    td.textContent = sample;
    tr.appendChild(td);
  });
};

// ── カスタム列削除 ──
window.invDeleteCol = function(btn, key) {
  // 左ペインから削除
  var row = btn.closest('.inv-col-item');
  if (row) row.remove();
  invUpdateColTotal();
  // 右プレビューから削除
  var th = document.querySelector('#fp-table-head th[data-col="'+key+'"]');
  if (th) th.remove();
  document.querySelectorAll('#fp-tbody td[data-col="'+key+'"]').forEach(function(td){ td.remove(); });
};

// ── 備考タブ → 右プレビュー即時反映 ──
window.invSyncRemarks = function() {
  var ta  = document.getElementById('inv-remarks-text');
  var el  = document.getElementById('fp-remarks-preview');
  if (!ta || !el) return;

  // {{変数}} を実際の値に置換
  var due = (document.getElementById('fp-remarks-due') || {}).textContent || '2026/05/31';
  var text = ta.value
    .replace(/\{\{支払期限\}\}/g, due)
    .replace(/\{\{顧客名\}\}/g, '株式会社サンプル荷主')
    .replace(/\{\{請求金額\}\}/g, '¥140,470');

  // 既存の子要素（early-discount など）を保持しつつテキストを更新
  // テキストノードのみ置換、子要素は残す
  var discountEl = document.getElementById('fp-early-discount');
  // いったんテキスト部分だけHTMLエスケープして改行をそのまま表示（white-space:pre-wrap利用）
  el.textContent = text;
  // fp-early-discount を再追加
  if (discountEl) el.appendChild(discountEl);
};

window.invInsertTemplate = function(key) {
  var dataEl = document.getElementById('inv-tpls-data');
  var tpl = dataEl ? (dataEl.getAttribute('data-' + key) || '') : '';
  if (!tpl) return;
  // \n をリアル改行に戻す
  tpl = tpl.replace(/\\n/g, '\n');
  var ta = document.getElementById('inv-remarks-text');
  if (!ta) return;
  var cur = ta.value.trim();
  ta.value = cur ? cur + '\n' + tpl : tpl;
  invSyncRemarks();
  ta.scrollTop = ta.scrollHeight;
};

// ── 番号・税タブ ──
window.invSyncNumberTab = function() {
  // 請求書番号生成例 + プレビュー反映
  var prefix  = (document.getElementById('inv-num-prefix') || {}).value || 'INV';
  var dateEl  = document.getElementById('inv-num-date');
  var dateFmt = dateEl ? dateEl.options[dateEl.selectedIndex].text : 'YYYYMM';
  var digEl   = document.getElementById('inv-num-digits');
  var digits  = digEl ? parseInt(digEl.options[digEl.selectedIndex].text) : 5;
  var now     = new Date();
  var datePart = dateFmt === 'YYYYMM' ? (now.getFullYear() + String(now.getMonth()+1).padStart(2,'0'))
               : dateFmt === 'YYYY'   ? String(now.getFullYear())
               : null;
  var seq       = String(1).padStart(digits, '0');
  var parts     = [prefix]; if (datePart) parts.push(datePart); parts.push(seq);
  var generated = parts.join('-');
  var prevEl = document.getElementById('inv-num-preview');
  if (prevEl) prevEl.textContent = generated;
  var fpNo = document.getElementById('fp-inv-no-val');
  if (fpNo) fpNo.textContent = generated;

  // インボイス登録番号
  var regNo   = (document.getElementById('inv-reg-no') || {}).value || '';
  var invTog  = document.getElementById('inv-toggle-invoice');
  var fpInvNo = document.getElementById('fp-field-invoice_no');
  if (fpInvNo) {
    if (invTog && invTog.classList.contains('on') && regNo.trim()) {
      fpInvNo.textContent = '適格請求書発行事業者登録番号：' + regNo.trim();
      fpInvNo.style.display = '';
    } else {
      fpInvNo.style.display = 'none';
    }
  }

  // 消費税率 再計算
  var taxRateEl = document.getElementById('inv-tax-rate');
  var taxRate   = taxRateEl ? parseInt(taxRateEl.value) : 10;
  var subtotal  = 127500;
  var tax       = Math.round(subtotal * taxRate / 100);
  var total     = subtotal + tax;
  var taxRow    = document.getElementById('fp-tax-row');
  var taxLabel  = document.getElementById('fp-tax-label');
  var taxVal    = document.getElementById('fp-tax-val');
  var totalVal  = document.getElementById('fp-total-val');
  var amtBox    = document.getElementById('fp-amount-box');
  if (taxRate === 0) {
    if (taxRow)   taxRow.style.display = 'none';
    if (totalVal) totalVal.textContent = '¥' + subtotal.toLocaleString();
    if (amtBox)   amtBox.textContent   = '¥' + subtotal.toLocaleString();
  } else {
    if (taxRow)   taxRow.style.display = '';
    if (taxLabel) taxLabel.textContent = '消費税（' + taxRate + '%）';
    if (taxVal)   taxVal.textContent   = '¥' + tax.toLocaleString();
    if (totalVal) totalVal.textContent = '¥' + total.toLocaleString();
    if (amtBox)   amtBox.textContent   = '¥' + total.toLocaleString();
  }

  // 支払期限ルール
  var dueRule = document.getElementById('inv-due-rule');
  var base    = new Date('2026/05/06');
  var dueDate;
  if (dueRule) {
    var v = dueRule.value;
    if      (v === '30')  { dueDate = new Date(base.getFullYear(), base.getMonth()+2, 0); }
    else if (v === '60')  { dueDate = new Date(base.getFullYear(), base.getMonth()+3, 0); }
    else if (v === '30d') { dueDate = new Date(base.getTime() + 30*86400000); }
    else if (v === '60d') { dueDate = new Date(base.getTime() + 60*86400000); }
    else                  { dueDate = new Date(base.getFullYear(), base.getMonth()+3, 0); }
  } else {
    dueDate = new Date(base.getFullYear(), base.getMonth()+3, 0);
  }
  var dueText = dueDate.getFullYear() + '/'
    + String(dueDate.getMonth()+1).padStart(2,'0') + '/'
    + String(dueDate.getDate()).padStart(2,'0');
  var fpDue = document.getElementById('fp-due-val');
  if (fpDue) fpDue.textContent = dueText;
  var fpRDue = document.getElementById('fp-remarks-due');
  if (fpRDue) fpRDue.textContent = dueText;

  // 早期支払い割引
  var discTog = document.getElementById('inv-toggle-discount');
  var discEl  = document.getElementById('fp-early-discount');
  if (discEl) discEl.style.display = (discTog && discTog.classList.contains('on')) ? '' : 'none';

  // 振込手数料
  var feeTog = document.getElementById('inv-toggle-bankfee');
  var feeEl  = document.getElementById('fp-bank-charge-note');
  if (feeEl) feeEl.style.display = (feeTog && feeTog.classList.contains('on')) ? '' : 'none';

  // 備考プレビューも再同期（支払期限変更を反映）
  if (window.invSyncRemarks) window.invSyncRemarks();
};

window.invUpdateColTotal = function() {
  var total = 0;
  document.querySelectorAll('.inv-col-width').forEach(function(inp){
    var row = inp.closest('.inv-col-item');
    var vis = row.querySelector('.inv-col-vis');
    if (vis && vis.classList.contains('on')) total += parseInt(inp.value)||0;
  });
  var el = document.getElementById('invColTotal');
  if (el) {
    el.textContent = total;
    el.style.color = Math.abs(total-100) <= 5 ? 'var(--sidebar-bg)' : '#dc2626';
  }
};

// ── 列幅変更 → 右プレビュー即反映 ──
window.invSyncColWidth = function(key, val) {
  var th = document.querySelector('#fp-table-head th[data-col="'+key+'"]');
  var tds = document.querySelectorAll('#fp-tbody td[data-col="'+key+'"]');
  var w = (parseInt(val)||10) + '%';
  if (th) th.style.width = w;
  tds.forEach(function(td){ td.style.width = w; });
};

// ── 列表示切替 → 右プレビュー即反映 ──
window.invSyncColVis = function(key, visible) {
  var th = document.querySelector('#fp-table-head th[data-col="'+key+'"]');
  var tds = document.querySelectorAll('#fp-tbody td[data-col="'+key+'"]');
  var d = visible ? '' : 'none';
  if (th) th.style.display = d;
  tds.forEach(function(td){ td.style.display = d; });
};

var _settingsPanelContents = {
  invoice: {
    color: 'linear-gradient(135deg,#0D4A3A 0%,#1a6b52 100%)',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6DD5A8" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    title: '請求書出力カスタマイズ',
    body: function(){
      // CSS初期化（一度だけ）
      if (!document.getElementById('inv-style')) {
        var st = document.createElement('style');
        st.id = 'inv-style';
        st.textContent = '.inv-tabs{display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px}'
          +'.inv-tab{padding:9px 16px;font-size:12px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;color:var(--text-muted);transition:all .15s;background:none;border-top:none;border-left:none;border-right:none}'
          +'.inv-tab.active{color:var(--sidebar-bg);border-bottom-color:var(--sidebar-bg)}'
          +'.inv-tab:hover:not(.active){color:var(--text-primary)}'
          +'.inv-tab-panel{display:none}.inv-tab-panel.active{display:block}'
          +'.inv-template-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px}'
          +'.inv-template-card{border:2px solid var(--border);border-radius:10px;padding:10px 8px;cursor:pointer;text-align:center;transition:all .18s;background:#fff;position:relative}'
          +'.inv-template-card:hover{border-color:var(--accent)}'
          +'.inv-template-card.selected{border-color:var(--sidebar-bg);background:var(--accent-pale)}'
          +'.inv-template-card.selected::after{content:"✓";position:absolute;top:5px;right:7px;font-size:11px;color:var(--sidebar-bg);font-weight:700}'
          +'.inv-tpl-preview{width:100%;aspect-ratio:3/4;border-radius:6px;overflow:hidden;margin-bottom:6px;background:#f8f9fa;border:1px solid #eee;display:flex;flex-direction:column;gap:3px;padding:5px}'
          +'.inv-tpl-line{height:4px;border-radius:2px;background:#d1d5db}'
          +'.inv-tpl-line.dark{background:#0D4A3A}.inv-tpl-line.accent{background:var(--accent)}.inv-tpl-line.thin{height:2px}'
          +'.inv-tpl-name{font-size:10px;font-weight:700;color:var(--text-primary)}.inv-tpl-desc{font-size:9px;color:var(--text-muted)}'
          +'.inv-field-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}'
          +'.inv-field-item{display:flex;align-items:center;justify-content:space-between;border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:#fafafa;gap:8px}'
          +'.inv-field-info{flex:1;min-width:0}.inv-field-name{font-size:11px;font-weight:600;color:var(--text-primary)}.inv-field-hint{font-size:10px;color:var(--text-muted)}'
          +'.inv-field-toggle{width:32px;height:18px;border-radius:9px;border:none;cursor:pointer;position:relative;transition:background .2s;flex-shrink:0}'
          +'.inv-field-toggle.on{background:var(--sidebar-bg)}.inv-field-toggle.off{background:#d1d5db}'
          +'.inv-field-toggle::after{content:"";position:absolute;top:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .2s}'
          +'.inv-field-toggle.on::after{left:16px}.inv-field-toggle.off::after{left:2px}'
          +'.inv-color-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px}'
          +'.inv-color-swatch{width:28px;height:28px;border-radius:6px;border:2px solid transparent;cursor:pointer;transition:transform .15s}'
          +'.inv-color-swatch:hover{transform:scale(1.15)}'
          +'.inv-color-swatch.selected{border-color:#fff;outline:2px solid var(--sidebar-bg)}'
          +'.inv-col-list{display:flex;flex-direction:column;gap:6px}'
          +'.inv-col-item{display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:#fafafa;cursor:grab}'
          +'.inv-col-item:active{cursor:grabbing}'
          +'.inv-col-drag{color:var(--text-muted);font-size:14px;flex-shrink:0}'
          +'.inv-col-label{flex:1;font-size:12px;font-weight:600;color:var(--text-primary)}'
          +'.inv-col-width{width:56px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:11px;text-align:center;background:#fff}'
          +'.inv-col-vis{flex-shrink:0}'
          +'.inv-live-preview{border:1px solid var(--border);border-radius:10px;background:#fff;padding:12px;margin-top:4px;position:relative;overflow:hidden}'
          +'.inv-preview-badge{position:absolute;top:8px;right:8px;background:var(--accent-pale);color:var(--sidebar-bg);font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px}'
          +'.inv-preview-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}'
          +'.inv-preview-logo{width:40px;height:16px;border-radius:3px;background:var(--sidebar-bg)}'
          +'.inv-preview-title{font-size:13px;font-weight:800;color:var(--sidebar-bg);letter-spacing:.05em}'
          +'.inv-preview-meta{font-size:9px;color:var(--text-muted);margin-bottom:6px}'
          +'.inv-preview-divider{height:2px;background:var(--sidebar-bg);margin-bottom:6px;border-radius:1px}'
          +'.inv-preview-table-head{display:grid;grid-template-columns:3fr 1fr 1fr 1fr;gap:4px;padding:4px 6px;background:var(--sidebar-bg);border-radius:4px 4px 0 0;font-size:8px;font-weight:700;color:#fff}'
          +'.inv-preview-table-row{display:grid;grid-template-columns:3fr 1fr 1fr 1fr;gap:4px;padding:3px 6px;border-bottom:1px solid #f0f0f0;font-size:8px;color:var(--text-muted)}'
          +'.inv-preview-total{display:flex;justify-content:flex-end;margin-top:6px;font-size:10px;font-weight:700;color:var(--sidebar-bg)}'
          +'.inv-preview-footer{font-size:8px;color:var(--text-muted);margin-top:6px;border-top:1px solid var(--border);padding-top:6px}'
          +'.inv-num-row{display:flex;align-items:center;gap:6px;margin-bottom:8px}'
          +'.inv-num-part{padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:11px;background:#fff;font-family:Inter,sans-serif;min-width:50px;text-align:center}'
          +'.inv-num-sep{font-size:12px;color:var(--text-muted);font-weight:700}'
          +'.inv-num-result{font-size:11px;font-weight:700;color:var(--sidebar-bg);font-family:Inter,sans-serif}';
        document.head.appendChild(st);
      }
      // JS関数はグローバルスコープに定義済み


      var TG = function(on){ return '<button class="inv-field-toggle '+(on?'on':'off')+'" onclick="this.classList.toggle(\'on\');this.classList.toggle(\'off\');"></button>'; };
      var TGk = function(on,key){ return '<button class="inv-field-toggle '+(on?'on':'off')+'" data-fkey="'+key+'" onclick="this.classList.toggle(\'on\');this.classList.toggle(\'off\');invToggleField(this)"></button>'; };
      var FI = function(nm,hint,on,key){ return '<div class="inv-field-item"><div class="inv-field-info"><div class="inv-field-name">'+nm+'</div><div class="inv-field-hint">'+hint+'</div></div>'+(key?TGk(on,key):TG(on))+'</div>'; };
      var SEC = function(icon,txt,mt){ return '<div class="settings-section-title"'+(mt?' style="margin-top:'+mt+'px;margin-bottom:10px"':' style="margin-bottom:10px"')+'>'+icon+txt+'</div>'; };
      var ICO_rect = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>';
      var ICO_yen  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
      var ICO_usr  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      var ICO_doc  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>';
      var ICO_eye  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
      var ICO_num  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>';
      var ICO_cal  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
      var ICO_msg  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
      var ICO_col  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>';

      // ── タブナビ ──
      // 現在編集中フォーマットID を初期化
      if (!window._currentEditFormatId) window._currentEditFormatId = _invFormats[0] && _invFormats[0].id;
      var currentFmt = getInvFormat(window._currentEditFormatId);

      // ── フォーマット管理バー（タブの上） ──
      var html = '<div style="background:#f8f9fa;border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:16px">'
        +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
          +'<div style="font-size:13px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:6px">'
            +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sidebar-bg)" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
            +'フォーマット一覧'
          +'</div>'
          +'<button onclick="invAddNewFormat()" class="btn btn-outline btn-sm" style="display:flex;align-items:center;gap:4px;font-size:11px">'
            +'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>新規作成'
          +'</button>'
        +'</div>'
        +'<div id="inv-format-list">'+buildFormatListHTML()+'</div>'
        +'</div>'

        // 編集中フォーマット名入力
        +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:10px 14px;background:#fff;border:2px solid var(--sidebar-bg);border-radius:10px">'
          +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sidebar-bg)" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
          +'<span style="font-size:11px;font-weight:600;color:var(--sidebar-bg);white-space:nowrap">編集中：</span>'
          +'<input id="inv-format-name-input" class="settings-form-input" style="flex:1;padding:4px 8px;font-size:12px;font-weight:700;border-color:transparent;background:transparent" value="'+currentFmt.name+'">'
          +'<button onclick="invSaveCurrentFormat()" class="btn btn-primary btn-sm" style="display:flex;align-items:center;gap:4px;font-size:11px;flex-shrink:0">'
            +'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>このフォーマットを保存'
          +'</button>'
        +'</div>';

      html += '<div class="inv-tabs">'
        +'<button class="inv-tab active" onclick="invSwitchTab(this,\'tab-layout\')">📐 レイアウト</button>'
        +'<button class="inv-tab" onclick="invSwitchTab(this,\'tab-fields\')">☑ 表示項目</button>'
        +'<button class="inv-tab" onclick="invSwitchTab(this,\'tab-columns\')">📊 明細列</button>'
        +'<button class="inv-tab" onclick="invSwitchTab(this,\'tab-number\')">🔢 番号・税</button>'
        +'<button class="inv-tab" onclick="invSwitchTab(this,\'tab-remarks\')">📝 備考</button>'
        +'</div>';

      // ── ① レイアウトタブ ──
      html += '<div id="tab-layout" class="inv-tab-panel active">';
      html += SEC(ICO_rect,'テンプレート選択');
      html += '<div class="inv-template-grid">'
        +'<div class="inv-template-card selected" onclick="invSelectTpl(this)">'
          +'<div class="inv-tpl-preview">'
            +'<div class="inv-tpl-line dark" style="width:60%"></div>'
            +'<div class="inv-tpl-line thin" style="width:90%"></div>'
            +'<div style="flex:1"></div>'
            +'<div class="inv-tpl-line accent" style="width:100%"></div>'
            +'<div class="inv-tpl-line thin" style="width:100%"></div>'
            +'<div class="inv-tpl-line thin" style="width:100%"></div>'
            +'<div style="flex:1"></div>'
            +'<div class="inv-tpl-line dark" style="width:40%;align-self:flex-end"></div>'
          +'</div><div class="inv-tpl-name">スタンダード</div><div class="inv-tpl-desc">シンプル・汎用</div>'
        +'</div>'
        +'<div class="inv-template-card" onclick="invSelectTpl(this)">'
          +'<div class="inv-tpl-preview" style="background:#f0fdf4">'
            +'<div style="display:flex;justify-content:space-between;align-items:center">'
              +'<div class="inv-tpl-line dark" style="width:40%;height:6px;border-radius:3px"></div>'
              +'<div class="inv-tpl-line accent" style="width:25%;height:6px;border-radius:3px"></div>'
            +'</div>'
            +'<div style="flex:1"></div>'
            +'<div class="inv-tpl-line thin" style="width:100%"></div>'
            +'<div class="inv-tpl-line thin" style="width:100%"></div>'
            +'<div style="flex:1"></div>'
            +'<div style="align-self:flex-end;background:var(--accent);border-radius:3px;padding:2px 6px;font-size:7px;color:#fff;font-weight:700">合計</div>'
          +'</div><div class="inv-tpl-name">モダン</div><div class="inv-tpl-desc">左右分割レイアウト</div>'
        +'</div>'
        +'<div class="inv-template-card" onclick="invSelectTpl(this)">'
          +'<div class="inv-tpl-preview" style="padding:4px">'
            +'<div style="background:#0D4A3A;border-radius:3px;padding:4px;margin-bottom:4px">'
              +'<div class="inv-tpl-line" style="width:70%;background:rgba(255,255,255,.8)"></div>'
              +'<div class="inv-tpl-line thin" style="width:50%;background:rgba(255,255,255,.5)"></div>'
            +'</div>'
            +'<div class="inv-tpl-line thin" style="width:100%"></div>'
            +'<div class="inv-tpl-line thin" style="width:100%"></div>'
            +'<div class="inv-tpl-line thin" style="width:100%"></div>'
            +'<div class="inv-tpl-line dark" style="width:45%;align-self:flex-end;margin-top:auto"></div>'
          +'</div><div class="inv-tpl-name">コンパクト</div><div class="inv-tpl-desc">明細重視・多行対応</div>'
        +'</div>'
        +'</div>';

      html += SEC(ICO_col,'アクセントカラー',20);
      html += '<div class="inv-color-row" id="invColorSwatches">'
        +'<div class="inv-color-swatch selected" style="background:#0D4A3A" onclick="invPickColor(this,\'#0D4A3A\')"></div>'
        +'<div class="inv-color-swatch" style="background:#1e40af" onclick="invPickColor(this,\'#1e40af\')"></div>'
        +'<div class="inv-color-swatch" style="background:#7c3aed" onclick="invPickColor(this,\'#7c3aed\')"></div>'
        +'<div class="inv-color-swatch" style="background:#dc2626" onclick="invPickColor(this,\'#dc2626\')"></div>'
        +'<div class="inv-color-swatch" style="background:#d97706" onclick="invPickColor(this,\'#d97706\')"></div>'
        +'<div class="inv-color-swatch" style="background:#374151" onclick="invPickColor(this,\'#374151\')"></div>'
        +'<input type="color" value="#0D4A3A" style="width:28px;height:28px;border-radius:6px;border:2px solid var(--border);cursor:pointer;padding:1px" oninput="invPickColor(null,this.value,true)">'
        +'</div>';

      html += SEC(ICO_rect,'用紙・基本設定',20);
      html += '<div class="settings-form-group"><label class="settings-form-label">用紙サイズ</label>'
        +'<select class="settings-form-select"><option>A4 縦（210×297mm）</option><option>A4 横（297×210mm）</option><option>B5 縦（182×257mm）</option></select></div>';
      html += '<div class="settings-form-group"><label class="settings-form-label">フォントサイズ</label>'
        +'<select class="settings-form-select"><option>小（9pt）</option><option selected>標準（10pt）</option><option>大（11pt）</option></select></div>';
      html += '<div class="settings-form-group"><label class="settings-form-label">会社名（請求書ヘッダー）</label>'
        +'<input class="settings-form-input" value="株式会社ロジポケ運輸"></div>';
      html += '<div class="settings-form-group"><label class="settings-form-label">会社住所</label>'
        +'<input class="settings-form-input" value="東京都千代田区〇〇1-2-3"></div>';
      html += '<div class="settings-form-group"><label class="settings-form-label">ロゴ画像</label>'
        +'<div style="border:2px dashed var(--border);border-radius:8px;padding:16px;text-align:center;color:var(--text-muted);font-size:12px;cursor:pointer;background:#fafafa">'
        +'📎 クリックまたはドラッグ＆ドロップで画像をアップロード<br>'
        +'<span style="font-size:10px">PNG / JPG / SVG・最大2MB</span></div></div>';
      html += '<div class="settings-form-group"><label class="settings-form-label">ロゴ配置</label>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'
        +'<button class="inv-template-card selected" style="padding:8px;font-size:11px;font-weight:600" onclick="invSetAlign(this)">◀ 左寄せ</button>'
        +'<button class="inv-template-card" style="padding:8px;font-size:11px;font-weight:600" onclick="invSetAlign(this)">▪ 中央</button>'
        +'<button class="inv-template-card" style="padding:8px;font-size:11px;font-weight:600" onclick="invSetAlign(this)">▶ 右寄せ</button>'
        +'</div></div>';

      html += '</div>'; // tab-layout end

      // ── ② 表示項目タブ ──
      html += '<div id="tab-fields" class="inv-tab-panel">';
      html += '<p style="font-size:11px;color:var(--text-muted);margin-bottom:14px">請求書に表示する項目をON/OFFで切り替えられます。顧客ごとに必要な項目だけを表示して、シンプルで見やすい帳票を作れます。</p>';
      html += SEC(ICO_usr,'ヘッダー情報');
      html += '<div class="inv-field-grid">'
        +FI('会社ロゴ','上部に表示',true,'logo')
        +FI('会社名・住所','発行者情報',true,'company')
        +FI('電話・FAX番号','連絡先',true,'tel')
        +FI('インボイス登録番号','T+13桁',true,'invoice_no')
        +FI('担当者名','請求書発行担当',false,'staff')
        +FI('会社印影','電子印鑑',false,'seal')
        +'</div>';
      html += SEC(ICO_doc,'本文・明細情報',16);
      html += '<div class="inv-field-grid">'
        +FI('案件番号','ロジポケ案件ID',true,'case_no')
        +FI('運送区間','発地→着地',true,'route')
        +FI('ドライバー名','担当乗務員',false,'driver')
        +FI('車両番号','ナンバープレート',false,'vehicle')
        +FI('荷物の種類','品目・品名',true,'cargo')
        +FI('重量・体積','積載情報',false,'weight')
        +FI('走行距離（km）','実績距離',false,'distance')
        +FI('燃料サーチャージ','別行表示',true,'fuel')
        +'</div>';
      html += SEC(ICO_yen,'金額情報',16);
      html += '<div class="inv-field-grid">'
        +FI('小計','税抜き合計',true)
        +FI('消費税額','内訳表示',true)
        +FI('振込先口座','銀行情報',true)
        +FI('QRコード','振込先確認用',false)
        +'</div>';
      html += '</div>'; // tab-fields end

      // ── ③ 明細列タブ ──
      html += '<div id="tab-columns" class="inv-tab-panel">';
      html += '<p style="font-size:11px;color:var(--text-muted);margin-bottom:14px">表示する列を選択し、幅（%）を調整してください。変更は右プレビューに即反映されます。</p>';
      var cols = [
        {lbl:'📝 摘要（品目・区間）', key:'summary', w:35, on:true},
        {lbl:'📅 運行日',             key:'date',    w:15, on:true},
        {lbl:'🔢 数量',               key:'qty',     w:10, on:true},
        {lbl:'💴 単価（円）',          key:'price',   w:15, on:true},
        {lbl:'💰 金額（円）',          key:'amount',  w:15, on:true},
        {lbl:'🏷 税率',               key:'tax',     w:10, on:false}
      ];
      html += '<div class="inv-col-list" id="inv-col-list-wrap">';
      cols.forEach(function(c){
        html += '<div class="inv-col-item" style="'+(c.on?'':'opacity:.6')+'" data-col="'+c.key+'">'
          +'<span class="inv-col-drag">⠿</span>'
          +'<span class="inv-col-label">'+c.lbl+'</span>'
          +'<input class="inv-col-width" type="number" value="'+c.w+'" min="5" max="80"'
          +' oninput="invUpdateColTotal();invSyncColWidth(\''+c.key+'\',this.value)">'
          +'<span style="font-size:10px;color:var(--text-muted)">%</span>'
          +'<button class="inv-field-toggle inv-col-vis '+(c.on?'on':'off')+'"'
          +' onclick="this.classList.toggle(\'on\');this.classList.toggle(\'off\');'
          +'this.closest(\'.inv-col-item\').style.opacity=this.classList.contains(\'on\')?1:.6;'
          +'invUpdateColTotal();invSyncColVis(\''+c.key+'\',this.classList.contains(\'on\'))"></button>'
          +'</div>';
      });
      html += '</div>';
      html += '<div style="margin-top:12px;padding:10px 12px;background:var(--accent-pale);border-radius:8px;font-size:11px;color:var(--sidebar-bg)">'
        +'💡 幅の合計：<strong id="invColTotal">90</strong>% ／ 推奨：100%に調整してください</div>';
      html += '<div style="margin-top:12px"><button class="btn btn-outline btn-sm" style="width:100%" onclick="invAddCustomCol()">'
        +'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
        +' カスタム列を追加</button></div>';
      html += '</div>'; // tab-columns end

      // ── ④ 番号・税タブ ──
      html += '<div id="tab-number" class="inv-tab-panel">';
      html += SEC(ICO_num,'請求書番号形式');
      html += '<p style="font-size:11px;color:var(--text-muted);margin-bottom:12px">プレフィックス・年月・連番の組み合わせで採番ルールを設定できます。</p>';
      html += '<div class="inv-num-row">'
        +'<input id="inv-num-prefix" class="inv-num-part" type="text" value="INV" style="width:56px" placeholder="接頭辞" oninput="invSyncNumberTab()">'
        +'<span class="inv-num-sep">-</span>'
        +'<select id="inv-num-date" class="settings-form-select" style="padding:5px 8px;font-size:11px;width:auto" onchange="invSyncNumberTab()"><option>YYYYMM</option><option>YYYY</option><option>なし</option></select>'
        +'<span class="inv-num-sep">-</span>'
        +'<select id="inv-num-digits" class="settings-form-select" style="padding:5px 8px;font-size:11px;width:auto" onchange="invSyncNumberTab()"><option>4桁</option><option selected>5桁</option><option>6桁</option></select>'
        +'</div>';
      html += '<div style="margin-bottom:16px;padding:8px 12px;background:var(--accent-pale);border-radius:8px;font-size:11px;color:var(--sidebar-bg)">'
        +'生成例：<span class="inv-num-result" id="inv-num-preview">INV-202605-00001</span></div>';
      html += '<div class="settings-form-group"><label class="settings-form-label">開始番号（次回発行時に適用）</label>'
        +'<input class="settings-form-input" type="number" value="1" min="1"></div>';
      html += '<div class="settings-toggle-row"><div>'
        +'<div class="settings-toggle-label">年度ごとに連番をリセット</div>'
        +'<div class="settings-toggle-desc">4月始まりでリセット（年度末締め企業向け）</div>'
        +'</div>'+TG(true)+'</div>';

      html += SEC(ICO_yen,'消費税・インボイス設定',20);
      html += '<div class="settings-form-group"><label class="settings-form-label">デフォルト消費税率</label>'
        +'<select id="inv-tax-rate" class="settings-form-select" onchange="invSyncNumberTab()">'
        +'<option value="10" selected>10%（標準税率）</option>'
        +'<option value="8">8%（軽減税率）</option>'
        +'<option value="0">非課税</option>'
        +'<option value="0">免税（輸出）</option>'
        +'</select></div>';
      html += '<div class="settings-form-group"><label class="settings-form-label">インボイス登録番号</label>'
        +'<input id="inv-reg-no" class="settings-form-input" placeholder="T1234567890123" value="T9876543210123" oninput="invSyncNumberTab()"></div>';
      html += '<div class="settings-toggle-row"><div>'
        +'<div class="settings-toggle-label">適格請求書（インボイス）として発行</div>'
        +'<div class="settings-toggle-desc">登録番号・税率区分を自動記載</div>'
        +'</div><button id="inv-toggle-invoice" class="inv-field-toggle on" onclick="this.classList.toggle(\'on\');this.classList.toggle(\'off\');invSyncNumberTab()"></button></div>';
      html += '<div class="settings-toggle-row"><div>'
        +'<div class="settings-toggle-label">早期支払い割引を表示</div>'
        +'<div class="settings-toggle-desc">10日以内支払で2%割引を明記</div>'
        +'</div><button id="inv-toggle-discount" class="inv-field-toggle on" onclick="this.classList.toggle(\'on\');this.classList.toggle(\'off\');invSyncNumberTab()"></button></div>';
      html += '<div class="settings-toggle-row"><div>'
        +'<div class="settings-toggle-label">振込手数料を顧客負担に設定</div>'
        +'<div class="settings-toggle-desc">備考欄に自動挿入</div>'
        +'</div><button id="inv-toggle-bankfee" class="inv-field-toggle on" onclick="this.classList.toggle(\'on\');this.classList.toggle(\'off\');invSyncNumberTab()"></button></div>';

      html += SEC(ICO_cal,'支払期限ルール',20);
      html += '<div class="settings-form-group"><label class="settings-form-label">デフォルト支払期限</label>'
        +'<select id="inv-due-rule" class="settings-form-select" onchange="invSyncNumberTab()">'
        +'<option value="30">請求月末締め翌月末払い</option>'
        +'<option value="60" selected>請求月末締め翌々月末払い</option>'
        +'<option value="30d">発行日から30日</option>'
        +'<option value="60d">発行日から60日</option>'
        +'<option value="custom">カスタム（日数指定）</option>'
        +'</select></div>';
      html += '</div>'; // tab-number end

      // ── ⑤ 備考タブ ──
      html += '<div id="tab-remarks" class="inv-tab-panel">';
      html += SEC(ICO_msg,'備考欄テンプレート');
      html += '<p style="font-size:11px;color:var(--text-muted);margin-bottom:12px">'
        +'変数を使用できます：'
        +'<code style="background:#f3f4f6;padding:1px 5px;border-radius:4px;font-size:10px">{{顧客名}}</code> '
        +'<code style="background:#f3f4f6;padding:1px 5px;border-radius:4px;font-size:10px">{{請求金額}}</code> '
        +'<code style="background:#f3f4f6;padding:1px 5px;border-radius:4px;font-size:10px">{{支払期限}}</code>'
        +'</p>';
      html += '<div class="settings-form-group">'
        +'<textarea id="inv-remarks-text" class="settings-form-input" rows="5" style="resize:vertical;font-size:12px;line-height:1.7" oninput="invSyncRemarks()">'
        +'お振込先：〇〇銀行 〇〇支店 普通 1234567\n口座名義：カ）ロジポケウンユ\n※振込手数料はご負担をお願いいたします。\n※お支払期限：{{支払期限}}までにお振込をお願いいたします。'
        +'</textarea></div>';

      // テンプレートのプリセット内容
      var tpls = {
        bank:     'お振込先：〇〇銀行 〇〇支店 普通 1234567\n口座名義：カ）ロジポケウンユ\n※振込手数料はご負担をお願いいたします。',
        penalty:  '支払期日を過ぎた場合、年率14.6%の遅延損害金が発生いたします。\nお早めのお支払いをお願いいたします。',
        discount: '※{{支払期限}}から10日以内にお支払いいただいた場合、\n請求金額の2%（早期支払い割引）を次回請求より差し引きます。',
        contact:  'ご不明な点はお気軽にお問い合わせください。\nTEL：03-1234-5678（担当：山田）\nMAIL：billing@logipoke.co.jp'
      };

      html += '<div class="settings-form-group"><label class="settings-form-label">テンプレートを選択して挿入</label>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">'
        +'<button onclick="invInsertTemplate(\'bank\')"    class="settings-toggle-row" style="border:1px solid var(--border);border-radius:8px;padding:8px 10px;cursor:pointer;background:#fafafa;text-align:left;font-size:11px;font-weight:600">🏦 振込先情報</button>'
        +'<button onclick="invInsertTemplate(\'penalty\')" class="settings-toggle-row" style="border:1px solid var(--border);border-radius:8px;padding:8px 10px;cursor:pointer;background:#fafafa;text-align:left;font-size:11px;font-weight:600">⚠️ 遅延損害金案内</button>'
        +'<button onclick="invInsertTemplate(\'discount\')"class="settings-toggle-row" style="border:1px solid var(--border);border-radius:8px;padding:8px 10px;cursor:pointer;background:#fafafa;text-align:left;font-size:11px;font-weight:600">🎁 早払い割引案内</button>'
        +'<button onclick="invInsertTemplate(\'contact\')" class="settings-toggle-row" style="border:1px solid var(--border);border-radius:8px;padding:8px 10px;cursor:pointer;background:#fafafa;text-align:left;font-size:11px;font-weight:600">📞 問い合わせ先</button>'
        +'</div></div>';

      // テンプレートデータを隠し要素に埋め込む
      html += '<div id="inv-tpls-data" style="display:none"'
        +' data-bank="'    + tpls.bank.replace(/"/g,'&quot;').replace(/\n/g,'\\n') + '"'
        +' data-penalty="' + tpls.penalty.replace(/"/g,'&quot;').replace(/\n/g,'\\n') + '"'
        +' data-discount="'+ tpls.discount.replace(/"/g,'&quot;').replace(/\n/g,'\\n') + '"'
        +' data-contact="' + tpls.contact.replace(/"/g,'&quot;').replace(/\n/g,'\\n') + '"'
        +'></div>';

      html += '<div class="settings-toggle-row"><div>'
        +'<div class="settings-toggle-label">備考欄を全請求書に自動挿入</div>'
        +'<div class="settings-toggle-desc">テンプレートを毎回自動でセット</div>'
        +'</div>'+TG(true)+'</div>';
      html += '<div class="settings-toggle-row"><div>'
        +'<div class="settings-toggle-label">顧客別にテンプレートを切り替える</div>'
        +'<div class="settings-toggle-desc">顧客マスタに紐づけた備考を優先適用</div>'
        +'</div>'+TG(false)+'</div>';
      html += '</div>'; // tab-remarks end

      return html;
    }
  },
  pattern: {
    color: 'linear-gradient(135deg,#0D4A3A 0%,#1a6b52 100%)',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    title: '案件パターン定義',
    body: function(){
      return '<div class="settings-section-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>定義済みパターン</div>'
        +'<div style="margin-bottom:16px"><span class="pattern-chip active">🔄 定期便</span><span class="pattern-chip active">⚡ スポット</span><span class="pattern-chip active">🚚 チャーター</span><span class="pattern-chip active">📦 混載便</span><span class="pattern-chip active">🌙 深夜便</span><span class="pattern-chip" onclick="this.classList.toggle(\'active\')">+ カスタム追加</span></div>'
        +'<div class="settings-section-title" style="margin-top:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>AI自動分類ルール</div>'
        +'<div class="settings-toggle-row"><div><div class="settings-toggle-label">発着地が同じ → 定期便として優先判定</div><div class="settings-toggle-desc">過去3回以上同じ区間があれば自動適用</div></div><button class="settings-toggle on" onclick="this.classList.toggle(\'on\');this.classList.toggle(\'off\')"></button></div>'
        +'<div class="settings-toggle-row"><div><div class="settings-toggle-label">当日依頼 → スポット判定</div><div class="settings-toggle-desc">受注から48時間以内の配送日</div></div><button class="settings-toggle on" onclick="this.classList.toggle(\'on\');this.classList.toggle(\'off\')"></button></div>'
        +'<div class="settings-toggle-row"><div><div class="settings-toggle-label">22:00〜5:00 → 深夜便フラグ</div><div class="settings-toggle-desc">深夜割増料金を自動適用</div></div><button class="settings-toggle off" onclick="this.classList.toggle(\'on\');this.classList.toggle(\'off\')"></button></div>'
        +'<div class="settings-section-title" style="margin-top:24px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>パターン別デフォルト運賃設定</div>'
        +'<div class="settings-form-group"><label class="settings-form-label">定期便 基本運賃（円/km）</label><input class="settings-form-input" type="number" value="120" /></div>'
        +'<div class="settings-form-group"><label class="settings-form-label">スポット便 基本運賃（円/km）</label><input class="settings-form-input" type="number" value="160" /></div>'
        +'<div class="settings-form-group"><label class="settings-form-label">深夜割増率（%）</label><input class="settings-form-input" type="number" value="25" /></div>';
    }
  },
  ai: {
    color: 'linear-gradient(135deg,#0D4A3A 0%,#1a6b52 100%)',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" stroke-width="2"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 8v4l3 3"/></svg>',
    title: '配車AIレコメンド定義（車両推薦）',
    body: function(){
      var w = window.AI_WEIGHTS;
      function sliderRow(icon, label, key, val) {
        return '<div class="sp-slider-row" style="margin-bottom:12px">'
          +'<div class="sp-slider-label" style="width:130px;font-size:12px;font-weight:600;color:#374151">'+icon+' '+label+'</div>'
          +'<div style="flex:1;display:flex;align-items:center;gap:10px">'
          +'<input type="range" class="sp-slider" id="ai-w-'+key+'" min="0" max="100" value="'+val+'" style="flex:1" oninput="aiWeightInput(\''+key+'\',this.value)">'
          +'<span id="ai-w-'+key+'-val" style="min-width:36px;text-align:right;font-size:13px;font-weight:700;font-family:Inter,sans-serif;color:var(--sidebar-bg)">'+val+'%</span>'
          +'</div>'
          +'</div>';
      }
      return ''
        // ── スコアリング重み付け ──
        +'<div class="settings-section-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>スコアリング重み付け</div>'
        +'<p style="font-size:11px;color:var(--text-muted);margin-bottom:14px">各スライダーを動かすと下のプレビューがリアルタイムで更新されます。</p>'
        // 合計インジケータ
        +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding:8px 14px;background:#f8fafc;border:1.5px solid var(--border);border-radius:8px">'
        +'<span style="font-size:11px;font-weight:600;color:var(--text-secondary)">重み合計</span>'
        +'<span id="ai-w-total" style="font-size:14px;font-weight:800;font-family:Inter,sans-serif;color:var(--sidebar-bg)">'+( w.distance+w.load+w.driver+w.law+w.customer )+'%</span>'
        +'<span id="ai-w-total-msg" style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;background:#d1fae5;color:#065f46">✓ 適正</span>'
        +'</div>'
        +sliderRow('📍','距離効率',       'distance', w.distance)
        +sliderRow('📦','積載量適合度',   'load',     w.load)
        +sliderRow('⭐','ドライバー実績', 'driver',   w.driver)
        +sliderRow('🕐','拘束時間余裕',   'law',      w.law)
        +sliderRow('🏢','顧客相性スコア', 'customer', w.customer)

        // ── リアルタイムプレビュー ──
        +'<div class="settings-section-title" style="margin-top:22px">'
        +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>'
        +'推薦スコア プレビュー（定期案件 #20240524101）</div>'
        +'<div id="ai-score-preview" style="margin-bottom:6px">'+buildAiScorePreview()+'</div>'

        // ── 除外ルール ──
        +'<div class="settings-section-title" style="margin-top:22px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>除外ルール</div>'
        +'<div class="settings-toggle-row"><div><div class="settings-toggle-label">連続乗務16時間超のドライバーを除外</div><div class="settings-toggle-desc">改善基準告示に基づく自動除外</div></div><button class="settings-toggle on" onclick="this.classList.toggle(\'on\');this.classList.toggle(\'off\')"></button></div>'
        +'<div class="settings-toggle-row"><div><div class="settings-toggle-label">車検切れ・整備中車両を除外</div><div class="settings-toggle-desc">車両ステータスと自動連携</div></div><button class="settings-toggle on" onclick="this.classList.toggle(\'on\');this.classList.toggle(\'off\')"></button></div>'
        +'<div class="settings-toggle-row"><div><div class="settings-toggle-label">ブラックリスト顧客×ドライバー除外</div><div class="settings-toggle-desc">相性NGペアをシステムが自動回避</div></div><button class="settings-toggle off" onclick="this.classList.toggle(\'on\');this.classList.toggle(\'off\')"></button></div>'

        // ── 優先車両設定 ──
        +'<div class="settings-section-title" style="margin-top:22px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>優先車両設定</div>'
        +'<div class="settings-form-group"><label class="settings-form-label">優先車両ナンバー（カンマ区切り）</label><input class="settings-form-input" placeholder="例：品川 100 あ 1234, 品川 200 い 5678" /></div>'
        +'<div class="settings-form-group"><label class="settings-form-label">推薦候補数（上位N台を表示）</label><select class="settings-form-select"><option>3台</option><option>5台</option><option>10台</option></select></div>';
    }
  },
  api: {
    color: 'linear-gradient(135deg,#0D4A3A 0%,#1a6b52 100%)',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fcd34d" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>',
    title: '外部API連携',
    body: function(){
      return '<div class="settings-section-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>接続済みサービス</div>'
        +'<div class="api-card"><div class="api-logo" style="background:#e0f2fe">🗺️</div><div class="api-info"><div class="api-name">Google Maps Platform</div><div class="api-desc">距離計算・ルート最適化に使用</div></div><span class="api-status connected">● 接続済み</span></div>'
        +'<div class="api-card"><div class="api-logo" style="background:#f0fdf4">📊</div><div class="api-info"><div class="api-name">弥生会計 オンライン</div><div class="api-desc">請求書・入出金データを自動同期</div></div><span class="api-status connected">● 接続済み</span></div>'
        +'<div class="api-card"><div class="api-logo" style="background:#fef2f2">📡</div><div class="api-info"><div class="api-name">動態管理システム（MOTEX）</div><div class="api-desc">GPSトラッキングデータ連携</div></div><span class="api-status disconnected">✕ 未接続</span></div>'
        +'<div class="api-card"><div class="api-logo" style="background:#fef2f2">📱</div><div class="api-info"><div class="api-name">SMS通知（Twilio）</div><div class="api-desc">ドライバー・顧客への自動SMS送信</div></div><span class="api-status disconnected">✕ 未接続</span></div>'
        +'<div style="margin-top:16px;margin-bottom:24px"><button class="btn btn-outline btn-sm" style="width:100%"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>新しいAPI連携を追加</button></div>'
        +'<div class="settings-section-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/></svg>Webhook設定</div>'
        +'<div class="settings-form-group"><label class="settings-form-label">Webhook URL（案件登録イベント）</label><input class="settings-form-input" placeholder="https://your-system.example.com/webhook" /></div>'
        +'<div class="settings-form-group"><label class="settings-form-label">シークレットキー</label><div style="display:flex;gap:8px"><input class="settings-form-input" type="password" value="sk_live_xxxxxxxxxxxxxxxx" style="flex:1" /><button class="btn btn-secondary btn-sm" style="flex-shrink:0">再発行</button></div></div>'
        +'<div class="settings-toggle-row"><div><div class="settings-toggle-label">Webhook送信を有効化</div><div class="settings-toggle-desc">案件登録・更新時に外部へ通知</div></div><button class="settings-toggle off" onclick="this.classList.toggle(\'on\');this.classList.toggle(\'off\')"></button></div>';
    }
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  設定パネル AI重み付けリアルタイム処理
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function aiWeightInput(key, val) {
  window.AI_WEIGHTS[key] = parseInt(val)||0;
  // 表示値更新
  var valEl = document.getElementById('ai-w-'+key+'-val');
  if (valEl) valEl.textContent = val+'%';
  // 合計更新
  var w = window.AI_WEIGHTS;
  var total = w.distance + w.load + w.driver + w.law + w.customer;
  var totalEl = document.getElementById('ai-w-total');
  var msgEl   = document.getElementById('ai-w-total-msg');
  if (totalEl) totalEl.textContent = total+'%';
  if (msgEl) {
    if (total === 100) {
      msgEl.style.background='#d1fae5'; msgEl.style.color='#065f46'; msgEl.textContent='✓ 適正';
    } else if (total < 100) {
      msgEl.style.background='#fef3c7'; msgEl.style.color='#92400e'; msgEl.textContent='▼ '+(100-total)+'% 不足';
    } else {
      msgEl.style.background='#fee2e2'; msgEl.style.color='#dc2626'; msgEl.textContent='▲ '+(total-100)+'% 超過';
    }
  }
  // スコアプレビュー更新
  var previewEl = document.getElementById('ai-score-preview');
  if (previewEl) previewEl.innerHTML = buildAiScorePreview();
}

function buildAiScorePreview() {
  // 処理中案件の最初の案件（定期案件）の車両3台でプレビュー
  var previewVehicles = [
    { id:'車両1245', driver:'山田 一郎', stars:5 },
    { id:'車両1123', driver:'鈴木 次郎', stars:4 },
    { id:'車両1356', driver:'佐藤 三郎', stars:4 },
  ];
  var rows = previewVehicles.map(function(v, i) {
    var score = calcAIScore(v.id);
    var raw = VEHICLE_RAW_SCORES[v.id] || {};
    var w = window.AI_WEIGHTS;
    var barW = function(wt, rawVal) {
      return Math.round((wt/100) * rawVal * wt / 100);
    };
    var scoreColor = score>=90 ? 'var(--green)' : score>=75 ? 'var(--orange)' : 'var(--red)';
    var bgColor = i===0 ? 'linear-gradient(135deg,#EAF5F0 0%,#fff 100%)' : '#fff';
    var borderColor = i===0 ? '1.5px solid #0D4A3A' : '1px solid var(--border)';
    // スコア内訳バー
    var breakdown = [
      { label:'距離', key:'distance', color:'#3BB888' },
      { label:'積載', key:'load',     color:'#2563eb' },
      { label:'実績', key:'driver',   color:'#f59e0b' },
      { label:'拘束', key:'law',      color:'#8b5cf6' },
      { label:'相性', key:'customer', color:'#ec4899' },
    ].map(function(b) {
      var contribution = Math.round((w[b.key]/100) * (raw[b.key]||0) * w[b.key] / 100);
      var pct = Math.min(100, Math.round((raw[b.key]||0)));
      return '<div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">'
        +'<span style="font-size:9px;color:var(--text-muted);width:24px;text-align:right">'+b.label+'</span>'
        +'<div style="flex:1;height:5px;background:#f1f5f9;border-radius:3px;overflow:hidden">'
        +'<div style="height:100%;width:'+pct+'%;background:'+b.color+';border-radius:3px;opacity:'+(w[b.key]>0?'1':'0.2')+'"></div>'
        +'</div>'
        +'<span style="font-size:9px;font-family:Inter,sans-serif;color:var(--text-muted);width:20px">×'+w[b.key]+'</span>'
        +'</div>';
    }).join('');
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:'+borderColor+';border-radius:10px;background:'+bgColor+';margin-bottom:8px">'
      +'<div style="width:22px;height:22px;border-radius:50%;background:'+(i===0?'var(--sidebar-bg)':'#f1f5f9')+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:'+(i===0?'#6DD5A8':'#64748b')+';flex-shrink:0">'+(i+1)+'</div>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:12px;font-weight:700;color:#111827;margin-bottom:6px">'+v.driver+' <span style="font-size:10px;font-weight:400;color:var(--text-muted)">/ '+v.id+'</span></div>'
      +breakdown
      +'</div>'
      +'<div style="text-align:center;flex-shrink:0">'
      +'<div style="font-size:26px;font-weight:900;font-family:Inter,sans-serif;color:'+scoreColor+';line-height:1">'+score+'</div>'
      +'<div style="font-size:9px;color:var(--text-muted)">AIスコア</div>'
      +'</div>'
      +'</div>';
  }).join('');
  return '<div style="background:#f8fafc;border:1px solid var(--border);border-radius:10px;padding:12px">'+rows+'</div>';
}

function openSettingsPanel(type) {
  var cfg = _settingsPanelContents[type];
  if (!cfg) return;
  var panel = document.getElementById('settings-panel');
  var overlay = document.getElementById('settings-panel-overlay');

  // 請求書パネルは左右分割フルスクリーン
  var isInvoice = (type === 'invoice');
  if (isInvoice) {
    panel.style.width = '100vw';
    panel.style.right = '0';
    panel.style.left = '0';
    panel.setAttribute('data-invoice-mode', '1');
    document.getElementById('sp-footer').style.display = 'none';

    document.getElementById('sp-header').innerHTML =
      '<div style="background:'+cfg.color+';padding:16px 24px;display:flex;align-items:center;gap:14px">'
      +'<div style="width:36px;height:36px;background:rgba(255,255,255,.15);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+cfg.icon+'</div>'
      +'<div><div style="font-size:16px;font-weight:700;color:#fff">'+cfg.title+'</div>'
      +'<div style="font-size:11px;color:rgba(255,255,255,.65);margin-top:1px">右画面でリアルタイムプレビューを確認しながら設定できます</div></div>'
      +'<div style="margin-left:auto;display:flex;align-items:center;gap:8px">'
      +'<button onclick="saveSettingsPanel()" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);border-radius:8px;padding:6px 16px;cursor:pointer;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;gap:6px">'
      +'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>保存</button>'
      +'<button onclick="closeSettingsPanel()" style="background:rgba(255,255,255,.15);border:none;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;font-size:18px;flex-shrink:0">✕</button>'
      +'</div></div>';

    // 左右分割ボディ
    document.getElementById('sp-body').style.padding = '0';
    document.getElementById('sp-body').style.overflow = 'hidden';
    document.getElementById('sp-body').innerHTML =
      '<div style="display:flex;height:100%">'
      // 左ペイン：設定
      +'<div id="inv-settings-pane" style="width:520px;flex-shrink:0;overflow-y:auto;padding:24px;border-right:1px solid var(--border)">'
      +cfg.body()
      +'</div>'
      // 右ペイン：プレビュー
      +'<div id="inv-preview-pane" style="flex:1;background:#f0f2f5;display:flex;flex-direction:column;overflow:hidden">'
      +'<div style="padding:14px 20px;background:#fff;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">'
      +'<div style="font-size:13px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:8px">'
      +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sidebar-bg)" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
      +'請求書プレビュー</div>'
      +'<div style="display:flex;gap:6px">'
      +'<button onclick="invSetPreviewScale(0.7)" id="pv-btn-70" style="padding:3px 10px;border:1px solid var(--border);border-radius:6px;font-size:11px;cursor:pointer;background:#fff">70%</button>'
      +'<button onclick="invSetPreviewScale(0.85)" id="pv-btn-85" style="padding:3px 10px;border:1px solid var(--border);border-radius:6px;font-size:11px;cursor:pointer;background:#fff">85%</button>'
      +'<button onclick="invSetPreviewScale(1)" id="pv-btn-100" style="padding:3px 10px;border:1px solid var(--sidebar-bg);border-radius:6px;font-size:11px;cursor:pointer;background:var(--sidebar-bg);color:#fff;font-weight:700">100%</button>'
      +'</div></div>'
      // プレビュー本体スクロール領域
      +'<div style="flex:1;overflow:auto;display:flex;justify-content:center;padding:32px 20px">'
      +'<div id="inv-preview-scaler" style="transform-origin:top center;transition:transform .2s">'
      +_buildInvoicePreviewHTML()
      +'</div>'
      +'</div>'
      +'</div>'
      +'</div>';

    window.invSetPreviewScale = function(s) {
      document.getElementById('inv-preview-scaler').style.transform = 'scale('+s+')';
      ['70','85','100'].forEach(function(v){
        var b = document.getElementById('pv-btn-'+v);
        if (!b) return;
        var active = (parseFloat(v)/100 === s);
        b.style.background = active ? 'var(--sidebar-bg)' : '#fff';
        b.style.color = active ? '#fff' : '';
        b.style.fontWeight = active ? '700' : '';
        b.style.borderColor = active ? 'var(--sidebar-bg)' : 'var(--border)';
      });
    };

  } else {
    panel.style.width = '560px';
    panel.style.left = '';
    panel.removeAttribute('data-invoice-mode');
    document.getElementById('sp-footer').style.display = '';
    document.getElementById('sp-body').style.padding = '24px';
    document.getElementById('sp-body').style.overflow = '';
    document.getElementById('sp-body').style.overflowY = 'auto';

    document.getElementById('sp-header').innerHTML =
      '<div style="background:'+cfg.color+';padding:20px 24px;display:flex;align-items:center;gap:14px">'
      +'<div style="width:40px;height:40px;background:rgba(255,255,255,.15);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+cfg.icon+'</div>'
      +'<div><div style="font-size:16px;font-weight:700;color:#fff">'+cfg.title+'</div></div>'
      +'<button onclick="closeSettingsPanel()" style="margin-left:auto;background:rgba(255,255,255,.15);border:none;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;font-size:18px;flex-shrink:0">✕</button>'
      +'</div>';
    document.getElementById('sp-body').innerHTML = cfg.body();
  }

  panel.style.display = 'flex';
  panel.style.transform = 'translateX(100%)';
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      panel.style.transform = 'translateX(0)';
    });
  });
}

function _buildInvoicePreviewHTML() {
  var c = '#0D4A3A'; // アクセントカラー（invPickColorで上書き）
  return '<div id="inv-full-preview" style="'
    +'width:720px;background:#fff;border:1px solid #d1d5db;box-shadow:0 2px 16px rgba(0,0,0,.07);'
    +'padding:40px 44px;font-size:13px;line-height:1.6;color:#111827;'
    +'font-family:\'Noto Sans JP\',sans-serif">'

    // ① タイトル行
    +'<div style="text-align:center;margin-bottom:28px">'
      +'<div id="fp-title" style="font-size:26px;font-weight:700;letter-spacing:.18em;color:#111827">請　求　書</div>'
    +'</div>'

    // ② 発行日・番号（右寄せ）
    +'<div style="display:flex;justify-content:flex-end;margin-bottom:24px">'
      +'<table style="font-size:12px;border-collapse:collapse;text-align:left">'
        +'<tr>'
          +'<td style="color:#6b7280;padding:1px 12px 1px 0;white-space:nowrap">発行日</td>'
          +'<td style="font-weight:600;font-family:Inter,sans-serif">2026/05/06</td>'
        +'</tr>'
        +'<tr id="fp-field-case_no">'
          +'<td style="color:#6b7280;padding:1px 12px 1px 0;white-space:nowrap">請求書番号</td>'
          +'<td style="font-weight:700;color:#0D4A3A;font-family:Inter,sans-serif" id="fp-inv-no-val">INV-202605-00001</td>'
        +'</tr>'
        +'<tr>'
          +'<td style="color:#6b7280;padding:1px 12px 1px 0;white-space:nowrap">支払期限</td>'
          +'<td style="font-weight:600;font-family:Inter,sans-serif" id="fp-due-val">2026/05/31</td>'
        +'</tr>'
      +'</table>'
    +'</div>'

    // ③ 請求先＋発行者（左右2カラム）
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;align-items:start">'

      // 請求先（左）
      +'<div>'
        +'<div style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:.1em;margin-bottom:6px">【請求先】</div>'
        +'<div style="font-size:17px;font-weight:700;color:#111827;margin-bottom:4px">株式会社サンプル荷主　御中</div>'
        +'<div style="font-size:11px;color:#6b7280;margin-top:8px;line-height:1.7">〒000-0000<br>東京都○○区△△1-2-3<br>TEL：03-XXXX-XXXX</div>'
      +'</div>'

      // 発行者（右）
      +'<div id="fp-info-block" style="text-align:right">'
        +'<div id="fp-field-logo">'
          +'<div id="fp-logo-bar" style="display:inline-flex;align-items:center;justify-content:flex-end;margin-bottom:8px">'
            +'<div style="background:#0D4A3A;border-radius:4px;padding:4px 12px;display:inline-block">'
              +'<span style="color:#fff;font-size:11px;font-weight:700;letter-spacing:.05em;font-family:Inter,sans-serif">LOGIPOKE</span>'
            +'</div>'
          +'</div>'
        +'</div>'
        +'<div id="fp-field-company" style="font-size:14px;font-weight:700;color:#0D4A3A;margin-bottom:4px">ロジポケ運送株式会社</div>'
        +'<div id="fp-field-tel" style="font-size:11px;color:#6b7280;line-height:1.7">'
          +'〒100-0001　東京都千代田区丸の内1-1-1<br>'
          +'TEL：03-1234-5678　／　FAX：03-1234-5679<br>'
        +'</div>'
        +'<div id="fp-field-invoice_no" style="font-size:11px;color:#6b7280">適格請求書発行事業者登録番号：T9876543210123</div>'
        +'<div id="fp-field-staff" style="display:none;font-size:11px;color:#6b7280;margin-top:4px">担当：山田 太郎</div>'
        +'<div id="fp-field-seal" style="display:none;margin-top:8px;display:flex;justify-content:flex-end">'
          +'<div style="width:52px;height:52px;border:2px solid #dc2626;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8px;color:#dc2626;font-weight:700;line-height:1.3;text-align:center">ロジポケ<br>運送</div>'
        +'</div>'
      +'</div>'
    +'</div>'

    // ④ ご請求金額
    +'<div style="display:flex;justify-content:flex-end;margin-bottom:28px;border-bottom:1px solid #e5e7eb;padding-bottom:16px">'
      +'<div style="text-align:right">'
        +'<div style="font-size:11px;color:#6b7280;margin-bottom:4px">ご請求金額（税込）</div>'
        +'<div id="fp-amount-box" style="font-size:28px;font-weight:800;font-family:Inter,sans-serif;color:#0D4A3A;line-height:1">¥140,470</div>'
      +'</div>'
    +'</div>'

    // ⑤ 明細テーブル
    +'<table style="width:100%;border-collapse:collapse;margin-bottom:4px">'
      +'<thead>'
        +'<tr id="fp-table-head" style="background:#0D4A3A">'
          +'<th data-col="summary" style="padding:9px 10px;text-align:left;font-size:11px;font-weight:600;color:#fff;width:50%">品目</th>'
          +'<th data-col="date"    style="padding:9px 10px;text-align:center;font-size:11px;font-weight:600;color:#fff;width:12%">運行日</th>'
          +'<th data-col="qty"     style="padding:9px 10px;text-align:center;font-size:11px;font-weight:600;color:#fff;width:8%">数量</th>'
          +'<th data-col="price"   style="padding:9px 10px;text-align:right;font-size:11px;font-weight:600;color:#fff;width:15%">単価</th>'
          +'<th data-col="amount"  style="padding:9px 10px;text-align:right;font-size:11px;font-weight:600;color:#fff;width:15%">金額</th>'
          +'<th data-col="tax"     style="padding:9px 10px;text-align:center;font-size:11px;font-weight:600;color:#fff;width:8%;display:none">税率</th>'
        +'</tr>'
      +'</thead>'
      +'<tbody id="fp-tbody">'
        +'<tr>'
          +'<td data-col="summary" style="padding:9px 10px;border-bottom:1px solid #e5e7eb;font-size:12px">'
            +'<span id="fp-field-route">東京 → 大阪</span>'
            +'<span id="fp-field-cargo">　チャーター便（機械部品）</span>'
            +'<div id="fp-field-driver"  style="display:none;font-size:10px;color:#9ca3af;margin-top:2px">担当ドライバー：鈴木一郎</div>'
            +'<div id="fp-field-vehicle" style="display:none;font-size:10px;color:#9ca3af">車両：品川100あ1234</div>'
            +'<div id="fp-field-weight"  style="display:none;font-size:10px;color:#9ca3af">重量：2,500kg</div>'
            +'<div id="fp-field-distance" style="display:none;font-size:10px;color:#9ca3af">距離：523km</div>'
          +'</td>'
          +'<td data-col="date"   style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;font-family:Inter,sans-serif">2026/05/01</td>'
          +'<td data-col="qty"    style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;font-family:Inter,sans-serif">1</td>'
          +'<td data-col="price"  style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;font-family:Inter,sans-serif;font-weight:600">¥85,000</td>'
          +'<td data-col="amount" style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;font-family:Inter,sans-serif;font-weight:600">¥85,000</td>'
          +'<td data-col="tax"    style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;display:none">10%</td>'
        +'</tr>'
        +'<tr>'
          +'<td data-col="summary" style="padding:9px 10px;border-bottom:1px solid #e5e7eb;font-size:12px">横浜 → 名古屋　スポット便</td>'
          +'<td data-col="date"    style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;font-family:Inter,sans-serif">2026/05/03</td>'
          +'<td data-col="qty"     style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;font-family:Inter,sans-serif">1</td>'
          +'<td data-col="price"   style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;font-family:Inter,sans-serif;font-weight:600">¥42,000</td>'
          +'<td data-col="amount"  style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;font-family:Inter,sans-serif;font-weight:600">¥42,000</td>'
          +'<td data-col="tax"     style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;display:none">10%</td>'
        +'</tr>'
        +'<tr id="fp-field-fuel">'
          +'<td data-col="summary" style="padding:9px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280">燃料サーチャージ</td>'
          +'<td data-col="date"    style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px">—</td>'
          +'<td data-col="qty"     style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;font-family:Inter,sans-serif">1</td>'
          +'<td data-col="price"   style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;font-family:Inter,sans-serif;font-weight:600">¥500</td>'
          +'<td data-col="amount"  style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;font-family:Inter,sans-serif;font-weight:600">¥500</td>'
          +'<td data-col="tax"     style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;display:none">10%</td>'
        +'</tr>'
      +'</tbody>'
    +'</table>'

    // ⑥ 小計・税・合計
    +'<div style="display:flex;justify-content:flex-end;margin-bottom:28px">'
      +'<table style="border-collapse:collapse;width:260px;font-size:12px">'
        +'<tr>'
          +'<td style="padding:5px 12px;color:#6b7280;border-bottom:1px solid #e5e7eb">小計</td>'
          +'<td style="padding:5px 12px;text-align:right;font-family:Inter,sans-serif;border-bottom:1px solid #e5e7eb" id="fp-subtotal-val">¥127,500</td>'
        +'</tr>'
        +'<tr id="fp-tax-row">'
          +'<td style="padding:5px 12px;color:#6b7280;border-bottom:1px solid #e5e7eb" id="fp-tax-label">消費税（10%）</td>'
          +'<td style="padding:5px 12px;text-align:right;font-family:Inter,sans-serif;border-bottom:1px solid #e5e7eb" id="fp-tax-val">¥12,750</td>'
        +'</tr>'
        +'<tr id="fp-total-row" style="background:#f8fdfb">'
          +'<td style="padding:8px 12px;font-weight:700;font-size:13px;color:#0D4A3A;border-top:2px solid #0D4A3A">合計（税込）</td>'
          +'<td style="padding:8px 12px;text-align:right;font-weight:800;font-size:14px;font-family:Inter,sans-serif;color:#0D4A3A;border-top:2px solid #0D4A3A" id="fp-total-val">¥140,250</td>'
        +'</tr>'
      +'</table>'
    +'</div>'

    // ⑦ 振込先＋備考（左右2カラム）
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;border-top:1px solid #e5e7eb;padding-top:20px">'
      +'<div>'
        +'<div style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:.08em;margin-bottom:8px">【お振込先】</div>'
        +'<div style="font-size:12px;line-height:1.9;color:#111827">'
          +'○○銀行　△△支店<br>普通　1234567<br>口座名義：ロジポケウンソウ（カ'
        +'</div>'
        +'<div id="fp-bank-charge-note" style="margin-top:10px;font-size:11px;color:#6b7280">※振込手数料はご負担ください。</div>'
      +'</div>'
      +'<div>'
        +'<div style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:.08em;margin-bottom:8px">【備考】</div>'
        +'<div id="fp-remarks-preview" style="font-size:12px;line-height:1.9;color:#374151;white-space:pre-wrap">'
          +'お振込先：〇〇銀行 〇〇支店 普通 1234567\n口座名義：カ）ロジポケウンユ\n※振込手数料はご負担をお願いいたします。\n※お支払期限：<span id="fp-remarks-due">2026/05/31</span>までにお振込をお願いいたします。'
          +'<div id="fp-early-discount" style="display:none;margin-top:4px;padding:4px 8px;background:#f0fdf4;border-radius:4px;font-size:11px;color:#15803d;white-space:normal">※10日以内のお支払いで2%割引（¥2,805 OFF）</div>'
        +'</div>'
      +'</div>'
    +'</div>'

    +'</div>';
}

function closeSettingsPanel() {
  var panel = document.getElementById('settings-panel');
  var overlay = document.getElementById('settings-panel-overlay');
  panel.style.transform = 'translateX(100%)';
  setTimeout(function(){
    panel.style.display = 'none';
    overlay.style.display = 'none';
    // フルスクリーンモードのリセット
    panel.style.width = '560px';
    panel.style.left = '';
    panel.style.right = '0';
    panel.removeAttribute('data-invoice-mode');
    document.getElementById('sp-footer').style.display = '';
    document.getElementById('sp-body').style.padding = '24px';
    document.getElementById('sp-body').style.overflow = '';
    document.getElementById('sp-body').style.overflowY = 'auto';
  }, 300);
}

function saveSettingsPanel() {
  // AIパネルが開いていた場合、スライダー値を AI_WEIGHTS に確定保存
  var isPanelAi = document.getElementById('ai-w-distance') !== null;
  if (isPanelAi) {
    ['distance','load','driver','law','customer'].forEach(function(k){
      var el = document.getElementById('ai-w-'+k);
      if (el) window.AI_WEIGHTS[k] = parseInt(el.value)||0;
    });
    recalcAllScores();
    // 現在表示中のページを再描画
    if (typeof renderProcessingList === 'function') renderProcessingList();
    if (typeof renderUnprocessedList === 'function') renderUnprocessedList();
    var procSel = document.querySelector('.case-list-item.active[data-phase="processing"]');
    if (procSel) { var idx = parseInt(procSel.dataset.idx||0); if (!isNaN(idx)) renderProcessingDetail(idx); }
    var unprocSel = document.querySelector('.case-list-item.active[data-phase="unprocessed"]');
    if (unprocSel) { var idx2 = parseInt(unprocSel.dataset.idx||0); if (!isNaN(idx2)) renderUnprocessedDetail(idx2); }
  }
  closeSettingsPanel();
  var tc = document.querySelector('.toast-container');
  if (tc) {
    var t = document.createElement('div');
    t.className = 'toast toast-success';
    t.innerHTML = '<span class="toast-icon">✅</span> 設定を保存しました。AIスコアを再計算しました。';
    tc.appendChild(t);
    setTimeout(function(){ t.remove(); }, 3500);
  }
}

(function(){
  var panel = document.getElementById('settings-panel');
  if (panel) { panel.style.transform = 'translateX(100%)'; }
})();