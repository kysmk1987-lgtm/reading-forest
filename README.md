# 🌳 독서의숲

> 책을 읽으면 나무가 자라는 독서 기록 앱

따뜻한 파스텔 자연 팔레트(잔디 초록 · 나무 · 베이지), 동글동글한 폰트, 눌리면 쏙 들어가는 말랑한 입체 버튼, 가벼운 탭 사운드와 진동으로 "책 읽는 숲"을 키워가는 앱입니다. 현재는 **한국 출시 버전**(한국어 UI · 국내 도서 검색)입니다.

<p>
  <img src="docs/screenshots/forest.png" width="180" alt="나만의 독서 숲" />
  <img src="docs/screenshots/tree-stages.png" width="180" alt="나무 도감" />
  <img src="docs/screenshots/calendar.png" width="180" alt="독서 캘린더" />
  <img src="docs/screenshots/stats.png" width="180" alt="통계" />
  <img src="docs/screenshots/water.png" width="180" alt="물 주기" />
</p>
<p>
  <img src="docs/screenshots/detail.png" width="180" alt="책 상세" />
  <img src="docs/screenshots/library.png" width="180" alt="서재" />
</p>

- **스택**: Expo (SDK 57) · TypeScript · Expo Router · Zustand(persist + AsyncStorage) · TanStack Query · Firebase JS SDK(Auth/Firestore) · i18next + expo-localization · Vercel 서버리스 함수(도서 검색 프록시)
- **플랫폼**: iOS / Android / 웹 (웹은 `npx expo export -p web` → Vercel 호스팅)
- **배포 주소**: https://reading-forest-nine.vercel.app

---

## 🚀 실행 방법

```powershell
npm install
npx expo start          # QR 코드로 Expo Go 실행, w 키로 웹
npx expo start --web    # 바로 웹으로 실행 (http://localhost:8081)
```

| 명령 | 설명 |
| --- | --- |
| `npm run typecheck` | 앱 + 서버 함수 TypeScript 검사 |
| `npm run test:api` | 도서 검색 함수 오프라인 테스트 (가짜 응답 사용, 키 불필요) |
| `npm run export:web` | 웹 정적 빌드 → `dist/` |
| `npm run generate:sound` | 탭 사운드(`assets/sounds/tap.wav`) 재생성 |

### 로컬 개발에서 도서 검색은 어떻게 동작하나요?
도서 검색은 Vercel 서버리스 함수(`/api/books/*`)를 거칩니다. `npx expo start --web`으로 띄운 개발 서버(8081)에는 이 함수가 없기 때문에:

- **기본값**: 개발 모드와 모바일 앱은 자동으로 **배포된 사이트의 `/api`**(https://reading-forest-nine.vercel.app)를 호출합니다. 별도 설정 없이 검색이 됩니다(배포 환경에 키가 등록되어 있어야 함).
- **함수까지 로컬에서 수정·테스트하려면**: `npx vercel dev`(기본 3000 포트)로 함수를 띄우고 `.env`에 `EXPO_PUBLIC_API_BASE_URL=http://localhost:3000`을 넣은 뒤 `npx expo start --web`을 실행하세요. 키는 `npx vercel env pull .env.local`로 받아올 수 있습니다.

## 🔑 도서 검색 API 키 설정 (필수)

키는 **서버 전용 환경 변수**(이름에 `EXPO_PUBLIC_`이 없음)라 앱 번들에 노출되지 않습니다. 하나 이상 등록하면 되며, **카카오 → (알라딘) → 네이버** 순서로 사용합니다. 키가 하나도 없으면 검색 화면에 "책 검색 준비가 아직 끝나지 않았어요" 안내가 표시됩니다.

| 변수 | 상태 | 용도 | 발급 방법 |
| --- | --- | --- | --- |
| `KAKAO_REST_API_KEY` | ✅ **등록됨** (Production·Preview·Development) | **기본 검색** (제목·저자·출판사·ISBN, 표지, 소개, 정가, 출간일, 옮긴이). **쪽수는 제공하지 않음** | [Kakao Developers](https://developers.kakao.com) 로그인 → 내 애플리케이션 → 애플리케이션 추가 → 앱 키의 **REST API 키** 복사. ⚠️ 키 설정의 **허용 IP(클라이언트 IP) 제한은 켜지 마세요** — Vercel 서버 IP는 고정이 아닙니다 |
| `ALADIN_TTB_KEY` | ⛔ **종료 예정** | 상세 보강 (큰 표지, 쪽수, 분류) | 알라딘 OpenAPI는 신규 키 발급이 2026-09-04에 끝났고 서비스가 **2026-10-30 종료**됩니다. 기존 키가 있다면 그때까지만 동작하며, 없어도 앱은 정상 동작합니다 |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 선택 | 예비 검색 | [Naver Developers](https://developers.naver.com/apps) → 애플리케이션 등록 → 사용 API에서 **검색** 선택 → Client ID / Secret 복사 |

**쪽수가 없는 책**: 카카오는 쪽수를 주지 않으므로, 서재에 담을 때(읽고 있는 책) 또는 진행률을 업데이트할 때 **전체 쪽수를 직접 입력**할 수 있습니다. 입력한 쪽수로 진행률(%)과 성장 단계가 계산됩니다. 쪽수 자동 보강이 필요하면 추후 **국립중앙도서관 ISBN 서지정보 API**(무료, 쪽수 포함)를 연동하는 방안이 있습니다.

Vercel에 등록 (`--value`로 넘기면 프롬프트 없이 등록되고 줄바꿈도 섞이지 않습니다):

```powershell
npx vercel env add KAKAO_REST_API_KEY production --value "<키>" --sensitive --yes
npx vercel env add KAKAO_REST_API_KEY preview --value "<키>" --sensitive --yes
npx vercel env add NAVER_CLIENT_ID production --value "<ID>" --sensitive --yes          # 선택
npx vercel env add NAVER_CLIENT_SECRET production --value "<SECRET>" --sensitive --yes  # 선택
npx vercel --prod --yes                                                                  # 재배포해야 적용됩니다
```

> 대시보드(Project → Settings → Environment Variables)에서 등록해도 됩니다. 로컬 `vercel dev`용 키는 `.env.local`(git 제외)에 둡니다.

### API 엔드포인트

| 경로 | 설명 |
| --- | --- |
| `GET /api/books/search?q=검색어&field=keyword\|title\|author\|publisher\|isbn` | 국내 도서 검색. 응답 `{ books, source }`, 10분 캐시 |
| `GET /api/books/{ISBN}` | 상세 정보 (카카오 + 네이버 병합, 알라딘 키가 있으면 쪽수·분류 보강: 표지, 소개, 저자/옮긴이, 정가, 서점 링크), 1일 캐시 |

오류 응답은 `{ error: { code, message } }` 형식이며 `code`는 `NO_KEYS`, `BAD_REQUEST`, `NOT_FOUND`, `RATE_LIMITED`, `UPSTREAM` 중 하나입니다. 앱은 코드별로 한국어 안내를 보여줍니다.

## ⚙️ 그 밖의 환경 변수

`.env.example`을 `.env`로 복사해서 사용합니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `EXPO_PUBLIC_ENABLED_LOCALES` | `ko` | 활성 언어 목록(쉼표 구분) |
| `EXPO_PUBLIC_BOOK_REGION` | `KR` | 도서 검색 지역 |
| `EXPO_PUBLIC_API_BASE_URL` | (자동) | `/api` 서버 주소 |
| `EXPO_PUBLIC_FIREBASE_*` (6개) | 없음 | 설정 시 익명/구글 로그인과 Firestore 동기화(`users/{uid}/library`) 활성화. 없으면 로컬 게스트 모드 |

### Firebase 연결 순서 (나중에)
1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 생성 → 웹 앱 추가 → 설정값을 `.env`/Vercel에 입력
2. Authentication → 로그인 방법에서 **익명**, **Google** 사용 설정, 승인된 도메인에 `reading-forest-nine.vercel.app` 추가
3. Firestore 데이터베이스 생성 후 저장소의 **`firestore.rules`** 내용을 콘솔 → Firestore → 규칙에 붙여넣고 게시합니다.
   - `users/{uid}/**`: 본인만 읽기/쓰기 (서재 동기화)
   - `forests/{uid}`: 누구나 보기, 주인만 공개(쓰기) — 숲 공유 페이지
   - `forests/{uid}/waterings/{방문자uid}_{오늘UTC날짜}`: 방문자 본인만 생성, 수정·삭제 불가 → **숲 하나에 하루 한 번만 물 주기**
4. 연결하면 홈의 **공유** 버튼이 내 숲을 `forests/{uid}`에 공개하고 `/forest/{uid}` 링크를 공유합니다(Web Share API → 복사, 앱은 공유 시트). 방문자는 익명 로그인으로 물을 줍니다.

## 🌏 나중에 해외 언어·해외 도서를 켜는 방법

언어와 지역 설정은 `src/config/locale.ts` 한 곳에 모여 있습니다.

1. **번역 파일 추가**: `src/lib/i18n/locales/`에 `ko.ts`와 같은 구조로 파일을 만듭니다(예: `ja.ts`). `en.ts`는 이미 준비되어 있고 현재는 비활성 상태입니다. `TranslationResources` 타입 덕분에 빠진 키가 있으면 타입 검사에서 바로 알려줍니다.
2. **등록**: `src/config/locale.ts`의 `SUPPORTED_LOCALES`, `LOCALE_LABELS`와 `src/lib/i18n/index.ts`의 `ALL_RESOURCES`에 새 언어를 추가합니다.
3. **활성화**: 환경 변수 `EXPO_PUBLIC_ENABLED_LOCALES=ko,en,ja`를 설정하고 다시 빌드합니다. 활성 언어가 2개 이상이 되면 **마이 → 설정에 언어 선택이 자동으로 나타납니다.** 기기 언어가 활성 목록에 있으면 그 언어로 시작합니다.
4. **해외 도서 검색**: `EXPO_PUBLIC_BOOK_REGION=GLOBAL`로 바꾸면 `src/lib/api/global/`의 Google Books → Open Library 검색을 사용합니다(국내 프록시 대신). 지역별 서버 프로바이더가 필요해지면 `api/_lib/providers.ts`에 추가하세요.

## 🗂️ 폴더 구조

```
api/                        # Vercel 서버리스 함수 (도서 검색 프록시, 키는 서버에만 존재)
├─ books/search.ts          # GET /api/books/search
├─ books/[isbn].ts          # GET /api/books/{ISBN}
└─ _lib/                    # providers(카카오·알라딘·네이버), 병합, ISBN 처리, 응답/캐시 헬퍼
src/
├─ app/                     # Expo Router 라우트 (파일 = 화면)
│  ├─ _layout.tsx           # 폰트·QueryClient·Auth 리스너·Stack, 웹에서는 모바일 폭(480px)으로 중앙 정렬
│  ├─ (tabs)/               # 하단 탭: 숲(index) · 서재 · 기록(records: 캘린더·통계) · 타이머 · 마이
│  ├─ search.tsx            # 책 검색 (제목/저자, ISBN, 바코드는 추후)
│  ├─ book/[id].tsx         # 책 상세 + 서재 담기
│  ├─ forest/[userId].tsx   # 공개 숲 페이지 (읽기 전용 + 물 주기), /forest/demo = 데모 숲
│  ├─ trees.tsx             # 나무 도감 (종류별 성장 단계)
│  └─ gallery.tsx           # 문장 갤러리 (곧 만나요, 마이에서 진입)
├─ config/                  # locale.ts(언어·지역), app.ts(API 주소)
├─ components/
│  ├─ ui/                   # 디자인 시스템: Button(말랑 입체), Card, Chip, ProgressBar, Input, StarRating,
│  │                        #   Screen, Sheet(바텀시트), SegmentedControl, DateField(.web), EmptyState, IconButton
│  ├─ ForestTabBar.tsx      # 나무 판자 느낌의 커스텀 탭바 (+ 광고 자리)
│  └─ BannerAdPlaceholder.tsx · BookCover.tsx · GrowthBadge.tsx(작은 나무 그림)
├─ features/
│  ├─ auth/useAuth.ts       # Firebase 익명/구글 로그인 훅 (미설정 시 게스트)
│  ├─ books/                # 검색/상세 쿼리 훅(상세 정보로 서재 기록 자동 보강), 검색 결과 아이템
│  ├─ forest/               # TreeGraphic(SVG 나무), AnimatedTree(흔들림·성장 애니메이션), ForestGarden(아이소메트릭 숲),
│  │                        #   species(나무 종류), GrowthCelebration, SpeciesSheet, 날씨, 공유/물 주기(publicForest, demo)
│  ├─ records/              # 독서 캘린더, 통계, 집계 함수
│  └─ library/              # 기록 시트(4가지 상태), 서재 카드, 진행률 시트, 정렬, 성장 단계, 독서 로그, Firestore 동기화
├─ lib/
│  ├─ api/books.ts          # 지역별 검색 클라이언트 (KR → /api 프록시)
│  ├─ api/global/           # 해외용 Google Books · Open Library (BOOK_REGION=GLOBAL일 때만)
│  ├─ i18n/                 # i18next 초기화 + locales/ko.ts(활성), en.ts(비활성)
│  ├─ firebase.ts · feedback.ts(사운드+햅틱) · entitlements.ts(무료/프리미엄)
│  └─ confirm.ts · date.ts · storage.ts · queryClient.ts
├─ stores/                  # Zustand: library(+독서 로그), profile, settings, bookCache, forest(날씨·물 주기), celebration
├─ theme/                   # colors · typography · spacing(radius) · shadows
└─ types/                   # Book, LibraryEntry, ReadingStatus ...
scripts/test-book-api.ts    # 도서 API 오프라인 테스트
firestore.rules             # Firestore 보안 규칙 (서재 동기화, 숲 공유, 하루 한 번 물 주기)
vercel.json                 # 빌드 설정, /api 제외 SPA 리라이트, 함수 설정
```

## ✅ 2차 기능 — 독서 숲

- **하단 탭 5개 (재구성)**: 숲 · 서재 · **기록**(새로 추가: 캘린더·통계) · 타이머 · 마이. 갤러리는 탭에서 빠지고 **마이 → 문장 갤러리 카드**로 들어갑니다(아직 "곧 만나요").
- **나무 성장 그래픽** (react-native-svg, 웹·앱 공통): 씨앗(0%) → 새싹(10%) → 묘목(35%) → 어린 나무(60%) → 큰 나무(85%) → 완독 시 **열매 나무**(열매/꽃). 은은한 흔들림 애니메이션, 단계가 오르면 **"나무가 자랐어요!"** 성장 애니메이션 + 효과음 + 진동. 서재·홈의 이모지 단계 아이콘도 작은 나무 그림으로 교체.
- **나만의 독서 숲** (홈): 아이소메트릭(2.5D) 잔디 타일 정원. 읽는 중/완독 = 나무, 중단 = 그루터기, 읽고 싶은 책 = 씨앗 화분. 책이 늘면 정원이 넓어지고(3×3 → 4×4 → …) 옆으로 밀어서 볼 수 있어요. 나무를 누르면 표지·제목·진행률 말풍선 → 책 상세로 이동.
- **나무 종류**: 무료 3종(둥근나무·소나무·사과나무, 책마다 자동 배정 + 말풍선의 **나무 바꾸기**), 프리미엄 3종(벚나무·바오밥나무·단풍나무)과 **숲 날씨(비·눈)** 는 잠금 표시(`entitlements` 모듈, 마이 → 프리미엄 미리보기(개발용) 스위치로 테스트). **나무 도감**(`/trees`)에서 종류별 성장 단계를 볼 수 있어요.
- **독서 캘린더**: 월별 달력, 기록이 있는 날엔 책 표지 썸네일(+n), 전체 보기/완독 보기, 이전/다음 달, 날짜를 누르면 그날 읽은 책 목록.
- **통계**: 읽는 중·완독·기록 수, 이번 달 독서한 날 링, 월별 독서량(권수/페이지 전환, 연도 선택).
- **독서 로그**: 책 추가·진행률 업데이트·완독 때마다 `(날짜, 책, 읽은 쪽수)` 기록이 자동 저장됩니다. 기존 서재 데이터는 업데이트 시 시작일/완독일 기준으로 로그가 자동 생성됩니다(스토어 버전 1 마이그레이션).
- **물 주기(응원)**: 공개 숲 페이지 `/forest/{id}` (읽기 전용 숲 + **물 주기 💧** 버튼, 물방울 애니메이션 + 횟수, 하루 한 번).
  - **Firebase 연결 전(현재)**: 공유 버튼을 누르면 "Firebase 연결 후 공개 공유 가능" 안내와 함께 **내 숲 미리보기**, **데모 숲(`/forest/demo`)** 둘러보기, 데모 링크 복사를 제공합니다. 물 주기는 이 기기에만 기록됩니다.
  - **Firebase 연결 후**: 내 숲을 Firestore에 공개하고 링크를 공유, 방문자 물 주기는 Firestore 규칙으로 하루 한 번 제한.

## ✅ 1차 기능

- **하단 탭 5개**: 숲, 서재, 타이머(디자인된 "곧 만나요" 카드), 마이(프로필·닉네임·요금제 배지·프리미엄 카드·설정)
- **국내 도서 검색**: 제목/저자/출판사 · ISBN, 표지·제목·저자·출판사·출간일 표시, 이미 담은 책은 상태 배지
- **책 상세**: 큰 표지, 책 소개, 저자/옮긴이, 출판사, 출간일, 쪽수, ISBN, 정가, 분류, 서점 링크
- **기록 바텀시트** (상태별 입력 항목)
  - 읽은 책: 시작/종료일 · 별점 · 한줄평(500자)
  - 읽고 있는 책: 시작일 · 전체 쪽수(책 정보에 없으면 직접 입력) · 현재 진행(쪽 ↔ % 전환) · 성장 단계 미리보기
  - 읽고 싶은 책: 기대지수(하트) · 기대평
  - 중단한 책: 시작/중단일 · 별점 · 한줄평
- **서재**: 상태별 탭 + 개수, 정렬(최신 저장순/오래된 저장순/최근 수정순/제목순/평점순), 진행률 바(% · 현재/전체 쪽), 수정·삭제, 진행률 빠른 업데이트(100% 도달 시 자동 완독 처리)
- **인증**: Firebase 설정 시 익명/구글(웹 팝업) 로그인 + Firestore 동기화, 미설정 시 로컬 게스트 프로필
- **요금제 게이팅**: `entitlements` 모듈(`isPremium`, 기본 무료) + 무료 사용자에게만 하단 광고 자리 표시

## 🗺️ 로드맵

| 단계 | 내용 |
| --- | --- |
| **1차** | 기반 + 기본 독서기록 ✅ |
| **2차** | 독서 숲 — 성장 그래픽, 아이소메트릭 숲, 캘린더/통계, 물주기 ✅ (공개 공유는 Firebase 연결 후) |
| **3차** | 뽀모도로 · 백색소음 · 3D 지구본 · 실시간 접속자 · 조용한 응원 · 테마룸 |
| **4차** | 문장 카드(OCR) · 갤러리 · 번역(Functions, 무료 하루 10회) · 스마트 블러 |
| **5차** | 독서 결산 · 인앱 결제(RevenueCat)/광고(AdMob) · 출시 |

## ☁️ 배포 (Vercel)

`vercel.json`이 빌드 명령(`npx expo export -p web`), 출력 폴더(`dist`), `/api`를 제외한 SPA 리라이트(나머지 경로 → `/index.html`)를 지정합니다. `api/` 폴더는 자동으로 서버리스 함수가 됩니다.

```powershell
npx vercel --prod --yes     # 수동 배포
npx vercel git connect      # GitHub 저장소 연결 → push 시 자동 배포
```
