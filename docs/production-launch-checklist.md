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

## Required environment variables
Copy .env.example to .env.local locally and configure the same values in the production environment. Never commit real secrets.
- MONGODB_URI; optional MONGODB_DATABASE.
- ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_HOST_USER_ID; optional ZOOM_TIMEZONE.
- LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET.
- SUPERVISION_TOKEN_SECRET (32+ characters).
- SUPERVISION_ACCESS_CODE (32+ characters; share only with authorized supervisors).
- PLATFORM_ADMIN_API_KEY (32+ characters).
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
1. Implement individual accounts, verified email, MFA for administrators, role-based authorization, session revocation, and audit logs. The shared supervision code is only an interim gate.
2. Add request throttling and abuse protection to AI and room-creation endpoints.
3. Configure MongoDB indexes, backups, retention, and access policies.
4. Complete payment provider onboarding and webhook signature verification before accepting payments.
5. Configure Zoom and LiveKit credentials, then test creation, joining, expiry, reconnect, and host controls.
6. Obtain rights for every course video, book, avatar, and psychometric instrument. Do not upload protected test items without written permission.
7. Have qualified practitioners approve case scenarios, rubrics, safeguarding procedures, and referral workflows.
8. Test VR comfort and frame rate on each named headset and record actual results.
9. Obtain explicit consent before recording or collecting sensitive voice, video, gaze, or body telemetry; apply data minimization and a deletion policy.
10. Run npm ci, npm run typecheck, npm run lint, and npm run build before release.

## CI
The platform quality workflow runs on pushes to main and pull requests targeting main. It checks TypeScript, ESLint, and the production build. CI success does not replace external-service or headset acceptance tests.