import { z } from "zod";
import { recoveryPasswordSchema, recoveryTokenSchema } from "../auth/schemas";

export const inviteSuperadminSchema = z.object({
  agencyId: z.uuid(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email("Ingresá un correo válido.")),
  displayName: z
    .string()
    .trim()
    .min(1, "Ingresá el nombre.")
    .max(160, "Usá hasta 160 caracteres."),
});
export type InviteSuperadminInput = z.infer<typeof inviteSuperadminSchema>;
export const acceptInvitationSchema = recoveryPasswordSchema.safeExtend({
  invitationId: z.uuid(),
  token: recoveryTokenSchema,
});
export const invitationRowsSchema = z.array(
  z.object({
    id: z.uuid(),
    email: z.email(),
    display_name: z.string().min(1),
    status: z.enum(["sending", "sent", "failed", "accepted", "cancelled"]),
    expires_at: z.iso.datetime({ offset: true }),
    created_at: z.iso.datetime({ offset: true }),
  }),
);
export const invitationStatusLabels = {
  sending: "Envío sin confirmar",
  sent: "Enviada",
  failed: "No enviada",
  accepted: "Aceptada",
  cancelled: "Cancelada",
};
