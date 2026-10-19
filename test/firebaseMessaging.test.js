import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFirebasePrivateKey } from "../utils/firebaseMessaging.js";

const pem = "-----BEGIN PRIVATE KEY-----\nkey-data\n-----END PRIVATE KEY-----";

test("normalizes escaped newlines in Firebase private keys", () => {
  assert.equal(normalizeFirebasePrivateKey(pem.replace(/\n/g, "\\n")), pem);
});

test("normalizes quoted and double-escaped Firebase private keys", () => {
  assert.equal(normalizeFirebasePrivateKey(`"${pem.replace(/\n/g, "\\\\n")}"`), pem);
});

test("rejects incomplete Firebase private keys without exposing key material", () => {
  assert.throws(
    () => normalizeFirebasePrivateKey("-----BEGIN PRIVATE KEY-----\ntruncated"),
    {
      message: /complete PEM private key/,
    },
  );
});
