import { spawn } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  rmdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
import { z } from "zod";

const require = createRequire(import.meta.url);
let origin = process.env.APP_ORIGIN;
if (process.argv.includes("--e2e")) origin = "http://127.0.0.1:3100";
else if (process.argv.includes("--worker")) origin = "http://127.0.0.1:8787";
else if (!origin) {
  try {
    origin = readFileSync(".env.local", "utf8")
      .match(/^APP_ORIGIN=(.+)$/m)?.[1]
      ?.trim()
      .replace(/^['"]|['"]$/g, "");
  } catch {
    /* Validated below. */
  }
}
const parsed = z
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      value === url.origin &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)))
    );
  })
  .safeParse(origin);
if (!parsed.success) {
  console.error("Configurá APP_ORIGIN antes de iniciar las funciones locales.");
  process.exitCode = 1;
} else {
  const directory = mkdtempSync(join(tmpdir(), "dealership-functions-"));
  const envFile = join(directory, "function.env");
  // Only the public origin is written. Administrative keys are supplied by the local runtime.
  writeFileSync(envFile, `APP_ORIGIN=${parsed.data}\n`);
  const cli = join(
    dirname(require.resolve("supabase/package.json")),
    "dist/supabase.js",
  );
  const child = spawn(
    process.execPath,
    [cli, "functions", "serve", "--env-file", envFile],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let ready = false;
  let stopping = false;
  function announceStartup(data) {
    if (
      !ready &&
      /Serving functions|Serving Function|Started local/.test(data.toString())
    ) {
      ready = true;
      console.log(
        "Edge Function local iniciada. Las credenciales y logs de solicitudes no se imprimen.",
      );
    }
  }
  child.stdout.on("data", announceStartup);
  child.stderr.on("data", announceStartup);
  function cleanup() {
    try {
      unlinkSync(envFile);
      rmdirSync(directory);
    } catch {
      /* Only temporary nonsecret configuration. */
    }
  }
  child.on("error", () => {
    cleanup();
    console.error("No se pudo iniciar la función local.");
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    cleanup();
    if (!stopping && code !== 0)
      console.error(
        "La función local terminó con error. Revisá Docker y la configuración de Supabase.",
      );
    process.exitCode = code ?? 1;
  });
  process.on("SIGINT", () => {
    stopping = true;
    child.kill("SIGINT");
  });
  process.on("SIGTERM", () => {
    stopping = true;
    child.kill("SIGTERM");
  });
  console.log("Iniciando Edge Function local…");
}
