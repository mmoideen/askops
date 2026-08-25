import { expect, test } from "@playwright/test";

test("health endpoint reports ok with the database up", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.db).toBe("up");
});

test("unauthenticated home redirects to sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/signin/);
  await expect(page.getByRole("heading", { name: "AskOps" })).toBeVisible();
});

test("unauthenticated ask API is rejected", async ({ request }) => {
  const res = await request.post("/api/ask", {
    data: { question: "does auth work?" },
  });
  expect(res.status()).toBe(401);
});
