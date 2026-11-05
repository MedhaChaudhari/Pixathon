import { ANOMALIES, type AnomalyId } from "./logic";

const KEY = "infinite-stairwell:logbook";
const BEST = "infinite-stairwell:best";
const SOUND = "infinite-stairwell:sound";

export function readLogbook(): AnomalyId[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    const valid = new Set(ANOMALIES.map((a) => a.id));
    return Array.isArray(raw) ? raw.filter((id): id is AnomalyId => valid.has(id)) : [];
  } catch {
    return [];
  }
}

export function logAnomaly(id: AnomalyId): AnomalyId[] {
  const set = new Set(readLogbook());
  set.add(id);
  const list = [...set];
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
  return list;
}

export function readBestTime(): number | null {
  const v = Number(localStorage.getItem(BEST));
  return Number.isFinite(v) && v > 0 ? v : null;
}

export function saveBestTime(ms: number): number {
  const best = readBestTime();
  const next = best === null ? ms : Math.min(best, ms);
  try {
    localStorage.setItem(BEST, String(next));
  } catch {
    /* storage unavailable */
  }
  return next;
}

export function readSoundPref(): boolean {
  return localStorage.getItem(SOUND) !== "off";
}

export function saveSoundPref(on: boolean) {
  try {
    localStorage.setItem(SOUND, on ? "on" : "off");
  } catch {
    /* storage unavailable */
  }
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
