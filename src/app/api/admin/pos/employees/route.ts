"use server";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

function normalizeEmployeeNumber(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 8);
}

function employeeEmail(number: string) {
  return `pos.${number}@employees.upndown.internal`;
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(url, publishable, {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("UNAUTHENTICATED");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role,is_active")
    .eq("id", user.id)
    .single();

  if (error || profile?.role !== "admin" || !profile?.is_active) {
    throw new Error("ADMIN_REQUIRED");
  }

  return user;
}

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin();
    if (!secret) {
      return NextResponse.json(
        { error: "Falta SUPABASE_SECRET_KEY en el servidor." },
        { status: 500 },
      );
    }

    const body = await request.json();
    const action = String(body.action || "");
    const service = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (action === "create") {
      const employeeNumber = normalizeEmployeeNumber(body.employee_number);
      const fullName = String(body.full_name || "").trim();
      const role = String(body.role || "cashier");
      const password = String(body.password || "");

      if (employeeNumber.length < 3)
        throw new Error("Número de empleado inválido.");
      if (!fullName) throw new Error("Nombre requerido.");
      if (!["cashier", "supervisor", "pos_admin"].includes(role))
        throw new Error("Rol inválido.");
      if (password.length < 8)
        throw new Error("La contraseña debe tener al menos 8 caracteres.");

      const { data: existing } = await service
        .from("pos_employees")
        .select("id")
        .eq("employee_number", employeeNumber)
        .maybeSingle();

      if (existing) throw new Error("Ese número de empleado ya existe.");

      const email = employeeEmail(employeeNumber);
      const { data: created, error: createError } =
        await service.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            pos_employee: true,
            employee_number: employeeNumber,
            full_name: fullName,
          },
        });

      if (createError || !created.user)
        throw createError || new Error("No se pudo crear el acceso.");

      const { error: insertError } = await service.from("pos_employees").insert({
        auth_user_id: created.user.id,
        employee_number: employeeNumber,
        full_name: fullName,
        role,
        status: "active",
        created_by: adminUser.id,
      });

      if (insertError) {
        await service.auth.admin.deleteUser(created.user.id);
        throw insertError;
      }

      return NextResponse.json({ ok: true });
    }

    const employeeId = String(body.employee_id || "");
    const { data: employee, error: employeeError } = await service
      .from("pos_employees")
      .select("id,auth_user_id,status,full_name")
      .eq("id", employeeId)
      .single();

    if (employeeError || !employee) throw new Error("Empleado no encontrado.");

    if (action === "reset_password") {
      const password = String(body.password || "");
      if (password.length < 8)
        throw new Error("La contraseña debe tener al menos 8 caracteres.");

      const { data: authUser, error: authUserError } =
        await service.auth.admin.getUserById(employee.auth_user_id);

      if (authUserError || !authUser.user?.email) {
        throw authUserError || new Error("POS_AUTH_USER_NOT_FOUND");
      }

      const beforeUpdatedAt = authUser.user.updated_at || null;

      const { data: updated, error: updateError } =
        await service.auth.admin.updateUserById(employee.auth_user_id, {
          password,
        });

      if (updateError || !updated.user) {
        throw updateError || new Error("PASSWORD_UPDATE_FAILED");
      }

      // Verificación real: la operación solo se considera exitosa si
      // Supabase Auth acepta inmediatamente la contraseña recién guardada.
      const verifier = createClient(url, publishable, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const { data: verified, error: verifyError } =
        await verifier.auth.signInWithPassword({
          email: authUser.user.email,
          password,
        });

      if (verifyError || !verified.session) {
        console.error("POS password reset verification failed", {
          employeeId: employee.id,
          authUserId: employee.auth_user_id,
          message: verifyError?.message,
          status: verifyError?.status,
          code: verifyError?.code,
          beforeUpdatedAt,
          afterUpdatedAt: updated.user.updated_at || null,
        });

        throw new Error(
          `PASSWORD_RESET_VERIFICATION_FAILED: ${
            verifyError?.message || "Supabase no aceptó la contraseña nueva."
          }`,
        );
      }

      // Cierra únicamente la sesión temporal usada para verificar.
      await verifier.auth.signOut();

      await service.from("pos_access_log").insert({
        employee_id: employee.id,
        event_type: "employee_password_reset",
        success: true,
        details: {
          verified: true,
          changed_by: adminUser.id,
          auth_updated_at: updated.user.updated_at || null,
        },
      });

      return NextResponse.json({
        ok: true,
        verified: true,
        auth_updated_at: updated.user.updated_at || null,
      });
    }

    if (
      action === "force_close_and_suspend" ||
      action === "force_close_and_terminate"
    ) {
      const closingCash = Number(body.closing_cash);
      const reason = String(body.reason || "").trim();

      if (!Number.isFinite(closingCash) || closingCash < 0) {
        throw new Error("Escribe un efectivo contado válido.");
      }

      if (reason.length < 3) {
        throw new Error("Escribe el motivo del cierre administrativo.");
      }

      const { data: closeResult, error: closeError } = await service.rpc(
        "admin_pos_force_close_shift_service",
        {
          p_admin_user_id: adminUser.id,
          p_employee_id: employee.id,
          p_closing_cash: closingCash,
          p_reason: reason,
        },
      );

      if (closeError) throw closeError;

      if (action === "force_close_and_suspend") {
        const { error: statusError } = await service
          .from("pos_employees")
          .update({
            status: "suspended",
            suspended_at: new Date().toISOString(),
          })
          .eq("id", employee.id);

        if (statusError) throw statusError;

        const { error: banError } = await service.auth.admin.updateUserById(
          employee.auth_user_id,
          { ban_duration: "876000h" },
        );

        if (banError) throw banError;

        await service.from("pos_access_log").insert({
          employee_id: employee.id,
          terminal_id: closeResult?.terminal_id || null,
          event_type: "employee_suspended_after_force_close",
          success: true,
          details: {
            changed_by: adminUser.id,
            shift_id: closeResult?.shift_id || null,
            reason,
          },
        });

        return NextResponse.json({
          ok: true,
          forced_close: closeResult,
          employee_status: "suspended",
        });
      }

      const { error: statusError } = await service
        .from("pos_employees")
        .update({
          status: "terminated",
          terminated_at: new Date().toISOString(),
        })
        .eq("id", employee.id);

      if (statusError) throw statusError;

      const { error: banError } = await service.auth.admin.updateUserById(
        employee.auth_user_id,
        { ban_duration: "876000h" },
      );

      if (banError) throw banError;

      await service.from("pos_access_log").insert({
        employee_id: employee.id,
        terminal_id: closeResult?.terminal_id || null,
        event_type: "employee_terminated_after_force_close",
        success: true,
        details: {
          changed_by: adminUser.id,
          shift_id: closeResult?.shift_id || null,
          reason,
        },
      });

      return NextResponse.json({
        ok: true,
        forced_close: closeResult,
        employee_status: "terminated",
      });
    }

    if (action === "suspend") {
      const { error: shiftError, data: openShift } = await service
        .from("pos_shifts")
        .select("id")
        .eq("employee_id", employee.id)
        .eq("status", "open")
        .maybeSingle();
      if (shiftError) throw shiftError;
      if (openShift)
        throw new Error("El empleado tiene un turno abierto. Ciérralo primero.");

      const { error } = await service
        .from("pos_employees")
        .update({ status: "suspended", suspended_at: new Date().toISOString() })
        .eq("id", employee.id);
      if (error) throw error;

      await service.auth.admin.updateUserById(employee.auth_user_id, {
        ban_duration: "876000h",
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "reactivate") {
      const { error } = await service
        .from("pos_employees")
        .update({ status: "active", suspended_at: null })
        .eq("id", employee.id);
      if (error) throw error;

      await service.auth.admin.updateUserById(employee.auth_user_id, {
        ban_duration: "none",
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "terminate") {
      const { data: openShift, error: shiftError } = await service
        .from("pos_shifts")
        .select("id")
        .eq("employee_id", employee.id)
        .eq("status", "open")
        .maybeSingle();
      if (shiftError) throw shiftError;
      if (openShift)
        throw new Error("El empleado tiene un turno abierto. Ciérralo primero.");

      const { error } = await service
        .from("pos_employees")
        .update({
          status: "terminated",
          terminated_at: new Date().toISOString(),
        })
        .eq("id", employee.id);
      if (error) throw error;

      await service.auth.admin.updateUserById(employee.auth_user_id, {
        ban_duration: "876000h",
      });
      return NextResponse.json({ ok: true });
    }

    throw new Error("Acción no soportada.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo completar la operación.";
    const status =
      message === "UNAUTHENTICATED" ? 401 : message === "ADMIN_REQUIRED" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
