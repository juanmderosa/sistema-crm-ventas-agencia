import { expect, it } from "vitest";
import { agencySettingsSchema } from "./settings-schemas";
it("retains exact decimals while normalizing human input", () => {
  const input = {
    agencyId: "e4200000-0000-4000-8000-000000000001",
    expectedVersion: "e4400000-0000-4000-8000-000000000001",
    name: " Agencia ",
    arsPerUsd: "999999999999,123456",
  };
  expect(agencySettingsSchema.parse(input)).toEqual({
    ...input,
    name: "Agencia",
    arsPerUsd: "999999999999.123456",
  });
  for (const arsPerUsd of [
    "0",
    "NaN",
    "1e3",
    "1.1234567",
    "1000000000000",
    1000,
  ])
    expect(
      agencySettingsSchema.safeParse({ ...input, arsPerUsd }).success,
    ).toBe(false);
  expect(
    agencySettingsSchema.safeParse({ ...input, expectedVersion: undefined })
      .success,
  ).toBe(false);
  expect(
    agencySettingsSchema.safeParse({ ...input, agencyId: [input.agencyId] })
      .success,
  ).toBe(false);
});
