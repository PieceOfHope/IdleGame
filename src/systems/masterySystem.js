import { levelFromUsage, usesUntilNextLevel } from './masteryCurve.js';
import { MASTERY_LEVEL_COEFFICIENT } from '../config/masteryConfig.js';

export function getMasteryLevel(state, masteryId) {
  return levelFromUsage(state.character.mastery[masteryId]?.totalUses ?? 0, MASTERY_LEVEL_COEFFICIENT);
}

export function getMasteryUsesUntilNextLevel(state, masteryId) {
  return usesUntilNextLevel(state.character.mastery[masteryId]?.totalUses ?? 0, MASTERY_LEVEL_COEFFICIENT);
}

export function addMasteryUsage(state, masteryId, amount = 1) {
  const mastery = state.character.mastery[masteryId];
  if (!mastery) return;
  mastery.totalUses += amount;
}

export function getMasteryDamageMultiplier(state, masteryDef) {
  const level = getMasteryLevel(state, masteryDef.id);
  return 1 + level * masteryDef.bonusPerLevel;
}
