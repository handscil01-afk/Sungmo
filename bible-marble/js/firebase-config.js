'use strict';
/* Firebase 설정값: Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹)의 firebaseConfig를 그대로 넣습니다.
   이 값들은 공개되어도 되는 식별자이고, 보안은 Realtime Database 규칙(README 참고)이 맡습니다.
   비워 두면 예전 방식(PeerJS 기기끼리 직접 연결)으로 동작합니다. */
window.FIREBASE_CONFIG=window.FIREBASE_CONFIG||null;
