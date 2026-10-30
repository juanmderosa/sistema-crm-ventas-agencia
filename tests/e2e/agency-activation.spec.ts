import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page, type APIRequestContext } from "@playwright/test";
import { z } from "zod";
import type { Database } from "../../src/lib/supabase/database.types";
import { test as base, loginThroughUI as submitLogin } from "./fixtures";
async function login(page: Page, identity: Parameters<typeof submitLogin>[1]) {
  await submitLogin(page, identity);
  await expect(page).toHaveURL(/\/(panel|plataforma)(\?|$)/);
}
function client() {
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
async function agencyRow(page: Page, agency: string) {
  await page.goto("/plataforma/agencias");
  const row = page
    .getByRole("listitem")
    .filter({ hasText: `qa-activation-${agency}` });
  for (let n = 0; n < 10; n++) {
    if (await row.count()) return row;
    const next = page.getByRole("link", { name: "Siguiente", exact: true });
    if (!(await next.count())) break;
    await next.click();
  }
  throw new Error("No se encontró la agencia sintética en el listado.");
}
async function mail(request: APIRequestContext, email: string) {
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
const test = base.extend<{
  activation: {
    agency: string;
    otherAgency: string;
    emptyAgency: string;
    email: string;
    ownerEmail: string;
    seller: { id: string; email: string; password: string };
  };
}>({
  activation: async ({ provisioner, identity, otherIdentity }, provide) => {
    const agency = randomUUID(),
      otherAgency = randomUUID(),
      emptyAgency = randomUUID();
    const email = `activation-invite-${randomUUID()}@example.test`,
      ownerEmail = `activation-owner-${randomUUID()}@example.test`;
    const sellerEmail = `activation-seller-${randomUUID()}@example.test`,
      password = `${randomUUID()}!aA8`;
    const created = await provisioner.auth.admin.createUser({
      email: sellerEmail,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw new Error("No se pudo preparar el usuario sintético.");
    const seller = { id: created.data.user.id, email: sellerEmail, password };
    try {
      const profile = await provisioner
        .from("profiles")
        .insert({ id: seller.id, display_name: "QA vendedor inactivo" });
      const agencies = await provisioner.from("agencies").insert(
        [agency, otherAgency, emptyAgency].map((id) => ({
          id,
          name: `Agencia QA activación ${id.slice(0, 8)}`,
          slug: `qa-activation-${id}`,
          ars_per_usd: 1000,
        })),
      );
      const members = await provisioner.from("memberships").insert([
        {
          agency_id: agency,
          user_id: otherIdentity.id,
          role: "agency_superadmin",
          is_active: true,
        },
        {
          agency_id: otherAgency,
          user_id: otherIdentity.id,
          role: "admin",
          is_active: true,
        },
        {
          agency_id: agency,
          user_id: seller.id,
          role: "seller",
          is_active: false,
        },
        {
          agency_id: otherAgency,
          user_id: seller.id,
          role: "seller",
          is_active: true,
        },
      ]);
      const platform = await provisioner
        .from("platform_admins")
        .insert({ user_id: identity.id });
      if (profile.error || agencies.error || members.error || platform.error)
        throw new Error("No se pudo preparar el fixture de activación.");
      await provide({
        agency,
        otherAgency,
        emptyAgency,
        email,
        ownerEmail,
        seller,
      });
    } finally {
      const users = await provisioner.auth.admin.listUsers({ perPage: 1000 });
      if (users.error)
        throw new Error("No se pudo consultar el fixture de invitaciones.");
      const invited = users.data.users.filter((user) =>
        [email, ownerEmail].includes(user.email ?? ""),
      );
      for (const table of [
        "audit_events",
        "agency_invitations",
        "agency_user_invitations",
        "memberships",
      ] as const)
        if (
          (
            await provisioner
              .from(table)
              .delete()
              .in("agency_id", [agency, otherAgency, emptyAgency])
          ).error
        )
          throw new Error("No se pudo retirar el fixture de activación.");
      const agencies = await provisioner
        .from("agencies")
        .delete()
        .in("id", [agency, otherAgency, emptyAgency]);
      const platform = await provisioner
        .from("platform_admins")
        .delete()
        .eq("user_id", identity.id);
      if (agencies.error || platform.error)
        throw new Error("No se pudieron retirar las agencias sintéticas.");
      for (const user of [...invited, seller]) {
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
test("platform toggles agencies and restores only active memberships without changing other agencies", async ({
  page,
  browser,
  identity,
  otherIdentity,
  provisioner,
  activation,
}) => {
  await login(page, identity);
  const row = await agencyRow(page, activation.agency);
  const context = await browser.newContext();
  try {
    const target = await context.newPage();
    await login(target, otherIdentity);
    await target.goto(`/panel?agency=${activation.agency}`);
    await expect(
      target.getByRole("heading", { name: "Panel de agencia" }),
    ).toBeVisible();
    await row
      .getByRole("button", { name: "Desactivar agencia", exact: true })
      .click();
    await expect(row.getByText("Inactiva", { exact: true })).toBeVisible();
    await target.reload();
    await expect(
      target.getByRole("heading", { name: "Acceso no disponible" }),
    ).toBeVisible();
    expect(
      (
        await target.goto(`/panel/agencia?agency=${activation.agency}`)
      )?.status(),
    ).toBe(404);
    await target.goto(`/panel?agency=${activation.otherAgency}`);
    await expect(
      target.getByRole("heading", { name: "Panel de agencia" }),
    ).toBeVisible();
    await row
      .getByRole("button", { name: "Reactivar agencia", exact: true })
      .click();
    await expect(row.getByText("Activa", { exact: true })).toBeVisible();
    await target.goto(`/panel?agency=${activation.agency}`);
    await expect(
      target.getByRole("heading", { name: "Panel de agencia" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await row.screenshot({
      path: test.info().outputPath("agency-activation.png"),
    });
  } finally {
    await context.close();
  }
  const memberships = await provisioner
    .from("memberships")
    .select("user_id,is_active,role")
    .eq("agency_id", activation.agency);
  expect(memberships.data).toEqual(
    expect.arrayContaining([
      { user_id: otherIdentity.id, is_active: true, role: "agency_superadmin" },
      { user_id: activation.seller.id, is_active: false, role: "seller" },
    ]),
  );
  const seller = client();
  expect(
    (await seller.auth.signInWithPassword(activation.seller)).error,
  ).toBeNull();
  expect(
    (await seller.from("agencies").select("id").eq("id", activation.agency))
      .data,
  ).toHaveLength(0);
  await seller.auth.signOut({ scope: "local" });
  const audit = await provisioner
    .from("audit_events")
    .select("actor_id,action,previous_is_active,new_is_active")
    .eq("agency_id", activation.agency);
  expect(audit.data).toEqual(
    expect.arrayContaining([
      {
        actor_id: identity.id,
        action: "agency.deactivated",
        previous_is_active: true,
        new_is_active: false,
      },
      {
        actor_id: identity.id,
        action: "agency.activated",
        previous_is_active: false,
        new_is_active: true,
      },
    ]),
  );
  expect(audit.data).toHaveLength(2);
});
test("concurrent status requests have one winner and stale or revoked open controls fail", async ({
  page,
  identity,
  provisioner,
  activation,
}) => {
  await login(page, identity);
  const row = await agencyRow(page, activation.agency);
  const first = client(),
    second = client();
  expect((await first.auth.signInWithPassword(identity)).error).toBeNull();
  expect((await second.auth.signInWithPassword(identity)).error).toBeNull();
  try {
    const version = z
      .uuid()
      .parse(
        (
          await provisioner
            .from("agencies")
            .select("status_version")
            .eq("id", activation.agency)
            .single()
        ).data?.status_version,
      );
    const args = {
      p_agency_id: activation.agency,
      p_is_active: false,
      p_expected_version: version,
    };
    const results = await Promise.all([
      first.rpc("set_agency_active", args),
      second.rpc("set_agency_active", args),
    ]);
    expect(results.filter((result) => !result.error)).toHaveLength(1);
    expect(results.find((result) => result.error)?.error?.code).toBe("40001");
    const current = z
      .uuid()
      .parse(
        (
          await provisioner
            .from("agencies")
            .select("status_version")
            .eq("id", activation.agency)
            .single()
        ).data?.status_version,
      );
    expect(
      (
        await first.rpc("set_agency_active", {
          ...args,
          p_is_active: true,
          p_expected_version: current,
        })
      ).error,
    ).toBeNull();
    await row
      .getByRole("button", { name: "Desactivar agencia", exact: true })
      .click();
    await expect(row.getByRole("alert")).toContainText(
      "El estado de la agencia cambió",
    );
    await page.reload();
    const revoked = await provisioner
      .from("platform_admins")
      .update({ is_active: false })
      .eq("user_id", identity.id);
    expect(revoked.error).toBeNull();
    await row
      .getByRole("button", { name: "Desactivar agencia", exact: true })
      .click();
    await expect(row.getByRole("alert")).toContainText("plataforma");
    expect((await first.rpc("set_agency_active", args)).error?.code).toBe(
      "42501",
    );
    expect(
      (
        await provisioner
          .from("audit_events")
          .select("id")
          .eq("agency_id", activation.agency)
      ).data,
    ).toHaveLength(2);
    expect((await page.reload())?.status()).toBe(404);
  } finally {
    await first.auth.signOut({ scope: "local" });
    await second.auth.signOut({ scope: "local" });
  }
});
test("deactivation serializes with acceptance and both invitation types resume only after reactivation", async ({
  request,
  identity,
  otherIdentity,
  provisioner,
  activation,
}) => {
  const platform = client(),
    owner = client(),
    recipient = client(),
    initialOwner = client();
  expect((await platform.auth.signInWithPassword(identity)).error).toBeNull();
  expect((await owner.auth.signInWithPassword(otherIdentity)).error).toBeNull();
  try {
    const employee = await owner.functions.invoke("invite-agency-user", {
      body: {
        agencyId: activation.agency,
        email: activation.email,
        displayName: "QA invitado",
        role: "seller",
      },
    });
    expect(employee.error).toBeNull();
    const initial = await platform.functions.invoke(
      "invite-agency-superadmin",
      {
        body: {
          agencyId: activation.emptyAgency,
          email: activation.ownerEmail,
          displayName: "QA propietario",
        },
      },
    );
    expect(initial.error).toBeNull();
    const employeeLink = await mail(request, activation.email),
      ownerLink = await mail(request, activation.ownerEmail);
    const employeeId = z
        .uuid()
        .parse(employeeLink.searchParams.get("invitation")),
      ownerId = z.uuid().parse(ownerLink.searchParams.get("invitation"));
    expect(
      (
        await recipient.auth.verifyOtp({
          type: "invite",
          token_hash: z
            .string()
            .parse(employeeLink.searchParams.get("token_hash")),
        })
      ).error,
    ).toBeNull();
    expect(
      (await recipient.auth.updateUser({ password: `${randomUUID()}!aA8` }))
        .error,
    ).toBeNull();
    expect(
      (
        await initialOwner.auth.verifyOtp({
          type: "invite",
          token_hash: z
            .string()
            .parse(ownerLink.searchParams.get("token_hash")),
        })
      ).error,
    ).toBeNull();
    expect(
      (await initialOwner.auth.updateUser({ password: `${randomUUID()}!aA8` }))
        .error,
    ).toBeNull();
    const before = await provisioner
      .from("agency_user_invitations")
      .select("expires_at")
      .eq("id", employeeId)
      .single();
    const version = z
      .uuid()
      .parse(
        (
          await provisioner
            .from("agencies")
            .select("status_version")
            .eq("id", activation.agency)
            .single()
        ).data?.status_version,
      );
    const [deactivated, accepted] = await Promise.all([
      platform.rpc("set_agency_active", {
        p_agency_id: activation.agency,
        p_is_active: false,
        p_expected_version: version,
      }),
      recipient.rpc("accept_agency_user_invitation", {
        p_invitation_id: employeeId,
      }),
    ]);
    expect(deactivated.error).toBeNull();
    if (accepted.error) expect(accepted.error.code).toBe("P0002");
    expect(
      (
        await recipient.rpc("accept_agency_user_invitation", {
          p_invitation_id: employeeId,
        })
      ).error?.code,
    ).toBe("P0002");
    expect(
      (
        await recipient
          .from("agencies")
          .select("id")
          .eq("id", activation.agency)
      ).data,
    ).toHaveLength(0);
    const ownerVersion = z
      .uuid()
      .parse(
        (
          await provisioner
            .from("agencies")
            .select("status_version")
            .eq("id", activation.emptyAgency)
            .single()
        ).data?.status_version,
      );
    expect(
      (
        await platform.rpc("set_agency_active", {
          p_agency_id: activation.emptyAgency,
          p_is_active: false,
          p_expected_version: ownerVersion,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await initialOwner.rpc("accept_superadmin_invitation", {
          p_invitation_id: ownerId,
        })
      ).error?.code,
    ).toBe("P0002");
    for (const agency of [activation.agency, activation.emptyAgency]) {
      const current = z
        .uuid()
        .parse(
          (
            await provisioner
              .from("agencies")
              .select("status_version")
              .eq("id", agency)
              .single()
          ).data?.status_version,
        );
      expect(
        (
          await platform.rpc("set_agency_active", {
            p_agency_id: agency,
            p_is_active: true,
            p_expected_version: current,
          })
        ).error,
      ).toBeNull();
    }
    if (accepted.error)
      expect(
        (
          await recipient.rpc("accept_agency_user_invitation", {
            p_invitation_id: employeeId,
          })
        ).error,
      ).toBeNull();
    expect(
      (
        await initialOwner.rpc("accept_superadmin_invitation", {
          p_invitation_id: ownerId,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await recipient
          .from("agencies")
          .select("id")
          .eq("id", activation.agency)
      ).data,
    ).toHaveLength(1);
    expect(
      (
        await initialOwner
          .from("agencies")
          .select("id")
          .eq("id", activation.emptyAgency)
      ).data,
    ).toHaveLength(1);
    expect(
      (
        await provisioner
          .from("agency_user_invitations")
          .select("expires_at")
          .eq("id", employeeId)
          .single()
      ).data?.expires_at,
    ).toBe(before.data?.expires_at);
  } finally {
    await Promise.all(
      [platform, owner, recipient, initialOwner].map((connection) =>
        connection.auth.signOut({ scope: "local" }),
      ),
    );
  }
});
test("anonymous and ordinary agency roles cannot enter platform or forge activation authority", async ({
  page,
  otherIdentity,
  provisioner,
  activation,
}) => {
  await page.goto("/plataforma/agencias");
  await expect(page).toHaveURL(/\/login$/);
  await login(page, otherIdentity);
  expect((await page.goto("/plataforma/agencias"))?.status()).toBe(404);
  const ordinary = client(),
    anonymous = client();
  expect(
    (await ordinary.auth.signInWithPassword(otherIdentity)).error,
  ).toBeNull();
  expect(
    (await ordinary.auth.updateUser({ data: { role: "platform_admin" } }))
      .error,
  ).toBeNull();
  const version = z
    .uuid()
    .parse(
      (
        await provisioner
          .from("agencies")
          .select("status_version")
          .eq("id", activation.agency)
          .single()
      ).data?.status_version,
    );
  const args = {
    p_agency_id: activation.agency,
    p_is_active: false,
    p_expected_version: version,
  };
  expect((await ordinary.rpc("set_agency_active", args)).error?.code).toBe(
    "42501",
  );
  expect((await anonymous.rpc("set_agency_active", args)).error?.code).toBe(
    "42501",
  );
  await ordinary.auth.signOut({ scope: "local" });
  expect(
    (
      await provisioner
        .from("audit_events")
        .select("id")
        .eq("agency_id", activation.agency)
    ).data,
  ).toHaveLength(0);
});
