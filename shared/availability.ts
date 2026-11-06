export const pilotTaskAvailability = {
  daily: true,
  troubleshooting: true,
  weekly: false,
  biweekly: false,
} as const;
export function isTaskOpen(kind: string) {
  return (
    Object.prototype.hasOwnProperty.call(pilotTaskAvailability, kind) &&
    pilotTaskAvailability[kind as keyof typeof pilotTaskAvailability]
  );
}
export const taskClosedMessage =
  "首波只開放日保養與 QC 異常處理；此任務暫未開放，既有紀錄仍可查閱。";
