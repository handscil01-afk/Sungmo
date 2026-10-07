'use strict';
/* ================= 화면: 요청서(선택 창) =================
   엔진의 요청서를 받아 창을 그립니다. 이 기기에서 고를 수 없는 요청서는 "기다리는 중" 화면으로 보여 줍니다. */
let LAYER_SEQ=0;
/* 창 세 겹: prompt(진행 선택 창) · info(칸 정보, 설정, 콘텐츠 관리처럼 잠깐 여는 창) · edit(관리 화면 위의 편집 창·말씀 보기) */
const LAYER_ID={prompt:'pov',info:'iov',edit:'eov'};
function openLayer(layer,html,o={}){
  closeLayer(layer);const ov=document.createElement('div');ov.className='ov'+(layer==='info'?' top':layer==='edit'?' top2':'');ov.id=LAYER_ID[layer];
  ov.innerHTML=`<div class="mbox${o.wide?' wide':''}${o.full?' full':''}" role="dialog" aria-modal="true" style="${o.tone?'--tc:'+o.tone:''}">${o.close?'<button class="xclose" data-x aria-label="닫기">×</button>':''}${html}</div>`;
  document.body.appendChild(ov);const seq=++LAYER_SEQ;ov._seq=seq;
  const close=()=>{if(ov.isConnected){ov.remove();o.onClose&&o.onClose()}};
  if(o.close){$('[data-x]',ov).onclick=close;ov.addEventListener('click',e=>{if(e.target===ov)close()});ov._esc=e=>{if(e.key==='Escape'&&topLayer()===ov){e.preventDefault();close()}};document.addEventListener('keydown',ov._esc)}
  ov.addEventListener('click',e=>{const r=e.target.closest('[data-ref]');if(r){e.preventDefault();openVerse(r.dataset.ref)}});
  return {ov,box:$('.mbox',ov),close}}
const topLayer=()=>$('#eov')||$('#iov')||$('#pov');
function closeLayer(layer){const ov=$('#'+LAYER_ID[layer]);if(ov){if(ov._esc)document.removeEventListener('keydown',ov._esc);if(ov._timer)clearInterval(ov._timer);ov.remove()}}
const refHTML=ref=>ref?`<span class="ref-link" data-ref="${esc(ref)}" role="button" tabindex="0">📖 ${esc(ref)}</span>`:'';
function focusFirst(root){const f=$('.btn.main,.btn.good',root)||$('.btn',root);if(f)setTimeout(()=>f.focus({preventScroll:true}),40)}

/* ---------- 누가 이 기기에서 고를 수 있나 ---------- */
/* 화면에서 버튼을 숨기는 것과 별도로, 방장 엔진도 같은 기준(actorOf)으로 보낸 기기를 검사합니다 */
function canAct(spec){const a=spec&&spec.actor;if(!a)return false;
  if(Net.role==='client')return (a.t==='net'&&a.cid===Net.cid&&Net.kind==='player')||(a.t==='judge'&&Net.kind==='remote');
  return a.t==='local'||a.t==='judge'}
function answer(spec,v){if(!canAct(spec))return UI.toast('지금은 이 기기에서 고를 수 없어요');if(Net.role==='client')Net.input(spec.id,v);else if(spec.resolve)spec.resolve(v,'local')}
const pOf=spec=>{const g=VG();return spec.pid!=null?g.players.find(x=>x.id===spec.pid):null};
/* 기다리는 사람에게 보여 줄 말: 누가 누르면 넘어가는지 */
function waitWho(spec){const a=spec.actor||{},p=pOf(spec);return a.t==='judge'?'진행자':a.t==='ai'?'컴퓨터':p?p.name+'님':'진행자'}
function remoteNote(){return ''}
const undoBtn=()=>Net.role!=='client'&&canUndo()?'<button class="undo-in" data-undo>↶ 되돌리기</button>':'';
function bindUndo(root){const b=$('[data-undo]',root);if(b)b.onclick=()=>confirmUndo()}
/* 되돌리기는 잘못 눌러도 게임이 바뀌지 않도록 한 번 더 묻습니다 */
function confirmUndo(){if(!canUndo())return UI.toast('되돌릴 선택이 없어요');
  const L=openLayer('edit',`<div class="bigpic">↩️</div><h3>이전 게임 상태로 되돌릴까요?</h3><div class="mbody"><p>바로 전 사람의 선택 하나를 취소하고 그 직전 상태로 돌아가요. 주사위 값과 문제는 그대로예요.</p></div>
    <div class="mbtns row"><button class="btn wide" data-c>취소</button><button class="btn main wide" data-u>↩️ 되돌리기</button></div>`,{tone:'var(--accent)',close:true});
  $('[data-c]',L.box).onclick=L.close;$('[data-u]',L.box).onclick=()=>{L.close();undo()};setTimeout(()=>$('[data-c]',L.box).focus(),40)}

UI.showPrompt=function(spec){UI.curSpec=spec;const act=canAct(spec);
  switch(spec.kind){
    case 'roll':return showRoll(spec,act);
    case 'buy':case 'upgrade':case 'ark':case 'wild':return act?showChoice(spec):watchMsg(spec);
    case 'fly':return act?showFly(spec):watchMsg(spec);
    case 'notice':case 'card':return showNotice(spec,act);
    case 'qa':case 'qv':case 'qj':case 'qs':case 'qr':return showQuiz(spec,act);
    case 'end':return showEnd(spec,act);
  }};
UI.clearPrompt=function(){UI.curSpec=null;closeLayer('prompt');const a=$('#cAct');if(a)a.innerHTML='';document.body.classList.remove('padopen');
  window.__pick=null;$('#board')?.classList.remove('picking');const pb=$('#pickBar');if(pb)pb.hidden=true};
function watchMsg(spec){const p=pOf(spec);if(!p)return;const what={buy:'땅을 살지',upgrade:'건물을 지을지',ark:'방주 카드를 쓸지',wild:'어떻게 벗어날지',fly:'날아갈 칸을'}[spec.kind]||'';
  UI.setMsg(`<b>${esc(p.name)}</b>${p.ai?' 🤖':''}, ${what} 고르고 있어요…`)}

/* ---------- 주사위 ---------- */
function showRoll(spec,act){const p=pOf(spec),box=$('#cAct');if(!box)return;
  UI.setMsg(spec.label||`<b>${esc(p.name)}</b>, 주사위를 굴려 주세요.`);
  if(!act){box.innerHTML=`<div class="watch">${esc(p.name)}님${(spec.actor||{}).t==='judge'?'(진행자가 조작)':''}이 주사위를 굴리기를 기다려요</div>`;return}
  let sel=[0,0];const real=spec.mode==='real';
  const padHTML=()=>`<div class="dpad"><span class="pl">🎲 실물 주사위를 굴려서 나온 숫자를 눌러 주세요</span>
    ${[0,1].map(d=>`<div class="drow"><em>${d?'둘째':'첫째'}</em>${[1,2,3,4,5,6].map(v=>`<button type="button" class="dbtn${sel[d]===v?' on':''}" data-d="${d}" data-v="${v}" aria-label="${d?'둘째':'첫째'} 주사위 ${v}">${pipHTML(v)}</button>`).join('')}</div>`).join('')}
    <button class="btn main" id="padGo" ${sel[0]&&sel[1]?'':'disabled'}>${sel[0]&&sel[1]?`${sel[0]+sel[1]}칸 이동하기`:'두 숫자를 골라 주세요'}</button>
    <button class="linkbtn" id="toScreen">화면 주사위로 대신 굴리기</button></div>`;
  const showPad=()=>{document.body.classList.add('padopen');box.innerHTML=padHTML();
    $$('.dbtn',box).forEach(b=>b.onclick=()=>{sel[+b.dataset.d]=+b.dataset.v;showPad()});
    $('#padGo',box).onclick=()=>answer(spec,{d:[sel[0],sel[1]]});$('#toScreen',box).onclick=showBtn};
  const showBtn=()=>{document.body.classList.remove('padopen');
    box.innerHTML=`<button class="btn main" id="rollBtn">🎲 주사위 굴리기</button>${real?'<button class="linkbtn" id="toPad">실물 주사위 숫자 입력하기</button>':''}`;
    const rb=$('#rollBtn',box);rb.onclick=()=>{rb.disabled=true;answer(spec,{s:1})};rb.focus({preventScroll:true});if($('#toPad',box))$('#toPad',box).onclick=showPad};
  real?showPad():showBtn()}
document.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!$('#pov')&&!$('#iov')&&$('#rollBtn')&&document.activeElement?.tagName!=='INPUT'){e.preventDefault();$('#rollBtn').click()}});

/* ---------- 땅 사기 · 건물 · 방주 · 광야 ---------- */
function tollTable(g,i,curL){const t=g.board.tiles[i];
  if(t.t==='spot')return `<table class="ttab"><tr${curL===0?' class="cur"':''}><td>명소 1곳</td><td>통행료 50</td></tr><tr${curL===1?' class="cur"':''}><td>명소 모두</td><td>통행료 150</td></tr></table>`;
  return `<table class="ttab">${LV.map((n,l)=>`<tr${l===curL?' class="cur"':''}><td>${BLD[l]} ${n}${l?` <span class="muted">(짓는 값 ${r10(t.price*.5)})</span>`:''}</td><td>통행료 ${r10(t.price*MULT[l])}</td></tr>`).join('')}</table>${g.cfg.monopoly?'<p class="ref">같은 색 땅을 모두 가지면 통행료 2배</p>':''}`}
function showChoice(spec){const g=VG(),p=pOf(spec);let o;
  if(spec.kind==='buy'){const t=g.board.tiles[spec.tile];
    o={pic:t.pic,tone:spec.tone,kick:`${t.t==='city'?esc(g.board.groups[t.g]):'명소'} · ${esc(p.name)}의 차례`,title:`${REUL(t.name)} 살까요?`,
      body:`<p>${esc(t.note||'')}</p>${refHTML(t.ref)}${tollTable(g,spec.tile,0)}<p>땅값 <b>${fmt(t.price)}</b> · 사고 나면 <b>${fmt(p.money-t.price)}</b> 달란트가 남아요.</p>`,
      btns:[[`🚩 ${fmt(t.price)} 달란트로 사기`,true,'main'],['사지 않고 지나가기',false]]}}
  else if(spec.kind==='upgrade'){const t=g.board.tiles[spec.tile],o2=g.own[spec.tile],c=r10(t.price*.5),next=r10(t.price*MULT[o2.l+1])*(g.cfg.monopoly&&hasGroupIn(g,p.id,t.g)?2:1);
    o={pic:BLD[o2.l+1],tone:spec.tone,kick:`${esc(t.name)} · 내 땅`,title:`${t.name}에 ${REUL(LV[o2.l+1])} 지을까요?`,
      body:`<p>통행료가 <b>${fmt(tollOfIn(g,spec.tile))}</b>에서 <b>${fmt(next)}</b>${batchim(String(next))?'으로':'로'} 올라요.</p>${tollTable(g,spec.tile,o2.l)}`,
      btns:[[`${BLD[o2.l+1]} ${fmt(c)} 달란트로 짓기`,true,'main'],['다음에 짓기',false]]}}
  else if(spec.kind==='ark'){o={pic:'🚢',tone:'#86d5ea',kick:'노아의 방주',title:`통행료 ${fmt(spec.amt)}, 방주 카드를 쓸까요?`,body:`<p>방주 카드를 쓰면 이번 통행료를 내지 않아요. 남은 방주 카드: <b>${p.ark}장</b></p>`,
      btns:[['🚢 방주 카드로 면제받기',true,'main'],[g.cfg.tollQuiz?'카드는 아끼고 말씀 찬스 도전':'카드는 아끼고 통행료 내기',false]]}}
  else{const t=g.board.tiles[p.pos],L={quiz:['❓ 말씀 퀴즈로 탈출','main'],dice:['🎲 주사위 굴리기 (더블이면 탈출)'],song:[`🎵 찬송 카드 쓰기 (${p.song}장)`],pay:['🪙 헌금 100 내고 나가기']};
    o={pic:t.pic,tone:'#ffcf8a',kick:`${esc(t.name)} · 남은 차례 ${p.jail}`,title:`${esc(p.name)}, 어떻게 벗어날까요?`,body:`<p>${g.cfg.jailQuiz?'<b>말씀 퀴즈</b>를 맞히면 바로 벗어나 주사위를 굴려요. ':''}<b>주사위</b>를 골라 더블이 나오면 나온 수만큼 바로 이동해요.</p>`,
      btns:spec.opts.map(k=>[L[k][0],k,L[k][1]||''])}}
  const {box}=openLayer('prompt',`<div class="mtop"><span class="sp"></span>${undoBtn()}</div>${o.pic?`<div class="bigpic">${esc(o.pic)}</div>`:''}<div class="kick">${o.kick}</div><h3>${esc(o.title)}</h3><div class="mbody">${o.body}${remoteNote(spec)}</div>
    <div class="mbtns${o.btns.length===2?' row':''}">${o.btns.map((b,k)=>`<button class="btn ${b[2]||''} wide" data-k="${k}">${b[0]}</button>`).join('')}</div>`,{tone:o.tone});
  $$('[data-k]',box).forEach(b=>b.onclick=()=>{$$('[data-k]',box).forEach(x=>x.disabled=true);answer(spec,o.btns[+b.dataset.k][1])});bindUndo(box);focusFirst(box)}
function hasGroupIn(g,pid,grp){const s=G;G=g;try{return hasGroup(pid,grp)}finally{G=s}}
function showFly(spec){const g=VG(),p=pOf(spec),t=g.board.tiles[p.pos];
  const {box,close}=openLayer('prompt',`<div class="mtop"><span class="sp"></span>${undoBtn()}</div><div class="bigpic">${esc(t.pic)}</div><div class="kick">${esc(t.name)}</div><h3>원하는 칸으로 날아가요</h3>
    <div class="mbody"><p>${esc(t.note||'')}</p>${refHTML(t.ref)}<p>확인을 누른 뒤 <b>보드에서 날아갈 칸</b>을 누르세요. 가는 길에 출발 칸을 지나면 축복금을 받아요.</p>${remoteNote(spec)}</div>
    <div class="mbtns"><button class="btn main wide" id="flyGo">칸 고르기</button></div>`,{tone:'#ffb08a'});
  bindUndo(box);focusFirst(box);
  $('#flyGo',box).onclick=()=>{close();
    /* 게임판이 없는 휴대폰 상황판 화면에서는 칸 목록에서 고릅니다 */
    if(!$('#board .tile')){const L=openLayer('prompt',`<div class="kick">${esc(t.name)}</div><h3>날아갈 칸을 골라 주세요</h3><div class="flylist">${g.board.tiles.map((x,i)=>x.t==='fly'?'':`<button class="btn sm" data-fl="${i}"${x.t==='city'?` style="box-shadow:inset .35rem 0 0 ${GROUP_COLORS[x.g]},0 2px 0 var(--line)"`:''}>${esc(x.pic)} ${esc(x.name)}</button>`).join('')}</div>`,{tone:'#ffb08a',wide:true});
      $$('[data-fl]',L.box).forEach(b=>b.onclick=()=>{$$('[data-fl]',L.box).forEach(x=>x.disabled=true);answer(spec,+b.dataset.fl)});return}
    UI.setMsg('보드에서 날아갈 칸을 눌러 주세요.');$('#board').classList.add('picking');$('#pickBar').hidden=false;
    window.__pick=i=>{if(g.board.tiles[i].t==='fly')return UI.toast('다른 칸을 골라 주세요');window.__pick=null;$('#board').classList.remove('picking');$('#pickBar').hidden=true;answer(spec,i)}}}
function showNotice(spec,act){const p=pOf(spec);
  const {box}=openLayer('prompt',`${spec.pic?`<div class="bigpic">${esc(spec.pic)}</div>`:''}<div class="kick">${esc(spec.kick||'')}${p?` · ${esc(p.tok)} ${esc(p.name)}`:''}</div><h3>${esc(spec.title||'')}</h3>
    <div class="mbody">${spec.body||''}${refHTML(spec.ref)}</div>${act?`<div class="mbtns"><button class="btn main wide" data-ok>확인</button></div>`:`<div class="watch">${(spec.actor||{}).t==='ai'?'잠시 뒤 다음으로 넘어가요':`${esc(waitWho(spec))}${(spec.actor||{}).t==='judge'?'가':'이'} 확인하면 넘어가요`}</div>`}`,{tone:spec.tone});
  if(act){$('[data-ok]',box).onclick=()=>answer(spec,true);focusFirst(box)}}

/* ---------- 퀴즈 ---------- */
function showQuiz(spec,act){UI.renderQuiz(spec.quiz,spec,act)}
UI.showQuizResult=quiz=>UI.renderQuiz(quiz,{kind:'qr',quiz},false);
UI.renderQuiz=function(Q,spec,act){
  const g=VG(),q=Q.q,stage=spec.kind;
  /* 지금 답하는 사람: 답하기·컴퓨터 답 보기·판정 단계는 요청서의 사람, 기회 넘기기·결과 단계는 처음 문제를 받은 사람 */
  const actor=g.players.find(x=>x.id===(['qa','qv','qj','qo'].includes(stage)?spec.pid:Q.pid))||g.players[0],who=actor,isSteal=actor.id!==Q.pid;
  const isMC=q.t==='mc',lc={easy:'#1f9a66',normal:'#3b8eea',hard:'#b04fd0'}[q.lv],last=Q.tries[Q.tries.length-1]||{};
  const tried=new Set(Q.tries.filter(t=>t.choice>=0&&t.ok===false).map(t=>t.choice));
  const result=stage==='qr';
  /* 보기 */
  let opts='';
  if(isMC)opts=`<div class="qopts">${q.choices.map((c,k)=>{let cls='';
      if(result){if(k===q.ans)cls='ok';else if(tried.has(k))cls='no'}else if(tried.has(k))cls='no';
      const can=act&&stage==='qa'&&!tried.has(k);return `<button class="qo ${cls}" data-k="${k}" ${can?'':'disabled'}><b>${k+1}</b><span>${esc(c)}</span></button>`}).join('')}</div>`;
  /* 상태 상자 */
  let status='';const nm=p=>p?`${esc(p.tok)} ${esc(p.name)}`:'';
  const typed=last.text?`<span class="typed">✍️ 입력한 답: <b>${esc(last.text)}</b></span>`:'';
  /* 정답은 진행자 전용 화면에서만 보여 줍니다: 혼자·한 기기 게임, 진행자 리모컨, 게임 화면 창을 따로 띄운 PC의 진행자 창 */
  const seeAns=act&&spec.secret&&(!Net.role||Net.kind==='remote'||Net.hostSeesAnswers());
  if(stage==='qv')status=`<div class="qres wait"><b class="h">🤔 ${nm(who)} 생각 중…</b>문제를 함께 읽고 생각해 보세요. 계속하기를 누르면 컴퓨터의 답이 나와요.</div>`;
  else if(stage==='qa'&&!isMC)status=spec.type==='text'?`<div class="qres wait"><b class="h">✍️ 답을 입력해 주세요</b>띄어쓰기는 조금 달라도 괜찮아요. 입력하면 게임이 바로 채점해요.</div>`
    :`<div class="qres wait"><b class="h">🗣️ 소리 내어 답해 보세요</b>${Net.mode==='relay'||(Net.role==='client'&&Net.mode==='relay')?`${nm(who)}님이 답을 말하거나 휴대폰에 입력하면 진행자가 판정해요.`:`${nm(who)}님이 답을 말한 뒤 <b>정답 공개하기</b>를 누르세요.`}</div>`;
  else if(stage==='qj'){status=`<div class="qres wait"><b class="h">⚖️ 진행자 판정</b>${nm(who)}님의 답이 맞았나요?${last.timeout?' (시간이 다 됐어요)':''}${typed}</div>`;
    if(seeAns)status+=`<details class="secret" ${Net.kind==='remote'||Net.hostSeesAnswers()?'open':''}><summary class="cute">👀 정답 보기 (진행자용)</summary><div class="ans">${esc(spec.secret.a)}</div>${spec.secret.alt&&spec.secret.alt.length?`<div class="ref">함께 인정: ${esc(spec.secret.alt.join(', '))}</div>`:''}${last.text?`<div class="ref">자동 비교: 입력한 답이 정답과 ${spec.secret.match?'<b style="color:var(--good)">같아요</b>':'<b style="color:var(--bad)">달라요</b>'}</div>`:''}${spec.secret.ex?`<div class="ref">${esc(spec.secret.ex)}</div>`:''}</details>`}
  else if(stage==='qo')status=`<div class="qres no"><b class="h">🙋 다른 팀 기회</b>${nm(who)}님, 이 문제에 도전할까요? 맞히면 <b>상금의 절반</b>을 받아요.${typed}</div>`;
  else if(stage==='qs')status=`<div class="qres no"><b class="h">😢 ${nm(who)} ${last.timeout?'시간이 다 됐어요':'틀렸어요'}</b>다른 팀에게 기회를 줄까요? 맞히면 <b>상금의 절반</b>을 받아요.</div>`;
  else if(result){const by=Q.by!=null?g.players.find(x=>x.id===Q.by):null;
    const head=by?(by.id===Q.pid?`🎉 ${nm(by)} 정답이에요!`:`🎉 ${nm(by)} 기회를 살렸어요!`):(Q.tries.some(t=>t.timeout)?'⏰ 시간이 다 됐어요':'😢 아쉬워요, 틀렸어요');
    const said=Q.tries.filter(t=>t.text).map(t=>{const p=g.players.find(x=>x.id===t.pid);return `${p?esc(p.name):''}: ${esc(t.text)}`}).join(' · ');
    status=`<div class="qres ${by?'ok':'no'}"><b class="h">${head}</b>${said?`<span class="typed">✍️ 입력한 답 · ${said}</span>`:''}<span class="ans">정답: ${esc(isMC?q.choices[q.ans]:q.a)}</span>${!isMC&&q.alt&&q.alt.length?`<span class="ex">함께 인정: ${esc(q.alt.join(', '))}</span>`:''}${q.ex?`<span class="ex">${esc(q.ex)}</span>`:''}${q.ref?`<span class="ex">${refHTML(q.ref)}</span>`:''}</div>`}
  /* 버튼 */
  let btns='';
  if(act){
    if(stage==='qa'&&!isMC){const canType=spec.type==='text'||Net.role==='client';
      btns=`${canType?`<form class="saform" id="saf"><input class="inp" id="sai" maxlength="80" autocomplete="off" enterkeyhint="done" placeholder="여기에 답을 입력하세요" aria-label="답 입력"><button class="btn main" type="submit">✍️ 답 내기</button></form>`:''}
        ${spec.type==='text'?'':`<button class="btn ${canType?'':'main'} wide" data-a="reveal">${Net.role==='client'||Net.mode==='relay'?'🗣️ 말로 답했어요 · 진행자 판정':'정답 공개하고 판정하기'}</button>`}`}
    if(stage==='qo')btns=`<div class="judge"><button class="btn main" data-a="yes">🙋 도전하기</button><button class="btn" data-a="no">넘기기</button></div>`;
    if(stage==='qv')btns=`<button class="btn main wide" data-a="ok">계속하기 · 컴퓨터 답 보기</button>`;
    if(stage==='qj')btns=`<div class="judge"><button class="btn good" data-a="yes">⭕ 정답</button><button class="btn bad" data-a="no">❌ 오답</button></div>`;
    if(stage==='qs')btns=`<div class="steal">${(spec.cands||[]).map(id=>{const p=g.players.find(x=>x.id===id);return `<button class="btn" style="box-shadow:inset 0 0 0 3px ${p.col},0 3px 0 var(--line)" data-s="${id}">${esc(p.tok)} ${esc(p.name)}에게 기회</button>`}).join('')}<button class="btn" data-s="-1">기회 넘기지 않기</button></div>`;
    if(result)btns=`<button class="btn main wide" data-a="ok">계속하기</button>`}
  else if(stage!=='qr'||spec.id){const w=esc(waitWho(spec)),ga=(spec.actor||{}).t==='judge'?'가':'이';
    btns=`<div class="watch">${stage==='qa'?`${nm(who)}님이 ${isMC?'답을 고르는':'답하는'} 중이에요`:stage==='qo'?`${nm(who)}님이 도전할지 고르는 중이에요`:stage==='qj'||stage==='qs'?'진행자가 고르는 중이에요':stage==='qv'?`${w}${ga} 계속하기를 누르면 컴퓨터의 답이 나와요`:(spec.actor||{}).t==='ai'?'잠시 뒤 넘어가요':`${w}${ga} 계속하기를 누르면 넘어가요`}</div>`}
  const timer=stage==='qa'&&spec.time>0?`<div class="qtimer" id="qt"><i style="width:100%"></i><b>${spec.time}초</b></div>`:'';
  const html=`<div class="mtop"><div class="kick">${Q.kick}<span class="lvchip" style="--lc:${lc}">${LV_KO[q.lv]}</span><span class="lvchip" style="--lc:${isMC?'#8f88aa':'#2f5fb3'}">${isMC?'객관식':'주관식'}</span></div><span class="sp"></span>${act||Net.role!=='client'?undoBtn():''}</div>
    <div class="quiz two"><div class="qleft">${Q.sub?`<div class="ref">${Q.sub}</div>`:''}<div class="qwho"><span class="tok" style="--pc:${actor.col}">${esc(actor.tok)}</span>${esc(actor.name)}${isSteal?' · 다른 팀 기회':''}</div>${timer}<p class="qtext">${esc(q.q)}</p>${status}</div>
    <div class="qright">${opts}${btns}${remoteNote(spec)}</div></div>`;
  const {ov,box}=openLayer('prompt',html,{tone:lc,wide:true});bindUndo(box);
  if(act){
    $$('.qo[data-k]',box).forEach(b=>b.onclick=()=>{if(b.disabled)return;$$('.qo',box).forEach(x=>x.disabled=true);answer(spec,+b.dataset.k)});
    $$('[data-a]',box).forEach(b=>b.onclick=()=>{$$('[data-a]',box).forEach(x=>x.disabled=true);const a=b.dataset.a;answer(spec,a==='reveal'?'reveal':a==='yes'?true:a==='no'?false:true)});
    $$('[data-s]',box).forEach(b=>b.onclick=()=>{$$('[data-s]',box).forEach(x=>x.disabled=true);answer(spec,+b.dataset.s)});
    const sf=$('#saf',box);if(sf){sf.onsubmit=e=>{e.preventDefault();const t=$('#sai',box).value.trim();if(!t)return UI.toast('답을 입력해 주세요');$$('button',box).forEach(x=>x.disabled=true);answer(spec,{text:t.slice(0,80)})};setTimeout(()=>$('#sai',box).focus({preventScroll:true}),80)}
    focusFirst(box)}
  /* 제한 시간: 방장·혼자 하는 기기가 시간을 재고, 참가자 기기는 남은 시간만 보여 줍니다 */
  if(stage==='qa'&&spec.time>0){const t0=performance.now()-(spec.elapsed||0),total=spec.time*1000,bar=$('#qt i',box),lab=$('#qt b',box),qt=$('#qt',box);let lastS=spec.time;
    ov._timer=setInterval(()=>{if(!ov.isConnected){clearInterval(ov._timer);return}const rem=Math.max(0,total-(performance.now()-t0)),s=Math.ceil(rem/1000);
      bar.style.width=(rem/total*100)+'%';lab.textContent=s+'초';qt.classList.toggle('hurry',s<=5);if(s<lastS&&s<=5&&s>0)SND.play('tick');lastS=s;
      if(rem<=0){clearInterval(ov._timer);if(Net.role!=='client'&&spec.resolve)spec.resolve(-1,'timer')}},100)}
  const kd=e=>{if(!ov.isConnected){document.removeEventListener('keydown',kd);return}if($('#iov'))return;
    if(act&&stage==='qa'&&isMC&&/^[1-6]$/.test(e.key)){const b=$(`.qo[data-k="${+e.key-1}"]`,box);if(b&&!b.disabled)b.click()}};
  document.addEventListener('keydown',kd)};

/* ---------- 게임 결과 ---------- */
function showEnd(spec,act){const g=VG(),rank=g.players.slice().sort((a,b)=>(a.out-b.out)||worthIn(g,b)-worthIn(g,a)),w=rank[0];
  UI.setMsg(`🏆 <b>${esc(w.name)}</b> 승리!`);
  const {box}=openLayer('prompt',`<div class="mtop"><span class="sp"></span>${undoBtn()}</div><div class="bigpic">🏆</div><div class="kick">${g.players.filter(p=>!p.out).length<=1?'한 명만 남았어요':'정해진 라운드가 끝났어요'}</div><h3>${esc(IGA(w.name))} 이겼어요!</h3>
    <div class="mbody"><ol class="rank">${rank.map((p,k)=>`<li><span class="no">${['🥇','🥈','🥉'][k]||k+1}</span><span class="tok" style="--pc:${p.col}">${esc(p.tok)}</span><span class="who">${esc(p.name)}<small>${p.out?'파산':`현금 ${fmt(p.money)} · 땅 ${Object.values(g.own).filter(o=>o.o===p.id).length}곳`}</small></span><span class="amt">${p.out?'-':fmt(worthIn(g,p))}</span></li>`).join('')}</ol>
    <p class="ref">총자산은 현금과 땅값, 지은 건물값을 모두 더한 금액입니다.</p></div>
    <div class="mbtns">${Net.role==='client'?'<button class="btn main wide" data-v="leave">처음 화면으로</button>':'<button class="btn main wide" data-v="again">같은 설정으로 다시 하기</button><button class="btn wide" data-v="home">처음 화면으로</button>'}</div>`,{tone:'var(--g7)'});
  bindUndo(box);$$('[data-v]',box).forEach(b=>b.onclick=()=>{const v=b.dataset.v;if(v==='leave'){Net.leave();App.home();return}answer(spec,v)});focusFirst(box)}

/* ---------- 보드 칸 정보 ---------- */
function onTileClick(i){
  if(window.__pick){window.__pick(i);return}
  const g=VG();if(!g)return;const t=g.board.tiles[i],o=g.own[i];let body='',kick='',tone='var(--sky-2)';
  if(t.t==='city'||t.t==='spot'){kick=t.t==='city'?esc(g.board.groups[t.g]):'명소';tone=t.t==='city'?GROUP_COLORS[t.g]:'#86d5ea';const ow=o?g.players.find(x=>x.id===o.o):null;
    body=`<p>${esc(t.note||'')}</p>${refHTML(t.ref)}<p>땅값 <b>${fmt(t.price)}</b> · ${ow?`주인 <span class="cute" style="color:${ow.col}">${esc(ow.tok)} ${esc(ow.name)}</span> · ${BLD[o.l]} ${LV[o.l]} · 지금 통행료 <b>${fmt(tollOfIn(g,i))}</b>`:'주인 없음'}</p>${tollTable(g,i,o?(t.t==='spot'?(tollOfIn(g,i)>50?1:0):o.l):-1)}`}
  else{const D={start:`출발 칸을 지나거나 이 칸에 도착하면 축복금 <b>${g.cfg.salary}</b> 달란트를 받아요.`,card:'말씀 카드를 한 장 뽑아 적힌 대로 해요. 방주 카드와 찬송 카드는 보관했다가 필요할 때 써요.',
      quiz:'말씀 퀴즈를 맞히면 쉬움 <b>100</b>, 보통 <b>150</b>, 어려움 <b>200</b> 달란트를 받아요.',jail:`도착하면 다음 차례부터 최대 <b>${g.cfg.jailTurns}번</b> 머물러요. 퀴즈를 맞히거나, 더블이 나오거나, 헌금 100을 내면 나올 수 있어요.`,
      pot:'헌금함에 모인 달란트를 모두 받아요. 십일조와 벌금이 헌금함에 쌓여요.',fly:'원하는 칸으로 바로 날아가요.',tithe:'가진 달란트의 10%를 헌금함에 넣어요.',event:esc(t.fx?fxText(t.fx):'')};
    kick='특별 칸';body=`${t.note?`<p>${esc(t.note)}</p>`:''}<p>${D[t.t]||''}</p>${refHTML(t.ref)}`}
  openInfo(kick,`${t.pic} ${t.name}`,body,tone)}
function openInfo(kick,title,body,tone,wide){const L=openLayer('info',`<div class="kick">${kick}</div><h3>${esc(title)}</h3><div class="mbody">${body}</div><div class="mbtns"><button class="btn wide" data-close>닫기</button></div>`,{tone,wide,close:true});
  $('[data-close]',L.box).onclick=L.close;setTimeout(()=>$('[data-close]',L.box).focus({preventScroll:true}),40);return L}

/* ---------- 말씀 보기 ---------- */
async function openVerse(ref){
  const refs=parseRefs(ref);await Bible.load().catch(()=>{});
  let body='';
  if(!refs.length)body=`<div class="verse-empty">"${esc(ref)}"는 성경 구절 형식이 아니어서 본문을 찾을 수 없어요.</div>`;
  for(const r of refs){
    const name=BOOKS[r.b][1];let vs='';
    if(Bible.data){const lines=[];
      for(let c=r.c1;c<=r.c2;c++){const len=Bible.chapterLen(r.b,c);if(!len)continue;
        const ranges=r.v&&!r.vEnd?r.v:[[c===r.c1&&r.v?r.v[0][0]:1,c===r.c2&&r.vEnd?r.vEnd:len]];
        if(r.c1!==r.c2)lines.push(`<div class="chap">${c}장</div>`);
        for(const [s,e] of ranges)for(let v=s;v<=Math.min(e,len);v++){const tx=Bible.verse(r.b,c,v);if(tx)lines.push(`<div class="v"><sup>${v}</sup>${esc(tx)}</div>`)}}
      vs=lines.length?`<div class="verses">${lines.join('')}</div>`:`<div class="verse-empty">불러온 성경 파일에 이 구절이 없어요.</div>`}
    else vs=`<div class="verse-empty">아직 성경 본문 파일을 불러오지 않았어요. <b>콘텐츠 관리 → 성경 본문</b>에서 가지고 계신 개역개정 파일을 불러오면 여기에 본문이 크게 나와요.</div>`;
    body+=`<div class="verse-head"><span class="book">${esc(name)}</span><span class="cv">${esc(refTitle(r).replace(name+' ',''))}</span><span class="ver">개역개정</span></div>${vs}
      <p><a class="ref-link" href="${bskUrl(r)}" target="_blank" rel="noopener">대한성서공회 사이트에서 보기 ↗</a></p>`}
  const L=openLayer($('#iov')?'edit':'info',`<div class="kick">📖 말씀 보기 · ${esc(ref)}</div><div class="mbody" style="gap:1rem;margin-top:.4rem">${body}</div>
    <div class="mbtns row">${Bible.data?'':'<button class="btn" data-mgr>📚 성경 본문 불러오기</button>'}<button class="btn main" data-close>닫기</button></div>`,{tone:'#ffd657',wide:true,close:true});
  $('[data-close]',L.box).onclick=L.close;const m=$('[data-mgr]',L.box);if(m)m.onclick=()=>{L.close();Manage.open('bible')}}

/* ---------- 규칙 · 기록 ---------- */
function rulesHTML(){const g=VG();const groups=(g?g.board.groups:DEFAULT_BOARDS[0].groups);
  return `<ol class="rules">
  <li>차례가 되면 <b>주사위 두 개</b>를 굴려 나온 수만큼 이동해요. 실물 주사위를 쓰면 나온 숫자를 눌러 입력해요. 더블이면 한 번 더 굴려요.</li>
  <li>주인 없는 땅에 도착하면 <b>🚩 살 수</b> 있어요. 산 땅은 주인 색으로 칠해지고 깃발이 꽂혀요.</li>
  <li>내 땅에 다시 도착하면 <b>⛺ 장막 → 🏠 집 → 🏰 성</b> 순서로 지어요. 칸 아래의 막대(▮▮▯)가 건물 단계예요.</li>
  <li>다른 사람 땅에서는 <b>통행료</b>를 내요. 말씀 찬스 퀴즈를 맞히면 반값이 돼요.</li>
  <li>같은 색 땅을 모두 가지면 통행료가 <b>2배</b>, 명소를 모두 가지면 50에서 <b>150</b>으로 올라요.</li>
  <li>퀴즈는 객관식과 주관식이 있어요. 한 기기 게임과 중계 모드에서는 주관식을 소리 내어 답하고 진행자가 <b>정답·오답</b>을 눌러요. 여럿이 하는 플레이어 모드에서는 각자 답을 <b>입력</b>하면 게임이 채점해요(띄어쓰기 차이는 괜찮아요).</li>
  <li>설정에서 켜면 틀린 문제를 <b>다른 팀</b>이 이어 풀 수 있고, 상금은 절반이에요. 플레이어 모드에서는 차례 순서대로 다음 사람에게 기회가 가요.</li>
  <li>여럿이 함께할 때는 각자 <b>자기 자리만</b> 조작할 수 있어요. 방장도 다른 사람의 주사위나 선택을 대신할 수 없어요.</li>
  <li>잘못 눌렀다면 게임판 가운데의 <b>↩️</b> 버튼으로 바로 전 선택으로 돌아가요(한 번 더 확인해요). 주사위 값과 문제는 그대로예요. 여럿이 하는 플레이어 모드에서는 공평하게 하려고 쓰지 않아요.</li>
  <li>정해진 라운드가 끝나면 <b>총자산</b>(현금 + 땅값 + 건물값)이 가장 많은 사람이 이겨요.</li></ol>
  <div class="legend">${groups.map((n,i)=>`<span style="--gc:${GROUP_COLORS[i]}"><i></i>${esc(n)}</span>`).join('')}</div>
  <p class="ref">보드의 칸을 누르면 그 장소에 얽힌 성경 이야기를 볼 수 있어요. 📖 표시를 누르면 말씀 보기 창이 열려요.</p>`}
const showRules=()=>openInfo('게임 방법','📖 성경 부루마블 규칙',rulesHTML(),'var(--g7)',true);
function openLog(){const g=VG();if(!g)return;openInfo('진행 기록','📒 지금까지 있었던 일',`<ul class="flog">${g.log.map(e=>`<li style="${e.c?'--pc:'+e.c:''}"><i></i><span>${esc(e.m)}</span></li>`).join('')}</ul>`,'var(--sky-2)',true)}
