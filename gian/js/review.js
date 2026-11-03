/* 기안 검수: 정해진 규칙으로 PC 안에서만 확인함(인터넷으로 보내지 않음).
   sev: 'high' 고칠 것, 'mid' 확인, 'low' 참고, 'ok' 통과
   규칙은 2026년 실제 기안(사본)으로 맞춤: 서식에서 늘 나오는 것(이력·경력 줄, 견적 비교표, 보조금·자부담을 합친 총계 칸 등)은 넘어감 */
(function () {
  'use strict';
  const D = () => window.GDICT;
  const WD = '일월화수목금토';
  const NUM = '\\d[\\d,]*(?:\\.\\d+)?';
  const UNITCH = '[가-힣A-WYZa-wyz]{0,4}';
  const FACT = NUM + '\\s*' + UNITCH + '%?(?:\\s*\\([^()×xX*✕=]{0,12}\\))?';
  const EXPR = new RegExp('(' + FACT + '(?:\\s*[×xX*✕]\\s*' + FACT + ')+)(?:\\s*=\\s*(' + NUM + ')\\s*원?)?', 'g');
  const MEAS = /^(?:cm|mm|m|km|g|kg|ml|l|평|인치|㎝|㎜|㎡|㎏)$/i; // 규격(220x50, 90mm*50mm 등)은 계산하지 않음
  const toNum = s => +String(s).replace(/,/g, '');
  const fmt = n => (Math.round(n) || 0).toLocaleString('ko-KR');
  const nospace = s => String(s).replace(/\s+/g, '');
  const normTitle = s => nospace(s).replace(/[‘’'"“”`]/g, "'").replace(/[()（）ㆍ·・]/g, '').replace(/년도/g, '년').replace(/\.hwpx?$/i, '');
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function korNum(s) {
    const dg = { 영: 0, 공: 0, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 륙: 6, 칠: 7, 팔: 8, 구: 9 };
    const sm = { 십: 10, 백: 100, 천: 1000 }, bg = { 만: 1e4, 억: 1e8, 조: 1e12 };
    let total = 0, sec = 0, cur = 0, ok = false;
    const t = String(s).replace(/[,\s]/g, '');
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (/\d/.test(c)) { let j = i; while (j < t.length && /\d/.test(t[j])) j++; cur = +t.slice(i, j); i = j - 1; ok = true; }
      else if (c in dg) { cur = dg[c]; ok = true; }
      else if (c in sm) { sec += (cur || 1) * sm[c]; cur = 0; ok = true; }
      else if (c in bg) { sec += cur; total += (sec || 1) * bg[c]; sec = 0; cur = 0; ok = true; }
      else if (c === '원' || c === '정' || c === '금') continue;
      else return null;
    }
    return ok ? total + sec + cur : null;
  }

  function docMeta(doc) {
    const base = String(doc.name || '').replace(/\.[^.]+$/, '').trim();
    const m = D().FILE_RE.exec(base);
    let fileTitle = '', yy = null, no = null, mmdd = null;
    if (m) {
      yy = +m[2]; no = m[3];
      let rest = m[4].trim();
      const d = /^(\d{2})(\d{2})\s+(.*)$/.exec(rest);
      if (d) { mmdd = d[1] + d[2]; rest = d[3]; }
      fileTitle = rest.trim();
    }
    let bodyTitle = '';
    for (const l of doc.lines.slice(0, 40)) { const t = /^제\s*목\s*[:：|]?\s*(.+)$/.exec(l); if (t) { bodyTitle = t[1].replace(/\s*\|\s*/g, ' ').trim(); break; } }
    const title = fileTitle || bodyTitle || base;
    let year = yy != null ? 2000 + yy : null;
    if (!year) {
      const c = {}; for (const l of doc.lines) for (const x of l.matchAll(/(20\d{2})\s*[년.]/g)) c[x[1]] = (c[x[1]] || 0) + 1;
      const best = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; year = best ? +best : new Date().getFullYear();
    }
    const kind = D().kindOf(title), sub = D().subOf(title), unit = sub ? D().unitOf(sub) : null;
    const rm = /(\d+)\s*차(?!\s*년)/.exec(title), gm = /(\d+)\s*회기/.exec(title);
    // 기안문이 아닌 문서(붙임·일지·만족도조사지·서식): 파일 이름도 기안 형식이 아니고 본문에 '제목' 줄도 없음
    const isGian = !!m || !!bodyTitle;
    return { base, fileOk: !!m, fileTitle, bodyTitle, title, year, no, mmdd, kind, sub, unit, isGian, round: rm ? +rm[1] : null, session: gm ? +gm[1] : null };
  }

  /* 제목에서 차수·월·분기·회기·반기·세부사업을 뽑아 비교에 씀 */
  function titleKeys(t) {
    const k = {};
    for (const x of String(t).matchAll(/(\d+)\s*(차|회기|회차|월|분기)/g)) (k[x[2]] = k[x[2]] || new Set()).add(+x[1]);
    const h = /(상|하)반기/.exec(t); if (h) k['반기'] = new Set([h[1]]);
    const s = D().subOf(t); if (s) k['사업'] = new Set([s]);
    return k;
  }

  function lcsRatio(a, b) {
    if (!a.length || !b.length) return 0;
    let prev = new Uint16Array(b.length + 1);
    for (let i = 1; i <= a.length; i++) {
      const cur = new Uint16Array(b.length + 1);
      for (let j = 1; j <= b.length; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
      prev = cur;
    }
    return 2 * prev[b.length] / (a.length + b.length);
  }

  /* 맞춤법·띄어쓰기: 실제 검토에서 반복해서 나온 것만 */
  const SPELL = [
    [/(보고|결재|진행|협의|참여|확인|운영|실시|지원|연계|제출|구입|지출|지급|변경|신청|요청|검토|공유|안내|홍보|모집|관람|참석|작성|계획)\s+하(오니|여|고자|였|기|는|며|고)/, m => '‘' + m[0] + '’ → ‘' + m[0].replace(/\s+/, '') + '’'],
    [/(주최|센터|기관|구청|업체)측/, m => '‘' + m[0] + '’ → ‘' + m[1] + ' 측’'],
    [/하려함(?=[\s.,)]|$)/, () => '‘하려함’ → ‘하려 함’'],
    [/평균\s*(\d+(?:\.\d+)?)의/, m => '‘' + m[0] + '’ → ‘평균 ' + m[1] + '점의’'],
    [/결제\s*바랍니다/, () => '‘결제 바랍니다’ → ‘결재 바랍니다’'],
    [/금새/, () => '‘금새’ → ‘금세’'], [/익숙치/, () => '‘익숙치’ → ‘익숙지’'], [/당자사/, () => '‘당자사’ → ‘당사자’'],
    [/몇일/, () => '‘몇일’ → ‘며칠’'], [/역활/, () => '‘역활’ → ‘역할’'], [/됬/, () => '‘됬’ → ‘됐’'], [/할께/, () => '‘할께’ → ‘할게’'],
    [/어떻해/, () => '‘어떻해’ → ‘어떻게’'], [/왠만/, () => '‘왠만’ → ‘웬만’'], [/오랫만/, () => '‘오랫만’ → ‘오랜만’'],
    [/(일일|곰곰|틈틈|깨끗|번번)히/, m => '‘' + m[0] + '’ → ‘' + m[1] + '이’'], [/꼼꼼이/, () => '‘꼼꼼이’ → ‘꼼꼼히’']
  ];

  function review(doc, opts) {
    opts = opts || {};
    const F = [];
    const add = (sev, code, title, detail, quotes) => F.push({ sev, code, title, detail: detail || '', quotes: (quotes || []).slice(0, 6) });
    const meta = docMeta(doc);
    const L = doc.lines;
    const tables = doc.blocks.filter(b => b.type === 'table');
    const G = meta.isGian;

    // 1. 파일 이름과 본문 제목
    if (!G) add('low', 'notgian', '기안문이 아닌 문서로 보임', '붙임·일지·조사지 같은 문서로 보고 날짜·계산·합계·표기만 확인했습니다.');
    else {
      if (!meta.fileOk) add('low', 'name', '파일 이름이 기안 형식이 아님', '‘손잡다26-번호 MMDD 제목’ 형식이면 번호·날짜·제목을 함께 확인할 수 있습니다.');
      if (meta.fileOk && /^0+$/.test(meta.no)) add('low', 'no', '문서번호를 아직 받지 않음(' + meta.no + ')', '결재 전에 문서대장에서 번호를 받아 파일 이름과 시행 칸에 넣어 주세요.');
      if (meta.fileTitle && meta.bodyTitle && normTitle(meta.fileTitle) !== normTitle(meta.bodyTitle)) {
        const a = titleKeys(meta.fileTitle), b = titleKeys(meta.bodyTitle);
        const diff = Object.keys(a).filter(k => b[k] && ![...a[k]].some(v => b[k].has(v))); // 겹치는 값이 하나도 없을 때만
        const nf = normTitle(meta.fileTitle), nb = normTitle(meta.bodyTitle);
        const KN = { 차: '차수', 월: '월', 분기: '분기', 회기: '회기', 회차: '회차', 반기: '상·하반기', 사업: '사업명' };
        if (diff.length) add('high', 'title', '파일 이름과 본문 제목이 다름(' + diff.map(k => KN[k]).join('·') + ')', '파일: ‘' + meta.fileTitle + '’\n본문: ‘' + meta.bodyTitle + '’\n앞 기안을 고쳐 쓰다 남은 제목인지 확인해 주세요.');
        else if (nf.includes(nb) || nb.includes(nf) || lcsRatio(nf, nb) >= 0.75) add('low', 'title', '파일 이름과 본문 제목의 표현이 조금 다름', '파일: ‘' + meta.fileTitle + '’\n본문: ‘' + meta.bodyTitle + '’');
        else add('mid', 'title', '파일 이름과 본문 제목이 다름', '파일: ‘' + meta.fileTitle + '’\n본문: ‘' + meta.bodyTitle + '’');
      }
    }
    // 서식 자리표시가 남음
    const ph = L.filter(l => /단위사업명\s*[-_]|[-_]\s*세부사업명|단위사업명\s+세부사업명|○○○|ＯＯＯ|OOO|00월\s*00일|0000\.\s*00\./.test(l)); // 표 머리글 ‘세부사업명’은 넘어감
    if (ph.length) add('high', 'placeholder', '서식의 자리표시 문구가 남아 있음', '‘단위사업명’, ‘○○○’처럼 채우지 않은 칸이 있습니다.', ph);

    // 2. 시행 칸 번호·날짜 (앞 기안의 번호가 그대로 남는 일이 실제로 있었음)
    if (G && meta.fileOk) {
      for (const l of L) {
        const x = /시\s*행\s*손잡다(\d{2})-(\d+)\s*\(?\s*(20\d{2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})/.exec(l);
        if (!x) continue;
        const fileNo = +meta.no, rowNo = +x[2];
        const dd = meta.mmdd && meta.mmdd !== '0000' ? Math.abs(new Date(meta.year, +x[4] - 1, +x[5]) - new Date(meta.year, +meta.mmdd.slice(0, 2) - 1, +meta.mmdd.slice(2))) / 864e5 : 0;
        if (!fileNo && rowNo) add('high', 'sihaeng', '시행 칸에 다른 문서의 번호가 남아 있음', '파일은 아직 번호가 없는데(' + meta.no + ') 시행 칸에는 손잡다' + x[1] + '-' + x[2] + '이(가) 적혀 있습니다.', [l]);
        else if (fileNo && rowNo !== fileNo) add('high', 'sihaeng', '시행 칸 번호가 파일 번호와 다름', '파일: 손잡다' + String(meta.year).slice(2) + '-' + meta.no + '\n시행 칸: 손잡다' + x[1] + '-' + x[2] + '\n앞 기안(운영계획 등)의 번호가 그대로 남았는지 확인해 주세요.', [l]);
        else if (dd > 7) add('mid', 'sihaeng', '시행 칸 날짜가 파일 날짜와 다름', '파일: ' + +meta.mmdd.slice(0, 2) + '. ' + +meta.mmdd.slice(2) + '.\n시행 칸: ' + x[4] + '. ' + x[5] + '.', [l]);
        if (+x[3] !== meta.year) add('high', 'sihaeng', '시행 칸 연도가 ' + meta.year + '년이 아님', '', [l]);
        break;
      }
    }

    // 3. 연도: 이 문서의 날짜 칸(시행·검수·지출일·일시 등)에 다른 해가 있으면 고칠 것, 그 밖의 다른 해 날짜는 확인
    const titleYears = new Set(meta.title.match(/20\d{2}/g) || []);
    const SKIPY = /생년|설립|등록일|취득|자격|졸업|입학|수료|경력|이력|보도|연락처|전화|휴대|보험\s*기간|운용\s*기간|계약\s*기간|귀속|평\s*가|환류|필요성|사전\s*준비|현재\s*상황|환경\s*변화|의거|법률|법」|제정|개정|지침|전년|작년|지난해|이월|결산|정산|반납|반환|대비|비교|실적|활동\s*내역|부터|이어|통해|예산\s*\(A\)/;
    const DATEF = /시\s*행|검\s*수|지출일|제출일|지급일|납부일|일\s*시|일\s*자/;
    const OWN = /기\s*간|시\s*기|날\s*짜|결재\s*바랍니다|하오니/;
    const yHigh = [], yMid = [];
    for (const l of L) {
      if (/^\s*(?:\|\s*)*(?:19|20)\d{2}\s*[.\-~]/.test(l) && !DATEF.test(l)) continue; // 이력·경력 표
      if (meta.fileOk && /시\s*행\s*손잡다/.test(l)) continue; // 시행 칸은 위(2)에서 봄
      for (const x of l.matchAll(/(?<![\d\-.])(20\d{2})(?=\s*(?:년|\.\s*\d))/g)) {
        const y = +x[1];
        if (y >= meta.year) continue;
        const full = new RegExp('(?<!\\d)' + y + '\\s*(?:년\\s*\\d{1,2}\\s*월\\s*\\d{1,2}\\s*일|\\.\\s*\\d{1,2}\\s*\\.\\s*\\d{1,2})').test(l);
        if (full && DATEF.test(l) && !/생년|설립|활동\s*내역|취득/.test(l)) { yHigh.push(l); continue; }
        if (SKIPY.test(l) || titleYears.has(x[1]) || y < meta.year - 3) continue;
        if (new RegExp('~\\s*(?:' + meta.year + '|' + (meta.year + 1) + ')').test(l)) continue; // 올해까지 이어지는 기간
        if (y === meta.year - 1 && meta.mmdd && +meta.mmdd.slice(0, 2) <= 3 && /1[0-2]\s*월|하반기|4\s*분기|연말/.test(l)) continue; // 연초의 지난해 12월분
        if (OWN.test(l) && (full || /년\s*\d{1,2}\s*월|년\s*제?\s*\d+\s*차/.test(l))) yHigh.push(l);
        else if (full) yMid.push(l);
      }
    }
    if (yHigh.length) add('high', 'year', '이 문서의 날짜에 ' + meta.year + '년이 아닌 연도가 있음', '시행·검수·지출일·일시·기간처럼 이 기안의 날짜인데 지난 연도입니다. 앞 문서를 고쳐 쓰다 남은 것인지 확인해 주세요.', [...new Set(yHigh)]);
    if (yMid.length) add('mid', 'year', meta.year + '년이 아닌 날짜가 있음', '지난 일을 적은 것이면 그대로 두면 됩니다.', [...new Set(yMid)]);

    // 4. 다른 사업 이름: ‘다른 세부사업 N차’ 또는 제목·사업명·목표·내용 칸에 다른 세부사업 이름
    const skipMix = !G || !meta.sub || ['개별자립지원', '개별동료상담', '사업평가회'].includes(meta.sub) || ['사업계획', '실적보고', '변경계획', '내역변경', '연계', '기타'].includes(meta.kind);
    if (!skipMix) {
      const WEAK = new Set(['자조모임', '배리어프리존형성', '윷놀이한마당', '퀴즈대회', '정책제안', '동료상담']); // 홍보 경로·일반 낱말로도 쓰임
      const FIELD = /^(?:\d+\.\s*)?(?:제\s*목|사\s*업\s*명|세부\s*사업|프로그램\s*명|목\s*[표적]|내\s*용)\s*[:：|]/;
      const hits = {};
      for (const l of L) {
        if (/이력|경력|자격|[■□]/.test(l)) continue;
        const t = nospace(l);
        for (const [s, re] of D().SUB_KW) {
          if (s === meta.sub) continue;
          const strong = new RegExp('(?:' + re.source + ')\\d+(?:차|회기|회차)', re.flags).test(t);
          const field = !WEAK.has(s) && FIELD.test(l) && re.test(t) && !/연계|비교|협조|참고/.test(l);
          if (strong || field) (hits[s] = hits[s] || []).push(l);
        }
      }
      for (const k in hits) add('high', 'mix', '다른 사업 이름이 들어 있음: ‘' + k + '’', '이 기안은 ‘' + meta.sub + '’ 기안입니다. 앞 기안을 복사하다 남은 내용인지 확인해 주세요.', [...new Set(hits[k])]);
    }
    // 본문 첫 문장 ‘○○ 사업 중 △△’과 사업계획서 표의 사업 이름 칸(사업계획·변경계획에도 봄)
    if (G && meta.sub && meta.sub !== '사업평가회') {
      const sent = L.find(l => /수행에\s*있어/.test(l));
      const m = sent && /([가-힣A-Za-z]+)\s*사업\s*중\s*([가-힣A-Za-z ]+?(?:\(|의|을|를|\s*\d|,|$))/.exec(sent);
      if (m) {
        const su = D().subOf(m[2]), un = m[1];
        if ((su && su !== meta.sub) || (meta.unit && D().UNIT_SUBS[un] && un !== meta.unit)) add('high', 'mix', '본문 첫 문장의 사업 이름이 제목과 다름', '제목은 ‘' + (meta.unit ? meta.unit + ' › ' : '') + meta.sub + '’입니다. 앞 기안을 복사하다 남은 문장인지 확인해 주세요.', [sent]);
      }
      if (['사업계획', '변경계획'].includes(meta.kind)) { // 같은 단위사업의 다른 세부사업(증감표 등)은 넘어감
        const bad = [];
        for (const t of tables) for (const r of t.rows) {
          const c = nospace(r.find(x => x.trim()) || '').replace(/사업$/, '');
          if (!c || c === nospace(meta.sub)) continue;
          const other = D().SUB_KW.find(([s]) => s !== meta.sub && nospace(s) === c && D().unitOf(s) !== meta.unit) || (D().UNIT_SUBS[c] && c !== meta.unit ? [c] : null);
          if (other) bad.push(r.join(' | '));
        }
        if (bad.length) add('mid', 'mix', '사업계획서 표에 다른 사업 이름이 있음', '표의 사업 이름 칸이 이 사업(' + meta.sub + ')과 다릅니다. 앞 계획서를 복사하다 남은 칸인지 확인해 주세요.', [...new Set(bad)]);
      }
    }
    if (G && meta.sub && !['체육대회', 'PT 교실'].includes(meta.sub)) {
      const sp = L.filter(l => /체육활동의\s*기회를?\s*제공/.test(l));
      if (sp.length) add('mid', 'mix', '만족도 문항이 체육 사업 것임', '‘체육활동의 기회’ 문항이 있습니다. 이 사업에 맞는 문항인지 확인해 주세요.', sp);
    }

    // 5. 차수·회기: 이 사업 이름 바로 뒤의 차수만 봄(‘역량강화 2차 교육’ 같은 다른 차수는 넘어감)
    if (G && meta.round) {
      let head = null;
      if (meta.sub) { const kw = D().SUB_KW.find(([s]) => s === meta.sub); head = kw ? '(?:' + kw[1].source + ')' : null; }
      else { const pm = /([가-힣A-Za-z]{2,})\s*제?\s*\d+\s*차/.exec(meta.title); if (pm) head = reEsc(pm[1]); }
      if (head) {
        const re = new RegExp(head + '제?(\\d+)차', 'gi'), bad = [];
        for (const l of L) for (const x of nospace(l).matchAll(re)) if (+x[1] !== meta.round && !/지난|이전|누적|전회|\d\s*~/.test(l)) bad.push(l);
        if (bad.length) add('high', 'round', '제목은 ' + meta.round + '차인데 다른 차수가 있음', '앞 회차 문서에서 남은 차수인지 확인해 주세요.', [...new Set(bad)]);
      }
    }
    if (G && meta.session) {
      const bad = [];
      for (const l of L) for (const x of l.matchAll(/(\d+)\s*회기/g)) if (+x[1] !== meta.session && !/\d\s*[~,]\s*\d+\s*회기|총\s*\d+\s*회기|\d+\s*회기\s*[~,]/.test(l)) bad.push(l);
      if (bad.length) add('mid', 'round', '제목은 ' + meta.session + '회기인데 다른 회기가 있음', '', [...new Set(bad)]);
    }

    // 6. 개별자립지원·개별동료상담: 제목 괄호 안 대상자와 본문 괄호 안 대상자
    const who = /(개별자립지원|개별동료상담)\s*\(\s*([가-힣]{2,4})\s*\)/.exec(meta.title);
    if (G && who) {
      const bad = L.filter(l => [...l.matchAll(/(개별자립지원|개별동료상담)\s*\(\s*([가-힣]{2,4})\s*\)/g)].some(x => x[2] !== who[2]));
      if (bad.length) add('high', 'person', '본문의 대상자 이름이 제목(' + who[2] + ')과 다름', '앞 사람의 기안을 복사하다 남은 이름인지 확인해 주세요.', bad);
    }

    // 7. 회의 진행 보고: 기안문과 회의록의 시간·장소
    if (G && ['사전회의', '중간회의'].includes(meta.kind)) {
      const times = new Map(), places = new Map();
      for (const l of L) {
        if (/일\s*시/.test(l)) for (const x of l.matchAll(/(\d{1,2})\s*:\s*(\d{2})\s*[~\-–]\s*(\d{1,2})\s*:\s*(\d{2})/g)) { const k = +x[1] + ':' + x[2] + '~' + +x[3] + ':' + x[4]; if (!times.has(k)) times.set(k, l); }
        const p = /^(?:\d+\.\s*)?장\s*소\s*[:：|]\s*([^|]+?)\s*(?:\||$)/.exec(l);
        if (p && p[1].trim()) { const k = nospace(p[1]); if (![...places.keys()].some(q => q.includes(k) || k.includes(q))) places.set(k, l); }
      }
      if (times.size > 1) add('mid', 'meeting', '회의 시간이 서로 다름', [...times.keys()].join(' / '), [...times.values()]);
      if (places.size > 1) add('mid', 'meeting', '회의 장소가 서로 다름', '기안문·회의록·참석부의 장소를 하나로 맞춰 주세요.', [...places.values()]);
    }

    // 8. 날짜와 요일
    const dateRe = /(?:(20\d{2})\s*[.\-/]\s*)?(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*\.?\s*\(\s*([월화수목금토일])\s*\)/g;
    for (const l of L) for (const x of l.matchAll(dateRe)) {
      const y = x[1] ? +x[1] : meta.year, mo = +x[2], da = +x[3];
      const dt = new Date(y, mo - 1, da);
      if (dt.getMonth() !== mo - 1 || dt.getDate() !== da) { add('high', 'date', '없는 날짜: ' + x[0].trim(), '', [l]); continue; }
      if (WD[dt.getDay()] !== x[4]) {
        const alt = !x[1] ? new Date(y + 1, mo - 1, da) : null;
        if (alt && WD[alt.getDay()] === x[4]) continue;
        add('high', 'weekday', '요일이 맞지 않음: ' + x[0].trim(), y + '년 ' + mo + '월 ' + da + '일은 ' + WD[dt.getDay()] + '요일입니다.', [l]);
      }
    }

    // 9. 산출식(단가 × 인원 × 횟수 = 금액). 평균 단가를 반올림한 차이(단가 10원 미만)는 넘어감
    const cellNum = c => { const m = /^\s*([-△▲]?)\s*(\d[\d,]*)\s*원?\s*$/.exec(c || ''); if (!m) return null; const v = toNum(m[2]); return m[1] ? -v : v; };
    const calcSeen = new Set();
    const calcRow = (cells, rowLine) => {
      cells.forEach((c, i) => {
        for (const x of c.matchAll(EXPR)) {
          const facs = x[1].split(/[×xX*✕]/).map(f => { const m = /(\d[\d,]*(?:\.\d+)?)\s*([가-힣A-Za-z㎝㎜㎡㎏]*)\s*(%?)/.exec(f); return m ? { v: toNum(m[1]) / (m[3] ? 100 : 1), u: m[2] } : null; });
          if (facs.length < 2 || facs.some(f => !f || isNaN(f.v)) || facs.some(f => MEAS.test(f.u))) continue;
          const prod = facs.reduce((a, f) => a * f.v, 1);
          const wi = facs.findIndex(f => f.u === '원'), other = prod / (facs[wi < 0 ? 0 : wi].v || 1);
          const near = v => Math.abs(prod - v) <= 0.5 || (Math.abs(prod - v) <= Math.max(1, other * 10) && Math.abs(prod - v) / Math.max(1, Math.abs(v)) < 0.005);
          let shown = x[2] != null ? toNum(x[2]) : null, where = '';
          if (shown == null) {
            if (wi < 0 || cells.length < 2) continue; // 옆 칸과 견주는 것은 ‘원’이 붙은 산출식만
            if (cells.some(cc => { const v = cellNum(cc); return v != null && near(Math.abs(v)); })) continue;
            for (let j = i + 1; j < cells.length; j++) { const v = cellNum(cells[j]); if (v != null) { shown = Math.abs(v); where = ' (옆 칸 금액)'; break; } }
            if (shown == null) continue;
          }
          if (near(shown)) continue;
          const key = x[0].replace(/\s+/g, '') + '|' + shown;
          if (calcSeen.has(key)) continue; calcSeen.add(key);
          add('high', 'calc', '계산이 맞지 않음: ' + x[0].trim().replace(/\s*\n\s*/g, ' ') + where, '계산하면 ' + fmt(prod) + '원인데 ' + fmt(shown) + '원으로 적혀 있습니다.', [rowLine]);
        }
      });
    };
    for (const b of doc.blocks) {
      if (b.type === 'p') b.text.split('\n').forEach(t => calcRow([t], t.trim()));
      else b.rows.forEach(r => calcRow(r, r.join(' | ')));
    }

    // 10. 표 합계·소계. 보조금·자부담 두 칸을 합쳐 한 칸에 적은 총계, 달성률·수량·단가 열, △(감액)도 처리
    const isTot = c => /^(합\s*계|총\s*계|계|총\s*액|합)$/.test(nospace(c));
    const isSub = c => /^소\s*계$/.test(nospace(c));
    const tableTotals = [], totalRows = [], sumSeen = new Set();
    for (const t of tables) {
      const firstNum = t.rows.findIndex(r => r.some((c, ci) => ci > 0 && cellNum(c) != null));
      const head = []; t.rows.slice(0, Math.max(0, firstNum)).forEach(r => r.forEach((c, ci) => { head[ci] = (head[ci] || '') + ' ' + c; }));
      const width = Math.max(...t.rows.map(r => r.length));
      let acc = [], subs = [];
      for (const r of t.rows) {
        const fi = r.findIndex(c => c.trim()), first = fi < 0 ? '' : r[fi];
        if (isTot(first) || isSub(first)) {
          const base = isTot(first) && subs.length ? subs : acc;
          const rowVals = [];
          r.forEach((c, ci) => {
            const v = cellNum(c); if (v == null || ci <= fi) return;
            rowVals.push(v);
            if (/율|%|수량|단가/.test(head[ci] || '')) return;
            const colSum = cols => { let s = 0, n = 0; for (const row of base) for (const k of cols) { const x = cellNum(row[k]); if (x != null) { s += x; n++; } } return n ? s : null; };
            const vals = base.map(row => cellNum(row[ci])).filter(x => x != null);
            if (vals.length && v <= 100 && vals.every(x => Math.abs(x) <= 100)) return; // 달성률·인원 수
            const sum = colSum([ci]);
            let nx = ci + 1; while (nx < width && !String(r[nx] || '').trim()) nx++; // 합쳐진 칸은 다음 값 칸 앞까지
            const span = []; for (let k = ci; k < Math.max(nx, ci + 1); k++) span.push(k);
            const spanSum = span.length > 1 ? colSum(span) : null;
            if (sum == null && spanSum == null) { tableTotals.push(v); return; } // 위 칸이 글자뿐이면 견줄 수 없음
            if (sum === v || spanSum === v) { tableTotals.push(v); return; }
            const key = r.join('|') + ci; if (sumSeen.has(key)) return; sumSeen.add(key);
            add('high', 'sum', (isSub(first) ? '소계' : '합계') + '가 맞지 않음', '위 칸을 더하면 ' + fmt(sum != null ? sum : spanSum) + (sum != null && spanSum != null && spanSum !== sum ? '(합쳐진 옆 칸까지 더하면 ' + fmt(spanSum) + ')' : '') + '인데 ' + fmt(v) + '으로 적혀 있습니다.', [r.join(' | ')]);
          });
          totalRows.push(rowVals);
          if (isSub(first)) { subs.push(r); acc = []; } else { acc = []; subs = []; }
        } else if (r.some((c, ci) => ci > 0 && cellNum(c) != null)) acc.push(r);
      }
    }

    // 11. 금액 한글 표기, 본문 금액과 표
    const moneyHits = [];
    for (const l of L) {
      for (const x of l.matchAll(/금\s*([\d,]+)\s*원\s*\(\s*(?:금\s*)?([일이삼사오육륙칠팔구십백천만억영공\d,\s]+)\s*원?\s*정?\s*\)/g)) moneyHits.push([toNum(x[1]), korNum(x[2]), x[0], l]);
      for (const x of l.matchAll(/금\s*([일이삼사오육륙칠팔구십백천만억영공]+)\s*원?\s*정?\s*\(\s*([\d,]+)\s*원\s*\)/g)) moneyHits.push([toNum(x[2]), korNum(x[1]), x[0], l]);
    }
    for (const [n, k, q, l] of moneyHits) if (k != null && n !== k) add('high', 'money', '숫자 금액과 한글 금액이 다름: ' + q, '숫자는 ' + fmt(n) + '원, 한글은 ' + fmt(k) + '원입니다.', [l]);
    const docTotal = moneyHits.length ? moneyHits[0][0] : (tableTotals.length ? Math.max(...tableTotals.map(Math.abs)) : null);
    if (moneyHits.length && tableTotals.length) {
      const T = moneyHits[0][0], cells = new Set();
      for (const t of tables) for (const r of t.rows) for (const c of r) { const v = cellNum(c); if (v != null) cells.add(Math.abs(v)); }
      const pair = totalRows.some(vs => vs.some((a, i) => vs.some((b, j) => j > i && a + b === T)));
      if (!cells.has(T) && !pair) add('high', 'total', '본문 금액이 표 어디에도 없음', '본문 ' + fmt(T) + '원, 표 합계 ' + [...new Set(tableTotals.map(Math.abs))].map(fmt).join('·') + '원입니다.', [moneyHits[0][3]]);
    }

    // 11-2. 정산서·물품검수조서: 결산(집행액)이 예산보다 많으면 안 됨. 적게 썼으면 지출기안에 정산서가 있어야 함
    const st = settleOf(doc);
    if (G && D().SPEND_KINDS.includes(meta.kind) && !/여입|반납|반환/.test(meta.title)) {
      const scanNote = opts.scanHas && meta.no && !/^0+$/.test(meta.no) ? (opts.scanHas(meta.no) ? ' 스캔본이 있으니 스캔본에 정산서가 있는지 확인해 주세요.' : ' 스캔본도 아직 없습니다.') : '';
      if (st && st.spent != null && st.budget != null) {
        if (st.spent > st.budget) add('high', 'settle', '집행액이 예산보다 많음', '정산서 예산액 ' + fmt(st.budget) + '원, 집행액 ' + fmt(st.spent) + '원입니다. 결산은 예산을 넘을 수 없습니다.', [st.line]);
        else if (st.spent < st.budget && !st.reason) add('mid', 'settle', '차액 발생 사유가 비어 있음', '예산 ' + fmt(st.budget) + '원 중 ' + fmt(st.spent) + '원을 썼습니다. ‘예산대비 집행금액 차액 발생 사유’를 적어 주세요.', [st.line]);
      } else if (st) add('low', 'settle', '정산서의 예산액·집행액 합계를 찾지 못함', '정산서 합계 줄을 확인해 주세요.');
      else if (['진행비', '다과비', '식비', '재료비', '숙박비', '물품구입비'].includes(meta.kind)) add(meta.kind === '진행비' ? 'mid' : 'low', 'settle', '정산서가 없음', '예산대로 썼으면 괜찮고, 예산보다 적게 썼으면 지출기안에 정산서를 붙여야 합니다.' + scanNote);
      if (['물품구입비', '홍보비'].includes(meta.kind) && !L.some(l => /검\s*수\s*조\s*서|검수하였음/.test(l))) add('mid', 'inspect', '물품검수조서가 없음', '물품을 산 지출기안에는 물품검수조서를 함께 넣습니다.' + scanNote);
    }

    // 12. 계정과목 (띄어쓰기만 다른 것은 같은 계정으로 봄: 기안 계정 표는 ‘수용비 및 수수료’처럼 띄어 쓰고, 예산서는 붙여 씀)
    const acc = opts.accounts || D().BUILTIN_ACCTS;
    const known = [];
    for (const f in acc) for (const p of acc[f]) known.push({ fund: f, path: p, segs: p.split('/') });
    const hangs = new Set(known.map(k => nospace(k.segs[1] || '')));
    const seen = new Set();
    const checkPath = (segs, line) => {
      segs = segs.map(s => s.trim()).filter(Boolean);
      if (segs.length < 3) return;
      const key = segs.join('/'); if (seen.has(key)) return; seen.add(key);
      const tail = k => k.segs.slice(k.segs.length - segs.length);
      const exact = known.filter(k => nospace(tail(k).join('/')) === nospace(key));
      if (exact.length) { checkSubAcct(exact, line); return; }
      const sw = segs[segs.length - 1].split(' '); // 한 칸에 세목 둘(‘다과비 홍보비’)을 적은 표
      if (sw.length > 1 && sw.every(x => x.length >= 2)) { const k1 = known.filter(k => nospace(tail(k).join('/')) === nospace(segs.slice(0, -1).concat(sw[0]).join('/'))); if (k1.length) { checkSubAcct(k1, line); return; } }
      // 불러온 예산서에 없는 재원(생활체육 지원사업 등)의 계정은 보지 않음. ‘진행비’처럼 글자가 빠진 항은 봄
      const hang = nospace(segs[segs.length - 3]);
      if (segs.length === 4 && !hangs.has(hang) && ![...hangs].some(x => lcsRatio(x, hang) >= 0.7)) return;
      const sev = segs.length === 4 && !hangs.has(hang) ? 'mid' : 'high'; // 항이 예산서에 없으면 다른 재원일 수도 있어 확인으로
      const up = known.filter(k => nospace(tail(k).slice(0, -1).join('/')) === nospace(segs.slice(0, -1).join('/')));
      if (up.length) { add('high', 'acct', '예산서에 없는 세목: ‘' + segs[segs.length - 1] + '’', '같은 목 아래 예산서 세목: ' + [...new Set(up.map(k => '‘' + k.segs[k.segs.length - 1] + '’(' + k.fund + ')'))].join(', ') + '\n계정과목 문구는 예산서와 똑같이 써야 합니다.', [line]); return; }
      const last = known.filter(k => nospace(k.segs[k.segs.length - 1]) === nospace(segs[segs.length - 1]));
      if (last.length) { add(sev, 'acct', '계정과목 경로가 예산서와 다름', '적힌 문구: ‘' + segs.join(' / ') + '’\n예산서: ' + last.map(k => '‘' + k.segs.join(' / ') + '’(' + k.fund + ')').join(', '), [line]); return; }
      if (/^(사업비|사무비|재산조성비|예비비|반환금)$/.test(segs[0])) add('high', 'acct', '예산서에 없는 계정과목', '‘' + segs.join(' / ') + '’', [line]);
    };
    const found = [];
    const checkSubAcct = (ks, line) => {
      found.push(...ks);
      if (!meta.sub) return;
      for (const k of ks) {
        if (k.segs[0] !== '사업비') continue;
        const want = (D().ACCT_MAP[k.fund] || {})[meta.sub];
        if (want && want !== k.path) add('mid', 'acct-sub', '이 사업의 계정과목이 아님', '‘' + meta.sub + '’의 ' + k.fund + ' 계정은 ‘' + want.split('/').join(' / ') + '’입니다.', [line]);
      }
    };
    const seg = '([가-힣A-Za-z][가-힣A-Za-z0-9 ]{0,14}?)';
    const pathRe = new RegExp(seg + '\\s*[/>]\\s*' + seg + '\\s*[/>]\\s*' + seg + '(?:\\s*[/>]\\s*' + seg + ')?(?=\\s*(?:$|[,)|(\\]:]|\\s{2}))', 'g');
    for (const l of L) for (const x of l.matchAll(pathRe)) checkPath(x.slice(1).filter(Boolean), l);
    for (const t of tables) for (const r of t.rows) for (let i = 0; i + 4 <= r.length; i++) {
      const w = r.slice(i, i + 4).map(c => c.replace(/\s+/g, ' ').trim()); // 좁은 칸은 ‘사\n업\n비’처럼 줄이 바뀌어 읽힘
      if (w.every(c => c && nospace(c).length <= 15 && /^[가-힣A-Za-z ]+$/.test(c)) && /^(사업비|사무비|재산조성비|예비비|반환금)$/.test(nospace(w[0]))) checkPath([nospace(w[0])].concat(w.slice(1)), r.join(' | '));
    }
    let target = found.find(k => k.segs[0] === '사업비') || null;
    if (!target && meta.sub) for (const f of ['보조금', '자부담']) { const p = (D().ACCT_MAP[f] || {})[meta.sub]; if (p && (acc[f] || []).includes(p)) { target = { fund: f, path: p, segs: p.split('/') }; break; } }
    if (!target) target = found[0] || null;
    if (opts.budgetOf && target) {
      const k = target, b = opts.budgetOf(k.fund, k.path);
      if (b) {
        add('low', 'budget', '예산 현황 (' + k.fund + ': ' + k.segs.join(' / ') + ')', '현재 예산 ' + fmt(b.budget) + '원 · 집행 ' + fmt(b.spent) + '원' + (b.date ? '(' + b.date + ' 결산' + (b.after ? ' + 이후 기안 ' + fmt(b.after) + '원' : '') + ')' : '') + ' · 남은 예산 ' + fmt(b.remain) + '원');
        if (docTotal != null && docTotal > b.remain) add('high', 'over', '남은 예산보다 큰 금액', '이 기안 ' + fmt(docTotal) + '원, 남은 예산 ' + fmt(b.remain) + '원입니다.');
      }
    }

    // 13. 본문 항목 번호, 붙임 번호, 끝 표시, 결과보고 빈칸
    if (G) {
      const ps = [];
      for (const b of doc.blocks) if (b.type === 'p') b.text.split('\n').forEach(t => { if (t.trim()) ps.push(t.trim()); });
      const st = ps.findIndex(l => /결재\s*바랍니다|하오니/.test(l));
      if (st >= 0) {
        const nums = [], rows = [];
        for (let i = st + 1; i < ps.length; i++) {
          if (/^붙\s*임/.test(ps[i]) || /끝\s*\.\s*$/.test(ps[i])) break;
          const m = /^(\d{1,2})\s*\.\s*\S/.exec(ps[i]); if (m && !/^\d{1,2}\s*\.\s*\d/.test(ps[i])) { nums.push(+m[1]); rows.push(ps[i]); }
        }
        const badAt = nums.findIndex((n, i) => i > 0 && n !== 1 && n !== nums[i - 1] + 1); // 1로 다시 시작하는 것(공문 등)은 괜찮음
        if (nums.length > 2 && nums[0] === 1 && badAt > 0) add('mid', 'itemno', '본문 항목 번호가 겹치거나 건너뜀', '항목 번호: ' + nums.join(', '), rows.slice(Math.max(0, badAt - 1), badAt + 1));
      }
      const bi = L.findIndex(l => /^붙\s*임/.test(l));
      if (bi >= 0) {
        const nums = [];
        for (let i = bi; i < L.length && i < bi + 15; i++) {
          const t = L[i].replace(/^붙\s*임\s*/, '');
          const m = /^(\d+)\s*\./.exec(t); if (m) nums.push(+m[1]);
          if (/끝\s*\.?\s*$/.test(L[i])) break;
        }
        if (nums.length > 1 && nums.some((n, i) => n !== i + 1)) add('mid', 'attach', '붙임 번호가 차례대로가 아님', '붙임 번호: ' + nums.join(', '), L.slice(bi, bi + nums.length + 1));
      }
      if (['사업계획', '변경계획', '계획', '모집', '결과보고', '실적보고'].concat(D().SPEND_KINDS).includes(meta.kind) && !L.some(l => /끝\s*\.\s*$/.test(l) || /끝\.\s/.test(l)))
        add('low', 'end', '‘끝.’ 표시를 찾지 못함', '본문 마지막이나 붙임 끝에 ‘끝.’이 있는지 확인해 주세요.');
      if (['결과보고', '실적보고'].includes(meta.kind)) {
        const empty = [];
        for (const l of ps) if (/^\d+\s*\.\s*(평\s*가|결\s*과|결\s*산)\s*[:：]?\s*$/.test(l)) empty.push(l);
        for (const t of tables) for (const r of t.rows) r.forEach((c, i) => {
          const lab = nospace(c), rest = r.slice(i + 1).join('').replace(/[\s|]/g, '');
          if (/^(과정평가|성과평가|전체평가|평가)$/.test(lab) && !rest.replace(/[-–]/g, '')) empty.push(r.join(' | '));
          else if (lab === '자원연계' && !rest) empty.push(r.join(' | ')); // 자원연계는 ‘-’(없음)로 둘 수 있음
        });
        if (empty.length) add('high', 'blank', '평가·결산 칸이 비어 있음', '결과보고의 평가(과정·성과)와 결산 칸을 채워 주세요.', [...new Set(empty)]);
      }
    }

    // 14. 표기
    const ty = [], sp = { fix: new Set(), lines: [] };
    for (const l of L) {
      if (/(?<![\d,.])\d{5,}\s*원/.test(l)) ty.push(['천 단위 쉼표가 없는 금액', l]);
      const l2 = l.replace(/\d{1,2}:\d{2}/g, '');
      for (const x of l2.matchAll(/(?<![\d.,])\d{1,3}(?:,\d+)+(?![\d.]|\s*[월일차회층대번호동명])(원?)/g)) {
        const groups = x[0].replace(/원$/, '').split(','), digits = groups.join('').length;
        if (groups.slice(1).some(g => g.length !== 3) && (x[1] || digits >= 4)) { ty.push(['쉼표 위치가 이상한 숫자', l]); break; }
      }
      if (/(?<![\d.])[^.\d]\.\.(?!\.)|,,/.test(l)) ty.push(['문장 부호가 겹침', l]);
      for (const [re, msg] of SPELL) { const m = re.exec(l); if (m) { sp.fix.add(msg(m).replace(/\s{2,}/g, ' ')); sp.lines.push(l); } }
    }
    const tyg = {}; ty.forEach(([k, l]) => (tyg[k] = tyg[k] || []).push(l));
    for (const k in tyg) add('low', 'typo', k, '', [...new Set(tyg[k])]);
    if (sp.fix.size) add('low', 'typo', '맞춤법·띄어쓰기 ' + sp.fix.size + '곳', [...sp.fix].join('\n'), [...new Set(sp.lines)]);

    // 15. 개별자립지원 계획: 센터장 점검 항목은 사람이 확인
    if (meta.sub === '개별자립지원' && ['계획', '사전회의', '중간회의'].includes(meta.kind)) {
      const pick = re => L.filter(l => re.test(l));
      const att = L.join(' ').match(/세부\s*사업\s*계획서\s*(\d+)\s*부/);
      add('mid', 'ils', '개별자립지원 내용 점검(사람이 확인)', '① 회의록의 욕구 → 논의 → 결과가 이어지는지 ② 계획서의 확인된 욕구가 회의록 욕구와 같은지 ③ 합의된 목표가 같은 줄의 욕구와 이어지는지 ④ 단기목표를 합치면 장기목표가 되는지 ⑤ 세부사업계획서 수 = 회차·분기 단위 필요 수 = 붙임 문구 수' + (att ? '\n붙임 문구의 세부사업계획서: ' + att[1] + '부' : ''), pick(/욕구|목표|세부\s*사업\s*계획서/));
    }

    // 16. 앞 문서와 비교
    let diff = null;
    if (opts.prev) {
      const pm = docMeta(opts.prev);
      diff = lineDiff(opts.prev.lines, L);
      const prevDates = new Set();
      for (const l of opts.prev.lines) for (const x of l.matchAll(dateRe)) prevDates.add(+x[2] + '.' + +x[3]);
      const same = [];
      for (const l of L) for (const x of l.matchAll(dateRe)) { const k = +x[2] + '.' + +x[3]; if (prevDates.has(k)) same.push(l); }
      if (same.length && pm.mmdd !== meta.mmdd) add('mid', 'prev-date', '앞 문서의 날짜가 그대로 있음', '앞 문서(' + (pm.fileTitle || pm.base) + ')와 같은 날짜입니다. 이번 회차 날짜로 바꿨는지 확인해 주세요.', [...new Set(same)]);
      if (pm.round && meta.round && pm.round !== meta.round) {
        const left = L.filter(l => new RegExp('(?<!\\d)' + pm.round + '\\s*차').test(l));
        if (left.length) add('high', 'prev-round', '앞 문서의 차수(' + pm.round + '차)가 남아 있음', '', left);
      }
    }

    const order = { high: 0, mid: 1, low: 2, ok: 3 };
    F.sort((a, b) => order[a.sev] - order[b.sev]);
    const verdict = F.some(f => f.sev === 'high') ? '보완 필요' : F.some(f => f.sev === 'mid') ? '확인 후 결재' : '결재 가능';
    return { meta, findings: F, diff, verdict, docTotal, accounts: found.map(k => k.fund + ': ' + k.segs.join(' / ')) };
  }

  /* 사업비 정산서: ‘항 | 목 | 세목 | 예산액/산출근거 | 집행액 | 산출근거’ 표의 합계 줄과 차액 발생 사유 */
  function settleOf(doc) {
    if (!doc.lines.some(l => /정\s*산\s*서|\|\s*집행액\s*\|/.test(l))) return null;
    const num = c => { const m = /^\s*([\d,]+)\s*원?\s*$/.exec(c || ''); return m ? +m[1].replace(/,/g, '') : null; };
    const out = { budget: null, spent: null, reason: '', line: '', spentBasis: '' };
    for (const t of doc.blocks.filter(b => b.type === 'table')) {
      const hi = t.rows.findIndex(r => r.some(c => /^집행액$/.test(nospace(c))));
      if (hi < 0) continue;
      const head = t.rows[hi].map(nospace), si = head.findIndex(c => c === '집행액');
      const tot = t.rows.slice(hi + 1).find(r => /^(합계|총계|계)$/.test(nospace(r.find(c => c.trim()) || '')));
      if (tot) { const ns = tot.map(num).filter(v => v != null); if (ns.length >= 2) { out.budget = ns[0]; out.spent = ns[1]; out.line = tot.join(' | '); } }
      out.spentBasis = t.rows.slice(hi + 1).filter(r => r !== tot).map(r => r.slice(si + 1).join(' ')).join(' ');
      break;
    }
    const rl = doc.lines.find(l => /차액\s*발생\s*사유/.test(l));
    if (rl) out.reason = rl.replace(/^.*차액\s*발생\s*사유\s*>?\s*/, '').replace(/^[\s\-–:]+/, '').replace(/\d{4}년\s*\d+월\s*\d+일\s*계획한.*$/, '').trim();
    return out;
  }

  function lineDiff(a, b) {
    const A = a.map(x => x.replace(/\s+/g, ' ').trim()), B = b.map(x => x.replace(/\s+/g, ' ').trim());
    const n = A.length, m = B.length;
    if (n * m > 4e6) return null;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const out = []; let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { out.push(['=', B[j]]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push(['-', A[i]]); i++; }
      else { out.push(['+', B[j]]); j++; }
    }
    while (i < n) out.push(['-', A[i++]]);
    while (j < m) out.push(['+', B[j++]]);
    return out;
  }

  /* 담당자에게 보낼 보완 요청 문구 */
  function reportText(r) {
    const lines = ['[기안 검수] ' + (r.meta.fileTitle || r.meta.bodyTitle || r.meta.base), '판정: ' + r.verdict, ''];
    const label = { high: '고칠 것', mid: '확인할 것', low: '참고' };
    let n = 0;
    for (const f of r.findings) {
      if (f.code === 'budget') continue;
      n++;
      lines.push(n + '. [' + label[f.sev] + '] ' + f.title);
      if (f.detail) f.detail.split('\n').forEach(d => lines.push('   ' + d));
      f.quotes.slice(0, 3).forEach(q => lines.push('   · ' + (q.length > 90 ? q.slice(0, 90) + '…' : q)));
    }
    if (!n) lines.push('규칙으로 확인한 범위에서는 고칠 곳이 없습니다.');
    lines.push('', '※ 정해진 규칙으로 자동 확인한 결과입니다. 내용 판단(욕구·목표 연결 등)은 따로 봐 주세요.');
    return lines.join('\n');
  }
  window.GREVIEW = { review, docMeta, reportText, korNum, lineDiff, settleOf };
})();
