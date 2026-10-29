import { describe, expect, it } from "vitest";
import { inviteAgencyUserSchema } from "./schemas";
describe("agency user invitations", () => {
  const input = {
    agencyId: "ea100000-0000-4000-8000-000000000001",
    email: " QA@example.test ",
    displayName: " QA ",
    role: "seller",
  };
  it("normalizes the recipient", () => {
    expect(inviteAgencyUserSchema.parse(input).email).toBe("qa@example.test");
  });
  it("rejects owner roles and invalid agency selectors", () => {
    expect(
      inviteAgencyUserSchema.safeParse({ ...input, role: "agency_superadmin" })
        .success,
    ).toBe(false);
    expect(
      inviteAgencyUserSchema.safeParse({ ...input, agencyId: [input.agencyId] })
        .success,
    ).toBe(false);
  });
});
