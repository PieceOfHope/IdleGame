export function now() {
  return Date.now();
}

export function getDeltaSeconds(lastTimestamp, currentTimestamp = Date.now()) {
  return Math.max(0, (currentTimestamp - lastTimestamp) / 1000);
}

export function computeOfflineProgress({ deltaSeconds, maxOfflineCapSeconds, offlineEfficiency, currentRPS }) {
  const effectiveTime = Math.min(deltaSeconds, maxOfflineCapSeconds);
  const earnedByResource = {};
  for (const [resourceId, rps] of Object.entries(currentRPS)) {
    earnedByResource[resourceId] = rps * effectiveTime * offlineEfficiency;
  }
  return { effectiveTime, earnedByResource };
}

export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}시간`);
  if (minutes > 0) parts.push(`${minutes}분`);
  if (hours === 0 && minutes === 0) parts.push(`${secs}초`);
  return parts.join(' ');
}
