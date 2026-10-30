import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  agencySettingsRowSchema,
  agencySettingsHistorySchema,
  type AgencySettingsValues,
} from "../settings-schemas";
type Client = SupabaseClient<Database>;
export async function getAgencySettings(client: Client, agencyId: string) {
  const result = await client
    .from("agencies")
    .select("id,name,slug,ars_per_usd::text,settings_version")
    .eq("id", agencyId)
    .maybeSingle();
  if (result.error)
    throw new Error("No se pudo consultar la configuración de agencia.");
  return result.data === null
    ? null
    : agencySettingsRowSchema.parse(result.data);
}
export async function listAgencySettingsHistory(
  client: Client,
  agencyId: string,
  page: number,
) {
  const result = await client
    .from("agency_settings_history")
    .select(
      "id,actor_id,previous_name,new_name,previous_ars_per_usd::text,new_ars_per_usd::text,created_at",
    )
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * 20, page * 20);
  if (result.error)
    throw new Error("No se pudo consultar el historial de la agencia.");
  const rows = agencySettingsHistorySchema.parse(result.data);
  return { rows: rows.slice(0, 20), hasNext: rows.length > 20 };
}
export async function updateAgencySettings(
  client: Client,
  input: AgencySettingsValues,
) {
  const result = await client.rpc("update_agency_settings", {
    p_agency_id: input.agencyId,
    p_expected_version: input.expectedVersion,
    p_name: input.name,
    p_ars_per_usd: input.arsPerUsd,
  });
  if (result.error)
    return {
      ok: false as const,
      error:
        result.error.code === "40001"
          ? "La configuración cambió desde que abriste el formulario. Recargá antes de guardar."
          : result.error.code === "22023"
            ? "Revisá el nombre y la cotización; debe haber un cambio real."
            : "No se pudo guardar. Revisá tus permisos y recargá la página.",
    };
  if (!z.uuid().safeParse(result.data).success)
    throw new Error(
      "No se pudo confirmar el cambio. Recargá para comprobarlo.",
    );
  return { ok: true as const };
}
