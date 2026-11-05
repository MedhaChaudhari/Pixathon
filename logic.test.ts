import { describe, expect, it } from "vitest";
import { ANOMALIES, createFlight, isCorrect, nextLevel, START_LEVEL } from "./logic";

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
};

describe("stairwell rules", () => {
  it("a normal flight has exactly 12 steps", () => {
    const f = createFlight({ id: 1, level: 5, rng: seq(0, 0.99) });
    expect(f.anomaly).toBeNull();
    expect(f.steps).toBe(12);
  });

  it("the thirteenth-step anomaly adds one step", () => {
    const idx = ANOMALIES.findIndex((a) => a.id === "thirteen");
    const f = createFlight({ id: 1, level: 5, rng: seq(0, 0, (idx + 0.5) / ANOMALIES.length) });
    expect(f.anomaly).toBe("thirteen");
    expect(f.steps).toBe(13);
  });

  it("the first flight is always safe", () => {
    const f = createFlight({ id: 1, level: START_LEVEL, isFirst: true, rng: () => 0 });
    expect(f.anomaly).toBeNull();
  });

  it("footsteps never appear with sound off", () => {
    for (let i = 0; i < 200; i++) {
      const f = createFlight({ id: i, level: 4, audioEnabled: false });
      expect(f.anomaly).not.toBe("footsteps");
    }
  });

  it("going down a safe flight is correct, turning back is wrong", () => {
    const f = createFlight({ id: 1, level: 5, rng: seq(0, 0.99) });
    expect(isCorrect(f, "descend")).toBe(true);
    expect(isCorrect(f, "turn-back")).toBe(false);
  });

  it("turning back on an anomaly is correct, going down is wrong", () => {
    const f = createFlight({ id: 1, level: 5, rng: seq(0, 0, 0) });
    expect(f.anomaly).not.toBeNull();
    expect(isCorrect(f, "turn-back")).toBe(true);
    expect(isCorrect(f, "descend")).toBe(false);
  });

  it("a right call goes one level down; a wrong call loops back to level 8", () => {
    expect(nextLevel(5, true)).toBe(4);
    expect(nextLevel(5, false)).toBe(8);
  });
});
