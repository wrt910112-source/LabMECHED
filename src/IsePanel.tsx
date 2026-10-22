import { useEffect, useRef, useState } from "react";
import {
  iseCups,
  iseRemovable,
  type IseState,
  type IseComponent,
} from "./iseModel";
import { partById, type PartId } from "./data";
export default function IsePanel({
  state,
  onChange,
  selected,
  onSelect,
}: {
  state: IseState;
  onChange: (s: IseState) => void;
  selected: PartId;
  onSelect: (id: PartId) => void;
}) {
  const component = iseRemovable.includes(selected as IseComponent)
    ? (selected as IseComponent)
    : null;
  const removed = component && state.removed.includes(component);
  const [restoring, setRestoring] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const plugsOut = ["ise-plug-a", "ise-plug-b"].every((id) =>
    state.removed.includes(id as IseComponent),
  );
  const blocked =
    !state.open ||
    restoring ||
    (!removed && component === "ise-motor" && !plugsOut) ||
    (!!removed &&
      (component === "ise-plug-a" || component === "ise-plug-b") &&
      state.removed.includes("ise-motor"));
  return (
    <section className="bottle-controls" aria-label="ISE 部件操作">
      <h3>ISE 構造探索</h3>
      <button
        className="reset-bottles"
        aria-pressed={state.open}
        disabled={restoring}
        onClick={() => onChange({ ...state, open: !state.open })}
      >
        {state.open ? "關閉 ISE 維護蓋" : "打開 ISE 維護蓋"}
      </button>
      <p className="mode-note">
        內部部件操作前請先開蓋。馬達先拔除兩個插頭再拆主體；安裝先裝主體再接回插頭。
      </p>
      {component && (
        <div className="bottle-actions">
          <button
            disabled={blocked}
            onClick={() =>
              onChange({
                ...state,
                removed: removed
                  ? state.removed.filter((id) => id !== component)
                  : [...state.removed, component],
              })
            }
          >
            {removed ? "裝回選定部件" : "拆下選定部件"}
          </button>
        </div>
      )}
      <div className="ise-component-list">
        {(["ise-internal", "ise-cups", ...iseRemovable] as PartId[]).map(
          (id) => (
            <button
              key={id}
              aria-pressed={selected === id}
              onClick={() => onSelect(id)}
            >
              {partById[id].name.replace("ISE ", "")}
              <small>
                {iseRemovable.includes(id as IseComponent)
                  ? state.removed.includes(id as IseComponent)
                    ? "已拆下"
                    : "已裝回"
                  : id === "ise-cups"
                    ? "4 杯"
                    : "斜上方俯視"}
              </small>
            </button>
          ),
        )}
      </div>
      {selected === "ise-cups" && (
        <table className="ise-cup-table">
          <tbody>
            {iseCups.map((c) => (
              <tr key={c.name}>
                <th>{c.name}</th>
                <td>{c.contents}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p role="status">
        維護蓋{state.open ? "已開啟" : "已關閉"} · 已拆下 {state.removed.length}
        ／5 個部件
      </p>
      <button
        className="reset-bottles"
        disabled={!state.open || restoring}
        onClick={() => {
          if (!state.removed.includes("ise-motor")) {
            onChange({ ...state, removed: [] });
            return;
          }
          setRestoring(true);
          // First install the body; reconnect plugs only in the subsequent visible stage.
          onChange({
            ...state,
            removed: state.removed.filter(
              (id) => id === "ise-plug-a" || id === "ise-plug-b",
            ),
          });
          timer.current = setTimeout(() => {
            onChange({ ...state, removed: [] });
            setRestoring(false);
            timer.current = null;
          }, 700);
        }}
      >
        全部裝回
      </button>
    </section>
  );
}
