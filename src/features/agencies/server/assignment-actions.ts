"use server";
import { assignSuperadminSchema } from "../assignment-schemas";
import { getPlatformAgencyAccess } from "./authorization";
import { assignInitialSuperadmin } from "./assignment-queries";

export async function assignAgencySuperadmin(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getPlatformAgencyAccess();
  if (!access)
    return {
      ok: false,
      error: "No tenés permiso de plataforma para asignar responsables.",
    };

  const parsed = assignSuperadminSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Revisá la agencia y el usuario seleccionado." };

  const result = await assignInitialSuperadmin(access.client, parsed.data);
  if (result.ok) return result;

  const errors: Record<string, string> = {
    "42501": "Tu acceso de plataforma ya no está habilitado.",
    P0001:
      "La agencia ya tiene una asignación de superadministrador. No se modificó.",
    P0002:
      "La agencia está inactiva, no existe o el usuario no tiene un perfil disponible.",
    "23505": "El usuario ya pertenece a esta agencia. Su rol no se modificó.",
  };

  return {
    ok: false,
    error:
      errors[result.code] ??
      "No pudimos confirmar la asignación. Recargá la agencia antes de reintentar.",
  };
}
