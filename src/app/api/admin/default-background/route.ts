import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BYTES = 10 * 1024 * 1024;
const PATH = "storefront/default-background";

async function authorized() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return false;
  const { data } = await db.from("profiles").select("role,is_active").eq("id", user.id).single();
  return data?.role === "admin" && data.is_active === true;
}

export async function POST(request: Request) {
  if (!await authorized()) return NextResponse.json({ error: "Acceso exclusivo para administradores." }, { status: 403 });
  if (Number(request.headers.get("content-length")) > MAX_BYTES + 65536)
    return NextResponse.json({ error: "La imagen debe pesar como máximo 10 MB." }, { status: 413 });
  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File) || !file.size || file.size > MAX_BYTES)
    return NextResponse.json({ error: "Selecciona una imagen de hasta 10 MB." }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const valid = (file.type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    || (file.type === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
    || (file.type === "image/webp" && bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP");
  if (!valid) return NextResponse.json({ error: "Usa una imagen JPG, PNG o WebP válida." }, { status: 400 });
  const { error } = await createAdminClient().storage.from("site-content").upload(PATH, bytes, {
    contentType: file.type, cacheControl: "0", upsert: true,
  });
  if (error) return NextResponse.json({ error: "No fue posible guardar el fondo. Inténtalo de nuevo." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  if (!await authorized()) return NextResponse.json({ error: "Acceso exclusivo para administradores." }, { status: 403 });
  const { error } = await createAdminClient().storage.from("site-content").remove([PATH]);
  if (error) return NextResponse.json({ error: "No fue posible restaurar el fondo oficial." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
