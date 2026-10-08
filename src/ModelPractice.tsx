import type { Daily } from "./DailyTraining";
export const practiceIds = [
  "R1-1",
  "R1-2",
  "R2-1",
  "R2-2",
  "Sample-1",
  "Sample-2",
  "左側",
  "右側",
  "S-H",
  "S-L",
  "U-H",
  "U-L",
];
export function ModelPractice({
  d,
  target,
  setTarget,
  onComputer,
  onClose,
}: {
  d: Daily;
  target: string;
  setTarget: (s: string) => void;
  onComputer: () => void;
  onClose: () => void;
}) {
  const cup = ["S-H", "S-L", "U-H", "U-L"].indexOf(target),
    mix = target === "左側" || target === "右側";
  const ready = d.completed[3] && d.active;
  return (
    <section className="model-practice">
      <h3>模型日保養操作</h3>
      <p>
        點模型上的標籤或部件，再使用下方工具。檢查動畫為正常情境示意，需自行確認結果。
      </p>
      <div className="practice-targets">
        {practiceIds.map((id) => (
          <button
            key={id}
            aria-pressed={target === id}
            onClick={() => setTarget(id)}
          >
            {id}
          </button>
        ))}
      </div>
      <h4>已選取：{target}</h4>
      {cup >= 0 ? (
        <>
          <p>
            {target} 杯位 ·{" "}
            {["Serum High", "Serum Low", "Urine High", "Urine Low"][cup]}
          </p>
          {cup === 3 && (
            <>
              <button
                disabled={!ready || d.cleanCup !== "empty"}
                onClick={() => d.setCleanCup("full")}
              >
                放入裝滿 Cleaning Solution 的 CLEAN 杯
              </button>
              <button
                disabled={d.cleanCup !== "used" || d.prime !== 3}
                onClick={() => d.setCleanCup("discarded")}
              >
                取出並丟棄 CLEAN 杯
              </button>
              <p>
                CLEAN：
                {d.cleanCup === "empty"
                  ? "未放置"
                  : d.cleanCup === "full"
                    ? "已裝滿"
                    : d.cleanCup === "used"
                      ? "已使用"
                      : "已丟棄"}
              </p>
            </>
          )}
          <button
            disabled={d.cleanCup !== "discarded" || d.drops[cup] !== ""}
            onClick={() =>
              d.setDrops((v) => v.map((n, i) => (i === cup ? "0" : n)))
            }
          >
            放入 {target} 校正杯
          </button>
          <button
            disabled={
              d.drops[cup] === "" ||
              d.cleanCup !== "discarded" ||
              d.cal.serum ||
              d.cal.urine
            }
            onClick={() =>
              d.setDrops((v) =>
                v.map((n, i) => (i === cup ? String(Number(n) + 1) : n)),
              )
            }
          >
            滴入 1 滴{" "}
            {["Serum High", "Serum Low", "Urine High", "Urine Low"][cup]}
          </button>
          <p>已加入 {d.drops[cup] || 0} 滴／至少 10 滴</p>
        </>
      ) : mix ? (
        <>
          <p>
            {d.mode === "inspect"
              ? "攪拌棒旋轉示意已啟動。"
              : "先在電腦選 Inspect Probe & Mixing Bar。"}
          </p>
          <button
            disabled={d.mode !== "inspect" || d.cleaned}
            onClick={() => d.setMix((v) => ({ ...v, [target]: "正常" }))}
          >
            確認 {target} mixing bars 正常
          </button>
          <button
            disabled={d.mode !== "inspect" || d.cleaned}
            onClick={() => d.setMix((v) => ({ ...v, [target]: "異常" }))}
          >
            記錄攪拌異常
          </button>
          <p>{d.mix[target] || "未檢查"}</p>
        </>
      ) : (
        <>
          <p>
            {d.mode === "wipe"
              ? "已進入 Cleaning Probe，可使用酒精棉。"
              : d.mode === "inspect"
                ? "正常排水動畫示意已啟動。"
                : "請先在電腦勾選 Analyzer Maintenance 並選 Cleaning Probe。"}
          </p>
          <button
            disabled={d.mode !== "wipe" || d.wiped.includes(target)}
            onClick={() => d.setWiped((v) => [...v, target])}
          >
            用酒精棉擦拭 {target}
          </button>
          <button
            disabled={d.mode !== "inspect" || d.cleaned}
            onClick={() => d.setDrains((v) => ({ ...v, [target]: "正常" }))}
          >
            確認 {target} 正常排水
          </button>
          <button
            disabled={d.mode !== "inspect" || d.cleaned}
            onClick={() => d.setDrains((v) => ({ ...v, [target]: "異常" }))}
          >
            記錄排水異常
          </button>
          <p>
            {d.wiped.includes(target) ? "✓ 已擦拭" : "尚未擦拭"} ·{" "}
            {d.drains[target] || "排水未檢查"}
          </p>
        </>
      )}
      <hr />
      <p>
        擦拭 {d.wiped.length}／6 · Prime {d.prime}／3
      </p>
      <button onClick={onComputer}>返回電腦繼續程序</button>
      <button onClick={onClose}>結束模型操作視圖</button>
    </section>
  );
}
