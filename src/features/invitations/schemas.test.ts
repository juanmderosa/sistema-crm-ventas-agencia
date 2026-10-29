import { expect, it } from "vitest";
import { inviteSuperadminSchema, acceptInvitationSchema } from "./schemas";
it("normalizes invitation identity and rejects role/actor ownership from callers", () => {
  const agencyId = "f2200000-0000-4000-8000-000000000001";
  expect(
    inviteSuperadminSchema.parse({
      agencyId,
      email: " QA@Example.test ",
      displayName: " Nombre QA ",
      role: "platform_admin",
      invitedBy: agencyId,
    }),
  ).toEqual({ agencyId, email: "qa@example.test", displayName: "Nombre QA" });
  for (const input of [
    null,
    {},
    { agencyId, email: "bad", displayName: "QA" },
    { agencyId, email: "qa@example.test", displayName: " " },
  ])
    expect(inviteSuperadminSchema.safeParse(input).success).toBe(false);
});
it("requires the invitation proof and matching eight-character passwords", () => {
  const valid = {
    invitationId: "f2200000-0000-4000-8000-000000000001",
    token: "a".repeat(56),
    password: "password8",
    confirmation: "password8",
  };
  expect(acceptInvitationSchema.safeParse(valid).success).toBe(true);
  for (const input of [
    { ...valid, token: "invalid" },
    { ...valid, invitationId: "bad" },
    { ...valid, password: "short", confirmation: "short" },
    { ...valid, confirmation: "different" },
  ])
    expect(acceptInvitationSchema.safeParse(input).success).toBe(false);
});
