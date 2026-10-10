/* 시작: 저장된 기록을 불러오고 첫 화면을 그린다 */
(function (root) {
  'use strict';
  const DB = root.DB;

  // Artifact 등으로 게시되면 head 태그가 body로 들어가므로 다시 head로 옮긴다
  document.querySelectorAll('body > link[rel="manifest"], body > link[rel~="icon"], body > link[rel="apple-touch-icon"], body > meta[name]').forEach(el => document.head.appendChild(el));

  DB.game.load();
  DB.game.onChange = () => DB.ui.onGameChange();
  DB.ui.render();

  // 화면 어디든 처음 누르면 자동 전체화면과 화면 꺼짐 방지를 시도한다
  document.addEventListener('pointerdown', e => DB.pwa.userGesture(e), { capture: true });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    root.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* 무시 */ }); });
  }
})(window);
