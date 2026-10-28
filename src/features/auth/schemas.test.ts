import { describe, expect, it } from "vitest";
import {
  loginSchema,
  recoveryPasswordSchema,
  recoveryTokenSchema,
  recoveryOriginSchema,
  recoverySubmissionSchema,
} from "./schemas";

describe("password recovery boundary", () => {
  it("accepts only configured HTTPS or local HTTP origins without credentials or paths", () => {
    for (const origin of [
      undefined,
      "http://example.org",
      "https://example.org/",
      "https://example.org/path",
      "https://example.org?next=evil",
      "https://user:password@example.org",
      "javascript:alert(1)",
    ]) {
      expect(recoveryOriginSchema.safeParse(origin).success).toBe(false);
    }
    for (const origin of [
      "https://example.org",
      "http://127.0.0.1:3100",
      "http://localhost:3000",
    ]) {
      expect(recoveryOriginSchema.safeParse(origin).success).toBe(true);
    }
  });
  it("requires both the recovery proof and the shared password rules on server submissions", () => {
    expect(
      recoverySubmissionSchema.safeParse({
        password: "12345678",
        confirmation: "12345678",
      }).success,
    ).toBe(false);
    expect(
      recoverySubmissionSchema.safeParse({
        token: "a".repeat(56),
        password: "12345678",
        confirmation: "different",
      }).success,
    ).toBe(false);
    expect(
      recoverySubmissionSchema.safeParse({
        token: "a".repeat(56),
        password: "12345678",
        confirmation: "12345678",
      }).success,
    ).toBe(true);
  });
  it("requires eight characters and matching confirmation without trimming passwords", () => {
    expect(
      recoveryPasswordSchema.safeParse({
        password: "1234567",
        confirmation: "1234567",
      }).success,
    ).toBe(false);
    expect(
      recoveryPasswordSchema.safeParse({
        password: "12345678",
        confirmation: "different",
      }).success,
    ).toBe(false);
    expect(
      recoveryPasswordSchema.parse({
        password: " secret ",
        confirmation: " secret ",
      }).password,
    ).toBe(" secret ");
  });
  it("rejects absent, duplicate and malformed recovery tokens", () => {
    for (const token of [
      undefined,
      null,
      ["a".repeat(56)],
      "",
      "../login",
      "a".repeat(57),
    ]) {
      expect(recoveryTokenSchema.safeParse(token).success).toBe(false);
    }
    expect(recoveryTokenSchema.safeParse("a".repeat(56)).success).toBe(true);
  });
});

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
