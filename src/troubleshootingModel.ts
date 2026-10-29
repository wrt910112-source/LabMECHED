import * as T from "three";
import type { TroubleState } from "../shared/troubleshooting";
export function createTroubleshootingModel(instrument: T.Group) {
  const root = new T.Group(),
    targets = new Map<string, T.Object3D>();
  root.name = "uibc-teaching-reagents";
  root.visible = false;
  instrument.add(root);
  const caps: Record<string, string> = {
    R1: "#bd3337",
    R1a: "#bd3337",
    R2: "#20814b",
    R2a: "#20814b",
  };
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
  for (const [i, id] of [
    "old-R1",
    "old-R2",
    "new-R1",
    "new-R2",
    "R1a",
    "R2a",
  ].entries()) {
    const g = new T.Group();
    g.userData.troubleId = `bottle:${id}`;
    const small = id.endsWith("a");
    const body = new T.Mesh(
      new T.BoxGeometry(small ? 0.075 : 0.12, small ? 0.14 : 0.21, 0.085),
      new T.MeshStandardMaterial({ color: "#e2e7dc", roughness: 0.38 }),
    );
    body.position.y = small ? 0.07 : 0.105;
    g.add(body);
    const key = id.replace(/^(old|new)-/, "");
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
    root.add(g);
    bottles.set(id, g);
    targets.set(`bottle:${id}`, g);
  }
  for (const pair of ["R1", "R2"]) {
    const g = new T.Group();
    g.userData.troubleId = `bank:${pair}`;
    const socket = new T.Mesh(
      new T.BoxGeometry(0.17, 0.017, 0.14),
      new T.MeshStandardMaterial({ color: "#4a6269", roughness: 0.5 }),
    );
    g.add(socket);
    g.position.set(pair === "R1" ? 1.038 : 0.502, 0.96, 0.47);
    root.add(g);
    targets.set(`bank:${pair}`, g);
  }
  function update(state?: TroubleState) {
    root.visible = !!state;
    for (const groupName of ["r1", "r2"])
      for (const name of [
        "reagent-compartment-lid",
        "reagent-compartment-handle",
      ]) {
        const object = instrument
          .getObjectByName(groupName)
          ?.getObjectByName(name);
        if (object) object.visible = !state;
      }
    if (!state) return;
    ["R1", "R2"].forEach((pair, i) => {
      const bank = pair as "R1" | "R2",
        position = new T.Vector3(bank === "R1" ? 1.038 : 0.502, 0.97, 0.47);
      bottles
        .get(`old-${pair}`)!
        .position.copy(
          state.reagent.old[bank]
            ? position
            : new T.Vector3(-1.28 + i * 0.2, 0.93, 3.15),
        );
      const installed = (["R1", "R2"] as const).find(
        (p) => state.reagent.slots[p] === `new-${pair}`,
      );
      bottles
        .get(`new-${pair}`)!
        .position.copy(
          installed
            ? new T.Vector3(installed === "R1" ? 1.038 : 0.502, 0.97, 0.47)
            : new T.Vector3(0.05 + i * 0.24, 0.93, 3.15),
        );
      bottles.get(`${pair}a`)!.position.set(0.75 + i * 0.24, 0.93, 3.15);
      bottles.get(`${pair}a`)!.visible = !Object.values(state.reagent.mix).some(
        (m) => m.source === pair + "a",
      );
    });
  }
  function hit(ray: T.Raycaster) {
    if (!root.visible) return null;
    const collision = ray
      .intersectObject(root, true)
      .find((h) => h.object.visible && h.object.parent?.visible);
    let object: T.Object3D | null = collision?.object || null;
    while (object) {
      if (object.userData.troubleId) return object.userData.troubleId as string;
      object = object.parent;
    }
    return null;
  }
  return { root, targets, update, hit };
}
