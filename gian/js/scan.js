/* 기안 폴더 자동 읽기: ‘손잡다’ 폴더를 한 번 연결하면 연도 폴더(2026~)의 ‘02. 내부기안’과
   ‘40. 결산, 사업별 계정과목’을 읽어 사업 계획 버전·회차 기안·예산서를 채움.
   폴더는 읽기만 함. 파일별로 읽은 결과를 기억해 두고 새로 생기거나 바뀐 파일만 다시 읽음.
   사람이 고친 계획·기안은 덮어쓰지 않음(자동으로 넣은 그대로일 때만 새 내용으로 바꿈). */
(function () {
  'use strict';
  const D = () => window.GDICT, RV = () => window.GREVIEW;
  const START_YEAR = 2026; // 이 앱을 쓰기 시작한 해. 그 앞 연도 폴더는 서식이 달라 읽지 않음
  const nospace = s => String(s == null ? '' : s).replace(/\s+/g, '');
  const toNum = s => +String(s).replace(/[,\s]/g, '');
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const iso = (y, m, d) => y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  const dayOf = ms => { const d = new Date(ms); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
  const PERSON = ['개별자립지원', '개별동료상담']; // 사람별 사업: 회차 표 대신 사람별로 관리(다음 단계)

  /* ---------- 폴더 훑기 ---------- */
  async function* walk(dir, path, depth) {
    for await (const [name, h] of dir.entries()) {
      const p = path ? path + '/' + name : name;
      if (h.kind === 'directory') { if (depth < 4) yield* walk(h, p, depth + 1); }
      else yield { name, path: p, handle: h };
    }
  }
  async function kids(dir) { const out = []; for await (const [name, h] of dir.entries()) if (h.kind === 'directory') out.push({ name, h }); return out; }
  const isGianDir = n => /내부기안$/.test(n.trim()) && !/스캔/.test(n);
  const isBudgetDir = n => /^40\b|계정과목/.test(n.trim());
  const isScanDir = n => /내부기안\s*스캔/.test(n);
  /* 고른 폴더가 ‘손잡다’(연도 폴더 위)인지, 연도 폴더인지, 내부기안 폴더인지 보고 읽을 곳을 정함 */
  async function places(root) {
    const out = [], ym = /^(20\d{2})$/.exec(root.name);
    const yearDir = async (y, h, base) => {
      const p = { year: y, gian: null, budget: null, scan: null, base };
      for (const k of await kids(h)) {
        const v = { h: k.h, path: base + '/' + k.name };
        if (isGianDir(k.name)) p.gian = v; else if (isScanDir(k.name)) p.scan = v; else if (isBudgetDir(k.name)) p.budget = v;
      }
      if (p.gian || p.budget) out.push(p);
    };
    if (ym) await yearDir(+ym[1], root, root.name);
    else if (isGianDir(root.name)) out.push({ year: new Date().getFullYear(), gian: { h: root, path: root.name }, budget: null, base: '' });
    else for (const k of await kids(root)) { const m = /^(20\d{2})$/.exec(k.name); if (m && +m[1] >= START_YEAR) await yearDir(+m[1], k.h, k.name); }
    return out.sort((a, b) => a.year - b.year);
  }
  async function hasYears(root) { try { return (await places(root)).length > 0; } catch (e) { return false; } }

  /* ---------- 기안 한 건에서 뽑기 ---------- */
  const field = (L, name) => { for (const l of L) { const m = new RegExp('^\\d+\\.\\s*' + name + '\\s*[:：]\\s*(.*)$').exec(l); if (m) return m[1].trim(); } return null; };
  const moneyOf = s => { if (s == null) return null; if (/없음/.test(s)) return 0; const m = /금\s*([\d,]+)\s*원/.exec(s) || /([\d,]+)\s*원/.exec(s); return m ? toNum(m[1]) : null; };
  const cellNum = c => { const m = /^\s*([\d,]+)\s*원?\s*$/.exec(c || ''); return m ? toNum(m[1]) : null; };
  /* 산출근거 한 칸: ‘식비 1,000원×2명×3회=6,000원 다과비 …’ → 품목별 단가·수량·금액 */
  const IT = /(?<![가-힣A-Za-z0-9,])([가-힣A-Za-z][가-힣A-Za-z0-9()·\/\s]*?)\s*(\([^)]*\))?\s*([\d,]+)\s*원\s*(\([^)]*\))?((?:\s*[×xX*]\s*[\d.,]+\s*[가-힣A-Za-z]*)+)\s*=\s*([\d,]+)\s*원(?:\s*중\s*([\d,]+)\s*원)?/g;
  function parseBasis(text) {
    const out = [];
    for (const m of String(text || '').replace(/\s+/g, ' ').matchAll(IT)) {
      let item = (m[1] + (m[2] || '')).replace(/\((평균|약)\)/g, '').replace(/\s+/g, ' ').trim();
      item = item.replace(/^(계|합계|소계)\s*/, '');
      const qty = m[5].split(/[×xX*]/).map(s => s.trim()).filter(Boolean).join(' × ');
      const price = toNum(m[3]), amount = toNum(m[6]), part = m[7] ? toNum(m[7]) : null;
      if (part != null) out.push({ item: item + ' (일부)', price: part, qty: '1식', amount: part, basis: m[0].trim() });
      else out.push({ item, price, qty, amount });
    }
    return out;
  }
  /* 예산과목 표(관·항·목·세목): 줄마다 계정 경로·재원·금액·품목 */
  function acctRows(doc) {
    for (const t of doc.blocks.filter(b => b.type === 'table')) {
      const hi = t.rows.findIndex(r => { const n = r.map(nospace); return n.includes('관') && n.includes('항') && n.includes('목') && n.includes('세목'); });
      if (hi < 0) continue;
      const head = t.rows.slice(Math.max(0, hi - 1), hi + 1);
      const col = re => { for (const r of head.slice().reverse()) { const i = r.findIndex(c => re.test(nospace(c))); if (i >= 0) return i; } return -1; };
      const fundCols = { '보조금': col(/^보조금$/), '자부담': col(/^자부담$/) };
      const basisCol = col(/산출근거/), totalCol = col(/^총액$|^금액$|^예산$/), srcCol = col(/^재원$/);
      const rows = [], last = ['', '', '', ''];
      for (const r of t.rows.slice(hi + 1)) {
        const first = nospace(r.find(c => c.trim()) || '');
        if (/^(총계|합계|계)$/.test(first)) break;
        const acct = [0, 1, 2, 3].map(i => { const v = (r[i] || '').replace(/\s+/g, ' ').trim(); if (v) last[i] = v; return last[i]; });
        if (!acct[3]) continue;
        let fund = null, amount = null;
        for (const f of ['보조금', '자부담']) { const i = fundCols[f]; if (i >= 0) { const v = cellNum(r[i]); if (v) { fund = f; amount = v; break; } } }
        if (!fund && srcCol >= 0) { const s = nospace(r[srcCol]); fund = /자부담/.test(s) ? '자부담' : /보조금/.test(s) ? '보조금' : null; amount = cellNum(r[totalCol]); }
        if (!fund) { fund = fundCols['자부담'] >= 0 && fundCols['보조금'] < 0 ? '자부담' : '보조금'; amount = totalCol >= 0 ? cellNum(r[totalCol]) : null; }
        const basis = r[basisCol >= 0 ? basisCol : 4] || '';
        rows.push({ acct, fund, amount, items: parseBasis(basis) });
      }
      if (rows.length) return rows;
    }
    return [];
  }
  /* 계정 경로를 예산서 문구로 맞춤(띄어쓰기만 다르면 예산서 문구로) */
  function canonAcct(segs, fund, leaf) {
    const key = segs.map(nospace).join('/');
    const hit = (leaf(fund) || []).find(p => p.split('/').map(nospace).join('/') === key);
    return hit || segs.map(s => s.replace(/\s+/g, '')).join('/');
  }
  function extract(doc, path, mt) {
    const L = doc.lines, meta = RV().docMeta(doc);
    const sum = { path, name: doc.name, mt, kind: meta.kind, sub: meta.sub, unit: meta.unit, year: meta.year, no: meta.fileOk ? '손잡다' + String(meta.year).slice(2) + '-' + meta.no : '', title: meta.fileTitle || meta.bodyTitle };
    if (!meta.isGian || !meta.fileOk) { sum.skip = '기안문이 아님'; return sum; }
    if (!meta.sub) { sum.skip = '세부사업을 알 수 없음'; return sum; }
    sum.status = /(^|\/)결재요청/.test(path.split('/').slice(2).join('/')) ? '결재 요청' : '결재 완료';
    if (/^0+$/.test(meta.no)) sum.status = '작성 중';
    sum.date = meta.mmdd && meta.mmdd !== '0000' ? iso(meta.year, +meta.mmdd.slice(0, 2), +meta.mmdd.slice(2)) : dayOf(mt);
    const q = /([1-4])\s*분기/.exec(meta.title);
    sum.n = meta.round || meta.session || (q ? +q[1] : null);
    sum.rows = acctRows(doc).map(r => ({ acct: r.acct, fund: r.fund, amount: r.amount, items: r.items }));
    const st = RV().settleOf(doc);
    if (st) sum.settle = { budget: st.budget, spent: st.spent, reason: st.reason, items: parseBasis(st.spentBasis) };
    sum.inspect = L.some(l => /검\s*수\s*조\s*서|검수하였음/.test(l));
    const pm = /(?:개별자립지원|개별동료상담)\s*\(([^)]+)\)\s*(.*)$/.exec(meta.title);
    if (pm) { sum.persons = pm[1].split(/[,，、]/).map(x => x.trim()).filter(Boolean); if (meta.kind === '연계') sum.link = pm[2].replace(/\s*연계\s*$/, '').trim(); }
    const planKinds = ['사업계획', '변경계획'];
    if (planKinds.includes(meta.kind) && !sum.n && /사업\s*(변경\s*)?계획/.test(meta.title)) {
      sum.plan = true;
      const g = L.map(l => /(\d+)\s*명\s*\/\s*(\d+)\s*명\s*\/\s*(\d+)\s*회/.exec(l)).find(Boolean);
      sum.goals = g ? { real: +g[1], total: +g[2], count: +g[3] } : null;
      if (meta.kind === '변경계획') { // 기안문의 변경내역 표(변경 후 실인원·연인원·횟수)
        for (const t of doc.blocks.filter(b => b.type === 'table')) {
          if (!t.rows.some(r => r.some(c => /변경\s*후/.test(c)))) continue;
          const row = t.rows.find(r => D().subOf(r[0] || '') === meta.sub || nospace(r[0]) === nospace(meta.sub));
          if (row) { const v = row.slice(1).map(c => cellNum(c)); if (v.length >= 8 && v[4] != null) sum.goalsTable = { real: v[4], total: v[5], count: v[6] }; }
          break;
        }
        sum.reason = field(L, '변경\\s*사유');
      }
      sum.budget = moneyOf(field(L, '예산'));
    } else {
      const content = field(L, '내용') || '';
      const act = /\d+\s*차\s*[\[(]([^\])]+)[\])]/.exec(content);
      sum.activity = act ? act[1].trim() : '';
      const dt = field(L, '일시') || '';
      const d1 = /(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(dt) || /(20\d{2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})/.exec(dt);
      sum.eventDate = d1 ? iso(+d1[1], +d1[2], +d1[3]) : '';
      const tg = field(L, '대상') || '';
      const tot = /총\s*(\d+)\s*명/.exec(tg) || /(\d+)\s*명/.exec(tg);
      sum.people = tot ? +tot[1] : null;
      if (/총\s*\d+\s*명/.test(tg) && /,/.test(tg)) sum.names = tg.replace(/\(?\s*총\s*\d+\s*명\s*\)?/, '').split(/[,，、]/).map(s => s.trim()).filter(s => /^[가-힣A-Za-z]{2,10}$/.test(s));
      sum.money = moneyOf(field(L, '결산') != null ? field(L, '결산') : field(L, '예산'));
    }
    return sum;
  }

  /* ---------- 예산서 파일 ---------- */
  function budgetEntries(name, path, mt, folderYear) {
    const fund = /자립지원사업/.test(name) ? '보조금' : /자체/.test(name) ? '자부담' : null;
    if (!fund) return { skip: '보조금(자립지원사업)·자부담(자체사업) 예산서가 아님' };
    const ym = /(20\d{2})/.exec(name) || /(?:^|\D)(\d{2})\.\s*\d{1,2}\s*월/.exec(name);
    const year = ym ? (ym[1].length === 2 ? 2000 + +ym[1] : +ym[1]) : folderYear;
    let date = null;
    const qm = /([1-4])\s*분기/.exec(name), hm = /1\s*월\s*~\s*(\d{1,2})\s*월/.exec(name), dm = /\((20\d{2})(\d{2})(\d{2})\)/.exec(name), mm = /\d{2}\.\s*(\d{1,2})\s*월/.exec(name);
    const end = m => iso(year, m, new Date(year, m, 0).getDate());
    if (qm) date = end(+qm[1] * 3); else if (hm) date = end(+hm[1]); else if (dm) date = iso(+dm[1], +dm[2], +dm[3]); else if (mm) date = end(+mm[1]);
    return { fund, year, date: date || dayOf(mt) };
  }

  /* ---------- 읽기 ---------- */
  async function scan(root, cache, onProgress) {
    const list = [], out = { docs: [], budgets: [], errors: [], read: 0, reused: 0, scans: [] };
    for (const p of await places(root)) {
      // 스캔본은 이름만 봄(대부분 사진이라 글자를 읽을 수 없음): 문서번호별로 스캔본이 있는지
      if (p.scan) try { for await (const f of walk(p.scan.h, p.scan.path, 0)) { const m = /손잡다(\d{2})-(\d+)/.exec(f.name); if (m) out.scans.push('손잡다' + m[1] + '-' + m[2]); } } catch (e) { out.errors.push(p.scan.path + ': ' + (e && e.message || e)); }
      if (p.gian) for await (const f of walk(p.gian.h, p.gian.path, 0)) if (/\.hwpx?$/i.test(f.name)) list.push(Object.assign(f, { area: 'gian', year: p.year }));
      if (p.budget) for await (const f of walk(p.budget.h, p.budget.path, 0)) if (/\.xls$/i.test(f.name)) list.push(Object.assign(f, { area: 'budget', year: p.year }));
    }
    let i = 0;
    for (const f of list) {
      i++; if (onProgress && (i % 5 === 0 || i === list.length)) onProgress(i, list.length);
      try {
        const file = await f.handle.getFile();
        const c = cache[f.path];
        if (c && c.mt === file.lastModified && c.size === file.size) { out.reused++; (f.area === 'gian' ? out.docs : out.budgets).push(c.sum); continue; }
        let sum;
        if (f.area === 'gian') { const doc = await GHWP.readDoc(file); doc.name = f.name; sum = extract(doc, f.path, file.lastModified); }
        else {
          const be = budgetEntries(f.name, f.path, file.lastModified, f.year);
          sum = { path: f.path, name: f.name, mt: file.lastModified, ...be };
          if (!be.skip) {
            const parsed = GXLS.parseBudget(GXLS.readBiff(new Uint8Array(await file.arrayBuffer())));
            if (!parsed.length) sum.skip = '예산서 형식이 아님';
            else {
              const pb = parsed[0], trees = pb.format === 'change' ? pb.trees.slice(-1) : pb.trees.slice(0, 1);
              sum.kind = pb.format === 'settle' ? '결산' : pb.format === 'change' ? '변경 예산' : /수정/.test(f.name) ? '변경 예산' : '당초 예산';
              if (sum.kind === '당초 예산') sum.date = sum.year + '-01-01';
              sum.label = pb.format === 'change' ? (pb.labels[pb.labels.length - 1] || '') : '';
              const t = trees[0];
              sum.income = t.income.map(x => ({ level: x.level, name: x.name, path: x.path, budget: x.budget }));
              sum.expense = t.expense.map(x => ({ level: x.level, name: x.name, path: x.path, budget: x.budget, cum: x.cum != null ? x.cum : null }));
            }
          }
        }
        cache[f.path] = { mt: file.lastModified, size: file.size, sum };
        out.read++; (f.area === 'gian' ? out.docs : out.budgets).push(sum);
      } catch (e) { out.errors.push(f.path + ': ' + (e && e.message || e)); }
    }
    for (const k of Object.keys(cache)) if (!list.some(f => f.path === k)) delete cache[k]; // 없어진 파일
    out.total = list.length;
    return out;
  }

  /* ---------- 앱 자료에 합치기 ---------- */
  const vHash = v => JSON.stringify([v.kind, v.no, v.date, v.status, v.goals, v.reason || '', v.lines.map(l => [l.item, l.fund, l.acct, l.price, l.qty])]);
  const dHash = d => JSON.stringify([d.kind, d.no, d.date, d.title, d.status, d.spends, d.attend || '', d.settle == null ? '' : d.settle, d.planned == null ? '' : d.planned, d.settled == null ? '' : d.settled, !!d.hasSettle, !!d.hasInspect, !!d.scan, d.budget == null ? '' : d.budget, (d.persons || []).join(','), d.link || '']);
  /* 품목 금액 합을 target에 맞춤(정산서 품목을 못 나눴을 때 큰 품목부터 덜어 냄) */
  function fitTo(items, target) {
    const out = items.map(x => Object.assign({}, x)); let diff = out.reduce((a, x) => a + x.amount, 0) - target;
    for (const x of out.slice().sort((a, b) => b.amount - a.amount)) { if (diff <= 0) break; const t = Math.min(diff, x.amount); x.amount -= t; diff -= t; }
    return out;
  }
  const ROUND_KIND = k => k === '변경계획' ? '계획' : k;
  const normT = t => nospace(t).replace(/[()（）‘’'"“”]/g, '');
  const docKey = s => /-0+$/.test(s.no) || !s.no ? s.path : s.no + '|' + normT(s.title);
  const sameDoc = (d, s) => d.src === s.path || (s.no && !/-0+$/.test(s.no) && d.no === s.no && normT(d.title) === normT(s.title));
  function apply(data, res, ctx) {
    const rep = { budgets: 0, versions: 0, docs: 0, updated: 0, notes: [], skipped: {} };
    const scans = new Set(res.scans || []);
    const note = (sub, text, lv) => rep.notes.push({ sub, text, lv: lv || 'mid' });
    const skip = (why, n) => { rep.skipped[why] = (rep.skipped[why] || 0) + (n || 1); };
    // 예산서
    for (const b of res.budgets) {
      if (b.skip) { skip(b.skip); continue; }
      if (!b.expense) continue;
      const old = data.budgets.find(x => x.src === b.path);
      if (old && old.srcMt === b.mt) continue;
      if (!old && data.budgets.some(x => !x.src && x.source === b.name)) { skip('이미 손으로 불러온 예산서'); continue; }
      const e = { id: old ? old.id : uid(), at: old ? old.at : Date.now() + rep.budgets, year: b.year, fund: b.fund, kind: b.kind, date: b.date, label: b.label || '', source: b.name, src: b.path, srcMt: b.mt, income: b.income, expense: b.expense };
      if (old) data.budgets[data.budgets.indexOf(old)] = e; else data.budgets.push(e);
      rep.budgets++;
    }
    // 같은 문서번호가 결재요청·내부기안 두 곳에 있으면 내부기안(결재 완료) 것을 씀
    const docs = res.docs.filter(s => !s.skip).sort((a, b) => (a.status === '결재 완료' ? 0 : 1) - (b.status === '결재 완료' ? 0 : 1));
    // 같은 기안인지는 문서번호와 제목으로 봄(번호를 잘못 같이 쓴 서로 다른 기안도 있어서)
    const seen = new Set(), use = [], byNo = {};
    for (const s of docs) {
      const k = docKey(s); if (seen.has(k)) continue; seen.add(k); use.push(s);
      if (!/-0+$/.test(s.no)) (byNo[s.no] = byNo[s.no] || []).push(s);
    }
    for (const no in byNo) if (byNo[no].length > 1) note(byNo[no][0].sub || '기타', no + ': 같은 문서번호를 쓴 기안이 ' + byNo[no].length + '건 있음(' + byNo[no].map(s => s.title).join(' / ') + ') → 하나는 번호를 새로 받아야 함');
    res.docs.filter(s => s.skip).forEach(s => skip(s.skip));
    const groups = {};
    for (const s of use) (groups[s.year + '|' + s.sub] = groups[s.year + '|' + s.sub] || []).push(s);
    for (const key in groups) {
      const [y, sub] = key.split('|'), year = +y, list = groups[key].sort((a, b) => a.date.localeCompare(b.date) || a.no.localeCompare(b.no));
      const plans = list.filter(s => s.plan), rounds = list.filter(s => !s.plan);
      if (!plans.length && !rounds.some(s => s.n)) continue;
      const P = ctx.proj(year, sub);
      // 계획 버전 (확인할 것은 매번 다시 만들고, 자료는 처음이거나 파일이 바뀌었을 때만 씀)
      const leaf = f => ctx.leafPaths(year, f) || [];
      const fundOf = (segs, f) => { // 표의 재원 칸보다 예산서에 그 계정이 어느 재원으로 있는지를 먼저 봄
        if (leaf(f).includes(canonAcct(segs, f, leaf))) return f;
        const o = f === '보조금' ? '자부담' : '보조금';
        return leaf(o).includes(canonAcct(segs, o, leaf)) ? o : f;
      };
      for (const s of plans) {
        const ex = P.versions.find(v => v.src === s.path || (s.no && !/-0+$/.test(s.no) && v.no === s.no));
        const prev = P.versions.filter(v => v !== ex && (v.date || '') <= s.date).slice(-1)[0] || null;
        const lines = [];
        for (const r of s.rows) {
          const fund = fundOf(r.acct, r.fund), acct = canonAcct(r.acct, fund, leaf);
          let sumIt = 0;
          for (const it of r.items) {
            const k = fund + '|' + nospace(it.item) + '|' + acct, same = l => (l.fund + '|' + nospace(l.item) + '|' + l.acct) === k && !lines.some(x => x.id === l.id);
            const o = (ex && ex.lines.find(same)) || (prev && prev.lines.find(same));
            lines.push({ id: o ? o.id : uid(), item: it.item, fund, acct, price: it.price, qty: it.qty });
            sumIt += it.amount;
          }
          if (r.amount != null && sumIt !== r.amount) note(sub, s.no + ': ' + r.acct.join(' / ') + ' 줄 금액(' + r.amount.toLocaleString('ko-KR') + '원)과 산출근거 합(' + sumIt.toLocaleString('ko-KR') + '원)이 다름');
          if (!leaf(fund).includes(acct)) note(sub, s.no + ': 계정과목 ‘' + r.acct.join(' / ') + '’이 예산서에 없음(예산서 문구와 다름)');
        }
        if (!lines.length && s.budget) note(sub, s.no + ': 예산 줄을 읽지 못함(산출근거 칸 확인)');
        const goals = s.goals || (prev ? Object.assign({}, prev.goals) : { real: '', total: '', count: '' });
        if (s.goalsTable && s.goals && JSON.stringify(s.goalsTable) !== JSON.stringify(s.goals))
          note(sub, s.no + ': 변경내역 표의 변경 후 목표(' + [s.goalsTable.real, s.goalsTable.total, s.goalsTable.count].join('/') + ')와 붙임 계획서 목표(' + [s.goals.real, s.goals.total, s.goals.count].join('/') + ')가 다름 → 붙임 계획서 값을 넣음');
        if (s.status !== '결재 완료') note(sub, s.no + ' ' + s.kind + '은(는) 아직 결재 전이라 ‘작성 중’으로 넣음(결재 후 내부기안 폴더로 옮기면 확정으로 바뀜)', 'low');
        const v = { id: ex ? ex.id : uid(), kind: s.kind, no: s.no, date: s.date, status: s.status === '결재 완료' ? '확정' : '작성 중', goals, lines,
          schedule: ex ? ex.schedule : JSON.parse(JSON.stringify(prev ? prev.schedule || [] : [])), reason: s.reason || '', src: s.path };
        v.auto = vHash(v);
        if (ex && (!ex.auto || ex.auto !== vHash(ex))) continue; // 사람이 고친 버전은 그대로
        if (ex && ex.auto === v.auto) continue; // 바뀐 것 없음
        if (ex) { P.versions[P.versions.indexOf(ex)] = v; rep.updated++; } else { P.versions.push(v); rep.versions++; }
        P.versions.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        for (const f of ['보조금', '자부담']) if (!P.accts[f]) { const a = lines.find(l => l.fund === f && leaf(f).includes(l.acct)); if (a) P.accts[f] = a.acct; }
      }
      const KIND_ITEM = { 물품구입비: /물품/, 대관료: /대관|임차/, 다과비: /다과/, 식비: /식비/, 재료비: /재료/, 숙박비: /숙박/, 강사비: /강사|ILP/i, 통역비: /통역/, 홍보비: /홍보/, 교육비: /교육/, '보험·공제': /공제|보험/, 활동비: /활동비/ };
      const fillSpend = (d, s, ver, tag) => {
        d.planned = s.money; d.hasSettle = !!s.settle; d.hasInspect = !!s.inspect; d.scan = scans.has(s.no);
        d.settled = s.settle && s.settle.spent != null ? s.settle.spent : null;
        if (!(D().SPEND_KINDS.includes(d.kind) && ver)) return;
        let rows = s.rows;
        // 정산서가 있으면 집행액으로(적게 쓴 만큼 덜 뺌). 정산서 품목 합이 집행액과 같으면 그 품목을, 아니면 예산 품목을 집행액에 맞춰 줄임
        if (d.settled != null && rows.length) {
          const its = s.settle.items, sumIts = its.reduce((a, x) => a + x.amount, 0), planned = rows.reduce((a, r) => a + (r.amount || 0), 0);
          if (rows.length === 1) rows = [Object.assign({}, rows[0], { amount: d.settled, items: its.length && sumIts === d.settled ? its : fitTo(rows[0].items, d.settled) })];
          else if (d.settled !== planned) { let left = planned - d.settled; rows = rows.map(r => { const t = Math.min(left, r.amount || 0); left -= t; return Object.assign({}, r, { amount: (r.amount || 0) - t, items: fitTo(r.items, (r.amount || 0) - t) }); }); }
        }
          for (const row of rows) {
            if (nospace(row.acct[0]) === '가지출') { note(sub, tag + ': 가지출은 남은 예산에 넣지 않음(나중에 본 계정으로 지출하는 기안이 따로 있음)', 'low'); continue; }
            const fund = fundOf(row.acct, row.fund), acct = canonAcct(row.acct, fund, leaf);
            const own = ver.lines.filter(x => x.fund === fund && x.acct === acct);
            let pool = own.length ? own : ver.lines.filter(x => x.acct === acct), loose = false;
            // 계획서나 지출 기안의 계정 문구가 조금 틀린 경우: 사업비 계정이면 이 사업의 예산 줄에서 품목으로 맞춤
            if (!pool.length && nospace(row.acct[0]) === '사업비') { pool = ver.lines.filter(x => /^사업비\//.test(x.acct)); loose = true; }
            if (!pool.length) { note(sub, tag + ': 이 사업 예산 줄에 없는 계정(' + row.acct.join(' / ') + ')에서 나간 지출이라 넣지 않음', 'low'); continue; }
            const one = row.items.length === 1 && row.amount != null;
            if (one && row.items[0].amount !== row.amount) note(sub, tag + ': 산출근거 금액(' + row.items[0].amount.toLocaleString('ko-KR') + '원)과 표 금액(' + row.amount.toLocaleString('ko-KR') + '원)이 달라 표 금액을 넣음');
            const its = one ? [{ item: row.items[0].item, amount: row.amount }] : row.items.length ? row.items : [{ item: '', amount: row.amount || 0 }];
            let used = 0;
            for (const it of its) {
              const nm = nospace(it.item).replace(/\(.*$/, '');
              const kre = KIND_ITEM[d.kind];
              const l = (nm && pool.find(x => { const xi = nospace(x.item).replace(/\(.*$/, ''); return xi === nm || nm.includes(xi) || xi.includes(nm); }))
                || (kre && pool.find(x => kre.test(x.item)))
                || (!loose && pool.length === 1 ? pool[0] : null);
              if (!l) { if (it.amount) note(sub, tag + ': ‘' + (it.item || '산출근거') + '’ ' + it.amount.toLocaleString('ko-KR') + '원을 계획의 예산 줄에 맞추지 못함'); continue; }
              d.spends[l.id] = (d.spends[l.id] || 0) + it.amount; used += it.amount;
            }
            if (row.amount != null && row.items.length > 1 && used && used !== row.amount) note(sub, tag + ': 표 금액 ' + row.amount.toLocaleString('ko-KR') + '원 가운데 산출근거로 나눈 ' + used.toLocaleString('ko-KR') + '원만 넣음');
          }
      };
      if (PERSON.includes(sub)) {
        P.pdocs = P.pdocs || [];
        for (const s of rounds) {
          if (['실적보고', '사업계획', '내역변경', '모집'].includes(s.kind)) { skip('사람별 화면에 넣지 않는 기안(모집·실적보고·내역변경 등)'); continue; }
          const ex = P.pdocs.find(d => sameDoc(d, s));
          const ver = P.versions.filter(v => v.status === '확정' && (v.date || '') <= s.date).slice(-1)[0] || P.versions[P.versions.length - 1];
          const d = { id: ex ? ex.id : uid(), kind: s.kind, no: s.no, date: s.date, title: s.title, status: s.status, spends: {}, attend: '', memo: ex ? ex.memo || '' : '', src: s.path, persons: s.persons || [], link: s.link || '' };
          fillSpend(d, s, ver, (d.persons.join(', ') || '공통') + ' ' + d.kind + '(' + s.no + ')');
          d.auto = dHash(d);
          if (ex && (!ex.auto || ex.auto !== dHash(ex))) continue;
          if (ex && ex.auto === d.auto) continue;
          if (ex) { P.pdocs[P.pdocs.indexOf(ex)] = d; rep.updated++; } else { P.pdocs.push(d); rep.docs++; }
        }
        P.pdocs.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        continue;
      }
      // 회차 기안
      for (const s of rounds) {
        if (['실적보고', '사업계획', '내역변경'].includes(s.kind) || (s.kind === '변경계획' && !s.n)) { skip('회차가 없는 기안(실적보고·내역변경 등)'); continue; }
        const n = s.n || 1;
        let r = P.rounds.find(x => x.n === n);
        const ex = r && r.docs.find(d => sameDoc(d, s));
        const ver = P.versions.filter(v => v.status === '확정' && (v.date || '') <= s.date).slice(-1)[0] || P.versions[P.versions.length - 1];
        const d = { id: ex ? ex.id : uid(), kind: ROUND_KIND(s.kind), no: s.no, date: s.date, title: s.title, status: s.status, spends: {}, attend: '', memo: ex ? ex.memo || '' : '', src: s.path };
        const tag = n + '차 ' + d.kind + '(' + s.no + ')';
        fillSpend(d, s, ver, tag);
        if (d.kind === '결과보고') { d.settle = s.money == null ? '' : s.money; d.attend = (s.names || []).join('\n'); }
        if (d.kind === '계획') d.budget = s.money;
        d.auto = dHash(d);
        if (ex && (!ex.auto || ex.auto !== dHash(ex))) continue; // 사람이 고친 기안은 그대로
        if (ex && ex.auto === d.auto) continue;
        if (!r) { r = { id: uid(), n, docs: [] }; P.rounds.push(r); P.rounds.sort((a, b) => a.n - b.n); }
        if (ex) { r.docs[r.docs.indexOf(ex)] = d; rep.updated++; } else { r.docs.push(d); rep.docs++; }
        // 운영계획에서 회차 이름·날짜·인원을 계획의 회차 일정에 채움(빈 칸만)
        if (d.kind === '계획' && (s.activity || s.eventDate)) {
          let any = false;
          for (const v of P.versions) {
            v.schedule = v.schedule || [];
            const e = v.schedule.find(x => x.n === n);
            if (e) { if (!e.name && s.activity) e.name = s.activity; if (!e.date && s.eventDate) e.date = s.eventDate; if ((e.people === '' || e.people == null) && s.people) e.people = s.people; any = true; }
          }
          if (!any) for (const v of P.versions) { v.schedule.push({ n, name: s.activity, date: s.eventDate, people: s.people == null ? '' : s.people }); v.schedule.sort((a, b) => a.n - b.n); }
        }
      }
    }
    return rep;
  }
  window.GSCAN = { places, hasYears, scan, apply, extract, parseBasis, budgetEntries, START_YEAR };
})();
