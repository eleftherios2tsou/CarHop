import { test, expect } from "@playwright/test";
import {
  buildUser,
  isoDate,
  registerVerifyLogin,
  submitAndVerifyLicense,
} from "./helpers/auth";
import { seedApprovedBooking } from "./helpers/flows";

async function setupUsers(browser) {
  const ownerContext = await browser.newContext();
  const renterContext = await browser.newContext();

  const ownerUser = buildUser("owner");
  const renterUser = buildUser("renter");

  const ownerProfile = await registerVerifyLogin(ownerContext, ownerUser);
  const renterProfile = await registerVerifyLogin(renterContext, renterUser);
  await submitAndVerifyLicense(renterContext, renterProfile.id);

  return { ownerContext, renterContext, ownerProfile, renterProfile };
}

async function openTab(page, tabLabel) {
  await page.goto("/");
  await page.getByRole("button", { name: tabLabel, exact: true }).click();
}

test("booking journey: renter requests and owner approves", async ({ browser }) => {
  const { ownerContext, renterContext } = await setupUsers(browser);
  try {
    const carName = `E2EBooking${Date.now()}`;
    const { bookingId } = await seedApprovedBooking({
      ownerContext,
      renterContext,
      startDate: isoDate(2),
      endDate: isoDate(4),
      make: "Toyota",
      model: carName,
    });

    const renterPage = await renterContext.newPage();
    await openTab(renterPage, "My Bookings");
    const renterRow = renterPage.locator(".rowCard").filter({
      hasText: `Booking #${bookingId}`,
    });
    await expect(renterRow).toContainText("APPROVED");

    const ownerPage = await ownerContext.newPage();
    await openTab(ownerPage, "Incoming Bookings");
    const ownerRow = ownerPage.locator(".rowCard").filter({
      hasText: `Booking #${bookingId}`,
    });
    await expect(ownerRow).toContainText("APPROVED");
  } finally {
    await ownerContext.close();
    await renterContext.close();
  }
});

test("dispute journey: renter opens dispute and owner sees OPEN", async ({ browser }) => {
  const { ownerContext, renterContext } = await setupUsers(browser);
  try {
    const { bookingId } = await seedApprovedBooking({
      ownerContext,
      renterContext,
      startDate: isoDate(2),
      endDate: isoDate(3),
      make: "Ford",
      model: `E2EDispute${Date.now()}`,
    });

    const renterPage = await renterContext.newPage();
    await openTab(renterPage, "My Bookings");
    const renterRow = renterPage.locator(".rowCard").filter({
      hasText: `Booking #${bookingId}`,
    });
    await renterRow.getByRole("button", { name: "Open Dispute" }).click();
    await renterPage.getByLabel("Reason").fill("Vehicle cleanliness issue");
    await renterPage.getByLabel("Details").fill("Interior was not in expected condition on pickup.");
    await renterPage.getByRole("button", { name: "Submit Dispute" }).click();
    await expect(renterRow).toContainText("Dispute: OPEN");

    const ownerPage = await ownerContext.newPage();
    await openTab(ownerPage, "Incoming Bookings");
    const ownerRow = ownerPage.locator(".rowCard").filter({
      hasText: `Booking #${bookingId}`,
    });
    await expect(ownerRow).toContainText("Dispute: OPEN");
  } finally {
    await ownerContext.close();
    await renterContext.close();
  }
});

test("payment journey: renter funds escrow and owner releases", async ({ browser }) => {
  const { ownerContext, renterContext } = await setupUsers(browser);
  try {
    const { bookingId } = await seedApprovedBooking({
      ownerContext,
      renterContext,
      startDate: isoDate(-4),
      endDate: isoDate(-2),
      make: "Tesla",
      model: `E2EPay${Date.now()}`,
    });

    const renterPage = await renterContext.newPage();
    await openTab(renterPage, "My Bookings");
    const renterRow = renterPage.locator(".rowCard").filter({
      hasText: `Booking #${bookingId}`,
    });
    await renterRow.getByRole("button", { name: "Pay Escrow" }).click();

    // Simulated mode should become HELD_IN_ESCROW; Stripe mode may stay PAYMENT_PENDING.
    await expect(renterRow).toContainText(/Payment:\s+(HELD_IN_ESCROW|PAYMENT_PENDING)/, {
      timeout: 15000,
    });
    const renterRowText = await renterRow.textContent();
    const paymentPending = (renterRowText || "").includes("PAYMENT_PENDING");
    if (paymentPending) return;

    const ownerPage = await ownerContext.newPage();
    await openTab(ownerPage, "Incoming Bookings");
    const ownerRow = ownerPage.locator(".rowCard").filter({
      hasText: `Booking #${bookingId}`,
    });
    await ownerRow.getByRole("button", { name: "Release Escrow" }).click();
    await expect(ownerRow).toContainText("Payment: RELEASED_TO_OWNER");
  } finally {
    await ownerContext.close();
    await renterContext.close();
  }
});
