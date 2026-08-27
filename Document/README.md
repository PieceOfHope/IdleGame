# Idle Craft & Odyssey (가칭)

웹 브라우저 기반의 방치형 몬스터 전투 & 성장 시뮬레이션 게임입니다.  
캐릭터는 몬스터와 자동으로 싸우며, 처치할 때마다 골드를 얻고 다음 레벨 몬스터로 넘어갑니다. 싸우면 싸울수록 스탯과 무기/마법 숙련도가 성장하는 "사용하면 할수록 강해진다" 컨셉이 핵심입니다. 브라우저를 종료하거나 오프라인 상태가 되어도 로컬 스토리지를 활용해 진행 상황이 안전하게 저장됩니다. 상세 밸런스 설계는 [GameBalance.md](GameBalance.md) 참고.

---

## 🎮 주요 기능 (Key Features)

1. **몬스터 전투 기반 성장 (Combat Progression)**
   - 실시간 양방향 자동 전투: 플레이어와 몬스터가 각자의 공격 주기로 서로 공격
   - 몬스터 처치 시 골드 획득 + 다음 레벨 몬스터로 자동 전환
   - 패배 시 "후퇴"로 체력을 회복하고 같은 몬스터와 재도전 (진행도 손실 없음)

2. **캐릭터 스탯 & 숙련도 (사용하면 할수록 강해진다)**
   - 5가지 기본 스탯: 힘/민첩성/지력/체력/회복력
   - 8가지 숙련도: 검/창/둔기/활, 원소/암흑/신성/정신 마법 — 전투에서 실제로 사용한 만큼 성장
   - 성장 곡선은 초반 빠르게, 후반 느리게 (제곱근 곡선, 수확 체감)

3. **영구 강화 (골드 싱크)**
   - 몬스터 처치로 얻은 골드를 소모해 공격력/최대 체력/회복력을 영구적으로 강화
   - 몬스터는 지수적으로, 플레이어 스탯은 수확 체감형으로 성장해 벌어지는 격차를 완화하는 장치

4. **자동 & 수동 저장 시스템 (Persistence)**
   - `localStorage` 기반의 주기적 자동 저장 (Auto-save)
   - 데이터 무결성을 위한 버전 관리 및 마이그레이션 지원
   - Save / Load / Reset 및 내보내기/가져오기 (JSON Export/Import) 기능

5. **오프라인 처리 (Offline Handling)**
   - 오프라인 경과 시간만큼 체력 자동 회복 후 복귀 시 이어서 전투
   - (레거시) 초당 자원 생산 기반 오프라인 보상 정산 로직은 아래 "레거시 생산 시스템" 참고

> **레거시 생산 시스템**: 초기 버전의 일꾼/광부/공장(초당 골드 자동생산) 업그레이드는 몬스터 전투로 대체되며 `GAME_CONFIG.LEGACY_PRODUCTION_ENABLED = false`로 비활성화되어 있습니다. 코드는 삭제하지 않고 남겨두어 추후 재활용할 수 있게 했습니다.

---

## 🛠 기술 스택 (Tech Stack)

- **Frontend**: HTML5, CSS3, Modern JavaScript (ES6+) or TypeScript
- **Framework/Bundler (선택 가능)**: Vite / Vanilla JS or React / Vue
- **Storage**: Web Storage API (`localStorage`) / IndexedDB (대용량 세이브 시)
- **Time Sync**: `Date.now()` 기반 델타 타임 계산 & 브라우저 `visibilitychange` 이벤트

---

## 📁 프로젝트 구조 (Project Structure)

```text
├── index.html                # 진입점 HTML
├── css/
│   └── style.css             # UI 스타일링 및 레이아웃
├── src/
│   ├── main.js                # 게임 루프 초기화 및 이벤트 리스너 등록
│   ├── config/
│   │   ├── gameConfig.js       # 틱/오토세이브/오프라인 캡 등 전역 튜닝값, LEGACY_PRODUCTION_ENABLED 플래그
│   │   ├── resources.js        # 자원 정의 및 초기값
│   │   ├── upgrades.js         # (레거시) 업그레이드 비용/효과 데이터 테이블 - 비활성화 상태로 보존
│   │   ├── characterConfig.js  # 5개 스탯 정의 및 스탯->능력치 변환 계수
│   │   ├── masteryConfig.js    # 8개 숙련도 정의 및 데미지 보너스 계수
│   │   ├── monsterConfig.js    # 몬스터 레벨->HP/공격력/골드 보상 공식
│   │   └── permanentUpgradeConfig.js # 골드 소모 영구 강화(공격력/체력/회복력) 정의
│   ├── core/
│   │   ├── gameLoop.js         # RAF 기반 메인 틱 루프 (고정 델타 누적)
│   │   ├── timeEngine.js       # 델타 타임 및 오프라인 시간 계산기
│   │   └── saveManager.js      # 저장/불러오기, JSON Export/Import, 마이그레이션
│   ├── systems/
│   │   ├── resourceSystem.js   # 자원 가감 및 숫자 포맷팅
│   │   ├── upgradeSystem.js    # (레거시) 업그레이드 구매 판정 - 비활성화 상태로 보존
│   │   ├── masteryCurve.js     # 사용 횟수 -> 레벨 공용 성장 곡선 (순수 함수)
│   │   ├── characterSystem.js  # 스탯 레벨 계산 및 파생 능력치(최대체력/공속/회복량 등)
│   │   ├── masterySystem.js    # 숙련도 레벨 계산 및 데미지 배율
│   │   ├── combatSystem.js     # 실시간 양방향 전투 틱 처리 (공격/피격/처치/후퇴)
│   │   └── permanentUpgradeSystem.js # 영구 강화 구매 판정 (레거시 upgradeSystem.js의 비용 곡선 재사용)
│   └── ui/
│       ├── renderer.js         # DOM 업데이트 최적화 (전투 패널, 스탯/숙련도 패널 등)
│       └── modal.js            # 오프라인 정산 팝업, 세이브 관리 팝업
└── CLAUDE.md                  # AI 코딩 가이드라인 및 개발 원칙
```

---

## ⚙️ 핵심 알고리즘 구조

### 1. 전투 틱 (Combat Tick) — 상세는 [GameBalance.md](GameBalance.md) 5절 참고
```javascript
// 매 틱: 자연 회복 -> 플레이어 공격 판정 -> (생존 시) 몬스터 공격 판정
if (combat.playerCurrentHp < derived.maxHp) {
  combat.playerCurrentHp = Math.min(derived.maxHp, combat.playerCurrentHp + derived.hpRegenPerSec * dtSeconds);
}
combat.playerAttackElapsedMs += dtMs;
if (combat.playerAttackElapsedMs >= derived.attackIntervalMs) {
  combat.playerAttackElapsedMs -= derived.attackIntervalMs;
  combat.monsterCurrentHp -= getPlayerAttackDamage(state, styleDef);
  // 처치 시 골드 지급 후 다음 레벨 몬스터로 전환
}
// 몬스터 공격도 동일한 방식의 독립적인 주기로 처리, 플레이어 체력 0 시 후퇴 상태 진입
```

### 2. 오프라인 체력 회복 (레거시 RPS 정산 대체)
```javascript
const deltaSeconds = Math.max(0, (Date.now() - lastSaveTimestamp) / 1000);
const effectiveTime = Math.min(deltaSeconds, maxOfflineCapSeconds);
combat.playerCurrentHp = Math.min(derived.maxHp, combat.playerCurrentHp + derived.hpRegenPerSec * effectiveTime);
// 몬스터 처치는 오프라인 중 시뮬레이션하지 않음 (GameBalance.md 8절 "범위 밖")
```

### 3. 메인 게임 루프 (Main Tick Loop)
- `requestAnimationFrame` 기반 100ms 고정 틱 누적, 렌더링 프레임과 게임 로직 틱을 분리
- `LEGACY_PRODUCTION_ENABLED`가 `true`일 때만 기존 RPS 기반 자원 생산 틱이 함께 동작

---

## 🚀 시작하기 (Getting Started)

1. **로컬 실행**
   ```bash
   # 로컬 정적 서버 실행 (예: Live Server, Vite 등)
   npx serve .
   ```
2. 브라우저에서 `http://localhost:3000` 접속 후 플레이 및 테스트
