# Production launch and integration checklist

This document distinguishes code already present from services and hardware that still require credentials and acceptance testing. A page or route in Git is not proof that a provider is connected.

## Implemented in the repository
- Arabic RTL Next.js learning platform and specialist learning pathways.
- Case-study worksheets, assessment guidance, diagnostic-reasoning exercises, and competency reports.
- Required structured case formulation inside the simulation (concern, context, observations, strengths, hypotheses, missing evidence, next steps, and a training scale choice), persisted with each completed activity.
- Supervisor review queue for saved simulation records, including transcript review, a seven-domain rubric, and written feedback linked to the original activity.
- Browser-based 3D clinical room with WebXR entry where supported.
- Turn-based spoken interaction: browser speech recognition, server-side AI text generation, and browser speech synthesis. This is not full-duplex streaming audio.
- LiveKit room creation, participant tokens, shared supervision UI, and VR telemetry/data-channel bridge.
- Zoom Server-to-Server OAuth meeting creation and request queue integration.
- MongoDB persistence for learning activities, requests, certificates, Zoom meetings, and competency reports.
- Individual account foundation with admin-managed roles, scrypt password hashes, signed HttpOnly sessions, forced first-login password change, registered device sessions, a configurable concurrent-device limit, active-session revocation, and security audit events.
- Protected course-video streaming route that hides the private source URL, checks the account and paid enrollment on each request, supports range requests for seeking, and overlays a per-user/session watermark.
- Five-minute signed classroom join/recording access links that recheck the paid enrollment and session status before redirecting to Zoom.
- Ten-minute signed course-video URLs that refresh automatically during playback and preserve the current playback position.
- Authenticated data-subject privacy request intake with account ownership, a 30-day response due date, administrator tracking, and a single documented extension of up to 30 additional days after recording the prior notice.
- Exact-host allowlisting for protected course media, TLS by default for non-local MongoDB connections, and browser security response headers.
- Account security page for reviewing/revoking sessions; platform-admin security audit and protected-media management screens.

## Required environment variables
Copy .env.example to .env.local locally and configure the same values in the production environment. Never commit real secrets.
- MONGODB_URI; optional MONGODB_DATABASE.
- ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_HOST_USER_ID; optional ZOOM_TIMEZONE.
- LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET.
- SUPERVISION_TOKEN_SECRET (32+ characters).
- SUPERVISION_ACCESS_CODE (32+ characters; share only with authorized supervisors).
- PLATFORM_SESSION_SECRET (32+ random characters), PLATFORM_MEDIA_SECRET (a separate 32+ random secret), PLATFORM_MAX_DEVICES (default 2), ETZAN_VIDEO_ALLOWED_HOSTS (exact comma-separated HTTPS hosts), PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD_HASH (generate locally with `node scripts/hash-platform-password.mjs`).
- MONGODB_TLS defaults to true for non-local MongoDB URIs; never disable it in production.
- AI_GATEWAY_API_KEY; optional CLINICAL_AI_MODEL.
- OPENAI_API_KEY for the direct Realtime voice-session endpoint; optional CLINICAL_REALTIME_MODEL. The AI Gateway key does not replace this credential in that endpoint.
Generate independent random values for each secret. Do not reuse database, Zoom, or LiveKit credentials as application secrets.

## Supervision room access
The room-creation endpoint now requires SUPERVISION_ACCESS_CODE and checks same-origin browser requests before issuing supervisor and trainee LiveKit tokens. The code is sent over HTTPS and is not stored in browser storage or MongoDB. Rotate it if shared outside the supervisor group. This shared gate is an interim control, not a replacement for individual institutional accounts, MFA, or role-based identity management.

## VR engine maturity
The current browser experience uses React Three Fiber / Three.js and WebXR. It can provide a spatial training room on supported browsers and headsets, but it is not an Unreal Engine project and does not establish tested support for every Meta Quest or OpenXR headset.
A native Unreal/OpenXR deliverable still requires a separate Unreal project, packaging/signing for each target headset, device-specific input and hand-tracking adapters, licensed avatar assets, physical-device performance profiling, and a release/test matrix. The existing LiveKit bridge defines the data-channel contract for scene state and competency telemetry; a native client must implement and test that contract.

## Voice interaction maturity
The current clinical agent is turn-based and text-streaming. Browser speech recognition and speech synthesis vary by browser, operating system, language pack, and device. Full-duplex low-latency speech requires a realtime audio service/agent, interruption handling, echo cancellation, reconnect behavior, and tests on target headsets. Do not describe the current browser implementation as continuous live voice.

## Before public production use
1. Configure the individual account layer and bootstrap administrator credentials. Role-based authorization, scrypt password hashes, HttpOnly sessions, first-login password changes, account activation/deactivation, registered device sessions, session revocation, and security audit records exist in the repository. Before production, add verified email, administrator MFA, institutional SSO, and distributed rate limiting. The shared supervision code remains an additional gate. Existing users must sign in again once after the device-session rollout.
2. Add request throttling and abuse protection to AI and room-creation endpoints.
3. Configure MongoDB Atlas Cloud Backup/Continuous Cloud Backup, retention, restore roles, storage encryption/key management, access policies, and test a restore in an isolated environment. These are Atlas operator actions and are not automatically enabled by this application.
4. Complete payment provider onboarding and webhook signature verification before accepting payments.
5. Configure Zoom and LiveKit credentials, then test creation, joining, expiry, reconnect, and host controls.
6. Obtain rights for every course video, book, avatar, and psychometric instrument. Do not upload protected test items without written permission.
7. Have qualified practitioners approve case scenarios, rubrics, safeguarding procedures, and referral workflows.
8. Test VR comfort and frame rate on each named headset and record actual results.
9. Obtain explicit consent where required before recording or collecting sensitive voice, video, gaze, or body telemetry; apply data minimization and a deletion/retention policy. Publish the completed privacy notice and document the controller identity, legal bases, purposes, retention periods, data-subject request workflow, processors, hosting regions, and transfer assessments required under the Saudi PDPL framework.
10. Run npm ci, npm run typecheck, npm run lint, and npm run build before release. Test device limits, session revocation, media-token expiry, paid enrollment authorization, byte-range seeking, and audit events on production-like data.

## Controls not provided by application code alone
- Atlas backups are not enabled by a code push: the Atlas project owner must configure backup schedule, retention, restore window, regions and restore permissions, then prove a successful restore.
- This repository does not claim application-level encryption of every personal-data field. Verify database/storage encryption at rest and use managed KMS/field-level encryption for sensitive data where the controller risk assessment requires it.
- The video UI disables easy download affordances and watermarks playback, but it cannot prevent screen recording, screenshots, HDMI capture, external cameras, or all browser/network extraction. A DRM-capable streaming vendor is required for stronger enforcement.
- Zoom links are gated by a five-minute signed token; after authorized redirection, the Zoom URL is visible to the user and Zoom handles its own meeting experience.
- Saudi PDPL compliance requires controller/legal review. Do not mark the platform compliant until the privacy notice, data map, purposes/legal bases, retention and deletion rules, processor agreements, cross-border transfers, data-subject rights workflow, breach procedure and any required impact assessment are approved.
- Add a documented incident plan. The PDPL Implementing Regulation Article 24 sets a 72-hour notification requirement to the competent authority for qualifying breaches and requires timely notification to affected data subjects when the stated harm/rights test applies.

## CI
The platform quality workflow runs on pushes to main and pull requests targeting main. It checks TypeScript, ESLint, and the production build. CI success does not replace external-service or headset acceptance tests.