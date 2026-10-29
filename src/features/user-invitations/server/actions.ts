"use server";
import { z } from "zod";
import { getAgencyUserManagementAccess } from "./authorization";
import {
  inviteAgencyUserSchema,
  existingInvitationProofSchema,
} from "../schemas";
import {
  sendAgencyUserInvitation,
  cancelAgencyUserInvitation,
  acceptAgencyUserInvitation,
} from "./queries";
import { getCurrentUser } from "@/features/auth/server/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createEphemeralAuthClient } from "@/lib/supabase/ephemeral";
import { logout } from "@/features/auth/server/actions";

export async function inviteAgencyUser(input: unknown) {
  const parsed = inviteAgencyUserSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, error: "Revisá el nombre, correo y rol." };
  const access = await getAgencyUserManagementAccess(parsed.data.agencyId);
  if (
    !access ||
    (parsed.data.role === "admin" &&
      access.membership.role !== "agency_superadmin")
  )
    return {
      ok: false as const,
      error: "No tenés permiso para invitar con este rol en esta agencia.",
    };
  return sendAgencyUserInvitation(access.client, parsed.data);
}

export async function cancelAgencyUserInvite(input: unknown) {
  const parsed = z
    .object({ agencyId: z.uuid(), id: z.uuid() })
    .safeParse(input);
  if (!parsed.success)
    return { ok: false as const, error: "Invitación inválida." };
  const access = await getAgencyUserManagementAccess(parsed.data.agencyId);
  if (!access)
    return { ok: false as const, error: "No tenés permiso para cancelar." };
  // The RPC independently checks the invitation's actual agency and target role.
  return cancelAgencyUserInvitation(access.client, parsed.data.id);
}

export async function resumeAgencyUserInvitation(input: unknown) {
  const id = z.uuid().safeParse(input);
  if (!id.success || !(await getCurrentUser()))
    return {
      ok: false as const,
      error: "Ingresá con la cuenta invitada y volvé a abrir el enlace.",
    };
  return acceptAgencyUserInvitation(
    await createSupabaseServerClient(),
    id.data,
  );
}

export async function acceptExistingAgencyUserInvitation(input: unknown) {
  const proof = existingInvitationProofSchema.safeParse(input);
  if (!proof.success)
    return { ok: false as const, error: "El enlace no es válido." };

  const client = createEphemeralAuthClient();
  const verified = await client.auth.verifyOtp({
    token_hash: proof.data.token,
    type: "magiclink",
  });
  if (verified.error)
    return {
      ok: false as const,
      error:
        "El enlace venció o ya se usó. Ingresá con tu cuenta para completar la aceptación.",
    };
  let result;
  try {
    result = await acceptAgencyUserInvitation(client, proof.data.invitationId);
  } finally {
    const signedOut = await client.auth.signOut({ scope: "local" });
    if (signedOut.error)
      throw new Error("No se pudo cerrar la sesión temporal.");
  }
  if (!result.ok) return result;
  const signedOut = await logout();
  return signedOut.ok
    ? { ok: true as const }
    : {
        ok: false as const,
        error:
          "La invitación se aceptó. Cerrá la sesión actual antes de ingresar con la cuenta invitada.",
      };
}
