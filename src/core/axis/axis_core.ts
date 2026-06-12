import { BiologyState } from "../../types/biology_state";
export function calculateAxisResonance(bio: BiologyState): number {
  const verticalAxis = 0.6 * bio.baihuiSignal + 0.4 * bio.trigeminalStability;
  const depthAxis = 0.7 * bio.vagusIndex + 0.3 * bio.breathRhythm;
  const horizontalAxis = 0.5 * bio.accessoryBalance + 0.5 * bio.shoulderSymmetry;
  return (verticalAxis + depthAxis + horizontalAxis) / 3;
}