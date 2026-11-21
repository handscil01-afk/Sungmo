'use strict';
/* ===================== 화면 보며 하기: 내 전적 · 순위표 =====================
   화면 정의는 js/rank.js 그대로. 한 화면 카드(위 요약 · 가운데 쪽 넘기기 목록 · 아래 같은 크기 단추) */
const rkOpt = (S, k) => hubOpt(S, k);
const rkEmpty = (ico, text) => `<div class="ar-empty panel rk-empty">${hubIco(ico)}<p>${esc(text)}</p></div>`;
// 아래 단추 줄: [옵션, 아이콘, 이름]
const rkBtns = list => { const l = list.filter(x => x[0]); return l.length ? `<div class="rk-act">${hubBtns(l, l.length)}</div>` : ''; };

/* ---------- 내 전적 ---------- */
function rkMeSkin(S){
  const t = rkTotals(), g = t.w + t.l + t.d, tab = RK.tab === 'vs' ? 'vs' : 'recent';
  const sum = `<div class="ar-sum rk-sum"><span><b>${t.w}</b><small>승</small></span><span><b>${t.l}</b><small>패</small></span><span><b>${t.d}</b><small>무</small></span>
    <span><b>${t.server ? t.r : '-'}</b><small>${t.server && t.rank ? `점수 · ${t.rank}위` : '점수'}</small></span></div>`;
  const tabs = `<div class="ld-tabs rk-tabs">${['recent', 'vs'].map(k => rkOpt(S, k)).filter(Boolean).map(o => `<button type="button" class="${o.key === tab ? 'on' : ''}" data-sk="opt" data-n="${o.n}" aria-pressed="${o.key === tab}">${esc(o.t)}</button>`).join('')}</div>`;
  let body;
  if(tab === 'recent'){
    const h = rkHist();
    body = h.length ? `<div class="pg ar-list rk-list">${h.map(m => { const r = rkRes(m), cls = r === '승' ? 'w' : r === '패' ? 'l' : 'd';
      let T = null; try{ T = teamInfo(m.mt); }catch(e){}
      return `<div class="pg-r arc rk-m"${T ? ` style="--tc:${T.color}"` : ''}>${T ? emb(T, 'big') : ''}<span class="arc-tx"><small>${esc(rkDate(m.at))} · ${esc(m.on)}</small><b>${esc(rkTeam(m.mt))} ${m.ms} : ${m.os} ${esc(rkTeam(m.ot))}</b></span><span class="rk-wl ${cls}">${r}</span></div>`; }).join('')}${pgNav()}</div>`
      : rkEmpty('score', '아직 끝까지 마친 온라인 경기가 없습니다.');
  } else {
    const vs = rkVsList();
    body = vs.length ? `<div class="pg ar-list rk-list">${vs.map(v => `<div class="pg-r arc rk-v"><span class="rk-av" aria-hidden="true">${esc(String(v.n).slice(0, 1))}</span><span class="arc-tx"><small>${v.at ? `최근 ${esc(rkDate(v.at))}` : '상대'}</small><b>${esc(v.n)}</b></span><strong class="arc-big rk-big">${esc(rkWLD(v))}</strong></div>`).join('')}${pgNav()}</div>`
      : rkEmpty('chat', '아직 겨뤄 본 상대가 없습니다.');
  }
  const note = !t.server && g && RK.err ? `<p class="rk-err">${esc(RK.err)}</p>` : rkQ().length ? `<p class="rk-err">서버에 올리지 못한 경기 ${rkQ().length}개 · 연결되면 올립니다</p>` : '';
  return `${sum}${tabs}${body}${note}${rkBtns([[rkOpt(S, 'top'), 'stand', '순위표'], [rkOpt(S, 'reload'), 'again', '새로 고침'], [rkOpt(S, 'back'), 'back', '돌아가기']])}`;
}

/* ---------- 순위표 ---------- */
function rkTopSkin(S){
  const T = RK.top, uid = RK.uid;
  const row = (p, i, pin) => `<div class="${pin ? '' : 'pg-r '}rk-row${p.uid === uid ? ' me' : ''}${pin ? ' pin' : ''}${i < 3 && !pin ? ' t' + (i + 1) : ''}"><i class="rk-n">${pin ? (RK.rank || '-') : i + 1}</i><b>${esc(p.name)}${p.uid === uid ? ' <em>나</em>' : ''}</b><small>${esc(rkWLD(p))}</small><strong>${p.r}</strong></div>`;
  let body;
  if(!T) body = rkEmpty('stand', '순위표를 불러오는 중입니다…');
  else if(T.err) body = rkEmpty('exit', T.err);
  else if(!T.list.length) body = rkEmpty('stand', '아직 순위표에 아무도 없습니다. 온라인 대전을 끝까지 하면 올라갑니다.');
  else {
    const mine = T.list.some(p => p.uid === uid);
    body = `<div class="pg panel rk-board">${T.list.map((p, i) => row(p, i)).join('')}${pgNav()}</div>${!mine && RK.me ? row({ ...RK.me, uid }, 0, true) : ''}`;
  }
  return `${body}${rkBtns([[rkOpt(S, 'reload'), 'again', '새로 고침'], [rkOpt(S, 'me'), 'me', '내 전적'], [rkOpt(S, 'back'), 'back', '돌아가기']])}`;
}
Object.assign(CAREER_SK, { 'rk-me':rkMeSkin, 'rk-top':rkTopSkin });
