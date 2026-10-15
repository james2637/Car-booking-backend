import User from "../models/User.js";

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

export const registerDeviceToken = async (req, res) => {
  const token = req.body?.fcmToken;
  if (typeof token !== "string" || !token.trim() || token.length > 4096) {
    throw badRequest("A valid fcmToken is required.");
  }

  const user = await User.findByIdAndUpdate(
    req.userId,
    { fcmToken: token.trim() },
    { returnDocument: "after" },
  );
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  res.json({ message: "FCM device token registered." });
};

export const unregisterDeviceToken = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.userId,
    { $unset: { fcmToken: 1 } },
    { returnDocument: "after" },
  );
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  res.json({ message: "FCM device token removed." });
};
