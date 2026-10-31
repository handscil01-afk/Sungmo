'use strict';
/* ===================== 마스터: 명단·설정 · 결과 보고서 · 시험 기록 초기화 ===================== */

/* ---------- 명단·설정 ---------- */
function settingsView(){
  const ps = people(), s = settings();
  const cnt = { red:ps.filter(p => p.team==='red').length, blue:ps.filter(p => p.team==='blue').length };
  const rows = ps.map(p => `<div class="item prow">${teamBadge(p.team)}<span class="name">${esc(p.name)}</span>
      <div class="seg sm"><button class="${p.team==='blue'?'on blue':''}" data-a="setTeam" data-v="${p.id}" data-t="blue">${esc(teamShort('blue'))}</button><button class="${p.team==='red'?'on red':''}" data-a="setTeam" data-v="${p.id}" data-t="red">${esc(teamShort('red'))}</button><button class="${!p.team?'on':''}" data-a="setTeam" data-v="${p.id}" data-t="">미정</button></div>
      <button class="ibtn" data-a="renameP" data-v="${p.id}" aria-label="이름 고치기">✏️</button><button class="ibtn danger" data-a="delP" data-v="${p.id}" aria-label="삭제">🗑</button></div>`).join('');
  const und = ps.length-cnt.red-cnt.blue;
  const tabs = innerTabs('settings', [['list','👥','명단', ps.length], ['add','➕','명단 넣기'], ['att','✅','출석 명단'], ['team','🏷','팀·점수'], ['events','🏅','종목'], ['shuttle','🚌','셔틀·채널'], ['report','🖨','보고서'], ['reset','🧹','초기화']]);
  const body = {
    list: () => `<div class="card"><div class="row"><h2 class="grow h2" style="margin:0">참여자 ${ps.length}명</h2><span class="tag blue">${esc(teamShort('blue'))} ${cnt.blue}</span><span class="tag red">${esc(teamShort('red'))} ${cnt.red}</span>${und?`<span class="tag warn">미정 ${und}</span>`:''}</div>
      <p class="sub">팀을 바로 바꿀 수 있습니다. 새로 넣을 사람은 '명단 넣기' 탭에서 붙여 넣습니다.</p>
      <div class="list">${rows || '<div class="empty">아직 명단이 없습니다. \'명단 넣기\' 탭에서 넣어 주세요.</div>'}</div></div>`,
    add: () => `<div class="card"><h2>명단 붙여넣기</h2>
      <p class="sub">한 줄에 한 명씩 적습니다. 이름 뒤에 띄어 쓰고 <b>${esc(teamName('blue'))}</b>나 <b>${esc(teamName('red'))}</b>(또는 ${esc(teamShort('blue'))}·${esc(teamShort('red'))}, 청·홍, 파랑·빨강)을 적으면 팀도 함께 정해집니다.</p>
      <textarea id="rosterText" data-in="roster" placeholder="가나다 ${esc(teamName('blue'))}&#10;라마바 ${esc(teamName('red'))}&#10;사아자">${esc(UI.rosterText)}</textarea>
      <div style="height:10px"></div><button class="btn primary wide" data-a="addRoster">명단에 넣기</button></div>${attPasteCard()}`,
    att: attSettingsTab,
    team: () => `<div class="card"><h2>팀 이름</h2>
      <div class="row nowrap">${teamBadge('blue')}<input id="tnBlue" value="${esc(teamName('blue'))}" autocomplete="off" aria-label="파랑 팀 이름 (화면 왼쪽)">${teamBadge('red')}<input id="tnRed" value="${esc(teamName('red'))}" autocomplete="off" aria-label="빨강 팀 이름 (화면 오른쪽)"></div>
      <div style="height:10px"></div><button class="btn wide" data-a="saveTeamNames">팀 이름 저장</button>
      <p class="sub">왼쪽은 파랑 팀(동그라미), 오른쪽은 빨강 팀(네모)입니다. 팀 표시에는 팀 이름의 첫 글자(${esc(teamShort('blue'))}·${esc(teamShort('red'))})가 들어갑니다.</p></div>
    <div class="card"><h2>🎯 콩주머니 승부 방식</h2>
      <div class="seg">${[['A','A. 5판 3선승'],['B','B. 5판 총점']].map(([k,l]) => `<button class="${beanbagMode()===k?'on':''}" data-a="setBag" data-v="${k}">${l}</button>`).join('')}</div>
      <p class="sub"><b>A안</b> 5판 중 먼저 3판을 이기는 팀이 이기고, 3승이 나오면 그 자리에서 끝납니다.</p>
      <p class="sub"><b>B안</b> 5판의 점수를 모두 더해 점수 합계가 높은 팀이 이깁니다. 합계가 같으면 팀 대표 1명씩 1개를 던져 정합니다.</p>
      <p class="sub">콩주머니 경기를 시작한 뒤에 바꾸면 이미 입력한 기록의 셈이 달라지니, 시작하기 전에 정해 주세요.</p></div>
    <div class="card"><h2>개인전 표시</h2>
      <div class="item"><span class="name">안내판에 연습 순위 보이기<span class="sub">켜면 안내판의 종합 현황에 연습 1·2의 1~3등도 함께 나옵니다. 연습 점수는 개인전 기록표에 항상 보입니다.</span></span><label class="switch"><input type="checkbox" data-ch="sets" data-k="showPracRank" ${s.showPracRank?'checked':''}><span></span></label></div></div>
    <div class="card"><h2>줄다리기 계획 판 수</h2>
      <div class="row"><span class="grow">진행 현황의 남은 시간 계산에 씁니다</span><div class="seg">${[1,3,5].map(n => `<button class="${s.tugRounds===n?'on':''}" data-a="setS" data-k="tugRounds" data-v="${n}">${n}판</button>`).join('')}</div></div></div>`,
    events: eventsTab,
    shuttle: shuttleSettingsTab,
    report: () => `<div class="card"><h2>결과 보고서 · 내려받기</h2>
      <button class="btn primary wide" data-a="report">🖨 결과 보고서 보기 (인쇄·PDF 저장)</button>
      <div class="row" style="margin-top:10px"><button class="btn grow" data-a="csv" data-v="indiv">개인전 기록 (엑셀용 CSV)</button><button class="btn grow" data-a="csv" data-v="team">단체전 기록 (엑셀용 CSV)</button></div></div>`,
    reset: () => `<div class="card"><h2>🧹 시험 기록 초기화</h2>
      <p class="sub">운동회 전에 시험해 본 점수·승패·호출(감독 호출 포함)·개인전 대기 줄·과녁판 표시·안내·불참 표시·출석 체크·문자 무전을 한 번에 지웁니다. 선수 명단, 전체 인원 명단, 팀, 담당자 명단, 역할, 일정은 그대로 남습니다.</p>
      <button class="btn danger wide" data-a="resetAll">시험 기록 모두 지우기</button></div>`,
  }[ITAB.settings]();
  return `<div class="bctl">${tabs}${body}</div>`;
}

// 팀을 가리키는 낱말 (현재 팀 이름 + 별명). 소문자로 비교
const teamWords = () => ({
  blue: [teamName('blue'), '이가네', '이가', '청팀', '청', '파랑', '파랑팀', '블루', 'blue'].map(w => w.toLowerCase()),
  red:  [teamName('red'), '함씨네', '함씨', '홍팀', '홍', '빨강', '빨강팀', '레드', 'red'].map(w => w.toLowerCase()),
});
function parseRoster(text){
  const words = teamWords();
  const out = [];
  text.split(/\r?\n|,|\t/).forEach(line => {
    const s = line.trim().replace(/^\d+[.)]\s*/, ''); if(!s) return;
    // 팀 이름은 떨어진 낱말일 때만 인정 (이름 안의 '홍'은 그대로 둠)
    let team = ''; const keep = [];
    s.replace(/[()\[\]\-:/]/g, ' ').split(/\s+/).filter(Boolean).forEach(tk => {
      const low = tk.toLowerCase();
      if(keep.length && words.blue.includes(low)) team = 'blue';
      else if(keep.length && words.red.includes(low)) team = 'red';
      else keep.push(tk);
    });
    const name = keep.join(' ');
    if(name) out.push({ name, team });
  });
  return out;
}
// 내려받는 표의 출전자: 한 사람은 이름, 조 대결은 '2조 홍길동·김철수'
const csvSide = (m, tm) => { const n = matchNames(m, tm); return n && m[tm+'Group'] ? `${m[tm+'Group']}조 ${n}` : n; };
function csv(kind){
  const rows = [];
  const q = v => { const s=String(v??''); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
  const t = v => v ? new Date(v).toLocaleString('ko-KR') : '';
  if(kind==='indiv'){
    const maxN = Math.max(5, ...Object.values(INDIV).map(E => E.count));
    rows.push(['종목','구분','이름',...Array.from({length:maxN}, (_,k) => `${k+1}회`),'합계','거리','입력자','입력 시각','수정자','수정 시각']);
    Object.entries(INDIV).forEach(([ev,E]) => {
      D.indiv.filter(r => r.event===ev && !r.deleted && (r.throws||[]).length)
        .sort((x,y) => (ROUND_KEYS.indexOf(x.round) - ROUND_KEYS.indexOf(y.round)) || String(pname(x.personId)).localeCompare(String(pname(y.personId)), 'ko')).forEach(r => {
        const pts = Array.from({length:maxN}, (_,k) => r.throws[k]!=null ? throwVal(ev, r.throws[k]) : '');
        rows.push([E.name, ROUNDS[r.round] || r.round, pname(r.personId), ...pts, totalOf(ev,r.throws), r.dist?r.dist+'m':'', r.by||'', t(r.at), r.editedBy||'', t(r.editedAt)]);
      }); });
  } else {
    rows.push(['종목','순번',teamName('blue')+' 선수',teamName('red')+' 선수','결과',teamName('blue')+' 기록(초)',teamName('red')+' 기록(초)',teamName('blue')+' 점수',teamName('red')+' 점수','입력자','입력 시각','수정자','수정 시각']);
    Object.entries(TEAM).forEach(([ev,E]) => matchesOf(ev).forEach((m,i) => rows.push([E.name, i+1, csvSide(m,'blue'), csvSide(m,'red'),
      m.winner==='draw' ? '무승부' : teamName(m.winner)+' 승', m.blueTime??'', m.redTime??'', m.blueScore??'', m.redScore??'', m.by||'', t(m.at), m.editedBy||'', t(m.editedAt)])));
    // 종목 결과(심판이 확정한 것)와 승점
    rows.push([]);
    rows.push(['종목','종목 결과',teamName('blue')+' 성적',teamName('red')+' 성적','단위','결정전','확정한 사람','확정 시각','확정 뒤 기록 변경']);
    Object.entries(TEAM).forEach(([ev,E]) => { const st = eventStat(ev), r = resultOf(ev);
      rows.push([E.name, r ? teamName(r.winner)+' 승 (승점 '+(E.pts||1)+')' : '미확정', st.blue, st.red, st.unit, r && r.decider ? '예' : '', r ? (r.by||'') : '', r ? t(r.at) : '', r && resultStale(ev) ? '예' : '']); });
    const tp = totalPoints(); rows.push(['합계 승점','',tp.blue,tp.red]);
  }
  const blob = new Blob(['﻿'+rows.map(r => r.map(q).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `가을운동회_${kind==='indiv'?'개인전':'단체전'}_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

Object.assign(ACT, {
  saveTeamNames: () => {
    const b = $('#tnBlue').value.trim(), r = $('#tnRed').value.trim();
    if(!b || !r){ toast('두 팀 이름을 모두 적어 주세요.'); return false; }
    setConfig({ teamNames:{ blue:b, red:r } }); toast('팀 이름을 저장했습니다.');
  },
  addRoster: () => {
    if(!can.master()) return denied();
    const list = parseRoster(UI.rosterText); if(!list.length){ toast('붙여넣은 이름이 없습니다.'); return false; }
    const cur = people(), add = {}, t0 = now(); let n=0, u=0;
    list.forEach((x,k) => { const ex = cur.find(p => p.name===x.name);
      if(ex){ if(x.team && ex.team!==x.team){ add[ex.id] = { team:x.team }; u++; } }
      else { add['p'+uid()] = { name:x.name, team:x.team, createdAt:t0+k, deleted:false }; n++; } });
    setConfig({ people:add }); UI.rosterText=''; toast(`${n}명을 넣었습니다.${u?` (${u}명은 팀만 바꿈)`:''}`);
  },
  setTeam: (el, v) => { setConfig({ people:{ [v]:{ team: el.dataset.t } } }); return false; },
  renameP: async (el, v) => { const p = person(v), n = await askText('이름 고치기', p?.name||''); if(n && n.trim()) setConfig({ people:{ [v]:{ name:n.trim() } } }); return false; },
  delP: async (el, v) => { const p = person(v); if(!(await ask(`${p?.name}을(를) 명단에서 지울까요?\n이미 입력한 기록은 그대로 남습니다.`,'지우기',true))) return false; setConfig({ people:{ [v]:{ deleted:true } } }); return false; },
  setBag: async (el, v) => {
    if(v!=='A' && v!=='B') return false;
    if(v===beanbagMode()) return false;
    if(matchesOf('beanbag').length && !(await ask('콩주머니 경기를 이미 시작했습니다.\n승부 방식을 바꾸면 입력한 기록의 셈이 달라집니다. 바꿀까요?', '바꾸기', true))) return false;
    setConfig({ settings:{ beanbagMode:v } }); toast(`콩주머니 승부 방식을 ${v}안으로 바꿨습니다.`); return false;
  },
  setS: (el, v) => { setConfig({ settings:{ [el.dataset.k]: parseFloat(v) } }); return false; },
  csv: (el, v) => { csv(v); return false; },
  report: () => { UI.report = true; window.scrollTo(0,0); },
  reportClose: () => { UI.report = false; },
  print: () => { window.print(); return false; },
  resetAll: async () => {
    if(!can.master()) return denied();
    const t = await askText('시험 기록을 모두 지웁니다. 되돌릴 수 없습니다.\n계속하려면 "초기화"라고 적어 주세요.', '', '지우기');
    if(t==null) return false;
    if(t.trim()!=='초기화'){ toast('"초기화"라고 적어야 지울 수 있습니다.'); return false; }
    const orders = await ask('감독이 정한 출전 순서도 함께 지울까요?\n(취소를 누르면 순서는 남깁니다)', '순서도 지우기', true);
    const by = { editedBy:UI.me, editedAt:now() }, jobs = [];
    D.indiv.filter(r => !r.deleted).forEach(r => jobs.push(put(['main','indiv',r.id], { event:r.event, deleted:true, ...by })));
    D.matches.filter(m => !m.deleted).forEach(m => jobs.push(put(['main','matches',m.id], { event:m.event, deleted:true, ...by })));
    Object.keys(D.calls).forEach(ev => jobs.push(put(['main','calls',ev], { pick:{ blue:null, red:null }, call:null, result:null, times:null, marks:{ list:[], addN:0, addAt:0, first:'blue' } })));
    Object.keys(D.queues).forEach(id => jobs.push(guard(store.del(['main','queues',id]))));
    Object.keys(D.absent).forEach(id => jobs.push(guard(store.del(['main','absent',id]))));
    Object.keys(D.ccalls).forEach(id => jobs.push(guard(store.del(['main','ccalls',id]))));
    D.msgs.forEach(m => jobs.push(guard(store.del(['main','msgs',m.id]))));
    if(orders) Object.values(D.orders).forEach(o => jobs.push(put(['main','orders',o.id], { event:o.event, team:o.team, list:[], by:UI.me, at:now() }, false)));
    jobs.push(setConfig({ announce:{ cleared:true }, awards:{ step:-1 }, board:{ mode:'auto' } }));
    const res = await Promise.all(jobs);
    toast(`시험 기록을 지웠습니다. (${res.filter(Boolean).length}건)`);
  },
});

document.addEventListener('change', e => { const el = e.target; if(el.dataset.ch==='sets') setConfig({ settings:{ [el.dataset.k]: el.checked } }); });
