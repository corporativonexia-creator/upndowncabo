(function(){
  'use strict';
  if (window.__UPDOWN_POS_AUTOPRINT_V1__) return;
  window.__UPDOWN_POS_AUTOPRINT_V1__ = true;

  var pending = null;
  var printWindow = null;

  function text(el){ return el ? (el.textContent || '').trim() : ''; }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function captureSale(){
    var items = Array.prototype.map.call(document.querySelectorAll('.pos-cart-item'), function(row){
      var name = text(row.querySelector('.pos-cart-top strong'));
      var qty = text(row.querySelector('.pos-qty-controls span')) || '1';
      var amount = text(row.querySelector('.pos-line-total'));
      return {name:name, qty:qty, amount:amount};
    });
    var total = text(document.querySelector('.pos-total-row strong'));
    var method = text(document.querySelector('.pos-payment-tabs button.active')) || 'Pago';
    var refInput = document.querySelector('.pos-checkout .pos-field input:not([inputmode="decimal"])');
    var reference = refInput ? String(refInput.value || '').trim() : '';
    var stats = document.querySelectorAll('.pos-stats .pos-stat strong');
    return {
      items: items,
      total: total,
      method: method,
      reference: reference,
      employee: stats[0] ? text(stats[0]) : '',
      terminal: stats[1] ? text(stats[1]) : 'Caja principal',
      startedAt: Date.now()
    };
  }

  function copyHtml(label, saleNo, data){
    var products = data.items.map(function(i){
      return '<div class="item"><div><b>'+esc(i.name)+'</b><br><span>'+esc(i.qty)+' pieza(s)</span></div><b>'+esc(i.amount)+'</b></div>';
    }).join('');
    return '<section class="ticket">'+
      '<div class="brand">UP AND DOWN</div><div class="sub">PUNTO DE VENTA · LOS CABOS</div>'+
      '<div class="copy">'+esc(label)+'</div><hr>'+
      '<h2>TICKET · VENTA #'+esc(saleNo)+'</h2>'+
      '<div class="pair"><span>Fecha</span><b>'+esc(new Date().toLocaleString('es-MX'))+'</b></div>'+
      '<div class="pair"><span>Estado</span><b>COMPLETADA</b></div>'+
      (data.employee?'<div class="pair"><span>Cajero</span><b>'+esc(data.employee)+'</b></div>':'')+
      '<div class="pair"><span>Terminal</span><b>'+esc(data.terminal)+'</b></div><hr>'+
      '<h3>PRODUCTOS</h3>'+products+'<hr>'+
      '<div class="total"><span>TOTAL</span><b>'+esc(data.total)+'</b></div><hr>'+
      '<h3>PAGO</h3><div class="pair"><span>'+esc(data.method)+'</span><b>'+esc(data.total)+'</b></div>'+
      (data.reference?'<div class="pair"><span>Referencia</span><b>'+esc(data.reference)+'</b></div>':'')+
      (label==='COPIA COMERCIO' && data.method.toLowerCase().indexOf('terminal')>=0?'<div class="note">ENGRAPAR AQUÍ EL VOUCHER DE LA TERMINAL BANCARIA</div>':'')+
      '<hr><div class="thanks">Gracias por tu compra.<br>Conserva este comprobante para cualquier aclaración.</div></section>';
  }

  function renderAndPrint(saleNo){
    if (!pending || !printWindow || printWindow.closed) return;
    var html='<!doctype html><html><head><meta charset="utf-8"><title>Venta '+esc(saleNo)+'</title><style>'+ 
      '@page{size:80mm auto;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,sans-serif;color:#111}.ticket{width:80mm;padding:6mm 5mm 8mm;page-break-after:always}.ticket:last-child{page-break-after:auto}.brand{text-align:center;font-family:Georgia,serif;font-size:19px;font-weight:800;letter-spacing:.04em}.sub{text-align:center;font-size:8px;font-weight:700;margin-top:2mm}.copy{text-align:center;margin:4mm 0 2mm;font-size:11px;font-weight:900;border:1px solid #111;padding:2mm}hr{border:0;border-top:1px dashed #777;margin:3mm 0}h2{font-size:12px;margin:0 0 3mm}h3{font-size:10px;margin:0 0 2mm}.pair,.item,.total{display:flex;justify-content:space-between;gap:4mm;align-items:flex-start;margin:1.5mm 0;font-size:9px}.pair b,.item>b,.total b{text-align:right}.item>div{max-width:50mm}.item span{font-size:8px}.total{font-size:15px;font-weight:900}.note{margin-top:4mm;padding:3mm;border:1px dashed #111;text-align:center;font-size:9px;font-weight:900}.thanks{text-align:center;font-size:8px;line-height:1.45}@media print{body{width:80mm}}'+
      '</style></head><body>'+copyHtml('COPIA CLIENTE',saleNo,pending)+copyHtml('COPIA COMERCIO',saleNo,pending)+
      '<script>window.onload=function(){setTimeout(function(){window.print();},250)}<\/script></body></html>';
    printWindow.document.open(); printWindow.document.write(html); printWindow.document.close();
    pending=null;
  }

  document.addEventListener('click', function(e){
    var btn=e.target && e.target.closest ? e.target.closest('button') : null;
    if(!btn) return;
    var label=text(btn);
    if(label.indexOf('COBRAR ')===0){
      pending=captureSale();
      try{ printWindow=window.open('','updown-pos-sale-print','width=520,height=760'); }catch(_){ printWindow=null; }
      if(printWindow){ printWindow.document.write('<!doctype html><title>Preparando ticket…</title><body style="font-family:Arial;padding:24px">Procesando venta…</body>'); }
    }
  }, true);

  var observer=new MutationObserver(function(){
    if(!pending) return;
    var msg=document.querySelector('.pos-message');
    var value=text(msg);
    var m=value.match(/Venta\s+#(\d+)\s+cobrada/i);
    if(m){ renderAndPrint(m[1]); }
    if(/SALE_ERROR|error/i.test(value) && Date.now()-pending.startedAt<120000){
      if(printWindow && !printWindow.closed) printWindow.close();
      pending=null;
    }
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
})();
