# 3차 녹음 자르기: python3 tools/voice3_cut.py N1=경로.wav P1=경로.wav ...  (대본은 tools/voice3_script.py가 만든 voice/script3.txt)
# 2차와 같은 방식이고, 아이디가 hype/로 시작하는 줄은 voice/hype/에 저장하고 index.json의 styles에 적음
# 묶음마다 문장 사이 2초 무음이라 0.7초 넘는 무음으로 나눔. 조각 수가 문장 수와 같을 때만 자르고, 다르면 조각 길이를 보여 주고 건너뜀
# (같은 문장 두 번, 감정 표시를 읽음, 문장 빠뜨림 → 사람이 듣고 정함). 자른 뒤 소리 크기·경계를 검사하고 index.json에 더함
import sys, os, json, subprocess, numpy as np
here = os.path.dirname(os.path.abspath(__file__)); V = os.path.join(here, '..', 'voice')
rows = [l.rstrip('\n').split('\t') for l in open(os.path.join(V, 'script3.txt'))]
lines = {}
for n, code, i, t in rows: lines.setdefault(code, []).append((i, t))
def load(f):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(float) / 32768
def segs(a, minsil):
    w = 160; n = len(a) // w; e = np.array([np.sqrt((a[i*w:(i+1)*w]**2).mean()) for i in range(n)])
    th = max(0.004, np.percentile(e, 20) * 4); on = e > th; out = []; st = None; sil = 0
    for i, v in enumerate(on):
        if v:
            if st is None: st = i
            sil = 0; end = i
        elif st is not None:
            sil += 1
            if sil >= int(minsil * 100): out.append([st / 100, (end + 1) / 100]); st = None
    if st is not None: out.append([st / 100, (end + 1) / 100])
    return [x for x in out if x[1] - x[0] > 0.12]
SPANS = {}
if sys.argv[1].startswith('--spans='): SPANS = json.load(open(sys.argv.pop(1).split('=', 1)[1]))
idx = json.load(open(os.path.join(V, 'index.json')))
made, report = list(idx['made']), []
for arg in sys.argv[1:]:
    code, f = arg.split('=', 1); L = lines[code]; a = load(f); S = segs(a, 0.7)
    # 문장 사이를 덜 쉰 묶음: 따로 맞춘 경계(--spans 파일, 문장 길이·쉬는 길이로 맞춤)가 있으면 그걸 씀
    if SPANS.get(code) and len(SPANS[code]) == len(L): S = SPANS[code]
    if len(S) != len(L):
        report.append(f'{code}: 조각 {len(S)}개, 문장 {len(L)}개 → 건너뜀. 길이 {[round(e - s, 2) for s, e in S]}'); continue
    for k, ((i, t), (s, e)) in enumerate(zip(L, S)):
        prevE = S[k - 1][1] if k else 0; nextS = S[k + 1][0] if k + 1 < len(S) else len(a) / 16000
        ss = max(prevE + 0.03, s - 0.06); ee = min(nextS - 0.04, e + 0.3); x = a[int(ss * 16000):int(ee * 16000)]
        loud = x[np.abs(x) > 0.02]; rms = np.sqrt((loud ** 2).mean()) if len(loud) else 0.05; peak = np.abs(x).max() or 1
        db = 20 * np.log10(min(0.16 / rms, 0.89 / peak)); dd = ee - ss
        os.makedirs(os.path.dirname(os.path.join(V, i + '.mp3')), exist_ok=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f, '-af', f'atrim=start={ss:.3f}:end={ee:.3f},asetpts=PTS-STARTPTS,volume={db:.2f}dB,afade=t=in:d=0.02,afade=t=out:st={max(0, dd - 0.1):.3f}:d=0.1',
                        '-ar', '44100', '-ac', '1', '-b:a', '64k', os.path.join(V, i + '.mp3')], check=True)
        y = load(os.path.join(V, i + '.mp3'))
        if np.abs(y).max() < 0.2: report.append(f'{code} {i}: 소리가 너무 작음')
        if i not in made: made.append(i)
    report.append(f'{code}: {len(L)}개 자름')
var, sty = {}, {}
def count(m, into):
    base, _, k = m.rpartition('-') if m.rpartition('-')[2].isdigit() else (m, '', '1')
    into[base] = max(into.get(base, 0), int(k))
for m in made:
    if m.startswith('hype/'): count(m[5:], sty.setdefault('hype', {}))
    else: count(m, var)
out = dict(idx); out['made'] = [m for m in made if not m.startswith('hype/')]; out['variants'] = var
if sty or idx.get('styles'): out['styles'] = {**idx.get('styles', {}), **{k: {**idx.get('styles', {}).get(k, {}), **v} for k, v in sty.items()}}
json.dump(out, open(os.path.join(V, 'index.json'), 'w'), ensure_ascii=False)
print('\n'.join(report))
