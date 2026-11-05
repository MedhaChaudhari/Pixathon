// Pure game rules for The Infinite Stairwell. No DOM or audio here so it stays testable.

export type AnomalyId =
  | "countdown"
  | "footsteps"
  | "brick-door"
  | "thirteen"
  | "broken-rail"
  | "exit-up"
  | "mirrored-sign"
  | "red-light"
  | "figure"
  | "swapped-door";

export interface AnomalyInfo {
  id: AnomalyId;
  name: string;
  clue: string;
  /** Only perceivable with sound on. */
  audio?: boolean;
}

export const ANOMALIES: AnomalyInfo[] = [
  { id: "countdown", name: "The Countdown", clue: "The graffiti stopped being words and started counting down." },
  { id: "footsteps", name: "The Follower", clue: "Footsteps right behind yours. They stop when you stop.", audio: true },
  { id: "brick-door", name: "The Bricked Door", clue: "The door opens inward onto a solid brick wall." },
  { id: "thirteen", name: "The Thirteenth Step", clue: "One step more than there should be." },
  { id: "broken-rail", name: "The Broken Rail", clue: "The handrail just ends halfway down." },
  { id: "exit-up", name: "The Wrong Way", clue: "The exit sign points back up." },
  { id: "mirrored-sign", name: "The Mirror Level", clue: "The level number is painted backwards." },
  { id: "red-light", name: "The Red Lamp", clue: "The landing lamp burns red." },
  { id: "figure", name: "The Tenant", clue: "Someone waiting on the landing. Gone when you get close." },
  { id: "swapped-door", name: "The Other Hinge", clue: "The door handle moved to the other side." },
];

export const START_LEVEL = 8;
export const NORMAL_STEPS = 12;
export const ANOMALY_CHANCE = 0.6;

export const GRAFFITI_WORDS = [
  "KEEP WALKING",
  "STILL HERE",
  "RX-9",
  "NO PARKING",
  "MIRA + JO",
  "WHO WAS HERE",
  "DOWN IS DOWN",
  "SLEEP LESS",
];

export const COUNTDOWN_GRAFFITI = "5 4 3 2 1";

export interface Flight {
  id: number;
  /** The level painted on this flight's landing. 0 is the ground-floor exit. */
  level: number;
  anomaly: AnomalyId | null;
  steps: number;
  graffiti: string;
}

export type Choice = "descend" | "turn-back";

export interface CreateFlightOptions {
  id: number;
  level: number;
  isFirst?: boolean;
  audioEnabled?: boolean;
  lastAnomaly?: AnomalyId | null;
  rng?: () => number;
}

export function createFlight({
  id,
  level,
  isFirst = false,
  audioEnabled = true,
  lastAnomaly = null,
  rng = Math.random,
}: CreateFlightOptions): Flight {
  const graffiti = GRAFFITI_WORDS[Math.floor(rng() * GRAFFITI_WORDS.length)] ?? "KEEP WALKING";
  // The very first flight and the ground floor are always clean.
  if (isFirst || level <= 0 || rng() >= ANOMALY_CHANCE) {
    return { id, level, anomaly: null, steps: NORMAL_STEPS, graffiti };
  }
  const pool = ANOMALIES.filter((a) => (audioEnabled || !a.audio) && a.id !== lastAnomaly);
  const picked = pool[Math.floor(rng() * pool.length)] ?? ANOMALIES[0];
  const anomaly: AnomalyId = picked ? picked.id : "countdown";
  return {
    id,
    level,
    anomaly,
    steps: anomaly === "thirteen" ? NORMAL_STEPS + 1 : NORMAL_STEPS,
    graffiti: anomaly === "countdown" ? COUNTDOWN_GRAFFITI : graffiti,
  };
}

/** Go down if the flight is safe; turn back if anything is wrong. */
export function isCorrect(flight: Flight, choice: Choice): boolean {
  return flight.anomaly === null ? choice === "descend" : choice === "turn-back";
}

/** A right call brings you one level closer to the ground; a wrong one loops you back to the top. */
export function nextLevel(level: number, correct: boolean): number {
  return correct ? level - 1 : START_LEVEL;
}

export function isExitLevel(level: number): boolean {
  return level <= 0;
}

export function levelLabel(level: number): string {
  return level <= 0 ? "G" : `P${level}`;
}
