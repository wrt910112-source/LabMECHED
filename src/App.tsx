import { canHandleBottle } from "../shared/dailyScenario";
import { isTaskOpen } from "../shared/availability";
import { useAccountSession, refreshAccountSession } from "./accountSession";
import {
  TaskCenter,
  QuestLog,
  PartInformation,
  type TaskKind,
  type MissionKind,
} from "./SimulatorHud";
import { dailyQuests, weeklyQuests } from "./hudTasks";
import { ContextCovers } from "./ContextCovers";
import "./hud.css";
import { iseDiagZ } from "./iseLayout";

import { DailyTasksPanel } from "./DailyTasksPanel";
import Workstation from "./Workstation";
import ExamPortal from "./ExamPortal";
import { useWeeklyTraining, WeeklyPanel } from "./WeeklyTraining";
import { useDailyTraining } from "./DailyTraining";
import { ModelPractice, practiceIds } from "./ModelPractice";

import { closedDoors, type DoorId, type DoorState } from "./enclosures";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Box,
  ChevronRight,
  CircleHelp,
  Crosshair,
  Expand,
  FlaskConical,
  Layers3,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  RotateCcw,
  Rotate3D,
  Search,
  ShieldCheck,
  Tag,
  X,
} from "lucide-react";
import Viewer, { type CameraRequest, type SceneSelection } from "./Viewer";
import PreparationPanel from "./PreparationPanel";
import TroubleshootingRoom from "./TroubleshootingRoom";
import { useTroublePractice } from "./TroubleRuntime";
import type { ExamKind } from "../shared/exam";
import { preparationViews, type PreparationView } from "./preparationModel";
import {
  applyPreparation,
  initialPreparation,
  type PreparationAction,
} from "../shared/preparation";
import { asset, partById, parts, views, type PartId } from "./data";
import DetergentPanel from "./DetergentPanel";
import SyringePanel from "./SyringePanel";
import IsePanel from "./IsePanel";
import type { IseState } from "./iseModel";
import {
  initialBottles,
  operateBottle,
  slotById,
  slotCamera,
  type CareMode,
  type BottleAction,
} from "./detergents";

export default function App() {
  const accountSession = useAccountSession();
  const pendingPractice = useRef<{
    kind: MissionKind;
    restart: boolean;
  } | null>(null);
  useEffect(() => {
    const user = accountSession.user;
    if (
      user &&
      !user.mustChangePassword &&
      (user.role === "administrator" || user.profileComplete) &&
      pendingPractice.current
    ) {
      const request = pendingPractice.current;
      pendingPractice.current = null;
      setExamOpen(false);
      startAuthorizedTask(request.kind, false, request.restart);
    }
  }, [accountSession.user]);
  const [examOpen, setExamOpen] = useState(false),
    [examSceneActive, setExamSceneActive] = useState(false);
  const [sessionMode, setSessionMode] = useState<"explore" | TaskKind>(
    "explore",
  );
  const [taskCenterOpen, setTaskCenterOpen] = useState(false),
    [directoryOpen, setDirectoryOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false),
    [panelTab, setPanelTab] = useState<"info" | "actions" | "photo">("info");
  const [selection, setSelection] = useState<SceneSelection | null>(null),
    [currentQuest, setCurrentQuest] = useState("");
  const [requestedExam, setRequestedExam] = useState<ExamKind>("daily");
  const trouble = useTroublePractice();
  const [troubleOpen, setTroubleOpen] = useState(false);
  const [selected, setSelected] = useState<PartId>("overview"),
    [internal, setInternal] = useState(false),
    [labels, setLabels] = useState(true),
    [query, setQuery] = useState(""),
    [ready, setReady] = useState(false),
    [unavailable, setUnavailable] = useState(false),
    [zoom, setZoom] = useState(0),
    [photoIndex, setPhotoIndex] = useState(0),
    [activeView, setActiveView] = useState("front");
  const [workstationOpen, setWorkstationOpen] = useState(false);
  const [preparationView, setPreparationView] =
    useState<PreparationView | null>(null);
  const [preparationMessage, setPreparationMessage] = useState("");
  const [freePreparation, setFreePreparation] = useState(initialPreparation);
  const freePreparationGate = { ready: true, token: "free-preparation" };
  const freePreparationMode = sessionMode === "explore";
  useEffect(() => {
    setPreparationView(null);
    setPreparationMessage("");
  }, [sessionMode]);

  const [modelPractice, setModelPractice] = useState(false),
    [practiceTarget, setPracticeTarget] = useState("R1-1");
  const [workstationNavigation, setWorkstationNavigation] = useState<
    Record<string, { serial: number; route: string }>
  >({});
  const [workstationEpoch, setWorkstationEpoch] = useState({
    daily: 0,
    weekly: 0,
    explore: 0,
  });
  const [modal, setModal] = useState<"help" | "photo" | "sources" | null>(null);
  const [freeDoors, setFreeDoors] = useState<DoorState>({ ...closedDoors });
  const [dailyDoors, setDailyDoors] = useState<DoorState>({ ...closedDoors });
  const [weeklyDoors, setWeeklyDoors] = useState<DoorState>({ ...closedDoors });
  const doorState =
    sessionMode === "daily"
      ? dailyDoors
      : sessionMode === "weekly"
        ? weeklyDoors
        : freeDoors;
  const setDoorState =
    sessionMode === "daily"
      ? setDailyDoors
      : sessionMode === "weekly"
        ? setWeeklyDoors
        : setFreeDoors;
  const [freeBottles, setFreeBottles] = useState(initialBottles);
  const [dailyBottles, setDailyBottles] = useState(initialBottles);
  const [weeklyBottles, setWeeklyBottles] = useState(initialBottles);
  const freeDaily = useDailyTraining(freeBottles, setFreeBottles);
  const dailySession = useDailyTraining(dailyBottles, setDailyBottles);
  const weeklySession = useWeeklyTraining(weeklyBottles, setWeeklyBottles);
  const weekly = {
    ...weeklySession,
    reset: () => {
      setWorkstationOpen(false);
      setTaskCenterOpen(true);
    },
  };
  const daily =
    sessionMode === "daily"
      ? {
          ...dailySession,
          reset: () => {
            setWorkstationOpen(false);
            setTaskCenterOpen(true);
          },
        }
      : {
          ...freeDaily,
          reset: () => {
            setTaskCenterOpen(true);
          },
        };
  const preparationState = freePreparationMode
    ? freePreparation
    : daily.preparation;
  const preparationAccess = freePreparationMode
    ? freePreparationGate
    : daily.loadingGate;
  function prepare(action: PreparationAction) {
    if (freePreparationMode) {
      const result = applyPreparation(
        freePreparation,
        action,
        freePreparationGate,
        { freeSimulation: true },
      );
      setFreePreparation(result.state);
      setPreparationMessage(result.error);
      return !result.error;
    }
    const error = daily.prepare(action);
    setPreparationMessage(error);
    return !error;
  }
  const bottles =
    sessionMode === "daily"
      ? dailyBottles
      : sessionMode === "weekly"
        ? weeklyBottles
        : freeBottles;
  const setBottles =
    sessionMode === "daily"
      ? setDailyBottles
      : sessionMode === "weekly"
        ? setWeeklyBottles
        : setFreeBottles;
  const weeklyOpen = sessionMode === "weekly";
  const setWeeklyOpen = (value: boolean) =>
    setSessionMode(value ? "weekly" : "explore");
  const [freeIse, setFreeIse] = useState<IseState>({
    open: false,
    removed: [],
  });
  const [dailyIse, setDailyIse] = useState<IseState>({
    open: false,
    removed: [],
  });
  const [weeklyIse, setWeeklyIse] = useState<IseState>({
    open: false,
    removed: [],
  });
  const iseState =
    sessionMode === "daily"
      ? dailyIse
      : sessionMode === "weekly"
        ? weeklyIse
        : freeIse;
  const setIseState =
    sessionMode === "daily"
      ? setDailyIse
      : sessionMode === "weekly"
        ? setWeeklyIse
        : setFreeIse;
  const quests =
    sessionMode === "daily"
      ? dailyQuests(dailySession)
      : sessionMode === "weekly"
        ? weeklyQuests(weekly)
        : [];
  const activeQuest =
    quests.find((q) => q.id === currentQuest && !q.done && q.available) ||
    quests.find((q) => !q.done && q.available);
  const dailyCovers = daily.active && !weeklyOpen;
  const visibleMainLid = weeklyOpen
    ? weekly.lid
    : dailyCovers
      ? daily.instrument.mainLid
      : internal;
  const visibleIseState = {
    ...iseState,
    open: weeklyOpen
      ? weekly.iseModule
      : dailyCovers
        ? daily.instrument.iseModule
        : iseState.open,
  };
  const visibleDoors: DoorState = {
    ...doorState,
    ...(weeklyOpen
      ? { "ise-top": weekly.iseTop, "ise-top-rear": weekly.iseTop }
      : {}),
    ...(dailyCovers
      ? {
          "ise-top": daily.instrument.iseTop,
          "ise-top-rear": daily.instrument.iseTop,
          "ise-middle": !!daily.instrument.iseReagents,
          "ise-bottom": !!daily.instrument.iseReference,
          "syringe-front": !!daily.instrument.frontSyringe,
          "syringe-rear": !!daily.instrument.rearSyringe,
        }
      : {}),
  };
  function toggleMainCover() {
    if (weeklyOpen && weekly.busy) return;
    if (weeklyOpen) weekly.setLid(!weekly.lid);
    else if (dailyCovers)
      daily.setInstrument((s) => ({ ...s, mainLid: !s.mainLid }));
    else setInternal((v) => !v);
  }
  function toggleModuleCover() {
    if (weeklyOpen && weekly.busy) return;
    if (weeklyOpen) weekly.setIseModule(!weekly.iseModule);
    else if (dailyCovers)
      daily.setInstrument((s) => ({ ...s, iseModule: !s.iseModule }));
    else setIseState((s) => ({ ...s, open: !s.open }));
  }
  function toggleDoor(id: DoorId) {
    if (weeklyOpen && weekly.busy) return;
    if (weeklyOpen && (id === "ise-top" || id === "ise-top-rear")) {
      weekly.setIseTop(!weekly.iseTop);
      return;
    }
    if (dailyCovers && id !== "loader-door") {
      const key = (
        {
          "ise-top": "iseTop",
          "ise-top-rear": "iseTop",
          "ise-middle": "iseReagents",
          "ise-bottom": "iseReference",
          "syringe-front": "frontSyringe",
          "syringe-rear": "rearSyringe",
        } as const
      )[id];
      daily.setInstrument((s) => ({ ...s, [key]: !s[key] }));
      return;
    }
    setDoorState((s) => ({ ...s, [id]: !s[id] }));
  }
  const detailPanel = useRef<HTMLElement>(null);
  useEffect(() => {
    detailPanel.current?.scrollTo(0, 0);
  }, [selected]);
  const [careModes, setCareModes] = useState<
    Record<"explore" | TaskKind, CareMode>
  >({ explore: "daily", daily: "daily", weekly: "weekly" });
  const careMode = careModes[sessionMode];
  const setCareMode = (mode: CareMode) =>
    setCareModes((old) => ({ ...old, [sessionMode]: mode }));
  const [syringeChecks, setSyringeChecks] = useState<Record<string, string>>(
    {},
  );
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bottlePanel, setBottlePanel] = useState(false);
  const [bottleMessage, setBottleMessage] = useState("");
  const [bottleBusy, setBottleBusy] = useState(false);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (actionTimer.current) clearTimeout(actionTimer.current);
    },
    [],
  );
  const [request, setRequest] = useState<CameraRequest>({
    ...views[0],
    serial: 0,
  });
  const stage = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const p = partById[selected];
  const photos = [p.photo, ...(p.extraPhotos ?? [])];
  const photo = photos[photoIndex] ?? p.photo;
  const select = useCallback((id: PartId) => {
    setPreparationView(null);
    if (id === "console") setWorkstationOpen(true);
    if (id === "ise") setModelPractice(false);
    setSelected(id);
    setPanelOpen(id !== "overview");
    setPanelTab("info");
    setDirectoryOpen(false);
    setSelection(null);
    setSelectedSlot(null);
    setBottlePanel(false);
    setPhotoIndex(0);
    setActiveView(id === "overview" ? "front" : id);

    if (id === "console")
      setRequest((r) => ({ ...partById.console, serial: r.serial + 1 }));
  }, []);
  function practiceSelect(id: string) {
    setPracticeTarget(id);
    const partId: PartId =
      id === "ISE"
        ? "ise"
        : id.startsWith("R1")
          ? "r1"
          : id.startsWith("R2")
            ? "r2"
            : id.startsWith("Sample")
              ? "sample"
              : id === "左側" || id === "右側"
                ? "mixing"
                : "ise-cups";
    select(partId);
    setSelection({ partId, dailyId: id });
    setModelPractice(true);
    setSelectedSlot(null);
    setBottlePanel(false);
    setPanelTab("actions");
    setPanelOpen(true);
  }
  function weeklyFocus(id: string) {
    if (!id.startsWith("diag-")) weekly.setTarget(id);
    if (slotById[id]) {
      selectSlot(id);
      return;
    }
    const partId: PartId =
      id === "ISE"
        ? "ise"
        : id === "U-L"
          ? "ise-cups"
          : id === "syringes"
            ? "syringes"
            : id.startsWith("Sample")
              ? "sample"
              : "mixing";
    select(partId);
    setSelection({ partId, weeklyId: id });
    setPanelOpen(true);
    setPanelTab("actions");
    if (id.startsWith("group-")) {
      const x = id === "group-R1S" ? 0.426 : 1.115,
        z = id === "group-R1S" ? -0.29 : -0.17;
      setRequest((r) => ({
        eye: [x, weekly.view === "孔洞清潔" ? 1.42 : 1.3, z - 0.32],
        target: [x, 0.99, z],
        serial: r.serial + 1,
      }));
    }
    if (id === "ISE")
      setRequest((r) => ({
        eye: [-0.4, 1.48, -1.05],
        target: [-0.04, 1.09, -0.44],
        serial: r.serial + 1,
      }));
    if (id.startsWith("diag-")) {
      const x = id === "diag-ise" ? 0.16 : 0.77,
        z = id === "diag-front" ? 0.67 : id === "diag-ise" ? iseDiagZ : -0.61;
      setRequest((r) => ({
        eye: [x, 1.35, z + (z > 0 ? 0.55 : -0.55)],
        target: [x, 0.94, z],
        serial: r.serial + 1,
      }));
    }
  }
  function weeklyModelAction(id: string) {
    if (id.startsWith("diag-")) {
      weekly.runDiag(id.slice(5));
      return;
    }
    if (id.startsWith("well-")) {
      setSelection({ partId: "mixing", weeklyId: id });
      weekly.cleanWell(id);
      return;
    }
    if (id.startsWith("lock-") || id.startsWith("tip-")) {
      const probe = id.replace(/^(lock|tip)-/, "");
      weekly.setTarget(probe);
      weekly.setView("探針");
      const n = weekly.progress[probe] || 0;
      if (
        (id.startsWith("lock-") && (n === 0 || n === 6)) ||
        (id.startsWith("tip-") && n > 0 && n < 6)
      )
        weekly.step(probe);
      else
        weekly.setMessage(
          n === 7 ? "此探針已裝回鎖緊。" : "請依順序操作鎖頭與探針。",
        );
      return;
    }
    if (id.startsWith("group-")) {
      setSelection({ partId: "mixing", weeklyId: id });
      weekly.setView("攪拌棒");
      weekly.cleanGroup(id.slice(6));
      return;
    }
    weeklyFocus(id);
  }
  function enterModel(area: "probes" | "cups") {
    setWorkstationOpen(false);
    setModelPractice(true);
    practiceSelect(area === "cups" ? "U-L" : "R1-1");
  }
  const selectSlot = useCallback((id: string) => {
    const slot = slotById[id];
    if (!slot) return;
    setSelected(slot.module);
    setSelection({ partId: slot.module, slotId: id });
    setSelectedSlot(id);
    setBottlePanel(true);
    setPhotoIndex(0);
    setActiveView(slot.module);
    setBottleMessage("");
    setPanelOpen(true);
    setPanelTab("actions");
    setDirectoryOpen(false);
  }, []);
  const operate = (action: BottleAction) => {
    if (!selectedSlot || bottleBusy) return;
    try {
      if (
        sessionMode === "explore" &&
        slotById[selectedSlot].module === "ise" &&
        !visibleDoors["ise-top-rear"]
      )
        throw new Error("請先開啟 ISE 後方黑色上蓋。");
      if (daily.active && !weeklyOpen) {
        const ise = slotById[selectedSlot].module === "ise";
        if (
          !canHandleBottle(
            daily.instrument,
            slotById[selectedSlot].module,
            bottleBusy,
          )
        )
          throw new Error(
            ise
              ? "請開啟 ISE 黑色上蓋並等待 ISE 停止。"
              : "請先開啟分析單元主蓋。",
          );
      }
      const next = operateBottle(bottles, selectedSlot, careMode, action);
      if (daily.active && !weeklyOpen) daily.supplyChanged(selectedSlot, next);
      else setBottles(next);
      setBottleBusy(true);
      const label = slotById[selectedSlot].label;
      const result =
        action.kind === "remove"
          ? "已取出，槽位為空"
          : action.kind === "refill"
            ? "已補充至 100% 示意液量"
            : "已換入新瓶，示意液量 100%";
      actionTimer.current = setTimeout(() => {
        setBottleBusy(false);
        setBottleMessage(`${label}：${result}。`);
        actionTimer.current = null;
      }, 1150);
    } catch (error) {
      setBottleMessage(
        error instanceof Error ? error.message : "無法操作此瓶子",
      );
    }
  };
  const reset = () => {
    if (preparationView) {
      setRequest((r) => ({ ...preparationViews[preparationView], serial: r.serial + 1 }));
      return;
    }
    setSelected("overview");
    setSelectedSlot(null);
    setBottlePanel(false);
    setPhotoIndex(0);
    setActiveView("front");
    setRequest((r) => ({ ...views[0], serial: r.serial + 1 }));
  };
  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback(() => setUnavailable(true), []);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  const filtered = parts.filter(
    (p) =>
      p.id !== "overview" &&
      `${p.name} ${p.en} ${p.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const currentIndex = parts.findIndex((p) => p.id === selected);
  function clearSelection() {
    setSelected("overview");
    setSelection(null);
    setSelectedSlot(null);
    setPanelOpen(false);
    setBottlePanel(false);
  }
  function focusPart(id: PartId = selected) {
    if (weeklyOpen && id === "ise" && weekly.target === "ISE") {
      weeklyFocus("ISE");
      return;
    }
    const camera =
      selectedSlot && id === selected ? slotCamera(selectedSlot) : partById[id];
    setRequest((r) => ({ ...camera, serial: r.serial + 1 }));
  }
  function locateTarget(id: string) {
    if (id === "preparation") {
      setPreparationView("bench");
      setWorkstationOpen(false);
      return;
    }
    if (weeklyOpen && activeQuest) {
      const view = [
        "準備",
        "探針",
        "攪拌棒",
        "孔洞清潔",
        "攪拌棒",
        "W2 準備",
        "Analyzer Maintenance",
        "Photocal Monitor",
        "復原",
      ][Number(activeQuest.id.split("-")[1])];
      if (view) weekly.setView(view);
    }
    if (weeklyOpen && !partById[id as PartId] && !slotById[id]) {
      weeklyFocus(id);
      setPanelOpen(true);
      setPanelTab("actions");
      return;
    }
    if (slotById[id]) {
      selectSlot(id);
      setRequest((r) => ({ ...slotCamera(id), serial: r.serial + 1 }));
      return;
    }
    const part = partById[id as PartId]
      ? (id as PartId)
      : id.startsWith("R1")
        ? "r1"
        : id.startsWith("R2")
          ? "r2"
          : id.startsWith("Sample")
            ? "sample"
            : ["左側", "右側"].includes(id)
              ? "mixing"
              : id === "ISE"
                ? "ise"
                : "ise-cups";
    select(part);
    if (!partById[id as PartId] && sessionMode === "daily") {
      setPracticeTarget(id);
      setModelPractice(true);
      setSelectedSlot(null);
      setBottlePanel(false);
    }
    setPanelTab("actions");
    setRequest((r) => ({ ...partById[part], serial: r.serial + 1 }));
  }
  function inspect(hit: SceneSelection) {
    if (hit.slotId) selectSlot(hit.slotId);
    else select(hit.partId);
    setSelection(hit);
    setPanelOpen(true);
    setPanelTab(
      hit.doorId || hit.dailyId || hit.weeklyId || hit.slotId
        ? "actions"
        : "info",
    );
    if (sessionMode === "daily" && hit.dailyId) {
      setPracticeTarget(hit.dailyId);
      setModelPractice(true);
      setSelectedSlot(null);
      setBottlePanel(false);
    }
    if (weeklyOpen && hit.weeklyId) {
      const id = hit.weeklyId.replace(/^(lock|tip)-/, "");
      weekly.setTarget(id);
      if (id.startsWith("group-")) weekly.setView("攪拌棒");
      else if (id.startsWith("well-")) weekly.setView("孔洞清潔");
      else if (!id.startsWith("diag-")) weekly.setView("探針");
    }
  }
  async function startTask(kind: MissionKind, exam: boolean, restart: boolean) {
    if (!isTaskOpen(kind)) return;
    if (!exam) {
      const user = await refreshAccountSession();
      if (
        !user ||
        user.mustChangePassword ||
        (user.role === "learner" && !user.profileComplete)
      ) {
        pendingPractice.current = { kind, restart };
        setRequestedExam(kind);
        setTaskCenterOpen(false);
        setExamOpen(true);
        return;
      }
    }
    startAuthorizedTask(kind, exam, restart);
  }
  function startAuthorizedTask(
    kind: MissionKind,
    exam: boolean,
    restart: boolean,
  ) {
    setTaskCenterOpen(false);
    if (actionTimer.current) {
      clearTimeout(actionTimer.current);
      actionTimer.current = null;
    }
    setBottleBusy(false);
    setBottleMessage("");
    setDirectoryOpen(false);
    setCurrentQuest("");
    clearSelection();
    if (exam) {
      setRequestedExam(kind);
      setWorkstationOpen(false);
      setExamOpen(true);
      return;
    }
    if (kind === "troubleshooting") {
      setPreparationView(null);
      setWorkstationOpen(false);
      if (!trouble.active || restart) trouble.reset();
      else trouble.start();
      setTroubleOpen(true);
      return;
    }
    setSessionMode(kind);
    setModelPractice(kind === "daily");
    if (kind === "daily" && (!dailySession.active || restart)) {
      dailySession.reset();
      setCareModes((old) => ({ ...old, daily: "daily" }));
      setWorkstationEpoch((old) => ({ ...old, daily: old.daily + 1 }));
      setWorkstationNavigation((old) => ({
        ...old,
        daily: { serial: 0, route: "" },
      }));
      setDailyIse({ open: false, removed: [] });
      setDailyDoors({ ...closedDoors });
    }
    if (kind === "weekly" && (!weekly.active || restart)) {
      weeklySession.reset();
      setCareModes((old) => ({ ...old, weekly: "weekly" }));
      setWorkstationEpoch((old) => ({ ...old, weekly: old.weekly + 1 }));
      setWorkstationNavigation((old) => ({
        ...old,
        weekly: { serial: 0, route: "" },
      }));
      setWeeklyIse({ open: false, removed: [] });
      setWeeklyDoors({ ...closedDoors });
    }
    setRequest((r) => ({ ...views[0], serial: r.serial + 1 }));
    setWorkstationOpen(false);
  }
  function returnToExplore() {
    if (actionTimer.current) {
      clearTimeout(actionTimer.current);
      actionTimer.current = null;
    }
    setBottleBusy(false);
    setBottleMessage("");
    setSessionMode("explore");
    setModelPractice(false);
    setWorkstationOpen(false);
    setCurrentQuest("");
    clearSelection();
    setRequest((r) => ({ ...views[0], serial: r.serial + 1 }));
  }
  function questComputer(route: string) {
    if (route === "校正與品管上機") {
      setPreparationView("bench");
      setWorkstationOpen(false);
      return;
    }
    setWorkstationNavigation((old) => ({
      ...old,
      [sessionMode]: { serial: (old[sessionMode]?.serial || 0) + 1, route },
    }));
    setWorkstationOpen(true);
  }

  useEffect(() => {
    const keyboard = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        document.querySelector("dialog[open]")
      )
        return;
      const target = e.target as HTMLElement;
      if (target?.matches("input,textarea,select,[contenteditable=true]"))
        return;
      if (e.key.toLowerCase() === "q") {
        e.preventDefault();
        setTaskCenterOpen(true);
      }
      if (e.key === "Escape") {
        setDirectoryOpen(false);
        setPanelOpen(false);
        setSelected("overview");
        setSelection(null);
        setSelectedSlot(null);
        setBottlePanel(false);
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);
  const fullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await stage.current?.requestFullscreen();
  };
  return (
    <div
      className={`app-shell simulator-shell ${panelOpen ? "has-info" : ""} ${directoryOpen ? "directory-open" : ""}`}
      data-preparation={!!preparationView && !examSceneActive}
      data-mode={sessionMode}
    >
      <header className="topbar">
        <a
          className="brand"
          href="./"
          onClick={(e) => {
            e.preventDefault();
            reset();
          }}
          aria-label="AU5800 Lab 首頁"
        >
          <span className="brand-symbol">
            <Activity size={22} />
          </span>
          <span>
            AU5800<span className="brand-lab">LAB</span>
          </span>
        </a>
        <span className="top-divider" />
        <span className="top-subtitle">生化組・數位學習空間</span>
        <div className="top-right">
          <span className="hud-mode">
            {sessionMode === "explore"
              ? "自由探索"
              : sessionMode === "daily"
                ? "日保養 · 練習模式"
                : "周保養 · 練習模式"}
          </span>
          {sessionMode !== "explore" && (
            <button onClick={returnToExplore}>返回探索（保留練習）</button>
          )}
          <button
            className="hud-primary"
            onClick={() => setTaskCenterOpen(true)}
          >
            任務中心
          </button>
          <button
            aria-expanded={directoryOpen}
            onClick={() => setDirectoryOpen((v) => !v)}
          >
            部件目錄
          </button>
          <button
            className="exam-entry"
            onClick={() => {
              setWorkstationOpen(false);
              setExamOpen(true);
            }}
          >
            登入／考試
          </button>
          {sessionMode !== "weekly" && (
            <button
              onClick={() => {
                setPreparationView("bench");
                setWorkstationOpen(false);
              }}
            >
              備料工作台
            </button>
          )}
          <span className="version">
            EXPLORER <b>01</b>
          </span>
          <button className="help-btn" onClick={() => setModal("help")}>
            <CircleHelp size={17} />
            操作說明
          </button>
          <div className="avatar">教</div>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <header className="hud-drawer-title">
            <h2>部件目錄</h2>
            <button
              aria-label="關閉部件目錄"
              onClick={() => setDirectoryOpen(false)}
            >
              <X size={18} />
            </button>
          </header>
          <div className="module-heading">
            <span className="section-label">探索模組</span>
            <span className="count">{parts.length - 1}</span>
          </div>
          <label className="search">
            <Search size={15} />
            <input
              aria-label="搜尋部件"
              placeholder="搜尋部件或名稱"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button aria-label="清除搜尋" onClick={() => setQuery("")}>
                <X size={13} />
              </button>
            )}
          </label>
          <nav className="part-nav" aria-label="探索模組">
            <button
              className={`part-item overview-item ${selected === "overview" ? "active" : ""}`}
              onClick={() => select("overview")}
              aria-pressed={selected === "overview"}
            >
              <Layers3 size={16} />
              <span>整機總覽</span>
              <ChevronRight size={14} />
            </button>
            {filtered.map((part) => (
              <button
                key={part.id}
                data-testid={`part-${part.id}`}
                className={`part-item ${selected === part.id ? "active" : ""} ${part.parent && part.parent !== "overview" ? "child" : ""}`}
                onClick={() => select(part.id)}
                aria-pressed={selected === part.id}
              >
                <span className="part-number">{part.number}</span>
                <span>{part.name}</span>
                {selected === part.id && <ChevronRight size={14} />}
              </button>
            ))}
            {!filtered.length && <p className="no-results">找不到相符部件</p>}
            <details className="directory-targets">
              <summary>探針、攪拌及杯位</summary>
              {practiceIds
                .filter(
                  (id) =>
                    !query || id.toLowerCase().includes(query.toLowerCase()),
                )
                .map((id) => (
                  <button
                    key={id}
                    data-testid={`target-${id}`}
                    onClick={() =>
                      inspect({
                        partId: id.startsWith("R1")
                          ? "r1"
                          : id.startsWith("R2")
                            ? "r2"
                            : id.startsWith("Sample")
                              ? "sample"
                              : ["左側", "右側"].includes(id)
                                ? "mixing"
                                : id === "ISE"
                                  ? "ise"
                                  : "ise-cups",
                        dailyId: id,
                      })
                    }
                  >
                    {id} ·{" "}
                    {["S-H", "S-L", "U-H", "U-L"].includes(id)
                      ? "杯位"
                      : ["左側", "右側"].includes(id)
                        ? "攪拌單元"
                        : "探針"}
                  </button>
                ))}
            </details>
          </nav>
          <div className="sidebar-bottom">
            <span className="mini-book">
              <BookOpen size={16} />
            </span>
            <div>
              <strong>依據科內操作手冊</strong>
              <span>FTAB0C37S · 第 4 版</span>
            </div>
            <button
              aria-label="檢視資料來源"
              onClick={() => setModal("sources")}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </aside>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <div className="breadcrumb">
                學習工作室
                <ChevronRight size={12} />
                <span>儀器導覽</span>
              </div>
              <h1>
                認識你的 AU5800<span className="title-dot">.</span>
              </h1>
              <p>旋轉、放大，探索每一個模組與部件。</p>
            </div>
            <div className="explore-badge">
              <span />
              <span>{modelPractice ? "模型日保養操作" : "自由探索模式"}</span>
            </div>
          </div>
          <div className="explorer-layout">
            <section
              className="model-stage"
              ref={stage}
              aria-label="3D 儀器導覽"
            >
              <div className="stage-top">
                <div className="scene-title">
                  <Box size={17} />
                  <span>
                    AU5800 <b>/</b>{" "}
                    {selected === "overview" ? "整機總覽" : p.name}
                  </span>
                </div>
                <span className="render-badge">
                  <span className={ready ? "ready" : ""} />
                  {unavailable ? "3D 無法使用" : ready ? "3D LIVE" : "載入模型"}
                </span>
              </div>
              {!examSceneActive && !troubleOpen && (
                <Viewer
                  preparation={
                    preparationView
                      ? {
                          state: preparationState,
                          gate: preparationAccess,
                          freeSimulation: freePreparationMode,
                          view: preparationView,
                          exam: false,
                        }
                      : undefined
                  }
                  onPreparationSelect={(id) => {
                    prepare({
                      action: "select",
                      target: id,
                    });
                  }}
                  suspended={workstationOpen}
                  onInspect={inspect}
                  onClear={clearSelection}
                  selection={selection}
                  rightInset={
                    preparationView || panelOpen || sessionMode !== "explore"
                      ? Math.min(innerWidth * 0.25, 360)
                      : 0
                  }
                  guidanceTargets={
                    workstationOpen ? [] : activeQuest?.targets || []
                  }
                  daily={daily}
                  weekly={weeklyOpen ? weekly : undefined}
                  onWeeklySelect={weeklyModelAction}
                  practice={modelPractice}
                  practiceTarget={selected === "overview" ? "" : practiceTarget}
                  onPracticeSelect={practiceSelect}
                  iseState={visibleIseState}
                  doorState={visibleDoors}
                  selected={selected}
                  internal={visibleMainLid}
                  labels={labels}
                  request={request}
                  onSelect={select}
                  zoom={zoom}
                  onReady={onReady}
                  onError={onError}
                  bottles={bottles}
                  selectedSlot={selectedSlot}
                  onSlot={selectSlot}
                />
              )}
              <div
                className={`stage-caption ${selected !== "overview" ? "compact" : " "}`}
              >
                <span className="eyebrow">BECKMAN COULTER</span>
                <h2>{selected === "overview" ? "AU5800" : p.en}</h2>
                <p>
                  {selected === "overview"
                    ? "MODULAR CHEMISTRY ANALYZER"
                    : `COMPONENT ${p.number} / UNIT EXPLORER`}
                </p>
              </div>
              <div className="view-tabs" aria-label="視角快捷鍵">
                {views.map((v) => (
                  <button
                    key={v.id}
                    aria-pressed={activeView === v.id}
                    className={activeView === v.id ? "active" : ""}
                    onClick={() => {
                      setActiveView(v.id);
                      setRequest((r) => ({ ...v, serial: r.serial + 1 }));
                    }}
                  >
                    {v.id === "front" ? (
                      <Box size={14} />
                    ) : v.id === "top" ? (
                      <Layers3 size={14} />
                    ) : (
                      <Rotate3D size={14} />
                    )}{" "}
                    {v.label}
                  </button>
                ))}
                <span />
                {(["ise", "r1", "r2", "sample"] as PartId[]).map((id) => (
                  <button
                    key={id}
                    className={activeView === id ? "active" : ""}
                    aria-pressed={activeView === id}
                    onClick={() => select(id)}
                  >
                    {id === "sample" ? "樣品探針" : id.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="stage-tools">
                <button
                  title="放大"
                  aria-label="放大模型"
                  onClick={() => setZoom((z) => z + 1)}
                >
                  <Plus size={19} />
                </button>
                <button
                  title="縮小"
                  aria-label="縮小模型"
                  onClick={() => setZoom((z) => z - 1)}
                >
                  <Minus size={19} />
                </button>
                <span />
                <button title="重設視角" aria-label="重設視角" onClick={reset}>
                  <RotateCcw size={17} />
                </button>
                <button
                  title="全螢幕"
                  aria-label="全螢幕"
                  onClick={() =>
                    void fullscreen().catch(() => setModal("help"))
                  }
                >
                  <Maximize2 size={17} />
                </button>
              </div>
              <div className="axis-indicator">
                <span className="axis-n">後</span>
                <div>
                  <span>左</span>
                  <Crosshair size={25} />
                  <span>右</span>
                </div>
                <span>前</span>
              </div>
              <div className="stage-bottom">
                <div className="mouse-hint">
                  <MousePointer2 size={14} />
                  <span>拖曳旋轉</span>
                  <span className="hint-divider" />
                  <span>滾輪縮放</span>
                </div>
                <button
                  className={`label-toggle ${labels ? "on" : ""}`}
                  onClick={() => setLabels((v) => !v)}
                  aria-pressed={labels}
                >
                  <Tag size={14} />
                  {labels ? "標籤開啟" : "標籤關閉"}
                </button>
              </div>
            </section>
            <div className="hud-rail">
              {sessionMode !== "explore" && (
                <QuestLog
                  name={sessionMode === "daily" ? "日保養" : "周保養"}
                  quests={quests}
                  current={activeQuest?.id || ""}
                  onChoose={setCurrentQuest}
                  onLocate={locateTarget}
                  onComputer={questComputer}
                />
              )}
              {!panelOpen && selected !== "overview" && (
                <button
                  className="hud-restore"
                  onClick={() => setPanelOpen(true)}
                >
                  展開部件資訊
                </button>
              )}
              <aside
                hidden={!panelOpen}
                ref={detailPanel}
                className="detail-panel"
                aria-label="部件說明"
              >
                <header className="hud-card-header">
                  <strong>部件資訊</strong>
                  <div>
                    <button
                      aria-label="收合部件資訊"
                      onClick={() => setPanelOpen(false)}
                    >
                      −
                    </button>
                    <button aria-label="取消選取" onClick={clearSelection}>
                      <X size={16} />
                    </button>
                  </div>
                </header>
                <nav className="hud-info-tabs">
                  {(
                    [
                      ["info", "認識"],
                      ["actions", "操作"],
                      ["photo", "實機照片"],
                    ] as const
                  ).map(([id, name]) => (
                    <button
                      key={id}
                      aria-pressed={panelTab === id}
                      onClick={() => setPanelTab(id)}
                    >
                      {name}
                    </button>
                  ))}
                </nav>
                <button className="hud-focus" onClick={() => focusPart()}>
                  聚焦部件 · {p.name}
                </button>
                {panelTab !== "actions" ? (
                  <PartInformation
                    part={p}
                    tab={panelTab}
                    photoSelection={{
                      targetId: selection?.weeklyId || selection?.dailyId,
                      slotId: selectedSlot,
                    }}
                    detail={
                      selection?.weeklyId ||
                      selection?.dailyId ||
                      (selectedSlot ? slotById[selectedSlot]?.label : undefined)
                    }
                    status={
                      selectedSlot
                        ? `目前液量 ${Math.round((bottles[selectedSlot]?.level || 0) * 100)}%`
                        : `分析單元主蓋：${visibleMainLid ? "開啟" : "關閉"} · ISE module 鐵蓋：${visibleIseState.open ? "開啟" : "關閉"}`
                    }
                  />
                ) : (
                  <div className="hud-operation-content">
                    <h3>{p.name}</h3>
                    <ContextCovers
                      disabledReason={
                        weeklyOpen && weekly.busy
                          ? "儀器運轉中，請等待本次程序完成。"
                          : undefined
                      }
                      part={selected}
                      door={selection?.doorId}
                      mainOpen={visibleMainLid}
                      moduleOpen={visibleIseState.open}
                      doors={visibleDoors}
                      main={toggleMainCover}
                      module={toggleModuleCover}
                      toggle={toggleDoor}
                    />
                    {weeklyOpen ? (
                      <WeeklyPanel
                        w={weekly}
                        bottles={bottles}
                        onFocus={weeklyFocus}
                        onComputer={() => setWorkstationOpen(true)}
                      />
                    ) : modelPractice &&
                      !selectedSlot &&
                      ![
                        "ise-reagents",
                        "ise-reference",
                        "syringes",
                        "rear-syringes",
                        "console",
                        "loader",
                        "clean-solution",
                        "analyzer",
                      ].includes(selected) &&
                      (selected !== "ise" || practiceTarget === "ISE") ? (
                      <ModelPractice
                        d={daily}
                        target={practiceTarget}
                        setTarget={practiceSelect}
                        onComputer={() => setWorkstationOpen(true)}
                        onClose={() => setModelPractice(false)}
                      />
                    ) : bottlePanel &&
                      (selected === "r1" ||
                        selected === "r2" ||
                        selected === "sample" ||
                        selected === "ise") ? (
                      <DetergentPanel
                        module={selected}
                        selectedSlot={selectedSlot}
                        bottles={bottles}
                        mode={careMode}
                        busy={bottleBusy}
                        disabledReason={
                          sessionMode === "explore" &&
                          selected === "ise" &&
                          !visibleDoors["ise-top-rear"]
                            ? "請先開啟 ISE 後方黑色上蓋。"
                            : daily.active &&
                                (selected === "ise"
                                  ? !daily.instrument.iseTop
                                  : !daily.instrument.mainLid)
                              ? selected === "ise"
                                ? "請開啟 ISE 黑色上蓋並等待 ISE 停止。"
                                : "請先開啟分析單元主蓋。"
                              : undefined
                        }
                        message={bottleMessage}
                        onMode={(mode) => {
                          setCareMode(mode);
                          setBottleMessage(
                            "已切換配置；現有瓶子保留，請依需要手動更換。",
                          );
                        }}
                        onSlot={selectSlot}
                        onAction={operate}
                        onBack={() => setBottlePanel(false)}
                        onReset={() => {
                          setBottles((old) =>
                            Object.fromEntries(
                              Object.entries(initialBottles()).map(
                                ([id, value]) => [
                                  id,
                                  (slotById[id].module === "sample") ===
                                  (selected === "sample")
                                    ? value
                                    : old[id],
                                ],
                              ),
                            ),
                          );
                          setCareMode("daily");
                          setBottleMessage(
                            selected === "sample"
                              ? "已重設 Sample 平日 4 瓶配置。"
                              : "已重設平日 6 瓶配置。",
                          );
                        }}
                      />
                    ) : (
                      <>
                        {(selected === "r1" ||
                          selected === "r2" ||
                          selected === "sample" ||
                          selected === "ise") && (
                          <button
                            className="open-bottles"
                            onClick={() => setBottlePanel(true)}
                          >
                            <FlaskConical size={16} />
                            操作洗滌劑瓶與{" "}
                            {selected === "ise"
                              ? 2
                              : selected === "sample"
                                ? 4
                                : 12}{" "}
                            孔槽位
                          </button>
                        )}
                        <div className="detail-header">
                          <span className="eyebrow">COMPONENT GUIDE</span>
                          <span>
                            {p.number} <b>/ {parts.length - 1}</b>
                          </span>
                        </div>
                        <div className="detail-title">
                          <span className="component-icon">
                            {selected === "overview" ? (
                              <Box size={23} />
                            ) : (
                              <FlaskConical size={23} />
                            )}
                          </span>
                          <h2>{p.name}</h2>
                          <p>{p.en}</p>
                        </div>
                        <div className="detail-tags">
                          {p.tags.map((t) => (
                            <span key={t}>{t}</span>
                          ))}
                        </div>
                        <p className="description" aria-live="polite">
                          {p.description}
                        </p>
                        {(selected === "ise" ||
                          (selected.startsWith("ise-") &&
                            selected !== "ise-reagents" &&
                            selected !== "ise-reference")) && (
                          <IsePanel
                            state={visibleIseState}
                            onChange={(s) => {
                              setIseState(s);
                              if (weeklyOpen) weekly.setIseModule(s.open);
                              else if (dailyCovers)
                                daily.setInstrument((old) => ({
                                  ...old,
                                  iseModule: s.open,
                                }));
                            }}
                            selected={selected}
                            onSelect={select}
                          />
                        )}
                        {daily.active &&
                          [
                            "syringes",
                            "rear-syringes",
                            "ise-reagents",
                            "ise-reference",
                          ].includes(selected) && (
                            <DailyTasksPanel
                              guidance
                              section={
                                selected.includes("syringes")
                                  ? "syringes"
                                  : "ise"
                              }
                              tasks={daily.tasks}
                              instrument={daily.instrument}
                              bottles={bottles}
                              command={(c) =>
                                setBottleMessage(daily.taskAction(c))
                              }
                              cover={(id, open) =>
                                daily.setInstrument((s) => ({
                                  ...s,
                                  [id]: open,
                                }))
                              }
                              refill={(id) =>
                                setBottleMessage(daily.refill(id))
                              }
                              focus={(id) => select(id as PartId)}
                            />
                          )}
                        {bottleMessage && daily.active && (
                          <p role="status">{bottleMessage}</p>
                        )}
                        {selected === "syringes" && !daily.active && (
                          <SyringePanel
                            checks={syringeChecks}
                            setChecks={setSyringeChecks}
                          />
                        )}
                        {selected === "rear-syringes" && !daily.active && (
                          <button
                            onClick={() =>
                              setDoorState((s) => ({
                                ...s,
                                [selected === "rear-syringes"
                                  ? "syringe-rear"
                                  : "syringe-front"]:
                                  !s[
                                    selected === "rear-syringes"
                                      ? "syringe-rear"
                                      : "syringe-front"
                                  ],
                              }))
                            }
                          >
                            開關 syringe 櫃門
                          </button>
                        )}
                        <div className="photo-heading">
                          <span>
                            {selected.startsWith("ise-") &&
                            selected !== "ise-reagents" &&
                            selected !== "ise-reference"
                              ? "ISE 位置參考（非部件特寫）"
                              : selected === "syringes"
                                ? "整機櫃體位置參考（非注射器特寫）"
                                : "實機對照"}
                          </span>
                          <span>REFERENCE PHOTO</span>
                        </div>
                        <button
                          className="reference-photo"
                          onClick={() => setModal("photo")}
                          aria-label="放大實機照片"
                        >
                          <img
                            src={asset(photo)}
                            alt={`${p.name}實機參考照片`}
                          />
                          <span>
                            <Expand size={14} />
                          </span>
                        </button>
                        {photos.length > 1 && (
                          <div
                            className="photo-pagination"
                            aria-label="參考照片切換"
                          >
                            {photos.map((name, i) => (
                              <button
                                key={name}
                                aria-label={`切換參考照片 ${i + 1}`}
                                aria-pressed={i === photoIndex}
                                onClick={() => setPhotoIndex(i)}
                              >
                                {i + 1}
                              </button>
                            ))}
                            <span>
                              {photoIndex + 1} / {photos.length}
                            </span>
                          </div>
                        )}
                        <div className="reference-credit">
                          <span />
                          <span>檢驗科生化組提供</span>
                        </div>
                        <button
                          className="source-link"
                          onClick={() => setModal("sources")}
                        >
                          <BookOpen size={16} />
                          <div>
                            <span>操作手冊 · 第 4 版</span>
                            <strong>參考頁碼 {p.pages}</strong>
                          </div>
                          <ChevronRight size={15} />
                        </button>
                        <div className="detail-tip">
                          <MousePointer2 size={15} />
                          <p>
                            點選左側模組或模型上的部件，
                            <br />
                            查看對應位置與實機照片。
                          </p>
                        </div>
                        <div className="detail-navigation">
                          <button
                            aria-label="上一個部件"
                            onClick={() =>
                              select(
                                parts[
                                  (currentIndex + parts.length - 1) %
                                    parts.length
                                ].id,
                              )
                            }
                          >
                            <ArrowLeft size={16} />
                          </button>
                          <span>探索下一個部件</span>
                          <button
                            aria-label="下一個部件"
                            onClick={() =>
                              select(
                                parts[(currentIndex + 1) % parts.length].id,
                              )
                            }
                          >
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </aside>
            </div>
          </div>
          <footer className="page-footer">
            <span>
              <span className="footer-dot" />
              教學示意模型 · 細部比例依照片估算
            </span>
            <span>
              AU5800 LEARNING LAB <b>v0.9</b>
            </span>
          </footer>
        </main>
      </div>
      <dialog
        ref={dialog}
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === dialog.current) setModal(null);
        }}
        className={modal === "photo" ? "photo-dialog" : ""}
      >
        <button
          className="dialog-close"
          aria-label="關閉視窗"
          onClick={() => setModal(null)}
        >
          <X size={20} />
        </button>
        {modal === "photo" && (
          <>
            <h2>{p.name} · 實機對照</h2>
            <img
              className="large-photo"
              src={asset(photo)}
              alt={`${p.name}實機參考照片放大`}
            />
            <p>檢驗科生化組提供</p>
          </>
        )}
        {modal === "help" && (
          <>
            <span className="eyebrow">GETTING STARTED</span>
            <h2>從一個部件開始探索</h2>
            <div className="help-grid">
              <p>
                <Rotate3D />
                按住滑鼠左鍵拖曳，旋轉儀器。
              </p>
              <p>
                <Search />
                使用滾輪或 ＋／− 按鈕縮放。
              </p>
              <p>
                <MousePointer2 />
                點選部件或部件目錄查看說明；按「聚焦部件」定位。右鍵拖曳可平移。
              </p>
              <p>
                <Layers3 />
                選取相關機殼，在「操作」頁籤開關蓋子或櫃門；切換視角不會自動開蓋。
              </p>
              <p>
                <RotateCcw />
                使用重設視角按鈕，回到整機總覽。
              </p>
            </div>
            <div className="modal-note">
              選取 R1／R2 可操作 12
              孔洗滌劑槽：點選瓶子或空槽後，可更換、補充或取出。槽位操作中的平日／周／雙周選項只切換允許放置的瓶子；完整保養與UIBC障礙排除請由任務中心進入。雙周保養尚未開放。
            </div>
          </>
        )}
        {modal === "sources" && (
          <>
            <span className="eyebrow">SOURCE NOTES</span>
            <h2>模型資料來源</h2>
            <p className="source-intro">
              FTAB0C37S Beckman Coulter AU5800 生化分析儀操作手冊，第 4 版，共
              41 頁。
            </p>
            <ul className="sources-list">
              <li>
                <strong>第 3 頁</strong>整機與模組尺寸；以公尺為模型單位。
              </li>
              <li>
                <strong>第 7–8 頁</strong>
                主要部位圖解；圖中為多單元配置，本模型採實機照片的單分析單元配置。
              </li>
              <li>
                <strong>第 25–38 頁</strong>保養涉及的部件名称與位置。
              </li>
              <li>
                <strong>科內提供照片</strong>
                整機外觀、ISE、R1／R2、樣品探針及洗滌劑位置。
              </li>
            </ul>
            <div className="manual-thumbs">
              <a
                href={asset("manual-7-0.jpg")}
                target="_blank"
                rel="noreferrer"
              >
                <img src={asset("manual-7-0.jpg")} alt="手冊第7頁部位圖" />第 7
                頁部位圖 ↗
              </a>
              <a
                href={asset("manual-8-0.jpg")}
                target="_blank"
                rel="noreferrer"
              >
                <img src={asset("manual-8-0.jpg")} alt="手冊第8頁部位圖" />第 8
                頁部位圖 ↗
              </a>
            </div>
            <div className="modal-note">
              <strong>待核對與簡化範圍</strong>
              <p>
                未提供零件工程尺寸，細部比例、管線走向及相對高度為示意。ISE
                照片僅確認一組試劑瓶，手冊另提 Cell 1／Cell
                2；本版不推定未拍到的第二組配置。攪拌棒與噴嘴僅呈現簡化組件，尚未製作完整數量及拆裝結構。
              </p>
            </div>
          </>
        )}
      </dialog>
      {preparationView && !examSceneActive && (
        <div hidden={workstationOpen}>
          <PreparationPanel
            disabled={workstationOpen}
            state={preparationState}
            gate={preparationAccess}
            freeSimulation={freePreparationMode}
            view={preparationView}
            onView={(view) => {
              setPreparationView(view);
              setRequest((r) => ({ ...preparationViews[view], serial: r.serial + 1 }));
            }}
            feedback={preparationMessage}
            onClose={() => setPreparationView(null)}
            onComputer={() => questComputer("Rack Requisition")}
            onAction={prepare}
          />
        </div>
      )}
      {(["explore", "daily", "weekly"] as const).map((mode) => (
        <Workstation
          key={`${mode}-${workstationEpoch[mode]}`}
          active={sessionMode === mode}
          weekly={mode === "weekly" ? weekly : undefined}
          bottles={
            mode === "daily"
              ? dailyBottles
              : mode === "weekly"
                ? weeklyBottles
                : freeBottles
          }
          onWeeklyModel={(id) => {
            setWorkstationOpen(false);
            if (mode === "weekly") weeklyFocus(id);
            else if (mode === "daily" && practiceIds.includes(id)) {
              setModelPractice(true);
              practiceSelect(id);
              if (id === "ISE")
                setRequest((r) => ({ ...partById.ise, serial: r.serial + 1 }));
            } else if (slotById[id]) selectSlot(id);
            else if (partById[id as PartId]) select(id as PartId);
          }}
          daily={
            mode === "daily"
              ? {
                  ...dailySession,
                  reset: () => {
                    setWorkstationOpen(false);
                    setTaskCenterOpen(true);
                  },
                }
              : {
                  ...freeDaily,
                  reset: () => {
                    setWorkstationOpen(false);
                    setTaskCenterOpen(true);
                  },
                }
          }
          onModel={enterModel}
          onPreparation={() => {
            setWorkstationOpen(false);
            setPreparationView("bench");
          }}
          dailyRequest={workstationNavigation[mode]?.serial || 0}
          requestedRoute={workstationNavigation[mode]?.route || ""}
          guidance={
            workstationOpen && sessionMode === mode
              ? activeQuest?.label
              : undefined
          }
          guideControls={sessionMode === mode ? activeQuest?.controls : []}
          open={workstationOpen && sessionMode === mode}
          onExit={() => {
            if (sessionMode === mode) setWorkstationOpen(false);
          }}
        />
      ))}
      <TaskCenter
        open={taskCenterOpen}
        onClose={() => setTaskCenterOpen(false)}
        onStart={startTask}
        initialKind={sessionMode === "weekly" ? "weekly" : "daily"}
        hasDraft={(kind) =>
          kind === "daily"
            ? dailySession.active
            : kind === "weekly"
              ? weekly.active
              : trouble.active
        }
      />
      <ExamPortal
        open={examOpen}
        requestedKind={requestedExam}
        onSceneActive={setExamSceneActive}
        onClose={() => {
          pendingPractice.current = null;
          setExamOpen(false);
        }}
      />
      {troubleOpen && (
        <TroubleshootingRoom
          state={trouble.state}
          feedback={trouble.feedback}
          onAction={trouble.act}
          onReset={trouble.reset}
          onReturn={() => {
            setTroubleOpen(false);
            setTaskCenterOpen(true);
          }}
        />
      )}
    </div>
  );
}
