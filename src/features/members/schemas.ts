import { z } from "zod";
export const memberStatusSchema = z
  .object({
    agencyId: z.uuid(),
    membershipId: z.uuid(),
    isActive: z.boolean(),
    expectedIsActive: z.boolean(),
  })
  .refine(
    (value) => value.isActive !== value.expectedIsActive,
    "El estado debe cambiar.",
  );
export const memberRowsSchema = z.array(
  z.object({
    id: z.uuid(),
    user_id: z.uuid(),
    display_name: z.string().min(1).max(160),
    role: z.enum(["agency_superadmin", "admin", "seller"]),
    is_active: z.boolean(),
    created_at: z.iso.datetime({ offset: true }),
  }),
);
export function canManageMember(
  actorRole: "agency_superadmin" | "admin",
  actorId: string,
  member: z.infer<typeof memberRowsSchema>[number],
) {
  return (
    member.user_id !== actorId &&
    member.role !== "agency_superadmin" &&
    (actorRole === "agency_superadmin" || member.role === "seller")
  );
}
