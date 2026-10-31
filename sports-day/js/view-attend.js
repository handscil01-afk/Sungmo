'use strict';
/* ===================== 전체 인원 출석 체크 =====================
   행사 당일 전체 인원(이용인·활동지원사·수어통역사·직원·봉사자·자원봉사자)을 여러 기기에서 체크하고 모두 같이 봄.
   - 명단: config.attendees = { aid: { name, cat(구분), team('blue'|'red'|''), pair(짝꿍·담당), duty(당일 역할), note(비고), no(번호), ord(붙여 넣은 순서), deleted } }  (마스터만 씀)
   - 출석 기록: main/absent/att_<aid> = { att:true, here:true, cat, name, by, at }  (해제는 문서 삭제)
     선수 불참 표시(main/absent/<선수id>)와 같은 모음에 들어오지만, 이름이 att_ 로 시작하고 absent 값이 없어서 isAbsent()에는 잡히지 않음
   - 체크할 수 있는 기기: 마스터 + 역할이 있는 진행요원(can.att). 안내판·역할 대기는 못 씀 */
const ATT_PLAYER_CAT = '이용인';
const ATT_PREFIX = 'att_';
const ATT = { cat:'all', todo:false, q:'' };
let attPlan = null, AE = null;       // attPlan: 붙여 넣은 명단의 미리보기 / AE: 한 명 고치기 창의 임시 값

function attendees(){
  return Object.entries((D.config || {}).attendees || {}).filter(([,v]) => v && !v.deleted && v.name)
    .map(([id,v]) => ({ id, ...v })).sort((a,b) => (a.ord ?? 1e9) - (b.ord ?? 1e9) || byName(a,b));
}
const attRec = id => { const r = D.absent[ATT_PREFIX + id]; return r && r.att ? r : null; };
const attCat = a => a.cat || '기타';
const attCats = list => [...new Set(list.map(attCat))];
const attHere = list => list.filter(a => attRec(a.id)).length;

/* ---------- 출석 화면 (아래에서 올라오는 창) ---------- */
function attRow(a){
  const r = attRec(a.id), meta = [a.pair, a.duty, a.note].filter(Boolean).join(' · ');
  return `<button class="arow${r ? ' here' : ''}" data-a="attTap" data-v="${esc(a.id)}" aria-pressed="${!!r}">
    <span class="arn"><b>${esc(a.name)}</b>${a.team ? teamBadge(a.team) : ''}</span>
    ${r ? `<span class="ars">✓ 출석 ${hm(r.at)} · ${esc(r.by || '')}</span>` : '<span class="ars off">미출석</span>'}
    ${meta ? `<span class="arm">${esc(meta)}</span>` : ''}</button>`;
}
function attRows(){
  const all = attendees(), q = ATT.q.trim();
  if(!all.length) return '<div class="empty">전체 인원 명단이 아직 없습니다. 마스터가 명단·설정의 명단 넣기 탭에서 붙여 넣어 주세요.</div>';
  let out = '';
  attCats(all).filter(c => ATT.cat==='all' || ATT.cat===c).forEach(c => {
    const grp = all.filter(a => attCat(a)===c);
    const rows = grp.filter(a => (!ATT.todo || !attRec(a.id)) && (!q || String(a.name).includes(q) || String(a.pair||'').includes(q)));
    if(rows.length) out += `<h3 class="atth"><span>${esc(c)}</span><b>${attHere(grp)}/${grp.length}</b></h3>${rows.map(attRow).join('')}`;
  });
  return out || `<div class="empty">${ATT.todo && !q ? '모두 출석했습니다.' : '해당하는 사람이 없습니다.'}</div>`;
}
function attendSheet(){
  const all = attendees(), cats = attCats(all), here = attHere(all);
  if(ATT.cat!=='all' && !cats.includes(ATT.cat)) ATT.cat = 'all';
  const chip = (k, l, on) => `<button class="chip${on ? ' on' : ''}" data-a="attCat" data-v="${esc(k)}" aria-pressed="${on}">${esc(l)}</button>`;
  return `<div class="attstick"><div class="atthead"><h2>✅ 출석 체크</h2><span class="attbig" aria-label="전체 출석 ${here}명 중 ${all.length}명"><b>${here}</b>/${all.length}</span></div>
      <div class="progress"><i style="width:${all.length ? Math.round(here/all.length*100) : 0}%"></i></div>
      <div class="chips attchips">${chip('all', '전체', ATT.cat==='all')}${cats.map(c => chip(c, c, ATT.cat===c)).join('')}<button class="chip todo${ATT.todo ? ' on' : ''}" data-a="attTodo" aria-pressed="${ATT.todo}">미출석만 ${all.length - here}</button></div>
      <input id="attq" data-in="attq" placeholder="이름 검색" value="${esc(ATT.q)}" autocomplete="off" enterkeyhint="search"></div>
    <div id="attRows" class="attrows">${attRows()}</div>
    <p class="sub" style="margin-top:10px">이름을 누르면 바로 출석으로 바뀌고, 출석한 사람을 다시 누르면 취소할지 묻습니다. 다른 기기에서 체크한 것도 바로 보입니다.</p>
    ${can.master() ? '<button class="btn wide" data-a="attToAbsent" style="margin-top:6px">출석 안 한 이용인을 불참으로</button>' : ''}
    <button class="btn primary wide" data-a="closeSheet" style="margin-top:12px">닫기</button>`;
}
// 머리줄·메뉴·운영 현황 화면에서 들어가는 단추
function attHeadBtn(){
  const all = attendees(); if(!can.att() || !all.length) return '';
  return `<button class="hbtn attbtn" data-a="attOpen" aria-label="출석 체크 ${attHere(all)}명, 전체 ${all.length}명"><span class="ic">✅</span></button>`;
}
function attProgBtn(){
  const all = attendees(); if(!can.att()) return '';
  return `<button class="btn small attprog" data-a="attOpen">✅ 출석 체크${all.length ? ` <b>${attHere(all)}/${all.length}</b>` : ''}</button>`;
}

/* ---------- 붙여 넣은 전체 명단 읽기 ---------- */
const ATT_COLS = [['no', /번호|^no\.?$/i], ['cat', /구분/], ['name', /이름|성명/], ['team', /^팀|소속팀/], ['pair', /짝꿍|담당/], ['duty', /역할/], ['note', /비고/], ['sex', /성별/]];
const ATT_ORDER = ['no','cat','name','team','pair','duty','note','sex'];
function teamOfWord(w){
  const s = String(w||'').trim().toLowerCase(); if(!s || ['공통', '-', '없음'].includes(s)) return '';
  const t = teamWords();
  return t.blue.includes(s) ? 'blue' : t.red.includes(s) ? 'red' : null;      // null: 알 수 없는 낱말
}
function parseAttendees(text){
  const rows = String(text||'').split(/\r?\n/).map(l => l.split('\t').map(c => c.trim())).filter(r => r.some(Boolean));
  if(!rows.length) return { error:'붙여 넣은 내용이 없습니다.' };
  if(!rows.some(r => r.length > 1)) return { error:'칸으로 나뉘어 있지 않습니다. 엑셀 전체 명단 시트에서 칸을 복사해 붙여 넣어 주세요.' };
  let col = null, start = 0;
  const hdr = rows[0].map(c => c.replace(/\s/g, ''));
  const found = {}; hdr.forEach((c, i) => { const f = ATT_COLS.find(([k, re]) => found[k]==null && re.test(c)); if(f) found[f[0]] = i; });
  if(found.name != null && found.cat != null){ col = found; start = 1; }
  else if(/^\d+$/.test(rows[0][0])){ col = Object.fromEntries(ATT_ORDER.map((k, i) => [k, i])); }
  else return { error:'머리줄(번호·구분·이름·팀…)이 없고 첫 칸도 번호가 아닙니다. 시트의 머리줄부터 복사해 붙여 넣어 주세요.' };
  const cell = (r, k) => (col[k] != null ? (r[col[k]] || '') : '');
  const out = [], warn = { noName:0, badTeam:[], dup:[] }, seen = new Set();
  rows.slice(start).forEach(r => {
    const name = cell(r, 'name').replace(/\s+/g, ' ').trim(); if(!name){ warn.noName++; return; }
    const cat = cell(r, 'cat').trim() || '기타', tw = teamOfWord(cell(r, 'team'));
    if(tw === null) warn.badTeam.push(name);
    const key = cat + '|' + name; if(seen.has(key)) warn.dup.push(name); seen.add(key);
    const no = parseInt(cell(r, 'no'), 10);
    out.push({ name, cat, team: tw || '', pair: cell(r, 'pair'), duty: cell(r, 'duty'), note: cell(r, 'note'), no: isFinite(no) ? no : out.length + 1 });
  });
  if(!out.length) return { error:'이름이 있는 줄이 없습니다. 머리줄에 \'이름\'과 \'구분\'이 있는지 확인해 주세요.' };
  return { rows: out, warn };
}
// 붙여 넣은 명단을 지금 명단에 어떻게 반영할지 계산 (미리보기와 실제 반영이 같은 계산을 씀)
function attBuildPlan(parsed){
  const cur = attendees(), pool = {};
  cur.forEach(a => (pool[attCat(a) + '|' + a.name] ||= []).push(a.id));
  const att = {}, keep = new Set(); let kept = 0;
  parsed.rows.forEach((x, k) => {
    const q = pool[x.cat + '|' + x.name], old = q && q.length ? q.shift() : null;
    const id = old || 'a' + uid() + k.toString(36);
    if(old){ keep.add(old); kept++; }
    att[id] = { name:x.name, cat:x.cat, team:x.team, pair:x.pair, duty:x.duty, note:x.note, no:x.no, ord:k, deleted:false };
  });
  const gone = cur.filter(a => !keep.has(a.id));
  gone.forEach(a => { att[a.id] = { deleted:true }; });
  // 이용인은 선수 명단에도 (이미 같은 이름이 있으면 팀만 맞춤: 명단 붙여넣기와 같은 방식)
  const have = people(), add = {}, t0 = now(), done = new Set(); let nNew = 0, nTeam = 0, nPlayers = 0;
  parsed.rows.filter(x => x.cat===ATT_PLAYER_CAT).forEach((x, k) => {
    if(done.has(x.name)) return; done.add(x.name); nPlayers++;
    const ex = have.find(p => p.name===x.name);
    if(ex){ if(x.team && ex.team!==x.team){ add[ex.id] = { team:x.team }; nTeam++; } }
    else { add['p' + uid() + k.toString(36)] = { name:x.name, team:x.team, createdAt:t0 + k, deleted:false }; nNew++; }
  });
  const counts = attCats(parsed.rows.map(x => ({ cat:x.cat }))).map(c => [c, parsed.rows.filter(x => x.cat===c).length]);
  return { att, people:add, gone, kept, existing:cur.length, nNew, nTeam, nPlayers, counts, total:parsed.rows.length };
}

/* ---------- 마스터: 명단 넣기 탭의 붙여넣기 카드 · 출석 명단 탭 ---------- */
function attPasteCard(){
  const n = attendees().length;
  return `<div class="card"><h2>전체 인원 명단(출석용) 붙여넣기</h2>
    <p class="sub">엑셀 '전체 명단' 시트에서 머리줄(번호·구분·이름·팀·짝꿍·담당·당일 역할·비고)부터 칸을 복사해 붙여 넣습니다. 구분이 '${ATT_PLAYER_CAT}'인 사람은 선수 명단에도 팀과 함께 들어갑니다.</p>
    ${n ? `<p class="sub">지금 전체 인원 명단에 ${n}명이 있습니다. 붙여 넣으면 이 명단 전체가 새 명단으로 바뀌고, 이름과 구분이 같은 사람은 이미 한 출석 체크가 그대로 남습니다.</p>` : ''}
    <textarea id="attText" data-in="attText" style="min-height:110px" placeholder="번호&#9;구분&#9;이름&#9;팀&#9;짝꿍·담당&#9;당일 역할&#9;비고">${esc(UI.attText || '')}</textarea>
    <div style="height:10px"></div><button class="btn primary wide" data-a="attPreview">미리보기</button></div>`;
}
function attPreviewSheet(){
  const P = attPlan; if(!P) return '<p>미리 볼 명단이 없습니다.</p><button class="btn wide" data-a="closeSheet">닫기</button>';
  const { plan, parsed } = P, w = parsed.warn;
  const head = parsed.rows.slice(0, 6).map(x => `<div class="item"><span class="no tag">${x.no}</span>${x.team ? teamBadge(x.team) : '<span class="tb none" style="visibility:hidden"></span>'}<span class="name">${esc(x.name)}<span class="sub">${esc(x.cat)}${x.pair ? ' · ' + esc(x.pair) : ''}${x.duty ? ' · ' + esc(x.duty) : ''}</span></span></div>`).join('');
  const notes = [
    plan.existing ? `지금 명단 ${plan.existing}명을 이 명단으로 바꿉니다. 이름과 구분이 같은 ${plan.kept}명은 출석 체크가 그대로 남고, 빠지는 ${plan.gone.length}명은 명단에서 지워집니다.` : '',
    w.badTeam.length ? `팀 칸을 알아보지 못해 공통으로 넣은 사람: ${w.badTeam.slice(0, 8).map(esc).join(', ')}${w.badTeam.length > 8 ? ' 외' : ''}` : '',
    w.dup.length ? `구분과 이름이 같은 줄이 있습니다(각각 따로 넣음): ${w.dup.slice(0, 8).map(esc).join(', ')}` : '',
    w.noName ? `이름이 비어 있어 건너뛴 줄: ${w.noName}줄` : '',
  ].filter(Boolean);
  return `<h2>전체 인원 명단 확인</h2>
    <div class="card"><div class="row"><b style="font-size:20px">전체 ${plan.total}명</b><span class="grow"></span></div>
      <div class="chips" style="margin:8px 0">${plan.counts.map(([c, n]) => `<span class="tag ${c===ATT_PLAYER_CAT ? 'dark' : ''}">${esc(c)} ${n}명</span>`).join('')}</div>
      <p class="sub">선수 명단에 들어갈 ${ATT_PLAYER_CAT} ${plan.nPlayers}명 (새로 ${plan.nNew}명${plan.nTeam ? `, 팀만 바꿈 ${plan.nTeam}명` : ''})</p></div>
    <div class="card"><b>처음 ${Math.min(6, parsed.rows.length)}줄</b><div class="list">${head}</div></div>
    ${notes.map(t => `<div class="note">${t}</div>`).join('')}
    <div class="row nowrap"><button class="btn primary grow" data-a="attApply">${plan.existing ? '바꾸기' : '명단에 넣기'}</button><button class="btn grow" data-a="closeSheet">닫기</button></div>`;
}
function attSettingsTab(){
  const all = attendees(), cats = attCats(all);
  const card = `<div class="card"><h2>✅ 출석 명단 <span class="sub">${all.length}명 · 출석 ${attHere(all)}명</span></h2>
    <p class="sub">행사 당일 접수대 등 여러 기기에서 전체 인원을 체크합니다. 명단은 '명단 넣기' 탭에서 엑셀 전체 명단을 붙여 넣어 만들고, 여기서는 한 명씩 고치거나 지울 수 있습니다.</p>
    <div class="row"><button class="btn primary grow" data-a="attOpen">✅ 출석 체크</button><button class="btn grow" data-a="attEdit" data-v="">＋ 한 명 추가</button></div>
    <button class="btn wide" data-a="attToAbsent" style="margin-top:8px">출석 안 한 이용인을 불참으로</button></div>`;
  const groups = cats.map(c => { const grp = all.filter(a => attCat(a)===c);
    return `<div class="card"><h2>${esc(c)} <span class="sub">${grp.length}명</span></h2><div class="list">${grp.map(a =>
      `<div class="item prow">${a.team ? teamBadge(a.team) : '<span class="tb none" style="visibility:hidden"></span>'}<span class="name">${esc(a.name)}<span class="sub">${esc([a.pair, a.duty, a.note].filter(Boolean).join(' · '))}</span></span>
        <button class="ibtn" data-a="attEdit" data-v="${esc(a.id)}" aria-label="${esc(a.name)} 고치기">✏️</button><button class="ibtn danger" data-a="attDel" data-v="${esc(a.id)}" aria-label="${esc(a.name)} 지우기">🗑</button></div>`).join('')}</div></div>`; }).join('');
  return card + (groups || '<div class="card empty">아직 전체 인원 명단이 없습니다. \'명단 넣기\' 탭에서 붙여 넣어 주세요.</div>');
}
function attEditSheet(){
  const E = AE, cats = attCats(attendees());
  return `<h2>${E.id ? '한 명 고치기' : '한 명 추가'}</h2>
    <div class="card">
      <label class="aelab">이름<input data-in="ae" data-k="name" value="${esc(E.name)}" autocomplete="off"></label>
      <label class="aelab">구분<input data-in="ae" data-k="cat" value="${esc(E.cat)}" list="attCatList" autocomplete="off"><datalist id="attCatList">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
      <div class="aelab">팀<div class="seg"><button class="${!E.team ? 'on' : ''}" data-a="aeTeam" data-v="">공통</button><button class="${E.team==='blue' ? 'on blue' : ''}" data-a="aeTeam" data-v="blue">${esc(teamName('blue'))}</button><button class="${E.team==='red' ? 'on red' : ''}" data-a="aeTeam" data-v="red">${esc(teamName('red'))}</button></div></div>
      <label class="aelab">짝꿍·담당<input data-in="ae" data-k="pair" value="${esc(E.pair)}" autocomplete="off"></label>
      <label class="aelab">당일 역할<input data-in="ae" data-k="duty" value="${esc(E.duty)}" autocomplete="off"></label>
      <label class="aelab">비고<input data-in="ae" data-k="note" value="${esc(E.note)}" autocomplete="off"></label></div>
    <div class="row nowrap"><button class="btn primary grow" data-a="aeSave">저장</button><button class="btn grow" data-a="closeSheet">닫기</button></div>`;
}

/* ---------- 동작 ---------- */
const attPlayerPatch = (name, team) => {
  const ex = people().find(p => p.name===name);
  if(ex) return team && ex.team!==team ? { [ex.id]:{ team } } : {};
  return { ['p' + uid()]:{ name, team:team || '', createdAt:now(), deleted:false } };
};
Object.assign(ACT, {
  attOpen: () => { if(!can.att()) return denied(); ATT.q = ''; openSheet(attendSheet); return false; },
  attCat: (el, v) => { ATT.cat = v; drawSheet(); return false; },
  attTodo: () => { ATT.todo = !ATT.todo; drawSheet(); return false; },
  // 누르면 바로 출석. 이미 출석한 사람은 취소할지 물어봄(잘못 누름 방지)
  attTap: async (el, id) => {
    if(!can.att()) return denied();
    const ae = document.activeElement; if(ae && ae.id==='attq') ae.blur();      // 검색 중에도 바로 반영되게 (입력 중에는 화면을 다시 그리지 않으므로)
    const a = attendees().find(x => x.id===id); if(!a) return false;
    if(attRec(id)){
      if(!(await ask(`${a.name}\n출석을 취소할까요?`, '출석 취소', true))) return false;
      if(await guard(store.del(['main', 'absent', ATT_PREFIX + id]))) toast(`${a.name} 출석을 취소했습니다.`);
    } else if(await put(['main', 'absent', ATT_PREFIX + id], { att:true, here:true, cat:attCat(a), name:a.name, by:UI.me, at:now() }, false)){
      if(navigator.vibrate) navigator.vibrate(25);
    }
    return false;
  },
  // 출석 안 한 이용인을 이름으로 선수 명단과 맞춰 불참으로 (출석과 불참은 평소에는 따로 움직이므로 마스터가 직접 누를 때만)
  attToAbsent: async () => {
    if(!can.master()) return denied();
    const ps = people(), miss = attendees().filter(a => attCat(a)===ATT_PLAYER_CAT && !attRec(a.id));
    if(!attendees().some(a => attCat(a)===ATT_PLAYER_CAT)){ toast(`전체 인원 명단에 구분이 '${ATT_PLAYER_CAT}'인 사람이 없습니다.`); return false; }
    if(!miss.length){ toast(`출석하지 않은 ${ATT_PLAYER_CAT}이 없습니다.`); return false; }
    const targets = [], skip = [];
    miss.forEach(a => { const p = ps.find(x => x.name===a.name); if(!p) skip.push(a.name); else if(!isAbsent(p.id)) targets.push(p); });
    if(!targets.length){ toast(skip.length ? `선수 명단에서 이름을 찾지 못했습니다: ${skip.join(', ')}` : `출석하지 않은 ${ATT_PLAYER_CAT}은 이미 모두 불참으로 표시되어 있습니다.`); return false; }
    const msg = `출석하지 않은 ${ATT_PLAYER_CAT} ${targets.length}명을 불참으로 바꿀까요?\n${targets.map(p => p.name).join(', ')}${skip.length ? `\n\n선수 명단에서 이름을 찾지 못해 건너뜀: ${skip.join(', ')}` : ''}\n\n불참이 되면 단체전 출전 순서에서 건너뜁니다.`;
    if(!(await ask(msg, '불참으로 바꾸기', true))) return false;
    const res = await Promise.all(targets.map(p => put(['main', 'absent', p.id], { absent:true, team:p.team || '', by:UI.me, at:now() }, false)));
    toast(`${res.filter(Boolean).length}명을 불참으로 바꿨습니다.`);
    return false;
  },
  attPreview: () => {
    if(!can.master()) return denied();
    const parsed = parseAttendees(UI.attText);
    if(parsed.error){ toast(parsed.error); return false; }
    attPlan = { parsed, plan: attBuildPlan(parsed) };
    openSheet(attPreviewSheet); return false;
  },
  attApply: async () => {
    if(!can.master()) return denied();
    if(!attPlan) return false;
    const plan = attBuildPlan(attPlan.parsed);          // 미리 본 사이에 명단이 바뀌었을 수 있으므로 다시 계산
    if(!(await setConfig({ attendees:plan.att, ...(Object.keys(plan.people).length ? { people:plan.people } : {}) }))) return false;
    plan.gone.forEach(a => { if(D.absent[ATT_PREFIX + a.id]) guard(store.del(['main', 'absent', ATT_PREFIX + a.id])); });
    UI.attText = ''; attPlan = null; closeSheet();
    toast(`전체 ${plan.total}명, 선수 ${plan.nPlayers}명 반영했습니다.`);
    return false;
  },
  attEdit: (el, v) => {
    if(!can.master()) return denied();
    const a = v ? attendees().find(x => x.id===v) : null;
    AE = { id:v || '', name:a ? a.name : '', cat:a ? attCat(a) : ATT_PLAYER_CAT, team:a ? (a.team || '') : '', pair:a ? (a.pair || '') : '', duty:a ? (a.duty || '') : '', note:a ? (a.note || '') : '' };
    openSheet(attEditSheet); return false;
  },
  aeTeam: (el, v) => { AE.team = v; drawSheet(); return false; },
  aeSave: async () => {
    if(!can.master()) return denied();
    const name = AE.name.trim(), cat = AE.cat.trim() || '기타';
    if(!name){ toast('이름을 적어 주세요.'); return false; }
    const all = attendees(), id = AE.id || 'a' + uid();
    const old = AE.id ? all.find(x => x.id===AE.id) : null;
    const rec = { name, cat, team:AE.team, pair:AE.pair.trim(), duty:AE.duty.trim(), note:AE.note.trim(), deleted:false };
    if(!old){ rec.ord = all.reduce((m, a) => Math.max(m, a.ord ?? 0), 0) + 1; rec.no = all.reduce((m, a) => Math.max(m, +a.no || 0), 0) + 1; }
    const pp = cat===ATT_PLAYER_CAT ? attPlayerPatch(name, AE.team) : {};
    if(!(await setConfig({ attendees:{ [id]:rec }, ...(Object.keys(pp).length ? { people:pp } : {}) }))) return false;
    // 이름·구분을 바꿨다면 이미 한 출석 기록에도 같은 글자를 남김
    const r = D.absent[ATT_PREFIX + id]; if(r && r.att && (r.name!==name || r.cat!==cat)) put(['main', 'absent', ATT_PREFIX + id], { name, cat });
    closeSheet(); toast(old ? `${name} 정보를 고쳤습니다.` : `${name}을(를) 명단에 넣었습니다.`);
    return false;
  },
  attDel: async (el, v) => {
    if(!can.master()) return denied();
    const a = attendees().find(x => x.id===v); if(!a) return false;
    if(!(await ask(`${a.name}을(를) 출석 명단에서 지울까요?\n선수 명단에는 영향이 없습니다.`, '지우기', true))) return false;
    if(await setConfig({ attendees:{ [v]:{ deleted:true } } })){ if(D.absent[ATT_PREFIX + v]) guard(store.del(['main', 'absent', ATT_PREFIX + v])); }
    return false;
  },
});
document.addEventListener('input', e => {
  const el = e.target, k = el.dataset && el.dataset.in; if(!k) return;
  if(k==='attq'){ ATT.q = el.value; const box = document.getElementById('attRows'); if(box) box.innerHTML = attRows(); }
  else if(k==='attText') UI.attText = el.value;
  else if(k==='ae' && AE) AE[el.dataset.k] = el.value;
});
document.addEventListener('keydown', e => { if(e.key==='Enter' && e.target.id==='attq') e.target.blur(); });
