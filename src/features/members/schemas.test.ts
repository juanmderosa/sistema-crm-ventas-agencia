import { expect, it } from "vitest";
import { memberStatusSchema, memberRoleSchema } from "./schemas";
it("allows only an actual admin/seller transition with an explicit expected state", () => {
  const input = {
    agencyId: "e7200000-0000-4000-8000-000000000001",
    membershipId: "e7300000-0000-4000-8000-000000000003",
    role: "admin",
    expectedRole: "seller",
    expectedIsActive: false,
  };
  expect(memberRoleSchema.safeParse(input).success).toBe(true);
  expect(
    memberRoleSchema.safeParse({ ...input, role: "agency_superadmin" }).success,
  ).toBe(false);
  expect(memberRoleSchema.safeParse({ ...input, role: "seller" }).success).toBe(
    false,
  );
  expect(
    memberRoleSchema.safeParse({ ...input, expectedIsActive: "false" }).success,
  ).toBe(false);
  expect(
    memberRoleSchema.safeParse({ ...input, expectedRole: null }).success,
  ).toBe(false);
});
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
