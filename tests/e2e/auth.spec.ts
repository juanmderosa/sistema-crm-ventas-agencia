import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { combineChunks, createChunks } from "@supabase/ssr";
import { expect } from "@playwright/test";
import { z } from "zod";
import { test } from "./fixtures";

test("anonymous requests cannot render account details", async ({ page }) => {
  const response = await page.goto("/cuenta");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Ingresar" })).toBeVisible();
  expect(response?.headers()["cache-control"]).toContain("no-store");
});

test("real login persists across reload and logout removes access", async ({
  page,
  identity,
}) => {
  await page.goto("/login?next=https://example.org");
  await page.getByLabel("Correo electrónico").fill(identity.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(identity.password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(
    page.getByRole("heading", { name: "Sin acceso habilitado" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Mi cuenta" }).click();
  await expect(page.getByRole("heading", { name: "Mi cuenta" })).toBeVisible();
  await expect(page.getByText(identity.email, { exact: true })).toBeVisible();
  const response = await page.reload();
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(page.getByText(identity.email, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/cuenta");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText(identity.email, { exact: true })).toHaveCount(0);
});

test("bad credentials remain on login with a generic error", async ({
  page,
  identity,
}) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(identity.email);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("incorrect-password");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "El correo" }),
  ).toHaveText("El correo o la contraseña son incorrectos.");
  await expect(page).toHaveURL(/\/login$/);
});

test("email login provider is available while public registration stays disabled", async () => {
  const env = z
    .object({
      NEXT_PUBLIC_SUPABASE_URL: z.url(),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    })
    .parse(process.env);
  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client.auth.signUp({
    email: `signup-${randomUUID()}@example.test`,
    password: `${randomUUID()}!Aa7`,
  });
  if (data.user) {
    // If registration regresses, retire only the unique identity just created.
    const adminKey = z
      .string()
      .min(1)
      .parse(process.env.SUPABASE_TEST_SERVICE_ROLE_KEY);
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: cleanupError } = await admin.auth.admin.deleteUser(
      data.user.id,
    );
    if (cleanupError)
      throw new Error(
        "No se pudo retirar la identidad del control de registro.",
      );
  }
  expect(error?.code).toBe("signup_disabled");
  expect(data.user).toBeNull();
});

test("login validates fields and fits a narrow viewport", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await page.screenshot({
    path: testInfo.outputPath("login.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByText("Ingresá un correo válido.")).toBeVisible();
  await expect(page.getByText("Ingresá tu contraseña.")).toBeVisible();
  await expect(page.getByLabel("Correo electrónico")).toBeFocused();
  await expect(page.getByLabel("Correo electrónico")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Correo electrónico")).toHaveAttribute(
    "aria-describedby",
    "email-error",
  );
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute(
    "aria-describedby",
    "password-error",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});

test("proxy renews an expired session record through real Auth and persists cookies", async ({
  page,
  context,
  identity,
}) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(identity.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(identity.password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(/\/panel$/);
  const cookies = await context.cookies();
  const authCookie = cookies.find(
    (cookie) =>
      cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"),
  );
  if (!authCookie) throw new Error("No se guardó la cookie de sesión.");
  const key = authCookie.name.replace(/\.\d+$/, "");
  const raw = await combineChunks(
    key,
    (name) => cookies.find((cookie) => cookie.name === name)?.value,
  );
  if (!raw?.startsWith("base64-"))
    throw new Error("Formato de sesión inesperado.");
  const session = z
    .looseObject({
      expires_at: z.number(),
      access_token: z.string(),
      refresh_token: z.string(),
    })
    .parse(JSON.parse(Buffer.from(raw.slice(7), "base64url").toString("utf8")));
  // Mark the stored expiry stale; real refresh token is redeemed with local Auth.
  const expired =
    "base64-" +
    Buffer.from(JSON.stringify({ ...session, expires_at: 1 })).toString(
      "base64url",
    );
  await context.clearCookies({ name: /^sb-/ });
  await context.addCookies(
    createChunks(key, expired).map(({ name, value }) => ({
      name,
      value,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    })),
  );
  const response = await page.reload();
  await expect(page.getByText(identity.email, { exact: true })).toBeVisible();
  expect(response?.headers()["cache-control"]).toContain("no-store");
  const refreshedCookies = await context.cookies();
  const refreshed = await combineChunks(
    key,
    (name) => refreshedCookies.find((cookie) => cookie.name === name)?.value,
  );
  expect(refreshed !== expired).toBe(true);
  expect(
    refreshedCookies
      .filter((cookie) => cookie.name.startsWith(key))
      .every((cookie) => cookie.httpOnly && cookie.sameSite === "Lax"),
  ).toBe(true);
  await page.reload();
  await expect(page.getByText(identity.email, { exact: true })).toBeVisible();
});

test("forged session storage cannot render another identity", async ({
  page,
  context,
}) => {
  const url = new URL(z.url().parse(process.env.NEXT_PUBLIC_SUPABASE_URL));
  const storageKey = `sb-${url.hostname.split(".")[0]}-auth-token`;
  const future = Math.floor(Date.now() / 1000) + 3600;
  const jwt = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: randomUUID(),
        aud: "authenticated",
        role: "authenticated",
        exp: future,
      }),
    ).toString("base64url"),
    Buffer.from("invalid-signature").toString("base64url"),
  ].join(".");
  const forged =
    "base64-" +
    Buffer.from(
      JSON.stringify({
        access_token: jwt,
        refresh_token: "invalid",
        expires_at: future,
        token_type: "bearer",
        user: { id: randomUUID(), email: "forged@example.test" },
      }),
    ).toString("base64url");
  await context.addCookies(
    createChunks(storageKey, forged).map(({ name, value }) => ({
      name,
      value,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    })),
  );
  await page.goto("/cuenta");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByText("forged@example.test", { exact: true }),
  ).toHaveCount(0);
});
