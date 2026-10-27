import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { z } from "zod";

// Discover local-only credentials without writing them to files or CI output.
const require = createRequire(import.meta.url);
const cli = join(
  dirname(require.resolve("supabase/package.json")),
  "dist/supabase.js",
);
const worker = process.argv.includes("--worker");
try {
  const status = z
    .object({
      API_URL: z
        .url()
        .refine((value) => new URL(value).hostname === "127.0.0.1"),
      ANON_KEY: z.string().min(1),
      SERVICE_ROLE_KEY: z.string().min(1),
    })
    .parse(
      JSON.parse(
        execFileSync(process.execPath, [cli, "status", "--output", "json"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        }),
      ),
    );
  const result = spawnSync(
    process.execPath,
    [
      require.resolve("@playwright/test/cli"),
      "test",
      ...process.argv.slice(2).filter((arg) => arg !== "--worker"),
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
        SUPABASE_TEST_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
        E2E_WORKER: worker ? "1" : "0",
        APP_ORIGIN: worker ? "http://127.0.0.1:8787" : "http://127.0.0.1:3100",
      },
    },
  );
  process.exitCode = result.status ?? 1;
} catch {
  console.error(
    "No se pudieron preparar las pruebas: verificá Supabase local y sus migraciones. No se imprimen credenciales.",
  );
  process.exitCode = 1;
}
