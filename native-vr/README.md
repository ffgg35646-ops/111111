# ClinicalTrainingVR — Unreal/OpenXR source starter

This directory is a native Unreal Engine starting point for the clinical training room. It is source code, not a prebuilt Windows or Quest package.

## Current source included

- Unreal project descriptor targeting Unreal Engine 5.8.
- OpenXR and OpenXR hand-tracking plugin declarations.
- A VR pawn with HMD camera, left/right motion-controller components, and world-space widget pointers.
- A primitive interview-room actor and a placeholder patient silhouette.
- A Blueprint-spawnable telemetry component that sends head-pose observations and hand-tracking observations to the platform through an authenticated HTTPS endpoint.
- A least-privilege device token path: the copied LiveKit VR device token is restricted to joining the room and publishing data; it cannot publish/subscribe audio/video or administer the room.

## Requirements to build

1. Install Unreal Engine 5.8 or a compatible later version, Visual Studio with the C++ desktop workload, and the Android toolchain required by the target headset if packaging for Android/Quest.
2. Enable the engine OpenXR plugin. Enable the matching OpenXR hand-tracking plugin supplied by the target runtime/vendor. Plugin availability and naming can differ between installed engine versions and vendor runtimes.
3. On Windows, right-click **ClinicalTrainingVR.uproject** and choose **Generate Visual Studio project files**.
4. Open the generated solution and build **ClinicalTrainingVREditor** in Development Editor / Win64, then open the project in Unreal Editor.
5. Configure the target OpenXR runtime and device-specific Android/Quest settings before packaging. Use a real headset for runtime validation.

No Unreal Engine executable or device runtime is available in this GitHub-only workflow, so this source has not been compiled or tested on a headset here.

## Connect the native telemetry component

1. Create a LiveKit supervision room in the platform and use the supervisor interface to copy the **VR device connection data**.
2. The native VR pawn includes **ClinicalVRTelemetryComponent** as a default subobject. In a Blueprint derived from **ClinicalVRPawn**, select its Telemetry component to set the patient target and configure the connection.
3. Call **ConfigureTelemetryEndpoint** from the pawn's BeginPlay/initialization Blueprint with:
   - Platform HTTPS base URL, for example **https://your-platform.example**
   - The exact **roomName** from the copied device connection data
   - The short-lived **token** from the copied device connection data
4. Assign **PatientTarget** to the patient actor in the level. The component samples the HMD camera direction and distance to that actor every five seconds.
The native telemetry component now calls Unreal's **GetHandTrackingState** for the left and right hands every five seconds, reads **ThumbTip** and **IndexTip** in world space, and sends their distance through **PublishHandTrackingSample**. This depends on the OpenXR hand-tracking extension and the selected runtime returning valid hand joints. The Blueprint-callable method remains available for custom input integrations.
6. The component posts to **/api/supervision/vr-telemetry**. The server verifies the signed LiveKit device token and checks that the requested room matches the token. The supervisor's next competency report for that room includes the pending device events.

The token is a temporary credential. Keep it in memory for the training session, never commit it, and clear it when the session ends. The API retains unreported telemetry for at most 30 days and reports only the events associated with the validated room.

## Current limits — do not treat these as complete features

- The native room and patient are primitive placeholders; there is no licensed realistic skeletal patient avatar, rig, facial animation, or phoneme-synchronised lip sync in this Unreal starter.
- The native pawn has controller-based widget interaction. Hand-joint acquisition and pinch-event detection now use Unreal's OpenXR hand-tracking state API when the runtime returns valid joint positions. Pinch-to-world-UI interaction and controller-to-hand ray fallback are not yet wired, and must be tested on the chosen headset.
- The web /simulation route now has a separate Realtime/WebRTC full-duplex voice client with server-issued ephemeral credentials. That browser client is not yet embedded into this native Unreal executable. Native audio needs a dedicated Unreal audio/WebRTC integration and device test.
- There is no eye tracking in the web or native starter. Head direction is not eye gaze and must not be reported as eye contact.
- The native source has not been compiled by Unreal Build Tool, packaged, signed, or installed on a headset. Do not advertise full compatibility with Meta Quest or other OpenXR devices until each target model and runtime passes the acceptance matrix in **docs/vr-device-integration.md**.
- The supervisor competency scores remain human-entered rubric results. Device telemetry is supporting evidence only and does not diagnose, prescribe treatment, or automatically decide professional competence.
