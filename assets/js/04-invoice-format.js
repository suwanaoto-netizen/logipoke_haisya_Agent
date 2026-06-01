// ══════════════════════════════════════════════════
//  請求書フォーマット管理
// ══════════════════════════════════════════════════
var _invFormats = [
  {
    id: 'FMT-001',
    name: 'スタンダード',
    isDefault: true,
    color: '#0D4A3A',
    template: 'standard',
    taxRate: 10,
    prefix: 'INV',
    dateFmt: 'YYYYMM',
    digits: 5,
    dueRule: '60',
    showInvoiceNo: true,
    remarks: 'お振込先：〇〇銀行 〇〇支店 普通 1234567\n口座名義：カ）ロジポケウンユ\n※振込手数料はご負担をお願いいたします。\n※お支払期限：{{支払期限}}までにお振込をお願いいたします。',
    earlyDiscount: true,
    bankFee: true,
    updatedAt: '2026/05/06'
  },
  {
    id: 'FMT-002',
    name: '△△食品専用',
    isDefault: false,
    color: '#1e40af',
    template: 'modern',
    taxRate: 8,
    prefix: 'INV-FOOD',
    dateFmt: 'YYYYMM',
    digits: 4,
    dueRule: '30',
    showInvoiceNo: true,
    remarks: 'お振込先：〇〇銀行 〇〇支店 普通 1234567\n口座名義：カ）ロジポケウンユ\n軽減税率（8%）適用品目の請求書です。\n※お支払期限：{{支払期限}}までにお振込をお願いいたします。',
    earlyDiscount: false,
    bankFee: true,
    updatedAt: '2026/05/06'
  }
];

// フォーマット取得
function getInvFormat(id) {
  return _invFormats.find(function(f){ return f.id === id; }) || _invFormats[0];
}

// フォーマット一覧HTML（設定カード内）
function buildFormatListHTML() {
  var html = '';
  _invFormats.forEach(function(f) {
    html += '<div class="inv-fmt-row" data-fid="'+f.id+'" style="display:flex;align-items:center;gap:10px;'
      +'padding:10px 12px;border:2px solid '+(f.isDefault?'var(--sidebar-bg)':'var(--border)')+';border-radius:10px;'
      +'background:'+(f.isDefault?'var(--accent-pale)':'#fafafa')+';margin-bottom:8px;cursor:pointer;transition:all .15s"'
      +' onclick="invSelectFormat(\''+f.id+'\')">'
      +'<div style="width:16px;height:16px;border-radius:4px;background:'+f.color+';flex-shrink:0"></div>'
      // 名前エリア（通常表示 / 編集中で切替）
      +'<div class="inv-fmt-name-area" data-fid="'+f.id+'" style="flex:1;min-width:0">'
        +'<div class="inv-fmt-name-display">'
          +'<div style="font-size:12px;font-weight:700;color:var(--text-primary)">'+f.name+'</div>'
          +'<div style="font-size:10px;color:var(--text-muted)">'+f.prefix+' ／ 消費税'+f.taxRate+'% ／ 更新：'+f.updatedAt+'</div>'
        +'</div>'
        +'<div class="inv-fmt-name-edit" style="display:none;align-items:center;gap:6px">'
          +'<input class="settings-form-input inv-fmt-name-input" value="'+f.name+'"'
            +' style="padding:4px 8px;font-size:12px;font-weight:700;flex:1;min-width:0"'
            +' onclick="event.stopPropagation()"'
            +' onkeydown="if(event.key===\'Enter\')invSaveFormatName(\''+f.id+'\',this.value);if(event.key===\'Escape\')invCancelFormatNameEdit(\''+f.id+'\');">'
          +'<button onclick="event.stopPropagation();invSaveFormatName(\''+f.id+'\',this.previousElementSibling.value)"'
            +' style="background:var(--sidebar-bg);color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;font-weight:700;flex-shrink:0">保存</button>'
          +'<button onclick="event.stopPropagation();invCancelFormatNameEdit(\''+f.id+'\')"'
            +' style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px;color:var(--text-muted);flex-shrink:0">✕</button>'
        +'</div>'
      +'</div>'
      +(f.isDefault
        ? '<span style="font-size:10px;font-weight:700;background:var(--sidebar-bg);color:#fff;padding:2px 8px;border-radius:10px;flex-shrink:0">デフォルト</span>'
        : '<button onclick="event.stopPropagation();invSetDefaultFormat(\''+f.id+'\')" style="font-size:10px;color:var(--text-muted);background:none;border:1px solid var(--border);border-radius:6px;padding:2px 8px;cursor:pointer;flex-shrink:0">規定に設定</button>'
      )
      +'<button onclick="event.stopPropagation();invEditFormat(\''+f.id+'\')" class="inv-fmt-edit-btn" data-fid="'+f.id+'" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px;color:var(--sidebar-bg);font-weight:600;flex-shrink:0">編集</button>'
      +(f.isDefault?'':'<button onclick="event.stopPropagation();invDeleteFormat(\''+f.id+'\')" style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:14px;padding:0 2px;flex-shrink:0">✕</button>')
      +'</div>';
  });
  return html;
}

// フォーマット選択（設定画面での編集対象切替）
function invSelectFormat(id) {
  document.querySelectorAll('.inv-fmt-row').forEach(function(r){
    var fid = r.getAttribute('data-fid');
    var f = getInvFormat(fid);
    r.style.border = '2px solid '+(fid===id?'var(--sidebar-bg)':'var(--border)');
    r.style.background = fid===id?'var(--accent-pale)':'#fafafa';
  });
  // 設定UIに値を反映
  invLoadFormatToUI(id);
}

// フォーマットデータをUIに読み込み
function invLoadFormatToUI(id) {
  var f = getInvFormat(id);
  window._currentEditFormatId = id;
  var set = function(elId, val){ var el=document.getElementById(elId); if(el) el.value=val; };
  var setChecked = function(elId, val){
    var el=document.getElementById(elId);
    if(!el) return;
    if(val){ el.classList.add('on'); el.classList.remove('off'); }
    else   { el.classList.add('off'); el.classList.remove('on'); }
  };
  set('inv-num-prefix', f.prefix);
  set('inv-tax-rate', f.taxRate);
  set('inv-reg-no', 'T9876543210123');
  set('inv-remarks-text', f.remarks);
  // color swatches
  document.querySelectorAll('.inv-color-swatch').forEach(function(s){ s.classList.remove('selected'); });
  var matchSwatch = document.querySelector('.inv-color-swatch[style*="'+f.color+'"]');
  if(matchSwatch) matchSwatch.classList.add('selected');
  setChecked('inv-toggle-discount', f.earlyDiscount);
  setChecked('inv-toggle-bankfee', f.bankFee);
  if(window.invPickColor) invPickColor(null, f.color, true);
  if(window.invSyncRemarks) invSyncRemarks();
  if(window.invSyncNumberTab) invSyncNumberTab();
  // フォーマット名入力欄を更新
  var nameEl = document.getElementById('inv-format-name-input');
  if(nameEl) nameEl.value = f.name;
}

// UIからフォーマットデータ保存
function invSaveCurrentFormat() {
  var id = window._currentEditFormatId || (_invFormats[0] && _invFormats[0].id);
  var f = getInvFormat(id);
  if(!f) return;
  var g = function(elId){ var el=document.getElementById(elId); return el?el.value:''; };
  var nameEl = document.getElementById('inv-format-name-input');
  f.name      = nameEl ? nameEl.value.trim() || f.name : f.name;
  f.prefix    = g('inv-num-prefix') || f.prefix;
  f.taxRate   = parseInt(g('inv-tax-rate')) || 10;
  f.remarks   = g('inv-remarks-text');
  f.updatedAt = new Date().toLocaleDateString('ja-JP').replace(/\//g,'/');
  var discTog = document.getElementById('inv-toggle-discount');
  f.earlyDiscount = discTog ? discTog.classList.contains('on') : f.earlyDiscount;
  var feeTog = document.getElementById('inv-toggle-bankfee');
  f.bankFee = feeTog ? feeTog.classList.contains('on') : f.bankFee;
  // カラー
  var selectedSwatch = document.querySelector('.inv-color-swatch.selected');
  if(selectedSwatch) {
    var bg = selectedSwatch.style.background;
    if(bg) f.color = bg;
  }
  // リスト再描画
  var listEl = document.getElementById('inv-format-list');
  if(listEl) listEl.innerHTML = buildFormatListHTML();
  // 請求管理ページのセレクターも更新
  updateInvoiceFormatSelectors();
  showToast('フォーマット「'+f.name+'」を保存しました', 'success');
}

// デフォルト設定
function invSetDefaultFormat(id) {
  _invFormats.forEach(function(f){ f.isDefault = (f.id===id); });
  var listEl = document.getElementById('inv-format-list');
  if(listEl) listEl.innerHTML = buildFormatListHTML();
  updateInvoiceFormatSelectors();
  showToast('デフォルトフォーマットを変更しました', 'success');
}

// フォーマット編集
// フォーマット編集（名前インライン編集を起動）
function invEditFormat(id) {
  // 他の行の編集をすべてキャンセル
  document.querySelectorAll('.inv-fmt-name-area').forEach(function(area) {
    var fid = area.getAttribute('data-fid');
    if (fid !== id) invCancelFormatNameEdit(fid, true);
  });

  var area = document.querySelector('.inv-fmt-name-area[data-fid="'+id+'"]');
  if (!area) return;
  var display = area.querySelector('.inv-fmt-name-display');
  var edit    = area.querySelector('.inv-fmt-name-edit');
  var editBtn = document.querySelector('.inv-fmt-edit-btn[data-fid="'+id+'"]');
  if (display) display.style.display = 'none';
  if (edit)    { edit.style.display = 'flex'; }
  if (editBtn) { editBtn.textContent = '—'; editBtn.style.color = 'var(--text-muted)'; }

  // inputにフォーカス＆全選択
  var input = area.querySelector('.inv-fmt-name-input');
  if (input) { setTimeout(function(){ input.focus(); input.select(); }, 30); }

  // あわせてフォーマット選択状態も更新
  invSelectFormat(id);
}

// フォーマット名保存
function invSaveFormatName(id, newName) {
  var name = (newName || '').trim();
  if (!name) return;
  var f = getInvFormat(id);
  if (!f) return;
  f.name = name;
  f.updatedAt = new Date().toLocaleDateString('ja-JP');

  // リスト再描画
  var listEl = document.getElementById('inv-format-list');
  if (listEl) listEl.innerHTML = buildFormatListHTML();
  // 「編集中」バーのフォーマット名も更新
  var nameInput = document.getElementById('inv-format-name-input');
  if (nameInput && window._currentEditFormatId === id) nameInput.value = name;
  // セレクター更新
  updateInvoiceFormatSelectors();
  showToast('フォーマット名を「'+name+'」に変更しました', 'success');
}

// フォーマット名編集キャンセル
function invCancelFormatNameEdit(id, silent) {
  var area = document.querySelector('.inv-fmt-name-area[data-fid="'+id+'"]');
  if (!area) return;
  var display = area.querySelector('.inv-fmt-name-display');
  var edit    = area.querySelector('.inv-fmt-name-edit');
  var editBtn = document.querySelector('.inv-fmt-edit-btn[data-fid="'+id+'"]');
  if (display) display.style.display = '';
  if (edit)    edit.style.display = 'none';
  if (editBtn) { editBtn.textContent = '編集'; editBtn.style.color = 'var(--sidebar-bg)'; }
  // 入力値を元に戻す
  var f = getInvFormat(id);
  var input = area.querySelector('.inv-fmt-name-input');
  if (input && f) input.value = f.name;
}

// フォーマット削除
function invDeleteFormat(id) {
  if(!confirm('このフォーマットを削除しますか？')) return;
  _invFormats = _invFormats.filter(function(f){ return f.id!==id; });
  var listEl = document.getElementById('inv-format-list');
  if(listEl) listEl.innerHTML = buildFormatListHTML();
  updateInvoiceFormatSelectors();
}

// 新規フォーマット追加
function invAddNewFormat() {
  var newId = 'FMT-' + String(Date.now()).slice(-4);
  _invFormats.push({
    id: newId, name: '新しいフォーマット', isDefault: false,
    color: '#0D4A3A', template: 'standard', taxRate: 10,
    prefix: 'INV', dateFmt: 'YYYYMM', digits: 5, dueRule: '60',
    showInvoiceNo: true,
    remarks: 'お振込先：〇〇銀行 〇〇支店 普通 1234567\n※お支払期限：{{支払期限}}までにお振込をお願いいたします。',
    earlyDiscount: true, bankFee: true,
    updatedAt: new Date().toLocaleDateString('ja-JP')
  });
  var listEl = document.getElementById('inv-format-list');
  if(listEl) listEl.innerHTML = buildFormatListHTML();
  invSelectFormat(newId);
  invEditFormat(newId);
}

// 請求管理ページのフォーマットセレクター更新
function updateInvoiceFormatSelectors() {
  document.querySelectorAll('.inv-format-selector').forEach(function(sel) {
    var cur = sel.value;
    sel.innerHTML = _invFormats.map(function(f){
      var label = f.name + (f.isDefault ? ' ★' : '');
      return '<option value="'+f.id+'"'+(f.id===cur?' selected':'')+'>'+label+'</option>';
    }).join('');
    // value が空や不一致の場合は先頭に合わせる
    if (!sel.value && _invFormats.length) sel.value = _invFormats[0].id;
  });
}

var _invFormats = _invFormats; // 参照維持