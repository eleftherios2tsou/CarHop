import { expect } from "@playwright/test";
import { getVerificationToken, createVerifiedLicenseInDb } from "./db";

// helper to get a date string like "2025-01-15" that is N days from today
// positive = future, negative = past (useful for seeding completed bookings)
export function isoDate(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10); // trim off the time portion, we just need the date
}

// builds a unique user object for each test so tests don't collide with each other
// the timestamp + random number combination makes email addresses unique even when tests run in parallel
export function buildUser(prefix) {
  const stamp = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  return {
    email: `${prefix}_${stamp}@example.com`,
    password: "Passw0rd!Passw0rd!", // same password for all test users — easy to remember
    full_name: `${prefix} user`,
    date_of_birth: "1991-01-01", // old enough to rent (must be 21+)
  };
}

// registers a new user, verifies their email, and logs them in — all in one go
// returns the user's profile object so tests can access their ID and other fields
export async function registerVerifyLogin(context, user) {
  // use a random IP address to avoid hitting the rate limiter during tests
  const ip = `10.20.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`;
  const rateLimitHeaders = { "x-forwarded-for": ip };

  // step 1: register the account
  const registerRes = await context.request.post("/api/auth/register", {
    data: user,
    headers: rateLimitHeaders,
  });
  expect(registerRes.ok()).toBeTruthy();

  // step 2: get the verification token — the backend sends it by email, so we read it from the DB directly
  // this keeps tests independent of actual email delivery (which we don't want to test here)
  const token = await getVerificationToken(user.email);
  expect(token).toBeTruthy();

  // step 3: verify the email using the token we just fetched
  const verifyRes = await context.request.post(`/api/auth/verify-email/${token}`, {
    headers: rateLimitHeaders,
  });
  expect(verifyRes.ok()).toBeTruthy();

  // step 4: log in with the credentials
  const loginRes = await context.request.post("/api/auth/login", {
    data: { email: user.email, password: user.password },
    headers: rateLimitHeaders,
  });
  expect(loginRes.ok()).toBeTruthy();

  // step 5: fetch the profile so we can return the user's ID and other data to the test
  // (the login endpoint only returns a message, not the user object)
  const meRes = await context.request.get("/api/profile/me");
  expect(meRes.ok()).toBeTruthy();
  return await meRes.json();
}

// reads the CSRF token from the browser context's cookies
// we need this for any POST/PUT/DELETE request made directly through context.request
export async function csrfToken(context) {
  const cookies = await context.cookies();
  const csrf = cookies.find((c) => c.name === "csrf_token")?.value || "";
  expect(csrf).toBeTruthy(); // if this fails, the user probably isn't logged in
  return csrf;
}

// makes an authenticated POST request with the CSRF token attached
// using this instead of context.request.post directly means we don't forget the CSRF header
export async function authedPost(context, url, data) {
  const csrf = await csrfToken(context);
  return context.request.post(url, {
    data,
    headers: {
      "X-CSRF-Token": csrf, // the backend rejects state-changing requests without this
    },
  });
}

// creates a car listing via the API and returns the response JSON
// uses sensible defaults so tests only need to pass make/model to distinguish cars
export async function createCar(context, { make, model, city = "Bristol" }) {
  const res = await authedPost(context, "/api/cars/", {
    make,
    model,
    year: 2022,
    daily_price: 70,
    availability_units: 1,
    city,
    postcode: "BS1",
    transmission: "AUTOMATIC",
    fuel_type: "PETROL",
    seats: 5,
    doors: 5,
    mileage: 25000,
    color: "Silver",
    description: "E2E seeded listing",
    features: { ac: true, bluetooth: true },
  });
  expect(res.ok()).toBeTruthy();
  return await res.json();
}

// verifies a user's driving licence so they can make bookings
// we can't easily upload real photos in tests, so we insert the record directly into the DB
// the result is the same as if the verification pipeline had run and approved it
export async function submitAndVerifyLicense(context, userId) {
  // The license endpoint requires multipart file uploads (licence photo + selfie),
  // which can't be easily provided in E2E tests. Insert a verified record directly
  // in the DB instead — this is the same outcome the real pipeline produces.
  await createVerifiedLicenseInDb(userId);
}
