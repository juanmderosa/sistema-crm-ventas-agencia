import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test as base } from "@playwright/test";
import { z } from "zod";
import type { Database } from "../../src/lib/supabase/database.types";

type Identity = { email: string; password: string; id: string };
type Provisioner = SupabaseClient<Database>;

async function withIdentity(
  admin: Provisioner,
  provide: (identity: Identity) => Promise<void>,
) {
  const email = `auth-${randomUUID()}@example.test`;
  const password = `${randomUUID()}!aA7`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user)
    throw new Error("No se pudo crear la identidad sintética de prueba.");
  const id = data.user.id;
  try {
    const { error: profileError } = await admin
      .from("profiles")
      .insert({ id, display_name: "Usuario de prueba" });
    if (profileError)
      throw new Error("No se pudo preparar el perfil sintético.");
    await provide({ email, password, id });
  } finally {
    const { error: profileError } = await admin
      .from("profiles")
      .delete()
      .eq("id", id);
    if (profileError)
      throw new Error("No se pudo retirar el perfil sintético.");
    const { error: userError } = await admin.auth.admin.deleteUser(id);
    if (userError)
      throw new Error("No se pudo retirar la identidad sintética.");
  }
}

export const test = base.extend<{
  provisioner: Provisioner;
  identity: Identity;
  otherIdentity: Identity;
}>({
  provisioner: async ({}, provide) => {
    const env = z
      .object({
        NEXT_PUBLIC_SUPABASE_URL: z
          .url()
          .refine((url) => new URL(url).hostname === "127.0.0.1"),
        SUPABASE_TEST_SERVICE_ROLE_KEY: z.string().min(1),
      })
      .parse(process.env);
    await provide(
      createClient<Database>(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.SUPABASE_TEST_SERVICE_ROLE_KEY,
        {
          auth: { persistSession: false, autoRefreshToken: false },
        },
      ),
    );
  },
  identity: async ({ provisioner }, provide) =>
    withIdentity(provisioner, provide),
  otherIdentity: async ({ provisioner }, provide) =>
    withIdentity(provisioner, provide),
});

export async function loginThroughUI(
  page: import("@playwright/test").Page,
  identity: Identity,
) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(identity.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(identity.password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
}
