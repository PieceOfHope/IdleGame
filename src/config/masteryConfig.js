// trait: 숙련도별 1차 특성 (데미지 배율 외 차별점). 모두 숙련도 레벨에 비례해 성장하며 cap으로 상한을 둔다.
export const MASTERY_CONFIG = [
  {
    id: 'sword', name: '검', category: 'physical', bonusPerLevel: 0.01,
    trait: { type: 'attackSpeed', label: '공속 증가', coefficientPerLevel: 0.004, cap: 0.3 },
  },
  {
    id: 'spear', name: '창', category: 'physical', bonusPerLevel: 0.01,
    trait: { type: 'flatBonusDamage', label: '관통 피해', coefficientPerLevel: 0.5 },
  },
  {
    id: 'blunt', name: '둔기', category: 'physical', bonusPerLevel: 0.01,
    trait: { type: 'stunChance', label: '기절', coefficientPerLevel: 0.004, cap: 0.25 },
  },
  {
    id: 'bow', name: '활', category: 'physical', bonusPerLevel: 0.01,
    trait: { type: 'critChance', label: '치명타', coefficientPerLevel: 0.005, cap: 0.4, critMultiplier: 1.5 },
  },
  // 원소마법=직격 버스트, 암흑마법=DOT, 신성마법=회복, 정신마법=흡혈/CC 컨셉에 맞춰 재배정함
  // (Document/SkillSystemDesign.md 1절 "주의" 참고 - 예전엔 원소=화상, 암흑=흡혈, 정신=약화였음).
  {
    id: 'elemental', name: '원소마법', category: 'magic', bonusPerLevel: 0.01,
    trait: { type: 'critChance', label: '치명타', coefficientPerLevel: 0.005, cap: 0.35, critMultiplier: 1.6 },
  },
  {
    id: 'dark', name: '암흑마법', category: 'magic', bonusPerLevel: 0.01,
    trait: { type: 'burnDot', label: '화상', coefficientPerLevel: 0.3, durationMs: 3000 },
  },
  {
    id: 'holy', name: '신성마법', category: 'magic', bonusPerLevel: 0.01,
    trait: { type: 'directHeal', label: '추가 회복', coefficientPerLevel: 0.4 },
  },
  {
    id: 'mental', name: '정신마법', category: 'magic', bonusPerLevel: 0.01,
    trait: { type: 'lifesteal', label: '흡혈', coefficientPerLevel: 0.003, cap: 0.2 },
  },
];

export const MASTERY_LEVEL_COEFFICIENT = 1.0;
