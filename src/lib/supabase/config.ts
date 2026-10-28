import "server-only";
import { z } from "zod";

const configSchema = z.object({
  url: z.url().refine((value) => {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)))
    );
  }),
  key: z.string().min(1),
});

export function getSupabaseConfig() {
  // Server-only runtime lookup: do not bake one environment's public config
  // into the server build. Tests and deployments supply their own values.
  const env = process.env;
  const result = configSchema.safeParse({
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!result.success)
    throw new Error("Falta configurar la conexión pública de Supabase.");
  // Accept publishable keys or legacy anonymous JWTs, never privileged keys.
  const { key, url } = result.data;
  let isPublic = key.startsWith("sb_publishable_");
  if (!isPublic) {
    try {
      const payload = key.split(".")[1];
      isPublic =
        payload !== undefined &&
        z
          .object({ role: z.literal("anon") })
          .safeParse(
            JSON.parse(atob(payload.replaceAll("-", "+").replaceAll("_", "/"))),
          ).success;
    } catch {
      isPublic = false;
    }
  }
  if (!isPublic)
    throw new Error(
      "Supabase requiere una clave pública; no uses claves privilegiadas.",
    );
  return { url, key };
}
