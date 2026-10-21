import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePhoneNumber,
  verifyWidgetAccessToken,
} from "../utils/msg91Otp.js";

const withMsg91Config = async (run) => {
  const originalConfig = {
    authKey: process.env.MSG91_AUTHKEY,
    legacyAuthKey: process.env.MSG91_AUTH_KEY,
    countryCode: process.env.MSG91_COUNTRY_CODE,
  };
  process.env.MSG91_AUTHKEY = "test-auth-key";
  process.env.MSG91_COUNTRY_CODE = "91";
  try {
    await run();
  } finally {
    for (const [key, value] of Object.entries({
      MSG91_AUTHKEY: originalConfig.authKey,
      MSG91_AUTH_KEY: originalConfig.legacyAuthKey,
      MSG91_COUNTRY_CODE: originalConfig.countryCode,
    })) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

test("normalizes ten-digit local numbers using the configured default country code", () => {
  const originalCountryCode = process.env.MSG91_COUNTRY_CODE;
  delete process.env.MSG91_COUNTRY_CODE;
  try {
    assert.equal(normalizePhoneNumber("98765 43210"), "919876543210");
  } finally {
    if (originalCountryCode === undefined) {
      delete process.env.MSG91_COUNTRY_CODE;
    } else {
      process.env.MSG91_COUNTRY_CODE = originalCountryCode;
    }
  }
});

test("preserves international numbers and strips formatting", () => {
  const originalCountryCode = process.env.MSG91_COUNTRY_CODE;
  process.env.MSG91_COUNTRY_CODE = "91";
  try {
    assert.equal(normalizePhoneNumber("+1 (415) 555-2671"), "14155552671");
  } finally {
    if (originalCountryCode === undefined) {
      delete process.env.MSG91_COUNTRY_CODE;
    } else {
      process.env.MSG91_COUNTRY_CODE = originalCountryCode;
    }
  }
});

test("rejects malformed and out-of-range phone numbers", () => {
  const originalCountryCode = process.env.MSG91_COUNTRY_CODE;
  process.env.MSG91_COUNTRY_CODE = "91";
  try {
    assert.throws(() => normalizePhoneNumber("not a phone"), { statusCode: 400 });
    assert.throws(() => normalizePhoneNumber("123"), { statusCode: 400 });
  } finally {
    if (originalCountryCode === undefined) {
      delete process.env.MSG91_COUNTRY_CODE;
    } else {
      process.env.MSG91_COUNTRY_CODE = originalCountryCode;
    }
  }
});

test("verifies MSG91 widget access tokens using the backend auth key", async () => {
  await withMsg91Config(async () => {
    const originalFetch = globalThis.fetch;
    let request;
    globalThis.fetch = async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          type: "success",
          data: { mobile: "919876543210" },
        }),
      };
    };
    try {
      const phone = await verifyWidgetAccessToken("widget-token");
      assert.equal(request.url, "https://control.msg91.com/api/v5/widget/verifyAccessToken");
      assert.equal(request.options.method, "POST");
      assert.equal(request.body.authkey, "test-auth-key");
      assert.equal(request.body["access-token"], "widget-token");
      assert.equal(phone, "919876543210");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("uses the submitted phone when MSG91 only confirms OTP verification", async () => {
  await withMsg91Config(async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        type: "success",
        message: "OTP verified success",
      }),
    });
    try {
      assert.equal(
        await verifyWidgetAccessToken("widget-token", "+91 98765 43210"),
        "919876543210",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("returns null when MSG91 rejects a widget access token", async () => {
  await withMsg91Config(async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ type: "error", message: "Invalid token" }),
    });
    try {
      assert.equal(await verifyWidgetAccessToken("invalid-token"), null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("requires a phone when MSG91 does not include it in a successful response", async () => {
  await withMsg91Config(async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ type: "success", data: {} }),
    });
    try {
      await assert.rejects(
        verifyWidgetAccessToken("widget-token"),
        { statusCode: 400 },
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
