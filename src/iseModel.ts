import { iseFrontInset, iseDiagZ } from "./iseLayout";
import * as T from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { PartId } from "./data";
import { rectangle } from "./washModel";
export const iseRemovable = [
  "ise-mixing-cup",
  "ise-t-tube",
  "ise-motor",
  "ise-plug-a",
  "ise-plug-b",
] as const;
export type IseComponent = (typeof iseRemovable)[number];
export interface IseState {
  open: boolean;
  removed: IseComponent[];
}
export function iseTransitionAllowed(previous: IseState, next: IseState) {
  const wasOut = (id: IseComponent) => previous.removed.includes(id);
  const isOut = (id: IseComponent) => next.removed.includes(id);
  if (
    !wasOut("ise-motor") &&
    isOut("ise-motor") &&
    !["ise-plug-a", "ise-plug-b"].every((id) => wasOut(id as IseComponent))
  )
    return false;
  if (
    wasOut("ise-motor") &&
    ["ise-plug-a", "ise-plug-b"].some(
      (id) => wasOut(id as IseComponent) && !isOut(id as IseComponent),
    )
  )
    return false;
  if (
    isOut("ise-motor") &&
    !["ise-plug-a", "ise-plug-b"].every((id) => isOut(id as IseComponent))
  )
    return false;
  return true;
}
export const iseCups = [
  { name: "S-H", contents: "SEL-Na / CRS-H" },
  { name: "S-L", contents: "SEL-K / CRS-M" },
  { name: "U-H", contents: "CRS-L" },
  { name: "U-L", contents: "CLEAN" },
];
// Metres; dimensions estimated from the supplied open-compartment photographs.
export function createIseModel(
  parent: T.Group,
  register: (id: PartId, parent: T.Group) => T.Group,
) {
  const white = new T.MeshStandardMaterial({
    color: "#e5e5dc",
    roughness: 0.4,
  });
  const metal = new T.MeshStandardMaterial({
    color: "#aebabc",
    metalness: 0.75,
    roughness: 0.28,
  });
  const black = new T.MeshStandardMaterial({
    color: "#202527",
    roughness: 0.4,
  });
  const clear = new T.MeshPhysicalMaterial({
    color: "#d8eceb",
    transparent: true,
    opacity: 0.38,
    roughness: 0.13,
    side: T.DoubleSide,
    depthWrite: false,
  });
  const rubber = new T.MeshStandardMaterial({
    color: "#bdcfc7",
    transparent: true,
    opacity: 0.85,
    roughness: 0.48,
  });
  const orange = new T.MeshStandardMaterial({ color: "#ed8e31" });
  function mesh(
    p: T.Object3D,
    n: string,
    geo: T.BufferGeometry,
    mat: T.Material,
    pos: number[],
  ) {
    const m = new T.Mesh(geo, mat);
    m.name = n;
    m.position.set(pos[0], pos[1], pos[2]);
    m.castShadow = true;
    m.receiveShadow = true;
    p.add(m);
    return m;
  }
  function box(
    p: T.Object3D,
    n: string,
    size: number[],
    pos: number[],
    mat: T.Material = white,
  ) {
    return mesh(
      p,
      n,
      new RoundedBoxGeometry(size[0], size[1], size[2], 2, 0.002),
      mat,
      pos,
    );
  }
  function cyl(
    p: T.Object3D,
    n: string,
    r: number,
    h: number,
    pos: number[],
    mat: T.Material = metal,
    open = false,
  ) {
    return mesh(p, n, new T.CylinderGeometry(r, r, h, 32, 1, open), mat, pos);
  }
  function tube(
    p: T.Object3D,
    n: string,
    points: number[][],
    r: number,
    mat: T.Material = rubber,
  ) {
    return mesh(
      p,
      n,
      new T.TubeGeometry(
        new T.CatmullRomCurve3(
          points.map((v) => new T.Vector3(v[0], v[1], v[2])),
        ),
        32,
        r,
        8,
        false,
      ),
      mat,
      [0, 0, 0],
    );
  }
  function label(
    p: T.Object3D,
    n: string,
    value: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
  ) {
    const c = document.createElement("canvas");
    c.width = 768;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#e9ebe4";
    ctx.fillRect(0, 0, 768, 128);
    ctx.fillStyle = "#293e3b";
    ctx.font = "bold 52px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(value, 384, 64, 750);
    const tx = new T.CanvasTexture(c);
    tx.colorSpace = T.SRGBColorSpace;
    const m = mesh(
      p,
      n,
      new T.PlaneGeometry(w, h),
      new T.MeshBasicMaterial({ map: tx }),
      [x, y, z],
    );
    m.rotation.x = -Math.PI / 2;
  }
  box(
    parent,
    "ise-cavity-floor",
    [0.415, 0.014, 0.76 - iseFrontInset],
    [0.015, 0.69, 0.065 - iseFrontInset / 2],
    metal,
  );
  // Solid module boundary: opening the metal lid never opens the reagent bay below.
  box(
    parent,
    "ise-module-front-bulkhead",
    [0.3, 0.2, 0.016],
    [-0.04, 0.794, 0.454 - iseFrontInset],
    metal,
  );
  box(
    parent,
    "ise-left-wall",
    [0.013, 0.212, 0.78 - iseFrontInset],
    [-0.192, 0.795, 0.065 - iseFrontInset / 2],
  );
  box(
    parent,
    "ise-right-deck",
    [0.125, 0.027, 0.78 - iseFrontInset],
    [0.174, 0.895, 0.065 - iseFrontInset / 2],
  );
  const rearShape = rectangle(0.43, 0.27, 0.005);
  rearShape.holes.push(
    new T.Path(
      rectangle(0.185, 0.087, 0.012)
        .getPoints(16)
        .map((p) => new T.Vector2(p.x - 0.12, p.y - 0.015)),
    ),
  );
  const rearGeometry = new T.ExtrudeGeometry(rearShape, {
    depth: 0.032,
    bevelEnabled: false,
  });
  rearGeometry.rotateX(-Math.PI / 2);
  const rearDeck = new T.Mesh(
    rearGeometry,
    new T.MeshStandardMaterial({ color: "#e4e5dc", roughness: 0.4 }),
  );
  rearDeck.name = "ise-rear-deck";
  rearDeck.position.set(0.015, 0.879, -0.445);
  parent.add(rearDeck);
  box(
    parent,
    "ise-front-rim",
    [0.43, 0.035, 0.095],
    [0.015, 0.895, 0.507 - iseFrontInset],
  );
  box(
    parent,
    "ise-inner-back-wall",
    [0.305, 0.2, 0.012],
    [-0.041, 0.79, -0.317],
  );
  box(
    parent,
    "diag-border",
    [0.039, 0.005, 0.038],
    [0.16, 0.916, iseDiagZ],
    black,
  );
  box(
    parent,
    "diag-green",
    [0.028, 0.007, 0.026],
    [0.16, 0.92, iseDiagZ],
    new T.MeshStandardMaterial({ color: "#219449" }),
  );
  label(
    parent,
    "diag-label",
    "DIAG",
    0.16,
    0.919,
    0.545 - iseFrontInset,
    0.06,
    0.013,
  );
  // Actual hinged panel, separate from the dark outer safety cover.
  const lid = new T.Group();
  lid.name = "ise-maintenance-cover";
  lid.position.set(-0.168, 0.913, 0.06 - iseFrontInset / 2);
  parent.add(lid);
  box(lid, "cover-panel", [0.277, 0.014, 0.78 - iseFrontInset], [0.1385, 0, 0]);
  box(
    lid,
    "cover-underside",
    [0.26, 0.003, 0.753 - iseFrontInset],
    [0.1385, -0.008, 0],
    metal,
  );
  box(lid, "cover-handle", [0.023, 0.01, 0.14], [0.215, 0.005, 0.075]);
  for (const z of [-0.22, 0.22])
    cyl(lid, `hinge-${z}`, 0.009, 0.031, [0, 0, z], metal).rotation.x =
      Math.PI / 2;
  for (let i = 0; i < 3; i++)
    box(
      parent,
      `orange-path-${i}`,
      [0.042, 0.004, 0.012],
      [-0.07 + i * 0.043, 0.915, -0.335 - i * 0.035],
      orange,
    );
  // Four transparent cups, left-to-right on the fixed right-hand deck.
  const cups = register("ise-cups", parent);
  box(cups, "cup-tray", [0.117, 0.007, 0.125], [0.171, 0.913, -0.183], metal);
  iseCups.forEach((cup, i) => {
    const x = 0.128 + i * 0.029,
      z = -0.181 - i * 0.007;
    const g = new T.Group();
    g.name = `cup-${cup.name}`;
    g.userData.cupName = cup.name;
    g.userData.contents = cup.contents;
    cups.add(g);
    cyl(g, "recess", 0.011, 0.004, [x, 0.918, z], black);
    cyl(g, "open-cup", 0.011, 0.024, [x, 0.929, z], clear, true);
    const rim = mesh(
      g,
      "cup-lip",
      new T.TorusGeometry(0.011, 0.0014, 8, 32),
      metal,
      [x, 0.942, z],
    );
    rim.rotation.x = Math.PI / 2;
    label(g, "cup-name", cup.name, x, 0.919, z + 0.022, 0.026, 0.012);
  });
  // Visible electrode block and pump are context, not invented removable actions.
  const electrodes = new T.Group();
  electrodes.name = "ise-electrode-block";
  parent.add(electrodes);
  ["Cl", "Na", "K"].forEach((n, i) => {
    const z = -0.125 + i * 0.072;
    box(
      electrodes,
      `electrode-${n}`,
      [0.067, 0.043, 0.066],
      [-0.13, 0.761, z],
      white,
    );
    label(electrodes, `electrode-label-${n}`, n, -0.13, 0.784, z, 0.034, 0.022);
    tube(
      electrodes,
      `lead-${n}`,
      [
        [-0.092, 0.756, z],
        [-0.061, 0.752, z + 0.012],
        [-0.041, 0.704, 0.163],
      ],
      0.0018,
      new T.MeshStandardMaterial({
        color: ["#488db5", "#e0c048", "#bc4e46"][i],
      }),
    );
  });
  cyl(parent, "cell-1-pump", 0.044, 0.05, [-0.115, 0.723, 0.135]);
  label(parent, "cell-1-label", "CELL 1", -0.115, 0.702, 0.178, 0.09, 0.02);
  tube(
    parent,
    "pump-loop",
    [
      [-0.148, 0.739, 0.13],
      [-0.164, 0.765, 0.09],
      [-0.084, 0.768, 0.09],
      [-0.077, 0.739, 0.13],
    ],
    0.004,
  );
  box(
    parent,
    "mixing-and-motor-base",
    [0.197, 0.016, 0.129],
    [-0.022, 0.708, -0.225],
    metal,
  );
  cyl(parent, "mixing-cup-support", 0.023, 0.064, [-0.071, 0.748, -0.235]);
  box(
    parent,
    "motor-mount",
    [0.052, 0.077, 0.049],
    [0.019, 0.754, -0.235],
    metal,
  );
  for (const x of [0.002, 0.036])
    cyl(parent, `motor-locator-${x}`, 0.0025, 0.042, [x, 0.81, -0.235]);
  const movable = new Map<IseComponent, T.Group>();
  function part(id: IseComponent) {
    const g = register(id, parent);
    g.userData.removable = true;
    movable.set(id, g);
    return g;
  }
  const cup = part("ise-mixing-cup");
  cyl(cup, "mixing-cup-wall", 0.027, 0.035, [-0.071, 0.8, -0.235], clear, true);
  cyl(cup, "mixing-cup-bottom", 0.025, 0.004, [-0.071, 0.784, -0.235], clear);
  const cupRim = mesh(
    cup,
    "mixing-cup-rim",
    new T.TorusGeometry(0.027, 0.004, 8, 40),
    metal,
    [-0.071, 0.818, -0.235],
  );
  cupRim.rotation.x = Math.PI / 2;
  cyl(cup, "cup-inlet", 0.004, 0.018, [-0.079, 0.827, -0.25], clear);
  const t = part("ise-t-tube");
  tube(
    t,
    "t-crossbar",
    [
      [-0.151, 0.789, -0.175],
      [-0.113, 0.796, -0.186],
      [-0.071, 0.792, -0.213],
    ],
    0.0038,
  );
  tube(
    t,
    "t-stem",
    [
      [-0.113, 0.796, -0.186],
      [-0.079, 0.784, -0.087],
      [-0.058, 0.751, 0.062],
      [-0.073, 0.731, 0.15],
    ],
    0.0038,
  );
  cyl(t, "t-junction", 0.006, 0.015, [-0.113, 0.795, -0.186], rubber);
  const motor = part("ise-motor");
  cyl(motor, "black-motor-body", 0.022, 0.081, [0.019, 0.827, -0.235], black);
  box(
    motor,
    "motor-upper-bridge",
    [0.123, 0.025, 0.05],
    [-0.026, 0.87, -0.235],
    black,
  );
  cyl(motor, "motor-knob", 0.014, 0.021, [0.019, 0.893, -0.235], black);
  cyl(motor, "motor-fastener", 0.006, 0.022, [0.019, 0.786, -0.235]);
  cyl(motor, "mixing-shaft", 0.0018, 0.074, [-0.071, 0.833, -0.235]);
  box(
    motor,
    "mixing-paddle",
    [0.01, 0.016, 0.002],
    [-0.071, 0.802, -0.235],
    metal,
  );
  for (const [id, x] of [
    ["ise-plug-a", -0.162],
    ["ise-plug-b", 0.083],
  ] as const) {
    cyl(
      parent,
      `${id}-socket`,
      0.011,
      0.009,
      [x, 0.85, -0.297],
      metal,
    ).rotation.x = Math.PI / 2;
    const plug = part(id);
    box(plug, "elbow-plug", [0.026, 0.018, 0.017], [x, 0.851, -0.285], black);
    box(plug, "strain-relief", [0.012, 0.027, 0.014], [x, 0.869, -0.28], black);
    tube(
      plug,
      "attached-cable",
      [
        [x, 0.88, -0.28],
        [x * 0.7, 0.891, -0.278],
        [-0.03 + (x > 0 ? 0.04 : -0.04), 0.878, -0.235],
      ],
      0.0025,
      black,
    );
  }
  let desired: IseState = { open: false, removed: [] };
  function setState(state: IseState) {
    if (iseTransitionAllowed(desired, state)) desired = state;
  }
  function animate() {
    lid.rotation.z = T.MathUtils.lerp(
      lid.rotation.z,
      desired.open ? Math.PI / 2 : 0,
      0.12,
    );
    for (const [id, g] of movable) {
      const removed = desired.removed.includes(id);
      const side = id === "ise-plug-a" ? -0.12 : id === "ise-plug-b" ? 0.12 : 0;
      g.position.y = T.MathUtils.lerp(g.position.y, removed ? 0.25 : 0, 0.12);
      g.position.x = T.MathUtils.lerp(g.position.x, removed ? side : 0, 0.12);
      g.userData.installed = !removed;
    }
  }
  return { lid, movable, setState, animate };
}
