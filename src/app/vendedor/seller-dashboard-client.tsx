"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Seller = {
  id: string;
  code: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  commission_rate?: number | null;
  is_active: boolean;
};

type Activity = {
  id: string;
  event_type?: string | null;
  title?: string | null;
  details?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  created_by_email?: string | null;
  created_at?: string | null;
  actor_role?: string | null;
  target_role?: string | null;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
};

type Commission = {
  id: string;
  order_id?: string | null;
  seller_code?: string | null;
  currency?: string | null;
  order_total?: number | null;
  commission_rate?: number | null;
  commission_amount?: number | null;
  status?: string | null;
  created_at?: string | null;
  approved_at?: string | null;
  paid_at?: string | null;
  orders?: any;
};

const labels: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  paid: "Pagada",
  cancelled: "Cancelada",
};

const STORE_PHONE = "526241710903";

function money(value: unknown, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: String(currency || "MXN").toUpperCase(),
  }).format(Number(value || 0));
}

function dateTime(value?: string | null) {
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

function orderObject(value: any) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function itemArray(value: any) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizePhone(value?: string | null) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) digits = `52${digits}`;
  return digits;
}

function noteActivities(order: any): Activity[] {
  return itemArray(order?.order_activity_log)
    .filter((x: Activity) => x?.event_type === "note")
    .sort(
      (a: Activity, b: Activity) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime(),
    );
}

function allActivities(order: any): Activity[] {
  return itemArray(order?.order_activity_log).sort(
    (a: Activity, b: Activity) =>
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime(),
  );
}

function activityLabel(activity: Activity) {
  if (activity.event_type === "note") {
    if (activity.actor_role === "seller") return "Nota del vendedor";
    if (activity.actor_role === "admin") return "Nota administrativa";
  }
  if (activity.event_type === "shipping_update") return "ActualizaciÃ³n de envÃ­o";
  if (activity.event_type === "status_change") return "Cambio de estado";
  if (activity.event_type === "payment_status_change")
    return "Cambio de pago";
  return activity.title || "ActualizaciÃ³n";
}

export default function SellerDashboardClient({
  seller,
  commissions,
  loadError,
}: {
  seller: Seller;
  commissions: Commission[];
  loadError?: string;
}) {
  const db = useMemo(() => createClient(), []);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [noteText, setNoteText] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState("");
  const router = useRouter();

  useEffect(() => {
    const orderIds = new Set(
      commissions
        .map((item) =>
          String(orderObject(item.orders)?.id || item.order_id || "")
        )
        .filter(Boolean)
    );

    const channel = db
      .channel(`seller-order-activity-${seller.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_activity_log",
        },
        (payload) => {
          const row = (payload.new || payload.old || {}) as {
            order_id?: string;
          };

          if (!row.order_id) return;
          if (!orderIds.has(String(row.order_id))) return;

          router.refresh();
        }
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [db, seller.id, commissions, router]);

  const metrics = useMemo(() => {
    const active = commissions.filter((item) => item.status !== "cancelled");
    return {
      count: active.length,
      sold: active.reduce(
        (sum, item) => sum + Number(item.order_total || 0),
        0,
      ),
      pending: commissions
        .filter((item) => item.status === "pending")
        .reduce(
          (sum, item) => sum + Number(item.commission_amount || 0),
          0,
        ),
      approved: commissions
        .filter((item) => item.status === "approved")
        .reduce(
          (sum, item) => sum + Number(item.commission_amount || 0),
          0,
        ),
      paid: commissions
        .filter((item) => item.status === "paid")
        .reduce(
          (sum, item) => sum + Number(item.commission_amount || 0),
          0,
        ),
    };
  }, [commissions]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();

    return commissions.filter((item) => {
      const order = orderObject(item.orders);
      const products = itemArray(order?.order_items)
        .map((product) => String(product?.product_name || ""))
        .join(" ");
      const haystack = [
        String(order?.order_number || ""),
        `pedido ${String(order?.order_number || "")}`,
        order?.customer_name,
        order?.customer_email,
        order?.customer_phone,
        products,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (filter === "all" || item.status === filter) &&
        (!q || haystack.includes(q))
      );
    });
  }, [commissions, search, filter]);

  const refPath = `/?ref=${encodeURIComponent(seller.code)}`;

  async function copyReferral() {
    const text = `${window.location.origin}${refPath}`;
    try {
      await navigator.clipboard.writeText(text);
      alert("Enlace copiado.");
    } catch {
      window.prompt("Copia tu enlace:", text);
    }
  }

  function contactCustomer(order: any) {
    const phone = normalizePhone(order?.customer_phone);
    if (!phone) {
      alert("Este pedido no tiene telÃ©fono de cliente registrado.");
      return;
    }

    const number = String(order?.order_number || "").padStart(5, "0");
    const message = [
      `Hola ${order?.customer_name || ""}`.trim() + " ðŸ‘‹",
      "",
      `Soy ${seller.name} de UP AND DOWN Â· Cabo Golf Shop.`,
      `Te contacto para dar seguimiento a tu pedido #${number}.`,
    ].join("\n");

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function contactStore(order: any) {
    const number = String(order?.order_number || "").padStart(5, "0");
    const message = [
      "Hola UP AND DOWN ðŸ‘‹",
      `Soy ${seller.name} (${seller.code}).`,
      `Necesito apoyo con el pedido #${number}.`,
    ].join("\n");

    window.open(
      `https://wa.me/${STORE_PHONE}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function addSellerNote(order: any) {
    const orderId = String(order?.id || "");
    const details = String(noteText[orderId] || "").trim();

    if (!orderId || !details) {
      alert("Escribe una nota antes de guardarla.");
      return;
    }

    const key = `note:${orderId}`;
    setBusyKey(key);

    try {
      const { error } = await db.from("order_activity_log").insert({
        order_id: orderId,
        event_type: "note",
        title: "Nota del vendedor",
        details,
      });

      if (error) throw error;

      setNoteText((current) => ({ ...current, [orderId]: "" }));
      window.location.reload();
    } catch (error: any) {
      alert(error?.message || "No fue posible guardar la nota.");
      setBusyKey("");
    }
  }

  async function acknowledge(activityId: string) {
    const key = `ack:${activityId}`;
    setBusyKey(key);

    try {
      const { error } = await db.rpc("acknowledge_order_note", {
        p_activity_id: activityId,
      });

      if (error) throw error;
      window.location.reload();
    } catch (error: any) {
      alert(error?.message || "No fue posible marcar la nota como enterada.");
      setBusyKey("");
    }
  }

  return (
    <main className="h63-seller">
      <style>{`
        .h63-seller{min-height:100vh;padding:0 18px 56px;background:#F8F6F2;color:#17201D;font-family:Inter,Arial,sans-serif}
        .h63-shell{width:min(1080px,100%);margin:auto}
        .h63-top{min-height:86px;display:flex;align-items:center;justify-content:space-between;gap:14px;border-bottom:1px solid rgba(20,62,53,.14)}
        .h63-brand strong{display:block;color:#143E35;font-family:"Cormorant Garamond",serif;font-size:30px;letter-spacing:.06em;line-height:.9}
        .h63-brand span{display:block;margin-top:7px;color:#2F6F5B;font-size:9px;font-weight:800;letter-spacing:.22em;text-transform:uppercase}
        .h63-btn{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:10px 15px;border-radius:999px;border:1px solid #143E35;background:#fff;color:#143E35;font-size:11px;font-weight:850;text-decoration:none;cursor:pointer}
        .h63-btn.primary{background:#143E35;color:#fff;border-color:#143E35}
        .h63-btn.whatsapp{background:#1FAF5A;color:#fff;border-color:#1FAF5A}
        .h63-btn:disabled{opacity:.55;cursor:not-allowed}
        .h63-head{display:flex;justify-content:space-between;gap:18px;align-items:end;padding:34px 0 22px}
        .h63-eyebrow{color:#C8A86B;font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
        .h63-head h1{margin:7px 0 5px;color:#143E35;font-family:"Cormorant Garamond",serif;font-size:58px;line-height:.92}
        .h63-muted{color:#68736F;font-size:12px;line-height:1.5}
        .h63-profile{display:grid;grid-template-columns:1fr auto;gap:20px;align-items:center;padding:24px;border:1px solid rgba(20,62,53,.14);border-radius:22px;background:#fff;box-shadow:0 18px 55px rgba(20,62,53,.08)}
        .h63-profile h2{margin:0;color:#143E35;font-family:"Cormorant Garamond",serif;font-size:38px}
        .h63-code{display:inline-block;margin-top:8px;padding:6px 9px;border-radius:999px;background:#EEF6F2;color:#143E35;font-size:11px;font-weight:900}
        .h63-rate{text-align:right;color:#143E35}.h63-rate strong{display:block;font-size:42px;line-height:1}.h63-rate span{display:block;margin-top:4px;color:#68736F;font-size:9px;text-transform:uppercase}
        .h63-ref{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;margin:18px 0 22px;padding:12px;border:1px solid rgba(20,62,53,.14);border-radius:18px;background:#fff}
        .h63-ref-link{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#143E35;font-size:12px;font-weight:750}
        .h63-metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:22px}
        .h63-metric{padding:17px;border:1px solid rgba(20,62,53,.14);border-radius:17px;background:#fff}.h63-metric span{display:block;color:#68736F;font-size:9px;font-weight:800;text-transform:uppercase}.h63-metric strong{display:block;margin-top:7px;color:#143E35;font-size:21px}
        .h63-panel{border:1px solid rgba(20,62,53,.14);border-radius:22px;background:#fff;overflow:hidden}
        .h63-panel-head{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:19px 20px;border-bottom:1px solid rgba(20,62,53,.14)}.h63-panel-head h2{margin:0;color:#143E35;font-family:"Cormorant Garamond",serif;font-size:30px}
        .h63-toolbar{display:grid;grid-template-columns:1fr 220px;gap:10px;padding:14px;border-bottom:1px solid rgba(20,62,53,.14)}
        .h63-toolbar input,.h63-toolbar select,.h63-note-box textarea{width:100%;min-height:44px;padding:10px 12px;border:1px solid rgba(20,62,53,.14);border-radius:12px;background:#fff;color:#17201D;font:inherit;box-sizing:border-box}
        .h63-sales{padding:14px;display:grid;gap:12px}
        .h63-sale{position:relative;padding:17px;border:1px solid rgba(20,62,53,.14);border-radius:17px;background:#fff}
        .h63-note-light{position:absolute;top:14px;right:14px;width:12px;height:12px;border-radius:50%;background:#c8cfcc;box-shadow:0 0 0 4px rgba(104,115,111,.10)}
        .h63-note-light.unread{background:#D7372F;box-shadow:0 0 0 4px rgba(215,55,47,.12)}
        .h63-sale-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding-right:25px}.h63-sale-head h3{margin:0;color:#143E35;font-size:16px}.h63-meta{margin-top:5px;color:#68736F;font-size:11px}
        .h63-badge{display:inline-flex;padding:6px 9px;border-radius:999px;background:#EEF6F2;color:#143E35;font-size:10px;font-weight:850}.h63-badge.pending{background:#FFF8DF;color:#765510}.h63-badge.cancelled{background:#FFF1EF;color:#9D2C24}
        .h63-sale-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:14px}.h63-sale-grid div{padding:11px;border-radius:11px;background:#F8F6F2}.h63-sale-grid span{display:block;color:#68736F;font-size:9px}.h63-sale-grid strong{display:block;margin-top:4px;color:#143E35;font-size:12px}
        .h63-products{margin-top:12px;padding-top:12px;border-top:1px solid rgba(20,62,53,.12);display:grid;gap:6px}.h63-product{display:flex;justify-content:space-between;gap:12px;font-size:11px}
        .h63-contact{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
        .h63-log{margin-top:16px;padding:14px;border-radius:14px;background:#FFFCF3;border:1px solid #E8D9B5}
        .h63-log-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.h63-log-head strong{color:#143E35;font-size:12px}.h63-log-head span{color:#68736F;font-size:9px}
        .h63-activity{padding:10px 0;border-top:1px solid rgba(20,62,53,.10)}.h63-activity:first-of-type{border-top:0}
        .h63-activity-title{display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:#143E35;font-size:11px;font-weight:850}.h63-activity-meta{margin-top:4px;color:#68736F;font-size:9px}.h63-activity-details{margin-top:5px;color:#34423d;font-size:11px;line-height:1.5;white-space:pre-wrap}
        .h63-new{display:inline-flex;padding:3px 6px;border-radius:999px;background:#D7372F;color:#fff;font-size:8px;font-weight:900;text-transform:uppercase}
        .h63-read{display:inline-flex;padding:3px 6px;border-radius:999px;background:#eef1f0;color:#68736F;font-size:8px;font-weight:900;text-transform:uppercase}
        .h63-note-box{margin-top:12px;display:grid;gap:8px}.h63-note-box textarea{min-height:72px;resize:vertical}
        .h63-empty{padding:28px;text-align:center;color:#68736F;font-size:12px}.h63-error{margin-bottom:14px;padding:12px 14px;border-radius:13px;background:#FFF1EF;color:#9D2C24;font-size:12px}
        @media(max-width:900px){.h63-metrics{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:680px){.h63-seller{padding:0 12px 42px}.h63-head{align-items:flex-start;flex-direction:column}.h63-head h1{font-size:48px}.h63-profile{grid-template-columns:1fr}.h63-rate{text-align:left}.h63-ref{grid-template-columns:1fr}.h63-toolbar{grid-template-columns:1fr}.h63-sale-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:480px){.h63-metrics{grid-template-columns:1fr}.h63-sale-grid{grid-template-columns:1fr}}
      `}</style>

      <div className="h63-shell">
        <header className="h63-top">
          <div className="h63-brand">
            <strong>UP AND DOWN</strong>
            <span>Portal del vendedor</span>
          </div>
          <a className="h63-btn" href="/">Tienda</a>
        </header>

        <section className="h63-head">
          <div>
            <div className="h63-eyebrow">Panel personal</div>
            <h1>Mis comisiones</h1>
            <div className="h63-muted">{seller.email || "Vendedor activo"}</div>
          </div>
          <button className="h63-btn" type="button" onClick={() => window.location.reload()}>
            Actualizar
          </button>
        </section>

        <section className="h63-profile">
          <div>
            <h2>{seller.name}</h2>
            <span className="h63-code">{seller.code}</span>
          </div>
          <div className="h63-rate">
            <strong>{Number(seller.commission_rate || 0)}%</strong>
            <span>comisiÃ³n por venta</span>
          </div>
        </section>

        <section className="h63-ref">
          <div className="h63-ref-link">
            {typeof window !== "undefined"
              ? `${window.location.origin}${refPath}`
              : refPath}
          </div>
          <button className="h63-btn primary" type="button" onClick={copyReferral}>
            Copiar mi enlace
          </button>
          <a className="h63-btn" href={refPath}>Abrir tienda</a>
        </section>

        {loadError && (
          <div className="h63-error">No fue posible cargar las ventas: {loadError}</div>
        )}

        <section className="h63-metrics">
          <article className="h63-metric"><span>Ventas</span><strong>{metrics.count}</strong></article>
          <article className="h63-metric"><span>Total vendido</span><strong>{money(metrics.sold)}</strong></article>
          <article className="h63-metric"><span>Pendiente</span><strong>{money(metrics.pending)}</strong></article>
          <article className="h63-metric"><span>Aprobada</span><strong>{money(metrics.approved)}</strong></article>
          <article className="h63-metric"><span>Pagada</span><strong>{money(metrics.paid)}</strong></article>
        </section>

        <section className="h63-panel">
          <div className="h63-panel-head">
            <h2>Ventas atribuidas</h2>
            <span className="h63-muted">{visible.length} venta{visible.length === 1 ? "" : "s"}</span>
          </div>

          <div className="h63-toolbar">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por pedido, cliente o productoâ€¦"
            />
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="approved">Aprobada</option>
              <option value="paid">Pagada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </div>

          <div className="h63-sales">
            {!visible.length ? (
              <div className="h63-empty">No hay ventas con esos filtros.</div>
            ) : (
              visible.map((item) => {
                const order = orderObject(item.orders);
                const products = itemArray(order?.order_items);
                const activities = allActivities(order);
                const notes = noteActivities(order);
                const unreadAdmin = notes.filter(
                  (note) =>
                    note.target_role === "seller" && !note.acknowledged_at,
                );
                const hasNotes = notes.length > 0;
                const orderNumber = String(order?.order_number || "").padStart(5, "0");
                const status = String(item.status || "pending");
                const orderId = String(order?.id || item.order_id || "");

                return (
                  <article className="h63-sale" key={item.id}>
                    {hasNotes && (
                      <span
                        className={`h63-note-light ${unreadAdmin.length ? "unread" : ""}`}
                        title={
                          unreadAdmin.length
                            ? `${unreadAdmin.length} nota(s) nueva(s)`
                            : "Notas revisadas"
                        }
                      />
                    )}

                    <div className="h63-sale-head">
                      <div>
                        <h3>Pedido #{orderNumber}</h3>
                        <div className="h63-meta">
                          {dateTime(item.created_at)}
                          {order?.customer_name ? ` Â· ${order.customer_name}` : ""}
                        </div>
                      </div>
                      <span className={`h63-badge ${status}`}>
                        {labels[status] || status}
                      </span>
                    </div>

                    <div className="h63-sale-grid">
                      <div><span>Total vendido</span><strong>{money(item.order_total, item.currency || "MXN")}</strong></div>
                      <div><span>Porcentaje</span><strong>{Number(item.commission_rate || 0)}%</strong></div>
                      <div><span>Mi comisiÃ³n</span><strong>{money(item.commission_amount, item.currency || "MXN")}</strong></div>
                      <div><span>Estado</span><strong>{labels[status] || status}</strong></div>
                    </div>

                    <div className="h63-products">
                      {products.length ? products.map((product: any, index: number) => (
                        <div className="h63-product" key={`${item.id}-${index}`}>
                          <span>{product?.product_name || "Producto"} Ã— {Number(product?.quantity || 0)}</span>
                          <strong>{money(product?.line_total, item.currency || "MXN")}</strong>
                        </div>
                      )) : <div className="h63-muted">Sin productos registrados.</div>}
                    </div>

                    <div className="h63-contact">
                      <button className="h63-btn whatsapp" type="button" onClick={() => contactCustomer(order)}>
                        WhatsApp cliente
                      </button>
                      <button className="h63-btn" type="button" onClick={() => contactStore(order)}>
                        Contactar tienda
                      </button>
                    </div>

                    <section className="h63-log">
                      <div className="h63-log-head">
                        <strong>BitÃ¡cora del pedido</strong>
                        <span>{activities.length} evento{activities.length === 1 ? "" : "s"}</span>
                      </div>

                      {!activities.length ? (
                        <div className="h63-muted">TodavÃ­a no hay actualizaciones.</div>
                      ) : (
                        activities.map((activity) => {
                          const pendingForSeller =
                            activity.event_type === "note" &&
                            activity.target_role === "seller" &&
                            !activity.acknowledged_at;

                          return (
                            <div className="h63-activity" key={activity.id}>
                              <div className="h63-activity-title">
                                {activityLabel(activity)}
                                {pendingForSeller ? (
                                  <span className="h63-new">Nueva</span>
                                ) : activity.event_type === "note" &&
                                  activity.acknowledged_at ? (
                                  <span className="h63-read">Enterado</span>
                                ) : null}
                              </div>
                              <div className="h63-activity-meta">
                                {dateTime(activity.created_at)} Â· {activity.created_by_email || "Sistema"}
                              </div>
                              {activity.details && (
                                <div className="h63-activity-details">{activity.details}</div>
                              )}
                              {pendingForSeller && (
                                <button
                                  className="h63-btn primary"
                                  style={{ marginTop: 8, minHeight: 34 }}
                                  type="button"
                                  disabled={busyKey === `ack:${activity.id}`}
                                  onClick={() => acknowledge(activity.id)}
                                >
                                  {busyKey === `ack:${activity.id}` ? "Marcandoâ€¦" : "Enterado"}
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}

                      <div className="h63-note-box">
                        <textarea
                          value={noteText[orderId] || ""}
                          onChange={(event) =>
                            setNoteText((current) => ({
                              ...current,
                              [orderId]: event.target.value,
                            }))
                          }
                          placeholder="Escribe una nota para el administradorâ€¦"
                        />
                        <button
                          className="h63-btn primary"
                          type="button"
                          disabled={busyKey === `note:${orderId}`}
                          onClick={() => addSellerNote(order)}
                        >
                          {busyKey === `note:${orderId}`
                            ? "Guardandoâ€¦"
                            : "Agregar nota del vendedor"}
                        </button>
                      </div>
                    </section>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          <a className="h63-btn" href="/login?next=/vendedor">Cambiar de cuenta</a>
          <a className="h63-btn" href="/">Volver a la tienda</a>
        </div>
      </div>
    </main>
  );
}

