// ============================================================
// UP AND DOWN · CREATE STRIPE CHECKOUT SESSION · RESERVATION V1
// Supabase Edge Function: create-checkout-session
//
// HOTFIX42
// - Reserva inventario ANTES de crear Stripe Checkout.
// - Stripe Session y reserva comparten expiración (~30 min).
// - Si Stripe falla, la reserva se libera.
// - Si falla el vínculo Session <-> reserva, se expira Stripe
//   y se libera inventario.
// - El checkout público sigue controlado por storefront.
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESERVATION_TTL_MINUTES = 30;

type IncomingItem = {
  id?: unknown;
  quantity?: unknown;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  price: number | string;
  sale_price: number | string | null;
  stock: number;
  cover_image_url: string | null;
  status: string;
};

type ReservationItem = {
  id: string;
  sku?: string | null;
  name: string;
  quantity: number;
  currency: string;
  unit_price: number | string;
};

type ReservationResult = {
  ok: boolean;
  reservation_id: string;
  reservation_token: string;
  status: string;
  expires_at: string;
  items: ReservationItem[];
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getFirstKeyFromMap(environmentName: string): string | null {
  const rawValue = Deno.env.get(environmentName);

  if (!rawValue) return null;

  try {
    const keys = JSON.parse(rawValue) as Record<string, string>;
    return keys.default ?? Object.values(keys)[0] ?? null;
  } catch {
    return null;
  }
}

function getSupabaseAdminKey(): string {
  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyKey) return legacyKey;

  const currentKey = getFirstKeyFromMap("SUPABASE_SECRET_KEYS");

  if (!currentKey) {
    throw new Error("No se encontró la clave administrativa de Supabase.");
  }

  return currentKey;
}

function getAllowedPublishableKeys(): string[] {
  const keys: string[] = [];

  const legacyAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacyAnonKey) keys.push(legacyAnonKey);

  const rawCurrentKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");

  if (rawCurrentKeys) {
    try {
      const currentKeys = JSON.parse(rawCurrentKeys) as Record<string, string>;
      keys.push(...Object.values(currentKeys));
    } catch {
      // Continúa con cualquier clave disponible.
    }
  }

  return [...new Set(keys)];
}

function normalizeItems(incomingItems: IncomingItem[]): Array<{
  id: string;
  quantity: number;
}> {
  const groupedItems = new Map<string, number>();

  for (const item of incomingItems) {
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const quantity = Number(item.quantity);

    if (!id) {
      throw new Error("Uno de los productos no tiene un identificador válido.");
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new Error(
        "La cantidad de cada producto debe ser un número entero entre 1 y 20.",
      );
    }

    groupedItems.set(id, (groupedItems.get(id) ?? 0) + quantity);
  }

  const normalizedItems = [...groupedItems.entries()].map(
    ([id, quantity]) => ({ id, quantity }),
  );

  if (normalizedItems.length === 0) {
    throw new Error("El carrito está vacío.");
  }

  if (normalizedItems.length > 20) {
    throw new Error("El carrito no puede superar 20 productos diferentes.");
  }

  return normalizedItems;
}

function readableRpcError(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return "No fue posible reservar el inventario.";
}

async function expireStripeSession(
  stripeSecretKey: string,
  sessionId: string,
): Promise<void> {
  try {
    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}/expire`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("No fue posible expirar Stripe Session:", sessionId, body);
    }
  } catch (error) {
    console.error("Error expirando Stripe Session:", sessionId, error);
  }
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Método no permitido." }, 405);
  }

  let reservationToken: string | null = null;
  let stripeSessionId: string | null = null;
  let reservationReleased = false;

  try {
    // La función mantiene Verify JWT desactivado porque el storefront usa
    // una publishable key moderna que no necesariamente es JWT.
    // Aun así se valida que el apikey pertenezca al proyecto.
    const requestApiKey = request.headers.get("apikey");
    const allowedPublishableKeys = getAllowedPublishableKeys();

    if (
      !requestApiKey ||
      !allowedPublishableKeys.includes(requestApiKey)
    ) {
      return jsonResponse({ error: "Solicitud no autorizada." }, 401);
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const storeUrl = Deno.env.get("STORE_URL")?.replace(/\/+$/, "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!stripeSecretKey) {
      throw new Error("Falta configurar STRIPE_SECRET_KEY.");
    }

    if (!storeUrl) {
      throw new Error("Falta configurar STORE_URL.");
    }

    if (!supabaseUrl) {
      throw new Error("No se encontró SUPABASE_URL.");
    }

    const requestBody = await request.json().catch(() => null) as {
      items?: IncomingItem[];
      seller_ref?: string | null;
    } | null;

    if (!requestBody || !Array.isArray(requestBody.items)) {
      return jsonResponse(
        { error: "El formato del carrito no es válido." },
        400,
      );
    }

    const normalizedItems = normalizeItems(requestBody.items);
    const productIds = normalizedItems.map((item) => item.id);

    const requestedSellerRef = String(requestBody.seller_ref ?? "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");

    const supabaseAdmin = createClient(
      supabaseUrl,
      getSupabaseAdminKey(),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    let affiliateSeller: {
      id: string;
      code: string;
      name: string;
      commission_rate: number;
    } | null = null;

    if (requestedSellerRef) {
      const { data: sellerData, error: sellerError } =
        await supabaseAdmin
          .from("affiliate_sellers")
          .select("id,code,name,commission_rate,is_active")
          .eq("code", requestedSellerRef)
          .eq("is_active", true)
          .maybeSingle();

      if (sellerError) {
        console.error(
          "No fue posible validar el vendedor afiliado:",
          sellerError,
        );
      } else if (sellerData) {
        affiliateSeller = {
          id: sellerData.id,
          code: sellerData.code,
          name: sellerData.name,
          commission_rate: Number(sellerData.commission_rate ?? 0),
        };
      }
    }

    // --------------------------------------------------------
    // Catálogo previo: solo para mensajes, imágenes y moneda.
    // La reserva RPC es la autoridad FINAL de stock y precio.
    // --------------------------------------------------------
    const { data, error } = await supabaseAdmin
      .from("products")
      .select(`
        id,
        name,
        slug,
        currency,
        price,
        sale_price,
        stock,
        cover_image_url,
        status
      `)
      .in("id", productIds)
      .eq("status", "active");

    if (error) {
      throw new Error(`No fue posible consultar el catálogo: ${error.message}`);
    }

    const products = (data ?? []) as Product[];
    const productsById = new Map(
      products.map((product) => [product.id, product]),
    );

    if (products.length !== normalizedItems.length) {
      return jsonResponse(
        {
          error:
            "Uno o más productos ya no están disponibles. Actualiza tu carrito.",
          code: "PRODUCT_UNAVAILABLE",
        },
        409,
      );
    }

    // --------------------------------------------------------
    // RESERVA TRANSACCIONAL.
    // Aquí se bloquean filas FOR UPDATE y products.stock baja.
    // Desde este punto POS ya ve el stock reservado como ocupado.
    // --------------------------------------------------------
    const { data: reservationData, error: reservationError } =
      await supabaseAdmin.rpc("reserve_checkout_inventory", {
        p_items: normalizedItems,
        p_seller_ref: affiliateSeller?.code ?? null,
        p_ttl_minutes: RESERVATION_TTL_MINUTES,
      });

    if (reservationError) {
      const message = readableRpcError(reservationError);

      if (message.includes("INSUFFICIENT_STOCK")) {
        return jsonResponse(
          {
            error:
              "El inventario cambió mientras preparábamos tu pago. Actualiza tu carrito e inténtalo nuevamente.",
            code: "INSUFFICIENT_STOCK",
          },
          409,
        );
      }

      if (message.includes("PRODUCT_NOT_AVAILABLE")) {
        return jsonResponse(
          {
            error:
              "Uno o más productos ya no están disponibles. Actualiza tu carrito.",
            code: "PRODUCT_UNAVAILABLE",
          },
          409,
        );
      }

      throw new Error(message);
    }

    const reservation = reservationData as ReservationResult | null;

    if (
      !reservation?.ok ||
      !reservation.reservation_token ||
      !Array.isArray(reservation.items) ||
      reservation.items.length === 0
    ) {
      throw new Error("La reserva de inventario no devolvió datos válidos.");
    }

    reservationToken = reservation.reservation_token;

    const reservationItemsById = new Map(
      reservation.items.map((item) => [item.id, item]),
    );

    const currencies = new Set<string>();
    const checkoutItems: Array<{
      product: Product;
      quantity: number;
      unitAmount: number;
    }> = [];

    // Construimos Stripe con precio/cantidad DEVUELTOS POR LA RESERVA,
    // no con el valor leído previamente.
    for (const item of normalizedItems) {
      const product = productsById.get(item.id);
      const reserved = reservationItemsById.get(item.id);

      if (!product || !reserved) {
        throw new Error(
          "La reserva y el catálogo no coinciden. Se cancelará la operación.",
        );
      }

      const unitPrice = Number(reserved.unit_price);
      const currency = String(reserved.currency || "MXN").toLowerCase();

      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new Error(`${reserved.name} no tiene un precio válido.`);
      }

      currencies.add(currency);

      checkoutItems.push({
        product: {
          ...product,
          name: reserved.name,
          currency: reserved.currency,
        },
        quantity: Number(reserved.quantity),
        unitAmount: Math.round(unitPrice * 100),
      });
    }

    if (currencies.size !== 1) {
      throw new Error(
        "Todos los productos del carrito deben utilizar la misma moneda.",
      );
    }

    const checkoutReference = crypto.randomUUID();
    const stripeParameters = new URLSearchParams();

    function buildReturnUrl(
      checkoutStatus: "success" | "cancelled",
      includeSessionId = false,
    ): string {
      const returnUrl = new URL(storeUrl);

      returnUrl.searchParams.set("checkout", checkoutStatus);

      if (affiliateSeller?.code) {
        returnUrl.searchParams.set("ref", affiliateSeller.code);
      } else {
        returnUrl.searchParams.delete("ref");
      }

      if (includeSessionId) {
        returnUrl.searchParams.set(
          "session_id",
          "{CHECKOUT_SESSION_ID}",
        );
      } else {
        returnUrl.searchParams.delete("session_id");
      }

      return returnUrl
        .toString()
        .replace(
          "%7BCHECKOUT_SESSION_ID%7D",
          "{CHECKOUT_SESSION_ID}",
        );
    }

    stripeParameters.set("mode", "payment");

    // V1: tarjeta únicamente. Esto garantiza que
    // checkout.session.completed llegue con pago inmediato y evita
    // reservas que permanezcan pendientes por métodos asíncronos.
    stripeParameters.set("payment_method_types[0]", "card");
    stripeParameters.set(
      "success_url",
      buildReturnUrl("success", true),
    );
    stripeParameters.set(
      "cancel_url",
      buildReturnUrl("cancelled"),
    );
    stripeParameters.set("client_reference_id", checkoutReference);
    stripeParameters.set("customer_creation", "always");
    stripeParameters.set("phone_number_collection[enabled]", "true");
    stripeParameters.set("billing_address_collection", "auto");

    // Stripe Checkout exige expires_at Unix timestamp.
    // La reserva es 30 min; usamos el expires_at exacto devuelto por DB.
    const expiresAtUnix = Math.floor(
      new Date(reservation.expires_at).getTime() / 1000,
    );

    if (!Number.isFinite(expiresAtUnix)) {
      throw new Error("La reserva devolvió una expiración inválida.");
    }

    stripeParameters.set("expires_at", String(expiresAtUnix));

    stripeParameters.set("custom_fields[0][key]", "customer_name");
    stripeParameters.set(
      "custom_fields[0][label][type]",
      "custom",
    );
    stripeParameters.set(
      "custom_fields[0][label][custom]",
      "Nombre completo",
    );
    stripeParameters.set("custom_fields[0][type]", "text");
    stripeParameters.set("custom_fields[0][optional]", "false");
    stripeParameters.set(
      "custom_fields[0][text][minimum_length]",
      "2",
    );
    stripeParameters.set(
      "custom_fields[0][text][maximum_length]",
      "80",
    );

    stripeParameters.set("locale", "auto");

    stripeParameters.set("metadata[source]", "up-and-down-store");
    stripeParameters.set(
      "metadata[checkout_reference]",
      checkoutReference,
    );
    stripeParameters.set(
      "metadata[reservation_token]",
      reservation.reservation_token,
    );
    stripeParameters.set(
      "metadata[reservation_id]",
      reservation.reservation_id,
    );
    stripeParameters.set(
      "metadata[item_count]",
      String(checkoutItems.length),
    );

    if (affiliateSeller) {
      stripeParameters.set(
        "metadata[affiliate_seller_id]",
        affiliateSeller.id,
      );
      stripeParameters.set(
        "metadata[affiliate_code]",
        affiliateSeller.code,
      );
      stripeParameters.set(
        "metadata[affiliate_commission_rate]",
        String(affiliateSeller.commission_rate),
      );
      stripeParameters.set(
        "metadata[affiliate_seller_name]",
        affiliateSeller.name,
      );
    }

    checkoutItems.forEach(
      ({ product, quantity, unitAmount }, index) => {
        const prefix = `line_items[${index}]`;

        stripeParameters.set(
          `${prefix}[price_data][currency]`,
          String(product.currency || "MXN").toLowerCase(),
        );
        stripeParameters.set(
          `${prefix}[price_data][unit_amount]`,
          String(unitAmount),
        );
        stripeParameters.set(
          `${prefix}[price_data][product_data][name]`,
          product.name,
        );
        stripeParameters.set(
          `${prefix}[price_data][product_data][metadata][supabase_product_id]`,
          product.id,
        );

        if (
          product.cover_image_url &&
          product.cover_image_url.startsWith("https://")
        ) {
          stripeParameters.set(
            `${prefix}[price_data][product_data][images][0]`,
            product.cover_image_url,
          );
        }

        stripeParameters.set(
          `${prefix}[quantity]`,
          String(quantity),
        );

        stripeParameters.set(
          `metadata[item_${index}]`,
          `${product.id}:${quantity}`,
        );
      },
    );

    const stripeResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: stripeParameters,
      },
    );

    const stripeData = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error("Stripe error:", stripeData);

      // Stripe no creó sesión: devolvemos inmediatamente el stock.
      if (reservationToken) {
        const { error: releaseError } = await supabaseAdmin.rpc(
          "release_checkout_reservation",
          {
            p_reservation_token: reservationToken,
            p_reason: "stripe_session_creation_failed",
          },
        );

        if (releaseError) {
          console.error(
            "CRITICAL: no fue posible liberar reserva tras error Stripe:",
            reservationToken,
            releaseError,
          );
        } else {
          reservationReleased = true;
        }
      }

      return jsonResponse(
        {
          error:
            stripeData?.error?.message ??
            "Stripe no pudo crear la sesión de pago.",
          code: "STRIPE_ERROR",
        },
        502,
      );
    }

    if (!stripeData?.id || !stripeData?.url) {
      throw new Error("Stripe no devolvió una sesión de Checkout válida.");
    }

    stripeSessionId = String(stripeData.id);

    // --------------------------------------------------------
    // Vínculo atómico lógico entre la reserva y Stripe Session.
    // --------------------------------------------------------
    const { error: bindError } = await supabaseAdmin.rpc(
      "bind_checkout_reservation_session",
      {
        p_reservation_token: reservationToken,
        p_stripe_checkout_session_id: stripeSessionId,
      },
    );

    if (bindError) {
      console.error(
        "CRITICAL: Stripe Session creada pero no pudo ligarse a reserva:",
        stripeSessionId,
        reservationToken,
        bindError,
      );

      // Evita que el cliente pueda pagar una sesión huérfana.
      await expireStripeSession(stripeSecretKey, stripeSessionId);

      const { error: releaseError } = await supabaseAdmin.rpc(
        "release_checkout_reservation",
        {
          p_reservation_token: reservationToken,
          p_reason: "reservation_bind_failed",
        },
      );

      if (!releaseError) {
        reservationReleased = true;
      } else {
        console.error(
          "CRITICAL: tampoco fue posible liberar reserva huérfana:",
          reservationToken,
          releaseError,
        );
      }

      throw new Error(
        "No fue posible asegurar el inventario para el pago. Inténtalo nuevamente.",
      );
    }

    return jsonResponse({
      url: stripeData.url,
      session_id: stripeSessionId,
      checkout_reference: checkoutReference,
      reservation_token: reservationToken,
      reservation_expires_at: reservation.expires_at,
      affiliate: affiliateSeller
        ? {
          code: affiliateSeller.code,
          seller_name: affiliateSeller.name,
          commission_rate: affiliateSeller.commission_rate,
        }
        : null,
    });
  } catch (error) {
    console.error("create-checkout-session:", error);

    // Cualquier excepción DESPUÉS de reservar y ANTES de terminar
    // correctamente debe intentar devolver el stock.
    if (reservationToken && !reservationReleased) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

        if (stripeSessionId && stripeSecretKey) {
          await expireStripeSession(stripeSecretKey, stripeSessionId);
        }

        if (supabaseUrl) {
          const supabaseAdmin = createClient(
            supabaseUrl,
            getSupabaseAdminKey(),
            {
              auth: {
                persistSession: false,
                autoRefreshToken: false,
              },
            },
          );

          const { error: releaseError } = await supabaseAdmin.rpc(
            "release_checkout_reservation",
            {
              p_reservation_token: reservationToken,
              p_reason: "checkout_function_error",
            },
          );

          if (releaseError) {
            console.error(
              "CRITICAL: reserva no pudo liberarse en catch:",
              reservationToken,
              releaseError,
            );
          }
        }
      } catch (cleanupError) {
        console.error(
          "CRITICAL: error durante cleanup de reserva:",
          reservationToken,
          cleanupError,
        );
      }
    }

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado.",
      },
      500,
    );
  }
});
