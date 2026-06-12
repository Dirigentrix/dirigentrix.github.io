import { BiologyState } from "../../types/biology_state";
export interface CranialMonitorOutput {
  verticalAxis: number;
  depthAxis: number;
  horizontalAxis: number;
  R_axis: number;
  emergencyOverride: boolean;
}
export function cranialMonitor(bio: BiologyState): CranialMonitorOutput {
  const verticalAxis = 0.6 * bio.baihuiSignal + 0.4 * bio.trigeminalStability;
  const depthAxis = 0.7 * bio.vagusIndex + 0.3 * bio.breathRhythm;
  const horizontalAxis = 0.5 * bio.accessoryBalance + 0.5 * bio.shoulderSymmetry;
  const R_axis = (verticalAxis + depthAxis + horizontalAxis) / 3;
  let emergencyOverride = bio.emergencyOverride;
  if (bio.vagusIndex > 0.65) {
    emergencyOverride = false;
  }
  return { verticalAxis, depthAxis, horizontalAxis, R_axis, emergencyOverride };
}