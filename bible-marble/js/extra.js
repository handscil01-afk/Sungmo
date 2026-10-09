'use strict';
/* ================= 추가 기능 =================
   설정 → ✨ 추가 기능에서 하나씩 켜고 끕니다. 진행 규칙에 관한 것은 engine.js처럼 요청서(ask)로 묻고, 답은 되돌리기·이어하기 기록에 남습니다.
   - 성경 인물 카드: 퀴즈·암송 미션을 맞히거나 헌금함 칸에 가면 받고, 인물마다 한 번 쓰는 능력이 있습니다. 여섯 명을 모으면 보너스.
   - 땅 거래: 내 차례에 주사위를 굴리기 전에 다른 사람에게 땅·달란트를 바꾸자고 제안합니다.
   - 말씀 암송 미션 칸: 구절의 빈칸 채우기. 사용자가 불러온 성경 본문이나 직접 넣은 구절만 씁니다(본문은 저장소에 없음).
   - 시간 제한: 정한 시간이 지나면 그 라운드까지만 합니다.
   - 진행자 즉석 문제: 진행자가 입력한 문제를 다음 차례 전에 냅니다.
   - 게임 기록: 끝난 게임을 이 기기에 모읍니다(명예의 전당). */

/* ---------- 성경 인물 카드 ---------- */
const CHARS=[
  {id:'david',n:'다윗',pic:'🪨',ab:'통행료 한 번 면제',d:'물맷돌 하나로 골리앗을 이긴 목동 소년',ref:'삼상 17:49',when:'toll'},
  {id:'moses',n:'모세',pic:'🌊',ab:'광야에서 바로 나오기',d:'홍해를 가르고 백성을 이끈 지도자',ref:'출 14:21',when:'wild'},
  {id:'esther',n:'에스더',pic:'👑',ab:'주사위 대신 원하는 칸으로 이동',d:'"죽으면 죽으리이다" 백성을 구한 왕비',ref:'에 4:16',when:'roll'},
  {id:'joseph',n:'요셉',pic:'🌾',ab:'은행에서 200 달란트 받기',d:'풍년에 곡식을 모아 흉년을 이긴 총리',ref:'창 41:49',when:'roll'},
  {id:'elijah',n:'엘리야',pic:'🔥',ab:'헌금함 달란트 절반 받기',d:'갈멜산에서 하늘의 불을 부른 선지자',ref:'왕상 18:38',when:'roll'},
  {id:'ruth',n:'룻',pic:'🌿',ab:'모든 사람에게서 30 달란트씩 받기',d:'보아스의 밭에서 이삭을 주운 며느리',ref:'룻 2:2',when:'roll'}];
const CHAR_SET_BONUS=500;
const charOf=id=>CHARS.find(c=>c.id===id);
const charsLeft=(p,when)=>G.cfg.chars&&p.chars?CHARS.filter(c=>c.when===when&&p.chars[c.id]===0):[];
async function grantChar(p,why){
  if(!G.cfg.chars||p.out)return;p.chars=p.chars||{};
  const miss=CHARS.filter(c=>!(c.id in p.chars));
  if(!miss.length){gain(p,50,'인물 카드를 모두 모은 보너스');return}
  const id=rnd('char',()=>miss[Math.random()*miss.length|0].id),c=charOf(id);
  p.chars[id]=0;sfx('card');log(`${p.name}: 성경 인물 카드 「${c.n}」를 받았어요`,p);render();
  await notice(p,{kind:'card',pic:c.pic,kick:`🃏 성경 인물 카드 · ${why}`,tone:'#c9a6ff',title:`${c.n} 카드를 받았어요`,
    body:`<p>${esc(c.d)}</p><p>능력 (한 번 쓸 수 있어요): <b>${esc(c.ab)}</b></p><p class="ref">모은 인물 ${Object.keys(p.chars).length} / ${CHARS.length}명 · 모두 모으면 ${fmt(CHAR_SET_BONUS)} 달란트</p>`,ref:c.ref,autoMs:2600});
  if(Object.keys(p.chars).length===CHARS.length&&!p.charSet){p.charSet=1;gain(p,CHAR_SET_BONUS,'성경 인물 여섯 명을 모두 모았어요');
    await notice(p,{pic:'🎉',kick:'🃏 성경 인물 카드',title:`${IGA(p.name)} 인물 카드를 모두 모았어요!`,body:`<p>보너스로 <b>${fmt(CHAR_SET_BONUS)}</b> 달란트를 받았어요.</p>`,tone:'#c9a6ff'})}}
/* 인물 카드 쓰기: 'moved'를 돌려주면 이번 차례는 주사위 없이 끝납니다 */
async function useChar(p,id){const c=charOf(id);if(!c||!p.chars||p.chars[id]!==0)return false;p.chars[id]=1;sfx('card');
  log(`${p.name}: ${c.n} 카드를 썼어요 (${c.ab})`,p);toast(`${c.pic} ${IGA(p.name)} ${c.n} 카드를 썼어요`);render();
  switch(id){
    case 'joseph':gain(p,200,'요셉 카드');break;
    case 'elijah':{const v=r10(G.pot/2);if(v>0){G.pot-=v;payFx('pot',p.id,v);gain(p,v,'엘리야 카드 (헌금함 절반)')}else toast('헌금함이 비어 있어요');break}
    case 'ruth':for(const q of alive().filter(q=>q!==p))await charge(q,30,p,'룻 카드');break;
    case 'esther':{const dest=await ask({kind:'fly',who:'player',pid:p.id,undo:1,why:'esther'});
      log(`${p.name}: 에스더 카드로 ${RO(T(dest).name)} 갔어요`,p);await moveTo(p,dest,true);await land(p);return 'moved'}}
  return true}
/* 컴퓨터는 차례를 시작할 때 바로 쓸 수 있는 카드를 씁니다 */
async function aiChars(p){if(!G.cfg.chars||!p.chars)return;
  for(const id of ['joseph','ruth'])if(p.chars[id]===0)await useChar(p,id);
  if(p.chars.elijah===0&&G.pot>=200)await useChar(p,'elijah')}

/* ---------- 주사위 화면에서 고를 수 있는 일 ---------- */
function rollActs(p){const a=[];
  if(G.cfg.trade&&alive().some(q=>q!==p&&(landsOf(q).length||landsOf(p).length)))a.push('trade');
  for(const c of charsLeft(p,'roll'))a.push('char:'+c.id);
  return a}
async function doAct(p,act){if(act==='trade')return tradeFlow(p);if(act.startsWith('char:'))return useChar(p,act.slice(5))}

/* ---------- 땅 거래 ---------- */
const landWorth=i=>T(i).price+(T(i).t==='city'&&G.own[i]?G.own[i].l*upCost(i):0);
function tradeValid(p,o){if(!o||typeof o!=='object')return false;const q=byId(o.to);
  if(!q||q===p||q.out||p.out)return false;
  const ok=a=>Array.isArray(a)&&a.length<=40&&new Set(a).size===a.length&&a.every(Number.isInteger);
  if(!ok(o.give)||!ok(o.get)||!Number.isInteger(o.pay)||o.pay%10||Math.abs(o.pay)>99990)return false;
  if(!o.give.length&&!o.get.length&&!o.pay)return false;
  if(!o.give.every(i=>G.own[i]&&G.own[i].o===p.id)||!o.get.every(i=>G.own[i]&&G.own[i].o===q.id))return false;
  return o.pay>0?p.money>=o.pay:q.money>=-o.pay}
async function tradeFlow(p){
  const o=await ask({kind:'trade',who:'player',pid:p.id,undo:1});
  if(!o)return;const q=byId(o.to);
  log(`🤝 ${p.name} → ${q.name}: 땅 거래를 제안했어요`,p);
  const yes=await ask({kind:'tradeok',who:'player',pid:q.id,from:p.id,give:o.give,get:o.get,pay:o.pay,undo:0});
  if(!yes){sfx('bad');log(`🤝 ${q.name}: 거래를 거절했어요`,q);toast(`🤝 ${IGA(q.name)} 거래를 거절했어요`);return}
  if(!tradeValid(p,o)){toast('그사이 조건이 바뀌어서 거래를 취소했어요');return}
  for(const i of o.give)G.own[i].o=q.id;for(const i of o.get)G.own[i].o=p.id;
  if(o.pay>0){p.money-=o.pay;q.money+=o.pay;payFx(p.id,q.id,o.pay)}else if(o.pay<0){q.money+=o.pay;p.money-=o.pay;payFx(q.id,p.id,-o.pay)}
  sfx('build');const names=a=>a.map(i=>T(i).name).join(', ');
  log(`🤝 거래 성사: ${p.name}${o.give.length?` (${names(o.give)})`:''} ↔ ${q.name}${o.get.length?` (${names(o.get)})`:''}${o.pay?` · ${fmt(Math.abs(o.pay))} 달란트`:''}`,p);
  toast(`🤝 ${IGA(p.name)} ${q.name}님과 거래했어요`);
  for(const i of o.give)burst(i,`${tokTxt(q.tok)} 거래`,q.col);for(const i of o.get)burst(i,`${tokTxt(p.tok)} 거래`,p.col);render();await sleep(600)}

/* ---------- 말씀 암송 미션 ---------- */
/* 구절 주소만 담아 둡니다. 본문은 사용자가 불러온 성경(이 기기)이나 직접 넣은 구절에서 가져옵니다 */
const MEMO_REFS=['창 1:1','신 6:5','수 1:9','시 23:1','시 37:5','시 46:1','시 119:105','잠 3:5','잠 3:6','사 40:31','사 41:10','렘 29:11','미 6:8',
  '마 5:14','마 6:33','마 7:7','마 11:28','마 22:37','눅 6:31','요 1:1','요 3:16','요 13:34','요 14:6','요 15:5','행 1:8','롬 8:28','롬 12:2',
  '고전 13:4','고후 5:17','갈 5:22','엡 2:8','빌 4:6','빌 4:13','살전 5:16','살전 5:17','살전 5:18','히 11:1','히 12:2','약 1:5','요일 4:8'];
function memoVerses(){const out=[];
  for(const v of store.get('memo.verses',[])||[])if(v&&typeof v.text==='string'&&v.text.trim())out.push({ref:String(v.ref||''),text:v.text.trim()});
  if(Bible.data)for(const r of MEMO_REFS){const x=parseRefs(r)[0];if(!x||!x.v)continue;const t=Bible.verse(x.b,x.c1,x.v[0][0]);if(t)out.push({ref:r,text:t})}
  return out}
const MEMO_JOSA=['에게서','으로써','에서는','께서','에서','에게','으로','이니','이요','이며','을','를','이','가','은','는','의','에','와','과','도','로','만'];
const isWord=s=>s.length>=2&&s.length<=6&&/^[가-힣]+$/.test(s);
function memoStem(w){w=w.replace(/[.,!?·:;'"‘’“”()\[\]]/g,'');for(const j of MEMO_JOSA)if(w.length>=j.length+2&&w.endsWith(j))return w.slice(0,-j.length);return w}
function makeMemoQ(list){
  for(let tries=0;tries<8;tries++){
    const v=list[Math.random()*list.length|0],words=v.text.split(/\s+/).filter(Boolean);
    const cand=words.map((w,i)=>({i,stem:memoStem(w)})).filter(x=>isWord(x.stem));if(!cand.length)continue;
    const pick=cand[Math.random()*cand.length|0];
    const pool=[...new Set(list.flatMap(o=>o.text.split(/\s+/).map(memoStem)).filter(s=>isWord(s)&&s!==pick.stem))];
    if(pool.length<3)continue;
    pool.sort((a,b)=>Math.abs(a.length-pick.stem.length)-Math.abs(b.length-pick.stem.length));
    const wrong=shuffle(pool.slice(0,10)).slice(0,3),choices=shuffle([pick.stem,...wrong]);
    const shown=words.map((w,i)=>i===pick.i?w.replace(pick.stem,'□'.repeat(pick.stem.length)):w).join(' ');
    return {id:'m:'+v.ref+':'+pick.i,t:'mc',q:shown,lv:'normal',cat:'암송',ref:v.ref,ex:v.text,rw:150,choices,ans:choices.indexOf(pick.stem),reset:0}}
  return null}
async function memoMission(p){
  try{await Bible.load()}catch(e){}
  const Q=rnd('memoq',()=>{const l=memoVerses();return l.length?makeMemoQ(l):null});
  if(!Q){toast('암송할 구절이 없어서 말씀 퀴즈로 대신해요 (콘텐츠에서 성경 본문을 불러오거나 구절을 넣어 주세요)');
    const r=await quizFlow(p,'tile',{kick:'📜 암송 미션 → 말씀 퀴즈'});if(r.by===p.id){gain(p,r.rw||QREWARD[r.lv],'말씀 퀴즈 정답');await grantChar(p,'말씀 퀴즈')}return}
  setMsg('📜 말씀 암송 미션!');
  const r=await quizFlow(p,'memo',{q:Q,kick:'📜 말씀 암송 미션',sub:'빈칸(□)에 들어갈 말을 고르세요 · 맞히면 <b>150</b> 달란트와 인물 카드'});
  if(r.ok){gain(p,150,'암송 미션 성공');await grantChar(p,'암송 미션')}}

/* ---------- 시간 제한 ---------- */
/* 진행 시간은 방장(혼자 하는 기기)이 1초마다 더하고, 멈춘 동안은 더하지 않습니다. 다른 기기는 받은 값에서 이어서 셉니다 */
function clockUsed(g){const c=g&&g.clock;if(!c)return 0;return c.used+(c.run?Math.max(0,Math.min(5000,Date.now()-c.at)):0)}
function clockLeft(g){return g&&g.cfg.timeLimit>0?Math.max(0,g.cfg.timeLimit*60000-clockUsed(g)):null}
setInterval(()=>{if(!G||Net.role==='client')return;const now=Date.now(),c=G.clock||(G.clock={used:0,at:now,run:false});
  if(c.run)c.used+=Math.max(0,Math.min(5000,now-c.at));c.at=now;c.run=!G.over&&!G.paused&&G.cfg.timeLimit>0;
  if(!c.run||G.lastRound)return;const rem=G.cfg.timeLimit*60000-c.used;
  if(rem<=60000&&!c.warn){c.warn=1;toast('⏰ 정한 시간이 1분 남았어요')}
  if(rem<=0){G.lastRound=G.round;log(`⏰ 정한 시간이 다 됐어요. ${G.round}라운드까지만 하고 끝내요`);toast(`⏰ 시간이 다 됐어요! 이번 ${G.round}라운드까지만 해요`,4000);sfx('card');render();persist()}},1000);

/* ---------- 진행자 즉석 문제 ---------- */
function hqClean(q){if(!q||typeof q!=='object')return null;const s=(x,n)=>String(x==null?'':x).trim().slice(0,n);
  const o={t:q.t==='sa'?'sa':'mc',q:s(q.q,200),target:q.target==='all'?'all':'turn',prize:Math.round(+q.prize/10)*10};
  if(!o.q||!(o.prize>=10&&o.prize<=1000))return null;
  if(o.t==='mc'){const c=Array.isArray(q.c)?q.c.map(x=>s(x,40)).filter(Boolean).slice(0,4):[];if(c.length<2||new Set(c).size!==c.length)return null;
    const a=+q.a;if(!Number.isInteger(a)||a<0||a>=c.length)return null;o.c=c;o.a=a}
  else{o.a=s(q.a,40);if(!o.a)return null}
  return o}
const hqAllowed=()=>!!G&&!G.over&&G.cfg.hostQ!==false&&MODE()!=='player';
function queueHQ(q){const n=hqClean(q);if(!n||!hqAllowed())return false;(G.hq=G.hq||[]).push(n);
  log('🎤 진행자가 즉석 문제를 준비했어요');toast('🎤 즉석 문제는 다음 차례가 시작될 때 나와요');render();persist();return true}
async function runHostQs(){while(G.hq&&G.hq.length&&!G.over){await hostQuiz(G.hq.shift());if(alive().length<=1)return}}
async function hostQuiz(q){
  const Q={id:'h'+uid(''),t:q.t,q:q.q,lv:'normal',cat:'즉석',ref:'',ex:'',rw:q.prize,reset:0,...(q.t==='mc'?{choices:q.c,ans:q.a}:{a:q.a,alt:[]})},kick='🎤 진행자 즉석 문제';
  setMsg('🎤 진행자 즉석 문제!');
  if(q.target==='turn'){const p=cur();
    if(p.ai&&q.t==='sa'){toast('컴퓨터는 주관식 즉석 문제를 풀지 않아요');return}
    const r=await quizFlow(p,'host',{q:Q,kick,sub:`맞히면 <b>${fmt(q.prize)}</b> 달란트`});if(r.ok)gain(p,q.prize,'즉석 문제 정답');return}
  if(q.t==='mc'){const QS={purpose:'host',kick:kick+' · 모두 함께',sub:`맞힌 사람 모두 <b>${fmt(q.prize)}</b> 달란트`,pid:cur().id,q:Q,tries:[],stage:'all',stealer:null,by:null,each:1};
    const win=await allStep(QS,null,q.prize);QS.stage='result';QS.split=win;
    await ask({kind:'qr',who:'any',pid:cur().id,quiz:pubQuiz(QS),undo:1});quizStats(QS);
    for(const id of win)gain(byId(id),q.prize,'즉석 문제 정답');return}
  /* 주관식 · 모두에게: 모두 소리 내어(또는 종이에) 답하고, 진행자가 맞힌 사람을 고릅니다 */
  const cands=alive().filter(x=>!x.ai).map(x=>x.id);if(!cands.length)return;
  const ids=await ask({kind:'qmark',who:'host',pid:cur().id,cands,prize:q.prize,quiz:{kick,q:{t:'sa',q:q.q,lv:'normal'}},secret:{a:q.a},undo:1});
  for(const id of ids){const s=statOf(id);s.q++;s.ok++;gain(byId(id),q.prize,'즉석 문제 정답')}
  for(const id of cands)if(!ids.includes(id))statOf(id).q++;
  toast(ids.length?`🎤 정답: ${ids.map(id=>byId(id).name).join(', ')}`:'🎤 맞힌 사람이 없어요');sfx(ids.length?'good':'bad')}

/* ---------- 게임 기록 · 명예의 전당 ---------- */
function statOf(id){G.st=G.st||{};return G.st[id]=G.st[id]||{q:0,ok:0}}
function quizStats(QS){for(const t of QS.tries){const s=statOf(t.pid);s.q++;if(t.ok)s.ok++}
  if(QS.all)for(const [id,c] of Object.entries(QS.all)){const s=statOf(+id);s.q++;if(c===QS.q.ans)s.ok++}}
function endReason(){return alive().length<=1?'last':G.lastRound&&G.round>G.lastRound&&!(G.cfg.rounds>0&&G.round>G.cfg.rounds)?'time':'rounds'}
function saveRecord(){if(PREF.records===false||Net.role==='client'||REPLAY)return;
  const rank=G.players.slice().sort((a,b)=>(a.out-b.out)||worth(b)-worth(a));
  const best=Object.entries(G.own).map(([i,o])=>({i:+i,o:o.o,v:tollOf(+i)})).sort((a,b)=>b.v-a.v)[0];
  const rec={id:G.started,t:Date.now(),board:G.board.name,mode:MODE(),round:Math.min(G.round,G.cfg.rounds>0?G.cfg.rounds:G.round),reason:G.endReason,min:Math.round((Date.now()-G.started)/60000),
    players:rank.map(p=>{const s=(G.st&&G.st[p.id])||{q:0,ok:0};return {name:p.name,tok:tokTxt(p.tok),col:p.col,ai:!!p.ai,out:!!p.out,worth:p.out?0:worth(p),money:p.money,lands:landsOf(p).length,q:s.q,ok:s.ok,chars:Object.keys(p.chars||{}).length,mates:(p.mates||[]).map(m=>m.name)}}),
    best:best?{name:T(best.i).name,toll:best.v,owner:byId(best.o).name}:null};
  const all=store.get('records',[])||[],k=all.findIndex(r=>r.id===rec.id);if(k>=0)all[k]=rec;else all.unshift(rec);store.set('records',all.slice(0,60))}
