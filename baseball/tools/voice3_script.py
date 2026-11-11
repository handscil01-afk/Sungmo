# 중계 음성 3차 녹음 대본 (Phase 6에서 코드가 이미 읽도록 해 둔 새 줄 + '신나게' 말투 한 벌).
# 쓰는 법: python3 tools/voice3_script.py
#   → voice/script3.txt (번호·묶음·아이디·문장), voice/prompts3_studio/<묶음>.txt (AI Studio에 붙여 넣을 것),
#     docs/VOICE-SCRIPT-STUDIO.md (전체를 한 파일로)
# 자르는 법: python3 tools/voice3_cut.py N1=경로.wav P1=경로.wav ...  (묶음 이름=그 묶음을 녹음한 파일)
import os, re
here = os.path.dirname(os.path.abspath(__file__)); V = os.path.join(here, '..', 'voice'); D = os.path.join(here, '..', 'docs')
CASTER, ANALYST = '이하늘', '강태산'
POS = [('P', '투수'), ('C', '포수'), ('1B', '1루수'), ('2B', '2루수'), ('3B', '3루수'), ('SS', '유격수'), ('LF', '좌익수'), ('CF', '중견수'), ('RF', '우익수')]
# (묶음, 화자 C/A, 말투, [(아이디, 문장)], 설명)
B = [
 ('N1', 'A', '차분하고 안정적인 해설위원 목소리. 이닝이 깔끔하게 끝났을 때의 평가', [
  ('a_inn_k', '삼진 세 개로 이닝을 끝냅니다!'),
  ('a_inn_k-2', '세 타자를 모두 삼진으로 잡았습니다. 대단한 이닝이었어요.'),
  ('a_inn_dp', '병살로 불을 끕니다.'),
  ('a_inn_dp-2', '병살타로 위기를 벗어나네요. 투수에게 큰 도움이 됩니다.'),
  ('a_inn_escape', '위기를 잘 넘깁니다.'),
  ('a_inn_escape-2', '주자가 나갔지만 실점 없이 막아 냅니다. 집중력이 좋았어요.'),
 ], '이닝 끝 해설 (무실점)'),
 ('N2', 'A', '아쉬워하는 해설위원 목소리, 낮고 차분하게. 이닝이 아쉽게 끝났을 때의 평가', [
  ('a_inn_lob', '아쉽습니다, 주자를 세 명이나 남겼습니다.'),
  ('a_inn_lob-2', '득점권에서 한 방이 아쉬운 이닝이었습니다.'),
  ('a_inn_run1', '한 점을 내주고 이닝을 마칩니다.'),
  ('a_inn_run1-2', '한 점으로 막은 게 그나마 다행입니다.'),
  ('a_inn_runs', '두 점을 내주고 이닝을 마칩니다.'),
  ('a_inn_runs-2', '두 점이 나왔네요. 흐름이 조금 넘어갔습니다.'),
  ('a_inn_big', '크게 무너진 이닝이었습니다.'),
  ('a_inn_big-2', '대량 실점입니다. 투수 교체도 고민해야 할 상황이에요.'),
 ], '이닝 끝 해설 (실점)'),
 ('P1', 'C', '담담하고 또렷한 스포츠 캐스터 목소리. 땅볼이나 뜬공을 잡은 야수를 알리는 말', [(f'pos_{k}_c', f'{n}가 잡았습니다.') for k, n in POS], '누가 잡았는지'),
 ('P2', 'C', '긴장감이 있고 빠른 스포츠 캐스터 목소리. 타구가 어느 야수 쪽으로 가는지 알리는 짧은 말. 문장 끝을 올리지 말고 단호하게', [(f'pos_{k}_to', f'{n} 앞으로!') for k, n in POS], '타구가 가는 곳 (앞으로)'),
 ('P3', 'C', '긴장감이 있고 빠른 스포츠 캐스터 목소리. 타구가 어느 야수 쪽으로 가는지 알리는 짧은 말. 문장 끝을 올리지 말고 단호하게', [(f'pos_{k}_at', f'{n} 쪽으로!') for k, n in POS], '타구가 가는 곳 (쪽으로)'),
 ('T1', 'C', '긴장감이 있는 스포츠 캐스터 목소리. 야수가 공을 던지는 순간을 알리는 짧은 말', [
  ('thr_0', '1루로 송구합니다!'), ('thr_1', '2루로 송구합니다!'), ('thr_2', '3루로 송구합니다!'), ('thr_3', '홈으로 송구합니다!'),
  ('thr_none', '던지지 않습니다.'), ('thr_ask', '송구 선택!'),
 ], '송구'),
 ('R1', 'C', '긴장하고 들뜬 스포츠 캐스터 목소리. 작전이 나왔을 때 짧게 외치는 말', [('c_hitrun1', '히트 앤드 런!'), ('c_hitrun1-2', '작전이 걸렸습니다! 히트 앤드 런!'), ('c_hitrun2', '주자 스타트!'), ('c_hitrun2-2', '1루 주자가 뜁니다!')], '히트 앤드 런 (캐스터)'),
 ('R2', 'A', '관심을 가지고 보는 해설위원 목소리, 차분하게', [('a_hitrun1', '작전이 나왔네요.'), ('a_hitrun1-2', '벤치에서 승부를 거네요.'), ('a_hitrun2', '맞히면 한 베이스 더 갈 수 있습니다.'), ('a_hitrun2-2', '헛스윙이면 주자가 위험해집니다.')], '히트 앤드 런 (해설)'),
]
# ---- '신나게' 말투: 이미 있는 해설(a_)·결과(r_) 줄을 같은 문장으로 더 들뜬 말투로 한 벌 더 (선택 사항) ----
t = open(os.path.join(here, 'voice2_script.py'), encoding='utf8').read()
ns = {}; exec(t[:t.index('HEAD = """')], ns)
text = {}
for c, w, tn, l in ns['B']:
    for i, x in l:
        if i.startswith(('a_', 'r_')): text[i] = x
for l in open(os.path.join(V, 'script.txt'), encoding='utf8'):
    p = l.rstrip('\n').split('\t')
    if len(p) == 3 and p[1].startswith(('r_', 'a_')) and p[1] not in text: text[p[1]] = re.sub(r'^\([^)]*\)\s*', '', p[2])
HYPE = [('A', sorted(i for i in text if i.startswith('a_')), '신이 나서 들뜬 해설위원 목소리, 에너지가 넘치고 말이 조금 빠르게. 같은 문장을 평소보다 훨씬 감정을 실어서'),
        ('R', sorted(i for i in text if i.startswith('r_')), '아주 신이 난 스포츠 캐스터 목소리, 에너지가 넘치고 힘차게. 같은 문장을 평소보다 훨씬 감정을 실어서')]
for kind, ids, tone in HYPE:
    for n in range(0, len(ids), 20):
        chunk = ids[n:n + 20]
        B.append((f'H{kind}{n // 20 + 1}', 'A' if kind == 'A' else 'C', tone, [(f'hype/{i}', text[i]) for i in chunk], f'신나게 말투 ({"해설" if kind == "A" else "결과"}) {n + 1}~{n + len(chunk)}번째'))

WHO = { 'C': f'캐스터 {CASTER} (1차·2차 녹음과 같은 목소리, 같은 Voice)', 'A': f'해설위원 {ANALYST} (캐스터와 다른 목소리: 차분한 40대 남성, 이전 해설 녹음과 같은 Voice)' }
STYLE = { 'C': '한국어 스포츠 중계 캐스터. ', 'A': '한국어 야구 해설위원, 차분한 40대 남성. ' }
os.makedirs(os.path.join(V, 'prompts3_studio'), exist_ok=True)
rows = []
for code, who, tone, lines, desc in B:
    with open(os.path.join(V, 'prompts3_studio', f'{code}.txt'), 'w', encoding='utf8') as f:
        f.write(f'[{code}] Speaker: {WHO[who]}\nStyle 칸: {STYLE[who]}{tone}. 문장마다 2초 쉬고 다음 문장을 읽음.\n본문 칸 (아래를 그대로 붙여 넣기):\n\n')
        for _, x in lines: f.write(x + '\n\n')
    rows += [(code, i, x) for i, x in lines]
with open(os.path.join(V, 'script3.txt'), 'w', encoding='utf8') as f:
    for n, (code, i, x) in enumerate(rows, 1): f.write(f'{n:03d}\t{code}\t{i}\t{x}\n')
# 한 파일로 정리한 대본
with open(os.path.join(D, 'VOICE-SCRIPT-STUDIO.md'), 'w', encoding='utf8') as f:
    f.write('# 새 녹음 대본 전체 (AI Studio 음성 만들기용)\n\n')
    f.write('이 파일을 위에서부터 묶음 하나씩 AI Studio에 붙여 넣어 녹음 파일을 만듭니다. 자세한 순서는 맨 아래 "하는 순서"를 보세요.\n\n')
    f.write(f'- **묶음 이름**(N1, P1 …)은 나중에 녹음 파일을 자를 때 씁니다.\n- 한 묶음은 **같은 목소리 하나**로 읽어야 합니다. 캐스터(C) 묶음은 캐스터 {CASTER}, 해설(A) 묶음은 해설위원 {ANALYST}의 목소리(이전에 쓴 것과 같은 Voice)를 고르세요.\n')
    f.write(f'- 줄 수: 기본 {sum(len(l) for c, w, tn, l, d in B if not c.startswith("H"))}줄(필수), 신나게 말투 {sum(len(l) for c, w, tn, l, d in B if c.startswith("H"))}줄(선택).\n\n')
    f.write('| 묶음 | 화자 | 줄 수 | 내용 |\n|---|---|---|---|\n')
    for code, who, tone, lines, desc in B: f.write(f'| {code} | {"캐스터" if who == "C" else "해설"} | {len(lines)} | {desc} |\n')
    f.write('\n---\n\n## 1. 필수 녹음 (N1~R2)\n\n')
    for code, who, tone, lines, desc in B:
        if code == 'HA1': f.write('\n---\n\n## 2. 선택: 신나게 말투 (HA·HR 묶음)\n\n이미 있는 해설·결과 줄을 같은 문장으로 더 들뜨게 읽은 한 벌입니다. 없어도 게임은 지금처럼 동작합니다. 설정에 "해설 스타일: 신나게"가 나타납니다.\n\n')
        f.write(f'### {code} · {desc}\n\n- **Speaker/Voice**: {WHO[who]}\n- **Style 칸**: {STYLE[who]}{tone}. 문장마다 2초 쉬고 다음 문장을 읽음.\n- **본문 칸** (아래 줄을 그대로 붙여 넣기, 줄 사이는 빈 줄):\n\n```\n')
        f.write('\n\n'.join(x for _, x in lines) + '\n```\n\n')
        f.write('아이디 순서: ' + ', '.join(f'`{i}`' for i, _ in lines) + '\n\n')
    f.write("""---

## 하는 순서

1. AI Studio(Gemini 음성 만들기)에서 위 묶음 하나를 엽니다. Style 칸에 "Style 칸" 내용을, 본문 칸에 코드 상자 안의 글을 붙여 넣고, Voice는 표시된 화자와 같은 것을 고릅니다.
2. 만든 소리를 파일(wav 또는 mp3)로 저장합니다. 묶음 하나가 파일 하나입니다. 문장 사이에 2초 정도 쉬는 소리가 들어 있어야 자를 수 있습니다.
3. 저장소에서 아래 명령으로 문장마다 자릅니다(묶음 이름=파일 경로를 여러 개 한꺼번에 적을 수 있음). 자르면 `voice/` 폴더에 mp3가 만들어지고 `voice/index.json`에 자동으로 적힙니다. `hype/`로 시작하는 줄은 `voice/hype/`에 들어갑니다.
   ```
   python3 tools/voice3_cut.py N1=N1.wav N2=N2.wav P1=P1.wav
   ```
4. 문장 수와 잘린 조각 수가 다르면 그 묶음은 건너뛰고 이유를 알려 줍니다(문장을 빠뜨렸거나 두 번 읽은 경우). 그 묶음만 다시 만들면 됩니다.
5. `voice/check.html`을 열어 소리가 맞는지 듣습니다. 올린 뒤에는 앱을 새로 고침하면 새 소리가 나옵니다.

## 코드에 이미 연결된 것과 아닌 것
- 연결됨: `a_inn_*`(이닝 끝), `pos_*_c`(누가 잡았는지), `thr_0~3`(송구), `pos_*_to`와 `pos_*_at`(타구 방향), `thr_ask`와 `thr_none`, `c_hitrun*`와 `a_hitrun*`, 신나게 말투(`hype/`).
- 녹음 파일이 없는 줄은 그냥 건너뛰므로 일부만 먼저 만들어도 됩니다.
""")
print(len(B), '묶음', len(rows), '줄')
