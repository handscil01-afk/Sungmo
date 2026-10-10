/* 홈 화면 설치, 전체화면, 화면 꺼짐 방지(Wake Lock) */
(function (root) {
  'use strict';
  const DB = root.DB;
  let installEvt = null, userFsOff = false, lock = null;

  const P = DB.pwa = {
    standalone() {
      return root.matchMedia('(display-mode: standalone)').matches || root.matchMedia('(display-mode: fullscreen)').matches || root.navigator.standalone === true;
    },
    fsOn() { return !!(document.fullscreenElement || document.webkitFullscreenElement); },
    fsSupported() { const d = document.documentElement; return !!(d.requestFullscreen || d.webkitRequestFullscreen) && !P.standalone(); },
    async enterFs() {
      const d = document.documentElement;
      try {
        if (d.requestFullscreen) await d.requestFullscreen({ navigationUI: 'hide' });
        else if (d.webkitRequestFullscreen) d.webkitRequestFullscreen();
        else return false;
        return true;
      } catch (e) { return false; }
    },
    async exitFs() {
      try { if (document.exitFullscreen) await document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); } catch (e) { /* 무시 */ }
    },
    async toggleFs() {
      if (P.fsOn()) { userFsOff = true; await P.exitFs(); return; }
      if (P.standalone()) { DB.ui.toast('홈 화면 앱으로 실행 중이라 이미 전체 화면입니다.'); return; }
      const ok = P.fsSupported() && await P.enterFs();
      if (!ok) P.howTo(true);
    },
    // 자동 전체화면: 설정이 켜져 있고, 사용자가 직접 끈 적이 없을 때 첫 터치에서 전환
    userGesture(e) {
      P.wake();
      const t = e && e.target && e.target.closest ? e.target : null;
      if (t && t.closest('[data-act="fs"], #sFs, [data-act="install"], #sInst')) return;
      if (!DB.game.settings.autoFS || userFsOff || P.fsOn() || P.standalone() || !P.fsSupported()) return;
      P.enterFs();
    },
    async install() {
      if (P.standalone()) { DB.ui.toast('이미 홈 화면 앱으로 실행 중입니다.'); return; }
      if (installEvt) {
        installEvt.prompt();
        try { await installEvt.userChoice; } catch (e) { /* 무시 */ }
        installEvt = null;
        return;
      }
      P.howTo(false);
    },
    howTo(fromFs) {
      const ua = navigator.userAgent;
      const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const samsung = /SamsungBrowser/.test(ua), android = /Android/.test(ua);
      let how;
      if (ios) how = '<b>아이패드·아이폰 Safari</b>: 화면 위나 아래의 <b>공유 버튼</b>(네모에 위쪽 화살표)을 누르고 <b>홈 화면에 추가</b>를 고르세요.';
      else if (samsung) how = '<b>삼성 인터넷</b>: 아래쪽 <b>≡ 메뉴</b>를 누르고 <b>현재 페이지 추가 → 홈 화면</b>을 고르세요.';
      else if (android) how = '<b>안드로이드 크롬</b>: 오른쪽 위 <b>⋮ 메뉴</b>를 누르고 <b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 고르세요.';
      else how = '<b>PC 크롬·엣지</b>: 주소창 오른쪽의 <b>설치 아이콘</b>(모니터에 아래 화살표)을 누르거나, 메뉴에서 <b>앱 설치</b>를 고르세요.';
      DB.ui.modal({
        title: '홈 화면에 설치하기',
        html: `${fromFs ? '<p>이 환경에서는 전체화면을 바로 켤 수 없습니다. 홈 화면에 설치하면 주소창 없이 전체 화면으로 실행됩니다.</p>' : '<p>홈 화면에 설치하면 아이콘을 눌러 바로 열고, 주소창 없이 전체 화면으로 즐길 수 있습니다.</p>'}<p class="howto">${how}</p>`
      });
    },
    async wake() {
      if (!DB.game.settings.wakeLock) { if (lock) { try { await lock.release(); } catch (e) { /* 무시 */ } lock = null; } return; }
      if (lock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
      try { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } catch (e) { /* 실패해도 조용히 넘어간다 */ }
    },
    hasPrompt() { return !!installEvt; }
  };

  root.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
  root.addEventListener('appinstalled', () => { installEvt = null; DB.ui && DB.ui.toast('홈 화면에 설치했습니다.'); });
  const paint = () => { if (DB.ui) DB.ui.paintFs(); };
  document.addEventListener('fullscreenchange', paint);
  document.addEventListener('webkitfullscreenchange', paint);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') P.wake(); });
})(window);
