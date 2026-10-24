<#
  Toxic Skill — мост Gizmo → приложение брони

  Раз в N секунд спрашивает у сервера Gizmo, какие ПК заняты, сколько
  времени осталось у игрока и давно ли он играет, и отправляет это в Apps Script (gizmoSync).
  В приложении клиенты видят «Занят до 19:45 · ещё 1 ч 12 мин» и бронируют ПК с 19:45.

  Адреса API — по официальной документации Gizmo (http://АДРЕС_GIZMO/doc/index.html):
    ПК — /api/v2.0/hosts, сессии — /api/usersessions/activeinfo,
    остаток — /api/v2.0/users/{id}/userusagetime (usableMinutes, в минутах),
    запасной — /api/users/{id}/balance (availableTime, в секундах).

  Запуск (PowerShell на ПК с сервером Gizmo):
    powershell -ExecutionPolicy Bypass -File .\gizmo-bridge.ps1 -Probe   # проверка API, пишет probe.txt
    powershell -ExecutionPolicy Bypass -File .\gizmo-bridge.ps1 -Once    # один проход, показать что уйдёт
    powershell -ExecutionPolicy Bypass -File .\gizmo-bridge.ps1          # работать постоянно

  Настройки — в bridge.config.json рядом со скриптом (образец: bridge.config.example.json).
  Работает в Windows PowerShell 5.1 и PowerShell 7, ничего ставить не нужно.
#>
param(
  [switch]$Probe,
  [switch]$Once,
  [string]$Config = ''
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
# Google принимает только TLS 1.2+ (в Windows PowerShell 5.1 по умолчанию бывает TLS 1.0)
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}

$here = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
if (-not $Config) { $Config = Join-Path $here 'bridge.config.json' }

function Log([string]$msg) {
  $line = (Get-Date -Format 'HH:mm:ss') + '  ' + $msg
  Write-Host $line
  try {
    $f = Join-Path $here 'bridge.log'
    if ((Test-Path $f) -and (Get-Item $f).Length -gt 1MB) { Move-Item $f ($f + '.old') -Force }
    Add-Content -Path $f -Value ((Get-Date -Format 'yyyy-MM-dd ') + $line) -Encoding UTF8
  } catch {}
}

# ─── Настройки ───
if (-not (Test-Path $Config)) {
  Write-Host "Нет файла настроек: $Config"
  Write-Host 'Скопируй bridge.config.example.json в bridge.config.json и заполни.'
  exit 1
}
$cfg = Get-Content -Raw -Encoding UTF8 $Config | ConvertFrom-Json
function CfgVal($name, $default) {
  $p = $cfg.PSObject.Properties[$name]
  if ($p -and $null -ne $p.Value -and "$($p.Value)" -ne '') { return $p.Value }
  return $default
}
$GizmoUrl   = ([string](CfgVal 'gizmoUrl' 'http://127.0.0.1')).TrimEnd('/')
$GizmoUser  = [string](CfgVal 'gizmoUser' 'admin')
$GizmoPass  = [string](CfgVal 'gizmoPassword' '')
$AppUrl     = [string](CfgVal 'appUrl' '')
$BridgeKey  = [string](CfgVal 'bridgeKey' '')
$Interval   = [int](CfgVal 'intervalSec' 30)
$TimeUnit   = ([string](CfgVal 'timeUnit' 'auto')).ToLower()
$MaxLeftMin = [int](CfgVal 'maxLeftMin' 720)
$HostMap    = CfgVal 'hostMap' $null
if ($Interval -lt 15) { $Interval = 15 }

$auth = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${GizmoUser}:${GizmoPass}"))
$gzHeaders = @{ Authorization = $auth; Accept = 'application/json' }

# Адреса API отличаются в разных версиях Gizmo — пробуем по очереди и запоминаем рабочий
$HostEndpoints = @('/api/v2.0/hosts?Pagination.Limit=1000', '/api/hostcomputers', '/api/hosts', '/api/hostcomputer', '/api/host')
$SessionEndpoints = @('/api/usersessions/activeinfo', '/api/usersessions/active', '/api/v2.0/usersessions/activeinfo', '/api/sessions/activeinfo', '/api/sessions/active')
# Остаток времени игрока: сначала точные минуты (usableMinutes), потом баланс (availableTime — секунды)
$UsageEndpoints = @('/api/v2.0/users/{id}/userusagetime')
$BalanceEndpoints = @('/api/users/{id}/balance', '/api/v2.0/users/{id}/balance')
foreach ($pair in @(@('hostsEndpoint', 'HostEndpoints'), @('sessionsEndpoint', 'SessionEndpoints'), @('usageEndpoint', 'UsageEndpoints'), @('balanceEndpoint', 'BalanceEndpoints'))) {
  $v = [string](CfgVal $pair[0] '')
  if ($v) { Set-Variable -Name $pair[1] -Value @($v) }
}
$script:okEp = @{}
$script:skipUntil = @{}   # адреса, которых нет в этой версии Gizmo, не дёргаем 10 минут

function Gizmo-Get([string]$path) {
  return Invoke-RestMethod -Uri ($GizmoUrl + $path) -Headers $gzHeaders -Method Get -TimeoutSec 10
}
# Первый отвечающий адрес из списка (и запоминаем его)
function Gizmo-First([string]$kind, [string[]]$paths, [string]$id = '') {
  if ($script:skipUntil.ContainsKey($kind) -and (Get-Date) -lt $script:skipUntil[$kind]) { throw "${kind}: нет подходящего адреса API" }
  $list = @($paths)
  if ($script:okEp.ContainsKey($kind)) { $list = @($script:okEp[$kind]) }
  $lastErr = $null
  foreach ($p in $list) {
    $url = $p.Replace('{id}', $id)
    try {
      $r = Gizmo-Get $url
      $script:okEp[$kind] = $p
      return $r
    } catch { $lastErr = $_ }
  }
  if ($script:okEp.ContainsKey($kind)) { $script:okEp.Remove($kind) }
  elseif ($kind -ne 'hosts') { $script:skipUntil[$kind] = (Get-Date).AddMinutes(10) }
  if ($lastErr) { throw $lastErr }
  return $null
}

# Ответ бывает массивом или обёрткой { result: { data: [...] } } — достаём список
function Items($r) {
  if ($null -eq $r) { return @() }
  if ($r -is [array]) { return $r }
  foreach ($k in @('result', 'data', 'items', 'value')) {
    $p = $r.PSObject.Properties[$k]
    if ($p -and $null -ne $p.Value) { return Items $p.Value }
  }
  return @($r)
}
# Значение первого найденного поля (имена без учёта регистра); поддерживает «Host.Id»
function F($o, [string[]]$names) {
  if ($null -eq $o) { return $null }
  foreach ($n in $names) {
    $cur = $o
    foreach ($part in $n.Split('.')) {
      if ($null -eq $cur) { break }
      $p = $cur.PSObject.Properties[$part]
      if ($p) { $cur = $p.Value } else { $cur = $null }
    }
    if ($null -ne $cur -and "$cur" -ne '') { return $cur }
  }
  return $null
}

# Имя ПК в Gizmo → метка в приложении (ST-01, VIP-02, BC-05)
function Get-Label([string]$name, $number) {
  if ($HostMap) {
    foreach ($key in @($name, "#$number")) {
      if (-not $key) { continue }
      $p = $HostMap.PSObject.Properties[$key]
      if ($p) { return ([string]$p.Value).ToUpper() }   # пустая строка = этот ПК не показывать
    }
  }
  $m = [regex]::Match($name.Trim(), '^(ST|STD|STANDARD|VIP|BC|BOOT|BOOTCAMP)[\s\-_#]*0*(\d{1,2})$', 'IgnoreCase')
  if ($m.Success) {
    $z = $m.Groups[1].Value.ToUpper()
    if ($z -like 'ST*') { $z = 'ST' } elseif ($z -like 'B*') { $z = 'BC' }
    return ('{0}-{1:D2}' -f $z, [int]$m.Groups[2].Value)
  }
  return $null
}

# Время из Gizmo → минуты. Бывает числом или строкой «01:23:45».
# $unit — в чём число: 'minutes' (usableMinutes), 'seconds' (availableTime в балансе), 'auto' — догадка.
# Настройка timeUnit в bridge.config.json (seconds/minutes/hours) перекрывает баланс и догадку.
# Раньше догадка считала всё меньше 1440 минутами: 10 минут баланса (600 секунд) превращались в 10 часов.
function To-Minutes($v, [string]$unit = 'auto') {
  if ($null -eq $v) { return $null }
  $s = "$v"
  if ($s -match '^\-?(\d+\.)?\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?$') {
    try { return [int][Math]::Floor([TimeSpan]::Parse($s).TotalMinutes) } catch { return $null }
  }
  $d = 0.0
  if (-not [double]::TryParse($s, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$d)) { return $null }
  if ($unit -ne 'minutes' -and $TimeUnit -ne 'auto') { $unit = $TimeUnit }
  switch ($unit) {
    'seconds' { return [int][Math]::Floor($d / 60) }
    'minutes' { return [int][Math]::Floor($d) }
    'hours'   { return [int][Math]::Floor($d * 60) }
    default   { if ($d -ge 1440) { return [int][Math]::Floor($d / 60) } else { return [int][Math]::Floor($d) } }
  }
}
# Сколько минут осталось у игрока по Gizmo (null — не знаем)
function Get-UserLeft($uid) {
  if ($null -eq $uid -or "$uid" -eq '0') { return $null }
  # 1) usableMinutes: по уровню на каждый источник времени (пакеты, фикс. время, депозит) — складываем
  try {
    $levels = @(Items (Gizmo-First 'usage' $UsageEndpoints "$uid"))
    $sum = $null
    foreach ($l in $levels) {
      $m = F $l @('usableMinutes', 'UsableMinutes')
      if ($null -ne $m) { $sum = [int]$sum + [int][Math]::Floor([double]$m) }
    }
    if ($null -ne $sum) { return $sum }
  } catch {}
  # 2) баланс: availableTime — секунды
  try {
    $b = Gizmo-First 'balance' $BalanceEndpoints "$uid"
    $v = F $b @('availableTime', 'result.availableTime', 'AvailableTime', 'result.AvailableTime')
    if ($null -ne $v) { return To-Minutes $v 'seconds' }
    $v = F $b @('timeLeft', 'result.timeLeft')
    if ($null -ne $v) { return To-Minutes $v }
  } catch {}
  return $null
}
# Сколько минут игрок уже за ПК: по времени входа (lastLogin / createdTime) — null, если неизвестно
function Get-Played($sess) {
  $t = F $sess @('lastLogin', 'LastLogin', 'createdTime', 'CreatedTime', 'startTime', 'StartTime')
  if ($null -eq $t) { return $null }
  try {
    $dt = if ($t -is [datetime]) { $t } else { [datetime]::Parse("$t", [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeLocal) }
    $m = [int][Math]::Floor(((Get-Date) - $dt.ToLocalTime()).TotalMinutes)
    if ($m -ge 0 -and $m -le 2880) { return $m }
  } catch {}
  return $null
}

$TimeFields = @('timeLeft', 'remainingTime', 'availableTime', 'AvailableTimeLeft', 'balance.availableTime', 'UserBalance.AvailableTime')

# Понятный текст ошибки вместо технического
function Explain($err) {
  $m = $err.Exception.Message
  $code = 0
  try { $code = [int]$err.Exception.Response.StatusCode } catch {}
  if ($m -match 'bridge_key') { return 'Apps Script не принял ключ: проверь bridgeKey (BRIDGE_KEY в свойствах скрипта)' }
  if ($code -eq 401 -or $code -eq 403) { return "Gizmo отказал в доступе ($code): проверь gizmoUser / gizmoPassword" }
  if ($m -match 'refused|actively refused|No connection|Unable to connect|отверг|Не удается') { return "Gizmo не отвечает по адресу $GizmoUrl — проверь gizmoUrl и что в Gizmo включён «Web portal»" }
  return $m
}

# ─── Один проход: собрать статус всех ПК ───
function Collect {
  $hosts = Items (Gizmo-First 'hosts' $HostEndpoints)
  $sessions = @()
  $sessErr = $null
  try { $sessions = Items (Gizmo-First 'sessions' $SessionEndpoints) } catch { $sessErr = $_.Exception.Message }

  # Кто где сидит: hostId → сессия
  $byHost = @{}
  foreach ($s in $sessions) {
    $hid = F $s @('hostId', 'host.id', 'hostComputerId')
    $state = F $s @('state', 'sessionState')
    if ($null -ne $state -and "$state" -match '^(ended|closed|finished|completed)$') { continue }
    # Числовое состояние Gizmo — набор флагов, 2 = «завершена»
    $sn = 0
    if ($null -ne $state -and [int]::TryParse("$state", [ref]$sn) -and ($sn -band 2)) { continue }
    if ($null -ne $hid) { $byHost["$hid"] = $s }
  }

  $out = @()
  $unmapped = @()
  foreach ($h in $hosts) {
    $id = F $h @('id', 'hostId')
    $name = [string](F $h @('name', 'hostName', 'computerName'))
    $num = F $h @('number', 'hostNumber')
    if (-not $name) { continue }
    $label = Get-Label $name $num
    if ($null -eq $label) { $unmapped += $name; continue }
    if ($label -eq '') { continue }

    $sess = $null
    if ($null -ne $id -and $byHost.ContainsKey("$id")) { $sess = $byHost["$id"] }
    $busy = $false
    if ($sess) { $busy = $true }
    elseif (-not $sessions.Count) {
      # Сессий нет в API — смотрим поля самого ПК
      $uid = F $h @('userId', 'currentUserId', 'loggedInUserId', 'user.id')
      $free = F $h @('isFree')
      $inUse = F $h @('isInUse', 'inUse')
      if (($null -ne $uid -and "$uid" -ne '0') -or ($null -ne $free -and "$free" -eq 'False') -or ("$inUse" -eq 'True')) { $busy = $true }
    }

    $left = $null; $played = $null
    if ($busy) {
      $left = To-Minutes (F $sess @($TimeFields))
      if ($null -eq $left) {
        $uid = F $sess @('userId', 'user.id')
        if ($null -eq $uid) { $uid = F $h @('userId', 'currentUserId', 'loggedInUserId') }
        $left = Get-UserLeft $uid
      }
      # 0 или неправдоподобно много (постоплата, большой депозит) — «не знаем», приложение не выдумывает
      if ($null -ne $left -and ($left -le 0 -or $left -gt $MaxLeftMin)) { $left = $null }
      if ($sess) { $played = Get-Played $sess }
    }
    $out += [pscustomobject]@{ pc = $label; busy = $busy; left = $left; played = $played; gizmo = $name }
  }
  return [pscustomobject]@{ hosts = $out; unmapped = $unmapped; sessErr = $sessErr }
}

function Send-Status($hosts) {
  if (-not $AppUrl) { throw 'Не указан appUrl в bridge.config.json' }
  # ПК:занят[:минут осталось[:минут уже играет]] — например ST-01:1:45:30, остаток неизвестен: ST-02:1::30
  $parts = foreach ($h in $hosts) {
    if (-not $h.busy) { "$($h.pc):0"; continue }
    $p = "$($h.pc):1"
    if ($null -ne $h.left -or $null -ne $h.played) { $p += ':' + $(if ($null -ne $h.left) { $h.left } else { '' }) }
    if ($null -ne $h.played) { $p += ":$($h.played)" }
    $p
  }
  $busyN = @($hosts | Where-Object { $_.busy }).Count
  $q = 'action=gizmoSync&hosts=' + [uri]::EscapeDataString(($parts -join ',')) +
    '&total=' + $hosts.Count + '&busy=' + $busyN + '&free=' + ($hosts.Count - $busyN) +
    '&key=' + [uri]::EscapeDataString($BridgeKey)
  $sep = '?'; if ($AppUrl.Contains('?')) { $sep = '&' }
  $r = Invoke-RestMethod -Uri ($AppUrl + $sep + $q) -Method Get -TimeoutSec 30
  if (-not $r.ok) { throw ('Apps Script ответил: ' + ($r | ConvertTo-Json -Compress)) }
  return $busyN
}

# ─── Режим проверки: какие адреса API отвечают и что в них ───
function Mask($o) {
  if ($null -eq $o) { return $null }
  $j = $o | ConvertTo-Json -Depth 4 -Compress
  # Личные данные игроков в отчёт не попадают
  return [regex]::Replace($j, '"(\w*(phone|mobile|email|firstname|lastname|username|login|password|birth|address)\w*)":"[^"]*"', '"$1":"***"', 'IgnoreCase')
}
function Run-Probe {
  $rep = New-Object System.Collections.Generic.List[string]
  $rep.Add("Gizmo: $GizmoUrl   (пользователь API: $GizmoUser)")
  $rep.Add('')
  $firstUser = $null
  foreach ($p in ($HostEndpoints + $SessionEndpoints)) {
    try {
      $items = @(Items (Gizmo-Get $p))
      $rep.Add("OK   $p   записей: $($items.Count)")
      if ($items.Count) {
        $rep.Add('     пример: ' + (Mask $items[0]))
        if (-not $firstUser) { $firstUser = F $items[0] @('userId', 'user.id') }
      }
    } catch {
      $code = ''
      try { $code = [int]$_.Exception.Response.StatusCode } catch {}
      $rep.Add("--   $p   $code $($_.Exception.Message)")
    }
  }
  if ($firstUser) {
    foreach ($p in ($UsageEndpoints + $BalanceEndpoints)) {
      $u = $p.Replace('{id}', "$firstUser")
      try { $rep.Add("OK   $u   " + (Mask (Gizmo-Get $u))) } catch { $rep.Add("--   $u   $($_.Exception.Message)") }
    }
  } else { $rep.Add(''); $rep.Add('Сейчас никто не играет — баланс времени проверить не на ком. Запусти -Probe, когда кто-то сидит.') }
  $rep.Add('')
  try {
    $c = Collect
    $rep.Add('Что уйдёт в приложение:')
    foreach ($h in $c.hosts) { $rep.Add(('  {0,-7} ← {1,-12} {2}{3}{4}' -f $h.pc, $h.gizmo, $(if ($h.busy) { 'занят' } else { 'свободен' }), $(if ($null -ne $h.left) { " · осталось $($h.left) мин" } elseif ($h.busy) { ' · остаток неизвестен' } else { '' }), $(if ($null -ne $h.played) { " · играет $($h.played) мин" } else { '' }))) }
    if ($c.unmapped.Count) { $rep.Add('Не сопоставлены (добавь в hostMap): ' + ($c.unmapped -join ', ')) }
    if ($c.sessErr) { $rep.Add('Сессии не получены: ' + $c.sessErr) }
    $rep.Add('Сверь «осталось» с временем в Gizmo. Отличается в 60 раз — поставь в настройках timeUnit: "seconds" или "minutes".')
    $rep.Add('«остаток неизвестен» — у игрока постоплата или в Gizmo нет баланса: админ может указать время в приложении (Зал сейчас → ⏱).')
  } catch { $rep.Add('Сбор статуса не удался: ' + (Explain $_)) }
  $rep | ForEach-Object { Write-Host $_ }
  $f = Join-Path $here 'probe.txt'
  $rep | Set-Content -Path $f -Encoding UTF8
  Write-Host ''
  Write-Host "Сохранено в $f — пришли этот файл, если что-то не так."
}

if ($Probe) { Run-Probe; exit 0 }

Log "Мост запущен: Gizmo $GizmoUrl → приложение, раз в $Interval с"
if (-not $BridgeKey) { Log '⚠️ bridgeKey пустой — если в Apps Script задан BRIDGE_KEY, данные не примут' }
$fails = 0
$lastWarn = ''
while ($true) {
  try {
    $c = Collect
    if (-not $c.hosts.Count) { throw 'Gizmo не вернул ни одного ПК, который удалось сопоставить (проверь hostMap, запусти -Probe)' }
    $w = @()
    if ($c.unmapped.Count) { $w += 'не сопоставлены: ' + ($c.unmapped -join ', ') }
    if ($c.sessErr) { $w += 'сессии недоступны, занятость по полям ПК' }
    $warn = $w -join ' · '
    if ($warn -and $warn -ne $lastWarn) { Log "⚠️ $warn" }
    $lastWarn = $warn
    $busyN = Send-Status $c.hosts
    $withLeft = @($c.hosts | Where-Object { $null -ne $_.left }).Count
    if ($Once -or $fails -gt 0) { Log "✅ отправлено: $($c.hosts.Count) ПК, занято $busyN (с остатком времени: $withLeft)" }
    if ($Once) {
      foreach ($h in $c.hosts) { Write-Host ('  {0,-7} {1}{2}{3}' -f $h.pc, $(if ($h.busy) { 'занят' } else { 'свободен' }), $(if ($null -ne $h.left) { " · ещё $($h.left) мин" } else { '' }), $(if ($null -ne $h.played) { " · играет $($h.played) мин" } else { '' })) }
      break
    }
    $fails = 0
  } catch {
    $fails++
    Log "❌ $(Explain $_)"
    if ($Once) { exit 1 }
  }
  # При сбоях — реже, чтобы не забивать лог и сервер (до 5 минут)
  $wait = $Interval
  if ($fails -gt 0) { $wait = [Math]::Min(300, $Interval * [Math]::Pow(2, [Math]::Min($fails - 1, 4))) }
  Start-Sleep -Seconds ([int]$wait)
}
