import { SKILL_CONFIG, SKILL_UNLOCK_LEVELS } from '../config/skillConfig.js';
import { getMasteryLevel } from './masterySystem.js';

export function getUnlockedSkillIds(state, masteryId) {
  return state.character.skills[masteryId]?.unlockedSkillIds ?? [];
}

export function getSkillDef(masteryId, skillId) {
  return SKILL_CONFIG[masteryId]?.find((s) => s.id === skillId) ?? null;
}

// 아직 선택하지 않은 스킬 해금 기회가 있으면 하나 반환한다 (레벨 5 -> 1번째, 레벨 15 -> 2번째).
// 여러 타입이 동시에 대기 중이면 masteryId 등록 순서대로 하나씩 처리한다.
export function getPendingSkillChoice(state) {
  for (const masteryId of Object.keys(SKILL_CONFIG)) {
    const level = getMasteryLevel(state, masteryId);
    const unlocked = getUnlockedSkillIds(state, masteryId);
    for (let i = 0; i < SKILL_UNLOCK_LEVELS.length; i += 1) {
      if (unlocked.length > i) continue;
      if (level < SKILL_UNLOCK_LEVELS[i]) break;
      const candidates = SKILL_CONFIG[masteryId].filter((s) => !unlocked.includes(s.id));
      return { masteryId, candidates };
    }
  }
  return null;
}

export function chooseSkill(state, masteryId, skillId) {
  const unlocked = state.character.skills[masteryId]?.unlockedSkillIds;
  if (!unlocked || unlocked.length >= SKILL_UNLOCK_LEVELS.length) return false;
  if (unlocked.includes(skillId)) return false;
  if (!getSkillDef(masteryId, skillId)) return false;
  unlocked.push(skillId);
  return true;
}

// 현재 장착된 무기/마법의 습득 스킬을 합쳐 최대 4개 반환한다 (무기 2 + 마법 2).
export function getEquippedSkillDefs(state) {
  const weaponSkills = getUnlockedSkillIds(state, state.combat.activeWeaponId)
    .map((skillId) => ({ masteryId: state.combat.activeWeaponId, ...getSkillDef(state.combat.activeWeaponId, skillId) }));
  const magicSkills = getUnlockedSkillIds(state, state.combat.activeMagicId)
    .map((skillId) => ({ masteryId: state.combat.activeMagicId, ...getSkillDef(state.combat.activeMagicId, skillId) }));
  return [...weaponSkills, ...magicSkills];
}
