/* 기안 도우미 화면 */
(function () {
  'use strict';
  const S = GSTORE, D = GDICT;
  /* ---------- 작은 도구 ---------- */
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v;
      else if (k === 'checked') e.checked = !!v;
      else if (k === 'style') e.setAttribute('style', v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    add(e, kids);
    return e;
  }
  const ap = (e, ...kids) => add(e, kids);
  function add(e, kids) { for (const k of kids) { if (k == null || k === false) continue; if (Array.isArray(k)) add(e, k); else e.append(k.nodeType ? k : document.createTextNode(String(k))); } }
  const fmt = n => (n == null || isNaN(n)) ? '' : Math.round(n).toLocaleString('ko-KR');
  const won = n => (n == null || isNaN(n)) ? '' : fmt(n) + '원';
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const pathText = p => String(p || '').split('/').join(' / ');
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 무시 */ } }
  };
  const SET = Object.assign({ tab: 'home', autoFull: true, installDismissed: false, year: new Date().getFullYear(), fund: '보조금', sub: '지역사회체험활동', ptab: 'plan' }, LS.get('gian-set', {}));
  const saveSet = () => LS.set('gian-set', SET);
  const PILOT = '지역사회체험활동';

  function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200); }
  function modal(title, body, buttons, wide) {
    const back = h('div', { class: 'dim' });
    const close = () => back.remove();
    const box = h('div', { class: 'dlg' + (wide ? ' wide' : ''), role: 'dialog' }, h('h3', { text: title }), h('div', { class: 'dlg-body' }, body),
      h('div', { class: 'dlg-btns' }, (buttons || [{ text: '닫기' }]).map(b => h('button', { class: 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''), onclick: () => { if (b.onclick) { if (b.onclick(close) === false) return; } close(); } }, b.text))));
    back.append(box); back.addEventListener('click', e => { if (e.target === back) close(); });
    document.body.append(back);
    return close;
  }
  const ask = (title, text, okText, fn, danger) => modal(title, h('p', { text }), [{ text: '취소' }, { text: okText, primary: !danger, danger, onclick: fn }]);
  async function copy(text) { try { await navigator.clipboard.writeText(text); toast('복사했습니다'); } catch (e) { modal('복사', h('textarea', { class: 'copyarea', value: text, rows: 12 })); } }
  function download(name, text) { const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name }); document.body.append(a); a.click(); a.remove(); }

  /* ---------- 설치·전체화면 ---------- */
  const inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  const isStandalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true || (matchMedia('(display-mode: fullscreen)').matches && !(document.fullscreenElement || document.webkitFullscreenElement)); } catch (e) { return false; } };
  const FS = {
    userExit: false,
    supported() { const d = document.documentElement; return !!(d.requestFullscreen || d.webkitRequestFullscreen) && !isStandalone() && !inFrame; },
    on() { return !!(document.fullscreenElement || document.webkitFullscreenElement); },
    enter() { const d = document.documentElement; try { const r = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : (d.webkitRequestFullscreen && d.webkitRequestFullscreen()); if (r && r.catch) r.catch(() => {}); } catch (e) { /* 무시 */ } },
    exit() { try { const r = document.exitFullscreen ? document.exitFullscreen() : (document.webkitExitFullscreen && document.webkitExitFullscreen()); if (r && r.catch) r.catch(() => {}); } catch (e) { /* 무시 */ } },
    toggle() { if (!FS.supported()) { installHelp(); return; } if (FS.on()) { FS.userExit = true; FS.exit(); } else { FS.userExit = false; FS.enter(); } }
  };
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
  window.addEventListener('appinstalled', () => { installEvt = null; SET.installDismissed = true; saveSet(); render(); toast('홈 화면에 설치했습니다'); });
  function installHelp() {
    if (installEvt) {
      const ev = installEvt; installEvt = null;
      try { ev.prompt(); ev.userChoice.then(r => { if (r && r.outcome === 'accepted') { SET.installDismissed = true; saveSet(); render(); } }).catch(() => {}); return; } catch (e) { /* 아래 안내 */ }
    }
    modal('홈 화면에 설치하기', h('div', { class: 'help' },
      h('p', { text: '설치하면 바탕화면·홈 화면에서 앱처럼 바로 열리고, 화면을 넓게 씁니다.' }),
      h('ul', null,
        h('li', { text: 'PC 크롬·엣지: 주소창 오른쪽의 설치 아이콘(모니터에 화살표)을 누르거나, ⋮ 메뉴 → 앱 → 이 사이트를 앱으로 설치' }),
        h('li', { text: '아이패드·아이폰 Safari: 공유 버튼 → 홈 화면에 추가' }),
        h('li', { text: '안드로이드 크롬: ⋮ 메뉴 → 홈 화면에 추가(앱 설치)' }),
        h('li', { text: '삼성 인터넷: ≡ 메뉴 → 현재 페이지 추가 → 홈 화면' })),
      inFrame ? h('p', { class: 'muted', text: '지금은 다른 화면 안에 들어 있어서 전체화면을 쓸 수 없습니다. 주소를 새 창으로 열어 설치해 주세요.' }) : null));
  }
  document.addEventListener('fullscreenchange', () => renderHeader());
  document.addEventListener('webkitfullscreenchange', () => renderHeader());
  document.addEventListener('pointerdown', e => {
    if (!SET.autoFull || FS.userExit || FS.on() || !FS.supported()) return;
    if (e.target.closest('[data-nofs]') || e.target.closest('input[type=file]')) return;
    FS.enter();
  }, true);

  /* ---------- 예산 계산 ---------- */
  const B = {
    versions(year, fund) { return S.data.budgets.filter(b => b.year === year && b.fund === fund).sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.at - b.at); },
    first(vs) { return vs.find(v => v.kind === '당초 예산') || vs[0] || null; },
    cur(vs) { return vs[vs.length - 1] || null; },
    settle(vs) { const s = vs.filter(v => v.kind === '결산'); return s[s.length - 1] || null; },
    leafPaths(year, fund) {
      const v = B.cur(B.versions(year, fund));
      if (!v) return (D.BUILTIN_ACCTS[fund] || []).slice();
      return v.expense.filter(n => n.level === 4).map(n => n.path.join('/'));
    },
    accountsAll(year) { const o = {}; for (const f of ['보조금', '자부담']) o[f] = B.leafPaths(year, f); return o; },
    node(v, path) { return v ? v.expense.find(n => n.path.join('/') === path) : null; },
    /* 결산 기준일 뒤에 이 앱에 적은 지출 합(경로 앞부분이 같으면 포함) */
    appSpent(year, fund, prefix, after) {
      let s = 0;
      for (const P of projectsOf(year)) {
        const lines = allLines(P);
        for (const d of allDocs(P)) {
          if (after && (d.date || '') <= after) continue;
          for (const lid in (d.spends || {})) {
            const ln = lines[lid]; if (!ln || ln.fund !== fund) continue;
            if ((ln.acct + '/').startsWith(prefix + '/') || ln.acct === prefix) s += +d.spends[lid] || 0;
          }
          for (const e of d.extra || []) if (e.fund === fund && ((e.acct + '/').startsWith(prefix + '/') || e.acct === prefix)) s += +e.amount || 0;
        }
      }
      return s;
    },
    status(year, fund, path) {
      const vs = B.versions(year, fund); const cur = B.cur(vs), st = B.settle(vs);
      const n = B.node(cur, path); if (!n) return null;
      const settled = st ? ((B.node(st, path) || {}).cum || 0) : 0;
      const after = B.appSpent(year, fund, path, st ? st.date : null);
      return { budget: n.budget || 0, settled, after, spent: settled + after, remain: (n.budget || 0) - settled - after, date: st ? st.date : null };
    }
  };
  const projectsOf = year => Object.values(S.data.projects).filter(p => p.year === year);
  function allLines(P) { const o = {}; for (const v of P.versions) for (const l of v.lines) o[l.id] = l; return o; }

  /* ---------- 사업 데이터 ---------- */
  function proj(year, sub, create) {
    const key = year + '|' + sub;
    let P = S.data.projects[key];
    if (!P && create) {
      P = S.data.projects[key] = { key, year, sub, unit: D.unitOf(sub), accts: {}, versions: [], rounds: [] };
      for (const f of ['보조금', '자부담']) { const m = (D.ACCT_MAP[f] || {})[sub]; if (m && B.leafPaths(year, f).includes(m)) P.accts[f] = m; }
    }
    return P || null;
  }
  const baseVer = P => { const c = P.versions.filter(v => v.status === '확정'); return c[c.length - 1] || P.versions[P.versions.length - 1] || null; };
  const prevConfirmed = (P, v) => { const i = P.versions.indexOf(v); for (let k = i - 1; k >= 0; k--) if (P.versions[k].status === '확정') return P.versions[k]; return null; };
  function qtyProduct(q) { const ns = String(q || '').match(/\d+(?:\.\d+)?/g); return ns ? ns.reduce((a, b) => a * +b, 1) : 1; }
  const lineAmount = l => Math.round((+l.price || 0) * qtyProduct(l.qty));
  const sumLines = (v, f) => v ? v.lines.filter(l => !f || f(l)).reduce((a, l) => a + lineAmount(l), 0) : 0;
  function ensureRounds(P) {
    const v = baseVer(P); if (!v) return;
    for (const s of v.schedule || []) if (!P.rounds.some(r => r.n === s.n)) P.rounds.push({ id: uid(), n: s.n, docs: [] });
    P.rounds.sort((a, b) => a.n - b.n);
  }
  const schedOf = (P, n) => { const v = baseVer(P); return v ? (v.schedule || []).find(s => s.n === n) || null : null; };
  const docSpend = d => Object.values(d.spends || {}).reduce((a, b) => a + (+b || 0), 0) + (d.extra || []).reduce((a, x) => a + (+x.amount || 0), 0);
  const roundSpend = r => r.docs.filter(d => d.kind !== '결과보고').reduce((a, d) => a + docSpend(d), 0);
  const allDocs = P => P.rounds.flatMap(r => r.docs).concat(P.pdocs || []);
  const lineSpent = (P, lid) => allDocs(P).reduce((b, d) => b + (+((d.spends || {})[lid]) || 0), 0);
  const PERSON_SUBS = ['개별자립지원', '개별동료상담', '자립생활프로그램'];
  const isPerson = P => PERSON_SUBS.includes(P.sub);
  const isCourse = P => P.sub === '자립생활프로그램'; // 교육(강좌)별, 월별 강사비는 공통
  const runit = r => r.n + (r.unit || '차'); // 1차 · 3회기 · 2분기
  const SETTLE_KINDS = ['진행비', '다과비', '식비', '재료비', '숙박비']; // 물품구입비는 정산서 대신 물품검수조서
  const isRefund = d => /여입|반납|반환/.test(d.title || '');
  function attendees(d) { return String(d && d.attend || '').split(/[\n,，、]/).map(s => s.trim()).filter(Boolean); }

  /* ---------- 머리줄 ---------- */
  const TABS = [['home', '처음'], ['budget', '예산'], ['proj', '사업'], ['review', '기안 검수'], ['guide', '작성 안내'], ['set', '설정']];
  function renderHeader() {
    const hd = document.getElementById('hdr'); hd.textContent = '';
    ap(hd, h('div', { class: 'brand' }, h('img', { src: 'icon-192.png', alt: '' }), h('b', { text: '기안 도우미' })),
      h('nav', { class: 'tabs' }, TABS.map(([k, t]) => h('button', { class: 'tab' + (SET.tab === k ? ' on' : ''), onclick: () => { SET.tab = k; saveSet(); render(); } }, t))),
      FS.supported() || !isStandalone() ? h('button', { class: 'icon', 'data-nofs': '', title: FS.on() ? '전체화면 끝내기' : '전체화면', onclick: FS.toggle, text: FS.on() ? '⤡' : '⤢' }) : null);
  }
  function render() {
    renderHeader();
    const m = document.getElementById('main'); m.textContent = '';
    const view = { home: homeView, budget: budgetView, proj: projView, review: reviewView, guide: guideView, set: setView }[SET.tab] || homeView;
    m.append(view());
  }
  const save = () => { S.save(); };

  /* ---------- 처음 화면 ---------- */
  function installBanner() {
    if (SET.installDismissed || isStandalone() || inFrame) return null;
    return h('div', { class: 'banner' }, h('span', { text: '홈 화면(바탕화면)에 설치하면 앱처럼 바로 열립니다.' }),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', 'data-nofs': '', onclick: installHelp }, '설치하기'), h('button', { class: 'btn', 'data-nofs': '', onclick: FS.toggle }, '전체화면'),
        h('button', { class: 'btn', 'data-nofs': '', onclick: () => { SET.installDismissed = true; saveSet(); render(); } }, '다음에')));
  }
  function homeView() {
    const y = SET.year;
    const nb = S.data.budgets.filter(b => b.year === y).length;
    const P = proj(y, PILOT, false);
    return h('div', { class: 'page' }, installBanner(),
      h('h2', { text: '기안 도우미' }),
      h('p', { class: 'muted', text: '사업계획에서 결과보고·실적까지 이어서 관리하고, 기안을 규칙대로 검수합니다. 모든 내용은 이 PC와 연결한 폴더에만 저장하고 인터넷으로 보내지 않습니다.' }),
      h('div', { class: 'cards' },
        folderCard(),
        card('기안 검수', '한글 파일을 넣으면 요일·계산·합계·계정과목·연도·다른 사업 이름·붙임 번호를 바로 확인합니다. 간사 누구나 쓸 수 있습니다.', '검수하기', () => go('review')),
        card('예산', nb ? y + '년 예산서 ' + nb + '개를 불러왔습니다. 보조금·자부담 별로 당초·변경·집행·남은 예산을 봅니다.' : '회계 프로그램에서 내려받은 예산서(.xls)를 불러오면 계정과목과 남은 예산을 관리합니다.', nb ? '예산 보기' : '예산서 불러오기', () => go('budget')),
        card('시범 사업: ' + PILOT, P && P.versions.length ? '계획 ' + P.versions.length + '개 버전, 회차 ' + P.rounds.length + '개' : '사업계획을 넣으면 회차 기안·잔액·실적이 이어집니다.', '사업 열기', () => { SET.sub = PILOT; go('proj'); }),
        card('저장 위치', S.dir ? (S.perm === 'granted' ? '‘' + S.dir.name + '’ 폴더에 저장 중' : '‘' + S.dir.name + '’ 폴더 다시 연결 필요') : '아직 이 PC 브라우저에만 저장합니다. 시놀로지의 ‘기안도우미’ 폴더를 연결해 주세요.', S.dir && S.perm !== 'granted' ? '다시 연결' : '설정', () => (S.dir && S.perm !== 'granted') ? reconnect() : go('set'))),
      isStandalone() || inFrame ? null : h('div', { class: 'row end' }, h('button', { class: 'btn', 'data-nofs': '', onclick: installHelp }, '홈 화면에 설치하기')));
  }
  function folderCard() {
    const need = ROOT.h && ROOT.perm !== 'granted';
    return h('div', { class: 'card' }, h('h3', { text: '기안 폴더 자동 읽기' }),
      h('p', { text: ROOT.h ? scanStatus() : '‘손잡다’ 폴더를 한 번 연결하면, 앱을 열 때마다 연도 폴더의 내부기안·예산서를 읽어 사업 계획·회차 기안·예산을 채웁니다. 폴더는 읽기만 합니다.' }),
      h('div', { class: 'row wrap' },
        !ROOT.h ? h('button', { class: 'btn primary', 'data-nofs': '', onclick: () => S.dir ? linkRoot() : linkFolder() }, '‘손잡다’ 폴더 연결') : null,
        need ? h('button', { class: 'btn primary', 'data-nofs': '', onclick: reconnect }, '다시 연결') : null,
        ROOT.h && !need ? h('button', { class: 'btn', 'data-nofs': '', disabled: ROOT.busy ? 'disabled' : null, onclick: () => runScan(true) }, '지금 다시 읽기') : null,
        ROOT.last ? h('button', { class: 'btn', onclick: scanReport }, '읽은 결과' + (ROOT.last.rep.notes.length ? ' (확인 ' + ROOT.last.rep.notes.length + ')' : '')) : null));
  }
  const card = (t, d, b, fn) => h('div', { class: 'card' }, h('h3', { text: t }), h('p', { text: d }), h('button', { class: 'btn primary', onclick: fn }, b));
  const go = t => { SET.tab = t; saveSet(); render(); window.scrollTo(0, 0); };

  /* ---------- 예산 ---------- */
  function yearSel(onch) {
    const ys = new Set([SET.year, new Date().getFullYear()]); S.data.budgets.forEach(b => ys.add(b.year)); Object.values(S.data.projects).forEach(p => ys.add(p.year));
    return h('select', { class: 'fld', onchange: e => { SET.year = +e.target.value; saveSet(); (onch || render)(); } }, [...ys].sort().map(y => h('option', { value: y, selected: y === SET.year ? 'selected' : null }, y + '년')));
  }
  function budgetView() {
    const y = SET.year, f = SET.fund;
    const vs = B.versions(y, f), first = B.first(vs), cur = B.cur(vs), st = B.settle(vs);
    const pick = h('input', { type: 'file', accept: '.xls', multiple: true, class: 'hide', onchange: e => importXls([...e.target.files]) });
    const top = h('div', { class: 'toolbar' }, yearSel(),
      h('div', { class: 'seg' }, ['보조금', '자부담'].map(x => h('button', { class: SET.fund === x ? 'on' : '', onclick: () => { SET.fund = x; saveSet(); render(); } }, x))),
      h('button', { class: 'btn primary', 'data-nofs': '', onclick: () => pick.click() }, '예산서(.xls) 불러오기'), pick);
    const page = h('div', { class: 'page' }, h('h2', { text: '예산 · ' + f }), top);
    if (!vs.length) {
      ap(page, h('div', { class: 'empty' }, h('p', { text: y + '년 ' + f + ' 예산서가 아직 없습니다.' }),
        h('p', { class: 'muted', text: '회계 프로그램에서 내려받은 예산서·추경(변경 전/후)·결산 파일(.xls)을 불러와 주세요. 보조금과 자부담은 따로 관리합니다.' })));
      return page;
    }
    ap(page, h('div', { class: 'chips' }, vs.map(v => h('span', { class: 'vchip' + (v === cur ? ' cur' : '') },
      h('b', { text: v.kind }), ' ' + (v.date || '') + (v.label ? ' · ' + v.label : ''),
      h('button', { class: 'x', title: '지우기', onclick: () => ask('예산서 지우기', '‘' + v.kind + ' ' + (v.date || '') + '’을(를) 지웁니다.', '지우기', () => { S.data.budgets = S.data.budgets.filter(b => b !== v); save(); render(); }, true) }, '×')))));
    ap(page, h('p', { class: 'muted small', text: '현재 예산은 가장 최근 예산서(' + cur.kind + ' ' + (cur.date || '') + ') 기준입니다. ' + (st ? '집행은 ' + st.date + ' 결산 연누계에 그 뒤 이 앱에 적은 지출 기안을 더했습니다.' : '결산 파일을 불러오면 집행액이 들어갑니다. 지금은 이 앱에 적은 지출 기안만 셉니다.') }));
    const firstMap = new Map(first.expense.map(n => [n.path.join('/'), n]));
    const tb = h('tbody');
    for (const n of cur.expense) {
      const k = n.path.join('/'), o = firstMap.get(k);
      const settled = st ? ((B.node(st, k) || {}).cum || 0) : 0;
      const after = B.appSpent(y, f, k, st ? st.date : null);
      const spent = settled + after, remain = (n.budget || 0) - spent, diff = o ? (n.budget || 0) - (o.budget || 0) : null;
      tb.append(h('tr', { class: 'lv' + n.level + (diff ? ' changed' : '') + (!o ? ' added' : '') },
        h('td', { class: 'acct', style: 'padding-left:' + (6 + (n.level - 1) * 14) + 'px', title: pathText(k) }, n.name, !o && first !== cur ? h('span', { class: 'tag', text: '새 계정' }) : null),
        h('td', { class: 'num', text: o ? fmt(o.budget) : '-' }), h('td', { class: 'num', text: fmt(n.budget) }),
        h('td', { class: 'num ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : ''), text: diff ? (diff > 0 ? '+' : '') + fmt(diff) : '' }),
        h('td', { class: 'num', text: settled ? fmt(settled) : '' }), h('td', { class: 'num', text: after ? fmt(after) : '' }),
        h('td', { class: 'num strong' + (remain < 0 ? ' neg' : ''), text: fmt(remain) }),
        h('td', { class: 'num', text: n.budget ? Math.round(spent / n.budget * 100) + '%' : '' })));
    }
    const gone = first.expense.filter(n => !cur.expense.some(c => c.path.join('/') === n.path.join('/')));
    ap(page, h('div', { class: 'twrap' }, h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, ['계정과목', '당초', '현재 예산', '증감', '결산 집행' + (st ? '(' + st.date.slice(5) + ')' : ''), '이후 기안', '남은 예산', '집행률'].map(t => h('th', { text: t })))), tb)));
    if (gone.length) ap(page, h('p', { class: 'warnline', text: '당초에만 있고 지금 예산서에는 없는 계정: ' + gone.map(n => pathText(n.path.join('/'))).join(', ') }));
    if (cur.income && cur.income.length) {
      const fi = new Map((first.income || []).map(n => [n.path.join('/'), n]));
      ap(page, h('h3', { text: '세입' }), h('div', { class: 'twrap' }, h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, ['계정과목', '당초', '현재', '증감'].map(t => h('th', { text: t })))),
        h('tbody', null, cur.income.map(n => { const o = fi.get(n.path.join('/')), d = o ? (n.budget || 0) - (o.budget || 0) : null; return h('tr', { class: 'lv' + n.level + (d ? ' changed' : '') }, h('td', { class: 'acct', style: 'padding-left:' + (6 + (n.level - 1) * 14) + 'px', text: n.name }), h('td', { class: 'num', text: o ? fmt(o.budget) : '-' }), h('td', { class: 'num', text: fmt(n.budget) }), h('td', { class: 'num', text: d ? (d > 0 ? '+' : '') + fmt(d) : '' })); })))));
    }
    return page;
  }
  async function importXls(files) {
    const items = [];
    for (const file of files) {
      try {
        const sheets = GXLS.readBiff(new Uint8Array(await file.arrayBuffer()));
        const parsed = GXLS.parseBudget(sheets);
        if (!parsed.length) { toast(file.name + ': 예산서 형식(계정과목·세출합계)을 찾지 못했습니다'); continue; }
        const p = parsed[0];
        const ym = /(20\d{2})/.exec(file.name);
        p.trees.forEach((t, i) => {
          const fund = GXLS.guessFund(t) || (items.length ? items[items.length - 1].fund : '보조금');
          let kind = p.format === 'settle' ? '결산' : p.format === 'change' ? (i === 0 ? '당초 예산' : '변경 예산') : '당초 예산';
          if (p.format === 'change' && i === 0 && S.data.budgets.some(b => b.fund === fund && b.year === (ym ? +ym[1] : SET.year))) kind = '';
          items.push({ file: file.name, tree: t, fund, kind, year: ym ? +ym[1] : SET.year, date: p.format === 'settle' ? '' : (i === 0 ? (ym ? ym[1] : SET.year) + '-01-01' : today()), label: p.labels[i] || '' });
        });
      } catch (e) { toast(file.name + ': 읽지 못했습니다 (' + e.message + ')'); }
    }
    if (!items.length) return;
    const rows = items.map(it => {
      const leaf = it.tree.expense.filter(n => n.level === 4).length;
      return h('div', { class: 'imp' },
        h('div', { class: 'imp-h' }, h('b', { text: it.file }), it.label ? ' · ' + it.label : '', h('span', { class: 'muted', text: ' (세출 세목 ' + leaf + '개' + (it.tree.income.length ? ', 세입 있음' : '') + ')' })),
        h('div', { class: 'row wrap' },
          h('label', null, '재원 ', h('select', { class: 'fld', onchange: e => it.fund = e.target.value }, ['보조금', '자부담'].map(x => h('option', { selected: it.fund === x ? 'selected' : null }, x)))),
          h('label', null, '종류 ', h('select', { class: 'fld', onchange: e => it.kind = e.target.value }, [['', '가져오지 않음'], ['당초 예산', '당초 예산'], ['변경 예산', '변경 예산(추경)'], ['결산', '결산(집행액)']].map(([v, t]) => h('option', { value: v, selected: it.kind === v ? 'selected' : null }, t)))),
          h('label', null, '연도 ', h('input', { class: 'fld w80', type: 'number', value: it.year, onchange: e => it.year = +e.target.value })),
          h('label', null, '기준일 ', h('input', { class: 'fld', type: 'date', value: it.date, onchange: e => it.date = e.target.value }))));
    });
    modal('예산서 불러오기', h('div', null, h('p', { class: 'muted', text: '재원(보조금·자부담)과 종류를 확인해 주세요. 결산 파일은 기준일(그 날짜까지의 집행)을 꼭 넣어 주세요. 계정과목 문구는 파일에 적힌 그대로 저장합니다.' }), rows), [
      { text: '취소' },
      { text: '불러오기', primary: true, onclick: () => {
        const bad = items.find(it => it.kind === '결산' && !it.date);
        if (bad) { toast('결산 파일의 기준일을 넣어 주세요'); return false; }
        let n = 0;
        for (const it of items) if (it.kind) {
          S.data.budgets.push({ id: uid(), at: Date.now() + n, year: it.year, fund: it.fund, kind: it.kind, date: it.date, label: it.label, source: it.file,
            income: it.tree.income.map(x => ({ level: x.level, name: x.name, path: x.path, budget: x.budget })),
            expense: it.tree.expense.map(x => ({ level: x.level, name: x.name, path: x.path, budget: x.budget, cum: x.cum != null ? x.cum : null })) });
          n++;
        }
        save(); toast('예산서 ' + n + '개를 불러왔습니다'); SET.fund = items.find(i => i.kind) ? items.find(i => i.kind).fund : SET.fund; saveSet(); render();
      } }], true);
  }

  /* ---------- 사업 ---------- */
  function projView() {
    const y = SET.year;
    const mob = h('select', { class: 'fld side-sel', onchange: e => { SET.sub = e.target.value; saveSet(); render(); } },
      Object.keys(D.UNIT_SUBS).map(u => h('optgroup', { label: u }, D.UNIT_SUBS[u].map(s => h('option', { value: s, selected: SET.sub === s ? 'selected' : null }, s + (s === PILOT ? ' (시범)' : ''))))));
    const side = h('div', { class: 'side' }, yearSel(), mob,
      Object.keys(D.UNIT_SUBS).map(u => [h('div', { class: 'side-h', text: u }), D.UNIT_SUBS[u].map(s => {
        const P = proj(y, s, false);
        return h('button', { class: 'li' + (SET.sub === s ? ' on' : ''), onclick: () => { SET.sub = s; saveSet(); render(); } }, s, s === PILOT ? h('span', { class: 'tag', text: '시범' }) : null, P && P.versions.length ? h('span', { class: 'dot', title: '자료 있음' }) : null);
      })]));
    return h('div', { class: 'split' }, side, h('div', { class: 'content' }, subView(y, SET.sub)));
  }
  function subView(y, sub) {
    const P = proj(y, sub, false);
    const wrap = h('div', { class: 'page' }, h('h2', null, sub, h('small', { class: 'muted', text: '  ' + (D.unitOf(sub) || '') + ' · ' + y + '년' })));
    if (!P || !P.versions.length) {
      ap(wrap, h('div', { class: 'empty' }, h('p', { text: '아직 이 사업의 사업계획이 없습니다.' }),
        h('p', { class: 'muted', text: '연초 사업계획서의 목표·회차 일정·예산(품목별 단가×인원×횟수)을 넣으면, 이후 변경계획·회차 기안·결과보고·잔액·실적이 여기서 이어집니다.' }),
        h('button', { class: 'btn primary', onclick: () => { const Q = proj(y, sub, true); Q.versions.push({ id: uid(), kind: '사업계획', no: '', date: y + '-01-', status: '작성 중', goals: { real: '', total: '', count: '' }, lines: [], schedule: [] }); save(); SET.ptab = 'plan'; saveSet(); render(); } }, '사업계획 넣기')));
      return wrap;
    }
    ensureRounds(P);
    const tabs = [['plan', '계획'], isPerson(P) ? ['rounds', isCourse(P) ? '교육별' : '사람별'] : ['rounds', '회차 기안'], ['money', '예산·잔액'], ['perf', '실적']];
    ap(wrap, h('div', { class: 'seg mb' }, tabs.map(([k, t]) => h('button', { class: SET.ptab === k ? 'on' : '', onclick: () => { SET.ptab = k; saveSet(); render(); } }, t))));
    const views = { plan: planTab, rounds: isPerson(P) ? peopleTab : roundsTab, money: moneyTab, perf: isPerson(P) ? personPerfTab : perfTab };
    ap(wrap, (views[SET.ptab] || planTab)(P));
    return wrap;
  }
  function acctSelect(P, fund, value, onch) {
    const opts = B.leafPaths(P.year, fund);
    const sel = h('select', { class: 'fld acctsel', onchange: e => onch(e.target.value) }, h('option', { value: '', text: '(계정과목 고르기)' }),
      opts.map(p => h('option', { value: p, selected: p === value ? 'selected' : null, text: p.split('/').slice(2).join(' / ') + '  (' + p.split('/').slice(0, 2).join(' / ') + ')' })));
    if (value && !opts.includes(value)) sel.append(h('option', { value, selected: 'selected', text: '⚠ 예산서에 없음: ' + pathText(value) }));
    return sel;
  }
  function planTab(P) {
    const v = SET.ver && P.versions.find(x => x.id === SET.ver) || P.versions[P.versions.length - 1];
    const edit = v.status !== '확정';
    const base = baseVer(P);
    const box = h('div');
    ap(box, h('div', { class: 'chips' }, P.versions.map((x, i) => h('button', { class: 'vchip' + (x === v ? ' cur' : ''), onclick: () => { SET.ver = x.id; render(); } },
      h('b', { text: (i ? '변경 ' + i : '당초') + ' · ' + x.kind }), ' ' + (x.date || '') + (x.no ? ' ' + x.no : '') + ' ' + (x.status === '확정' ? '✓' : '(작성 중)'))),
      base && base.status === '확정' && !P.versions.some(x => x.status !== '확정') ? h('button', { class: 'btn', onclick: () => newChange(P) }, '+ 변경계획 만들기') : null));
    ap(box, h('p', { class: 'muted small', text: '회차 기안과 잔액은 확정된 가장 최근 계획(' + (base ? (base.kind + ' ' + (base.date || '')) : '없음') + ')을 기준으로 합니다.' }));
    // 기본 정보
    const inp = (obj, k, attrs) => h('input', Object.assign({ class: 'fld', value: obj[k] == null ? '' : obj[k], disabled: !edit ? 'disabled' : null, onchange: e => { obj[k] = e.target.type === 'number' ? (e.target.value === '' ? '' : +e.target.value) : e.target.value; save(); render(); } }, attrs || {}));
    ap(box, h('div', { class: 'form' },
      h('label', null, '종류', h('select', { class: 'fld', disabled: !edit ? 'disabled' : null, onchange: e => { v.kind = e.target.value; save(); render(); } }, ['사업계획', '변경계획'].map(k => h('option', { selected: v.kind === k ? 'selected' : null }, k)))),
      h('label', null, '문서번호', inp(v, 'no', { placeholder: '손잡다' + String(P.year).slice(2) + '-0000' })),
      h('label', null, '기안일', inp(v, 'date', { type: 'date' })),
      h('label', null, '실인원 목표', inp(v.goals, 'real', { type: 'number', class: 'fld w80' })),
      h('label', null, '연인원 목표', inp(v.goals, 'total', { type: 'number', class: 'fld w80' })),
      h('label', null, '횟수 목표', inp(v.goals, 'count', { type: 'number', class: 'fld w80' }))));
    // 계정 연결
    ap(box, h('h3', { text: '이 사업의 계정과목' }), h('div', { class: 'form' }, ['보조금', '자부담'].map(f => h('label', null, f, acctSelect(P, f, P.accts[f] || '', val => { P.accts[f] = val; save(); render(); })))),
      h('p', { class: 'muted small', text: '계정과목은 예산서에 있는 문구 중에서만 고릅니다(직접 입력 불가). 홍보비처럼 다른 계정에서 나가는 품목은 아래 예산 줄에서 따로 고릅니다.' }));
    // 예산 줄
    const tb = h('tbody');
    v.lines.forEach((l, i) => tb.append(h('tr', null,
      h('td', null, h('input', { class: 'fld', list: 'items', value: l.item || '', disabled: !edit ? 'disabled' : null, onchange: e => { l.item = e.target.value.trim(); if (!l.acct) { if (/홍보/.test(l.item)) { const p = B.leafPaths(P.year, l.fund).find(x => /수용비/.test(x)); if (p) l.acct = p; } else if (P.accts[l.fund]) l.acct = P.accts[l.fund]; } save(); render(); } })),
      h('td', null, h('select', { class: 'fld', disabled: !edit ? 'disabled' : null, onchange: e => { l.fund = e.target.value; l.acct = P.accts[l.fund] || ''; save(); render(); } }, ['보조금', '자부담'].map(f => h('option', { selected: l.fund === f ? 'selected' : null }, f)))),
      h('td', null, edit ? acctSelect(P, l.fund, l.acct, val => { l.acct = val; save(); render(); }) : h('span', { class: 'small nowrap', title: pathText(l.acct), text: String(l.acct || '').split('/').slice(2).join(' / ') })),
      h('td', null, h('input', { class: 'fld w100 num', type: 'number', value: l.price == null ? '' : l.price, disabled: !edit ? 'disabled' : null, onchange: e => { l.price = e.target.value === '' ? '' : +e.target.value; save(); render(); } })),
      h('td', null, h('input', { class: 'fld w140', value: l.qty || '', placeholder: '8명 × 6회', disabled: !edit ? 'disabled' : null, onchange: e => { l.qty = e.target.value; save(); render(); } })),
      h('td', { class: 'num strong', text: fmt(lineAmount(l)) }),
      h('td', null, edit ? h('button', { class: 'x', title: '줄 지우기', onclick: () => { v.lines.splice(i, 1); save(); render(); } }, '×') : null))));
    const totals = ['보조금', '자부담'].map(f => [f, sumLines(v, l => l.fund === f)]).filter(x => x[1]);
    ap(box, h('h3', { text: '예산(산출근거)' }), h('div', { class: 'twrap' }, h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, ['품목', '재원', '계정과목', '단가', '인원·횟수', '금액', ''].map(t => h('th', { text: t })))), tb,
      h('tfoot', null, h('tr', null, h('td', { colspan: 5, text: '합계 ' + totals.map(([f, s]) => f + ' ' + won(s)).join(' · ') }), h('td', { class: 'num strong', text: fmt(sumLines(v)) }), h('td'))))),
      edit ? h('button', { class: 'btn', onclick: () => { v.lines.push({ id: uid(), item: '', fund: '보조금', acct: P.accts['보조금'] || '', price: '', qty: '' }); save(); render(); } }, '+ 예산 줄 추가') : null,
      h('datalist', { id: 'items' }, ['식비', '다과비', '체험비', '통역비', '강사비', '대관료', '홍보비', '배상책임공제', '물품구입비', '재료비', '숙박비', '교통비', '입장료'].map(x => h('option', { value: x }))));
    // 예산서 대조
    const chk = [];
    for (const f of ['보조금', '자부담']) {
      const path = P.accts[f]; if (!path) continue;
      const st = B.status(P.year, f, path), s = sumLines(v, l => l.fund === f && l.acct === path);
      if (st && st.budget !== s) chk.push(h('li', { class: 'warnline', text: f + ' ‘' + pathText(path) + '’ 예산서 금액은 ' + won(st.budget) + '인데 이 계획의 해당 줄 합계는 ' + won(s) + '입니다.' }));
      else if (st) chk.push(h('li', { class: 'okline', text: f + ' ‘' + pathText(path) + '’ 예산서 금액과 계획 합계(' + won(s) + ')가 같습니다.' }));
    }
    const notIn = v.lines.filter(l => l.acct && !B.leafPaths(P.year, l.fund).includes(l.acct));
    notIn.forEach(l => {
      const sg = GSCAN.suggestAcct(String(l.acct).split('/'), ['보조금', '자부담'].flatMap(f => B.leafPaths(P.year, f).map(path => ({ fund: f, path }))));
      chk.push(h('li', { class: 'warnline' }, '‘' + (l.item || '이름 없음') + '’ 줄의 계정과목 ‘' + pathText(l.acct) + '’이(가) 예산서에 없습니다. ' + (sg ? '예산서의 ‘' + pathText(sg.path) + '’(' + sg.fund + ')을(를) 이렇게 쓴 것 같습니다. ' : '예산서 문구가 기준입니다.'),
        sg ? h('button', { class: 'btn', onclick: () => ask('계정과목을 예산서 문구로', '‘' + pathText(l.acct) + '’을(를) ‘' + pathText(sg.path) + '’(' + sg.fund + ')(으)로 바꿉니다. 이 사업의 모든 계획 버전에서 같은 문구를 쓴 줄을 함께 바꿉니다. 기안 파일은 바뀌지 않습니다.', '바꾸기', () => {
          const old = l.acct;
          for (const vv of P.versions) for (const x of vv.lines) if (x.acct === old) { x.acct = sg.path; x.fund = sg.fund; }
          for (const f of ['보조금', '자부담']) if (P.accts[f] === old) P.accts[f] = ''; if (!P.accts[sg.fund]) P.accts[sg.fund] = sg.path;
          save(); render(); toast('예산서 문구로 바꿨습니다. 다시 읽으면 지출도 이 계정으로 맞춥니다');
        }) }, '예산서 문구로 바꾸기') : null));
    });
    if (chk.length) ap(box, h('ul', { class: 'checks' }, chk));
    // 회차 일정
    const sb = h('tbody');
    (v.schedule = v.schedule || []).forEach((s, i) => sb.append(h('tr', null,
      h('td', null, h('input', { class: 'fld w60 num', type: 'number', value: s.n, disabled: !edit ? 'disabled' : null, onchange: e => { s.n = +e.target.value; save(); render(); } })),
      h('td', null, h('input', { class: 'fld', value: s.name || '', placeholder: '활동 이름(장소)', disabled: !edit ? 'disabled' : null, onchange: e => { s.name = e.target.value; save(); render(); } })),
      h('td', null, h('input', { class: 'fld', type: 'date', value: s.date || '', disabled: !edit ? 'disabled' : null, onchange: e => { s.date = e.target.value; save(); render(); } })),
      h('td', null, h('input', { class: 'fld w80 num', type: 'number', value: s.people == null ? '' : s.people, placeholder: '인원', disabled: !edit ? 'disabled' : null, onchange: e => { s.people = e.target.value === '' ? '' : +e.target.value; save(); render(); } })),
      h('td', null, edit ? h('button', { class: 'x', onclick: () => { v.schedule.splice(i, 1); save(); render(); } }, '×') : null))));
    ap(box, h('h3', { text: '회차 일정' }), h('div', { class: 'twrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['회차', '활동', '날짜', '예정 인원', ''].map(t => h('th', { text: t })))), sb)),
      edit ? h('button', { class: 'btn', onclick: () => { const n = v.schedule.reduce((a, s) => Math.max(a, s.n || 0), 0) + 1; v.schedule.push({ n, name: '', date: '', people: '' }); save(); render(); } }, '+ 회차 추가') : null);
    // 변경 비교
    const prev = prevConfirmed(P, v);
    if (prev) ap(box, compareBox(P, prev, v));
    // 확정
    ap(box, h('div', { class: 'row end mt' },
      edit ? h('button', { class: 'btn danger', onclick: () => ask('이 버전 지우기', '작성 중인 ' + v.kind + '을(를) 지웁니다.', '지우기', () => { P.versions = P.versions.filter(x => x !== v); SET.ver = null; save(); render(); }, true) }, '지우기') : null,
      edit ? h('button', { class: 'btn primary', onclick: () => ask('확정', '결재가 끝난 계획으로 확정하면, 이후 회차 기안과 잔액이 이 계획을 기준으로 바뀝니다.', '확정', () => { v.status = '확정'; save(); render(); }) }, '결재 완료로 확정')
        : h('button', { class: 'btn', onclick: () => ask('다시 고치기', '확정을 풀고 작성 중으로 되돌립니다.', '되돌리기', () => { v.status = '작성 중'; save(); render(); }) }, '확정 풀기')));
    return box;
  }
  function newChange(P) {
    const b = baseVer(P);
    const c = JSON.parse(JSON.stringify(b));
    c.id = uid(); c.kind = '변경계획'; c.no = ''; c.date = today(); c.status = '작성 중'; c.reason = '';
    P.versions.push(c); SET.ver = c.id; save(); render();
    toast('직전 계획을 복사했습니다. 바뀌는 곳만 고쳐 주세요');
  }
  function compareBox(P, a, b) {
    const key = l => l.fund + '|' + (l.item || '') + '|' + l.acct;
    const am = new Map(a.lines.map(l => [l.id, l])), rows = [], used = new Set();
    for (const l of b.lines) {
      const o = am.get(l.id) || a.lines.find(x => !used.has(x.id) && key(x) === key(l));
      if (o) used.add(o.id);
      rows.push({ item: l.item, fund: l.fund, before: o ? lineAmount(o) : 0, after: lineAmount(l), bq: o ? fmt(o.price) + '원 × ' + (o.qty || '') : '', aq: fmt(l.price) + '원 × ' + (l.qty || ''), isNew: !o });
    }
    for (const o of a.lines) if (!used.has(o.id) && !b.lines.some(l => l.id === o.id)) rows.push({ item: o.item, fund: o.fund, before: lineAmount(o), after: 0, bq: fmt(o.price) + '원 × ' + (o.qty || ''), aq: '', gone: true });
    const tb = h('tbody', null, rows.map(r => h('tr', { class: r.before !== r.after || r.bq !== r.aq ? 'changed' : '' }, h('td', { text: (r.item || '') + ' (' + r.fund + ')' }), h('td', { class: 'small', text: r.bq }), h('td', { class: 'num', text: fmt(r.before) }), h('td', { class: 'small', text: r.aq }), h('td', { class: 'num', text: fmt(r.after) }), h('td', { class: 'num ' + (r.after > r.before ? 'up' : r.after < r.before ? 'down' : ''), text: r.after - r.before ? (r.after > r.before ? '+' : '') + fmt(r.after - r.before) : '' }))));
    const ta = sumLines(a), tbs = sumLines(b);
    const g = k => [a.goals[k], b.goals[k]];
    const changes = [];
    rows.forEach(r => { if (r.isNew) changes.push('- ' + r.item + ' 항목을 추가하였음'); else if (r.gone) changes.push('- ' + r.item + ' 항목을 삭제하였음'); else if (r.before !== r.after || r.bq !== r.aq) changes.push('- ' + r.item + ' 예산 금액을 조정하였음'); });
    [['real', '실인원'], ['total', '연인원'], ['count', '횟수']].forEach(([k, t]) => { const [x, y] = g(k); if (String(x) !== String(y)) changes.push('- 산출목표 ' + t + '을(를) ' + (x || 0) + '에서 ' + (y || 0) + '(으)로 조정하였음'); });
    const sa = JSON.stringify((a.schedule || []).map(s => [s.n, s.name, s.date])), sbb = JSON.stringify((b.schedule || []).map(s => [s.n, s.name, s.date]));
    if (sa !== sbb) changes.push('- 회차 일정을 조정하였음');
    const reason = tbs < ta ? '사업 운영 비용을 절감하여, 예산을 ' + won(ta - tbs) + ' 감액함' : tbs > ta ? '사업 운영에 필요한 비용을 반영하여, 예산을 ' + won(tbs - ta) + ' 증액함' : '예산 총액은 그대로 두고 세부 항목을 조정함';
    const text = '변경사유: ' + reason + '\n※ 주요 변경사항\n' + (changes.join('\n') || '- (바뀐 곳 없음)') + '\n\n당초 ' + won(ta) + ' → 변경 ' + won(tbs) + ' (증감 ' + (tbs - ta >= 0 ? '+' : '') + fmt(tbs - ta) + '원)';
    return h('div', { class: 'cmp' }, h('h3', { text: '당초 / 변경 / 증감 (직전 확정 계획과 비교)' }),
      h('div', { class: 'twrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['품목', '당초 산출', '당초', '변경 산출', '변경', '증감'].map(t => h('th', { text: t })))), tb,
        h('tfoot', null, h('tr', null, h('td', { colspan: 2, text: '합계' }), h('td', { class: 'num strong', text: fmt(ta) }), h('td'), h('td', { class: 'num strong', text: fmt(tbs) }), h('td', { class: 'num strong', text: (tbs - ta >= 0 ? '+' : '') + fmt(tbs - ta) }))))),
      h('div', { class: 'draft' }, h('pre', { text }), h('button', { class: 'btn', onclick: () => copy(text) }, '초안 복사')),
      h('p', { class: 'muted small', text: '변경사유에는 예산을 어디로 옮기는지 쓰지 않고 바뀌는 내용만 씁니다. 산출목표는 예산 횟수에 맞추지 않습니다.' }));
  }
  const TITLE_KIND = { '계획': '계획', '모집': '참여자 모집 홍보', '결과보고': '결과보고' };
  const TITLE_KIND_P = { '사전회의': '사전회의 진행 보고', '중간회의': '중간회의 진행 보고', '변경계획': '변경 계획', '연계': '연계' };
  const PERSON_KINDS = ['사전회의', '계획', '연계', '중간회의', '변경계획', '결과보고'];
  function suggestTitle(P, r, kind) {
    if (r.person != null) return P.sub === '자립생활프로그램' ? P.sub + ' ' + (r.person ? r.person + ' ' : '') + (TITLE_KIND_P[kind] || kind) : P.sub + (r.person ? '(' + r.person + ')' : '') + ' ' + (TITLE_KIND_P[kind] || kind);
    return P.sub + ' ' + runit(r) + ' ' + (r.unit === '분기' && kind === '계획' ? '운영 계획' : r.unit === '분기' && kind === '결과보고' ? '운영 결과보고' : (TITLE_KIND[kind] || kind));
  }
  function roundsTab(P) {
    const base = baseVer(P);
    if (!base) return h('p', { text: '먼저 계획을 넣어 주세요.' });
    const kinds = D.ROUND_KINDS;
    const todo = [];
    const now = today();
    // 분기 결과보고(자조모임 등)의 결산은 그 분기에 열린 회기·차수의 지출과 견줌
    const inQ = (q, d) => { const t = String(d.when || d.date || ''); return t.slice(0, 4) === String(P.year) && Math.ceil(+t.slice(5, 7) / 3) === q; };
    const spendOf = r => r.docs.filter(d => D.SPEND_KINDS.includes(d.kind)).concat(r.unit === '분기' ? P.rounds.filter(x => x.unit !== '분기').flatMap(x => x.docs).filter(d => D.SPEND_KINDS.includes(d.kind) && inQ(r.n, d)) : []);
    for (const r of P.rounds) {
      const s = (r.unit || '차') === '차' ? schedOf(P, r.n) || {} : {}, u = runit(r);
      const has = k => r.docs.some(d => d.kind === k);
      if (s.date && s.date < now && !has('결과보고')) todo.push(u + '(' + s.date + '): 결과보고가 없습니다');
      if (s.date && s.date >= now && !has('계획')) todo.push(u + '(' + s.date + '): 운영계획을 먼저 써야 합니다');
      const res = r.docs.find(d => d.kind === '결과보고'), plan = r.docs.find(d => d.kind === '계획');
      const spendDocs = spendOf(r), actual = spendDocs.reduce((a, d) => a + docSpend(d), 0);
      const plannedSum = spendDocs.reduce((a, d) => a + (d.planned != null ? +d.planned : docSpend(d)), 0);
      if (res && res.settle != null && res.settle !== '') {
        const st = +res.settle, budget = plan && plan.budget ? +plan.budget : plannedSum;
        if (budget && st > budget) todo.push(u + ' 결과보고 결산(' + won(st) + ')이 예산(' + won(budget) + ')보다 많습니다');
        if (st !== actual) todo.push(u + ' 결과보고 결산(' + won(st) + ')과 ' + (r.unit === '분기' ? '그 분기 ' : '') + '지출 기안 집행 합계(' + won(actual) + ')가 다릅니다');
        if (st < plannedSum) spendDocs.filter(d => SETTLE_KINDS.includes(d.kind) && !d.hasSettle && !isRefund(d)).forEach(d => todo.push(u + ': 예산보다 적게 썼는데 ' + d.kind + '(' + (d.no || '').slice(-4) + ')에 정산서가 없습니다' + (d.scan ? ' · 스캔본에서 확인해 주세요' : ' · 스캔본도 없습니다')));
      }
      r.docs.filter(d => D.SPEND_KINDS.includes(d.kind) && d.settled != null && d.planned != null && +d.settled > +d.planned).forEach(d => todo.push(u + ' ' + d.kind + '(' + (d.no || '').slice(-4) + '): 집행액(' + won(+d.settled) + ')이 기안 예산(' + won(+d.planned) + ')보다 많습니다'));
      r.docs.filter(d => ['물품구입비', '홍보비'].includes(d.kind) && d.hasInspect === false).forEach(d => todo.push(u + ' ' + d.kind + '(' + (d.no || '').slice(-4) + '): 물품검수조서가 없습니다' + (d.scan ? ' · 스캔본에서 확인해 주세요' : '')));
    }
    const tb = h('tbody');
    for (const r of P.rounds) {
      const s = (r.unit || '차') === '차' ? schedOf(P, r.n) || {} : {};
      tb.append(h('tr', null, h('td', { class: 'strong nowrap', text: runit(r) }), h('td', { class: 'small', text: (s.name || '') + (s.date ? ' · ' + s.date.slice(5).replace('-', '/') : '') }),
        kinds.map(k => {
          const ds = r.docs.filter(d => d.kind === k || (!kinds.includes(d.kind) && (D.SPEND_KINDS.includes(d.kind) ? k === '진행비' : k === '계획')));
          const need = (k === '계획' || k === '결과보고') && (r.unit || '차') !== '회기'; // 회기는 분기 계획·결과보고로 묶음
          return h('td', { class: 'mc' }, ds.map(d => h('button', { class: 'doc ' + (d.status === '결재 완료' ? 'done' : d.status === '결재 요청' ? 'req' : 'draft'), title: d.title || '', onclick: () => docModal(P, r, d) }, (d.no ? d.no.slice(-4) : '0000') + (docSpend(d) ? ' ' + fmt(docSpend(d)) : '') + (d.settled != null && d.planned != null && +d.settled !== +d.planned ? ' (예산 ' + fmt(+d.planned) + ')' : ''))),
            h('button', { class: 'plus' + (need && !ds.length ? ' need' : ''), title: k + ' 추가', onclick: () => docModal(P, r, null, k) }, need && !ds.length ? '+ 필요' : '+'));
        }),
        h('td', { class: 'num strong', title: r.unit === '분기' ? '그 분기 회기 지출 합' : '', text: fmt(r.unit === '분기' ? spendOf(r).reduce((a, d) => a + docSpend(d), 0) : roundSpend(r)) })));
    }
    return h('div', null,
      todo.length ? h('ul', { class: 'checks' }, todo.map(t => h('li', { class: 'warnline', text: t }))) : h('p', { class: 'okline', text: '할 일로 걸리는 회차가 없습니다.' }),
      h('div', { class: 'twrap' }, h('table', { class: 'tbl mx' }, h('thead', null, h('tr', null, h('th', { text: '회차' }), h('th', { text: '활동' }), kinds.map(k => h('th', { text: k })), h('th', { text: '지출 합' }))), tb)),
      h('p', { class: 'muted small', text: '‘손잡다’ 폴더를 연결해 두면 내부기안 폴더의 회차 기안이 저절로 들어옵니다. 칸을 누르면 그 회차의 기안을 적거나 고칩니다. 지출 기안은 계획의 예산 줄에 금액을 나눠 적으면 남은 예산에서 빠집니다. 결과보고 결산은 같은 회차 지출 기안의 합계로 채워집니다. (기안 파일을 자동으로 만들어 주는 기능은 다음 단계에서 붙입니다.)' }),
      h('button', { class: 'btn', onclick: () => { const n = P.rounds.reduce((a, r) => Math.max(a, r.n), 0) + 1; P.rounds.push({ id: uid(), n, docs: [], manual: true }); save(); render(); } }, '+ 계획에 없는 회차 추가'));
  }
  function docModal(P, r, d, kind) {
    const isNew = !d;
    d = d ? JSON.parse(JSON.stringify(d)) : { id: uid(), kind, no: '손잡다' + String(P.year).slice(2) + '-0000', date: today(), title: suggestTitle(P, r, kind), status: '작성 중', spends: {}, attend: '', memo: '' };
    if (isNew && r.person) d.persons = [r.person];
    const base = baseVer(P);
    const body = h('div', { class: 'form col' });
    const draw = () => {
      body.textContent = '';
      ap(body, 
        h('label', null, '종류', h('select', { class: 'fld', onchange: e => { d.kind = e.target.value; d.title = suggestTitle(P, r, d.kind); draw(); } }, (r.person != null ? PERSON_KINDS.concat(D.SPEND_KINDS, ['기타']) : D.ROUND_KINDS.concat(['다과비', '식비', '재료비', '숙박비', '협조요청', '보도자료', '기타'])).filter((k, i, a) => a.indexOf(k) === i).map(k => h('option', { selected: d.kind === k ? 'selected' : null }, k)))),
        h('label', null, '제목', h('input', { class: 'fld', value: d.title, onchange: e => d.title = e.target.value })),
        h('div', { class: 'row wrap' },
          h('label', null, '문서번호', h('input', { class: 'fld w140', value: d.no, onchange: e => d.no = e.target.value.trim() })),
          h('label', null, '기안일', h('input', { class: 'fld', type: 'date', value: d.date, onchange: e => d.date = e.target.value })),
          h('label', null, '상태', h('select', { class: 'fld', onchange: e => d.status = e.target.value }, ['작성 중', '결재 요청', '결재 완료'].map(k => h('option', { selected: d.status === k ? 'selected' : null }, k))))));
      if (D.SPEND_KINDS.includes(d.kind) && (d.planned != null || d.hasSettle != null)) ap(body, h('p', { class: 'muted small', text: [d.planned != null ? '기안 예산 ' + won(+d.planned) : '', d.settled != null ? '정산 집행 ' + won(+d.settled) : '', d.hasSettle ? '정산서 있음' : SETTLE_KINDS.includes(d.kind) ? '정산서 없음' : '', ['물품구입비', '홍보비'].includes(d.kind) ? (d.hasInspect ? '물품검수조서 있음' : '물품검수조서 없음') : '', d.scan ? '스캔본 있음' : (d.no && !/-0+$/.test(d.no) ? '스캔본 없음' : '')].filter(Boolean).join(' · ') + '. 지출 금액은 정산서가 있으면 집행액으로 넣습니다.' }));
      if (D.SPEND_KINDS.includes(d.kind)) {
        ap(body, h('h4', { text: '예산 줄별 지출 금액' }), h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['품목', '계획', '남은 금액', '이번 지출'].map(t => h('th', { text: t })))),
          h('tbody', null, base.lines.map(l => {
            const used = lineSpent(P, l.id) - (isNew ? 0 : (+((r.docs.find(x => x.id === d.id) || {}).spends || {})[l.id] || 0));
            return h('tr', null, h('td', { text: (l.item || '') + ' (' + l.fund + ')' }), h('td', { class: 'num', text: fmt(lineAmount(l)) }), h('td', { class: 'num', text: fmt(lineAmount(l) - used) }),
              h('td', null, h('input', { class: 'fld w100 num', type: 'number', value: d.spends[l.id] || '', onchange: e => { if (e.target.value === '') delete d.spends[l.id]; else d.spends[l.id] = +e.target.value; draw(); } })));
          })), h('tfoot', null, h('tr', null, h('td', { colspan: 3, text: '합계' }), h('td', { class: 'num strong', text: fmt(docSpend(d)) })))));
      }
      if (d.kind === '결과보고' && r.person == null) {
        const sp = r.docs.filter(x => x.kind !== '결과보고' && x.id !== d.id).reduce((a, x) => a + docSpend(x), 0);
        if (d.settle == null || d.settle === '') d.settle = sp;
        const names = attendees(d);
        ap(body, h('label', null, '결산(지출 기안 합계 ' + won(sp) + ')', h('input', { class: 'fld w140 num', type: 'number', value: d.settle, onchange: e => { d.settle = e.target.value === '' ? '' : +e.target.value; draw(); } })),
          +d.settle !== sp ? h('p', { class: 'warnline', text: '결산이 지출 기안 합계와 다릅니다. 빠진 지출 기안이 없는지 확인해 주세요.' }) : null,
          h('label', null, '참여자 명단 (한 줄에 한 명, 실제로 온 사람만) · ' + names.length + '명', h('textarea', { class: 'fld', rows: 6, value: d.attend || '', onchange: e => { d.attend = e.target.value; draw(); } })),
          h('p', { class: 'muted small', text: '명단은 이 PC와 연결한 폴더에만 저장하고, 실인원(중복 없이)·연인원 계산에 씁니다.' }));
      }
      ap(body, h('label', null, '메모', h('textarea', { class: 'fld', rows: 2, value: d.memo || '', onchange: e => d.memo = e.target.value })));
    };
    draw();
    modal((r.person != null ? r.person || '공통' : runit(r)) + ' · ' + (isNew ? '기안 추가' : '기안 고치기'), body, [
      isNew ? null : { text: '지우기', danger: true, onclick: () => { const i = r.docs.findIndex(x => x.id === d.id); if (i >= 0) r.docs.splice(i, 1); save(); render(); } },
      { text: '취소' },
      { text: '저장', primary: true, onclick: () => { const i = r.docs.findIndex(x => x.id === d.id); if (i >= 0) r.docs[i] = d; else r.docs.push(d); save(); render(); } }].filter(Boolean), true);
  }
  /* 사람별 사업(개별자립지원·개별동료상담): 이름마다 사전회의 → 계획 → 연계 → 중간회의 → 변경 계획 → 결과보고 → 지출 */
  function personNames(P) { const s = new Set(); (P.pdocs = P.pdocs || []).forEach(d => (d.persons || []).forEach(n => s.add(n))); (P.people || []).forEach(n => s.add(n)); return [...s].sort((a, b) => a.localeCompare(b, 'ko')); }
  function personChecks(P, name) {
    const ds = P.pdocs.filter(d => (d.persons || []).includes(name)), of = k => ds.filter(d => d.kind === k), first = k => of(k).map(d => d.date || '').sort()[0] || '';
    const out = [];
    if (P.sub === '개별자립지원') {
      if (of('계획').length && !of('사전회의').length) out.push('사전회의 보고가 없습니다');
      if (of('계획').length && of('사전회의').length && first('계획') < first('사전회의')) out.push('계획이 사전회의보다 먼저입니다');
      if (of('연계').length && !of('계획').length) out.push('계획 없이 연계가 ' + of('연계').length + '건 진행되었습니다');
      else if (of('연계').some(d => (d.date || '') < first('계획'))) out.push('계획보다 먼저 결재된 연계가 있습니다');
      if (of('계획').length && of('계획').every(d => d.status !== '결재 완료') && of('연계').some(d => d.status === '결재 완료')) out.push('계획이 아직 결재 전인데 연계는 결재되었습니다');
      const mid = first('중간회의'); if (mid && !of('변경계획').some(d => (d.date || '') >= mid)) out.push('중간회의 뒤 변경 계획이 없습니다(바뀐 내용이 있으면 변경 계획 필요)');
    } else {
      if (of('결과보고').length && !of('계획').length) out.push('계획 없이 결과보고가 있습니다');
    }
    ds.filter(d => SETTLE_KINDS.includes(d.kind) && d.settled != null && d.planned != null && +d.settled > +d.planned).forEach(d => out.push(d.kind + '(' + d.no.slice(-4) + ') 집행액이 기안 예산보다 많습니다'));
    return out;
  }
  function peopleTab(P) {
    const names = personNames(P), course = isCourse(P), who = course ? '교육' : '사람';
    const cols = P.sub === '개별자립지원' ? ['사전회의', '계획', '연계', '중간회의', '변경계획', '결과보고'] : course ? ['계획', '변경계획', '결과보고'] : ['계획', '결과보고'];
    const chip = (d, r, long) => h('button', { class: 'doc ' + (d.status === '결재 완료' ? 'done' : d.status === '결재 요청' ? 'req' : 'draft'), title: d.title || '', onclick: () => docModal(P, r, d) }, (d.no ? d.no.slice(-4) : '0000') + (long ? ' ' + (d.title || d.kind) : d.link ? ' ' + d.link : '') + (docSpend(d) ? ' ' + fmt(docSpend(d)) : ''));
    const todo = [];
    const tb = h('tbody', null, names.map(n => {
      const r = { person: n, docs: P.pdocs }, ds = P.pdocs.filter(d => (d.persons || []).includes(n));
      personChecks(P, n).forEach(t => todo.push(n + ': ' + t));
      return h('tr', null, h('td', { class: 'strong nowrap', text: n }),
        cols.map(k => h('td', { class: 'mc' }, ds.filter(d => d.kind === k).map(d => chip(d, r)), h('button', { class: 'plus' + ((k === '계획' || k === '사전회의') && !ds.some(d => d.kind === k) ? ' need' : ''), title: k + ' 추가', onclick: () => docModal(P, r, null, k) }, (k === '계획' || k === '사전회의') && !ds.some(d => d.kind === k) ? '+ 필요' : '+'))),
        h('td', { class: 'mc' }, ds.filter(d => !cols.includes(d.kind)).map(d => chip(d, r)), h('button', { class: 'plus', title: '지출 기안 추가', onclick: () => docModal(P, r, null, '통역비') }, '+')),
        h('td', { class: 'num strong', text: fmt(ds.reduce((a, d) => a + docSpend(d), 0)) }));
    }));
    const common = P.pdocs.filter(d => !(d.persons || []).length), cr = { person: '', docs: P.pdocs };
    const addPerson = () => { const inp = h('input', { class: 'fld', placeholder: course ? '예: 한소네 교육(이름)' : '이름' }); modal(who + ' 추가', h('div', { class: 'form col' }, h('label', null, course ? '교육' : '이름', inp), h('p', { class: 'muted small', text: '이름은 이 PC와 연결한 폴더에만 저장합니다.' })), [{ text: '취소' }, { text: '추가', primary: true, onclick: () => { const v = inp.value.trim(); if (!v) return false; P.people = (P.people || []).concat(v); save(); render(); } }]); };
    return h('div', null,
      todo.length ? h('ul', { class: 'checks' }, todo.map(t => h('li', { class: 'warnline', text: t }))) : h('p', { class: 'okline', text: names.length ? '순서로 걸리는 ' + who + '이(가) 없습니다.' : '아직 ' + who + '별 기안이 없습니다.' }),
      h('div', { class: 'twrap' }, h('table', { class: 'tbl mx' }, h('thead', null, h('tr', null, h('th', { text: course ? '교육' : '이름' }), cols.map(k => h('th', { text: k === '변경계획' ? '변경 계획' : k })), h('th', { text: '지출 기안' }), h('th', { text: '지출 합' }))), tb)),
      common.length ? [h('h3', { text: who + '을(를) 정하지 않은 기안(월별 강사비 등)' }), h('div', { class: 'chips' }, common.map(d => chip(d, cr, true)))] : null,
      h('p', { class: 'muted small', text: course ? '‘손잡다’ 폴더를 연결해 두면 제목의 교육 이름(예: 한소네 교육(이름))으로 기안이 저절로 들어옵니다. 월별 강사비처럼 여러 교육에 걸친 기안은 아래 공통에 둡니다.' : '‘손잡다’ 폴더를 연결해 두면 제목의 괄호 안 이름으로 기안이 저절로 들어옵니다. 욕구·목표 연결과 세부사업계획서 개수는 기안 검수 화면의 점검 항목으로 사람이 확인합니다.' }),
      h('button', { class: 'btn', onclick: addPerson }, '+ ' + who + ' 추가'));
  }
  function personPerfTab(P) {
    const base = baseVer(P), g = (base && base.goals) || {}, names = personNames(P);
    const ks = P.sub === '개별자립지원' ? ['사전회의', '계획', '연계', '중간회의', '변경계획', '결과보고'] : isCourse(P) ? ['계획', '변경계획', '결과보고'] : ['계획', '결과보고'];
    const rows = names.map(n => { const ds = P.pdocs.filter(d => (d.persons || []).includes(n)); const c = k => ds.filter(d => d.kind === k).length; return { n, c, sum: ds.reduce((a, d) => a + docSpend(d), 0) }; });
    const cnt = P.sub === '개별자립지원' ? rows.reduce((a, x) => a + x.c('연계') + x.c('사전회의') + x.c('중간회의'), 0) : rows.reduce((a, x) => a + x.c('계획'), 0);
    const row = (t, goal, act) => h('tr', null, h('td', { text: t }), h('td', { class: 'num', text: goal === '' || goal == null ? '-' : fmt(+goal) }), h('td', { class: 'num strong', text: fmt(act) }), h('td', { class: 'num', text: goal ? Math.round(act / goal * 100) + '%' : '' }));
    return h('div', null, h('h3', { text: '목표 대비 (기안 기준, 참고용)' }),
      h('div', { class: 'twrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['항목', '목표', '기안 수', '비율'].map(t => h('th', { text: t })))),
        h('tbody', null, row(isCourse(P) ? '교육 수' : '실인원(기안이 있는 사람)', isCourse(P) ? '' : g.real, names.length), row(P.sub === '개별자립지원' ? '회의·연계 기안 수' : '상담 계획 수', g.count, cnt)))),
      h('h3', { text: isCourse(P) ? '교육별' : '사람별' }), h('div', { class: 'twrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, [isCourse(P) ? '교육' : '이름'].concat(ks.map(k => k === '변경계획' ? '변경 계획' : k), ['지출']).map(t => h('th', { text: t })))),
        h('tbody', null, rows.map(x => h('tr', null, h('td', { text: x.n }), ks.map(k => h('td', { class: 'num', text: x.c(k) || '' })), h('td', { class: 'num', text: fmt(x.sum) })))))),
      h('p', { class: 'muted small', text: '실제 상담·지원 횟수(연인원)는 일지 기준이라 여기 숫자와 다를 수 있습니다.' }));
  }
  function moneyTab(P) {
    const base = baseVer(P);
    const tb = h('tbody', null, base.lines.map(l => { const a = lineAmount(l), s = lineSpent(P, l.id); return h('tr', null, h('td', { text: l.item || '' }), h('td', { text: l.fund }), h('td', { class: 'small', text: pathText(l.acct) }), h('td', { class: 'num', text: fmt(a) }), h('td', { class: 'num', text: fmt(s) }), h('td', { class: 'num strong' + (a - s < 0 ? ' neg' : ''), text: fmt(a - s) })); }));
    const ta = sumLines(base), ts = base.lines.reduce((x, l) => x + lineSpent(P, l.id), 0);
    const box = h('div', null, h('h3', { text: '계획 예산 줄별 남은 금액' }), h('div', { class: 'twrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['품목', '재원', '계정과목', '계획', '지출 기안', '남은 금액'].map(t => h('th', { text: t })))), tb,
      h('tfoot', null, h('tr', null, h('td', { colspan: 3, text: '합계' }), h('td', { class: 'num strong', text: fmt(ta) }), h('td', { class: 'num strong', text: fmt(ts) }), h('td', { class: 'num strong', text: fmt(ta - ts) }))))));
    const rows = [];
    for (const f of ['보조금', '자부담']) { const p = P.accts[f]; if (!p) continue; const st = B.status(P.year, f, p); if (st) rows.push(h('tr', null, h('td', { text: f }), h('td', { class: 'small', text: pathText(p) }), h('td', { class: 'num', text: fmt(st.budget) }), h('td', { class: 'num', text: fmt(st.settled) + (st.date ? ' (' + st.date + ')' : '') }), h('td', { class: 'num', text: fmt(st.after) }), h('td', { class: 'num strong' + (st.remain < 0 ? ' neg' : ''), text: fmt(st.remain) }))); }
    const extra = allDocs(P).flatMap(d => (d.extra || []).map(e => Object.assign({ no: d.no, kind: d.kind }, e)));
    if (extra.length) ap(box, h('h3', { text: '계획 품목 밖 지출 (같은 세목 안, 세목 합계로 셈)' }),
      h('div', { class: 'twrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['기안', '품목', '재원', '세목', '금액'].map(t => h('th', { text: t })))),
        h('tbody', null, extra.map(e => h('tr', null, h('td', { text: (e.no || '').slice(-4) + ' ' + e.kind }), h('td', { text: e.item }), h('td', { text: e.fund }), h('td', { class: 'small', text: pathText(e.acct) }), h('td', { class: 'num', text: fmt(e.amount) })))),
        h('tfoot', null, h('tr', null, h('td', { colspan: 4, text: '합계' }), h('td', { class: 'num strong', text: fmt(extra.reduce((a, e) => a + e.amount, 0)) }))))),
      h('p', { class: 'muted small', text: '산출근거 안의 품목은 센터장 재량으로 바꿀 수 있어 틀린 것은 아닙니다. 세목 합계(아래 예산서 기준)에는 들어갑니다.' }));
    const pend = P.versions.filter(v => v.status !== '확정' && (v.date || '') >= (base.date || '') && v !== base).slice(-1)[0];
    if (pend) {
      const pt = pend.lines.reduce((a, l) => a + lineAmount(l), 0), ps = pend.lines.reduce((a, l) => a + lineSpent(P, l.id), 0);
      ap(box, h('h3', { text: '결재 전 ' + pend.kind + '(' + (pend.no || '') + ') 기준으로 맞춰 보기' }),
        h('div', { class: 'twrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['품목', '재원', '변경 계획', '지출 기안', '남은 금액'].map(t => h('th', { text: t })))),
          h('tbody', null, pend.lines.map(l => { const a = lineAmount(l), sp = lineSpent(P, l.id); return h('tr', null, h('td', { text: l.item || '' }), h('td', { text: l.fund }), h('td', { class: 'num', text: fmt(a) }), h('td', { class: 'num', text: fmt(sp) }), h('td', { class: 'num strong' + (a - sp < 0 ? ' neg' : ''), text: fmt(a - sp) })); })),
          h('tfoot', null, h('tr', null, h('td', { colspan: 2, text: '합계' }), h('td', { class: 'num strong', text: fmt(pt) }), h('td', { class: 'num strong', text: fmt(ps) }), h('td', { class: 'num strong', text: fmt(pt - ps) }))))),
        h('p', { class: 'muted small', text: '결재가 끝나면(내부기안 폴더로 옮겨지면) 이 표가 위의 기준이 됩니다.' }));
    }
    ap(box, h('h3', { text: '예산서 기준 (회계 결산 + 그 뒤 기안)' }), rows.length ? h('div', { class: 'twrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['재원', '계정과목', '현재 예산', '결산 집행', '이후 기안', '남은 예산'].map(t => h('th', { text: t })))), h('tbody', null, rows))) : h('p', { class: 'muted', text: '예산서를 불러오고 계획 화면에서 이 사업의 계정과목을 고르면 나타납니다.' }));
    return box;
  }
  function perfTab(P) {
    const base = baseVer(P);
    const per = P.rounds.map(r => { const res = r.docs.find(d => d.kind === '결과보고'); return { r, res, names: attendees(res) }; });
    const done = per.filter(x => x.res);
    const total = done.reduce((a, x) => a + x.names.length, 0);
    const uniq = new Set(); done.forEach(x => x.names.forEach(n => uniq.add(n.replace(/\s+/g, ''))));
    const g = base.goals || {};
    const row = (t, goal, act) => h('tr', null, h('td', { text: t }), h('td', { class: 'num', text: goal === '' || goal == null ? '-' : fmt(+goal) }), h('td', { class: 'num strong', text: fmt(act) }), h('td', { class: 'num', text: goal ? Math.round(act / goal * 100) + '%' : '' }));
    return h('div', null, h('h3', { text: '목표 대비 실적 (결과보고 기준)' }),
      h('div', { class: 'twrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['항목', '목표', '실적', '달성률'].map(t => h('th', { text: t })))),
        h('tbody', null, row('횟수', g.count, done.length), row('연인원', g.total, total), row('실인원(중복 없이)', g.real, uniq.size)))),
      h('h3', { text: '회차별' }), h('div', { class: 'twrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['회차', '결과보고', '참여 인원', '결산'].map(t => h('th', { text: t })))),
        h('tbody', null, per.map(x => h('tr', null, h('td', { text: runit(x.r) }), h('td', { text: x.res ? (x.res.no || '') + ' ' + (x.res.status || '') : '없음' }), h('td', { class: 'num', text: x.res ? x.names.length : '' }), h('td', { class: 'num', text: x.res ? fmt(+x.res.settle || 0) : '' })))))),
      h('p', { class: 'muted small', text: '실인원은 회차별 명단의 이름을 띄어쓰기 없이 비교해 중복을 뺀 수입니다. 동명이인은 명단에 구분 표시(예: 홍길동A)를 해 주세요.' }));
  }

  /* ---------- 기안 검수 ---------- */
  const RV = { items: [], prev: null };
  function reviewView() {
    const pick = h('input', { type: 'file', accept: '.hwp,.hwpx', multiple: true, class: 'hide', onchange: e => { runReview([...e.target.files]); e.target.value = ''; } });
    const prevPick = h('input', { type: 'file', accept: '.hwp,.hwpx', class: 'hide', onchange: async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const d = await GHWP.readDoc(f); d.name = f.name; RV.prev = d; rerunAll(); } catch (er) { toast(f.name + ': ' + er.message); } } });
    const drop = h('div', { class: 'drop', 'data-nofs': '', onclick: () => pick.click() }, h('b', { text: '한글 기안 파일(.hwp, .hwpx)을 여기로 끌어 놓거나 눌러서 고르세요' }), h('span', { class: 'muted', text: '여러 개를 한꺼번에 넣어도 됩니다. 파일은 이 PC 안에서만 읽고 인터넷으로 보내지 않습니다.' }));
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); runReview([...e.dataTransfer.files].filter(f => /\.hwpx?$/i.test(f.name))); });
    const page = h('div', { class: 'page' }, h('h2', { text: '기안 검수' }), pick, prevPick, drop,
      h('div', { class: 'row wrap' }, h('button', { class: 'btn', 'data-nofs': '', onclick: () => prevPick.click() }, RV.prev ? '앞 문서: ' + RV.prev.name : '앞 문서(비교할 지난 기안) 고르기'),
        RV.prev ? h('button', { class: 'btn', onclick: () => { RV.prev = null; rerunAll(); } }, '앞 문서 빼기') : null,
        RV.items.length ? h('button', { class: 'btn', onclick: () => { RV.items = []; render(); } }, '결과 모두 지우기') : null),
      h('p', { class: 'muted small', text: '확인하는 것: 파일 이름과 본문 제목(차수·월·사업명), 시행 칸 번호·날짜, 이 문서 날짜의 연도, 다른 사업 이름(본문 첫 문장·목표·내용 칸·‘○○ N차’), 차수·회기, 대상자 이름, 회의 시간·장소, 날짜와 요일, 산출식 계산, 표 합계·소계, 숫자 금액과 한글 금액, 계정과목 문구(예산서와 같은지, 띄어쓰기는 넘어감), 남은 예산, 본문 항목 번호, 붙임 번호, ‘끝.’ 표시, 결과보고 평가 빈칸, 서식 자리표시, 금액 쉼표, 자주 틀리는 맞춤법(‘보고 하오니’ 등). 앞 문서를 고르면 바뀐 줄과 앞 문서에서 남은 날짜·차수도 봅니다.' }));
    RV.items.forEach(it => ap(page, resultCard(it)));
    return page;
  }
  async function runReview(files) {
    for (const f of files) {
      try { const d = await GHWP.readDoc(f); d.name = f.name; RV.items.unshift({ doc: d, res: doReview(d) }); }
      catch (e) { RV.items.unshift({ error: e.message, name: f.name }); }
    }
    render();
  }
  function doReview(d) {
    const year = (GREVIEW.docMeta(d).year) || SET.year;
    const hasB = S.data.budgets.some(b => b.year === year);
    return GREVIEW.review(d, { prev: RV.prev, accounts: hasB ? B.accountsAll(year) : null, budgetOf: hasB ? (f, p) => B.status(year, f, p) : null,
      scanHas: ROOT.scans.size ? n => ROOT.scans.has('손잡다' + String(year).slice(2) + '-' + n) : null });
  }
  function rerunAll() { RV.items.forEach(it => { if (it.doc) it.res = doReview(it.doc); }); render(); }
  function resultCard(it) {
    if (it.error) return h('div', { class: 'rcard' }, h('h3', { text: it.name }), h('p', { class: 'warnline', text: '읽지 못했습니다: ' + it.error }));
    const r = it.res, label = { high: '고칠 것', mid: '확인', low: '참고' };
    const vcls = r.verdict === '보완 필요' ? 'high' : r.verdict === '결재 가능' ? 'ok' : 'mid';
    const body = h('div', { class: 'findings' }, r.findings.length ? r.findings.map(f => h('div', { class: 'f ' + f.sev }, h('span', { class: 'chip ' + f.sev, text: label[f.sev] }), h('b', { text: f.title }),
      f.detail ? h('div', { class: 'detail', text: f.detail }) : null, f.quotes.length ? h('ul', { class: 'quotes' }, f.quotes.map(q => h('li', { text: q }))) : null)) : h('p', { class: 'okline', text: '규칙으로 확인한 범위에서 걸리는 곳이 없습니다.' }));
    const card = h('div', { class: 'rcard' }, h('div', { class: 'rhead' }, h('span', { class: 'chip big ' + vcls, text: r.verdict }), h('h3', { text: it.doc.name }),
      h('span', { class: 'muted small', text: [r.meta.sub, r.meta.kind, r.meta.round ? r.meta.round + '차' : '', r.docTotal != null ? '금액 ' + won(r.docTotal) : ''].filter(Boolean).join(' · ') })), body,
      r.accounts.length ? h('p', { class: 'muted small', text: '찾은 계정과목: ' + [...new Set(r.accounts)].join(' / ') }) : null,
      h('div', { class: 'row wrap' }, h('button', { class: 'btn primary', onclick: () => copy(GREVIEW.reportText(r)) }, '보완 요청 문구 복사'),
        h('button', { class: 'btn', onclick: () => modal('본문 (읽은 글자)', h('pre', { class: 'plain', text: it.doc.lines.join('\n') }), null, true) }, '본문 보기'),
        r.diff ? h('button', { class: 'btn', onclick: () => modal('앞 문서와 바뀐 줄', diffView(r.diff), null, true) }, '앞 문서와 비교') : null));
    return card;
  }
  function diffView(diff) {
    const out = h('div', { class: 'diff' });
    diff.forEach((d, i) => {
      const near = diff.slice(Math.max(0, i - 1), i + 2).some(x => x[0] !== '=');
      if (d[0] === '=' && !near) return;
      ap(out, h('div', { class: 'dl ' + (d[0] === '+' ? 'add' : d[0] === '-' ? 'del' : 'same'), text: (d[0] === '=' ? '  ' : d[0] + ' ') + d[1] }));
    });
    if (!out.childNodes.length) ap(out, h('p', { text: '바뀐 줄이 없습니다.' }));
    return h('div', null, h('p', { class: 'muted small', text: '+ 이번 문서에만 있는 줄, - 앞 문서에만 있는 줄' }), out);
  }

  /* ---------- 작성 안내 ---------- */
  const GUIDE = [
    ['사업계획 (연초)', '한 해 기준이 되는 문서입니다. 이후 회차 기안은 모두 이 계획(또는 그 뒤 변경계획)을 따릅니다.', ['사업 목적·필요성, 추진 전략', '산출목표: 실인원·연인원·횟수', '회차 일정(차수·활동·시기)', '예산: 품목별 단가 × 인원 × 횟수, 계정과목은 예산서 문구 그대로', '수행인력'], ['예산서 세목 금액과 계획 합계가 같은지 확인합니다.']],
    ['변경계획 · 수정 운영계획', '예산(내역변경)이나 일정·내용이 바뀌면 씁니다. 저장하면 그 뒤 기안의 기준이 바뀝니다.', ['변경사유: 바뀌는 내용만(예산을 어디로 옮기는지는 쓰지 않음)', '※ 주요 변경사항: ‘- ○○ 예산 금액을 조정하였음’', '당초 / 변경 / 증감 비교표', '변경 후 예산과 산출근거'], ['산출목표는 예산의 넉넉한 횟수에 맞추지 않습니다.', '보조금 내역변경이면 줄어드는 사업과 늘어나는 사업 모두 변경계획이 필요합니다.']],
    ['운영계획 (회차)', '회차마다 씁니다. 계획에서 목적·대상·예산을 가져오고 일시·장소·내용만 새로 씁니다.', ['일시(요일까지)·장소·대상·인원', '프로그램 시간표', '수행인력', '이번 회차 예산'], ['앞 회차 문서를 복사했다면 차수·날짜·장소가 모두 바뀌었는지 확인합니다.']],
    ['참여자 모집 홍보', '내부결재 + 대외 공문 + 안내문으로 씁니다.', ['모집 기간·대상·인원', '신청 방법', '안내문'], ['모집은 지출 기안보다 앞 번호여야 합니다(홍보비 제외).']],
    ['홍보비', '현수막·배송비 등. 계정과목이 사업 계정이 아닌 사무비 쪽일 수 있습니다.', ['품목·수량·단가', '계정과목(예산서 문구 그대로)'], []],
    ['대관료 · 보험(배상책임공제)', '돈이 먼저 나가고 붙임 서류가 따로 있어서 보통 따로 씁니다.', ['대관 신청서·안전수칙 확인서', '공제 가입 증명'], ['행사 날짜 전에 결재가 끝나야 합니다.']],
    ['진행비', '식비·다과비·재료비·체험비·물품구입비 등을 보통 한 기안으로 묶습니다. 기안을 먼저 결재받고 나중에 쓰므로, 처음부터 정산서(물품이면 물품검수조서도)를 같이 넣어 둡니다.', ['품목별 단가 × 인원 = 금액', '합계와 본문 금액(숫자·한글)', '사업비 정산서: 예산액 / 집행액 / 예산대비 집행금액 차액 발생 사유', '물품을 사면 물품검수조서'], ['결산(집행액)은 예산보다 많으면 안 됩니다. 예산보다 적게 썼으면 지출기안에 정산서가 있어야 합니다(차액 발생 사유 포함).', '예산 인원과 실제 이용 인원은 다를 수 있습니다. 오지 않는 사람을 명단에 넣지 않습니다.']],
    ['강사비 · 통역비', '진행비 뒤에 씁니다. 지급 서류(확인서 등)가 따로 있습니다.', ['시간 × 단가 × 인원', '강사·통역사 확인 서류'], ['통역비는 시간·인원·횟수 계산이 맞는지 다시 봅니다.']],
    ['결과보고', '회차마다 반드시 있어야 합니다.', ['출석 인원(실제 온 사람)', '결산 = 이 회차 지출 기안의 집행액 합계(정산서 기준)', '만족도', '붙임: 결과보고서·출석부·프로그램 일지'], ['결산은 예산보다 많으면 안 됩니다. 적게 썼으면 그 회차 지출 기안에 정산서가 있는지 봅니다.', '결산이 지출 기안 집행액 합계와 다르면 빠진 지출 기안이 없는지 확인합니다.']],
    ['개별자립지원 (사람별)', '사람마다 사전회의 → 계획 → 연계 → 중간회의 → (바뀌면) 변경 계획 순서로 씁니다.', ['제목 괄호 안에 대상자 이름', '계획의 세부사업계획서 수 = 연계 사업의 회차·분기 수'], ['계획 결재 전에 연계를 진행하지 않습니다.', '중간회의에서 바뀐 내용이 있으면 변경 계획을 씁니다.', '문서번호를 다른 기안과 같이 쓰지 않습니다.']]
  ];
  function guideView() {
    return h('div', { class: 'page' }, h('h2', { text: '기안 작성 안내' }), h('p', { class: 'muted', text: '종류마다 꼭 들어갈 것과 주의할 점입니다. 틀린 곳이나 더할 내용이 있으면 알려 주세요. 다음 단계에서 고칠 수 있게 바꾸고, 단계별 따라 하기(튜토리얼) 모드도 붙입니다.' }),
      h('div', { class: 'cards' }, GUIDE.map(([t, d, must, warn]) => h('div', { class: 'card guide' }, h('h3', { text: t }), h('p', { text: d }),
        h('b', { text: '꼭 들어갈 것' }), h('ul', null, must.map(x => h('li', { text: x }))),
        warn.length ? [h('b', { text: '주의' }), h('ul', { class: 'warnlist' }, warn.map(x => h('li', { text: x })))] : null))));
  }

  /* ---------- 기안 폴더 자동 읽기 ---------- */
  // ‘손잡다’ 폴더를 한 번 연결하면 앱을 열 때마다 연도 폴더의 내부기안·예산서를 읽어 사업 자료를 채움(읽기만 함)
  const ROOT = { h: null, mode: 'read', perm: 'none', busy: false, last: LS.get('gian-scan', null), scans: new Set(LS.get('gian-scans', [])) };
  async function rootPerm() { try { return await ROOT.h.queryPermission({ mode: ROOT.mode }); } catch (e) { return 'denied'; } }
  async function setRoot(h, mode) { ROOT.h = h; ROOT.mode = mode; ROOT.perm = 'granted'; await S.kv.put('root', h ? { h, mode } : null); }
  function scanBar(text) {
    let b = document.getElementById('scanbar');
    if (!text) { if (b) b.remove(); return; }
    if (!b) { b = h('div', { id: 'scanbar', class: 'scanbar', role: 'status' }); document.body.append(b); }
    b.textContent = text;
  }
  async function runScan(manual) {
    if (!ROOT.h || ROOT.busy) return;
    ROOT.perm = await rootPerm();
    if (ROOT.perm !== 'granted') { if (manual) await reconnectRoot(); if (ROOT.perm !== 'granted') { render(); return; } }
    ROOT.busy = true; scanBar('기안 폴더를 살펴보는 중…');
    try {
      const cache = (await S.kv.get('scan')) || {};
      const res = await GSCAN.scan(ROOT.h, cache, (i, n) => scanBar('기안 폴더 읽는 중 ' + i + ' / ' + n));
      const rep = GSCAN.apply(S.data, res, { proj: (y, s) => proj(y, s, true), leafPaths: B.leafPaths });
      ROOT.scans = new Set(res.scans); LS.set('gian-scans', res.scans);
      await S.kv.put('scan', cache);
      const changed = rep.budgets + rep.versions + rep.docs + rep.updated;
      if (changed) save();
      ROOT.last = { at: Date.now(), total: res.total, read: res.read, errors: res.errors.slice(0, 20), rep };
      LS.set('gian-scan', ROOT.last);
      render();
      if (manual) scanReport();
      else if (changed) toast('기안 폴더에서 새로 읽음: 예산서 ' + rep.budgets + ' · 계획 ' + rep.versions + ' · 회차 기안 ' + rep.docs + (rep.updated ? ' · 바뀐 것 ' + rep.updated : ''));
    } catch (e) { toast('기안 폴더를 읽지 못했습니다: ' + (e && e.message || e)); }
    ROOT.busy = false; scanBar('');
  }
  async function reconnectRoot() {
    try { ROOT.perm = await ROOT.h.requestPermission({ mode: ROOT.mode }); } catch (e) { ROOT.perm = 'denied'; }
    return ROOT.perm;
  }
  async function linkRoot() {
    if (!window.showDirectoryPicker) { modal('기안 폴더 연결', h('p', { text: '이 브라우저는 폴더 연결을 지원하지 않습니다. PC 크롬이나 엣지에서 열어 주세요.' })); return; }
    let dir; try { dir = await window.showDirectoryPicker({ id: 'gian-root', mode: 'read' }); } catch (e) { return; }
    if (!(await GSCAN.hasYears(dir))) { modal('기안 폴더 연결', h('p', { text: '‘' + dir.name + '’ 안에서 연도 폴더(' + GSCAN.START_YEAR + ' 등)의 ‘02. 내부기안’을 찾지 못했습니다. 연도 폴더들이 들어 있는 ‘손잡다’ 폴더를 골라 주세요.' })); return; }
    await setRoot(dir, 'read'); toast('‘' + dir.name + '’ 폴더를 연결했습니다'); runScan(true);
  }
  function scanStatus() {
    if (!ROOT.h) return '아직 연결하지 않았습니다.';
    if (ROOT.busy) return '읽는 중입니다…';
    if (ROOT.perm !== 'granted') return '‘' + ROOT.h.name + '’ 폴더를 다시 연결해 주세요(브라우저를 새로 열면 한 번 묻습니다).';
    const l = ROOT.last;
    return '‘' + ROOT.h.name + '’ 폴더 연결됨' + (l ? ' · ' + new Date(l.at).toLocaleString('ko-KR') + '에 기안 ' + l.total + '개 확인' + (l.rep.notes.length ? ', 확인할 것 ' + l.rep.notes.length + '건' : '') : '');
  }
  /* 세부사업을 알 수 없는 기안(회계·행정 등)을 제목으로 대략 나눔 */
  const CATS = [['회계·급여', /임대료|관리비|공공요금|기장료|가지출|여입|인건비|급여|수당|사회보험|퇴직|이자|반납|반환|회계\s*보고|정산|통장|예치|세입|세출|추경|추가\s*경정|원천|연말\s*정산|보험료|부족분|전기|수도|가스|통신|인터넷/],
    ['운영위원회·이사회·회의', /운영\s*위원회|이사회|총회|회의/], ['인사·복무', /채용|임용|퇴사|입사|업무\s*분장|인수\s*인계|복무|출장|여비|연가|휴가|직원|종사자|범죄\s*경력/],
    ['공모·지원 신청·보고', /공모|지원\s*사업|신청|교부|보고서|제출|재단|공동모금|국고/], ['물품·시설·계약', /구입|계약|렌탈|공사|수리|설치|소모품|사무용품|명함|소화기|비품|소프트웨어|교통카드/],
    ['홍보·대외·후원', /홍보|보도|안내|협조|후원|기부|위촉|개소식|방문/]];
  const catOf = t => (CATS.find(([, re]) => re.test(t || '')) || ['기타'])[0];
  function scanReport() {
    const l = ROOT.last; if (!l) return;
    const r = l.rep, by = {};
    r.notes.forEach(n => (by[n.sub || '기타'] = by[n.sub || '기타'] || []).push(n));
    const fold = (title, body) => h('details', { class: 'fold' }, h('summary', null, title), h('div', { class: 'fold-b' }, body));
    const docLi = x => h('li', { text: (x.no ? x.no.slice(-4) + ' ' : '') + (x.title || '') });
    const mids = sb => by[sb].filter(n => n.lv === 'mid');
    const subs = Object.keys(by).sort((a, b) => mids(b).length - mids(a).length || a.localeCompare(b, 'ko'));
    const pend = Object.entries(r.pending || {}), skipped = Object.entries(r.skipped || {});
    const totalMid = r.notes.filter(n => n.lv === 'mid').length;
    modal('기안 폴더 읽은 결과', h('div', { class: 'scanrep' },
      h('p', { text: '파일 ' + l.total + '개 중 새로 읽은 것 ' + l.read + '개 · 새로 넣은 예산서 ' + r.budgets + ', 계획 버전 ' + r.versions + ', 회차 기안 ' + r.docs + (r.updated ? ', 바뀐 것 ' + r.updated : '') }),
      h('p', { class: 'muted small', text: '사람이 고친 계획·기안은 덮어쓰지 않습니다. 같은 문서번호가 결재요청 폴더와 내부기안 폴더에 다 있으면 내부기안(결재 완료) 것을 씁니다. 줄을 누르면 펼쳐집니다.' }),
      h('h4', { text: '확인할 것 · 사업별' + (totalMid ? ' (확인 ' + totalMid + '건)' : '') }),
      subs.length ? subs.map(sb => { const ms = mids(sb), ls = by[sb].filter(n => n.lv !== 'mid');
        return fold([h('b', { text: sb }), ' ', ms.length ? h('span', { class: 'chip mid', text: '확인 ' + ms.length }) : null, ' ', ls.length ? h('span', { class: 'chip low', text: '참고 ' + ls.length }) : null],
          h('ul', null, ms.concat(ls).map(n => h('li', { class: n.lv === 'mid' ? 'warnline' : 'muted', text: n.text })))); }) : h('p', { class: 'okline', text: '확인할 것이 없습니다.' }),
      pend.length ? [h('h4', { text: '결재 요청 중인 기안 · 폴더별' }), pend.map(([f, xs]) => fold([h('b', { text: f }), ' · ' + xs.length + '건'], h('ul', null, xs.map(docLi))))] : null,
      skipped.length ? [h('h4', { text: '읽고 넣지 않은 것' }), skipped.map(([k, v]) => {
        const xs = (r.skippedList || {})[k] || [];
        let body;
        if (/세부사업을 알 수 없음/.test(k) && xs.length) {
          const g = {}; xs.forEach(x => (g[catOf(x.title)] = g[catOf(x.title)] || []).push(x));
          body = [h('p', { class: 'muted small', text: '사업 이름이 제목에 없어 사업 화면에 넣지 않은 기안입니다(회계·행정 기안이 대부분). 제목으로 대략 나눴습니다.' }),
            Object.entries(g).sort((a, b) => b[1].length - a[1].length).map(([c, ys]) => fold(c + ' · ' + ys.length + '개', h('ul', null, ys.map(docLi))))];
        } else body = xs.length ? h('ul', null, xs.map(docLi)) : h('p', { class: 'muted small', text: '목록 없음' });
        return fold(k + ': ' + v + '개', body);
      })] : null,
      l.errors.length ? [h('h4', { text: '읽지 못한 파일' }), h('ul', null, l.errors.map(e => h('li', { class: 'warnline', text: e })))] : null), null, true);
  }

  /* ---------- 설정 ---------- */
  async function linkFolder() {
    if (!window.showDirectoryPicker) { modal('폴더 연결', h('p', { text: '이 브라우저는 폴더 연결을 지원하지 않습니다. PC 크롬이나 엣지에서 열어 주세요. 그동안은 이 브라우저에 저장되고, 설정에서 파일로 내보낼 수 있습니다.' })); return; }
    let dir;
    try { dir = await window.showDirectoryPicker({ id: 'gian-data', mode: 'readwrite' }); } catch (e) { return; }
    let root = null;
    if (dir.name !== '기안도우미') {
      const years = await GSCAN.hasYears(dir);
      const ok = await new Promise(res => modal('폴더 확인', h('div', null,
        h('p', { text: '고른 폴더 ‘' + dir.name + '’ 안에 ‘기안도우미’ 폴더를 만들어(있으면 그대로) 거기에 저장합니다.' }),
        years ? h('p', { text: '연도 폴더도 들어 있으니, 앱을 열 때마다 연도 폴더의 ‘02. 내부기안’과 ‘40. 결산, 사업별 계정과목’을 읽어 사업 계획·회차 기안·예산서를 자동으로 채웁니다. 기안·예산 폴더는 읽기만 하고 고치지 않습니다.' })
          : h('p', { class: 'muted', text: '연도 폴더(2026 등) 바깥, ‘손잡다’ 폴더를 고르면 기안도 자동으로 읽습니다.' })),
        [{ text: '취소', onclick: () => res(false) }, { text: '그렇게 하기', primary: true, onclick: () => res(true) }]));
      if (!ok) return;
      if (years) root = dir;
      try { dir = await dir.getDirectoryHandle('기안도우미', { create: true }); } catch (e) { toast('폴더를 만들지 못했습니다'); return; }
    }
    if (root) { await setRoot(root, 'readwrite'); setTimeout(() => runScan(true), 300); }
    const j = await S.link(dir);
    const mine = S.data.budgets.length || Object.keys(S.data.projects).length;
    if (j && mine && j.savedAt !== S.data.savedAt) {
      modal('저장된 내용이 이미 있음', h('p', { text: '폴더에 저장된 내용(' + new Date(j.savedAt).toLocaleString('ko-KR') + ')과 이 PC의 내용이 다릅니다. 어느 쪽을 쓸까요?' }), [
        { text: '폴더 내용 불러오기', primary: true, onclick: async () => { await S.replace(j); render(); toast('폴더 내용을 불러왔습니다'); } },
        { text: '이 PC 내용으로 덮어쓰기', danger: true, onclick: async () => { S.lastSync = j.savedAt; S.save(); await S.flush(); render(); toast('폴더에 저장했습니다'); } }]);
    } else if (j) { await S.replace(j); render(); toast('폴더 내용을 불러왔습니다'); }
    else { S.save(); await S.flush(); render(); toast('‘기안도우미’ 폴더에 저장했습니다'); }
  }
  async function reconnect() {
    if (ROOT.h && ROOT.perm !== 'granted') await reconnectRoot();
    // ‘손잡다’ 폴더를 허락하면 그 안의 저장 폴더는 다시 묻지 않음
    const p = S.dir ? (S.perm === 'granted' ? 'granted' : await S.reconnect()) : ROOT.perm;
    toast(p === 'granted' ? '다시 연결했습니다' : '연결하지 못했습니다'); render();
    if (ROOT.h && ROOT.perm === 'granted') runScan(false);
  }
  S.onConflict = j => modal('다른 PC에서 바뀐 내용', h('p', { text: '폴더의 파일이 다른 곳에서 ' + new Date(j.savedAt).toLocaleString('ko-KR') + '에 바뀌었습니다. 어느 쪽을 쓸까요?' }), [
    { text: '폴더 내용 불러오기', primary: true, onclick: async () => { await S.replace(j); render(); } },
    { text: '이 PC 내용으로 덮어쓰기', danger: true, onclick: async () => { S.lastSync = j.savedAt; await S.flush(); } }]);
  function setView() {
    const imp = h('input', { type: 'file', accept: '.json', class: 'hide', onchange: async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      let j; try { j = JSON.parse(await f.text()); if (!j.v) throw new Error('형식'); } catch (er) { toast('기안 도우미 파일이 아닙니다'); return; }
      const keys = Object.keys(j.projects || {});
      // 예산서 없이 사업만 든 파일(기존 기안에서 뽑은 계획 등)은 지금 내용에 합침
      if (!(j.budgets || []).length && keys.length) {
        const same = keys.filter(k => S.data.projects[k]);
        modal('사업 가져오기', h('div', null, h('p', { text: '이 파일에는 사업 ' + keys.length + '개가 들어 있습니다: ' + keys.map(k => k.replace('|', '년 ')).join(', ') }),
          h('p', { text: '지금 내용(예산서 등)은 그대로 두고 이 사업만 합칩니다.' + (same.length ? ' 이미 있는 사업(' + same.map(k => k.split('|')[1]).join(', ') + ')은 파일 내용으로 바뀝니다.' : '') })),
          [{ text: '취소' }, { text: '합치기', primary: true, onclick: () => { keys.forEach(k => { S.data.projects[k] = j.projects[k]; }); S.save(); render(); toast('사업을 가져왔습니다'); } }]);
        return;
      }
      ask('가져오기', '지금 내용을 이 파일 내용으로 바꿉니다.', '바꾸기', async () => { await S.replace(j); S.save(); render(); toast('가져왔습니다'); }, true);
    } });
    return h('div', { class: 'page narrow' }, h('h2', { text: '설정' }), imp,
      h('section', { class: 'card' }, h('h3', { text: '저장 위치' }),
        h('p', { text: S.dir ? '연결한 폴더: ‘' + S.dir.name + '’ (' + (S.perm === 'granted' ? '저장 중' : '다시 연결 필요') + ')' : '아직 이 브라우저에만 저장합니다.' }),
        h('p', { class: 'muted small', text: '시놀로지의 ‘손잡다’ 폴더(연도 폴더 바깥)를 고르면 그 안에 ‘기안도우미’ 폴더를 만들어 기안도우미.json 하나와 날짜별 백업만 씁니다. 해가 바뀌어도 같은 파일을 계속 쓰고, 다른 PC에서도 같은 내용을 봅니다. 기안·스캔 폴더에는 쓰지 않습니다.' }),
        S.status ? h('p', { class: 'muted small', text: '최근: ' + S.status }) : null,
        h('div', { class: 'row wrap' }, h('button', { class: 'btn primary', 'data-nofs': '', onclick: linkFolder }, S.dir ? '다른 폴더 연결' : '폴더 연결'),
          S.dir && S.perm !== 'granted' ? h('button', { class: 'btn', 'data-nofs': '', onclick: reconnect }, '다시 연결') : null,
          S.dir ? h('button', { class: 'btn', onclick: async () => { await S.unlink(); render(); } }, '연결 끊기') : null)),
      h('section', { class: 'card' }, h('h3', { text: '기안 폴더 자동 읽기' }), h('p', { text: scanStatus() }),
        h('p', { class: 'muted small', text: '읽는 곳: 연도 폴더(' + GSCAN.START_YEAR + '년부터)의 ‘02. 내부기안’(결재요청 폴더 포함)과 ‘40. 결산, 사업별 계정과목’. 예산서는 자립지원사업(보조금)·자체사업(자부담) 파일만 넣습니다. 새로 생기거나 바뀐 파일만 다시 읽고, 사람이 고친 계획·기안은 덮어쓰지 않습니다.' }),
        h('div', { class: 'row wrap' }, h('button', { class: 'btn primary', 'data-nofs': '', onclick: linkRoot }, ROOT.h ? '다른 폴더 연결' : '‘손잡다’ 폴더 연결'),
          ROOT.h && ROOT.perm !== 'granted' ? h('button', { class: 'btn', 'data-nofs': '', onclick: reconnect }, '다시 연결') : null,
          ROOT.h && ROOT.perm === 'granted' ? h('button', { class: 'btn', 'data-nofs': '', onclick: () => runScan(true) }, '지금 다시 읽기') : null,
          ROOT.h ? h('button', { class: 'btn', onclick: async () => { await setRoot(null, 'read'); ROOT.perm = 'none'; render(); } }, '연결 끊기') : null)),
      h('section', { class: 'card' }, h('h3', { text: '내보내기 · 가져오기' }),
        h('div', { class: 'row wrap' }, h('button', { class: 'btn', onclick: () => download('기안도우미-' + today() + '.json', JSON.stringify(S.data)) }, '파일로 내보내기'), h('button', { class: 'btn', 'data-nofs': '', onclick: () => imp.click() }, '파일 가져오기'))),
      h('section', { class: 'card' }, h('h3', { text: '화면' }),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: SET.autoFull, onchange: e => { SET.autoFull = e.target.checked; saveSet(); } }), ' 자동 전체화면 (화면을 처음 누를 때 전체화면으로)'),
        h('div', { class: 'row wrap' }, h('button', { class: 'btn', 'data-nofs': '', onclick: FS.toggle }, FS.on() ? '전체화면 끝내기' : '전체화면 켜기'), isStandalone() ? null : h('button', { class: 'btn', 'data-nofs': '', onclick: installHelp }, '홈 화면에 설치하기'))),
      h('section', { class: 'card' }, h('h3', { text: '모두 지우기' }), h('p', { class: 'muted small', text: '이 브라우저에 저장한 내용을 지웁니다. 연결한 폴더의 파일과 백업은 그대로 둡니다.' }),
        h('button', { class: 'btn danger', onclick: () => ask('모두 지우기', '예산서와 사업 자료를 이 브라우저에서 지웁니다.', '지우기', async () => { await S.unlink(); await setRoot(null, 'read'); ROOT.perm = 'none'; ROOT.last = null; LS.set('gian-scan', null); await S.kv.put('scan', {}); await S.replace(S.empty()); render(); }, true) }, '모두 지우기')));
  }

  /* ---------- 시작 ---------- */
  // Artifact 등에서 head 밖으로 나간 태그를 head로 옮김
  document.querySelectorAll('body > link[rel=manifest], body > link[rel=icon], body > link[rel=apple-touch-icon], body > meta').forEach(n => document.head.appendChild(n));
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  window.__gian = { S, B, SET, render, runReview, RV, ROOT, runScan, setRoot };
  S.load().then(async () => {
    if (!TABS.some(t => t[0] === SET.tab)) SET.tab = 'home';
    const r = await S.kv.get('root');
    if (r && r.h) { ROOT.h = r.h; ROOT.mode = r.mode || 'read'; ROOT.perm = await rootPerm(); }
    render();
    if (ROOT.h && ROOT.perm === 'granted') runScan(false);
  }).catch(() => render());
})();
