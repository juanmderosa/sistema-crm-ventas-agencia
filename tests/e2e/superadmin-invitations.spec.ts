import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { z } from "zod";
import type { Database } from "../../src/lib/supabase/database.types";
import { test as base, loginThroughUI } from "./fixtures";

const test = base.extend<{
  invitationSetup: {
    agency: string;
    otherAgency: string;
    email: string;
    otherEmail: string;
  };
}>({
  invitationSetup: async ({ provisioner, identity }, provide) => {
    const agency = randomUUID();
    const otherAgency = randomUUID();
    const email = `invite-${randomUUID()}@example.test`;
    const otherEmail = `invite-${randomUUID()}@example.test`;
    const agencies = await provisioner.from("agencies").insert(
      [agency, otherAgency].map((id) => ({
        id,
        name: "Agencia QA invitaciones",
        slug: `qa-invite-${id}`,
        ars_per_usd: 1000,
      })),
    );
    const platform = await provisioner
      .from("platform_admins")
      .insert({ user_id: identity.id });
    if (agencies.error || platform.error)
      throw new Error("No se pudieron preparar las invitaciones.");
    try {
      await provide({ agency, otherAgency, email, otherEmail });
    } finally {
      const users = await provisioner.auth.admin.listUsers({ perPage: 1000 });
      if (users.error)
        throw new Error("No se pudieron consultar las identidades sintéticas.");
      const invitedUsers = users.data.users.filter((user) =>
        [email, otherEmail].includes(user.email ?? ""),
      );
      const results = [
        await provisioner
          .from("audit_events")
          .delete()
          .in("agency_id", [agency, otherAgency]),
        await provisioner
          .from("agency_invitations")
          .delete()
          .in("agency_id", [agency, otherAgency]),
        await provisioner
          .from("memberships")
          .delete()
          .in("agency_id", [agency, otherAgency]),
        await provisioner
          .from("agencies")
          .delete()
          .in("id", [agency, otherAgency]),
        await provisioner
          .from("platform_admins")
          .delete()
          .eq("user_id", identity.id),
      ];
      if (results.some((result) => result.error))
        throw new Error("No se pudo retirar un fixture de invitación.");
      for (const user of invitedUsers) {
        const profile = await provisioner
          .from("profiles")
          .delete()
          .eq("id", user.id);
        if (
          profile.error ||
          (await provisioner.auth.admin.deleteUser(user.id)).error
        )
          throw new Error(
            "No se pudo retirar una identidad invitada sintética.",
          );
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

async function readInvitationLink(request: APIRequestContext, email: string) {
  let messageId: string | undefined;
  await expect
    .poll(async () => {
      const response = await request.get(
        `http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
      );
      const data = z
        .object({ messages: z.array(z.object({ ID: z.string() })) })
        .parse(await response.json());
      messageId = data.messages[0]?.ID;
      return Boolean(messageId);
    })
    .toBe(true);
  const response = await request.get(
    `http://127.0.0.1:54324/api/v1/message/${messageId}`,
  );
  const html = z.object({ HTML: z.string() }).parse(await response.json()).HTML;
  const link = html.match(/href="([^"]+)"/)?.[1];
  return new URL(z.string().parse(link).replaceAll("&amp;", "&"));
}

async function sendThroughUI(page: Page, agency: string, email: string) {
  await page.goto(`/plataforma/agencias/${agency}/invitar`);
  await page.getByLabel("Nombre del invitado").fill("Responsable invitado QA");
  await page.getByLabel("Correo del invitado").fill(email);
  await page
    .getByRole("button", { name: "Enviar invitación", exact: true })
    .click();
  await expect(
    page.getByText("Estado: Enviada", { exact: true }),
  ).toBeVisible();
}

async function submitPassword(page: Page, password: string) {
  await page.getByLabel("Nueva contraseña").fill(password);
  await page.getByLabel("Confirmar contraseña").fill(password);
  await page
    .getByRole("button", { name: "Definir contraseña y aceptar" })
    .click();
}

test("email invitation grants no early access, accepts across browsers and records both actors", async ({
  page,
  browser,
  request,
  baseURL,
  identity,
  otherIdentity,
  provisioner,
  invitationSetup,
}, testInfo) => {
  const setup = invitationSetup;
  await loginThroughUI(page, identity);
  await expect(page).toHaveURL(/\/plataforma$/);
  await page.goto(`/plataforma/agencias/${setup.agency}/invitar`);
  await page.getByRole("button", { name: "Enviar invitación" }).click();
  await expect(
    page.getByText("Ingresá el nombre.", { exact: true }),
  ).toBeVisible();
  await sendThroughUI(page, setup.agency, setup.email);
  const invited = await provisioner
    .from("agency_invitations")
    .select("id,user_id,status")
    .eq("agency_id", setup.agency)
    .single();
  if (invited.error) throw new Error("No existe la invitación.");
  const targetId = z.uuid().parse(invited.data.user_id);
  expect(
    (
      await provisioner
        .from("memberships")
        .select("id")
        .eq("agency_id", setup.agency)
    ).data,
  ).toEqual([]);
  const actor = publicClient();
  if ((await actor.auth.signInWithPassword(identity)).error)
    throw new Error("No se pudo ingresar.");
  expect(
    (
      await actor.rpc("assign_initial_agency_superadmin", {
        p_agency_id: setup.otherAgency,
        p_user_id: targetId,
      })
    ).error?.code,
  ).toBe("P0002");
  await actor.auth.signOut();
  const link = await readInvitationLink(request, setup.email);
  expect(link.origin).toBe(baseURL);
  expect(link.pathname).toBe("/invitaciones/aceptar");
  expect(link.searchParams.get("invitation")).toBe(invited.data.id);
  const context = await browser.newContext({
    viewport: page.viewportSize() ?? undefined,
  });
  try {
    const target = await context.newPage();
    await loginThroughUI(target, otherIdentity);
    await expect(target).toHaveURL(/\/panel$/);
    const landing = await target.goto(link.href + "&next=https://example.org");
    expect(landing?.headers()["cache-control"]).toContain("no-store");
    expect(landing?.headers()["referrer-policy"]).toBe("no-referrer");
    await target.reload();
    await submitPassword(target, "short");
    await expect(
      target.getByText("Usá al menos ocho caracteres.", { exact: true }),
    ).toBeVisible();
    await target.screenshot({
      path: testInfo.outputPath("accept-invitation.png"),
      fullPage: true,
    });
    expect(
      await target.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const password = `${randomUUID()}!Aa7`;
    await submitPassword(target, password);
    await expect(target).toHaveURL(/\/login\?invited=1$/);
    await target.goto("/cuenta");
    await expect(target).toHaveURL(/\/login$/);
    await loginThroughUI(target, {
      email: setup.email,
      password,
      id: targetId,
    });
    await expect(
      target.getByRole("heading", {
        name: "Agencia QA invitaciones",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      target.getByText("Superadministrador de agencia", { exact: true }),
    ).toBeVisible();
    const audit = await provisioner
      .from("audit_events")
      .select("action,actor_id,target_user_id")
      .eq("agency_id", setup.agency);
    expect(audit.error).toBeNull();
    expect(audit.data).toHaveLength(3);
    expect(audit.data).toEqual(
      expect.arrayContaining([
        {
          action: "invitation.sent",
          actor_id: identity.id,
          target_user_id: targetId,
        },
        {
          action: "membership.superadmin_assigned",
          actor_id: identity.id,
          target_user_id: targetId,
        },
        {
          action: "invitation.accepted",
          actor_id: targetId,
          target_user_id: targetId,
        },
      ]),
    );
    await target.goto(link.href);
    await submitPassword(target, `${password}x`);
    await expect(
      target
        .getByRole("alert")
        .filter({ hasText: /inválido, venció o ya se usó/ }),
    ).toBeVisible();
    const existing = publicClient();
    expect(
      (await existing.auth.signInWithPassword(otherIdentity)).error,
    ).toBeNull();
    await existing.auth.signOut();
  } finally {
    await context.close();
  }
});

test("unauthorized callers cannot invite and existing accounts keep their passwords", async ({
  page,
  request,
  identity,
  otherIdentity,
  provisioner,
  invitationSetup,
}) => {
  const env = z
    .object({ NEXT_PUBLIC_SUPABASE_URL: z.url() })
    .parse(process.env);
  const endpoint = `${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-agency-superadmin`;
  expect((await request.post(endpoint, { data: {} })).status()).toBe(401);
  expect(
    (
      await request.post(endpoint, {
        headers: { Authorization: "Bearer forged" },
        data: {},
      })
    ).status(),
  ).toBe(401);
  const ordinary = publicClient();
  if ((await ordinary.auth.signInWithPassword(otherIdentity)).error)
    throw new Error("No se pudo ingresar.");
  const denied = await ordinary.functions.invoke("invite-agency-superadmin", {
    body: {
      agencyId: invitationSetup.agency,
      email: invitationSetup.email,
      displayName: "No permitida",
    },
  });
  expect(denied.error).not.toBeNull();
  expect(
    (
      await provisioner
        .from("agency_invitations")
        .select("id")
        .eq("agency_id", invitationSetup.agency)
    ).data,
  ).toEqual([]);
  await ordinary.auth.signOut();
  const removedProfile = await provisioner
    .from("profiles")
    .delete()
    .eq("id", otherIdentity.id);
  expect(removedProfile.error).toBeNull();
  await loginThroughUI(page, identity);
  await expect(page).toHaveURL(/\/plataforma$/);
  await page.goto(`/plataforma/agencias/${invitationSetup.agency}/invitar`);
  await page.getByLabel("Nombre del invitado").fill("Cuenta existente");
  await page.getByLabel("Correo del invitado").fill(otherIdentity.email);
  await page.getByRole("button", { name: "Enviar invitación" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: /cuenta ya existe/ }),
  ).toBeVisible();
  const state = await provisioner
    .from("agency_invitations")
    .select("status")
    .eq("agency_id", invitationSetup.agency);
  expect(state.data).toEqual([{ status: "failed" }]);
  const preparedProfile = await provisioner
    .from("profiles")
    .select("display_name")
    .eq("id", otherIdentity.id)
    .single();
  expect(preparedProfile.error).toBeNull();
  expect(preparedProfile.data?.display_name).toBe("Cuenta existente");
  expect(
    (
      await provisioner
        .from("memberships")
        .select("id")
        .eq("agency_id", invitationSetup.agency)
    ).data,
  ).toEqual([]);
  const existing = publicClient();
  expect(
    (await existing.auth.signInWithPassword(otherIdentity)).error,
  ).toBeNull();
  await existing.auth.signOut();
});

test("cancelled and expired invitations cannot grant membership", async ({
  page,
  browser,
  request,
  identity,
  provisioner,
  invitationSetup,
}) => {
  const setup = invitationSetup;
  await loginThroughUI(page, identity);
  await expect(page).toHaveURL(/\/plataforma$/);
  await sendThroughUI(page, setup.agency, setup.email);
  const cancelledLink = await readInvitationLink(request, setup.email);
  await page.getByRole("button", { name: "Cancelar invitación" }).click();
  await expect(
    page.getByText("Estado: Cancelada", { exact: true }),
  ).toBeVisible();
  // A cancelled, still-unconfirmed Auth identity can receive a fresh invitation.
  await sendThroughUI(page, setup.agency, setup.email);
  await sendThroughUI(page, setup.otherAgency, setup.otherEmail);
  const expiredLink = await readInvitationLink(request, setup.otherEmail);
  const expired = await provisioner
    .from("agency_invitations")
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("agency_id", setup.otherAgency);
  expect(expired.error).toBeNull();
  const context = await browser.newContext();
  try {
    const target = await context.newPage();
    for (const link of [cancelledLink, expiredLink]) {
      await target.goto(link.href);
      await submitPassword(target, `${randomUUID()}!Aa7`);
      await expect(
        target
          .getByRole("alert")
          .filter({ hasText: /No se pudo aceptar|El enlace es inválido/ }),
      ).toBeVisible();
    }
    expect(
      (
        await provisioner
          .from("memberships")
          .select("id")
          .in("agency_id", [setup.agency, setup.otherAgency])
      ).data,
    ).toEqual([]);
  } finally {
    await context.close();
  }
});

test("acceptance can resume after password activation if inviter access was temporarily revoked", async ({
  page,
  browser,
  request,
  identity,
  otherIdentity,
  provisioner,
  invitationSetup,
}) => {
  const setup = invitationSetup;
  await loginThroughUI(page, identity);
  await expect(page).toHaveURL(/\/plataforma$/);
  await sendThroughUI(page, setup.agency, setup.email);
  const link = await readInvitationLink(request, setup.email);
  const invitationId = z.uuid().parse(link.searchParams.get("invitation"));
  const revoked = await provisioner
    .from("platform_admins")
    .update({ is_active: false })
    .eq("user_id", identity.id);
  expect(revoked.error).toBeNull();
  const context = await browser.newContext();
  try {
    const target = await context.newPage();
    const password = `${randomUUID()}!Aa7`;
    await target.goto(link.href);
    await submitPassword(target, password);
    await expect(
      target.getByRole("alert").filter({ hasText: /No se pudo aceptar/ }),
    ).toBeVisible();
    expect(
      (
        await provisioner
          .from("memberships")
          .select("id")
          .eq("agency_id", setup.agency)
      ).data,
    ).toEqual([]);
    const restored = await provisioner
      .from("platform_admins")
      .update({ is_active: true })
      .eq("user_id", identity.id);
    expect(restored.error).toBeNull();
    const resumePath = `/invitaciones/aceptar?invitation=${invitationId}`;
    await loginThroughUI(target, otherIdentity);
    await expect(target).toHaveURL(/\/panel$/);
    await target.goto(resumePath);
    await target
      .getByRole("button", { name: "Completar aceptación con mi sesión" })
      .click();
    await expect(
      target.getByRole("alert").filter({ hasText: /No se pudo aceptar/ }),
    ).toBeVisible();
    await target.goto("/cuenta");
    await target.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(target).toHaveURL(/\/login$/);
    const invited = await provisioner
      .from("agency_invitations")
      .select("user_id")
      .eq("id", invitationId)
      .single();
    if (invited.error) throw new Error("No se pudo consultar el invitado.");
    await loginThroughUI(target, {
      email: setup.email,
      password,
      id: z.uuid().parse(invited.data.user_id),
    });
    await expect(target).toHaveURL(/\/panel$/);
    await target.goto(resumePath);
    await target
      .getByRole("button", { name: "Completar aceptación con mi sesión" })
      .click();
    await expect(
      target.getByRole("heading", {
        name: "Agencia QA invitaciones",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("competing senders reserve one slot and competing acceptances create one membership", async ({
  request,
  identity,
  provisioner,
  invitationSetup,
}) => {
  const setup = invitationSetup;
  const actor = publicClient();
  if ((await actor.auth.signInWithPassword(identity)).error)
    throw new Error("No se pudo ingresar.");
  try {
    const sent = await Promise.all(
      [setup.email, setup.otherEmail].map((email) =>
        actor.functions.invoke("invite-agency-superadmin", {
          body: {
            agencyId: setup.agency,
            email,
            displayName: "Responsable QA",
          },
        }),
      ),
    );
    expect(sent.filter((result) => result.error === null)).toHaveLength(1);
    const invite = await provisioner
      .from("agency_invitations")
      .select("id,email,user_id")
      .eq("agency_id", setup.agency)
      .single();
    if (invite.error) throw new Error("No existe invitación única.");
    const link = await readInvitationLink(request, invite.data.email);
    const otherEmail =
      invite.data.email === setup.email ? setup.otherEmail : setup.email;
    const secondSent = await actor.functions.invoke(
      "invite-agency-superadmin",
      {
        body: {
          agencyId: setup.otherAgency,
          email: otherEmail,
          displayName: "Otro responsable QA",
        },
      },
    );
    expect(secondSent.error).toBeNull();
    const otherInvite = await provisioner
      .from("agency_invitations")
      .select("id")
      .eq("agency_id", setup.otherAgency)
      .single();
    if (otherInvite.error) throw new Error("No existe la segunda invitación.");
    const target = publicClient();
    const verified = await target.auth.verifyOtp({
      type: "invite",
      token_hash: z.string().parse(link.searchParams.get("token_hash")),
    });
    expect(verified.error).toBeNull();
    expect(
      (await target.auth.updateUser({ password: `${randomUUID()}!Aa7` })).error,
    ).toBeNull();
    expect(
      (
        await target.rpc("accept_superadmin_invitation", {
          p_invitation_id: otherInvite.data.id,
        })
      ).error?.code,
    ).toBe("42501");
    const accepted = await Promise.all([
      // Only the identity bound to this invitation can accept it.
      target.rpc("accept_superadmin_invitation", {
        p_invitation_id: invite.data.id,
      }),
      target.rpc("accept_superadmin_invitation", {
        p_invitation_id: invite.data.id,
      }),
    ]);
    expect(accepted.filter((result) => !result.error)).toHaveLength(1);
    expect(accepted.find((result) => result.error)?.error?.code).toBe("P0001");
    expect(
      (
        await provisioner
          .from("memberships")
          .select("id")
          .eq("agency_id", setup.agency)
      ).data,
    ).toHaveLength(1);
    expect(
      (
        await provisioner
          .from("audit_events")
          .select("id")
          .eq("agency_id", setup.agency)
      ).data,
    ).toHaveLength(3);
    await target.auth.signOut();
  } finally {
    await actor.auth.signOut();
  }
});
