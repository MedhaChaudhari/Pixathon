// Tiny pinhole-camera projection with near-plane clipping, rendered into SVG coordinates.

export const VIEW_W = 1000;
export const VIEW_H = 640;
export const FOCAL = 560;
const NEAR = 0.06;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Camera extends Vec3 {
  pitch: number; // positive looks down
  yaw: number; // negative turns left
}

export interface Projected {
  points: string;
  depth: number;
  pts: [number, number][];
}

function toCamera(cam: Camera, p: Vec3): Vec3 {
  const dx = p.x - cam.x;
  const dy = p.y - cam.y;
  const dz = p.z - cam.z;
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const x1 = dx * cy - dz * sy;
  const z1 = dx * sy + dz * cy;
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  return { x: x1, y: dy * cp + z1 * sp, z: -dy * sp + z1 * cp };
}

function clipNear(poly: Vec3[]): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const aIn = a.z >= NEAR;
    const bIn = b.z >= NEAR;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      const t = (NEAR - a.z) / (b.z - a.z);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR });
    }
  }
  return out;
}

function screen(c: Vec3): [number, number] {
  return [VIEW_W / 2 + (FOCAL * c.x) / c.z, VIEW_H / 2 - (FOCAL * c.y) / c.z];
}

export function projectPoint(cam: Camera, p: Vec3): { x: number; y: number; depth: number } | null {
  const c = toCamera(cam, p);
  if (c.z < NEAR) return null;
  const [x, y] = screen(c);
  return { x, y, depth: c.z };
}

export function projectPoly(cam: Camera, poly: Vec3[]): Projected | null {
  const clipped = clipNear(poly.map((p) => toCamera(cam, p)));
  if (clipped.length < 3) return null;
  const pts = clipped.map(screen);
  const depth = clipped.reduce((s, c) => s + c.z, 0) / clipped.length;
  return { pts, depth, points: pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ") };
}

/** Affine matrix mapping a local (u,v) box of size U×V onto a projected 3D quad (origin, +u corner, +v corner). */
export function planeMatrix(cam: Camera, o: Vec3, ou: Vec3, ov: Vec3, U: number, V: number): string | null {
  const po = projectPoint(cam, o);
  const pu = projectPoint(cam, ou);
  const pv = projectPoint(cam, ov);
  if (!po || !pu || !pv) return null;
  const a = (pu.x - po.x) / U;
  const b = (pu.y - po.y) / U;
  const c = (pv.x - po.x) / V;
  const d = (pv.y - po.y) / V;
  return `matrix(${a} ${b} ${c} ${d} ${po.x} ${po.y})`;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function lerpCamera(a: Camera, b: Camera, t: number): Camera {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
    pitch: lerp(a.pitch, b.pitch, t),
    yaw: lerp(a.yaw, b.yaw, t),
  };
}
