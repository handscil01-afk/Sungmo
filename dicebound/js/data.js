/* 콘텐츠 정의: 족보, 주사위, 유물, 소모품, 적, 이벤트, 업적 (모든 이미지 경로는 여기서만 관리) */
(function (root) {
  'use strict';
  const DB = root.DB = root.DB || {};
  const A = 'assets/';

  DB.IMG = {
    dice: v => `${A}dice/d${v}.webp`,
    logo: A + 'ui/logo.webp',
    player: A + 'chars/player.jpg',
    bg: {
      menu: A + 'bg/menu.jpg', menuWide: A + 'bg/menu-wide.jpg', battle: A + 'bg/battle.jpg', shop: A + 'bg/shop.jpg',
      event: A + 'bg/event.jpg', forest: A + 'bg/forest.jpg', city: A + 'bg/city.jpg', snow: A + 'bg/snow.jpg',
      cave: A + 'bg/cave.jpg', hell: A + 'bg/hell.jpg'
    },
    node: t => `${A}nodes/${t}.webp`,
    icon: n => `${A}icons/${n}.webp`,
    fx: n => `${A}fx/${n}.jpg`,
    emblem: c => `${A}emblems/${c}.webp`,
    ui: n => `${A}ui/${n}`,
    treasure: A + 'ui/treasure-glow.jpg'
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
      name: '네크로맨서', img: A + 'bosses/necromancer.jpg', marker: A + 'bossicons/skull.webp', type: 'boss', hp: 175, desc: '죽은 자들을 지배하는 마법사.',
      moves: [{ name: '뼈의 장벽', block: 14, atk: 6 }, { name: '생명 흡수', atk: 11, heal: 10 }, { name: '죽음의 저주', atk: 6, apply: { freeze: 2, bleed: 2 } }, { name: '죽음의 파동', atk: 17 }]
    },
    hellLord: {
      name: '지옥의 군주', img: A + 'bosses/hell-lord.jpg', marker: A + 'bossicons/demon.webp', type: 'boss', hp: 145, desc: '모든 것을 불태우는 존재.',
      moves: [{ name: '지옥불', atk: 8, apply: { burn: 3 } }, { name: '분노', buff: 2, block: 10 }, { name: '파멸의 일격', atk: 20 }, { name: '화염 폭풍', atk: 5, hits: 3 }]
    },
    fallenKnight: {
      name: '타락한 성기사', img: A + 'bosses/fallen-knight.jpg', marker: A + 'bossicons/crystal.webp', type: 'boss', hp: 165, desc: '신성한 힘을 악으로 뒤틀었다.',
      moves: [{ name: '타락한 맹세', block: 15, heal: 10 }, { name: '심판의 연격', atk: 6, hits: 3 }, { name: '붉은 성검', atk: 14, apply: { bleed: 3 } }, { name: '신성 모독', atk: 9, apply: { freeze: 2 } }]
    },
    abyssDragon: {
      name: '심연의 드래곤', img: A + 'bosses/abyss-dragon.jpg', marker: A + 'bossicons/dragon.webp', type: 'boss', hp: 145, desc: '끝없는 욕망의 화신.',
      moves: [{ name: '날개 치기', atk: 10 }, { name: '심연 응축', block: 16, charge: true }, { name: '심연의 숨결', atk: 25, apply: { burn: 2 } }, { name: '꼬리 휩쓸기', atk: 7, apply: { bleed: 2 } }]
    }
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
    boss: { name: '보스', desc: '이 땅을 지배하는 최종 보스.' }
  };

  // 층별 지역 (맵·전투 배경)
  DB.REGIONS = [
    { from: 1, to: 3, name: '어둠의 숲', bg: 'forest' },
    { from: 4, to: 6, name: '몰락한 도시', bg: 'city' },
    { from: 7, to: 8, name: '얼어붙은 설산', bg: 'snow' },
    { from: 9, to: 10, name: '심연의 동굴', bg: 'cave' },
    { from: 11, to: 11, name: '지옥의 문', bg: 'hell' }
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
    allBosses: { name: '네 개의 왕관', desc: '네 보스를 모두 처치한다.', emblem: 'red' },
    runs10: { name: '끈질긴 여행자', desc: '여정을 10번 시작한다.', emblem: 'blue' }
  };

  DB.CONST = {
    floors: 10,          // 일반 층 수 (보스는 floors + 1 층)
    lanes: 5,
    diceCount: 5,
    rerolls: 2,
    potionSlots: 3,
    startHp: 50,
    startGold: 20
  };
})(typeof window !== 'undefined' ? window : globalThis);
