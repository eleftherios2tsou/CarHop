import { test, expect } from "@playwright/test";
import {
  buildUser,
  isoDate,
  registerVerifyLogin,
  submitAndVerifyLicense,
  authedPost,
  createCar,
} from "./helpers/auth";
import {
  seedApprovedBooking,
  seedCompletedBooking,
  blockDates,
} from "./helpers/flows";

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
  if (tabLabel !== "Marketplace") {
    await page.getByRole("button", { name: "Navigation menu" }).click();
  }
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
    await expect(renterRow).toContainText(/(HELD_IN_ESCROW|PAYMENT_PENDING)/, {
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
    await expect(ownerRow).toContainText("RELEASED_TO_OWNER");
  } finally {
    await ownerContext.close();
    await renterContext.close();
  }
});

test("cancellation journey: renter cancels approved booking and sees CANCELLED", async ({ browser }) => {
  const { ownerContext, renterContext } = await setupUsers(browser);
  try {
    const { bookingId } = await seedApprovedBooking({
      ownerContext,
      renterContext,
      startDate: isoDate(5),
      endDate: isoDate(8),
      make: "Nissan",
      model: `E2ECancel${Date.now()}`,
    });

    const renterPage = await renterContext.newPage();
    // Accept the window.confirm refund dialog automatically
    renterPage.on("dialog", (dialog) => dialog.accept());

    await openTab(renterPage, "My Bookings");
    const renterRow = renterPage.locator(".rowCard").filter({
      hasText: `Booking #${bookingId}`,
    });
    await renterRow.getByRole("button", { name: "Cancel" }).click();
    await expect(renterRow).toContainText("CANCELLED", { timeout: 10000 });
  } finally {
    await ownerContext.close();
    await renterContext.close();
  }
});

test("damage report journey: owner files report on completed booking", async ({ browser }) => {
  const { ownerContext, renterContext } = await setupUsers(browser);
  try {
    const { bookingId, completed } = await seedCompletedBooking({
      ownerContext,
      renterContext,
      startDate: isoDate(-4),
      endDate: isoDate(-2),
      make: "Volvo",
      model: `E2EDamage${Date.now()}`,
    });
    // Skip in Stripe mode — payment stays PAYMENT_PENDING, escrow never released
    if (!completed) return;

    const ownerPage = await ownerContext.newPage();
    await openTab(ownerPage, "Incoming Bookings");
    const ownerRow = ownerPage.locator(".rowCard").filter({
      hasText: `Booking #${bookingId}`,
    });

    await ownerRow.getByRole("button", { name: "File Damage Report" }).click();
    await ownerPage.getByLabel("Description").fill("Front bumper scuffed during the rental");
    await ownerPage.getByRole("button", { name: "Submit Report" }).click();

    await expect(ownerRow).toContainText("OPEN", { timeout: 10000 });
  } finally {
    await ownerContext.close();
    await renterContext.close();
  }
});

test("review journey: renter leaves car review after completed rental", async ({ browser }) => {
  const { ownerContext, renterContext } = await setupUsers(browser);
  try {
    const { bookingId, completed } = await seedCompletedBooking({
      ownerContext,
      renterContext,
      startDate: isoDate(-4),
      endDate: isoDate(-2),
      make: "Audi",
      model: `E2EReview${Date.now()}`,
    });
    // Skip in Stripe mode
    if (!completed) return;

    const renterPage = await renterContext.newPage();
    await openTab(renterPage, "My Bookings");
    const renterRow = renterPage.locator(".rowCard").filter({
      hasText: `Booking #${bookingId}`,
    });

    // Select 5-star rating and fill comment
    await renterRow.getByLabel("Rating").selectOption("5");
    await renterRow.locator("input[placeholder='How was the owner and car?']").fill("Great car, very clean and easy to drive");
    await renterRow.getByRole("button", { name: "Leave Review" }).click();

    // After submission a "Reviewed" label appears and the Leave Review button disappears
    await expect(renterRow).toContainText("Reviewed", { timeout: 10000 });
  } finally {
    await ownerContext.close();
    await renterContext.close();
  }
});

test("availability blocks: renter cannot book a blocked date range", async ({ browser }) => {
  const { ownerContext, renterContext } = await setupUsers(browser);
  try {
    const car = await createCar(ownerContext, {
      make: "BMW",
      model: `E2EBlock${Date.now()}`,
    });

    // Owner blocks isoDate(3) → isoDate(6)
    await blockDates(ownerContext, car.id, isoDate(3), isoDate(6));

    // Renter attempts to book those exact dates — expects 409 Conflict
    const bookRes = await authedPost(renterContext, `/api/bookings/${car.id}`, {
      start_date: isoDate(3),
      end_date: isoDate(6),
    });
    expect(bookRes.status()).toBe(409);
  } finally {
    await ownerContext.close();
    await renterContext.close();
  }
});
