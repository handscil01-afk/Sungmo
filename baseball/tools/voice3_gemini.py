# 3차 녹음을 Gemini API의 음성 만들기(TTS)로 자동으로 만듦. 파이썬 기본 기능만 씀(따로 설치할 것 없음)
# 사용법: GEMINI_API_KEY=키 python3 tools/voice3_gemini.py --caster 목소리이름 --analyst 목소리이름 [--model 모델] [--only N1,P1] [--cut]
#   - voice/prompts3_studio/의 묶음 파일(N1.txt 등)을 하나씩 읽어 Style 칸과 본문 칸을 보내고, voice/raw3/묶음.wav로 저장함
#   - 이미 만든 wav는 건너뛰므로, 하루 사용량이 끝나 멈추면 다음 날 같은 명령을 다시 실행하면 이어서 만듦
#   - --cut을 붙이면 다 만든 뒤 tools/voice3_cut.py로 문장마다 잘라 voice/에 넣음
import sys, os, json, time, base64, wave, argparse, urllib.request, urllib.error, subprocess
here = os.path.dirname(os.path.abspath(__file__)); V = os.path.join(here, '..', 'voice')
P = os.path.join(V, 'prompts3_studio'); OUT = os.path.join(V, 'raw3')
ap = argparse.ArgumentParser()
ap.add_argument('--caster', required=True, help='캐스터 이하늘 목소리 이름 (예: Puck)')
ap.add_argument('--analyst', required=True, help='해설위원 강태산 목소리 이름 (예: Charon)')
ap.add_argument('--model', default='gemini-2.5-flash-preview-tts')
ap.add_argument('--only', default='', help='만들 묶음만 쉼표로 (예: N1,P1)')
ap.add_argument('--wait', type=float, default=21, help='요청 사이 기다리는 초 (무료 사용량은 1분에 약 3번)')
ap.add_argument('--cut', action='store_true')
a = ap.parse_args()
key = os.environ.get('GEMINI_API_KEY', 'proxy')  # 키를 네트워크 쪽에서 붙여 주는 환경이면 아무 값이나 됨

def parse(path):
    t = open(path, encoding='utf-8').read()
    head, _, body = t.partition('본문 칸 (아래를 그대로 붙여 넣기):')
    style = next(l for l in head.splitlines() if l.startswith('Style 칸:'))[len('Style 칸:'):].strip()
    who = 'analyst' if '해설위원' in head.splitlines()[0] else 'caster'
    return who, style, body.strip()

def tts(style, body, voice):
    prompt = (f'다음 말투로 아래 문장들을 한국어로 읽어 주세요: {style}\n'
              '이 안내 문장은 읽지 말고, 빈 줄 아래의 문장만 순서대로, 빠뜨리거나 되풀이하지 말고 읽어 주세요. 문장 사이는 2초씩 쉬어 주세요.\n\n' + body)
    req = {'contents': [{'parts': [{'text': prompt}]}],
           'generationConfig': {'responseModalities': ['AUDIO'],
                                'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice}}}}}
    r = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{a.model}:generateContent',
                               data=json.dumps(req).encode(), headers={'Content-Type': 'application/json', 'x-goog-api-key': key})
    with urllib.request.urlopen(r, timeout=600) as res: j = json.load(res)
    part = j['candidates'][0]['content']['parts'][0]['inlineData']
    rate = 24000
    for x in part.get('mimeType', '').split(';'):
        if x.strip().startswith('rate='): rate = int(x.split('=')[1])
    return base64.b64decode(part['data']), rate

os.makedirs(OUT, exist_ok=True)
names = sorted(f[:-4] for f in os.listdir(P) if f.endswith('.txt'))
if a.only: names = [n for n in names if n in a.only.split(',')]
made, first = [], True
for n in names:
    wav = os.path.join(OUT, n + '.wav')
    if os.path.exists(wav): print(f'{n}: 이미 있음, 건너뜀'); made.append(n); continue
    who, style, body = parse(os.path.join(P, n + '.txt'))
    if not first: time.sleep(a.wait)
    first = False
    for tries in range(3):
        try:
            pcm, rate = tts(style, body, a.caster if who == 'caster' else a.analyst); break
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:300]
            if e.code == 429 and ('perday' in msg.lower().replace(' ', '') or tries == 2):
                print(f'{n}: 사용량 한도에 걸림. 내일 같은 명령을 다시 실행하면 여기서부터 이어서 만듭니다.\n{msg}'); sys.exit(2)
            if e.code in (429, 500, 503): print(f'{n}: {e.code}, 60초 뒤 다시 시도'); time.sleep(60); continue
            print(f'{n}: 실패 {e.code} {msg}'); sys.exit(1)
    else:
        print(f'{n}: 세 번 실패'); sys.exit(1)
    with wave.open(wav, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm)
    print(f'{n}: 만듦 ({len(pcm) / 2 / rate:.1f}초)'); made.append(n)
if a.cut and made:
    subprocess.run([sys.executable, os.path.join(here, 'voice3_cut.py')] + [f'{n}={os.path.join(OUT, n + ".wav")}' for n in made])
