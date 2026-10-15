import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import serviceAccount from "../carbookingapp-3f936-firebase-adminsdk-fbsvc-87a398f98d.json"
  with { type: "json" };

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount),
      });
const fcmToken = "d_hnztacQzOGNtIpCJv4n3:APA91bFohNHvsFYsEsuHgKdQd7UakNEBcrmuNTRoQBKIGB3Fz_CxyLVgly6nL17jeZbb54uC4cLCSbb4x5j5LiHNqMYlcBT5bOsHgPZ1r1M1TUmPCxFXJrk";

async function sendTestNotification() {
  try {
    const messageId = await getMessaging(app).send({
      token: fcmToken,
      notification: {
        title: "Test Notification 🚗",
        body: "Your Firebase push notification is working!",
      },
      android: {
        priority: "high",
      },
    });

    console.log("Notification sent successfully:", messageId);
  } catch (error) {
    console.error("Notification failed:", error.code, error.message);
  }
}

sendTestNotification();