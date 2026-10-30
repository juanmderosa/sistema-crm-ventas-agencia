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
const test = base.extend<{
  members: {
    agency: string;
    otherAgency: string;
    seller: { id: string; email: string; password: string };
    sellerMembership: string;
    adminMembership: string;
  };
}>({
  members: async ({ provisioner, identity, otherIdentity }, provide) => {
    const agency = randomUUID(),
      otherAgency = randomUUID();
    const email = `members-${randomUUID()}@example.test`,
      password = `${randomUUID()}!aA8`;
    const created = await provisioner.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw new Error("No se pudo preparar el usuario QA.");
    const seller = { id: created.data.user.id, email, password };
    try {
      const profile = await provisioner
        .from("profiles")
        .insert({ id: seller.id, display_name: "Vendedor QA" });
      const agencies = await provisioner.from("agencies").insert(
        [agency, otherAgency].map((id) => ({
          id,
          name:
            id === agency ? "Agencia QA miembros" : "Agencia QA independiente",
          slug: `qa-members-${id}`,
          ars_per_usd: 1000,
        })),
      );
      const memberships = await provisioner
        .from("memberships")
        .insert([
          {
            agency_id: agency,
            user_id: identity.id,
            role: "agency_superadmin",
          },
          { agency_id: agency, user_id: otherIdentity.id, role: "admin" },
          { agency_id: agency, user_id: seller.id, role: "seller" },
          { agency_id: otherAgency, user_id: seller.id, role: "admin" },
        ])
        .select("id,user_id,agency_id");
      if (profile.error || agencies.error || memberships.error)
        throw new Error("No se pudo preparar la agencia QA.");
      const sellerMembership = z
        .uuid()
        .parse(
          memberships.data.find(
            (row) => row.agency_id === agency && row.user_id === seller.id,
          )?.id,
        );
      const adminMembership = z
        .uuid()
        .parse(
          memberships.data.find(
            (row) =>
              row.agency_id === agency && row.user_id === otherIdentity.id,
          )?.id,
        );
      await provide({
        agency,
        otherAgency,
        seller,
        sellerMembership,
        adminMembership,
      });
    } finally {
      for (const table of ["audit_events", "memberships"] as const) {
        if (
          (
            await provisioner
              .from(table)
              .delete()
              .in("agency_id", [agency, otherAgency])
          ).error
        )
          throw new Error("No se pudo retirar el fixture de miembros.");
      }
      if (
        (
          await provisioner
            .from("agencies")
            .delete()
            .in("id", [agency, otherAgency])
        ).error
      )
        throw new Error("No se pudieron retirar las agencias QA.");
      const platform = await provisioner
        .from("platform_admins")
        .delete()
        .eq("user_id", identity.id);
      const profile = await provisioner
        .from("profiles")
        .delete()
        .eq("id", seller.id);
      if (
        platform.error ||
        profile.error ||
        (await provisioner.auth.admin.deleteUser(seller.id)).error
      )
        throw new Error("No se pudo retirar la identidad QA.");
    }
  },
});
test("owner changes admin and seller status, access follows reload and other agency stays available", async ({
  page,
  browser,
  identity,
  otherIdentity,
  provisioner,
  members,
}) => {
  await login(page, identity);
  await page.getByRole("link", { name: "Ver miembros de agencia" }).click();
  await expect(
    page.getByRole("heading", { name: "Miembros de agencia" }),
  ).toBeVisible();
  const own = page.getByRole("listitem").filter({ hasText: identity.id });
  await expect(own.getByRole("button")).toHaveCount(0);
  const admin = page
    .getByRole("listitem")
    .filter({ hasText: otherIdentity.id });
  const seller = page
    .getByRole("listitem")
    .filter({ hasText: members.seller.id });
  const context = await browser.newContext();
  try {
    const target = await context.newPage();
    await login(target, members.seller);
    await target.goto(`/panel?agency=${members.agency}`);
    await seller
      .getByRole("button", { name: "Desactivar", exact: true })
      .click();
    await expect(
      seller.getByText("Estado: Inactivo", { exact: true }),
    ).toBeVisible();
    await target.reload();
    await expect(
      target.getByRole("heading", { name: "Acceso no disponible" }),
    ).toBeVisible();
    await target.goto(`/panel?agency=${members.otherAgency}`);
    await expect(
      target.getByRole("heading", { name: "Agencia QA independiente" }),
    ).toBeVisible();
    await seller
      .getByRole("button", { name: "Reactivar", exact: true })
      .click();
    await expect(
      seller.getByText("Estado: Activo", { exact: true }),
    ).toBeVisible();
    await target.goto(`/panel?agency=${members.agency}`);
    await expect(
      target.getByRole("heading", { name: "Panel de agencia" }),
    ).toBeVisible();
    await admin
      .getByRole("button", { name: "Desactivar", exact: true })
      .click();
    await expect(
      admin.getByText("Estado: Inactivo", { exact: true }),
    ).toBeVisible();
    await admin.getByRole("button", { name: "Reactivar", exact: true }).click();
    await expect(
      admin.getByText("Estado: Activo", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath("members.png"),
      fullPage: true,
    });
  } finally {
    await context.close();
  }
  const audit = await provisioner
    .from("audit_events")
    .select("action,actor_id,target_user_id,membership_id")
    .eq("agency_id", members.agency);
  expect(audit.data).toHaveLength(4);
  expect(
    audit.data?.every(
      (row) => row.actor_id === identity.id && row.membership_id !== null,
    ),
  ).toBe(true);
});
test("admin manages only sellers and stale or revoked submissions show errors", async ({
  page,
  otherIdentity,
  identity,
  provisioner,
  members,
}) => {
  await login(page, otherIdentity);
  await page.goto(`/panel/usuarios/miembros?agency=${members.agency}`);
  const seller = page
    .getByRole("listitem")
    .filter({ hasText: members.seller.id });
  await expect(
    page.getByRole("button", { name: "Desactivar", exact: true }),
  ).toHaveCount(1);
  const client = createClient<Database>(
    z.url().parse(process.env.NEXT_PUBLIC_SUPABASE_URL),
    z.string().parse(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  expect(
    (await client.auth.signInWithPassword(otherIdentity)).error,
  ).toBeNull();
  expect(
    (
      await client.rpc("set_agency_member_active", {
        p_agency_id: members.agency,
        p_membership_id: members.adminMembership,
        p_is_active: false,
        p_expected_is_active: true,
      })
    ).error?.code,
  ).toBe("42501");
  const changed = await provisioner
    .from("memberships")
    .update({ is_active: false })
    .eq("id", members.sellerMembership);
  expect(changed.error).toBeNull();
  await seller.getByRole("button", { name: "Desactivar", exact: true }).click();
  await expect(seller.getByRole("alert")).toContainText("Recargá la lista");
  await page.reload();
  await seller.getByRole("button", { name: "Reactivar", exact: true }).click();
  await expect(
    seller.getByText("Estado: Activo", { exact: true }),
  ).toBeVisible();
  const revoked = await provisioner
    .from("memberships")
    .update({ is_active: false })
    .eq("id", members.adminMembership);
  expect(revoked.error).toBeNull();
  await seller.getByRole("button", { name: "Desactivar", exact: true }).click();
  await expect(seller.getByRole("alert")).toContainText("No tenés permiso");
  expect((await page.reload())?.status()).toBe(404);
  expect(
    (await client.rpc("list_agency_members", { p_agency_id: members.agency }))
      .error?.code,
  ).toBe("42501");
  await client.auth.signOut();
  expect(
    (
      await provisioner
        .from("memberships")
        .select("role,is_active")
        .eq("agency_id", members.agency)
        .eq("user_id", identity.id)
        .single()
    ).data,
  ).toEqual({ role: "agency_superadmin", is_active: true });
});
test("anonymous, seller, platform-only and malformed selectors cannot open member management", async ({
  page,
  identity,
  provisioner,
  members,
}) => {
  await page.goto(`/panel/usuarios/miembros?agency=${members.agency}`);
  await expect(page).toHaveURL(/\/login$/);
  await login(page, members.seller);
  expect(
    (
      await page.goto(`/panel/usuarios/miembros?agency=${members.agency}`)
    )?.status(),
  ).toBe(404);
  await page.goto("/cuenta");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, identity);
  for (const query of [
    `agency=${members.otherAgency}`,
    "agency=bad",
    `agency=${members.agency}&agency=${members.agency}`,
    `agency=${members.agency}&page=0`,
    `agency=${members.agency}&page=1&page=2`,
  ])
    expect(
      (await page.goto(`/panel/usuarios/miembros?${query}`))?.status(),
    ).toBe(404);
  expect(
    (await provisioner.from("platform_admins").insert({ user_id: identity.id }))
      .error,
  ).toBeNull();
  expect(
    (
      await provisioner
        .from("memberships")
        .update({ is_active: false })
        .eq("agency_id", members.agency)
        .eq("user_id", identity.id)
    ).error,
  ).toBeNull();
  expect(
    (
      await page.goto(`/panel/usuarios/miembros?agency=${members.agency}`)
    )?.status(),
  ).toBe(404);
});
