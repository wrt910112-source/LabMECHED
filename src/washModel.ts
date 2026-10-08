import * as T from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  washBanks,
  washSlots,
  slotById,
  type BottleStates,
} from "./detergents";

export function rectangle(w: number, h: number, r: number): T.Shape {
  const s = new T.Shape(),
    x = -w / 2,
    y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// A deck with real cut-outs: empty slots are recesses, not black marks on top.
export function analyzerDeckGeometry() {
  const shape = rectangle(1.06, 1.58, 0.012);
  for (const bank of washBanks) {
    if (bank.module === "ise") continue;
    const points = rectangle(0.021 + bank.labels.length * 0.033, 0.185, 0.018)
      .getPoints(16)
      .map((p) => {
        const x = p.x,
          z = -p.y,
          c = Math.cos(bank.rotation),
          s = Math.sin(bank.rotation);
        return new T.Vector2(
          bank.position[0] - 0.77 + c * x + s * z,
          -(bank.position[2] - s * x + c * z),
        );
      });
    shape.holes.push(new T.Path(points));
  }
  const geo = new T.ExtrudeGeometry(shape, {
    depth: 0.07,
    bevelEnabled: false,
    curveSegments: 16,
    steps: 1,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}
export interface BottleVisual {
  group: T.Group;
  liquid: T.Mesh;
  body: T.Mesh;
  displayedLevel: number;
  stateKey: string;
  start: number;
  oldLevel: number;
  kind: "refill" | "replace" | "remove";
}
export function createWashBanks(parents: Map<string, T.Group>) {
  const slots = new Map<string, T.Group>(),
    bottles = new Map<string, BottleVisual>();
  const cream = new T.MeshStandardMaterial({
    color: "#e1e1d7",
    roughness: 0.4,
    metalness: 0.12,
  });
  const wall = new T.MeshStandardMaterial({
    color: "#aab1a7",
    roughness: 0.48,
    metalness: 0.48,
  });
  const deep = new T.MeshStandardMaterial({
    color: "#303c38",
    roughness: 0.85,
  });
  const plastic = new T.MeshStandardMaterial({
    color: "#e3eee7",
    roughness: 0.36,
    transparent: true,
    opacity: 0.67,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const orange = new T.MeshStandardMaterial({
    color: "#ee862c",
    roughness: 0.42,
  });
  function add(
    p: T.Object3D,
    n: string,
    g: T.BufferGeometry,
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) {
    const mesh = new T.Mesh(g, m);
    mesh.name = n;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    p.add(mesh);
    return mesh;
  }
  function box(
    p: T.Object3D,
    n: string,
    w: number,
    h: number,
    d: number,
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) {
    return add(
      p,
      n,
      new RoundedBoxGeometry(w, h, d, 2, Math.min(0.003, w / 4, h / 4, d / 4)),
      m,
      x,
      y,
      z,
    );
  }
  function text(
    p: T.Group,
    n: string,
    lines: string[],
    w: number,
    h: number,
    y: number,
    z: number,
  ) {
    const c = document.createElement("canvas");
    c.width = 768;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#f5f5e9";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#30403b";
    ctx.font = "600 56px Arial";
    ctx.textBaseline = "middle";
    lines.forEach((line, i) => ctx.fillText(line, 22, 45 + i * 80, 720));
    const tx = new T.CanvasTexture(c);
    tx.colorSpace = T.SRGBColorSpace;
    const label = add(
      p,
      n,
      new T.PlaneGeometry(w, h),
      new T.MeshBasicMaterial({ map: tx }),
      0,
      y,
      z,
    );
    label.rotation.x = -Math.PI / 2;
  }
  for (const bank of washBanks) {
    const holder = new T.Group();
    holder.name = `wash-bank-${bank.id}`;
    holder.position.set(...bank.position);
    holder.rotation.y = bank.rotation;
    parents.get(bank.module)!.add(holder);
    const lip = rectangle(0.021 + bank.labels.length * 0.033, 0.185, 0.018);
    for (let i = 0; i < bank.labels.length; i++) {
      const points = rectangle(0.027, 0.154, 0.01)
        .getPoints(16)
        .map(
          (p) =>
            new T.Vector2(
              p.x + (i - (bank.labels.length - 1) / 2) * 0.033,
              p.y,
            ),
        );
      lip.holes.push(new T.Path(points));
    }
    const rimGeo = new T.ExtrudeGeometry(lip, {
      depth: 0.006,
      bevelEnabled: true,
      bevelSize: 0.001,
      bevelThickness: 0.001,
      bevelSegments: 2,
      steps: 1,
    });
    rimGeo.rotateX(-Math.PI / 2);
    add(holder, "three-opening-rim", rimGeo, cream);
    // Narrow wells and dividers form three separate long pockets.
    for (let i = 0; i < bank.labels.length; i++) {
      const slot = washSlots.find(
        (s) => s.bankId === bank.id && s.index === i,
      )!;
      const pocket = new T.Group();
      pocket.name = slot.id;
      pocket.userData.slotId = slot.id;
      pocket.position.x = (i - (bank.labels.length - 1) / 2) * 0.033;
      holder.add(pocket);
      slots.set(slot.id, pocket);
      box(pocket, "well-bottom", 0.027, 0.003, 0.155, deep, 0, -0.095, 0);
      box(pocket, "left-wall", 0.003, 0.096, 0.153, wall, -0.015, -0.047, 0);
      box(pocket, "right-wall", 0.003, 0.096, 0.153, wall, 0.015, -0.047, 0);
      box(pocket, "back-wall", 0.026, 0.096, 0.003, wall, 0, -0.047, -0.076);
      box(pocket, "front-wall", 0.026, 0.096, 0.003, wall, 0, -0.047, 0.076);
      // Invisible opening target makes an empty recess easy to click; it never
      // contributes depth or blocks light. Installed bottle geometry sits above it.
      const hit = add(
        pocket,
        "slot-hit-area",
        new T.PlaneGeometry(0.027, 0.152),
        new T.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
        0,
        0.008,
        0,
      );
      hit.rotation.x = -Math.PI / 2;
      hit.castShadow = false;
      hit.receiveShadow = false;
      const bottle = new T.Group();
      bottle.name = "flat-bottle";
      pocket.add(bottle);
      const body = box(
        bottle,
        "bottle-body",
        0.022,
        0.093,
        0.129,
        plastic.clone(),
        0,
        -0.046,
        0,
      );
      box(bottle, "base-foot", 0.018, 0.005, 0.019, cream, 0, -0.094, 0.042);
      // Hollow neck, open mouth, and three external thread ridges.
      add(
        bottle,
        "neck",
        new T.CylinderGeometry(0.0108, 0.011, 0.023, 32, 1, true),
        plastic.clone(),
        0,
        0.011,
        -0.043,
      );
      const mouth = add(
        bottle,
        "mouth-rim",
        new T.RingGeometry(0.0084, 0.0109, 32),
        cream,
        0,
        0.023,
        -0.043,
      );
      mouth.rotation.x = -Math.PI / 2;
      add(
        bottle,
        "neck-interior",
        new T.CylinderGeometry(0.0084, 0.0084, 0.022, 32, 1, true),
        new T.MeshStandardMaterial({ color: "#b1c2b8", side: T.BackSide }),
        0,
        0.011,
        -0.043,
      );
      for (let t = 0; t < 3; t++) {
        const thread = add(
          bottle,
          `thread-${t}`,
          new T.TorusGeometry(0.0108, 0.0009, 6, 32),
          cream,
          0,
          0.007 + t * 0.006,
          -0.043,
        );
        thread.rotation.x = Math.PI / 2;
      }
      const tab = new T.Shape();
      tab.moveTo(-0.013, 0);
      tab.lineTo(-0.007, 0.019);
      tab.lineTo(0.006, 0.019);
      tab.lineTo(0.016, 0);
      tab.closePath();
      const tabGeo = new T.ExtrudeGeometry(tab, {
        depth: 0.011,
        bevelEnabled: true,
        bevelSize: 0.001,
        bevelThickness: 0.001,
        bevelSegments: 2,
        steps: 1,
      });
      tabGeo.rotateY(Math.PI / 2);
      add(bottle, "raised-grip-tab", tabGeo, plastic, -0.0055, 0, 0.039);
      const liquid = box(
        bottle,
        "liquid",
        0.016,
        0.083,
        0.117,
        new T.MeshStandardMaterial({
          color: "#85aaa0",
          transparent: true,
          opacity: 0.64,
          depthWrite: false,
        }),
        0,
        -0.05,
        0,
      );
      bottles.set(slot.id, {
        group: bottle,
        body,
        liquid,
        displayedLevel: 0.65,
        stateKey: "",
        start: 0,
        oldLevel: 0.65,
        kind: "replace",
      });
      text(pocket, "slot-label", [slot.label], 0.031, 0.017, 0.009, 0.084);
    }
    // Photo-style white label plate and orange alignment mark by the pocket.
    box(
      holder,
      "orange-alignment",
      0.042,
      0.004,
      0.012,
      orange,
      0,
      0.012,
      0.101,
    );
    text(holder, "bank-label", bank.labels, 0.116, 0.049, 0.009, -0.119);
  }
  const colors = {
    cln1: "#73a6a0",
    diluent: "#98b8cb",
    w2: "#c6a766",
    det1: "#73a6a0",
    det2: "#98b8cb",
  };
  function setBottles(states: BottleStates, instant = false) {
    for (const [id, v] of bottles) {
      const state = states[id];
      if (!state) continue;
      const key = `${state.fluid}/${state.level}/${state.revision}`;
      if (key === v.stateKey) continue;
      v.oldLevel = v.displayedLevel;
      v.kind = !state.fluid
        ? "remove"
        : v.stateKey.split("/")[2] === String(state.revision)
          ? "refill"
          : "replace";
      v.start = instant || !v.stateKey ? 0 : performance.now();
      v.stateKey = key;
      const mat = v.liquid.material as T.MeshStandardMaterial;
      mat.color.set(state.fluid ? colors[state.fluid] : "#98b8cb");
      if (!v.start) {
        v.group.visible = !!state.fluid;
        v.displayedLevel = state.level;
        v.liquid.scale.y = Math.max(0.001, state.level);
        v.liquid.position.y = -0.09 + 0.0415 * state.level;
      }
    }
  }
  function animate(states: BottleStates, now: number) {
    for (const [id, v] of bottles) {
      if (!v.start) continue;
      const state = states[id],
        t = Math.min((now - v.start) / 1100, 1);
      v.group.visible = !!state.fluid || t < 0.8;
      v.group.position.y = Math.sin(t * Math.PI) * 0.14;
      const fill = T.MathUtils.smoothstep(t, 0.3, 0.78);
      v.displayedLevel = T.MathUtils.lerp(v.oldLevel, state.level, fill);
      v.liquid.scale.y = Math.max(0.001, v.displayedLevel);
      v.liquid.position.y = -0.09 + 0.0415 * v.displayedLevel;
      // A replacement lifts out, swaps while out of its pocket, and returns.
      if (v.kind === "replace" && t > 0.43 && t < 0.52) v.group.visible = false;
      if (t === 1) {
        v.start = 0;
        v.group.position.y = 0;
        v.group.visible = !!state.fluid;
      }
    }
  }
  return { slots, bottles, setBottles, animate };
}
