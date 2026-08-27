// 사용 횟수 -> 레벨 (제곱근 곡선: 초반 빠름, 후반 느림). 스탯/숙련도 공용.
export function levelFromUsage(totalUses, coefficient) {
  if (totalUses <= 0) return 0;
  return Math.floor(coefficient * Math.sqrt(totalUses));
}

// 특정 레벨에 도달하기 위한 총 사용 횟수 (역함수)
export function usageRequiredForLevel(level, coefficient) {
  if (level <= 0) return 0;
  return Math.pow(level / coefficient, 2);
}

// 다음 레벨까지 남은 사용 횟수 (UI 표시용)
export function usesUntilNextLevel(totalUses, coefficient) {
  const currentLevel = levelFromUsage(totalUses, coefficient);
  return Math.max(0, Math.ceil(usageRequiredForLevel(currentLevel + 1, coefficient) - totalUses));
}
