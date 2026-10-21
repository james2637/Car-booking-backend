const getCountryCode = () => {
  const countryCode = process.env.MSG91_COUNTRY_CODE || "91";
  if (!/^\d{1,3}$/.test(countryCode)) {
    const error = new Error("MSG91_COUNTRY_CODE must contain 1 to 3 digits.");
    error.statusCode = 500;
    throw error;
  }
  return countryCode;
};

const getMsg91Config = () => {
  const authKey = process.env.MSG91_AUTHKEY || process.env.MSG91_AUTH_KEY;
  if (!authKey) {
    const error = new Error("MSG91_AUTHKEY must be configured.");
    error.statusCode = 500;
    throw error;
  }

  return {
    authKey,
  };
};

export const normalizePhoneNumber = (input) => {
  if (typeof input !== "string") {
    const error = new Error("A valid phone number is required.");
    error.statusCode = 400;
    throw error;
  }

  const value = input.trim();
  if (!/^\+?[\d\s()-]+$/.test(value)) {
    const error = new Error("Enter a valid phone number.");
    error.statusCode = 400;
    throw error;
  }

  const digits = value.replace(/\D/g, "");
  const countryCode = getCountryCode();
  const phone = digits.length === 10 ? `${countryCode}${digits}` : digits;
  if (!/^\d{8,15}$/.test(phone)) {
    const error = new Error("Enter a phone number with 8 to 15 digits.");
    error.statusCode = 400;
    throw error;
  }
  return phone;
};

const requestMsg91 = async (url, options = {}) => {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  } catch {
    const error = new Error("Unable to contact the OTP provider.");
    error.statusCode = 502;
    throw error;
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    const error = new Error("The OTP provider returned an invalid response.");
    error.statusCode = 502;
    throw error;
  }

  if (!response.ok) {
    const error = new Error("The OTP provider could not complete the request.");
    error.statusCode = 502;
    throw error;
  }
  return payload;
};

export const verifyWidgetAccessToken = async (accessToken, phoneNumber) => {
  const { authKey } = getMsg91Config();
  const url = "https://control.msg91.com/api/v5/widget/verifyAccessToken";
  const result = await requestMsg91(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      authkey: authKey,
      "access-token": accessToken,
    }),
  });

  if (
    result?.type?.toLowerCase?.() !== "success" &&
    result?.status?.toLowerCase?.() !== "success"
  ) {
    return null;
  }

  const verifiedPhone =
    result?.data?.mobile ??
    result?.data?.phone ??
    result?.data?.identifier ??
    result?.mobile ??
    result?.phone ??
    result?.identifier;
  if (typeof verifiedPhone === "string") {
    return normalizePhoneNumber(verifiedPhone);
  }

  if (typeof phoneNumber !== "string") {
    const error = new Error("A phone number is required when MSG91 does not return one.");
    error.statusCode = 400;
    throw error;
  }

  return normalizePhoneNumber(phoneNumber);
};
