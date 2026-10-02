(() => {
  "use strict";
  if (window.__UPDOWN_POS_PIN_V2__) return;
  window.__UPDOWN_POS_PIN_V2__ = true;

  document.addEventListener("click", async (event) => {
    const button = event.target?.closest?.("#udv2PosGeneratePin");
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const result = document.getElementById("udv2PosPinResult");
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Generando…";

    try {
      if (!window.supabase?.createClient) throw new Error("Supabase no disponible.");
      const db = window.supabase.createClient(
        window.__UPDOWN_SUPABASE_URL__,
        window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__
      );
      const { data, error } = await db.rpc("admin_pos_generate_shift_pin");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const pin = String(row?.pin || "");
      if (!/^\d{6}$/.test(pin)) throw new Error("El servidor no devolvió un PIN válido.");

      if (result) {
        result.innerHTML = `<div class="udv2-pos-code"><span>PIN de apertura de hoy</span><strong>${pin}</strong></div>`;
      }
      console.info("POS shift PIN generated atomically by server.");
    } catch (error) {
      console.error("POS PIN generation", error);
      if (result) {
        result.innerHTML = `<div class="udv2-pos-note" style="color:#9D2C24">No se pudo generar el PIN: ${String(error?.message || error || "Error")}</div>`;
      }
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }, true);
})();
