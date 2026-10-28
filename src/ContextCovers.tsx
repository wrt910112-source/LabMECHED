import type { PartId } from "./data";
import type { DoorId, DoorState } from "./enclosures";
import type { SceneSelection } from "./Viewer";
const names: Record<DoorId | string, string> = {
  main: "分析單元主蓋",
  "ise-module": "ISE module 鐵蓋",
  "ise-top": "ISE 上蓋（前）",
  "ise-top-rear": "ISE 上蓋（後）",
  "ise-middle": "Standard／Buffer 黑蓋",
  "ise-bottom": "Reference 櫃門",
  "loader-door": "Wash Solution 櫃門",
  "syringe-front": "前方 syringe 櫃門",
  "syringe-rear": "後方 syringe 櫃門",
};
export function ContextCovers({
  part,
  door,
  mainOpen,
  moduleOpen,
  doors,
  main,
  module,
  toggle,
  disabledReason,
}: {
  disabledReason?: string;
  part: PartId;
  door?: SceneSelection["doorId"];
  mainOpen: boolean;
  moduleOpen: boolean;
  doors: DoorState;
  main: () => void;
  module: () => void;
  toggle: (id: DoorId) => void;
}) {
  const ids = door
    ? [door]
    : part === "ise-reagents"
      ? ["ise-middle"]
      : part === "ise-reference"
        ? ["ise-bottom"]
        : part === "clean-solution" || part === "loader"
          ? ["loader-door"]
          : part === "syringes"
            ? ["syringe-front"]
            : part === "rear-syringes"
              ? ["syringe-rear"]
              : part === "ise"
                ? [
                    "ise-top",
                    "ise-top-rear",
                    "ise-module",
                    "ise-middle",
                    "ise-bottom",
                  ]
                : part.startsWith("ise-")
                  ? ["ise-top", "ise-module"]
                  : [
                        "analyzer",
                        "r1",
                        "r2",
                        "sample",
                        "mixing",
                        "washing",
                        "reaction",
                      ].includes(part)
                    ? ["main"]
                    : [];
  return ids.length ? (
    <section className="context-covers" aria-label="所選部件機殼操作">
      {ids.map((id) => {
        const open =
          id === "main"
            ? mainOpen
            : id === "ise-module"
              ? moduleOpen
              : doors[id as DoorId];
        return (
          <button
            key={id}
            disabled={!!disabledReason}
            title={disabledReason}
            data-testid={`context-${id}`}
            aria-pressed={open}
            onClick={() =>
              id === "main"
                ? main()
                : id === "ise-module"
                  ? module()
                  : toggle(id as DoorId)
            }
          >
            {open ? "關閉" : "開啟"}
            {names[id]}
            <small>{open ? "已開啟" : "已關閉"}</small>
          </button>
        );
      })}
    </section>
  ) : null;
}
