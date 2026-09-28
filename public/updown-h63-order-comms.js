(() => {
  "use strict";

  if (window.__UPDOWN_H63_ORDER_COMMS__) return;
  window.__UPDOWN_H63_ORDER_COMMS__ = true;

  const STORE_PHONE = "526241710903";
  let db = null;
  let cache = [];
  let observer = null;
  let refreshTimer = null;

  function esc(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function dateTime(value) {
    if (!value) return "â€”";
    try {
      return new Intl.DateTimeFormat("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    } catch {
      return String(value);
    }
  }

  function normalizePhone(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.length === 10) digits = `52${digits}`;
    return digits;
  }

  function injectStyles() {
    if (document.getElementById("h63AdminStyles")) return;

    const style = document.createElement("style");
    style.id = "h63AdminStyles";
    style.textContent = `
      #updown-admin .u-order-card{position:relative}
      #updown-admin .h63-admin-light{
        position:absolute;top:15px;right:15px;width:13px;height:13px;border-radius:50%;
        background:#c8cfcc;box-shadow:0 0 0 4px rgba(104,115,111,.10);z-index:6
      }
      #updown-admin .h63-admin-light.unread{
        background:#D7372F;box-shadow:0 0 0 4px rgba(215,55,47,.14)
      }
      #updown-admin .h63-admin-comms{
        margin:14px 17px 17px;padding:15px;border:1px solid rgba(20,62,53,.14);
        border-radius:16px;background:#f8faf9
      }
      #updown-admin .h63-admin-comms-head{
        display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px
      }
      #updown-admin .h63-admin-comms-head strong{color:#143E35;font-size:12px}
      #updown-admin .h63-admin-comms-head span{color:#68736F;font-size:9px}
      #updown-admin .h63-admin-note{
        padding:9px 0;border-top:1px solid rgba(20,62,53,.10)
      }
      #updown-admin .h63-admin-note:first-of-type{border-top:0}
      #updown-admin .h63-admin-note-title{
        display:flex;gap:7px;align-items:center;flex-wrap:wrap;color:#143E35;font-size:10px;font-weight:850
      }
      #updown-admin .h63-admin-note-meta{margin-top:3px;color:#68736F;font-size:8px}
      #updown-admin .h63-admin-note-body{margin-top:5px;color:#34423d;font-size:10px;line-height:1.5;white-space:pre-wrap}
      #updown-admin .h63-admin-new{
        display:inline-flex;padding:3px 6px;border-radius:999px;background:#D7372F;color:#fff;
        font-size:7px;font-weight:900;text-transform:uppercase
      }
      #updown-admin .h63-admin-read{
        display:inline-flex;padding:3px 6px;border-radius:999px;background:#eef1f0;color:#68736F;
        font-size:7px;font-weight:900;text-transform:uppercase
      }
      #updown-admin .h63-admin-actions{
        display:flex;gap:7px;flex-wrap:wrap;margin-top:10px
      }
      #updown-admin .h63-admin-btn{
        display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:7px 10px;
        border-radius:999px;border:1px solid #143E35;background:#fff;color:#143E35;
        font-size:9px;font-weight:850;text-decoration:none;cursor:pointer
      }
      #updown-admin .h63-admin-btn.primary{background:#143E35;color:#fff}
      #updown-admin .h63-admin-btn.whatsapp{background:#1FAF5A;color:#fff;border-color:#1FAF5A}
      #updown-admin .h63-admin-btn:disabled{opacity:.55;cursor:not-allowed}
    `;
    document.head.appendChild(style);
  }

  async function getDb() {
    if (db) return db;
    if (!window.supabase?.createClient) throw new Error("Supabase no disponible.");
    db = window.supabase.createClient();
    return db;
  }

  async function loadOrders() {
    try {
      const client = await getDb();
      const { data, error } = await client
        .from("orders")
        .select(`
          id,
          order_number,
          customer_name,
          customer_phone,
          affiliate_seller_id,
          seller_ref,
          order_activity_log(
            id,
            event_type,
            title,
            details,
            created_by_email,
            created_at,
            actor_role,
            target_role,
            acknowledged_at,
            acknowledged_by
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      cache = data || [];
      decorateCards();
    } catch (error) {
      console.error("H63 admin communication load", error);
    }
  }

  function extractOrderNumber(card) {
    const text = card.innerText || "";
    const match = text.match(/Pedido\s*#?\s*0*(\d+)/i);
    if (match) return String(Number(match[1]));
    const fallback = text.match(/#\s*0*(\d+)/);
    return fallback ? String(Number(fallback[1])) : "";
  }

  function notesFor(order) {
    return [...(order?.order_activity_log || [])]
      .filter((x) => x?.event_type === "note")
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  function contactCustomer(order) {
    const phone = normalizePhone(order.customer_phone);
    if (!phone) {
      alert("Este pedido no tiene telÃ©fono del cliente.");
      return;
    }

    const number = String(order.order_number || "").padStart(5, "0");
    const message = [
      `Hola ${order.customer_name || ""}`.trim() + " ðŸ‘‹",
      "",
      "Te contactamos de UP AND DOWN Â· Cabo Golf Shop.",
      `Es respecto a tu pedido #${number}.`,
    ].join("\n");

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function acknowledge(noteId, button) {
    button.disabled = true;
    button.textContent = "Marcandoâ€¦";

    try {
      const client = await getDb();
      const { error } = await client.rpc("acknowledge_order_note", {
        p_activity_id: noteId,
      });
      if (error) throw error;
      await loadOrders();
    } catch (error) {
      alert(error?.message || "No fue posible marcar la nota.");
      button.disabled = false;
      button.textContent = "Enterado";
    }
  }

  function decorateCards() {
    const root = document.getElementById("udOrdersList");
    if (!root) return;

    root.querySelectorAll(".u-order-card").forEach((card) => {
      const number = extractOrderNumber(card);
      if (!number) return;

      const order = cache.find(
        (row) => String(Number(row.order_number || 0)) === number,
      );
      if (!order) return;

      const notes = notesFor(order);
      const sellerNotes = notes.filter((note) => note.actor_role === "seller");
      const unreadSeller = sellerNotes.filter(
        (note) => note.target_role === "admin" && !note.acknowledged_at,
      );

      card.querySelector(".h63-admin-light")?.remove();
      card.querySelector(".h63-admin-comms")?.remove();

      if (notes.length) {
        const light = document.createElement("span");
        light.className = `h63-admin-light ${unreadSeller.length ? "unread" : ""}`;
        light.title = unreadSeller.length
          ? `${unreadSeller.length} nota(s) nueva(s) del vendedor`
          : "Notas revisadas";
        card.appendChild(light);
      }

      if (!order.affiliate_seller_id) return;

      const panel = document.createElement("section");
      panel.className = "h63-admin-comms";

      panel.innerHTML = `
        <div class="h63-admin-comms-head">
          <strong>ComunicaciÃ³n Admin â†” Vendedor</strong>
          <span>${notes.length} nota${notes.length === 1 ? "" : "s"}</span>
        </div>

        ${
          notes.length
            ? notes
                .map((note) => {
                  const pending =
                    note.target_role === "admin" && !note.acknowledged_at;
                  const label =
                    note.actor_role === "seller"
                      ? "Nota del vendedor"
                      : "Nota administrativa";

                  return `
                    <div class="h63-admin-note">
                      <div class="h63-admin-note-title">
                        ${esc(label)}
                        ${
                          pending
                            ? '<span class="h63-admin-new">Nueva</span>'
                            : note.acknowledged_at
                              ? '<span class="h63-admin-read">Enterado</span>'
                              : ""
                        }
                      </div>
                      <div class="h63-admin-note-meta">
                        ${esc(dateTime(note.created_at))} Â· ${esc(note.created_by_email || "Sistema")}
                      </div>
                      ${note.details ? `<div class="h63-admin-note-body">${esc(note.details)}</div>` : ""}
                      ${
                        pending
                          ? `<button class="h63-admin-btn primary" type="button" data-h63-ack="${esc(note.id)}" style="margin-top:7px">Enterado</button>`
                          : ""
                      }
                    </div>
                  `;
                })
                .join("")
            : '<div class="u-muted">AÃºn no hay notas entre administrador y vendedor.</div>'
        }

        <div class="h63-admin-actions">
          <button class="h63-admin-btn whatsapp" type="button" data-h63-client>
            WhatsApp cliente
          </button>
        </div>
      `;

      const notesBox = card.querySelector(".u-order-notes-box");
      if (notesBox) notesBox.insertAdjacentElement("afterend", panel);
      else card.appendChild(panel);

      panel.querySelector("[data-h63-client]")?.addEventListener("click", () => {
        contactCustomer(order);
      });

      panel.querySelectorAll("[data-h63-ack]").forEach((button) => {
        button.addEventListener("click", () => {
          acknowledge(button.getAttribute("data-h63-ack"), button);
        });
      });
    });
  }

  function observe() {
    const root = document.getElementById("udOrdersList");
    if (!root || observer) return;

    observer = new MutationObserver(() => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => decorateCards(), 80);
    });

    observer.observe(root, { childList: true, subtree: true });
  }

  async function subscribeRealtime() {
    try {
      const client = await getDb();

      client
        .channel("admin-order-activity-h63b")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "order_activity_log",
          },
          () => {
            clearTimeout(refreshTimer);

            refreshTimer = setTimeout(() => {
              loadOrders();
            }, 120);
          }
        )
        .subscribe();

    } catch (error) {
      console.error("H63B admin realtime", error);
    }
  }

  async function boot() {
    injectStyles();

    for (let i = 0; i < 40; i += 1) {
      if (document.getElementById("udOrdersList") && window.supabase?.createClient) break;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    observe();
    await loadOrders();
    await subscribeRealtime();

    setInterval(loadOrders, 30000);
  }

  boot().catch((error) => console.error("H63 admin boot", error));
})();

