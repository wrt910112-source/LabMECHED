import * as T from "three";
import type { Daily } from "./DailyTraining";
export type DailyVisual = Pick<Daily, "wiped" | "mode" | "cleanCup" | "drops" | "active">;
export function createDailyModel(root: T.Group) {
  const targets = new Map<string, { object: T.Object3D; point: T.Vector3 }>();
  const needles: { id: string; swab: T.Mesh; stream: T.Mesh; start: number }[] =
    [];
  const cups: {
    id: string;
    cup: T.Object3D;
    rim: T.Object3D;
    fluid: T.Mesh;
  }[] = [];
  const blades: T.Object3D[] = [];
  root.traverse((o) => {
    if (o.userData.componentType === "probe") {
      const parent = o.parent?.userData.partId;
      const id =
        parent === "r1" || parent === "r2"
          ? `${parent.toUpperCase()}-${o.name.endsWith("0") ? 1 : 2}`
          : parent === "sample"
            ? `Sample-${o.name === "sample-inner" ? 1 : 2}`
            : "";
      if (!id) return;
      const needle = o.getObjectByName("probe-needle")!;
      o.userData.dailyId = id;
      targets.set(id, { object: o, point: needle.position.clone() });
    }
    if (o.userData.cupName) {
      const id = o.userData.cupName as string;
      o.userData.dailyId = id;
      targets.set(id, {
        object: o,
        point: o.getObjectByName("open-cup")!.position.clone(),
      });
    }
    if (o.userData.rearSide) {
      const id = o.userData.rearSide === "left" ? "左側" : "右側";
      o.userData.dailyId = id;
      targets.set(id, { object: o, point: new T.Vector3(0, 1.15, 0) });
    }
    if (o.name === "spiral-blade" || o.name === "L-blade") blades.push(o);
  });
  const material = (color: string) =>
    new T.MeshStandardMaterial({ color, roughness: 0.45 });
  targets.forEach(({ object, point }, id) => {
    if (id.includes("-") && !["S-H", "S-L", "U-H", "U-L"].includes(id)) {
      const swab = new T.Mesh(
        new T.BoxGeometry(0.022, 0.026, 0.009),
        material("#ffffff"),
      );
      swab.name = "daily-alcohol-swab";
      swab.position.copy(point);
      swab.position.z += 0.009;
      swab.visible = false;
      object.add(swab);
      const stream = new T.Mesh(
        new T.CylinderGeometry(0.002, 0.002, 0.025, 8),
        new T.MeshStandardMaterial({
          color: "#35bcef",
          transparent: true,
          opacity: 0.75,
        }),
      );
      stream.name = "daily-drain-stream";
      stream.position.copy(point);
      stream.position.y = 0.95;
      stream.visible = false;
      object.add(stream);
      needles.push({ id, swab, stream, start: 0 });
    } else if (["S-H", "S-L", "U-H", "U-L"].includes(id)) {
      const fluid = new T.Mesh(
        new T.CylinderGeometry(0.0088, 0.0088, 0.018, 24),
        new T.MeshStandardMaterial({
          color: "#56bfd3",
          transparent: true,
          opacity: 0.7,
        }),
      );
      fluid.name = "daily-cup-liquid";
      fluid.position.copy(point);
      object.add(fluid);
      fluid.visible = false;
      cups.push({
        id,
        cup: object.getObjectByName("open-cup")!,
        rim: object.getObjectByName("cup-lip")!,
        fluid,
      });
    }
  });
  const seen = new Set<string>();
  function animate(d: DailyVisual, enabled: boolean, time: number) {
    if (!d.wiped.length) seen.clear();
    for (const n of needles) {
      if (d.wiped.includes(n.id) && !seen.has(n.id)) {
        seen.add(n.id);
        n.start = time;
      }
      n.swab.visible =
        enabled && time - n.start < 1600 && n.start > 0;
      n.swab.position.y = 1.06 + Math.sin((time - n.start) / 150) * 0.075;
      n.stream.visible = enabled && d.mode === "inspect";
      n.stream.position.y = 0.948 + Math.sin(time / 120) * 0.008;
    }
    for (const b of blades)
      b.rotation.y = enabled && d.mode === "inspect" ? time / 180 : 0;
    cups.forEach((c, i) => {
      const clean =
        c.id === "U-L" && (d.cleanCup === "full" || d.cleanCup === "used");
      const placed = clean || d.drops[i] !== "";
      c.cup.visible = !d.active || placed;
      c.rim.visible = !d.active || placed;
      c.fluid.visible = d.active && (clean || Number(d.drops[i]) > 0);
      c.fluid.scale.y = clean ? 1 : Math.min(1, Number(d.drops[i]) / 15);
      c.fluid.position.y = 0.919 + 0.009 * c.fluid.scale.y;
    });
  }
  return { targets, animate };
}
