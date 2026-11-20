# 녹음 앱(voice-studio)이 쓰는 대본 파일을 만듦: python3 baseball/tools/voice_studio_lines.py
# 1차(script.txt)·2차(script2.txt)·3차(script3.txt) 대본을 모두 모아, 같은 화자·같은 말투끼리 묶음(최대 20줄)으로 나눔
# 결과: voice-studio/lines.json  { bundles: [{ code, who, style, part, lines:[{id, text}] }] }
import os, re, json
here = os.path.dirname(os.path.abspath(__file__)); V = os.path.join(here, '..', 'voice')
OUT = os.path.join(here, '..', '..', 'voice-studio', 'lines.json')
CASTER = '한국어 야구 캐스터 이하늘, 활기찬 30대 남성. 밝고 또렷한 중계 목소리.'
EMO = {'보통': '평소 중계하듯 자연스럽게.', '또렷하게': '이름과 숫자를 또박또박 또렷하게.', '흥분': '신이 나서 들뜬 목소리로.',
       '긴장': '긴장감 있게, 숨을 죽이듯.', '기대': '기대에 찬 목소리로.', '폭발': '함성처럼 크게 터뜨리듯.',
       '흥분, 점점 커지게': '신이 나서, 점점 목소리를 키우며.', '폭발, 소리 지르듯': '소리 지르듯 크게 터뜨리며.',
       '탄식': '아쉬움에 한숨 섞인 목소리로.', '차분하다가 긴장': '차분하게 시작해서 긴장감 있게.', '차분': '차분하게.',
       '아쉬움, 올라가다 사그라듦': '기대에 올라가다가 아쉽게 사그라들듯.', '놀람': '깜짝 놀란 목소리로.',
       '폭발, 최고조': '최고조로 크게 터뜨리며.', '긴장 최고조': '긴장감이 최고조에 이른 목소리로.'}
# 드문 감정은 가까운 감정으로 합쳐 묶음 수(요청 횟수)를 줄임
MERGE = {'흥분, 점점 커지게': '흥분', '놀람': '흥분', '폭발, 소리 지르듯': '폭발', '폭발, 최고조': '폭발', '긴장 최고조': '긴장',
         '차분하다가 긴장': '긴장', '아쉬움, 올라가다 사그라듦': '탄식', '차분': '보통'}
def style_of(path):
    head = open(path, encoding='utf-8').read().partition('본문 칸')[0].splitlines()
    st = next(l for l in head if l.startswith('Style 칸:'))[len('Style 칸:'):].replace('문장마다 2초 쉬고 다음 문장을 읽음.', '').strip()
    return ('analyst' if '해설' in head[0].split(':', 1)[1][:8] else 'caster'), st
groups = {}  # (who, style, part) -> lines
def add(who, style, part, i, text): groups.setdefault((who, style, part), []).append({'id': i, 'text': text})
for n, i, t in (l.rstrip('\n').split('\t') for l in open(os.path.join(V, 'script.txt'), encoding='utf-8')):
    m = re.match(r'\(([^)]*)\)\s*(.*)', t); emo, text = (m.group(1), m.group(2)) if m else ('보통', t)
    emo = MERGE.get(emo, emo); add('caster', CASTER + ' ' + EMO.get(emo, emo), 1, i, text)
for f, part in (('script2.txt', 2), ('script3.txt', 3)):
    pdir = 'prompts2_studio' if part == 2 else 'prompts3_studio'
    for n, code, i, t in (l.rstrip('\n').split('\t') for l in open(os.path.join(V, f), encoding='utf-8')):
        who, st = style_of(os.path.join(V, pdir, code + '.txt'))
        add(who, st, part, i, t)
bundles = []
for (who, style, part), L in groups.items():
    k = (len(L) + 19) // 20; size = -(-len(L) // k)
    for j in range(k):
        bundles.append({'who': who, 'style': style, 'part': part, 'lines': L[j * size:(j + 1) * size]})
for n, b in enumerate(bundles): b['code'] = f'{"CA"[b["who"] == "analyst"]}{b["part"]}-{n + 1:02d}'
json.dump({'bundles': bundles}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(len(bundles), '묶음,', sum(len(b['lines']) for b in bundles), '줄 →', OUT)
for b in bundles: print(b['code'], len(b['lines']), b['style'][:40])
