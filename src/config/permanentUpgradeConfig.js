// requiresLevel: 이 캐릭터 레벨 이상이어야 목록에서 구매 가능해진다 (미달 시 잠금 표시, Document/TODO.md #8 참고).
export const PERMANENT_UPGRADE_CONFIG = [
  {
    id: 'attackPower',
    name: '공격력 강화',
    description: '물리/마법 공격력을 영구적으로 증가시킵니다.',
    requiresLevel: 0,
    baseCost: 20,
    costMultiplier: 1.16,
    bonusPerLevel: 0.03, // 데미지 +3% / 레벨 (곱연산)
  },
  {
    id: 'maxHp',
    name: '체력 강화',
    description: '최대 체력을 영구적으로 증가시킵니다.',
    requiresLevel: 0,
    baseCost: 20,
    costMultiplier: 1.16,
    bonusPerLevel: 8, // 최대체력 +8 / 레벨 (가산)
  },
  {
    id: 'hpRegen',
    name: '회복력 강화',
    description: '초당 체력 회복량을 영구적으로 증가시킵니다.',
    requiresLevel: 5,
    baseCost: 30,
    costMultiplier: 1.18,
    bonusPerLevel: 0.1, // 회복/초 +0.1 / 레벨 (가산)
  },
  {
    id: 'attackSpeed',
    name: '공격속도 강화',
    description: '공격 간격을 영구적으로 단축시킵니다.',
    requiresLevel: 10,
    baseCost: 40,
    costMultiplier: 1.2,
    bonusPerLevel: 0.01, // 민첩성과 동일한 방식으로 공격 간격 분모에 가산
  },
  {
    id: 'critChance',
    name: '치명타 강화',
    description: '스타일과 무관하게 적용되는 치명타 확률을 영구적으로 증가시킵니다.',
    requiresLevel: 15,
    baseCost: 50,
    costMultiplier: 1.2,
    bonusPerLevel: 0.01, // 확률 +1% / 레벨
  },
  {
    id: 'expGain',
    name: '경험치 획득량 강화',
    description: '몬스터 처치 시 획득하는 경험치를 영구적으로 증가시킵니다.',
    requiresLevel: 20,
    baseCost: 60,
    costMultiplier: 1.2,
    bonusPerLevel: 0.05, // 경험치 +5% / 레벨 (곱연산)
  },
];
