# Up & Down POS - Local ESC/POS Print Bridge
# Windows PowerShell 5.1+
# Listens only on localhost:18181 and writes RAW ESC/POS to the Windows printer.

param(
  [string]$PrinterName = "POS-80C",
  [int]$Port = 18181
)

$ErrorActionPreference = "Stop"

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", SetLastError=true, ExactSpelling=true)] public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  [DllImport("winspool.Drv", SetLastError=true, ExactSpelling=true)] public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", SetLastError=true, ExactSpelling=true)] public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", SetLastError=true, ExactSpelling=true)] public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", SetLastError=true, ExactSpelling=true)] public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);
  public static bool SendBytes(string printer, byte[] bytes, string docName) {
    IntPtr hPrinter;
    if (!OpenPrinter(printer, out hPrinter, IntPtr.Zero)) return false;
    var di = new DOCINFOA(); di.pDocName=docName; di.pDataType="RAW";
    bool ok=false;
    try {
      if (!StartDocPrinter(hPrinter,1,di)) return false;
      try {
        if (!StartPagePrinter(hPrinter)) return false;
        IntPtr p=Marshal.AllocCoTaskMem(bytes.Length);
        try { Marshal.Copy(bytes,0,p,bytes.Length); int written; ok=WritePrinter(hPrinter,p,bytes.Length,out written) && written==bytes.Length; }
        finally { Marshal.FreeCoTaskMem(p); EndPagePrinter(hPrinter); }
      } finally { EndDocPrinter(hPrinter); }
    } finally { ClosePrinter(hPrinter); }
    return ok;
  }
}
"@

function B([int[]]$a) { return [byte[]]$a }
$ESC = 27; $GS = 29
$INIT = B @($ESC,64)
$ALIGN_LEFT = B @($ESC,97,0)
$ALIGN_CENTER = B @($ESC,97,1)
$BOLD_ON = B @($ESC,69,1)
$BOLD_OFF = B @($ESC,69,0)
$CUT = B @($GS,86,0)
$DRAWER = B @($ESC,112,0,50,100)
$LF = B @(10)
$enc = [Text.Encoding]::GetEncoding(850)
$AllowedOrigins = @(
  'https://upndowncabo.vercel.app',
  'https://upndowncabo.com',
  'https://www.upndowncabo.com'
)

function Add-Bytes([System.Collections.Generic.List[byte]]$buf,[byte[]]$bytes){ $buf.AddRange($bytes) }
function Add-Text([System.Collections.Generic.List[byte]]$buf,[string]$text){ Add-Bytes $buf ($enc.GetBytes($text)) }
function Line([string]$char="-"){ return ($char * 42) + "`n" }
function Money($n){ return ('$' + ([double]$n).ToString('N2',[Globalization.CultureInfo]::GetCultureInfo('es-MX'))) }
function Payment-Label([string]$m){ switch($m){ 'cash'{'Efectivo'} 'card_terminal'{'Terminal'} 'transfer'{'Transferencia'} default{'Otro'} } }

function Build-Copy($sale,$access,[string]$copyType){
  $buf = New-Object 'System.Collections.Generic.List[byte]'
  Add-Bytes $buf $INIT; Add-Bytes $buf $ALIGN_CENTER; Add-Bytes $buf $BOLD_ON
  Add-Text $buf "UP AND DOWN`n"; Add-Bytes $buf $BOLD_OFF
  Add-Text $buf "PUNTO DE VENTA - LOS CABOS`n"
  Add-Text $buf ((Line '='))
  Add-Bytes $buf $BOLD_ON; Add-Text $buf ("COPIA " + $copyType + "`n"); Add-Bytes $buf $BOLD_OFF
  Add-Text $buf ("VENTA #" + $sale.sale_number + "`n")
  Add-Bytes $buf $ALIGN_LEFT
  Add-Text $buf ((Line '-'))
  Add-Text $buf ("Fecha: " + ([datetime]$sale.created_at).ToLocalTime().ToString('dd/MM/yyyy HH:mm') + "`n")
  if($access){ Add-Text $buf ("Cajero: #"+$access.employee_number+" "+$access.full_name+"`n"); Add-Text $buf ("Terminal: "+$access.terminal_name+"`n") }
  Add-Text $buf ((Line '-'))
  foreach($item in $sale.items){
    Add-Bytes $buf $BOLD_ON; Add-Text $buf ([string]$item.product_name + "`n"); Add-Bytes $buf $BOLD_OFF
    Add-Text $buf ("  "+$item.quantity+" x "+(Money $item.unit_price)+"   "+(Money $item.line_total)+"`n")
    if($item.sku){ Add-Text $buf ("  SKU: "+$item.sku+"`n") }
  }
  Add-Text $buf ((Line '-'))
  Add-Text $buf ("Subtotal: " + (Money $sale.subtotal) + "`n")
  if([double]$sale.discount_amount -gt 0){ Add-Text $buf ("Descuento: -"+(Money $sale.discount_amount)+"`n") }
  Add-Bytes $buf $BOLD_ON; Add-Text $buf ("TOTAL: " + (Money $sale.total) + "`n"); Add-Bytes $buf $BOLD_OFF
  Add-Text $buf ((Line '-'))
  foreach($p in $sale.payments){ Add-Text $buf ((Payment-Label $p.method)+": "+(Money $p.amount)+"`n"); if($p.reference){ Add-Text $buf ("Ref: "+$p.reference+"`n") } }
  if($copyType -eq 'COMERCIO' -and ($sale.payments | Where-Object {$_.method -eq 'card_terminal'})){ Add-Text $buf "`nENGRAPAR VOUCHER DE TERMINAL A ESTA COPIA`n" }
  Add-Bytes $buf $ALIGN_CENTER; Add-Text $buf "`nGracias por tu compra.`n"; Add-Text $buf "UP AND DOWN - CABO GOLF SHOP`n`n`n"
  Add-Bytes $buf $CUT
  return $buf.ToArray()
}

function Send-Raw([byte[]]$bytes,[string]$name){ if(-not [RawPrinterHelper]::SendBytes($PrinterName,$bytes,$name)){ throw "No se pudo enviar RAW a $PrinterName" } }
function Reply($ctx,[int]$status,[string]$body){
  $ctx.Response.StatusCode=$status; $ctx.Response.ContentType='application/json; charset=utf-8'
  $origin = $ctx.Request.Headers['Origin']
  if($origin -and ($AllowedOrigins -contains $origin)){
    $ctx.Response.Headers.Add('Access-Control-Allow-Origin',$origin)
    $ctx.Response.Headers.Add('Vary','Origin')
  }
  $ctx.Response.Headers.Add('Access-Control-Allow-Headers','Content-Type')
  $ctx.Response.Headers.Add('Access-Control-Allow-Methods','GET,POST,OPTIONS')
  $ctx.Response.Headers.Add('Access-Control-Allow-Private-Network','true')
  $bytes=[Text.Encoding]::UTF8.GetBytes($body); $ctx.Response.ContentLength64=$bytes.Length; $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length); $ctx.Response.Close()
}

$listener=New-Object Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Write-Host "Up & Down Print Bridge listo -> $PrinterName @ 127.0.0.1:$Port" -ForegroundColor Green
Write-Host "Orígenes autorizados: $($AllowedOrigins -join ', ')" -ForegroundColor Cyan
Write-Host "Deja esta ventana abierta mientras uses el POS." -ForegroundColor Yellow
while($listener.IsListening){
  $ctx=$listener.GetContext()
  try {
    if($ctx.Request.HttpMethod -eq 'OPTIONS'){ Reply $ctx 204 '{}'; continue }
    if($ctx.Request.Url.AbsolutePath -eq '/health'){ Reply $ctx 200 ('{"ok":true,"printer":"'+$PrinterName+'"}'); continue }
    if($ctx.Request.HttpMethod -ne 'POST' -or $ctx.Request.Url.AbsolutePath -ne '/print-sale'){ Reply $ctx 404 '{"ok":false}'; continue }
    $reader=New-Object IO.StreamReader($ctx.Request.InputStream,$ctx.Request.ContentEncoding); $payload=$reader.ReadToEnd() | ConvertFrom-Json
    $sale=$payload.sale; $access=$payload.access
    if(-not $sale -or -not $sale.sale_number){ throw 'Venta invalida' }
    Send-Raw (Build-Copy $sale $access 'CLIENTE') ("Venta "+$sale.sale_number+" CLIENTE")
    Start-Sleep -Milliseconds 350
    Send-Raw (Build-Copy $sale $access 'COMERCIO') ("Venta "+$sale.sale_number+" COMERCIO")
    Start-Sleep -Milliseconds 250
    Send-Raw $DRAWER ("Venta "+$sale.sale_number+" CAJON")
    Reply $ctx 200 '{"ok":true,"copies":2,"cuts":2,"drawer":1}'
  } catch { Reply $ctx 500 ('{"ok":false,"error":'+(ConvertTo-Json $_.Exception.Message -Compress)+'}') }
}
