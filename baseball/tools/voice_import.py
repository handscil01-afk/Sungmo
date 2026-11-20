# 녹음실 앱(voice-studio)에서 받은 zip을 야구 앱 중계 음성으로 넣음 (ffmpeg, numpy 필요)
# 사용법: python3 baseball/tools/voice_import.py 받은파일.zip [--dry]
#   - zip 안의 아이디.wav를 앞뒤 무음 정리·소리 크기 맞춤 후 baseball/voice/아이디.mp3로 저장 (같은 아이디는 새 녹음으로 바꿈)
#   - voice/index.json(made, variants, styles)에 더하고, sw.js 캐시 이름의 번호를 올려 앱이 새 소리를 받게 함
#   - --dry: 파일은 쓰지 않고 무엇이 들어갈지만 보여 줌
import sys, os, re, io, json, zipfile, subprocess, tempfile
import numpy as np
here = os.path.dirname(os.path.abspath(__file__)); B = os.path.join(here, '..'); V = os.path.join(B, 'voice')
args = [a for a in sys.argv[1:] if not a.startswith('--')]; dry = '--dry' in sys.argv
if not args: print(__doc__ or '사용법: python3 baseball/tools/voice_import.py 받은파일.zip'); sys.exit(1)
z = zipfile.ZipFile(args[0]); info = json.loads(z.read('manifest.json'))
ids = [l['id'] for l in info['lines']]
known = set()
for f in ('script.txt', 'script2.txt', 'script3.txt'):
    for l in open(os.path.join(V, f), encoding='utf-8'):
        p = l.rstrip('\n').split('\t'); known.add(p[1] if f == 'script.txt' else p[2])
bad = [i for i in ids if i not in known or not re.fullmatch(r'(hype/)?[A-Za-z0-9_]+(-\d+)?', i)]
if bad: print('대본에 없는 아이디라 넣지 않음:', bad)
ids = [i for i in ids if i not in bad]

def load(raw):
    with tempfile.NamedTemporaryFile(suffix='.wav') as t:
        t.write(raw); t.flush()
        pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', t.name, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True).stdout
    return np.frombuffer(pcm, np.int16).astype(float) / 32768
report, made_now = [], []
for i in ids:
    raw = z.read(i + '.wav'); x = load(raw)
    w = 160; e = np.array([np.sqrt((x[k*w:(k+1)*w] ** 2).mean()) for k in range(len(x) // w)]) if len(x) >= w else np.zeros(1)
    on = np.where(e > max(0.004, np.percentile(e, 20) * 4))[0]
    if not len(on): report.append(f'{i}: 소리가 없어 넣지 않음'); continue
    s = max(0, on[0] / 100 - 0.06); t = min(len(x) / 16000, (on[-1] + 1) / 100 + 0.3); d = t - s
    y = x[int(s * 16000):int(t * 16000)]; loud = y[np.abs(y) > 0.02]
    rms = np.sqrt((loud ** 2).mean()) if len(loud) else 0.05; db = 20 * np.log10(min(0.16 / rms, 0.89 / (np.abs(y).max() or 1)))
    if dry: made_now.append(i); continue
    out = os.path.join(V, i + '.mp3'); os.makedirs(os.path.dirname(out), exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.wav') as tf:
        tf.write(raw); tf.flush()
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tf.name, '-af', f'atrim=start={s:.3f}:end={t:.3f},asetpts=PTS-STARTPTS,volume={db:.2f}dB,'
                        f'afade=t=in:d=0.02,afade=t=out:st={max(0, d - 0.1):.3f}:d=0.1', '-ar', '44100', '-ac', '1', '-b:a', '64k', out], check=True)
    made_now.append(i)
warn = [l['id'] for l in info['lines'] if l.get('warn') and l['id'] in made_now]
print(f'넣은 줄 {len(made_now)}개' + (' (시험 실행이라 쓰지 않음)' if dry else ''))
if warn: print(f'녹음실에서 "확인 필요"였던 줄 {len(warn)}개:', ', '.join(warn[:30]) + (' …' if len(warn) > 30 else ''))
for r in report: print(r)
if dry or not made_now: sys.exit(0)

idx = json.load(open(os.path.join(V, 'index.json')))
plain = list(idx.get('made', [])); hype = []
for k, v in idx.get('styles', {}).get('hype', {}).items(): hype += [f'hype/{k}' if n == 1 else f'hype/{k}-{n}' for n in range(1, v + 1)]
for m in made_now:
    if m.startswith('hype/'):
        if m not in hype: hype.append(m)
    elif m not in plain: plain.append(m)
def count(lst, cut=0):
    out = {}
    for m in lst:
        m = m[cut:]; base, _, k = m.rpartition('-') if m.rpartition('-')[2].isdigit() else (m, '', '1')
        out[base] = max(out.get(base, 0), int(k))
    return out
idx['made'] = plain; idx['variants'] = count(plain)
if hype: idx.setdefault('styles', {})['hype'] = count(hype, 5)
idx['recorded'] = {'by': 'voice-studio', 'caster': info.get('caster'), 'analyst': info.get('analyst'), 'at': info.get('at')}
json.dump(idx, open(os.path.join(V, 'index.json'), 'w'), ensure_ascii=False)
sw = os.path.join(B, 'sw.js'); s = open(sw, encoding='utf-8').read()
s2 = re.sub(r"(const CACHE = 'baseball-v)(\d+)'", lambda m: f"{m.group(1)}{int(m.group(2)) + 1}'", s, count=1)
open(sw, 'w', encoding='utf-8').write(s2)
print('index.json과 sw.js 캐시 이름을 고쳤습니다:', re.search(r"baseball-v\d+", s2).group(0))
