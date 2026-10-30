import { z } from "zod";

export const assignSuperadminSchema = z.object({
  agencyId: z.uuid("La agencia no es válida."),
  userId: z.uuid("Seleccioná un usuario."),
});
export type AssignSuperadminInput = z.infer<typeof assignSuperadminSchema>;
export const assignmentAgencySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  is_active: z.boolean(),
});
export const profileChoicesSchema = z.array(
  z.object({ id: z.uuid(), display_name: z.string().min(1) }),
);
