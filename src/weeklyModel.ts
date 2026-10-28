import * as T from "three";
import type { Weekly } from "./WeeklyTraining";
import type { ProbeState } from "../shared/exam";
export type WeeklyVisual = Pick<Weekly, "target" | "view" | "lid" | "progress" | "wells" | "lastWell" | "swabReady" | "cup" | "batch" | "batchGroup" | "diag" | "pendingDiag" | "busy"> & { iseTop?: boolean; exam?: boolean; probeStates?: Record<string, ProbeState> };
export function createWeeklyModel(root: T.Group) {
  const targets=new Map<string,T.Object3D>();
  const upperPlates:T.Mesh[]=[];
  const cleaningSwab=new T.Group();
  const stem=new T.Mesh(new T.CylinderGeometry(.0018,.0018,.17,12),new T.MeshStandardMaterial({color:'#76ce91'}));stem.position.y=.095;
  const cotton=new T.Mesh(new T.SphereGeometry(.005,12,12),new T.MeshStandardMaterial({color:'#f8faf4'}));cotton.scale.y=2;
  cleaningSwab.add(stem,cotton);cleaningSwab.visible=false;root.add(cleaningSwab);
  for(const [id,x,z] of [['front',0.77,0.67],['sample',0.77,-0.61]] as const){
    const group=new T.Group();group.name=`diag-${id}`;group.userData.partId=id==='front'?'analyzer':'sample';
    const frame=new T.Mesh(new T.BoxGeometry(.052,.007,.052),new T.MeshStandardMaterial({color:'#333b3a'}));
    const button=new T.Mesh(new T.BoxGeometry(.034,.009,.034),new T.MeshStandardMaterial({color:'#36b94e'}));
    button.position.y=.006;group.add(frame,button);group.position.set(x,.927,z);group.userData.weeklyId=`diag-${id}`;root.add(group);targets.set(`diag-${id}`,group);
  }
  const items: {
    id: string;
    o: T.Object3D;
    base: number;
    connector?: T.Object3D;
    swab?: T.Mesh;
    wire?: T.Mesh;
    stream?: T.Mesh;
  }[] = [];
  root.traverse((o) => {
    if(o.name==='three-lobed-upper-plate'&&o instanceof T.Mesh){o.material=(o.material as T.Material).clone();upperPlates.push(o);}
    if(o.name==='diag-green'){o.userData.weeklyId='diag-ise';targets.set('diag-ise',o);}
    if(o.userData.weeklyId?.startsWith('well-'))targets.set(o.userData.weeklyId,o);
    if(o.name==='mixing-rear-right'||o.name==='mixing-rear-left'){
      const anchor=new T.Object3D();anchor.position.y=1.17;o.add(anchor);targets.set(o.name==='mixing-rear-right'?'group-R1S':'group-R2',anchor);
    }
    let id = "";
    if (o.name === "sample-inner") id = "Sample-1";
    if (o.name === "sample-outer") id = "Sample-2";
    if (o.name === "ise-sample-probe") id = "ISE";
    if (o.userData.componentType === "stirrer") {
      const match = o.name.match(/cluster-(\d+)-rod-(\d+)/);
      if (match) {
        const right = o.parent?.name === "mixing-rear-right";
        id = `${right ? "R1S" : "R2"}-${(Number(match[1]) - 1) * (right ? 4 : 2) + Number(match[2])}`;
      }
    }
    if (!id) return;
    o.userData.weeklyId = id;
    const needle = o.getObjectByName("probe-needle");
    if(needle){needle.userData.weeklyId=`tip-${id}`;targets.set(`tip-${id}`,needle);}
    const connector=o.getObjectByName('connector');
    if(connector){connector.userData.weeklyId=`lock-${id}`;targets.set(`lock-${id}`,connector);}
    const movable = needle || o;
    const item: {
      id: string;
      o: T.Object3D;
      base: number;
      connector?: T.Object3D;
      swab?: T.Mesh;
      wire?: T.Mesh;
      stream?: T.Mesh;
    } = {
      id,
      o: movable,
      base: movable.position.y,
      connector: o.getObjectByName("connector"),
    };
    const point =
      needle?.position.clone() ||
      o.getObjectByName("spiral-blade")?.position.clone() ||
      o.getObjectByName("L-blade")?.position.clone() ||
      new T.Vector3(0, 1.1, 0);
    const swab = new T.Mesh(
      new T.BoxGeometry(0.022, 0.025, 0.009),
      new T.MeshStandardMaterial({ color: "white" }),
    );
    swab.position.copy(point);
    swab.visible = false;
    o.add(swab);
    item.swab = swab;
    if (needle) {
      const wire = new T.Mesh(
        new T.CylinderGeometry(0.0007, 0.0007, 0.25, 8),
        new T.MeshStandardMaterial({ color: "#aabbcc", metalness: 0.8 }),
      );
      wire.position.copy(point);
      wire.position.y += 0.2;
      wire.visible = false;
      o.add(wire);
      item.wire = wire;
      const stream = new T.Mesh(
        new T.CylinderGeometry(0.002, 0.002, 0.07, 8),
        new T.MeshBasicMaterial({
          color: "#38b9ec",
          transparent: true,
          opacity: 0.6,
        }),
      );
      stream.position.copy(point);
      stream.position.y -= 0.12;
      stream.visible = false;
      o.add(stream);
      item.stream = stream;
    }
    items.push(item);
  });
  return {
    targets,
    animate(w?: WeeklyVisual) {
      upperPlates.forEach(plate=>{
        const material=plate.material as T.Material,fade=w?.view==='孔洞清潔';
        if(material.transparent!==fade){material.transparent=fade;material.needsUpdate=true;}
        material.opacity=fade?.16:1;material.depthWrite=!fade;plate.castShadow=!fade;
      });
      const well=w?.lastWell?targets.get(w.lastWell):undefined;
      cleaningSwab.visible=!!well&&w?.view==='孔洞清潔'&&!!w.swabReady&&w.lid;
      if(well)cleaningSwab.position.copy(root.worldToLocal(well.getWorldPosition(new T.Vector3())));
      targets.forEach((object,id)=>{
        if(id.startsWith('well-')&&object instanceof T.Mesh){
          (object.material as T.MeshStandardMaterial).color.set(!w?.exam&&w?.wells.includes(id)?'#39a882':'#34463e');
        }
      });
      if (w)
        root.traverse((o) => {
          if (o.userData.cupName === "U-L") {
            const fluid = o.getObjectByName("daily-cup-liquid");
            if (fluid) {
              fluid.visible = w.cup;
              fluid.scale.y = 1;
            }
            const cup = o.getObjectByName("open-cup");
            if (cup) cup.visible = w.cup;
          }
        });
      for (const item of items) {
        const n = w?.progress[item.id] || 0;
        const probe = !!item.connector;
        const probeState = w?.probeStates?.[item.id];
        const removed = probe ? probeState ? !probeState.installed : n >= 3 && n < 6 : n > 0 && n < 3;
        const batch = w?.batch && item.id.startsWith(w.batchGroup+'-')
          ? Math.sin(Math.min(1, (Date.now() - w.batch) / 2400) * Math.PI) *
            0.17
          : 0;
        item.o.position.y =
          item.base + (w ? (removed ? 0.16 : 0) + (!probe ? batch : 0) : 0);
        if (item.connector) {
          item.connector.rotation.y = w && (probeState ? !probeState.locked : n > 0 && n < 7) ? Math.PI : 0;
        }
        if (item.swab)
          item.swab.visible = !!w && (probe ? n === 4 : !!batch);
        if (item.wire) item.wire.visible = !!w && n === 5;
        if (item.stream) item.stream.visible = !!w && (w.diag === item.id || n===1);
        if (!probe)
          item.o.rotation.y =
            w?.diag === "mix" ? 0.03 * Math.sin(Date.now() / 120) : 0;

      }
    },
  };
}
