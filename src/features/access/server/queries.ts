import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import { membershipSchema } from "../domain";

type AccessClient = SupabaseClient<Database>;

// Call with a request-scoped client and a user ID verified by the server.
// These filters complement RLS; role and ownership never come from the client.
export async function getActiveMembershipsForUser(
  supabase: AccessClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("memberships")
    .select("role, agency:agencies!inner(id,name)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("agency.is_active", true);
  if (error)
    throw new Error(
      "No se pudieron consultar las membresías. Intentá nuevamente.",
    );
  const parsed = z.array(membershipSchema).safeParse(data);
  if (!parsed.success)
    throw new Error(
      "La respuesta de membresías no es válida. Intentá nuevamente.",
    );
  return parsed.data;
}

export async function getActivePlatformAdminForUser(
  supabase: AccessClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (error)
    throw new Error(
      "No se pudo consultar el acceso de plataforma. Intentá nuevamente.",
    );
  const parsed = z.object({ user_id: z.uuid() }).nullable().safeParse(data);
  if (!parsed.success)
    throw new Error(
      "La respuesta de plataforma no es válida. Intentá nuevamente.",
    );
  return parsed.data;
}
