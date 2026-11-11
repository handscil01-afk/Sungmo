// 중계 음성 시험: 브라우저·소리 없이 castResult를 가짜 오디오로 돌려, 정해 둔 경기 장면 20개에서
// '어떤 조각을 어떤 순서로 말하는지'를 caster.snap.json과 견줌.
// 사용법: node baseball/tests/caster.js            (저장해 둔 스냅샷과 비교)
//         node baseball/tests/caster.js --update   (의도한 변화일 때 스냅샷을 새로 저장)
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'js');
const SNAP = path.join(__dirname, 'caster.snap.json');
const UPDATE = process.argv.includes('--update');

// ---- 브라우저가 없어도 caster.js가 돌아가게 하는 가짜 환경 ----
const IDX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'voice', 'index.json'), 'utf8')).variants;
const dur = name => 0.5 + ([...name].reduce((s, c) => s + c.charCodeAt(0), 0) % 12) / 10;   // 조각 길이: 이름으로 정한 고정값
const played = [];   // [시작 시각, 조각 이름]
const ctx = {
  currentTime: 0, state: 'running', resume(){ return Promise.resolve(); }, destination: {},
  createGain(){ return { gain:{ value:1 }, connect(){} }; },
  createBufferSource(){ const s = { buffer:null, connect(){}, start(t){ played.push([Math.round(t * 100) / 100, s.buffer.id]); }, stop(){}, onended:null }; return s; },
};
globalThis.document = { addEventListener(){}, baseURI:'http://localhost/baseball/' };
globalThis.SET = { cast:true, snd:true, analyst:'some', castCount:'idle' };
globalThis.audio = () => ctx;
// 난수를 고정 (장면마다 같은 값부터 시작)
let seed = 1;
const seedRandom = s => { seed = s >>> 0 || 1; };
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

['data.js', 'engine.js', 'playsim.js', 'timeline.js', 'ai.js', 'caster.js'].forEach(f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }));
CAST.idx = IDX; CAST.idxP = Promise.resolve();
Object.entries(IDX).forEach(([id, n]) => { for(let k = 1; k <= n; k++){ const name = k === 1 ? id : `${id}-${k}`; CAST.buf[name] = { duration: dur(name), id: name }; } });

// ---- 장면 고르기: 정해 둔 씨앗의 경기를 돌리며 장면 종류마다 먼저 나오는 것을 모음 ----
function label(G, res){
  const fx = res.fx || [], A = G.anim, ps = A && A.bb && A.bb.ps, P = G.play;
  if(fx.includes('start')) return '경기 시작';
  if(G.over) return G.walkoff ? '끝내기' : '경기 끝';
  if(fx.includes('hr')) return '홈런';
  if(ps && (ps.kind === 'dp' || ps.kind === 'ldp')) return '병살';
  if(ps && ps.kind === 'err') return '실책';
  if(fx.includes('b3')) return '3루타';
  if(fx.includes('b2')) return '2루타';
  if(fx.includes('hit')) return '안타';
  if(P && P.n !== label.pn && P.k === 'steal'){ return '도루'; }
  if(P && P.n !== label.pn && P.k === 'pick'){ return '견제'; }
  if(P && P.n !== label.pn && P.k === 'review'){ return '판독 신청'; }
  if(fx.includes('pchange')) return '투수 교체';
  if(fx.includes('k')) return A && A.res === 'whiff' ? '헛스윙 삼진' : '서서 삼진';
  if(fx.includes('ball') && !fx.includes('ballc')) return '볼넷·사구';
  if(fx.includes('change')) return '공수 교대';
  if(fx.includes('score')) return '득점';
  if(A && A.res === 'inplay' && fx.includes('out')) return A.bb.type === 'gb' ? '땅볼 아웃' : '뜬공 아웃';
  if(fx.includes('batF') || fx.includes('foul')) return '파울';
  if(fx.some(n => /^whiff/.test(n))) return '헛스윙';
  if(fx.includes('strike')) return '스트라이크';
  if(fx.includes('ballc')) return '볼';
  return null;
}
const scenes = [];   // { name, label, fn() }
const want = new Set(), seen = {};
for(let gs = 1; gs <= 14 && scenes.length < 20; gs++){
  const G = newGame({ mode:'detail', innings:3, teams:['star', 'thunder'].map((k, i) => (TEAMS[(gs + i * 3) % TEAMS.length]).key), ctrl:['cpu', 'cpu'], seed: 500 + gs });
  globalThis.G = G;
  let res = flush(G), guard = 0, step = 0;
  const take = r => {
    const lb = label(G, r); if(G.play) label.pn = G.play.n;
    if(lb && !seen[lb] && scenes.length < 20){ seen[lb] = 1; scenes.push({ label: lb, game: gs, step }); }
  };
  take(res);
  while(!G.over && guard++ < 3000){
    step++;
    res = G.review ? resolveReview(G, aiChallenge(G)) : playStep(G, aiDefChoice(G), aiOffChoice(G));
    take(res);
  }
}

// ---- 고른 장면을 다시 돌려, 그 장면의 중계 조각을 기록 ----
function record(sc, i){
  const G = newGame({ mode:'detail', innings:3, teams:['star', 'thunder'].map((k, j) => (TEAMS[(sc.game + j * 3) % TEAMS.length]).key), ctrl:['cpu', 'cpu'], seed: 500 + sc.game });
  globalThis.G = G; label.pn = 0;
  CAST.until = 0; CAST.last = {}; CAST.score = null; CAST.animN = undefined; CAST.playN = undefined;
  let res = flush(G), guard = 0;
  for(let st = 0; ; st++){
    const isScene = st === sc.step;
    if(isScene){ played.length = 0; seedRandom(1000 + i); }
    // 장면 전까지의 중계도 같은 순서로 불러 상태(앞 점수, 본 플레이)를 맞춤
    const out = castResult(res);
    if(isScene) return { label: sc.label, game: sc.game, step: sc.step, ret: out && { at: Math.round(out.at * 100) / 100, end: Math.round(out.end * 100) / 100 }, clips: played.map(p => p.join(' ')) };
    played.length = 0;
    if(G.over || guard++ > 3000) throw new Error('장면을 찾지 못함 ' + sc.label);
    res = G.review ? resolveReview(G, aiChallenge(G)) : playStep(G, aiDefChoice(G), aiOffChoice(G));
  }
}
const snap = scenes.map(record);

// ---- 이닝 끝 해설이 이닝 상황과 맞는지 (새 녹음 아이디까지 있는 것처럼 꾸며서) ----
const POSN = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'], isE2 = (r, k) => (r.events || []).some(e => e.k === k);
const NEWIDS = ['a_inn_big', 'a_inn_run1', 'a_inn_runs', 'a_inn_k', 'a_inn_dp', 'a_inn_lob', 'a_inn_escape'];
const innErrs = [], seenCat = {};
{
  const real = CAST.idx; CAST.idx = { ...real }; NEWIDS.forEach(id => { CAST.idx[id] = 1; CAST.buf[id] = { duration: dur(id), id }; });
  globalThis.SET.analyst = 'often';
  for(let gs = 100; gs < 130; gs++){
    const G = newGame({ mode:'detail', innings:4, teams:[TEAMS[gs % 10].key, TEAMS[(gs + 4) % 10].key], ctrl:['cpu', 'cpu'], seed: 900 + gs });
    globalThis.G = G; CAST.until = 0; CAST.last = {}; CAST.score = null;
    let res = flush(G), guard = 0;
    while(!G.over && guard++ < 3000){
      res = G.review ? resolveReview(G, aiChallenge(G)) : playStep(G, aiDefChoice(G), aiOffChoice(G));
      const half = (res.events || []).filter(e => e.k === 'inning').pop(); if(!half || G.over) continue;
      played.length = 0; seedRandom(gs * 7 + guard); castResult(res);
      const ids = played.map(p => p[1].replace(/-\d+$/, '')), quiet = half.hits + half.walks + half.errors === 0;
      const has = id => ids.includes(id), tag = `${gs}번 경기 ${half.inning}${half.top ? '초' : '말'}(득점 ${half.runs} 안타 ${half.hits} 볼넷 ${half.walks} 실책 ${half.errors} 병살 ${half.dp} 잔루 ${half.lob} 삼진 ${half.ks})`;
      if(has('a_inning1')){ seenCat.clean = 1; if(half.runs || !quiet) innErrs.push(`${tag}: 삼자범퇴가 아닌데 "깔끔하게"`); }
      if(has('a_inning2') || has('a_inn_dp') || has('a_inn_lob') || has('a_inn_escape')){ seenCat.escape = 1; if(half.runs || quiet) innErrs.push(`${tag}: 실점했거나 출루가 없는데 "실점 없이 막음" 계열`); }
      if(has('a_inn_big')){ seenCat.big = 1; if(half.runs < 3) innErrs.push(`${tag}: 대량 실점 해설이 맞지 않음`); }
      if(has('a_inn_run1')){ seenCat.run1 = 1; if(half.runs !== 1) innErrs.push(`${tag}: 1실점 해설이 맞지 않음`); }
      if(has('a_inn_runs')){ if(half.runs !== 2) innErrs.push(`${tag}: 2실점 해설이 맞지 않음`); }
      if(has('a_inn_k') && !(quiet && half.ks >= 3)) innErrs.push(`${tag}: 삼진 해설이 맞지 않음`);
      if(has('a_inn_dp') && !half.dp) innErrs.push(`${tag}: 병살 해설인데 병살이 없음`);
      if(has('a_inn_lob') && half.lob < 3) innErrs.push(`${tag}: 잔루 해설인데 잔루가 적음`);
    }
  }
  CAST.idx = real; globalThis.SET.analyst = 'some';
  ['clean', 'escape', 'run1'].forEach(k => { if(!seenCat[k]) innErrs.push(`이닝 끝 해설 시험: ${k} 경우가 한 번도 나오지 않음`); });
}
// ---- 새 녹음 아이디(수비수·송구·히트 앤드 런)가 있는 것처럼 꾸며서, 맞는 때에 나오는지 ----
{
  const real = CAST.idx; CAST.idx = { ...real };
  const NEW2 = ['thr_ask', 'thr_none', 'c_hitrun1', 'c_hitrun2', 'a_hitrun1', 'a_hitrun2', ...POSN.flatMap(k => [`pos_${k}_c`, `pos_${k}_to`, `pos_${k}_at`]), 'thr_0', 'thr_1', 'thr_2', 'thr_3'];
  NEW2.forEach(id => { CAST.idx[id] = 1; CAST.buf[id] = { duration: dur(id), id }; });
  globalThis.SET.analyst = 'often';
  const seen2 = {};
  for(let gs = 200; gs < 240; gs++){
    const G = newGame({ mode:'detail', innings:3, teams:[TEAMS[gs % 10].key, TEAMS[(gs + 5) % 10].key], ctrl:['human', 'human'], easy:1, seed: 1300 + gs });
    globalThis.G = G; CAST.until = 0; CAST.last = {}; CAST.score = null;
    flush(G); let guard = 0, step = 0;
    while(!G.over && guard++ < 2500){
      let res, forced = null;
      if(G.pendingThrow){ const p = G.pendingThrow; forced = p.opts.some(o => o.base < 0) && step++ % 2 ? -1 : p.auto; res = resolveThrow(G, forced); }
      else if(G.review) res = resolveReview(G, false);
      else { const O = aiOffChoice(G); if(G.bases[0] != null && G.bases[1] == null && ['swing', 'power', 'contact'].includes(O.k) && step % 3 === 0) O.hr = true; res = playStep(G, aiDefChoice(G), O); step++; }
      played.length = 0; seedRandom(gs * 13 + guard);
      const asked = isE2(res, 'throwq'); castResult(res);
      const ids = played.map(p => p[1].replace(/-\d+$/, '')), pl = (res.events || []).find(e => e.k === 'play'), A = G.anim;
      if(asked){ seenCat2('ask'); if(!ids.includes('thr_ask')) innErrs.push(`${gs}번 경기: 송구를 묻는데 "송구 선택!"이 없음`); }
      else if(ids.includes('thr_ask')) innErrs.push(`${gs}번 경기: 묻지 않는데 "송구 선택!"`);
      if(forced === -1){ seenCat2('none'); if(!ids.includes('thr_none')) innErrs.push(`${gs}번 경기: 던지지 않기로 했는데 thr_none이 없음`); }
      else if(ids.includes('thr_none')) innErrs.push(`${gs}번 경기: 던졌는데 thr_none`);
      if((res.events || []).some(e => e.k === 'hitrun')){ seenCat2('hitrun'); if(ids.some(i => /^c_hitrun/.test(i))) seenCat2('hitrunSaid'); }
      else if(ids.some(i => /^c_hitrun/.test(i))) innErrs.push(`${gs}번 경기: 히트 앤드 런이 아닌데 "히트 앤드 런!"`);
      if(pl && pl.pos && A && A.res === 'inplay'){
        const want = `pos_${pl.pos}_${A.bb && A.bb.type === 'gb' ? 'to' : 'at'}`, other = `pos_${pl.pos}_${A.bb && A.bb.type === 'gb' ? 'at' : 'to'}`;
        if(ids.includes(want)) seenCat2('pos'); if(ids.includes(other)) innErrs.push(`${gs}번 경기: 땅볼/뜬공에 맞지 않는 방향 말 ${other}`);
        if(ids.some(i => /^pos_/.test(i) && !i.startsWith(`pos_${pl.pos}_`))) innErrs.push(`${gs}번 경기: 다른 야수(${ids.filter(i => /^pos_/.test(i)).join(',')})를 말함. 실제 ${pl.pos}`);
      }
    }
  }
  CAST.idx = real; globalThis.SET.analyst = 'some';
  ['ask', 'none', 'hitrun', 'hitrunSaid', 'pos'].forEach(k => { if(!seen2[k]) innErrs.push(`새 녹음 연결 시험: ${k} 경우가 한 번도 나오지 않음`); });
  console.log(`새 녹음 연결 시험: ${Object.keys(seen2).join(', ')} 확인`);
  function seenCat2(k){ seen2[k] = 1; }
}
console.log(`이닝 끝 맥락 시험: ${Object.keys(seenCat).join(', ')} 확인, 어긋남 ${innErrs.length}건`);

// ---- 점검: 스냅샷과 별개로 늘 지켜야 하는 것 ----
const errs = [...innErrs];
if(snap.length !== 20) errs.push(`장면이 ${snap.length}개 (20개여야 함)`);
snap.forEach(s => {
  let prevEnd = -1;
  s.clips.forEach(c => {
    const [t, name] = c.split(' '), base = name.replace(/-\d+$/, '');
    if(!IDX[base] && !IDX[name]) errs.push(`${s.label}: 녹음 목록에 없는 조각 ${name}`);
    if(+t < prevEnd - 0.001) errs.push(`${s.label}: 조각이 겹침 ${c} (앞 조각이 ${prevEnd}에 끝남)`);
    prevEnd = +t + dur(name) + 0.08;
  });
  if(s.label !== '파울' && s.label !== '볼' && !s.clips.length) errs.push(`${s.label}: 아무 말도 하지 않음`);
});

if(UPDATE){
  fs.writeFileSync(SNAP, JSON.stringify(snap, null, 1) + '\n');
  console.log(`스냅샷 저장: ${snap.length}장면, 조각 ${snap.reduce((n, s) => n + s.clips.length, 0)}개`);
} else if(!fs.existsSync(SNAP)){
  errs.push('caster.snap.json이 없음: --update로 저장');
} else {
  const old = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
  snap.forEach((s, i) => {
    const o = old[i];
    if(!o) { errs.push(`${s.label}: 저장한 스냅샷에 없는 장면`); return; }
    if(JSON.stringify(o) !== JSON.stringify(s)) errs.push(`장면 ${i + 1} ${s.label} 달라짐:\n    저장: ${o.clips.join(', ')}\n    지금: ${s.clips.join(', ')}`);
  });
  if(old.length !== snap.length) errs.push(`장면 수 ${old.length} → ${snap.length}`);
}
snap.forEach((s, i) => console.log(`${String(i + 1).padStart(2)}. ${s.label.padEnd(8)} 조각 ${s.clips.length}개: ${s.clips.map(c => c.split(' ')[1]).join(' ')}`));
if(errs.length){ console.log('\n중계 시험 오류:\n  ' + errs.join('\n  ')); process.exit(1); }
console.log('\n중계 시험 통과' + (UPDATE ? ' (스냅샷 새로 저장)' : ' (스냅샷과 같음)'));
