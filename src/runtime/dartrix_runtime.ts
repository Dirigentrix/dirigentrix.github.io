import { BiologyState } from "../types/biology_state";
import { cranialMonitor } from "../core/daemon/cranial_monitor";
import { calculateAxisResonance } from "../core/axis/axis_core";
import { computePhi } from "../core/phi_engine";

const loopInterval = 150;

export function startDartrixRuntime(initialBio: BiologyState, sensor: any, broadcast: (data: any) => void) {
  let bio = initialBio;
  let mode = "NEUTRAL";
  let emergencyOverride = false;

  setInterval(() => {
    const input = {
      baihuiSignal: sensor.baihui(),
      yongquanSignal: sensor.yongquan(),
      vestibularBalance: sensor.vestibular(),
      trigeminalStability: sensor.cnV(),
      vagusIndex: sensor.cnX(),
      accessoryBalance: sensor.cnXI(),
      breathRhythm: sensor.breath(),
      shoulderSymmetry: sensor.shoulders(),
      cognitiveClarity: sensor.clarity()
    };
    bio = { ...bio, ...input };

    const cranial = cranialMonitor(bio);

    if (cranial.R_axis < 0.5) {
      emergencyOverride = true;
      mode = "FIGHT";
    }

    const Raxis = calculateAxisResonance(bio);

    bio.phi = computePhi(bio);

    if (bio.vagusIndex > 0.65) {
      mode = "PHI";
      emergencyOverride = false;
    } else if (bio.vagusIndex < 0.35) {
      mode = "FIGHT";
      emergencyOverride = true;
    } else {
      mode = "NEUTRAL";
    }

    broadcast({
      mode,
      Raxis,
      phi: bio.phi,
      emergencyOverride,
      cranialDrift: cranial.R_axis < 0.5
    });
  }, loopInterval);
}