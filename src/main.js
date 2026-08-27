import '../css/style.css';
import { RESOURCE_CONFIG } from './config/resources.js';
import { UPGRADE_CONFIG } from './config/upgrades.js';
import { GAME_CONFIG } from './config/gameConfig.js';
import { STAT_CONFIG } from './config/characterConfig.js';
import { MASTERY_CONFIG } from './config/masteryConfig.js';
import { PERMANENT_UPGRADE_CONFIG } from './config/permanentUpgradeConfig.js';
import * as SaveManager from './core/saveManager.js';
import * as TimeEngine from './core/timeEngine.js';
import { createGameLoop } from './core/gameLoop.js';
import * as ResourceSystem from './systems/resourceSystem.js';
import * as UpgradeSystem from './systems/upgradeSystem.js';
import * as PermanentUpgradeSystem from './systems/permanentUpgradeSystem.js';
import { getDerivedStats } from './systems/characterSystem.js';
import { advanceCombat, setActiveStyle } from './systems/combatSystem.js';
import * as Renderer from './ui/renderer.js';
import * as Modal from './ui/modal.js';

const appRoot = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
const primaryResourceId = Object.keys(RESOURCE_CONFIG)[0];

const state = SaveManager.load();
let buyQuantity = 1;
let permanentBuyQuantity = 1;

const combatLog = [];
const COMBAT_LOG_MAX_LINES = 6;

function pushCombatLog(line) {
  combatLog.unshift(line);
  if (combatLog.length > COMBAT_LOG_MAX_LINES) combatLog.length = COMBAT_LOG_MAX_LINES;
}

function handleCombatEvent(event) {
  switch (event.type) {
    case 'player-attack':
      pushCombatLog(`플레이어의 공격! ${Math.ceil(event.damage)} 데미지`);
      break;
    case 'monster-defeated':
      pushCombatLog(`몬스터 Lv.${event.level} 처치! 골드 +${event.reward}`);
      break;
    case 'monster-attack':
      pushCombatLog(`몬스터의 반격! ${event.damage} 데미지`);
      break;
    case 'player-retreat':
      pushCombatLog('체력이 다해 후퇴합니다...');
      break;
    case 'retreat-end':
      pushCombatLog('전열을 정비하고 다시 전투를 시작합니다.');
      break;
  }
}

function computeLegacyRPS() {
  return ResourceSystem.getRPS(state, UPGRADE_CONFIG);
}

function applyOfflineProgressIfNeeded() {
  const nowTs = TimeEngine.now();
  const deltaSeconds = TimeEngine.getDeltaSeconds(state.lastSaveTimestamp, nowTs);

  if (deltaSeconds < GAME_CONFIG.OFFLINE_MIN_THRESHOLD_SECONDS) {
    state.lastSaveTimestamp = nowTs;
    return;
  }

  if (GAME_CONFIG.LEGACY_PRODUCTION_ENABLED) {
    const { effectiveTime, earnedByResource } = TimeEngine.computeOfflineProgress({
      deltaSeconds,
      maxOfflineCapSeconds: GAME_CONFIG.MAX_OFFLINE_CAP_SECONDS,
      offlineEfficiency: GAME_CONFIG.OFFLINE_EFFICIENCY,
      currentRPS: computeLegacyRPS(),
    });
    for (const [resourceId, amount] of Object.entries(earnedByResource)) {
      ResourceSystem.addResource(state, resourceId, amount);
    }
    const hasEarnings = Object.values(earnedByResource).some((amount) => amount > 0);
    if (hasEarnings) {
      Modal.showOfflineRewardModal(modalRoot, {
        effectiveTimeSeconds: effectiveTime,
        earnedByResource,
        resourceConfig: RESOURCE_CONFIG,
      });
    }
  } else {
    // 몬스터 처치는 오프라인 중 시뮬레이션하지 않고, 체력만 회복시킨다 (Document/GameBalance.md 5.4절).
    const effectiveTime = Math.min(deltaSeconds, GAME_CONFIG.MAX_OFFLINE_CAP_SECONDS);
    if (!state.combat.isRetreating) {
      const derived = getDerivedStats(state);
      state.combat.playerCurrentHp = Math.min(
        derived.maxHp,
        state.combat.playerCurrentHp + derived.hpRegenPerSec * effectiveTime,
      );
    }
  }

  state.lastSaveTimestamp = nowTs;
}

applyOfflineProgressIfNeeded();

const refs = Renderer.initRenderer(appRoot, {
  legacyProductionEnabled: GAME_CONFIG.LEGACY_PRODUCTION_ENABLED,
  upgradeConfig: UPGRADE_CONFIG,
  statConfig: STAT_CONFIG,
  masteryConfig: MASTERY_CONFIG,
  permanentUpgradeConfig: PERMANENT_UPGRADE_CONFIG,
  onGather: () => {
    ResourceSystem.addResource(state, GAME_CONFIG.GATHER_RESOURCE_ID, GAME_CONFIG.GATHER_AMOUNT);
  },
  onPurchase: (upgradeId) => {
    const upgradeDef = UPGRADE_CONFIG.find((u) => u.id === upgradeId);
    if (!upgradeDef || !UpgradeSystem.isUnlocked(state, upgradeDef)) return;

    const level = state.upgrades[upgradeDef.id]?.level ?? 0;
    const resourceAmount = state.resources[upgradeDef.resourceId].amount;
    const quantity = buyQuantity === 'max'
      ? UpgradeSystem.getMaxAffordableQuantity(upgradeDef, level, resourceAmount)
      : buyQuantity;

    if (quantity <= 0) return;
    UpgradeSystem.purchaseUpgrade(state, upgradeDef, quantity);
  },
  onBuyQuantityChange: (qty) => {
    buyQuantity = qty;
  },
  onStyleSelect: (styleId) => {
    setActiveStyle(state, styleId);
  },
  onPermanentPurchase: (upgradeId) => {
    const upgradeDef = PERMANENT_UPGRADE_CONFIG.find((u) => u.id === upgradeId);
    if (!upgradeDef) return;

    const level = PermanentUpgradeSystem.getPermanentUpgradeLevel(state, upgradeDef.id);
    const goldAmount = state.resources.gold.amount;
    const quantity = permanentBuyQuantity === 'max'
      ? PermanentUpgradeSystem.getMaxAffordableQuantity(upgradeDef, level, goldAmount)
      : permanentBuyQuantity;

    if (quantity <= 0) return;
    PermanentUpgradeSystem.purchasePermanentUpgrade(state, upgradeDef, quantity);
  },
  onPermanentBuyQuantityChange: (qty) => {
    permanentBuyQuantity = qty;
  },
  onExport: () => {
    Modal.showExportModal(modalRoot, SaveManager.exportSave(state));
  },
  onImport: () => {
    Modal.showImportModal(modalRoot, {
      onConfirm: (jsonString) => {
        const imported = SaveManager.importSave(jsonString);
        if (!imported) {
          window.alert('가져오기 실패: 올바르지 않은 저장 데이터입니다.');
          return;
        }
        SaveManager.save(imported);
        window.location.reload();
      },
    });
  },
  onReset: () => {
    Modal.showResetConfirmModal(modalRoot, {
      onConfirm: () => {
        SaveManager.resetSave();
        window.location.reload();
      },
    });
  },
});

const loop = createGameLoop({
  tickMs: GAME_CONFIG.TICK_MS,
  onTick: (dtSeconds) => {
    if (GAME_CONFIG.LEGACY_PRODUCTION_ENABLED) {
      const rps = computeLegacyRPS();
      for (const [resourceId, value] of Object.entries(rps)) {
        ResourceSystem.addResource(state, resourceId, value * dtSeconds);
      }
    }
    advanceCombat(state, dtSeconds * 1000, handleCombatEvent);
  },
  onRender: () => {
    Renderer.renderResourceAmount(refs, state, primaryResourceId);
    Renderer.renderCombatState(refs, state);
    Renderer.renderCombatLog(refs, combatLog);
    Renderer.renderStatPanel(refs, state, STAT_CONFIG);
    Renderer.renderMasteryPanel(refs, state, MASTERY_CONFIG);
    Renderer.renderPermanentUpgradePanel(refs, state, PERMANENT_UPGRADE_CONFIG, { buyQuantity: permanentBuyQuantity });
    if (GAME_CONFIG.LEGACY_PRODUCTION_ENABLED) {
      Renderer.renderLegacyState(refs, state, UPGRADE_CONFIG, RESOURCE_CONFIG, {
        rps: computeLegacyRPS(),
        buyQuantity,
      });
    }
  },
});
loop.start();

setInterval(() => {
  state.lastSaveTimestamp = TimeEngine.now();
  SaveManager.save(state);
}, state.settings.autoSaveIntervalMs);

window.addEventListener('beforeunload', () => {
  state.lastSaveTimestamp = TimeEngine.now();
  SaveManager.save(state);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    state.lastSaveTimestamp = TimeEngine.now();
    SaveManager.save(state);
  } else {
    applyOfflineProgressIfNeeded();
    loop.resetClock();
  }
});
