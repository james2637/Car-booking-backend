import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

const getFirebaseApp = () => {
  const appName = "car-booking-notifications";
  const existingApp = getApps().find((app) => app.name === appName);
  if (existingApp) {
    return existingApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY must be configured to send notifications.",
    );
  }

  return initializeApp(
    {
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    },
    appName,
  );
};

export const sendBookingConfirmation = async ({ token, booking, car }) =>
  getMessaging(getFirebaseApp()).send({
    token,
    notification: {
      title: "Booking successful",
      body: `Your booking for ${car.name} is confirmed.`,
    },
    data: {
      type: "booking_success",
      bookingId: booking._id.toString(),
      carId: car._id.toString(),
      carName: car.name,
    },
  });

export const sendPromotionalNotification = async ({ token, title, body }) =>
  getMessaging(getFirebaseApp()).send({
    token,
    notification: { title, body },
    data: { type: "promotional" },
  });
