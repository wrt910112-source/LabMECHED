import * as T from "three";
import { isTroubleV2, type TroubleState } from "../shared/troubleshooting";
import { analyzerDeckGeometry } from "./washModel";
export const carouselSlot = (pair: "R1" | "R2") =>
  new T.Vector3(pair === "R1" ? 1.038 : 0.502, 0.832, 0.618);
export function createTroubleshootingModel(instrument: T.Group) {
  const root = new T.Group(),
    targets = new Map<string, T.Object3D>();
  root.name = "uibc-teaching-reagents";
  root.visible = false;
  instrument.add(root);
  const deck = instrument.getObjectByName("analyzer-deck") as T.Mesh;
  const originalDeck = deck.geometry;
  let recessedDeck: T.BufferGeometry | null = null;
  const caps: Record<string, string> = {
    R1: "#bd3337",
    R1a: "#bd3337",
    R2: "#20814b",
    R2a: "#20814b",
  };
  const plastic = new T.MeshStandardMaterial({
    color: "#e6e7dc",
    roughness: 0.42,
  });
  const dark = new T.MeshStandardMaterial({ color: "#56615b", roughness: 0.8 });
  function label(text: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f6f3e8";
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = "#16313a";
    ctx.textAlign = "center";
    ctx.font = "bold 40px sans-serif";
    text.split("|").forEach((line, i) => ctx.fillText(line, 256, 55 + i * 62));
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    return new T.Mesh(
      new T.PlaneGeometry(0.13, 0.085),
      new T.MeshStandardMaterial({ map, side: T.DoubleSide }),
    );
  }
  const bottles = new Map<string, T.Group>();
  for (const id of ["old-R1", "old-R2", "new-R1", "new-R2", "R1a", "R2a"]) {
    const g = new T.Group();
    g.name = `uibc-${id}`;
    g.userData.troubleId = `bottle:${id}`;
    const small = id.endsWith("a"),
      key = id.replace(/^(old|new)-/, "");
    const body = new T.Mesh(
      new T.BoxGeometry(small ? 0.075 : 0.12, small ? 0.14 : 0.21, 0.085),
      plastic,
    );
    body.position.y = small ? 0.07 : 0.105;
    g.add(body);
    const cap = new T.Mesh(
      new T.CylinderGeometry(0.035, 0.035, 0.03, 20),
      new T.MeshStandardMaterial({ color: caps[key] }),
    );
    cap.position.y = small ? 0.155 : 0.225;
    g.add(cap);
    const text = label(
      `UIBC ${key}|${id.startsWith("old") ? "舊瓶" : id.startsWith("new") ? "新瓶" : "加入來源"}|教學示意`,
    );
    text.position.set(0, 0.09, 0.044);
    g.add(text);
    g.scale.setScalar(small ? 0.65 : 0.42);
    root.add(g);
    bottles.set(id, g);
    targets.set(`bottle:${id}`, g);
  }
  const banks = new Map<string, T.Group>();
  for (const pair of ["R1", "R2"] as const) {
    const g = new T.Group();
    g.name = `uibc-carousel-${pair}`;
    g.userData.troubleId = `bank:${pair}`;
    g.position.set(pair === "R1" ? 1.038 : 0.502, 0, 0.47);
    const floor = new T.Mesh(
      new T.CylinderGeometry(0.204, 0.204, 0.008, 64),
      dark,
    );
    floor.position.y = 0.824;
    g.add(floor);
    const wall = new T.Mesh(
      new T.CylinderGeometry(0.208, 0.208, 0.12, 64, 1, true),
      new T.MeshStandardMaterial({
        color: "#dcded1",
        roughness: 0.5,
        side: T.DoubleSide,
      }),
    );
    wall.position.y = 0.885;
    g.add(wall);
    const rim = new T.Mesh(new T.TorusGeometry(0.209, 0.006, 10, 64), plastic);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.945;
    g.add(rim);
    const hub = new T.Mesh(
      new T.CylinderGeometry(0.045, 0.05, 0.105, 32),
      plastic,
    );
    hub.position.y = 0.882;
    g.add(hub);
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI * 2) / 16,
        x = Math.sin(angle) * 0.148,
        z = Math.cos(angle) * 0.148;
      const divider = new T.Mesh(
        new T.BoxGeometry(0.003, 0.09, 0.145),
        plastic,
      );
      divider.position.set(
        Math.sin(angle + Math.PI / 16) * 0.12,
        0.875,
        Math.cos(angle + Math.PI / 16) * 0.12,
      );
      divider.rotation.y = angle + Math.PI / 16;
      g.add(divider);
      if (i === 0) continue;
      const bottle = new T.Group();
      bottle.name = `reference-bottle-${pair}-${i}`;
      bottle.userData.referenceOnly = true;
      const body = new T.Mesh(new T.BoxGeometry(0.035, 0.079, 0.039), plastic);
      body.position.y = 0.0395;
      bottle.add(body);
      const cap = new T.Mesh(
        new T.CylinderGeometry(0.012, 0.012, 0.012, 12),
        new T.MeshStandardMaterial({ color: caps[pair] }),
      );
      cap.position.y = 0.085;
      bottle.add(cap);
      bottle.position.set(x, 0.832, z);
      bottle.rotation.y = angle;
      g.add(bottle);
    }
    const socket = new T.Mesh(
      new T.BoxGeometry(0.058, 0.004, 0.053),
      new T.MeshStandardMaterial({ color: "#557e85" }),
    );
    socket.position.set(0, 0.829, 0.148);
    g.add(socket);
    root.add(g);
    banks.set(pair, g);
    targets.set(`bank:${pair}`, g);
  }
  const destinations = new Map<string, T.Vector3>();
  const motions = new Map<
    string,
    { from: T.Vector3; to: T.Vector3; start: number; duration: number }
  >();
  let initialized = false;
  function move(id: string, to: T.Vector3) {
    const object = bottles.get(id)!;
    if (destinations.get(id)?.distanceToSquared(to) === 0) return;
    destinations.set(id, to.clone());
    if (!initialized || !root.visible) {
      object.position.copy(to);
      motions.delete(id);
      return;
    }
    motions.set(id, {
      from: object.position.clone(),
      to: to.clone(),
      start: performance.now(),
      duration: 1100,
    });
  }
  function update(state?: TroubleState) {
    root.visible = !!state;
    if (state) {
      if (!recessedDeck) recessedDeck = analyzerDeckGeometry(true);
      deck.geometry = recessedDeck;
    } else deck.geometry = originalDeck;
    for (const groupName of ["r1", "r2"]) {
      const group = instrument.getObjectByName(groupName);
      for (const name of [
        "reagent-compartment-base",
        "reagent-compartment-rim",
      ]) {
        const o = group?.getObjectByName(name);
        if (o) o.visible = !state;
      }
      const pair = groupName === "r1" ? "R1" : "R2",
        open = state ? !isTroubleV2(state) || !!state.covers?.[pair] : false;
      for (const name of [
        "reagent-compartment-lid",
        "reagent-compartment-handle",
        "reagent-name",
      ]) {
        const o = group?.getObjectByName(name);
        if (o) o.visible = !state || !open;
      }
      banks.get(pair)!.visible = !!state;
    }
    const main = instrument.getObjectByName("analyzer-outer-cover");
    if (main && state && isTroubleV2(state)) {
      const angle = state.covers?.main ? -Math.PI * 0.48 : 0;
      main.rotation.x = angle;
      main.position.y = state.covers?.main
        ? 1.24 - (1.24 * Math.cos(angle) + 0.75 * Math.sin(angle))
        : 0;
      main.position.z = state.covers?.main
        ? -0.75 - (1.24 * Math.sin(angle) - 0.75 * Math.cos(angle))
        : 0;
    }
    if (!state) {
      motions.clear();
      initialized = false;
      return;
    }
    for (const [i, pair] of (["R1", "R2"] as const).entries()) {
      move(
        `old-${pair}`,
        state.reagent.old[pair]
          ? carouselSlot(pair)
          : new T.Vector3(-1.28 + i * 0.2, 0.93, 3.15),
      );
      const bank = (["R1", "R2"] as const).find(
        (k) => state.reagent.slots[k] === `new-${pair}`,
      );
      move(
        `new-${pair}`,
        bank ? carouselSlot(bank) : new T.Vector3(0.05 + i * 0.24, 0.93, 3.15),
      );
      move(`${pair}a`, new T.Vector3(0.75 + i * 0.24, 0.93, 3.15));
      bottles.get(`${pair}a`)!.visible = !Object.values(state.reagent.mix).some(
        (m) => m.source === pair + "a",
      );
      for (const id of [`old-${pair}`, `new-${pair}`]) {
        const location = (["R1", "R2"] as const).find(
          (k) => state.reagent.slots[k] === id,
        );
        // Closed lids actually hide their seated bottle, rather than displaying it on top.
        bottles.get(id)!.visible =
          motions.has(id) ||
          !location ||
          !isTroubleV2(state) ||
          !!state.covers?.[location];
      }
    }
    initialized = true;
  }
  function animate(now = performance.now()) {
    for (const [id, m] of motions) {
      const t = Math.min(1, Math.max(0, (now - m.start) / m.duration)),
        object = bottles.get(id)!;
      const lift = Math.max(m.from.y, m.to.y) + 0.25;
      if (t < 0.3)
        object.position
          .copy(m.from)
          .setY(T.MathUtils.lerp(m.from.y, lift, t / 0.3));
      else if (t < 0.78) {
        object.position.lerpVectors(m.from, m.to, (t - 0.3) / 0.48);
        object.position.y = lift;
      } else
        object.position
          .copy(m.to)
          .setY(T.MathUtils.lerp(lift, m.to.y, (t - 0.78) / 0.22));
      if (t === 1) {
        object.position.copy(m.to);
        motions.delete(id);
      }
    }
    return motions.size > 0;
  }
  function hit(ray: T.Raycaster) {
    if (!root.visible) return null;
    const collision = ray.intersectObject(root, true).find((h) => {
      let o: T.Object3D | null = h.object;
      while (o) {
        if (!o.visible) return false;
        o = o.parent;
      }
      return true;
    });
    let object: T.Object3D | null = collision?.object || null;
    while (object) {
      if (object.userData.troubleId) return object.userData.troubleId as string;
      object = object.parent;
    }
    return null;
  }
  function dispose() {
    deck.geometry = originalDeck;
    recessedDeck?.dispose();
  }
  return {
    root,
    targets,
    update,
    hit,
    animate,
    dispose,
    motionProgress: (now = performance.now()) => {
      const motion = motions.values().next().value;
      return motion ? Math.min(1, (now - motion.start) / motion.duration) : 1;
    },
    motionRemaining: (now = performance.now()) =>
      Math.max(0, ...[...motions.values()].map(m => m.start + m.duration - now)),
    isAnimating: () => motions.size > 0,
  };
}
