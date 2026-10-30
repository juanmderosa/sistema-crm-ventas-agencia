"use server";
import { agencySettingsSchema } from "../settings-schemas";
import { getAgencyUserManagementAccess } from "@/features/user-invitations/server/authorization";
import { updateAgencySettings } from "./settings-queries";
export async function saveAgencySettings(input: unknown) {
  const parsed = agencySettingsSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false as const,
      error: "Revisá el nombre y la cotización de la agencia.",
    };
  const access = await getAgencyUserManagementAccess(parsed.data.agencyId);
  if (!access)
    return {
      ok: false as const,
      error: "No tenés permiso para editar esta agencia.",
    };
  return updateAgencySettings(access.client, parsed.data);
}
