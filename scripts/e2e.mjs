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
let preparation = "Supabase local y sus migraciones";
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
  preparation = `la Edge Function local: npm run functions:serve -- ${worker ? "--worker" : "--e2e"}`;
  let functionReady = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(
        `${status.API_URL}/functions/v1/invite-agency-superadmin`,
        { method: "POST", body: "{}", signal: AbortSignal.timeout(3000) },
      );
      const body = await response.json();
      if (
        response.status === 401 &&
        z
          .object({
            ok: z.literal(false),
            error: z.literal("Ingresá nuevamente."),
          })
          .safeParse(body).success
      ) {
        functionReady = true;
        break;
      }
    } catch {
      /* The local runtime can still be downloading its pinned dependencies. */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!functionReady) throw new Error("Local invitation function unavailable");
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
    `No se pudieron preparar las pruebas: verificá ${preparation}. No se imprimen credenciales.`,
  );
  process.exitCode = 1;
}
