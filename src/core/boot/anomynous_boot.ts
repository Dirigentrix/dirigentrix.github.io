import { BiologyState } from "../daniel_os";
import { calculateAxisResonance } from "../axis/axis_core";

export type BootStatus = 
  | "BOOT_OK" 
  | "ANOMALY_UNSTABLE_HALT" 
  | "ROOT_NOT_READY" 
  | "CROWN_NOT_ALIGNED" 
  | "SENSOR_DRIFT" 
  | "CORE_UNSAFE";

export function anomynousBootSequence(bio: BiologyState): BootStatus {
  const R_axis = calculateAxisResonance(bio);

  if (R_axis < 0.5) return "ANOMALY_UNSTABLE_HALT";
  if (bio.yongquanSignal < 0.4) return "ROOT_NOT_READY";
  if (bio.baihuiSignal < 0.4) return "CROWN_NOT_ALIGNED";
  if (bio.vestibularBalance < 0.4) return "SENSOR_DRIFT";
  if (bio.vagusIndex < 0.45) return "CORE_UNSAFE";

  console.log("[IDENTITY] LOCKED: ANOMYNOUS");
  return "BOOT_OK";
}