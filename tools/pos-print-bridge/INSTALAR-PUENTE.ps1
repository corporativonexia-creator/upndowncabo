param(
  [string]$PrinterName = "POS-80C",
  [int]$Port = 18181
)
$ErrorActionPreference = "Stop"
$taskName = "UpNDown POS Print Bridge"
$bridgePath = Join-Path $PSScriptRoot "UpNDownPrintBridge.ps1"
$launcherPath = Join-Path $PSScriptRoot "UpNDownPrintBridge.vbs"

# Require elevation because Task Scheduler and printer configuration can need admin rights.
$id=[Security.Principal.WindowsIdentity]::GetCurrent(); $p=New-Object Security.Principal.WindowsPrincipal($id)
if(-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){ throw "La instalacion requiere permisos de Administrador." }
if(-not (Test-Path $bridgePath)){ throw "No se encontro UpNDownPrintBridge.ps1 en $PSScriptRoot" }

# Find the thermal printer under the standard name or common driver-installed name.
$printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
if(-not $printer){
  $printer = Get-Printer | Where-Object { $_.Name -like 'POS-80*' -or $_.DriverName -like 'POS-80*' } | Select-Object -First 1
}
if(-not $printer){ throw "No se encontro una impresora POS-80. Instala/conecta primero la impresora termica." }

# Standardize queue name for the bridge.
if($printer.Name -ne $PrinterName){
  Rename-Printer -Name $printer.Name -NewName $PrinterName
  Start-Sleep -Milliseconds 500
  $printer = Get-Printer -Name $PrinterName
}

# If the vendor USB monitor reports an error, prefer an available USB00x port.
if($printer.PrinterStatus -eq 'Error' -or $printer.PortName -eq 'POS-80 PORT:'){
  $usb = Get-PrinterPort | Where-Object { $_.Name -match '^USB\d{3}$' } | Select-Object -First 1
  if($usb){
    Set-Printer -Name $PrinterName -PortName $usb.Name
    Restart-Service Spooler
    Start-Sleep -Seconds 2
    $printer = Get-Printer -Name $PrinterName
  }
}
if($printer.PrinterStatus -eq 'Error'){ throw "La impresora $PrinterName continua en estado Error. Revisa cable USB, driver y puerto antes de continuar." }

$psCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$bridgePath`" -PrinterName `"$PrinterName`" -Port $Port"
$vbsCommand = $psCommand.Replace('"','""')
$vbs = @"
Set shell = CreateObject("WScript.Shell")
shell.Run "$vbsCommand", 0, False
"@
Set-Content -LiteralPath $launcherPath -Value $vbs -Encoding ASCII

$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$launcherPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Days 3650)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if($existing){ Unregister-ScheduledTask -TaskName $taskName -Confirm:$false }
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Inicia el puente local ESC/POS de Up & Down al iniciar sesion en Windows." | Out-Null

Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'powershell.exe' -and $_.CommandLine -like '*UpNDownPrintBridge.ps1*' } | ForEach-Object { if($_.ProcessId -ne $PID){ Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } }
Start-ScheduledTask -TaskName $taskName
$health=$null
for($i=0;$i -lt 12;$i++){ Start-Sleep -Milliseconds 500; try{$health=Invoke-RestMethod "http://127.0.0.1:$Port/health" -TimeoutSec 2;if($health.ok){break}}catch{} }
if(-not ($health -and $health.ok)){ throw "La tarea fue creada, pero el Print Bridge no respondio en /health." }
Write-Host "OK: Up & Down POS Print Bridge instalado." -ForegroundColor Green
Write-Host "Impresora: $($health.printer) | Puerto Windows: $($printer.PortName) | Bridge: $($health.receipt)" -ForegroundColor Green
