import * as T from "three";
import { rectangle } from './washModel';

// Left/right here always refer to the user's sample-probe (rear) view.
// +X appears on the LEFT when looking from negative Z toward the analyzer.
export const mixingUnits = [
  {
    id: "mixing-rear-right",
    side: "right",
    position: [0.426, 0, -0.29] as const,
    perCluster: 4,
    color: "#308fac",
    form: "spiral",
  },
  {
    id: "mixing-rear-left",
    side: "left",
    position: [1.115, 0, -0.17] as const,
    perCluster: 2,
    color: "#d6b13e",
    form: "L",
  },
] as const;

function trefoil() {
  const shape = new T.Shape();
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2,
      r = 0.097 + 0.018 * Math.cos(3 * (a + Math.PI / 2));
    const x = Math.cos(a) * r,
      y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}
function helixBlade() {
  const positions: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40,
      angle = t * Math.PI * 5,
      width = 0.0028 * (0.7 + 0.3 * Math.sin(Math.PI * t));
    for (const sign of [-1, 1])
      positions.push(
        Math.cos(angle) * width * sign,
        -t * 0.115,
        Math.sin(angle) * width * sign,
      );
    if (i < 40) {
      const v = i * 2;
      indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
export function createMixingUnits(parent: T.Group) {
  const ivory = new T.MeshStandardMaterial({
    color: "#e4e5dc",
    roughness: 0.4,
    metalness: 0.1,
  });
  const metal = new T.MeshStandardMaterial({
    color: "#a3b3b7",
    roughness: 0.27,
    metalness: 0.85,
  });
  const blade = new T.MeshStandardMaterial({
    color: "#468566",
    roughness: 0.4,
    metalness: 0.22,
    side: T.DoubleSide,
  });
  const dark = new T.MeshStandardMaterial({
    color: "#34463e",
    roughness: 0.75,
  });
  function mesh(
    p: T.Object3D,
    n: string,
    g: T.BufferGeometry,
    m: T.Material,
    x: number,
    y: number,
    z: number,
  ) {
    const o = new T.Mesh(g, m);
    o.name = n;
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    p.add(o);
    return o;
  }
  for (const spec of mixingUnits) {
    const unit = new T.Group();
    unit.name = spec.id;
    unit.position.set(spec.position[0], spec.position[1], spec.position[2]);
    unit.userData.rearSide = spec.side;
    unit.userData.rodCount = spec.perCluster * 3;
    parent.add(unit);
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 512;
    labelCanvas.height = 128;
    const labelContext = labelCanvas.getContext("2d")!;
    labelContext.fillStyle = "#e4e5dc";
    labelContext.fillRect(0, 0, 512, 128);
    labelContext.fillStyle = spec.color;
    labelContext.font = "bold 48px Arial";
    labelContext.fillText(
      spec.form === "spiral" ? "R1 / S · 1  2  3" : "R2 · 1  2  3",
      12,
      78,
    );
    const labelTexture = new T.CanvasTexture(labelCanvas);
    labelTexture.colorSpace = T.SRGBColorSpace;
    const unitLabel = new T.Mesh(
      new T.PlaneGeometry(0.115, 0.029),
      new T.MeshBasicMaterial({ map: labelTexture }),
    );
    unitLabel.rotation.x = -Math.PI / 2;
    unitLabel.position.set(0, 1.134, 0);
    unit.add(unitLabel);
    const capMat = new T.MeshStandardMaterial({
      color: spec.color,
      roughness: 0.4,
    });
    const points: { x: number; z: number; cluster: number; rod: number }[] = [];
    for (let cluster = 0; cluster < 3; cluster++) {
      const a = -Math.PI / 2 + (cluster * Math.PI * 2) / 3,
        cx = Math.cos(a) * 0.078,
        cz = -Math.sin(a) * 0.078;
      for (let rod = 0; rod < spec.perCluster; rod++) {
        const x =
          cx + (spec.perCluster === 4 ? (rod % 2 === 0 ? -0.012 : 0.012) : 0);
        const z =
          cz +
          (Math.floor(rod / (spec.perCluster === 4 ? 2 : 1)) === 0
            ? -0.014
            : 0.014);
        points.push({ x, z, cluster, rod });
      }
    }
    const upper = new T.ExtrudeGeometry(trefoil(), {
      depth: 0.021,
      bevelEnabled: true,
      bevelSize: 0.003,
      bevelThickness: 0.002,
      bevelSegments: 3,
      steps: 1,
    });
    upper.rotateX(-Math.PI / 2);
    mesh(unit, "three-lobed-upper-plate", upper, ivory, 0, 1.108, 0);
    mesh(
      unit,
      "central-shaft",
      new T.CylinderGeometry(0.017, 0.017, 0.193, 32),
      metal,
      0,
      1.0145,
      0,
    );
    mesh(
      unit,
      "shaft-collar",
      new T.CylinderGeometry(0.027, 0.027, 0.019, 32),
      dark,
      0,
      1.099,
      0,
    );
    mesh(
      unit,
      "unit-color-mark",
      new T.CylinderGeometry(0.0038, 0.0038, 0.002, 24),
      capMat,
      0,
      1.132,
      0,
    );
    for(let cluster=0;cluster<3;cluster++){
    const members=points.filter(p=>p.cluster===cluster),cx=members.reduce((s,p)=>s+p.x,0)/members.length,cz=members.reduce((s,p)=>s+p.z,0)/members.length;
    const lowerShape = rectangle(spec.perCluster===4?.058:.032,.059,.005);
    for (const p of members) {
      const hole = new T.Path();
      hole.absarc(p.x-cx, -(p.z-cz), p.rod<(spec.perCluster/2)?.0045:.009, 0, Math.PI * 2, true);
      lowerShape.holes.push(hole);
    }
    const lower = new T.ExtrudeGeometry(lowerShape, {
      depth: 0.018,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 16,
    });
    lower.rotateX(-Math.PI / 2);
    mesh(unit, "wash-platform-with-openings", lower, ivory, cx, 0.919, cz);
    }
    for (const p of points) {
      const name = `cluster-${p.cluster + 1}-rod-${p.rod + 1}`;
      const rod = new T.Group();
      rod.name = name;
      rod.userData.componentType = "stirrer";
      rod.userData.cluster = p.cluster + 1;
      unit.add(rod);
      mesh(
        rod,
        "metal-stem",
        new T.CylinderGeometry(0.004, 0.004, 0.038, 16),
        metal,
        p.x,
        1.123,
        p.z,
      );
      mesh(
        rod,
        "colored-cap",
        new T.CylinderGeometry(0.0035, 0.0035, 0.002, 16),
        capMat,
        p.x,
        1.143,
        p.z,
      );
      mesh(
        rod,
        "cap-seating-ring",
        new T.CylinderGeometry(0.005, 0.005, 0.002, 20),
        dark,
        p.x,
        1.1305,
        p.z,
      );
      if (spec.form === "spiral")
        mesh(rod, "spiral-blade", helixBlade(), blade, p.x, 1.102, p.z);
      else {
        const path = new T.CatmullRomCurve3([
          new T.Vector3(p.x, 1.102, p.z),
          new T.Vector3(p.x, 0.988, p.z),
          new T.Vector3(p.x + 0.007, 0.986, p.z),
        ]);
        mesh(
          rod,
          "L-blade",
          new T.TubeGeometry(path, 20, 0.0018, 6, false),
          blade,
          0,
          0,
          0,
        );
      }
      const well = mesh(
        unit,
        `cluster-${p.cluster + 1}-well-${p.rod + 1}`,
        new T.CylinderGeometry(p.rod<spec.perCluster/2?.0045:.009, p.rod<spec.perCluster/2?.0045:.009, 0.001, 24),
        dark.clone(),
        p.x,
        0.9195,
        p.z,
      );
      well.userData.componentType = "stirrer-well";
      well.userData.weeklyId=`well-${spec.perCluster===4?'R1S':'R2'}-${p.cluster*spec.perCluster+p.rod+1}`;
      well.userData.cluster = p.cluster + 1;
      // Raised rim and bore are separate, so each of the 12/6 openings is visible.
      const ring = mesh(
        unit,
        `well-rim-${p.cluster + 1}-${p.rod + 1}`,
        new T.TorusGeometry(p.rod<spec.perCluster/2?.0045:.009, 0.001, 6, 24),
        ivory,
        p.x,
        0.937,
        p.z,
      );
      ring.rotation.x = Math.PI / 2;
    }
  }
}
