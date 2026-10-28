import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import { test as base, loginThroughUI } from "./fixtures";

const test = base.extend<{ agencies: { a: string; b: string } }>({
  agencies: async ({ provisioner, identity, otherIdentity }, provide) => {
    const a = randomUUID();
    const b = randomUUID();
    const { error } = await provisioner.from("agencies").insert([
      {
        id: a,
        name: "Agencia A de prueba",
        slug: `test-${a}`,
        ars_per_usd: 1000,
      },
      {
        id: b,
        name: "Agencia B de prueba",
        slug: `test-${b}`,
        ars_per_usd: 1000,
      },
    ]);
    if (error)
      throw new Error("No se pudieron preparar las agencias sintéticas.");
    try {
      await provide({ a, b });
    } finally {
      const membershipResult = await provisioner
        .from("memberships")
        .delete()
        .in("user_id", [identity.id, otherIdentity.id]);
      if (membershipResult.error)
        throw new Error("No se pudieron retirar las membresías sintéticas.");
      const platformResult = await provisioner
        .from("platform_admins")
        .delete()
        .in("user_id", [identity.id, otherIdentity.id]);
      if (platformResult.error)
        throw new Error("No se pudieron retirar las asignaciones sintéticas.");
      const agencyResult = await provisioner
        .from("agencies")
        .delete()
        .in("id", [a, b]);
      if (agencyResult.error)
        throw new Error("No se pudieron retirar las agencias sintéticas.");
    }
  },
});

test("private entry routes reject anonymous requests", async ({ page }) => {
  for (const path of ["/panel", "/plataforma"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("single agency entry derives role from membership and rejects foreign or malformed agency IDs", async ({
  page,
  identity,
  provisioner,
  agencies,
}) => {
  const { error } = await provisioner
    .from("memberships")
    .insert({ agency_id: agencies.a, user_id: identity.id, role: "seller" });
  if (error) throw new Error("No se pudo preparar la membresía.");
  await loginThroughUI(page, identity);
  await expect(
    page.getByRole("heading", { name: "Panel de agencia" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Agencia A de prueba" }),
  ).toBeVisible();
  await expect(page.getByText("Vendedor", { exact: true })).toBeVisible();
  await page.goto(`/panel?agency=${agencies.a}&role=agency_superadmin`);
  await expect(page.getByText("Vendedor", { exact: true })).toBeVisible();
  for (const query of [
    `agency=${agencies.b}`,
    "agency=invalid",
    `agency=${agencies.a}&agency=${agencies.b}`,
  ]) {
    await page.goto(`/panel?${query}`);
    await expect(
      page.getByRole("heading", { name: "Acceso no disponible" }),
    ).toBeVisible();
    await expect(
      page.getByText("Agencia B de prueba", { exact: true }),
    ).toHaveCount(0);
  }
  const response = await page.goto("/plataforma?role=platform_admin");
  expect(response?.status()).toBe(404);
});

test("multiple agencies keep independent roles and apply role and membership revocation on reload", async ({
  page,
  identity,
  provisioner,
  agencies,
}, testInfo) => {
  const { error } = await provisioner.from("memberships").insert([
    { agency_id: agencies.a, user_id: identity.id, role: "admin" },
    { agency_id: agencies.b, user_id: identity.id, role: "seller" },
  ]);
  if (error) throw new Error("No se pudieron preparar las membresías.");
  await loginThroughUI(page, identity);
  await expect(
    page.getByRole("heading", { name: "Elegí una agencia" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("agency-selector.png"),
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Ingresar a Agencia A de prueba" })
    .click();
  await expect(page.getByText("Administrador", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Cambiar de agencia" }).click();
  await page
    .getByRole("link", { name: "Ingresar a Agencia B de prueba" })
    .click();
  await expect(page.getByText("Vendedor", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Agencia A de prueba" }),
  ).toHaveCount(0);
  const changed = await provisioner
    .from("memberships")
    .update({ role: "agency_superadmin" })
    .eq("agency_id", agencies.b)
    .eq("user_id", identity.id);
  if (changed.error) throw new Error("No se pudo cambiar el rol sintético.");
  await page.reload();
  await expect(
    page.getByText("Superadministrador de agencia", { exact: true }),
  ).toBeVisible();
  const revoked = await provisioner
    .from("memberships")
    .update({ is_active: false })
    .eq("agency_id", agencies.b)
    .eq("user_id", identity.id);
  if (revoked.error)
    throw new Error("No se pudo revocar la membresía sintética.");
  const response = await page.reload();
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(
    page.getByRole("heading", { name: "Acceso no disponible" }),
  ).toBeVisible();
  await page.goto("/panel");
  await expect(
    page.getByRole("heading", { name: "Agencia A de prueba" }),
  ).toBeVisible();
});

test("inactive memberships and agencies grant no entry and agency deactivation revokes an open panel", async ({
  page,
  identity,
  provisioner,
  agencies,
}) => {
  const inserted = await provisioner.from("memberships").insert([
    {
      agency_id: agencies.a,
      user_id: identity.id,
      role: "admin",
      is_active: false,
    },
    {
      agency_id: agencies.b,
      user_id: identity.id,
      role: "seller",
      is_active: true,
    },
  ]);
  const disabled = await provisioner
    .from("agencies")
    .update({ is_active: false })
    .eq("id", agencies.b);
  if (inserted.error || disabled.error)
    throw new Error("No se pudieron preparar los estados inactivos.");
  await loginThroughUI(page, identity);
  await expect(
    page.getByRole("heading", { name: "Sin acceso habilitado" }),
  ).toBeVisible();
  const enabled = await provisioner
    .from("agencies")
    .update({ is_active: true })
    .eq("id", agencies.b);
  if (enabled.error)
    throw new Error("No se pudo habilitar la agencia sintética.");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Agencia B de prueba" }),
  ).toBeVisible();
  const revoked = await provisioner
    .from("agencies")
    .update({ is_active: false })
    .eq("id", agencies.b);
  if (revoked.error)
    throw new Error("No se pudo revocar la agencia sintética.");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Sin acceso habilitado" }),
  ).toBeVisible();
});

test("platform entry requires its independent active assignment and revokes immediately", async ({
  page,
  identity,
  provisioner,
  agencies,
}) => {
  await page.goto(`/panel?agency=${agencies.a}`);
  await expect(page).toHaveURL(/\/login$/);
  const inserted = await provisioner
    .from("platform_admins")
    .insert({ user_id: identity.id });
  if (inserted.error)
    throw new Error("No se pudo preparar el acceso de plataforma.");
  await loginThroughUI(page, identity);
  await expect(page).toHaveURL(/\/plataforma$/);
  await expect(
    page.getByRole("heading", { name: "Acceso de plataforma" }),
  ).toBeVisible();
  await expect(
    page.getByText("Administrador de plataforma", { exact: true }),
  ).toBeVisible();
  const revoked = await provisioner
    .from("platform_admins")
    .update({ is_active: false })
    .eq("user_id", identity.id);
  if (revoked.error)
    throw new Error("No se pudo revocar el acceso de plataforma.");
  const response = await page.reload();
  expect(response?.status()).toBe(404);
  await page.goto("/panel");
  await expect(
    page.getByRole("heading", { name: "Sin acceso habilitado" }),
  ).toBeVisible();
});

test("switching identity in the same browser never retains the previous agency context", async ({
  page,
  identity,
  otherIdentity,
  provisioner,
  agencies,
}) => {
  const inserted = await provisioner.from("memberships").insert([
    { agency_id: agencies.a, user_id: identity.id, role: "admin" },
    { agency_id: agencies.b, user_id: otherIdentity.id, role: "seller" },
  ]);
  if (inserted.error)
    throw new Error("No se pudieron preparar las identidades y membresías.");
  await loginThroughUI(page, identity);
  await expect(
    page.getByRole("heading", { name: "Agencia A de prueba" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await loginThroughUI(page, otherIdentity);
  await expect(
    page.getByRole("heading", { name: "Agencia B de prueba" }),
  ).toBeVisible();
  await expect(page.getByText(identity.email, { exact: true })).toHaveCount(0);
  await expect(page.getByText("Vendedor", { exact: true })).toBeVisible();
  await page.goto(`/panel?agency=${agencies.a}`);
  await expect(
    page.getByRole("heading", { name: "Acceso no disponible" }),
  ).toBeVisible();
  await expect(
    page.getByText("Agencia A de prueba", { exact: true }),
  ).toHaveCount(0);
});
