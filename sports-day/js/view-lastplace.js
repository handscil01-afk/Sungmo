'use strict';
/* ===================== 뒤에서 1등 후보 (마스터 안내판 메뉴 > 시상식 탭 전용) =====================
   팀별로, 불참이 아닌 선수마다 개인전 종목들의 본선 순위(standings 의 rank, 공동 순위 그대로)를 더한 '등수 합'을 계산함.
   본선 기록이 없는 종목은 그 종목 참가자(불참 제외 선수) 수 + 1 등으로 치고 '기록 없음'으로 표시함.
   등수 합이 가장 큰 사람이 후보(같으면 모두). 안내판 화면·음성·보고서에는 넣지 않음 */
function lastPlaceData(){
  const evs = Object.keys(INDIV), act = people().filter(p => !isAbsent(p.id));
  const rk = {};                                   // 종목 → 사람 id → 본선 순위
  evs.forEach(ev => { rk[ev] = {}; standings(ev).list.forEach(x => { rk[ev][x.p.id] = x.rank; }); });
  const out = {};
  TEAM_KEYS.forEach(team => {
    const rows = act.filter(p => p.team===team).map(p => {
      const per = evs.map(ev => { const r = rk[ev][p.id]; return r != null ? { ev, rank:r, none:false } : { ev, rank:act.length + 1, none:true }; });
      return { p, per, sum: per.reduce((s, x) => s + x.rank, 0), nNone: per.filter(x => x.none).length };
    }).sort((a, b) => b.sum - a.sum || byName(a.p, b.p));
    const top = rows.length ? rows[0].sum : 0;
    rows.forEach(r => { r.cand = r.sum===top; });
    out[team] = { rows, cands: rows.filter(r => r.cand), recorded: rows.some(r => r.nNone < evs.length) };
  });
  return out;
}
function lastPlaceCard(){
  const evs = Object.keys(INDIV);
  if(!evs.length) return '';
  const data = lastPlaceData();
  const col = team => {
    const d = data[team], show = d.rows.slice(0, Math.min(6, Math.max(3, d.cands.length))), more = d.cands.length - show.filter(r => r.cand).length;
    const body = !d.rows.length ? '<div class="empty">이 팀에 불참이 아닌 선수가 없습니다.</div>'
      : !d.recorded ? '<div class="empty">아직 본선 기록이 없습니다.</div>'
      : show.map(r => `<div class="item lpitem${r.cand ? ' cand' : ''}">${teamBadge(team)}<span class="name">${esc(r.p.name)}<span class="sub">${r.per.map(x => `${esc(INDIV[x.ev].name)} ${x.none ? '기록 없음' : x.rank + '등'}`).join(' · ')}</span></span>
          <span class="tag ${r.cand ? 'dark' : ''}">등수 합 ${r.sum}</span>${r.cand ? '<span class="tag warn">후보</span>' : ''}</div>`).join('') + (more > 0 ? `<div class="sub" style="padding:8px 6px">같은 등수 합인 후보가 ${more}명 더 있습니다.</div>` : '');
    return `<div class="lpcol"><h3>${teamBadge(team)} ${esc(teamName(team))}</h3><div class="list">${body}</div></div>`;
  };
  return `<div class="card lpcard"><h2>뒤에서 1등 후보 <span class="sub">(안내판에는 나오지 않음)</span></h2>
    <p class="sub">세 종목 본선 등수를 더해 팀에서 가장 뒤인 사람입니다. 기록이 없는 종목은 참가자 수보다 한 등 뒤로 셉니다.</p>
    <div class="lpgrid">${TEAM_KEYS.map(col).join('')}</div></div>`;
}
