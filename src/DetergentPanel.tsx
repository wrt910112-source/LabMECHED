import {
  Droplets,
  FlaskConical,
  ArrowUpFromLine,
  RotateCcw,
  ArrowLeft,
  Replace,
  Info,
} from "lucide-react";
import { useState } from "react";
import {
  washBanks,
  washSlots,
  slotById,
  allowedFluids,
  fluidNames,
  modeNames,
  type BottleStates,
  type CareMode,
  type Fluid,
  type BottleAction,
} from "./detergents";

interface Props {
  module: "r1" | "r2" | "sample" | "ise";
  selectedSlot: string | null;
  bottles: BottleStates;
  mode: CareMode;
  busy: boolean;
  disabledReason?: string;
  message: string;
  onMode: (m: CareMode) => void;
  onSlot: (id: string) => void;
  onAction: (action: BottleAction) => void;
  onReset: () => void;
  onBack: () => void;
}
export default function DetergentPanel(p: Props) {
  const [all, setAll] = useState(false),
    [chosenFluid, setChosenFluid] = useState<Fluid | null>(null);
  const slot = p.selectedSlot ? slotById[p.selectedSlot] : null,
    bottle = slot ? p.bottles[slot.id] : null;
  const allowed = slot ? allowedFluids(slot, p.mode) : [],
    fluid =
      chosenFluid && allowed.includes(chosenFluid) ? chosenFluid : allowed[0];
  const wrongMode = !!bottle?.fluid && !allowed.includes(bottle.fluid);
  const sample = p.module === "sample";
  const banks = washBanks.filter((b) =>
    p.module === "ise"
      ? b.module === "ise"
      : b.module !== "ise" && (b.module === "sample") === sample,
  );
  const installed = washSlots.filter(
    (s) => banks.some((b) => b.id === s.bankId) && p.bottles[s.id].fluid,
  ).length;
  return (
    <div className="detergent-panel">
      <div className="wash-heading">
        <span className="eyebrow">BOTTLE WORKSPACE</span>
        <button onClick={p.onBack}>
          <ArrowLeft size={12} />
          部件介紹
        </button>
      </div>
      <h2>洗滌劑槽與瓶子</h2>
      <p className="wash-summary">
        {p.module === "ise"
          ? "1 組 × 2 孔"
          : sample
            ? "2 組 × 2 孔"
            : "4 組 × 3 孔"}{" "}
        · 已放置 {installed} / {p.module === "ise" ? 2 : sample ? 4 : 12} 瓶
      </p>
      <div className="care-mode" aria-label="槽位配置">
        {(["daily", "weekly", "biweekly"] as CareMode[]).map((mode) => (
          <button
            key={mode}
            disabled={p.busy}
            aria-pressed={mode === p.mode}
            onClick={() => {
              setChosenFluid(null);
              p.onMode(mode);
            }}
          >
            {modeNames[mode]}
          </button>
        ))}
      </div>
      <p className="mode-note">
        {p.module === "ise"
          ? "平日 DET-1、DET-2 常駐；周保養將 DET-1 換為 W2，DET-2 保留。"
          : sample
            ? "平日：2 瓶 DET-1＋2 瓶 DET-2。周／雙周保養先取出同側 DET-2，再於 61／63 換入 W2；62／64 留空。"
            : p.mode === "daily"
              ? "平日：4 瓶 CLN-1＋2 瓶 Diluent。"
              : "保養配置：W2 可放入專用槽或 R1 共用槽。"}
        <br />
        {sample ? "左右依儀器後方視角標示。" : "CLN-2 目前未使用。"}
      </p>
      {slot && bottle ? (
        <section
          className="bottle-controls"
          aria-label="選定瓶子操作"
          data-testid="bottle-controls"
          data-slot={slot.id}
          data-fluid={bottle.fluid ?? "empty"}
          data-level={bottle.level}
          data-revision={bottle.revision}
        >
          <div className="bottle-title">
            <FlaskConical size={20} />
            <div>
              <span>{washBanks.find((b) => b.id === slot.bankId)!.name}</span>
              <h3>{slot.label}</h3>
            </div>
            <span className={`bottle-state ${bottle.fluid ? "filled" : ""}`}>
              {bottle.fluid ? fluidNames[bottle.fluid] : "空槽"}
            </span>
          </div>
          {slot.role === "unused" ? (
            <p className="slot-notice">此 CLN-2 槽目前未使用，保持空槽。</p>
          ) : (
            <>
              {bottle.fluid && (
                <div className="fill-indicator">
                  <span>示意液量</span>
                  <strong>{Math.round(bottle.level * 100)}%</strong>
                  <div
                    role="meter"
                    aria-label="示意液量"
                    aria-valuenow={bottle.level * 100}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <i style={{ width: `${bottle.level * 100}%` }} />
                  </div>
                </div>
              )}
              {wrongMode && (
                <p className="slot-notice">
                  平日不使用 W2，請
                  {slot.role === "shared"
                    ? "更換為 Diluent"
                    : slot.role === "det1"
                      ? "更換為 DET-1"
                      : "取出瓶子"}
                  。
                </p>
              )}
              {allowed.length === 0 && !bottle.fluid && (
                <p className="slot-notice">
                  此 W2 槽平日留空；請切換周／雙周保養配置後放瓶。
                </p>
              )}
              {allowed.length > 1 && (
                <label className="fluid-choice">
                  新瓶內容
                  <select
                    aria-label="新瓶內容"
                    value={fluid}
                    disabled={p.busy}
                    onChange={(e) => setChosenFluid(e.target.value as Fluid)}
                  >
                    {allowed.map((f) => (
                      <option key={f} value={f}>
                        {fluidNames[f]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="bottle-actions">
                <button
                  disabled={p.busy || !!p.disabledReason || !fluid} title={p.disabledReason}
                  onClick={() => p.onAction({ kind: "replace", fluid })}
                >
                  <Replace size={14} />
                  {bottle.fluid ? "更換新瓶" : "放入瓶子"}
                </button>
                <button
                  disabled={
                    p.busy || !!p.disabledReason || !bottle.fluid || wrongMode || bottle.level >= 1
                  }
                  onClick={() => p.onAction({ kind: "refill" })}
                >
                  <Droplets size={14} />
                  補充
                </button>
                <button
                  disabled={p.busy || !!p.disabledReason || !bottle.fluid} title={p.disabledReason}
                  onClick={() => p.onAction({ kind: "remove" })}
                >
                  <ArrowUpFromLine size={14} />
                  取出
                </button>
              </div>
            </>
          )}
        </section>
      ) : (
        <p className="slot-notice">點選 3D 瓶子或下方槽位開始操作。</p>
      )}
      <p role="status" className="bottle-message">
        {p.busy
          ? "瓶子操作中…"
          : p.disabledReason || p.message || "可點選瓶子或空槽，選擇更換、補充或取出。"}
      </p>
      <div className="wash-grid-title">
        <span>
          {sample ? "由儀器後方看，從左至右" : "由儀器前方看，從左至右"}
        </span>
        {!sample && p.module !== "ise" && (
          <button onClick={() => setAll((v) => !v)} aria-pressed={all}>
            {all ? "只看 " + p.module.toUpperCase() : "顯示全部 12 孔"}
          </button>
        )}
      </div>
      <div className="wash-bank-list">
        {banks
          .filter((b) => sample || all || b.module === p.module)
          .map((bank) => (
            <section
              className="wash-bank-card"
              key={bank.id}
              aria-label={bank.name}
            >
              <h4>
                {bank.name}
                <span>{bank.labels[0].split(".")[0]} 組</span>
              </h4>
              <div
                className="wash-slot-grid"
                style={{
                  gridTemplateColumns: `repeat(${bank.labels.length}, 1fr)`,
                }}
              >
                {washSlots
                  .filter((s) => s.bankId === bank.id)
                  .map((s) => {
                    const b = p.bottles[s.id];
                    return (
                      <button
                        key={s.id}
                        className={`wash-slot ${p.selectedSlot === s.id ? "selected" : ""}`}
                        data-testid={`slot-${s.id}`}
                        data-fluid={b.fluid ?? "empty"}
                        aria-pressed={p.selectedSlot === s.id}
                        disabled={p.busy}
                        onClick={() => {
                          setChosenFluid(null);
                          p.onSlot(s.id);
                        }}
                      >
                        <span
                          className={`slot-miniature ${b.fluid ? "has-bottle" : ""} ${s.role === "unused" ? "unused" : ""}`}
                        >
                          <i style={{ height: `${b.level * 100}%` }} />
                        </span>
                        <strong>{s.label}</strong>
                        <small>
                          {s.role === "unused"
                            ? "未使用"
                            : b.fluid
                              ? fluidNames[b.fluid]
                              : "空槽"}
                        </small>
                      </button>
                    );
                  })}
              </div>
            </section>
          ))}
      </div>
      <div className="wash-footer">
        <Info size={13} />
        <p>
          示意液量供遊戲操作，不代表實際容量或保養用量。配置切換不會自動換瓶。
        </p>
      </div>
      <button className="reset-bottles" onClick={p.onReset} disabled={p.busy}>
        <RotateCcw size={13} />
        重設為平日 {sample ? 4 : 6} 瓶配置
      </button>
    </div>
  );
}
