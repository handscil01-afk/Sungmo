'use strict';
/* ===================== 중계 음성 (녹음한 캐스터 목소리 조각 이어 붙이기) =====================
   읽어 주기가 '중계 음성'이면 경기 결과는 화면 낭독기 대신 캐스터 목소리로 중계함.
   voice/index.json의 variants에 같은 문장의 녹음이 여러 개면(이름-2) 번갈아 골라 매번 조금씩 다르게 들림.
   공을 친 결과는 뜸 들이는 중계 시간표에 맞춰: '쳤습니다! 높이 뜹니다! 오른쪽으로!' → (타구가 떨어질 때) '잡았습니다! 아웃!' */
const CAST = { idx:null, styles:{}, buf:{}, loading:{}, until:0, last:{}, src:[] };
// 중계 음성: 설정의 '중계 음성'이 켜져 있고 효과음이 켜져 있을 때 (두 모드 모두 기본 켬)
// 결과 전달이 '글만'이면 캐스터 목소리로 결과를 말하지 않음
function castOn(){ return SET.cast !== false && SET.snd !== false && SET.deliver !== 'text'; }
// 설정을 켤 때 들려 주는 예시
function castSample(){ castLoadIndex().then(() => {
  const ids = CAST.idx && CAST.idx.c_hello ? ['c_hello', anaRate() && CAST.idx.a_hello ? 'a_hello' : null, 'playball'].filter(Boolean) : ['intro', 'playball'];
  Promise.all(ids.map(castLoad)).then(() => { castStop(); castPlay(ids, 0.1); }); }); }
function castLoadIndex(){
  if(CAST.idx || CAST.idxP) return CAST.idxP;
  CAST.idxP = fetch(new URL('voice/index.json', document.baseURI).href).then(r => r.json()).then(j => { CAST.idx = j.variants || {}; CAST.styles = j.styles || {}; }).catch(() => { CAST.idx = {}; });
  return CAST.idxP;
}
function castFile(id){
  const n = CAST.idx && CAST.idx[id]; if(!n) return null;
  // 지난번과 다른 녹음을 고름
  // 해설 스타일(SET.castStyle): voice/index.json의 styles에 그 스타일의 같은 아이디 녹음이 있으면 voice/<스타일>/ 쪽을 씀. 없는 줄은 기본(차분) 녹음
  const sty = SET.castStyle && SET.castStyle !== 'calm' && CAST.styles && CAST.styles[SET.castStyle] && CAST.styles[SET.castStyle][id] ? SET.castStyle : null;
  const cnt = sty ? CAST.styles[sty][id] : n;
  let k = 1 + Math.floor(Math.random() * cnt);
  if(cnt > 1 && CAST.last[id] === k) k = k % cnt + 1;
  CAST.last[id] = k;
  return (sty ? sty + '/' : '') + (k === 1 ? id : `${id}-${k}`);
}
function castLoad(name){
  const c = audio(); if(!c || CAST.buf[name] || CAST.loading[name]) return CAST.loading[name];
  CAST.loading[name] = fetch(new URL(`voice/${name}.mp3`, document.baseURI).href).then(r => r.arrayBuffer())
    .then(ab => new Promise((ok, no) => { const p = c.decodeAudioData(ab, ok, no); if(p && p.then) p.then(ok, no); }))
    .then(b => { CAST.buf[name] = b; }).catch(() => {});
  return CAST.loading[name];
}
// 처음 누를 때 모든 조각을 미리 불러 둠 (약 2.7MB)
function castPreload(){
  castLoadIndex().then(() => {
    Object.entries(CAST.idx || {}).forEach(([id, n]) => { for(let k = 1; k <= n; k++) castLoad(k === 1 ? id : `${id}-${k}`); });
    const sty = SET.castStyle && CAST.styles[SET.castStyle];   // 고른 스타일의 녹음도 미리
    if(sty) Object.entries(sty).forEach(([id, n]) => { for(let k = 1; k <= n; k++) castLoad(`${SET.castStyle}/${k === 1 ? id : `${id}-${k}`}`); });
  });
}
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if(castOn()) castPreload(); }, { capture:true, once:true }));
// 중계 소리의 전체 음량 조절기: 안내 음성(질문·선택지)을 읽는 동안 중계를 작게 함(덕킹)
function castMaster(c){
  if(!CAST.master || CAST.masterCtx !== c){ const m = c.createGain(); m.gain.value = 1; m.connect(c.destination); CAST.master = m; CAST.masterCtx = c; }
  return CAST.master;
}
// sec초 동안 중계를 작게 (중계가 나오는 중일 때만 호출됨)
function castDuck(sec){
  const c = audio(); if(!c || !CAST.until || CAST.until <= c.currentTime) return;
  const g = castMaster(c).gain; if(!g.setTargetAtTime) return;
  const t = c.currentTime;
  try{ g.cancelScheduledValues(t); g.setTargetAtTime(0.35, t, 0.05); g.setTargetAtTime(1, t + sec, 0.3); }catch(e){}
}
// 조각들을 at초 뒤부터 이어서 틂 (앞 중계가 아직 나오는 중이면 끝난 뒤에). 끝나는 시각을 돌려줌
function castPlay(ids, at = 0){
  const c = audio(); if(!c || !castOn()) return 0;
  if(c.state !== 'running' && c.state !== 'closed') c.resume().catch(() => {});   // 멈춰 있으면(음성 대화·다른 앱 소리 뒤) 다시 켬
  let t = Math.max(c.currentTime + at, CAST.until);
  ids.filter(Boolean).forEach(id => {
    const name = castFile(id); if(!name) return;
    const b = CAST.buf[name]; if(!b){ castLoad(name); return; }
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = b; g.gain.value = 1; s.connect(g); g.connect(castMaster(c)); s.start(t);
    CAST.src.push(s); s.onended = () => { const i = CAST.src.indexOf(s); if(i >= 0) CAST.src.splice(i, 1); };
    t += b.duration + 0.08;
  });
  CAST.until = t;
  return t - c.currentTime;
}
// 지난 중계가 아직 남아 있으면 끊고 지금 장면부터 (빠르게 진행해도 중계가 밀리지 않게)
function castDur(id){ const b = CAST.buf[id]; return b ? b.duration + 0.08 : 0.7; }
// 중계하지 않은 결과(건너뛰기·중계 끔)도 '이미 본 것'으로 적어 둠: 나중에 옛 견제·판독을 말하지 않게
function castSeen(){}   // 예전에는 본 공·플레이 번호를 적어 뒀지만, 이제 결과마다 사건 목록이 따로 오므로 할 일이 없음 (호출하는 곳은 그대로 둠)
function castStop(){ CAST.src.splice(0).forEach(s => { try{ s.stop(); }catch(e){} }); CAST.until = 0; }
// 녹음이 있는 조각만 골라서 (아직 녹음하지 않은 새 말은 건너뜀)
const pick1 = (...ids) => { const have = CAST.idx ? ids.filter(id => CAST.idx[id]) : ids, L = have.length ? have : ids; return L[Math.floor(Math.random() * L.length)]; };
// 해설: 설정(자주·가끔·끔)에 따라 확률을 곱함. 녹음이 없으면 말하지 않음
const anaRate = () => ({ often:1.7, some:1, off:0 })[SET.analyst || 'some'];
const ana = (p, ...ids) => Math.random() < Math.min(0.95, p * anaRate()) ? pick1(...ids) : null;
const numClip = n => n >= 0 && n <= 20 ? `num_${n}` : null;   // 녹음: 영~이십
const runClip = b => { const k = [0, 1, 2].filter(i => b[i] != null).map(i => i + 1).join(''); return ({ '':'run_none', 1:'run_1', 2:'run_2', 3:'run_3', 12:'run_12', 13:'run_13', 23:'run_23', 123:'run_full' })[k]; };
const teamClip = (T, long) => `team_${T.key}${long ? '' : '_s'}`;

// 이닝 끝 해설: inningLog의 한 줄(e)에서 상황을 가려 말함. 실점한 이닝에는 '깔끔하게'를 말하지 않음.
// 새 녹음이 아직 없으면(a_inn_*) 맞는 옛 녹음(a_inning1 깔끔하게, a_inning2 실점 없이)만 쓰고, 둘 다 안 맞으면 말하지 않음
function inningTalk(e){
  if(!e) return null;
  const quiet = e.hits + e.walks + e.errors === 0;
  if(e.runs >= 3) return ana(0.7, 'a_inn_big');
  if(e.runs > 0) return ana(0.5, e.runs === 1 ? 'a_inn_run1' : 'a_inn_runs');
  if(quiet) return ana(0.4, e.ks >= 3 ? 'a_inn_k' : 'a_inning1', 'a_inning1');
  if(e.dp > 0) return ana(0.6, 'a_inn_dp', 'a_inning2');
  if(e.lob >= 3) return ana(0.6, 'a_inn_lob', 'a_inning2');
  return ana(0.4, 'a_inn_escape', 'a_inning2');
}
/* 경기 결과 하나(res)를 중계로: gameNext가 부름.
   공 하나의 시간표(timeline.js)대로: 투구 동작 중 "던졌습니다" → 공이 미트에 들어가는 순간 "스트라이크!/볼." → 볼카운트
   / 친 공은 맞는 순간부터 "쳤습니다! 높이 뜹니다!" → 잡히거나 떨어지는 순간 결과 → 득점 → 새 타자·주자·아웃 안내.
   조각은 겹치지 않게 이어서 틂. 다음 선택은 중계가 끝날 때까지 기다림(game.js). 돌려주는 값: { at 결과를 말하는 시각, end 다 끝나는 시각 } (초) */
function castResult(res, opt = {}){
  if(!castOn() || !res || typeof G === 'undefined' || !G) return null;
  castLoadIndex();
  // 결과는 글이 아니라 사건 목록(res.events, engine.js의 ev)에서 읽음.
  // 여러 공을 한꺼번에 진행한 결과(맡기기·자동)면 마지막 공의 사건만 보고 판정을 말함 (앞 공의 파울·득점을 섞지 않게)
  const evAll = res.events || [], lastP = evAll.map(e => e.k).lastIndexOf('pitch'), evs = lastP > 0 ? evAll.slice(lastP) : evAll;
  const isE = (list, k, f, v) => list.some(e => e.k === k && (f == null || e[f] === v));
  const pa = r => isE(evs, 'pa', 'r', r), call = c => isE(evs, 'call', 'c', c);
  // 예전 효과 이름(fx)과 같은 이름으로 물어볼 수 있게 한 묶음 (이름은 그대로, 읽는 곳은 사건)
  const has = n => ({ pitch: () => isE(evs, 'pitch'), hit: () => pa('b1'), b2: () => pa('b2'), b3: () => pa('b3'), hr: () => pa('hr'), out: () => pa('out'), safe: () => pa('safe'),
    k: () => pa('k'), ball: () => pa('bb'), ballc: () => call('ball'), strike: () => call('strike'), foul: () => call('foul'), score: () => isE(evs, 'score'),
    batBig: () => evs.some(e => e.k === 'contact' && e.big), batF: () => evs.some(e => e.k === 'contact' && e.foul), batter: () => isE(evs, 'batter'), change: () => isE(evs, 'inning') })[n]();
  const hasAll = n => ({ start: () => evAll.some(e => e.k === 'game' && e.e === 'start'), change: () => isE(evAll, 'inning'), pchange: () => isE(evAll, 'pchange'), batter: () => isE(evAll, 'batter') })[n](), A = G.anim;
  const whiffed = call('whiff'), pl = evs.find(e => e.k === 'play');
  const plan = [];   // [시각(초), [조각…]] 시각 순서대로
  const at = (t, ...ids) => { ids = ids.flat(3).filter(Boolean); if(ids.length) plan.push([t, ids]); };
  // 경기 시작: 캐스터·해설 소개 (녹음이 있으면), 두 팀, 플레이볼
  if(hasAll('start')){
    const hello = CAST.idx && CAST.idx.c_hello ? ['c_hello', 'c_with', anaRate() ? 'a_hello' : null] : ['intro'];
    const preview = anaRate() && CAST.idx && CAST.idx.c_ask && Math.random() < 0.5 * anaRate() ? ['c_ask', pick1('a_preview1', 'a_preview2', 'a_preview3')] : [];
    at(0, ...hello, teamClip(G.teams[0], true), 'j_vs', teamClip(G.teams[1], true), ...preview, 'playball');
    CAST.score = [0, 0];
  }
  const contact = evs.some(e => e.k === 'contact' && !e.bunt), pitched = !!A && (has('pitch') || contact);
  const tl = pitched ? playTL(A, evs) : null;
  let resAt = 0, hitAt = null;   // hitAt: 안타가 정해지는(함성이 터질) 시각
  if(pitched){
    // 던질 때: 구종 이름이나 "던졌습니다!" (공을 놓는 순간 끝나게)
    const thr = G.mode !== 'simple' && A.t && Math.random() < 0.45 ? `pt_${A.t}` : pick1('p_throw1', 'p_throw2', 'p_throw3', 'p_throw4', 'p_throw5', 'p_throw6');
    at(Math.max(0, tl.contact - 0.05 - castDur(thr)), thr);   // 공이 도착하기 전에 끝나게
    const ps = A.bb && A.bb.ps;
    if(A.res === 'inplay' && A.bb){
      const bb = A.bb, fence = (G.park && G.park.fence && G.park.fence[bb.fi]) || 110, ev = (ps && ps.ev) || [];
      const dive = ev.find(e => e.k === 'dive'), caught = ev.find(e => e.k === 'catch');
      const fly = [ps && ps.bunt ? 'r_bunt' : has('batBig') ? pick1('c_hit1', 'c_hit2', 'c_hit4', 'c_hit5') : pick1('c_hit3', 'c_soft1', 'c_soft2')];
      if(!(ps && ps.bunt)){
        fly.push(bb.type === 'gb' ? pick1('c_ground1', 'c_ground2') : bb.type === 'ld' ? 'c_liner' : pick1('c_high1', 'c_high2'));
        fly.push(['c_left', 'c_center', 'c_right'][bb.fi ?? 1]);
        if(bb.type === 'fb' && (bb.d || 0) >= fence - 18) fly.push(pick1('c_far1', 'c_far2', 'c_far3'), 'c_back');
        else if(bb.type !== 'gb') fly.push('c_chase');
        if(dive) fly.push('c_dive');
      }
      // 안타는 공이 떨어지는(내야를 빠져나가는) 순간에 "안타!", 그 뒤 베이스 승부(홈 송구 등)는 일어나는 순간마다
      const isHit = !!ps && (has('hit') || has('b2') || has('b3'));
      let hitT = null;
      hitAt = null;
      if(isHit){
        const land = ev.find(e => e.k === 'land'), first = ev.find(e => e.k === 'ball'), pick = ev.find(e => e.k === 'pickup');
        hitT = land ? land.t : bb.type === 'gb' && first ? Math.min(first.t1, 1.3) : pick ? pick.t - 0.3 : null;
      }
      // 결과 전까지 들어가는 만큼만 (첫 마디는 꼭)
      const room = (hitT != null ? hitT : tl.result - tl.contact) - (hitT != null ? 0 : 0) - 0.1, fit = [];
      let used = 0;
      fly.forEach((id, i) => { const d = castDur(id); if(i === 0 || used + d <= room){ fit.push(id); used += d; } });
      at(tl.contact, fit);
      const post = [], dpFallback = !pl && isE(evs, 'play', 'kind', 'dp');
      const pk = pl ? pl.kind : ps ? ps.kind : (dpFallback ? 'dp' : '');
      if(pl && pl.outs >= 3) post.push('r_tp');   // 삼중살
      else if(pk === 'dp' || pk === 'ldp') post.push(pick1('r_dp', 'r_dp2'));
      else if(pk === 'err') post.push(pl && pl.err === 'throw' ? 'r_error2' : 'r_error1');
      else if(has('hr')){ const on = ps ? (ps.rm || []).filter(m => m.to === 3).length : 0;
        post.push(G.walkoff && CAST.idx && CAST.idx.r_walkoff_hr ? 'r_walkoff_hr' : on >= 3 ? 'r_hr_grand' : pick1('r_hr1', 'r_hr2', 'r_hr3', 'r_hr4', 'r_hr5', 'r_hr6'));
        if(on === 1 || on === 2) post.push(CAST.idx && CAST.idx[on === 1 ? 'r_hr_two' : 'r_hr_three'] ? (on === 1 ? 'r_hr_two' : 'r_hr_three') : null);
        if(on >= 3 || G.walkoff || isE(evs, 'score', 'lc', true)) post.push(pick1('r_wow1', 'r_wow2', 'r_wow3')); }
      else if(has('b3')) post.push(pick1('r_triple', 'r_triple2'));
      else if(has('b2')) post.push(pick1('r_double', 'r_double2'));
      else if(has('hit')) post.push(dive && !caught ? 'r_sigh2' : null, pick1('r_hit1', 'r_hit2', 'r_hit3', 'r_hit4', 'r_hit5', 'r_hit6'));
      else if(has('out')){
        // 누가 잡았는지(녹음 pos_<포지션>_c)와 어디로 던지는지(thr_<베이스>): 녹음이 있을 때만 말함
        if(pl && pl.pos && CAST.idx && CAST.idx[`pos_${pl.pos}_c`]) post.push(`pos_${pl.pos}_c`);
        if(pl && pl.kind === 'go' && pl.tgt != null && CAST.idx && CAST.idx[`thr_${pl.tgt}`]) post.push(`thr_${pl.tgt}`);
        if(bb.type === 'gb') post.push(pick1('r_groundout1', 'r_groundout2', 'r_groundout3'));
        else if(caught && (caught.dive || caught.far)) post.push(pick1('r_supercatch1', 'r_supercatch2', 'r_supercatch3'));
        else post.push(Math.random() < 0.25 ? 'r_out_sad' : pick1('r_catch1', 'r_catch2', 'r_catch3', 'r_catch4'));
      }
      else if(has('safe')) post.push(pick1('r_safe1', 'r_safe2', 'r_safe3'));
      if(isHit && hitT != null){
        resAt = tl.contact + hitT; hitAt = resAt; at(resAt, post);
        // 그 뒤 베이스 승부: 홈에서 세이프면 득점, 아웃이면 "아웃! 잡아냅니다", 그 밖의 세이프는 "세이프!"
        (ps.call || []).filter(c => c.base != null && !c.catch && c.t > hitT + 0.2 && !(c.base === 0 && !c.out)).sort((a, b) => a.t - b.t)
          .forEach(c => at(tl.contact + c.t, c.out ? 'r_steal_out' : c.base === 3 ? pick1('r_score1', 'r_score2', 'r_score3', 'r_score4') : pick1('r_safe1', 'r_safe3')));
        CAST.scoreSaid = (ps.call || []).some(c => c.base === 3 && !c.out && c.t > hitT + 0.2);
      } else { resAt = tl.result; at(resAt, post); }
    } else {
      // 공이 미트에 들어가는(또는 방망이가 헛도는) 순간 판정, 이어서 볼카운트
      resAt = tl.contact;
      const call = [];
      if(has('batF') || has('foul')){ resAt = tl.contact + 0.35; call.push(has('out') ? 'r_catch1' : pick1('r_foul1', 'r_foul2', 'r_foul3', 'r_foul4', 'r_foul5')); }
      else if(has('k')) call.push(A.res === 'whiff' ? pick1('r_k_swing', 'r_k_swing2') : 'r_k_look');
      else if(whiffed) call.push(pick1('r_whiff1', 'r_whiff2', 'r_whiff3', 'r_whiff4'));
      else if(A.res === 'hbp') call.push('r_hbp');
      else if(has('ball')) call.push(pick1('r_walk', 'r_walk2'));
      else if(has('strike')) call.push(pick1('r_strike1', 'r_strike2', 'r_strike3', 'r_strike4'));
      else if(has('ballc')) call.push(pick1('r_ball1', 'r_ball2', 'r_ball3', 'r_ball4', 'r_ball5'));
      const endPA = has('batter') || has('change') || G.over || has('k') || has('ball');
      // 몰린 카운트: 투 스트라이크(타자)·쓰리 볼(투수)이 되는 공에서 가끔 한마디
      if(!endPA && has('strike') && G.strikes === 2 && Math.random() < 0.35) call.push('c_twostrike');
      if(!endPA && has('ballc') && G.balls === 3 && Math.random() < 0.35) call.push('c_threeball');
      if(!endPA && (G.balls || G.strikes) && SET.castCount === 'always') call.push(G.balls === 3 && G.strikes === 2 ? 'full' : [`cnt_b${G.balls}`, `cnt_s${G.strikes}`]);
      at(resAt, call);
    }
  }
  // 도루·견제·판독 (공이 미트에 들어간 뒤)
  // 이번 결과의 사건에 들어 있는 플레이만: 이 공을 던진 뒤에 일어났으면 공이 미트에 들어간 뒤, 던지기 전(견제)이나 공 없이(판독 결과)면 맨 앞
  const kinds = evAll.map(e => e.k), pIdx = Math.max(kinds.lastIndexOf('steal'), kinds.lastIndexOf('pick'), kinds.lastIndexOf('review'), kinds.lastIndexOf('reviewEnd'), kinds.lastIndexOf('wp'));
  const P = pIdx >= 0 ? evAll[pIdx] : null;
  if(P){
    const t = tl && pIdx > kinds.lastIndexOf('pitch') ? tl.contact + 0.2 : 0;
    if(P.k === 'steal') at(t, 'r_steal_go', P.safe ? pick1('r_steal_safe', 'r_steal_safe2') : 'r_steal_out', P.safe ? ana(0.4, 'a_run1', 'a_run2') : null);
    else if(P.k === 'pick') at(t, 'r_pickoff', P.safe ? 'r_safe1' : 'r_steal_out');
    else if(P.k === 'review') at(t, 'r_review', ana(0.5, 'a_review1', 'a_watch'));
    else if(P.k === 'reviewEnd') at(t, P.flip ? 'r_overturn' : 'r_stand');
    else if(P.k === 'wp') at(t, 'r_sigh1');
  }
  // 해설: 결과에 맞장구·한마디 (설정 '해설'에 따라 가끔)
  if(pitched){
    const ps = A.bb && A.bb.ps, ev = (ps && ps.ev) || [], caught = ev.find(e => e.k === 'catch');
    const sc = G.teams.map(runsOf), prev = CAST.score || sc, bi = batIdx(G), diff = d => d[bi] - d[1 - bi];
    let line = null;
    // (가끔 기준) 타석이 끝나는 결과는 대부분, 공 하나하나에도 서너 공에 한 번쯤 한마디
    if(has('hr')) line = ana(0.95, 'a_hr1', 'a_hr2', 'a_hr3', 'a_wow');
    else if(caught && (caught.dive || caught.far)) line = ana(0.95, 'a_def1', 'a_def2', 'a_def3', 'a_wow', 'a_oh');
    else if(has('b2') || has('b3')) line = ana(0.85, 'a_hit1', 'a_hit2', 'a_hit3', 'a_run1');
    else if(has('hit')) line = ana(0.7, 'a_hit1', 'a_hit2', 'a_hit3', 'a_yes2', 'a_yes3', 'a_yes4');
    else if(pl && (pl.kind === 'dp' || pl.kind === 'ldp')) line = ana(0.9, 'a_dp1', 'a_dp2');
    else if(pl && pl.kind === 'err') line = ana(0.9, 'a_error1', 'a_error2', 'a_ah');
    else if(has('k')) line = ana(0.65, 'a_k1', 'a_k2', 'a_k3', A.res === 'whiff' ? 'a_whiff1' : 'a_pitch_good');
    else if(has('ball')) line = ana(0.7, 'a_walk1', 'a_walk2', 'a_ball2', 'a_ball1');
    else if(has('out') && A.res === 'inplay') line = ana(0.55, 'a_out1', 'a_out2', 'a_out3', A.bb && A.bb.type === 'gb' ? 'a_gb1' : 'a_fly1', 'a_dp2');
    else if((has('batF') || has('foul')) && G.strikes === 2) line = ana(0.4, 'a_foul1', 'a_foul2');
    else if(has('ballc') && G.balls === 3 && G.strikes === 2) line = ana(0.8, 'a_full1', 'a_full2');
    else if(has('ballc') && G.balls >= 2) line = ana(0.35, 'a_ball1', 'a_ball2');
    else if(has('ballc')) line = ana(0.2, 'a_ball1', 'a_ball2', 'a_watch');
    else if(has('strike') || whiffed) line = ana(0.25, 'a_pitch_good', 'a_k3', whiffed ? 'a_whiff1' : 'a_k2', 'a_yes3');
    else if(has('batF') || has('foul')) line = ana(0.15, 'a_foul2', 'a_watch');
    // 투수가 많이 던졌으면 가끔 체력 이야기
    if(!line && curPitcher(G).n >= 80) line = ana(0.12, 'a_tired1', 'a_tired2');
    // 점수 흐름: 역전·동점이 먼저
    if(has('score')){
      if(diff(prev) < 0 && diff(sc) > 0) line = ana(0.9, 'a_comeback1', 'a_flow1') || line;
      else if(diff(sc) === 0 && diff(prev) < 0) line = ana(0.8, 'a_tie1') || line;
      else if(!line) line = ana(0.4, 'a_score1', 'a_score2', 'a_score3');
    }
    if(typeof line === 'string') at(resAt + 0.01, line);
    CAST.score = sc;
  }
  // 득점
  if(has('score') && !has('hr') && !CAST.scoreSaid) at(resAt, pick1('r_score1', 'r_score2'));
  CAST.scoreSaid = false;
  // 끝·공수 교대·새 타자 안내 (앞 중계가 끝난 뒤). 육성처럼 바로 건너뛸 때는 빼고, 건너뛴 뒤 지금 상황을 따로 말함(castSkip)
  const after = [];
  if(!opt.noAfter){
  if(G.over){
    after.push(G.walkoff ? pick1('r_walkoff', 'r_walkoff2') : 'end', 'j_score', teamClip(G.teams[0]), numClip(runsOf(G.teams[0])), 'j_vs', numClip(runsOf(G.teams[1])), teamClip(G.teams[1]));
    const w = runsOf(G.teams[0]) === runsOf(G.teams[1]) ? -1 : runsOf(G.teams[0]) > runsOf(G.teams[1]) ? 0 : 1;
    if(w >= 0 && CAST.idx && CAST.idx.c_winner) after.push('c_winner', teamClip(G.teams[w], true));
    after.push(ana(1, 'a_bye', 'a_end1'), CAST.idx && CAST.idx.c_thanks ? 'c_thanks' : null);
  }
  else {
    if(hasAll('change')){
      // 이닝이 어떻게 끝났는지(inningLog)를 보고 말함: 삼자범퇴·위기 넘김·실점·병살·잔루 만루·삼진
      const half = evAll.filter(e => e.k === 'inning').pop(), tied = runsOf(G.teams[0]) === runsOf(G.teams[1]), lead = runsOf(G.teams[0]) > runsOf(G.teams[1]) ? 0 : 1, gap = Math.abs(runsOf(G.teams[0]) - runsOf(G.teams[1]));
      after.push(inningTalk(half), 'change', `inn_${Math.min(12, G.inning)}${G.top ? 't' : 'b'}`, teamClip(batTeam(G)), 'j_attack',
        'j_score', teamClip(G.teams[0]), numClip(runsOf(G.teams[0])), 'j_vs', numClip(runsOf(G.teams[1])), teamClip(G.teams[1]));
      // 지금 누가 앞서는지, 후반·마지막 이닝, 점수 차에 따른 한마디 (녹음이 없는 줄은 건너뜀)
      if(tied) after.push(Math.random() < 0.6 ? 'j_tie' : null, G.inning >= 5 ? ana(0.3, 'c_even') : null);
      else if(Math.random() < 0.5) after.push(teamClip(G.teams[lead]), 'j_lead');
      if(G.top && G.inning === G.innings - 2 && G.innings >= 5) after.push('c_late');
      if(G.top && G.inning >= G.innings) after.push('c_last');
      if(gap >= 5 && G.inning >= 4) after.push(ana(0.5, 'a_big1'));
      else if(gap >= 1 && gap <= 3 && G.inning >= G.innings - 2 && Math.random() < 0.3) after.push(ana(0.6, 'a_behind1'));
    }
    if(hasAll('pchange')) after.push('r_pitcher_change', ana(0.5, 'a_change1'));
    if((hasAll('batter') && !hasAll('start')) || hasAll('change')){
      after.push(`bat_${batTeam(G).bi + 1}`);
      if(G.bases.some(x => x != null)) after.push(runClip(G.bases));
      if(G.outs) after.push(`out_${G.outs}`);
      // 득점권이면 캐스터가 짚고 해설이 받음, 만루·후반 접전은 해설 한마디
      if(G.bases[1] != null || G.bases[2] != null){
        if(G.bases.every(x => x != null)) after.push(Math.random() < 0.5 ? 'c_loaded' : null, ana(0.4, 'a_loaded1', 'a_pinch1'));
        else if(G.outs < 2 && G.bases[1] != null && G.bases[2] != null && Math.random() < 0.4) after.push('c_pinch');
        else if(G.inning >= 7 && Math.abs(runsOf(G.teams[0]) - runsOf(G.teams[1])) <= 1 && Math.random() < 0.3) after.push('c_crucial');
        else if(Math.random() < 0.3 * anaRate() && CAST.idx && CAST.idx.c_scoring) after.push('c_scoring', pick1('a_chance1', 'a_chance2', 'a_yes1', 'a_yes3'));
      }
      else if(G.inning >= 7 && Math.abs(runsOf(G.teams[0]) - runsOf(G.teams[1])) <= 1) after.push(ana(0.4, 'a_close1', 'a_late1'));
      else if(G.outs === 2) after.push(ana(0.25, 'a_twoout1', 'a_careful'));
      else if(G.bases[0] != null) after.push(ana(0.25, 'a_steal1', 'a_careful'));
    }
  }
  }
  // 시각 순서대로 이어서 틂 (앞 조각이 안 끝났으면 끝난 뒤에). 안내(after)는 언제나 맨 끝: 도루·득점 중계가 공수 교대 안내 뒤로 밀리지 않게
  plan.sort((a, b) => a[0] - b[0]);
  // 새로 말할 것이 없으면(온라인에서 차례만 바뀐 상태 따위) 하던 중계를 끊지 않음
  if(!plan.length && !after.length) return null;
  castStop();
  if(after.length) plan.push([plan.length ? plan[plan.length - 1][0] : resAt, after.flat(3).filter(Boolean)]);
  let end = 0;
  plan.forEach(([t, ids]) => { end = castPlay(ids, t); });
  return { at: resAt, end, hit: hitAt };
}

// 지금 상황 조각: 이닝 · 점수 · 아웃 · 주자 · 타자 (볼카운트 포함 여부는 count)
function situationClips(count){
  const out = [`inn_${Math.min(12, G.inning)}${G.top ? 't' : 'b'}`, teamClip(batTeam(G)), 'j_attack',
    'j_score', teamClip(G.teams[0]), numClip(runsOf(G.teams[0])), 'j_vs', numClip(runsOf(G.teams[1])), teamClip(G.teams[1]),
    `out_${G.outs}`, runClip(G.bases), `bat_${batTeam(G).bi + 1}`];
  if(count && (G.balls || G.strikes)) out.push(G.balls === 3 && G.strikes === 2 ? 'full' : [`cnt_b${G.balls}`, `cnt_s${G.strikes}`]);
  return out.flat();
}
// 육성에서 내 차례까지 건너뛴 뒤: 앞 중계에 이어서 지금 상황(경기가 끝났으면 끝과 점수). 다 끝나는 시각(초)을 돌려줌
function castSkip(){
  if(!castOn() || !G) return 0;
  castLoadIndex();
  const ids = G.over ? [G.walkoff ? 'r_walkoff' : 'end', 'j_score', teamClip(G.teams[0]), numClip(runsOf(G.teams[0])), 'j_vs', numClip(runsOf(G.teams[1])), teamClip(G.teams[1])] : situationClips(true);
  castSeen();
  return castPlay(ids, 0.3);
}
// 고르는 데 오래 걸리면(6초) 볼카운트·아웃·주자를 한 번 말함. 고르면(다음 결과) castResult가 멈춤
function castIdleArm(){
  clearTimeout(CAST.idleT);
  if(!castOn() || (SET.castCount || 'idle') !== 'idle' || typeof G === 'undefined' || !G || G.over) return;
  const key = `${G.at}:${G.pitchNo}:${G.balls}:${G.strikes}:${G.outs}`;
  CAST.idleT = setTimeout(() => {
    if(!G || G.over || key !== `${G.at}:${G.pitchNo}:${G.balls}:${G.strikes}:${G.outs}` || CAST.idleKey === key) return;
    CAST.idleKey = key;
    const ids = [G.bases.some(x => x != null) ? 'p_set3' : pick1('p_set1', 'p_set2')];   // 오래 고르는 동안 투구 전 뜸
    if(G.balls || G.strikes) ids.push(G.balls === 3 && G.strikes === 2 ? 'full' : [`cnt_b${G.balls}`, `cnt_s${G.strikes}`]);
    ids.push(`out_${G.outs}`, runClip(G.bases));
    castPlay(ids.flat(), 0);
  }, 6000);
}
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => clearTimeout(CAST.idleT), { capture:true }));
