import { expect, test } from "@playwright/test";

// Runs against the "demo" project (DEMO_MODE=true), the shape of the
// public portfolio instance. A session is still required on every route;
// in this mode a missing one is issued automatically as demo-member.

test("first visit lands on the console as member without a click", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".identity .operator")).toHaveText("Demo Member");
  await expect(page.locator(".identity .chip")).toHaveText("member");
  await expect(page.getByRole("link", { name: "Audit log" })).toHaveCount(0);
});

test("the header switcher swaps the clearance and back", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ops admin" }).click();
  await expect(page.locator(".identity .operator")).toHaveText(
    "Demo Ops Admin",
  );
  await expect(page.locator(".identity .chip")).toHaveText("ops_admin");
  await expect(page.getByRole("link", { name: "Audit log" })).toBeVisible();

  await page.getByRole("button", { name: "Member" }).click();
  await expect(page.locator(".identity .operator")).toHaveText("Demo Member");
  await expect(page.getByRole("link", { name: "Audit log" })).toHaveCount(0);
});

test("a deep link is honoured after the automatic session", async ({
  page,
}) => {
  await page.goto("/admin/audit");
  // The visit went through the issuer, not the sign in page, and landed on
  // the page that was asked for. demo-member is not elevated, so that page
  // shows its restricted view rather than the log.
  await expect(page).toHaveURL(/\/admin\/audit$/);
  await expect(page.getByText(/requires the ops_admin role/)).toBeVisible();
  await expect(page.getByText(/Your clearance is member/)).toBeVisible();
});

test("the issuer refuses to leave the origin", async ({ request }) => {
  const res = await request.get(
    "/api/auth/demo?callbackUrl=https://evil.example",
    { maxRedirects: 0 },
  );
  expect(res.status()).toBe(307);
  expect(res.headers()["location"]).toMatch(/^http:\/\/localhost:3301\/$/);
});

test("an unknown role parameter defaults to member", async ({ page }) => {
  await page.goto("/api/auth/demo?role=superuser");
  await expect(page.locator(".identity .operator")).toHaveText("Demo Member");
});

test("unauthenticated ask API is still rejected in demo mode", async ({
  request,
}) => {
  const res = await request.post("/api/ask", {
    data: { question: "does auth still gate the API?" },
  });
  expect(res.status()).toBe(401);
});
