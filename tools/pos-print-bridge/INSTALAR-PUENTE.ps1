param(
  [string]$PrinterName = "POS-80C",
  [int]$Port = 18181
)

$ErrorActionPreference = "Stop"
$taskName = "UpNDown POS Print Bridge"
$bridgePath = Join-Path $PSScriptRoot "UpNDownPrintBridge.ps1"

if (-not (Test-Path $bridgePath)) {
  throw "No se encontro UpNDownPrintBridge.ps1 en $PSScriptRoot"
}

$printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
if (-not $printer) {
  Write-Host "No se encontro la impresora '$PrinterName'." -ForegroundColor Red
  Write-Host "Instala primero la impresora termica y verifica su nombre en Windows." -ForegroundColor Yellow
  exit 1
}

$argument = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$bridgePath`" -PrinterName `"$PrinterName`" -Port $Port"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argument
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Days 3650) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Inicia el puente local ESC/POS de Up & Down al iniciar sesion en Windows." | Out-Null

# Detener una instancia anterior del bridge, si existe.
Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq 'powershell.exe' -and $_.CommandLine -like '*UpNDownPrintBridge.ps1*'
} | ForEach-Object {
  if ($_.ProcessId -ne $PID) {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 2

try {
  $health = Invoke-RestMethod "http://127.0.0.1:$Port/health" -TimeoutSec 5
  if ($health.ok) {
    Write-Host "OK: Print Bridge instalado y ejecutandose automaticamente." -ForegroundColor Green
    Write-Host "Impresora: $($health.printer)" -ForegroundColor Green
    Write-Host "Puerto local: $Port" -ForegroundColor Green
    Write-Host "Tarea de Windows: $taskName" -ForegroundColor Cyan
  } else {
    throw "El bridge respondio, pero health no devolvio ok=true."
  }
} catch {
  Write-Host "La tarea fue creada, pero el bridge no respondio en /health." -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
