# 2차 녹음 자르기: python3 tools/voice2_cut.py C1=경로.wav A3=경로.wav ...
# 묶음마다 문장 사이 2초 무음이라 0.7초 넘는 무음으로 나눔. 조각 수가 문장 수와 같을 때만 자르고, 다르면 조각 길이를 보여 주고 건너뜀
# (같은 문장 두 번, 감정 표시를 읽음, 문장 빠뜨림 → 사람이 듣고 정함). 자른 뒤 소리 크기·경계를 검사하고 index.json에 더함
import sys, os, json, subprocess, numpy as np
here = os.path.dirname(os.path.abspath(__file__)); V = os.path.join(here, '..', 'voice')
rows = [l.rstrip('\n').split('\t') for l in open(os.path.join(V, 'script2.txt'))]
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
idx = json.load(open(os.path.join(V, 'index.json')))
made, report = list(idx['made']), []
for arg in sys.argv[1:]:
    code, f = arg.split('=', 1); L = lines[code]; a = load(f); S = segs(a, 0.7)
    if len(S) != len(L):
        report.append(f'{code}: 조각 {len(S)}개, 문장 {len(L)}개 → 건너뜀. 길이 {[round(e - s, 2) for s, e in S]}'); continue
    for k, ((i, t), (s, e)) in enumerate(zip(L, S)):
        prevE = S[k - 1][1] if k else 0; nextS = S[k + 1][0] if k + 1 < len(S) else len(a) / 16000
        ss = max(prevE + 0.03, s - 0.06); ee = min(nextS - 0.04, e + 0.3); x = a[int(ss * 16000):int(ee * 16000)]
        loud = x[np.abs(x) > 0.02]; rms = np.sqrt((loud ** 2).mean()) if len(loud) else 0.05; peak = np.abs(x).max() or 1
        db = 20 * np.log10(min(0.16 / rms, 0.89 / peak)); dd = ee - ss
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f, '-af', f'atrim=start={ss:.3f}:end={ee:.3f},asetpts=PTS-STARTPTS,volume={db:.2f}dB,afade=t=in:d=0.02,afade=t=out:st={max(0, dd - 0.1):.3f}:d=0.1',
                        '-ar', '44100', '-ac', '1', '-b:a', '64k', os.path.join(V, i + '.mp3')], check=True)
        y = load(os.path.join(V, i + '.mp3'))
        if np.abs(y).max() < 0.2: report.append(f'{code} {i}: 소리가 너무 작음')
        if i not in made: made.append(i)
    report.append(f'{code}: {len(L)}개 자름')
var = {}
for m in made:
    base, _, k = m.rpartition('-') if m.rpartition('-')[2].isdigit() else (m, '', '1')
    var[base] = max(var.get(base, 0), int(k))
json.dump({ 'made': made, 'variants': var }, open(os.path.join(V, 'index.json'), 'w'), ensure_ascii=False)
print('\n'.join(report))
