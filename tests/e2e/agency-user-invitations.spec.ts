import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { z } from "zod";
import type { Database } from "../../src/lib/supabase/database.types";
import { test as base, loginThroughUI as submitLogin } from "./fixtures";

async function loginThroughUI(
  page: Page,
  identity: Parameters<typeof submitLogin>[1],
) {
  await submitLogin(page, identity);
  await expect(page).toHaveURL(/\/(panel|plataforma)(\?|$)/);
}

const test = base.extend<{
  setup: { agency: string; otherAgency: string; email: string };
}>({
  setup: async ({ provisioner, identity, otherIdentity }, provide) => {
    const agency = randomUUID();
    const otherAgency = randomUUID();
    const email = `employee-${randomUUID()}@example.test`;
    const inserted = await provisioner.from("agencies").insert(
      [agency, otherAgency].map((id) => ({
        id,
        name: "Agencia QA usuarios",
        slug: `qa-users-${id}`,
        ars_per_usd: 1000,
      })),
    );
    const members = await provisioner.from("memberships").insert([
      { agency_id: agency, user_id: identity.id, role: "agency_superadmin" },
      { agency_id: otherAgency, user_id: otherIdentity.id, role: "seller" },
    ]);
    if (inserted.error || members.error)
      throw new Error("Fixture de agencia inválido.");
    try {
      await provide({ agency, otherAgency, email });
    } finally {
      const users = await provisioner.auth.admin.listUsers({ perPage: 1000 });
      if (users.error) throw new Error("No se pudo inspeccionar el fixture.");
      const invited = users.data.users.filter((user) => user.email === email);
      for (const table of [
        "audit_events",
        "agency_user_invitations",
        "memberships",
      ] as const) {
        const result = await provisioner
          .from(table)
          .delete()
          .in("agency_id", [agency, otherAgency]);
        if (result.error)
          throw new Error("No se pudo retirar el fixture de agencia.");
      }
      const agencies = await provisioner
        .from("agencies")
        .delete()
        .in("id", [agency, otherAgency]);
      const platform = await provisioner
        .from("platform_admins")
        .delete()
        .eq("user_id", identity.id);
      if (agencies.error || platform.error)
        throw new Error("No se pudo retirar la agencia sintética.");
      for (const user of invited) {
        const profile = await provisioner
          .from("profiles")
          .delete()
          .eq("id", user.id);
        if (
          profile.error ||
          (await provisioner.auth.admin.deleteUser(user.id)).error
        )
          throw new Error("No se pudo retirar la identidad sintética.");
      }
    }
  },
});
function publicClient() {
  const env = z
    .object({
      NEXT_PUBLIC_SUPABASE_URL: z.url(),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string(),
    })
    .parse(process.env);
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
async function readMail(request: APIRequestContext, email: string) {
  let id: string | undefined;
  await expect
    .poll(async () => {
      const response = await request.get(
        `http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
      );
      id = z
        .object({ messages: z.array(z.object({ ID: z.string() })) })
        .parse(await response.json()).messages[0]?.ID;
      return Boolean(id);
    })
    .toBe(true);
  const response = await request.get(
    `http://127.0.0.1:54324/api/v1/message/${id}`,
  );
  const html = z.object({ HTML: z.string() }).parse(await response.json()).HTML;
  return new URL(
    z
      .string()
      .parse(html.match(/href="([^"]+)"/)?.[1])
      .replaceAll("&amp;", "&"),
  );
}
async function send(
  page: Page,
  agency: string,
  email: string,
  role = "seller",
) {
  await page.goto(`/panel/usuarios?agency=${agency}`);
  await page.getByLabel("Nombre del invitado").fill("Usuario invitado QA");
  await page.getByLabel("Correo del invitado").fill(email);
  await page.getByLabel("Rol", { exact: true }).selectOption(role);
  await page
    .getByRole("button", { name: "Enviar invitación", exact: true })
    .click();
  await expect(
    page.getByText("Estado: Enviada", { exact: true }),
  ).toBeVisible();
}
async function password(page: Page, value: string) {
  await page.getByLabel("Nueva contraseña").fill(value);
  await page.getByLabel("Confirmar contraseña").fill(value);
  await page
    .getByRole("button", { name: "Definir contraseña y aceptar" })
    .click();
}

test("owner invites admin, recipient accepts across browsers and receives only its stored role", async ({
  page,
  browser,
  request,
  identity,
  otherIdentity,
  provisioner,
  setup,
}) => {
  await loginThroughUI(page, identity);
  await send(page, setup.agency, setup.email, "admin");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("agency-invitations.png"),
    fullPage: true,
  });
  const before = await provisioner
    .from("memberships")
    .select("id")
    .eq("agency_id", setup.agency);
  expect(before.data).toHaveLength(1);
  const link = await readMail(request, setup.email);
  expect(link.pathname).toBe("/invitaciones/usuarios/aceptar");
  const recipient = await browser.newContext();
  try {
    const tab = await recipient.newPage();
    await loginThroughUI(tab, otherIdentity);
    const response = await tab.goto(link.toString());
    expect(response?.headers()["cache-control"]).toContain("no-store");
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    const value = `${randomUUID()}!aA8`;
    await password(tab, value);
    await expect(tab).toHaveURL(/\/login\?invited=1$/);
    await loginThroughUI(tab, {
      id: "unused",
      email: setup.email,
      password: value,
    });
    await expect(
      tab.getByRole("heading", { name: "Panel de agencia" }),
    ).toBeVisible();
    await tab
      .getByRole("link", { name: "Administrar invitaciones de usuarios" })
      .click();
    await expect(
      tab.getByRole("option", { name: "Administrador", exact: true }),
    ).toHaveCount(0);
    await expect(
      tab.getByRole("option", { name: "Vendedor", exact: true }),
    ).toHaveCount(1);
    await tab.goto(link.toString());
    await password(tab, value);
    await expect(
      tab.getByRole("alert").filter({ hasText: "El enlace" }),
    ).toContainText("enlace");
  } finally {
    await recipient.close();
  }
  const row = await provisioner
    .from("agency_user_invitations")
    .select("id,user_id,status")
    .eq("agency_id", setup.agency)
    .single();
  expect(row.data?.status).toBe("accepted");
  const audit = await provisioner
    .from("audit_events")
    .select("action,actor_id,target_user_id")
    .eq("user_invitation_id", z.uuid().parse(row.data?.id));
  expect(audit.data).toHaveLength(3);
  expect(
    audit.data?.find((entry) => entry.action === "membership.user_invited")
      ?.actor_id,
  ).toBe(identity.id);
});

test("admin can send only sellers; cancellation, foreign agency, seller and platform-only access are denied", async ({
  page,
  request,
  identity,
  provisioner,
  setup,
}) => {
  await provisioner
    .from("memberships")
    .update({ role: "admin" })
    .eq("agency_id", setup.agency)
    .eq("user_id", identity.id);
  const client = publicClient();
  expect((await client.auth.signInWithPassword(identity)).error).toBeNull();
  const body = {
    agencyId: setup.agency,
    email: setup.email,
    displayName: "QA",
    role: "admin",
  };
  const denied = await client.functions.invoke("invite-agency-user", { body });
  expect(denied.error).toBeTruthy();
  const foreign = await client.functions.invoke("invite-agency-user", {
    body: { ...body, agencyId: setup.otherAgency, role: "seller" },
  });
  expect(foreign.error).toBeTruthy();
  await loginThroughUI(page, identity);
  await send(page, setup.agency, setup.email);
  const link = await readMail(request, setup.email);
  await page.getByRole("button", { name: "Cancelar invitación" }).click();
  await expect(
    page.getByText("Estado: Cancelada", { exact: true }),
  ).toBeVisible();
  const verify = publicClient();
  expect(
    (
      await verify.auth.verifyOtp({
        token_hash: z.string().parse(link.searchParams.get("token_hash")),
        type: "invite",
      })
    ).error,
  ).toBeNull();
  expect(
    (await verify.auth.updateUser({ password: `${randomUUID()}!aA8` })).error,
  ).toBeNull();
  const row = await provisioner
    .from("agency_user_invitations")
    .select("id")
    .eq("agency_id", setup.agency)
    .single();
  expect(
    (
      await verify.rpc("accept_agency_user_invitation", {
        p_invitation_id: z.uuid().parse(row.data?.id),
      })
    ).error?.code,
  ).toBe("P0001");
  await verify.auth.signOut();
  await provisioner
    .from("memberships")
    .update({ role: "seller" })
    .eq("agency_id", setup.agency)
    .eq("user_id", identity.id);
  expect(
    (await page.goto(`/panel/usuarios?agency=${setup.agency}`))?.status(),
  ).toBe(404);
  expect(
    (
      await client.functions.invoke("invite-agency-user", {
        body: { ...body, role: "seller" },
      })
    ).error,
  ).toBeTruthy();
  await provisioner.from("platform_admins").insert({ user_id: identity.id });
  await provisioner
    .from("memberships")
    .update({ is_active: false })
    .eq("agency_id", setup.agency)
    .eq("user_id", identity.id);
  expect(
    (
      await client.functions.invoke("invite-agency-user", {
        body: { ...body, role: "seller" },
      })
    ).error,
  ).toBeTruthy();
  const anonymous = await request.post(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-agency-user`,
    { data: body },
  );
  expect(anonymous.status()).toBe(401);
  await client.auth.signOut();
});

test("existing account accepts mail proof without changing password or its other agency membership", async ({
  page,
  request,
  identity,
  otherIdentity,
  provisioner,
  setup,
}) => {
  await loginThroughUI(page, identity);
  await send(page, setup.agency, otherIdentity.email, "admin");
  const link = await readMail(request, otherIdentity.email);
  expect(link.searchParams.get("method")).toBe("magiclink");
  await page.goto(link.toString());
  await expect(page.getByLabel("Nueva contraseña")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Aceptar invitación", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login\?invited=1$/);
  await loginThroughUI(page, otherIdentity);
  await expect(
    page.getByRole("heading", { name: "Elegí una agencia" }),
  ).toBeVisible();
  const members = await provisioner
    .from("memberships")
    .select("agency_id,role")
    .eq("user_id", otherIdentity.id)
    .order("agency_id");
  expect(members.data).toEqual(
    expect.arrayContaining([
      { agency_id: setup.agency, role: "admin" },
      { agency_id: setup.otherAgency, role: "seller" },
    ]),
  );
  const profile = await provisioner
    .from("profiles")
    .select("display_name")
    .eq("id", otherIdentity.id)
    .single();
  expect(profile.data?.display_name).toBe("Usuario de prueba");
});

test("revocation blocks acceptance after password activation; correct session can resume after authority is restored", async ({
  page,
  request,
  identity,
  otherIdentity,
  provisioner,
  setup,
}) => {
  await loginThroughUI(page, identity);
  await send(page, setup.agency, setup.email);
  const link = await readMail(request, setup.email);
  await provisioner
    .from("memberships")
    .update({ is_active: false })
    .eq("agency_id", setup.agency)
    .eq("user_id", identity.id);
  await page.goto(link.toString());
  const value = `${randomUUID()}!aA8`;
  await password(page, value);
  await expect(
    page.getByRole("alert").filter({ hasText: "No se pudo aceptar" }),
  ).toContainText("No se pudo aceptar");
  await provisioner
    .from("memberships")
    .update({ is_active: true })
    .eq("agency_id", setup.agency)
    .eq("user_id", identity.id);
  const resume = `/invitaciones/usuarios/aceptar?invitation=${link.searchParams.get("invitation")}`;
  await page.goto("/cuenta");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await loginThroughUI(page, otherIdentity);
  await page.goto(resume);
  await page
    .getByRole("button", { name: "Completar aceptación con mi sesión" })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "No se pudo aceptar" }),
  ).toContainText("No se pudo aceptar");
  await page.goto("/cuenta");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await loginThroughUI(page, {
    id: "unused",
    email: setup.email,
    password: value,
  });
  await page.goto(resume);
  await page
    .getByRole("button", { name: "Completar aceptación con mi sesión" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Panel de agencia" }),
  ).toBeVisible();
});

test("listing is paginated and rejects duplicate or malformed agency and page selectors", async ({
  page,
  identity,
  provisioner,
  setup,
}) => {
  await provisioner.from("agency_user_invitations").insert(
    Array.from({ length: 21 }, (_, i) => ({
      agency_id: setup.agency,
      invited_by: identity.id,
      email: `page-${i}@example.test`,
      display_name: `Página ${i}`,
      role: "seller",
      status: "failed",
    })),
  );
  await loginThroughUI(page, identity);
  await page.goto(`/panel/usuarios?agency=${setup.agency}`);
  await expect(
    page.getByText("Estado: No enviada", { exact: true }),
  ).toHaveCount(20);
  await page.getByRole("link", { name: "Siguiente", exact: true }).click();
  await expect(
    page.getByText("Estado: No enviada", { exact: true }),
  ).toHaveCount(1);
  for (const query of [
    `agency=bad`,
    `agency=${setup.agency}&agency=${setup.agency}`,
    `agency=${setup.agency}&page=0`,
    `agency=${setup.agency}&page=1&page=2`,
  ])
    expect((await page.goto(`/panel/usuarios?${query}`))?.status()).toBe(404);
});
