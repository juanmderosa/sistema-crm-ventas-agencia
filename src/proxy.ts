import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

export async function proxy(request: NextRequest) {
  const { url, key } = getSupabaseConfig();
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production" && url.startsWith("https:"),
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
      },
    },
  });
  // Validate/refresh before the Server Component reads the session. Authorization
  // remains at each server data boundary; this Proxy is not a permission gate.
  const { error } = await supabase.auth.getClaims();
  if (
    error &&
    error.name !== "AuthSessionMissingError" &&
    (!error.status || error.status >= 500)
  ) {
    return new NextResponse(
      "No se pudo verificar la sesión. Intentá nuevamente.",
      {
        status: 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export const config = { matcher: ["/login", "/cuenta/:path*"] };
