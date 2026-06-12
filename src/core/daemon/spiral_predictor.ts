import { BiologyState } from "../../types/biology_state";

export interface SpiralSample {
  t: number;
  rAxis: number;
  phi: number;
}

const SPIRAL_HISTORY: SpiralSample[] = [];
const MAX_HISTORY_MS = 30 * 60 * 1000;
const SAMPLE_INTERVAL_MS = 5000;
const RAXIS_CRITICAL = 0.4;

let lastSampleTime = 0;

export function pushSpiralSample(bio: BiologyState) {
  const now = Date.now();
  if (now - lastSampleTime < SAMPLE_INTERVAL_MS) return;
  lastSampleTime = now;
  const sample: SpiralSample = { t: now, rAxis: bio.Raxis ?? 0, phi: bio.phi ?? 0 };
  SPIRAL_HISTORY.push(sample);
  while (SPIRAL_HISTORY.length > 0 && now - SPIRAL_HISTORY[0].t > MAX_HISTORY_MS) {
    SPIRAL_HISTORY.shift();
  }
}

export interface SpiralDriftPrediction {
  rAxisNow: number;
  phiNow: number;
  rAxisTrendPerMinute: number;
  etaToState00Ms: number | null;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
}

export function predictSpiralDriftToState00(): SpiralDriftPrediction | null {
  if (SPIRAL_HISTORY.length < 2) return null;
  const first = SPIRAL_HISTORY[0];
  const last = SPIRAL_HISTORY[SPIRAL_HISTORY.length - 1];
  const dtMin = (last.t - first.t) / 60000;
  if (dtMin <= 0) return null;
  const trendPerMinute = (last.rAxis - first.rAxis) / dtMin;
  let etaMs: number | null = null;
  let risk: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  if (trendPerMinute < 0) {
    const deltaToCritical = last.rAxis - RAXIS_CRITICAL;
    if (deltaToCritical > 0) {
      const minutesToCritical = deltaToCritical / Math.abs(trendPerMinute);
      etaMs = minutesToCritical * 60000;
      if (minutesToCritical < 5) risk = "HIGH";
      else if (minutesToCritical < 15) risk = "MEDIUM";
      else risk = "LOW";
    } else {
      etaMs = 0;
      risk = "HIGH";
    }
  }
  return { rAxisNow: last.rAxis, phiNow: last.phi, rAxisTrendPerMinute: trendPerMinute, etaToState00Ms: etaMs, riskLevel: risk };
}