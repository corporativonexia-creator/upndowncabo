# Up & Down POS - Local ESC/POS Print Bridge
# Windows PowerShell 5.1+
param([string]$PrinterName='POS-80C',[int]$Port=18181,[switch]$TestReceipt,[switch]$TestDrawer,[switch]$TestReception)
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
$ESC=27;$GS=29;$INIT=B @($ESC,64);$LEFT=B @($ESC,97,0);$CENTER=B @($ESC,97,1);$BOLDON=B @($ESC,69,1);$BOLDOFF=B @($ESC,69,0);$CUT=B @($GS,86,0);$DRAWER=B @($ESC,112,0,50,100)
$enc=[Text.Encoding]::GetEncoding(850)
$AllowedOrigins=@('https://upndowncabo.vercel.app','https://upndowncabo.com','https://www.upndowncabo.com')
$LogoGzipBase64='H4sIACgsv2oC/+3XsY7jNhAA0KFpiAaiNV2yMCx/gkoXhu1P4V2AS5e4dBDjzCDtFSlT3L+EXZp8QIoUBNJeoUMaFYadGVLSWbJ3V2wCHCAu1rtavZVIajgaAjzXTheIaqdrGemvsd5G+iLSl5H+EumvJtK7SF9E+jLSX2O9jfQu0kfMaPD9h1z5ItK7SG8jvYn0kfNzifTnSN8/Qk9nEDEBdLJ0j/7xc4xLb4Mf/OAHP/jBf2WeFTFeVFVSX1+XMT29vFZ1wzHm8niDfn5b+0svz3xfst6VTBYqPNbTs7rikf0qN9EUYP12L6emXmN9OsRvytOsR22V3ZSPokfp3Lrk9tVaUrSEeLV2bu8w2WvFKu+cz155BLIz4/zlEbO7y738jOXdA8peHPF96X77jKf3gV8+KrmrG7DLfSjYF8JPXnrt7psbdM/Kx9GVVVMkuwPPHkcvr1dzd2KzZ4K32vTcdTZ9af3H7KqyyF0Pi9ylPjsVQxva0Ib2P7erESW+W8IB5twDZAUeF1V29i8NA9t/L5fMScuuJ+BFk50dVZHC1SmN+ZcC5X75z/koLXdwWZCSv/jXAcPPBTALAjb+/0sUMIcShD2suMHz8wX1Qvxc1HWt9Mf0A9seCvpYA3frlQA8ms/9eRP6i5/CeC9s8Ae6Pd7Trffoy/r65tB46z2v/JpOS/SbfUKDa3mBnzha8swF74eDnSs2Gt/Y79s+IV90PDfUx2JB/gRpy6/wu/QeiuBl5cupxZH+YFo+xd4mx44X3h8k+e9s7ffe45+STfD74AVhvMVBWLz5t21Pg0my4A/V9U3wa2EUwBtXez88RV6aWy8aT9d/U1T+Dz/dK5y4RDz0c2GxC7qsfIjP7e/oub3zzMAi+GPdn6pYIO9a4618JqxGv+l4AwkrHs2PFA6HqBctr/FnAuWtlxRQ5CVeBrRMpzfeen/0Xgc/pcijRzz97P2HlsdzCay9dx3/8bOhDvx541nwC+9t4x0dir9/JM8/yS+eGzyXQObjs/JzWnQY+fyvn8izs6TZqjxFcQLSrxdTe4y8KS2lE00InIXhHS9smMV6PR7on1ix9f7IHfZO+rMi3JtT/0L5e6Cw3sCK/MbnmzUr39/4ktYqerfy/kLLOKO5Ym7h88faV66ZXx2Z5RfY0nrPQn5jvhoWPpk5rCD5GbuG0wHblt+hDwMKZacPRku+fLbuHNrQvtrGPoJ5MrgQxk7iuniHOSTX0mUGPgkFPBdFsp+motlNj8bMpnbvQOUqn8BbSJa5nu2VhXdcwVhNVmOVjEez2ifkd3oP+WymUswCCeQ6z9G/Zb/CZKLUJEV/s7njOt3ZHPDLe0Fe0fUxwyiYpV0/0k+WfE7+iCll65ZKGfgeglfjZMzdzfVd6oKfkAfnPeDQ7QM/hkSnuvGYynPfH3yBeq+8/9KfBNI8Xepl1Z/Kzyo/ARxuq//JOFWpzncwo/lcahjjfOLcBo/nVDpJ0tGk2UV/UGq+w+GlOl0+OZxPneNv6N9Sss+nMzHjv/FDcwM9VzNKXSPM0d8Yjdk8340oLRv/GmEGqxw30hEhs48MsXX9y39GyvjFoCAAAA=='
$QRGzipBase64='H4sIAGcwv2oC/+2WO46EMBBEa0RA6CP4JszFLIE0FxtuwhEcOkD0Vpv5aJkJViuKiA4s+xF0d6k/AKed9gfrzSwDdkeKvM5amoBLbqZ2CXNcn1Iabcz91N7DEFvLR9AUcbXDaD/ZwtsB1PWtMXyoLqC1duje095UlIA+PjGQL82xO3XPuTF0rJ3aIVLKjBc0Vjr0U0EY1LR4kVLaIZYuzFqa1rTL89BStjv9G64U2cZXRamoAeHGCUP3zHjQ0oR2tJvXjrHx3/qK6Cqtd2FdD2IKSuujzG18dYuIPgJB57kvENPnjl2H2nbz7k3rrGa7c2B7DElM6x4y26iupXTP4/23oqW++moVianri1gunvFv1QV03bEgwMfm3Z+edtq/7AeBR9ocIA8AAA=='
function AddBytes($b,[byte[]]$x){$b.AddRange($x)}
function AddText($b,[string]$t){AddBytes $b ($enc.GetBytes($t))}
function Line([string]$c='-'){($c*42)+"`n"}
function Money($n){'$'+([double]$n).ToString('N2',[Globalization.CultureInfo]::GetCultureInfo('es-MX'))}
function Pair([string]$label,[double]$amount){$v=Money $amount;$spaces=[Math]::Max(1,42-$label.Length-$v.Length);return $label+(' '*$spaces)+$v+"`n"}
function PayLabel($m){switch($m){'cash'{'Efectivo'}'card_terminal'{'Terminal'}'transfer'{'Transferencia'}default{'Otro'}}}
function Inflate([string]$s){$raw=[Convert]::FromBase64String($s);$i=New-Object IO.MemoryStream(,$raw);$g=New-Object IO.Compression.GZipStream($i,[IO.Compression.CompressionMode]::Decompress);$o=New-Object IO.MemoryStream;$g.CopyTo($o);$g.Dispose();$i.Dispose();$r=$o.ToArray();$o.Dispose();return $r}
$LogoRaster=Inflate $LogoGzipBase64;$QRRaster=Inflate $QRGzipBase64
function AddRaster($b,[byte[]]$r,[int]$wBytes,[int]$h){AddBytes $b $CENTER;AddBytes $b (B @($GS,118,48,0,($wBytes-band 255),(($wBytes-shr 8)-band 255),($h-band 255),(($h-shr 8)-band 255)));AddBytes $b $r;AddBytes $b (B @(10,10))}
function AddLogo($b){AddRaster $b $LogoRaster 48 174}
function AddQR($b){AddRaster $b $QRRaster 22 176}
function IntWords([int64]$n){
 if($n -eq 0){return 'CERO'}
 if($n -lt 0){return 'MENOS '+(IntWords (-$n))}
 $u=@('','UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISEIS','DIECISIETE','DIECIOCHO','DIECINUEVE','VEINTE','VEINTIUNO','VEINTIDOS','VEINTITRES','VEINTICUATRO','VEINTICINCO','VEINTISEIS','VEINTISIETE','VEINTIOCHO','VEINTINUEVE')
 if($n -lt 30){return $u[$n]}
 $t=@{30='TREINTA';40='CUARENTA';50='CINCUENTA';60='SESENTA';70='SETENTA';80='OCHENTA';90='NOVENTA'}
 if($n -lt 100){$d=[int]([Math]::Floor($n/10)*10);$r=$n%10;return $t[$d]+$(if($r){' Y '+(IntWords $r)}else{''})}
 if($n -eq 100){return 'CIEN'}
 if($n -lt 200){return 'CIENTO '+(IntWords ($n-100))}
 $h=@{2='DOSCIENTOS';3='TRESCIENTOS';4='CUATROCIENTOS';5='QUINIENTOS';6='SEISCIENTOS';7='SETECIENTOS';8='OCHOCIENTOS';9='NOVECIENTOS'}
 if($n -lt 1000){$d=[int][Math]::Floor($n/100);$r=$n%100;return $h[$d]+$(if($r){' '+(IntWords $r)}else{''})}
 if($n -lt 1000000){$q=[int64][Math]::Floor($n/1000);$r=$n%1000;$p=$(if($q -eq 1){'MIL'}else{(IntWords $q)+' MIL'});return $p+$(if($r){' '+(IntWords $r)}else{''})}
 if($n -lt 1000000000000){$q=[int64][Math]::Floor($n/1000000);$r=$n%1000000;$p=$(if($q -eq 1){'UN MILLON'}else{(IntWords $q)+' MILLONES'});return $p+$(if($r){' '+(IntWords $r)}else{''})}
 return [string]$n
}
function AmountWords([double]$n){$whole=[int64][Math]::Floor($n);$cents=[int][Math]::Round(($n-$whole)*100);if($cents -eq 100){$whole++;$cents=0};return (IntWords $whole)+' PESOS '+$cents.ToString('00')+'/100 M.N.'}
function BuildBody($sale,$access,[string]$copy){
 $b=New-Object 'System.Collections.Generic.List[byte]';AddBytes $b $INIT;AddLogo $b
 AddText $b "PLAZA ALBA - LOCAL 206`nEL TEZAL`nCABO SAN LUCAS, B.C.S.`nC.P. 23454`nupndowncabo.com`n";AddText $b (Line '=')
 if($sale.is_test){AddBytes $b $CENTER;AddBytes $b $BOLDON;AddText $b "PRUEBA POS 2.2 - NO ES VENTA`n";AddBytes $b $BOLDOFF;AddBytes $b $LEFT};AddBytes $b $BOLDON;AddText $b ($(if($sale.is_test){"SIMULACION #"}else{"VENTA #"})+$sale.sale_number+"`nCOPIA "+$copy+"`n");AddBytes $b $BOLDOFF;AddBytes $b $LEFT;AddText $b (Line '-');AddText $b ("Fecha: "+([datetime]$sale.created_at).ToLocalTime().ToString('dd/MM/yyyy HH:mm')+"`n")
 if($access){AddText $b ("Cajero: #"+$access.employee_number+" "+$access.full_name+"`nTerminal: "+$access.terminal_name+"`n")};AddText $b (Line '-')
 $items=@($sale.items);$groups=$items|Group-Object {if($_.category_name){[string]$_.category_name}else{'OTROS'}}
 foreach($g in $groups){AddBytes $b $BOLDON;AddText $b (([string]$g.Name).ToUpper()+"`n");AddBytes $b $BOLDOFF;AddText $b "CANT ARTICULO                    IMPORTE`n";foreach($i in @($g.Group)){$qty=[int]$i.quantity;$amt=Money $i.line_total;$prefix=([string]$qty)+'  ';$name=[string]$i.product_name;$max=42-$prefix.Length-$amt.Length-1;if($max -lt 8){$max=8};if($name.Length -gt $max){$name=$name.Substring(0,$max)};$spaces=' '*[Math]::Max(1,42-$prefix.Length-$name.Length-$amt.Length);AddText $b ($prefix+$name+$spaces+$amt+"`n");if($qty -gt 1){AddText $b ("   "+(Money $i.unit_price)+" c/u`n")};if($i.sku){AddText $b ("   SKU: "+$i.sku+"`n")};if([double]$i.discount_amount -gt 0){$mode=[string]$i.promotion_mode;$label=switch($mode){'percent'{'% DESCUENTO'} 'amount'{'$ DESCUENTO'} 'final'{'$ PRECIO FINAL'} default{'PROMOCION'}};AddText $b ("   PRECIO ORIGINAL: "+(Money $i.unit_price)+" c/u`n");AddText $b ("   "+$label+": "+[string]$i.promotion_value+"`n");AddText $b ("   AHORRO: -"+(Money $i.discount_amount)+"`n")}};AddText $b (Line '-')}
 $total=[double]$sale.total;$net=[Math]::Round($total/1.16,2);$vat=[Math]::Round($total-$net,2);$articleCount=0;foreach($i in $items){$articleCount += [int]$i.quantity}
 # Separate automatic/manual line savings from general cart savings.
 # Both are reconciled with the persisted sale ledger, never live promotion settings.
 [decimal]$itemSavings=0;foreach($i in $items){$itemSavings += [decimal]$i.discount_amount}
 [decimal]$totalSavings=[decimal]$sale.discount_amount
 [decimal]$generalSavings=$totalSavings-$itemSavings
 if($itemSavings -lt 0 -or $generalSavings -lt 0 -or
    [Math]::Round(([decimal]$sale.subtotal-$totalSavings),2) -ne [Math]::Round([decimal]$sale.total,2)){
   throw 'RECEIPT_LEDGER_MISMATCH'
 }
 if($totalSavings -gt 0){
   AddText $b (Pair 'PRECIO ORIGINAL' ([double]$sale.subtotal))
   if($itemSavings -gt 0){AddText $b (Pair 'AHORRO ARTICULOS' (-[double]$itemSavings))}
   if($generalSavings -gt 0){AddText $b (Pair 'DESCUENTO GENERAL' (-[double]$generalSavings))}
   AddText $b (Pair 'AHORRO TOTAL' (-[double]$totalSavings))
 };AddText $b (Pair 'SUBTOTAL SIN IVA' $net);AddText $b (Pair 'IVA 16%' $vat);AddBytes $b $BOLDON;AddText $b (Pair 'TOTAL' $total);AddBytes $b $BOLDOFF;AddText $b (Line '=')
 AddBytes $b $CENTER;AddText $b ((AmountWords $total)+"`n");AddBytes $b $LEFT;AddText $b ("ARTICULOS COMPRADOS: "+$articleCount+"`n");AddText $b (Line '-')
 if(@($sale.payments).Count -gt 1){AddBytes $b $BOLDON;AddText $b "PAGO MIXTO`n";AddBytes $b $BOLDOFF}
 if($sale.is_test){AddBytes $b $BOLDON;AddText $b "SIN COBRO - SIN CAMBIO DE STOCK`n";AddBytes $b $BOLDOFF}else{foreach($p in @($sale.payments)){AddText $b (Pair (PayLabel $p.method) ([double]$p.amount));if($p.reference){AddText $b ("Ref: "+$p.reference+"`n")}}}
 if($copy -eq 'COMERCIO' -and (@($sale.payments)|Where-Object {$_.method -eq 'card_terminal'})){AddText $b "`nENGRAPAR VOUCHER DE TERMINAL A ESTA COPIA`n"}
 AddBytes $b $CENTER;if($sale.is_test){AddText $b "`n*** PRUEBA TECNICA ***`nNO ES UN COMPROBANTE DE VENTA`nNO EXISTE TRANSACCION REAL`n"}else{AddText $b "`nESCANEA Y VISITANOS`n";AddQR $b;AddText $b "upndowncabo.com`nGRACIAS POR TU COMPRA`nConserva este comprobante para`ncualquier aclaracion.`n"};AddBytes $b (B @(10,10,10,10,10));return $b.ToArray()
}
# Reception receipts never open the cash drawer.
# Raster Code39 uses the SAME GS v 0 mechanism as the already working shop logo.
# Some POS-80C clones print GS k 69 but stop consuming commands after that barcode.
# Drawing the bars in software avoids the printer's GS k parser altogether.
function AddReceptionBarcode($b,[string]$folio){
 if($folio -notmatch '^SR-[0-9]{6,12}$'){throw 'FOLIO_BARCODE_INVALIDO'}
 $patterns=@{
  '*'='nwnnwnwnn';'-'='nwnnnnwnw'
  'S'='nnwnnnwwn';'R'='wnnnnnwwn'
  '0'='nnnwwnwnn';'1'='wnnwnnnnw';'2'='nnwwnnnnw'
  '3'='wnwwnnnnn';'4'='nnnwwnnnw';'5'='wnnwwnnnn'
  '6'='nnwwwnnnn';'7'='nnnwnnwnw';'8'='wnnwnnwnn';'9'='nnwwnnwnn'
 }
 $text='*'+$folio+'*'
 $narrow=2;$wide=5
 if($text.Length -gt 11){$narrow=1;$wide=3}
 $gap=$narrow;$total=0
 foreach($c in $text.ToCharArray()){
  $p=$patterns[[string]$c]
  if(-not $p){throw 'CODE39_CARACTER_NO_ADMITIDO'}
  for($i=0;$i -lt 9;$i++){$total+=$(if($p[$i] -eq 'w'){$wide}else{$narrow})}
  $total+=$gap
 }
 $total-=$gap
 if($total -gt 344){throw 'CODE39_SIN_ESPACIO'}
 $widthBytes=48;$height=104
 $raster=New-Object byte[] ($widthBytes*$height)
 $x=[int][Math]::Floor((384-$total)/2)
 foreach($c in $text.ToCharArray()){
  $p=$patterns[[string]$c]
  for($i=0;$i -lt 9;$i++){
   $barWidth=$(if($p[$i] -eq 'w'){$wide}else{$narrow})
   if(($i % 2) -eq 0){
    for($dx=0;$dx -lt $barWidth;$dx++){
     $pixel=$x+$dx
     $mask=[byte](128 -shr ($pixel % 8))
     for($y=0;$y -lt $height;$y++){
      $index=$y*$widthBytes+[int][Math]::Floor($pixel/8)
      $raster[$index]=[byte]($raster[$index] -bor $mask)
     }
    }
   }
   $x+=$barWidth
  }
  $x+=$gap
 }
 AddRaster $b $raster $widthBytes $height
}
function ReceptionLine($b,[string]$value){AddText $b ($value+[char]10)}
function ReceptionText($b,[string]$label,[string]$value){
 $clean=[regex]::Replace([string]$value,'[\x00-\x1F\x7F]',' ')
 $clean=$clean.Trim();if(-not $clean){$clean='No especificado'}
 AddBytes $b $BOLDON;ReceptionLine $b ($label+':');AddBytes $b $BOLDOFF
 for($offset=0;$offset -lt $clean.Length;$offset+=42){
  ReceptionLine $b $clean.Substring($offset,[Math]::Min(42,$clean.Length-$offset))
 }
}
function BuildReceptionBody($r,[string]$copy){
 $number=[int64]$r.receipt_number
 if($number -le 0 -or -not $r.customer_name -or -not $r.equipment_description -or -not $r.service_name -or -not $r.work_description){throw 'RECEPCION_INVALIDA'}
 $folio='SR-'+$number.ToString('000000')
 $b=New-Object 'System.Collections.Generic.List[byte]'
 AddBytes $b $INIT;AddLogo $b
 AddBytes $b $CENTER;AddBytes $b $BOLDON
 if($r.is_test){ReceptionLine $b '*** PRUEBA NO REGISTRADA ***'}
 ReceptionLine $b 'RECEPCION DE EQUIPO'
 ReceptionLine $b ('FOLIO '+$folio)
 AddReceptionBarcode $b $folio
 ReceptionLine $b ('COPIA '+$copy)
 AddBytes $b $BOLDOFF;AddBytes $b $LEFT
 ReceptionLine $b (Line '=')
 ReceptionLine $b ('Fecha: '+([datetime]$r.received_at).ToLocalTime().ToString('dd/MM/yyyy HH:mm'))
 ReceptionText $b 'CLIENTE' $r.customer_name
 ReceptionText $b 'TELEFONO' $r.customer_phone
 ReceptionText $b 'EQUIPO' $r.equipment_description
 ReceptionText $b 'SERVICIO' $r.service_name
 ReceptionText $b 'TRABAJO SOLICITADO' $r.work_description
 ReceptionText $b 'CONDICION AL RECIBIR' $r.condition_notes
 ReceptionText $b 'ACCESORIOS' $r.accessories
 ReceptionText $b 'RECIBIO' ('#'+$r.employee_number+' '+$r.employee_name)
 ReceptionText $b 'TERMINAL' $r.terminal_name
 ReceptionLine $b (Line '-')
 AddBytes $b $CENTER;AddBytes $b $BOLDON
 if($copy -eq 'CLIENTE'){ReceptionLine $b 'CONSERVE ESTE COMPROBANTE'}else{ReceptionLine $b 'MANTENER JUNTO AL EQUIPO'}
 AddBytes $b $BOLDOFF
 ReceptionLine $b 'NO ES COMPROBANTE DE PAGO'
 if($r.is_test){ReceptionLine $b 'FOLIO FICTICIO - NO ENTREGAR'}
 if($copy -eq 'CLIENTE'){ReceptionLine $b 'Firma de quien entrega: ______________'}
 # Feed past the blade before cutting; do not open the cash drawer.
 # Keep feed and cut inside the same RAW spool job as all ticket data.
 AddBytes $b $LEFT;AddBytes $b (B @(10,10,10,10))
 AddBytes $b (B @($ESC,100,8))
 AddBytes $b $CUT
 return $b.ToArray()
}
function SendRaw([byte[]]$x,[string]$n){if(-not [RawPrinterHelper]::SendBytes($PrinterName,$x,$n)){throw "No se pudo enviar RAW a $PrinterName"}}
function Reply($c,[int]$s,[string]$body){$c.Response.StatusCode=$s;$c.Response.ContentType='application/json; charset=utf-8';$o=$c.Request.Headers['Origin'];if($o -and ($AllowedOrigins -contains $o)){$c.Response.Headers.Add('Access-Control-Allow-Origin',$o);$c.Response.Headers.Add('Vary','Origin')};$c.Response.Headers.Add('Access-Control-Allow-Headers','Content-Type');$c.Response.Headers.Add('Access-Control-Allow-Methods','GET,POST,OPTIONS');$c.Response.Headers.Add('Access-Control-Allow-Private-Network','true');$x=[Text.Encoding]::UTF8.GetBytes($body);$c.Response.ContentLength64=$x.Length;$c.Response.OutputStream.Write($x,0,$x.Length);$c.Response.Close()}
# Diagnostic is a local-only CLI mode. No HTTP listener, Supabase calls, POS session,
# inventory changes or sale creation. The cash drawer is opt-in with -TestDrawer.
if($TestDrawer -and -not $TestReceipt){throw '-TestDrawer requires -TestReceipt'}
if($TestReceipt -and $TestReception){throw 'Select only one test mode'}
if($TestReceipt){
 $testSale=[pscustomobject]@{
   is_test=$true; sale_number='QA22-NO-VENTA'; created_at=[datetime]::Now
   subtotal=5000.00; discount_amount=1020.00; total=3980.00
   items=@(
     [pscustomobject]@{category_name='PELOTAS';product_name='Pelotas de golf';sku='QA-PELOTA';quantity=1;unit_price=200.00;line_subtotal=200.00;line_total=180.00;discount_amount=20.00;promotion_mode='percent';promotion_value=10},
     [pscustomobject]@{category_name='WEDGES';product_name='Wedge simulacion';sku='QA-WEDGE';quantity=1;unit_price=4800.00;line_subtotal=4800.00;line_total=4800.00;discount_amount=0.00;promotion_mode='none';promotion_value=0}
   )
   payments=@()
 }
 Write-Host 'TEST POS 2.2 (NO VENTA): 2 copias, 2 cortes; cajon solo con -TestDrawer.' -ForegroundColor Cyan
 SendRaw (BuildBody $testSale $null 'CLIENTE') 'QA POS22 CLIENTE';Start-Sleep -Milliseconds 700
 SendRaw $CUT 'QA POS22 CORTE CLIENTE';Start-Sleep -Milliseconds 700
 SendRaw (BuildBody $testSale $null 'COMERCIO') 'QA POS22 COMERCIO';Start-Sleep -Milliseconds 700
 SendRaw $CUT 'QA POS22 CORTE COMERCIO'
 if($TestDrawer){Start-Sleep -Milliseconds 700;SendRaw $DRAWER 'QA POS22 CAJON'}
 Write-Host 'Prueba enviada a la cola de impresion: verificar las 2 copias y ambos cortes.' -ForegroundColor Green
 exit 0
}
# Offline thermal reception proof: no website, Supabase, folio creation or cash drawer.
if($TestReception){
 $testReception=[pscustomobject]@{
   receipt_number=999999;is_test=$true;received_at=[datetime]::Now
   customer_name='CLIENTE FICTICIO';customer_phone='0000000000'
   equipment_description='Driver de prueba';service_name='Revision general'
   work_description='Verificar texto, folio, lectura y corte'
   condition_notes='Equipo ficticio sin ingreso real';accessories='Ninguno'
   employee_number='000';employee_name='PRUEBA';terminal_name='POS-80C'
 }
 Write-Host 'PRUEBA RECEPCION: dos copias con corte, sin cobro ni inventario ni cajon.' -ForegroundColor Cyan
 SendRaw (BuildReceptionBody $testReception 'CLIENTE') 'QA RECEPCION CLIENTE'
 Start-Sleep -Milliseconds 900
 SendRaw (BuildReceptionBody $testReception 'TALLER') 'QA RECEPCION TALLER'
 Write-Host 'Revisar ambas copias completas, cortes y teclado del lector; folio ficticio SR-999999.' -ForegroundColor Green
 exit 0
}
$l=New-Object Net.HttpListener;$l.Prefixes.Add("http://127.0.0.1:$Port/");$l.Start();Write-Host "Up & Down Print Bridge listo -> $PrinterName @ 127.0.0.1:$Port" -ForegroundColor Green
while($l.IsListening){$c=$l.GetContext();try{if($c.Request.HttpMethod -eq 'OPTIONS'){Reply $c 204 '{}';continue};if($c.Request.Url.AbsolutePath -eq '/health'){Reply $c 200 ('{"ok":true,"printer":"'+$PrinterName+'","receipt":"retail-v8","reception":"service-reception-v1","cut_fix":"raster-code39-feed-v2"}');continue};if($c.Request.HttpMethod -ne 'POST' -or ($c.Request.Url.AbsolutePath -ne '/print-sale' -and $c.Request.Url.AbsolutePath -ne '/print-reception')){Reply $c 404 '{"ok":false}';continue};$r=New-Object IO.StreamReader($c.Request.InputStream,$c.Request.ContentEncoding);$p=$r.ReadToEnd()|ConvertFrom-Json;if($c.Request.Url.AbsolutePath -eq '/print-reception'){$reception=$p.reception;if(-not $reception){throw 'RECEPCION_REQUERIDA'};SendRaw (BuildReceptionBody $reception 'CLIENTE') ("Recepcion "+$reception.receipt_number+" CLIENTE");Start-Sleep -Milliseconds 900;SendRaw (BuildReceptionBody $reception 'TALLER') ("Recepcion "+$reception.receipt_number+" TALLER");Reply $c 200 '{"ok":true,"copies":2,"cuts":2,"drawer":0,"receipt":"service-reception-v1"}';continue};$sale=$p.sale;$access=$p.access;if(-not $sale -or -not $sale.sale_number){throw 'Venta invalida'};SendRaw (BuildBody $sale $access 'CLIENTE') ("Venta "+$sale.sale_number+" CLIENTE");Start-Sleep -Milliseconds 700;SendRaw $CUT ("Venta "+$sale.sale_number+" CORTE CLIENTE");Start-Sleep -Milliseconds 1200;SendRaw (BuildBody $sale $access 'COMERCIO') ("Venta "+$sale.sale_number+" COMERCIO");Start-Sleep -Milliseconds 700;SendRaw $CUT ("Venta "+$sale.sale_number+" CORTE COMERCIO");Start-Sleep -Milliseconds 700;SendRaw $DRAWER ("Venta "+$sale.sale_number+" CAJON");Reply $c 200 '{"ok":true,"copies":2,"cuts":2,"drawer":1,"receipt":"retail-v8"}'}catch{Reply $c 500 ('{"ok":false,"error":'+(ConvertTo-Json $_.Exception.Message -Compress)+'}')}}
