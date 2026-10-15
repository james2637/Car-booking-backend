import { timingSafeEqual } from "node:crypto";

const requirePromotionalApiKey = (req, res, next) => {
  const configuredKey = process.env.PROMOTIONAL_NOTIFICATION_API_KEY;
  if (!configuredKey) {
    return res.status(503).json({
      message: "Promotional notification API key is not configured.",
    });
  }

  const providedKey = req.get("x-api-key");
  if (typeof providedKey !== "string") {
    return res.status(401).json({ message: "Promotional API key is required." });
  }

  const configuredBuffer = Buffer.from(configuredKey);
  const providedBuffer = Buffer.from(providedKey);
  if (
    configuredBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(configuredBuffer, providedBuffer)
  ) {
    return res.status(403).json({ message: "Invalid promotional API key." });
  }

  return next();
};

export default requirePromotionalApiKey;
