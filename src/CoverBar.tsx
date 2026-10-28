import { Check, Settings2 } from "lucide-react";
import type { DoorId, DoorState } from "./enclosures";

export default function CoverBar({
  mainOpen,
  moduleOpen,
  doors,
  linkedIseTops,
  onMain,
  onModule,
  onDoor,
}: {
  mainOpen: boolean;
  moduleOpen: boolean;
  doors: DoorState;
  linkedIseTops: boolean;
  onMain: () => void;
  onModule: () => void;
  onDoor: (id: DoorId) => void;
}) {
  const rows: {
    id: DoorId | "ise-module";
    label: string;
    testId: string;
    open: boolean;
  }[] = [
    {
      id: "syringe-front",
      label: "前方 syringe 櫃門",
      testId: "front-syringe-toggle",
      open: doors["syringe-front"],
    },
    {
      id: "syringe-rear",
      label: "後方 syringe 櫃門",
      testId: "rear-syringe-toggle",
      open: doors["syringe-rear"],
    },
    {
      id: "ise-top",
      label: linkedIseTops ? "ISE 上蓋（前／後）" : "ISE 上蓋（前）",
      testId: "cover-ise-top",
      open: doors["ise-top"],
    },
    ...(!linkedIseTops
      ? [
          {
            id: "ise-top-rear" as const,
            label: "ISE 上蓋（後）",
            testId: "cover-ise-top-rear",
            open: doors["ise-top-rear"],
          },
        ]
      : []),
    {
      id: "ise-module",
      label: "ISE module 鐵蓋",
      testId: "cover-ise-module",
      open: moduleOpen,
    },
    {
      id: "ise-middle",
      label: "Standard／Buffer 黑蓋",
      testId: "cover-ise-middle",
      open: doors["ise-middle"],
    },
    {
      id: "ise-bottom",
      label: "Reference 櫃門",
      testId: "cover-ise-bottom",
      open: doors["ise-bottom"],
    },
    {
      id: "loader-door",
      label: "Wash Solution 櫃門",
      testId: "cover-loader-door",
      open: doors["loader-door"],
    },
  ];
  return (
    <section
      className="internal-setting cover-bar"
      aria-label="蓋子與櫃門操作列"
    >
      <div className="cover-bar-heading">
        <span className="setting-icon">
          <Settings2 size={20} />
        </span>
        <div>
          <strong>蓋子與櫃門操作</strong>
          <p>分析單元主蓋{mainOpen ? "已開啟，可查看內部構造" : "已關閉"}</p>
        </div>
        <button
          className={`switch ${mainOpen ? "checked" : ""}`}
          role="switch"
          aria-checked={mainOpen}
          aria-label="顯示內部構造"
          title={mainOpen ? "關閉分析單元主蓋" : "開啟分析單元主蓋"}
          onClick={onMain}
        >
          <span>{mainOpen && <Check size={12} />}</span>
        </button>
      </div>
      <div className="cover-bar-buttons">
        {rows.map((row) => (
          <button
            key={row.id}
            className="cabinet-toggle"
            data-testid={row.testId}
            aria-pressed={row.open}
            onClick={() =>
              row.id === "ise-module" ? onModule() : onDoor(row.id)
            }
          >
            {row.open ? "關閉" : "開啟"}
            {row.label}
          </button>
        ))}
      </div>
    </section>
  );
}
