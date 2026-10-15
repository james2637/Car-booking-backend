const millisecondsPerDay = 86_400_000;

export const calculateBookingPrice = (carPrice, startDate, endDate) => {
  const rentalDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / millisecondsPerDay,
  );
  const amount = Math.round(carPrice * rentalDays * 100);

  return {
    rentalDays,
    amount,
    totalPrice: amount / 100,
  };
};
