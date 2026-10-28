import type { DoorId, DoorState } from "./enclosures";
export default function EnclosurePanel({
  loader,
  state,
  onToggle,
}: {
  loader: boolean;
  state: DoorState;
  onToggle: (id: DoorId) => void;
}) {
  const rows: Array<[DoorId, string]> = loader
    ? [["loader-door", "Wash Solution 櫃門"]]
    : [
        ["ise-top", "上層探針黑色罩（前蓋）"],
        ["ise-top-rear", "上層探針黑色罩（後蓋）"],
        ["ise-middle", "中層 Mid Standard／Buffer 罩"],
        ["ise-bottom", "下層 Reference 櫃門"],
      ];
  return (
    <section className="bottle-controls" aria-label="外蓋與櫃門操作">
      <h3>{loader ? "進架區下方櫃體" : "ISE 三層外觀"}</h3>
      <div className="ise-component-list">
        {rows.map(([id, name]) => (
          <button
            key={id}
            data-testid={`door-${id}`}
            aria-pressed={state[id]}
            onClick={() => onToggle(id)}
          >
            {state[id] ? "關閉" : "打開"}
            {name}
          </button>
        ))}
      </div>
      <p className="mode-note">
        {loader
          ? "Wash Solution 桶固定放置於托盤；容量與管路為照片外觀示意。"
          : "中層左瓶為 Mid Standard，右瓶為 Buffer；Reference 放在下層。三層可獨立開關。"}
      </p>
    </section>
  );
}
