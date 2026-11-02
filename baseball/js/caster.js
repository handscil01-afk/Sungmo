'use strict';
/* ===================== 중계 음성 (녹음한 캐스터 목소리 조각 이어 붙이기) =====================
   읽어 주기가 '중계 음성'이면 경기 결과는 화면 낭독기 대신 캐스터 목소리로 중계함.
   voice/index.json의 variants에 같은 문장의 녹음이 여러 개면(이름-2) 번갈아 골라 매번 조금씩 다르게 들림.
   공을 친 결과는 뜸 들이는 중계 시간표에 맞춰: '쳤습니다! 높이 뜹니다! 오른쪽으로!' → (타구가 떨어질 때) '잡았습니다! 아웃!' */
const CAST = { idx:null, buf:{}, loading:{}, until:0, last:{}, src:[] };
function castOn(){ return SET.voice === 'cast'; }
function castLoadIndex(){
  if(CAST.idx || CAST.idxP) return CAST.idxP;
  CAST.idxP = fetch(new URL('voice/index.json', document.baseURI).href).then(r => r.json()).then(j => { CAST.idx = j.variants || {}; }).catch(() => { CAST.idx = {}; });
  return CAST.idxP;
}
function castFile(id){
  const n = CAST.idx && CAST.idx[id]; if(!n) return null;
  // 지난번과 다른 녹음을 고름
  let k = 1 + Math.floor(Math.random() * n);
  if(n > 1 && CAST.last[id] === k) k = k % n + 1;
  CAST.last[id] = k;
  return k === 1 ? id : `${id}-${k}`;
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
  castLoadIndex().then(() => Object.entries(CAST.idx || {}).forEach(([id, n]) => { for(let k = 1; k <= n; k++) castLoad(k === 1 ? id : `${id}-${k}`); }));
}
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if(castOn()) castPreload(); }, { capture:true, once:true }));
// 조각들을 at초 뒤부터 이어서 틂 (앞 중계가 아직 나오는 중이면 끝난 뒤에). 끝나는 시각을 돌려줌
function castPlay(ids, at = 0){
  const c = audio(); if(!c || !castOn()) return 0;
  let t = Math.max(c.currentTime + at, CAST.until);
  ids.filter(Boolean).forEach(id => {
    const name = castFile(id); if(!name) return;
    const b = CAST.buf[name]; if(!b){ castLoad(name); return; }
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = b; g.gain.value = 1; s.connect(g); g.connect(c.destination); s.start(t);
    CAST.src.push(s); s.onended = () => { const i = CAST.src.indexOf(s); if(i >= 0) CAST.src.splice(i, 1); };
    t += b.duration + 0.08;
  });
  CAST.until = t;
  return t - c.currentTime;
}
// 지난 중계가 아직 남아 있으면 끊고 지금 장면부터 (빠르게 진행해도 중계가 밀리지 않게)
function castStop(){ CAST.src.splice(0).forEach(s => { try{ s.stop(); }catch(e){} }); CAST.until = 0; }
const pick1 = (...ids) => ids[Math.floor(Math.random() * ids.length)];
const numClip = n => n >= 0 && n <= 20 ? `num_${n}` : null;
const runClip = b => { const k = [0, 1, 2].filter(i => b[i] != null).map(i => i + 1).join(''); return ({ '':'run_none', 1:'run_1', 2:'run_2', 3:'run_3', 12:'run_12', 13:'run_13', 23:'run_23', 123:'run_full' })[k]; };
const teamClip = (T, long) => `team_${T.key}${long ? '' : '_s'}`;

/* 경기 결과 하나(res)를 중계로: gameNext가 부름. susp는 결과까지 기다리는 시간(ms) */
function castResult(res, susp){
  if(!castOn() || !res || typeof G === 'undefined' || !G) return;
  castLoadIndex();
  castStop();
  const fx = res.fx || [], text = (res.lines || []).map(l => l.s || l).join(' '), has = n => fx.includes(n), A = G.anim;
  const pre = [], post = [], after = [];
  // 경기 시작
  if(has('start')){ pre.push('intro', teamClip(G.teams[0], true), 'j_vs', teamClip(G.teams[1], true), 'playball'); }
  // 도루·견제·판독
  const P = G.play;
  if(P && P.n !== CAST.playN){
    CAST.playN = P.n;
    if(P.k === 'steal') pre.push('r_steal_go', P.safe ? 'r_steal_safe' : 'r_steal_out');
    else if(P.k === 'pick') pre.push('r_pickoff', P.safe ? 'r_safe1' : 'r_steal_out');
    else if(P.k === 'review') pre.push('r_review');
    else if(P.k === 'reviewEnd') pre.push(P.flip ? 'r_overturn' : 'r_stand');
  }
  // 공 하나
  const fresh = A && A.n !== CAST.animN; if(A) CAST.animN = A.n;
  const contact = fx.some(n => /^bat/.test(n));
  if(fresh && (has('pitch') || contact)){
    // 친 공은 앞 중계를 짧게 (던짐·구종 가운데 하나만)
    if(contact){ if(Math.random() < 0.5) pre.push(G.mode !== 'simple' && A.t ? `pt_${A.t}` : pick1('p_throw1', 'p_throw2', 'p_throw3')); }
    else { if(Math.random() < 0.5) pre.push(pick1('p_throw1', 'p_throw2', 'p_throw3')); if(G.mode !== 'simple' && A.t && Math.random() < 0.5) pre.push(`pt_${A.t}`); }
    if(A.res === 'inplay' && A.bb){
      const bb = A.bb, fence = (G.park && G.park.fence && G.park.fence[bb.fi]) || 110;
      pre.push(fx.includes('batBig') ? pick1('c_hit1', 'c_hit2', 'c_hit3') : pick1('c_hit1', 'c_hit3', 'c_soft1', 'c_soft2'));
      pre.push(bb.type === 'gb' ? pick1('c_ground1', 'c_ground2') : bb.type === 'ld' ? 'c_liner' : pick1('c_high1', 'c_high2'));
      pre.push(['c_left', 'c_center', 'c_right'][bb.fi ?? 1]);
      if(bb.type === 'fb' && (bb.d || 0) >= fence - 18) pre.push(pick1('c_far1', 'c_far2', 'c_far3'), 'c_back');
      else if(bb.type !== 'gb' && Math.random() < 0.4) pre.push('c_chase');
      // 결과
      if(/트리플 플레이/.test(text)) post.push('r_tp');
      else if(/병살/.test(text)) post.push('r_dp');
      else if(/실책/.test(text)) post.push(/송구/.test(text) ? 'r_error2' : 'r_error1');
      else if(has('hr')) post.push(/만루 홈런|그랜드/.test(text) || (text.match(/홈인/g) || []).length >= 3 ? 'r_hr_grand' : pick1('r_hr1', 'r_hr2', 'r_hr3'));
      else if(has('b3')) post.push('r_triple');
      else if(has('b2')) post.push('r_double');
      else if(has('hit')) post.push(pick1('r_hit1', 'r_hit2', 'r_hit3'));
      else if(has('out')){
        if(bb.type === 'gb') post.push(pick1('r_groundout1', 'r_groundout2'));
        else if((bb.d || 0) >= fence - 12) post.push(pick1('r_supercatch1', 'r_supercatch2'));
        else post.push(Math.random() < 0.25 ? 'r_out_sad' : pick1('r_catch1', 'r_catch2', 'r_catch3'));
      }
      else if(has('safe')) post.push(pick1('r_safe1', 'r_safe2'));
    }
    else if(A.res === 'bunt') pre.push('r_bunt');
    else if(has('batF') || has('foul')){ pre.push(pick1('c_hit3', 'c_hit1', 'c_soft2')); post.push(pick1('r_foul1', 'r_foul2', 'r_foul3')); }
    else if(has('k')) pre.push(A.res === 'whiff' ? 'r_k_swing' : 'r_k_look');
    else if(fx.some(n => /^whiff/.test(n))) pre.push(pick1('r_whiff1', 'r_whiff2'));
    else if(A.res === 'hbp') pre.push('r_hbp');
    else if(has('ball')) pre.push('r_walk');
    else if(has('strike')) pre.push(pick1('r_strike1', 'r_strike2'));
    else if(has('ballc')) pre.push(pick1('r_ball1', 'r_ball2'));
  }
  // 득점·끝내기·공수 교대·새 타자
  if(/홈인/.test(text) && !has('hr')) post.push(pick1('r_score1', 'r_score2'));
  if(G.over){ after.push(G.walkoff ? 'r_walkoff' : 'end'); after.push('j_score', teamClip(G.teams[0]), numClip(runsOf(G.teams[0])), 'j_vs', numClip(runsOf(G.teams[1])), teamClip(G.teams[1])); }
  else {
    if(has('change')) after.push('change', `inn_${Math.min(12, G.inning)}${G.top ? 't' : 'b'}`, teamClip(batTeam(G)), 'j_attack',
      'j_score', teamClip(G.teams[0]), numClip(runsOf(G.teams[0])), 'j_vs', numClip(runsOf(G.teams[1])), teamClip(G.teams[1]));
    if(has('pchange')) after.push('r_pitcher_change');
    if(has('batter') || has('change')){
      after.push(teamClip(batTeam(G)), `bat_${batTeam(G).bi + 1}`);
      if(G.bases.some(x => x != null)) after.push(runClip(G.bases));
      if(G.outs) after.push(`out_${G.outs}`);
    }
    else if(G.balls === 3 && G.strikes === 2 && fresh) after.push('full');
  }
  const t1 = castPlay(pre, 0);
  // 결과는 타구가 떨어지는 순간에 (앞 중계가 길면 그 뒤에). 그 시각을 돌려줘서 글·효과음도 맞춤
  let at = 0;
  if(post.length){ at = Math.max(t1, (susp || 0) / 1000); castPlay(post, at); }
  if(after.length) castPlay(after, 0);
  return at;
}
