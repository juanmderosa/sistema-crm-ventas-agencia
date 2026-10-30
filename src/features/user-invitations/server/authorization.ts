import "server-only";
import { z } from "zod";
import { getCurrentUser } from "@/features/auth/server/session";
import { getActiveMembershipsForUser } from "@/features/access/server/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAgencyUserManagementAccess(selection: unknown) {
  const agency = z.uuid().safeParse(selection);
  if (!agency.success) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  const client = await createSupabaseServerClient();
  const memberships = await getActiveMembershipsForUser(client, user.id);
  const membership = memberships.find(
    (entry) =>
      entry.agency.id === agency.data &&
      ["agency_superadmin", "admin"].includes(entry.role),
  );
  return membership ? { client, user, membership } : null;
}
