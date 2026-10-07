# 헤드리스 E2E 도구 (Windows · Microsoft Edge)

브라우저를 화면 없이 띄워 실제 클릭으로 기능을 확인하는 스크립트입니다. 결과·스크린샷은 `%TEMP%\rf-e2e\...`에 저장됩니다.

| 파일 | 역할 |
| --- | --- |
| `cdp.mjs` | Edge(headless) + Chrome DevTools Protocol 도우미 (클릭·입력·스크린샷·콘솔 오류 수집, 소리 재생 감지) |
| `mock-sb.mjs` | 로컬 가짜 Supabase: PGlite에 `supabase/migrations/*.sql`을 그대로 적용하고 Auth/REST/Storage 일부를 흉내 냄 (포트 54321) |
| `serve.mjs` | `dist` 폴더를 SPA로 띄우는 정적 서버 (포트 8130, `/api/books`는 없음) |
| `e2e-s6.mjs` | 6차 기능 로컬 E2E (옮겨 심기 · 도감 · 리뷰 2인 · 쪽수 · 설정) — 가짜 Supabase 필요 |
| `e2e-live-s6.mjs` · `e2e-live-s6c.mjs` | 배포 사이트 점검 (베스트셀러 · 자동 쪽수 · 콘솔 오류 0) |
| `e2e-gallery.mjs` · `shot-forest.mjs` | 4차 갤러리 E2E · 숲 스크린샷 |

## 배포 사이트 점검 (가장 간단)
```powershell
node scripts/e2e/e2e-live-s6c.mjs
```

## 로컬 + 가짜 Supabase
```powershell
npm i --no-save @electric-sql/pglite
node scripts/e2e/mock-sb.mjs                       # 창 하나에서 계속 실행
# 다른 창: 가짜 Supabase를 바라보는 웹 빌드 (Metro 캐시 때문에 --clear 필수!)
$env:EXPO_PUBLIC_SUPABASE_URL='http://localhost:54321'
$b64 = { param($s) [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($s)).TrimEnd('=').Replace('+','-').Replace('/','_') }
$env:EXPO_PUBLIC_SUPABASE_ANON_KEY = "$(& $b64 '{"alg":"HS256"}').$(& $b64 '{"role":"anon"}').c2ln"
npx expo export -p web --clear --output-dir "$env:TEMP\rf-e2e\dist-local"
Remove-Item Env:EXPO_PUBLIC_SUPABASE_URL, Env:EXPO_PUBLIC_SUPABASE_ANON_KEY
node scripts/e2e/serve.mjs "$env:TEMP\rf-e2e\dist-local" 8130   # 또 다른 창
node scripts/e2e/e2e-s6.mjs http://localhost:8130 http://localhost:54321
```

> ⚠️ 빌드 후 번들에 실제 프로젝트 주소가 남아 있지 않은지 꼭 확인하세요 (예전에 캐시 때문에 실제 Supabase로 요청이 간 적이 있음).
> 위에서 만드는 anon 키는 가짜 서버용 더미 값(`{"role":"anon"}`)이며 실제 키가 아닙니다.
