import type { ReactNode } from "react";
import { levelLabel, type Flight } from "./logic";
import {
  FOCAL,
  VIEW_H,
  VIEW_W,
  planeMatrix,
  projectPoint,
  projectPoly,
  type Camera,
  type Vec3,
} from "./projection";

export const STAIR = {
  HW: 1.2, // half width of the flight
  D: 0.3, // tread depth
  R: 0.18, // riser height
  LANDING: 2.2,
  CEIL: 2.8,
  PAINT: 1.05,
  EYE: 1.6,
  DOOR_X0: 0.12,
  DOOR_X1: 0.98,
  DOOR_H: 2.05,
};

export function flightGeometry(steps: number) {
  const yL = -steps * STAIR.R;
  const zL = (steps - 1) * STAIR.D;
  const zW = zL + STAIR.LANDING;
  return { yL, zL, zW };
}

export function cameraForStep(k: number, steps: number): Camera {
  const { yL, zL } = flightGeometry(steps);
  if (k <= 0) return { x: 0, y: STAIR.EYE, z: -0.8, pitch: 0.58, yaw: 0 };
  if (k >= steps) return { x: 0.1, y: yL + STAIR.EYE, z: zL - 0.05, pitch: 0.02, yaw: 0 };
  return { x: 0, y: -k * STAIR.R + STAIR.EYE, z: (k - 1) * STAIR.D + 0.15, pitch: 0.58, yaw: 0 };
}

interface SceneProps {
  flight: Flight;
  cam: Camera;
  door: number; // 0 closed → 1 open
  step: number;
  canOpenDoor: boolean;
  onDoorClick: () => void;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function Scene({ flight, cam, door, step, canOpenDoor, onDoorClick }: SceneProps) {
  const { HW, D, R, CEIL, PAINT } = STAIR;
  const N = flight.steps;
  const { yL, zL, zW } = flightGeometry(N);
  const a = flight.anomaly;
  const isExit = flight.level <= 0;
  const lamp: Vec3 = { x: 0.55, y: yL + 2.4, z: zW - 0.1 };

  const pitchLine = (z: number) => {
    if (z <= 0) return 0;
    if (z <= zL) return -(z / D) * R;
    if (z <= zL + D) return -(N - 1) * R + (-R * (z - zL)) / D;
    return yL;
  };

  const shade = (depth: number, c: Vec3, boost = 1) => {
    const fog = clamp(1.05 - depth * 0.1, 0.12, 0.82);
    const dx = c.x - lamp.x;
    const dy = c.y - lamp.y;
    const dz = c.z - lamp.z;
    const glow = 0.5 * Math.exp(-(dx * dx + dy * dy + dz * dz) / 4);
    return clamp((fog * 0.72 + glow) * boost, 0.05, 1);
  };
  const tone = (token: string, s: number) =>
    `color-mix(in oklab, var(${token}) ${Math.round(s * 100)}%, var(--scene-void))`;

  let key = 0;
  const poly = (pts: Vec3[], token: string, boost = 1, extra?: Record<string, unknown>): ReactNode => {
    const p = projectPoly(cam, pts);
    if (!p) return null;
    const c = pts.reduce((acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y, z: acc.z + v.z }), { x: 0, y: 0, z: 0 });
    c.x /= pts.length;
    c.y /= pts.length;
    c.z /= pts.length;
    const f = tone(token, shade(p.depth, c, boost));
    return <polygon key={key++} points={p.points} fill={f} stroke={f} strokeWidth={0.8} strokeLinejoin="round" {...extra} />;
  };

  // ── Slices along the flight (top floor, treads, landing) ──
  type Slice = { z0: number; z1: number; y: number; landing?: boolean };
  const slices: Slice[] = [
    { z0: -1.8, z1: -0.8, y: 0 },
    { z0: -0.8, z1: 0, y: 0 },
  ];
  for (let j = 0; j <= N - 2; j++) slices.push({ z0: j * D, z1: (j + 1) * D, y: -(j + 1) * R });
  slices.push({ z0: zL, z1: zL + D, y: yL, landing: true });
  const mid = (zL + D + zW) / 2;
  slices.push({ z0: zL + D, z1: mid, y: yL, landing: true });
  slices.push({ z0: mid, z1: zW, y: yL, landing: true });
  const farToNear = [...slices].reverse();

  const OPEN_Z0 = zL + 0.2;
  const OPEN_TOP = yL + 2.4;

  // ── Ceiling + far wall ──
  const ceiling = poly(
    [
      { x: -HW, y: CEIL, z: -1.8 },
      { x: HW, y: CEIL, z: -1.8 },
      { x: HW, y: CEIL, z: zW },
      { x: -HW, y: CEIL, z: zW },
    ],
    "--scene-ceiling",
  );

  const farWall = [
    poly(
      [
        { x: -HW, y: yL + PAINT, z: zW },
        { x: HW, y: yL + PAINT, z: zW },
        { x: HW, y: CEIL, z: zW },
        { x: -HW, y: CEIL, z: zW },
      ],
      "--scene-concrete-far",
    ),
    poly(
      [
        { x: -HW, y: yL, z: zW },
        { x: HW, y: yL, z: zW },
        { x: HW, y: yL + PAINT, z: zW },
        { x: -HW, y: yL + PAINT, z: zW },
      ],
      "--scene-paint",
    ),
    poly(
      [
        { x: -HW, y: yL + PAINT - 0.025, z: zW - 0.001 },
        { x: HW, y: yL + PAINT - 0.025, z: zW - 0.001 },
        { x: HW, y: yL + PAINT + 0.025, z: zW - 0.001 },
        { x: -HW, y: yL + PAINT + 0.025, z: zW - 0.001 },
      ],
      "--scene-hazard",
      1.1,
    ),
  ];

  // ── Door ──
  const { DOOR_X0: dx0, DOOR_X1: dx1, DOOR_H } = STAIR;
  const opening: Vec3[] = [
    { x: dx0, y: yL, z: zW },
    { x: dx1, y: yL, z: zW },
    { x: dx1, y: yL + DOOR_H, z: zW },
    { x: dx0, y: yL + DOOR_H, z: zW },
  ];
  const openingP = projectPoly(cam, opening);
  const clipId = `door-clip-${flight.id}`;
  const brickId = `bricks-${flight.id}`;
  const hingeRight = a !== "swapped-door";
  const hx = hingeRight ? dx1 : dx0;
  const s = hingeRight ? -1 : 1;
  const w = dx1 - dx0;
  const phi = door * 1.55;
  const onPanel = (u: number, y: number): Vec3 => ({
    x: hx + s * u * Math.cos(phi),
    y,
    z: zW + u * Math.sin(phi),
  });
  const doorDepth = openingP?.depth ?? 4;
  const brickW = (FOCAL * 0.26) / (doorDepth + 0.95);
  const brickH = brickW * 0.36;

  const interior: ReactNode[] = [];
  if (door > 0.001 && openingP) {
    if (isExit) {
      interior.push(<polygon key="day" points={openingP.points} fill="var(--daylight)" />);
    } else if (a === "brick-door") {
      interior.push(
        <polygon key="brick-bg" points={openingP.points} fill="var(--scene-void)" />,
        poly(
          [
            { x: -0.5, y: yL - 0.1, z: zW + 0.95 },
            { x: 1.6, y: yL - 0.1, z: zW + 0.95 },
            { x: 1.6, y: yL + 2.6, z: zW + 0.95 },
            { x: -0.5, y: yL + 2.6, z: zW + 0.95 },
          ],
          "--scene-brick",
          1.1,
        ),
      );
      const bp = projectPoly(cam, [
        { x: -0.5, y: yL - 0.1, z: zW + 0.95 },
        { x: 1.6, y: yL - 0.1, z: zW + 0.95 },
        { x: 1.6, y: yL + 2.6, z: zW + 0.95 },
        { x: -0.5, y: yL + 2.6, z: zW + 0.95 },
      ]);
      if (bp) interior.push(<polygon key="brick-pat" points={bp.points} fill={`url(#${brickId})`} opacity={0.9} />);
    } else {
      interior.push(
        <polygon key="room-bg" points={openingP.points} fill="var(--scene-void)" />,
        poly(
          [
            { x: -3, y: yL, z: zW },
            { x: 4, y: yL, z: zW },
            { x: 4, y: yL, z: zW + 9 },
            { x: -3, y: yL, z: zW + 9 },
          ],
          "--scene-room",
          1.3,
        ),
        poly(
          [
            { x: 0.5, y: yL + 0.001, z: zW + 1.2 },
            { x: 0.62, y: yL + 0.001, z: zW + 1.2 },
            { x: 0.62, y: yL + 0.001, z: zW + 8 },
            { x: 0.5, y: yL + 0.001, z: zW + 8 },
          ],
          "--scene-hazard",
          0.7,
        ),
        poly(
          [
            { x: -0.2, y: yL + 2.7, z: zW + 3.4 },
            { x: 1.3, y: yL + 2.7, z: zW + 3.4 },
            { x: 1.3, y: yL + 2.7, z: zW + 3.6 },
            { x: -0.2, y: yL + 2.7, z: zW + 3.6 },
          ],
          "--scene-fluoro",
          2.4,
        ),
      );
    }
  }

  const panel = poly(
    [onPanel(0, yL + 0.01), onPanel(w, yL + 0.01), onPanel(w, yL + DOOR_H - 0.01), onPanel(0, yL + DOOR_H - 0.01)],
    "--scene-door",
    1 - door * 0.45,
  );
  const handle = [
    poly(
      [onPanel(w - 0.11, yL + 0.92), onPanel(w - 0.06, yL + 0.92), onPanel(w - 0.06, yL + 1.1), onPanel(w - 0.11, yL + 1.1)],
      "--scene-steel",
      0.9,
    ),
    poly(
      [onPanel(w - 0.22, yL + 1.0), onPanel(w - 0.07, yL + 1.0), onPanel(w - 0.07, yL + 1.035), onPanel(w - 0.22, yL + 1.035)],
      "--scene-steel",
      1.1,
    ),
  ];

  // ── Signs, lamp ──
  const signM = planeMatrix(
    cam,
    { x: -1.05, y: yL + 1.95, z: zW - 0.002 },
    { x: -0.2, y: yL + 1.95, z: zW - 0.002 },
    { x: -1.05, y: yL + 1.15, z: zW - 0.002 },
    85,
    80,
  );
  const exitM = planeMatrix(
    cam,
    { x: -1.1, y: yL + 2.62, z: zW - 0.03 },
    { x: -0.45, y: yL + 2.62, z: zW - 0.03 },
    { x: -1.1, y: yL + 2.38, z: zW - 0.03 },
    65,
    24,
  );
  const lampM = planeMatrix(
    cam,
    { x: 0.4, y: yL + 2.52, z: zW - 0.04 },
    { x: 0.7, y: yL + 2.52, z: zW - 0.04 },
    { x: 0.4, y: yL + 2.3, z: zW - 0.04 },
    30,
    22,
  );
  const arrowRot = isExit ? 90 : a === "exit-up" ? 0 : 225;
  const red = a === "red-light";
  const signShade = clamp(1.25 - doorDepth * 0.06, 0.45, 1);

  // ── Left opening + next flight ──
  const openQuad: Vec3[] = [
    { x: -HW, y: yL, z: OPEN_Z0 },
    { x: -HW, y: yL, z: zW },
    { x: -HW, y: OPEN_TOP, z: zW },
    { x: -HW, y: OPEN_TOP, z: OPEN_Z0 },
  ];
  const openP = projectPoly(cam, openQuad);
  const openClip = `open-clip-${flight.id}`;
  const nextFlight: ReactNode[] = [];
  if (openP) {
    nextFlight.push(<polygon key={key++} points={openP.points} fill="var(--scene-void)" />);
    nextFlight.push(
      poly(
        [
          { x: -HW - 2.4, y: yL - 1.6, z: zW },
          { x: -HW, y: yL - 1.6, z: zW },
          { x: -HW, y: OPEN_TOP, z: zW },
          { x: -HW - 2.4, y: OPEN_TOP, z: zW },
        ],
        "--scene-concrete-far",
        0.55,
      ),
    );
    for (let k = 6; k >= 0; k--) {
      const x0 = -HW - (k + 1) * D;
      const x1 = -HW - k * D;
      const y = yL - (k + 1) * R;
      nextFlight.push(
        poly(
          [
            { x: x0, y, z: OPEN_Z0 + 0.05 },
            { x: x1, y, z: OPEN_Z0 + 0.05 },
            { x: x1, y, z: zW },
            { x: x0, y, z: zW },
          ],
          "--scene-tread",
          0.6,
        ),
        poly(
          [
            { x: x0, y: y + 0.001, z: OPEN_Z0 + 0.05 },
            { x: x0 + 0.06, y: y + 0.001, z: OPEN_Z0 + 0.05 },
            { x: x0 + 0.06, y: y + 0.001, z: zW },
            { x: x0, y: y + 0.001, z: zW },
          ],
          "--scene-hazard",
          0.6,
        ),
      );
    }
  }

  // ── Side walls ──
  const walls: ReactNode[] = [];
  for (const sl of farToNear) {
    const p0 = pitchLine(sl.z0);
    const p1 = pitchLine(sl.z1);
    for (const side of [1, -1]) {
      const x = side * HW;
      const boost = side === 1 ? 0.88 : 1;
      if (side === -1 && sl.landing) {
        // Left side of the landing opens onto the next flight; draw the lintel + jamb only.
        walls.push(
          poly(
            [
              { x, y: OPEN_TOP, z: sl.z0 },
              { x, y: OPEN_TOP, z: sl.z1 },
              { x, y: CEIL, z: sl.z1 },
              { x, y: CEIL, z: sl.z0 },
            ],
            "--scene-concrete",
            boost,
          ),
        );
        if (sl.z0 < OPEN_Z0) {
          walls.push(
            poly(
              [
                { x, y: yL, z: sl.z0 },
                { x, y: yL, z: OPEN_Z0 },
                { x, y: OPEN_TOP, z: OPEN_Z0 },
                { x, y: OPEN_TOP, z: sl.z0 },
              ],
              "--scene-paint",
              boost,
            ),
          );
        }
        continue;
      }
      walls.push(
        poly(
          [
            { x, y: p0 + PAINT, z: sl.z0 },
            { x, y: p1 + PAINT, z: sl.z1 },
            { x, y: CEIL, z: sl.z1 },
            { x, y: CEIL, z: sl.z0 },
          ],
          "--scene-concrete",
          boost,
        ),
        poly(
          [
            { x, y: sl.y, z: sl.z0 },
            { x, y: sl.y, z: sl.z1 },
            { x, y: p1 + PAINT, z: sl.z1 },
            { x, y: p0 + PAINT, z: sl.z0 },
          ],
          "--scene-paint",
          boost,
        ),
        poly(
          [
            { x, y: p0 + PAINT - 0.025, z: sl.z0 },
            { x, y: p1 + PAINT - 0.025, z: sl.z1 },
            { x, y: p1 + PAINT + 0.025, z: sl.z1 },
            { x, y: p0 + PAINT + 0.025, z: sl.z0 },
          ],
          "--scene-hazard",
          boost,
        ),
      );
    }
  }

  // ── Graffiti on the right wall ──
  const gz0 = 1.0;
  const gz1 = 2.7;
  const gTop = pitchLine((gz0 + gz1) / 2) + 1.85;
  const graffitiM = planeMatrix(
    cam,
    { x: HW - 0.002, y: gTop, z: gz1 },
    { x: HW - 0.002, y: gTop, z: gz0 },
    { x: HW - 0.002, y: gTop - 0.55, z: gz1 },
    200,
    60,
  );

  // ── Floors (far → near) with hazard nosings, figure inserted after the landing ──
  const floors: ReactNode[] = [];
  let figureDrawn = false;
  const figure = () => {
    if (a !== "figure" || step >= N - 4) return null;
    const fz = zW - 0.55;
    const feet = projectPoint(cam, { x: -0.72, y: yL, z: fz });
    const head = projectPoint(cam, { x: -0.72, y: yL + 1.76, z: fz });
    if (!feet || !head) return null;
    const h = feet.y - head.y;
    const fw = h * 0.33;
    return (
      <path
        key="figure"
        d="M50,0 C62,0 70,10 70,24 C70,38 62,48 50,48 C38,48 30,38 30,24 C30,10 38,0 50,0 Z M28,56 C40,50 60,50 72,56 C84,62 90,80 92,110 L96,180 C96,186 88,188 86,182 L80,120 L78,190 L76,300 L58,300 L52,200 L48,200 L42,300 L24,300 L22,190 L20,120 L14,182 C12,188 4,186 4,180 L8,110 C10,80 16,62 28,56 Z"
        transform={`translate(${head.x - fw / 2} ${head.y}) scale(${fw / 100} ${h / 300})`}
        fill="var(--scene-void)"
        opacity={0.93}
      />
    );
  };
  for (const sl of farToNear) {
    if (!sl.landing && !figureDrawn) {
      floors.push(figure());
      figureDrawn = true;
    }
    floors.push(
      poly(
        [
          { x: -HW, y: sl.y, z: sl.z0 },
          { x: HW, y: sl.y, z: sl.z0 },
          { x: HW, y: sl.y, z: sl.z1 },
          { x: -HW, y: sl.y, z: sl.z1 },
        ],
        "--scene-tread",
        sl.landing ? 0.92 : 1,
      ),
    );
    if (!sl.landing) {
      floors.push(
        poly(
          [
            { x: -HW, y: sl.y + 0.001, z: sl.z1 - 0.06 },
            { x: HW, y: sl.y + 0.001, z: sl.z1 - 0.06 },
            { x: HW, y: sl.y + 0.001, z: sl.z1 },
            { x: -HW, y: sl.y + 0.001, z: sl.z1 },
          ],
          "--scene-hazard",
        ),
      );
    } else if (sl.z1 > OPEN_Z0) {
      floors.push(
        poly(
          [
            { x: -HW, y: yL + 0.001, z: Math.max(sl.z0, OPEN_Z0 + 0.05) },
            { x: -HW + 0.06, y: yL + 0.001, z: Math.max(sl.z0, OPEN_Z0 + 0.05) },
            { x: -HW + 0.06, y: yL + 0.001, z: sl.z1 },
            { x: -HW, y: yL + 0.001, z: sl.z1 },
          ],
          "--scene-hazard",
        ),
      );
    }
  }

  // ── Handrail on the left wall ──
  const railEnd = a === "broken-rail" ? zL * 0.42 : zL;
  const railZs = [-1.8, 0];
  for (let z = 0.6; z < railEnd; z += 0.6) railZs.push(z);
  railZs.push(railEnd);
  const rx = -HW + 0.07;
  const railTop = railZs.map((z) => ({ x: rx, y: pitchLine(z) + 0.95, z }));
  const railBottom = railZs.map((z) => ({ x: rx, y: pitchLine(z) + 0.89, z })).reverse();
  const rail: ReactNode[] = [];
  for (let i = 0; i < railTop.length - 1; i++) {
    const t0 = railTop[i]!;
    const t1 = railTop[i + 1]!;
    const b1 = railBottom[railBottom.length - 2 - i]!;
    const b0 = railBottom[railBottom.length - 1 - i]!;
    rail.push(poly([t0, t1, b1, b0], "--scene-steel", 0.75));
  }
  for (let z = 0.3; z < railEnd - 0.1; z += 1.2) {
    const y = pitchLine(z) + 0.89;
    rail.push(
      poly(
        [
          { x: -HW, y: y - 0.06, z },
          { x: rx, y: y - 0.06, z },
          { x: rx, y, z },
          { x: -HW, y, z },
        ],
        "--scene-steel",
        0.6,
      ),
    );
  }
  if (a === "broken-rail") {
    const y = pitchLine(railEnd) + 0.92;
    rail.push(
      poly(
        [
          { x: rx, y: y + 0.03, z: railEnd },
          { x: rx + 0.03, y: y - 0.32, z: railEnd + 0.12 },
          { x: rx + 0.03, y: y - 0.36, z: railEnd + 0.1 },
          { x: rx, y: y - 0.03, z: railEnd - 0.03 },
        ],
        "--scene-steel",
        0.7,
      ),
    );
  }

  // ── Lamp glow ──
  const lampP = projectPoint(cam, lamp);
  const glowR = lampP ? (FOCAL * 2.2) / lampP.depth : 0;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      role="img"
      aria-label={`Concrete stairwell, landing ${levelLabel(flight.level)}`}
    >
      <defs>
        {openingP && (
          <clipPath id={clipId}>
            <polygon points={openingP.points} />
          </clipPath>
        )}
        {openP && (
          <clipPath id={openClip}>
            <polygon points={openP.points} />
          </clipPath>
        )}
        <pattern id={brickId} width={brickW} height={brickH * 2} patternUnits="userSpaceOnUse">
          <rect width={brickW} height={brickH * 2} fill="var(--scene-brick)" />
          <path
            d={`M0 0 H${brickW} M0 ${brickH} H${brickW} M${brickW / 2} 0 V${brickH} M0 ${brickH} V${brickH * 2} M${brickW} ${brickH} V${brickH * 2}`}
            stroke="var(--scene-mortar)"
            strokeWidth={Math.max(1, brickH * 0.12)}
            opacity={0.8}
          />
        </pattern>
        <radialGradient id="lamp-glow">
          <stop offset="0%" stopColor={red ? "var(--scene-alarm)" : "var(--scene-light)"} stopOpacity={red ? 0.75 : 0.42} />
          <stop offset="45%" stopColor={red ? "var(--scene-alarm)" : "var(--scene-light)"} stopOpacity={red ? 0.25 : 0.1} />
          <stop offset="100%" stopColor="var(--scene-light)" stopOpacity={0} />
        </radialGradient>
      </defs>

      <rect width={VIEW_W} height={VIEW_H} fill="var(--scene-void)" />
      {ceiling}
      {farWall}

      {/* Door */}
      <g clipPath={openingP ? `url(#${clipId})` : undefined}>
        {interior}
        {panel}
        {door < 0.6 && handle}
      </g>
      {openingP && (
        <polygon
          points={openingP.points}
          fill="none"
          stroke="var(--scene-frame)"
          strokeWidth={Math.max(2, (FOCAL * 0.05) / openingP.depth)}
          strokeLinejoin="round"
        />
      )}

      {/* Level sign */}
      {signM && (
        <g transform={signM} opacity={signShade}>
          <g transform={a === "mirrored-sign" ? "translate(85 0) scale(-1 1)" : undefined}>
            <text x={4} y={14} fontSize={12} fill="var(--scene-hazard)" className="font-mono" letterSpacing={3}>
              LEVEL
            </text>
            <text x={2} y={78} fontSize={70} fill="var(--scene-hazard)" className="text-stencil">
              {levelLabel(flight.level)}
            </text>
          </g>
        </g>
      )}

      {/* Exit sign */}
      {exitM && (
        <g transform={exitM}>
          <rect width={65} height={24} rx={1.5} fill="var(--scene-exit)" />
          <text x={5} y={18} fontSize={15} fontWeight={700} fill="var(--scene-exit-foreground)" className="font-mono">
            EXIT
          </text>
          <path
            d="M0,-8 L7,-1 L2.5,-1 L2.5,8 L-2.5,8 L-2.5,-1 L-7,-1 Z"
            transform={`translate(53 12) rotate(${arrowRot})`}
            fill="var(--scene-exit-foreground)"
          />
        </g>
      )}

      {/* Lamp */}
      {lampM && (
        <g transform={lampM} className={red ? undefined : "animate-flicker"}>
          <rect x={1} y={1} width={28} height={20} rx={9} fill="var(--scene-frame)" />
          <ellipse cx={15} cy={11} rx={12} ry={8} fill={red ? "var(--scene-alarm)" : "var(--scene-light)"} />
          <path d="M3 11 H27 M15 3 V19 M8 4 V18 M22 4 V18" stroke="var(--scene-frame)" strokeWidth={1.4} />
        </g>
      )}

      <g clipPath={openP ? `url(#${openClip})` : undefined}>{nextFlight}</g>
      {walls}

      {graffitiM && (
        <g transform={graffitiM}>
          <text
            x={8}
            y={44}
            fontSize={38}
            textLength={184}
            lengthAdjust="spacingAndGlyphs"
            transform="rotate(-3 100 30)"
            fill="var(--scene-graffiti)"
            opacity={0.82}
            className="font-marker"
          >
            {flight.graffiti}
          </text>
        </g>
      )}

      {floors}
      {rail}

      {lampP && (
        <circle
          cx={lampP.x}
          cy={lampP.y}
          r={glowR}
          fill="url(#lamp-glow)"
          style={{ mixBlendMode: "screen" }}
          className={red ? undefined : "animate-flicker"}
        />
      )}
      {red && (
        <rect width={VIEW_W} height={VIEW_H} fill="var(--scene-alarm)" opacity={0.5} style={{ mixBlendMode: "multiply" }} />
      )}

      {canOpenDoor && openingP && door === 0 && (
        <polygon
          points={openingP.points}
          fill="transparent"
          className="cursor-pointer"
          onClick={onDoorClick}
          aria-label="Open the door"
        />
      )}
    </svg>
  );
}
