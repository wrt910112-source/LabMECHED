import type { DoorState } from "./enclosures";
import { createWeeklyModel } from "./weeklyModel";
import { weeklyWells, weeklyProbes, type Weekly } from "./WeeklyTraining";
import type { Daily } from "./DailyTraining";
import { createDailyModel } from "./dailyModel";
import { practiceIds } from "./ModelPractice";
import type { IseState } from "./iseModel";
import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createInstrument } from "./model";
import { partById, type PartId, type Vec3 } from "./data";
import { slotById, type BottleStates } from "./detergents";

export interface CameraRequest {
  eye: Vec3;
  target: Vec3;
  serial: number;
}
interface Props {
  weekly?: Weekly;
  onWeeklySelect: (id: string) => void;
  daily: Daily;
  practice: boolean;
  practiceTarget: string;
  onPracticeSelect: (id: string) => void;
  doorState: DoorState;
  iseState: IseState;
  selected: PartId;
  internal: boolean;
  labels: boolean;
  request: CameraRequest;
  onSelect: (id: PartId) => void;
  zoom: number;
  onReady: () => void;
  onError: () => void;
  bottles: BottleStates;
  selectedSlot: string | null;
  onSlot: (id: string) => void;
}
type Engine = {
  doors: (s: DoorState) => void;
  ise: (state: IseState) => void;
  focus: (r: CameraRequest) => void;
  select: (id: PartId, slot?: string | null) => void;
  bottles: (states: BottleStates) => void;
  internal: (v: boolean) => void;
  zoom: (v: number) => void;
};
const anchors: { id: PartId; position: Vec3; label: string }[] = [
  { id: "loader", position: [-0.97, 0.93, 0.55], label: "樣品架進架區" },
  { id: "ise", position: [0.015, 1.24, 0.05], label: "ISE 模組" },
  { id: "analyzer", position: [1.05, 1.28, 0.15], label: "分析單元" },
];
export default function Viewer(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    practiceMarkers = useRef<HTMLDivElement>(null),
    weeklyMarkers = useRef<HTMLDivElement>(null),
    markerHost = useRef<HTMLDivElement>(null),
    engine = useRef<Engine | null>(null);
  const current = useRef(props);
  current.current = props;
  const [error, setError] = useState(false),
    [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    const el = host.current!;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      setError(true);
      current.current.onError();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    el.prepend(renderer.domElement);
    renderer.domElement.setAttribute("aria-label", "AU5800 可旋轉三維模型");
    renderer.domElement.dataset.testid = "model-canvas";
    const scene = new T.Scene(),
      camera = new T.PerspectiveCamera(37, 1, 0.025, 60);
    camera.position.set(...current.current.request.eye);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...current.current.request.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minDistance = 0.45;
    controls.maxDistance = 8;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.enablePan = false;
    const pmrem = new T.PMREMGenerator(renderer),
      room = new RoomEnvironment(),
      env = pmrem.fromScene(room, 0.04);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.45;
    room.dispose();
    pmrem.dispose();
    scene.add(new T.HemisphereLight("#ffffff", "#8d9685", 0.8));
    const light = new T.DirectionalLight("#fff4e6", 2);
    light.position.set(-2, 6, 3);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -2.5;
    light.shadow.camera.right = 2.5;
    light.shadow.camera.top = 2.5;
    light.shadow.camera.bottom = -2.5;
    light.shadow.normalBias = 0.008;
    light.shadow.bias = -0.0003;
    scene.add(light);
    const fill = new T.DirectionalLight("#d5e5ee", 0.8);
    fill.position.set(3, 2, -3);
    scene.add(fill);
    const floor = new T.Mesh(
      new T.PlaneGeometry(200, 200),
      new T.ShadowMaterial({ opacity: 0.1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const instrument = createInstrument();
    const dailyModel = createDailyModel(instrument.root);
    const weeklyModel = createWeeklyModel(instrument.root);
    scene.add(instrument.root);
    // Materials are independent per mesh so selection never leaks into another part.
    instrument.root.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
      }
    });
    instrument.washBanks.setBottles(current.current.bottles, true);
    const original = new Map<
      T.MeshStandardMaterial,
      { color: T.Color; intensity: number }
    >();
    let fromEye = camera.position.clone(),
      fromTarget = controls.target.clone(),
      toEye = camera.position.clone(),
      toTarget = controls.target.clone(),
      start = 0,
      animating = false;
    const focus = (r: CameraRequest) => {
      // Keep zoom limits relative to the inspected region so an overview
      // camera cannot travel into the cabinet when repeatedly zooming in.
      controls.minDistance = Math.max(
        0.42,
        new T.Vector3(...r.eye).distanceTo(new T.Vector3(...r.target)) * 0.48,
      );
      controls.update();
      fromEye = camera.position.clone();
      fromTarget = controls.target.clone();
      toEye.set(...r.eye);
      toTarget.set(...r.target);
      start = performance.now();
      animating = true;
    };
    const select = (id: PartId, slot?: string | null) => {
      original.forEach((v, m) => {
        m.emissive.copy(v.color);
        m.emissiveIntensity = v.intensity;
      });
      original.clear();
      if (id === "overview") return;
      const target = slot
        ? instrument.washBanks.slots.get(slot)
        : instrument.groups.get(id);
      target?.traverse((o) => {
        if (o instanceof T.Mesh) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            if (m instanceof T.MeshStandardMaterial) {
              original.set(m, {
                color: m.emissive.clone(),
                intensity: m.emissiveIntensity,
              });
              m.emissive.set("#4fa990");
              m.emissiveIntensity = 0.21;
            }
          });
        }
      });
    };
    engine.current = {
      doors: (s) => instrument.enclosures.setState(s),
      ise: (state) => instrument.iseModel.setState(state),
      focus,
      select,
      bottles: (states) => instrument.washBanks.setBottles(states),
      internal(v) {
        instrument.covers.forEach((c) => (c.visible = !v));
      },
      zoom(v) {
        animating = false;
        const offset = camera.position.clone().sub(controls.target);
        const dist = T.MathUtils.clamp(
          offset.length() * v,
          controls.minDistance,
          controls.maxDistance,
        );
        camera.position.copy(controls.target).add(offset.setLength(dist));
        controls.update();
      },
    };
    engine.current.internal(current.current.internal);
    engine.current.ise(current.current.iseState);
    engine.current.doors(current.current.doorState);
    select(current.current.selected, current.current.selectedSlot);
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    const ray = new T.Raycaster(),
      pointer = new T.Vector2();
    let downX = 0,
      downY = 0;
    let dragging = false;
    const hit = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const hits = ray.intersectObject(instrument.root, true).filter((h) => {
        let o: T.Object3D | null = h.object;
        while (o) {
          if (!o.visible) return false;
          o = o.parent;
        }
        return true;
      });
      let obj: T.Object3D | null = hits[0]?.object ?? null;
      let slotId: string | undefined;
      let dailyId: string | undefined;
      let weeklyId: string | undefined;
      while (obj) {
        if (!weeklyId && obj.userData.weeklyId) weeklyId = obj.userData.weeklyId;
        if (obj.userData.dailyId) dailyId = obj.userData.dailyId;
        if (obj.userData.slotId) slotId = obj.userData.slotId;
        if (obj.userData.partId)
          return {
            partId: obj.userData.partId as PartId,
            slotId,
            dailyId,
            weeklyId,
          };
        obj = obj.parent;
      }
      return null;
    };
    const pointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
      dragging = false;
    };
    const pointerMove = (e: PointerEvent) => {
      if (e.buttons && Math.hypot(e.clientX - downX, e.clientY - downY) > 5)
        dragging = true;
      const id = dragging ? null : hit(e);
      setHover(
        id
          ? id.slotId
            ? `${id.partId.toUpperCase()} · ${slotById[id.slotId].label}`
            : partById[id.partId].name
          : null,
      );
      renderer.domElement.style.cursor = dragging
        ? "grabbing"
        : id
          ? "pointer"
          : "grab";
    };
    const pointerUp = (e: PointerEvent) => {
      if (
        e.button === 0 &&
        !dragging &&
        Math.hypot(e.clientX - downX, e.clientY - downY) < 5
      ) {
        const id = hit(e);
        if (current.current.weekly && (id?.weeklyId || id?.slotId))
          current.current.onWeeklySelect(id.weeklyId || id.slotId!);
        else if (id?.dailyId && current.current.practice)
          current.current.onPracticeSelect(id.dailyId);
        else if (id?.slotId) current.current.onSlot(id.slotId);
        else if (id) current.current.onSelect(id.partId);
      }
      dragging = false;
    };
    const leave = () => setHover(null),
      cancel = () => {
        animating = false;
      };
    controls.addEventListener("start", cancel);
    const lost = (e: Event) => {
      e.preventDefault();
      setError(true);
      current.current.onError();
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("pointerleave", leave);
    let frame = 0,
      first = true;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (animating) {
        const t = Math.min(
          (performance.now() - start) /
            (matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 700),
          1,
        );
        const eased = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(fromEye, toEye, eased);
        controls.target.lerpVectors(fromTarget, toTarget, eased);
        if (t === 1) animating = false;
      }
      controls.update();
      dailyModel.animate(
        current.current.daily,
        current.current.practice,
        performance.now(),
      );
      dailyModel.targets.forEach(({ object, point }, id) => {
        const button =
          practiceMarkers.current?.querySelector<HTMLButtonElement>(
            `[data-practice-id="${id}"]`,
          );
        if (!button) return;
        const v = object.localToWorld(point.clone()).project(camera);
        const group = current.current.practiceTarget;
        const same = group.startsWith("R1")
          ? id.startsWith("R1")
          : group.startsWith("R2")
            ? id.startsWith("R2")
            : group.startsWith("Sample")
              ? id.startsWith("Sample")
              : ["左側", "右側"].includes(group)
                ? ["左側", "右側"].includes(id)
                : ["S-H", "S-L", "U-H", "U-L"].includes(id);
        button.style.left = `${(v.x * 0.5 + 0.5) * el.clientWidth}px`;
        button.style.top = `${(-v.y * 0.5 + 0.5) * el.clientHeight}px`;
        button.style.visibility =
          current.current.practice &&
          same &&
          v.z < 1 &&
          Math.abs(v.x) < 0.95 &&
          Math.abs(v.y) < 0.9
            ? "visible"
            : "hidden";
      });
      instrument.iseModel.animate();
      weeklyModel.animate(current.current.weekly);
      weeklyModel.targets.forEach((object,id)=>{
        const button=weeklyMarkers.current?.querySelector<HTMLButtonElement>(`[data-weekly-id="${id}"]`);
        if(!button)return;
        const w=current.current.weekly,v=object.getWorldPosition(new T.Vector3()).project(camera);
        const wellGroup=w?.target.includes('R2')?'R2':'R1S';
        const show=w && w.lid && (id.startsWith('diag-') ? !!w.pendingDiag : id.startsWith('well-') ? w.view==='孔洞清潔'&&id.startsWith(`well-${wellGroup}-`) : id.startsWith('group-') ? w.view==='攪拌棒' : w.view==='探針' && id.endsWith(w.target));
        button.style.left=`${(v.x*.5+.5)*el.clientWidth}px`;button.style.top=`${(-v.y*.5+.5)*el.clientHeight}px`;
        button.style.visibility=show&&v.z<1&&v.z>-1?'visible':'hidden';
      });
      instrument.enclosures.animate();
      instrument.washBanks.animate(current.current.bottles, performance.now());
      renderer.render(scene, camera);
      anchors.forEach((a, i) => {
        const button = markerHost.current?.children[i] as
          HTMLElement | undefined;
        if (!button) return;
        const v = new T.Vector3(...a.position).project(camera);
        button.style.left = `${(v.x * 0.5 + 0.5) * el.clientWidth}px`;
        button.style.top = `${(-v.y * 0.5 + 0.5) * el.clientHeight}px`;
        button.style.visibility =
          v.z < 1 && Math.abs(v.x) < 0.94 && Math.abs(v.y) < 0.8
            ? "visible"
            : "hidden";
      });
      if (first) {
        first = false;
        current.current.onReady();
      }
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      engine.current = null;
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointerleave", leave);
      const geometries = new Set<T.BufferGeometry>(),
        materials = new Set<T.Material>(),
        textures = new Set<T.Texture>();
      scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          geometries.add(o.geometry);
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(
            (m) => {
              materials.add(m);
              Object.values(m).forEach((v) => {
                if (v instanceof T.Texture) textures.add(v);
              });
            },
          );
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      env.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  useEffect(
    () => engine.current?.select(props.selected, props.selectedSlot),
    [props.selected, props.selectedSlot],
  );
  useEffect(() => engine.current?.bottles(props.bottles), [props.bottles]);
  useEffect(() => engine.current?.doors(props.doorState), [props.doorState]);
  useEffect(() => engine.current?.ise(props.iseState), [props.iseState]);
  useEffect(() => engine.current?.internal(props.internal), [props.internal]);
  useEffect(() => engine.current?.focus(props.request), [props.request]);
  const previousZoom = useRef(props.zoom);
  useEffect(() => {
    if (props.zoom !== previousZoom.current)
      engine.current?.zoom(props.zoom > previousZoom.current ? 0.82 : 1.22);
    previousZoom.current = props.zoom;
  }, [props.zoom]);
  return (
    <div
      className="viewer-host"
      ref={host}
      data-selected={props.selected}
      data-internal={props.internal}
      data-slot={props.selectedSlot ?? ""}
    >
      {!error && (
        <div className="practice-markers weekly-markers" ref={weeklyMarkers}>
          {[...weeklyWells,...weeklyProbes.flatMap(id=>[`lock-${id}`,`tip-${id}`]),'group-R1S','group-R2','diag-front','diag-sample','diag-ise'].map(id=>{
            const probe=id.replace(/^(lock|tip)-/,'');const n=props.weekly?.progress[probe]||0;
            const label=id.startsWith('well-')?`${props.weekly?.wells.includes(id)?'✓ ':''}${id.slice(5)}`:id.startsWith('lock-')?(n===6?'鎖緊鎖頭':'旋開鎖頭'):id.startsWith('tip-')?(['先旋開鎖頭','等待液體滴完','提起取出','擦拭 tip','鐵絲通探針孔','裝回探針','請鎖緊鎖頭','已完成'][n]):id.startsWith('group-')?`${id==='group-R1S'?'右側 12 支':'左側 6 支'}取下清潔並裝回`:`DIAG ${id.slice(5)}`;
            return <button key={id} data-weekly-id={id} aria-label={`模型 ${id} ${label}`} title={label} aria-pressed={id.startsWith('well-')?props.weekly?.wells.includes(id):undefined} onClick={()=>props.onWeeklySelect(id)} disabled={props.weekly?.busy}>{id.startsWith('well-')?id.split('-').at(-1):label}</button>;
          })}
        </div>
      )}
      {!error && (
        <div className="practice-markers" ref={practiceMarkers}>
          {practiceIds.map((id) => (
            <button
              key={id}
              data-practice-id={id}
              aria-label={`模型操作 ${id}`}
              aria-pressed={props.practiceTarget === id}
              onClick={() => props.onPracticeSelect(id)}
            >
              {id}
            </button>
          ))}
        </div>
      )}
      {!error && (
        <div
          className={`scene-markers ${props.labels ? "" : "hidden"}`}
          ref={markerHost}
        >
          {anchors.map((a) => (
            <button
              key={a.id}
              onClick={() => props.onSelect(a.id)}
              aria-label={`模型標籤：${a.label}`}
            >
              <span className="marker-dot" />
              {a.label}
              <span className="marker-arrow">↗</span>
            </button>
          ))}
        </div>
      )}
      {hover && !error && (
        <div className="hover-part">
          {hover}
          <span>點選探索</span>
        </div>
      )}
      {error && (
        <div className="webgl-error" role="alert">
          <span>3D</span>
          <h2>無法顯示 3D 模型</h2>
          <p>
            請使用支援 WebGL 2 的 Chrome 或
            Edge，確認瀏覽器已開啟圖形加速後重新載入。您仍可從左側瀏覽部件與實機照片。
          </p>
          <button onClick={() => location.reload()}>重新載入</button>
        </div>
      )}
    </div>
  );
}
