import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, DoorOpen, Undo2, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StairAudio } from "@/game/audio";
import { formatTime, logAnomaly, readBestTime, readLogbook, readSoundPref, saveBestTime, saveSoundPref } from "@/game/logbook";
import {
  ANOMALIES,
  START_LEVEL,
  createFlight,
  isCorrect,
  nextLevel,
  type AnomalyId,
  type Choice,
  type Flight,
} from "@/game/logic";
import { lerpCamera, type Camera } from "@/game/projection";
import { Scene, cameraForStep } from "@/game/Scene";
import daylight from "@/assets/daylight-exit.jpg";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [
      { title: "Descend — The Infinite Stairwell" },
      {
        name: "description",
        content: "Walk down the concrete stairwell. Twelve steps, one landing, one door. Turn back the moment something is wrong.",
      },
      { property: "og:title", content: "Descend — The Infinite Stairwell" },
      { property: "og:description", content: "Twelve steps, one landing, one door. Turn back the moment something is wrong." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlayPage,
});

type Phase = "intro" | "playing" | "leaving" | "interlude" | "escaping" | "escaped";

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function PlayPage() {
  const audio = useRef<StairAudio | null>(null);
  const [sound, setSound] = useState(true);
  const [phase, setPhaseState] = useState<Phase>("intro");
  const [flight, setFlight] = useState<Flight>(() => createFlight({ id: 0, level: START_LEVEL, isFirst: true, rng: () => 0.99 }));
  const [step, setStep] = useState(0);
  const [cam, setCam] = useState<Camera>(() => cameraForStep(0, 12));
  const [door, setDoor] = useState(0);
  const [fade, setFade] = useState(0);
  const [white, setWhite] = useState(0);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState({ time: 0, best: 0, flights: 0, logged: 0 });

  const phaseRef = useRef<Phase>("intro");
  const flightRef = useRef(flight);
  const stepRef = useRef(0);
  const camRef = useRef(cam);
  const doorRef = useRef(0);
  const busy = useRef(false);
  const camRaf = useRef(0);
  const doorRaf = useRef(0);
  const idRef = useRef(0);
  const startedAt = useRef(0);
  const flightsTaken = useRef(0);

  useEffect(() => {
    setSound(readSoundPref());
    return () => {
      cancelAnimationFrame(camRaf.current);
      cancelAnimationFrame(doorRaf.current);
      audio.current?.dispose();
    };
  }, []);

  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  const animateCam = useCallback(
    (to: Camera, dur: number, bob = 0) =>
      new Promise<void>((resolve) => {
        cancelAnimationFrame(camRaf.current);
        const from = camRef.current;
        const t0 = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - t0) / dur);
          const c = lerpCamera(from, to, ease(t));
          c.y -= bob * Math.sin(Math.PI * t);
          camRef.current = c;
          setCam(c);
          if (t < 1) camRaf.current = requestAnimationFrame(tick);
          else resolve();
        };
        camRaf.current = requestAnimationFrame(tick);
      }),
    [],
  );

  const animateDoor = useCallback(
    (to: number, dur: number) =>
      new Promise<void>((resolve) => {
        cancelAnimationFrame(doorRaf.current);
        const from = doorRef.current;
        const t0 = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - t0) / dur);
          const v = from + (to - from) * ease(t);
          doorRef.current = v;
          setDoor(v);
          if (t < 1) doorRaf.current = requestAnimationFrame(tick);
          else resolve();
        };
        doorRaf.current = requestAnimationFrame(tick);
      }),
    [],
  );

  const loadFlight = (f: Flight) => {
    flightRef.current = f;
    setFlight(f);
    stepRef.current = 0;
    setStep(0);
    doorRef.current = 0;
    setDoor(0);
    const c = cameraForStep(0, f.steps);
    camRef.current = c;
    setCam(c);
  };

  const start = () => {
    if (!audio.current) audio.current = new StairAudio();
    audio.current.init();
    audio.current.setMuted(!sound);
    startedAt.current = performance.now();
    flightsTaken.current = 0;
    busy.current = false;
    // Testing aid: /play?anomaly=<id> forces the first flight's anomaly.
    const forced = new URLSearchParams(window.location.search).get("anomaly") as AnomalyId | null;
    const first = createFlight({ id: ++idRef.current, level: START_LEVEL, isFirst: true, audioEnabled: sound });
    if (forced && ANOMALIES.some((a) => a.id === forced)) {
      first.anomaly = forced;
      if (forced === "thirteen") first.steps = 13;
      if (forced === "countdown") first.graffiti = "5 4 3 2 1";
    }
    loadFlight(first);
    setWhite(0);
    setFade(0);
    setPhase("playing");
  };

  const stepDown = async () => {
    if (phaseRef.current !== "playing" || busy.current) return;
    const f = flightRef.current;
    const k = stepRef.current;
    if (k >= f.steps) return;
    busy.current = true;
    audio.current?.step();
    if (f.anomaly === "footsteps") audio.current?.follower();
    const nk = k + 1;
    stepRef.current = nk;
    setStep(nk);
    await animateCam(cameraForStep(nk, f.steps), nk === f.steps ? 650 : 380, 0.035);
    busy.current = false;
  };

  const decide = async (choice: Choice) => {
    if (phaseRef.current !== "playing" || busy.current) return;
    const f = flightRef.current;
    if (f.level <= 0) return;
    if (choice === "descend" && stepRef.current < f.steps) return;
    busy.current = true;
    setPhase("leaving");
    audio.current?.whoosh();
    const c = camRef.current;
    const to: Camera =
      choice === "turn-back"
        ? { ...c, yaw: 2.6, pitch: 0.05, y: c.y + 0.15 }
        : { ...c, x: c.x - 0.7, z: c.z + 0.9, y: c.y - 0.25, yaw: -1.25, pitch: 0.4 };
    setFade(1);
    setTimeout(() => audio.current?.step(), 420);
    setTimeout(() => audio.current?.step(), 820);
    await animateCam(to, 1000);
    flightsTaken.current++;
    const correct = isCorrect(f, choice);
    if (correct && f.anomaly) logAnomaly(f.anomaly);
    const level = nextLevel(f.level, correct);
    setMessage(
      choice === "turn-back"
        ? "You turn around and climb back up.\nSomehow, the stairs still lead down."
        : "You round the landing and keep going down.",
    );
    setPhase("interlude");
    await wait(2000);
    loadFlight(
      createFlight({
        id: ++idRef.current,
        level,
        audioEnabled: audio.current?.enabled ?? true,
        lastAnomaly: f.anomaly,
      }),
    );
    setPhase("playing");
    setFade(0);
    busy.current = false;
  };

  const openDoor = async () => {
    if (phaseRef.current !== "playing" || busy.current) return;
    const f = flightRef.current;
    if (stepRef.current < f.steps || doorRef.current > 0) return;
    busy.current = true;
    audio.current?.creak();
    await animateDoor(1, 1300);
    if (f.level <= 0) {
      setPhase("escaping");
      await wait(500);
      setWhite(1);
      await wait(1600);
      const time = performance.now() - startedAt.current;
      setResult({ time, best: saveBestTime(time), flights: flightsTaken.current, logged: readLogbook().length });
      setPhase("escaped");
    }
    busy.current = false;
  };

  const handlers = useRef({ start, stepDown, decide, openDoor });
  handlers.current = { start, stepDown, decide, openDoor };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const h = handlers.current;
      if (phaseRef.current === "intro") {
        if (k === "enter") h.start();
        return;
      }
      if (["arrowdown", "arrowup", "w", "s", "e", " "].includes(k)) e.preventDefault();
      if (k === "w" || k === "arrowdown" || k === " ") {
        if (stepRef.current >= flightRef.current.steps) {
          if (!e.repeat) void h.decide("descend");
        } else void h.stepDown();
      } else if (k === "s" || k === "arrowup") {
        if (!e.repeat) void h.decide("turn-back");
      } else if (k === "e") void h.openDoor();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Press-and-hold on touch to keep walking.
  const holdTimer = useRef<number | null>(null);
  const stopHold = () => {
    if (holdTimer.current !== null) window.clearInterval(holdTimer.current);
    holdTimer.current = null;
  };
  const startHold = () => {
    stopHold();
    void stepDown();
    holdTimer.current = window.setInterval(() => void handlers.current.stepDown(), 100);
  };

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    saveSoundPref(next);
    audio.current?.setMuted(!next);
  };

  const atLanding = step >= flight.steps;
  const isExit = flight.level <= 0;
  const playing = phase === "playing";

  return (
    <main className="grain fixed inset-0 overflow-hidden bg-void select-none">
      <div className="absolute inset-0">
        <Scene
          flight={flight}
          cam={cam}
          door={door}
          step={step}
          canOpenDoor={playing && atLanding}
          onDoorClick={() => void openDoor()}
        />
      </div>
      <div className="vignette pointer-events-none absolute inset-0" />

      {/* Top HUD */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4 md:p-6">
        <Button variant="concrete" size="sm" asChild>
          <Link to="/">Leave</Link>
        </Button>
        {playing || phase === "leaving" || phase === "interlude" ? (
          <RunTimer startedAt={startedAt.current} />
        ) : (
          <span className="hidden text-[0.65rem] uppercase tracking-[0.4em] text-foreground/50 md:block">
            Stairwell B · Keep descending
          </span>
        )}
        <Button variant="concrete" size="sm" onClick={toggleSound} aria-label={sound ? "Mute sound" : "Turn sound on"}>
          {sound ? <Volume2 /> : <VolumeX />}
          {sound ? "Sound" : "Muted"}
        </Button>
      </header>

      {/* Bottom controls */}
      {playing && (
        <footer className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 p-4 pb-6 md:p-8">
          <p className="text-center text-[0.7rem] uppercase tracking-[0.3em] text-foreground/60">
            {isExit
              ? atLanding
                ? "Ground floor. Open the door."
                : "Daylight leaks in somewhere below."
              : atLanding
                ? door === 0
                  ? "The landing. Check the door — or decide."
                  : "Decide."
                : "Twelve steps. Count them."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {!isExit && (
              <Button variant="concrete" size="lg" onClick={() => void decide("turn-back")}>
                <Undo2 /> Turn back <Kbd>S</Kbd>
              </Button>
            )}
            {atLanding && door === 0 && (
              <Button variant="concrete" size="lg" onClick={() => void openDoor()}>
                <DoorOpen /> Open door <Kbd>E</Kbd>
              </Button>
            )}
            {!atLanding ? (
              <Button
                variant="hazard"
                size="lg"
                onPointerDown={startHold}
                onPointerUp={stopHold}
                onPointerLeave={stopHold}
                onPointerCancel={stopHold}
                onKeyDown={(e) => e.preventDefault()}
              >
                <ArrowDown /> Step down <Kbd tone="dark">W</Kbd>
              </Button>
            ) : (
              !isExit && (
                <Button variant="hazard" size="lg" onClick={() => void decide("descend")}>
                  <ArrowDown /> Next flight <Kbd tone="dark">W</Kbd>
                </Button>
              )
            )}
          </div>
        </footer>
      )}

      {/* Transitions */}
      <div
        className="pointer-events-none absolute inset-0 z-30 bg-void transition-opacity duration-700"
        style={{ opacity: fade }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-30 bg-daylight transition-opacity duration-[1500ms]"
        style={{ opacity: white }}
      />
      {phase === "interlude" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-8">
          <p className="max-w-md animate-in fade-in whitespace-pre-line text-center text-sm uppercase leading-relaxed tracking-[0.25em] text-foreground/80 duration-700">
            {message}
          </p>
        </div>
      )}

      {phase === "intro" && <Intro sound={sound} onToggleSound={toggleSound} onStart={start} />}
      {phase === "escaped" && <Escaped result={result} onRestart={start} />}
    </main>
  );
}

function RunTimer({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="flex items-center gap-2 border border-foreground/20 bg-background/50 px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.3em] text-foreground/80 tabular-nums backdrop-blur-sm">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
      {formatTime(Math.max(0, now - startedAt))}
    </span>
  );
}

function Kbd({ children, tone = "light" }: { children: string; tone?: "light" | "dark" }) {
  return (
    <kbd
      className={
        tone === "dark"
          ? "ml-1 hidden border border-primary-foreground/40 px-1.5 font-mono text-[0.65rem] md:inline"
          : "ml-1 hidden border border-foreground/30 px-1.5 font-mono text-[0.65rem] text-foreground/70 md:inline"
      }
    >
      {children}
    </kbd>
  );
}

function Intro({ sound, onToggleSound, onStart }: { sound: boolean; onToggleSound: () => void; onStart: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg border border-border bg-card shadow-[var(--shadow-sign)]">
        <div className="hazard-tape h-3" />
        <div className="space-y-6 p-6 md:p-8">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.4em] text-muted-foreground">Stairwell B · Level P8</p>
            <h1 className="text-stencil mt-2 text-4xl text-primary md:text-5xl">Notice to occupants</h1>
          </div>
          <ol className="space-y-3 text-sm leading-relaxed text-card-foreground">
            <li>
              <span className="text-primary">01</span> Every flight has exactly twelve steps and a landing with a door.
            </li>
            <li>
              <span className="text-primary">02</span> If nothing is wrong, keep going down.
            </li>
            <li>
              <span className="text-primary">03</span> If anything is wrong, turn around and walk back up.
            </li>
            <li>
              <span className="text-primary">04</span> One mistake and you are back on P8. Reach the ground floor to leave.
            </li>
          </ol>
          <div className="grid grid-cols-3 gap-2 text-center text-[0.65rem] uppercase tracking-widest text-muted-foreground">
            <div className="border border-border p-2">
              <span className="block text-foreground">W / ↓</span>step down
            </div>
            <div className="border border-border p-2">
              <span className="block text-foreground">S / ↑</span>turn back
            </div>
            <div className="border border-border p-2">
              <span className="block text-foreground">E</span>open door
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="concrete" onClick={onToggleSound}>
              {sound ? <Volume2 /> : <VolumeX />}
              {sound ? "Sound on · headphones advised" : "Sound off"}
            </Button>
            <Button variant="hazard" size="lg" onClick={onStart} autoFocus>
              Enter the stairwell
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Escaped({
  result,
  onRestart,
}: {
  result: { time: number; best: number; flights: number; logged: number };
  onRestart: () => void;
}) {
  const [best, setBest] = useState<number | null>(null);
  useEffect(() => setBest(readBestTime()), []);
  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-daylight text-daylight-foreground">
      <img src={daylight} alt="A steel door open onto bright daylight" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover opacity-70" />
      <div className="relative flex min-h-full flex-col items-center justify-center gap-8 p-6 text-center">
        <p className="text-xs uppercase tracking-[0.5em]">Ground floor</p>
        <h2 className="text-stencil text-6xl md:text-8xl">You got out.</h2>
        <dl className="grid grid-cols-3 gap-px border border-daylight-foreground/30 bg-daylight-foreground/30 text-left">
          {[
            ["Time", formatTime(result.time)],
            ["Flights walked", String(result.flights)],
            ["Anomalies logged", `${result.logged}/${ANOMALIES.length}`],
          ].map(([k, v]) => (
            <div key={k} className="bg-daylight/90 px-4 py-3 md:px-6">
              <dt className="text-[0.6rem] uppercase tracking-[0.3em] opacity-70">{k}</dt>
              <dd className="text-stencil mt-1 text-3xl">{v}</dd>
            </div>
          ))}
        </dl>
        {best !== null && <p className="text-xs uppercase tracking-[0.3em] opacity-70">Best escape {formatTime(best)}</p>}
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="hazard" size="lg" onClick={onRestart}>
            Go back in
          </Button>
          <Button variant="outline" size="lg" className="rounded-none uppercase tracking-widest" asChild>
            <Link to="/">See the logbook</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
