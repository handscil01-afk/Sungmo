'use strict';
/* ================= 화면: 메인 · 게임 설정(탭) ================= */
const DEF_PLAYERS=()=>[{name:DEF_NAMES[0],ai:false,emoji:TOKENS[0],color:PALETTE[0],dice:'screen'},{name:DEF_NAMES[1],ai:true,emoji:TOKENS[1],color:PALETTE[1],dice:'screen'}];
function loadSetup(){const s=store.get('setup',{})||{};
  const players=Array.isArray(s.players)&&s.players.length>=2?s.players.slice(0,4).map((p,k)=>({name:p.name||DEF_NAMES[k],ai:!!p.ai,emoji:p.emoji||TOKENS[p.tok]||TOKENS[k],color:p.color||PALETTE[k],dice:p.dice==='real'?'real':'screen',net:null})):DEF_PLAYERS();
  return {players,cfg:Object.assign({},DEF_CFG,s.cfg||s.set||{})}}
let SETUP=loadSetup();
const saveSetup=()=>store.set('setup',{players:SETUP.players.map(p=>({...p,net:null})),cfg:SETUP.cfg});

/* ---------- 설정 항목 정의 (게임 중 설정에서도 같이 씁니다) ---------- */
const SET_ITEMS={
  rules:[
    {k:'rounds',t:'게임 길이',d:'"파산까지"는 한 명만 남거나 50라운드가 지나면 끝나요.',seg:[[10,'10라운드'],[20,'20라운드'],[30,'30라운드'],[0,'파산까지']]},
    {k:'money',t:'시작 달란트',d:'게임을 시작할 때만 정할 수 있어요.',seg:[[1500,'1,500'],[2000,'2,000'],[3000,'3,000']],setupOnly:1},
    {k:'salary',t:'출발 축복금',d:'출발 칸을 지나거나 도착하면 받는 달란트예요.',seg:[[100,'100'],[200,'200'],[300,'300']]},
    {k:'jailTurns',t:'광야에 머무는 차례',seg:[[1,'1번'],[2,'2번'],[3,'3번']]},
    {k:'monopoly',t:'같은 색 땅 모두 가지면 통행료 2배',sw:1},
    {k:'doubleAgain',t:'더블이면 한 번 더',d:'세 번 연속 더블이면 광야로 가요.',sw:1},
    {k:'cards',t:'말씀 카드',d:'끄면 카드 칸은 그냥 쉬어 가는 칸이 돼요.',sw:1}],
  quiz:[
    {k:'diff',t:'퀴즈 난이도',seg:[['easy','쉬움'],['normal','보통'],['hard','어려움'],['mix','섞어서']]},
    {k:'qmc',t:'객관식 문제',sw:1},{k:'qsa',t:'주관식 문제',d:'소리 내어 답하고 진행자가 정답·오답을 눌러요. 컴퓨터 차례에는 객관식만 나와요.',sw:1},
    {k:'quizTime',t:'퀴즈 제한 시간',d:'시간이 다 되면 틀린 것으로 처리해요. 컴퓨터는 시간 제한이 없어요.',seg:[[0,'없음'],[10,'10초'],[15,'15초'],[20,'20초'],[30,'30초'],[60,'60초']],full:1},
    {k:'tollQuiz',t:'통행료 말씀 찬스',d:'남의 땅에서 퀴즈를 맞히면 통행료 반값',sw:1},
    {k:'quizTile',t:'말씀 퀴즈 칸',d:'끄면 퀴즈 없이 100 달란트',sw:1},
    {k:'jailQuiz',t:'광야 탈출 퀴즈',sw:1},
    {k:'steal',t:'다른 팀에게 기회',d:'퀴즈 칸·보너스 퀴즈를 틀리면 진행자가 다른 팀에게 기회를 줄 수 있어요. 상금은 절반이에요. 통행료 감면·광야 탈출은 넘기지 않아요.',sw:1,full:1},
    {k:'aiQuiz',t:'컴퓨터 차례 퀴즈 진행',d:'직접 넘기기를 고르면 문제를 함께 읽고 계속하기를 눌러야 답이 나와요.',seg:[['manual','직접 넘기기'],['auto','자동으로']]}],
  play:[
    {k:'ai',t:'컴퓨터 실력',d:'컴퓨터의 퀴즈 정답률이 달라져요.',seg:[['easy','쉬움'],['normal','보통'],['hard','어려움']]},
    {k:'speed',t:'진행 속도',d:'말이 움직이고 컴퓨터가 고르는 빠르기예요.',seg:[['slow','느리게'],['normal','보통'],['fast','빠르게']],pref:1}],
  etc:[
    {k:'textScale',t:'글자 크기',d:'TV나 큰 화면에서 멀리 볼 때는 크게 하세요.',seg:[[.9,'작게'],[1,'보통'],[1.15,'크게'],[1.3,'아주 크게']],pref:1},
    {k:'sound',t:'효과음',sw:1,pref:1},
    {k:'autoFS',t:'자동 전체화면',d:'화면을 처음 누르면 전체화면으로 바뀌어요.',sw:1,pref:1}],
};
function itemsHTML(list,cfg,inGame){return list.map(it=>{const src=it.pref?PREF:cfg,v=src[it.k],off=inGame&&it.setupOnly;
  const ctl=it.sw?`<button type="button" class="sw" role="switch" aria-checked="${!!v}" aria-label="${esc(it.t)}" data-k="${it.k}"></button>`
    :`<div class="seg" data-k="${it.k}">${it.seg.map(([val,l])=>`<button type="button" data-v="${val}" class="${String(v)===String(val)?'on':''}">${l}</button>`).join('')}</div>`;
  return `<div class="srow${off?' off':''}${it.full?' full':''}"><div class="tx"><b>${esc(it.t)}</b>${it.d?`<small>${esc(it.d)}</small>`:''}</div>${ctl}</div>`}).join('')}
function bindItems(root,list,cfg,onChange){const find=k=>list.find(i=>i.k===k);
  $$('.sw[data-k]',root).forEach(b=>{const it=find(b.dataset.k);if(!it)return;b.onclick=()=>{const src=it.pref?PREF:cfg;src[it.k]=!src[it.k];b.setAttribute('aria-checked',!!src[it.k]);if(it.pref){savePref();App.prefChanged()}onChange&&onChange(it.k)}});
  $$('.seg[data-k]',root).forEach(seg=>{const it=find(seg.dataset.k);if(!it)return;seg.onclick=e=>{const b=e.target.closest('button');if(!b)return;const src=it.pref?PREF:cfg;
    src[it.k]=typeof it.seg[0][0]==='number'?+b.dataset.v:b.dataset.v;$$('button',seg).forEach(x=>x.classList.toggle('on',x===b));if(it.pref){savePref();App.prefChanged()}onChange&&onChange(it.k)}})}

/* ---------- 메인 화면 ---------- */
const Home={
  show(){const h=$('#home'),save=hasSave(),netSave=Net.savedSession();
    h.innerHTML=`<div class="logo"><div class="big">${logoHTML('성경 부루마블')}</div><p>주사위를 굴려 성경의 땅을 여행하고, 말씀 퀴즈로 함께 배워요. 🐑🕊️🐟🦁</p></div>
      ${installBanner()}
      <div class="menu">
        ${save?`<button class="mi resume" data-m="resume"><span class="e">▶️</span><b>이어하기</b><small>${esc(save.G.players.map(p=>p.name).join(' · '))} · ${esc(save.G.board.name)} 판 · ${save.G.round}라운드</small></button>`:''}
        ${netSave?`<button class="mi resume" data-m="rejoin"><span class="e">📶</span><b>방 다시 들어가기</b><small>방 코드 ${esc(netSave.code)}</small></button>`:''}
        <button class="mi main" data-m="start"><span class="e">🎲</span><b>게임 시작</b><small>인원과 규칙을 정하고 시작해요</small></button>
        <button class="mi" data-m="net"><span class="e">👥</span><b>함께하기</b><small>방을 만들거나 방 코드로 참가해요</small></button>
        <button class="mi" data-m="manage"><span class="e">📚</span><b>콘텐츠 관리</b><small>퀴즈 · 보드 · 카드 · 성경 본문</small></button>
        <button class="mi" data-m="rules"><span class="e">📖</span><b>게임 방법</b><small>규칙을 읽어 봐요</small></button>
        <button class="mi" data-m="settings"><span class="e">⚙️</span><b>화면·소리</b><small>글자 크기, 효과음, 전체화면</small></button>
      </div>`;
    $$('[data-m]',h).forEach(b=>b.onclick=()=>{const m=b.dataset.m;
      if(m==='resume')resumeGame(hasSave());else if(m==='rejoin')Net.rejoin();else if(m==='start')Setup.open();else if(m==='net')NetUI.open();
      else if(m==='manage')Manage.open();else if(m==='rules')showRules();else if(m==='settings')Setup.openPrefs()});
    bindInstall(h)}
};

/* ---------- 게임 설정 창 ---------- */
const TABS=[['people','👥','인원·캐릭터'],['board','🗺️','보드 판'],['rules','🎯','게임 규칙'],['quiz','❓','퀴즈'],['play','🎲','플레이 방식'],['etc','⚙️','기타']];
const Setup={tab:'people',L:null,
  open(tab){this.tab=tab||'people';this.inGame=false;this.render()},
  openPrefs(){this.inGame=false;this.tab='etc';this.render(true)},
  /* 게임 중 설정: 규칙·퀴즈·플레이·기타만 바꿀 수 있어요 */
  openInGame(){this.inGame=true;this.tab='quiz';this.render()},
  render(prefsOnly){
    const tabs=this.inGame?TABS.filter(t=>!['people','board'].includes(t[0])):prefsOnly?TABS.filter(t=>t[0]==='etc'):TABS;
    this.prefsOnly=!!prefsOnly;
    const host=Net.role==='host'&&!this.inGame;
    const html=`<div class="setwin"><div class="shead"><h3 class="cute">${this.inGame?'⚙️ 게임 중 설정':prefsOnly?'⚙️ 화면·소리':host?`👥 방 ${esc(Net.code)} · 게임 설정`:'🎲 게임 설정'}</h3></div>
      <div class="setbody"><div class="tabs" role="tablist">${tabs.map(([k,e,n])=>`<button role="tab" data-tab="${k}" class="${k===this.tab?'on':''}"><span class="e">${e}</span>${n}</button>`).join('')}</div>
      <div class="tabpane" id="tabpane"></div></div>
      <div class="sfoot"><span class="info" id="sinfo"></span>${this.inGame?'<button class="btn" data-newgame>새 게임 준비하기</button><button class="btn main" data-close>설정 닫고 계속하기</button>':prefsOnly?'<button class="btn main" data-close>닫기</button>':`<button class="btn" data-close>${host?'방 닫기':'취소'}</button><button class="btn main" id="goStart">🎲 게임 시작</button>`}</div></div>`;
    this.L=openLayer('info',html,{full:true,close:true,tone:'var(--accent)',onClose:()=>{if(host)Net.leave()}});
    const box=this.L.box;
    $$('[data-tab]',box).forEach(b=>b.onclick=()=>{this.tab=b.dataset.tab;$$('[data-tab]',box).forEach(x=>x.classList.toggle('on',x===b));this.pane()});
    $$('[data-close]',box).forEach(b=>b.onclick=()=>this.L.close());
    const ng=$('[data-newgame]',box);if(ng)ng.onclick=()=>{if(ng.dataset.sure){this.L.close();App.home()}else{ng.dataset.sure=1;ng.textContent='한 번 더 누르면 처음 화면으로 (지금 게임은 저장돼요)'}};
    const gs=$('#goStart',box);if(gs)gs.onclick=()=>this.start();
    this.pane()},
  cfg(){return this.inGame?G.cfg:SETUP.cfg},
  pane(){const p=$('#tabpane',this.L.box);if(!p)return;const cfg=this.cfg();
    if(this.tab==='people')p.innerHTML=this.peopleHTML();
    else if(this.tab==='board')p.innerHTML=this.boardHTML();
    else{const extra=this.tab==='play'&&!this.inGame?`<div class="srow full"><div class="tx"><b>사람 플레이어의 주사위</b><small>컴퓨터는 항상 자동으로 굴려요. 플레이어마다 따로 정하려면 인원·캐릭터 탭에서 고르세요.</small></div><div class="seg" id="diceAll"><button type="button" data-v="screen">모두 화면 주사위</button><button type="button" data-v="real">모두 실물 주사위</button></div></div>`:'';
      const quizInfo=this.tab==='quiz'?`<div class="srow full"><div class="tx"><b>쓸 수 있는 문제</b><small id="qcount"></small></div><button class="btn sm" data-mgr="quiz">📚 퀴즈 관리</button></div>`:'';
      const etc=this.tab==='etc'?`<div class="srow full"><div class="tx"><b>홈 화면에 설치</b><small>설치하면 아이콘으로 바로 열리고 주소창 없이 넓게 보여요.</small></div><button class="btn sm" data-inst>📲 설치 방법</button></div>`:'';
      p.innerHTML=`<div class="sgrid">${extra}${itemsHTML(SET_ITEMS[this.tab],cfg,this.inGame)}${quizInfo}${etc}</div>`;
      bindItems(p,SET_ITEMS[this.tab],cfg,k=>{this.changed(k)});
      const da=$('#diceAll',p);if(da)da.onclick=e=>{const b=e.target.closest('button');if(!b)return;SETUP.players.forEach(x=>{if(!x.ai)x.dice=b.dataset.v});saveSetup();UI.toast(b.dataset.v==='real'?'모든 사람 플레이어가 실물 주사위를 써요':'모든 사람 플레이어가 화면 주사위를 써요')};
      const m=$('[data-mgr]',p);if(m)m.onclick=()=>{Manage.open('quiz',()=>this.render())};
      const ins=$('[data-inst]',p);if(ins)ins.onclick=()=>openInstall()}
    this.bindPane(p);this.info()},
  changed(k){if(this.inGame){render();persist();Net.pushState()}else saveSetup();this.info()},
  info(){const el=$('#sinfo',this.L&&this.L.box);if(!el)return;
    const cfg=this.cfg(),b=Content.board(cfg.board),n=this.inGame?G.players.length:SETUP.players.length;
    const qn=Content.quizAll().filter(q=>q.on&&eraFits(q.era,b.era)&&(cfg.diff==='mix'||q.lv===cfg.diff)&&(q.t==='mc'?cfg.qmc!==false:cfg.qsa!==false)).length;
    el.textContent=`${n}명 · ${b.name} 판 · ${LV_KO[cfg.diff]||'섞어서'} 퀴즈 ${qn}문제 · ${cfg.rounds?cfg.rounds+'라운드':'파산까지'}`;
    const qc=$('#qcount',this.L.box);if(qc)qc.textContent=`지금 설정(${b.name} 판, ${LV_KO[cfg.diff]||'섞어서'})으로 ${qn}문제가 나올 수 있어요. 퀴즈 관리에서 문제를 고르거나 새로 만들 수 있어요.`},
  /* 인원·캐릭터 */
  peopleHTML(){const P=SETUP.players,host=Net.role==='host';
    return `<div class="sgrid" style="margin-bottom:.6rem"><div class="srow full"><div class="tx"><b>몇 명이 할까요?</b><small>사람과 컴퓨터를 섞을 수 있어요. 각 플레이어의 동물·색깔을 누르면 바꿀 수 있어요.</small></div>
      <div class="seg" id="pcount">${[2,3,4].map(n=>`<button type="button" data-v="${n}" class="${P.length===n?'on':''}">${n}명</button>`).join('')}</div></div>
      ${host?`<div class="srow full"><div class="tx"><b>방 코드 <span class="cute" style="color:var(--accent-2);font-size:1.4em;letter-spacing:.12em">${esc(Net.code)}</span></b><small>참가자가 들어오면 빈 자리에 자동으로 앉아요. 참가자 자리는 참가자 기기에서 이름·동물·색을 바꿀 수 있어요.</small></div></div>`:''}</div>
      <div class="plist">${P.map((p,k)=>`<div class="pedit" style="--pc:${p.color}">
        <button type="button" class="tok" style="--pc:${p.color}" data-pick="${k}" aria-label="${k+1}번 캐릭터 바꾸기">${esc(p.emoji)}</button>
        <input class="inp" id="pname${k}" maxlength="10" value="${esc(p.name)}" aria-label="${k+1}번 이름" ${p.net?'readonly':''}>
        ${P.length>2&&!p.net?`<button type="button" class="del" data-del="${k}" aria-label="${k+1}번 빼기">×</button>`:'<span></span>'}
        <div class="opts">${p.net?`<span class="net">📱 참가자 ${Net.isOnline(p.net)?'· 접속 중':'· 연결 끊김'}</span><button class="btn sm" data-kick="${k}">자리 비우기</button>`:
          `<div class="seg" data-ai="${k}"><button type="button" data-v="0" class="${p.ai?'':'on'}">🙂 사람</button><button type="button" data-v="1" class="${p.ai?'on':''}">🤖 컴퓨터</button></div>
          ${p.ai?'':`<div class="seg" data-dice="${k}"><button type="button" data-v="screen" class="${p.dice==='real'?'':'on'}">화면 주사위</button><button type="button" data-v="real" class="${p.dice==='real'?'on':''}">🎲 실물 주사위</button></div>`}`}
        <button type="button" class="btn sm" data-pick="${k}">🎨 ${PALETTE_KO[PALETTE.indexOf(p.color)]||'색'} · 바꾸기</button></div></div>`).join('')}</div>`},
  bindPane(p){const P=SETUP.players;
    const pc=$('#pcount',p);if(pc)pc.onclick=e=>{const b=e.target.closest('button');if(!b)return;const n=+b.dataset.v;
      while(P.length>n){const i=P.map(x=>!!x.net).lastIndexOf(false);if(i<0)break;P.splice(i,1)}
      while(P.length<n){const k=P.length,usedC=P.map(x=>x.color),usedE=P.map(x=>x.emoji);P.push({name:DEF_NAMES[k]||'플레이어'+(k+1),ai:true,emoji:TOKENS.find(t=>!usedE.includes(t)),color:PALETTE.find(c=>!usedC.includes(c)),dice:'screen'})}
      saveSetup();Net.lobbyChanged();this.pane()};
    $$('input[id^="pname"]',p).forEach(inp=>inp.oninput=()=>{const k=+inp.id.slice(5);P[k].name=inp.value;saveSetup();Net.lobbyChanged();this.info()});
    $$('[data-ai]',p).forEach(seg=>seg.onclick=e=>{const b=e.target.closest('button');if(!b)return;P[+seg.dataset.ai].ai=b.dataset.v==='1';saveSetup();this.pane()});
    $$('[data-dice]',p).forEach(seg=>seg.onclick=e=>{const b=e.target.closest('button');if(!b)return;P[+seg.dataset.dice].dice=b.dataset.v;saveSetup();this.pane()});
    $$('[data-del]',p).forEach(b=>b.onclick=()=>{P.splice(+b.dataset.del,1);saveSetup();Net.lobbyChanged();this.pane()});
    $$('[data-kick]',p).forEach(b=>b.onclick=()=>{const k=+b.dataset.kick;Net.unseat(P[k].net);P[k].net=null;P[k].ai=true;saveSetup();Net.lobbyChanged();this.pane()});
    $$('[data-pick]',p).forEach(b=>b.onclick=()=>{const k=+b.dataset.pick;if(P[k].net)return UI.toast('참가자 자리는 참가자 기기에서 바꿀 수 있어요');
      pickLook(P[k],P.filter((_,i)=>i!==k),()=>{saveSetup();Net.lobbyChanged();this.pane()})});
    $$('[data-board]',p).forEach(b=>b.onclick=()=>{SETUP.cfg.board=b.dataset.board;saveSetup();Net.lobbyChanged();this.pane()});
    const bm=$('[data-bmgr]',p);if(bm)bm.onclick=()=>Manage.open('board',()=>this.render())},
  /* 보드 판 */
  boardHTML(){const cur=SETUP.cfg.board;
    return `<div class="boardpick">${Content.boardAll().map(b=>{const n=b.tiles.filter(t=>t.t==='city'||t.t==='spot').length;
      return `<button type="button" data-board="${esc(b.id)}" class="${b.id===cur?'on':''}"><span class="pics">${b.tiles.filter(t=>t.t==='city').slice(0,6).map(t=>esc(t.pic)).join('')}</span><b>${esc(b.name)} 판</b>
        <small>${esc(b.desc||'')}</small><small>출발: <b>${esc(b.tiles[0].name)}</b> · 땅 ${n}곳 · ${ERA_KO[b.era]} 퀴즈·카드${b.src==='user'?' · 직접 만든 판':b.src==='edit'?' · 고친 판':''}</small></button>`}).join('')}</div>
      <div class="sfoot" style="margin-top:.8rem"><span class="info">판의 시대(구약·신약·공통)에 맞는 퀴즈와 말씀 카드만 나와요.</span><button class="btn sm" data-bmgr>🗺️ 보드 편집하기</button></div>`},
  start(){const P=SETUP.players;
    if(P.some(p=>!String(p.name).trim()))return UI.toast('이름이 비어 있는 플레이어가 있어요');
    const colors=P.map(p=>p.color);if(new Set(colors).size!==colors.length)return UI.toast('플레이어 색깔이 겹쳐요. 서로 다른 색을 골라 주세요');
    const qn=Content.quizAll().filter(q=>q.on).length;if(!qn)UI.toast('켜 둔 퀴즈가 없어서 기본 퀴즈를 써요');
    saveSetup();this.L&&this.L.close&&(this.L.onCloseSkip=true);closeLayer('info');
    startGame({players:P.map(p=>({...p})),cfg:{...SETUP.cfg}})}
};
/* 색깔·이모티콘 고르기 */
function pickLook(p,others,done){
  const usedC=others.map(o=>o.color);
  const html=()=>`<div class="kick">🎨 캐릭터 꾸미기</div><h3>${esc(p.name||'플레이어')}</h3><div class="picker">
    <div class="pedit" style="--pc:${p.color};grid-template-columns:auto 1fr"><span class="tok" style="--pc:${p.color}">${esc(p.emoji)}</span><span class="cute" style="font-size:1.3rem">게임판의 말과 깃발에 이렇게 보여요</span></div>
    <b class="cute">색깔</b><div class="colors">${PALETTE.map((c,i)=>`<button type="button" style="--c:${c}" data-c="${c}" class="${p.color===c?'on':''}" ${usedC.includes(c)?'disabled':''} aria-label="${PALETTE_KO[i]}" title="${PALETTE_KO[i]}"></button>`).join('')}</div>
    <b class="cute">이모티콘</b><div class="emojis">${TOKENS.map(e=>`<button type="button" data-e="${e}" class="${p.emoji===e?'on':''}">${e}</button>`).join('')}</div>
    <label class="cute" style="display:flex;gap:.5rem;align-items:center">직접 입력 <input class="inp" id="emo" maxlength="4" style="max-width:8rem" placeholder="😀"></label></div>
    <div class="mbtns"><button class="btn main wide" data-close>다 골랐어요</button></div>`;
  const L=openLayer('info',html(),{close:true,tone:p.color,wide:true,onClose:done});
  const bind=()=>{$$('[data-c]',L.box).forEach(b=>b.onclick=()=>{p.color=b.dataset.c;refresh()});$$('[data-e]',L.box).forEach(b=>b.onclick=()=>{p.emoji=b.dataset.e;refresh()});
    const inp=$('#emo',L.box);inp.onchange=()=>{const v=[...inp.value.trim()].slice(0,2).join('');if(v){p.emoji=v;refresh()}};$('[data-close]',L.box).onclick=L.close};
  const refresh=()=>{$('.mbox',L.ov).style.setProperty('--tc',p.color);const x=$('.mbox',L.ov);x.innerHTML='<button class="xclose" data-x aria-label="닫기">×</button>'+html();$('[data-x]',x).onclick=L.close;bind()};
  bind()}
