import { describe, expect, it } from "vitest";
import { loginSchema } from "./schemas";

describe("login input", () => {
  it("normalizes email and preserves the password verbatim", () => {
    expect(
      loginSchema.parse({
        email: "  user@example.test  ",
        password: " secret ",
      }),
    ).toEqual({
      email: "user@example.test",
      password: " secret ",
    });
  });
  it("rejects malformed or oversized inputs without imposing signup rules", () => {
    for (const input of [
      null,
      {},
      { email: "invalid", password: "a" },
      { email: "user@example.test", password: "" },
      { email: "user@example.test", password: "x".repeat(1025) },
    ]) {
      expect(loginSchema.safeParse(input).success).toBe(false);
    }
    expect(
      loginSchema.safeParse({ email: "user@example.test", password: "a" })
        .success,
    ).toBe(true);
  });
});
