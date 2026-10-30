import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { z } from "zod";
import { agencyListSchema, type CreateAgencyValues } from "../schemas";
import type { AgencyStatusInput } from "../activation-schema";

const PAGE_SIZE = 20;
export async function setPlatformAgencyActive(
  client: SupabaseClient<Database>,
  input: AgencyStatusInput,
) {
  const result = await client.rpc("set_agency_active", {
    p_agency_id: input.agencyId,
    p_is_active: input.isActive,
    p_expected_version: input.expectedVersion,
  });
  if (result.error)
    return {
      ok: false as const,
      error:
        result.error.code === "40001"
          ? "El estado de la agencia cambió. Recargá el listado antes de reintentar."
          : result.error.code === "42501"
            ? "Tu acceso de plataforma ya no está habilitado."
            : "No se pudo cambiar el estado. Recargá el listado y revisá tus permisos.",
    };
  if (!z.uuid().safeParse(result.data).success)
    throw new Error("No se pudo confirmar el estado. Recargá el listado.");
  return { ok: true as const };
}

export async function listPlatformAgencies(
  client: SupabaseClient<Database>,
  page: number,
) {
  const start = (page - 1) * PAGE_SIZE;
  const { data, error } = await client
    .from("agencies")
    .select(
      "id,name,slug,is_active,status_version,ars_per_usd::text,created_at",
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(start, start + PAGE_SIZE);
  if (error)
    throw new Error(
      "No se pudieron consultar las agencias. Intentá nuevamente.",
    );
  const parsed = agencyListSchema.safeParse(data);
  if (!parsed.success)
    throw new Error(
      "La respuesta de agencias no es válida. Intentá nuevamente.",
    );
  return {
    agencies: parsed.data.slice(0, PAGE_SIZE),
    hasMore: parsed.data.length > PAGE_SIZE,
  };
}

export async function insertPlatformAgency(
  client: SupabaseClient<Database>,
  values: CreateAgencyValues,
) {
  const { data, error } = await client.rpc("create_agency", {
    p_name: values.name,
    p_slug: values.slug,
    p_ars_per_usd: values.arsPerUsd,
  });
  if (error) return { ok: false as const, code: error.code };
  const parsed = z.uuid().safeParse(data);
  if (!parsed.success)
    throw new Error(
      "La respuesta del alta no es válida. Recargá el listado antes de reintentar.",
    );
  return { ok: true as const, id: parsed.data };
}
