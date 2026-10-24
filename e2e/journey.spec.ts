/**
 * Full marketplace journey in sandbox mode: host onboarding → listing → driver
 * booking → approval → shared-code start → readings → failed then successful
 * payment → reviews → earnings. Requires SMS + payments in sandbox (no keys).
 */
import { expect, test, type Page } from "@playwright/test";

const SHOTS = process.env.E2E_SCREENSHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};
const uid = Date.now().toString(36);
const randPhone = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;

async function register(page: Page, role: "taker" | "giver", name: string, email: string) {
  await page.goto(`/register${role === "giver" ? "?role=giver" : ""}`);
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Charge123!");
  await page.locator('input[name="terms"]').check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(role === "giver" ? /\/host/ : /\/profile/);
}

test("driver and host complete a paid charging session", async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const driverCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const host = await hostCtx.newPage();
  const driver = await driverCtx.newPage();

  // --- Host onboarding -------------------------------------------------------
  await register(host, "giver", "Meera Host", `host-${uid}@e2e.dev`);
  await shot(host, "01-host-welcome");
  await host.goto("/profile#phone");
  await host.getByLabel("Mobile number").fill(randPhone());
  await host.getByRole("button", { name: "Send verification code" }).click();
  const codeText = await host.locator("text=Your code is").locator("span").innerText();
  await host.getByLabel(/Code sent to/).fill(codeText.trim());
  await host.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(host.getByText("Verified", { exact: true })).toBeVisible();

  // --- Create listing ----------------------------------------------------------
  await host.goto("/host/chargers/new");
  await host.getByLabel("Listing title").fill(`E2E driveway charger ${uid}`);
  await host.getByLabel("Description").fill("Type 2 wallbox in a covered carport.");
  await host.getByLabel("Street address").fill("7 Test Street, 4th Cross");
  await host.getByLabel("Locality / neighbourhood").fill("Jayanagar");
  await host.getByLabel("PIN code").fill("560041");
  // Saving without placing the pin is refused.
  await host.getByRole("button", { name: "Save & set availability" }).click();
  await expect(host.getByText("Place the map pin on your charger's location").first()).toBeVisible();
  await host.getByRole("button", { name: "Find address on map" }).click();
  await expect(host.getByText(/Pin moved to/)).toBeVisible();
  await host.getByLabel("Slot length").selectOption("30");
  await host.getByLabel("Arrival & access instructions").fill("Blue gate, ring twice.");
  await shot(host, "02-host-new-listing");
  await host.getByRole("button", { name: "Save & set availability" }).click();
  await host.waitForURL(/\/availability\?created=1/);
  const chargerId = host.url().split("/host/chargers/")[1].split("/")[0];
  await host.getByRole("button", { name: "Every day, 24 hours" }).click();
  await host.getByRole("button", { name: "Save weekly hours" }).click();
  await expect(host.getByText("Weekly availability saved")).toBeVisible();
  await host.getByRole("button", { name: "Publish listing" }).click();
  await expect(host.getByText("Your listing is live").first()).toBeVisible();
  await shot(host, "03-host-availability");

  // --- Driver onboarding + vehicle -------------------------------------------
  await register(driver, "taker", "Kabir Driver", `driver-${uid}@e2e.dev`);
  await driver.getByLabel("Nickname").fill("Daily");
  await driver.getByLabel("Make & model").fill("Test EV 60");
  await driver.getByLabel("Usable battery capacity (kWh)").fill("60");
  await driver.getByRole("button", { name: "Save vehicle" }).click();
  await expect(driver.getByText("Test EV 60")).toBeVisible();

  // --- Discover + details ------------------------------------------------------
  await driver.goto("/chargers?lat=12.9716&lng=77.5946&place=Bengaluru&radius=25");
  await expect(driver.getByRole("heading", { name: /Home chargers near/ })).toBeVisible();
  await shot(driver, "04-driver-search-mobile");
  await driver.goto(`/chargers/${chargerId}`);
  await expect(driver.getByText("exact address, map pin and arrival instructions")).toBeVisible();
  await expect(driver.getByText("7 Test Street")).toHaveCount(0); // private before booking
  await shot(driver, "05-driver-charger-details-mobile");

  // --- Book ----------------------------------------------------------------------
  await driver.goto(`/chargers/${chargerId}/book`);
  const firstSlot = driver.locator("form button[type=button]:not([disabled])").filter({ hasText: /\d:\d\d/ }).first();
  await firstSlot.click();
  await shot(driver, "06-driver-book-mobile");
  await driver.getByRole("button", { name: "Request booking" }).click();
  await driver.waitForURL(/\/bookings\/[0-9a-f-]+\?new=1/);
  const bookingId = driver.url().split("/bookings/")[1].split("?")[0];
  await expect(driver.getByText("Request sent")).toBeVisible();

  // Another user can't see it.
  const strangerCtx = await browser.newContext();
  const stranger = await strangerCtx.newPage();
  await register(stranger, "taker", "Nosy Person", `nosy-${uid}@e2e.dev`);
  await stranger.goto(`/bookings/${bookingId}`);
  await expect(stranger.getByText("We couldn't find that page")).toBeVisible();
  await expect(stranger.getByText("Request sent")).toHaveCount(0);
  await strangerCtx.close();

  // --- Host approves --------------------------------------------------------------
  await host.goto(`/host/bookings/${bookingId}`);
  await host.getByRole("button", { name: "Approve" }).click();
  await expect(host.getByRole("heading", { name: "Start the session" })).toBeVisible();

  // --- Driver shows code; host verifies --------------------------------------------
  await driver.goto(`/bookings/${bookingId}`);
  await expect(driver.getByText("7 Test Street, 4th Cross")).toBeVisible(); // address revealed
  await driver.getByRole("button", { name: "Show my start code" }).click();
  const codeEl = driver.locator("div.font-mono.text-5xl");
  await expect(codeEl).toBeVisible();
  const code = (await codeEl.innerText()).replace(/\s/g, "");
  expect(code).toMatch(/^\d{6}$/);
  await shot(driver, "07-driver-start-code-mobile");

  await host.reload();
  await host.getByLabel("6-digit code").fill(code === "000000" ? "111111" : "000000");
  await host.getByRole("button", { name: "Verify code" }).click();
  await expect(host.getByText(/Incorrect code/).first()).toBeVisible();
  await host.getByLabel("6-digit code").fill(code);
  await host.getByRole("button", { name: "Verify code" }).click();
  await expect(host.getByText("Code verified").first()).toBeVisible();
  await host.locator('input[name="percent"]').fill("30");
  await host.getByRole("button", { name: "Record start & begin charging" }).click();
  await expect(host.getByText(/Charging since/)).toBeVisible();
  await shot(host, "08-host-active-session");

  await driver.reload();
  await expect(driver.getByText("Charging in progress")).toBeVisible();

  // --- End session → bill -------------------------------------------------------------
  await host.locator('input[name="percent"]').fill("20");
  await host.getByRole("button", { name: "Record end & send bill" }).click();
  await expect(host.getByText(/can't be lower/).first()).toBeVisible();
  await host.locator('input[name="percent"]').fill("70");
  await host.getByRole("button", { name: "Record end & send bill" }).click();
  await expect(host.getByText("Session billing summary")).toBeVisible();
  await expect(host.getByText("₹288.00").first()).toBeVisible();

  // --- Pay: failure first, then success ---------------------------------------------
  await driver.goto(`/bookings/${bookingId}/pay`);
  await expect(driver.getByText("24 kWh").first()).toBeVisible();
  await expect(driver.getByText("₹288.00").first()).toBeVisible();
  await shot(driver, "09-driver-bill-mobile");
  await driver.getByRole("button", { name: /Pay ₹288.00/ }).click();
  await driver.waitForURL(/\/pay\/sandbox\//);
  await shot(driver, "10-sandbox-gateway-mobile");
  await driver.getByRole("button", { name: "Simulate failure" }).click();
  await driver.waitForURL(/\/pay\?returned=1/);
  await expect(driver.getByText("Payment failed").first()).toBeVisible();
  // Reviews must not be available yet.
  await driver.goto(`/bookings/${bookingId}`);
  await expect(driver.getByText("Post review")).toHaveCount(0);
  await driver.goto(`/bookings/${bookingId}/pay`);
  await driver.getByRole("button", { name: /Retry ₹288.00/ }).click();
  await driver.waitForURL(/\/pay\/sandbox\//);
  await driver.getByRole("button", { name: "Simulate successful payment" }).click();
  await driver.waitForURL(/\/pay\?returned=1/);
  await expect(driver.getByRole("heading", { name: "Payment confirmed" })).toBeVisible();
  await shot(driver, "11-driver-paid-mobile");

  // --- Receipt + reviews -----------------------------------------------------------
  await driver.goto(`/bookings/${bookingId}/receipt`);
  await expect(driver.getByText("Total paid")).toBeVisible();
  await driver.goto(`/bookings/${bookingId}`);
  await driver.getByRole("radio", { name: "5 stars" }).click();
  await driver.locator('textarea[name="comment"]').fill("Smooth session, friendly host.");
  await driver.getByRole("button", { name: "Post review" }).click();
  await expect(driver.getByText(/Your review of/)).toBeVisible();

  await host.goto(`/host/bookings/${bookingId}`);
  await host.getByRole("radio", { name: "4 stars" }).click();
  await host.getByRole("button", { name: "Post review" }).click();
  await expect(host.getByText(/Your review of/)).toBeVisible();
  await expect(host.getByText(/reviewed you/)).toBeVisible();

  // --- Earnings & notifications --------------------------------------------------
  await host.goto("/host/earnings");
  await expect(host.getByText("₹288.00").first()).toBeVisible();
  await shot(host, "12-host-earnings");
  await driver.goto("/notifications");
  await expect(driver.getByText("Payment successful")).toBeVisible();
  await expect(driver.getByText("Payment failed").first()).toBeVisible();
  await shot(driver, "13-driver-notifications-mobile");

  await hostCtx.close();
  await driverCtx.close();
});
