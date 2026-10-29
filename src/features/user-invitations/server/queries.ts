import "server-only";
import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import {
  agencyUserInvitationRowsSchema,
  type InviteAgencyUserInput,
} from "../schemas";
type Client = SupabaseClient<Database>;
export async function listAgencyUserInvitations(
  client: Client,
  agency: string,
  page: number,
) {
  const result = await client
    .from("agency_user_invitations")
    .select("id,email,display_name,role,status,expires_at,created_at")
    .eq("agency_id", agency)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * 20, page * 20);
  if (result.error)
    throw new Error("No se pudieron consultar las invitaciones de la agencia.");
  const rows = agencyUserInvitationRowsSchema.parse(result.data);
  const now = Date.now();
  return {
    hasNext: rows.length > 20,
    rows: rows
      .slice(0, 20)
      .map((row) => ({ ...row, isExpired: Date.parse(row.expires_at) <= now })),
  };
}
export async function sendAgencyUserInvitation(
  client: Client,
  input: InviteAgencyUserInput,
) {
  const result = await client.functions.invoke("invite-agency-user", {
    body: input,
  });
  if (result.error) {
    if (result.error instanceof FunctionsHttpError) {
      try {
        const error = z
          .object({ ok: z.literal(false), error: z.string().min(1).max(400) })
          .safeParse(await result.error.context.json());
        if (error.success) return error.data;
      } catch {
        /* Replaced by an explicit error below. */
      }
    }
    return {
      ok: false as const,
      error:
        "No pudimos confirmar el envío. Recargá el estado antes de reintentar.",
    };
  }
  if (
    !z
      .object({ ok: z.literal(true), invitationId: z.uuid() })
      .safeParse(result.data).success
  )
    throw new Error("Respuesta de envío inválida. Recargá el estado.");
  return { ok: true as const };
}
export async function cancelAgencyUserInvitation(client: Client, id: string) {
  const result = await client.rpc("cancel_agency_user_invitation", {
    p_invitation_id: id,
  });
  return result.error
    ? {
        ok: false as const,
        error: "No se pudo cancelar. Revisá tus permisos y recargá el estado.",
      }
    : { ok: true as const };
}
export async function acceptAgencyUserInvitation(client: Client, id: string) {
  const result = await client.rpc("accept_agency_user_invitation", {
    p_invitation_id: id,
  });
  if (result.error)
    return {
      ok: false as const,
      error:
        "No se pudo aceptar. Verificá tu cuenta, la vigencia y los permisos de quien envió la invitación. Si ya definiste contraseña, ingresá para completar con tu sesión.",
    };
  if (!z.uuid().safeParse(result.data).success)
    throw new Error("No se pudo confirmar la aceptación. Revisá tu acceso.");
  return { ok: true as const };
}
