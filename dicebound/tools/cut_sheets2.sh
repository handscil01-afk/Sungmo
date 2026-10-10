#!/bin/sh
# 두 번째 에셋 묶음(주인공·몬스터·배경·이펙트)을 다시 자른다.
# 사용법: sh dicebound/tools/cut_sheets2.sh <원본 시트 폴더> dicebound/assets
# 원본 폴더에 필요한 파일 이름:
#   pc-druid.png pc-archer.png pc-knight.png pc-knight-alt.png   주인공 앞뒤 (분홍·흰 바탕)
#   heroes-a.png heroes-b.png heroes-c.png heroes-d.png          몬스터 7명씩 (분홍 바탕)
#   monsters-magenta.png                                         몬스터 10명 (마젠타 바탕, 이름 글자 포함)
#   bg-regions.png bg-interiors.png                              지역·실내 배경 (액자)
#   fx-pixel.png fx-cards.png                                    이펙트 (남색·마젠타 바탕)
set -e
DIR=$(dirname "$0"); SRC=$1; OUT=$2
python3 "$DIR/cut_heroes.py" "$SRC" "$OUT/heroes"
python3 "$DIR/cut_mobs.py" "$SRC" "$OUT/mobs"
python3 "$DIR/cut_bg2.py" "$SRC" "$OUT/bg2"
python3 "$DIR/cut_fx2.py" "$SRC" "$OUT/fx2"
