import { createEnclosures } from "./enclosures";
import * as T from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { PartId, Vec3 } from "./data";
import { createIseModel } from "./iseModel";
import { createMixingUnits } from "./mixingModel";
import { analyzerDeckGeometry, createWashBanks } from "./washModel";

// Model units are metres. +Z faces the operator; +X is the operator's right.
export function createInstrument() {
  const root = new T.Group();
  root.name = "au5800";
  const groups = new Map<PartId, T.Group>();
  const covers: T.Object3D[] = [];
  const white = new T.MeshStandardMaterial({
    color: "#dedfd7",
    roughness: 0.36,
    metalness: 0.12,
  });
  const cream = new T.MeshStandardMaterial({
    color: "#f0eee4",
    roughness: 0.4,
    metalness: 0.06,
  });
  const dark = new T.MeshStandardMaterial({
    color: "#222d30",
    roughness: 0.32,
    metalness: 0.3,
  });
  const steel = new T.MeshStandardMaterial({
    color: "#a6b4b7",
    roughness: 0.25,
    metalness: 0.82,
  });
  const black = new T.MeshStandardMaterial({
    color: "#152024",
    roughness: 0.4,
  });
  const orange = new T.MeshStandardMaterial({
    color: "#ed8e31",
    roughness: 0.45,
  });
  const glass = new T.MeshPhysicalMaterial({
    color: "#17292d",
    transparent: true,
    opacity: 0.83,
    roughness: 0.17,
    metalness: 0.35,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const translucent = new T.MeshStandardMaterial({
    color: "#e0e8dc",
    roughness: 0.35,
    transparent: true,
    opacity: 0.88,
  });
  function group(id: PartId, parent: T.Group = root) {
    const g = new T.Group();
    g.name = id;
    g.userData.partId = id;
    parent.add(g);
    groups.set(id, g);
    return g;
  }
  function mesh(
    parent: T.Object3D,
    name: string,
    geo: T.BufferGeometry,
    mat: T.Material,
    pos: Vec3,
  ) {
    const m = new T.Mesh(geo, mat);
    m.name = name;
    m.position.set(...pos);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function box(
    p: T.Object3D,
    n: string,
    size: Vec3,
    pos: Vec3,
    mat: T.Material = white,
    r = 0.012,
  ) {
    return mesh(
      p,
      n,
      new RoundedBoxGeometry(
        ...size,
        2,
        Math.min(r, ...size.map((v) => v / 3)),
      ),
      mat,
      pos,
    );
  }
  function cyl(
    p: T.Object3D,
    n: string,
    r: number,
    h: number,
    pos: Vec3,
    mat: T.Material = white,
  ) {
    return mesh(p, n, new T.CylinderGeometry(r, r, h, 48), mat, pos);
  }
  function line(
    p: T.Object3D,
    n: string,
    points: Vec3[],
    radius = 0.002,
    mat: T.Material = steel,
  ) {
    return mesh(
      p,
      n,
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((v) => new T.Vector3(...v))),
        24,
        radius,
        6,
        false,
      ),
      mat,
      [0, 0, 0],
    );
  }
  function label(
    p: T.Object3D,
    n: string,
    text: string,
    pos: Vec3,
    w = 0.18,
    h = 0.038,
    bg = "#284e47",
    fg = "#ffffff",
    top = false,
  ) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = fg;
    ctx.font = "600 64px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 68, 490);
    const tx = new T.CanvasTexture(c);
    tx.colorSpace = T.SRGBColorSpace;
    const m = mesh(
      p,
      n,
      new T.PlaneGeometry(w, h),
      new T.MeshBasicMaterial({ map: tx, side: T.DoubleSide }),
      pos,
    );
    if (top) m.rotation.x = -Math.PI / 2;
    return m;
  }
  function foot(p: T.Group, x: number, z: number) {
    cyl(p, `foot-${x}-${z}`, 0.025, 0.055, [x, 0.035, z], black);
  }
  function cabinet(p: T.Group, x: number, w: number, d: number) {
    if (p.name === "analyzer" || p.name === "ise") {
      if (p.name !== "analyzer")
        box(p, "cabinet-back", [w, 0.77, 0.035], [x, 0.425, -d / 2 + 0.018]);
      else {
        box(p, "rear-upper-frame", [w, 0.12, 0.035], [x, 0.75, -d / 2 + 0.018]);
        box(p, "rear-lower-frame", [w, 0.08, 0.035], [x, 0.09, -d / 2 + 0.018]);
      }
      for (const side of [-1, 1])
        box(
          p,
          `cabinet-side-${side}`,
          [0.025, 0.77, d],
          [x + side * (w / 2 - 0.013), 0.425, 0],
        );
      box(
        p,
        "cabinet-top",
        [w, 0.03, d],
        [x, p.name === "ise" ? 0.415 : 0.795, 0],
      );
      if (p.name !== "ise")
        box(p, "cabinet-divider", [0.025, 0.69, d], [x, 0.43, 0]);
    } else box(p, "cabinet", [w, 0.77, d], [x, 0.425, 0]);
    box(p, "base", [w - 0.035, 0.07, d - 0.035], [x, 0.075, 0], dark);
    for (const dx of [-w * 0.35, w * 0.35])
      for (const z of [-d * 0.36, d * 0.36]) foot(p, x + dx, z);
  }
  function roundedOutline(width: number, height: number, r: number) {
    const s = new T.Shape(),
      x = -width / 2,
      y = -height / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + width - r, y);
    s.quadraticCurveTo(x + width, y, x + width, y + r);
    s.lineTo(x + width, y + height - r);
    s.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    s.lineTo(x + r, y + height);
    s.quadraticCurveTo(x, y + height, x, y + height - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function lid(p: T.Group, x: number, w: number, d: number, h: number) {
    const g = new T.Group();
    g.name = `${p.name}-outer-cover`;
    p.add(g);
    covers.push(g);
    const z = -0.02;
    box(
      g,
      "top-shell",
      [w, 0.075, d - 0.04],
      [x, h - 0.04, z - 0.035],
      cream,
      0.035,
    );
    box(
      g,
      "left-frame",
      [0.045, 0.265, d - 0.1],
      [x - w / 2 + 0.025, h - 0.16, z - 0.035],
      cream,
    );
    box(
      g,
      "right-frame",
      [0.045, 0.265, d - 0.1],
      [x + w / 2 - 0.025, h - 0.16, z - 0.035],
      cream,
    );
    box(g, "rear-shell", [w, 0.265, 0.035], [x, h - 0.17, z - d / 2], white);
    const outline = roundedOutline(w - 0.008, 0.295, 0.06);
    outline.holes.push(
      new T.Path(roundedOutline(w - 0.12, 0.215, 0.045).getPoints(12)),
    );
    const frame = mesh(
      g,
      "curved-front-bezel",
      new T.ExtrudeGeometry(outline, {
        depth: 0.025,
        bevelEnabled: true,
        bevelSize: 0.008,
        bevelThickness: 0.006,
        bevelSegments: 3,
        steps: 1,
        curveSegments: 16,
      }),
      cream,
      [x, h - 0.155, z + d / 2 - 0.047],
    );
    frame.rotation.x = -0.12;
    const window = mesh(
      g,
      "smoked-window",
      new T.ShapeGeometry(roundedOutline(w - 0.117, 0.217, 0.045), 24),
      glass,
      [x, h - 0.155, z + d / 2 - 0.03],
    );
    window.rotation.x = -0.12;
    box(
      g,
      "window-lower-trim",
      [w - 0.015, 0.026, 0.047],
      [x, h - 0.305, z + d / 2 - 0.045],
      dark,
    );
    box(
      g,
      "lid-handle",
      [w * 0.2, 0.014, 0.027],
      [x, h - 0.284, z + d / 2 - 0.012],
      steel,
    );
    return g;
  }
  function bottle(
    p: T.Group,
    n: string,
    x: number,
    y: number,
    z: number,
    color: string,
    w = 0.065,
    h = 0.15,
  ) {
    const g = new T.Group();
    g.name = n;
    p.add(g);
    box(
      g,
      "bottle-body",
      [w, h, w * 0.8],
      [x, y + h / 2, z],
      translucent,
      0.012,
    );
    cyl(g, "bottle-neck", w * 0.22, 0.018, [x, y + h + 0.007, z], cream);
    cyl(
      g,
      "cap",
      w * 0.25,
      0.014,
      [x, y + h + 0.022, z],
      new T.MeshStandardMaterial({ color }),
    );
    box(
      g,
      "liquid",
      [w * 0.9, h * 0.55, w * 0.7],
      [x, y + h * 0.3, z],
      new T.MeshStandardMaterial({
        color: "#aabdb5",
        transparent: true,
        opacity: 0.5,
      }),
    );
    label(
      g,
      "reagent-label",
      n,
      [x, y + h * 0.55, z + w * 0.41],
      w * 0.88,
      h * 0.25,
      "#eeeeea",
      "#263a37",
    );
    return g;
  }
  function probe(p: T.Group, n: string, x: number, z: number, dir: number) {
    const g = new T.Group();
    g.name = n;
    g.userData.componentType = "probe";
    p.add(g);
    cyl(g, "support", 0.013, 0.23, [x, 1.055, z], steel);
    cyl(g, "collar", 0.022, 0.035, [x, 1.155, z], black);
    box(
      g,
      "arm",
      [0.145, 0.047, 0.049],
      [x + dir * 0.052, 1.19, z],
      cream,
      0.017,
    );
    const tip = x + dir * 0.113;
    cyl(g, "probe-needle", 0.0017, 0.204, [tip, 1.064, z], steel);
    cyl(g, "connector", 0.009, 0.024, [tip, 1.224, z], steel);
    line(
      g,
      "probe-tube",
      [
        [x, 1.21, z],
        [x, 1.244, z - 0.01],
        [tip - 0.035 * dir, 1.247, z],
        [tip, 1.235, z],
      ],
      0.002,
      translucent,
    );
    box(g, "wash-well", [0.038, 0.015, 0.037], [tip, 0.96, z], steel);
    box(g, "wash-hole", [0.02, 0.016, 0.019], [tip, 0.965, z], black);
  }
  function disc(p: T.Group, n: string, x: number, z: number, r: number) {
    cyl(p, n + "-base", r, 0.04, [x, 0.924, z], steel);
    cyl(p, n + "-rim", r - 0.003, 0.015, [x, 0.95, z], orange);
    cyl(p, n + "-lid", r - 0.009, 0.025, [x, 0.965, z], cream);
    box(p, n + "-handle", [0.088, 0.018, 0.022], [x, 0.986, z], white);
  }
  const loader = group("loader");

  box(loader, "deck", [1.09, 0.07, 1.5], [-0.755, 0.846, 0], cream);
  box(loader, "rack-bed", [0.82, 0.012, 0.97], [-0.85, 0.89, 0.08], steel);
  for (let lane = 0; lane < 2; lane++) {
    const x = -1.075 + lane * 0.42;
    box(loader, `lane-${lane}`, [0.3, 0.008, 0.89], [x, 0.902, 0.12], dark);
    for (const dx of [-0.14, 0.14])
      box(
        loader,
        `rail-${lane}-${dx}`,
        [0.014, 0.035, 0.95],
        [x + dx, 0.92, 0.12],
        steel,
      );
    for (let rack = 0; rack < 4; rack++) {
      const z = -0.19 + rack * 0.18;
      box(
        loader,
        `rack-${lane}-${rack}`,
        [0.245, 0.044, 0.066],
        [x, 0.934, z],
        rack === 0 ? orange : white,
      );
      for (let tube = 0; tube < 10; tube++) {
        const tx = x - 0.1 + tube * 0.022;
        cyl(
          loader,
          `tube-${lane}-${rack}-${tube}`,
          0.009,
          0.06,
          [tx, 0.982, z],
          translucent,
        );
        cyl(
          loader,
          `tube-cap-${lane}-${rack}-${tube}`,
          0.01,
          0.012,
          [tx, 1.017, z],
          new T.MeshStandardMaterial({
            color: rack === 0 ? "#953f40" : "#afac91",
          }),
        );
      }
    }
  }
  label(
    loader,
    "smp-mark",
    "SAMPLE LOADER",
    [-0.76, 0.771, 0.754],
    0.31,
    0.027,
    "#d6dad6",
    "#465654",
  );
  const console = group("console", loader);
  box(
    console,
    "monitor-post",
    [0.038, 0.52, 0.045],
    [-0.65, 1.1, -0.46],
    steel,
  );
  box(console, "monitor", [0.46, 0.34, 0.038], [-0.65, 1.428, -0.435], black);
  box(
    console,
    "display",
    [0.423, 0.292, 0.003],
    [-0.65, 1.428, -0.414],
    new T.MeshStandardMaterial({
      color: "#9fafb0",
      emissive: "#a9c1c0",
      emissiveIntensity: 0.28,
    }),
  );
  label(
    console,
    "screen-title",
    "AU5800",
    [-0.65, 1.524, -0.41],
    0.4,
    0.033,
    "#233e45",
  );
  for (let i = 0; i < 5; i++) {
    box(
      console,
      `screen-row-${i}`,
      [0.36, 0.017, 0.002],
      [-0.65, 1.468 - i * 0.034, -0.409],
      new T.MeshBasicMaterial({ color: i % 2 ? "#dae1df" : "#bbc9c7" }),
    );
  }
  box(
    console,
    "keyboard-shelf",
    [0.53, 0.026, 0.23],
    [-0.65, 1.02, -0.17],
    cream,
  );
  box(console, "keyboard", [0.43, 0.017, 0.145], [-0.69, 1.044, -0.17], dark);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 13; c++)
      box(
        console,
        `key-${r}-${c}`,
        [0.024, 0.004, 0.025],
        [-0.87 + c * 0.03, 1.055, -0.216 + r * 0.032],
        steel,
        0.002,
      );
  box(console, "mouse", [0.038, 0.017, 0.055], [-0.408, 1.045, -0.145], dark);
  const ise = group("ise");
  cabinet(ise, 0.015, 0.45, 1.14);

  probe(ise, "ise-sample-probe", 0.055, -0.44, -1);
  label(ise, "ise-label", "ISE", [0.015, 0.403, 0.998], 0.09, 0.023);
  const iseModel = createIseModel(ise, group);
  for (let i = 0; i < 2; i++)
    bottle(
      ise,
      `DET-${i + 1}`,
      -0.065 + i * 0.045,
      0.9,
      -0.39,
      "#e7e3ce",
      0.027,
      0.025,
    );
  const reagents = group("ise-reagents", ise);
  const enclosures = createEnclosures(root, groups, group);
  [
    ["ISE Mid Standard", "#d4b72f"],
    ["ISE Buffer", "#a54451"],
  ].forEach(([n, c], i) => {
    // Separate, handled jerrycans in the projecting reagent tray, ahead of the module.
    const x = -0.1275 + i * 0.1425;
    const jug = new T.Group();
    jug.name = n;
    jug.position.set(x, 0.449, 0.8);
    reagents.add(jug);
    box(
      jug,
      "bottle-body",
      [0.12, 0.25, 0.18],
      [0, 0.125, 0],
      translucent,
      0.015,
    );
    box(jug, "shoulder", [0.112, 0.035, 0.166], [0, 0.258, 0], translucent);
    for (const z of [-0.024, 0.065])
      box(
        jug,
        `handle-support-${z}`,
        [0.019, 0.043, 0.019],
        [0, 0.29, z],
        white,
      );
    box(
      jug,
      "integrated-handle",
      [0.019, 0.019, 0.107],
      [0, 0.316, 0.02],
      white,
    );
    cyl(jug, "neck", 0.021, 0.022, [0.02, 0.286, -0.055], white);
    cyl(jug, "cap-collar", 0.026, 0.019, [0.02, 0.305, -0.055], white);
    cyl(
      jug,
      "cap",
      0.016,
      0.006,
      [0.02, 0.318, -0.055],
      new T.MeshStandardMaterial({ color: c }),
    );
    cyl(jug, "tube-port", 0.006, 0.019, [0.02, 0.329, -0.055], steel);
    label(
      jug,
      "jug-label",
      i === 0 ? "ISE Mid Standard" : "ISE Buffer",
      [0, 0.137, 0.092],
      0.099,
      0.048,
      "#f1f3eb",
      "#34433f",
    );
    box(
      jug,
      "label-colour",
      [0.025, 0.012, 0.001],
      [0.029, 0.104, 0.093],
      new T.MeshStandardMaterial({ color: c }),
      0.0003,
    );
    line(
      reagents,
      `${n}-tube`,
      [
        [x + 0.02, 0.787, 0.745],
        [x + 0.033, 0.826, 0.72],
        [x + 0.06, 0.81, 0.65],
        [x + 0.02, 0.82, 0.59],
      ],
      0.0025,
      translucent,
    );
    label(
      reagents,
      `${n}-tray-label`,
      i === 0 ? "M.STD-1" : "BUFFER-1",
      [x, 0.447, 0.991],
      0.095,
      0.017,
      "#e5e6de",
      "#35423d",
    );
  });
  const reference = groups.get("ise-reference")!;
  bottle(
    reference,
    "ISE Reference",
    -0.068,
    0.12,
    0.36,
    "#285c9e",
    0.12,
    0.235,
  );
  line(
    reference,
    "reference-tube",
    [
      [-0.068, 0.382, 0.36],
      [-0.11, 0.403, 0.23],
      [-0.068, 0.402, 0.07],
    ],
    0.003,
    translucent,
  );
  const anl = group("analyzer");
  cabinet(anl, 0.77, 1.06, 1.58);
  mesh(anl, "analyzer-deck", analyzerDeckGeometry(), cream, [0.77, 0.848, 0]);
  lid(anl, 0.77, 1.06, 1.49, 1.26);
  box(anl, "front-band", [1.04, 0.082, 0.028], [0.77, 0.834, 0.796], steel);
  label(
    anl,
    "brand",
    "BECKMAN COULTER",
    [0.55, 0.842, 0.812],
    0.34,
    0.032,
    "#778885",
  );
  label(anl, "model", "AU5800", [1.135, 0.842, 0.812], 0.21, 0.04, "#778885");
  for (let i = 0; i < 2; i++) {
    const panel =
      i === 0 ? enclosures.door("syringe-front", anl, [0.2475, 0, 0.792]) : anl;
    box(
      panel,
      `front-door-${i}`,
      [0.515, 0.66, 0.015],
      [i === 0 ? 0.2575 : 1.035, 0.445, i === 0 ? 0 : 0.792],
      white,
    );
    box(
      panel,
      `door-grip-${i}`,
      [0.12, 0.009, 0.014],
      [i === 0 ? 0.2575 : 1.035, 0.752, i === 0 ? 0.013 : 0.805],
      steel,
    );
  }
  const rearSyringes = group("rear-syringes", anl);
  const rearDoor = enclosures.door(
    "syringe-rear",
    rearSyringes,
    [1.295, 0, -0.777],
  );
  box(
    rearDoor,
    "rear-syringe-door",
    [0.515, 0.56, 0.022],
    [-0.2575, 0.409, 0],
    white,
  );
  box(
    rearDoor,
    "rear-syringe-grip",
    [0.14, 0.015, 0.018],
    [-0.2575, 0.654, -0.022],
    steel,
  );
  // Viewed from the rear, the two syringes occupy the left bay only.
  // The right panel stays on the cabinet rather than the moving hinge group.
  box(
    anl,
    "rear-fixed-right-door",
    [0.515, 0.56, 0.022],
    [0.505, 0.409, -0.777],
    white,
  );
  box(
    anl,
    "rear-fixed-right-grip",
    [0.14, 0.015, 0.018],
    [0.505, 0.654, -0.799],
    steel,
  );
  box(
    rearSyringes,
    "rear-syringe-group-backplate",
    [0.4, 0.43, 0.025],
    [1.0, 0.41, -0.64],
    steel,
  );
  // Two syringes confirmed by the user; remain one inspection group in the rubric.
  const groupGlass = new T.MeshPhysicalMaterial({
    color: "#d5e7e6",
    transparent: true,
    opacity: 0.4,
    roughness: 0.12,
    depthWrite: false,
  });
  for (const [i, x] of [0.91, 1.09].entries()) {
    const syringe = new T.Group();
    syringe.name = `rear-syringe-${i + 1}`;
    syringe.userData.componentType = "syringe";
    syringe.userData.removable = false;
    rearSyringes.add(syringe);
    cyl(syringe, "glass-barrel", 0.029, 0.22, [x, 0.45, -0.7], groupGlass);
    cyl(syringe, "piston", 0.025, 0.02, [x, 0.36, -0.7], white);
    cyl(syringe, "plunger-rod", 0.006, 0.26, [x, 0.31, -0.7], steel);
    cyl(syringe, "upper-valve", 0.03, 0.04, [x, 0.585, -0.7], steel);
    for (const y of [0.34, 0.56])
      box(syringe, `mount-${y}`, [0.12, 0.022, 0.1], [x, y, -0.7], steel);
  }
  label(
    rearSyringes,
    "rear-group-label",
    "SYRINGE GROUP",
    [1.0, 0.655, -0.756],
    0.3,
    0.035,
  ).rotation.y = Math.PI;
  const syringes = group("syringes", anl);
  box(
    syringes,
    "mounting-backplate",
    [0.48, 0.54, 0.018],
    [0.505, 0.442, 0.643],
    steel,
  );
  const barrel = new T.MeshPhysicalMaterial({
    color: "#d5e7e6",
    transparent: true,
    opacity: 0.3,
    roughness: 0.12,
    depthWrite: false,
  });
  ["R2-2", "R2-1", "R1-1", "R1-2"].forEach((name, i) => {
    const g = new T.Group();
    g.name = `syringe-${name}`;
    g.userData.removable = false;
    g.userData.componentType = "syringe";
    syringes.add(g);
    const x = 0.334 + i * 0.114;
    box(g, "vertical-mount", [0.072, 0.47, 0.018], [x, 0.43, 0.662], steel);
    cyl(g, "glass-barrel", 0.023, 0.215, [x, 0.445, 0.711], barrel);
    cyl(g, "plunger-rod", 0.006, 0.3, [x, 0.363, 0.711], steel);
    cyl(g, "piston", 0.02, 0.021, [x, 0.379, 0.711], white);
    cyl(g, "upper-valve", 0.024, 0.058, [x, 0.59, 0.711], steel);
    cyl(g, "cream-knob", 0.031, 0.032, [x, 0.638, 0.711], cream);
    cyl(g, "bottom-collar", 0.026, 0.025, [x, 0.327, 0.711], steel);
    cyl(g, "lower-knob", 0.021, 0.032, [x, 0.247, 0.711], steel);
    for (const y of [0.306, 0.56])
      box(g, `clamp-${y}`, [0.068, 0.015, 0.067], [x, y, 0.694], steel);
    label(
      g,
      "identification",
      name,
      [x, 0.703, 0.681],
      0.088,
      0.028,
      "#e9eae0",
      "#253934",
    );
    line(
      g,
      "inlet-tube",
      [
        [x - 0.019, 0.59, 0.722],
        [x - 0.047, 0.565, 0.741],
        [x - 0.04, 0.256, 0.735],
      ],
      0.0027,
      translucent,
    );
    line(
      g,
      "outlet-tube",
      [
        [x + 0.018, 0.59, 0.722],
        [x + 0.045, 0.607, 0.745],
        [x + 0.043, 0.67, 0.68],
      ],
      0.0027,
      translucent,
    );
  });
  const r2 = group("r2", anl),
    r1 = group("r1", anl);
  [r2, r1].forEach((g, i) => {
    const x = 0.502 + i * 0.536;
    // Leave clearance ahead of the recessed three-slot wash banks.
    disc(g, "reagent-compartment", x, 0.47, 0.215);
    label(
      g,
      "reagent-name",
      i ? "R1" : "R2",
      [x, 0.982, 0.47],
      0.105,
      0.041,
      i ? "#24567e" : "#eceee6",
      i ? "#ffffff" : "#344842",
      true,
    );
    label(
      g,
      "unit-name",
      "Unit 1",
      [x, 0.983, 0.32],
      0.105,
      0.026,
      "#347766",
      "#ffffff",
      true,
    );
    for (let j = 0; j < 2; j++) {
      probe(g, `reagent-probe-${j}`, x - 0.065 + j * 0.13, -0.055, j ? 1 : -1);
    }
  });
  const reaction = group("reaction", anl);
  disc(reaction, "reaction-cover", 0.77, -0.205, 0.205);
  const sample = group("sample", anl);
  disc(sample, "sample-base", 0.77, -0.55, 0.13);
  probe(sample, "sample-inner", 0.69, -0.545, -1);
  probe(sample, "sample-outer", 0.85, -0.545, 1);
  const washBanks = createWashBanks(groups);
  const mixing = group("mixing", anl);
  createMixingUnits(mixing);
  const wash = group("washing", anl);
  box(
    wash,
    "nozzle-head",
    [0.14, 0.035, 0.075],
    [1.115, 1.05, -0.4],
    new T.MeshStandardMaterial({
      color: "#9f916f",
      metalness: 0.3,
      roughness: 0.45,
    }),
  );
  for (let i = 0; i < 12; i++) {
    const x = 1.057 + (i % 6) * 0.023,
      z = -0.42 + Math.floor(i / 6) * 0.04;
    cyl(wash, `nozzle-${i}`, 0.002, 0.12, [x, 1.006, z], steel);
    line(
      wash,
      `tube-${i}`,
      [
        [x, 1.064, z],
        [x, 1.15, z - 0.012],
        [x + 0.065, 1.17, z - 0.08],
        [1.251, 1.11, z - 0.13],
      ],
      0.002,
      translucent,
    );
  }
  // Every descendant has a stable path and a selectable component owner.
  root.traverse((o) => {
    o.userData.stableId = o.parent
      ? `${o.parent.userData.stableId ?? "au5800"}/${o.name}`
      : "au5800";
  });
  return { root, groups, covers, washBanks, iseModel, enclosures };
}
