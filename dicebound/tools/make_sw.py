"""sw.js 의 캐시 목록을 현재 파일 기준으로 다시 만든다. 사용법: python3 dicebound/tools/make_sw.py <버전>"""
import os, sys, glob
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ver = sys.argv[1]
files = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png']
files += ['./css/' + os.path.basename(f) for f in sorted(glob.glob(os.path.join(here, 'css', '*.css')))]
files += ['./js/' + os.path.basename(f) for f in sorted(glob.glob(os.path.join(here, 'js', '*.js')))]
files += ['./' + os.path.relpath(f, here).replace(os.sep, '/') for f in sorted(glob.glob(os.path.join(here, 'assets', '*', '*')))]
body = open(os.path.join(here, 'tools', 'sw.template.js'), encoding='utf-8').read()
body = body.replace('__VERSION__', ver).replace('__FILES__', ',\n  '.join("'%s'" % f for f in files))
open(os.path.join(here, 'sw.js'), 'w', encoding='utf-8').write(body)
print(len(files), 'files')
