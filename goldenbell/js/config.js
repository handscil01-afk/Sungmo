'use strict';
/* ===================== 설정 =====================
   가을운동회 점수판(sports-day)과 같은 파이어베이스 프로젝트(handscil-sports)를 씀.
   골든벨 자료는 Realtime Database 의 goldenbell1 아래에만 둠 (규칙: sports-day/database.rules.json 의 goldenbell1 부분) */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDihHD0cldHyY0MWViA_R0yb-nkIoJ_-4I",
  authDomain: "handscil-sports.firebaseapp.com",
  projectId: "handscil-sports",
  storageBucket: "handscil-sports.firebasestorage.app",
  messagingSenderId: "431367162993",
  appId: "1:431367162993:web:fa488b8e5d0acc98ffdfd0"
};
const ROOT = 'goldenbell1';
const RTDB_URL = 'https://handscil-sports-default-rtdb.asia-southeast1.firebasedatabase.app';
// 주소 뒤에 ?demo=1 을 붙이면 이 브라우저에만 저장하는 연습 모드 (진행자·직원 비밀번호 0000, 탭마다 다른 기기처럼 동작)
const DEMO = new URLSearchParams(location.search).has('demo');
const DEMO_PW = '0000';
const APP_ADDR = 'handscil01-afk.github.io/Sungmo/goldenbell/';
