import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";

const check = process.argv.includes("--check");
const root = fileURLToPath(new URL("../", import.meta.url));
const target = join(root, "src/lib/supabase/database.types.ts");
const require = createRequire(import.meta.url);
const cli = join(
  dirname(require.resolve("supabase/package.json")),
  "dist/supabase.js",
);

try {
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [cli, "gen", "types", "typescript", "--local", "--schema", "public"],
    { cwd: root, maxBuffer: 10 * 1024 * 1024 },
  );
  if (!stdout.includes("export type Database =")) {
    throw new Error(
      "Supabase no devolvió los tipos de base de datos esperados.",
    );
  }
  const generated = await format(
    "// Generated from migrated local Supabase. Run npm run db:types; do not edit.\n" +
      stdout,
    { ...(await resolveConfig(target)), filepath: target },
  );
  if (check) {
    const current = await readFile(target, "utf8");
    if (current.replaceAll("\r\n", "\n") !== generated) {
      throw new Error(
        "Tipos desactualizados: ejecutá npm run db:types y versioná el resultado.",
      );
    }
    console.log("Los tipos coinciden con Supabase local.");
  } else {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, generated, "utf8");
    console.log("Tipos generados en src/lib/supabase/database.types.ts.");
  }
} catch (error) {
  // CLI output can contain connection details. Do not forward stdout/stderr.
  console.error(
    error instanceof Error && !("cmd" in error)
      ? error.message
      : "No se pudieron generar los tipos. Verificá que Supabase local esté iniciado y migrado.",
  );
  process.exitCode = 1;
}
