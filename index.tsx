import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/Reveal";
import { StepDrill } from "@/components/StepDrill";
import { formatTime, readBestTime, readLogbook } from "@/game/logbook";
import { ANOMALIES, type AnomalyId } from "@/game/logic";
import { cn } from "@/lib/utils";
import hero from "@/assets/stairwell-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Infinite Stairwell — a concrete anomaly loop" },
      {
        name: "description",
        content:
          "Trapped descending a brutalist concrete stairwell. Twelve steps, a landing, a door. Go down if it's safe; turn back if anything is wrong.",
      },
      { property: "og:title", content: "The Infinite Stairwell" },
      {
        property: "og:description",
        content: "Twelve steps, a landing, a door. Go down if it's safe; turn back if anything is wrong.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const RULES = [
  "Each flight consists of exactly twelve steps and a landing with a door.",
  "If the flight is safe, go down.",
  "If you encounter anything structurally wrong, turn around and walk back up.",
  "A mistake returns you to level P8.",
  "Reach the ground floor to leave.",
];

const TEAM = ["Medha Chaudhari", "Harshita Patil", "Aarya Karnik", "Janhavi Deshmukh"];

const NAV = [
  ["#rules", "Rules"],
  ["#drill", "Drill"],
  ["#logbook", "Logbook"],
  ["#credits", "Credits"],
] as const;

function Index() {
  const [found, setFound] = useState<AnomalyId[]>([]);
  const [best, setBest] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeRule, setActiveRule] = useState(0);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setFound(readLogbook());
    setBest(readBestTime());
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? window.scrollY / max : 0);
      setScrolled(window.scrollY > window.innerHeight * 0.6);
      heroRef.current?.style.setProperty("--scroll", String(window.scrollY));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onHeroMove = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", String((e.clientX - r.left) / r.width - 0.5));
    e.currentTarget.style.setProperty("--my", String((e.clientY - r.top) / r.height - 0.5));
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Scroll progress + sticky nav */}
      <div className="fixed inset-x-0 top-0 z-50 h-1 origin-left bg-primary" style={{ transform: `scaleX(${progress})` }} />
      <nav
        className={cn(
          "fixed inset-x-0 top-1 z-40 border-b border-border bg-background/85 backdrop-blur-md transition-all duration-300",
          scrolled ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0",
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 md:px-12">
          <a href="#top" className="text-stencil text-xl text-primary">
            Stairwell B
          </a>
          <div className="hidden gap-6 text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground sm:flex">
            {NAV.map(([href, label]) => (
              <a key={href} href={href} className="link-underline transition-colors hover:text-primary">
                {label}
              </a>
            ))}
          </div>
          <Button variant="hazard" size="sm" className="h-9 px-4 text-sm" asChild>
            <Link to="/play">Descend</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section
        id="top"
        ref={heroRef}
        onPointerMove={onHeroMove}
        className="grain relative flex min-h-[100svh] flex-col overflow-hidden"
      >
        <img
          src={hero}
          alt="Looking down a concrete stairwell toward a landing with a green steel door"
          width={1920}
          height={1088}
          className="hero-parallax absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
        <div className="relative z-10 flex items-center justify-between p-5 text-[0.65rem] uppercase tracking-[0.4em] text-foreground/70 md:p-8">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> Stairwell B
          </span>
          <div className="hidden gap-6 sm:flex">
            {NAV.map(([href, label]) => (
              <a key={href} href={href} className="link-underline transition-colors hover:text-primary">
                {label}
              </a>
            ))}
          </div>
        </div>
        <div className="relative z-10 mt-auto max-w-5xl p-5 pb-14 md:p-12 md:pb-20">
          <p className="mb-4 text-xs uppercase tracking-[0.4em] text-primary animate-in fade-in slide-in-from-bottom-2 duration-700">
            The concrete loop
          </p>
          <h1 className="glitch text-stencil text-[17vw] text-foreground animate-in fade-in slide-in-from-bottom-4 duration-1000 sm:text-8xl md:text-[9rem]">
            The Infinite
            <br />
            <span className="animate-flicker">Stairwell</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-foreground/80 animate-in fade-in duration-1000">
            Twelve steps. One landing. One door. Again. The architecture is lying to you — notice it, and turn back.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button variant="hazard" size="xl" className="hazard-glow" asChild>
              <Link to="/play">Start descending</Link>
            </Button>
            <Button variant="concrete" size="xl" asChild>
              <a href="#drill">Try the drill</a>
            </Button>
          </div>
        </div>
        <a
          href="#rules"
          aria-label="Scroll to the rules"
          className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 text-foreground/60 transition-colors hover:text-primary"
        >
          <ChevronDown className="animate-drift h-7 w-7" />
        </a>
      </section>

      {/* Rules */}
      <section id="rules" className="mx-auto grid max-w-6xl scroll-mt-20 gap-10 px-5 py-20 md:grid-cols-[1.1fr_1fr] md:px-12 md:py-28">
        <Reveal className="border border-border bg-card shadow-[var(--shadow-sign)]">
          <div className="hazard-tape hazard-move h-3" />
          <div className="p-6 md:p-10">
            <p className="text-[0.65rem] uppercase tracking-[0.4em] text-muted-foreground">Posted by building management</p>
            <h2 className="text-stencil mt-3 text-5xl text-primary">Notice</h2>
            <ol className="mt-8 space-y-2 text-sm leading-relaxed">
              {RULES.map((rule, i) => (
                <li key={rule}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveRule(i)}
                    onFocus={() => setActiveRule(i)}
                    onClick={() => setActiveRule(i)}
                    className={cn(
                      "flex w-full gap-4 border-l-2 px-3 py-2 text-left transition-all duration-300",
                      activeRule === i
                        ? "border-primary bg-secondary/60 translate-x-1"
                        : "border-transparent text-foreground/70 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "text-stencil text-2xl transition-colors",
                        activeRule === i ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="pt-1">{rule}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
        <Reveal delay={150} className="flex flex-col justify-center gap-8">
          <div>
            <h3 className="text-stencil text-3xl">How to walk</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Take each step yourself. Count them. Read the walls. Listen behind you. On the landing, try the door.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-px border border-border bg-border text-center">
            {[
              ["W / ↓", "Step down"],
              ["S / ↑", "Turn back"],
              ["E", "Open door"],
            ].map(([k, v]) => (
              <div key={k} className="group bg-background p-4 transition-colors hover:bg-secondary">
                <dt className="text-stencil text-2xl text-primary transition-transform duration-200 group-hover:-translate-y-1 group-active:translate-y-0.5">
                  {k}
                </dt>
                <dd className="mt-1 text-[0.65rem] uppercase tracking-[0.25em] text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs leading-relaxed text-muted-foreground">
            On a phone, use the buttons — hold “Step down” to keep walking. Headphones advised.
          </p>
        </Reveal>
      </section>

      {/* Drill */}
      <section id="drill" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 md:grid-cols-[1fr_1.2fr] md:px-12 md:py-24">
          <Reveal>
            <p className="text-[0.65rem] uppercase tracking-[0.4em] text-muted-foreground">Warm-up</p>
            <h2 className="text-stencil mt-2 text-5xl">Count before you commit</h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Some flights have one step too many. Some have one too few. Practise spotting the wrong ones before you go
              in for real.
            </p>
          </Reveal>
          <Reveal delay={150}>
            <StepDrill />
          </Reveal>
        </div>
      </section>

      {/* Logbook */}
      <section id="logbook" className="scroll-mt-20 border-t border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-5 py-20 md:px-12 md:py-24">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.4em] text-muted-foreground">Incident log</p>
              <h2 className="text-stencil mt-2 text-5xl">
                {found.length}
                <span className="text-muted-foreground">/{ANOMALIES.length}</span> anomalies
              </h2>
            </div>
            {best !== null && (
              <p className="text-xs uppercase tracking-[0.3em] text-primary">Best escape · {formatTime(best)}</p>
            )}
          </Reveal>
          <div className="mt-6 h-1.5 w-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-1000"
              style={{ width: `${(found.length / ANOMALIES.length) * 100}%` }}
            />
          </div>
          <p className="mt-4 max-w-lg text-sm text-muted-foreground">
            An anomaly is logged when you spot it and turn back. Unlogged entries stay redacted.
          </p>
          <ul className="mt-10 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
            {ANOMALIES.map((a, i) => {
              const seen = found.includes(a.id);
              return (
                <Reveal
                  as="li"
                  key={a.id}
                  delay={i * 80}
                  className="group relative flex min-h-40 flex-col gap-3 overflow-hidden bg-background p-5 transition-colors hover:bg-secondary"
                >
                  <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100" />
                  <span className="text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">
                    No. {String(i + 1).padStart(2, "0")}
                  </span>
                  {seen ? (
                    <>
                      <h3 className="text-stencil text-xl text-primary">{a.name}</h3>
                      <p className="text-xs leading-relaxed text-muted-foreground">{a.clue}</p>
                    </>
                  ) : (
                    <>
                      <span className="h-4 w-3/4 bg-secondary transition-opacity group-hover:opacity-30" />
                      <span className="h-3 w-full bg-muted transition-opacity group-hover:opacity-30" />
                      <span className="h-3 w-2/3 bg-muted transition-opacity group-hover:opacity-30" />
                      <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[0.6rem] uppercase tracking-[0.3em] text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <Lock className="h-4 w-4" /> Classified
                      </span>
                    </>
                  )}
                </Reveal>
              );
            })}
          </ul>
          <div className="mt-12">
            <Button variant="hazard" size="xl" className="hazard-glow" asChild>
              <Link to="/play">Go back down</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Credits */}
      <section id="credits" className="scroll-mt-20 border-t border-border px-5 py-20 text-center">
        <Reveal>
          <p className="text-[0.65rem] uppercase tracking-[0.4em] text-muted-foreground">Credits</p>
          <h2 className="text-stencil mt-3 text-4xl text-primary md:text-5xl">Team Quantum Cartel</h2>
          <p className="mt-4 text-xs uppercase tracking-[0.3em] text-foreground/80">Team Members &amp; Credits</p>
        </Reveal>
        <ul className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map((name, i) => (
            <Reveal
              as="li"
              key={name}
              delay={i * 100}
              className="group relative overflow-hidden border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-[var(--shadow-sign)]"
            >
              <div className="hazard-tape absolute inset-x-0 top-0 h-1.5 -translate-y-full transition-transform duration-300 group-hover:translate-y-0" />
              <span className="text-stencil mx-auto flex h-14 w-14 items-center justify-center border border-border text-2xl text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                {name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")}
              </span>
              <p className="mt-4 text-sm text-foreground">{name}</p>
            </Reveal>
          ))}
        </ul>
      </section>

      <footer className="border-t border-border px-5 py-8 text-center text-[0.6rem] uppercase tracking-[0.4em] text-muted-foreground">
        Stairwell B · Do not prop doors open
      </footer>
    </main>
  );
}
