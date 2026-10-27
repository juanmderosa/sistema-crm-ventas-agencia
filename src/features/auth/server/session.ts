import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (
    error &&
    error.name !== "AuthSessionMissingError" &&
    (!error.status || error.status >= 500)
  ) {
    throw new Error("No se pudo verificar la sesión. Intentá nuevamente.");
  }
  return data.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
