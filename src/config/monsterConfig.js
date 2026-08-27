export const MONSTER_BALANCE = {
  baseHp: 20,
  baseAttackDamage: 2,
  baseAttackIntervalMs: 1500,
  baseGoldReward: 5,
  hpGrowth: 1.12,
  attackGrowth: 1.1,
  goldGrowth: 1.08,
};

export function getMonsterForLevel(level) {
  const exponent = level - 1;
  return {
    level,
    name: `몬스터 Lv.${level}`,
    maxHp: Math.round(MONSTER_BALANCE.baseHp * Math.pow(MONSTER_BALANCE.hpGrowth, exponent)),
    attackDamage: Math.round(MONSTER_BALANCE.baseAttackDamage * Math.pow(MONSTER_BALANCE.attackGrowth, exponent)),
    attackIntervalMs: MONSTER_BALANCE.baseAttackIntervalMs,
    goldReward: Math.round(MONSTER_BALANCE.baseGoldReward * Math.pow(MONSTER_BALANCE.goldGrowth, exponent)),
  };
}
