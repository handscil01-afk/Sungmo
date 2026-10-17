# 난장이의 피아노 교실 (piano/) 정리 문서

이 문서는 `piano/` 앱의 코드를 지우기 전에, 앱이 무엇을 했고 어떤 기술을 썼는지 남겨 두는 기록이다. 원본 코드가 없어도 비슷한 앱을 다시 만들 수 있도록 핵심 코드 조각을 함께 적었다. 복지관·기관 업무용 웹 도구를 만들 때 재사용할 수 있는 부분(설치, 전체화면, 저장, 모달, 가로 화면 배치, 오프라인 캐시)을 특히 자세히 적었다.

- 만든 시기: 2026년 10월 6일 (커밋 2개: `293210b` 첫 버전, `b6b8751` 가로 화면·마이크 판정 강화·지연 보정)
- 배포 주소(삭제 전): https://handscil01-afk.github.io/Sungmo/piano/
- 파일 구성: `index.html`(약 3,200줄, 280KB, CSS와 JS를 모두 포함), `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`

---

## 1. 앱 개요

피아노를 처음 치는 어른이 **코드(화음)** 를 원리부터 익히도록 돕는 연습 앱이었다. 빌드 없이 브라우저에서 바로 열리고, 홈 화면에 설치하면 주소창 없이 앱처럼 실행되며 인터넷 없이도 열렸다.

### 화면 구성
- **시작 화면(스플래시)**: 캔버스에 금빛 입자와 음표가 떠오르고 제목 글자가 하나씩 나타난다. 화면을 누르면 바로 넘어간다.
- **첫 실행 안내(onboard, 4단계)**: 앱 소개 → 연습 방법 선택(화면 건반 / 집 피아노+마이크 / 디지털피아노 MIDI) → 고른 방법 준비(마이크라면 3초 소음 측정 후 도·미·솔을 쳐서 확인) → 음 이름 표기 선택(도레미 / CDE / 둘 다).
- **아래 탭 5개**: 홈, 건반(누른 음의 화음 이름 알아보기), 코드 사전, 메트로놈, 기록. 가로 화면에서는 탭이 왼쪽 세로 줄로 바뀌었다.
- **머리줄**: 뒤로, 제목, 도움말, 전체화면, 설정 버튼.

### 연습 단계 (홈 화면의 5단계)
1. 첫걸음: 건반·손가락 안내, 건반 눌러 보기, 건반 찾기, 반음·온음 세기
2. 기본 코드(C, Cm): 원리 배우기, 코드 짚기, 코드 이름 맞히기, 귀로 맞히기
3. 7화음(C7, Cmaj7, Cm7): 같은 네 가지 연습
4. 색깔 코드(sus4, sus2, dim, aug, m7♭5)
5. 활용하기: 자리바꿈 배우기·짚기, 코드 진행 연습, 노래 반주(작은 별, 환희의 송가, 생일 축하 노래, 징글벨, 어메이징 그레이스처럼 저작권이 끝난 곡만)

### 주요 기능
- **세 가지 입력**: 화면 건반(콕콕 = 하나씩 눌러 켜 두기 / 꾹 = 누르는 동안만), Web MIDI 디지털피아노, 마이크로 진짜 피아노 소리 듣기.
- **정확한 음 이름 표기**: Cm은 "도 미♭ 솔"처럼 글자를 하나씩 건너뛰어 쌓는 정석 표기를 썼고, "미♭은 레♯과 같은 건반" 같은 안내를 붙였다.
- **코드 진행 연습의 두 방식**: "기다려 줘요"(맞게 칠 때까지 기다림)와 "박자대로"(메트로놈에 맞춰 코드가 바뀌고 딱 맞음/늦음/놓침 판정). 손을 덜 움직이는 자리바꿈을 자동으로 골라 보여 주었다.
- **틀렸을 때 고칠 점을 한 줄로 안내**: "미 대신 미♭ (왼쪽으로 반음)", "맨 아래 음을 솔로 바꿔 보세요" 등.
- **기록**: 오늘·최근 7일 연습 시간, 연속 연습 일수, 14일 막대그래프, 코드별 정답률(더 연습할 코드), 최고 기록, JSON 파일로 보관·불러오기.
- **설정**: 보이는 흰 건반 수(가로·세로 따로), 건반 이름 표시, 손가락 번호, MIDI, 마이크 감도, 듣는 장치와 지연 시간, 글자 크기, 밝게/어둡게/자동 테마, 소리 크기, 자동 전체화면, 화면 켜 두기, 홈 화면 설치 방법.

---

## 2. 구조

### 한 파일 안의 순서
`index.html` 하나에 `<style>`과 `<script>`가 모두 들어 있었고, 스크립트는 `/* ===== 이름 ===== */` 주석으로 구역을 나누었다.

| 구역 | 내용 |
|---|---|
| 기본 도구 | `$`, `$$`, `clamp`, `esc`(HTML 이스케이프), `median`, `shuffle`, 한국어 조사 함수(`eul`, `iga`, `eun`, `euro`) |
| 아이콘 | `IC()`로 만드는 인라인 SVG 모음 `ICONS` (외부 아이콘 파일 없음) |
| 저장 | `DB` 객체, `loadDB`/`normalizeDB`/`saveDB` |
| 화면 이동 | `defScreen(id, def)`로 화면 등록, `go()`/`back()`/`show()`, `history.pushState`로 안드로이드 뒤로 가기 처리 |
| 알림·시트 | `toast`, `openSheet`, `confirmSheet`, `resultSheet` |
| 전체화면·화면 켜짐 | `FS`, `Wake` |
| 음악 이론 | 음 이름(`SP`), 코드 종류(`QUAL`), 코드 만들기(`makeChord`, `voicing`, `nearVoicing`), 누른 음으로 코드 알아보기(`identify`) |
| 소리 엔진 | `AudioEng`, `pianoVoice`, `Synth`, `tick`, `Ticker` |
| 입력 | `Input`(화면 건반·MIDI 공통), `Midi`, `Mic`, `ChromaTracker`, `Judge`(정답 판정) |
| 지연 시간 | 듣는 장치(`outs`), `perfToCtx`, `inLat`, `offsetFrom` |
| 화면 건반 | `Keyboard(host, opts)` 컴포넌트 |
| 각 화면 | `defScreen('home' / 'lesson' / 'press' / 'run' / 'settings' ...)` |
| 시작 | `applyTheme()`, `initShell()`, `runSplash()`, 서비스 워커 등록 |

화면 정의는 `{ title, tab, fit, wake, practice, help, render(el, params) }` 모양이었다. `render`가 정리 함수를 돌려주면 화면을 떠날 때 호출했다. `fit: true`면 화면 높이에 맞춰 스크롤 없이 배치하고, `wake: true`면 Wake Lock을 켜고, `practice`가 있으면 연습 시간을 기록했다.

### 데이터
- **코드 종류 `QUAL`**: `{ sym:'m', ko:'단3화음', read:'마이너', iv:[[0,0],[2,3],[4,7]], lvl:1, mood, how }`. `iv`는 [글자 간격, 반음 수] 쌍이라서 글자 간격으로 정석 이름을, 반음 수로 실제 건반을 구했다. 연습용 10종 외에 알아보기 전용(6, m6, add9, dim7, 7sus4, 9 등)이 더 있었다.
- **레슨 `LESSONS`**: 단계별 페이지 배열. 페이지마다 `t`(제목), `b`(설명 HTML), `show`(건반에 보여 줄 코드), `play`(들려줄 코드), `task`(직접 눌러야 넘어가는 코드), `end`(다음 연습 링크)를 가졌다.
- **코드 진행 `PROGS`**: 로마 숫자로 저장(`['I','V','vi','IV']`)하고 고른 조(C, G, F, D, A, E, B♭, E♭)에 맞춰 코드로 바꿨다.
- **노래 `SONGS`**: `mel: 'C4:1 C4:1 G4:1 ...'`(음:박), `chords: 'C:4 F:2 C:2 ...'`(코드:박) 문자열.
- **단계 `STAGES`**: 홈 화면 목록. 항목마다 이동할 화면 id와 매개변수를 가졌다.

### localStorage 저장 (키 하나: `nanjang_piano_v1`)
```js
DB = {
  settings: { theme, fontScale, noteStyle, keyLabels, showFingers, tapMode, kbL, kbP,
              useMic, midiOn, midiEcho, synthVol, metroVol, noise, micSens,
              onboarded, installDismissed, installNever, autoFS, wakeLock,
              outs: [ {id, name, bt, tap, play, rep, vis} ], out, autoOut },
  sessions:   [ { d:'2026-10-06', f:'press', sec:320, t:시작시각, s:'90점' } ], // 15초 이상만, 최대 4000개
  chordStats: { 'Cm': { n:시도, ok:한번에맞음, ms:걸린시간합 } },
  best:       { 'run_pop': 90, 'ear_1': 9 },
  metro:      { bpm:72, beats:4 },
  prefs:      { runMode:'tempo', 'press_1': {...} },  // 화면별 마지막 선택
  lessons:    { 1: { done:true } }
}
```

---

## 3. 다시 쓸 만한 기술

### 3-1. localStorage를 안전하게 쓰기
읽기·쓰기를 모두 try/catch로 감싸고, 읽은 뒤 기본값과 합쳐(`normalizeDB`) 새 설정 항목이 생겨도 옛 저장 자료가 깨지지 않게 했다.
```js
const DEFAULTS = { theme:'light', fontScale:1, autoFS:true, wakeLock:true /* ... */ };
function loadDB(){ let d={}; try{ const raw=localStorage.getItem(KEY); if(raw) d=JSON.parse(raw)||{}; }catch(e){ d={}; } return normalizeDB(d); }
function normalizeDB(d){ d.settings=Object.assign({},DEFAULTS,d.settings||{}); d.sessions=Array.isArray(d.sessions)?d.sessions:[]; return d; }
function saveDB(){ try{ localStorage.setItem(KEY, JSON.stringify(DB)); }catch(e){} }
```
기록 보관은 `{ app:'nanjang_piano', v:1, at, db }`를 Blob으로 내려받게 하고, 불러올 때 `app` 값을 확인한 뒤 확인 창을 거쳐 `normalizeDB`로 덮어썼다. 기관 업무 도구에서도 "기기를 바꾸기 전에 파일로 보관" 기능은 꼭 넣는 것이 좋다.

### 3-2. 페이지 안 모달(시트)과 뒤로 가기
`alert`/`confirm` 대신 아래에서 올라오는 시트를 썼다. 시트를 열 때 `history.pushState`를 해 두어 안드로이드 뒤로 가기 버튼으로 시트가 닫히게 했다. `confirmSheet`는 Promise를 돌려주어 `if (await confirmSheet('지울까요?','지우기',true))`처럼 쓸 수 있었다.
```js
function openSheet(html, onClose){
  closeSheet(true);
  const bd=document.createElement('div'); bd.className='backdrop';
  const sh=document.createElement('div'); sh.className='sheet'; sh.setAttribute('role','dialog');
  sh.innerHTML='<div class="grab"></div>'+html; document.body.append(bd,sh);
  sheetOpen={bd,sh,onClose}; try{ history.pushState({sheet:1},''); }catch(e){}
  bd.addEventListener('click',()=>history.back()); return sh;
}
window.addEventListener('popstate',()=>{ if(sheetOpen){ const a=sheetOpen.after; closeSheet(true); if(a) setTimeout(a,0); return; } /* 화면 스택 pop */ });
function confirmSheet(msg, ok='확인', danger=false){
  return new Promise(res=>{ let answered=false;
    const sh=openSheet(`<h3>${esc(msg)}</h3><button data-a="no">취소</button><button data-a="yes">${esc(ok)}</button>`, ()=>{ if(!answered) res(false); });
    sh.addEventListener('click',e=>{ const b=e.target.closest('[data-a]'); if(!b) return; answered=true; sheetDone(()=>res(b.dataset.a==='yes')); });
  });
}
```
시트를 닫은 뒤 다른 화면으로 이동해야 할 때는 `sheetDone(after)`로 "뒤로 가기가 끝난 다음" 실행했다. 이렇게 하지 않으면 history가 꼬여 뒤로 가기가 두 번 먹히는 문제가 생긴다.

### 3-3. 홈 화면 설치 안내
- `beforeinstallprompt`를 받아 두었다가(`e.preventDefault()`), 설치 버튼을 누르면 `installEvt.prompt()`를 호출했다.
- 스플래시가 끝나면 최대 2.5초 동안 이 이벤트를 기다렸다가 안내 시트를 띄웠다. 이벤트가 있으면 "설치하기" 버튼을, 없으면 기기별 순서를 보여 주었다.
- iframe 안이거나 "다시 묻지 않기"를 눌렀으면 자동으로 띄우지 않고, 설정의 "홈 화면에 설치하는 방법"으로는 언제든 열 수 있게 했다.
```js
let installEvt=null;
addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); installEvt=e; });
addEventListener('appinstalled',()=>{ installEvt=null; toast('홈 화면에 설치했어요'); });
const ua=navigator.userAgent;
const ios=/iPhone|iPad|iPod/.test(ua) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1); // iPadOS는 Mac으로 보임
const samsung=/SamsungBrowser/i.test(ua), inApp=/KAKAOTALK|NAVER/i.test(ua);
// installEvt → 설치하기 / inApp → "⋮ → 다른 브라우저로 열기" / ios → "공유 ⬆ → 홈 화면에 추가"
// samsung → "≡ → 현재 페이지 추가 → 홈 화면" / 그 밖 → "⋮ → 앱 설치"
```
카카오톡·네이버 앱 안 브라우저에서 링크를 연 경우를 따로 안내한 점이 실무에서 특히 쓸모 있었다. 단체 대화방으로 링크를 나누면 대부분 이 경로로 열리기 때문이다.

### 3-4. 전체화면과 Wake Lock
```js
const FS={ userExit:false,
  standalone(){ return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone===true; },
  supported(){ const d=document.documentElement; return !!(d.requestFullscreen||d.webkitRequestFullscreen) && !this.standalone(); },
  on(){ return !!(document.fullscreenElement||document.webkitFullscreenElement); },
  async enter(){ const d=document.documentElement; try{ d.requestFullscreen ? await d.requestFullscreen({navigationUI:'hide'}) : d.webkitRequestFullscreen(); }catch(e){} },
  async exit(){ try{ document.exitFullscreen ? await document.exitFullscreen() : document.webkitExitFullscreen(); }catch(e){} } };
['fullscreenchange','webkitfullscreenchange'].forEach(t=>document.addEventListener(t,()=>FS.paint())); // 아이콘 켜기/끄기 전환
// 자동 전체화면: 첫 클릭에서 켬. 사용자가 버튼으로 끈 뒤(userExit)에는 다시 켜지 않음
document.addEventListener('click',e=>{ if(!S().autoFS||FS.userExit||FS.on()||!FS.supported()) return; FS.enter(); }, true);

const Wake={ lock:null, want:false,
  async on(){ this.want=true; if(!S().wakeLock||!('wakeLock' in navigator)||this.lock) return;
    try{ this.lock=await navigator.wakeLock.request('screen'); this.lock.addEventListener('release',()=>{ this.lock=null; }); }catch(e){} },
  off(){ this.want=false; try{ this.lock&&this.lock.release(); }catch(e){} this.lock=null; } };
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&Wake.want&&!Wake.lock) Wake.on(); });
```
Wake Lock은 앱을 잠깐 내렸다 올리면 저절로 풀리므로 `visibilitychange`에서 다시 요청해야 한다. 연습 화면에 들어갈 때 켜고 떠날 때 껐다.

### 3-5. 매니페스트와 maskable 아이콘
아이콘을 `purpose: "any"` 두 개(192, 512)와 `purpose: "maskable"` 한 개(512)로 나누었다. maskable 아이콘은 안드로이드가 원·둥근 사각형으로 잘라도 그림이 잘리지 않도록 가운데 약 80% 안에만 그림을 넣고 바깥은 배경색으로 채운 별도 파일이다. `any` 아이콘을 maskable로 겸용하면 가장자리가 잘리거나 흰 테두리가 생긴다.
```json
{ "name":"난장이의 피아노 교실", "short_name":"피아노 교실", "lang":"ko",
  "display":"standalone", "orientation":"any", "background_color":"#F2ECE3", "theme_color":"#F2ECE3",
  "icons":[ {"src":"icon-192.png","sizes":"192x192","purpose":"any"},
            {"src":"icon-512.png","sizes":"512x512","purpose":"any"},
            {"src":"icon-maskable-512.png","sizes":"512x512","purpose":"maskable"} ] }
```
주의: 이 앱은 저장소 규칙(CLAUDE.md)이 정해지기 전에 만들어져 `display: "standalone"`과 `start_url`을 썼다. 새 앱은 규칙대로 `display: "fullscreen"`, `display_override: ["fullscreen","standalone"]`을 쓰고 `start_url`은 넣지 않는다. 테마를 어둡게 바꿀 때는 `<meta name="theme-color">`의 값도 스크립트로 바꿔 주었다.

### 3-6. 서비스 워커 캐시
앱 화면(HTML)은 **네트워크 우선**, 나머지 파일은 **캐시 우선 + 뒤에서 갱신**으로 처리했다. 이렇게 하면 새 버전을 올렸을 때 다음 실행에서 바로 반영되고, 인터넷이 없을 때도 열린다.
```js
const CACHE='nanjang-piano-v2';               // 파일을 바꾸면 버전을 올린다
const CORE=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{ const req=e.request; if(req.method!=='GET') return;
  if(req.mode==='navigate'){ e.respondWith(fetch(req).then(r=>{ const cp=r.clone(); caches.open(CACHE).then(c=>c.put('./index.html',cp)); return r; })
      .catch(()=>caches.match('./index.html'))); return; }
  // 같은 출처와 Google Fonts: 캐시가 있으면 바로 주고, 동시에 새로 받아 캐시를 갱신
  e.respondWith(caches.match(req).then(hit=>{ const net=fetch(req).then(r=>{ if(r.ok||r.type==='opaque') caches.open(CACHE).then(c=>c.put(req,r.clone())); return r; }).catch(()=>hit); return hit||net; }));
});
```
등록은 `location.protocol === 'https:'`일 때만 했다. 파일로 열었을 때 오류가 나지 않게 하기 위해서다.

### 3-7. 가로 화면 우선 배치 (휴대폰·태블릿)
- 기준 미디어 쿼리는 `@media (orientation:landscape) and (max-height:560px)`였다. "가로이면서 높이가 낮은 화면"이 휴대폰 가로 모드이고, 태블릿 가로는 높이가 커서 일반 배치를 썼다.
- 휴대폰 가로에서는 머리줄을 40px로 얇게 하고, 아래 탭을 왼쪽 64px 세로 줄로 옮기고, 연습 화면 위쪽을 "왼쪽 큰 카드 + 오른쪽 단추" 2열 그리드로, 아래쪽은 건반이 남은 높이를 모두 쓰게 했다.
- `fitNow()`가 `innerHeight - 머리줄 - 아래 고정 단추(dock) - 탭`을 계산해 연습 화면 높이를 정하고, 그 안에서 flex로 나누었다. 노치 대응으로 `env(safe-area-inset-*)`를 패딩에 더했다.
- 가로 전용/세로 전용 요소는 `.land-only`, `.land-hide` 클래스로 숨기고 보였다. 시작 버튼은 세로에서는 아래 dock에, 가로에서는 오른쪽 단추 열에 두었다.
- 보이는 흰 건반 수를 가로(`kbL`)와 세로(`kbP`)로 따로 저장했다. 자동일 때 가로는 `round(폭/84)`를 8~15로, 세로는 `floor(폭/37)`을 7~29로 제한했다.
```css
@media (orientation:landscape) and (max-height:560px){
  #pTop.fx{height:clamp(92px,34%,160px);display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);grid-template-rows:repeat(5,auto) 1fr;column-gap:8px}
  #pTop>.fx{grid-column:1;grid-row:1/-1}      /* 문제 카드는 왼쪽 전체 */
  #pTop>:not(.fx){grid-column:2}              /* 나머지 단추는 오른쪽 */
  #pKb{flex:1 1 auto;min-height:0}            /* 건반이 남은 높이를 다 씀 */
  #nav{top:0;width:64px;flex-direction:column} /* 탭은 왼쪽 세로 줄 */
  body.has-nav #view{padding-left:calc(74px + env(safe-area-inset-left,0px))}
}
```
화면 건반은 `pointerdown`/`pointermove`/`pointerup`과 `setPointerCapture`, `document.elementFromPoint`로 만들어 여러 손가락과 미끄러지기를 지원했고, `touch-action:none`으로 스크롤과 확대를 막았다.

### 3-8. Web Audio로 피아노 소리 만들기
음원 파일 없이 사인파를 겹쳐 피아노 비슷한 소리를 냈다.
- 배음 8개(높은 음은 4~6개)를 쓰고, 배음마다 크기 `0.75 / h^1.25`, 사라지는 속도는 높은 배음일수록 빠르게 했다.
- 낮은 음일수록 오래 울리게 `tau = 2.4 * 2^(-(m-60)/22)`초를 썼다.
- 줄의 비조화성 `f*h*sqrt(1 + B*h^2)`과, 1·2배음은 두 줄을 아주 조금 어긋나게(±0.06%) 겹쳐 떨림을 주었다.
- 시작 순간에 노이즈를 대역 필터로 50ms 섞어 해머 소리를 냈고, 로우패스 필터가 시간이 갈수록 닫히게 했다.
- 마스터에 `DynamicsCompressor`를 걸어 여러 음을 동시에 눌러도 찢어지지 않게 했고, 동시 발음은 28개로 제한했다.
- 메트로놈 "틱"은 노이즈를 대역 필터로 걸러 **음높이가 없는 소리**로 만들었다. 마이크 화음 판정을 방해하지 않기 위해서다.
- 박자는 `setInterval(25ms)`로 0.14초 앞까지 미리 예약하고(`ctx.currentTime` 기준), 화면 표시는 `requestAnimationFrame`에서 "실제로 들리는 시각"이 지난 박만 처리했다.
- `AudioContext`는 첫 `pointerdown`에서 만들거나 `resume()`했다. 휴대폰은 사용자 조작 없이 소리를 내지 못하기 때문이다.

### 3-9. 마이크로 여러 음(코드) 알아듣기
**마이크 설정**: `getUserMedia({audio:{echoCancellation:false, noiseSuppression:false, autoGainControl:false}})`. 세 가지를 꺼야 피아노 소리가 깎이지 않는다. 70Hz 하이패스 → `AnalyserNode(fftSize 16384, smoothing 0.35)`.

**음별 세기 구하기 (`spectrumNotes`)**
1. 스펙트럼(dB)의 중앙값을 바닥 소음으로 보고, 바닥 + 18dB보다 큰 **봉우리**만 골랐다.
2. 봉우리 주변 세 칸으로 포물선 보간해 정확한 주파수를 구하고, 가장 가까운 반음에서 0.4 반음 넘게 벗어나면 버렸다.
3. **배음 덜어 내기**: 낮은 음부터 올라가며, 그 음의 배음 자리(+12, +19, +24, +28, +31, +34, +36, +38, +40 반음)에 예상 세기(0.95, 0.7, 0.55 ... 0.22배)를 쌓아 두고 위 음에서 그만큼 뺐다. 도를 치면 솔·미가 들리는 "가짜 음"을 없애는 핵심이다.
4. 판정 대상은 MIDI 40~84(대략 E2~C6)로 두고, **C6 이상은 배음으로만 취급**했다.
5. 12개 음이름별로 합친 크로마(최댓값 1로 정규화)를 만들었다. 가장 센 음의 12% 미만은 버렸다.

**친 순간 찾기 (`ChromaTracker`)**: 빠른 소리 크기(env)가 느린 평균(slow)의 1.5배와 소음 기준(gate)의 1.3배를 넘으면 "새로 친 순간"으로 보았다. 소리 크기로 못 잡는 경우를 위해 음별 세기가 90ms 사이에 전체의 45% 넘게 늘어도 친 것으로 보았다. 친 순간 직전의 스펙트럼을 저장해 두었다가, **앞 코드에서 울리던 음은 0.9배만큼 빼고, 다시 친 음(1.15배 넘게 커진 음)은 남겼다**.

**맞는지 판단 (`micChordCheck`)**
```js
// 목표 코드의 음들이 크로마에 얼마나 잘 맞는지 (코사인 유사도와 비슷)
const fitScore=(c,pcs,n2)=>pcs.reduce((s,p)=>s+c[p],0)/Math.sqrt(pcs.length*n2+1e-9);
const opt = 완전5도가 있으면 그 음(빠져도 됨);                // 근음의 배음과 겹쳐 구별이 어렵다
const present = pcs.filter(p => c[p]>=0.2 || p===opt);
const ts = fitScore(c,pcs,n2);
const bs = 비슷한 다른 주요 코드(12근음×10종) 중 최고 점수;
const strong = 목표에 없는데 0.75 이상인 음;
ok = present.length===pcs.length && ts >= bs*0.985 && !strong.length;
```
그리고 `Judge`에서 **친 순간 110ms 뒤부터 1.4초 안의 프레임만** 보고, **연속 3프레임** 맞아야 정답으로 쳤다. 앱이 소리를 내는 동안(`synthMuteUntil`, 소리 끝 + 0.5~1.2초)은 판정을 쉬어 스피커 소리를 피아노로 착각하지 않게 했다. 노래 반주 중에는 멜로디 음을 무시 목록(`ignore`)에 넣었다.

**오탐을 약 12%에서 2%로 줄인 변경** (두 번째 커밋 `b6b8751`). 이 수치는 개발할 때 시험해서 얻은 값이고, 측정 방법은 커밋 기록에 남아 있지 않다.
| 첫 버전 | 개선 후 |
|---|---|
| 들린 음을 하나씩 세어 "목표 음이 다 있고 다른 음이 0.42 미만이면 정답" | 목표 코드와 **비슷한 다른 코드들의 점수를 비교**해 목표가 가장 잘 맞아야 정답 |
| 친 뒤 2.5초 동안의 모든 소리를 판정 | **최근 친 순간 이후 새로 생긴 소리만** 판정 (앞 코드의 남은 울림 빼기), 1.4초 안으로 단축 |
| 배음 표 7개, 계수 0.9~0.2 | 배음 표 9개로 늘리고 계수를 키움, 높은 배음은 옆 반음까지 덜어 냄 |
| 봉우리 기준 바닥+15dB, 주파수 오차 0.35 | 바닥+18dB로 엄격하게, C6 이상은 배음으로만 취급 |
| 5음이 약하면 오답 | 5음이 빠져도 정답 (코드 성격은 3음과 7음이 정함) |

**주변 소음 재기**: 3초 동안 RMS를 모아 `median*1.2 + sd*0.5`(0.0015~0.03로 제한)를 소음 기준으로 저장하고, 감도(둔하게 0.6 / 보통 1 / 예민하게 1.8)로 나누어 gate를 정했다.

**마이크 실패 안내**: 오류 이름별로 다른 안내 카드를 보여 주었다. `NotAllowedError`(허용 창 닫힘 / 막힘을 `permissions.query`로 구분), `NotFoundError`(마이크 없음), `NotReadableError`(다른 앱 사용 중), https가 아님(파일로 열림), iframe 안(`permissionsPolicy.allowsFeature('microphone')`가 false). 3초 동안 소리가 완전히 0이면 "폰의 마이크 접근 권한을 확인하라"고 알렸다.

### 3-10. 지연 시간 재기와 보정
블루투스 이어폰은 소리가 0.1~0.3초 늦고, 화면 터치도 수십 ms 늦으므로 "박자대로" 판정에서 이 값을 빼야 했다.
- **듣는 장치별로 따로 저장**: `outs = [{id:'base', name:'폰 스피커 · 유선 이어폰'}, {id:'bt', name:'블루투스 이어폰', bt:true}]`. 장치마다 `tap`(화면 두드림 지연), `play`(MIDI·마이크 지연), `vis`(화면 늦춤)를 가졌다. 마이크 장치 이름에 bluetooth/airpods/buds가 있으면 블루투스로 자동 전환했다.
- **재는 방법**: 90BPM "틱"을 준비 4번 + 16번 들려주고, 사용자가 소리에 맞춰 두드린(또는 친) 시각을 모은다. 시각은 `getOutputTimestamp()`로 `performance.now()`를 "스피커에서 실제로 나오는 소리 시계"로 바꾸었다.
- **원형 평균으로 박보다 일찍 친 것도 처리**:
```js
function offsetFrom(xs, I){            // xs: 첫 틱 기준 친 시각들, I: 박 간격
  if(xs.length<8) return null;
  let sx=0, sy=0; xs.forEach(x=>{ const a=2*Math.PI*x/I; sx+=Math.cos(a); sy+=Math.sin(a); });
  let mu=Math.atan2(sy,sx)/(2*Math.PI)*I; if(mu<-0.15) mu+=I;
  const d=xs.map(x=>x-Math.round((x-mu)/I)*I); const med=median(d), mad=median(d.map(x=>Math.abs(x-med)));
  return mad<0.05 ? med : null;        // 들쭉날쭉하면 "박자가 고르지 않았어요"
}
```
- **판정**: `친 시각(소리 시계) - 입력 지연 - 코드가 바뀐 박 시각`을 박 단위로 나누어 ±0.3박 안이면 "딱 맞음"으로 보았다.
- **화면 늦춤**: 블루투스로 들을 때는 박 표시가 소리보다 먼저 움직이므로, 두 장치의 지연 차이만큼(0~400ms) 화면 표시를 늦췄다. 사용자가 깜빡이는 점을 보며 직접 맞출 수도 있었다.
- 지연을 아직 안 쟀으면 처음 "박자대로"를 시작할 때 한 번 권했다.

### 3-11. 그 밖의 작은 기술
- **한국어 조사 자동 선택**: 마지막 글자의 받침을 계산해 "C`가`/Cm`이`", "미♭`으로`"처럼 붙였다. 알파벳과 숫자는 읽는 소리로 받침을 판단했다(L, M, N, R과 0, 1, 3, 6, 7, 8은 받침 있음).
- **글꼴 로딩 대기**: 스플래시는 `document.fonts.load()`와 1.3초 중 먼저 끝나는 쪽을 기다려 글꼴이 바뀌며 깜빡이는 것을 막았다.
- **연습 시간 기록**: 화면에 들어갈 때 시작 시각을 적고, 떠날 때 15초 이상이면 저장했다. 연속 일수는 오늘 기록이 없으면 어제부터 거꾸로 셌다.

---

## 4. 겪은 문제와 해결 (교훈)

1. **마이크 오탐 (약 12% → 2%)**: 들린 음을 개수로 세는 방식은 배음과 앞 코드의 울림 때문에 틀린 코드도 맞다고 했다. "비슷한 코드끼리 점수 비교", "친 순간 이후 새로 생긴 소리만", "5음은 빠져도 됨", "연속 3프레임"을 함께 써서 줄였다. 교훈: 신호 판정은 기준값 하나를 조이는 것보다 **경쟁 후보와 비교**하는 쪽이 더 튼튼하다.
2. **앱 소리를 마이크가 다시 듣는 문제**: 정답 소리, 시범 연주, 메트로놈이 판정을 망쳤다. 앱이 소리를 내는 동안과 그 뒤 잠시 판정을 쉬고(`synthMuteUntil`), 메트로놈은 음높이 없는 노이즈 틱으로 바꾸었다.
3. **박자 판정이 늘 "늦음"으로 나옴**: 블루투스와 터치 지연 때문이었다. 처음에는 `ctx.currentTime - outputLatency`만 썼지만 기기마다 값이 부정확해서, 사용자가 직접 재는 장치별 보정으로 바꾸었다. 입력 이벤트의 `e.timeStamp`(MIDI도 `e.timeStamp`)를 그대로 써서 처리 지연을 줄였다.
4. **휴대폰 가로 화면에서 건반이 너무 작음**: 처음에는 세로 기준 배치에 "건반 크기 크게/보통/작게"만 있었다. 가로 전용 레이아웃(왼쪽 탭, 2열 상단, 건반이 남은 높이 전부)과 가로·세로별 흰 건반 수로 바꾸었다. 교훈: 악기·게임처럼 넓게 써야 하는 앱은 **가로 휴대폰(높이 360~430px)** 을 먼저 맞춘다.
5. **휴대폰에서 세 음을 동시에 누르기 어려움**: "콕콕"(하나씩 켜 두기) 모드를 기본으로 하고, 틀린 건반은 다시 눌러 끄게 했다.
6. **마이크가 안 되는 이유가 다양함**: 파일로 열기(https 아님), 미리보기 iframe, 권한 거부, 다른 앱 사용 중, 이어폰 마이크 문제를 각각 다른 문구로 안내했다. 마이크 없이도 화면 건반으로 계속할 수 있게 "마이크 없이 하기" 버튼을 항상 두었다.
7. **MIDI 지원 범위**: 아이폰·아이패드 Safari는 Web MIDI를 지원하지 않는다. 지원하지 않으면 버튼 대신 안내 문구를 보여 주고, 권한을 이미 받은 경우에만 앱 시작 때 자동 연결했다.
8. **음 이름 표기 오류**: 반음 수로만 계산하면 Cm이 "도 레♯ 솔"이 된다. 글자 간격과 반음 수를 함께 저장하고, 근음 이름은 ♯·♭이 가장 적고 겹♯·겹♭이 없는 쪽으로 골랐다.
9. **저장소 규칙과의 차이**: 이 앱은 CLAUDE.md 규칙보다 먼저 만들어져 매니페스트가 `standalone`이고 `start_url`이 있으며, Artifact용 head 태그 이동과 `apple-mobile-web-app-title`이 없었다. 새 앱은 CLAUDE.md의 설치·전체화면 규칙을 그대로 따른다.

---

## 5. 다시 만들 때 Claude에게 줄 요청 예시

아래를 복사해 필요한 부분만 바꿔 쓴다. 기관 업무용 도구라면 3번 대신 그 업무의 화면을 적는다.

```
Sungmo 저장소에 새 앱 폴더 <폴더명>/ 를 만들어 줘. CLAUDE.md 규칙(홈 화면 설치, 전체화면,
sw.js 캐시 버전, localStorage try/catch, 페이지 안 모달)을 모두 지켜 줘.
piano/README.md(삭제된 피아노 앱 정리 문서)의 기술을 참고해 줘.

1. 대상: <누가, 어떤 기기로> 예) 복지관 어르신 프로그램 강사가 태블릿 가로 화면으로 사용
2. 목적: <한 문장>
3. 화면: 첫 실행 안내(2~4단계) / 홈(단계별 목록) / <연습·업무 화면들> / 기록 / 설정
4. 저장: localStorage 키 하나에 settings·기록을 넣고 기본값과 합쳐 읽기. 기록은 JSON 파일로
   보관·불러오기.
5. 배치: 휴대폰 가로(높이 560px 이하)를 먼저 맞추고, 탭은 가로에서 왼쪽 세로 줄로.
6. (필요하면) 소리: Web Audio로 합성, 첫 터치에서 AudioContext 시작. 마이크를 쓰면 실패 이유별
   안내와 "마이크 없이 하기"를 넣고, 앱이 소리를 내는 동안은 마이크 판정을 쉬어 줘.
7. 화면이 오래 켜져 있어야 하면 Wake Lock(실패해도 조용히).
8. 끝나면 Playwright(/opt/pw-browsers/chromium)로 휴대폰 세로·가로, 태블릿 가로 화면을 확인하고
   스크립트 오류가 없는지 보고해 줘.
```
