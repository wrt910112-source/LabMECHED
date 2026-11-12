import { useEffect, useRef, useState } from "react";
import {
  materials,
  materialById,
  materialBottles,
  preparationRequirements,
  preparationScenario,
  rackKinds,
  rackNames,
  type MaterialKind,
} from "../shared/materialCatalog";
import {
  cupFilled,
  preparationProgress,
  type PreparationState,
  type PreparationGate,
  type PreparationAction,
} from "../shared/preparation";
import type { PreparationView } from "./preparationModel";
import { asset } from "./data";
import "./preparation.css";
export default function PreparationPanel({
  state,
  gate,
  exam = false,
  freeSimulation = false,
  disabled = false,
  feedback = "",
  view,
  onView,
  onAction,
  onClose,
  onComputer,
}: {
  feedback?: string;
  state: PreparationState;
  gate: PreparationGate;
  exam?: boolean;
  freeSimulation?: boolean;
  disabled?: boolean;
  view: PreparationView;
  onView: (v: PreparationView) => void;
  onAction: (a: PreparationAction) => boolean | Promise<boolean>;
  onClose: () => void;
  onComputer: () => void;
}) {
  const [phase, setPhase] = useState(0),
    [cupId, setCupId] = useState(state.selectedCup || "cup-1"),
    [rack, setRack] = useState<MaterialKind>("RB"),
    [slot, setSlot] = useState(1);
  const [filter, setFilter] = useState("全部"),
    [search, setSearch] = useState(""),
    [localBusy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [materialOpen, setMaterialOpen] = useState(true);
  const locked = useRef(false),
    photo = useRef<HTMLDialogElement>(null),
    panel = useRef<HTMLElement>(null);
  const currentMaterial = state.source ? materialById[state.source] : null,
    cup = state.cups.find((c) => c.id === cupId)!;
  const progress = preparationProgress(state, gate);
  useEffect(() => {
    if (state.selectedCup) setCupId(state.selectedCup);
  }, [state.selectedCup]);
  useEffect(() => {
    const [kind, id, n] = state.selection?.split(":") || [];
    if (kind === "source") setPhase(0);
    if (kind === "cup") setCupId(id);
    if (kind === "rack" || kind === "slot") {
      setRack(id as MaterialKind);
      if (n) setSlot(Number(n));
    }
  }, [state.selection]);
  async function run(a: PreparationAction) {
    if (locked.current || disabled) return;
    locked.current = true;
    setBusy(true);
    setNotice("");
    try {
      const ok = await onAction(a);
      if (ok) {
        setNotice(a.action === "select" ? "已選取物件。" : "操作已記錄。");
        if (a.action === "aspirate" || a.action === "dispense") setPhase(1);
        if (a.action === "place") setPhase(2);
        if (a.action === "stage" || a.action === "push") setPhase(3);
      }
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const busy = disabled || localBusy,
    blocked = busy || !gate.ready;
  const primary: PreparationAction =
    phase === 0
      ? { action: "aspirate" }
      : phase === 1
        ? { action: state.pipette ? "dispense" : "aspirate", target: cupId }
        : phase === 2
          ? { action: "place", target: cupId, rack, slot }
          : state.racks[rack].location === "entry"
            ? { action: "push", rack }
            : { action: "stage", rack };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() !== "e" ||
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.defaultPrevented ||
        [...document.querySelectorAll("dialog[open]")].some(
          (dialog) => !dialog.contains(panel.current),
        ) ||
        (e.target instanceof HTMLElement &&
          e.target.closest("input,select,textarea,[contenteditable=true]"))
      )
        return;
      if (!blocked) {
        e.preventDefault();
        void run(primary);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const rawCounts = [
    state.cups.filter((c) => (freeSimulation ? !!c.materialId : cupFilled(c)))
      .length,
    state.cups.filter((c) => c.rack).length,
    state.cups.filter(
      (c) => c.rack && state.racks[c.rack].location === "loaded",
    ).length,
  ];
  return (
    <section
      ref={panel}
      className="preparation-hud"
      aria-label="校正與品管備料"
      data-exam={exam}
      data-free-simulation={freeSimulation}
      data-phase={phase}
      data-saving={localBusy}
    >
      <nav className="prep-top hud-card" aria-label="備料工作區">
        <strong>
          {freeSimulation ? "自由備料模擬" : "校正與品管上機"}
          <small>
            {freeSimulation
              ? "FREE EXPLORATION · LAB SIM"
              : "FIXED SIXTEEN · LAB SIM"}
          </small>
        </strong>
        <div className="prep-tabs">
          {["選取來源", "分裝", "裝架", "上機"].map((s, i) => (
            <button
              key={s}
              aria-pressed={phase === i}
              onClick={() => {
                setPhase(i);
                if (i === 3) onView("loading");
              }}
            >
              {String(i + 1).padStart(2, "0")} {s}
            </button>
          ))}
        </div>
        <button aria-pressed={view === "bench"} onClick={() => onView("bench")}>
          備料工作台
        </button>
        <button
          aria-pressed={view === "loading"}
          onClick={() => onView("loading")}
        >
          查看進樣區
        </button>
        <button
          aria-pressed={view === "instrument"}
          onClick={() => onView("instrument")}
        >
          查看儀器
        </button>
        <button onClick={onClose}>返回儀器</button>
      </nav>
      {view === "loading" && (
        <p className="prep-loading-route hud-card">
          左側進架 → 儀器內運送 → 右側出架
        </p>
      )}
      {!freeSimulation && (
        <details className="prep-requirements hud-card" open>
          <summary>任務準備清單</summary>
          <p>
            本次合計：<strong>3 架／16 杯</strong>
          </p>
          <div className="prep-rack-requirements">
            {rackKinds.map((kind) => {
              const items = preparationRequirements.filter(
                (r) => r.rack === kind,
              );
              return (
                <button
                  key={kind}
                  aria-pressed={rack === kind}
                  data-rack={kind}
                  onClick={() => {
                    setRack(kind);
                    setPhase(2);
                    void run({ action: "select", target: `rack:${kind}` });
                  }}
                >
                  <span>{rackNames[kind]} × 1</span>
                  <b>杯 × {items.length}</b>
                </button>
              );
            })}
          </div>
          <p>{rackNames[rack]}本次需要：</p>
          <ul aria-label="所選檢體架需求">
            {preparationRequirements
              .filter((r) => r.rack === rack)
              .map((r) => {
                const item = progress.items.find((x) => x.id === r.id);
                return (
                  <li key={r.id}>
                    {r.label}
                    <small>
                      {item?.loaded
                        ? "已推入"
                        : item?.racked
                          ? "已裝架"
                          : item?.dispensed
                            ? "已分裝"
                            : "待準備"}
                    </small>
                  </li>
                );
              })}
          </ul>
          <button onClick={() => onView("bench")}>在工作台顯示位置</button>
        </details>
      )}
      <aside
        className="prep-rail"
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <section className="hud-card prep-progress" aria-label="備料操作進度">
          <h2>
            {freeSimulation ? "自由探索 · 備料操作" : "第13組 · 校正與品管上機"}
          </h2>
          <p className="prep-warning">
            {freeSimulation
              ? "可任選材料、容器及架色，直接模擬吸取、加入、裝架及上機。不計分，不要求完成十六份或事先完成日保養與 Rack 登記。"
              : preparationScenario.disclaimer}
          </p>
          {!exam && !gate.ready && (
            <p className="prep-warning" role="status">
              請完成有效的前十二組保養及 Rack 登記，備料操作才會開放。
            </p>
          )}
          <div className="prep-counts">
            {["分裝", "裝架", "推入"].map((label, i) => (
              <span key={label}>
                {label}
                {exam || freeSimulation ? "操作" : "進度"}
                <b>
                  {exam || freeSimulation
                    ? rawCounts[i]
                    : [progress.dispensed, progress.racked, progress.loaded][i]}
                  {!freeSimulation && " / 16"}
                </b>
              </span>
            ))}
          </div>
          {!exam && !freeSimulation && (
            <progress value={progress.completed} max={48} />
          )}
          <p>
            {freeSimulation
              ? "教學示意孔位 · 可自行選擇架色及空位；分裝量未設定。操作狀態與日保養練習分開保存。"
              : "教學示意孔位 · 同色架任意空位；正式架位及分裝量未設定。"}
          </p>
          {!freeSimulation && (
            <details>
              <summary>本次備料需求單 · RB 1 / CALI 5 / QC 10</summary>
              <ul>
                {preparationRequirements.map((r) => (
                  <li key={r.id}>
                    {r.label} · {rackNames[r.rack]}
                    {!exam &&
                      ` · ${progress.items.find((x) => x.id === r.id)?.loaded ? "已推入" : progress.items.find((x) => x.id === r.id)?.racked ? "已裝架" : progress.items.find((x) => x.id === r.id)?.dispensed ? "已分裝" : "待操作"}`}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button onClick={onComputer}>查看 Rack Requisition</button>
          {!exam && !freeSimulation && progress.done && (
            <p className="prep-success">
              本組上機操作完成。校正結果／QC
              結果尚未執行；身份、期限、劑量及正式架位核對狀態另列。
            </p>
          )}
        </section>
        <section className="hud-card prep-controls" aria-label="備料情境操作">
          <h3>
            操作中{" "}
            <small>
              {localBusy
                ? "保存中…"
                : disabled
                  ? "目前為唯讀狀態"
                  : "E · 目前操作"}
            </small>
          </h3>
          <p className="prep-cup-status" role="status" aria-live="polite">
            目前選取：杯 {state.cups.findIndex((c) => c.id === cupId) + 1}
            <br />
            {cup.materialId ? materialById[cup.materialId].name : "空杯"}
            {cup.materialId && ` · ${cupFilled(cup) ? "已完成分裝" : "分裝中"}`}
            <br />
            {cup.rack
              ? `${rackNames[cup.rack]} · 孔位 ${cup.slot} · ${{ bench: "工作台", entry: "左側進樣區", loaded: "已推入儀器，右側出架" }[state.racks[cup.rack].location]}`
              : "位置：備料工作台"}
            <small>可隨時點選 3D 杯子查看狀態。</small>
          </p>
          <p>
            已選來源：{currentMaterial?.name || "尚未選取"}
            <br />
            移液器：
            {state.pipette
              ? `${materialById[state.pipette.materialId].name} · ${materialById[state.pipette.materialId].dose ? `剩餘 ${state.pipette.remaining} 滴` : "一份示意來源液，分裝量未設定"}`
              : "空"}
          </p>
          <label>
            容器{" "}
            <select
              aria-label="備料容器"
              value={cupId}
              disabled={busy}
              onChange={(e) => {
                setCupId(e.target.value);
                void run({ action: "select", target: `cup:${e.target.value}` });
              }}
            >
              {state.cups.map((c, i) => (
                <option key={c.id} value={c.id}>
                  杯 {i + 1} ·{" "}
                  {c.materialId
                    ? `${materialById[c.materialId].name}${materialById[c.materialId].dose ? ` ${c.additions}/2 滴` : ""}`
                    : "空杯"}
                </option>
              ))}
            </select>
          </label>
          {cup.materialId && (
            <p>
              杯內來源：{materialById[cup.materialId].name} ·{" "}
              {cup.concentration ? `${cup.concentration} · ` : ""}
              {cup.rack ? `${rackNames[cup.rack]} ${cup.slot}` : "工作台"}
              <br />
              身份／期限核對待確認；容器型號及分裝 mL 未設定。
            </p>
          )}
          {phase <= 1 && (
            <div className="prep-action-grid">
              <button
                disabled={blocked}
                onClick={() => void run({ action: "aspirate" })}
              >
                吸取來源液
              </button>
              <button
                disabled={blocked}
                onClick={() => void run({ action: "dispense", target: cupId })}
              >
                {state.pipette && materialById[state.pipette.materialId].dose
                  ? "加入一滴"
                  : "加入容器"}
              </button>
              <button
                disabled={blocked}
                onClick={() => void run({ action: "discard-pipette" })}
              >
                清空移液器
              </button>
              <button
                disabled={blocked}
                onClick={() => {
                  if (window.confirm("清空此容器並重新準備？"))
                    void run({ action: "empty", target: cupId });
                }}
              >
                清空容器
              </button>
            </div>
          )}
          {phase >= 2 && (
            <>
              <label>
                檢體架{" "}
                <select
                  aria-label="備料檢體架"
                  value={rack}
                  disabled={busy}
                  onChange={(e) => {
                    setRack(e.target.value as MaterialKind);
                    void run({
                      action: "select",
                      target: `rack:${e.target.value}`,
                    });
                  }}
                >
                  {rackKinds.map((k) => (
                    <option key={k} value={k}>
                      {rackNames[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                教學示意孔位{" "}
                <select
                  aria-label="備料孔位"
                  value={slot}
                  disabled={busy}
                  onChange={(e) => setSlot(Number(e.target.value))}
                >
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1}
                      {state.cups.some(
                        (c) => c.rack === rack && c.slot === i + 1,
                      )
                        ? " · 已占用"
                        : " · 空位"}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                {rackNames[rack]}：
                {
                  {
                    bench: "工作台",
                    entry: "左側進樣區",
                    loaded: "已推入，右側出架",
                  }[state.racks[rack].location]
                }
                {state.racks[rack].location === "loaded" &&
                  !state.racks[rack].loadedToken &&
                  "（上機認列已失效，請取回重上）"}
              </p>
              <div className="prep-action-grid">
                <button
                  disabled={blocked}
                  onClick={() =>
                    void run({ action: "place", target: cupId, rack, slot })
                  }
                >
                  放入架位
                </button>
                <button
                  disabled={blocked}
                  onClick={() => void run({ action: "unrack", target: cupId })}
                >
                  容器取回工作台
                </button>
                <button
                  disabled={blocked}
                  onClick={() => void run({ action: "stage", rack })}
                >
                  放至進樣區
                </button>
                <button
                  disabled={blocked}
                  onClick={() => void run({ action: "push", rack })}
                >
                  推入儀器
                </button>
                <button
                  disabled={busy}
                  onClick={() => void run({ action: "retrieve", rack })}
                >
                  取回檢體架
                </button>
              </div>
            </>
          )}
          {!exam && !freeSimulation && currentMaterial && (
            <p className="prep-hint">
              材料類別：{rackNames[currentMaterial.kind]}。
              {currentMaterial.dose
                ? "此系列每份兩滴。"
                : "分裝量未設定，僅記錄分裝操作。"}
            </p>
          )}
          <p role="status">{feedback || notice}</p>
          <button
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  freeSimulation
                    ? "清空本次自由備料模擬？日保養練習紀錄不受影響。"
                    : "只清除本組備料與上機紀錄？前十二組保養會保留。",
                )
              )
                void run({ action: "reset" });
            }}
          >
            {freeSimulation ? "重新開始自由模擬" : "重新準備本組"}
          </button>
        </section>
        {currentMaterial && (
          <section className="hud-card prep-material" aria-label="備料材料資訊">
            <h3>
              <button
                aria-expanded={materialOpen}
                onClick={() => setMaterialOpen(!materialOpen)}
              >
                {currentMaterial.name} ·{" "}
                {materialOpen ? "收合資訊" : "展開資訊"}
              </button>
            </h3>
            <div hidden={!materialOpen}>
              <p>
                {currentMaterial.product}
                <br />
                實際濃度：{currentMaterial.concentration || "未提供"} ·{" "}
                {currentMaterial.kind}
                <br />
                {currentMaterial.readyToUse
                  ? "Ready to Use／無需泡製"
                  : "需配製（情境已備妥）"}
              </p>
              <p className="prep-warning">
                {currentMaterial.identity === "pending"
                  ? "正式身份／濃度對應待確認。 "
                  : ""}
                瓶身批號、效期、開封／配製日期、儲位未設定，期限核對尚未完成。
              </p>
              <p>
                情境設定已具使用條件；配製與保存內容為使用者轉錄，原廠說明書核對待確認。
              </p>
              {currentMaterial.photo ? (
                <figure>
                  <button
                    aria-label="放大材料實機照片"
                    onClick={() => photo.current?.showModal()}
                  >
                    <img
                      src={asset(currentMaterial.photo.file)}
                      alt={currentMaterial.photo.caption}
                    />
                  </button>
                  <figcaption>{currentMaterial.photo.caption}</figcaption>
                </figure>
              ) : (
                <p>個別瓶身實機照片待補充；場景為教學示意模型。</p>
              )}
              <details>
                <summary>詳細資料 · 包裝／配製／保存／對應項目</summary>
                <dl>
                  <dt>包裝資訊</dt>
                  <dd>{currentMaterial.packaging || "未提供"}</dd>
                  <dt>個別瓶身資料</dt>
                  <dd>
                    批號：{materialBottles[currentMaterial.id].lot || "未設定"}
                    ； 效期：
                    {materialBottles[currentMaterial.id].expiresOn || "未設定"}
                    ； 開封：
                    {materialBottles[currentMaterial.id].openedOn || "未設定"}；
                    配製：
                    {materialBottles[currentMaterial.id].preparedOn || "未設定"}
                    ； 儲位：
                    {materialBottles[currentMaterial.id].storageLocation ||
                      "未設定"}
                    。 期限核對待確認。
                  </dd>
                  <dt>配製方式（原文轉錄）</dt>
                  <dd>{currentMaterial.preparation}</dd>
                  <dt>保存與使用（原文轉錄）</dt>
                  <dd>{currentMaterial.storageText}</dd>
                  <dt>對應檢驗項目</dt>
                  <dd>{currentMaterial.tests.join("、") || "未提供"}</dd>
                  <dt>注意事項</dt>
                  <dd>
                    {currentMaterial.notes.join(" ") || "個別瓶身資料待補充。"}
                  </dd>
                  <dt>上機分裝量</dt>
                  <dd>
                    {currentMaterial.dose
                      ? "每份兩滴（僅 AE 系列）"
                      : "未設定；包裝量及復溶量分開記錄。"}
                  </dd>
                </dl>
              </details>
            </div>
          </section>
        )}
        <section className="hud-card prep-catalog" aria-label="備料材料目錄">
          <h3>
            來源液目錄 <small>CALI 14 · QC 10 · RB 1</small>
          </h3>
          <label>
            搜尋材料
            <input
              aria-label="搜尋備料材料"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="名稱、產品或濃度"
            />
          </label>
          <div className="prep-tabs">
            {["全部", "CALI", "QC", "RB"].map((k) => (
              <button
                key={k}
                aria-pressed={filter === k}
                onClick={() => setFilter(k)}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="prep-source-list">
            {materials
              .filter(
                (m) =>
                  (filter === "全部" || m.kind === filter) &&
                  `${m.name} ${m.product} ${m.concentration || ""} ${m.aliases.map((a) => a.name).join(" ")}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((m) => (
                <button
                  disabled={busy}
                  aria-pressed={state.source === m.id}
                  key={m.id}
                  data-testid={`prep-source-${m.id}`}
                  onClick={() =>
                    void run({ action: "select", target: `source:${m.id}` })
                  }
                >
                  {m.name}
                  <small>
                    {m.concentration || "濃度代碼未提供"} · {m.kind}
                    {m.identity === "pending" ? " · 待確認" : ""}
                  </small>
                </button>
              ))}
          </div>
        </section>
      </aside>
      <dialog
        className="hud-dialog hud-photo-dialog"
        ref={photo}
        aria-label="材料實機照片"
        onCancel={(e) => {
          e.preventDefault();
          e.stopPropagation();
          photo.current?.close();
        }}
      >
        <button onClick={() => photo.current?.close()}>關閉 ×</button>
        <p>{currentMaterial?.photo?.caption}</p>
        {currentMaterial?.photo && (
          <img
            src={asset(currentMaterial.photo.file)}
            alt={currentMaterial.photo.caption}
          />
        )}
      </dialog>
    </section>
  );
}
