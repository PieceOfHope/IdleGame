import { getMonsterForLevel, MONSTER_BALANCE } from '../config/monsterConfig.js';
import { MASTERY_CONFIG } from '../config/masteryConfig.js';
import { RETREAT_DURATION_MS, CHARACTER_BALANCE } from '../config/characterConfig.js';
import {
  getDerivedStats,
  getPhysicalDamage,
  getMagicDamage,
  addCharacterExp,
  getPermanentCritChance,
  getExpGainMultiplier,
} from './characterSystem.js';
import { getMasteryDamageMultiplier, getMasteryLevel, addMasteryUsage } from './masterySystem.js';
import { getEquippedSkillDefs } from './skillSystem.js';
import { addResource } from './resourceSystem.js';

function getWeaponDef(state) {
  return MASTERY_CONFIG.find((m) => m.id === state.combat.activeWeaponId) ?? MASTERY_CONFIG.find((m) => m.category === 'physical');
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

export function setActiveWeapon(state, weaponId) {
  if (!MASTERY_CONFIG.some((m) => m.id === weaponId && m.category === 'physical')) return;
  state.combat.activeWeaponId = weaponId;
}

export function setActiveMagic(state, magicId) {
  if (!MASTERY_CONFIG.some((m) => m.id === magicId && m.category === 'magic')) return;
  state.combat.activeMagicId = magicId;
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
  const styleDef = getWeaponDef(state);
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

  // '치명타 강화' 영구강화 - 스타일 고유 치명타 특성과 별개로 항상 판정되므로 기대 데미지에도 별도로 더한다.
  const permanentCritChance = getPermanentCritChance(state);
  expectedDamagePerHit += baseDamage * permanentCritChance * (CHARACTER_BALANCE.permanentCritMultiplier - 1);

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
// 플레이어의 직접 공격, 화상(DoT) 틱, 스킬이 모두 공유하는 처치 판정 로직.
function damageMonster(state, damage, onEvent) {
  const combat = state.combat;
  combat.monsterCurrentHp -= damage * (1 + combat.enemyDamageTakenBonusPct);
  if (combat.monsterCurrentHp > 0) return;

  const defeatedMonster = getMonsterForLevel(combat.monsterLevel);
  addResource(state, 'gold', defeatedMonster.goldReward);
  const expGained = defeatedMonster.expReward * getExpGainMultiplier(state);
  addCharacterExp(state, expGained);
  onEvent({ type: 'monster-defeated', level: combat.monsterLevel, reward: defeatedMonster.goldReward, exp: expGained });

  promoteNextEnemy(state);
}

// 몬스터(맨 앞이든 스택이든)의 공격을 플레이어에게 적용하고, 체력이 다하면 후퇴시킨다.
// 앞 몬스터 전용 처리(약화 감소율 적용)는 호출측에서 damage를 계산한 뒤 넘긴다.
function applyDamageToPlayer(state, derived, damage, onEvent) {
  const combat = state.combat;
  const finalDamage = damage * (1 - combat.playerDamageReductionPct);
  combat.playerCurrentHp -= finalDamage;
  onEvent({ type: 'monster-attack', damage: finalDamage });

  if (combat.playerCurrentHp <= 0) {
    // 후퇴하며 즉시 최대 체력으로 회복 - 전투는 retreatRemainingMs 동안만 멈춘다 (진행도 손실 없음).
    combat.playerCurrentHp = derived.maxHp;
    combat.isRetreating = true;
    combat.retreatRemainingMs = RETREAT_DURATION_MS;
    onEvent({ type: 'player-retreat' });
  }
}

function rollCrit(state, damage, onEvent) {
  const permanentCritChance = getPermanentCritChance(state);
  if (permanentCritChance <= 0 || Math.random() >= permanentCritChance) return damage;
  const bonusDamage = damage * (CHARACTER_BALANCE.permanentCritMultiplier - 1);
  onEvent({ type: 'critical-hit', bonusDamage });
  return damage + bonusDamage;
}

// 스킬 하나의 effects 배열을 순서대로 실행한다. lifesteal은 같은 스킬 안에서 앞선 damage 계열
// effect가 이미 낸 피해량(totalDamageDealt)을 기준으로 계산한다.
function resolveSkillEffects(state, skillDef, onEvent) {
  const combat = state.combat;
  const derived = getDerivedStats(state);
  const styleDef = MASTERY_CONFIG.find((m) => m.id === skillDef.masteryId);
  const baseDamage = getBaseAttackDamage(state, styleDef);
  let totalDamageDealt = 0;

  for (const effect of skillDef.effects) {
    switch (effect.kind) {
      case 'damage': {
        let dmg = applyStyleTrait(state, styleDef, baseDamage * effect.multiplier, onEvent);
        if (effect.guaranteedCrit) {
          const bonusDamage = dmg * (CHARACTER_BALANCE.permanentCritMultiplier - 1);
          onEvent({ type: 'critical-hit', bonusDamage });
          dmg += bonusDamage;
        } else {
          dmg = rollCrit(state, dmg, onEvent);
        }
        totalDamageDealt += dmg;
        damageMonster(state, dmg, onEvent);
        break;
      }
      case 'multiHit': {
        for (let i = 0; i < effect.hits; i += 1) {
          let dmg = applyStyleTrait(state, styleDef, baseDamage * effect.multiplierEach, onEvent);
          dmg = rollCrit(state, dmg, onEvent);
          totalDamageDealt += dmg;
          damageMonster(state, dmg, onEvent);
        }
        break;
      }
      case 'dot': {
        const totalDamage = baseDamage * effect.totalMultiplier;
        combat.dotRemainingMs = effect.durationMs;
        combat.dotDamagePerSec = totalDamage / (effect.durationMs / 1000);
        break;
      }
      case 'heal': {
        combat.pendingHeal += derived.maxHp * effect.pctMaxHp;
        break;
      }
      case 'stunFront': {
        const monster = getMonsterForLevel(combat.monsterLevel);
        combat.monsterAttackElapsedMs -= monster.attackIntervalMs * (effect.extraDurationMultiplier ?? 1);
        onEvent({ type: 'monster-stunned' });
        break;
      }
      case 'stunAll': {
        const monster = getMonsterForLevel(combat.monsterLevel);
        combat.monsterAttackElapsedMs -= monster.attackIntervalMs;
        for (const enemy of combat.extraEnemies) {
          const enemyDef = getMonsterForLevel(enemy.level);
          enemy.attackElapsedMs -= enemyDef.attackIntervalMs;
        }
        onEvent({ type: 'monster-stunned' });
        break;
      }
      case 'debuffEnemyDamageTaken': {
        combat.enemyDamageTakenBonusPct = effect.bonusPct;
        combat.enemyDamageTakenRemainingMs = effect.durationMs;
        onEvent({ type: 'monster-weakened' });
        break;
      }
      case 'buffSelfDamageReduction': {
        combat.playerDamageReductionPct = effect.pct;
        combat.playerDamageReductionRemainingMs = effect.durationMs;
        break;
      }
      case 'nullifyNextEnemyHit': {
        combat.monsterNextHitReductionPct = 1;
        onEvent({ type: 'monster-weakened' });
        break;
      }
      case 'lifesteal': {
        combat.pendingHeal += totalDamageDealt * effect.pct;
        break;
      }
      default:
        break;
    }
  }
}

export function castSkill(state, skillId, onEvent = () => {}) {
  const combat = state.combat;
  if (combat.isRetreating) return false;

  const equipped = getEquippedSkillDefs(state).find((s) => s.id === skillId);
  if (!equipped) return false;
  if ((combat.skillCooldowns[skillId] ?? 0) > 0) return false;

  combat.skillCooldowns[skillId] = equipped.cooldownMs;
  addMasteryUsage(state, equipped.masteryId, 1);
  onEvent({ type: 'skill-cast', skillId, name: equipped.name });
  resolveSkillEffects(state, equipped, onEvent);
  return true;
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

  if (combat.enemyDamageTakenRemainingMs > 0) {
    combat.enemyDamageTakenRemainingMs = Math.max(0, combat.enemyDamageTakenRemainingMs - dtMs);
    if (combat.enemyDamageTakenRemainingMs === 0) combat.enemyDamageTakenBonusPct = 0;
  }
  if (combat.playerDamageReductionRemainingMs > 0) {
    combat.playerDamageReductionRemainingMs = Math.max(0, combat.playerDamageReductionRemainingMs - dtMs);
    if (combat.playerDamageReductionRemainingMs === 0) combat.playerDamageReductionPct = 0;
  }

  if (combat.dotRemainingMs > 0) {
    damageMonster(state, combat.dotDamagePerSec * dtSeconds, onEvent);
    combat.dotRemainingMs = Math.max(0, combat.dotRemainingMs - dtMs);
  }

  // 평타는 장착한 무기로만 나간다 - 마법은 스킬 전용(Document/SkillSystemDesign.md 참고).
  const weaponDef = getWeaponDef(state);
  const attackIntervalMs = getAttackIntervalMs(state, weaponDef, derived);

  combat.playerAttackElapsedMs += dtMs;
  if (combat.playerAttackElapsedMs >= attackIntervalMs) {
    combat.playerAttackElapsedMs -= attackIntervalMs;

    const baseDamage = getBaseAttackDamage(state, weaponDef);
    let finalDamage = applyStyleTrait(state, weaponDef, baseDamage, onEvent);
    finalDamage = rollCrit(state, finalDamage, onEvent);

    addMasteryUsage(state, weaponDef.id, 1);
    onEvent({ type: 'player-attack', damage: finalDamage, styleId: weaponDef.id });

    damageMonster(state, finalDamage, onEvent);
  }

  // 스킬 쿨다운 감소 + (자동 시전이 켜져있으면) 준비된 스킬을 자동으로 시전한다.
  for (const skillId of Object.keys(combat.skillCooldowns)) {
    if (combat.skillCooldowns[skillId] > 0) {
      combat.skillCooldowns[skillId] = Math.max(0, combat.skillCooldowns[skillId] - dtMs);
    }
  }
  if (combat.autoCastSkills) {
    for (const skill of getEquippedSkillDefs(state)) {
      if ((combat.skillCooldowns[skill.id] ?? 0) <= 0) {
        castSkill(state, skill.id, onEvent);
      }
    }
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

    applyDamageToPlayer(state, derived, monsterDamage, onEvent);
  }

  // 뒤에 쌓여있는 몬스터들도 각자의 타이밍으로 플레이어를 공격한다 - 처치가 늦어질수록 다:1로 두들겨 맞는다.
  for (const enemy of combat.extraEnemies) {
    if (combat.isRetreating) break;

    const enemyDef = getMonsterForLevel(enemy.level);
    enemy.attackElapsedMs += dtMs;
    if (enemy.attackElapsedMs < enemyDef.attackIntervalMs) continue;
    enemy.attackElapsedMs -= enemyDef.attackIntervalMs;

    applyDamageToPlayer(state, derived, enemyDef.attackDamage, onEvent);
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
