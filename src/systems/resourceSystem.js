export function addResource(state, resourceId, amount) {
  if (!amount) return;
  const resource = state.resources[resourceId];
  if (!resource) return;
  if (amount > 0) {
    resource.amount += amount;
    resource.totalEarned += amount;
  } else {
    resource.amount = Math.max(0, resource.amount + amount);
  }
}

export function getRPS(state, upgradeConfig) {
  const rps = {};
  for (const upgradeDef of upgradeConfig) {
    const level = state.upgrades[upgradeDef.id]?.level ?? 0;
    if (level <= 0) continue;
    rps[upgradeDef.resourceId] = (rps[upgradeDef.resourceId] ?? 0) + level * upgradeDef.baseProduction;
  }
  return rps;
}

export function formatNumber(value) {
  if (!Number.isFinite(value)) return '0';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  if (abs < 1000) {
    return sign + (abs < 10 ? abs.toFixed(1) : Math.floor(abs).toString());
  }

  const units = ['', 'K', 'M', 'B', 'T'];
  if (abs < 1e15) {
    const unitIndex = Math.min(Math.floor(Math.log10(abs) / 3), units.length - 1);
    const scaled = abs / Math.pow(1000, unitIndex);
    return `${sign}${scaled.toFixed(2)}${units[unitIndex]}`;
  }

  return `${sign}${abs.toExponential(2)}`;
}
