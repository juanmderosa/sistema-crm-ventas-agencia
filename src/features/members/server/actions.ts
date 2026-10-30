"use server";
import { memberStatusSchema, memberRoleSchema } from "../schemas";
import { getAgencyUserManagementAccess } from "@/features/user-invitations/server/authorization";
import { setAgencyMemberActive, setAgencyMemberRole } from "./queries";

export async function changeMemberRole(input: unknown) {
  const parsed = memberRoleSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false as const,
      error: "El cambio de rol no es válido. Recargá la lista.",
    };
  const access = await getAgencyUserManagementAccess(parsed.data.agencyId);
  if (!access || access.membership.role !== "agency_superadmin")
    return {
      ok: false as const,
      error: "Solo el superadministrador de esta agencia puede cambiar roles.",
    };
  return setAgencyMemberRole(access.client, parsed.data);
}

export async function changeMemberStatus(input: unknown) {
  const parsed = memberStatusSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false as const,
      error: "La solicitud no es válida. Recargá la lista.",
    };
  const access = await getAgencyUserManagementAccess(parsed.data.agencyId);
  if (!access)
    return {
      ok: false as const,
      error: "No tenés permiso para administrar esta agencia.",
    };
  return setAgencyMemberActive(access.client, parsed.data);
}
