import { expect, it } from "vitest";
import { assignSuperadminSchema } from "./assignment-schemas";
it("requires agency and user UUIDs and discards client-owned roles and actor identifiers", () => {
  const valid = {
    agencyId: "d4400000-0000-4000-8000-000000000001",
    userId: "d3300000-0000-4000-8000-000000000002",
  };
  for (const value of [
    null,
    {},
    { ...valid, userId: "" },
    { ...valid, agencyId: [valid.agencyId] },
  ])
    expect(assignSuperadminSchema.safeParse(value).success).toBe(false);
  expect(
    assignSuperadminSchema.parse({
      ...valid,
      role: "platform_admin",
      actorId: valid.userId,
      isActive: false,
    }),
  ).toEqual(valid);
});
