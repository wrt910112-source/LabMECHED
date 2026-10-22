import * as T from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { PartId } from "./data";
export type DoorId =
  | "ise-top"
  | "ise-top-rear"
  | "ise-middle"
  | "ise-bottom"
  | "loader-door"
  | "syringe-front"
  | "syringe-rear";
export type DoorState = Record<DoorId, boolean>;
export const closedDoors: DoorState = {
  "ise-top": false,
  "ise-top-rear": false,
  "ise-middle": false,
  "ise-bottom": false,
  "loader-door": false,
  "syringe-front": false,
  "syringe-rear": false,
};
export function createEnclosures(
  root: T.Group,
  groups: Map<PartId, T.Group>,
  register: (id: PartId, p?: T.Group) => T.Group,
) {
  const white = new T.MeshStandardMaterial({
    color: "#dedfd7",
    roughness: 0.36,
  });
  const steel = new T.MeshStandardMaterial({
    color: "#9eacae",
    metalness: 0.7,
    roughness: 0.3,
  });
  const dark = new T.MeshPhysicalMaterial({
    color: "#111d22",
    transparent: true,
    opacity: 0.92,
    roughness: 0.14,
    metalness: 0.25,
  });
  const plastic = new T.MeshStandardMaterial({
    color: "#e2e9df",
    roughness: 0.4,
  });
  function box(
    p: T.Object3D,
    n: string,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m: T.Material = white,
  ) {
    const o = new T.Mesh(
      new RoundedBoxGeometry(w, h, d, 3, Math.min(0.014, w / 4, h / 4, d / 4)),
      m,
    );
    o.name = n;
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    p.add(o);
    return o;
  }
  function cyl(
    p: T.Object3D,
    n: string,
    r: number,
    h: number,
    x: number,
    y: number,
    z: number,
    m: T.Material = steel,
  ) {
    const o = new T.Mesh(new T.CylinderGeometry(r, r, h, 32), m);
    o.name = n;
    o.position.set(x, y, z);
    p.add(o);
    return o;
  }
  function tube(
    p: T.Object3D,
    n: string,
    pts: number[][],
    m: T.Material = steel,
  ) {
    const o = new T.Mesh(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(
          pts.map((v) => new T.Vector3(...(v as [number, number, number]))),
        ),
        28,
        0.004,
        8,
        false,
      ),
      m,
    );
    o.name = n;
    p.add(o);
    return o;
  }
  const doors = new Map<DoorId, T.Group>();
  function door(id: DoorId, p: T.Group, pos: number[]) {
    const g = new T.Group();
    g.name = id;
    g.userData.doorId = id;
    g.position.set(pos[0], pos[1], pos[2]);
    p.add(g);
    doors.set(id, g);
    return g;
  }
  const ise = groups.get("ise")!;
  // Raised central arch; each shell rotates away from the arch around its roof edge.
  for (const x of [-0.258, 0.252])
    box(ise, `arch-upright-${x}`, 0.025, 0.391, 0.1, x, 1.114, 0, white);
  box(ise, "ise-central-arch", 0.535, 0.028, 0.1, -0.003, 1.292, 0, white);
  for (const [id, sign] of [
    ["ise-top", 1],
    ["ise-top-rear", -1],
  ] as const) {
    const top = door(id, ise, [0.015, 1.27, sign * 0.075]);
    box(top, "smoked-top", 0.435, 0.018, 0.465, 0, 0, sign * 0.238, dark);
    box(top, "smoked-end", 0.427, 0.3, 0.018, 0, -0.159, sign * 0.47, dark);
    for (const x of [-0.21, 0.21])
      box(
        top,
        `smoked-side-${x}`,
        0.014,
        0.3,
        0.465,
        x,
        -0.159,
        sign * 0.238,
        dark,
      );
    box(top, "top-grip", 0.21, 0.016, 0.021, 0, -0.297, sign * 0.481, steel);
  }
  const reagents = groups.get("ise-reagents")!;
  const reagentSmoke = new T.MeshPhysicalMaterial({
    color: "#182128",
    transparent: true,
    opacity: 0.72,
    roughness: 0.12,
    metalness: 0.2,
    side: T.DoubleSide,
    depthWrite: false,
  });
  // Side cheeks follow the sloping profile, not a rectangular panel.
  function cheek(
    p: T.Object3D,
    name: string,
    x: number,
    points: number[][],
    material: T.Material,
  ) {
    const shape = new T.Shape();
    points.forEach(([z, y], i) =>
      i === 0 ? shape.moveTo(z, y) : shape.lineTo(z, y),
    );
    shape.closePath();
    const geometry = new T.ExtrudeGeometry(shape, {
      depth: 0.012,
      bevelEnabled: false,
    });
    // Shape x -> world z; extrusion -> world x.
    geometry.rotateY(-Math.PI / 2);
    const o = new T.Mesh(geometry, material);
    o.name = name;
    o.position.x = x;
    p.add(o);
    return o;
  }
  const mid = door("ise-middle", reagents, [0.015, 0.895, 0.565]);
  const roof = box(
    mid,
    "middle-smoked-roof",
    0.445,
    0.012,
    Math.hypot(0.405, 0.135),
    0,
    -0.0675,
    0.2025,
    reagentSmoke,
  );
  roof.rotation.x = Math.atan2(0.135, 0.405);
  box(
    mid,
    "middle-smoked-door",
    0.445,
    0.31,
    0.012,
    0,
    -0.29,
    0.405,
    reagentSmoke,
  );
  for (const x of [-0.2165, 0.2285])
    cheek(
      mid,
      `middle-smoked-cheek-${x}`,
      x,
      [
        [0, 0],
        [0.405, -0.135],
        [0.405, -0.445],
        [0, -0.445],
      ],
      reagentSmoke,
    );
  const bend = cyl(
    mid,
    "middle-rounded-bend",
    0.012,
    0.445,
    0,
    -0.135,
    0.405,
    reagentSmoke,
  );
  bend.rotation.z = Math.PI / 2;
  box(mid, "middle-hinge-strip", 0.3, 0.014, 0.023, 0, 0, 0, steel);
  box(mid, "middle-grip", 0.24, 0.016, 0.022, 0, -0.426, 0.417, steel);
  // Three-bay tray projects forward of the upper module, as on the reference photos.
  box(ise, "middle-shelf", 0.45, 0.019, 0.43, 0.015, 0.43, 0.775, steel);
  box(reagents, "reagent-tray-front", 0.46, 0.035, 0.028, 0.015, 0.427, 0.986);
  for (const x of [-0.213, 0.243])
    cheek(
      reagents,
      `reagent-cabinet-cheek-${x}`,
      x,
      [
        [0.565, 0.89],
        [0.983, 0.595],
        [0.983, 0.42],
        [0.565, 0.42],
      ],
      white,
    );
  for (const [i, x] of [-0.1275, 0.015, 0.1575].entries()) {
    box(
      reagents,
      `reagent-tray-${i}`,
      0.132,
      0.006,
      0.255,
      x,
      0.443,
      0.794,
      steel,
    );
    box(
      reagents,
      `reagent-divider-${i}`,
      0.006,
      0.038,
      0.255,
      x - 0.069,
      0.46,
      0.794,
      steel,
    );
  }
  box(
    reagents,
    "reagent-backplate",
    0.428,
    0.43,
    0.015,
    0.015,
    0.667,
    0.573,
    steel,
  );
  for (let i = 0; i < 15; i++)
    box(
      reagents,
      `reagent-vent-${i}`,
      0.007,
      0.056,
      0.002,
      -0.18 + i * 0.019,
      0.79,
      0.582,
      dark,
    );
  for (const x of [-0.1075, 0.035]) {
    const port = cyl(
      reagents,
      `reagent-tube-port-${x}`,
      0.009,
      0.012,
      x,
      0.82,
      0.587,
      steel,
    );
    port.rotation.x = Math.PI / 2;
  }
  // Right-hand fixed fittings are illustrative, separate from the syringe assessment.
  box(
    reagents,
    "ise-reagent-syringe-mount",
    0.054,
    0.245,
    0.02,
    0.176,
    0.699,
    0.592,
    steel,
  );
  const barrel = cyl(
    reagents,
    "ise-reagent-syringe",
    0.017,
    0.15,
    0.176,
    0.7,
    0.616,
    plastic,
  );
  barrel.material = new T.MeshPhysicalMaterial({
    color: "#d5e4df",
    transparent: true,
    opacity: 0.55,
    roughness: 0.15,
  });
  cyl(
    reagents,
    "ise-reagent-syringe-rod",
    0.004,
    0.2,
    0.176,
    0.68,
    0.616,
    steel,
  );
  cyl(
    reagents,
    "ise-reagent-syringe-valve",
    0.022,
    0.023,
    0.176,
    0.79,
    0.616,
    white,
  );
  const ref = register("ise-reference", ise);
  const bottom = door("ise-bottom", ref, [-0.201, 0.06, 0.578]);
  box(bottom, "reference-door", 0.431, 0.35, 0.022, 0.2155, 0.175, 0);
  box(bottom, "reference-grip", 0.15, 0.012, 0.019, 0.24, 0.326, 0.019, steel);
  box(ise, "reference-shelf", 0.416, 0.018, 0.51, 0.015, 0.101, 0.307, steel);
  const loader = groups.get("loader")!;
  const clean = register("clean-solution", loader);
  for (const x of [-1.049, -0.315])
    box(clean, `cabinet-wall-${x}`, 0.025, 0.706, 1.36, x, 0.43, 0.018);
  box(clean, "cabinet-back", 0.759, 0.706, 0.025, -0.682, 0.43, -0.65);
  box(clean, "cabinet-base", 0.759, 0.04, 1.36, -0.682, 0.097, 0.018, steel);
  box(clean, "cabinet-roof", 0.759, 0.033, 1.36, -0.682, 0.788, 0.018);
  const ld = door("loader-door", clean, [-0.302, 0.105, 0.712]);
  box(ld, "loader-cabinet-door", 0.749, 0.677, 0.024, -0.3745, 0.3385, 0);
  box(ld, "loader-door-grip", 0.12, 0.012, 0.02, -0.61, 0.65, 0.019, steel);
  const tank = new T.Group();
  tank.name = "clean-solution-tank";
  clean.add(tank);
  box(tank, "jerrycan-body", 0.48, 0.425, 0.325, -0.682, 0.348, 0.438, plastic);
  box(tank, "left-shoulder", 0.145, 0.08, 0.32, -0.84, 0.589, 0.438, plastic);
  box(tank, "right-shoulder", 0.145, 0.08, 0.32, -0.524, 0.589, 0.438, plastic);
  box(tank, "handle-bridge", 0.24, 0.035, 0.05, -0.682, 0.626, 0.438, plastic);
  cyl(tank, "fill-cap", 0.039, 0.025, -0.846, 0.641, 0.438, plastic);
  cyl(tank, "suction-cap", 0.045, 0.035, -0.522, 0.646, 0.438, plastic);
  for (const x of [-0.542, -0.509])
    cyl(tank, `cap-port-${x}`, 0.006, 0.027, x, 0.676, 0.438);
  tube(
    tank,
    "supply-hose",
    [
      [-0.542, 0.69, 0.438],
      [-0.48, 0.72, 0.43],
      [-0.42, 0.72, 0.26],
      [-0.42, 0.77, 0.18],
    ],
    plastic,
  );
  tube(
    tank,
    "sensor-cable",
    [
      [-0.509, 0.69, 0.438],
      [-0.53, 0.75, 0.39],
      [-0.38, 0.76, 0.15],
    ],
    dark,
  );
  for (const s of [-1, 1]) {
    const rib = box(
      tank,
      `front-rib-${s}`,
      0.018,
      0.41,
      0.012,
      -0.682,
      0.36,
      0.606,
      plastic,
    );
    rib.rotation.z = s * 0.75;
  }
  cyl(
    tank,
    "front-center",
    0.035,
    0.013,
    -0.682,
    0.36,
    0.616,
    plastic,
  ).rotation.x = Math.PI / 2;
  box(clean, "tank-tray", 0.55, 0.017, 0.39, -0.682, 0.125, 0.44, steel);
  box(clean, "tray-front-stop", 0.26, 0.063, 0.014, -0.682, 0.162, 0.64, steel);
  const track = register("sample-track", root);
  box(track, "track-support", 2.57, 0.092, 0.125, 0, 0.858, -0.721);
  for (const z of [-0.784, -0.671])
    box(track, `white-track-edge-${z}`, 2.58, 0.032, 0.016, 0, 0.921, z);
  for (let i = 0; i < 6; i++)
    box(
      track,
      `smoked-track-cover-${i}`,
      0.426,
      0.014,
      0.094,
      -1.071 + i * 0.429,
      0.93,
      -0.727,
      dark,
    );
  for (const z of [-0.75, -0.704])
    box(track, `transport-guide-${z}`, 2.54, 0.018, 0.008, 0, 0.904, z, steel);
  let desired: DoorState = { ...closedDoors };
  function setState(s: DoorState) {
    desired = s;
  }
  function animate() {
    for (const [id, g] of doors) {
      const axis = id.startsWith("ise-top") || id === "ise-middle" ? "x" : "y";
      const angle =
        id === "ise-top-rear"
          ? Math.PI / 2
          : id === "ise-top"
            ? -Math.PI / 2
            : id === "ise-middle"
              ? -1.92
              : id === "ise-bottom" || id === "syringe-rear"
                ? -1.6
                : 1.6;
      g.rotation[axis] = T.MathUtils.lerp(
        g.rotation[axis],
        desired[id] ? angle : 0,
        0.12,
      );
    }
  }
  return { doors, door, setState, animate };
}
