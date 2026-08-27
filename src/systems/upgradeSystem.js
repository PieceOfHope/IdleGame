export function isUnlocked(state, upgradeDef) {
  if (!upgradeDef.requiresUpgrade) return true;
  const { id, level } = upgradeDef.requiresUpgrade;
  return (state.upgrades[id]?.level ?? 0) >= level;
}

export function getBulkCost(upgradeDef, level, quantity) {
  if (quantity <= 0) return 0;
  const { baseCost, costMultiplier } = upgradeDef;
  if (costMultiplier === 1) return baseCost * quantity;
  return (
    (baseCost * Math.pow(costMultiplier, level) * (Math.pow(costMultiplier, quantity) - 1)) /
    (costMultiplier - 1)
  );
}

export function getMaxAffordableQuantity(upgradeDef, level, amount) {
  const { baseCost, costMultiplier } = upgradeDef;
  const nextCost = baseCost * Math.pow(costMultiplier, level);
  if (amount < nextCost) return 0;
  if (costMultiplier === 1) return Math.floor(amount / baseCost);
  const ratio = 1 + (amount * (costMultiplier - 1)) / nextCost;
  return Math.max(0, Math.floor(Math.log(ratio) / Math.log(costMultiplier)));
}

export function purchaseUpgrade(state, upgradeDef, quantity) {
  const level = state.upgrades[upgradeDef.id]?.level ?? 0;
  const cost = getBulkCost(upgradeDef, level, quantity);
  const resource = state.resources[upgradeDef.resourceId];
  if (!resource || quantity <= 0 || resource.amount < cost) {
    return { success: false };
  }
  resource.amount -= cost;
  state.upgrades[upgradeDef.id] = { level: level + quantity };
  return { success: true, newLevel: level + quantity, cost };
}
