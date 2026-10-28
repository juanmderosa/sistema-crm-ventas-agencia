import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { getSupabaseConfig } from "./config";

export async function createSupabaseServerClient(writable = false) {
  const store = await cookies();
  const { url, key } = getSupabaseConfig();
  return createServerClient<Database>(url, key, {
    // Auth is server-owned in this increment; no browser Supabase client needs tokens.
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production" && url.startsWith("https:"),
    },
    cookies: {
      getAll: () => store.getAll(),
      // Server Components cannot write cookies. Proxy refreshes before rendering;
      // Server Actions opt in to persist login/logout. No swallowed write errors.
      ...(writable
        ? {
            setAll: (
              values: {
                name: string;
                value: string;
                options: import("@supabase/ssr").CookieOptions;
              }[],
            ) => {
              values.forEach(({ name, value, options }) =>
                store.set(name, value, options),
              );
            },
          }
        : {}),
    },
  });
}
