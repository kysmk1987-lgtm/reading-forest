# 독서의숲 인수인계 문서 (HANDOFF)

> **다음 AI 에이전트 / 사람에게**: 작업을 시작하기 전에 이 문서를 끝까지 읽어주세요. 결정된 사항을 다시 묻거나 뒤집지 말고, 바꿔야 할 이유가 있으면 사용자에게 먼저 확인하세요.
> 마지막 갱신: 2026-10-08 (함께 읽기 재구성: 독서 타이머(반복 · 5초 전 알림 · 소리 자동 재생 · 잠금화면 타이머) + 독서실 순위 · 책 상세 '이 책 읽기 시작') · 2026-10-08 (책 소개 전체(다음 책소개) + 더보기 · 캘린더 찜 표시 삭제) · 2026-10-07 (6차 + 다음 쪽수 · 교보문고 베스트셀러 + 탭 사운드 지연 개선 · 갤러리 탭바 유지 + 8차: 숲 친구 여러 개 · 땅 넓히기 무제한/끌어서 둘러보기 · 캐릭터 4종까지 + 9차: 땅 좁히기 · 숲 확대/축소 + 독서의숲 베스트셀러 이름 · 보조 화면 탭바 유지 · 캘린더 시작/찜 표시 + 로그인 화면 먼저(로그인 게이트 · 이메일 가입) + 10차: 땅 최대 20×20 · 카드/결산 화면도 탭바 · 키보드가 열리면 탭바 숨김 + 로그인 보강: 중복 가입 안내 · 다른 기기 동기화 보강 · 한국어 인증/재설정 메일 템플릿 · 메일 재전송 타이머 · 동그란 카카오/구글 버튼)

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
  _lib/         providers(카카오·알라딘·네이버) · daum(쪽수 · 책소개 스크래핑) · kyobo(베스트셀러) · pages(국립중앙도서관·정보나루)
src/app/        화면(라우트): (tabs)/ 숲·서재·기록·함께 읽기·마이 + 숨김 탭 gallery, book/[id], search, trees, card/, wrapped, forest/[userId], room/[id]
src/features/   기능별 코드: forest · library · records · together · sound · gallery · wrapped · reviews · books · auth
src/components/ 디자인 시스템(ui/) · 탭바 · 표지 등
src/stores/     Zustand 스토어 (library, settings, forest, profile, entitlements, bookCache, timer …)
src/config/     locale.ts(언어·지역) · app.ts(API 주소) · bestsellers.ts(직접 고른 목록)
modules/        로컬 Expo 네이티브 모듈 (rf-ongoing-timer: Android 잠금화면 카운트다운 알림, 자동 링크)
supabase/       migrations/0001~0007 + setup*.sql(붙여넣기용, npm run build:sql로 생성) + templates/(한국어 인증 · 재설정 메일)
scripts/        테스트 · 생성 스크립트 · setup-new-pc.ps1 · e2e/(헤드리스 브라우저 점검)
docs/           HANDOFF.md(이 문서) · screenshots/
```
자세한 파일별 설명은 README의 "폴더 구조"를 보세요.

## 4. 지금까지 결정된 사항 (바꾸지 말 것)
1. **한국 우선**: 한국어 UI만 활성. 다른 언어·해외 도서는 `src/config/locale.ts` + `EXPO_PUBLIC_ENABLED_LOCALES` / `EXPO_PUBLIC_BOOK_REGION`으로 나중에 켤 수 있게 구조만 준비(en.ts 키는 계속 맞춰둠).
2. **게임 관련 표현 금지**: 특정 게임(예: 동물의 숲 등)을 연상시키는 이름 · 문구 · 그림을 쓰지 않음. 자체 파스텔 자연 디자인.
3. **Supabase 사용** (Firebase에서 전환 완료). 다른 Supabase 프로젝트는 절대 건드리지 않음.
4. **도서 데이터**: 검색은 **카카오 책 검색 API**(서버 프록시, 키는 서버에만). **쪽수는 다음(Daum) 책 페이지 스크래핑**이 1순위, **베스트셀러는 인터넷 교보문고 JSON 스크래핑**이 1순위 — 이용약관 · 구조 변경 위험을 **사용자가 알고 수락함**. 끄는 스위치: `ENABLE_DAUM_PAGES=false`, `ENABLE_KYOBO_BESTSELLERS=false`.
   - 화면 표시는 공급원과 상관없이 **"독서의숲 베스트셀러"**(검색 화면). 부제(예: "인터넷 교보문고 이번 주 종합 순위") · "출처: 교보문고" 문구는 2026-10-07 사용자 요청으로 **표시하지 않음**. 데이터 공급원은 그대로.
5. **알라딘 OpenAPI는 2026-10-30 종료** → 의존하지 않음(키가 있으면 보조로만).
6. **함께 읽기 지도는 한국 지도**(17개 시·도). 세계 지도/3D 지구본은 `EXPO_PUBLIC_MAP_SCOPE=GLOBAL` 자리만 있음.
   - **함께 읽기 탭 구성(2026-10-08 재구성)**: 상단 세그먼트는 **⏱️ 타이머 · 🏠 독서실** 두 개. 예전 '소리' · '지도' 탭은 없앰 — 소리는 타이머 안의 **소리 카드 → 소리 설정 시트**(`src/features/sound/SoundSheet.tsx`, 믹서 + '타이머와 함께 재생' · '휴식 때도 소리 재생' 스위치)로, **지도는 독서실 목록 맨 아래 접힌 '🗺️ 전국 독서 지도' 카드**로 옮김(보조 기능으로 낮춤).
   - **독서 타이머**(`src/features/together/timerEngine.ts` 순수 엔진 + `src/stores/timerStore.ts` persist `rf-timer` v1): 집중/휴식 선택 버튼 없음. 프리셋(25·5 / 50·10 / 15·3) 또는 직접 설정 → **집중 1회 + 휴식 1회 후 자동 종료**, '🔁 반복'을 켜면 최대 12회 반복(`REPEAT_CYCLES`). 시간은 **시작 시각(anchor) 기준으로 계산**(틱 수가 아님) → 앱을 껐다 켜도 이어지고, 백그라운드에서 지나간 집중 구간도 모두 기록, 지나간 알림 소리는 다시 울리지 않음(`audibleEvents`, 3초 넘게 지난 이벤트는 무음). 일시정지 · 계속 · '처음으로'(그때까지 집중한 분은 기록). 단계 끝 **5초 전 배너 + 작은 소리/진동**, 단계가 바뀔 때 다른 소리(`soon` · `to-break` · `to-focus` WAV, UI 소리 설정과 상관없이 울림). **집중 시간만** 연결한 책 기록 · 캘린더(`addFocusLog`)에 남고 휴식은 안 남음. 매초 상태를 저장하지 않고 이벤트가 있을 때만 저장.
   - **소리**: '시작'을 누르는 순간 고른 소리가 재생(웹 자동재생 규칙도 이 탭으로 해결). 휴식 중에는 기본으로 멈춤(설정으로 계속 재생 가능). 사용자가 직접 끈 소리는 그 타이머 동안 다시 켜지 않음(`mixerStore.owner`).
   - **잠금화면 · 알림**: Android는 로컬 네이티브 모듈 `modules/rf-ongoing-timer`(NotificationCompat 크로노미터 카운트다운, 계속 표시 · 무음)로 남은 시간을 보여주고 단계마다 갱신, 단계 끝 알림은 expo-notifications로 예약. 네이티브 모듈이 없는 빌드(Expo Go · 예전 빌드)에서는 expo-notifications의 고정 알림으로 대신함(시계가 움직이지 않음). **정확한 알람 권한(SCHEDULE_EXACT_ALARM)은 Play 정책 때문에 요청하지 않음** → 절전(Doze) 중에는 알림이 몇 분 늦을 수 있음. 웹은 탭 제목에 카운트다운('📖 12:34 집중 · 독서의숲') + 탭이 숨겨져 있을 때 Notification API. **iOS Live Activities는 범위 밖**(iOS는 예약 알림만).
   - **독서실 경쟁**: 방마다 '지금 읽는 사람 · 오늘 이 방에서 읽은 분 · 순위 · 내 순위(1등과의 차이)'. 방 화면을 열어 둔 동안 타이머 집중 시간이 그 방 기록으로 들어감(휴식 제외). 서버 집계는 마이그레이션 0007(`add_room_minutes` · `room_leaderboard` · `room_today_summary`, 하루 = 한국 날짜). **0007 적용 전에는 Realtime Presence만으로 순위**(지금 방에 있는 사람만, 나가면 빠짐) — 앱이 RPC 없음(PGRST202/42883)을 감지해 조용히 전환. 다른 사람에게는 닉네임과 하루짜리 익명 토큰만 보임(user_id 노출 없음).
   - **책 상세 '이 책 읽기 시작'**(`src/features/library/StartReadingButton.tsx`): 서재에 없으면 '읽고 있는 책'으로 담고, '읽고 싶은 책' · '중단'이면 '읽고 있는 책'으로 바꾼 뒤(완독한 책은 그대로) `router.dismissTo('/together')` → 타이머에 그 책이 선택되고 '시작' 버튼이 반짝임(`timerStore.readingIntent`, 60초 유효).
7. **OCR(사진 글자 인식) 제거** — tesseract.js 삭제. 다시 넣지 않음. (`expo-image-picker`는 2026-10-07 **문구 카드 '사진' 배경(프리미엄)** 용도로만 다시 설치 — OCR과 무관)
8. **번역 기능은 꺼짐** (`EXPO_PUBLIC_TRANSLATION_ENABLED` 플래그 + 스텁만 있음, 외부 번역 API 호출 없음).
9. **독서 DNA 결산 요약 카드 내보내기는 프리미엄 전용** (`entitlements` 게이팅 그대로).
   - 문구 카드 배경: 무료 = 종이 · 숲 · 수채화, 프리미엄 = 밤하늘 · 벚꽃 · 바다 · **사진(내 사진 업로드)** (`src/features/gallery/templates.ts`). 사진은 기기에서만 쓰이고, 갤러리에는 캡처된 카드 PNG(`cards` 버킷)에 합쳐져 올라가므로 별도 버킷 · 마이그레이션 없음(`template = 'photo'`로 저장).
   - 숲 꾸미기(2026-10-07 8차): 날씨는 하나만, **숲 친구(나비·무당벌레 무료 / 개구리·꿀벌·잠자리·반딧불이 프리미엄)는 여러 개 동시 선택**(`forestStore.critters` 배열, persist v1이 예전 `critter` 값을 변환, '없음' = 모두 끄기, 프리미엄이 꺼지면 잠긴 친구만 빠지고 남는 게 없으면 나비). 종류당 2마리(반딧불이는 혼자 6 · 같이 3)로 애니메이션 수를 제한.
   - **땅 넓히기는 최대 20×20**(2026-10-07 10차 사용자 요청, `GARDEN_LIMIT = 20` in `src/features/forest/layout.ts`; 좌표 기술 상한 `GARDEN_MAX = 1000`과 DB check 0~999는 그대로). 20×20이 되면 `땅 ➕`가 비활성(회색) + 옆에 "최대 20×20", 마지막으로 넓힐 때 "땅을 최대 크기(20×20)까지 넓혔어요" 토스트. 옮겨 심기 모드에서 "땅 N×N"으로 지금 크기를 보여줌. **예전에 20칸 밖에 심은 나무는 옮기지 않음**(가장 안전한 쪽): 그 나무가 닿는 만큼 숲이 그대로 크게 보이고(➕는 비활성, ➖는 마지막 줄에 나무가 있으면 비활성), 그 나무들을 안쪽으로 옮기면 저절로 20×20 이하로 돌아옴. 나무가 400그루를 넘으면 자동 크기(`gardenSize`)가 20을 넘을 수 있음(모든 나무에 칸이 필요해서). 저장된 `gardenExtra`는 `forestStore` persist v2에서 최대 17(= 20 − 최소 3)로 잘라냄. 숲 카드는 최대 높이 380으로 고정되고, 숲이 넘치면 **끌어서 상하좌우로 둘러보기**(마우스 · 터치, `ForestGarden`의 `GardenPan` — RN responder/PanResponder, 추가 패키지 없음). 한 방향만 넘칠 때는 그 방향만 잡고 나머지는 페이지 스크롤로 넘김. 화면 중심이 땅(마름모 + 나무 한 그루 높이 여유) 밖으로 못 나가게 제한, 크기가 바뀌면 가운데로 재정렬, 나무를 누르면 말풍선이 보이도록 자동 이동. 바닥 타일 · 장식은 몇 개의 Path로 묶어 그려서 큰 숲도 가벼움.
   - **땅 넓히기 / 땅 좁히기**(2026-10-07 9차, 옮겨 심기 모드의 `땅 ➕ ➖`): 넓히기는 **먼 쪽 두 모서리(c = n, r = n)에 한 줄씩** 붙이므로 좌표 원점이 안 바뀜. 넓히기 · 좁히기 모두 먼저 **모든 나무를 지금 칸에 고정**(`plantTrees`)한 뒤 `gardenExtra`를 바꿔서, 자리가 없던 나무가 가운데로 다시 몰리지 않음(순수 함수 `expandGarden` / `shrinkGarden`, `src/features/forest/layout.ts`). 좁히기는 마지막 줄(c = n−1 또는 r = n−1)에 나무가 있거나 자동 크기(`gardenSize`)에 닿으면 **비활성**(회색). 초기화는 시작 때의 크기 + 위치를 그대로 되돌림. `forestStore.expandGarden` 액션은 없어졌고 `setGardenExtra`만 씀.
   - **숲 확대 · 축소**(9차): 두 손가락 벌리기/오므리기(앱 · 모바일 웹, 같은 `GardenPan` responder에서 처리 — RNGH 미사용), 웹은 **Ctrl/⌘ + 휠 · 트랙패드 핀치**(일반 휠은 페이지 스크롤 그대로), Safari 데스크톱 gesture 이벤트, 그리고 숲 오른쪽 아래 **＋/− 버튼(웹에서만)**. 범위는 최대 2.5배, 최소는 "숲 전체가 보이는 배율"(단 0.4배 아래로는 안 감, 작은 숲은 1배). 숲 위에서는 브라우저 핀치 확대를 막음(`touch-action`). 끌어서 이동 범위 · 옮겨 심기 끌어 놓기(손가락 이동 ÷ 배율) · 말풍선(배율과 상관없이 같은 크기) 모두 배율을 반영. 실시간 배율은 Animated 값이라 다시 그리지 않고, 멈춘 뒤 `zoom` 상태만 갱신.
   - 캐릭터: 무료 = 단발머리 · 짧은 머리 · 동글 안경 · **똥머리 · 캡모자**, 프리미엄 = 털모자 · 토끼 후드 · 곰돌이 후드 · 양갈래 · **고양이 후드 · 꽃 화관** (`src/features/profile/avatars.ts` + `AvatarArt.tsx`).
10. **결제(RevenueCat) · 광고(AdMob) · 스토어 출시는 보류** — 사용자가 직접 검토한 뒤 진행. 요금제 게이팅 구조(`src/lib/entitlements.ts`, 마이 → 프리미엄 미리보기(개발용))는 그대로 둠.
11. 진동은 앱에서 항상 켜짐(설정 토글 없음). 한줄평 공개 범위 기본값은 전체 공개.
   - 효과음(탭 사운드 등)은 `src/lib/feedback.ts` → `src/lib/sfx.ts`(앱: 시작할 때 expo-audio 플레이어를 미리 만들어 두고, 탭은 3개를 돌려 씀) / `src/lib/sfx.web.ts`(웹: Web Audio API + 미리 디코딩한 버퍼, 첫 pointerdown에서 AudioContext 깨움). 웹에서 expo-audio(HTMLAudioElement)를 쓰면 매번 지연이 생기므로 되돌리지 말 것. 소리는 지금처럼 `onPress`에서 냄(`onPressIn`으로 바꾸면 스크롤할 때도 소리가 남).
   - **문장 갤러리는 `(tabs)` 안의 숨김 탭**(`src/app/(tabs)/gallery.tsx`, `href: null`)이라 하단 탭바 · 광고 자리가 그대로 보임. 주소는 그대로 `/gallery`. 탭 그룹은 `backBehavior="history"`(갤러리에서 뒤로 → 들어온 탭으로). 카드 만들기/카드 상세(`card/new`, `card/[id]`)는 루트 Stack에 그대로 두고 아래 보조 화면처럼 `StackTabBar`를 붙임. 루트 Stack 화면에서 갤러리로 갈 때는 **`router.dismissTo('/gallery')`**(필터는 `router.dismissTo({ pathname: '/gallery', params: { isbn } })`)를 써야 탭 그룹이 중복으로 쌓이지 않음 — `router.navigate`/`push`는 탭 그룹을 하나 더 쌓음(2026-10-07 헤드리스로 확인: 탭바 2개, 뒤로 → 카드로 돌아감).
   - **보조 화면도 탭바 · 광고 유지**(2026-10-07): `search`, `book/[id]`, `trees`, `room/[id]`, `forest/[slug]`, `card/new`, `card/[id]`, `wrapped`(10차에 추가)는 루트 Stack에 그대로 두고(주소 · `router.push` 경로 그대로, 책 → 책처럼 쌓이는 뒤로 가기 유지) `Screen`의 `footer={<StackTabBar />}`로 같은 탭바 + 광고 자리를 그림(`src/components/ForestTabBar.tsx`). 들어온 탭이 강조되고(루트 내비게이션 상태에서 아래에 깔린 `(tabs)`의 탭을 찾음, 주소로 바로 들어오면 강조 없음), 탭을 누르면 `router.dismissTo('/library')`처럼 **기존 탭 그룹으로 돌아감**(없으면 교체). 숨김 탭으로 옮기지 않은 이유: 동적 경로(`book/[id]`)를 탭으로 두면 책 → 다른 책이 쌓이지 않고 같은 화면의 파라미터만 바뀜. `wrapped`(결산 이야기 화면)는 `Screen`을 안 써서 화면 아래에 `StackTabBar`를 직접 붙이고, 이야기 영역 높이는 `onLayout`으로 잼(요약 카드 크기 계산). **탭바 없는 화면은 로그인 쪽만**: `(auth)`의 `/login` · `/signup` · `/forgot-password`, `auth/callback`, `auth/reset` — 탭은 `Stack.Protected`로 막혀 있어 로그인 전에는 눌러도 갈 곳이 없으므로 일부러 뺌.
   - **키보드가 열리면 탭바 + 광고 자리를 숨김**(10차, `TabBarView` 안에서 `src/lib/useKeyboardVisible.ts` 사용 → 탭 화면 · 보조 화면 모두 적용): 앱은 `Keyboard` 이벤트(iOS는 will, Android는 did), 웹은 visualViewport 높이 차이(150px 넘게) 또는 **터치 화면에서 입력칸에 포커스**가 있을 때. 데스크톱 웹은 포커스만으로는 숨기지 않음. `Screen`의 ScrollView에 `automaticallyAdjustKeyboardInsets`(iOS)도 켬. Android는 edge-to-edge라 키보드 위로 내용이 자동으로 올라가지 않을 수 있음(기존과 같음, 필요하면 react-native-keyboard-controller 검토).
   - 참고: expo-router 57의 Stack은 `NAVIGATE`가 현재 화면과 이름이 같을 때만 기존 화면을 재사용하고, 아니면 새로 push함(`node_modules/expo-router/build/layouts/StackClient.js`). 루트 Stack 화면에서 탭 화면(숨김 탭 포함)으로 **돌아갈 때는 `router.dismissTo`**(아래에 탭 그룹이 있으면 거기까지 닫고 해당 탭으로, 없으면 현재 화면을 교체). `card/[id]` · `card/new`의 갤러리 이동은 모두 `dismissTo`로 바꿈.
   - **기록 캘린더 표시**(2026-10-07, 10-08 수정): '전체 보기'는 읽기 시작(📖, `startDate`, 없으면 `add` 로그 날짜) · 완독(🏁, `endDate`, 없으면 `complete` 로그 날짜)을 날짜 칸 아래 작은 표시 + 범례로 보여주고, '완독 보기'는 완독만. 아래 날짜 목록 · '기록한 날 N일'도 같은 기준(`src/features/records/aggregate.ts`의 `activitiesByDay` · `markersOf`, 테스트는 `npm run test:gallery`). **읽고 싶은 책(💗) 표시는 2026-10-08 사용자 요청으로 삭제** — 찜한 책(`want`)은 캘린더에 나오지 않고 기록한 날에도 세지 않음.
   - **책 소개 전체 + 더보기**(2026-10-08): 카카오 `contents`는 약 200~250자에서 잘려 오므로 `/api/books/[isbn]`이 쪽수용으로 이미 읽던 **다음 책 페이지의 '책소개'(출처 인터넷 교보문고)**도 읽어 더 긴 쪽을 씀(`api/_lib/daum.ts`의 `parseDaumIntro`, 문단은 빈 줄로 구분, `ENABLE_DAUM_PAGES=false`면 같이 꺼짐). 그래서 이제 쪽수가 있는 책도 다음 페이지를 한 번 읽음(30일 캐시). 서재에 담긴 책은 더 긴 소개가 오면 저장된 책 정보도 갱신(`useBook`). 화면은 `src/features/books/BookDescription.tsx` — 6줄로 접고 넘칠 때만 오른쪽 아래 '더보기'/'접기'(웹에는 `onTextLayout`이 없어서 숨긴 전체 글 높이와 비교), 문장 부호 없이 끝나면 '…'를 붙임. 다음 페이지에 소개가 없거나 배포 전이면 예전처럼 카카오 소개.
12. 비밀 값은 절대 커밋하지 않음 (카카오 키, `.env.local`, service_role 키, DB 비밀번호). 커밋 전 `git diff --cached`를 키 패턴으로 검사.
13. **로그인 화면 먼저(ERP식 로그인 게이트, 2026-10-07)** — 앱을 열면 로그인부터. 예전의 "익명 계정 자동 생성 + 마이의 '로그인하고 기록 지키기' 카드"는 없앰.
   - 로그인 방법: **카카오 · 구글(Supabase OAuth) · 이메일+비밀번호**. 화면은 `src/app/(auth)/`(`/login` · `/signup` · `/forgot-password`) + 게이트 밖 `src/app/auth/callback.tsx`(OAuth · 가입 인증 메일) · `src/app/auth/reset.tsx`(비밀번호 재설정 메일 → 새 비밀번호). 공유 숲 `/forest/[slug]`도 로그인 없이 열림(방문자 물 주기는 기존처럼 익명 세션).
   - 게이트: 루트 `_layout.tsx`의 **`Stack.Protected`**(SDK 57에 있음, `redirectTo`는 SDK 58부터라 막히면 "첫 번째로 열 수 있는 화면"으로 감 → `(tabs)` 묶음을 맨 앞, `(auth)`를 그다음에 둘 것). 상태는 `src/features/auth/authStore.ts`(`loading`이면 스플래시 유지 → 딥링크 유지). 익명 세션만 있으면 로그인 화면(서버 동기화도 안 함).
   - **게스트 버튼 없음**. 대신 기존 익명/게스트 사용자의 **이 기기 기록은 처음 로그인 · 가입한 계정으로 옮겨짐**(기존 업로드+병합 동기화). Supabase의 진짜 identity 연결(`linkIdentity`)은 쓰지 않음 — 대시보드 "Manual linking"이 기본 꺼짐이고, 익명 사용자는 대부분 테스트용이라서. 그래서 익명 계정의 서버 전용 데이터(갤러리 카드 · 리뷰 · 공개 숲)는 새 계정으로 옮겨지지 않음.
   - **같은 기기에서 다른 계정 로그인**: `profileStore.dataOwner`(기록 주인 uid)가 다르면 이전 계정의 기기 사본(서재 · 독서 로그 · 만든 카드 기록 · 닉네임/숲 이름/캐릭터)을 지우고 새 계정 기록을 내려받음(이전 계정 기록은 서버에 남음). 로그아웃만으로는 기기 사본을 지우지 않음(다시 로그인하면 바로 보이고, 못 올라간 변경도 보존).
   - 이메일 가입: 이메일 · 닉네임(2~16자) · 비밀번호(영문+숫자 8~72자) · 비밀번호 확인 + 필수 동의 2개(전체 동의 · '보기'). 약관 · 개인정보 문서는 **초안**(`src/features/auth/legal.ts`, 출시 전 운영자 정보 · 보관 기간 · 위탁 업체 채우고 검토 필요, 고치면 `LEGAL_VERSION` 올리기). 닉네임 · 동의 시각 · 문서 버전은 `user_metadata`에 저장, 닉네임은 기존 `handle_new_user` 트리거가 `profiles.nickname`에 넣음 → **마이그레이션 불필요**. 인증 메일 설정이 켜져 있으면(세션 없음) "인증 메일을 보냈어요" 화면 + 다시 보내기.
   - 로그인 화면: 아이디(이메일) 저장 · 자동 로그인(기본 켬, 끄면 앱/브라우저 탭을 새로 열 때 로그아웃 — 웹은 `sessionStorage` 표시, 앱은 실행 중 메모리) · 비밀번호 보기 · 오류 문구(비밀번호 틀림 · 이메일 미인증(+다시 보내기) · 네트워크 · 요청 과다 · 공급자 꺼짐). 카카오/구글은 누르기 전에 `/auth/v1/settings`로 공급자가 켜졌는지 확인해 "준비 중이에요" 안내(꺼진 공급자로 이동하면 Supabase JSON 오류 페이지가 뜨기 때문).
   - 개발용 우회: Supabase 환경 변수가 없으면 게이트 없이 로컬 모드, `EXPO_PUBLIC_AUTH_GATE=false`면 게이트를 끄고 예전처럼 익명 세션으로 사용.
   - **로그인 보강(2026-10-07) — 화면 정리**: 부제 '책을 읽을수록 나만의 숲이 자라요'는 '독서의숲' 로고 글자 아래, 화면 제목('로그인' · '회원가입' · '비밀번호 찾기')은 카드 위(카드 밖)로(`AuthLayout`, 세 화면 + 재설정 화면 공통). 로그인 화면의 '이 기기에 익명으로 쓰던 기록이 있어요' 안내는 **삭제**(옮기는 동작은 그대로 조용히). 카카오 · 구글은 '또는' 아래 **동그란 아이콘 버튼 2개**(SVG 로고, `SocialButtons`, 접근성 라벨 '카카오로 시작하기' · '구글로 시작하기', 아래 작은 글씨 '카카오' · '구글').
   - **중복 가입 막기**: Confirm email이 켜져 있으면 Supabase는 이미 가입된(인증된) 이메일에도 성공처럼 답함(`user.identities`가 빈 배열, 메일 안 보냄) → `signUpResponseKind`가 감지해 '이미 가입된 이메일이에요…' + **로그인하기 · 비밀번호 찾기** 링크(이메일 미리 채움). 인증 꺼진 경우의 `User already registered`(422 `user_already_exists` · `email_exists`)도 같은 안내. 미인증 상태로 다시 가입하면 Supabase가 인증 메일을 다시 보내므로 "인증 메일을 보냈어요" 화면.
   - **가입 인증 메일 → 로그인 화면**: `emailRedirectTo`는 웹 `<origin>/auth/confirmed`, 앱 `readingforest://auth/confirmed`. Supabase가 링크에서 이메일 인증을 끝낸 뒤 이 화면으로 보내고, 화면은 **세션을 남기지 않고**(같은 브라우저라 PKCE 교환으로 로그인돼도 리스너가 로컬 로그아웃 → 기기 기록 주인도 안 바뀜) `/login?notice=confirmed`('이메일 인증이 완료되었어요. 로그인해 주세요')로 보냄. 만료/사용된 링크(`error_code=otp_expired`)는 `notice=confirmExpired` + 인증 메일 다시 보내기 버튼. `?token_hash=…&type=email` 링크도 처리(verifyOtp 후 로그아웃). 예전 메일(`/auth/callback`)은 예전처럼 로그인 처리.
   - **비밀번호 재설정 링크**: 한국어 템플릿은 `{{ .SiteURL }}/auth/reset?token_hash={{ .TokenHash }}&type=recovery`로 보내고 `auth/reset`이 `verifyOtp({ type: 'recovery' })` → **요청한 기기/브라우저가 아니어도 열림**(기본 템플릿의 PKCE 링크는 요청한 브라우저에서만 됨). 앱에서 요청해도 링크는 웹에서 열리고, 바꾼 비밀번호로 앱에 로그인하면 됨.
   - **메일 재전송 제한**: 보내면 60초 타이머(`src/features/auth/cooldown.ts`, 실행 중 메모리, 메일 종류+주소별) — 버튼이 'N초 후에 다시 보낼 수 있어요'로 잠김(비밀번호 찾기 · 인증 메일 다시 보내기), 중복 제출 막음. 오류 문구 구분: 주소별 60초 제한(`over_email_send_rate_limit` + "after N seconds") → '같은 메일은 1분에 한 번만… N초 후', 프로젝트 시간당 한도("email rate limit exceeded") → '메일 발송 한도에 잠시 걸렸어요. 1시간쯤 뒤에…', 그 밖의 429 → '요청이 너무 많아요'. **근본 해결은 커스텀 SMTP + Rate Limits 상향**(7장 2번).
   - **서버 오류 ≠ 인터넷 오류**(2026-10-07): auth-js는 5xx 응답도 `AuthRetryableFetchError`(status 500…)로 던지므로, '인터넷 연결을 확인…'은 **응답이 아예 없을 때(status 0 · fetch 실패)만**. 메일 발송 실패(500 `unexpected_failure` "Error sending recovery/confirmation email" — SMTP 설정 · 템플릿 문제) → '메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요'(`emailSendFailed`), 그 밖의 5xx → '서버에 잠시 문제가 생겼어요…'(`serverError`). 발송 실패의 진짜 원인은 Supabase → Logs → **Auth** 로그에서 응답의 `error_id`로 검색.
   - **다른 기기에서 같은 계정 로그인 → 기록 내려받기**(감사 결과): 
     - 서버에 있음 · 내려옴: 서재 · 독서 로그 · 별점/한줄평/기대지수 · 나무 종류/위치(`user_books` · `reading_logs`), 닉네임(`profiles.nickname`), 숲 이름 · 캐릭터(`profiles`, 0005 필요 → 아래 metadata로도 따라감), 공개 숲 링크(`forests.share_slug` → `forestStore.publishedSlug`), 갤러리에 올린 카드(`quote_cards` → `cardsStore.made`, 결산 '만든 카드' 수).
     - **새로 동기화**(마이그레이션 불필요): 숲 꾸미기(날씨 · 숲 친구 · 땅 넓히기 `gardenExtra`) · 설정(효과음 · 갤러리 블러 · 한줄평 공개 범위) · 숲 이름/캐릭터 사본을 **Supabase Auth `user_metadata.rf_prefs`**에 저장(`auth.updateUser({ data })`, 1.5초 모아 쓰기). 로그인 때 `getUser()`로 읽어 **더 최근 쪽 우선**(`src/features/library/accountPrefs.ts`, 이 기기의 마지막 변경 시각은 `rf-sync-meta`). 새 기기 · 계정이 바뀐 기기는 시각 0이라 계정 값이 내려옴. 계정이 바뀌면 이전 계정의 숲 꾸미기 · 공개 숲 링크도 기본값으로 되돌림.
     - **지운 책 전파**: 서버가 확인한 책 id 목록(`rf-sync-meta.knownEntryIds`)에 있는데 서버에서 사라진 책 = 다른 기기에서 지움 → 이 기기에서도 지움(예전에는 다시 올려서 되살아났음). 오프라인에서 지운 책은 `pendingDeletes`로 다음 동기화 때 서버에서 지우고 되살리지 않음(`reconcileDeletes`).
     - **기기에만 있음(의도)**: 아이디 저장 · 자동 로그인(`rf-auth-prefs`), 독서 타이머 · 오늘 집중 기록(`rf-timer`), 백색소음 믹서 + '타이머와 함께 재생' · '휴식 때도 소리 재생'(`rf-mixer`), 함께 읽기 지역 · 오늘의 독서실 토큰 등(`rf-together`), 데모/로컬 물 주기 횟수, 언어(한국어만), 갤러리에 올리지 않고 저장/공유만 한 카드 기록(서버에 없음).
     - 헤드리스 확인(가짜 Supabase): 기기 A에서 가입 · 데이터 → 새 브라우저 프로필(기기 B)에서 로그인 → 서재 · 로그 · 날씨/숲 친구/땅 · 설정 · 닉네임/숲 이름/캐릭터 · 공개 숲 링크 · 갤러리 카드 모두 내려옴, A에서 지운 책은 B에서도 사라지고 다시 올라가지 않음.

## 5. 배포 (Vercel)
- 프로젝트: `reading-forest` (팀/스코프 `kysmk1987-8120s-projects`), GitHub `main`에 push → 자동 Production 배포.
- 상태 확인: `npx vercel ls reading-forest`, 수동 배포: `npx vercel --prod --yes`.
- 빌드: `npx expo export -p web` → `dist/`, `/api` 외 경로는 `index.html`로 리라이트 (`vercel.json`).

### 환경 변수 (이름만 — 값은 Vercel에 있음)
| 이름 | Production / Preview | Development | 비고 |
| --- | --- | --- | --- |
| `KAKAO_REST_API_KEY` | 민감(Secret) | 일반(받아올 수 있음) | 서버 전용, `EXPO_PUBLIC_` 붙이지 말 것 |
| `EXPO_PUBLIC_SUPABASE_URL` · `EXPO_PUBLIC_SUPABASE_ANON_KEY` | 일반 | 일반 | 앱 번들에 포함(RLS로 보호) |
| `EXPO_PUBLIC_AUTH_GATE` | (미등록 = 로그인 게이트 켜짐) | (미등록) | 개발 · 점검용으로만 `false` (게이트 끄기) |
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
  | `0006_garden_unlimited.sql` | 땅 넓히기용: `user_books.garden_x/y` check를 0~11 → **0~999**로 넓힘 (10차에 앱은 최대 20×20으로 바뀌었지만, 예전에 20칸 밖에 심은 나무 위치도 동기화되도록 0~999 그대로 둠) | ❌ **미적용** — `supabase/setup_0006.sql` 실행 (0005 다음). 적용 전에는 12칸을 넘는 나무 위치만 빼고 동기화(23514 오류 시 자동 재시도) — 그 위치는 이 기기에만 남음 |
  | `0007_room_leaderboard.sql` | 독서실 순위: `room_daily_minutes`(사용자 · 방 · 한국 날짜별 분, 직접 쓰기 금지) + RPC `add_room_minutes`(한 번에 최대 180분, 마지막 기록 이후 지난 시간 + 1분까지만) · `room_leaderboard` · `room_today_summary` · `room_player_token` | ❌ **미적용** — `supabase/setup_0007.sql` 실행 (0006 다음). 적용 전에는 독서실 순위가 '지금 방에 있는 사람'만으로 계산됨 |
- 새 마이그레이션은 `0008_…sql`로 추가 → `npm run build:sql`로 `setup_0008.sql` 생성 → 사용자가 SQL Editor에 붙여넣어 실행(에이전트는 DB 비밀번호를 묻지 않음). 적용된 파일은 고치지 말고 새 번호로 추가.
- 로컬 테스트는 `scripts/e2e/mock-sb.mjs`(PGlite로 실제 마이그레이션 실행)를 사용. 이메일 가입 · 비밀번호 로그인 · `/auth/v1/settings`(카카오 · 구글 꺼짐) · 재설정 메일도 흉내 냄(`MOCK_CONFIRM_EMAIL=1`이면 인증 메일 필요 모드).
- 로그인 게이트(이메일 가입)는 **DB 변경 없음**(관련 마이그레이션 없음) — 닉네임 · 동의 기록은 `auth.users.raw_user_meta_data`.

## 7. 남은 일 (우선순위 순)
0. **마이그레이션 0005 · 0006 · 0007 적용** — `supabase/setup_0005.sql` → `setup_0006.sql` → `setup_0007.sql` 순서로 Supabase SQL Editor에 붙여넣고 Run (숲 이름 · 캐릭터 동기화, 12칸 넘는 나무 위치 동기화, 독서실 오늘의 순위).
0-1. **새 네이티브 빌드 필요(Android)** — 잠금화면 카운트다운은 로컬 모듈 `modules/rf-ongoing-timer`(자동 링크) + `app.json`의 `expo-notifications` 플러그인(알림 아이콘 · 색) 때문에 `eas build`(또는 `npx expo run:android`)로 새로 빌드해야 함. 그 전 빌드/Expo Go에서는 고정 알림으로 대신 동작.
1. **도서관 정보나루 키 승인 대기** — 승인되면 코드 변경 없이 자동 사용(베스트셀러 2순위, 쪽수 보조). 확인: 정보나루 마이페이지의 상태가 '승인'인지.
2. **로그인 설정 (Supabase 대시보드, README "로그인 설정" 참고)** — 로그인 화면이 먼저 나오므로 최소한 이메일은 꼭 확인:
   - **Email 공급자 켜짐** 확인(Authentication → Sign In / Providers → Email). **Confirm email** 켤지 결정(앱은 둘 다 처리). 기본 메일 발송은 시간당 몇 통 제한 → 운영 전 **SMTP 설정** 권장. (권장) 최소 비밀번호 길이 8 · 영문+숫자.
   - **URL Configuration**: Site URL `https://reading-forest-nine.vercel.app`(재설정 메일 링크가 이 주소로 만들어지므로 **꼭 이 값**), Redirect URLs에 `https://reading-forest-nine.vercel.app/**` · `http://localhost:8081/**` · `readingforest://**` 있는지 확인(OAuth → `/auth/callback`, 가입 인증 → `/auth/confirmed`, 비밀번호 재설정 → `/auth/reset`).
   - **한국어 메일 템플릿(에이전트는 적용 못 함 — 액세스 토큰 없음)**: 둘 중 하나.
     - (A) 대시보드: Authentication → **Emails → Templates** → **Confirm signup**: Subject `[독서의숲] 가입을 완료해 주세요 🌱`, Body에 `supabase/templates/confirmation.html` 전체 붙여넣기 → Save. **Reset password**: Subject `[독서의숲] 비밀번호 재설정 안내 🔑`, Body에 `recovery.html` → Save. (제목은 `supabase/templates/subjects.json`과 같음)
     - (B) 명령: https://supabase.com/dashboard/account/tokens 에서 개인 액세스 토큰 발급 → PowerShell `$env:SUPABASE_ACCESS_TOKEN='...'; node scripts/apply-auth-templates.mjs --apply` (제목 2개 + 본문 2개만 PATCH, SMTP · 한도 등 다른 설정은 안 건드림. 토큰은 커밋 · 공유 금지, 끝나면 대시보드에서 폐기 권장).
     - 링크 유효 시간: 이 저장소에 `supabase/config.toml`이 없어 운영 값은 대시보드 기준 — 기본 **Email OTP Expiration 3600초 = 1시간**(Authentication → Sign In / Providers → Email). 메일 · 앱 문구가 모두 "1시간"이므로 바꾸면 `supabase/templates/*.html`과 `ko.ts`의 `confirmSentHint` · `resetSentHint`도 함께 고칠 것.
   - **보낸 사람 '독서의숲' + 발송 한도(요청이 너무 많아요 해결)**: 기본 발송기는 보낸 사람이 'Supabase Auth'로 고정이고 **프로젝트 전체 시간당 2통 정도**만 보냄(+ 같은 주소는 60초에 한 번). 운영 전 **커스텀 SMTP** 필요:
     1. 발송 서비스 고르기 — 권장 **Resend**(무료 월 3,000통, 도메인 인증 필요) / 도메인이 없으면 **Gmail SMTP**(앱 비밀번호, 하루 약 500통, 개인용) / 네이버 웍스 · AWS SES 등. 보낸 주소 예: `no-reply@<내 도메인>`(Gmail이면 그 Gmail 주소).
     2. 도메인 인증(Resend 등): DNS에 SPF · DKIM(· DMARC) 레코드 추가 → 인증 완료 확인.
     3. Supabase → Authentication → **Emails → SMTP Settings** → Enable custom SMTP: Sender email `no-reply@<도메인>`, **Sender name `독서의숲`**, Host/Port/Username/Password(예: Resend `smtp.resend.com` · 465 · `resend` · API 키) → Save.
     4. Authentication → **Rate Limits** → "Rate limit for sending emails"를 필요한 만큼(예: 시간당 30~100) 올림(커스텀 SMTP를 켜야 바뀜).
     5. 확인: 앱에서 가입 → 메일의 보낸 사람 · 제목 · 한국어 본문 확인 → 버튼 → 로그인 화면 + '이메일 인증이 완료되었어요'. 비밀번호 찾기 → 메일 버튼 → 다른 브라우저에서도 새 비밀번호 화면이 열리는지.
   - **카카오**: Kakao Developers에서 카카오 로그인 활성화 · Redirect URI `https://ucftmqkmjwwasknanimz.supabase.co/auth/v1/callback` · 동의항목 · Client Secret → Supabase Providers → Kakao. ⚠️ 카카오는 **비즈 앱 전환(사업자 인증) 전에는 이메일을 주지 않음** → Supabase Kakao 설정의 **Allow users without an email**을 켜야 로그인됨(안 켜면 "카카오 계정에서 이메일을 받지 못했어요" 안내가 뜸). 설정 전에는 버튼을 누르면 "카카오 로그인은 준비 중이에요".
   - **구글**: Google Cloud OAuth 클라이언트 → Supabase Providers → Google (설정 전에는 "준비 중" 안내).
   - 출시 전: 약관 · 개인정보 **초안**(`src/features/auth/legal.ts`) 실제 내용으로 교체 + 검토.
3. **테스트용 익명 사용자 정리**: 자동 점검 중 운영 DB에 익명 사용자 몇 명과 테스트 서재 기록이 생겼음 → Supabase → Authentication → Users에서 익명(anonymous) 사용자 삭제(관련 데이터는 함께 삭제됨).
4. (선택) 국립중앙도서관 `NL_CERT_KEY` 발급 — 다음 페이지에 쪽수가 없는 책의 보조.
5. **다음 단계(사용자 검토 후)**: 인앱 결제(RevenueCat) · 광고(AdMob) · 앱 스토어 출시(EAS Build/Submit).

## 8. 실행 · 테스트 · 배포
```powershell
npx expo start --web          # 개발 서버 (http://localhost:8081, /api는 배포 사이트를 호출)
npx expo lint                 # 린트 (경고 2개는 기존 것)
npx tsc --noEmit              # 타입 검사
npm test                      # 오프라인 테스트 7종 (도서 API · 동기화 · 갤러리/결산 · 숲/리뷰/쪽수 · 스크래퍼 파서 · 로그인 입력 검사/오류 분류 · 타이머 엔진/독서실 순위)
npx expo export -p web        # 웹 빌드 확인
git push origin main          # → Vercel 자동 배포
node scripts/e2e/e2e-live-s6c.mjs   # 배포 사이트 헤드리스 점검 (Edge 필요)
node scripts/e2e/e2e-auth.mjs http://localhost:8105 http://localhost:54329   # 로그인 게이트 점검 (가짜 Supabase + 그 주소로 띄운 개발 서버, scripts/e2e/README 참고) — 중복 가입 · 재전송 60초 · 인증 완료 화면 · 기기 B 동기화 · 지운 책 전파까지 48항목
node scripts/apply-auth-templates.mjs           # 한국어 메일 템플릿 미리보기(--apply + SUPABASE_ACCESS_TOKEN이면 운영 프로젝트에 적용)
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
