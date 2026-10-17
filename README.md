# Sungmo

## 웹에서 열기 (GitHub Pages)

- 앱 목록: https://handscil01-afk.github.io/Sungmo/
- DICEBOUND 운명의 주사위: https://handscil01-afk.github.io/Sungmo/dicebound/
- 다과비 계산기: https://handscil01-afk.github.io/Sungmo/snack-calc/

각 앱은 따로 홈 화면에 설치해서 따로 실행할 수 있습니다. `main` 브랜치에 올린 내용이 몇 분 안에 사이트에 반영됩니다.

## 정리한 앱 (코드 삭제, 개발 노트만 남김)

아래 두 앱은 코드를 지우고, 나중에 비슷한 앱을 만들 때 참고할 개발 노트만 남겼습니다.

- 성경 부루마블: `bible-marble/README.md`
- 난장이의 피아노 교실: `piano/README.md`

## DICEBOUND 운명의 주사위 (`dicebound/`)

주사위 5개를 굴리고 일부를 다시 굴려 족보를 완성하는 다크 판타지 로그라이크입니다. 자세한 규칙과 파일 구조, 점검 방법은 [`dicebound/README.md`](dicebound/README.md)에 있습니다.

## 다과비 계산기 (`snack-calc/`)

다과비처럼 정해진 예산 안에서 마트 간식을 고를 때 쓰는 휴대폰용 계산기입니다.
- 가격·개수(이름은 선택)를 넣으면 위쪽 목록에 쌓이고, 남은 금액과 예산 초과 여부를 바로 보여 줍니다.
- 가격을 입력하는 동안 "담으면 남는 잔액"과 "남은 돈으로 최대 몇 개"를 미리 보여 줍니다.
- 목록에서 개수 −/+, 품목을 눌러 수정, 삭제 후 되돌리기, '새로 시작'(두 번 눌러 전체 삭제)을 지원합니다.
- 홈 화면 설치·전체화면·오프라인 실행을 지원하고, 입력 내용은 기기 안(localStorage)에만 저장합니다.
