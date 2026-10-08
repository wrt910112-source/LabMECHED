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
  return (
    <section className="bottle-controls" aria-label="ISE 部件操作">
      <h3>ISE 構造探索</h3>
      <button
        className="reset-bottles"
        aria-pressed={state.open}
        onClick={() => onChange({ ...state, open: !state.open })}
      >
        {state.open ? "關閉 ISE 維護蓋" : "打開 ISE 維護蓋"}
      </button>
      <p className="mode-note">
        拆下時將部件抬起展示，供辨識構造；此自由探索不代表正式保養順序。內部部件操作前請先開蓋。
      </p>
      {component && (
        <div className="bottle-actions">
          <button
            disabled={!state.open}
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
        {(["ise-cups", ...iseRemovable] as PartId[]).map((id) => (
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
                : "4 杯"}
            </small>
          </button>
        ))}
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
        onClick={() => onChange({ open: true, removed: [] })}
      >
        全部裝回
      </button>
    </section>
  );
}
