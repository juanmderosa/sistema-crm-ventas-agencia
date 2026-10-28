import "server-only";
import { getCurrentUser } from "@/features/auth/server/session";
import { getActivePlatformAdminForUser } from "@/features/access/server/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getPlatformAgencyAccess() {
  const user = await getCurrentUser();
  if (!user) return null;
  const client = await createSupabaseServerClient();
  if (!(await getActivePlatformAdminForUser(client, user.id))) return null;
  return { user, client };
}
