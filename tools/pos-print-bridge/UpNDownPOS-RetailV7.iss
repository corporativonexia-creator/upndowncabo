#define MyAppName "Up & Down POS Print Bridge"
#define MyAppVersion "7.1"
#define MyAppPublisher "Up & Down Cabo"

[Setup]
AppId={{A76C0F12-4D1B-4CB6-A1D1-7E83B8B5A807}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\UpNDown POS Print Bridge
DisableProgramGroupPage=yes
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=dist
OutputBaseFilename=UpNDown-POS-PrintBridge-RetailV7.1-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
Uninstallable=yes

[Files]
Source: "UpNDownPrintBridge.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "INSTALAR-PUENTE.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "INICIAR-PUENTE.bat"; DestDir: "{app}"; Flags: ignoreversion

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\INSTALAR-PUENTE.ps1"" -PrinterName ""POS-80C"" -Port 18181"; WorkingDir: "{app}"; Description: "Configurar Print Bridge Retail v7.1"; Flags: waituntilterminated runhidden

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -Command ""Unregister-ScheduledTask -TaskName 'UpNDown POS Print Bridge' -Confirm:$false -ErrorAction SilentlyContinue; Get-CimInstance Win32_Process | Where-Object {{ $_.Name -eq 'powershell.exe' -and $_.CommandLine -like '*UpNDownPrintBridge.ps1*' }} | ForEach-Object {{ Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }}"""; Flags: runhidden waituntilterminated
