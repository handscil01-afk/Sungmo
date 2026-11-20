# 3차 녹음을 Gemini API의 음성 만들기(TTS)로 한 줄씩 자동으로 만들어 voice/에 넣음 (ffmpeg, numpy 필요)
# 사용법: GEMINI_API_KEY=키 python3 tools/voice3_gemini.py --caster Puck --analyst Charon [--model 모델] [--only N1,P1]
#   - voice/script3.txt의 줄마다 요청을 하나씩 보냄. 말투는 voice/prompts3_studio/묶음.txt의 Style 칸을 씀
#   - 묶음 하나를 한꺼번에 읽히면 문장 사이 쉬는 길이가 들쭉날쭉해서 자르기가 맞지 않음 → 한 줄에 한 요청
#   - 받은 소리는 voice/raw3/에 wav로 두고, 앞뒤 무음을 자르고 소리 크기를 맞춰 voice/아이디.mp3로 저장, index.json에 더함
#   - 이미 만든 줄은 건너뛰므로, 사용량 한도로 멈추면 나중에 같은 명령을 다시 실행해 이어서 만듦
#   - 글 길이에 비해 너무 길거나 짧은 소리(안내문까지 읽었거나 빠뜨린 경우)는 voice/에 넣지 않고 알려 줌
import sys, os, json, time, base64, wave, argparse, urllib.request, urllib.error, subprocess
import numpy as np
here = os.path.dirname(os.path.abspath(__file__)); V = os.path.join(here, '..', 'voice')
P = os.path.join(V, 'prompts3_studio'); RAW = os.path.join(V, 'raw3')
ap = argparse.ArgumentParser()
ap.add_argument('--caster', required=True, help='캐스터 이하늘 목소리 이름 (예: Puck)')
ap.add_argument('--analyst', required=True, help='해설위원 강태산 목소리 이름 (예: Charon)')
ap.add_argument('--model', default='gemini-3.8-flash-tts', help='무료 사용량은 모델마다 따로 셈 (2026-11 기준 하루 10번)')
ap.add_argument('--only', default='', help='만들 묶음만 쉼표로 (예: N1,P1)')
ap.add_argument('--wait', type=float, default=21, help='요청 사이 기다리는 초')
ap.add_argument('--redo', default='', help='다시 만들 아이디를 쉼표로 (raw3의 wav를 지우고 새로 만듦)')
a = ap.parse_args()
key = os.environ.get('GEMINI_API_KEY', 'proxy')

def bundle(code):
    head = open(os.path.join(P, code + '.txt'), encoding='utf-8').read().partition('본문 칸')[0].splitlines()
    style = next(l for l in head if l.startswith('Style 칸:'))[len('Style 칸:'):].strip()
    style = style.replace('문장마다 2초 쉬고 다음 문장을 읽음.', '').strip()
    return ('analyst' if '해설위원' in head[0] else 'caster'), style

def tts(style, text, voice):
    # 한국어로 말투만 적으면 모델이 해설을 지어내 덧붙임. 영어로 '글자 그대로, 덧붙이지 말 것'을 지시하면 글만 읽음
    prompt = ('Read the following Korean transcript aloud exactly as written, word for word. '
              f'Do not add, remove, or improvise anything.\nVoice and tone: {style}\n\nTranscript:\n{text}')
    req = {'contents': [{'parts': [{'text': prompt}]}],
           'generationConfig': {'responseModalities': ['AUDIO'],
                                'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice}}}}}
    r = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{a.model}:generateContent',
                               data=json.dumps(req).encode(), headers={'Content-Type': 'application/json', 'x-goog-api-key': key})
    with urllib.request.urlopen(r, timeout=300) as res: j = json.load(res)
    part = j['candidates'][0]['content']['parts'][0]['inlineData']; rate = 24000
    for x in part.get('mimeType', '').split(';'):
        if x.strip().startswith('rate='): rate = int(x.split('=')[1])
    return base64.b64decode(part['data']), rate

def load(f):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(float) / 32768

def finish(i, wav, text):
    """앞뒤 무음을 자르고 소리 크기를 맞춰 mp3로 저장. 길이가 글에 비해 이상하면 저장하지 않고 이유를 돌려줌"""
    x = load(wav); w = 160; e = np.array([np.sqrt((x[k*w:(k+1)*w] ** 2).mean()) for k in range(len(x) // w)])
    on = np.where(e > max(0.004, np.percentile(e, 20) * 4))[0]
    if not len(on): return '소리가 없음'
    s = max(0, on[0] / 100 - 0.06); t = min(len(x) / 16000, (on[-1] + 1) / 100 + 0.3); d = t - s
    n = len(text.replace(' ', ''))
    if d > n * 0.25 + 1.8: return f'글 {n}자에 비해 너무 김({d:.1f}초): 안내문을 읽었을 수 있음'
    if d < n * 0.05: return f'글 {n}자에 비해 너무 짧음({d:.1f}초)'
    y = x[int(s * 16000):int(t * 16000)]; loud = y[np.abs(y) > 0.02]
    rms = np.sqrt((loud ** 2).mean()) if len(loud) else 0.05; db = 20 * np.log10(min(0.16 / rms, 0.89 / (np.abs(y).max() or 1)))
    out = os.path.join(V, i + '.mp3'); os.makedirs(os.path.dirname(out), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-af', f'atrim=start={s:.3f}:end={t:.3f},asetpts=PTS-STARTPTS,volume={db:.2f}dB,'
                    f'afade=t=in:d=0.02,afade=t=out:st={max(0, d - 0.1):.3f}:d=0.1', '-ar', '44100', '-ac', '1', '-b:a', '64k', out], check=True)
    return None

def save_index(done):
    idx = json.load(open(os.path.join(V, 'index.json')))
    var, sty = {}, {}
    def count(m, into):
        base, _, k = m.rpartition('-') if m.rpartition('-')[2].isdigit() else (m, '', '1')
        into[base] = max(into.get(base, 0), int(k))
    plain = list(idx['made']); hype = []
    for k, v in idx.get('styles', {}).get('hype', {}).items(): hype += [f'hype/{k}' if n == 1 else f'hype/{k}-{n}' for n in range(1, v + 1)]
    for m in done:
        if m.startswith('hype/'):
            if m not in hype: hype.append(m)
        elif m not in plain: plain.append(m)
    for m in plain: count(m, var)
    for m in hype: count(m[5:], sty.setdefault('hype', {}))
    out = dict(idx); out['made'] = plain; out['variants'] = var
    if sty: out['styles'] = {**idx.get('styles', {}), 'hype': sty['hype']}
    json.dump(out, open(os.path.join(V, 'index.json'), 'w'), ensure_ascii=False)

rows = [l.rstrip('\n').split('\t') for l in open(os.path.join(V, 'script3.txt'), encoding='utf-8')]
if a.only: rows = [r for r in rows if r[1] in a.only.split(',')]
redo = set(x for x in a.redo.split(',') if x)
os.makedirs(RAW, exist_ok=True)
done, bad, first = [], [], True
try:
    for n, code, i, text in rows:
        wav = os.path.join(RAW, i.replace('/', '__') + '.wav')
        if i in redo and os.path.exists(wav): os.remove(wav)
        if not os.path.exists(wav):
            who, style = bundle(code)
            if not first: time.sleep(a.wait)
            first = False
            for tries in range(4):
                try: pcm, rate = tts(style, text, a.caster if who == 'caster' else a.analyst); break
                except urllib.error.HTTPError as e:
                    full = e.read().decode('utf-8', 'replace'); msg = full[:400]
                    # 하루 한도(quotaId에 PerDay)는 기다려도 풀리지 않으므로 바로 멈춤. 1분 한도는 60초 기다렸다 다시 시도
                    if e.code == 429 and ('perday' in full.lower() or tries == 3):
                        print(f'{i}: 사용량 한도에 걸림. 나중에 같은 명령을 다시 실행하면 여기서부터 이어서 만듭니다.\n{msg}'); raise SystemExit(2)
                    if e.code in (429, 500, 503): print(f'{i}: {e.code}, 60초 뒤 다시 시도'); time.sleep(60); continue
                    print(f'{i}: 실패 {e.code} {msg}'); raise SystemExit(1)
                except (KeyError, IndexError):
                    print(f'{i}: 소리 없이 응답함, 다시 시도'); time.sleep(5)
            else: print(f'{i}: 네 번 실패'); raise SystemExit(1)
            with wave.open(wav, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm)
        why = finish(i, wav, text)
        if why: bad.append(f'{i} ({code}): {why}'); print(f'{i}: 넣지 않음, {why}')
        else: done.append(i); print(f'{i}: 만듦')
finally:
    if done: save_index(done)
    print(f'\n넣은 줄 {len(done)}개, 문제 있는 줄 {len(bad)}개')
    for b in bad: print('  ' + b)
    if bad: print('문제 있는 줄은 --redo 아이디,아이디 로 다시 만들 수 있습니다.')
