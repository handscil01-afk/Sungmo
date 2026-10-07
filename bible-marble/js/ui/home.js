'use strict';
/* ================= 화면: 메인 · 게임 설정(탭) ================= */
const DEF_PLAYERS=()=>[{pid:uid('p'),name:DEF_NAMES[0],ai:false,emoji:TOKENS[0],color:PALETTE[0],dice:'screen'},{pid:uid('p'),name:DEF_NAMES[1],ai:true,emoji:TOKENS[1],color:PALETTE[1],dice:'screen'}];
function loadSetup(){const s=store.get('setup',{})||{};
  const players=Array.isArray(s.players)&&s.players.length>=2?s.players.slice(0,4).map((p,k)=>({pid:p.pid||uid('p'),name:p.name||DEF_NAMES[k],ai:!!p.ai,aiLv:p.aiLv||null,host:!!p.host,op:!!p.op,emoji:p.emoji||TOKENS[p.tok]||TOKENS[k],color:p.color||PALETTE[k],dice:p.dice==='real'?'real':'screen',net:null})):DEF_PLAYERS();
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
    {k:'diff',t:'퀴즈 난이도',seg:[['easy','쉬움'],['normal','보통'],['hard','어려움'],['mix','섞어서']],full:1},
    {k:'qmc',t:'객관식 문제',sw:1},{k:'qsa',t:'주관식 문제',d:'진행자가 정답·오답을 눌러요. 컴퓨터는 객관식만 풀어요.',sw:1},
    {k:'quizTime',t:'퀴즈 제한 시간',d:'시간이 지나면 틀린 것으로 처리해요. 컴퓨터는 제한이 없어요.',seg:[[0,'없음'],[10,'10초'],[15,'15초'],[20,'20초'],[30,'30초'],[60,'60초']],full:1},
    {k:'aiQuiz',t:'컴퓨터 차례 퀴즈',d:'직접 넘기면 계속하기를 눌러야 답이 나와요.',seg:[['manual','직접 넘기기'],['auto','자동으로']],full:1}],
  qrule:[
    {k:'tollQuiz',t:'통행료 말씀 찬스',d:'남의 땅에서 퀴즈를 맞히면 통행료가 반값이에요.',sw:1},
    {k:'quizTile',t:'말씀 퀴즈 칸',d:'끄면 퀴즈 없이 100 달란트를 받아요.',sw:1},
    {k:'jailQuiz',t:'광야 탈출 퀴즈',d:'맞히면 광야에서 바로 나와요.',sw:1},
    {k:'steal',t:'다른 팀에게 기회',d:'퀴즈 칸·보너스 퀴즈를 틀리면 다른 팀이 도전해서 상금의 절반을 받아요. 통행료 감면·광야 탈출은 넘기지 않아요.',sw:1}],
  play:[
    {k:'ai',t:'기본 컴퓨터 실력',d:'새로 넣는 컴퓨터 자리의 실력이에요. 자리마다 따로 바꿀 수 있어요.',seg:[['easy','쉬움'],['normal','보통'],['hard','어려움']]}],
  screen:[
    {k:'textScale',t:'글자·화면 크기',d:'TV나 큰 화면에서 멀리 볼 때는 크게 하세요.',seg:[[.9,'작게'],[1,'보통'],[1.15,'크게'],[1.3,'아주 크게']],pref:1,full:1},
    {k:'tokScale',t:'말 크기',d:'게임판 위 플레이어 말의 크기예요. 말은 칸 글씨를 가리지 않는 자리에 놓여요.',seg:[[.8,'작게'],[1,'보통'],[1.25,'크게']],pref:1},
    {k:'speed',t:'애니메이션 속도',d:'말이 움직이고 컴퓨터가 고르는 빠르기예요.',seg:[['slow','느리게'],['normal','보통'],['fast','빠르게']],pref:1},
    {k:'autoFS',t:'자동 전체화면',d:'화면을 처음 누르면 전체화면으로 바뀌어요.',sw:1,pref:1}],
  sound:[
    {k:'sound',t:'효과음',d:'주사위, 동전, 정답 소리를 들려줘요.',sw:1,pref:1},
    {k:'volume',t:'효과음 크기',seg:[[.35,'작게'],[.7,'보통'],[1,'크게']],pref:1}],
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
        ${save?`<button class="mi resume" data-m="resume"><span class="e">▶️</span><b>이어하기</b><small>${save.G.room?`${MODE_KO[save.G.room.mode]} · 방 ${esc(save.G.room.code)} 다시 열기 · `:''}${esc(save.G.players.map(p=>p.name).join(' · '))} · ${esc(save.G.board.name)} 판 · ${save.G.round}라운드</small></button>`:''}
        ${netSave&&netSave.role==='client'?`<button class="mi resume" data-m="rejoin"><span class="e">📶</span><b>방 다시 들어가기</b><small>방 코드 ${esc(netSave.code)} · 내 자리로 돌아가요</small></button>`:''}
        <button class="mi main" data-m="start"><span class="e">🎲</span><b>게임 시작</b><small>인원과 규칙을 정하고 시작해요</small></button>
        <button class="mi" data-m="net"><span class="e">👥</span><b>함께하기</b><small>방을 만들거나 방 코드로 참가해요</small></button>
        <button class="mi" data-m="manage"><span class="e">📚</span><b>콘텐츠 관리</b><small>퀴즈 · 보드 · 카드 · 성경 본문</small></button>
        <button class="mi" data-m="rules"><span class="e">📖</span><b>게임 방법</b><small>규칙을 읽어 봐요</small></button>
        <button class="mi" data-m="settings"><span class="e">⚙️</span><b>화면·소리</b><small>글자 크기, 효과음, 전체화면</small></button>
      </div>`;
    $$('[data-m]',h).forEach(b=>b.onclick=()=>{const m=b.dataset.m;
      if(m==='resume')App.resume(hasSave());else if(m==='rejoin')Net.rejoin();else if(m==='start')Setup.open();else if(m==='net')NetUI.open();
      else if(m==='manage')Manage.open();else if(m==='rules')showRules();else if(m==='settings')Setup.openPrefs()});
    bindInstall(h)}
};

/* ---------- 게임 설정 창 ---------- */
/* 설정 창 탭: 게임 · 화면 · 소리 · 플레이어 · 콘텐츠 · 멀티플레이 */
const TABS={game:['🎲','게임'],net:['📶','멀티플레이'],people:['👥','플레이어'],board:['🗺️','보드 판'],rules:['🎯','게임 규칙'],quiz:['❓','퀴즈'],qrule:['🏅','퀴즈 규칙'],
  play:['🤖','컴퓨터'],screen:['📺','화면'],sound:['🔊','소리'],content:['📚','콘텐츠']};
const Setup={tab:'people',L:null,
  open(tab){this.tab=tab||'people';this.inGame=false;this.who='setup';this.render()},
  openPrefs(){this.inGame=false;this.who='prefs';this.tab='screen';this.render()},
  /* 게임 중 설정: 게임 진행에 필요한 메뉴와 규칙·퀴즈·화면·소리 */
  openInGame(tab){this.inGame=true;this.who='host';this.tab=tab||'game';this.render()},
  /* 참가자 기기: 자기 기기의 화면·소리와 방 정보만 */
  openClient(tab){this.inGame=!!Net.G;this.who='client';this.tab=tab||'game';this.render()},
  tabs(){const w=this.who,on=!!Net.role;
    if(w==='prefs')return ['screen','sound'];
    if(w==='client')return [...(this.inGame?['game']:[]),'net','screen','sound'];
    if(w==='host')return ['game',...(on?['net']:[]),'rules','quiz','qrule','play','screen','sound','content'];
    return ['people',...(on?['net']:[]),'board','rules','quiz','qrule','play','screen','sound','content']},
  render(){
    const tabs=this.tabs();if(!tabs.includes(this.tab))this.tab=tabs[0];
    const host=Net.role==='host'&&this.who==='setup';
    const title=this.who==='host'?'⚙️ 설정':this.who==='prefs'?'⚙️ 화면·소리':this.who==='client'?`⚙️ 설정 · 방 ${esc(Net.code||'')}`:host?`👥 방 ${esc(Net.code)} · ${MODE_KO[Net.mode]} · 게임 설정`:'🎲 게임 설정';
    const foot=this.who==='host'||this.who==='client'||this.who==='prefs'?'<button class="btn main" data-close>닫기</button>'
      :`<button class="btn" data-close>${host?'방 닫기':'취소'}</button><button class="btn main" id="goStart">🎲 게임 시작</button>`;
    const html=`<div class="setwin"><div class="shead"><h3 class="cute">${title}</h3></div>
      <div class="setbody"><div class="tabs" role="tablist">${tabs.map(k=>`<button role="tab" data-tab="${k}" class="${k===this.tab?'on':''}"><span class="e">${TABS[k][0]}</span>${TABS[k][1]}</button>`).join('')}</div>
      <div class="tabpane" id="tabpane"></div></div>
      <div class="sfoot"><span class="info" id="sinfo"></span>${foot}</div></div>`;
    this.L=openLayer('info',html,{full:true,close:true,tone:'var(--accent)',onClose:()=>{if(host&&!this.starting)Net.leave();this.starting=false}});
    const box=this.L.box;
    $$('[data-tab]',box).forEach(b=>b.onclick=()=>{this.tab=b.dataset.tab;$$('[data-tab]',box).forEach(x=>x.classList.toggle('on',x===b));this.pane()});
    $$('[data-close]',box).forEach(b=>b.onclick=()=>this.L.close());
    const gs=$('#goStart',box);if(gs)gs.onclick=()=>this.start();
    this.pane()},
  cfg(){return this.inGame&&G?G.cfg:SETUP.cfg},
  pane(){const p=$('#tabpane',this.L&&this.L.box);if(!p)return;const cfg=this.cfg(),T=this.tab;
    if(T==='people')p.innerHTML=this.peopleHTML();
    else if(T==='board')p.innerHTML=this.boardHTML();
    else if(T==='game')p.innerHTML=this.gameHTML();
    else if(T==='net')p.innerHTML=this.netHTML();
    else if(T==='content')p.innerHTML=this.contentHTML();
    else{const extra=T==='play'&&!this.inGame&&!Net.role?`<div class="srow full"><div class="tx"><b>사람 플레이어의 주사위</b><small>컴퓨터는 항상 자동으로 굴려요. 플레이어마다 따로 정하려면 플레이어 탭에서 고르세요.</small></div><div class="seg" id="diceAll"><button type="button" data-v="screen">모두 화면 주사위</button><button type="button" data-v="real">모두 실물 주사위</button></div></div>`:'';
      const quizInfo=T==='quiz'?`<div class="srow full"><div class="tx"><b>쓸 수 있는 문제</b><small id="qcount"></small></div><button class="btn sm" data-mgr="quiz">📚 퀴즈 관리</button></div>`:'';
      const scr=T==='screen'?`<div class="srow"><div class="tx"><b>전체화면</b><small>${FS.can()?'지금 화면을 전체화면으로 바꾸거나 되돌려요.':'이 화면에서는 전체화면이 막혀 있어요. 홈 화면에 설치하면 넓게 쓸 수 있어요.'}</small></div><button class="btn sm" data-fs>${FS.is()?'↙️ 창 모드로':'⛶ 전체화면'}</button></div>
        <div class="srow"><div class="tx"><b>홈 화면에 설치</b><small>설치하면 아이콘으로 바로 열리고 주소창 없이 넓게 보여요.</small></div><button class="btn sm" data-inst>📲 설치 방법</button></div>`:'';
      const rel=T==='qrule'&&this.mode()==='player'?'<div class="srow full"><div class="tx"><b>플레이어 모드 안내</b><small>진행자가 없으므로 주관식은 각자 답을 입력하면 게임이 채점해요. 다른 팀 기회는 차례 순서대로 다음 사람에게 넘어가요.</small></div></div>':'';
      const items=(SET_ITEMS[T]||[]).filter(it=>!(T==='quiz'&&it.k==='aiQuiz'&&this.mode()==='player'));
      p.innerHTML=`<div class="sgrid">${extra}${itemsHTML(items,cfg,this.inGame)}${quizInfo}${rel}${scr}</div>`;
      bindItems(p,items,cfg,k=>{this.changed(k)});
      const da=$('#diceAll',p);if(da)da.onclick=e=>{const b=e.target.closest('button');if(!b)return;SETUP.players.forEach(x=>{if(!x.ai)x.dice=b.dataset.v});saveSetup();UI.toast(b.dataset.v==='real'?'모든 사람 플레이어가 실물 주사위를 써요':'모든 사람 플레이어가 화면 주사위를 써요')};
      const m=$('[data-mgr]',p);if(m)m.onclick=()=>{Manage.open('quiz',()=>this.render())};
      const ins=$('[data-inst]',p);if(ins)ins.onclick=()=>openInstall();
      const fsb=$('[data-fs]',p);if(fsb)fsb.onclick=()=>{FS.toggle();setTimeout(()=>this.pane(),400)}}
    this.bindPane(p);this.info()},
  mode(){return this.inGame&&G?MODE():Net.role==='host'?Net.mode:Net.role==='client'?Net.mode:'local'},
  changed(k){if(this.inGame&&G){render();persist();Net.pushState()}else saveSetup();this.info()},
  info(){const el=$('#sinfo',this.L&&this.L.box);if(!el)return;
    if(this.who==='prefs'||this.who==='client'){el.textContent=this.who==='client'?`${Net.kind==='remote'?'🎛️ 진행자 리모컨':Net.kind==='display'?'📺 게임 화면':'📱 참가자'} · ${MODE_KO[Net.mode]||''}`:'';return}
    const cfg=this.cfg(),b=this.inGame&&G?G.board:Content.board(cfg.board),n=this.inGame&&G?G.players.length:SETUP.players.length;
    const qn=Content.quizAll().filter(q=>q.on&&eraFits(q.era,b.era)&&(cfg.diff==='mix'||q.lv===cfg.diff)&&(q.t==='mc'?cfg.qmc!==false:cfg.qsa!==false)).length;
    el.textContent=`${n}명 · ${b.name} 판 · ${LV_KO[cfg.diff]||'섞어서'} 퀴즈 ${qn}문제 · ${cfg.rounds?cfg.rounds+'라운드':'파산까지'}${Net.code?` · 방 ${Net.code}`:''}`;
    const qc=$('#qcount',this.L.box);if(qc)qc.textContent=`지금 설정(${b.name} 판, ${LV_KO[cfg.diff]||'섞어서'})으로 ${qn}문제가 나올 수 있어요. 퀴즈 관리에서 문제를 고르거나 새로 만들 수 있어요.`},
  /* 게임 메뉴 (게임 중) */
  gameHTML(){const g=VG(),cl=this.who==='client';
    return `<div class="sgrid">
      <div class="srow"><div class="tx"><b>📒 진행 기록</b><small>지금까지 있었던 일을 차례대로 봐요.</small></div><button class="btn sm" data-g="log">기록 보기</button></div>
      <div class="srow"><div class="tx"><b>📖 게임 방법</b><small>규칙과 칸 설명을 읽어 봐요.</small></div><button class="btn sm" data-g="rules">규칙 보기</button></div>
      ${!cl&&canUndo()?'<div class="srow"><div class="tx"><b>↩️ 되돌리기</b><small>바로 전 선택 하나를 취소해요. 누르면 한 번 더 확인해요.</small></div><button class="btn sm" data-g="undo">되돌리기</button></div>':''}
      ${!cl&&MODE()==='player'?'<div class="srow"><div class="tx"><b>↩️ 되돌리기</b><small>여럿이 하는 플레이어 모드에서는 공평하게 하려고 되돌리기를 쓰지 않아요.</small></div></div>':''}
      <div class="srow full"><div class="tx"><b>${cl?'🚪 방 나가기':'🏠 처음 화면으로'}</b><small>${cl?'방에서 나가요. 같은 방 코드로 다시 들어오면 내 자리로 돌아가요.':Net.role==='host'?'방을 잠시 닫고 처음 화면으로 가요. 게임은 저장되고, "이어하기"를 누르면 같은 방 코드로 다시 열려요.':'게임은 저장되고, 처음 화면의 "이어하기"로 다시 할 수 있어요.'}</small></div><button class="btn sm" data-g="home">${cl?'나가기':'처음 화면으로'}</button></div>
      ${g&&!cl?`<div class="srow full"><div class="tx"><b>지금 게임</b><small>${esc(g.board.name)} 판 · ${MODE_KO[MODE()]||'한 기기 게임'}${Net.code?` · 방 ${esc(Net.code)}`:''}</small></div></div>`:''}</div>`},
  /* 콘텐츠 */
  contentHTML(){return `<div class="sgrid">${[['quiz','❓ 퀴즈','문제 고르기·편집·추가, 엑셀로 내보내기·불러오기'],['board','🗺️ 보드 판','구약·신약·신구약 판의 칸·이벤트 편집'],['card','📜 말씀 카드','카드 효과와 말씀 편집'],['bible','📖 성경 본문','가지고 있는 개역개정 파일 불러오기'],['backup','💾 백업','직접 만든 콘텐츠를 파일로 옮기기']]
      .map(([k,t,d])=>`<div class="srow"><div class="tx"><b>${t}</b><small>${d}</small></div><button class="btn sm" data-cm="${k}">열기</button></div>`).join('')}
      ${this.inGame?'<div class="srow full"><div class="tx"><small>보드 판과 카드를 고치면 다음 게임부터 반영돼요. 퀴즈는 바로 반영돼요.</small></div></div>':''}</div>`},
  /* 멀티플레이: 방 코드 · 참가자 · 자리 바꾸기 · 중계 화면 */
  netHTML(){const host=Net.role==='host',code=Net.code||'',g=this.inGame?VG():null;
    const link=`${location.origin}${location.pathname}#room=${code}`;
    let h=`<div class="sgrid"><div class="srow full"><div class="tx"><b>방 코드 <span class="roomcode">${esc(code)}</span></b><small>${MODE_KO[Net.mode]||''} · 누군가 나갔다가 다시 들어올 때 이 코드를 넣으면 원래 자리로 돌아와요.</small></div>
      <div class="btnrow"><button class="btn sm" data-copy="${esc(code)}">📋 코드 복사</button><button class="btn sm" data-copy="${esc(link)}">🔗 참가 링크 복사</button></div></div>`;
    if(!host){const me=g?g.players.find(p=>p.id===Net.mySeat):null;
      h+=`<div class="srow full"><div class="tx"><b>${Net.kind==='remote'?'🎛️ 진행자 리모컨':Net.kind==='display'?'📺 게임 화면':me?`내 자리: ${esc(me.tok)} ${esc(me.name)}`:'구경하는 중'}</b><small>${Net.kind==='remote'?'주관식 정답이 이 기기에만 보여요. 판정과 계속하기를 여기서 할 수 있어요.':me?'내 차례의 행동은 이 기기에서만 할 수 있어요.':'자리가 생기면 방장이 넘겨줄 수 있어요.'}</small></div></div></div>`;return h}
    if(Net.mode==='relay')h+=`<div class="srow"><div class="tx"><b>📺 게임 화면 창 (PC)</b><small>TV·프로젝터(확장 모니터)에 띄울 게임 화면을 새 창으로 열어요. 이 창은 진행자 화면이 되고, 정답은 여기에만 보여요.</small></div><button class="btn sm main" data-disp>📺 게임 화면 창 열기</button></div>
      <div class="srow"><div class="tx"><b>🎛️ 진행자 리모컨 PIN <span class="roomcode">${esc(Net.pin)}</span></b><small>진행자 휴대폰에서 방 참가하기 → 진행자 리모컨을 고르고 PIN을 넣으면 정답 확인과 판정을 휴대폰으로 할 수 있어요. 쓰지 않아도 돼요.</small></div></div>
      <div class="srow full"><div class="tx"><small>연결된 화면: 📺 ${Net.displays().length}개 · 🎛️ 리모컨 ${[...Net.members.values()].filter(m=>m.kind==='remote'&&m.online).length}개 ${Net.hostSeesAnswers()?'· 이 기기에 정답이 보여요(진행자 창)':'· 이 기기에는 정답이 보이지 않아요'}</small></div></div>`;
    const P=g?g.players:null;
    if(P){h+=`<div class="srow full"><div class="tx"><b>참가자 · 자리 바꾸기</b><small>사람이 나가면 컴퓨터로 대체하고, 새 사람이 들어오면 컴퓨터 자리를 넘겨줄 수 있어요. 위치·달란트·땅·건물·카드는 그대로 이어져요.</small></div></div>
      ${P.map(p=>{const on=p.net?Net.isOnline(p.net):null;
        const st=p.out?'파산':p.ai?`🤖 컴퓨터 (${LV_KO[p.aiLv]||'보통'})`:p.host?'👑 방장 (이 기기)':p.op?'🎤 진행자가 조작':p.net?(on?'🟢 접속 중':'⚪ 연결 끊김'):'';
        const acts=p.out?'':p.ai?`<button class="btn sm" data-lv="${p.id}">난이도</button>${Net.mode==='relay'?`<button class="btn sm" data-op="${p.id}">🎤 진행자 조작으로</button>`:''}`
          :p.op?`<button class="btn sm" data-toai="${p.id}">🤖 컴퓨터로</button>`:p.net?`<button class="btn sm" data-toai="${p.id}">🤖 컴퓨터로 대체</button>`:'';
        return `<div class="srow mem" style="--pc:${p.col}"><div class="tx"><b><span class="tok" style="--pc:${p.col}">${esc(p.tok)}</span> ${esc(p.name)}</b><small>${st}</small></div><div class="btnrow">${acts}</div></div>`}).join('')}`}
    else h+=`<div class="srow full"><div class="tx"><small>참가자 자리는 플레이어 탭에서 정해요. 참가자가 들어오면 컴퓨터 자리에 자동으로 앉아요.</small></div></div>`;
    h+=`</div>`;return h},
  /* 인원·캐릭터 (게임 시작 전) */
  peopleHTML(){const P=SETUP.players,host=Net.role==='host',mode=host?Net.mode:'local';
    const kindSeg=(p,k)=>{if(p.net)return `<span class="net">📱 참가자 ${Net.isOnline(p.net)?'· 접속 중':'· 연결 끊김'}</span><button class="btn sm" data-kick="${k}">자리 비우기</button>`;
      if(p.host)return `<span class="net">👑 방장 (이 기기에서 조작)</span>`;
      const opts=mode==='local'?[['human','🙂 사람'],['ai','🤖 컴퓨터']]:mode==='relay'?[['ai','🤖 컴퓨터'],['op','🎤 진행자 조작']]:[['ai','🤖 컴퓨터']];
      const cur=p.ai?'ai':p.op?'op':'human';
      return `<div class="seg" data-kind="${k}">${opts.map(([v,l])=>`<button type="button" data-v="${v}" class="${cur===v?'on':''}">${l}</button>`).join('')}</div>`+
        (p.ai?`<div class="seg" data-lvs="${k}">${['easy','normal','hard'].map(v=>`<button type="button" data-v="${v}" class="${(p.aiLv||SETUP.cfg.ai)===v?'on':''}">${LV_KO[v]}</button>`).join('')}</div>`:'')+
        (!p.ai?`<div class="seg" data-dice="${k}"><button type="button" data-v="screen" class="${p.dice==='real'?'':'on'}">화면 주사위</button><button type="button" data-v="real" class="${p.dice==='real'?'on':''}">🎲 실물 주사위</button></div>`:'')};
    const help=mode==='player'?'방장은 1번 자리에서 자기 캐릭터만 조작해요. 참가자가 방 코드로 들어오면 컴퓨터 자리에 앉아요.'
      :mode==='relay'?'방장은 진행자예요. 참가자는 휴대폰으로 들어와 컴퓨터 자리에 앉고, 휴대폰이 없는 팀은 "진행자 조작" 자리로 두면 진행자가 대신 눌러요.'
      :'사람과 컴퓨터를 섞을 수 있어요. 이 기기 하나로 모두 함께 해요.';
    return `<div class="sgrid" style="margin-bottom:.6rem"><div class="srow full"><div class="tx"><b>몇 명이 할까요?</b><small>${help}</small></div>
      <div class="seg" id="pcount">${[2,3,4].map(n=>`<button type="button" data-v="${n}" class="${P.length===n?'on':''}">${n}명</button>`).join('')}</div></div>
      ${host?`<div class="srow full"><div class="tx"><b>방 코드 <span class="roomcode">${esc(Net.code)}</span></b><small>참가자 휴대폰에서 함께하기 → 방 참가하기를 누르고 이 코드를 넣어요.</small></div><button class="btn sm" data-copy="${esc(Net.code)}">📋 복사</button></div>`:''}</div>
      <div class="plist">${P.map((p,k)=>`<div class="pedit" style="--pc:${p.color}">
        <button type="button" class="tok" style="--pc:${p.color}" data-pick="${k}" aria-label="${k+1}번 캐릭터 바꾸기">${esc(p.emoji)}</button>
        <input class="inp" id="pname${k}" maxlength="10" value="${esc(p.name)}" aria-label="${k+1}번 이름" ${p.net?'readonly':''}>
        ${P.length>2&&!p.net&&!p.host?`<button type="button" class="del" data-del="${k}" aria-label="${k+1}번 빼기">×</button>`:'<span></span>'}
        <div class="opts">${kindSeg(p,k)}<button type="button" class="btn sm" data-pick="${k}">🎨 ${PALETTE_KO[PALETTE.indexOf(p.color)]||'색'} · 바꾸기</button></div></div>`).join('')}</div>`},
  bindPane(p){const P=SETUP.players;
    const pc=$('#pcount',p);if(pc)pc.onclick=e=>{const b=e.target.closest('button');if(!b)return;const n=+b.dataset.v;
      while(P.length>n){const i=P.map(x=>!!x.net||!!x.host).lastIndexOf(false);if(i<0)break;P.splice(i,1)}
      while(P.length<n){const k=P.length,usedC=P.map(x=>x.color),usedE=P.map(x=>x.emoji);P.push({pid:uid('p'),name:DEF_NAMES[k]||'플레이어'+(k+1),ai:true,emoji:TOKENS.find(t=>!usedE.includes(t)),color:PALETTE.find(c=>!usedC.includes(c)),dice:'screen'})}
      saveSetup();Net.lobbyChanged();this.pane()};
    $$('input[id^="pname"]',p).forEach(inp=>inp.oninput=()=>{const k=+inp.id.slice(5);P[k].name=inp.value;saveSetup();Net.lobbyChanged();this.info()});
    $$('[data-kind]',p).forEach(seg=>seg.onclick=e=>{const b=e.target.closest('button');if(!b)return;const x=P[+seg.dataset.kind],v=b.dataset.v;x.ai=v==='ai';x.op=v==='op';saveSetup();Net.lobbyChanged();this.pane()});
    $$('[data-lvs]',p).forEach(seg=>seg.onclick=e=>{const b=e.target.closest('button');if(!b)return;P[+seg.dataset.lvs].aiLv=b.dataset.v;saveSetup();this.pane()});
    $$('[data-dice]',p).forEach(seg=>seg.onclick=e=>{const b=e.target.closest('button');if(!b)return;P[+seg.dataset.dice].dice=b.dataset.v;saveSetup();this.pane()});
    $$('[data-del]',p).forEach(b=>b.onclick=()=>{P.splice(+b.dataset.del,1);saveSetup();Net.lobbyChanged();this.pane()});
    $$('[data-kick]',p).forEach(b=>b.onclick=()=>{const k=+b.dataset.kick;Net.unseat(P[k].net);P[k].net=null;P[k].ai=true;saveSetup();Net.lobbyChanged();this.pane()});
    $$('[data-pick]',p).forEach(b=>b.onclick=()=>{const k=+b.dataset.pick;if(P[k].net)return UI.toast('참가자 자리는 참가자 기기에서 바꿀 수 있어요');
      pickLook(P[k],P.filter((_,i)=>i!==k),()=>{saveSetup();Net.lobbyChanged();this.pane()})});
    $$('[data-board]',p).forEach(b=>b.onclick=()=>{SETUP.cfg.board=b.dataset.board;saveSetup();Net.lobbyChanged();this.pane()});
    const bm=$('[data-bmgr]',p);if(bm)bm.onclick=()=>Manage.open('board',()=>this.render());
    /* 게임 메뉴 · 콘텐츠 · 멀티플레이 */
    $$('[data-g]',p).forEach(b=>b.onclick=()=>{const v=b.dataset.g;
      if(v==='log')openLog();else if(v==='rules')showRules();else if(v==='undo'){this.L.close();confirmUndo()}
      else if(v==='home'){this.L.close();App.leaveGame()}});
    $$('[data-cm]',p).forEach(b=>b.onclick=()=>Manage.open(b.dataset.cm,()=>this.render()));
    $$('[data-copy]',p).forEach(b=>b.onclick=()=>copyText(b.dataset.copy));
    const dp=$('[data-disp]',p);if(dp)dp.onclick=()=>NetUI.openDisplay();
    $$('[data-toai]',p).forEach(b=>b.onclick=()=>{const q=byId(+b.dataset.toai);pickAiLevel(q.aiLv||G.cfg.ai,lv=>{if(!lv)return;if(q.op){q.op=false;q.ai=true;q.aiLv=lv;UI.render();persist();redispatch()}else Net.toAI(q,lv);this.pane()})});
    $$('[data-lv]',p).forEach(b=>b.onclick=()=>{const q=byId(+b.dataset.lv);pickAiLevel(q.aiLv||G.cfg.ai,lv=>{if(!lv)return;q.aiLv=lv;UI.render();persist();this.pane()})});
    $$('[data-op]',p).forEach(b=>b.onclick=()=>{const q=byId(+b.dataset.op);q.ai=false;q.op=true;log(`${q.name} 자리를 진행자가 조작해요`,q);UI.render();persist();redispatch();this.pane()})},
  /* 보드 판 */
  boardHTML(){const cur=SETUP.cfg.board;
    return `<div class="boardpick">${Content.boardAll().map(b=>{const n=b.tiles.filter(t=>t.t==='city'||t.t==='spot').length;
      return `<button type="button" data-board="${esc(b.id)}" class="${b.id===cur?'on':''}"><span class="pics">${b.tiles.filter(t=>t.t==='city').slice(0,6).map(t=>esc(t.pic)).join('')}</span><b>${esc(b.name)} 판</b>
        <small>${esc(b.desc||'')}</small><small>출발: <b>${esc(b.tiles[0].name)}</b> · 땅 ${n}곳 · ${ERA_KO[b.era]} 퀴즈·카드${b.src==='user'?' · 직접 만든 판':b.src==='edit'?' · 고친 판':''}</small></button>`}).join('')}</div>
      <div class="sfoot" style="margin-top:.8rem"><span class="info">판의 시대(구약·신약·공통)에 맞는 퀴즈와 말씀 카드만 나와요.</span><button class="btn sm" data-bmgr>🗺️ 보드 편집하기</button></div>`},
  start(){const P=SETUP.players,mode=Net.role==='host'?Net.mode:'local';
    if(P.some(p=>!String(p.name).trim()))return UI.toast('이름이 비어 있는 플레이어가 있어요');
    const colors=P.map(p=>p.color);if(new Set(colors).size!==colors.length)return UI.toast('플레이어 색깔이 겹쳐요. 서로 다른 색을 골라 주세요');
    if(mode==='player'&&P.filter(p=>p.host).length!==1)return UI.toast('방장 자리가 없어요. 방을 다시 만들어 주세요');
    if(mode!=='local'&&!P.some(p=>!p.ai))return UI.toast('사람이 한 명 이상 있어야 해요');
    const qn=Content.quizAll().filter(q=>q.on).length;if(!qn)UI.toast('켜 둔 퀴즈가 없어서 기본 퀴즈를 써요');
    P.forEach(p=>{if(!p.pid)p.pid=uid('p');if(mode==='local'){p.host=false;p.op=false}if(mode!=='relay')p.op=false;if(mode!=='player')p.host=false});
    saveSetup();this.starting=true;closeLayer('info');this.starting=false;
    startGame({players:P.map(p=>({...p})),cfg:{...SETUP.cfg},room:mode==='local'?null:{code:Net.code,mode}})}
};
function copyText(t){const done=()=>UI.toast('📋 복사했어요: '+t);
  try{navigator.clipboard.writeText(t).then(done,()=>fallback())}catch(e){fallback()}
  function fallback(){const i=document.createElement('textarea');i.value=t;document.body.appendChild(i);i.select();try{document.execCommand('copy');done()}catch(e){UI.toast(t)}i.remove()}}
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
