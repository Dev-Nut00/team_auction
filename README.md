# 롤 팀 경매 시스템

브라우저만으로 팀 구성 경매를 진행할 수 있는 경량 웹 애플리케이션입니다. 선수 카드 입력에서 본경매 진행, 결과 정리까지 한 화면에서 처리할 수 있도록 설계됐습니다.

## 주요 기능

- **직관적인 경매 흐름**: 팀장 소개 → 본경매 → 결과 화면으로 자연스럽게 이동
- **팀장/선수 관리**: 포지션·티어·이미지·소개 텍스트를 카드 단위로 관리
- **실시간 UI 업데이트**: 현재 선수 정보, 최고 입찰, 팀별 로스터가 즉시 반영
- **유연한 라운드 구성**: 유찰 라운드와 랜덤 배정까지 지원하는 3단계 경매 루프
- **데이터 보존**: LocalStorage 기반 자동 저장, CSV/JSON 내보내기 지원
- **디버그 패널**: 시연이나 테스트를 위한 샘플 데이터/화면 전환 버튼 제공

## 리팩터링 하이라이트

이번 단계에서는 핵심 모듈을 정리하면서 기존 동작을 그대로 유지하는 데 집중했습니다.

### 1. AppState 모듈화
- `AppState` 싱글턴을 도입해 상태 초기화·갱신·리더 정보 하이드레이션을 전담합니다.
- 상태 재로딩(`loadState`) 및 경매 시작(`startAuctionFromIntro`) 시에는 `AppState.replace`로 완전 교체, 일반적인 필드 수정은 `AppState.update`로 관리합니다.
- 리더 정보는 `leaderDetails` 맵으로 통합해 재사용하며, `getMemberCount`, `getRosterCapacity` 등의 헬퍼를 통해 팀별 정원 계산을 일관되게 만들었습니다.

### 2. 팀 카드 렌더러 개선
- `renderTeamsInSideLayout` 과 `renderCompactTeamCard` 로직을 재작성해
  - 팀장/선수 카드에 티어·역할 아이콘·설명 툴팁을 출력
  - 로스터가 부족한 경우 빈 슬롯을 동일한 형식으로 노출
  - 하이라이트, 코스트, 이미지 표시를 한곳에서 관리
- CSS를 `member-info`, `member-meta`, `member-tier` 등으로 세분화하여 레이아웃이 쉽게 확장되도록 구성했습니다.

### 3. 데이터 흐름 정리
- 상태 복원 시에는 `AppState.hydrateTeamLeaderInfo()` 를 전부 거치도록 수정해 저장된 데이터라도 항상 최신 구조를 따르도록 했습니다.
- `collectPlayersFromCards()` 는 리더 정보를 `AppState.normalizeLeader` 로 정규화하여 지도부 캐시와 동기화합니다.
- 경매 UI 갱신(`updateBidTeamDropdown`, `renderTeamsInSideLayout`)은 AppState 헬퍼를 사용해 중복 로직을 제거했습니다.

## 디렉터리 구조

```
assets/              # 아이콘, 역할/티어 이미지 등 정적 자산
index.html           # 단일 페이지 애플리케이션 진입점
style.css            # 전체 스타일シ트 (새로운 roster-compact 스타일 포함)
app.js               # 핵심 로직 (AppState/렌더링/경매 컨트롤 등)
README.md            # 문서
```

## 실행 방법

### 1) 파일 직접 열기 (권장)
- 저장소를 내려받은 뒤 `index.html` 을 브라우저에서 바로 열면 됩니다.

### 2) 간단한 로컬 서버 사용
```bash
# Python
python -m http.server 8080

# Node.js
npx serve -l 8080 .

# 브라우저에서 http://localhost:8080 접속
```

## 개발자 도구

- 좌측 상단 🔧 버튼을 열면 디버그 패널이 나타납니다.
  - **설정 화면** / **팀장 소개** / **본경매** / **완료 화면** 으로 즉시 이동
  - **샘플 데이터 생성** 버튼으로 테스트 카드가 자동 입력
- `app.js` 내 `debugGoTo*` 함수들은 빠른 시나리오 재현을 돕기 위해 유지합니다.

## 라이선스

- 코드: [MIT](LICENSE)
- 자산(Image/Icon): 각 파일에 명시된 라이선스 및 Riot Games 정책을 따릅니다.

---

리팩터링과 관련된 피드백이나 제안이 있다면 언제든지 환영합니다!
