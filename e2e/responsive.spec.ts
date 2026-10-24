/** Key pages must not scroll horizontally at phone width. Uses seeded accounts. */
import { expect, test } from "@playwright/test";

const SHOTS = process.env.E2E_SCREENSHOTS;

for (const role of ["driver", "host"] as const) {
  test(`no horizontal overflow on mobile (${role})`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, isMobile: true });
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.getByLabel("Email").fill(`${role}@eber.dev`);
    await page.getByLabel("Password").fill("Eber@1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    const pages = role === "driver"
      ? ["/", "/chargers", "/bookings", "/profile", "/notifications", "/help", "/how-it-works", "/reviews", "/settings"]
      : ["/host", "/host/bookings", "/host/chargers", "/host/chargers/new", "/host/earnings", "/host/reviews"];
    if (role === "driver") {
      await page.goto("/chargers");
      const href = await page.locator('a[href^="/chargers/"]').first().getAttribute("href");
      if (href) pages.push(href.split("?")[0], `${href.split("?")[0]}/book`);
      await page.goto("/bookings?tab=upcoming");
      const b = await page.locator('a[href^="/bookings/"]').first().getAttribute("href");
      if (b) pages.push(b);
    } else {
      await page.goto("/host/chargers");
      const e = await page.locator('a[href$="/availability"]').first().getAttribute("href");
      if (e) pages.push(e, e.replace("/availability", "/edit"));
    }
    for (const p of pages) {
      await page.goto(p);
      await page.waitForLoadState("load");
      await page.waitForTimeout(800);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/m-${role}${p.replace(/[/?=]/g, "_")}.png`, fullPage: true });
      expect(overflow, `horizontal overflow on ${p}`).toBeLessThanOrEqual(1);
    }
    await ctx.close();
  });
}
