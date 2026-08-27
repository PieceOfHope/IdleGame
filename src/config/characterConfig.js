// 스탯 1포인트당 효과 - 아래 CHARACTER_BALANCE 계수와 짝을 맞춘 설명 (UI 표시용).
export const STAT_CONFIG = [
  { id: 'str', name: '힘', hint: '물리 공격력 +2%' },
  { id: 'agi', name: '민첩성', hint: '공격 속도 증가 (한계 있음)' },
  { id: 'int', name: '지력', hint: '마법 공격력 +2%' },
  { id: 'vit', name: '체력', hint: '최대 체력 +4' },
  { id: 'recovery', name: '회복력', hint: '초당 회복 +0.05' },
];

// 캐릭터 레벨 = CHARACTER_LEVEL_COEFFICIENT * sqrt(누적 경험치) (masteryCurve.js와 동일한 제곱근 곡선).
// 정확한 페이스는 추후 밸런싱 대상 (Document/TODO.md #3 참고) - 우선 임시값.
export const CHARACTER_LEVEL_COEFFICIENT = 0.5;
export const STAT_POINTS_PER_LEVEL = 5;

export const CHARACTER_BALANCE = {
  baseHp: 50,
  baseRegenPerSec: 0.5,
  baseAttackIntervalMs: 1000,
  baseWeaponDamage: 5,
  baseSpellPower: 5,
  strDamagePerLevel: 0.02,
  intDamagePerLevel: 0.02,
  agiSpeedPerLevel: 0.015,
  minAttackIntervalMs: 200, // AGI 스노우볼링 방지 하한선
  hpPerVitLevel: 4,
  regenPerRecoveryLevel: 0.05,
  permanentCritMultiplier: 1.5, // '치명타 강화' 영구강화가 굴리는 치명타의 배율 (스타일 고유 치명타와 별개)
};

export const RETREAT_DURATION_MS = 3000;
