"use server";

import { recoveryEmailSchema, recoverySubmissionSchema } from "../schemas";
import {
  sendRecoveryEmail,
  replacePasswordWithRecoveryToken,
} from "./recovery";
import { logout } from "./actions";

type RecoveryResult = { ok: true } | { ok: false; error: string };

export async function requestPasswordRecovery(
  input: unknown,
): Promise<RecoveryResult> {
  const parsed = recoveryEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ingresá un correo válido." };
  const { error } = await sendRecoveryEmail(parsed.data.email);
  if (error)
    return {
      ok: false,
      error:
        error.status === 429
          ? "Demasiados intentos. Esperá unos minutos y volvé a intentar."
          : "No pudimos solicitar el correo. Intentá nuevamente.",
    };
  return { ok: true };
}

export async function recoverPassword(input: unknown): Promise<RecoveryResult> {
  const parsed = recoverySubmissionSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error:
        "Revisá el enlace y las contraseñas. Usá al menos ocho caracteres.",
    };
  const result = await replacePasswordWithRecoveryToken(
    parsed.data.token,
    parsed.data.password,
  );
  if (result.error)
    return {
      ok: false,
      error:
        result.stage === "verification"
          ? "El enlace es inválido, venció o ya fue utilizado. Solicitá uno nuevo."
          : "No pudimos cambiar la contraseña. Usá una distinta de la anterior y solicitá un enlace nuevo.",
    };
  const signedOut = await logout();
  if (!signedOut.ok)
    return {
      ok: false,
      error:
        "La contraseña cambió, pero no pudimos cerrar la sesión de este navegador. Cerrá la sesión antes de ingresar nuevamente.",
    };
  return { ok: true };
}
