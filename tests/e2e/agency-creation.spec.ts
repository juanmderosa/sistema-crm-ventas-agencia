import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect } from "@playwright/test";
import { z } from "zod";
import type { Database } from "../../src/lib/supabase/database.types";
import { test as base, loginThroughUI } from "./fixtures";

const test = base.extend<{
  agencySetup: { slug: string; raceSlug: string; seedSlugs: string[] };
}>({
  agencySetup: async ({ provisioner, identity }, provide) => {
    const slug = `qa-create-${randomUUID()}`;
    const raceSlug = `qa-race-${randomUUID()}`;
    const seedSlugs = Array.from(
      { length: 21 },
      () => `qa-page-${randomUUID()}`,
    );
    const { error } = await provisioner
      .from("platform_admins")
      .insert({ user_id: identity.id });
    if (error) throw new Error("No se pudo preparar plataforma.");
    try {
      await provide({ slug, raceSlug, seedSlugs });
    } finally {
      const audit = await provisioner
        .from("audit_events")
        .delete()
        .eq("actor_id", identity.id);
      if (audit.error)
        throw new Error("No se pudo retirar la auditoría sintética.");
      const agencies = await provisioner
        .from("agencies")
        .delete()
        .in("slug", [slug, raceSlug, ...seedSlugs]);
      if (agencies.error)
        throw new Error("No se pudieron retirar las agencias sintéticas.");
      const platform = await provisioner
        .from("platform_admins")
        .delete()
        .eq("user_id", identity.id);
      if (platform.error)
        throw new Error("No se pudo retirar plataforma sintética.");
    }
  },
});

test("platform creates an audited agency, validates decimals, rejects duplicate and revoked submissions", async ({
  page,
  identity,
  provisioner,
  agencySetup,
}, testInfo) => {
  await loginThroughUI(page, identity);
  await expect(page).toHaveURL(/\/plataforma$/);
  await page.getByRole("link", { name: "Administrar agencias" }).click();
  await expect(
    page.getByRole("heading", { name: "Agencias", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Crear agencia", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Crear agencia", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Crear agencia", exact: true })
    .click();
  await expect(
    page.getByText("Ingresá el nombre.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Nombre de la agencia")).toBeFocused();
  await page
    .getByLabel("Nombre de la agencia")
    .fill("Agencia creada en prueba");
  await page.getByLabel("Identificador (slug)").fill(agencySetup.slug);
  await page.getByLabel("Cotización ARS por USD").fill("0");
  await page
    .getByRole("button", { name: "Crear agencia", exact: true })
    .click();
  await expect(
    page.getByText("La cotización debe ser mayor que cero.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Cotización ARS por USD").fill("1000,123456");
  await page.screenshot({
    path: testInfo.outputPath("create-agency.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Crear agencia", exact: true })
    .click();
  await expect(page).toHaveURL(/\/plataforma\/agencias$/);
  const card = page.getByRole("listitem").filter({ hasText: agencySetup.slug });
  await expect(card).toContainText("Agencia creada en prueba");
  await expect(card).toContainText("1000.123456");
  await expect(card).toContainText("Activa");
  const created = await provisioner
    .from("agencies")
    .select("id")
    .eq("slug", agencySetup.slug)
    .single();
  if (created.error) throw new Error("Falta la agencia creada.");
  const audit = await provisioner
    .from("audit_events")
    .select("actor_id,action")
    .eq("agency_id", created.data.id);
  expect(audit.error).toBeNull();
  expect(audit.data).toEqual([
    { actor_id: identity.id, action: "agency.created" },
  ]);
  await page.getByRole("link", { name: "Crear agencia", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Crear agencia", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Nombre de la agencia").fill("Duplicada");
  await page.getByLabel("Identificador (slug)").fill(agencySetup.slug);
  await page.getByLabel("Cotización ARS por USD").fill("1");
  await page
    .getByRole("button", { name: "Crear agencia", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: /Ya existe/ }),
  ).toContainText("Ya existe una agencia");
  await page.getByLabel("Identificador (slug)").fill(agencySetup.raceSlug);
  const revoked = await provisioner
    .from("platform_admins")
    .update({ is_active: false })
    .eq("user_id", identity.id);
  if (revoked.error) throw new Error("No se pudo revocar plataforma.");
  await page
    .getByRole("button", { name: "Crear agencia", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: /No tenés permiso/ }),
  ).toBeVisible();
  const absent = await provisioner
    .from("agencies")
    .select("id")
    .eq("slug", agencySetup.raceSlug);
  expect(absent.data).toEqual([]);
  const response = await page.goto("/plataforma/agencias");
  expect(response?.status()).toBe(404);
});

test("anonymous and ordinary users cannot enter agency administration or call its creation RPC", async ({
  page,
  otherIdentity,
  agencySetup,
}) => {
  for (const route of ["/plataforma/agencias", "/plataforma/agencias/nueva"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
  }
  await loginThroughUI(page, otherIdentity);
  await expect(page).toHaveURL(/\/panel$/);
  for (const route of ["/plataforma/agencias", "/plataforma/agencias/nueva"]) {
    const response = await page.goto(route + "?role=platform_admin");
    expect(response?.status()).toBe(404);
  }
  const env = z
    .object({
      NEXT_PUBLIC_SUPABASE_URL: z.url(),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string(),
    })
    .parse(process.env);
  const client = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const values = {
    p_name: "Denegada",
    p_slug: agencySetup.slug,
    p_ars_per_usd: "1000",
  };
  expect((await client.rpc("create_agency", values)).error?.code).toBe("42501");
  const login = await client.auth.signInWithPassword(otherIdentity);
  if (login.error) throw new Error("No se pudo ingresar como usuario común.");
  expect((await client.rpc("create_agency", values)).error?.code).toBe("42501");
  await client.auth.signOut();
});

test("concurrent creation keeps one agency and one audit event; listing paginates and validates selectors", async ({
  page,
  identity,
  provisioner,
  agencySetup,
}) => {
  const env = z
    .object({
      NEXT_PUBLIC_SUPABASE_URL: z.url(),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string(),
    })
    .parse(process.env);
  const client = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const login = await client.auth.signInWithPassword(identity);
  if (login.error) throw new Error("No se pudo ingresar como plataforma.");
  const values = {
    p_name: "Alta simultánea QA",
    p_slug: agencySetup.raceSlug,
    p_ars_per_usd: "999999999999.999999",
  };
  const attempts = await Promise.all([
    client.rpc("create_agency", values),
    client.rpc("create_agency", values),
  ]);
  expect(attempts.filter((result) => result.error === null)).toHaveLength(1);
  expect(attempts.find((result) => result.error)?.error?.code).toBe("23505");
  const audit = await provisioner
    .from("audit_events")
    .select("id")
    .eq("actor_id", identity.id);
  expect(audit.data).toHaveLength(1);
  await client.auth.signOut();
  const seeded = await provisioner.from("agencies").insert(
    agencySetup.seedSlugs.map((slug, i) => ({
      name: `Agencia de paginación ${i}`,
      slug,
      ars_per_usd: 1000,
      is_active: i !== 0,
    })),
  );
  if (seeded.error) throw new Error("No se pudo preparar la paginación.");
  await loginThroughUI(page, identity);
  await expect(page).toHaveURL(/\/plataforma$/);
  await page.goto("/plataforma/agencias");
  await expect(page.getByRole("listitem")).toHaveCount(20);
  await page.getByRole("link", { name: "Siguiente", exact: true }).click();
  await expect(page).toHaveURL(/page=2$/);
  await expect(
    page.getByRole("link", { name: "Anterior", exact: true }),
  ).toBeVisible();
  for (const query of ["page=0", "page=abc", "page=1&page=2"]) {
    await page.goto(`/plataforma/agencias?${query}`);
    await expect(
      page.getByRole("alert").filter({ hasText: /página solicitada/ }),
    ).toBeVisible();
  }
});
