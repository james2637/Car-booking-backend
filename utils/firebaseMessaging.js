import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

export const normalizeFirebasePrivateKey = (value) => {
  let privateKey = value.trim();

  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))
  ) {
    privateKey = privateKey.slice(1, -1).trim();
  }

  privateKey = privateKey.replace(/\\+n/g, "\n").replace(/\r\n?/g, "\n").trim();
  if (
    !privateKey.startsWith("-----BEGIN PRIVATE KEY-----") ||
    !privateKey.endsWith("-----END PRIVATE KEY-----")
  ) {
    throw new Error(
      "FIREBASE_PRIVATE_KEY must contain a complete PEM private key; check the deployment secret for truncation or incorrect newline formatting.",
    );
  }

  return privateKey;
};

const getFirebaseApp = () => {
  const appName = "car-booking-notifications";
  const existingApp = getApps().find((app) => app.name === appName);
  if (existingApp) {
    return existingApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawPrivateKey) {
    throw new Error(
      "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY must be configured to send notifications.",
    );
  }

  const privateKey = normalizeFirebasePrivateKey(rawPrivateKey);

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
