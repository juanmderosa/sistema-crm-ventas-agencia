import "server-only";
import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import { invitationRowsSchema, type InviteSuperadminInput } from "../schemas";

type Client = SupabaseClient<Database>;
const errorSchema = z.object({
  ok: z.literal(false),
  error: z.string().min(1).max(400),
});

export async function listAgencyInvitations(client: Client, agencyId: string) {
  const result = await client
    .from("agency_invitations")
    .select("id,email,display_name,status,expires_at,created_at")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(10);
  if (result.error)
    throw new Error("No se pudo consultar el estado de las invitaciones.");
  const parsed = invitationRowsSchema.safeParse(result.data);
  if (!parsed.success)
    throw new Error("La respuesta de invitaciones no es válida.");
  const now = Date.now();
  return parsed.data.map((row) => ({
    ...row,
    isExpired: Date.parse(row.expires_at) <= now,
    isPending:
      ["sending", "sent"].includes(row.status) &&
      Date.parse(row.expires_at) > now,
  }));
}

export async function sendSuperadminInvitation(
  client: Client,
  input: InviteSuperadminInput,
) {
  const result = await client.functions.invoke("invite-agency-superadmin", {
    body: input,
  });
  if (result.error) {
    if (result.error instanceof FunctionsHttpError) {
      try {
        const parsed = errorSchema.safeParse(await result.error.context.json());
        if (parsed.success) return parsed.data;
      } catch {
        /* Unknown gateway output is replaced by the explicit generic error below. */
      }
    }
    return {
      ok: false as const,
      error:
        "No pudimos confirmar el envío. Verificá el servicio de invitaciones y recargá su estado antes de reintentar.",
    };
  }
  if (
    !z
      .object({ ok: z.literal(true), invitationId: z.uuid() })
      .safeParse(result.data).success
  )
    throw new Error(
      "Respuesta de envío no válida. Recargá el estado antes de reintentar.",
    );
  return { ok: true as const };
}

export async function cancelSuperadminInvitation(client: Client, id: string) {
  const { error } = await client.rpc("cancel_superadmin_invitation", {
    p_invitation_id: id,
  });
  return error
    ? {
        ok: false as const,
        error:
          "No se pudo cancelar. Revisá tus permisos y recargá el estado de la invitación.",
      }
    : { ok: true as const };
}

export async function acceptSuperadminInvitation(client: Client, id: string) {
  const { data, error } = await client.rpc("accept_superadmin_invitation", {
    p_invitation_id: id,
  });
  if (error)
    return {
      ok: false as const,
      error:
        "No se pudo aceptar: la invitación venció, se canceló, ya se usó o no corresponde a tu cuenta; también puede haberse revocado el acceso de quien la envió. Si ya definiste contraseña, ingresá y completá la aceptación desde este enlace.",
    };
  if (!z.uuid().safeParse(data).success)
    throw new Error(
      "No se pudo confirmar la aceptación. Ingresá para revisar tu acceso.",
    );
  return { ok: true as const };
}
