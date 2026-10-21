# Car booking backend

## Phone OTP authentication

Phone OTP is sent by the MSG91 browser widget. Configure its widget ID/token in the React frontend, and add `MSG91_AUTHKEY` from your MSG91 account to the backend `.env` (see `.env.example`). The backend verifies the widget's `accessToken` with MSG91 before issuing a JWT. `MSG91_COUNTRY_CODE` defaults to `91` and is prepended to a 10-digit local number; send international numbers with a leading `+` or their country code. Keep the MSG91 AuthKey on the backend; do not send it to the client.

The existing email/password endpoints remain available. After the MSG91 widget reports success, send its access token and the phone number entered in the widget to:

- `POST /api/auth/otp/verify` with `{ "accessToken": "<widget access token>", "phone": "<phone number entered in the widget>" }`. MSG91 may only return a success message rather than the phone number, so the backend uses this submitted number when the provider omits it. If MSG91 returns a phone number, the backend uses that value.
- For an existing, fully registered user, the response is `{ "isNewUser": false, "user": { ... }, "token": "<backend JWT>" }`; use `token` as the app session.
- For a phone with no completed account, the response is `{ "isNewUser": true, "phone": "...", "registrationToken": "<short-lived backend token>" }`. Collect name, email, and password, then send `{ "registrationToken": "...", "name": "...", "email": "...", "password": "..." }` to `POST /api/auth/otp/register`. That endpoint completes account creation and returns the backend JWT session response.

The registration token expires after 10 minutes, is signed with `JWT_SECRET`, and can only authorize phone registration; it is not an app session token. When MSG91 omits the phone from its verification response, the backend relies on the phone submitted alongside the access token; ensure your MSG91 widget/token flow binds that token to the same phone.

For databases that already have a non-sparse unique `email_1` index, update it once before enabling phone-only signups so multiple users can omit email:

```javascript
db.users.dropIndex("email_1");
db.users.createIndex({ email: 1 }, { unique: true, sparse: true });
```

The user schema creates a sparse unique index for phone numbers.
