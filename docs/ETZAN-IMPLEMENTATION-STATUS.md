# ETZAN implementation status

This document separates implemented application behavior from integrations that still require merchant accounts, secrets, licensed content, or external infrastructure. A visible page is not considered proof that a commercial integration is active.

## Implemented in the application repository

- Arabic RTL public landing page and ETZAN identity (navy, gold, turquoise), with the scientific supervision name shown on the home page.
- Homepage sections now include catalog-backed program/case/tool counts, featured courses linked to their learning pages, a live latest-published-articles feed from MongoDB, knowledge-library entry points, and a professional-community call to action. Empty article states are shown instead of fabricated content or testimonials.
- Subtle account-specific visible watermark (name and email) is displayed across the signed-in learning portal as a deterrent to casual content sharing; it is not DRM and cannot prevent screenshots.
- Existing Next.js application retained; existing admin dashboard preserved at `/platform-admin`.
- Existing authentication foundation retained: scrypt password hashes, signed HttpOnly session cookie, forced password change for temporary credentials, disabled-account checks, and administrative audit events.
- Account roles expanded to the ten requested role labels: system admin, platform manager, supervisor, trainer, trainee, consultant, accountant, support, content manager, and quality manager. User administration now supports role changes and activation/deactivation; platform managers can manage operational accounts but cannot create, promote, or alter system-admin accounts.
- Existing academy catalog, specialty learning tracks, course learning pages, simulated cases, clinical avatar/voice workflow, VR room, competencies, and supervision modules retained.
- Article publishing API backed by MongoDB, public article reader, and admin article management screen. The platform manager, supervisor, and content manager roles can create and update article publication status; content-manager access matches the moderation read permissions.
- Professional community posting backed by MongoDB, pending-review moderation, public approved feed, and report submission endpoint.
- Community moderation workspace for authorized supervisory roles, including review and resolution of member reports.
- Authenticated MongoDB course-progress persistence for completed lessons, reflections, and quiz responses. Trainee access to course content is now gated on an approved, verified paid enrollment (recorded or live/hybrid).
- Automatic completion certificates for trainee accounts after all lessons are completed and the server independently verifies a passing quiz; live and hybrid courses additionally require a trainer-recorded attendance mark. Each certificate has a serial and QR verification URL.
- Trainer/supervisor attendance workspace for approved live-class registrations, with role-protected attendance updates and audit events.
- AI-assisted post-simulation report generation from the fictional case, trainee formulation, and saved conversation transcript; reports show strengths, improvements, safety observations, and a next-practice suggestion. Token counts and model name are stored for usage tracking. Human supervisor review remains separate.
- Simulation can switch between an AI clinical supervisor and a first-person virtual client/parent role in text and realtime voice modes.
- Authenticated personal certificate wallet at `/certificates/mine`; public QR verification remains available.
- Downloadable starter templates for intake, case study, follow-up, and referral forms. These are generic training templates, not licensed psychometric instruments.
- Membership subscription checkout with monthly/annual professional packages, explicit recurring-consent capture, Moyasar saved-token verification and encrypted token storage, self-service cancellation that preserves prepaid access, and scheduled renewal processing.
- Administrator screens for course pricing, membership pricing, coupon management, subscription monitoring, invoice records, and payment/refund operations.
- Finance workspace for the Moyasar transaction ledger and authorized full-refund requests, with provider fees recorded when returned by Moyasar. Request queue access is read-only for accountant/support roles; approval/rejection and price authorization are restricted to system/platform managers.
- Server-calculated Saudi Riyal checkout for individually priced courses and books, eligible coupon rules, configurable VAT calculations, idempotent coupon consumption on paid orders, and a numbered electronic sales record per confirmed payment.
- Printable invoice detail view with seller/customer data, line totals, discount, tax, payment details, and a ZATCA Phase 1-style TLV QR payload when a valid seller VAT profile is configured. ZATCA Phase 2 clearance/signing/XML integration is still an external release gate.

- The administration home now reads operational counts from MongoDB; dedicated administration entry points cover account roles, course-to-trainer assignment, articles, books/products, professional-form records, consultation availability, payment ledger, certificates, community moderation, and simulation reports. Dedicated management routes now cover commercial prices, coupons, memberships, invoices, payments, and refunds.

## Existing integrations that are implemented in code but need live configuration and acceptance tests

- MongoDB Atlas: `MONGODB_URI`, database name, indexes, access controls, backup policy, and production connection must be supplied and verified.
- OpenAI clinical text and realtime voice: server-side `AI_GATEWAY_API_KEY` and `OPENAI_API_KEY`, approved model availability, usage limits, consent flow, and cost monitoring must be configured and tested. Automated simulation reviews record token usage, but actual provider billing/cost reconciliation still requires the Gateway dashboard or provider usage export.
- LiveKit: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and token/session secrets are required.
- Zoom: OAuth/account credentials and an authorized host user are required.
- VR: the verified implementation in this repository is a browser 3D room with WebXR where supported. No packaged native Unreal/OpenXR client has been verified as a deliverable. Headset-specific testing, device matrix, and telemetry acceptance tests are required before advertising headset compatibility.
- Avatar assets: production rights and final approved human avatar asset must be verified. The web scene supports a configured or uploaded GLB model; a separate native MetaHuman runtime has not been verified.

## Not yet production-ready / requires external commercial setup

- Payment collection: Moyasar Payment Intents, Mada/card checkout, conditionally enabled Apple Pay, server-side verification, payment/refund ledger entries, provider-fee capture when returned, and authenticated webhooks are implemented. A merchant account, approved live keys, enabled payment methods, webhook registration, and end-to-end test transactions are still required. Apple Pay appears only after merchant/domain verification and its validation URL are configured. Never mark a request paid based only on the browser redirect.
- Membership billing: monthly/annual packages are configurable by administrators; customer checkout records explicit recurring consent; only an active Moyasar token enables auto-renewal; recurring charges are scheduled daily; failures are retried with a limited retry policy; customers can cancel renewal and retain access through their paid-through date. Production recurring billing remains inactive until tokenization, cron secret, production webhook, and provider acceptance tests are configured. Proration is not implemented.
- Electronic invoicing: numbered sales records and printable customer documents are issued after verified payments, with configurable VAT detail and QR data when the seller tax profile is supplied. This implementation does not transmit Phase 2 XML, apply a cryptographic stamp/signature, or request clearance/reporting through ZATCA FATOORA. Do not represent the generated documents as fully Phase 2 compliant until that integration and acceptance work are complete.
- Books: the current book catalog/request flow is not a connected digital storefront, payment, stock, or shipping system. The admin screen edits catalog records and inventory but does not replace a full commerce/shipping integration.
- Course catalog editing: the current curriculum and course lessons are maintained in the code catalog. Administration can assign active trainers to courses, but add/edit/archive course curriculum from the UI is not implemented.
- Permissions: account role assignment and server-side role gates are implemented. A configurable per-action permission matrix (view/create/edit/delete/approve) is not implemented; the admin permissions page documents current role boundaries and links to role assignment.
- Consultations: consultant-managed availability slots, public slot discovery, atomic reservation to prevent double booking, SAR quote approval, and payment-gated booking confirmation are implemented. Automatic reminders, customer self-service rescheduling/cancellation, calendar sync (Google/Outlook), and video-session provider integration still need setup and credentials. Zoom meetings are created during approval when Zoom OAuth is configured; join URLs are exposed only after verified payment.
- Certificates: serial and QR verification, manager/admin issuance and revocation, personal certificate wallet, and automatic recorded-course issuance after verified completion are implemented. Live/hybrid issuance requires recorded attendance. Downloadable branded PDF output and course-specific attendance thresholds remain to be completed.
- Licensed psychometric scales: no copyrighted/proprietary instrument should be published until the owner grants the required digital administration and scoring rights.
- Full-text/vector knowledge assistant: current model context is bounded to explicitly supplied course/case context; a complete indexed knowledge base and retrieval evaluation are still required.
- Saudi PDPL operational review, retention schedules, consent records, data-subject workflows, security testing, incident response, and processor agreements require legal/security review before handling real clinical data.
- Role-aware dashboard entry points and account roles are implemented, including attendance and consultant availability workspaces. Detailed separate operational dashboards for every role, device/session limits, dynamic watermarking, secure video delivery, and complete audit coverage require additional implementation and verification.

## AI assistant, generation and usage ledger

- The member-facing AI workspace is available at `/assistant`. It offers a knowledge search and learning explanation flow using published articles/books and the platform's current static course/track/case catalog. Retrieval is currently bounded and keyword-based; it is not a full semantic or vector search system.
- AI-generated course quiz questions are saved in `platform_ai_quiz_drafts` as pending review. They are not applied to `platform_course_quizzes` until an authorized trainer/supervisor/admin explicitly approves them. Trainers can create and approve quiz drafts only for courses assigned to their account.
- AI-generated professional scenarios are saved in `platform_simulation_scenarios` with `status: inactive`; they remain hidden from trainees until reviewed and activated in `/simulation/manage`.
- `platform_ai_usage` records the feature, model/provider, role, token counts, Gateway generation ID, and Gateway-reported USD cost when available. Missing costs are marked pending or unavailable; the application does not estimate provider charges.
- Text chat, AI simulation review, and assistant generation write usage records. Realtime voice records session creation, but the current OpenAI client-secret response does not include the completed session's billable usage; voice cost must still be reconciled in the provider's usage dashboard.
- Admin usage review is at `/platform-admin/ai`; its API is restricted to `admin` and `platform_manager`.
- External text-model integration is provider-neutral through the configured AI Gateway model ID (`CLINICAL_AI_MODEL`). Realtime voice remains a separate direct OpenAI integration using `OPENAI_API_KEY`, `CLINICAL_REALTIME_MODEL`, and `CLINICAL_REALTIME_VOICE`.
- Simulation scenarios, assessment rubrics, chat/realtime endpoints, performance reports, and VR telemetry use separate API/data boundaries. A new XR runtime/device or AI provider can be integrated through an adapter and the existing scenario/report contracts; this is an extension path, not automatic compatibility or a completed plug-in marketplace.

## Required secrets and external accounts

Use hosting environment variables only. Never commit real credentials.

- Core: `MONGODB_URI`, `MONGODB_DATABASE`, `PLATFORM_SESSION_SECRET`, `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD_HASH`.
- AI: `AI_GATEWAY_API_KEY`, `OPENAI_API_KEY`, `CLINICAL_AI_MODEL`, `CLINICAL_REALTIME_MODEL`, `CLINICAL_REALTIME_VOICE`.
- Live rooms: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `SUPERVISION_TOKEN_SECRET`.
- Zoom: `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_HOST_USER_ID`.
- VR avatar: `NEXT_PUBLIC_SAUDI_DOCTOR_AVATAR_MODEL_URL` (public asset URL only; never place secrets in a NEXT_PUBLIC variable).
- Payments (Moyasar): `MOYASAR_SECRET_KEY`, `NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY`, `MOYASAR_WEBHOOK_SECRET`, `PLATFORM_TOKEN_ENCRYPTION_KEY` (32 random bytes, hex or base64; encrypts client secrets and saved payment tokens at rest), `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, and optional `NEXT_PUBLIC_MOYASAR_APPLE_PAY_VALIDATE_MERCHANT_URL` for merchant-approved Apple Pay.
- Seller invoicing: `ETZAN_VAT_REGISTERED`, `ETZAN_VAT_RATE_BPS`, `ETZAN_PRICES_INCLUDE_VAT`, `ETZAN_MERCHANT_LEGAL_NAME`, `ETZAN_MERCHANT_VAT_NUMBER`, `ETZAN_MERCHANT_ADDRESS`, and `ETZAN_MERCHANT_CR` as applicable. Do not enable VAT or issue tax invoices without verifying the seller registration and supply treatment.

## Release gates

1. Run typecheck, lint, and production build in CI and keep the exact passing commit as the release candidate.
2. Configure test environment secrets and verify database connectivity.
3. Test all ten roles and deny-by-default access for each protected API.
4. Test AI text and realtime voice with consent, rate limits, and cost logging.
5. Test Zoom and LiveKit using real host and attendee accounts.
6. Test browser WebXR on the exact target headsets; commission and test a native Unreal/OpenXR client separately if it is required.
7. Test recorded-course auto certificate issuance, live-course attendance gating, personal certificate wallet, QR scan, and revocation.
7. Complete payment-provider onboarding and run course, book, coupon, successful/failed payment, duplicate-webhook, refund, saved-card, renewal, failed-renewal, and cancellation tests.
8. Confirm seller tax details and complete ZATCA Phase 2 integration/acceptance before representing invoices as fully compliant.
9. Verify certificate issue, QR scan, public verification, and revocation.
10. Complete Saudi privacy/security review before production personal or clinical data is entered.
11. Only after acceptance should the production domain be connected and deployment enabled.

No Vercel production deployment is performed by this implementation branch. Moyasar checkout is disabled until provider keys are configured and test-mode payments are verified. The daily renewal route is registered in `vercel.json` but runs only after a production deployment; scheduled functions require `CRON_SECRET`.

## Professional community — feature/etzan-professional-community

- Practitioner profiles backed by MongoDB, including specialty, professional title, organization, location, qualifications, interests, website, LinkedIn, and a member-directory visibility control.
- Searchable practitioner directory; directory responses omit account email addresses and hide profiles whose owners opt out.
- Specialty groups with persistent join/leave memberships and membership counts.
- Professional discussions are stored in MongoDB and remain pending moderation until an authorized moderator approves them.
- Members can share text experiences, safe HTTP(S) resource links, and PDF/Word/PowerPoint/PNG/JPEG attachments up to 5 MB. Attachments are stored with the post and served only to signed-in members when the post is published, its author, or an authorized moderator.
- Authenticated members can like published discussions and add comments. Each post is limited to 200 comments; the feed returns the latest 20 comments.
- Members can submit one open report per post. Reports can be resolved or dismissed by authorized moderators.
- The moderation workspace filters posts by status, searches content, approves/rejects/hides posts, reviews reports, and records moderation actions in the existing audit collection.
- Community APIs require an active platform session and validate allowed roles, post status, category values, attachment MIME type/size, and external resource protocols.
- This implementation adds application behavior only. It does not trigger a Vercel production deployment; MongoDB production availability and GitHub quality checks must still be verified in the target environment.
