"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginSchema } from "../schemas";

type AuthResult = { ok: true } | { ok: false; error: string };

export async function login(input: unknown): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Revisá el correo y la contraseña." };
  const supabase = await createSupabaseServerClient(true);
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "invalid_credentials")
      return { ok: false, error: "El correo o la contraseña son incorrectos." };
    if (error.status === 429)
      return {
        ok: false,
        error: "Demasiados intentos. Esperá unos minutos y volvé a intentar.",
      };
    return {
      ok: false,
      error: "No pudimos iniciar sesión. Intentá nuevamente.",
    };
  }
  return { ok: true };
}

export async function logout(): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient(true);
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error)
    return {
      ok: false,
      error: "No pudimos cerrar la sesión. Intentá nuevamente.",
    };
  return { ok: true };
}
