import type { Room } from "livekit-client";

export type VrTelemetryEvent = {
  type: "posture_score" | "gaze_score" | "clinical_assessment_score" | "safety_compliance_score" | "interaction_distance_cm" | "procedure_step";
  label: string;
  value: number | string | boolean;
  unit?: string;
  source?: "web-vr" | "unreal-openxr" | "device";
  occurredAt?: string;
};

/**
 * Publish a structured VR result to the active supervision room.
 * The supervisor room listens on the "vr-telemetry" topic and includes
 * received events in the competency report when the supervisor saves it.
 */
export async function publishVrTelemetry(room: Room, event: VrTelemetryEvent) {
  if (!room.localParticipant) throw new Error("The VR client is not connected to a supervision room.");

  const payload = {
    ...event,
    source: event.source ?? "web-vr",
    occurredAt: event.occurredAt ?? new Date().toISOString(),
  };

  await room.localParticipant.publishData(
    new TextEncoder().encode(JSON.stringify(payload)),
    { reliable: true, topic: "vr-telemetry" },
  );
}
