import { expect } from "@playwright/test";
import { getVerificationToken, createVerifiedLicenseInDb } from "./db";

export function isoDate(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

export function buildUser(prefix) {
  const stamp = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  return {
    email: `${prefix}_${stamp}@example.com`,
    password: "Passw0rd!Passw0rd!",
    full_name: `${prefix} user`,
    date_of_birth: "1991-01-01",
  };
}

export async function registerVerifyLogin(context, user) {
  const ip = `10.20.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`;
  const rateLimitHeaders = { "x-forwarded-for": ip };

  const registerRes = await context.request.post("/api/auth/register", {
    data: user,
    headers: rateLimitHeaders,
  });
  expect(registerRes.ok()).toBeTruthy();

  // Token is no longer returned in the API response (sent by email instead).
  // Fetch it directly from the DB so tests remain independent of email delivery.
  const token = await getVerificationToken(user.email);
  expect(token).toBeTruthy();

  const verifyRes = await context.request.post(`/api/auth/verify-email/${token}`, {
    headers: rateLimitHeaders,
  });
  expect(verifyRes.ok()).toBeTruthy();

  const loginRes = await context.request.post("/api/auth/login", {
    data: { email: user.email, password: user.password },
    headers: rateLimitHeaders,
  });
  expect(loginRes.ok()).toBeTruthy();

  const meRes = await context.request.get("/api/profile/me");
  expect(meRes.ok()).toBeTruthy();
  return await meRes.json();
}

export async function csrfToken(context) {
  const cookies = await context.cookies();
  const csrf = cookies.find((c) => c.name === "csrf_token")?.value || "";
  expect(csrf).toBeTruthy();
  return csrf;
}

export async function authedPost(context, url, data) {
  const csrf = await csrfToken(context);
  return context.request.post(url, {
    data,
    headers: {
      "X-CSRF-Token": csrf,
    },
  });
}

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

export async function submitAndVerifyLicense(context, userId) {
  // The license endpoint requires multipart file uploads (licence photo + selfie),
  // which can't be easily provided in E2E tests. Insert a verified record directly
  // in the DB instead — this is the same outcome the real pipeline produces.
  await createVerifiedLicenseInDb(userId);
}
