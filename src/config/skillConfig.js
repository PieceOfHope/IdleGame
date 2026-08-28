// 숙련도 타입(무기 4종 + 마법 4종)당 스킬 후보 4개. 숙련도 레벨 5/15에 도달할 때마다
// 후보 중 하나를 선택해 습득한다(타입당 최종 2개 장착). 데미지 배수는 해당 타입의
// 기본 공격력(물리/마법) 1회분을 1.0으로 보는 배수다. Document/TODO.md #7 참고 - 수치는 임시값.
export const SKILL_UNLOCK_LEVELS = [5, 15];

export const SKILL_CONFIG = {
  sword: [
    {
      id: 'quick_slash', name: '연속 베기', description: '빠르게 2회 연속 타격한다.',
      cooldownMs: 4000, effects: [{ kind: 'multiHit', hits: 2, multiplierEach: 1.0 }],
    },
    {
      id: 'flash_strike', name: '일섬', description: '강력한 일격을 가한다.',
      cooldownMs: 12000, effects: [{ kind: 'damage', multiplier: 3.0 }],
    },
    {
      id: 'blade_storm', name: '칼날 폭풍', description: '3연속으로 베어낸다.',
      cooldownMs: 8000, effects: [{ kind: 'multiHit', hits: 3, multiplierEach: 0.6 }],
    },
    {
      id: 'weak_point', name: '약점 가격', description: '약점을 노려 이후 받는 피해를 늘린다.',
      cooldownMs: 10000,
      effects: [{ kind: 'damage', multiplier: 1.2 }, { kind: 'debuffEnemyDamageTaken', bonusPct: 0.2, durationMs: 3000 }],
    },
  ],
  spear: [
    {
      id: 'piercing_thrust', name: '관통 찌르기', description: '방어를 뚫는 강한 찌르기.',
      cooldownMs: 10000, effects: [{ kind: 'damage', multiplier: 2.5 }],
    },
    {
      id: 'spin_lance', name: '회전창', description: '창을 돌려 4연속으로 타격한다.',
      cooldownMs: 9000, effects: [{ kind: 'multiHit', hits: 4, multiplierEach: 0.5 }],
    },
    {
      id: 'chain_thrust', name: '창격 연쇄', description: '찌른 뒤 출혈을 남긴다.',
      cooldownMs: 8000,
      effects: [{ kind: 'damage', multiplier: 1.5 }, { kind: 'dot', totalMultiplier: 1.5, durationMs: 3000 }],
    },
    {
      id: 'final_thrust', name: '필살 찌르기', description: '온 힘을 다한 필살의 일격.',
      cooldownMs: 20000, effects: [{ kind: 'damage', multiplier: 4.0 }],
    },
  ],
  blunt: [
    {
      id: 'heavy_blow', name: '강타', description: '강하게 내려쳐 기절시킨다.',
      cooldownMs: 10000, effects: [{ kind: 'damage', multiplier: 2.0 }, { kind: 'stunFront' }],
    },
    {
      id: 'earth_slam', name: '대지 강타', description: '땅을 내려쳐 앞에 있는 모든 몬스터를 기절시킨다.',
      cooldownMs: 14000, effects: [{ kind: 'damage', multiplier: 1.5 }, { kind: 'stunAll' }],
    },
    {
      id: 'crush', name: '분쇄', description: '갑옷을 부수어 받는 피해를 늘린다.',
      cooldownMs: 8000,
      effects: [{ kind: 'damage', multiplier: 1.0 }, { kind: 'debuffEnemyDamageTaken', bonusPct: 0.15, durationMs: 4000 }],
    },
    {
      id: 'flurry', name: '연타', description: '빠르게 3연속으로 내려친다.',
      cooldownMs: 9000, effects: [{ kind: 'multiHit', hits: 3, multiplierEach: 0.7 }],
    },
  ],
  bow: [
    {
      id: 'aimed_shot', name: '조준 사격', description: '정확히 조준해 확정 치명타를 가한다.',
      cooldownMs: 9000, effects: [{ kind: 'damage', multiplier: 1.5, guaranteedCrit: true }],
    },
    {
      id: 'rapid_fire', name: '연사', description: '화살을 3연발로 쏜다.',
      cooldownMs: 7000, effects: [{ kind: 'multiHit', hits: 3, multiplierEach: 0.6 }],
    },
    {
      id: 'piercing_shot', name: '관통 사격', description: '강하게 꿰뚫는 사격.',
      cooldownMs: 11000, effects: [{ kind: 'damage', multiplier: 2.2 }],
    },
    {
      id: 'poison_arrow', name: '독화살', description: '적중 시 중독시켜 지속 피해를 준다.',
      cooldownMs: 10000,
      effects: [{ kind: 'damage', multiplier: 1.0 }, { kind: 'dot', totalMultiplier: 2.0, durationMs: 4000 }],
    },
  ],
  elemental: [
    {
      id: 'fireball', name: '파이어볼', description: '느리지만 강력한 화염구를 발사한다.',
      cooldownMs: 15000, effects: [{ kind: 'damage', multiplier: 3.5 }],
    },
    {
      id: 'thunder_strike', name: '썬더 스트라이크', description: '번개로 내리쳐 기절시킨다.',
      cooldownMs: 11000, effects: [{ kind: 'damage', multiplier: 1.8 }, { kind: 'stunFront' }],
    },
    {
      id: 'ice_spike', name: '아이스 스파이크', description: '얼음창으로 다음 공격을 무력화시킨다.',
      cooldownMs: 12000, effects: [{ kind: 'damage', multiplier: 2.2 }, { kind: 'nullifyNextEnemyHit' }],
    },
    {
      id: 'meteor', name: '메테오', description: '아주 느리지만 압도적인 화력의 운석을 떨어뜨린다.',
      cooldownMs: 20000, effects: [{ kind: 'damage', multiplier: 4.5 }],
    },
  ],
  dark: [
    {
      id: 'curse', name: '저주', description: '강한 저주를 걸어 지속 피해를 준다.',
      cooldownMs: 10000, effects: [{ kind: 'dot', totalMultiplier: 3.0, durationMs: 6000 }],
    },
    {
      id: 'corruption', name: '부패', description: '몸을 부패시켜 지속 피해와 함께 받는 피해를 늘린다.',
      cooldownMs: 9000,
      effects: [{ kind: 'dot', totalMultiplier: 2.0, durationMs: 8000 }, { kind: 'debuffEnemyDamageTaken', bonusPct: 0.15, durationMs: 8000 }],
    },
    {
      id: 'dark_orb', name: '암흑구체', description: '암흑의 구체를 던져 맞춘 뒤 계속 갉아먹는다.',
      cooldownMs: 11000,
      effects: [{ kind: 'damage', multiplier: 1.5 }, { kind: 'dot', totalMultiplier: 1.5, durationMs: 4000 }],
    },
    {
      id: 'death_mark', name: '죽음의 표식', description: '죽음의 표식을 새겨 오랫동안 강하게 갉아먹는다.',
      cooldownMs: 16000, effects: [{ kind: 'dot', totalMultiplier: 5.0, durationMs: 10000 }],
    },
  ],
  holy: [
    {
      id: 'healing_light', name: '치유의 빛', description: '빛으로 체력을 즉시 회복한다.',
      cooldownMs: 10000, effects: [{ kind: 'heal', pctMaxHp: 0.2 }],
    },
    {
      id: 'blessing', name: '축복', description: '축복을 내려 잠시 받는 피해를 줄인다.',
      cooldownMs: 12000,
      effects: [{ kind: 'heal', pctMaxHp: 0.1 }, { kind: 'buffSelfDamageReduction', pct: 0.3, durationMs: 3000 }],
    },
    {
      id: 'purify', name: '정화', description: '몸을 정화해 체력을 회복한다.',
      cooldownMs: 9000, effects: [{ kind: 'heal', pctMaxHp: 0.15 }],
    },
    {
      id: 'greater_heal', name: '대회복', description: '강력한 치유로 체력을 크게 회복한다.',
      cooldownMs: 16000, effects: [{ kind: 'heal', pctMaxHp: 0.4 }],
    },
  ],
  mental: [
    {
      id: 'mind_drain', name: '정신 흡수', description: '정신을 갉아먹어 피해를 주고 그만큼 회복한다.',
      cooldownMs: 9000, effects: [{ kind: 'damage', multiplier: 1.5 }, { kind: 'lifesteal', pct: 0.3 }],
    },
    {
      id: 'dominate', name: '지배', description: '정신을 지배해 오랫동안 행동불능으로 만든다.',
      cooldownMs: 14000, effects: [{ kind: 'stunFront', extraDurationMultiplier: 2 }],
    },
    {
      id: 'terror', name: '공포', description: '공포에 질리게 해 다음 공격을 무력화시킨다.',
      cooldownMs: 10000, effects: [{ kind: 'damage', multiplier: 1.2 }, { kind: 'nullifyNextEnemyHit' }],
    },
    {
      id: 'soul_rend', name: '영혼 착취', description: '영혼을 뜯어내 큰 피해를 주고 절반을 흡수한다.',
      cooldownMs: 12000, effects: [{ kind: 'damage', multiplier: 2.0 }, { kind: 'lifesteal', pct: 0.5 }],
    },
  ],
};
