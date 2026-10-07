'use strict';
/* ================= 콘텐츠 저장소 =================
   기본 콘텐츠(js/data)는 그대로 두고, 사용자가 고친 것·새로 만든 것·끈 것·지운 것만 따로 저장해서 합쳐 보여 줍니다.
   저장 형식: {items:{id:항목}, off:[끈 id], del:[지운 기본 id]} */
const LV_KO={easy:'쉬움',normal:'보통',hard:'어려움'}, KO_LV={'쉬움':'easy','보통':'normal','어려움':'hard'};
const ERA_KO={ot:'구약',nt:'신약',all:'공통'}, KO_ERA={'구약':'ot','신약':'nt','공통':'all','신구약':'all','전체':'all'};
const TYPE_KO={mc:'객관식',sa:'주관식'}, KO_TYPE={'객관식':'mc','주관식':'sa'};
const FX_KO={gain:'달란트 받기',pay_pot:'헌금함에 내기',pay_bank:'은행에 내기',move_to:'칸으로 이동',move_by:'앞뒤로 이동',jail:'광야로 가기',ark:'방주 카드 받기',
  song:'찬송 카드 받기',give_each:'모두에게 주기',take_each:'모두에게서 받기',all_gain:'모두 함께 받기',give_poorest:'가장 적은 사람에게 주기',
  take_richest:'가장 많은 사람에게서 받기',repair:'건물 수리비 내기',skip:'한 번 쉬기',quiz_bonus:'보너스 퀴즈',talent:'가진 돈 비율 상금',none:'효과 없음'};
const KO_FX=Object.fromEntries(Object.entries(FX_KO).map(([k,v])=>[v,k]));
const TILE_KO={start:'출발',city:'땅',spot:'명소',card:'말씀 카드',quiz:'말씀 퀴즈',jail:'광야',pot:'헌금함',fly:'원하는 칸',tithe:'십일조',event:'이벤트'};
const KO_TILE=Object.fromEntries(Object.entries(TILE_KO).map(([k,v])=>[v,k]));
const GROUP_COLORS=['var(--g0)','var(--g1)','var(--g2)','var(--g3)','var(--g4)','var(--g5)','var(--g6)','var(--g7)'];

function fxText(fx){if(!fx||fx.k==='none')return '효과 없음';const n=fx.n;
  switch(fx.k){case 'gain':return `${n} 달란트 받기`;case 'pay_pot':return `헌금함에 ${n} 내기`;case 'pay_bank':return `은행에 ${n} 내기`;
    case 'move_to':return `${fx.to==='@start'?'출발 칸':fx.to==='@fly'?'원하는 칸으로 가는 칸':fx.to}(으)로 이동`;case 'move_by':return n>0?`앞으로 ${n}칸`:`뒤로 ${-n}칸`;
    case 'give_each':return `모두에게 ${n}씩 주기`;case 'take_each':return `모두에게서 ${n}씩 받기`;case 'all_gain':return `모두 ${n}씩 받기`;
    case 'give_poorest':return `가장 적은 사람에게 ${n} 주기`;case 'take_richest':return `가장 많은 사람에게서 ${n} 받기`;case 'repair':return `건물 단계마다 ${n} 내기`;
    case 'quiz_bonus':return `퀴즈 맞히면 ${n} 받기`;case 'talent':return `가진 돈의 ${n}% (최대 ${fx.max||300})`;default:return FX_KO[fx.k]||fx.k}}

const Content={
  _get(key){const v=store.get('c.'+key,null);return v&&typeof v==='object'?{items:v.items||{},off:v.off||[],del:v.del||[]}:{items:{},off:[],del:[]}},
  _set(key,v){if(!store.set('c.'+key,v))throw new Error('저장 공간이 부족해서 저장하지 못했어요.')},
  _all(key,defaults){const s=this._get(key),off=new Set(s.off),del=new Set(s.del),out=[],seen=new Set();
    for(const d of defaults){if(del.has(d.id))continue;const it=s.items[d.id]?{...s.items[d.id],src:'edit'}:{...d,src:'base'};it.on=!off.has(d.id);out.push(it);seen.add(d.id)}
    for(const [id,it] of Object.entries(s.items))if(!seen.has(id)&&!del.has(id))out.push({...it,id,src:'user',on:!off.has(id)});
    return out},
  _save(key,defaults,item){const s=this._get(key);const it={...item};delete it.src;delete it.on;
    if(!it.id)it.id=uid('u');s.items[it.id]=it;s.del=s.del.filter(x=>x!==it.id);this._set(key,s);return it.id},
  _remove(key,defaults,ids){const s=this._get(key),base=new Set(defaults.map(d=>d.id));
    for(const id of ids){delete s.items[id];if(base.has(id)&&!s.del.includes(id))s.del.push(id);s.off=s.off.filter(x=>x!==id)}this._set(key,s)},
  _setOn(key,ids,on){const s=this._get(key),off=new Set(s.off);for(const id of ids)on?off.delete(id):off.add(id);s.off=[...off];this._set(key,s)},
  _resetOne(key,id){const s=this._get(key);delete s.items[id];this._set(key,s)},
  _restore(key){const s=this._get(key);s.del=[];this._set(key,s)},

  /* ---- 퀴즈 ---- */
  quizAll(){return this._all('quiz',DEFAULT_QUIZ).map(normQuiz)},
  quizSave(q){return this._save('quiz',DEFAULT_QUIZ,normQuiz(q))},
  quizRemove(ids){this._remove('quiz',DEFAULT_QUIZ,ids)},
  quizSetOn(ids,on){this._setOn('quiz',ids,on)},
  quizReset(id){this._resetOne('quiz',id)},
  quizRestore(){this._restore('quiz')},
  /* ---- 말씀 카드 ---- */
  cardAll(){return this._all('card',DEFAULT_CARDS)},
  cardSave(c){return this._save('card',DEFAULT_CARDS,c)},
  cardRemove(ids){this._remove('card',DEFAULT_CARDS,ids)},
  cardSetOn(ids,on){this._setOn('card',ids,on)},
  cardReset(id){this._resetOne('card',id)},
  cardRestore(){this._restore('card')},
  /* ---- 보드 판 ---- */
  boardAll(){return this._all('board',DEFAULT_BOARDS).map(normBoard)},
  board(id){return this.boardAll().find(b=>b.id===id)||normBoard(DEFAULT_BOARDS[0])},
  boardSave(b){return this._save('board',DEFAULT_BOARDS,normBoard(b))},
  boardRemove(id){this._remove('board',DEFAULT_BOARDS,[id])},
  boardReset(id){this._resetOne('board',id)},
  boardRestore(){this._restore('board')},
  isDefault(kind,id){return (kind==='quiz'?DEFAULT_QUIZ:kind==='card'?DEFAULT_CARDS:DEFAULT_BOARDS).some(d=>d.id===id)},
};
function normQuiz(q){const o={id:q.id,t:q.t==='sa'?'sa':'mc',lv:LV_KO[q.lv]?q.lv:'normal',era:ERA_KO[q.era]?q.era:'all',cat:String(q.cat||'성경').trim()||'성경',
  q:String(q.q||'').trim(),ref:String(q.ref||'').trim(),ex:String(q.ex||'').trim(),src:q.src,on:q.on};
  if(q.rw!=null&&q.rw!==''&&isFinite(+q.rw)&&+q.rw>0)o.rw=Math.round(+q.rw);
  if(o.t==='mc'){o.c=(q.c||[]).map(x=>String(x).trim()).filter(Boolean);o.ai=Number.isInteger(q.ai)?q.ai:0;if(o.ai>=o.c.length)o.ai=0}
  else{o.a=String(q.a||'').trim();o.alt=(Array.isArray(q.alt)?q.alt:String(q.alt||'').split(',')).map(x=>String(x).trim()).filter(Boolean)}
  return o}
function normBoard(b){const o=clone(b);o.groups=(o.groups||[]).slice(0,8);while(o.groups.length<8)o.groups.push('그룹 '+(o.groups.length+1));
  o.era=ERA_KO[o.era]?o.era:'all';o.tiles=(o.tiles||[]).slice(0,32);
  const corner={0:'start',8:'jail',16:'pot',24:'fly'};
  for(let i=0;i<32;i++){const t=o.tiles[i]=Object.assign({t:'card',name:'말씀 카드',pic:'📜'},o.tiles[i]||{});
    if(corner[i])t.t=corner[i];else if(['start','jail','pot','fly'].includes(t.t))t.t='card';
    if(t.t==='city'){t.g=clamp(+t.g||0,0,7);t.price=Math.max(10,r10(+t.price||100))}
    if(t.t==='spot')t.price=Math.max(10,r10(+t.price||200));
    t.name=String(t.name||TILE_KO[t.t]).trim();t.pic=String(t.pic||'').trim()||'📍'}
  return o}
/* 판의 시대에 맞는 콘텐츠인지 */
const eraFits=(itemEra,boardEra)=>boardEra==='all'||itemEra==='all'||itemEra===boardEra;

/* ================= 엑셀 내보내기·불러오기 ================= */
const QUIZ_HEAD=['ID','사용','유형','난이도','시대','카테고리','문제','보기1','보기2','보기3','보기4','보기5','보기6','정답','인정 답안','해설','성경 구절','보상'];
function quizRows(list){return [QUIZ_HEAD,...list.map(q=>{const c=q.t==='mc'?q.c:[];
  return [q.id,q.on?'O':'X',TYPE_KO[q.t],LV_KO[q.lv],ERA_KO[q.era],q.cat,q.q,c[0]||'',c[1]||'',c[2]||'',c[3]||'',c[4]||'',c[5]||'',q.t==='mc'?q.ai+1:q.a,q.t==='sa'?(q.alt||[]).join(', '):'',q.ex||'',q.ref||'',q.rw||'']})]}
const QUIZ_GUIDE=[['항목','적는 방법'],['ID','비워 두면 새 문제로 추가돼요. 내보낸 파일의 ID를 그대로 두면 그 문제를 고쳐요.'],['사용','O이면 게임에 나오고, X이면 나오지 않아요.'],
  ['유형','객관식 또는 주관식'],['난이도','쉬움 · 보통 · 어려움'],['시대','구약 · 신약 · 공통 (판에 맞는 문제만 나와요)'],['카테고리','자유롭게 적어요. 예: 인물, 장소, 말씀 암송, 교회'],
  ['문제','문제 문장'],['보기1~보기6','객관식만 적어요. 2개 이상 필요해요.'],['정답','객관식은 정답 보기 번호(1~6)나 정답 보기의 글자, 주관식은 정답 문장'],['오답1~오답5','보기1~6 대신 "정답"과 "오답" 열만 만들어도 돼요. 보기 순서는 게임에서 섞여 나와요.'],['인정 답안','주관식에서 함께 정답으로 인정할 답을 쉼표로 구분해 적어요.'],
  ['해설','정답을 보여 줄 때 함께 나오는 설명'],['성경 구절','예: 창 1:1, 요 3:16 (누르면 말씀 보기 창이 열려요)'],['보상','퀴즈 칸에서 맞혔을 때 받는 달란트. 비우면 난이도에 따라 100·150·200']];
/* 표의 머리글을 찾아 열 번호로 바꿉니다 */
function headMap(head,names){const m={};head.forEach((h,i)=>{const k=String(h||'').replace(/\s/g,'');for(const n of names)if(k===n.replace(/\s/g,''))m[n]=i});return m}
function quizFromRows(rows,existing){
  const out={items:[],errors:[],add:0,upd:0};
  const hi=rows.findIndex(r=>r.some(c=>String(c).trim()==='문제'));
  if(hi<0){out.errors.push({row:0,msg:'첫 줄에 "문제" 머리글이 없어요. 내보내기로 받은 양식을 써 주세요.'});return out}
  const H=headMap(rows[hi],[...QUIZ_HEAD,'오답1','오답2','오답3','오답4','오답5']),get=(r,k)=>H[k]==null?'':String(r[H[k]]==null?'':r[H[k]]).trim();
  const ids=new Set(existing.map(q=>q.id));
  for(let i=hi+1;i<rows.length;i++){const r=rows[i],line=i+1;if(!r||r.every(c=>String(c==null?'':c).trim()===''))continue;
    const errs=[];const tKo=get(r,'유형')||'객관식',t=KO_TYPE[tKo];if(!t)errs.push(`"유형"은 객관식 또는 주관식으로 적어 주세요 (지금: ${tKo})`);
    const q=get(r,'문제');if(!q)errs.push('"문제" 칸이 비어 있어요');
    const lvKo=get(r,'난이도')||'보통',lv=KO_LV[lvKo];if(!lv)errs.push(`"난이도"는 쉬움·보통·어려움 중 하나로 적어 주세요 (지금: ${lvKo})`);
    const eraKo=get(r,'시대')||'공통',era=KO_ERA[eraKo];if(!era)errs.push(`"시대"는 구약·신약·공통 중 하나로 적어 주세요 (지금: ${eraKo})`);
    const item={id:get(r,'ID'),t,lv,era,cat:get(r,'카테고리')||'성경',q,ref:get(r,'성경 구절'),ex:get(r,'해설'),rw:get(r,'보상')};
    const on=!/^(x|아니|no|0|false)$/i.test(get(r,'사용'));
    if(item.rw&&!(+item.rw>0))errs.push('"보상"은 숫자로 적어 주세요');
    if(t==='mc'){let c=[1,2,3,4,5,6].map(n=>get(r,'보기'+n)).filter(Boolean);
      /* "정답 + 오답1~5" 열로 만든 표도 읽습니다: 정답이 첫 번째 보기가 돼요 */
      const wrong=[1,2,3,4,5].map(n=>get(r,'오답'+n)).filter(Boolean);if(!c.length&&wrong.length&&get(r,'정답'))c=[get(r,'정답'),...wrong];
      if(c.length<2)errs.push('객관식은 보기를 2개 이상 적어 주세요');
      const a=get(r,'정답');let ai=-1;if(/^\d+$/.test(a))ai=+a-1;else if(a)ai=c.indexOf(a);
      if(!a)errs.push('"정답" 칸이 비어 있어요');else if(ai<0||ai>=c.length)errs.push(`"정답"은 보기 번호(1~${Math.max(2,c.length)})로 적어 주세요 (지금: ${a})`);
      item.c=c;item.ai=ai}
    else if(t==='sa'){item.a=get(r,'정답');item.alt=get(r,'인정 답안');if(!item.a)errs.push('주관식 "정답" 칸이 비어 있어요')}
    if(errs.length){out.errors.push({row:line,msg:errs.join(' · ')});continue}
    if(item.id&&ids.has(item.id))out.upd++;else{item.id='';out.add++}
    item._on=on;out.items.push(item)}
  return out}

const CARD_HEAD=['ID','사용','시대','제목','성경 구절','설명','효과','효과 값','이동할 칸'];
function cardRows(list){return [CARD_HEAD,...list.map(c=>[c.id,c.on?'O':'X',ERA_KO[c.era]||'공통',c.t,c.r||'',c.d||'',FX_KO[c.fx.k]||c.fx.k,c.fx.k==='talent'?c.fx.n:c.fx.n==null?'':c.fx.n,c.fx.to||''])]}
function fxFrom(kKo,n,to){const k=KO_FX[kKo]||(FX_KO[kKo]?kKo:null);if(!k)return {err:`"효과"를 목록에서 골라 적어 주세요 (지금: ${kKo||'빈칸'})`};
  const fx={k};const num=+n;
  if(['gain','pay_pot','pay_bank','give_each','take_each','all_gain','give_poorest','take_richest','repair','quiz_bonus','talent'].includes(k)){if(!(num>0))return {err:'"효과 값"에 0보다 큰 숫자를 적어 주세요'};fx.n=Math.round(num);if(k==='talent')fx.max=300}
  if(k==='move_by'){if(!num||!Number.isInteger(num))return {err:'"효과 값"에 움직일 칸 수(뒤로는 음수)를 적어 주세요'};fx.n=num}
  if(k==='move_to'){if(!to)return {err:'"이동할 칸"에 칸 이름을 적어 주세요 (출발 칸은 @start)'};fx.to=to}
  return {fx}}
function cardsFromRows(rows,existing){const out={items:[],errors:[],add:0,upd:0};
  const hi=rows.findIndex(r=>r.some(c=>String(c).trim()==='제목'));if(hi<0){out.errors.push({row:0,msg:'"제목" 머리글이 없어요. 내보내기로 받은 양식을 써 주세요.'});return out}
  const H=headMap(rows[hi],CARD_HEAD),get=(r,k)=>H[k]==null?'':String(r[H[k]]==null?'':r[H[k]]).trim();const ids=new Set(existing.map(c=>c.id));
  for(let i=hi+1;i<rows.length;i++){const r=rows[i];if(!r||r.every(c=>String(c==null?'':c).trim()===''))continue;const errs=[];
    const t=get(r,'제목');if(!t)errs.push('"제목" 칸이 비어 있어요');const era=KO_ERA[get(r,'시대')||'공통'];if(!era)errs.push('"시대"는 구약·신약·공통 중 하나로 적어 주세요');
    const f=fxFrom(get(r,'효과'),get(r,'효과 값'),get(r,'이동할 칸'));if(f.err)errs.push(f.err);
    if(errs.length){out.errors.push({row:i+1,msg:errs.join(' · ')});continue}
    const it={id:get(r,'ID'),era,t,r:get(r,'성경 구절'),d:get(r,'설명')||fxText(f.fx),fx:f.fx};
    if(it.id&&ids.has(it.id))out.upd++;else{it.id='';out.add++}it._on=!/^(x|아니|no|0|false)$/i.test(get(r,'사용'));out.items.push(it)}
  return out}

const TILE_HEAD=['번호','종류','이름','짧은 이름','그림','그룹','가격','설명','성경 구절','효과','효과 값','이동할 칸'];
function boardSheets(b){return [
  {name:'판 정보',rows:[['항목','내용'],['이름',b.name],['시대',ERA_KO[b.era]],['설명',b.desc||''],...b.groups.map((g,i)=>['그룹'+(i+1),g])],widths:[12,60]},
  {name:'칸',rows:[TILE_HEAD,...b.tiles.map((t,i)=>[i,TILE_KO[t.t],t.name,t.short||'',t.pic,t.t==='city'?t.g+1:'',t.price||'',t.note||'',t.ref||'',t.fx?FX_KO[t.fx.k]:'',t.fx&&t.fx.n!=null?t.fx.n:'',t.fx&&t.fx.to||''])],widths:[6,10,14,10,6,6,8,50,18,16,8,12]}]}
function boardFromSheets(sheets){const out={board:null,errors:[]};
  const info=sheets.find(s=>s.name==='판 정보'),tiles=sheets.find(s=>s.name==='칸')||sheets[0];
  const b={name:'불러온 판',era:'all',desc:'',groups:[],tiles:[]};
  if(info)for(const r of info.rows.slice(1)){const k=String(r[0]||'').trim(),v=String(r[1]==null?'':r[1]).trim();if(k==='이름')b.name=v||b.name;else if(k==='시대')b.era=KO_ERA[v]||'all';else if(k==='설명')b.desc=v;else if(/^그룹\d$/.test(k))b.groups[+k.slice(2)-1]=v}
  if(!tiles){out.errors.push({row:0,msg:'"칸" 시트가 없어요'});return out}
  const H=headMap(tiles.rows[0]||[],TILE_HEAD),get=(r,k)=>H[k]==null?'':String(r[H[k]]==null?'':r[H[k]]).trim();
  if(H['종류']==null||H['이름']==null){out.errors.push({row:1,msg:'"종류"와 "이름" 머리글이 필요해요'});return out}
  const rows=tiles.rows.slice(1).filter(r=>r&&r.some(c=>String(c==null?'':c).trim()!==''));
  if(rows.length!==32)out.errors.push({row:0,msg:`칸은 정확히 32개여야 해요 (지금 ${rows.length}개)`});
  rows.slice(0,32).forEach((r,i)=>{const line=i+2,t=KO_TILE[get(r,'종류')];if(!t){out.errors.push({row:line,msg:`"종류"가 올바르지 않아요 (${get(r,'종류')})`});return}
    const o={t,name:get(r,'이름'),pic:get(r,'그림'),note:get(r,'설명'),ref:get(r,'성경 구절')};if(get(r,'짧은 이름'))o.short=get(r,'짧은 이름');
    if(t==='city'){o.g=(+get(r,'그룹')||1)-1;if(o.g<0||o.g>7)out.errors.push({row:line,msg:'"그룹"은 1~8 사이 숫자로 적어 주세요'});o.price=+get(r,'가격');if(!(o.price>0))out.errors.push({row:line,msg:'땅의 "가격"을 숫자로 적어 주세요'})}
    if(t==='spot'){o.price=+get(r,'가격')||200}
    if(t==='event'){const f=fxFrom(get(r,'효과'),get(r,'효과 값'),get(r,'이동할 칸'));if(f.err)out.errors.push({row:line,msg:f.err});else o.fx=f.fx}
    if(!o.name)out.errors.push({row:line,msg:'"이름" 칸이 비어 있어요'});b.tiles[i]=o});
  const want={0:'start',8:'jail',16:'pot',24:'fly'};for(const [i,t] of Object.entries(want))if(b.tiles[i]&&b.tiles[i].t!==t)out.errors.push({row:+i+2,msg:`${+i}번 칸은 "${TILE_KO[t]}" 칸이어야 해요`});
  if(!out.errors.length)out.board=normBoard(b);return out}

/* 전체 백업(JSON) */
function backupData(){return {type:'biblemarble-backup',v:1,date:new Date().toISOString(),quiz:Content._get('quiz'),card:Content._get('card'),board:Content._get('board'),setup:store.get('setup',null),prefs:store.get('prefs',null)}}
function restoreBackup(o){if(!o||o.type!=='biblemarble-backup')throw new Error('성경 부루마블 백업 파일이 아니에요.');
  for(const k of ['quiz','card','board'])if(o[k])Content._set(k,o[k]);if(o.setup)store.set('setup',o.setup);if(o.prefs)store.set('prefs',o.prefs)}
