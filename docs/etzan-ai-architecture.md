# ETZAN AI and extensible simulation architecture

## Current entry points

- Learner/trainer knowledge assistant: /assistant.
- AI chat inside the clinical simulation: /api/clinical-agent.
- Optional realtime voice session creation: /api/clinical-agent/realtime-session.
- AI simulation performance review and persistence: /api/platform/activities.
- Trainer scenario/rubric studio: /simulation/manage.
- Admin usage and cost view: /platform-admin/ai.

## Content retrieval boundary

The assistant currently reads only:
- Published article records from etzan_articles.
- Published book metadata/descriptions from etzan_books.
- The static course and track catalog.
- Public training-case summaries and descriptions of original practice cards.

It ranks a bounded content sample using Arabic-normalized keyword overlap. It does not read unpublished content, hidden persona instructions, private consultation notes, trainee submissions, or licensed assessment items. The current retrieval system is not a full-text/vector index and does not yet cover every uploaded file or attachment. Any future semantic index must preserve the same visibility rules and add per-document authorization filters before retrieval.

## AI provider configuration

- Text chat, assistant generation, and simulation review use the AI SDK and the model configured through CLINICAL_AI_MODEL.
- On Vercel, AI Gateway may use the deployment's supported OIDC authentication; other runtimes require AI_GATEWAY_API_KEY.
- A compatible provider/model identifier can route text requests through AI Gateway. Provider credentials and secrets stay in server-side environment variables.
- Realtime voice is a distinct direct OpenAI API path using OPENAI_API_KEY, CLINICAL_REALTIME_MODEL, and CLINICAL_REALTIME_VOICE. It is not automatically redirected by CLINICAL_AI_MODEL.

## Human review gates

- AI-generated quiz sets are saved to platform_ai_quiz_drafts in pending_review. Only an authorized explicit approval copies them to platform_course_quizzes. Trainer access is restricted to courses assigned to that trainer.
- AI-generated scenarios are stored in platform_simulation_scenarios as inactive. They do not appear to learners until a trainer/supervisor reviews and activates them in the existing scenario studio.
- AI-generated feedback is educational evidence, not a certification, diagnosis, clinical decision, or replacement for a human supervisor.

## Usage and cost accounting

The platform_ai_usage collection stores:
- Feature/action name, provider, model, actor role and internal user ID.
- Input, output, and total tokens when returned.
- AI Gateway generation ID and numeric USD cost only when provider metadata supplies it.
- A cost state of reported, pending (generation ID exists but a cost has not been returned), or unavailable.

The helper intentionally does not store prompts or transcripts in the usage ledger. Conversation and assessment data follow their existing collections and permissions. Realtime session creation is logged, but actual voice session billing is not inferred from a temporary client-secret response; reconcile it against the provider's usage reporting until a completed-session usage callback is added.

## Extension points for future AI and VR

- Scenario data is stored independently of the rendering engine. A new character model, scripted environment, or scenario editor can use the existing scenario contract and must retain hidden context on the server.
- Chat and realtime voice use separate server routes. A new AI provider can be introduced behind a server-side provider adapter without replacing accounts, courses, scenario records, rubrics, reports, or the member dashboard.
- Simulation completion persists the scenario identifier, rubric snapshot, conversation transcript, room events, browser/WebXR experience mode, and available head/hand telemetry. Additional XR engines should map their events into a versioned telemetry adapter rather than rewriting the learner platform.
- A new headset or native VR runtime still needs a dedicated adapter/client, protocol tests, device-specific acceptance, privacy consent, and performance validation. This architecture provides extension boundaries; it does not claim universal headset compatibility.

## Release checklist

1. Configure AI Gateway key/OIDC and the approved model in the target runtime.
2. Test allowed roles and denied roles for each AI endpoint.
3. Test article/book visibility filters and verify that drafts/private scenario fields never enter learner retrieval.
4. Generate and review a quiz draft; verify that it does not change a course quiz until explicit approval.
5. Generate a scenario; verify inactive state, review it in the studio, and activate it manually.
6. Confirm usage token logging and compare reported costs against AI Gateway Logs.
7. Validate Realtime voice billing independently in the provider dashboard.
8. Complete privacy, consent, clinical-safety, load, and target-device checks before production use.
