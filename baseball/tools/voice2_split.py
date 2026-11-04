# 문장 사이를 덜 쉰 녹음 나누기: python3 tools/voice2_split.py 'zip/CODE.wav' spans.json C3 C4 ...
# 작은 무음으로 조각을 나눈 뒤, 문장 수만큼 묶음을 고름 (문장 길이 ≈ 글자 수 × 빠르기, 문장 사이 무음이 길수록 좋음)
import sys,re,json,subprocess,numpy as np
V='/home/user/Sungmo/baseball/voice/'
rows=[l.rstrip('\n').split('\t') for l in open(V+'script2.txt')]
L={}
for n,c,i,t in rows: L.setdefault(c,[]).append((i,t))
def load(f):
    raw=subprocess.run(['ffmpeg','-v','error','-i',f,'-ac','1','-ar','16000','-f','s16le','-'],capture_output=True).stdout
    return np.frombuffer(raw,np.int16).astype(float)/32768
def chunks(a,minsil=0.12):
    w=160;n=len(a)//w;e=np.array([np.sqrt((a[i*w:(i+1)*w]**2).mean()) for i in range(n)])
    th=max(0.004,np.percentile(e,20)*4);on=e>th;out=[];st=None;sil=0
    for i,v in enumerate(on):
        if v:
            if st is None: st=i
            sil=0;end=i
        elif st is not None:
            sil+=1
            if sil>=int(minsil*100): out.append([st/100,(end+1)/100]);st=None
    if st is not None: out.append([st/100,(end+1)/100])
    return [x for x in out if x[1]-x[0]>0.06]
def syl(t): return len(re.findall(r'[가-힣]',re.sub(r'\d','가',t)))
def split(code):
    a=load(sys.argv[1].replace('CODE', code)); C=chunks(a); N=len(L[code])
    gaps=[(C[i+1][0]-C[i][1],i) for i in range(len(C)-1)]
    # DP: N groups of consecutive chunks; cost = duration mismatch + small gaps used as boundaries
    durs=[syl(t) for _,t in L[code]]
    best=None
    for rate in np.arange(0.08,0.26,0.01):
        n=len(C);INF=1e9;D=np.full((n+1,N+1),INF);bp={};D[0,0]=0
        for i in range(n):
            for j in range(N):
                if D[i,j]>=INF: continue
                for k in range(i+1,min(n,i+12)+1):
                    d=C[k-1][1]-C[i][0]; exp=0.15+durs[j]*rate
                    g=C[k][0]-C[k-1][1] if k<n else 2.0
                    inner=max([C[q+1][0]-C[q][1] for q in range(i,k-1)]+[0])
                    c=3*np.log(d/exp)**2+2*max(0,0.6-g)+3*max(0,inner-0.45)
                    if D[i,j]+c<D[k,j+1]: D[k,j+1]=D[i,j]+c; bp[(k,j+1)]=i
        if D[n,N]<INF and (best is None or D[n,N]<best[0]):
            out=[];k=n;j=N
            while j>0: i=bp[(k,j)]; out.append((C[i][0],C[k-1][1])); k=i;j-=1
            best=(D[n,N],out[::-1],rate)
    return best
res={}
for code in sys.argv[3:]:
    cost,out,rate=split(code); res[code]=out
    print(code,'cost',round(cost,1),'rate',round(rate,2))
    for (i,t),(s,e) in zip(L[code],out): print(f'   {i:<14} {e-s:5.2f}s  {t[:28]}')
json.dump(res,open(sys.argv[2],'w'))
