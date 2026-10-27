import { expect, test } from "@playwright/test";

test("foundation identifies its scope without claiming working business features", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Una base común.",
  );
  await expect(
    page.getByText("todavía no ofrece acceso", { exact: false }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es-AR");
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
});

test("keyboard can skip directly to main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Saltar al contenido" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});
