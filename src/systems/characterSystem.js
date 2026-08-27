import { levelFromUsage, usageRequiredForLevel } from './masteryCurve.js';
import { STAT_CONFIG, CHARACTER_LEVEL_COEFFICIENT, STAT_POINTS_PER_LEVEL, CHARACTER_BALANCE } from '../config/characterConfig.js';
import { PERMANENT_UPGRADE_CONFIG } from '../config/permanentUpgradeConfig.js';
import { getPermanentUpgradeLevel } from './permanentUpgradeSystem.js';

function getPermanentBonus(state, upgradeId) {
  const def = PERMANENT_UPGRADE_CONFIG.find((u) => u.id === upgradeId);
  if (!def) return 0;
  return getPermanentUpgradeLevel(state, upgradeId) * def.bonusPerLevel;
}

// 힘/민첩성/지력/체력/회복력은 "숙련도"가 아니라 "스탯"이라 사용 횟수로 자동 성장하지 않는다.
// 캐릭터 레벨업 시 지급되는 포인트를 플레이어가 직접 배분(증가/재분배)한다.
export function getCharacterLevel(state) {
  return levelFromUsage(state.character.totalExp, CHARACTER_LEVEL_COEFFICIENT);
}

export function getCharacterExpUntilNextLevel(state) {
  const currentLevel = getCharacterLevel(state);
  return Math.max(0, Math.ceil(usageRequiredForLevel(currentLevel + 1, CHARACTER_LEVEL_COEFFICIENT) - state.character.totalExp));
}

// 현재 레벨 구간 안에서의 진행률 (0..1) - EXP 바 표시용.
export function getCharacterExpProgressPct(state) {
  const currentLevel = getCharacterLevel(state);
  const expForCurrentLevel = usageRequiredForLevel(currentLevel, CHARACTER_LEVEL_COEFFICIENT);
  const expForNextLevel = usageRequiredForLevel(currentLevel + 1, CHARACTER_LEVEL_COEFFICIENT);
  const span = expForNextLevel - expForCurrentLevel;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (state.character.totalExp - expForCurrentLevel) / span));
}

export function addCharacterExp(state, amount) {
  state.character.totalExp += amount;
}

function getTotalAllocatedPoints(state) {
  return STAT_CONFIG.reduce((sum, statDef) => sum + (state.character.allocatedStatPoints[statDef.id] ?? 0), 0);
}

export function getUnspentStatPoints(state) {
  return Math.max(0, getCharacterLevel(state) * STAT_POINTS_PER_LEVEL - getTotalAllocatedPoints(state));
}

export function getStatLevel(state, statId) {
  return state.character.allocatedStatPoints[statId] ?? 0;
}

export function allocateStatPoint(state, statId) {
  if (getUnspentStatPoints(state) <= 0) return;
  if (!(statId in state.character.allocatedStatPoints)) return;
  state.character.allocatedStatPoints[statId] += 1;
}

export function deallocateStatPoint(state, statId) {
  const current = state.character.allocatedStatPoints[statId] ?? 0;
  if (current <= 0) return;
  state.character.allocatedStatPoints[statId] -= 1;
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

// 스탯 패널 옆에 표시할 요약 수치 - 숙련도 배율은 빼고(=1) 스탯만으로 나오는 기본값을 보여준다.
export function getStatPreview(state) {
  const derived = getDerivedStats(state);
  return {
    physicalDamage: getPhysicalDamage(state, 1),
    magicDamage: getMagicDamage(state, 1),
    attacksPerSec: 1000 / derived.attackIntervalMs,
    maxHp: derived.maxHp,
    hpRegenPerSec: derived.hpRegenPerSec,
  };
}
