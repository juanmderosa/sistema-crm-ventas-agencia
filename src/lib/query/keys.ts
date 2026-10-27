/** Cache separation is defense in depth; database RLS remains authoritative. */
export function privateQueryKey(
  userId: string,
  agencyId: string,
  resource: string,
) {
  if (!userId.trim() || !agencyId.trim() || !resource.trim()) {
    throw new Error("Private query keys require a user, agency and resource.");
  }

  return ["private", userId, agencyId, resource] as const;
}
