# 독서의숲 인수인계 문서 (HANDOFF)

> **다음 AI 에이전트 / 사람에게**: 작업을 시작하기 전에 이 문서를 끝까지 읽어주세요. 결정된 사항을 다시 묻거나 뒤집지 말고, 바꿔야 할 이유가 있으면 사용자에게 먼저 확인하세요.
> 마지막 갱신: 2026-10-07 (6차 + 다음 쪽수 · 교보문고 베스트셀러 + 탭 사운드 지연 개선 · 갤러리 탭바 유지 + 8차: 숲 친구 여러 개 · 땅 넓히기 무제한/끌어서 둘러보기 · 캐릭터 4종까지)

## 1. 프로젝트 한 줄 요약
책을 읽을수록 나만의 **아이소메트릭 숲**에 나무가 자라는 **독서 기록 앱**. 파스텔 자연 톤, 말랑한 입체 버튼, 가벼운 효과음. 현재는 **한국 출시 버전**(한국어 UI · 국내 도서)이고, 웹(Vercel)으로 먼저 운영 중이며 앱(iOS/Android)은 같은 코드(Expo)로 나중에 출시합니다.

- 배포 주소: https://reading-forest-nine.vercel.app
- 저장소: https://github.com/kysmk1987-lgtm/reading-forest (공개, 기본 브랜치 `main`)

## 2. 기술 스택
| 영역 | 사용 |
| --- | --- |
| 앱 | **Expo SDK 57** (React Native 0.86, React 19.2), **Expo Router**(파일 = 화면, `src/app/`), TypeScript 6 |
| 상태 | Zustand + persist (키 `rf-<이름>`, `{state, version}` 마이그레이션), TanStack React Query |
| 그래픽 | react-native-svg (나무 · 숲 · 지도 · 일러스트 전부 SVG로 직접 그림) |
| 다국어 | i18next — `src/lib/i18n/locales/ko.ts`(활성) · `en.ts`(비활성, 키 동기화 유지) |
| 서버 함수 | Vercel Serverless (`api/` 폴더): 도서 검색 프록시 · 상세 · 베스트셀러 · 지역(geo) |
| 백엔드 | **Supabase** (Postgres + Auth + Realtime + Storage), RLS로 보호 |
| 배포 | Vercel (웹 SPA, `main`에 push하면 자동 배포) |

⚠️ Expo는 SDK마다 API가 바뀝니다. Expo 관련 코드를 쓰기 전에 `AGENTS.md`의 지침대로 **버전에 맞는 문서**를 확인하세요. 패키지 추가는 `npx expo install`.

## 3. 폴더 구조 (요약)
```
api/            Vercel 함수: books/search · books/[isbn] · books/bestsellers · geo
  _lib/         providers(카카오·알라딘·네이버) · daum(쪽수 스크래핑) · kyobo(베스트셀러) · pages(국립중앙도서관·정보나루)
src/app/        화면(라우트): (tabs)/ 숲·서재·기록·함께 읽기·마이 + 숨김 탭 gallery, book/[id], search, trees, card/, wrapped, forest/[userId], room/[id]
src/features/   기능별 코드: forest · library · records · together · sound · gallery · wrapped · reviews · books · auth
src/components/ 디자인 시스템(ui/) · 탭바 · 표지 등
src/stores/     Zustand 스토어 (library, settings, forest, profile, entitlements, bookCache, timer …)
src/config/     locale.ts(언어·지역) · app.ts(API 주소) · bestsellers.ts(직접 고른 목록)
supabase/       migrations/0001~0006 + setup*.sql(붙여넣기용, npm run build:sql로 생성)
scripts/        테스트 · 생성 스크립트 · setup-new-pc.ps1 · e2e/(헤드리스 브라우저 점검)
docs/           HANDOFF.md(이 문서) · screenshots/
```
자세한 파일별 설명은 README의 "폴더 구조"를 보세요.

## 4. 지금까지 결정된 사항 (바꾸지 말 것)
1. **한국 우선**: 한국어 UI만 활성. 다른 언어·해외 도서는 `src/config/locale.ts` + `EXPO_PUBLIC_ENABLED_LOCALES` / `EXPO_PUBLIC_BOOK_REGION`으로 나중에 켤 수 있게 구조만 준비(en.ts 키는 계속 맞춰둠).
2. **게임 관련 표현 금지**: 특정 게임(예: 동물의 숲 등)을 연상시키는 이름 · 문구 · 그림을 쓰지 않음. 자체 파스텔 자연 디자인.
3. **Supabase 사용** (Firebase에서 전환 완료). 다른 Supabase 프로젝트는 절대 건드리지 않음.
4. **도서 데이터**: 검색은 **카카오 책 검색 API**(서버 프록시, 키는 서버에만). **쪽수는 다음(Daum) 책 페이지 스크래핑**이 1순위, **베스트셀러는 인터넷 교보문고 JSON 스크래핑**이 1순위 — 이용약관 · 구조 변경 위험을 **사용자가 알고 수락함**. 끄는 스위치: `ENABLE_DAUM_PAGES=false`, `ENABLE_KYOBO_BESTSELLERS=false`.
5. **알라딘 OpenAPI는 2026-10-30 종료** → 의존하지 않음(키가 있으면 보조로만).
6. **함께 읽기 지도는 한국 지도**(17개 시·도). 세계 지도/3D 지구본은 `EXPO_PUBLIC_MAP_SCOPE=GLOBAL` 자리만 있음.
7. **OCR(사진 글자 인식) 제거** — tesseract.js 삭제. 다시 넣지 않음. (`expo-image-picker`는 2026-10-07 **문구 카드 '사진' 배경(프리미엄)** 용도로만 다시 설치 — OCR과 무관)
8. **번역 기능은 꺼짐** (`EXPO_PUBLIC_TRANSLATION_ENABLED` 플래그 + 스텁만 있음, 외부 번역 API 호출 없음).
9. **독서 DNA 결산 요약 카드 내보내기는 프리미엄 전용** (`entitlements` 게이팅 그대로).
   - 문구 카드 배경: 무료 = 종이 · 숲 · 수채화, 프리미엄 = 밤하늘 · 벚꽃 · 바다 · **사진(내 사진 업로드)** (`src/features/gallery/templates.ts`). 사진은 기기에서만 쓰이고, 갤러리에는 캡처된 카드 PNG(`cards` 버킷)에 합쳐져 올라가므로 별도 버킷 · 마이그레이션 없음(`template = 'photo'`로 저장).
   - 숲 꾸미기(2026-10-07 8차): 날씨는 하나만, **숲 친구(나비·무당벌레 무료 / 개구리·꿀벌·잠자리·반딧불이 프리미엄)는 여러 개 동시 선택**(`forestStore.critters` 배열, persist v1이 예전 `critter` 값을 변환, '없음' = 모두 끄기, 프리미엄이 꺼지면 잠긴 친구만 빠지고 남는 게 없으면 나비). 종류당 2마리(반딧불이는 혼자 6 · 같이 3)로 애니메이션 수를 제한.
   - **땅 넓히기 무제한**(제품 상한 없음, 좌표 기술 상한 `GARDEN_MAX = 1000`). 숲 카드는 최대 높이 380으로 고정되고, 숲이 넘치면 **끌어서 상하좌우로 둘러보기**(마우스 · 터치, `ForestGarden`의 `GardenPan` — RN responder/PanResponder, 추가 패키지 없음). 한 방향만 넘칠 때는 그 방향만 잡고 나머지는 페이지 스크롤로 넘김. 화면 중심이 땅(마름모) 밖으로 못 나가게 제한, 크기가 바뀌면 가운데로 재정렬, 나무를 누르면 말풍선이 보이도록 자동 이동. 바닥 타일 · 장식은 몇 개의 Path로 묶어 그려서 큰 숲도 가벼움.
   - 캐릭터: 무료 = 단발머리 · 짧은 머리 · 동글 안경 · **똥머리 · 캡모자**, 프리미엄 = 털모자 · 토끼 후드 · 곰돌이 후드 · 양갈래 · **고양이 후드 · 꽃 화관** (`src/features/profile/avatars.ts` + `AvatarArt.tsx`).
10. **결제(RevenueCat) · 광고(AdMob) · 스토어 출시는 보류** — 사용자가 직접 검토한 뒤 진행. 요금제 게이팅 구조(`src/lib/entitlements.ts`, 마이 → 프리미엄 미리보기(개발용))는 그대로 둠.
11. 진동은 앱에서 항상 켜짐(설정 토글 없음). 한줄평 공개 범위 기본값은 전체 공개.
   - 효과음(탭 사운드 등)은 `src/lib/feedback.ts` → `src/lib/sfx.ts`(앱: 시작할 때 expo-audio 플레이어를 미리 만들어 두고, 탭은 3개를 돌려 씀) / `src/lib/sfx.web.ts`(웹: Web Audio API + 미리 디코딩한 버퍼, 첫 pointerdown에서 AudioContext 깨움). 웹에서 expo-audio(HTMLAudioElement)를 쓰면 매번 지연이 생기므로 되돌리지 말 것. 소리는 지금처럼 `onPress`에서 냄(`onPressIn`으로 바꾸면 스크롤할 때도 소리가 남).
   - **문장 갤러리는 `(tabs)` 안의 숨김 탭**(`src/app/(tabs)/gallery.tsx`, `href: null`)이라 하단 탭바 · 광고 자리가 그대로 보임. 주소는 그대로 `/gallery`. 탭 그룹은 `backBehavior="history"`(갤러리에서 뒤로 → 들어온 탭으로). 카드 만들기/카드 상세(`card/new`, `card/[id]`)는 화면을 넓게 쓰려고 루트 Stack에 그대로 둠(탭바 없음). 루트 Stack 화면에서 갤러리로 갈 때는 `router.navigate('/gallery')`를 써야 탭 그룹이 중복으로 쌓이지 않음.
12. 비밀 값은 절대 커밋하지 않음 (카카오 키, `.env.local`, service_role 키, DB 비밀번호). 커밋 전 `git diff --cached`를 키 패턴으로 검사.

## 5. 배포 (Vercel)
- 프로젝트: `reading-forest` (팀/스코프 `kysmk1987-8120s-projects`), GitHub `main`에 push → 자동 Production 배포.
- 상태 확인: `npx vercel ls reading-forest`, 수동 배포: `npx vercel --prod --yes`.
- 빌드: `npx expo export -p web` → `dist/`, `/api` 외 경로는 `index.html`로 리라이트 (`vercel.json`).

### 환경 변수 (이름만 — 값은 Vercel에 있음)
| 이름 | Production / Preview | Development | 비고 |
| --- | --- | --- | --- |
| `KAKAO_REST_API_KEY` | 민감(Secret) | 일반(받아올 수 있음) | 서버 전용, `EXPO_PUBLIC_` 붙이지 말 것 |
| `EXPO_PUBLIC_SUPABASE_URL` · `EXPO_PUBLIC_SUPABASE_ANON_KEY` | 일반 | 일반 | 앱 번들에 포함(RLS로 보호) |
| `DATA4LIBRARY_KEY` | 민감 | 일반 | 도서관 정보나루, **승인 대기 중** |
| `ENABLE_DAUM_PAGES` · `ENABLE_KYOBO_BESTSELLERS` | (없음 = 켜짐) | `true` | 끄려면 `false` |
| `NL_CERT_KEY` | (미등록) | (미등록) | 국립중앙도서관, 선택 |
| `ALADIN_TTB_KEY` · `NAVER_CLIENT_ID/SECRET` | (미등록) | (미등록) | 선택 |

새 PC에서는 `npx vercel env pull .env.local --environment=development`로 개발용 값을 그대로 받습니다(민감 변수는 받을 수 없어서 **Development에는 일반 변수로** 넣어둠). 새 변수를 추가할 때도 Development에는 일반으로 넣고 `.env.example`에 이름을 적어주세요.

## 6. Supabase
- 프로젝트 ref: `ucftmqkmjwwasknanimz` (서울 리전). 대시보드: https://supabase.com/dashboard/project/ucftmqkmjwwasknanimz
- 마이그레이션: `supabase/migrations/`
  | 파일 | 내용 | 운영 DB 적용 |
  | --- | --- | --- |
  | `0001_init.sql` | 프로필 · 책 · 서재 · 독서 로그 · 공개 숲 · 물 주기 | ✅ |
  | `0002_focus_minutes.sql` | 집중 시간 · 소리/독서실 기록 | ✅ |
  | `0003_gallery.sql` | 문장 카드 · 갤러리 · 블러 · Storage | ✅ |
  | `0004_garden_reviews.sql` | 나무 위치(`garden_x/y`) · 책 리뷰 · 신고 | ✅ (2026-10-07 확인) |
  | `0005_profile_forest_avatar.sql` | 프로필 숲 이름(`profiles.forest_name`) · 캐릭터(`profiles.avatar`) | ❌ **미적용** — `supabase/setup_0005.sql`을 SQL Editor에서 실행 (적용 전에는 앱이 이 기기에만 저장하고 서버 동기화는 조용히 건너뜀). 캐릭터 id는 정규식 check라 새 캐릭터를 추가해도 수정 불필요 |
  | `0006_garden_unlimited.sql` | 땅 넓히기 무제한: `user_books.garden_x/y` check를 0~11 → **0~999**로 넓힘 | ❌ **미적용** — `supabase/setup_0006.sql` 실행 (0005 다음). 적용 전에는 12칸을 넘는 나무 위치만 빼고 동기화(23514 오류 시 자동 재시도) — 그 위치는 이 기기에만 남음 |
- 새 마이그레이션은 `0007_…sql`로 추가 → `npm run build:sql`로 `setup_0007.sql` 생성 → 사용자가 SQL Editor에 붙여넣어 실행(에이전트는 DB 비밀번호를 묻지 않음). 적용된 파일은 고치지 말고 새 번호로 추가.
- 로컬 테스트는 `scripts/e2e/mock-sb.mjs`(PGlite로 실제 마이그레이션 실행)를 사용.

## 7. 남은 일 (우선순위 순)
0. **마이그레이션 0005 · 0006 적용** — `supabase/setup_0005.sql` → `supabase/setup_0006.sql` 순서로 Supabase SQL Editor에 붙여넣고 Run (숲 이름 · 캐릭터 동기화, 12칸 넘는 나무 위치 동기화).
1. **도서관 정보나루 키 승인 대기** — 승인되면 코드 변경 없이 자동 사용(베스트셀러 2순위, 쪽수 보조). 확인: 정보나루 마이페이지의 상태가 '승인'인지.
2. **카카오 로그인 공급자 설정**(README "로그인 설정" 참고): Kakao Developers에서 카카오 로그인 활성화 · Redirect URI `https://ucftmqkmjwwasknanimz.supabase.co/auth/v1/callback` · 동의항목 · Client Secret → Supabase Authentication → Providers → Kakao 입력. (구글은 선택)
3. **테스트용 익명 사용자 정리**: 자동 점검 중 운영 DB에 익명 사용자 몇 명과 테스트 서재 기록이 생겼음 → Supabase → Authentication → Users에서 익명(anonymous) 사용자 삭제(관련 데이터는 함께 삭제됨).
4. (선택) 국립중앙도서관 `NL_CERT_KEY` 발급 — 다음 페이지에 쪽수가 없는 책의 보조.
5. **다음 단계(사용자 검토 후)**: 인앱 결제(RevenueCat) · 광고(AdMob) · 앱 스토어 출시(EAS Build/Submit).

## 8. 실행 · 테스트 · 배포
```powershell
npx expo start --web          # 개발 서버 (http://localhost:8081, /api는 배포 사이트를 호출)
npx expo lint                 # 린트 (경고 2개는 기존 것)
npx tsc --noEmit              # 타입 검사
npm test                      # 오프라인 테스트 5종 (도서 API · 동기화 · 갤러리/결산 · 숲/리뷰/쪽수 · 스크래퍼 파서)
npx expo export -p web        # 웹 빌드 확인
git push origin main          # → Vercel 자동 배포
node scripts/e2e/e2e-live-s6c.mjs   # 배포 사이트 헤드리스 점검 (Edge 필요)
```
- 작업 마무리 규칙: lint · tsc · test 통과 → 커밋 전 비밀 값 검사 → push → Vercel Ready 확인.
- 한국어가 들어간 파일은 편집 도구로 고치세요(PowerShell 명령으로 쓰면 글자가 깨질 수 있음). 커밋 메시지는 UTF-8 파일로 `git commit -F`.

## 9. 스크립트
| 명령 / 파일 | 설명 |
| --- | --- |
| `새PC설정.bat` / `scripts/setup-new-pc.ps1` | 새 PC 한 번에 설정 (설치 · 로그인 · npm ci · Vercel 연결 · `.env.local`). 저장소가 없을 때는 README "다른 PC에서 이어서 작업하기"의 한 줄 명령. ps1은 **BOM 있는 UTF-8 + CRLF**로 유지할 것(PowerShell 5.1 한글) |
| `npm run build:sql` | `supabase/migrations` → `setup*.sql` 생성 |
| `npm run generate:sound` · `generate:icons` | 효과음(WAV) · 앱 아이콘 생성 |
| `scripts/generate-ambient.mjs` · `generate-korea-map.mjs` | 백색소음 · 한국 지도 데이터 생성 |
| `scripts/test-*.ts` | 오프라인 테스트 (`npm test`) |
| `scripts/e2e/` | 헤드리스 Edge 점검 · 가짜 Supabase (사용법은 그 폴더의 README) |
