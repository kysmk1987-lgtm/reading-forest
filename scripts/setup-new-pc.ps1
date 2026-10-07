# 독서의숲 - 새 PC 한 번에 설정하기 (Windows)
#
# 사용법 (셋 중 아무거나):
#   1) 저장소 폴더의 '새PC설정.bat' 더블클릭
#   2) PowerShell에서 (저장소가 아직 없을 때):
#      iex ((irm https://raw.githubusercontent.com/kysmk1987-lgtm/reading-forest/main/scripts/setup-new-pc.ps1).TrimStart([char]0xFEFF))
#      이 파일은 Windows PowerShell 5.1이 한글을 읽도록 BOM이 있는 UTF-8로 저장합니다. 위 명령은 그 BOM을 떼고 실행합니다.
#   3) powershell -ExecutionPolicy Bypass -File scripts\setup-new-pc.ps1 [-DryRun] [-Path <폴더>]
#
# 하는 일: Git · Node.js LTS · GitHub CLI 설치(없을 때만, winget) → GitHub 로그인 → 저장소 받기(없을 때만)
#          → npm ci → Vercel 로그인 · 프로젝트 연결 → 개발용 환경 변수(.env.local) 받기
# 여러 번 실행해도 안전합니다(이미 된 단계는 건너뜀). -DryRun(또는 환경 변수 RF_SETUP_DRYRUN=1)은
# 설치 · 로그인 · 다운로드 없이 무엇을 할지만 보여줍니다.
#
# 이 파일은 `irm | iex`로도 실행되므로 맨 위에 param 블록을 두지 않고, $PSScriptRoot에 의존하지 않습니다.

function Invoke-ReadingForestSetup {
  [CmdletBinding()]
  param(
    [switch]$DryRun,
    [string]$Path = (Join-Path $env:USERPROFILE 'Documents\GitHub\book'),
    [string]$ScriptDir = ''
  )

  $RepoUrl = 'https://github.com/kysmk1987-lgtm/reading-forest.git'
  $VercelProject = 'reading-forest'
  $VercelScope = 'kysmk1987-8120s-projects'
  if ($env:RF_SETUP_DRYRUN -eq '1') { $DryRun = $true }

  try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }

  function Say([string]$Text) { Write-Host "  $Text" }
  function Step([string]$Text) { Write-Host ''; Write-Host "▶ $Text" -ForegroundColor Cyan }
  function Ok([string]$Text) { Write-Host "  [완료] $Text" -ForegroundColor Green }
  function Skip([string]$Text) { Write-Host "  [건너뜀] $Text" -ForegroundColor DarkGray }
  function Dry([string]$Text) { Write-Host "  [연습 모드] $Text" -ForegroundColor Yellow }
  function Fail([string]$Text) { throw $Text }

  function Has([string]$Command) { [bool](Get-Command $Command -ErrorAction SilentlyContinue) }

  function Refresh-Path {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user"
  }

  # npm/npx는 .cmd로 부릅니다: PowerShell 실행 정책이 막혀 있어도 npm.ps1 대신 npm.cmd가 실행되도록.
  function Npm { & npm.cmd @args; if ($LASTEXITCODE -ne 0) { Fail "npm $($args -join ' ') 실패 (코드 $LASTEXITCODE)" } }
  function Vercel { & npx.cmd --yes vercel@latest @args }

  function Ensure-Tool([string]$Command, [string]$WingetId, [string]$Label) {
    if (Has $Command) { Ok "$Label 설치되어 있음"; return }
    if ($DryRun) { Dry "$Label 설치 예정 (winget install $WingetId)"; return }
    if (-not (Has 'winget')) {
      Fail "$Label 이(가) 없고 winget도 없어요. Microsoft Store에서 '앱 설치 관리자(App Installer)'를 설치한 뒤 다시 실행하거나, $Label 을(를) 직접 설치해주세요."
    }
    Say "$Label 설치 중... (관리자 권한 창이 뜨면 '예'를 눌러주세요)"
    & winget install --id $WingetId -e --source winget --accept-package-agreements --accept-source-agreements --silent
    Refresh-Path
    if (-not (Has $Command)) {
      Fail "$Label 설치 후에도 '$Command' 명령을 찾지 못했어요. 이 창을 닫고 새로 연 뒤 다시 실행해주세요."
    }
    Ok "$Label 설치 완료"
  }

  function Is-RepoDir([string]$Dir) {
    if (-not $Dir -or -not (Test-Path (Join-Path $Dir 'package.json'))) { return $false }
    try { return ((Get-Content (Join-Path $Dir 'package.json') -Raw -Encoding UTF8) -match '"name"\s*:\s*"reading-forest"') } catch { return $false }
  }

  Write-Host ''
  Write-Host '=== 독서의숲 새 PC 설정을 시작합니다 ===' -ForegroundColor Green
  if ($DryRun) { Dry '연습 모드: 설치 · 로그인 · 다운로드는 하지 않고 순서만 확인합니다' }

  # 1. 필수 프로그램
  Step '1/6 필수 프로그램 확인 (Git · Node.js · GitHub CLI)'
  Refresh-Path
  Ensure-Tool 'git' 'Git.Git' 'Git'
  Ensure-Tool 'node' 'OpenJS.NodeJS.LTS' 'Node.js LTS'
  Ensure-Tool 'gh' 'GitHub.cli' 'GitHub CLI'
  if (Has 'node') {
    $major = [int]((& node --version) -replace '^v(\d+).*', '$1')
    if ($major -lt 20) { Fail "Node.js 버전이 너무 낮아요($(& node --version)). 'winget upgrade OpenJS.NodeJS.LTS'로 올린 뒤 다시 실행해주세요." }
    Say "Node.js $(& node --version)"
  }

  # 2. GitHub 로그인
  Step '2/6 GitHub 로그인'
  if (-not (Has 'gh')) {
    Dry 'GitHub CLI 설치 후 로그인 예정'
  } else {
    & gh auth status --hostname github.com *> $null
    if ($LASTEXITCODE -eq 0) {
      Ok 'GitHub에 로그인되어 있음'
    } elseif ($DryRun) {
      Dry 'gh auth login --web 실행 예정'
    } else {
      Say '브라우저가 열리면 화면의 코드를 입력하고 GitHub 계정(kysmk1987-lgtm)으로 승인해주세요.'
      & gh auth login --web --hostname github.com --git-protocol https
      if ($LASTEXITCODE -ne 0) { Fail 'GitHub 로그인이 끝나지 않았어요. 다시 실행해주세요.' }
      Ok 'GitHub 로그인 완료'
    }
    if (-not $DryRun) { & gh auth setup-git *> $null }
  }
  if ((Has 'git') -and (Has 'gh') -and -not $DryRun) {
    if (-not (& git config --global user.name)) {
      $login = & gh api user --jq .login 2>$null
      $id = & gh api user --jq .id 2>$null
      if ($login) {
        & git config --global user.name $login
        & git config --global user.email "$id+$login@users.noreply.github.com"
        Ok "git 사용자 이름 설정: $login"
      }
    }
  }

  # 3. 저장소 폴더
  Step '3/6 저장소 폴더'
  $repo = $null
  $here = (Get-Location).Path
  if ($ScriptDir -and (Is-RepoDir (Split-Path $ScriptDir -Parent))) { $repo = Split-Path $ScriptDir -Parent }
  elseif (Is-RepoDir $here) { $repo = $here }
  elseif (Is-RepoDir $Path) { $repo = $Path }

  if ($repo) {
    Ok "저장소 폴더: $repo"
    if (-not $DryRun -and (Has 'git')) {
      Push-Location $repo
      $dirty = & git status --porcelain
      if (-not $dirty) {
        & git pull --ff-only --quiet
        if ($LASTEXITCODE -eq 0) { Ok '최신 코드로 업데이트 (git pull)' } else { Say '최신 코드 받기(git pull)는 건너뛰었어요. 나중에 Cursor에서 직접 받아주세요.' }
      } else {
        Skip '고친 파일이 있어서 git pull은 하지 않았어요'
      }
      Pop-Location
    }
  } else {
    if ((Test-Path $Path) -and (Get-ChildItem $Path -Force -ErrorAction SilentlyContinue | Select-Object -First 1)) {
      Fail "'$Path' 폴더가 이미 있는데 독서의숲 저장소가 아니에요. 폴더 이름을 바꾸거나 -Path 로 다른 위치를 지정해주세요."
    }
    if ($DryRun) {
      Dry "git clone $RepoUrl `"$Path`" 예정"
      $repo = $Path
    } else {
      New-Item -ItemType Directory -Force (Split-Path $Path -Parent) | Out-Null
      Say "저장소 받는 중 → $Path"
      & git clone $RepoUrl $Path
      if ($LASTEXITCODE -ne 0) { Fail '저장소를 받지 못했어요(git clone). 인터넷 연결과 GitHub 로그인을 확인해주세요.' }
      $repo = $Path
      Ok '저장소 받기 완료'
    }
  }

  # 4. 패키지 설치
  Step '4/6 패키지 설치 (npm ci, 몇 분 걸려요)'
  if ($DryRun) {
    Dry "npm ci ($repo)"
  } else {
    Push-Location $repo
    try {
      if (Test-Path 'node_modules\.package-lock.json') {
        $lockTime = (Get-Item 'package-lock.json').LastWriteTimeUtc
        $installed = (Get-Item 'node_modules\.package-lock.json').LastWriteTimeUtc
        if ($installed -ge $lockTime) { Skip '이미 설치되어 있어요 (package-lock.json 변경 없음)' } else { Npm ci --no-fund --no-audit; Ok '패키지 설치 완료' }
      } else {
        Npm ci --no-fund --no-audit
        Ok '패키지 설치 완료'
      }
    } finally { Pop-Location }
  }

  # 5. Vercel 로그인 · 프로젝트 연결
  Step '5/6 Vercel 로그인 · 프로젝트 연결'
  if ($DryRun) {
    Dry 'npx vercel whoami → (필요하면) npx vercel login'
    Dry "npx vercel link --yes --project $VercelProject --scope $VercelScope"
  } else {
    Push-Location $repo
    try {
      Vercel whoami *> $null
      if ($LASTEXITCODE -ne 0) {
        Say '브라우저가 열리면 기존과 같은 Vercel 계정(GitHub로 로그인)으로 로그인해주세요.'
        Vercel login
        Vercel whoami *> $null
        if ($LASTEXITCODE -ne 0) { Fail 'Vercel 로그인이 끝나지 않았어요. 다시 실행해주세요.' }
      }
      Ok 'Vercel 로그인 확인'
      if (Test-Path '.vercel\project.json') {
        Skip 'Vercel 프로젝트가 이미 연결되어 있어요'
      } else {
        Vercel link --yes --project $VercelProject --scope $VercelScope
        if ($LASTEXITCODE -ne 0) { Fail "Vercel 프로젝트($VercelProject) 연결 실패. 같은 Vercel 계정인지 확인해주세요." }
        Ok 'Vercel 프로젝트 연결 완료'
      }
    } finally { Pop-Location }
  }

  # 6. 개발용 환경 변수
  Step '6/6 개발용 환경 변수 받기 (.env.local)'
  if ($DryRun) {
    Dry 'npx vercel env pull .env.local --environment=development'
  } else {
    Push-Location $repo
    try {
      Vercel env pull .env.local --environment=development --yes
      if ($LASTEXITCODE -ne 0 -or -not (Test-Path '.env.local')) { Fail '환경 변수를 받지 못했어요(vercel env pull). 다시 실행해주세요.' }
      $envText = Get-Content '.env.local' -Raw
      $missing = @('KAKAO_REST_API_KEY', 'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY') | Where-Object { $envText -notmatch "(?m)^$_=" }
      if ($missing) { Fail "'.env.local'에 다음 값이 없어요: $($missing -join ', '). Vercel의 Development 환경 변수를 확인해주세요." }
      Ok '.env.local 준비 완료 (git에는 올라가지 않아요)'
    } finally { Pop-Location }
  }

  Write-Host ''
  Write-Host '=== 설정이 끝났어요! ===' -ForegroundColor Green
  Write-Host ''
  Write-Host '  다음 순서:'
  Write-Host "   1. Cursor에서 [File → Open Folder]로 이 폴더를 여세요:  $repo"
  Write-Host '   2. Cursor의 터미널에서 실행:  npx expo start --web   (브라우저에서 http://localhost:8081)'
  Write-Host '   3. AI에게 작업을 맡길 때는 먼저 docs/HANDOFF.md 를 읽게 하세요.'
  Write-Host ''
}

# 파일로 실행되면 스크립트 위치를, irm | iex로 실행되면 빈 값을 넘깁니다.
$rfScriptDir = if ($PSCommandPath) { Split-Path $PSCommandPath -Parent } else { '' }
try {
  Invoke-ReadingForestSetup @args -ScriptDir $rfScriptDir
} catch {
  Write-Host ''
  Write-Host "[중단] 설정을 멈췄어요: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host '   문제를 해결한 뒤 같은 방법으로 다시 실행하면 이어서 진행돼요.' -ForegroundColor Red
}
