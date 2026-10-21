import jwt from "jsonwebtoken";

export const createPhoneRegistrationToken = (phone, secret) =>
  jwt.sign({ phone, purpose: "phone-registration" }, secret, { expiresIn: "10m" });

export const verifyPhoneRegistrationToken = (token, secret) => {
  let payload;
  try {
    payload = jwt.verify(token, secret);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return null;
    }
    throw error;
  }

  if (
    typeof payload !== "object" ||
    payload.purpose !== "phone-registration" ||
    typeof payload.phone !== "string" ||
    !/^\d{8,15}$/.test(payload.phone)
  ) {
    return null;
  }
  return payload.phone;
};
