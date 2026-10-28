import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  assignmentAgencySchema,
  profileChoicesSchema,
  type AssignSuperadminInput,
} from "../assignment-schemas";

type Client = SupabaseClient<Database>;

export async function getAgencyAssignment(client: Client, agencyId: string) {
  const agency = await client
    .from("agencies")
    .select("id,name,is_active")
    .eq("id", agencyId)
    .maybeSingle();

  if (agency.error) throw new Error("No se pudo consultar la agencia.");

  const parsed = assignmentAgencySchema.nullable().safeParse(agency.data);

  if (!parsed.success) throw new Error("La respuesta de agencia no es válida.");

  const owners = await client
    .from("memberships")
    .select("user_id,is_active,profile:profiles(display_name)")
    .eq("agency_id", agencyId)
    .eq("role", "agency_superadmin");

  if (owners.error)
    throw new Error("No se pudo consultar el superadministrador.");

  const ownerData = z
    .array(
      z.object({
        user_id: z.uuid(),
        is_active: z.boolean(),
        profile: z.object({ display_name: z.string().min(1) }),
      }),
    )
    .safeParse(owners.data);

  if (!ownerData.success)
    throw new Error("La respuesta de responsables no es válida.");

  return { agency: parsed.data, owners: ownerData.data };
}

export async function listAssignmentProfiles(client: Client, page: number) {
  const start = (page - 1) * 20;

  const result = await client
    .from("profiles")
    .select("id,display_name")
    .order("display_name")
    .order("id")
    .range(start, start + 20);

  if (result.error) throw new Error("No se pudieron consultar los usuarios.");

  const parsed = profileChoicesSchema.safeParse(result.data);
  if (!parsed.success)
    throw new Error("La respuesta de usuarios no es válida.");

  return {
    profiles: parsed.data.slice(0, 20),
    hasMore: parsed.data.length > 20,
  };
}

export async function assignInitialSuperadmin(
  client: Client,
  input: AssignSuperadminInput,
) {
  const { data, error } = await client.rpc("assign_initial_agency_superadmin", {
    p_agency_id: input.agencyId,
    p_user_id: input.userId,
  });

  if (error) return { ok: false as const, code: error.code };

  if (!z.uuid().safeParse(data).success)
    throw new Error(
      "No se pudo confirmar la asignación. Recargá la agencia antes de reintentar.",
    );

  return { ok: true as const };
}
