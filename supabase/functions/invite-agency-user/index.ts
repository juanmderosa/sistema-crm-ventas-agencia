import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "../../../src/lib/supabase/database.types.ts";
import {
  beginInvitation,
  finishInvitation,
  prepareExistingProfile,
} from "./queries.ts";

const inputSchema = z.object({
  agencyId: z.uuid(),
  role: z.enum(["admin", "seller"]),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  displayName: z.string().trim().min(1).max(160),
});
const originSchema = z.url().refine((value) => {
  const url = new URL(value);
  return (
    value === url.origin &&
    !url.username &&
    !url.password &&
    (url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)))
  );
});
const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};
function response(
  status: number,
  body: { ok: false; error: string } | { ok: true; invitationId: string },
) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST")
    return response(405, { ok: false, error: "Método no permitido." });
  try {
    const env = z
      .object({
        url: z.url(),
        publicKey: z.string().min(1),
        adminKey: z.string().min(1),
        origin: originSchema,
      })
      .safeParse({
        url: Deno.env.get("SUPABASE_URL"),
        publicKey: Deno.env.get("SUPABASE_ANON_KEY"),
        adminKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
        origin: Deno.env.get("APP_ORIGIN"),
      });
    if (!env.success)
      return response(503, {
        ok: false,
        error: "El servicio de invitaciones no está configurado.",
      });
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer "))
      return response(401, { ok: false, error: "Ingresá nuevamente." });
    const userClient = createClient<Database>(
      env.data.url,
      env.data.publicKey,
      { ...options, global: { headers: { Authorization: authorization } } },
    );
    const identity = await userClient.auth.getUser(authorization.slice(7));
    if (identity.error || !identity.data.user)
      return response(401, { ok: false, error: "Ingresá nuevamente." });
    const text = await request.text();
    if (text.length > 4096)
      return response(400, { ok: false, error: "Solicitud demasiado grande." });
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      return response(400, {
        ok: false,
        error: "Revisá los datos de la invitación.",
      });
    }
    const input = inputSchema.safeParse(payload);
    if (!input.success)
      return response(400, {
        ok: false,
        error: "Revisá el correo, el nombre y la agencia.",
      });
    const pending = await beginInvitation(
      userClient,
      input.data.agencyId,
      input.data.email,
      input.data.displayName,
      input.data.role,
    );
    if (!pending.ok)
      return response(pending.code === "42501" ? 403 : 409, {
        ok: false,
        error:
          pending.code === "42501"
            ? "No tenés permiso para invitar con este rol en esta agencia."
            : "La agencia está inactiva, la cuenta ya es miembro o tiene una invitación pendiente.",
      });
    const admin = createClient<Database>(
      env.data.url,
      env.data.adminKey,
      options,
    );
    const redirectTo = `${env.data.origin}/invitaciones/usuarios/aceptar?invitation=${pending.id}`;
    const invited = await admin.auth.admin.inviteUserByEmail(input.data.email, {
      redirectTo,
    });
    if (invited.error) {
      // A transport/server failure cannot prove whether SMTP already delivered the mail.
      // Keep the reservation in "sending" for explicit review/cancellation rather than inventing failure.
      if (!invited.error.status || invited.error.status >= 500)
        throw new Error("Mail delivery is unconfirmed");
      const existing =
        invited.error.code === "email_exists" ||
        invited.error.code === "user_already_exists";
      if (existing) {
        const userId = await prepareExistingProfile(admin, pending.id);
        const sent = await userClient.auth.signInWithOtp({
          email: input.data.email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: redirectTo + "&method=magiclink",
          },
        });
        if (!sent.error) {
          await finishInvitation(admin, pending.id, userId);
          return response(200, { ok: true, invitationId: pending.id });
        }
        if (!sent.error.status || sent.error.status >= 500)
          throw new Error("Mail delivery is unconfirmed");
      }
      await finishInvitation(admin, pending.id);
      return response(invited.error.status === 429 ? 429 : 409, {
        ok: false,
        error: existing
          ? "No se pudo enviar el enlace a la cuenta existente. No se cambió su contraseña."
          : "No se pudo enviar la invitación. Revisá el servicio de correo o si la cuenta ya existe antes de reintentar.",
      });
    }
    const user = z
      .object({ id: z.uuid(), email: z.email() })
      .safeParse(invited.data.user);
    if (!user.success || user.data.email.toLowerCase() !== input.data.email)
      throw new Error("Invalid invited identity");
    await finishInvitation(admin, pending.id, user.data.id);
    return response(200, { ok: true, invitationId: pending.id });
  } catch {
    return response(503, {
      ok: false,
      error:
        "No pudimos confirmar el envío. Revisá el estado de la invitación antes de reintentar; si quedó pendiente podés cancelarla.",
    });
  }
});
