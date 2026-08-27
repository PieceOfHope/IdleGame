import { getMonsterForLevel } from '../config/monsterConfig.js';
import { getDerivedStats } from './characterSystem.js';
import { getExpectedPlayerDps } from './combatSystem.js';

const SAFETY_MARGIN = 0.9; // 몬스터에게 받는 예상 피해가 최대체력의 90% 미만이어야 "안정적"으로 판단
const MAX_SIMULATED_KILLS = 100000; // 무한 루프 방지용 안전장치 (실질적으로 도달 불가능한 상한)

function isSafeAgainst(monster, playerDps, maxHp) {
  if (playerDps <= 0) return false;
  const timeToKillSeconds = monster.maxHp / playerDps;
  const expectedDamageTaken = (timeToKillSeconds / (monster.attackIntervalMs / 1000)) * monster.attackDamage;
  return expectedDamageTaken < maxHp * SAFETY_MARGIN;
}

// 플레이어 DPS가 현재 스테이지 몬스터를 안정적으로 압도할 때만 오프라인 시간을
// 몬스터 처치 시뮬레이션으로 일괄 정산한다 (Document/README.md "오프라인 처리" 참고).
// 압도하지 못하는 경우 simulated:false를 반환하며, 호출측에서 기존 체력 회복 로직으로 대체해야 한다.
export function simulateOfflineKills(state, effectiveTimeSeconds) {
  const derived = getDerivedStats(state);
  const playerDps = getExpectedPlayerDps(state);
  const startLevel = state.combat.monsterLevel;
  const startMonster = getMonsterForLevel(startLevel);

  if (state.combat.farmingMode || !isSafeAgainst(startMonster, playerDps, derived.maxHp)) {
    return { simulated: false };
  }

  let remainingSeconds = effectiveTimeSeconds;
  let currentLevel = startLevel;
  let currentHp = state.combat.monsterCurrentHp;
  let totalGold = 0;
  let totalKills = 0;

  while (remainingSeconds > 0 && totalKills < MAX_SIMULATED_KILLS) {
    const monster = getMonsterForLevel(currentLevel);
    if (!isSafeAgainst(monster, playerDps, derived.maxHp)) break;

    const timeToKillSeconds = currentHp / playerDps;
    if (timeToKillSeconds > remainingSeconds) {
      currentHp -= playerDps * remainingSeconds;
      remainingSeconds = 0;
      break;
    }

    remainingSeconds -= timeToKillSeconds;
    totalGold += monster.goldReward;
    totalKills += 1;
    currentLevel += 1;
    currentHp = getMonsterForLevel(currentLevel).maxHp;
  }

  return {
    simulated: true,
    totalGold,
    totalKills,
    finalLevel: currentLevel,
    finalMonsterHp: currentHp,
  };
}
