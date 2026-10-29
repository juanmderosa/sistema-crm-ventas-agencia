import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "../../../src/lib/supabase/database.types.ts";
type Client = SupabaseClient<Database>;
export async function beginInvitation(
  client: Client,
  agencyId: string,
  email: string,
  displayName: string,
  role: "admin" | "seller",
) {
  const result = await client.rpc("begin_agency_user_invitation", {
    p_agency_id: agencyId,
    p_email: email,
    p_display_name: displayName,
    p_role: role,
  });
  if (result.error) return { ok: false as const, code: result.error.code };
  return { ok: true as const, id: z.uuid().parse(result.data) };
}
export async function prepareExistingProfile(client: Client, id: string) {
  const result = await client.rpc("prepare_existing_agency_user_invitation", {
    p_invitation_id: id,
  });
  if (result.error) throw new Error("Existing identity unavailable");
  return z.uuid().parse(result.data);
}
export async function finishInvitation(
  client: Client,
  id: string,
  userId?: string,
) {
  const result = await client.rpc("finish_agency_user_invitation", {
    p_invitation_id: id,
    p_user_id: userId ?? "00000000-0000-0000-0000-000000000000",
    p_delivered: userId !== undefined,
  });
  if (result.error) throw new Error("Delivery state unconfirmed");
}
