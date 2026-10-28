import { describe, expect, it } from "vitest";
import { createAgencySchema } from "./schemas";

describe("agency creation", () => {
  it("normalizes human input without converting the exchange rate to floating point", () => {
    expect(
      createAgencySchema.parse({
        name: " Agencia QA ",
        slug: " QA-Nueva ",
        arsPerUsd: "1000,123456",
      }),
    ).toEqual({
      name: "Agencia QA",
      slug: "qa-nueva",
      arsPerUsd: "1000.123456",
    });
    expect(
      createAgencySchema.parse({
        name: "A",
        slug: "a",
        arsPerUsd: "999999999999.999999",
      }).arsPerUsd,
    ).toBe("999999999999.999999");
  });
  it("rejects invalid names, slugs, nonpositive rates, excess precision and oversized values", () => {
    const valid = { name: "Agencia", slug: "agencia", arsPerUsd: "1000" };
    for (const input of [
      null,
      {},
      { ...valid, name: " " },
      { ...valid, name: "a".repeat(161) },
      { ...valid, slug: "a".repeat(81) },
      { ...valid, slug: "../otra" },
      { ...valid, slug: "agencia--qa" },
    ])
      expect(createAgencySchema.safeParse(input).success).toBe(false);
    for (const arsPerUsd of [
      "0",
      "0.000000",
      "-1",
      "NaN",
      "Infinity",
      "1e3",
      "1.1234567",
      "1000000000000",
      "1,000.50",
      "",
      1000,
    ])
      expect(
        createAgencySchema.safeParse({ ...valid, arsPerUsd }).success,
      ).toBe(false);
  });
});
