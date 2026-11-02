'use strict';
/* ===================== 중계 음성 (녹음한 캐스터 목소리 조각 이어 붙이기) =====================
   읽어 주기가 '중계 음성'이면 경기 결과는 화면 낭독기 대신 캐스터 목소리로 중계함.
   voice/index.json의 variants에 같은 문장의 녹음이 여러 개면(이름-2) 번갈아 골라 매번 조금씩 다르게 들림.
   공을 친 결과는 뜸 들이는 중계 시간표에 맞춰: '쳤습니다! 높이 뜹니다! 오른쪽으로!' → (타구가 떨어질 때) '잡았습니다! 아웃!' */
const CAST = { idx:null, buf:{}, loading:{}, until:0, last:{}, src:[] };
// 중계 음성: 설정의 '중계 음성'이 켜져 있고 효과음이 켜져 있을 때 (두 모드 모두 기본 켬)
function castOn(){ return SET.cast !== false && SET.snd !== false; }
// 설정을 켤 때 들려 주는 예시
function castSample(){ castLoadIndex().then(() => { ['intro', 'playball'].forEach(castFile); Promise.all(['intro', 'playball'].map(castLoad)).then(() => { castStop(); castPlay(['intro', 'playball'], 0.1); }); }); }
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
function castDur(id){ const b = CAST.buf[id]; return b ? b.duration + 0.08 : 0.7; }
function castStop(){ CAST.src.splice(0).forEach(s => { try{ s.stop(); }catch(e){} }); CAST.until = 0; }
const pick1 = (...ids) => ids[Math.floor(Math.random() * ids.length)];
const numClip = n => n >= 0 && n <= 20 ? `num_${n}` : null;   // 녹음: 영~이십
const runClip = b => { const k = [0, 1, 2].filter(i => b[i] != null).map(i => i + 1).join(''); return ({ '':'run_none', 1:'run_1', 2:'run_2', 3:'run_3', 12:'run_12', 13:'run_13', 23:'run_23', 123:'run_full' })[k]; };
const teamClip = (T, long) => `team_${T.key}${long ? '' : '_s'}`;

/* 경기 결과 하나(res)를 중계로: gameNext가 부름.
   공 하나의 시간표(timeline.js)대로: 투구 동작 중 "던졌습니다" → 공이 미트에 들어가는 순간 "스트라이크!/볼." → 볼카운트
   / 친 공은 맞는 순간부터 "쳤습니다! 높이 뜹니다!" → 잡히거나 떨어지는 순간 결과 → 득점 → 새 타자·주자·아웃 안내.
   조각은 겹치지 않게 이어서 틂. 다음 선택은 중계가 끝날 때까지 기다림(game.js). 돌려주는 값: { at 결과를 말하는 시각, end 다 끝나는 시각 } (초) */
function castResult(res){
  if(!castOn() || !res || typeof G === 'undefined' || !G) return null;
  castLoadIndex();
  castStop();
  const fx = res.fx || [], text = (res.lines || []).map(l => l.s || l).join(' '), has = n => fx.includes(n), A = G.anim;
  const plan = [];   // [시각(초), [조각…]] 시각 순서대로
  const at = (t, ...ids) => { ids = ids.flat(3).filter(Boolean); if(ids.length) plan.push([t, ids]); };
  if(has('start')) at(0, 'intro', teamClip(G.teams[0], true), teamClip(G.teams[1], true), 'playball');
  const fresh = A && A.n !== CAST.animN; if(A) CAST.animN = A.n;
  const contact = fx.some(n => /^bat/.test(n)), pitched = fresh && (has('pitch') || contact);
  const tl = pitched ? playTL(A, fx) : null;
  let resAt = 0;
  if(pitched){
    // 던질 때: 구종 이름이나 "던졌습니다!" (공을 놓는 순간 끝나게)
    const thr = G.mode !== 'simple' && A.t && Math.random() < 0.45 ? `pt_${A.t}` : pick1('p_throw1', 'p_throw2', 'p_throw3');
    at(Math.max(0, tl.contact - 0.05 - castDur(thr)), thr);   // 공이 도착하기 전에 끝나게
    const ps = A.bb && A.bb.ps;
    if(A.res === 'inplay' && A.bb){
      const bb = A.bb, fence = (G.park && G.park.fence && G.park.fence[bb.fi]) || 110, ev = (ps && ps.ev) || [];
      const dive = ev.find(e => e.k === 'dive'), caught = ev.find(e => e.k === 'catch');
      const fly = [ps && ps.bunt ? 'r_bunt' : fx.includes('batBig') ? pick1('c_hit1', 'c_hit2') : pick1('c_hit3', 'c_soft1', 'c_soft2')];
      if(!(ps && ps.bunt)){
        fly.push(bb.type === 'gb' ? pick1('c_ground1', 'c_ground2') : bb.type === 'ld' ? 'c_liner' : pick1('c_high1', 'c_high2'));
        fly.push(['c_left', 'c_center', 'c_right'][bb.fi ?? 1]);
        if(bb.type === 'fb' && (bb.d || 0) >= fence - 18) fly.push(pick1('c_far1', 'c_far2', 'c_far3'), 'c_back');
        else if(bb.type !== 'gb') fly.push('c_chase');
        if(dive) fly.push('c_dive');
      }
      // 결과 전까지 들어가는 만큼만 (첫 마디는 꼭)
      const room = tl.result - tl.contact - 0.1, fit = [];
      let used = 0;
      fly.forEach((id, i) => { const d = castDur(id); if(i === 0 || used + d <= room){ fit.push(id); used += d; } });
      at(tl.contact, fit);
      const post = [];
      if(/트리플 플레이/.test(text)) post.push('r_tp');
      else if(/병살/.test(text)) post.push('r_dp');
      else if(/실책/.test(text)) post.push(/송구/.test(text) ? 'r_error2' : 'r_error1');
      else if(has('hr')) post.push(/만루 홈런|그랜드/.test(text) || (text.match(/홈인/g) || []).length >= 3 ? 'r_hr_grand' : pick1('r_hr1', 'r_hr2', 'r_hr3'));
      else if(has('b3')) post.push('r_triple');
      else if(has('b2')) post.push('r_double');
      else if(has('hit')) post.push(dive && !caught ? 'r_sigh2' : null, pick1('r_hit1', 'r_hit2', 'r_hit3'));
      else if(has('out')){
        if(bb.type === 'gb') post.push(pick1('r_groundout1', 'r_groundout2'));
        else if(caught && (caught.dive || caught.far)) post.push(pick1('r_supercatch1', 'r_supercatch2'));
        else post.push(Math.random() < 0.25 ? 'r_out_sad' : pick1('r_catch1', 'r_catch2', 'r_catch3'));
      }
      else if(has('safe')) post.push(pick1('r_safe1', 'r_safe2'));
      if(ps && (has('hit') || has('b2') || has('b3')) && (ps.rm || []).some(m => m.to == null)) post.push('r_steal_out');
      resAt = tl.result; at(resAt, post);
    } else {
      // 공이 미트에 들어가는(또는 방망이가 헛도는) 순간 판정, 이어서 볼카운트
      resAt = tl.contact;
      const call = [];
      if(has('batF') || has('foul')){ resAt = tl.contact + 0.35; call.push(has('out') ? 'r_catch1' : pick1('r_foul1', 'r_foul2', 'r_foul3')); }
      else if(has('k')) call.push(A.res === 'whiff' ? 'r_k_swing' : 'r_k_look');
      else if(fx.some(n => /^whiff/.test(n))) call.push(pick1('r_whiff1', 'r_whiff2'));
      else if(A.res === 'hbp') call.push('r_hbp');
      else if(has('ball')) call.push('r_walk');
      else if(has('strike')) call.push(pick1('r_strike1', 'r_strike2'));
      else if(has('ballc')) call.push(pick1('r_ball1', 'r_ball2'));
      const endPA = has('batter') || has('change') || G.over || has('k') || has('ball');
      if(!endPA && (G.balls || G.strikes)) call.push(G.balls === 3 && G.strikes === 2 ? 'full' : [`cnt_b${G.balls}`, `cnt_s${G.strikes}`]);
      at(resAt, call);
    }
  }
  // 도루·견제·판독 (공이 미트에 들어간 뒤)
  const P = G.play;
  if(P && P.n !== CAST.playN){
    CAST.playN = P.n;
    const t = tl ? tl.contact + 0.2 : 0;
    if(P.k === 'steal') at(t, 'r_steal_go', P.safe ? 'r_steal_safe' : 'r_steal_out');
    else if(P.k === 'pick') at(t, 'r_pickoff', P.safe ? 'r_safe1' : 'r_steal_out');
    else if(P.k === 'review') at(t, 'r_review');
    else if(P.k === 'reviewEnd') at(t, P.flip ? 'r_overturn' : 'r_stand');
    else if(P.k === 'wp') at(t, 'r_sigh1');
  }
  // 득점
  if(/홈인|들어옵니다/.test(text) && !has('hr')) at(resAt, pick1('r_score1', 'r_score2'));
  // 끝·공수 교대·새 타자 안내 (앞 중계가 끝난 뒤)
  const after = [];
  if(G.over){ after.push(G.walkoff ? 'r_walkoff' : 'end', 'j_score', teamClip(G.teams[0]), numClip(runsOf(G.teams[0])), teamClip(G.teams[1]), numClip(runsOf(G.teams[1]))); }
  else {
    if(has('change')) after.push('change', `inn_${Math.min(12, G.inning)}${G.top ? 't' : 'b'}`, teamClip(batTeam(G)), 'j_attack',
      'j_score', teamClip(G.teams[0]), numClip(runsOf(G.teams[0])), teamClip(G.teams[1]), numClip(runsOf(G.teams[1])));
    if(has('pchange')) after.push('r_pitcher_change');
    if((has('batter') && !has('start')) || has('change')){
      if(!has('change')) after.push(teamClip(batTeam(G)));
      after.push(`bat_${batTeam(G).bi + 1}`);
      if(G.bases.some(x => x != null)) after.push(runClip(G.bases));
      if(G.outs) after.push(`out_${G.outs}`);
    }
  }
  at(resAt, after);
  // 시각 순서대로 이어서 틂 (앞 조각이 안 끝났으면 끝난 뒤에)
  let end = 0;
  plan.sort((a, b) => a[0] - b[0]).forEach(([t, ids]) => { end = castPlay(ids, t); });
  return { at: resAt, end };
}
