import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../src/lib/supabase/database.types.ts";
import { z } from "zod";

type Client = SupabaseClient<Database>;

export async function prepareExistingProfile(client: Client, id: string) {
  const result = await client.rpc("prepare_existing_invitation_profile", {
    p_invitation_id: id,
  });
  if (result.error || !z.uuid().safeParse(result.data).success)
    throw new Error("Existing identity could not be prepared");
}

export async function beginInvitation(
  client: Client,
  agencyId: string,
  email: string,
  displayName: string,
) {
  const result = await client.rpc("begin_superadmin_invitation", {
    p_agency_id: agencyId,
    p_email: email,
    p_display_name: displayName,
  });
  if (result.error) return { ok: false as const, code: result.error.code };
  const parsed = z.uuid().safeParse(result.data);
  if (!parsed.success) throw new Error("Invalid invitation response");
  return { ok: true as const, id: parsed.data };
}

export async function finishInvitation(
  client: Client,
  id: string,
  userId?: string,
) {
  // The user argument is ignored by SQL on delivery failure; no sentinel is stored.
  const { error } = await client.rpc("finish_superadmin_invitation", {
    p_invitation_id: id,
    p_user_id: userId ?? "00000000-0000-0000-0000-000000000000",
    p_delivered: userId !== undefined,
  });
  if (error)
    throw new Error("Invitation delivery state could not be confirmed");
}
