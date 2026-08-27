export const PERMANENT_UPGRADE_CONFIG = [
  {
    id: 'attackPower',
    name: '공격력 강화',
    description: '물리/마법 공격력을 영구적으로 증가시킵니다.',
    baseCost: 20,
    costMultiplier: 1.16,
    bonusPerLevel: 0.03, // 데미지 +3% / 레벨 (곱연산)
  },
  {
    id: 'maxHp',
    name: '체력 강화',
    description: '최대 체력을 영구적으로 증가시킵니다.',
    baseCost: 20,
    costMultiplier: 1.16,
    bonusPerLevel: 8, // 최대체력 +8 / 레벨 (가산)
  },
  {
    id: 'hpRegen',
    name: '회복력 강화',
    description: '초당 체력 회복량을 영구적으로 증가시킵니다.',
    baseCost: 30,
    costMultiplier: 1.18,
    bonusPerLevel: 0.1, // 회복/초 +0.1 / 레벨 (가산)
  },
];
