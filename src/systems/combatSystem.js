import { getMonsterForLevel } from '../config/monsterConfig.js';
import { MASTERY_CONFIG } from '../config/masteryConfig.js';
import { RETREAT_DURATION_MS } from '../config/characterConfig.js';
import { getDerivedStats, getPhysicalDamage, getMagicDamage, addStatUsage } from './characterSystem.js';
import { getMasteryDamageMultiplier, addMasteryUsage } from './masterySystem.js';
import { addResource } from './resourceSystem.js';

function getActiveStyleDef(state) {
  return MASTERY_CONFIG.find((m) => m.id === state.combat.activeStyleId) ?? MASTERY_CONFIG[0];
}

function getPlayerAttackDamage(state, styleDef) {
  const masteryMultiplier = getMasteryDamageMultiplier(state, styleDef);
  return styleDef.category === 'physical'
    ? getPhysicalDamage(state, masteryMultiplier)
    : getMagicDamage(state, masteryMultiplier);
}

export function setActiveStyle(state, styleId) {
  if (!MASTERY_CONFIG.some((m) => m.id === styleId)) return;
  state.combat.activeStyleId = styleId;
}

export function getMonsterSnapshot(state) {
  return getMonsterForLevel(state.combat.monsterLevel);
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
      onEvent({ type: 'retreat-end' });
    }
    return;
  }

  if (combat.playerCurrentHp < derived.maxHp) {
    combat.playerCurrentHp = Math.min(derived.maxHp, combat.playerCurrentHp + derived.hpRegenPerSec * dtSeconds);
    addStatUsage(state, 'recovery', dtSeconds);
  }

  const styleDef = getActiveStyleDef(state);

  combat.playerAttackElapsedMs += dtMs;
  if (combat.playerAttackElapsedMs >= derived.attackIntervalMs) {
    combat.playerAttackElapsedMs -= derived.attackIntervalMs;

    const damage = getPlayerAttackDamage(state, styleDef);
    combat.monsterCurrentHp -= damage;
    addMasteryUsage(state, styleDef.id, 1);
    addStatUsage(state, styleDef.category === 'physical' ? 'str' : 'int', 1);
    addStatUsage(state, 'agi', 1);
    onEvent({ type: 'player-attack', damage, styleId: styleDef.id });

    if (combat.monsterCurrentHp <= 0) {
      const defeatedMonster = getMonsterForLevel(combat.monsterLevel);
      addResource(state, 'gold', defeatedMonster.goldReward);
      onEvent({ type: 'monster-defeated', level: combat.monsterLevel, reward: defeatedMonster.goldReward });

      combat.monsterLevel += 1;
      combat.monsterCurrentHp = getMonsterForLevel(combat.monsterLevel).maxHp;
      combat.monsterAttackElapsedMs = 0;
      return;
    }
  }

  const monster = getMonsterForLevel(combat.monsterLevel);
  combat.monsterAttackElapsedMs += dtMs;
  if (combat.monsterAttackElapsedMs >= monster.attackIntervalMs) {
    combat.monsterAttackElapsedMs -= monster.attackIntervalMs;

    combat.playerCurrentHp -= monster.attackDamage;
    addStatUsage(state, 'vit', 1);
    onEvent({ type: 'monster-attack', damage: monster.attackDamage });

    if (combat.playerCurrentHp <= 0) {
      // 후퇴하며 즉시 최대 체력으로 회복 - 전투는 retreatRemainingMs 동안만 멈춘다 (진행도 손실 없음).
      combat.playerCurrentHp = derived.maxHp;
      combat.isRetreating = true;
      combat.retreatRemainingMs = RETREAT_DURATION_MS;
      onEvent({ type: 'player-retreat' });
    }
  }
}
