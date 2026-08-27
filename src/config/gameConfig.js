export const GAME_CONFIG = {
  TICK_MS: 100,
  AUTO_SAVE_INTERVAL_MS: 10000,
  OFFLINE_MIN_THRESHOLD_SECONDS: 10,
  MAX_OFFLINE_CAP_SECONDS: 8 * 60 * 60,
  OFFLINE_EFFICIENCY: 0.8,
  GATHER_RESOURCE_ID: 'gold',
  GATHER_AMOUNT: 1,
  // 기존 초당 자동생산(일꾼/광부/공장) 시스템 - 몬스터 전투로 교체하며 비활성화.
  // 코드는 남겨두고 이 플래그로만 껐다 켤 수 있게 한다 (Document/GameBalance.md 7절 참고).
  LEGACY_PRODUCTION_ENABLED: false,
};
