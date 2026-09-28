import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

function normalizeLoginCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 30);
}

async function writeAccessLog(service: any, payload: {
  employee_id?: string | null;
  terminal_id?: string | null;
  event_type: string;
  success: boolean;
  details?: Record<string, unknown>;
}) {
  try {
    await service.from("pos_access_log").insert({
      employee_id: payload.employee_id ?? null,
      terminal_id: payload.terminal_id ?? null,
      event_type: payload.event_type,
      success: payload.success,
      details: payload.details ?? {},
    });
  } catch (error) {
    console.error("POS access log write", error);
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/pos/login",
    supabase_url: Boolean(url),
    publishable_key: Boolean(publishable),
    secret_key: Boolean(secret),
    runtime: "server",
    seller_pos_access: true,
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!url || !publishable) {
      return NextResponse.json({ error: "POS_CONFIG_MISSING_PUBLIC_SUPABASE" }, { status: 500 });
    }
    if (!secret) {
      return NextResponse.json({ error: "POS_CONFIG_MISSING_SUPABASE_SECRET_KEY" }, { status: 500 });
    }

    const body = await request.json();
    const loginCode = normalizeLoginCode(body.login_code ?? body.employee_number ?? body.employee);
    const password = String(body.password || "");

    if (loginCode.length < 3 || !password) {
      return NextResponse.json(
        { error: "EMPLOYEE_OR_SELLER_CODE_AND_PASSWORD_REQUIRED" },
        { status: 400 },
      );
    }

    const service = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let { data: employee, error: employeeError } = await service
      .from("pos_employees")
      .select("id,auth_user_id,employee_number,full_name,role,status")
      .eq("employee_number", loginCode)
      .maybeSingle();

    if (employeeError) {
      console.error("POS employee lookup", employeeError);
      return NextResponse.json({ error: "POS_EMPLOYEE_LOOKUP_FAILED" }, { status: 500 });
    }

    if (!employee) {
      const { data: seller, error: sellerError } = await service
        .from("affiliate_sellers")
        .select("id,code,name,email,is_active")
        .eq("code", loginCode)
        .maybeSingle();

      if (sellerError) {
        console.error("POS seller lookup", sellerError);
        return NextResponse.json({ error: "POS_SELLER_LOOKUP_FAILED" }, { status: 500 });
      }

      if (!seller) {
        await writeAccessLog(service, {
          event_type: "employee_login_failed",
          success: false,
          details: { reason: "employee_or_seller_not_found", login_code: loginCode },
        });
        return NextResponse.json({ error: "POS_EMPLOYEE_OR_SELLER_NOT_FOUND" }, { status: 401 });
      }

      if (!seller.is_active) {
        return NextResponse.json({ error: "POS_SELLER_INACTIVE" }, { status: 403 });
      }

      const { data: sellerProfile, error: profileError } = await service
        .from("profiles")
        .select("role,is_active")
        .eq("id", seller.id)
        .maybeSingle();

      if (profileError || sellerProfile?.role !== "seller" || !sellerProfile?.is_active) {
        return NextResponse.json({ error: "POS_SELLER_PROFILE_NOT_ACTIVE" }, { status: 403 });
      }

      const { data: sellerAuth, error: sellerAuthError } =
        await service.auth.admin.getUserById(seller.id);

      if (sellerAuthError || !sellerAuth.user?.email) {
        console.error("POS seller auth lookup", sellerAuthError);
        return NextResponse.json({ error: "POS_SELLER_AUTH_USER_NOT_FOUND" }, { status: 500 });
      }

      const authClient = createClient(url, publishable, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: sellerSignIn, error: sellerSignInError } =
        await authClient.auth.signInWithPassword({
          email: sellerAuth.user.email,
          password,
        });

      if (sellerSignInError || !sellerSignIn.session) {
        return NextResponse.json(
          { error: "INVALID_SELLER_PASSWORD", auth_message: sellerSignInError?.message || null },
          { status: 401 },
        );
      }

      const { data: linkedEmployee, error: linkedEmployeeError } = await service
        .from("pos_employees")
        .select("id,auth_user_id,employee_number,full_name,role,status")
        .eq("auth_user_id", seller.id)
        .maybeSingle();

      if (linkedEmployeeError) {
        console.error("POS linked seller employee lookup", linkedEmployeeError);
        return NextResponse.json({ error: "POS_SELLER_LINK_LOOKUP_FAILED" }, { status: 500 });
      }

      if (linkedEmployee) {
        employee = linkedEmployee;
      } else {
        const { data: createdEmployee, error: provisionError } = await service
          .from("pos_employees")
          .insert({
            auth_user_id: seller.id,
            employee_number: seller.code,
            full_name: seller.name,
            role: "cashier",
            status: "active",
          })
          .select("id,auth_user_id,employee_number,full_name,role,status")
          .single();

        if (provisionError || !createdEmployee) {
          console.error("POS seller auto-provision", provisionError);
          return NextResponse.json(
            { error: "POS_SELLER_PROVISION_FAILED", detail: provisionError?.message || null },
            { status: 500 },
          );
        }
        employee = createdEmployee;
      }

      if (employee.status !== "active") {
        return NextResponse.json(
          { error: employee.status === "suspended" ? "POS_EMPLOYEE_SUSPENDED" : "POS_EMPLOYEE_TERMINATED" },
          { status: 403 },
        );
      }

      await service
        .from("pos_employees")
        .update({ last_login_at: new Date().toISOString(), full_name: seller.name })
        .eq("id", employee.id);

      await writeAccessLog(service, {
        employee_id: employee.id,
        event_type: "employee_login",
        success: true,
        details: {
          source: "server_pos_login",
          identity_type: "seller",
          seller_id: seller.id,
          seller_code: seller.code,
          employee_number: employee.employee_number,
        },
      });

      return NextResponse.json({
        ok: true,
        access_token: sellerSignIn.session.access_token,
        refresh_token: sellerSignIn.session.refresh_token,
        identity_type: "seller",
        seller: { id: seller.id, code: seller.code, name: seller.name },
        employee: {
          employee_number: employee.employee_number,
          full_name: seller.name,
          role: employee.role,
        },
      });
    }

    if (employee.status !== "active") {
      await writeAccessLog(service, {
        employee_id: employee.id,
        event_type: "employee_login_denied",
        success: false,
        details: { reason: employee.status, employee_number: employee.employee_number },
      });
      return NextResponse.json(
        { error: employee.status === "suspended" ? "POS_EMPLOYEE_SUSPENDED" : "POS_EMPLOYEE_TERMINATED" },
        { status: 403 },
      );
    }

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: recentFailures } = await service
      .from("pos_access_log")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", employee.id)
      .eq("success", false)
      .in("event_type", ["employee_login_failed", "employee_login_rate_limited"])
      .gte("created_at", fifteenMinutesAgo);

    if ((recentFailures || 0) >= 5) {
      await writeAccessLog(service, {
        employee_id: employee.id,
        event_type: "employee_login_rate_limited",
        success: false,
        details: { reason: "five_failures_in_15_minutes", employee_number: employee.employee_number },
      });
      return NextResponse.json({ error: "POS_LOGIN_TEMPORARILY_BLOCKED" }, { status: 429 });
    }

    const { data: authUser, error: authUserError } =
      await service.auth.admin.getUserById(employee.auth_user_id);

    if (authUserError || !authUser.user?.email) {
      return NextResponse.json({ error: "POS_AUTH_USER_NOT_FOUND" }, { status: 500 });
    }

    const authClient = createClient(url, publishable, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: signIn, error: signInError } =
      await authClient.auth.signInWithPassword({
        email: authUser.user.email,
        password,
      });

    if (signInError || !signIn.session) {
      await writeAccessLog(service, {
        employee_id: employee.id,
        event_type: "employee_login_failed",
        success: false,
        details: { reason: "invalid_password", employee_number: employee.employee_number },
      });
      return NextResponse.json(
        { error: "INVALID_EMPLOYEE_PASSWORD", auth_message: signInError?.message || null },
        { status: 401 },
      );
    }

    await service
      .from("pos_employees")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", employee.id);

    await writeAccessLog(service, {
      employee_id: employee.id,
      event_type: "employee_login",
      success: true,
      details: {
        source: "server_pos_login",
        identity_type: "employee",
        employee_number: employee.employee_number,
      },
    });

    return NextResponse.json({
      ok: true,
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
      identity_type: "employee",
      employee: {
        employee_number: employee.employee_number,
        full_name: employee.full_name,
        role: employee.role,
      },
    });
  } catch (error) {
    console.error("POS login route", error);
    return NextResponse.json(
      { error: error instanceof Error ? `POS_LOGIN_SERVER_ERROR: ${error.message}` : `POS_LOGIN_SERVER_ERROR: ${String(error)}` },
      { status: 500 },
    );
  }
}
