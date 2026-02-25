import { expect } from "@playwright/test";
import { authedPost, createCar } from "./auth";

export async function seedApprovedBooking({
  ownerContext,
  renterContext,
  startDate,
  endDate,
  make,
  model,
}) {
  const car = await createCar(ownerContext, { make, model });

  const requestRes = await authedPost(renterContext, `/api/bookings/${car.id}`, {
    start_date: startDate,
    end_date: endDate,
  });
  expect(requestRes.ok()).toBeTruthy();
  const booking = await requestRes.json();

  const approveRes = await authedPost(
    ownerContext,
    `/api/bookings/${booking.id}/approve`,
    {}
  );
  expect(approveRes.ok()).toBeTruthy();

  return { bookingId: booking.id, carId: car.id, car };
}

export async function seedCompletedBooking({
  ownerContext,
  renterContext,
  startDate,
  endDate,
  make,
  model,
}) {
  const { bookingId, carId, car } = await seedApprovedBooking({
    ownerContext,
    renterContext,
    startDate,
    endDate,
    make,
    model,
  });

  // Renter pays escrow
  const payRes = await authedPost(renterContext, `/api/payments/booking/${bookingId}/pay`, {});
  expect(payRes.ok()).toBeTruthy();
  const payData = await payRes.json();

  // pay endpoint returns { checkout_url, payment }; status is nested under payment.
  // In Stripe mode the payment stays PAYMENT_PENDING — signal that to callers.
  if (payData.payment?.status !== "HELD_IN_ESCROW") {
    return { bookingId, carId, car, completed: false };
  }

  // Owner releases escrow → booking becomes COMPLETED
  const releaseRes = await authedPost(ownerContext, `/api/payments/booking/${bookingId}/release`, {});
  expect(releaseRes.ok()).toBeTruthy();

  return { bookingId, carId, car, completed: true };
}

export async function blockDates(ownerContext, carId, startDate, endDate) {
  const res = await authedPost(
    ownerContext,
    `/api/cars/${carId}/availability/block`,
    { start_date: startDate, end_date: endDate },
  );
  expect(res.ok()).toBeTruthy();
  return await res.json();
}
