import "server-only";
import { requireUser } from "@/features/auth/server/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getActiveMembershipsForUser,
  getActivePlatformAdminForUser,
} from "./queries";

export async function getAccessContext() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const [memberships, platformAdmin] = await Promise.all([
    getActiveMembershipsForUser(supabase, user.id),
    getActivePlatformAdminForUser(supabase, user.id),
  ]);
  return {
    user,
    memberships: memberships.sort((a, b) =>
      a.agency.name.localeCompare(b.agency.name, "es"),
    ),
    isPlatformAdmin: platformAdmin !== null,
  };
}
