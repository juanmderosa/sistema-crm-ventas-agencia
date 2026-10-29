import { z } from "zod";
import {
  inviteSuperadminSchema,
  invitationRowsSchema,
} from "../invitations/schemas";
import { recoveryTokenSchema } from "../auth/schemas";
export const inviteAgencyUserSchema = inviteSuperadminSchema.extend({
  role: z.enum(["admin", "seller"]),
});
export type InviteAgencyUserInput = z.infer<typeof inviteAgencyUserSchema>;
export const agencyUserInvitationRowsSchema = z.array(
  invitationRowsSchema.element.extend({ role: z.enum(["admin", "seller"]) }),
);
export const existingInvitationProofSchema = z.object({
  invitationId: z.uuid(),
  token: recoveryTokenSchema,
});
