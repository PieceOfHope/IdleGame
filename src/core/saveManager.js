import { RESOURCE_CONFIG } from '../config/resources.js';
import { UPGRADE_CONFIG } from '../config/upgrades.js';
import { GAME_CONFIG } from '../config/gameConfig.js';
import { STAT_CONFIG, CHARACTER_BALANCE } from '../config/characterConfig.js';
import { MASTERY_CONFIG } from '../config/masteryConfig.js';
import { getMonsterForLevel } from '../config/monsterConfig.js';
import { PERMANENT_UPGRADE_CONFIG } from '../config/permanentUpgradeConfig.js';
import { SKILL_CONFIG, SKILL_UNLOCK_LEVELS } from '../config/skillConfig.js';

const SAVE_KEY = 'idle_game_save_v1';
const CURRENT_VERSION = 6;

function createDefaultCharacterState() {
  const allocatedStatPoints = {};
  for (const stat of STAT_CONFIG) allocatedStatPoints[stat.id] = 0;

  const mastery = {};
  const skills = {};
  for (const masteryDef of MASTERY_CONFIG) {
    mastery[masteryDef.id] = { totalUses: 0 };
    skills[masteryDef.id] = { unlockedSkillIds: [] };
  }

  return { totalExp: 0, allocatedStatPoints, mastery, skills };
}

function createDefaultCombatState() {
  const monster = getMonsterForLevel(1);
  return {
    activeWeaponId: MASTERY_CONFIG.find((m) => m.category === 'physical').id,
    activeMagicId: MASTERY_CONFIG.find((m) => m.category === 'magic').id,
    skillCooldowns: {},
    autoCastSkills: true,
    enemyDamageTakenBonusPct: 0,
    enemyDamageTakenRemainingMs: 0,
    playerDamageReductionPct: 0,
    playerDamageReductionRemainingMs: 0,
    monsterLevel: 1,
    highestMonsterLevel: 1,
    farmingMode: false,
    monsterCurrentHp: monster.maxHp,
    playerCurrentHp: CHARACTER_BALANCE.baseHp,
    isRetreating: false,
    retreatRemainingMs: 0,
    playerAttackElapsedMs: 0,
    monsterAttackElapsedMs: 0,
    dotRemainingMs: 0,
    dotDamagePerSec: 0,
    monsterNextHitReductionPct: 0,
    pendingHeal: 0,
    extraEnemies: [],
    enemySpawnElapsedMs: 0,
  };
}

function createDefaultPermanentUpgradesState() {
  const permanentUpgrades = {};
  for (const upgradeDef of PERMANENT_UPGRADE_CONFIG) permanentUpgrades[upgradeDef.id] = { level: 0 };
  return permanentUpgrades;
}

function createDefaultState() {
  const resources = {};
  for (const [resourceId, def] of Object.entries(RESOURCE_CONFIG)) {
    resources[resourceId] = { amount: def.initialAmount ?? 0, totalEarned: 0 };
  }
  return {
    version: CURRENT_VERSION,
    lastSaveTimestamp: Date.now(),
    resources,
    upgrades: {},
    permanentUpgrades: createDefaultPermanentUpgradesState(),
    character: createDefaultCharacterState(),
    combat: createDefaultCombatState(),
    settings: {
      autoSaveIntervalMs: GAME_CONFIG.AUTO_SAVE_INTERVAL_MS,
      sfxEnabled: true,
    },
  };
}

// 향후 스키마가 바뀌면 여기에 버전별 변환 단계를 추가한다 (예: v2 -> v3).
function migrate(data) {
  const migrated = { ...data };
  if (!migrated.version) migrated.version = 1;
  migrated.version = CURRENT_VERSION;
  return migrated;
}

function normalizeState(data) {
  const state = createDefaultState();

  state.lastSaveTimestamp = typeof data.lastSaveTimestamp === 'number' ? data.lastSaveTimestamp : Date.now();
  if (state.lastSaveTimestamp > Date.now()) {
    console.warn('[SaveManager] 저장된 시간이 현재보다 미래입니다. 시간 조작 방지를 위해 현재 시각으로 보정합니다.');
    state.lastSaveTimestamp = Date.now();
  }

  for (const resourceId of Object.keys(state.resources)) {
    const saved = data.resources?.[resourceId];
    if (saved) {
      state.resources[resourceId].amount = Number(saved.amount) || 0;
      state.resources[resourceId].totalEarned = Number(saved.totalEarned) || 0;
    }
  }

  if (data.upgrades && typeof data.upgrades === 'object') {
    for (const upgradeDef of UPGRADE_CONFIG) {
      const saved = data.upgrades[upgradeDef.id];
      if (saved) state.upgrades[upgradeDef.id] = { level: Number(saved.level) || 0 };
    }
  }

  if (data.permanentUpgrades && typeof data.permanentUpgrades === 'object') {
    for (const upgradeDef of PERMANENT_UPGRADE_CONFIG) {
      const saved = data.permanentUpgrades[upgradeDef.id];
      if (saved) state.permanentUpgrades[upgradeDef.id] = { level: Number(saved.level) || 0 };
    }
  }

  // 구버전 세이브(v1/v2)에는 character/combat/permanentUpgrades 필드가 없다 - 위에서 만든 기본값이 그대로 채워진다.
  // v4 이하(스탯이 사용 횟수로 자동 성장하던 세이브)의 기존 스탯 진행도는 새 포인트 배분 체계와 맞지 않아 이어받지 않는다 -
  // totalExp/allocatedStatPoints는 항상 0부터 새로 쌓인다.
  if (data.character && typeof data.character === 'object') {
    if (data.character.allocatedStatPoints) {
      state.character.totalExp = Number(data.character.totalExp) || 0;
      for (const stat of STAT_CONFIG) {
        const saved = data.character.allocatedStatPoints[stat.id];
        state.character.allocatedStatPoints[stat.id] = Math.max(0, Math.floor(Number(saved) || 0));
      }
    }
    for (const masteryDef of MASTERY_CONFIG) {
      const saved = data.character.mastery?.[masteryDef.id];
      if (saved) state.character.mastery[masteryDef.id].totalUses = Number(saved.totalUses) || 0;

      const savedSkillIds = data.character.skills?.[masteryDef.id]?.unlockedSkillIds;
      if (Array.isArray(savedSkillIds)) {
        state.character.skills[masteryDef.id].unlockedSkillIds = savedSkillIds
          .filter((skillId) => SKILL_CONFIG[masteryDef.id].some((s) => s.id === skillId))
          .slice(0, SKILL_UNLOCK_LEVELS.length);
      }
    }
  }

  if (data.combat && typeof data.combat === 'object') {
    const savedCombat = data.combat;

    // v6+ : 무기/마법 슬롯이 각각 저장됨. v5 이하 : 단일 activeStyleId만 있었으므로,
    // 그게 무기였으면 무기 슬롯으로, 마법이었으면 마법 슬롯으로 이어받는다.
    if (MASTERY_CONFIG.some((m) => m.id === savedCombat.activeWeaponId && m.category === 'physical')) {
      state.combat.activeWeaponId = savedCombat.activeWeaponId;
    } else if (MASTERY_CONFIG.some((m) => m.id === savedCombat.activeStyleId && m.category === 'physical')) {
      state.combat.activeWeaponId = savedCombat.activeStyleId;
    }
    if (MASTERY_CONFIG.some((m) => m.id === savedCombat.activeMagicId && m.category === 'magic')) {
      state.combat.activeMagicId = savedCombat.activeMagicId;
    } else if (MASTERY_CONFIG.some((m) => m.id === savedCombat.activeStyleId && m.category === 'magic')) {
      state.combat.activeMagicId = savedCombat.activeStyleId;
    }

    if (typeof savedCombat.autoCastSkills === 'boolean') {
      state.combat.autoCastSkills = savedCombat.autoCastSkills;
    }
    if (savedCombat.skillCooldowns && typeof savedCombat.skillCooldowns === 'object') {
      const allSkillIds = new Set(Object.values(SKILL_CONFIG).flat().map((s) => s.id));
      for (const [skillId, remainingMs] of Object.entries(savedCombat.skillCooldowns)) {
        if (allSkillIds.has(skillId) && Number.isFinite(remainingMs) && remainingMs > 0) {
          state.combat.skillCooldowns[skillId] = remainingMs;
        }
      }
    }
    // 버프/디버프 잔여시간(약화·방어 버프)은 수명이 짧은 전투 중 상태라 마이그레이션/불러오기 시 항상 리셋한다.

    if (Number.isFinite(savedCombat.monsterLevel) && savedCombat.monsterLevel >= 1) {
      state.combat.monsterLevel = Math.floor(savedCombat.monsterLevel);
    }
    // 구버전 세이브(v3 이하)에는 highestMonsterLevel이 없다 - 당시엔 monsterLevel이 곧 최고 도달 레벨이었다.
    state.combat.highestMonsterLevel = Number.isFinite(savedCombat.highestMonsterLevel)
      ? Math.max(Math.floor(savedCombat.highestMonsterLevel), state.combat.monsterLevel)
      : state.combat.monsterLevel;
    state.combat.farmingMode = Boolean(savedCombat.farmingMode);
    state.combat.monsterCurrentHp = Number.isFinite(savedCombat.monsterCurrentHp)
      ? savedCombat.monsterCurrentHp
      : getMonsterForLevel(state.combat.monsterLevel).maxHp;
    state.combat.playerCurrentHp = Number.isFinite(savedCombat.playerCurrentHp)
      ? savedCombat.playerCurrentHp
      : CHARACTER_BALANCE.baseHp;
    state.combat.isRetreating = Boolean(savedCombat.isRetreating);
    state.combat.retreatRemainingMs = Number(savedCombat.retreatRemainingMs) || 0;
    state.combat.dotRemainingMs = Number(savedCombat.dotRemainingMs) || 0;
    state.combat.dotDamagePerSec = Number(savedCombat.dotDamagePerSec) || 0;
    state.combat.monsterNextHitReductionPct = Number(savedCombat.monsterNextHitReductionPct) || 0;
    state.combat.pendingHeal = Number(savedCombat.pendingHeal) || 0;
    state.combat.extraEnemies = Array.isArray(savedCombat.extraEnemies)
      ? savedCombat.extraEnemies
          .filter((enemy) => enemy && Number.isFinite(enemy.level) && enemy.level >= 1 && Number.isFinite(enemy.currentHp))
          .map((enemy) => ({
            level: Math.floor(enemy.level),
            currentHp: enemy.currentHp,
            attackElapsedMs: Number(enemy.attackElapsedMs) || 0,
          }))
      : [];
    state.combat.enemySpawnElapsedMs = Number(savedCombat.enemySpawnElapsedMs) || 0;
  }

  if (data.settings && typeof data.settings === 'object') {
    state.settings = { ...state.settings, ...data.settings };
  }

  return state;
}

export function load() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return createDefaultState();
  try {
    return normalizeState(migrate(JSON.parse(raw)));
  } catch (err) {
    console.warn('[SaveManager] 세이브 데이터를 불러오지 못했습니다. 새 게임을 시작합니다.', err);
    return createDefaultState();
  }
}

export function save(state) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function exportSave(state) {
  return JSON.stringify(state, null, 2);
}

export function importSave(jsonString) {
  try {
    return normalizeState(migrate(JSON.parse(jsonString)));
  } catch (err) {
    console.warn('[SaveManager] 가져오기에 실패했습니다.', err);
    return null;
  }
}

export function resetSave() {
  localStorage.removeItem(SAVE_KEY);
}
