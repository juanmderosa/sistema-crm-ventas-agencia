import { describe, expect, it } from "vitest";
import { privateQueryKey } from "./keys";

describe("private cache isolation", () => {
  it("separates identical resources by agency and authenticated user", () => {
    const first = privateQueryKey("user-1", "agency-1", "vehicles");
    expect(first).not.toEqual(
      privateQueryKey("user-1", "agency-2", "vehicles"),
    );
    expect(first).not.toEqual(
      privateQueryKey("user-2", "agency-1", "vehicles"),
    );
  });

  it("rejects a missing identity instead of creating an unscoped cache entry", () => {
    expect(() => privateQueryKey("", "agency-1", "vehicles")).toThrow();
    expect(() => privateQueryKey("user-1", " ", "vehicles")).toThrow();
  });
});
