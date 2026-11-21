import type { Room } from "livekit-client";

function humanRoomRecipients(room: Room) {
  return Array.from(room.remoteParticipants.values()).flatMap((participant) => {
    try {
      const metadata = JSON.parse(participant.metadata || "") as { role?: string };
      return metadata.role === "supervisor" || metadata.role === "trainee"
        ? [participant.identity]
        : [];
    } catch {
      return [];
    }
  });
}

export type VrTelemetryEvent = {
  type: "posture_score" | "gaze_score" | "clinical_assessment_score" | "safety_compliance_score" | "communication_score" | "active_listening_score" | "empathy_score" | "interaction_distance_cm" | "procedure_step";
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

  const destinationIdentities = humanRoomRecipients(room);
  if (!destinationIdentities.length) {
    throw new Error("No supervisor or trainee is currently connected to receive VR telemetry.");
  }

  await room.localParticipant.publishData(
    new TextEncoder().encode(JSON.stringify(payload)),
    { reliable: true, topic: "vr-telemetry", destinationIdentities },
  );
}

export type VrSceneState = {
  sceneId: string;
  scenarioTitle: string;
  activeTask: string;
  position?: { x: number; y: number; z: number };
  updatedAt?: string;
};

/** Synchronise the learner's current virtual-room state with the supervisor. */
export async function publishVrSceneState(room: Room, state: VrSceneState) {
  if (!room.localParticipant) throw new Error("The VR client is not connected to a supervision room.");
  const payload = {
    type: "scene_state",
    sceneId: state.sceneId.slice(0, 80),
    scenarioTitle: state.scenarioTitle.slice(0, 160),
    activeTask: state.activeTask.slice(0, 160),
    position: state.position,
    updatedAt: state.updatedAt ?? new Date().toISOString(),
  };
  const destinationIdentities = humanRoomRecipients(room);
  if (!destinationIdentities.length) {
    throw new Error("No supervisor or trainee is currently connected to receive VR scene updates.");
  }

  await room.localParticipant.publishData(
    new TextEncoder().encode(JSON.stringify(payload)),
    { reliable: true, topic: "vr-scene-state", destinationIdentities },
  );
}
