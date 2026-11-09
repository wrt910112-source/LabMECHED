import { canHandleBottle } from "../shared/dailyScenario";
import { slotById } from "./detergents";
import type { InstrumentState } from "../shared/dailyScenario";
import {
  dailySyringes,
  iseReagentIds,
  iseReagentNames,
  supplyIds,
  supplyLabel,
  type DailyTasksState,
  type DailyTaskCommand,
} from "../shared/dailyTasks";
import type { BottleStates } from "./detergents";

export function DailyTasksPanel({
  tasks,
  instrument,
  bottles,
  disabled = false,
  guidance = false,
  section = "all",
  command,
  cover,
  refill,
  focus,
}: {
  tasks: DailyTasksState;
  instrument: InstrumentState;
  bottles: BottleStates;
  disabled?: boolean;
  guidance?: boolean;
  section?: "all" | "syringes" | "ise";
  command: (c: DailyTaskCommand) => void;
  cover: (
    id: "frontSyringe" | "rearSyringe" | "iseReagents" | "iseReference",
    open: boolean,
  ) => void;
  refill: (id: string) => void;
  focus?: (id: string) => void;
}) {
  return (
    <section className="daily-tasks-panel" aria-label="日保養補充與檢查">
      {section === "all" && (
        <fieldset disabled={disabled}>
          <legend>CLN-1／Diluent／DET-1／DET-2</legend>
          <div className="daily-task-cards">
            {supplyIds.map((id) => (
              <article key={id}>
                <button onClick={() => focus?.(id)}>{supplyLabel(id)}</button>
                <span>示意液量 {Math.round(bottles[id].level * 100)}%</span>
                <button
                  disabled={
                    disabled ||
                    !canHandleBottle(instrument, slotById[id].module)
                  }
                  onClick={() => refill(id)}
                >
                  補充 {supplyLabel(id)}
                </button>
              </article>
            ))}
          </div>
        </fieldset>
      )}
      {(section === "all" || section === "syringes") && (
        <fieldset disabled={disabled}>
          <legend>syringe 水氣／漏水</legend>
          {(
            [
              ["frontSyringe", "前方 syringe 櫃門"],
              ["rearSyringe", "後方 syringe 櫃門"],
            ] as const
          ).map(([id, label]) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={!!instrument[id]}
                onChange={(e) => cover(id, e.target.checked)}
              />
              {label}
            </label>
          ))}
          {dailySyringes.map((id) => (
            <article key={id}>
              <button
                onClick={() =>
                  focus?.(
                    id === "後方 syringe 組" ? "rear-syringes" : "syringes",
                  )
                }
              >
                {id}
              </button>
              {(["moisture", "leak"] as const).map((finding) => (
                <label key={finding}>
                  {finding === "moisture" ? "水氣" : "漏水"}
                  <select
                    aria-label={`${id} ${finding === "moisture" ? "水氣" : "漏水"}檢查`}
                    value={tasks.syringes[id]?.[finding] || ""}
                    onChange={(e) =>
                      command({
                        type: "daily-syringe",
                        target: id,
                        value: e.target.value,
                        data: { finding },
                      })
                    }
                  >
                    <option value="">未記錄</option>
                    <option>正常</option>
                    <option>異常</option>
                  </select>
                </label>
              ))}
            </article>
          ))}
        </fieldset>
      )}
      {(section === "all" || section === "ise") && (
        <fieldset disabled={disabled}>
          <legend>ISE Standard／Buffer／Reference</legend>
          {(
            [
              ["iseReagents", "Standard／Buffer 罩"],
              ["iseReference", "Reference 櫃門"],
            ] as const
          ).map(([id, label]) => (
            <label
              key={id}
              className={
                guidance && !instrument[id] ? "hud-control-target" : undefined
              }
            >
              <input
                type="checkbox"
                checked={!!instrument[id]}
                onChange={(e) => cover(id, e.target.checked)}
              />
              {label}
            </label>
          ))}
          {iseReagentIds.map((id) => {
            const open = !!(id === "reference"
              ? instrument.iseReference
              : instrument.iseReagents);
            const reagent = tasks.iseReagents[id];
            return (
              <article key={id} aria-label={`${iseReagentNames[id]} 操作`}>
                <button
                  onClick={() =>
                    focus?.(
                      id === "reference" ? "ise-reference" : "ise-reagents",
                    )
                  }
                >
                  {iseReagentNames[id]}
                </button>
                <span>
                  液量：
                  {tasks.iseReagents[id].checked
                    ? tasks.iseReagents[id].sufficient
                      ? "足夠"
                      : "不足"
                    : "尚未檢查"}
                </span>
                {guidance && (
                  <p className="daily-task-guidance">
                    {!open
                      ? `請先開啟${id === "reference" ? " Reference 櫃門" : " Standard／Buffer 罩"}。`
                      : !reagent.checked
                        ? `請先點選「檢查 ${iseReagentNames[id]}」。`
                        : reagent.replaced
                          ? `${iseReagentNames[id]} 已更換完成。`
                          : !reagent.sufficient
                            ? `液量不足，請點選「更換 ${iseReagentNames[id]}」。`
                            : `液量足夠，可保留；如需更換，點選「更換 ${iseReagentNames[id]}」。`}
                  </p>
                )}
                <button
                  disabled={!open}
                  className={
                    guidance && open && !reagent.checked
                      ? "hud-control-target"
                      : undefined
                  }
                  onClick={() =>
                    command({
                      type: "ise-reagent",
                      target: id,
                      value: "inspect",
                    })
                  }
                >
                  檢查 {iseReagentNames[id]}
                </button>
                <button
                  disabled={!open}
                  className={
                    guidance && open && reagent.checked && !reagent.replaced
                      ? "hud-control-target"
                      : undefined
                  }
                  onClick={() =>
                    command({
                      type: "ise-reagent",
                      target: id,
                      value: "replace",
                    })
                  }
                >
                  更換 {iseReagentNames[id]}
                </button>
              </article>
            );
          })}
        </fieldset>
      )}
    </section>
  );
}
