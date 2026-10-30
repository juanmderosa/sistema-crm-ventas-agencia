import { expect, it } from "vitest";
import { memberStatusSchema } from "./schemas";
it("requires booleans, valid identity selectors and an actual transition", () => {
  const input = {
    agencyId: "e6200000-0000-4000-8000-000000000001",
    membershipId: "e6300000-0000-4000-8000-000000000003",
    isActive: false,
    expectedIsActive: true,
  };
  expect(memberStatusSchema.safeParse(input).success).toBe(true);
  expect(
    memberStatusSchema.safeParse({ ...input, isActive: "false" }).success,
  ).toBe(false);
  expect(
    memberStatusSchema.safeParse({ ...input, isActive: true }).success,
  ).toBe(false);
  expect(
    memberStatusSchema.safeParse({ ...input, agencyId: [input.agencyId] })
      .success,
  ).toBe(false);
});
