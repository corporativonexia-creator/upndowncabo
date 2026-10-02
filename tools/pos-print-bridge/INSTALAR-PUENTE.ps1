param(
  [string]$PrinterName = "POS-80C",
  [int]$Port = 18181
)

$ErrorActionPreference = "Stop"
$taskName = "UpNDown POS Print Bridge"
$bridgePath = Join-Path $PSScriptRoot "UpNDownPrintBridge.ps1"
$launcherPath = Join-Path $PSScriptRoot "UpNDownPrintBridge.vbs"

if (-not (Test-Path $bridgePath)) {
  throw "No se encontro UpNDownPrintBridge.ps1 en $PSScriptRoot"
}

$printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
if (-not $printer) {
  Write-Host "No se encontro la impresora '$PrinterName'." -ForegroundColor Red
  Write-Host "Instala primero la impresora termica y verifica su nombre en Windows." -ForegroundColor Yellow
  exit 1
}

# Usamos WScript como lanzador para que el bridge quede realmente oculto.
# Las comillas dobles se duplican dentro del argumento VBScript.
$psCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$bridgePath`" -PrinterName `"$PrinterName`" -Port $Port"
$vbsCommand = $psCommand.Replace('"','""')
$vbs = @"
Set shell = CreateObject("WScript.Shell")
shell.Run "$vbsCommand", 0, False
"@
Set-Content -LiteralPath $launcherPath -Value $vbs -Encoding ASCII

$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$launcherPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Days 3650)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Inicia el puente local ESC/POS de Up & Down al iniciar sesion en Windows." | Out-Null

# Detener instancias anteriores del bridge antes de probar la nueva instalacion.
Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq 'powershell.exe' -and $_.CommandLine -like '*UpNDownPrintBridge.ps1*'
} | ForEach-Object {
  if ($_.ProcessId -ne $PID) {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

Start-ScheduledTask -TaskName $taskName

$health = $null
for ($i = 0; $i -lt 10; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $health = Invoke-RestMethod "http://127.0.0.1:$Port/health" -TimeoutSec 2
    if ($health.ok) { break }
  } catch {}
}

if ($health -and $health.ok) {
  Write-Host "OK: Print Bridge instalado y ejecutandose oculto." -ForegroundColor Green
  Write-Host "Impresora: $($health.printer)" -ForegroundColor Green
  Write-Host "Puerto local: $Port" -ForegroundColor Green
  Write-Host "Inicio automatico: al iniciar sesion en Windows" -ForegroundColor Cyan
  Write-Host "Ya puedes cerrar esta ventana de PowerShell." -ForegroundColor Cyan
} else {
  Write-Host "La tarea fue creada, pero el bridge no respondio en /health." -ForegroundColor Red
  Write-Host "Revisa el Historial de la tarea '$taskName' y la impresora '$PrinterName'." -ForegroundColor Yellow
  exit 1
}
