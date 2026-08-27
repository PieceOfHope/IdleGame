import { formatNumber } from '../systems/resourceSystem.js';
import { isUnlocked, getBulkCost, getMaxAffordableQuantity } from '../systems/upgradeSystem.js';
import { getStatLevel, getStatUsesUntilNextLevel, getDerivedStats } from '../systems/characterSystem.js';
import { getMasteryLevel, getMasteryUsesUntilNextLevel } from '../systems/masterySystem.js';
import { getMonsterSnapshot } from '../systems/combatSystem.js';
import {
  getPermanentUpgradeLevel,
  getBulkCost as getPermanentBulkCost,
  getMaxAffordableQuantity as getPermanentMaxAffordableQuantity,
} from '../systems/permanentUpgradeSystem.js';

const LEGACY_TEMPLATE = `
  <button type="button" class="gather-btn" id="gather-btn">채집하기</button>
  <div class="buy-qty-selector" id="buy-qty-selector">
    <button type="button" class="qty-btn is-active" data-qty="1">x1</button>
    <button type="button" class="qty-btn" data-qty="10">x10</button>
    <button type="button" class="qty-btn" data-qty="100">x100</button>
    <button type="button" class="qty-btn" data-qty="max">MAX</button>
  </div>
  <section class="upgrade-list" id="upgrade-list"></section>
`;

export function initRenderer(container, {
  legacyProductionEnabled,
  upgradeConfig,
  statConfig,
  masteryConfig,
  permanentUpgradeConfig,
  onGather,
  onPurchase,
  onBuyQuantityChange,
  onStyleSelect,
  onPermanentPurchase,
  onPermanentBuyQuantityChange,
  onExport,
  onImport,
  onReset,
}) {
  container.innerHTML = `
    <div class="game">
      <header class="game__header"><h1>Idle Craft &amp; Odyssey</h1></header>

      <section class="resource-panel">
        <div class="resource-panel__amount" id="resource-amount">0</div>
        <div class="resource-panel__label">골드</div>
      </section>

      <section class="combat-panel">
        <div class="combat-entity">
          <div class="combat-entity__name" id="monster-name">몬스터 Lv.1</div>
          <div class="hp-bar"><div class="hp-bar__fill hp-bar__fill--monster" id="monster-hp-fill"></div></div>
          <div class="hp-bar__text" id="monster-hp-text">0 / 0</div>
        </div>
        <div class="combat-entity">
          <div class="combat-entity__name">플레이어</div>
          <div class="hp-bar"><div class="hp-bar__fill hp-bar__fill--player" id="player-hp-fill"></div></div>
          <div class="hp-bar__text" id="player-hp-text">0 / 0</div>
        </div>
        <div class="retreat-banner" id="retreat-banner" hidden>후퇴 중... 체력을 회복하고 있습니다</div>
        <ul class="combat-log" id="combat-log"></ul>
      </section>

      <section class="style-selector" id="style-selector"></section>

      <section class="stat-panel" id="stat-panel"></section>
      <section class="mastery-panel" id="mastery-panel"></section>

      <section class="permanent-upgrade-panel">
        <h2 class="panel-title">영구 강화</h2>
        <div class="buy-qty-selector" id="perm-buy-qty-selector">
          <button type="button" class="qty-btn is-active" data-qty="1">x1</button>
          <button type="button" class="qty-btn" data-qty="10">x10</button>
          <button type="button" class="qty-btn" data-qty="100">x100</button>
          <button type="button" class="qty-btn" data-qty="max">MAX</button>
        </div>
        <div class="upgrade-list" id="permanent-upgrade-list"></div>
      </section>

      ${legacyProductionEnabled ? LEGACY_TEMPLATE : ''}

      <footer class="save-controls">
        <button type="button" id="export-btn">내보내기</button>
        <button type="button" id="import-btn">가져오기</button>
        <button type="button" id="reset-btn">초기화</button>
      </footer>
    </div>
  `;

  const refs = {
    amountEl: container.querySelector('#resource-amount'),
    monsterNameEl: container.querySelector('#monster-name'),
    monsterHpFillEl: container.querySelector('#monster-hp-fill'),
    monsterHpTextEl: container.querySelector('#monster-hp-text'),
    playerHpFillEl: container.querySelector('#player-hp-fill'),
    playerHpTextEl: container.querySelector('#player-hp-text'),
    retreatBannerEl: container.querySelector('#retreat-banner'),
    combatLogEl: container.querySelector('#combat-log'),
    lastRenderedLogLength: -1,
    styleButtons: new Map(),
    statRows: new Map(),
    masteryRows: new Map(),
    legacy: null,
  };

  container.querySelector('#export-btn').addEventListener('click', onExport);
  container.querySelector('#import-btn').addEventListener('click', onImport);
  container.querySelector('#reset-btn').addEventListener('click', onReset);

  const styleSelectorEl = container.querySelector('#style-selector');
  for (const masteryDef of masteryConfig) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `style-btn style-btn--${masteryDef.category}`;
    btn.textContent = masteryDef.name;
    btn.addEventListener('click', () => onStyleSelect(masteryDef.id));
    styleSelectorEl.appendChild(btn);
    refs.styleButtons.set(masteryDef.id, btn);
  }

  const statPanelEl = container.querySelector('#stat-panel');
  for (const statDef of statConfig) {
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `
      <div class="stat-row__name">${statDef.name}</div>
      <div class="stat-row__level">Lv. <span class="level-value">0</span></div>
      <div class="stat-row__next">다음까지 <span class="next-value">-</span></div>
    `;
    statPanelEl.appendChild(row);
    refs.statRows.set(statDef.id, {
      levelEl: row.querySelector('.level-value'),
      nextEl: row.querySelector('.next-value'),
      lastRendered: {},
    });
  }

  const masteryPanelEl = container.querySelector('#mastery-panel');
  for (const masteryDef of masteryConfig) {
    const row = document.createElement('div');
    row.className = `mastery-row mastery-row--${masteryDef.category}`;
    row.innerHTML = `
      <div class="mastery-row__name">${masteryDef.name}</div>
      <div class="mastery-row__level">Lv. <span class="level-value">0</span></div>
      <div class="mastery-row__next">다음까지 <span class="next-value">-</span></div>
    `;
    masteryPanelEl.appendChild(row);
    refs.masteryRows.set(masteryDef.id, {
      levelEl: row.querySelector('.level-value'),
      nextEl: row.querySelector('.next-value'),
      lastRendered: {},
    });
  }

  const permQtySelector = container.querySelector('#perm-buy-qty-selector');
  permQtySelector.addEventListener('click', (event) => {
    const btn = event.target.closest('.qty-btn');
    if (!btn) return;
    permQtySelector.querySelectorAll('.qty-btn').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    onPermanentBuyQuantityChange(btn.dataset.qty === 'max' ? 'max' : Number(btn.dataset.qty));
  });

  const permanentUpgradeListEl = container.querySelector('#permanent-upgrade-list');
  const permanentUpgradeRows = new Map();
  for (const upgradeDef of permanentUpgradeConfig) {
    const row = document.createElement('div');
    row.className = 'upgrade-row';
    row.innerHTML = `
      <div class="upgrade-row__info">
        <div class="upgrade-row__name">${upgradeDef.name}</div>
        <div class="upgrade-row__desc">${upgradeDef.description}</div>
        <div class="upgrade-row__level">Lv. <span class="level-value">0</span></div>
      </div>
      <button type="button" class="upgrade-row__buy-btn">
        <span class="buy-label">구매</span>
        <span class="buy-cost">-</span>
      </button>
    `;
    const buyBtn = row.querySelector('.upgrade-row__buy-btn');
    buyBtn.addEventListener('click', () => onPermanentPurchase(upgradeDef.id));
    permanentUpgradeListEl.appendChild(row);
    permanentUpgradeRows.set(upgradeDef.id, {
      levelEl: row.querySelector('.level-value'),
      buyBtn,
      buyCostEl: row.querySelector('.buy-cost'),
      lastRendered: {},
    });
  }
  refs.permanentUpgradeRows = permanentUpgradeRows;

  if (legacyProductionEnabled) {
    const gatherBtn = container.querySelector('#gather-btn');
    const qtySelector = container.querySelector('#buy-qty-selector');
    const upgradeListEl = container.querySelector('#upgrade-list');

    gatherBtn.addEventListener('click', onGather);
    qtySelector.addEventListener('click', (event) => {
      const btn = event.target.closest('.qty-btn');
      if (!btn) return;
      qtySelector.querySelectorAll('.qty-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      onBuyQuantityChange(btn.dataset.qty === 'max' ? 'max' : Number(btn.dataset.qty));
    });

    const upgradeRows = new Map();
    for (const upgradeDef of upgradeConfig) {
      const row = document.createElement('div');
      row.className = 'upgrade-row';
      row.innerHTML = `
        <div class="upgrade-row__info">
          <div class="upgrade-row__name">${upgradeDef.name}</div>
          <div class="upgrade-row__desc">${upgradeDef.description}</div>
          <div class="upgrade-row__level">Lv. <span class="level-value">0</span></div>
        </div>
        <button type="button" class="upgrade-row__buy-btn">
          <span class="buy-label">구매</span>
          <span class="buy-cost">-</span>
        </button>
      `;
      const buyBtn = row.querySelector('.upgrade-row__buy-btn');
      buyBtn.addEventListener('click', () => onPurchase(upgradeDef.id));
      upgradeListEl.appendChild(row);
      upgradeRows.set(upgradeDef.id, {
        root: row,
        levelEl: row.querySelector('.level-value'),
        buyBtn,
        buyCostEl: row.querySelector('.buy-cost'),
        lastRendered: {},
      });
    }

    refs.legacy = { upgradeRows };
  }

  return refs;
}

export function renderResourceAmount(refs, state, primaryResourceId) {
  const amountText = formatNumber(state.resources[primaryResourceId].amount);
  if (refs.amountEl.textContent !== amountText) refs.amountEl.textContent = amountText;
}

export function renderCombatState(refs, state) {
  const monster = getMonsterSnapshot(state);
  const derived = getDerivedStats(state);

  const nameText = `${monster.name}`;
  if (refs.monsterNameEl.textContent !== nameText) refs.monsterNameEl.textContent = nameText;

  const monsterHp = Math.max(0, state.combat.monsterCurrentHp);
  const monsterHpPct = Math.max(0, Math.min(100, (monsterHp / monster.maxHp) * 100));
  refs.monsterHpFillEl.style.width = `${monsterHpPct}%`;
  refs.monsterHpTextEl.textContent = `${Math.ceil(monsterHp)} / ${monster.maxHp}`;

  const playerHp = Math.max(0, state.combat.playerCurrentHp);
  const playerHpPct = Math.max(0, Math.min(100, (playerHp / derived.maxHp) * 100));
  refs.playerHpFillEl.style.width = `${playerHpPct}%`;
  refs.playerHpTextEl.textContent = `${Math.ceil(playerHp)} / ${Math.round(derived.maxHp)}`;

  refs.retreatBannerEl.hidden = !state.combat.isRetreating;

  for (const [styleId, btn] of refs.styleButtons) {
    btn.classList.toggle('is-active', styleId === state.combat.activeStyleId);
  }
}

export function renderCombatLog(refs, logLines) {
  if (refs.lastRenderedLogLength === logLines.length) return;
  refs.lastRenderedLogLength = logLines.length;
  refs.combatLogEl.innerHTML = logLines.map((line) => `<li>${line}</li>`).join('');
}

export function renderStatPanel(refs, state, statConfig) {
  for (const statDef of statConfig) {
    const rowRefs = refs.statRows.get(statDef.id);
    const level = getStatLevel(state, statDef.id);
    if (rowRefs.lastRendered.level !== level) {
      rowRefs.levelEl.textContent = String(level);
      rowRefs.lastRendered.level = level;
    }
    const untilNext = getStatUsesUntilNextLevel(state, statDef.id);
    if (rowRefs.lastRendered.untilNext !== untilNext) {
      rowRefs.nextEl.textContent = String(Math.ceil(untilNext));
      rowRefs.lastRendered.untilNext = untilNext;
    }
  }
}

export function renderMasteryPanel(refs, state, masteryConfig) {
  for (const masteryDef of masteryConfig) {
    const rowRefs = refs.masteryRows.get(masteryDef.id);
    const level = getMasteryLevel(state, masteryDef.id);
    if (rowRefs.lastRendered.level !== level) {
      rowRefs.levelEl.textContent = String(level);
      rowRefs.lastRendered.level = level;
    }
    const untilNext = getMasteryUsesUntilNextLevel(state, masteryDef.id);
    if (rowRefs.lastRendered.untilNext !== untilNext) {
      rowRefs.nextEl.textContent = String(Math.ceil(untilNext));
      rowRefs.lastRendered.untilNext = untilNext;
    }
  }
}

export function renderPermanentUpgradePanel(refs, state, permanentUpgradeConfig, { buyQuantity }) {
  const goldAmount = state.resources.gold.amount;

  for (const upgradeDef of permanentUpgradeConfig) {
    const rowRefs = refs.permanentUpgradeRows.get(upgradeDef.id);
    const level = getPermanentUpgradeLevel(state, upgradeDef.id);
    if (rowRefs.lastRendered.level !== level) {
      rowRefs.levelEl.textContent = String(level);
      rowRefs.lastRendered.level = level;
    }

    const quantity = buyQuantity === 'max'
      ? Math.max(1, getPermanentMaxAffordableQuantity(upgradeDef, level, goldAmount))
      : buyQuantity;
    const cost = getPermanentBulkCost(upgradeDef, level, quantity);

    const costText = `x${quantity} · ${formatNumber(cost)}`;
    if (rowRefs.lastRendered.costText !== costText) {
      rowRefs.buyCostEl.textContent = costText;
      rowRefs.lastRendered.costText = costText;
    }

    const affordable = goldAmount >= cost;
    if (rowRefs.lastRendered.affordable !== affordable) {
      rowRefs.buyBtn.disabled = !affordable;
      rowRefs.lastRendered.affordable = affordable;
    }
  }
}

export function renderLegacyState(refs, state, upgradeConfig, resourceConfig, { rps, buyQuantity }) {
  if (!refs.legacy) return;

  for (const upgradeDef of upgradeConfig) {
    const rowRefs = refs.legacy.upgradeRows.get(upgradeDef.id);
    const unlocked = isUnlocked(state, upgradeDef);

    if (!unlocked) {
      if (rowRefs.lastRendered.locked !== true) {
        rowRefs.root.classList.add('is-locked');
        rowRefs.levelEl.textContent = '???';
        rowRefs.buyCostEl.textContent = `Lv.${upgradeDef.requiresUpgrade.level} 필요`;
        rowRefs.buyBtn.disabled = true;
        rowRefs.lastRendered = { locked: true };
      }
      continue;
    }
    if (rowRefs.lastRendered.locked !== false) {
      rowRefs.root.classList.remove('is-locked');
      rowRefs.lastRendered.locked = false;
    }

    const level = state.upgrades[upgradeDef.id]?.level ?? 0;
    if (rowRefs.lastRendered.level !== level) {
      rowRefs.levelEl.textContent = String(level);
      rowRefs.lastRendered.level = level;
    }

    const resourceAmount = state.resources[upgradeDef.resourceId].amount;
    const quantity = buyQuantity === 'max'
      ? Math.max(1, getMaxAffordableQuantity(upgradeDef, level, resourceAmount))
      : buyQuantity;
    const cost = getBulkCost(upgradeDef, level, quantity);

    const costText = `x${quantity} · ${formatNumber(cost)}`;
    if (rowRefs.lastRendered.costText !== costText) {
      rowRefs.buyCostEl.textContent = costText;
      rowRefs.lastRendered.costText = costText;
    }

    const affordable = resourceAmount >= cost;
    if (rowRefs.lastRendered.affordable !== affordable) {
      rowRefs.buyBtn.disabled = !affordable;
      rowRefs.lastRendered.affordable = affordable;
    }
  }
}
