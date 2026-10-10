/* 콘텐츠 정의: 족보, 주사위, 유물, 소모품, 적, 이벤트, 업적 (모든 이미지 경로는 여기서만 관리) */
(function (root) {
  'use strict';
  const DB = root.DB = root.DB || {};
  const A = 'assets/';

  DB.IMG = {
    dice: v => `${A}dice/d${v}.webp`,
    logo: A + 'ui/logo.webp',
    bg: {
      menu: A + 'bg/menu.jpg', menuWide: A + 'bg/menu-wide.jpg', battle: A + 'bg/battle.jpg'
    },
    // 지역·실내 배경 (bg2): forest, mushroom, coast, snow, ice-castle, jungle, swamp, crystal-cave, hell,
    // shop-in, tavern, village, alley, spring, throne
    bg2: n => `${A}bg2/${n}.jpg`,
    fx2: n => `${A}fx2/${n}.webp`,
    node: t => `${A}nodes/${t}.webp`,
    icon: n => `${A}icons/${n}.webp`,
    fx: n => `${A}fx/${n}.jpg`,
    emblem: c => `${A}emblems/${c}.webp`,
    ui: n => `${A}ui/${n}`,
    treasure: A + 'ui/treasure-glow.jpg'
  };

  // 주인공: 고르거나 정보를 볼 때는 앞모습(front), 전투에서는 뒷모습(back)
  // perk 는 game.js·rules.js 에서 id 로 처리한다. hurt 가 있으면 체력이 40% 이하일 때 그 모습으로 바뀐다.
  const H = n => ({ front: `${A}heroes/${n}-front.webp`, back: `${A}heroes/${n}-back.webp`, face: `${A}heroes/${n}-face.jpg` });
  DB.HEROES = {
    druid: Object.assign(H('druid'), {
      name: '드루이드', title: '숲의 수호자', hp: 50, die: 'life', fx: 'spore', color: '#59d17f',
      desc: '숲의 정령과 교감하는 치유사. 버섯 지팡이로 상대를 독과 덩굴로 묶는다.',
      perk: '회복 효과 +2, 원 페어 이상으로 공격하면 적에게 출혈 1'
    }),
    archer: Object.assign(H('archer'), {
      name: '궁수', title: '바람의 사냥꾼', hp: 46, die: 'blood', fx: 'arrow', color: '#9fd36a',
      desc: '숲을 누비는 엘프 사냥꾼. 빠른 손놀림으로 주사위를 여러 번 다시 굴린다.',
      perk: '매 턴 재굴림 +1, 적에게 출혈을 줄 때 +2'
    }),
    knight: Object.assign(H('knight'), {
      name: '기사', title: '검은 숲의 검', hp: 56, die: 'steel', fx: 'slash', color: '#9fb0c4',
      desc: '장검과 단검을 쓰는 숲의 기사. 단단한 갑옷으로 전투를 시작한다.',
      perk: '전투 시작 시 방어 8'
    }),
    warrior: Object.assign(H('warrior'), {
      name: '전사', title: '방패의 투사', hp: 60, die: 'flame', fx: 'punch', color: '#e5b94e',
      hurtFront: `${A}heroes/warrior-front-hurt.webp`, hurtBack: `${A}heroes/warrior-back-hurt.webp`,
      desc: '수많은 전장을 버텨 낸 투사. 상처를 입을수록 더 거세게 싸운다.',
      perk: '체력이 절반 이하이면 공격 피해 +5'
    })
  };

  // 상태 효과: 플레이어와 적이 같은 규칙을 쓴다
  DB.STATUS = {
    block: { name: '방어', icon: A + 'icons/block.webp', desc: '받는 피해를 먼저 막아 준다. 자기 차례가 다시 오면 사라진다.' },
    bleed: { name: '출혈', icon: A + 'icons/bleed.webp', desc: '자기 차례가 시작될 때 중첩만큼 피해를 받고, 중첩이 1 줄어든다. 방어를 무시한다.' },
    burn: { name: '화상', icon: A + 'icons/burn.webp', desc: '자기 차례가 시작될 때 피해 3을 받고, 남은 턴이 1 줄어든다. 방어를 무시한다.' },
    freeze: { name: '빙결', icon: A + 'icons/freeze.webp', desc: '공격 피해가 30% 줄어든다. 공격할 때마다 중첩이 1 줄어든다.' },
    str: { name: '힘', icon: A + 'emblems/red.webp', desc: '공격 피해가 중첩만큼 늘어난다. 전투가 끝날 때까지 유지된다.' }
  };

  // 족보: 효과 공식은 rules.js 의 evalHand 와 반드시 같게 유지한다
  DB.HANDS = [
    { id: 'five', name: '파이브 오브 어 카인드', short: '파이브', effect: '공격 (눈 합×2+10) · 방어 10 · 회복 10' },
    { id: 'quad', name: '포카드', short: '포카드', effect: '공격 (네 눈 합×1.5+6) · 빙결 2' },
    { id: 'fullhouse', name: '풀하우스', short: '풀하우스', effect: '공격 (다섯 눈 합+4) · 회복 6' },
    { id: 'straight', name: '스트레이트', short: '스트레이트', effect: '공격 16 (2~6은 18) · 방어 8' },
    { id: 'triple', name: '트리플', short: '트리플', effect: '공격 (세 눈 합+8) · 출혈 2' },
    { id: 'twopair', name: '투 페어', short: '투 페어', effect: '공격 (네 눈 합+2) · 방어 5' },
    { id: 'pair', name: '원 페어', short: '원 페어', effect: '공격 (두 눈 합+4)' },
    { id: 'high', name: '하이 카드', short: '하이 카드', effect: '공격 (가장 높은 눈+2) · 방어 3' }
  ];

  // 특수 주사위: 기본 주사위 하나와 교체한다
  DB.DICE = {
    gold: { name: '황금 주사위', badge: A + 'icons/px-bag.webp', color: '#e5b94e', rarity: 'common', desc: '6이 나오면 골드 +3' },
    curse: { name: '저주 주사위', badge: A + 'bossicons/skull.webp', color: '#b04ad8', rarity: 'rare', desc: '1이 나오면 피해 +9, 자신은 체력 -2' },
    ice: { name: '빙결 주사위', badge: A + 'icons/freeze.webp', color: '#5cc8f0', rarity: 'common', desc: '4 이상이면 적에게 빙결 1' },
    transmute: { name: '변환 주사위', badge: A + 'potions/crystal.webp', color: '#a77bff', rarity: 'rare', desc: '전투마다 한 번, 이 주사위의 눈을 원하는 숫자로 바꾼다' },
    alchemy: { name: '연금 주사위', badge: A + 'potions/green.webp', color: '#59d17f', rarity: 'common', desc: '2 또는 3이면 방어 +3' },
    steel: { name: '강철 주사위', badge: A + 'icons/block.webp', color: '#9fb0c4', rarity: 'common', desc: '트리플 이상 족보에 포함되면 피해 +4' },
    blood: { name: '피의 주사위', badge: A + 'icons/bleed.webp', color: '#e0475b', rarity: 'common', desc: '5 이상이면 적에게 출혈 2' },
    flame: { name: '불꽃 주사위', badge: A + 'icons/burn.webp', color: '#f08a3c', rarity: 'rare', desc: '6이 나오면 적에게 화상 2' },
    life: { name: '생명 주사위', badge: A + 'icons/heal.webp', color: '#ff6f8a', rarity: 'common', desc: '1 또는 2면 체력 2 회복' }
  };

  // 유물: tier 는 common / rare. 효과는 rules.js·game.js 에서 id 로 처리한다
  DB.RELICS = {
    edge: { name: '날 선 화살촉', icon: A + 'relics/arrow.webp', tier: 'common', desc: '모든 공격 피해 +2' },
    guard: { name: '수호자의 사슬갑옷', icon: A + 'relics/chainmail.webp', tier: 'common', desc: '전투 시작 시 방어 6' },
    lucky: { name: '행운의 은반지', icon: A + 'relics/silver-ring.webp', tier: 'common', desc: '전투 시작 시 체력 4 회복' },
    twins: { name: '쌍둥이 반지', icon: A + 'relics/dark-ring.webp', tier: 'common', desc: '원 페어·투 페어 피해 +3' },
    pack: { name: '탐험가의 배낭', icon: A + 'relics/pack.webp', tier: 'common', desc: '전투 승리 골드 +6' },
    leather: { name: '질긴 가죽 갑옷', icon: A + 'relics/leather.webp', tier: 'common', desc: '투 페어일 때 방어 +5' },
    lantern: { name: '영혼의 등불', icon: A + 'relics/lantern.webp', tier: 'common', desc: '야영지 휴식 회복량 +10' },
    torch: { name: '불씨 횃불', icon: A + 'relics/torch.webp', tier: 'common', desc: '스트레이트일 때 적에게 화상 2' },
    amulet: { name: '수호 부적', icon: A + 'relics/amulet.webp', tier: 'common', desc: '내 차례가 시작될 때마다 방어 2' },
    crown: { name: '왕의 왕관', icon: A + 'relics/crown.webp', tier: 'rare', desc: '트리플 이상 족보 피해 +25%' },
    ruby: { name: '도박사의 루비 반지', icon: A + 'relics/ruby-ring.webp', tier: 'rare', desc: '그 턴의 재굴림을 모두 쓰면 피해 +5' },
    greed: { name: '탐욕의 금서', icon: A + 'relics/gold-tome.webp', tier: 'rare', desc: '보유 골드 10마다 피해 +1 (최대 +5)' },
    frost: { name: '서리 병', icon: A + 'relics/blue-vase.webp', tier: 'rare', desc: '적에게 빙결을 줄 때 +1' },
    altar: { name: '피의 제단', icon: A + 'relics/altar.webp', tier: 'rare', desc: '적에게 출혈을 줄 때 +1' },
    life: { name: '생명의 서', icon: A + 'relics/green-book.webp', tier: 'rare', desc: '풀하우스·파이브 오브 어 카인드 회복 +5' },
    scepter: { name: '시간의 홀', icon: A + 'relics/scepter.webp', tier: 'rare', desc: '매 턴 재굴림 +1' },
    echo: { name: '메아리 마도서', icon: A + 'relics/purple-tome.webp', tier: 'rare', desc: '트리플 이상 족보 피해 +5' },
    fate: { name: '운명의 수정', icon: A + 'relics/purple-gem.webp', tier: 'rare', desc: '매 턴 첫 굴림에서 가장 낮은 주사위 +2 (최대 6)' },
    hammer: { name: '사냥꾼의 망치', icon: A + 'relics/hammer.webp', tier: 'rare', desc: '정예·보스에게 주는 피해 +4' },
    wisdom: { name: '지식의 서', icon: A + 'relics/blue-book.webp', tier: 'common', desc: '보상 주사위 선택지 +1' },
    coffer: { name: '상인의 보물함', icon: A + 'relics/chest.webp', tier: 'common', desc: '상점 가격 20% 할인' },
    cursed: { name: '저주받은 상자', icon: A + 'relics/purple-chest.webp', tier: 'rare', desc: '얻을 때 최대 체력 -6. 모든 공격 피해 +4' },
    heart: { name: '깨진 심장', icon: A + 'relics/broken-heart.webp', tier: 'rare', desc: '체력이 절반 이하이면 공격 피해 +5' }
  };

  // 소모품: battle 이 true 면 전투 중에만 쓸 수 있다
  DB.POTIONS = {
    heal: { name: '치유 물약', icon: A + 'potions/red.webp', price: 18, battle: false, desc: '체력 15 회복' },
    ward: { name: '방어 물약', icon: A + 'potions/blue.webp', price: 16, battle: true, desc: '방어 12 획득' },
    cure: { name: '해독제', icon: A + 'potions/green.webp', price: 14, battle: false, desc: '출혈·화상·빙결 제거, 체력 5 회복' },
    reroll: { name: '재굴림 두루마리', icon: A + 'potions/scroll-roll.webp', price: 16, battle: true, desc: '이번 턴 재굴림 +2' },
    fate: { name: '변환의 두루마리', icon: A + 'potions/scroll-open.webp', price: 22, battle: true, desc: '주사위 하나의 눈을 원하는 숫자로 바꾼다' },
    might: { name: '힘의 물약', icon: A + 'potions/vial.webp', price: 20, battle: true, desc: '이번 전투 동안 힘 +3' },
    bomb: { name: '화약 폭탄', icon: A + 'potions/bomb.webp', price: 20, battle: true, desc: '적에게 피해 14 (방어 무시)' },
    frost: { name: '서리 결정', icon: A + 'potions/crystal.webp', price: 16, battle: true, desc: '적에게 빙결 3' }
  };

  // 적 행동: atk(피해), hits(횟수), block, heal, buff(힘), apply(플레이어에게 거는 상태)
  DB.ENEMIES = {
    goblin: {
      name: '고블린', img: A + 'monsters/goblin.jpg', type: 'normal', hp: 22, desc: '가장 기본적인 몬스터. 빠르고 교활하다.',
      moves: [{ name: '단검 찌르기', atk: 6 }, { name: '독 묻은 칼날', atk: 4, apply: { bleed: 2 } }, { name: '난도질', atk: 3, hits: 2 }]
    },
    skeleton: {
      name: '해골 전사', img: A + 'monsters/skeleton.jpg', type: 'normal', hp: 27, desc: '무겁고 강한 공격을 한다.',
      moves: [{ name: '방패 들기', block: 6, atk: 4 }, { name: '무거운 일격', atk: 10 }, { name: '뼈 베기', atk: 6 }]
    },
    mage: {
      name: '어둠 마도사', img: A + 'monsters/mage.jpg', type: 'normal', hp: 19, desc: '원거리 마법 공격을 한다.',
      moves: [{ name: '서리 저주', atk: 3, apply: { freeze: 2 } }, { name: '마력 탄', atk: 9 }, { name: '불꽃 화살', atk: 4, apply: { burn: 2 } }]
    },
    werewolf: {
      name: '늑대인간', img: A + 'monsters/werewolf.jpg', type: 'elite', hp: 48, desc: '빠르고 치명적인 공격을 한다.',
      moves: [{ name: '포효', buff: 2, block: 5 }, { name: '연속 할퀴기', atk: 4, hits: 3 }, { name: '물어뜯기', atk: 8, apply: { bleed: 3 } }]
    },
    golem: {
      name: '바위 골렘', img: A + 'monsters/golem.jpg', type: 'elite', hp: 60, desc: '높은 방어력과 체력을 가졌다.',
      moves: [{ name: '바위 껍질', block: 14 }, { name: '내려찍기', atk: 15 }, { name: '돌 던지기', atk: 9 }]
    },
    necromancer: {
      name: '네크로맨서', img: A + 'bosses/necromancer.jpg', marker: A + 'bossicons/skull.webp', type: 'boss', hp: 200, desc: '죽은 자들을 지배하는 마법사.',
      moves: [{ name: '뼈의 장벽', block: 14, atk: 6 }, { name: '생명 흡수', atk: 11, heal: 10 }, { name: '죽음의 저주', atk: 6, apply: { freeze: 2, bleed: 2 } }, { name: '죽음의 파동', atk: 17 }]
    },
    hellLord: {
      name: '지옥의 군주', img: A + 'bosses/hell-lord.jpg', marker: A + 'bossicons/demon.webp', type: 'boss', hp: 185, desc: '모든 것을 불태우는 존재.',
      moves: [{ name: '지옥불', atk: 8, apply: { burn: 3 } }, { name: '분노', buff: 2, block: 10 }, { name: '파멸의 일격', atk: 20 }, { name: '화염 폭풍', atk: 5, hits: 3 }]
    },
    fallenKnight: {
      name: '타락한 성기사', img: A + 'bosses/fallen-knight.jpg', marker: A + 'bossicons/crystal.webp', type: 'boss', hp: 165, desc: '신성한 힘을 악으로 뒤틀었다.',
      moves: [{ name: '타락한 맹세', block: 15, heal: 10 }, { name: '심판의 연격', atk: 6, hits: 3 }, { name: '붉은 성검', atk: 14, apply: { bleed: 3 } }, { name: '신성 모독', atk: 9, apply: { freeze: 2 } }]
    },
    abyssDragon: {
      name: '심연의 드래곤', img: A + 'bosses/abyss-dragon.jpg', marker: A + 'bossicons/dragon.webp', type: 'boss', hp: 165, desc: '끝없는 욕망의 화신.',
      moves: [{ name: '날개 치기', atk: 10 }, { name: '심연 응축', block: 16, charge: true }, { name: '심연의 숨결', atk: 25, apply: { burn: 2 } }, { name: '꼬리 휩쓸기', atk: 7, apply: { bleed: 2 } }]
    }
  };

  // 전신 스프라이트 몬스터: 행동 묶음(MOVESET)을 정해 두고 몬스터마다 골라 쓴다
  const MOVESET = {
    blade: [{ name: '베기', atk: 7 }, { name: '연속 베기', atk: 4, hits: 2 }, { name: '급소 찌르기', atk: 5, apply: { bleed: 2 } }],
    archer: [{ name: '화살 세례', atk: 3, hits: 3 }, { name: '조준 사격', atk: 10 }, { name: '독화살', atk: 4, apply: { bleed: 2 } }],
    frost: [{ name: '서리 화살', atk: 5, apply: { freeze: 2 } }, { name: '얼음 창', atk: 9 }, { name: '얼음 갑주', block: 8, atk: 3 }],
    fire: [{ name: '불꽃 화살', atk: 4, apply: { burn: 2 } }, { name: '화염 베기', atk: 9 }, { name: '불길 두르기', block: 6, buff: 1 }],
    storm: [{ name: '번개 채찍', atk: 3, hits: 3 }, { name: '낙뢰', atk: 11 }, { name: '폭풍의 눈', block: 7, apply: { freeze: 1 } }],
    tide: [{ name: '물의 창', atk: 8 }, { name: '소용돌이', atk: 4, apply: { freeze: 1, bleed: 1 } }, { name: '파도 장벽', block: 9, heal: 4 }],
    nature: [{ name: '가시 덩굴', atk: 4, apply: { bleed: 2 } }, { name: '포자 구름', atk: 3, apply: { freeze: 1, bleed: 1 } }, { name: '생명의 수액', heal: 8, block: 4 }],
    void: [{ name: '공허의 손길', atk: 5, apply: { freeze: 2 } }, { name: '영혼 흡수', atk: 8, heal: 6 }, { name: '어둠의 파동', atk: 11 }],
    brute: [{ name: '내려찍기', atk: 13 }, { name: '포효', buff: 2, block: 6 }, { name: '휘두르기', atk: 6, hits: 2 }],
    beast: [{ name: '할퀴기', atk: 4, hits: 2 }, { name: '물어뜯기', atk: 7, apply: { bleed: 2 } }, { name: '날개 치기', atk: 9 }],
    holy: [{ name: '심판의 검', atk: 10 }, { name: '빛의 방패', block: 10, heal: 5 }, { name: '천상의 연격', atk: 5, hits: 2 }]
  };
  const M = (name, file, type, hp, set, desc) => ({ name, img: `${A}mobs/${file}.webp`, sprite: true, type, hp, moves: MOVESET[set], desc });
  Object.assign(DB.ENEMIES, {
    elfArcher: M('엘프 저격수', 'elf-archer', 'normal', 22, 'archer', '나무 위에서 화살을 퍼붓는 숲의 저격수.'),
    dryadWitch: M('드라이어드 마녀', 'dryad-witch', 'normal', 24, 'nature', '두 개의 지팡이로 숲의 힘을 끌어 쓴다.'),
    shaman: M('늪지 주술사', 'shaman', 'normal', 23, 'nature', '버섯 지팡이로 저주를 퍼뜨린다.'),
    barbarian: M('야만 전사', 'barbarian', 'elite', 52, 'brute', '가시 곤봉과 방패를 든 거대한 전사.'),
    jungleBlade: M('밀림의 검객', 'jungle-blade', 'normal', 27, 'blade', '톱날 검으로 빠르게 베어 든다.'),
    thunderHuntress: M('천둥 사냥꾼', 'thunder-huntress', 'normal', 26, 'storm', '번개 채찍을 휘두르는 사냥꾼.'),
    sporeMystic: M('포자 무녀', 'spore-mystic', 'normal', 25, 'nature', '독버섯 포자를 흩뿌리는 무녀.'),
    cursedDryad: M('저주받은 드라이어드', 'cursed-dryad', 'normal', 28, 'void', '어둠에 물든 나무의 정령.'),
    leopardSeraph: M('표범 날개 수호자', 'leopard-seraph', 'elite', 58, 'holy', '밀림 사원을 지키는 날개 달린 수호자.'),
    mossReaper: M('이끼 낫잡이', 'moss-reaper', 'elite', 55, 'beast', '네 개의 낫을 쓰는 밀림의 사냥꾼.'),
    orcBrute: M('오크 도끼전사', 'orc-brute', 'elite', 62, 'brute', '거대한 도끼를 휘두르는 오크.'),
    sharkRaider: M('상어 약탈자', 'shark-raider', 'normal', 30, 'blade', '해안을 습격하는 상어 전사.'),
    shellWitch: M('조개 마녀', 'shell-witch', 'normal', 27, 'tide', '조개 지팡이로 파도를 부른다.'),
    tideCaller: M('파도 술사', 'tide-caller', 'normal', 28, 'storm', '번개 사슬로 바다를 다스린다.'),
    pearlMystic: M('진주 무희', 'pearl-mystic', 'normal', 26, 'tide', '보석을 띄워 마력을 모은다.'),
    siren: M('세이렌 예언자', 'siren', 'normal', 29, 'tide', '노랫소리로 선원을 홀린다.'),
    seaWitch: M('심해 마녀', 'sea-witch', 'normal', 31, 'tide', '삼지창을 든 심해의 마녀.'),
    anchorBrute: M('닻 거인', 'anchor-brute', 'elite', 68, 'brute', '거대한 닻을 끌고 다니는 해적 거인.'),
    coralReaper: M('산호 사신', 'coral-reaper', 'elite', 60, 'beast', '산호 갑각을 두른 네 팔의 사냥꾼.'),
    gorgon: M('고르곤 파수꾼', 'gorgon', 'elite', 64, 'blade', '뱀 머리칼을 지닌 방패 전사.'),
    frostKnight: M('서리 기사', 'frost-knight', 'normal', 34, 'frost', '얼음 창과 방패를 든 기사.'),
    stormCaller: M('폭풍 소환사', 'storm-caller', 'normal', 32, 'storm', '번개 사슬을 두른 폭풍의 소환사.'),
    harpyQueen: M('하피 여왕', 'harpy-queen', 'normal', 33, 'beast', '설산 하늘을 지배하는 하피.'),
    valkyrie: M('죽음의 발키리', 'valkyrie', 'normal', 35, 'holy', '전사자의 영혼을 거두는 발키리.'),
    gildedValkyrie: M('황금 발키리', 'gilded-valkyrie', 'elite', 72, 'holy', '불타는 성검을 든 천상의 전사.'),
    seraph: M('세라프', 'seraph', 'elite', 70, 'holy', '심판을 내리는 천사.'),
    voidSorceress: M('공허의 마녀', 'void-sorceress', 'normal', 36, 'void', '블랙홀 지팡이를 든 마녀.'),
    crystalMystic: M('수정 예언자', 'crystal-mystic', 'normal', 34, 'void', '수정에 운명을 비추어 본다.'),
    shadowAssassin: M('그림자 암살자', 'shadow-assassin', 'normal', 33, 'blade', '어둠 속에서 급소를 노린다.'),
    basiliskTamer: M('바실리스크 조련사', 'basilisk-tamer', 'normal', 38, 'beast', '바실리스크를 부리는 뱀 인간.'),
    scorpionBlade: M('전갈 검사', 'scorpion-blade', 'normal', 37, 'beast', '네 개의 낫과 꼬리를 쓰는 전갈 전사.'),
    demonWarrior: M('악마 전사', 'demon-warrior', 'normal', 39, 'fire', '용암 갑옷을 두른 악마.'),
    ashRevenant: M('잿빛 망령', 'ash-revenant', 'normal', 38, 'fire', '불타는 검을 든 망령.'),
    boneKnight: M('해골 기사', 'bone-knight', 'elite', 74, 'blade', '뼈 갑옷을 입은 망자의 기사.'),
    steamGolem: M('증기 골렘', 'steam-golem', 'elite', 82, 'brute', '증기를 뿜는 강철 거인.'),
    driderQueen: M('드라이더 여왕', 'drider-queen', 'elite', 76, 'void', '거미 몸을 가진 동굴의 여왕.'),
    voidHerald: Object.assign(M('공허의 전령', 'void-herald', 'boss', 185, 'void', '여섯 팔로 공허를 부르는 존재.'), {
      marker: A + 'bossicons/beast.webp',
      moves: [{ name: '공허의 문', block: 16, heal: 8 }, { name: '여섯 팔의 연격', atk: 5, hits: 4 }, { name: '시간 정지', atk: 8, apply: { freeze: 3 } }, { name: '공허 폭발', atk: 22 }]
    }),
    succubus: Object.assign(M('서큐버스 여왕', 'succubus', 'boss', 175, 'fire', '지옥 성의 주인인 서큐버스.'), {
      marker: A + 'bossicons/wolf.webp',
      moves: [{ name: '유혹의 속삭임', atk: 6, apply: { freeze: 2 } }, { name: '흡혈', atk: 12, heal: 10 }, { name: '지옥 날개', atk: 6, hits: 3 }, { name: '피의 계약', buff: 3, block: 12 }]
    })
  });

  // 지역별 몬스터 목록 (층 → 지역 → 일반·정예)
  DB.POOLS = {
    forest: { normal: ['goblin', 'skeleton', 'elfArcher', 'dryadWitch', 'shaman'], elite: ['werewolf', 'barbarian'] },
    mushroom: { normal: ['mage', 'jungleBlade', 'thunderHuntress', 'sporeMystic', 'cursedDryad'], elite: ['golem', 'leopardSeraph', 'mossReaper', 'orcBrute'] },
    coast: { normal: ['sharkRaider', 'shellWitch', 'tideCaller', 'pearlMystic', 'siren', 'seaWitch'], elite: ['anchorBrute', 'coralReaper', 'gorgon'] },
    snow: { normal: ['frostKnight', 'stormCaller', 'harpyQueen', 'valkyrie'], elite: ['gildedValkyrie', 'seraph'] },
    cave: { normal: ['voidSorceress', 'crystalMystic', 'shadowAssassin', 'basiliskTamer', 'scorpionBlade', 'demonWarrior', 'ashRevenant'], elite: ['boneKnight', 'steamGolem', 'driderQueen'] }
  };

  DB.NPC = {
    merchant: { name: '떠돌이 상인', img: A + 'chars/merchant.jpg' },
    shopkeeper: { name: '아이템 상인', img: A + 'chars/shopkeeper.jpg' },
    healer: { name: '치유사', img: A + 'chars/healer.jpg' },
    innkeeper: { name: '여관 주인', img: A + 'chars/innkeeper.jpg' },
    librarian: { name: '도서관 관리자', img: A + 'chars/librarian.jpg' },
    questgiver: { name: '퀘스트 의뢰인', img: A + 'chars/questgiver.jpg' },
    mystic: { name: '운명의 점술사', img: A + 'chars/mystic.jpg' },
    villager: { name: '마을 주민', img: A + 'chars/villager.jpg' }
  };

  DB.NODE_TYPES = {
    battle: { name: '일반 전투', desc: '몬스터와 싸우고 보상을 얻는다.' },
    elite: { name: '정예 전투', desc: '강한 적. 유물을 얻을 수 있다.' },
    shop: { name: '상점', desc: '골드로 주사위·유물·소모품을 산다.' },
    treasure: { name: '보물', desc: '보물 상자에서 유물과 골드를 얻는다.' },
    rest: { name: '휴식', desc: '야영지에서 회복하거나 주사위를 단련한다.' },
    event: { name: '이벤트', desc: '누군가를 만난다. 선택에 따라 결과가 달라진다.' },
    mystery: { name: '미지의 노드', desc: '들어가 보기 전에는 무엇이 있는지 알 수 없다.' },
    boss: { name: '보스', desc: '이 땅을 지배하는 최종 보스.' },
    start: { name: '출발 지점', desc: '여정이 시작되는 곳.' }
  };

  // 층별 지역 (맵·전투 배경)
  DB.REGIONS = [
    { from: 0, to: 2, key: 'forest', name: '어둠의 숲', bg: ['forest', 'jungle'] },
    { from: 3, to: 4, key: 'mushroom', name: '버섯 숲', bg: ['mushroom', 'swamp'] },
    { from: 5, to: 6, key: 'coast', name: '폭풍 해안', bg: ['coast'] },
    { from: 7, to: 8, key: 'snow', name: '얼어붙은 설산', bg: ['snow', 'ice-castle'] },
    { from: 9, to: 10, key: 'cave', name: '수정 동굴', bg: ['crystal-cave'] },
    { from: 11, to: 11, key: 'hell', name: '지옥의 성', bg: ['hell'] }
  ];

  DB.ACHIEVEMENTS = {
    firstWin: { name: '첫 승리', desc: '전투에서 처음 승리한다.', emblem: 'blue' },
    straight: { name: '곧은 길', desc: '스트레이트를 완성한다.', emblem: 'blue' },
    elite3: { name: '정예 사냥꾼', desc: '정예 몬스터를 누적 3번 처치한다.', emblem: 'purple' },
    bigHit: { name: '일격 필살', desc: '한 번의 공격으로 40 이상의 피해를 준다.', emblem: 'purple' },
    five: { name: '운명의 다섯', desc: '파이브 오브 어 카인드를 완성한다.', emblem: 'gold' },
    rich: { name: '황금 주머니', desc: '골드를 150 이상 모은다.', emblem: 'gold' },
    collector: { name: '수집가', desc: '한 번의 여정에서 유물을 6개 모은다.', emblem: 'purple' },
    diceMaster: { name: '주사위 장인', desc: '다섯 주사위를 모두 특수 주사위로 채운다.', emblem: 'gold' },
    flawless: { name: '무결점', desc: '피해를 받지 않고 정예 몬스터를 처치한다.', emblem: 'red' },
    clear: { name: '운명의 정복자', desc: '최종 보스를 처치한다.', emblem: 'red' },
    allBosses: { name: '왕관 수집가', desc: '모든 보스를 처치한다.', emblem: 'red' },
    runs10: { name: '끈질긴 여행자', desc: '여정을 10번 시작한다.', emblem: 'blue' }
  };

  DB.CONST = {
    floors: 10,          // 일반 층 수 (보스는 floors + 1 층)
    lanes: 5,
    diceCount: 5,
    rerolls: 2,
    potionSlots: 3,
    startGold: 20
  };
})(typeof window !== 'undefined' ? window : globalThis);
