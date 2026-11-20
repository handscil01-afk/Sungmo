// ==UserScript==
// @name         문자통역 넷플릭스 자막 보내기
// @namespace    https://handscil01-afk.github.io/Sungmo/
// @version      1.0.0
// @description  넷플릭스에서 켠 자막(한국어 CC 등)을 실시간 문자통역 방으로 한 줄씩 보냅니다
// @match        https://www.netflix.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      identitytoolkit.googleapis.com
// @connect      securetoken.googleapis.com
// @connect      handscil-sports-default-rtdb.asia-southeast1.firebasedatabase.app
// @run-at       document-idle
// @noframes
// @updateURL    https://handscil01-afk.github.io/Sungmo/caption/netflix-caption.user.js
// @downloadURL  https://handscil01-afk.github.io/Sungmo/caption/netflix-caption.user.js
// ==/UserScript==

/*
 * [사용법]
 * 1) 문자통역 입력 화면(노트북)에서 방을 만들고 '방 정보'의 방 번호·교대 비밀번호를 확인합니다.
 * 2) 넷플릭스를 트는 PC 크롬에서 작품을 열고, 자막을 '한국어(CC)'(없으면 '한국어')로 켭니다.
 * 3) 오른쪽 위 '문자통역 자막' 패널에 방 번호·교대 비밀번호를 넣고 '연결'을 누릅니다.
 *    그 뒤로 넷플릭스 화면에 자막이 바뀔 때마다 그 글이 문자통역 방에 한 줄씩 들어갑니다.
 * - '화면에서 자막 숨기기'를 켜면 프로젝터에는 자막이 안 보이고, 문자통역으로만 보냅니다.
 * - 이 PC는 교대 입력자로 들어가므로, 통역하는 분은 입력 화면에서 [해설] 같은 화면 해설만 덧붙이면 됩니다.
 * - 서버: 문자통역 앱과 같은 Firebase(handscil-sports) caption1. 서버 규칙은 문자통역 앱과 같습니다.
 */
(function(){
  'use strict';
  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  // 시험용: 템퍼몽키가 아닌 곳(GM_info 없음)에서만 에뮬레이터 주소로 바꿀 수 있음
  const TEST = typeof GM_info === 'undefined' ? (W.__CAPSUB_TEST__ || null) : null;
  const API_KEY = 'AIzaSyDihHD0cldHyY0MWViA_R0yb-nkIoJ_-4I';
  const EP = TEST ? TEST.ep : {
    auth:'https://identitytoolkit.googleapis.com/v1',
    token:'https://securetoken.googleapis.com/v1',
    db:'https://handscil-sports-default-rtdb.asia-southeast1.firebasedatabase.app',
    ns:'',
  };
  const ROOT = 'caption1';
  const NAME = '넷플릭스 자막';
  const SEL_BOX = '.player-timedtext';
  const SEL_TEXT = '.player-timedtext-text-container';

  /* ---------- 저장 ---------- */
  const store = {
    get(k, d){ try{ const v = GM_getValue('capsub_' + k); return v === undefined ? d : v; }catch(e){ return d; } },
    set(k, v){ try{ GM_setValue('capsub_' + k, v); }catch(e){} },
  };

  /* ---------- 서버 (Firebase REST) ---------- */
  function http(method, url, body, form){
    return new Promise((res, rej) => {
      GM_xmlhttpRequest({
        method, url, data:body == null ? undefined : form ? body : JSON.stringify(body),
        headers:{ 'Content-Type':form ? 'application/x-www-form-urlencoded' : 'application/json' },
        timeout:15000,
        onload:r => { let j = null; try{ j = r.responseText ? JSON.parse(r.responseText) : null; }catch(e){} if(r.status >= 200 && r.status < 300) res(j); else rej({ status:r.status, body:j }); },
        onerror:() => rej({ status:0 }), ontimeout:() => rej({ status:0 }),
      });
    });
  }
  const auth = { id:null, exp:0, uid:store.get('uid', null), refresh:store.get('refresh', null) };
  async function token(){
    if(auth.id && Date.now() < auth.exp - 60000) return auth.id;
    let r;
    if(auth.refresh){
      try{
        r = await http('POST', EP.token + '/token?key=' + API_KEY, 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(auth.refresh), true);
        auth.id = r.id_token; auth.refresh = r.refresh_token; auth.uid = r.user_id; auth.exp = Date.now() + Number(r.expires_in || 3600) * 1000;
      }catch(e){ auth.refresh = null; }
    }
    if(!auth.id || !auth.refresh){
      r = await http('POST', EP.auth + '/accounts:signUp?key=' + API_KEY, { returnSecureToken:true });
      auth.id = r.idToken; auth.refresh = r.refreshToken; auth.uid = r.localId; auth.exp = Date.now() + Number(r.expiresIn || 3600) * 1000;
    }
    store.set('uid', auth.uid); store.set('refresh', auth.refresh);
    return auth.id;
  }
  async function db(method, path, body, query){
    const t = await token();
    const q = ['auth=' + encodeURIComponent(t)];
    if(EP.ns) q.push('ns=' + EP.ns);
    if(query) q.push(query);
    return http(method, EP.db + '/' + ROOT + '/' + path + '.json?' + q.join('&'), body);
  }

  /* 줄 순서 열쇠 (문자통역 앱 js/util.js 의 lineKeyBetween 과 같은 규칙. 맨 끝에 붙임) */
  const FD = '0123456789abcdefghijklmnopqrstuvwxyz';
  function keyAfter(prev){
    const a = prev ? prev.slice(1) : '';
    let base;
    if(!a) base = (36 ** 7).toString(36);
    else{
      const n = parseInt((a + '00000000').slice(0, 8), 36) + 36 ** 4;
      base = n < 36 ** 8 ? n.toString(36).padStart(8, '0') : a + 'i';
    }
    // 통역하는 분이 같은 순간에 같은 열쇠를 만들어도 겹치지 않게 뒤에 두 글자를 덧붙임 (순서는 그대로)
    return 'k' + base + FD[1 + Math.floor(Math.random() * 35)] + FD[1 + Math.floor(Math.random() * 35)];
  }

  /* ---------- 연결·보내기 ---------- */
  const S = { code:store.get('code', ''), pin:store.get('pin', ''), on:store.get('on', true), hide:store.get('hide', false), connected:false, sent:0, last:'', lastSent:'', queue:[], busy:false, seenBox:0, err:'' };
  async function connect(code, pin){
    code = String(code || '').replace(/\D/g, ''); pin = String(pin || '').replace(/\D/g, '');
    if(code.length !== 4 || pin.length !== 4){ say('방 번호와 교대 비밀번호 네 자리를 넣어 주세요', true); return false; }
    say('연결하는 중…');
    try{
      const meta = await db('GET', 'rooms/' + code + '/meta');
      if(!meta){ say('방 번호 ' + code + '인 방이 없어요', true); return false; }
      await db('PUT', 'rooms/' + code + '/typers/' + auth.uid, { name:NAME, pin });
      S.code = code; S.pin = pin; S.connected = true; S.err = '';
      store.set('code', code); store.set('pin', pin);
      say('방 ' + code + '(' + (meta.title || '문자통역') + ')에 연결했어요');
      paint();
      return true;
    }catch(e){
      S.connected = false;
      say(e && (e.status === 401 || e.status === 403) ? '교대 비밀번호가 맞지 않아요' : '연결하지 못했어요. 인터넷 연결을 확인해 주세요', true);
      paint();
      return false;
    }
  }
  function disconnect(){ S.connected = false; store.set('pin', ''); S.pin = ''; say('연결을 끊었어요'); paint(); }
  function enqueue(t){ if(!S.connected || !S.on) return; S.queue.push(t); pump(); }
  async function pump(){
    if(S.busy) return; S.busy = true;
    while(S.queue.length && S.connected){
      const t = S.queue[0];
      try{
        const last = await db('GET', 'rooms/' + S.code + '/lines', null, 'orderBy=' + encodeURIComponent('"$key"') + '&limitToLast=1');
        const lastKey = last ? Object.keys(last).sort().pop() : null;
        await db('PUT', 'rooms/' + S.code + '/lines/' + keyAfter(lastKey), t.slice(0, 5000));
        S.queue.shift(); S.sent++; S.lastSent = t; S.err = '';
      }catch(e){
        if(e && (e.status === 401 || e.status === 403)){ S.connected = false; S.queue = []; say('보낼 권한이 없어요. 방이 닫혔거나 비밀번호가 바뀌었어요. 다시 연결해 주세요', true); break; }
        S.err = '보내지 못해서 다시 시도하는 중'; paint();
        await new Promise(r => setTimeout(r, 1500));
      }
    }
    S.busy = false; paint();
  }

  /* ---------- 자막 읽기 ---------- */
  function readSub(){
    const box = document.querySelector(SEL_BOX);
    if(!box) return null;
    S.seenBox = Date.now();
    const parts = Array.from(box.querySelectorAll(SEL_TEXT)).map(c => (c.innerText || c.textContent || '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
    const t = parts.length ? parts.join(' ') : (box.innerText || box.textContent || '').replace(/\s*\n\s*/g, ' ').trim();
    return t.replace(/\s{2,}/g, ' ');
  }
  let checkT = 0;
  function check(){
    checkT = 0;
    const t = readSub();
    if(t == null) return;
    if(!t){ S.last = ''; return; }   // 자막이 사라지면 같은 자막이 다시 나와도 다시 보냄
    if(t === S.last) return;         // 같은 자막을 다시 그린 것은 무시
    S.last = t;
    enqueue(t);
    paint();
  }
  new MutationObserver(() => { if(!checkT) checkT = setTimeout(check, 60); }).observe(document.documentElement, { subtree:true, childList:true, characterData:true });

  /* ---------- 패널 ---------- */
  const host = document.createElement('div');
  host.id = 'capsub-host';
  host.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;';
  const root = host.attachShadow({ mode:'open' });
  root.innerHTML = `<style>
    :host{all:initial}
    .p{font:14px/1.45 "Malgun Gothic","Apple SD Gothic Neo",sans-serif;color:#f5f7fa;background:rgba(10,12,16,.94);border:2px solid #ffd54a;border-radius:12px;padding:10px 12px;width:290px;box-shadow:0 8px 28px rgba(0,0,0,.6)}
    .p.min{width:auto;padding:6px 10px}
    h2{font-size:15px;margin:0 0 6px;color:#ffd54a;display:flex;align-items:center;gap:8px}
    h2 .sp{flex:1}
    .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0}
    input[type=text]{width:70px;font:inherit;font-size:18px;letter-spacing:.1em;text-align:center;background:#000;color:#fff;border:1px solid #556;border-radius:6px;padding:4px}
    button{font:inherit;font-weight:700;border-radius:8px;border:1px solid #556;background:#222a35;color:#fff;padding:5px 10px;cursor:pointer}
    button.pri{background:#ffd54a;color:#1d1600;border-color:#ffd54a}
    button.x{padding:2px 8px}
    label{display:flex;gap:6px;align-items:center;cursor:pointer}
    .msg{font-size:13px;color:#a3adba;margin-top:4px}
    .msg.bad{color:#ff8a8a}
    .last{font-size:13px;background:#000;border-radius:6px;padding:4px 6px;margin-top:6px;max-height:60px;overflow:hidden}
    .dot{width:9px;height:9px;border-radius:50%;background:#6b7480;display:inline-block}
    .dot.on{background:#3ccf8e}
    [hidden]{display:none!important}
  </style>
  <div class="p" role="region" aria-label="문자통역 자막 보내기">
    <h2><span class="dot"></span><span class="tt">문자통역 자막</span><span class="sp"></span><button class="x" data-a="min" aria-label="접기·펴기">–</button></h2>
    <div class="body">
      <div class="form">
        <div class="row"><label>방 번호 <input type="text" class="code" inputmode="numeric" maxlength="4" autocomplete="off"></label></div>
        <div class="row"><label>교대 비밀번호 <input type="text" class="pin" inputmode="numeric" maxlength="4" autocomplete="off"></label></div>
        <div class="row"><button class="pri" data-a="connect">연결</button></div>
      </div>
      <div class="live" hidden>
        <div class="row"><label><input type="checkbox" class="sendchk"> 자막 보내기</label></div>
        <div class="row"><label><input type="checkbox" class="hidechk"> 화면에서 자막 숨기기</label></div>
        <div class="row"><button data-a="disconnect">연결 끊기</button></div>
        <div class="last" hidden></div>
      </div>
      <div class="msg" role="status" aria-live="polite"></div>
    </div>
  </div>`;
  const $ = s => root.querySelector(s);
  let msg = '', msgBad = false, minimized = store.get('min', false);
  function say(t, bad){ msg = t; msgBad = !!bad; paint(); }
  function paint(){
    $('.p').classList.toggle('min', minimized);
    $('.body').hidden = minimized;
    $('.dot').classList.toggle('on', S.connected && S.on);
    $('.tt').textContent = minimized ? (S.connected ? '자막 보내는 중 · 방 ' + S.code + ' · ' + S.sent + '줄' : '문자통역 자막') : '문자통역 자막';
    $('.form').hidden = S.connected;
    $('.live').hidden = !S.connected;
    if(!$('.code').value) $('.code').value = S.code || '';
    $('.sendchk').checked = S.on; $('.hidechk').checked = S.hide;
    const l = $('.last'); l.hidden = !S.lastSent; l.textContent = '마지막: ' + S.lastSent;
    let m = msg;
    if(S.connected){
      m = '방 ' + S.code + ' · 보낸 자막 ' + S.sent + '줄' + (S.on ? '' : ' · 보내기 꺼짐') + (S.err ? ' · ' + S.err : '');
      if(document.querySelector('.image-based-timed-text')) m += ' · 그림 자막이라 읽을 수 없어요. 다른 자막 언어를 골라 주세요';
      else if(document.querySelector('video') && Date.now() - S.seenBox > 60000) m += ' · 자막이 꺼져 있는 것 같아요. 넷플릭스 자막에서 한국어(CC)를 고르세요';
    }
    const el = $('.msg'); el.textContent = m; el.classList.toggle('bad', msgBad && !S.connected);
    document.documentElement.classList.toggle('capsub-hide', S.hide);
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if(!b) return;
    const a = b.dataset.a;
    if(a === 'connect') connect($('.code').value, $('.pin').value);
    else if(a === 'disconnect') disconnect();
    else if(a === 'min'){ minimized = !minimized; store.set('min', minimized); paint(); }
  });
  root.addEventListener('change', e => {
    if(e.target.classList.contains('sendchk')){ S.on = e.target.checked; store.set('on', S.on); if(S.on) S.last = ''; paint(); }
    if(e.target.classList.contains('hidechk')){ S.hide = e.target.checked; store.set('hide', S.hide); paint(); }
  });
  // 넷플릭스 단축키(스페이스·F 등)가 패널에서 치는 글자를 가져가지 않게
  ['keydown', 'keyup', 'keypress'].forEach(t => host.addEventListener(t, e => { e.stopPropagation(); if(t === 'keydown' && e.key === 'Enter' && e.composedPath()[0].matches && e.composedPath()[0].matches('input[type=text]')) connect($('.code').value, $('.pin').value); }));
  // 자막 숨기기: 글은 그대로 읽을 수 있게 투명하게만
  const st = document.createElement('style');
  st.textContent = 'html.capsub-hide ' + SEL_BOX + '{opacity:0!important}';
  (document.head || document.documentElement).appendChild(st);
  // 넷플릭스 전체화면에서도 패널이 보이게 전체화면 요소 안으로 옮김
  const place = () => { const fs = document.fullscreenElement || document.webkitFullscreenElement; const parent = fs && fs.appendChild ? fs : document.body; if(parent && host.parentNode !== parent) parent.appendChild(host); };
  document.addEventListener('fullscreenchange', place);
  document.addEventListener('webkitfullscreenchange', place);
  place();
  setInterval(paint, 5000);
  paint();
  // 전에 연결한 방이 있으면 다시 연결
  if(S.code && S.pin) connect(S.code, S.pin);
  if(TEST) W.__capsub = { S, check, connect };   // 시험용 (템퍼몽키에서는 넷플릭스 쪽에 상태를 내놓지 않음)
})();
