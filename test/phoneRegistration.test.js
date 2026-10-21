import assert from "node:assert/strict";
import test from "node:test";
import {
  createPhoneRegistrationToken,
  verifyPhoneRegistrationToken,
} from "../utils/phoneRegistration.js";

test("phone registration token is limited to its verified phone and purpose", () => {
  const token = createPhoneRegistrationToken("919876543210", "test-jwt-secret");
  assert.equal(
    verifyPhoneRegistrationToken(token, "test-jwt-secret"),
    "919876543210",
  );
});

test("phone registration token cannot be used with another secret or as a session token", () => {
  const token = createPhoneRegistrationToken("919876543210", "test-jwt-secret");
  assert.equal(verifyPhoneRegistrationToken(token, "different-secret"), null);
  assert.equal(verifyPhoneRegistrationToken("not-a-token", "test-jwt-secret"), null);
});
