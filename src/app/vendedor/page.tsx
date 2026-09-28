import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import SellerDashboardClient from "./seller-dashboard-client";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function getServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(url, publishable, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {}
      },
    },
  });
}

function AccessCard({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "linear-gradient(180deg,#143E35 0 185px,#F8F6F2 185px)",
        fontFamily: "Inter,Arial,sans-serif",
      }}
    >
      <section
        style={{
          width: "min(560px,100%)",
          padding: 32,
          border: "1px solid rgba(20,62,53,.12)",
          borderRadius: 26,
          background: "#fff",
          boxShadow: "0 24px 70px rgba(20,62,53,.14)",
        }}
      >
        <div
          style={{
            color: "#2F6F5B",
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: ".12em",
            textTransform: "uppercase",
          }}
        >
          Portal del vendedor
        </div>
        <h1
          style={{
            margin: "8px 0 10px",
            color: "#143E35",
            fontFamily: "Cormorant Garamond,serif",
            fontSize: 44,
            lineHeight: 0.95,
          }}
        >
          {title}
        </h1>
        <p style={{ color: "#68736F", lineHeight: 1.6, fontSize: 13 }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
          <a
            href="/login?next=/vendedor"
            style={{
              padding: "11px 16px",
              borderRadius: 999,
              background: "#143E35",
              color: "#fff",
              fontWeight: 800,
              textDecoration: "none",
              fontSize: 12,
            }}
          >
            Cambiar de cuenta
          </a>
          <a
            href="/"
            style={{
              padding: "11px 16px",
              borderRadius: 999,
              border: "1px solid #143E35",
              color: "#143E35",
              fontWeight: 800,
              textDecoration: "none",
              fontSize: 12,
            }}
          >
            Volver a la tienda
          </a>
        </div>
      </section>
    </main>
  );
}

export default async function SellerPage() {
  const supabase = await getServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/vendedor");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role,is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    profile?.role !== "seller" ||
    profile?.is_active !== true
  ) {
    return (
      <AccessCard
        title="Este usuario no es vendedor"
        message="La sesión actual pertenece a otro tipo de usuario. Puedes cambiar de cuenta para entrar con tu acceso de vendedor."
      />
    );
  }

  const { data: seller, error: sellerError } = await supabase
    .from("affiliate_sellers")
    .select("id,code,name,email,phone,commission_rate,is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (sellerError || !seller || seller.is_active !== true) {
    return (
      <AccessCard
        title="Acceso de vendedor no disponible"
        message="Tu cuenta existe, pero el vendedor afiliado asociado no está activo."
      />
    );
  }

  const { data: commissions, error: commissionsError } = await supabase
    .from("affiliate_commissions")
    .select(`
      id,
      order_id,
      seller_code,
      currency,
      order_total,
      commission_rate,
      commission_amount,
      status,
      created_at,
      approved_at,
      paid_at,
      orders(
        id,
        order_number,
        created_at,
        customer_name,
        customer_email,
        customer_phone,
        payment_status,
        order_status,
        shipping_carrier,
        tracking_number,
        order_items(
          product_name,
          quantity,
          line_total
        ),
        order_activity_log(
          id,
          event_type,
          title,
          details,
          old_value,
          new_value,
          created_by_email,
          created_at,
          actor_role,
          target_role,
          acknowledged_at,
          acknowledged_by
        )
      )
    `)
    .eq("seller_id", seller.id)
    .order("created_at", { ascending: false });

  return (
    <SellerDashboardClient
      seller={seller}
      commissions={commissions || []}
      loadError={commissionsError?.message || ""}
    />
  );
}
