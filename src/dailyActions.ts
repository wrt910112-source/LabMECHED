import type { Daily } from "./DailyTraining";

export type PracticeAction =
  | "wipe"
  | "drain"
  | "mix"
  | "place-clean"
  | "discard-clean"
  | "place-cal"
  | "add-drop";
/** The original ModelPractice conditions, shared by its controls and the HUD. */
export function practiceAction(d: Daily, action: PracticeAction, target = "") {
  const cup = ["S-H", "S-L", "U-H", "U-L"].indexOf(target);
  let reason = "";
  if (action === "wipe")
    reason = !d.active
      ? "請先開始練習"
      : !d.wipeAccessible
        ? "請先開啟分析單元主蓋"
        : d.wiped.includes(target)
          ? "此探針已擦拭"
          : "";
  if (action === "drain" || action === "mix")
    reason =
      d.mode !== "inspect"
        ? "請先在電腦選擇 Inspect Probe & Mixing Bar"
        : !d.canInspect
          ? "請先完成六支探針擦拭"
          : "";
  if (action === "place-clean")
    reason = !d.active
      ? "請先開始練習"
      : !d.cupAccessible
        ? "請先開啟 ISE 黑色上蓋，並確認 ISE 已停止"
        : !["empty", "discarded"].includes(d.cleanCup)
          ? "CLEAN 位置已有杯子"
          : "";
  if (action === "discard-clean")
    reason = !d.cupAccessible
      ? "請先開啟 ISE 黑色上蓋，並確認 ISE 已停止"
      : !["full", "used"].includes(d.cleanCup)
        ? "目前沒有可取出的 CLEAN 杯"
        : "";
  if (action === "place-cal")
    reason = !d.cupAccessible
      ? "請先開啟 ISE 黑色上蓋，並確認 ISE 已停止"
      : d.cleanCup !== "discarded"
        ? "請先取出 CLEAN 杯"
        : cup < 0 || d.drops[cup] !== ""
          ? "此校正杯已放置"
          : "";
  if (action === "add-drop")
    reason = !d.cupAccessible
      ? "請先開啟 ISE 黑色上蓋，並確認 ISE 已停止"
      : cup < 0 || d.drops[cup] === ""
        ? "請先放入校正杯"
        : d.cleanCup !== "discarded"
          ? "請先取出 CLEAN 杯"
          : d.cal.serum || d.cal.urine
            ? "本次校正已執行"
            : "";
  return { enabled: !reason, reason };
}
