import { expect, it } from "vitest";
import { agencyStatusSchema } from "./activation-schema";
it("requires a real boolean and a valid version and agency selector", () => {
  const input = {
    agencyId: "e2200000-0000-4000-8000-000000000001",
    isActive: false,
    expectedVersion: "e2400000-0000-4000-8000-000000000001",
  };
  expect(agencyStatusSchema.safeParse(input).success).toBe(true);
  expect(
    agencyStatusSchema.safeParse({ ...input, isActive: "false" }).success,
  ).toBe(false);
  expect(
    agencyStatusSchema.safeParse({ ...input, expectedVersion: undefined })
      .success,
  ).toBe(false);
  expect(
    agencyStatusSchema.safeParse({ ...input, agencyId: [input.agencyId] })
      .success,
  ).toBe(false);
});
