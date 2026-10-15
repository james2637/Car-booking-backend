import assert from "node:assert/strict";
import test from "node:test";
import { calculateBookingPrice } from "../utils/bookingPricing.js";

test("charges one day for a 24-hour booking across two calendar dates", () => {
  const pricing = calculateBookingPrice(
    1200,
    new Date("2026-10-16T10:00:00.000Z"),
    new Date("2026-10-17T10:00:00.000Z"),
  );

  assert.deepEqual(pricing, {
    rentalDays: 1,
    amount: 120000,
    totalPrice: 1200,
  });
});

test("rounds a booking longer than 24 hours up to the next rental day", () => {
  const pricing = calculateBookingPrice(
    1200,
    new Date("2026-10-16T10:00:00.000Z"),
    new Date("2026-10-17T10:01:00.000Z"),
  );

  assert.deepEqual(pricing, {
    rentalDays: 2,
    amount: 240000,
    totalPrice: 2400,
  });
});

test("counts one rental day when the start and end dates are the same", () => {
  const pricing = calculateBookingPrice(
    1200,
    new Date("2026-10-15T08:00:00.000Z"),
    new Date("2026-10-15T15:00:00.000Z"),
  );

  assert.deepEqual(pricing, {
    rentalDays: 1,
    amount: 120000,
    totalPrice: 1200,
  });
});
