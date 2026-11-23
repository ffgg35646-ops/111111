# ETZAN implementation status

This document separates implemented application behavior from integrations that still require merchant accounts, secrets, licensed content, or external infrastructure. A visible page is not considered proof that a commercial integration is active.

## Implemented in the application repository

- Arabic RTL public landing page and ETZAN identity (navy, gold, turquoise), with the scientific supervision name shown on the home page.
- Existing Next.js application retained; existing admin dashboard preserved at `/platform-admin`.
- Existing authentication foundation retained: scrypt password hashes, signed HttpOnly session cookie, forced password change for temporary credentials, disabled-account checks, and administrative audit events.
- Account roles expanded to the ten requested role labels: system admin, platform manager, supervisor, trainer, trainee, consultant, accountant, support, content manager, and quality manager.
- Existing academy catalog, specialty learning tracks, course learning pages, simulated cases, clinical avatar/voice workflow, VR room, competencies, and supervision modules retained.
- Article publishing API backed by MongoDB, public article reader, and admin article management screen.
- Professional community posting backed by MongoDB, pending-review moderation, public approved feed, and report submission endpoint.
- Community moderation workspace for authorized supervisory roles, including review and resolution of member reports.
- Authenticated MongoDB course-progress persistence for completed lessons, reflections, and quiz responses, with local browser fallback.
- Automatic completion certificates for trainee accounts after all lessons are completed and the server independently verifies a passing quiz; live and hybrid courses additionally require a trainer-recorded attendance mark.
- Trainer/supervisor attendance workspace for approved live-class registrations, with role-protected attendance updates and audit events.
- Authenticated personal certificate wallet at `/certificates/mine`; public QR verification remains available.
- Downloadable starter templates for intake, case study, follow-up, and referral forms. These are generic training templates, not licensed psychometric instruments.
- Membership overview page with explicit payment-not-enabled notice.

## Existing integrations that are implemented in code but need live configuration and acceptance tests

- MongoDB Atlas: `MONGODB_URI`, database name, indexes, access controls, backup policy, and production connection must be supplied and verified.
- OpenAI clinical text and realtime voice: server-side `AI_GATEWAY_API_KEY` and `OPENAI_API_KEY`, approved model availability, usage limits, consent flow, and cost monitoring must be configured and tested.
- LiveKit: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and token/session secrets are required.
- Zoom: OAuth/account credentials and an authorized host user are required.
- VR: the repository contains a browser 3D room and a native Unreal/OpenXR project. A packaged Unreal build, headset-specific testing, device matrix, and telemetry acceptance test are still required.
- Avatar assets: production rights and final approved Saudi avatar asset must be verified; current web avatar and Unreal MetaHuman are separate runtime assets.

## Not yet production-ready / requires external commercial setup

- Payment collection: a Moyasar integration path is implemented for server-created Payment Intents, card/Mada checkout, server-side payment verification, request payment state changes, and shared-secret authenticated/idempotent webhooks. It is NOT live until the merchant supplies `MOYASAR_SECRET_KEY`, `NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY`, and `MOYASAR_WEBHOOK_SECRET`, configures the webhook URL, and completes test transactions. Apple Pay requires merchant activation and domain verification; recurring subscriptions, refund initiation UI, settlement reconciliation, and electronic invoicing remain incomplete. Never mark a request paid based only on the browser redirect.
- Membership billing: plans are displayed but recurring billing, saved-card renewal, cancellation, proration, and dunning are not active.
- Books: the current book catalog/request flow is not a connected digital storefront, payment, stock, or shipping system.
- Consultations: the current workflow collects requests; a live provider calendar, confirmed slot locking, prepayment, reminders, rescheduling, cancellation, and video provider integration still need setup.
- Certificates: serial verification exists; QR generation, course completion rules, attendance linkage, revocation UI, and automated issuance after verified completion remain to be completed.
- Licensed psychometric scales: no copyrighted/proprietary instrument should be published until the owner grants the required digital administration and scoring rights.
- Full-text/vector knowledge assistant: current model context is bounded to explicitly supplied course/case context; a complete indexed knowledge base and retrieval evaluation are still required.
- Saudi PDPL operational review, retention schedules, consent records, data-subject workflows, security testing, incident response, and processor agreements require legal/security review before handling real clinical data.
- Role-based dashboards for all ten roles, device/session limits, dynamic watermarking, secure video delivery, and complete audit coverage require additional implementation and verification.

## Required secrets and external accounts

Use hosting environment variables only. Never commit real credentials.

- Core: `MONGODB_URI`, `MONGODB_DATABASE`, `PLATFORM_SESSION_SECRET`, `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD_HASH`.
- AI: `AI_GATEWAY_API_KEY`, `OPENAI_API_KEY`, `CLINICAL_AI_MODEL`, `CLINICAL_REALTIME_MODEL`, `CLINICAL_REALTIME_VOICE`.
- Live rooms: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `SUPERVISION_TOKEN_SECRET`.
- Zoom: `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_HOST_USER_ID`.
- VR avatar: `NEXT_PUBLIC_SAUDI_DOCTOR_AVATAR_MODEL_URL` (public asset URL only; never place secrets in a NEXT_PUBLIC variable).
- Payments (Moyasar): `MOYASAR_SECRET_KEY`, `NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY`, `MOYASAR_WEBHOOK_SECRET`. Start with test keys; move to live keys only after merchant approval, HTTPS, allowed-IP configuration where required, and end-to-end acceptance tests.

## Release gates

1. Run typecheck, lint, and production build in CI.
2. Configure test environment secrets and verify database connectivity.
3. Test all ten roles and deny-by-default access for each protected API.
4. Test AI text and realtime voice with consent, rate limits, and cost logging.
5. Test Zoom and LiveKit using real host and attendee accounts.
6. Test browser WebXR on the exact target headsets; commission and test a native Unreal/OpenXR client separately if it is required.
7. Test recorded-course auto certificate issuance, live-course attendance gating, personal certificate wallet, QR scan, and revocation.
7. Complete payment-provider onboarding and run successful, failed, duplicate-webhook, refund, and subscription-renewal tests.
8. Verify certificate issue, QR scan, public verification, and revocation.
9. Complete Saudi privacy/security review before production personal or clinical data is entered.
10. Only after acceptance should the production domain be connected and deployment enabled.

No Vercel production deployment is performed by this implementation branch. The Moyasar checkout remains disabled until all three environment variables above are configured and test-mode payments are verified.