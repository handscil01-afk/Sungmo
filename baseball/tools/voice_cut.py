exec(open('seg.py').read().split('res={}')[0])
import os
S=json.load(open('segs.json'))
OUT='/home/user/Sungmo/baseball/voice/'
rows=[l.rstrip('\n').split('\t') for l in open(OUT+'script.txt')]; ids=[r[1] for r in rows]
def s_(k,i): return tuple(S[k][i])
def span(k,i,j): return (S[k][i][0],S[k][j][1])
M={}
k='2a97f7cd'
M.update({0:(k,s_(k,0)),1:(k,s_(k,1)),2:(k,s_(k,2)),3:(k,(6.37,7.32)),4:(k,(7.87,8.9)),5:(k,(9.44,10.37)),6:(k,s_(k,4)),7:(k,s_(k,5)),8:(k,s_(k,6)),9:(k,s_(k,7)),10:(k,s_(k,8))})
for n,i in zip(range(11,19),range(9,17)): M[n]=(k,s_(k,i))
M.update({19:(k,(27.08,27.6)),20:(k,(28.15,28.66)),22:(k,s_(k,18)),23:(k,s_(k,19))})
k='d20ae73c'
M.update({24:(k,s_(k,0)),25:(k,(1.63,2.09)),26:(k,(2.38,2.9)),27:(k,(3.49,4.53)),28:(k,s_(k,2))})
for n,i in zip(range(29,48),range(3,22)): M[n]=(k,s_(k,i))
k='497c528a'
M.update({48:(k,s_(k,1)),49:(k,s_(k,2))})
for n,i in zip(range(50,59),range(4,13)): M[n]=(k,s_(k,i))
for n,i in zip(range(59,69),range(13,23)): M[n]=(k,s_(k,i))
k='1c0aa2a2'
for n,i in zip(range(69,83),range(0,14)): M[n]=(k,s_(k,i))   # 6회 초 ~ 12회 말 (뒤의 세 조각은 아웃을 한 번 더 읽은 것)
k='b5730e2d'
# 사용자 확인: 이 파일 첫 조각은 '노 아웃' → 아웃 3, 볼 4, 스트라이크 3, 풀카운트, 주자 없습니다
for n,i in zip(range(83,95),range(0,12)): M[n]=(k,s_(k,i))
k='3e9dcf34'
for n,i in zip(range(95,105),[0,1,2,3,4,5,7,9,10,11]): M[n]=(k,s_(k,i))
k='04e158ed'
for n,i in zip(range(105,118),range(0,13)): M[n]=(k,s_(k,i))
k='a47e60ee'
M.update({118:(k,(0.30,1.17)),119:(k,(1.64,2.39))})   # '툭'이 작게 시작해 앞을 넉넉히
for n,i in zip(range(120,128),range(1,9)): M[n]=(k,s_(k,i))
k='6ae599aa'
M.update({128:(k,(0.19,2.02)),129:(k,(2.48,3.34)),130:(k,(3.56,4.3)),131:(k,s_(k,1)),132:(k,s_(k,2)),133:(k,(8.94,9.8)),134:(k,s_(k,4)),135:(k,s_(k,5)),136:(k,s_(k,6)),137:(k,(14.94,15.95)),138:(k,(16.38,18.09)),139:(k,(18.52,19.71)),140:(k,s_(k,8))})
k='9a46786f'
M.update({141:(k,s_(k,0)),142:(k,s_(k,1)),143:(k,(3.21,3.67)),144:(k,(4.09,4.88)),145:(k,s_(k,3)),146:(k,(7.09,8.59)),147:(k,(9.04,9.79)),148:(k,s_(k,5)),149:(k,s_(k,6)),150:(k,(16.86,18.71)),151:(k,(19.12,21.12)),152:(k,(21.69,23.36))})
k='4ac1ac2e'
for n,i in zip(range(153,164),range(0,11)): M[n]=(k,s_(k,i))
k='0056a7e3'
M.update({164:(k,s_(k,0)),165:(k,s_(k,1)),166:(k,s_(k,2)),167:(k,(6.66,7.98)),168:(k,(8.5,10.89)),169:(k,s_(k,4)),170:(k,s_(k,5)),171:(k,s_(k,6)),172:(k,s_(k,7)),173:(k,s_(k,8)),174:(k,span(k,9,10))})
k='44f5d17e'
for n,i in zip(range(175,187),[0,1,2,4,5,6,8,9,10,11,12,13]): M[n]=(k,s_(k,i))
missing=[ids[i] for i in range(len(ids)) if i not in M]; print('missing',missing, len(M))
# 자르기: 앞 0.06초, 뒤는 다음 말소리 직전까지 최대 0.3초
for f in glob.glob(OUT+'*.mp3'): os.remove(f)
cache={}; made=[]
for n,(k,(s,e)) in sorted(M.items()):
    if k not in cache:
        a=load(glob.glob(U+k+'-*.wav')[0]); cache[k]=(a,segs(a,minsil=0.06))
    a,ch=cache[k]
    prevE=max([y for x,y in ch if y<=s+0.01]+[0]); nextS=min([x for x,y in ch if x>=e-0.01]+[len(a)/16000])
    ss=max(prevE+0.03,s-0.06); ee=min(nextS-0.04,e+0.3)
    x=a[int(ss*16000):int(ee*16000)]
    loud=x[np.abs(x)>0.02]; rms=np.sqrt((loud**2).mean()) if len(loud) else 0.05; peak=np.abs(x).max() or 1
    gain=min(0.16/rms,0.89/peak); db=20*np.log10(gain); dd=ee-ss
    f=glob.glob(U+k+'-*.wav')[0]
    subprocess.run(['ffmpeg','-v','error','-y','-i',f,'-ss',f'{ss:.3f}','-t',f'{dd:.3f}','-af',f'volume={db:.2f}dB,afade=t=in:d=0.02,afade=t=out:st={max(0,dd-0.1):.3f}:d=0.1','-ar','44100','-ac','1','-b:a','64k',OUT+ids[n]+'.mp3'],check=True)
    made.append(ids[n])
json.dump({'made':made,'variants':{i:1 for i in made}},open(OUT+'index.json','w'),ensure_ascii=False)
print('clips',len(made))
