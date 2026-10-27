import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function isDocumentationOnly(paths) {
  return (
    paths.length > 0 &&
    paths.every((path) => /^(?:[^/]+\.md|docs\/.+\.md)$/.test(path))
  );
}

export function changedPaths(base, head, runGit = execFileSync) {
  for (const sha of [base, head]) {
    if (!/^[a-f0-9]{40}$/i.test(sha ?? "")) {
      throw new Error(
        "Change detection requires valid base and head commit SHAs.",
      );
    }
  }

  // Treat renames as deletion + addition so moving code into docs cannot skip tests.
  return runGit(
    "git",
    ["diff", "--no-renames", "--name-only", "-z", `${base}...${head}`, "--"],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean);
}

function main() {
  const paths =
    process.env.GITHUB_EVENT_NAME === "pull_request"
      ? changedPaths(process.env.PR_BASE_SHA, process.env.PR_HEAD_SHA)
      : [];
  // Manual executions always verify the complete application.
  const docsOnly = isDocumentationOnly(paths);
  const manifest = JSON.parse(readFileSync("package.json", "utf8"));
  const prettierVersion = manifest.devDependencies?.prettier;
  if (!/^\d+\.\d+\.\d+$/.test(prettierVersion ?? "")) {
    throw new Error(
      "The documentation check requires an exact Prettier version.",
    );
  }
  const output = `docs_only=${docsOnly}\nprettier_version=${prettierVersion}\n`;
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, output);
  }
  console.log(
    docsOnly
      ? "Documentation checks selected."
      : "Full application checks selected.",
  );
  console.log(output);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
