# CLAUDE.md - Development & Architecture Guidelines

이 문서는 웹 방치형 게임(Idle Game) 프로젝트를 개발할 때 Claude 및 AI 어시스턴트가 준수해야 할 아키텍처 규칙, 코딩 표준, 핵심 시스템 설계 지침입니다.

---

## 1. 핵심 철학 및 규칙 (Core Principles)

1. **정확성과 데이터 무결성 (Data Integrity)**
   - 세이브 데이터 손실 및 부동소수점 오차(`0.1 + 0.2 !== 0.3`)를 방지해야 합니다.
   - 자원 수치 계산 시 정밀도 관리 및 표기 포맷터(`1K`, `1M`, `1B` 또는 지수 표기법)를 분리합니다.

2. **시간 계산의 절대성 (Time-based Calculation)**
   - 게임 루프는 단순 카운터가 아닌 **실제 경과 시간(Delta Time)**을 기반으로 자원을 연산합니다.
   - 탭 비활성화, 브라우저 최소화, 절전 모드 복귀 시에도 `Date.now()` 또는 `performance.now()` 기반 델타를 정확히 반영합니다.

3. **로직과 렌더링의 철저한 분리 (Decoupled Logic & UI)**
   - 게임 상태(State)와 DOM 조작을 분리합니다.
   - 상태 변경은 시스템 로직 내부에서만 발생하며, UI는 상태를 구독(Subscribe)하거나 틱마다 변경 사항만 최소한으로 DOM에 반영합니다.

---

## 2. 아키텍처 가이드 (Architecture Guide)

### A. State Schema (상태 구조 설계)
모든 게임 상태는 단일 순수 객체(Pure Object)로 직렬화 가능해야 합니다.

```typescript
interface GameSaveState {
  version: number;
  lastSaveTimestamp: number;
  resources: {
    [resourceId: string]: {
      amount: number;
      totalEarned: number;
    };
  };
  upgrades: {
    [upgradeId: string]: {
      level: number;
    };
  };
  settings: {
    autoSaveIntervalMs: number;
    sfxEnabled: boolean;
  };
}
```

### B. 오프라인 자원 정산 플로우
1. 앱 로드 시 `SaveManager.load()` 호출
2. `savedState.lastSaveTimestamp`와 `Date.now()` 비교
3. `deltaSeconds > OFFLINE_MIN_THRESHOLD(e.g., 10초)`일 경우:
   - RPS(초당 생산량) 기반 오프라인 획득량 계산
   - 상태 반영 후 UI에 **"오프라인 보상 정산 모달"** 표시
4. 메인 루프 가동 및 주기적 세이브 인터벌 등록

### C. 세이브 매니저 가이드라인 (`SaveManager`)
- 저장 키: `idle_game_save_v1`
- 자동 저장 주기: 기본 10초 ~ 30초
- 브라우저 종료 시점 대응: `window.addEventListener('beforeunload', ...)`
- **버전 마이그레이션 함수 필수**: 새 기능 추가로 스키마가 변경될 때 기존 세이브가 깨지지 않도록 `migrate(savedData, currentVersion)` 작성

---

## 3. 코딩 표준 및 주의사항 (Coding Standards)

- **Pure Functions**: 자원 생산량 계산, 비용 스케일링 함수(지수 스케일링 `cost = baseCost * (costMultiplier ^ currentLevel)`)는 사이드이펙트 없는 순수 함수로 작성.
- **DOM 최적화**: 
  - 매 틱마다 전체 DOM을 재생성하지 말 것 (`innerHTML` 남발 금지).
  - 변경된 자원 텍스트 및 버튼 활성/비활성 클래스만 선별적으로 업데이트.
- **보안 및 치트 방지 (기본 수준)**:
  - 미래 시간 조작(타임머신 치트) 방지: `lastSaveTimestamp > Date.now()`인 경우 경고 처리 및 시간 역행 방어 로직 포함.

---

## 4. 자주 사용하는 공식 (Common Formulas)

1. **지수 비용 증가 (Exponential Cost)**
   $$	ext{Cost} = 	ext{BaseCost} 	imes (	ext{Multiplier})^{	ext{Level}}$$

2. **벌크 구매 (Bulk Buy 10x / 100x / Max)**
   $$	ext{TotalCost} = 	ext{BaseCost} 	imes rac{	ext{Multiplier}^{	ext{Level}} 	imes (	ext{Multiplier}^{N} - 1)}{	ext{Multiplier} - 1}$$

3. **숫자 포맷팅 (Number Formatter)**
   - $10^3$: K, $10^6$: M, $10^9$: B, $10^{12}$: T (Standard format)
   - $10^{15}$ 이상: 과학적 표기법($1.23e15$) 또는 알파벳 접미사 지원
