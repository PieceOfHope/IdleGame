// 몬스터 처치로 얻은 골드를 소모하는 영구 강화 시스템.
// 비용 곡선(지수 증가/벌크 구매)은 레거시 upgradeSystem.js의 순수 함수를 그대로 재사용한다.
import { getBulkCost, getMaxAffordableQuantity } from './upgradeSystem.js';

export { getBulkCost, getMaxAffordableQuantity };

export function getPermanentUpgradeLevel(state, upgradeId) {
  return state.permanentUpgrades[upgradeId]?.level ?? 0;
}

export function purchasePermanentUpgrade(state, upgradeDef, quantity) {
  const level = getPermanentUpgradeLevel(state, upgradeDef.id);
  const cost = getBulkCost(upgradeDef, level, quantity);
  const gold = state.resources.gold;
  if (!gold || quantity <= 0 || gold.amount < cost) {
    return { success: false };
  }
  gold.amount -= cost;
  state.permanentUpgrades[upgradeDef.id] = { level: level + quantity };
  return { success: true, newLevel: level + quantity, cost };
}
