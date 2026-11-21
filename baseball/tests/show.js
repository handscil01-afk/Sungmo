// 컷인·명장면 다시 보기·날씨 시험 (화면 보며 하기 + 소리와 글로 하기):
// 홈런 컷인이 뜨고 눌러서 닫힘 · 경기 끝 '명장면 다시 보기'가 하나씩 그림으로 다시 보여 줌(한 화면) · 글 모드는 글로 읽음 ·
// 리그 경기 우천 중단 → 경기 재개 / 강우 콜드게임 · 우천 취소(시즌 끝에 다시 함) · 콜드게임 설정(9이닝 7회 이후 10점 차) · 스크립트 오류
// 사용법: node baseball/tests/show.js
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const PORT = 8771;

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', root], { stdio:'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch();
  const errors = [];
  const open = async (name, w, h) => {
    const ctx = await browser.newContext({ viewport:{ width:w, height:h }, hasTouch:true });
    await ctx.addInitScript(() => { window.__show = true; });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    page.on('console', m => { if(m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
    await page.goto(`http://localhost:${PORT}/baseball/`); await page.waitForSelector('#opts .opt'); await page.keyboard.press('1');
    await page.waitForSelector('#sk .card');
    return { ctx, page };
  };
  const fit = async (page, tag) => { await page.waitForTimeout(200); const o = await page.evaluate(() => { const b = document.querySelector('#skBody'); return b ? [b.className, b.scrollHeight > b.clientHeight + 1, document.documentElement.scrollWidth > innerWidth + 1] : ['', false, false]; }); if(o[1] || o[2] || /\bscroll\b/.test(o[0])) errors.push(`${tag}: 한 화면을 넘침 ${o[0]}`); };
  // 한 타석씩 컴퓨터가 진행하고 화면에 보여 줌 (관전과 같은 길)
  const stepPA = page => page.evaluate(() => { if(G.over) return null; const pa = G.pa; const r = runSteps(() => G.pa !== pa); gameNext('auto', r); return r.events; });

  // 1) 홈런 컷인 → 경기 끝 → 명장면 다시 보기 (휴대폰·가로)
  for(const [name, w, h] of [['휴대폰', 390, 844], ['가로', 844, 390]]){
    const { ctx, page } = await open(`컷인·명장면(${name})`, w, h), tag = `컷인·명장면(${name})`;
    let found = false;
    for(let seed = 11; seed < 40 && !found; seed++){
      await page.evaluate(s => { SET.cast = false; startGame({ mode:'detail', innings:9, teams:[TEAMS[1].key, TEAMS[4].key], ctrl:['cpu', 'cpu'], who:['', ''], diff:1, easy:2, seed:s }, 'click'); }, seed);
      for(let i = 0; i < 120; i++){
        const evs = await stepPA(page); if(!evs) break;
        if(evs.some(e => e.k === 'pa' && e.r === 'hr') && evs.some(e => e.k === 'score')){ found = true; break; }
      }
    }
    if(!found){ errors.push(`${tag}: 홈런이 나오지 않음`); await ctx.close(); continue; }
    try{
      await page.waitForSelector('.sh-ov.in .ci', { timeout:10000 });
      const ci = await page.evaluate(() => { const c = document.querySelector('.sh-ov .ci'); return { word: c.querySelector('strong').textContent, name: c.querySelector('b').textContent, face: !!c.querySelector('.crf') }; });
      if(!/홈런|끝내기/.test(ci.word) || !ci.name || !ci.face) errors.push(`${tag}: 컷인 내용이 이상함 ${JSON.stringify(ci)}`);
      await page.click('.sh-ov.in'); await page.waitForTimeout(150);
      if(await page.$('.sh-ov .ci')) errors.push(`${tag}: 눌러도 컷인이 닫히지 않음`);
      console.log(`${tag}: 컷인 ${ci.word} ${ci.name}`);
    } catch(e){ errors.push(`${tag}: 컷인이 뜨지 않음`); }
    // 경기 끝까지 → 명장면
    for(let i = 0; i < 200; i++){ if(!(await stepPA(page))) break; }
    const end = await page.evaluate(() => ({ over: G.over, n: HL.list.length, opt: (UI.S.opts || []).find(o => o.t === '명장면 다시 보기' && !o.hide), saved: JSON.stringify(ls.get('bb_game', null) || {}).includes('"hl"') }));
    if(!end.over) errors.push(`${tag}: 경기가 끝나지 않음`);
    if(!end.n || end.n > 8) errors.push(`${tag}: 명장면 수 ${end.n}`);
    if(!end.opt) errors.push(`${tag}: 경기 끝 화면에 명장면 다시 보기가 없음`);
    if(!(await page.$('.hb.end .hb-b'))) errors.push(`${tag}: 경기 끝 단추가 없음`);
    await page.click(`#sk [data-sk="opt"][data-n="${end.opt ? end.opt.n : 5}"]`);
    const st = await page.evaluate(() => ({ kind: UI.S.kind, anim: !!(GX.anim && GX.anim.hl), cap: !!document.querySelector('.hl-cap'), fin: !!document.querySelector('.fin') }));
    if(st.kind !== 'hl' || !st.anim || !st.cap) errors.push(`${tag}: 명장면 다시 보기가 시작되지 않음 ${JSON.stringify(st)}`);
    if(st.fin) errors.push(`${tag}: 명장면을 보는 동안 경기 끝 카드가 가림`);
    await fit(page, `${tag} 명장면`);
    if(end.n > 1){
      await page.waitForFunction(() => HL.i >= 1, null, { timeout:20000 }).catch(() => errors.push(`${tag}: 다음 명장면으로 넘어가지 않음`));
      await fit(page, `${tag} 둘째 명장면`);
    }
    await page.click('#sk [data-sk="opt"][data-n="3"]');
    if(await page.evaluate(() => UI.make !== endScreen || (GX.anim && GX.anim.hl))) errors.push(`${tag}: 그만 보기 뒤 경기 끝 화면이 아님`);
    // 소리와 글로 하기: 글로 읽음
    const a11y = await page.evaluate(() => { SET.view = 'a11y'; const S = hlScreen(); SET.view = 'gfx'; return { say: S.say.length, first: S.say[0] }; });
    if(a11y.say < 2 || !/^명장면 1\./.test(a11y.first)) errors.push(`${tag}: 글 모드 명장면 글이 이상함 ${JSON.stringify(a11y)}`);
    console.log(`${tag}: 명장면 ${end.n}개, 글 ${a11y.say}줄`);
    await ctx.close();
  }

  // 2) 리그 경기 날씨: 우천 중단 → 재개, 강우 콜드게임, 우천 취소
  {
    const { ctx, page } = await open('날씨', 390, 844), tag = '날씨';
    const newLeague = () => page.evaluate(() => { SET.cast = false; LSRC = 'league'; setLG(leagueNew({ my: TEAMS[0].key, len:18, mode:'simple', unit:'pa', inn:9, seed:4242 })); const L = LG(); L.teams[L.my]; saveLeague(); });
    const playLeague = async wx => {
      await page.evaluate(wx => { window.__wx = wx; const L = LG(); for(let d = L.day; d < L.sched.length; d++){ const g = L.sched[d].find(x => x.a === L.my || x.h === L.my); if(g && !parkInfo(g.h).dome){ L.day = d; break; } } leaguePlay('click'); }, wx);
      await page.evaluate(() => { if(G && !G.over) G.ctrl = ['cpu', 'cpu']; });
    };
    await newLeague();
    // 우천 중단 → 경기 재개
    await playLeague({ at:3, call:false });
    const w0 = await page.evaluate(() => G && G.wx && { at: G.wx.at, k: G.wx.k, hud: !!document.querySelector('.wx-hud') });
    if(!w0 || w0.at !== 3) errors.push(`${tag}: 비 예보가 정해지지 않음 ${JSON.stringify(w0)}`);
    if(w0 && !w0.hud) errors.push(`${tag}: 점수판에 날씨 아이콘이 없음`);
    let band = false;
    for(let i = 0; i < 200; i++){
      if(!(await stepPA(page))) break;
      if(!band && await page.evaluate(() => G.wx.done)){
        band = true;
        const s = await page.evaluate(() => ({ on: wxRaining(G), log: G.log.slice(-6).map(l => l.s).join(' ') }));
        if(!s.on || !/우천 중단/.test(s.log) || !/다시 시작/.test(s.log)) errors.push(`${tag}: 우천 중단·재개 글이 없음 ${JSON.stringify(s)}`);
        await page.waitForSelector('.sh-ov .wb', { timeout:10000 }).catch(() => errors.push(`${tag}: 우천 중단 글자 띠가 뜨지 않음`));
      }
    }
    const r1 = await page.evaluate(() => ({ over: G.over, called: G.called || null, inn: G.inning }));
    if(!band) errors.push(`${tag}: 비가 오지 않음`);
    if(!r1.over || r1.called) errors.push(`${tag}: 재개한 경기가 끝까지 가지 않음 ${JSON.stringify(r1)}`);
    // 강우 콜드게임: 7회초(12번째 초·말)에 비, 5회 넘게 마쳤으니 지금 점수로 끝
    await page.evaluate(() => go(leagueHome, 'click'));
    const day0 = await page.evaluate(() => LG().day);
    await playLeague({ at:12, call:true });
    for(let i = 0; i < 200; i++){ if(!(await stepPA(page))) break; }
    const r2 = await page.evaluate(() => ({ over: G.over, called: G.called, inn: G.inning, top: G.top, day: LG().day, fin: (document.querySelector('.fin-h') || {}).textContent || '', log: G.log.filter(l => /강우 콜드게임/.test(l.s)).length }));
    if(!r2.over || r2.called !== 'rain' || r2.inn !== 7 || !r2.log) errors.push(`${tag}: 강우 콜드게임이 아님 ${JSON.stringify(r2)}`);
    if(r2.day <= day0) errors.push(`${tag}: 강우 콜드게임 결과가 리그에 들어가지 않음`);
    if(!/콜드게임/.test(r2.fin)) errors.push(`${tag}: 경기 끝 카드에 콜드게임 표시가 없음 '${r2.fin}'`);
    // 우천 취소: 경기를 하려고 하면 취소되고, 시즌 끝에 다시 하는 경기가 붙음
    await page.evaluate(() => { G = null; ls.del('bb_game'); go(leagueHome, 'click'); });
    const before = await page.evaluate(() => ({ len: LG().sched.length, day: LG().day }));
    await page.evaluate(() => { window.__wx = { rainout:true }; leaguePlay('click'); });
    const r3 = await page.evaluate(b => { const L = LG(), g = L.sched[b.day].find(x => x.a === L.my || x.h === L.my); return { day: L.day, len: L.sched.length, rain: !!(g && g.rain), mk: L.sched[L.sched.length - 1].some(x => x.mk && (x.a === L.my || x.h === L.my)), game: !!G, say: (UI.S.say || []).map(l => l.s || l).join(' ') }; }, before);
    if(r3.game || !r3.rain || r3.day !== before.day + 1 || r3.len !== before.len + 1 || !r3.mk || !/우천 취소/.test(r3.say)) errors.push(`${tag}: 우천 취소가 이상함 ${JSON.stringify(r3)}`);
    await page.waitForSelector('.sh-ov.fix .wb', { timeout:6000 }).catch(() => errors.push(`${tag}: 우천 취소 글자 띠가 뜨지 않음`));
    await page.evaluate(() => { window.__wx = null; go(schedScreen, 'click'); });
    await fit(page, `${tag} 일정`);
    const sc = await page.evaluate(() => [document.querySelector('#skBody').textContent.includes('우천'), schedScreen().say.join(' ').includes('우천 취소')]);
    if(!sc[0] || !sc[1]) errors.push(`${tag}: 일정에 우천 취소 표시가 없음 ${sc}`);
    // 시즌 끝까지: 다시 하는 경기까지 모두 해서 팀마다 경기 수가 같음
    const fin = await page.evaluate(() => { const L = LG(); let k = 0; while(L.phase === 'season' && k++ < 400) leagueAdvance(L, null); return Object.values(L.teams).map(T => T.w + T.l + T.d); });
    if(new Set(fin).size !== 1 || fin[0] !== 18) errors.push(`${tag}: 우천 취소 뒤 팀마다 경기 수가 다름 ${fin}`);
    // 설정의 규칙 탭에 콜드게임·날씨
    const rules = await page.evaluate(() => settingsScreen(() => {}, 1).opts.map(o => o.t).join(' | '));
    if(!/콜드게임: 끔/.test(rules) || !/날씨와 비: 켬/.test(rules)) errors.push(`${tag}: 규칙 탭에 콜드게임·날씨가 없음 ${rules}`);
    console.log(`${tag}: 우천 중단·재개, 강우 콜드게임(${r2.inn}회), 우천 취소(일정 ${before.len}→${r3.len}일), 팀 경기 수 ${fin[0]}`);
    await ctx.close();
  }

  // 3) 콜드게임 설정: 7회 이후 10점 차에서 끝나고, 그 전까지는 설정이 없는 경기와 같은 결과
  {
    const { ctx, page } = await open('콜드게임', 390, 844), tag = '콜드게임';
    const r = await page.evaluate(() => {
      const out = { mercy:0, bad:[] };
      for(let s = 1; s < 120 && out.mercy < 3; s++){
        const o = { mode:'detail', innings:9, teams:[TEAMS[s % 10].key, TEAMS[(s + 3) % 10].key], ctrl:['cpu', 'cpu'], easy:2, seed:s };
        const A = newGame(o); A.mercy = 1; const B = newGame(o);
        for(const X of [A, B]){ let k = 0; while(!X.over && k++ < 5000){ if(X.review) resolveReview(X, aiChallenge(X)); else playStep(X, aiDefChoice(X), aiOffChoice(X)); } }
        if(A.called !== 'mercy') continue;
        out.mercy++;
        const d = Math.abs(runsOf(A.teams[0]) - runsOf(A.teams[1]));
        if(d < 10 || A.inning < 7) out.bad.push(`씨앗 ${s}: ${A.inning}회 ${d}점 차에 끝남`);
        const n = A.log.findIndex(l => /콜드게임/.test(l.s));
        if(A.log.slice(0, n).map(l => l.s).join('\n') !== B.log.slice(0, n).map(l => l.s).join('\n')) out.bad.push(`씨앗 ${s}: 콜드게임 전까지의 경기가 달라짐`);
      }
      return out;
    });
    if(!r.mercy) errors.push(`${tag}: 콜드게임으로 끝난 경기가 없음`);
    r.bad.forEach(b => errors.push(`${tag}: ${b}`));
    console.log(`${tag}: ${r.mercy}경기 확인`);
    await ctx.close();
  }

  await browser.close(); srv.kill();
  if(errors.length){ console.log('오류:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
  console.log('오류 없음');
})().catch(e => { console.error(e); process.exit(1); });
