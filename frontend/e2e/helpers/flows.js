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
