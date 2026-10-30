import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import { z } from "zod";
import type { Database } from "../../src/lib/supabase/database.types";
import { test as base, loginThroughUI as submitLogin } from "./fixtures";
async function login(page: Page, identity: Parameters<typeof submitLogin>[1]) {
  await submitLogin(page, identity);
  await expect(page).toHaveURL(/\/(panel|plataforma)(\?|$)/);
}
function publicClient() {
  return createClient<Database>(
    z.url().parse(process.env.NEXT_PUBLIC_SUPABASE_URL),
    z.string().parse(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
const test = base.extend<{
  settings: {
    agency: string;
    otherAgency: string;
    seller: { id: string; email: string; password: string };
  };
}>({
  settings: async ({ provisioner, identity, otherIdentity }, provide) => {
    const agency = randomUUID(),
      otherAgency = randomUUID(),
      email = `settings-${randomUUID()}@example.test`,
      password = `${randomUUID()}!aA8`;
    const created = await provisioner.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw new Error("No se pudo preparar la identidad QA.");
    const seller = { id: created.data.user.id, email, password };
    try {
      const profile = await provisioner
        .from("profiles")
        .insert({ id: seller.id, display_name: "Vendedor ajustes QA" });
      const agencies = await provisioner.from("agencies").insert(
        [agency, otherAgency].map((id) => ({
          id,
          name: id === agency ? "Agencia QA ajustes" : "Agencia QA otra",
          slug: `qa-settings-${id}`,
          ars_per_usd: 1000,
        })),
      );
      const members = await provisioner.from("memberships").insert([
        { agency_id: agency, user_id: identity.id, role: "agency_superadmin" },
        { agency_id: agency, user_id: otherIdentity.id, role: "admin" },
        { agency_id: agency, user_id: seller.id, role: "seller" },
        { agency_id: otherAgency, user_id: seller.id, role: "admin" },
      ]);
      if (profile.error || agencies.error || members.error)
        throw new Error("No se pudo preparar la agencia QA.");
      await provide({ agency, otherAgency, seller });
    } finally {
      for (const table of [
        "audit_events",
        "agency_settings_history",
        "memberships",
      ] as const)
        if (
          (
            await provisioner
              .from(table)
              .delete()
              .in("agency_id", [agency, otherAgency])
          ).error
        )
          throw new Error("No se pudo retirar el fixture de ajustes.");
      const agencies = await provisioner
        .from("agencies")
        .delete()
        .in("id", [agency, otherAgency]);
      const platform = await provisioner
        .from("platform_admins")
        .delete()
        .eq("user_id", identity.id);
      const profile = await provisioner
        .from("profiles")
        .delete()
        .eq("id", seller.id);
      if (
        agencies.error ||
        platform.error ||
        profile.error ||
        (await provisioner.auth.admin.deleteUser(seller.id)).error
      )
        throw new Error("No se pudo retirar la identidad QA.");
    }
  },
});
test("admin edits name and exact rate with validated fields, linked audit and readable history", async ({
  page,
  otherIdentity,
  provisioner,
  settings,
}) => {
  await login(page, otherIdentity);
  await page.getByRole("link", { name: "Configurar agencia" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Configuración de agencia",
      exact: true,
    }),
  ).toBeVisible();
  const save = page.getByRole("button", {
    name: "Guardar configuración",
    exact: true,
  });
  await expect(save).toBeDisabled();
  await page.getByLabel("Nombre de la agencia").fill(" ");
  await page.getByLabel("Cotización ARS por USD").fill("0");
  await save.click();
  await expect(
    page.getByText("Ingresá el nombre.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("La cotización debe ser mayor que cero.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Nombre de la agencia").fill("Agencia editada QA");
  await page.getByLabel("Cotización ARS por USD").fill("999999999999,123456");
  await save.click();
  await expect(
    page.getByRole("heading", { name: "Agencia editada QA", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Cotización nueva: 999999999999.123456 ARS por USD", {
      exact: true,
    }),
  ).toBeVisible();
  const row = await provisioner
    .from("agencies")
    .select("settings_version,ars_per_usd::text,slug")
    .eq("id", settings.agency)
    .single();
  expect(row.data?.ars_per_usd).toBe("999999999999.123456");
  expect(row.data?.slug).toBe(`qa-settings-${settings.agency}`);
  const history = await provisioner
    .from("agency_settings_history")
    .select(
      "id,actor_id,previous_name,new_name,previous_ars_per_usd::text,new_ars_per_usd::text",
    )
    .eq("agency_id", settings.agency)
    .single();
  expect(history.data).toMatchObject({
    id: row.data?.settings_version,
    actor_id: otherIdentity.id,
    previous_name: "Agencia QA ajustes",
    new_name: "Agencia editada QA",
    previous_ars_per_usd: "1000.000000",
    new_ars_per_usd: "999999999999.123456",
  });
  const audit = await provisioner
    .from("audit_events")
    .select("actor_id,settings_change_id")
    .eq("agency_id", settings.agency)
    .eq("action", "agency.settings_updated")
    .single();
  expect(audit.data).toEqual({
    actor_id: otherIdentity.id,
    settings_change_id: history.data?.id,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("agency-settings.png"),
    fullPage: true,
  });
});
test("anonymous, seller, foreign agency and platform-only access are denied", async ({
  page,
  identity,
  provisioner,
  settings,
}) => {
  await page.goto(`/panel/agencia?agency=${settings.agency}`);
  await expect(page).toHaveURL(/\/login$/);
  await login(page, settings.seller);
  expect(
    (await page.goto(`/panel/agencia?agency=${settings.agency}`))?.status(),
  ).toBe(404);
  expect(
    (
      await page.goto(`/panel/agencia?agency=${settings.otherAgency}`)
    )?.status(),
  ).toBe(200);
  const client = publicClient();
  expect(
    (await client.auth.signInWithPassword(settings.seller)).error,
  ).toBeNull();
  expect(
    (await client.auth.updateUser({ data: { role: "agency_superadmin" } }))
      .error,
  ).toBeNull();
  const version = z
    .uuid()
    .parse(
      (
        await provisioner
          .from("agencies")
          .select("settings_version")
          .eq("id", settings.agency)
          .single()
      ).data?.settings_version,
    );
  const input = {
    p_agency_id: settings.agency,
    p_expected_version: version,
    p_name: "No guardar",
    p_ars_per_usd: "1500",
  };
  expect((await client.rpc("update_agency_settings", input)).error?.code).toBe(
    "42501",
  );
  expect(
    (
      await client
        .from("agency_settings_history")
        .select("id")
        .eq("agency_id", settings.agency)
    ).data,
  ).toHaveLength(0);
  await client.auth.signOut({ scope: "local" });
  await page.goto("/cuenta");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, identity);
  expect(
    (
      await page.goto(`/panel/agencia?agency=${settings.otherAgency}`)
    )?.status(),
  ).toBe(404);
  expect(
    (
      await provisioner
        .from("memberships")
        .update({ is_active: false })
        .eq("agency_id", settings.agency)
        .eq("user_id", identity.id)
    ).error,
  ).toBeNull();
  expect(
    (await provisioner.from("platform_admins").insert({ user_id: identity.id }))
      .error,
  ).toBeNull();
  expect(
    (await page.goto(`/panel/agencia?agency=${settings.agency}`))?.status(),
  ).toBe(404);
  expect((await client.auth.signInWithPassword(identity)).error).toBeNull();
  expect((await client.rpc("update_agency_settings", input)).error?.code).toBe(
    "42501",
  );
  await client.auth.signOut({ scope: "local" });
});
test("concurrent updates have one winner and old versions remain stale after restoring values", async ({
  identity,
  otherIdentity,
  provisioner,
  settings,
}) => {
  const owner = publicClient(),
    admin = publicClient();
  expect((await owner.auth.signInWithPassword(identity)).error).toBeNull();
  expect((await admin.auth.signInWithPassword(otherIdentity)).error).toBeNull();
  try {
    const version = z
      .uuid()
      .parse(
        (
          await provisioner
            .from("agencies")
            .select("settings_version")
            .eq("id", settings.agency)
            .single()
        ).data?.settings_version,
      );
    const results = await Promise.all([
      owner.rpc("update_agency_settings", {
        p_agency_id: settings.agency,
        p_expected_version: version,
        p_name: "Ganador A",
        p_ars_per_usd: "1100.000001",
      }),
      admin.rpc("update_agency_settings", {
        p_agency_id: settings.agency,
        p_expected_version: version,
        p_name: "Ganador B",
        p_ars_per_usd: "1200.000001",
      }),
    ]);
    expect(results.filter((result) => !result.error)).toHaveLength(1);
    expect(results.find((result) => result.error)?.error?.code).toBe("40001");
    expect(
      (
        await provisioner
          .from("agency_settings_history")
          .select("id")
          .eq("agency_id", settings.agency)
      ).data,
    ).toHaveLength(1);
    expect(
      (
        await provisioner
          .from("audit_events")
          .select("id")
          .eq("agency_id", settings.agency)
      ).data,
    ).toHaveLength(1);
    const current = z
      .uuid()
      .parse(
        (
          await provisioner
            .from("agencies")
            .select("settings_version")
            .eq("id", settings.agency)
            .single()
        ).data?.settings_version,
      );
    expect(
      (
        await owner.rpc("update_agency_settings", {
          p_agency_id: settings.agency,
          p_expected_version: current,
          p_name: "Agencia QA ajustes",
          p_ars_per_usd: "1000",
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await owner.rpc("update_agency_settings", {
          p_agency_id: settings.agency,
          p_expected_version: version,
          p_name: "No guardar",
          p_ars_per_usd: "1500",
        })
      ).error?.code,
    ).toBe("40001");
    expect(
      (
        await provisioner
          .from("agency_settings_history")
          .select("id")
          .eq("agency_id", settings.agency)
      ).data,
    ).toHaveLength(2);
  } finally {
    await owner.auth.signOut({ scope: "local" });
    await admin.auth.signOut({ scope: "local" });
  }
});
test("stale and revoked forms fail without overwriting another update", async ({
  page,
  identity,
  otherIdentity,
  provisioner,
  settings,
}) => {
  await login(page, identity);
  await page.goto(`/panel/agencia?agency=${settings.agency}`);
  await expect(
    page.getByRole("heading", {
      name: "Configuración de agencia",
      exact: true,
    }),
  ).toBeVisible();
  const client = publicClient();
  expect(
    (await client.auth.signInWithPassword(otherIdentity)).error,
  ).toBeNull();
  const version = z
    .uuid()
    .parse(
      (
        await provisioner
          .from("agencies")
          .select("settings_version")
          .eq("id", settings.agency)
          .single()
      ).data?.settings_version,
    );
  expect(
    (
      await client.rpc("update_agency_settings", {
        p_agency_id: settings.agency,
        p_expected_version: version,
        p_name: "Otra actualización",
        p_ars_per_usd: "2000",
      })
    ).error,
  ).toBeNull();
  await client.auth.signOut({ scope: "local" });
  await page.getByLabel("Cotización ARS por USD").fill("1500");
  await page
    .getByRole("button", { name: "Guardar configuración", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "La configuración cambió" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Otra actualización", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Cotización ARS por USD").fill("2100");
  expect(
    (
      await provisioner
        .from("memberships")
        .update({ is_active: false })
        .eq("agency_id", settings.agency)
        .eq("user_id", identity.id)
    ).error,
  ).toBeNull();
  await page
    .getByRole("button", { name: "Guardar configuración", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "No tenés permiso" }),
  ).toBeVisible();
  expect(
    (
      await provisioner
        .from("agency_settings_history")
        .select("id")
        .eq("agency_id", settings.agency)
    ).data,
  ).toHaveLength(1);
  expect((await page.reload())?.status()).toBe(404);
});
test("history paginates and rejects duplicate or invalid selectors", async ({
  page,
  identity,
  provisioner,
  settings,
}) => {
  expect(
    (
      await provisioner.from("agency_settings_history").insert(
        Array.from({ length: 21 }, (_, n) => ({
          agency_id: settings.agency,
          actor_id: identity.id,
          previous_name: "Antes",
          new_name: `Después ${n}`,
          previous_ars_per_usd: 1000,
          new_ars_per_usd: 1100,
        })),
      )
    ).error,
  ).toBeNull();
  await login(page, identity);
  await page.goto(`/panel/agencia?agency=${settings.agency}`);
  await expect(page.getByRole("listitem")).toHaveCount(20);
  await page.getByRole("link", { name: "Siguiente", exact: true }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  for (const query of [
    "agency=bad",
    `agency=${settings.agency}&agency=${settings.agency}`,
    `agency=${settings.agency}&page=0`,
    `agency=${settings.agency}&page=1&page=2`,
  ])
    expect((await page.goto(`/panel/agencia?${query}`))?.status()).toBe(404);
});
