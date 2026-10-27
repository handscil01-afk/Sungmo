'use strict';
/* ===================== 공통 도구 · 설정 ===================== */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const ls = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} },
};

// 사용자 설정 (이 기기에만 저장)
// fs: 글자 크기 · theme: 화면 색 · voice: 읽어 주기(sr 화면 낭독기 · tts 기기 음성 · off) · dice: 판정 과정 보기
// pad: 코스 키패드 배열(phone 1 2 3이 위 · pc 7 8 9가 위) · snd: 효과음 · vib: 진동 · quick: 명령 칸에서 숫자를 누르면 바로 고르기
// watch: 관전 자동 재생 간격(초) · autoFS: 자동 전체화면 · installDismissed: 설치 안내 배너를 닫았는지
const SET_DEF = { fs:1, theme:'dark', voice:'sr', dice:false, pad:'phone', snd:true, vib:true, quick:true, watch:4, autoFS:true, installDismissed:false, rate:1 };
const SET = { ...SET_DEF, ...ls.get('bb_set', {}) };
const saveSet = () => ls.set('bb_set', SET);
function applySet(){
  const r = document.documentElement;
  r.dataset.fs = SET.fs; r.dataset.theme = SET.theme;
}
