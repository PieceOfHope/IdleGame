import { getMonsterForLevel, MONSTER_BALANCE } from '../config/monsterConfig.js';
import { MASTERY_CONFIG } from '../config/masteryConfig.js';
import { RETREAT_DURATION_MS } from '../config/characterConfig.js';
import { getDerivedStats, getPhysicalDamage, getMagicDamage, addCharacterExp } from './characterSystem.js';
import { getMasteryDamageMultiplier, getMasteryLevel, addMasteryUsage } from './masterySystem.js';
import { addResource } from './resourceSystem.js';

function getActiveStyleDef(state) {
  return MASTERY_CONFIG.find((m) => m.id === state.combat.activeStyleId) ?? MASTERY_CONFIG[0];
}

function getBaseAttackDamage(state, styleDef) {
  const masteryMultiplier = getMasteryDamageMultiplier(state, styleDef);
  return styleDef.category === 'physical'
    ? getPhysicalDamage(state, masteryMultiplier)
    : getMagicDamage(state, masteryMultiplier);
}

// 특성 적용 - 데미지에 직접 영향을 주는 것(관통/치명타)은 최종 데미지를 반환하고,
// 그 외의 효과(기절/흡혈/화상/회복/약화)는 combat 상태에 부수효과로 기록한다.
function applyStyleTrait(state, styleDef, damage, onEvent) {
  const trait = styleDef.trait;
  if (!trait) return damage;

  const combat = state.combat;
  const level = getMasteryLevel(state, styleDef.id);
  const chance = trait.cap !== undefined ? Math.min(trait.cap, level * trait.coefficientPerLevel) : 0;

  switch (trait.type) {
    case 'critChance': {
      if (Math.random() < chance) {
        const bonusDamage = damage * (trait.critMultiplier - 1);
        onEvent({ type: 'critical-hit', bonusDamage });
        return damage + bonusDamage;
      }
      return damage;
    }
    case 'flatBonusDamage': {
      return damage + level * trait.coefficientPerLevel;
    }
    case 'stunChance': {
      if (Math.random() < chance) {
        const monster = getMonsterForLevel(combat.monsterLevel);
        combat.monsterAttackElapsedMs -= monster.attackIntervalMs;
        onEvent({ type: 'monster-stunned' });
      }
      return damage;
    }
    case 'weakenChance': {
      if (Math.random() < chance) {
        combat.monsterNextHitReductionPct = trait.reductionPct;
        onEvent({ type: 'monster-weakened' });
      }
      return damage;
    }
    case 'lifesteal': {
      combat.pendingHeal += damage * chance;
      return damage;
    }
    case 'directHeal': {
      combat.pendingHeal += level * trait.coefficientPerLevel;
      return damage;
    }
    case 'burnDot': {
      combat.dotRemainingMs = trait.durationMs;
      combat.dotDamagePerSec = level * trait.coefficientPerLevel;
      return damage;
    }
    default:
      return damage;
  }
}

function getAttackIntervalMs(state, styleDef, derived) {
  const trait = styleDef.trait;
  if (!trait || trait.type !== 'attackSpeed') return derived.attackIntervalMs;
  const level = getMasteryLevel(state, styleDef.id);
  const reduction = Math.min(trait.cap, level * trait.coefficientPerLevel);
  return derived.attackIntervalMs * (1 - reduction);
}

export function setActiveStyle(state, styleId) {
  if (!MASTERY_CONFIG.some((m) => m.id === styleId)) return;
  state.combat.activeStyleId = styleId;
}

export function setFarmingMode(state, enabled) {
  const combat = state.combat;
  combat.farmingMode = enabled;
  combat.monsterLevel = enabled ? Math.max(1, combat.highestMonsterLevel - 1) : combat.highestMonsterLevel;
  combat.monsterCurrentHp = getMonsterForLevel(combat.monsterLevel).maxHp;
  combat.monsterAttackElapsedMs = 0;
  combat.dotRemainingMs = 0;
  combat.dotDamagePerSec = 0;
  combat.extraEnemies = [];
  combat.enemySpawnElapsedMs = 0;
}

export function getMonsterSnapshot(state) {
  return getMonsterForLevel(state.combat.monsterLevel);
}

// 오프라인 정산(DPS 기반)에 사용하는 기대 초당 데미지. 확률형 특성(치명타)은 기대값으로,
// 화상은 "계속 갱신되어 상시 적용된다"고 가정한 근사치로 반영한다.
export function getExpectedPlayerDps(state) {
  const styleDef = getActiveStyleDef(state);
  const derived = getDerivedStats(state);
  const attackIntervalMs = getAttackIntervalMs(state, styleDef, derived);
  const baseDamage = getBaseAttackDamage(state, styleDef);
  const level = getMasteryLevel(state, styleDef.id);
  const trait = styleDef.trait;

  let expectedDamagePerHit = baseDamage;
  let extraDps = 0;
  if (trait?.type === 'flatBonusDamage') {
    expectedDamagePerHit += level * trait.coefficientPerLevel;
  } else if (trait?.type === 'critChance') {
    const chance = Math.min(trait.cap, level * trait.coefficientPerLevel);
    expectedDamagePerHit += baseDamage * chance * (trait.critMultiplier - 1);
  } else if (trait?.type === 'burnDot') {
    extraDps += level * trait.coefficientPerLevel;
  }

  return expectedDamagePerHit * (1000 / attackIntervalMs) + extraDps;
}

// 맨 앞 몬스터가 처치된 뒤 다음 몬스터를 배치한다. 뒤에 쌓여있던 몬스터(extraEnemies)가 있으면
// 그 몬스터를 그대로 앞으로 승격시키고, 없으면 새로 스폰한다.
function promoteNextEnemy(state) {
  const combat = state.combat;
  if (!combat.farmingMode) {
    combat.monsterLevel += 1;
    if (combat.monsterLevel > combat.highestMonsterLevel) {
      combat.highestMonsterLevel = combat.monsterLevel;
    }
  }

  const next = combat.extraEnemies.shift();
  if (next) {
    combat.monsterLevel = next.level;
    combat.monsterCurrentHp = next.currentHp;
    combat.monsterAttackElapsedMs = next.attackElapsedMs;
  } else {
    combat.monsterCurrentHp = getMonsterForLevel(combat.monsterLevel).maxHp;
    combat.monsterAttackElapsedMs = 0;
  }
  combat.dotRemainingMs = 0;
  combat.dotDamagePerSec = 0;
}

// 몬스터에게 데미지를 적용하고, 처치 시 골드 지급 및 다음 전개(파밍/진행)를 처리한다.
// 플레이어의 직접 공격과 화상(DoT) 틱이 공유하는 처치 판정 로직.
function damageMonster(state, damage, onEvent) {
  const combat = state.combat;
  combat.monsterCurrentHp -= damage;
  if (combat.monsterCurrentHp > 0) return;

  const defeatedMonster = getMonsterForLevel(combat.monsterLevel);
  addResource(state, 'gold', defeatedMonster.goldReward);
  addCharacterExp(state, defeatedMonster.expReward);
  onEvent({ type: 'monster-defeated', level: combat.monsterLevel, reward: defeatedMonster.goldReward, exp: defeatedMonster.expReward });

  promoteNextEnemy(state);
}

export function advanceCombat(state, dtMs, onEvent = () => {}) {
  const combat = state.combat;
  const derived = getDerivedStats(state);
  const dtSeconds = dtMs / 1000;

  if (combat.isRetreating) {
    combat.retreatRemainingMs -= dtMs;
    if (combat.retreatRemainingMs <= 0) {
      combat.isRetreating = false;
      combat.retreatRemainingMs = 0;
      combat.playerAttackElapsedMs = 0;
      combat.monsterAttackElapsedMs = 0;
      combat.enemySpawnElapsedMs = 0;
      for (const enemy of combat.extraEnemies) enemy.attackElapsedMs = 0;
      onEvent({ type: 'retreat-end' });
    }
    return;
  }

  if (combat.playerCurrentHp < derived.maxHp) {
    combat.playerCurrentHp = Math.min(derived.maxHp, combat.playerCurrentHp + derived.hpRegenPerSec * dtSeconds);
  }

  if (combat.dotRemainingMs > 0) {
    damageMonster(state, combat.dotDamagePerSec * dtSeconds, onEvent);
    combat.dotRemainingMs = Math.max(0, combat.dotRemainingMs - dtMs);
  }

  const styleDef = getActiveStyleDef(state);
  const attackIntervalMs = getAttackIntervalMs(state, styleDef, derived);

  combat.playerAttackElapsedMs += dtMs;
  if (combat.playerAttackElapsedMs >= attackIntervalMs) {
    combat.playerAttackElapsedMs -= attackIntervalMs;

    const baseDamage = getBaseAttackDamage(state, styleDef);
    const finalDamage = applyStyleTrait(state, styleDef, baseDamage, onEvent);
    addMasteryUsage(state, styleDef.id, 1);
    onEvent({ type: 'player-attack', damage: finalDamage, styleId: styleDef.id });

    damageMonster(state, finalDamage, onEvent);
  }

  if (combat.pendingHeal > 0) {
    combat.playerCurrentHp = Math.min(derived.maxHp, combat.playerCurrentHp + combat.pendingHeal);
    combat.pendingHeal = 0;
  }

  const monster = getMonsterForLevel(combat.monsterLevel);
  combat.monsterAttackElapsedMs += dtMs;
  if (combat.monsterAttackElapsedMs >= monster.attackIntervalMs) {
    combat.monsterAttackElapsedMs -= monster.attackIntervalMs;

    let monsterDamage = monster.attackDamage;
    if (combat.monsterNextHitReductionPct > 0) {
      monsterDamage *= 1 - combat.monsterNextHitReductionPct;
      combat.monsterNextHitReductionPct = 0;
    }

    combat.playerCurrentHp -= monsterDamage;
    onEvent({ type: 'monster-attack', damage: monsterDamage });

    if (combat.playerCurrentHp <= 0) {
      // 후퇴하며 즉시 최대 체력으로 회복 - 전투는 retreatRemainingMs 동안만 멈춘다 (진행도 손실 없음).
      combat.playerCurrentHp = derived.maxHp;
      combat.isRetreating = true;
      combat.retreatRemainingMs = RETREAT_DURATION_MS;
      onEvent({ type: 'player-retreat' });
    }
  }

  // 뒤에 쌓여있는 몬스터들도 각자의 타이밍으로 플레이어를 공격한다 - 처치가 늦어질수록 다:1로 두들겨 맞는다.
  for (const enemy of combat.extraEnemies) {
    if (combat.isRetreating) break;

    const enemyDef = getMonsterForLevel(enemy.level);
    enemy.attackElapsedMs += dtMs;
    if (enemy.attackElapsedMs < enemyDef.attackIntervalMs) continue;
    enemy.attackElapsedMs -= enemyDef.attackIntervalMs;

    combat.playerCurrentHp -= enemyDef.attackDamage;
    onEvent({ type: 'monster-attack', damage: enemyDef.attackDamage });

    if (combat.playerCurrentHp <= 0) {
      combat.playerCurrentHp = derived.maxHp;
      combat.isRetreating = true;
      combat.retreatRemainingMs = RETREAT_DURATION_MS;
      onEvent({ type: 'player-retreat' });
    }
  }

  // 처치 속도가 스폰 속도를 못 따라가면 몬스터가 옆으로 쌓인다 (최대 동시 등장 수까지).
  if (1 + combat.extraEnemies.length < MONSTER_BALANCE.maxActiveCount) {
    combat.enemySpawnElapsedMs += dtMs;
    if (combat.enemySpawnElapsedMs >= MONSTER_BALANCE.stackSpawnIntervalMs) {
      combat.enemySpawnElapsedMs -= MONSTER_BALANCE.stackSpawnIntervalMs;
      const spawnLevel = combat.monsterLevel;
      combat.extraEnemies.push({
        level: spawnLevel,
        currentHp: getMonsterForLevel(spawnLevel).maxHp,
        attackElapsedMs: 0,
      });
      onEvent({ type: 'enemy-stacked', level: spawnLevel });
    }
  }
}
