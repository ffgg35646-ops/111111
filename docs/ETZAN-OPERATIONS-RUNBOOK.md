# ETZAN operations and acceptance runbook

## Required environment configuration

Set secrets in the hosting provider's encrypted environment settings. Do not commit them to GitHub or expose server secrets through `NEXT_PUBLIC_*`.

| Capability | Required variables / setup |
|---|---|
| Database | `MONGODB_URI`, `MONGODB_DATABASE` |
| Platform sessions and devices | `PLATFORM_SESSION_SECRET`, `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD_HASH`, `PLATFORM_MAX_DEVICES` (default 2; allowed 1–5) |
| AI text and simulation evaluation | `AI_GATEWAY_API_KEY`, `CLINICAL_AI_MODEL` |
| Realtime voice | `OPENAI_API_KEY`, `CLINICAL_REALTIME_MODEL`, `CLINICAL_REALTIME_VOICE` |
| Zoom | `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_HOST_USER_ID` |
| Moyasar payments | `MOYASAR_SECRET_KEY`, `NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY`, `MOYASAR_WEBHOOK_SECRET`, `PLATFORM_TOKEN_ENCRYPTION_KEY` (32 random bytes, hex or base64) |
| Avatar | `NEXT_PUBLIC_SAUDI_DOCTOR_AVATAR_MODEL_URL` (public GLB asset URL only) |
| Protected course video and temporary classroom links | `PLATFORM_MEDIA_SECRET` (32+ characters), `ETZAN_VIDEO_ALLOWED_HOSTS` (comma-separated exact HTTPS hostnames) |
| Database transport | TLS is enabled by default for non-local MongoDB URIs; `MONGODB_TLS=false` is rejected in production. |
| Email verification and password recovery | `SMTP_EMAIL`, `SMTP_PASSWORD` (Gmail address and Google App Password) |

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
- Account devices and session revocation: `/account/security`
- Data subject privacy request intake: `/account/privacy`
- Privacy request administration and response deadlines: `/platform-admin/privacy-requests`
- Security audit and privacy readiness: `/platform-admin/security`
- Protected course video setup: `/platform-admin/media`

## Account, video, and classroom security rollout

1. Generate a separate random `PLATFORM_MEDIA_SECRET` (at least 32 characters) and add it only to the encrypted production environment variables. Do not reuse `PLATFORM_SESSION_SECRET`.
2. Set `PLATFORM_MAX_DEVICES=2` (the application clamps this setting to 1–5). Accounts have an eight-hour session and can have no more than the configured number of active device registrations. Users must sign in again once after this session-table rollout because older stateless cookies do not have registered device records.
3. Add the exact HTTPS video storage hostnames to `ETZAN_VIDEO_ALLOWED_HOSTS`. Do not allow broad wildcards. Configure course videos through `/platform-admin/media`; do not put private source URLs into course catalog code or `NEXT_PUBLIC_*` variables. The stream route rechecks the account and paid enrollment on every request and supports byte ranges for seeking.
4. Test the five-minute signed access links for Zoom meetings and recordings. The link token gates access, but after authorization Zoom receives the user and the provider destination is necessarily visible to that user. This is not DRM.
5. Test two-device login, a blocked third device, ending a device session, logout, password change, disabled-account rejection, and expiry. The browser device cookie is an aid to device counting, not hardware attestation: clearing cookies, sharing a live browser, or remote access can evade device identification.
6. Test that the watermark displays the account name, email, session suffix, and changing timestamp on protected learning pages and video playback.

## Backup and restore procedure (Atlas operator action)

The application does not run a scheduled MongoDB export or create backup snapshots itself. Enable backups in the MongoDB Atlas project for the actual production cluster and record the policy owner, region, retention, last successful snapshot, and last restore test.

Recommended starting steps:
- Enable Atlas Cloud Backup. Where the production cluster tier supports it and recovery objectives justify the cost, enable Continuous Cloud Backup and choose an appropriate point-in-time restore window (a seven-day window is a reasonable starting point, not a statutory retention period).
- Define hourly/daily/weekly/monthly snapshot frequency and retention based on business continuity, data minimization, legal retention, and deletion obligations. Keep backup copies and restoration environments in approved locations; assess any region or cross-border transfer before enabling copies outside the Kingdom.
- Enable backup compliance controls / restricted backup administration where the selected Atlas plan supports them. Restrict backup restore and deletion privileges to named operators; keep credentials and encryption keys outside the repository.
- Confirm encryption at rest and key-management configuration in Atlas and the storage provider. TLS for application-to-MongoDB transport is enabled in code, but this alone does not prove backup encryption or data residency.
- Perform and document a restore drill in an isolated staging cluster at least quarterly and after material infrastructure changes. Verify user, course, payment, certificate, attendance, and audit records before declaring the restore successful. Never test restoration by overwriting the live production cluster.
- Set a retention/deletion process that accounts for legal holds and backup expiry. A record deleted from the live database may remain in a retained backup until that backup expires; document the handling and access restrictions.

## Saudi PDPL readiness (controller/legal sign-off required)

Before collecting personal data, the published privacy notice must identify the actual controller and its contact channel, the data protection officer where applicable, the specific purposes and legal bases, retention periods or criteria, data-subject rights and how to exercise them, consent withdrawal, and which fields are mandatory or optional. These facts cannot be inferred from source code; fill them with the legal controller and privacy contact before release.

Maintain a tracked intake and response process for data-subject requests. The Implementing Regulation sets a general response period not exceeding 30 days, with an extension of up to another 30 days only in the stated cases and with advance notice and reasons. Assess whether a processing impact assessment is required for the platform’s actual data and activities.

Maintain a breach-response playbook and named incident owner. Under Article 24 of the Implementing Regulation, notify the competent authority within 72 hours of becoming aware of a qualifying breach that may harm personal data or the data subject or conflict with their rights/interests; notify affected data subjects without undue delay where the breach may cause harm or affect their rights/interests. Keep incident reports and corrective-action evidence.

Review the applicable PDPL, its Implementing Regulation and Personal Data Transfer Regulation, processor contracts, hosting/database regions, subcontractors, and any transfer outside the Kingdom with qualified Saudi counsel/privacy personnel. The code changes in this repository are security controls, not a certification or legal opinion.

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
- Gmail email delivery for account verification and password recovery requires `SMTP_EMAIL` and a Google App Password in `SMTP_PASSWORD`; SMS reminders still require a separate SMS provider.
- Native VR headset packaging and device certification have not been completed.
- Legal review and security penetration testing are required before production clinical data is collected.

A passing software build does not replace these account, licensing, privacy, and acceptance requirements.
