"use server";
import { memberStatusSchema } from "../schemas";
import { getAgencyUserManagementAccess } from "@/features/user-invitations/server/authorization";
import { setAgencyMemberActive } from "./queries";

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
