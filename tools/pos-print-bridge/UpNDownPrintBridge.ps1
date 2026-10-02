# Up & Down POS - Local ESC/POS Print Bridge
# Windows PowerShell 5.1+
param([string]$PrinterName='POS-80C',[int]$Port=18181)
$ErrorActionPreference='Stop'
Add-Type @"
using System; using System.Runtime.InteropServices;
public class RawPrinterHelper {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Ansi)] public class DOCINFOA {[MarshalAs(UnmanagedType.LPStr)]public string pDocName;[MarshalAs(UnmanagedType.LPStr)]public string pOutputFile;[MarshalAs(UnmanagedType.LPStr)]public string pDataType;}
 [DllImport("winspool.Drv",EntryPoint="OpenPrinterA",SetLastError=true,CharSet=CharSet.Ansi,ExactSpelling=true)]public static extern bool OpenPrinter(string n,out IntPtr h,IntPtr p);
 [DllImport("winspool.Drv",SetLastError=true,ExactSpelling=true)]public static extern bool ClosePrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="StartDocPrinterA",SetLastError=true,CharSet=CharSet.Ansi,ExactSpelling=true)]public static extern bool StartDocPrinter(IntPtr h,int l,[In,MarshalAs(UnmanagedType.LPStruct)]DOCINFOA d);
 [DllImport("winspool.Drv",SetLastError=true,ExactSpelling=true)]public static extern bool EndDocPrinter(IntPtr h);
 [DllImport("winspool.Drv",SetLastError=true,ExactSpelling=true)]public static extern bool StartPagePrinter(IntPtr h);
 [DllImport("winspool.Drv",SetLastError=true,ExactSpelling=true)]public static extern bool EndPagePrinter(IntPtr h);
 [DllImport("winspool.Drv",SetLastError=true,ExactSpelling=true)]public static extern bool WritePrinter(IntPtr h,IntPtr p,int c,out int w);
 public static bool SendBytes(string printer,byte[] bytes,string name){IntPtr h;if(!OpenPrinter(printer,out h,IntPtr.Zero))return false;var d=new DOCINFOA();d.pDocName=name;d.pDataType="RAW";bool ok=false;try{if(!StartDocPrinter(h,1,d))return false;try{if(!StartPagePrinter(h))return false;IntPtr p=Marshal.AllocCoTaskMem(bytes.Length);try{Marshal.Copy(bytes,0,p,bytes.Length);int w;ok=WritePrinter(h,p,bytes.Length,out w)&&w==bytes.Length;}finally{Marshal.FreeCoTaskMem(p);EndPagePrinter(h);}}finally{EndDocPrinter(h);}}finally{ClosePrinter(h);}return ok;}
}
"@
function B([int[]]$a){[byte[]]$a}
$ESC=27;$GS=29;$INIT=B @($ESC,64);$LEFT=B @($ESC,97,0);$CENTER=B @($ESC,97,1);$BOLDON=B @($ESC,69,1);$BOLDOFF=B @($ESC,69,0);$CUT=B @($GS,86,0);$DRAWER=B @($ESC,112,0,50,100);$LF=B @(10)
$enc=[Text.Encoding]::GetEncoding(850)
$AllowedOrigins=@('https://upndowncabo.vercel.app','https://upndowncabo.com','https://www.upndowncabo.com')
$StoreWeb='https://upndowncabo.com/'
$LogoGzipBase64='H4sIACgsv2oC/+3XsY7jNhAA0KFpiAaiNV2yMCx/gkoXhu1P4V2AS5e4dBDjzCDtFSlT3L+EXZp8QIoUBNJeoUMaFYadGVLSWbJ3V2wCHCAu1rtavZVIajgaAjzXTheIaqdrGemvsd5G+iLSl5H+EumvJtK7SF9E+jLSX2O9jfQu0kfMaPD9h1z5ItK7SG8jvYn0kfNzifTnSN8/Qk9nEDEBdLJ0j/7xc4xLb4Mf/OAHP/jBf2WeFTFeVFVSX1+XMT29vFZ1wzHm8niDfn5b+0svz3xfst6VTBYqPNbTs7rikf0qN9EUYP12L6emXmN9OsRvytOsR22V3ZSPokfp3Lrk9tVaUrSEeLV2bu8w2WvFKu+cz155BLIz4/zlEbO7y738jOXdA8peHPF96X77jKf3gV8+KrmrG7DLfSjYF8JPXnrt7psbdM/Kx9GVVVMkuwPPHkcvr1dzd2KzZ4K32vTcdTZ9af3H7KqyyF0Pi9ylPjsVQxva0Ib2P7erESW+W8IB5twDZAUeF1V29i8NA9t/L5fMScuuJ+BFk50dVZHC1SmN+ZcC5X75z/koLXdwWZCSv/jXAcPPBTALAjb+/0sUMIcShD2suMHz8wX1Qvxc1HWt9Mf0A9seCvpYA3frlQA8ms/9eRP6i5/CeC9s8Ae6Pd7Trffoy/r65tB46z2v/JpOS/SbfUKDa3mBnzha8swF74eDnSs2Gt/Y79s+IV90PDfUx2JB/gRpy6/wu/QeiuBl5cupxZH+YFo+xd4mx44X3h8k+e9s7ffe45+STfD74AVhvMVBWLz5t21Pg0my4A/V9U3wa2EUwBtXez88RV6aWy8aT9d/U1T+Dz/dK5y4RDz0c2GxC7qsfIjP7e/oub3zzMAi+GPdn6pYIO9a4618JqxGv+l4AwkrHs2PFA6HqBctr/FnAuWtlxRQ5CVeBrRMpzfeen/0Xgc/pcijRzz97P2HlsdzCay9dx3/8bOhDvx541nwC+9t4x0dir9/JM8/yS+eGzyXQObjs/JzWnQY+fyvn8izs6TZqjxFcQLSrxdTe4y8KS2lE00InIXhHS9smMV6PR7on1ix9f7IHfZO+rMi3JtT/0L5e6Cw3sCK/MbnmzUr39/4ktYqerfy/kLLOKO5Ym7h88faV66ZXx2Z5RfY0nrPQn5jvhoWPpk5rCD5GbuG0wHblt+hDwMKZacPRku+fLbuHNrQvtrGPoJ5MrgQxk7iuniHOSTX0mUGPgkFPBdFsp+motlNj8bMpnbvQOUqn8BbSJa5nu2VhXdcwVhNVmOVjEez2ifkd3oP+WymUswCCeQ6z9G/Zb/CZKLUJEV/s7njOt3ZHPDLe0Fe0fUxwyiYpV0/0k+WfE7+iCll65ZKGfgeglfjZMzdzfVd6oKfkAfnPeDQ7QM/hkSnuvGYynPfH3yBeq+8/9KfBNI8Xepl1Z/Kzyo/ARxuq//JOFWpzncwo/lcahjjfOLcBo/nVDpJ0tGk2UV/UGq+w+GlOl0+OZxPneNv6N9Sss+nMzHjv/FDcwM9VzNKXSPM0d8Yjdk8340oLRv/GmEGqxw30hEhs48MsXX9y39GyvjFoCAAAA=='
function AddBytes($b,[byte[]]$x){$b.AddRange($x)}
function AddText($b,[string]$t){AddBytes $b ($enc.GetBytes($t))}
function Line([string]$c='-'){($c*42)+"`n"}
function Money($n){'$'+([double]$n).ToString('N2',[Globalization.CultureInfo]::GetCultureInfo('es-MX'))}
function PayLabel($m){switch($m){'cash'{'Efectivo'}'card_terminal'{'Terminal'}'transfer'{'Transferencia'}default{'Otro'}}}
function Inflate([string]$s){$raw=[Convert]::FromBase64String($s);$i=New-Object IO.MemoryStream(,$raw);$g=New-Object IO.Compression.GZipStream($i,[IO.Compression.CompressionMode]::Decompress);$o=New-Object IO.MemoryStream;$g.CopyTo($o);$g.Dispose();$i.Dispose();$r=$o.ToArray();$o.Dispose();return $r}
$LogoRaster=Inflate $LogoGzipBase64
function AddLogo($b){AddBytes $b $CENTER;$wBytes=48;$h=174;AddBytes $b (B @($GS,118,48,0,($wBytes-band 255),(($wBytes-shr 8)-band 255),($h-band 255),(($h-shr 8)-band 255)));AddBytes $b $LogoRaster;AddBytes $b $LF}
function AddQR($b,[string]$data){$q=[Text.Encoding]::UTF8.GetBytes($data);AddBytes $b (B @($GS,40,107,4,0,49,65,50,0));AddBytes $b (B @($GS,40,107,3,0,49,67,5));AddBytes $b (B @($GS,40,107,3,0,49,69,49));$l=$q.Length+3;AddBytes $b (B @($GS,40,107,($l-band 255),(($l-shr 8)-band 255),49,80,48));AddBytes $b $q;AddBytes $b (B @($GS,40,107,3,0,49,81,48));AddBytes $b $LF}
function BuildCopy($sale,$access,[string]$copy){
 $b=New-Object 'System.Collections.Generic.List[byte]';AddBytes $b $INIT;AddLogo $b
 AddText $b "PLAZA ALBA - LOCAL 206`nEL TEZAL`nCABO SAN LUCAS, B.C.S.`nC.P. 23454`nupndowncabo.com`n`n";AddQR $b $StoreWeb;AddText $b "ESCANEA Y VISITANOS`n";AddText $b (Line '=')
 AddBytes $b $BOLDON;AddText $b ("COPIA "+$copy+"`nVENTA #"+$sale.sale_number+"`n");AddBytes $b $BOLDOFF;AddBytes $b $LEFT;AddText $b (Line '-');AddText $b ("Fecha: "+([datetime]$sale.created_at).ToLocalTime().ToString('dd/MM/yyyy HH:mm')+"`n")
 if($access){AddText $b ("Cajero: #"+$access.employee_number+" "+$access.full_name+"`nTerminal: "+$access.terminal_name+"`n")};AddText $b (Line '-')
 foreach($i in $sale.items){AddBytes $b $BOLDON;AddText $b ([string]$i.product_name+"`n");AddBytes $b $BOLDOFF;AddText $b ("  "+$i.quantity+" x "+(Money $i.unit_price)+"   "+(Money $i.line_total)+"`n");if($i.sku){AddText $b ("  SKU: "+$i.sku+"`n")}}
 AddText $b (Line '-');AddText $b ("Subtotal: "+(Money $sale.subtotal)+"`n");if([double]$sale.discount_amount -gt 0){AddText $b ("Descuento: -"+(Money $sale.discount_amount)+"`n")};AddBytes $b $BOLDON;AddText $b ("TOTAL: "+(Money $sale.total)+"`n");AddBytes $b $BOLDOFF;AddText $b (Line '-')
 foreach($p in $sale.payments){AddText $b ((PayLabel $p.method)+": "+(Money $p.amount)+"`n");if($p.reference){AddText $b ("Ref: "+$p.reference+"`n")}}
 if($copy -eq 'COMERCIO' -and ($sale.payments|Where-Object {$_.method -eq 'card_terminal'})){AddText $b "`nENGRAPAR VOUCHER DE TERMINAL A ESTA COPIA`n"}
 AddBytes $b $CENTER;AddText $b "`nGRACIAS POR TU COMPRA`nConserva este comprobante para`ncualquier aclaracion.`nupndowncabo.com`n`n`n";AddBytes $b $CUT;return $b.ToArray()
}
function SendRaw([byte[]]$x,[string]$n){if(-not [RawPrinterHelper]::SendBytes($PrinterName,$x,$n)){throw "No se pudo enviar RAW a $PrinterName"}}
function Reply($c,[int]$s,[string]$body){$c.Response.StatusCode=$s;$c.Response.ContentType='application/json; charset=utf-8';$o=$c.Request.Headers['Origin'];if($o -and ($AllowedOrigins -contains $o)){$c.Response.Headers.Add('Access-Control-Allow-Origin',$o);$c.Response.Headers.Add('Vary','Origin')};$c.Response.Headers.Add('Access-Control-Allow-Headers','Content-Type');$c.Response.Headers.Add('Access-Control-Allow-Methods','GET,POST,OPTIONS');$c.Response.Headers.Add('Access-Control-Allow-Private-Network','true');$x=[Text.Encoding]::UTF8.GetBytes($body);$c.Response.ContentLength64=$x.Length;$c.Response.OutputStream.Write($x,0,$x.Length);$c.Response.Close()}
$l=New-Object Net.HttpListener;$l.Prefixes.Add("http://127.0.0.1:$Port/");$l.Start();Write-Host "Up & Down Print Bridge listo -> $PrinterName @ 127.0.0.1:$Port" -ForegroundColor Green
while($l.IsListening){$c=$l.GetContext();try{if($c.Request.HttpMethod -eq 'OPTIONS'){Reply $c 204 '{}';continue};if($c.Request.Url.AbsolutePath -eq '/health'){Reply $c 200 ('{"ok":true,"printer":"'+$PrinterName+'","receipt":"branded-logo-v2"}');continue};if($c.Request.HttpMethod -ne 'POST' -or $c.Request.Url.AbsolutePath -ne '/print-sale'){Reply $c 404 '{"ok":false}';continue};$r=New-Object IO.StreamReader($c.Request.InputStream,$c.Request.ContentEncoding);$p=$r.ReadToEnd()|ConvertFrom-Json;$sale=$p.sale;$access=$p.access;if(-not $sale -or -not $sale.sale_number){throw 'Venta invalida'};SendRaw (BuildCopy $sale $access 'CLIENTE') ("Venta "+$sale.sale_number+" CLIENTE");Start-Sleep -Milliseconds 1800;SendRaw (BuildCopy $sale $access 'COMERCIO') ("Venta "+$sale.sale_number+" COMERCIO");Start-Sleep -Milliseconds 900;SendRaw $DRAWER ("Venta "+$sale.sale_number+" CAJON");Reply $c 200 '{"ok":true,"copies":2,"cuts":2,"drawer":1,"receipt":"branded-logo-v2"}'}catch{Reply $c 500 ('{"ok":false,"error":'+(ConvertTo-Json $_.Exception.Message -Compress)+'}')}}