# ETZAN operations and acceptance runbook

## Required environment configuration

Set secrets in the hosting provider's encrypted environment settings. Do not commit them to GitHub or expose server secrets through `NEXT_PUBLIC_*`.

| Capability | Required variables / setup |
|---|---|
| Database | `MONGODB_URI`, `MONGODB_DATABASE` |
| Platform sessions | `PLATFORM_SESSION_SECRET`, `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD_HASH` |
| AI text and simulation evaluation | `AI_GATEWAY_API_KEY`, `CLINICAL_AI_MODEL` |
| Realtime voice | `OPENAI_API_KEY`, `CLINICAL_REALTIME_MODEL`, `CLINICAL_REALTIME_VOICE` |
| Zoom | `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_HOST_USER_ID` |
| Moyasar payments | `MOYASAR_SECRET_KEY`, `NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY`, `MOYASAR_WEBHOOK_SECRET` |
| Avatar | `NEXT_PUBLIC_SAUDI_DOCTOR_AVATAR_MODEL_URL` (public GLB asset URL only) |

Use Moyasar test keys first. Configure the webhook in the Moyasar merchant dashboard to point to:

`https://YOUR-ETZAN-DOMAIN/api/payments/moyasar/webhook`

If Moyasar sends a `webhook_verification` event, open `/platform-admin/payments` with an administrator or accountant account and copy the six-digit verification code shown there into the Moyasar dashboard before its 30-minute expiry.\n\nThe payment integration uses server-created Payment Intents. The browser receives only the single-use intent client secret and publishable key; payment success is accepted only after the server fetches and verifies the payment. The refund action is restricted to platform administrators, managers, and accountants.

## Operational URLs

- Public academy: `/academy`
- Course content: `/academy/[courseId]` (requires a signed-in account and a paid, approved enrollment for trainees)
- Simulation lab: `/simulation`
- Consultation booking: `/consultations`
- Consultant availability: `/platform-admin/availability`
- Attendance register: `/platform-admin/attendance`
- Payment checkout: `/pay-request`
- Payment return verification: `/payment-result`
- Payment ledger and refunds: `/platform-admin/payments`
- Personal certificates: `/certificates/mine`
- Public certificate verification: `/certificates?code=SERIAL`
- Community moderation: `/platform-admin/community`
- Simulation supervisor review: `/platform-admin/activities`

## Before enabling real customers

1. Create and verify the first system administrator account. Create consultant, trainer, supervisor, accountant, and trainee accounts using the admin user manager.
2. Verify MongoDB access restrictions, backups, restore procedure, and production database separation.
3. Add AI credentials, test text and realtime voice, then inspect AI token usage in saved simulation reports and the provider billing dashboard.
4. Add Zoom OAuth credentials and verify that a meeting is created only for an approved request; confirm the join link is hidden until payment is verified.
5. Add Moyasar test keys and webhook secret. Test one paid request, one declined card, one pending 3-D Secure attempt, a duplicate webhook, and one full refund.
6. Test simultaneous consultation bookings for one slot; exactly one request must reserve it.
7. Complete a recorded course and a live course; verify automatic certificate issuance is blocked until the required attendance is marked.
8. Scan the QR code on a certificate and test revocation.
9. Verify each of the ten role permissions and attempt direct access to protected APIs with the wrong role.
10. Perform mobile, tablet, and desktop tests; test browser WebXR on each target headset. A native Unreal/OpenXR client is not part of the verified deliverable.
11. Complete privacy, clinical safety, content licensing, payment terms, refund policy, and Saudi PDPL legal/security review.

## Known commercial release blockers

- Live Moyasar merchant approval and real credentials are not present in the repository.
- Apple Pay activation/domain verification and recurring subscriptions are not complete.
- No licensed psychometric instrument content is bundled; upload only material with explicit digital-use rights.
- Digital book files, physical inventory, fulfillment/shipping, and protected streaming/CDN delivery require an approved storage/content provider and catalog setup.
- Email/SMS reminders and verification require an email/SMS provider and credentials.
- Native VR headset packaging and device certification have not been completed.
- Legal review and security penetration testing are required before production clinical data is collected.

A passing software build does not replace these account, licensing, privacy, and acceptance requirements.
