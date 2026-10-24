<#
  Toxic Skill — установка моста Gizmo одной командой.

  На ПК с сервером Gizmo открой PowerShell и вставь:
    [Net.ServicePointManager]::SecurityProtocol=3072; irm https://raw.githubusercontent.com/ToxicSkill012/ToxicBooking/main/bridge/install.ps1 | iex

  Что делает:
    1. Скачивает мост в C:\ToxicBridge (повторный запуск — обновление, настройки сохраняются).
    2. Спрашивает адрес, логин и пароль Gizmo и проверяет, что Gizmo их принимает.
    3. Проверяет, что мост видит ПК и время, оставшееся у игроков.
    4. Останавливает старый мост и ставит новый в автозапуск Windows — работает и после перезагрузки.
#>
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}

$Repo    = 'https://raw.githubusercontent.com/ToxicSkill012/ToxicBooking/main/bridge'
$Dir     = 'C:\ToxicBridge'
$AppUrl  = 'https://script.google.com/macros/s/AKfycbzKk5f8P8RU9J6DQRxZEjEIp7lc1KlE-6n3yHomFyXolsqEAK2Dwv3ddm_VpAzrscPy/exec'
$Task    = 'ToxicSkill Gizmo Bridge'
# Проверка установщика на стенде (не Windows): свои папка, адреса и без автозапуска
$Test = [bool]$env:TOXIC_BRIDGE_TEST
if ($Test) { $Repo = $env:TOXIC_BRIDGE_REPO; $Dir = $env:TOXIC_BRIDGE_DIR; $AppUrl = $env:TOXIC_BRIDGE_APP }
$Shell = if ($Test) { 'pwsh' } else { 'powershell' }
$OneLine = "[Net.ServicePointManager]::SecurityProtocol=3072; irm $Repo/install.ps1 | iex"

function Say([string]$t, [string]$c = 'Gray') { Write-Host $t -ForegroundColor $c }
function Ask([string]$q, [string]$def = '') {
  $s = if ($def) { "$q [$def]" } else { $q }
  $v = Read-Host $s
  if ([string]::IsNullOrWhiteSpace($v)) { return $def }
  return $v.Trim()
}

Say ''
Say '=== Toxic Skill: мост Gizmo → приложение брони ===' 'Green'

# Автозапуск ставится от имени системы — нужны права администратора. Нет их — перезапускаемся с ними.
$admin = $Test -or ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Say 'Нужны права администратора — сейчас Windows спросит разрешение…' 'Yellow'
  try {
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -NoExit -Command `"$OneLine`""
  } catch { Say 'Не удалось получить права администратора. Открой PowerShell «от имени администратора» и вставь команду снова.' 'Red' }
  return
}

# 1. Файлы моста
New-Item -ItemType Directory -Force -Path $Dir | Out-Null
Say "1) Скачиваю мост в $Dir…"
foreach ($f in @('gizmo-bridge.ps1', 'start-bridge.cmd', 'probe.cmd', 'install-autostart.cmd', 'uninstall-autostart.cmd', 'bridge.config.example.json')) {
  Invoke-WebRequest -UseBasicParsing -Uri "$Repo/$f" -OutFile (Join-Path $Dir $f)
}
Say '   готово' 'Green'

# 2. Настройки: адрес и логин Gizmo (проверяем, что Gizmo их принимает)
$cfgPath = Join-Path $Dir 'bridge.config.json'
$cfg = $null
function To-Table($o) {
  $t = [ordered]@{}
  if ($o) { foreach ($p in $o.PSObject.Properties) { $t[$p.Name] = $p.Value } }
  return $t
}
if (Test-Path $cfgPath) {
  try { $cfg = To-Table (Get-Content -Raw -Encoding UTF8 $cfgPath | ConvertFrom-Json); $cfg.hostMap = To-Table $cfg.hostMap } catch { $cfg = $null }
}
function Test-Gizmo($url, $user, $pass) {
  $h = @{ Authorization = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${user}:${pass}")); Accept = 'application/json' }
  foreach ($p in @('/api/v2.0/hosts?Pagination.Limit=1', '/api/hostcomputers', '/api/hosts')) {
    try { Invoke-RestMethod -Uri ($url.TrimEnd('/') + $p) -Headers $h -TimeoutSec 8 | Out-Null; return 'ok' }
    catch {
      $code = 0; try { $code = [int]$_.Exception.Response.StatusCode } catch {}
      if ($code -eq 401 -or $code -eq 403) { return 'auth' }
      if ($code -eq 0) { return 'down' }
    }
  }
  return 'api'
}
$needAsk = -not $cfg -or -not $cfg.gizmoUrl -or -not $cfg.gizmoUser
if (-not $needAsk) {
  Say "2) Настройки уже есть ($($cfg.gizmoUrl), пользователь $($cfg.gizmoUser)) — проверяю…"
  $r = Test-Gizmo $cfg.gizmoUrl $cfg.gizmoUser $cfg.gizmoPassword
  if ($r -ne 'ok') { Say '   Gizmo их не принимает — введём заново.' 'Yellow'; $needAsk = $true } else { Say '   Gizmo отвечает' 'Green' }
}
if ($needAsk) {
  Say '2) Данные для входа в Gizmo (логин оператора, как в Gizmo Manager)'
  $url = 'http://127.0.0.1'; $user = 'admin'
  for ($try = 1; $try -le 5; $try++) {
    $url  = Ask '   Адрес Gizmo' $url
    if ($url -notmatch '^https?://') { $url = 'http://' + $url }
    $user = Ask '   Логин' $user
    if ($Test) { $pass = Read-Host '   Пароль' } else {
      $sec  = Read-Host '   Пароль' -AsSecureString
      $pass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    }
    $r = Test-Gizmo $url $user $pass
    if ($r -eq 'ok') { Say '   Gizmo принял логин' 'Green'; break }
    if ($r -eq 'auth') { Say '   Gizmo не принял логин или пароль — попробуй ещё раз.' 'Red' }
    elseif ($r -eq 'down') { Say "   Gizmo не отвечает по адресу $url. В Gizmo: Настройки → Web portal → включить (запомни порт; не 80 — укажи адрес так: http://127.0.0.1:ПОРТ)." 'Red' }
    else { Say '   Gizmo ответил, но API недоступно — проверь, что включён Web portal.' 'Red' }
    if ($try -eq 5) { Say 'Не получилось подключиться к Gizmo. Исправь и запусти команду снова.' 'Red'; return }
  }
  $old = if ($cfg) { $cfg.hostMap } else { [ordered]@{} }
  $cfg = [ordered]@{ gizmoUrl = $url; gizmoUser = $user; gizmoPassword = $pass; appUrl = $AppUrl; bridgeKey = ''; intervalSec = 30; timeUnit = 'auto'; maxLeftMin = 720; hostMap = $old }
}
# Адрес приложения — всегда актуальный
$cfg.appUrl = $AppUrl
if (-not $cfg.hostMap) { $cfg.hostMap = [ordered]@{} }
function Save-Cfg { [IO.File]::WriteAllText($cfgPath, ($cfg | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding $false)) }
Save-Cfg

# 3. Проверка: какие ПК видит мост и знает ли он время игроков.
# ПК, которые в Gizmo названы по-своему (не ST-01 / VIP-01 / BC-01), сопоставляем с приложением вопросами.
$probe = Join-Path $Dir 'probe.txt'
for ($round = 1; $round -le 2; $round++) {
  Say '3) Проверяю, что видит мост…'
  & $Shell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Dir 'gizmo-bridge.ps1') -Probe -Config $cfgPath | Out-Host
  if (-not (Test-Path $probe)) { break }
  $line = (Get-Content -Encoding UTF8 $probe | Where-Object { $_ -match '^Не сопоставлены' } | Select-Object -First 1)
  if (-not $line) { break }
  $names = @(($line -replace '^[^:]*:\s*', '').Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  if (-not $names.Count) { break }
  Say '   Эти ПК в Gizmo названы по-своему — подскажи, какие это в приложении.' 'Yellow'
  Say '   Пиши номер как в приложении: ST-07, VIP-01, BC-03. Enter — не показывать этот ПК.' 'Yellow'
  foreach ($n in $names) {
    $v = (Ask "   «$n» →" '').ToUpper() -replace '\s', ''
    $m = [regex]::Match($v, '^(ST|VIP|BC)-?0*(\d{1,2})$')
    $cfg.hostMap[$n] = if ($m.Success) { '{0}-{1:D2}' -f $m.Groups[1].Value, [int]$m.Groups[2].Value } else { '' }
  }
  Save-Cfg
}

# 4. Старый мост — остановить, чтобы два моста не перебивали друг друга
# Ищем только процессы-скрипты (PowerShell, cmd, Python, Node…) — сам Gizmo и другие программы не трогаем
$self = $PID
$hosts = @('powershell.exe', 'pwsh.exe', 'cmd.exe', 'python.exe', 'pythonw.exe', 'py.exe', 'node.exe', 'wscript.exe', 'cscript.exe', 'curl.exe')
$old = @()
if (-not $Test) {
  $old = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.ProcessId -ne $self -and $hosts -contains $_.Name.ToLower() -and $_.CommandLine -and
    $_.CommandLine -match 'gizmo' -and $_.CommandLine -notmatch [regex]::Escape($Dir)
  })
}
if ($old.Count) {
  Say '4) Найден старый мост:' 'Yellow'
  $old | ForEach-Object { Say ("   PID {0}: {1}" -f $_.ProcessId, ($_.CommandLine.Substring(0, [Math]::Min(120, $_.CommandLine.Length)))) }
  if ((Ask '   Остановить его? (Y/n)' 'Y') -match '^[YyДд]') {
    $old | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force } catch {} }
    Say '   остановлен' 'Green'
  } else { Say '   оставлен — закрой его окно сам, иначе мосты будут перебивать друг друга' 'Yellow' }
} else {
  Say '4) Старый мост в процессах не найден. Если он запущен в отдельном окне консоли — закрой его.' 'Yellow'
}

# 5. Автозапуск: от имени системы, при старте Windows; сразу запускаем
if ($Test) { Say 'Стенд: автозапуск пропущен' 'Yellow'; return }
Say '5) Ставлю мост в автозапуск и запускаю…'
try { schtasks /End /TN $Task 2>$null | Out-Null } catch {}
$ps = Join-Path $Dir 'gizmo-bridge.ps1'
schtasks /Create /F /TN $Task /SC ONSTART /DELAY 0001:00 /RU SYSTEM /RL HIGHEST /TR "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ps`"" | Out-Null
schtasks /Run /TN $Task | Out-Null
Start-Sleep -Seconds 8
$log = Join-Path $Dir 'bridge.log'
if (Test-Path $log) { Get-Content $log -Tail 3 | ForEach-Object { Say "   $_" } }

Say ''
Say 'Готово! Мост работает и будет запускаться вместе с Windows.' 'Green'
Say 'Через минуту в приложении у каждого занятого ПК появится время: «до 17:45 · ещё 40 мин».'
Say "Лог: $log · Удалить из автозапуска: $Dir\uninstall-autostart.cmd"
