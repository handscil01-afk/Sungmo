'use strict';
/* ===================== 설정 =====================
   가을운동회 점수판(sports-day)·점자 골든벨과 같은 파이어베이스 프로젝트(handscil-sports)를 씀.
   문자통역 자료는 Realtime Database 의 caption1 아래에만 둠 (규칙: sports-day/database.rules.json 의 caption1 부분) */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDihHD0cldHyY0MWViA_R0yb-nkIoJ_-4I",
  authDomain: "handscil-sports.firebaseapp.com",
  projectId: "handscil-sports",
  storageBucket: "handscil-sports.firebasestorage.app",
  messagingSenderId: "431367162993",
  appId: "1:431367162993:web:fa488b8e5d0acc98ffdfd0"
};
const ROOT = 'caption1';
const RTDB_URL = 'https://handscil-sports-default-rtdb.asia-southeast1.firebasedatabase.app';
const QS = new URLSearchParams(location.search);
// 주소 뒤에 ?demo=1 을 붙이면 이 브라우저에만 저장하는 연습 모드 (탭마다 다른 기기처럼 동작)
const DEMO = QS.has('demo');
// 개발용: 내 PC(localhost)에서 ?emu=1 을 붙이면 Firebase 에뮬레이터에 연결
const EMU = QS.has('emu') && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const APP_VER = '10';                         // 판 번호 (version.json 과 같게, 바꾸면 sw.js 캐시 이름도)
const APP_ADDR = 'handscil01-afk.github.io/Sungmo/caption/';
const ROOM_STALE_MS = 2 * 24 * 3600 * 1000;   // 이만큼 쓰지 않은 방 번호는 새 방이 가져갈 수 있음 (서버 규칙과 같은 값)
const LOBBY_LIVE_MS = 6 * 3600 * 1000;        // 처음 화면 방 목록에 보여 줄 기간
const DRAFT_MS = 50;                          // 치는 중인 글을 보내는 간격(밀리초)
