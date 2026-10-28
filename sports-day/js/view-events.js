'use strict';
/* ===================== 마스터: 종목 켜고 끄기 · 새 종목 만들기 =====================
   설정은 config 문서의 events 에 저장: off { 종목: true } 꺼진 종목 / custom { 종목: 정의 } 만든 종목 / opt { 종목: { board, score } } 기본 종목의 단체전 옵션
   꺼진 종목은 기록을 그대로 두고 화면에서만 숨김. 만든 종목을 지워도 기록은 남고 화면에서만 사라짐 */
const EV_ICONS = ['🎲','🏀','🎳','🏐','🥏','🏸','🧩','🥅','🎾','🏓','🛹','🏅'];
const EV_COLORS = ['#6d28d9','#0f766e','#a16207','#15803d','#c2410c','#be185d','#0369a1','#334155'];
const TMODES = [['duel','1:1 대결 승패'], ['time','기록 비교(초, 빠른 쪽 승)'], ['round','판마다 팀 승패']];
let EF = null;      // 새 종목 만들기·고치기 창에서 쓰는 임시 값

// 기본 종목은 마스터 설정(events.opt), 만든 종목은 자기 정의에서 과녁판·점수 옵션을 읽음 (꺼진 종목도 보여 주려고 allEventList 항목 기준)
function optOfItem(x){
  const o = (((D.config.events||{}).opt)||{})[x.key] || {};
  if(x.E.custom) return { board: !!x.E.board, score: !!x.E.score };
  return { board: !!(o.board ?? (x.key==='beanbag')), score: !!(o.score ?? false) };
}
function evSummary(x){
  const E = x.E;
  if(x.kind==='indiv'){
    const how = E.mode==='number' ? `숫자 입력${E.vunit ? `(${E.vunit})` : ''} · ${E.dir==='low' ? '낮을수록' : '높을수록'} 좋음` : '점수 단추 합계';
    return `${how} · ${E.count}${E.unit} · 칸 ${E.lanes}개 · 연습 ${E.prac ? '있음' : '없음'}`;
  }
  const how = E.agg==='sum' ? `${E.unit} 합계로 승부` : E.bag ? (beanbagMode()==='B' ? '5판 점수 합계로 승부 (B안)' : '5판 중 3판 먼저 이기면 승 (A안)') : (TMODES.find(m => m[0]===E.mode) || TMODES[0])[1];
  return how + (E.group ? ` · ${E.group}명씩 한 조` : '') + (E.pts>1 ? ` · 종목을 이기면 ${E.pts}점` : '');
}
function anyRecords(key){ return D.indiv.some(r => r.event===key && !r.deleted) || D.matches.some(m => m.event===key && !m.deleted); }

function eventsTab(){
  const list = allEventList();
  const sw = (data, on, label) => `<label class="switch"><input type="checkbox" ${data} ${on?'checked':''} aria-label="${esc(label)}"><span></span></label>`;
  const row = x => {
    const E = x.E, o = optOfItem(x), hasImg = !!(D.assets['target_'+x.key] || {}).data;
    let opts = '';
    if(x.kind==='team' && E.mode==='duel'){
      opts += `<div class="evopt"><span class="name">과녁판 중계<span class="sub">던진 자리를 과녁 위에 찍어 안내판에 실시간으로 보여 줍니다.</span></span>${sw(`data-ch="evopt" data-v="${x.key}" data-f="board"`, o.board, E.name+' 과녁판 중계')}</div>`;
      if(o.board) opts += `<div class="evtg"><div class="tgthumb">${tgtBox(x.key, { list:[], thumb:true })}</div><div class="evtgb"><button class="btn small" data-a="tgtUpload" data-v="${x.key}">과녁 사진 올리기</button>${hasImg ? `<button class="btn small danger" data-a="tgtDel" data-v="${x.key}">사진 지우기</button>` : '<span class="sub">사진이 없으면 기본 과녁이 나옵니다.</span>'}</div></div>`;
    }
    if(x.kind==='team' && E.scoreFixed)
      opts += `<div class="evopt"><span class="name">대결 점수 기록<span class="sub">${E.agg==='sum' ? `${E.unit} 수로 항상 기록하고, ${E.unit} 합계가 높은 팀이 이깁니다.` : '승부 방식은 명단·설정의 팀·점수 탭에서 A안과 B안 중에 고릅니다. B안일 때는 점수로 기록합니다.'}</span></span></div>`;
    else if(x.kind==='team' && E.mode!=='time')
      opts += `<div class="evopt"><span class="name">대결 점수 기록<span class="sub">승패 단추 대신 두 팀 점수를 넣고, 이긴 쪽은 점수로 정합니다.</span></span>${sw(`data-ch="evopt" data-v="${x.key}" data-f="score"`, o.score, E.name+' 대결 점수 기록')}</div>`;
    return `<div class="evrow ${x.off?'off':''}" style="--ev:${E.color}" data-key="${x.key}">
      <div class="evr1"><span class="evic">${E.icon}</span><span class="name"><b>${esc(E.name)}</b><span class="sub">${esc(evSummary(x))}</span></span>${sw(`data-ch="evon" data-v="${x.key}"`, !x.off, E.name+' 켜기')}</div>
      ${opts}${x.custom ? `<div class="evr3"><button class="btn small" data-a="efEdit" data-v="${x.key}">고치기</button><button class="btn small danger" data-a="efDel" data-v="${x.key}">지우기</button></div>` : ''}</div>`;
  };
  const grp = (kind, title) => `<h3 class="evgh">${title}</h3>${list.filter(x => x.kind===kind).map(row).join('') || '<div class="empty">종목이 없습니다.</div>'}`;
  return `<div class="card"><h2>🏅 종목 켜고 끄기</h2>
    <p class="sub">끈 종목은 모든 화면에서 숨겨집니다. 이미 입력한 기록은 그대로 남아 있다가, 다시 켜면 돌아옵니다.</p>
    ${grp('indiv', '개인전')}${grp('team', '단체전')}
    <button class="btn primary wide" data-a="efNew" style="margin-top:14px">＋ 새 종목 만들기</button></div>`;
}

/* ---------- 새 종목 만들기·고치기 창 ---------- */
function efDraft(kind){
  return { key:'', kind, name:'', icon:'🎲', color:EV_COLORS[0], mode:'buttons', opts:[{ k:'o0', l:'성공', v:'10' }, { k:'o1', l:'실패', v:'0' }],
    unit:'', dir:'high', count:5, lanes:2, prac:false, tmode:'duel', pts:1, board:false, score:false, countTouched:false, at:0, locked:false };
}
function efSheet(){
  const F = EF, isI = F.kind==='indiv', edit = !!F.key;
  const icons = EV_ICONS.map(i => `<button class="chip ic ${F.icon===i?'on':''}" data-a="efSet" data-k="icon" data-v="${i}" aria-label="그림 ${i}">${i}</button>`).join('');
  const colors = EV_COLORS.map((c, i) => `<button class="clr ${F.color===c?'on':''}" style="background:${c}" data-a="efSet" data-k="color" data-v="${c}" aria-label="색 ${i+1}"></button>`).join('');
  const segBtn = (k, v, label, dis) => `<button class="${String(F[k])===String(v)?'on':''}" data-a="efSet" data-k="${k}" data-v="${v}" ${dis?'disabled':''}>${label}</button>`;
  const tog = (k, title, sub) => `<div class="item"><span class="name">${title}<span class="sub">${sub}</span></span><button class="btn small ${F[k]?'ok':''}" data-a="efTog" data-k="${k}" aria-pressed="${!!F[k]}">${F[k]?'켬':'끔'}</button></div>`;
  const stepper = (k, label, lo, hi) => `<div class="row"><span class="grow">${label}</span><div class="stp small"><button class="stpb" data-a="efStep" data-k="${k}" data-d="-1" ${F[k]<=lo?'disabled':''} aria-label="${label} 줄이기">−</button><b class="stv">${F[k]}</b><button class="stpb" data-a="efStep" data-k="${k}" data-d="1" ${F[k]>=hi?'disabled':''} aria-label="${label} 늘리기">＋</button></div></div>`;
  let body;
  if(isI){
    const optRows = F.opts.map((o, i) => `<div class="efopt"><input data-in="efopt" data-i="${i}" data-f="l" value="${esc(o.l)}" placeholder="이름 (예: 성공)" autocomplete="off" aria-label="단추 ${i+1} 이름"><input class="efv" data-in="efopt" data-i="${i}" data-f="v" value="${esc(o.v)}" inputmode="decimal" placeholder="점수" autocomplete="off" aria-label="단추 ${i+1} 점수"><button class="ibtn danger" data-a="efOptDel" data-v="${i}" aria-label="단추 ${i+1} 지우기" ${F.opts.length<=1?'disabled':''}>✕</button></div>`).join('');
    body = `<div class="card"><h3>점수 방식</h3><div class="seg">${segBtn('mode','buttons','점수 단추 합계',F.locked)}${segBtn('mode','number','숫자 직접 입력',F.locked)}</div>
        ${F.locked ? '<p class="sub">이미 기록이 있어서 점수 방식은 바꿀 수 없습니다.</p>' : ''}
        ${F.mode==='buttons'
          ? `<div class="efopts">${optRows}</div>${F.opts.length<8 ? '<button class="btn small" data-a="efOptAdd">＋ 단추 늘리기</button>' : ''}<p class="sub">차례마다 누른 단추의 점수를 더합니다.</p>`
          : `<div class="row" style="margin-top:10px"><label class="grow">단위<input data-in="ef" data-k="unit" value="${esc(F.unit)}" placeholder="예: m, 초, 개" maxlength="4" autocomplete="off"></label></div>
             <h3>좋은 기록</h3><div class="seg">${segBtn('dir','high','높을수록')}${segBtn('dir','low','낮을수록')}</div>
             <p class="sub">차례마다 숫자를 직접 넣고, 차례가 여럿이면 숫자를 모두 더해 순위를 냅니다.</p>`}</div>
      <div class="card">${stepper('count', '차례 수', 1, 10)}<div class="row" style="margin-top:10px"><span class="grow">입력 칸 수</span><div class="seg">${segBtn('lanes',1,'1칸 (타석)')}${segBtn('lanes',2,'2칸 (왼쪽·오른쪽)')}</div></div></div>
      <div class="card">${tog('prac', '연습 회차 사용', '켜면 연습 1·2 입력과 연습 순위가 생깁니다.')}</div>`;
  } else {
    body = `<div class="card"><h3>승부 방식</h3><div class="seg vseg">${TMODES.map(([k,l]) => segBtn('tmode', k, l)).join('')}</div></div>
      <div class="card">${stepper('pts', '종목을 이기면 얻는 승점', 1, 5)}
        ${F.tmode==='duel' ? tog('board', '과녁판 중계 사용', '던진 자리를 과녁 위에 찍어 안내판에 실시간으로 보여 줍니다. 과녁 사진은 종목 탭에서 올립니다.') : ''}
        ${F.tmode!=='time' ? tog('score', '대결 점수도 기록', '승패 단추 대신 두 팀 점수를 넣고, 이긴 쪽은 점수로 정합니다.') : ''}</div>`;
  }
  return `<h2>${edit ? '종목 고치기' : '새 종목 만들기'}</h2>
    <div class="card"><label>이름<input id="efName" data-in="ef" data-k="name" value="${esc(F.name)}" placeholder="예: 농구 자유투" maxlength="12" autocomplete="off"></label>
      <h3>종류</h3><div class="seg">${segBtn('kind','indiv','개인전',edit)}${segBtn('kind','team','단체전',edit)}</div>
      <h3>그림</h3><div class="chips icons">${icons}</div><h3>색</h3><div class="clrs">${colors}</div>
      <div class="efprev" style="--ev:${F.color}"><span>${F.icon}</span><b>${esc(F.name || '종목 이름')}</b></div></div>
    ${body}
    <div class="row"><button class="btn primary grow" data-a="efSave">저장</button><button class="btn grow" data-a="closeSheet">닫기</button></div>`;
}
function efValidate(){
  const F = EF, name = String(F.name || '').trim();
  if(!name) return '종목 이름을 적어 주세요.';
  if(allEventList().some(x => x.key!==F.key && x.E.name===name)) return '같은 이름의 종목이 이미 있습니다. 다른 이름을 적어 주세요.';
  if(F.kind==='indiv' && F.mode==='buttons'){
    if(!F.opts.length) return '점수 단추를 하나 이상 만들어 주세요.';
    for(const o of F.opts){
      if(!String(o.l).trim()) return '점수 단추의 이름을 모두 적어 주세요.';
      if(String(o.v).trim()==='' || isNaN(Number(String(o.v).replace(',', '.')))) return '점수 단추의 점수를 숫자로 적어 주세요.';
    }
  }
  return '';
}
function efDef(){
  const F = EF, base = { kind:F.kind, name:String(F.name).trim(), icon:F.icon, color:F.color, at:F.at || now(), deleted:false };
  if(F.kind==='indiv'){
    const buttons = F.mode==='buttons';
    return { ...base, mode:F.mode, opts: buttons ? F.opts.map(o => ({ k:o.k, l:String(o.l).trim(), v:Number(String(o.v).replace(',', '.')) })) : [],
      unit: buttons ? '' : String(F.unit||'').trim().slice(0, 4), dir:F.dir==='low' ? 'low' : 'high', count:F.count, lanes:F.lanes===2 ? 2 : 1, prac:!!F.prac };
  }
  return { ...base, tmode:F.tmode, pts:F.pts, board: F.tmode==='duel' && !!F.board, score: F.tmode!=='time' && !!F.score };
}

function setEvOn(key, on){
  if(!can.master()){ denied(); render(); return; }
  if(!on && allEventList().filter(x => !x.off && x.key!==key).length===0){ toast('종목을 모두 끌 수는 없습니다. 하나는 켜 두어야 합니다.'); render(); return; }
  setConfig({ events:{ off:{ [key]: !on } } });
}
function setEvOpt(key, field, val){
  if(!can.master()){ denied(); render(); return; }
  const x = allEventList().find(y => y.key===key); if(!x) return;
  setConfig(x.E.custom ? { events:{ custom:{ [key]:{ [field]: val } } } } : { events:{ opt:{ [key]:{ [field]: val } } } });
}
document.addEventListener('change', e => {
  const el = e.target;
  if(el.dataset.ch==='evon') setEvOn(el.dataset.v, el.checked);
  else if(el.dataset.ch==='evopt') setEvOpt(el.dataset.v, el.dataset.f, el.checked);
});
document.addEventListener('input', e => {
  const el = e.target; if(!EF) return;
  if(el.dataset.in==='ef') EF[el.dataset.k] = el.value;
  else if(el.dataset.in==='efopt'){ const o = EF.opts[+el.dataset.i]; if(o) o[el.dataset.f] = el.value; }
});

Object.assign(ACT, {
  efNew: () => { if(!can.master()) return denied(); EF = efDraft('indiv'); openSheet(efSheet); return false; },
  efEdit: (el, v) => {
    if(!can.master()) return denied();
    const d = (((D.config.events||{}).custom)||{})[v]; if(!d) return false;
    EF = { ...efDraft(d.kind), key:v, kind:d.kind, name:d.name, icon:d.icon||'🎲', color:d.color||EV_COLORS[0], mode:d.mode||'buttons',
      opts: (d.opts||[]).map(o => ({ k:o.k, l:o.l, v:String(o.v) })), unit:d.unit||'', dir:d.dir||'high', count:d.count||5, lanes:d.lanes===2 ? 2 : 1, prac:!!d.prac,
      tmode:d.tmode||'duel', pts:d.pts||1, board:!!d.board, score:!!d.score, countTouched:true, at:d.at||0, locked: d.kind==='indiv' && anyRecords(v) };
    if(!EF.opts.length) EF.opts = efDraft('indiv').opts;
    openSheet(efSheet); return false;
  },
  efSet: (el, v) => {
    const k = el.dataset.k;
    if(k==='lanes' || k==='count' || k==='pts') EF[k] = +v;
    else if(k==='kind'){ if(EF.key) return false; const keep = { name:EF.name, icon:EF.icon, color:EF.color }; EF = { ...efDraft(v), ...keep }; }
    else EF[k] = v;
    // 숫자 직접 입력은 보통 한 번만 재므로 차례 수 기본값을 1로 (사용자가 차례 수를 직접 바꾸기 전까지만)
    if(k==='mode' && !EF.countTouched) EF.count = v==='number' ? 1 : 5;
    if(k==='tmode' && v!=='duel') EF.board = false;
    if(k==='tmode' && v==='time') EF.score = false;
    drawSheet(); return false;
  },
  efTog: (el) => { EF[el.dataset.k] = !EF[el.dataset.k]; drawSheet(); return false; },
  efStep: (el) => { const k = el.dataset.k, lim = k==='pts' ? [1,5] : [1,10]; EF[k] = Math.max(lim[0], Math.min(lim[1], EF[k] + (+el.dataset.d))); if(k==='count') EF.countTouched = true; drawSheet(); return false; },
  efOptAdd: () => { if(EF.opts.length >= 8) return false; let n = EF.opts.length; while(EF.opts.some(o => o.k==='o'+n)) n++; EF.opts.push({ k:'o'+n, l:'', v:'0' }); drawSheet(); return false; },
  efOptDel: (el, v) => { if(EF.opts.length <= 1) return false; EF.opts.splice(+v, 1); drawSheet(); return false; },
  efSave: async () => {
    if(!can.master()) return denied();
    const err = efValidate(); if(err){ toast(err); return false; }
    const key = EF.key || 'c' + uid();
    if(await setConfig({ events:{ custom:{ [key]: efDef() } } })){ closeSheet(); toast(`${String(EF.name).trim()} 종목을 ${EF.key ? '고쳤' : '만들었'}습니다.`); }
    return false;
  },
  efDel: async (el, v) => {
    if(!can.master()) return denied();
    const d = (((D.config.events||{}).custom)||{})[v]; if(!d) return false;
    if(!(await ask(`${d.name} 종목을 지울까요?\n이미 입력한 기록은 남지만 화면에는 보이지 않습니다.`, '지우기', true))) return false;
    if(!allEventList().some(x => !x.off && x.key!==v)){ toast('종목을 모두 지울 수는 없습니다. 하나는 켜 두어야 합니다.'); return false; }
    setConfig({ events:{ custom:{ [v]:{ deleted:true } } } }); return false;
  },
});
