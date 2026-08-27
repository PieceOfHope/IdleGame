# GameBalance.md - 캐릭터 스탯 & 숙련도 시스템

이 문서는 "사용하면 할수록 강해진다"는 컨셉을 구현하기 위한 캐릭터 스탯과 숙련도(Mastery) 시스템의 설계 및 밸런스 공식을 정의합니다. 아키텍처 원칙은 [CLAUDE.md](CLAUDE.md)를 따릅니다 (특히 Pure Functions, 데이터 무결성 원칙).

---

## 1. 핵심 컨셉

- 캐릭터는 5가지 기본 스탯(힘/민첩/지력/체력/회복력)과 8가지 숙련도(무기 4종 + 마법 4종)를 가진다.
- 스탯과 숙련도는 모두 **"실제로 사용한 횟수"** 에 비례해 성장한다. 별도의 스탯 포인트 분배나 레벨업 선택지는 없다 — 쓰는 만큼 는다.
- 성장 곡선은 **초반에 빠르게, 후반으로 갈수록 느리게** 오른다 (수확 체감). 레벨이 오르는 데 필요한 "추가 사용 횟수"가 레벨이 오를수록 점점 늘어나는 구조로 구현한다.
- **레벨은 저장하지 않는다.** 저장되는 값은 오직 누적 사용 횟수(`totalUses`)이며, 레벨/보너스는 매번 순수 함수로 재계산한다. 이렇게 하면 레벨 필드와 사용 횟수 필드가 어긋나는(desync) 세이브 손상 위험이 없다.

---

## 2. 공용 성장 곡선 (Mastery Curve)

스탯과 숙련도 모두 동일한 공식을 쓰되, 종류별로 계수(coefficient)만 다르게 튜닝한다.

```javascript
// 사용 횟수 -> 레벨 (제곱근 곡선: 초반 빠름, 후반 느림)
function levelFromUsage(totalUses, coefficient) {
  return Math.floor(coefficient * Math.sqrt(totalUses));
}

// 특정 레벨에 도달하기 위한 총 사용 횟수 (역함수, UI에 "다음 레벨까지 N회" 표시용)
function usageRequiredForLevel(level, coefficient) {
  return Math.pow(level / coefficient, 2);
}

// 다음 레벨까지 남은 사용 횟수
function usesUntilNextLevel(totalUses, coefficient) {
  const currentLevel = levelFromUsage(totalUses, coefficient);
  return Math.ceil(usageRequiredForLevel(currentLevel + 1, coefficient) - totalUses);
}
```

### 왜 제곱근(sqrt) 곡선인가

레벨 `L`에 도달하는 데 필요한 총 사용 횟수는 `(L / K)^2` 이므로, 레벨을 한 단계 올리는 데 필요한 **추가** 사용 횟수는 `(2L+1) / K^2` 로, 레벨이 오를수록 선형으로 늘어난다. 즉:

- 레벨 1 → 2: 적은 추가 횟수
- 레벨 50 → 51: 훨씬 많은 추가 횟수

`Math.log`(로그) 곡선도 대안이 될 수 있으나, 로그는 후반에 거의 정체되어 "성장 체감"이 지나치게 커진다. 제곱근 곡선은 후반에도 눈에 띄게 (느리지만) 성장한다는 느낌을 유지하므로 방치형 게임에 더 적합하다.

### 기본 계수 예시 (튜닝 필요)

| 계수 | 레벨 1 도달 | 레벨 10 도달 | 레벨 50 도달 | 레벨 100 도달 |
|---|---|---|---|---|
| K = 0.5 | 4회 | 400회 | 10,000회 | 40,000회 |
| K = 1.0 | 1회 | 100회 | 2,500회 | 10,000회 |

전투에서 공격이 적중할 때마다 스탯(힘/지력/민첩성)과 숙련도(활성 무기·마법)는 **동시에** 증가한다 (5절 참고). 따라서 두 곡선을 다르게 두는 이유는 트리거 빈도 차이가 아니라 역할 차이다: 스탯은 캐릭터 전반의 "기초 체력"이므로 천천히 단단하게 쌓이도록 `K`를 작게, 숙련도는 특정 기술을 반복 숙달하는 개념이므로 상대적으로 빠르게 체감되도록 `K`를 크게 잡는다. 기본값은 `STAT_LEVEL_COEFFICIENT = 0.6`, `MASTERY_LEVEL_COEFFICIENT = 1.0` 을 제안한다. 실제 값은 플레이테스트로 조정한다.

---

## 3. 기본 스탯 (5종)

| 스탯 | 이름 | 역할 | 증가 트리거 |
|---|---|---|---|
| `str` | 힘 | 물리 데미지 | 물리 공격(무기 종류 무관) 적중 시 |
| `agi` | 민첩성 | 공격 속도 | 공격 행동(물리/마법 무관) 수행 시 |
| `int` | 지력 | 마법 데미지 | 마법 공격(마법 계열 무관) 시전 시 |
| `vit` | 체력 | 최대 체력 | 전투 중 피해를 받을 때 |
| `recovery` | 회복력 | 체력 회복량 | 체력 회복(자연 회복/틱) 발생 시 |

### 스탯 → 실효 능력치 변환 공식

```javascript
const physicalDamage = baseWeaponDamage
  * (1 + strLevel * STR_DAMAGE_PER_LEVEL)
  * (1 + weaponMasteryLevel * WEAPON_MASTERY_PER_LEVEL);

const magicDamage = baseSpellPower
  * (1 + intLevel * INT_DAMAGE_PER_LEVEL)
  * (1 + magicMasteryLevel * MAGIC_MASTERY_PER_LEVEL);

const attackIntervalMs = baseAttackIntervalMs / (1 + agiLevel * AGI_SPEED_PER_LEVEL);

const maxHp = baseHp + vitLevel * HP_PER_VIT_LEVEL;

const hpRegenPerSec = baseRegenPerSec + recoveryLevel * REGEN_PER_RECOVERY_LEVEL;
```

스탯 보너스는 레벨에 **선형 비례**(퍼센트/레벨)로 두고, 수확 체감은 이미 `levelFromUsage` 곡선(사용 횟수 대비 레벨 상승 속도)에 내재되어 있으므로 이중으로 체감시키지 않는다. 계수(`STR_DAMAGE_PER_LEVEL` 등)는 `src/config/characterConfig.js`에 상수로 관리한다.

---

## 4. 숙련도 (8종)

### 물리 계열

| ID | 이름 | 핵심 효과 | 특성 (선택적 확장) |
|---|---|---|---|
| `sword` | 검 | 검 사용 시 물리 데미지 % 증가 | 공격 속도 소폭 보너스 (밸런스형) |
| `spear` | 창 | 창 사용 시 물리 데미지 % 증가 | 단일 대상 관통(방어력 무시) 확률 |
| `blunt` | 둔기 | 둔기 사용 시 물리 데미지 % 증가 | 적 기절/스턴 확률 |
| `bow` | 활 | 활 사용 시 물리 데미지 % 증가 | 치명타 확률 보너스 |

### 마법 계열

| ID | 이름 | 핵심 효과 | 특성 (선택적 확장) |
|---|---|---|---|
| `elemental` | 원소마법 | 원소 마법 데미지 % 증가 | 속성 상성 피해 보너스 |
| `dark` | 암흑마법 | 암흑 마법 데미지 % 증가 | 피해 흡수(라이프스틸) |
| `holy` | 신성마법 | 신성 마법 데미지 % 증가 | 회복 마법 효율 보너스 |
| `mental` | 정신마법 | 정신 마법 데미지 % 증가 | 적 디버프/제어 성공률 보너스 |

"특성" 열은 지금 바로 구현하지 않아도 되는 확장 아이디어이며, 1차 구현 범위는 각 숙련도의 **핵심 효과(데미지 % 증가)** 만으로 충분하다.

### 숙련도 → 데미지 배율 공식

```javascript
function masteryDamageMultiplier(totalUses, coefficient, bonusPerLevel) {
  const level = levelFromUsage(totalUses, coefficient);
  return 1 + level * bonusPerLevel;
}
```

장착한 무기/마법 계열에 해당하는 숙련도만 데미지 계산에 적용한다 (예: 검을 장착 중이면 `sword` 숙련도만 적용, 나머지 3개 무기 숙련도는 관여하지 않음).

---

## 5. 전투 시스템 (Monster Combat Loop)

기존의 "일꾼/광부/공장이 초당 골드를 자동생산"하던 방식을 **몬스터 처치 기반 골드 획득**으로 교체한다. 게임의 핵심 루프는 이제 "몬스터와 싸운다 → 처치하면 골드를 얻고 다음 레벨 몬스터로 넘어간다"이다.

### 5.1 몬스터 밸런스 공식

몬스터는 레벨 하나로 완전히 정의되는 순수 함수다 (레벨 외에는 아무 것도 저장하지 않는다 — 현재 HP만 별도로 세이브).

```javascript
const MONSTER_BALANCE = {
  baseHp: 20,
  baseAttackDamage: 2,
  baseAttackIntervalMs: 1500,
  baseGoldReward: 5,
  hpGrowth: 1.12,
  attackGrowth: 1.10,
  goldGrowth: 1.08,
};

function getMonsterForLevel(level) {
  const exponent = level - 1;
  return {
    level,
    maxHp: Math.round(MONSTER_BALANCE.baseHp * Math.pow(MONSTER_BALANCE.hpGrowth, exponent)),
    attackDamage: Math.round(MONSTER_BALANCE.baseAttackDamage * Math.pow(MONSTER_BALANCE.attackGrowth, exponent)),
    attackIntervalMs: MONSTER_BALANCE.baseAttackIntervalMs,
    goldReward: Math.round(MONSTER_BALANCE.baseGoldReward * Math.pow(MONSTER_BALANCE.goldGrowth, exponent)),
  };
}
```

### 5.2 실시간 양방향 전투

- 플레이어와 몬스터는 각자의 공격 주기(`attackIntervalMs`)마다 서로에게 데미지를 입힌다. 두 주기는 독립적으로 흘러간다 (예: 플레이어가 몬스터보다 2배 빠르게 때릴 수 있음).
- 플레이어 공격 주기는 민첩성(AGI)에 의해 단축된다: `attackIntervalMs = baseAttackIntervalMs / (1 + agiLevel * AGI_SPEED_PER_LEVEL)`.
- 몬스터를 처치하면: 골드 획득 → `monsterLevel += 1` → 다음 레벨 몬스터가 즉시 풀피로 등장한다.
- **후퇴(패배) 처리**: 플레이어 체력이 0이 되면 즉시 최대 체력으로 회복시키고 `RETREAT_DURATION_MS`(기본 3000ms) 동안 전투를 중단한다. 이후 **같은 레벨의 몬스터**와 다시 싸운다 — 몬스터 레벨(진행도)은 잃지 않고, 시간만 소모된다. 방치형 게임에서 패배가 과도한 좌절을 주지 않도록 하기 위한 설계다.
- 전투 스타일(검/창/둔기/활/원소/암흑/신성/정신) 중 **하나만** 동시에 활성화할 수 있다. 전투 중 언제든 전환 가능하며 전환 자체에 페널티는 없다 (1차 구현 범위 — 동시 다중 장착은 8절 참고).

### 5.3 스탯/숙련도 증가 트리거 (확정)

| 트리거 | 증가하는 값 |
|---|---|
| 플레이어의 물리 공격이 적중 | `str` +1, `agi` +1, 활성 무기 숙련도(검/창/둔기/활 중 하나) +1 |
| 플레이어의 마법 공격이 적중 | `int` +1, `agi` +1, 활성 마법 숙련도(원소/암흑/신성/정신 중 하나) +1 |
| 몬스터에게 피격 | `vit` +1 |
| 자연 회복 발생 (체력 < 최대 체력인 매 틱) | `recovery` += 해당 틱의 경과 시간(초) — 정수 카운트가 아닌 연속량으로 누적 |

`agi`는 물리/마법 공격 모두에서 함께 오른다는 점에 주의 — "공격 행동을 자주 할수록 손이 빨라진다"는 컨셉이다.

### 5.4 오프라인 처리 변경

오프라인 중 몬스터 처치는 시뮬레이션하지 않는다 (8절 "범위 밖" 참고). 대신 오프라인 경과 시간에 `hpRegenPerSec`를 곱한 만큼만 체력을 회복시켜, 복귀 시 곧바로 이어서 싸울 수 있게 한다. 기존의 "오프라인 보상 정산 모달"은 레거시 생산 시스템이 비활성화된 동안에는 표시되지 않는다.

---

## 6. 세이브 데이터 스키마 확장

`Document/CLAUDE.md`의 `GameSaveState`에 `character`와 `combat` 필드를 추가한다. 레벨은 저장하지 않고 `totalUses`만 저장한다. 공격 주기 누적 타이머(`playerAttackElapsedMs` 등)는 세이브하지 않고 로드 시 0으로 리셋한다 — `core/gameLoop.js`의 델타 리셋과 동일한 철학이다.

```typescript
interface GameSaveState {
  version: number; // 2 로 상향
  // ...기존 필드(resources, upgrades, settings)...
  character: {
    stats: {
      str: { totalUses: number };
      agi: { totalUses: number };
      int: { totalUses: number };
      vit: { totalUses: number };
      recovery: { totalUses: number };
    };
    mastery: {
      sword: { totalUses: number };
      spear: { totalUses: number };
      blunt: { totalUses: number };
      bow: { totalUses: number };
      elemental: { totalUses: number };
      dark: { totalUses: number };
      holy: { totalUses: number };
      mental: { totalUses: number };
    };
  };
  combat: {
    activeStyleId: string;       // 8개 숙련도 ID 중 하나, 기본값 'sword'
    monsterLevel: number;        // 기본값 1
    monsterCurrentHp: number;
    playerCurrentHp: number;
    isRetreating: boolean;
    retreatRemainingMs: number;
  };
  permanentUpgrades: {
    attackPower: { level: number };
    maxHp: { level: number };
    hpRegen: { level: number };
  };
}
```

### 마이그레이션 노트

- 세이브 버전을 1 → 2로 올린다. `SaveManager.migrate()` / `normalizeState()`는 `character`/`combat` 필드가 없는 기존 세이브에 대해 기본값(모든 `totalUses`는 0, `monsterLevel`은 1)으로 채운다.
- `character`/`combat` 관련 설정값은 `src/config/characterConfig.js`, `src/config/masteryConfig.js`, `src/config/monsterConfig.js`로 분리해 다른 밸런스 데이터와 동일한 패턴을 따른다.

---

## 7. 기존 생산 시스템과의 관계 (레거시 비활성화)

- 일꾼/광부/공장 업그레이드(초당 골드 자동생산)는 **삭제하지 않고** `GAME_CONFIG.LEGACY_PRODUCTION_ENABLED = false` 플래그로 비활성화한다.
- 비활성화 상태에서는 UI에 관련 패널이 표시되지 않고 게임 루프에서도 틱 처리되지 않지만, `src/config/upgrades.js`와 `src/systems/upgradeSystem.js`는 그대로 유지되어 추후 "장비 강화" 등의 형태로 재활용할 수 있다.
- 당분간 골드 획득 경로는 몬스터 처치 보상이 유일하다.

---

## 8. 범위 밖 (후속 과제)

- 오프라인 중 몬스터 처치 시뮬레이션 (현재는 오프라인 중 체력 회복만 적용)
- 장비/인벤토리 시스템, 전투 스타일 동시 다중 장착
- 각 숙련도별 "특성" 효과 (4절의 관통/스턴/치명타 등 선택적 확장 표)
- 후퇴(패배)에 대한 추가 페널티 여부 — 현재는 시간 손실만 존재하고 진행도 손실은 없음

---

## 9. 밸런스 리스크 및 개선 로드맵

전투 시스템을 구현한 뒤 2000초(2만 틱) 시뮬레이션으로 검증한 결과, 아래 수치가 확인됐다: **처치 37회 vs 후퇴 235회**, 몬스터 레벨 38 도달 시점에 몬스터 체력이 900 이상 남아 사실상 진행이 거의 멈추는 구간에 진입했다. 몬스터 지수 성장(`hpGrowth 1.12`, `attackGrowth 1.10`)이 플레이어의 제곱근 성장을 30~40레벨대부터 확실히 앞지른다는 것이 실측으로 확인됐다. 아래는 이에 대한 개선 항목과 현재 상태다.

### 9.1 무한 패배 루프(Softlock) 방지 — 제안됨, 구현 보류

- **위험**: 특정 레벨에서 공격이 아예 적중하지 못하는 수준으로 밀리면, `str`/`int`/`agi`/무기 숙련도가 전혀 오르지 않는 성장 정체 상태에 빠질 수 있다.
- **제안**: 현재 도전 중인 몬스터 외에 이전에 클리어한 하위 레벨 몬스터로 돌아가 안전하게 파밍할 수 있는 스테이지 선택/강등 기능.
- **상태**: 실측 결과 완전한 정지(0킬 고착)까지는 아니었지만 그 직전 단계였다. 채택 여부와 우선순위는 확인 필요.

### 9.2 지수형 몬스터 vs 수확 체감형 플레이어 — 구현 완료

- **원인**: 몬스터는 지수 함수로, 플레이어는 `sqrt(사용횟수)` 로 성장 — 시간이 지날수록 격차가 구조적으로 벌어진다.
- **적용한 해법**: 몬스터 처치로 얻은 골드를 소모하는 영구 강화 시스템(`src/config/permanentUpgradeConfig.js`, `src/systems/permanentUpgradeSystem.js`)을 신설했다. 비용 곡선(지수 증가/벌크 구매)은 레거시 `upgradeSystem.js`의 `getBulkCost`/`getMaxAffordableQuantity` 순수 함수를 그대로 가져다 썼다 — 레거시 파일은 수정하지 않고 읽기 전용으로 재사용만 했다. 세이브에는 별도의 `permanentUpgrades` 버킷을 둔다 (6절).
  - `attackPower`: 물리/마법 데미지 곱연산 보너스 (+3%/레벨)
  - `maxHp`: 최대 체력 가산 보너스 (+8/레벨)
  - `hpRegen`: 초당 회복량 가산 보너스 (+0.1/레벨)
- **검증**: 2000초 시뮬레이션에서 골드를 즉시 재투자(그리디 구매)했을 때 후퇴 235회→202회, 처치 37→40회, 도달 몬스터 레벨 38→41로 개선을 확인했다. 격차를 완전히 없애지는 못하지만(장기적으로는 여전히 지수 vs 제곱근 구조가 남아있음) 체감 개선 효과는 뚜렷하다.
- **후속 여지**: 강화 항목 추가(예: 크리티컬, 방어력), 강화 비용/효과 밸런스는 플레이테스트로 조정 필요.

### 9.3 스탯 트리거 세부 조정

| 항목 | 내용 | 상태 |
|---|---|---|
| AGI 스노우볼링 | 공격 속도가 빨라질수록 `agi` 상승 빈도도 늘어나 복리 가속이 발생할 수 있음 | **반영 완료** — `CHARACTER_BALANCE.minAttackIntervalMs = 200`(ms)로 공격 주기 하한선 추가 |
| VIT 인플레이션 | 방어력(DEF) 개념이 없어 체력만 늘리면 후반부에 몬스터 공격력에 묻혀 체력 수치만 무의미하게 커질 수 있음 | 제안됨, 구현 보류 — 방어력 스탯/공식 도입 검토 필요 |
| Recovery 병목 | 풀피 상태로 원킬하는 파밍 구간에서는 `recovery`가 전혀 오르지 않음 | **의도된 설계로 확인** — 별도 대응 불필요 |

### 9.4 오프라인 시뮬레이션의 점진적 도입 — 제안됨, 구현 보류

- **문제의식**: 현재는 오프라인 중 체력 회복만 적용되어 골드/숙련도 진행이 전혀 없다. 방치형 게임 특성상 이탈률에 영향을 줄 수 있다.
- **제안**: 정밀한 틱 시뮬레이션 대신, `몬스터 처치 시간(HP / 플레이어 DPS)`과 `몬스터 공격 주기`로 초당 처치 수를 근사한 뒤 `오프라인 시간 × 처치 수 × 오프라인 효율(예: 50%)`로 골드/사용횟수를 일괄 정산하는 간이 공식.
- **주의**: 9.2절의 격차 문제 때문에 "현재 도전 몬스터를 이길 수 있는가"를 먼저 판정하지 않고 단순 DPS 계산만 적용하면, 실제로는 이길 수 없는 몬스터에게도 오프라인 골드가 지급되는 밸런스 붕괴가 발생한다. 플레이어 DPS와 몬스터 DPS를 비교해 **실제로 승산이 있을 때만** 오프라인 처치를 정산하는 조건을 반드시 포함해야 한다.
- **상태**: 구현 보류. 9.2절의 골드 싱크 시스템이 먼저 갖춰진 뒤 도입하는 것이 순서상 자연스럽다.
