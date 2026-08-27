import { formatNumber } from '../systems/resourceSystem.js';
import { isUnlocked, getBulkCost, getMaxAffordableQuantity } from '../systems/upgradeSystem.js';
import {
  getStatLevel,
  getDerivedStats,
  getCharacterLevel,
  getCharacterExpProgressPct,
  getUnspentStatPoints,
  getStatPreview,
} from '../systems/characterSystem.js';
import { getMasteryLevel, getMasteryUsesUntilNextLevel } from '../systems/masterySystem.js';
import { getMonsterSnapshot } from '../systems/combatSystem.js';
import {
  getPermanentUpgradeLevel,
  isPermanentUpgradeUnlocked,
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
  onFarmingToggle,
  onStatIncrease,
  onStatDecrease,
  onPermanentPurchase,
  onPermanentBuyQuantityChange,
  onExport,
  onImport,
  onReset,
}) {
  container.innerHTML = `
    <div class="game">
     <div class="game__col1">
      <header class="game__header"><h1>Idle Craft &amp; Odyssey</h1></header>

      <section class="resource-panel">
        <div class="resource-panel__amount" id="resource-amount">0</div>
        <div class="resource-panel__label">골드</div>
      </section>

      <section class="battle-screen">
        <div class="stage-bar">
          <div class="stage-label" id="stage-label">몬스터 Lv.1</div>
          <div class="stage-progress">
            <div class="stage-progress__line"></div>
            <div class="stage-progress__checkpoint"></div>
            <div class="stage-progress__checkpoint"></div>
            <div class="stage-progress__checkpoint stage-progress__checkpoint--current"></div>
          </div>
        </div>

        <div class="battlefield" id="battlefield">
          <canvas id="battlefield-canvas"></canvas>
        </div>

        <div class="retreat-banner" id="retreat-banner" hidden>후퇴 중... 체력을 회복하고 있습니다</div>

        <footer class="control-bar">
          <button type="button" class="ctrl-btn ctrl-btn--auto" id="farming-toggle-btn">자동<br>꺼짐</button>
          <button type="button" class="ctrl-btn ctrl-btn--skill" data-toggle>🔥</button>
          <button type="button" class="ctrl-btn ctrl-btn--skill" data-toggle>🛡️</button>
          <button type="button" class="ctrl-btn ctrl-btn--skill" data-toggle>🏹</button>
        </footer>

        <ul class="combat-log" id="combat-log"></ul>
      </section>
     </div>

     <div class="game__col2">
      <h2 class="panel-title">전투 스타일 <span class="panel-title__hint">(선택 시 자동 성장)</span></h2>
      <section class="mastery-panel" id="mastery-panel"></section>
     </div>

     <div class="game__col3">
      <section class="character-level-panel">
        <div class="character-level-panel__level">캐릭터 Lv. <span id="character-level">0</span></div>
        <div class="character-level-panel__exp-bar"><div class="character-level-panel__exp-fill" id="character-exp-fill"></div></div>
        <div class="character-level-panel__points">배분 가능 포인트: <span id="unspent-points">0</span></div>
      </section>

      <section class="derived-stats-panel" id="derived-stats-panel">
        <div class="derived-stat" data-stat="physical">
          <div class="derived-stat__label">물리 공격력</div>
          <div class="derived-stat__value" id="derived-physical">0</div>
        </div>
        <div class="derived-stat" data-stat="magic">
          <div class="derived-stat__label">마법 공격력</div>
          <div class="derived-stat__value" id="derived-magic">0</div>
        </div>
        <div class="derived-stat" data-stat="attackSpeed">
          <div class="derived-stat__label">공격 속도</div>
          <div class="derived-stat__value" id="derived-attack-speed">0/초</div>
        </div>
        <div class="derived-stat" data-stat="maxHp">
          <div class="derived-stat__label">최대 체력</div>
          <div class="derived-stat__value" id="derived-max-hp">0</div>
        </div>
        <div class="derived-stat" data-stat="regen">
          <div class="derived-stat__label">체력 회복</div>
          <div class="derived-stat__value" id="derived-regen">0/초</div>
        </div>
      </section>

      <section class="stat-panel" id="stat-panel"></section>

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
    </div>
  `;

  const refs = {
    amountEl: container.querySelector('#resource-amount'),
    stageLabelEl: container.querySelector('#stage-label'),
    battlefieldCanvasEl: container.querySelector('#battlefield-canvas'),
    retreatBannerEl: container.querySelector('#retreat-banner'),
    farmingToggleBtn: container.querySelector('#farming-toggle-btn'),
    combatLogEl: container.querySelector('#combat-log'),
    lastRenderedLogKey: null,
    characterLevelEl: container.querySelector('#character-level'),
    characterExpFillEl: container.querySelector('#character-exp-fill'),
    unspentPointsEl: container.querySelector('#unspent-points'),
    derivedPhysicalEl: container.querySelector('#derived-physical'),
    derivedMagicEl: container.querySelector('#derived-magic'),
    derivedAttackSpeedEl: container.querySelector('#derived-attack-speed'),
    derivedMaxHpEl: container.querySelector('#derived-max-hp'),
    derivedRegenEl: container.querySelector('#derived-regen'),
    statRows: new Map(),
    masteryRows: new Map(),
    legacy: null,
  };

  refs.farmingToggleBtn.addEventListener('click', onFarmingToggle);

  container.querySelectorAll('.ctrl-btn--skill[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => btn.classList.toggle('is-active'));
  });

  container.querySelector('#export-btn').addEventListener('click', onExport);
  container.querySelector('#import-btn').addEventListener('click', onImport);
  container.querySelector('#reset-btn').addEventListener('click', onReset);

  const statPanelEl = container.querySelector('#stat-panel');
  for (const statDef of statConfig) {
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.title = statDef.hint ?? '';
    row.innerHTML = `
      <div class="stat-row__name">${statDef.name} <span class="level-value">0</span></div>
      <div class="stat-row__points">
        <button type="button" class="stat-point-btn stat-point-btn--minus">-</button>
        <button type="button" class="stat-point-btn stat-point-btn--plus">+</button>
      </div>
    `;
    const minusBtn = row.querySelector('.stat-point-btn--minus');
    const plusBtn = row.querySelector('.stat-point-btn--plus');
    minusBtn.addEventListener('click', () => onStatDecrease(statDef.id));
    plusBtn.addEventListener('click', () => onStatIncrease(statDef.id));
    statPanelEl.appendChild(row);
    refs.statRows.set(statDef.id, {
      levelEl: row.querySelector('.level-value'),
      minusBtn,
      plusBtn,
      lastRendered: {},
    });
  }

  const masteryPanelEl = container.querySelector('#mastery-panel');
  for (const masteryDef of masteryConfig) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `mastery-row mastery-row--${masteryDef.category}`;
    row.innerHTML = `
      <div class="mastery-row__name">${masteryDef.name}</div>
      <div class="mastery-row__level">Lv. <span class="level-value">0</span></div>
      <div class="mastery-row__next">다음까지 <span class="next-value">-</span></div>
    `;
    row.addEventListener('click', () => onStyleSelect(masteryDef.id));
    masteryPanelEl.appendChild(row);
    refs.masteryRows.set(masteryDef.id, {
      root: row,
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
    row.title = upgradeDef.description;
    row.innerHTML = `
      <div class="upgrade-row__info">
        <div class="upgrade-row__name">${upgradeDef.name} <span class="upgrade-row__level">Lv. <span class="level-value">0</span></span></div>
        <div class="upgrade-row__desc">${upgradeDef.description}</div>
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
      root: row,
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
  const isFarming = state.combat.farmingMode;
  const stageLabelText = isFarming
    ? `몬스터 Lv.${state.combat.monsterLevel} · 파밍 중`
    : `몬스터 Lv.${state.combat.monsterLevel}`;
  if (refs.stageLabelEl.textContent !== stageLabelText) refs.stageLabelEl.textContent = stageLabelText;

  refs.retreatBannerEl.hidden = !state.combat.isRetreating;

  refs.farmingToggleBtn.classList.toggle('is-active', isFarming);
  refs.farmingToggleBtn.innerHTML = isFarming ? '자동<br>켜짐' : '자동<br>꺼짐';

  for (const [masteryId, rowRefs] of refs.masteryRows) {
    rowRefs.root.classList.toggle('is-active', masteryId === state.combat.activeStyleId);
  }
}

// 전투화면 캔버스 렌더러(battlefieldCanvas.js)에 넘길 스냅샷 - HP는 0..1 비율로 정규화한다.
export function getBattlefieldSnapshot(state) {
  const monster = getMonsterSnapshot(state);
  const derived = getDerivedStats(state);

  const monsterHp = Math.max(0, state.combat.monsterCurrentHp);
  const playerHp = Math.max(0, state.combat.playerCurrentHp);

  return {
    monsterHpPct: monster.maxHp > 0 ? monsterHp / monster.maxHp : 0,
    playerHpPct: derived.maxHp > 0 ? playerHp / derived.maxHp : 0,
    extraEnemyCount: state.combat.extraEnemies.length,
  };
}

export function renderCombatLog(refs, logLines) {
  // 로그가 최대 줄 수에 도달하면 배열 길이가 더 이상 안 바뀌므로, 길이 대신 내용 자체를 비교해야 한다.
  const key = logLines.join('\n');
  if (refs.lastRenderedLogKey === key) return;
  refs.lastRenderedLogKey = key;
  refs.combatLogEl.innerHTML = logLines.map((line) => `<li>${line}</li>`).join('');
}

export function renderCharacterLevel(refs, state) {
  const level = getCharacterLevel(state);
  if (refs.characterLevelEl.textContent !== String(level)) {
    refs.characterLevelEl.textContent = String(level);
  }

  refs.characterExpFillEl.style.width = `${getCharacterExpProgressPct(state) * 100}%`;

  const unspent = getUnspentStatPoints(state);
  if (refs.unspentPointsEl.textContent !== String(unspent)) {
    refs.unspentPointsEl.textContent = String(unspent);
  }
}

export function renderDerivedStats(refs, state) {
  const preview = getStatPreview(state);
  refs.derivedPhysicalEl.textContent = formatNumber(preview.physicalDamage);
  refs.derivedMagicEl.textContent = formatNumber(preview.magicDamage);
  refs.derivedAttackSpeedEl.textContent = `${preview.attacksPerSec.toFixed(2)}/초`;
  refs.derivedMaxHpEl.textContent = formatNumber(preview.maxHp);
  refs.derivedRegenEl.textContent = `${preview.hpRegenPerSec.toFixed(2)}/초`;
}

export function renderStatPanel(refs, state, statConfig) {
  const unspent = getUnspentStatPoints(state);
  for (const statDef of statConfig) {
    const rowRefs = refs.statRows.get(statDef.id);
    const level = getStatLevel(state, statDef.id);
    if (rowRefs.lastRendered.level !== level) {
      rowRefs.levelEl.textContent = String(level);
      rowRefs.lastRendered.level = level;
    }
    if (rowRefs.lastRendered.minusDisabled !== (level <= 0)) {
      rowRefs.minusBtn.disabled = level <= 0;
      rowRefs.lastRendered.minusDisabled = level <= 0;
    }
    if (rowRefs.lastRendered.plusDisabled !== (unspent <= 0)) {
      rowRefs.plusBtn.disabled = unspent <= 0;
      rowRefs.lastRendered.plusDisabled = unspent <= 0;
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

export function renderPermanentUpgradePanel(refs, state, permanentUpgradeConfig, { buyQuantity, characterLevel }) {
  const goldAmount = state.resources.gold.amount;

  for (const upgradeDef of permanentUpgradeConfig) {
    const rowRefs = refs.permanentUpgradeRows.get(upgradeDef.id);
    const unlocked = isPermanentUpgradeUnlocked(upgradeDef, characterLevel);

    if (!unlocked) {
      if (rowRefs.lastRendered.locked !== true) {
        rowRefs.root.classList.add('is-locked');
        rowRefs.levelEl.textContent = '???';
        rowRefs.buyCostEl.textContent = `Lv.${upgradeDef.requiresLevel} 필요`;
        rowRefs.buyBtn.disabled = true;
        rowRefs.lastRendered = { locked: true };
      }
      continue;
    }
    if (rowRefs.lastRendered.locked !== false) {
      rowRefs.root.classList.remove('is-locked');
      rowRefs.lastRendered.locked = false;
    }

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

export function renderLegacyState(refs, state, upgradeConfig, resourceConfig, { buyQuantity }) {
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

