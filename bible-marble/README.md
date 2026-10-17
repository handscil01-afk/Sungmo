# 성경 부루마블: 만들면서 배운 것 정리

이 문서는 `bible-marble/` 앱의 코드를 지우기 전에, 앞으로 기관 업무용 웹 앱을 만들 때 다시 쓸 수 있도록 구조와 기술과 교훈을 정리한 기록입니다. 원래 코드는 이 저장소의 git 기록(2026-10-06 ~ 2026-10-09, 커밋 13개)에 남아 있습니다.

## 1. 앱 개요

성경 부루마블은 주사위를 굴려 성경의 땅(우르, 하란, 시내산, 여리고, 예루살렘 등)을 여행하며 땅을 사고, 건물을 짓고, 말씀 퀴즈를 푸는 2~4인 보드게임이었습니다. 교회 교육 프로그램과 소그룹에서 쓰는 것을 목표로 했고, 설치 없이 브라우저에서 열리며 한 번 연 뒤에는 인터넷 없이도 열렸습니다.

### 화면 구성

- **처음 화면**: 홈 화면 설치 배너, 새 게임, 이어하기(저장된 게임), 함께하기(여러 기기), 콘텐츠 관리, 규칙 보기가 있었습니다.
- **게임 설정 창(탭)**: 게임, 플레이어, 게임 규칙, 퀴즈, 퀴즈 규칙, 컴퓨터, 화면, 소리, 콘텐츠, 멀티플레이, 추가 기능 탭으로 나누었습니다. 태블릿에서 스크롤 없이 한 화면에 들어가도록 탭을 계속 쪼갰습니다.
- **게임 화면**: 가운데에 32칸 보드가 있고, 가로 화면에서는 양옆에 플레이어 상황판(달란트, 가진 땅 카드 패, 인물 카드)이 있었습니다. 게임 중에는 머리줄을 숨기고 보드 가운데에 되돌리기와 설정 버튼만 두었습니다.
- **선택 창(모달)**: 주사위 굴리기, 땅 사기, 건물 짓기, 퀴즈, 카드, 땅 팔기, 거래 제안 등 모든 선택을 페이지 안의 창으로 띄웠습니다.
- **콘텐츠 관리**: 퀴즈, 보드 판, 말씀 카드를 켜고 끄고 고치고 추가했고, 엑셀(.xlsx)과 CSV로 내보내고 불러왔습니다. 성경 본문 불러오기와 전체 백업(.json)도 여기에 있었습니다.

### 주요 기능

- 보드 판 세 가지(신구약, 구약, 신약)와 판의 시대에 맞는 퀴즈 약 260문항(객관식, 주관식), 말씀 카드가 있었습니다.
- 사람마다 화면 주사위와 실물 주사위(나온 숫자 입력)를 고를 수 있었고, 컴퓨터 플레이어는 쉬움·보통·어려움 난이도로 퀴즈 정답률이 달랐습니다.
- 되돌리기는 사람의 마지막 선택 하나만 취소했고, 주사위 눈과 문제는 그대로 유지했습니다.
- 자동 저장과 이어하기, 게임 기록과 명예의 전당, 승리 연출과 결과 이미지 공유를 지원했습니다.
- 추가 기능으로 성경 인물 카드 수집, 플레이어끼리 땅 거래, 말씀 암송 미션 칸, 시간 제한, 팀전, 진행자 즉석 문제를 켜고 끌 수 있었습니다.
- 캐릭터에 기기 사진을 넣을 수 있었고, 배경 음악은 Web Audio로 직접 합성했습니다.

### 누가 어떻게 썼나

- **한 기기 게임**: 태블릿 한 대를 가운데 두고 돌아가며 눌렀습니다.
- **플레이어 모드(여러 기기)**: 방장도 플레이어 한 명이 되고, 참가자는 각자 휴대폰으로 방 코드나 공유 링크로 들어왔습니다. 각자 자기 자리만 조작할 수 있었고, 주관식은 직접 입력하면 게임이 채점했습니다.
- **중계 모드(여러 기기)**: 방장은 진행자·심판이 되어 TV에 게임 화면을 띄웠습니다. PC에서는 "게임 화면 창"을 따로 열어 확장 모니터로 보냈고, 진행자 창이나 진행자 리모컨(휴대폰, PIN 필요)에서만 정답을 보고 판정했습니다. 참가자 휴대폰에는 자기 상황판 중심의 화면이 나왔습니다.

## 2. 구조

### 파일 구성

빌드 없이 일반 `<script>` 태그를 순서대로 불러오는 방식이었습니다. 모듈끼리는 전역 변수(`G`, `Net`, `UI`, `PREF` 등)로 이어졌습니다.

| 파일 | 역할 |
|---|---|
| `index.html` | 머리줄, `#home`, `#game`(보드와 양옆 상황판), 토스트, 스크립트 목록 |
| `css/game.css` | 모든 화면 스타일(약 75KB). 글자 크기는 `--fs`, 보드 크기는 `--bs` CSS 변수로 조절 |
| `js/util.js` | `$`, `esc`, `store`(localStorage 래퍼), `IDB`(IndexedDB), 한국어 조사(`IGA`, `REUL` 등), 사진 저장, 파일 저장·고르기, `readText`(UTF-8/EUC-KR) |
| `js/xlsx-lite.js` | 라이브러리 없이 .xlsx 쓰기·읽기, CSV 쓰기·읽기 |
| `js/data/boards.js`, `quiz.js`, `cards.js` | 기본 보드 판, 퀴즈, 말씀 카드 |
| `js/content.js` | 기본 콘텐츠와 사용자 수정분을 합치는 저장소, 엑셀 행 ↔ 데이터 변환과 검사, 백업 |
| `js/bible.js` | 성경 책 목록, 구절 주소 해석(`parseRefs`), 사용자 본문 파일 해석과 IndexedDB 저장 |
| `js/engine.js` | 게임 규칙과 진행. 화면을 직접 만들지 않고 "요청서"를 만듦. 권한 검사, 되돌리기 기록, 저장 |
| `js/extra.js` | 추가 기능 규칙(인물 카드, 거래, 암송 미션, 시간 제한, 즉석 문제, 기록) |
| `js/ai.js` | 컴퓨터 플레이어: 요청서 종류별로 잠깐 기다린 뒤 답함 |
| `js/ui/board.js` | 보드, 상황판, 주사위 애니메이션, 효과음, 배경 음악, 화면 크기 맞춤(`UI.fit`) |
| `js/ui/prompts.js` | 모달 레이어(`openLayer`), 요청서별 선택 창, 퀴즈 창, 말씀 보기 |
| `js/ui/photo.js` | 사진 말 자르기(핀치 확대·회전) |
| `js/ui/home.js`, `manage.js`, `extra.js` | 처음 화면과 설정 탭, 콘텐츠 관리, 추가 기능 화면 |
| `js/firebase-config.js`, `js/fb.js` | Firebase 설정값과 Firebase 중계 연결 |
| `js/net.js` | 함께하기: 방장·참가자 역할, 연결 방식 선택, 자리·열쇠, 권한 검사, 방 화면 |
| `js/app.js` | 화면 전환, 설치·전체화면, Wake Lock, 서비스 워커 등록, 시작(`boot`) |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | 오프라인 실행과 홈 화면 설치 |
| `vendor/` | `peerjs.min.js`(MIT), `firebase-*-compat.js`(Apache-2.0)와 라이선스 파일 |

### 게임 상태 모델

게임 상태 `G`는 JSON으로 그대로 저장하고 전송할 수 있는 값만 담았습니다. 함수나 DOM 참조를 넣지 않은 것이 저장, 되돌리기, 멀티플레이를 모두 쉽게 만든 핵심이었습니다.

```js
G = { v:3, cfg:{...}, board:{id,name,era,groups[8],tiles[32]}, cards:[...],
  room:{code,mode}|null,
  players:[{id, pid, name, ai, aiLv, tok, col, dice, net, mates, host, op,
            money, pos, jail, skip, ark, song, chars, out}],
  own:{ [칸 번호]: {o: 주인 id, l: 건물 단계 0~3} },
  pot, turn, round, dbl, deck, used, log:[], over, started, clock, hq, st }
```

- `players[].net`은 그 자리를 조작하는 참가 기기 ID이고, `ai`는 컴퓨터, `host`는 플레이어 모드의 방장 자리, `op`는 중계 모드에서 진행자가 대신 조작하는 자리였습니다.
- 저장은 `store.set('save', {G, J, net})` 한 줄이었습니다. `J`는 되돌리기용 기록(차례 시작 상태와 선택 목록)이고, `net`은 방 코드와 자리 열쇠였습니다.

### 데이터 형식

- **보드 판**: 칸은 정확히 32개이고 0·8·16·24번은 출발·광야·헌금함·원하는 칸으로 고정했습니다. 칸 종류는 `start, city, spot, card, quiz, jail, pot, fly, tithe, event`였습니다.
  ```js
  {"t":"city","g":0,"name":"우르","pic":"🏺","price":60,"note":"...","ref":"창 11:31"}
  ```
- **퀴즈**: `t`는 `mc`(객관식) 또는 `sa`(주관식), `lv`는 난이도, `era`는 `ot/nt/all`이었습니다. 객관식은 `c[0]`이 정답이고 게임에서 보기를 섞었습니다. 주관식은 `a`가 정답, `alt`가 함께 인정하는 답이었습니다.
  ```js
  {"id":"q002","t":"mc","lv":"easy","era":"ot","cat":"인물","q":"하나님이 처음 지으신 사람의 이름은?","c":["아담","노아","아브라함","모세"],"ref":"창 2:19-20"}
  ```
- **말씀 카드**: `fx.k`로 효과 종류(`gain`, `pay_pot`, `move_to`, `give_each` 등)를 정하고 `fx.n`에 값을 넣었습니다.
- **사용자 콘텐츠 저장**: 기본 데이터는 코드에 그대로 두고, 바뀐 것만 `{items:{id:항목}, off:[끈 id], del:[지운 기본 id]}`로 저장한 뒤 화면에서 합쳤습니다. 그래서 앱을 업데이트해 기본 문제가 늘어나도 사용자의 수정분이 사라지지 않았습니다.
- **localStorage 키**(접두어 `biblemarble.`): `prefs`(화면·소리 설정), `setup`(인원과 규칙), `save`(진행 중인 게임), `c.quiz`/`c.card`/`c.board`(콘텐츠 수정분), `records`(최근 60판), `photos`(사진 말), `memo.verses`(직접 넣은 암송 구절), `net.cid`/`net.profile`/`net.session`/`net.keys`(함께하기).
- **설정 기본값**은 `Object.assign({기본값}, store.get('prefs', {}))`로 합쳐서, 새 설정 항목이 생겨도 예전 저장값과 충돌하지 않게 했습니다. 예전 형식(제한 시간 하나)은 불러올 때 새 형식(객관식·주관식 따로)으로 옮겼습니다.

### 성경 본문은 사용자가 불러오기

개역개정 본문은 저작권이 대한성서공회에 있어서 저장소에 넣지 않았습니다. 저장소에는 `"창 12:1-4"` 같은 구절 주소만 두었습니다.

1. 콘텐츠 관리 → 성경 본문에서 사용자가 가진 파일(.txt, .csv, .tsv, .json, .xlsx)을 고릅니다.
2. `readText`가 UTF-8로 먼저 읽고, 실패하면 EUC-KR로 읽습니다.
3. `Bible.parse`가 여러 형식(`창1:1 본문`, `창세기 1장 1절 본문`, 책 이름 줄 아래 `1:1 본문`, 책·장·절·본문 열, JSON)을 `{책번호:{장:{절:본문}}}`으로 바꿉니다.
4. 몇 권 몇 절을 찾았는지와 창세기 1장 1절을 미리 보여 주고, 사용자가 확인하면 IndexedDB(`biblemarble` DB, `kv` 저장소)에 저장합니다.
5. 게임에서 📖 구절을 누르면 `parseRefs`로 주소를 해석해 본문을 큰 글씨로 보여 주고, 본문이 없으면 불러오는 방법을 안내했습니다.

본문은 수 MB라서 localStorage(보통 5MB 한도)가 아니라 IndexedDB에 두었습니다.

## 3. 다시 쓸 만한 기술

### 3-1. 홈 화면 설치 배너와 전체화면

- Artifact 등으로 게시하면 `<head>` 태그가 body로 들어가므로, 시작할 때 설치 관련 태그를 `document.head`로 옮겼습니다.
- `beforeinstallprompt`를 받아 두었다가 설치 버튼을 누르면 바로 설치 창을 띄웠고, 없으면 기기별 설치 순서를 안내했습니다.

```js
document.head.append(...document.querySelectorAll('link[rel=manifest],link[rel=icon],link[rel=apple-touch-icon],meta[name=theme-color],meta[name=mobile-web-app-capable],meta[name^=apple-mobile-web-app]'));
const STANDALONE=()=>matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true;
const IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1); // 아이패드는 Mac처럼 보임
let installEvt=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e});
async function openInstall(){ if(installEvt){const e=installEvt;installEvt=null;e.prompt();await e.userChoice;return}
  showInstallSteps(IOS?'ios':SAMSUNG?'samsung':ANDROID?'android':'pc') }
```

- 전체화면은 표준 API와 `webkit` 접두어를 함께 처리하고, 사용자가 버튼으로 직접 끄면 `userExit`를 기억해 자동 전체화면을 다시 켜지 않았습니다.

```js
const FS={userExit:false,
  can(){const d=document.documentElement;return !!(d.requestFullscreen||d.webkitRequestFullscreen)&&document.fullscreenEnabled!==false},
  is(){return !!(document.fullscreenElement||document.webkitFullscreenElement)},
  enter(quiet){const d=document.documentElement;if(!this.can()){if(!quiet)openInstall('fs');return}
    Promise.resolve(d.requestFullscreen?d.requestFullscreen({navigationUI:'hide'}):d.webkitRequestFullscreen()).catch(()=>{if(!quiet)openInstall('fs')})},
  toggle(){if(this.is()){this.userExit=true;(document.exitFullscreen||document.webkitExitFullscreen).call(document)}else{this.userExit=false;this.enter(false)}}};
// 자동 전체화면: 처음 누를 때 (capture 단계에서)
document.addEventListener('click',e=>{if(!PREF.autoFS||FS.userExit||FS.is()||STANDALONE()||!FS.can())return;FS.enter(true)},true);
```

- `iframe` 안이면(`window.self!==window.top`) 설치가 잘 안 된다는 안내를 덧붙였습니다. 홈 화면 앱으로 열렸으면 배너와 전체화면 버튼을 숨겼습니다.
- 전체화면을 켜고 끄거나 화면을 돌리면 브라우저가 새 크기를 늦게 알려 줄 때가 있어서, `UI.refit()`이 바로 한 번, 그리고 120ms, 350ms, 800ms 뒤에 다시 크기를 계산했습니다.

### 3-2. 서비스 워커 캐시

화면 파일은 "네트워크 먼저, 실패하면 저장본", 글꼴은 "저장본 먼저"로 처리했습니다. 파일을 바꿀 때마다 `CACHE` 이름의 버전을 올리고 `CORE` 목록을 고쳐야 했습니다(마지막 버전은 `biblemarble-v12`).

```js
const CACHE='biblemarble-v12', CORE=['./','./index.html','./css/game.css','./js/app.js' /* ...모든 파일 */];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('biblemarble-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
  e.respondWith(fetch(req).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp))}return r})
    .catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||(req.mode==='navigate'?caches.match('./index.html'):undefined))))});
```

등록은 `https:`에서만 했습니다: `if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js')`.

### 3-3. localStorage를 try/catch로 감싸기

사파리 사생활 보호 모드나 저장 공간 부족에서도 앱이 멈추지 않게, 모든 읽기와 쓰기를 한곳에서 감쌌습니다. 접두어를 함수로 만든 덕분에 테스트에서 한 브라우저로 여러 기기를 흉내 낼 수 있었습니다.

```js
const SP=()=>window.__SP||'biblemarble.';
const store={
  get(k,d){try{const v=localStorage.getItem(SP()+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem(SP()+k,JSON.stringify(v));return true}catch(e){return false}},
  del(k){try{localStorage.removeItem(SP()+k)}catch(e){}}};
```

`set`이 `false`를 돌려주면 "저장 공간이 부족해요"라고 알리거나, 사진처럼 지워도 되는 자료는 오래된 것부터 지우고 다시 저장했습니다.

### 3-4. 페이지 안의 창(모달) 레이어

`alert`/`confirm` 대신 창 세 겹(`prompt` 진행 선택, `info` 설정·정보, `edit` 편집·확인)을 두었습니다. 같은 레이어를 다시 열면 이전 창을 닫으므로 창이 쌓여 꼬이지 않았습니다.

```js
const LAYER_ID={prompt:'pov',info:'iov',edit:'eov'};
function openLayer(layer,html,o={}){closeLayer(layer);
  const ov=document.createElement('div');ov.className='ov';ov.id=LAYER_ID[layer];
  ov.innerHTML=`<div class="mbox" role="dialog" aria-modal="true">${o.close?'<button class="xclose" data-x>×</button>':''}${html}</div>`;
  document.body.appendChild(ov);const close=()=>{if(ov.isConnected){ov.remove();o.onClose&&o.onClose()}};
  if(o.close){ov.querySelector('[data-x]').onclick=close;ov.addEventListener('click',e=>{if(e.target===ov)close()})}
  return {ov,box:ov.querySelector('.mbox'),close}}
const topLayer=()=>$('#eov')||$('#iov')||$('#pov');   // Esc는 맨 위 창만 닫음
```

되돌리기, 방 나가기, 저장 지우기처럼 되돌릴 수 없는 일은 항상 확인 창을 한 번 더 띄웠고, "지우기" 버튼은 "한 번 더 누르면 지워요"로 바뀌는 방식도 썼습니다.

### 3-5. 엔진과 화면 분리: 요청서(ask) 구조

이 앱에서 가장 쓸모 있었던 설계입니다. 규칙 코드는 화면을 만들지 않고 "누가 무엇을 골라야 하는지"를 요청서로 만들어 기다렸습니다. 그 요청서에 이 기기의 사람, 컴퓨터(`ai.js`), 다른 기기의 참가자(`net.js`) 누구든 답할 수 있었습니다.

```js
async function ask(spec){
  spec.id=++PSEQ; PROMPT=spec; persist();
  const v=await waitFor(done=>{
    spec.resolve=(val,by='local')=>{ if(PROMPT===spec&&mayResolve(spec,by,val)&&validate(spec,val)) done(val) };
    dispatch(spec);            // actorOf로 답할 사람을 정하고, 컴퓨터면 AI.respond, 화면에 창 표시, 참가자에게 전송
  });
  PROMPT=null; J.cur.steps.push({k:spec.kind,v,u:spec.undo&&spec.by!=='ai'?1:0}); return v }
// 사용: const buy = await ask({kind:'buy', who:'player', pid:p.id, tile:i, undo:1});
```

- **흐름 중단**: `RUN` 번호를 두고, 처음 화면으로 나가거나 되돌리면 `RUN++` 하고 기다리던 모든 Promise를 `ABORT`로 거절했습니다. `sleep`도 깨어난 뒤 `RUN`이 바뀌었으면 멈췄습니다.
- **되돌리기와 이어하기**: 차례마다 시작 상태(`clone(G)`)와 모든 선택·무작위 값을 기록했습니다. 되돌리면 마지막 사람 선택 하나만 빼고 같은 기록을 재생했고, 주사위와 문제는 `rnd(kind, gen)`이 남겨 둔 값을 다시 써서 바뀌지 않았습니다. 재생 중에는 `REPLAY` 플래그로 애니메이션과 소리를 건너뛰었습니다.
- 이 구조 덕분에 "이어하기"도 같은 재생 코드로 해결했습니다.

### 3-6. 여러 기기 동기화

**원칙**: 방장 기기가 엔진을 돌리는 유일한 심판이었습니다. 참가자 기기는 받은 상태를 그리기만 하고, 자기 차례의 선택만 `{t:'in', id:요청서번호, v:값}`으로 보냈습니다.

**메시지 종류**: `hello/welcome/deny`(입장), `lobby`(대기실 자리), `st`(보드·카드처럼 바뀌지 않는 부분, 게임마다 한 번), `s`(바뀌는 상태, 60ms 묶어서), `p`(지금 요청서), `e`(소리·애니메이션 이벤트), `in`(선택), `cmd`(리모컨 명령), `ph`(사진), `ping/pong`, `bye`.

**연결 방식 세 가지**를 같은 모양(`send`, `close`, `_d` 받기, `_c` 끊김)으로 감싸서 바꿔 끼웠습니다.

```js
const transport=local=>local||window.__NET==='bc'?BCTransport:FB.configured()?FBTransport:PeerTransport;
```

- `BCTransport`: 같은 PC의 창끼리(`BroadcastChannel`). 중계 모드의 게임 화면 창이 인터넷 없이도 연결되었고, 테스트에도 썼습니다.
- `FBTransport`: Firebase Realtime Database를 우편함처럼 거치는 방식. 일반 웹 연결이라 아이폰, 카카오톡 앱 안 브라우저, LTE에서도 안정적이었습니다.
- `PeerTransport`: PeerJS로 기기끼리 직접 연결. Firebase 설정이 없을 때의 대안이었지만, 통신사 망이나 앱 안 브라우저에서 자주 실패해서 Firebase로 옮겼습니다.

**Firebase 방 모델**(`rooms/{방코드}/...`):

| 경로 | 내용 | 누가 씀/읽음 |
|---|---|---|
| `meta` | `{host: 방장 uid}` | 처음 잡은 사람만 씀, 모두 읽음 |
| `hp` | 방장 접속 여부 `{on}` | 방장만 씀 |
| `in/{push}` | 참가자 → 방장 편지 `{f: 보낸 uid, s: JSON 문자열}` | 누구나 자기 uid로 새 편지만 씀, 방장만 읽음 |
| `q/{uid}/{push}` | 방장 → 참가자 편지 | 방장과 본인만 씀, 본인만 읽음 |
| `pr/{uid}` | 참가자 접속 여부 | 본인이 씀, 방장만 읽음 |
| `lobby/{코드}` | 방 목록에 보일 정보 | 방장만 씀, 로그인한 모두 읽음 |

- 기기 ID는 Firebase **익명 로그인** uid라서 다른 기기가 흉내 낼 수 없었습니다.
- 받은 편지는 읽자마자 지웠습니다(`onChildAdded` → `remove`).
- `onDisconnect().set({on:false})`로 연결이 끊기면 서버가 자동으로 "끊김"을 기록했고, 방 목록 항목도 방장이 끊기면 서버가 지웠습니다.
- `.info/connected`가 다시 `true`가 되면 참가자가 `hello`를 다시 보냈습니다. 잠깐 끊긴 사이 방장이 그 기기를 끊긴 것으로 처리했을 수 있기 때문입니다.
- SDK는 함께하기를 누를 때만 `vendor/`에서 불러와 첫 화면을 가볍게 했습니다.

**보안 규칙의 핵심**(전체 규칙은 git 기록의 루트 `README.md`에 있습니다):

```json
"in": { ".read": "방장 uid === auth.uid",
  "$id": { ".write": "auth != null && !data.exists() && newData.child('f').val() === auth.uid",
           ".validate": "newData.child('s').isString() && newData.child('s').val().length < 8000" } },
"q":  { "$uid": { ".read": "auth.uid === $uid", ".write": "auth.uid === $uid || 방장 uid === auth.uid" } }
```

여기서 `방장 uid`는 `root.child('rooms').child($code).child('meta/host').val()`입니다. 편지 크기를 8000자로 제한했기 때문에 사진도 그보다 작게 줄여야 했습니다.

**자리와 열쇠**: 방장은 참가 기기마다 열쇠(`keys[cid]`)를 발급해 기기에 저장하게 했습니다. 새로고침이나 앱 재시작 뒤에도 같은 열쇠로 들어오면 같은 자리로 돌아갔습니다. `net.session`을 12시간 동안 기억해서 앱을 다시 열면 자동으로 방에 다시 들어갔고, 방장이 나갔다가 "이어하기"를 누르면 같은 방 코드로 방을 다시 열었습니다.

### 3-7. 요청마다 권한 검사, 비밀 정보는 볼 수 있는 기기에만

화면 버튼을 숨기는 것만으로는 부족했습니다. 방장 엔진이 받은 모든 선택에 대해 세 단계로 검사했습니다.

1. `net.js`의 `onInput`: 지금 요청서의 답할 사람(`actorOf`)이 보낸 기기와 맞는지 확인합니다.
2. `engine.js`의 `mayResolve`: 답이 어디서 왔는지(`local`, `net`, `ai`, `timer`)가 허용된 경로인지 확인합니다.
3. `validate`: 값의 모양과 범위를 확인합니다(예: 주사위는 1~6 정수 두 개, 팔 땅은 실제로 내 땅).

```js
function seatActor(p){ if(!p||p.ai) return {t:'ai'}; const m=MODE();
  if(m==='local') return {t:'local'};
  if(p.net) return {t:'net', cid:p.net, cids:(p.mates||[]).map(x=>x.cid)};   // 팀원 기기도 허용
  if(m==='relay') return {t:'judge'};   return p.host?{t:'local'}:{t:'ai'} }
onInput(m,msg){ const spec=PROMPT; if(!spec||spec.id!==msg.id) return; const a=spec.actor;
  const ok=(a.t==='net'&&m.kind==='player'&&(a.cid===m.cid||a.cids.includes(m.cid)))||(a.t==='judge'&&m.kind==='remote');
  if(ok) spec.resolve(msg.v,'net') }
```

- 리모컨 명령(`cmd`)은 리모컨으로 들어온 기기, 중계 모드일 때만 받고, 달란트 조정 값도 정수와 범위를 검사했습니다.
- **정답 숨기기**: 요청서를 보낼 때 `pubSpec`이 `resolve`, `secret` 같은 필드를 빼고, 퀴즈 정보는 `pubQuiz`가 결과 단계 전까지 정답·해설을 지웠습니다. 정답은 `secret`에 따로 담아 **진행자 리모컨에게만** 보냈습니다.
  ```js
  promptMsg(m){ return {t:'p', p:this.lastPrompt, secret: m.kind==='remote'?this.lastSecret:null} }
  ```
- 비공개 방 비밀번호는 서버에 올리지 않고 방장 기기만 알고 있다가 `hello`에서 확인했습니다. 리모컨은 방장이 만든 4자리 PIN으로만 들어왔습니다.
- 받은 이름, 이모지, 색은 길이를 자르고 허용 목록과 비교한 뒤에만 썼습니다.

### 3-8. 라이브러리 없이 엑셀 읽고 쓰기 (xlsx-lite)

.xlsx는 XML 파일 몇 개를 zip으로 묶은 것입니다. 약 100줄로 해결했습니다.

- **쓰기**: 압축하지 않는 zip(저장 방식 0)을 직접 만들고 CRC32만 계산했습니다. 셀은 `inlineStr`로 넣어 sharedStrings 없이 썼고, 첫 줄 고정과 머리글 색을 styles.xml에 넣었습니다.
- **읽기**: zip 끝의 중앙 디렉터리(`0x06054b50`)를 찾아 파일 목록을 읽고, 압축된 항목은 브라우저 내장 `DecompressionStream('deflate-raw')`로 풀었습니다. 그다음 `DOMParser`로 workbook.xml, 관계 파일, sharedStrings.xml, 시트를 읽었습니다.

```js
async function inflate(bytes){ const ds=new DecompressionStream('deflate-raw');
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer()) }
// 셀: t="s"면 sharedStrings[번호], t="inlineStr"면 <is><t>, 숫자는 +val. 열 번호는 r="C5"의 글자에서 계산
```

- CSV는 엑셀에서 한글이 깨지지 않게 BOM(`﻿`)을 붙여 저장했고, 읽을 때 탭과 쉼표 중 많은 쪽을 구분자로 골랐습니다.
- **불러오기 검사**: 머리글 이름으로 열을 찾고(순서 무관), 줄마다 무엇이 틀렸는지 "5째 줄: 난이도는 쉬움·보통·어려움 중 하나로 적어 주세요"처럼 모아서 보여 준 뒤 맞는 줄만 가져올 수 있게 했습니다. 내보낸 파일의 ID를 그대로 두면 수정, 비우면 추가였습니다. 양식 설명 시트도 함께 내보냈습니다.

### 3-9. 사진 처리

- 고른 사진을 먼저 1024px 안쪽으로 줄여 캔버스에 그린 뒤 편집했습니다(큰 사진은 핀치가 버벅임).
- 편집 화면은 Pointer Events로 손가락 위치를 `Map`에 모아, 한 손가락이면 이동, 두 손가락이면 거리 비율로 확대, 각도 차이로 회전했습니다. PC는 휠과 버튼으로 했습니다.
- 결과는 128px 정사각형 JPEG로 그리고, 품질을 0.85부터 0.1씩 낮추며 7000자보다 작아질 때까지 다시 만들었습니다(Firebase 편지 8000자 제한 때문).
- 저장 전에 형식을 검사했습니다: `/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/`이고 60000자 미만. 최근 24장만 남겼습니다.
- 함께하기에서는 방장이 쓰이는 사진만, 아직 받지 않은 기기에만 보냈습니다.

### 3-10. 컴퓨터 플레이어와 끝까지 자동 진행 테스트

- `AI.respond(spec)`는 요청서 종류별로 사람처럼 잠깐 기다린 뒤 답했습니다. 땅은 "사고 나서도 예비금(`150 + 라운드×12`, 최대 400)이 남으면" 샀고, 거래는 받는 가치가 주는 가치의 1.2배보다 클 때만 받아들였습니다.
- 퀴즈 정답률은 컴퓨터 난이도와 문제 난이도의 표로 정했습니다: `AIACC={easy:{easy:.6,normal:.45,hard:.3}, normal:{easy:.85,...}, hard:{...}}`.
- 컴퓨터가 고른 값도 사람과 똑같이 `resolve(val,'ai')`를 거쳐 같은 검사를 받았습니다. 자리 주인이 바뀌면(사람 → 컴퓨터) `redispatch()`로 지금 요청서를 새 주인에게 다시 보냈습니다.

**자동 테스트 방법**(Playwright, `/opt/pw-browsers/chromium`): 코드에 테스트용 스위치를 두고, 모든 자리를 컴퓨터로 두면 `actorOf`가 끝 화면까지 모두 컴퓨터에게 넘겨서 사람 없이 게임이 끝났습니다.

| 스위치 | 효과 |
|---|---|
| `window.__SPD=0` | 모든 `sleep`과 연출 시간을 0으로 (게임 한 판이 몇 초) |
| `window.__NET='bc'` | 인터넷 없이 같은 브라우저 탭끼리 연결 |
| `window.__SP`, `window.__CID` | 저장 접두어와 기기 ID를 바꿔 한 브라우저로 여러 기기 흉내 |
| `window.__FBMOCK` | Firebase 대신 가짜 API(같은 `set/push/onChildAdded` 모양) |
| `window.__LOBBYMS`, `window.__OFFMS` | 끊김 판정 대기 시간(15초, 30초)을 짧게 |

테스트에서는 휴대폰 세로, 휴대폰 가로, 태블릿 크기로 화면을 찍어 보고, 방장 탭 하나와 참가자 탭 여러 개로 끝까지 진행하면서 `pageerror`와 콘솔 오류가 없는지 확인했습니다. 테스트 스크립트 자체는 저장소에 남기지 않았습니다.

### 3-11. Wake Lock과 그 밖의 작은 기술

```js
const Wake={l:null,async on(){try{if(navigator.wakeLock&&!this.l){this.l=await navigator.wakeLock.request('screen');
  this.l.addEventListener('release',()=>{this.l=null})}}catch(e){}}};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&gameRunning())Wake.on()});
```

화면을 껐다 켜면 잠금이 풀리므로 다시 보일 때마다 요청했습니다.

- **한국어 조사**: 받침 여부로 `이/가`, `을/를`, `은/는`, `으로/로`를 붙였습니다. `batchim=w=>{const c=w.charCodeAt(w.length-1)-0xAC00;return c>=0&&c<11172&&c%28!==0}`이고, `로`는 받침 ㄹ(`c%28===8`)이면 `으로`를 쓰지 않았습니다.
- **방 공유**: `navigator.share`가 있으면 공유 창(카카오톡, 문자), 없으면 링크 복사. 링크는 `#room=코드&pw=비밀번호` 형식이라 받은 사람은 이름만 적고 들어왔습니다. 해시를 읽은 뒤 `history.replaceState`로 주소에서 지웠습니다.
- **TV 화면 창**: `window.open`은 누른 순간 바로 호출해야 팝업이 막히지 않습니다. 그 뒤 `getScreenDetails()` 권한이 있으면 확장 모니터로 옮겼습니다.
- **주관식 채점**: `normalize('NFC')`, 소문자, 공백과 문장부호 제거 후 정답이나 인정 답과 같으면 정답으로 했습니다.
- **배경 음악**: 오디오 파일 없이 `OscillatorNode`로 정해 둔 악보(80BPM 20마디)를 미리 예약해 끊김 없이 반복했습니다. 오디오는 첫 터치(`pointerdown`) 뒤에만 시작할 수 있습니다.
- **결과 이미지**: 캔버스에 순위표를 그려 `toBlob`으로 만들고 `navigator.share({files:[f]})`로 보냈습니다.

## 4. 겪은 문제와 해결

1. **보드를 다시 그리면 토스트가 사라짐**: `#board.innerHTML=''`이 그 안에 옮겨 둔 토스트 요소까지 지웠습니다. 다시 그리기 전에 공용 요소를 `document.body`로 먼저 옮기도록 고쳤습니다. 교훈: 공용 요소는 다시 그리는 영역 밖에 둡니다.
2. **게임을 나간 뒤에도 흐름이 계속됨**: 주사위 애니메이션을 기다리는 사이 처음 화면으로 나가면, 애니메이션이 끝난 뒤 이동이 이어졌습니다. `await` 뒤에 `if(id!==RUN||!G) throw ABORT`를 넣었습니다. 교훈: 긴 `await` 뒤에는 항상 "아직 같은 흐름인가"를 확인합니다.
3. **나간 뒤의 지연 저장**: 120ms 뒤에 저장하는 타이머가 게임을 나간 뒤 실행되어 빈 상태를 저장할 뻔했습니다. 타이머 안에서 `if(!G) return`을 확인했습니다.
4. **방장이 남의 행동을 대신할 수 있었음**: 처음에는 화면 버튼만 숨겼습니다. `actorOf`/`mayResolve`로 엔진에서 검사하도록 바꾸고, 플레이어 모드에서는 공평하게 되돌리기를 껐습니다.
5. **참가자 기기에서 정답이 보일 수 있었음**: 요청서 객체를 그대로 보내면 정답이 함께 갔습니다. 보낼 필드만 고르는 `pubSpec`/`pubQuiz`와 리모컨 전용 `secret`으로 나누었습니다.
6. **PeerJS 연결 실패**: LTE, 아이폰, 카카오톡 앱 안 브라우저에서 기기끼리 직접 연결이 자주 실패했습니다. Firebase Realtime Database 중계로 바꾸고 PeerJS는 대안으로만 남겼습니다.
7. **같은 사람이 두 번 들어옴**: 다른 브라우저로 다시 들어오면 새 기기로 보여 자리가 둘이 되었습니다. 이름이 같고 연결이 끊긴 자리가 있으면 그 자리로 돌려보냈습니다. 열쇠가 다르면 같은 ID라도 다른 기기로 보았습니다.
8. **잠깐 끊긴 뒤 방장이 나를 모름**: Firebase가 다시 이어져도 방장은 이미 끊김 처리를 했을 수 있었습니다. 다시 연결될 때 자동으로 `hello`를 다시 보냈습니다.
9. **퀴즈 편집기 오류**: 객관식과 주관식을 바꾸면 창을 다시 그리는데, 다시 그리기 직전에 입력값을 읽는 코드가 이미 바뀐 유형에 없는 입력 칸을 읽다가 멈췄습니다. 다시 그릴 때는 읽지 않도록 고쳤습니다. 교훈: 창을 다시 그리는 함수와 입력값을 읽는 함수를 섞지 않습니다. 같은 때 엑셀 불러오기는 "보기1~6" 대신 "정답 + 오답1~5" 열도 받도록 넓혔고, "이동할 칸" 카드를 저장하면 그 칸이 있는 판에서만 나온다고 알려 주었습니다.
10. **성경 파일의 나뉜 절**: 어떤 파일은 한 절이 두 줄로 나뉘어 `창35:야곱의 아들은...`처럼 절 번호 없는 줄이 있었습니다. 그런 줄은 앞 절에 이어 붙이고, 새 장 첫 줄에 절 번호가 없으면 1절로 넣고, 시편의 "제이권" 같은 권 제목은 건너뛰었습니다. 교훈: 사용자 파일은 형식이 제각각이므로 몇 절을 찾았는지와 견본을 보여 주고 확인받습니다.
11. **설정 형식 변경**: 제한 시간 하나를 객관식·주관식 둘로 나누면서, 예전 저장값을 읽을 때 두 칸에 모두 옮겼습니다. 저장된 게임은 `migrateGame`으로 빠진 필드를 채웠습니다.
12. **화면 회전 뒤 쏠림**: 회전하거나 전체화면을 오가면 이전 스크롤 위치가 남아 화면이 한쪽으로 밀렸습니다. 게임 중 크기를 맞출 때 `scrollTo(0,0)`을 했습니다.
13. **태블릿에서 설정이 넘침**: 탭 하나에 항목이 많으면 스크롤이 생겼습니다. 탭을 나누고 휴대폰용 촘촘한 배치를 따로 만들었습니다.
14. **팝업 차단**: 비동기 작업 뒤에 `window.open`을 하면 막혔습니다. 누른 순간 창을 열고 위치 이동은 나중에 했습니다.
15. **참가자 휴대폰마다 배경 음악이 겹침**: 기본값을 "방장, 혼자 하는 기기, 게임 화면 창에서만 켬"으로 했습니다.

## 5. 다시 만들 때 Claude에게 줄 요청 예시

아래를 고쳐서 쓰면 비슷한 앱을 처음부터 만들 수 있습니다. 업무용 앱(출석, 프로그램 참여 퀴즈, 대기 번호표 등)에도 같은 틀을 쓸 수 있습니다.

```text
Sungmo 저장소에 <앱이름>/ 폴더로 새 웹 앱을 만들어 줘. CLAUDE.md 규칙(홈 화면 설치, 전체화면, sw.js 캐시, localStorage try/catch, 페이지 안 모달)을 지켜 줘.

목적: <무엇을, 누가, 어디서 쓰는지>. 휴대폰·태블릿 가로 화면 우선, UI는 한국어.
구조: 빌드 없이 index.html + css/ + js/(일반 script). 엔진은 화면을 만들지 말고
  "요청서(ask)"를 만들어 기다리게 하고, 사람·컴퓨터·다른 기기가 같은 경로로 답하게 해 줘.
상태: 전역 상태 하나를 JSON으로 저장 가능한 값만 담아 자동 저장·이어하기를 지원해 줘.
여러 기기: 방장 기기가 유일한 심판. Firebase Realtime Database(익명 로그인)로
  rooms/{코드}/meta·hp·in·q/{uid}·pr/{uid} 우편함 구조를 쓰고, 보안 규칙도 함께 만들어 줘.
  요청마다 보낸 기기의 권한과 값을 엔진에서 검사하고, 정답 같은 비밀은 볼 수 있는 기기에만 보내 줘.
  Firebase 설정이 없으면 같은 기기 창끼리(BroadcastChannel)만 연결되게 해 줘.
콘텐츠: 기본 데이터는 js/data/에 두고, 사용자 수정분만 따로 저장해서 합쳐 보여 줘.
  엑셀(.xlsx)·CSV 내보내기/불러오기는 라이브러리 없이(DecompressionStream) 만들고,
  잘못된 줄은 몇째 줄이 왜 틀렸는지 보여 줘.
개인정보·저작권: <저작권 본문이나 개인정보>는 저장소에 넣지 말고 사용자가 파일을 불러와 기기 안(IndexedDB)에만 저장해 줘.
테스트: window.__SPD=0, __NET='bc', __SP 같은 테스트 스위치를 넣고, Playwright로 휴대폰·태블릿 화면을 확인하고
  컴퓨터끼리(또는 탭 여러 개로) 끝까지 자동 진행해서 오류가 없는지 확인한 뒤 결과를 알려 줘.
한 번에 한 단계씩 진행하고, 바꿀 파일을 먼저 설명해 줘.
```

## 6. 외부 서비스 정리

- **Firebase 프로젝트**: 이름은 `bible-marble`이었습니다. Realtime Database(싱가포르 asia-southeast1)와 Authentication(익명 로그인)을 썼습니다. 설정값은 `js/firebase-config.js`에 있었고, 이 문서에는 옮기지 않았습니다.
- 앱을 더 이상 쓰지 않으면 [Firebase 콘솔](https://console.firebase.google.com)에서 `bible-marble` 프로젝트의 Realtime Database 데이터를 지우거나, 프로젝트 설정 → 일반 → 맨 아래 "프로젝트 삭제"로 프로젝트 전체를 지우는 것을 권합니다. 코드 파일을 지워도 설정값은 git 기록에 남아 있으므로, 프로젝트를 지우거나 데이터베이스 규칙을 잠가 두면 더 안전합니다.
- **PeerJS**: 무료 공개 PeerJS 서버를 처음 연결할 때만 썼고, 따로 계정은 없었습니다.
- **Google Fonts**: Jua, Gowun Dodum 글꼴을 불러왔습니다.
- **대한성서공회 웹사이트**: 성경 본문이 없을 때 구절 링크(`bskorea.or.kr`의 읽기 페이지)로 안내하는 데만 썼습니다.
- 루트 `README.md`에도 성경 부루마블 소개와 Firebase 보안 규칙 전체가 있으니, 앱 폴더를 지울 때 그 부분도 함께 정리하면 됩니다.
