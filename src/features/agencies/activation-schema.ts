import { z } from "zod";
export const agencyStatusSchema = z.object({
  agencyId: z.uuid(),
  isActive: z.boolean(),
  expectedVersion: z.uuid(),
});
export type AgencyStatusInput = z.infer<typeof agencyStatusSchema>;
