import { RESOURCE_CONFIG } from '../config/resources.js';
import { GAME_CONFIG } from '../config/gameConfig.js';
import { STAT_CONFIG, CHARACTER_BALANCE } from '../config/characterConfig.js';
import { MASTERY_CONFIG } from '../config/masteryConfig.js';
import { getMonsterForLevel } from '../config/monsterConfig.js';
import { PERMANENT_UPGRADE_CONFIG } from '../config/permanentUpgradeConfig.js';

const SAVE_KEY = 'idle_game_save_v1';
const CURRENT_VERSION = 3;

function createDefaultCharacterState() {
  const stats = {};
  for (const stat of STAT_CONFIG) stats[stat.id] = { totalUses: 0 };

  const mastery = {};
  for (const masteryDef of MASTERY_CONFIG) mastery[masteryDef.id] = { totalUses: 0 };

  return { stats, mastery };
}

function createDefaultCombatState() {
  const monster = getMonsterForLevel(1);
  return {
    activeStyleId: MASTERY_CONFIG[0].id,
    monsterLevel: 1,
    monsterCurrentHp: monster.maxHp,
    playerCurrentHp: CHARACTER_BALANCE.baseHp,
    isRetreating: false,
    retreatRemainingMs: 0,
    playerAttackElapsedMs: 0,
    monsterAttackElapsedMs: 0,
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
    for (const [upgradeId, upgradeData] of Object.entries(data.upgrades)) {
      state.upgrades[upgradeId] = { level: Number(upgradeData?.level) || 0 };
    }
  }

  if (data.permanentUpgrades && typeof data.permanentUpgrades === 'object') {
    for (const upgradeDef of PERMANENT_UPGRADE_CONFIG) {
      const saved = data.permanentUpgrades[upgradeDef.id];
      if (saved) state.permanentUpgrades[upgradeDef.id] = { level: Number(saved.level) || 0 };
    }
  }

  // 구버전 세이브(v1/v2)에는 character/combat/permanentUpgrades 필드가 없다 - 위에서 만든 기본값이 그대로 채워진다.
  if (data.character && typeof data.character === 'object') {
    for (const stat of STAT_CONFIG) {
      const saved = data.character.stats?.[stat.id];
      if (saved) state.character.stats[stat.id].totalUses = Number(saved.totalUses) || 0;
    }
    for (const masteryDef of MASTERY_CONFIG) {
      const saved = data.character.mastery?.[masteryDef.id];
      if (saved) state.character.mastery[masteryDef.id].totalUses = Number(saved.totalUses) || 0;
    }
  }

  if (data.combat && typeof data.combat === 'object') {
    const savedCombat = data.combat;
    if (MASTERY_CONFIG.some((m) => m.id === savedCombat.activeStyleId)) {
      state.combat.activeStyleId = savedCombat.activeStyleId;
    }
    if (Number.isFinite(savedCombat.monsterLevel) && savedCombat.monsterLevel >= 1) {
      state.combat.monsterLevel = Math.floor(savedCombat.monsterLevel);
    }
    state.combat.monsterCurrentHp = Number.isFinite(savedCombat.monsterCurrentHp)
      ? savedCombat.monsterCurrentHp
      : getMonsterForLevel(state.combat.monsterLevel).maxHp;
    state.combat.playerCurrentHp = Number.isFinite(savedCombat.playerCurrentHp)
      ? savedCombat.playerCurrentHp
      : CHARACTER_BALANCE.baseHp;
    state.combat.isRetreating = Boolean(savedCombat.isRetreating);
    state.combat.retreatRemainingMs = Number(savedCombat.retreatRemainingMs) || 0;
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
