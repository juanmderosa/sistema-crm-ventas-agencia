"use server";

import { createAgencySchema } from "../schemas";
import { getPlatformAgencyAccess } from "./authorization";
import { insertPlatformAgency } from "./queries";

export async function createAgency(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getPlatformAgencyAccess();
  if (!access)
    return {
      ok: false,
      error:
        "No tenés permiso para crear agencias. Ingresá con una cuenta de plataforma habilitada.",
    };
  const parsed = createAgencySchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "Revisá el nombre, el identificador y la cotización.",
    };
  const result = await insertPlatformAgency(access.client, parsed.data);
  if (!result.ok) {
    if (result.code === "23505")
      return {
        ok: false,
        error: "Ya existe una agencia con ese identificador. Elegí otro.",
      };
    if (result.code === "42501")
      return {
        ok: false,
        error: "Tu acceso de plataforma ya no está habilitado.",
      };
    return {
      ok: false,
      error:
        "No pudimos crear la agencia. Recargá el listado antes de volver a intentar.",
    };
  }
  return { ok: true };
}
