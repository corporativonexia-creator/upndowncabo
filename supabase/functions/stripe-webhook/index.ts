import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

function firstSecretFromMap(name: string): string | null {
  const raw = Deno.env.get(name);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string,string>;
    return parsed.default ?? Object.values(parsed)[0] ?? null;
  } catch {
    return null;
  }
}

const supabaseAdminKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  firstSecretFromMap("SUPABASE_SECRET_KEYS") ||
  "";

if (!stripeSecretKey) console.error("Missing STRIPE_SECRET_KEY");
if (!webhookSecret) console.error("Missing STRIPE_WEBHOOK_SECRET");
if (!supabaseUrl) console.error("Missing SUPABASE_URL");
if (!supabaseAdminKey) console.error("Missing Supabase admin key");

const stripe = new Stripe(stripeSecretKey);

const supabase = createClient(supabaseUrl,supabaseAdminKey,{
  auth:{persistSession:false,autoRefreshToken:false}
});

function json(body:Record<string,unknown>,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{"Content-Type":"application/json"}
  });
}

function idOf(value:unknown):string|null{
  if(typeof value==="string") return value;
  if(value && typeof value==="object" && "id" in value){
    const id=(value as {id?:unknown}).id;
    return typeof id==="string"?id:null;
  }
  return null;
}

function customerName(session:any):string|null{
  const custom=Array.isArray(session?.custom_fields)
    ? session.custom_fields.find((field:any)=>field?.key==="customer_name")
    : null;

  return (
    custom?.text?.value ||
    session?.customer_details?.name ||
    null
  );
}

function reservationTokenOf(session:any):string|null{
  const token=session?.metadata?.reservation_token;
  return typeof token==="string" && token ? token : null;
}

async function releaseReservation(session:any,reason:string){
  const token=reservationTokenOf(session);
  if(!token) return {released:false,legacy:true};

  const {data,error}=await supabase.rpc(
    "release_checkout_reservation",
    {
      p_reservation_token:token,
      p_reason:reason
    }
  );

  if(error){
    // Liberar dos veces o liberar una consumida puede ser esperado
    // en eventos repetidos. La función es idempotente para released/expired.
    throw error;
  }

  return {released:true,result:data};
}

async function processPaidCheckout(event:Stripe.Event,session:any){
  const reservationToken=reservationTokenOf(session);

  if(!reservationToken){
    // HOTFIX43 solo procesa sesiones creadas por el flujo con reserva.
    // No arriesgamos un descuento legacy accidental.
    console.warn(
      `[stripe-webhook] Session ${session.id} has no reservation_token; ignored as legacy`
    );
    return {
      ignored:true,
      reason:"legacy_session_without_reservation"
    };
  }

  if(session.payment_status!=="paid"){
    return {
      ignored:true,
      reason:`payment_status_${session.payment_status || "unknown"}`
    };
  }

  const affiliateSellerId=
    typeof session?.metadata?.affiliate_seller_id==="string"
      ? session.metadata.affiliate_seller_id
      : null;

  const sellerRef=
    typeof session?.metadata?.affiliate_code==="string"
      ? session.metadata.affiliate_code
      : null;

  const commissionRateRaw=
    session?.metadata?.affiliate_commission_rate;

  const commissionRate=
    commissionRateRaw!==undefined &&
    commissionRateRaw!==null &&
    commissionRateRaw!==""
      ? Number(commissionRateRaw)
      : null;

  const {data,error}=await supabase.rpc(
    "process_reserved_stripe_checkout_affiliate",
    {
      p_stripe_event_id:event.id,
      p_event_type:event.type,
      p_stripe_session_id:session.id,
      p_payment_intent_id:idOf(session.payment_intent),
      p_checkout_reference:
        typeof session.client_reference_id==="string"
          ? session.client_reference_id
          : session?.metadata?.checkout_reference || null,
      p_customer_email:session?.customer_details?.email || null,
      p_customer_name:customerName(session),
      p_customer_phone:session?.customer_details?.phone || null,
      p_currency:
        typeof session.currency==="string"
          ? session.currency.toUpperCase()
          : "MXN",
      p_amount_subtotal:
        typeof session.amount_subtotal==="number"
          ? session.amount_subtotal/100
          : 0,
      p_amount_total:
        typeof session.amount_total==="number"
          ? session.amount_total/100
          : 0,
      p_stripe_created_at:new Date(event.created*1000).toISOString(),
      p_reservation_token:reservationToken,
      p_affiliate_seller_id:affiliateSellerId,
      p_seller_ref:sellerRef,
      p_commission_rate:
        Number.isFinite(commissionRate as number)
          ? commissionRate
          : null
    }
  );

  if(error) throw error;

  return data;
}

Deno.serve(async (request)=>{
  if(request.method!=="POST"){
    return json({error:"Method not allowed"},405);
  }

  if(!stripeSecretKey || !webhookSecret || !supabaseUrl || !supabaseAdminKey){
    return json({error:"Webhook server configuration missing"},500);
  }

  const signature=request.headers.get("stripe-signature");
  if(!signature){
    return json({error:"Missing Stripe-Signature"},400);
  }

  let event:Stripe.Event;

  try{
    const body=await request.text();

    event=await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  }catch(error){
    console.error("[stripe-webhook] signature verification failed",error);
    return json(
      {
        error:error instanceof Error
          ? error.message
          : "Invalid Stripe signature"
      },
      400
    );
  }

  try{
    console.log(`[stripe-webhook] ${event.type} ${event.id}`);

    switch(event.type){
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":{
        const session=event.data.object as Stripe.Checkout.Session;
        const result=await processPaidCheckout(event,session);
        return json({received:true,result});
      }

      case "checkout.session.expired":{
        const session=event.data.object as Stripe.Checkout.Session;
        const result=await releaseReservation(
          session,
          "stripe_checkout_session_expired"
        );
        return json({received:true,result});
      }

      case "checkout.session.async_payment_failed":{
        const session=event.data.object as Stripe.Checkout.Session;
        const result=await releaseReservation(
          session,
          "stripe_async_payment_failed"
        );
        return json({received:true,result});
      }

      default:
        return json({
          received:true,
          ignored:true,
          event_type:event.type
        });
    }
  }catch(error){
    console.error(
      `[stripe-webhook] processing failed ${event.type} ${event.id}`,
      error
    );

    // Stripe debe reintentar eventos que no logramos procesar.
    return json(
      {
        error:error instanceof Error
          ? error.message
          : "Webhook processing failed",
        event_id:event.id,
        event_type:event.type
      },
      500
    );
  }
});
