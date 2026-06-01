    // ══ 顧客管理データ ══

    // 取引先（案件一覧と連動）
    const clientMasterData = [
      { id:'CL-001', defaultFormatId:'FMT-001', name:'株式会社○○商事', area:'埼玉県川口市', contact:'山田 花子', tel:'048-111-2222', email:'y.hanako@marumarushouji.co.jp', type:'定期', cases:['20240524001','20240524101','20240524001','20240523090','20240522080','20240521070'] },
      { id:'CL-002', defaultFormatId:'FMT-002', name:'△△食品株式会社', area:'千葉県船橋市', contact:'鈴木 一郎', tel:'047-333-4444', email:'suzuki@sansankm.co.jp', type:'定期', cases:['20240524002','20240524100','20240522055','20240520040'] },
      { defaultFormatId:'FMT-001', id:'CL-003', name:'株式会社□□製作所', area:'茨城県つくば市', contact:'佐藤 二郎', tel:'029-555-6666', email:'sato@kakukakus.co.jp', type:'スポット', cases:['20240524003','20240518020'] },
      { defaultFormatId:'FMT-001', id:'CL-004', name:'◇◇アパレル株式会社', area:'東京都渋谷区', contact:'田中 三郎', tel:'03-7777-8888', email:'tanaka@hirahira.co.jp', type:'スポット', cases:['20240524004','20240519030'] },
      { defaultFormatId:'FMT-001', id:'CL-005', name:'関西化学工業株式会社', area:'大阪府大阪市', contact:'伊藤 四郎', tel:'06-9999-0000', email:'ito@kansaichem.co.jp', type:'チャーター', cases:['20240524104','20240510010'] },
      { defaultFormatId:'FMT-001', id:'CL-006', name:'九州青果株式会社', area:'福岡県福岡市', contact:'渡辺 五郎', tel:'092-1111-2222', email:'watanabe@kyushuseiqa.co.jp', type:'定期', cases:['20240524105','20240524200','20240522150'] },
      { defaultFormatId:'FMT-001', id:'CL-007', name:'東北精密機械株式会社', area:'宮城県仙台市', contact:'中村 六郎', tel:'022-3333-4444', email:'nakamura@tohokusm.co.jp', type:'特殊', cases:['20240524106','20240515005'] },
      { defaultFormatId:'FMT-001', id:'CL-008', name:'北海道産直食品', area:'東京都江東区', contact:'小林 七郎', tel:'03-5555-6666', email:'kobayashi@hokkaido-d.co.jp', type:'冷蔵', cases:['20240524103','20240521130','20240519100'] },
      { defaultFormatId:'FMT-001', id:'CL-009', name:'XYZ物産株式会社', area:'東京都品川区', contact:'加藤 八郎', tel:'03-7777-1111', email:'kato@xyzbusan.co.jp', type:'スポット', cases:['20240523099','20240520080'] },
      { defaultFormatId:'FMT-001', id:'CL-010', name:'南関東物流株式会社', area:'神奈川県横浜市', contact:'吉田 九郎', tel:'045-2222-3333', email:'yoshida@minamikanto.co.jp', type:'定期', cases:['20240522120','20240521110','20240520090','20240519070'] },
      { defaultFormatId:'FMT-001', id:'CL-011', name:'中部機材センター株式会社', area:'愛知県名古屋市', contact:'山本 十郎', tel:'052-4444-5555', email:'yamamoto@chubu-kizai.co.jp', type:'スポット', cases:['20240521095','20240517040'] },
      { defaultFormatId:'FMT-001', id:'CL-012', name:'首都圏生活協同組合', area:'東京都新宿区', contact:'松本 十一', tel:'03-6666-7777', email:'matsumoto@shutoken-coop.or.jp', type:'定期', cases:['20240520085','20240519065','20240518045','20240517025','20240516015'] },
      { defaultFormatId:'FMT-001', id:'CL-013', name:'大阪港湾物流株式会社', area:'大阪府大阪市', contact:'井上 十二', tel:'06-8888-9999', email:'inoue@osaka-kowan.co.jp', type:'チャーター', cases:['20240519055','20240512003'] },
      { defaultFormatId:'FMT-001', id:'CL-014', name:'東京精工株式会社', area:'東京都大田区', contact:'木村 十三', tel:'03-1111-2222', email:'kimura@tokyoseiko.co.jp', type:'特殊', cases:['20240518035','20240511001'] },
      { defaultFormatId:'FMT-001', id:'CL-015', name:'全国食品流通株式会社', area:'埼玉県さいたま市', contact:'清水 十四', tel:'048-3333-4444', email:'shimizu@zenkoku-shokuhin.co.jp', type:'定期', cases:['20240517030','20240516020','20240515010','20240514005'] },
    ];

    // 協力会社
    const partnerMasterData = [
      { id:'PT-001', name:'北関東物流株式会社', area:'埼玉県熊谷市', contact:'安藤 清志', tel:'048-222-3333', email:'ando@kitatrans.co.jp', vehicleTypes:['4tウィング','2tトラック'], cases:['20240524100','20240521110'] },
      { id:'PT-002', name:'東海急送株式会社', area:'静岡県浜松市', contact:'伊勢 誠一', tel:'053-444-5555', email:'ise@tokakyuso.co.jp', vehicleTypes:['10tトラック','4tウィング'], cases:['20240519055','20240515010'] },
      { id:'PT-003', name:'九州ネット輸送株式会社', area:'福岡県北九州市', contact:'岡部 雄介', tel:'093-666-7777', email:'okabe@kyunet.co.jp', vehicleTypes:['4tウィング','冷蔵車'], cases:['20240524105'] },
      { id:'PT-004', name:'中央フレート株式会社', area:'東京都江戸川区', contact:'桐島 和也', tel:'03-8888-9999', email:'kirishima@chuo-freight.co.jp', vehicleTypes:['軽バン','2tトラック'], cases:['20240522120','20240520080'] },
      { id:'PT-005', name:'北海道運輸株式会社', area:'北海道札幌市', contact:'本間 浩二', tel:'011-000-1111', email:'honma@hokkaido-unyu.co.jp', vehicleTypes:['10tトラック','冷蔵車'], cases:['20240521095'] },
      { id:'PT-006', name:'関西エクスプレス株式会社', area:'大阪府堺市', contact:'丸山 隆司', tel:'072-222-3333', email:'maruyama@kansai-ex.co.jp', vehicleTypes:['4tウィング','チャーター'], cases:['20240513002'] },
    ];

    // 全案件一覧（未処理+処理中+処理済み+過去案件）
    const allCasesMasterData = [
      // 未処理
      { id:'20240524001', client:'株式会社○○商事',      from:'埼玉県川口市',   to:'神奈川県横浜市', pattern:'定期案件',    status:'未処理', deadline:'05/25 AM', sales:null },
      { id:'20240524002', client:'△△食品株式会社',      from:'千葉県船橋市',   to:'東京都大田区',   pattern:'特殊条件案件', status:'未処理', deadline:'05/24 PM', sales:null },
      { id:'20240524003', client:'株式会社□□製作所',   from:'茨城県つくば市', to:'愛知県名古屋市', pattern:'チャーター案件',status:'未処理', deadline:'05/25 終日', sales:null },
      { id:'20240524004', client:'◇◇アパレル株式会社', from:'東京都渋谷区',   to:'大阪府大阪市',   pattern:'スポット案件', status:'未処理', deadline:'05/26 AM', sales:null },
      // 処理中
      { id:'20240524101', client:'株式会社○○商事',      from:'埼玉県川口市',   to:'神奈川県横浜市', pattern:'定期案件',    status:'処理中',  deadline:'05/25 AM', sales:null },
      { id:'20240524103', client:'北海道産直食品',        from:'東京都江東区',   to:'千葉県千葉市',   pattern:'スポット案件', status:'処理中',  deadline:'05/24 夜', sales:null },
      { id:'20240524104', client:'関西化学工業株式会社', from:'東京都品川区',   to:'大阪府大阪市',   pattern:'チャーター案件',status:'処理中',  deadline:'05/26 AM', sales:null },
      { id:'20240524105', client:'九州青果株式会社',      from:'福岡県福岡市',   to:'東京都中央区',   pattern:'特殊条件案件', status:'処理中',  deadline:'05/25 夕方', sales:null },
      { id:'20240524106', client:'東北精密機械株式会社', from:'宮城県仙台市',   to:'神奈川県川崎市', pattern:'特殊条件案件', status:'処理中',  deadline:'05/27 AM', sales:null },
      // 処理済み
      { id:'20240524100', client:'△△食品株式会社',      from:'千葉県船橋市',   to:'東京都大田区',   pattern:'特殊条件案件', status:'完了',    deadline:'05/24',    sales:38000 },
      { id:'20240523099', client:'XYZ物産株式会社',       from:'東京都品川区',   to:'埼玉県さいたま市',pattern:'スポット案件', status:'完了',    deadline:'05/23',    sales:22000 },
      // 過去案件
      { id:'20240522120', client:'南関東物流株式会社',   from:'神奈川県横浜市', to:'東京都新宿区',   pattern:'定期案件',    status:'過去',    deadline:'05/22',    sales:31000 },
      { id:'20240521130', client:'北海道産直食品',        from:'東京都江東区',   to:'千葉県千葉市',   pattern:'定期案件',    status:'過去',    deadline:'05/21',    sales:27000 },
      { id:'20240521110', client:'南関東物流株式会社',   from:'神奈川県川崎市', to:'埼玉県川口市',   pattern:'定期案件',    status:'過去',    deadline:'05/21',    sales:28000 },
      { id:'20240521095', client:'中部機材センター株式会社',from:'愛知県名古屋市',to:'東京都港区',   pattern:'スポット案件', status:'過去',    deadline:'05/21',    sales:52000 },
      { id:'20240520090', client:'南関東物流株式会社',   from:'東京都品川区',   to:'神奈川県横浜市', pattern:'定期案件',    status:'過去',    deadline:'05/20',    sales:19000 },
      { id:'20240520085', client:'首都圏生活協同組合',   from:'東京都新宿区',   to:'埼玉県さいたま市',pattern:'多地点配送',  status:'過去',    deadline:'05/20',    sales:64000 },
      { id:'20240519055', client:'大阪港湾物流株式会社', from:'大阪府大阪市',   to:'東京都江東区',   pattern:'チャーター案件',status:'過去',    deadline:'05/19',    sales:88000 },
      { id:'20240519065', client:'首都圏生活協同組合',   from:'東京都新宿区',   to:'千葉県千葉市',   pattern:'多地点配送',  status:'過去',    deadline:'05/19',    sales:47000 },
      { id:'20240518035', client:'東京精工株式会社',      from:'東京都大田区',   to:'埼玉県川口市',   pattern:'特殊条件案件', status:'過去',    deadline:'05/18',    sales:35000 },
    ];

    let currentCustTab = 'client';
    let selectedClientId = null;
    let selectedPartnerId = null;

    function switchCustTab(tab) {
      currentCustTab = tab;
      ['client','partner','cases'].forEach(t => {
        const btn = document.getElementById('ctab-'+t);
        const panel = document.getElementById('cust-panel-'+t);
        const isActive = t === tab;
        btn.style.borderBottom = isActive ? '3px solid var(--sidebar-bg)' : '3px solid transparent';
        btn.style.color = isActive ? 'var(--sidebar-bg)' : 'var(--text-secondary)';
        const countSpan = document.getElementById('ctab-'+t+'-count');
        if(countSpan){ countSpan.style.background = isActive ? 'var(--sidebar-bg)' : '#e5e7eb'; countSpan.style.color = isActive ? '#fff' : 'var(--text-secondary)'; }
        if(panel){ if(isActive){ panel.style.display='flex'; panel.style.flexDirection=(t==='cases')?'column':'row'; } else { panel.style.display='none'; } }
      });
      if(tab==='client') { clientCheckedIds.clear(); renderClientList(); }
      if(tab==='partner') { partnerCheckedIds.clear(); renderCustPartnerList(); }
      if(tab==='cases') custRenderAllCases();
      custFilterCustomer();
    }

    function custFilterCustomer() {
      const q = (document.getElementById('cust-search')?.value||'').trim().toLowerCase();
      if(currentCustTab==='client') renderClientList(q);
      if(currentCustTab==='partner') renderCustPartnerList(q);
    }

    function renderClientList(q) {
      const el = document.getElementById('client-list');
      if(!el) return;
      let data = clientMasterData;
      if(q) data = data.filter(c => c.name.toLowerCase().includes(q)||c.id.toLowerCase().includes(q));
      document.getElementById('client-list-count').textContent = data.length + '社';
      el.innerHTML = data.map(c => {
        const isSelected = c.id === selectedClientId;
        const isChecked = clientCheckedIds.has(c.id);
        const initials = c.name.replace(/[株式会社|有限会社|合同会社]/g,'').trim().slice(0,2);
        return '<div class="cust-list-item'+(isSelected?' selected':'')+(isChecked?' cust-checked':'') + '" onclick="custSelectClient(\''+c.id+'\')">'
          +'<input type="checkbox" class="cust-cb" '+(isChecked?'checked':'')+' onclick="event.stopPropagation();toggleClientCheck(\''+c.id+'\',this.checked)" style="width:15px;height:15px;cursor:pointer;accent-color:var(--sidebar-bg);flex-shrink:0;margin-right:2px">'
          +'<div class="cust-avatar">'+initials+'</div>'
          +'<div class="cust-info">'
            +'<div class="cust-name">'+c.name+'</div>'
            +'<div class="cust-id-label">'+c.id+' ｜ '+c.area+'</div>'
            +'<div class="cust-meta">担当：'+c.contact+'</div>'
          +'</div>'
          +'<div class="cust-case-count"><div class="cust-case-num">'+c.cases.length+'</div><div class="cust-case-label">件</div></div>'
        +'</div>';
      }).join('') || '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">該当なし</div>';
      updateClientBulkBar();
    }

    function custSelectClient(id) {
      selectedClientId = id;
      renderClientList((document.getElementById('cust-search')?.value||'').toLowerCase());
      renderClientDetail(id);
    }

    function renderClientDetail(id, editMode) {
      const c = clientMasterData.find(x=>x.id===id);
      if(!c) return;
      const el = document.getElementById('client-detail');
      const typeColors = {定期:'#0D4A3A',スポット:'#2563eb',チャーター:'#d97706',特殊:'#7c3aed',冷蔵:'#0891b2'};
      const typeColor = typeColors[c.type]||'#6b7280';
      const initials = c.name.replace(/[株式会社|有限会社|合同会社]/g,'').trim().slice(0,2);
      const caseRows = c.cases.map(cid => {
        const cas = allCasesMasterData.find(x=>x.id===cid);
        if(!cas) return '<div style="padding:6px 0;font-size:12px;color:var(--text-muted)">'+cid+'</div>';
        const stCls = cas.status==='未処理'?'cust-badge-unprocessed':cas.status==='処理中'?'cust-badge-processing':cas.status==='完了'?'cust-badge-done':'cust-badge-old';
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;margin-bottom:4px;background:#f9fafb;border:1px solid #f3f4f6">'
          +'<div style="font-size:11px;font-family:\'Inter\',sans-serif;color:var(--text-muted);width:130px;flex-shrink:0">'+cas.id+'</div>'
          +'<div style="flex:1;font-size:12px;color:var(--text-secondary)">'+cas.from+' → '+cas.to+'</div>'
          +'<div style="font-size:11px;color:var(--text-muted);margin-right:8px">'+cas.deadline+'</div>'
          +'<span class="cust-status-badge '+stCls+'">'+cas.status+'</span>'
        +'</div>';
      }).join('');

      if(editMode) {
        // ── 編集モード ──
        el.innerHTML = '<div class="detail-card" style="margin-bottom:16px">'
          +'<div class="detail-card-header" style="background:var(--sidebar-bg);padding:14px 16px;border-radius:0">'
            +'<div style="width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,0.15);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;flex-shrink:0">'+initials+'</div>'
            +'<div style="flex:1;min-width:0;margin-left:12px">'
              +'<div style="font-size:13px;font-weight:700;color:#fff">編集モード</div>'
              +'<div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:1px">'+c.id+'</div>'
            +'</div>'
            +'<div style="display:flex;gap:8px">'
              +'<button onclick="saveClientEdit(\''+c.id+'\')" style="padding:7px 16px;background:#3BB888;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px">'
                +'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>'
                +'保存'
              +'</button>'
              +'<button onclick="renderClientDetail(\''+c.id+'\')" style="padding:7px 14px;background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">キャンセル</button>'
            +'</div>'
          +'</div>'
          +'<div class="detail-card-body">'
            +'<div class="form-row"><div class="form-group"><label class="form-label">会社名 <span class="req">*</span></label><input class="form-input" id="edit-cl-name" value="'+c.name+'"></div>'
            +'<div class="form-group"><label class="form-label">所在地</label><input class="form-input" id="edit-cl-area" value="'+c.area+'"></div></div>'
            +'<div class="form-row"><div class="form-group"><label class="form-label">担当者名</label><input class="form-input" id="edit-cl-contact" value="'+c.contact+'"></div>'
            +'<div class="form-group"><label class="form-label">TEL</label><input class="form-input" id="edit-cl-tel" value="'+c.tel+'"></div></div>'
            +'<div class="form-row"><div class="form-group"><label class="form-label">メールアドレス</label><input class="form-input" id="edit-cl-email" value="'+c.email+'"></div>'
            +'<div class="form-group"><label class="form-label">取引種別</label>'
            +'<select class="form-select" id="edit-cl-type">'
            +'<option'+(c.type==='定期'?' selected':'')+'>定期</option>'
            +'<option'+(c.type==='スポット'?' selected':'')+'>スポット</option>'
            +'<option'+(c.type==='チャーター'?' selected':'')+'>チャーター</option>'
            +'<option'+(c.type==='特殊'?' selected':'')+'>特殊</option>'
            +'<option'+(c.type==='冷蔵'?' selected':'')+'>冷蔵</option>'
            +'</select></div></div>'
          +'</div>'
        +'</div>'
        +'<div class="detail-card">'
          +'<div class="detail-card-header"><div class="detail-card-title">📋 過去の案件一覧 ('+c.cases.length+'件)</div></div>'
          +'<div class="detail-card-body">'+caseRows+'</div>'
        +'</div>';
      } else {
        // ── 表示モード ──
        el.innerHTML = '<div class="detail-card" style="margin-bottom:16px">'
          +'<div class="detail-card-header">'
            +'<div style="width:44px;height:44px;border-radius:12px;background:var(--sidebar-bg);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;flex-shrink:0">'+initials+'</div>'
            +'<div style="flex:1;min-width:0;margin-left:12px">'
              +'<div style="font-size:15px;font-weight:700;color:var(--text-primary)">'+c.name+'</div>'
              +'<div style="font-size:11px;color:var(--text-muted);margin-top:2px">'+c.id+' ｜ '+c.area+'</div>'
            +'</div>'
            +'<span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:10px;background:'+typeColor+';color:#fff;margin-right:8px">'+c.type+'</span>'
            +'<button onclick="renderClientDetail(\''+c.id+'\',true)" style="padding:6px 14px;background:#fff;color:var(--sidebar-bg);border:1.5px solid var(--sidebar-bg);border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px;white-space:nowrap">'
              +'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
              +'編集'
            +'</button>'
          +'</div>'
          +'<div class="detail-card-body">'
            +'<div class="info-grid">'
              +'<div class="info-item"><div class="info-label">担当者名</div><div class="info-value">'+c.contact+'</div></div>'
              +'<div class="info-item"><div class="info-label">TEL</div><div class="info-value">'+c.tel+'</div></div>'
              +'<div class="info-item"><div class="info-label">メール</div><div class="info-value" style="font-size:12px">'+c.email+'</div></div>'
              +'<div class="info-item"><div class="info-label">所在地</div><div class="info-value">'+c.area+'</div></div>'
            +'</div>'
          +'</div>'
        +'</div>'

        // デフォルト請求書フォーマットカード
        +'<div class="detail-card" style="margin-bottom:16px">'
          +'<div class="detail-card-header">'
            +'<div class="detail-card-title" style="display:flex;align-items:center;gap:6px">'
              +'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
              +'デフォルト請求書フォーマット'
            +'</div>'
          +'</div>'
          +'<div class="detail-card-body">'
            +'<p style="font-size:11px;color:var(--text-muted);margin-bottom:10px">この取引先への請求書発行時に自動で選択されるフォーマットを設定します。</p>'
            +'<div style="display:flex;align-items:center;gap:10px">'
              +'<select id="cl-default-fmt-sel" class="settings-form-select inv-format-selector" style="flex:1" onchange="saveClientDefaultFormat(\''+c.id+'\',this.value)">'
              +'</select>'
              +'<span style="font-size:11px;color:var(--text-muted)">現在：<strong style="color:var(--sidebar-bg)" id="cl-fmt-current-name">'+
                (function(){ var f=getInvFormat(c.defaultFormatId); return f?f.name:'スタンダード'; }())
              +'</strong></span>'
            +'</div>'
          +'</div>'
        +'</div>'

        +'<div class="detail-card">'
          +'<div class="detail-card-header"><div class="detail-card-title">📋 過去の案件一覧 ('+c.cases.length+'件)</div></div>'
          +'<div class="detail-card-body">'+caseRows+'</div>'
        +'</div>';

        // フォーマットセレクター初期化
        setTimeout(function(){
          updateInvoiceFormatSelectors();
          var sel = document.getElementById('cl-default-fmt-sel');
          if (sel && c.defaultFormatId) sel.value = c.defaultFormatId;
        }, 30);
      }
    }

    function saveClientDefaultFormat(clientId, fmtId) {
      var c = clientMasterData.find(function(x){ return x.id === clientId; });
      if (!c) return;
      c.defaultFormatId = fmtId;
      var f = getInvFormat(fmtId);
      var nameEl = document.getElementById('cl-fmt-current-name');
      if (nameEl && f) nameEl.textContent = f.name;
      showToast('デフォルトフォーマットを「'+(f?f.name:'')+'」に設定しました', 'success');
    }

    function saveClientEdit(id) {
      const c = clientMasterData.find(x=>x.id===id);
      if(!c) return;
      const name = document.getElementById('edit-cl-name')?.value.trim();
      if(!name){ showToast('会社名は必須です','error'); return; }
      c.name    = name;
      c.area    = document.getElementById('edit-cl-area')?.value.trim()    || c.area;
      c.contact = document.getElementById('edit-cl-contact')?.value.trim() || c.contact;
      c.tel     = document.getElementById('edit-cl-tel')?.value.trim()     || c.tel;
      c.email   = document.getElementById('edit-cl-email')?.value.trim()   || c.email;
      c.type    = document.getElementById('edit-cl-type')?.value           || c.type;
      renderClientList((document.getElementById('cust-search')?.value||'').toLowerCase());
      renderClientDetail(id);
      showToast('保存しました','success');
    }

    function renderCustPartnerList(q) {
      const el = document.getElementById('cust-partner-list');
      if(!el) return;
      let data = partnerMasterData;
      if(q) data = data.filter(c => c.name.toLowerCase().includes(q)||c.id.toLowerCase().includes(q));
      document.getElementById('partner-list-count').textContent = data.length + '社';
      el.innerHTML = data.map(c => {
        const isSelected = c.id === selectedPartnerId;
        const isChecked = partnerCheckedIds.has(c.id);
        const initials = c.name.replace(/[株式会社|有限会社]/g,'').trim().slice(0,2);
        return '<div class="cust-list-item'+(isSelected?' selected':'')+(isChecked?' cust-checked':'') + '" onclick="custSelectPartner(\''+c.id+'\')">'
          +'<input type="checkbox" class="cust-cb" '+(isChecked?'checked':'')+' onclick="event.stopPropagation();togglePartnerCheck(\''+c.id+'\',this.checked)" style="width:15px;height:15px;cursor:pointer;accent-color:#1e40af;flex-shrink:0;margin-right:2px">'
          +'<div class="cust-avatar partner">'+initials+'</div>'
          +'<div class="cust-info">'
            +'<div class="cust-name">'+c.name+'</div>'
            +'<div class="cust-id-label">'+c.id+' ｜ '+c.area+'</div>'
            +'<div class="cust-meta" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:3px">'+c.vehicleTypes.map(v=>'<span style="font-size:9px;background:#dbeafe;color:#1e40af;padding:1px 6px;border-radius:4px;font-weight:600">'+v+'</span>').join('')+'</div>'
          +'</div>'
          +'<div class="cust-case-count"><div class="cust-case-num" style="color:#1e40af">'+c.cases.length+'</div><div class="cust-case-label">依頼</div></div>'
        +'</div>';
      }).join('') || '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">該当なし</div>';
      updatePartnerBulkBar();
    }

    function custSelectPartner(id) {
      selectedPartnerId = id;
      renderCustPartnerList((document.getElementById('cust-search')?.value||'').toLowerCase());
      renderPartnerDetail(id);
    }

    function renderPartnerDetail(id, editMode) {
      const c = partnerMasterData.find(x=>x.id===id);
      if(!c) return;
      const el = document.getElementById('partner-detail');
      const initials = c.name.replace(/[株式会社|有限会社]/g,'').trim().slice(0,2);
      const allVehicleTypes = ['軽バン','2tトラック','4tウィング','4t平車','10tトラック','冷蔵車','チャーター'];
      const caseRows = c.cases.map(cid => {
        const cas = allCasesMasterData.find(x=>x.id===cid);
        if(!cas) return '<div style="padding:6px 0;font-size:12px;color:var(--text-muted)">'+cid+'</div>';
        const stCls = cas.status==='未処理'?'cust-badge-unprocessed':cas.status==='処理中'?'cust-badge-processing':cas.status==='完了'?'cust-badge-done':'cust-badge-old';
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;margin-bottom:4px;background:#f9fafb;border:1px solid #f3f4f6">'
          +'<div style="font-size:11px;font-family:\'Inter\',sans-serif;color:var(--text-muted);width:130px;flex-shrink:0">'+cas.id+'</div>'
          +'<div style="flex:1;font-size:12px;color:var(--text-secondary)">'+cas.from+' → '+cas.to+'</div>'
          +'<div style="font-size:11px;color:var(--text-muted);margin-right:8px">'+cas.deadline+'</div>'
          +'<span class="cust-status-badge '+stCls+'">'+cas.status+'</span>'
        +'</div>';
      }).join('');

      if(editMode) {
        // ── 編集モード ──
        const vtChecks = allVehicleTypes.map(v =>
          '<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;padding:4px 0">'
          +'<input type="checkbox" value="'+v+'" '+(c.vehicleTypes.includes(v)?'checked':'')+' style="accent-color:#1e40af;width:14px;height:14px"> '+v+'</label>'
        ).join('');
        el.innerHTML = '<div class="detail-card" style="margin-bottom:16px">'
          +'<div class="detail-card-header" style="background:#1e3a8a;padding:14px 16px;border-radius:0">'
            +'<div style="width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,0.15);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;flex-shrink:0">'+initials+'</div>'
            +'<div style="flex:1;min-width:0;margin-left:12px">'
              +'<div style="font-size:13px;font-weight:700;color:#fff">編集モード</div>'
              +'<div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:1px">'+c.id+'</div>'
            +'</div>'
            +'<div style="display:flex;gap:8px">'
              +'<button onclick="savePartnerEdit(\''+c.id+'\')" style="padding:7px 16px;background:#3BB888;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px">'
                +'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>'
                +'保存'
              +'</button>'
              +'<button onclick="renderPartnerDetail(\''+c.id+'\')" style="padding:7px 14px;background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">キャンセル</button>'
            +'</div>'
          +'</div>'
          +'<div class="detail-card-body">'
            +'<div class="form-row"><div class="form-group"><label class="form-label">会社名 <span class="req">*</span></label><input class="form-input" id="edit-pt-name" value="'+c.name+'"></div>'
            +'<div class="form-group"><label class="form-label">所在地</label><input class="form-input" id="edit-pt-area" value="'+c.area+'"></div></div>'
            +'<div class="form-row"><div class="form-group"><label class="form-label">担当者名</label><input class="form-input" id="edit-pt-contact" value="'+c.contact+'"></div>'
            +'<div class="form-group"><label class="form-label">TEL</label><input class="form-input" id="edit-pt-tel" value="'+c.tel+'"></div></div>'
            +'<div class="form-row full"><div class="form-group"><label class="form-label">メールアドレス</label><input class="form-input" id="edit-pt-email" value="'+c.email+'"></div></div>'
            +'<div class="form-row full"><div class="form-group"><label class="form-label">対応車格</label>'
            +'<div id="edit-pt-vtypes" style="display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:6px">'+vtChecks+'</div></div></div>'
          +'</div>'
        +'</div>'
        +'<div class="detail-card">'
          +'<div class="detail-card-header"><div class="detail-card-title">📋 過去の依頼案件 ('+c.cases.length+'件)</div></div>'
          +'<div class="detail-card-body">'+caseRows+'</div>'
        +'</div>';
      } else {
        // ── 表示モード ──
        el.innerHTML = '<div class="detail-card" style="margin-bottom:16px">'
          +'<div class="detail-card-header">'
            +'<div style="width:44px;height:44px;border-radius:12px;background:#1e40af;color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;flex-shrink:0">'+initials+'</div>'
            +'<div style="flex:1;min-width:0;margin-left:12px">'
              +'<div style="font-size:15px;font-weight:700;color:var(--text-primary)">'+c.name+'</div>'
              +'<div style="font-size:11px;color:var(--text-muted);margin-top:2px">'+c.id+' ｜ '+c.area+'</div>'
            +'</div>'
            +'<button onclick="renderPartnerDetail(\''+c.id+'\',true)" style="padding:6px 14px;background:#fff;color:#1e40af;border:1.5px solid #1e40af;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px;white-space:nowrap">'
              +'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
              +'編集'
            +'</button>'
          +'</div>'
          +'<div class="detail-card-body">'
            +'<div class="info-grid">'
              +'<div class="info-item"><div class="info-label">担当者</div><div class="info-value">'+c.contact+'</div></div>'
              +'<div class="info-item"><div class="info-label">TEL</div><div class="info-value">'+c.tel+'</div></div>'
              +'<div class="info-item"><div class="info-label">メール</div><div class="info-value" style="font-size:12px">'+c.email+'</div></div>'
              +'<div class="info-item"><div class="info-label">所在地</div><div class="info-value">'+c.area+'</div></div>'
            +'</div>'
            +'<div style="margin-top:12px"><div class="info-label" style="margin-bottom:6px">対応車格</div>'
            +'<div style="display:flex;gap:6px;flex-wrap:wrap">'+c.vehicleTypes.map(v=>'<span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:6px;background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe">'+v+'</span>').join('')+'</div></div>'
          +'</div>'
        +'</div>'
        +'<div class="detail-card">'
          +'<div class="detail-card-header"><div class="detail-card-title">📋 過去の依頼案件 ('+c.cases.length+'件)</div></div>'
          +'<div class="detail-card-body">'+caseRows+'</div>'
        +'</div>';
      }
    }

    function savePartnerEdit(id) {
      const c = partnerMasterData.find(x=>x.id===id);
      if(!c) return;
      const name = document.getElementById('edit-pt-name')?.value.trim();
      if(!name){ showToast('会社名は必須です','error'); return; }
      c.name    = name;
      c.area    = document.getElementById('edit-pt-area')?.value.trim()    || c.area;
      c.contact = document.getElementById('edit-pt-contact')?.value.trim() || c.contact;
      c.tel     = document.getElementById('edit-pt-tel')?.value.trim()     || c.tel;
      c.email   = document.getElementById('edit-pt-email')?.value.trim()   || c.email;
      const checked = document.querySelectorAll('#edit-pt-vtypes input[type=checkbox]:checked');
      c.vehicleTypes = Array.from(checked).map(cb=>cb.value);
      if(!c.vehicleTypes.length) c.vehicleTypes = ['未設定'];
      renderCustPartnerList((document.getElementById('cust-search')?.value||'').toLowerCase());
      renderPartnerDetail(id);
      showToast('保存しました','success');
    }

    function custFilterAllCases() {
      const pat = document.getElementById('cases-pattern-filter')?.value||'all';
      const sts = document.getElementById('cases-status-filter')?.value||'all';
      const cli = document.getElementById('cases-client-filter')?.value||'all';
      const el = document.getElementById('all-cases-list');
      if(!el) return;
      let data = allCasesMasterData;
      if(pat!=='all') data = data.filter(c=>c.pattern===pat);
      if(sts!=='all') data = data.filter(c=>c.status===sts);
      if(cli!=='all') data = data.filter(c=>c.client===cli);
      const lbl = document.getElementById('cases-count-label');
      if(lbl) lbl.textContent = data.length+'件';
      const statusCls = {未処理:'cust-badge-unprocessed',処理中:'cust-badge-processing',完了:'cust-badge-done',過去:'cust-badge-old'};
      el.innerHTML = data.map(c =>
        '<div class="case-row">'
          +'<div class="case-row-id">'+c.id+'</div>'
          +'<div><div class="case-row-client">'+c.client+'</div><div class="case-row-route">'+c.from+' → '+c.to+'</div></div>'
          +'<div><span class="cust-pattern-chip">'+c.pattern+'</span></div>'
          +'<div style="font-size:11px;color:var(--text-secondary)">'+c.deadline+'</div>'
          +'<div style="font-size:12px;font-weight:700;font-family:\'Inter\',sans-serif;color:var(--sidebar-bg)">'+(c.sales?'¥'+c.sales.toLocaleString():'—')+'</div>'
          +'<div><span class="cust-status-badge '+(statusCls[c.status]||'cust-badge-old')+'">'+c.status+'</span></div>'
        +'</div>'
      ).join('') || '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">該当する案件はありません</div>';
    }

    function custRenderAllCases() {
      // 取引先フィルターの選択肢を生成
      const sel = document.getElementById('cases-client-filter');
      if(sel && sel.options.length<=1) {
        const clients = [...new Set(allCasesMasterData.map(c=>c.client))];
        clients.forEach(cl => { const o=document.createElement('option'); o.value=cl; o.textContent=cl; sel.appendChild(o); });
      }
      custFilterAllCases();
    }

    // スプリッター（顧客管理用）
    (function(){
      function initSplitter(splitterId, leftSelector) {
        setTimeout(function(){
          const sp = document.getElementById(splitterId);
          if(!sp) return;
          let drag = false, startX, startW;
          sp.addEventListener('mousedown', function(e){
            drag=true; startX=e.clientX;
            const left = sp.previousElementSibling;
            startW = left.offsetWidth;
            sp.classList.add('dragging');
            document.body.style.userSelect='none';
          });
          document.addEventListener('mousemove', function(e){
            if(!drag) return;
            const left = sp.previousElementSibling;
            const newW = Math.max(240,Math.min(700, startW+(e.clientX-startX)));
            left.style.width = newW+'px';
          });
          document.addEventListener('mouseup', function(){ drag=false; sp.classList.remove('dragging'); document.body.style.userSelect=''; });
        }, 300);
      }
      initSplitter('splitter-cust-client');
      initSplitter('splitter-cust-partner');
    })();



    // ── CSVインポートボタン（ヘッダー）→ モーダルのCSVタブを直接開く ──
    function openCustCsvImport() {
      openCustAddModal();
      setTimeout(() => switchCustModalTab('csv'), 30);
    }

    // ── CSVエクスポート ──
    function exportCustCsv() {
      const tab = window.currentCustTab || 'client';
      let headers, rows, filename;
      if(tab === 'partner') {
        headers = ['協力会社ID','会社名','所在地','担当者名','TEL','メールアドレス','対応車格','過去依頼件数'];
        rows = partnerMasterData.map(p => [
          p.id, p.name, p.area, p.contact, p.tel, p.email,
          (p.vehicleTypes||[]).join('|'),
          p.cases.length
        ]);
        filename = 'partner_list.csv';
      } else if(tab === 'cases') {
        headers = ['案件ID','取引先','出発地','目的地','案件パターン','ステータス','納期','売上'];
        rows = allCasesMasterData.map(c => [
          c.id, c.client, c.from, c.to, c.pattern, c.status, c.deadline,
          c.sales ? c.sales : ''
        ]);
        filename = 'cases_list.csv';
      } else {
        headers = ['取引先ID','会社名','所在地','担当者名','TEL','メールアドレス','取引種別','過去案件件数'];
        rows = clientMasterData.map(c => [
          c.id, c.name, c.area, c.contact, c.tel, c.email, c.type, c.cases.length
        ]);
        filename = 'client_list.csv';
      }
      const csv = [headers, ...rows]
        .map(r => r.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(','))
        .join('\n');
      const blob = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      const labels = {client:'取引先', partner:'協力会社', cases:'請負案件'};
      showToast((labels[tab]||'データ') + 'をエクスポートしました', 'success');
    }

    // ══ 顧客管理：新規追加モーダル JS ══
    let custModalMode = 'manual';   // 'manual' | 'csv'
    let custEntryType = 'client';   // 'client' | 'partner'
    let csvEntryType  = 'client';
    let csvParsedData = [];

    function openCustAddModal() {
      const tab = window.currentCustTab || 'client';
      custEntryType = (tab === 'partner') ? 'partner' : 'client';
      csvEntryType  = custEntryType;
      document.getElementById('cust-modal-title').textContent =
        (custEntryType === 'partner') ? '協力会社を追加' : '取引先を追加';
      switchCustModalTab('manual');
      setCustType(custEntryType);
      setCsvType(custEntryType);
      // フォームリセット
      ['cf-name','cf-area','cf-contact','cf-tel','cf-email','cf-note'].forEach(id => {
        const el = document.getElementById(id); if(el) el.value = '';
      });
      const cfType = document.getElementById('cf-type'); if(cfType) cfType.value = '';
      document.querySelectorAll('#cf-vehicle-types input[type=checkbox]').forEach(cb => cb.checked = false);
      csvParsedData = [];
      const pre = document.getElementById('csv-preview-area'); if(pre) pre.style.display = 'none';
      const fi = document.getElementById('csv-file-input'); if(fi) fi.value = '';
      const modal = document.getElementById('cust-add-modal');
      modal.style.display = 'flex';
      requestAnimationFrame(() => modal.classList.add('open'));
    }

    function closeCustAddModal() {
      const modal = document.getElementById('cust-add-modal');
      modal.classList.remove('open');
      modal.style.display = 'none';
    }

    function switchCustModalTab(tab) {
      custModalMode = tab;
      const tabs = ['manual','csv'];
      tabs.forEach(t => {
        const btn = document.getElementById('cust-mtab-'+t);
        const panel = document.getElementById('cust-mpanel-'+t);
        const isActive = t === tab;
        if(btn) {
          btn.style.borderBottom = isActive ? '3px solid var(--accent)' : '3px solid transparent';
          btn.style.color = isActive ? '#fff' : 'rgba(255,255,255,0.45)';
        }
        if(panel) panel.style.display = isActive ? 'block' : 'none';
      });
      const saveBtn = document.getElementById('cust-modal-save-btn');
      if(saveBtn) saveBtn.textContent = tab === 'csv' ? 'インポート実行' : '保存する';
    }

    function setCustType(type) {
      custEntryType = type;
      const types = ['client','partner'];
      types.forEach(t => {
        const btn = document.getElementById('cust-mtype-'+t);
        if(!btn) return;
        const isActive = t === type;
        btn.style.border = isActive ? '2px solid var(--sidebar-bg)' : '2px solid #e5e7eb';
        btn.style.background = isActive ? 'var(--sidebar-bg)' : '#f9fafb';
        btn.style.color = isActive ? '#fff' : 'var(--text-secondary)';
      });
      // 協力会社専用フィールドの切り替え
      const partnerFields = document.getElementById('cf-partner-fields');
      const typeGroup = document.getElementById('cf-type-group');
      if(partnerFields) partnerFields.style.display = type === 'partner' ? 'block' : 'none';
      if(typeGroup) typeGroup.style.display = type === 'client' ? 'block' : 'none';
      document.getElementById('cust-modal-title').textContent =
        type === 'partner' ? '協力会社を追加' : '取引先を追加';
    }

    function setCsvType(type) {
      csvEntryType = type;
      const types = ['client','partner'];
      types.forEach(t => {
        const btn = document.getElementById('csv-mtype-'+t);
        if(!btn) return;
        const isActive = t === type;
        btn.style.border = isActive ? '2px solid var(--sidebar-bg)' : '2px solid #e5e7eb';
        btn.style.background = isActive ? 'var(--sidebar-bg)' : '#f9fafb';
        btn.style.color = isActive ? '#fff' : 'var(--text-secondary)';
      });
      const desc = document.getElementById('csv-template-desc');
      if(desc) {
        desc.textContent = type === 'partner'
          ? '協力会社の登録フォーマット（会社名・所在地・担当者・TEL・メール・対応車格）'
          : '取引先の登録フォーマット（会社名・所在地・担当者・TEL・メール・取引種別）';
      }
      // プレビューをリセット
      csvParsedData = [];
      const pre = document.getElementById('csv-preview-area'); if(pre) pre.style.display = 'none';
      const fi = document.getElementById('csv-file-input'); if(fi) fi.value = '';
    }

    function downloadCsvTemplate() {
      let headers, rows;
      if(csvEntryType === 'partner') {
        headers = ['会社名','所在地','担当者名','TEL','メールアドレス','対応車格(カンマ区切り)'];
        rows = [
          ['北関東物流株式会社','埼玉県熊谷市','安藤 清志','048-222-3333','ando@example.co.jp','4tウィング,2tトラック'],
          ['東海急送株式会社','静岡県浜松市','伊勢 誠一','053-444-5555','ise@example.co.jp','10tトラック'],
        ];
      } else {
        headers = ['会社名','所在地','担当者名','TEL','メールアドレス','取引種別'];
        rows = [
          ['株式会社サンプル商事','東京都新宿区','田中 太郎','03-1234-5678','tanaka@sample.co.jp','定期'],
          ['△△食品株式会社','千葉県船橋市','鈴木 花子','047-111-2222','suzuki@example.co.jp','スポット'],
        ];
      }
      const csv = [headers, ...rows].map(r => r.map(c => '"'+c+'"').join(',')).join('\n');
      const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (csvEntryType==='partner') ? 'partner_template.csv' : 'client_template.csv';
      a.click();
      showToast('テンプレートをダウンロードしました', 'success');
    }

    function handleCsvDrop(e) {
      e.preventDefault();
      const dz = document.getElementById('csv-drop-zone');
      dz.style.borderColor = '#d1d5db'; dz.style.background = '';
      const file = e.dataTransfer.files[0];
      if(file && file.name.endsWith('.csv')) handleCsvFile(file);
      else showToast('CSVファイルを選択してください', 'error');
    }

    function handleCsvFile(file) {
      if(!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        const text = e.target.result.replace(/^\uFEFF/, '');  // BOM除去
        parseCsvPreview(text);
      };
      reader.readAsText(file, 'UTF-8');
    }

    function parseCsvPreview(text) {
      const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
      if(lines.length < 2) {
        showToast('データ行がありません', 'error'); return;
      }
      const parseRow = row => {
        const res = []; let cur = ''; let inQ = false;
        for(let i=0;i<row.length;i++){
          if(row[i]==='"'){ inQ=!inQ; }
          else if(row[i]===','&&!inQ){ res.push(cur.trim()); cur=''; }
          else { cur+=row[i]; }
        }
        res.push(cur.trim()); return res;
      };
      const headers = parseRow(lines[0]);
      const dataRows = lines.slice(1).map(parseRow);
      csvParsedData = dataRows;

      const errEl = document.getElementById('csv-error-msg');
      errEl.style.display = 'none';

      // テーブル生成
      const table = document.getElementById('csv-preview-table');
      const preview5 = dataRows.slice(0,5);
      table.innerHTML =
        '<thead style="background:#f3f4f6"><tr>'+
          headers.map(h=>'<th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--text-secondary);white-space:nowrap;border-bottom:1px solid #e5e7eb">'+h+'</th>').join('')+
        '</tr></thead>'+
        '<tbody>'+
          preview5.map(row=>
            '<tr style="border-bottom:1px solid #f3f4f6">'+
              row.map(cell=>'<td style="padding:6px 10px;font-size:11px;color:var(--text-primary);white-space:nowrap">'+cell+'</td>').join('')+
            '</tr>'
          ).join('')+
        '</tbody>';

      document.getElementById('csv-row-count').textContent = dataRows.length + '件のデータを検出';
      document.getElementById('csv-preview-area').style.display = 'block';
      const dz = document.getElementById('csv-drop-zone');
      dz.style.borderColor = '#3BB888'; dz.style.background = '#f0faf5';
    }

    function saveCustEntry() {
      if(custModalMode === 'csv') {
        importCsvData();
      } else {
        saveManualEntry();
      }
    }

    function saveManualEntry() {
      const name = document.getElementById('cf-name').value.trim();
      const area = document.getElementById('cf-area').value.trim();
      if(!name || !area) {
        showToast('会社名と所在地は必須です', 'error'); return;
      }
      if(custEntryType === 'client') {
        const newId = 'CL-' + String(clientMasterData.length + 1).padStart(3,'0');
        const newClient = {
          id: newId,
          name: name,
          area: area,
          contact: document.getElementById('cf-contact').value.trim() || '未登録',
          tel: document.getElementById('cf-tel').value.trim() || '—',
          email: document.getElementById('cf-email').value.trim() || '—',
          type: document.getElementById('cf-type').value || 'スポット',
          cases: []
        };
        clientMasterData.push(newClient);
        renderClientList();
        const countEl = document.getElementById('ctab-client-count');
        if(countEl) countEl.textContent = clientMasterData.length;
        showToast('取引先「'+name+'」を追加しました', 'success');
      } else {
        const checks = document.querySelectorAll('#cf-vehicle-types input[type=checkbox]:checked');
        const vehicleTypes = Array.from(checks).map(c=>c.value);
        const newId = 'PT-' + String(partnerMasterData.length + 1).padStart(3,'0');
        const newPartner = {
          id: newId,
          name: name,
          area: area,
          contact: document.getElementById('cf-contact').value.trim() || '未登録',
          tel: document.getElementById('cf-tel').value.trim() || '—',
          email: document.getElementById('cf-email').value.trim() || '—',
          vehicleTypes: vehicleTypes.length ? vehicleTypes : ['未設定'],
          cases: []
        };
        partnerMasterData.push(newPartner);
        renderCustPartnerList();
        const countEl = document.getElementById('ctab-partner-count');
        if(countEl) countEl.textContent = partnerMasterData.length;
        showToast('協力会社「'+name+'」を追加しました', 'success');
      }
      closeCustAddModal();
    }

    function importCsvData() {
      if(!csvParsedData.length) {
        showToast('CSVファイルを選択してください', 'error'); return;
      }
      let added = 0;
      csvParsedData.forEach(row => {
        if(!row[0] || !row[0].trim()) return;
        const name = row[0].trim();
        const area = (row[1]||'').trim();
        const contact = (row[2]||'').trim() || '未登録';
        const tel = (row[3]||'').trim() || '—';
        const email = (row[4]||'').trim() || '—';
        if(csvEntryType === 'client') {
          const type = (row[5]||'').trim() || 'スポット';
          const newId = 'CL-' + String(clientMasterData.length + 1).padStart(3,'0');
          clientMasterData.push({ id:newId, name, area, contact, tel, email, type, cases:[] });
        } else {
          const vtRaw = (row[5]||'').trim();
          const vehicleTypes = vtRaw ? vtRaw.split(',').map(s=>s.trim()).filter(Boolean) : ['未設定'];
          const newId = 'PT-' + String(partnerMasterData.length + 1).padStart(3,'0');
          partnerMasterData.push({ id:newId, name, area, contact, tel, email, vehicleTypes, cases:[] });
        }
        added++;
      });
      if(csvEntryType === 'client') {
        renderClientList();
        const countEl = document.getElementById('ctab-client-count');
        if(countEl) countEl.textContent = clientMasterData.length;
      } else {
        renderCustPartnerList();
        const countEl = document.getElementById('ctab-partner-count');
        if(countEl) countEl.textContent = partnerMasterData.length;
      }
      closeCustAddModal();
      showToast(added+'件のデータをインポートしました', 'success');
    }


    // ── チェックボックス管理 ──
    let clientCheckedIds  = new Set();
    let partnerCheckedIds = new Set();

    function toggleClientCheck(id, checked) {
      if(checked) clientCheckedIds.add(id); else clientCheckedIds.delete(id);
      updateClientBulkBar();
      // 全選択チェックの状態を同期
      const allCb = document.getElementById('client-check-all');
      if(allCb) {
        const total = clientMasterData.length;
        allCb.indeterminate = clientCheckedIds.size > 0 && clientCheckedIds.size < total;
        allCb.checked = clientCheckedIds.size === total;
      }
    }

    function toggleAllClientChecks(checked) {
      clientCheckedIds = checked ? new Set(clientMasterData.map(c=>c.id)) : new Set();
      renderClientList((document.getElementById('cust-search')?.value||'').toLowerCase());
    }

    function updateClientBulkBar() {
      const bar = document.getElementById('client-bulk-bar');
      const cnt = document.getElementById('client-checked-count');
      if(!bar) return;
      if(clientCheckedIds.size > 0) {
        bar.style.display = 'flex';
        if(cnt) cnt.textContent = clientCheckedIds.size + '件選択中';
      } else {
        bar.style.display = 'none';
      }
    }

    function bulkDeleteClients() {
      if(!clientCheckedIds.size) return;
      if(!confirm(clientCheckedIds.size + '件の取引先を削除しますか？')) return;
      clientCheckedIds.forEach(id => {
        const idx = clientMasterData.findIndex(c=>c.id===id);
        if(idx!==-1) clientMasterData.splice(idx,1);
      });
      clientCheckedIds.clear();
      const countEl = document.getElementById('ctab-client-count');
      if(countEl) countEl.textContent = clientMasterData.length;
      renderClientList();
      showToast('削除しました','success');
    }

    function exportSelectedClients() {
      const data = clientMasterData.filter(c=>clientCheckedIds.has(c.id));
      if(!data.length) return;
      const headers = ['取引先ID','会社名','所在地','担当者名','TEL','メールアドレス','取引種別','過去案件件数'];
      const rows = data.map(c=>[c.id,c.name,c.area,c.contact,c.tel,c.email,c.type,c.cases.length]);
      const csv = [headers,...rows].map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
      const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
      const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='selected_clients.csv'; a.click();
      showToast(data.length+'件をCSV出力しました','success');
    }

    function togglePartnerCheck(id, checked) {
      if(checked) partnerCheckedIds.add(id); else partnerCheckedIds.delete(id);
      updatePartnerBulkBar();
      const allCb = document.getElementById('partner-check-all');
      if(allCb) {
        const total = partnerMasterData.length;
        allCb.indeterminate = partnerCheckedIds.size > 0 && partnerCheckedIds.size < total;
        allCb.checked = partnerCheckedIds.size === total;
      }
    }

    function toggleAllPartnerChecks(checked) {
      partnerCheckedIds = checked ? new Set(partnerMasterData.map(c=>c.id)) : new Set();
      renderCustPartnerList((document.getElementById('cust-search')?.value||'').toLowerCase());
    }

    function updatePartnerBulkBar() {
      const bar = document.getElementById('partner-bulk-bar');
      const cnt = document.getElementById('partner-checked-count');
      if(!bar) return;
      if(partnerCheckedIds.size > 0) {
        bar.style.display = 'flex';
        if(cnt) cnt.textContent = partnerCheckedIds.size + '件選択中';
      } else {
        bar.style.display = 'none';
      }
    }

    function bulkDeletePartners() {
      if(!partnerCheckedIds.size) return;
      if(!confirm(partnerCheckedIds.size + '件の協力会社を削除しますか？')) return;
      partnerCheckedIds.forEach(id => {
        const idx = partnerMasterData.findIndex(c=>c.id===id);
        if(idx!==-1) partnerMasterData.splice(idx,1);
      });
      partnerCheckedIds.clear();
      const countEl = document.getElementById('ctab-partner-count');
      if(countEl) countEl.textContent = partnerMasterData.length;
      renderCustPartnerList();
      showToast('削除しました','success');
    }

    function exportSelectedPartners() {
      const data = partnerMasterData.filter(c=>partnerCheckedIds.has(c.id));
      if(!data.length) return;
      const headers = ['協力会社ID','会社名','所在地','担当者名','TEL','メールアドレス','対応車格','過去依頼件数'];
      const rows = data.map(c=>[c.id,c.name,c.area,c.contact,c.tel,c.email,(c.vehicleTypes||[]).join('|'),c.cases.length]);
      const csv = [headers,...rows].map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
      const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
      const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='selected_partners.csv'; a.click();
      showToast(data.length+'件をCSV出力しました','success');
    }

    // 顧客管理ページ初期化（showPageから呼ばれる）
    window.initCustomerPage = function() {
      switchCustTab('client');
      renderClientList();
    };