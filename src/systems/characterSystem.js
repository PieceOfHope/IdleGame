import { levelFromUsage, usesUntilNextLevel } from './masteryCurve.js';
import { STAT_LEVEL_COEFFICIENT, CHARACTER_BALANCE } from '../config/characterConfig.js';
import { PERMANENT_UPGRADE_CONFIG } from '../config/permanentUpgradeConfig.js';
import { getPermanentUpgradeLevel } from './permanentUpgradeSystem.js';

function getPermanentBonus(state, upgradeId) {
  const def = PERMANENT_UPGRADE_CONFIG.find((u) => u.id === upgradeId);
  if (!def) return 0;
  return getPermanentUpgradeLevel(state, upgradeId) * def.bonusPerLevel;
}

export function getStatLevel(state, statId) {
  return levelFromUsage(state.character.stats[statId]?.totalUses ?? 0, STAT_LEVEL_COEFFICIENT);
}

export function getStatUsesUntilNextLevel(state, statId) {
  return usesUntilNextLevel(state.character.stats[statId]?.totalUses ?? 0, STAT_LEVEL_COEFFICIENT);
}

export function addStatUsage(state, statId, amount = 1) {
  const stat = state.character.stats[statId];
  if (!stat) return;
  stat.totalUses += amount;
}

export function getDerivedStats(state) {
  const vitLevel = getStatLevel(state, 'vit');
  const recoveryLevel = getStatLevel(state, 'recovery');
  const agiLevel = getStatLevel(state, 'agi');

  return {
    maxHp: CHARACTER_BALANCE.baseHp + vitLevel * CHARACTER_BALANCE.hpPerVitLevel + getPermanentBonus(state, 'maxHp'),
    hpRegenPerSec:
      CHARACTER_BALANCE.baseRegenPerSec
      + recoveryLevel * CHARACTER_BALANCE.regenPerRecoveryLevel
      + getPermanentBonus(state, 'hpRegen'),
    attackIntervalMs: Math.max(
      CHARACTER_BALANCE.minAttackIntervalMs,
      CHARACTER_BALANCE.baseAttackIntervalMs / (1 + agiLevel * CHARACTER_BALANCE.agiSpeedPerLevel),
    ),
  };
}

export function getPhysicalDamage(state, masteryMultiplier) {
  const strLevel = getStatLevel(state, 'str');
  const attackPowerMultiplier = 1 + getPermanentBonus(state, 'attackPower');
  return CHARACTER_BALANCE.baseWeaponDamage
    * (1 + strLevel * CHARACTER_BALANCE.strDamagePerLevel)
    * masteryMultiplier
    * attackPowerMultiplier;
}

export function getMagicDamage(state, masteryMultiplier) {
  const intLevel = getStatLevel(state, 'int');
  const attackPowerMultiplier = 1 + getPermanentBonus(state, 'attackPower');
  return CHARACTER_BALANCE.baseSpellPower
    * (1 + intLevel * CHARACTER_BALANCE.intDamagePerLevel)
    * masteryMultiplier
    * attackPowerMultiplier;
}
