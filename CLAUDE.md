# Sungmo 저장소 작업 규칙

이 저장소에는 빌드 없이 브라우저에서 바로 동작하는 웹 앱(게임, 연습 도구 등)을 앱마다 폴더 하나씩 만든다. 예: `bible-marble/`, `piano/`
- 작은 앱은 HTML 파일 하나로 만들어도 된다. 커지면 `bible-marble/`처럼 `index.html` + `css/` + `js/`(일반 `<script>`, 빌드 없음)로 나눈다.
- GitHub Pages(`main` 브랜치)로 배포한다. 주소: https://handscil01-afk.github.io/Sungmo/<앱 폴더>/
- 파일을 추가·변경하면 앱의 `sw.js` 캐시 목록과 캐시 이름(버전)도 함께 고친다.
- 외부 라이브러리는 `vendor/`에 넣고 라이선스 파일을 같이 둔다.
- 저작권이 있는 본문(예: 개역개정 성경)은 저장소에 넣지 않는다. 사용자가 자기 파일을 불러와 기기 안에만 저장하게 한다.

## 모든 웹 앱에 기본으로 넣을 기능 (사용자 요청 사항)

새 앱을 만들거나 기존 앱을 크게 고칠 때, 따로 말하지 않아도 아래 두 기능을 반드시 넣는다.

### 1. 홈 화면 설치
- 앱 폴더에 `manifest.webmanifest`, `icon-192.png`, `icon-512.png`를 둔다. 매니페스트에는 `display: "fullscreen"`, `display_override: ["fullscreen","standalone"]`, 한국어 `name`/`short_name`, 테마 색을 넣는다. `start_url`은 넣지 않는다(Artifact 주소에서도 동작하도록).
- `<head>`에 manifest, icon, apple-touch-icon, `mobile-web-app-capable`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title` 태그를 넣는다. Artifact로 게시하면 태그가 body로 들어가므로, 스크립트에서 이 태그들을 `document.head`로 옮긴다.
- 첫 화면(처음 실행 화면) 위쪽에 "홈 화면에 설치" 안내 배너를 띄운다. 버튼: 설치하기 / 전체화면 / 다음에. "다음에"를 누르면 기억해서 다시 띄우지 않고, 첫 화면 아래와 설정 메뉴에는 "홈 화면에 설치하기" 버튼을 계속 둔다.
- `beforeinstallprompt`를 받았으면 바로 설치 창을 띄우고, 없으면 기기별 설치 방법(아이패드·아이폰 Safari 공유 버튼, 안드로이드 크롬 ⋮ 메뉴, 삼성 인터넷 ≡ 메뉴, PC 크롬·엣지 설치 아이콘)을 안내한다.
- 홈 화면 앱으로 열렸을 때(`display-mode: standalone/fullscreen`, `navigator.standalone`)는 설치 안내와 전체화면 버튼을 숨긴다.

### 2. 전체화면
- 헤더에 전체화면 버튼(켜기/끄기 아이콘 전환, `fullscreenchange`·`webkitfullscreenchange` 처리)을 둔다. 게임처럼 화면을 최대한 넓게 써야 하는 화면에서는 헤더를 숨기고 전체화면 켜기·끄기를 설정 메뉴(화면)에 둔다(사용자 요청).
- 설정에 "자동 전체화면"(기본 켬)을 두고, 켜져 있으면 화면을 처음 누를 때 전체화면으로 바꾼다. 사용자가 버튼으로 직접 끈 뒤에는 자동으로 다시 켜지 않는다.
- 전체화면이 막힌 환경(iframe, 아이폰 등)에서는 버튼을 눌렀을 때 홈 화면 설치 방법을 안내한다.
- 게임처럼 오래 켜 두는 앱은 Wake Lock으로 화면이 꺼지지 않게 한다(실패해도 조용히 넘어간다).

## 그 밖의 관례
- UI 문구는 한국어로 쓰고, 휴대폰·태블릿(가로 화면 포함)을 먼저 고려한다.
- 사용자 설정과 진행 상황은 localStorage에 저장하되, 모든 읽기·쓰기를 try/catch로 감싼다.
- `alert`/`confirm`/`prompt` 대신 페이지 안의 창(모달)을 쓴다.
- 여러 기기로 하는 앱은 화면 버튼만 숨기지 말고, 상태를 바꾸는 요청마다 보낸 기기의 권한을 검사한다. 정답처럼 공개하면 안 되는 정보는 그 정보를 볼 수 있는 기기에만 보낸다.
- 커밋하기 전에 Playwright(`/opt/pw-browsers/chromium`)로 휴대폰·태블릿 크기 화면을 확인하고, 게임이라면 컴퓨터끼리 끝까지 자동 진행해서 스크립트 오류가 없는지 확인한다.
