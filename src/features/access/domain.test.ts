import { describe, expect, it } from "vitest";
import { resolveAgencyAccess } from "./domain";

const first = {
  agency: { id: "10000000-0000-4000-8000-000000000001", name: "Agencia A" },
  role: "admin" as const,
};
const second = {
  agency: { id: "10000000-0000-4000-8000-000000000002", name: "Agencia B" },
  role: "seller" as const,
};

describe("agency selection from authorized memberships", () => {
  it("distinguishes no access, single entry and a required choice", () => {
    expect(resolveAgencyAccess([], undefined)).toEqual({ kind: "none" });
    expect(resolveAgencyAccess([first], undefined)).toEqual({
      kind: "agency",
      membership: first,
    });
    expect(resolveAgencyAccess([first, second], undefined)).toEqual({
      kind: "choose",
    });
  });
  it("accepts only an authorized agency and preserves its independent role", () => {
    expect(resolveAgencyAccess([first, second], second.agency.id)).toEqual({
      kind: "agency",
      membership: second,
    });
    expect(resolveAgencyAccess([first], second.agency.id)).toEqual({
      kind: "denied",
    });
    expect(resolveAgencyAccess([], first.agency.id)).toEqual({
      kind: "denied",
    });
  });
  it("rejects malformed, duplicate and empty selectors rather than falling back", () => {
    for (const selector of [
      "",
      "invalid",
      [first.agency.id, second.agency.id],
      null,
      42,
    ]) {
      expect(resolveAgencyAccess([first], selector)).toEqual({
        kind: "denied",
      });
    }
  });
});
