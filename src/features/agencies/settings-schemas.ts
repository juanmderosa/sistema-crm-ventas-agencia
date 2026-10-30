import { z } from "zod";
import { createAgencySchema } from "./schemas";
export const agencySettingsSchema = createAgencySchema
  .pick({ name: true, arsPerUsd: true })
  .extend({ agencyId: z.uuid(), expectedVersion: z.uuid() });
export type AgencySettingsInput = z.input<typeof agencySettingsSchema>;
export type AgencySettingsValues = z.output<typeof agencySettingsSchema>;
export const agencySettingsRowSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  ars_per_usd: z.string().regex(/^\d+(\.\d+)?$/),
  settings_version: z.uuid(),
});
export const agencySettingsHistorySchema = z.array(
  z.object({
    id: z.uuid(),
    actor_id: z.uuid(),
    previous_name: z.string().min(1),
    new_name: z.string().min(1),
    previous_ars_per_usd: z.string().regex(/^\d+(\.\d+)?$/),
    new_ars_per_usd: z.string().regex(/^\d+(\.\d+)?$/),
    created_at: z.iso.datetime({ offset: true }),
  }),
);
