import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import { z } from "zod";
import type { Database } from "../../src/lib/supabase/database.types";
import { test as base, loginThroughUI } from "./fixtures";

const test = base.extend<{ assignmentAgency: string }>({
  assignmentAgency: async ({ provisioner, identity }, provide) => {
    const id = randomUUID();
    const agency = await provisioner.from("agencies").insert({
      id,
      name: "Agencia QA responsable",
      slug: `qa-owner-${id}`,
      ars_per_usd: 1000,
    });
    if (agency.error) throw new Error("No se pudo preparar la agencia.");
    const platform = await provisioner
      .from("platform_admins")
      .insert({ user_id: identity.id });
    if (platform.error) throw new Error("No se pudo preparar plataforma.");
    try {
      await provide(id);
    } finally {
      const audit = await provisioner
        .from("audit_events")
        .delete()
        .eq("agency_id", id);
      const memberships = await provisioner
        .from("memberships")
        .delete()
        .eq("agency_id", id);
      const agency = await provisioner.from("agencies").delete().eq("id", id);
      const platform = await provisioner
        .from("platform_admins")
        .delete()
        .eq("user_id", identity.id);
      if (audit.error || memberships.error || agency.error || platform.error)
        throw new Error("No se pudieron retirar los fixtures de asignación.");
    }
  },
});

async function selectExistingUser(page: Page, id: string) {
  while ((await page.locator(`option[value="${id}"]`).count()) === 0) {
    const next = page.getByRole("link", { name: "Más usuarios", exact: true });
    if ((await next.count()) === 0)
      throw new Error("No se encontró el perfil de prueba.");
    const href = await next.getAttribute("href");
    await next.click();
    await expect(page).toHaveURL(
      new RegExp(`${href?.split("?")[1]?.replace("?", "\\?")}$`),
    );
  }
  await page.getByLabel("Usuario existente").selectOption(id);
}

test("platform assigns an existing user, audits both identities and grants actual agency access", async ({
  page,
  browser,
  identity,
  otherIdentity,
  provisioner,
  assignmentAgency,
}, testInfo) => {
  const targetContext = await browser.newContext();
  try {
    const target = await targetContext.newPage();
    await loginThroughUI(target, otherIdentity);
    await expect(
      target.getByRole("heading", { name: "Sin acceso habilitado" }),
    ).toBeVisible();
    await loginThroughUI(page, identity);
    await expect(page).toHaveURL(/\/plataforma$/);
    await page.goto(
      `/plataforma/agencias/${assignmentAgency}/superadministrador`,
    );
    await page
      .getByRole("button", { name: "Asignar superadministrador" })
      .click();
    await expect(
      page.getByText("Seleccioná un usuario.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Usuario existente")).toBeFocused();
    await selectExistingUser(page, otherIdentity.id);
    await expect(
      page.getByText(`ID: ${otherIdentity.id}`, { exact: false }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("assign-superadmin.png"),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Asignar superadministrador" })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "ya tiene una asignación",
    );
    await expect(
      page.getByRole("button", { name: "Asignar superadministrador" }),
    ).toHaveCount(0);
    const audit = await provisioner
      .from("audit_events")
      .select("actor_id,target_user_id,action")
      .eq("agency_id", assignmentAgency);
    expect(audit.error).toBeNull();
    expect(audit.data).toEqual([
      {
        actor_id: identity.id,
        target_user_id: otherIdentity.id,
        action: "membership.superadmin_assigned",
      },
    ]);
    await target.reload();
    await expect(
      target.getByRole("heading", {
        name: "Agencia QA responsable",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      target.getByText("Superadministrador de agencia", { exact: true }),
    ).toBeVisible();
    expect(
      (
        await target.goto(
          `/plataforma/agencias/${assignmentAgency}/superadministrador`,
        )
      )?.status(),
    ).toBe(404);
  } finally {
    await targetContext.close();
  }
});

test("anonymous, ordinary and revoked sessions cannot assign; inactive and invalid routes fail safely", async ({
  page,
  identity,
  otherIdentity,
  provisioner,
  assignmentAgency,
}) => {
  const path = `/plataforma/agencias/${assignmentAgency}/superadministrador`;
  await page.goto(path);
  await expect(page).toHaveURL(/\/login$/);
  await loginThroughUI(page, otherIdentity);
  await expect(page).toHaveURL(/\/panel$/);
  expect((await page.goto(path + "?role=platform_admin"))?.status()).toBe(404);
  await page.goto("/cuenta");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await loginThroughUI(page, identity);
  await expect(page).toHaveURL(/\/plataforma$/);
  expect(
    (
      await page.goto("/plataforma/agencias/invalid/superadministrador")
    )?.status(),
  ).toBe(404);
  await page.goto(path + "?page=1&page=2");
  await expect(
    page.getByRole("alert").filter({ hasText: /página de usuarios/ }),
  ).toBeVisible();
  const inactive = await provisioner
    .from("agencies")
    .update({ is_active: false })
    .eq("id", assignmentAgency);
  expect(inactive.error).toBeNull();
  await page.goto(path);
  await expect(page.getByRole("status")).toContainText("inactiva");
  const active = await provisioner
    .from("agencies")
    .update({ is_active: true })
    .eq("id", assignmentAgency);
  expect(active.error).toBeNull();
  await page.reload();
  await selectExistingUser(page, otherIdentity.id);
  const revoked = await provisioner
    .from("platform_admins")
    .update({ is_active: false })
    .eq("user_id", identity.id);
  expect(revoked.error).toBeNull();
  await page
    .getByRole("button", { name: "Asignar superadministrador" })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: /No tenés permiso/ }),
  ).toBeVisible();
  const memberships = await provisioner
    .from("memberships")
    .select("id")
    .eq("agency_id", assignmentAgency);
  expect(memberships.data).toEqual([]);
});

test("two distinct concurrent targets produce only one initial owner and one event", async ({
  identity,
  otherIdentity,
  provisioner,
  assignmentAgency,
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
  const signedIn = await client.auth.signInWithPassword(identity);
  if (signedIn.error) throw new Error("No se pudo ingresar como plataforma.");
  try {
    const results = await Promise.all(
      [identity.id, otherIdentity.id].map((userId) =>
        client.rpc("assign_initial_agency_superadmin", {
          p_agency_id: assignmentAgency,
          p_user_id: userId,
        }),
      ),
    );
    expect(results.filter((result) => !result.error)).toHaveLength(1);
    expect(results.find((result) => result.error)?.error?.code).toBe("P0001");
    const members = await provisioner
      .from("memberships")
      .select("user_id,role,is_active")
      .eq("agency_id", assignmentAgency);
    expect(members.data).toHaveLength(1);
    expect(members.data?.[0]?.role).toBe("agency_superadmin");
    expect(members.data?.[0]?.is_active).toBe(true);
    const audit = await provisioner
      .from("audit_events")
      .select("target_user_id")
      .eq("agency_id", assignmentAgency);
    expect(audit.data).toEqual([
      { target_user_id: members.data?.[0]?.user_id },
    ]);
  } finally {
    await client.auth.signOut();
  }
});
