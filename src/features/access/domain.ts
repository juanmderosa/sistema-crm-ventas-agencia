import { z } from "zod";

export const membershipSchema = z.object({
  role: z.enum(["agency_superadmin", "admin", "seller"]),
  agency: z.object({ id: z.uuid(), name: z.string().min(1) }),
});

export type Membership = z.infer<typeof membershipSchema>;
export const roleLabels: Record<Membership["role"], string> = {
  agency_superadmin: "Superadministrador de agencia",
  admin: "Administrador",
  seller: "Vendedor",
};

type AgencyAccess =
  | { kind: "none" | "choose" | "denied" }
  | { kind: "agency"; membership: Membership };

/** Input memberships must already be authorized and validated on the server. */
export function resolveAgencyAccess(
  memberships: Membership[],
  selection: unknown,
): AgencyAccess {
  const parsed = z.uuid().optional().safeParse(selection);
  if (!parsed.success) return { kind: "denied" };
  if (parsed.data !== undefined) {
    const membership = memberships.find(
      ({ agency }) => agency.id === parsed.data,
    );
    return membership ? { kind: "agency", membership } : { kind: "denied" };
  }
  const [only] = memberships;
  if (!only) return { kind: "none" };
  return memberships.length === 1
    ? { kind: "agency", membership: only }
    : { kind: "choose" };
}
