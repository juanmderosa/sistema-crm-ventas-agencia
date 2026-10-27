import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import { z } from "zod";
import { test, loginThroughUI } from "./fixtures";

const mailListSchema = z.object({
  messages: z.array(z.object({ ID: z.string() })),
});
const mailSchema = z.object({ HTML: z.string() });

test("recovery email works in another browser, changes only its owner and cannot be reused", async ({
  page,
  browser,
  identity,
  otherIdentity,
  request,
  baseURL,
}, testInfo) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Olvidé mi contraseña" }).click();
  await expect(
    page.getByRole("heading", { name: "Recuperar contraseña", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Correo electrónico").fill(identity.email);
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByRole("status")).toContainText("Si existe una cuenta");

  const mailbox = encodeURIComponent(`to:${identity.email}`);
  let mailId: string | undefined;
  await expect
    .poll(async () => {
      const response = await request.get(
        `http://127.0.0.1:54324/api/v1/search?query=${mailbox}`,
      );
      const messages = mailListSchema.parse(await response.json());
      mailId = messages.messages.at(-1)?.ID;
      return Boolean(mailId);
    })
    .toBe(true);
  const response = await request.get(
    `http://127.0.0.1:54324/api/v1/message/${mailId}`,
  );
  const html = mailSchema.parse(await response.json()).HTML;
  const match = html.match(/href="([^"]+)"/);
  const link = new URL(z.string().parse(match?.[1]).replaceAll("&amp;", "&"));
  expect(link.origin).toBe(baseURL);
  expect(link.pathname).toBe("/recuperar/confirmar");

  const context = await browser.newContext({
    viewport: page.viewportSize() ?? undefined,
  });
  try {
    const second = await context.newPage();
    // An existing session of someone else must not choose the password owner.
    await loginThroughUI(second, otherIdentity);
    await expect(second).toHaveURL(/\/panel/);
    const landing = await second.goto(link.href + "&next=https://example.org");
    expect(landing?.headers()["cache-control"]).toContain("no-store");
    expect(landing?.headers()["referrer-policy"]).toBe("no-referrer");
    // Opening/reloading never consumes the token or authenticates the recipient.
    await second.reload();
    await second.screenshot({
      path: testInfo.outputPath("recovery-password.png"),
      fullPage: true,
    });
    expect(
      await second.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const password = `${randomUUID()}!new`;
    await second.getByLabel("Nueva contraseña").fill(password);
    await second.getByLabel("Confirmar contraseña").fill(password);
    await second.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(second).toHaveURL(/\/login\?recovered=1$/);
    await expect(second.getByRole("status")).toContainText(
      "Contraseña actualizada",
    );
    await second.goto("/cuenta");
    await expect(second).toHaveURL(/\/login$/);
    await loginThroughUI(second, identity);
    await expect(
      second.getByRole("alert").filter({ hasText: /.+/ }),
    ).toContainText("incorrectos");
    await loginThroughUI(second, { ...identity, password });
    await expect(second).toHaveURL(/\/panel/);
    await second.goto(link.href);
    await second.getByLabel("Nueva contraseña").fill(`${password}x`);
    await second.getByLabel("Confirmar contraseña").fill(`${password}x`);
    await second.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(
      second.getByRole("alert").filter({ hasText: /.+/ }),
    ).toContainText("venció o ya fue utilizado");
    await second.goto("/cuenta");
    await second.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(second).toHaveURL(/\/login$/);
    await loginThroughUI(second, otherIdentity);
    await expect(second).toHaveURL(/\/panel/);
  } finally {
    await context.close();
  }
});

test("malformed, duplicate and forged tokens fail, even with a valid ordinary session", async ({
  page,
  identity,
}) => {
  await loginThroughUI(page, identity);
  await expect(page).toHaveURL(/\/panel/);
  for (const query of [
    "",
    "?token_hash=invalid",
    `?token_hash=${"a".repeat(56)}&token_hash=${"b".repeat(56)}`,
  ]) {
    await page.goto(`/recuperar/confirmar${query}`);
    await expect(
      page.getByRole("alert").filter({ hasText: /.+/ }),
    ).toContainText("inválido o está incompleto");
    await expect(
      page.getByRole("button", { name: "Guardar contraseña" }),
    ).toHaveCount(0);
  }
  await page.goto(`/recuperar/confirmar?token_hash=${"a".repeat(56)}`);
  await page.getByLabel("Nueva contraseña").fill("1234567");
  await page.getByLabel("Confirmar contraseña").fill("different");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(
    page.getByText("Usá al menos ocho caracteres.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Las contraseñas no coinciden.")).toBeVisible();
  await page.getByLabel("Nueva contraseña").fill("12345678");
  await page.getByLabel("Confirmar contraseña").fill("12345678");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /.+/ })).toContainText(
    "inválido, venció o ya fue utilizado",
  );
});

test("nonexistent account receives the same generic recovery response", async ({
  page,
}) => {
  await page.goto("/recuperar");
  await page
    .getByLabel("Correo electrónico")
    .fill(`absent-${randomUUID()}@example.test`);
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByRole("status")).toContainText("Si existe una cuenta");
});
