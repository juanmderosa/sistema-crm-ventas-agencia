import assert from "node:assert/strict";
import { test } from "node:test";
import { changedPaths, isDocumentationOnly } from "./ci-changes.mjs";

test("root Markdown and nested documentation use the lightweight checks", () => {
  assert.equal(
    isDocumentationOnly(["AGENTS.md", "README.md", "docs/crm/flow.md"]),
    true,
  );
});

test("mixed documentation and application changes require the full suite", () => {
  assert.equal(
    isDocumentationOnly(["docs/status.md", "src/app/page.tsx"]),
    false,
  );
});

test("configuration, dependencies, tests and unknown paths require the full suite", () => {
  for (const path of [
    ".github/workflows/quality.yml",
    ".github/scripts/ci-changes.mjs",
    "package-lock.json",
    "next.config.ts",
    "supabase/migrations/schema.sql",
    "tests/e2e/login.spec.ts",
    "docs/example.ts",
    "public/logo.png",
  ]) {
    assert.equal(isDocumentationOnly(["README.md", path]), false, path);
  }
});

test("empty change lists default to the full suite", () => {
  assert.equal(isDocumentationOnly([]), false);
});

test("deleted and added paths across a rename cannot conceal a code change", () => {
  const base = "a".repeat(40);
  const head = "b".repeat(40);
  const paths = changedPaths(base, head, (command, args) => {
    assert.equal(command, "git");
    assert.deepEqual(args, [
      "diff",
      "--no-renames",
      "--name-only",
      "-z",
      `${base}...${head}`,
      "--",
    ]);
    return "src/old.ts\0docs/new.md\0";
  });
  assert.equal(isDocumentationOnly(paths), false);
});

test("NUL-separated paths retain spaces and newlines", () => {
  const paths = changedPaths(
    "a".repeat(40),
    "b".repeat(40),
    () => "docs/with space.md\0src/with\nnewline.ts\0",
  );
  assert.deepEqual(paths, ["docs/with space.md", "src/with\nnewline.ts"]);
  assert.equal(isDocumentationOnly(paths), false);
});

test("missing or invalid revisions fail instead of reporting documentation only", () => {
  assert.throws(() => changedPaths(undefined, "b".repeat(40)));
  assert.throws(() => changedPaths("--help", "b".repeat(40)));
});

test("a failed Git comparison fails the check", () => {
  assert.throws(
    () =>
      changedPaths("a".repeat(40), "b".repeat(40), () => {
        throw new Error("Missing revision");
      }),
    /Missing revision/,
  );
});
