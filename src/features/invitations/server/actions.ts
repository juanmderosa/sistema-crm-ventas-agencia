"use server";
import { z } from "zod";
import { getPlatformAgencyAccess } from "@/features/agencies/server/authorization";
import { getCurrentUser } from "@/features/auth/server/session";
import { logout } from "@/features/auth/server/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createEphemeralAuthClient } from "@/lib/supabase/ephemeral";
import { acceptAgencyUserInvitation } from "@/features/user-invitations/server/queries";
import { inviteSuperadminSchema, acceptInvitationSchema } from "../schemas";
import {
  sendSuperadminInvitation,
  cancelSuperadminInvitation,
  acceptSuperadminInvitation,
} from "./queries";

export async function inviteSuperadmin(input: unknown) {
  const access = await getPlatformAgencyAccess();
  if (!access)
    return {
      ok: false as const,
      error: "No tenés permiso de plataforma para invitar.",
    };
  const parsed = inviteSuperadminSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false as const,
      error: "Revisá el nombre y el correo del invitado.",
    };
  return sendSuperadminInvitation(access.client, parsed.data);
}

export async function cancelInvitation(input: unknown) {
  const access = await getPlatformAgencyAccess();
  if (!access)
    return { ok: false as const, error: "No tenés permiso de plataforma." };
  const parsed = z.uuid().safeParse(input);
  if (!parsed.success)
    return { ok: false as const, error: "La invitación no es válida." };
  return cancelSuperadminInvitation(access.client, parsed.data);
}

export async function acceptInvitationWithPassword(input: unknown) {
  const parsed = acceptInvitationSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false as const,
      error:
        "Revisá el enlace y las contraseñas. Usá al menos ocho caracteres.",
    };
  const client = createEphemeralAuthClient();
  const verified = await client.auth.verifyOtp({
    token_hash: parsed.data.token,
    type: "invite",
  });
  if (verified.error)
    return {
      ok: false as const,
      error:
        "El enlace es inválido, venció o ya se usó. Si ya definiste contraseña, ingresá para completar la aceptación.",
    };
  let result: { ok: true } | { ok: false; error: string };
  try {
    const changed = await client.auth.updateUser({
      password: parsed.data.password,
    });
    result = changed.error
      ? {
          ok: false,
          error:
            "No se pudo definir la contraseña. Usá Recuperar contraseña y después ingresá para completar la aceptación desde este enlace.",
        }
      : parsed.data.kind === "agency-user"
        ? await acceptAgencyUserInvitation(client, parsed.data.invitationId)
        : await acceptSuperadminInvitation(client, parsed.data.invitationId);
  } finally {
    const signedOut = await client.auth.signOut({ scope: "local" });
    if (signedOut.error)
      throw new Error(
        "No se pudo cerrar la sesión temporal. Ingresá para revisar el estado de tu invitación.",
      );
  }
  if (!result.ok) return result;
  const signedOut = await logout();
  if (!signedOut.ok)
    return {
      ok: false as const,
      error:
        "La invitación se aceptó, pero no pudimos cerrar la sesión de este navegador. Cerrala antes de ingresar con la cuenta invitada.",
    };
  return { ok: true as const };
}

export async function resumeInvitation(input: unknown) {
  const parsed = z.uuid().safeParse(input);
  if (!parsed.success || !(await getCurrentUser()))
    return {
      ok: false as const,
      error: "Ingresá con la cuenta invitada y volvé a abrir este enlace.",
    };
  return acceptSuperadminInvitation(
    await createSupabaseServerClient(),
    parsed.data,
  );
}
