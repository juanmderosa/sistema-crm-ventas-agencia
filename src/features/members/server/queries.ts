import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  memberRowsSchema,
  memberStatusSchema,
  memberRoleSchema,
} from "../schemas";
type Client = SupabaseClient<Database>;
export async function setAgencyMemberRole(
  client: Client,
  input: z.infer<typeof memberRoleSchema>,
) {
  const result = await client.rpc("set_agency_member_role", {
    p_agency_id: input.agencyId,
    p_membership_id: input.membershipId,
    p_role: input.role,
    p_expected_role: input.expectedRole,
    p_expected_is_active: input.expectedIsActive,
  });
  if (result.error)
    return {
      ok: false as const,
      error:
        result.error.code === "40001"
          ? "El rol o el estado cambió, o el miembro está ocupado. Recargá la lista y volvé a intentar."
          : "No se pudo cambiar el rol. Revisá tus permisos y recargá la lista.",
    };
  if (!z.uuid().safeParse(result.data).success)
    throw new Error("No se pudo confirmar el rol. Recargá la lista.");
  return { ok: true as const };
}
export async function listAgencyMembers(
  client: Client,
  agencyId: string,
  page: number,
) {
  const result = await client.rpc("list_agency_members", {
    p_agency_id: agencyId,
    p_offset: (page - 1) * 20,
  });
  if (result.error)
    throw new Error("No se pudieron consultar los miembros de la agencia.");
  const rows = memberRowsSchema.parse(result.data);
  return { rows: rows.slice(0, 20), hasNext: rows.length > 20 };
}
export async function setAgencyMemberActive(
  client: Client,
  input: z.infer<typeof memberStatusSchema>,
) {
  const result = await client.rpc("set_agency_member_active", {
    p_agency_id: input.agencyId,
    p_membership_id: input.membershipId,
    p_is_active: input.isActive,
    p_expected_is_active: input.expectedIsActive,
  });
  if (result.error)
    return {
      ok: false as const,
      error:
        result.error.code === "40001"
          ? "El miembro cambió o está siendo utilizado por otra operación. Recargá la lista y volvé a intentar."
          : "No se pudo cambiar el estado. Revisá tus permisos y recargá la lista.",
    };
  if (!z.uuid().safeParse(result.data).success)
    throw new Error("No se pudo confirmar el cambio. Recargá la lista.");
  return { ok: true as const };
}
