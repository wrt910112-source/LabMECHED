import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { DoorId, DoorState } from "./enclosures";
import { createWeeklyModel, type WeeklyVisual } from "./weeklyModel";
import { weeklyWells, weeklyProbes } from "./WeeklyTraining";
import { createDailyModel, type DailyVisual } from "./dailyModel";
import { practiceIds } from "./ModelPractice";
import type { IseState } from "./iseModel";
import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createInstrument } from "./model";
import { partById, type PartId, type Vec3 } from "./data";
import { slotById, type BottleStates } from "./detergents";
import {
  createPreparationModel,
  preparationViews,
  type PreparationView,
} from "./preparationModel";
import type { PreparationState, PreparationGate } from "../shared/preparation";
import type { Material } from "../shared/materialCatalog";
import type { TroubleState } from "../shared/troubleshooting";
import { createTroubleshootingModel } from "./troubleshootingModel";
export interface PreparationVisual {
  state: PreparationState;
  gate: PreparationGate;
  view: PreparationView;
  exam: boolean;
  freeSimulation?: boolean;
  materials?: Material[];
}

export interface CameraRequest {
  eye: Vec3;
  target: Vec3;
  serial: number;
}
export interface SceneSelection {
  partId: PartId;
  objectId?: string;
  doorId?: DoorId | "main" | "ise-module";
  slotId?: string;
  dailyId?: string;
  weeklyId?: string;
}
interface Props {
  troubleshooting?: TroubleState;
  troubleSelection?: string | null;
  onTroubleSelect?: (id: string) => void;
  preparation?: PreparationVisual;
  onPreparationSelect?: (id: string) => void;
  onInspect?: (selection: SceneSelection) => void;
  onClear?: () => void;
  selection?: SceneSelection | null;
  guidanceTargets?: string[];
  rightInset?: number;
  topInset?: number;
  suspended?: boolean;

  weekly?: WeeklyVisual;
  onWeeklySelect: (id: string) => void;
  daily: DailyVisual;
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
  troubleshooting: (state?: TroubleState) => void;
  preparation: (p?: PreparationVisual) => void;
  doors: (s: DoorState) => void;
  ise: (state: IseState) => void;
  focus: (r: CameraRequest) => void;
  select: (
    id: PartId,
    slot?: string | null,
    selection?: SceneSelection | null,
  ) => void;
  inset: () => void;
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
    guideHost = useRef<HTMLDivElement>(null),
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
    renderer.shadowMap.enabled = !current.current.troubleshooting;
    renderer.shadowMap.autoUpdate = false;
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
    controls.enablePan = true;
    controls.panSpeed = 0.65;
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
    const troubleModel = createTroubleshootingModel(instrument.root);
    let bench: ReturnType<typeof createPreparationModel> | null = null;
    // Materials are independent per mesh so selection never leaks into another part.
    instrument.root.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
      }
    });
    instrument.washBanks.setBottles(current.current.bottles, true);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const outline = new OutlinePass(new T.Vector2(1, 1), scene, camera);
    outline.enabled = !current.current.troubleshooting;
    const selectionBox = new T.BoxHelper(instrument.root, 0x6bd8ec);
    selectionBox.visible = false;
    scene.add(selectionBox);
    const setCaseSelection = (object?: T.Object3D | null) => {
      selectionBox.visible = !!current.current.troubleshooting && !!object;
      if (selectionBox.visible && object) selectionBox.setFromObject(object);
    };
    outline.visibleEdgeColor.set("#6bd8ec");
    outline.hiddenEdgeColor.set("#315368");
    outline.edgeStrength = 3;
    outline.edgeGlow = 0;
    outline.edgeThickness = 1;
    composer.addPass(outline);
    composer.addPass(new OutputPass());
    let drawUntil = performance.now() + 2400;
    const invalidate = () => {
      drawUntil =
        performance.now() + (current.current.troubleshooting ? 120 : 2400);
    };
    let fromEye = camera.position.clone(),
      fromTarget = controls.target.clone(),
      toEye = camera.position.clone(),
      toTarget = controls.target.clone(),
      start = 0,
      animating = false;
    const focus = (r: CameraRequest) => {
      invalidate();
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
    const select = (
      id: PartId,
      slot?: string | null,
      selection?: SceneSelection | null,
    ) => {
      if (current.current.preparation) return;
      const precise = selection?.objectId
        ? instrument.root.getObjectByProperty("uuid", selection.objectId)
        : undefined;
      const target =
        precise ||
        (selection?.dailyId
          ? dailyModel.targets.get(selection.dailyId)?.object
          : undefined) ||
        (selection?.weeklyId
          ? weeklyModel.targets.get(selection.weeklyId)
          : undefined) ||
        (selection?.doorId
          ? instrument.enclosures.doors.get(selection.doorId as DoorId)
          : undefined) ||
        (slot
          ? instrument.washBanks.slots.get(slot)
          : instrument.groups.get(id));
      outline.selectedObjects = id === "overview" ? [] : target ? [target] : [];
      invalidate();
    };
    let sceneMode = "instrument";
    const cameraMemory = new Map<
      string,
      { eye: T.Vector3; target: T.Vector3 }
    >();
    engine.current = {
      troubleshooting: (state) => {
        troubleModel.update(state);
        const selected = current.current.troubleSelection;
        if (selected)
          outline.selectedObjects = [
            troubleModel.targets.get(selected)!,
          ].filter(Boolean);
        if (selected) setCaseSelection(troubleModel.targets.get(selected));
        invalidate();
      },
      preparation: (p) => {
        const next = p?.view || "instrument";
        if (next !== sceneMode) {
          cameraMemory.set(sceneMode, {
            eye: camera.position.clone(),
            target: controls.target.clone(),
          });
          const saved = cameraMemory.get(next);
          const preset = p ? preparationViews[p.view] : current.current.request;
          const dest = saved
            ? {
                eye: saved.eye.toArray() as Vec3,
                target: saved.target.toArray() as Vec3,
              }
            : preset;
          sceneMode = next;
          focus({ ...dest, serial: 0 });
        }
        if (p && !bench) {
          bench = createPreparationModel(p.materials);
          scene.add(bench.root);
        }
        if (bench) bench.root.visible = !!p;
        // Replace the loader's static example tubes with this scenario's actual cups.
        instrument.groups.get("loader")?.traverse((object) => {
          if (/^(rack-\d-\d|tube-(?:cap-)?\d-\d-\d+)$/.test(object.name))
            object.visible = !p;
        });
        if (p && bench) {
          bench.update(p.state, p.gate, !p.exam && !p.freeSimulation);
          const object = p.state.selection
            ? bench.targets.get(p.state.selection)
            : undefined;
          const reagent = current.current.troubleSelection
            ? troubleModel.targets.get(current.current.troubleSelection)
            : null;
          outline.selectedObjects = reagent
            ? [reagent]
            : object
              ? [object]
              : [];
          setCaseSelection(reagent || object);
        } else
          select(
            current.current.selected,
            current.current.selectedSlot,
            current.current.selection,
          );
        invalidate();
      },
      doors: (s) => {
        instrument.enclosures.setState(s);
      },
      ise: (state) => instrument.iseModel.setState(state),
      focus,
      select,
      inset: () => resize(),
      bottles: (states) => instrument.washBanks.setBottles(states),
      internal(v) {
        instrument.covers.forEach((c) => (c.visible = !v));
        invalidate();
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
    select(
      current.current.selected,
      current.current.selectedSlot,
      current.current.selection,
    );
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      renderer.setSize(w, h);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.setViewOffset(
        w,
        h,
        (current.current.rightInset || 0) / 2,
        0,
        w,
        h,
      );
      camera.updateProjectionMatrix();
      invalidate();
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
      const objectId = obj?.uuid;
      let doorId: SceneSelection["doorId"];
      let slotId: string | undefined;
      let dailyId: string | undefined;
      let weeklyId: string | undefined;
      while (obj) {
        if (obj.userData.doorId) doorId = obj.userData.doorId;
        if (obj.name === "analyzer-outer-cover") doorId = "main";
        if (obj.name === "ise-maintenance-cover") doorId = "ise-module";
        if (!weeklyId && obj.userData.weeklyId)
          weeklyId = obj.userData.weeklyId;
        if (obj.userData.dailyId) dailyId = obj.userData.dailyId;
        if (obj.userData.slotId) slotId = obj.userData.slotId;
        if (obj.userData.partId)
          return {
            partId: obj.userData.partId as PartId,
            objectId,
            doorId,
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
      if (current.current.preparation) {
        hit(e);
        const picked = dragging
          ? null
          : troubleModel.hit(ray) || bench?.hit(ray);
        setHover(picked?.replace(/^(source|cup|rack|slot):/, "") || null);
        renderer.domElement.style.cursor = dragging
          ? "grabbing"
          : picked
            ? "pointer"
            : "grab";
        return;
      }
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
        if (current.current.preparation) {
          hit(e);
          const reagent = troubleModel.hit(ray);
          if (reagent) {
            current.current.onTroubleSelect?.(reagent);
            dragging = false;
            return;
          }
          const picked = bench?.hit(ray);
          if (picked) current.current.onPreparationSelect?.(picked);
          dragging = false;
          return;
        }
        const id = hit(e);
        if (!id) current.current.onClear?.();
        else if (current.current.onInspect) current.current.onInspect(id);
        else if (current.current.weekly && (id?.weeklyId || id?.slotId))
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
    controls.addEventListener("change", invalidate);
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
      first = true,
      lastDraw = 0,
      lastShadow = 0;
    let lastVisual = "",
      wasSuspended = false;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const now = performance.now();
      if (current.current.suspended) {
        wasSuspended = true;
        return;
      }
      if (wasSuspended) {
        invalidate();
        wasSuspended = false;
      }
      // UI timers may render the parent every second. Only a real visual state
      // change should wake the GPU; keep the scene and camera mounted in place.
      const p = current.current;
      const visual = JSON.stringify([
        p.daily,
        p.weekly,
        p.bottles,
        p.doorState,
        p.iseState,
        p.guidanceTargets,
        p.practice,
        p.practiceTarget,
        p.preparation,
      ]);
      if (visual !== lastVisual) {
        lastVisual = visual;
        invalidate();
      }
      controls.update();
      const moving =
        (p.practice && p.daily.mode === "inspect") ||
        !!p.weekly?.diag ||
        !!(p.weekly?.batch && Date.now() - p.weekly.batch < 2600);
      if (!first && !animating && !moving && now > drawUntil) return;
      if (!first && now - lastDraw < 1000 / 30) return;
      lastDraw = now;
      if (animating) {
        const t = Math.min(
          (performance.now() - start) /
            (matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 350),
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
      const cupIds = ["S-H", "S-L", "U-H", "U-L"];
      const cupMarkers = [...dailyModel.targets.entries()]
        .filter(([id]) => cupIds.includes(id))
        .map(([id, { object, point }]) => ({
          id,
          v: object.localToWorld(point.clone()).project(camera),
        }))
        .sort((a, b) => a.v.x - b.v.x);
      const cupCenter = cupMarkers.reduce((n, p) => n + p.v.x, 0) / 4;
      const cupTop =
        Math.min(
          ...cupMarkers.map((p) => (-p.v.y * 0.5 + 0.5) * el.clientHeight),
        ) - 38;
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
        if (cupIds.includes(id)) {
          const rank = cupMarkers.findIndex((p) => p.id === id);
          button.style.left = `${(cupCenter * 0.5 + 0.5) * el.clientWidth + (rank - 1.5) * 60}px`;
          button.style.top = `${Math.max(current.current.topInset || 84, cupTop)}px`;
        }
        button.style.visibility =
          current.current.practice &&
          (!["S-H", "S-L", "U-H", "U-L"].includes(id) ||
            current.current.doorState["ise-top"]) &&
          same &&
          v.z < 1 &&
          Math.abs(v.x) < 0.95 &&
          Math.abs(v.y) < 0.9
            ? "visible"
            : "hidden";
      });
      instrument.iseModel.animate();
      weeklyModel.animate(current.current.weekly);
      weeklyModel.targets.forEach((object, id) => {
        const button = weeklyMarkers.current?.querySelector<HTMLButtonElement>(
          `[data-weekly-id="${id}"]`,
        );
        if (!button) return;
        const w = current.current.weekly,
          v = object.getWorldPosition(new T.Vector3()).project(camera);
        const wellGroup = w?.target.includes("R2") ? "R2" : "R1S";
        const show =
          w &&
          (id.endsWith("ISE") || id === "diag-ise"
            ? (w.iseTop ?? w.lid)
            : w.lid) &&
          (id.startsWith("diag-")
            ? w.exam || !!w.pendingDiag
            : id.startsWith("well-")
              ? w.view === "孔洞清潔" && id.startsWith(`well-${wellGroup}-`)
              : id.startsWith("group-")
                ? w.view === "攪拌棒"
                : w.view === "探針" && id.endsWith(w.target));
        button.style.left = `${(v.x * 0.5 + 0.5) * el.clientWidth}px`;
        const top = (-v.y * 0.5 + 0.5) * el.clientHeight;
        button.style.top = `${Math.max((current.current.topInset || 84) + (id.startsWith("tip-") ? 35 : 0), Math.min(el.clientHeight - 130, top))}px`;
        button.style.visibility =
          show && v.z < 1 && v.z > -1 ? "visible" : "hidden";
      });
      instrument.enclosures.animate();
      instrument.washBanks.animate(current.current.bottles, performance.now());
      // Shadows change with the instrument, not the orbiting camera. Throttle
      // their updates during short mechanical animations instead of each RAF.
      if (now - lastShadow > 150) {
        renderer.shadowMap.needsUpdate = true;
        lastShadow = now;
      }
      if (outline.selectedObjects.length) composer.render();
      else renderer.render(scene, camera);
      renderer.domElement.dataset.camera = camera.position
        .toArray()
        .map((n) => n.toFixed(4))
        .join(",");
      (current.current.guidanceTargets || []).forEach((id, i) => {
        const marker = guideHost.current?.children[i] as
          HTMLElement | undefined;
        if (!marker) return;
        const daily = dailyModel.targets.get(id),
          weekly = weeklyModel.targets.get(id);
        const object =
          daily?.object ||
          weekly ||
          instrument.washBanks.slots.get(id) ||
          instrument.groups.get(id as PartId);
        if (!object) {
          marker.style.visibility = "hidden";
          return;
        }
        const box = new T.Box3().setFromObject(object);
        const point = daily
          ? object.localToWorld(daily.point.clone())
          : box.getCenter(new T.Vector3());
        const v = point.project(camera);
        marker.style.left = `${(v.x * 0.5 + 0.5) * el.clientWidth}px`;
        marker.style.top = `${(-v.y * 0.5 + 0.5) * el.clientHeight}px`;
        marker.style.visibility =
          v.z < 1 && v.z > -1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.9
            ? "visible"
            : "hidden";
      });
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
      controls.removeEventListener("change", invalidate);
      controls.removeEventListener("start", cancel);
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
      outline.dispose();
      selectionBox.geometry.dispose();
      (selectionBox.material as T.Material).dispose();
      composer.dispose();
      light.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  useEffect(
    () =>
      engine.current?.select(
        props.selected,
        props.selectedSlot,
        props.selection,
      ),
    [props.selected, props.selectedSlot, props.selection],
  );
  useEffect(() => engine.current?.bottles(props.bottles), [props.bottles]);
  useEffect(
    () => engine.current?.troubleshooting(props.troubleshooting),
    [props.troubleshooting, props.troubleSelection],
  );
  useEffect(() => engine.current?.doors(props.doorState), [props.doorState]);
  useEffect(() => engine.current?.ise(props.iseState), [props.iseState]);
  useEffect(() => engine.current?.internal(props.internal), [props.internal]);
  useEffect(() => engine.current?.focus(props.request), [props.request]);
  useEffect(
    () => engine.current?.preparation(props.preparation),
    [
      props.preparation?.state,
      props.preparation?.view,
      props.preparation?.gate.ready,
      props.preparation?.gate.token,
      props.preparation?.exam,
      props.preparation?.freeSimulation,
    ],
  );
  useEffect(() => engine.current?.inset(), [props.rightInset]);
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
      data-camera-request={props.request.serial}
      data-selected={props.selected}
      data-preparation={!!props.preparation}
      data-internal={props.internal}
      data-ise-top={props.doorState["ise-top"]}
      data-ise-module={props.iseState.open}
      data-ise-top-rear={props.doorState["ise-top-rear"]}
      data-ise-middle={props.doorState["ise-middle"]}
      data-ise-bottom={props.doorState["ise-bottom"]}
      data-loader-door={props.doorState["loader-door"]}
      data-syringe-front={props.doorState["syringe-front"]}
      data-syringe-rear={props.doorState["syringe-rear"]}
      data-slot={props.selectedSlot ?? ""}
    >
      {!error && (
        <div ref={guideHost} className="guidance-markers" aria-label="練習目標">
          {(props.guidanceTargets || []).map((id) => (
            <span key={id} aria-label={`練習目標 ${id}`}>
              ◎ {partById[id as PartId]?.name || slotById[id]?.label || id}
            </span>
          ))}
        </div>
      )}
      {!error && (
        <div className="practice-markers weekly-markers" ref={weeklyMarkers}>
          {[
            ...weeklyWells,
            ...weeklyProbes.flatMap((id) => [`lock-${id}`, `tip-${id}`]),
            "group-R1S",
            "group-R2",
            "diag-front",
            "diag-sample",
            "diag-ise",
          ].map((id) => {
            const probe = id.replace(/^(lock|tip)-/, "");
            const n = props.weekly?.progress[probe] || 0;
            const label = props.weekly?.exam
              ? id.startsWith("lock-")
                ? `${probe} 鎖頭`
                : id.startsWith("tip-")
                  ? `${probe} 探針`
                  : id.startsWith("well-")
                    ? id.slice(5)
                    : id.startsWith("group-")
                      ? `${id === "group-R1S" ? "右側 12 支" : "左側 6 支"} mixer bar`
                      : `DIAG ${id.slice(5)}`
              : id.startsWith("well-")
                ? `${props.weekly?.wells.includes(id) ? "✓ " : ""}${id.slice(5)}`
                : id.startsWith("lock-")
                  ? n === 6
                    ? "鎖緊鎖頭"
                    : "旋開鎖頭"
                  : id.startsWith("tip-")
                    ? [
                        "先旋開鎖頭",
                        "等待液體滴完",
                        "提起取出",
                        "擦拭 tip",
                        "鐵絲通探針孔",
                        "裝回探針",
                        "請鎖緊鎖頭",
                        "已完成",
                      ][n]
                    : id.startsWith("group-")
                      ? `${id === "group-R1S" ? "右側 12 支" : "左側 6 支"}取下清潔並裝回`
                      : `DIAG ${id.slice(5)}`;
            return (
              <button
                key={id}
                data-weekly-id={id}
                aria-label={`模型 ${id} ${label}`}
                title={label}
                aria-pressed={
                  !props.weekly?.exam && id.startsWith("well-")
                    ? props.weekly?.wells.includes(id)
                    : undefined
                }
                onClick={() => props.onWeeklySelect(id)}
                disabled={!props.weekly?.exam && props.weekly?.busy}
              >
                {id.startsWith("well-") ? id.split("-").at(-1) : label}
              </button>
            );
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
