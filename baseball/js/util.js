'use strict';
/* ===================== 공통 도구 · 설정 ===================== */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const ls = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} },
};

/* 규칙 버전과 저장 불러오기 뼈대
   RULES_VER: 경기 계산·화면 정의가 바뀌어 두 기기가 서로 맞지 않게 되는 때 올림. 온라인 방(cfg.ver)과 상태(ver)에 실어 보내고, 다르면 들어가지 못하게 막음.
   migrate(kind, obj): 저장해 둔 설정·경기·리그를 불러올 때 거치는 자리. 새 칸은 더하기만 하고, 없는 칸의 기본값은 MIGRATIONS에 단계(to)로 적음.
   지금은 단계가 없어서 아무것도 바꾸지 않음. 단계를 적용했을 때만 obj.mv(저장 형식 번호)를 남김. */
const RULES_VER = 1;
const MIGRATIONS = { set:[], game:[], league:[] };   // 예: game:[{ to:2, run: G => { G.inningLog ||= []; } }]
function migrate(kind, obj){
  if(!obj || typeof obj !== 'object') return obj;
  let v = obj.mv || 1;
  (MIGRATIONS[kind] || []).forEach(m => { if(m.to > v){ try{ m.run(obj); }catch(e){} v = m.to; obj.mv = v; } });
  return obj;
}

// 사용자 설정 (이 기기에만 저장)
// fs: 글자 크기 · theme: 화면 색 · voice: 읽어 주기(sr 화면 낭독기 · tts 기기 음성 · off) · dice: 판정 과정 보기
// pad: 코스 키패드 배열(phone 1 2 3이 위 · pc 7 8 9가 위) · snd: 효과음 · vib: 진동 · quick: 명령 칸에서 숫자를 누르면 바로 고르기
// name: 온라인 대전에서 쓰는 내 이름 · chatRead: 받은 채팅 읽어 주기 · vmode: 음성 대화 방식(call 통화 · ptt 무전기)
// mgrAsk: 감독 모드에서 작전을 묻는 때(key 중요한 순간만 · every 매 타석) · mgrPitch: 감독 모드에서 공 하나하나 읽기
// sndKind: 효과음 종류(rec 녹음한 야구 소리 · synth 간단한 소리) · revOdds: 비디오 판독 확률을 숫자(num)로·말(word)로
// watch: 관전 자동 재생 간격(초) · autoFS: 자동 전체화면 · installDismissed: 설치 안내 배너를 닫았는지
const SET_DEF = { fs:1, theme:'dark', voice:'sr', dice:false, pad:'phone', snd:true, vib:true, quick:true, watch:4, autoFS:true, installDismissed:false, rate:1, name:'', chatRead:true, vmode:'call', mgrAsk:'key', mgrPitch:false, revOdds:'num', sndKind:'rec', view:null, crowd:true, easy:1, cast:true, pickThrow:true, throwSec:6, deliver:'both', rev:2,
  // 직접 고르기(정밀 모드)에서 사람이 고를 항목. 고르지 않는 항목은 컴퓨터가 정함
  picks:{ pt:true, loc:'full', edge:true, pow:true, bat:'full', guess:true } };
const SET = { ...SET_DEF, ...migrate('set', ls.get('bb_set', {})) };
if(SET.voice === 'cast'){ SET.voice = 'sr'; SET.cast = true; }
const saveSet = () => ls.set('bb_set', SET);
/* 화면 방식(화면 보며 하기 gfx · 소리와 글로 하기 a11y)에 따른 차이를 한곳에 모음. 경기 계산은 두 방식이 같고, 이 객체가 "이 방식에서 무엇을 어떻게 보일지"만 정함.
   다른 파일에서 SET.view를 직접 비교하지 않고 여기를 거침 */
const VIEW = {
  get gfx(){ return SET.view === 'gfx'; },
  get a11y(){ return SET.view !== 'gfx'; },
  // 경기 화면(그림 + 짧은 결과 + 선택지를 한 화면에): 화면 보며 하기에서 경기 상황판이 있을 때
  game(S){ return VIEW.gfx && !!S.board && typeof G !== 'undefined' && !!G; },
  // 메뉴·설정 화면(경기 화면이 아닐 때)의 꾸밈
  menu(S){ return VIEW.gfx && !VIEW.game(S) && !S.board; },
  // 결과 글을 숨기는 때: 소리와 글로 하기에서 결과 전달이 '소리만'이고 중계 음성이 결과를 말할 때
  castOnly(S){ return VIEW.a11y && !!S.board && typeof G !== 'undefined' && !!G && !G.over && typeof castOn === 'function' && castOn() && SET.deliver === 'sound'; },
  // 선택지를 방향대로 배치(코스·높이·붙이기): 화면 보며 하기는 늘, 소리와 글은 설정(숫자판 방향 배치)을 켰을 때
  dirLayout(){ return VIEW.gfx || !!SET.padDir; },
  // 경기 내내 깔아 주는 관중 소리는 그림이 있는 화면 방식에서만
  crowd(){ return VIEW.gfx && !!SET.crowd; },
};
function applySet(){
  const r = document.documentElement;
  r.dataset.fs = SET.fs; r.dataset.theme = SET.theme;
  r.classList.toggle('lowvis', !!SET.lowvis);   // 저시력 크게 보기: 단추·글자를 크게
}
