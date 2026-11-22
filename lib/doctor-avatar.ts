/**
 * Local SCD-01 Saudi doctor base mesh. The scene adds the Saudi thobe,
 * medical coat, shemagh and agal procedurally. A production facial/body-rigged
 * MetaHuman export can replace this through NEXT_PUBLIC_SAUDI_DOCTOR_AVATAR_MODEL_URL.
 */
export const DEFAULT_DOCTOR_AVATAR_MODEL_URL =
  process.env.NEXT_PUBLIC_SAUDI_DOCTOR_AVATAR_MODEL_URL?.trim() || "/models/saudi-doctor-base.gltf";

export const DOCTOR_AVATAR_SOURCE_LABEL = "SCD-01 local GLTF base";
