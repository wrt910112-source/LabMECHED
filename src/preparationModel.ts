import * as T from "three";
import {
  materials,
  materialById,
  rackKinds,
  preparationScenario,
  type Material,
  type MaterialKind,
} from "../shared/materialCatalog";
import {
  preparationProgress,
  type PreparationState,
  type PreparationGate,
} from "../shared/preparation";
export type PreparationView = "bench" | "loading" | "reagent";
export const preparationViews = {
  reagent: {
    eye: [2.2, 2.05, 2.25] as [number, number, number],
    target: [0.77, 0.95, 0.47] as [number, number, number],
  },
  bench: {
    eye: [2.9, 3.1, 6.4] as [number, number, number],
    target: [-0.05, 1, 3.35] as [number, number, number],
  },
  loading: {
    eye: [-2.5, 2.25, 2.9] as [number, number, number],
    target: [-0.65, 0.85, 0.5] as [number, number, number],
  },
};
const colors: Record<MaterialKind, string> = {
  RB: "#1763ba",
  CALI: "#e6c624",
  QC: "#168555",
};
function caption(text: string, width = 0.14, height = 0.09) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f3f1e8";
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = "#142a35";
  ctx.textAlign = "center";
  ctx.font = "bold 42px sans-serif";
  const words = text.match(/.{1,13}/gu) || [text];
  words.slice(0, 3).forEach((line, i) => ctx.fillText(line, 256, 60 + i * 65));
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return new T.Mesh(
    new T.PlaneGeometry(width, height),
    new T.MeshStandardMaterial({
      map: tex,
      roughness: 0.8,
      side: T.DoubleSide,
    }),
  );
}
export function createPreparationModel(sources: Material[] = materials) {
  const catalog = Object.fromEntries(sources.map((m) => [m.id, m]));
  const root = new T.Group();
  root.name = "calibration-qc-workbench";
  root.visible = false;
  const targets = new Map<string, T.Object3D>();
  const metal = new T.MeshStandardMaterial({
    color: "#a4b0b5",
    metalness: 0.7,
    roughness: 0.28,
  });
  const glass = new T.MeshPhysicalMaterial({
    color: "#d9f2f7",
    transparent: true,
    opacity: 0.27,
    roughness: 0.15,
    metalness: 0.05,
    side: T.DoubleSide,
    depthWrite: false,
  });
  const amber = new T.MeshStandardMaterial({
    color: "#543019",
    roughness: 0.3,
    metalness: 0.15,
  });
  const dark = new T.MeshStandardMaterial({ color: "#172c37", roughness: 0.6 });
  function box(
    parent: T.Object3D,
    size: number[],
    position: number[],
    material: T.Material,
  ) {
    const m = new T.Mesh(
      new T.BoxGeometry(...(size as [number, number, number])),
      material,
    );
    m.position.set(...(position as [number, number, number]));
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  box(root, [3.25, 0.075, 1.75], [0, 0.88, 3.45], metal);
  for (const x of [-1.4, 1.4])
    for (const z of [2.75, 4.15])
      box(root, [0.055, 0.85, 0.055], [x, 0.43, z], metal);
  box(root, [2.95, 0.07, 0.72], [0, 0.96, 2.98], glass);
  sources.forEach((m, i) => {
    const group = new T.Group();
    group.position.set(
      -1.28 + (i % 7) * 0.36,
      1.0,
      2.72 + Math.floor(i / 7) * 0.2,
    );
    group.userData.preparationId = `source:${m.id}`;
    const body = new T.Mesh(
      new T.CylinderGeometry(0.052, 0.058, 0.18, 18),
      m.kind === "RB" ? glass : amber,
    );
    body.position.y = 0.09;
    group.add(body);
    const cap = new T.Mesh(
      new T.CylinderGeometry(0.055, 0.055, 0.035, 18),
      new T.MeshStandardMaterial({ color: colors[m.kind], roughness: 0.7 }),
    );
    cap.position.y = 0.194;
    group.add(cap);
    const label = caption(m.name, 0.11, 0.08);
    label.position.set(0, 0.1, 0.057);
    group.add(label);
    root.add(group);
    targets.set(`source:${m.id}`, group);
  });
  const rackModels = {} as Record<MaterialKind, T.Group>;
  const slotLocal = (slot: number) =>
    new T.Vector3((slot - 5.5) * 0.122, 0.055, 0);
  rackKinds.forEach((kind, row) => {
    const rack = new T.Group();
    rack.userData.preparationId = `rack:${kind}`;
    const color = new T.MeshStandardMaterial({
      color: colors[kind],
      roughness: 0.36,
    });
    box(rack, [1.3, 0.065, 0.17], [0, 0, 0], color);
    for (let n = 1; n <= preparationScenario.teachingSlots; n++) {
      const socket = new T.Group();
      socket.position.copy(slotLocal(n));
      socket.userData.preparationId = `slot:${kind}:${n}`;
      const ring = new T.Mesh(new T.TorusGeometry(0.046, 0.009, 6, 20), dark);
      ring.rotation.x = Math.PI / 2;
      socket.add(ring);
      const num = caption(String(n), 0.055, 0.028);
      num.position.set(0, -0.024, 0.09);
      socket.add(num);
      rack.add(socket);
      targets.set(`slot:${kind}:${n}`, socket);
    }
    const label = caption(`${kind} 教學架`, 0.22, 0.055);
    label.position.set(-0.47, 0.015, 0.095);
    rack.add(label);
    root.add(rack);
    rackModels[kind] = rack;
    targets.set(`rack:${kind}`, rack);
  });
  const cups = new Map<
    string,
    {
      group: T.Group;
      liquid: T.Mesh;
      outline: T.LineSegments;
      label: T.Mesh;
      materialId: string | null;
    }
  >();
  for (let i = 0; i < 16; i++) {
    const group = new T.Group();
    group.userData.preparationId = `cup:cup-${i + 1}`;
    const wall = new T.Mesh(
      new T.CylinderGeometry(0.046, 0.032, 0.1, 18, 1, true),
      glass,
    );
    wall.position.y = 0.05;
    group.add(wall);
    const outlineShape = new T.CylinderGeometry(0.049, 0.035, 0.105, 18);
    const outline = new T.LineSegments(
      new T.EdgesGeometry(outlineShape, 15),
      new T.LineBasicMaterial({
        color: "#ffd700",
        transparent: true,
        opacity: 0.9,
      }),
    );
    outlineShape.dispose();
    outline.name = "filled-cup-gold-outline";
    outline.position.y = 0.0525;
    outline.visible = false;
    // A physical contents marker, independent of identity, rack correctness or guidance.
    group.add(outline);
    const rim = new T.Mesh(new T.TorusGeometry(0.046, 0.003, 6, 20), metal);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.1;
    group.add(rim);
    const liquid = new T.Mesh(
      new T.CylinderGeometry(0.036, 0.03, 0.035, 16),
      new T.MeshStandardMaterial({
        color: "#c7bd72",
        transparent: true,
        opacity: 0.8,
      }),
    );
    liquid.position.y = 0.025;
    group.add(liquid);
    const label = caption(`杯 ${i + 1}`, 0.075, 0.035);
    label.position.set(0, 0.048, 0.041);
    group.add(label);
    root.add(group);
    cups.set(`cup-${i + 1}`, {
      group,
      liquid,
      outline,
      label,
      materialId: null,
    });
    targets.set(`cup:cup-${i + 1}`, group);
  }
  const pipette = new T.Group();
  const pbody = new T.Mesh(
    new T.CylinderGeometry(0.018, 0.025, 0.28, 12),
    new T.MeshStandardMaterial({ color: "#efefea" }),
  );
  pipette.add(pbody);
  const tip = new T.Mesh(new T.ConeGeometry(0.012, 0.18, 10), glass);
  tip.rotation.z = Math.PI;
  tip.position.y = -0.23;
  pipette.add(tip);
  pipette.rotation.z = -0.5;
  pipette.position.set(1.28, 1.39, 3.77);
  root.add(pipette);
  const guide = new T.Mesh(
    new T.TorusGeometry(0.079, 0.006, 6, 30),
    new T.MeshBasicMaterial({ color: "#67e4f4" }),
  );
  guide.rotation.x = Math.PI / 2;
  root.add(guide);
  const title = caption("CALI / QC · 教學備料台", 1.1, 0.13);
  title.position.set(0, 0.85, 4.34);
  root.add(title);
  function update(
    state: PreparationState,
    gate: PreparationGate,
    guidance: boolean,
  ) {
    rackKinds.forEach((kind, i) => {
      const r = state.racks[kind];
      rackModels[kind].scale.setScalar(r.location === "bench" ? 1 : 0.2);
      rackModels[kind].position.set(
        ...((r.location === "bench"
          ? [-0.5, 0.94, 3.65 + i * 0.24]
          : r.location === "entry"
            ? [-1.075, 0.934, 0.51]
            : [-1.075, 0.934, -0.19 + i * 0.18]) as [number, number, number]),
      );
    });
    state.cups.forEach((c, i) => {
      const visual = cups.get(c.id)!;
      if (c.rack && c.slot !== null) {
        const rack = rackModels[c.rack];
        visual.group.position
          .copy(rack.position)
          .add(slotLocal(c.slot).multiplyScalar(rack.scale.x));
        visual.group.scale.copy(rack.scale);
      } else {
        visual.group.scale.setScalar(1);
        visual.group.position.set(
          0.4 + (i % 4) * 0.19,
          0.93,
          3.47 + Math.floor(i / 4) * 0.19,
        );
      }
      visual.liquid.visible = !!c.materialId && c.additions > 0;
      visual.outline.visible = visual.liquid.visible;
      if (visual.materialId !== c.materialId) {
        const replacement = caption(
          c.materialId
            ? (catalog[c.materialId] || materialById[c.materialId]).name
            : `杯 ${i + 1}`,
          0.075,
          0.035,
        );
        visual.label.geometry.dispose();
        const mat = visual.label.material as T.MeshStandardMaterial;
        mat.map?.dispose();
        mat.dispose();
        visual.label.geometry = replacement.geometry;
        visual.label.material = replacement.material;
        visual.materialId = c.materialId;
      }
    });
    pipette.rotation.z = state.pipette ? -0.15 : -0.5;
    const progress = preparationProgress(state, gate),
      need = progress.items.find((r) => !r.dispensed);
    guide.visible = guidance && gate.ready && !!need;
    if (need) {
      const p = targets.get(`source:${need.materialId}`)?.position;
      if (p) guide.position.set(p.x, p.y + 0.002, p.z);
      else guide.visible = false;
    }
  }
  function hit(ray: T.Raycaster) {
    const hit = ray.intersectObject(root, true).find((h) => {
      let o: T.Object3D | null = h.object;
      while (o) {
        if (!o.visible) return false;
        o = o.parent;
      }
      return true;
    });
    let o: T.Object3D | null = hit?.object || null;
    while (o) {
      if (o.userData.preparationId) return o.userData.preparationId as string;
      o = o.parent;
    }
    return null;
  }
  return { root, targets, update, hit };
}
