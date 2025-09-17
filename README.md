# 🏆 리그 오브 레전드 팀 경매 시스템

> 오프라인 환경에서 사용하는 LoL 팀 구성 경매 웹 애플리케이션

![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Web-brightgreen.svg)
![Language](https://img.shields.io/badge/language-Korean-red.svg)

## 📖 소개

리그 오브 레전드 팀 경매 시스템은 오프라인 환경에서 팀 구성을 위한 경매를 진행할 수 있는 웹 애플리케이션입니다.
브라우저에서 `index.html` 파일만 열면 바로 사용할 수 있으며, 서버 설치나 인터넷 연결이 필요하지 않습니다.

### ✨ 주요 특징

- 🌐 **완전 오프라인**: 서버 없이 브라우저에서 바로 실행
- 🎮 **직관적 UI**: 게임에 최적화된 사용자 인터페이스
- 📱 **반응형 디자인**: 다양한 화면 크기 지원
- 💾 **자동 저장**: 브라우저 LocalStorage를 통한 데이터 보존
- 📊 **데이터 내보내기**: CSV/JSON 형식 지원

## 🚀 빠른 시작

### 방법 1: 파일 직접 실행 (권장)
```bash
# 다운로드 후 index.html 더블클릭
```

### 방법 2: 로컬 서버 실행
```bash
# Python 사용
python -m http.server 8080

# Node.js 사용
npx serve -l 8080 .

# 브라우저에서 http://localhost:8080 접속
```

## 🎯 핵심 기능

### 📋 선수 카드 관리
- **이미지 업로드**: 드래그&드롭, 클릭, 클립보드 붙여넣기 지원
- **자동 최적화**: 이미지 압축 및 리사이징 (JPEG 0.7, 최대 1280px)
- **포지션 설정**: Top/Jungle/Mid/ADC/Support 선택 + 커스텀 역할
- **티어 입력**: 자유 입력 및 추천 목록 제공
- **선수 각오**: 경매 화면에 표시되는 한마디

### 👑 팀장 시스템
- 최대 4명까지 팀장 지정 가능
- 팀장은 경매 대상에서 자동 제외
- 팀장 이름을 팀명으로 사용하는 옵션 제공

### 🔨 경매 진행
- **입찰 시스템**: 5포인트 단위, 시작가 5포인트
- **예산 관리**: 팀별 잔여 예산 실시간 표시
- **역할 제한**: 같은 포지션 중복 방지 옵션
- **지명 모드**: 턴제 방식으로 선수 지명 가능
- **되돌리기**: 직전 입찰/낙찰 취소 기능

### ⏱️ 타이머 기능
- 입찰 시간 제한 설정 (5-300초)
- 시각적/음향 알림
- 타이머 활성화/비활성화 옵션

### 📁 데이터 관리
- **자동 저장**: LocalStorage 기반 실시간 저장
- **상태 복원**: 이전 경매 상태 불러오기
- **CSV 내보내기**: 팀별 로스터 및 비용 정보
- **JSON 내보내기**: 전체 경매 데이터 및 설정

## 🎮 사용 방법

### 1️⃣ 초기 설정
1. **선수 정보 입력**: 하단 "선수 카드" 섹션에서 선수별 정보 작성
2. **팀장 지정**: 선수 카드에서 팀장 체크박스 선택
3. **경매 옵션 설정**:
   - 포지션 중복 방지
   - 경매 순서 랜덤화
   - 지명 모드 활성화

### 2️⃣ 경매 진행
1. **경매 시작** 버튼 클릭
2. 현재 선수 정보 확인
3. 입찰 팀 선택 및 금액 입력
4. **입찰** → **낙찰 처리** 또는 **패스/다음 선수**

### 3️⃣ 결과 관리
1. **상태 저장**: 현재 진행 상황 저장
2. **CSV 내보내기**: 팀별 최종 결과 다운로드
3. **JSON 내보내기**: 전체 데이터 백업

## ⚙️ 기술 스펙

| 구성요소 | 기술 |
|---------|------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **스타일링** | CSS Custom Properties, Flexbox, Grid |
| **저장소** | Browser LocalStorage |
| **호환성** | 모던 브라우저 (Chrome, Firefox, Safari, Edge) |

### 📁 파일 구조
```
team_auction/
├── index.html          # 메인 HTML 파일
├── style.css           # 스타일시트
├── app.js             # 애플리케이션 로직
├── assets/            # 아이콘 및 이미지 (선택사항)
└── README.md          # 프로젝트 문서
```

## 🎨 UI 커스터마이징

### 테마 색상
CSS Custom Properties를 통해 쉽게 커스터마이징 가능:

```css
:root {
  --bg-primary: #0f1221;      /* 메인 배경 */
  --accent-primary: #7aa2ff;   /* 강조 색상 */
  --accent-secondary: #5de5b2; /* 보조 강조 색상 */
  --text-primary: #e8ebff;     /* 메인 텍스트 */
}
```

### UI 크기 조절
애플리케이션 하단에서 3단계 크기 조절 가능:
- 작게 (90%)
- 보통 (100%)
- 크게 (120%)

## ⚠️ 제한사항 및 고려사항

- **브라우저 저장 용량**: LocalStorage 한계 (일반적으로 5-10MB)
- **이미지 크기**: 큰 이미지 다수 사용 시 성능 저하 가능
- **오프라인 전용**: 외부 이미지 URL은 인터넷 연결 필요
- **브라우저 호환성**: IE는 지원하지 않음

## 🔧 문제 해결

### 자주 묻는 질문

**Q: 이미지가 표시되지 않아요**
A: 이미지를 드래그&드롭이나 클릭 업로드로 다시 등록해보세요. 외부 URL 이미지는 인터넷 연결이 필요합니다.

**Q: 데이터가 사라졌어요**
A: 브라우저 데이터 삭제 시 LocalStorage도 함께 삭제됩니다. 정기적으로 JSON 내보내기를 통해 백업하세요.

**Q: 경매 중 오류가 발생했어요**
A: **되돌리기** 버튼을 사용하거나, 최악의 경우 **이전 상태 불러오기**를 시도하세요.

## 🤝 기여

버그 리포트나 기능 제안은 GitHub Issues를 통해 제출해주세요.

## 📄 라이선스

이 프로젝트는 **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)** 라이선스를 따릅니다.

- ✅ 비영리 용도로 자유롭게 사용/수정/배포 가능
- ✅ 출처 표시 필수
- ❌ 상업적 이용 금지

자세한 내용: [CC BY-NC 4.0 License](https://creativecommons.org/licenses/by-nc/4.0/)

## 👨‍💻 개발자

**Made by Mad-Nut**
GitHub: [Dev-Nut00](https://github.com/Dev-Nut00)

## ⚖️ 저작권 고지

League of Legends 및 관련 이미지의 저작권은 **Riot Games, Inc.**에 있습니다.
This application is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.

---

> 🎮 **즐거운 경매 되세요!** LoL 팀 구성의 새로운 재미를 경험해보세요.