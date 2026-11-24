# ETZAN Simulation Studio

## User routes

- `/simulation`: trainee simulation room. Includes the existing 3D/WebXR room, text chat, browser speech recognition, browser speech synthesis, and optional WebRTC Realtime voice.
- `/simulation/manage`: trainer/admin studio for creating and editing simulation scenarios and assessment rubrics.
- `/platform-admin/activities`: trainer/supervisor review of saved sessions, transcripts, AI feedback, and rubric-based manual review.

Trainer dashboard links to both the studio and the review workspace.

## Scenario lifecycle

Scenarios are stored in MongoDB collection `platform_simulation_scenarios`. A scenario contains:
- Title, learning track, age group, setting, briefing, learning goals, and safety note.
- 3–12 structured steps. Each step has 2–5 choices, each with a score from 0–20 and feedback.
- Persona instructions and hidden context. These fields are excluded from the trainee-facing configuration response and are loaded server-side by the text and Realtime session routes using the scenario ID.
- Optional GLB/GLTF avatar URL and visible avatar label.
- Active/inactive status and an incrementing version.

The trainer studio accepts JSON for the step array so advanced scenario authors can define branching-ready choice data without requiring a code change. Invalid JSON, duplicate IDs, invalid scores, missing goals, and incomplete steps are rejected by the API.

## Assessment lifecycle

Rubrics are stored in `platform_simulation_rubrics`. The built-in rubric is defined in `lib/simulation-rubrics.ts`. Custom rubrics contain 3–12 criteria with unique keys, a 0–5 scale, and weights that must total exactly 100%.

At session completion, the server:
1. Resolves the static or active custom scenario from the database.
2. Recomputes step-choice points server-side; client-supplied scores are not trusted.
3. Resolves the selected active rubric and stores a versioned rubric snapshot on the activity.
4. Generates AI feedback from the trainee's choices, case formulation, and transcript when the AI Gateway is configured.
5. Requests criterion-level scores and evidence, calculates a weighted score out of 100, and stores strengths, improvements, safety observations, and next-practice guidance.
6. Saves the session in `platform_learning_activities`.

A trainer can then score each criterion from the exact rubric snapshot used for that session and save weighted supervisor feedback. The supervisor score remains separate from the automated step-choice score and AI feedback.

## Required runtime configuration

- `MONGODB_URI` and the platform's existing database configuration are required to persist scenarios, rubrics, and session reports.
- `AI_GATEWAY_API_KEY` (or the configured Vercel AI Gateway environment) is required for automated post-session analysis. If unavailable, the session is still saved and marked as not configured/unavailable.
- `OPENAI_API_KEY` is required for Realtime voice session creation.
- `CLINICAL_REALTIME_MODEL` and `CLINICAL_REALTIME_VOICE` select the Realtime model and voice.
- `NEXT_PUBLIC_SAUDI_DOCTOR_AVATAR_MODEL_URL` can point to an approved public GLB/GLTF model. A scenario may override it with its own HTTPS or same-origin model URL.

## Avatar fidelity and licensing

The current default GLB is a rigged generic adult male avatar from the documented Rocketbox/Avatar Studio source. It supports facial morph targets and motion, but it is not a photorealistic Saudi-specific MetaHuman. For the requested highest realism, the organization must supply or commission a commercially licensed Saudi-specific MetaHuman/GLB export with a facial rig, visemes, and optimized LODs. The studio can link that approved model per scenario without changing application code.

## Privacy and professional safeguards

- Hidden persona context is not returned to trainee-facing scenario configuration and is loaded server-side for AI chat and Realtime sessions.
- Do not enter real beneficiary-identifying information; scenarios are fictional training materials.
- AI review is educational support, not diagnosis, licensure, or a final professional judgment.
- Trainer review is separately recorded with reviewer identity and audit logging.
- Raw microphone audio is not stored by the simulation activity route; conversation transcripts may be stored with the report.
