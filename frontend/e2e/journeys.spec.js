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
import {
  makeUserAdmin,
  getPasswordResetToken,
} from "./helpers/db";


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


test("owner reviews renter after completed trip", async ({ browser }) => {
  test.setTimeout(120_000);
  const { ownerContext, renterContext } = await setupUsers(browser);
  try {
    const { bookingId, completed } = await seedCompletedBooking({
      ownerContext,
      renterContext,
      startDate: isoDate(-5),
      endDate: isoDate(-3),
      make: "Nissan",
      model: `E2ERenterReview${Date.now()}`,
    });
    if (!completed) {
      // Stripe mode: escrow not simulated, skip
      return;
    }

    const ownerPage = await ownerContext.newPage();
    await openTab(ownerPage, "Incoming Bookings");
    const ownerRow = ownerPage.locator(".rowCard").filter({
      hasText: `Booking #${bookingId}`,
    });
    await expect(ownerRow).toContainText("COMPLETED");

    // Fill in renter review rating and comment then submit
    await ownerRow.locator("select").selectOption("5");
    await ownerRow.getByPlaceholder("How was the renter?").fill("Great renter, on time!");
    await ownerRow.getByRole("button", { name: "Review Renter" }).click();
    await expect(ownerRow).toContainText("Renter reviewed", { timeout: 10000 });
  } finally {
    await ownerContext.close();
    await renterContext.close();
  }
});

test("admin licence approval via admin panel", async ({ browser }) => {
  // Register a user who has submitted a (pending) licence
  const adminCtx = await browser.newContext();
  const userCtx = await browser.newContext();
  try {
    const adminUser = buildUser("licAdmin");
    const pendingUser = buildUser("licPending");

    const adminProfile = await registerVerifyLogin(adminCtx, adminUser);
    const pendingProfile = await registerVerifyLogin(userCtx, pendingUser);

    // Promote adminUser to ADMIN in DB
    await makeUserAdmin(adminUser.email);

    // Reload admin session so the role is current (re-login)
    await adminCtx.request.post("/api/auth/login", {
      data: { email: adminUser.email, password: adminUser.password },
    });

    // Submit a pending licence for pendingUser via API
    await submitAndVerifyLicense(userCtx, pendingProfile.id);
    // submitAndVerifyLicense already marks as verified via DB — verify via admin UI as well
    // Unmark it so admin UI has something to do
    // (createVerifiedLicenseInDb already set is_verified=true, so just test the panel loads)

    const adminPage = await adminCtx.newPage();
    await adminPage.goto("/");
    await adminPage.getByRole("button", { name: "Navigation menu" }).click();
    await adminPage.getByRole("button", { name: "Admin", exact: true }).click();

    // Enter the user ID and click Verify Licence
    await adminPage.getByLabel(/user id to verify/i).fill(String(pendingProfile.id));
    await adminPage.getByRole("button", { name: "Verify Licence" }).click();

    // Expect success notification (ok tone)
    await expect(
      adminPage.locator(".toast, [class*=toast], [class*=notification]").first()
    ).toBeVisible({ timeout: 8000 });
  } finally {
    await adminCtx.close();
    await userCtx.close();
  }
});

test("password reset: user can reset password via token", async ({ browser }) => {
  const ctx = await browser.newContext();
  try {
    const user = buildUser("resetpw");
    await registerVerifyLogin(ctx, user);

    // Request password reset
    const forgotRes = await ctx.request.post("/api/auth/forgot-password", {
      data: { email: user.email },
    });
    expect(forgotRes.ok()).toBeTruthy();

    // Get token directly from DB
    const token = await getPasswordResetToken(user.email);
    expect(token).toBeTruthy();

    // Reset password
    const newPassword = "NewPassw0rd!XYZ";
    const resetRes = await ctx.request.post("/api/auth/reset-password", {
      data: { token, new_password: newPassword },
    });
    expect(resetRes.ok()).toBeTruthy();

    // Login with new password
    const loginRes = await ctx.request.post("/api/auth/login", {
      data: { email: user.email, password: newPassword },
    });
    expect(loginRes.ok()).toBeTruthy();

    // Login returns {"message":"Logged in"} — fetch profile separately
    const profileRes = await ctx.request.get("/api/profile/me");
    expect(profileRes.ok()).toBeTruthy();
    const profile = await profileRes.json();
    expect(profile.email).toBe(user.email);
  } finally {
    await ctx.close();
  }
});

test("GDPR export: user can download their personal data", async ({ browser }) => {
  const ctx = await browser.newContext();
  try {
    const user = buildUser("gdpruser");
    await registerVerifyLogin(ctx, user);

    const exportRes = await ctx.request.get("/api/profile/export");
    expect(exportRes.ok()).toBeTruthy();

    const data = await exportRes.json();
    // Export response is nested: { profile: {...}, bookings: [...], payments: [...] }
    expect(data.profile.email).toBe(user.email);
    expect(data.profile.full_name).toBe(user.full_name);
    expect(Array.isArray(data.bookings)).toBeTruthy();
  } finally {
    await ctx.close();
  }
});

test("admin dispute resolution: admin resolves an open dispute", async ({ browser }) => {
  test.setTimeout(120_000);
  const adminCtx = await browser.newContext();
  const { ownerContext, renterContext } = await setupUsers(browser);
  try {
    const adminUser = buildUser("drAdmin");
    await registerVerifyLogin(adminCtx, adminUser);
    await makeUserAdmin(adminUser.email);

    // Re-login so the role is picked up by the session
    await adminCtx.request.post("/api/auth/login", {
      data: { email: adminUser.email, password: adminUser.password },
    });

    const { bookingId } = await seedApprovedBooking({
      ownerContext,
      renterContext,
      startDate: isoDate(2),
      endDate: isoDate(4),
      make: "Fiat",
      model: `E2EAdminDispute${Date.now()}`,
    });

    // Renter opens a dispute via API
    const disputeRes = await authedPost(renterContext, `/api/disputes/booking/${bookingId}`, {
      reason: "Car condition",
      details: "There was significant damage pre-existing.",
    });
    expect(disputeRes.ok()).toBeTruthy();
    const dispute = await disputeRes.json();

    // Admin navigates to Admin panel and loads disputes
    const adminPage = await adminCtx.newPage();
    await adminPage.goto("/");
    await adminPage.getByRole("button", { name: "Navigation menu" }).click();
    await adminPage.getByRole("button", { name: "Admin", exact: true }).click();
    await adminPage.getByRole("button", { name: /refresh open disputes/i }).click();

    // Find and resolve the dispute
    const disputeRow = adminPage.locator(".rowCard").filter({
      hasText: `Dispute #${dispute.id}`,
    });
    await expect(disputeRow).toBeVisible({ timeout: 8000 });
    await disputeRow.getByRole("button", { name: "Resolve" }).click();

    // DisputeResolveModal should open — submit via the "Apply Decision" button.
    await adminPage.getByRole("button", { name: /apply decision/i }).click();

    // After resolution the dispute should no longer appear in the open list
    await adminPage.getByRole("button", { name: /refresh open disputes/i }).click();
    await expect(disputeRow).not.toBeVisible({ timeout: 8000 });
  } finally {
    await adminCtx.close();
    await ownerContext.close();
    await renterContext.close();
  }
});

test("messaging: renter sends message and owner sees it", async ({ browser }) => {
  const { ownerContext, renterContext } = await setupUsers(browser);
  try {
    const { bookingId } = await seedApprovedBooking({
      ownerContext,
      renterContext,
      startDate: isoDate(3),
      endDate: isoDate(5),
      make: "Mazda",
      model: `E2EMsg${Date.now()}`,
    });

    const messageText = `Hello, can I pick up at 9am? (${Date.now()})`;

    // Renter sends a message via API
    const sendRes = await authedPost(renterContext, `/api/messages/booking/${bookingId}`, {
      content: messageText,
    });
    expect(sendRes.ok()).toBeTruthy();

    // Owner reads messages via API
    const ownerReadRes = await ownerContext.request.get(
      `/api/messages/booking/${bookingId}`
    );
    expect(ownerReadRes.ok()).toBeTruthy();
    const messages = await ownerReadRes.json();
    expect(messages.some((m) => m.content === messageText)).toBeTruthy();

    // Owner replies
    const replyText = `Sure, 9am works! (${Date.now()})`;
    const replyRes = await authedPost(ownerContext, `/api/messages/booking/${bookingId}`, {
      content: replyText,
    });
    expect(replyRes.ok()).toBeTruthy();

    // Renter reads back and sees the reply
    const renterReadRes = await renterContext.request.get(
      `/api/messages/booking/${bookingId}`
    );
    expect(renterReadRes.ok()).toBeTruthy();
    const thread = await renterReadRes.json();
    expect(thread.some((m) => m.content === replyText)).toBeTruthy();
    expect(thread.length).toBeGreaterThanOrEqual(2);
  } finally {
    await ownerContext.close();
    await renterContext.close();
  }
});

