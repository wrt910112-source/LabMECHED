import Workstation from "./Workstation";
import { useWeeklyTraining, WeeklyPanel } from "./WeeklyTraining";
import { useDailyTraining } from "./DailyTraining";
import { ModelPractice } from "./ModelPractice";
import EnclosurePanel from "./EnclosurePanel";
import { closedDoors, type DoorState } from "./enclosures";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Box,
  Check,
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
  Settings2,
  ShieldCheck,
  Tag,
  X,
} from "lucide-react";
import Viewer, { type CameraRequest } from "./Viewer";
import { asset, partById, parts, views, type PartId } from "./data";
import DetergentPanel from "./DetergentPanel";
import SyringePanel from "./SyringePanel";
import IsePanel from "./IsePanel";
import type { IseState } from "./iseModel";
import {
  initialBottles,
  operateBottle,
  slotById,
  slotPosition,
  type CareMode,
  type BottleAction,
} from "./detergents";

export default function App() {
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
  const daily = useDailyTraining();
  const [modelPractice, setModelPractice] = useState(false),
    [practiceTarget, setPracticeTarget] = useState("R1-1");
  const [dailyRequest, setDailyRequest] = useState(0);
  const [modal, setModal] = useState<"help" | "photo" | "sources" | null>(null);
  const [doorState, setDoorState] = useState<DoorState>({ ...closedDoors });
  const [bottles, setBottles] = useState(initialBottles);
  const weekly = useWeeklyTraining(bottles, setBottles);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  useEffect(() => {
    if (!weeklyOpen) return;
    setInternal(weekly.lid);
    setDoorState((s) => ({ ...s, "ise-top": weekly.lid, "ise-top-rear": weekly.lid }));
  }, [weekly.lid, weeklyOpen, weekly.active]);
  const [iseState, setIseState] = useState<IseState>({
    open: false,
    removed: [],
  });
  const detailPanel = useRef<HTMLElement>(null);
  useEffect(() => {
    detailPanel.current?.scrollTo(0, 0);
  }, [selected]);
  const [careMode, setCareMode] = useState<CareMode>("daily");
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
    if (id === "console") setWorkstationOpen(true);
    if (
      id.startsWith("ise-") &&
      id !== "ise-reagents" &&
      id !== "ise-reference"
    ) {
      setIseState((s) => ({ ...s, open: true }));
      setDoorState((s) => ({ ...s, "ise-top": true }));
    }
    const part = partById[id];
    setSelected(id);
    setSelectedSlot(
      id === "r1"
        ? "r1-inner-1"
        : id === "r2"
          ? "r2-outer-1"
          : id === "sample"
            ? "sample-left-1"
            : null,
    );
    setBottlePanel(id === "r1" || id === "r2" || id === "sample");
    setPhotoIndex(0);
    setActiveView(id === "overview" ? "front" : id);
    if (part.internal) setInternal(true);
    setRequest((r) => ({
      eye: part.eye,
      target: part.target,
      serial: r.serial + 1,
    }));
  }, []);
  function practiceSelect(id: string) {
    setPracticeTarget(id);
    select(
      id.startsWith("R1")
        ? "r1"
        : id.startsWith("R2")
          ? "r2"
          : id.startsWith("Sample")
            ? "sample"
            : id === "左側" || id === "右側"
              ? "mixing"
              : "ise-cups",
    );
    setInternal(true);
  }
  function weeklyFocus(id: string) {
    if(!id.startsWith('diag-'))weekly.setTarget(id);
    if (slotById[id]) {
      selectSlot(id);
      setInternal(weekly.lid);
      return;
    }
    select(
      id === "ISE"
        ? "ise"
        : id === "U-L"
          ? "ise-cups"
          : id === "syringes"
            ? "syringes"
            : id.startsWith("Sample")
              ? "sample"
              : "mixing",
    );
    setInternal(weekly.lid);
    setDoorState((s) => ({ ...s, "ise-top": weekly.lid, "ise-top-rear": weekly.lid }));
    if(id.startsWith('group-')){
      const x=id==='group-R1S'?.426:1.115,z=id==='group-R1S'?-.29:-.17;
      setRequest(r=>({eye:[x,weekly.view==='孔洞清潔'?1.42:1.3,z-.32],target:[x,.99,z],serial:r.serial+1}));
    }
    if(id==='ISE')setRequest(r=>({eye:[-.4,1.48,-1.05],target:[-.04,1.09,-.44],serial:r.serial+1}));
    if(id.startsWith('diag-')){
      const x=id==='diag-ise'?.16:.77,z=id==='diag-front'?.67:id==='diag-ise'?.506:-.61;
      setRequest(r=>({eye:[x,1.35,z+(z>0?.55:-.55)],target:[x,.94,z],serial:r.serial+1}));
    }
  }
  function weeklyModelAction(id:string){
    if(id.startsWith('diag-')){weekly.runDiag(id.slice(5));return;}
    if(id.startsWith('well-')){weekly.cleanWell(id);return;}
    if(id.startsWith('lock-')||id.startsWith('tip-')){
      const probe=id.replace(/^(lock|tip)-/,'');
      weekly.setTarget(probe);weekly.setView('探針');
      const n=weekly.progress[probe]||0;
      if((id.startsWith('lock-')&&(n===0||n===6))||(id.startsWith('tip-')&&n>0&&n<6))weekly.step(probe);
      else weekly.setMessage(n===7?'此探針已裝回鎖緊。':'請依順序操作鎖頭與探針。');
      return;
    }
    if(id.startsWith('group-')){weekly.setView('攪拌棒');weekly.cleanGroup(id.slice(6));return;}
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
    setSelectedSlot(id);
    setBottlePanel(true);
    setPhotoIndex(0);
    setInternal(true);
    setActiveView(slot.module);
    setBottleMessage("");
    const position = slotPosition(id);
    setRequest((r) => ({
      target: position,
      eye: [
        position[0] + 0.2,
        1.38,
        position[2] + (slot.module === "sample" ? -0.52 : 0.52),
      ],
      serial: r.serial + 1,
    }));
  }, []);
  const operate = (action: BottleAction) => {
    if (!selectedSlot || bottleBusy) return;
    try {
      const next = operateBottle(bottles, selectedSlot, careMode, action);
      setBottles(next);
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
  const fullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await stage.current?.requestFullscreen();
  };
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="./" aria-label="AU5800 Lab 首頁">
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
          <div className="workspace-name">
            <span className="eyebrow">LEARNING WORKSPACE</span>
            <h2>儀器學習工作室</h2>
            <p>熟悉每個部件，從探索開始。</p>
          </div>
          <div className="section-label">學習模式</div>
          <nav className="mode-nav" aria-label="學習模式">
            <button
              className="mode-current"
              onClick={() => {
                setWeeklyOpen(false);
                setModelPractice(false);
              }}
            >
              <Box size={18} />
              <span>儀器導覽</span>
              <span className="live-dot" />
            </button>
            {["日保養", "周保養", "雙周保養", "障礙排除"].map((name, i) => (
              <button
                key={name}
                disabled={i > 1}
                onClick={() => {
                  if (i === 1) {
                    setWeeklyOpen(true);
                    weekly.setActive(true);
                    setWorkstationOpen(true);
                    setModelPractice(false);
                    return;
                  }
                  setWeeklyOpen(false);
                  setDailyRequest((n) => n + 1);
                  setWorkstationOpen(true);
                }}
              >
                <span className="mode-number">0{i + 1}</span>
                <span>{name}</span>
                <span className="coming">
                  {i < 2 ? "開始練習" : "尚未開放"}
                </span>
              </button>
            ))}
          </nav>
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
              <Viewer
                daily={daily}
                weekly={weeklyOpen ? weekly : undefined}
                onWeeklySelect={weeklyModelAction}
                practice={modelPractice}
                practiceTarget={practiceTarget}
                onPracticeSelect={practiceSelect}
                iseState={iseState}
                doorState={doorState}
                selected={selected}
                internal={internal}
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
            <aside
              ref={detailPanel}
              className="detail-panel"
              aria-label="部件說明"
            >
              {weeklyOpen ? (
                <WeeklyPanel
                  w={weekly}
                  bottles={bottles}
                  onFocus={weeklyFocus}
                  onComputer={() => setWorkstationOpen(true)}
                />
              ) : modelPractice ? (
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
                        Object.entries(initialBottles()).map(([id, value]) => [
                          id,
                          (slotById[id].module === "sample") ===
                          (selected === "sample")
                            ? value
                            : old[id],
                        ]),
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
                    selected === "sample") && (
                    <button
                      className="open-bottles"
                      onClick={() => setBottlePanel(true)}
                    >
                      <FlaskConical size={16} />
                      操作洗滌劑瓶與 {selected === "sample" ? 4 : 12} 孔槽位
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
                    selected === "ise-reagents" ||
                    selected === "ise-reference" ||
                    selected === "loader" ||
                    selected === "clean-solution") && (
                    <EnclosurePanel
                      loader={
                        selected === "loader" || selected === "clean-solution"
                      }
                      state={doorState}
                      onToggle={(id) => {
                        setDoorState((d) => ({ ...d, [id]: !d[id] }));
                        if (id === "ise-top" && doorState[id])
                          setIseState((s) => ({ ...s, open: false }));
                      }}
                    />
                  )}
                  {(selected === "ise" ||
                    (selected.startsWith("ise-") &&
                      selected !== "ise-reagents" &&
                      selected !== "ise-reference")) && (
                    <IsePanel
                      state={iseState}
                      onChange={(s) => {
                        setIseState(s);
                        if (s.open)
                          setDoorState((d) => ({ ...d, "ise-top": true }));
                        setInternal(true);
                      }}
                      selected={selected}
                      onSelect={select}
                    />
                  )}
                  {selected === "syringes" && (
                    <SyringePanel
                      checks={syringeChecks}
                      setChecks={setSyringeChecks}
                    />
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
                    <img src={asset(photo)} alt={`${p.name}實機參考照片`} />
                    <span>
                      <Expand size={14} />
                    </span>
                  </button>
                  {photos.length > 1 && (
                    <div className="photo-pagination" aria-label="參考照片切換">
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
                            (currentIndex + parts.length - 1) % parts.length
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
                        select(parts[(currentIndex + 1) % parts.length].id)
                      }
                    >
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              )}
            </aside>
          </div>
          <div className="lower-bar">
            <div className="internal-setting">
              <span className="setting-icon">
                <Settings2 size={20} />
              </span>
              <div>
                <strong>顯示內部構造</strong>
                <p>
                  {internal
                    ? "外蓋已隱藏，可探索內部部件"
                    : "隱藏外蓋，查看探針、試劑槽與內部模組"}
                </p>
              </div>
              <button
                className={`switch ${internal ? "checked" : ""}`}
                role="switch"
                aria-checked={internal}
                aria-label="顯示內部構造"
                onClick={() => setInternal((v) => !v)}
              >
                <span>{internal && <Check size={12} />}</span>
              </button>
            </div>
            <div className="learning-note">
              <ShieldCheck size={21} />
              <p>
                先認識位置，再練習操作。
                <span>可操作 R1／R2 洗滌劑瓶；完整保養情境將陸續加入。</span>
              </p>
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
                點選部件、標籤或左側清單，聚焦並查看說明。
              </p>
              <p>
                <Layers3 />
                「顯示內部構造」會隱藏外蓋，這是導覽功能，並非實際開蓋步驟。
              </p>
              <p>
                <RotateCcw />
                使用重設視角按鈕，回到整機總覽。
              </p>
            </div>
            <div className="modal-note">
              選取 R1／R2 可操作 12
              孔洗滌劑槽：點選瓶子或空槽後，可更換、補充或取出。槽位操作中的平日／周／雙周選項只切換允許放置的瓶子，完整保養關卡尚未開放。
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
      <Workstation
        weekly={weeklyOpen ? weekly : undefined}
        bottles={bottles}
        onWeeklyModel={(id) => {
          setWorkstationOpen(false);
          weeklyFocus(id);
        }}
        daily={daily}
        onModel={enterModel}
        dailyRequest={dailyRequest}
        open={workstationOpen}
        onExit={() => setWorkstationOpen(false)}
      />
    </div>
  );
}
