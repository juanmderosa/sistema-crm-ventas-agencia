import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { recoveryOriginSchema } from "../schemas";

// No cookies or browser storage: a recovery token cannot install a panel session.
export function createRecoveryClient() {
  const { url, key } = getSupabaseConfig();
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function getRecoveryRedirect() {
  const env = process.env;
  const parsed = recoveryOriginSchema.safeParse(env.APP_ORIGIN);
  if (!parsed.success)
    throw new Error(
      "Configurá APP_ORIGIN con el origen público de la aplicación.",
    );
  // Never use a Host header, submitted redirect or `next` query parameter.
  return `${parsed.data}/recuperar/confirmar`;
}

export async function sendRecoveryEmail(email: string) {
  return createRecoveryClient().auth.resetPasswordForEmail(email, {
    redirectTo: getRecoveryRedirect(),
  });
}

export async function replacePasswordWithRecoveryToken(
  token: string,
  password: string,
) {
  const client = createRecoveryClient();
  const { error: verificationError } = await client.auth.verifyOtp({
    token_hash: token,
    type: "recovery",
  });
  if (verificationError)
    return { stage: "verification" as const, error: verificationError };
  try {
    const { error } = await client.auth.updateUser({ password });
    return { stage: "password" as const, error };
  } finally {
    // Supabase invalidates the temporary refresh token; tokens never leave this request.
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error)
      throw new Error(
        "No se pudo cerrar la sesión temporal de recuperación. Solicitá un enlace nuevo.",
      );
  }
}
