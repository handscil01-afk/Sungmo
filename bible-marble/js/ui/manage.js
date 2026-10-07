'use strict';
/* ================= 화면: 콘텐츠 관리 =================
   퀴즈 · 보드 판 · 말씀 카드 · 성경 본문 · 백업을 한곳에서 관리합니다. */
const MTABS=[['quiz','❓','퀴즈'],['board','🗺️','보드 판'],['card','📜','말씀 카드'],['bible','📖','성경 본문'],['backup','💾','백업']];
const Manage={tab:'quiz',L:null,f:{s:'',t:'',lv:'',era:'',cat:'',src:''},boardId:null,
  open(tab,onClose){this.tab=tab||this.tab;this.onClose=onClose;
    this.L=openLayer('info',`<div class="setwin"><div class="shead"><h3 class="cute">📚 콘텐츠 관리</h3></div>
      <div class="setbody"><div class="tabs">${MTABS.map(([k,e,n])=>`<button data-tab="${k}" class="${k===this.tab?'on':''}"><span class="e">${e}</span>${n}</button>`).join('')}</div>
      <div class="tabpane" id="mpane" style="display:flex;flex-direction:column;min-height:0"></div></div></div>`,{full:true,close:true,tone:'var(--mint)',onClose:()=>{this.onClose&&this.onClose()}});
    $$('[data-tab]',this.L.box).forEach(b=>b.onclick=()=>{this.tab=b.dataset.tab;$$('[data-tab]',this.L.box).forEach(x=>x.classList.toggle('on',x===b));this.pane()});
    this.pane()},
  pane(){const p=$('#mpane',this.L.box);if(!p)return;({quiz:()=>this.quizPane(p),board:()=>this.boardPane(p),card:()=>this.cardPane(p),bible:()=>this.biblePane(p),backup:()=>this.backupPane(p)})[this.tab]()},

  /* ================= 퀴즈 ================= */
  quizList(){const f=this.f,s=f.s.trim();return Content.quizAll().filter(q=>(!f.t||q.t===f.t)&&(!f.lv||q.lv===f.lv)&&(!f.era||q.era===f.era)&&(!f.cat||q.cat===f.cat)
    &&(!f.src||(f.src==='base'?q.src==='base':q.src!=='base'))&&(!s||(q.q+' '+(q.c||[]).join(' ')+' '+(q.a||'')+' '+q.ref+' '+q.cat).includes(s)))},
  quizPane(p){const all=Content.quizAll(),cats=[...new Set(all.map(q=>q.cat))].sort(),f=this.f;
    const sel=(k,opts)=>`<select class="inp" data-f="${k}">${opts.map(([v,l])=>`<option value="${v}" ${f[k]===v?'selected':''}>${l}</option>`).join('')}</select>`;
    p.innerHTML=`<div class="mgr"><div class="tbar"><input class="inp" id="qs" placeholder="🔍 문제·보기·구절 찾기" value="${esc(f.s)}">
      ${sel('t',[['','유형 전체'],['mc','객관식'],['sa','주관식']])}${sel('lv',[['','난이도 전체'],['easy','쉬움'],['normal','보통'],['hard','어려움']])}
      ${sel('era',[['','시대 전체'],['ot','구약'],['nt','신약'],['all','공통']])}${sel('cat',[['','카테고리 전체'],...cats.map(c=>[c,c])])}${sel('src',[['','출처 전체'],['base','기본 문제'],['user','직접 만든·고친 문제']])}</div>
      <div class="tbar"><button class="btn main" data-new>＋ 새 문제</button><button class="btn" data-on="1">보이는 문제 모두 사용</button><button class="btn" data-on="0">보이는 문제 모두 빼기</button>
      <button class="btn" data-x="xlsx">⬇️ 엑셀로 내보내기</button><button class="btn" data-x="csv">⬇️ CSV</button><button class="btn mint" data-imp>⬆️ 엑셀·CSV 불러오기</button><span class="count" id="qcnt"></span></div>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>사용</th><th>문제</th><th>유형</th><th>난이도</th><th>시대</th><th>카테고리</th><th>출처</th></tr></thead><tbody id="qbody"></tbody></table></div></div>`;
    const draw=()=>{const list=this.quizList();$('#qcnt',p).textContent=`보이는 문제 ${list.length} · 전체 ${all.length} · 사용 ${all.filter(q=>q.on).length}`;
      $('#qbody',p).innerHTML=list.map(q=>`<tr><td><input type="checkbox" class="ck" data-ck="${esc(q.id)}" ${q.on?'checked':''} aria-label="사용"></td><td class="q" data-ed="${esc(q.id)}">${esc(q.q)}</td>
        <td><span class="pill ${q.t}">${TYPE_KO[q.t]}</span></td><td>${LV_KO[q.lv]}</td><td>${ERA_KO[q.era]}</td><td>${esc(q.cat)}</td><td>${q.src==='base'?'기본':`<span class="pill user">${q.src==='edit'?'고침':'직접'}</span>`}</td></tr>`).join('')||'<tr><td colspan="7" class="muted">조건에 맞는 문제가 없어요.</td></tr>';
      $$('[data-ck]',p).forEach(c=>c.onchange=()=>{Content.quizSetOn([c.dataset.ck],c.checked);this.countOnly(p)});
      $$('[data-ed]',p).forEach(c=>c.onclick=()=>this.editQuiz(Content.quizAll().find(q=>q.id===c.dataset.ed)))};
    this.countOnly=(pp)=>{const a=Content.quizAll();$('#qcnt',pp).textContent=`보이는 문제 ${this.quizList().length} · 전체 ${a.length} · 사용 ${a.filter(q=>q.on).length}`};
    $('#qs',p).oninput=e=>{f.s=e.target.value;draw()};
    $$('[data-f]',p).forEach(s=>s.onchange=()=>{f[s.dataset.f]=s.value;draw()});
    $('[data-new]',p).onclick=()=>this.editQuiz(null);
    $$('[data-on]',p).forEach(b=>b.onclick=()=>{Content.quizSetOn(this.quizList().map(q=>q.id),b.dataset.on==='1');draw()});
    $$('[data-x]',p).forEach(b=>b.onclick=()=>this.exportQuiz(b.dataset.x));
    $('[data-imp]',p).onclick=()=>this.importQuiz();
    draw()},
  editQuiz(q){const isNew=!q;q=q?clone(q):{t:'mc',lv:'easy',era:'all',cat:'성경',q:'',c:['','','',''],ai:0,ref:'',ex:'',on:true};
    if(q.t==='mc'&&(!q.c||q.c.length<2))q.c=['','','',''];
    const cats=[...new Set(Content.quizAll().map(x=>x.cat))];
    const html=()=>`<div class="kick">❓ ${isNew?'새 문제 만들기':q.src==='base'?'기본 문제 고치기':'문제 고치기'}</div><h3>${isNew?'새 문제':'문제 편집'}</h3>
      <div class="form">
        <label class="full">유형<div class="seg" data-v="t"><button type="button" data-x="mc" class="${q.t==='mc'?'on':''}">객관식 (보기 고르기)</button><button type="button" data-x="sa" class="${q.t==='sa'?'on':''}">주관식 (말로 답하기)</button></div></label>
        <label class="full">문제<textarea class="inp" id="eq" rows="2" placeholder="예: 다윗이 물맷돌로 쓰러뜨린 거인은?">${esc(q.q)}</textarea></label>
        ${q.t==='mc'?`<div class="full" style="display:flex;flex-direction:column;gap:.4rem"><span class="cute" style="color:var(--ink-2)">보기 (동그라미를 눌러 정답을 고르세요)</span>
          ${q.c.map((c,k)=>`<div class="choice"><input type="radio" name="ans" value="${k}" ${q.ai===k?'checked':''} aria-label="${k+1}번 정답"><input class="inp" data-c="${k}" value="${esc(c)}" placeholder="보기 ${k+1}">${q.c.length>2?`<button type="button" class="btn sm" data-rm="${k}">빼기</button>`:''}</div>`).join('')}
          ${q.c.length<6?'<button type="button" class="btn sm" data-add>＋ 보기 추가</button>':''}</div>`
        :`<label>정답<input class="inp" id="ea" value="${esc(q.a||'')}" placeholder="예: 골리앗"></label><label>함께 인정할 답 (쉼표로 구분)<input class="inp" id="ealt" value="${esc((q.alt||[]).join(', '))}" placeholder="예: 골리앗 장군"></label>`}
        <label>난이도<div class="seg" data-v="lv">${['easy','normal','hard'].map(v=>`<button type="button" data-x="${v}" class="${q.lv===v?'on':''}">${LV_KO[v]}</button>`).join('')}</div></label>
        <label>시대 (이 시대의 판에서 나와요)<div class="seg" data-v="era">${['ot','nt','all'].map(v=>`<button type="button" data-x="${v}" class="${q.era===v?'on':''}">${ERA_KO[v]}</button>`).join('')}</div></label>
        <label>카테고리<input class="inp" id="ecat" list="catlist" value="${esc(q.cat)}"><datalist id="catlist">${cats.map(c=>`<option value="${esc(c)}">`).join('')}</datalist></label>
        <label>성경 구절<input class="inp" id="eref" value="${esc(q.ref||'')}" placeholder="예: 삼상 17:49"></label>
        <label class="full">해설 (정답과 함께 보여 줘요)<textarea class="inp" id="eex" rows="2">${esc(q.ex||'')}</textarea></label>
        <label>퀴즈 칸 상금 (비우면 난이도 기본값)<input class="inp" id="erw" type="number" min="10" step="10" value="${q.rw||''}" placeholder="100 · 150 · 200"></label>
        <label>게임에 쓰기<button type="button" class="sw" id="eon" role="switch" aria-checked="${q.on!==false}"></button></label>
      </div><p class="ref" id="eerr" style="color:var(--bad)"></p>
      <div class="mbtns row"><button class="btn main" data-save>저장</button>${isNew?'':q.src==='edit'?'<button class="btn" data-reset>기본값으로 되돌리기</button>':''}${isNew?'':`<button class="btn bad" data-del>${q.src==='base'?'목록에서 빼기':'삭제'}</button>`}<button class="btn" data-cancel>취소</button></div>`;
    const L=openLayer('edit',html(),{close:true,wide:true,tone:'var(--accent)'});
    const read=()=>{q.q=$('#eq',L.box).value;if(q.t==='mc'){$$('[data-c]',L.box).forEach(i=>q.c[+i.dataset.c]=i.value);const r=$('input[name=ans]:checked',L.box);q.ai=r?+r.value:0}
      else{q.a=$('#ea',L.box).value;q.alt=$('#ealt',L.box).value}q.cat=$('#ecat',L.box).value;q.ref=$('#eref',L.box).value;q.ex=$('#eex',L.box).value;q.rw=$('#erw',L.box).value;q.on=$('#eon',L.box).getAttribute('aria-checked')==='true'};
    const redraw=()=>{const box=$('.mbox',L.ov);box.innerHTML='<button class="xclose" data-x aria-label="닫기">×</button>'+html();$('[data-x]',box).onclick=L.close;bind()};
    const bind=()=>{
      $$('[data-v]',L.box).forEach(seg=>seg.onclick=e=>{const b=e.target.closest('button');if(!b)return;read();const k=seg.dataset.v;q[k]=b.dataset.x;
        if(k==='t'&&q.t==='mc'&&(!q.c||q.c.length<2)){q.c=['','','',''];q.ai=0}if(k==='t'&&q.t==='sa'&&!q.a)q.a=q.c&&q.c[q.ai]||'';redraw()});
      $$('[data-rm]',L.box).forEach(b=>b.onclick=()=>{read();const k=+b.dataset.rm;q.c.splice(k,1);if(q.ai>=q.c.length)q.ai=0;else if(q.ai>k)q.ai--;redraw()});
      const ad=$('[data-add]',L.box);if(ad)ad.onclick=()=>{read();q.c.push('');redraw()};
      $('#eon',L.box).onclick=e=>{const b=e.currentTarget;b.setAttribute('aria-checked',b.getAttribute('aria-checked')!=='true')};
      $('[data-cancel]',L.box).onclick=L.close;
      $('[data-save]',L.box).onclick=()=>{read();const err=[];if(!q.q.trim())err.push('문제를 적어 주세요');
        if(q.t==='mc'){const filled=q.c.map(x=>x.trim());if(filled.filter(Boolean).length<2)err.push('보기를 2개 이상 적어 주세요');if(!filled[q.ai])err.push('정답으로 고른 보기가 비어 있어요');
          if(new Set(filled.filter(Boolean)).size!==filled.filter(Boolean).length)err.push('같은 보기가 두 번 있어요');
          const keep=filled.map((x,i)=>[x,i]).filter(([x])=>x);q.ai=keep.findIndex(([,i])=>i===q.ai);q.c=keep.map(([x])=>x)}
        else if(!String(q.a||'').trim())err.push('정답을 적어 주세요');
        if(q.rw&&!(+q.rw>0))err.push('상금은 숫자로 적어 주세요');
        if(err.length){$('#eerr',L.box).textContent='⚠️ '+err.join(' · ');return}
        const on=q.on;const id=Content.quizSave(q);Content.quizSetOn([id],on);L.close();UI.toast('💾 저장했어요');this.pane()};
      const del=$('[data-del]',L.box);if(del)del.onclick=()=>{if(!del.dataset.sure){del.dataset.sure=1;del.textContent='한 번 더 누르면 지워요';return}Content.quizRemove([q.id]);L.close();UI.toast('🗑️ 지웠어요');this.pane()};
      const rs=$('[data-reset]',L.box);if(rs)rs.onclick=()=>{Content.quizReset(q.id);L.close();UI.toast('기본 문제로 되돌렸어요');this.pane()};
      setTimeout(()=>$('#eq',L.box).focus(),60)};
    bind()},
  exportQuiz(fmt){const list=this.quizList();if(!list.length)return UI.toast('내보낼 문제가 없어요');
    const rows=quizRows(list),name=`성경부루마블_퀴즈_${today()}`;
    if(fmt==='csv')saveFile(name+'.csv',XLSX_LITE.toCSV(rows),'text/csv;charset=utf-8');
    else saveFile(name+'.xlsx',XLSX_LITE.write([{name:'퀴즈',rows,widths:[10,6,8,8,7,12,48,18,18,18,18,12,12,14,18,30,16,8]},{name:'작성 방법',rows:QUIZ_GUIDE,widths:[14,90]}]));
    UI.toast(`⬇️ 보이는 문제 ${list.length}개를 내보냈어요`)},
  async readSheetFile(file){const name=file.name.toLowerCase();
    if(name.endsWith('.csv')||name.endsWith('.tsv')||name.endsWith('.txt'))return [{name:'퀴즈',rows:XLSX_LITE.parseCSV(await readText(file))}];
    return XLSX_LITE.read(await file.arrayBuffer())},
  async importQuiz(){const file=await pickFile('.xlsx,.csv,.tsv');if(!file)return;let sheets;
    try{sheets=await this.readSheetFile(file)}catch(e){return showImportReport({errors:[{row:0,msg:e.message||'파일을 읽지 못했어요'}],items:[],add:0,upd:0},'퀴즈',()=>{})}
    const sh=sheets.find(s=>s.rows.some(r=>r.some(c=>String(c).trim()==='문제')))||sheets[0];
    const res=quizFromRows(sh?sh.rows:[],Content.quizAll());
    showImportReport(res,'퀴즈',()=>{for(const it of res.items){const on=it._on;delete it._on;const id=Content.quizSave(it);Content.quizSetOn([id],on)}UI.toast(`⬆️ ${res.items.length}문제를 가져왔어요`);this.pane()})},

  /* ================= 보드 판 ================= */
  boardPane(p){const boards=Content.boardAll();if(!this.boardId||!boards.some(b=>b.id===this.boardId))this.boardId=(G&&G.board&&boards.some(b=>b.id===G.cfg.board))?G.cfg.board:SETUP.cfg.board;
    if(!boards.some(b=>b.id===this.boardId))this.boardId=boards[0].id;const b=boards.find(x=>x.id===this.boardId);
    p.innerHTML=`<div class="mgr"><div class="tbar">${boards.map(x=>`<button class="btn ${x.id===b.id?'main':''}" data-b="${esc(x.id)}">${esc(x.name)}${x.src==='user'?' ✏️':x.src==='edit'?' (고침)':''}</button>`).join('')}</div>
      <div class="tbar"><button class="btn" data-info>📝 판 이름·그룹 편집</button><button class="btn" data-dup>📄 복제해서 새 판 만들기</button>
      ${b.src==='edit'?'<button class="btn" data-reset>기본값으로 되돌리기</button>':''}${b.src==='user'?'<button class="btn bad" data-delb>판 삭제</button>':''}
      <button class="btn" data-x>⬇️ 엑셀로 내보내기</button><button class="btn mint" data-imp>⬆️ 엑셀로 새 판 불러오기</button></div>
      <p class="muted" style="margin:0">${esc(b.desc||'')} · 칸을 누르면 고칠 수 있어요. 모서리 네 칸(출발·광야·헌금함·이동)은 종류를 바꿀 수 없어요. 진행 중인 게임에는 다음 게임부터 반영돼요.</p>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>#</th><th>그림</th><th>이름</th><th>종류</th><th>그룹</th><th>가격</th><th>설명</th></tr></thead>
      <tbody>${b.tiles.map((t,i)=>`<tr><td>${i}</td><td style="font-size:1.5rem">${esc(t.pic)}</td><td class="q" data-t="${i}">${esc(t.name)}</td><td>${TILE_KO[t.t]}</td>
        <td>${t.t==='city'?`<span class="pill" style="background:${GROUP_COLORS[t.g]}">${esc(b.groups[t.g])}</span>`:''}</td><td>${t.price||''}</td><td class="q" data-t="${i}">${esc((t.note||'').slice(0,40))}${(t.note||'').length>40?'…':''}</td></tr>`).join('')}</tbody></table></div></div>`;
    $$('[data-b]',p).forEach(x=>x.onclick=()=>{this.boardId=x.dataset.b;this.pane()});
    $$('[data-t]',p).forEach(x=>x.onclick=()=>this.editTile(b,+x.dataset.t));
    $('[data-info]',p).onclick=()=>this.editBoardInfo(b);
    $('[data-dup]',p).onclick=()=>{const n=clone(b);n.id='';n.name=b.name+' (복사본)';delete n.src;delete n.on;this.boardId=Content.boardSave(n);UI.toast('📄 새 판을 만들었어요');this.pane()};
    const rs=$('[data-reset]',p);if(rs)rs.onclick=()=>{Content.boardReset(b.id);UI.toast('기본 판으로 되돌렸어요');this.pane()};
    const db=$('[data-delb]',p);if(db)db.onclick=()=>{if(!db.dataset.sure){db.dataset.sure=1;db.textContent='한 번 더 누르면 지워요';return}Content.boardRemove(b.id);if(SETUP.cfg.board===b.id){SETUP.cfg.board='both';saveSetup()}this.boardId=null;this.pane()};
    $('[data-x]',p).onclick=()=>{saveFile(`성경부루마블_보드_${b.name}_${today()}.xlsx`,XLSX_LITE.write(boardSheets(b)));UI.toast('⬇️ 보드를 내보냈어요')};
    $('[data-imp]',p).onclick=async()=>{const file=await pickFile('.xlsx');if(!file)return;let sheets;
      try{sheets=await XLSX_LITE.read(await file.arrayBuffer())}catch(e){return showImportReport({errors:[{row:0,msg:e.message}],items:[]},'보드',()=>{})}
      const r=boardFromSheets(sheets);if(!r.board)return showImportReport({errors:r.errors,items:[]},'보드',()=>{});
      r.board.id='';this.boardId=Content.boardSave(r.board);UI.toast(`⬆️ "${r.board.name}" 판을 가져왔어요`);this.pane()}},
  saveBoard(b){const n=clone(b);delete n.on;const src=n.src;delete n.src;if(src==='base'||src==='edit'||src==='user')this.boardId=Content.boardSave(n);UI.toast('💾 저장했어요');this.pane()},
  editBoardInfo(b){const L=openLayer('edit',`<div class="kick">🗺️ ${esc(b.name)} 판</div><h3>판 이름·그룹 편집</h3><div class="form">
      <label>판 이름<input class="inp" id="bn" value="${esc(b.name)}" maxlength="12"></label>
      <label>시대 (퀴즈·카드가 이 시대에 맞춰 나와요)<div class="seg" id="bera">${['ot','nt','all'].map(v=>`<button type="button" data-x="${v}" class="${b.era===v?'on':''}">${ERA_KO[v]}</button>`).join('')}</div></label>
      <label class="full">설명<textarea class="inp" id="bd" rows="2">${esc(b.desc||'')}</textarea></label>
      ${b.groups.map((g,i)=>`<label><span><i style="display:inline-block;width:1em;height:1em;border-radius:.25em;background:${GROUP_COLORS[i]};vertical-align:-.1em"></i> 그룹 ${i+1}</span><input class="inp" data-g="${i}" value="${esc(g)}" maxlength="10"></label>`).join('')}
    </div><div class="mbtns row"><button class="btn main" data-save>저장</button><button class="btn" data-cancel>취소</button></div>`,{close:true,wide:true});
    let era=b.era;$('#bera',L.box).onclick=e=>{const x=e.target.closest('button');if(!x)return;era=x.dataset.x;$$('#bera button',L.box).forEach(y=>y.classList.toggle('on',y===x))};
    $('[data-cancel]',L.box).onclick=L.close;
    $('[data-save]',L.box).onclick=()=>{const n=clone(b);n.name=$('#bn',L.box).value.trim()||b.name;n.desc=$('#bd',L.box).value.trim();n.era=era;$$('[data-g]',L.box).forEach(i=>n.groups[+i.dataset.g]=i.value.trim()||n.groups[+i.dataset.g]);L.close();this.saveBoard(n)}},
  editTile(b,i){const t=clone(b.tiles[i]),corner=[0,8,16,24].includes(i);
    const types=corner?[t.t]:['city','spot','card','quiz','tithe','event'];
    const html=()=>`<div class="kick">🗺️ ${esc(b.name)} 판 · ${i}번 칸</div><h3>${esc(t.pic)} ${esc(t.name)}</h3><div class="form">
      <label>종류<select class="inp" id="tt" ${corner?'disabled':''}>${types.map(k=>`<option value="${k}" ${t.t===k?'selected':''}>${TILE_KO[k]}</option>`).join('')}</select></label>
      <label>이름<input class="inp" id="tn" value="${esc(t.name)}" maxlength="12"></label>
      <label>짧은 이름 (작은 화면용, 비워도 돼요)<input class="inp" id="ts" value="${esc(t.short||'')}" maxlength="6"></label>
      <label>그림 (이모티콘)<input class="inp" id="tp" value="${esc(t.pic)}" maxlength="4" style="font-size:1.6rem"></label>
      ${t.t==='city'?`<label>그룹(색)<select class="inp" id="tg">${b.groups.map((g,k)=>`<option value="${k}" ${t.g===k?'selected':''}>${k+1}. ${esc(g)}</option>`).join('')}</select></label>`:''}
      ${t.t==='city'||t.t==='spot'?`<label>땅값<input class="inp" id="tpr" type="number" min="10" step="10" value="${t.price||100}"></label>`:''}
      ${corner?`<label>아래 글씨<input class="inp" id="tsub" value="${esc(t.sub||'')}" maxlength="10"></label>`:''}
      <label class="full">설명 (성경 이야기)<textarea class="inp" id="tno" rows="3">${esc(t.note||'')}</textarea></label>
      <label>성경 구절<input class="inp" id="tre" value="${esc(t.ref||'')}" placeholder="예: 수 6:20"></label>
      ${t.t==='event'?fxEditor(t.fx||{k:'gain',n:100},b):''}
    </div><p class="ref" id="terr" style="color:var(--bad)"></p><div class="mbtns row"><button class="btn main" data-save>저장</button><button class="btn" data-cancel>취소</button></div>`;
    const L=openLayer('edit',html(),{close:true,wide:true,tone:t.t==='city'?GROUP_COLORS[t.g]:'var(--sky-2)'});
    const read=()=>{t.t=$('#tt',L.box).value;t.name=$('#tn',L.box).value.trim();const s=$('#ts',L.box).value.trim();if(s)t.short=s;else delete t.short;t.pic=$('#tp',L.box).value.trim();
      if($('#tg',L.box))t.g=+$('#tg',L.box).value;if($('#tpr',L.box))t.price=+$('#tpr',L.box).value;if($('#tsub',L.box))t.sub=$('#tsub',L.box).value;t.note=$('#tno',L.box).value.trim();t.ref=$('#tre',L.box).value.trim();
      if(t.t==='event')t.fx=readFx(L.box);else delete t.fx;if(t.t==='city'&&t.g==null)t.g=0;if((t.t==='city'||t.t==='spot')&&!t.price)t.price=t.t==='spot'?200:100};
    const bind=()=>{$('#tt',L.box).onchange=()=>{read();const box=$('.mbox',L.ov);box.innerHTML='<button class="xclose" data-x aria-label="닫기">×</button>'+html();$('[data-x]',box).onclick=L.close;bind()};
      bindFx(L.box);$('[data-cancel]',L.box).onclick=L.close;
      $('[data-save]',L.box).onclick=()=>{read();if(!t.name)return $('#terr',L.box).textContent='⚠️ 이름을 적어 주세요';if(!t.pic)t.pic='📍';
        if(t.t==='event'&&t.fx.err)return $('#terr',L.box).textContent='⚠️ '+t.fx.err;
        const n=clone(b);n.tiles[i]=t;L.close();this.saveBoard(n)}};bind()},

  /* ================= 말씀 카드 ================= */
  cardPane(p){const all=Content.cardAll();
    p.innerHTML=`<div class="mgr"><div class="tbar"><button class="btn main" data-new>＋ 새 카드</button><button class="btn" data-x>⬇️ 엑셀로 내보내기</button><button class="btn mint" data-imp>⬆️ 엑셀 불러오기</button>
      ${all.some(c=>c.src!=='user')?'':''}<span class="count">카드 ${all.length}장 · 사용 ${all.filter(c=>c.on).length}장 · 판의 시대에 맞는 카드만 섞여요</span></div>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>사용</th><th>제목</th><th>시대</th><th>효과</th><th>성경 구절</th><th>출처</th></tr></thead><tbody>
      ${all.map(c=>`<tr><td><input type="checkbox" class="ck" data-ck="${esc(c.id)}" ${c.on?'checked':''}></td><td class="q" data-ed="${esc(c.id)}">📜 ${esc(c.t)}</td><td>${ERA_KO[c.era]||'공통'}</td><td>${esc(fxText(c.fx))}</td><td>${esc(c.r||'')}</td><td>${c.src==='base'?'기본':`<span class="pill user">${c.src==='edit'?'고침':'직접'}</span>`}</td></tr>`).join('')}</tbody></table></div></div>`;
    $$('[data-ck]',p).forEach(c=>c.onchange=()=>Content.cardSetOn([c.dataset.ck],c.checked));
    $$('[data-ed]',p).forEach(c=>c.onclick=()=>this.editCard(all.find(x=>x.id===c.dataset.ed)));
    $('[data-new]',p).onclick=()=>this.editCard(null);
    $('[data-x]',p).onclick=()=>{saveFile(`성경부루마블_말씀카드_${today()}.xlsx`,XLSX_LITE.write([{name:'말씀 카드',rows:cardRows(all),widths:[10,6,7,22,14,50,18,8,12]}]));UI.toast('⬇️ 카드를 내보냈어요')};
    $('[data-imp]',p).onclick=async()=>{const file=await pickFile('.xlsx,.csv');if(!file)return;let sheets;try{sheets=await this.readSheetFile(file)}catch(e){return showImportReport({errors:[{row:0,msg:e.message}],items:[]},'카드',()=>{})}
      const res=cardsFromRows(sheets[0].rows,all);showImportReport(res,'카드',()=>{for(const it of res.items){const on=it._on;delete it._on;const id=Content.cardSave(it);Content.cardSetOn([id],on)}UI.toast(`⬆️ ${res.items.length}장을 가져왔어요`);this.pane()})}},
  editCard(c){const isNew=!c;c=c?clone(c):{era:'all',t:'',r:'',d:'',fx:{k:'gain',n:100},on:true};
    const L=openLayer('edit',`<div class="kick">📜 ${isNew?'새 말씀 카드':'말씀 카드 고치기'}</div><h3>${esc(c.t||'새 카드')}</h3><div class="form">
      <label>제목<input class="inp" id="ct" value="${esc(c.t)}" maxlength="16" placeholder="예: 다윗과 골리앗"></label>
      <label>성경 구절<input class="inp" id="cr" value="${esc(c.r||'')}" placeholder="예: 삼상 17:49"></label>
      <label>시대<div class="seg" id="cera">${['ot','nt','all'].map(v=>`<button type="button" data-x="${v}" class="${(c.era||'all')===v?'on':''}">${ERA_KO[v]}</button>`).join('')}</div></label>
      <label class="full">설명 (카드에 보이는 글)<textarea class="inp" id="cd" rows="2">${esc(c.d||'')}</textarea></label>
      ${fxEditor(c.fx,null)}
    </div><p class="ref" id="cerr" style="color:var(--bad)"></p><div class="mbtns row"><button class="btn main" data-save>저장</button>${isNew?'':c.src==='edit'?'<button class="btn" data-reset>기본값으로 되돌리기</button>':''}${isNew?'':'<button class="btn bad" data-del>빼기·삭제</button>'}<button class="btn" data-cancel>취소</button></div>`,{close:true,wide:true,tone:'var(--g7)'});
    let era=c.era||'all';$('#cera',L.box).onclick=e=>{const x=e.target.closest('button');if(!x)return;era=x.dataset.x;$$('#cera button',L.box).forEach(y=>y.classList.toggle('on',y===x))};
    bindFx(L.box);$('[data-cancel]',L.box).onclick=L.close;
    $('[data-save]',L.box).onclick=()=>{const fx=readFx(L.box),t=$('#ct',L.box).value.trim();if(!t)return $('#cerr',L.box).textContent='⚠️ 제목을 적어 주세요';if(fx.err)return $('#cerr',L.box).textContent='⚠️ '+fx.err;
      const n={...c,t,r:$('#cr',L.box).value.trim(),d:$('#cd',L.box).value.trim()||fxText(fx),era,fx};const on=n.on!==false;const id=Content.cardSave(n);Content.cardSetOn([id],on);L.close();
      let msg='💾 저장했어요';if(fx.k==='move_to'&&!fx.to.startsWith('@')){const bs=Content.boardAll().filter(b=>findTileIn(b,fx.to)>=0).map(b=>b.name);msg=bs.length?`💾 저장했어요. ${bs.join('·')} 판에서만 나와요`:`💾 저장했어요. 지금은 "${fx.to}" 칸이 있는 판이 없어서 게임에 나오지 않아요`}
      UI.toast(msg,4000);this.pane()};
    const d=$('[data-del]',L.box);if(d)d.onclick=()=>{if(!d.dataset.sure){d.dataset.sure=1;d.textContent='한 번 더 누르면 지워요';return}Content.cardRemove([c.id]);L.close();this.pane()};
    const rs=$('[data-reset]',L.box);if(rs)rs.onclick=()=>{Content.cardReset(c.id);L.close();this.pane()}},

  /* ================= 성경 본문 ================= */
  async biblePane(p){p.innerHTML='<p class="muted">불러오는 중…</p>';const info=await Bible.info();
    p.innerHTML=`<div class="sgrid">
      <div class="srow full"><div class="tx"><b>${info?`📖 ${esc(info.name)} · ${info.books}권 ${fmt(info.count)}절`:'아직 불러온 성경 본문이 없어요'}</b>
        <small>${info?`${new Date(info.date).toLocaleString('ko-KR')}에 불러왔어요. 게임의 📖 구절을 누르면 본문이 큰 글씨로 나와요.`:'가지고 계신 개역개정 텍스트 파일을 불러오면 게임 속 구절을 누를 때 본문이 크게 나와요.'}</small></div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn main" data-load>📂 성경 파일 불러오기</button>${info?'<button class="btn" data-test>창 1:1 보기</button><button class="btn bad" data-clear>지우기</button>':''}</div></div>
      <div class="srow full"><div class="tx"><b>읽을 수 있는 파일 형식</b><small>· 한 줄에 한 절: <span class="kbd">창1:1 태초에 하나님이…</span> 또는 <span class="kbd">창세기 1:1 태초에…</span><br>· 책 이름 줄 아래에 <span class="kbd">1:1 태초에…</span><br>· CSV/TSV 또는 엑셀: 책, 장, 절, 본문 순서의 열<br>· JSON: [{"book":"창세기","chapter":1,"verse":1,"text":"…"}]<br>한글 파일은 UTF-8과 EUC-KR(완성형) 모두 읽어요. 절 앞의 &lt;소제목&gt;은 빼고 저장해요.</small></div></div>
      <div class="srow full"><div class="tx"><b>저작권 안내</b><small>성경 본문은 이 기기 안에만 저장되고 인터넷 사이트나 다른 기기로 올라가지 않아요. 개역개정 본문의 저작권은 대한성서공회에 있어요.</small></div></div></div>`;
    $('[data-load]',p).onclick=()=>this.loadBible();
    const t=$('[data-test]',p);if(t)t.onclick=()=>openVerse('창 1:1');
    const c=$('[data-clear]',p);if(c)c.onclick=async()=>{if(!c.dataset.sure){c.dataset.sure=1;c.textContent='한 번 더 누르면 지워요';return}await Bible.clear();UI.toast('성경 본문을 지웠어요');this.pane()}},
  async loadBible(){const file=await pickFile('.txt,.csv,.tsv,.json,.xlsx');if(!file)return;UI.toast('파일을 읽는 중…');let text;
    try{if(file.name.toLowerCase().endsWith('.xlsx')){const sh=await XLSX_LITE.read(await file.arrayBuffer());text=sh[0].rows.map(r=>r.join('\t')).join('\n')}else text=await readText(file)}
    catch(e){return UI.toast('파일을 읽지 못했어요: '+(e.message||''),4000)}
    const r=Bible.parse(text);let n=0;for(const b in r.books)for(const c in r.books[b])n+=Object.keys(r.books[b][c]).length;
    const nb=Object.keys(r.books).length,s=r.books[0]&&r.books[0][1]&&r.books[0][1][1];
    const L=openLayer('edit',`<div class="kick">📖 성경 파일 확인</div><h3>${n?`${nb}권 ${fmt(n)}절을 찾았어요`:'본문을 찾지 못했어요'}</h3><div class="mbody">
      ${n?`<p>파일: <b>${esc(file.name)}</b>${r.bad?` · 형식을 알 수 없는 줄 ${fmt(r.bad)}개는 건너뛰었어요`:''}</p>${s?`<div class="verse-empty"><b>창세기 1장 1절</b><br>${esc(s)}</div>`:''}<p class="ref">글자가 깨져 보이면 파일을 UTF-8로 다시 저장해서 불러와 주세요.</p>`
        :'<p>위의 "읽을 수 있는 파일 형식"을 확인해 주세요. 한 줄에 한 절씩, 앞에 책 이름과 장:절이 있어야 해요.</p>'}</div>
      <div class="mbtns row">${n?'<button class="btn main" data-ok>이 본문 저장하기</button>':''}<button class="btn" data-cancel>취소</button></div>`,{close:true,wide:true,tone:'#ffd657'});
    $('[data-cancel]',L.box).onclick=L.close;const ok=$('[data-ok]',L.box);
    if(ok)ok.onclick=async()=>{ok.disabled=true;ok.textContent='저장하는 중…';try{await Bible.save(r.books,file.name);L.close();UI.toast(`📖 성경 본문 ${fmt(n)}절을 저장했어요`);this.pane()}catch(e){ok.disabled=false;ok.textContent='이 본문 저장하기';UI.toast('저장하지 못했어요. 기기 저장 공간을 확인해 주세요',4000)}}},

  /* ================= 백업 ================= */
  backupPane(p){p.innerHTML=`<div class="sgrid">
    <div class="srow full"><div class="tx"><b>💾 전체 백업 내보내기</b><small>직접 만든·고친 퀴즈, 보드 판, 말씀 카드, 게임 설정을 파일 하나(.json)로 저장해요. 다른 기기에서 불러오면 그대로 옮겨져요. 성경 본문은 들어가지 않아요.</small></div><button class="btn main" data-exp>⬇️ 백업 파일 받기</button></div>
    <div class="srow full"><div class="tx"><b>📂 백업 불러오기</b><small>백업 파일의 내용으로 이 기기의 콘텐츠를 바꿔요.</small></div><button class="btn" data-imp>⬆️ 백업 불러오기</button></div>
    <div class="srow full"><div class="tx"><b>🧹 처음 상태로 되돌리기</b><small>직접 만든·고친 퀴즈, 보드, 카드를 모두 지우고 기본 콘텐츠만 남겨요.</small></div><button class="btn bad" data-reset>모두 되돌리기</button></div></div>`;
    $('[data-exp]',p).onclick=()=>{saveFile(`성경부루마블_백업_${today()}.json`,JSON.stringify(backupData(),null,1),'application/json');UI.toast('⬇️ 백업 파일을 받았어요')};
    $('[data-imp]',p).onclick=async()=>{const f=await pickFile('.json');if(!f)return;try{restoreBackup(JSON.parse(await readText(f)));SETUP=loadSetup();UI.toast('📂 백업을 불러왔어요');this.pane()}catch(e){UI.toast(e.message||'백업 파일을 읽지 못했어요',4000)}};
    const r=$('[data-reset]',p);r.onclick=()=>{if(!r.dataset.sure){r.dataset.sure=1;r.textContent='한 번 더 누르면 모두 지워요';return}for(const k of ['quiz','card','board'])store.del('c.'+k);UI.toast('기본 콘텐츠로 되돌렸어요');this.pane()}}
};
/* 효과 편집 (이벤트 칸·말씀 카드 공용) */
function fxEditor(fx,b){fx=fx||{k:'gain',n:100};
  return `<label>효과<select class="inp" id="fxk">${Object.entries(FX_KO).filter(([k])=>k!=='none').map(([k,v])=>`<option value="${k}" ${fx.k===k?'selected':''}>${v}</option>`).join('')}</select></label>
    <label>효과 값 (달란트·칸 수·%)<input class="inp" id="fxn" type="number" value="${fx.n==null?'':fx.n}"></label>
    <label>이동할 칸 이름 (칸으로 이동일 때)<input class="inp" id="fxto" value="${esc(fx.to||'')}" placeholder="예: 여리고 · 출발은 @start"></label>`}
function bindFx(root){}
function readFx(root){const k=$('#fxk',root).value,n=$('#fxn',root).value,to=$('#fxto',root).value.trim();const r=fxFrom(FX_KO[k],n,to);return r.err?{k,err:r.err}:r.fx}
/* 불러오기 결과: 오류가 있으면 몇째 줄이 왜 틀렸는지 보여 주고, 맞는 줄만 가져올 수 있게 합니다 */
function showImportReport(res,what,apply){
  const L=openLayer('edit',`<div class="kick">⬆️ ${what} 불러오기</div><h3>${res.items.length?`${res.items.length}개를 가져올 수 있어요`:'가져올 수 있는 항목이 없어요'}</h3><div class="mbody">
    ${res.add!=null?`<p>새로 추가 <b>${res.add}</b> · 고치기 <b>${res.upd}</b> · 오류 <b>${res.errors.length}</b></p>`:''}
    ${res.errors.length?`<p>아래 줄은 고쳐야 가져올 수 있어요. 엑셀에서 고친 뒤 다시 불러오세요.</p><ul class="errlist">${res.errors.slice(0,200).map(e=>`<li>${e.row?`<b>${e.row}행</b>: `:''}${esc(e.msg)}</li>`).join('')}</ul>`:'<p>모든 줄이 올바른 형식이에요. 👍</p>'}</div>
    <div class="mbtns row">${res.items.length?`<button class="btn main" data-ok>${res.errors.length?'올바른 줄만 가져오기':'가져오기'}</button>`:''}<button class="btn" data-cancel>${res.items.length?'취소':'닫기'}</button></div>`,{close:true,wide:true,tone:res.errors.length?'#ff9d9d':'var(--mint)'});
  $('[data-cancel]',L.box).onclick=L.close;const ok=$('[data-ok]',L.box);if(ok)ok.onclick=()=>{L.close();try{apply()}catch(e){UI.toast(e.message,4000)}}}
