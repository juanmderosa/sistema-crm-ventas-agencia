"use server";
import { agencyStatusSchema } from "../activation-schema";
import { getPlatformAgencyAccess } from "./authorization";
import { setPlatformAgencyActive } from "./queries";
export async function changeAgencyStatus(input: unknown) {
  const parsed = agencyStatusSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false as const,
      error: "La solicitud no es válida. Recargá el listado.",
    };
  const access = await getPlatformAgencyAccess();
  if (!access)
    return {
      ok: false as const,
      error: "Tu acceso de plataforma no está habilitado.",
    };
  return setPlatformAgencyActive(access.client, parsed.data);
}
